// Browser-local copy of the player's own Portal files, kept in the Origin Private File System (OPFS).
// The hosted build never serves game content: on first run the player points the page at their Steam
// install (folder picker, drag and drop, or a folder <input>), the needed files are copied into this
// browser's private storage, and later loads read them from there. "Forget files" deletes the copy.
import type { FileSource } from './files.ts';
import { LOOSE_MOUNTS, normPath, parseVpkDir, VPK_EMBEDDED, VPK_MOUNTS, type VpkEntry } from './vpkdir.ts';
import { showFilesScreen } from './picker.ts';

export const STORE_DIR = 'portal-files';
const MANIFEST = 'manifest.json';
export interface Manifest { format: 1; files: Record<string, number>; total: number; importedAt: string; }

// ---- what to copy -----------------------------------------------------------------------------------------
// Paths are relative to the Portal install root (the folder holding portal/ and hl2/), lower case.
const WANT = [
  /^portal\/portal_pak_(dir|\d{3})\.vpk$/,
  /^hl2\/hl2_(textures|sound_vo_english|sound_misc|misc)_(dir|\d{3})\.vpk$/,
  /^portal\/maps\/[^/]+\.bsp$/,
  /^portal\/(resource|scripts|sound)\/.+[^/]$/,
  /^hl2\/(resource|scripts)\/.+[^/]$/,
];
const SKIP = /(^|\/)(\.ds_store|thumbs\.db|desktop\.ini)$|\.cache$/;
export const REQUIRED = ['portal/portal_pak_dir.vpk', 'hl2/hl2_textures_dir.vpk', 'hl2/hl2_misc_dir.vpk'];
export const wanted = (rel: string) => !SKIP.test(rel) && WANT.some(r => r.test(rel));

export interface Candidate { rel: string; size: number; open(): Promise<File>; }
export interface RawEntry { path: string; size: number; open(): Promise<File>; }

// Map whatever the player handed us (paths relative to the picked/dropped item) onto install-root paths.
export function selectImport(raw: RawEntry[]): Candidate[] {
  const lower = raw.map(r => ({ ...r, path: normPath(r.path) }));
  // Root = whatever prefix precedes portal/portal_pak_dir.vpk (they may have picked Portal, common, steamapps...)
  const anchor = lower.find(r => /(^|\/)portal\/portal_pak_dir\.vpk$/.test(r.path));
  const out = new Map<string, Candidate>();
  if (anchor) {
    const prefix = anchor.path.slice(0, anchor.path.length - 'portal/portal_pak_dir.vpk'.length);
    for (const r of lower) if (r.path.startsWith(prefix)) {
      const rel = r.path.slice(prefix.length);
      if (wanted(rel) && !out.has(rel)) out.set(rel, { rel, size: r.size, open: r.open });
    }
  } else {
    // Loose files dropped without their folders: place them by name.
    for (const r of lower) {
      const base = r.path.split('/').pop()!;
      const rel = /^portal_pak_/.test(base) ? 'portal/' + base : /^hl2_/.test(base) ? 'hl2/' + base : /\.bsp$/.test(base) ? 'portal/maps/' + base : '';
      if (rel && wanted(rel) && !out.has(rel)) out.set(rel, { rel, size: r.size, open: r.open });
    }
  }
  return [...out.values()].sort((a, b) => a.rel < b.rel ? -1 : 1);
}

