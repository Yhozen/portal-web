// Studio model skeletal animation: bones, sequences and compressed animation tracks (MDL v44+).
// Clean-room from the struct layouts in Valve's public Source SDK 2013 headers (public/studio.h:
// mstudiobone_t, mstudioanimdesc_t, mstudioanim_t, mstudioanimvalue_t, mstudioseqdesc_t, Quaternion48/64,
// Vector48) and the Valve Developer Wiki "MDL" page. No engine code was used.
export interface Bone { name: string; parent: number; pos: number[]; quat: number[]; rot: number[]; posscale: number[]; rotscale: number[]; poseToBone: Float32Array /* 3x4 row-major */; }
export interface Seq { name: string; activity: string; looping: boolean; anim: number; fps: number; frames: number; }
export interface AnimDesc { name: string; fps: number; frames: number; flags: number; ofs: number; sectionFrames: number; sectionOfs: number; animblock: number; }
export interface Skeleton { bones: Bone[]; seqs: Seq[]; anims: AnimDesc[]; dv: DataView; staticProp: boolean; }

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
    anims.push({ name: cstr(dv, o + i32(o + 4)), fps: f32(o + 8), flags: i32(o + 12), frames: i32(o + 16), animblock: i32(o + 52), ofs: o + i32(o + 56), sectionOfs: o + i32(o + 80), sectionFrames: i32(o + 84) }); }
  const seqs: Seq[] = [];
  for (let i = 0, n = i32(188), b = i32(192); i < n; i++) { const o = b + i * 212;
    const ai = dv.getInt16(o + i32(o + 60), true); const a = anims[ai];
    seqs.push({ name: cstr(dv, o + i32(o + 4)).toLowerCase(), activity: cstr(dv, o + i32(o + 8)).toLowerCase(), looping: !!(i32(o + 12) & 1), anim: ai, fps: a?.fps || 30, frames: a?.frames || 1 }); }
  return { bones, seqs, anims, dv, staticProp: !!(i32(152) & 0x10) /* studiohdr_t.flags & STUDIOHDR_FLAGS_STATIC_PROP */ };
}

// mstudioanimvalue_t run-length decode
function animValue(dv: DataView, p: number, frame: number) {
  let k = frame;
  for (let guard = 0; guard < 10000; guard++) { const valid = dv.getUint8(p), total = dv.getUint8(p + 1); if (total > k) break; if (!total) return 0; k -= total; p += (valid + 1) * 2; }
  const valid = dv.getUint8(p);
  return dv.getInt16(p + (valid > k ? k + 1 : valid) * 2, true);
}

/** per-bone local position + quaternion for an anim at an integer frame */
function sampleFrame(sk: Skeleton, a: AnimDesc, frame: number, pos: number[][], quat: number[][]) {
  const dv = sk.dv; let p = a.ofs, f = frame;
  if (a.sectionFrames > 0) { const sec = Math.floor(frame / a.sectionFrames); const so = a.sectionOfs + sec * 8; p = descBase(sk, a) + dv.getInt32(so + 4, true); f = frame - sec * a.sectionFrames; }
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
export function poseMatrices(sk: Skeleton, seqIdx: number, cycle: number): Float32Array {
  // Compiled animation tracks carry studiomdl's 90-degree root rotation. For models compiled as static props
  // the VVD bind pose already has it baked in, so normalise those so sequence 0, frame 0 is the bind pose.
  // Other models (door halves, buttons) must use the raw pose: their VVD verts are in the unrotated pose space
  // (their hull, in model space, is the rotated one).
  if (!sk.staticProp) return rawPose(sk, seqIdx, cycle);
  let C = fixCache.get(sk); if (!C) { const m0 = rawPose(sk, 0, 0); C = invert34(Array.from(m0.slice(0, 12))); fixCache.set(sk, C); }
  const raw = rawPose(sk, seqIdx, cycle), out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length / 12; i++) out.set(mul34(C, 0, raw, i * 12), i * 12);
  return out;
}
function rawPose(sk: Skeleton, seqIdx: number, cycle: number): Float32Array {
  const nb = sk.bones.length, out = new Float32Array(nb * 12);
  const pos = sk.bones.map(b => b.pos.slice()), quat = sk.bones.map(b => b.quat.slice());
  const s = sk.seqs[seqIdx], a = s ? sk.anims[s.anim] : null; let seen: Uint8Array | null = null;
  if (a && a.animblock === 0) {
    const fr = Math.max(0, Math.min(1, cycle)) * Math.max(0, a.frames - 1), f0 = Math.floor(fr), f1 = Math.min(a.frames - 1, f0 + 1), t = fr - f0;
    const p0 = pos.map(x => x.slice()), q0 = quat.map(x => x.slice()); seen = sampleFrame(sk, a, f0, p0, q0);
    if (t > 1e-3 && f1 !== f0) { const p1 = pos.map(x => x.slice()), q1 = quat.map(x => x.slice()); sampleFrame(sk, a, f1, p1, q1); for (let i = 0; i < nb; i++) { pos[i] = p0[i].map((v, k) => v + (p1[i][k] - v) * t); quat[i] = slerp(q0[i], q1[i], t); } }
    else { for (let i = 0; i < nb; i++) { pos[i] = p0[i]; quat[i] = q0[i]; } }
  }
  const world = new Float32Array(nb * 12);
  for (let i = 0; i < nb; i++) {
    const [x, y, z, w] = quat[i], p = pos[i];
    const l = [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), p[0], 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), p[1], 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y), p[2]];
    const par = sk.bones[i].parent; const W = par >= 0 ? mul34(world, par * 12, l, 0) : l; world.set(W, i * 12);
    out.set(mul34(world, i * 12, sk.bones[i].poseToBone, 0), i * 12);
  }
  return out;
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
