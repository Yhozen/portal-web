// Refuses a deploy of an engine that tools/gate.sh has not passed: the hash of ../src must be in ../.gate/passed with
// a full (checks and playthroughs) run. GATE=skip deploys anyway, and says so; use it on purpose only.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { engineHash } from "../../tools/engine-hash.mjs";

const root = join(import.meta.dirname, "..", ".."), hash = engineHash(root), file = join(root, ".gate", "passed");
const passed = existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => l.split(" ")) : [];
const hit = passed.find(([h, , kind]) => h === hash && kind === "full");
if (hit) console.log(`gate: engine ${hash.slice(0, 12)} passed the checks and playthroughs on ${hit[1]}`);
else if (process.env.GATE === "skip") console.warn(`gate: SKIPPED for engine ${hash.slice(0, 12)} (GATE=skip); it has not passed tools/gate.sh`);
else {
  console.error(`gate: engine ${hash.slice(0, 12)} has not passed tools/gate.sh (checks and playthroughs); run it first, or deploy with GATE=skip on purpose`);
  process.exit(1);
}
