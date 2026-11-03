export const YEAR = 31536000;
// The only R2 objects the Worker will ever serve: content-addressed engine bundles.
export const assetPath = /^\/assets\/[a-f0-9]{64}\/portal-engine\.js$/;
export type Shell = Readonly<Record<string, { readonly body: string; readonly contentType: string }>>;

export function failure(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "no-store" } });
}

export async function serveAsset(request: Request, bucket: R2Bucket): Promise<Response> {
  const url = new URL(request.url);
  if (!assetPath.test(url.pathname) || url.search) return failure("Not found", 404);
  if (request.method !== "GET" && request.method !== "HEAD") return failure("Method not allowed", 405);
  try {
    const key = url.pathname.slice(1);
    const object = request.method === "HEAD" ? await bucket.head(key) : await bucket.get(key);
    if (!object) return failure("Not found", 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Content-Length", String(object.size));
    headers.set("Cache-Control", `public, max-age=${YEAR}, immutable`);
    headers.set("X-Content-Type-Options", "nosniff");
    const body = "body" in object ? (object as R2ObjectBody).body : null;
    if (request.headers.get("If-None-Match")?.split(",").map((v) => v.trim()).includes(object.httpEtag)) {
      await body?.cancel();
      headers.delete("Content-Length");
      return new Response(null, { status: 304, headers });
    }
    return new Response(body, { headers });
  } catch { return failure("Asset storage unavailable", 502); }
}

// ---- the owner's private game files (/files/) ----------------------------------------------------------
// Bucket layout (written only by scripts/upload-game-files.mjs from the owner's own install):
//   manifest.json            { format: 1, files: { "<install-root path>": size }, total, uploadedAt }
//   files/<install-root path>  e.g. files/portal/portal_pak_000.vpk
// Served straight from R2 by the uncached default entrypoint: never through the shared Workers Cache.
export const MANIFEST_KEY = "manifest.json";
const filesPath = /^\/files\/((?:portal|hl2)\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*)$/;
export const gameFileHeaders = {
  // Per-user browser cache only: no shared/CDN caching, revalidated by ETag, keyed by the Access cookie.
  "Cache-Control": "private, max-age=86400", "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin", "Referrer-Policy": "no-referrer",
};

export function fileKey(pathname: string): string | null {
  if (pathname === `/files/${MANIFEST_KEY}`) return MANIFEST_KEY;
  const m = filesPath.exec(pathname);
  if (!m || m[1].split("/").some((part) => part === "." || part === "..")) return null;
  return `files/${m[1]}`;
}

// Single byte range (what the engine sends). Returns null for "serve the whole file", or "invalid" for 416.
export function parseRange(header: string | null, size: number): { offset: number; length: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return "invalid";
  let start: number, end: number;
  if (!m[1]) { const n = Number(m[2]); if (n === 0) return "invalid"; start = Math.max(0, size - n); end = size - 1; }
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return "invalid";
  return { offset: start, length: end - start + 1 };
}

export async function serveGameFile(request: Request, bucket: R2Bucket | undefined): Promise<Response> {
  const url = new URL(request.url), key = fileKey(url.pathname);
  if (!key || url.search) return failure("Not found", 404);
  if (!bucket) return failure("Not found", 404);
  try {
    const head = await bucket.head(key);
    if (!head) return failure("Not found", 404);
    const headers = new Headers(gameFileHeaders);
    headers.set("ETag", head.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Type", key === MANIFEST_KEY ? "application/json" : "application/octet-stream");
    if (key === MANIFEST_KEY) headers.set("Cache-Control", "private, no-store");
    if (request.headers.get("If-None-Match")?.split(",").map((v) => v.trim()).includes(head.httpEtag)) {
      return new Response(null, { status: 304, headers });
    }
    const ifRange = request.headers.get("If-Range");
    const range = ifRange && ifRange !== head.httpEtag ? null : parseRange(request.headers.get("Range"), head.size);
    if (range === "invalid") {
      headers.set("Content-Range", `bytes */${head.size}`);
      return new Response(null, { status: 416, headers });
    }
    const length = range ? range.length : head.size;
    headers.set("Content-Length", String(length));
    if (range) headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
    if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
    const object = await bucket.get(key, range ? { range, onlyIf: { etagMatches: head.etag } } : { onlyIf: { etagMatches: head.etag } });
    if (!object || !("body" in object)) return failure("File changed during the request; retry", 503);
    return new Response((object as R2ObjectBody).body, { status: range ? 206 : 200, headers });
  } catch { return failure("File storage unavailable", 502); }
}

export interface GatewayEnv {
  ALLOWED_EMAILS: string;
  // The one identity allowed to read /files/ (the owner of the uploaded copy). Unset: /files/ is closed.
  OWNER_EMAIL?: string;
  FILES?: R2Bucket;
}
export interface GatewayContext {
  access?: { getIdentity(): Promise<{ email?: string } | undefined> };
  exports: { Assets: { fetch(request: Request): Promise<Response> } };
}

export async function gateway(request: Request, env: GatewayEnv, ctx: GatewayContext, shell: Shell): Promise<Response> {
  // The platform-populated Access context cannot be forged by supplying HTTP headers.
  let email: string;
  try {
    const identity = await ctx.access?.getIdentity();
    const allowed = env.ALLOWED_EMAILS.split(",").map((email) => email.trim().toLowerCase());
    if (!identity?.email || !allowed.includes(identity.email.toLowerCase())) {
      return failure("Access required", 403);
    }
    email = identity.email.trim().toLowerCase();
  } catch { return failure("Could not verify access", 503); }
  if (request.method !== "GET" && request.method !== "HEAD") return failure("Method not allowed", 405);
  if (new URL(request.url).pathname.startsWith("/files/")) {
    // Owner only: other allowlisted players get the engine but must use their own files (picker).
    const owner = env.OWNER_EMAIL?.trim().toLowerCase();
    if (!owner || email !== owner) return failure("These files are private to their owner", 403);
    return serveGameFile(request, env.FILES);
  }
  try { return await route(request, ctx, shell); } catch { return failure("Content unavailable", 502); }
}

// Game files come from the player's own disk (OPFS) or, for the owner only, from /files/ above. The shell
// sets security headers suitable for that: no framing, no referrer, no cross-origin fetches by default.
export const shellHeaders = {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

async function route(request: Request, ctx: GatewayContext, shell: Shell): Promise<Response> {
  const url = new URL(request.url);
  if (assetPath.test(url.pathname) && !url.search) {
    // Authentication has completed. Only content identity participates in the internal cache key.
    const headers = new Headers();
    for (const name of ["Range", "If-None-Match"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const response = await ctx.exports.Assets.fetch(new Request(`https://assets.internal${url.pathname}`,
      { method: request.method, headers }));
    const outgoing = new Headers(response.headers);
    outgoing.set("X-Portal-Asset-Cache", response.headers.get("Cf-Cache-Status") ?? "UNKNOWN");
    outgoing.set("Cache-Control", response.ok || response.status === 304
      ? `private, max-age=${YEAR}, immutable` : "no-store");
    return new Response(response.body, { status: response.status, headers: outgoing });
  }
  const page = shell[url.pathname === "/" ? "/index.html" : url.pathname];
  if (!page) return failure("Not found", 404);
  return new Response(request.method === "HEAD" ? null : page.body, { headers: {
    ...shellHeaders,
    "Content-Type": `${page.contentType}; charset=utf-8`,
    "Content-Length": String(new TextEncoder().encode(page.body).byteLength),
  } });
}
