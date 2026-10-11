import { test, expect } from '@playwright/test';
import { watchErrors, open, state, drag, near } from './helpers.mjs';

test.describe('matrix module', () => {
  test('typing entries updates determinant, eigenvalues and SVD', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/matrix');
    for (const [k, v] of [['a', '2'], ['b', '1'], ['c', '1'], ['d', '3']]) await page.locator(`#m-${k}`).fill(v);
    const props = page.locator('#matrix-props');
    await expect(props.locator('dd[data-key="det"]')).toHaveText('5');
    await expect(props.locator('dd[data-key="tr"]')).toHaveText('5');
    // (5 ± √5)/2
    await expect(props.locator('dd[data-key="eig"]')).toHaveText('λ₁ = 3.618, λ₂ = 1.382');
    // symmetric positive definite: singular values equal eigenvalues
    await expect(props.locator('dd[data-key="sv"]')).toHaveText('3.618, 1.382');
    await expect(props.locator('dd[data-key="char"]')).toHaveText('λ² − 5λ + 5');
    await expect(page.locator('#matrix-tags')).toContainText('对称矩阵');
    check();
  });

  test('entries accept expressions and reject garbage', async ({ page }) => {
    await open(page, '#/matrix');
    await page.locator('#m-a').fill('cos(pi/3)');
    await page.locator('#m-b').fill('-sin(pi/3)');
    await page.locator('#m-c').fill('sin(pi/3)');
    await page.locator('#m-d').fill('cos(pi/3)');
    await expect(page.locator('#matrix-tags')).toContainText('旋转 60°');
    await page.locator('#m-a').fill('2 +');
    await expect(page.locator('#m-a')).toHaveClass(/invalid/);
    expect((await state(page)).A.a).toBeCloseTo(0.5, 12); // last valid value kept
  });

  test('dragging the î handle sets the first column', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/matrix?m=1,0,0,1');
    const from = await page.evaluate(() => window.__mathscape.current.worldToClient(1, 0));
    const to = await page.evaluate(() => window.__mathscape.current.worldToClient(2, 1));
    await drag(page, from, to);
    const s = await state(page);
    expect(near(s.A.a, 2, 0.03) && near(s.A.c, 1, 0.03)).toBe(true);
    expect(s.A.b).toBe(0);
    expect(s.A.d).toBe(1);
    await expect(page.locator('#m-a')).toHaveValue(/^2(\.0\d*|\.?\d{0,4})?$|^1\.9\d*$/);
    // A = [[2, 0], [1, 1]] → det = 2·1 − 0·1 = 2
    const det = Number((await page.locator('#matrix-props dd[data-key="det"]').textContent()).replace('−', '-'));
    expect(det).toBeCloseTo(2, 1);
    // the URL follows the edit
    await expect(page).toHaveURL(/m=/);
    check();
  });

  test('dragging the test vector keeps the matrix', async ({ page }) => {
    await open(page, '#/matrix?m=2,0,0,1');
    const s0 = await state(page);
    const from = await page.evaluate(([x, y]) => window.__mathscape.current.worldToClient(x, y), s0.v);
    const to = await page.evaluate(() => window.__mathscape.current.worldToClient(-1, 2));
    await drag(page, from, to);
    const s = await state(page);
    expect(near(s.v[0], -1, 0.03) && near(s.v[1], 2, 0.03)).toBe(true);
    expect(s.A).toEqual(s0.A);
  });

  test('presets, inverse, transpose and singular matrices', async ({ page }) => {
    await open(page, '#/matrix');
    await page.getByRole('button', { name: '旋转 30°' }).click();
    await expect(page.locator('#matrix-tags')).toContainText('旋转 30°');
    await page.getByRole('button', { name: '求逆' }).click();
    await expect(page.locator('#matrix-tags')).toContainText('旋转 -30°');
    await page.getByRole('button', { name: '奇异', exact: true }).click();
    await expect(page.locator('#matrix-props dd[data-key="rank"]')).toHaveText('1');
    await expect(page.locator('#matrix-props dd[data-key="inv"]')).toContainText('不存在');
    await page.getByRole('button', { name: '求逆' }).click();
    await expect(page.locator('.toast')).toContainText('不可逆');
    await page.getByRole('button', { name: '螺旋（复特征值）' }).click();
    await expect(page.locator('#matrix-props dd[data-key="eig"]')).toContainText('i');
    await page.getByRole('button', { name: '转置' }).click();
    const s = await state(page);
    expect(s.A.b).toBeCloseTo(0.45, 12);
  });

  test('transform animation runs from t = 0 to t = 1', async ({ page }) => {
    await open(page, '#/matrix');
    await page.locator('#play-transform').click();
    await page.waitForTimeout(250);
    const mid = (await state(page)).t;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    await expect.poll(async () => (await state(page)).t, { timeout: 5000 }).toBe(1);
    // scrubbing the slider
    await page.locator('#t-slider').fill('0.25');
    expect((await state(page)).t).toBeCloseTo(0.25, 6);
  });
});
