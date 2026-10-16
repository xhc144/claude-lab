import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

test.describe('Fourier epicycles', () => {
  test('presets draw; more circles carry more energy', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/fourier');
    await page.waitForTimeout(600);
    expect((await canvasStats(page, '#stage > canvas')).distinct).toBeGreaterThan(20);
    const s = await state(page);
    expect(s.shape).toBe('heart');
    expect(s.playing).toBe(true);
    await page.locator('#fourier-shapes .chip[data-id="square"]').click();
    await page.locator('#fourier-k').fill('2');
    const few = (await state(page)).energy;
    await page.locator('#fourier-k').fill('7');
    const many = await state(page);
    expect(many.K).toBe(128);
    expect(many.energy).toBeGreaterThan(few);
    expect(many.energy).toBeGreaterThan(0.99);
    await page.locator('#fourier-order button[data-value="freq"]').click();
    await expect(page).toHaveURL(/o=freq/);
    check();
  });

  test('a hand-drawn stroke becomes a series and survives in the URL', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/fourier');
    await page.locator('#fourier-draw-btn').click();
    expect((await state(page)).drawing).toBe(true);
    const c = await page.evaluate(() => window.__mathscape.current.worldToClient(0, 0));
    // a zig-zag "W"
    await page.mouse.move(c[0] - 150, c[1] - 100);
    await page.mouse.down();
    for (const [dx, dy] of [[-100, 100], [-50, -20], [0, 80], [50, -20], [100, 100], [150, -100]]) {
      await page.mouse.move(c[0] + dx, c[1] + dy, { steps: 12 });
    }
    await page.mouse.up();
    const s = await state(page);
    expect(s.drawing).toBe(false);
    expect(s.shape).toBe('draw');
    expect(s.custom).toBe(128);
    await expect(page).toHaveURL(/d=/);
    await page.reload();
    await page.waitForFunction(() => window.__mathscape?.current?.state);
    expect((await state(page)).shape).toBe('draw');
    check();
  });
});
