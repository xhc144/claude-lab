import { test, expect } from '@playwright/test';
import { watchErrors, openWorld, game, expectNoErrors } from './helpers.mjs';

test('a hot meal leaves you well fed; snowy nights chill you and a fire warms you up', async ({ page }) => {
  const errors = watchErrors(page);
  await openWorld(page);
  // eat a stew through the real eating path
  await game(page, (g) => {
    g.inventory.slots[0] = { id: g.itemId('mushroom_stew'), n: 1 };
    g.inventory.selected = 0;
    g.player.hunger = 10; g.player.chill = 50;
    g.using = { id: g.itemId('mushroom_stew'), slot: 0, t: 99, need: 1, kind: 'eat' };
    g.input.button = () => true;
  });
  await page.waitForFunction(() => !window.__game.using, null, { timeout: 60_000 });
  const fed = await game(page, (g) => ({ fed: g.player.effects.fed, warm: g.player.effects.warm, chill: g.player.chill, chip: !!document.querySelector('.eff-fed') }));
  expect(fed.fed).toBeGreaterThan(200);
  expect(fed.warm).toBeGreaterThan(60);
  expect(fed.chill).toBeLessThan(1);
  // find tundra and stand there at night, out in the open
  const spot = await game(page, (g) => {
    const p = g.player;
    for (let r = 64; r < 2000; r += 48) for (let a = 0; a < 6.28; a += 0.4) {
      const x = Math.round(p.x + Math.cos(a) * r), z = Math.round(p.z + Math.sin(a) * r);
      const c = g.gen.column(x, z);
      if (c.h > 63 && c.island < 0.05 && g.biomeKey(c.biome) === 'tundra') return { x, z, h: c.h };
    }
    return null;
  });
  expect(spot).not.toBeNull();
  await game(page, (g, s) => {
    delete g.player.effects.warm;
    g.player.chill = 0;
    g.teleport(s.x + 0.5, s.h + 1.2, s.z + 0.5);
    g.rules.daylightCycle = false; g.dayTime = 18000;
    if (g.weather) g.weather.rain = 0;
  }, spot);
  await page.waitForFunction(() => window.__game.player.chill > 8, null, { timeout: 120_000 });
  // a campfire next to you warms you back up
  await game(page, (g) => {
    const p = g.player, x = Math.floor(p.x) + 1, z = Math.floor(p.z), y = Math.floor(p.y);
    g.world.setBlock(x, y, z, g.blockId('campfire'));
    g._chillAtFire = g.player.chill;
  });
  await page.waitForFunction(() => window.__game.player.chill < window.__game._chillAtFire - 3, null, { timeout: 120_000 });
  await expectNoErrors(errors);
});
