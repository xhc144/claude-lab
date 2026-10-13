import { test, expect } from '@playwright/test';
import { APP, watchErrors, openWorld, game, expectNoErrors } from './helpers.mjs';

test('title screen → new world through the menus', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(APP);
  await expect(page.locator('.logo-main')).toBeVisible();
  await page.getByRole('button', { name: '开始冒险' }).click();
  await page.getByRole('button', { name: '新建世界' }).click();
  await page.locator('.field input').nth(0).fill('端到端测试');
  await page.locator('.field input').nth(1).fill('424242');
  await page.getByRole('button', { name: '创建并进入' }).click();
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 120_000 });
  const info = await game(page, (g) => ({ seed: g.seed, name: g.meta.name, chunks: g.world.chunks.size, hotbar: g.inventory.slots.slice(0, 2).map((s) => s && s.n) }));
  expect(info.seed).toBe(424242);
  expect(info.name).toBe('端到端测试');
  expect(info.chunks).toBeGreaterThan(9);
  expect(info.hotbar).toEqual([3, 4]); // starter bread and torches
  await expect(page.locator('.click-to-play')).toBeVisible();
  await page.locator('.click-to-play').click();
  await expect(page.locator('.hotbar')).toBeVisible();
  await expectNoErrors(errors);
});

test('break a block and craft through the recipe book', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page);
  // chop: break a log next to spawn (or any surface block) via the real harvest path
  const got = await game(page, (g) => {
    const { player: p, world: w } = g;
    const x = Math.floor(p.x) + 2, z = Math.floor(p.z);
    const y = w.surfaceY(x, z);
    const v = w.getBlock(x, y, z);
    g.harvestBlock(x, y, z, v, null, true);
    g.inventory.add(g.itemId('oak_log'), 4);
    return { id: v & 1023, gone: w.getId(x, y, z) === 0 };
  });
  expect(got.id).toBeGreaterThan(0);
  expect(got.gone).toBe(true);
  await page.keyboard.press('KeyE');
  await expect(page.locator('.recipe-grid')).toBeVisible();
  const before = await game(page, (g) => g.inventory.slots.filter(Boolean).reduce((a, s) => a + s.n, 0));
  // the first craftable tile is planks; select it and press 合成
  await page.locator('.rtile.ok').first().dispatchEvent('mousedown');
  await page.getByRole('button', { name: '合成', exact: true }).click();
  const after = await game(page, (g) => g.inventory.slots.filter(Boolean).reduce((a, s) => a + s.n, 0));
  expect(after).toBeGreaterThan(before); // 1 log → 4 planks
  await page.keyboard.press('Escape');
  await expect(page.locator('.recipe-grid')).toHaveCount(0);
  await expectNoErrors(errors);
});

test('world changes survive saving and reloading', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page, { seed: 777, fresh: true });
  const pos = await game(page, (g) => {
    const p = g.player, w = g.world;
    const x = Math.floor(p.x) + 3, z = Math.floor(p.z) + 3, y = w.surfaceY(x, z) + 1;
    w.setBlock(x, y, z, g.blockId('gold_block'), { cause: 'player' });
    g.inventory.slots[5] = { id: g.itemId('glider'), n: 1 };
    g.dayTime = 15000;
    return { x, y, z };
  });
  await page.evaluate(() => window.__app.saveGame());
  await openWorld(page, { seed: 777, fresh: false });
  const after = await game(page, (g, pos) => ({
    block: g.world.getId(pos.x, pos.y, pos.z) === g.blockId('gold_block'),
    glider: !!(g.inventory.slots[5] && g.inventory.slots[5].id === g.itemId('glider')),
    night: g.dayTime > 14000,
  }), pos);
  expect(after).toEqual({ block: true, glider: true, night: true });
  await expectNoErrors(errors);
});

test('map, codex, chat command and pause screens', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page);
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-canvas')).toBeVisible();
  await expect(page.locator('.map-info')).toContainText('已探索');
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-canvas')).toHaveCount(0);
  await page.keyboard.press('KeyJ');
  await expect(page.locator('.codex-panel')).toBeVisible();
  await page.getByRole('button', { name: '群系' }).click();
  await expect(page.locator('.codex-card').first()).toBeVisible();
  await page.keyboard.press('KeyJ');
  await page.keyboard.press('KeyT');
  await expect(page.locator('.chat-input')).toBeFocused();
  await page.locator('.chat-input').fill('/time set 18000');
  await page.locator('.chat-input').press('Enter');
  await expect.poll(() => game(page, (g) => Math.round(g.dayTime))).toBeGreaterThanOrEqual(18000);
  await page.keyboard.press('Escape');
  await expect(page.getByText('游戏暂停')).toBeVisible();
  await page.getByRole('button', { name: '继续游戏' }).click();
  await expectNoErrors(errors);
});

test('the shard quest: pedestals open a shrine, five shards wake the altar', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page, { mode: 'creative' });
  const res = await game(page, async (g) => {
    const B = (n) => g.blockId(n), I = (n) => g.itemId(n);
    const find = (id, x, y, z, r) => { const out = []; for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (g.world.getId(x + dx, y + dy, z + dz) === id) out.push([x + dx, y + dy, z + dz]); return out; };
    const s = g.locate('sand');
    g.player.flying = true;
    g.teleport(s.x + 0.5, s.y + 20, s.z + 0.5);
    await g.chunks.waitFor(s.x >> 4, s.z >> 4, 2);
    const peds = find(B('rune_pedestal'), s.x, s.y - 12, s.z - 18, 8);
    const seals = () => find(B('seal_door'), s.x, s.y - 12, s.z - 22, 4).length;
    const before = seals();
    for (const [x, y, z] of peds) {
      g.inventory.slots[g.inventory.selected] = { id: I('echo_crystal'), n: 1 };
      g.useAncientBlock(x, y, z, g.world.getBlock(x, y, z), g.inventory.slots[g.inventory.selected]);
    }
    await new Promise((r) => setTimeout(r, 1500));
    const heart = g.locate('heart');
    g.teleport(heart.x + 0.5, heart.y + 3, heart.z + 3.5);
    await g.chunks.waitFor(heart.x >> 4, heart.z >> 4, 1);
    for (const n of ['shard_sky', 'shard_abyss', 'shard_sand', 'shard_frost', 'shard_tide']) {
      g.inventory.slots[g.inventory.selected] = { id: I(n), n: 1 };
      g.useAncientBlock(heart.x, heart.y, heart.z, g.world.getBlock(heart.x, heart.y, heart.z), g.inventory.slots[g.inventory.selected]);
    }
    return { peds: peds.length, before, after: seals(), placed: g.quest.count(), done: g.quest.done, wings: g.inventory.has(I('star_wings')) };
  });
  expect(res.peds).toBeGreaterThanOrEqual(3);
  expect(res.before).toBeGreaterThan(0);
  expect(res.after).toBe(0);
  expect(res).toMatchObject({ placed: 5, done: true, wings: true });
  await expectNoErrors(errors);
});