// Check the set is playable before copying gigabytes: required directories present, every VPK archive
// that a directory refers to present, and at least one map.
export async function validateImport(c: Candidate[]): Promise<string[]> {
  const have = new Map(c.map(x => [x.rel, x]));
  const problems: string[] = [];
  for (const r of REQUIRED) if (!have.has(r)) problems.push(`missing ${r}`);
  if (!c.some(x => x.rel.startsWith('portal/maps/'))) problems.push('missing portal/maps/*.bsp');
  for (const v of VPK_MOUNTS) {
    const dir = have.get(`${v}_dir.vpk`); if (!dir) continue;
    let entries: Map<string, VpkEntry>;
    try { entries = parseVpkDir(new Uint8Array(await (await dir.open()).arrayBuffer())).entries; }
    catch { problems.push(`${v}_dir.vpk is not a VPK directory`); continue; }
    const need = new Set<number>(); for (const e of entries.values()) if (e.length && e.archive !== VPK_EMBEDDED) need.add(e.archive);
    for (const a of [...need].sort((x, y) => x - y)) { const n = `${v}_${String(a).padStart(3, '0')}.vpk`; if (!have.has(n)) problems.push(`missing ${n}`); }
  }
  return problems;
}

// ---- collecting entries from the three input routes ---------------------------------------------------------
// 1. A directory handle (showDirectoryPicker, or a dropped folder in Chromium). Only the relevant subtrees are
//    walked, so picking steamapps/common does not enumerate every other game.
export async function entriesFromHandle(dir: FileSystemDirectoryHandle): Promise<RawEntry[]> {
  const child = async (d: FileSystemDirectoryHandle, name: string) => {
    for await (const [n, h] of (d as any).entries() as AsyncIterable<[string, FileSystemHandle]>)
      if (n.toLowerCase() === name && h.kind === 'directory') return h as FileSystemDirectoryHandle;
    return null;
  };
  const hasPak = async (d: FileSystemDirectoryHandle) => {
    const p = await child(d, 'portal'); if (!p) return false;
    for await (const n of (p as any).keys() as AsyncIterable<string>) if (n.toLowerCase() === 'portal_pak_dir.vpk') return true;
    return false;
  };
  let root: FileSystemDirectoryHandle | null = null;
  for (const route of [[], ['portal'], ['common', 'portal'], ['steamapps', 'common', 'portal']]) {
    let d: FileSystemDirectoryHandle | null = dir;
    for (const step of route) d = d && await child(d, step);
    if (d && await hasPak(d)) { root = d; break; }
  }
  if (!root) {
    // Picked the inner portal/ (or hl2/) folder, or a folder of loose VPKs: take its files flat.
    const out: RawEntry[] = [];
    for await (const [n, h] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>)
      if (h.kind === 'file') { const f = await (h as FileSystemFileHandle).getFile(); out.push({ path: n, size: f.size, open: async () => f }); }
    return out;
  }
  const out: RawEntry[] = [];
  const walk = async (d: FileSystemDirectoryHandle, prefix: string, depth: number) => {
    for await (const [n, h] of (d as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
      const rel = prefix + n.toLowerCase();
      if (h.kind === 'file') { if (wanted(rel)) { const f = await (h as FileSystemFileHandle).getFile(); out.push({ path: rel, size: f.size, open: async () => f }); } }
      else if (depth === 0 ? ['portal', 'hl2'].includes(rel) : depth === 1 ? /^(portal\/(maps|resource|scripts|sound)|hl2\/(resource|scripts))$/.test(rel) : true)
        await walk(h as FileSystemDirectoryHandle, rel + '/', depth + 1);
    }
  };
  await walk(root, '', 0);
  return out;
}

// 2. <input type=file webkitdirectory> (every browser) or a plain multi-file input.
export function entriesFromFileList(files: Iterable<File>): RawEntry[] {
  return [...files].map(f => ({ path: (f as any).webkitRelativePath || f.name, size: f.size, open: async () => f }));
}

// 3. Drag and drop. Chromium gives real handles; Firefox/Safari give FileSystemEntry trees.
export async function entriesFromDrop(dt: DataTransfer): Promise<RawEntry[]> {
  // Everything is taken from the DataTransfer synchronously: it is emptied once the drop event returns.
  const items = [...dt.items].filter(i => i.kind === 'file'); const flat = [...dt.files];
  const out: RawEntry[] = [];
  const handles = items.map(i => 'getAsFileSystemHandle' in i ? (i as any).getAsFileSystemHandle() as Promise<FileSystemHandle | null> : Promise.resolve(null));
  const entries = items.map(i => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  for (const h of await Promise.all(handles.map(p => p.catch(() => null)))) {
    if (!h) continue;
    if (h.kind === 'directory') out.push(...await entriesFromHandle(h as FileSystemDirectoryHandle));
    else { const f = await (h as FileSystemFileHandle).getFile(); out.push({ path: f.name, size: f.size, open: async () => f }); }
  }
  if (out.length) return out;
  const walk = async (e: FileSystemEntry, prefix: string): Promise<void> => {
    if (e.isFile) {
      const f = await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej));
      out.push({ path: prefix + e.name, size: f.size, open: async () => f });
    } else if (e.isDirectory) {
      const reader = (e as FileSystemDirectoryEntry).createReader();
      for (;;) { // readEntries returns batches (100 in Chromium) until an empty one
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const c of batch) await walk(c, prefix + e.name + '/');
      }
    }
  };
  for (const e of entries) await walk(e, '');
  if (!out.length) out.push(...entriesFromFileList(flat));
  return out;
}

