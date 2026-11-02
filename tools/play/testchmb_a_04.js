(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
try {
AP.wait(1); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// The wall launcher fires along +x (y 318) into the east wall; the fixed orange portal_a_lvl5 (-64,379) faces -y. Blue on the east wall
// sends the ball out of orange heading -y; it bounces off the south wall and comes back into orange, by which time blue has been moved to
// the north wall at x 300 (facing -y), so the ball comes out heading straight down -y into the catcher spawned at (300,-48).
lg('to spawn trigger', AP.reach(F('trigger_start_spawn_timer_lvl5'), 30));
lg('vantage', AP.reach([-330, 200, 0], 40));
const L = E('energy_ball_launcher_lvl5'); AP.wait(20, () => G.balls.length > 0); lg('ball', G.balls.map(b => b.pos.map(v => v|0)).join(' '));
lg('blue east wall', shoot(0, [511, 318, 70]));
const exited = AP.wait(15, () => G.balls.some(b => b.vel[1] < -50)); lg('ball out of orange', exited + ' ' + G.balls.map(b => b.pos.map(v => v|0)).join(' '));
lg('blue north wall', shoot(0, [300, 383, 76]));
const T = E('rail_cart_lvl5'); const c = AP.wait(20, () => io.log.some(l => /ball_trap.*disable|catcher.*disable/.test(l)));
lg('caught', c + ' balls ' + G.balls.map(b => b.pos.map(v => v|0) + ' v ' + b.vel.map(v => v|0)).join(' ') + ' cart ' + T.pos.map(v => v|0));
// The cart (rail_cart_lvl5) shuttles over the pit between x 72 and x 590 (beside the east exit ledge). Get to the ledge in front of the
// orange portal through a blue portal, then go back through orange to a blue portal that drops us onto the cart.
lg('to orange ledge', AP.reach([-64, 290, 0], 40));
AP.wait(30, () => T.pos[0] < 80 && !T.speedNow); lg('cart home', T.pos.map(v => v|0));
G.tr.ignore = null; const sw = G.tr.trace([72, -60, 60], [72, -600, 60], [0,0,0], [0,0,0], 0x1, null).end; lg('south wall', sw.map(v => v|0));
lg('blue over cart', shoot(0, [72, sw[1], 60]));
AP.approach([-64, 330], 4, 2); game.pl.ang = [0, 90, 0];
for (let k = 0; k < 120 && game.pl.pos[1] > 0; k++) game.step(1 / 66, { fwd: 1, side: 0, jump: false, duck: false });
for (let k = 0; k < 60 && !(game.pl.groundEnt && game.pl.pos[1] > -95); k++) game.step(1 / 66, { fwd: 1, side: 0, jump: false, duck: false }); lg('on', P() + ' ground ' + (game.pl.groundEnt && game.pl.groundEnt.name));
if (window.STOP_RIDE) { AP.wait(2.5); AP.lookAt([700, 100, 60]); AP.wait(0.2); throw 'stopped mid-ride for screenshot'; }
{ const rr = []; for (let i = 0; i < 16; i++) { AP.wait(0.5); rr.push((game.pl.pos[0]|0) + '/' + (T.pos[0]|0) + '/' + (game.pl.pos[2]|0) + (game.pl.groundEnt ? game.pl.groundEnt.name.slice(0,4) : '-')); } lg('ride', rr.join(' ')); } AP.wait(30, () => T.pos[0] > 580 && !T.speedNow); lg('cart far', T.pos.map(v => v|0) + ' me ' + P());
lg('to exit elevator', AP.reach(F('a04-a05_trigger_elevator_move'), 30));
AP.wait(40, () => window.changedTo || io.log.some(l => /changelevel/.test(l))); lg('end', P() + ' ' + (window.changedTo || ''));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-8).join('\n'));
out.push(io.log.filter(l => /energy ball|catcher|ball_trap|tracktrain|rail_cart/.test(l)).slice(-20).join('\n'));
return out.join('\n'); })()
