// Local-only dev/asset server. Serves the site and streams files from the user's own Portal install.
// Binds to 127.0.0.1 only. Nothing is copied out of the install or hosted publicly.
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { portalFS } from '../src/vpk.ts';

const INSTALL = process.env.PORTAL_DIR || `${process.env.HOME}/.steam/debian-installation/steamapps/common/Portal`;
const PORT = +(process.env.PORT || 8420);
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
  if (u.pathname === '/ls') return send(200, JSON.stringify(g.list(u.searchParams.get('p') || '')), 'application/json');
  let f = path.join(SITE, path.normalize(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'nf', 'text/plain');
  send(200, fs.readFileSync(f), types[path.extname(f)] || 'application/octet-stream');
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/`));
