// Source-style player movement: ground/air acceleration, friction, gravity, jump, duck, stair stepping and
// clip-plane sliding. Written from the public Source SDK 2013 gamemovement.cpp behaviour (MIT-licensed SDK)
// and its default cvars (sv_gravity 600, sv_accelerate 10, sv_airaccelerate 10, sv_friction 4, sv_stopspeed 100).
// Numbers marked "measured" come from the original game through tools/oracle-ctl.mjs and tools/parity.mjs
// (checks/reference/movement.json); the SDK alone doesn't have Portal's player code.
import { Tracer, MASK_PLAYERSOLID, type Trace, type Hole } from './trace.ts';
import { type V3, dot, angleVectors } from './math.ts';

export const HULL = { mins: [-16, -16, 0] as V3, maxs: [16, 16, 72] as V3, duckMaxs: [16, 16, 36] as V3, view: 64, duckView: 28 };
// maxspeed 150: measured (walk, back, strafe and diagonal all settle at 150.0 u/s; the port had 175).
// jump 160: the SDK's g_bMovementOptimizations value for HL2 ("approx. 21 units"); with the SDK's gravity order it
//   gives the measured 20.15 unit rise and 0.54 s airtime. jumpBoost: HL2's single-player forward boost on jump
//   (+50% of forwardmove, capped at 1.5x maxspeed, 10% when ducked); measured 225 u/s after a running jump.
// airCap 60: measured (air strafe settles at 60.0 u/s; the SDK's GetAirSpeedCap default is 30, Portal differs).
// duckTime 0.4 / unduckTime 0.2: the SDK's TIME_TO_DUCK / TIME_TO_UNDUCK with SimpleSpline, measured 0.36 s and
//   0.195 s to 90% of the eye drop and rise.
const CV = { gravity: 600, accelerate: 10, airaccelerate: 10, friction: 4, stopspeed: 100, maxspeed: 150, stepsize: 18, jump: 160, airCap: 60, duckSpeed: 0.33333, duckTime: 0.4, unduckTime: 0.2 };
const spline = (x: number) => x * x * (3 - 2 * x);
const duckEye = (f: number) => HULL.duckView * f + HULL.view * (1 - f);

