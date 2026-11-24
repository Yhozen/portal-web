(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
let lastFail = null; { const f0 = G.fizzleShot.bind(G); G.fizzleShot = (w, why) => { lastFail = 'portal ' + w + ' failed: ' + why; return f0(w, why); }; } // io.log keeps only the last 400 lines
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); lastFail = null; G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open && !lastFail ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail; };
const fly = (min = 0.3, max = 8) => { let top = -1e9; for (let k = 0; k < max * 66; k++) { game.step(1 / 66, { fwd: 0, side: 0, jump: false, duck: false }); top = Math.max(top, game.pl.pos[2]); if (k > min * 66 && game.pl.onGround) break; } return game.pl.pos.map(v => v | 0) + ' top ' + (top | 0); };
const T = 1 / 66, idle = { fwd: 0, side: 0, jump: false, duck: false };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun);
if (window.STAGE === 1) throw 'stage 1';
// the pellet room: energy_ball_launcher_rm8 (-254, -63, 204) fires straight down onto the east-facing tilted panel;
// ball_trap_10 is in the ceiling over the west-facing one (x -432..-337, z 309..469). Orange on the east panel, blue on
// the west panel: the ball comes out of the west panel going west, off the west wall and back. Move blue away while
// it's out there and it hits the bare west panel, which turns it straight up into the trap
lg('west of panels', JSON.stringify(AP.gotoRetry([-520, -60, 0], 16, 3)).slice(0, 60), P());
AP.approach([-520, -64], 3, 2); lg('blue west panel', P(), shoot(0, [-390, -64, 44]));
// orange has to be shot facing due west (the panel is too short for a portal turned across it), from the ball's lane
// (y -63): go in while the ball is on its way down from the launcher, and straight back out
lg('north of lane', JSON.stringify(AP.gotoRetry([-150, 40, 0], 16, 3)).slice(0, 60), P());
AP.wait(6, () => G.balls.some(b => b.pos[0] > -260 && b.pos[0] < -248 && b.vel[2] < 0 && b.pos[2] > 150));
AP.approach([-150, -64], 3, 2); lg('orange east panel', P(), shoot(1, [-260, -64, 54])); AP.approach([-150, 60], 3, 2);
{ const t0 = io.time, trap = io.ents.find(e => e.name === 'ball_trap_10'); let moved = false, caught = false;
  for (let k = 0; k < 20 * 66; k++) { game.step(T, idle);
    if (!moved && G.balls.some(b => b.pos[0] < -440 && b.vel[0] < 0)) { moved = true; lg('ball out west', (io.time - t0).toFixed(2), shoot(0, [-192, 256, 0])); }
    if (trap && !trap.enabled) { caught = true; break; } }
  lg('catcher', caught, (io.time - t0).toFixed(1), 'moved blue', moved); }
