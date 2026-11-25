(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const w0 = performance.now(), lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v) + (window.WALL ? ' [' + ((performance.now() - w0) / 1000).toFixed(0) + 's]' : ''));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
const sub3 = (a, f) => [a[0] - f[0] * 40, a[1] - f[1] * 40, a[2]]; const tele = () => G.stats.teleports; const IN = (fwd, jump = false) => ({ fwd, side: 0, jump, duck: false });
const idle = n => { for (let i = 0; i < n; i++) game.step(1/66, IN(0)); };
const through = (aim, max = 400) => { const n0 = tele(); for (let i = 0; i < max && tele() === n0; i++) { game.pl.ang = [0, Math.atan2(aim[1] - game.pl.pos[1], aim[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(1)); } idle(60); return tele() - n0 + ' at ' + P(); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
if (!G.hasGun) { lg('gun', AP.gotoRetry(E('portalgun_spawn_lvl7a').origin, 20, 3)); AP.wait(1); }
lg('stairs bottom', AP.gotoRetry(C(E('trigger_stairs_up_a09')), 20, 3)); AP.wait(3);
lg('stairs', ['door_stair_a09_1','door_stair_a09_8','door_stair_a09_16'].map(n => E(n).state + '@' + E(n).pos.map(v=>v|0)));
lg('stairs top', AP.gotoRetry([480, -860, 320], 30, 3)); lg('at', P());
const stairsZ = () => [-220,-300,-400,-500,-600,-680].map(y => { const t = G.tr.trace([544, y, 300], [544, y, -600], [0,0,0],[0,0,0], 0x1, G.playerEnt); return y + ':' + (t.end[2]|0); }).join(' ');
AP.wait(5); lg('stairs after top', stairsZ() + ' ' + io.log.filter(l => /stairs|box_unreachable/.test(l)).slice(-8));
const cube = G.cubes.find(c => c.alive);
lg('box floor', AP.gotoRetry([945, -772, 256], 30, 3));
// The cube sits on the top of three steps (416, 448, 480) and the first is 160 tall. Fling: blue high on the west wall
// (x 640, facing east), orange on the floor where you land coming out of blue. Walk onto orange, come out of blue, drop
// about 310 back into orange, and the second time out of blue it's ~600 u/s east, enough to reach the steps.
{ let r = 'none'; for (const t of [[700, -772, 560], [700, -800, 520], [700, -740, 540], [700, -850, 540]]) { r = shoot(0, t); const B = G.gunPortals[0]; if (B.open && B.f[0] > 0.9) break; } lg('blue west wall', r); }
const OX = window.OX || 880;
lg('west of orange', AP.gotoRetry([760, -805, 256], 12, 3)); // shoot orange looking east so its top points east: east speed going in then comes out of blue as up speed
lg('orange floor', shoot(1, [OX, G.gunPortals[0].pos[1], 256]) + ' ' + io.log.filter(l => /portal 1 failed/.test(l)).slice(-1));
{ const O = G.gunPortals[1].pos, n0 = tele(); let vmax = 0, last = n0;
  for (let i = 0; i < 66 * 8; i++) { vmax = Math.max(vmax, -game.pl.vel[2]);
    if (tele() === n0) { const dx = O[0] - game.pl.pos[0], dy = O[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(1/66, IN(Math.hypot(dx, dy) > 4 ? 1 : 0)); }
    else { if (tele() !== last) { last = tele(); lg('tele', P() + ' v ' + game.pl.vel.map(v => v|0)); } if (tele() - n0 < 2) { const dx = O[0] - game.pl.pos[0], dy = O[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(1/66, IN(0)); } // coast: the east speed going into orange comes out of blue as up speed
      else { game.pl.ang = [0, 0, 0]; game.step(1/66, IN(1)); if (game.pl.onGround) break; } } }
  lg('fling', 'max fall ' + (vmax|0) + ' landed ' + P() + ' teles ' + (tele() - n0)); }
lg('pick cube', AP.pickUp(cube)); lg('held', !!G.held + ' cube ' + cube.pos.map(v => v|0));
{ let i = 0; for (; i < 300; i++) { game.pl.ang = [-30, 180, 0]; game.step(1/66, IN(1)); if (game.pl.pos[0] < 900 && game.pl.onGround) break; } idle(20); lg('off steps', P() + ' held ' + !!G.held + ' cube ' + cube.pos.map(v => v|0) + ' ' + io.log.filter(l => /snag|dropped/.test(l)).slice(-1)); }
AP.wait(2); lg('stairs with cube off its spot', stairsZ() + ' ' + io.log.filter(l => /stairs/.test(l)).slice(-2));
lg('to landing', AP.gotoRetry([476, -839, 264], 30, 2)); lg('held', !!G.held + ' cube ' + cube.pos.map(v => v|0) + ' ' + io.log.filter(l => /snag|dropped/.test(l)).slice(-1));
lg('cube on button', AP.placeCube(cube, C(E('floor_button_trigger_box_rm7a')))); AP.wait(1.5);
lg('door', E('door_left_a08').state + ' ' + P());
// Goo room. The ball launcher sits in a walled-off alcove past the goo, reached from the west ledge through a doorway.
// Orange on the east floor's wall, blue on the ledge's wall, walk across; from the doorway, blue on the alcove wall the
// ball hits. The way back (the autopilot finds it) is through that blue and out of orange.
lg('east floor', AP.gotoRetry([803, 1780, 0], 20, 3));
lg('orange east wall', shoot(1, [960, 1780, 56]));
lg('blue ledge wall', shoot(0, [-64, 1850, 56]));
{ const O = G.gunPortals[1]; lg('in', through([O.pos[0] - O.f[0] * 40, O.pos[1] - O.f[1] * 40, O.pos[2]])); }
lg('doorway', AP.gotoRetry([-20, 1786, 0], 6, 3)); AP.approach([-20, 1786], 3);
for (let i = 0; i < 200 && game.pl.pos[0] > -130; i++) { game.pl.ang = [0, Math.atan2(1786 - game.pl.pos[1], -140 - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(1)); } idle(20);
lg('in alcove', P() + ' balls ' + G.balls.map(b => b.pos.map(v => v|0)));
lg('blue ball wall', shoot(0, [-224, 1548, 61]) + ' ' + io.log.filter(l => /portal 0 failed/.test(l)).slice(-1));
// the catcher stands on the landing, mouth up: orange on the ceiling over it, so the ball out of orange drops straight in
lg('to landing', AP.gotoRetry([494, -790, 264], 30, 3));
lg('orange over catcher', shoot(1, [512, -862, 511]));
lg('caught', AP.wait(30, () => io.log.some(l => /lift_lvl7a\.open/.test(l))) + ' ' + io.log.filter(l => /energy ball|ball_trap_10\.|lift_lvl7a/.test(l)).slice(-5));
lg('to exit', AP.gotoRetry(F('a09_a10_trigger_elevator_move'), 30, 20));
AP.wait(40, () => window.changedTo || io.log.some(l => /changelevel/.test(l))); lg('end', P() + ' ' + (window.changedTo || ''));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.slice(-(window.NLOG || 6)).join('\n'));
return out.join('\n'); })()
