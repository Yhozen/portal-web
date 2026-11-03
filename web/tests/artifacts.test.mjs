import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { packageRelease, uploadAssets } from "../scripts/artifacts.mjs";
import { assertEngineOnly, assertBundleInputs, guardBuild, checkName } from "../scripts/guard.mjs";
import { validateRelease } from "../release.js";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "portal-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "dist"));
  for (const file of ["index.html", "loader.js", "release.js"]) await writeFile(join(root, file), "fixture");
  await writeFile(join(root, "dist/portal-engine.js"), "(()=>{})();");
  return { root };
}

test("content-addressed engine release: stable across rebuilds, changes with code, validates", async (t) => {
  const { root } = await fixture(t);
  const initial = validateRelease(await packageRelease(root));
  assert.deepEqual(await packageRelease(root), initial);
  assert.match(initial.assets.engine.integrity, /^sha256-[A-Za-z0-9+/]{43}=$/);
  await writeFile(join(root, "dist/portal-engine.js"), "(()=>1)();");
  const code = await packageRelease(root);
  assert.notEqual(code.id, initial.id);
  assert.notEqual(code.assets.engine.url, initial.assets.engine.url);
  assert.throws(() => validateRelease({ ...code, assets: { ...code.assets, engine: { ...code.assets.engine, url: "https://elsewhere.test/x.js" } } }));
  assert.throws(() => validateRelease({ ...code, assets: { ...code.assets, data: code.assets.engine } }), /Unexpected assets/);
  assert.throws(() => validateRelease({ ...code, assets: { engine: { ...code.assets.engine, integrity: "sha256-AAAA" } } }));
  const { files } = JSON.parse(await readFile(join(root, ".build/upload.json")));
  assert.deepEqual(files.map((f) => f.key), [code.assets.engine.url.slice(1)]);
});

test("packaging bundles the shell and matching manifest as importable Worker code", async (t) => {
  const { root } = await fixture(t);
  const html = '<!doctype html><title>Portal ✓</title><script type="module" src="loader.js"></script>';
  await writeFile(join(root, "index.html"), html);
  const release = await packageRelease(root);
  const code = await readFile(join(root, ".build/shell.ts"));
  const { shell } = await import(`data:text/javascript;base64,${code.toString("base64")}`);
  assert.deepEqual(Object.keys(shell).sort(), ["/index.html", "/loader.js", "/release.js", "/release.json"]);
  assert.equal(shell["/index.html"].body, html);
  assert.deepEqual(validateRelease(JSON.parse(shell["/release.json"].body)), release);
});

