// Manual play in the real app: drag cards with the mouse, open an event dialog, mobile layout.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, 'shots');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = srv.address().port;
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
pg.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); });
pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await pg.goto(`http://localhost:${port}/index.html`);
await pg.waitForTimeout(1500);
await pg.getByText('开始战役').click();
await pg.locator('button.lvl').first().click();
await pg.waitForTimeout(500);
await pg.getByText('亲自开始').click();
await pg.waitForTimeout(1500);
// find a survivor and a tree on screen through the app object, then drag with the real mouse
const pos = await pg.evaluate(() => {
  const app = window.__emberstack, g = app.g, v = app.view;
  const find = (d) => Object.values(g.s.cards).find((c) => c.d === d);
  const s = find('survivor'), t = find('tree');
  const sv = v.views.get(s.id), tv = v.views.get(t.id);
  const a = v.worldToScreen(sv.x + 55, sv.y + 60), b = v.worldToScreen(tv.x + 55, tv.y + 60);
  return { a, b };
});
await pg.mouse.move(pos.a.x, pos.a.y);
await pg.mouse.down();
for (let i = 1; i <= 12; i++) await pg.mouse.move(pos.a.x + ((pos.b.x - pos.a.x) * i) / 12, pos.a.y + ((pos.b.y - pos.a.y) * i) / 12);
await pg.waitForTimeout(200);
await pg.screenshot({ path: path.join(out, 'ui-drag.png') });
await pg.mouse.up();
await pg.waitForTimeout(2500);
const state = await pg.evaluate(() => {
  const g = window.__emberstack.g;
  return Object.values(g.s.stacks).filter((s) => s.task).map((s) => s.task.r);
});
console.log('tasks after drag:', state);
await pg.screenshot({ path: path.join(out, 'ui-play.png') });
// fire an event card and open its dialog
await pg.evaluate(() => {
  const app = window.__emberstack;
  const { g } = app;
  import('./src/sim/eventsim.js').then((m) => { m.fireEvent(g, 'wanderer'); });
});
await pg.waitForTimeout(800);
await pg.evaluate(() => { const app = window.__emberstack; const c = Object.values(app.g.s.cards).find((x) => x.ev); if (c) app.hud.openEvent(c); });
await pg.waitForTimeout(500);
await pg.screenshot({ path: path.join(out, 'ui-event.png') });
// force a win to see the results screen
await pg.evaluate(() => { const app = window.__emberstack; app.hud.closeDialog(); app.g.finish('win', 'test'); });
await pg.waitForTimeout(2600);
await pg.screenshot({ path: path.join(out, 'ui-results.png') });
// mobile
const mp = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mp.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
await mp.goto(`http://localhost:${port}/index.html`);
await mp.waitForTimeout(1500);
await mp.screenshot({ path: path.join(out, 'ui-m-title.png') });
await mp.getByText('观看 AI 从零建设文明').click();
await mp.waitForTimeout(6000);
await mp.screenshot({ path: path.join(out, 'ui-m-game.png') });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await b.close(); srv.close();