// ---- OPFS store ---------------------------------------------------------------------------------------------
export const opfsSupported = () => typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
async function storeRoot(create = true) {
  return (await navigator.storage.getDirectory()).getDirectoryHandle(STORE_DIR, { create });
}
async function dirOf(root: FileSystemDirectoryHandle, rel: string, create: boolean) {
  const parts = rel.split('/'); let d = root;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create });
  return { dir: d, name: parts[parts.length - 1] };
}

export async function readManifest(): Promise<Manifest | null> {
  if (!opfsSupported()) return null;
  try {
    const root = await storeRoot(false);
    const m = JSON.parse(await (await (await root.getFileHandle(MANIFEST)).getFile()).text()) as Manifest;
    return m?.format === 1 && m.files ? m : null;
  } catch { return null; }
}

export async function forgetFiles() {
  try { await (await navigator.storage.getDirectory()).removeEntry(STORE_DIR, { recursive: true }); }
  catch (e: any) { if (e?.name !== 'NotFoundError') throw e; }
}

export interface StorageInfo { usage: number; quota: number; persisted: boolean; }
export async function storageInfo(): Promise<StorageInfo> {
  const est = await navigator.storage.estimate?.().catch(() => ({} as StorageEstimate)) ?? {};
  const persisted = await navigator.storage.persisted?.().catch(() => false) ?? false;
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}

// Safari before createWritable(): write through a dedicated worker with a sync access handle.
const WRITER = `onmessage = async ({ data: { parts, file } }) => {
  let h; try { let d = await navigator.storage.getDirectory();
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    h = await (await d.getFileHandle(parts[parts.length - 1], { create: true })).createSyncAccessHandle();
    h.truncate(0); let at = 0; const r = file.stream().getReader();
    for (;;) { const { done, value } = await r.read(); if (done) break; h.write(value, { at }); at += value.byteLength; postMessage({ bytes: value.byteLength }); }
    h.flush(); h.close(); postMessage({ done: true });
  } catch (e) { try { h && h.close(); } catch {} postMessage({ error: String(e && e.message || e), name: e && e.name }); } };`;
let writerUrl = '';
function writeViaWorker(parts: string[], file: File, onBytes: (n: number) => void) {
  writerUrl ||= URL.createObjectURL(new Blob([WRITER], { type: 'text/javascript' }));
  const w = new Worker(writerUrl);
  return new Promise<void>((res, rej) => {
    w.onmessage = ({ data }) => {
      if (data.bytes) onBytes(data.bytes);
      else if (data.done) { w.terminate(); res(); }
      else if (data.error) { w.terminate(); rej(Object.assign(new Error(data.error), { name: data.name })); }
    };
    w.onerror = e => { w.terminate(); rej(new Error(e.message)); };
    w.postMessage({ parts, file });
  });
}

