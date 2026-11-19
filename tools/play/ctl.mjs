// Writes a portal-ctl script that plays a chamber with the autopilot inside the deterministic harness (fixed ticks,
// seeded random, no real-time page loop): map, real physics, then tools/autopilot.js and tools/play/MAP.js evaluated
// in the page. A watchdog wraps game.step and throws (the chamber scripts catch it and log ERROR with the last
// position and autopilot lines) after MAX_GAME_S of game time or MAX_WALL_S of real time, so a stuck route can't hold
// a serve session forever. Usage: node tools/play/ctl.mjs testchmb_a_03 [PRE_JS] > /tmp/a03.ctl; portal-ctl script /tmp/a03.ctl
// Env: MAX_GAME_S (default 400), MAX_WALL_S (default 300).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [map, pre = ''] = process.argv.slice(2); const dir = import.meta.dirname;
if (!map) { process.stderr.write('usage: node tools/play/ctl.mjs MAP [PRE_JS]\n'); process.exit(2); }
const js = f => readFileSync(join(dir, f), 'utf8');
const ev = code => 'eval (0, eval)(' + JSON.stringify(code) + ')';
const maxGame = +(process.env.MAX_GAME_S || 400), maxWall = +(process.env.MAX_WALL_S || 300);
const watchdog = `(() => { const g = window.game, s0 = g.step.bind(g), t0 = performance.now(); let n = 0; window.__deadline = t0 + ${maxWall} * 1000;
  g.step = (dt, inp) => { if (++n % 66 === 0) window.__last = { t: +g.game.io.time.toFixed(1), pos: g.pl.pos.map(v => v | 0), ap: window.AP ? AP.LOG.slice(-2) : [] };
    if (n > ${maxGame} * 66 || performance.now() - t0 > ${maxWall} * 1000) throw new Error('watchdog: ' + n + ' ticks, ' + ((performance.now() - t0) / 1000 | 0) + ' s; last ' + JSON.stringify(window.__last));
    return s0(dt, inp); }; })(); 1`;
process.stdout.write([`map ${map}`, 'noclip off', 'set showViewModel off', ev(js('../autopilot.js') + '; 1'), ev(watchdog), pre ? ev(pre + '; 1') : '',
  ev(js(map + '.js')), 'state', 'eval ({ changedTo: window.changedTo || null, t: +window.game.io.time.toFixed(1) })', 'errors'].filter(Boolean).join('\n') + '\n');
