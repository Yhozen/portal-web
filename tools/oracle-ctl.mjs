#!/usr/bin/env node
// oracle-ctl: drive the original Portal (native Linux build, Gabriel's own Steam install) on its own Xvfb display
// and measure it. Input goes only through the game's own console (a cfg file we write, executed by a key bound
// with `bind`, pressed with xdotool). Output comes only from the game's own console log (-condebug) and screen
// captures (ffmpeg x11grab). No memory reads, no hooks, no patched files. See docs/oracle.md.
//
// One JSON line per command, like portal-ctl. Exit codes: 0 ok, 1 command failed, 2 usage, 3 game not running.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GAME = process.env.PORTAL_DIR || '/home/box/steam-games/portal-linux';
const DISPLAY = process.env.ORACLE_DISPLAY || ':20';
const OUT = process.env.ORACLE_OUT || '/workspace/portal-web-shots/oracle';
const STEAM = process.env.STEAM_ROOT || path.join(process.env.HOME, '.steam/debian-installation');
const SIZE = (process.env.ORACLE_SIZE || '800x500').split('x').map(Number);
const CFG = path.join(GAME, 'portal/cfg/oracle');
const LOG = path.join(GAME, 'portal/console.log');
const TICK = 0.015; // Portal's server tick (66.67 Hz). host_framerate is pinned to it so one frame = one tick.
const env = { ...process.env, DISPLAY };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const trySh = (cmd, args) => { try { return sh(cmd, args); } catch { return ''; } };
const logSize = () => { try { return fs.statSync(LOG).size; } catch { return 0; } };
const logFrom = off => { try { const fd = fs.openSync(LOG, 'r'); const n = fs.fstatSync(fd).size - off; const b = Buffer.alloc(Math.max(0, n)); fs.readSync(fd, b, 0, b.length, off); fs.closeSync(fd); return b.toString('utf8'); } catch { return ''; } };
const gamePid = () => trySh('pgrep', ['-f', 'hl2_linux -game portal']).trim().split('\n').filter(Boolean)[0];
// The window title doesn't match `search --name` here (xdotool reads a different name property), so find it by pid.
const gameWin = () => { const p = gamePid(); return p ? trySh('xdotool', ['search', '--pid', p]).trim().split('\n').filter(Boolean).pop() : undefined; };
let seq = 0;

async function waitFor(fn, ms, every = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(every); } return null; }

function displayUp() { return fs.existsSync(`/tmp/.X11-unix/X${DISPLAY.slice(1)}`); }

