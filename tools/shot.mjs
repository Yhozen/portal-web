// Headless Chromium (SwiftShader WebGL2) screenshot + FPS probe. Usage: node tools/shot.mjs out.png "query" [waitMs] [script]
import { chromium } from 'playwright-core';
const [out = 'shots/s.png', query = '', wait = '4000', script = ''] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: +(process.env.W || 1024), height: +(process.env.H || 640) } })).newPage();
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || process.env.V) console.log('[' + m.type() + ']', m.text().slice(0, 300)); });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
const t0 = Date.now();
await p.goto('http://127.0.0.1:8420/?' + query);
await p.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
const err = await p.evaluate(() => window.loadError); if (err) console.log('LOADERROR', err);
console.log('ready in', Date.now() - t0, 'ms', await p.evaluate(() => JSON.stringify({ load: window.game?.stats?.loadMs | 0, req: window.game?.assets?.requests, mb: ((window.game?.assets?.bytes || 0) / 1e6).toFixed(1) })));
if (script) console.log('script:', await p.evaluate(script));
await p.waitForTimeout(+wait);
console.log('stats', await p.evaluate(() => JSON.stringify({ fps: window.game?.stats?.fps?.toFixed(1), draws: window.game?.stats?.draws, views: window.game?.r?.stats?.views, extra: window.game?.extraStats })));
await p.screenshot({ path: out }); console.log('shot', out);
await b.close();
