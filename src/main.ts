import { BSP } from './bsp.ts';
import { Assets } from './assets.ts';
import { Zip } from './zip.ts';
import { buildWorld } from './world.ts';
import { MaterialCache } from './materials.ts';
import { Renderer } from './render.ts';
import { ModelCache } from './models.ts';
import { Game } from './game.ts';
import { angleVectors, perspective, viewFrom, parseV3, type V3, sub, add } from './math.ts';

declare global { interface Window { game: any; } }
const log = (...a: any[]) => { console.log(...a); const el = document.getElementById('log'); if (el) el.textContent = a.join(' ') + '\n' + el.textContent!.slice(0, 2000); };

async function main() {
  const q = new URLSearchParams(location.search); const mapName = q.get('map') || 'testchmb_a_00';
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2', { stencil: true, antialias: false, powerPreference: 'high-performance' })!;
  if (!gl) throw new Error('WebGL2 not available');
  const t0 = performance.now(); const assets = new Assets();
  log('loading', mapName);
  const buf = await assets.read(`maps/${mapName}.bsp`); if (!buf) throw new Error('map not found');
  const tFetch = performance.now();
  const bsp = new BSP(buf); if (bsp.pakfile) assets.pak = new Zip(bsp.pakfile);
  const mats = new MaterialCache(gl, assets); const r = new Renderer(gl, mats); const models = new ModelCache(gl, assets, mats);
  const mesh = buildWorld(bsp, n => n.startsWith('tools/'));
  await r.setWorld(bsp, mesh);
  const game = new Game(bsp, r, models);
  if (q.get('fast') !== '0') game.io.timeScale = +(q.get('fast') || 0.15); // shorten long scripted waits (intro VO) by default
  game.hasGun = q.get('gun') !== '0';
  await models.idle();
  const tLoad = performance.now();
  log(`bsp v${bsp.version} ${bsp.faces.length} faces, ${mesh.faceTris} tris, ${bsp.texdata.length} materials, ${r.props.length} props; fetch ${(tFetch - t0) | 0}ms, total ${(tLoad - t0) | 0}ms, ${(assets.bytes / 1e6).toFixed(1)}MB/${assets.requests} req`);
  // localized HUD strings (resource/portal_english.txt is UTF-16)
  const loc = new Map<string, string>();
  try { const b = await assets.read('resource/portal_english.txt'); if (b) { const t = new TextDecoder('utf-16le').decode(b); for (const m of t.matchAll(/"([^"]+)"\s+"([^"]*)"/g)) loc.set(m[1].toLowerCase(), m[2]); } } catch { }
  const keyName: Record<string, string> = { '+use': 'E', '+attack': 'LMB', '+attack2': 'RMB', '+jump': 'SPACE', '+duck': 'CTRL', '+forward': 'W', '+back': 'S', '+moveleft': 'A', '+moveright': 'D' };
  const localize = (s: string) => (loc.get(s.replace(/^#/, '').toLowerCase()) ?? s.replace(/^#/, '')).replace(/%([^%]+)%/g, (_, k) => keyName[k] || k);
  // spawn
  const pl = game.player; const start = bsp.entities.find(e => e.classname === 'info_player_start');
  pl.pos = parseV3(start?.origin); pl.ang = [0, parseV3(start?.angles)[1], 0];
  const lmName = q.get('landmark');
  if (lmName) { const lm = bsp.entities.find(e => e.classname === 'info_landmark' && (e.targetname || '').toLowerCase() === lmName);
    if (lm && q.get('lp')) { pl.pos = add(parseV3(lm.origin), q.get('lp')!.split(',').map(Number) as V3); pl.ang = (q.get('ang') || '0,0,0').split(',').map(Number) as V3; } }
  if (q.get('pos')) pl.pos = q.get('pos')!.split(',').map(Number) as V3;
  if (q.get('ang') && !lmName) pl.ang = q.get('ang')!.split(',').map(Number) as V3;
  game.changeLevel = (map, lm) => {
    const from = bsp.entities.find(e => e.classname === 'info_landmark' && (e.targetname || '').toLowerCase() === lm);
    const u = new URLSearchParams(q); u.set('map', map); u.delete('pos');
    if (from) { u.set('landmark', lm); u.set('lp', sub(pl.pos, parseV3(from.origin)).map(v => v.toFixed(1)).join(',')); u.set('ang', pl.ang.map(v => v.toFixed(1)).join(',')); }
    log('changelevel', map); if (q.get('nochange') !== '1') location.search = u.toString(); else (window as any).changedTo = map;
  };
  // sound (bonus): plain PCM wavs decode in the browser; others are skipped
  let actx: AudioContext | null = null; const sbuf = new Map<string, Promise<AudioBuffer | null>>();
  game.sounds = (path) => { if (!actx) return; const p = 'sound/' + path.replace(/^[*#@^)(}$!?<>]+/, '').toLowerCase();
    if (!sbuf.has(p)) sbuf.set(p, assets.read(p).then(b => b ? actx!.decodeAudioData(b.slice(0)).catch(() => null) : null));
    sbuf.get(p)!.then(b => { if (!b || !actx) return; const s = actx.createBufferSource(); s.buffer = b; const g = actx.createGain(); g.gain.value = 0.5; s.connect(g).connect(actx.destination); s.start(); }); };
  // input
  const keys = new Set<string>(); let noclip = false;
  addEventListener('keydown', e => { keys.add(e.code); if (document.pointerLockElement === canvas) e.preventDefault();
    if (e.code === 'KeyE' && !e.repeat) game.use(); if (e.code === 'KeyV' && !e.repeat) noclip = !noclip; if (e.code === 'KeyR' && !e.repeat) location.reload(); });
  addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('click', () => { canvas.requestPointerLock(); if (!actx) { actx = new AudioContext(); } });
  canvas.addEventListener('mousedown', e => { if (document.pointerLockElement !== canvas) return; if (e.button === 0) game.shootPortal(0); if (e.button === 2) game.shootPortal(1); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const sens = +(q.get('sens') || 2.5);
  addEventListener('mousemove', e => { if (document.pointerLockElement !== canvas) return; pl.ang[1] -= e.movementX * 0.022 * sens; pl.ang[0] = Math.max(-89, Math.min(89, pl.ang[0] + e.movementY * 0.022 * sens)); });
  const stats = { fps: 0, frames: 0, loadMs: tLoad - t0, draws: 0, frameMs: 0 };
  const hud = document.getElementById('hud')!, hint = document.getElementById('hint'), fade = document.getElementById('fade');
  const TICK = 1 / 66; let simAcc = 0;
  const step = (dt: number, inp = { fwd: 0, side: 0, jump: false, duck: false }) => {
    if (noclip) { const { f, r: rt } = angleVectors(pl.ang); const sp = (keys.has('ShiftLeft') ? 1000 : 400) * dt; pl.pos = add(pl.pos, add(f.map(v => v * inp.fwd * sp) as V3, rt.map(v => v * inp.side * sp) as V3)); pl.vel = [0, 0, 0]; game.io.update(dt); return; }
    game.update(dt, inp);
  };
  const render = () => {
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    const proj = perspective(75 * Math.PI / 180 * 0.82, canvas.width / canvas.height, 1, 16384);
    const eye = pl.eye(); const { f, r: rt, u } = angleVectors(pl.ang);
    r.frame(proj, viewFrom(eye, f, rt, u), eye); stats.frames++; stats.draws = r.stats.draws;
    if (hint) hint.textContent = game.hud.hint ? localize(game.hud.hint) : '';
    if (fade) fade.style.opacity = String(game.hud.fade);
  };
  window.game = { bsp, r, game, pl, stats, mats, assets, io: game.io, step, render,
    sim(seconds: number, inp?: any) { for (let t = 0; t < seconds; t += TICK) step(TICK, inp); render(); },
    look(p: number, y: number) { pl.ang = [p, y, 0]; } };
  let last = performance.now(), acc = 0, cnt = 0, fms = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; cnt++;
    if (acc > 1) { stats.fps = cnt / acc; stats.frameMs = fms / cnt; acc = 0; cnt = 0; fms = 0;
      hud.textContent = `${stats.fps.toFixed(0)} fps  ${stats.frameMs.toFixed(1)}ms  views ${r.stats.views}  draws ${r.stats.draws}  pos ${pl.pos.map(v => v.toFixed(0))}${noclip ? '  NOCLIP' : ''}${game.held ? '  [holding cube]' : ''}`; }
    const t1 = performance.now();
    if (!(window as any).paused) {
      const inp = { fwd: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), side: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), jump: keys.has('Space'), duck: keys.has('ControlLeft') || keys.has('KeyC') };
      simAcc += dt; while (simAcc >= TICK) { step(TICK, inp); simAcc -= TICK; }
    }
    if ((window as any).customRender) (window as any).customRender(); else render(); fms += performance.now() - t1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  (window as any).ready = true;
}
main().catch(e => { log('ERROR', e.stack || e); (window as any).loadError = String(e.stack || e); });
