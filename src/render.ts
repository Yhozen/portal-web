import { program } from './gl.ts';
import { STRIDE, type WorldMesh } from './world.ts';
import { MaterialCache, type GLMat } from './materials.ts';
import { mul, type M4, type V3, basisMatrix, invertRigid, dot, cross } from './math.ts';
import type { BSP } from './bsp.ts';
import type { GLModel, Skinned } from './models.ts';

const WORLD_VS = `
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec2 aLM; layout(location=3) in vec3 aN; layout(location=4) in float aA;
uniform mat4 uVP, uModel; out vec2 vUV, vLM; out vec3 vW, vN; out float vA;
void main(){ vec4 w = uModel*vec4(aPos,1.); vW=w.xyz; vUV=aUV; vLM=aLM; vN=mat3(uModel)*aN; vA=aA; gl_Position=uVP*w; }`;
const WORLD_FS = `
in vec2 vUV, vLM; in vec3 vW, vN; in float vA; uniform sampler2D uTex, uLM; uniform vec4 uClip, uTint; uniform float uAlphaTest, uUnlit, uLMScale; uniform vec3 uAmbient;
out vec4 o;
void main(){
  if (dot(vW, uClip.xyz) < uClip.w) discard;
  vec4 t = texture(uTex, vUV) * uTint;
  if (uAlphaTest > 0. && t.a < uAlphaTest) discard;
  vec3 lm = uUnlit > .5 ? vec3(1.) : (uLMScale > 0. ? pow(texture(uLM, vLM).rgb, vec3(2.2)) * 4. : uAmbient * (0.65 + 0.35*max(dot(normalize(vN), normalize(vec3(.3,.2,.9))),0.)));
  vec3 c = pow(t.rgb, vec3(2.2)) * lm;
  o = vec4(pow(c, vec3(1./2.2)), t.a);
}`;
const OVAL_VS = `layout(location=0) in vec2 aP; uniform mat4 uVP, uModel; uniform float uScale, uFull; out vec2 vP; void main(){ vP=aP*uScale; gl_Position = uFull > .5 ? vec4(aP, -0.999, 1.) : uVP*uModel*vec4(0., -vP.x*32., vP.y*54., 1.); if (uFull > .5) vP = vec2(0.); }`;
const OVAL_FS = `in vec2 vP; uniform vec4 uColor; uniform float uMode; out vec4 o;
void main(){ float r = length(vP);
  if (uMode < 0.5) { if (r > 1.) discard; o = uColor; }               // solid / stencil fill
  else if (uMode < 1.5) { if (r > 1.) discard; o = uColor; gl_FragDepth = 1.; } // depth clear
  else { float k = smoothstep(1.12, 1.0, r) * smoothstep(0.80, 1.0, r); if (k <= 0.01) discard; o = vec4(uColor.rgb * (0.6 + 0.8*k), k); } }`;

export interface Portal { pos: V3; f: V3; r: V3; u: V3; color: V3; open: boolean; linked: Portal | null; name: string; }
export interface Instance { model: number; matrix: M4; visible: boolean; alpha?: number; texFrame?: number; }
export interface MeshDraw { draw(vp: M4, clip: Float32Array): void; }
export interface PropInst { model: GLModel | null; matrix: M4; visible: boolean; skin: number; texFrame?: number; ambient: [number, number, number]; tint?: [number, number, number];
  seq?: number; cycle?: number; rate?: number; loop?: boolean; skinned?: Skinned | null; posed?: string; onDone?: () => void; }

export function portalMatrix(p: Portal) { return basisMatrix(p.pos, p.f, [-p.r[0], -p.r[1], -p.r[2]], p.u); }
const ROT180 = (() => { const m = new Float32Array(16); m[0] = -1; m[5] = -1; m[10] = 1; m[15] = 1; return m; })();
/** world transform taking things at portal a to portal b (exit through b) */
export function throughPortal(a: Portal, b: Portal) { return mul(portalMatrix(b), mul(ROT180, invertRigid(portalMatrix(a)))); }

