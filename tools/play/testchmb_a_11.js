(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
if (!G.hasGun) { lg('gun', AP.gotoRetry(E('portalgun_spawn_a_lab3').origin, 20, 3)); AP.wait(1); }
lg('entry', AP.gotoRetry([480, -960, 0], 20, 2)); AP.wait(30, () => E('exit_door_left_a_a11').state === 2 || E('exit_door_left_a_a11').state === 1); AP.wait(1); lg('entry door', E('exit_door_left_a_a11').state + ' ' + io.log.filter(l => /scene/.test(l)).slice(-1));
// The training turret stands in the west doorway; stepping in beside it fires the env_physexplosion that kicks it out of the way.
lg('beside turret', AP.gotoRetry([460, -630, 0], 20, 2)); { const t = G.cubes.find(c => c.ent.name === 'training_turret');
  for (let i = 0; i < 200; i++) { const p = game.pl.pos; game.pl.ang = [0, Math.atan2(-655 - p[1], 420 - p[0]) * 180 / Math.PI, 0]; game.step(1/66, { fwd: i < 90 ? 1 : 0, side: 0, jump: false, duck: false }); }
  lg('turret kicked', t.pos.map(v => v|0) + ' ' + t.turret.state + ' ' + io.log.filter(l => /knock_over_turret\d pushed/.test(l)).slice(-1)); }
// Turret room. The button's filter takes anything named "box", and the turrets are named box too, so carry the turret
// that stands nearest the button onto it (the radio fort's boxes would do as well, but they box the player in).
const box = G.cubes.filter(c => c.alive && c.turret && c.ent.name === 'box').sort((a, b) => Math.hypot(a.pos[0] - 768, a.pos[1] + 255) - Math.hypot(b.pos[0] - 768, b.pos[1] + 255))[0];
lg('box', box && box.pos.map(v => v|0) + ' ' + box.ent.cls);
lg('pick box', AP.pickUp(box)); lg('held', !!G.held);
lg('box on button', AP.placeCube(box, C(E('floor_button_trigger_box_a11')))); AP.wait(1.5);
lg('exit doors', E('exit_door_left_a11').state + ' ' + E('exit_door_right_a11').state + ' ' + io.log.filter(l => /floor_button|filter/.test(l)).slice(-4) + ' box ' + box.pos.map(v => v|0) + ' up ' + box.R[10].toFixed(2));
// Past the exit doors a grating fence splits the room. Portal shots go through grating: orange on the west wall behind
// the player, blue on the floor beyond the fence, walk into orange.
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + io.log.filter(l => /failed/.test(l)).slice(-1); };
lg('past doors', AP.gotoRetry([1000, -350, 0], 20, 3));
lg('blue beyond fence', shoot(0, [1200, -350, 0]));
lg('orange west wall', shoot(1, [916, -350, 60]));
{ const n0 = G.stats.teleports; const O = G.gunPortals[1].pos; for (let i = 0; i < 300 && G.stats.teleports === n0; i++) { game.pl.ang = [0, Math.atan2(O[1] - game.pl.pos[1], O[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); } AP.wait(1); lg('over fence', P()); }
// The last room is behind a grating window in the south wall (x 1190-1300, z 25-100). Its floor takes no portal, so blue
// goes through the window onto its far (south) wall, aimed high over the turret in there; orange on this room's east
// wall, walk in.
lg('at window', AP.gotoRetry([1245, -400, 0], 20, 3));
lg('blue through window', shoot(0, [1245, -800, 100]));
lg('orange east wall', shoot(1, [1380, -350, 56]));
{ const n0 = G.stats.teleports; const O = G.gunPortals[1].pos; for (let i = 0; i < 400 && G.stats.teleports === n0; i++) { game.pl.ang = [0, Math.atan2(O[1] - game.pl.pos[1], O[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); } AP.wait(1); lg('in last room', P()); }
lg('to elevator', AP.gotoRetry(F('a11_a13_trigger_elevator_move'), 40, 4));
AP.wait(40, () => window.changedTo); lg('changedTo', window.changedTo + ' pos ' + P());
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
