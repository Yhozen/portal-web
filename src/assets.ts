import { Zip } from './zip.ts';
import type { FileSource } from './files.ts';
import { normPath } from './vpkdir.ts';
// Reads game files from a FileSource (local dev server or the browser's private copy), with the current
// map's pakfile as an overlay.
export class Assets {
  pak: Zip | null = null; cache = new Map<string, Promise<ArrayBuffer | null>>(); bytes = 0; requests = 0;
  constructor(public source: FileSource) { }
  norm(p: string) { return normPath(p); }
  read(p: string): Promise<ArrayBuffer | null> {
    p = this.norm(p);
    let c = this.cache.get(p);
    if (!c) {
      c = (async () => {
        if (this.pak) { const b = await this.pak.read(p); if (b) return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }
        this.requests++;
        const ab = await this.source.read(p); if (ab) this.bytes += ab.byteLength; return ab;
      })();
      this.cache.set(p, c);
    }
    return c;
  }
  async text(p: string) { const b = await this.read(p); return b ? new TextDecoder('latin1').decode(b) : null; }
}
