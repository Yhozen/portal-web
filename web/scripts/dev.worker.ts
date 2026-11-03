// Local development only. dev.mjs binds this to 127.0.0.1 and serves .build/objects as a stand-in R2 bucket.
// It runs the deployed gateway and asset code paths; Access is simulated with a fixed local identity.
import { gateway, serveAsset } from "../src/http.ts";
import { shell } from "../.build/shell.ts";

interface Env { OBJECTS: Fetcher }
const types: Record<string, string> = { js: "text/javascript", json: "application/json", wasm: "application/wasm" };

function diskBucket(objects: Fetcher) {
  const load = async (key: string) => {
    const response = await objects.fetch(`http://objects/${key}`);
    if (!response.ok) { await response.body?.cancel(); return null; }
    const bytes = await response.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest("MD5", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { size: bytes.byteLength, httpEtag: `"${digest}"`, bytes,
      writeHttpMetadata: (h: Headers) => h.set("Content-Type", types[key.split(".").pop()!] ?? "application/octet-stream") };
  };
  return {
    head: async (key: string) => load(key),
    get: async (key: string) => { const o = await load(key); return o && { ...o, body: new Response(o.bytes).body }; },
  } as unknown as R2Bucket;
}

export default {
  fetch(request: Request, env: Env) {
    const bucket = diskBucket(env.OBJECTS);
    return gateway(request, { ALLOWED_EMAILS: "local@localhost" }, {
      access: { getIdentity: async () => ({ email: "local@localhost" }) },
      exports: { Assets: { fetch: (incoming) => serveAsset(incoming, bucket) } },
    }, shell);
  },
};
