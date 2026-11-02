import { portalFS } from '../src/vpk.ts';
import { parseSkeleton, poseMatrices } from '../src/anim.ts';
const fs = portalFS(process.env.HOME + '/.steam/debian-installation/steamapps/common/Portal');
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
for (const m of process.argv.slice(2)) {
  const sk = parseSkeleton(ab(fs.read(m)!));
  console.log(m, sk.bones.map(b => b.name + ' p' + b.pos.map(v => v.toFixed(1)) + ' ps' + b.posscale.map(v => v.toExponential(1))).join(' ; '));
  for (let s = 0; s < sk.seqs.length; s++) { const a = sk.anims[sk.seqs[s].anim]; console.log(' ', sk.seqs[s].name, sk.seqs[s].frames + 'f', 'animflags', a.flags, 'blk', a.animblock, 'firstbone', sk.dv.getUint8(a.ofs), 'fl', sk.dv.getUint8(a.ofs + 1));
    for (const c of [0, 0.5, 1]) { const M = poseMatrices(sk, s, c); const r = []; for (let i = 0; i < sk.bones.length; i++) r.push(Array.from(M.slice(i * 12, i * 12 + 12)).map(v => v.toFixed(2)).join(' ')); console.log('   c' + c, r.join(' | ')); } }
}
