// Builds GPU-ready geometry for BSP models: fan-triangulated faces + displacements, plus a lightmap atlas.
import { BSP, SURF } from './bsp.ts';
import { dot } from './math.ts';

export const STRIDE = 11; // pos3 uv2 lmuv2 normal3 alpha1
export interface Batch { texdata: number; start: number; count: number; }
export interface ModelMesh { batches: Batch[]; }
export interface WorldMesh { verts: Float32Array; indices: Uint32Array; models: ModelMesh[]; lmW: number; lmH: number; lm: Uint8Array; faceTris: number; overlays: { id: number; texdata: number; start: number; count: number }[]; }

const SKIP_FLAGS = SURF.SKY | SURF.SKY2D | SURF.NODRAW | SURF.HINT | SURF.SKIP | SURF.TRIGGER;

export function buildWorld(bsp: BSP, skipTex: (name: string) => boolean): WorldMesh {
  // --- lightmap atlas (simple shelf packer) ---
  const lmW = 2048; let shelfX = 4, shelfY = 0, shelfH = 0;
  const place = new Map<number, [number, number]>();
  const order = bsp.faces.map((_, i) => i).filter(i => bsp.faces[i].lightofs >= 0).sort((a, b) => bsp.faces[b].lmSize[1] - bsp.faces[a].lmSize[1]);
  for (const fi of order) {
    const f = bsp.faces[fi], w = f.lmSize[0] + 1 + 2, h = f.lmSize[1] + 1 + 2; // 1px border
    if (shelfX + w > lmW) { shelfX = 0; shelfY += shelfH; shelfH = 0; }
    place.set(fi, [shelfX + 1, shelfY + 1]); shelfX += w; shelfH = Math.max(shelfH, h);
  }
  let lmH = 1; while (lmH < shelfY + shelfH + 1) lmH <<= 1;
  const lm = new Uint8Array(lmW * lmH * 4); lm.fill(255);
  const L = bsp.lighting;
  const tm = (c: number, e: number) => { const v = c * Math.pow(2, e) / 255; return Math.min(255, Math.round(Math.pow(Math.min(v / 4, 1), 1 / 2.2) * 255)); };
  for (const [fi, [x0, y0]] of place) {
    const f = bsp.faces[fi], w = f.lmSize[0] + 1, h = f.lmSize[1] + 1; const o = f.lightofs;
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      const sx = Math.min(w - 1, Math.max(0, x)), sy = Math.min(h - 1, Math.max(0, y)); const s = o + (sy * w + sx) * 4;
      if (s + 3 >= L.length) continue;
      const e = (L[s + 3] << 24) >> 24; const d = ((y0 + y) * lmW + (x0 + x)) * 4;
      lm[d] = tm(L[s], e); lm[d + 1] = tm(L[s + 1], e); lm[d + 2] = tm(L[s + 2], e); lm[d + 3] = 255;
    }
  }
  // --- geometry ---
  const verts: number[] = [], idx: number[] = []; const models: ModelMesh[] = [];
  let faceTris = 0;
  const dispOfFace = new Map<number, number>(); bsp.dispinfo.forEach((d, i) => dispOfFace.set(d.mapFace, i));
  for (const m of bsp.models) {
    const byTex = new Map<number, number[]>();
    for (let fi = m.firstFace; fi < m.firstFace + m.numFaces; fi++) {
      const f = bsp.faces[fi]; if (f.texinfo < 0) continue; const ti = bsp.texinfo[f.texinfo];
      if (ti.flags & SKIP_FLAGS || ti.texdata < 0) continue; const td = bsp.texdata[ti.texdata];
      if (skipTex(td.name)) continue;
      const pl = bsp.planes[f.plane]; const n = f.side ? pl.n.map(x => -x) : pl.n;
      const lmPos = place.get(fi);
      const emit = (p: number[], alpha: number, lp?: number[]) => {
        const q = lp || p;
        const u = (dot(p, ti.s) + ti.s[3]) / td.width, v = (dot(p, ti.t) + ti.t[3]) / td.height;
        let lu = 0.5 / lmW, lv = 0.5 / lmH;
        if (lmPos) { lu = (lmPos[0] + dot(q, ti.ls) + ti.ls[3] - f.lmMins[0] + 0.5) / lmW; lv = (lmPos[1] + dot(q, ti.lt) + ti.lt[3] - f.lmMins[1] + 0.5) / lmH; }
        verts.push(p[0], p[1], p[2], u, v, lu, lv, n[0], n[1], n[2], alpha); return verts.length / STRIDE - 1;
      };
      let list = byTex.get(ti.texdata); if (!list) byTex.set(ti.texdata, list = []);
      const fv = bsp.faceVerts(fi);
      if (f.dispinfo >= 0 && bsp.dispinfo[f.dispinfo]) {
        const di = bsp.dispinfo[f.dispinfo];
        // rotate corners so corner 0 is the one nearest the disp start position
        let best = 0, bd = 1e30; for (let i = 0; i < 4; i++) { const d = (fv[i][0] - di.start[0]) ** 2 + (fv[i][1] - di.start[1]) ** 2 + (fv[i][2] - di.start[2]) ** 2; if (d < bd) { bd = d; best = i; } }
        const c = [0, 1, 2, 3].map(i => fv[(i + best) % 4]); const N = (1 << di.power) + 1, base = verts.length / STRIDE;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const tx = x / (N - 1), ty = y / (N - 1);
          const a = c[0].map((v, k) => v + (c[1][k] - v) * ty), b = c[3].map((v, k) => v + (c[2][k] - v) * ty);
          const flat = a.map((v, k) => v + (b[k] - v) * tx);
          const dv = (di.vertStart + y * N + x) * 5; const D = bsp.dispVerts;
          const p = [flat[0] + D[dv] * D[dv + 3], flat[1] + D[dv + 1] * D[dv + 3], flat[2] + D[dv + 2] * D[dv + 3]];
          emit(p, D[dv + 4] / 255, flat);
        }
        for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
          const i0 = base + y * N + x, i1 = i0 + 1, i2 = i0 + N, i3 = i2 + 1;
          if ((x + y) & 1) list.push(i0, i2, i1, i1, i2, i3); else list.push(i0, i3, i1, i0, i2, i3);
          faceTris += 2;
        }
      } else {
        const ids = fv.map(p => emit(p, 1));
        for (let i = 1; i + 1 < ids.length; i++) { list.push(ids[0], ids[i], ids[i + 1]); faceTris++; }
      }
    }
    const batches: Batch[] = [];
    for (const [t, l] of byTex) { batches.push({ texdata: t, start: idx.length, count: l.length }); for (const i of l) idx.push(i); }
    models.push({ batches });
  }
  // --- overlays: one quad each (not clipped to faces), lightmap sampled from their first face.
  // UV corner order (u0v0, u0v1, u1v1, u1v0) as in noclip.website's MIT-licensed BSPFile.ts.
  const overlays: WorldMesh['overlays'] = [];
  for (const ov of bsp.overlays) {
    if (ov.texinfo < 0 || !bsp.texinfo[ov.texinfo]) continue; const ti0 = bsp.texinfo[ov.texinfo]; if (ti0.texdata < 0) continue;
    const N = ov.normal, U = [ov.pts[0][2], ov.pts[1][2], ov.pts[2][2]]; let V = [N[1] * U[2] - N[2] * U[1], N[2] * U[0] - N[0] * U[2], N[0] * U[1] - N[1] * U[0]];
    if (ov.pts[3][2] === 1) V = V.map(x => -x);
    const uv = [[ov.u[0], ov.v[0]], [ov.u[0], ov.v[1]], [ov.u[1], ov.v[1]], [ov.u[1], ov.v[0]]];
    const fi = ov.faces[0], f = fi >= 0 ? bsp.faces[fi] : null, lmPos = f ? place.get(fi) : undefined, ti = f ? bsp.texinfo[f.texinfo] : null;
    const base = verts.length / STRIDE;
    for (let k = 0; k < 4; k++) { const q = ov.pts[k]; const p = [0, 1, 2].map(i => ov.origin[i] + U[i] * q[0] + V[i] * q[1] + N[i] * 0.25);
      let lu = 0.5 / lmW, lv = 0.5 / lmH; if (lmPos && ti && f) { lu = (lmPos[0] + Math.min(f.lmSize[0], Math.max(0, dot(p, ti.ls) + ti.ls[3] - f.lmMins[0])) + 0.5) / lmW; lv = (lmPos[1] + Math.min(f.lmSize[1], Math.max(0, dot(p, ti.lt) + ti.lt[3] - f.lmMins[1])) + 0.5) / lmH; }
      verts.push(p[0], p[1], p[2], uv[k][0], uv[k][1], lu, lv, N[0], N[1], N[2], 1); }
    overlays.push({ id: ov.id, texdata: ti0.texdata, start: idx.length, count: 6 }); idx.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
    overlays[overlays.length - 1].count = 12; // both windings: basis handedness varies
  }
  return { verts: new Float32Array(verts), indices: new Uint32Array(idx), models, lmW, lmH, lm, faceTris, overlays };
}
