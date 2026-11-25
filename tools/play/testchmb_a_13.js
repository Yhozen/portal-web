(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); const n0 = io.log.length; G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open && !io.log.slice(n0).some(l => /failed/.test(l)) ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + io.log.filter(l => /failed/.test(l)).slice(-1); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
if (!G.hasGun) { lg('gun', AP.gotoRetry(E('portalgun1_spawn_lab5').origin, 20, 3)); AP.wait(1); }
const box = G.cubes.find(c => c.alive && c.ent.name === 'box'); AP.wait(3); lg('box', box && box.pos.map(v => v|0));
lg('pick box', AP.pickUp(box)); lg('held', !!G.held + ' at ' + P());
if (window.STAGE === 1) throw 'stage 1';
// the box climb ("use your box"): floor 0 -> step 64 (y 512..575, x 1744..1904) -> ledge 128 (y >= 576, and x < 1744)
const T = 1 / 66, step = (n, i) => { for (let k = 0; k < n; k++) game.step(T, i); };
const hop = (to, dz) => { const d = [to[0] - game.pl.pos[0], to[1] - game.pl.pos[1]]; game.pl.ang = [0, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0];
  step(1, { fwd: 1, side: 0, jump: true, duck: false }); for (let k = 0; k < 90; k++) { const dd = Math.hypot(to[0] - game.pl.pos[0], to[1] - game.pl.pos[1]); step(1, { fwd: dd > 6 ? 1 : 0, side: 0, jump: false, duck: k > 4 && k < 40 }); if (game.pl.onGround && k > 10) break; } AP.wait(0.3); return P(); };
