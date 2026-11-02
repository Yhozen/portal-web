// In-page autopilot for honest traversal tests: plans over the real collision world (player-hull traces, step-up,
// drops, open portal pairs) and then drives the player ONLY through the normal movement input (fwd + yaw, jump).
// No position edits while walking. Usage (inside tools/shot.mjs scripts): AP.goto([x,y,z]) -> {ok, steps, log}
window.AP = (() => {
  const W = window.game, G = W.game, pl = W.pl, TICK = 1 / 66, S = 24;
  const tr = (a, b) => pl.trace(a, b);
  const hurt = () => G.io.ents.filter(e => e.cls === 'trigger_hurt' && e.bmins && e.enabled !== false && !e.killed);
  const inHurt = (p, hs) => hs.some(e => p[0] > e.bmins[0] - 16 && p[0] < e.bmaxs[0] + 16 && p[1] > e.bmins[1] - 16 && p[1] < e.bmaxs[1] + 16 && p[2] > e.bmins[2] - 72 && p[2] < e.bmaxs[2]);
  const key = p => `${Math.round(p[0] / 12)},${Math.round(p[1] / 12)},${Math.round(p[2] / 16)}`;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [0.707, -0.707], [-0.707, 0.707], [-0.707, -0.707]];
  function floorAt(p) { const d = tr(p, [p[0], p[1], p[2] - 400]); return d.fraction < 1 && d.normal[2] > 0.7 ? d.end : null; }
  function neighbors(p, hs) {
    const out = [];
    for (const [dx, dy] of DIRS) {
      const up = tr(p, [p[0], p[1], p[2] + 18]).end;
      const f = tr(up, [up[0] + dx * S, up[1] + dy * S, up[2]]); if (f.fraction < 0.99 || f.startsolid) continue;
      const d = tr(f.end, [f.end[0], f.end[1], f.end[2] - 18 - 300]); if (d.fraction >= 1 || d.normal[2] < 0.7) continue;
      const drop = f.end[2] - d.end[2]; const q = d.end; if (inHurt(q, hs)) continue;
      out.push({ q, c: S + (drop > 60 ? 20 : 0) });
    }
    for (const a of G.portals) { const b = a.linked; if (!a.open || !b || !b.open || Math.abs(a.f[2]) > 0.3) continue;
      const r = [p[0] - a.pos[0], p[1] - a.pos[1], p[2] + 36 - a.pos[2]]; const dp = r[0] * a.f[0] + r[1] * a.f[1] + r[2] * a.f[2];
      const lr = r[0] * a.r[0] + r[1] * a.r[1] + r[2] * a.r[2]; const lu = r[0] * a.u[0] + r[1] * a.u[1] + r[2] * a.u[2];
      if (dp > 0 && dp < 40 && Math.abs(lr) < 14 && Math.abs(lu) < 40) { const o = [b.pos[0] + b.f[0] * 40, b.pos[1] + b.f[1] * 40, b.pos[2] + b.f[2] * 40 - 20]; const q = floorAt(o); if (q) out.push({ q, c: 60, portal: a }); } }
    return out;
  }
  function plan(target, R = 28, maxN = 60000) {
    const hs = hurt(); const start = [...pl.pos]; const open = [{ p: start, g: 0, f: 0, k: key(start) }]; const best = new Map([[open[0].k, 0]]); const prev = new Map();
    const h = p => Math.hypot(p[0] - target[0], p[1] - target[1], (p[2] - target[2]) * 0.5);
    let n = 0;
    while (open.length && n++ < maxN) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i; const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur.g > best.get(cur.k)) continue;
      if (Math.hypot(cur.p[0] - target[0], cur.p[1] - target[1]) < R && Math.abs(cur.p[2] - target[2]) < 64) {
        const path = []; let k = cur.k, node = cur; while (node) { path.push(node); node = prev.get(node.k); } return { ok: true, path: path.reverse(), expanded: n }; }
      for (const nb of neighbors(cur.p, hs)) { const k = key(nb.q), g = cur.g + nb.c; if (g < (best.get(k) ?? 1e9)) { best.set(k, g); const node = { p: nb.q, g, f: g + h(nb.q) * 1.2, k, portal: nb.portal }; prev.set(k, cur); open.push(node); } }
    }
    const ks = [...best.keys()].map(k => k.split(',').map(Number)); const bb = [0, 1, 2].map(i => [Math.min(...ks.map(k => k[i])) * [12, 12, 16][i], Math.max(...ks.map(k => k[i])) * [12, 12, 16][i]]);
    let cl = null, cd = 1e9; for (const k of ks) { const q = [k[0] * 12, k[1] * 12, k[2] * 16]; const d = h(q); if (d < cd) { cd = d; cl = q; } }
    return { ok: false, expanded: n, bb, closest: cl, portalEdges: [...prev.keys()].length };
  }
  function walk(path, budget = 120) {
    let t = 0, stuck = 0, last = [...pl.pos], i = 1;
    while (i < path.length && t < budget) {
      const pa = path[i].portal; // next node is on the far side of portal pa: walk into its centre until we get teleported
      const w = pa ? [pa.pos[0] - pa.f[0] * 20, pa.pos[1] - pa.f[1] * 20, pl.pos[2]] : path[i].p; const d = [w[0] - pl.pos[0], w[1] - pl.pos[1]]; const dist = Math.hypot(d[0], d[1]);
      if (!pa && dist < 14 && Math.abs(w[2] - pl.pos[2]) < 40) { i++; continue; }
      pl.ang = [0, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0];
      const jump = stuck > 30; for (let k = 0; k < 2; k++) W.step(TICK, { fwd: 1, side: 0, jump, duck: false }); t += 2 * TICK;
      const mv = Math.hypot(pl.pos[0] - last[0], pl.pos[1] - last[1]); last = [...pl.pos];
      if (mv > 60) { // teleported: resync to nearest remaining waypoint past the portal we were heading for
        if (path[i].portal) i++; let bj = i, bd = 1e9; for (let j = i; j < path.length && !path[j].portal; j++) { const q = path[j].p; const dd = Math.hypot(q[0] - pl.pos[0], q[1] - pl.pos[1], q[2] - pl.pos[2]); if (dd < bd) { bd = dd; bj = j; } } i = bj; }
      stuck = mv < 0.5 ? stuck + 1 : 0; if (stuck > 120) return { ok: false, why: 'stuck', at: pl.pos.map(v => v | 0), wp: i + '/' + path.length, t };
    }
    return { ok: i >= path.length, t, at: pl.pos.map(v => v | 0) };
  }
  function goto(target, R) { const p = plan(target, R); if (!p.ok) return { ok: false, why: 'no path (' + p.expanded + ' nodes)', bb: p.bb, closest: p.closest, from: pl.pos.map(v => v | 0) }; const w = walk(p.path); w.nodes = p.path.length; w.expanded = p.expanded; w.portals = p.path.filter(n => n.portal).length; return w; }
  function wait(sec, until) { for (let t = 0; t < sec; t += TICK) { W.step(TICK); if (until && until()) return true; } return !until; }
  function lookAt(p) { const e = pl.eye(); const d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]]; pl.ang = [-Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0]; }
  // fine positioning without turning (keeps aim): strafe/forward toward an xy point, slowing down near it
  function approach(target, tol = 4, maxT = 4) { for (let t = 0; t < maxT; t += TICK) { const d = [target[0] - pl.pos[0], target[1] - pl.pos[1]]; const dist = Math.hypot(d[0], d[1]); if (dist < tol) { pl.vel[0] = pl.vel[1] = 0; return true; }
      const y = pl.ang[1] * Math.PI / 180, f = [Math.cos(y), Math.sin(y)], r = [Math.sin(y), -Math.cos(y)]; const k = Math.min(1, dist / 40);
      W.step(TICK, { fwd: (d[0] * f[0] + d[1] * f[1]) / dist * k, side: (d[0] * r[0] + d[1] * r[1]) / dist * k, jump: false, duck: false }); } return false; }
  return { plan, walk, goto, wait, lookAt, approach };
})();
