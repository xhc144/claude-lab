#!/usr/bin/env node
// Dev tool: open the game in headless Chromium and save screenshots of scripted viewpoints.
//   node scripts/shot.mjs out-dir [seed] [--url http://127.0.0.1:5199/] [--views views.json]
// Each view: { name, x, y, z, yaw, pitch, time, wait, eval }  (degrees for yaw/pitch)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const out = args[0] || 'shots';
const seed = args[1] && !args[1].startsWith('--') ? args[1] : '20261012';
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const port = 5199;
let url = opt('url', null);
let server = null;
if (!url) {
  server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), '--port', String(port)], { stdio: 'ignore' });
  url = `http://127.0.0.1:${port}/`;
  await new Promise((r) => setTimeout(r, 600));
}
mkdirSync(out, { recursive: true });
const views = opt('views', null) ? JSON.parse(readFileSync(opt('views'), 'utf8')) : [
  { name: 'spawn', yaw: 30, pitch: -8 },
];
const w = Number(opt('w', 1280)), h = Number(opt('h', 720));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const rd = opt('rd', '6');
await page.goto(`${url}?autoplay&seed=${seed}&rd=${rd}${opt('q', '')}`);
await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 120000 });
for (const v of views) {
  await page.evaluate((v) => {
    const g = window.__game, p = g.player;
    if (v.x !== undefined) { p.x = v.x; p.z = v.z; }
    if (v.y !== undefined) p.y = v.y;
    if (v.yaw !== undefined) p.yaw = v.yaw * Math.PI / 180;
    if (v.pitch !== undefined) p.pitch = v.pitch * Math.PI / 180;
    if (v.time !== undefined) g.dayTime = v.time;
    if (v.fly) { p.flying = true; p.creative = true; }
    if (v.eval) (0, eval)(v.eval);
  }, v);
  // wait for chunks around the viewpoint to load and mesh
  await page.waitForFunction(() => {
    const g = window.__game;
    return g.chunks.genInFlight === 0 && g.chunks.meshInFlight === 0 && [...g.world.chunks.values()].every((c) => !c.dirty.some((d, i) => d && c.nonEmpty[i]) || !g.chunks.neighboursReady(c) || Math.abs(c.cx - (Math.floor(g.player.x) >> 4)) > g.settings.renderDist || Math.abs(c.cz - (Math.floor(g.player.z) >> 4)) > g.settings.renderDist);
  }, null, { timeout: 120000, polling: 250 }).catch(() => logs.push('[shot] timeout waiting for meshes'));
  await page.waitForTimeout(v.wait || 400);
  if (v.after) await page.evaluate((s) => (0, eval)(s), v.after);
  await page.screenshot({ path: join(out, `${v.name}.png`) });
  const st = await page.evaluate(() => { const g = window.__game; return { fps: g.fps.toFixed(1), chunks: g.world.chunks.size, secs: g.renderer.stats.sections, tris: g.renderer.stats.tris, x: g.player.x.toFixed(1), y: g.player.y.toFixed(1), z: g.player.z.toFixed(1) }; });
  console.log(v.name, JSON.stringify(st));
}
if (logs.length) console.log(logs.slice(0, 40).join('\n'));
await browser.close();
if (server) server.kill();
