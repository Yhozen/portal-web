// Source BSP v19/v20/v21 reader. Clean-room from the Valve Developer Wiki "Source BSP File Format" page.
export const L = { ENTITIES: 0, PLANES: 1, TEXDATA: 2, VERTEXES: 3, VISIBILITY: 4, NODES: 5, TEXINFO: 6, FACES: 7, LIGHTING: 8,
  LEAFS: 10, EDGES: 12, SURFEDGES: 13, MODELS: 14, LEAFFACES: 16, LEAFBRUSHES: 17, BRUSHES: 18, BRUSHSIDES: 19,
  DISPINFO: 26, DISP_VERTS: 33, GAME_LUMP: 35, PAKFILE: 40, TEXDATA_STRING_DATA: 43, TEXDATA_STRING_TABLE: 44,
  LIGHTING_HDR: 53, FACES_HDR: 58 };

export interface Plane { n: [number, number, number]; d: number; type: number; }
export interface TexInfo { s: number[]; t: number[]; ls: number[]; lt: number[]; flags: number; texdata: number; }
export interface TexData { name: string; width: number; height: number; reflectivity: number[]; }
export interface Face { plane: number; side: number; firstEdge: number; numEdges: number; texinfo: number; dispinfo: number;
  styles: number[]; lightofs: number; lmMins: [number, number]; lmSize: [number, number]; }
export interface Model { mins: number[]; maxs: number[]; origin: number[]; headnode: number; firstFace: number; numFaces: number; }
export interface DispInfo { start: number[]; vertStart: number; power: number; mapFace: number; }
export interface Node { plane: number; children: [number, number]; mins: number[]; maxs: number[]; }
export interface Leaf { contents: number; cluster: number; firstLeafBrush: number; numLeafBrushes: number; firstLeafFace: number; numLeafFaces: number; mins: number[]; maxs: number[] }
export interface Brush { firstSide: number; numSides: number; contents: number; }
export interface BrushSide { plane: number; texinfo: number; bevel: number; }
export interface Overlay { id: number; texinfo: number; faces: number[]; u: number[]; v: number[]; pts: number[][]; origin: number[]; normal: number[]; }
export interface StaticProp { model: string; origin: number[]; angles: number[]; skin: number; solid: number; }
export type Entity = Record<string, string>;

export const SURF = { LIGHT: 0x1, SKY2D: 0x2, SKY: 0x4, WARP: 0x8, TRANS: 0x10, NOPORTAL: 0x20, TRIGGER: 0x40, NODRAW: 0x80, HINT: 0x100, SKIP: 0x200, NOLIGHT: 0x400, BUMPLIGHT: 0x800 };
export const CONTENTS = { SOLID: 1, WINDOW: 2, GRATE: 8, MOVEABLE: 0x4000, PLAYERCLIP: 0x10000, MONSTER: 0x2000000 };

export class BSP {
  dv: DataView; buf: ArrayBuffer; version: number;
  lumps: { ofs: number; len: number; ver: number }[] = [];
  planes: Plane[] = []; texinfo: TexInfo[] = []; texdata: TexData[] = []; verts!: Float32Array; edges!: Uint16Array; surfedges!: Int32Array;
  faces: Face[] = []; models: Model[] = []; dispinfo: DispInfo[] = []; dispVerts!: Float32Array; lighting!: Uint8Array;
  nodes: Node[] = []; leafs: Leaf[] = []; leafBrushes!: Uint16Array; leafFaces!: Uint16Array; brushes: Brush[] = []; brushSides: BrushSide[] = [];
  overlays: Overlay[] = []; entities: Entity[] = []; staticProps: StaticProp[] = []; pakfile: Uint8Array | null = null; numClusters = 0; vis: Uint8Array | null = null;

