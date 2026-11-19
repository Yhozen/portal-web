// Studio model skeletal animation: bones, sequences and compressed animation tracks (MDL v44+).
// Clean-room from the struct layouts in Valve's public Source SDK 2013 headers (public/studio.h:
// mstudiobone_t, mstudioanimdesc_t, mstudioanim_t, mstudioanimvalue_t, mstudioseqdesc_t, Quaternion48/64,
// Vector48) and the Valve Developer Wiki "MDL" page. No engine code was used.
export interface Bone { name: string; parent: number; pos: number[]; quat: number[]; rot: number[]; posscale: number[]; rotscale: number[]; poseToBone: Float32Array /* 3x4 row-major */; }
export interface Seq { name: string; activity: string; looping: boolean; anim: number; fps: number; frames: number;
  /** mstudioseqdesc_t fields used for blending: flags (STUDIO_*), the groupsize[0] x groupsize[1] grid of animation
   *  indices, the pose parameter on each grid axis with its local range, pose keys (when posekeyindex is set), and the
   *  cross-fade times */
  flags: number; grid: number[]; groupsize: [number, number]; param: [number, number]; paramStart: [number, number]; paramEnd: [number, number]; poseKeys: number[] | null; fadein: number; fadeout: number; }
export interface PoseParam { name: string; start: number; end: number; loop: number; }
export interface AnimDesc { name: string; fps: number; frames: number; flags: number; ofs: number; index: number; sectionFrames: number; sectionOfs: number; animblock: number; }
export interface Skeleton { bones: Bone[]; seqs: Seq[]; anims: AnimDesc[]; dv: DataView; staticProp: boolean; poseParams: PoseParam[]; autoplay: number[]; /** .ani file and its block table (start, end): long sequences stream their sections from there */ ani?: DataView; blocks: [number, number][]; }

/** mstudioseqdesc_t / mstudioanimdesc_t flags (public/studio.h) */
export const F = { LOOPING: 1, SNAP: 2, DELTA: 4, AUTOPLAY: 8, POST: 0x10, ALLZEROS: 0x20, CYCLEPOSE: 0x80, REALTIME: 0x100, LOCAL: 0x200, WORLD: 0x4000 };
const cstr = (dv: DataView, o: number) => { let s = ''; for (let p = o; p < dv.byteLength; p++) { const c = dv.getUint8(p); if (!c) break; s += String.fromCharCode(c); } return s; };
function half(h: number) { const s = h >> 15 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; if (e === 0) return s * f * 2 ** -24; if (e === 31) return f ? NaN : s * Infinity; return s * (1 + f / 1024) * 2 ** (e - 15); }
export function eulerQuat(x: number, y: number, z: number) { // RadianEuler (roll x, pitch y, yaw z) -> quaternion
  const sy = Math.sin(z / 2), cy = Math.cos(z / 2), sp = Math.sin(y / 2), cp = Math.cos(y / 2), sr = Math.sin(x / 2), cr = Math.cos(x / 2);
  return [sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy, cr * cp * cy + sr * sp * sy];
}

