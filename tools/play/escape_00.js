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
} catch (e) { lg('ERROR', String(e.stack || e).slice(0, 400)); }
lg('end', P());
return out.join('\n'); })()
