#!/usr/bin/env node
// portal-ctl: a scriptable, headless test harness for the port, modelled on Horizon's horizon-ctl
// (docs/native-client.md, "Agent control"). It starts the local asset server against a game folder and a headless
// Chromium (SwiftShader WebGL2), then runs commands and prints one JSON line per command on stdout.
// The game's own frame loop is switched off while it runs: the simulation only advances on `step`, and a frame is
// only drawn on `render`/`screenshot`/`bench`, so the same script gives the same pictures run after run.
// Usage and the command list: docs/harness.md, or `node tools/portal-ctl.mjs help`.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const HELP = `portal-ctl [options] script FILE|-     run one command per line (# comments), stop at the first error
portal-ctl [options] run 'CMD; CMD; ...' run commands given inline
options: --game DIR (Portal install; default $PORTAL_DIR or the Steam path) --size WxH (default 1024x640)
         --port N (asset server port; default a free one) --base URL (use a server that is already running)
         --keep-going (do not stop at the first error) --no-build (skip ./build.sh) --seed N (Math.random seed, default 1)
commands:
  map NAME [QUERY]            load a map (nochange=1 is always set); replies load time, requests, MB, warnings
  pose X Y Z PITCH YAW        noclip, intro fade off, feet at X Y Z (eye is 64 above), view angles in degrees
  look PITCH YAW              change only the view angles
  noclip on|off               off lets step run the real player physics and game logic
  step N [KEYS]               advance N fixed ticks (1/66 s); KEYS like w, wd, space, duck held for those ticks
  shoot blue|orange           fire the portal gun along the current view (as the mouse does)
  use                         press E (pick up / drop)
  fire ENTITY INPUT [PARAM]   send an entity input through the I/O system, e.g. fire relay_start Trigger
  set KEY VALUE               renderer switch: showSky usePVS useCubes useLightmap showOverlays noPortalRender maxDepth
  render                      draw one frame; replies draws, views, culled and the frame's CPU+GPU time
  screenshot PATH             draw one frame and save the canvas as PNG (no HUD text)
  bench N                     draw N frames back to back (simulation still), reply ms per frame avg p50 p95 max and fps
  diff A.png B.png [OUT.png]  compare two screenshots: changed pixel share and mean difference, optional diff image
  state                       map, position, angles, velocity, noclip, held cube, open portals, counters
  ents [CLASS_REGEX] [N]      entities from the BSP: classname, targetname, origin
  errors                      console errors, warnings and page errors since the last call
  eval JS                     evaluate JS in the page (window.game is the engine); replies the JSON result
  sleep S                     wait S seconds of wall time
exit status: 0 ok, 1 a command failed, 2 usage error, 3 the server or browser could not be started`;

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: {
  game: { type: 'string' }, size: { type: 'string', default: '1024x640' }, port: { type: 'string' }, base: { type: 'string' },
  'keep-going': { type: 'boolean', default: false }, 'no-build': { type: 'boolean', default: false }, seed: { type: 'string', default: '1' }, help: { type: 'boolean', default: false } } });
const [verb, arg] = positionals;
if (opt.help || verb === 'help' || !verb) { console.log(HELP); process.exit(verb || opt.help ? 0 : 2); }

// shell-like splitting: quotes group words, # starts a comment at a word boundary
function words(line) { const out = []; let cur = '', q = null, any = false;
  for (let i = 0; i < line.length; i++) { const c = line[i];
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; any = true; continue; }
    if (c === '#' && !cur && !any) break;
    if (/\s/.test(c)) { if (cur || any) out.push(cur); cur = ''; any = false; continue; }
    cur += c; }
  if (cur || any) out.push(cur); return out; }
let lines;
if (verb === 'script') { if (!arg) { console.log(HELP); process.exit(2); } lines = readFileSync(arg === '-' ? 0 : arg, 'utf8').split('\n'); }
else if (verb === 'run') { if (!arg) { console.log(HELP); process.exit(2); } lines = arg.split(/;\s*/); }
else { console.error('unknown verb ' + verb); console.log(HELP); process.exit(2); }
const cmds = lines.map((l, i) => ({ n: i + 1, w: words(l.trim()) })).filter(c => c.w.length);

const out = o => process.stdout.write(JSON.stringify(o) + '\n');
const freePort = () => new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

let server = null, browser = null;
const cleanup = async () => { try { await browser?.close(); } catch {} server?.kill(); };
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

let base = opt.base;
try {
  if (!opt['no-build']) { const b = spawn(join(ROOT, 'build.sh'), [], { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; b.stderr.on('data', d => err += d);
    const code = await new Promise(r => b.on('exit', r)); if (code) throw new Error('build failed: ' + err.slice(-400)); }
  if (!base) {
    const game = opt.game || process.env.PORTAL_DIR || join(homedir(), '.steam/debian-installation/steamapps/common/Portal');
    if (!existsSync(join(game, 'portal', 'portal_pak_dir.vpk'))) throw new Error('not a Portal install (no portal/portal_pak_dir.vpk): ' + game);
    const port = +(opt.port || await freePort());
    server = spawn(process.execPath, [join(ROOT, 'server/server.ts')], { env: { ...process.env, PORTAL_DIR: game, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((res, rej) => { let log = ''; const t = setTimeout(() => rej(new Error('server did not start: ' + log)), 20000);
      server.stdout.on('data', d => { log += d; if (/http:\/\//.test(log)) { clearTimeout(t); res(); } }); server.stderr.on('data', d => log += d); server.on('exit', c => rej(new Error('server exited ' + c + ': ' + log))); });
    base = `http://127.0.0.1:${port}/`;
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
} catch (e) { out({ error: String(e.message || e), kind: 'launch' }); await cleanup(); process.exit(3); }

