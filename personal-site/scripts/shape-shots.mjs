// Dev helper: screenshot each universe shape (headless Chromium, software WebGL).
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const out = resolve('shots'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => console.log('[console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const shapes = process.argv.slice(2).length ? process.argv.slice(2) : ['galaxy', 'singularity', 'filament', 'landscape', 'fiber', 'lorenz', 'latent', 'archive', 'hopf'];
for (const s of shapes) {
  const [name, extra] = s.split('+');
  const url = pathToFileURL(resolve('dist/index.html')).href + `?shape=${name}${extra ? '&' + extra + '=1' : ''}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__frames > 25, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/shape-${s}.png` });
  console.log('shot', s, await page.evaluate(() => window.__frames));
}
await browser.close();
