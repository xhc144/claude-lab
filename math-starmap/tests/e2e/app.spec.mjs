// The site in a real browser: first visit, search, cards with formulas, saved progress,
// explore mode, learning paths, tours, every animation, and the phone layout.
import { test, expect } from '@playwright/test';

// fail a test on any uncaught error or console error
test.beforeEach(async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  info.errors = errors;
});
test.afterEach(async ({}, info) => { expect(info.errors, 'errors in the page').toEqual([]); });

const skipIntro = (page) => page.addInitScript(() => {
  if (!localStorage.getItem('math-starmap:v1')) localStorage.setItem('math-starmap:v1', JSON.stringify({ introSeen: true }));
});
const card = (page) => page.locator('#card');

test('first visit: the intro, then the map', async ({ page }) => {
  await page.goto('/');
  const intro = page.locator('#intro');
  await expect(intro).not.toHaveClass(/hide/);
  await expect(intro).toContainText('知识星');
  await expect(intro.locator('.intro-stats b').first()).toHaveText(/^\d{3,}$/);
  await page.getByRole('button', { name: '开始探索' }).click();
  await expect(intro).toHaveClass(/hide/);
  await expect(page.locator('#sky')).toBeVisible();
  // a second visit goes straight to the map
  await page.reload();
  await expect(page.locator('#intro')).toHaveClass(/hide/);
});

test('search by pinyin opens a card with typeset formulas', async ({ page }) => {
  await skipIntro(page);
  await page.goto('/');
  await page.keyboard.press('/');
  await page.keyboard.type('taile');
  await expect(page.locator('#top .results')).toContainText('泰勒公式');
  await page.keyboard.press('Enter');
  await expect(card(page)).toHaveClass(/open/);
  await expect(card(page).locator('.card-title')).toHaveText('泰勒公式');
  await expect(card(page).locator('.katex').first()).toBeVisible();
  await expect(card(page).locator('.katex-error')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/n\/taylor-theorem$/);
});

test('favourites and learning status survive a reload', async ({ page }) => {
  await skipIntro(page);
  await page.goto('/#/n/derivative');
  await expect(card(page).locator('.card-title')).toHaveText('导数');
  await card(page).locator('.fav-btn').click();
  await card(page).locator('.status-seg button[data-s="2"]').click();
  await page.reload();
  await expect(card(page).locator('.card-title')).toHaveText('导数');
  await expect(card(page).locator('.fav-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).locator('.status-seg button[data-s="2"]')).toHaveAttribute('aria-pressed', 'true');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('math-starmap:v1')));
  expect(saved.fav).toContain('derivative');
  expect(saved.progress.derivative).toBe(2);
});

test('wiki links inside a card lead to other stars', async ({ page }) => {
  await skipIntro(page);
  await page.goto('/#/n/fourier-series');
  const link = card(page).locator('a.wl').first();
  const id = await link.getAttribute('data-id');
  await link.click();
  await expect(page).toHaveURL(new RegExp(`#/n/${id}$`));
});

test('explore mode unfolds stars without end', async ({ page }) => {
  await skipIntro(page);
  await page.goto('/#/x/derivative');
  await expect(page.locator('#app')).toHaveClass(/mode-explore/);
  const count = () => page.evaluate(() => window.starmap.explorer.items.size);
  const first = await count();
  expect(first).toBeGreaterThan(3);
  await page.getByRole('button', { name: '展开全部' }).click();
  await expect.poll(count).toBeGreaterThan(first);
});

test('a learning path lists every prerequisite before the goal', async ({ page }) => {
  await skipIntro(page);
  await page.goto('/#/learn/clt');
  const steps = page.locator('#drawer .path-steps li');
  await expect(steps.first()).toBeVisible();
  const titles = await steps.locator('.t').allTextContents();
  expect(titles.length).toBeGreaterThan(10);
  expect(titles[titles.length - 1]).toBe('中心极限定理');
  expect(titles.indexOf('函数')).toBeLessThan(titles.indexOf('随机变量'));
});

test('a tour steps from star to star', async ({ page }) => {
  await skipIntro(page);
  await page.goto('/#/tour/completeness');
  const tour = page.locator('#tour');
  await expect(tour).toHaveClass(/on/);
  await expect(tour).toContainText('1 /');
  await tour.getByRole('button', { name: '下一站' }).click();
  await expect(tour).toContainText('2 /');
  await expect(card(page).locator('.card-title')).toHaveText('确界原理');
});

test('every interactive animation mounts and explains itself', async ({ page }) => {
  test.setTimeout(240_000);
  await skipIntro(page);
  await page.goto('/');
  const pairs = await page.evaluate(() => { const m = new Map(); for (const n of window.STARMAP_GRAPH.nodes) if (n.an && !m.has(n.an)) m.set(n.an, n.id); return [...m]; });
  expect(pairs.length).toBeGreaterThanOrEqual(37);
  for (const [anim, id] of pairs) {
    await page.evaluate((id) => { location.hash = `#/n/${id}`; }, id);
    const box = card(page).locator('.anim-box');
    await box.scrollIntoViewIfNeeded();
    await expect(box.locator('canvas'), anim).toBeVisible();
    await expect(box.locator('.ax-readout'), anim).not.toBeEmpty();
    await expect(box.locator('.katex-error'), anim).toHaveCount(0);
  }
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the card is a bottom sheet and nothing overflows sideways', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/#/n/gauss-bonnet');
    await expect(card(page).locator('.card-title')).toHaveText('高斯-博内定理');
    const box = await card(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y).toBeGreaterThan(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