export interface Input { fwd: number; side: number; jump: boolean; duck: boolean; }
export class Player {
  pos: V3 = [0, 0, 0]; vel: V3 = [0, 0, 0]; ang: V3 = [0, 0, 0]; onGround = false; ducked = false; groundEnt: any = null; viewOffset = HULL.view;
  noclip = false; baseVel: V3 = [0, 0, 0]; pushed = false; jumpHeld = false; ducking = false; duckHeld = false; duckTime = 0; tr: Tracer; holesFn: (() => Hole[] | null) | null = null; slipFn: ((t: Trace) => boolean) | null = null; landed = 0;
  // duckRaised: finishDuck in the air lifted the feet so the eye stayed put. Portal teleports duck the other way
  // (origin stays, eye drops to duckView) and must unduck that way too, or the feet would drop 36 on the way out.
  duckRaised = false;
  // portalDuck / portalUnduckIn: the original ducks the player through a portal (eye drops 36–41 units one to two
  // ticks after a wall-fling exit; checks/oracle fling-wall runs). Wall exits stay ducked until landing (no un-duck
  // in 0.75 s of flight). Floor/ceiling exits snap back up ~0.35 s later if there is room (eye_pop at 0.345–0.36 s).
  portalDuck = false; portalUnduckIn = 0;
  constructor(tr: Tracer) { this.tr = tr; }
  maxs(): V3 { return this.ducked ? HULL.duckMaxs : HULL.maxs; }
  /** the hull's sweep: portal holes are carved for it and for nothing after it (rays must still stop at a portal's wall) */
  trace(a: V3, b: V3, maxs = this.maxs()): Trace { const t = this.tr; t.ignore = null; t.holes = this.holesFn?.() ?? null; const r = t.trace(a, b, HULL.mins, maxs, MASK_PLAYERSOLID, this); t.holes = null; return r; }
  eye(): V3 { return [this.pos[0], this.pos[1], this.pos[2] + this.viewOffset]; }
  // Like gamemovement's CheckStuck: if we start inside something (e.g. a teleport destination exactly on the floor), nudge out.
  unstick() { if (!this.trace(this.pos, this.pos).startsolid) return;
    for (const dz of [0.125, 0.5, 1, 2, 4, 8, 12, 18]) for (const [dx, dy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [8, 0], [-8, 0], [0, 8], [0, -8]]) {
      const p: V3 = [this.pos[0] + dx, this.pos[1] + dy, this.pos[2] + dz]; if (!this.trace(p, p).startsolid) { this.pos = p; return; } } }
  move(inp: Input, dt: number) {
    if (this.noclip) { const { f, r } = angleVectors(this.ang); const s = 600 * dt; for (let i = 0; i < 3; i++) this.pos[i] += (f[i] * inp.fwd + r[i] * inp.side) * s; this.vel = [0, 0, 0]; return; }
    this.unstick();
    if (this.duckTime > 0) this.duckTime = Math.max(0, this.duckTime - dt * 1000);
    if (this.portalDuck && this.portalUnduckIn > 0) this.portalUnduckIn = Math.max(0, this.portalUnduckIn - dt);
    this.duck(inp.duck);
    this.categorize();
    const yaw = [0, this.ang[1], 0]; const { f, r } = angleVectors(yaw);
    // forwardmove/sidemove as the SDK has them after CheckParameters (clamped to maxspeed) and the duck speed crop
    // (only when ducked on the ground, HandleDuckingSpeedCrop)
    let fm = inp.fwd * 450, sm = inp.side * 450; const mag = Math.hypot(fm, sm);
    if (mag > CV.maxspeed) { fm *= CV.maxspeed / mag; sm *= CV.maxspeed / mag; }
    if (this.ducked && this.onGround) { fm *= CV.duckSpeed; sm *= CV.duckSpeed; }
    const wish: V3 = [f[0] * fm + r[0] * sm, f[1] * fm + r[1] * sm, 0];
    let ws = Math.hypot(wish[0], wish[1]); const wdir: V3 = ws > 0 ? [wish[0] / ws, wish[1] / ws, 0] : [0, 0, 0];
    ws = Math.min(ws, CV.maxspeed);
    // base velocity (trigger_push): when nothing pushed last tick, what's left of it becomes the player's own velocity
    // (CBasePlayer's "apply momentum", 1 + half a frame of it), else the vertical part is added as acceleration
    // (StartGravity) and the horizontal part rides along with the move and is taken back off after it (WalkMove/AirMove)
    if (!this.pushed && (this.baseVel[0] || this.baseVel[1] || this.baseVel[2])) { const k = 1 + dt * 0.5; for (let i = 0; i < 3; i++) this.vel[i] += this.baseVel[i] * k; this.baseVel = [0, 0, 0]; }
    const bv: V3 = [this.baseVel[0], this.baseVel[1], 0]; this.pushed = false;
    // half gravity before, half after (as in the SDK)
    if (!this.onGround) this.vel[2] -= CV.gravity * dt * 0.5;
    this.vel[2] += this.baseVel[2] * dt; this.baseVel = [bv[0], bv[1], 0];
    if (inp.jump && !this.jumpHeld && this.onGround && !(this.ducking && this.ducked)) {
      // CheckJumpButton: StartGravity has already taken half a tick of gravity (on the ground too), the jump adds
      // 160 (sets it when ducking), HL2's forward boost, then FinishGravity, and the air move below.
      const startz = this.vel[2] - CV.gravity * dt * 0.5;
      this.vel[2] = this.ducking || this.ducked ? CV.jump : startz + CV.jump;
      const perc = this.ducked ? 0.1 : 0.5, fl = Math.hypot(f[0], f[1]) || 1;
      let add = Math.abs(fm * perc); const max = CV.maxspeed * (1 + perc), ns = add + Math.hypot(this.vel[0], this.vel[1]);
      if (ns > max) add -= ns - max; if (fm < 0) add = -add;
      this.vel[0] += f[0] / fl * add; this.vel[1] += f[1] / fl * add;
      this.vel[2] -= CV.gravity * dt * 0.5;
      this.onGround = false; this.groundEnt = null;
    }
    this.jumpHeld = inp.jump;
    if (this.onGround) {
      this.vel[2] = 0; this.friction(dt); this.accel(wdir, ws, CV.accelerate, dt);
      if (Math.hypot(this.vel[0], this.vel[1]) < 1) { this.vel[0] = this.vel[1] = 0; }
      this.vel[0] += bv[0]; this.vel[1] += bv[1]; this.walkMove(dt); this.vel[0] -= bv[0]; this.vel[1] -= bv[1];
    } else {
      this.accel(wdir, Math.min(ws, CV.airCap), CV.airaccelerate, dt, ws);
      this.vel[0] += bv[0]; this.vel[1] += bv[1]; this.tryMove(dt); this.vel[0] -= bv[0]; this.vel[1] -= bv[1];
    }
    this.categorize();
    if (!this.onGround) this.vel[2] -= CV.gravity * dt * 0.5; else if (this.vel[2] < 0) this.vel[2] = 0;
  }
  // The SDK's Duck(): on the ground the eye eases down over TIME_TO_DUCK and the hull only shrinks (and the speed
  // crop only starts) when that is over; in the air it is instant and the feet come up instead, so the eye stays put.
  // Letting go eases back over TIME_TO_UNDUCK if there is room; releasing half way inverts the remaining time.
  /** After a portal teleport: shrink the hull from the top, even in the air, and remember when to try unduck.
   *  untilGround: wall exit (stay ducked until we land). Otherwise a floor/ceiling exit, unduck after 0.35 s. */
  forcePortalDuck(untilGround: boolean) {
    if (!this.ducked) { this.ducked = true; this.ducking = false; this.viewOffset = HULL.duckView; this.duckTime = 1000; this.duckRaised = false; }
    this.portalDuck = true; this.portalUnduckIn = untilGround ? -1 : 0.35;
  }
  private duck(want: boolean) {
    const inAir = !this.onGround, pressed = want && !this.duckHeld, released = !want && this.duckHeld; this.duckHeld = want;
    if (this.portalDuck) {
      const hold = (this.portalUnduckIn < 0 && inAir) || this.portalUnduckIn > 0;
      if (hold) { this.viewOffset = HULL.duckView; this.ducked = true; this.ducking = false; return; }
      // timer elapsed, or we just landed from a wall exit: try a normal unduck (origin unmoved if we didn't raise the feet)
      this.portalDuck = false;
    }
    if (!want && !this.ducking && !this.ducked) return;
    if (want) {
      if (pressed && !this.ducked) { this.duckTime = 1000; this.ducking = true; }
      if (this.ducking) { const s = (1000 - this.duckTime) / 1000;
        if (s > CV.duckTime || this.ducked || inAir) this.finishDuck(inAir); else this.viewOffset = duckEye(spline(s / CV.duckTime)); }
      return;
    }
    if (released) { if (this.ducked) this.duckTime = 1000; else if (this.ducking) this.duckTime = 1000 - CV.unduckTime * 1000 + ((1000 - this.duckTime) / (CV.duckTime * 1000)) * CV.unduckTime * 1000; }
    // after a mid-air duck the feet stay raised only while still airborne; once we've landed the origin is just a
    // ducked player on the floor, and standing up must grow the hull upward (the SDK keys this off ground entity)
    const p: V3 = [this.pos[0], this.pos[1], this.pos[2] - (this.duckRaised && inAir ? 36 : 0)];
    if (!this.trace(p, p, HULL.maxs).startsolid) {
      const s = (1000 - this.duckTime) / 1000;
      if (s > CV.unduckTime || inAir) this.finishUnduck(inAir); else { this.viewOffset = duckEye(spline(1 - s / CV.unduckTime)); this.ducking = true; }
    } else if (this.duckTime !== 1000) { this.viewOffset = HULL.duckView; this.duckTime = 1000; this.ducked = true; this.ducking = false; }
  }
  private finishDuck(inAir: boolean) {
    const was = this.ducked; this.ducked = true; this.ducking = false; this.viewOffset = HULL.duckView;
    if (inAir && !was) { this.pos[2] += 36; if (this.trace(this.pos, this.pos).startsolid) this.pos[2] -= 36; else this.duckRaised = true; }
  }
  private finishUnduck(inAir: boolean) {
    if (this.duckRaised && this.ducked && inAir) this.pos[2] -= 36;
    this.ducked = false; this.ducking = false; this.duckRaised = false; this.portalDuck = false; this.viewOffset = HULL.view;
  }
  private categorize() {
    if (this.vel[2] > 140) { this.onGround = false; this.groundEnt = null; return; }
    const down: V3 = [this.pos[0], this.pos[1], this.pos[2] - 2];
    const t = this.trace(this.pos, down);
    const was = this.onGround;
    this.onGround = t.fraction < 1 && t.normal[2] >= 0.7 && !t.allsolid && !this.slipFn?.(t); this.groundEnt = this.onGround ? t.ent : null;
    if (this.onGround && !t.startsolid) { this.pos = t.end; if (!was) { this.landed = performance.now(); this.duckRaised = false; } }
  }
  private friction(dt: number) {
    const spd = Math.hypot(this.vel[0], this.vel[1], this.vel[2]); if (spd < 0.1) return;
    const ctl = spd < CV.stopspeed ? CV.stopspeed : spd; const drop = ctl * CV.friction * dt;
    const ns = Math.max(0, spd - drop) / spd; this.vel = [this.vel[0] * ns, this.vel[1] * ns, this.vel[2] * ns];
  }
  private accel(dir: V3, ws: number, a: number, dt: number, fullWs = ws) {
    const cur = dot(this.vel, dir), add = ws - cur; if (add <= 0) return;
    const as = Math.min(add, a * fullWs * dt); for (let i = 0; i < 3; i++) this.vel[i] += as * dir[i];
  }
  private walkMove(dt: number) {
    const start: V3 = [...this.pos] as V3; const sv: V3 = [...this.vel] as V3;
    const dest: V3 = [this.pos[0] + this.vel[0] * dt, this.pos[1] + this.vel[1] * dt, this.pos[2]];
    const t = this.trace(this.pos, dest);
    if (t.fraction === 1) { this.pos = t.end; this.stayOnGround(); return; }
    // try plain slide, then step up/over/down; keep whichever went further horizontally
    this.tryMove(dt); const downPos: V3 = [...this.pos] as V3, downVel: V3 = [...this.vel] as V3;
    this.pos = start; this.vel = sv;
    const up = this.trace(this.pos, [this.pos[0], this.pos[1], this.pos[2] + CV.stepsize]); if (!up.startsolid) this.pos = up.end;
    this.tryMove(dt);
    const dn = this.trace(this.pos, [this.pos[0], this.pos[1], this.pos[2] - CV.stepsize - 1]);
    if (dn.normal[2] < 0.7 || dn.startsolid) { this.pos = downPos; this.vel = downVel; return; }
    if (dn.fraction < 1) this.pos = dn.end;
    const d1 = (downPos[0] - start[0]) ** 2 + (downPos[1] - start[1]) ** 2, d2 = (this.pos[0] - start[0]) ** 2 + (this.pos[1] - start[1]) ** 2;
    if (d1 > d2) { this.pos = downPos; this.vel = downVel; } else this.vel[2] = downVel[2];
  }
  private stayOnGround() {
    const a: V3 = [this.pos[0], this.pos[1], this.pos[2] + 2], b: V3 = [this.pos[0], this.pos[1], this.pos[2] - CV.stepsize];
    const t = this.trace(a, b); if (t.fraction > 0 && t.fraction < 1 && !t.startsolid && t.normal[2] >= 0.7) { if (Math.abs(this.pos[2] - t.end[2]) > 0.5) this.pos = t.end; }
  }
  tryMove(dt: number) {
    const planes: V3[] = []; let left = dt; const orig: V3 = [...this.vel] as V3;
    for (let bump = 0; bump < 4 && left > 0; bump++) {
      if (!this.vel[0] && !this.vel[1] && !this.vel[2]) break;
      const end: V3 = [this.pos[0] + this.vel[0] * left, this.pos[1] + this.vel[1] * left, this.pos[2] + this.vel[2] * left];
      const t = this.trace(this.pos, end);
      if (t.allsolid) { this.vel = [0, 0, 0]; return; }
      if (t.fraction > 0) { this.pos = t.end; planes.length = 0; }
      if (t.fraction === 1) break;
      left -= left * t.fraction; planes.push(t.normal);
      // clip velocity against all planes we're touching
      let ok = false;
      for (let i = 0; i < planes.length; i++) {
        const v = clip(this.vel, planes[i], planes[i][2] > 0.7 || !this.onGround ? 1 : 1);
        let good = true; for (let j = 0; j < planes.length; j++) if (j !== i && dot(v, planes[j]) < 0) { good = false; break; }
        if (good) { this.vel = v; ok = true; break; }
      }
      if (!ok) {
        if (planes.length !== 2) { this.vel = [0, 0, 0]; break; }
        const a = planes[0], b = planes[1]; const d: V3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const l = Math.hypot(d[0], d[1], d[2]) || 1; const s = dot(d, this.vel) / (l * l); this.vel = [d[0] * s, d[1] * s, d[2] * s];
      }
      if (dot(this.vel, orig) <= 0) { this.vel = [0, 0, 0]; break; }
    }
  }
}
export function clip(v: V3, n: V3, over: number): V3 {
  const b = dot(v, n) * over; const o: V3 = [v[0] - n[0] * b, v[1] - n[1] * b, v[2] - n[2] * b];
  for (let i = 0; i < 3; i++) if (o[i] > -0.1 && o[i] < 0.1) o[i] = 0; return o;
}
