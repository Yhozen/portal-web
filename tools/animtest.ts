import { portalFS } from '../src/vpk.ts';
import { parseSkeleton, poseMatrices, includeModels } from '../src/anim.ts';
const fs = portalFS(process.env.HOME + '/.steam/debian-installation/steamapps/common/Portal');
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
for (const m of process.argv.slice(2)) {
  const buf = ab(fs.read(m)!); const sk = parseSkeleton(buf);
  console.log(m, 'bones', sk.bones.map(b => b.name).join(','), 'inc', includeModels(buf));
  for (const inc of includeModels(buf)) { const b2 = fs.read(inc); if (!b2) { console.log(' missing', inc); continue; } const s2 = parseSkeleton(ab(b2));
    console.log('  inc bones', s2.bones.map(b => b.name).join(','), 'seqs', s2.seqs.map(s => `${s.name}(${s.frames}f${s.looping ? ' loop' : ''} blk${s2.anims[s.anim]?.animblock} sec${s2.anims[s.anim]?.sectionFrames})`).join(' '));
    for (let s = 0; s < s2.seqs.length; s++) for (const c of [0, 1]) { const M = poseMatrices(s2, s, c); const r = []; for (let i = 0; i < s2.bones.length; i++) r.push([M[i*12+3], M[i*12+7], M[i*12+11]].map(v => v.toFixed(1)).join(',')); console.log('   ', s2.seqs[s].name, c, r.join(' | ')); } }
}
