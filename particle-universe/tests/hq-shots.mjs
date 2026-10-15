// High-fidelity stills: many particles, real resolution, settled simulation.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
const scenes = (process.argv[2] || 'nebula').split(',');
const steps = Number(process.argv[3] || 150);
const tier = Number(process.argv[4] || 3);
const W = Number(process.argv[5] || 1280), H = Number(process.argv[6] || 720);
const tag = process.argv[7] || '';
const server = await createServer({ configFile: 'vite.config.mjs', server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 500)); });
for (const s of scenes) {
  const t0 = Date.now();
  await page.goto(`http://localhost:5199/dev/engine-test.html?scene=${s}&tier=${tier}&w=${W}&h=${H}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__error);
  if (err) { console.log('ERROR', s, err); continue; }
  let t = 0;
  for (let i = 0; i < steps; i += 10) t = await page.evaluate(([n, t]) => window.__step(n, t), [Math.min(10, steps - i), t]);
  const url = await page.evaluate((t) => window.__shot(t), t);
  fs.writeFileSync(`test-output/hq/${s}${tag}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('ok', s, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
await server.close();
