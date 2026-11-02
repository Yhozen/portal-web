(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire + ' cubes ' + G.cubes.filter(c => c.alive).map(c => c.pos.map(v => v|0)).join(' '));
lg('toward box drop', AP.reach([-192, 32, 0], 60)); AP.wait(3);
const box = G.cubes.filter(c => c.alive)[0]; lg('box', box && box.pos.map(v => v|0));
lg('box on button', AP.placeCube(box, C(E('floor_buttona_trigger_box_a02_2')))); AP.wait(2);
lg('doors', E('exit_door_left_a05').state + ' box ' + (box.alive) + ' ' + box.pos.map(v => v|0));
lg('to exit', AP.reach(F('a05_a06_trigger_elevator_move'), 30));
AP.wait(40, () => window.changedTo || io.log.some(l => /changelevel/.test(l))); lg('end', P() + ' ' + (window.changedTo || ''));
} catch (e) { lg('ERROR', String(e.stack || e)); }
out.push(AP.LOG.filter(l => !/try\d+ no path/.test(l)).slice(-8).join('\n'));
out.push(io.log.filter(l => /box|cube|fizzl|dissolv|button|exit_door/.test(l)).slice(-15).join('\n'));
return out.join('\n'); })()