export function parseSkeleton(buf: ArrayBuffer): Skeleton {
  const dv = new DataView(buf), i32 = (o: number) => dv.getInt32(o, true), f32 = (o: number) => dv.getFloat32(o, true);
  const v = (o: number, n: number) => Array.from({ length: n }, (_, k) => f32(o + k * 4));
  const bones: Bone[] = [];
  for (let i = 0, n = i32(156), b = i32(160); i < n; i++) { const o = b + i * 216;
    const p2b = new Float32Array(12); for (let k = 0; k < 12; k++) p2b[k] = f32(o + 96 + k * 4);
    bones.push({ name: cstr(dv, o + i32(o)), parent: i32(o + 4), pos: v(o + 32, 3), quat: v(o + 44, 4), rot: v(o + 60, 3), posscale: v(o + 72, 3), rotscale: v(o + 84, 3), poseToBone: p2b }); }
  const anims: AnimDesc[] = [];
  for (let i = 0, n = i32(180), b = i32(184); i < n; i++) { const o = b + i * 100;
    anims.push({ name: cstr(dv, o + i32(o + 4)), fps: f32(o + 8), flags: i32(o + 12), frames: i32(o + 16), animblock: i32(o + 52), ofs: o + i32(o + 56), index: i32(o + 56), sectionOfs: o + i32(o + 80), sectionFrames: i32(o + 84) }); }
  const seqs: Seq[] = [];
  for (let i = 0, n = i32(188), b = i32(192); i < n; i++) { const o = b + i * 212;
    const gs: [number, number] = [Math.max(1, i32(o + 68)), Math.max(1, i32(o + 72))], grid = Array.from({ length: gs[0] * gs[1] }, (_, k) => dv.getInt16(o + i32(o + 60) + k * 2, true));
    const ai = grid[0]; const a = anims[ai], pk = i32(o + 160);
    seqs.push({ name: cstr(dv, o + i32(o + 4)).toLowerCase(), activity: cstr(dv, o + i32(o + 8)).toLowerCase(), looping: !!(i32(o + 12) & 1), anim: ai, fps: a?.fps || 30, frames: a?.frames || 1,
      flags: i32(o + 12), grid, groupsize: gs, param: [i32(o + 76), i32(o + 80)], paramStart: [f32(o + 84), f32(o + 88)], paramEnd: [f32(o + 92), f32(o + 96)],
      poseKeys: pk ? Array.from({ length: gs[0] + gs[1] }, (_, k) => f32(o + pk + k * 4)) : null, fadein: f32(o + 104), fadeout: f32(o + 108) }); }
  const poseParams: PoseParam[] = []; for (let i = 0, n = i32(300), b = i32(304); i < n; i++) { const o = b + i * 20; poseParams.push({ name: cstr(dv, o + i32(o)), start: f32(o + 8), end: f32(o + 12), loop: f32(o + 16) }); }
  const autoplay = seqs.map((q, i) => q.flags & F.AUTOPLAY ? i : -1).filter(i => i >= 0);
  const blocks: [number, number][] = []; for (let i = 0, n = i32(352), b = i32(356); i < n; i++) blocks.push([i32(b + i * 8), i32(b + i * 8 + 4)]);
  return { bones, seqs, anims, dv, staticProp: !!(i32(152) & 0x10) /* studiohdr_t.flags & STUDIOHDR_FLAGS_STATIC_PROP */, blocks, poseParams, autoplay };
}

// mstudioanimvalue_t run-length decode
function animValue(dv: DataView, p: number, frame: number) {
  let k = frame;
  for (let guard = 0; guard < 10000; guard++) { const valid = dv.getUint8(p), total = dv.getUint8(p + 1); if (total > k) break; if (!total) return 0; k -= total; p += (valid + 1) * 2; }
  const valid = dv.getUint8(p);
  return dv.getInt16(p + (valid > k ? k + 1 : valid) * 2, true);
}

