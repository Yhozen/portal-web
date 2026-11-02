// VTF 7.0–7.5 reader with DXT1/3/5 and common uncompressed formats -> RGBA8. Clean-room from the
// Valve Developer Wiki "Valve Texture Format" page and the public S3TC/DXT block layout.
export const FMT = { RGBA8888: 0, ABGR8888: 1, RGB888: 2, BGR888: 3, RGB565: 4, I8: 5, IA88: 6, A8: 8, RGB888_BLUESCREEN: 9, BGR888_BLUESCREEN: 10,
  ARGB8888: 11, BGRA8888: 12, DXT1: 13, DXT3: 14, DXT5: 15, BGRX8888: 16, BGR565: 17, BGRX5551: 18, BGRA4444: 19, DXT1_ONEBITALPHA: 20, BGRA5551: 21, UV88: 22, UVWQ8888: 23, RGBA16161616F: 24, RGBA16161616: 25 };
export interface VTF { width: number; height: number; flags: number; frames: number; format: number; mips: number; faces: number; depth: number;
  /** level 0 = largest. data[mip][frame] (face 0, slice 0) */ data: Uint8Array[][]; }
export const TEXF = { CLAMPS: 0x4, CLAMPT: 0x8, NOMIP: 0x100, ONEBITALPHA: 0x1000, EIGHTBITALPHA: 0x2000, ENVMAP: 0x4000, SRGB: 0x40 };

export function imageSize(fmt: number, w: number, h: number) {
  w = Math.max(1, w); h = Math.max(1, h);
  switch (fmt) {
    case FMT.DXT1: case FMT.DXT1_ONEBITALPHA: return Math.max(1, (w + 3) >> 2) * Math.max(1, (h + 3) >> 2) * 8;
    case FMT.DXT3: case FMT.DXT5: return Math.max(1, (w + 3) >> 2) * Math.max(1, (h + 3) >> 2) * 16;
    case FMT.RGBA8888: case FMT.ABGR8888: case FMT.ARGB8888: case FMT.BGRA8888: case FMT.BGRX8888: case FMT.UVWQ8888: return w * h * 4;
    case FMT.RGB888: case FMT.BGR888: case FMT.RGB888_BLUESCREEN: case FMT.BGR888_BLUESCREEN: return w * h * 3;
    case FMT.RGB565: case FMT.BGR565: case FMT.IA88: case FMT.BGRX5551: case FMT.BGRA4444: case FMT.BGRA5551: case FMT.UV88: return w * h * 2;
    case FMT.I8: case FMT.A8: return w * h;
    case FMT.RGBA16161616F: case FMT.RGBA16161616: return w * h * 8;
  }
  throw new Error('unsupported VTF format ' + fmt);
}

export function parseVTF(buf: ArrayBuffer): VTF {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x00465456) throw new Error('not VTF');
  const minor = dv.getUint32(8, true), headerSize = dv.getUint32(12, true);
  const width = dv.getUint16(16, true), height = dv.getUint16(18, true), flags = dv.getUint32(20, true), frames = dv.getUint16(24, true), firstFrame = dv.getUint16(26, true);
  const format = dv.getInt32(52, true), mips = dv.getUint8(56), loFmt = dv.getInt32(57, true), loW = dv.getUint8(61), loH = dv.getUint8(62);
  const depth = minor >= 2 ? Math.max(1, dv.getUint16(63, true)) : 1;
  let faces = 1; if (flags & TEXF.ENVMAP) faces = minor < 5 && firstFrame === 0xffff ? 7 : 6;
  let hiOfs = -1;
  if (minor >= 3) {
    const n = dv.getUint32(68, true);
    for (let i = 0; i < n; i++) { const o = 80 + i * 8; const tag = dv.getUint8(o) | dv.getUint8(o + 1) << 8 | dv.getUint8(o + 2) << 16; if (tag === 0x30) hiOfs = dv.getUint32(o + 4, true); }
  }
  if (hiOfs < 0) hiOfs = headerSize + (loFmt >= 0 && loW ? imageSize(loFmt, loW, loH) : 0);
  // mips are stored smallest first
  const data: Uint8Array[][] = []; let p = hiOfs;
  for (let m = mips - 1; m >= 0; m--) {
    const w = Math.max(1, width >> m), h = Math.max(1, height >> m), sz = imageSize(format, w, h), fr: Uint8Array[] = [];
    for (let f = 0; f < frames; f++) { for (let fc = 0; fc < faces; fc++) for (let s = 0; s < depth; s++) { if (fc === 0 && s === 0) fr.push(new Uint8Array(buf, p, Math.min(sz, buf.byteLength - p))); p += sz; } }
    data[m] = fr;
  }
  return { width, height, flags, frames, format, mips, faces, depth, data };
}

