// Render the social preview image (src/public/og.jpg, 1200×630) from the live hero.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(resolve('dist/index.html')).href + '?skip&q=high');
await page.waitForTimeout(2500);
await page.addStyleTag({ content: '#hud .ladder, .hud-bl, .hud-br, .hud-actions, .marquee, .hero-cta, .hero-sub, .hero-meta, .hero-side, #cursor, #hotspots { display: none !important; } #hero { padding-bottom: 60px; }' });
await page.evaluate(() => window.__universe?.settle());
await page.waitForTimeout(3500);
await page.screenshot({ path: resolve('src/public/og.jpg'), type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote src/public/og.jpg');
