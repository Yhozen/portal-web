// VPK v1/v2 directory-tree parser shared by the Node dev server and the browser file source.
// Clean-room, from the public Valve Developer Wiki "VPK File Format" page. Pure: works on any Uint8Array.
export interface VpkEntry { crc: number; preload: Uint8Array | null; archive: number; offset: number; length: number; }
export const VPK_EMBEDDED = 0x7fff; // archive index meaning "stored after the tree in the _dir.vpk itself"

export function parseVpkDir(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.byteLength < 12 || dv.getUint32(0, true) !== 0x55aa1234) throw new Error('not a VPK directory');
  const version = dv.getUint32(4, true), treeSize = dv.getUint32(8, true);
  const headerSize = version === 1 ? 12 : 28;
  const entries = new Map<string, VpkEntry>();
  const latin1 = new TextDecoder('latin1');
  let p = headerSize;
  const str = () => { const e = buf.indexOf(0, p); const s = latin1.decode(buf.subarray(p, e)); p = e + 1; return s; };
  for (;;) {
    const ext = str(); if (!ext) break;
    for (;;) {
      const dir = str(); if (!dir) break;
      for (;;) {
        const name = str(); if (!name) break;
        const crc = dv.getUint32(p, true), preloadBytes = dv.getUint16(p + 4, true), archive = dv.getUint16(p + 6, true);
        const offset = dv.getUint32(p + 8, true), length = dv.getUint32(p + 12, true);
        p += 18;
        const preload = preloadBytes ? buf.slice(p, p + preloadBytes) : null;
        p += preloadBytes;
        const full = ((dir === ' ' ? '' : dir + '/') + (name === ' ' ? '' : name) + (ext === ' ' ? '' : '.' + ext)).toLowerCase();
        entries.set(full, { crc, preload, archive, offset, length });
      }
    }
  }
  return { entries, dataStart: headerSize + treeSize, version };
}

// Search order from portal/gameinfo.txt: VPKs first, then the loose portal/ tree, then loose hl2/.
export const VPK_MOUNTS = ['portal/portal_pak', 'hl2/hl2_textures', 'hl2/hl2_sound_vo_english', 'hl2/hl2_sound_misc', 'hl2/hl2_misc'];
export const LOOSE_MOUNTS = ['portal', 'hl2'];
export const normPath = (p: string) => p.toLowerCase().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '');
