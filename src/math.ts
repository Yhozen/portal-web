// Tiny column-major mat4 / vec3 helpers. Source coordinates: X forward, Y left, Z up, units = inches.
export type V3 = [number, number, number];
export type M4 = Float32Array;
export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const ma = (a: V3, s: number, b: V3): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const D2R = Math.PI / 180;
// Source QAngle (pitch, yaw, roll) in degrees -> forward/right/up (AngleVectors convention)
export function angleVectors(a: ArrayLike<number>) {
  const p = a[0] * D2R, y = a[1] * D2R, r = (a[2] || 0) * D2R;
  const sp = Math.sin(p), cp = Math.cos(p), sy = Math.sin(y), cy = Math.cos(y), sr = Math.sin(r), cr = Math.cos(r);
  const f: V3 = [cp * cy, cp * sy, -sp];
  const rt: V3 = [-1 * sr * sp * cy + -1 * cr * -sy, -1 * sr * sp * sy + -1 * cr * cy, -1 * sr * cp];
  const up: V3 = [cr * sp * cy + -sr * -sy, cr * sp * sy + -sr * cy, cr * cp];
  return { f, r: rt, u: up };
}
export function vectorAngles(f: V3, up?: V3): V3 {
  const yaw = Math.atan2(f[1], f[0]) / D2R, pitch = Math.atan2(-f[2], Math.hypot(f[0], f[1])) / D2R;
  let roll = 0;
  if (up) { const l: V3 = cross(up, f); const ln = len(l); if (ln > 1e-6) { const left = scale(l, 1 / ln); const fz = f[2]; roll = Math.atan2(left[2], cross(left, f)[2]) / D2R; void fz; } }
  return [pitch, yaw, roll];
}
export const m4 = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
export function mul(a: M4, b: M4, out = new Float32Array(16)) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
export function perspective(fovy: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far); return m;
}
// view matrix from eye + basis (Source: forward f, left = -right, up)
export function viewFrom(eye: V3, f: V3, r: V3, u: V3) {
  const m = new Float32Array(16);
  // camera looks down -Z, +X right, +Y up
  m[0] = r[0]; m[4] = r[1]; m[8] = r[2];
  m[1] = u[0]; m[5] = u[1]; m[9] = u[2];
  m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2];
  m[12] = -dot(r, eye); m[13] = -dot(u, eye); m[14] = dot(f, eye); m[15] = 1; return m;
}
// model matrix from origin + basis columns (x=f, y=left, z=up)
export function basisMatrix(o: V3, f: V3, l: V3, u: V3) {
  const m = new Float32Array(16);
  m[0] = f[0]; m[1] = f[1]; m[2] = f[2]; m[4] = l[0]; m[5] = l[1]; m[6] = l[2]; m[8] = u[0]; m[9] = u[1]; m[10] = u[2]; m[12] = o[0]; m[13] = o[1]; m[14] = o[2]; m[15] = 1; return m;
}
export function entityMatrix(origin: V3, angles: ArrayLike<number>) { const { f, r, u } = angleVectors(angles); return basisMatrix(origin, f, scale(r, -1), u); }
export function invertRigid(m: M4) {
  const o = new Float32Array(16);
  o[0] = m[0]; o[1] = m[4]; o[2] = m[8]; o[4] = m[1]; o[5] = m[5]; o[6] = m[9]; o[8] = m[2]; o[9] = m[6]; o[10] = m[10];
  o[12] = -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]); o[13] = -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]); o[14] = -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14]); o[15] = 1; return o;
}
export const xformPoint = (m: M4, p: ArrayLike<number>): V3 => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
export const xformDir = (m: M4, p: ArrayLike<number>): V3 => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];
export const parseV3 = (s: string | undefined): V3 => { const a = (s || '0 0 0').trim().split(/\s+/).map(Number); return [a[0] || 0, a[1] || 0, a[2] || 0]; };
