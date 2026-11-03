import { fileURLToPath } from "node:url";
import { packageRelease } from "./artifacts.mjs";

const release = await packageRelease(fileURLToPath(new URL("..", import.meta.url)));
console.log(`Packaged release ${release.id}`);