/** per-bone local position + quaternion for an anim at an integer frame */
// Sections and blocks follow mstudioanimdesc_t::pAnim in the public SDK's studio.cpp: a long animation is split into
// sections of sectionframes frames, the last frame of a long animation is stored on its own in an extra section, and a
// section with animblock > 0 lives in the model's .ani file at that block's start + animindex.
function sampleFrame(sk: Skeleton, a: AnimDesc, frame: number, pos: number[][], quat: number[][]) {
  let dv = sk.dv, p = a.ofs, f = frame;
  if (a.animblock > 0 && !(a.sectionFrames > 0)) { const b = sk.blocks[a.animblock]; if (!sk.ani || !b) return new Uint8Array(sk.bones.length); dv = sk.ani; p = b[0] + a.index; }
  if (a.sectionFrames > 0) { let sec: number;
    if (a.frames > a.sectionFrames && frame === a.frames - 1) { sec = Math.floor(a.frames / a.sectionFrames) + 1; f = 0; } else { sec = Math.floor(frame / a.sectionFrames); f = frame - sec * a.sectionFrames; }
    const so = a.sectionOfs + sec * 8, block = dv.getInt32(so, true), index = dv.getInt32(so + 4, true);
    if (block === 0) p = descBase(sk, a) + index;
    else { const b = sk.blocks[block]; if (!sk.ani || !b) return new Uint8Array(sk.bones.length); dv = sk.ani; p = b[0] + index; } }
  const seen = new Uint8Array(sk.bones.length);
  for (let guard = 0; guard < 256 && p > 0 && p < dv.byteLength; guard++) {
    const bi = dv.getUint8(p), flags = dv.getUint8(p + 1), next = dv.getInt16(p + 2, true);
    const B = sk.bones[bi]; if (!B) break; seen[bi] = 1; const delta = !!(flags & 0x10);
    let d = p + 4;
    if (flags & 0x02) { // Quaternion48
      const x = dv.getUint16(d, true), y = dv.getUint16(d + 2, true), zw = dv.getUint16(d + 4, true);
      const qx = (x - 32768) / 32768, qy = (y - 32768) / 32768, qz = ((zw & 0x7fff) - 16384) / 16384; let qw = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy - qz * qz)); if (zw & 0x8000) qw = -qw;
      quat[bi] = [qx, qy, qz, qw]; d += 6;
    } else if (flags & 0x20) { // Quaternion64
      const lo = dv.getUint32(d, true), hi = dv.getUint32(d + 4, true);
      const xi = lo & 0x1fffff, yi = ((lo >>> 21) | ((hi & 0x3ff) << 11)) & 0x1fffff, zi = (hi >>> 10) & 0x1fffff, wn = hi >>> 31;
      const qx = (xi - 1048576) / 1048576.5, qy = (yi - 1048576) / 1048576.5, qz = (zi - 1048576) / 1048576.5; let qw = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy - qz * qz)); if (wn) qw = -qw;
      quat[bi] = [qx, qy, qz, qw]; d += 8;
    }
    if (flags & 0x01) { pos[bi] = [half(dv.getUint16(d, true)), half(dv.getUint16(d + 2, true)), half(dv.getUint16(d + 4, true))]; d += 6; }
    let vp = p + 4;
    if (flags & 0x08) { const e = [0, 0, 0]; for (let k = 0; k < 3; k++) { const o = dv.getInt16(vp + k * 2, true); if (o) e[k] = animValue(dv, vp + o, f) * B.rotscale[k]; if (!delta) e[k] += B.rot[k]; } quat[bi] = eulerQuat(e[0], e[1], e[2]); vp += 6; }
    if (flags & 0x04) { const e = [0, 0, 0]; for (let k = 0; k < 3; k++) { const o = dv.getInt16(vp + k * 2, true); if (o) e[k] = animValue(dv, vp + o, f) * B.posscale[k]; if (!delta) e[k] += B.pos[k]; } pos[bi] = e; }
    if (!next) break; p += next;
  }
  return seen;
}
const descIndex = new WeakMap<AnimDesc, number>();
function descBase(sk: Skeleton, a: AnimDesc) { // start of the mstudioanimdesc_t itself
  let b = descIndex.get(a); if (b === undefined) { const dv = sk.dv; b = dv.getInt32(184, true) + sk.anims.indexOf(a) * 100; descIndex.set(a, b); } return b;
}

const slerp = (a: number[], b: number[], t: number) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; const s = d < 0 ? -1 : 1; d *= s;
  const o = [0, 0, 0, 0]; for (let k = 0; k < 4; k++) o[k] = a[k] * (1 - t) + b[k] * s * t; // nlerp is fine for adjacent frames
  const l = Math.hypot(o[0], o[1], o[2], o[3]) || 1; return o.map(x => x / l);
};

