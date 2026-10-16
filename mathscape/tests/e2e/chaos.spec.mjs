import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

test.describe('chaos and bifurcation', () => {
  test('diagram renders; clicking sets r; presets give the expected behaviour', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/chaos');
    await page.waitForFunction(() => window.__mathscape.current.state().done);
    expect((await canvasStats(page, '#stage > canvas')).distinct).toBeGreaterThan(40);
    const [x, y] = await page.evaluate(() => window.__mathscape.current.rToClient(3.2));
    await page.mouse.click(x, y);
    let s = await state(page);
    expect(Math.abs(s.r - 3.2)).toBeLessThan(0.01);
    expect(s.period).toBe(2);
    await page.locator('#chaos-r-presets .chip[data-id="p3"]').click();
    expect((await state(page)).period).toBe(3);
    await expect(page.locator('#chaos-readout')).toContainText('周期 3');
    await page.locator('#chaos-r-presets .chip[data-id="full"]').click();
    s = await state(page);
    expect(s.period).toBe(0);
    expect(Math.abs(s.lambda - Math.LN2)).toBeLessThan(0.02);
    await page.locator('#chaos-r').fill('1 + sqrt(5)');
    expect((await state(page)).r).toBeCloseTo(1 + Math.sqrt(5), 12);
    check();
  });

  test('box zoom and back; the Feigenbaum table converges to δ', async ({ page }) => {
    await open(page, '#/chaos');
    const box = await page.locator('#stage > canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + 320, { steps: 8 });
    await page.mouse.up();
    const v = (await state(page)).view;
    expect(v.r1 - v.r0).toBeLessThan(1);
    await expect(page).toHaveURL(/v=/);
    await page.keyboard.press('Backspace');
    expect((await state(page)).view).toEqual({ r0: 2.5, r1: 4, y0: 0, y1: 1 });
    await page.waitForFunction(() => window.__mathscape.current.state().feigen);
    const d = (await state(page)).feigen;
    expect(Math.abs(d.at(-1) - 4.6692016)).toBeLessThan(1e-5);
    await expect(page.locator('#feigen')).toContainText('4.669201609102990');
  });

  test('high precision computes the cascade in double-double to n = 16', async ({ page }) => {
    await open(page, '#/chaos?hp=50');
    await page.waitForFunction(() => window.__mathscape.current.state().feigen, null, { timeout: 20000 });
    const d = (await state(page)).feigen;
    expect(d.length).toBe(17);
    expect(Math.abs(d[16] - 4.669201609102990)).toBeLessThan(1e-9);
    await expect(page.locator('#feigen')).toContainText('双倍双精度');
  });
});