const drop = (at, z) => { AP.lookAt([at[0], at[1], z]); AP.wait(0.4); for (let k = 0; k < 8 && Math.hypot(at[0] - box.pos[0], at[1] - box.pos[1]) > 3; k++) { AP.approach([at[0] - (box.pos[0] - game.pl.pos[0]), at[1] - (box.pos[1] - game.pl.pos[1])], 2, 1.5); AP.lookAt([at[0], at[1], z]); AP.wait(0.3); } G.use(); AP.wait(1.2); return box.pos.map(v => v|0); };
lg('to step face', AP.gotoRetry([1810, 420, 0], 12, 3).ok + ' ' + P());
lg('box below step', drop([1810, 491], 10));
AP.approach([1810, 440], 3, 2); lg('onto box', hop([1810, 488], 40));
lg('onto step', hop([1810, 545], 64));
AP.lookAt([box.pos[0], box.pos[1], box.pos[2] + 20]); AP.wait(0.1); G.use(); AP.wait(0.5); lg('grab from step', !!G.held + ' box ' + box.pos.map(v => v|0));
if (window.STAGE === 3) throw 'stage 3';
// lift it clear of the step's edge first, then over the step; this is where the straight held-cube sweep used to stop dead
AP.approach([1845, 540], 3, 2); AP.lookAt([1842, 470, 140]); AP.wait(0.8); lg('lifted', box.pos.map(v => v|0)); AP.lookAt([1772, 556, 112]); AP.wait(1.0); lg('holding at', P() + ' box ' + box.pos.map(v => v|0)); G.use(); AP.wait(1.2); lg('box on step', box.pos.map(v => v|0));
AP.approach([1830, 552], 3, 2); lg('onto box 2', hop([1770, 552], 104));
AP.approach([box.pos[0] - 14, box.pos[1]], 3, 1.5); lg('box edge', P()); lg('onto ledge', hop([1700, 552], 128));
AP.lookAt([box.pos[0], box.pos[1], box.pos[2] + 20]); AP.wait(0.1); G.use(); AP.wait(0.5); lg('grab from ledge', !!G.held + ' box ' + box.pos.map(v => v|0));
if (window.STAGE === 4) throw 'stage 4';
// then carry it down the ledge corridor (hallway 1, launcher2_rm8's ball runs along it) into the ball hallway; the box
// passing create_steps_for_beginning_puzzle opens door_create_steps_for_first_puzzle (the steps back up)
const WALK = [[1620, 550], [1604, 400], [1604, 100], [1604, -200], [1604, -500], [1604, -650], [1604, -760], [1520, -860]];
for (const w of WALK) { game.pl.ang = [0, Math.atan2(w[1] - game.pl.pos[1], w[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; AP.approach(w, 6, 4); } lg('ball hallway', P() + ' held ' + !!G.held);
if (window.STAGE === 5) throw 'stage 5';
// hallway 2 (launcher1_rm8's ball, x 1481) up the stairs and north; blue on its north wall where the ball turns
for (const t of [[1490, -820, 64], [1490, -600, 140], [1490, 0, 192], [1490, 600, 108]]) AP.gotoRetry(t, 24, 3); lg('hallway 2 end', P() + ' held ' + !!G.held);
// firing drops a held cube (as in the original), so pick it up again after each shot
// run through waypoints without stopping at each (approach brakes inside 40 u); the last one is approached normally
const run = ws => { for (let i = 0; i < ws.length; i++) { const w = ws[i]; if (i === ws.length - 1) { game.pl.ang = [0, Math.atan2(w[1] - game.pl.pos[1], w[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; AP.approach(w, 6, 3); break; }
  for (let k = 0; k < 4 * 66 && Math.hypot(w[0] - game.pl.pos[0], w[1] - game.pl.pos[1]) > 30; k++) { const y = Math.atan2(w[1] - game.pl.pos[1], w[0] - game.pl.pos[0]); game.pl.ang = [0, y * 180 / Math.PI, 0]; game.step(1 / 66, { fwd: 1, side: 0, jump: false, duck: false }); } } return P(); };
const pick = (settle = 1.5) => { AP.wait(settle); for (let k = 0; k < 3 && !G.held; k++) { const a = Math.atan2(game.pl.pos[1] - box.pos[1], game.pl.pos[0] - box.pos[0]); AP.approach([box.pos[0] + 60 * Math.cos(a), box.pos[1] + 60 * Math.sin(a)], 6, 2); AP.lookAt(box.pos); AP.wait(0.2); G.use(); AP.wait(0.4); } return !!G.held + ' box ' + box.pos.map(v => v|0); };
lg('blue hallway 2 wall', shoot(0, [1481, 767, 236]), 'repick ' + pick());
if (window.STAGE === 5.5) throw 'stage 5.5';
// down the stairs to the ledge over the lab and drop in
lg('lab floor', JSON.stringify(AP.gotoRetry([850, 200, -250], 24, 3)).slice(0, 120) + ' held ' + !!G.held);
if (window.STAGE === 6) throw 'stage 6';
// angled catcher (ball_trap_12, high on the north panel facing down-south): orange on the opposite angled panel; the
// ball comes out of it up-north, off the ceiling and into the catcher. That raises the first lift.
const caught = (n, s, n0 = io.log.length) => { AP.wait(s, () => io.log.slice(n0).some(l => l.includes(n + '.disable()'))); return io.log.slice(n0).filter(l => l.includes(n + '.disable()') || /lift\d_rm5\.close/.test(l)).slice(0, 2).join(' / ') || 'not caught'; };
lg('to panel spot', JSON.stringify(AP.gotoRetry([736, 260, -256], 16, 3)).slice(0, 80), AP.approach([736, 260], 4, 4) + ' at ' + P() + ' held ' + !!G.held); const n12 = io.log.length; lg('orange angled panel', shoot(1, [736, 64, -64]), 'repick ' + pick());
AP.gotoRetry([691, 0, -256], 16, 2); lg('angled catcher', caught('ball_trap_12', 16, n12)); lg('trap12 log', io.log.filter(l => /trap_12|lift\d_rm5|relay_lift|launcher/.test(l)).slice(-12));
if (window.STAGE === 7) throw 'stage 7';
// box bounce (ball_trap_10, beside launcher3_lab5; no portal surfaces): stand in the ball's path holding the box turned
// 45 degrees, so it sends the ball sideways. The box keeps its turn relative to the view from when it was picked up, so
// set it down and pick it up again from the side that gives that.
const yawOf = c => Math.atan2(c.R[1], c.R[0]) * 180 / Math.PI;
const regrab = rel => { if (G.held) { G.use(); AP.wait(1.2); } const th = (yawOf(box) - rel) * Math.PI / 180; AP.approach([box.pos[0] - 50 * Math.cos(th), box.pos[1] - 50 * Math.sin(th)], 4, 3); AP.lookAt(box.pos); AP.wait(0.2); G.use(); AP.wait(0.6); return !!G.held + ' rel ' + (G.held ? ((yawOf(box) - game.pl.ang[1] + 540) % 90).toFixed(0) : '-'); };
AP.gotoRetry([691, 0, -256], 16, 2); lg('regrab', regrab(45));
AP.approach([691, -80], 4, 3); for (let k = 0; k < 66 * 12 && !io.log.some(l => l.includes('ball_trap_10.disable()')); k++) { game.pl.ang = [0, -90, 0]; game.step(T, { fwd: 0, side: 0, jump: false, duck: false }); }
lg('box bounce', io.log.filter(l => l.includes('ball_trap_10.disable()') || /lift\d_rm5\.close/.test(l)).slice(0, 2).join(' / ') || 'not caught', 'box ' + box.pos.map(v => v|0));
if (window.STAGE === 8) throw 'stage 8';
// double door (ball_trap_11, behind door_puzzle_*_a01 at x 144 and door_puzzle_*_b01 at x -80 along y 256): the box
// on button a (in the ball's path, but the box is low enough for it to pass over) and the player on button b (on its
// pedestal, off the path). The ball comes from hallway 1 (launcher2_rm8): blue on that hallway's north wall, orange on
// the lab's east panel facing west. Getting back up to hallway 1: orange on the east panel, blue high on the wall above
// the ledge, walk in.
const ta = C(E('trigger_catcherpuzzle_box_a_lab5')), tb = C(E('trigger_catcherpuzzle_box_b_lab5'));
// button b sits on a 64-unit pedestal (x -200..-60, y 0..140, top -192), too high to set the box on from the floor at
// the 56 hold. So use the box as a step: set it against the pedestal's east face, hop onto it and up, then turn round,
// lift the box up after you and set it on the button.
lg('to pedestal east', JSON.stringify(AP.gotoRetry([60, 70, -256], 16, 3)).slice(0, 60), 'held ' + !!G.held);
if (!G.held) lg('repick', pick());
lg('box at base', drop([-30, 70], -246), P());
AP.approach([20, 70], 3, 2); lg('onto box 3', hop([-28, 70], -215)); lg('onto pedestal', hop([-80, 70], -192));
AP.lookAt(box.pos); AP.wait(0.2); G.use(); AP.wait(0.5); AP.lookAt([-60, 70, -150]); AP.wait(1); lg('lift box up', !!G.held + ' box ' + box.pos.map(v => v|0));
for (let k = 0; k < 10 && G.held; k++) { AP.lookAt([tb[0], tb[1], tb[2] + 12]); AP.wait(0.4); if (Math.hypot(tb[0] - box.pos[0], tb[1] - box.pos[1]) < 5) break; AP.approach([tb[0] - (box.pos[0] - game.pl.pos[0]), tb[1] - (box.pos[1] - game.pl.pos[1])], 2, 1); }
G.use(); AP.wait(1.5); lg('box on b', 'box ' + box.pos.map(v => v|0), 'door b ' + E('button_catcherpuzzle_b_lab5').state);
if (window.STAGE === 9) throw 'stage 9';
lg('to 880,300', JSON.stringify(AP.gotoRetry([880, 300, -256], 16, 3)).slice(0, 80), AP.approach([880, 300], 4, 3) + ' ' + P());
lg('blue up', shoot(0, [1407, 300, 190])); lg('orange east panel', shoot(1, [1175, 254, -200]));
for (let k = 0; k < 66 * 6 && game.pl.pos[2] < -100; k++) { game.pl.ang = [0, Math.atan2(254 - game.pl.pos[1], 1175 - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); } AP.wait(1.5); lg('walk in', P());
lg('up', P(), JSON.stringify(AP.gotoRetry([1589, 528, 128], 24, 3)).slice(0, 100));
if (window.STAGE === 10) throw 'stage 10';
// the end wall of hallway 1 (a concrete alcove at y 639 behind a player clip, metal either side). launcher2_rm8's ball
// bounces off it every few seconds, and a shot that meets the ball there doesn't place, so shoot again
const n11 = io.log.length; let s11 = shoot(0, [1599, 639, 184]); for (let k = 0; k < 4 && /not placed/.test(s11); k++) { AP.wait(0.4); s11 = shoot(0, [1599, 639, 184]); } lg('blue hallway 1 wall', s11);
// the player on button a (trigger y 229..277), beside the ball's line (y 253, z -200) so it passes
lg('to button a', JSON.stringify(AP.gotoRetry([ta[0], ta[1] + 34, -256], 12, 4)).slice(0, 120), AP.approach([ta[0], ta[1] + 34], 3, 3) + ' ' + P(), 'door a ' + E('button_catcherpuzzle_a_lab5').state);
lg('double door', caught('ball_trap_11', 30, n11), 'box ' + box.pos.map(v => v|0));
lg('lifts', ['lift1_rm5', 'lift2_rm5', 'lift3_rm5'].map(n => n + ' ' + E(n).state).join(', '));
if (window.STAGE === 11) throw 'stage 11';
// the lifts are up now, one per catcher, and they're the way to the exit's floor button (x 1541..1601, y 248..306, z 0):
// from the upper room hop lift 1, 2, 3, then jump down east onto the corridor at -128 and walk up its ramp to the button.
// The box comes too: off button b (the doors don't matter once ball_trap_11 has its ball), up through the portals.
const leap = (from, to, edge, pitch = 10) => { AP.approach(from, 3, 2); const d = [to[0] - from[0], to[1] - from[1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L], yaw = Math.atan2(u[1], u[0]) * 180 / Math.PI; game.pl.ang = [pitch, yaw, 0]; AP.wait(0.3);
  let jumped = false; for (let k = 0; k < 200; k++) { const s = (game.pl.pos[0] - from[0]) * u[0] + (game.pl.pos[1] - from[1]) * u[1]; const j = !jumped && s >= edge; if (j) jumped = true; game.pl.ang = [pitch, yaw, 0]; game.step(T, { fwd: 1, side: 0, jump: j, duck: jumped }); if (jumped && game.pl.onGround) break; }
  for (let k = 0; k < 20; k++) game.step(T, { fwd: 0, side: 0, jump: false, duck: false }); return P() + ' held ' + !!G.held + ' box ' + box.pos.map(v => v|0); };
lg('to pedestal east', JSON.stringify(AP.gotoRetry([-36, 66, -256], 12, 3)).slice(0, 60)); AP.approach([-40, box.pos[1]], 3, 2); AP.lookAt(box.pos); AP.wait(0.2); G.use(); AP.wait(0.6); AP.lookAt([box.pos[0], box.pos[1], -110]); AP.wait(0.8); for (let k = 0; k < 66; k++) game.step(T, { fwd: -1, side: 0, jump: false, duck: false }); AP.wait(0.5); lg('box off b', P() + ' held ' + !!G.held + ' box ' + box.pos.map(v => v|0));
lg('to 880,300', JSON.stringify(AP.gotoRetry([880, 300, -256], 16, 3)).slice(0, 60), AP.approach([880, 300], 4, 3) + ' ' + P() + ' held ' + !!G.held);
lg('blue up 2', shoot(0, [1407, 300, 190]), 'repick ' + (G.held || pick()));
AP.approach([880, 300], 4, 3); for (let k = 0; k < 66 * 6 && game.pl.pos[2] < -100; k++) { game.pl.ang = [0, Math.atan2(254 - game.pl.pos[1], 1175 - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); } AP.wait(1.5); lg('walk in 2', P() + ' held ' + !!G.held + ' box ' + box.pos.map(v => v|0));
lg('to lift 1', JSON.stringify(AP.gotoRetry([1100, 448, 0], 16, 3)).slice(0, 60), P());
lg('on lift 1', leap([1110, 448], [960, 448], 14)); lg('lift 2', leap([960, 400], [960, 672], 108)); lg('lift 3', leap([960, 630], [960, 896], 104)); lg('corridor', leap([910, 896], [1300, 896], 112));
if (window.STAGE === 12) throw 'stage 12';
// up the ramp into the button room, the box on the floor button (it opens switch_door_*_a11 by the exit), then out
const fb = C(E('floor_button_trigger_box_lab5'));
lg('to button room', JSON.stringify(AP.gotoRetry([fb[0] - 60, fb[1], 0], 16, 3)).slice(0, 60), P() + ' held ' + !!G.held);
if (!G.held) lg('repick 3', pick());
lg('box on floor button', drop([fb[0], fb[1]], 10), 'door ' + E('floor_button_door_lab5').state, 'switch door ' + E('switch_door_left_a11').state);
if (window.STAGE === 13) throw 'stage 13';
// the incinerator (trigger_killbox behind incinerator_door_1, x 1392, y -192) takes the box and opens the exit doors. Its
// button is past the switch doors and only holds it open 13 s (wait 13), so press it while the box keeps those doors
// open, run back for the box (no settle wait: it's been resting on the button) and drop it in. Coming down the ramp, go south first and then straight west at it: cutting
// the corner puts the held box on the incinerator's side wall
const ib = C(E('button_incineratordoor_a13'));
lg('to incinerator button', JSON.stringify(AP.gotoRetry([ib[0] + 40, ib[1], -64], 16, 3)).slice(0, 60), P());
AP.lookAt(ib); AP.wait(0.2); G.use(); AP.wait(0.3); lg('pressed', io.log.filter(l => /incinerator/.test(l)).slice(-3));
lg('back to box', run([[1568, -373], [1568, -192], [1568, 150], [fb[0] - 10, fb[1] - 70]]), 'repick ' + pick(0.1));
if (window.STAGE === 14) throw 'stage 14';
run([[1576, 200], [1576, -40], [1576, -192]]); run([[1470, -192]]);
lg('to incinerator', P() + ' held ' + !!G.held, 'door ' + E('incinerator_door_1').state);
AP.lookAt([1380, -192, -40]); AP.wait(0.6); G.use(); AP.wait(3);
lg('box in', 'box ' + (box.alive ? box.pos.map(v => v|0) : 'gone'), io.log.filter(l => /killbox|exit_door|euthan/.test(l)).slice(-3));
lg('to elevator', JSON.stringify(AP.gotoRetry(F('a13_a14_trigger_elevator_move'), 40, 4)).slice(0, 160));
AP.wait(40, () => window.changedTo); lg('changedTo', window.changedTo + ' pos ' + P());
lg('aplog', AP.LOG.slice(-10)); lg('io', io.log.filter(l => !/teleport|fizzle|setanimation|energy ball|ball_/.test(l)).slice(-25));
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
