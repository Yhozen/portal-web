// Axis-aligned box sweeps against BSP brushes, walking the node tree (the same idea as the open-source
// Quake III cm_trace.c, GPL, re-written here from the algorithm description). Source brushes already carry
// the axial bevel planes needed for correct AABB collision.
import { BSP, CONTENTS } from './bsp.ts';
import type { V3 } from './math.ts';

export interface Trace { fraction: number; end: V3; normal: V3; startsolid: boolean; allsolid: boolean; hit: number /* brush idx or -1 */; ent: any; }
export const MASK_PLAYERSOLID = CONTENTS.SOLID | CONTENTS.PLAYERCLIP | CONTENTS.WINDOW | CONTENTS.GRATE | CONTENTS.MOVEABLE | CONTENTS.MONSTER;
export const MASK_SHOT_PORTAL = CONTENTS.SOLID | CONTENTS.MOVEABLE | CONTENTS.WINDOW; // portal gun passes grates (CONTENTS_GRATE)
const EPS = 0.03125;

export interface Collider { bsp: BSP; headnode: number; offset: V3; ent?: any; enabled: () => boolean; rot?: Float32Array /* column-major 4x4, local->world rotation */; }

export class Tracer {
  bsp: BSP; stamp: Uint32Array; cur = 1; colliders: Collider[] = [];
  ignore: Set<number> | null = null; extraBoxes: { mins: V3; maxs: V3; ent: any }[] = [];
  constructor(bsp: BSP) { this.bsp = bsp; this.stamp = new Uint32Array(bsp.brushes.length); }
  trace(start: V3, end: V3, mins: V3, maxs: V3, mask: number, skipEnt: any = null): Trace {
    const ext: V3 = [(maxs[0] - mins[0]) / 2, (maxs[1] - mins[1]) / 2, (maxs[2] - mins[2]) / 2];
    const ctr: V3 = [(maxs[0] + mins[0]) / 2, (maxs[1] + mins[1]) / 2, (maxs[2] + mins[2]) / 2];
    const s: V3 = [start[0] + ctr[0], start[1] + ctr[1], start[2] + ctr[2]], e: V3 = [end[0] + ctr[0], end[1] + ctr[1], end[2] + ctr[2]];
    const tr: Trace = { fraction: 1, end: [end[0], end[1], end[2]], normal: [0, 0, 0], startsolid: false, allsolid: false, hit: -1, ent: null };
    const w = { s, e, ext, tr, mask, ofs: [0, 0, 0] as V3, ignore: this.ignore };
    this.cur++;
    this.walk(this.bsp.models[0].headnode, 0, 1, s, e, w);
    for (const c of this.colliders) {
      if (c.ent === skipEnt || !c.enabled()) continue;
      let ss: V3 = [s[0] - c.offset[0], s[1] - c.offset[1], s[2] - c.offset[2]], ee: V3 = [e[0] - c.offset[0], e[1] - c.offset[1], e[2] - c.offset[2]];
      const R = c.rot; // rotated brush entity: sweep in its local frame (the box stays axis-aligned there; approximate)
      if (R) { const inv = (v: V3): V3 => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[4] * v[0] + R[5] * v[1] + R[6] * v[2], R[8] * v[0] + R[9] * v[1] + R[10] * v[2]]; ss = inv(ss); ee = inv(ee); }
      const before = tr.fraction, bs = tr.startsolid; const w2 = { ...w, s: ss, e: ee, ignore: null };
      this.walk(c.headnode, 0, 1, ss, ee, w2);
      if (tr.fraction < before || (tr.startsolid && !bs)) { tr.ent = c.ent; if (R && tr.fraction < before) { const n = tr.normal; tr.normal = [R[0] * n[0] + R[4] * n[1] + R[8] * n[2], R[1] * n[0] + R[5] * n[1] + R[9] * n[2], R[2] * n[0] + R[6] * n[1] + R[10] * n[2]]; } }
    }
    for (const b of this.extraBoxes) {
      if (b.ent === skipEnt) continue; const before = tr.fraction, bs = tr.startsolid;
      this.clipBox(b.mins, b.maxs, w);
      if (tr.fraction < before || (tr.startsolid && !bs)) tr.ent = b.ent;
    }
    if (tr.fraction < 1) for (let i = 0; i < 3; i++) tr.end[i] = start[i] + (end[i] - start[i]) * tr.fraction;
    else tr.end = [end[0], end[1], end[2]];
    if (tr.allsolid) tr.end = [start[0], start[1], start[2]];
    return tr;
  }
  private walk(n: number, p1: number, p2: number, a: V3, b: V3, w: any) {
    const tr: Trace = w.tr; if (tr.fraction <= p1) return;
    if (n < 0) { this.leaf(-1 - n, w); return; }
    const bsp = this.bsp, nd = bsp.nodes[n], pl = bsp.planes[nd.plane], N = pl.n;
    let t1, t2, off;
    if (pl.type < 3) { t1 = a[pl.type] - pl.d; t2 = b[pl.type] - pl.d; off = w.ext[pl.type]; }
    else { t1 = N[0] * a[0] + N[1] * a[1] + N[2] * a[2] - pl.d; t2 = N[0] * b[0] + N[1] * b[1] + N[2] * b[2] - pl.d;
      off = Math.abs(N[0]) * w.ext[0] + Math.abs(N[1]) * w.ext[1] + Math.abs(N[2]) * w.ext[2]; }
    if (t1 >= off + 1 && t2 >= off + 1) return this.walk(nd.children[0], p1, p2, a, b, w);
    if (t1 < -off - 1 && t2 < -off - 1) return this.walk(nd.children[1], p1, p2, a, b, w);
    let side, f1, f2;
    if (t1 < t2) { const id = 1 / (t1 - t2); side = 1; f2 = (t1 + off + EPS) * id; f1 = (t1 - off + EPS) * id; }
    else if (t1 > t2) { const id = 1 / (t1 - t2); side = 0; f2 = (t1 - off - EPS) * id; f1 = (t1 + off + EPS) * id; }
    else { side = 0; f1 = 1; f2 = 0; }
    f1 = Math.max(0, Math.min(1, f1)); f2 = Math.max(0, Math.min(1, f2));
    let m = p1 + (p2 - p1) * f1; let mid: V3 = [a[0] + f1 * (b[0] - a[0]), a[1] + f1 * (b[1] - a[1]), a[2] + f1 * (b[2] - a[2])];
    this.walk(nd.children[side], p1, m, a, mid, w);
    m = p1 + (p2 - p1) * f2; mid = [a[0] + f2 * (b[0] - a[0]), a[1] + f2 * (b[1] - a[1]), a[2] + f2 * (b[2] - a[2])];
    this.walk(nd.children[side ^ 1], m, p2, mid, b, w);
  }
  private leaf(li: number, w: any) {
    const bsp = this.bsp, lf = bsp.leafs[li];
    for (let i = 0; i < lf.numLeafBrushes; i++) {
      const bi = bsp.leafBrushes[lf.firstLeafBrush + i]; if (this.stamp[bi] === this.cur) continue; this.stamp[bi] = this.cur;
      const br = bsp.brushes[bi]; if (!(br.contents & w.mask)) continue; if (w.ignore && w.ignore.has(bi)) continue;
      this.clipBrush(bi, w);
      if (w.tr.allsolid) return;
    }
  }
  private clipBrush(bi: number, w: any) {
    const bsp = this.bsp, br = bsp.brushes[bi], tr: Trace = w.tr, s = w.s, e = w.e, ext = w.ext;
    let enter = -1, leave = 1, startout = false, getout = false, hitN: V3 | null = null;
    for (let i = 0; i < br.numSides; i++) {
      const side = bsp.brushSides[br.firstSide + i]; const pl = bsp.planes[side.plane], N = pl.n;
      const dist = pl.d + Math.abs(N[0]) * ext[0] + Math.abs(N[1]) * ext[1] + Math.abs(N[2]) * ext[2];
      const d1 = N[0] * s[0] + N[1] * s[1] + N[2] * s[2] - dist, d2 = N[0] * e[0] + N[1] * e[1] + N[2] * e[2] - dist;
      if (d2 > 0) getout = true; if (d1 > 0) startout = true;
      if (d1 > 0 && (d2 >= EPS || d2 >= d1)) return;
      if (d1 <= 0 && d2 <= 0) continue;
      if (d1 > d2) { const f = (d1 - EPS) / (d1 - d2); if (f > enter) { enter = f; hitN = N; } }
      else { const f = (d1 + EPS) / (d1 - d2); if (f < leave) leave = f; }
    }
    if (!startout) { tr.startsolid = true; if (!getout) { tr.allsolid = true; tr.fraction = 0; } tr.hit = bi; return; }
    if (enter < leave && enter > -1 && enter < tr.fraction) { tr.fraction = Math.max(0, enter); tr.normal = [hitN![0], hitN![1], hitN![2]]; tr.hit = bi; }
  }
  /** sweep against an axis-aligned world box (used for props/cubes) */
  clipBox(mins: V3, maxs: V3, w: any) {
    const tr: Trace = w.tr, s = w.s, e = w.e, ext = w.ext;
    let enter = -1, leave = 1, startout = false, getout = false, hitN: V3 | null = null;
    for (let ax = 0; ax < 3; ax++) for (const sg of [1, -1]) {
      const N: V3 = [0, 0, 0]; N[ax] = sg; const dist = (sg > 0 ? maxs[ax] : -mins[ax]) + ext[ax];
      const d1 = sg * s[ax] - dist, d2 = sg * e[ax] - dist;
      if (d2 > 0) getout = true; if (d1 > 0) startout = true;
      if (d1 > 0 && (d2 >= EPS || d2 >= d1)) return;
      if (d1 <= 0 && d2 <= 0) continue;
      if (d1 > d2) { const f = (d1 - EPS) / (d1 - d2); if (f > enter) { enter = f; hitN = N; } } else { const f = (d1 + EPS) / (d1 - d2); if (f < leave) leave = f; }
    }
    if (!startout) { tr.startsolid = true; if (!getout) { tr.allsolid = true; tr.fraction = 0; } return; }
    if (enter < leave && enter > -1 && enter < tr.fraction) { tr.fraction = Math.max(0, enter); tr.normal = hitN!; tr.hit = -2; }
  }
  /** ray cast returning the face hit info for portal placement */
  ray(start: V3, end: V3, mask: number) { return this.trace(start, end, [0, 0, 0], [0, 0, 0], mask); }
}
