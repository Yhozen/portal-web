// In-page autopilot for honest traversal tests: plans over the real collision world (player-hull traces, step-up,
// drops, open portal pairs) and then drives the player ONLY through the normal movement input (fwd + yaw, jump).
// No position edits while walking. Usage (inside tools/shot.mjs scripts): AP.goto([x,y,z]) -> {ok, steps, log}
window.AP = (() => {
  const LOG = [];
  const W = window.game, G = W.game, pl = W.pl, TICK = 1 / 66, S = 24;
  const tr = (a, b) => pl.trace(a, b);
  const hurt = () => G.io.ents.filter(e => (e.cls === 'trigger_hurt' || (G.held && e.cls === 'trigger_portal_cleanser')) && e.bmins && e.enabled !== false && !e.killed); // carrying a cube: a cleanser would fizzle it
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
  const ZT = { lo: -64, hi: 64 }; // arrival z window (node z minus target z)
  function plan(target, R = 28, maxN = 60000) {
    const hs = hurt(); const start = [...pl.pos]; const open = [{ p: start, g: 0, f: 0, k: key(start) }]; const best = new Map([[open[0].k, 0]]); const prev = new Map(); const nodeAt = new Map([[open[0].k, start]]);
    const h = p => Math.hypot(p[0] - target[0], p[1] - target[1], (p[2] - target[2]) * 0.5);
    let n = 0, near = open[0], nearH = h(start);
    while (open.length && n++ < maxN) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i; const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur.g > best.get(cur.k)) continue; { const hc = h(cur.p); if (hc < nearH) { nearH = hc; near = cur; } }
      if (Math.hypot(cur.p[0] - target[0], cur.p[1] - target[1]) < R && cur.p[2] - target[2] > ZT.lo && cur.p[2] - target[2] < ZT.hi) {
        const path = []; let k = cur.k, node = cur; while (node) { path.push(node); node = prev.get(node.k); } return { ok: true, path: path.reverse(), expanded: n }; }
      for (const nb of neighbors(cur.p, hs)) { const k = key(nb.q), g = cur.g + nb.c; if (g < (best.get(k) ?? 1e9)) { best.set(k, g); const node = { p: nb.q, g, f: g + h(nb.q) * 1.2, k, portal: nb.portal }; prev.set(k, cur); nodeAt.set(k, nb.q); open.push(node); } }
    }
    const ks = [...best.keys()].map(k => k.split(',').map(Number)); const bb = [0, 1, 2].map(i => [Math.min(...ks.map(k => k[i])) * [12, 12, 16][i], Math.max(...ks.map(k => k[i])) * [12, 12, 16][i]]);
    let cl = null, cd = 1e9; for (const k of ks) { const q = [k[0] * 12, k[1] * 12, k[2] * 16]; const d = h(q); if (d < cd) { cd = d; cl = q; } }
    const partial = []; for (let node = near; node; node = prev.get(node.k)) partial.push(node); partial.reverse();
    return { ok: false, expanded: n, bb, closest: cl, visited: [...new Set([...best.keys()])].map(k => nodeAt.get(k)).filter(Boolean), partial, partialGain: h(start) - nearH, portalEdges: [...prev.keys()].length };
  }
  function walk(path, budget = 120) {
    let t = 0, stuck = 0, last = [...pl.pos], i = 1;
    while (i < path.length && t < budget) {
      const pa = path[i].portal; if (pa && !(pa.open && pa.linked && pa.linked.open)) return { ok: false, why: 'portal closed', at: pl.pos.map(v => v | 0), t };
      // next node is on the far side of portal pa: walk into its centre until we get teleported
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
  function goto(target, R) { const p = plan(target, R); if (!p.ok) return { ok: false, why: 'no path (' + p.expanded + ' nodes)', bb: p.bb, closest: p.closest, from: pl.pos.map(v => v | 0), partial: p.partial, partialGain: p.partialGain }; const w = walk(p.path); w.nodes = p.path.length; w.expanded = p.expanded; w.portals = p.path.filter(n => n.portal).length; return w; }
  function wait(sec, until) { for (let t = 0; t < sec; t += TICK) { W.step(TICK); if (until && until()) return true; } return !until; }
  function lookAt(p) { const e = pl.eye(); const d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]]; pl.ang = [-Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, 0]; }
  // fine positioning without turning (keeps aim): strafe/forward toward an xy point, slowing down near it
  function approach(target, tol = 4, maxT = 4) { for (let t = 0; t < maxT; t += TICK) { const d = [target[0] - pl.pos[0], target[1] - pl.pos[1]]; const dist = Math.hypot(d[0], d[1]); if (dist < tol) { pl.vel[0] = pl.vel[1] = 0; return true; }
      const y = pl.ang[1] * Math.PI / 180, f = [Math.cos(y), Math.sin(y)], r = [Math.sin(y), -Math.cos(y)]; const k = Math.min(1, dist / 40);
      W.step(TICK, { fwd: (d[0] * f[0] + d[1] * f[1]) / dist * k, side: (d[0] * r[0] + d[1] * r[1]) / dist * k, jump: false, duck: false }); } return false; }
  // replan until we get there: cycling portals, doors still opening, etc.
  function gotoRetry(target, R, tries = 30, pause = 0.5, partial = true) { let r; for (let k = 0; k < tries; k++) { r = goto(target, R); LOG.push(G.io.time.toFixed(1) + ' try' + k + ' ' + (r.ok ? 'ok' : r.why) + ' at ' + pl.pos.map(v => v | 0) + ' held ' + !!G.held); if (r.ok) { r.tries = k + 1; return r; }
      // can't get there yet: get as close as currently possible (e.g. into the room where the next cycling portal will open), then wait
      if (partial && r.partial && r.partialGain > 48 && r.partial.length > 1) walk(r.partial); wait(pause); }
    if (r) delete r.partial; r.tries = tries; return r; }
  // get there by walking; if no walkable route exists, shoot portals to make one (blue first, then orange if the gun has it)
  function reach(target, R, opts = {}) { let r = gotoRetry(target, R, opts.tries || 6, 0.5, opts.partial !== false); if (r.ok) return r;
    for (const which of [0, 1]) { if (!G.canFire[which]) continue; r = portalSolve(target, R, which, { vantage: true, spacing: 200, pitches: [-30, -15, 0, 15, 30, 60, 89], ...opts }); if (r.ok) return r; }
    return r; }
  // pick up a cube, carry it onto a point (a floor button's trigger centre), drop it there
  // a cube up to ~150 units above the floor (on a pedestal) can still be grabbed: the use() ray reaches 100 units from the eye
  function pickUp(cube) { let r = gotoRetry([cube.pos[0], cube.pos[1], cube.pos[2]], 56); if (!r.ok) { ZT.lo = -150; try { r = reach([cube.pos[0], cube.pos[1], cube.pos[2]], 72); } finally { ZT.lo = -64; } } if (!r.ok) return { ok: false, why: 'reach cube: ' + r.why };
    lookAt(cube.pos); wait(0.1); if (!G.held) G.use(); wait(0.3); return { ok: !!G.held, why: G.held ? '' : 'use() did not grab' }; }
  function placeCube(cube, b) { if (!G.held) { const p = pickUp(cube); if (!p.ok) return p; }
    let r = gotoRetry([b[0], b[1], b[2]], 72); if (!r.ok) r = reach([b[0], b[1], b[2]], 72); LOG.push('reach button ' + JSON.stringify(r) + ' held ' + !!G.held + ' cube ' + cube.pos.map(v => v | 0)); if (!r.ok) return { ok: false, why: 'reach button: ' + r.why };
    for (let k = 0; k < 5; k++) { lookAt([b[0], b[1], b[2]]); wait(0.4); if (Math.hypot(b[0] - cube.pos[0], b[1] - cube.pos[1]) < 8) break; approach([b[0] - (cube.pos[0] - pl.pos[0]), b[1] - (cube.pos[1] - pl.pos[1])], 3); }
    G.use(); wait(1.5); return { ok: Math.hypot(b[0] - cube.pos[0], b[1] - cube.pos[1]) < 24, cube: cube.pos.map(v => v | 0) }; }
  // aim + fire the gun (the same shootPortal() the mouse buttons use) over a sweep of directions until the placed portal opens a path
  // aim + fire the gun (the same shootPortal() the mouse buttons use) over a sweep of directions until the placed portal opens a path.
  // With opts.vantage, also tries from other reachable spots (sampled from the planner's flood fill): walks there first, then shoots.
  function sweep(target, R, which, opts, seen) { const pitches = opts.pitches || [-30, -15, 0, 15, 30, 45, 60]; let tried = 0;
    for (let yaw = 0; yaw < 360; yaw += opts.yawStep || 10) for (const pitch of pitches) { pl.ang = [pitch, yaw, 0]; G.shootPortal(which); const P = G.gunPortals[which];
      if (!P.open) continue; const k = P.pos.map(v => Math.round(v / 16)).join(',') + P.f.map(v => Math.round(v * 4)).join(','); if (seen.has(k)) continue; seen.add(k); tried++;
      if (!P.linked || !P.linked.open) continue; const p = plan(target, R, opts.maxN || 20000); if (p.ok && p.path.some(n => n.portal)) return { yaw, pitch, path: p.path, tried, shot: P.pos.map(v => v | 0) }; }
    return { tried }; }
  const snapPortals = () => ({ g: G.gunPortals.map(p => ({ p, pos: [...p.pos], f: [...p.f], u: [...p.u], r: [...p.r], open: p.open })), m: G.portals.map(p => [p, p.open]) });
  const restorePortals = s => { for (const [p, o] of s.m) p.open = o; for (const q of s.g) { Object.assign(q.p, { pos: q.pos, f: q.f, u: q.u, r: q.r, open: q.open }); G.portalBrushes.delete(q.p); } G.relinkMapPortals(); };
  function portalSolve(target, R, which = 0, opts = {}) { const seen = new Set(); const home = [...pl.pos], a0 = [...pl.ang]; let tried = 0; const snap = snapPortals(), snd = G.snd; G.snd = null;
    let s = sweep(target, R, which, opts, seen); tried += s.tried;
    if (!s.path && opts.vantage) { restorePortals(snap); const fl = plan(home, -1, opts.floodN || 4000); /* R<0: never arrives, i.e. a flood fill outward from here */ const ks = [...(fl.visited || [])]; const picks = [];
      for (const q of ks) if (picks.every(o => Math.hypot(o[0] - q[0], o[1] - q[1]) > (opts.spacing || 160))) picks.push(q);
      LOG.push('portalSolve: ' + picks.length + ' vantage spots');
      for (const v of picks) { restorePortals(snap); pl.pos = [...v]; s = sweep(target, R, which, opts, seen); tried += s.tried; pl.pos = [...home];
        if (s.path) { s.vantage = v; break; } } }
    pl.pos = [...home]; pl.ang = a0; restorePortals(snap); G.snd = snd;
    if (!s.path) return { ok: false, why: 'no portal spot works (' + tried + ' tried)' };
    if (s.vantage) { const g = goto(s.vantage, 12); if (!g.ok) return { ok: false, why: 'vantage unreachable ' + g.why }; }
    pl.ang = [s.pitch, s.yaw, 0]; G.shootPortal(which); LOG.push('portalSolve: ' + (which ? 'orange' : 'blue') + ' at ' + G.gunPortals[which].pos.map(v => v | 0) + ' from ' + pl.pos.map(v => v | 0) + ' (yaw ' + s.yaw + ' pitch ' + s.pitch + ', ' + tried + ' spots tried)');
    const p = plan(target, R); if (!p.ok) return { ok: false, why: 'replan after shot failed' }; const w = walk(p.path); w.shot = s.shot; w.tried = tried; return w; }
  // a standing spot under a trigger volume (its centre dropped to the floor)
  const floorUnder = e => { const c = centre(e); const t = pl.trace([c[0], c[1], e.bmaxs[2] - 4], [c[0], c[1], e.bmins[2] - 200]); return t.fraction < 1 ? t.end : [c[0], c[1], e.bmins[2]]; };
  const centre = e => [0, 1, 2].map(i => (e.bmins[i] + e.bmaxs[i]) / 2);
  const ent = n => G.io.ents.find(e => e.name === n);
  return { LOG, ZT, reach, floorUnder, portalSolve, plan, walk, goto, gotoRetry, pickUp, placeCube, centre, ent, wait, lookAt, approach };
})();
