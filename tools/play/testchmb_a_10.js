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
      const at = [p[0], Math.min(-1010, Math.max(-1150, p[1])), -256], e = game.pl.pos, d = [at[0] - e[0], at[1] - e[1], at[2] - e[2] - 64];
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
} catch (e) { lg('ERROR', String(e).slice(0, 300) + ' at ' + P()); }
lg('end', P() + ' ' + AP.LOG.slice(-(window.NLOG || 3)).join(' | '));
return out.join('\n'); })()
