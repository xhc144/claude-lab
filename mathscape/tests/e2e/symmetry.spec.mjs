import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

test.describe('symmetry kaleidoscope', () => {
  test('drawing a stroke adds it; groups and elements switch', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/symmetry');
    expect((await state(page)).strokes).toBe(1);
    await page.locator('#sym-clear').click();
    const box = await page.locator('#stage > canvas').first().boundingBox();
    const before = await canvasStats(page, '#stage > canvas');
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 40, { steps: 10 });
    await page.mouse.up();
    expect((await state(page)).strokes).toBe(1);
    expect((await canvasStats(page, '#stage > canvas')).mean).toBeGreaterThan(before.mean);
    for (const [id, copies, orders, mirrors, glides] of [['p1', 1, [], false, false], ['pg', 2, [], false, true], ['p4', 4, [2, 4], false, false], ['p6m', 12, [2, 3, 6], true, true]]) {
      await page.locator(`#sym-wallpaper .chip[data-id="${id}"]`).click();
      const s = await state(page);
      expect(s.copies, id).toBe(copies);
      expect(s.elements.orders, id).toEqual(orders);
      expect(s.elements.mirrors > 0, id).toBe(mirrors);
      expect(s.elements.glides > 0, id).toBe(glides);
    }
    await expect(page).toHaveURL(/g=p6m/);
    await page.locator('#sym-elements').check({ force: true });
    await page.locator('#sym-kind button[data-value="rosette"]').click();
    await page.locator('#sym-n').fill('5');
    let s = await state(page);
    expect(s.id).toBe('D5');
    expect(s.copies).toBe(10);
    expect(s.elements.mirrors).toBe(5);
    await page.locator('#sym-kind button[data-value="frieze"]').click();
    s = await state(page);
    expect(s.kind).toBe('frieze');
    // undo and auto-draw
    await page.locator('#sym-random').click();
    const n = (await state(page)).strokes;
    await page.locator('#sym-undo').click();
    expect((await state(page)).strokes).toBe(n - 1);
    await page.locator('#sym-auto').click();
    expect((await state(page)).auto).toBe(true);
    await page.waitForTimeout(400);
    await page.locator('#sym-auto').click();
    expect((await state(page)).auto).toBe(false);
    check();
  });
});
