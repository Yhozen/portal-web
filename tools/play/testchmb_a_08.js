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
// The cube's platform (func_tracktrain_lvl7) stands on a pole at its west stop, top at z 170, with no-portal metal above it.
// Get up there with a fling: orange on the floor under the ceiling blue makes a fall loop; once falling fast, move blue to
// the floor just north of the platform and steer onto it on the way up. Landing there also trips the trigger_once that
// drops box_no_fall_off, the lip that keeps the cube on.
const tr = E('func_tracktrain_lvl7'); const cube = G.cubes.filter(c => c.alive)[0];
lg('step aside', AP.reach([-60, 60, 0], 12));
lg('orange under blue', shoot(1, [-133, 101, 0]));
const fl = window.FLING || [-58, -186, 0];
{ const O = G.gunPortals[1].pos; let shot = false, vmax = 0, t0 = io.time;
  for (let i = 0; i < 66 * 12; i++) { const v = game.pl.vel[2]; vmax = Math.max(vmax, -v);
    if (!shot && game.pl.pos[2] > 200 && v < -(window.FLINGV || 900)) { AP.lookAt(fl); G.shootPortal(0); shot = true; lg('moved blue', (G.gunPortals[0].open ? G.gunPortals[0].pos.map(v => v|0) : 'failed') + ' at v ' + (v|0) + ' t ' + (io.time - t0).toFixed(2)); }
    const up = shot && G.gunPortals[0].pos[2] < 10 && Math.abs(game.pl.pos[0] - fl[0]) < 80 && Math.abs(game.pl.pos[1] - fl[1]) < 120;
    if (up) { game.pl.ang = [0, -90, 0]; game.step(1/66, IN(game.pl.vel[2] < 300 ? 1 : 0)); if (game.pl.onGround && io.time - t0 > 1) break; }
    else { if (!shot) game.pl.ang = [0, Math.atan2(O[1] - game.pl.pos[1], O[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(shot ? 0 : 1)); }
  }
  lg('fling', 'max fall ' + (vmax|0) + ' landed ' + P() + ' ground ' + (game.pl.groundEnt ? game.pl.groundEnt.name || game.pl.groundEnt.cls : '-') + ' nofall ' + E('box_no_fall_off').enabled); }
lg('pick cube', AP.pickUp(cube)); lg('held', !!G.held + ' cube ' + cube.pos.map(v => v|0));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.slice(-6).join('\n'));
return out.join('\n'); })()
