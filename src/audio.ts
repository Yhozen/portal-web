// Sound: soundscripts, WAV (PCM via the browser, Microsoft ADPCM decoded here), MP3 via decodeAudioData,
// scene summaries from scenes/scenes.image and English closed captions.
// Formats from public docs: scenes.image layout from the public Source SDK 2013 SceneImageFile.h;
// MS ADPCM from Microsoft's published RIFF/ADPCM spec; captions from the plain-text closecaption_english.txt.
import type { Assets } from './assets.ts';
import type { V3 } from './math.ts';

export interface SoundScript { waves: string[]; volume: number; level: number; channel: string; }
export interface SceneInfo { msecs: number; sounds: string[]; }

/** tiny KeyValues tokenizer that keeps duplicate keys (rndwave blocks list several "wave" keys) */
function kvTokens(t: string): string[] { const out: string[] = []; let i = 0;
  while (i < t.length) { const c = t[i];
    if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '{' || c === '}') { out.push(c); i++; continue; }
    if (c === '"') { let j = i + 1; while (j < t.length && t[j] !== '"') j++; out.push(t.slice(i + 1, j)); i = j + 1; continue; }
    let j = i; while (j < t.length && !/[\s{}"]/.test(t[j])) j++; out.push(t.slice(i, j)); i = j; }
  return out; }

const SNDLVL: Record<string, number> = { sndlvl_none: 0, sndlvl_norm: 75, sndlvl_idle: 60, sndlvl_talking: 60, sndlvl_static: 66, sndlvl_gunfire: 140 };

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(s: string) { let c = 0xffffffff; for (let i = 0; i < s.length; i++) c = crcTable[(c ^ s.charCodeAt(i)) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** decode a RIFF WAVE with Microsoft ADPCM (format tag 2) to float PCM */
export function decodeMSADPCM(buf: ArrayBuffer): { rate: number; ch: Float32Array[] } | null {
  const dv = new DataView(buf); if (dv.getUint32(0, false) !== 0x52494646) return null;
  let p = 12, fmt = -1, fmtLen = 0, data = -1, dataLen = 0;
  while (p + 8 <= buf.byteLength) { const id = dv.getUint32(p, false), sz = dv.getUint32(p + 4, true);
    if (id === 0x666d7420) { fmt = p + 8; fmtLen = sz; } else if (id === 0x64617461) { data = p + 8; dataLen = Math.min(sz, buf.byteLength - p - 8); }
    p += 8 + sz + (sz & 1); }
  if (fmt < 0 || data < 0 || dv.getUint16(fmt, true) !== 2) return null; void fmtLen;
  const nch = dv.getUint16(fmt + 2, true), rate = dv.getUint32(fmt + 4, true), block = dv.getUint16(fmt + 12, true);
  const spb = dv.getUint16(fmt + 18, true), ncoef = dv.getUint16(fmt + 20, true);
  const c1: number[] = [], c2: number[] = []; for (let i = 0; i < ncoef; i++) { c1.push(dv.getInt16(fmt + 22 + i * 4, true)); c2.push(dv.getInt16(fmt + 24 + i * 4, true)); }
  const AD = [230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230];
  const nblocks = Math.ceil(dataLen / block); const out = Array.from({ length: nch }, () => new Float32Array(nblocks * spb)); let w = 0;
  for (let b = 0; b < nblocks; b++) { let q = data + b * block; const end = Math.min(data + dataLen, q + block); if (q + 7 * nch > end) break;
    const pred: number[] = [], delta: number[] = [], s1: number[] = [], s2: number[] = [];
    for (let c = 0; c < nch; c++) pred.push(Math.min(ncoef - 1, dv.getUint8(q++)));
    for (let c = 0; c < nch; c++) { delta.push(dv.getInt16(q, true)); q += 2; }
    for (let c = 0; c < nch; c++) { s1.push(dv.getInt16(q, true)); q += 2; }
    for (let c = 0; c < nch; c++) { s2.push(dv.getInt16(q, true)); q += 2; }
    for (let c = 0; c < nch; c++) { out[c][w] = s2[c] / 32768; out[c][w + 1] = s1[c] / 32768; }
    let n = 2; let hi = true; let c = 0;
    const nib = (ci: number, v: number) => { const sv = v & 8 ? v - 16 : v; let s = ((s1[ci] * c1[pred[ci]] + s2[ci] * c2[pred[ci]]) >> 8) + sv * delta[ci];
      s = Math.max(-32768, Math.min(32767, s)); s2[ci] = s1[ci]; s1[ci] = s; delta[ci] = Math.max(16, (AD[v] * delta[ci]) >> 8); return s; };
    while (q < end && n < spb) { const byte = dv.getUint8(q);
      const v = hi ? byte >> 4 : byte & 15; out[c][w + n] = nib(c, v) / 32768;
      c++; if (c >= nch) { c = 0; n++; } if (!hi) q++; hi = !hi; }
    w += spb; }
  return { rate, ch: out.map(a => a.subarray(0, w)) };
}
function wavInfo(b: ArrayBuffer) { const dv = new DataView(b); if (b.byteLength < 12 || dv.getUint32(0, false) !== 0x52494646) return null;
  let p = 12, tag = 0, cue = false; while (p + 8 <= b.byteLength) { const id = dv.getUint32(p, false), sz = dv.getUint32(p + 4, true); if (id === 0x666d7420) tag = dv.getUint16(p + 8, true); if (id === 0x63756520) cue = true; p += 8 + sz + (sz & 1); }
  return { tag, cue }; }

export class Sound {
  ctx: AudioContext | null = null; master: GainNode | null = null; scripts = new Map<string, SoundScript>(); captions = new Map<string, string>();
  scenes = new Map<number, number>(); sceneImg: DataView | null = null; buf = new Map<string, Promise<{ b: AudioBuffer; loop: boolean } | null>>();
  listener: V3 = [0, 0, 0]; onCaption: ((text: string, dur: number) => void) | null = null; ready: Promise<void>; music: AudioBufferSourceNode | null = null;
  constructor(public assets: Assets) { this.ready = this.init(); }
  private async init() {
    const man = await this.assets.text('scripts/game_sounds_manifest.txt');
    const files = man ? [...man.matchAll(/"precache_file"\s+"([^"]+)"/gi)].map(m => m[1]) : [];
    await Promise.all(files.map(async f => { const t = await this.assets.text(f); if (!t) return; const tk = kvTokens(t);
      for (let i = 0; i + 1 < tk.length; i++) { if (tk[i + 1] !== '{' || tk[i] === '{' || tk[i] === '}') continue;
        const name = tk[i].toLowerCase(); const s: SoundScript = { waves: [], volume: 1, level: 75, channel: '' }; let d = 0, j = i + 1;
        for (; j < tk.length; j++) { const k = tk[j]; if (k === '{') { d++; continue; } if (k === '}') { if (--d === 0) break; continue; }
          const v = tk[j + 1]; if (v === undefined || v === '{' || v === '}') continue; const kl = k.toLowerCase();
          if (kl === 'wave') s.waves.push(v); else if (kl === 'volume') s.volume = parseFloat(v) || (v.includes('vol_norm') ? 1 : 1);
          else if (kl === 'soundlevel') s.level = SNDLVL[v.toLowerCase()] ?? (parseInt(v.replace(/\D+/g, '')) || 75); else if (kl === 'channel') s.channel = v; j++; }
        this.scripts.set(name, s); i = j; } }));
    const cc = await this.assets.read('resource/closecaption_english.txt');
    if (cc) { const t = new TextDecoder('utf-16le').decode(cc); const tk = kvTokens(t.replace(/^\ufeff/, ''));
      for (let i = 0; i + 1 < tk.length; i++) if (tk[i] !== '{' && tk[i] !== '}' && tk[i + 1] !== '{' && tk[i + 1] !== '}') { this.captions.set(tk[i].toLowerCase(), tk[i + 1]); i++; } }
    const si = await this.assets.read('scenes/scenes.image');
    if (si) { const dv = new DataView(si); if (dv.getUint32(0, true) === 0x46495356) { this.sceneImg = dv; const n = dv.getInt32(8, true), eo = dv.getInt32(16, true);
      for (let i = 0; i < n; i++) this.scenes.set(dv.getUint32(eo + i * 16, true), eo + i * 16); } }
  }
  sceneString(i: number) { const dv = this.sceneImg!; const o = dv.getUint32(20 + i * 4, true); let s = ''; for (let p = o; p < dv.byteLength; p++) { const c = dv.getUint8(p); if (!c) break; s += String.fromCharCode(c); } return s; }
  scene(file: string): SceneInfo | null { if (!this.sceneImg) return null;
    const key = file.toLowerCase().replace(/\//g, '\\'); const e = this.scenes.get(crc32(key.startsWith('scenes\\') ? key : 'scenes\\' + key)); if (e === undefined) return null;
    const dv = this.sceneImg, so = dv.getInt32(e + 12, true); const msecs = dv.getUint32(so, true), ns = dv.getInt32(so + 4, true); const sounds: string[] = [];
    for (let k = 0; k < ns; k++) sounds.push(this.sceneString(dv.getInt32(so + 8 + k * 4, true))); return { msecs, sounds }; }
  caption(name: string) { const t = this.captions.get(name.toLowerCase()); return t ? t.replace(/<[^>]*>/g, '').trim() : ''; }
  resolve(name: string): { path: string; vol: number; level: number } | null {
    const s = this.scripts.get(name.toLowerCase());
    if (s) { if (!s.waves.length) return null; return { path: s.waves[Math.floor(Math.random() * s.waves.length)], vol: s.volume, level: s.level }; }
    if (/\.(wav|mp3)$/i.test(name)) return { path: name, vol: 1, level: 75 }; return null; }
  unlock() { if (!this.ctx) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination); } else this.ctx.resume(); }
  private load(path: string) {
    const p = 'sound/' + path.replace(/^[*#@^)(}$!?<>&~]+/, '').replace(/\\/g, '/').toLowerCase();
    let pr = this.buf.get(p); if (pr) return pr;
    pr = this.assets.read(p).then(async b => { if (!b || !this.ctx) return null; const info = wavInfo(b);
      if (info && info.tag === 2) { const d = decodeMSADPCM(b); if (!d) return null; const ab = this.ctx.createBuffer(d.ch.length, d.ch[0].length || 1, d.rate); d.ch.forEach((c, i) => ab.copyToChannel(c, i)); return { b: ab, loop: info.cue }; }
      try { return { b: await this.ctx.decodeAudioData(b.slice(0)), loop: !!info?.cue }; } catch { return null; } });
    this.buf.set(p, pr); return pr; }
  /** play a soundscript name or raw path. Returns a handle with stop(). */
  play(name: string, pos?: V3, opt: { vol?: number; loop?: boolean; everywhere?: boolean; music?: boolean } = {}) {
    const r = this.resolve(name); const h = { src: null as AudioBufferSourceNode | null, stopped: false, dur: 0, stop() { this.stopped = true; try { this.src?.stop(); } catch { /* */ } } };
    if (!r || !this.ctx) return h;
    this.load(r.path).then(x => { if (!x || !this.ctx || h.stopped) return; const s = this.ctx.createBufferSource(); s.buffer = x.b; s.loop = opt.loop ?? x.loop;
      let vol = (opt.vol ?? 1) * r.vol;
      if (pos && !opt.everywhere && r.level > 0) { const d = Math.hypot(pos[0] - this.listener[0], pos[1] - this.listener[1], pos[2] - this.listener[2]); const radius = 20 * Math.pow(2, (r.level - 60) / 6) * 40; vol *= Math.max(0, 1 - d / radius); }
      const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g).connect(this.master!); s.start(); h.src = s; h.dur = x.b.duration;
      if (opt.music) { this.music?.stop(); this.music = s; } });
    return h; }
}