async function copyOne(root: FileSystemDirectoryHandle, c: Candidate, onBytes: (n: number) => void) {
  const file = await c.open();
  const { dir, name } = await dirOf(root, c.rel, true);
  const fh = await dir.getFileHandle(name, { create: true });
  if ('createWritable' in fh) {
    const w = await (fh as any).createWritable({ keepExistingData: false }) as FileSystemWritableFileStream;
    const count = new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, ctl) { onBytes(chunk.byteLength); ctl.enqueue(chunk); } });
    await file.stream().pipeThrough(count).pipeTo(w as any);
  } else await writeViaWorker([STORE_DIR, ...c.rel.split('/')], file, onBytes);
}

export interface Progress { done: number; total: number; file: string; index: number; count: number; }
export class StorageFullError extends Error { name = 'StorageFullError'; }

// Copy the selection into OPFS. Files already stored with the right size are kept (an interrupted copy
// resumes). The manifest is written last, so a half-finished copy is never mistaken for a complete one.
export async function importFiles(c: Candidate[], onProgress: (p: Progress) => void = () => { }) {
  if (!opfsSupported()) throw new Error('This browser has no private file storage (OPFS).');
  const problems = await validateImport(c);
  if (problems.length) throw new Error('These are not the Portal files this needs:\n' + problems.join('\n'));
  await navigator.storage.persist?.().catch(() => false); // ask the browser not to evict our copy
  const root = await storeRoot(true);
  // Drop any manifest first: until the new one is written the store counts as incomplete.
  await root.removeEntry(MANIFEST).catch(() => { });
  const present = new Map<string, number>();
  await Promise.all(c.map(async x => { try { const { dir, name } = await dirOf(root, x.rel, false); present.set(x.rel, (await (await dir.getFileHandle(name)).getFile()).size); } catch { } }));
  const total = c.reduce((s, x) => s + x.size, 0);
  const todo = c.filter(x => present.get(x.rel) !== x.size);
  const need = todo.reduce((s, x) => s + x.size, 0);
  const info = await storageInfo();
  if (info.quota && info.quota - info.usage < need)
    throw new StorageFullError(`Not enough browser storage: the copy needs ${fmtBytes(need)} more but only ${fmtBytes(info.quota - info.usage)} is available. Free some disk space (browsers allow a share of free disk) and try again.`);
  let done = total - need;
  for (let i = 0; i < todo.length; i++) {
    const x = todo[i];
    onProgress({ done, total, file: x.rel, index: i, count: todo.length });
    try { await copyOne(root, x, n => { done += n; onProgress({ done, total, file: x.rel, index: i, count: todo.length }); }); }
    catch (e: any) {
      if (e?.name === 'QuotaExceededError') throw new StorageFullError(`Browser storage filled up while copying ${x.rel}. Free some disk space and try again; already copied files are kept.`);
      throw e;
    }
  }
  const manifest: Manifest = { format: 1, files: Object.fromEntries(c.map(x => [x.rel, x.size])), total, importedAt: new Date().toISOString() };
  const w = await (await root.getFileHandle(MANIFEST, { create: true }) as any).createWritable?.();
  if (w) { await w.write(JSON.stringify(manifest)); await w.close(); }
  else await writeViaWorker([STORE_DIR, MANIFEST], new File([JSON.stringify(manifest)], MANIFEST), () => { });
  onProgress({ done: total, total, file: '', index: todo.length, count: todo.length });
  return manifest;
}

export const fmtBytes = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(0) + ' MB' : (n / 1e3).toFixed(0) + ' kB';

