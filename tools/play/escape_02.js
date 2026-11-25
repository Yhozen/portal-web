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
lg('done early', P(), 'hp ' + G.health);
} catch (e) { out.push('ERROR ' + e + ' at ' + P() + ' ap ' + JSON.stringify((AP.LOG || []).slice(-6))); }
return out.join('\n');
})()
