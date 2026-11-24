(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); const n0 = io.log.length; G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open && !io.log.slice(n0).some(l => /failed/.test(l)) ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + io.log.filter(l => /failed/.test(l)).slice(-1); };
const T = 1 / 66, idle = { fwd: 0, side: 0, jump: false, duck: false };
// fly: step until on the ground again (after at least `min` s), logging the highest and furthest points
const fly = (min = 0.3, max = 8) => { let top = -1e9; for (let k = 0; k < max * 66; k++) { game.step(T, idle); top = Math.max(top, game.pl.pos[2]); if (k > min * 66 && game.pl.onGround) break; } return P() + ' top ' + (top | 0); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun);
// the walkway out of the elevator ends over a goo pit. Blue on the ceiling over the far side (floor 256 there for
// x < 400), orange on the walkway floor under you: you drop in, out of the ceiling and down onto the far side
lg('walkway end', JSON.stringify(AP.gotoRetry([800, -192, 256], 12, 3)).slice(0, 80), P());
lg('blue far ceiling', shoot(0, [300, -170, 1023]));
lg('orange under you', shoot(1, [game.pl.pos[0] + 4, game.pl.pos[1], 256]));
lg('over the goo', fly(0.3), 'teleports ' + G.stats.teleports);
if (window.STAGE === 2) throw 'stage 2';
// up onto the 512 platform north of the strip: blue on the ceiling over it (z 1279), orange low on its south face
// (concrete, y 127) across the goo gap; a running jump off the strip's edge into the orange drops you out of the ceiling
// onto the platform
const runJump = (from, dir, edge, max = 3) => { AP.approach(from, 3, 3); const yaw = Math.atan2(dir[1], dir[0]) * 180 / Math.PI; const n0 = G.stats.teleports; let jumped = false;
  for (let k = 0; k < max * 66; k++) { game.pl.ang = [0, yaw, 0]; const s = (game.pl.pos[0] - from[0]) * dir[0] + (game.pl.pos[1] - from[1]) * dir[1]; const j = !jumped && s >= edge; if (j) jumped = true; game.step(T, { fwd: 1, side: 0, jump: j, duck: false }); if (G.stats.teleports > n0) break; }
  return G.stats.teleports > n0; };