  constructor(buf: ArrayBuffer) {
    this.buf = buf; const dv = this.dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x50534256) throw new Error('not VBSP');
    this.version = dv.getInt32(4, true);
    for (let i = 0; i < 64; i++) this.lumps.push({ ofs: dv.getInt32(8 + i * 16, true), len: dv.getInt32(12 + i * 16, true), ver: dv.getInt32(16 + i * 16, true) });
    for (const l of this.lumps) if (l.len >= 4 && dv.getUint32(l.ofs, true) === 0x414d5a4c) throw new Error('LZMA-compressed lumps not supported yet');
    this.parse();
  }
  lump(i: number) { return this.lumps[i]; }
  private arr<T>(i: number, size: number, f: (o: number) => T): T[] { const l = this.lumps[i]; const out: T[] = []; for (let o = l.ofs; o + size <= l.ofs + l.len; o += size) out.push(f(o)); return out; }
  private parse() {
    const dv = this.dv, f = (o: number) => dv.getFloat32(o, true), i32 = (o: number) => dv.getInt32(o, true), u16 = (o: number) => dv.getUint16(o, true), s16 = (o: number) => dv.getInt16(o, true);
    const v3 = (o: number) => [f(o), f(o + 4), f(o + 8)];
    this.planes = this.arr(L.PLANES, 20, o => ({ n: v3(o) as [number, number, number], d: f(o + 12), type: i32(o + 16) }));
    const strTab = this.arr(L.TEXDATA_STRING_TABLE, 4, i32), sd = this.lumps[L.TEXDATA_STRING_DATA];
    const cstr = (o: number) => { let s = ''; for (let p = o; ; p++) { const c = dv.getUint8(p); if (!c) break; s += String.fromCharCode(c); } return s; };
    this.texdata = this.arr(L.TEXDATA, 32, o => ({ reflectivity: v3(o), name: cstr(sd.ofs + strTab[i32(o + 12)]).toLowerCase().replace(/\\/g, '/'), width: i32(o + 16), height: i32(o + 20) }));
    this.texinfo = this.arr(L.TEXINFO, 72, o => ({ s: [f(o), f(o + 4), f(o + 8), f(o + 12)], t: [f(o + 16), f(o + 20), f(o + 24), f(o + 28)],
      ls: [f(o + 32), f(o + 36), f(o + 40), f(o + 44)], lt: [f(o + 48), f(o + 52), f(o + 56), f(o + 60)], flags: i32(o + 64), texdata: i32(o + 68) }));
    const lv = this.lumps[L.VERTEXES]; this.verts = new Float32Array(this.buf.slice(lv.ofs, lv.ofs + lv.len));
    const le = this.lumps[L.EDGES]; this.edges = new Uint16Array(this.buf.slice(le.ofs, le.ofs + le.len));
    const ls = this.lumps[L.SURFEDGES]; this.surfedges = new Int32Array(this.buf.slice(ls.ofs, ls.ofs + ls.len));
    let fl = this.lumps[L.FACES]; if (!fl.len) fl = this.lumps[L.FACES_HDR];
    const faceLump = this.lumps[L.FACES].len ? L.FACES : L.FACES_HDR;
    this.faces = this.arr(faceLump, 56, o => ({ plane: u16(o), side: dv.getUint8(o + 2), firstEdge: i32(o + 4), numEdges: s16(o + 8), texinfo: s16(o + 10), dispinfo: s16(o + 12),
      styles: [dv.getUint8(o + 16), dv.getUint8(o + 17), dv.getUint8(o + 18), dv.getUint8(o + 19)], lightofs: i32(o + 20),
      lmMins: [i32(o + 28), i32(o + 32)], lmSize: [i32(o + 36), i32(o + 40)] }));
    let lt = this.lumps[L.LIGHTING]; if (!lt.len) lt = this.lumps[L.LIGHTING_HDR];
    this.lighting = new Uint8Array(this.buf, lt.ofs, lt.len);
    this.models = this.arr(L.MODELS, 48, o => ({ mins: v3(o), maxs: v3(o + 12), origin: v3(o + 24), headnode: i32(o + 36), firstFace: i32(o + 40), numFaces: i32(o + 44) }));
    // doverlay_t (352 bytes, layout from the public SDK 2013 bspfile.h); BasisU is packed into UVPoints[0..2].z, UVPoints[3].z flags a flipped V
    this.overlays = this.arr(45, 352, o => { const fc = u16(o + 6) & 0x3fff; const faces: number[] = []; for (let k = 0; k < Math.min(fc, 64); k++) faces.push(i32(o + 8 + k * 4));
      return { id: i32(o), texinfo: s16(o + 4), faces, u: [f(o + 264), f(o + 268)], v: [f(o + 272), f(o + 276)], pts: [v3(o + 280), v3(o + 292), v3(o + 304), v3(o + 316)], origin: v3(o + 328), normal: v3(o + 340) }; });
    this.dispinfo = this.arr(L.DISPINFO, 176, o => ({ start: v3(o), vertStart: i32(o + 12), power: i32(o + 20), mapFace: u16(o + 36) }));
    const dvl = this.lumps[L.DISP_VERTS]; this.dispVerts = new Float32Array(this.buf.slice(dvl.ofs, dvl.ofs + dvl.len));
    this.nodes = this.arr(L.NODES, 32, o => ({ plane: i32(o), children: [i32(o + 4), i32(o + 8)], mins: [s16(o + 12), s16(o + 14), s16(o + 16)], maxs: [s16(o + 18), s16(o + 20), s16(o + 22)] }));
    const leafSize = this.lumps[L.LEAFS].ver === 0 ? 56 : 32;
    this.leafs = this.arr(L.LEAFS, leafSize, o => ({ contents: i32(o), cluster: s16(o + 4), mins: [s16(o + 8), s16(o + 10), s16(o + 12)], maxs: [s16(o + 14), s16(o + 16), s16(o + 18)],
      firstLeafFace: u16(o + 20), numLeafFaces: u16(o + 22), firstLeafBrush: u16(o + 24), numLeafBrushes: u16(o + 26) }));
    const lb = this.lumps[L.LEAFBRUSHES]; this.leafBrushes = new Uint16Array(this.buf.slice(lb.ofs, lb.ofs + lb.len));
    const lf = this.lumps[L.LEAFFACES]; this.leafFaces = new Uint16Array(this.buf.slice(lf.ofs, lf.ofs + lf.len));
    this.brushes = this.arr(L.BRUSHES, 12, o => ({ firstSide: i32(o), numSides: i32(o + 4), contents: i32(o + 8) }));
    this.brushSides = this.arr(L.BRUSHSIDES, 8, o => ({ plane: u16(o), texinfo: s16(o + 2), bevel: s16(o + 6) }));
    const el = this.lumps[L.ENTITIES]; this.entities = parseEntities(new TextDecoder('latin1').decode(new Uint8Array(this.buf, el.ofs, el.len)));
    const pk = this.lumps[L.PAKFILE]; if (pk.len) this.pakfile = new Uint8Array(this.buf, pk.ofs, pk.len);
    const vl = this.lumps[L.VISIBILITY]; if (vl.len) { this.vis = new Uint8Array(this.buf, vl.ofs, vl.len); this.numClusters = i32(vl.ofs); }
    this.parseGameLump();
  }
  private parseGameLump() {
    const gl = this.lumps[L.GAME_LUMP]; if (!gl.len) return;
    const dv = this.dv; const n = dv.getInt32(gl.ofs, true);
    for (let i = 0; i < n; i++) {
      const o = gl.ofs + 4 + i * 16, id = dv.getUint32(o, true), ver = dv.getUint16(o + 6, true), ofs = dv.getInt32(o + 8, true), len = dv.getInt32(o + 12, true);
      if (id !== 0x73707270 /* 'sprp' */ || !len) continue;
      let p = ofs; const nd = dv.getInt32(p, true); p += 4; const names: string[] = [];
      for (let k = 0; k < nd; k++) { let s = ''; for (let j = 0; j < 128; j++) { const c = dv.getUint8(p + j); if (!c) break; s += String.fromCharCode(c); } names.push(s.toLowerCase().replace(/\\/g, '/')); p += 128; }
      const nl = dv.getInt32(p, true); p += 4 + nl * 2;
      const np = dv.getInt32(p, true); p += 4;
      const size = np ? Math.floor((ofs + len - p) / np) : 0; // per-version struct size; we only need the common prefix
      for (let k = 0; k < np; k++, p += size) {
        this.staticProps.push({ origin: [dv.getFloat32(p, true), dv.getFloat32(p + 4, true), dv.getFloat32(p + 8, true)], angles: [dv.getFloat32(p + 12, true), dv.getFloat32(p + 16, true), dv.getFloat32(p + 20, true)],
          model: names[dv.getUint16(p + 24, true)], solid: dv.getUint8(p + 30), skin: dv.getInt32(p + 32, true) });
      }
      void ver;
    }
  }
  faceVerts(fi: number): number[][] {
    const fc = this.faces[fi], out: number[][] = [];
    for (let i = 0; i < fc.numEdges; i++) {
      const se = this.surfedges[fc.firstEdge + i]; const vi = se >= 0 ? this.edges[se * 2] : this.edges[-se * 2 + 1];
      out.push([this.verts[vi * 3], this.verts[vi * 3 + 1], this.verts[vi * 3 + 2]]);
    }
    return out;
  }
  pointLeaf(p: number[]) { let n = 0; while (n >= 0) { const nd = this.nodes[n], pl = this.planes[nd.plane]; n = nd.children[p[0] * pl.n[0] + p[1] * pl.n[1] + p[2] * pl.n[2] - pl.d >= 0 ? 0 : 1]; } return -1 - n; }
  // Decompress the PVS row for a cluster (run-length encoded zeros).
  clusterVis(cluster: number): Uint8Array | null {
    if (!this.vis || cluster < 0) return null;
    const dv = new DataView(this.vis.buffer, this.vis.byteOffset, this.vis.byteLength);
    const ofs = dv.getInt32(4 + cluster * 8, true), out = new Uint8Array((this.numClusters + 7) >> 3);
    let p = ofs, o = 0;
    while (o < out.length) { const b = this.vis[p++]; if (b) out[o++] = b; else { o += this.vis[p++]; } }
    return out;
  }
}

export function parseEntities(s: string): Entity[] {
  const out: Entity[] = []; const re = /"((?:[^"\\]|\\.)*)"|([{}])/g; let cur: Entity | null = null, key: string | null = null, m;
  while ((m = re.exec(s))) {
    if (m[2] === '{') { cur = {}; key = null; continue; }
    if (m[2] === '}') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (key === null) key = m[1]; else {
      // keys can repeat (entity outputs). Append with a separator so we keep every output.
      const k = key.toLowerCase(); cur[k] = cur[k] !== undefined && /^on|^out/i.test(k) ? cur[k] + '\u001e' + m[1] : m[1]; key = null; }
  }
  return out;
}
