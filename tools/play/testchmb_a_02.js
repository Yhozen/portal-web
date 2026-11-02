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
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-12).join('\n'));
out.push('open: ' + G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0) + ' -> ' + (p.linked && p.linked.name)).join(' ; '));
return out.join('\n'); })()
