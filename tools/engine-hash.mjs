// Prints a hash of the engine source (every file under src/, path and content, in sorted order). tools/gate.sh records
// the hash it passed on; web/scripts/gate.mjs refuses to deploy an engine whose hash the gate has not passed.
// Usage: node tools/engine-hash.mjs
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function engineHash(root = join(import.meta.dirname, '..')) {
  const src = join(root, 'src'), files = [];
  const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  walk(src);
  const h = createHash('sha256');
  for (const f of files.map(f => relative(root, f).split('\\').join('/')).sort()) h.update(f + '\0').update(readFileSync(join(root, f))).update('\0');
  return h.digest('hex');
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(engineHash() + '\n');