lg('to strip', JSON.stringify(AP.gotoRetry([-8, -120, 256], 12, 3)).slice(0, 60), P());
lg('blue ceiling over 512', shoot(0, [-8, 300, 1279])); lg('orange pit wall', shoot(1, [-8, 127, 200]));
lg('jump in', runJump([-8, -140], [0, 1], 135), 'fall', fly(0.3));
if (window.STAGE === 3) throw 'stage 3';
// the same again up to the 768 platform in the north-east corner: blue on the ceiling over it (z 1535), orange under you
const under = which => { for (const d of [[0, 0], [-30, 0], [0, -30], [30, 0], [0, 30]]) { const r = shoot(which, [game.pl.pos[0] + d[0] + 2, game.pl.pos[1] + d[1], game.pl.pos[2]]); if (!/not placed/.test(r)) return r; } return 'not placed'; };
lg('blue ceiling over 768', shoot(0, [760, 280, 1535]));
{ const n0 = G.stats.teleports; lg('orange under you 2', under(1)); for (let k = 0; k < 66 && G.stats.teleports === n0; k++) game.step(T, idle); lg('fall 2', fly(0.3)); }
if (window.STAGE === 4) throw 'stage 4';
// across to the 1024 ledge in front of the exit door (x 48, z 1040..1110): blue on the west wall just above the door,
// orange under you again (from the platform's north end, where the wall is in sight); you come out over the ledge and
// drop onto it
AP.approach([760, 450], 4, 3); lg('blue over the exit door', shoot(0, [64, 672, 1250]));
{ const n0 = G.stats.teleports; lg('orange under you 3', under(1)); for (let k = 0; k < 66 && G.stats.teleports === n0; k++) game.step(T, idle); lg('fall 3', fly(0.3)); }
if (window.STAGE === 5) throw 'stage 5';
// to the box button's ledge (z 1152, x 750..850): blue on the panel high above the door (x 128, z 1474, facing east),
// orange on the 576 platform below the ledge's east edge; step off into it and you're thrown east out of the panel
lg('blue high panel', shoot(0, [128, 672, 1474])); AP.approach([375, 672], 4, 3); lg('orange 576 platform', shoot(1, [540, 672, 576]));
{ const n0 = G.stats.teleports; for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [0, 0, 0]; game.step(T, { fwd: game.pl.onGround ? 1 : 0, side: 0, jump: false, duck: false }); } lg('fling to button ledge', G.stats.teleports > n0, fly(0.3)); }
if (window.STAGE === 6) throw 'stage 6';
// the switch by the ledge (1136, 880) runs door_piston_wedge, which swings rotating_door_wedge open into the next room
lg('to switch', JSON.stringify(AP.gotoRetry([1100, 880, 1152], 16, 3)).slice(0, 60), P());
AP.lookAt([1136, 880, 1216]); AP.wait(0.2); G.use(); AP.wait(1.5); lg('switch', io.log.filter(l => /door_piston_wedge|rotating_door_wedge/.test(l)).slice(-3));
lg('into the wedge room', JSON.stringify(AP.gotoRetry([1392, 1232, 1152], 16, 3)).slice(0, 80), P());
if (window.STAGE === 7) throw 'stage 7';
// the shortcut (Portal Wiki / Prima): blue on the wedge's 45-degree face from the walkway, then step off the walkway's
// south end and put orange on the 576 platform under you while falling; ~580 units of fall come out of the wedge at 45
// degrees up and east, over the wall into the cube room (x 2600.., floor 1216)
lg('to wedge view', JSON.stringify(AP.gotoRetry([1560, 960, 1152], 16, 3)).slice(0, 60), P());
AP.approach([1580, 960], 3, 3); let bw = ''; for (const z of [1273, 1265, 1280, 1258]) { bw = shoot(0, [1412, 960, z]); if (!/not placed/.test(bw)) break; } lg('blue wedge', P(), bw);
lg('to walkway end', JSON.stringify(AP.gotoRetry([1440, 690, 1152], 16, 3)).slice(0, 60), P());
{ const n0 = G.stats.teleports; let shot = '';
  for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [0, -90, 0]; const air = !game.pl.onGround || game.pl.pos[2] < 1140; game.step(T, { fwd: !air ? 1 : game.pl.vel[1] < -20 ? -1 : 0, side: 0, jump: false, duck: false }); // air-brake once off the edge
    if (!shot && game.pl.pos[2] < 1000) { const v = game.pl.vel, g = 600, h = game.pl.pos[2] - 576, tl = (v[2] + Math.sqrt(v[2] * v[2] + 2 * g * h)) / g;
      const lx = game.pl.pos[0] + v[0] * tl, ly = game.pl.pos[1] + v[1] * tl; // nudged in from the platform's north edge (y 700) so it fits
      for (const d of [[0, 0], [0, -20], [0, -40], [10, -50]]) { shot = shoot(1, [lx + d[0], Math.min(ly, 650) + d[1], 576]); if (!/not placed/.test(shot)) break; } } }
  lg('orange under, falling', shot, 'through', G.stats.teleports > n0, 'vel', game.pl.vel.map(v => v | 0)); lg('fling', fly(0.3)); }
if (window.STAGE === 8) throw 'stage 8';
// landing in the cube room starts the scaffold (func_tracktrain_b00, x 1736..2336 along y 832, top z 1150). Take the
// nearer cube, hop down onto the scaffold at its east end, ride it west and hop off onto the walkway (1152, x < 1600)
const train = G.io.ents.find(e => e.cls === 'func_tracktrain' && e.kv.targetname === 'func_tracktrain_b00').col;
const until = (f, max = 30) => { for (let k = 0; k < max * 66 && !f(); k++) game.step(T, idle); return f(); };
{ const pp = game.pl.pos, cube = G.cubes.filter(c => c.alive && c.ent.name === 'box').sort((a, b) => Math.hypot(a.pos[0] - pp[0], a.pos[1] - pp[1]) - Math.hypot(b.pos[0] - pp[0], b.pos[1] - pp[1]))[0];
  lg('cube', cube && cube.pos.map(v => v | 0), JSON.stringify(AP.pickUp(cube)), 'held', !!G.held); }
