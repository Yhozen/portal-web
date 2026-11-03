import test from "node:test";
import assert from "node:assert/strict";
import { gateway as handleGateway, serveAsset } from "../src/http.ts";
import { allowedEmails } from "../scripts/config.mjs";

const path = `/assets/${"a".repeat(64)}/portal-engine.js`;
const request = (suffix = path, init) => new Request(`https://portal.test${suffix}`, init);
const env = { ALLOWED_EMAILS: allowedEmails.join(",") };
const shell = Object.fromEntries([["index.html", "text/html"], ["release.json", "application/json"],
  ["loader.js", "text/javascript"], ["release.js", "text/javascript"]]
  .map(([name, contentType]) => [`/${name}`, { body: "shell ✓", contentType }]));
const gateway = (request, env, ctx) => handleGateway(request, env, ctx, shell);
const identity = { getIdentity: async () => ({ email: allowedEmails[0] }) };

test("anonymous and forged-header requests never reach assets or a warm internal cache", async () => {
  let calls = 0;
  const ctx = { exports: { Assets: { fetch: async () => { calls++; return new Response("cached"); } } } };
  for (const headers of [{}, { "Cf-Access-Authenticated-User-Email": allowedEmails[0] },
    { "Cf-Access-Jwt-Assertion": "forged" }, { Cookie: "CF_Authorization=forged" }]) {
    for (const url of ["/", path]) {
      const response = await gateway(request(url, { headers }), env, ctx);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  }
  const other = await gateway(request(path), env, { ...ctx, access: { getIdentity: async () => ({ email: "other@test.net" }) } });
  assert.equal(other.status, 403);
  assert.equal(calls, 0);
});

test("allowlisted identities get the shell with no-store and security headers; HEAD has no body", async () => {
  const ctx = { access: { getIdentity: async () => ({ email: allowedEmails[1].toUpperCase() }) }, exports: { Assets: { fetch: async () => new Response("") } } };
  for (const [url, page] of [["/", shell["/index.html"]], ["/release.json", shell["/release.json"]], ["/loader.js", shell["/loader.js"]]]) {
    const response = await gateway(request(url), env, ctx);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), page.body);
    assert.equal(response.headers.get("Content-Type"), `${page.contentType}; charset=utf-8`);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
    assert.equal(Number(response.headers.get("Content-Length")), Buffer.byteLength(page.body));
    const head = await gateway(request(url, { method: "HEAD" }), env, ctx);
    assert.equal(head.status, 200);
    assert.equal(head.body, null);
  }
});

test("authorized asset responses stream, strip credentials and use private immutable browser caching", async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.close(); } });
  const response = await gateway(request(path, { headers: { Cookie: "private", Authorization: "private" } }), env, {
    access: identity, exports: { Assets: { fetch: async (incoming) => {
      assert.equal(new URL(incoming.url).host, "assets.internal");
      assert.equal(incoming.headers.get("Cookie"), null);
      assert.equal(incoming.headers.get("Authorization"), null);
      return new Response(body, { headers: { "Cf-Cache-Status": "HIT", "Content-Type": "text/javascript", "Content-Length": "2" } });
    } } },
  });
  assert.equal(response.body, body);
  assert.equal(response.headers.get("X-Portal-Asset-Cache"), "HIT");
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=31536000, immutable");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2]);
});

test("game-file paths, the dev server's /fs/ route and unknown files are never served", async () => {
  let calls = 0;
  const ctx = { access: identity, exports: { Assets: { fetch: async () => { calls++; return new Response("missing", { status: 404 }); } } } };
  for (const url of ["/fs/maps/testchmb_a_00.bsp", "/ls", "/portal/portal_pak_dir.vpk", "/assets/x/portal_pak_000.vpk",
    `/assets/${"a".repeat(64)}/testchmb_a_00.bsp`, `/assets/${"a".repeat(64)}/portal-engine.js.map`, `${path}?v=1`, "/main.js"]) {
    const response = await gateway(request(url), env, ctx);
    assert.equal(response.status, 404, url);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(calls, 0);
  assert.equal((await gateway(request(path, { method: "PUT" }), env, ctx)).status, 405);
  for (const url of ["/fs/maps/a.bsp", `/assets/${"a".repeat(64)}/x.vpk`]) assert.equal((await serveAsset(request(url), { get: async () => { throw new Error("must not read"); } })).status, 404);
});

test("R2 GET streams the body, HEAD omits it, and ETag revalidation returns 304", async () => {
  let heads = 0, gets = 0;
  const metadata = { size: 3, httpEtag: '"etag"', writeHttpMetadata: (h) => h.set("Content-Type", "text/javascript") };
  const bucket = { head: async () => { heads++; return metadata; }, get: async () => {
    gets++; return { ...metadata, body: new Response(new Uint8Array([1, 2, 3])).body };
  } };
  const response = await serveAsset(request(), bucket);
  assert.equal(response.headers.get("Content-Type"), "text/javascript");
  assert.equal(response.headers.get("Content-Length"), "3");
  assert.match(response.headers.get("Cache-Control"), /^public/);
  assert.equal((await response.arrayBuffer()).byteLength, 3);
  assert.equal((await serveAsset(request(path, { method: "HEAD" }), bucket)).body, null);
  assert.equal(heads, 1);
  assert.equal((await serveAsset(request(path, { headers: { "If-None-Match": '"etag"' } }), bucket)).status, 304);
  assert.equal(gets, 2);
  assert.equal((await serveAsset(request(), { get: async () => null })).status, 404);
  const failure = await serveAsset(request(), { get: async () => { throw new Error("offline"); } });
  assert.equal(failure.status, 502);
  assert.equal(failure.headers.get("Cache-Control"), "no-store");
});

test("unavailable identity and internal cache fail closed without caching errors", async () => {
  const fetch = async () => { throw new Error("unavailable"); };
  const ctx = { access: identity, exports: { Assets: { fetch } } };
  const unavailable = await gateway(request(path), env, ctx);
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
  const response = await gateway(request(), env, { ...ctx, access: { getIdentity: fetch } });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
