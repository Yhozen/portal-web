#!/usr/bin/env node
// parity: run the same scenario in the original Portal (oracle-ctl) and in the port (portal-ctl), sample the eye
// position every tick, and compare metrics. Scenario files are checks/oracle/*.json; measured original numbers go to
// checks/reference/*.json and `check` fails if the port is outside their tolerances.
//
//   node tools/parity.mjs orig FILE [NAME...]            run in the original (needs `oracle-ctl up`)
//   node tools/parity.mjs port FILE --attach SOCK [NAME...]  run in the port (needs a portal-ctl serve session)
//   node tools/parity.mjs compare FILE                    print original vs port metrics from the saved runs
//   node tools/parity.mjs reference FILE                  write checks/reference/<file>.json from the original runs
//   node tools/parity.mjs check FILE --attach SOCK        run the port and assert against the reference
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RUNS = process.env.ORACLE_OUT ? path.join(process.env.ORACLE_OUT, 'runs') : '/workspace/portal-web-shots/oracle/runs';
const DT = { orig: 0.015, port: 1 / 66 }; // tick lengths: the original runs at 66.67 Hz, the port's loop at 1/66 s
const STAND_VIEW = 64, DUCK_VIEW = 28;

const load = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const readRun = (side, name) => { const f = path.join(RUNS, side, name + '.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse) : null; };
const writeRun = (side, name, rows, meta) => { const d = path.join(RUNS, side); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name + '.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n'); if (meta) fs.writeFileSync(path.join(d, name + '.meta.json'), JSON.stringify(meta, null, 1)); };

// ---- metrics over a trace of eye positions, one per tick ------------------------------------------------------
const hspeed = (r, k, dt) => k < 1 ? 0 : Math.hypot(r[k].eye[0] - r[k - 1].eye[0], r[k].eye[1] - r[k - 1].eye[1]) / dt;
const vz = (r, k, dt) => k < 1 ? 0 : (r[k].eye[2] - r[k - 1].eye[2]) / dt;
// first tick that moves after `from`, and first tick slower than the one before after `from`
const onset = (r, dt, from) => { for (let k = from + 1; k < r.length; k++) if (hspeed(r, k, dt) > 0.5) return k; return r.length; };
const decel = (r, dt, from) => { for (let k = from + 1; k < r.length; k++) if (hspeed(r, k, dt) < hspeed(r, k - 1, dt) - 0.5) return k; return r.length; };
const takeoff = (r, from) => { const z0 = r[from].eye[2]; for (let k = from + 1; k < r.length; k++) if (r[k].eye[2] > z0 + 0.01) return k - 1; return r.length - 1; };
function airFit(r, dt, from) {
  const z0 = r[from].eye[2], ks = range(from + 1, r.length - 1).filter(k => r[k].eye[2] > z0 + 2);
  let S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  for (const k of ks) { const t = k * dt, z = r[k].eye[2] - z0; for (let i = 0; i < 5; i++) S[i] += t ** i; for (let i = 0; i < 3; i++) T[i] += z * t ** i; }
  // normal equations for [c b a]
  const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]], det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), sol = [0, 1, 2].map(j => det(M.map((row, i) => row.map((v, c) => c === j ? T[i] : v))) / D); const [c, b, a] = sol;
  const disc = b * b - 4 * a * c; return { t: disc > 0 ? Math.sqrt(disc) / Math.abs(a) : NaN, g: -2 * a, ks };
}
const spd3 = (r, k, dt) => Math.hypot(...[0, 1, 2].map(i => r[k].eye[i] - r[k - 1].eye[i])) / dt;
const tpIndex = r => { for (let k = 1; k < r.length; k++) if (Math.hypot(...[0, 1, 2].map(i => r[k].eye[i] - r[k - 1].eye[i])) > 48) return k; return -1; };
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[s.length >> 1] + s[(s.length - 1) >> 1]) / 2 : NaN; };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const METRICS = {
  speed: (r, dt, [a, b]) => median(range(a, b).map(k => hspeed(r, k, dt))),
  // Times and distances are counted from when the motion starts, not from the key event: in the original a button
  // reaches the server one or two ticks after the console command, in the port on the same tick.
  t_reach: (r, dt, [from, frac, ref], m) => { const v = m[ref], s = onset(r, dt, from); for (let k = s; k < r.length; k++) if (hspeed(r, k, dt) >= frac * v) return (k - s + 1) * dt; return NaN; },
  stop_dist: (r, dt, [from]) => { let d = 0; for (let k = decel(r, dt, from); k < r.length; k++) d += hspeed(r, k, dt) * dt; return d; },
  stop_time: (r, dt, [from]) => { const s = decel(r, dt, from); for (let k = s; k < r.length; k++) if (hspeed(r, k, dt) < 0.5) return (k - s) * dt; return NaN; },
  z_change: (r, dt, [a, b]) => r[b].eye[2] - r[a].eye[2],
  z_t_reach: (r, dt, [from, frac, end]) => { const z0 = r[from].eye[2], dz = r[end].eye[2] - z0; let s = -1; for (let k = from; k <= end; k++) { if (s < 0 && Math.abs(r[k].eye[2] - z0) > 0.01) s = k - 1; if (s >= 0 && Math.abs(r[k].eye[2] - z0) >= frac * Math.abs(dz)) return (k - s) * dt; } return NaN; },
  peak: (r, dt, [from]) => Math.max(...r.slice(from).map(x => x.eye[2])) - r[from].eye[2],
  peak_t: (r, dt, [from]) => { const s = takeoff(r, from); let best = s; for (let k = s; k < r.length; k++) if (r[k].eye[2] > r[best].eye[2]) best = k; return (best - s) * dt; },
  // airtime: from the first tick the eye rises to the first tick it is back at (or under) the take-off height
  air_t: (r, dt, [from]) => { const z0 = r[from].eye[2]; let up = -1; for (let k = from + 1; k < r.length; k++) { if (up < 0 && r[k].eye[2] > z0 + 0.01) up = k - 1; if (up >= 0 && r[k].eye[2] <= z0 + 0.01) return (k - up) * dt; } return NaN; },
  air_dist: (r, dt, [from]) => { const z0 = r[from].eye[2]; let up = -1; for (let k = from + 1; k < r.length; k++) { if (up < 0 && r[k].eye[2] > z0 + 0.01) up = k - 1; if (up >= 0 && r[k].eye[2] <= z0 + 0.01) return Math.hypot(r[k].eye[0] - r[up].eye[0], r[k].eye[1] - r[up].eye[1]); } return NaN; },
  // feet: eye minus the standing view before the jump, minus the ducked view at the peak (fully ducked by then)
  feet_peak: (r, dt, [from]) => (Math.max(...r.slice(from).map(x => x.eye[2])) - DUCK_VIEW) - (r[from].eye[2] - STAND_VIEW),
  speed_before_land: (r, dt, [from]) => { const z0 = r[from].eye[2]; let up = -1; for (let k = from + 1; k < r.length; k++) { if (up < 0 && r[k].eye[2] > z0 + 0.01) up = k; if (up >= 0 && r[k].eye[2] <= z0 + 0.01) return hspeed(r, k - 1, dt); } return NaN; },
  // dv/dt medians over a speed band: robust to the original's sub-tick sampling phase
  accel_band: (r, dt, [from, lo, hi]) => median(range(from + 2, r.length - 1).filter(k => { const v = hspeed(r, k, dt); return v >= lo && v <= hi && hspeed(r, k + 1, dt) > v; }).map(k => (hspeed(r, k + 1, dt) - hspeed(r, k, dt)) / dt)),
  decel_band: (r, dt, [from, lo, hi]) => median(range(from + 2, r.length - 1).filter(k => { const v = hspeed(r, k, dt); return v >= lo && v <= hi && hspeed(r, k + 1, dt) < v; }).map(k => (hspeed(r, k, dt) - hspeed(r, k + 1, dt)) / dt)),
  decel_rel: (r, dt, [from, lo, hi]) => median(range(from + 2, r.length - 1).filter(k => { const v = hspeed(r, k, dt); return v >= lo && v <= hi && hspeed(r, k + 1, dt) < v; }).map(k => (hspeed(r, k, dt) - hspeed(r, k + 1, dt)) / dt / hspeed(r, k, dt))),
  // Fit z = a t² + b t + c to the airborne samples more than 2 units over the take-off height (so the first and last,
  // sub-tick-blended samples are left out); airtime is the distance between the roots at the take-off height.
  air_fit_t: (r, dt, [from]) => airFit(r, dt, from).t,
  air_fit_g: (r, dt, [from]) => airFit(r, dt, from).g,
  air_fit_dist: (r, dt, [from]) => { const f = airFit(r, dt, from); return f.t * median(f.ks.map(k => hspeed(r, k, dt))); },
  // teleports: the first tick the eye jumps more than 48 units
  entry_speed: (r, dt) => { const k = tpIndex(r); return k > 2 ? spd3(r, k - 1, dt) : NaN; },
  exit_speed: (r, dt) => { const k = tpIndex(r); return k > 0 && k + 2 < r.length ? spd3(r, k + 2, dt) : NaN; },
  exit_vz: (r, dt) => { const k = tpIndex(r); return k > 0 && k + 2 < r.length ? vz(r, k + 2, dt) : NaN; },
  exit_rise: (r, dt) => { const k = tpIndex(r); return k > 0 ? Math.max(...r.slice(k).map(x => x.eye[2])) - r[k].eye[2] : NaN; },
  exit_drift: (r, dt, [axis, ticks]) => { const k = tpIndex(r); return k > 0 && k + ticks < r.length ? r[k + ticks].eye[axis] - r[k].eye[axis] : NaN; },
  gravity: (r, dt, [a, b]) => median(range(a, b).map(k => -(vz(r, k, dt) - vz(r, k - 1, dt)) / dt)),
};
function metrics(sc, r, side) {
  const dt = DT[side], m = {};
  for (const [k, [fn, ...args]] of Object.entries(sc.metrics || {})) { const v = METRICS[fn](r, dt, args, m); m[k] = Number.isFinite(v) ? +v.toFixed(3) : null; }
  return m;
}

