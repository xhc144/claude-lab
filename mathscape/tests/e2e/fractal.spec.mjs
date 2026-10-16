import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

const done = (page) => page.waitForFunction(() => window.__mathscape.current.state().done, null, { timeout: 30000 });

test.describe('fractal module', () => {
  test('Mandelbrot renders; clicking zooms in; colours change without re-iterating', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/fractal');
    await done(page);
    expect((await canvasStats(page, '#stage canvas')).distinct).toBeGreaterThan(40);
    const s0 = await state(page);
    expect(s0.kind).toBe('mandelbrot');
    expect(s0.method).toBe('double');
    expect(s0.interior).toBeGreaterThan(0.05); // the black set itself
    const box = await page.locator('#stage canvas').first().boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await expect.poll(async () => (await state(page)).span).toBeCloseTo(s0.span / 2.5, 6);
    await done(page);
    // palette and colour sliders only recolour
    const renders = (await state(page)).renders;
    await page.locator('#fractal-palette .chip[data-id="fire"]').click();
    await page.locator('#fractal-density').fill('1');
    expect((await state(page)).renders).toBe(renders);
    await expect(page).toHaveURL(/p=fire/);
    check();
  });

  test('Julia, Burning Ship and Newton all render', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/fractal');
    for (const kind of ['julia', 'ship', 'newton']) {
      await page.locator(`#fractal-kind button[data-value="${kind}"]`).click();
      await done(page);
      expect((await state(page)).kind).toBe(kind);
      expect((await canvasStats(page, '#stage canvas')).distinct, kind).toBeGreaterThan(30);
    }
    await page.locator('#fractal-kind button[data-value="julia"]').click();
    await page.locator('#julia-presets .chip[data-id="basilica"]').click();
    expect((await state(page)).julia).toEqual([-1, 0]);
    await expect(page).toHaveURL(/j=-1(,|%2C)0/);
    check();
  });

  test('double precision stops at its limit and offers high precision', async ({ page }) => {
    await open(page, '#/fractal?x=-0.743643887037158704752191506114774&y=0.131825904205311970493132056385139&s=1e-15');
    const s = await state(page);
    expect(s.limited).toBe(true);
    expect(s.span).toBeGreaterThan(1e-13);
    await expect(page.locator('#fractal-limit')).toBeVisible();
    await page.locator('#fractal-limit .btn').click();
    await expect(page.locator('#prec-pill')).toContainText('高精度');
    await page.waitForFunction(() => window.__mathscape.current.state?.().method === 'perturb', null, { timeout: 20000 });
  });

  test('high precision: perturbation renders far below the double limit', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/fractal?x=-0.743643887037158704752191506114774&y=0.131825904205311970493132056385139&s=2e-16&hp=50');
    await done(page);
    const s = await state(page);
    expect(s.method).toBe('perturb');
    expect(s.limited).toBe(false);
    expect(s.span).toBe(2e-16);
    expect(s.bits).toBeGreaterThan(100);
    expect(s.skip).toBeGreaterThan(100); // series approximation
    expect((await canvasStats(page, '#stage canvas')).distinct).toBeGreaterThan(40);
    await expect(page.locator('#fractal-readout')).toContainText('摄动');
    // the centre keeps its digits through a pan
    const from = await page.locator('#stage canvas').first().boundingBox();
    await page.mouse.move(from.x + 400, from.y + 300);
    await page.mouse.down();
    await page.mouse.move(from.x + 380, from.y + 300, { steps: 4 });
    await page.mouse.up();
    const moved = await state(page);
    expect(moved.x).not.toBe(s.x);
    expect(moved.x.length).toBeGreaterThan(20);
    check();
  });
});
