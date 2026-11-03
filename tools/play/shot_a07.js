(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
const tele = () => G.stats.teleports; const IN = (fwd, jump = false) => ({ fwd, side: 0, jump, duck: false });
const idle = n => { for (let i = 0; i < n; i++) game.step(1/66, IN(0)); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// chamber 11 (route per the StrategyWiki/Thonky walkthroughs): the pedestal gun cycles orange portals -x, -y, +x. The +x one (t~14.8)
// lands on the back wall of a safe room at z128 under the start ramp; a blue on the start floor drops us there.
AP.wait(13); lg('blue', shoot(0, [870, -384, 256]));
const waitOrange = (x, tmax) => { for (let i = 0; i < tmax * 66; i++) { const o = G.gunPortals[1]; if (o.open && Math.abs(o.pos[0] - x[0]) < 40 && Math.abs(o.pos[1] - x[1]) < 40) return true; game.step(1/66, IN(0)); } return false; };
lg('orange +x', waitOrange([447, -383], 12) + ' t ' + io.time.toFixed(1));
{ const n0 = tele(); for (let i = 0; i < 200 && tele() === n0; i++) { game.pl.ang = [0, Math.atan2(-384 - game.pl.pos[1], 870 - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(1)); } lg('tele', tele() - n0 + ' at ' + P()); idle(60); lg('landed', P()); }
lg('to button', AP.reach([212, -448, 128], 10)); AP.lookAt([176, -448, 190]); AP.wait(0.2); G.use(); AP.wait(1.5); lg('pressed', io.log.filter(l => /button_1|launcher_room/.test(l)).slice(-3));
// the switch lifts a panel high in the west wall (door_launcher_room); shoot blue through it into the launcher room
AP.wait(1.4); for (const t of [[-495, -384, 320], [-495, -384, 340], [-495, -360, 300]]) { const r = shoot(0, t); lg('blue through door', r); if (r !== 'not placed' && G.gunPortals[0].pos[0] < -490) break; }
G.gunPortals[1].open = G.gunPortals[1].open; lg('orange +x again', waitOrange([447, -383], 30) + ' t ' + io.time.toFixed(1));
lg('to orange', AP.reach([400, -383, 128], 16));
{ const n0 = tele(); for (let i = 0; i < 200 && tele() === n0; i++) { game.pl.ang = [0, 0, 0]; game.step(1/66, IN(1)); } lg('tele', tele() - n0 + ' at ' + P()); idle(60); lg('landed', P()); }
// launcher room: the pellet bounces between the launcher and a scorch mark on the south wall. Blue on the scorch; when the pedestal's orange
// is on the north wall of the main room (across from the catcher) the pellet flies into the catcher and the scaffold starts.
const scorch = () => { const r = shoot(0, [-638, -512, 320]); return G.gunPortals[0].open && G.gunPortals[0].pos[1] < -490 ? r : null; };
let sc = scorch(); lg('scorch from landing', sc || io.log.filter(l => /portal 0 failed/.test(l)).slice(-1));
for (const v of [[-638, -150], [-560, -250], [-700, -100], [-638, 0]]) { if (sc) break; lg('vantage', AP.reach([v[0], v[1], game.pl.pos[2]], 24)); sc = scorch(); lg('scorch', sc || io.log.filter(l => /portal 0 failed/.test(l)).slice(-1)); }
const caught = () => io.log.some(l => /ball_trap_10.*(ontrigger|trigger\(\))|rail_cart_rm6.start/.test(l));
for (let i = 0; i < 66 * 60 && !caught(); i++) game.step(1/66, IN(0));
lg('caught', caught() + ' t ' + io.time.toFixed(1) + ' orange ' + G.gunPortals[1].pos.map(v => v|0));
// scaffold: rail_cart_rm6 rides to the north wall. Blue on the launcher-room floor; when the pedestal's orange is back on the north wall
// (above the parked scaffold) step through and drop onto it, then it carries us to the pedestal.
const cart = E('rail_cart_rm6'); for (let i = 0; i < 66 * 20 && cart.pos[1] < 120; i++) game.step(1/66, IN(0)); lg('cart', cart.pos.map(v => v|0) + ' t ' + io.time.toFixed(1));
const fl = [game.pl.pos[0], game.pl.pos[1] + 70, game.pl.pos[2]]; lg('blue floor', shoot(0, fl));
lg('orange north', waitOrange([-192, 191], 30) + ' t ' + io.time.toFixed(1) + ' cart ' + cart.pos.map(v => v|0));
{ const n0 = tele(); for (let i = 0; i < 200 && tele() === n0; i++) { game.pl.ang = [0, Math.atan2(fl[1] - game.pl.pos[1], fl[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, IN(1)); } lg('tele', tele() - n0 + ' at ' + P()); idle(60); lg('landed', P() + ' cart ' + cart.pos.map(v => v|0)); }
for (let i = 0; i < 66 * 25 && !(cart.pos[1] < -240 && Math.abs(cart.speedNow || 0) < 1); i++) game.step(1/66, IN(0)); lg('ride', P() + ' cart ' + cart.pos.map(v => v|0) + ' t ' + io.time.toFixed(1));
lg('to gun', AP.reach([-190, -340, game.pl.pos[2]], 20)); AP.wait(1); lg('gun', G.canFire + ' at ' + P());
// exit: the switch behind the pedestal lifts a panel above the catcher; orange through it, blue on the north wall where the scaffold docks
AP.lookAt([-192, 191, 150]); AP.wait(0.3);
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-10).join('\n'));
out.push(io.log.filter(l => /teleport|picked|fizz|ball_trap|rail_cart|catch|gone|ball through|portal 1 failed|rail_cart|lift/.test(l)).slice(-30).join('\n'));
return out.join('\n'); })()
