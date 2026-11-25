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

/** an attachment's frame (axes and origin) in model space for a set of pose parameters */
export function attachFrame(m: GLModel, att: number, poses: number[]): { x: V3; y: V3; z: V3; pos: V3 } {
  const a = m.data.attachments[att], M = boneMatrices(m.skel, 0, 0, { poses }), b = a.bone * 12, A = a.m;
  const col = (c: number): V3 => [0, 1, 2].map(r => M[b + r * 4] * A[c] + M[b + r * 4 + 1] * A[4 + c] + M[b + r * 4 + 2] * A[8 + c] + (c === 3 ? M[b + r * 4 + 3] : 0)) as V3;
  return { x: col(0), y: col(1), z: col(2), pos: col(3) };
}

// Floor turrets (npc_portal_turret_floor). Portal's turret code isn't public; the state machine follows HL2's
// npc_turret_floor.cpp from the public SDK 2013, which Portal's turret is built on: closed and auto-searching until the
// player is in a 60° cone (dot 0.4 on the ground plane), in range and visible from the eyes; deploy (0.667 s), then
// active — aim with UpdateFacing (goal angles in the muzzle's frame, each think moves at most 0.05 s × 360°/s and
// applies a third less, diff / 1.5) and fire whenever the muzzle is within 10° of the target, one shot per 0.1 s
// think; lose the player and search for 5 s sweeping ±60° yaw / ±15° pitch, then retire. Up · z < 0.5 is tipped:
// thrash and fire for 2–2.5 s, then close and die.
// Damage, measured in the original (a11, standing 200 units in front of training_turret, the only one that sees that
// spot, ent_dump !player every tick, Nov 24 11:20 AM EST): health drops every 7 ticks (one volley per 0.1 s think), by
// 4.5 per bullet (4 or 5, the fraction carries), one bullet or two each volley (1.33 on average, never none), first hit
// to dead 1.79 s and 1.68 s in two runs. Each hit shoves the player back about 110 in/s (216 -> 193 in the 0.1 s after
// a two-bullet volley, with ground friction). Two bullets a volley, the first straight at the player and the second
// spread uniformly over a cone of tan 0.26 (a third of those hit at 200 units), is my fit to that, not Valve's numbers.
export const TURRET = { range: 1200, cone: 0.4, maxWait: 5, thinkActive: 0.1, think: 0.05, turnPerThink: 0.05 * 360, aimDot: 0.9848, bullets: 2, spread: 0.26, damage: 4.5 };
/** player health in the original: 100, regenerates 1 per tick (66/s) once 1 s (sv_regeneration_wait_time) has passed
 *  without damage (hurtme 50 → 75 on this skill, back to 100 in 0.4 s) */
export const PLAYER_HP = { regenWait: 1.0, regenPerSec: 66, push: 110 };
export type TurretState = 'idle' | 'deploy' | 'search' | 'active' | 'retire' | 'tipped' | 'dead';
/** npc_rocket_turret, measured in the original on escape_01 (Tue Nov 24 10:10 PM EST). Standing on the
 *  tiles in front of laser_1 at feet [-400, 576, -247.97], host_framerate 0.015:
 *  first rocket 6.84–6.96 s after Enable (the model's open sequence is 4.333 s), later shots 5.96–6.11 s
 *  apart; a rocket is lethal (health 100 → 1 with buddha, so at least 99); projectile about 550 u/s. */
export const ROCKET_TURRET = { firstFire: 6.90, interval: 6.00, speed: 550, damage: 100, radius: 4, blast: 64, loadAhead: 0.967, turnPerSec: 180, range: 4096 };
const DEG = 180 / Math.PI;
/** Source VectorAngles for a direction: [pitch (down positive), yaw] in degrees */
export const dirAngles = (d: V3): [number, number] => [-Math.atan2(d[2], Math.hypot(d[0], d[1])) * DEG, Math.atan2(d[1], d[0]) * DEG];
const angNorm = (a: number) => ((a + 180) % 360 + 360) % 360 - 180;
/** CNPC_FloorTurret::UpdateFacing: goalDir is in model space; poses [yaw, pitch] are updated in place. Returns whether it moved. */
export function turretFace(m: GLModel, eyes: number, poses: number[], goalDir: V3, yawI: number, pitchI: number): boolean {
  const f = attachFrame(m, eyes, poses), d = goalDir, l: V3 = [d[0] * f.x[0] + d[1] * f.x[1] + d[2] * f.x[2], d[0] * f.y[0] + d[1] * f.y[1] + d[2] * f.y[2], d[0] * f.z[0] + d[1] * f.z[1] + d[2] * f.z[2]];
  const [lp, ly] = dirAngles(l), step = TURRET.turnPerThink;
  const dp = angNorm(Math.max(-step, Math.min(step, angNorm(lp)))), dy = angNorm(Math.max(-step, Math.min(step, angNorm(ly))));
  const pp = m.skel.poseParams; const clamp = (i: number, v: number) => Math.max(pp[i].start, Math.min(pp[i].end, v));
  poses[pitchI] = clamp(pitchI, poses[pitchI] + dp / 1.5); poses[yawI] = clamp(yawI, poses[yawI] + dy / 1.5);
  return Math.abs(dp) > 0.1 || Math.abs(dy) > 0.1;
}
/** turn an attachment's +x toward a model-space direction, at `degPerSec`, updating poses [aim_yaw, aim_pitch].
 *  `yUp` is for attachments whose +y is up and +z is right (the rocket sentry barrel); Source VectorAngles is z-up. */
export function aimAttachment(m: GLModel, att: number, poses: number[], goalDir: V3, dt: number, degPerSec: number, yUp = false): boolean {
  const f = attachFrame(m, att, poses), d = goalDir;
  const l: V3 = [d[0] * f.x[0] + d[1] * f.x[1] + d[2] * f.x[2], d[0] * f.y[0] + d[1] * f.y[1] + d[2] * f.y[2], d[0] * f.z[0] + d[1] * f.z[1] + d[2] * f.z[2]];
  const [lp, ly] = dirAngles(yUp ? [l[0], l[2], l[1]] : l), step = degPerSec * dt;
  const dp = angNorm(Math.max(-step, Math.min(step, angNorm(lp)))), dy = angNorm(Math.max(-step, Math.min(step, angNorm(ly))));
  const pp = m.skel.poseParams; const clamp = (i: number, v: number) => Math.max(pp[i].start, Math.min(pp[i].end, v));
  if (pp[1]) poses[1] = clamp(1, poses[1] + dp); if (pp[0]) poses[0] = clamp(0, poses[0] + dy);
  return Math.abs(dp) > 0.1 || Math.abs(dy) > 0.1;
}
