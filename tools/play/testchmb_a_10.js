(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent;
const w0 = performance.now(), lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v) + (window.WALL ? ' [' + ((performance.now() - w0) / 1000).toFixed(0) + 's]' : ''));
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open ? Pp.pos.map(v => v|0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed'; };
const fired = n => io.log.some(l => l.includes(n));
const waitFor = (f, s) => { for (let i = 0; i < s * 66 && !f(); i++) AP.wait(1/66); return f(); };
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// a glass barrier (CONTENTS_WINDOW, z -380..-260; the original stops the player at x -912 too) and a cleanser close the
// corridor, and portal shots don't cross the cleanser (measured: the original placed nothing on the white walls past it).
// Fall loop instead: blue on the floor, orange on the ceiling over it, fall a few times, then orange onto the white west
// wall (x -1416, facing east) and the next pass throws you east over the glass.
// fall loop (used twice): blue on the floor at A, orange on the ceiling over it, fall through `passes` times, then orange
// onto the wall point T and the next pass throws you out of that wall; stops once on the ground with done() true
const fallLoop = (name, A, ceilZ, T, done, passes = 4) => {
  lg(name + ' floor', shoot(0, A)); lg(name + ' ceiling', shoot(1, [A[0], A[1], ceilZ]));
  const n0 = G.stats.teleports; let vmax = 0, wall = false;
  for (let i = 0; i < 66 * 12; i++) { const n = G.stats.teleports - n0; vmax = Math.max(vmax, Math.hypot(...game.pl.vel));
    if (!wall && n >= passes && game.pl.vel[2] < 0 && game.pl.pos[2] < T[2]) {
      // no waits here: at 1500 u/s AP.wait would carry the player through portals before the shot
      const e = game.pl.pos, d = [T[0] - e[0], T[1] - e[1], T[2] - e[2] - 64];
      game.pl.ang = [-Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0]; G.shootPortal(1);
      const O = G.gunPortals[1]; wall = O.pos.map(v => v|0) + ' f ' + O.f.map(v => +v.toFixed(2)); lg(name + ' wall', wall + ' after ' + n + ' passes v ' + game.pl.vel.map(v => v|0)); continue; }
    const dx = A[0] - game.pl.pos[0], dy = A[1] - game.pl.pos[1];
    if (n === 0) { game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(1/66, { fwd: Math.hypot(dx, dy) > 4 ? 1 : 0, side: 0, jump: false, duck: false }); }
    else if (!wall) { const B = G.gunPortals[0].pos, ex = B[0] - game.pl.pos[0], ey = B[1] - game.pl.pos[1]; game.pl.ang = [0, Math.atan2(ey, ex) * 180 / Math.PI, 0]; game.step(1/66, { fwd: Math.hypot(ex, ey) > 3 ? 1 : 0, side: 0, jump: false, duck: false }); }
    else { game.step(1/66, { fwd: 0, side: 0, jump: false, duck: false }); if (game.pl.onGround && done()) break; } }
  lg(name + ' landed', P() + ' vmax ' + (vmax|0) + ' passes ' + (G.stats.teleports - n0));
};
lg('loop spot', AP.gotoRetry([-1150, -2650, -384], 20, 3));
fallLoop('glass 1', [-1250, -2650, -384], 128, [-1415, -2650, 60], () => game.pl.pos[0] > -900);
// room 2: the launcher on the east wall sends its ball along x at y -1989, z -196 (it starts in the wall and comes off it
// westwards, see launchBall). A cleanser at x 129 splits the room, and east of it a wall (y -2112..-2176) splits the
// launcher's side from the catcher's, so they only connect through the west side. Shots don't cross the cleanser and
// walking through it takes the portals. So: blue on the scorch mark (west wall), orange on the same wall further south so
// the ball comes back east along the catcher's side (it leaves orange as far to the other side of its centre as it
// entered blue); walk round to the catcher's side while it's on that line, then blue on the east wall where the line ends
// and orange on the ceiling over the floor catcher
const ball = () => G.balls[0], LY = -2300;
lg('room 2 west', AP.gotoRetry([0, -2150, -383], 30, 3));
lg('blue scorch', (() => { let r; for (let k = 0; k < 6 && !(G.gunPortals[0].open && Math.abs(G.gunPortals[0].pos[1] + 1989) < 10); k++) { r = shoot(0, [-255, -1989, -196]); if (!(Math.abs(G.gunPortals[0].pos[1] + 1989) < 10)) AP.wait(0.5); } return r; })());
{ const off = -1989 - G.gunPortals[0].pos[1]; lg('orange south', shoot(1, [-255, LY + off, -196])); }
lg('ball on orange line', waitFor(() => ball() && ball().vel[0] > 0 && Math.abs(ball().pos[1] - LY) < 20 && ball().pos[0] > -200, 20) + ' ' + (ball() ? ball().pos.map(v => v|0) : '-'));
lg('catcher side', JSON.stringify(AP.gotoRetry([220, -2330, -383], 20, 3)) + ' at ' + P() + ' portals ' + G.gunPortals.map(p => p.open));
const ly = ball() ? ball().pos[1] : LY;
lg('blue east wall', (() => { let r; for (let k = 0; k < 6 && !G.gunPortals[0].open; k++) r = shoot(0, [511, ly, -196]); return r; })() + ' ball ' + (ball() ? ball().pos.map(v => v|0) : '-'));
lg('orange ceiling', (() => { let r; for (let k = 0; k < 6 && !G.gunPortals[1].open; k++) r = shoot(1, [317, -2300, -128]); return r; })() + ' blue ' + G.gunPortals[0].open);
lg('caught 1', waitFor(() => E('ball_trap_12').enabled === false, 20) + ' ' + io.log.filter(l => /energy ball|ball_trap_12|lift_a/.test(l)).slice(-4));
const lift = E('lift_a_rm8');
AP.wait(3); lg('lift', lift.state + ' ' + lift.pos.map(v => v|0) + ' bb ' + lift.bmins.map(v => v|0) + '/' + lift.bmaxs.map(v => v|0));
lg('lift down', waitFor(() => lift.pos[2] < -380, 15) + ' ' + lift.pos[2].toFixed(0));
lg('near lift', JSON.stringify(AP.gotoRetry([-200, -2304, -383], 20, 3)));
for (let i = 0; i < 200; i++) { const dx = -352 - game.pl.pos[0], dy = -2304 - game.pl.pos[1]; if (Math.hypot(dx, dy) < 8) break; game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); }
lg('on lift', P());
lg('ride', waitFor(() => game.pl.pos[2] > -258 && lift.pos[2] > -323, 12) + ' ' + P());
lg('upper corridor', JSON.stringify(AP.gotoRetry([-440, -1000, -256], 30, 3)));
/* room 3 is behind another glass wall (y -904, top z -132) and a cleanser. The hall floor and ceiling are not portalable
   except a checkered patch (y -1160..-1000), but the south wall is, including the block jutting out high on it. Double
   fling as in the walkthrough: orange on that block, blue on the floor of the pit next to the stairs (west side room),
   jump into the pit, come out of the block heading north, put blue on the patch where the arc lands, and the second pass
   throws you over the glass. */
