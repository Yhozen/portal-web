// Runs the Worker locally in miniflare on 127.0.0.1 (no Cloudflare account needed): pnpm build && pnpm dev
// R2 is emulated (web/.dev-r2/): BUCKET is seeded from .build/objects; FILES holds the owner's game files
// only if you seeded it yourself with `pnpm upload-game-files --local --from <your Portal install>`.
// Access is simulated: requests act as the owner unless they send X-Dev-Access-Email (dev only).
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { build } from "rolldown";
import { allowedEmails, ownerEmail } from "./config.mjs";
import { openDevR2 } from "./dev-r2.mjs";

const { values } = parseArgs({ options: { port: { type: "string", default: process.env.PORTAL_WEB_PORT ?? "8430" } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("Choose a TCP port between 1 and 65535");
const out = fileURLToPath(new URL("../.build/dev/worker.mjs", import.meta.url));
await build({ input: fileURLToPath(new URL("./dev.worker.ts", import.meta.url)),
  external: ["cloudflare:workers"], output: { format: "esm", file: out } });

const mf = await openDevR2({ script: undefined, scriptPath: out, host: "127.0.0.1", port,
  bindings: { ALLOWED_EMAILS: [...allowedEmails, "friend@localhost"].join(","), OWNER_EMAIL: ownerEmail } });
const engine = await mf.getR2Bucket("BUCKET");
const objects = fileURLToPath(new URL("../.build/objects/", import.meta.url));
const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((e) =>
  e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))).flat();
for (const path of await walk(objects)) {
  await engine.put(relative(objects, path), await readFile(path), { httpMetadata: { contentType: "text/javascript" } });
}
const files = await (await mf.getR2Bucket("FILES")).head("manifest.json");
console.log(`Portal (local Worker): ${await mf.ready} (local only; Access simulated as ${ownerEmail})`);
console.log(files ? "Owner game files: seeded (local emulation)" : "Owner game files: none (players use the picker)");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => mf.dispose().then(() => process.exit(0)));
