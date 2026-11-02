import { Zip } from './zip.ts';
// Reads game files from the local asset server (/fs/...), with the current map's pakfile as an overlay.
export class Assets {
  pak: Zip | null = null; cache = new Map<string, Promise<ArrayBuffer | null>>(); bytes = 0; requests = 0;
  norm(p: string) { return p.toLowerCase().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, ''); }
  read(p: string): Promise<ArrayBuffer | null> {
    p = this.norm(p);
    let c = this.cache.get(p);
    if (!c) {
      c = (async () => {
        if (this.pak) { const b = await this.pak.read(p); if (b) return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }
        this.requests++;
        const r = await fetch('/fs/' + p.split('/').map(encodeURIComponent).join('/'));
        if (!r.ok) return null; const ab = await r.arrayBuffer(); this.bytes += ab.byteLength; return ab;
      })();
      this.cache.set(p, c);
    }
    return c;
  }
  async text(p: string) { const b = await this.read(p); return b ? new TextDecoder('latin1').decode(b) : null; }
}