export class Renderer {
  gl: WebGL2RenderingContext; mats: MaterialCache; world!: { vao: WebGLVertexArrayObject; mesh: WorldMesh; lm: WebGLTexture; mats: GLMat[] };
  prog = { world: null as any, oval: null as any }; ovalVao: WebGLVertexArrayObject; instances: Instance[] = []; time = 0; overlayState = new Map<number, { texFrame?: number; hidden?: boolean }>(); showOverlays = true; portals: Portal[] = []; extra: MeshDraw[] = []; props: PropInst[] = [];
  maxDepth = 2; stats = { draws: 0, views: 0, pvsHits: 0, pvsBuilds: 0, culled: 0 }; usePVS = true; bsp: BSP | null = null;
  private pvsCache = new Map<number, { vao: WebGLVertexArrayObject; ib: WebGLBuffer; batches: { texdata: number; start: number; count: number }[] }>();
  private vb: WebGLBuffer | null = null; private visBits: Uint8Array | null = null; private visCluster = -2;
  /** cluster of a point (-1 = solid / outside: no culling) */
  clusterAt(p: ArrayLike<number>) { const b = this.bsp; if (!b || !b.vis) return -1; return b.leafs[b.pointLeaf(p as any)]?.cluster ?? -1; }
  /** Per-cluster world index buffer: only faces in leaves the cluster's PVS row marks, grouped one draw per texture.
   *  (The PVS itself is the compiler's vvis output stored in the BSP; method per the Valve Developer Wiki BSP page.) */
  private pvsWorld(cluster: number) {
    let e = this.pvsCache.get(cluster); if (e) { this.pvsCache.delete(cluster); this.pvsCache.set(cluster, e); this.stats.pvsHits++; return e; }
    const b = this.bsp!, m = this.world.mesh, row = b.clusterVis(cluster)!; const NF = m.faceStart.length; const on = new Uint8Array(NF);
    for (let fi = 0; fi < NF; fi++) if (m.faceDisp[fi]) on[fi] = 1;
    for (const lf of b.leafs) { const c = lf.cluster; if (c < 0 || !(row[c >> 3] & (1 << (c & 7)))) continue; for (let k = 0; k < lf.numLeafFaces; k++) on[b.leafFaces[lf.firstLeafFace + k]] = 1; }
    const byTex = new Map<number, number[]>(); for (let fi = 0; fi < NF; fi++) { if (!on[fi] || m.faceStart[fi] < 0) continue; let l = byTex.get(m.faceTex[fi]); if (!l) byTex.set(m.faceTex[fi], l = []); l.push(fi); }
    let n = 0; for (const l of byTex.values()) for (const fi of l) n += m.faceCount[fi];
    const ix = new Uint32Array(n); const batches: { texdata: number; start: number; count: number }[] = []; let o = 0;
    for (const [t, l] of byTex) { const st = o; for (const fi of l) { ix.set(m.indices.subarray(m.faceStart[fi], m.faceStart[fi] + m.faceCount[fi]), o); o += m.faceCount[fi]; } batches.push({ texdata: t, start: st, count: o - st }); }
    const gl = this.gl, vao = gl.createVertexArray()!; gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    for (const [l, k, of] of [[0, 3, 0], [1, 2, 3], [2, 2, 5], [3, 3, 7], [4, 1, 10]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, k, gl.FLOAT, false, STRIDE * 4, of * 4); }
    const ib = gl.createBuffer()!; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW); gl.bindVertexArray(null);
    e = { vao, ib, batches }; this.pvsCache.set(cluster, e); this.stats.pvsBuilds++;
    if (this.pvsCache.size > 24) { const [k, old] = this.pvsCache.entries().next().value!; this.pvsCache.delete(k); gl.deleteBuffer(old.ib); gl.deleteVertexArray(old.vao); }
    return e;
  }
  private setVis(cluster: number) { if (cluster === this.visCluster) return; this.visCluster = cluster; this.visBits = cluster >= 0 && this.usePVS ? this.bsp!.clusterVis(cluster) : null; }
  /** box test: visible if the centre or any corner (transformed by m) lands in a PVS-visible or solid cluster */
  private seenBox(m: M4, lo: ArrayLike<number>, hi: ArrayLike<number>) { if (!this.visBits) return true;
    for (let k = 0; k < 9; k++) { const x = k === 8 ? (lo[0] + hi[0]) / 2 : k & 1 ? hi[0] : lo[0], y = k === 8 ? (lo[1] + hi[1]) / 2 : k & 2 ? hi[1] : lo[1], z = k === 8 ? (lo[2] + hi[2]) / 2 : k & 4 ? hi[2] : lo[2];
      if (this.seen([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]])) return true; } return false; }
  private seen(p: ArrayLike<number>) { const v = this.visBits; if (!v) return true; const c = this.clusterAt(p); if (c < 0) return true; return !!(v[c >> 3] & (1 << (c & 7))); } useLightmap = true; noPortalRender = false;
  constructor(gl: WebGL2RenderingContext, mats: MaterialCache) {
    this.gl = gl; this.mats = mats;
    this.prog.world = program(gl, WORLD_VS, WORLD_FS); this.prog.oval = program(gl, OVAL_VS, OVAL_FS);
    this.ovalVao = gl.createVertexArray()!; gl.bindVertexArray(this.ovalVao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }
  async setWorld(bsp: BSP, mesh: WorldMesh) {
    const gl = this.gl, vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const vb = this.vb = gl.createBuffer(); this.bsp = bsp; this.pvsCache.clear(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    const at = [[0, 3, 0], [1, 2, 3], [2, 2, 5], [3, 3, 7], [4, 1, 10]];
    for (const [l, n, o] of at) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, STRIDE * 4, o * 4); }
    gl.bindVertexArray(null);
    const lm = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, lm); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, mesh.lmW, mesh.lmH, 0, gl.RGBA, gl.UNSIGNED_BYTE, mesh.lm);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const mats = await Promise.all(bsp.texdata.map(t => this.mats.get(t.name)));
    this.world = { vao, mesh, lm, mats };
  }
  /** pick the VTF frame: env_texturetoggle index (ToggleTexture proxy), AnimatedTexture rate, else frame 0 */
  texOf(m: GLMat, f?: number) { const F = m.frames; if (!F) return m.tex;
    if (f !== undefined && (m.toggle || !m.animRate)) return F[((f % F.length) + F.length) % F.length];
    if (m.animRate) return F[Math.floor(this.time * m.animRate) % F.length]; return m.tex; }
  private drawModels(vp: M4, clip: Float32Array, translucent: boolean) {
    const gl = this.gl, P = this.prog.world, w = this.world;
    gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uVP, false, vp); gl.uniform4fv(P.u.uClip, clip);
    gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uLM, 1); gl.uniform1f(P.u.uLMScale, this.useLightmap ? 1 : 0); gl.uniform3f(P.u.uAmbient, 1, 1, 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, w.lm); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(w.vao);
    const pvs = this.visBits && this.visCluster >= 0 ? this.pvsWorld(this.visCluster) : null;
    for (const inst of this.instances) {
      if (!inst.visible) continue;
      if (inst.model !== 0 && this.bsp && !this.seenBox(inst.matrix, this.bsp.models[inst.model].mins, this.bsp.models[inst.model].maxs)) { this.stats.culled++; continue; }
      gl.uniformMatrix4fv(P.u.uModel, false, inst.matrix);
      const useP = inst.model === 0 && pvs; gl.bindVertexArray(useP ? pvs.vao : w.vao);
      for (const b of useP ? pvs.batches : w.mesh.models[inst.model].batches) {
        const m = w.mats[b.texdata]; if (m.nodraw || m.translucent !== translucent) continue;
        gl.bindTexture(gl.TEXTURE_2D, this.texOf(m, inst.texFrame)); gl.uniform4f(P.u.uTint, m.tint[0], m.tint[1], m.tint[2], m.tint[3] * (inst.alpha ?? 1)); gl.uniform1f(P.u.uAlphaTest, m.alphatest);
        gl.uniform1f(P.u.uUnlit, m.unlit || m.selfillum ? 1 : 0);
        if (translucent) gl.blendFunc(gl.SRC_ALPHA, m.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, b.start * 4); this.stats.draws++;
      }
    }
    gl.uniform1f(P.u.uLMScale, 0);
    for (const pr of this.props) {
      if (!pr.visible || !pr.model) continue; const md = pr.model; if (!this.seenBox(pr.matrix, md.data.mins, md.data.maxs)) { this.stats.culled++; continue; } gl.bindVertexArray(pr.skinned ? pr.skinned.vao : md.vao); gl.uniformMatrix4fv(P.u.uModel, false, pr.matrix);
      gl.uniform3fv(P.u.uAmbient, pr.ambient); const skin = md.skins[pr.skin] || md.skins[0];
      for (const d of md.draws) {
        const m = skin[d.mat] || skin[0]; if (!m || m.translucent !== translucent) continue;
        gl.bindTexture(gl.TEXTURE_2D, this.texOf(m, pr.texFrame)); const t = pr.tint || [1, 1, 1]; gl.uniform4f(P.u.uTint, m.tint[0] * t[0], m.tint[1] * t[1], m.tint[2] * t[2], m.tint[3]); gl.uniform1f(P.u.uAlphaTest, m.alphatest || (m.translucent ? 0 : 0));
        gl.uniform1f(P.u.uUnlit, m.unlit ? 1 : 0);
        if (translucent) gl.blendFunc(gl.SRC_ALPHA, m.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, d.start * 4); this.stats.draws++;
      }
    }
    gl.bindVertexArray(null);
  }
  private ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  /** info_overlay decals (signs, floor arrows, indicator strips) */
  private drawOverlays(vp: M4, clip: Float32Array) {
    const gl = this.gl, P = this.prog.world, w = this.world; if (!w.mesh.overlays?.length) return;
    gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uVP, false, vp); gl.uniform4fv(P.u.uClip, clip); gl.uniformMatrix4fv(P.u.uModel, false, this.ident);
    gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uLM, 1); gl.uniform1f(P.u.uLMScale, this.useLightmap ? 1 : 0); gl.uniform3f(P.u.uAmbient, 1, 1, 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, w.lm); gl.activeTexture(gl.TEXTURE0); gl.bindVertexArray(w.vao);
    gl.enable(gl.BLEND); gl.depthMask(false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);
    for (const o of w.mesh.overlays) { const m = w.mats[o.texdata]; if (!m || m.nodraw) continue; const st = this.overlayState.get(o.id); if (st?.hidden) continue;
      gl.blendFunc(gl.SRC_ALPHA, m.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.bindTexture(gl.TEXTURE_2D, this.texOf(m, st?.texFrame)); gl.uniform4f(P.u.uTint, m.tint[0], m.tint[1], m.tint[2], m.tint[3]); gl.uniform1f(P.u.uAlphaTest, 0); gl.uniform1f(P.u.uUnlit, m.unlit || m.selfillum ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, o.count, gl.UNSIGNED_INT, o.start * 4); this.stats.draws++; }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
  }
  drawScene(vp: M4, clip: Float32Array, visAt?: ArrayLike<number>) {
    const gl = this.gl; this.stats.views++; this.setVis(visAt ? this.clusterAt(visAt) : -1);
    this.drawModels(vp, clip, false);
    if (this.showOverlays) this.drawOverlays(vp, clip);
    for (const e of this.extra) e.draw(vp, clip);
    gl.enable(gl.BLEND); gl.depthMask(false); this.drawModels(vp, clip, true); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  private oval(vp: M4, p: Portal, mode: number, color: number[], scale = 1, full = false) {
    const gl = this.gl, P = this.prog.oval; gl.useProgram(P.p); gl.uniform1f(P.u.uFull, full ? 1 : 0);
    // nudge off the wall to avoid z-fighting
    const m = portalMatrix(p); m[12] += p.f[0] * 0.6; m[13] += p.f[1] * 0.6; m[14] += p.f[2] * 0.6;
    gl.uniformMatrix4fv(P.u.uVP, false, vp); gl.uniformMatrix4fv(P.u.uModel, false, m); gl.uniform1f(P.u.uScale, scale); gl.uniform4fv(P.u.uColor, color); gl.uniform1f(P.u.uMode, mode);
    gl.disable(gl.CULL_FACE); gl.bindVertexArray(this.ovalVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null); gl.enable(gl.CULL_FACE);
  }
  /** Recursive stencil portal rendering. view = world->camera, proj = projection. */
  renderView(proj: M4, view: M4, eye: V3, clip: Float32Array, level: number, exclude: Portal | null, visAt: ArrayLike<number> = eye) {
    const gl = this.gl, vp = mul(proj, view);
    gl.stencilFunc(gl.EQUAL, level, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    this.drawScene(vp, clip, visAt);
    const vis = this.portals.filter(p => p.open && p !== exclude && dot(p.f, eye) - dot(p.f, p.pos) > -1 && dot(p.f, clip as any) * 0 === 0 && (dot(p.pos, clip) >= clip[3] - 1));
    for (const a of vis) {
      const b = a.linked && a.linked.open ? a.linked : null;
      if (!b || level >= this.maxDepth || this.noPortalRender) { gl.stencilFunc(gl.EQUAL, level, 0xff); this.oval(vp, a, 0, b ? [a.color[0] * .5, a.color[1] * .5, a.color[2] * .5, 1] : [a.color[0] * .35, a.color[1] * .35, a.color[2] * .35, 1]); continue; }
      // camera inside the portal hole (closer than the near plane): the whole view is through the portal
      const de = dot(a.f, eye) - dot(a.f, a.pos), rl = (dot(a.r, eye) - dot(a.r, a.pos)) / 32, ul = (dot(a.u, eye) - dot(a.u, a.pos)) / 54;
      const full = level === 0 && de < 3 && rl * rl + ul * ul < 0.9;
      // 1) mark portal pixels: level -> level+1
      gl.colorMask(false, false, false, false); gl.depthMask(false);
      gl.stencilFunc(gl.EQUAL, level, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      this.oval(vp, a, 0, [0, 0, 0, 1], 1, full);
      // 2) clear depth inside
      gl.depthMask(true); gl.depthFunc(gl.ALWAYS); gl.stencilFunc(gl.EQUAL, level + 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      this.oval(vp, a, 1, [0, 0, 0, 1], 1, full); gl.depthFunc(gl.LEQUAL); gl.colorMask(true, true, true, true);
      // 3) virtual view through a, out of b
      const M = throughPortal(b, a); // takes world near b to virtual space near a
      const vview = mul(view, M);
      const Minv = throughPortal(a, b); const veye = [Minv[0] * eye[0] + Minv[4] * eye[1] + Minv[8] * eye[2] + Minv[12], Minv[1] * eye[0] + Minv[5] * eye[1] + Minv[9] * eye[2] + Minv[13], Minv[2] * eye[0] + Minv[6] * eye[1] + Minv[10] * eye[2] + Minv[14]] as V3;
      const vclip = new Float32Array([b.f[0], b.f[1], b.f[2], dot(b.f, b.pos) - 0.5]);
      this.renderView(proj, vview, veye, vclip, level + 1, b, [b.pos[0] + b.f[0] * 8, b.pos[1] + b.f[1] * 8, b.pos[2] + b.f[2] * 8]);
      // 4) restore depth to the portal surface and stencil back to level
      gl.colorMask(false, false, false, false); gl.depthFunc(gl.ALWAYS); gl.stencilFunc(gl.EQUAL, level + 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);
      this.oval(vp, a, 0, [0, 0, 0, 1], 1, full);
      gl.depthFunc(gl.LEQUAL); gl.colorMask(true, true, true, true); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    }
    // rims
    gl.stencilFunc(gl.EQUAL, level, 0xff); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const a of vis) this.oval(vp, a, 2, [a.color[0], a.color[1], a.color[2], 1], 1.12);
    gl.depthMask(true); gl.disable(gl.BLEND);
    void cross;
  }
  frame(proj: M4, view: M4, eye: V3) {
    const gl = this.gl; this.stats.draws = 0; this.stats.views = 0; this.stats.culled = 0;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.STENCIL_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW);
    gl.clearColor(0.05, 0.05, 0.06, 1); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    this.renderView(proj, view, eye, new Float32Array([0, 0, 0, -1e9]), 0, null);
  }
}
