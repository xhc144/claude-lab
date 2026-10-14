#!/usr/bin/env node
// Dev snapshot tool: render frames of a document JSON in headless Chromium.
//   node tests/render/snap.mjs doc.json [--times 0.5,2,4] [--sheet] [--scale 0.5] [--out out/snap]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from '../../scripts/lib/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const docFile = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const out = path.resolve(opt('out', path.join(root, 'out/snap')));
const scale = Number(opt('scale', '0.5'));
fs.mkdirSync(out, { recursive: true });

export function chromiumPath() {
  const cands = [process.env.MOTIF_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].filter(Boolean);
  return cands.find((p) => fs.existsSync(p));
}

const doc = JSON.parse(fs.readFileSync(docFile, 'utf8'));
if (opt('theme')) doc.theme = opt('theme');
if (opt('aspect')) doc.format = opt('aspect');
const tag = opt('tag', '');
const srv = await serve({ '/': path.join(root, 'dist'), '/project/': path.dirname(path.resolve(docFile)) });
const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${srv.port}/render.html`);
const info = await page.evaluate(async ([d, s]) => MotifHost.load(d, { scale: s, assetBase: '/project/' }), [doc, scale]);
console.log(`duration ${info.duration.toFixed(2)}s, ${info.scenes.length} scenes`);
info.scenes.forEach((s, i) => console.log(`  ${i + 1}. ${s.id} ${s.layout}/${s.tone} start ${s.start.toFixed(2)} dur ${s.duration.toFixed(2)} ${s.transition ? s.transition.type : ''}`));
for (const iss of info.issues) console.log('  issue:', iss.level, iss.message, iss.block || '');
let times = [];
const tArg = opt('times');
if (tArg) times = tArg.split(',').map(Number);
if (args.includes('--sheet') || !times.length) times.push(...info.scenes.map((s) => s.settled));
const name = path.basename(docFile, '.json') + (tag ? '-' + tag : '');
let k = 0;
for (const t of times) {
  const data = await page.evaluate((tt) => MotifHost.png(tt), t);
  const f = path.join(out, `${name}-${String(k++).padStart(2, '0')}-${t.toFixed(2)}.png`);
  fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', path.relative(root, f));
}
await browser.close();
await srv.close();
