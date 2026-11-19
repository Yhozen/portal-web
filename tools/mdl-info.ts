// mdl-info: print what a model's animation data says, straight from the MDL header (no engine code; layouts from the
// public Source SDK 2013 public/studio.h: studiohdr_t, mstudioseqdesc_t, mstudioanimdesc_t, mstudioevent_t,
// mstudioposeparamdesc_t, mstudiobonecontroller_t, mstudioautolayer_t). Used to check the port's playback against
// the data: fps, frame count, looping, blends, fades, events, external .ani blocks, $includemodel.
//   node tools/mdl-info.ts [--game DIR] [--json] [--bones] models/props/glados.mdl ...
//   node tools/mdl-info.ts [--game DIR] --survey [REGEX]    one line per animated model found in the VPKs
import { portalFS } from '../src/vpk.ts';
import { parseArgs } from 'node:util';
import { parseSkeleton, boneMatrices } from '../src/anim.ts';
const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { game: { type: 'string' }, json: { type: 'boolean' }, bones: { type: 'boolean' }, survey: { type: 'boolean' }, continuity: { type: 'boolean' }, seq: { type: 'string' } } });
const g = portalFS(opt.game || process.env.PORTAL_DIR || '/home/box/steam-games/portal-linux');
const SEQF: [number, string][] = [[1, 'looping'], [2, 'snap'], [4, 'delta'], [8, 'autoplay'], [0x10, 'post'], [0x20, 'allzeros'], [0x80, 'cyclepose'], [0x100, 'realtime'], [0x200, 'local'], [0x400, 'hidden'], [0x800, 'override'], [0x4000, 'world']];
const flagNames = (f: number) => SEQF.filter(([b]) => f & b).map(([, n]) => n);
const cstr = (dv: DataView, o: number) => { let s = ''; for (let p = o; p > 0 && p < dv.byteLength; p++) { const c = dv.getUint8(p); if (!c) break; s += String.fromCharCode(c); } return s; };

export function mdlInfo(buf: Buffer) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.length), i32 = (o: number) => dv.getInt32(o, true), f32 = (o: number) => +dv.getFloat32(o, true).toFixed(4);
  const name = cstr(dv, 12), version = i32(4), flags = i32(152);
  const bones = Array.from({ length: i32(156) }, (_, i) => { const o = i32(160) + i * 216; return { name: cstr(dv, o + i32(o)), parent: i32(o + 4), controllers: [0, 1, 2, 3, 4, 5].map(k => i32(o + 8 + k * 4)).filter(x => x >= 0) }; });
  const controllers = Array.from({ length: i32(164) }, (_, i) => { const o = i32(168) + i * 56; return { bone: i32(o), type: i32(o + 4), start: f32(o + 8), end: f32(o + 12), rest: i32(o + 16), input: i32(o + 20) }; });
  const anims = Array.from({ length: i32(180) }, (_, i) => { const o = i32(184) + i * 100; return { name: cstr(dv, o + i32(o + 4)), fps: f32(o + 8), flags: i32(o + 12), frames: i32(o + 16), movements: i32(o + 20), animblock: i32(o + 52), ikrules: i32(o + 60), sectionFrames: i32(o + 84) }; });
  const poses = Array.from({ length: i32(300) }, (_, i) => { const o = i32(304) + i * 20; return { name: cstr(dv, o + i32(o)), flags: i32(o + 4), start: f32(o + 8), end: f32(o + 12), loop: f32(o + 16) }; });
  const attachments = Array.from({ length: i32(240) }, (_, i) => { const o = i32(244) + i * 92; return { name: cstr(dv, o + i32(o)), bone: i32(o + 8) }; });
  const seqs = Array.from({ length: i32(188) }, (_, i) => { const o = i32(192) + i * 212;
    const gs = [i32(o + 68), i32(o + 72)], ai = Array.from({ length: gs[0] * gs[1] }, (_, k) => dv.getInt16(o + i32(o + 60) + k * 2, true));
    const events = Array.from({ length: i32(o + 24) }, (_, k) => { const e = o + i32(o + 28) + k * 80; return { cycle: f32(e), event: i32(e + 4), type: i32(e + 8), options: cstr(dv, e + 12), name: cstr(dv, e + i32(e + 76)) }; });
    const autolayers = Array.from({ length: i32(o + 148) }, (_, k) => { const a = o + i32(o + 152) + k * 24; return { seq: dv.getInt16(a, true), pose: dv.getInt16(a + 2, true), flags: i32(a + 4), start: f32(a + 8), peak: f32(a + 12), tail: f32(a + 16), end: f32(a + 20) }; });
    const a0 = anims[ai[0]];
    return { i, name: cstr(dv, o + i32(o + 4)), activity: cstr(dv, o + i32(o + 8)), actweight: i32(o + 20), flags: flagNames(i32(o + 12)), anims: ai, groupsize: gs, params: [i32(o + 76), i32(o + 80)],
      fps: a0?.fps, frames: a0?.frames, duration: a0 && a0.frames > 1 ? +((a0.frames - 1) / a0.fps).toFixed(3) : 0,
      fadein: f32(o + 104), fadeout: f32(o + 108), entrynode: i32(o + 112), exitnode: i32(o + 116), nodeflags: i32(o + 120), lastframe: f32(o + 132), nextseq: i32(o + 136), ikrules: i32(o + 144), events, autolayers,
      keyvalues: i32(o + 176) ? cstr(dv, o + i32(o + 172)) : '' };
  });
  const includes = Array.from({ length: i32(336) }, (_, i) => { const o = i32(340) + i * 8; return cstr(dv, o + i32(o + 4)); });
  return { name, version, flags, staticProp: !!(flags & 0x10), bones, controllers, poses, attachments, anims, seqs, includes, animblockName: i32(352) ? cstr(dv, i32(348)) : '', animblocks: i32(352) };
}

