(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.2); G.shootPortal(which); AP.wait(0.3); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
try {
AP.wait(1); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
lg('to gun', AP.reach(E('portalgun_spawn_lvl4').origin, 40)); lg('gun', G.hasGun + ' fire ' + G.canFire);
// Room 1: the ceiling launcher drops its ball onto the fixed orange floor portal (portal_a_rm4). A blue portal on the ceiling above the
// floor catcher (spawned by Maker_balltrap_lvl4, mouth up at (0,-127)) sends the ball straight down into it; the catch opens the lift.
lg('into room', AP.reach([-200, -60, -120], 40)); AP.wait(2.5); lg('orange', E('portal_a_rm4').open);
lg('blue on ceiling over catcher', shoot(0, [0, -127, 256]));
const caught = AP.wait(30, () => E('lift_up_trigger_a').enabled); lg('ball caught', caught + ' balls ' + G.balls.map(b => b.pos.map(v => v|0)).join(' '));
if (window.PART1_ONLY) {} else {
lg('onto lift', AP.reach(C(E('lift_up_trigger_a')), 30)); AP.wait(12, () => game.pl.pos[2] > 20); AP.wait(4); lg('lift top', P());
lg('to mid elevator', AP.reach(F('a03-middle_trigger_elevator_move'), 30));
AP.wait(40, () => { const b = E('a03-middle_elevator_body'); return b.pos[2] > 1300 && !b.speedNow; }); AP.wait(2); lg('up', P());
// Room 2: the wall launcher fires its ball along +y; a blue portal where it hits sends it out of the fixed orange portal_b_rm4 in the
// floor pit (facing up) and up into the ceiling catcher (catcher_2), which powers the track train.
lg('into room 2', AP.reach([400, 0, 1344], 30)); AP.wait(1);
const L = E('energy_ball_launcher_a03_2'); G.tr.ignore = null; const ht = G.tr.trace(L.origin, [L.origin[0], L.origin[1] + 3000, L.origin[2]], [0,0,0], [0,0,0], 0x1, null);
lg('ball path hits', ht.end.map(v => v|0)); AP.wait(4);
for (const sp of [[200, 100], [64, 100], [150, 0], [64, 200], [250, 200], [0, 150]]) { const r = AP.reach([sp[0], sp[1], 1344], 30); const res = shoot(0, [64, ht.end[1], 1402]);
  lg('blue on ball wall from ' + sp, res); const Bp = G.gunPortals[0]; if (Bp.open && Math.abs(Bp.pos[1] - ht.end[1]) < 4 && Math.abs(Bp.pos[0] - 64) < 40) break; }
if (window.TRACE2) { const tr = []; for (let i = 0; i < 60; i++) { AP.wait(0.25); tr.push(G.balls.map(b => b.pos.map(v => v|0)).join('|')); } lg('ball track', tr.join(' ')); lg('c2 members', io.log.filter(l => /placed template/.test(l)).join(' / ')); const t2 = E('catcher2_ball_trap_10'); lg('trig', t2 && [t2.killed, t2.enabled, t2.bmins, t2.bmaxs]); }
const c2 = AP.wait(30, () => { const t = E('func_tracktrain_b00'); return t.moving || t.speedNow || io.log.some(l => /catcher_2|catcher2.*trigger/.test(l)); });
AP.wait(8); lg('catch 2', c2 + ' balls ' + G.balls.map(b => b.pos.map(v => v|0)).join(' ') + ' train ' + E('func_tracktrain_b00').pos.map(v => v|0));
// the cart shuttles between track_b00_2 (y -236) and track_b00_1 (y 212, beside the exit ledge), resting 4 s at each end. Its home spot
// sits under the only portalable ceiling patch: put blue there, wait by the fixed orange floor portal, and drop through onto the cart.
const T = E('func_tracktrain_b00'); lg('blue over cart home', shoot(0, [-384, -236, 1598]));
lg('by floor portal', AP.reach([40, 0, 1216], 20));
AP.wait(40, () => T.pos[1] < -230 && !T.speedNow); lg('cart home', T.pos.map(v => v|0));
AP.goto([-20, 0, 1224], 6); AP.approach([-64, 0], 2, 3); AP.wait(1.5); lg('after drop', P() + ' ground ' + (game.pl.groundEnt && game.pl.groundEnt.name));
if (window.STOP_RIDE) { AP.wait(4); AP.lookAt([-600, 260, 1380]); AP.wait(0.2); throw 'stopped mid-ride for screenshot'; }
AP.wait(30, () => T.pos[1] > 200 && !T.speedNow); lg('cart far end', T.pos.map(v => v|0) + ' me ' + P());
// the cart stops ~60u short of the exit ledge (x <= -508, z 1344, 24u below the cart top): back up, then run and jump the gap
AP.approach([-340, 200], 6, 2); game.pl.ang = [0, 180, 0];
for (let k = 0; k < 200 && game.pl.pos[0] > -560; k++) game.step(1 / 66, { fwd: 1, side: 0, jump: game.pl.pos[0] < -428 && game.pl.onGround && game.pl.pos[2] > 1360, duck: false });
lg('jumped to ledge', P());
lg('to exit elevator', AP.reach(F('a03-a04_trigger_elevator_move'), 30));
AP.wait(40, () => io.log.some(l => /changelevel/.test(l)) || window.changedTo); lg('end', P() + ' ' + (window.changedTo || ''));
}
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-10).join('\n'));
out.push(io.log.filter(l => /energy ball|picked|placed|catcher|track|relay|lightrail/.test(l)).slice(-30).join('\n'));
return out.join('\n'); })()
