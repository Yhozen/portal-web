import { parseMDL, type MdlData } from './mdl.ts';
import type { Assets } from './assets.ts';
import type { MaterialCache, GLMat } from './materials.ts';
import { STRIDE } from './world.ts';
import { parseSkeleton, poseMatrices, type Skeleton } from './anim.ts';

export interface GLModel { data: MdlData; vao: WebGLVertexArrayObject; draws: { start: number; count: number; mat: number }[]; skins: GLMat[][]; skel: Skeleton; base: Float32Array; ib: WebGLBuffer; }
export interface Skinned { vao: WebGLVertexArrayObject; buf: WebGLBuffer; data: Float32Array; }
export function findSeq(m: GLModel, name: string) { name = name.toLowerCase(); return m.skel.seqs.findIndex(s => s.name === name || s.activity === name); }
/** CPU-skin a model into its own vertex buffer for one pose (sequence + cycle). */
export function skinModel(gl: WebGL2RenderingContext, m: GLModel, sk: Skinned | null, seq: number, cycle: number): Skinned {
  if (!sk) { const vao = gl.createVertexArray()!; gl.bindVertexArray(vao); const buf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, m.base.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); for (const [l, k, o] of [[0, 3, 0], [1, 2, 3], [2, 2, 5], [3, 3, 7], [4, 1, 10]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, k, gl.FLOAT, false, STRIDE * 4, o * 4); }
    gl.bindVertexArray(null); sk = { vao, buf, data: new Float32Array(m.base) }; }
  const M = poseMatrices(m.skel, seq, cycle), d = m.data, out = sk.data, base = m.base, n = d.verts.length / 8;
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE, px = base[o], py = base[o + 1], pz = base[o + 2], nx = base[o + 7], ny = base[o + 8], nz = base[o + 9];
    let x = 0, y = 0, z = 0, a = 0, b = 0, c = 0, wsum = 0;
    for (let k = 0; k < 3; k++) { const w = d.weights[i * 3 + k]; if (w <= 0) continue; const j = d.boneIds[i * 3 + k] * 12; if (j >= M.length) continue; wsum += w;
      x += w * (M[j] * px + M[j + 1] * py + M[j + 2] * pz + M[j + 3]); y += w * (M[j + 4] * px + M[j + 5] * py + M[j + 6] * pz + M[j + 7]); z += w * (M[j + 8] * px + M[j + 9] * py + M[j + 10] * pz + M[j + 11]);
      a += w * (M[j] * nx + M[j + 1] * ny + M[j + 2] * nz); b += w * (M[j + 4] * nx + M[j + 5] * ny + M[j + 6] * nz); c += w * (M[j + 8] * nx + M[j + 9] * ny + M[j + 10] * nz); }
    if (wsum > 0) { out[o] = x / wsum; out[o + 1] = y / wsum; out[o + 2] = z / wsum; out[o + 7] = a; out[o + 8] = b; out[o + 9] = c; }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, sk.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, out); return sk;
}
export class ModelCache {
  gl: WebGL2RenderingContext; assets: Assets; mats: MaterialCache; cache = new Map<string, Promise<GLModel | null>>();
  constructor(gl: WebGL2RenderingContext, assets: Assets, mats: MaterialCache) { this.gl = gl; this.assets = assets; this.mats = mats; }
  get(name: string) { name = name.toLowerCase().replace(/\\/g, '/').replace(/\.mdl$/, ''); let p = this.cache.get(name); if (!p) { p = this.load(name).catch(e => { console.warn('mdl', name, e); return null; }); this.cache.set(name, p); } return p; }
  idle() { return Promise.all([...this.cache.values()]); }
  private async load(base: string): Promise<GLModel | null> {
    const [a, b, c] = await Promise.all([this.assets.read(base + '.mdl'), this.assets.read(base + '.vvd'), this.assets.read(base + '.dx90.vtx')]);
    if (!a || !b || !c) { console.warn('missing model', base); return null; }
    const d = parseMDL(a, b, c); const gl = this.gl; const n = d.verts.length / 8;
    const vb = new Float32Array(n * STRIDE);
    for (let i = 0; i < n; i++) { const s = i * 8, o = i * STRIDE; vb[o] = d.verts[s]; vb[o + 1] = d.verts[s + 1]; vb[o + 2] = d.verts[s + 2]; vb[o + 3] = d.verts[s + 6]; vb[o + 4] = d.verts[s + 7];
      vb[o + 5] = 0.5 / 2048; vb[o + 6] = 0.5 / 2048; vb[o + 7] = d.verts[s + 3]; vb[o + 8] = d.verts[s + 4]; vb[o + 9] = d.verts[s + 5]; vb[o + 10] = 1; }
    const idx: number[] = []; const draws: GLModel['draws'] = [];
    for (const m of d.meshes) { draws.push({ start: idx.length, count: m.indices.length, mat: m.material }); for (const i of m.indices) idx.push(i); }
    const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
    const ib = gl.createBuffer()!; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    for (const [l, k, o] of [[0, 3, 0], [1, 2, 3], [2, 2, 5], [3, 3, 7], [4, 1, 10]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, k, gl.FLOAT, false, STRIDE * 4, o * 4); }
    gl.bindVertexArray(null);
    const cds: string[] = (d.materials as any).cds || [''];
    const resolve = async (t: string) => {
      for (const cd of cds) { const p = (cd + t).replace(/^\/+/, ''); if (await this.assets.read('materials/' + p + '.vmt')) return this.mats.get(p); }
      return this.mats.get(t);
    };
    const skins = await Promise.all(d.materials.map(row => Promise.all(row.map(resolve))));
    return { data: d, vao, draws, skins, skel: parseSkeleton(a), base: vb, ib };
  }
}
