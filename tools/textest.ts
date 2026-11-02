import { portalFS } from '../src/vpk.ts';
import { parseVTF, decodeToRGBA } from '../src/vtf.ts';
import { loadVMT } from '../src/vmt.ts';
import * as fs from 'node:fs';
const g = portalFS(`${process.env.HOME}/.steam/debian-installation/steamapps/common/Portal`);
const names = process.argv.slice(2);
for (const n of names) {
  const m = await loadVMT(n, async p => g.read(p)?.toString('latin1') ?? null);
  console.log(n, m?.shader, JSON.stringify(m?.params));
  const bt = m?.params['$basetexture']; if (!bt) continue;
  const b = g.read('materials/' + bt.toLowerCase().replace(/\\/g, '/') + '.vtf'); if (!b) { console.log(' missing vtf'); continue; }
  const v = parseVTF(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const rgba = decodeToRGBA(v.format, v.data[0][0], v.width, v.height);
  console.log(' vtf', v.width, v.height, 'fmt', v.format, 'mips', v.mips, 'frames', v.frames, 'px0', [...rgba.slice(0, 8)]);
  // write PPM for eyeballing
  const ppm = Buffer.alloc(v.width * v.height * 3); for (let i = 0; i < v.width * v.height; i++) { ppm[i*3]=rgba[i*4]; ppm[i*3+1]=rgba[i*4+1]; ppm[i*3+2]=rgba[i*4+2]; }
  fs.writeFileSync(`/tmp/${n.replace(/\//g, '_')}.ppm`, Buffer.concat([Buffer.from(`P6 ${v.width} ${v.height} 255\n`), ppm]));
}
