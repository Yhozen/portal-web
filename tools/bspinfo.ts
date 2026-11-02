import { BSP } from '../src/bsp.ts';
import * as fs from 'node:fs';
const f = process.argv[2]; const b = fs.readFileSync(f); const bsp = new BSP(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
console.log('version', bsp.version, 'faces', bsp.faces.length, 'models', bsp.models.length, 'disp', bsp.dispinfo.length, 'brushes', bsp.brushes.length, 'leafs', bsp.leafs.length, 'leafver', bsp.lumps[10].ver, 'texdata', bsp.texdata.length, 'props', bsp.staticProps.length, 'ents', bsp.entities.length, 'light', bsp.lumps[8].len, 'lightHDR', bsp.lumps[53].len, 'pak', bsp.pakfile?.length, 'clusters', bsp.numClusters);
const cls: Record<string, number> = {}; for (const e of bsp.entities) cls[e.classname] = (cls[e.classname] || 0) + 1; console.log(cls);
if (process.argv[3]) for (const e of bsp.entities) if (new RegExp(process.argv[3]).test(e.classname)) console.log(JSON.stringify(e));
if (process.argv[4]) console.log([...new Set(bsp.texdata.map(t => t.name))].join('\n'), [...new Set(bsp.staticProps.map(p => p.model))]);
