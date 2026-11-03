// Local R2 emulation (miniflare) for `pnpm dev`: BUCKET (engine) and FILES (owner's game files).
// Persisted under web/.dev-r2/ (gitignored, local only).
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";

export const DEV_R2 = fileURLToPath(new URL("../.dev-r2/", import.meta.url));
export async function openDevR2(options = {}) {
  const mf = new Miniflare({
    modules: true, script: "export default { fetch() { return new Response(null, { status: 404 }); } }",
    compatibilityDate: "2026-07-01", r2Buckets: ["BUCKET", "FILES"], r2Persist: DEV_R2, ...options,
  });
  await mf.ready;
  return mf;
}
