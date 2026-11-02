// VPK v1/v2 directory reader (clean-room, from the public Valve Developer Wiki "VPK File Format" spec).
// Node-only: used by the local asset server to read files out of the user's own Portal install.
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface VpkEntry { crc: number; preload: Buffer | null; archive: number; offset: number; length: number; }

export class Vpk {
  entries = new Map<string, VpkEntry>();
  private base: string; // e.g. /.../portal_pak
  private dataStart = 0;
  private fds = new Map<number, number>();
  dirPath: string;
  constructor(dirPath: string) {
    this.dirPath = dirPath;
    this.base = dirPath.replace(/_dir\.vpk$/i, '');
    const buf = fs.readFileSync(dirPath);
    const sig = buf.readUInt32LE(0);
    if (sig !== 0x55aa1234) throw new Error('not a VPK: ' + dirPath);
    const version = buf.readUInt32LE(4);
    const treeSize = buf.readUInt32LE(8);
    const headerSize = version === 1 ? 12 : 28;
    this.dataStart = headerSize + treeSize;
    let p = headerSize;
    const str = () => { const e = buf.indexOf(0, p); const s = buf.toString('latin1', p, e); p = e + 1; return s; };
    for (;;) {
      const ext = str(); if (!ext) break;
      for (;;) {
        const dir = str(); if (!dir) break;
        for (;;) {
          const name = str(); if (!name) break;
          const crc = buf.readUInt32LE(p), preloadBytes = buf.readUInt16LE(p + 4), archive = buf.readUInt16LE(p + 6);
          const offset = buf.readUInt32LE(p + 8), length = buf.readUInt32LE(p + 12);
          p += 18;
          const preload = preloadBytes ? Buffer.from(buf.subarray(p, p + preloadBytes)) : null;
          p += preloadBytes;
          const full = ((dir === ' ' ? '' : dir + '/') + (name === ' ' ? '' : name) + (ext === ' ' ? '' : '.' + ext)).toLowerCase();
          this.entries.set(full, { crc, preload, archive, offset, length });
        }
      }
    }
  }
  has(p: string) { return this.entries.has(p.toLowerCase()); }
  read(p: string): Buffer | null {
    const e = this.entries.get(p.toLowerCase()); if (!e) return null;
    const parts: Buffer[] = [];
    if (e.preload) parts.push(e.preload);
    if (e.length) {
      let file: string, off = e.offset;
      if (e.archive === 0x7fff) { file = this.dirPath; off += this.dataStart; }
      else file = `${this.base}_${String(e.archive).padStart(3, '0')}.vpk`;
      let fd = this.fds.get(e.archive);
      if (fd === undefined) { fd = fs.openSync(file, 'r'); this.fds.set(e.archive, fd); }
      const b = Buffer.alloc(e.length); fs.readSync(fd, b, 0, e.length, off); parts.push(b);
    }
    return parts.length === 1 ? parts[0] : Buffer.concat(parts);
  }
}

// Source-style search path: loose dirs and VPKs, first match wins (mirrors gameinfo.txt order for Portal).
export class GameFS {
  mounts: ({ kind: 'dir'; root: string; index: Map<string, string> } | { kind: 'vpk'; vpk: Vpk })[] = [];
  addDir(root: string) {
    // case-insensitive index of the loose tree
    const index = new Map<string, string>();
    const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else index.set(path.relative(root, f).toLowerCase().split(path.sep).join('/'), f); } };
    if (fs.existsSync(root)) walk(root);
    this.mounts.push({ kind: 'dir', root, index });
  }
  addVpk(p: string) { if (fs.existsSync(p)) this.mounts.push({ kind: 'vpk', vpk: new Vpk(p) }); }
  read(p: string): Buffer | null {
    const k = p.toLowerCase().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
    for (const m of this.mounts) {
      if (m.kind === 'dir') { const f = m.index.get(k); if (f) return fs.readFileSync(f); }
      else { const b = m.vpk.read(k); if (b) return b; }
    }
    return null;
  }
  list(prefix: string) {
    const out = new Set<string>(); const k = prefix.toLowerCase();
    for (const m of this.mounts) { const keys = m.kind === 'dir' ? m.index.keys() : m.vpk.entries.keys(); for (const x of keys) if (x.startsWith(k)) out.add(x); }
    return [...out].sort();
  }
}

export function portalFS(install: string) {
  // Order follows portal/gameinfo.txt SearchPaths: VPKs first, then loose portal/, then loose hl2/.
  const g = new GameFS();
  g.addVpk(path.join(install, 'portal/portal_pak_dir.vpk'));
  for (const v of ['hl2_textures', 'hl2_sound_vo_english', 'hl2_sound_misc', 'hl2_misc']) g.addVpk(path.join(install, `hl2/${v}_dir.vpk`));
  g.addDir(path.join(install, 'portal'));
  g.addDir(path.join(install, 'hl2'));
  return g;
}
