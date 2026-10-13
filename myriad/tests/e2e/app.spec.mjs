import { test, expect } from '@playwright/test';
import { APP, watchErrors, openWorld, simulate, canvasStats, toScreen, focusCity } from './helpers.mjs';

test('title screen: previews render and a new world can be created', async ({ page }) => {
  const check = watchErrors(page);
  await page.goto(APP);
  await expect(page.locator('#start .title-big')).toHaveText('万象');
  await expect(page.locator('.preset')).toHaveCount(9);
  // previews get drawn (non-blank canvases)
  await page.waitForFunction(() => {
    const c = document.querySelectorAll('.preset canvas')[8];
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let set = new Set();
    for (let i = 0; i < d.length; i += 400) set.add(d[i] + d[i + 1] * 256);
    return set.size > 20;
  }, null, { timeout: 20000 });
  await page.locator('.preset[data-preset="archipelago"]').click();
  await page.locator('.seg[data-key="size"] button[data-v="small"]').click();
  await page.locator('.seg[data-key="start"] button[data-v="primordial"]').click();
  await page.locator('#start .btn.big').first().click();
  await expect(page.locator('#start')).toHaveCount(0, { timeout: 20000 });
  // the world is generated behind a loading veil
  await page.waitForFunction(() => !window.__myriad.game.world.demo, null, { timeout: 30000 });
  const w = await page.evaluate(() => ({ preset: window.__myriad.game.world.preset, W: window.__myriad.game.world.W, demo: !!window.__myriad.game.world.demo, sp: window.__myriad.game.world.species.length }));
  expect(w).toEqual({ preset: 'archipelago', W: 240, demo: false, sp: 2 });
  check();
});

test('the world renders, time flows and the HUD follows', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  const s = await canvasStats(page);
  expect(s.distinct).toBeGreaterThan(150);
  await expect(page.locator('#clk-year')).toContainText('创世 0 年');
  await page.keyboard.press('5');
  await expect.poll(() => page.evaluate(() => window.__myriad.game.world.tick),
    { timeout: 20000 }).toBeGreaterThan(20);
  const year = await page.evaluate(() => window.__myriad.game.world.tick);
  expect(year).toBeGreaterThan(20);
  await page.keyboard.press('Space');
  const t1 = await page.evaluate(() => window.__myriad.game.world.tick);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__myriad.game.world.tick)).toBe(t1);
  await expect(page.locator('#clk-year')).not.toContainText('创世 0 年');
  check();
});

test('inspecting a city shows its nation, and links lead to the nation', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  await simulate(page, 200);
  const c = await focusCity(page, 9);
  await page.mouse.click(c.sx, c.sy);
  await expect(page.locator('.tab-body .h2')).toContainText(c.name);
  await page.locator('.tab-body a.link').first().click();
  await expect(page.locator('.tab-body')).toContainText('文化价值观');
  check();
});

test('god powers through the palette: raise land, meteor, prophecy', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  await simulate(page, 120);
  // raise terrain over the sea
  const sea = await page.evaluate(() => {
    const w = window.__myriad.game.world;
    for (let c = 0; c < w.N; c++) { const x = c % w.W, y = (c / w.W) | 0; if (x > 30 && y > 30 && x < w.W - 30 && y < w.H - 30 && w.elev[c] < w.seaLevel - 0.02 && w.elev[c] > w.seaLevel - 0.1) return { x: x + 0.5, y: y + 0.5, c }; }
    return null;
  });
  expect(sea).not.toBeNull();
  await page.evaluate(({ x, y }) => { const g = window.__myriad.game; g.R.cam.x = x; g.R.cam.y = y; g.R.cam.zoom = 8; }, sea);
  await page.locator('.cat-btn[data-cat="terrain"]').click();
  await page.locator('.tool-btn[data-tool="raise"]').click();
  const [sx, sy] = await toScreen(page, sea.x, sea.y);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await expect.poll(() => page.evaluate((c) => {
    const w = window.__myriad.game.world;
    return w.elev[c] >= w.seaLevel;
  }, sea.c), { timeout: 20000 }).toBe(true);
  await page.mouse.up();
  expect(await page.evaluate((c) => { const w = window.__myriad.game.world; return w.elev[c] >= w.seaLevel; }, sea.c)).toBe(true);
  // a meteor leaves a crater and dust
  await page.locator('.cat-btn[data-cat="disaster"]').click();
  await page.locator('.tool-btn[data-tool="meteor"]').click();
  await page.mouse.click(sx + 60, sy + 40);
  expect(await page.evaluate(() => window.__myriad.game.world.climate.dust)).toBeGreaterThan(0.01);
  // a prophecy founds a religion that worships the player
  await page.locator('.cat-btn[data-cat="civ"]').click();
  await page.locator('.tool-btn[data-tool="prophecy"]').click();
  const city = await focusCity(page);
  await page.mouse.click(city.sx, city.sy);
  expect(await page.evaluate(() => window.__myriad.game.world.religions.some((r) => r.player))).toBe(true);
  await page.locator('.tab[data-tab="faith"]').click();
  await expect(page.locator('.tab-body')).toContainText('你的名号');
  await expect(page.locator('.tab-body .li').first()).toContainText('「');
  check();
});

