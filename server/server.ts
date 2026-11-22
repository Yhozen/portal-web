// Local-only dev/asset server. Serves the site and streams files from the user's own Portal install.
// Binds to 127.0.0.1 only. Nothing is copied out of the install or hosted publicly.
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { portalFS } from '../src/vpk.ts';

const INSTALL = process.env.PORTAL_DIR || `${process.env.HOME}/.steam/debian-installation/steamapps/common/Portal`;
const PORT = +(process.env.PORT || 8420);
const FILES = process.env.FILES_DIR ? path.resolve(process.env.FILES_DIR) : '';
const SITE = path.resolve(import.meta.dirname, '../site');
const t0 = Date.now();
const g = portalFS(INSTALL);
console.log(`mounted ${g.mounts.length} search paths from ${INSTALL} in ${Date.now() - t0} ms`);
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.map': 'application/json' };

http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://x');
  const send = (code: number, body: Buffer | string, type = 'application/octet-stream') => {
    const gz = typeof body !== 'string' && body.length > 2048 && /gzip/.test(String(req.headers['accept-encoding'])) && !/\.(png|mp3)$/.test(u.pathname);
    const out = gz ? zlib.gzipSync(body as Buffer, { level: 1 }) : body;
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-cache', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
    res.end(out);
  };
  if (u.pathname.startsWith('/fs/')) {
    const p = decodeURIComponent(u.pathname.slice(4));
    const b = g.read(p);
    if (!b) console.log('404', p);
    return b ? send(200, b) : send(404, 'not found: ' + p, 'text/plain');
  }
  // FILES_DIR: serve a copy laid out like the hosted preview's private bucket (manifest.json, portal/, hl2/) at
  // /files/ with single Range requests, so ?files=local exercises the hosted-private reader without the Worker.
  if (FILES && u.pathname.startsWith('/files/')) {
    const f = path.join(FILES, path.normalize(decodeURIComponent(u.pathname.slice(7))));
    if (!f.startsWith(FILES) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'nf', 'text/plain');
    const size = fs.statSync(f).size, m = /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range || ''));
    if (!m) { res.writeHead(200, { 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' }); return void fs.createReadStream(f).pipe(res); }
    const a = +m[1], b = Math.min(m[2] ? +m[2] : size - 1, size - 1);
    if (a > b) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return void res.end(); }
    res.writeHead(206, { 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${size}`, 'cache-control': 'no-store' });
    return void fs.createReadStream(f, { start: a, end: b }).pipe(res);
  }
  if (u.pathname === '/ls') return send(200, JSON.stringify(g.list(u.searchParams.get('p') || '')), 'application/json');
  let f = path.join(SITE, path.normalize(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'nf', 'text/plain');
  send(200, fs.readFileSync(f), types[path.extname(f)] || 'application/octet-stream');
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/`));
