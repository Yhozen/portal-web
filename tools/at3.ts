import { portalFS } from '/workspace/portal-web/src/vpk.ts';
import { parseSkeleton, poseMatrices } from '/workspace/portal-web/src/anim.ts';
const fs = portalFS(process.env.HOME + '/.steam/debian-installation/steamapps/common/Portal');
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const sk = parseSkeleton(ab(fs.read('models/props/round_elevator_doors.mdl')!));
for (const b of sk.bones) console.log(b.name, 'q', b.quat.map(v=>v.toFixed(3)), 'rot', b.rot.map(v=>v.toFixed(3)), 'p2b', Array.from(b.poseToBone).map(v=>v.toFixed(2)).join(' '));
const M = poseMatrices(sk, -1, 0); console.log('noanim', Array.from(M.slice(0,12)).map(v=>v.toFixed(2)).join(' '));
const a = sk.anims[sk.seqs[0].anim]; const dv = sk.dv; let p = a.ofs;
for (let g = 0; g < 10; g++) { const bi = dv.getUint8(p), fl = dv.getUint8(p + 1), nx = dv.getInt16(p + 2, true); const bytes = []; for (let k = 0; k < 8; k++) bytes.push(dv.getUint8(p + 4 + k).toString(16).padStart(2, '0')); console.log('bone', bi, 'fl', fl, 'next', nx, bytes.join(' '));
  const lo = dv.getUint32(p + 4, true), hi = dv.getUint32(p + 8, true); const big = (BigInt(hi) << 32n) | BigInt(lo); const f = (s: bigint) => Number((big >> s) & 0x1fffffn); console.log('  x', (f(0n) - 1048576) / 1048576.5, 'y', (f(21n) - 1048576) / 1048576.5, 'z', (f(42n) - 1048576) / 1048576.5, 'wneg', Number(big >> 63n));
  if (!nx) break; p += nx; }
