// Runs the Worker locally in workerd on 127.0.0.1 (no Cloudflare account needed): pnpm build && pnpm dev
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { build } from "rolldown";

const { default: workerd, compatibilityDate } = createRequire(import.meta.url)("workerd");
const { values } = parseArgs({ options: { port: { type: "string", default: process.env.PORTAL_WEB_PORT ?? "8430" } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("Choose a TCP port between 1 and 65535");
const directory = new URL("../.build/dev/", import.meta.url);
await mkdir(directory, { recursive: true });
await build({ input: fileURLToPath(new URL("./dev.worker.ts", import.meta.url)),
  external: ["cloudflare:workers"], output: { format: "esm", file: fileURLToPath(new URL("worker.mjs", directory)) } });
const config = new URL("config.capnp", directory);
await writeFile(config, `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "main", worker = (
      modules = [(name = "worker.mjs", esModule = embed "worker.mjs")],
      compatibilityDate = "${compatibilityDate}",
      bindings = [(name = "OBJECTS", service = "objects")]
    )),
    (name = "objects", disk = (path = ${JSON.stringify(fileURLToPath(new URL("../objects", directory)))}, writable = false))
  ],
  sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")]
);`);
const child = spawn(workerd, ["serve", fileURLToPath(config)], { stdio: "inherit" });
console.log(`Portal (local Worker): http://127.0.0.1:${port}/ (local only; Access simulated)`);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill());
child.once("exit", (code) => process.exit(code ?? 0));
