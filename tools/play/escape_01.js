(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v | 0);
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
let lastFail = null; { const f0 = G.fizzleShot.bind(G); G.fizzleShot = (w, why) => { lastFail = 'portal ' + w + ' failed: ' + why; return f0(w, why); }; }
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); lastFail = null; G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open && !lastFail ? Pp.pos.map(v => v | 0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail; };
const tryShoot = (which, ts) => { let r = ''; for (const t of ts) { r = shoot(which, t); if (!/not placed/.test(r)) break; } return r; };
const placeAt = (which, at) => {
  const eye = game.pl.eye(); const d = at.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1, f = d.map(v => v / l);
  lastFail = null; G.shootPortal(which, { eye, f }); AP.wait(0.1);
  const Q = G.gunPortals[which];
  return Q.open && !lastFail ? Q.pos.map(v => v | 0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail;
};
const T = 1 / 66, idle = { fwd: 0, side: 0, jump: false, duck: false };
const fly = (min = 0.3, max = 8) => { let top = -1e9; for (let k = 0; k < max * 66; k++) { game.step(T, idle); top = Math.max(top, game.pl.pos[2]); if (k > min * 66 && game.pl.onGround) break; } return game.pl.pos.map(v => v | 0) + ' top ' + (top | 0); };
const standAt = (x, y, max = 6) => {
  for (let k = 0; k < max * 66; k++) {
    const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1], dist = Math.hypot(dx, dy);
    if (dist < 2 && Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 8 && game.pl.onGround && k > 5) break;
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: Math.min(0.8, dist / 12), side: 0, jump: false, duck: false });
  }
  game.pl.vel = [0, 0, 0]; AP.wait(0.2); lg('stood', game.pl.pos.map(v => +v.toFixed(1)));
};
// run west along the spawn corridor and the narrow catwalk over the ambush pit, holding y near 2624.
// looking yaw 180 (west), +side is south (-Y), so a positive dy (we're south of the line) needs -side.
const runWest = (xStop, yHold = 2624, max = 8) => {
  for (let k = 0; k < max * 66; k++) {
    const dy = yHold - game.pl.pos[1];
    game.pl.ang = [0, 180, 0];
    game.step(T, { fwd: 1, side: -Math.max(-0.6, Math.min(0.6, dy / 10)), jump: false, duck: false });
    if (game.pl.pos[0] <= xStop && game.pl.onGround && k > 10) break;
  }
};
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// corridor west from -1172, 2619, -383, over the catwalk lip at x -1600 (the original walks this at 150 u/s;
// see oracle/runs/e01-walk-lip.jsonl). The gun is picked up on the first steps (OnNewGame ForceSpawns it).
runWest(-1710, 2624, 8);
lg('on the catwalk', P(), 'g ' + game.pl.onGround);
if (window.STAGE === 1) throw 'stage 1';
runWest(-2100, 2624, 8);
lg('west of the pit', P(), 'g ' + game.pl.onGround);
if (window.STAGE === 2) throw 'stage 2';
lg('done early', P());
} catch (e) { lg('ERROR', String(e && e.message || e), P(), 'ap ' + JSON.stringify((AP.LOG || []).slice(-6))); }
out.push(AP.LOG.slice(-20).join('\n'));
out.push(io.log.filter(l => /picked|portalgun|laser_1|rocket|teleport|fizz|changed|pod|crusher|trap_1|block_crazy/.test(l)).slice(-25).join('\n'));
return out.join('\n'); })()
