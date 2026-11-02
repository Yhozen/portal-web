(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
try {
AP.wait(1); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
lg('to gun', AP.gotoRetry(E('portalgun_spawn_lvl3').origin, 40, 5, 0.5)); lg('gun', G.hasGun + ' fire ' + G.canFire);
lg('drop trigger', AP.reach(F('trigger_dropbox'), 30)); AP.wait(4);
AP.wait(3); const box = G.cubes.filter(c => c.ent.name === 'box' && c.alive && c.pos[2] < 300).sort((a, b) => a.pos[2] - b.pos[2])[0]; lg('box', box.pos.map(v => v|0));
lg('box on button', AP.placeCube(box, C(E('floor_button_trigger_box_a02'))));
lg('to mid elevator', AP.reach(F('a02-middle_trigger_elevator_move'), 30));
AP.wait(40, () => { const b = E('a02-middle_elevator_body'); return b.pos[2] > 550 && !b.speedNow; }); AP.wait(2); lg('up', P());
if (window.PART1_ONLY) {} else {
// Part 2 (room 3a): orange portal_a1_rm3a is fixed on the wall above the left pedestal (top z 704). Box A sits in the pit (floor z 448),
// box B on the right pedestal. Route: drop into the pit, blue on the pit wall -> out of the orange onto the left pedestal -> down to button b.
// Then back through the pit portal onto the left pedestal, blue on the wall above the right pedestal, walk back into the orange -> right pedestal.
const near = (q) => G.cubes.filter(c => c.alive && Math.hypot(c.pos[0]-q[0], c.pos[1]-q[1]) < 60 && Math.abs(c.pos[2]-q[2]) < 60)[0];
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.2); G.shootPortal(which); AP.wait(0.3); const P = G.gunPortals[which]; return P.open ? P.pos.map(v => v|0) + ' f ' + P.f.map(v => +v.toFixed(2)) : 'not placed'; };
lg('activate orange', AP.reach(F('trigger_portal_spawn_a1_rm3a'), 30)); AP.wait(2); lg('orange open', E('portal_a1_rm3a').open);
const boxA = near([970, 817, 452]), boxB = near([731, 579, 716]); lg('boxes', [boxA && boxA.pos.map(v=>v|0), boxB && boxB.pos.map(v=>v|0)]);
lg('pick pit box', AP.pickUp(boxA));
lg('blue on pit wall', shoot(0, [1088, 817, 506]));
const ra = AP.placeCube(boxA, C(E('floor_buttonb_trigger_box_a02_2'))); lg('box A on button b', ra);
lg('back into pit', AP.reach([960, 830, 448], 40));
lg('to left pedestal', AP.reach([704, 1080, 704], 40));
lg('blue above right pedestal', shoot(0, [731, 512, 762]));
const rb = AP.placeCube(boxB, C(E('floor_buttona_trigger_box_a02_2'))); lg('box B on button a', rb);
AP.wait(2); lg('exit doors', E('exit_door_left_a02_2').state + ' counter ' + (E('counter_buttons_rm3a').value ?? E('counter_buttons_rm3a').counter));
lg('through exit doors', AP.reach([150, 832, 576], 40)); AP.wait(3);
lg('portals', G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0)).join(' '));
lg('to exit elevator', AP.reach(F('a02-a03_trigger_elevator_move') || [-732, 832, 700], 30)); AP.wait(20, () => !!window.changedTo); lg('changelevel', window.changedTo || null);
}
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-12).join('\n'));
out.push('open: ' + G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0) + ' -> ' + (p.linked && p.linked.name)).join(' ; '));
return out.join('\n'); })()
