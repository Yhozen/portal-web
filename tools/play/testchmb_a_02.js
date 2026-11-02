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
AP.wait(1); lg('cubes', G.cubes.filter(c => c.alive).map(c => c.ent.name + '@' + c.pos.map(v => v|0)).join(' '));
const freeCube = () => G.cubes.filter(c => c.alive && c.pos[2] > 400 && c.pos[2] < 900 && !c.placed).sort((a, b) => Math.hypot(a.pos[0]-game.pl.pos[0], a.pos[1]-game.pl.pos[1]) - Math.hypot(b.pos[0]-game.pl.pos[0], b.pos[1]-game.pl.pos[1]))[0];
for (const bn of ['floor_buttona_trigger_box_a02_2', 'floor_buttonb_trigger_box_a02_2']) { const c = freeCube(); if (!c) { lg('no cube for', bn); break; } const r = AP.placeCube(c, C(E(bn))); if (r.ok) c.placed = true; lg('cube on ' + bn, r); }
AP.wait(2); lg('exit doors', E('exit_door_left_a02_2').state + ' counter ' + E('counter_buttons_rm3a').value);
lg('through exit doors', AP.reach([150, 832, 600], 40)); AP.wait(3);
lg('portals', G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0)).join(' '));
lg('to exit elevator', AP.reach(F('a02-a03_trigger_elevator_move') || [-732, 832, 700], 30)); AP.wait(15, () => !!window.changedTo); lg('changelevel', window.changedTo || null);
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-12).join('\n'));
out.push('open: ' + G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0) + ' -> ' + (p.linked && p.linked.name)).join(' ; '));
return out.join('\n'); })()
