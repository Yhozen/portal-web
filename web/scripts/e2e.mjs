// End-to-end check of the hosted flow against the local Worker (pnpm dev, miniflare R2 on 127.0.0.1).
// 1. Owner (simulated Access identity = OWNER_EMAIL): with the local FILES bucket seeded by
//    `pnpm upload-game-files --local --from <install>`, a00 loads from /files/ (no picker) and the a00
//    autopilot reaches testchmb_a_01.
// 2. Another allowlisted player (friend@localhost): /files/ is 403, so the first-run screen appears; YOUR
//    install goes through the folder <input> into OPFS, a00 renders, a reload reads OPFS, the autopilot
//    finishes, then the manage screen and "Forget files". Game files only move between this machine's disk,
//    the local emulation and throwaway local browser profiles.
// Usage: node scripts/e2e.mjs [--install DIR] [--origin URL] [--shots DIR] [--keep] [--skip-owner]
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
  "skip-owner": { type: "boolean", default: false },
} });
await mkdir(values.shots, { recursive: true });
const autopilot = await readFile(join(repo, "tools/autopilot.js"), "utf8");
const play = await readFile(join(repo, "tools/play/testchmb_a_00.js"), "utf8");
const results = {};
const profiles = [];
async function browser(identity) {
  const profile = await mkdtemp(join(tmpdir(), "portal-web-e2e-")); profiles.push(profile);
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true, viewport: { width: 1024, height: 640 },
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  if (identity) await context.setExtraHTTPHeaders({ "X-Dev-Access-Email": identity }); // dev worker only
  const page = context.pages()[0] ?? await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("[error]", m.text().slice(0, 200)); });
  return { context, page };
}
const shot = (page, name) => page.screenshot({ path: join(values.shots, name) }).then(() => console.log("shot", join(values.shots, name)));
// a00 opens on a fade from black: step the simulation past it, then sample the rendered frame.
const sampleFrame = (page) => page.evaluate(() => {
  window.paused = true; window.game.sim(12); const gl = window.game.r.gl ?? document.getElementById("c").getContext("webgl2");
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, lit = 0; for (let i = 0; i < px.length; i += 4) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3; sum += v; if (v > 24) lit++; }
  window.paused = false; return { mean: +(sum / (w * h)).toFixed(1), litFraction: +(lit / (w * h)).toFixed(3) };
});
const loadStats = (page) => page.evaluate(() => ({ source: window.game.assets.source.kind, mb: +(window.game.assets.bytes / 1e6).toFixed(1), req: window.game.assets.requests, loadMs: window.game.stats.loadMs | 0, fps: +window.game.stats.fps.toFixed(1), draws: window.game.stats.draws }));
async function runAutopilot(page) {
  const t = Date.now();
  const out = await page.evaluate(`${autopilot}; ${play}`);
  return { wallSeconds: (Date.now() - t) / 1000, changedTo: await page.evaluate(() => window.changedTo ?? null),
    lines: out.split("\n").filter((l) => /cube1 on button|cube2 on button|to elevator2|changedTo/.test(l)) };
}
let failed = false;
const contexts = [];
try {
  if (!values["skip-owner"]) {
    const { context, page } = await browser(null); contexts.push(context);
    const files = { status: {}, bytes: 0 };
    page.on("response", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/files/")) {
      files.status[r.status()] = (files.status[r.status()] ?? 0) + 1; } });
    const t = Date.now();
    await page.goto(`${values.origin}/?map=testchmb_a_00&nochange=1`);
    await page.waitForFunction(() => window.ready || window.loadError || window.filesScreen === "open", null, { timeout: 120000 });
    const owner = results.owner = { pickerShown: await page.evaluate(() => window.filesScreen === "open"), hostedFiles: await page.evaluate(() => window.hostedFiles ?? null),
      loadError: await page.evaluate(() => window.loadError ?? null), wallMs: Date.now() - t };
    if (owner.pickerShown || owner.loadError) throw new Error("owner did not load from /files/ (seed the local bucket: pnpm upload-game-files --local --from <install>)");
    await page.waitForTimeout(2500);
    owner.load = await loadStats(page);
    owner.frame = await sampleFrame(page);
    await shot(page, "51-web-owner-a00-from-private-bucket.png");
    owner.autopilot = await runAutopilot(page);
    owner.filesResponses = files.status;
    await page.waitForTimeout(500);
    await shot(page, "52-web-owner-a00-autopilot-end.png");
    await context.close();
  }

  const { context, page } = await browser("friend@localhost"); contexts.push(context);
  await page.goto(`${values.origin}/?map=testchmb_a_00&nochange=1`);
  await page.waitForFunction(() => window.filesScreen === "open" || window.ready || window.loadError);
  results.firstRunScreen = await page.evaluate(() => window.filesScreen === "open");
  results.friendHostedFiles = await page.evaluate(() => window.hostedFiles ?? null); // 403: not the owner
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
  results.firstLoad = await loadStats(page);
  results.frame = await sampleFrame(page);
  await shot(page, "47-web-a00-from-opfs.png");

  const t1 = Date.now();
  await page.reload();
  await page.waitForFunction(() => window.ready || window.loadError || window.filesScreen === "open", null, { timeout: 120000 });
  results.reload = { ms: Date.now() - t1, pickerShown: await page.evaluate(() => window.filesScreen === "open"), loadMs: await page.evaluate(() => window.game?.stats?.loadMs | 0) };
  results.autopilot = await runAutopilot(page);
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
  for (const c of contexts) await c.close().catch(() => {});
  for (const p of profiles) await rm(p, { recursive: true, force: true });
}
const owner = results.owner;
const ownerOk = values["skip-owner"] || (owner?.load?.source === "hosted-private" && owner.autopilot?.changedTo === "testchmb_a_01" && owner.frame?.litFraction > 0.2);
const friendOk = results.friendHostedFiles === 403 && results.firstRunScreen && results.firstLoad?.source === "local" &&
  results.autopilot?.changedTo === "testchmb_a_01" && results.frame?.litFraction > 0.2 && !results.reload?.pickerShown;
console.log(`owner via /files/: ${ownerOk ? "PASS" : "FAIL"}; other player via picker/OPFS: ${friendOk ? "PASS" : "FAIL"}`);
process.exit(failed || !ownerOk || !friendOk ? 1 : 0);