AP.approach([2560, 832], 4, 3); lg('ledge edge', P(), 'train', train.offset.map(v => v | 0));
lg('train at east end', until(() => train.offset[0] > 2330), train.offset.map(v => v | 0));
// hop: run along dir, jump at `edge`, stop pushing once down again
const hop = (from, dir, edge, max = 2) => { AP.approach(from, 3, 3); const yaw = Math.atan2(dir[1], dir[0]) * 180 / Math.PI; let ph = 0;
  for (let k = 0; k < max * 66; k++) { game.pl.ang = [0, yaw, 0]; const s = (game.pl.pos[0] - from[0]) * dir[0] + (game.pl.pos[1] - from[1]) * dir[1]; const j = ph === 0 && s >= edge; if (j) ph = 1; else if (ph === 1 && !game.pl.onGround) ph = 2; else if (ph === 2 && game.pl.onGround) break;
    game.step(T, { fwd: ph < 2 ? 1 : 0, side: 0, jump: j, duck: false }); } return P(); };
lg('hop on', hop([2560, 832], [-1, 0], 30)); until(() => game.pl.onGround, 2); lg('on scaffold', P(), game.pl.groundEnt && game.pl.groundEnt.cls, 'held', !!G.held);
if (window.STAGE === 9) throw 'stage 9';
lg('ride west', until(() => train.offset[0] < 1745), P());
lg('hop off', hop([game.pl.pos[0], 832], [-1, 0], 25), 'held', !!G.held);
if (window.STAGE === 10) throw 'stage 10';
// back through the wedge room and the crawl space to the box button on the ledge (803, 674, 1156)
// back west under the pushed-out wedge (a clear lane along y 920 at standing height, x 1100..1440); the planner
// won't take it with the cube in hand, so walk it
const walkTo = (x, y, pitch = 20, max = 4) => { for (let k = 0; k < max * 66; k++) { const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1]; if (Math.hypot(dx, dy) < 6) break; game.pl.ang = [pitch, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); } return P(); };
lg('to lane', JSON.stringify(AP.gotoRetry([1440, 870, 1152], 16, 3)).slice(0, 60), P());
for (const w of [[1310, 870], [1290, 925], [1240, 925], [1180, 900], [1090, 900]]) walkTo(w[0], w[1]);
for (let k = 0; k < 20; k++) game.step(T, idle); lg('through', P(), 'held', !!G.held, G.cubes.filter(c => c.alive).map(c => c.pos.map(v => v | 0)));
{ const cube = G.held; lg('to button', JSON.stringify(cube ? AP.placeCube(cube, [803, 674, 1156]) : 'no cube'), P(), cube && cube.pos.map(v => v | 0));
  lg('button', G.io.log.filter(l => /button|door_b00|exit/i.test(l)).slice(-4)); }
if (window.STAGE === 11) throw 'stage 11';
// out through the open exit door (x 48, y 612..668): blue low on the door wall (x 64, faces east), hop down onto the
// 576 platform, orange on the floor beside you and walk into it; you come out of the wall over the 1024 ledge
{ let r = ''; for (const z of [1230, 1250, 1280]) { r = shoot(0, [64, 690, z]); if (!/not placed/.test(r)) break; } lg('blue door wall', r); }
lg('round the cube', JSON.stringify(AP.gotoRetry([735, 625, 1152], 12, 3)).slice(0, 50), P()); for (let k = 0; k < 4 * 66; k++) { game.pl.ang = [0, 180, 0]; const vx = game.pl.vel[0]; if (game.pl.onGround && game.pl.pos[2] < 600) break;
  game.step(T, { fwd: game.pl.pos[0] > 560 ? 1 : vx < -40 ? -1 : 0, side: 0, jump: false, duck: false }); } // walk off, brake over the platform
