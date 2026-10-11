import { test, expect } from '@playwright/test';
import { watchErrors, open, state, pixel, drag } from './helpers.mjs';

test.describe('complex map module', () => {
  test('domain colouring: pixel hue matches arg f(z)', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/complex?f=z');
    await page.locator('#style-seg button[data-value="phase"]').click();
    await expect.poll(async () => (await state(page)).jobsPending, { timeout: 8000 }).toBe(false);
    const { phaseColor } = await import('../../src/core/domaincolor.js');
    const box = await page.locator('#pane-z canvas').first().boundingBox();
    // probe points away from grid lines: arg = 0, π/2, π, −π/2, π/4
    for (const [x, y] of [[1.9, 0.06], [0.06, 1.9], [-1.9, 0.06], [0.06, -1.9], [2.1, 2.1]]) {
      const [cx, cy] = await page.evaluate(([u, v]) => window.__mathscape.current.worldToClient(u, v), [x, y]);
      const got = await pixel(page, '#pane-z canvas', cx - box.x, cy - box.y);
      const want = phaseColor(x, y);
      const dist = Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]);
      expect(dist, `z = ${x} + ${y}i: got ${got}, want ${want}`).toBeLessThan(30);
    }
    check();
  });

  test('invalid expressions show a positioned error; valid ones recompile', async ({ page }) => {
    await open(page, '#/complex');
    const input = page.locator('#fz-input');
    await input.fill('z^2 + foo');
    const field = page.locator('.expr-field').first();
    await expect(field).toHaveClass(/invalid/);
    await expect(field.locator('.expr-error')).toContainText('未知符号 “foo”');
    await expect(field.locator('.caret')).toContainText('^^^');
    await input.fill('sin(z)/z');
    await expect(field).not.toHaveClass(/invalid/);
    expect((await state(page)).src).toBe('sin(z)/z');
  });

  test('probe reports f(z), f′(z) and the Cauchy–Riemann check', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/complex?f=1%2Fz');
    const [x, y] = await page.evaluate(() => window.__mathscape.current.worldToClient(2, 0));
    await page.mouse.click(x, y);
    const r = page.locator('#probe-readout');
    await expect(r.locator('dd[data-key="w"]')).toHaveText(/^0\.5$|^0\.5000/);
    await expect(r.locator('dd[data-key="dz"]')).toHaveText(/^−0\.25/); // f′(z) = −1/z²
    await expect(r.locator('dd[data-key="dzb"]')).toContainText('满足 C–R');
    await page.locator('#fz-input').fill('conj(z)');
    await page.mouse.click(x, y);
    await expect(r.locator('dd[data-key="dzb"]')).toContainText('非解析');
    check();
  });

  test('argument principle: winding number counts zeros inside the contour', async ({ page }) => {
    await open(page, '#/complex');
    await page.getByRole('button', { name: 'z³ − 1' }).click();
    await page.locator('#contour-toggle').check({ force: true });
    // default contour (centre 0.8 + 0.2i, r = 1.2) encloses only the root z = 1
    await expect(page.locator('#winding-readout dd').first()).toHaveText('1');
    // grow the circle by dragging its edge handle out to r ≈ 2.5 around the same centre
    const from = await page.evaluate(() => window.__mathscape.current.worldToClient(2.0, 0.2));
    const centre = await page.evaluate(() => window.__mathscape.current.worldToClient(0.8, 0.2));
    await drag(page, from, [centre[0] + (from[0] - centre[0]) * 2.6, centre[1]]);
    await expect(page.locator('#winding-readout dd').first()).toHaveText('3');
    // a pole counts negatively
    await page.locator('#fz-input').fill('(z - 1)/(z + 1)^2');
    await page.evaluate(() => window.__mathscape.current.setContour(0, 0, 2));
    await expect(page.locator('#winding-readout dd').first()).toHaveText('-1');
  });

  test('dragging the parameter a updates the function', async ({ page }) => {
    await open(page, '#/complex');
    await page.getByRole('button', { name: 'Blaschke 因子' }).click();
    const s0 = await state(page);
    const from = await page.evaluate(([x, y]) => window.__mathscape.current.worldToClient(x, y), s0.a);
    const to = await page.evaluate(() => window.__mathscape.current.worldToClient(-0.3, -0.4));
    await drag(page, from, to);
    const s = await state(page);
    expect(s.a[0]).toBeCloseTo(-0.3, 1);
    expect(s.a[1]).toBeCloseTo(-0.4, 1);
    await expect(page).toHaveURL(/a=-0\.\d+%2C-0\.\d+|a=-0\.\d+,-0\.\d+/);
  });

  test('grid morph animation and image grid', async ({ page }) => {
    await open(page, '#/complex');
    expect((await state(page)).lines).toBeGreaterThan(10);
    await page.locator('#morph-play').click();
    await page.waitForTimeout(400);
    const t = (await state(page)).t;
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
    await expect.poll(async () => (await state(page)).t, { timeout: 5000 }).toBe(1);
  });
});
