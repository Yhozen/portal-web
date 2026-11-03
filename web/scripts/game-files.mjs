// Shared by upload-game-files.mjs (owner's Mac -> private R2 bucket) and the local dev emulation.
// Selection is exactly the browser picker's (src/localfs.ts): only the files the engine reads.
import { createHash } from "node:crypto";
import { createReadStream, openAsBlob } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { selectImport, validateImport } from "../../src/localfs.ts";

export const MANIFEST_KEY = "manifest.json";
export const objectKey = (rel) => `files/${rel}`;

async function walk(root, dir = root, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(root, path, out);
    else if (entry.isFile()) {
      const { size } = await stat(path);
      out.push({ path: relative(root, path).split(sep).join("/"), size, file: path,
        open: async () => new File([await openAsBlob(path)], entry.name) });
    }
  }
  return out;
}

// Returns [{ rel, size, file }] for a Portal install folder (or a folder above it), or throws.
export async function selectGameFiles(from) {
  const raw = await walk(from);
  const chosen = selectImport(raw);
  const problems = await validateImport(chosen);
  if (problems.length) throw new Error(`${from} does not look like a Portal install:\n  ${problems.join("\n  ")}`);
  const fileOf = new Map(raw.map((r) => [r.open, r.file])); // selectImport keeps each entry's open()
  return chosen.map((c) => ({ rel: c.rel, size: c.size, file: fileOf.get(c.open) }));
}

export function md5(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("md5");
    createReadStream(file).on("data", (d) => h.update(d)).on("error", reject).on("end", () => resolve(h.digest("hex")));
  });
}

// target: { list(): Map<key, { size, etag }>, put(key, file, size, contentType), putJson(key, value), delete(key) }
export async function syncGameFiles(target, files, { prune = false, dryRun = false, concurrency = 4, log = console.log } = {}) {
  const existing = await target.list();
  const todo = [];
  for (const f of files) {
    const have = existing.get(objectKey(f.rel));
    f.md5 = await md5(f.file);
    if (have && have.size === f.size && have.etag === f.md5) continue;
    todo.push(f);
  }
  const wanted = new Set(files.map((f) => objectKey(f.rel)));
  const stale = [...existing.keys()].filter((k) => k.startsWith("files/") && !wanted.has(k));
  const total = files.reduce((s, f) => s + f.size, 0), need = todo.reduce((s, f) => s + f.size, 0);
  log(`${files.length} files (${(total / 1e9).toFixed(2)} GB) selected; ${files.length - todo.length} already uploaded, ` +
    `${todo.length} to upload (${(need / 1e9).toFixed(2)} GB)` + (stale.length ? `; ${stale.length} stale${prune ? " to delete" : " (kept; --prune deletes)"}` : ""));
  const manifest = { format: 1, files: Object.fromEntries(files.map((f) => [f.rel, f.size])), total, uploadedAt: new Date().toISOString() };
  if (dryRun) return { uploaded: 0, skipped: files.length - todo.length, pending: todo.length, manifest };
  // Until the new manifest is written the copy counts as unavailable (the engine falls back to the picker).
  if (todo.length || (prune && stale.length) || !existing.has(MANIFEST_KEY)) await target.delete(MANIFEST_KEY);
  let done = 0, sent = 0;
  const queue = [...todo];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let f; (f = queue.shift());) {
      await target.put(objectKey(f.rel), f.file, f.size, "application/octet-stream", f.md5);
      done++; sent += f.size;
      log(`  [${done}/${todo.length}] ${f.rel} (${(f.size / 1e6).toFixed(1)} MB; ${(sent / 1e9).toFixed(2)}/${(need / 1e9).toFixed(2)} GB)`);
    }
  }));
  if (prune) for (const k of stale) await target.delete(k);
  // Verify every selected object (size + MD5 ETag) before publishing the manifest.
  const after = await target.list();
  const bad = files.filter((f) => { const o = after.get(objectKey(f.rel)); return !o || o.size !== f.size || o.etag !== f.md5; });
  if (bad.length) throw new Error(`Upload verification failed (manifest not written) for:\n  ${bad.map((f) => f.rel).join("\n  ")}`);
  await target.putJson(MANIFEST_KEY, manifest);
  return { uploaded: todo.length, skipped: files.length - todo.length, manifest };
}

// Cloudflare R2 REST API (same credentials and request helper as the engine upload).
export function restTarget(request, bucket) {
  const path = (key) => `r2/buckets/${encodeURIComponent(bucket)}/objects/${key.split("/").map(encodeURIComponent).join("/")}`;
  return {
    async list() {
      const out = new Map();
      for (const prefix of ["files/", MANIFEST_KEY]) {
        let cursor = "";
        for (;;) {
          const r = await (await request(`r2/buckets/${encodeURIComponent(bucket)}/objects?prefix=${encodeURIComponent(prefix)}&per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`)).json();
          for (const o of r.result ?? []) out.set(o.key, { size: o.size, etag: String(o.etag).replaceAll('"', "") });
          cursor = r.result_info?.cursor; if (!cursor || r.result_info?.is_truncated === false) break;
        }
      }
      return out;
    },
    async put(key, file, size, contentType) {
      const { Readable } = await import("node:stream");
      const res = await request(path(key), { method: "PUT", duplex: "half", body: Readable.toWeb(createReadStream(file)),
        headers: { "Content-Type": contentType, "Content-Length": String(size), "Cache-Control": "private, max-age=86400" } });
      await res.arrayBuffer();
    },
    async putJson(key, value) {
      const text = JSON.stringify(value);
      await (await request(path(key), { method: "PUT", body: text, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } })).arrayBuffer();
    },
    async delete(key) {
      try { await (await request(path(key), { method: "DELETE" })).arrayBuffer(); }
      catch (e) { if (!/404|not.?found|NoSuchKey/i.test(String(e?.message))) throw e; }
    },
  };
}

