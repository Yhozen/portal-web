// End-to-end check of the hosted flow against a local Worker (pnpm dev): first-run screen, feeding YOUR
// Portal install through the folder <input> into OPFS, a00 render, reload from OPFS, the a00 autopilot
// playthrough, the manage screen and "Forget files". Game files only ever move from disk into a throwaway
// local browser profile. Usage: node scripts/e2e.mjs [--install DIR] [--origin URL] [--shots DIR] [--keep]
import { chromium } from "playwright-core";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const { values } = parseArgs({ options: {
  install: { type: "string", default: process.env.PORTAL_DIR ?? join(homedir(), ".steam/debian-installation/steamapps/common/Portal") },
  origin: { type: "string", default: "http://127.0.0.1:8430" },
  shots: { type: "string", default: join(repo, "shots") }, keep: { type: "boolean", default: false },
} });
await mkdir(values.shots, { recursive: true });
const autopilot = await readFile(join(repo, "tools/autopilot.js"), "utf8");
const play = await readFile(join(repo, "tools/play/testchmb_a_00.js"), "utf8");
const profile = await mkdtemp(join(tmpdir(), "portal-web-e2e-"));
const results = {};
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true, viewport: { width: 1024, height: 640 },
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const shot = (page, name) => page.screenshot({ path: join(values.shots, name) }).then(() => console.log("shot", join(values.shots, name)));
let failed = false;
try {
  const page = context.pages()[0] ?? await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("[error]", m.text().slice(0, 200)); });
  await page.goto(`${values.origin}/?map=testchmb_a_00&nochange=1`);
  await page.waitForFunction(() => window.filesScreen === "open" || window.ready || window.loadError);
  results.firstRunScreen = await page.evaluate(() => window.filesScreen === "open");
  results.pickerButton = await page.locator("#files .pick").count() > 0; // showDirectoryPicker present (Chromium)
  await shot(page, "45-web-first-run.png");
  const t0 = Date.now();
  await page.locator("#files .dirinput").setInputFiles(values.install); // webkitdirectory route, real install
  let midShot = false;
  await page.waitForFunction(() => window.filesProgress || window.filesScreen === "closed" || document.querySelector("#files .err"), null, { timeout: 300000 });
  while (await page.evaluate(() => window.filesScreen === "open" && !document.querySelector("#files .err"))) {
    const p = await page.evaluate(() => window.filesProgress);
    if (!midShot && p && p.done > p.total * 0.3) { await shot(page, "46-web-copying.png"); midShot = true; }
    await page.waitForTimeout(1000);
  }
  const err = await page.evaluate(() => document.querySelector("#files .err")?.textContent);
  if (err) throw new Error("import failed: " + err);
  results.importSeconds = (Date.now() - t0) / 1000;
  results.manifest = await page.evaluate(async () => { const m = await window.portalFiles.readManifest(); return { files: Object.keys(m.files).length, total: m.total }; });
  results.storage = await page.evaluate(() => window.portalFiles.storageInfo());
  await page.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
  results.loadError = await page.evaluate(() => window.loadError ?? null);
  await page.waitForTimeout(2500);
  results.firstLoad = await page.evaluate(() => ({ source: window.game.assets.source.kind, mb: +(window.game.assets.bytes / 1e6).toFixed(1), req: window.game.assets.requests, loadMs: window.game.stats.loadMs | 0, fps: +window.game.stats.fps.toFixed(1), draws: window.game.stats.draws }));
  // a00 opens on a fade from black: step the simulation past it, then sample the rendered frame.
  results.frame = await page.evaluate(() => {
    window.paused = true; window.game.sim(12); const gl = window.game.r.gl ?? document.getElementById("c").getContext("webgl2");
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, lit = 0; for (let i = 0; i < px.length; i += 4) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3; sum += v; if (v > 24) lit++; }
    window.paused = false; return { mean: +(sum / (w * h)).toFixed(1), litFraction: +(lit / (w * h)).toFixed(3) };
  });
  await shot(page, "47-web-a00-from-opfs.png");

  const t1 = Date.now();
  await page.reload();
  await page.waitForFunction(() => window.ready || window.loadError || window.filesScreen === "open", null, { timeout: 120000 });
  results.reload = { ms: Date.now() - t1, pickerShown: await page.evaluate(() => window.filesScreen === "open"), loadMs: await page.evaluate(() => window.game?.stats?.loadMs | 0) };
  const t2 = Date.now();
  const out = await page.evaluate(`${autopilot}; ${play}`);
  results.autopilot = { wallSeconds: (Date.now() - t2) / 1000, changedTo: await page.evaluate(() => window.changedTo ?? null),
    lines: out.split("\n").filter((l) => /cube1 on button|cube2 on button|to elevator2|changedTo/.test(l)) };
  await page.waitForTimeout(500);
  await shot(page, "48-web-a00-autopilot-end.png");

  await page.goto(`${values.origin}/?map=testchmb_a_00&files=manage`);
  await page.waitForFunction(() => window.filesScreen === "open");
  await page.locator("#files .forget").waitFor();
  await shot(page, "49-web-manage-files.png");
  if (!values.keep) {
    await page.locator("#files .forget").click();
    await page.waitForFunction(() => /Forgot/.test(window.filesStatus ?? ""));
    results.forgotten = await page.evaluate(async () => (await window.portalFiles.readManifest()) === null &&
      !(await (async () => { try { await (await navigator.storage.getDirectory()).getDirectoryHandle("portal-files"); return true; } catch { return false; } })()));
    await shot(page, "50-web-after-forget.png");
  }
} catch (e) { failed = true; console.log("FAILED", e.message); }
finally {
  console.log(JSON.stringify(results, null, 2));
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
process.exit(failed || results.autopilot?.changedTo !== "testchmb_a_01" || !(results.frame?.litFraction > 0.2) || results.reload?.pickerShown ? 1 : 0);
