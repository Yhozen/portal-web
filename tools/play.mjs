// Real-input smoke test: drives the page with keyboard/mouse events through Playwright (no scripted state edits).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 600 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8420/?map=testchmb_a_00');
await p.waitForFunction(() => window.ready || window.loadError);
await p.mouse.click(480, 300); // request pointer lock (may be refused headless)
const lock = await p.evaluate(() => !!document.pointerLockElement);
const pos = () => p.evaluate(() => window.game.pl.pos.map(v => Math.round(v)).join(','));
console.log('pointerlock', lock, 'start', await pos());
await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW'); console.log('after W 1.5s', await pos());
await p.keyboard.down('Space'); await p.waitForTimeout(100); await p.keyboard.up('Space');
await p.waitForTimeout(150); console.log('jump z', await p.evaluate(() => window.game.pl.pos[2].toFixed(1) + ' vz ' + window.game.pl.vel[2].toFixed(0)));
await p.keyboard.down('KeyA'); await p.waitForTimeout(800); await p.keyboard.up('KeyA'); console.log('after A', await pos());
await p.waitForTimeout(1500);
console.log('fps', await p.evaluate(() => window.game.stats.fps.toFixed(1)));
await p.screenshot({ path: 'shots/11-play.png' });
await b.close();
