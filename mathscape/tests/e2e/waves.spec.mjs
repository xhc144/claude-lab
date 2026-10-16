import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

test.describe('Waves', () => {
  test('drops, walls and sources in the ripple tank', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/waves');
    await expect.poll(async () => (await state(page)).t).toBeGreaterThan(20);
    expect((await canvasStats(page, '#stage > canvas')).distinct).toBeGreaterThan(5);
    await page.evaluate(() => window.__mathscape.current.setPlaying(false));
    await page.locator('#waves-clear').click();
    // a click drops a crest right there
    const [gw, gh] = (await state(page)).grid;
    const cx = Math.round(gw / 2), cy = Math.round(gh / 2);
    await page.mouse.click(...(await page.evaluate(([x, y]) => window.__mathscape.current.gridToClient(x, y), [cx, cy])));
    expect(await page.evaluate(([x, y]) => window.__mathscape.current.field(x, y), [cx, cy])).toBeGreaterThan(1);
    // draw a wall
    await page.locator('#waves-tool button[data-value="wall"]').click();
    const a = await page.evaluate(([x, y]) => window.__mathscape.current.gridToClient(x, y), [40, 30]);
    const b = await page.evaluate(([x, y]) => window.__mathscape.current.gridToClient(x, y), [40, 80]);
    await page.mouse.move(...a);
    await page.mouse.down();
    await page.mouse.move(...b, { steps: 8 });
    await page.mouse.up();
    expect((await state(page)).walls).toBeGreaterThan(100);
    // a source appears on click and disappears on a second click
    await page.locator('#waves-tool button[data-value="source"]').click();
    const p = await page.evaluate(([x, y]) => window.__mathscape.current.gridToClient(x, y), [cx + 30, cy]);
    await page.mouse.click(...p);
    expect((await state(page)).sources).toBe(1);
    await page.mouse.click(...p);
    expect((await state(page)).sources).toBe(0);
    check();
  });

  test('scenes: double slit, Mach cone, drum modes and Chladni sand', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/waves');
    await page.locator('#waves-scenes .chip[data-id="slit"]').click();
    let s = await state(page);
    expect(s.scene).toBe('slit');
    expect(s.display).toBe('intensity');
    expect(s.walls).toBeGreaterThan(100);
    await expect(page).toHaveURL(/s=slit/);
    await expect(page.locator('#waves-readout')).toContainText('λL/d');
    await page.locator('#waves-scenes .chip[data-id="mach"]').click();
    expect((await state(page)).mach).toBeCloseTo(1.6);
    await expect(page.locator('#waves-readout')).toContainText('马赫角');
    await page.locator('#waves-scenes .chip[data-id="drum"]').click();
    await expect(page.locator('#waves-m')).toBeVisible();
    await page.locator('#waves-m').fill('5');
    expect((await state(page)).m).toBe(5);
    await page.locator('#waves-scenes .chip[data-id="chladni"]').click();
    s = await state(page);
    expect(s.scene).toBe('chladni');
    const start = s.sandAmp;
    // the sand drifts to the nodal lines
    await expect.poll(async () => (await state(page)).sandAmp, { timeout: 15000 }).toBeLessThan(start * 0.6);
    await page.locator('#chladni-presets .chip[data-id="3,7"]').click();
    expect((await state(page)).cn).toBe(7);
    check();
  });
});