test('every tool category opens, every overlay draws', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  await simulate(page, 160);
  for (const cat of ['terrain', 'water', 'life', 'civ', 'disaster', 'wonder']) {
    await page.locator(`.cat-btn[data-cat="${cat}"]`).click();
    await expect(page.locator('#toolgrid')).toHaveClass(/open/);
    expect(await page.locator('#toolgrid .tool-btn').count()).toBeGreaterThan(3);
  }
  const ids = await page.evaluate(() => [...document.querySelectorAll('.ov-btn')].map((b) => b.dataset.ov));
  for (const id of ids) {
    await page.locator(`.ov-btn[data-ov="${id}"]`).click();
    await page.waitForTimeout(120);
    const s = await canvasStats(page);
    expect(s.distinct, id).toBeGreaterThan(40);
  }
  check();
});

test('side panel tabs: chronicle, nations histomap, tree of life, statistics', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  await simulate(page, 400);
  await page.locator('.tab[data-tab="chronicle"]').click();
  expect(await page.locator('.ce').count()).toBeGreaterThan(5);
  await page.locator('.tab[data-tab="nations"]').click();
  expect(await page.locator('.tab-body .li').count()).toBeGreaterThan(0);
  await page.locator('.tab[data-tab="species"]').click();
  await page.waitForTimeout(200);
  expect(await page.locator('.tab-body canvas').first().evaluate((c) => c.height)).toBeGreaterThan(100);
  await page.locator('.tab[data-tab="stats"]').click();
  await page.waitForTimeout(200);
  expect(await page.locator('.tab-body canvas.chart').count()).toBe(8);
  check();
});

test('timeline: rewinding restores the past and opens a branch', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  await simulate(page, 40);
  await page.evaluate(() => window.__myriad.game.takeSnapshot('测试'));
  const t0 = await page.evaluate(() => window.__myriad.game.world.tick);
  await simulate(page, 80);
  await page.keyboard.press('t');
  await expect(page.locator('.tl-item')).toHaveCount(2);
  page.once('dialog', (d) => d.accept());
  await page.locator('.tl-item').nth(1).click();
  const after = await page.evaluate(() => ({ tick: window.__myriad.game.world.tick, branch: window.__myriad.game.world.branch }));
  expect(after).toEqual({ tick: t0, branch: 1 });
  check();
});

test('saves: export a file and load it back', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  await simulate(page, 60);
  const before = await page.evaluate(() => ({ tick: window.__myriad.game.world.tick, cities: window.__myriad.game.world.cities.length }));
  await page.locator('#btn-save').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('导出为文件').click()]);
  const path = await download.path();
  // (headless Chromium reports non-ASCII download names as "download", so only the content is checked)
  await page.keyboard.press('Escape');
  await simulate(page, 30);
  await page.locator('#btn-save').click();
  await page.locator('.modal input[type=file]').setInputFiles(path);
  await page.waitForFunction((t) => window.__myriad.game.world.tick === t, before.tick, { timeout: 20000 });
  expect(await page.evaluate(() => window.__myriad.game.world.cities.length)).toBe(before.cities);
  check();
});

test('species designer creates a creature that can be released', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page, { start: 'barren' });
  await page.locator('.cat-btn[title="物种设计器"]').click();
  await page.locator('.arch').filter({ hasText: '草原角兽' }).click();
  await page.locator('.modal .input').fill('测试兽');
  await page.getByText('投放到世界').click();
  const land = await page.evaluate(() => {
    const g = window.__myriad.game, w = g.world;
    for (let c = 0; c < w.N; c++) { const x = c % w.W, y = (c / w.W) | 0; if (w.elev[c] > w.seaLevel + 0.03 && w.baseTemp[c] > 5 && w.baseTemp[c] < 25 && x > 20 && y > 20) { g.R.cam.x = x; g.R.cam.y = y; return { x: x + 0.5, y: y + 0.5 }; } }
  });
  await page.waitForTimeout(100);
  const [sx, sy] = await toScreen(page, land.x, land.y);
  await page.mouse.click(sx, sy);
  expect(await page.evaluate(() => window.__myriad.game.world.species.some((s) => s.name === '测试兽' && s.pop > 0))).toBe(true);
  check();
});

test('help, codex, settings and climate dialogs open and close', async ({ page }) => {
  const check = watchErrors(page);
  await openWorld(page);
  await page.keyboard.press('Shift+Slash');
  await expect(page.locator('.modal')).toContainText('你没有名字');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
  await page.locator('#btn-codex').click();
  await expect(page.locator('.ach').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#btn-settings').click();
  await expect(page.locator('.modal')).toContainText('这个世界的规则');
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  await expect(page.locator('.modal')).toContainText('二氧化碳');
  check();
});

test('phone layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorld(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