/** skinning matrices (3x4 row-major per bone, bone pose * poseToBone) for sequence seq at cycle 0..1 */
export function poseMatrices(sk: Skeleton, seqIdx: number, cycle: number, ex?: PoseExtra): Float32Array {
  // Compiled animation tracks carry studiomdl's 90-degree root rotation. For models compiled as static props
  // the VVD bind pose already has it baked in, so normalise those so sequence 0, frame 0 is the bind pose.
  // Other models (door halves, buttons) must use the raw pose: their VVD verts are in the unrotated pose space
  // (their hull, in model space, is the rotated one).
  if (!sk.staticProp) return rawPose(sk, seqIdx, cycle, ex);
  let C = fixCache.get(sk); if (!C) { const m0 = rawPose(sk, 0, 0); C = invert34(Array.from(m0.slice(0, 12))); fixCache.set(sk, C); }
  const raw = rawPose(sk, seqIdx, cycle, ex), out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length / 12; i++) out.set(mul34(C, 0, raw, i * 12), i * 12);
  return out;
}
function rawPose(sk: Skeleton, seqIdx: number, cycle: number, ex?: PoseExtra): Float32Array {
  const nb = sk.bones.length, out = new Float32Array(nb * 12), world = rawBones(sk, seqIdx, cycle, ex);
  for (let i = 0; i < nb; i++) out.set(mul34(world, i * 12, sk.bones[i].poseToBone, 0), i * 12);
  return out;
}
/** model-space bone matrices (3x4 row-major per bone) for sequence seq at cycle 0..1, with the same static-prop
 *  normalisation as poseMatrices; for pose dumps and attachments */
export function boneMatrices(sk: Skeleton, seqIdx: number, cycle: number, ex?: PoseExtra): Float32Array {
  const world = rawBones(sk, seqIdx, cycle, ex); if (!sk.staticProp) return world;
  poseMatrices(sk, 0, 0); const C = fixCache.get(sk)!, out = new Float32Array(world.length);
  for (let i = 0; i < world.length / 12; i++) out.set(mul34(C, 0, world, i * 12), i * 12);
  return out;
}
/** what a prop's pose is made of, beyond its main sequence and cycle: pose parameter values (in the parameter's own
 *  units, 0 when unset, as CBaseAnimating::InitBoneControllers does) and earlier sequences still fading out */
export interface PoseExtra { poses?: ArrayLike<number>; fades?: { seq: number; cycle: number; weight: number }[]; }
type Pose = { pos: number[][]; quat: number[][] };
const qalign = (p: number[], q: number[]) => { let a = 0, b = 0; for (let k = 0; k < 4; k++) { a += (p[k] - q[k]) ** 2; b += (p[k] + q[k]) ** 2; } return a > b ? q.map(v => -v) : q; };
const qnorm = (q: number[]) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map(v => v / l); };
/** aligned linear blend, renormalised (QuaternionBlend): 0 gives p, 1 gives q */
const qblend = (p: number[], q: number[], t: number) => { const r = qalign(p, q); return qnorm([0, 1, 2, 3].map(k => p[k] * (1 - t) + r[k] * t)); };
/** true slerp (QuaternionSlerp), for weighting whole sequences */
function qslerp(p: number[], q0: number[], t: number) { const q = qalign(p, q0); let c = p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3];
  let sp = 1 - t, sq = t; if (1 - c > 1e-6) { const om = Math.acos(Math.min(1, c)), so = Math.sin(om); sp = Math.sin((1 - t) * om) / so; sq = Math.sin(t * om) / so; }
  return [0, 1, 2, 3].map(k => sp * p[k] + sq * q[k]); }
/** scale a rotation's angle by t (QuaternionScale) */
function qscale(p: number[], t: number) { const sinom = Math.min(1, Math.hypot(p[0], p[1], p[2])), ss = Math.sin(Math.asin(sinom) * t), k = ss / (sinom + 1.1920929e-7);
  const w = Math.sqrt(Math.max(0, 1 - ss * ss)); return [p[0] * k, p[1] * k, p[2] * k, p[3] < 0 ? -w : w]; }

