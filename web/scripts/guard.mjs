// Fails the build/deploy if anything other than the clean-room engine is about to be uploaded or bundled.
// Valve's files (VPK, BSP, VTF, VMT, MDL, sounds, captions, ...) stay on the player's own disk.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_EXTENSIONS = new Set([".js", ".mjs", ".html", ".css", ".json", ".wasm", ".glsl", ".vert", ".frag"]);
export const VALVE_EXTENSIONS = new Set([".vpk", ".bsp", ".vtf", ".vmt", ".mdl", ".vvd", ".vtx", ".phy", ".ani",
  ".wav", ".mp3", ".ogg", ".vcd", ".image", ".dat", ".txt", ".res", ".cfg", ".pcf", ".nav", ".ain", ".lmp", ".bik",
  ".cache", ".zip", ".pak", ".gcf", ".ncf", ".dem", ".sav", ".ttf", ".vfont", ".vbsp", ".raw"]);
export const STEAM_PATH = /steamapps|(^|[\\/])\.steam([\\/]|$)|[\\/]steam[\\/]|application support[\\/]steam|[\\/]common[\\/]portal([\\/]|$)|portal_pak|hl2_(textures|misc|sound)/i;
// Leading bytes of Valve/game formats (and archives that could smuggle them).
const MAGIC = [
  [[0x34, 0x12, 0xaa, 0x55], "VPK"], [[0x56, 0x42, 0x53, 0x50], "BSP"], [[0x56, 0x54, 0x46, 0x00], "VTF"],
  [[0x49, 0x44, 0x53, 0x54], "MDL"], [[0x49, 0x44, 0x53, 0x56], "VVD"], [[0x52, 0x49, 0x46, 0x46], "RIFF/WAV"],
  [[0x49, 0x44, 0x33], "MP3"], [[0xff, 0xfb], "MP3"], [[0x50, 0x4b, 0x03, 0x04], "ZIP"], [[0x4c, 0x5a, 0x4d, 0x41], "LZMA"],
  [[0x4f, 0x67, 0x67, 0x53], "OGG"], [[0x1f, 0x8b], "GZIP"],
];
export const MAX_FILE = 10_000_000; // the engine bundle is well under 1 MB; anything large is suspicious

export function checkName(name) {
  const ext = extname(name).toLowerCase();
  if (VALVE_EXTENSIONS.has(ext)) return `${name}: game file type ${ext} must never be uploaded`;
  if (!ALLOWED_EXTENSIONS.has(ext)) return `${name}: ${ext || "extensionless"} files are not part of the engine build`;
  if (STEAM_PATH.test(name)) return `${name}: looks like a Steam install path`;
  return null;
}

export function checkBytes(name, bytes) {
  if (bytes.length > MAX_FILE) return `${name}: ${bytes.length} bytes is larger than any engine file should be`;
  for (const [magic, label] of MAGIC) if (magic.every((b, i) => bytes[i] === b)) return `${name}: contents look like ${label} data`;
  return null;
}

// files: [{ key, path }] (upload set) plus any extra local paths that will be bundled into the Worker.
export async function assertEngineOnly(files) {
  const problems = [];
  for (const file of files) {
    const named = [file.key, file.path].filter(Boolean).map(checkName).filter(Boolean);
    problems.push(...named);
    // Contents are only inspected for files that already passed the name checks (never open a Steam path).
    if (file.path && !named.length) { const p = checkBytes(file.key ?? file.path, await readFile(file.path)); if (p) problems.push(p); }
    if (file.contentType && !/^(text\/(javascript|html|css)|application\/(json|wasm))$/.test(file.contentType)) {
      problems.push(`${file.key}: unexpected content type ${file.contentType}`);
    }
  }
  if (problems.length) throw new Error("Refusing to publish non-engine files:\n  " + [...new Set(problems)].join("\n  "));
}

// esbuild metafile inputs: only the repository's own TypeScript sources may enter the bundle.
export function assertBundleInputs(metafile, srcDir, workingDir = resolve(srcDir, "..")) {
  const bad = Object.keys(metafile.inputs).filter((input) => {
    const abs = resolve(workingDir, input);
    return !abs.startsWith(resolve(srcDir) + "/") || extname(abs) !== ".ts" || STEAM_PATH.test(abs);
  });
  if (bad.length) throw new Error("Engine bundle may only contain src/*.ts, found:\n  " + bad.join("\n  "));
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path)); else out.push(path);
  }
  return out;
}

// Everything under .build/ that ships: R2 objects, the Worker shell, and the upload manifest's entries.
export async function guardBuild(webRoot) {
  const build = join(webRoot, ".build");
  const upload = JSON.parse(await readFile(join(build, "upload.json"), "utf8"));
  const files = [...upload.files];
  for (const path of [...await walk(join(build, "objects")), ...await walk(join(build, "site"))]) {
    files.push({ key: relative(build, path), path });
  }
  for (const file of upload.files) {
    if (!(await stat(file.path)).isFile()) throw new Error(`${file.key}: missing build artifact`);
    if (!resolve(file.path).startsWith(resolve(build, "objects") + "/")) throw new Error(`${file.key}: uploads must come from .build/objects`);
  }
  await assertEngineOnly(files);
  return files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await guardBuild(fileURLToPath(new URL("..", import.meta.url)));
  console.log(`Guard: ${count} files checked, engine only`);
}
