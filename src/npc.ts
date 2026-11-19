// Security cameras (npc_security_camera): the lens turns toward the player while it can see them, and drifts back to
// looking straight out when it can't. Portal's camera code isn't public, so the behaviour follows the Valve Developer
// Wiki's description and HL2's npc_combinecamera in the public SDK 2013 (track a visible target at a limited turn
// rate). The aim itself is data-driven: the model's aim_yaw / aim_pitch pose parameters drive its autoplay delta
// layers, and the lens axis is the "light" attachment's +y axis, so each (yaw, pitch) is mapped to the direction the
// lens actually points by posing the model, and the closest one to the target is chosen.
import { boneMatrices } from './anim.ts';
import type { GLModel } from './models.ts';
import type { V3 } from './math.ts';

export interface AimTable { yaws: number[]; pitches: number[]; dirs: Float32Array; /** lens position at rest, model space */ lensPos: V3; rest: [number, number]; att: number; }
const tables = new WeakMap<GLModel, AimTable | null>();

/** lens axis and position in model space for a pose */
export function lensAt(m: GLModel, att: number, yaw: number, pitch: number): { dir: V3; pos: V3 } {
  const a = m.data.attachments[att], M = boneMatrices(m.skel, 0, 0, { poses: [yaw, pitch] }), b = a.bone * 12, A = a.m;
  const col = (c: number): V3 => [0, 1, 2].map(r => M[b + r * 4] * A[c] + M[b + r * 4 + 1] * A[4 + c] + M[b + r * 4 + 2] * A[8 + c] + (c === 3 ? M[b + r * 4 + 3] : 0)) as V3;
  const d = col(1), l = Math.hypot(...d) || 1; return { dir: d.map(v => v / l) as V3, pos: col(3) };
}
export function aimTable(m: GLModel): AimTable | null {
  if (tables.has(m)) return tables.get(m)!;
  const sk = m.skel, py = sk.poseParams.findIndex(p => p.name === 'aim_yaw'), pp = sk.poseParams.findIndex(p => p.name === 'aim_pitch'), att = m.data.attachments.findIndex(a => a.name === 'light');
  if (py !== 0 || pp !== 1 || att < 0) { tables.set(m, null); return null; }
  const step = 5, range = (p: { start: number; end: number }) => { const o: number[] = []; for (let v = Math.ceil(p.start / step) * step; v <= p.end; v += step) o.push(v); return o; };
  const yaws = range(sk.poseParams[0]), pitches = range(sk.poseParams[1]), dirs = new Float32Array(yaws.length * pitches.length * 3);
  let best = -2, rest: [number, number] = [0, 0];
  yaws.forEach((y, i) => pitches.forEach((p, j) => { const { dir } = lensAt(m, att, y, p); dirs.set(dir, (i * pitches.length + j) * 3);
    const score = dir[0] - 0.001 * (Math.abs(y) + Math.abs(p)) / 180; if (score > best) { best = score; rest = [y, p]; } }));   // rest: lens straight out along the entity's forward axis
  const t = { yaws, pitches, dirs, lensPos: lensAt(m, att, rest[0], rest[1]).pos, rest, att }; tables.set(m, t); return t;
}
/** the table pose whose lens points closest to a model-space direction. Every direction has two poses — (yaw, pitch)
 * and (yaw ± 180, −pitch) — since pitch swings the lens through straight down at 0, so a small penalty on distance
 * from the current pose keeps the choice continuous instead of flipping between the two each tick. */
export function aimFor(t: AimTable, d: V3, cur?: [number, number]): [number, number] {
  const np = t.pitches.length; let best = -Infinity, bi = 0;
  for (let k = 0; k < t.dirs.length; k += 3) { const i = k / 3; let s = t.dirs[k] * d[0] + t.dirs[k + 1] * d[1] + t.dirs[k + 2] * d[2];
    if (cur) s -= 2e-4 * (Math.abs(t.yaws[Math.floor(i / np)] - cur[0]) + Math.abs(t.pitches[i % np] - cur[1]));
    if (s > best) { best = s; bi = i; } }
  return [t.yaws[Math.floor(bi / t.pitches.length)], t.pitches[bi % t.pitches.length]];
}
/** move a pose parameter toward a goal at a limited rate, the short way round */
export const approach = (cur: number, goal: number, maxStep: number) => cur + Math.max(-maxStep, Math.min(maxStep, goal - cur));
