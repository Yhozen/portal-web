// Chromium tests of the hosted-mode file store with synthetic, made-up files (no game data):
// directory handles, drag-and-drop, OPFS copy/resume/forget, quota failure and the VPK reader.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { vpkDir } from "./fixtures/vpk.mjs";

const chrome = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const skip = !existsSync(chrome) && `no Chrome at ${chrome} (set CHROME_PATH)`;

test("hosted-mode file store in Chromium", { skip }, async (t) => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("./fixtures/browser-entry.ts", import.meta.url))], bundle: true, format: "iife", write: false, logLevel: "silent" });
  const js = bundle.outputFiles[0].text;
  const server = createServer((req, res) => {
    if (req.url === "/t.js") { res.setHeader("content-type", "text/javascript"); return res.end(js); }
    res.setHeader("content-type", "text/html"); res.end('<!doctype html><script src="/t.js"></script>');
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const profile = mkdtempSync(join(tmpdir(), "portal-browser-test-"));
  const context = await chromium.launchPersistentContext(profile, { executablePath: chrome, headless: true });
  t.after(async () => { await context.close(); server.close(); rmSync(profile, { recursive: true, force: true }); });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);

  // Fixture: portal_pak (external archive 000, with a preload), hl2_textures (embedded data), hl2_misc, loose files.
  const fixture = {
    pak: [...vpkDir([{ path: "materials/shared.vmt", archive: 0, offset: 2, length: 3, preload: new Uint8Array([80, 80]) },
      { path: "scripts/only_pak.txt", archive: 0, offset: 5, length: 2 }])],
    pak000: [...new TextEncoder().encode("..PAKxy")],
    tex: [...vpkDir([{ path: "materials/shared.vmt", length: 3, offset: 0, data: new TextEncoder().encode("TEX") },
      { path: "materials/tex.vtf", length: 2, offset: 3, data: new TextEncoder().encode("ok") }], { embedded: true })],
    misc: [...vpkDir([])],
  };

  await t.test("directory handle: finds Portal under a Steam library and ignores everything else", async () => {
    const r = await page.evaluate(async (fx) => {
      const opfs = await navigator.storage.getDirectory();
      const put = async (path, bytes) => {
        let d = opfs; const parts = path.split("/");
        for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
        const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable(); await w.write(new Uint8Array(bytes)); await w.close();
      };
      const base = "pick/steamapps/common/Portal/";
      await put(base + "portal/portal_pak_dir.vpk", fx.pak); await put(base + "portal/portal_pak_000.vpk", fx.pak000);
      await put(base + "hl2/hl2_textures_dir.vpk", fx.tex); await put(base + "hl2/hl2_misc_dir.vpk", fx.misc);
      await put(base + "portal/maps/testchmb_a_00.bsp", [86, 66, 83, 80]); await put(base + "portal/resource/x.txt", [65]);
      await put(base + "hl2/resource/x.txt", [66]); await put(base + "hl2/resource/hl2only.txt", [67]);
      await put(base + "portal/bin/server.so", [0]); await put("pick/steamapps/common/OtherGame/big.vpk", [0]);
      const pick = await opfs.getDirectoryHandle("pick");
      const raw = await T.entriesFromHandle(pick);
      const sel = T.selectImport(raw);
      const sizes = [];
      const m = await T.importFiles(sel, (p) => sizes.push(p.done));
      const src = await (await T.openStore());
      const text = async (p) => { const b = await src.read(p); return b == null ? null : new TextDecoder().decode(b); };
      const out = {
        raw: raw.map((e) => e.path).sort(), sel: sel.map((c) => c.rel), files: Object.keys(m.files).length, total: m.total, lastDone: sizes.at(-1),
        shared: await text("materials/shared.vmt"), onlyPak: await text("scripts/only_pak.txt"), tex: await text("materials/tex.vtf"),
        looseOrder: await text("resource/x.txt"), hl2only: await text("resource/hl2only.txt"), map: await text("maps/testchmb_a_00.bsp"), missing: await text("nope.txt"),
      };
      // Resume: a second import of the same files copies nothing.
      const first = [];
      await T.importFiles(sel, (p) => first.push(p.done));
      out.resumeStartsAt = first[0];
      await opfs.removeEntry("pick", { recursive: true });
      return out;
    }, fixture);
    assert.ok(!r.raw.some((p) => p.includes("OtherGame")), "walks only the Portal install");
    assert.deepEqual(r.sel, ["hl2/hl2_misc_dir.vpk", "hl2/hl2_textures_dir.vpk", "hl2/resource/hl2only.txt", "hl2/resource/x.txt",
      "portal/maps/testchmb_a_00.bsp", "portal/portal_pak_000.vpk", "portal/portal_pak_dir.vpk", "portal/resource/x.txt"]);
    assert.equal(r.files, 8); assert.equal(r.lastDone, r.total);
    assert.equal(r.shared, "PPPAK", "portal_pak wins over hl2_textures; preload + archive bytes");
    assert.equal(r.onlyPak, "xy"); assert.equal(r.tex, "ok", "embedded VPK data");
    assert.equal(r.looseOrder, "A", "loose portal/ before hl2/"); assert.equal(r.hl2only, "C"); assert.equal(r.map, "VBSP"); assert.equal(r.missing, null);
    assert.equal(r.resumeStartsAt, r.total, "resumed import skips stored files");
  });

  await t.test("drag-and-drop of loose files is placed by name", async () => {
    const rels = await page.evaluate(async (fx) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(fx.pak)], "portal_pak_dir.vpk"));
      dt.items.add(new File([new Uint8Array(fx.tex)], "hl2_textures_dir.vpk"));
      dt.items.add(new File(["x"], "readme.txt"));
      return T.selectImport(await T.entriesFromDrop(dt)).map((c) => c.rel);
    }, fixture);
    assert.deepEqual(rels, ["hl2/hl2_textures_dir.vpk", "portal/portal_pak_dir.vpk"]);
  });

  await t.test("a bad selection and a full disk leave no manifest behind", async () => {
    const r = await page.evaluate(async (fx) => {
      const f = (name, bytes) => { const b = new Uint8Array(bytes); return { path: name, size: b.length, open: async () => new File([b], name) }; };
      const good = [f("portal/portal_pak_dir.vpk", fx.pak), f("portal/portal_pak_000.vpk", fx.pak000), f("hl2/hl2_textures_dir.vpk", fx.tex),
        f("hl2/hl2_misc_dir.vpk", fx.misc), f("portal/maps/testchmb_a_00.bsp", [1, 2, 3, 4])];
      await T.forgetFiles();
      const bad = await T.importFiles(T.selectImport(good.filter((e) => !e.path.endsWith("_000.vpk")))).then(() => "ok", (e) => e.message);
      const afterBad = await T.readManifest();
      const est = navigator.storage.estimate.bind(navigator.storage);
      navigator.storage.estimate = async () => ({ usage: 0, quota: 10 });
      const full = await T.importFiles(T.selectImport(good)).then(() => "ok", (e) => e.name + ": " + e.message);
      navigator.storage.estimate = est;
      const afterFull = await T.readManifest();
      await T.importFiles(T.selectImport(good));
      const ok = !!(await T.readManifest());
      await T.forgetFiles();
      const opfs = await navigator.storage.getDirectory(), left = [];
      for await (const k of opfs.keys()) left.push(k);
      return { bad, afterBad, full, afterFull, ok, afterForget: await T.readManifest(), left };
    }, fixture);
    assert.match(r.bad, /missing portal\/portal_pak_000\.vpk/); assert.equal(r.afterBad, null);
    assert.match(r.full, /^StorageFullError: Not enough browser storage/); assert.equal(r.afterFull, null);
    assert.equal(r.ok, true); assert.equal(r.afterForget, null); assert.deepEqual(r.left, []);
  });
});
