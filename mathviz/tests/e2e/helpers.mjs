import { expect } from '@playwright/test';

/** Collect console errors and uncaught exceptions; call the returned check() at the end. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack || ''}`));
  return () => expect(errors, errors.join('\n\n')).toEqual([]);
}

export async function open(page, hash) {
  await page.goto(`/${hash}`);
  await page.waitForFunction(() => window.__mathscape?.current != null);
  // let ResizeObserver + first animation frames settle
  await page.waitForTimeout(300);
}

export const state = (page) => page.evaluate(() => window.__mathscape.current.state());

/** Statistics of the pixels of a canvas: how many distinct colours, mean brightness. */
export function canvasStats(page, selector) {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel);
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
  }, selector);
}

/** RGBA of one pixel (CSS pixel coordinates) of a canvas. */
export function pixel(page, selector, x, y) {
  return page.evaluate(({ sel, px, py }) => {
    const c = document.querySelector(sel);
    const r = c.width / c.getBoundingClientRect().width;
    return Array.from(c.getContext('2d').getImageData(Math.round(px * r), Math.round(py * r), 1, 1).data);
  }, { sel: selector, px: x, py: y });
}

/** Drag with the mouse in several steps (pointer events). */
export async function drag(page, [x0, y0], [x1, y1], steps = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) await page.mouse.move(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps);
  await page.mouse.up();
}

export const near = (a, b, tol) => Math.abs(a - b) <= tol;