if (window.STAGE === 2) throw 'stage 2';
// the scaffold (rail_cart_lab2, 96 x 96, top flush with the floor, 40 u/s) comes up out of the floor at (-416, 400) and
// runs east along y 400, north to 512, east to x 64 (a pipe across it there: duck), then south past the switch island
const cart = io.ents.find(e => e.name === 'rail_cart_lab2').col;
const until = (f, max = 30) => { for (let k = 0; k < max * 66 && !f(); k++) game.step(T, idle); return f(); };
// ride: keep to the cart's centre (the player is carried; this only corrects drift), ducking while `duck(c)` says so
const ride = (stop, duck = () => false, max = 60) => { for (let k = 0; k < max * 66 && !stop(cart.offset); k++) { const dx = cart.offset[0] - game.pl.pos[0], dy = cart.offset[1] - game.pl.pos[1], d = Math.hypot(dx, dy);
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: d > 10 ? 1 : 0, side: 0, jump: false, duck: duck(cart.offset) }); } return P() + ' cart ' + cart.offset.map(v => v | 0); };
lg('to the cart hole', JSON.stringify(AP.gotoRetry([-416, 320, 0], 16, 3)).slice(0, 60), P());
lg('cart up', until(() => cart.offset[2] > -10 && cart.offset[0] > -420), cart.offset.map(v => v | 0));
lg('board', ride(c => Math.hypot(c[0] - game.pl.pos[0], c[1] - game.pl.pos[1]) < 12 && game.pl.groundEnt, () => false, 6), game.pl.groundEnt && game.pl.groundEnt.cls);
lg('ride to the corner', ride(c => c[0] > 60 && c[1] < 500, c => c[1] > 500 && c[0] > -200));
lg('ride south', ride(c => c[1] < 260), game.pl.groundEnt && game.pl.groundEnt.cls);
if (window.STAGE === 3) throw 'stage 3';
// off onto the switch island (x 150..300, y 150..300) and press the switch (284, 224): railway_door_lab2 opens
for (let k = 0; k < 66 && game.pl.pos[0] < 170; k++) { game.pl.ang = [0, 0, 0]; game.step(T, { fwd: 1, side: 0, jump: k === 0, duck: false }); }
lg('on the island', P(), game.pl.groundEnt ? game.pl.groundEnt.cls : 'world');
lg('to switch', JSON.stringify(AP.gotoRetry([240, 224, 0], 12, 3)).slice(0, 60), P());
AP.lookAt([284, 224, 50]); AP.wait(0.1); G.use(); AP.wait(1); lg('switch', io.log.filter(l => /railway_door|switch1|tracktraindoor/.test(l)).slice(-3));
if (window.STAGE === 4) throw 'stage 4';
// the door's only up a second (wait 1) and then comes down at 35 u/s, far too soon to get back on the cart before it.
// The wiki's way: while it's up, blue through it onto the door channel's west wall (x 0, faces east) from the
// island's north side, orange on the island's south wall (y 128, faces north), and step through when the cart going
// south down the channel is level with blue: you come out over it
{ let r = ''; game.pl.ang = [0, -120, 0]; AP.approach([168, 300], 4, 2); for (const t of [[0, -111, 61], [0, -100, 60], [0, -60, 61]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue past the door', P(), r, 'door ' + io.ents.find(e => e.name === 'railway_door_lab2').t.toFixed(2)); }
{ let r = ''; AP.approach([220, 200], 4, 2); for (const t of [[220, 128, 60], [240, 128, 60], [200, 128, 64]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange island wall', P(), r); }
{ const bp = G.gunPortals[0].pos, op = G.gunPortals[1].pos; AP.approach([op[0], op[1] + 60], 4, 2);
  // the walk in takes about (60 - 16) / 150 s; aim to come out with the cart's centre ~20 units north of blue
  lg('waiting for the cart', until(() => cart.offset[1] < bp[1] + 20 + 12 && cart.offset[1] > bp[1] - 40, 30), 'cart ' + cart.offset.map(v => v | 0));
  const n0 = G.stats.teleports; for (let k = 0; k < 2 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [0, -90, 0]; game.step(T, { fwd: 1, side: (op[0] - game.pl.pos[0]) / 30, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, fly(0.05, 2), game.pl.groundEnt ? game.pl.groundEnt.cls : 'none', 'cart ' + cart.offset.map(v => v | 0)); }
if (window.STAGE === 5) throw 'stage 5';
lg('ride west', ride(c => c[0] < -600, () => false, 40), game.pl.groundEnt ? game.pl.groundEnt.cls : 'none', 'hp ' + (G.health ?? '-'));
if (window.STAGE === 6) throw 'stage 6';
// going north up the west channel the cart passes under a wall (y 136) that stops the player. The wiki's way round:
// a portal on the wall ahead and one on the channel's west wall behind it, seen through the gap at the wall's west
// end, and through once the cart's far enough along to land on
lg('ride north', ride(c => c[1] > 0, () => false, 40), game.pl.groundEnt ? game.pl.groundEnt.cls : 'none');
for (let k = 0; k < 40; k++) { const pl = game.pl; pl.ang = [0, 90, 0]; game.step(T, { fwd: (cart.offset[1] + 20 - pl.pos[1]) / 30, side: ((cart.offset[0] - 30) - pl.pos[0]) / 30, jump: false, duck: false }); }
{ let r = ''; for (const t of [[-832, 190, 64], [-832, 210, 64], [-832, 240, 64]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange behind the wall', P(), r, 'cart ' + cart.offset.map(v => v | 0)); }
lg('to the wall', ride(c => c[1] > 120, () => false, 10), P());
{ let r = ''; for (const t of [[-740, 128, 64], [-712, 128, 64], [-760, 128, 64]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue on the wall', P(), r, 'cart ' + cart.offset.map(v => v | 0)); }
until(() => cart.offset[1] > 160, 4);
{ const n0 = G.stats.teleports; for (let k = 0; k < 2 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [0, 90, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); }
  for (let k = 0; k < 66 && !(game.pl.onGround); k++) { game.pl.ang = [0, 0, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, P(), game.pl.groundEnt ? game.pl.groundEnt.cls : 'none', 'cart ' + cart.offset.map(v => v | 0)); }
lg('ride on', ride(c => c[1] > 440, () => false, 20), game.pl.groundEnt ? game.pl.groundEnt.cls : 'none');
lg('ride on west', ride(c => c[0] < -1000, () => false, 40), game.pl.groundEnt ? game.pl.groundEnt.cls : 'none', io.log.slice(-4));
if (window.STAGE === 7) throw 'stage 7';
// the cart runs down a ramp into the incinerator (no fire damage here yet). The way out is the upper deck west of it
// (floor z 0, over the fire room's ceiling): blue high on the deck's west wall (x -2112, faces east), seen over the
// deck's edge from the ramp, and orange on the ramp's north wall beside you
lg('down the ramp', ride(c => c[0] < (window.RX ?? -1350), () => false, 30), P());
{ let r = ''; for (const t of (window.BT ?? [[-2112, 448, 70], [-2112, 448, 90], [-2112, 420, 80]])) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue deck wall', P(), r); }
// orange on the trench floor north of the cart (the cart's 96 wide, the trench 320): step off the cart's north edge
// and fall into it; you come out of blue moving east and land on the deck
lg('on down', ride(c => c[0] < (window.RX2 ?? -1560), () => false, 30), P());
// to the cart's north edge first: from its middle the shot down at the floor hits the cart
for (let k = 0; k < 66 && game.pl.pos[1] < cart.offset[1] + 36; k++) { game.pl.ang = [0, 90, 0]; game.step(T, { fwd: 0.5, side: (cart.offset[0] - game.pl.pos[0]) / 20, jump: false, duck: false }); }
{ let r = ''; for (const t of (window.OT ?? [[game.pl.pos[0] - 50, 540, -320], [game.pl.pos[0] - 90, 540, -320], [game.pl.pos[0] - 110, 520, -320]])) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange trench floor', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: Math.min(1, Math.hypot(dx, dy) / (window.FD ?? 80)), side: 0, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, fly(0.05, 3), game.pl.groundEnt ? game.pl.groundEnt.cls : 'world', io.log.filter(l => /upperdeck|survivedfire/.test(l)).slice(-2)); }
if (window.STAGE === 8) throw 'stage 8';
// up out of the chimney: the deck's west wall takes portals up to about z 700 (metal above; at 700 the head
// catches the beam along the wall coming out fast, so 640), and the tank room east of
// the trench opens onto the chimney between z 352 and about 590. Blue high on the west wall, orange on the deck floor
// where you land coming out of blue at walking-in speed (~210 u/s east, ~290 out from the wall): step in slowly, drop out of blue, fall back into orange, and the second time out of blue you're going ~900 u/s
// east, enough to cross the trench into the tank room
AP.approach(window.DA ?? [-1900, 448], 4, 2); // from the west, so orange lies along x
{ let r = ''; for (const t of (window.AT ?? [[-2112, 448, 640], [-2112, 430, 640], [-2112, 466, 640]])) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue high west wall', P(), r); }
{ let r = ''; for (const t of (window.BF ?? [[-1810, 448, 0], [-1820, 448, 0], [-1830, 448, 0]])) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange deck floor', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports, tr = [];
  for (let k = 0; k < 8 * 66; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; if (G.stats.teleports === n0) game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: G.stats.teleports === n0 ? (window.FS ?? 0.3) : 0, side: 0, jump: false, duck: false });
    if (k % 20 === 0) tr.push(P() + '/' + game.pl.vel.map(v => v | 0)); if (G.stats.teleports - n0 >= 2 && game.pl.onGround) break; if (G.stats.teleports - n0 === 1 && game.pl.onGround && k > 66) break; }
  lg('fall loop', G.stats.teleports - n0, P(), game.pl.groundEnt ? game.pl.groundEnt.cls : 'world', tr.join(' ')); }
if (window.STAGE === 9) throw 'stage 9';
// the stairs room: the stairs up to the catwalk (z 512) are broken. Blue on the east wall just above the catwalk
// (bottom at the catwalk's height), orange on the floor inside the catwalk's ring, and walk in
lg('stairs room', JSON.stringify(AP.gotoRetry([-1200, 1200, 384], 16, 3)).slice(0, 60), P());
{ let r = ''; for (const t of [[-903, 1300, 566], [-903, 1250, 575], [-903, 1330, 570]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue over the catwalk', P(), r); }
{ let r = ''; for (const t of [[-1030, 1250, 384], [-1020, 1280, 384], [-1040, 1220, 384]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange room floor', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 8 * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: Math.min(1, Math.hypot(dx, dy) / 60), side: 0, jump: false, duck: false }); }
  // you come out going west at ~190 and the catwalk's 64 wide: brake against it (east) from the moment you're out
  for (let k = 0; k < 66; k++) { game.pl.ang = [0, 0, 0]; game.step(T, { fwd: game.pl.pos[0] < -930 ? 1 : Math.max(0, Math.min(1, -game.pl.vel[0] / 100)), side: 0, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, P(), game.pl.onGround); }
if (window.STAGE === 10) throw 'stage 10';
for (const g of (window.G11 ?? [[-860, 1370, 640], [-420, 1400, 640]])) lg('walk', g, JSON.stringify(AP.gotoRetry(g, 16, 3)).slice(0, 90), P());
if (window.STAGE === 11) throw 'stage 11';
// the fenced alcove with the door (metaldoor_white01, x -445): blue on its west wall through the fence, orange on the
// catwalk's east wall beside you, walk in
{ let r = ''; for (const t of [[-511, 1224, 700], [-511, 1210, 690], [-511, 1224, 720]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue behind the fence', P(), r); }
{ let r = ''; for (const t of [[-384, 1413, 690], [-384, 1450, 690], [-430, 1535, 690]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange beside', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); }
  AP.wait(0.5); lg('through', G.stats.teleports > n0, P(), game.pl.onGround); }
AP.approach([-490, 1200], 3, 2); AP.lookAt([-499, 1166, 690]); AP.wait(0.1); G.use(); AP.wait(1.5); lg('door', P(), io.log.filter(l => /d2_tc15/.test(l)).slice(-3));
for (const g of (window.G13 ?? [[-490, 1100, 640], [-200, 1100, 640]])) lg('walk', g, JSON.stringify(AP.gotoRetry(g, 16, 3)).slice(0, 90), P());
if (window.STAGE === 12) throw 'stage 12';
// the big fan (rotating_fan3): blue through its blades on the wall behind it (y 1279), orange on the floor here, in
{ let r = ''; for (let i = 0; i < 12; i++) { const t = [[-128, 1279, 700], [-128, 1279, 740], [-160, 1279, 720]][i % 3]; r = shoot(0, t); if (!/not placed/.test(r) && G.gunPortals[0].pos[1] > 1270) break; AP.wait(0.2); } lg('blue behind the fan', P(), r); }
{ let r = ''; for (const t of [[-150, 1040, 640], [-180, 1030, 640], [-120, 1040, 640]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange floor', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: Math.min(1, Math.hypot(dx, dy) / 60), side: 0, jump: false, duck: false }); }
  AP.wait(0.5); lg('through', G.stats.teleports > n0, P(), game.pl.onGround); }
if (window.STAGE === 13) throw 'stage 13';
// the duct behind the fan slopes down east into the goo room (goo up to z 512). Across it a ledge at z 768 runs along
// the east wall: from partway down the duct, orange on the wall above the ledge (x 1151), then back up the duct and
// into blue, which is still behind the fan
lg('down the duct', JSON.stringify(AP.gotoRetry([60, 1235, 600], 16, 3)).slice(0, 60), P());
{ let r = ''; for (const t of [[1148, 1100, 822], [1148, 1080, 830], [1148, 1150, 822]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange above the ledge', P(), r); }
lg('back up', JSON.stringify(AP.gotoRetry([-111, 1225, 640], 16, 3)).slice(0, 60), P());
{ const n0 = G.stats.teleports; for (let k = 0; k < 3 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [0, 90, 0]; game.step(T, { fwd: 1, side: (G.gunPortals[0].pos[0] - game.pl.pos[0]) / 20, jump: false, duck: false }); }
  for (let k = 0; k < 66; k++) { game.pl.ang = [0, 180, 0]; game.step(T, idle); }
  lg('through', G.stats.teleports > n0, P(), game.pl.onGround); }
if (window.STAGE === 14) throw 'stage 14';
// the stairs down from the ledge to the west catwalk (z 768, x 375..425) are broken over the goo. Blue high on the
// goo room's west wall (x 256) so that coming out at walking speed you fall onto the catwalk ~120 units out, orange on
// the east wall beside the ledge's door, and walk east into it
AP.approach([1000, 640], 4, 2);
{ let r = ''; for (const t of (window.WT ?? [[256, 700, 1020], [256, 680, 1000], [256, 720, 1040]])) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue west wall', P(), r); }
{ let r = ''; for (const t of [[1151, 640, 822], [1151, 680, 822], [1151, 600, 830]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange east wall', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 3 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [0, 0, 0]; game.step(T, { fwd: 1, side: -(op[1] - game.pl.pos[1]) / 20, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, fly(0.05, 3), game.pl.groundEnt ? game.pl.groundEnt.cls : 'world'); AP.wait(0.5); lg('on', P()); }
if (window.STAGE === 15) throw 'stage 15';
for (const g of (window.G16 ?? [[400, 1230, 768], [600, 1450, 640]])) lg('walk', g, JSON.stringify(AP.gotoRetry(g, 16, 3)).slice(0, 90), P());
if (window.STAGE === 16) throw 'stage 16';
// down the stairs; the platform up north-east (z 960, a strip y 1600..1660 along the shaft) is reached through blue on
// the east wall at its end (x 896) and orange on the floor here
{ let r = ''; for (const t of [[896, 1630, 1030], [896, 1625, 1035], [896, 1635, 1040]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue over the platform', P(), r); }
{ let r = ''; for (const t of [[540, 1440, 640], [520, 1450, 640], [560, 1460, 640]]) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange floor', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: Math.min(1, Math.hypot(dx, dy) / 60), side: 0, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, fly(0.05, 3), game.pl.groundEnt ? game.pl.groundEnt.cls : 'world'); AP.wait(0.5); lg('on', P()); }
if (window.STAGE === 17) throw 'stage 17';
// over to the broken catwalk (the west platform's z 960 catwalk, reaching east to x ~510 before it breaks off): orange
// on the room floor below the strip's west end, blue on the east wall at the catwalk's height (x 896, y 1350, the
// corner facing it), and off the strip into orange: ~620 u/s out of blue going west lands on the catwalk's end
AP.approach([675, 1615], 3, 2);
{ let r = ''; for (const t of (window.OF ?? [[600, 1450, 640], [580, 1440, 640], [620, 1460, 640]])) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange room floor', P(), r); }
{ let r = ''; for (const t of [[896, 1350, 1088], [896, 1344, 1080], [896, 1360, 1095]]) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue east wall', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, fly(0.05, 3), game.pl.groundEnt ? game.pl.groundEnt.cls : 'world'); AP.wait(0.5); lg('on', P()); }
if (window.STAGE === 18) throw 'stage 18';
for (const g of (window.G19 ?? [[150, 1350, 960], [100, 1170, 1127]])) lg('walk', g, JSON.stringify(AP.gotoRetry(g, 16, 3)).slice(0, 90), P());
if (window.STAGE === 19) throw 'stage 19';
// over the handrail into the broken tube; its trigger_pushes carry you on
// (the hole in its top is x 0..112, y 944..1024: the cover runs only to y 944 there)
AP.approach(window.HJ ?? [56, 1110], 3, 2);
// the ride drops you into a shaft above the box dropper; its 64-unit hole (x 1600..1664, y 480..544, rim z 928) needs
// steering back from the shaft's south wall, where the last push's momentum throws you
{ const tr = []; for (let k = 0; k < 25 * 66; k++) { const t = k / 66, p = game.pl.pos, drop = p[0] > 1560 && p[1] < 600 && p[2] < 1340 && p[2] > 900 && !game.pl.onGround;
    const dx = 1632 - p[0], dy = 512 - p[1]; game.pl.ang = [0, drop ? Math.atan2(dy, dx) * 180 / Math.PI : -90, 0];
    game.step(T, { fwd: drop ? Math.min(1, Math.hypot(dx, dy) / 8) : t < 1.5 && p[1] > (window.HY ?? 990) ? 1 : 0, side: t < 1.5 ? (56 - p[0]) / 20 : 0, jump: t < 1.5 && game.pl.onGround && p[1] < 1110, duck: (t < 1.5 && !game.pl.onGround) || drop });
    if (k % 33 === 0) tr.push(io.time.toFixed(1) + ':' + P() + (game.pl.onGround ? '' : '*')); if (G.changedTo || window.changedTo || (t > 5 && game.pl.onGround && game.pl.pos[2] < 700)) break; }
  lg('tube', tr.join(' '), window.changedTo || ''); }
if (window.STAGE === 20) throw 'stage 20';
// the a02-style room under the dropper: its floor button opens the exit door only while held, so stand on it, put
// blue through the open doorway on the corridor's far wall (x 2495) and orange on the room's east wall beside the door
lg('to button', JSON.stringify(AP.gotoRetry(window.BTN ?? [1891, 256, 640], 20, 5, 1)).slice(0, 120), P()); AP.wait(1);
{ const d = E('exit_door_left_a05'); lg('door', d.state, (d.pos || d.origin).map(v => v|0)); }
{ let r = ''; for (const t of (window.CB ?? [[2495, 256, 700], [2495, 240, 690], [2495, 270, 710]])) { r = shoot(0, t); if (!/not placed/.test(r)) break; } lg('blue corridor', P(), r); }
{ let r = ''; for (const t of (window.CO ?? [[2251, 390, 700], [2251, 380, 700], [2251, 120, 700]])) { r = shoot(1, t); if (!/not placed/.test(r)) break; } lg('orange room wall', P(), r); }
{ const op = G.gunPortals[1].pos, n0 = G.stats.teleports; for (let k = 0; k < 8 * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); }
  lg('through', G.stats.teleports > n0, P()); AP.wait(0.5); lg('on', P()); }
if (window.STAGE === 21) throw 'stage 21';
// past the fizzler to the old a05-a06 elevator: its car waits at the top of the shaft (path p4, z 1304), so the shaft
// below the floor at y > 672 is open down to z -95
lg('to shaft', JSON.stringify(AP.gotoRetry([2432, 620, 640], 10, 5, 1)).slice(0, 90), P());
{ for (let k = 0; k < 4 * 66 && !(game.pl.pos[2] < 0 && game.pl.onGround); k++) { game.pl.ang = [0, 90, 0]; game.step(T, { fwd: game.pl.pos[1] < 768 ? 1 : 0, side: 0, jump: false, duck: false }); } lg('shaft bottom', P()); }
if (window.STAGE === 22) throw 'stage 22';
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
