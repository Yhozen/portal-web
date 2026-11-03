// Model lighting from the BSP's per-leaf ambient light cubes.
// Format per the Valve Developer Wiki "Source BSP File Format" page: lump 52 (LEAF_AMBIENT_INDEX, LDR; 51 = HDR) holds
// { u16 sampleCount, u16 firstSample } per leaf; lump 56 (LEAF_AMBIENT_LIGHTING, LDR; 55 = HDR) holds 28-byte samples:
// a CompressedLightCube (6 x ColorRGBExp32, faces +X -X +Y -Y +Z -Z) then x, y, z (byte fractions of the leaf's bounds) and a pad.
import type { BSP } from './bsp.ts';

/** Leaf cube texels decode as c * 2^exp with no /255 (unlike lightmaps), and read as radiance: the face's irradiance is
 *  about pi times that. Checked against the maps: the floor lightmap under a sample over its +Z face has a median ratio of
 *  2.97 (testchmb_a_00, 403 samples) and 2.66 (testchmb_a_01, 748), measured as the median ratio of upward floor lightmap texels to the +Z cube face of the same leaf. */
const CUBE_SCALE = Math.PI;
/** 6 linear RGB colours, +X -X +Y -Y +Z -Z, flattened (18 floats) */
export type Cube = Float32Array;

export class LightCubes {
  private idx: Uint16Array | null = null; private samples: { pos: [number, number, number]; cube: Cube }[] = [];
  constructor(private bsp: BSP) {
    const pick = (ldr: number, hdr: number) => bsp.lumps[ldr]?.len ? bsp.lumps[ldr] : bsp.lumps[hdr];
    const li = pick(52, 51), ls = pick(56, 55); if (!li?.len || !ls?.len || ls.ver !== 1) return;
    const dv = bsp.dv; this.idx = new Uint16Array(li.len / 2);
    for (let i = 0; i < this.idx.length; i++) this.idx[i] = dv.getUint16(li.ofs + i * 2, true);
    const n = Math.floor(ls.len / 28);
    for (let s = 0; s < n; s++) { const o = ls.ofs + s * 28, cube = new Float32Array(18);
      for (let k = 0; k < 6; k++) { const e = dv.getInt8(o + k * 4 + 3), sc = Math.pow(2, e) * CUBE_SCALE; for (let c = 0; c < 3; c++) cube[k * 3 + c] = dv.getUint8(o + k * 4 + c) * sc; }
      this.samples.push({ pos: [dv.getUint8(o + 24) / 255, dv.getUint8(o + 25) / 255, dv.getUint8(o + 26) / 255], cube }); }
  }
  get ok() { return !!this.idx && this.samples.length > 0; }
  /** inverse-square-distance blend of the samples in p's leaf; null if that leaf has none (solid / outside) */
  private inLeaf(p: ArrayLike<number>): Cube | null {
    const b = this.bsp, li = b.pointLeaf(p as number[]), lf = b.leafs[li]; if (!lf || !this.idx) return null;
    const cnt = this.idx[li * 2], first = this.idx[li * 2 + 1]; if (!cnt) return null;
    const out = new Float32Array(18); let wsum = 0;
    for (let s = first; s < first + cnt && s < this.samples.length; s++) { const sm = this.samples[s]; let d2 = 0;
      for (let k = 0; k < 3; k++) { const q = lf.mins[k] + (lf.maxs[k] - lf.mins[k]) * sm.pos[k] - p[k]; d2 += q * q; }
      const w = 1 / (d2 + 16); wsum += w; for (let k = 0; k < 18; k++) out[k] += sm.cube[k] * w; }
    for (let k = 0; k < 18; k++) out[k] /= wsum; return out;
  }
  /** cube at p; when p is inside a wall (wall-mounted props), step out along the axes until an empty leaf is found */
  at(p: ArrayLike<number>): Cube | null {
    if (!this.ok) return null; const c = this.inLeaf(p); if (c) return c;
    for (const d of [4, 8, 16, 32, 64]) for (const a of [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, -1]]) {
      const r = this.inLeaf([p[0] + a[0] * d, p[1] + a[1] * d, p[2] + a[2] * d]); if (r) return r; }
    return null;
  }
}
