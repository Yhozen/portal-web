import { portalFS } from '../src/vpk.ts';
import { parseMDL } from '../src/mdl.ts';
const g = portalFS(`${process.env.HOME}/.steam/debian-installation/steamapps/common/Portal`);
const ab = (b: Buffer | null) => b!.buffer.slice(b!.byteOffset, b!.byteOffset + b!.length) as ArrayBuffer;
for (const n of process.argv.slice(2)) {
  const base = n.replace(/\.mdl$/, '');
  const d = parseMDL(ab(g.read(base + '.mdl')), ab(g.read(base + '.vvd')), ab(g.read(base + '.dx90.vtx')));
  let maxI = 0; for (const m of d.meshes) for (const i of m.indices) maxI = Math.max(maxI, i);
  console.log(n, 'verts', d.verts.length / 8, 'meshes', d.meshes.map(m => m.indices.length / 3), 'maxIdx', maxI, 'mats', d.materials[0], (d.materials as any).cds, 'bounds', d.mins, d.maxs, 'v0', [...d.verts.slice(0, 8)].map(x => x.toFixed(2)).join(','), 'bones', d.bones.length, d.attachments.map(a => a.name));
}
