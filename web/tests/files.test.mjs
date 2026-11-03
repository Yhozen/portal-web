// The owner-only /files/ route (private game-files bucket). Objects here are made-up bytes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gateway as handleGateway, parseRange } from "../src/http.ts";
import { allowedEmails, gameFilesBucket, ownerEmail } from "../scripts/config.mjs";

const shell = { "/index.html": { body: "shell", contentType: "text/html" } };
const env = (files) => ({ ALLOWED_EMAILS: allowedEmails.join(","), OWNER_EMAIL: ownerEmail, FILES: files });
const as = (email) => ({ access: { getIdentity: async () => email ? { email } : undefined },
  exports: { Assets: { fetch: async () => { throw new Error("game files must not use the shared cached entrypoint"); } } } });
const req = (path, headers = {}, method = "GET") => new Request(`https://portal.test${path}`, { headers, method });
const gateway = (r, e, c) => handleGateway(r, e, c, shell);

// Minimal in-memory R2 bucket with the head/get(range, onlyIf) semantics the Worker uses.
function memoryBucket(objects) {
  const reads = [];
  const meta = (key) => ({ key, size: objects[key].length, etag: `etag-${key.length}`, httpEtag: `"etag-${key.length}"` });
  return { reads,
    async head(key) { reads.push(["head", key]); return objects[key] ? meta(key) : null; },
    async get(key, options = {}) {
      reads.push(["get", key, options.range]);
      if (!objects[key]) return null;
      const m = meta(key);
      if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== m.etag) return m;
      const { offset = 0, length = m.size - offset } = options.range ?? {};
      return { ...m, body: new Response(objects[key].slice(offset, offset + length)).body };
    } };
}
const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
const manifest = JSON.stringify({ format: 1, files: { "portal/portal_pak_000.vpk": 1000 }, total: 1000 });
const bucket = () => memoryBucket({ "manifest.json": new TextEncoder().encode(manifest), "files/portal/portal_pak_000.vpk": bytes });