/** one animation at a cycle; delta animations start from zero offsets, others from the bind pose (CalcAnimation) */
function calcAnim(sk: Skeleton, ai: number, cycle: number): Pose {
  const a = sk.anims[ai], delta = !!(a && a.flags & F.DELTA);
  const init = () => ({ pos: sk.bones.map(b => delta ? [0, 0, 0] : b.pos.slice()), quat: sk.bones.map(b => delta ? [0, 0, 0, 1] : b.quat.slice()) });
  const P = init(); if (!a) return P;
  const fr = Math.max(0, Math.min(1, cycle)) * Math.max(0, a.frames - 1), f0 = Math.floor(fr), f1 = Math.min(a.frames - 1, f0 + 1), t = fr - f0;
  sampleFrame(sk, a, f0, P.pos, P.quat);
  if (t > 1e-3 && f1 !== f0) { const Q = init(); sampleFrame(sk, a, f1, Q.pos, Q.quat);
    for (let i = 0; i < P.pos.length; i++) { P.pos[i] = P.pos[i].map((v, k) => v + (Q.pos[i][k] - v) * t); P.quat[i] = slerp(P.quat[i], Q.quat[i], t); } }
  return P;
}
/** Studio_LocalPoseParameter: where the pose parameter on grid axis `axis` sits, as [index, fraction] */
function localParam(sk: Skeleton, s: Seq, axis: 0 | 1, poses?: ArrayLike<number>): [number, number] {
  const pi = s.param[axis], P = sk.poseParams[pi]; if (pi < 0 || !P || s.groupsize[axis] < 2) return [0, 0];
  let v = poses?.[pi] ?? 0;
  if (P.loop) { const wrap = (P.start + P.end) / 2 + P.loop / 2, shift = P.loop - wrap; v -= P.loop * Math.floor((v + shift) / P.loop); }
  const n = s.groupsize[axis];
  if (!s.poseKeys) { const ls = (s.paramStart[axis] - P.start) / (P.end - P.start), le = (s.paramEnd[axis] - P.start) / (P.end - P.start);
    let f = Math.max(0, Math.min(1, ((v - P.start) / (P.end - P.start) - ls) / (le - ls))), idx = 0;
    if (n > 2) { idx = Math.floor(f * (n - 1)); if (idx === n - 1) idx = n - 2; f = f * (n - 1) - idx; } return [idx, f]; }
  const key = (k: number) => s.poseKeys![(axis ? s.groupsize[0] : 0) + k]; let idx = 0, f = 0;
  for (;;) { f = (v - key(idx)) / (key(idx + 1) - key(idx)); if (idx < n - 2 && f > 1) { idx++; continue; } break; }
  return [idx, Math.max(0, Math.min(1, f))];
}
function blendBones(A: Pose, B: Pose, t: number) { for (let i = 0; i < A.pos.length; i++) { A.quat[i] = qblend(A.quat[i], B.quat[i], t); A.pos[i] = A.pos[i].map((v, k) => v * (1 - t) + B.pos[i][k] * t); } }
/** CalcPoseSingle: a sequence's pose at a cycle, bilinearly blended over its animation grid by the pose parameters */
function calcPoseSingle(sk: Skeleton, si: number, cycle: number, poses?: ArrayLike<number>): Pose {
  const s = sk.seqs[si];
  if (s.flags & F.LOOPING) { cycle -= Math.floor(cycle); } else cycle = Math.max(0, Math.min(1, cycle));
  const [i0, s0] = localParam(sk, s, 0, poses), [i1, s1] = localParam(sk, s, 1, poses);
  const at = (x: number, y: number) => calcAnim(sk, s.grid[Math.min(y, s.groupsize[1] - 1) * s.groupsize[0] + Math.min(x, s.groupsize[0] - 1)], cycle);
  const row = (y: number) => { if (s0 < 0.001) return at(i0, y); if (s0 > 0.999) return at(i0 + 1, y); const A = at(i0, y); blendBones(A, at(i0 + 1, y), s0); return A; };
  if (s1 < 0.001) return row(i1); if (s1 > 0.999) return row(i1 + 1);
  const A = row(i1); blendBones(A, row(i1 + 1), s1); return A;
}
/** SlerpBones: lay pose B over A with weight w; delta sequences add their rotation (after the base for STUDIO_POST) */
function slerpBones(A: Pose, B: Pose, flags: number, w: number) {
  if (w <= 0) return; w = Math.min(1, w);
  for (let i = 0; i < A.pos.length; i++) {
    if (flags & F.DELTA) { const d = qscale(B.quat[i], w); A.quat[i] = qnorm(flags & F.POST ? qmul(A.quat[i], d) : qmul(d, A.quat[i])); A.pos[i] = A.pos[i].map((v, k) => v + B.pos[i][k] * w); }
    else { A.quat[i] = qslerp(B.quat[i], A.quat[i], 1 - w); A.pos[i] = A.pos[i].map((v, k) => v * (1 - w) + B.pos[i][k] * w); }
  }
}
/** local bone pose: main sequence, then sequences fading out (newest first, as MaintainSequenceTransitions), then the
 *  model's autoplay sequences (CalcAutoplaySequences; the camera and turret aim layers are these) */
