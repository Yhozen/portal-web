// Studio model (MDL v44–v49) + VVD + VTX reader for static bind-pose rendering. Clean-room from the
// Valve Developer Wiki pages "MDL", "VVD" and "VTX" (studio.h / optimize.h layouts in the public SDK 2013).
export interface MdlMesh { material: number; indices: number[]; }
export interface MdlData { name: string; verts: Float32Array /* pos3 n3 uv2 */; weights: Float32Array; boneIds: Uint8Array; meshes: MdlMesh[]; materials: string[][] /* per skin */; mins: number[]; maxs: number[]; hullMins: number[]; hullMaxs: number[]; attachments: { name: string; bone: number; m: number[] }[]; bones: { name: string; parent: number; pos: number[]; rot: number[] }[]; }

const cstr = (dv: DataView, o: number) => { let s = ''; for (let p = o; p < dv.byteLength; p++) { const c = dv.getUint8(p); if (!c) break; s += String.fromCharCode(c); } return s; };

export function parseMDL(mdl: ArrayBuffer, vvd: ArrayBuffer, vtx: ArrayBuffer): MdlData {
  const m = new DataView(mdl), i32 = (o: number) => m.getInt32(o, true), f32 = (o: number) => m.getFloat32(o, true);
  const version = i32(4); const name = cstr(m, 12);
  const v3 = (o: number) => [f32(o), f32(o + 4), f32(o + 8)];
  const hullMins = v3(104), hullMaxs = v3(116), mins = v3(128), maxs = v3(140);
  const numBones = i32(156), boneIdx = i32(160);
  const boneSize = 216; const bones: MdlData['bones'] = [];
  for (let i = 0; i < numBones; i++) { const o = boneIdx + i * boneSize; bones.push({ name: cstr(m, o + i32(o)), parent: i32(o + 4), pos: v3(o + 32), rot: [f32(o + 44), f32(o + 48), f32(o + 52), f32(o + 56)] }); }
  const numTex = i32(204), texIdx = i32(208), numCd = i32(212), cdIdx = i32(216), numSkinRef = i32(220), numSkinFam = i32(224), skinIdx = i32(228);
  const numBodyParts = i32(232), bodyPartIdx = i32(236);
  const numAtt = i32(240), attIdx = i32(244);
  const attachments: MdlData['attachments'] = [];
  for (let i = 0; i < numAtt; i++) { const o = attIdx + i * 92; const mm: number[] = []; for (let k = 0; k < 12; k++) mm.push(f32(o + 12 + k * 4)); attachments.push({ name: cstr(m, o + i32(o)), bone: i32(o + 8), m: mm }); }
  const texNames: string[] = []; for (let i = 0; i < numTex; i++) { const o = texIdx + i * 64; texNames.push(cstr(m, o + i32(o)).toLowerCase().replace(/\\/g, '/')); }
  const cds: string[] = []; for (let i = 0; i < numCd; i++) cds.push(cstr(m, i32(cdIdx + i * 4)).toLowerCase().replace(/\\/g, '/'));
  const materials: string[][] = [];
  for (let s = 0; s < Math.max(1, numSkinFam); s++) {
    const row: string[] = [];
    for (let r = 0; r < numSkinRef; r++) { const ti = numSkinFam ? m.getInt16(skinIdx + (s * numSkinRef + r) * 2, true) : r; row.push(texNames[ti] ?? texNames[0]); }
    materials.push(row);
  }
  // material search dirs: resolve later by the loader (cds + name)
  (materials as any).cds = cds;
  // VVD
  const v = new DataView(vvd); const numFix = v.getInt32(48, true), fixStart = v.getInt32(52, true), vStart = v.getInt32(56, true);
  const lod0 = v.getInt32(16, true);
  let order: number[] = [];
  if (numFix) { for (let i = 0; i < numFix; i++) { const o = fixStart + i * 12; const lod = v.getInt32(o, true), src = v.getInt32(o + 4, true), n = v.getInt32(o + 8, true); if (lod >= 0) for (let k = 0; k < n; k++) order.push(src + k); } }
  else order = Array.from({ length: lod0 }, (_, i) => i);
  const verts = new Float32Array(order.length * 8), weights = new Float32Array(order.length * 3), boneIds = new Uint8Array(order.length * 3);
  order.forEach((src, i) => { const b = vStart + src * 48, o = b + 16; for (let k = 0; k < 8; k++) verts[i * 8 + k] = v.getFloat32(o + k * 4, true);
    const nb = v.getUint8(b + 15); for (let k = 0; k < 3; k++) { weights[i * 3 + k] = k < nb ? v.getFloat32(b + k * 4, true) : 0; boneIds[i * 3 + k] = v.getUint8(b + 12 + k); } });
  // VTX
  const x = new DataView(vtx), xi = (o: number) => x.getInt32(o, true);
  const sgSize = version >= 49 ? 33 : 25, stripSize = version >= 49 ? 35 : 27;
  const meshes: MdlMesh[] = [];
  const xBodyParts = xi(28), xBodyOfs = xi(32);
  for (let bp = 0; bp < Math.min(numBodyParts, xBodyParts); bp++) {
    const mbp = bodyPartIdx + bp * 16, nModels = i32(mbp + 4), mModelIdx = mbp + i32(mbp + 12);
    const xbp = xBodyOfs + bp * 8, xnModels = xi(xbp), xModelOfs = xbp + xi(xbp + 4);
    for (let mi = 0; mi < Math.min(nModels, xnModels); mi++) {
      if (mi > 0) break; // body group 0 only
      const mm = mModelIdx + mi * 148, nMeshes = i32(mm + 72), meshIdx = mm + i32(mm + 76), modelVertBase = i32(mm + 84) / 48;
      const xm = xModelOfs + mi * 8, xLodOfs = xm + xi(xm + 4); // LOD 0
      const xnMeshes = xi(xLodOfs), xMeshOfs = xLodOfs + xi(xLodOfs + 4);
      for (let me = 0; me < Math.min(nMeshes, xnMeshes); me++) {
        const mme = meshIdx + me * 116, mat = i32(mme), meshVertOfs = i32(mme + 12);
        const xme = xMeshOfs + me * 9, nSG = xi(xme), sgOfs = xme + xi(xme + 4);
        const idx: number[] = [];
        for (let g = 0; g < nSG; g++) {
          const sg = sgOfs + g * sgSize, nV = xi(sg), vOfs = sg + xi(sg + 4), nI = xi(sg + 8), iOfs = sg + xi(sg + 12), nS = xi(sg + 16), sOfs = sg + xi(sg + 20);
          const vid = (k: number) => modelVertBase + meshVertOfs + x.getUint16(vOfs + k * 9 + 4, true);
          for (let s = 0; s < nS; s++) {
            const so = sOfs + s * stripSize, sni = xi(so), sio = xi(so + 4), flags = x.getUint8(so + 18);
            if (flags & 2) { for (let k = 0; k + 2 < sni; k++) { const a = vid(x.getUint16(iOfs + (sio + k) * 2, true)), b = vid(x.getUint16(iOfs + (sio + k + 1) * 2, true)), c = vid(x.getUint16(iOfs + (sio + k + 2) * 2, true)); if (k & 1) idx.push(a, c, b); else idx.push(a, b, c); } }
            else for (let k = 0; k < sni; k++) idx.push(vid(x.getUint16(iOfs + (sio + k) * 2, true)));
          }
          void nV; void nI;
        }
        meshes.push({ material: mat, indices: idx });
      }
    }
  }
  return { name, verts, weights, boneIds, meshes, materials, mins, maxs, hullMins, hullMaxs, attachments, bones };
}
