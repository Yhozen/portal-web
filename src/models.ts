import { parseMDL, type MdlData } from './mdl.ts';
import type { Assets } from './assets.ts';
import type { MaterialCache, GLMat } from './materials.ts';
import { STRIDE } from './world.ts';

export interface GLModel { data: MdlData; vao: WebGLVertexArrayObject; draws: { start: number; count: number; mat: number }[]; skins: GLMat[][]; }
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
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    for (const [l, k, o] of [[0, 3, 0], [1, 2, 3], [2, 2, 5], [3, 3, 7], [4, 1, 10]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, k, gl.FLOAT, false, STRIDE * 4, o * 4); }
    gl.bindVertexArray(null);
    const cds: string[] = (d.materials as any).cds || [''];
    const resolve = async (t: string) => {
      for (const cd of cds) { const p = (cd + t).replace(/^\/+/, ''); if (await this.assets.read('materials/' + p + '.vmt')) return this.mats.get(p); }
      return this.mats.get(t);
    };
    const skins = await Promise.all(d.materials.map(row => Promise.all(row.map(resolve))));
    return { data: d, vao, draws, skins };
  }
}
