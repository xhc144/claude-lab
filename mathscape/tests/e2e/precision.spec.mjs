import { test, expect } from '@playwright/test';
import { watchErrors, open, state } from './helpers.mjs';

const GOLDEN = '1.61803 39887 49894 84820 45868 34365 63811 77203 09179 8058'.replace(/ /g, ' ');

test.describe('matrix module — high precision', () => {
  test('Fibonacci matrix: radical forms, 50 digits, exact powers', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/matrix?m=1,1,1,0&hp=50');
    const hp = page.locator('#hp-section');
    await expect(page.locator('#hp-status')).toHaveText('精确 · 50 位');
    await expect(hp).toContainText('λ² − λ − 1');
    await expect(hp).toContainText('λ = (1 ± √5)/2');
    await expect(hp).toContainText('v = (2, −1 ± √5)');
    await expect(hp).toContainText('κ = (3 + √5)/2');
    await expect(hp).toContainText(GOLDEN);
    // a well-conditioned matrix: double precision keeps about 16 digits
    await expect(page.locator('#hp-summary')).toHaveClass(/good/);
    // A¹⁰⁰ holds Fibonacci numbers F(101), F(100), F(99)
    await page.locator('#hp-pow-n').fill('100');
    await expect(page.locator('#hp-pow-out')).toContainText('354224848179261915075');
    await expect(page.locator('#hp-pow-out')).toContainText('573147844013817084101');
    // more digits on request
    await page.locator('#mx-prec-digits .chip[data-id="100"]').click();
    await expect(page.locator('#hp-status')).toHaveText('精确 · 100 位');
    const l1 = (await page.evaluate(() => window.__mathscape.current.hp())).values[0];
    expect(l1.replace('.', '')).toHaveLength(100);
    expect(l1.startsWith('1.6180339887498948482045868343656381177203091798057628621354486227')).toBe(true);
    check();
  });

  test('near-repeated eigenvalues: double precision gets the type wrong', async ({ page }) => {
    await open(page, '#/matrix?m=1,1,1e-20,1&hp=50');
    // double precision: 1 − 1e-20 rounds to 1 → "repeated eigenvalue"
    await expect(page.locator('#matrix-props dd[data-key="eig"]')).toContainText('二重');
    const hp = await page.evaluate(() => window.__mathscape.current.hp());
    expect(hp.eigKind).toBe('real');
    expect(hp.values).toEqual(['1.0000000001', '0.9999999999']);
    await expect(page.locator('#hp-summary')).toHaveClass(/bad/);
    await expect(page.locator('#hp-summary')).toContainText('二重根');
    await expect(page.locator('#matrix-presets .chip.on')).toContainText('近重根');
  });

  test('ill-conditioned preset: the double-precision determinant is off by 11 %', async ({ page }) => {
    await open(page, '#/matrix?hp=50');
    await page.locator('#matrix-presets .chip[data-id="illcond"]').click();
    await expect(page.locator('#hp-section')).toContainText('1×10⁻¹⁵');
    const det = (await page.evaluate(() => window.__mathscape.current.hp())).det;
    expect(det).toBe('1e-15');
    await expect(page.locator('#hp-summary')).toHaveClass(/bad/);
    // det row in the comparison table: well under 6 correct digits
    await expect(page.locator('#hp-cmp')).toContainText(/det A\s*1\.110223024625156\d*e−15/);
  });

  test('irrational entries give 50-digit approximations; 0.1 + 0.2 stays exact', async ({ page }) => {
    await open(page, '#/matrix?hp=50');
    await page.locator('#matrix-presets .chip[data-id="rot"]').click();
    await expect(page.locator('#hp-status')).toHaveText('50 位近似');
    await expect(page.locator('#hp-section')).toContainText('0.86602 54037 84438 64676 37231 70752 93618 34714 02626 90519'.replace(/ /g, ' '));
    await page.locator('#m-a').fill('0.1 + 0.2');
    await page.locator('#m-b').fill('0');
    await page.locator('#m-c').fill('0');
    await page.locator('#m-d').fill('1');
    await page.locator('#m-d').blur();
    await expect(page.locator('#hp-status')).toHaveText('精确 · 50 位');
    expect((await page.evaluate(() => window.__mathscape.current.hp())).det).toBe('0.3');
  });

  test('cells keep their source expression; exact inverse; URL round trip', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/matrix');
    await page.locator('#m-a').fill('sqrt(3)/2');
    await page.locator('#m-a').blur();
    await expect(page.locator('#m-a')).toHaveValue('0.866');
    await expect(page.locator('#m-a')).toHaveClass(/expr/);
    await page.locator('#m-a').focus();
    await expect(page.locator('#m-a')).toHaveValue('sqrt(3)/2');
    await page.locator('#m-a').blur();
    await expect(page).toHaveURL(/x=sqrt/);
    // reopening the link restores the expression
    const url = page.url();
    await page.goto('about:blank');
    await page.goto(url);
    await page.waitForFunction(() => window.__mathscape?.current?.state);
    expect((await state(page)).src.a).toBe('sqrt(3)/2');
    // rational entries are inverted exactly, even in double-precision mode
    await open(page, '#/matrix?m=2,1,1,3');
    await page.locator('#btn-inverse').click();
    expect(Object.values((await state(page)).src)).toEqual(['3/5', '-1/5', '-1/5', '2/5']);
    await expect(page).toHaveURL(/x=3%2F5|x=3\/5/);
    check();
  });

  test('animation modes: Aᵗ is a matrix power, SVD runs in three steps', async ({ page }) => {
    await open(page, '#/matrix?m=0.9,-0.45,0.45,0.9');
    await page.locator('#anim-mode button[data-value="exp"]').click();
    await page.locator('#t-slider').fill('0.5');
    const s = await state(page);
    expect(s.mode).toBe('exp');
    // (A^½)² = A
    const { M, A } = s;
    const sq = { a: M.a * M.a + M.b * M.c, b: M.a * M.b + M.b * M.d, c: M.c * M.a + M.d * M.c, d: M.c * M.b + M.d * M.d };
    for (const k of ['a', 'b', 'c', 'd']) expect(Math.abs(sq[k] - A[k])).toBeLessThan(1e-12);
    await expect(page).toHaveURL(/mode=exp/);
    await page.locator('#anim-mode button[data-value="svd"]').click();
    for (const [t, step] of [['0.2', '①'], ['0.5', '②'], ['0.9', '③']]) {
      await page.locator('#t-slider').fill(t);
      await expect(page.locator('#svd-phase')).toContainText(step);
    }
    // a matrix without a real logarithm explains the fallback
    await page.locator('#matrix-presets .chip[data-id="fib"]').click();
    await page.locator('#anim-mode button[data-value="exp"]').click();
    await expect(page.locator('#mode-note')).toContainText('没有实对数');
  });

  test('random integer matrix', async ({ page }) => {
    await open(page, '#/matrix');
    for (let k = 0; k < 5; k++) {
      await page.locator('#btn-random').click();
      const { A } = await state(page);
      for (const v of Object.values(A)) expect(Number.isInteger(v) && Math.abs(v) <= 3).toBe(true);
      expect(A.a * A.d - A.b * A.c).not.toBe(0);
    }
  });
});
