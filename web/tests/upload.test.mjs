// upload-game-files sync logic and the repository guard, on made-up files in a temp folder.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { selectGameFiles, syncGameFiles } from "../scripts/game-files.mjs";
import { assertRepoClean } from "../scripts/guard.mjs";
import { vpkDir } from "./fixtures/vpk.mjs";

function fakeInstall(t) {
  const root = mkdtempSync(join(tmpdir(), "portal-upload-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (rel, bytes) => { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, bytes); };
  const base = "steamapps/common/Portal/";
  put(base + "portal/portal_pak_dir.vpk", vpkDir([{ path: "materials/a.vmt", archive: 0, offset: 0, length: 2 }]));
  put(base + "portal/portal_pak_000.vpk", Buffer.from("ab"));
  put(base + "hl2/hl2_textures_dir.vpk", vpkDir([], { embedded: true }));
  put(base + "hl2/hl2_misc_dir.vpk", vpkDir([], { embedded: true }));
  put(base + "portal/maps/testchmb_a_00.bsp", Buffer.from("map"));
  put(base + "portal/bin/server.so", Buffer.from("not needed"));
  put(base + "portal/cfg/config.cfg", Buffer.from("not needed"));
  return { root, put: (rel, bytes) => put(base + rel, bytes) };
}

function memoryTarget() {
  const objects = new Map(), log = [];
  const md5 = (b) => createHash("md5").update(b).digest("hex");
  return { objects, log, corrupt: null,
    async list() { return new Map([...objects].map(([k, v]) => [k, { size: v.length, etag: md5(v) }])); },
    async put(key, file) { log.push(["put", key]); const { readFileSync } = await import("node:fs"); objects.set(key, this.corrupt === key ? Buffer.from("x") : readFileSync(file)); },
    async putJson(key, value) { log.push(["put", key]); objects.set(key, Buffer.from(JSON.stringify(value))); },
    async delete(key) { log.push(["delete", key]); objects.delete(key); } };
}

test("uploads only the engine's selection, resumes, writes the manifest last and verifies before publishing", async (t) => {
  const install = fakeInstall(t);
  const files = await selectGameFiles(install.root);
  assert.deepEqual(files.map((f) => f.rel), ["hl2/hl2_misc_dir.vpk", "hl2/hl2_textures_dir.vpk", "portal/maps/testchmb_a_00.bsp",
    "portal/portal_pak_000.vpk", "portal/portal_pak_dir.vpk"]);
  const target = memoryTarget(), quiet = { log: () => {} };
  const first = await syncGameFiles(target, files, quiet);
  assert.equal(first.uploaded, 5);
  assert.deepEqual(target.log[0], ["delete", "manifest.json"]);
  assert.deepEqual(target.log.at(-1), ["put", "manifest.json"]);
  assert.deepEqual(JSON.parse(target.objects.get("manifest.json")).files["portal/portal_pak_000.vpk"], 2);
  assert.ok(![...target.objects.keys()].some((k) => /server\.so|config\.cfg/.test(k)));

  target.log.length = 0;
  const again = await syncGameFiles(target, await selectGameFiles(install.root), quiet);
  assert.equal(again.uploaded, 0); assert.equal(again.skipped, 5);
  assert.deepEqual(target.log, [["put", "manifest.json"]], "unchanged files are skipped and the manifest stays available");

  install.put("portal/portal_pak_000.vpk", Buffer.from("cd")); // same size, new content
  target.log.length = 0;
  const changed = await syncGameFiles(target, await selectGameFiles(install.root), quiet);
  assert.equal(changed.uploaded, 1);
  assert.deepEqual(target.log.map((l) => l.join(" ")), ["delete manifest.json", "put files/portal/portal_pak_000.vpk", "put manifest.json"]);

  install.put("portal/maps/testchmb_a_01.bsp", Buffer.from("map2"));
  target.corrupt = "files/portal/maps/testchmb_a_01.bsp";
  await assert.rejects(syncGameFiles(target, await selectGameFiles(install.root), quiet), /verification failed \(manifest not written\)/);
  assert.equal(target.objects.has("manifest.json"), false, "a failed upload leaves the copy unavailable, not half-published");

  const dry = await syncGameFiles(memoryTarget(), await selectGameFiles(install.root), { ...quiet, dryRun: true });
  assert.equal(dry.pending, 6);
});

test("refuses a folder that is not a Portal install", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "portal-upload-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "readme.md"), "hello");
  await assert.rejects(selectGameFiles(root), /does not look like a Portal install/);
});

test("repository guard: game files can never be committed (working tree or history); this repo is clean", (t) => {
  const repo = mkdtempSync(join(tmpdir(), "portal-guard-repo-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", ...args]);
  git("init", "-q");
  writeFileSync(join(repo, "a.ts"), "export {}"); git("add", "."); git("commit", "-qm", "a");
  assert.deepEqual(assertRepoClean(repo), { workingTree: 1, historyBlobs: 1 });
  writeFileSync(join(repo, "notes.md"), Buffer.from([0x34, 0x12, 0xaa, 0x55, 1, 2]));
  assert.throws(() => assertRepoClean(repo), /notes\.md: contents look like VPK data/);
  rmSync(join(repo, "notes.md"));
  writeFileSync(join(repo, "pak01_dir.vpk"), "x"); git("add", "."); git("commit", "-qm", "oops"); git("rm", "-q", "pak01_dir.vpk"); git("commit", "-qm", "rm");
  assert.throws(() => assertRepoClean(repo), /history: pak01_dir\.vpk: game file type \.vpk/);
  const real = execFileSync("git", ["rev-parse", "--show-toplevel"]).toString().trim();
  assert.ok(assertRepoClean(real).historyBlobs > 0);
});
