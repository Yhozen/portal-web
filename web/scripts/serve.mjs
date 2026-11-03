// Plain static preview of .build (no Worker, no Access): pnpm build && pnpm serve
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { assetPath, shellHeaders } from "../src/http.ts";
import { SHELL_FILES } from "./artifacts.mjs";

const root = fileURLToPath(new URL("../.build", import.meta.url));
const port = Number(process.env.PORTAL_WEB_PORT ?? 8431);
const types = Object.fromEntries(SHELL_FILES.map(([name, type]) => [name.split(".").pop(), type]));
createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const asset = assetPath.test(path);
  const name = path === "/" ? "index.html" : path.slice(1);
  if (!asset && !SHELL_FILES.some(([file]) => file === name)) { response.writeHead(404); response.end(); return; }
  try {
    const file = resolve(root, asset ? "objects" : "site", name);
    const info = await stat(file);
    response.writeHead(200, { ...shellHeaders, "Content-Type": types[name.split(".").pop()], "Content-Length": info.size,
      "Cache-Control": asset ? "private, max-age=31536000, immutable" : "no-store" });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch { response.writeHead(404); response.end(); }
}).listen(port, "127.0.0.1", () => console.log(`Portal: http://127.0.0.1:${port} (static, local only; no Access login)`));
