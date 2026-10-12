import { expect } from '@playwright/test';

/** App entry under test: '/' = source version, '/dist/myriad.html' = single-file build. */
export const APP = process.env.MYRIAD_APP || '/';

/** Collect console errors and uncaught exceptions; call the returned check() at the end. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack || ''}`));
  return () => expect(errors, errors.join('\n\n')).toEqual([]);
}

/** open a world directly (skipping the title screen) */
export async function openWorld(page, params = {}) {
  const q = new URLSearchParams({ autostart: '1', seed: '7', start: 'tribes', size: 'small', speed: '0', ...params });
  await page.goto(`${APP}?${q}`);
  await page.waitForFunction(() => window.__myriad && window.__myriad.game.world && !window.__myriad.game.world.demo);
  await page.waitForTimeout(300);
}

/** advance the simulation n ticks synchronously inside the page */
export function simulate(page, ticks) {
  return page.evaluate((n) => {
    const g = window.__myriad.game;
    for (let i = 0; i < n; i++) g.stepOnce();
    g.R.terrain.markAll();
  }, ticks);
}

/** pixel statistics of the main canvas */
export function canvasStats(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#stage');
    const ctx = c.getContext('2d');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const colors = new Set();
    let sum = 0, n = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
      colors.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
      sum += data[i] + data[i + 1] + data[i + 2];
      n++;
    }
    return { distinct: colors.size, mean: sum / (3 * n), w: c.width, h: c.height };
  });
}

/** screen position of a world point */
export function toScreen(page, x, y) {
  return page.evaluate(([wx, wy]) => window.__myriad.game.R.cam.toScreen(wx, wy), [x, y]);
}

/** centre the camera on the living city closest to the middle of the map; returns its screen position */
export async function focusCity(page, zoom = 8) {
  const c = await page.evaluate((z) => {
    const g = window.__myriad.game, w = g.world;
    let best = null, bd = Infinity;
    for (const c of w.cities) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - w.W / 2, c.y - w.H / 2);
      if (d < bd) { bd = d; best = c; }
    }
    g.R.cam.anim = null; g.R.cam.follow = null;
    g.R.cam.x = best.x + 0.5; g.R.cam.y = best.y + 0.5; g.R.cam.zoom = z;
    return { id: best.id, x: best.x + 0.5, y: best.y + 0.5, name: best.name.z };
  }, zoom);
  await page.waitForTimeout(150);
  const [sx, sy] = await toScreen(page, c.x, c.y);
  return { ...c, sx, sy };
}
