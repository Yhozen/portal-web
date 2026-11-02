// Multi-view screenshots for map inspection. Usage: node tools/views.mjs map prefix '[[from,at],...]' [prescript]
import { chromium } from 'playwright-core';
import fs from 'fs';
const [map, prefix, viewsJ, pre = ''] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 500 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8420/?map=' + map + '&nochange=1');
await p.waitForFunction(() => window.ready || window.loadError, null, { timeout: 120000 });
await p.evaluate(fs.readFileSync('/tmp/look.js', 'utf8'));
if (pre) console.log('pre:', await p.evaluate(pre));
const views = JSON.parse(viewsJ);
for (let i = 0; i < views.length; i++) { await p.evaluate(([f, a]) => { NOFADE(); LOOK(f, a); }, views[i]); await p.waitForTimeout(700); await p.evaluate(([f, a]) => { NOFADE(); LOOK(f, a); }, views[i]); await p.waitForTimeout(300); await p.screenshot({ path: prefix + i + '.png' }); }
await b.close();
