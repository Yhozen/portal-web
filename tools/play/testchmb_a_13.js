(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + io.log.filter(l => /failed/.test(l)).slice(-1); };
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
// then carry it down the ledge corridor into the ball hallway; the box passing create_steps_for_beginning_puzzle opens
// door_create_steps_for_first_puzzle (the steps back up). WALK/GOALS/REACH/DROP are knobs for exploring from there.
if (!window.STAGE || window.STAGE === 5) { const WALK = window.WALK || [[1620, 550], [1604, 400], [1604, 100], [1604, -200], [1604, -500], [1604, -650], [1604, -760], [1520, -860]]; if (window.DROP) { G.use(); AP.wait(1); } for (const w of WALK) { game.pl.ang = [0, Math.atan2(w[1] - game.pl.pos[1], w[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; lg('walk ' + w, AP.approach(w, 6, 4) + ' at ' + P()); } lg('steps door', JSON.stringify({ st: E('door_create_steps_for_first_puzzle').state, pos: E('door_create_steps_for_first_puzzle').pos, trig: E('create_steps_for_beginning_puzzle').killed || E('create_steps_for_beginning_puzzle').disabled, dead: G.dead || G.player.dead })); lg('after walk', 'held ' + !!G.held + ' box ' + box.pos.map(v => v|0) + ' ' + io.log.filter(l => /create_steps|autosave|energy|ball/.test(l)).slice(-6).join(' / ')); for (const t of window.GOALS || []) lg('goal ' + t, JSON.stringify(window.REACH ? AP.reach(t, 48) : AP.gotoRetry(t, 24, 3)).slice(0, 200) + ' held ' + !!G.held + ' at ' + P()); lg('aplog', AP.LOG.slice(-14)); lg('io', io.log.filter(l => !/teleport|fizzle|setanimation|energy ball|ball_/.test(l)).slice(-25)); throw 'stage 5'; }
// TODO (not reached): floor_button_lab5's room (x 1440..1683, glass on both sides) is only reachable from the lower
// complex south of it (incinerator, lifts lift1..3_rm5 raised by the three ball_trap catchers); see journey.md.
lg('box on lab5 button', JSON.stringify(AP.placeCube(G.held || box, C(E('floor_button_trigger_box_lab5')))).slice(0, 300) + ' at ' + P()); AP.wait(1.5);
lg('switch doors', E('switch_door_left_a11').state + ' ' + io.log.filter(l => /floor_button_door_lab5/.test(l)).slice(-2));
if (window.STAGE === 2) throw 'stage 2';
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
