// Minimal ZIP reader for the BSP pakfile lump (stored or deflate entries).
export class Zip {
  files = new Map<string, { ofs: number; csize: number; size: number; method: number }>();
  data: Uint8Array;
  constructor(data: Uint8Array) {
    this.data = data; const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let eocd = -1; for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return;
    const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(data.subarray(p + 46, p + 46 + nl)).toLowerCase().replace(/\\/g, '/');
      const lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
      this.files.set(name, { ofs: lho + 30 + lnl + lel, csize, size, method });
      p += 46 + nl + el + cl;
    }
  }
  async read(name: string): Promise<Uint8Array | null> {
    const e = this.files.get(name.toLowerCase()); if (!e) return null;
    const raw = this.data.subarray(e.ofs, e.ofs + e.csize);
    if (e.method === 0) return raw.slice();
    if (e.method === 8) { const ds = new DecompressionStream('deflate-raw'); const out = await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer(); return new Uint8Array(out); }
    console.warn('zip method', e.method, name); return null;
  }
}
