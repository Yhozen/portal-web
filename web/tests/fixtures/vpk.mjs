// Synthetic VPK v2 directories for tests (made-up bytes; no game data).
export function vpkDir(files, { embedded = false } = {}) {
  // files: [{ path: "materials/x.vmt", archive, offset, data?: Uint8Array, preload?: Uint8Array, length }]
  const enc = new TextEncoder(), parts = [];
  const byExt = new Map();
  for (const f of files) {
    const slash = f.path.lastIndexOf("/"), dot = f.path.lastIndexOf(".");
    const dir = slash < 0 ? " " : f.path.slice(0, slash), name = f.path.slice(slash + 1, dot), ext = f.path.slice(dot + 1);
    if (!byExt.has(ext)) byExt.set(ext, new Map());
    const dirs = byExt.get(ext); if (!dirs.has(dir)) dirs.set(dir, []); dirs.get(dir).push({ ...f, name });
  }
  const str = (s) => parts.push(enc.encode(s + "\0"));
  for (const [ext, dirs] of byExt) {
    str(ext);
    for (const [dir, list] of dirs) {
      str(dir);
      for (const f of list) {
        str(f.name);
        const e = new DataView(new ArrayBuffer(18)), preload = f.preload ?? new Uint8Array();
        e.setUint32(0, 0, true); e.setUint16(4, preload.length, true); e.setUint16(6, embedded ? 0x7fff : f.archive, true);
        e.setUint32(8, f.offset, true); e.setUint32(12, f.length, true); e.setUint16(16, 0xffff, true);
        parts.push(new Uint8Array(e.buffer), preload);
      }
      str("");
    }
    str("");
  }
  str("");
  const tree = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0;
  for (const p of parts) { tree.set(p, o); o += p.length; }
  const header = new DataView(new ArrayBuffer(28));
  header.setUint32(0, 0x55aa1234, true); header.setUint32(4, 2, true); header.setUint32(8, tree.length, true);
  const data = embedded ? files.map((f) => f.data ?? new Uint8Array()) : [];
  return new Uint8Array([...new Uint8Array(header.buffer), ...tree, ...data.flatMap((d) => [...d])]);
}
