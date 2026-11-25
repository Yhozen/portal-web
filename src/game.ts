import type { Sound } from './audio';
import { Body, stepBody, halfExtent } from './rigid';
import { phyPieces, massProps, hullPlanes } from './phy.ts';
import { findSeq, skinModel, type GLModel } from './models.ts';
import { F, boneMatrices, type Seq, type SeqEvent } from './anim.ts';
import { aimTable, aimFor, approach, attachFrame, turretFace, aimAttachment, TURRET, ROCKET_TURRET, PLAYER_HP, type TurretState } from './npc.ts';
import { BSP, SURF, CONTENTS } from './bsp.ts';
import { Ent, IO } from './ents.ts';
import { Tracer, MASK_SHOT_PORTAL, MASK_BLOCKLOS, type Collider } from './trace.ts';
import { Player, HULL } from './player.ts';
import { Renderer, throughPortal, type Portal, type Instance, type PropInst } from './render.ts';
import type { ModelCache } from './models.ts';
import { mul, invertRigid } from './math.ts';
import { type V3, angleVectors, dot, cross, norm, sub, add, scale, ma, entityMatrix, xformPoint, xformDir, vectorAngles, parseV3, m4, len } from './math.ts';

const BLUE: V3 = [0.25, 0.6, 1.0], ORANGE: V3 = [1.0, 0.55, 0.1];
const PW = 32, PH = 54; // Portal 1 portal half-extents

interface Cube extends Body { /** .phy mass (kg), when read: turrets */ mass?: number; /** model origin relative to the body centre, in body axes (turrets stand on their origin) */ off?: V3; turret?: Turret; ent: Ent; held: boolean; Rrel?: Float32Array; prop: PropInst; ext: number; onGround: boolean; spawn: V3; alive: boolean; tunnel: Set<number> | null; viaPortal?: Portal | null; /** set in teleportPlayer so updateCube does not straight-line re-teleport the same tick */ justPortaled?: boolean; }

interface Turret { state: TurretState; next: number; shot: number; lastSight: number; thrash: number; eyes: number; shots: number; seen: boolean; }