test("owner identity: 200 manifest and file, private caching, never the shared cache", async () => {
  const files = bucket();
  const m = await gateway(req("/files/manifest.json"), env(files), as(ownerEmail.toUpperCase()));
  assert.equal(m.status, 200);
  assert.deepEqual(await m.json(), JSON.parse(manifest));
  assert.equal(m.headers.get("Cache-Control"), "private, no-store");
  assert.equal(m.headers.get("Content-Type"), "application/json");
  const f = await gateway(req("/files/portal/portal_pak_000.vpk"), env(files), as(ownerEmail));
  assert.equal(f.status, 200);
  assert.deepEqual(new Uint8Array(await f.arrayBuffer()), bytes);
  assert.equal(f.headers.get("Cache-Control"), "private, max-age=86400");
  assert.match(f.headers.get("Vary"), /Cookie/);
  assert.equal(f.headers.get("Accept-Ranges"), "bytes");
  assert.equal(f.headers.get("Content-Length"), "1000");
  assert.equal(f.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  const nm = await gateway(req("/files/portal/portal_pak_000.vpk", { "If-None-Match": f.headers.get("ETag") }), env(files), as(ownerEmail));
  assert.equal(nm.status, 304);
});

test("other allowlisted players get the engine but 403 on /files/, without touching the bucket", async () => {
  const files = bucket();
  for (const email of allowedEmails.filter((e) => e !== ownerEmail)) {
    assert.equal((await gateway(req("/"), env(files), as(email))).status, 200, "engine shell");
    for (const path of ["/files/manifest.json", "/files/portal/portal_pak_000.vpk"]) {
      const r = await gateway(req(path, { Range: "bytes=0-9" }), env(files), as(email));
      assert.equal(r.status, 403, `${email} ${path}`);
      assert.equal(r.headers.get("Cache-Control"), "no-store");
    }
  }
  // No OWNER_EMAIL configured: closed for everyone.
  assert.equal((await gateway(req("/files/manifest.json"), { ...env(files), OWNER_EMAIL: "" }, as(ownerEmail))).status, 403);
  assert.deepEqual(files.reads, []);
});

test("no Access identity: 403 before anything else (Cloudflare Access redirects to login at the edge)", async () => {
  const files = bucket();
  for (const headers of [{}, { "Cf-Access-Authenticated-User-Email": ownerEmail }, { Cookie: "CF_Authorization=forged" }]) {
    const r = await gateway(req("/files/manifest.json", headers), env(files), as(undefined));
    assert.equal(r.status, 403);
  }
  assert.deepEqual(files.reads, []);
  // The edge part: one Access app covers the whole hostname (including /files/) and auto-redirects to the PIN login.
  const stack = await readFile(new URL("../alchemy.run.ts", import.meta.url), "utf8");
  assert.match(stack, /autoRedirectToIdentity: true/);
  assert.doesNotMatch(stack, /destinations|selfHostedDomains/);
});

test("Range requests: 206 slices, suffix and open-ended ranges, 416 when unsatisfiable, HEAD", async () => {
  const files = bucket(), url = "/files/portal/portal_pak_000.vpk";
  const cases = [["bytes=0-15", 0, 16], ["bytes=990-", 990, 10], ["bytes=-4", 996, 4], ["bytes=500-5000", 500, 500]];
  for (const [range, offset, length] of cases) {
    const r = await gateway(req(url, { Range: range }), env(files), as(ownerEmail));
    assert.equal(r.status, 206, range);
    assert.equal(r.headers.get("Content-Range"), `bytes ${offset}-${offset + length - 1}/1000`);
    assert.equal(r.headers.get("Content-Length"), String(length));
    assert.deepEqual(new Uint8Array(await r.arrayBuffer()), bytes.slice(offset, offset + length));
  }
  for (const range of ["bytes=1000-", "bytes=5-2", "bytes=-0", "items=0-1", "bytes=0-1,4-5"]) {
    const r = await gateway(req(url, { Range: range }), env(files), as(ownerEmail));
    assert.equal(r.status, 416, range);
    assert.equal(r.headers.get("Content-Range"), "bytes */1000");
  }
  const stale = await gateway(req(url, { Range: "bytes=0-1", "If-Range": '"old"' }), env(files), as(ownerEmail));
  assert.equal(stale.status, 200, "If-Range mismatch serves the whole file");
  await stale.arrayBuffer();
  const head = await gateway(req(url, { Range: "bytes=0-99" }, "HEAD"), env(files), as(ownerEmail));
  assert.equal(head.status, 206); assert.equal(head.headers.get("Content-Length"), "100"); assert.equal(await head.text(), "");
  assert.deepEqual(parseRange(null, 10), null);
});

test("/files/ only maps install paths to files/<path>; anything else is 404 without a bucket read", async () => {
  const files = bucket();
  for (const path of ["/files/", "/files/../manifest.json", "/files/Portal/portal_pak_000.vpk", "/files/bin/server.so",
    "/files/portal//x", "/files/portal/portal_pak_000.vpk?x=1", "/files/manifest.json/x", "/files/files/portal/portal_pak_000.vpk"]) {
    const r = await gateway(new Request(`https://portal.test${path.replace("/../", "/%2E%2E/")}`), env(files), as(ownerEmail));
    assert.equal(r.status, 404, path);
  }
  assert.deepEqual(files.reads, []);
  assert.equal((await gateway(req("/files/portal/missing.vpk"), env(files), as(ownerEmail))).status, 404);
  assert.equal((await gateway(req("/files/manifest.json", {}, "PUT"), env(files), as(ownerEmail))).status, 405);
});

test("the stack makes the game-files bucket private, and nothing in build/deploy uploads game files", async () => {
  const stack = await readFile(new URL("../alchemy.run.ts", import.meta.url), "utf8");
  assert.match(stack, /R2\.Bucket\("GameFiles", \{ name: gameFilesBucket, publicAccess: false, domains: \[\], cors: \[\] \}\)/);
  assert.doesNotMatch(stack, /publicAccess: true|import[^;]*(upload-)?game-files/);
  assert.match(stack, /OWNER_EMAIL: ownerEmail/);
  assert.equal(gameFilesBucket, "portal-web-preview-game-files");
  assert.ok(allowedEmails.includes(ownerEmail));
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  for (const [name, script] of Object.entries(pkg.scripts)) {
    if (name !== "upload-game-files") assert.doesNotMatch(script, /upload-game-files|game-files/, name);
    assert.doesNotMatch(name, /^(pre|post)/, `${name}: lifecycle hooks could run uploads implicitly`);
  }
  for (const file of ["build.mjs", "artifacts.mjs", "package.mjs"]) {
    assert.doesNotMatch(await readFile(new URL(`../scripts/${file}`, import.meta.url), "utf8"), /game-files|gameFiles|\bFILES\b/, file);
  }
});
