import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

test.describe('probability lab', () => {
  test('Galton board and dice converge to their distributions', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/probability');
    await expect.poll(async () => (await state(page)).galton.total).toBeGreaterThan(3);
    await page.locator('#galton-1000').click();
    const g = (await state(page)).galton;
    expect(g.total).toBeGreaterThan(1000);
    expect(Math.abs(g.mean - 6)).toBeLessThan(0.3);
    expect((await canvasStats(page, '#stage > canvas')).distinct).toBeGreaterThan(10);
    await page.locator('#prob-tab button[data-value="dice"]').click();
    await page.locator('#dice-k').fill('3');
    await page.locator('#dice-many').click();
    const d = (await state(page)).dice;
    expect(d.k).toBe(3);
    expect(Math.abs(d.mean - 10.5)).toBeLessThan(0.15);
    await expect(page).toHaveURL(/e=dice/);
    check();
  });

  test('Buffon estimates π; random walks spread like √n', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/probability?e=buffon');
    await page.locator('#buffon-many').click();
    const b = (await state(page)).buffon;
    expect(b.N).toBeGreaterThanOrEqual(100000);
    expect(Math.abs(b.pi - Math.PI)).toBeLessThan(0.06);
    await expect(page.locator('#buffon-readout')).toContainText('3.1');
    await page.locator('#prob-tab button[data-value="walk"]').click();
    await page.locator('#walk-m').fill('400');
    await page.locator('#walk-end').click();
    const w = (await state(page)).walk;
    expect(w.n).toBe(w.N);
    expect(Math.abs(w.meanSq / w.N - 1)).toBeLessThan(0.25); // E[S_n²] = n
    check();
  });
});
