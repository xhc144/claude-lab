// Renders every scene in headless Chromium (software WebGL) and saves screenshots.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
const scenes = (process.argv[2] || 'nebula,blackhole,galaxy,storm,silk,resonance,warp,attractor').split(',');
const steps = Number(process.argv[3] || 240);
const tier = Number(process.argv[4] || 1);
const out = 'test-output/engine';
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'vite.config.mjs', server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 2000)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const s of scenes) {
  await page.goto(`http://localhost:5199/dev/engine-test.html?scene=${s}&tier=${tier}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__error);
  if (err) { console.log('ERROR', s, err); continue; }
  const t0 = Date.now();
  let t = 0;
  for (let i = 0; i < steps; i += 10) { t = await page.evaluate(([n, t]) => window.__step(n, t), [Math.min(10, steps - i), t]); }
  const url = await page.evaluate((t) => window.__shot(t), t);
  fs.writeFileSync(`${out}/${s}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('ok', s, ((Date.now() - t0) / steps).toFixed(1), 'ms/frame');
}
await browser.close();
await server.close();