const [W, H] = opt.size.split('x').map(Number);
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
// seeded Math.random so cube spawns, gibs and anything else random repeat exactly
await ctx.addInitScript(seed => { let s = seed >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };   // the page's frame loop must not simulate or draw even once before the harness takes over: real-time steps
  // between load and the first command (doors, ball launchers) made screenshots differ run to run
  window.paused = true; window.customRender = () => {};
}, +opt.seed);
let page = null, logs = [];
const attach = p => { p.on('console', m => { if ((m.type() === 'error' && !/^Failed to load resource/.test(m.text())) || m.type() === 'warning') logs.push({ type: m.type(), text: m.text().slice(0, 300) }); });
  p.on('response', r => { if (r.status() >= 400) logs.push({ type: 'http', text: r.status() + ' ' + decodeURIComponent(new URL(r.url()).pathname) }); });
  p.on('pageerror', e => logs.push({ type: 'pageerror', text: String(e.message).slice(0, 300) })); };

const need = () => { if (!page) throw new Error('no map loaded (use: map NAME)'); };
const num = (s, what) => { const v = Number(s); if (!Number.isFinite(v)) throw Object.assign(new Error(`${what}: not a number: ${s}`), { usage: true }); return v; };
// one frame drawn and finished on the GPU, timed
const RENDER = () => { const g = window.game, gl = document.getElementById('c').getContext('webgl2'); const t = performance.now(); g.render(); gl.finish(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { frame_ms: +(performance.now() - t).toFixed(2), draws: g.r.stats.draws, views: g.r.stats.views, culled: g.r.stats.culled }; };

const handlers = {
  async map(w) { const name = w[1]; if (!name) throw Object.assign(new Error('map NAME'), { usage: true });
    if (page) await page.close(); logs = []; page = await ctx.newPage(); attach(page);
    const t0 = Date.now(); await page.goto(base + '?map=' + encodeURIComponent(name) + '&nochange=1&fast=0' + (w[2] ? '&' + w[2] : ''));
    await page.waitForFunction(() => window.ready || window.loadError, null, { timeout: 180000 });
    const le = await page.evaluate(() => window.loadError); if (le) throw new Error('load failed: ' + String(le).split('\n')[0]);
    // harness owns the clock: the page's frame loop neither simulates nor draws from here on
    const info = await page.evaluate(() => { window.paused = true; window.customRender = () => {}; const g = window.game;
      return { load_ms: g.stats.loadMs | 0, requests: g.assets?.requests, mb: +((g.assets?.bytes || 0) / 1e6).toFixed(1), pos: g.pl.pos.map(v => +v.toFixed(1)), ang: g.pl.ang.map(v => +v.toFixed(1)), sky: !!g.r.sky }; });
    return { map: name, ready_ms: Date.now() - t0, ...info, warnings: logs.filter(l => l.type !== 'error').length, errors: logs.filter(l => l.type === 'error' || l.type === 'pageerror').length, http_errors: logs.filter(l => l.type === 'http').length }; },
  async pose(w) { need(); const v = w.slice(1, 6).map((s, i) => num(s, ['x', 'y', 'z', 'pitch', 'yaw'][i])); if (v.length < 5) throw Object.assign(new Error('pose X Y Z PITCH YAW'), { usage: true });
    return page.evaluate(v => { const g = window.game, h = g.game.hud; g.pl.noclip = true; h.fade = 0; h.fadeTarget = 0; h.fadeHoldUntil = 0; g.pl.pos = [v[0], v[1], v[2]]; g.pl.ang = [v[3], v[4], 0]; g.pl.vel = [0, 0, 0];
      return { pos: g.pl.pos, ang: g.pl.ang, cluster: g.r.clusterAt(g.pl.eye()) }; }, v); },
  async look(w) { need(); const p = num(w[1], 'pitch'), y = num(w[2], 'yaw'); return page.evaluate(([p, y]) => { window.game.pl.ang = [p, y, 0]; return { ang: window.game.pl.ang }; }, [p, y]); },
  async noclip(w) { need(); const on = w[1] !== 'off'; return page.evaluate(on => { window.game.pl.noclip = on; return { noclip: on }; }, on); },
  async step(w) { need(); const n = Math.max(0, Math.floor(num(w[1] ?? 1, 'N'))); const k = (w[2] || '').toLowerCase();
    const inp = { fwd: (k.includes('w') ? 1 : 0) - (k.includes('s') && !k.includes('space') ? 1 : 0), side: (k.includes('d') && !k.includes('duck') ? 1 : 0) - (k.includes('a') && !k.includes('space') ? 1 : 0), jump: k.includes('space'), duck: k.includes('duck') };
    return page.evaluate(([n, inp]) => { const g = window.game, T = 1 / 66; const t = performance.now(); for (let i = 0; i < n; i++) g.step(T, inp);
      return { ticks: n, sim_ms: +(performance.now() - t).toFixed(2), pos: g.pl.pos.map(v => +v.toFixed(2)), vel: g.pl.vel.map(v => +v.toFixed(2)) }; }, [n, inp]); },
  async shoot(w) { need(); const which = { blue: 0, orange: 1, '0': 0, '1': 1 }[w[1]]; if (which === undefined) throw Object.assign(new Error('shoot blue|orange'), { usage: true });
    return page.evaluate(which => { const g = window.game; g.game.shootPortal(which); const p = g.game.gunPortals?.[which]; return { portal: which ? 'orange' : 'blue', open: !!p?.open, pos: p?.open ? p.pos.map(v => +v.toFixed(1)) : null }; }, which); },
  async use() { need(); return page.evaluate(() => { const g = window.game.game; g.use(); return { held: !!g.held }; }); },
  async fire(w) { need(); if (!w[2]) throw Object.assign(new Error('fire ENTITY INPUT [PARAM]'), { usage: true });
    return page.evaluate(([t, i, p]) => { window.game.io.send(t, i, p ?? ''); return { queued: t, input: i, note: 'delivered on the next step' }; }, [w[1], w[2], w[3]]); },
  async set(w) { need(); const k = w[1], ok = ['showSky', 'usePVS', 'useCubes', 'useLightmap', 'showOverlays', 'noPortalRender', 'maxDepth'];
    if (!ok.includes(k)) throw Object.assign(new Error('set KEY VALUE, KEY one of ' + ok.join(' ')), { usage: true });
    const v = k === 'maxDepth' ? num(w[2], k) : /^(1|true|on)$/i.test(w[2] || ''); return page.evaluate(([k, v]) => { window.game.r[k] = v; return { [k]: window.game.r[k] }; }, [k, v]); },
  async render() { need(); return page.evaluate(RENDER); },
  async screenshot(w) { need(); const f = w[1]; if (!f) throw Object.assign(new Error('screenshot PATH'), { usage: true });
    const r = await page.evaluate(src => { const st = (0, eval)(src)(); return { ...st, png: document.getElementById('c').toDataURL('image/png') }; }, `(${RENDER})`);
    mkdirSync(dirname(resolve(f)), { recursive: true }); writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64')); delete r.png; return { path: resolve(f), ...r }; },
  async bench(w) { need(); const n = Math.max(1, Math.floor(num(w[1] ?? 60, 'N')));
    return page.evaluate(([n, src]) => { const R = (0, eval)(src); R(); const ms = []; let last; for (let i = 0; i < n; i++) { last = R(); ms.push(last.frame_ms); }
      const s = [...ms].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))], avg = ms.reduce((a, b) => a + b, 0) / n;
      return { frames: n, avg_ms: +avg.toFixed(2), p50_ms: q(.5), p95_ms: q(.95), max_ms: s[s.length - 1], fps: +(1000 / avg).toFixed(1), draws: last.draws, views: last.views }; }, [n, `(${RENDER})`]); },
  async diff(w) { if (!w[2]) throw Object.assign(new Error('diff A.png B.png [OUT.png]'), { usage: true });
    const p = page || await ctx.newPage(); const a = readFileSync(w[1]).toString('base64'), b = readFileSync(w[2]).toString('base64');
    const r = await p.evaluate(async ([a, b, wantOut]) => {
      const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }; };
      const A = await load(a), B = await load(b); if (A.w !== B.w || A.h !== B.h) return { error: `size differs: ${A.w}x${A.h} vs ${B.w}x${B.h}` };
      const n = A.w * A.h; let changed = 0, sum = 0; const o = new ImageData(A.w, A.h);
      for (let i = 0; i < n; i++) { const d = Math.max(Math.abs(A.d[i * 4] - B.d[i * 4]), Math.abs(A.d[i * 4 + 1] - B.d[i * 4 + 1]), Math.abs(A.d[i * 4 + 2] - B.d[i * 4 + 2])); sum += d; if (d > 8) changed++;
        o.data[i * 4] = d > 8 ? 255 : A.d[i * 4] >> 2; o.data[i * 4 + 1] = A.d[i * 4 + 1] >> 2; o.data[i * 4 + 2] = A.d[i * 4 + 2] >> 2; o.data[i * 4 + 3] = 255; }
      let png = null; if (wantOut) { const c = new OffscreenCanvas(A.w, A.h); c.getContext('2d').putImageData(o, 0, 0); const bl = await c.convertToBlob({ type: 'image/png' }); png = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(bl); }); }
      return { size: [A.w, A.h], changed_share: +(changed / n).toFixed(5), mean_diff: +(sum / n).toFixed(3), identical: changed === 0 && sum === 0, png }; }, [a, b, !!w[3]]);
    if (r.error) throw new Error(r.error); if (r.png) { writeFileSync(w[3], Buffer.from(r.png, 'base64')); r.out = resolve(w[3]); } delete r.png; if (!page) await p.close(); return r; },
  async state() { need(); return page.evaluate(() => { const g = window.game, pl = g.pl, r = (v, k = 1) => v.map(x => +x.toFixed(k));
    return { map: new URLSearchParams(location.search).get('map'), pos: r(pl.pos), ang: r(pl.ang), vel: r(pl.vel), noclip: !!pl.noclip, eye_cluster: g.r.clusterAt(pl.eye()), held: !!g.game.held,
      portals: (g.r.portals || []).filter(p => p.open).map(p => ({ name: p.name, pos: r(p.pos), linked: p.linked?.name ?? null })), draws: g.r.stats.draws, views: g.r.stats.views, culled: g.r.stats.culled, sky: !!g.r.sky }; }); },
  async ents(w) { need(); const re = w[1] || '.', n = +(w[2] || 50); return page.evaluate(([re, n]) => { const R = new RegExp(re);
    const m = window.game.bsp.entities.filter(e => R.test(e.classname)); return { count: m.length, ents: m.slice(0, n).map(e => ({ classname: e.classname, targetname: e.targetname, origin: e.origin })) }; }, [re, n]); },
  async errors() { const l = logs; logs = []; return { count: l.length, logs: l }; },
  async eval(w) { need(); const js = w.slice(1).join(' '); const v = await page.evaluate(js => { const r = (0, eval)(js); return r === undefined ? null : JSON.parse(JSON.stringify(r)); }, js); return { value: v }; },
  async sleep(w) { await new Promise(r => setTimeout(r, num(w[1] ?? 1, 'S') * 1000)); return { slept: +w[1] }; },
};

let status = 0;
for (const c of cmds) {
  const name = c.w[0], h = handlers[name];
  const t0 = Date.now();
  try {
    if (!h) throw Object.assign(new Error('unknown command: ' + name), { usage: true });
    const r = await h(c.w); out({ line: c.n, cmd: name, ok: true, ms: Date.now() - t0, ...r });
  } catch (e) {
    out({ line: c.n, cmd: name, ok: false, error: String(e.message || e).split('\n')[0], kind: e.usage ? 'usage' : 'error' });
    status = Math.max(status, e.usage ? 2 : 1); if (!opt['keep-going']) break;
  }
}
await cleanup();
process.exit(status);
