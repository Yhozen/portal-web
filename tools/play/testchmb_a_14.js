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
// the switch by the ledge (1136, 880) runs door_piston_wedge, which pushes rotating_door_wedge out into the turret
// room and swings it to 45 degrees. The wedge has wait 9: it's fully over 4.5 s after the press and starts back at 13.3
// (doors.cpp DoorHitTop), and the piston follows it in, so the shortcut has to be quick: under the wedge along the lane
// it opens (y 870..925), blue on its face from the walkway, then off the walkway's south end with orange under you
const walkTo = (x, y, pitch = 20, max = 4) => { for (let k = 0; k < max * 66; k++) { const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1]; if (Math.hypot(dx, dy) < 6) break; game.pl.ang = [pitch, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); } return P(); };
lg('to switch', JSON.stringify(AP.gotoRetry([1100, 880, 1152], 16, 3)).slice(0, 60), P());
const wedge = io.ents.find(e => e.name === 'rotating_door_wedge');
const piston = io.ents.find(e => e.name === 'door_piston_wedge');
walkTo(1120, 880, 10, 2);
for (let i = 0; i < 5 && !(piston.t > 0.05); i++) { AP.lookAt([1136, 880, 1216]); AP.wait(0.15); G.use(); AP.wait(0.4); }
const tsw = io.time; lg('switch', 't=' + (piston.t || 0).toFixed(2), io.log.filter(l => /door_piston_wedge|rotating_door_wedge|button|press|use/.test(l)).slice(-4));
AP.wait(6, () => piston.t >= 0.999); lg('piston out', (io.time - tsw).toFixed(1), 't=' + (piston.t || 0).toFixed(2));
for (const w of [[1095, 920], [1440, 920], [1440, 850], [1530, 850], [1580, 960]]) walkTo(w[0], w[1], 0, 2);
lg('on the walkway', P(), (io.time - tsw).toFixed(1));
if (window.STAGE === 7) throw 'stage 7';
// ~580 units of fall come out of the wedge at 45 degrees up and east, over the wall into the cube room (x 2600..)
AP.approach([1580, 960], 3, 1); let bw = ''; for (const z of [1273, 1265, 1280, 1258]) { bw = shoot(0, [1412, 960, z]); if (!/not placed/.test(bw)) break; } lg('blue wedge', P(), bw, (io.time - tsw).toFixed(1));
for (const w of [[1470, 760], [1440, 712]]) walkTo(w[0], w[1], 0, 2);
lg('walkway end', P(), (io.time - tsw).toFixed(1));
{ const n0 = G.stats.teleports; let shot = '';
  for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [0, -90, 0]; const air = !game.pl.onGround || game.pl.pos[2] < 1140; game.step(T, { fwd: !air ? 1 : game.pl.vel[1] < -20 ? -1 : 0, side: 0, jump: false, duck: false }); // air-brake once off the edge
    if (!shot && game.pl.pos[2] < 1000) { const v = game.pl.vel, g = 600, h = game.pl.pos[2] - 576, tl = (v[2] + Math.sqrt(v[2] * v[2] + 2 * g * h)) / g;
      const lx = game.pl.pos[0] + v[0] * tl, ly = game.pl.pos[1] + v[1] * tl; // nudged in from the platform's north edge (y 700) so it fits
      for (const d of [[0, 0], [0, -20], [0, -40], [10, -50]]) { shot = shoot(1, [lx + d[0], Math.min(ly, 650) + d[1], 576]); if (!/not placed/.test(shot)) break; } } }
  lg('orange under, falling', shot, 'through', G.stats.teleports > n0, 'vel', game.pl.vel.map(v => v | 0), (io.time - tsw).toFixed(1)); lg('fling', fly(0.3)); }
