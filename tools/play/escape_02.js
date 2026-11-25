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
    if (G.dead || game.pl.pos[2] < -1650) break;
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
lg('south lip', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'grate ' + placeAt(0, [6016, 1648, -1280]));
if (window.STAGE === 2) throw 'stage 2';
// back to mid-walkway, then north along x 6120 toward the gap at y ~2708
runHold(90, 0, 6120, 1, v => v >= 1875, 6);
lg('back mid', P());
runHold(90, 0, 6120, 1, v => v >= 2650, 12);
lg('north end', P(), 'g ' + game.pl.onGround, 'hp ' + G.health, 'dead ' + !!G.dead);
// a wall past the north fan hole at y 2992 is portalable from here, but that
// portal sits under the upper floor (center z -1461) and drops into the pit.
// the first hop out of this trench is still being measured against the oracle.
lg('east wall', placeAt(0, [6144, game.pl.pos[1], -1472]));
lg('north room wall', placeAt(1, [6050, 2992, -1461]));
lg('done early', P(), 'hp ' + G.health);
} catch (e) { out.push('ERROR ' + e + ' at ' + P() + ' ap ' + JSON.stringify((AP.LOG || []).slice(-6))); }
return out.join('\n');
})()
