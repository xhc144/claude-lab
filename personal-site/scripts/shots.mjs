// Screenshot tour of the built site (headless Chromium with software WebGL).
//   node scripts/shots.mjs [--mobile] [--only name1,name2]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const mobile = process.argv.includes('--mobile');
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : null;
const out = resolve('shots', mobile ? 'mobile' : 'desktop');
mkdirSync(out, { recursive: true });

const STOPS = [
  ['01-hero', '#hero', 0],
  ['02-dim0-opener', '#dim0 .opener', 0.55],
  ['03-dim0-body', '#dim0 .chapter-body', 0.05],
  ['04-dim0-orbit', '.orbit-wrap', -0.3],
  ['05-dim1-opener', '#dim1 .opener', 0.6],
  ['06-dim1-track-a', '#track', 0.25],
  ['07-dim1-track-b', '#track', 0.7],
  ['08-dim2-opener', '#dim2 .opener', 0.6],
  ['09-dim2-domain', '.ins-domain', -0.08],
  ['10-dim2-grid', '.ins-grid', 0.0],
  ['11-dim2-grid-b', '.ins-grid', 0.5],
  ['12-dim3-opener', '#dim3 .opener', 0.6],
  ['13-dim3-step1', '#knot-stage', 0.05],
  ['14-dim3-step2', '#knot-stage', 0.3],
  ['15-dim3-step3', '#knot-stage', 0.55],
  ['16-dim3-step4', '#knot-stage', 0.8],
  ['17-dim4-opener', '#dim4 .opener', 0.6],
  ['18-dim4-pendulum', '[data-instrument="pendulum"]', -0.15],
  ['19-dim4-field', '[data-instrument="field"]', -0.15],
  ['20-dim4-quantum', '[data-instrument="quantum"]', -0.15],
  ['21-dimn-opener', '#dimn .opener', 0.6],
  ['22-dimn-mlp', '[data-instrument="mlp"]', -0.15],
  ['23-dimn-attention', '[data-instrument="attention"]', -0.15],
  ['24-dimn-agent', '[data-instrument="agent"]', -0.15],
  ['25-dimn-papers', '.papers', 0.0],
  ['26-archive-opener', '#archive .opener', 0.6],
  ['27-archive-repos', '#repo-grid', -0.05],
  ['28-archive-bars', '#ocw-bars', -0.1],
  ['29-archive-own', '#own-grid', -0.1],
  ['30-archive-spectrum', '#spectrum', -0.1],
  ['31-inf-opener', '#diminf .opener', 0.6],
  ['32-inf-mission', '.mission', -0.1],
  ['33-inf-finale', '.finale', -0.2],
  ['34-credits', '#credits', 0.2],
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const url = pathToFileURL(resolve('dist/index.html')).href + '?skip';
await page.goto(url);
await page.waitForTimeout(2500);
for (const [name, sel, frac] of STOPS) {
  if (only && !only.some((o) => name.includes(o))) continue;
  await page.evaluate(([sel, frac]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const y = frac >= 0 ? top + frac * Math.max(0, r.height - (frac > 0 ? innerHeight : 0)) : top + frac * innerHeight;
    window.scrollTo(0, Math.max(0, y));
  }, [sel, frac]);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__universe && window.__universe.settle());
  await page.waitForTimeout(name.includes('opener') || name.includes('step') || name.includes('hero') ? 2600 : 1800);
  await page.screenshot({ path: `${out}/${name}.png` });
  process.stdout.write(name + ' ');
}
console.log('\nerrors:', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none');
await browser.close();
