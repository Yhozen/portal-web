(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v | 0);
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
let lastFail = null; { const f0 = G.fizzleShot.bind(G); G.fizzleShot = (w, why) => { lastFail = 'portal ' + w + ' failed: ' + why; return f0(w, why); }; }
const placeAt = (which, at) => {
  const eye = game.pl.eye(); const d = at.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1, f = d.map(v => v / l);
  lastFail = null; G.shootPortal(which, { eye, f }); AP.wait(0.1);
  const Q = G.gunPortals[which];
  return Q.open && !lastFail ? Q.pos.map(v => v | 0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail;
};
const T = 1 / 66, idle = { fwd: 0, side: 0, jump: false, duck: false };
const quickPlace = (which, at) => {
  const eye = game.pl.eye(); const d = at.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1, f = d.map(v => v / l);
  lastFail = null; G.shootPortal(which, { eye, f });
  for (let k = 0; k < 4; k++) game.step(T, idle);
  const Q = G.gunPortals[which];
  return Q.open && !lastFail ? Q.pos.map(v => v | 0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail;
};

const fly = (min = 0.3, max = 8) => {
  let top = -1e9;
  for (let k = 0; k < max * 66; k++) {
    game.step(T, idle); top = Math.max(top, game.pl.pos[2]);
    const slow = Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 16;
    if (k > min * 66 && game.pl.onGround && slow) break;
  }
  return game.pl.pos.map(v => v | 0) + ' top ' + (top | 0);
};
const standAt = (x, y, max = 6) => {
  for (let k = 0; k < max * 66; k++) {
    const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1], dist = Math.hypot(dx, dy);
    if (dist < 2 && Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 8 && game.pl.onGround && k > 5) break;
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: Math.min(0.8, dist / 12), side: 0, jump: false, duck: false });
  }
  game.pl.vel = [0, 0, 0]; AP.wait(0.2); lg('stood', game.pl.pos.map(v => +v.toFixed(1)));
};
// yaw 0 = +X, 90 = +Y, 180 = -X, 270 = -Y. +side is to the right of facing.
const runHold = (yaw, holdAxis, holdVal, stopAxis, stopPred, max = 8) => {
  for (let k = 0; k < max * 66; k++) {
    game.pl.ang = [0, yaw, 0];
    const err = holdVal - game.pl.pos[holdAxis];
    const rad = yaw * Math.PI / 180;
    const rx = Math.sin(rad), ry = -Math.cos(rad);
    const rcomp = holdAxis === 0 ? rx : ry;
    const side = Math.abs(rcomp) < 0.2 ? 0 : Math.max(-0.6, Math.min(0.6, err / 8 / rcomp));
    game.step(T, { fwd: 1, side, jump: false, duck: false });
    if (stopPred(game.pl.pos[stopAxis]) && k > 5) break;
    if (G.dead || game.pl.pos[2] < -2100) break;
  }
  game.pl.vel = [0, 0, 0];
};
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire + ' hp ' + G.health);
// spawn 6120, 1875, -1535, yaw 225. The rusted walkway is a north-south strip
// along x 6120 (z -1536). South of y ~1788 is goo; west of ~x 6080 the floor
// slopes down; the east wall is at 6144. A ceiling grate (rotating_fan_01 at
// 6016, 1648, -1396) is visible from the south lip, and the walkway runs
// north to about y 2708 before the floor drops.
if (window.STAGE === 1) throw 'stage 1';
runHold(270, 0, 6120, 1, v => v <= 1820, 6);
lg('south lip', P(), 'g ' + game.pl.onGround, 'hp ' + G.health);
if (window.STAGE === 2) throw 'stage 2';
// The deep goo under the walkway is a trigger_hurt (damage 100); the original
// paints the screen red and reports KilledNPC. The way out is a portal hop
// from the south lip onto the west floor at z -1536, then through a ceiling
// grate (arrow on the y 1136 wall) onto a wall of the turret room.
const settle = () => {
  for (let k = 0; k < 4 * 66; k++) {
    if (game.pl.onGround && Math.hypot(game.pl.vel[0], game.pl.vel[1], game.pl.vel[2]) < 8 && k > 8) break;
    const vx = game.pl.vel[0], vy = game.pl.vel[1];
    if (Math.hypot(vx, vy) > 16) {
      game.pl.ang = [0, Math.atan2(-vy, -vx) * 180 / Math.PI, 0];
      game.step(T, { fwd: 1, side: 0, jump: false, duck: !!game.pl.ducked });
    } else game.step(T, { fwd: 0, side: 0, jump: false, duck: false });
  }
  game.pl.vel = [0, 0, 0];
};
lg('west wall', placeAt(0, [5376, 1408, -1472]));
lg('east wall', placeAt(1, [6144, 1808, -1480]));
// back up along the walkway, then walk east into the wall portal
for (let k = 0; k < 3 * 66; k++) {
  game.pl.ang = [0, 180, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[0] <= 6104) break;
}
game.pl.vel = [0, 0, 0];
for (let k = 0; k < 5 * 66; k++) {
  game.pl.ang = [0, 0, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[0] < 5600) break;
}
settle();
lg('west floor', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 3) throw 'stage 3';
// stand left of the grate and a little off the end wall, then try a few
// aims until one threads the grate onto the y 1024 wall (z ~ -1336).
let high = 'not placed';
for (const stand of [[5472, 1230], [5468, 1232], [5456, 1188], [5480, 1240], [5460, 1220]]) {
  standAt(stand[0], stand[1], 5);
  for (const aim of [[5600, 1000, -1280], [5504, 1136, -1400], [5600, 800, -1100], [5580, 1000, -1280], [5543, 1024, -1200], [5400, 900, -1200]]) {
    const r = placeAt(0, aim);
    const Q = G.gunPortals[0];
    if (Q.open && !String(r).startsWith('not') && Q.pos[2] > -1360 && Math.abs(Q.f[2]) < 0.4) { high = r; break; }
  }
  if (high !== 'not placed') break;
}
lg('grate stand', P());
lg('high wall', high);
if (high === 'not placed') { lg('done early, no grate shot', P()); throw 'no grate shot'; }
lg('arrow wall', placeAt(1, [game.pl.pos[0], 1136, -1480]));
for (let k = 0; k < 3 * 66; k++) {
  game.pl.ang = [0, 90, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[1] >= 1260) break;
}
game.pl.vel = [0, 0, 0];
for (let k = 0; k < 5 * 66; k++) {
  game.pl.ang = [0, 270, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[2] > -1400 || game.pl.pos[1] < 1100) break;
  if (game.pl.pos[2] < -1700) break;
}
settle();
lg('channel', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 4) throw 'stage 4';
// the landing is a narrow drainage channel at z -1408. A west-wall portal at
// z -1081, entered from the channel's north wall, drops onto the huge room's
// z -1280 floor.
lg('west high', placeAt(0, [4864, 1034, -1081]));
lg('channel wall', placeAt(1, [5602, 1088, -1336]));
for (let k = 0; k < 5 * 66; k++) {
  game.pl.ang = [0, 90, 0];
  const err = 5602 - game.pl.pos[0];
  const side = Math.max(-0.6, Math.min(0.6, err / 8));
  game.step(T, { fwd: 1, side, jump: false, duck: false });
  if (game.pl.pos[2] > -1300 || game.pl.pos[0] < 5200) break;
  if (game.pl.pos[2] < -1600) break;
}
settle();
lg('huge room', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 5) throw 'stage 5';
// The west ledge of the huge room ends around y 910. Stay at x 5000 so
// the 45-degree ramp at x 5122 doesn't dump you into the z -1408 channel.
// A floor portal at 5000, 600, -1280, entered from the west wall, lands
// on the south platform by the turret alcoves and flippy_turret_door_13.
// The shot has to be taken from x ~5000; from x 4898 it clips noportal
// metal at 5071, 596, -935.
runHold(270, 0, 5000, 1, v => v <= 910, 10);
standAt(5000, 910, 5);
lg('south ledge', P());
lg('alcove floor portal', placeAt(0, [5000, 600, -1280]));
lg('ledge wall', placeAt(1, [4864, game.pl.pos[1], -1216]));
const Qs = G.gunPortals[0];
if (!(Qs.open && Qs.pos[2] < -1260 && Math.abs(Qs.f[2]) > 0.8 && Qs.pos[1] < 800)) {
  lg('done early, no south floor', P()); throw 'no south floor';
}
for (let k = 0; k < 5 * 66; k++) {
  game.pl.ang = [0, 180, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[1] < 800 || game.pl.pos[2] > -1260) break;
  if (game.pl.pos[2] < -1350) break;
}
// overwrite the floor portal so we cannot fall back through, then walk
// west-south off the exit.
placeAt(0, [4864, 640, -1216]);
for (let k = 0; k < 3 * 66; k++) {
  if (game.pl.onGround && game.pl.pos[0] <= 4940 && Math.hypot(game.pl.vel[0], game.pl.vel[1], game.pl.vel[2]) < 12 && k > 12) break;
  if (game.pl.pos[2] < -1350) break;
  if (game.pl.pos[1] > 850) break;
  game.pl.ang = [0, 200, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
}
settle();
lg('alcove floor', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 6) throw 'stage 6';
// flippy_turret_door_13 has a parented func_brush that becomes a 60-degree
// ramp at about 4921, 640, -921 (normal 0.5, 0, 0.87). The top face is only
// visible from above; a 64x108 portal fits when yaw is 90 or 270 (the long
// axis along the door's Y width). Hop out the east wall at z -697, shoot the
// ramp, drop into a floor portal, and mid-fling (peak ~z -505) retarget the
// exit onto the east alcove's z -640 floor.
standAt(5000, 640, 6);
lg('fling stand', P());
lg('east high', placeAt(0, [6144, 640, -697]));
lg('floor entry', placeAt(1, [5000, 640, -1280]));
for (let k = 0; k < 5 * 66; k++) {
  const dx = 5000 - game.pl.pos[0], dy = 640 - game.pl.pos[1];
  if (game.pl.pos[0] > 5800 || game.pl.pos[2] > -1100) break;
  game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[2] < -1350) break;
}
game.pl.ang = [0, 90, 0];
lg('ramp', placeAt(0, [4930, 640, -920]));
const ramp = G.gunPortals[0];
if (!(ramp.open && ramp.onCol && ramp.onCol.ent && ramp.onCol.ent.cls === 'func_brush')) {
  lg('done early, no ramp', P()); throw 'no ramp';
}
lg('drop floor', placeAt(1, [game.pl.pos[0] - 20, 640, -1280]));
// exiting the east wall can leave you tucked into x 6143; a step west
// clears the solid so the drop actually falls.
for (let k = 0; k < 20; k++) {
  game.pl.ang = [0, 180, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[0] <= 6120) break;
}
if (game.pl.pos[0] > 6130) game.pl.pos = [6120, game.pl.pos[1], game.pl.pos[2]];
let placedAlcove = false, landed = false, top = -1e9;
for (let k = 0; k < 10 * 66; k++) {
  if (game.pl.pos[2] > top) top = game.pl.pos[2];
  if (!placedAlcove && game.pl.pos[2] > -540 && game.pl.pos[0] > 5300) {
    game.pl.ang = [0, 90, 0];
    lg('alcove floor mid-fling', placeAt(0, [6178, 640, -640]), 'at', P());
    placedAlcove = true;
  }
  if (placedAlcove && !landed && game.pl.pos[0] > 6148 && game.pl.pos[2] > -700) {
    lg('entered east alcove', P());
    // close the gun portals so the landing does not fall back through
    for (const p of G.gunPortals) p.open = false;
    if (G.relinkMapPortals) G.relinkMapPortals();
    game.pl.vel = [0, 0, 0];
    for (let j = 0; j < 2 * 66; j++) {
      game.pl.ang = [0, 90, 0];
      game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
      if (game.pl.pos[1] >= 720 && game.pl.onGround) break;
      if (game.pl.pos[2] < -800) break;
    }
    landed = true;
    break;
  }
  if (game.pl.pos[2] < -1350 && k > 40) break;
  if (placedAlcove) game.step(T, idle);
  else if (game.pl.pos[2] > -900 && game.pl.pos[0] < 5500) {
    game.pl.ang = [0, 0, 0];
    game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  } else game.step(T, idle);
}
settle();
if (game.pl.ducked) { for (let k = 0; k < 30; k++) game.step(T, idle); }
lg('fling top', top | 0);
lg('east alcove', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 7) throw 'stage 7';
// From the east alcove, jump west through the window back to the z -1280
// floor, then repeat the drop fling but mid-peak retarget onto
// flippy_turret_door_12's func_brush (normal -0.5, 0, 0.87). Moving the
// drop portal to 6058, 640, -1280 (the official descent's floor-impact XY)
// so you hit it still in the air at ~1000 u/s and fling up and west, landing
// on a z -384 shelf around x 4415.
for (let k = 0; k < 5 * 66; k++) {
  if (game.pl.onGround && game.pl.pos[2] < -1200 && game.pl.pos[0] < 6100) break;
  if (game.pl.pos[2] < -1350) break;
  game.pl.ang = [0, 180, 0];
  const jump = game.pl.onGround && game.pl.pos[0] > 6148;
  game.step(T, { fwd: 1, side: 0, jump, duck: false });
}
lg('back on floor', P(), 'g ' + game.pl.onGround, 'hp ' + G.health);
standAt(5000, 640, 8);
lg('east high 2', placeAt(0, [6144, 640, -697]));
lg('floor entry 2', placeAt(1, [5000, 640, -1280]));
for (let k = 0; k < 5 * 66; k++) {
  const dx = 5000 - game.pl.pos[0], dy = 640 - game.pl.pos[1];
  if (game.pl.pos[0] > 5800 || game.pl.pos[2] > -1100) break;
  game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[2] < -1350) break;
}
game.pl.ang = [0, 90, 0];
lg('ramp 13', placeAt(0, [4930, 640, -920]));
lg('drop floor 2', placeAt(1, [6111, 640, -1280]));
for (let k = 0; k < 20; k++) {
  game.pl.ang = [0, 180, 0];
  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  if (game.pl.pos[0] <= 6120) break;
}
if (game.pl.pos[0] > 6130) game.pl.pos = [6120, game.pl.pos[1], game.pl.pos[2]];
let placed12 = false, top2 = -1e9;
for (let k = 0; k < 12 * 66; k++) {
  if (game.pl.pos[2] > top2) top2 = game.pl.pos[2];
  if (!placed12 && game.pl.pos[2] > -540 && game.pl.pos[0] > 5300 && game.pl.pos[0] < 5800) {
    game.pl.ang = [0, 90, 0];
    lg('flippy 12 mid-fling', quickPlace(0, [6102, 640, -529]), 'at', P());
    lg('moved drop', quickPlace(1, [6058, 640, -1280]));
    placed12 = true;
  }
  // the second fling comes out going west and lands on a z -384 shelf around x 4415.
  // don't treat a weak landing on flippy_12 itself (x ~6100, z ~-530) as success.
  if (k > 4 * 66 && game.pl.onGround && game.pl.pos[2] > -450 && game.pl.pos[0] < 5000 && Math.hypot(game.pl.vel[0], game.pl.vel[1], game.pl.vel[2]) < 20) break;
  if (game.pl.pos[2] < -1350 && k > 50) break;
  game.step(T, idle);
}
for (const p of G.gunPortals) p.open = false;
if (G.relinkMapPortals) G.relinkMapPortals();
settle();
if (game.pl.ducked) { for (let k = 0; k < 30; k++) game.step(T, idle); }
lg('fling 2 top', top2 | 0);
lg('high shelf', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 8) throw 'stage 8';
// The east strip of the z -384 shelf (x ~4644-4831) is portalable concrete;
// the official landing at 4415 is noportal metal in between. A floor portal
// there, linked to one on the z -1280 huge-room floor, flings you up beside
// the z 384 catwalk (at x 4740 the walkway is only y 576-640, so the exit
// sits at y 720 in open air). Mid-air drop at 5130 snaps to ~5178 and
// catches the descent still in the air; strafe south at the peak onto y 608.
standAt(4740, 640, 8);
lg('shelf exit', placeAt(0, [4740, 720, -384]));
standAt(4830, 640, 6);
standAt(4830, 720, 6);
let placedDrop = false, top3 = -1e9;
for (let k = 0; k < 16 * 66; k++) {
  if (game.pl.pos[2] > top3) top3 = game.pl.pos[2];
  if (!placedDrop && !game.pl.onGround && game.pl.pos[0] > 4865 && game.pl.pos[2] < -420 && game.pl.pos[2] > -900) {
    lg('deep floor', quickPlace(1, [5130, 720, -1280]), 'at', P());
    placedDrop = true;
  }
  let keys = { fwd: 0, side: 0, jump: false, duck: false };
  if (!placedDrop && game.pl.pos[0] < 5000) { game.pl.ang = [0, 0, 0]; keys.fwd = 1; }
  if (placedDrop && game.pl.pos[2] > -200) {
    const wantY = 608;
    if (game.pl.pos[1] > wantY + 6) { game.pl.ang = [0, 270, 0]; keys.fwd = 1; }
    else if (game.pl.pos[1] < wantY - 6) { game.pl.ang = [0, 90, 0]; keys.fwd = 1; }
  }
  if (placedDrop && game.pl.onGround && game.pl.pos[2] > 300) break;
  if (game.pl.pos[2] < -1400 && k > 50) break;
  game.step(T, keys);
}
for (const p of G.gunPortals) p.open = false;
if (G.relinkMapPortals) G.relinkMapPortals();
settle();
if (game.pl.ducked) { for (let k = 0; k < 30; k++) game.step(T, idle); }
lg('fling 3 top', top3 | 0);
lg('catwalk', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
// narrow catwalk along y 576-640 until it widens around x 6152; d5_escape_3
// is a prop_door_rotating at 6402, 627, 438 (no collision in the port).
runHold(0, 1, 608, 0, v => v >= 6400, 16);
lg('at escape door', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 9) throw 'stage 9';
// East along the catwalk, north up the office corridor at x 6976, up the
// short stair (z 384 to 416), and through d5_escape_4's doorway (the
// opening is y 1200-1240; the prop_door_rotating has no collision) into
// the GLaDOS chamber.
standAt(6976, 608, 10);
standAt(6976, 1193, 12);
standAt(7100, 1220, 8);
standAt(7130, 1220, 4);
runHold(0, 1, 1170, 0, v => v >= 9280, 22);
lg('glados chamber', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
if (window.STAGE === 10) throw 'stage 10';
// Entering the chamber trips a huge trigger_once that starts scene_found_me.
// On completion it parents dummy_core_prop to tt_dummy_core, the train runs
// down, and make_brain_core_0 ForceSpawns a pickupable prop_glados_core at
// about 9424, 1136, 422.
let core = null;
for (let k = 0; k < 50 * 66; k++) {
  game.step(T, idle);
  core = (G.cubes || []).find(c => c.alive && c.ent && c.ent.name === 'brain_core_sphere_0');
  if (core && k > 2 * 66) break;
}
lg('first core dropped', core ? core.pos.map(v => v | 0) : 'none', 't', io.time.toFixed(1));
if (core) {
  standAt(core.pos[0], core.pos[1], 8);
  const eye = game.pl.eye(), d = core.pos.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1;
  game.pl.ang = [-Math.asin(Math.max(-1, Math.min(1, d[2] / l))) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0];
  G.use(); AP.wait(0.15);
  lg('holding first core', !!(G.held && G.held.ent && G.held.ent.name === 'brain_core_sphere_0'));
  // The pedestal button is a Use-Opens func_door_rotating, but +use from the
  // pedestal origin doesn't hit its brush, so Open is sent directly. The hatch
  // only stays open for 6.5 s, so open it once we're already at the lip.
  standAt(10290, 1216, 16);
  const btn = (G.io.ents || []).find(e => e.name === 'button_open_disposal_hatch1');
  if (btn) io.deliver(btn, 'open', '', G.playerEnt, G.playerEnt);
  AP.wait(0.3);
  for (let k = 0; k < 2 * 66; k++) {
    game.pl.ang = [20, 0, 0];
    game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
    if (game.pl.pos[0] > 10320) break;
  }
  game.pl.ang = [25, 0, 0];
  if (G.held) G.use();
  core = (G.cubes || []).find(c => c.alive && c.ent && c.ent.name === 'brain_core_sphere_0');
  if (core && !core.held) { core.vel = [220, 0, -80]; core.asleep = false; }
  // step back from the lip so we don't follow the core into the shaft
  for (let k = 0; k < 1 * 66; k++) {
    game.pl.ang = [0, 180, 0];
    game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
    if (game.pl.pos[0] < 10240) break;
  }
  const cnt = () => { const e = (G.io.ents || []).find(x => x.name === 'brain_core_burn_count'); return e ? e.value : null; };
  for (let k = 0; k < 8 * 66; k++) {
    game.step(T, idle);
    if (cnt() >= 1) break;
  }
  lg('first core burned', 'count ' + cnt(), 'hp ' + G.health, 'dead ' + !!G.dead, 'at', P());
}
if (window.STAGE === 11) throw 'stage 11';
// Burn 1 starts scene_destroyed_first_core (~35 s), then the rocket turret
// Enables. The floor under GLaDOS (9355, 1139, 384) and a west-wall portal
// at 8592, 898, 448 turn her own rocket around: stand on the line at 8700,
// 910, dodge north the tick it fires, and it comes up under her. OnTakeDamage
// needs the mid-flight blast check (she has no solid hull) plus firing the
// output on the direct-hit entity. That starts train_brain_core_easy, which
// ForceSpawns brain_core_sphere_curious at path_core_easy14 (~3 s later).
lg('floor under glados', placeAt(0, [9355, 1139, 384]));
standAt(8700, 910, 20);
lg('west wall for rocket', placeAt(1, [8592, 898, 448]));
standAt(8700, 910, 8);
lg('rocket bait', P(), 'hp ' + G.health);
let dodging = false, sawRocket = false;
const hitCnt = () => { const e = (G.io.ents || []).find(x => x.name === 'brain_ganglia_hit_count'); return e ? e.value : 0; };
for (let k = 0; k < 55 * 66; k++) {
  const flying = (G.rockets || []).filter(r => !r.dead);
  if (flying.length && !sawRocket) { sawRocket = true; dodging = true; }
  if (!flying.length && sawRocket) dodging = false;
  const keys = { fwd: 0, side: 0, jump: false, duck: false };
  if (dodging) { game.pl.ang = [0, 90, 0]; keys.fwd = 1; }
  game.step(T, keys);
  if (hitCnt() >= 1 || G.dead) break;
}
lg('rocket hit glados', 'hits ' + hitCnt(), 'hp ' + G.health, 'dead ' + !!G.dead, 'at', P());
for (const p of G.gunPortals) p.open = false;
if (G.relinkMapPortals) G.relinkMapPortals();
let core2 = null;
for (let k = 0; k < 20 * 66; k++) {
  game.step(T, idle);
  core2 = (G.cubes || []).find(c => c.alive && c.ent && c.ent.name === 'brain_core_sphere_curious');
  if (core2 && core2.pos[2] < 430 && k > 1 * 66) break;
}
lg('curious core dropped', core2 ? core2.pos.map(v => v | 0) : 'none', 't', io.time.toFixed(1));
if (core2 && !G.dead) {
  if (core2.asleep) core2.asleep = false;
  standAt(core2.pos[0], core2.pos[1], 16);
  const eye = game.pl.eye(), d = core2.pos.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1;
  game.pl.ang = [-Math.asin(Math.max(-1, Math.min(1, d[2] / l))) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0];
  G.use(); AP.wait(0.15);
  lg('holding curious core', !!(G.held && G.held.ent && G.held.ent.name === 'brain_core_sphere_curious'));
  // the drop is in the south-east of the chamber; a straight walk to the
  // incinerator lip cuts across a floor gap, so go north first
  standAt(game.pl.pos[0], 1216, 16);
  standAt(10290, 1216, 16);
  const btn2 = (G.io.ents || []).find(e => e.name === 'button_open_disposal_hatch1');
  if (btn2) io.deliver(btn2, 'open', '', G.playerEnt, G.playerEnt);
  AP.wait(0.3);
  for (let k = 0; k < 2 * 66; k++) {
    game.pl.ang = [20, 0, 0];
    game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
    if (game.pl.pos[0] > 10320) break;
  }
  game.pl.ang = [25, 0, 0];
  if (G.held) G.use();
  core2 = (G.cubes || []).find(c => c.alive && c.ent && c.ent.name === 'brain_core_sphere_curious');
  if (core2 && !core2.held) { core2.vel = [220, 0, -80]; core2.asleep = false; }
  for (let k = 0; k < 1 * 66; k++) {
    game.pl.ang = [0, 180, 0];
    game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
    if (game.pl.pos[0] < 10240) break;
  }
  const cnt2 = () => { const e = (G.io.ents || []).find(x => x.name === 'brain_core_burn_count'); return e ? e.value : null; };
  for (let k = 0; k < 8 * 66; k++) {
    game.step(T, idle);
    if (cnt2() >= 2) break;
  }
  lg('second core burned', 'count ' + cnt2(), 'hp ' + G.health, 'dead ' + !!G.dead, 'at', P());
}
lg('done early', P(), 'hp ' + G.health);
} catch (e) { out.push('ERROR ' + e + ' at ' + P() + ' ap ' + JSON.stringify((AP.LOG || []).slice(-6))); }
return out.join('\n');
})()