test("guard: Valve file types, Steam paths and game-file contents can never be published", async (t) => {
  const { root } = await fixture(t);
  for (const name of ["portal/portal_pak_dir.vpk", "maps/testchmb_a_00.bsp", "materials/x.vtf", "materials/x.vmt",
    "models/x.mdl", "x.vvd", "x.dx90.vtx", "sound/x.wav", "x.mp3", "resource/closecaption_english.dat",
    "resource/portal_english.txt", "scenes/scenes.image", "README"]) {
    assert.ok(checkName(`assets/${"a".repeat(64)}/${name.split("/").pop()}`) || checkName(name), name);
    await assert.rejects(assertEngineOnly([{ key: name }]), /Refusing/, name);
  }
  for (const path of ["/home/u/.steam/debian-installation/steamapps/common/Portal/x.js",
    "/Users/g/Library/Application Support/Steam/steamapps/common/Portal/a.js", "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Portal\\a.js"]) {
    await assert.rejects(assertEngineOnly([{ key: "assets/x/portal-engine.js", path }]), /Steam install path/, path);
  }
  // A game file renamed to .js is caught by its contents.
  for (const [label, bytes] of [["VPK", [0x34, 0x12, 0xaa, 0x55, 2, 0, 0, 0]], ["BSP", [...Buffer.from("VBSP")]], ["VTF", [...Buffer.from("VTF\0")]],
    ["MDL", [...Buffer.from("IDST")]], ["RIFF/WAV", [...Buffer.from("RIFF")]], ["ZIP", [0x50, 0x4b, 3, 4]]]) {
    await writeFile(join(root, "dist/portal-engine.js"), Buffer.from(bytes));
    await assert.rejects(packageRelease(root), new RegExp(label.replace("/", "\\/")));
  }
  await writeFile(join(root, "dist/portal-engine.js"), Buffer.alloc(10_000_001, 32));
  await assert.rejects(packageRelease(root), /larger than any engine file/);
  // Something slipped into .build/objects after packaging fails the pre-deploy guard.
  await writeFile(join(root, "dist/portal-engine.js"), "(()=>{})();");
  await packageRelease(root);
  await copyFile(join(root, "dist/portal-engine.js"), join(root, ".build/objects/assets/testchmb_a_00.bsp"));
  await assert.rejects(guardBuild(root), /game file type \.bsp/);
  assert.throws(() => assertBundleInputs({ inputs: { "src/main.ts": {}, "../Steam/steamapps/common/Portal/x.ts": {} } }, join(root, "src"), root), /only contain src/);
  assert.throws(() => assertBundleInputs({ inputs: { "src/main.ts": {}, "src/data.bsp": {} } }, join(root, "src"), root), /only contain src/);
  assert.doesNotThrow(() => assertBundleInputs({ inputs: { "src/main.ts": {} } }, join(root, "src"), root));
});

test("the real build ships only the engine and the shell", async () => {
  const web = new URL("..", import.meta.url).pathname;
  const { files } = JSON.parse(await readFile(join(web, ".build/upload.json"), "utf8").catch(() => { throw new Error("run pnpm build first"); }));
  assert.equal(files.length, 1);
  assert.match(files[0].key, /^assets\/[a-f0-9]{64}\/portal-engine\.js$/);
  assert.ok(files[0].size < 2_000_000);
  assert.ok(await guardBuild(web) >= 1);
});

function fakeR2() {
  const objects = new Map();
  let puts = 0;
  const request = async (path, init = {}) => {
    const url = new URL(path, "https://example.test");
    if (url.searchParams.has("prefix")) {
      const prefix = url.searchParams.get("prefix");
      return Response.json({ result: [...objects.values()].filter((o) => o.key.startsWith(prefix)) });
    }
    const key = decodeURIComponent(url.pathname.split("/objects/")[1]);
    if (init.method === "PUT") {
      const bytes = Buffer.from(await new Response(init.body).arrayBuffer());
      objects.set(key, { key, bytes, size: bytes.length,
        etag: createHash("md5").update(bytes).digest("hex"), http_metadata: { contentType: init.headers["Content-Type"] } });
      puts++;
      return Response.json({ success: true });
    }
    return new Response(objects.get(key).bytes);
  };
  return { objects, request, puts: () => puts };
}

test("immutable uploads are verified and reused; corruption, changed build files and game files fail closed", async (t) => {
  const { root } = await fixture(t);
  await packageRelease(root);
  const { files } = JSON.parse(await readFile(join(root, ".build/upload.json")));
  const r2 = fakeR2();
  await uploadAssets(r2.request, "bucket", files);
  assert.equal(r2.puts(), 1);
  await uploadAssets(r2.request, "bucket", files);
  assert.equal(r2.puts(), 1);
  r2.objects.get(files[0].key).etag = "wrong";
  await assert.rejects(uploadAssets(r2.request, "bucket", files), /Immutable object/);
  r2.objects.get(files[0].key).etag = files[0].md5;
  await writeFile(files[0].path, "tampered");
  await assert.rejects(uploadAssets(r2.request, "bucket", files), /artifact changed/);
  await assert.rejects(uploadAssets(r2.request, "bucket", [{ ...files[0], key: "maps/testchmb_a_00.bsp" }]), /Refusing/);
  assert.equal(r2.puts(), 1);
});
