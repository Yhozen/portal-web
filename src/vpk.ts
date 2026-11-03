// VPK reader for the local dev server (directory parsing lives in vpkdir.ts, shared with the browser).
// Node-only: used by the local asset server to read files out of the user's own Portal install.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseVpkDir, VPK_EMBEDDED, VPK_MOUNTS, type VpkEntry } from './vpkdir.ts';

export type { VpkEntry };

export class Vpk {
  entries: Map<string, VpkEntry>;
  private base: string; // e.g. /.../portal_pak
  private dataStart = 0;
  private fds = new Map<number, number>();
  dirPath: string;
  constructor(dirPath: string) {
    this.dirPath = dirPath;
    this.base = dirPath.replace(/_dir\.vpk$/i, '');
    let dir;
    try { dir = parseVpkDir(fs.readFileSync(dirPath)); } catch { throw new Error('not a VPK: ' + dirPath); }
    this.entries = dir.entries; this.dataStart = dir.dataStart;
  }
  has(p: string) { return this.entries.has(p.toLowerCase()); }
  read(p: string): Buffer | null {
    const e = this.entries.get(p.toLowerCase()); if (!e) return null;
    const parts: Buffer[] = [];
    if (e.preload) parts.push(Buffer.from(e.preload));
    if (e.length) {
      let file: string, off = e.offset;
      if (e.archive === VPK_EMBEDDED) { file = this.dirPath; off += this.dataStart; }
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
  for (const v of VPK_MOUNTS) g.addVpk(path.join(install, `${v}_dir.vpk`));
  g.addDir(path.join(install, 'portal'));
  g.addDir(path.join(install, 'hl2'));
  return g;
}
