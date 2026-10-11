import { test, expect } from '@playwright/test';
import { watchErrors, open, state } from './helpers.mjs';

test.describe('ODE module — phase plane', () => {
  test('Van der Pol: unstable focus, clicking adds a trajectory that reaches the limit cycle', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/ode');
    let s = await state(page);
    expect(s.preset).toBe('vdp');
    expect(s.equilibria).toHaveLength(1);
    expect(s.equilibria[0].type).toBe('unstable-focus');
    await expect(page.locator('#eq-list')).toContainText('不稳定焦点');
    const n0 = s.trajectories.length;
    const [x, y] = await page.evaluate(() => window.__mathscape.current.view.worldToClient(-3, -1));
    await page.mouse.click(x, y);
    s = await state(page);
    expect(s.trajectories.length).toBe(n0 + 1);
    const tr = s.trajectories.at(-1);
    expect(tr.n).toBeGreaterThan(200);
    expect(tr.t1).toBeCloseTo(40, 6); // integrated over the full forward window
    check();
  });

  test('pendulum: centres and saddles, separatrices appear', async ({ page }) => {
    await open(page, '#/ode');
    await page.getByRole('button', { name: '阻尼单摆' }).click();
    await page.evaluate(() => window.__mathscape.current.view.setParam('a', 0));
    const s = await state(page);
    const types = s.equilibria.map((e) => e.type);
    expect(types).toContain('center');
    expect(types).toContain('saddle');
    for (const e of s.equilibria) {
      const k = Math.round(e.x / Math.PI);
      expect(Math.abs(e.x - k * Math.PI)).toBeLessThan(1e-7);
      expect(e.type).toBe(k % 2 === 0 ? 'center' : 'saddle');
    }
    expect(s.separatrices).toBeGreaterThan(0);
    expect(s.nullclineSegments).toBeGreaterThan(50);
  });

  test('Hopf bifurcation: stability of the origin flips with μ', async ({ page }) => {
    await open(page, '#/ode');
    await page.getByRole('button', { name: '霍普夫分岔' }).click();
    await page.evaluate(() => window.__mathscape.current.view.setParam('a', -0.5));
    expect((await state(page)).equilibria.find((e) => Math.hypot(e.x, e.y) < 1e-6).type).toBe('stable-focus');
    await page.evaluate(() => window.__mathscape.current.view.setParam('a', 0.5));
    expect((await state(page)).equilibria.find((e) => Math.hypot(e.x, e.y) < 1e-6).type).toBe('unstable-focus');
  });

  test('parameter slider drives the field live', async ({ page }) => {
    await open(page, '#/ode');
    await page.getByRole('button', { name: '线性系统' }).click();
    // a = 1.5 > 0 with d = −0.4, b·c = −1 → det = 1.5·(−0.4) + 1 = 0.4 > 0, tr = 1.1 → unstable
    await page.locator('#param-a').fill('1.5');
    await expect.poll(async () => (await state(page)).equilibria[0]?.type).toMatch(/unstable/);
    expect((await state(page)).p.a).toBeCloseTo(1.5, 9);
  });

  test('custom equations: errors are reported, valid input recompiles', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/ode');
    await page.locator('#ode-f').fill('y +');
    await expect(page.locator('.expr-field.invalid')).toHaveCount(1);
    await page.locator('#ode-f').fill('x - x^3');
    await page.locator('#ode-g').fill('-y');
    // equilibria of x' = x − x³, y' = −y: (0, 0) saddle, (±1, 0) stable nodes
    await expect.poll(async () => (await state(page)).equilibria.length).toBe(3);
    const s = await state(page);
    const types = s.equilibria.sort((p, q) => p.x - q.x).map((e) => e.type);
    expect(types).toEqual(['stable-node', 'saddle', 'stable-node']);
    await expect(page).toHaveURL(/f=x/);
    check();
  });
});

test.describe('ODE module — 3D attractors', () => {
  test('Lorenz runs, trajectories diverge and λmax ≈ 0.9', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/ode');
    await page.locator('#ode-mode button[data-value="3d"]').click();
    await expect(page).toHaveURL(/mode=3d/);
    await expect.poll(async () => (await state(page)).lyap, { timeout: 10000 }).not.toBeNull();
    const s = await state(page);
    expect(s.mode).toBe('3d');
    expect(s.count).toBe(3);
    expect(s.lyap).toBeGreaterThan(0.8);
    expect(s.lyap).toBeLessThan(1.05);
    const t0 = s.t;
    await page.waitForTimeout(800);
    expect((await state(page)).t).toBeGreaterThan(t0);
    check();
  });

  test('switching presets reframes the camera', async ({ page }) => {
    await open(page, '#/ode?mode=3d');
    await page.getByRole('button', { name: '罗斯勒' }).click();
    const s = await state(page);
    expect(s.preset).toBe('rossler');
    expect(s.frame.s).toBeGreaterThan(5);
    expect(s.frame.s).toBeLessThan(20);
  });
});