lg('step down', P());
{ let r = ''; for (const d of [-70, -90, 70]) { r = shoot(1, [game.pl.pos[0] + d, 660, 576]); if (!/not placed/.test(r)) break; } lg('orange beside', P(), r);
  const n0 = G.stats.teleports, tx = G.gunPortals[1].pos[0];
  for (let k = 0; k < 3 * 66 && G.stats.teleports === n0; k++) walkTo(tx, 665, 20, 1 / 66);
  lg('through', G.stats.teleports > n0, fly(0.2)); }
lg('out the door', JSON.stringify(AP.gotoRetry([-60, 640, 1024], 16, 3)).slice(0, 80), P());
if (window.STAGE === 12) throw 'stage 12';
// the climb to the elevator (x -1536, z 3414): portal-bounce up the shaft's platforms. You exit a floor portal going up
// as fast as you went in, so swapping the other portal onto the next, higher platform while you fall back each time
// gains that platform's height (the wiki's 'do this two more times'); the last exit is the angled panel, which throws
// you onto the 3328 ledge by the elevator
lg('drop down', JSON.stringify(AP.gotoRetry([-820, 600, 896], 16, 3)).slice(0, 60), P());
const shootAny = (which, spots) => { let r = 'none'; for (const t of spots) { r = shoot(which, t); if (!/not placed/.test(r)) return r; } return r; };
const P1 = [[-1344, 640, 896], [-1350, 620, 896], [-1340, 660, 896]];
const P2 = [[-2060, 650, 1536], [-2048, 704, 1536], [-2100, 600, 1536], [-2080, 640, 1536], [-2112, 576, 1536]];
const P3 = [[-2520, 576, 1920], [-2496, 576, 1920], [-2560, 576, 1920], [-2530, 600, 1920]];
const P4 = [[-2020, 0, 2432], [-2048, -40, 2432], [-2048, 40, 2432], [-1990, 0, 2432]];
const PAN = [[-1160, 754, 3057], [-1184, 754, 3057], [-1130, 754, 3057], [-1210, 756, 3059]]; // the slope is only ~119 long: centre it
AP.approach([-820, 588], 3, 3); lg('blue P1', shootAny(0, P1)); lg('orange pit', shootAny(1, [[-820, 370, -256], [-820, 350, -256], [-820, 390, -256]]));
{ const n0 = G.stats.teleports; for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [30, -90, 0]; game.step(T, { fwd: game.pl.onGround ? 1 : 0, side: 0, jump: false, duck: false }); } lg('into the pit portal', G.stats.teleports > n0, P(), game.pl.vel.map(v => v | 0)); }
// rise, and at the top put `which` on the next platform; then fall through the portal under you
const bounce = (which, spots, name) => { let top = 0; for (let k = 0; k < 6 * 66 && game.pl.vel[2] > 0; k++) { game.step(T, idle); top = Math.max(top, game.pl.pos[2]); }
  const r = shootAny(which, spots); const n0 = G.stats.teleports; for (let k = 0; k < 6 * 66 && G.stats.teleports === n0 && !game.pl.onGround; k++) game.step(T, idle);
  lg(name, 'top', top | 0, r, 'through', G.stats.teleports > n0, P(), game.pl.vel.map(v => v | 0)); };
// every exit is ~1175 u/s (each fall is the same 1152), so P4 isn't needed: from the top over P3 the panel is nearly due
// east, which lays the portal along the panel's length
bounce(1, P2, 'orange P2'); bounce(0, P3, 'blue P3'); bounce(1, PAN, 'orange panel');
lg('fling', fly(0.3));
if (window.STAGE === 13) throw 'stage 13';
lg('to elevator', JSON.stringify(AP.gotoRetry(F('a14_a15_trigger_elevator_close'), 40, 4)).slice(0, 160));
AP.wait(40, () => window.changedTo); lg('changedTo', window.changedTo + ' pos ' + P());
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
