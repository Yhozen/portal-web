import { portalFS } from '../src/vpk.ts';
const INSTALL = process.env.PORTAL_DIR || `${process.env.HOME}/.steam/debian-installation/steamapps/common/Portal`;
const g = portalFS(INSTALL);
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'ls') for (const f of g.list(arg || '')) console.log(f);
else if (cmd === 'cat') { const b = g.read(arg); if (!b) { console.error('missing'); process.exit(1); } process.stdout.write(b); }
else for (const m of g.mounts) console.log(m.kind, m.kind === 'vpk' ? m.vpk.dirPath + ' ' + m.vpk.entries.size : m.root + ' ' + m.index.size);
