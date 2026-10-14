// usage: node tests/harness/shoot.mjs <page.html?query> <out.png> [w h]
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = srv.address().port;
const [, , page, out, w = 1600, h = 1000] = process.argv;
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: +w, height: +h } });
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
pg.on('pageerror', (e) => console.log('pageerror:', e.message));
await pg.goto(`http://localhost:${port}/${page}`);
await pg.waitForFunction(() => window.__done, null, { timeout: 30000 }).catch(() => console.log('timeout'));
const errs = await pg.evaluate(() => window.__errs || []);
if (errs.length) console.log('errors:', errs.join('\n'));
await pg.screenshot({ path: out, fullPage: true });
await b.close(); srv.close();