// ---- runners --------------------------------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));
// pitch/yaw from an eye 64 units over the feet at `from` to the point `at`
const aimAt = (from, at) => { const d = [at[0] - from[0], at[1] - from[1], at[2] - from[2] - 64]; return [+(-Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI).toFixed(3), +(Math.atan2(d[1], d[0]) * 180 / Math.PI).toFixed(3)]; };
async function runOrig(sc) {
  const o = await import('./oracle-ctl.mjs');
  if ((await o.currentMap()) !== sc.map) await o.map(sc.map);
  const at = {}; for (const [t, c] of sc.events) (at[t] ||= []).push(c);
  // Every button released first so a previous run can't leak into this one.
  const reset = ['-forward', '-back', '-moveleft', '-moveright', '-jump', '-duck', '-attack', '-attack2', '-use'];
  const setup = ['unpause', ...reset, ...(sc.orig_setup || []), `setpos ${sc.pos.join(' ')}`, `setang ${sc.ang[0]} ${sc.ang[1]} 0`];
  if (sc.portals) {
    await o.con(['unpause', 'give weapon_portalgun', 'upgrade_portalgun']);
    for (const p of sc.portals) { const a = aimAt(p.from, p.at);
      await o.con([...reset, `setpos ${p.from.join(' ')}`, `setang ${a[0]} ${a[1]} 0`]); await sleep(900);
      await o.con([p.color === 'blue' ? '+attack' : '+attack2']); await sleep(250); await o.con(['-attack', '-attack2']); await sleep(700); }
  }
  let rows, res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await o.trace(`${sc.name}`, sc.ticks, setup, at, sc.settle ?? 40);
    rows = fs.readFileSync(res.file, 'utf8').trim().split('\n').map(JSON.parse);
    // the run only counts if the player was where the scenario put them when it started
    const e = rows[0].eye; if (Math.abs(e[0] - sc.pos[0]) < 1 && Math.abs(e[1] - sc.pos[1]) < 1 && (sc.settle === 0 || Math.abs(e[2] - sc.pos[2] - 64) < 1.5)) break;
    console.error(`${sc.name}: started at ${e.join(' ')}, retrying`); rows = null;
  }
  if (!rows) throw new Error(`${sc.name}: player not at the start position after 3 tries`);
  const meta = JSON.parse(fs.readFileSync(res.file.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
  writeRun('orig', sc.name, rows, meta);
  return rows;
}

function ctl(sock, script) {
  const p = spawnSync('node', [path.join(ROOT, 'tools/portal-ctl.mjs'), '--attach', sock, 'script', '-'], { input: script, encoding: 'utf8', maxBuffer: 64 << 20 });
  const lines = p.stdout.trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
  const bad = lines.find(l => l.ok === false); if (bad || p.status) throw new Error('portal-ctl: ' + JSON.stringify(bad || lines.slice(-1)[0] || p.stderr.slice(-300)));
  return lines;
}

function runPort(sc, sock, curMap) {
  const spec = { ticks: sc.ticks, settle: sc.settle ?? 40, events: sc.events, port_setup: sc.port_setup || null };
  // One eval runs the whole thing so the trace isn't slowed by a round trip per tick. Inputs are applied the way
  // the original's are: at tick t the events run, then the tick, then the sample.
  const js = `(() => { const g = window.game, T = 1 / 66, S = ${JSON.stringify(spec)}; const b = new Set(); const out = [];
    const inp = () => ({ fwd: (b.has('forward') ? 1 : 0) - (b.has('back') ? 1 : 0), side: (b.has('moveright') ? 1 : 0) - (b.has('moveleft') ? 1 : 0), jump: b.has('jump'), duck: b.has('duck') });
    for (let k = 0; k < S.settle; k++) g.step(T, inp());
    for (let k = 0; k <= S.ticks; k++) { for (const [t, c] of S.events) if (t === k) { const n = c.slice(1); if (c[0] === '+') { b.add(n); if (n === 'attack') g.game.shootPortal(0); if (n === 'attack2') g.game.shootPortal(1); if (n === 'use') g.game.use(); } else b.delete(n); }
      g.step(T, inp()); const e = g.pl.eye(); out.push({ tick: k, t: +(k * T).toFixed(4), eye: e.map(v => +v.toFixed(3)), feet: g.pl.pos.map(v => +v.toFixed(3)), vel: g.pl.vel.map(v => +v.toFixed(2)), ground: !!g.pl.onGround, ducked: !!g.pl.ducked }); }
    return out; })()`;
  const prep = (sc.portals || []).flatMap(p => [`pose ${p.from.join(' ')} 0 0`, 'noclip off', `lookat ${p.at.join(' ')}`, 'step 2', `shoot ${p.color}`, 'lookat off']);
  const script = [curMap === sc.map && !sc.portals ? '' : `map ${sc.map}`, 'set showViewModel off', ...prep, `pose ${sc.pos.join(' ')} ${sc.ang[0]} ${sc.ang[1]}`, 'noclip off', `eval ${js.replace(/\n\s*/g, ' ')}`].filter(Boolean).join('\n') + '\n';
  const lines = ctl(sock, script); const ev = lines.find(l => l.cmd === 'eval');
  const rows = ev.value;
  writeRun('port', sc.name, rows, { name: sc.name, dt: 1 / 66, when: new Date().toISOString() });
  return rows;
}

// ---- main -----------------------------------------------------------------------------------------------------
const [cmd, file, ...rest] = process.argv.slice(2);
if (!cmd || !file) { console.log('usage: parity orig|port|compare|reference|check FILE [--attach SOCK] [NAME...]'); process.exit(2); }
const spec = load(path.resolve(file));
const ai = rest.indexOf('--attach'); const sock = ai >= 0 ? rest.splice(ai, 2)[1] : null;
const pick = spec.scenarios.filter(s => !rest.length || rest.includes(s.name));
const refFile = path.join(ROOT, 'checks/reference', path.basename(file));

if (cmd === 'orig') {
  for (const sc of pick) { const r = await runOrig(sc); console.log(JSON.stringify({ scenario: sc.name, side: 'orig', samples: r.length, ...metrics(sc, r, 'orig') })); }
} else if (cmd === 'port' || cmd === 'check') {
  if (!sock) { console.error('--attach SOCK needed'); process.exit(2); }
  const ref = cmd === 'check' ? load(refFile) : null; let fails = 0, cur = null;
  for (const sc of pick) {
    const r = runPort(sc, sock, cur); cur = sc.map; const m = metrics(sc, r, 'port');
    if (!ref) { console.log(JSON.stringify({ scenario: sc.name, side: 'port', samples: r.length, ...m })); continue; }
    for (const [k, v] of Object.entries(m)) { const want = ref.metrics[k]; if (!want) continue;
      const ok = v != null && Math.abs(v - want.value) <= want.tol; if (!ok) fails++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${sc.name}.${k} port=${v} original=${want.value} tol=${want.tol}${want.note ? ' (' + want.note + ')' : ''}`); }
  }
  if (ref) { console.log(fails ? `parity: ${fails} metric(s) off` : 'parity: all metrics within tolerance'); process.exit(fails ? 1 : 0); }
} else if (cmd === 'compare') {
  console.log('metric'.padEnd(28) + 'original'.padStart(10) + 'port'.padStart(10) + 'diff'.padStart(9));
  for (const sc of pick) { const o = readRun('orig', sc.name), p = readRun('port', sc.name); const mo = o ? metrics(sc, o, 'orig') : {}, mp = p ? metrics(sc, p, 'port') : {};
    for (const k of Object.keys(sc.metrics || {})) { const a = mo[k], b = mp[k]; console.log(`${sc.name}.${k}`.padEnd(28) + String(a ?? '-').padStart(10) + String(b ?? '-').padStart(10) + (a != null && b != null ? (b - a >= 0 ? '+' : '') + (b - a).toFixed(3) : '').padStart(9)); } }
} else if (cmd === 'reference') {
  const old = fs.existsSync(refFile) ? load(refFile) : { metrics: {} }; const out = { about: `Measured in the original Portal by tools/parity.mjs orig ${path.relative(ROOT, file)}. Values are what the original did; tol is how far the port may be off. Notes say when a value is derived rather than read directly.`, build: null, settings: null, metrics: {} };
  for (const sc of pick) { const o = readRun('orig', sc.name); if (!o) continue; const meta = JSON.parse(fs.readFileSync(path.join(RUNS, 'orig', sc.name + '.meta.json'), 'utf8'));
    out.build ||= meta.build; out.settings ||= { host_framerate: 0.015, tick: 0.015, sampler: 'getpos once per tick. It reports the client view of the eye position (cl_smooth 0 during runs), blended between ticks, so times are good to about a tick; rates, speeds and heights are medians or fits. One sample per tick checked by a free fall (0.135 units per tick squared = 600 u/s²).', cvars_after_run: meta.cvars, window: meta.size };
    const m = metrics(sc, o, 'orig'); for (const [k, v] of Object.entries(m)) { const prev = old.metrics[k] || {}; out.metrics[k] = { value: v, tol: prev.tol ?? defaultTol(k, v), scenario: sc.name, ...(prev.note ? { note: prev.note } : {}) }; } }
  fs.mkdirSync(path.dirname(refFile), { recursive: true }); fs.writeFileSync(refFile, JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify({ wrote: refFile, metrics: Object.keys(out.metrics).length }));
} else { console.error('unknown command ' + cmd); process.exit(2); }

// Tolerances: times get two ticks (the original's samples are blended between ticks), rates 3%, speeds 1%.
function defaultTol(k, v) { const r = x => +x.toFixed(3); if (/_t$|_t90|time/.test(k)) return 0.035; if (/accel|decel/.test(k)) return r(Math.abs(v) * 0.03); if (/fric_rel/.test(k)) return 0.25;
  if (/speed/.test(k)) return r(Math.max(1, Math.abs(v) * 0.01)); if (/gravity|_g$/.test(k)) return 6; if (/dist/.test(k)) return r(Math.max(1, Math.abs(v) * 0.02)); return r(Math.max(0.5, Math.abs(v) * 0.02)); }
