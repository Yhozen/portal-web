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
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
