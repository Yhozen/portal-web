// Source-style player movement: ground/air acceleration, friction, gravity, jump, duck, stair stepping and
// clip-plane sliding. Written from the public Source SDK 2013 gamemovement.cpp behaviour (MIT-licensed SDK)
// and its default cvars (sv_gravity 600, sv_accelerate 10, sv_airaccelerate 10, sv_friction 4, sv_stopspeed 100).
import { Tracer, MASK_PLAYERSOLID, type Trace } from './trace.ts';
import { type V3, dot, angleVectors } from './math.ts';

export const HULL = { mins: [-16, -16, 0] as V3, maxs: [16, 16, 72] as V3, duckMaxs: [16, 16, 36] as V3, view: 64, duckView: 28 };
const CV = { gravity: 600, accelerate: 10, airaccelerate: 10, friction: 4, stopspeed: 100, maxspeed: 175, stepsize: 18, jump: Math.sqrt(2 * 600 * 45), airCap: 30, duckSpeed: 0.333 };

export interface Input { fwd: number; side: number; jump: boolean; duck: boolean; }
export class Player {
  pos: V3 = [0, 0, 0]; vel: V3 = [0, 0, 0]; ang: V3 = [0, 0, 0]; onGround = false; ducked = false; groundEnt: any = null; viewOffset = HULL.view;
  noclip = false; jumpHeld = false; tr: Tracer; ignoreFn: (() => void) | null = null; landed = 0;
  constructor(tr: Tracer) { this.tr = tr; }
  maxs(): V3 { return this.ducked ? HULL.duckMaxs : HULL.maxs; }
  trace(a: V3, b: V3, maxs = this.maxs()): Trace { this.ignoreFn?.(); return this.tr.trace(a, b, HULL.mins, maxs, MASK_PLAYERSOLID, this); }
  eye(): V3 { return [this.pos[0], this.pos[1], this.pos[2] + this.viewOffset]; }
  move(inp: Input, dt: number) {
    if (this.noclip) { const { f, r } = angleVectors(this.ang); const s = 600 * dt; for (let i = 0; i < 3; i++) this.pos[i] += (f[i] * inp.fwd + r[i] * inp.side) * s; this.vel = [0, 0, 0]; return; }
    this.duck(inp.duck);
    this.categorize();
    const yaw = [0, this.ang[1], 0]; const { f, r } = angleVectors(yaw);
    const wish: V3 = [f[0] * inp.fwd + r[0] * inp.side, f[1] * inp.fwd + r[1] * inp.side, 0];
    let ws = Math.hypot(wish[0], wish[1]); const wdir: V3 = ws > 0 ? [wish[0] / ws, wish[1] / ws, 0] : [0, 0, 0];
    ws = Math.min(ws * CV.maxspeed, CV.maxspeed) * (this.ducked ? CV.duckSpeed : 1);
    // half gravity before, half after (as in the SDK)
    if (!this.onGround) this.vel[2] -= CV.gravity * dt * 0.5;
    if (inp.jump && !this.jumpHeld && this.onGround) { this.vel[2] = CV.jump * (this.ducked ? 1 : 1) * Math.sqrt(21 / 45); this.onGround = false; this.groundEnt = null; }
    this.jumpHeld = inp.jump;
    if (this.onGround) {
      this.vel[2] = 0; this.friction(dt); this.accel(wdir, ws, CV.accelerate, dt);
      const spd = Math.hypot(this.vel[0], this.vel[1]); if (spd > CV.maxspeed * 1.0001 * (this.ducked ? CV.duckSpeed : 1) && ws > 0) { /* allow momentum to bleed by friction only */ }
      if (Math.hypot(this.vel[0], this.vel[1]) < 1) { this.vel[0] = this.vel[1] = 0; }
      this.walkMove(dt);
    } else {
      this.accel(wdir, Math.min(ws, CV.airCap), CV.airaccelerate, dt, ws);
      this.tryMove(dt);
    }
    this.categorize();
    if (!this.onGround) this.vel[2] -= CV.gravity * dt * 0.5; else if (this.vel[2] < 0) this.vel[2] = 0;
    const target = this.ducked ? HULL.duckView : HULL.view; this.viewOffset += (target - this.viewOffset) * Math.min(1, dt * 12);
  }
  private duck(want: boolean) {
    if (want && !this.ducked) { this.ducked = true; if (!this.onGround) { this.pos[2] += 36; const t = this.trace(this.pos, this.pos); if (t.startsolid) this.pos[2] -= 36; } }
    else if (!want && this.ducked) {
      const p: V3 = [this.pos[0], this.pos[1], this.pos[2] - (this.onGround ? 0 : 36)];
      const t = this.trace(p, p, HULL.maxs); if (!t.startsolid) { this.ducked = false; this.pos = p; }
    }
  }
  private categorize() {
    if (this.vel[2] > 140) { this.onGround = false; this.groundEnt = null; return; }
    const down: V3 = [this.pos[0], this.pos[1], this.pos[2] - 2];
    const t = this.trace(this.pos, down);
    const was = this.onGround;
    this.onGround = t.fraction < 1 && t.normal[2] >= 0.7 && !t.allsolid; this.groundEnt = this.onGround ? t.ent : null;
    if (this.onGround && !t.startsolid) { this.pos = t.end; if (!was) this.landed = performance.now(); }
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