// A Workers R2Bucket binding (miniflare locally).
export function bindingTarget(bucket) {
  return {
    async list() {
      const out = new Map();
      let cursor;
      do {
        const r = await bucket.list({ cursor, limit: 1000 });
        for (const o of r.objects) out.set(o.key, { size: o.size, etag: o.etag });
        cursor = r.truncated ? r.cursor : undefined;
      } while (cursor);
      return out;
    },
    async put(key, file, size, contentType) {
      const { readFile } = await import("node:fs/promises");
      await bucket.put(key, await readFile(file), { httpMetadata: { contentType } });
    },
    async putJson(key, value) { await bucket.put(key, JSON.stringify(value), { httpMetadata: { contentType: "application/json" } }); },
    async delete(key) { await bucket.delete(key); },
  };
}

// Any S3-compatible endpoint (R2: https://<account>.r2.cloudflarestorage.com, region "auto"), path-style
// {endpoint}/{bucket}/{key}. `signedFetch(url, init)` signs with SigV4 (aws4fetch's AwsClient.fetch);
// bodies are streamed with UNSIGNED-PAYLOAD, so each attempt re-opens the file. Single-part PUTs keep
// the ETag equal to the MD5, which is what the skip-unchanged check compares (R2 allows up to 5 GB).
export function s3Target(signedFetch, endpoint, bucket, { retries = 4, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const base = `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}`;
  const url = (key) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const unxml = (s) => s.replace(/&(lt|gt|quot|apos|amp|#(\d+)|#x([0-9a-f]+));/gi, (m, n, d, h) =>
    d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[n.toLowerCase()]);
  async function call(what, make, ok = (s) => s >= 200 && s < 300) {
    for (let attempt = 0; ; attempt++) {
      let res, err;
      try { res = await signedFetch(...make()); } catch (e) { err = e; }
      if (res && ok(res.status)) return res;
      const body = res ? await res.text().catch(() => "") : "";
      const code = /<Code>([^<]*)<\/Code>/.exec(body)?.[1];
      // Auth and client errors will not fix themselves (e.g. AccessDenied: token for another bucket or read-only).
      const permanent = res && res.status < 500 && res.status !== 429;
      if (permanent || attempt >= retries) {
        throw new Error(`S3 ${what} failed: ${res ? `HTTP ${res.status}${code ? ` ${code}` : ""}` : String(err?.message ?? err)}`);
      }
      await wait(1000 * 2 ** attempt);
    }
  }
  return {
    async list() {
      const out = new Map();
      let token = "";
      for (;;) {
        const res = await call("list", () => [`${base}?list-type=2&max-keys=1000${token ? `&continuation-token=${encodeURIComponent(token)}` : ""}`]);
        const xml = await res.text();
        for (const [, c] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const tag = (t) => unxml(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(c)?.[1] ?? "");
          out.set(tag("Key"), { size: Number(tag("Size")), etag: tag("ETag").replaceAll('"', "") });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml(/<NextContinuationToken>([^<]*)</.exec(xml)?.[1] ?? "") : "";
        if (!token) break;
      }
      return out;
    },
    async put(key, file, size, contentType, contentMd5) {
      const { Readable } = await import("node:stream");
      const headers = { "Content-Type": contentType, "Content-Length": String(size), "Cache-Control": "private, max-age=86400",
        "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD" };
      if (contentMd5) headers["Content-MD5"] = Buffer.from(contentMd5, "hex").toString("base64"); // server rejects corrupted bodies
      await (await call(`PUT ${key}`, () => [url(key), { method: "PUT", duplex: "half", headers,
        body: Readable.toWeb(createReadStream(file)) }])).arrayBuffer();
    },
    async putJson(key, value) {
      const text = JSON.stringify(value);
      await (await call(`PUT ${key}`, () => [url(key), { method: "PUT", body: text,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } }])).arrayBuffer();
    },
    async delete(key) {
      await (await call(`DELETE ${key}`, () => [url(key), { method: "DELETE" }], (s) => (s >= 200 && s < 300) || s === 404)).arrayBuffer();
    },
  };
}

// Reads R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (values are never printed).
export async function s3TargetFromEnv(bucket, env = process.env) {
  const missing = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter((k) => !env[k]);
  if (missing.length) throw new Error(`--s3 needs ${missing.join(", ")} in the environment`);
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3", region: "auto", retries: 0 });
  return s3Target((u, init) => client.fetch(u, init), env.R2_ENDPOINT, bucket);
}
