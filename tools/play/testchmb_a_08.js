(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
const tele = () => G.stats.teleports; const IN = (fwd, jump = false) => ({ fwd, side: 0, jump, duck: false });
const idle = n => { for (let i = 0; i < n; i++) game.step(1/66, IN(0)); };
const through = (aim, max = 400) => { const n0 = tele(); for (let i = 0; i < max && tele() === n0; i++) { game.pl.ang = [0, Math.atan2(aim[1] - game.pl.pos[1], aim[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(1)); } idle(60); return tele() - n0 + ' at ' + P(); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// chamber 13: the start-room floor button opens a door high in the main room's west wall, over the button's grating roof.
// Stand on it, shoot blue through that door into the main room, orange on a start-room wall, step off and walk through.
lg('to button a', AP.reach(F('floor_buttona_trigger_player_lvl7'), 10)); AP.wait(1.2);
const eye = G.player.eye(); const d = [-272 - eye[0], 78 - eye[1], 300 - eye[2]];
let bl = 'none'; for (const k of [3, 4, 6, 2.5]) { const t = [eye[0] + d[0] * k, eye[1] + d[1] * k, eye[2] + d[2] * k]; bl = shoot(0, t); if (G.gunPortals[0].open && G.gunPortals[0].pos[0] > -260) break; }
lg('blue through door', bl + ' ' + io.log.filter(l => /portal 0 failed/.test(l)).slice(-1));
lg('orange start wall', shoot(1, [-600, 25, 190]));
lg('through', through([-600, 25, 190]));
// the wall launcher fires along -x at y 192, z 169. Orange where it hits the west wall, blue on the ceiling above the floor
// catcher (Maker_balltrap_lvl7 spawns it mouth up at about (85,14)), so the ball comes straight down into it.
const L = E('energy_ball_launcher_lvl7'); G.tr.ignore = null; const ht = G.tr.trace(L.origin || L.pos, [(L.origin || L.pos)[0] - 3000, (L.origin || L.pos)[1], (L.origin || L.pos)[2]], [0,0,0], [0,0,0], 0x1, null);
lg('ball path hits', ht.end.map(v => v|0));
const trap = E('ball_trap_10'); const tc = [(trap.bmins[0] + trap.bmaxs[0]) / 2, (trap.bmins[1] + trap.bmaxs[1]) / 2]; lg('trap', tc.map(v => v|0));
lg('blue ceiling', shoot(0, [tc[0], tc[1], 400]));
let o = 'none'; for (const t of [ht.end, [ht.end[0], ht.end[1], ht.end[2] + 10], [ht.end[0], ht.end[1] - 10, ht.end[2]]]) { o = shoot(1, t); if (G.gunPortals[1].open && Math.abs(G.gunPortals[1].pos[1] - 192) < 30 && G.gunPortals[1].pos[0] < -200) break; }
lg('orange ball wall', o + ' ' + io.log.filter(l => /portal 1 failed/.test(l)).slice(-1));
const caught = () => io.log.some(l => /start_track_logic_lvl7/.test(l));
for (let i = 0; i < 66 * 30 && !caught(); i++) game.step(1/66, IN(0));
lg('caught', caught() + ' balls ' + G.balls.map(b => b.pos.map(v => v|0)).join(' '));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.slice(-6).join('\n'));
return out.join('\n'); })()
