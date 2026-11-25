(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent, F = n => AP.floorUnder(E(n));
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
let lastFail = null; { const f0 = G.fizzleShot.bind(G); G.fizzleShot = (w, why) => { lastFail = 'portal ' + w + ' failed: ' + why; return f0(w, why); }; } // io.log keeps only the last 400 lines
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); lastFail = null; G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open && !lastFail ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail; };
const fly = (min = 0.3, max = 8) => { let top = -1e9; for (let k = 0; k < max * 66; k++) { game.step(1 / 66, { fwd: 0, side: 0, jump: false, duck: false }); top = Math.max(top, game.pl.pos[2]); if (k > min * 66 && game.pl.onGround) break; } return game.pl.pos.map(v => v | 0) + ' top ' + (top | 0); };
const T = 1 / 66, idle = { fwd: 0, side: 0, jump: false, duck: false };
const tryShoot = (which, ts) => { let r = ''; for (const t of ts) { r = shoot(which, t); if (!/not placed/.test(r)) break; } return r; };
// walk straight into a portal (wall or floor) until it teleports
const walkInto = (which, max = 6, opts = {}) => { const op = G.gunPortals[which].pos, n0 = G.stats.teleports; for (let k = 0; k < max * 66 && G.stats.teleports === n0; k++) { const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: opts.slow ? Math.min(1, Math.hypot(dx, dy) / 40) : 1, side: 0, jump: false, duck: !!opts.duck }); } return G.stats.teleports > n0; };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun);
// five pistons: the middle one (crusher_room_1_00) stops at z -344, short of the ceiling; from its top blue goes on the
// wall past the east ledge (z -320), then orange low on the south wall, clear of the pistons' 152-unit bodies
const mp = E('crusher_room_1_00'), top = () => mp.pos[2] + mp.bmaxs[2] - mp.origin[2];
lg('to the room', JSON.stringify(AP.gotoRetry([128, -900, -831], 20, 20, 1)).slice(0, 90), P());
AP.wait(20, () => top() < -820); lg('piston down', top() | 0);
// the piston's body (a parented 152-unit func_brush) stands 24 units proud of the floor even when down: jump onto it
lg('beside it', JSON.stringify(AP.gotoRetry([128, -935, -831], 6, 4, 1)).slice(0, 60), P());
{ for (let k = 0; k < 3 * 66; k++) { const dx = 128 - game.pl.pos[0], dy = -832 - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: Math.min(1, Math.hypot(dx, dy) / 10), side: 0, jump: k < 3, duck: k > 1 && k < 30 }); if (Math.hypot(dx, dy) < 3 && game.pl.onGround && k > 30) break; } lg('on top', P()); }
AP.wait(15, () => top() > -350); AP.wait(0.3); lg('on the piston', P(), top() | 0);
lg('blue past the east ledge', P(), tryShoot(0, window.EB ?? [[703, -800, -270], [703, -810, -270], [703, -790, -260]]));
AP.wait(15, () => top() < -820); lg('piston down again', P());
lg('off', JSON.stringify(AP.gotoRetry([60, -960, -831], 6, 4, 1)).slice(0, 60), P());
lg('orange east wall', P(), tryShoot(1, window.EO ?? [[60, -1040, -780], [40, -1040, -780], [20, -1040, -780]]));
lg('through', walkInto(1), P()); AP.wait(1); lg('east ledge', P());
if (window.STAGE === 1) throw 'stage 1';
// two pistons under a ledge (GameFAQs, arandomgamer02): one portal on the dark mark crusher_room_2_0 leaves on the ledge's
// underside, the other high on the grey wall seen looking up from the floor west of the pistons (y -31, facing north,
// over the walkways); ride the piston up into the mark and come out over the walkway
const cr = E('crusher_room_2_0'), ctop = () => cr.pos[2] + cr.bmaxs[2] - cr.origin[2];
lg('two-piston room', JSON.stringify(AP.gotoRetry([528, 450, -576], 20, 6, 1)).slice(0, 90), P());
AP.approach([528, 450], 2, 3); AP.wait(0.3); lg('orange high wall', P(), (() => { game.pl.ang = [-55, 270, 0]; AP.wait(0.2); lastFail = null; G.shootPortal(1); AP.wait(0.15); const Q = G.gunPortals[1]; return Q.open && !lastFail ? Q.pos.map(v => v|0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail; })());
lg('to the mark', JSON.stringify(AP.gotoRetry([660, 224, -576], 12, 6, 1)).slice(0, 60), P());
AP.wait(20, () => ctop() < -530); lg('crusher down', ctop() | 0);
lg('blue on the mark', P(), tryShoot(0, window.MK ?? [[784, 224, -352], [784, 210, -352], [784, 240, -352]]));
AP.wait(20, () => ctop() > -400); AP.wait(20, () => ctop() < -538); lg('crusher down again', ctop() | 0, P());
{ const n0 = G.stats.teleports; let k = 0; for (; k < 3 * 66; k++) { const dx = 784 - game.pl.pos[0], dy = 224 - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(T, { fwd: Math.min(1, Math.hypot(dx, dy) / 10), side: 0, jump: k < 3, duck: k > 1 && k < 30 }); if (Math.hypot(dx, dy) < 4 && game.pl.onGround && k > 30) break; }
  lg('on crusher 2_0', P(), game.pl.groundEnt && game.pl.groundEnt.name, ctop() | 0);
  const tr2 = []; for (k = 0; k < 8 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [-80, 270, 0]; game.step(T, idle); if (k % 33 === 0) tr2.push((ctop() | 0) + '/' + (game.pl.pos[2] | 0) + '/' + cr.state); } lg('ride', tr2.join(' '));
  lg('rode into the mark', G.stats.teleports > n0, P(), game.pl.vel.map(v => v | 0)); lg('landed', fly(0.2, 4)); }
if (window.STAGE === 2) throw 'stage 2';
const standAt = (x, y) => {
  for (let k = 0; k < 6 * 66; k++) {
    const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1], dist = Math.hypot(dx, dy);
    if (dist < 2 && Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 8 && game.pl.onGround && k > 5) break;
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: Math.min(0.8, dist / 12), side: 0, jump: false, duck: false });
  }
  game.pl.vel = [0, 0, 0]; AP.wait(0.2); lg('stood', game.pl.pos.map(v => +v.toFixed(1)));
};
const placeAt = (which, at) => {
  const eye = game.pl.eye(); const d = at.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1, f = d.map(v => v / l);
  lastFail = null; G.shootPortal(which, { eye, f }); AP.wait(0.1);
  const Q = G.gunPortals[which];
  return Q.open && !lastFail ? Q.pos.map(v => v | 0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail;
};
// next ledge (the red arrow at 547, 128, 352): blue high on the east wall from the walkway's east end,
// orange on the lower floor, hop onto the z -59 ledge at (700, 117) and drop in. The fall comes out at
// ~562 u/s and lands on the z=320 south strip. Stand still on the ledge first: a running hop flies past
// the floor portal and misses it.
lg('to shoot blue', JSON.stringify(AP.gotoRetry([850, 80, -64], 10, 4, 1)).slice(0, 80), P());
standAt(850, 80);
lg('blue east wall high', P(), placeAt(0, window.SB ?? [890, 170, 400]));
lg('to the rail', JSON.stringify(AP.gotoRetry([700, 80, -64], 8, 4, 1)).slice(0, 80), P());
standAt(700, 80);
{ for (let k = 0; k < 2 * 66; k++) { game.pl.ang = [10, 90, 0]; game.step(T, { fwd: 0.6, side: 0, jump: k < 8, duck: false }); if (game.pl.onGround && game.pl.pos[1] > 110 && k > 15) break; }
  game.pl.vel = [0, 0, 0]; AP.wait(0.25); lg('on the ledge', P()); }
lg('orange lower floor', P(), placeAt(1, window.SF ?? [700, 250, -319]));
{ const n0 = G.stats.teleports;
  for (let k = 0; k < 4 * 66 && G.stats.teleports === n0; k++) { game.pl.ang = [40, 90, 0]; game.step(T, { fwd: 1, side: 0, jump: k < 8, duck: false }); }
  lg('strip fling out', G.stats.teleports > n0, P(), game.pl.vel.map(v => v | 0));
  for (let k = 0; k < 5 * 66; k++) { game.pl.ang = [0, 180, 0]; game.step(T, { fwd: 0.2, side: -1, jump: false, duck: false }); if (game.pl.onGround && k > 6) break; }
  lg('strip fling land', P(), game.pl.onGround);
  for (let k = 0; k < 3 * 66; k++) { game.pl.ang = [0, 270, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); if (game.pl.pos[1] < 120 && game.pl.onGround && game.pl.pos[2] > 300) break; }
  lg('south strip', P(), game.pl.onGround); }
if (window.STAGE === 3) throw 'stage 3';
// high-speed pistons: blue on the wall past them (x -127), orange on the y=0 wall you can walk into
{
  // the corridor mouth is south of the y=-24 wall; hugging that corner pins you at (255, -24)
  const go = (x, y, max = 5) => {
    for (let k = 0; k < max * 66; k++) {
      const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1], dist = Math.hypot(dx, dy);
      if (dist < 8 && game.pl.onGround) break;
      game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
      game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
    }
  };
  go(280, 80); go(276, -54); go(150, -46);
  lg('at the pistons', P());
  lg('blue past them', placeAt(0, window.PB ?? [-127, -150, 384]));
  lg('orange walk-into', placeAt(1, window.PO ?? [150, 0, 384]));
  lg('past the pistons', walkInto(1, 5), P());
  for (let k = 0; k < 2 * 66; k++) { game.step(T, { fwd: 0, side: 0, jump: false, duck: false }); if (game.pl.onGround && k > 8) break; }
  lg('landed past', P(), game.pl.onGround);
  go(-90, 31, 6);
  lg('vertical pistons', P());
}
if (window.STAGE === 4) throw 'stage 4';
const stepOffWall = (xMin = 100, max = 0.6) => {
  // walk out along the exit portal's normal (west is wrong when the exit is on the west wall)
  const b = G.gunPortals[0];
  const yaw = b && b.open ? Math.atan2(b.f[1], b.f[0]) * 180 / Math.PI : 180;
  for (let k = 0; k < max * 66; k++) {
    game.pl.ang = [0, yaw, 0];
    game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
    if (k > 12 && game.pl.onGround && Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 30) break;
  }
};
const thruWall = (blueAt, orangeAt, tag, opts = {}) => {
  lg('blue ' + tag, placeAt(0, blueAt));
  lg('orange ' + tag, placeAt(1, orangeAt));
  lg('through ' + tag, walkInto(1, 5), P());
  stepOffWall(opts.xMin ?? 50, opts.off ?? 1);
  for (let k = 0; k < 2 * 66; k++) { game.step(T, { fwd: 0, side: 0, jump: false, duck: false }); if (game.pl.onGround && k > 8) break; }
  lg('land ' + tag, P(), game.pl.onGround, game.pl.groundEnt && game.pl.groundEnt.name);
};
// from a piston (or the floor), put the walk-into on the east wall at this y / eye height and hop to blueAt
const thruFromHere = (blueAt, tag) => {
  const eye = game.pl.eye();
  const orangeAt = [127, game.pl.pos[1], eye[2]];
  lg('blue ' + tag, placeAt(0, blueAt));
  lg('orange ' + tag, placeAt(1, orangeAt));
  lg('through ' + tag, walkInto(1, 5), P());
  stepOffWall(100, 0.6);
  for (let k = 0; k < 3 * 66; k++) { game.step(T, { fwd: 0, side: 0, jump: false, duck: false }); if (game.pl.onGround && k > 8) break; }
  lg('land ' + tag, P(), game.pl.onGround, game.pl.groundEnt && game.pl.groundEnt.name);
};
// the far north wall at y=767 is visible past the two vertical blockers; skip them
thruWall(window.FW ?? [-155, 767, 384], window.FN ?? [-127, 47, 384], 'far wall');
if (window.STAGE === 5) throw 'stage 5';
// "over here": portal above a horizontal piston, walk into a nearby wall, land on crusher01, then up to crusher05
thruWall(window.C1 ?? [127, 455, 633], window.C1O ?? [127, 735, 384], 'crusher01', { xMin: 100, off: 0.6 });
if (window.STAGE === 6) throw 'stage 6';
thruFromHere(window.C5 ?? [127, 582, 715], 'crusher05');
if (window.STAGE === 7) throw 'stage 7';
// next layer: west wall above crusher08 (top 826). The east-wall / south-wall hop at
// the two highest pistons still wedges in the y=256 lip, so this is the reliable up.
thruFromHere(window.C8 ?? [-255, 640, 900], 'crusher08');
if (window.STAGE === 8) throw 'stage 8';
// the two highest pistons (crusher15/17, bottoms 1096) sit flush with the south wall;
// a portal in the gap between them (x=-136..8) exits at z=1088 onto crusher12 (top 1080).
thruWall(window.C12 ?? [-64, 256, 1143], window.C12O ?? [-255, 620, 890], 'crusher12', { off: 0.35 });
game.pl.vel = [0, 0, 0];
if (window.STAGE === 9) throw 'stage 9';
// past the y=768 fence: west wall of the z=1088 floor, walk into the same south-wall portal
thruWall(window.CFF ?? [-192, 1100, 1144], window.CFFO ?? [-64, 256, 1143], 'far floor', { off: 0.3 });
game.pl.vel = [0, 0, 0];
if (window.STAGE === 10) throw 'stage 10';
// drop onto the upper cube tube (y=1216, top 948). A run overshoots the crest; stay off the
// vertical tube at x=-96. Landing on the tube also fires trigger_once → crusher01_esc00 loops.
{
  const go = (x, y, max = 5, cap = 0.6) => {
    for (let k = 0; k < max * 66; k++) {
      const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1], dist = Math.hypot(dx, dy);
      if (dist < 4 && game.pl.onGround && Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 15) break;
      game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
      game.step(T, { fwd: Math.min(cap, dist / 20), side: 0, jump: false, duck: false });
    }
    game.pl.vel = [0, 0, 0];
  };
  go(-30, 1140, 5, 0.6);
  lg('tube drop point', P());
  for (let k = 0; k < 6 * 66; k++) {
    game.pl.ang = [0, 90, 0];
    game.step(T, { fwd: 0.15, side: 0, jump: false, duck: false });
    if (game.pl.onGround && k > 20 && game.pl.pos[2] < 1000 && game.pl.pos[1] > 1190) break;
  }
  game.pl.vel = [0, 0, 0];
  lg('on upper tube', P(), game.pl.onGround);
}
if (window.STAGE === 11) throw 'stage 11';
// walk east along the crest (~y=1224) to the crossing at x=576, ducked
{
  for (let k = 0; k < 20 * 66; k++) {
    const dx = 576 - game.pl.pos[0], dy = 1224 - game.pl.pos[1], dist = Math.hypot(dx, dy);
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: Math.min(0.5, dist / 20), side: 0, jump: false, duck: true });
    if (dist < 4 && game.pl.onGround && game.pl.pos[2] > 900) break;
    if (game.pl.pos[2] < 800) break;
  }
  game.pl.vel = [0, 0, 0];
  lg('at crossing', P(), game.pl.onGround, game.pl.ducked);
}
if (window.STAGE === 12) throw 'stage 12';
// drop south onto the lower tube (x=576, top 628) and walk north under crusher01_esc00.
// stayOnGround sticks to the upper tube's south slope; walk off the lip and then wait for the fall.
{
  for (let k = 0; k < 12 * 66; k++) {
    const dx = 576 - game.pl.pos[0];
    game.pl.ang = [0, Math.atan2(-1, dx / 80) * 180 / Math.PI, 0];
    const off = game.pl.pos[1] < 1170 && game.pl.pos[2] < 942;
    game.step(T, { fwd: off ? 0.4 : 0.25, side: 0, jump: off && k % 20 < 4, duck: true });
    if (game.pl.onGround && k > 40 && game.pl.pos[2] < 800 && game.pl.pos[2] > 580 && game.pl.pos[1] < 1180) break;
    if (game.pl.pos[2] < 500) break;
  }
  if (!game.pl.onGround || game.pl.pos[2] > 800) {
    for (let k = 0; k < 8 * 66; k++) {
      game.pl.ang = [0, 270, 0];
      game.step(T, { fwd: 0, side: 0, jump: false, duck: true });
      if (game.pl.onGround && k > 5) break;
    }
  }
  game.pl.vel = [0, 0, 0];
  lg('on lower tube', P(), game.pl.onGround);
  for (let k = 0; k < 25 * 66; k++) {
    const dx = 576 - game.pl.pos[0], dy = 1580 - game.pl.pos[1];
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: 0.55, side: 0, jump: false, duck: true });
    if (game.pl.pos[1] > 1570 && game.pl.onGround && game.pl.pos[2] > 580 && game.pl.pos[2] < 700) break;
    if (game.pl.pos[2] < 520) break;
  }
  game.pl.vel = [0, 0, 0];
  lg('lower tube north', P(), game.pl.onGround);
}
if (window.STAGE === 13) throw 'stage 13';
if (window.PAD) { // drop off the north edge of the walkway onto the portalable lower floor (z -319), then floor-into-the
// east wall (x 895, y 478) with a short north hop into the floor portal so the exit keeps +y; without
// that hop the exit is 34 units south of the z=320 pad (a jump longer than 34 units clears the portal)
lg('to the north rail', JSON.stringify(AP.gotoRetry([700, 80, -64], 10, 4, 1)).slice(0, 80), P());
{
  for (let k = 0; k < 5 * 66; k++) { game.pl.ang = [20, 90, 0]; game.step(T, { fwd: 1, side: 0, jump: k < 10, duck: false }); if (game.pl.onGround && game.pl.pos[2] < -200 && k > 20) break; }
  lg('dropped', P()); }
lg('run-up', JSON.stringify(AP.gotoRetry([650, 270, -319], 10, 4, 1)).slice(0, 80), P());
const standAt = (x, y) => {
  for (let k = 0; k < 5 * 66; k++) {
    const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1], dist = Math.hypot(dx, dy);
    if (dist < 0.8 && Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 5 && game.pl.onGround && k > 8) break;
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: Math.min(0.7, dist / 12), side: 0, jump: false, duck: false });
  }
  game.pl.vel = [0, 0, 0]; AP.wait(0.3); lg('stood', game.pl.pos.map(v => +v.toFixed(1)));
};
const placeAt = (which, at) => {
  const eye = game.pl.eye(); const d = at.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1, f = d.map(v => v / l);
  lastFail = null; G.shootPortal(which, { eye, f }); AP.wait(0.1);
  const Q = G.gunPortals[which];
  return Q.open && !lastFail ? Q.pos.map(v => v | 0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail;
};
const doFling = (hop) => {
  const n0 = G.stats.teleports, op = G.gunPortals[1].pos;
  for (let k = 0; k < 8 * 66 && G.stats.teleports === n0; k++) {
    const dx = op[0] - game.pl.pos[0], dy = op[1] - game.pl.pos[1], dist = Math.hypot(dx, dy);
    game.pl.ang = [15, 90, 0];
    game.step(T, { fwd: 1, side: 0, jump: !!(hop && dist < 32 && game.pl.pos[1] < op[1] - 2), duck: false });
  }
  lg('fling out', G.stats.teleports > n0, P(), game.pl.vel.map(v => v | 0));
  for (let k = 0; k < 5 * 66; k++) { game.pl.ang = [0, 180, 0]; game.step(T, { fwd: 0.3, side: 1, jump: false, duck: false }); if (game.pl.onGround && k > 8) break; }
  lg('fling land', P(), game.pl.onGround);
};
standAt(650, 280);
lg('blue east wall', P(), placeAt(0, window.EW ?? [890, 478, 394]));
lg('orange floor', P(), placeAt(1, window.EF ?? [650, 350, -319]));
doFling(false);
// first floor-into-wall from a cold placement comes out with no +y (the hop starts already in the hole);
// stand on the same mark, re-place both portals, and the second hop keeps the +y onto the z=320 pad
if (game.pl.pos[2] < 200) {
  if (game.pl.pos[2] > -200) {
    for (let k = 0; k < 6 * 66; k++) { game.pl.ang = [20, 270, 0]; game.step(T, { fwd: 1, side: 0, jump: k < 5, duck: false }); if (game.pl.onGround && game.pl.pos[2] < -200 && k > 20) break; }
    lg('back down', P());
  }
  lg('retry run-up', JSON.stringify(AP.gotoRetry([650, 270, -319], 10, 4, 1)).slice(0, 80), P());
  standAt(650, 280);
  lg('blue east wall 2', P(), placeAt(0, window.EW ?? [890, 478, 394]));
  lg('orange floor 2', P(), placeAt(1, window.EF ?? [650, 350, -319]));
  doFling(true);
}
for (let k = 0; k < 2 * 66; k++) { game.pl.ang = [0, 90, 0]; game.step(T, { fwd: 1, side: 0, jump: false, duck: false }); }
lg('exit-sign pad', P(), game.pl.onGround);
}
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
