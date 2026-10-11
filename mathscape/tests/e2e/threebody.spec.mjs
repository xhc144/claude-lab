import { test, expect } from '@playwright/test';
import { watchErrors, open, state, drag } from './helpers.mjs';

test.describe('three-body module', () => {
  test('figure eight runs with tiny energy error', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/threebody');
    await page.waitForTimeout(1500);
    const s = await state(page);
    expect(s.preset).toBe('figure8');
    expect(s.playing).toBe(true);
    expect(s.t).toBeGreaterThan(0.5);
    expect(s.relE).toBeLessThan(1e-8);
    expect(Math.hypot(...s.P)).toBeLessThan(1e-9);
    await expect(page.locator('#hud-de')).toHaveClass(/good/);
    check();
  });

  test('pause, step and reset', async ({ page }) => {
    await open(page, '#/threebody');
    await page.locator('#nbody-play').click();
    const t1 = (await state(page)).t;
    await page.waitForTimeout(300);
    expect((await state(page)).t).toBe(t1);
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).t).toBeCloseTo(t1 + 0.05, 9);
    await page.locator('#nbody-reset').click();
    expect((await state(page)).t).toBe(0);
  });

  test('time reversal retraces the orbit', async ({ page }) => {
    await open(page, '#/threebody');
    await page.locator('#nbody-play').click(); // pause
    await page.locator('#nbody-reset').click();
    const s0 = await state(page);
    await page.evaluate(() => window.__mathscape.current.advance(3));
    await page.locator('#nbody-reverse').click();
    await page.evaluate(() => window.__mathscape.current.advance(3));
    const s = await state(page);
    for (let i = 0; i < 3; i++) {
      expect(Math.hypot(s.pos[i][0] - s0.pos[i][0], s.pos[i][1] - s0.pos[i][1])).toBeLessThan(1e-6);
      // velocities come back reversed
      expect(Math.hypot(s.vel[i][0] + s0.vel[i][0], s.vel[i][1] + s0.vel[i][1])).toBeLessThan(1e-6);
    }
  });

  test('Pythagorean problem ends with an ejection', async ({ page }) => {
    await open(page, '#/threebody');
    await page.getByRole('button', { name: '毕达哥拉斯问题' }).click();
    await page.locator('#nbody-play').click(); // pause
    await page.locator('#nbody-reset').click();
    for (let k = 0; k < 8; k++) await page.evaluate(() => window.__mathscape.current.advance(10));
    const s = await state(page);
    expect(s.t).toBeCloseTo(80, 6);
    expect(s.failed).toBe(false);
    expect(s.relE).toBeLessThan(1e-5);
    const d01 = Math.hypot(s.pos[0][0] - s.pos[1][0], s.pos[0][1] - s.pos[1][1]);
    const d12 = Math.hypot(s.pos[1][0] - s.pos[2][0], s.pos[1][1] - s.pos[2][1]);
    expect(d12).toBeLessThan(1); // masses 4 and 5 form a tight binary
    expect(d01).toBeGreaterThan(20); // mass 3 is far away
  });

  test('switching integrator and editing initial conditions', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/threebody');
    await page.locator('#nbody-method').selectOption('verlet');
    expect((await state(page)).method).toBe('verlet');
    await page.waitForTimeout(500);
    expect((await state(page)).relE).toBeLessThan(1e-3);

    await page.locator('#nbody-play').click(); // pause → editing enabled
    const s0 = await state(page);
    const from = await page.evaluate(([x, y]) => window.__mathscape.current.worldToClient(x, y), s0.pos[2]);
    await drag(page, from, [from[0] + 60, from[1] - 40]);
    const s = await state(page);
    expect(s.t).toBe(0);
    expect(s.preset).toBeNull();
    expect(Math.hypot(s.pos[2][0] - s0.pos[2][0], s.pos[2][1] - s0.pos[2][1])).toBeGreaterThan(0.05);
    check();
  });

  test('add a body and generate a random system', async ({ page }) => {
    await open(page, '#/threebody');
    await page.locator('#nbody-add').click();
    expect((await state(page)).n).toBe(4);
    await page.locator('#nbody-random').click();
    const s = await state(page);
    expect(s.n).toBe(3);
    expect(s.energy).toBeLessThan(0); // bound
    await expect(page).toHaveURL(/seed=\d+/);
  });
});
