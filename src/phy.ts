// .phy collision models: per-solid convex pieces, read from the file layout the public tools document (compactsurfaceheader_t
// from SDK 2013 public/phyfile.h, then the IVP compact surface: ledges, triangles and points). Points are in IVP units
// (metres, y and z swapped and y flipped); they're converted back to Source inches here. A jointed model (bone followers,
// ragdolls) keeps each solid in its bone's space; the text section names the bone of each solid.
export interface PhySolid { index: number; name: string; parent: string; convexes: [number, number, number][][] }
export function parsePhy(b: Uint8Array): PhySolid[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), i32 = (o: number) => dv.getInt32(o, true), u32 = (o: number) => dv.getUint32(o, true), f = (o: number) => dv.getFloat32(o, true);
  const hs = i32(0), cnt = i32(8); let o = hs; const solids: PhySolid[] = [];
  for (let i = 0; i < cnt; i++) { const size = i32(o), base = o + 4, end = base + size; const convexes: [number, number, number][][] = [];
    if (i32(base) === 0x59485056) { // 'VPHY'
      const surf = base + 28, treeRoot = surf + i32(surf + 32); let L = surf + 48;
      while (L < treeRoot && L < end) { const pts = L + i32(L), sz = (u32(L + 8) >>> 8) * 16, nt = dv.getInt16(L + 12, true); if (sz <= 0) break;
        const idx = new Set<number>(); for (let t = 0; t < nt; t++) { const T = L + 16 + t * 16; for (let e = 0; e < 3; e++) idx.add(u32(T + 4 + e * 4) & 0xffff); }
        const vs: [number, number, number][] = []; for (const k of idx) { const p = pts + k * 16; vs.push([f(p) / 0.0254, f(p + 8) / 0.0254, -f(p + 4) / 0.0254]); }
        if (vs.length) convexes.push(vs); L += sz; }
    }
    solids.push({ index: i, name: '', parent: '', convexes }); o = end; }
  const text = new TextDecoder('latin1').decode(b.subarray(o));
  for (const m of text.matchAll(/solid\s*\{([^}]*)\}/g)) { const kv: Record<string, string> = {}; for (const p of m[1].matchAll(/"([^"]+)"\s*"([^"]*)"/g)) kv[p[1]] = p[2];
    const s = solids[+kv.index]; if (s) { s.name = kv.name || ''; s.parent = kv.parent || ''; } }
  return solids;
}

/** the planes of a small convex point set (brute force over triples; the pieces have 8 to 12 points) */
export function hullPlanes(vs: [number, number, number][]): { n: [number, number, number]; d: number }[] {
  const out: { n: [number, number, number]; d: number }[] = [];
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) for (let k = j + 1; k < vs.length; k++) {
    const a = vs[i], b = vs[j], c = vs[k], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: [number, number, number] = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n); if (l < 1e-4) continue;
    n = [n[0] / l, n[1] / l, n[2] / l]; let d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2], pos = 0, neg = 0;
    for (const p of vs) { const s = n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d; if (s > 0.01) pos++; else if (s < -0.01) neg++; }
    if (pos && neg) continue; if (pos) { n = [-n[0], -n[1], -n[2]]; d = -d; }
    if (!out.some(q => q.n[0] * n[0] + q.n[1] * n[1] + q.n[2] * n[2] > 0.9999 && Math.abs(q.d - d) < 0.01)) out.push({ n, d });
  }
  return out;
}
/** the model's bone followers (mdlkeyvalue "bone_followers", the bones that get their own collision piece on a
 *  prop_dynamic, as SDK 2013's CBoneFollowerManager does), each with the convex pieces of its .phy solid in bone space */
export interface Follower { bone: number; name: string; pieces: { verts: [number, number, number][]; planes: { n: [number, number, number]; d: number }[] }[] }
/** studiohdr_t keyvalueindex/keyvaluesize (public SDK studio.h) */
export function mdlKeyValues(mdl: ArrayBuffer) { const dv = new DataView(mdl), kvi = dv.getInt32(312, true), kvs = dv.getInt32(316, true);
  return kvi > 0 && kvs > 0 && kvi < mdl.byteLength ? new TextDecoder('latin1').decode(new Uint8Array(mdl, kvi, Math.min(kvs, mdl.byteLength - kvi))) : ''; }
export function boneFollowers(kv: string, phy: ArrayBuffer | null, bones: { name: string }[]): Follower[] {
  if (!phy) return [];
  const m = /bone_followers\s*\{([^}]*)\}/i.exec(kv); if (!m) return [];
  const names = [...m[1].matchAll(/"bone"\s*"([^"]+)"/gi)].map(x => x[1].toLowerCase());
  const solids = parsePhy(new Uint8Array(phy)), out: Follower[] = [];
  for (const nm of names) { const s = solids.find(x => x.name.toLowerCase() === nm), bone = bones.findIndex(b => b.name.toLowerCase() === nm); if (!s || bone < 0) continue;
    out.push({ bone, name: nm, pieces: s.convexes.map(verts => ({ verts, planes: hullPlanes(verts) })) }); }
  return out;
}