async function up() {
  fs.mkdirSync(path.join(OUT, 'logs'), { recursive: true }); fs.mkdirSync(CFG, { recursive: true });
  if (!displayUp()) { spawn('Xvfb', [DISPLAY, '-screen', '0', '1280x800x24', '-ac', '+extension', 'GLX', '+render', '-noreset'], { detached: true, stdio: 'ignore' }).unref(); await waitFor(displayUp, 5000); }
  // Steam: the client keeps Gabriel's remembered login (AutoLogin), so it signs in without a password prompt.
  if (!trySh('pgrep', ['-f', 'steamrt64/steam']).trim()) {
    const o = fs.openSync(path.join(OUT, 'logs/steam.log'), 'a');
    spawn(path.join(STEAM, 'steam.sh'), ['-silent', '-nofriendsui', '-nochatui'], { cwd: STEAM, env, detached: true, stdio: ['ignore', o, o] }).unref();
  }
  const conn = path.join(STEAM, 'logs/connection_log.txt'), start = new Date();
  const loggedOn = await waitFor(() => { try { const t = fs.readFileSync(conn, 'utf8').split('\n').filter(l => /RecvMsgClientLogOnResponse\(\) : \S+ 'OK'/.test(l)).pop(); return t && new Date(t.slice(1, 20).replace(' ', 'T')) > new Date(Date.now() - 6 * 3600e3) ? t.slice(1, 20) : null; } catch { return null; } }, 180000, 1000);
  if (!loggedOn) throw new Error('Steam did not log on (see logs/connection_log.txt); a sign-in prompt needs Gabriel');
  if (gamePid()) return { already: true, pid: +gamePid(), steam_logon: loggedOn };
  fs.writeFileSync(path.join(CFG, 'boot.cfg'), 'sv_cheats 1\nbind F10 "exec oracle/cmd"\necho ORACLE_BOOT_DONE\n');
  const off = logSize();
  const o = fs.openSync(path.join(OUT, 'logs/hl2.log'), 'a');
  spawn(path.join(GAME, 'hl2.sh'), ['-game', 'portal', '-steam', '-windowed', '-noborder', '-w', String(SIZE[0]), '-h', String(SIZE[1]), '-novid', '-nosound', '-condebug', '-console', '+exec', 'oracle/boot'],
    { cwd: GAME, env: { ...env, LANG: 'en_US.UTF-8', SteamAppId: '400', SteamGameId: '400' }, detached: true, stdio: ['ignore', o, o] }).unref();
  // The game shows a locale warning box on this machine before the menu; Return on its window dismisses it.
  const ok = await waitFor(() => { if (logFrom(off).includes('ORACLE_BOOT_DONE')) return true; const w = gameWin(); if (w) { trySh('xdotool', ['windowfocus', w]); trySh('xdotool', ['key', 'Return']); } return false; }, 180000, 2000);
  if (!ok) throw new Error('game did not reach the console (see logs/hl2.log)');
  return { started: true, pid: +gamePid(), steam_logon: loggedOn, ...info() };
}

function down() { trySh('pkill', ['-f', 'hl2_linux -game portal']); return { stopped: true }; }

