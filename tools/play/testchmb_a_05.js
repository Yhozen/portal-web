(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// Portal can't fire while carrying, so drop the box for each shot and pick it back up.
// The button room is behind a cleanser (trigger_fryer_rm5-a) that would fizzle the box. The fixed orange portal stands on a raised
// platform (top z 128) facing +x. Carry the box through a blue portal on the west wall to come out of orange onto the platform, then
// re-shoot blue through the window into the button room and walk back into orange with the box.
lg('toward box drop', AP.reach([-150, 20, 0], 60)); AP.wait(3);
const box = G.cubes.filter(c => c.alive)[0]; lg('box', box && box.pos.map(v => v|0));
lg('pick up', AP.pickUp(box)); lg('held', !!G.held);
lg('held2', !!G.held + ' ' + box.pos.map(v=>v|0));
const tele = () => G.stats.teleports;
const drive = (aim, maxT, stop) => { const t0 = io.time, n0 = tele(); while (io.time - t0 < maxT) { AP.lookAt(aim); game.pl.ang[0] = 0; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); if (stop(n0)) break; } };
lg('to east wall', AP.reach([170, -161, 0], 30)); lg('held', !!G.held);
G.use(); AP.wait(1); lg('blue east wall', shoot(0, [256, -161, 49])); lg('re-pick', AP.pickUp(box));
drive([256, -161, 49], 6, n0 => tele() > n0); for (let i = 0; i < 20; i++) game.step(1/66, { fwd: 0, side: 0, jump: false, duck: false });
lg('on platform', P() + ' held ' + !!G.held);
G.use(); AP.wait(1); AP.approach([-70, -183], 6, 3); let bf = 'none'; for (const t of [[64, 450, 0], [40, 420, 0], [90, 480, 0], [64, 380, 0], [20, 500, 0]]) { const r = shoot(0, t); if (G.gunPortals[0].pos[1] > 200) { bf = t + ' -> ' + r; break; } } lg('blue button room floor', bf + ' from ' + P()); lg('re-pick', AP.pickUp(box)); lg('pos', P() + ' box ' + box.pos.map(v=>v|0));
drive([-128, -191, 160], 6, n0 => tele() > n0); for (let i = 0; i < 60; i++) game.step(1/66, { fwd: 0, side: 0, jump: false, duck: false });
lg('in button room', P() + ' held ' + !!G.held);
lg('box on button', AP.placeCube(G.held || box, C(E('floor_buttona_trigger_box_a02_2')))); AP.wait(2);
lg('doors', E('exit_door_left_a05').state + ' box ' + box.pos.map(v => v|0));
lg('to exit', AP.reach(F('a05_a06_trigger_elevator_move'), 30));
AP.wait(40, () => window.changedTo || io.log.some(l => /changelevel/.test(l))); lg('end', P() + ' ' + (window.changedTo || ''));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-8).join('\n'));
out.push(io.log.filter(l => /dissolv|fryer|drop_box|exit_door|snag|teleport/.test(l)).slice(-10).join('\n'));
return out.join('\n'); })()
