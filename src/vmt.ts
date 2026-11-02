import { parseKV, type KV } from './kv.ts';
export interface Material { name: string; shader: string; params: Record<string, string>; proxies?: KV; }
// Resolve a VMT (including the "patch" shader used by map-embedded cubemap materials).
export async function loadVMT(name: string, read: (p: string) => Promise<string | null>, depth = 0): Promise<Material | null> {
  const path = 'materials/' + name.replace(/\.vmt$/, '') + '.vmt';
  const txt = await read(path); if (txt === null) return null;
  const kv = parseKV(txt); const shader = Object.keys(kv)[0]; if (!shader) return null;
  const body = kv[shader] as KV; const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) if (typeof v === 'string') params[k] = v;
  if (shader === 'patch' && depth < 4) {
    const inc = (body.include as string || '').toLowerCase().replace(/\\/g, '/').replace(/^materials\//, '');
    const base = await loadVMT(inc, read, depth + 1); if (!base) return null;
    for (const blk of ['insert', 'replace']) { const b = body[blk]; if (b && typeof b === 'object') for (const [k, v] of Object.entries(b)) if (typeof v === 'string') base.params[k] = v; }
    base.name = name; return base;
  }
  return { name, shader, params, proxies: (body.proxies as KV) || undefined };
}