function c565(c: number, out: number[], o: number) { out[o] = ((c >> 11) & 31) * 255 / 31 | 0; out[o + 1] = ((c >> 5) & 63) * 255 / 63 | 0; out[o + 2] = (c & 31) * 255 / 31 | 0; }
export function decodeToRGBA(fmt: number, src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  if (fmt === FMT.DXT1 || fmt === FMT.DXT1_ONEBITALPHA || fmt === FMT.DXT3 || fmt === FMT.DXT5) {
    const bs = fmt === FMT.DXT1 || fmt === FMT.DXT1_ONEBITALPHA ? 8 : 16, bw = Math.max(1, (w + 3) >> 2), bh = Math.max(1, (h + 3) >> 2);
    const pal = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], alpha = new Uint8Array(16);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let o = (by * bw + bx) * bs;
      if (o + bs > src.length) break;
      if (fmt === FMT.DXT3) { for (let i = 0; i < 16; i++) alpha[i] = ((src[o + (i >> 1)] >> ((i & 1) * 4)) & 15) * 17; o += 8; }
      else if (fmt === FMT.DXT5) {
        const a0 = src[o], a1 = src[o + 1]; const av = [a0, a1, 0, 0, 0, 0, 0, 0];
        if (a0 > a1) for (let i = 1; i < 7; i++) av[i + 1] = ((7 - i) * a0 + i * a1) / 7 | 0; else { for (let i = 1; i < 5; i++) av[i + 1] = ((5 - i) * a0 + i * a1) / 5 | 0; av[6] = 0; av[7] = 255; }
        let bits = 0, nb = 0, bi = 2;
        for (let i = 0; i < 16; i++) { if (nb < 3) { bits |= src[o + bi++] << nb; nb += 8; } alpha[i] = av[bits & 7]; bits >>= 3; nb -= 3; }
        o += 8;
      } else alpha.fill(255);
      const c0 = src[o] | src[o + 1] << 8, c1 = src[o + 2] | src[o + 3] << 8;
      c565(c0, pal, 0); c565(c1, pal, 4); pal[3] = pal[7] = pal[11] = pal[15] = 255;
      if (c0 > c1 || bs === 16) for (let k = 0; k < 3; k++) { pal[8 + k] = (2 * pal[k] + pal[4 + k]) / 3 | 0; pal[12 + k] = (pal[k] + 2 * pal[4 + k]) / 3 | 0; }
      else { for (let k = 0; k < 3; k++) { pal[8 + k] = (pal[k] + pal[4 + k]) >> 1; pal[12 + k] = 0; } pal[15] = 0; }
      for (let i = 0; i < 16; i++) {
        const x = bx * 4 + (i & 3), y = by * 4 + (i >> 2); if (x >= w || y >= h) continue;
        const idx = (src[o + 4 + (i >> 2)] >> ((i & 3) * 2)) & 3, d = (y * w + x) * 4;
        out[d] = pal[idx * 4]; out[d + 1] = pal[idx * 4 + 1]; out[d + 2] = pal[idx * 4 + 2]; out[d + 3] = bs === 16 ? alpha[i] : pal[idx * 4 + 3];
      }
    }
    return out;
  }
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const d = i * 4; let r = 0, g = 0, b = 0, a = 255;
    switch (fmt) {
      case FMT.RGBA8888: r = src[i * 4]; g = src[i * 4 + 1]; b = src[i * 4 + 2]; a = src[i * 4 + 3]; break;
      case FMT.ABGR8888: a = src[i * 4]; b = src[i * 4 + 1]; g = src[i * 4 + 2]; r = src[i * 4 + 3]; break;
      case FMT.ARGB8888: a = src[i * 4]; r = src[i * 4 + 1]; g = src[i * 4 + 2]; b = src[i * 4 + 3]; break;
      case FMT.BGRA8888: b = src[i * 4]; g = src[i * 4 + 1]; r = src[i * 4 + 2]; a = src[i * 4 + 3]; break;
      case FMT.BGRX8888: b = src[i * 4]; g = src[i * 4 + 1]; r = src[i * 4 + 2]; break;
      case FMT.UVWQ8888: r = src[i * 4]; g = src[i * 4 + 1]; b = src[i * 4 + 2]; a = src[i * 4 + 3]; break;
      case FMT.RGB888: case FMT.RGB888_BLUESCREEN: r = src[i * 3]; g = src[i * 3 + 1]; b = src[i * 3 + 2]; if (fmt === FMT.RGB888_BLUESCREEN && r === 0 && g === 0 && b === 255) a = 0; break;
      case FMT.BGR888: case FMT.BGR888_BLUESCREEN: b = src[i * 3]; g = src[i * 3 + 1]; r = src[i * 3 + 2]; if (fmt === FMT.BGR888_BLUESCREEN && r === 0 && g === 0 && b === 255) a = 0; break;
      case FMT.RGB565: { const c = src[i * 2] | src[i * 2 + 1] << 8; b = (c >> 11 & 31) * 255 / 31; g = (c >> 5 & 63) * 255 / 63; r = (c & 31) * 255 / 31; break; }
      case FMT.BGR565: { const c = src[i * 2] | src[i * 2 + 1] << 8; r = (c >> 11 & 31) * 255 / 31; g = (c >> 5 & 63) * 255 / 63; b = (c & 31) * 255 / 31; break; }
      case FMT.BGRA4444: { const c = src[i * 2] | src[i * 2 + 1] << 8; b = (c & 15) * 17; g = (c >> 4 & 15) * 17; r = (c >> 8 & 15) * 17; a = (c >> 12 & 15) * 17; break; }
      case FMT.BGRA5551: case FMT.BGRX5551: { const c = src[i * 2] | src[i * 2 + 1] << 8; b = (c & 31) * 255 / 31; g = (c >> 5 & 31) * 255 / 31; r = (c >> 10 & 31) * 255 / 31; a = fmt === FMT.BGRA5551 && !(c & 0x8000) ? 0 : 255; break; }
      case FMT.I8: r = g = b = src[i]; break;
      case FMT.IA88: r = g = b = src[i * 2]; a = src[i * 2 + 1]; break;
      case FMT.A8: r = g = b = 255; a = src[i]; break;
      case FMT.UV88: r = src[i * 2]; g = src[i * 2 + 1]; b = 255; break;
      case FMT.RGBA16161616: { const v = new DataView(src.buffer, src.byteOffset + i * 8); r = v.getUint16(0, true) >> 8; g = v.getUint16(2, true) >> 8; b = v.getUint16(4, true) >> 8; a = v.getUint16(6, true) >> 8; break; }
      case FMT.RGBA16161616F: { const v = new DataView(src.buffer, src.byteOffset + i * 8); const tm = (x: number) => Math.min(255, Math.pow(Math.max(0, half(x)), 1 / 2.2) * 255);
        r = tm(v.getUint16(0, true)); g = tm(v.getUint16(2, true)); b = tm(v.getUint16(4, true)); break; }
    }
    out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = a;
  }
  return out;
}
function half(h: number) { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * 6.103515625e-5 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + f / 1024); }
