(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
const tele = () => G.stats.teleports; const IN = (fwd, jump = false) => ({ fwd, side: 0, jump, duck: false });
const idle = n => { for (let i = 0; i < n; i++) game.step(1/66, IN(0)); };
const through = (aim, max = 400) => { const n0 = tele(); for (let i = 0; i < max && tele() === n0; i++) { game.pl.ang = [0, Math.atan2(aim[1] - game.pl.pos[1], aim[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(1)); } idle(60); return tele() - n0 + ' at ' + P(); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// chamber 13: the start-room floor button opens a door high in the main room's west wall, over the button's grating roof.
// The exit needs cubes on buttons b and c, on top of two pillars, and there are two cubes: one on the rail platform and one
// on the start room's grating roof (-470, 218, 256). Fetch that one first: orange on a start-room wall, blue on the wall
// above the roof, walk in, take the cube, drop down and put it on button a so the door stays open, shoot blue through the
// door onto the main-room ceiling, take the cube back and walk through orange with it.
const cubeA = G.cubes.filter(c => c.alive).sort((a, b) => b.pos[2] - a.pos[2])[0]; // the higher one, on the roof
lg('to button a', AP.reach(F('floor_buttona_trigger_player_lvl7'), 10)); AP.wait(1.2);
lg('orange start wall', shoot(1, [-600, 25, 190]));
lg('blue over roof', shoot(0, [-340, 218, 340]));
lg('onto roof', through([-600, 25, 190]) + ' roof cube ' + cubeA.pos.map(v => v|0));
// glass rails keep you on the roof, so leave by portal: blue low on the wall behind the roof (its bottom edge dips under the
// grating, so it can be walked into), cube in hand, out of orange in the start room.
{ let r = 'none'; for (const x of [-470, -420, -520, -380]) { r = shoot(0, [x, 255, 285]); const B = G.gunPortals[0]; if (B.open && B.pos[1] > 250 && B.pos[2] - 56 < 258) break; } lg('blue low behind roof', r); }
lg('pick roof cube', AP.pickUp(cubeA)); lg('held', !!G.held);
{ const B = G.gunPortals[0].pos; lg('off roof', through([B[0], B[1] + 40, B[2]]) + ' held ' + !!G.held); }
lg('roof cube on a', AP.placeCube(G.held || cubeA, C(E('floor_buttona_trigger_box_lvl7')))); AP.wait(1.5);
lg('door a', E('floor_buttona_door_rm7').state + ' cube ' + cubeA.pos.map(v => v|0));
// the cube sits where the player stood before, so step back to the button's west side and aim at the main-room ceiling
// through the door directly
AP.approach([-500, 75], 6, 3);
let bl = 'none'; for (const t of [[-128, 104, 383], [-150, 90, 383], [-110, 80, 383], [-170, 78, 383], [-100, 110, 383]]) { bl = shoot(0, t); if (G.gunPortals[0].open && G.gunPortals[0].pos[0] > -260) break; }
lg('blue through door', bl + ' ' + io.log.filter(l => /portal 0 failed/.test(l)).slice(-1));
lg('re-pick roof cube', AP.pickUp(cubeA)); lg('held', !!G.held);
if (window.DBG) { const n0 = tele(); let k = 0; for (let i = 0; i < 400 && k < 30; i++) { game.pl.ang = [0, Math.atan2(25 - game.pl.pos[1], -600 - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(tele() === n0 ? 1 : 0)); if (tele() > n0) { k++; out.push('dbg ' + P() + ' v ' + game.pl.vel.map(v => v|0) + ' g ' + game.pl.onGround + ' cube ' + cubeA.pos.map(v => v|0) + ' ang ' + game.pl.ang.map(v => v|0)); } } }
lg('through', through([-600, 25, 190]) + ' held ' + !!G.held);
for (let i = 0; i < 200 && !game.pl.onGround; i++) idle(1); lg('landed', P() + ' ground ' + game.pl.onGround + ' held ' + !!G.held + ' cube ' + cubeA.pos.map(v => v|0));
lg('park roof cube', AP.reach([-200, -40, 0], 20)); G.use(); AP.wait(1); lg('parked', cubeA.pos.map(v => v|0));
// The cube's platform (func_tracktrain_lvl7) stands on a pole at its west stop, top at z 170, with no-portal metal above it.
// Get up there with a fling: orange on the floor under the ceiling blue makes a fall loop; once falling fast, move blue to
// the floor just north of the platform and steer onto it on the way up. Landing there also trips the trigger_once that
// drops box_no_fall_off, the lip that keeps the cube on.
const tr = E('func_tracktrain_lvl7'); const cube = G.cubes.filter(c => c.alive && c !== cubeA)[0];
lg('step aside', AP.reach([-60, 60, 0], 12));
lg('orange under blue', shoot(1, [-133, 101, 0]));
const fl = window.FLING || [-60, -150, 0], PC = [-58, -272];
{ const O = G.gunPortals[1].pos; let shot = false, n1 = 0, vmax = 0, t0 = io.time, out1 = -1;
  for (let i = 0; i < 66 * 15; i++) { const v = game.pl.vel[2]; vmax = Math.max(vmax, -v);
    if (!shot && game.pl.pos[2] > 150 && v < -(window.FLINGV || 600)) { AP.lookAt(fl); G.shootPortal(0); shot = true; n1 = tele(); lg('moved blue', (G.gunPortals[0].open ? G.gunPortals[0].pos.map(v => v|0) : 'failed') + ' at v ' + (v|0) + ' t ' + (io.time - t0).toFixed(2)); }
    if (shot && out1 < 0 && tele() > n1) { out1 = i; lg('out of blue', P() + ' v ' + game.pl.vel.map(v => v|0)); }
    if (out1 >= 0) { // in the air out of blue: air-steer toward the platform's centre, then stop pushing over it
      const dx = PC[0] - game.pl.pos[0], dy = PC[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
      game.step(1/66, IN(Math.hypot(dx, dy) > 12 ? 1 : 0)); if (game.pl.onGround && i - out1 > 10) break; }
    else { const dx = O[0] - game.pl.pos[0], dy = O[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(1/66, IN(Math.hypot(dx, dy) > 6 ? 1 : 0)); } // keep over orange until it takes us
  }
  lg('fling', 'max fall ' + (vmax|0) + ' landed ' + P() + ' ground ' + (game.pl.groundEnt ? game.pl.groundEnt.name || game.pl.groundEnt.cls : '-') + ' nofall ' + E('box_no_fall_off').enabled); }
lg('pick cube', AP.pickUp(cube)); lg('held', !!G.held + ' cube ' + cube.pos.map(v => v|0));
// Walking off the edge with the cube at eye height snags it on the platform lip, so turn north slowly with the view pitched
// up (the cube rides above the lip) and jump off.
{ const y0 = game.pl.ang[1], y1 = 90; let d = ((y1 - y0 + 540) % 360) - 180; const n = Math.ceil(Math.abs(d) / 8) || 1;
  for (let k = 1; k <= n; k++) { game.pl.ang = [-40, y0 + d * k / n, 0]; idle(3); }
  let i = 0; for (; i < 240; i++) { game.pl.ang = [-40, 90, 0]; game.step(1/66, IN(1, i < 20)); if (i > 20 && game.pl.onGround && game.pl.pos[2] < 20) break; }
  idle(20); lg('hop off', P() + ' held ' + !!G.held + ' cube ' + cube.pos.map(v => v|0) + ' ' + io.log.filter(l => /snag|dropped/.test(l)).slice(-1)); }
const C2 = G.cubes.filter(c => c.alive && c !== cube)[0]; lg('cube2', C2 && C2.pos.map(v => v|0));
// Buttons b and c sit on top of pillars (b's pad at z 232, c's at 137). The ceiling over each takes a portal: blue there,
// orange low on a wall, walk into orange with the cube, drop out of the ceiling onto the pillar and leave the cube on the pad.
const lowWall = (near) => { for (const t of [[near[0], 383, 60], [near[0] + 120, 383, 60], [near[0] - 120, 383, 60], [near[0] + 220, 383, 60], [near[0] - 220, 383, 60]]) { const r = shoot(1, t); const O = G.gunPortals[1]; if (O.open && Math.abs(O.f[2]) < 0.1 && O.pos[2] < 90) return r; } return 'none'; };
const toPillar = (cb, btn, stand) => {
  lg(btn + ' stand', AP.reach(stand, 20)); lg(btn + ' carrying', !!G.held + ' cube ' + cb.pos.map(v => v|0) + ' ' + io.log.filter(l => /snag|dropped|dissolv/.test(l)).slice(-2)); G.held && G.use(); AP.wait(0.8);
  const top = C(E('floor_' + btn + '_trigger_box_lvl7'));
  lg(btn + ' blue ceiling', shoot(0, [top[0], top[1], 383])); lg(btn + ' orange wall', lowWall(stand));
  lg(btn + ' pick', AP.pickUp(cb)); const O = G.gunPortals[1].pos;
  lg(btn + ' in', through([O[0], O[1] + 40, O[2]]) + ' held ' + !!G.held);
  for (let i = 0; i < 200 && !game.pl.onGround; i++) idle(1);
  lg(btn + ' on pillar', P() + ' held ' + !!G.held); lg(btn + ' place', G.held ? AP.placeCube(G.held, top) : 'not held');
  lg(btn + ' door', E('floor_' + btn + '_door_rm7').state + ' cube ' + cb.pos.map(v => v|0)); };
toPillar(cube, 'buttonb', [-35, 150, 0]);
lg('off b', AP.reach([-35, 120, 0], 24));
toPillar(C2, 'buttonc', [285, 40, 0]);
lg('exit doors', E('exit_door_left_a08').state);
lg('to exit', AP.reach(F('a08_09_trigger_elevator_move'), 30));
AP.wait(40, () => window.changedTo || io.log.some(l => /changelevel/.test(l))); lg('end', P() + ' ' + (window.changedTo || ''));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.slice(-6).join('\n'));
return out.join('\n'); })()
