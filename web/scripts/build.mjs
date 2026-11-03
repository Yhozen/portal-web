// Bundles the engine (../src) into dist/portal-engine.js and packages the release. Game files are not read.
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageRelease } from "./artifacts.mjs";
import { assertBundleInputs } from "./guard.mjs";

const web = fileURLToPath(new URL("..", import.meta.url)), repo = resolve(web, "..");
await mkdir(resolve(web, "dist"), { recursive: true });
const result = await build({
  entryPoints: [resolve(repo, "src/main.ts")], bundle: true, format: "iife", target: "es2022",
  minify: true, legalComments: "none", metafile: true, logLevel: "warning",
  outfile: resolve(web, "dist/portal-engine.js"), absWorkingDir: repo,
});
assertBundleInputs(result.metafile, resolve(repo, "src"));
const release = await packageRelease(web);
console.log(`Ready to review: release ${release.id} (${release.assets.engine.size} bytes of engine, no game data)`);
