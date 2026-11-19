// Pose tour: for each map, stand at up to N points of interest and look toward the centroid of the rest.
import { chromium } from 'playwright-core';
const [mapsArg, prefix = '/workspace/portal-web-shots/tour-', N = '3', base = 'http://127.0.0.1:8420/'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const map of mapsArg.split(',')) {
  const p = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
  const warns = new Set(); p.on('console', m => { if (m.type() === 'warning') warns.add(m.text().slice(0, 120)); });
  p.on('pageerror', e => console.log(map, 'PAGEERROR', e.message));
  await p.goto(base + '?map=' + map + '&nochange=1' + (process.env.Q ? '&' + process.env.Q : ''));
  await p.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
  const pois = await p.evaluate(n => {
    const E = window.game.bsp.entities; const want = /^(prop_floor_button|weapon_portalgun|prop_portal|npc_portal_turret_floor|point_energy_ball_launcher|prop_energy_ball_catcher|prop_weighted_cube|trigger_portal_cleanser|func_door)$/;
    const pts = E.filter(e => want.test(e.classname) && e.origin).map(e => ({ c: e.classname, o: e.origin.split(/\s+/).map(Number) }));
    const cen = [0, 1, 2].map(k => pts.reduce((a, q) => a + q.o[k], 0) / Math.max(1, pts.length));
    const pick = []; const step = Math.max(1, Math.floor(pts.length / n)); for (let i = 0; i < pts.length && pick.length < n; i += step) pick.push(pts[i]);
    const B = window.game.bsp; const ok = x => { const l = B.leafs[B.pointLeaf(x)]; return l && l.contents === 0 && l.cluster >= 0; };
    const out = [];
    for (const q of pick) {
      let best = null;
      for (const r of [160, 224, 128, 288, 96]) { for (let a = 0; a < 16 && !best; a++) { const t = Math.atan2(cen[1] - q.o[1], cen[0] - q.o[0]) + Math.PI + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * Math.PI / 8;
        const e = [q.o[0] + Math.cos(t) * r, q.o[1] + Math.sin(t) * r, q.o[2] + 56];
        // eye and the midpoint toward the target must both be in open, visible space
        if (ok(e) && ok([(e[0] + q.o[0]) / 2, (e[1] + q.o[1]) / 2, (e[2] + q.o[2]) / 2]) && ok([e[0], e[1], e[2] - 48])) best = e; } if (best) break; }
      if (!best) continue;
      const d = [q.o[0] - best[0], q.o[1] - best[1], q.o[2] - best[2]]; const yaw = Math.atan2(d[1], d[0]) * 180 / Math.PI; const pitch = -Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI;
      out.push({ c: q.c, pos: [best[0], best[1], best[2] - 64], ang: [pitch, yaw, 0] });
    }
    return out;
  }, +N);
  for (let i = 0; i < pois.length; i++) {
    const v = pois[i];
    const pose = v => { const g = window.game, h = g.game.hud; g.pl.noclip = true; h.fade = 0; h.fadeTarget = 0; h.fadeHoldUntil = 0; g.pl.pos = [...v.pos]; g.pl.ang = [...v.ang]; g.pl.vel = [0, 0, 0]; };
    for (let k = 0; k < 8; k++) { await p.evaluate(pose, v); await p.waitForTimeout(250); }
    const fs = []; for (let k = 0; k < 6; k++) { await p.waitForTimeout(500); fs.push(await p.evaluate(v => { const g = window.game; g.pl.pos = [...v.pos]; g.pl.ang = [...v.ang]; return g.stats.fps; }, v)); }
    fs.sort((a, c) => a - c);
    const out = `${prefix}${map}-${i}.png`; await p.screenshot({ path: out });
    console.log(out, v.c, 'pos', v.pos.map(x => x | 0).join(','), 'yaw', v.ang[1] | 0, 'fps', fs[3].toFixed(1), 'draws', await p.evaluate(() => window.game.r.stats.draws));
  }
  if (warns.size) console.log(map, 'warnings:', [...warns].slice(0, 8).join(' | '));
  await p.close();
}
await b.close();