if (window.STAGE === 8) throw 'stage 8';
// the cube comes back the way the wiki's main route brings it: down behind switch3, into the low room under the cube
// room's west edge (z 896). The wedge has gone back by now and the piston with it, which shuts the lane under the wedge.
// Put the cube down (firing drops it anyway), orange low on the turret room's west wall just over the walkway (x 1280,
// y 1088), blue in the alcove at the top of the two 32-unit steps on the room's north side (y 1088), press the switch
// (it runs the piston and wedge again), pick the cube up and duck-jump up the steps into blue; out onto the walkway,
// and west along the lane once the piston's out
const until = (f, max = 30) => { for (let k = 0; k < max * 66 && !f(); k++) game.step(T, idle); return f(); };
const nearestCube = () => { const pp = game.pl.pos; return G.cubes.filter(c => c.alive && c.ent.name === 'box').sort((a, b) => Math.hypot(a.pos[0] - pp[0], a.pos[1] - pp[1]) - Math.hypot(b.pos[0] - pp[0], b.pos[1] - pp[1]))[0]; };
lg('cube', nearestCube() && nearestCube().pos.map(v => v | 0), JSON.stringify(AP.pickUp(nearestCube())), 'held', !!G.held);
AP.approach([2530, 880], 3, 3);
for (let k = 0; k < 3 * 66; k++) { game.pl.ang = [0, 180, 0]; const air = !game.pl.onGround; if (!air && game.pl.pos[2] < 1000) break; game.step(T, { fwd: !air ? 1 : game.pl.vel[0] < 30 ? -1 : 0, side: 0, jump: false, duck: false }); } // off the edge, then back east under it
until(() => game.pl.onGround, 2); lg('behind the switch', P(), 'held', !!G.held);
if (window.STAGE === 9) throw 'stage 9';
AP.approach([2560, 900], 4, 2); if (G.held) { AP.lookAt([2600, 900, 896]); AP.wait(0.2); G.use(); AP.wait(0.8); }
{ let r = ''; for (const t of [[1280, 1088, 1210], [1280, 1080, 1215], [1280, 1070, 1220]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange over the walkway', r); }
{ let r = ''; for (const t of [[2688, 1088, 1010], [2680, 1088, 1014], [2696, 1088, 1014]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue in the alcove', r); }
const piston2 = io.ents.find(e => e.name === 'door_piston_wedge');
AP.approach([2550, 930], 4, 2); AP.lookAt([2512, 944, 976]); AP.wait(0.2); G.use(); const ts3 = io.time; AP.wait(0.2);
lg('switch3', io.log.filter(l => /door_piston_wedge|rotating_door_wedge/.test(l)).slice(-2));
lg('repick', JSON.stringify(AP.pickUp(nearestCube())), 'held', !!G.held, (io.time - ts3).toFixed(1));
walkTo(2688, 960, 0, 3); game.pl.ang = [0, 90, 0]; AP.approach([2688, 990], 3, 2);
// two 32-unit steps: a ducked jump clears each, and the duck has to come off (0.2 s) before the next jump
{ const n0 = G.stats.teleports; let jt = -99;
  for (let k = 0; k < 5 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [-35, 90, 0]; // looking up keeps the held cube clear of the steps
    const pl = game.pl, j = pl.onGround && !pl.ducked && !pl.ducking && k - jt > 15;
    if (j) jt = k; game.step(T, { fwd: 1, side: (2688 - pl.pos[0]) / 30, jump: j, duck: k - jt > 1 && k - jt < 22 }); }
  lg('through to the walkway', G.stats.teleports > n0, P(), 'cube ' + (G.held ? G.held.pos.map(v => v | 0) : '-'), fly(0.2), 'held', !!G.held, (io.time - ts3).toFixed(1)); }
AP.wait(6, () => piston2.t >= 0.999); lg('piston out again', (io.time - ts3).toFixed(1));
for (const w of [[1420, 1060], [1420, 912], [1300, 915], [1240, 918], [1180, 905]]) walkTo(w[0], w[1], 20, 3);
for (let k = 0; k < 20; k++) game.step(T, idle); lg('through', P(), 'held', !!G.held, (io.time - ts3).toFixed(1));
if (window.STAGE === 10) throw 'stage 10';
{ const cube = G.held; lg('to button', JSON.stringify(cube ? AP.placeCube(cube, [803, 674, 1156]) : 'no cube'), P(), cube && cube.pos.map(v => v | 0));
  lg('button', G.io.log.filter(l => /button|door_b00|exit/i.test(l)).slice(-4)); }
if (window.STAGE === 11) throw 'stage 11';
// out through the open exit door (x 48, y 612..668): blue low on the door wall (x 64, faces east), hop down onto the
// 576 platform, orange on the floor beside you and walk into it; you come out of the wall over the 1024 ledge
{ let r = ''; for (const t of [[64, 720, 1230], [64, 700, 1240], [64, 690, 1250]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue door wall', r); }
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