lg('hall', JSON.stringify(AP.gotoRetry([-450, -1300, -255], 30, 3)));
lg('orange platform', (() => { let r; for (let k = 0; k < 4 && !(G.gunPortals[1].open && G.gunPortals[1].pos[1] > -1640 && G.gunPortals[1].pos[2] > 150); k++) r = shoot(1, [-450, -1636, 190]); return r; })());
lg('stair landing', JSON.stringify(AP.gotoRetry([-890, -1440, -126], 30, 3)));
lg('blue pit', (() => { let r; for (let k = 0; k < 4 && !(G.gunPortals[0].open && G.gunPortals[0].pos[2] < -250); k++) r = shoot(0, [-890, -1300, -256]); return r; })());
{ const n0 = G.stats.teleports; let shot = false, jumped = false;
  for (let i = 0; i < 66 * 10; i++) { const n = G.stats.teleports - n0;
    if (n === 0) { const B = G.gunPortals[0].pos; game.pl.ang = [0, Math.atan2(B[1] - game.pl.pos[1], B[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; }
    const jump = n === 0 && !jumped && game.pl.onGround && game.pl.pos[1] > -1425; if (jump) jumped = true;
    if (n === 1 && !shot && game.pl.pos[1] > -1590) {
      /* predict where the arc meets the floor and put blue there (no waits: the shot has to land before we do) */
      let p = game.pl.pos.slice(); const v = game.pl.vel.slice(); for (let k = 0; k < 400 && p[2] > -255; k++) { v[2] -= 600 / 66; p = p.map((c, j) => c + v[j] / 66); }
      const at = [p[0], Math.min(-1010, Math.max(-1138, p[1])), -256], e = game.pl.pos, d = [at[0] - e[0], at[1] - e[1], at[2] - e[2] - 64];
      game.pl.ang = [-Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0]; G.shootPortal(0);
      lg('patch blue', (G.gunPortals[0].open ? G.gunPortals[0].pos.map(v => v|0) : 'not placed') + ' landing ' + p.map(v => v|0) + ' v ' + game.pl.vel.map(v => v|0)); shot = true; }
    game.step(1/66, { fwd: n === 0 ? 1 : 0, side: 0, jump, duck: false });
    if (G.stats.teleports - n0 !== n) lg('fling ' + (n + 1), P() + ' v ' + game.pl.vel.map(v => v|0));
    if (n >= 1 && game.pl.onGround) break; }
  lg('over glass 2', P()); }
/* room 3: the field at x 0 (glass below it, top z -128) splits it. Same double fling eastward: orange on the block jutting
   out high on the west wall (east face x -580), blue on the floor next to it, jump in, then blue where the arc lands */
const doubleFling = (name, O, B0, from, overDone) => {
  lg(name + ' spot', JSON.stringify(AP.gotoRetry(from, 20, 3)));
  lg(name + ' orange', (() => { let r; for (let k = 0; k < 4; k++) { r = shoot(1, O); if (G.gunPortals[1].open && Math.hypot(...G.gunPortals[1].pos.map((c, j) => c - O[j])) < 40) break; } return r; })());
  lg(name + ' blue', (() => { let r; for (let k = 0; k < 4; k++) { r = shoot(0, B0); if (G.gunPortals[0].open && G.gunPortals[0].pos[2] < B0[2] + 4) break; } return r; })());
  const n0 = G.stats.teleports, Ofwd = G.gunPortals[1].f.slice(); let shot = false, jumped = false;
  for (let i = 0; i < 66 * 10; i++) { const n = G.stats.teleports - n0;
    if (n === 0) { const B = G.gunPortals[0].pos; game.pl.ang = [0, Math.atan2(B[1] - game.pl.pos[1], B[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; }
    const near = Math.hypot(G.gunPortals[0].pos[0] - game.pl.pos[0], G.gunPortals[0].pos[1] - game.pl.pos[1]) < 30;
    const jump = n === 0 && !jumped && game.pl.onGround && near; if (jump) jumped = true;
    /* once clear of the exit portal: predict where the arc meets the floor and move blue there (no waits) */
    if (n === 1 && !shot && Math.abs((game.pl.pos[0] - O[0]) * Ofwd[0] + (game.pl.pos[1] - O[1]) * Ofwd[1]) > 40) {
      let p = game.pl.pos.slice(); const v = game.pl.vel.slice(); for (let k = 0; k < 400 && p[2] > B0[2] + 1; k++) { v[2] -= 600 / 66; p = p.map((c, j) => c + v[j] / 66); }
      const at = overDone.clamp(p), e = game.pl.pos, d = [at[0] - e[0], at[1] - e[1], B0[2] - e[2] - 64];
      game.pl.ang = [-Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0]; G.shootPortal(0);
      lg(name + ' blue 2', (G.gunPortals[0].open ? G.gunPortals[0].pos.map(v => v|0) : 'not placed') + ' landing ' + p.map(v => v|0) + ' v ' + game.pl.vel.map(v => v|0)); shot = true; }
    game.step(1/66, { fwd: n === 0 ? 1 : 0, side: 0, jump, duck: false });
    if (G.stats.teleports - n0 !== n) lg(name + ' fling ' + (n + 1), P() + ' v ' + game.pl.vel.map(v => v|0));
    if (n >= 1 && game.pl.onGround && (shot || n >= 2)) break; }
  lg(name + ' over', P() + ' ' + overDone.ok());
};
doubleFling('field 3', [-579, -705, 190], [-520, -705, -256], [-470, -705, -255], { clamp: p => [Math.min(-60, p[0]), p[1]], ok: () => game.pl.pos[0] > 10 });
/* the ball runs east along y -578, an angled panel turns it north and it scorches the north wall at x 547. Blue on the
   scorch, orange at the same x on the south wall: it comes out heading north, the other angled panel turns it west along
   y -725 and back across the field into ball_trap_11 on the west wall */
lg('east side', JSON.stringify(AP.gotoRetry([300, -640, -255], 20, 3)));
lg('blue scorch b', (() => { let r; for (let k = 0; k < 4 && !(G.gunPortals[0].open && G.gunPortals[0].pos[1] > -390); k++) r = shoot(0, [547, -384, -67]); return r; })());
lg('orange south b', (() => { let r; for (let k = 0; k < 4 && !(G.gunPortals[1].open && G.gunPortals[1].pos[1] < -890); k++) r = shoot(1, [547, -896, -67]); return r; })());
lg('caught b', waitFor(() => E('ball_trap_11').enabled === false, 15) + ' ' + io.log.filter(l => /energy ball|ball_trap_11/.test(l)).slice(-3));
/* back over the field the same way: orange high on the east wall (x 639, facing west), clear of the angled panels */
doubleFling('field 3 back', [639, -800, 190], [540, -800, -256], [480, -800, -255], { clamp: p => [Math.max(60, p[0]), p[1]], ok: () => game.pl.pos[0] < -10 });
/* the conveyor: carts spawn every 15 s at the far end (200, 416) and ride the goo channel backwards to room 3 (north
   along x 64 is the way out, then west along y 64, then south along x -320 to the room-3 mouth). As in the walkthrough:
   blue on room 3's north wall, orange further down the channel each time, come out onto a passing cart, place the next
   orange from it, ride back and repeat; the last orange goes on the final room's floor */
const carts = () => io.ents.filter(e => e.cls === 'func_tracktrain' && e.isCopy && !e.killed);
const cartAt = f => carts().find(c => f(c.pos));
const walkInto = (until, s = 3) => { for (let i = 0; i < s * 66 && !until(); i++) { const B = G.gunPortals[0].pos; game.pl.ang = [0, Math.atan2(B[1] + 20 - game.pl.pos[1], B[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); } return until(); };
const offCart = () => { const c = game.pl.groundEnt; waitFor(() => c && c.pos ? c.pos[1] < -306 : game.pl.pos[1] < -300, 40); for (let i = 0; i < 3 * 66 && game.pl.pos[1] > -420; i++) { game.pl.ang = [0, -90, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); } return P(); };
const nowShoot = (w, at) => { const e = game.pl.pos, d = [at[0] - e[0], at[1] - e[1], at[2] - e[2] - 64]; game.pl.ang = [-Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0]; G.shootPortal(w); const Q = G.gunPortals[w]; return Q.open ? Q.pos.map(v => v|0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed (' + (io.log.filter(l => /failed/.test(l)).slice(-1)[0] || '').slice(0, 90) + ')'; };
/* walk into the room-3 blue when a cart is about to pass under the orange, so we come out standing in the orange's mouth
   (the floor behind the blue holds us there) and step onto the cart as it goes by */
const hop = (name, ready, board, boardTo) => {
  lg(name + ' wait', JSON.stringify(AP.gotoRetry([-420, -440, -255], 20, 3)) + ' carts ' + carts().map(c => c.pos.map(v => v|0)).join(' '));
  lg(name + ' cart', waitFor(() => !!cartAt(ready), 60) + ' ' + carts().map(c => c.pos.map(v => v|0)).join(' '));
  const n0 = G.stats.teleports; walkInto(() => G.stats.teleports > n0);
  waitFor(() => game.pl.onGround, 2); lg(name + ' out', P() + ' on ' + (game.pl.groundEnt ? game.pl.groundEnt.name : '-') + ' carts ' + carts().map(c => c.pos.map(v => v|0)).join(' '));
  if (game.pl.groundEnt && /rail_cart/.test(game.pl.groundEnt.name)) return;
  lg(name + ' board', waitFor(() => !!cartAt(board), 20) + ' ' + carts().map(c => c.pos.map(v => v|0)).join(' '));
  for (let i = 0; i < 66; i++) { const bt = boardTo(); if (Math.hypot(bt[0] - game.pl.pos[0], bt[1] - game.pl.pos[1]) <= 6) break; game.pl.ang = [0, Math.atan2(bt[1] - game.pl.pos[1], bt[0] - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); }
  for (let i = 0; i < 20; i++) game.step(1/66, { fwd: 0, side: 0, jump: false, duck: false });
  lg(name + ' on', P() + ' ground ' + (game.pl.groundEnt ? game.pl.groundEnt.name : '-'));
};
lg('blue north wall', (() => { AP.gotoRetry([-420, -470, -255], 20, 3); let r; for (let k = 0; k < 4 && !(G.gunPortals[0].open && G.gunPortals[0].pos[1] > -390); k++) r = shoot(0, [-420, -384, -200]); return r; })());
lg('orange channel 1', (() => { AP.gotoRetry([-320, -420, -255], 20, 3); let r; for (let k = 0; k < 4 && !(G.gunPortals[1].open && G.gunPortals[1].pos[1] > 100); k++) r = shoot(1, [-300, 130, -200]); return r; })());
/* boarding: the cart may already be up to 24 units past when we come out (a tenth of a second late), so walk onto where
   it is now rather than where we stand */
const onRail = (axis, at) => p => Math.abs(p[axis] - at) < 2 && Math.abs(p[1 - axis] - game.pl.pos[1 - axis]) < 24;
hop('hop 1', p => Math.abs(p[1] - 64) < 2 && p[0] < -255 && p[0] > -275, p => onRail(1, 64)(p), () => { const c = cartAt(onRail(1, 64)); return [c ? c.pos[0] : game.pl.pos[0], 50]; });
lg('orange channel 2', nowShoot(1, [140, 64, -200]));
lg('off cart 1', offCart());
hop('hop 2', p => Math.abs(p[0] - 64) < 2 && p[1] < 95 && p[1] > 75, p => onRail(0, 64)(p), () => { const c = cartAt(onRail(0, 64)); return [60, c ? c.pos[1] : game.pl.pos[1]]; });
lg('orange final floor', nowShoot(1, [64, 580, -256]));
lg('off cart 2', offCart());
lg('final wait', JSON.stringify(AP.gotoRetry([-420, -440, -255], 20, 3)));
{ const n0 = G.stats.teleports; walkInto(() => G.stats.teleports > n0); waitFor(() => game.pl.onGround, 3); lg('final room', P()); }
/* final room. The walkthrough's high jump to the exit (its alternative to the two buttons and the pellet): orange on the
   floor just east of the exit lift (shot looking west, so what goes in heading along the blue's up comes out heading
   west), ride lift a up, step to its north edge (the platform itself blocks shots straight down), put blue on the floor
   beyond it looking north, jump off north into it and come out of the orange heading up and west onto the exit ledge */
lg('orange by exit lift', (() => { AP.gotoRetry([60, 1216, -255], 30, 3); let r; for (let k = 0; k < 4; k++) { r = shoot(1, [-30, 1180, -256]); if (G.gunPortals[1].open && G.gunPortals[1].pos[2] < -250 && G.gunPortals[1].pos[1] > 1150) break; } return r + ' u ' + G.gunPortals[1].u.map(v => +v.toFixed(2)) + ' from ' + P(); })());
const liftA = E('lift_brush_a10_1');
lg('lift a', JSON.stringify(AP.gotoRetry([40, 600, -255], 30, 3)) + JSON.stringify(AP.gotoRetry([-128, 600, -255], 30, 3)) + ' lift ' + liftA.pos.map(v => v|0));
waitFor(() => liftA.pos[2] < -245, 15);
for (let i = 0; i < 99 && Math.hypot(-128 - game.pl.pos[0], 704 - game.pl.pos[1]) > 6; i++) { game.pl.ang = [0, Math.atan2(704 - game.pl.pos[1], -128 - game.pl.pos[0]) * 180 / Math.PI, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); }
lg('lift a top', waitFor(() => liftA.pos[2] > -4 && game.pl.onGround, 25) + ' ' + P() + ' lift ' + liftA.pos.map(v => v|0));
for (let i = 0; i < 99 && game.pl.pos[1] < 748; i++) { game.pl.ang = [0, 90, 0]; game.step(1/66, { fwd: 1, side: 0, jump: false, duck: false }); }
for (let i = 0; i < 30; i++) game.step(1/66, { fwd: 0, side: 0, jump: false, duck: false });
/* hop off the north edge slowly (what goes in along the blue's up, north, comes out along the orange's up, west: too
   fast and we fly in under the exit lift's platform), and put blue where the fall lands */
{ const n0 = G.stats.teleports; let shot = null;
  for (let i = 0; i < 66 * 5; i++) { const n = G.stats.teleports - n0;
    game.pl.ang = [0, n === 0 ? 90 : 180, 0];
    if (n === 0 && !shot && !game.pl.onGround && game.pl.pos[1] > 770) { let p = game.pl.pos.slice(); const v = game.pl.vel.slice(); for (let k = 0; k < 400 && (p[2] > -255 || v[2] > 0); k++) { v[2] -= 600 / 66; p = p.map((c, j) => c + v[j] / 66); }
      shot = nowShoot(0, [p[0], p[1], -256]) + ' landing ' + p.map(v => v|0) + ' u ' + G.gunPortals[0].u.map(v => +v.toFixed(2)); lg('blue past lift', shot); }
    game.step(1/66, { fwd: n === 0 && i < (window.FT ?? 3) ? 1 : 0, side: 0, jump: i === 1, duck: false });
    if (G.stats.teleports - n0 !== n) lg('exit jump ' + (n + 1), P() + ' v ' + game.pl.vel.map(v => v|0));
    if (n >= 1 && game.pl.onGround) break; }
  lg('landed', P() + ' on ' + (game.pl.groundEnt ? game.pl.groundEnt.name : '-')); }
lg('elevator', JSON.stringify(AP.gotoRetry([-576, 1216, 20], 30, 3)));
lg('changelevel', waitFor(() => io.log.some(l => /a10_a11_elevator_body.startforward/.test(l)), 20) + ' ' + io.log.filter(l => /elevator/.test(l)).slice(-3));
AP.wait(40, () => window.changedTo); lg('changedTo', window.changedTo + ' pos ' + P());
} catch (e) { lg('ERROR', String(e).slice(0, 300) + ' at ' + P()); }
lg('end', P() + ' ' + AP.LOG.slice(-(window.NLOG || 3)).join(' | '));
return out.join('\n'); })()
