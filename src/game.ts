import type { Sound } from './audio';
import { Body, stepBody, halfExtent } from './rigid';
import { findSeq, skinModel } from './models.ts';
import { BSP, SURF, CONTENTS } from './bsp.ts';
import { Ent, IO } from './ents.ts';
import { Tracer, MASK_SHOT_PORTAL, type Collider } from './trace.ts';
import { Player, HULL } from './player.ts';
import { Renderer, throughPortal, type Portal, type Instance, type PropInst } from './render.ts';
import type { ModelCache } from './models.ts';
import { mul, invertRigid } from './math.ts';
import { type V3, angleVectors, dot, cross, norm, sub, add, scale, ma, entityMatrix, xformPoint, xformDir, vectorAngles, parseV3, m4, len } from './math.ts';

const BLUE: V3 = [0.25, 0.6, 1.0], ORANGE: V3 = [1.0, 0.55, 0.1];
const PW = 32, PH = 54; // Portal 1 portal half-extents

interface Cube extends Body { ent: Ent; held: boolean; Rrel?: Float32Array; prop: PropInst; ext: number; onGround: boolean; spawn: V3; alive: boolean; tunnel: Set<number> | null; viaPortal?: Portal | null; }

export class Game {
  bsp: BSP; io = new IO(); tr: Tracer; r: Renderer; models: ModelCache; player: Player; playerEnt: Ent;
  portals: Portal[] = []; gunPortals: [Portal, Portal]; cubes: Cube[] = []; hasGun = true; canFire: [boolean, boolean] = [true, true]; guns: Ent[] = []; held: Cube | null = null;
  portalBrushes = new Map<Portal, Set<number>>(); hud = { hint: "", hintT: 0, fade: 0, fadeTarget: 0, fadeRate: 0, fadeHoldUntil: 0 }; changeLevel: ((map: string, lm: string) => void) | null = null;
  sounds: ((path: string, pos?: V3) => void) | null = null; snd: Sound | null = null; captions: { text: string; until: number }[] = []; stats = { teleports: 0, portalsPlaced: 0, solidProps: 0 }; noportalVolumes: Ent[] = [];
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
    for (const p of bsp.staticProps) { const pi = this.addProp(p.model, p.origin as V3, p.angles as V3, p.skin); if (p.solid) this.solidProp(pi, null); }
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
  /** give a non-animated prop an AABB collider from its MDL hull (small props only: big ones are hollow vphysics shapes) */
  solidProp(pi: PropInst, ent: any) {
    const check = () => { const m = pi.model; if (!m) return false; const d = m.data; let lo = d.hullMins, hi = d.hullMaxs;
      if (!(hi[0] > lo[0])) { lo = d.mins; hi = d.maxs; }
      if (Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) > 100 || Math.min(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) < 2) return true;
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
        if (passableTrain) { // the visible/solid elevator is a prop with vphysics collision; give the rider a floor disc instead
          e.platform = { mins: [0, 0, 0] as V3, maxs: [0, 0, 0] as V3, ent: e }; this.tr.extraBoxes.push(e.platform); e.platMins = [-80, -80, M.mins[2]]; e.platMaxs = [80, 80, M.mins[2] + 4]; }
        const solid = !passableTrain && !(c === 'func_illusionary' || (c === 'func_brush' && kv.solidity === '1'));
        if (solid) { const col: Collider = { bsp: this.bsp, headnode: M.headnode, offset: e.pos, ent: e, enabled: () => !e.killed && (c !== 'func_brush' || e.enabled) }; e.col = col; this.tr.colliders.push(col); }
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
      const ax = (+kv.spawnflags & 64) ? 2 : (+kv.spawnflags & 128) ? 0 : 1; e.openAng = [...e.angles] as V3; e.openAng[ax] += dist; e.speed = +(kv.speed || 100); e.t = 0; e.state = 0;
      if (+kv.spawnflags & 1) { e.t = 1; e.state = 1; } }
    if (c === 'func_tracktrain') { e.speedNow = 0; e.startspeed = +(kv.startspeed || 100); e.pathName = (kv.target || '').toLowerCase(); }
    if (c === 'prop_portal') {
      const { f, r, u } = angleVectors(e.angles);
      const p: Portal = { pos: e.origin, f, r, u, color: kv.portaltwo === '1' ? ORANGE : BLUE, open: false, linked: null, name: e.name }; e.portal = p; this.portals.push(p);
      if (kv.activated === '1') this.activatePortal(e, true);
    }
    if (c === 'weapon_portalgun' && !/spawn/.test(e.name)) { e.prop = this.addProp('models/weapons/w_portalgun.mdl', e.origin, e.angles); e.onKill = () => { if (e.prop) e.prop.visible = false; }; }
    if (c === 'func_noportal_volume') { if (kv.startdisabled !== '1') e.enabled = true; this.noportalVolumes.push(e); }
    if (/^prop_(dynamic|physics|physics_override|physics_multiplayer|weighted_cube|dynamic_override)$/.test(c) && kv.model) {
      if (/metal_box\.mdl$/i.test(kv.model) || c === 'prop_weighted_cube') this.spawnCube(e);
      else { e.prop = this.addProp(kv.model, e.origin, e.angles, +(kv.skin || 0)); if (kv.startdisabled === '1' || kv.rendermode === '10') e.prop.visible = false; if (kv.defaultanim) this.playAnim(e, kv.defaultanim, true); if (/^prop_physics/.test(c) && kv.solid !== '0') this.solidProp(e.prop, e); }
    }
    if (c === 'logic_auto' && !kv.globalstate) { this.io.fire(e, 'onmapspawn', null); this.io.fire(e, 'onnewgame', null); }
    if (c === 'logic_timer') { e.next = +(kv.refiretime || 1); if (kv.startdisabled === '1') e.enabled = false; }
    if (c === 'math_counter') { e.value = +(kv.startvalue || 0); e.min = +(kv.min || 0); e.max = +(kv.max || 0); }
    if (/^trigger_/.test(c)) { e.touching = new Set(); if (kv.startdisabled === '1') e.enabled = false; }
  }
  spawnCube(e: Ent) {
    const prop = this.addProp(e.kv.model || 'models/props/metal_box.mdl', e.origin, e.angles, +(e.kv.skin || 0));
    const cube: Cube = { ent: e, pos: [...e.origin] as V3, vel: [0, 0, 0], held: false, prop, ext: 12, onGround: false, spawn: [...e.origin] as V3, alive: true, tunnel: null, R: entityMatrix([0, 0, 0], e.angles), w: [0, 0, 0], h: 12, sleep: 0, asleep: false };
    e.cube = cube; this.cubes.push(cube);
    this.tr.extraBoxes.push({ mins: [0, 0, 0], maxs: [0, 0, 0], ent: e }); e.box = this.tr.extraBoxes[this.tr.extraBoxes.length - 1];
    e.onKill = () => { cube.alive = false; prop.visible = false; if (this.held === cube) this.held = null; e.box.mins = [1e9, 1e9, 1e9]; e.box.maxs = [1e9, 1e9, 1e9]; };
    this.updateCubeBox(cube);
  }
  updateCubeBox(c: Cube) { const b = c.ent.box, x = halfExtent(c).map(v => Math.min(v, c.ext * 1.3)); b.mins = [c.pos[0] - x[0], c.pos[1] - x[1], c.pos[2] - x[2]]; b.maxs = [c.pos[0] + x[0], c.pos[1] + x[1], c.pos[2] + x[2]]; }
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
  /** world brushes that make up the surface behind a portal (ignored while something passes through it) */
  brushesBehind(p: Portal) {
    let s = this.portalBrushes.get(p); if (s) return s; s = new Set();
    const bsp = this.bsp;
    for (let bi = 0; bi < bsp.brushes.length; bi++) {
      const br = bsp.brushes[bi]; if (!(br.contents & (CONTENTS.SOLID | CONTENTS.PLAYERCLIP | CONTENTS.WINDOW))) continue;
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
  teleportPlayer(a: Portal, b: Portal) {
    const M = throughPortal(a, b); const pl = this.player; const mid = pl.viewOffset;
    const c: V3 = pl.eye(); const nc = xformPoint(M, c);
    pl.vel = xformDir(M, pl.vel);
    const { f, u } = angleVectors(pl.ang); const nf = xformDir(M, f), nu = xformDir(M, u);
    const na = vectorAngles(nf, nu); pl.ang = [Math.max(-89, Math.min(89, na[0])), na[1], 0];
    pl.pos = [nc[0], nc[1], nc[2] - mid];
    // exiting a floor portal: make sure we leave with at least a little speed so we clear the hole
    const out = dot(pl.vel, b.f); if (out < 60) pl.vel = ma(pl.vel, 60 - out, b.f);
    pl.onGround = false; this.stats.teleports++;
    // un-stick: the exit hole may sit lower/higher than the hull (e.g. feet below the floor); nudge up/out until free
    this.tr.ignore = this.tunnelFor(pl.pos, HULL.mins, pl.maxs());
    const free = (q: V3) => !this.tr.trace(q, q, HULL.mins, pl.maxs(), 0x1 | 0x2 | 0x8 | 0x4000 | 0x10000 | 0x2000000, pl).startsolid;
    if (!free(pl.pos)) { let done = false;
      for (let k = 1; k <= 40 && !done; k++) for (const d of [[0, 0, 1], b.f, [0, 0, -1]] as V3[]) { const q = ma(pl.pos, k, d); if (free(q)) { pl.pos = q; done = true; break; } } }
    // a held cube comes along (Source keeps held objects attached through portals): re-place it in front of the new view
    const hc = this.held; if (hc && hc.viaPortal === a) hc.viaPortal = null; else if (hc) { hc.viaPortal = null; const e2 = pl.eye(); const f2 = angleVectors(pl.ang).f; const ext: V3 = [hc.ext, hc.ext, hc.ext];
      const t = this.tr.trace(e2, ma(e2, 56, f2), scale(ext, -1), ext, 0x1 | 0x2 | 0x8 | 0x4000, this.playerEnt); hc.pos = t.startsolid ? [...e2] as V3 : t.end; hc.vel = [...pl.vel] as V3;
      if (hc.R) hc.R = mul(M, hc.R); }
    this.tr.ignore = null;
    this.io.log.push(`${this.io.time.toFixed(2)} teleport ${a.name} -> ${b.name}`);
  }
  /** src: fire from somewhere else (the a01 pedestal gun's FirePortal1 input) */
  shootPortal(which: 0 | 1, src?: { eye: V3; f: V3 }) {
    if (!src && (!this.hasGun || !this.canFire[which])) return;
    const eye = src ? src.eye : this.player.eye(); const f = src ? src.f : angleVectors(this.player.ang).f;
    this.tr.ignore = null;
    const t = this.tr.trace(eye, ma(eye, 8192, f), [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, this.playerEnt);
    if (t.fraction >= 1 || t.ent) return this.fizzleShot(which, 'nothing');
    // find the surface flags of the brush side we hit
    const n = t.normal; let flags = 0, texd = -1;
    if (t.hit >= 0) { const br = this.bsp.brushes[t.hit]; let best = -1;
      for (let i = 0; i < br.numSides; i++) { const sd = this.bsp.brushSides[br.firstSide + i]; const pl = this.bsp.planes[sd.plane]; const dd = dot(pl.n, n); if (dd > 0.99 && sd.texinfo >= 0 && Math.abs(dot(pl.n, t.end) - pl.d) < 2) { best = sd.texinfo; break; } }
      if (best >= 0) { flags = this.bsp.texinfo[best].flags; texd = this.bsp.texinfo[best].texdata; } }
    const matName = texd >= 0 ? this.bsp.texdata[texd].name : '';
    const mat = texd >= 0 ? this.r.world.mats[texd] : null;
    if (flags & SURF.NOPORTAL || mat?.noportal || /toolsnodraw|toolsblack|toolsclip/.test(matName)) return this.fizzleShot(which, 'noportal ' + matName);
    let up: V3;
    if (Math.abs(n[2]) > 0.7) { const pf = angleVectors([0, this.player.ang[1], 0]).f; up = n[2] > 0 ? pf : scale(pf, -1); up = norm(sub(up, scale(n, dot(up, n)))); }
    else up = norm(sub([0, 0, 1], scale(n, n[2])));
    const right = cross(up, n); // r = up x f ... ensure right-handed: f x r = u? (Source: right = f x up)
    const rr = norm(cross(n, up)); void right;
    let pos = ma(t.end, 0, n);
    const other = this.gunPortals[1 - which];
    const fits = (c: V3) => {
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const pt = add(add(c, scale(rr, a * (PW - 1))), scale(up, b * (PH - 1)));
        const s = ma(pt, 2, n), e2 = ma(pt, -2, n); const q = this.tr.trace(s, e2, [0, 0, 0], [0, 0, 0], MASK_SHOT_PORTAL, this.playerEnt);
        if (q.fraction >= 1 || q.startsolid || dot(q.normal, n) < 0.99 || q.ent) return false;
        if (q.hit >= 0) { const br = this.bsp.brushes[q.hit]; for (let i = 0; i < br.numSides; i++) { const sd = this.bsp.brushSides[br.firstSide + i]; const pl = this.bsp.planes[sd.plane];
          if (dot(pl.n, n) > 0.99 && sd.texinfo >= 0 && Math.abs(dot(pl.n, q.end) - pl.d) < 2) { const ti = this.bsp.texinfo[sd.texinfo]; if (ti.flags & SURF.NOPORTAL || this.r.world.mats[ti.texdata]?.noportal) return false; break; } } }
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
        if (q.fraction >= 1 || dot(q.normal, n) < 0.99 || q.startsolid) { pos = add(pos, scale(ax, -sgn * 4)); moved = true; }
      }
      if (!moved) break; ok = fits(pos);
    }
    if (!ok) return this.fizzleShot(which, 'no fit');
    const p = this.gunPortals[which];
    p.pos = pos; p.f = [...n] as V3; p.u = up; p.r = rr; p.open = true; this.portalBrushes.delete(p); this.stats.portalsPlaced++;
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
    const doorMove = (e: Ent, open: boolean) => { if (e.locked) return; this.wakeCubes(); const target = open ? 1 : 0; if (e.state === target && e.moving !== true) return; e.state = target; e.moving = true; io.fire(e, open ? 'onopen' : 'onclose', null); };
    H.set('func_door', (e, i) => {
      if (i === 'open') doorMove(e, true); else if (i === 'close') doorMove(e, false); else if (i === 'toggle') doorMove(e, e.state === 0);
      else if (i === 'lock') e.locked = true; else if (i === 'unlock') e.locked = false; else if (i === 'setspeed') { /* ignore */ }
      return true;
    });
    H.set('func_brush', (e, i) => { if (i === 'enable') e.enabled = true; else if (i === 'disable') e.enabled = false; else if (i === 'toggle') e.enabled = !e.enabled; else return false; this.wakeCubes(); if (e.inst) e.inst.visible = e.enabled; return true; });
    const propVis = (e: Ent, i: string, param: string) => { if (e.cube && (i === 'wake' || i === 'enablemotion')) { e.cube.asleep = false; e.cube.sleep = 0; return true; } if (e.cube && (i === 'sleep' || i === 'disablemotion')) { e.cube.asleep = true; return true; } if (!e.prop) return false; if (i === 'turnon' || i === 'enable') e.prop.visible = true; else if (i === 'turnoff' || i === 'disable') e.prop.visible = false; else if (i === 'skin') return true; else if (i === 'setanimation') { this.playAnim(e, param, false); }
      else if (i === 'setdefaultanimation') { e.defaultAnim = param; }
      else if (i === 'setplaybackrate') { e.prop.rate = +param || 0; }
      else return false; return true; };
    H.set('prop_dynamic', propVis); H.set('prop_dynamic_override', propVis); H.set('prop_physics', propVis);
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
    const rotDoor = (e: Ent, i: string, param: string) => { if (i === 'open' && !e.locked) { e.state = 1; e.moving = true; io.fire(e, 'onopen', null); } else if (i === 'close') { e.state = 0; e.moving = true; io.fire(e, 'onclose', null); }
      else if (i === 'toggle') { e.state = 1 - e.state; e.moving = true; } else if (i === 'lock') e.locked = true; else if (i === 'unlock') e.locked = false; else if (i === 'setspeed') e.speed = +param || e.speed; else return false; return true; };
    H.set('func_door_rotating', rotDoor); H.set('prop_door_rotating', rotDoor);
    H.set('func_tracktrain', (e, i) => { if (i === 'startforward' || i === 'resume') { e.speedNow = e.startspeed; if (!e.pathName && e.curPath) { io.fire(e.curPath, 'onpass', null); e.speedNow = 0; } } else if (i === 'stop') e.speedNow = 0; else if (i === 'startbackward') e.speedNow = -e.startspeed; else if (i === 'setspeed') { } return true; });
    H.set('trigger_changelevel', (e, i) => { if (i === 'changelevel') this.changeLevel?.(e.kv.map, (e.kv.landmark || '').toLowerCase()); return true; });
    H.set('point_template', (e, i) => { if (i === 'forcespawn') this.respawnTemplate(e, null); return true; });
    H.set('env_entity_maker', (e, i) => { if (i === 'forcespawn') { const t = io.find(e.kv.entitytemplate, null, e)[0]; if (t) this.respawnTemplate(t, e.origin); } return true; });
    H.set('env_hudhint', (e, i) => { if (i === 'showhudhint') { this.hud.hint = e.kv.message || ''; this.hud.hintT = io.time + 4; } else if (i === 'hidehudhint') this.hud.hint = ''; return true; });
    H.set('env_fade', (e, i) => { if (i !== 'fade') return true; const from = +e.kv.spawnflags & 1; const dur = +(e.kv.duration || 1), hold = +(e.kv.holdtime || 0);
      if (from) { this.hud.fade = 1; this.hud.fadeTarget = 0; this.hud.fadeRate = 1 / Math.max(0.01, dur); this.hud.fadeHoldUntil = io.time + hold; } else { this.hud.fadeTarget = 1; this.hud.fadeRate = 1 / Math.max(0.01, dur); } return true; });
    H.set('trigger_portal_cleanser', (e, i) => { if (i === 'fizzleTouchingPortals'.toLowerCase()) this.fizzleGunPortals(); return false; });
    H.set('ambient_generic', (e, i, p) => { const sn = this.snd; const fl = +(e.kv.spawnflags || 0);
      const start = () => { e.sndH?.stop(); if (!sn) return; const msg = e.kv.message || ''; e.sndH = sn.play(msg, e.pos || e.origin, { vol: Math.min(1, +(e.kv.health ?? 10) / 10), everywhere: !!(fl & 1), loop: fl & 32 ? false : undefined, music: /^portal\.song|music\//i.test(msg) }); this.io.log.push(`${io.time.toFixed(2)} sound ${msg}`); };
      if (i === 'playsound') start(); else if (i === 'stopsound') e.sndH?.stop(); else if (i === 'togglesound') { if (e.sndH && !e.sndH.stopped) e.sndH.stop(); else start(); }
      else if (i === 'volume' && e.sndH?.src) { /* runtime volume changes are ignored */ void p; } return true; });
    H.set('trigger_teleport', () => false); H.set('trigger_once', () => false); H.set('trigger_multiple', () => false);
    H.set('player', (e, i) => { if (i === 'sethealth') {} return true; });
    H.set('func_noportal_volume', () => false);
    H.set('logic_auto', () => true);
  }
  respawnTemplate(t: Ent, at: V3 | null) {
    // point_template: spawn fresh copies of the template entities (only physics cubes matter for these maps)
    const names = Object.entries(t.kv).filter(([k]) => /^template\d\d$/.test(k)).map(([, v]) => v.toLowerCase());
    for (const n of names) for (const src of this.io.byName.get(n) || []) {
      if (!src.cube || src.isCopy) continue;
      const kv = { ...src.kv, origin: (at || src.origin).join(' ') }; if (!(+t.kv.spawnflags & 2)) delete (kv as any).targetname;
      const e = new Ent(kv); e.isCopy = true; e.game = this; e.pos = [...e.origin] as V3; this.io.add(e); this.spawnCube(e);
      this.io.log.push(`${this.io.time.toFixed(2)} spawned ${n} at ${e.origin.map(v => v | 0)}`); break;
    }
  }
  // ---------- per-tick update ----------
  /** start a sequence by name on a prop entity (applied once the model has loaded) */
  /** current world matrix of an entity (brush, prop, mover or point) */
  entWorld(e: Ent): Float32Array { if (e.worldM && e.kv.parentname) return e.worldM; return entityMatrix(e.pos || e.origin, e.ang || e.angles); }
  playAnim(e: Ent, name: string, isDefault: boolean) {
    const pr = e.prop; if (!pr || !name) return;
    const apply = () => { const m = pr.model; if (!m) return; const si = findSeq(m, name); if (si < 0) return;
      pr.seq = si; pr.cycle = 0; pr.rate = pr.rate ?? 1; pr.loop = m.skel.seqs[si].looping;
      pr.onDone = isDefault ? undefined : () => { this.io.fire(e, 'onanimationdone', e); const d = e.defaultAnim || e.kv.defaultanim; if (d && d.toLowerCase() !== name.toLowerCase()) this.playAnim(e, d, true); }; };
    if (pr.model) apply(); else this.models.get(e.kv.model).then(apply);
  }
  animateProps(dt: number) {
    for (const pr of this.r.props) { const m = pr.model; if (!m || pr.seq === undefined || !pr.visible) continue;
      const sq = m.skel.seqs[pr.seq]; if (!sq) continue;
      const dur = Math.max(1, sq.frames - 1) / (sq.fps || 30);
      if (sq.frames > 1 && pr.rate) { let c = (pr.cycle || 0) + dt * pr.rate / dur;
        if (c >= 1) { if (pr.loop) c %= 1; else { c = 1; if (pr.onDone) { const f = pr.onDone; pr.onDone = undefined; f(); } } } pr.cycle = c; }
      const key = pr.seq + ':' + (pr.cycle || 0).toFixed(3);
      if (pr.posed !== key && pr.seq !== undefined) { if (pr.seq === 0 && !pr.cycle && !pr.skinned) { pr.posed = key; continue; } pr.skinned = skinModel(this.r.gl, m, pr.skinned || null, pr.seq, pr.cycle || 0); pr.posed = key; }
    }
  }
  update(dt: number, input: { fwd: number; side: number; jump: boolean; duck: boolean }) {
    this.animateProps(dt); this.r.time += dt;
    const io = this.io; io.update(dt);
    for (const e of io.ents) {
      if (e.killed) continue;
      if (e.cls === 'logic_timer' && e.enabled) { e.next -= dt; if (e.next <= 0) { io.fire(e, 'ontimer', null); const lo = +(e.kv.lowerrandombound || 0), hi = +(e.kv.upperrandombound || 0);
        e.next = e.kv.userandomtime === '1' ? lo + Math.random() * (hi - lo) : +(e.kv.refiretime || 1); if (e.next <= 0) e.next = 1; } }
      if (e.cls === 'func_door' && e.moving) {
        const dist = len(sub(e.openPos, e.closedPos)) || 1; const step = e.speed * dt / dist; const tgt = e.state;
        const before = e.t; e.t = tgt ? Math.min(1, e.t + step) : Math.max(0, e.t - step);
        // don't crush: if the door would move into the player, stop for this tick
        const np = add(e.closedPos, scale(sub(e.openPos, e.closedPos), e.t)); const old = e.pos.slice(); e.pos[0] = np[0]; e.pos[1] = np[1]; e.pos[2] = np[2];
        this.tr.ignore = null; const pt = this.tr.trace(this.player.pos, this.player.pos, HULL.mins, this.player.maxs(), 0xffffffff, this.playerEnt);
        if (pt.startsolid && pt.ent === e) { const d = sub(np, old as V3); if (d[2] > 0 && Math.abs(d[2]) > Math.abs(d[0]) + Math.abs(d[1])) { this.player.pos = add(this.player.pos, d); } else { e.pos[0] = old[0]; e.pos[1] = old[1]; e.pos[2] = old[2]; e.t = before; } }
        if (e.t === tgt) { e.moving = false; io.fire(e, tgt ? 'onfullyopen' : 'onfullyclosed', null); }
      }
      if (e.cls === 'func_tracktrain' && e.speedNow) {
        const path = io.find(e.pathName, null, e)[0];
        if (!path) e.speedNow = 0; else {
          const to = sub(path.origin, e.pos); const d = len(to); const step = Math.abs(e.speedNow) * dt;
          const mv = d <= step ? to : scale(to, step / d); e.pos[0] += mv[0]; e.pos[1] += mv[1]; e.pos[2] += mv[2];
          if (this.player.groundEnt === e || this.onTrain(e)) this.player.pos = add(this.player.pos, mv);
          if (d <= step) { e.curPath = path; io.fire(path, 'onpass', null); const nxt = (path.kv.target || '').toLowerCase(); if (nxt) e.pathName = nxt; else { e.speedNow = 0; } }
        }
      }
      if (e.cls === 'func_rotating') { const target = e.spinning ? e.maxspeed : 0; const acc = Math.max(1, e.maxspeed) * dt / Math.max(0.1, +(e.kv.fanfriction || 20) / 20);
        e.spinSpeed += Math.sign(target - e.spinSpeed) * Math.min(Math.abs(target - e.spinSpeed), acc); e.ang[e.axis] = (e.ang[e.axis] + e.spinSpeed * e.spinDir * dt) % 360; }
      if (e.closedAng && e.moving) { const span = Math.max(...e.openAng.map((v: number, k: number) => Math.abs(v - e.closedAng[k]))) || 1;
        const st = e.speed * dt / span; e.t = e.state ? Math.min(1, e.t + st) : Math.max(0, e.t - st);
        if (e.t === e.state) { e.moving = false; io.fire(e, e.state ? 'onfullyopen' : 'onfullyclosed', null); } }
      if (e.closedAng) for (let k = 0; k < 3; k++) e.ang[k] = e.closedAng[k] + (e.openAng[k] - e.closedAng[k]) * e.t;
      if (e.inst && e.pos) { e.inst.matrix = entityMatrix(e.pos, e.ang || e.angles); if (e.col && e.ang) e.col.rot = e.inst.matrix; }
      if (e.prop && e.ang && !e.kv.parentname) e.prop.matrix = entityMatrix(e.pos, e.ang);
      if (e.platform) { e.platform.mins = add(e.pos, e.platMins); e.platform.maxs = add(e.pos, e.platMaxs); }
    }
    // hierarchy: child = parent(now) * inverse(parent at attach time) * child at attach time (full rotation + translation)
    for (let pass = 0; pass < 2; pass++) for (const e of io.ents) if (e.kv.parentname && (e.prop || e.inst || e.cube) && !e.killed) {
      const par = io.find(e.kv.parentname.split(',')[0], null, e)[0]; if (!par || !par.pos || par === e) continue;
      const P = this.entWorld(par); if (!e.attachRel || e.attachTo !== par) { e.attachTo = par; const now = e.reparentNow; e.reparentNow = false;
        e.attachRel = now ? mul(invertRigid(P), e.prop ? e.prop.matrix : e.inst ? e.inst.matrix : this.entWorld(e)) : mul(invertRigid(par.spawnM || P), e.spawnM || entityMatrix(e.origin, e.angles));
        e.attachAngInv = e.closedAng || e.cls === 'func_rotating' ? invertRigid(entityMatrix(e.origin, e.ang)) : null; }
      // a child that also rotates on its own (rotating door / func_rotating on a moving parent): apply its local spin about its own origin
      const W = e.attachAngInv ? mul(P, mul(e.attachRel, mul(e.attachAngInv, entityMatrix(e.origin, e.ang)))) : mul(P, e.attachRel); e.worldM = W;
      if (e.prop) e.prop.matrix = W;
      if (e.inst) { e.pos = [W[12], W[13], W[14]]; e.inst.matrix = W; if (e.col) { e.col.offset = e.pos; e.col.rot = W; } }
    }
    // player
    // teleport when the eye crosses the portal plane inside the hole (feet-first floor portals: eye crosses last)
    const prevC: V3 = this.player.eye();
    this.player.move(input, dt);
    const nowC: V3 = this.player.eye();
    for (const p of this.portals) if (p.open && p.linked && p.linked.open && this.crossed(p, prevC, nowC)) { this.teleportPlayer(p, p.linked); break; }
    this.tr.ignore = null;
    // cubes
    for (const c of this.cubes) if (c.alive) this.updateCube(c, dt);
    // triggers
    this.updateGunPickup(); this.updateMMC();
    this.updateTriggers();
    if (this.hud.hint && io.time > this.hud.hintT) this.hud.hint = '';
    if (this.hud.fadeHoldUntil && io.time < this.hud.fadeHoldUntil) {} else if (this.hud.fade !== this.hud.fadeTarget) { const s = this.hud.fadeRate * dt; this.hud.fade = this.hud.fade < this.hud.fadeTarget ? Math.min(this.hud.fadeTarget, this.hud.fade + s) : Math.max(this.hud.fadeTarget, this.hud.fade - s); }
    // held-cube prop matrix
    for (const c of this.cubes) { const m = new Float32Array(c.R); m[12] = c.pos[0]; m[13] = c.pos[1]; m[14] = c.pos[2]; m[15] = 1; c.prop.matrix = m; }
  }
  onTrain(e: Ent) { const p = this.player.pos; const lo = e.platform ? e.platMins : this.bsp.models[e.model].mins, hi = e.platform ? e.platMaxs : this.bsp.models[e.model].maxs; return p[0] > e.pos[0] + lo[0] - 16 && p[0] < e.pos[0] + hi[0] + 16 && p[1] > e.pos[1] + lo[1] - 16 && p[1] < e.pos[1] + hi[1] + 16 && Math.abs(p[2] - (e.pos[2] + hi[2])) < 4; }
  updateCube(c: Cube, dt: number) {
    const mins: V3 = [-c.ext, -c.ext, -c.ext], maxs: V3 = [c.ext, c.ext, c.ext];
    const prev: V3 = [...c.pos] as V3;
    c.ent.box.mins = [1e9, 1e9, 1e9]; c.ent.box.maxs = [1e9, 1e9, 1e9]; // don't collide with itself
    if (c.held) {
      const eye = this.player.eye(); const { f } = angleVectors(this.player.ang);
      let want = ma(eye, 56, f); if (c.viaPortal) { const vp = c.viaPortal; if (vp.open && vp.linked?.open) want = xformPoint(throughPortal(vp, vp.linked), want); else c.viaPortal = null; }
      this.tr.ignore = this.tunnelFor(c.pos, mins, maxs);
      const t = this.tr.trace(c.pos, want, mins, maxs, 0x1 | 0x2 | 0x8 | 0x4000, this.playerEnt);
      c.vel = scale(sub(t.end, c.pos), 1 / Math.max(dt, 1e-3)); c.pos = t.end; c.asleep = false; c.w = [0, 0, 0];
      if (c.Rrel && !c.viaPortal) c.R = mul(entityMatrix([0, 0, 0], [0, this.player.ang[1], 0]), c.Rrel);
      if (len(sub(c.pos, want)) > 80) { c.held = false; this.held = null; c.viaPortal = null; }
    } else {
      const Z: V3 = [0, 0, 0]; const mask = 0x1 | 0x2 | 0x8 | 0x4000;
      this.tr.ignore = this.tunnelFor(c.pos, mins, maxs);
      const tf = (p: V3, q: V3) => this.tr.trace(p, q, Z, Z, mask, this.playerEnt);
      const ns = stepBody(c, dt, tf);
      c.onGround = ns.some(n => n[2] > 0.7);
      if (c.pos[2] < -16000) c.ent.game.io.fire(c.ent, 'onoutofworld', c.ent);
    }
    this.tr.ignore = null;
    for (const p of this.portals) if (p.open && p.linked && p.linked.open && this.crossed(p, prev, c.pos)) {
      const M = throughPortal(p, p.linked); c.pos = xformPoint(M, c.pos); c.vel = xformDir(M, c.vel); c.w = xformDir(M, c.w); c.R = mul(M, c.R); c.R[12] = c.R[13] = c.R[14] = 0; c.asleep = false;
      const out = dot(c.vel, p.linked.f); if (out < 60) c.vel = ma(c.vel, 60 - out, p.linked.f);
      // held cubes stay held: the grab point is then seen through the portal (like Source's grab-through-portal)
      if (c.held) c.viaPortal = c.viaPortal === p.linked ? null : p; break;
    }
    this.updateCubeBox(c);
  }
  /** something the cubes might rest on changed (a brush toggled, a door moved): let sleeping cubes re-check their support */
  wakeCubes() { for (const c of this.cubes) { c.asleep = false; c.sleep = 0; } }
  use() {
    if (this.held) { const c = this.held; c.held = false; c.vel = scale(c.vel, 0.25); c.asleep = false; this.held = null; return; }
    const eye = this.player.eye(); const { f } = angleVectors(this.player.ang);
    let best: Cube | null = null, bd = 90;
    for (const c of this.cubes) { if (!c.alive) continue; const d = sub(c.pos, eye); const along = dot(d, f); if (along < 0 || along > 100) continue; const perp = len(sub(d, scale(f, along))); if (perp < c.ext + 10 && along < bd) { bd = along; best = c; } }
    if (best) { best.Rrel = mul(invertRigid(entityMatrix([0, 0, 0], [0, this.player.ang[1], 0])), best.R); best.held = true; this.held = best; this.io.fire(best.ent, 'onplayerpickup', this.playerEnt); }
    else {
      // +use on func_button etc.
      this.tr.ignore = null; const t = this.tr.trace(eye, ma(eye, 96, f), [0, 0, 0], [0, 0, 0], 0xffffffff, this.playerEnt);
      if (t.ent && t.ent.cls === 'func_button') this.io.fire(t.ent, 'onpressed', this.playerEnt);
    }
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
    this.hasGunBefore = true; g.killed = true; g.onKill?.(); this.io.fire(g, 'onplayerpickup', this.playerEnt); this.io.log.push(`${this.io.time.toFixed(2)} picked up ${g.name} (blue ${this.canFire[0]}, orange ${this.canFire[1]})`);
  }
  mmcs = new Set<any>();
  updateMMC() { for (const e of this.mmcs) { const L = e.lerp; if (!L) { this.mmcs.delete(e); continue; } let u = (this.io.time - L.t0) / L.d;
      if (u >= 1) { if (L.loop) u = u % 1; else { u = 1; e.lerp = null; } } L.ins.texFrame = Math.floor(L.a + (L.b - L.a) * u); } }
  hasGunBefore = false;
  updateTriggers() {
    const io = this.io; const pl = this.player; const pmin = add(pl.pos, HULL.mins), pmax = add(pl.pos, pl.maxs());
    const overlap = (a0: V3, a1: V3, b0: V3, b1: V3) => a0[0] < b1[0] && a1[0] > b0[0] && a0[1] < b1[1] && a1[1] > b0[1] && a0[2] < b1[2] && a1[2] > b0[2];
    for (const e of io.ents) {
      if (!e.touching || e.killed || !e.bmins) continue;
      const sf = +(e.kv.spawnflags || 0); const now = new Set<Ent>();
      if (e.enabled) {
        if ((sf & 1 || sf & 64 || e.cls === 'trigger_changelevel') && overlap(pmin, pmax, e.bmins, e.bmaxs)) now.add(this.playerEnt);
        if (sf & 8 || sf & 64 || e.cls === 'trigger_portal_cleanser') for (const c of this.cubes) if (c.alive && overlap(sub(c.pos, [c.ext, c.ext, c.ext]), add(c.pos, [c.ext, c.ext, c.ext]), e.bmins, e.bmaxs)) now.add(c.ent);
        if (e.kv.filtername) { const f = io.find(e.kv.filtername, null, e)[0]; if (f) for (const a of [...now]) if (!this.passFilter(f, a)) now.delete(a); }
      }
      for (const a of now) if (!e.touching.has(a)) {
        e.touching.add(a); io.fire(e, 'onstarttouch', a);
        if (e.cls === 'trigger_once') { io.fire(e, 'ontrigger', a); e.killed = true; }
        else if (e.cls === 'trigger_multiple') { if (!e.waitUntil || io.time >= e.waitUntil) { io.fire(e, 'ontrigger', a); e.waitUntil = io.time + Math.max(0.1, +(e.kv.wait ?? 0.2)); } }
        else if (e.cls === 'trigger_teleport') { const d = io.find(e.kv.target, null, e)[0]; if (d && a === this.playerEnt) { pl.pos = [...d.origin] as V3; pl.vel = [0, 0, 0]; pl.ang = [0, d.angles[1], 0]; } }
        else if (e.cls === 'trigger_portal_cleanser') { if (a === this.playerEnt) { if (this.gunPortals.some(p => p.open)) io.fire(e, 'onfizzle', a); this.fizzleGunPortals(); } else if (a.cube) { io.fire(e, 'ondissolvebox', a); io.fire(e, 'ondissolve', a); a.killed = true; a.onKill?.(); } }
        else if (e.cls === 'trigger_changelevel' && !(sf & 2) && a === this.playerEnt) this.changeLevel?.(e.kv.map, (e.kv.landmark || '').toLowerCase());
      }
      for (const a of [...e.touching]) if (!now.has(a)) { e.touching.delete(a); io.fire(e, 'onendtouch', a); if (!e.touching.size) io.fire(e, 'onendtouchall', a); }
      if (e.cls === 'trigger_multiple' && e.touching.size && e.waitUntil && io.time >= e.waitUntil && +(e.kv.wait ?? 0) >= 0 && false) {}
    }
  }
  passFilter(f: Ent, a: Ent) {
    let ok = true;
    if (f.cls === 'filter_activator_name') ok = a.name === (f.kv.filtername || '').toLowerCase();
    else if (f.cls === 'filter_activator_class') ok = (a.cube ? 'prop_physics' : a.cls) === (f.kv.filterclass || '').toLowerCase();
    if (f.kv.negated === '1') ok = !ok; return ok;
  }
}
