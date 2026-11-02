(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent; let r;
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
AP.wait(150, () => G.portals.some(p => p.open && p.linked && p.linked.open && Math.hypot(p.pos[0]-game.pl.pos[0], p.pos[1]-game.pl.pos[1]) < 500));
const c1 = G.cubes.find(c => c.pos[2] < 200 && c.pos[1] < -900);
lg('cube1 on button', AP.placeCube(c1, C(E('floor_button_trigger_box_a00'))));
const m = C(E('trigger_elevator_move')); lg('to elevator', AP.gotoRetry([m[0], m[1], m[2] - 50], 30));
AP.wait(60, () => E('elevator_body_middle').speedNow === 0 && E('elevator_body_middle').pos[2] > 700); AP.wait(2);
lg('room trigger', AP.goto([-1088, -512, 580], 30));
const c2 = G.cubes.filter(c => c.alive && c.pos[2] > 500).sort((a, b) => Math.hypot(a.pos[0]-game.pl.pos[0], a.pos[1]-game.pl.pos[1]) - Math.hypot(b.pos[0]-game.pl.pos[0], b.pos[1]-game.pl.pos[1]))[0];
lg('cube2 on button', AP.placeCube(c2, C(E('floor_button_trigger_box_a00a'))));
out.push(AP.LOG.slice(-25).join('\n')); lg('to main room', AP.gotoRetry([-1088, -540, 580], 40, 40, 0.5)); lg('to blue2 room', AP.gotoRetry([-1344, -264, 580], 40, 40, 0.5, false)); lg('door', E('door_left_00').state + ' ' + E('door_left_00').t); const m2 = C(E('a00-a01_trigger_elevator_move')); lg('to elevator2', AP.gotoRetry([m2[0], m2[1], m2[2] - 50], 30, 40, 1));
AP.wait(40, () => window.changedTo); lg('changedTo', window.changedTo + ' pos ' + P());
out.push('open: ' + G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0) + ' f' + p.f.map(v=>v.toFixed(1)) + ' -> ' + (p.linked && p.linked.name)).join(' ; ') + ' held ' + !!G.held); out.push(io.log.filter(l => /portal_(blue|red)|count_portal/.test(l)).slice(-15).join('\n')); return out.join('\n'); })()
