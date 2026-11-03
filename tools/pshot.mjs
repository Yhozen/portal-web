// Pose screenshots with optional scripted portal shots. Usage:
//   node tools/pshot.mjs map out-prefix '[{"pos":[x,y,z],"ang":[p,y,0],"shoot":[[which,[ex,ey,ez],[fx,fy,fz]],...],"open":[["portal_a","portal_b"]]}]' [port]
// Player is put in noclip and the intro fade is skipped, so the pose holds still.
import { chromium } from 'playwright-core';
const [map = 'testchmb_a_00', prefix = '/tmp/p', viewsJ = '[]', base = 'http://127.0.0.1:8420/'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: +(process.env.W || 1024), height: +(process.env.H || 526) } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(base + '?map=' + map + '&nochange=1' + (process.env.Q ? '&' + process.env.Q : ''));
await p.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
const le = await p.evaluate(() => window.loadError); if (le) { console.log('LOADERROR', le); process.exit(1); }
const views = JSON.parse(viewsJ);
for (let i = 0; i < views.length; i++) {
  const v = views[i];
  const r = await p.evaluate(v => { const g = window.game, h = g.game.hud; g.pl.noclip = true;
    const pose = () => { for (const [a, b2] of v.open || []) { const A = g.r.portals.find(q => q.name === a), B = g.r.portals.find(q => q.name === b2); A.open = B.open = true; A.linked = B; B.linked = A; } h.fade = 0; h.fadeTarget = 0; h.fadeHoldUntil = 0; g.pl.pos = [...v.pos]; g.pl.ang = [...v.ang]; g.pl.vel = [0, 0, 0]; };
    const jr = v.js ? (0, eval)(v.js) : undefined;
    pose(); for (const [w, e, f] of v.shoot || []) g.game.shootPortal(w, { eye: e, f });
    window.__pose = pose; return JSON.stringify(g.game.gunPortals?.map(q => q && q.open ? q.pos.map(x => x | 0) : null)) + (jr !== undefined ? ' js: ' + jr : ''); }, v);
  for (let k = 0; k < 6; k++) { await p.waitForTimeout(250); await p.evaluate(() => window.__pose()); }
  const st = await p.evaluate(() => JSON.stringify({ fps: +window.game.stats.fps.toFixed(1), draws: window.game.r.stats.draws, views: window.game.r.stats.views }));
  if (v.post) console.log('post:', await p.evaluate(v.post));
  await p.screenshot({ path: prefix + i + '.png' }); console.log(prefix + i + '.png', 'portals', r, st);
}
await b.close();
