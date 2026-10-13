import { test, expect } from '@playwright/test';
import { watchErrors, openWorld, game, expectNoErrors } from './helpers.mjs';

test('villagers trade for woven coins; a treasure map leads to a buried chest', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page);
  // a cartographer sets up a stall next to the player
  await game(page, (g) => {
    const p = g.player;
    const m = g.spawnMob('villager', p.x + 1.5, p.y, p.z, { persist: true });
    m.prof = 'cartographer'; m.variant = 3; m.home = { x: m.x, y: m.y, z: m.z };
    window.__v = m;
    g.inventory.add(g.itemId('weave_coin'), 20);
    g.openTrade(m);
  });
  const rows = page.locator('.trade-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBe(6);
  const mapRow = rows.filter({ hasText: '藏宝图' }).first();
  await mapRow.getByRole('button').click();
  const after = await game(page, (g) => ({ map: g.inventory.count(g.itemId('treasure_map')), coins: g.inventory.count(g.itemId('weave_coin')), cnt: g.journey.cnt.villageTrade || 0 }));
  expect(after.map).toBe(1);
  expect(after.coins).toBe(15);
  expect(after.cnt).toBe(1);
  await page.keyboard.press('Escape');
  // unroll the map: a treasure is marked on the world map
  const t = await game(page, (g) => {
    const slot = g.inventory.slots.findIndex((s) => s && s.id === g.itemId('treasure_map'));
    g.inventory.selected = slot < 9 ? slot : 0;
    if (slot >= 9) { g.inventory.slots[0] = g.inventory.slots[slot]; g.inventory.slots[slot] = null; }
    const held = g.inventory.held();
    g.useSpecialItem(held, { use: 'treasure' }, null, true);
    return { t: g.treasures[0], mark: g.chartMarks.some((m) => m.kind === 'treasure'), tag: held.tag };
  });
  expect(t.mark).toBe(true);
  const d = Math.hypot(t.t.x - 0, t.t.z - 0);
  expect(d).toBeGreaterThan(60);
  expect(t.tag.tx).toBe(t.t.x);
  // travel there: the chest is laid into the ground when the land loads
  await game(page, (g, tt) => { g.teleport(tt.x + 0.5, 140, tt.z + 0.5); g.player.flying = true; }, t.t);
  await page.waitForFunction(() => window.__game.treasures[0].placed, null, { timeout: 120_000 });
  const placed = await game(page, (g) => { const q = g.treasures[0]; return { y: q.y, id: g.world.getId(q.x, q.y, q.z), chest: g.blockId('chest'), be: !!g.world.getBE(q.x, q.y, q.z) }; });
  expect(placed.id).toBe(placed.chest);
  expect(placed.be).toBe(true);
  // opening it counts as finding the treasure
  await game(page, (g) => { const q = g.treasures[0]; g.emit('openContainer', q.x, q.y, q.z, g.world.getBE(q.x, q.y, q.z)); });
  expect(await game(page, (g) => g.treasures[0].found && g.journey.cnt.treasure)).toBe(1);
  await expectNoErrors(errors);
});
