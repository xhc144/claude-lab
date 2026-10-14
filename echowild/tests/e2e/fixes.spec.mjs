import { test, expect } from '@playwright/test';
import { watchErrors, openWorld, game, expectNoErrors } from './helpers.mjs';

test('creative: item palette, free crafting and world controls', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page, { mode: 'creative' });
  await page.keyboard.press('KeyE');
  await expect(page.locator('.mode-tab', { hasText: '物品' })).toHaveClass(/on/);
  const tiles = page.locator('.palette-grid .ptile');
  expect(await tiles.count()).toBeGreaterThan(300);
  // search, take a stack, put it in the hotbar
  await page.locator('.creative .search').fill('原木');
  const first = tiles.first();
  await first.dispatchEvent('mousedown', { button: 0 });
  const cursor = await page.evaluate(() => window.__app.ui.cursor);
  expect(cursor && cursor.n).toBe(64);
  await page.locator('.hotbar-row .islot, .inv-hotbar .islot, .slot-grid .islot').last().dispatchEvent('mousedown', { button: 0 });
  const placed = await game(page, (g, id) => g.inventory.slots.some((s) => s && s.n === 64 && s.id === id), cursor.id);
  expect(placed).toBe(true);
  await page.evaluate(() => window.__app.ui.setCursor(null)); // (the slot held the starter water bucket: it was swapped onto the cursor)
  // shift-click puts a full stack straight into the inventory
  await page.locator('.creative .search').fill('');
  await page.locator('.cat-chips .chip', { hasText: '功能' }).click();
  const before = await game(page, (g) => g.inventory.slots.filter(Boolean).length);
  await tiles.first().dispatchEvent('mousedown', { button: 0, shiftKey: true });
  expect(await game(page, (g) => g.inventory.slots.filter(Boolean).length)).toBe(before + 1);
  // crafting is free in creative
  await page.locator('.mode-tab', { hasText: '合成书' }).click();
  await page.locator('.rtile').first().dispatchEvent('mousedown');
  const n0 = await game(page, (g) => g.inventory.slots.filter(Boolean).reduce((a, s) => a + s.n, 0));
  await page.getByRole('button', { name: '合成', exact: true }).click();
  expect(await game(page, (g) => g.inventory.slots.filter(Boolean).reduce((a, s) => a + s.n, 0))).toBeGreaterThan(n0);
  // world controls: time presets and freezing the clock
  await page.locator('.mode-tab', { hasText: '世界' }).click();
  await page.locator('.world-ctl .seg-b', { hasText: '午夜' }).click();
  const mid = await game(page, (g) => Math.round(g.dayTime));
  expect(mid >= 18000 && mid < 18100, `time ${mid}`).toBe(true); // the clock may tick once before we read it
  await page.locator('.wc-row', { hasText: '时间流逝' }).locator('.seg-b').click();
  expect(await game(page, (g) => g.rules.daylightCycle)).toBe(false);
  await page.keyboard.press('Escape');
  const t0 = await game(page, (g) => g.dayTime);
  await page.waitForTimeout(1500);
  expect(await game(page, (g) => g.dayTime)).toBe(t0);
  await expectNoErrors(errors);
});

test('felling a tree drops logs that end up in the inventory', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page);
  const r0 = await game(page, (g) => {
    const p = g.player, w = g.world, log = g.blockId('oak_log');
    // a fresh log column right next to the player
    const x = Math.floor(p.x) + 1, z = Math.floor(p.z), y = w.surfaceY(x, z) + 1;
    for (let k = 0; k < 3; k++) w.setBlock(x, y + k, z, log);
    const before = g.inventory.count(log);
    for (let k = 2; k >= 0; k--) g.harvestBlock(x, y + k, z, w.getBlock(x, y + k, z), null, true);
    return { before, ticks: g.ticks, gone: [0, 1, 2].every((k) => w.getId(x, y + k, z) === 0), drops: g.entities.list.filter((e) => e.type === 'item' && !e.dead && e.stack.id === log).length };
  });
  expect(r0.gone).toBe(true);
  expect(r0.drops).toBe(3);
  // let the simulation run (headless rendering is slow, so wait on ticks rather than wall time)
  await page.waitForFunction((t) => window.__game.ticks > t + 60, r0.ticks, { timeout: 120_000 });
  const gained = await game(page, (g) => g.inventory.count(g.blockId('oak_log')));
  expect(gained - r0.before).toBe(3);
  await expectNoErrors(errors);
});