/** does the segment a-b pass through the box lo-hi (slab test) */
function segHitsBox(a: V3, b: V3, lo: V3, hi: V3): boolean {
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) { const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) { if (a[k] < lo[k] || a[k] > hi[k]) return false; continue; }
    let u = (lo[k] - a[k]) / d, v = (hi[k] - a[k]) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
  return true;
}
export class Game {
  /** player health (the original's: 100, see PLAYER_HP) and death; onDeath is the page's (reload, like loading the autosave) */
  health = 100; dmgAcc = 0; lastHurt = -9; dead = false; god = false; onDeath: (() => void) | null = null;
  /** turret bullets hurt only with ?damage=1 for now: a11's route walks through the turret room's sight lines for
   *  seconds (and its north corridor is covered by two turrets end to end), so its playthrough needs reworking first */
  damage = false;
  bsp: BSP; io = new IO(); tr: Tracer; r: Renderer; models: ModelCache; player: Player; playerEnt: Ent;
  portals: Portal[] = []; gunPortals: [Portal, Portal]; cubes: Cube[] = []; hasGun = true; canFire: [boolean, boolean] = [true, true]; guns: Ent[] = []; held: Cube | null = null;
  portalBrushes = new Map<Portal, Set<number>>(); hud = { hint: "", hintT: 0, fade: 0, fadeTarget: 0, fadeRate: 0, fadeHoldUntil: 0 }; changeLevel: ((map: string, lm: string) => void) | null = null;
  sounds: ((path: string, pos?: V3) => void) | null = null; snd: Sound | null = null; captions: { text: string; until: number }[] = []; stats = { teleports: 0, portalsPlaced: 0, solidProps: 0 }; noportalVolumes: Ent[] = []; bumpers: Ent[] = []; portalDetectors: Ent[] = []; cameras: Ent[] = []; rocketTurrets: Ent[] = []; rockets: { ent: Ent; pos: V3; vel: V3; r: number; die: number; prop: PropInst; dead?: boolean }[] = [];
  constructor(bsp: BSP, r: Renderer, models: ModelCache) {
    this.bsp = bsp; this.r = r; this.models = models; this.tr = new Tracer(bsp); this.player = new Player(this.tr);
    this.playerEnt = new Ent({ classname: 'player', targetname: '!player' }); this.io.player = this.playerEnt; this.playerEnt.game = this;
    const mk = (color: V3, name: string): Portal => ({ pos: [0, 0, 0], f: [1, 0, 0], r: [0, 1, 0], u: [0, 0, 1], color, open: false, linked: null, name });
    this.gunPortals = [mk(BLUE, 'gun_blue'), mk(ORANGE, 'gun_orange')];
    this.gunPortals[0].linked = this.gunPortals[1]; this.gunPortals[1].linked = this.gunPortals[0];
    this.portals.push(...this.gunPortals); r.portals = this.portals;
    this.player.ignoreFn = () => { this.tr.ignore = this.tunnelFor(this.player.pos, HULL.mins, this.player.maxs()); };
    this.setupHandlers();
    r.instances.push({ model: 0, matrix: m4(), visible: true });
    for (const kv of bsp.entities) this.spawn(kv);
    for (const p of bsp.staticProps) { const pi = this.addProp(p.model, p.origin as V3, p.angles as V3, p.skin); if (p.solid) this.solidProp(pi, null, p.model); }
    // func_tracktrain snaps to its first path_track at spawn
    for (const e of this.io.ents) if (e.cls === 'func_tracktrain') { const p0 = this.io.find(e.pathName, null, e)[0];
      if (p0) { const np = add(p0.origin, [0, 0, +(e.kv.height || 0)]); e.pos[0] = np[0]; e.pos[1] = np[1]; e.pos[2] = np[2]; e.curPath = p0; e.pathName = (p0.kv.target || '').toLowerCase(); if (e.inst) e.inst.matrix = entityMatrix(e.pos, e.angles); }
      if (e.platform) { e.platform.mins = add(e.pos, e.platMins); e.platform.maxs = add(e.pos, e.platMaxs); } }
    for (const t of this.io.ents) if (t.cls === 'point_template' && !(+t.kv.spawnflags & 1))
      for (const [k, v] of Object.entries(t.kv)) if (/^template\d\d$/.test(k)) for (const e of this.io.byName.get(v.toLowerCase()) || []) { e.killed = true; e.onKill?.(); }
    this.relinkMapPortals();
  }
  // ---------- spawning ----------
  addProp(model: string, origin: V3, angles: V3, skin = 0): PropInst {
    const pi: PropInst = { model: null, matrix: entityMatrix(origin, angles), visible: true, skin, ambient: this.ambientAt(origin) };
    this.models.get(model).then(m => pi.model = m); this.r.props.push(pi); return pi;
  }
  /** cached .phy convexes for large static / physics props, planes in model space (shared across instances) */
  phyCache = new Map<string, Promise<{ pieces: { verts: V3[]; planes: { n: V3; d: number }[] }[] } | null>>();
  phyPiecesFor(model: string): Promise<{ pieces: { verts: V3[]; planes: { n: V3; d: number }[] }[] } | null> {
    let p = this.phyCache.get(model);
    if (!p) {
      p = this.models.assets.read(model.replace(/\.mdl$/i, '.phy')).then(phy => {
        if (!phy) return null;
        const pc = phyPieces(new Uint8Array(phy)); if (!pc || !pc.convexes.length) return null;
        const box = (c: V3[]) => [[0, 1, 2].map(k => Math.min(...c.map(v => v[k]))), [0, 1, 2].map(k => Math.max(...c.map(v => v[k])))] as [V3, V3];
        let pieces = pc.convexes as V3[][];
        const all = box(pieces.flat()), last = box(pieces[pieces.length - 1]);
        // the last piece of a multi-piece solid spanning the whole model is the hull the ledge tree is built on, not a piece
        if (pieces.length > 1 && [0, 1, 2].every(k => Math.abs(last[0][k] - all[0][k]) < 0.1 && Math.abs(last[1][k] - all[1][k]) < 0.1)) pieces = pieces.slice(0, -1);
        return { pieces: pieces.map(verts => ({ verts, planes: hullPlanes(verts) })) };
      }).catch(() => null);
      this.phyCache.set(model, p);
    }
    return p;
  }
  /** give a non-animated prop a collider: an AABB from the MDL hull for small props, or the .phy's convex
   *  pieces for large ones (the MDL hull is a solid box; tubes and similar are hollow vphysics shapes) */
  solidProp(pi: PropInst, ent: any, model?: string) {
    const check = () => { const m = pi.model; if (!m) return false; const d = m.data; let lo = d.hullMins, hi = d.hullMaxs;
      if (!(hi[0] > lo[0])) { lo = d.mins; hi = d.maxs; }
      if (Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) > 100 || Math.min(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) < 2) {
        // scoped to the hollow cube-tubes for now: other large props (fences, fuse sets) were previously
        // skipped, and giving them collision mid-route would pin existing playthroughs
        if (model && /clear_tube/i.test(model)) this.phyPiecesFor(model).then(pc => {
          if (!pc) return;
          const M = pi.matrix;
          const xf = (v: number[]): V3 => [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]];
          const rot = (n: number[]): V3 => { const v: V3 = [M[0] * n[0] + M[4] * n[1] + M[8] * n[2], M[1] * n[0] + M[5] * n[1] + M[9] * n[2], M[2] * n[0] + M[6] * n[1] + M[10] * n[2]]; const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
          for (const piece of pc.pieces) {
            const vs = piece.verts.map(xf), mn: V3 = [1e9, 1e9, 1e9], mx: V3 = [-1e9, -1e9, -1e9];
            for (const v of vs) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }
            const planes = piece.planes.map(q => { const n = rot(q.n), p0 = xf([q.n[0] * q.d, q.n[1] * q.d, q.n[2] * q.d]); return { n, d: n[0] * p0[0] + n[1] * p0[1] + n[2] * p0[2] }; });
            for (let k = 0; k < 3; k++) { const a: V3 = [0, 0, 0], c: V3 = [0, 0, 0]; a[k] = 1; c[k] = -1; planes.push({ n: a, d: mx[k] }, { n: c, d: -mn[k] }); }
            this.tr.hulls.push({ planes, mins: mn, maxs: mx, ent, on: true });
          }
          this.stats.solidProps = (this.stats.solidProps || 0) + 1;
        });
        return true;
      }
      const M = pi.matrix, mn: V3 = [1e9, 1e9, 1e9], mx: V3 = [-1e9, -1e9, -1e9];
      for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) for (let k = 0; k < 3; k++) { const v = M[k] * x + M[4 + k] * y + M[8 + k] * z + M[12 + k]; mn[k] = Math.min(mn[k], v); mx[k] = Math.max(mx[k], v); }
      this.tr.extraBoxes.push({ mins: mn, maxs: mx, ent }); this.stats.solidProps = (this.stats.solidProps || 0) + 1; return true; };
    const poll = () => { if (!check()) setTimeout(poll, 100); }; poll();
  }
  ambientAt(p: V3): [number, number, number] {
    // cheap stand-in for the ambient cube: sample the lightmap brightness of the floor below
    void p; return [0.85, 0.85, 0.88];
  }
  brushModel(e: Ent) { const m = /^\*(\d+)$/.exec(e.kv.model || ''); return m ? +m[1] : -1; }
  spawn(kv: Record<string, string>) {
    const e = new Ent(kv); this.io.add(e); e.game = this; const c = e.cls, bm = this.brushModel(e);
    e.pos = [...e.origin] as V3; e.spawnPos = [...e.origin] as V3; e.spawnM = entityMatrix(e.origin, e.angles);
    if (c === 'worldspawn') return;
    if (bm > 0) {
      const M = this.bsp.models[bm]; e.bmins = add(M.mins as V3, e.origin); e.bmaxs = add(M.maxs as V3, e.origin); e.model = bm;
      const visual = /^(func_door|func_brush|func_movelinear|func_tracktrain|func_wall|func_wall_toggle|func_button|func_rotating|func_door_rotating|func_illusionary|func_breakable|func_physbox|func_lod|func_train|func_reflective_glass|func_detail)/.test(c);
      if (visual) {
        const inst: Instance = { model: bm, matrix: entityMatrix(e.origin, e.angles), visible: c !== 'func_brush' || e.enabled || kv.startdisabled !== '1', alpha: kv.rendermode && kv.rendermode !== '0' ? +(kv.renderamt ?? 255) / 255 : 1 };
        if (kv.rendermode === '10') inst.visible = false;
        e.inst = inst; this.r.instances.push(inst);
        const passableTrain = c === 'func_tracktrain' && (+kv.spawnflags & 8);
        // only the elevator bodies (192x192x148 or 192x16x148 brushes carrying round_elevator_body) stand in for a prop's
        // floor; the other passable trains (catcher doors 8x16x13, escape_01's box carriers, escape_02's core rails) are
        // just non-solid, and a floor disc there blocked the catcher mouth for energy balls
        if (passableTrain && M.maxs[2] - M.mins[2] >= 128) { // the visible/solid elevator is a prop with vphysics collision; give the rider a floor disc instead
          e.platform = { mins: [0, 0, 0] as V3, maxs: [0, 0, 0] as V3, ent: e }; this.tr.extraBoxes.push(e.platform); e.platMins = [-80, -80, M.mins[2]]; e.platMaxs = [80, 80, M.mins[2] + 4]; }
        // func_rotating spawnflag 64 is "Not Solid" (the blades; the housing is world). escape_01's
        // rotating_fan_07 is 577 (start on + not solid + loud) — a solid collider here ate portal
        // shots at the wall under the fan and left the player hanging in the fan volume.
        const solid = !passableTrain && !(c === 'func_illusionary' || (c === 'func_brush' && kv.solidity === '1') || (c === 'func_rotating' && (+kv.spawnflags & 64)));
        if (solid) { const col: Collider = { bsp: this.bsp, headnode: M.headnode, offset: e.pos, ent: e, enabled: () => {
          if (e.killed || (c === 'func_brush' && !e.enabled)) return false;
          // a just-enabled brush that appeared around the player stays non-solid for them until they leave, so a
          // "close behind you" wall (escape_01's block_crazy_player_escaping_trap at the ambush catwalk lip) doesn't
          // pin you in the doorway: the original walks through that lip at 150 u/s (oracle trace e01-walk-lip)
          if (e.passPlayer) { if (this.playerOverlaps(e)) return false; e.passPlayer = false; }
          return true; } }; e.col = col; this.tr.colliders.push(col); }
        if (c === 'func_brush' && kv.startdisabled === '1') { e.enabled = false; inst.visible = false; }
      }
    }
    if (c === 'func_door') {
      const dir = angleVectors(parseV3(kv.movedir)).f; const M = this.bsp.models[bm];
      const size = Math.abs(dir[0]) * (M.maxs[0] - M.mins[0]) + Math.abs(dir[1]) * (M.maxs[1] - M.mins[1]) + Math.abs(dir[2]) * (M.maxs[2] - M.mins[2]);
      e.closedPos = [...e.origin]; e.openPos = ma(e.origin, size - +(kv.lip || 0), dir); e.speed = +(kv.speed || 100); e.state = 0; e.t = 0; // t: 0 closed .. 1 open
      if ((+kv.spawnflags & 1) || kv.spawnpos === '1') { e.t = 1; e.state = 1; for (let k = 0; k < 3; k++) e.pos[k] = e.openPos[k]; }
    }
    if (c === 'info_overlay_accessor') { e.ovl = {}; this.r.overlayState.set(+(kv.overlayid || -1), e.ovl); }
    if (c === 'func_rotating') { e.ang = [...e.angles] as V3; e.maxspeed = +(kv.maxspeed || 100); e.spinning = !!(+kv.spawnflags & 1); e.spinDir = (+kv.spawnflags & 2) ? -1 : 1;
      e.axis = (+kv.spawnflags & 4) ? 2 : (+kv.spawnflags & 8) ? 0 : 1; e.spinSpeed = e.spinning ? e.maxspeed : 0; }
    if (c === 'func_door_rotating' || c === 'prop_door_rotating') { e.ang = [...e.angles] as V3; e.closedAng = [...e.angles] as V3; const dist = +(kv.distance || 90) * ((+kv.spawnflags & 2) ? -1 : 1);
      const ax = (+kv.spawnflags & 64) ? 2 : (+kv.spawnflags & 128) ? 0 : 1; e.openAng = [...e.angles] as V3; e.openAng[ax] += dist; e.rotAx = ax; e.rotDist = dist; e.speed = +(kv.speed || 100); e.t = 0; e.state = 0;
      if (+kv.spawnflags & 1) { e.t = 1; e.state = 1; } }
    if (c === 'func_tracktrain') { e.speedNow = 0; e.startspeed = +(kv.startspeed || 100); e.pathName = (kv.target || '').toLowerCase(); }
    if (c === 'prop_portal') {
      const { f, r, u } = angleVectors(e.angles);
      const p: Portal = { pos: e.origin, f, r, u, color: kv.portaltwo === '1' ? ORANGE : BLUE, open: false, linked: null, name: e.name }; e.portal = p; this.portals.push(p);
      if (kv.activated === '1') this.activatePortal(e, true);
    }
    if (c === 'npc_portal_turret_floor') this.spawnTurret(e);
    if (c === 'npc_security_camera') { kv.model ||= 'models/props/security_camera.mdl'; e.prop = this.addProp(kv.model, e.origin, e.angles, +(kv.skin || 0)); this.playAnim(e, 'idle', true); e.prop.poses = [0, 0]; this.cameras.push(e); }
    if (c === 'npc_rocket_turret') this.spawnRocketTurret(e);
    if (c === 'weapon_portalgun' && !/spawn/.test(e.name)) { e.prop = this.addProp('models/weapons/w_portalgun.mdl', e.origin, e.angles); e.onKill = () => { if (e.prop) e.prop.visible = false; }; }
    if (c === 'func_portal_bumper') this.bumpers.push(e);
    if (c === 'func_portal_detector') { e.inside = [false, false]; e.both = false; this.portalDetectors.push(e); }
    if (c === 'func_noportal_volume') { if (kv.startdisabled !== '1') e.enabled = true; this.noportalVolumes.push(e); }
    if (/^prop_(dynamic|physics|physics_override|physics_multiplayer|weighted_cube|dynamic_override|glados_core)$/.test(c) && kv.model) {
      if (/metal_box\.mdl$/i.test(kv.model) || c === 'prop_weighted_cube' || c === 'prop_glados_core') this.spawnCube(e);
      else { e.prop = this.addProp(kv.model, e.origin, e.angles, +(kv.skin || 0)); if (kv.startdisabled === '1' || kv.rendermode === '10') e.prop.visible = false; if (kv.defaultanim) this.playAnim(e, kv.defaultanim, true); else if (!/^prop_physics/.test(c)) { e.prop.seq = 0; e.prop.rate = 0; e.prop.restPose = true; } /* models are drawn in their sequence-0 pose, not the bind pose (the door halves' bind pose is rotated) */ if (/^prop_physics/.test(c) && kv.solid !== '0') this.solidProp(e.prop, e, kv.model); if (/^prop_dynamic/.test(c) && kv.solid !== '0') this.followerProps.push(e); }
    }
    if (c === 'logic_auto' && !kv.globalstate) { this.io.fire(e, 'onmapspawn', null); this.io.fire(e, 'onnewgame', null); }
    if (c === 'logic_timer') { e.next = +(kv.refiretime || 1); if (kv.startdisabled === '1') e.enabled = false; }
    if (c === 'math_counter') { e.value = +(kv.startvalue || 0); e.min = +(kv.min || 0); e.max = +(kv.max || 0); }
    if (/^trigger_/.test(c)) { e.touching = new Set(); if (kv.startdisabled === '1') e.enabled = false; }
  }
  cubeHull = new Map<string, number>();
  spawnCube(e: Ent) {
    const prop = this.addProp(e.kv.model || 'models/props/metal_box.mdl', e.origin, e.angles, +(e.kv.skin || 0));
    const mdl = (e.kv.model || 'models/props/metal_box.mdl').toLowerCase(), h0 = this.cubeHull.get(mdl) ?? 12;
    const cube: Cube = { ent: e, pos: [...e.origin] as V3, vel: [0, 0, 0], held: false, prop, ext: h0, onGround: false, spawn: [...e.origin] as V3, alive: true, tunnel: null, R: entityMatrix([0, 0, 0], e.angles), w: [0, 0, 0], h: h0, sleep: 0, asleep: false };
    e.cube = cube; this.cubes.push(cube);
    this.tr.extraBoxes.push({ mins: [0, 0, 0], maxs: [0, 0, 0], ent: e }); e.box = this.tr.extraBoxes[this.tr.extraBoxes.length - 1];
    e.onKill = () => { cube.alive = false; prop.visible = false; if (this.held === cube) this.held = null; e.box.mins = [1e9, 1e9, 1e9]; e.box.maxs = [1e9, 1e9, 1e9]; };
    // spawnflag 8 is Motion Disabled (SDK 2013 props.cpp); later cores hang until EnableMotion
    if (+(e.kv.spawnflags || 0) & 8) cube.asleep = true;
    this.updateCubeBox(cube); if (e.killed) e.onKill();
    // Collision size from the model's hull (metal_box.mdl: ±20.25). It was a fixed ±12, so cubes sat 8 units into the floor;
    // the original rests a11's boxes at z 20.4 on a z-0 floor and stacks them.
    // (kept per model too, so template copies made mid-tick get it at once)
    if (!this.cubeHull.has(mdl)) this.models.get(mdl).then(m => { const d = m?.data; if (!d || !d.hullMaxs || d.hullMaxs[0] <= d.hullMins[0]) return;
      const h = Math.min(...[0, 1, 2].map(k => (d.hullMaxs[k] - d.hullMins[k]) / 2)); if (h > 4 && h < 64) { this.cubeHull.set(mdl, h); for (const c of this.cubes) if (!c.turret && (c.ent.kv.model || 'models/props/metal_box.mdl').toLowerCase() === mdl) { c.h = c.ext = h; if (c.alive) this.updateCubeBox(c); } } });
  }
  massCache = new Map<string, { com: V3; meanI: number }>();
  /** floor turret: a physics box sized from the model's hull, standing on its origin; behaviour in updateTurret */
  spawnTurret(e: Ent) {
    const kv = e.kv; kv.model ||= 'models/props/turret_01.mdl';
    const prop = e.prop = this.addProp(kv.model, e.origin, e.angles, +(kv.skin || 0)); this.playAnim(e, 'idle', true); prop.poses = [0, 0];
    Promise.all([this.models.get(kv.model), this.models.assets.read(kv.model.replace(/\.mdl$/i, '.phy')).catch(() => null)]).then(([m, phy]) => { if (!m) return; const d = m.data;
      // the body: the .phy's convex pieces when there is one (turret_01: three thin legs and a 20-unit-wide shell, 100 kg),
      // so it stands on its tripod and goes over sideways as easily as the original; else the model's hull box
      const pc = phy ? phyPieces(new Uint8Array(phy)) : null; let lo: V3 = [...d.hullMins] as V3, hi: V3 = [...d.hullMaxs] as V3, pts: V3[] | undefined, com: V3 | undefined, invI: number | undefined;
      if (pc && pc.convexes.length) { const box = (c: V3[]) => [[0, 1, 2].map(k => Math.min(...c.map(v => v[k]))), [0, 1, 2].map(k => Math.max(...c.map(v => v[k])))] as [V3, V3];
        let pieces = pc.convexes as V3[][]; const all = box(pieces.flat()), last = box(pieces[pieces.length - 1]);
        // the last piece of a multi-piece solid spanning the whole model is the hull the ledge tree is built on, not a piece
        // (the other seven of turret_01 add up to the text section's volume, 8655)
        if (pieces.length > 1 && [0, 1, 2].every(k => Math.abs(last[0][k] - all[0][k]) < 0.1 && Math.abs(last[1][k] - all[1][k]) < 0.1)) pieces = pieces.slice(0, -1);
        [lo, hi] = box(pieces.flat()); const ctr = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2) as V3, seen = new Set<string>(); pts = [];
        // centre of mass and inertia of the pieces (turret_01: centre at 4.5, 0, 35.8, as the .phy's own header has it)
        let mp = this.massCache.get(kv.model); if (!mp) this.massCache.set(kv.model, mp = massProps(pieces)); com = sub(mp.com, ctr); invI = 1 / mp.meanI;
        // contact points: a small piece's box corners; a big one (the shell) its extreme points along 14 directions
        const dirs: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) dirs.push([x, y, z]);
        for (const c of pieces) { const [a, b] = box(c), cand: V3[] = c.length <= 16 ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]] as V3) : dirs.map(dd => c.reduce((m, v) => dot(v, dd) > dot(m, dd) ? v : m));
          for (const p of cand) { const q = sub(p, ctr), key = q.map(v => v.toFixed(1)).join(); if (!seen.has(key)) { seen.add(key); pts.push(q); } } } }
      const he = [0, 1, 2].map(k => (hi[k] - lo[k]) / 2) as V3, off = [0, 1, 2].map(k => (hi[k] + lo[k]) / 2) as V3;
      const R = entityMatrix([0, 0, 0], e.angles), pos = add(e.origin, xformDir(R, off)), ext = Math.min(...he);
      const cube: Cube = { ent: e, pos, vel: [0, 0, 0], held: false, prop, ext, h: ext, he, off, pts, com, invI, mass: pc?.mass || undefined, onGround: false, spawn: [...pos] as V3, alive: true, tunnel: null, R, w: [0, 0, 0], sleep: 0, asleep: true,
        turret: { state: 'idle', next: 0, shot: 0, lastSight: 0, thrash: 0, eyes: d.attachments.findIndex(a => a.name.toLowerCase() === 'eyes'), shots: 0, seen: false } };
      e.cube = cube; this.cubes.push(cube); this.tr.extraBoxes.push({ mins: [0, 0, 0], maxs: [0, 0, 0], ent: e }); e.box = this.tr.extraBoxes[this.tr.extraBoxes.length - 1];
      e.onKill = () => { cube.alive = false; prop.visible = false; if (this.held === cube) this.held = null; e.box.mins = [1e9, 1e9, 1e9]; e.box.maxs = [1e9, 1e9, 1e9]; };
      this.updateCubeBox(cube); if (e.killed) e.onKill(); });
  }
  /** EnableMotion on a prop_physics that spawned with motion disabled (spawnflag 8, SDK 2013 props.cpp): until then it is a
   *  static solid box; from then on it is a physics body like a cube, sized from its model's hull (a15's box-dropper lid chunks) */
  wakeStaticProp(e: Ent) {
    if (e.cube || !e.prop?.model) return; const d = e.prop.model.data; let lo = d.hullMins, hi = d.hullMaxs; if (!(hi[0] > lo[0])) { lo = d.mins; hi = d.maxs; }
    const he = [0, 1, 2].map(k => Math.max(1, (hi[k] - lo[k]) / 2)) as V3, off = [0, 1, 2].map(k => (hi[k] + lo[k]) / 2) as V3;
    this.tr.extraBoxes = this.tr.extraBoxes.filter(b => b.ent !== e);
    const R = entityMatrix([0, 0, 0], e.angles), pos = add(e.origin, xformDir(R, off)), ext = Math.min(...he);
    const cube: Cube = { ent: e, pos, vel: [0, 0, 0], held: false, prop: e.prop, ext, h: ext, he, off, onGround: false, spawn: [...pos] as V3, alive: true, tunnel: null, R, w: [0, 0, 0], sleep: 0, asleep: false };
    e.cube = cube; this.cubes.push(cube); this.tr.extraBoxes.push({ mins: [0, 0, 0], maxs: [0, 0, 0], ent: e }); e.box = this.tr.extraBoxes[this.tr.extraBoxes.length - 1];
    const prop = e.prop; e.onKill = () => { cube.alive = false; prop.visible = false; if (this.held === cube) this.held = null; e.box.mins = [1e9, 1e9, 1e9]; e.box.maxs = [1e9, 1e9, 1e9]; };
    this.updateCubeBox(cube);
  }
  /** func_portal_detector (Valve Developer Wiki): fires as the player's portals (linkage group 0) enter and leave its volume.
   *  Touching is tested as the portal's 64x112 rectangle overlapping the brush bounds (a guess at the game's touch test).
   *  a15's exit uses OnStartTouchBothLinkedPortals / OnStartTouchLinkedPortal to drop or restore a player-only wall. */
  updatePortalDetectors() {
    const io = this.io;
    for (const e of this.portalDetectors) {
      if (e.killed || e.enabled === false || !e.bmins || (+(e.kv.linkagegroupid || 0) !== 0 && e.kv.checkallids !== '1')) continue;
      const lo = e.bmins, hi = e.bmaxs, open = this.gunPortals.map(p => p.open), linked = open[0] && open[1];
      for (let k = 0; k < 2; k++) {
        const P = this.gunPortals[k], ext = [0, 1, 2].map(i => Math.abs(P.r[i]) * 32 + Math.abs(P.u[i]) * 56);
        const inn = open[k] && [0, 1, 2].every(i => P.pos[i] + ext[i] >= lo[i] && P.pos[i] - ext[i] <= hi[i]);
        if (inn && !e.inside[k]) { io.fire(e, 'onstarttouchportal' + (k + 1), null); io.fire(e, 'onstarttouchportal', null); if (linked) io.fire(e, 'onstarttouchlinkedportal', null); }
        if (!inn && e.inside[k]) { io.fire(e, 'onendtouchportal' + (k + 1), null); io.fire(e, 'onendtouchportal', null); if (linked) io.fire(e, 'onendtouchlinkedportal', null); }
        e.inside[k] = inn; }
      const both = linked && e.inside[0] && e.inside[1];
      if (both && !e.both) io.fire(e, 'onstarttouchbothlinkedportals', null); else if (!both && e.both) io.fire(e, 'onendtouchbothlinkedportals', null);
      e.both = both; }
  }
  /** whether turret c sees a point (the player's centre): in its 0.4-dot cone on the ground plane, in range, and a clear
   *  line from its eyes (also used by the autopilot to keep out of sight) */
  turretSees(c: Cube, target: V3, eye?: V3): boolean {
    const T = c.turret, pr = c.prop, m = pr?.model; if (!T || !m || T.eyes < 0) return false;
    eye ??= xformPoint(pr.matrix, attachFrame(m, T.eyes, pr.poses ??= [0, 0]).pos);
    const to = sub(target, eye), dist = len(to), R = c.R; if (dist >= TURRET.range) return false;
    const fl = Math.hypot(R[0], R[1]) || 1, d2 = Math.hypot(to[0], to[1]) || 1;
    if ((R[0] * to[0] + R[1] * to[1]) / (fl * d2) <= TURRET.cone) return false;
    const ig = this.tr.ignore; this.tr.ignore = null; const f = this.tr.trace(eye, target, [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, c.ent).fraction; this.tr.ignore = ig;
    return f > 0.98;
  }
  /** One turret volley (one per 0.1 s think, as in the original). Bullets go at the player's centre when it's in sight,
   *  along the muzzle otherwise: the first straight, the rest spread uniformly over a cone. One that reaches the player's
   *  box before the world hits it. */
  turretBullets(c: Cube, eye: V3, muzzle: V3, aimAtPlayer: boolean) {
    const pl = this.player, mn: V3 = add(pl.pos, HULL.mins), mx: V3 = add(pl.pos, pl.maxs()), ctr: V3 = [pl.pos[0], pl.pos[1], pl.pos[2] + pl.maxs()[2] / 2];
    const base = aimAtPlayer ? norm(sub(ctr, eye)) : muzzle; const up: V3 = Math.abs(base[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const r = norm(cross(base, up)), u = cross(r, base);
    for (let k = 0; k < TURRET.bullets; k++) {
      const a = Math.random() * 2 * Math.PI, d = k === 0 ? 0 : TURRET.spread * Math.sqrt(Math.random());
      const dir = norm(add(base, add(scale(r, Math.cos(a) * d), scale(u, Math.sin(a) * d))));
      let t0 = 0, t1 = TURRET.range; for (let i = 0; i < 3 && t0 <= t1; i++) { if (Math.abs(dir[i]) < 1e-9) { if (eye[i] < mn[i] || eye[i] > mx[i]) t0 = 1e9; continue; }
        const ta = (mn[i] - eye[i]) / dir[i], tb = (mx[i] - eye[i]) / dir[i]; t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb)); }
      if (t0 > t1) continue;
      this.tr.ignore = null; const w = this.tr.trace(eye, ma(eye, t0, dir), [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, new Set<any>([this.playerEnt, c.ent]));
      if (w.fraction < 1) continue;
      this.hurtPlayer(TURRET.damage, dir);
    }
  }
  /** damage with the fraction carried over (health is whole numbers in the original), a push along `dir`, and death at 0 */
  playerOverlaps(e: Ent) {
    if (!e.bmins) return false;
    const lo = add(this.player.pos, HULL.mins), hi = add(this.player.pos, this.player.maxs());
    return lo[0] < e.bmaxs[0] && hi[0] > e.bmins[0] && lo[1] < e.bmaxs[1] && hi[1] > e.bmins[1] && lo[2] < e.bmaxs[2] && hi[2] > e.bmins[2];
  }
  hurtPlayer(dmg: number, dir: V3, force = false) {
    if (this.dead || this.god || (!this.damage && !force)) return;
    this.dmgAcc += dmg; const n = Math.floor(this.dmgAcc); this.dmgAcc -= n; this.health = Math.floor(this.health) - n; this.lastHurt = this.io.time;
    this.player.vel = ma(this.player.vel, PLAYER_HP.push, [dir[0], dir[1], 0]);
    if (this.health <= 0) { this.dead = true; this.io.log.push(`${this.io.time.toFixed(2)} player died`); if (this.held) this.use(); setTimeout(() => this.onDeath?.(), 0); }
  }
  turretSay(c: Cube, what: string) { this.snd?.play('npc_floorturret.' + what, c.pos); }
  turretAct(c: Cube, seq: string) { const pr = c.prop, m = pr.model; if (!m) return; const si = findSeq(m, seq); if (si >= 0 && pr.seq !== si) { this.startSeq(pr, m, si); pr.onDone = undefined; } }
  /** a turret think, at the SDK's think rates (0.05 s, 0.1 s while active) */
  updateTurret(c: Cube) {
    const T = c.turret!, now = this.io.time, pr = c.prop, m = pr.model; if (!m || T.state === 'dead' || T.eyes < 0 || now < T.next) return;
    const P = pr.poses ??= [0, 0], R = c.R, up = R[10], seqName = () => m.skel.seqs[pr.seq ?? 0]?.name;
    const finished = () => !pr.loop && (pr.cycle ?? 0) >= 1;
    // model-space goal from world angles relative to the turret
    const W = pr.matrix, Wi = invertRigid(W), toModel = (v: V3) => xformDir(Wi, v);
    const f = attachFrame(m, T.eyes, P), eye = xformPoint(W, f.pos), muzzle = norm(xformDir(W, f.x));
    const target: V3 = add(this.player.pos, [0, 0, 36]), to = sub(target, eye), dist = len(to), dir = scale(to, 1 / (dist || 1));
    const vis = this.turretSees(c, target, eye); T.seen = vis;
    const face = (goal: V3) => turretFace(m, T.eyes, P, toModel(goal), 0, 1);
    const shoot = () => { this.turretAct(c, 'fire'); pr.cycle = 0; this.snd?.play('npc_floorturret.shotsounds', eye); T.shots++; this.turretBullets(c, eye, muzzle, !!vis); };
    T.next = now + TURRET.think;
    if (c.held) { if (T.state !== 'tipped') { /* carried: keeps its state but doesn't shoot */ } }
    if (T.state !== 'tipped' && !c.held && up < 0.5) { T.state = 'tipped'; T.thrash = now + 2 + Math.random() * 0.5; this.snd?.play('npc_floorturret.alarm', eye); this.turretSay(c, 'talktipped'); this.io.fire(c.ent, 'ontipped', c.ent); return; }
    switch (T.state) {
      case 'idle': if (vis && !c.held) { T.state = 'deploy'; this.turretAct(c, 'deploy'); this.snd?.play('npc_floorturret.deploy', eye); this.turretSay(c, 'talkdeploy'); this.io.fire(c.ent, 'ondeploy', c.ent); } break;
      case 'deploy': if (finished()) { this.turretAct(c, 'idlealert'); T.shot = now + 1; T.state = 'search'; T.lastSight = now + TURRET.maxWait; } break;
      case 'search':
        if (vis && !c.held) { T.state = 'active'; T.shot = now + 0.5; this.snd?.play('npc_floorturret.activate', eye); this.turretSay(c, 'talkactive'); break; }
        if (now > T.lastSight) { T.state = 'retire'; break; }
        { const a = Math.atan2(R[1], R[0]) * 180 / Math.PI, ang: V3 = [Math.sin(now) * 15, a + Math.sin(now * 2) * 60, 0]; face(angleVectors(ang).f); }
        if (seqName() === 'fire' && finished()) this.turretAct(c, 'idlealert'); break;
      case 'active':
        T.next = now + TURRET.thinkActive;
        if (!vis || c.held) { T.state = 'search'; T.lastSight = now + TURRET.maxWait; this.turretSay(c, 'talksearch'); break; }
        if (T.shot < now && dot(dir, muzzle) >= TURRET.aimDot) shoot(); else if (seqName() === 'fire' && finished()) this.turretAct(c, 'idlealert');
        face(dir); break;
      case 'retire':
        if (seqName() !== 'retract') { this.turretAct(c, 'idlealert'); if (!face(xformDir(W, [1, 0, 0]))) { this.turretAct(c, 'retract'); this.snd?.play('npc_floorturret.retire', eye); this.turretSay(c, 'talkretire'); this.io.fire(c.ent, 'onretire', c.ent); } }
        else if (finished()) { T.state = 'idle'; this.turretAct(c, 'idle'); }
        break;
      case 'tipped':
        if (up >= 0.5 && !c.held) { T.state = 'search'; T.lastSight = now + TURRET.maxWait; break; }   // ReturnToLife
        if (now < T.thrash) { if (T.shot < now) { shoot(); T.shot = now + 0.05; } const a = Math.atan2(R[1], R[0]) * 180 / Math.PI; face(angleVectors([(Math.random() * 2 - 1) * 60, a + (Math.random() * 2 - 1) * 60, 0]).f); }
        else if (seqName() !== 'retract') { this.turretAct(c, 'idlealert'); if (!face(xformDir(W, [1, 0, 0]))) { this.snd?.play('npc_floorturret.die', eye); this.turretAct(c, 'retract'); this.snd?.play('npc_floorturret.retract', eye); } }
        else if (finished()) { T.state = 'dead'; this.io.fire(c.ent, 'ondeath', c.ent); }
        break;
    }
  }
  updateCubeBox(c: Cube) { const cap = (c.he ? Math.max(...c.he) : c.ext) * 1.3, b = c.ent.box, x = halfExtent(c).map(v => Math.min(v, cap)); b.mins = [c.pos[0] - x[0], c.pos[1] - x[1], c.pos[2] - x[2]]; b.maxs = [c.pos[0] + x[0], c.pos[1] + x[1], c.pos[2] + x[2]]; }
  // ---------- portals ----------
  activatePortal(e: Ent, on: boolean) {
    const p: Portal = e.portal; if (!p) return;
    if (on) { for (const o of this.io.ents) if (o !== e && o.portal && o.kv.portaltwo === e.kv.portaltwo && o.portal.open) o.portal.open = false; const gp = this.gunPortals?.[e.kv.portaltwo === '1' ? 1 : 0]; if (gp) gp.open = false; }
    p.open = on; this.portalBrushes.delete(p); this.relinkMapPortals();
  }
  relinkMapPortals() {
    // one open portal per colour (linkage group 0): the player's gun portal and a map prop_portal of the same colour
    // replace each other, and whichever blue + orange are open are linked (e.g. gun blue <-> fixed orange in chamber 02)
    const map = this.io.ents.filter(e => e.portal);
    const g = this.gunPortals || [];
    const blue = (g[0]?.open ? g[0] : null) || map.find(e => e.kv.portaltwo !== '1' && e.portal.open)?.portal;
    const orange = (g[1]?.open ? g[1] : null) || map.find(e => e.kv.portaltwo === '1' && e.portal.open)?.portal;
    for (const e of map) e.portal.linked = null; for (const p of g) p.linked = null;
    if (blue && orange) { blue.linked = orange; orange.linked = blue; }
  }
  /** SDK 2013 doors.cpp CBaseDoor::DoorHitTop: at the top, a door without "Toggle" (no auto-return, spawnflag 32) goes
   *  back down after `wait` seconds; wait -1 stays. "Top" is the open end, or the closed end for a start-open door (its
   *  positions are swapped at spawn). Covers func_door and func_door_rotating (both CBaseDoor). */
  doorArrived(e: Ent, at: number) { const sf = +(e.kv.spawnflags || 0), top = sf & 1 ? 0 : 1, w = +(e.kv.wait ?? 0);
    if (at === top && !(sf & 32) && w >= 0 && /^func_door/.test(e.cls)) e.returnAt = this.io.time + Math.max(w, 1e-3); }
  /** a point / direction in a brush entity's own frame (Collider.rot is local->world, column-major; offset is its origin) */
  colLocal(c: any, p: V3): V3 { const R = c.rot, v = sub(p, c.offset); return R ? [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[4] * v[0] + R[5] * v[1] + R[6] * v[2], R[8] * v[0] + R[9] * v[1] + R[10] * v[2]] : v; }
  colLocalDir(c: any, d: V3): V3 { const R = c.rot; return R ? [R[0] * d[0] + R[1] * d[1] + R[2] * d[2], R[4] * d[0] + R[5] * d[1] + R[6] * d[2], R[8] * d[0] + R[9] * d[1] + R[10] * d[2]] : d; }
  /** world brushes that make up the surface behind a portal (ignored while something passes through it) */
  /** brush indices under a brush model's BSP head node */
  modelBrushes(headnode: number) { const bsp = this.bsp, out = new Set<number>(), st = [headnode];
    while (st.length) { const n = st.pop()!; if (n < 0) { const lf = bsp.leafs[-1 - n]; for (let i = 0; i < lf.numLeafBrushes; i++) out.add(bsp.leafBrushes[lf.firstLeafBrush + i]); } else st.push(...bsp.nodes[n].children); }
    return out; }
  brushesBehind(p: Portal) {
    let s = this.portalBrushes.get(p); if (s) return s; s = new Set();
    const bsp = this.bsp;
    const onCol = (p as any).onCol; const only = onCol ? this.modelBrushes(onCol.headnode) : null;
    // a portal on a brush entity: its own brushes (in the entity's local frame) plus world brushes right behind it
    if (only) for (const bi of only) { const br = bsp.brushes[bi]; let inside = true;
      for (let i = 0; i < br.numSides && inside; i++) { const pl = bsp.planes[bsp.brushSides[br.firstSide + i].plane];
        const c = this.colLocal(onCol, ma(p.pos, -20, p.f)), lr = this.colLocalDir(onCol, p.r), lu = this.colLocalDir(onCol, p.u), lf = this.colLocalDir(onCol, p.f);
        const ex = Math.abs(dot(pl.n, lr)) * (PW - 4) + Math.abs(dot(pl.n, lu)) * (PH - 4) + Math.abs(dot(pl.n, lf)) * 19.5;
        if (dot(pl.n, c) - pl.d - ex > -1) inside = false; }
      if (inside) s.add(bi); }
    const world = (this as any).worldBrushes ??= this.modelBrushes(bsp.models[0].headnode); // brush-entity brushes live in their own frames
    for (let bi = 0; bi < bsp.brushes.length; bi++) { if (!world.has(bi)) continue;
      const br = bsp.brushes[bi]; if (!(br.contents & (CONTENTS.SOLID | CONTENTS.PLAYERCLIP | CONTENTS.WINDOW | CONTENTS.GRATE))) continue; // grates too: a06 has a grating 16u under its pit-floor portal surface
      // test portal hole (shrunk slightly) extruded 0.5..40 units behind the surface against the brush's planes (separating-axis on brush planes only)
      let inside = true;
      for (let i = 0; i < br.numSides && inside; i++) {
        const pl = bsp.planes[bsp.brushSides[br.firstSide + i].plane];
        // min over the hole box of dot(n, x) - d
        const c = ma(p.pos, -20, p.f); const ex = Math.abs(dot(pl.n, p.r)) * (PW - 4) + Math.abs(dot(pl.n, p.u)) * (PH - 4) + Math.abs(dot(pl.n, p.f)) * 19.5;
        if (dot(pl.n, c) - pl.d - ex > -1) inside = false;
      }
      if (inside) s.add(bi);
    }
    this.portalBrushes.set(p, s); return s;
  }
  /** if a box at pos fits inside an open, linked portal hole and is near/behind it, return the brushes to ignore */
  tunnelFor(pos: V3, mins: V3, maxs: V3): Set<number> | null {
    let out: Set<number> | null = null;
    const ctr: V3 = [pos[0] + (mins[0] + maxs[0]) / 2, pos[1] + (mins[1] + maxs[1]) / 2, pos[2] + (mins[2] + maxs[2]) / 2];
    const ext: V3 = [(maxs[0] - mins[0]) / 2, (maxs[1] - mins[1]) / 2, (maxs[2] - mins[2]) / 2];
    for (const p of this.portals) {
      if (!p.open || !p.linked || !p.linked.open) continue;
      const d = sub(ctr, p.pos); const df = dot(d, p.f);
      const ef = Math.abs(p.f[0]) * ext[0] + Math.abs(p.f[1]) * ext[1] + Math.abs(p.f[2]) * ext[2];
      if (df - ef > 24 || df < -60) continue;
      const er = Math.abs(p.r[0]) * ext[0] + Math.abs(p.r[1]) * ext[1] + Math.abs(p.r[2]) * ext[2], eu = Math.abs(p.u[0]) * ext[0] + Math.abs(p.u[1]) * ext[1] + Math.abs(p.u[2]) * ext[2];
      if (Math.abs(dot(d, p.r)) + er > PW + 2) continue;
      const du = dot(d, p.u), lowTol = Math.abs(p.f[2]) < 0.3 ? 20 : 2; // walls: let the hull's feet overhang the lower rim a step's height
      if (du + eu > PH + 2 || du - eu < -PH - lowTol) continue;
      const s = this.brushesBehind(p); if (!out) out = new Set(s); else for (const b of s) out.add(b);
    }
    return out;
  }
  /** has a point moved from in front of portal p to behind it, inside the hole? */
  crossed(p: Portal, a: V3, b: V3) {
    const da = dot(sub(a, p.pos), p.f), db = dot(sub(b, p.pos), p.f);
    if (!(da >= 0 && db < 0)) return false;
    const t = da / (da - db); const x = add(a, scale(sub(b, a), t)); const d = sub(x, p.pos);
    const lr = dot(d, p.r) / PW, lu = dot(d, p.u) / PH; return lr * lr + lu * lu <= 1.05;
  }
  lastExit: { p: Portal; t: number } | null = null;
  teleportPlayer(a: Portal, b: Portal, centre = false, feetBefore = this.player.pos[2]) {
    this.lastExit = { p: b, t: this.io.time };
    const M = throughPortal(a, b); const pl = this.player; const mid = centre ? pl.maxs()[2] / 2 : pl.viewOffset;
    const c: V3 = [pl.pos[0], pl.pos[1], pl.pos[2] + mid]; const nc = xformPoint(M, c);
    // floor (or ceiling) into a wall: the original's exit speed is the entry speed less 4 to 6 (391.5/526.5/625.5 from
    // 395.5/532.9/629.8, checks/reference/fling-wall.json), where this port's came out 4.5 more (409/536/636). That's
    // one tick of gravity, 9.1: the port moves the player (both gravity halves) and then teleports, so the speed carried
    // into the horizontal includes this tick's gravity. Take it back out for those exits; floor-to-floor flings are fitted
    // separately below. Wall-to-wall and other cases aren't measured.
    if (this.wallFlingTick && Math.abs(a.f[2]) > 0.7 && Math.abs(b.f[2]) < 0.7) pl.vel = [pl.vel[0], pl.vel[1], pl.vel[2] + 600 * this.lastDt];
    pl.vel = xformDir(M, pl.vel);
    const { f, u } = angleVectors(pl.ang); const nf = xformDir(M, f), nu = xformDir(M, u);
    const na = vectorAngles(nf, nu); pl.ang = [Math.max(-89, Math.min(89, na[0])), na[1], 0];
    pl.pos = [nc[0], nc[1], nc[2] - mid];
    // floor/ceiling exits: put the whole hull in front of the exit plane (a ceiling exit drops the player out below it)
    if (b.f[2] < -0.7) pl.pos[2] = Math.min(pl.pos[2], b.pos[2] - pl.maxs()[2] - 1); else if (b.f[2] > 0.7) pl.pos[2] = Math.max(pl.pos[2], b.pos[2] + 1);
    // floor to floor: the hull comes out upright and whole in front of the exit, which lifts the feet by the depth they
    // had gone into the entry plus the clamp above. The original keeps the energy instead: dropped from h onto a floor
    // portal, the player comes back up to within 8 units of h (measured, checks/reference/fling.json), where this port
    // came up 37 to 41 units higher. So take the lift out of the exit speed (v'² = v² - 2g·lift).
    if (a.f[2] > 0.7 && b.f[2] > 0.7) { const depth = Math.max(0, a.pos[2] - feetBefore), lift = pl.pos[2] - (b.pos[2] - depth), up = dot(pl.vel, b.f);
      if (up > 0 && lift > 0) { const nu = Math.sqrt(Math.max(0, up * up - 2 * 600 * lift)); pl.vel = ma(pl.vel, nu - up, b.f); } }
    // exiting a floor portal: make sure we leave with at least a little speed so we clear the hole
    const out = dot(pl.vel, b.f); if (out < 60) pl.vel = ma(pl.vel, 60 - out, b.f);
    pl.onGround = false; this.stats.teleports++;
    // un-stick: the exit hole may sit lower/higher than the hull (e.g. feet below the floor); nudge up/out until free
    this.tr.ignore = this.tunnelFor(pl.pos, HULL.mins, pl.maxs());
    const free = (q: V3) => !this.tr.trace(q, q, HULL.mins, pl.maxs(), 0x1 | 0x2 | 0x8 | 0x4000 | 0x10000 | 0x2000000, pl).startsolid;
    if (!free(pl.pos)) { let done = false;
      for (let k = 1; k <= 40 && !done; k++) for (const d of [[0, 0, 1], b.f, [0, 0, -1]] as V3[]) { const q = ma(pl.pos, k, d); if (free(q)) { pl.pos = q; done = true; break; } } }
    // duck after the standing mid-point exit (so the hull/eye used above stay standing). Wall exits stay ducked until
    // we land; floor/ceiling exits un-duck at 0.35 s (oracle wallfling-drop-* and fling-drop-* traces).
    if (!this.player.noclip) this.player.forcePortalDuck(Math.abs(b.f[2]) < 0.7);
    // a held cube comes along (Source keeps held objects attached through portals): re-place it in front of the new
    // view *after* the duck, so it isn't left 36 units above the ducked eye and snagged on the next UpdateObject.
    const hc = this.held; if (hc && hc.viaPortal === a) hc.viaPortal = null; else if (hc) { hc.viaPortal = null; const e2 = pl.eye(); const f2 = angleVectors(pl.ang).f; const ext: V3 = [hc.ext, hc.ext, hc.ext];
      const t = this.tr.trace(e2, ma(e2, 56, f2), scale(ext, -1), ext, 0x1 | 0x2 | 0x8 | 0x4000, this.playerEnt); hc.pos = t.startsolid ? [...e2] as V3 : t.end; hc.vel = [...pl.vel] as V3;
      if (hc.R) hc.R = mul(M, hc.R); hc.justPortaled = true; }
    this.tr.ignore = null;
    this.io.log.push(`${this.io.time.toFixed(2)} teleport ${a.name} -> ${b.name}`);
  }
  /** src: fire from somewhere else (the a01 pedestal gun's FirePortal1 input) */
  shootPortal(which: 0 | 1, src?: { eye: V3; f: V3 }) {
    if (!src && (!this.hasGun || !this.canFire[which])) return;
    if (!src) this.vmPlay('act_vm_primaryattack');
    // firing while holding a cube drops it and fires anyway, and the shot goes past the cube (the original, a02's box_2:
    // held, +attack, the blue opens on the wall straight ahead and the box falls; oracle stills, Nov 24 9:40 AM EST)
    let dropped: Ent | null = null; if (!src && this.held) { dropped = this.held.ent; this.use(); }
    const eye = src ? src.eye : this.player.eye(); const f = src ? src.f : angleVectors(this.player.ang).f;
    this.tr.ignore = null;
    const t = this.tr.trace(eye, ma(eye, 8192, f), [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, dropped ? new Set<any>([this.playerEnt, dropped]) : this.playerEnt);
    // brush entities (func_brush / func_door, e.g. a06's fling pillars) take portals while they hold still; the portal fizzles if they move
    // rotated ones too (a14's wedge panel, a func_brush on a func_door_rotating, takes a portal once it has swung to 45
    // degrees: Portal Wiki and Prima walkthroughs of chamber 18); their sides are looked up in the entity's own frame
    const onCol = t.ent && t.col && /^func_(brush|door|wall)$/.test(t.ent.cls) ? t.col : null;
    if (t.fraction >= 1 || (t.ent && !onCol)) return this.fizzleShot(which, 'nothing');
    // the shot doesn't cross an enabled trigger_portal_cleanser: measured in the original (a10, oracle-ctl), shots across
    // its cleansers at portalable floor, walls and ceiling leave no portal, while the same floor this side takes one
    for (const c of this.io.ents) if (c.cls === 'trigger_portal_cleanser' && c.enabled !== false && !c.killed && c.bmins && segHitsBox(eye, t.end, c.bmins, c.bmaxs)) return this.fizzleShot(which, 'cleanser');
    const off: V3 = onCol ? [...onCol.offset] as V3 : [0, 0, 0];
    // find the surface flags of the brush side we hit
    const n = t.normal; let flags = 0, texd = -1;
    if (t.hit >= 0) { const br = this.bsp.brushes[t.hit]; let best = -1;
      const ln = onCol ? this.colLocalDir(onCol, n) : n, le = onCol ? this.colLocal(onCol, t.end) : t.end;
      for (let i = 0; i < br.numSides; i++) { const sd = this.bsp.brushSides[br.firstSide + i]; const pl = this.bsp.planes[sd.plane]; const dd = dot(pl.n, ln); if (dd > 0.99 && sd.texinfo >= 0 && Math.abs(dot(pl.n, le) - pl.d) < 2) { best = sd.texinfo; break; } }
      if (best >= 0) { flags = this.bsp.texinfo[best].flags; texd = this.bsp.texinfo[best].texdata; } }
    const matName = texd >= 0 ? this.bsp.texdata[texd].name : '';
    const mat = texd >= 0 ? this.r.world.mats[texd] : null;
    if (flags & SURF.NOPORTAL || mat?.noportal || /toolsnodraw|toolsblack|toolsclip/.test(matName)) return this.fizzleShot(which, 'noportal ' + matName);
    // glass: the original won't put a portal on a08's frosted window glass (world brush) or on the glass top of the cube's rail
    // platform (func_brush), measured with tools/oracle-ctl.mjs. Taken here as "translucent material takes no portal"; whether the
    // original decides by translucency, surface property or something else is a guess.
    if (mat?.translucent) return this.fizzleShot(which, 'glass ' + matName);
    let up: V3;
    if (Math.abs(n[2]) > 0.7) { const pf = angleVectors([0, this.player.ang[1], 0]).f; up = n[2] > 0 ? pf : scale(pf, -1); up = norm(sub(up, scale(n, dot(up, n)))); }
    else up = norm(sub([0, 0, 1], scale(n, n[2])));
    const right = cross(up, n); // r = up x f ... ensure right-handed: f x r = u? (Source: right = f x up)
    const rr = norm(cross(n, up)); void right;
    let pos = ma(t.end, 0, n);
    const other = this.gunPortals[1 - which];
    // the face a trace hit carries a no-portal material (or the NOPORTAL surface flag)
    const noportal = (q: any) => { if (q.hit < 0) return false; const br = this.bsp.brushes[q.hit]; const lc = q.col && q.col === onCol ? onCol : null, ln = lc ? this.colLocalDir(lc, n) : n, le = lc ? this.colLocal(lc, q.end) : q.end;
      for (let i = 0; i < br.numSides; i++) { const sd = this.bsp.brushSides[br.firstSide + i]; const pl = this.bsp.planes[sd.plane];
      if (dot(pl.n, ln) > 0.99 && sd.texinfo >= 0 && Math.abs(dot(pl.n, le) - pl.d) < 2) { const ti = this.bsp.texinfo[sd.texinfo]; const m = this.r.world.mats[ti.texdata]; return !!(ti.flags & SURF.NOPORTAL || m?.noportal || m?.translucent); } } return false; }; // glass too, see above
    const fits = (c: V3) => {
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const pt = add(add(c, scale(rr, a * (PW - 1))), scale(up, b * (PH - 1)));
        const s = ma(pt, 2, n), e2 = ma(pt, -2, n); const q = this.tr.trace(s, e2, [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, this.playerEnt);
        if (q.fraction >= 1 || q.startsolid || dot(q.normal, n) < 0.99 || (q.ent && q.ent !== t.ent) || (!q.ent && onCol)) return false;
        if (noportal(q)) return false;
        // must not be covered (e.g. by geometry right in front)
        const block = this.tr.trace(ma(pt, 3, n), ma(pt, 0.5, n), [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, this.playerEnt); if (block.startsolid) return false;
      }
      if (other.open && dot(other.f, n) > 0.99 && Math.abs(dot(sub(c, other.pos), n)) < 2) { const d = sub(c, other.pos); if (Math.abs(dot(d, other.r)) < PW * 2 && Math.abs(dot(d, other.u)) < PH * 2) return false; }
      for (const v of this.noportalVolumes) if (v.enabled && c[0] > v.bmins[0] && c[0] < v.bmaxs[0] && c[1] > v.bmins[1] && c[1] < v.bmaxs[1] && c[2] > v.bmins[2] && c[2] < v.bmaxs[2]) return false;
      return true;
    };
    // bump the portal away from edges until it fits (like the real game's placement nudging)
    let ok = fits(pos);
    for (let iter = 0; !ok && iter < 24; iter++) {
      let moved = false;
      for (const [ax, sgn] of [[rr, 1], [rr, -1], [up, 1], [up, -1]] as [V3, number][]) {
        const ext = ax === rr ? PW : PH; const pt = add(pos, scale(ax, sgn * (ext - 1)));
        const q = this.tr.trace(ma(pt, 2, n), ma(pt, -2, n), [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, this.playerEnt);
        // a no-portal surface counts as an edge too, so a shot near a metal strip slides onto the concrete beside it
        if (q.fraction >= 1 || dot(q.normal, n) < 0.99 || q.startsolid || noportal(q)) { pos = add(pos, scale(ax, -sgn * 4)); moved = true; }
      }
      if (!moved) break; ok = fits(pos);
    }
    // func_portal_bumper: placement is pushed off these volumes (Valve Developer Wiki). Try the smallest in-plane shift that clears every bumper and still fits.
    const bumped = (c: V3) => this.bumpers.some(v => { const lo = v.bmins, hi = v.bmaxs; for (let a = 0; a < 3; a++) { const ext = Math.abs(rr[a]) * PW + Math.abs(up[a]) * PH + Math.abs(n[a]) * 2; if (c[a] + ext <= lo[a] || c[a] - ext >= hi[a]) return false; } return true; });
    if (ok && bumped(pos)) { let best: V3 | null = null;
      for (let d = 4; d <= 96 && !best; d += 4) for (const ax of [up, scale(up, -1), rr, scale(rr, -1)]) { const c2 = ma(pos, d, ax); if (!bumped(c2) && fits(c2)) { best = c2; break; } }
      if (best) pos = best; else ok = false; }
    if (!ok) return this.fizzleShot(which, 'no fit');
    const p = this.gunPortals[which];
    p.pos = pos; p.f = [...n] as V3; p.u = up; p.r = rr; p.open = true; (p as any).onCol = onCol; (p as any).onOff = off; (p as any).onRot = onCol?.rot ? Array.from(onCol.rot) : null; this.portalBrushes.delete(p); this.stats.portalsPlaced++;
    // gun portals replace map portals of the same colour
    for (const e of this.io.ents) if (e.portal && e.portal.open && (e.kv.portaltwo === '1') === (which === 1)) e.portal.open = false;
    this.relinkMapPortals();
    this.snd?.play(which ? 'weapons/portalgun/portalgun_shoot_red1.wav' : 'weapons/portalgun/portalgun_shoot_blue1.wav');
  }
  startAmbients() { for (const e of this.io.ents) if (e.cls === 'ambient_generic' && !(+(e.kv.spawnflags || 0) & 16) && !e.sndH && !e.killed) this.io.deliver(e, 'playsound', '', null, e); }
  /** play scene line n (soundscript) with its caption, then chain to the next */
  speak(e: Ent, n: number) { const name = e.sceneSounds?.[n]; if (!name || !e.playing) return; const sn = this.snd; if (!sn) return;
    const cap = sn.caption(name); const h = sn.play(name, e.origin, { everywhere: true }); e.sndH = h;
    const t0 = this.io.time; const wait = () => { if (!e.playing || h.stopped) return; if (h.dur) { if (cap) { this.captions = this.captions.filter(c => c.until - 0.5 > this.io.time && c.text !== cap).slice(-1); this.captions.push({ text: cap, until: this.io.time + h.dur + 0.5 }); } setTimeout(() => this.speak(e, n + 1), h.dur * 1000 + 100); } else if (this.io.time - t0 < 5) setTimeout(wait, 100); else { if (cap) this.captions.push({ text: cap, until: t0 + 4 }); this.speak(e, n + 1); } };
    wait(); }
  fizzleShot(which: number, why: string) { this.io.log.push(`portal ${which} failed: ${why}`); this.snd?.play('weapons/portalgun/portal_invalid_surface3.wav'); }
  fizzleGunPortals() { for (const p of this.gunPortals) p.open = false; this.relinkMapPortals(); }
  // ---------- handlers ----------
  setupHandlers() {
    const io = this.io, H = io.handlers;
    H.set('logic_relay', (e, i) => {
      if (i === 'trigger') { if (!e.enabled) return true; io.fire(e, 'ontrigger', null); if (+e.kv.spawnflags & 1) e.enabled = false; return true; }
      if (i === 'cancelpending') { io.queue = io.queue.filter(q => q.caller !== e); return true; }
      return false;
    });
    H.set('logic_timer', (e, i, p) => {
      if (i === 'refiretime') { e.kv.refiretime = p; return true; } if (i === 'firetimer') { io.fire(e, 'ontimer', null); return true; }
      if (i === 'resettimer') { e.next = +(e.kv.refiretime || 1); return true; }
      if (i === 'enable') { e.enabled = true; e.next = +(e.kv.refiretime || 1); return true; } return false;
    });
    H.set('math_counter', (e, i, p) => {
      const v0 = e.value;
      if (i === 'add') e.value += +p; else if (i === 'subtract') e.value -= +p; else if (i === 'setvalue' || i === 'setvaluenofire') e.value = +p; else return false;
      if (e.max || e.min) e.value = Math.max(e.min, Math.min(e.max || 1e9, e.value));
      if (i !== 'setvaluenofire') io.fire(e, 'outvalue', null, String(e.value));
      if (e.max && e.value >= e.max && v0 < e.max) io.fire(e, 'onhitmax', null); if (e.value <= e.min && v0 > e.min) io.fire(e, 'onhitmin', null);
      return true;
    });
    H.set('logic_case', (e, i, p) => {
      if (i === 'invalue') { for (let k = 1; k <= 16; k++) { const key = 'case' + String(k).padStart(2, '0'); if (e.kv[key] !== undefined && e.kv[key] === p) { io.fire(e, 'on' + key, null); return true; } } io.fire(e, 'ondefault', null, p); return true; }
      if (i === 'pickrandom') { const ks = Object.keys(e.kv).filter(k => /^case\d\d$/.test(k)); if (ks.length) io.fire(e, 'on' + ks[Math.random() * ks.length | 0], null); return true; }
      return false;
    });
    H.set('logic_choreographed_scene', (e, i) => {
      // VCD choreography: timing + dialogue come from the scene's summary in scenes/scenes.image (total length + the sounds it speaks).
      // Sounds play back to back with English captions; OnTrigger outputs are spread across the scene since we don't run the event timeline.
      if (i === 'start') { if (e.playing) return true; e.playing = true; io.fire(e, 'onstart', null);
        const info = this.snd?.scene(e.kv.scenefile || ''); const dur = info ? Math.max(0.5, info.msecs / 1000) : 4; e.sceneSounds = info?.sounds || [];
        io.log.push(`${io.time.toFixed(2)} scene ${e.kv.scenefile} ${dur.toFixed(1)}s ${e.sceneSounds.join(',')}`);
        let k = 1; for (; k <= 16; k++) if (!e.outputs.has('ontrigger' + k)) break;
        for (let j = 1; j < k; j++) io.send(e.name, '_trig' + j, '', dur * j / k, null, e); io.send(e.name, '_done', '', dur, null, e);
        this.speak(e, 0); return true; }
      if (i.startsWith('_trig')) { if (e.playing) io.fire(e, 'ontrigger' + i.slice(5), null); return true; }
      if (i === '_done') { if (!e.playing) return true; e.playing = false; io.fire(e, 'oncompletion', null); return true; }
      if (i === 'cancel' || i === 'stop') { e.playing = false; e.sndH?.stop(); io.cancel?.(e.name); return true; }
      return true;
    });
    H.set('prop_portal', (e, i, p) => {
      if (i === 'setactivatedstate') { this.activatePortal(e, p === '1'); return true; }
      if (i === 'fizzle') { this.activatePortal(e, false); return true; }
      if (i === 'open') { this.activatePortal(e, true); return true; }
      return true;
    });
    const doorMove = (e: Ent, open: boolean) => { if (e.locked) return; this.wakeCubes(e); const target = open ? 1 : 0; if (e.state === target && e.moving !== true) return; e.state = target; e.moving = true; e.returnAt = 0; e.moveSpeed = e.speed; io.fire(e, open ? 'onopen' : 'onclose', null); };
    H.set('func_door', (e, i, param) => {
      if (i === 'open') doorMove(e, true); else if (i === 'close') doorMove(e, false); else if (i === 'toggle') doorMove(e, e.state === 0);
      else if (i === 'lock') e.locked = true; else if (i === 'unlock') e.locked = false; else if (i === 'setspeed') e.speed = +param || e.speed; // the next move's speed (SDK InputSetSpeed: m_flSpeed, read when a move starts)
      return true;
    });
    // named lights switch their own light style in the lightmaps (Valve Developer Wiki, "light": TurnOn, TurnOff, Toggle)
    const lightIn = (e: Ent, i: string) => { const st = +(e.kv.style || 0); if (st < 32) return false;
      const on = i === 'turnon' ? 1 : i === 'turnoff' ? 0 : i === 'toggle' ? (e.lightOn ?? !(+(e.kv.spawnflags || 0) & 1) ? 0 : 1) : -1; if (on < 0) return false;
      e.lightOn = !!on; const n = this.r.setLightStyle(st, on); io.log.push(`${io.time.toFixed(2)} light style ${st} ${on ? 'on' : 'off'} (${n} faces)`); return true; };
    H.set('light', lightIn); H.set('light_spot', lightIn);
    // env_shake (SDK 2013 EnvShake.cpp + UTIL_ScreenShake): amplitude capped at 16, falls off linearly to the radius (0 or
    // flag 1 = everyone at full), only players on the ground unless flag 4; flag 0x20 is no view shake
    H.set('env_shake', (e, i) => { const sf = +(e.kv.spawnflags || 0);
      if (i === 'stopshake') { this.shakes = []; return true; }
      if (i !== 'startshake' && i !== 'amplitude' && i !== 'frequency') return false;
      const rad = sf & 1 ? 0 : +(e.kv.radius || 0); let amp = Math.min(16, +(e.kv.amplitude || 0));
      if (i === 'startshake' && !(sf & 4) && !this.player.onGround) return true;
      if (rad > 0) { const c = add(this.player.pos, [0, 0, 36]), d = len(sub(c, e.origin)); if (d > rad) return true; amp *= 1 - d / rad; }
      if (amp <= 0) return true;
      const longest = () => this.shakes.reduce((a: any, b: any) => !a || b.duration > a.duration ? b : a, null);
      if (i === 'startshake') { if (!(sf & 0x20) && this.shakes.length < 32) this.shakes.push({ amplitude: amp, frequency: +(e.kv.frequency || 0), duration: +(e.kv.duration || 0), next: 0, end: io.time + +(e.kv.duration || 0), offset: [0, 0, 0], angle: 0 }); }
      else if (i === 'amplitude') { const l = longest(); if (l) l.amplitude = amp; }
      else { const l = longest(); if (l) l.frequency = +(e.kv.frequency || 0); }
      return true; });
    H.set('func_portal_detector', (e, i) => { if (i === 'enable') e.enabled = true; else if (i === 'disable') e.enabled = false; else if (i === 'toggle') e.enabled = e.enabled === false; else return false; return true; });
    H.set('func_brush', (e, i) => { if (i === 'enable') { e.enabled = true; if (this.playerOverlaps(e)) e.passPlayer = true; }
      else if (i === 'disable') { e.enabled = false; e.passPlayer = false; }
      else if (i === 'toggle') { e.enabled = !e.enabled; if (!e.enabled) e.passPlayer = false; else if (this.playerOverlaps(e)) e.passPlayer = true; }
      else return false; this.wakeCubes(e); if (e.inst) e.inst.visible = e.enabled; return true; });
    const propVis = (e: Ent, i: string, param: string) => { if (!e.cube && i === 'enablemotion' && /^prop_physics/.test(e.cls)) { this.wakeStaticProp(e); return true; } if (e.cube && (i === 'wake' || i === 'enablemotion')) { e.cube.asleep = false; e.cube.sleep = 0; return true; } if (e.cube && (i === 'sleep' || i === 'disablemotion')) { e.cube.asleep = true; return true; } if (!e.prop) return false; if (i === 'turnon' || i === 'enable') e.prop.visible = true; else if (i === 'turnoff' || i === 'disable') e.prop.visible = false; else if (i === 'skin') return true; else if (i === 'setanimation') { this.playAnim(e, param, false); }
      else if (i === 'setdefaultanimation') { e.defaultAnim = param; }
      else if (i === 'setplaybackrate') { e.prop.rate = +param || 0; }
      else return false; return true; };
    H.set('npc_security_camera', (e, i) => { if (i === 'disable') e.camDisabled = true; else if (i === 'enable') e.camDisabled = false; else return false; return true; });
    H.set('npc_rocket_turret', (e, i, p) => {
      if (i === 'enable') this.enableRocketTurret(e);
      else if (i === 'disable') this.disableRocketTurret(e);
      else if (i === 'toggle') { if (e.rocketEnabled) this.disableRocketTurret(e); else this.enableRocketTurret(e); }
      else if (i === 'settarget') { e.rocketTarget = (p || '').toLowerCase(); }
      else if (i === 'destroy' || i === 'break') { e.rocketDestroyed = true; e.rocketEnabled = false; e.defaultAnim = 'inactive'; this.playAnim(e, 'close', false); this.io.fire(e, 'ondeath', e); }
      else return false; return true;
    });
    H.set('prop_dynamic', propVis); H.set('prop_dynamic_override', propVis); H.set('prop_physics', propVis); H.set('prop_glados_core', propVis);
    // material_modify_control: drives $frame of its parent brush's material (Valve Developer Wiki); used by the a00 countdown clock
    H.set('material_modify_control', (e, i, param) => { const par = e.kv.parentname ? this.io.find(e.kv.parentname, null, e)[0] : null; const ins: any = par && (par.inst || par.prop); if (!ins) return true;
      if (i === 'setmaterialvar') { e.lerp = null; ins.texFrame = Math.floor(+param || 0); }
      else if (i === 'startfloatlerp') { const [a, b, d, lp] = (param || '').trim().split(/\s+/).map(Number); e.lerp = { a, b, d: Math.max(0.01, d || 1), loop: !!lp, t0: this.io.time, ins }; this.mmcs.add(e); }
      else if (i === 'startanimsequence') { const [a, b, rate, lp] = (param || '').trim().split(/\s+/).map(Number); e.lerp = { a, b, d: Math.max(0.01, Math.abs(b - a) / Math.max(1, rate || 10)), loop: !!lp, t0: this.io.time, ins }; this.mmcs.add(e); }
      else return false; return true; });
    H.set('env_texturetoggle', (e, i, param) => {
      const ts = this.io.find(e.kv.target || '', null, e); if (!ts.length) return i === 'settextureindex' || i === 'incrementtextureindex';
      for (const t of ts) { const ins: any = t.inst || t.prop || t.ovl; if (!ins) continue;
        if (i === 'settextureindex') ins.texFrame = +param || 0; else if (i === 'incrementtextureindex') ins.texFrame = (ins.texFrame || 0) + 1; else return false; }
      return true; });
    H.set('weapon_portalgun', (e, i) => { const m = /^fireportal([12])$/.exec(i); if (!m || e.killed) return false; const M = e.prop?.matrix || this.entWorld(e);
      const f = norm([M[0], M[1], M[2]] as V3); const o: V3 = [M[12], M[13], M[14]]; this.io.log.push(`${this.io.time.toFixed(2)} ${e.name} fires portal ${m[1]} toward ${f.map(v => v.toFixed(2))}`);
      this.shootPortal((+m[1] - 1) as 0 | 1, { eye: ma(o, 20, f), f }); return true; });
    H.set('func_rotating', (e, i, param) => { if (i === 'start') e.spinning = true; else if (i === 'stop') e.spinning = false; else if (i === 'toggle') e.spinning = !e.spinning;
      else if (i === 'reverse') e.spinDir = -e.spinDir; else if (i === 'setspeed') { e.maxspeed = (+(e.kv.maxspeed || 100)) * (+param || 0); e.spinning = +param > 0; } else return false; return true; });
    // SDK 2013 doors.cpp (CBaseDoor::DoorGoUp): a yaw-rotating door that isn't one-way (spawnflag 16) swings away from its activator. Our I/O
    // doesn't carry the activator into the door, so use the player (single-player). a07's rotating pedestal gun relies on this: it must turn clockwise.
    const awaySign = (e: Ent) => { if (e.cls !== 'func_door_rotating' || e.rotAx !== 1 || (+e.kv.spawnflags & 16) || !e.bmins) return 1;
      const a = this.player.pos, o = e.pos || e.origin; const np = [Math.max(e.bmins[0], Math.min(e.bmaxs[0], a[0])), Math.max(e.bmins[1], Math.min(e.bmaxs[1], a[1]))];
      const ox = o[0] - a[0], oy = o[1] - a[1], nx = np[0] - a[0], ny = np[1] - a[1]; return ox * ny - oy * nx > 0 ? -1 : 1; };
    const rotDoor = (e: Ent, i: string, param: string) => { if (i === 'open' && !e.locked && e.rotAx !== undefined && (e.t || 0) === 0) e.openAng[e.rotAx] = e.closedAng[e.rotAx] + e.rotDist * awaySign(e);
      if (i === 'open' && !e.locked) { if (e.state !== 1) e.returnAt = 0; e.state = 1; e.moving = true; io.fire(e, 'onopen', null); } else if (i === 'close') { e.state = 0; e.moving = true; e.returnAt = 0; io.fire(e, 'onclose', null); }
      else if (i === 'toggle') { e.state = 1 - e.state; e.moving = true; } else if (i === 'lock') e.locked = true; else if (i === 'unlock') e.locked = false; else if (i === 'setspeed') e.speed = +param || e.speed; else return false; return true; };
    H.set('func_door_rotating', rotDoor); H.set('prop_door_rotating', rotDoor);
    H.set('func_tracktrain', (e, i) => { if (i === 'startforward' || i === 'resume') { e.speedNow = e.startspeed; if (!e.pathName && e.curPath && e.curPath.kv.target) e.pathName = e.curPath.kv.target.toLowerCase(); if (!e.pathName && e.curPath) { io.fire(e.curPath, 'onpass', null); e.speedNow = 0; } } else if (i === 'stop') e.speedNow = 0; else if (i === 'startbackward') { e.speedNow = -e.startspeed;
        // backward travel heads for the path_track that targets the one the train is at (Valve Developer Wiki: func_tracktrain / path_track)
        const cur = e.curPath && len(sub(e.curPath.origin, e.pos)) < 4 ? e.curPath : io.find(e.pathName, null, e)[0]; if (cur && len(sub(cur.origin, e.pos)) < 4) { const prev = this.prevPath(cur); if (prev) e.pathName = prev.name; else e.speedNow = 0; } } else if (i === 'setspeed') { } return true; });
    H.set('path_track', (e, i) => { if (i === 'enablealternatepath') e.altOn = true; else if (i === 'disablealternatepath') e.altOn = false; else if (i === 'togglealternatepath') e.altOn = !e.altOn; else return false; return true; });
    H.set('trigger_changelevel', (e, i) => { if (i === 'changelevel') this.changeLevel?.(e.kv.map, (e.kv.landmark || '').toLowerCase()); return true; });
    H.set('point_template', (e, i) => { if (i === 'forcespawn') this.respawnTemplate(e, null); return true; });
    H.set('env_entity_maker', (e, i) => { if (i === 'forcespawn') { const t = io.find(e.kv.entitytemplate, null, e)[0]; if (t) {
        const n0 = this.cubes.length;
        if (!this.spawnTrainTemplate(t, e)) { this.respawnTemplate(t, e); this.placeTemplateGroup(t, e); }
        const spd = +(e.kv.postspawnspeed || 0);
        if (spd) { const dir = angleVectors(parseV3(e.kv.postspawndirection || '0 0 0')).f;
          for (const c of this.cubes.slice(n0)) if (c.alive) { c.vel = scale(dir, spd); c.asleep = false; c.sleep = 0; } }
      } } return true; });
    H.set('point_energy_ball_launcher', (e, i) => { if (i === 'enable') { e.enabled = true; e.nextBall = Math.min(e.nextBall ?? 0, io.time + 0.1); } else if (i === 'disable') e.enabled = false; else if (i === 'launchball') this.launchBall(e); else return false; return true; });
    H.set('filter_combineball_type', () => false);
    H.set('env_hudhint', (e, i) => { if (i === 'showhudhint') { this.hud.hint = e.kv.message || ''; this.hud.hintT = io.time + 4; } else if (i === 'hidehudhint') this.hud.hint = ''; return true; });
    H.set('env_fade', (e, i) => { if (i !== 'fade') return true; const from = +e.kv.spawnflags & 1; const dur = +(e.kv.duration || 1), hold = +(e.kv.holdtime || 0);
      if (from) { this.hud.fade = 1; this.hud.fadeTarget = 0; this.hud.fadeRate = 1 / Math.max(0.01, dur); this.hud.fadeHoldUntil = io.time + hold; } else { this.hud.fadeTarget = 1; this.hud.fadeRate = 1 / Math.max(0.01, dur); } return true; });
    // env_physexplosion (SDK 2013 physobj.cpp, CPhysExplosion::Explode): every physics body named by targetentityname, or
    // within radius (0: any distance), is pushed away from the explosion with damage magnitude − 0.4 × distance (at least
    // 1). A body with a .phy mass gets the SDK's impulse, 300 kg·in/s per damage point (CalculateExplosiveDamageForce: 75 kg
    // pushed 4 in/s; ±15% random left out), along the line through its BodyTarget. BodyTarget is a random point between
    // low on the body and the eyes; it's taken here as the body's centre, so the kick doesn't spin it (a guess). Bodies
    // without a mass keep the old tuned kick: 8 in/s per damage point, applied at the explosion point so it also spins.
    H.set('env_physexplosion', (e, i) => { if (i !== 'explode') return false; const o = e.pos || e.origin, rad = +(e.kv.radius || 0), tgt = (e.kv.targetentityname || '').toLowerCase(), mag = +(e.kv.magnitude || 0);
      for (const c of this.cubes) { if (!c.alive || c.held || (tgt && c.ent.name !== tgt)) continue; const spot = [...c.pos] as V3, from = [...o] as V3; if (+(e.kv.spawnflags || 0) & 4) from[2] = spot[2];
        const d = sub(spot, from), dist = len(d); if (rad && dist > rad) continue; const dmg = Math.max(1, mag - dist * 0.4), j = scale(d, (c.mass ? 300 / c.mass : 8) * dmg / (dist || 1));
        const r = sub(o, c.pos), he = c.he, invI = he ? 9 / (2 * (he[0] ** 2 + he[1] ** 2 + he[2] ** 2)) : 6 / ((2 * c.h) ** 2);
        c.vel = add(c.vel, j); if (!c.mass) c.w = add(c.w, scale(cross(r, j), invI)); c.asleep = false; c.sleep = 0; this.io.log.push(`${this.io.time.toFixed(2)} ${e.name} pushed ${c.ent.name} ${len(j).toFixed(0)} in/s`); }
      return true; });
    H.set('trigger_portal_cleanser', (e, i) => { if (i === 'fizzleTouchingPortals'.toLowerCase()) this.fizzleGunPortals(); return false; });
    // Known no-ops, so io.unhandled lists only real gaps: the renderer is LDR (no auto-exposure or bloom to drive), and
    // there are no saves yet
    H.set('env_tonemap_controller', () => true); H.set('logic_autosave', () => true);
    H.set('ambient_generic', (e, i, p) => { const sn = this.snd; const fl = +(e.kv.spawnflags || 0);
      const start = () => { e.sndH?.stop(); if (!sn) return; const msg = e.kv.message || ''; e.sndH = sn.play(msg, e.pos || e.origin, { vol: Math.min(1, +(e.kv.health ?? 10) / 10), everywhere: !!(fl & 1), loop: fl & 32 ? false : undefined, music: /^portal\.song|music\//i.test(msg) }); this.io.log.push(`${io.time.toFixed(2)} sound ${msg}`); };
      if (i === 'playsound') start(); else if (i === 'stopsound') e.sndH?.stop(); else if (i === 'togglesound') { if (e.sndH && !e.sndH.stopped) e.sndH.stop(); else start(); }
      else if (i === 'volume' && e.sndH?.src) { /* runtime volume changes are ignored */ void p; } return true; });
    H.set('trigger_teleport', () => false); H.set('trigger_once', () => false); H.set('trigger_multiple', () => false);
    H.set('player', (e, i) => { if (i === 'sethealth') {} return true; });
    // func_noportal_volume takes Activate, Deactivate and Toggle (a02's noportal_door_rm3a is deactivated when its door opens)
    H.set('func_noportal_volume', (e, i) => { if (i === 'activate') e.enabled = true; else if (i === 'deactivate') e.enabled = false; else if (i === 'toggle') e.enabled = !e.enabled; else return false; return true; });
    H.set('logic_auto', () => true);
  }
  /** env_entity_maker whose template holds a func_tracktrain that has a speed keyvalue (a10's conveyor carts: a logic_timer
   *  ForceSpawns one every 15 s): each ForceSpawn makes a fresh copy of every member, as CPointTemplate::CreateInstance
   *  does (SDK 2013 point_template.cpp), with names fixed up (&0001, &0002, ...) unless the template preserves names, placed
   *  at the maker (maker origin + maker rotation of each member's offset from the template origin). The copy's train
   *  snaps to its first path_track and leaves at its speed keyvalue (CBaseEntity's "speed" is m_flSpeed, and
   *  CFuncTrackTrain::Find starts it moving when that is not 0). Returns false for other templates. */
  trainSpawns = 0;
  spawnTrainTemplate(t: Ent, maker: Ent): boolean {
    const names = Object.entries(t.kv).filter(([k]) => /^template\d\d$/.test(k)).map(([, v]) => v.toLowerCase());
    const srcs = names.flatMap(n => (this.io.byName.get(n) || []).filter(e => !e.isCopy));
    // speed is m_flSpeed (a10 carts); startspeed is what StartForward uses (escape_01 tube boxes have speed 0)
    if (!srcs.some(e => e.cls === 'func_tracktrain' && (+(e.kv.speed || 0) !== 0 || +(e.kv.startspeed || 0) !== 0))) return false;
    // catcher templates include a startspeed-500 door train, but they have to be placed with the maker's
    // rotation (a13's angled ball_trap_12). Treating startspeed alone as a cart (f6b9469) stole them from
    // placeTemplateGroup, left the housing unrotated, and the ball bounced off the mouth.
    if (srcs.some(e => e.cls === 'trigger_multiple')) return false;
    const fix = +(t.kv.spawnflags || 0) & 2 ? '' : '&' + String(++this.trainSpawns).padStart(4, '0');
    const R = entityMatrix([0, 0, 0], maker.angles || [0, 0, 0]); const made: Ent[] = [];
    for (const src of srcs) { const kv: Record<string, string> = { ...src.kv };
      const o = add(maker.origin, xformDir(R, sub(src.origin, t.origin))); kv.origin = o.join(' ');
      if (kv.targetname) kv.targetname += fix;
      if (kv.parentname && names.includes(kv.parentname.split(',')[0].toLowerCase())) kv.parentname = kv.parentname.split(',')[0] + fix;
      const n0 = this.io.ents.length; this.spawn(kv); const e = this.io.ents[n0]; if (!e) continue; e.isCopy = true; made.push(e); }
    for (const e of made) if (e.cls === 'func_tracktrain') { const p0 = this.io.find(e.pathName, null, e)[0]; if (!p0) continue;
      const np = add(p0.origin, [0, 0, +(e.kv.height || 0)]); e.pos = np; e.curPath = p0; e.pathName = (p0.kv.target || '').toLowerCase(); if (e.inst) e.inst.matrix = entityMatrix(e.pos, e.angles);
      e.speedNow = +(e.kv.speed || 0); this.io.fire(p0, 'onpass', e); }
    this.io.log.push(`${this.io.time.toFixed(2)} spawned train template ${t.name}${fix} (${made.length} members)`);
    return true;
  }
  /** env_entity_maker for non-cube templates (energy-ball catchers): the template's own copies were removed at load, so the first ForceSpawn
   *  brings them back placed relative to the maker (maker origin + maker rotation applied to each member's offset from the template origin).
   *  Name fixup is skipped: each catcher template is spawned once per map, so the original names stay unique. */
  placeTemplateGroup(t: Ent, maker: Ent) {
    if (t.groupPlaced) return; t.groupPlaced = true;
    const names = Object.entries(t.kv).filter(([k]) => /^template\d\d$/.test(k)).map(([, v]) => v.toLowerCase());
    const R = entityMatrix([0, 0, 0], maker.angles || [0, 0, 0]);
    const place = (o: V3): V3 => add(maker.origin, xformDir(R, sub(o, t.origin)));
    for (const n of names) for (const e of this.io.byName.get(n) || []) {
      if (e.cube) continue;
      // parented members (the caught ball and its sprites) come back too and follow their parent through the hierarchy,
      // which relates them by their spawn matrices, so they land in the same place on the placed parent
      if (e.kv.parentname) { e.killed = false; if (e.prop) e.prop.visible = e.kv.startdisabled !== '1'; this.io.fire(e, 'onspawn', e); continue; }
      // the catcher's door is a func_tracktrain between two of the template's path_tracks: move both; the train was put
      // on its first path at load, so it is placed from there
      const np = place(e.cls === 'func_tracktrain' ? e.pos : e.origin); const M = mul(R, entityMatrix([0, 0, 0], e.angles || [0, 0, 0])); M[12] = np[0]; M[13] = np[1]; M[14] = np[2];
      e.killed = false; e.origin = np; e.pos = [...np] as V3; e.ang = vectorAngles([M[0], M[1], M[2]], [M[8], M[9], M[10]]);
      if (e.model != null && typeof e.model === 'number') { const B = this.bsp.models[e.model]; const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
        for (let k = 0; k < 8; k++) { const c: V3 = [k & 1 ? B.maxs[0] : B.mins[0], k & 2 ? B.maxs[1] : B.mins[1], k & 4 ? B.maxs[2] : B.mins[2]]; const w = xformPoint(M, c); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], w[a]); hi[a] = Math.max(hi[a], w[a]); } }
        e.bmins = lo; e.bmaxs = hi; if (e.inst) e.inst.matrix = M; }
      if (e.prop) { e.prop.matrix = M; e.prop.visible = e.kv.startdisabled !== '1'; e.prop.ambient = this.ambientAt(np); }
      if (e.touching) e.touching.clear();
      this.io.fire(e, 'onspawn', e);
      this.io.log.push(`${this.io.time.toFixed(2)} placed template member ${n} at ${np.map(v => v | 0)}`);
    }
  }
  // ---------- energy balls (point_energy_ball_launcher / prop_energy_ball) ----------
  // Behaviour from the Valve Developer Wiki entity pages: the launcher keeps up to `ballcount` balls alive, respawning after `ballrespawntime`;
  // a ball flies at constant speed, bounces off world geometry, passes through portals (its remaining life is topped up to `minlifeafterportal`),
  // and dies when its `balllifetime` runs out. Catchers are physics-flagged triggers filtered by filter_combineball_type.
  trainCarried = false;
  balls: { ent: Ent; pos: V3; vel: V3; r: number; die: number; launcher: Ent; prop: PropInst }[] = [];
  launchBall(L: Ent) {
    const io = this.io; const f = angleVectors(L.angles || [0, 0, 0]).f; const spd = +(L.kv.minspeed || 200) || 200; const r = +(L.kv.ballradius || 12) || 12;
    const e = new Ent({ classname: 'prop_energy_ball', origin: L.origin.join(' '), model: 'models/effects/combineball.mdl' }); e.game = this; this.io.add(e);
    const prop = this.addProp(e.kv.model, [...L.origin] as V3, [0, 0, 0]);
    // a10's launcher_a sits 0.8 in front of the wall it faces (angles 0 0 0, wall at x 460) with its housing behind it, and
    // in the original its ball crosses the room the other way along the launcher's own y and z (ent_text: 165.3, -1989.9,
    // -196.5). So a ball that would start in solid backs out of it and leaves reversed, as if it had bounced off that wall (a
    // guess at the push-out; the port has no vphysics)
    const box: V3 = [r, r, r], nbox: V3 = [-r, -r, -r]; let pos = ma(L.origin, r + 2, f), dir = f;
    if (this.tr.trace(pos, pos, nbox, box, 0x1 | 0x8, this.playerEnt).startsolid) { dir = scale(f, -1); pos = [...L.origin] as V3;
      for (let k = 0; k < 4 * r && this.tr.trace(pos, pos, nbox, box, 0x1 | 0x8, this.playerEnt).startsolid; k++) pos = ma(pos, 1, dir); }
    const b = { ent: e, pos, vel: scale(dir, spd), r, die: io.time + (+(L.kv.balllifetime || 12) || 12), launcher: L, prop };
    e.ball = b; e.onKill = () => { prop.visible = false; io.log.push(`${io.time.toFixed(2)} energy ball gone at ${b.pos.map(v => v | 0)}${io.time >= b.die ? ' (expired)' : ''}`); this.balls = this.balls.filter(x => x !== b); };
    e.prop = prop; this.playAnim(e, 'idle', true); // combineball.mdl's own looping idle turns its three bones (about 86 deg/s)
    this.balls.push(b); io.fire(L, 'onpostspawnball', e); io.log.push(`${io.time.toFixed(2)} energy ball from ${L.name}`);
  }
  /** a sphere of radius r swept from a to b against body c's oriented box (its half-sizes grown by r, slab test in the
   *  box's frame): entry fraction and world normal, or null */
  ballVsBody(a: V3, b: V3, r: number, c: Cube): { f: number; n: V3 } | null {
    const R = c.R, he: V3 = c.he ? c.he : [c.h, c.h, c.h], ctr = c.pos;
    const loc = (v: V3): V3 => { const d = sub(v, ctr); return [d[0] * R[0] + d[1] * R[1] + d[2] * R[2], d[0] * R[4] + d[1] * R[5] + d[2] * R[6], d[0] * R[8] + d[1] * R[9] + d[2] * R[10]]; };
    const A = loc(a), B = loc(b); let enter = -1, leave = 1, ax = -1, sg = 0;
    for (let k = 0; k < 3; k++) { const e = he[k] + r, d = B[k] - A[k];
      if (Math.abs(d) < 1e-9) { if (A[k] < -e || A[k] > e) return null; continue; }
      let t0 = (-e - A[k]) / d, t1 = (e - A[k]) / d, s = -1; if (t0 > t1) { [t0, t1] = [t1, t0]; s = 1; }
      if (t0 > enter) { enter = t0; ax = k; sg = s; } if (t1 < leave) leave = t1; if (enter > leave) return null; }
    if (ax < 0 || enter < 0 || enter > 1) return null;   // starting inside (or no hit this step): let it pass
    const n: V3 = [sg * R[ax * 4], sg * R[ax * 4 + 1], sg * R[ax * 4 + 2]]; return { f: Math.max(0, enter - 1e-4), n };
  }
  updateBalls(dt: number) {
    const io = this.io;
    for (const L of io.ents) if (L.cls === 'point_energy_ball_launcher' && !L.killed) {
      if (!L.ballInit) { L.ballInit = true; if (+(L.kv.spawnflags || 0) & 4096) L.enabled = false; }
      const alive = this.balls.filter(b => b.launcher === L).length;
      if (L.enabled && alive < (+(L.kv.ballcount || 1) || 1)) { if (L.nextBall === undefined) L.nextBall = io.time + 0.5; if (io.time >= L.nextBall) { this.launchBall(L); L.nextBall = io.time + (+(L.kv.ballrespawntime || 2)); } }
      else if (alive) L.nextBall = io.time + (+(L.kv.ballrespawntime || 2));
    }
    const mask = 0x1 | 0x2 | 0x8 | 0x4000, skip = new Set<any>([this.playerEnt, ...this.cubes.map(c => c.ent)]);
    for (const b of [...this.balls]) {
      if (io.time >= b.die) { b.ent.killed = true; b.ent.onKill?.(); continue; }
      const mins: V3 = [-b.r, -b.r, -b.r], maxs: V3 = [b.r, b.r, b.r]; let left = dt; const prev: V3 = [...b.pos] as V3;
      for (let it = 0; it < 4 && left > 1e-4; it++) {
        this.tr.ignore = this.tunnelFor(b.pos, mins, maxs);
        const want = ma(b.pos, left, b.vel); const t = this.tr.trace(b.pos, want, mins, maxs, mask, skip);
        // cubes and turrets are oriented boxes: sweep the ball in each body's own frame, so a turned cube deflects it
        // sideways (a13's box-bounce catcher), where the axis-aligned box could only send it straight back
        for (const c of this.cubes) { if (!c.alive) continue; const hit = this.ballVsBody(b.pos, want, b.r, c); if (hit && hit.f < t.fraction) { t.fraction = hit.f; t.normal = hit.n; t.startsolid = false; t.ent = c.ent; t.end = ma(b.pos, hit.f, sub(want, b.pos)); } }
        if (t.startsolid) { b.pos = want; break; }
        b.pos = t.end; left *= 1 - t.fraction; if (t.fraction >= 1) break;
        const n = t.normal; const vn = dot(b.vel, n); b.vel = ma(b.vel, -2 * vn, n); b.pos = ma(b.pos, 0.5, n);
      }
      this.tr.ignore = null;
      for (const p of this.portals) if (p.open && p.linked && p.linked.open && this.crossed(p, prev, b.pos)) {
        const M = throughPortal(p, p.linked); b.pos = xformPoint(M, b.pos); b.vel = xformDir(M, b.vel);
        b.die = Math.max(b.die, io.time + (+(b.launcher.kv.minlifeafterportal || 6))); io.log.push(`${io.time.toFixed(2)} energy ball through ${p.name} at ${b.pos.map(v => v | 0)}`); break; }
      b.ent.pos = b.pos; b.ent.origin = b.pos;
      // combineball.mdl is built to be seen from one side: its glow cards are flat and the shell is a dome, facing -y in
      // the bind pose, and the idle's base bone turns that to +x. So the ball keeps its +x on the viewer, or most
      // directions show a sliver (checks/energy-ball.ctl)
      { const v = sub(this.player.eye(), b.pos); b.prop.matrix = entityMatrix(b.pos, [-Math.atan2(v[2], Math.hypot(v[0], v[1])) * 180 / Math.PI, Math.atan2(v[1], v[0]) * 180 / Math.PI, 0]); }
    }
  }
  // ---------- rocket turrets (npc_rocket_turret / rocket_turret_projectile) ----------
  // Behaviour from the public FGD (Enable/Disable/Toggle/SetTarget/Destroy, OnFoundTarget/OnLostTarget) plus
  // timings measured in the original on escape_01 (see ROCKET_TURRET). The barrel attachment's +x is the muzzle
  // (at rest it points entity -Y; yaw 90 turns it west, which is how laser_1 faces the office window).
  spawnRocketTurret(e: Ent) {
    const kv = e.kv; kv.model ||= 'models/props_bts/rocket_sentry.mdl';
    e.prop = this.addProp(kv.model, e.origin, e.angles, +(kv.skin || 0)); e.prop.poses = [0, 0];
    const off = !!(+(kv.spawnflags || 0) & 1);
    e.rocketEnabled = !off; e.rocketDestroyed = false; e.rocketHadTarget = false; e.nextRocket = 0;
    this.playAnim(e, off ? 'inactive' : 'idle', true); if (!off) e.defaultAnim = 'idle';
    this.rocketTurrets.push(e);
  }
  enableRocketTurret(e: Ent) {
    if (e.rocketEnabled && !e.rocketDestroyed) return;
    e.rocketDestroyed = false; e.rocketEnabled = true;
    e.nextRocket = this.io.time + ROCKET_TURRET.firstFire; e.defaultAnim = 'idle';
    this.playAnim(e, 'open', false);
  }
  disableRocketTurret(e: Ent) {
    if (!e.rocketEnabled && !e.rocketDestroyed) return;
    e.rocketEnabled = false; if (e.rocketHadTarget) { e.rocketHadTarget = false; this.io.fire(e, 'onlosttarget', e); }
    e.defaultAnim = 'inactive'; this.playAnim(e, 'close', false);
  }
  rocketTargetPos(e: Ent): V3 | null {
    const n = (e.rocketTarget || '').toLowerCase();
    if (n && n !== '!player') { const t = this.io.find(n, null, e)[0]; if (t && !t.killed) return t.pos || t.origin; return null; }
    if (this.dead) return null;
    const pl = this.player; return [pl.pos[0], pl.pos[1], pl.pos[2] + pl.maxs()[2] / 2];
  }
  updateRocketTurrets(dt: number) {
    const now = this.io.time;
    for (const e of this.rocketTurrets) {
      if (e.killed || e.rocketDestroyed || !e.rocketEnabled) continue;
      const pr = e.prop, m = pr?.model; if (!pr || !m) continue;
      const P = pr.poses ??= [0, 0];
      const att = m.data.attachments.findIndex(a => a.name.toLowerCase() === 'barrel'); if (att < 0) continue;
      const seq = m.skel.seqs[pr.seq ?? 0]?.name || '';
      if (seq === 'open' && (pr.cycle ?? 0) < 1) continue;
      const W = this.entWorld(e), target = this.rocketTargetPos(e);
      let vis = false;
      if (target) {
        const f = attachFrame(m, att, P), eye = xformPoint(W, f.pos);
        const to = sub(target, eye), dist = len(to);
        if (dist > 1 && dist < ROCKET_TURRET.range) {
          this.tr.ignore = null;
          // WINDOW glass (escape_01 office panes are TRANSLUCENT|WINDOW) must not block LOS: the original fires through it
          const hit = this.tr.trace(eye, target, [0, 0, 0], [0, 0, 0], MASK_BLOCKLOS, this.playerEnt);
          vis = hit.fraction > 0.98;
          if (vis) aimAttachment(m, att, P, xformDir(invertRigid(W), scale(to, 1 / dist)), dt, ROCKET_TURRET.turnPerSec, true);
        }
      }
      if (vis && !e.rocketHadTarget) { e.rocketHadTarget = true; this.io.fire(e, 'onfoundtarget', e); }
      if (!vis && e.rocketHadTarget) { e.rocketHadTarget = false; this.io.fire(e, 'onlosttarget', e); }
      if (e.nextRocket && now >= e.nextRocket - ROCKET_TURRET.loadAhead && now < e.nextRocket && seq !== 'load' && seq !== 'fire') {
        this.playAnim(e, 'load', false); this.snd?.play('NPC_RocketTurret.LockingBeep', e.origin);
      }
      if (e.nextRocket && now >= e.nextRocket && vis) {
        this.snd?.play('NPC_FloorTurret.LockedBeep', e.origin);
        this.fireRocket(e); e.nextRocket = now + ROCKET_TURRET.interval;
        this.playAnim(e, 'fire', false); this.snd?.play('NPC_FloorTurret.RocketFire', e.origin);
      }
    }
  }
  fireRocket(e: Ent) {
    const pr = e.prop; if (!pr) return;
    const M = this.attachWorld(pr, 'barrel');
    const dir = M ? norm([M[0], M[1], M[2]]) : angleVectors(e.ang || e.angles).f;
    const pos0 = M ? [M[12], M[13], M[14]] as V3 : (e.pos || e.origin);
    const pos = ma(pos0, 8, dir), r = ROCKET_TURRET.radius, io = this.io;
    const ent = new Ent({ classname: 'rocket_turret_projectile', origin: pos.join(' '), model: 'models/props_bts/rocket.mdl' });
    ent.game = this; this.io.add(ent);
    const prop = this.addProp(ent.kv.model, [...pos] as V3, vectorAngles(dir));
    const rk = { ent, pos, vel: scale(dir, ROCKET_TURRET.speed), r, die: io.time + 20, prop, dead: false };
    ent.prop = prop; ent.onKill = () => { prop.visible = false; this.rockets = this.rockets.filter(x => x !== rk); };
    this.rockets.push(rk); this.snd?.play('NPC_FloorTurret.RocketFlyLoop', pos);
    io.log.push(`${io.time.toFixed(2)} rocket from ${e.name || 'rocket turret'} at ${pos.map(v => v | 0)}`);
  }
  explodeRocket(rk: { ent: Ent; pos: V3; vel: V3; r: number; prop: PropInst; dead?: boolean }, at: V3, hit?: Ent | null) {
    if (rk.dead) return; rk.dead = true;
    const io = this.io; io.log.push(`${io.time.toFixed(2)} rocket exploded at ${at.map(v => v | 0)}`);
    const dir = len(rk.vel) > 1 ? norm(rk.vel) : [0, 0, 1] as V3;
    const pl = this.player, pc: V3 = [pl.pos[0], pl.pos[1], pl.pos[2] + pl.maxs()[2] / 2];
    if (!this.dead && len(sub(pc, at)) < ROCKET_TURRET.blast) this.hurtPlayer(ROCKET_TURRET.damage, dir, true);
    if (hit && hit.cls === 'func_breakable_surf' && !hit.killed) { hit.killed = true; if (hit.inst) hit.inst.visible = false; io.fire(hit, 'onbreak', rk.ent); }
    // the direct hit is skipped in the radius loop below, so fire OnTakeDamage
    // here — otherwise a rocket that lands on glados_body never increments
    // brain_ganglia_hit_count
    if (hit && !hit.killed && hit.outputs.get('ontakedamage') && (!hit.kv.damagefilter || this.passDamageFilter(hit, 64)))
      io.fire(hit, 'ontakedamage', rk.ent);
    const rad = ROCKET_TURRET.blast;
    for (const ent of io.ents) {
      if (ent.killed || ent === hit) continue;
      const o = ent.pos || ent.origin;
      const near = len(sub(o, at)) <= rad || !!(ent.bmins && at[0] >= ent.bmins[0] - rad && at[0] <= ent.bmaxs[0] + rad && at[1] >= ent.bmins[1] - rad && at[1] <= ent.bmaxs[1] + rad && at[2] >= ent.bmins[2] - rad && at[2] <= ent.bmaxs[2] + rad);
      if (!near) continue;
      if (ent.cls === 'func_breakable_surf') { ent.killed = true; if (ent.inst) ent.inst.visible = false; io.fire(ent, 'onbreak', rk.ent); continue; }
      // a damagefilter, if present, must pass (rockets are DMG_BLAST = 64); entities
      // with no filter still get OnTakeDamage (escape_02's glados_body has the output
      // and no filter — requiring a filter meant rockets never registered a hit)
      if (ent.outputs.get('ontakedamage') && (!ent.kv.damagefilter || this.passDamageFilter(ent, 64))) io.fire(ent, 'ontakedamage', rk.ent);
    }
    rk.ent.killed = true; rk.ent.onKill?.();
  }
  passDamageFilter(e: Ent, dmgType: number) {
    if (!e.kv.damagefilter) return true;
    const f = this.io.find(e.kv.damagefilter, null, e)[0]; if (!f) return true;
    let ok = true;
    if (f.cls === 'filter_damage_type') ok = +f.kv.damagetype === dmgType;
    if (f.kv.negated === '1') ok = !ok; return ok;
  }
  updateRockets(dt: number) {
    const mask = 0x1 | 0x2 | 0x8 | 0x4000, io = this.io;
    const pl = this.player, pmin = add(pl.pos, HULL.mins), pmax = add(pl.pos, pl.maxs());
    for (const rk of [...this.rockets]) {
      if (rk.dead || io.time >= rk.die) { if (!rk.dead) { rk.dead = true; rk.ent.killed = true; rk.ent.onKill?.(); } continue; }
      const mins: V3 = [-rk.r, -rk.r, -rk.r], maxs: V3 = [rk.r, rk.r, rk.r]; let left = dt;
      for (let it = 0; it < 4 && left > 1e-4 && !rk.dead; it++) {
        const prev: V3 = [...rk.pos] as V3;
        this.tr.ignore = this.tunnelFor(rk.pos, mins, maxs);
        const want = ma(rk.pos, left, rk.vel); const t = this.tr.trace(rk.pos, want, mins, maxs, mask, this.playerEnt);
        const lo: V3 = [pmin[0] - rk.r, pmin[1] - rk.r, pmin[2] - rk.r], hi: V3 = [pmax[0] + rk.r, pmax[1] + rk.r, pmax[2] + rk.r];
        // noclipped players are not solid (the original's noclip ignores the hull); a portal in the same tick as a
        // wall or the player is taken if the hole is closer than the first solid, so a rocket can leave through a
        // portal the way an energy ball does
        const plHit = !this.dead && !pl.noclip && segHitsBox(rk.pos, t.end, lo, hi);
        let went: Portal | null = null, cf = 2;
        for (const portal of this.portals) if (portal.open && portal.linked && portal.linked.open) {
          const da = dot(sub(prev, portal.pos), portal.f), db = dot(sub(want, portal.pos), portal.f);
          if (!(da >= 0 && db < 0)) continue;
          const frac = da / (da - db), x = add(prev, scale(sub(want, prev), frac)), d = sub(x, portal.pos);
          const lr = dot(d, portal.r) / PW, lu = dot(d, portal.u) / PH;
          if (lr * lr + lu * lu <= 1.05 && frac < cf) { cf = frac; went = portal; }
        }
        let plF = 2;
        if (plHit) { let t0 = 0, t1 = 1; for (let k = 0; k < 3; k++) { const d = t.end[k] - prev[k]; if (Math.abs(d) < 1e-9) continue; let u = (lo[k] - prev[k]) / d, v = (hi[k] - prev[k]) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); } plF = t0; }
        const hitF = t.startsolid ? 0 : t.fraction;
        if (went && went.linked && cf <= hitF + 1e-4 && cf <= plF + 1e-4) {
          const X = throughPortal(went, went.linked), past = add(prev, scale(sub(want, prev), Math.min(1, cf + 1e-3)));
          rk.pos = xformPoint(X, past); rk.vel = xformDir(X, rk.vel);
          io.log.push(`${io.time.toFixed(2)} rocket through ${went.name} at ${rk.pos.map(v => v | 0)}`);
          left *= 1 - cf; continue;
        }
        if (plHit || t.fraction < 1 || t.startsolid) {
          rk.pos = plHit ? ma(rk.pos, Math.max(0, Math.min(1, plF)), sub(t.end, rk.pos)) : t.end; rk.ent.pos = rk.pos; rk.ent.origin = rk.pos;
          this.explodeRocket(rk, rk.pos, t.ent || null); break;
        }
        rk.pos = t.end; left = 0;
      }
      if (!rk.dead) {
        rk.ent.pos = rk.pos; rk.ent.origin = rk.pos; rk.prop.matrix = entityMatrix(rk.pos, vectorAngles(norm(rk.vel)));
        // glados_body (and any other OnTakeDamage target) is a skinned prop with no
        // solid hull, so a rocket that flies through her would otherwise detonate on
        // the ceiling past her. Treat a pass within the blast radius as a hit.
        for (const ent of io.ents) {
          if (ent.killed || ent === rk.ent || !ent.outputs.get('ontakedamage')) continue;
          const o = ent.pos || ent.origin; if (!o) continue;
          if (len(sub(o, rk.pos)) <= ROCKET_TURRET.blast) { this.explodeRocket(rk, rk.pos, ent); break; }
        }
      }
    }
    this.tr.ignore = null;
  }
  prevPath(p: Ent) { return this.io.ents.find(q => q.cls === 'path_track' && !q.killed && (q.kv.target || '').toLowerCase() === p.name) || null; }
  respawnTemplate(t: Ent, maker: Ent | null) {
    // point_template: spawn fresh copies of the template entities (only physics cubes matter for these maps), each at its
    // offset from the template origin, moved and turned with the maker, as CPointTemplate::CreateInstance in the public SDK
    // 2013 point_template.cpp does. Measured in the original with oracle-ctl and ent_text: a09's box_maker puts its cube at
    // the template cube's own place (1083.2, -771.2, 500.4; its maker sits on the template origin), and a second ForceSpawn
    // lands on top of it and gets pushed aside; a08's maker makes both template cubes, each at its own place. a02's maker
    // would put its cube at (-27, 111), mostly inside the walls of the glass drop tube, and in the original it ends up in
    // the tube at the maker's x, y (0.4, 80.1); vphysics pushes it out of the walls. The port has no such push-out, so a
    // copy that would start in solid goes to the maker's origin instead (a guess that matches a02; tested with a 40-unit box, about the cube model's size).
    const names = Object.entries(t.kv).filter(([k]) => /^template\d\d$/.test(k)).map(([, v]) => v.toLowerCase());
    const R = maker ? entityMatrix([0, 0, 0], maker.angles || [0, 0, 0]) : null;
    const srcs = names.flatMap(n => (this.io.byName.get(n) || []).filter(e => e.cube && !e.isCopy));
    const solid = (q: V3) => this.tr.trace(q, q, [-20, -20, -20], [20, 20, 20], 0x1 | 0x8 | 0x4000, this.playerEnt).startsolid;
    const place = (o: V3): V3 => { if (!maker) return [...o] as V3; const q = add(maker.origin, xformDir(R!, sub(o, t.origin))); return srcs.length === 1 && solid(q) && !solid(maker.origin) ? [...maker.origin] as V3 : q; };
    for (const n of names) for (const src of this.io.byName.get(n) || []) {
      if (src.cls === 'weapon_portalgun' && !src.picked) { src.killed = false; if (src.prop) src.prop.visible = true; this.io.log.push(`${this.io.time.toFixed(2)} spawned ${n} (portal gun)`); continue; } // a07: the next map's gun is a template spawned on new game
      if (!src.cube || src.isCopy) continue;
      const kv = { ...src.kv, origin: place(src.origin).join(' ') }; if (!(+t.kv.spawnflags & 2)) delete (kv as any).targetname;
      const e = new Ent(kv); e.isCopy = true; e.game = this; e.pos = [...e.origin] as V3; this.io.add(e); this.spawnCube(e);
      this.io.log.push(`${this.io.time.toFixed(2)} spawned ${n} at ${e.origin.map(v => v | 0)}`);
    }
  }
  // ---------- per-tick update ----------
  /** start a sequence by name on a prop entity (applied once the model has loaded) */
  /** current world matrix of an entity (brush, prop, mover or point) */
  entWorld(e: Ent): Float32Array { if (e.worldM && e.kv.parentname) return e.worldM; return entityMatrix(e.pos || e.origin, e.ang || e.angles); }
  /** an attachment's world matrix on a prop in its current pose (sequence, cycle, fades and pose parameters): the
   *  attachment's local matrix on its bone, then the prop's matrix. Bones are cached until the pose changes. */
  attachWorld(pr: PropInst, name: string): Float32Array | null {
    const m = pr.model; if (!m || pr.seq === undefined) return null; const n = name.toLowerCase();
    const a = m.data.attachments.find(a => a.name.toLowerCase() === n); if (!a) return null;
    const fades = pr.fades?.length ? pr.fades.map(f => ({ seq: f.seq, cycle: f.cycle, weight: f.weight })) : undefined, poses = pr.poses;
    const key = pr.seq + ':' + (pr.cycle || 0) + (fades ? '|' + fades.map(f => f.seq + ':' + f.cycle + ':' + f.weight).join(',') : '') + (poses ? '|' + poses.join(',') : '');
    if (pr.boneCache?.key !== key) pr.boneCache = { key, M: boneMatrices(m.skel, pr.seq, pr.cycle || 0, fades || poses ? { fades, poses: poses?.slice() } : undefined) };
    const B = pr.boneCache.M, b = a.bone * 12, A = a.m, L = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) L[c * 4 + r] = B[b + r * 4] * A[c] + B[b + r * 4 + 1] * A[4 + c] + B[b + r * 4 + 2] * A[8 + c] + (c === 3 ? B[b + r * 4 + 3] : 0);
    L[15] = 1; return mul(pr.matrix, L);
  }
  /** switch a prop to sequence si, cross-fading from the old one */
  startSeq(pr: PropInst, m: GLModel, si: number) {
    const nsq = m.skel.seqs[si];
    if ((nsq.flags & F.SNAP) || this.r.animFades === false) pr.fades = [];
    else if (pr.seq !== undefined && m.skel.seqs[pr.seq]) { const fade = Math.min(m.skel.seqs[pr.seq].fadeout, nsq.fadein);
      if (fade > 0) (pr.fades ??= []).push({ seq: pr.seq, cycle: pr.cycle || 0, rate: pr.rate || 0, age: 0, fade, weight: 1 }); }
    pr.seq = si; pr.cycle = 0; if (pr.restPose) { pr.rate = 1; pr.restPose = false; } pr.rate = pr.rate ?? 1; pr.loop = nsq.looping;
  }
  /** the first-person portal gun (v_portalgun.mdl): drawn by the renderer's viewmodel pass, matrix set to the eye each
   * frame. Sequences by activity: ACT_VM_DRAW when the gun is first held, PRIMARYATTACK per shot, FIZZLE when a
   * cleanser takes the portals, PICKUP / RELEASE around carrying an object (held on PICKUP's last frame meanwhile),
   * IDLE otherwise. */
  vm: PropInst | null = null; private vmHeld = false;
  vmPlay(act: string, then: string | null = 'act_vm_idle') {
    const pr = this.vm, m = pr?.model; if (!pr || !m) return; const si = findSeq(m, act); if (si < 0) return;
    this.startSeq(pr, m, si); pr.onDone = then ? () => this.vmPlay(then, null) : undefined;
  }
  updateViewModel() {
    if (this.hasGun && !this.vm) { const pr: PropInst = this.vm = { model: null, matrix: m4(), visible: true, skin: 0, ambient: [1, 1, 1] }; this.r.viewModel = pr;
      this.models.get('models/weapons/v_portalgun.mdl').then(m => { pr.model = m; this.vmPlay('act_vm_draw'); }); }
    const pr = this.vm; if (!pr) return; pr.visible = this.hasGun;
    const held = !!this.held; if (held !== this.vmHeld) { this.vmHeld = held; if (held) this.vmPlay('act_vm_pickup', null); else this.vmPlay('act_vm_release'); }
  }
  playAnim(e: Ent, name: string, isDefault: boolean) {
    const pr = e.prop; if (!pr || !name) return;
    const apply = () => { const m = pr.model; if (!m) return; const si = findSeq(m, name); if (si < 0) return;
      // the sequence being left keeps playing and fades out over min(its fadeout, the new one's fadein), 0.2 s by
      // default, unless the new sequence is STUDIO_SNAP (CSequenceTransitioner::CheckForSequenceChange in the SDK)
      this.startSeq(pr, m, si);
      pr.onDone = isDefault ? undefined : () => { this.io.fire(e, 'onanimationdone', e); const d = e.defaultAnim !== undefined ? e.defaultAnim : e.kv.defaultanim; /* SetDefaultAnimation with an empty value clears it */ if (d && d.toLowerCase() !== name.toLowerCase()) this.playAnim(e, d, true); }; };
    if (pr.model) apply(); else this.models.get(e.kv.model).then(apply);
  }
  /** prop_dynamics whose model lists bone followers (box_dropper_cover's flaps and arms) */
  followerProps: Ent[] = [];
  /** bone followers: each listed bone's .phy piece follows the bone in the prop's current pose and blocks like a brush
   *  (SDK 2013 CBoneFollowerManager: one static physics shadow per bone, moved to the bone every frame). Pieces are
   *  convex: their own planes plus axial bevels of their world bounds. */
  updateFollowers() {
    for (const e of this.followerProps) { const pr = e.prop as PropInst | undefined, m = pr?.model; if (!pr || !m || !m.followers?.length || pr.seq === undefined) continue;
      const on = !e.killed && pr.visible !== false && !e.noCollide;
      const key = pr.posed + '|' + Array.from(pr.matrix).map(v => v.toFixed(2)).join(',');
      if (e.hullKey === key) { for (const h of e.hulls) h.on = on; continue; } e.hullKey = key;
      const fades = pr.fades?.length ? pr.fades.map(f => ({ seq: f.seq, cycle: f.cycle, weight: f.weight })) : undefined, poses = pr.poses;
      const B = boneMatrices(m.skel, pr.seq, pr.cycle || 0, fades || poses ? { fades, poses: poses?.slice() } : undefined), P = pr.matrix;
      if (!e.hulls) { e.hulls = []; for (const f of m.followers) for (const _ of f.pieces) { const h = { planes: [], mins: [0, 0, 0] as V3, maxs: [0, 0, 0] as V3, ent: e, on }; e.hulls.push(h); this.tr.hulls.push(h); } }
      let hi = 0;
      for (const f of m.followers) { const b = f.bone * 12;
        // bone (3x4 row-major, model space) then the prop's matrix (column-major)
        const W = new Float32Array(12); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) W[r * 4 + c] = P[r] * B[b + c] + P[4 + r] * B[b + 4 + c] + P[8 + r] * B[b + 8 + c] + (c === 3 ? P[12 + r] : 0);
        const xf = (v: number[]): V3 => [W[0] * v[0] + W[1] * v[1] + W[2] * v[2] + W[3], W[4] * v[0] + W[5] * v[1] + W[6] * v[2] + W[7], W[8] * v[0] + W[9] * v[1] + W[10] * v[2] + W[11]];
        const rot = (n: number[]): V3 => { const v: V3 = [W[0] * n[0] + W[1] * n[1] + W[2] * n[2], W[4] * n[0] + W[5] * n[1] + W[6] * n[2], W[8] * n[0] + W[9] * n[1] + W[10] * n[2]]; const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
        for (const pc of f.pieces) { const h = e.hulls[hi++], vs = pc.verts.map(xf), mn: V3 = [1e9, 1e9, 1e9], mx: V3 = [-1e9, -1e9, -1e9];
          for (const v of vs) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }
          const planes = pc.planes.map(q => { const n = rot(q.n), p0 = xf([q.n[0] * q.d, q.n[1] * q.d, q.n[2] * q.d]); return { n, d: n[0] * p0[0] + n[1] * p0[1] + n[2] * p0[2] }; });
          for (let k = 0; k < 3; k++) { const a: V3 = [0, 0, 0], c: V3 = [0, 0, 0]; a[k] = 1; c[k] = -1; planes.push({ n: a, d: mx[k] }, { n: c, d: -mn[k] }); }
          h.planes = planes; h.mins = mn; h.maxs = mx; h.on = on; } } }
  }
  animateProps(dt: number) { for (const pr of this.r.props) this.animateProp(pr, dt); if (this.vm) this.animateProp(this.vm, dt); }
  animateProp(pr: PropInst, dt: number) {
    { const m = pr.model; if (!m || pr.seq === undefined) return;
      // hidden props keep animating, as the server's frame advance does for EF_NODRAW entities; only skinning waits
      const sk = m.skel, sq = sk.seqs[pr.seq]; if (!sq) return;
      const dur = Math.max(1, sq.frames - 1) / (sq.fps || 30);
      if (sq.frames > 1 && pr.rate) { let c = (pr.cycle || 0) + dt * pr.rate / dur;
        if (c >= 1) { if (pr.loop) c %= 1; else c = 1; } pr.cycle = c; /* before onDone, which may start the next sequence at cycle 0 */
        if (c >= 1 && !pr.loop && pr.onDone) { const f = pr.onDone; pr.onDone = undefined; f(); } }
      if (pr.fades?.length) { for (const f of pr.fades) { const fs = sk.seqs[f.seq]; f.age += dt;
          if (fs && fs.frames > 1 && f.rate) { const c = f.cycle + dt * f.rate * (fs.fps || 30) / (fs.frames - 1); f.cycle = fs.looping ? c - Math.floor(c) : Math.min(1, c); }
          const s = 1 - f.age / f.fade; f.weight = s <= 0 ? 0 : s >= 1 ? 1 : 3 * s * s - 2 * s * s * s; /* C_AnimationLayer::GetFadeout's spline */ }
        pr.fades = pr.fades.filter(f => f.weight > 0); }
      if (!pr.visible) return;   // C_BaseAnimating::DoAnimationEvents skips invisible entities too
      if (sq.events.length) this.animEvents(pr, sq);
      const fades = pr.fades?.length ? pr.fades.map(f => ({ seq: f.seq, cycle: f.cycle, weight: f.weight })) : undefined, poses = pr.poses?.slice();
      const key = pr.seq + ':' + (pr.cycle || 0).toFixed(3) + (fades ? '|' + fades.map(f => f.seq + ':' + f.cycle.toFixed(3) + ':' + f.weight.toFixed(3)).join(',') : '') + (poses ? '|' + poses.map(v => v.toFixed(2)).join(',') : '');
      // skinning is left to the renderer, which runs it once, only when the prop is actually drawn (it used to run
      // every 1/66 s tick even off screen: GLaDOS's 21k-vertex body cost about 0.57 ms per tick in escape_02)
      if (pr.posed !== key) { const seq = pr.seq, cyc = pr.cycle || 0, ex = fades || poses ? { fades, poses } : undefined; pr.posed = key; pr.repose = () => { pr.repose = undefined; pr.skinned = skinModel(this.r.gl, m, pr.skinned || null, seq, cyc, ex); }; }
    }
  }
  /** client animation events, run as C_BaseAnimating::DoAnimationEvents does: a new sequence starts from just before
   * cycle 0 so frame-0 events fire; events fire once as the cycle passes them; a wrap of more than half a cycle runs the
   * rest of the old loop first. Only client events (new-style AE_CL_*, or old-style numbers from 5000) are run. */
  animEvents(pr: PropInst, sq: Seq) {
    let cur = pr.cycle || 0;
    if (pr.evSeq !== pr.seq) { pr.evSeq = pr.seq; cur = 0; pr.evPrev = -0.01; }
    let prev = pr.evPrev ?? -0.01; if (cur === prev) return;
    const client = (e: SeqEvent) => e.name ? e.name.startsWith('AE_CL_') : e.event >= 5000;
    if (cur <= prev) { if (prev - cur <= 0.5) return; for (const e of sq.events) if (client(e) && e.cycle > prev) this.animEvent(pr, sq, e); prev = cur - 0.001; }
    for (const e of sq.events) if (client(e) && e.cycle > prev && e.cycle <= cur) this.animEvent(pr, sq, e);
    pr.evPrev = cur;
  }
  /** fired animation events, newest last, for the harness */ animEventLog: { t: number; model: string; seq: string; cycle: number; ev: string; options: string }[] = [];
  animEvent(pr: PropInst, sq: Seq, e: SeqEvent) {
    const ev = e.name || String(e.event), log = this.animEventLog; log.push({ t: +this.r.time.toFixed(3), model: pr.model?.data.name || '', seq: sq.name, cycle: e.cycle, ev, options: e.options }); if (log.length > 200) log.shift();
    const M = pr.matrix, at: V3 = [M[12], M[13], M[14]], sounds = (pr as any).evSounds ??= new Map<string, { stop(): void }>();
    if (ev === 'AE_CL_PLAYSOUND' || ev === '5004') { const h = this.snd?.play(e.options, at); if (h) { sounds.get(e.options.toLowerCase())?.stop(); sounds.set(e.options.toLowerCase(), h); } }
    else if (ev === 'AE_CL_STOPSOUND') { sounds.get(e.options.toLowerCase())?.stop(); sounds.delete(e.options.toLowerCase()); }
  }
  /** security cameras follow the player's eye while they can see it (see src/npc.ts) */
  updateCameras(dt: number) {
    const eye = this.player.eye(), TURN = 90 * dt; // degrees per second
    for (const e of this.cameras) { const pr = e.prop, m = pr?.model; if (!pr || !m || e.killed || !pr.visible || e.camDisabled) continue;
      const t = aimTable(m); if (!t) continue;
      if (!e.camInit) { e.camInit = true; pr.poses = [...t.rest]; }   // spawn looking straight out, not at pose 0 (straight down)
      const W = this.entWorld(e), lens = xformPoint(W, t.lensPos), to = sub(eye, lens), dist = len(to);
      const local = xformDir(invertRigid(W), scale(to, 1 / (dist || 1)));
      let goal = t.rest;
      if (dist < 2048 && local[0] > -0.2 && this.tr.ray(lens, eye, MASK_SHOT_PORTAL).fraction > 0.98) goal = aimFor(t, local as V3, e.prop.poses);
      const P = pr.poses ??= [0, 0]; P[0] = approach(P[0], goal[0], TURN); P[1] = approach(P[1], goal[1], TURN); e.camSees = goal !== t.rest; }
  }
  shakes: { amplitude: number; frequency: number; duration: number; next: number; end: number; offset: V3; angle: number }[] = [];
  shakeOffset: V3 = [0, 0, 0]; shakeRoll = 0;
  /** CViewEffects::CalcShake (SDK 2013 view_effects.cpp): each shake re-picks a random offset and roll 'frequency' times a
   *  second, scaled by a sine whose frequency rises as the shake runs out and by the squared remaining fraction */
  updateShake(dt: number) {
    const now = this.io.time; const off: V3 = [0, 0, 0]; let roll = 0;
    this.shakes = this.shakes.filter(s => !(now > s.end || s.duration <= 0 || s.amplitude <= 0 || s.frequency <= 0));
    for (const s of this.shakes) {
      if (now > s.next) { s.next = now + 1 / s.frequency; for (let k = 0; k < 3; k++) s.offset[k] = (Math.random() * 2 - 1) * s.amplitude; s.angle = (Math.random() * 2 - 1) * s.amplitude * 0.25; }
      let fr = (s.end - now) / s.duration; const freq = fr ? s.frequency / fr : 0; fr *= fr; fr *= Math.sin(Math.min(1e8, now * freq));
      off[0] += s.offset[0] * fr; off[1] += s.offset[1] * fr; off[2] += s.offset[2] * fr; roll += s.angle * fr;
      s.amplitude -= s.amplitude * (dt / (s.duration * s.frequency));
    }
    this.shakeOffset = off; this.shakeRoll = roll;
  }
  lastDt = 1 / 66; /** the floor-into-wall gravity tick above (a switch, so scripts can be compared with it off) */ wallFlingTick = true;
  update(dt: number, input: { fwd: number; side: number; jump: boolean; duck: boolean }) {
    this.lastDt = dt; const eyeAtStart: V3 = this.player.eye();
    this.updateShake(dt); this.updateCameras(dt); this.updateViewModel(); this.animateProps(dt); this.updateFollowers(); this.r.time += dt;
    const io = this.io; io.update(dt);
    for (const e of io.ents) {
      if (e.killed) continue;
      if (e.cls === 'logic_timer' && e.enabled) { e.next -= dt; if (e.next <= 0) { io.fire(e, 'ontimer', null); const lo = +(e.kv.lowerrandombound || 0), hi = +(e.kv.upperrandombound || 0);
        e.next = e.kv.userandomtime === '1' ? lo + Math.random() * (hi - lo) : +(e.kv.refiretime || 1); if (e.next <= 0) e.next = 1; } }
      if (e.cls === 'func_door' && e.moving) {
        const dist = len(sub(e.openPos, e.closedPos)) || 1; const step = (e.moveSpeed ?? e.speed) * dt / dist; const tgt = e.state;
        const before = e.t; e.t = tgt ? Math.min(1, e.t + step) : Math.max(0, e.t - step);
        // don't crush: if the door would move into the player, stop for this tick
        // a door riding a parent (e.g. a10's pillar lifts) has its world position from the hierarchy pass; step that by
        // this tick's travel, or the crush test below compares a spawn-frame position with a world one and throws the player
        const riding = !!(e.kv.parentname && e.worldM && !(+e.kv.spawnflags & 1));
        const np = riding ? add(e.pos, scale(sub(e.openPos, e.closedPos), e.t - before)) : add(e.closedPos, scale(sub(e.openPos, e.closedPos), e.t)); const old = e.pos.slice(); e.pos[0] = np[0]; e.pos[1] = np[1]; e.pos[2] = np[2];
        this.tr.ignore = null; const pt = this.tr.trace(this.player.pos, this.player.pos, HULL.mins, this.player.maxs(), 0xffffffff, this.playerEnt);
        if (pt.startsolid && pt.ent === e) { const d = sub(np, old as V3); if (d[2] > 0 && Math.abs(d[2]) > Math.abs(d[0]) + Math.abs(d[1])) { this.player.pos = add(this.player.pos, d); } else { e.pos[0] = old[0]; e.pos[1] = old[1]; e.pos[2] = old[2]; e.t = before; } }
        if (e.t === tgt) { e.moving = false; io.fire(e, tgt ? 'onfullyopen' : 'onfullyclosed', null); this.doorArrived(e, tgt); }
      }
      if (e.returnAt && io.time >= e.returnAt && !e.moving) { e.returnAt = 0; this.wakeCubes(e); e.state = 1 - e.state; e.moving = true; e.moveSpeed = e.speed; io.fire(e, e.state ? 'onopen' : 'onclose', null); }
      if (e.cls === 'func_tracktrain' && e.speedNow) {
        const path = io.find(e.pathName, null, e)[0];
        if (!path) e.speedNow = 0; else {
          const to = sub(path.origin, e.pos); const d = len(to); const step = Math.abs(e.speedNow) * dt;
          const mv = d <= step ? to : scale(to, step / d); e.pos[0] += mv[0]; e.pos[1] += mv[1]; e.pos[2] += mv[2];
          if (this.player.groundEnt === e || this.onTrain(e)) { this.player.pos = add(this.player.pos, mv); this.trainCarried = true; }
          this.carryCubes(e, mv);
          if (d <= step) { e.curPath = path; io.fire(path, 'onpass', e); const nxt = e.speedNow < 0 ? (this.prevPath(path)?.name || '') : ((path.altOn && path.kv.altpath) ? path.kv.altpath : (path.kv.target || '')).toLowerCase(); if (nxt) e.pathName = nxt; else { e.speedNow = 0; } }
        }
      }
      if (e.cls === 'func_rotating') { const target = e.spinning ? e.maxspeed : 0; const acc = Math.max(1, e.maxspeed) * dt / Math.max(0.1, +(e.kv.fanfriction || 20) / 20);
        e.spinSpeed += Math.sign(target - e.spinSpeed) * Math.min(Math.abs(target - e.spinSpeed), acc); e.ang[e.axis] = (e.ang[e.axis] + e.spinSpeed * e.spinDir * dt) % 360; }
      if (e.closedAng && e.moving) { const span = Math.max(...e.openAng.map((v: number, k: number) => Math.abs(v - e.closedAng[k]))) || 1;
        const st = e.speed * dt / span; e.t = e.state ? Math.min(1, e.t + st) : Math.max(0, e.t - st);
        if (e.t === e.state) { e.moving = false; io.fire(e, e.state ? 'onfullyopen' : 'onfullyclosed', null); this.doorArrived(e, e.state); } }
      if (e.closedAng) for (let k = 0; k < 3; k++) e.ang[k] = e.closedAng[k] + (e.openAng[k] - e.closedAng[k]) * e.t;
      if (e.inst && e.pos) { e.inst.matrix = entityMatrix(e.pos, e.ang || e.angles); if (e.col && e.ang) e.col.rot = e.inst.matrix; }
      if (e.prop && e.ang && !e.kv.parentname) e.prop.matrix = entityMatrix(e.pos, e.ang);
      if (e.platform) { e.platform.mins = add(e.pos, e.platMins); e.platform.maxs = add(e.pos, e.platMaxs); }
    }
    // parented triggers (e.g. a lift's ride trigger) follow their parent's translation
    for (const e of io.ents) if (e.kv.parentname && e.touching && e.bmins && !e.killed) {
      const par = io.find(e.kv.parentname.split(',')[0], null, e)[0]; if (!par || par === e) continue; const pp: V3 = par.worldM && par.kv.parentname ? [par.worldM[12], par.worldM[13], par.worldM[14]] : par.pos || par.origin; // a07: parent is a prop riding a train
      if (!e.trigBase) e.trigBase = { lo: [...e.bmins], hi: [...e.bmaxs], p: [...pp] };
      const d = sub(pp, e.trigBase.p); e.bmins = add(e.trigBase.lo, d); e.bmaxs = add(e.trigBase.hi, d);
    }
    // hierarchy: child = parent(now) * inverse(parent at attach time) * child at attach time (full rotation + translation)
    for (let pass = 0; pass < 4; pass++) for (const e of io.ents) if (e.kv.parentname && (e.prop || e.inst || e.cube) && !e.killed) {
      const par = io.find(e.kv.parentname.split(',')[0], null, e)[0]; if (!par || !par.pos || par === e) continue;
      // SetParentAttachment: the child sits on the attachment itself (its origin and angles become the attachment's) and
      // follows it as the parent animates; SetParentAttachmentMaintainOffset keeps the offset it had when attached
      if (e.parentAttach && par.prop) { const A = this.attachWorld(par.prop, e.parentAttach);
        if (A) { if (e.attachKeep) { e.attachOff = mul(invertRigid(A), e.prop ? e.prop.matrix : e.inst ? e.inst.matrix : this.entWorld(e)); e.attachKeep = false; }
          const W = e.attachOff ? mul(A, e.attachOff) : A; e.worldM = W; e.attachTo = par; e.attachRel = null;
          if (e.prop) e.prop.matrix = W;
          if (e.inst) { e.pos = [W[12], W[13], W[14]]; e.inst.matrix = W; if (e.col) { e.col.offset = e.pos; e.col.rot = W; } }
          continue; } }
      const P = this.entWorld(par); if (!e.attachRel || e.attachTo !== par) { e.attachTo = par; const now = e.reparentNow; e.reparentNow = false;
        e.attachRel = now ? mul(invertRigid(P), e.prop ? e.prop.matrix : e.inst ? e.inst.matrix : this.entWorld(e)) : mul(invertRigid(par.spawnM || P), e.spawnM || entityMatrix(e.origin, e.angles));
        e.attachAngInv = e.closedAng || e.cls === 'func_rotating' ? invertRigid(entityMatrix(e.origin, e.ang)) : null; }
      // a child that also rotates on its own (rotating door / func_rotating on a moving parent): apply its local spin about its own origin
      // a func_door on a moving parent (a10's telescoping lift pillars: the top door rides the bottom one's brush) slides
      // in its parent's space, so its own travel adds to the parent's instead of being overwritten by it
      // (not for doors that start open: a06's fling pillars are three start-open doors deep and the chamber only works
      // with the children at their Hammer offsets, so how the engine places those is still open; they keep the old rule)
      let L = e.attachRel; if (e.cls === 'func_door' && e.closedPos && e.t && !(+e.kv.spawnflags & 1)) { const d = scale(sub(e.openPos, e.closedPos), e.t), R = e.spawnM || entityMatrix(e.origin, e.angles);
        L = mul(L, entityMatrix([R[0] * d[0] + R[1] * d[1] + R[2] * d[2], R[4] * d[0] + R[5] * d[1] + R[6] * d[2], R[8] * d[0] + R[9] * d[1] + R[10] * d[2]], [0, 0, 0])); }
      const W = e.attachAngInv ? mul(P, mul(L, mul(e.attachAngInv, entityMatrix(e.origin, e.ang)))) : mul(P, L); e.worldM = W;
      if (e.prop) e.prop.matrix = W;
      if (e.inst) { e.pos = [W[12], W[13], W[14]]; e.inst.matrix = W; if (e.col) { e.col.offset = e.pos; e.col.rot = W; } }
    }
    // ride along on moving brush entities that aren't trains (parented lift platforms, func_door lifts); a platform rising into the
    // player's feet lifts the player instead of shoving them sideways
    const carried = this.trainCarried; this.trainCarried = false;
    for (const e of io.ents) if (e.col && e.pos && e.cls !== 'func_tracktrain' && !e.killed) {
      const lp = e.ridePos; e.ridePos = [...e.pos];
      if (!lp) continue; const d = sub(e.pos, lp); if (!d[0] && !d[1] && !d[2]) continue;
      this.carryCubes(e, d);
      if (this.player.groundEnt === e) { if (!carried) this.player.pos = add(this.player.pos, d); continue; }
      if (d[2] > 0) { this.tr.ignore = null; const pt = this.tr.trace(this.player.pos, this.player.pos, HULL.mins, this.player.maxs(), 0x1 | 0x2 | 0x8 | 0x10000, this.playerEnt);
        if (pt.startsolid && pt.ent === e) { const up: V3 = add(this.player.pos, [0, 0, d[2] + 0.1]); const q = this.tr.trace(up, up, HULL.mins, this.player.maxs(), 0x1 | 0x2 | 0x8 | 0x10000, this.playerEnt); if (!q.startsolid) this.player.pos = up; } }
    }
    // player
    // teleport when the eye crosses the portal plane inside the hole (feet-first floor portals: eye crosses last)
    // the eye from before the movers ran this tick, when they only nudged it: a crusher that lifts the player head-first
    // into a ceiling portal (escape_00's crusher_room_2_0 into its dark mark) moves the eye across the plane, not the player
    const pushedC: V3 = this.player.eye(), prevC: V3 = len(sub(pushedC, eyeAtStart)) < 64 ? eyeAtStart : pushedC; const prevPos: V3 = [...this.player.pos] as V3; const prevVel: V3 = [...this.player.vel] as V3; const wasGround = this.player.onGround;
    if (this.dead) { input = { fwd: 0, side: 0, jump: false, duck: false }; this.player.viewOffset = Math.max(14, this.player.viewOffset - 170 * dt); } // the original's eye drops to 14 in about 0.3 s
    else if (this.health < 100 && this.io.time - this.lastHurt > PLAYER_HP.regenWait) this.health = Math.min(100, this.health + PLAYER_HP.regenPerSec * dt);
    this.player.move(input, dt);
    // a wall portal's hole is carved out of the wall only while the hull fits inside it (tunnelFor), so a move that takes
    // the hull past the hole's rim while it's still partly in the wall ends up inside solid (seen coming out of a14's door
    // wall portal rising: stuck for good). In Source the rim is solid and the move is clipped there: keep the axis that
    // still fits and drop the velocity along the other
    if (!this.player.noclip) { const pl = this.player, stuck = (q: V3) => { const keep = pl.pos; pl.pos = q; const r = pl.trace(q, q).startsolid; pl.pos = keep; return r; }; // the tunnel is worked out from pl.pos
      if (stuck(pl.pos) && !stuck(prevPos)) { const tries: V3[] = [[pl.pos[0], pl.pos[1], prevPos[2]], [prevPos[0], prevPos[1], pl.pos[2]]]; let fixed = false;
        for (let i = 0; i < 2 && !fixed; i++) if (!stuck(tries[i])) { pl.pos = tries[i]; if (i === 0) pl.vel[2] = 0; else pl.vel[0] = pl.vel[1] = 0; fixed = true; }
        if (!fixed) pl.pos = prevPos; } }
    const nowC: V3 = this.player.eye();
    let tp = false; for (const p of this.portals) if (p.open && p.linked && p.linked.open && this.crossed(p, prevC, nowC)) { this.teleportPlayer(p, p.linked); tp = true; break; }
    // floor portals: a shallow hole under the portal can stop the player before the eye crosses, so the hull centre counts there too
    if (!tp) { const hc = this.player.maxs()[2] / 2, pa: V3 = [prevPos[0], prevPos[1], prevPos[2] + hc], pb: V3 = [this.player.pos[0], this.player.pos[1], this.player.pos[2] + hc];
      for (const p of this.portals) if (p.open && p.linked && p.linked.open && p.f[2] > 0.7 && this.crossed(p, pa, pb)) { this.teleportPlayer(p, p.linked, true); tp = true; break; } }
    // landing fast on a floor portal: the floor behind the hole stops the hull before its centre crosses, which used to
    // zero the fall and let the player sink through slowly (a fling came out at 213 u/s after falling at 904). Falling
    // into the hole counts as going through, with the speed from before the landing.
    if (!tp && this.player.onGround && !wasGround && prevVel[2] < -150) { const pl = this.player, mid = pl.maxs()[2] / 2;
      for (const p of this.portals) { if (!p.open || !p.linked || !p.linked.open || p.f[2] < 0.7 || Math.abs(pl.pos[2] - p.pos[2]) > 4) continue;
        if (this.lastExit && this.lastExit.p === p && this.io.time - this.lastExit.t < 1.5) continue; // falling back onto the portal just left: land on it as before (a05's route relies on it)
        const d = sub(pl.pos, p.pos); if (Math.abs(dot(d, p.r)) > 32 - 8 || Math.abs(dot(d, p.u)) > 56 - 8) continue;
        const feet = pl.pos[2]; pl.vel = prevVel; pl.pos = [pl.pos[0], pl.pos[1], p.pos[2] - mid - 1]; this.teleportPlayer(p, p.linked, true, feet); break; } }
    this.tr.ignore = null;
    // cubes
    for (const c of this.cubes) if (c.alive) this.updateCube(c, dt);
    this.updateBalls(dt); this.updateRocketTurrets(dt); this.updateRockets(dt);
    // triggers
    this.updateGunPickup(); this.updateMMC();
    // a gun portal on a brush entity fizzles as soon as that entity moves
    for (const gp of this.gunPortals) { const c = (gp as any).onCol, o = (gp as any).onOff, r0 = (gp as any).onRot; const turned = !!c && (!!r0 !== !!c.rot || (!!r0 && [0, 1, 2, 4, 5, 6, 8, 9, 10].some(k => Math.abs(c.rot[k] - r0[k]) > 1e-3)));
      if (gp.open && c && (Math.abs(c.offset[0] - o[0]) + Math.abs(c.offset[1] - o[1]) + Math.abs(c.offset[2] - o[2]) > 0.5 || turned || !c.enabled())) { gp.open = false; (gp as any).onCol = null; this.relinkMapPortals(); io.log.push(`${io.time.toFixed(2)} ${gp.name} fizzled: its surface moved`); } }
    this.updatePortalDetectors();
    this.updateTriggers(dt);
    if (this.hud.hint && io.time > this.hud.hintT) this.hud.hint = '';
    if (this.hud.fadeHoldUntil && io.time < this.hud.fadeHoldUntil) {} else if (this.hud.fade !== this.hud.fadeTarget) { const s = this.hud.fadeRate * dt; this.hud.fade = this.hud.fade < this.hud.fadeTarget ? Math.min(this.hud.fadeTarget, this.hud.fade + s) : Math.max(this.hud.fadeTarget, this.hud.fade - s); }
    // held-cube prop matrix
    for (const c of this.cubes) { const m = new Float32Array(c.R), o = c.off ? sub(c.pos, xformDir(c.R, c.off)) : c.pos; m[12] = o[0]; m[13] = o[1]; m[14] = o[2]; m[15] = 1; c.prop.matrix = m; }
    for (const c of this.cubes) if (c.turret && c.alive) this.updateTurret(c);
  }
  onTrain(e: Ent) { const p = this.player.pos; const lo = e.platform ? e.platMins : this.bsp.models[e.model].mins, hi = e.platform ? e.platMaxs : this.bsp.models[e.model].maxs; return p[0] > e.pos[0] + lo[0] - 16 && p[0] < e.pos[0] + hi[0] + 16 && p[1] > e.pos[1] + lo[1] - 16 && p[1] < e.pos[1] + hi[1] + 16 && Math.abs(p[2] - (e.pos[2] + hi[2])) < 4; }
  /** a trace that starts inside another cube's box (cube AABBs are looser than the boxes once they turn, and stacked or
   *  packed cubes touch) is retried without that cube, so the centre sweep can't go startsolid and let a cube fall through
   *  the floor, and a held cube can be pulled out of a pile */
  traceFree(a: V3, b: V3, mins: V3, maxs: V3, mask: number) { let t = this.tr.trace(a, b, mins, maxs, mask, this.playerEnt); const off: { box: { mins: V3; maxs: V3 }; mins: V3; maxs: V3 }[] = [];
    for (let k = 0; k < 4 && t.startsolid && t.ent?.cube && t.ent.box; k++) { const bx = t.ent.box; off.push({ box: bx, mins: bx.mins, maxs: bx.maxs }); bx.mins = [1e9, 1e9, 1e9]; bx.maxs = [1e9, 1e9, 1e9]; t = this.tr.trace(a, b, mins, maxs, mask, this.playerEnt); }
    for (const o of off) { o.box.mins = o.mins; o.box.maxs = o.maxs; } return t; }
  updateCube(c: Cube, dt: number) {
    const mins: V3 = [-c.ext, -c.ext, -c.ext], maxs: V3 = [c.ext, c.ext, c.ext];
    const prev: V3 = [...c.pos] as V3;
    c.ent.box.mins = [1e9, 1e9, 1e9]; c.ent.box.maxs = [1e9, 1e9, 1e9]; // don't collide with itself
    if (c.held) {
      // Where a held object goes, after CGrabController::UpdateObject (public SDK 2013 hl2/weapon_physcannon.cpp; Portal's own
      // pickup code isn't public, so that it works the same there is a guess): view pitch clamped to +-75, the object held
      // kept at least a radius (the player's 2D half-diagonal plus the object's extent along the view) from the player's vertical
      // axis so it never overlaps the player, and let go when the player stands on it. The port used the unclamped view, so
      // looking down put the cube under the player's own hull and the player could ride it (stuck in mid-air in a08).
      const eye = this.player.eye(); const ang = this.player.ang; const { f } = angleVectors([Math.max(-75, Math.min(75, ang[0])), ang[1], 0]);
      const radius = Math.hypot(16, 16) + c.ext * (Math.abs(f[0]) + Math.abs(f[1]) + Math.abs(f[2]));
      let want = ma(eye, 56, f); // the SDK's 24 + radius (58 to 67 for a cube) is not used: the scripted button drops were tuned to 56 and moved off the a00 pad with it
      { const pz = this.player.pos[2], top = pz + this.player.maxs()[2], nz = Math.max(pz, Math.min(top, want[2])); const dl: V3 = [want[0] - this.player.pos[0], want[1] - this.player.pos[1], want[2] - nz]; const L = len(dl);
        if (L < radius) want = L > 1e-3 ? add([this.player.pos[0], this.player.pos[1], nz], scale(dl, radius / L)) : ma(want, radius, [f[0], f[1], 0]); } if (c.viaPortal) { const vp = c.viaPortal; if (vp.open && vp.linked?.open) want = xformPoint(throughPortal(vp, vp.linked), want); else c.viaPortal = null; }
      this.tr.ignore = this.tunnelFor(c.pos, mins, maxs);
      let t = this.traceFree(c.pos, want, mins, maxs, 0x1 | 0x2 | 0x8 | 0x4000); // a held cube pulled out of a stack starts touching its neighbours
      // stuck a little into a brush (its box is the unrotated ±ext, a turned cube can end up overlapping a step's edge): the
      // SDK's held object is a physics shadow that pushes out of the overlap, so go to the wanted spot if the box fits
      // there and the centre's path to it is clear (never through a wall)
      if (t.startsolid && !t.ent?.cube) { const skip = new Set<any>([this.playerEnt, c.ent]), fit = this.tr.trace(want, want, mins, maxs, 0x1 | 0x2 | 0x8 | 0x4000, skip), path = this.tr.trace(c.pos, want, [0, 0, 0], [0, 0, 0], 0x1 | 0x2 | 0x8 | 0x4000, skip);
        if (!fit.startsolid && !path.startsolid && path.fraction >= 1) t = { ...t, end: [...want] as V3, startsolid: false, fraction: 1 }; }
      // blocked part way: slide the rest along what it hit (the physics shadow slides; a straight sweep stopped dead
      // against a step's edge and the cube couldn't be lifted past it)
      for (let k = 0; k < 3 && !t.startsolid && t.fraction < 1; k++) { const rest = sub(want, t.end), n = t.normal; const moves: V3[] = len(n) > 0.5 ? [sub(rest, scale(n, dot(rest, n)))] : [[0, 0, rest[2]], [rest[0], rest[1], 0]];
        let moved = false; for (const m of moves) { if (len(m) < 0.1) continue; const t2 = this.traceFree(t.end, add(t.end, m), mins, maxs, 0x1 | 0x2 | 0x8 | 0x4000); if (t2.startsolid || t2.fraction <= 0) continue; t = { ...t2, fraction: 0 }; moved = true; if (t2.fraction >= 1) t.fraction = 0.999; break; }
        if (!moved) break; }
      c.vel = scale(sub(t.end, c.pos), 1 / Math.max(dt, 1e-3)); c.pos = t.end; c.asleep = false; c.w = [0, 0, 0];
      if (c.Rrel && !c.viaPortal) c.R = mul(entityMatrix([0, 0, 0], [0, this.player.ang[1], 0]), c.Rrel);
      if (this.player.groundEnt === c.ent) { this.io.log.push(`${this.io.time.toFixed(2)} stood on the held cube, dropped`); c.held = false; this.held = null; c.viaPortal = null; } // UpdateObject lets go of what the player stands on
      else if (len(sub(c.pos, want)) > 80) {
        // just went through a portal: forcePortalDuck drops the eye 36 and the cube may sit >80 from the new want for
        // a few ticks (or until we land and un-duck). Source keeps the grab; dropping here is what made a02 lose box A
        // on the left pedestal after the pit-wall teleport.
        if (this.lastExit && this.io.time - this.lastExit.t < 2) { /* keep holding */ }
        else { this.io.log.push(`${this.io.time.toFixed(2)} held cube snagged at ${c.pos.map(v => v | 0)} (want ${want.map(v => v | 0)}) dropped`); c.held = false; this.held = null; c.viaPortal = null; }
      }
    } else {
      const Z: V3 = [0, 0, 0]; const mask = 0x1 | 0x2 | 0x8 | 0x4000;
      this.tr.ignore = this.tunnelFor(c.pos, mins, maxs);
      const tf = (p: V3, q: V3) => this.traceFree(p, q, Z, Z, mask);
      const ns = stepBody(c, dt, tf);
      c.onGround = ns.some(n => n[2] > 0.7);
      if (c.pos[2] < -16000) c.ent.game.io.fire(c.ent, 'onoutofworld', c.ent);
    }
    this.tr.ignore = null;
    if (c.justPortaled) { c.justPortaled = false; /* already re-placed in teleportPlayer; prev is still pre-portal */ }
    else for (const p of this.portals) if (p.open && p.linked && p.linked.open && this.crossed(p, prev, c.pos)) {
      const M = throughPortal(p, p.linked); c.pos = xformPoint(M, c.pos); c.vel = xformDir(M, c.vel); c.w = xformDir(M, c.w); c.R = mul(M, c.R); c.R[12] = c.R[13] = c.R[14] = 0; c.asleep = false;
      const out = dot(c.vel, p.linked.f); if (out < 60) c.vel = ma(c.vel, 60 - out, p.linked.f);
      // held cubes stay held: the grab point is then seen through the portal (like Source's grab-through-portal)
      if (c.held) c.viaPortal = c.viaPortal === p.linked ? null : p; break;
    }
    this.updateCubeBox(c);
  }
  /** cubes resting on a moving brush entity (a08's cube on its rail platform, a cube on a lift) move with it, as physics
   *  objects on a pusher do in the engine; before this they stayed put while the platform slid out from under them */
  carryCubes(e: Ent, d: V3) {
    const Z: V3 = [0, 0, 0];
    for (const c of this.cubes) { if (!c.alive || c.held) continue;
      const h = halfExtent(c), lo: V3 = [-h[0] + 1, -h[1] + 1, -h[2]], hi: V3 = [h[0] - 1, h[1] - 1, h[2]];
      if (Math.abs(c.pos[0] - e.pos[0]) > 512 || Math.abs(c.pos[1] - e.pos[1]) > 512 || Math.abs(c.pos[2] - e.pos[2]) > 512) continue;
      c.ent.box.mins = [1e9, 1e9, 1e9]; c.ent.box.maxs = [1e9, 1e9, 1e9]; this.tr.ignore = null;
      const t = this.tr.trace(c.pos, [c.pos[0], c.pos[1], c.pos[2] - 3 - Math.max(0, -d[2])], lo, hi, 0x1 | 0x2 | 0x8 | 0x4000, this.playerEnt);
      this.updateCubeBox(c);
      if (t.ent !== e || t.fraction >= 1 || t.normal[2] < 0.7) continue;
      c.pos = add(c.pos, d); }
  }
  /** something the cubes might rest on changed (a brush toggled, a door moved): let sleeping cubes re-check their support */
  wakeCubes(e?: Ent) {
    const M = e && e.model != null ? this.bsp.models[e.model] : null; const o: V3 = e ? (e.pos || e.origin) : [0, 0, 0]; const m = 96;
    for (const c of this.cubes) {
      if (M && !(c.pos[0] > o[0] + M.mins[0] - m && c.pos[0] < o[0] + M.maxs[0] + m && c.pos[1] > o[1] + M.mins[1] - m && c.pos[1] < o[1] + M.maxs[1] + m && c.pos[2] > o[2] + M.mins[2] - m && c.pos[2] < o[2] + M.maxs[2] + m)) continue;
      c.asleep = false; c.sleep = 0;
    }
  }
  /** +use on a cube or turret, after CBasePlayer::FindUseEntity (SDK 2013 baseplayer_shared.cpp): a ray along the view,
   *  then 16-unit hulls 72 long swept at 45..-15 degrees below it; a hit counts if it's within PLAYER_USE_RADIUS (80) of
   *  the eye, with the height measured from the player's own body (so something at your feet, or just below a step you
   *  stand on, is close); failing those, the nearest box within 80 of the eye inside a cos 0.8 cone, by distance from the
   *  view line. Measured in the original on a02's box_2 (checks/use-reach.ctl): looking at its centre it grabs from 98
   *  units and refuses from 104, 112 and 120, standing or ducked; looking just over its top it grabs from 104. The SDK's
   *  hulls would take the box at 104 either way, so here a view ray that hits the cube out of reach finds nothing (a
   *  guess at Portal's own player code, which isn't public, fitted to those 7 readings). Not what you stand on
   *  (CWeaponPhysCannon::CanPickupObject). */
  findUseCube(eye: V3, f: V3, u: V3): Cube | null {
    const R = 80, mask = 0x1 | 0x2 | 0x8 | 0x4000 | 0x10000, pl = this.player, z0 = pl.pos[2], z1 = z0 + pl.maxs()[2];
    const ok = (c: any): c is Cube => !!c && c.alive && !c.held && pl.groundEnt !== c.ent;
    const iv = (x: number) => x < z0 ? z0 - x : x > z1 ? x - z1 : 0;
    const dist = (end: V3) => Math.hypot(end[0] - eye[0], end[1] - eye[1], iv(end[2]));
    this.tr.ignore = null; let near: Cube | null = null;
    { const t = this.tr.trace(eye, ma(eye, 1024, f), [0, 0, 0], [0, 0, 0], mask, this.playerEnt); const c = t.ent?.cube; if (ok(c)) return dist(t.end) < R ? c : null; }
    for (const tan of [1, 0.57735026919, 0.3639702342, 0.267949192431, 0.1763269807, -0.1763269807, -0.267949192431]) {
      const t = this.tr.trace(eye, ma(eye, 72, norm(ma(f, -tan, u))), [-16, -16, -16], [16, 16, 16], mask, this.playerEnt);
      const c = t.ent?.cube; if (ok(c) && dist(t.end) < R) near = c; }
    const nearest = (c: Cube): V3 => { const b = c.ent.box; return [0, 1, 2].map(k => Math.min(Math.max(eye[k], b.mins[k]), b.maxs[k])) as V3; };
    const lineDist = (p: V3) => { const d = sub(p, eye); return len(sub(d, scale(f, dot(d, f)))); };
    let nd = near ? lineDist(nearest(near)) : Infinity;
    for (const c of this.cubes) { if (!ok(c) || !c.ent.box) continue; const p = nearest(c), d = sub(p, eye), l = len(d);
      if (l >= R || (l > 1e-6 && dot(d, f) / l < 0.8)) continue; const ld = lineDist(p); if (ld >= nd) continue;
      const t = this.tr.trace(eye, p, [0, 0, 0], [0, 0, 0], mask, this.playerEnt); if (t.fraction < 1 && t.ent !== c.ent) continue;
      near = c; nd = ld; }
    return near;
  }
  use() {
    if (this.held) { const c = this.held; c.held = false; c.vel = scale(c.vel, 0.25); c.asleep = false; this.held = null; return; }
    const eye = this.player.eye(); const { f, u } = angleVectors(this.player.ang);
    // prefer the first solid along the look: a turret or cube off to the side (escape_01's south-pod turret
    // next to door_raise_sparky) shouldn't steal +use from a Use-Opens door you're pointing at
    this.tr.ignore = null; let t = this.tr.trace(eye, ma(eye, 96, f), [0, 0, 0], [0, 0, 0], 0xffffffff, this.playerEnt);
    const skip = new Set<any>([this.playerEnt]); const usable = (x: any) => x && (x.cls === 'func_button' || (/^func_door(_rotating)?$/.test(x.cls) && (+x.kv.spawnflags & 256)));
    if (!usable(t.ent)) {
      const best = this.findUseCube(eye, f, u);
      if (best) { best.Rrel = mul(invertRigid(entityMatrix([0, 0, 0], [0, this.player.ang[1], 0])), best.R); best.held = true; this.held = best; this.io.fire(best.ent, 'onplayerpickup', this.playerEnt); return; }
      // see past non-usable brush entities (a07: the scaffold the player rides sits between eye and the exit switch)
      for (let k = 0; k < 3 && t.ent && !usable(t.ent); k++) { skip.add(t.ent); t = this.tr.trace(eye, ma(eye, 96, f), [0, 0, 0], [0, 0, 0], 0xffffffff, skip); }
    }
    if (t.ent && t.ent.cls === 'func_button') this.io.fire(t.ent, 'onpressed', this.playerEnt);
    // doors with the "Use Opens" spawnflag (256) act as use buttons (a07's pedestal switches are func_door_rotating)
    else if (t.ent && /^func_door(_rotating)?$/.test(t.ent.cls) && (+t.ent.kv.spawnflags & 256)) this.io.deliver(t.ent, 'open', '', this.playerEnt, this.playerEnt);
  }
  // weapon_portalgun: picked up by walking near it; its canfireportal1/2 keyvalues decide which colours work
  updateGunPickup() {
    for (const g of this.guns) { if (g.killed) continue;
      const par = g.kv.parentname ? this.io.find(g.kv.parentname.split(',')[0], null, g)[0] : null;
      const at: V3 = g.worldM ? [g.worldM[12], g.worldM[13], g.worldM[14]] : par && par.pos ? add(g.origin, sub(par.pos, par.spawnPos)) : g.origin;
      const c = add(this.player.pos, [0, 0, 36]); if (Math.hypot(at[0] - c[0], at[1] - c[1], at[2] - c[2]) > 72) continue;
      this.pickGun(g); }
  }
  pickGun(g: Ent) {
    const had = this.hasGunBefore; this.hasGun = true; this.canFire = [g.kv.canfireportal1 !== '0' || (had && this.canFire[0]), g.kv.canfireportal2 !== '0' || (had && this.canFire[1])];
    this.hasGunBefore = true; g.killed = true; g.picked = true; g.onKill?.(); this.io.fire(g, 'onplayerpickup', this.playerEnt); this.io.log.push(`${this.io.time.toFixed(2)} picked up ${g.name} (blue ${this.canFire[0]}, orange ${this.canFire[1]})`);
  }
  mmcs = new Set<any>();
  updateMMC() { for (const e of this.mmcs) { const L = e.lerp; if (!L) { this.mmcs.delete(e); continue; } let u = (this.io.time - L.t0) / L.d;
      if (u >= 1) { if (L.loop) u = u % 1; else { u = 1; e.lerp = null; } } L.ins.texFrame = Math.floor(L.a + (L.b - L.a) * u); } }
  hasGunBefore = false;
  updateTriggers(dt: number) {
    const io = this.io; const pl = this.player; const pmin = add(pl.pos, HULL.mins), pmax = add(pl.pos, pl.maxs());
    const overlap = (a0: V3, a1: V3, b0: V3, b1: V3) => a0[0] < b1[0] && a1[0] > b0[0] && a0[1] < b1[1] && a1[1] > b0[1] && a0[2] < b1[2] && a1[2] > b0[2];
    for (const e of io.ents) {
      if (!e.touching || e.killed || !e.bmins) continue;
      const sf = +(e.kv.spawnflags || 0); const now = new Set<Ent>();
      if (e.enabled) {
        if ((sf & 1 || sf & 64 || e.cls === 'trigger_changelevel') && overlap(pmin, pmax, e.bmins, e.bmaxs)) now.add(this.playerEnt);
        if (sf & 8 || sf & 64 || e.cls === 'trigger_portal_cleanser') for (const c of this.cubes) { if (!c.alive) continue; const h = halfExtent(c); /* the body's own bounds: a turret is 4 times taller than its narrowest half-width */ if (overlap(sub(c.pos, h), add(c.pos, h), e.bmins, e.bmaxs)) now.add(c.ent); }
        if (sf & 8 || sf & 64) for (const b of this.balls) if (overlap(sub(b.pos, [b.r, b.r, b.r]), add(b.pos, [b.r, b.r, b.r]), e.bmins, e.bmaxs)) now.add(b.ent);
        if (sf & 8 || sf & 64) for (const r of this.rockets) if (!r.dead && overlap(sub(r.pos, [r.r, r.r, r.r]), add(r.pos, [r.r, r.r, r.r]), e.bmins, e.bmaxs)) now.add(r.ent);
        if (e.kv.filtername) { const f = io.find(e.kv.filtername, null, e)[0]; if (f) for (const a of [...now]) if (!this.passFilter(f, a)) now.delete(a); }
      }
      for (const a of now) if (!e.touching.has(a)) {
        e.touching.add(a); io.fire(e, 'onstarttouch', a);
        if (e.cls === 'trigger_once') { io.fire(e, 'ontrigger', a); e.killed = true; }
        else if (e.cls === 'trigger_multiple') { if (!e.waitUntil || io.time >= e.waitUntil) { io.fire(e, 'ontrigger', a); e.waitUntil = io.time + Math.max(0.1, +(e.kv.wait ?? 0.2)); } }
        else if (e.cls === 'trigger_teleport') { const d = io.find(e.kv.target, null, e)[0]; if (d && a === this.playerEnt) { pl.pos = [...d.origin] as V3; pl.vel = [0, 0, 0]; pl.ang = [0, d.angles[1], 0]; } }
        else if (e.cls === 'trigger_portal_cleanser') { if (a === this.playerEnt) { if (this.gunPortals.some(p => p.open)) { io.fire(e, 'onfizzle', a); this.vmPlay('act_vm_fizzle'); } this.fizzleGunPortals(); } else if (a.cube) { io.fire(e, 'ondissolvebox', a); io.fire(e, 'ondissolve', a); a.killed = true; a.onKill?.(); } }
        else if (e.cls === 'trigger_changelevel' && !(sf & 2) && a === this.playerEnt) this.changeLevel?.(e.kv.map, (e.kv.landmark || '').toLowerCase());
      }
      for (const a of [...e.touching]) if (!now.has(a)) { e.touching.delete(a); io.fire(e, 'onendtouch', a); if (!e.touching.size) io.fire(e, 'onendtouchall', a); }
      // trigger_push (SDK 2013 triggers.cpp, CTriggerPush::Touch): a player in it gets pushspeed along pushdir as base
      // velocity, added up over every push it's in; pushing up off the ground lifts it a unit and ungrounds it first.
      // Once flag (128): one push of the speed as velocity, then the trigger goes away. Physics objects aren't pushed here.
      if (e.cls === 'trigger_push' && now.has(this.playerEnt)) { const d = angleVectors(parseV3(e.kv.pushdir || '0 0 0')).f, sp = +(e.kv.speed || 40);
        if (sf & 128) { pl.vel = add(pl.vel, scale(d, sp)); e.killed = true; }
        else { if (!pl.pushed) pl.baseVel = [0, 0, 0]; /* first push this tick */ if (d[2] * sp > 0 && pl.onGround) { pl.onGround = false; pl.groundEnt = null; pl.pos[2] += 1; } pl.baseVel = add(pl.baseVel, scale(d, sp)); pl.pushed = true; } }
      // trigger_multiple keeps firing OnTrigger while something stays in it, once per `wait` (SDK 2013 triggers.cpp: Touch
      // runs every frame and ActivateMultiTrigger only waits out the reset time). Firing only on a new touch lost a box
      // that left and came back inside the wait: a00's button stayed up under a box that settled on it 0.2 s later.
      if (e.cls === 'trigger_multiple' && now.size && +(e.kv.wait ?? 0.2) > 0 && e.waitUntil && io.time >= e.waitUntil) { io.fire(e, 'ontrigger', [...now][0]); e.waitUntil = io.time + Math.max(0.1, +(e.kv.wait ?? 0.2)); }
      // trigger_look (Valve Developer Wiki / public FGD): while the player is inside, they must look at `target`
      // for LookTime seconds (FieldOfView is the cosine of the allowed angle, 0.9 by default). Looking away or
      // leaving resets the timer. Timeout fires OnTimeout if they stay that long without success (0 = off).
      // spawnflag 128 is Fire Once (escape_01's look_target_mini_ambush_escape, FOV 0.8, LookTime 0.75).
      if (e.cls === 'trigger_look') {
        if (now.has(this.playerEnt) && !e.lookFired) {
          const tgt = io.find((e.kv.target || '').toLowerCase(), null, e)[0];
          const fov = +(e.kv.fieldofview ?? 0.9), need = +(e.kv.looktime ?? 0.5), timeout = +(e.kv.timeout ?? 0);
          let looking = false;
          if (tgt) {
            const eye = pl.eye(), dir = sub(tgt.origin, eye), L = len(dir);
            if (L > 1e-4) looking = dot(angleVectors(pl.ang).f, scale(dir, 1 / L)) >= fov;
          }
          if (looking) {
            e.lookAcc = (e.lookAcc || 0) + dt;
            if (e.lookAcc >= need) { io.fire(e, 'ontrigger', this.playerEnt); e.lookFired = true; if (sf & 128) e.killed = true; }
          } else e.lookAcc = 0;
          if (!e.lookFired && timeout > 0) {
            e.lookIn = (e.lookIn || 0) + dt;
            if (e.lookIn >= timeout) { io.fire(e, 'ontimeout', this.playerEnt); e.lookFired = true; if (sf & 128) e.killed = true; }
          }
        } else { e.lookAcc = 0; e.lookIn = 0; }
      }
    }
  }
  passFilter(f: Ent, a: Ent) {
    let ok = true;
    // filter_activator_name uses the same trailing-* prefix as I/O target names (escape_02's
    // filter_brain_ball is brain_core_sphere*, matching every personality core)
    if (f.cls === 'filter_activator_name') { const pat = (f.kv.filtername || '').toLowerCase(); ok = pat.endsWith('*') ? a.name.startsWith(pat.slice(0, -1)) : a.name === pat; }
    else if (f.cls === 'filter_combineball_type') ok = !!a.ball;
    else if (f.cls === 'filter_activator_class') ok = (a.cube ? 'prop_physics' : a.cls) === (f.kv.filterclass || '').toLowerCase();
    if (f.kv.negated === '1') ok = !ok; return ok;
  }
}