function info() {
  const inf = fs.readFileSync(path.join(GAME, 'portal/steam.inf'), 'utf8');
  const g = k => (inf.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
  let buildid = null; try { buildid = fs.readFileSync(path.join(GAME, 'steamapps/appmanifest_400.acf'), 'utf8').match(/"buildid"\s+"(\d+)"/)[1]; } catch {}
  return { build: { appid: 400, buildid, patch_version: g('PatchVersion'), server_version: g('ServerVersion') }, size: SIZE, display: DISPLAY };
}

// Run console lines; returns the console output they produced. Lines go into cfg/oracle/cmd.cfg, F10 execs it.
async function con(lines, timeoutMs = 60000, until = null) {
  if (!gamePid()) { const e = new Error('game not running (oracle-ctl up)'); e.code = 3; throw e; }
  const id = `${process.pid}_${++seq}_${Date.now() % 1e6}`;
  const body = [`echo ORACLE_BEGIN_${id}`, ...lines, until ? '' : `wait 6`, until ? '' : `echo ORACLE_END_${id}`].join('\n') + '\n';
  fs.writeFileSync(path.join(CFG, 'cmd.cfg'), body);
  const off = logSize(), w = gameWin();
  trySh('xdotool', ['windowfocus', w]); await sleep(50); trySh('xdotool', ['key', 'F10']);
  const endRe = until || new RegExp(`ORACLE_END_${id}`);
  // Press again only if the cfg hasn't started after 4 s; a second press of an unchanged cfg would run it twice.
  const t0 = Date.now(); let pressed = 1, started = false;
  const text = await waitFor(() => {
    const t = logFrom(off);
    if (!started && t.includes(`ORACLE_BEGIN_${id}`)) { started = true; fs.writeFileSync(path.join(CFG, 'cmd.cfg'), 'echo ORACLE_STALE_PRESS\n'); }
    if (!started && Date.now() - t0 > 4000 * pressed && pressed < 4) { pressed++; trySh('xdotool', ['windowfocus', gameWin()]); trySh('xdotool', ['key', 'F10']); }
    return endRe.test(t) ? t : null;
  }, timeoutMs, 200);
  if (!text) throw new Error(`console timed out after ${timeoutMs} ms`);
  const t = text.slice(text.indexOf(`ORACLE_BEGIN_${id}`));
  return t.split('\n').slice(1).filter(l => !l.startsWith('ORACLE_END_')).map(l => l.replace(/\s+$/, ''));
}

async function currentMap() { const m = (await con(['status'])).join('\n').match(/^map\s+:\s+(\S+)/m); return m ? m[1] : null; }

async function map(name) {
  const t0 = Date.now();
  const out = await con([`map ${name}`], 240000, /Redownloading all lightmaps|map load failed|Can't find map|couldn't find map/i);
  await sleep(3000);
  await con(['sv_cheats 1']);
  return { map: name, ms: Date.now() - t0, failed: out.some(l => /map load failed|can't find map|couldn't find map/i.test(l)) };
}

// getpos prints "setpos X Y Z;setang P Y R" (eye position) on its own line, often split by other output.
const POS_RE = /setpos (-?[\d.]+) (-?[\d.]+) (-?[\d.]+);setang (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/;

// Step the game tick by tick for TICKS, sampling getpos every tick, with console commands scheduled at given ticks.
// Each tick is one frame because host_framerate is pinned to the tick interval. The command buffer runs twice per
// frame (once for the frame, once for its tick), so `wait 2` is one tick; checked by the free-fall test in docs/oracle.md. The sampled
// trace and the exact settings are written to OUT/runs/NAME.jsonl (+ .meta.json).
async function trace(name, ticks, setup = [], at = {}, settle = 40, recordPath = null) {
  ticks = +ticks;
  // getpos and spec_pos report the client's view, which cl_smooth eases over 0.1 s after every landing or step (seen
  // as a rounded take-off and landing in the first traces); cl_smooth 0 gives the raw predicted position.
  // Setup (setpos and friends) goes in its own batch and is given wall time to land: a `wait` in the same batch
  // didn't reliably hold the trace back, and a setpos arriving mid-trace showed up as a teleport at tick 3.
  await con(['host_framerate 0.015', 'host_timescale 1', 'cl_cmdrate 100', 'cl_updaterate 66', 'rate 100000', 'cl_smooth 0', ...setup]);
  await sleep(500 + settle * 30);
  const lines = [];
  for (let i = 0; i <= ticks; i++) lines.push(`alias _ot${i} "${(at[i] || []).join(';')}${at[i] ? ';' : ''}spec_pos;getpos;wait 2;_ot${i + 1}"`);
  lines.push(`alias _ot${ticks + 1} "echo ORACLE_TRACE_DONE;wait 5;host_framerate 0;cl_smooth 1;echo ORACLE_TAIL_"`, '_ot0');
  // Optional clip of the run (wall clock; the game runs about one tick per 1/66 s here, so it is close to real time).
  const rec = recordPath ? record(recordPath, Math.ceil(ticks / 50) + 2) : null;
  const t0 = Date.now();
  const out = await con(lines, 120000 + ticks * 200, /ORACLE_TRACE_DONE[\s\S]*ORACLE_TAIL_/);
  const wall = (Date.now() - t0) / 1000;
  // getpos runs on the server when it reads the client's command, so its output lags the echo and lines
  // interleave. One getpos is issued per frame, so the n-th setpos line is tick n, whatever the echo order.
  const joined = out.join('\n');
  const rows = []; const re = /setpos (-?[\d.]+) (-?[\d.]+) (-?[\d.]+);/g; let m;
  while ((m = re.exec(joined))) rows.push({ tick: rows.length, t: +(rows.length * TICK).toFixed(3), eye: [+m[1], +m[2], +m[3]] });
  // spec_pos is client side and runs in the frame it is issued, with 0.1 unit precision: the predicted view.
  const sre = /spec_goto (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g; let k = 0;
  while ((m = sre.exec(joined))) { if (rows[k]) { rows[k].cl = [+m[1], +m[2], +m[3]]; rows[k].ang = [+m[4], +m[5]]; } k++; }
  if (rows.length !== ticks + 1) throw new Error(`expected ${ticks + 1} getpos samples, got ${rows.length}`);
  const dir = path.join(OUT, 'runs'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  const cv = await con(['host_framerate', 'sv_gravity', 'sv_friction', 'sv_accelerate', 'sv_airaccelerate', 'sv_maxspeed', 'sv_stopspeed', 'cl_forwardspeed', 'cl_sidespeed', 'sv_stepsize', 'fps_max']);
  const cvars = {}; for (const l of cv) { const mm = l.match(/^"(\w+)" = "([^"]*)"/); if (mm) cvars[mm[1]] = mm[2]; }
  const meta = { name, ticks, samples: rows.length, wall_s: wall, effective_fps: +(rows.length / wall).toFixed(1), setup, at, cvars, ...info(), when: new Date().toISOString() };
  if (rec) meta.clip = (await rec).path;
  fs.writeFileSync(path.join(dir, `${name}.meta.json`), JSON.stringify(meta, null, 1));
  return { file: path.join(dir, `${name}.jsonl`), samples: rows.length, wall_s: wall, cvars };
}

function shot(p) {
  const w = gameWin(); const g = sh('xdotool', ['getwindowgeometry', '--shell', w]); const v = Object.fromEntries(g.trim().split('\n').map(l => l.split('=')));
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-video_size', `${v.WIDTH}x${v.HEIGHT}`, '-i', `${DISPLAY}+${v.X},${v.Y}`, '-frames:v', '1', p]);
  return { path: p };
}

function record(p, seconds, fps = 30) {
  const w = gameWin(); const g = sh('xdotool', ['getwindowgeometry', '--shell', w]); const v = Object.fromEntries(g.trim().split('\n').map(l => l.split('=')));
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-framerate', String(fps), '-video_size', `${v.WIDTH}x${v.HEIGHT}`, '-i', `${DISPLAY}+${v.X},${v.Y}`, '-t', String(seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p], { env, stdio: 'ignore' });
  return new Promise(r => ff.on('exit', c => r({ path: p, code: c })));
}

// Command line. `trace NAME TICKS --setup 'a;b' --at '10:+forward' --at '50:-forward'`
async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  const opt = (k, many) => { const v = []; for (let i = 0; i < a.length; i++) if (a[i] === k) v.push(a[++i]); return many ? v : v[0]; };
  switch (cmd) {
    case 'up': return up();
    case 'down': return down();
    case 'info': return { running: !!gamePid(), ...info() };
    case 'con': return { out: await con(a.join(' ').split(';').map(s => s.trim()).filter(Boolean)) };
    case 'map': return map(a[0]);
    case 'trace': {
      const at = {}; for (const s of opt('--at', true)) { const i = s.indexOf(':'); (at[+s.slice(0, i)] ||= []).push(...s.slice(i + 1).split(';').map(x => x.trim()).filter(Boolean)); }
      return trace(a[0], a[1], (opt('--setup') || '').split(';').map(s => s.trim()).filter(Boolean), at, opt('--settle') != null ? +opt('--settle') : 40);
    }
    case 'shot': return shot(a[0]);
    case 'record': return record(a[0], +a[1], +(a[2] || 30));
    default:
      console.log('usage: oracle-ctl up|down|info|con "cmd;cmd"|map NAME|trace NAME TICKS [--setup "..."] [--at T:cmds]...|shot PNG|record MP4 SECONDS [FPS]');
      process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(r => { console.log(JSON.stringify({ cmd: process.argv[2], ok: true, ...r })); }, e => { console.log(JSON.stringify({ cmd: process.argv[2], ok: false, error: e.message })); process.exit(e.code || 1); });
}
export { up, down, con, map, currentMap, trace, shot, record, info };
