import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

const hoverCell = async (page, x, y) => {
  const p = await page.evaluate(([a, b]) => window.__mathscape.current.cellToClient(a, b), [x, y]);
  await page.mouse.move(p[0] + 5, p[1] + 5);
  await page.mouse.move(...p);
};

test.describe('Primes', () => {
  test('Ulam spiral and Gaussian primes explain the cell under the mouse', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/primes');
    expect((await canvasStats(page, '#stage > canvas')).distinct).toBeGreaterThan(1);
    await hoverCell(page, 1, 0);
    await expect.poll(async () => (await state(page)).hover?.n).toBe(2);
    await expect(page.locator('#primes-info')).toContainText('素数');
    await page.locator('#primes-start .chip[data-id="41"]').click();
    await hoverCell(page, 1, 1);
    await expect.poll(async () => (await state(page)).hover?.n).toBe(43);
    await hoverCell(page, 1, 0);
    await expect(page.locator('#primes-info')).toContainText('2 · 3 · 7');
    await page.locator('#primes-spiral button[data-value="sacks"]').click();
    expect((await state(page)).spiral).toBe('sacks');
    await page.locator('#primes-tab button[data-value="gauss"]').click();
    await expect(page).toHaveURL(/v=gauss/);
    await hoverCell(page, 2, 1);
    await expect(page.locator('#primes-info')).toContainText('范数 2² + 1² = 5 是素数');
    await hoverCell(page, 5, 0);
    await expect(page.locator('#primes-info')).toContainText('合数');
    await hoverCell(page, 0, 7);
    await expect(page.locator('#primes-info')).toContainText('≡ 3 (mod 4)');
    check();
  });

  test('counting primes and the zeros of ζ', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/primes?v=count');
    expect((await state(page)).table).toBe(25);
    const tableText = (await page.locator('#primes-table').textContent()).replace(/ /g, '');
    expect(tableText).toContain('176846309399143769411680');
    expect(tableText).toContain('Li +55160980939');
    await page.locator('#primes-x').fill('6');
    await expect(page.locator('#primes-count-readout dd[data-key="pi"]')).toHaveText('78 498');
    await page.locator('#primes-tab button[data-value="zeros"]').click();
    expect((await state(page)).zeros).toBe(300);
    await page.locator('#primes-n').fill('100');
    await expect(page.locator('#primes-zero-readout dd[data-key="g"]')).toHaveText(/^236\.52422966/);
    await page.locator('#primes-play').click();
    await expect.poll(async () => (await state(page)).N, { timeout: 15000 }).toBeGreaterThan(150);
    check();
  });
});