if (opt.survey) {
  const re = new RegExp(positionals[0] || '\\.mdl$', 'i'); const all = [...g.list('models')].filter(n => /\.mdl$/i.test(n) && re.test(n)).sort();
  const seen = new Set<string>();
  for (const n of all) { if (seen.has(n)) continue; seen.add(n); const b = g.read(n); if (!b) continue; let m; try { m = mdlInfo(b); } catch (e) { console.log(n, 'parse error', String(e)); continue; }
    const moving = m.seqs.filter(s => s.frames > 1); if (!moving.length && !m.includes.length) continue;
    console.log([n, 'bones', m.bones.length, 'seqs', m.seqs.length, 'moving', moving.length, m.animblocks ? 'ANI ' + m.animblockName + ' blocks ' + m.animblocks + ' ext-anims ' + m.anims.filter(a => a.animblock > 0).length : '', m.includes.length ? 'include ' + m.includes.join(',') : '',
      m.poses.length ? 'poses ' + m.poses.map(p => p.name).join(',') : '', m.controllers.length ? 'ctrl ' + m.controllers.length : '',
      'blends ' + m.seqs.filter(s => s.anims.length > 1).length, 'events ' + m.seqs.reduce((a, s) => a + s.events.length, 0), 'autolayers ' + m.seqs.reduce((a, s) => a + s.autolayers.length, 0), m.staticProp ? 'staticprop' : ''].filter(Boolean).join(' '));
  }
} else if (opt.continuity) {
  // biggest rotation between two bone matrices, degrees (from the trace of R1^T R2)
  function angBetween(A: Float32Array, B: Float32Array, b: number) { const o = b * 12; let tr = 0; for (let c = 0; c < 3; c++) { let n1 = 0, n2 = 0, d = 0; for (let r = 0; r < 3; r++) { n1 += A[o + r * 4 + c] ** 2; n2 += B[o + r * 4 + c] ** 2; d += A[o + r * 4 + c] * B[o + r * 4 + c]; } tr += d / Math.sqrt(n1 * n2 || 1); } return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180 / Math.PI; }
  for (const n of positionals) {
  // decode every frame of every sequence (or --seq NAME) and report the biggest frame-to-frame bone jump: garbage
  // decoding (wrong section, missing .ani block) shows up as jumps far bigger than the animation's normal motion
  const base = n.replace(/\.mdl$/, ''), b = g.read(base + '.mdl')!; const sk = parseSkeleton(b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer);
  if (sk.blocks.length > 1) { const a = g.read(base + '.ani'); if (a) sk.ani = new DataView(a.buffer, a.byteOffset, a.length); }
  sk.seqs.forEach((s, si) => { if (opt.seq && s.name !== opt.seq.toLowerCase()) return; if (s.frames < 2) return; const jumps: number[] = [], angs: number[] = []; let prev: Float32Array | null = null, nan = 0;
    for (let f = 0; f < s.frames; f++) { const M = boneMatrices(sk, si, f / (s.frames - 1)); let mx = 0; for (let i = 0; i < M.length; i++) if (!Number.isFinite(M[i])) nan++;
      let ma = 0; if (prev) for (let bi = 0; bi < sk.bones.length; bi++) { const d = Math.hypot(M[bi * 12 + 3] - prev[bi * 12 + 3], M[bi * 12 + 7] - prev[bi * 12 + 7], M[bi * 12 + 11] - prev[bi * 12 + 11]); if (d > mx) mx = d; ma = Math.max(ma, angBetween(M, prev, bi)); }
      if (prev) { jumps.push(mx); angs.push(ma); } prev = M; }
    const as = [...angs].sort((a, b) => a - b), amed = as[as.length >> 1] || 0, aworst = angs.indexOf(as[as.length - 1]);
    let wrap = ''; if (s.looping) { const A = boneMatrices(sk, si, 0), B = boneMatrices(sk, si, 1); let mx = 0; for (let bi = 0; bi < sk.bones.length; bi++) mx = Math.max(mx, Math.hypot(A[bi * 12 + 3] - B[bi * 12 + 3], A[bi * 12 + 7] - B[bi * 12 + 7], A[bi * 12 + 11] - B[bi * 12 + 11])); wrap = `, looping: last-to-first frame gap ${mx.toFixed(3)}`; }
    const sorted = [...jumps].sort((a, b) => a - b), med = sorted[sorted.length >> 1] || 0, worst = jumps.indexOf(sorted[sorted.length - 1]);
    console.log(`${n} ${s.name}: ${s.frames}f, median jump ${med.toFixed(3)}, max ${(sorted[sorted.length - 1] || 0).toFixed(3)} at frame ${worst}->${worst + 1}${nan ? ', NaN values ' + nan : ''}, frames with jump > 10x median: ${jumps.filter(j => j > Math.max(1, med * 10)).length}; rotation median ${amed.toFixed(2)} deg, max ${(as[as.length - 1] || 0).toFixed(2)} at ${aworst}->${aworst + 1}${wrap}`); });
}
} else for (const n of positionals) {
  const b = g.read(n.endsWith('.mdl') ? n : n + '.mdl'); if (!b) { console.log(n, 'not found'); continue; }
  const m = mdlInfo(b);
  if (opt.json) { console.log(JSON.stringify(m)); continue; }
  console.log(`${n}: v${m.version} ${m.bones.length} bones, ${m.seqs.length} seqs, ${m.anims.length} anims${m.staticProp ? ', static prop' : ''}${m.includes.length ? ', $includemodel ' + m.includes.join(' ') : ''}${m.animblocks ? `, .ani ${m.animblockName} (${m.animblocks} blocks)` : ''}`);
  if (m.poses.length) console.log('  pose params:', m.poses.map(p => `${p.name} [${p.start}..${p.end}${p.loop ? ' loop ' + p.loop : ''}]`).join(', '));
  if (m.controllers.length) console.log('  bone controllers:', JSON.stringify(m.controllers));
  if (m.attachments.length) console.log('  attachments:', m.attachments.map(a => a.name).join(' '));
  if (opt.bones) for (const [i, bn] of m.bones.entries()) console.log(`  bone ${i} ${bn.name} parent ${bn.parent}`);
  for (const s of m.seqs) console.log(`  seq ${s.i} ${s.name}${s.activity ? ' (' + s.activity + ')' : ''} [${s.flags.join(',')}] ${s.frames}f @${s.fps} = ${s.duration}s${s.anims.length > 1 ? ` blend ${s.groupsize.join('x')} params ${s.params}` : ''} fade ${s.fadein}/${s.fadeout}${s.nextseq ? ' next ' + s.nextseq : ''}${s.ikrules ? ' ik ' + s.ikrules : ''}${m.anims[s.anims[0]]?.animblock ? ' animblock ' + m.anims[s.anims[0]].animblock : ''}${m.anims[s.anims[0]]?.sectionFrames ? ' sections of ' + m.anims[s.anims[0]].sectionFrames : ''}${s.events.length ? ' events ' + s.events.map(e => `${e.event}${e.name ? '/' + e.name : ''}@${e.cycle}${e.options ? '"' + e.options + '"' : ''}`).join(' ') : ''}${s.autolayers.length ? ' layers ' + JSON.stringify(s.autolayers) : ''}`);
}
