import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL('/home/user/claude-lab/personal-site/dist/index.html').href + '?skip');
await page.waitForTimeout(2000);
await page.evaluate(() => { const el = document.querySelector('#dim0 .opener'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 0.55 * (el.offsetHeight - innerHeight)); });
for (let k = 0; k < 6; k++) {
  await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { const u = window.__universe; return JSON.stringify({ shape: u.shape, morphT: u.morphT.toFixed(2), uMorph: u.uniforms.uMorph.value.toFixed(2), toProc: u.uniforms.uToProc.value, chapter: document.body.className, to0: Array.from(u.attr.aTo.array.slice(0, 6)).map((v) => v.toFixed(2)), fps: document.getElementById('fps').textContent }); }));
}
await browser.close();