// ---- reading ------------------------------------------------------------------------------------------------
class BrowserVpk {
  entries: Map<string, VpkEntry>; private dataStart: number; private dirFile: File; private archive: (n: number) => Promise<File | null>;
  constructor(entries: Map<string, VpkEntry>, dataStart: number, dirFile: File, archive: (n: number) => Promise<File | null>) {
    this.entries = entries; this.dataStart = dataStart; this.dirFile = dirFile; this.archive = archive;
  }
  async read(k: string): Promise<ArrayBuffer | null | undefined> {
    const e = this.entries.get(k); if (!e) return undefined;
    const parts: Uint8Array[] = []; if (e.preload) parts.push(e.preload.slice());
    if (e.length) {
      const f = e.archive === VPK_EMBEDDED ? this.dirFile : await this.archive(e.archive); if (!f) return null;
      const off = e.offset + (e.archive === VPK_EMBEDDED ? this.dataStart : 0);
      parts.push(new Uint8Array(await f.slice(off, off + e.length).arrayBuffer()));
    }
    if (parts.length === 1 && parts[0].byteOffset === 0 && parts[0].byteLength === parts[0].buffer.byteLength) return parts[0].buffer as ArrayBuffer;
    const out = new Uint8Array(parts.reduce((s, p) => s + p.byteLength, 0)); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.byteLength; }
    return out.buffer;
  }
}

export class LocalSource implements FileSource {
  readonly kind = 'local';
  private vpks: BrowserVpk[] = []; private loose = new Map<string, string>(); private files = new Map<string, Promise<File | null>>();
  private root: FileSystemDirectoryHandle; manifest: Manifest;
  constructor(root: FileSystemDirectoryHandle, manifest: Manifest) { this.root = root; this.manifest = manifest; }
  file(rel: string) {
    let f = this.files.get(rel);
    if (!f) { f = dirOf(this.root, rel, false).then(async ({ dir, name }) => (await dir.getFileHandle(name)).getFile()).catch(() => null); this.files.set(rel, f); }
    return f;
  }
  async mount() {
    for (const v of VPK_MOUNTS) {
      const dirFile = this.manifest.files[`${v}_dir.vpk`] !== undefined ? await this.file(`${v}_dir.vpk`) : null;
      if (!dirFile) continue;
      const d = parseVpkDir(new Uint8Array(await dirFile.arrayBuffer()));
      this.vpks.push(new BrowserVpk(d.entries, d.dataStart, dirFile, n => this.file(`${v}_${String(n).padStart(3, '0')}.vpk`)));
    }
    for (const m of LOOSE_MOUNTS) for (const rel of Object.keys(this.manifest.files)) {
      if (!rel.startsWith(m + '/') || rel.endsWith('.vpk')) continue;
      const k = rel.slice(m.length + 1); if (!this.loose.has(k)) this.loose.set(k, rel);
    }
    return this;
  }
  async read(p: string) {
    for (const v of this.vpks) { const b = await v.read(p); if (b !== undefined) return b; }
    const rel = this.loose.get(p); if (!rel) return null;
    const f = await this.file(rel); return f ? f.arrayBuffer() : null;
  }
}

export async function openStore(): Promise<LocalSource | null> {
  const m = await readManifest(); if (!m) return null;
  return new LocalSource(await storeRoot(false), m).mount();
}

export async function openLocalSource(): Promise<FileSource> {
  const manage = new URLSearchParams(location.search).get('files') === 'manage';
  let src = manage ? null : await openStore().catch(() => null);
  if (!src) { await showFilesScreen(); src = await openStore(); }
  if (!src) throw new Error('No Portal files available');
  addManageButton();
  return src;
}

function addManageButton() {
  const b = document.createElement('button');
  b.textContent = 'Portal files…'; b.id = 'files-btn';
  b.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:5;font:12px sans-serif;background:#0008;color:#cfe;border:1px solid #cfe6;border-radius:3px;padding:3px 8px;cursor:pointer';
  b.onclick = () => { const u = new URLSearchParams(location.search); u.set('files', 'manage'); location.search = u.toString(); };
  document.body.appendChild(b);
}

// Test/automation hook (no game data involved): lets a harness feed File objects through the same path.
(globalThis as any).portalFiles = { selectImport, validateImport, importFiles, entriesFromFileList, entriesFromHandle, readManifest, forgetFiles, storageInfo, openStore };
