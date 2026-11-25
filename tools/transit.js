// Portal transit probe, run in the page by checks/portal-transit.ctl (portal-ctl `inject tools/transit.js`).
// It walks the player through the open portal pair with real input and measures what a player would feel:
//   jump    the eye's move in one tick beyond what its speed explains, with a teleport mapped through the portal pair
//           (0 means the view passes through a portal without a pop)
//   solid   ticks the hull spent inside something solid (stuck in a wall or a portal rim)
//   behind  ticks the eye spent behind an open portal's plane inside its hole without having been teleported
// __transit(o) runs one walk; __transitFuzz(o) runs many seeded random ones and returns the worst of each.
(() => {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = a => Math.hypot(a[0], a[1], a[2]), r1 = v => +v.toFixed(1), T = 1 / 66;
  // a point taken through portal a to its partner b (half a turn about the portal's up axis)
  const thru = (a, b, x) => { const d = sub(x, a.pos), lr = dot(d, a.r), lu = dot(d, a.u), lf = dot(d, a.f); return [0, 1, 2].map(k => b.pos[k] - lr * b.r[k] + lu * b.u[k] - lf * b.f[k]); };
  const open = G => G.portals.filter(p => p.open && p.linked && p.linked.open);
  window.__transit = o => {
    const g = window.game, G = g.game, pl = g.pl, none = { fwd: 0, side: 0, jump: false, duck: false };
    pl.noclip = false; pl.pos = [...o.pos]; pl.vel = [0, 0, 0]; pl.ang = [o.ang[0], o.ang[1], 0];
    pl.ducked = false; pl.ducking = false; pl.portalDuck = false; pl.duckRaised = false; pl.viewOffset = 64; pl.duckTime = 0; pl.duckHeld = false; pl.onGround = false; G.lastExit = null;
    const h = G.hud; h.fade = 0; h.fadeTarget = 0; h.fadeHoldUntil = 0;
    for (let i = 0; i < (o.settle ?? 20); i++) g.step(T, none);
    let prevEye = pl.eye(), prevPos = [...pl.pos], jump = 0, jumpAt = null, solid = 0, firstSolid = null, behind = 0, minView = pl.viewOffset; const tps = [];
    for (let i = 0; i < o.ticks; i++) {
      let inp = none;
      for (const k of o.keys) if (i >= k.from && i < k.to) { inp = { fwd: k.fwd || 0, side: k.side || 0, jump: !!k.jump, duck: !!k.duck }; if (k.turn) pl.ang = [pl.ang[0], pl.ang[1] + k.turn, 0]; }
      const before = G.stats.teleports, v0 = len(pl.vel);
      g.step(T, inp);
      const tp = G.stats.teleports > before; let exp = prevEye;
      if (tp && G.lastExit) { const b = G.lastExit.p, a = b.linked; if (a) exp = thru(a, b, prevEye); tps.push({ i, from: a?.name, to: b.name }); }
      // at a teleport the eye is what must carry through. On other ticks a crouch moves the eye or the feet but never both,
      // so a pop is when both jump
      // (a stair step is a pop too, but it is the floor's, not a portal's: straight up or down by a step's height on the ground)
      const eye = pl.eye(), de = len(sub(eye, exp)), dp = sub(pl.pos, prevPos), stair = !tp && pl.onGround && Math.abs(dp[2]) <= 18.5 && Math.hypot(dp[0], dp[1]) <= Math.max(v0, len(pl.vel)) * T + 0.5;
      const d = tp ? de : stair ? 0 : Math.min(de, len(dp)), ex = d - Math.max(v0, len(pl.vel)) * T - 0.5; prevPos = [...pl.pos];
      if (ex > jump) { jump = ex; jumpAt = { i, d: r1(d), tp, view: pl.viewOffset, eye: eye.map(r1) }; }
      prevEye = eye; minView = Math.min(minView, pl.viewOffset);
      if (pl.trace(pl.pos, pl.pos).startsolid) { solid++; firstSolid ??= { i, pos: pl.pos.map(r1) }; }
      for (const p of open(G)) { const e = sub(eye, p.pos); if (dot(e, p.f) < -1 && Math.abs(dot(e, p.r)) < 32 && Math.abs(dot(e, p.u)) < 54 && dot(e, p.f) > -48) { behind++; break; } }
    }
    return { tp: tps.length, tps: tps.slice(0, 4), jump: +Math.max(0, jump).toFixed(2), jumpAt, solid, firstSolid, behind, minView, end: pl.pos.map(r1), ducked: pl.ducked, ground: pl.onGround };
  };
  // o: { seed, n, ticks, duck } - random walks at the open pair: from in front of either portal, off-centre, at an angle, strafing,
  // jumping and turning on the way (and crouching with duck: true; a crouch-jump moves the eye and the feet in one tick by
  // itself, which reads as a jump here, so it is off unless asked for). Returns the worst jump (per kind of pair), and the runs that went wrong.
  window.__transitFuzz = o => {
    const g = window.game, G = g.game; let s = (o.seed ?? 1) >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)], span = (a, b) => a + (b - a) * rnd();
    const ps = open(G); if (ps.length < 2) return { error: 'no open portal pair' };
    const flat = p => Math.abs(p.f[2]) > 0.7, ground = q => { const t = G.tr.trace([q[0], q[1], q[2] + 40], [q[0], q[1], q[2] - 600], [-16, -16, 0], [16, 16, 72], 0x1 | 0x2 | 0x8 | 0x4000 | 0x10000); return t.startsolid ? null : t.end; };
    const out = { runs: 0, teleported: 0, jumpUpright: 0, jumpTurned: 0, solid: 0, behind: 0, stuck: [], bad: [] };
    for (let n = 0; n < o.n; n++) {
      const p = pick(ps); let start, yaw;
      if (flat(p)) { const a = span(0, 2 * Math.PI), d = span(40, 120), q = [0, 1, 2].map(k => p.pos[k] + (Math.cos(a) * p.r[k] + Math.sin(a) * p.u[k]) * d + p.f[k] * (rnd() < 0.3 ? span(60, 250) : 4));
        start = rnd() < 0.3 ? q : ground(q); if (!start) continue; yaw = Math.atan2(p.pos[1] - q[1], p.pos[0] - q[0]) * 180 / Math.PI + span(-25, 25); }
      else { const off = span(-40, 40), d = span(30, 140), q = [0, 1, 2].map(k => p.pos[k] + p.f[k] * d + p.r[k] * off); start = ground(q); if (!start) continue;
        yaw = Math.atan2(-p.f[1], -p.f[0]) * 180 / Math.PI + span(-50, 50); }
      if (G.tr.trace(start, start, [-16, -16, 0], [16, 16, 72], 0x1 | 0x2 | 0x8 | 0x4000 | 0x10000).startsolid) continue; // a start in the air can be inside the room's furniture
      const ticks = o.ticks ?? 200, keys = [{ from: 0, to: ticks, fwd: 1, side: pick([0, 0, 1, -1]) }];
      for (let k = 0, m = Math.floor(span(0, 4)); k < m; k++) { const from = Math.floor(span(0, ticks - 20)), to = from + Math.floor(span(4, 60));
        keys.push({ from, to, fwd: pick([1, 1, 0, -1]), side: pick([0, 1, -1]), jump: rnd() < 0.4, duck: !!o.duck && rnd() < 0.2, turn: rnd() < 0.4 ? span(-6, 6) : 0 }); }
      const run = { pos: start.map(r1), ang: [0, r1(yaw)], ticks, keys }, r = window.__transit(run), byName = n => G.portals.find(q => q.name === n), turned = r.tps.some(t => [t.from, t.to].some(n => byName(n) && flat(byName(n)))); // (the map may have moved a portal since)
      out.runs++; if (r.tp) out.teleported++; out.solid += r.solid; out.behind += r.behind;
      if (!turned) out.jumpUpright = Math.max(out.jumpUpright, r.jump); else out.jumpTurned = Math.max(out.jumpTurned, r.jump);
      // the runs to look at: stuck ones first, then pops (between two wall portals any pop; with a floor or ceiling portal
      // only ones larger than the duck the original does there)
      if ((r.solid || r.behind > 8) && out.stuck.length < (o.keep ?? 6)) out.stuck.push({ n, run, r });
      else if (((!turned && r.jump > 1) || r.jump > 45) && out.bad.length < (o.keep ?? 6)) out.bad.push({ n, run, r });
    }
    return out;
  };
})();
