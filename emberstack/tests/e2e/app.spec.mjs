import { test, expect } from '@playwright/test';

const APP = process.env.EMBER_APP || '/index.html';

async function open(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_NAME|fonts/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(APP);
  await expect(page.locator('.logo')).toHaveText('薪火纪');
  return errors;
}

test('title screen runs a live AI demo behind the menu', async ({ page }) => {
  const errors = await open(page);
  await page.waitForTimeout(1500);
  const demo = await page.evaluate(() => {
    const a = window.__emberstack;
    return { cards: Object.keys(a.g.s.cards).length, inGame: a.inGame, ai: a.brain.stats.actions };
  });
  expect(demo.inGame).toBe(false);
  expect(demo.cards).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test('the player can drag a survivor onto a tree to chop wood', async ({ page }) => {
  const errors = await open(page);
  await page.getByText('开始战役').click();
  await page.locator('button.lvl').first().click();
  await page.getByText('亲自开始').click();
  await page.waitForTimeout(800);
  const pos = await page.evaluate(() => {
    const { g, view: v } = window.__emberstack;
    const find = (d) => Object.values(g.s.cards).find((c) => c.d === d);
    const s = v.views.get(find('survivor').id), t = v.views.get(find('tree').id);
    return { a: v.worldToScreen(s.x + 55, s.y + 70), b: v.worldToScreen(t.x + 55, t.y + 70) };
  });
  await page.mouse.move(pos.a.x, pos.a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(pos.a.x + ((pos.b.x - pos.a.x) * i) / 10, pos.a.y + ((pos.b.y - pos.a.y) * i) / 10);
  await page.mouse.up();
  await page.waitForTimeout(600);
  const tasks = await page.evaluate(() => Object.values(window.__emberstack.g.s.stacks).filter((s) => s.task).map((s) => s.task.r));
  expect(tasks).toContain('harvest_tree');
  const acts = await page.evaluate(() => window.__emberstack.g.s.stats.actions.player);
  expect(acts).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the AI plays the first level to victory on its own', async ({ page }) => {
  const errors = await open(page);
  await page.getByText('观看 AI 从零建设文明').click();
  await page.keyboard.press('5');
  await expect.poll(async () => page.evaluate(() => window.__emberstack.g.s.result), { timeout: 90000, intervals: [1000] }).toBe('win');
  const st = await page.evaluate(() => window.__emberstack.g.s.stats.actions);
  expect(st.ai).toBeGreaterThan(10);
  expect(st.player || 0).toBe(0);
  await expect(page.locator('.result-title')).toHaveText('胜利', { timeout: 8000 });
  expect(errors).toEqual([]);
});

test('taking over and handing back control', async ({ page }) => {
  await open(page);
  await page.getByText('观看 AI 从零建设文明').click();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__emberstack.aiOn)).toBe(true);
  // a manual action takes over
  await page.evaluate(() => {
    const a = window.__emberstack;
    const c = Object.values(a.g.s.cards).find((x) => x.d === 'survivor');
    a.playerAct(() => a.g.actMove(c.id, 300, 300));
  });
  expect(await page.evaluate(() => window.__emberstack.aiOn)).toBe(false);
  await expect(page.getByText('交还给 AI')).toBeVisible();
  await page.getByText('交还给 AI').click();
  expect(await page.evaluate(() => window.__emberstack.aiOn)).toBe(true);
});

test('tech tree, codex, pause menu and settings open', async ({ page }) => {
  const errors = await open(page);
  await page.getByText('开始战役').click();
  await page.locator('button.lvl').first().click();
  await page.getByText('亲自开始').click();
  await page.getByText('关闭教程').click();
  await page.keyboard.press('t');
  await expect(page.locator('.techtree .tech')).toHaveCount(48);
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  await expect(page.getByRole('heading', { name: '图鉴' })).toBeVisible();
  await page.getByRole('button', { name: '配方' }).click();
  await expect(page.locator('.recipe-row').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '暂停' })).toBeVisible();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('an AI expedition starts from the generator', async ({ page }) => {
  const errors = await open(page);
  await page.getByText('远征 · 无尽').first().click();
  await page.getByRole('button', { name: '林海' }).click();
  await page.getByText('交给 AI').click();
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({ id: window.__emberstack.level.id, ai: window.__emberstack.aiOn }));
  expect(info.id).toMatch(/^exp-forest-/);
  expect(info.ai).toBe(true);
  expect(errors).toEqual([]);
});

test('phone layout has no horizontal overflow', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await open(page);
  await page.getByText('观看 AI 从零建设文明').click();
  await page.waitForTimeout(1500);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(390);
  await page.close();
});
