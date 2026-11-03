// Lighting lumps summary for a map: face light styles, bump flags, leaf ambient samples, worldlights.
import { BSP, SURF } from '../src/bsp.ts';
import * as fs from 'node:fs';
const b = fs.readFileSync(process.argv[2]); const bsp = new BSP(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
const st: Record<string, number> = {}; let bump = 0;
for (const f of bsp.faces) { if (f.lightofs < 0) continue; const k = f.styles.filter(s => s !== 255).join(','); st[k] = (st[k] || 0) + 1; if (f.texinfo >= 0 && bsp.texinfo[f.texinfo].flags & SURF.BUMPLIGHT) bump++; }
console.log('styles', st, 'bumpFaces', bump);
for (const i of [8, 51, 52, 53, 54, 55, 56, 15]) console.log('lump', i, bsp.lumps[i]);
const lights = bsp.entities.filter(e => /^light/.test(e.classname)); console.log('light ents', lights.length, lights.filter(e => e.targetname).map(e => e.classname + ':' + e.targetname + ' style=' + e.style + ' sf=' + e.spawnflags + ' ' + e._light).slice(0, 20));
