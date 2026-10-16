import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

test.describe('Game of Life', () => {
  test('the gun runs; drawing and stepping follow the rules', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/life');
    await expect.poll(async () => (await state(page)).gen).toBeGreaterThan(10);
    expect((await canvasStats(page, '#stage > canvas')).distinct).toBeGreaterThan(5);
    // pause, clear, draw a blinker by dragging across three cells
    await page.evaluate(() => window.__mathscape.current.setPlaying(false));
    await page.locator('#life-clear').click();
    const a = await page.evaluate(() => window.__mathscape.current.cellToClient(100, 70));
    const b = await page.evaluate(() => window.__mathscape.current.cellToClient(102, 70));
    await page.mouse.move(...a);
    await page.mouse.down();
    await page.mouse.move(...b, { steps: 6 });
    await page.mouse.up();
    expect((await state(page)).pop).toBe(3);
    await page.locator('#life-step').click();
    const cells = await page.evaluate(() => [[101, 69], [101, 70], [101, 71]].map(([x, y]) => window.__mathscape.current.cell(x, y)));
    expect(cells).toEqual([1, 1, 1]);
    await page.locator('#life-step').click();
    await expect(page.locator('#life-readout')).toContainText('周期 2');
    check();
  });

  test('patterns, rules and the one-dimensional mode', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/life');
    await page.locator('#life-rules .chip[data-id="high"]').click();
    expect((await state(page)).rule).toBe('B36/S23');
    await expect(page).toHaveURL(/rule=B36/);
    await page.locator('#life-rule').fill('B2/S');
    expect((await state(page)).rule).toBe('B2/S');
    await page.locator('#life-mode button[data-value="1d"]').click();
    await page.locator('#life-rules1d .chip[data-id="90"]').click();
    expect((await state(page)).rule1d).toBe(90);
    // flipping one bit of the rule table changes the rule number
    await page.locator('#life-bits .rule-bit').first().click(); // neighbourhood 111
    expect((await state(page)).rule1d).toBe(90 ^ 128);
    await expect(page).toHaveURL(/mode=1d/);
    await expect.poll(async () => (await state(page)).rows1d).toBeGreaterThan(50);
    check();
  });
});
