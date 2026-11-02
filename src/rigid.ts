// Simple impulse-based rigid body for cubes (own code; standard textbook method:
// point contacts at the 8 box corners, sequential impulses with Coulomb friction).
// A cube's inertia tensor is isotropic (I = m*s^2/6), so world-space inverse inertia is a scalar.
import { V3, add, sub, scale, dot, cross, len, ma } from './math';

export interface Body { pos: V3; vel: V3; R: Float32Array; w: V3; h: number; sleep: number; asleep: boolean; }
export interface TraceFn { (a: V3, b: V3): { fraction: number; end: V3; normal: V3; startsolid: boolean; ent?: any } }

export const CORNERS: V3[] = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CORNERS.push([x, y, z]);
export function cornerOf(b: Body, s: V3, shrink = 1): V3 { const R = b.R, h = b.h * shrink; return [b.pos[0] + h * (s[0] * R[0] + s[1] * R[4] + s[2] * R[8]), b.pos[1] + h * (s[0] * R[1] + s[1] * R[5] + s[2] * R[9]), b.pos[2] + h * (s[0] * R[2] + s[1] * R[6] + s[2] * R[10])]; }
/** world AABB half-extent of the rotated box */
export function halfExtent(b: Body): V3 { const R = b.R, h = b.h; return [h * (Math.abs(R[0]) + Math.abs(R[4]) + Math.abs(R[8])), h * (Math.abs(R[1]) + Math.abs(R[5]) + Math.abs(R[9])), h * (Math.abs(R[2]) + Math.abs(R[6]) + Math.abs(R[10]))]; }

function orthonormalize(R: Float32Array) {
  let x: V3 = [R[0], R[1], R[2]], y: V3 = [R[4], R[5], R[6]];
  x = scale(x, 1 / len(x)); y = sub(y, scale(x, dot(x, y))); y = scale(y, 1 / len(y)); const z = cross(x, y);
  R[0] = x[0]; R[1] = x[1]; R[2] = x[2]; R[4] = y[0]; R[5] = y[1]; R[6] = y[2]; R[8] = z[0]; R[9] = z[1]; R[10] = z[2];
}
export function rotateBy(R: Float32Array, w: V3, dt: number) {
  // R' = R + dt * [w]x R  (applied per column), then re-orthonormalise
  for (let c = 0; c < 3; c++) { const v: V3 = [R[c * 4], R[c * 4 + 1], R[c * 4 + 2]]; const d = cross(w, v); R[c * 4] += d[0] * dt; R[c * 4 + 1] += d[1] * dt; R[c * 4 + 2] += d[2] * dt; }
  orthonormalize(R);
}

/** one physics step. trace(a,b) is a point trace (world + other solids). Returns contact normals seen. */
export function stepBody(b: Body, dt: number, trace: TraceFn, gravity = 600): V3[] {
  const invM = 1, invI = 6 / ((2 * b.h) ** 2), e = 0.15, mu = 0.55;
  const normals: V3[] = [];
  if (b.asleep) {
    // stay asleep while at least 3 corners are still supported
    let sup = 0; for (const s of CORNERS) { const c = cornerOf(b, s); const t = trace(c, [c[0], c[1], c[2] - 2]); if (t.fraction < 1 || t.startsolid) sup++; }
    if (sup >= 3) return [[0, 0, 1]];
    b.asleep = false; b.sleep = 0;
  }
  b.vel[2] -= gravity * dt;
  // centre sweep (prevents tunnelling at speed) with a small core
  const t0 = trace(b.pos, ma(b.pos, dt, b.vel));
  if (t0.startsolid) b.pos = ma(b.pos, dt, b.vel); else b.pos = t0.fraction < 1 ? ma(t0.end, 0.5, t0.normal) : t0.end;
  if (t0.fraction < 1) { const vn = dot(b.vel, t0.normal); if (vn < 0) b.vel = ma(b.vel, -vn, t0.normal); }
  rotateBy(b.R, b.w, dt);
  for (let it = 0; it < 4; it++) {
    let any = false; let push: V3 = [0, 0, 0];
    for (const s of CORNERS) {
      const c = cornerOf(b, s); const t = trace(b.pos, c);
      if (t.fraction >= 1 || t.startsolid) continue;
      const n = t.normal; const depth = dot(sub(t.end, c), n); if (depth <= 0) continue;
      any = true; if (it === 0) normals.push(n);
      const r = sub(c, b.pos);
      const vp = add(b.vel, cross(b.w, r)); const vn = dot(vp, n);
      // positional correction: largest penetration per axis
      for (let k = 0; k < 3; k++) { const want = n[k] * depth; if (Math.abs(want) > Math.abs(push[k])) push[k] = want; }
      if (vn >= 0) continue;
      const rn = cross(r, n); const kN = invM + invI * dot(rn, rn);
      const j = -(1 + (vn < -60 ? e : 0)) * vn / kN;
      b.vel = ma(b.vel, j * invM, n); b.w = ma(b.w, j * invI, rn);
      // friction
      const vp2 = add(b.vel, cross(b.w, r)); const vt = sub(vp2, scale(n, dot(vp2, n))); const vtl = len(vt);
      if (vtl > 1e-4) { const tdir = scale(vt, 1 / vtl); const rt = cross(r, tdir); const kT = invM + invI * dot(rt, rt);
        const jt = Math.min(vtl / kT, mu * j); b.vel = ma(b.vel, -jt * invM, tdir); b.w = ma(b.w, -jt * invI, rt); }
    }
    if (!any) break;
    b.pos = add(b.pos, scale(push, 0.9));
  }
  // damping + sleep
  b.w = scale(b.w, Math.max(0, 1 - 1.5 * dt));
  if (normals.length) { const slow = len(b.vel) < 8 && len(b.w) < 0.3; b.sleep = slow ? b.sleep + dt : 0; if (b.sleep > 0.4) { b.asleep = true; b.vel = [0, 0, 0]; b.w = [0, 0, 0]; } }
  return normals;
}