export function localPose(sk: Skeleton, seqIdx: number, cycle: number, ex?: PoseExtra): Pose {
  const P: Pose = { pos: sk.bones.map(b => b.pos.slice()), quat: sk.bones.map(b => b.quat.slice()) };
  const acc = (si: number, c: number, w: number) => { const s = sk.seqs[si]; if (!s) return; slerpBones(P, calcPoseSingle(sk, si, c, ex?.poses), s.flags, w); };
  acc(seqIdx, cycle, 1);
  if (ex?.fades) for (let i = ex.fades.length - 1; i >= 0; i--) acc(ex.fades[i].seq, ex.fades[i].cycle, ex.fades[i].weight);
  for (const si of sk.autoplay) acc(si, 0, 1);
  return P;
}
function rawBones(sk: Skeleton, seqIdx: number, cycle: number, ex?: PoseExtra): Float32Array {
  const nb = sk.bones.length, { pos, quat } = localPose(sk, seqIdx, cycle, ex);
  const world = new Float32Array(nb * 12);
  for (let i = 0; i < nb; i++) {
    const [x, y, z, w] = quat[i], p = pos[i];
    const l = [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), p[0], 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), p[1], 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y), p[2]];
    const par = sk.bones[i].parent; const W = par >= 0 ? mul34(world, par * 12, l, 0) : l; world.set(W, i * 12);
  }
  return world;
}
function mul34(A: ArrayLike<number>, ao: number, B: ArrayLike<number>, bo: number) {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) { for (let c = 0; c < 4; c++) { let v = A[ao + r * 4] * B[bo + c] + A[ao + r * 4 + 1] * B[bo + 4 + c] + A[ao + r * 4 + 2] * B[bo + 8 + c]; if (c === 3) v += A[ao + r * 4 + 3]; o[r * 4 + c] = v; } }
  return o;
}
/** $includemodel names (animation-only models whose sequences are merged by bone name) */
export function includeModels(buf: ArrayBuffer): string[] {
  const dv = new DataView(buf), n = dv.getInt32(336, true), b = dv.getInt32(340, true), out: string[] = [];
  for (let i = 0; i < n && i < 16; i++) { const o = b + i * 8; out.push(cstr(dv, o + dv.getInt32(o + 4, true))); }
  return out;
}

const qmul = (a: number[], b: number[]) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qconj = (q: number[]) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q: number[], v: number[]) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [r[0], r[1], r[2]]; };
const fixCache = new WeakMap<Skeleton, number[]>();
function invert34(m: number[]) { // rigid 3x4 inverse
  const o = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0];
  for (let r = 0; r < 3; r++) o[r * 4 + 3] = -(o[r * 4] * m[3] + o[r * 4 + 1] * m[7] + o[r * 4 + 2] * m[11]); return o;
}
