// mdl-info: print what a model's animation data says, straight from the MDL header (no engine code; layouts from the
// public Source SDK 2013 public/studio.h: studiohdr_t, mstudioseqdesc_t, mstudioanimdesc_t, mstudioevent_t,
// mstudioposeparamdesc_t, mstudiobonecontroller_t, mstudioautolayer_t). Used to check the port's playback against
// the data: fps, frame count, looping, blends, fades, events, external .ani blocks, $includemodel.
//   node tools/mdl-info.ts [--game DIR] [--json] [--bones] models/props/glados.mdl ...
//   node tools/mdl-info.ts [--game DIR] --survey [REGEX]    one line per animated model found in the VPKs
import { portalFS } from '../src/vpk.ts';
import { parseArgs } from 'node:util';
const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { game: { type: 'string' }, json: { type: 'boolean' }, bones: { type: 'boolean' }, survey: { type: 'boolean' } } });
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
