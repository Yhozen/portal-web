(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
const tele = () => G.stats.teleports; const IN = (fwd, jump = false) => ({ fwd, side: 0, jump, duck: false });
const idle = n => { for (let i = 0; i < n; i++) game.step(1/66, IN(0)); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// room 1: the exit stairs start on a 64u platform. Jump into a blue floor portal; the fixed orange high on the west wall throws us onto it.
lg('room1', AP.reach([-1440, 128, 0], 20)); AP.wait(2.5);
lg('blue floor', shoot(0, [-1500, 128, 0]));
{ const n0 = tele(); game.pl.ang = [0, 180, 0]; for (let i = 0; i < 200 && tele() === n0; i++) game.step(1/66, IN(1, i < 3)); lg('tele', tele() - n0 + ' at ' + P());
  game.pl.ang = [0, 0, 0]; for (let i = 0; i < 120 && !game.pl.onGround; i++) game.step(1/66, IN(1)); idle(10); lg('landed', P()); }
lg('doors', ['door_left_a06_1','door_right_a06_1'].map(n => E(n).state + ' ' + (E(n).kv.spawnflags) + ' ' + E(n).kv.spawnpos));
{ game.pl.ang = [0, 0, 0]; for (let i = 0; i < 200; i++) game.step(1/66, IN(1)); lg('drive +x', P()); }
lg('door1', AP.reach([-1049, 128, 128], 30));
// room 2: drop from the 128 ledge into a blue portal on the pit floor; the fixed orange high on the west wall flings us across.
lg('ledge', AP.reach([-795, 128, 128], 8)); AP.wait(2.5);
lg('pre', P()); lg('blue pit floor', shoot(0, [-615, 128, -127]));
// steer onto a floor portal: on the ground walk at it; in the air use air control to null the horizontal error (target velocity ~ 3x the offset)
const fling = (pc, maxT = 6) => { const n0 = tele(); let t = 0; while (t < maxT && tele() === n0) { const pl = game.pl; const d = [pc[0] - pl.pos[0], pc[1] - pl.pos[1]];
  let w = d; if (!pl.onGround) { const k = Math.min(1, 150 / (Math.hypot(...d) * 3 + 1e-3)) * 3; w = [d[0] * k - pl.vel[0], d[1] * k - pl.vel[1]]; }
  pl.ang = [0, Math.atan2(w[1], w[0]) * 180 / Math.PI, 0]; const stuck = pl.onGround && t > 0.3 && Math.hypot(pl.vel[0], pl.vel[1]) < 30; game.step(1/66, IN(Math.hypot(w[0], w[1]) > 6 ? 1 : 0, stuck)); t += 1/66; } return tele() > n0; };
const land = (yaw, maxT = 4) => { game.pl.ang = [0, yaw, 0]; let t = 0; while (t < 0.1 || (!game.pl.onGround && t < maxT)) { game.step(1/66, IN(1)); t += 1/66; } idle(10); };
lg('portals', G.portals.map(p => p.name + ':' + p.open + '>' + (p.linked && p.linked.name)).join(' ')); lg('fling1', fling(G.gunPortals[0].pos)); lg('exit', P() + ' v ' + game.pl.vel.map(v=>v|0)); land(0); lg('landed', P());
lg('room2 exit', AP.reach([-368, 128, 128], 30)); lg('at', P());
// room 3: the pit's floor holds a fixed orange; the concrete faces of the fling pillars (func_brush, x 520, facing +x) take blue.
lg('room3', AP.reach([300, 128, 128], 30)); AP.wait(4.5); lg('at', P());
// Drop into the pit, put blue on a pillar face, then fall through orange -> blue -> back into orange: the second pass carries the speed
const ZT = AP.ZT; const OR = [600, 128, -191];
const loopFling = (pillar, k) => { lg('blue pillar ' + k, shoot(0, pillar)); lg('in ' + k, fling(OR)); lg('out1 ' + k, P() + ' v ' + game.pl.vel.map(v=>v|0));
  lg('back ' + k, fling(OR)); lg('out2 ' + k, P() + ' v ' + game.pl.vel.map(v=>v|0)); land(0); lg('landed ' + k, P()); };
// The pillar faces are only visible from the east, so go down the side stairs (y~0) beside the pit first.
lg('stairs', AP.reach([728, 0, 24], 12)); lg('at', P());
let lo = 'none'; for (const z of [460, 450, 470, 445]) { lo = shoot(0, [520, 128, z]); if (G.gunPortals[0].pos[0] > 500 && G.gunPortals[0].pos[2] < 520) break; } lg('blue pillar low', lo);
lg('drop in', fling(OR)); lg('out', P() + ' v ' + game.pl.vel.map(v=>v|0)); land(0); lg('landed', P());
lg('blue pillar high', shoot(0, [520, 128, 586]));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-10).join('\n'));
out.push(io.log.filter(l => /teleport|door|fling|portal|fizzle/.test(l)).slice(-15).join('\n'));
return out.join('\n'); })()
