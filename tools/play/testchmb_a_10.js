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
// room 3 is behind another glass barrier and cleanser (y -904, glass top z -132); same fall loop in the tall hall south of
// it (ceiling 260), thrown north out of its south wall (y -1672)
lg('loop spot 2', AP.gotoRetry([-440, -1450, -255], 20, 3));
fallLoop('glass 2', [-440, -1550, -255], 260, [-440, -1671, 20], () => game.pl.pos[1] > -880);
// room 3: launcher b (west wall, y -578, z -67) fires east across a cleanser at x 0; the catcher (west wall, y -703, z -73)
// faces east. Both portals on the east wall: blue where the ball hits it, orange where a westbound ball lines up with the
// catcher
lg('room 3 east', JSON.stringify(AP.gotoRetry([380, -640, -255], 30, 3)));
lg('blue east wall b', (() => { let r; for (let k = 0; k < 6 && !(G.gunPortals[0].open && Math.abs(G.gunPortals[0].pos[1] + 578) < 10 && G.gunPortals[0].pos[0] > 500); k++) r = shoot(0, [572, -578, -67]); return r; })());
{ const B = G.gunPortals[0].pos; lg('orange east wall b', shoot(1, [549, -703 + (-578 - B[1]), -73 - (-67 - B[2])])); }
lg('caught b', waitFor(() => E('ball_trap_11').enabled === false, 25) + ' ' + io.log.filter(l => /energy ball|ball_trap_11|tracknodes/.test(l)).slice(-4));
} catch (e) { lg('ERROR', String(e).slice(0, 300) + ' at ' + P()); }
lg('end', P() + ' ' + AP.LOG.slice(-(window.NLOG || 3)).join(' | '));
return out.join('\n'); })()
