import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, state } from './helpers.mjs';

test('loads, shows four modules and switches by click, hash and keyboard', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, '');
  await expect(page).toHaveURL(/#\/matrix$/);
  const items = page.locator('.nav-item');
  await expect(items).toHaveCount(4);
  await expect(page.locator('#module-title')).toHaveText('矩阵线性变换');

  await items.nth(1).click();
  await expect(page.locator('#module-title')).toHaveText('复变函数映射');
  await expect(page).toHaveURL(/#\/complex/);

  await page.locator('body').click({ position: { x: 5, y: 890 } });
  await page.keyboard.press('3');
  await expect(page.locator('#module-title')).toHaveText('常微分方程轨线');
  await page.keyboard.press('4');
  await expect(page.locator('#module-title')).toHaveText('三体运动');

  await page.goto('/#/matrix');
  await expect(page.locator('#module-title')).toHaveText('矩阵线性变换');
  check();
});

test('every module draws a non-trivial picture', async ({ page }) => {
  const check = watchErrors(page);
  const cases = [
    ['#/matrix', '#stage canvas'],
    ['#/complex', '#pane-z canvas'],
    ['#/ode', '#stage canvas'],
    ['#/ode?mode=3d', '#stage canvas'],
    ['#/threebody', '#stage canvas:nth-of-type(2)'],
  ];
  for (const [hash, sel] of cases) {
    await open(page, hash);
    await page.waitForTimeout(700);
    const s = await canvasStats(page, sel);
    expect(s.w, hash).toBeGreaterThan(300);
    expect(s.distinct, `${hash}: too few colours, canvas looks blank`).toBeGreaterThan(hash.includes('threebody') ? 8 : 40);
  }
  check();
});

test('help dialog opens with ? and closes with Escape', async ({ page }) => {
  await open(page, '#/threebody');
  await page.keyboard.press('Shift+Slash');
  await expect(page.locator('.modal')).toBeVisible();
  await expect(page.locator('.modal')).toContainText('时间反演');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
  await page.locator('#help-btn').click();
  await expect(page.locator('.modal')).toBeVisible();
});

test('export PNG downloads an image of the current view', async ({ page }) => {
  await open(page, '#/complex');
  await page.waitForTimeout(500);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-btn').click()]);
  expect(download.suggestedFilename()).toBe('mathscape-complex.png');
  const path = await download.path();
  const fs = await import('node:fs');
  const buf = fs.readFileSync(path);
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  expect(buf.length).toBeGreaterThan(20_000);
});

test('state is kept in the URL and restored', async ({ page }) => {
  await open(page, '#/matrix?m=0,-1,1,0');
  await expect(page.locator('#matrix-tags')).toContainText('旋转 90°');
  await open(page, '#/complex?f=1%2Fz');
  await expect(page.locator('#fz-input')).toHaveValue('1/z');
  await open(page, '#/threebody?p=pythagorean');
  await expect(page.locator('#nbody-presets .chip.on')).toHaveText('毕达哥拉斯问题');
});

test('a shared link opened in the same tab applies its state even within the same module', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, '#/ode');
  expect((await state(page)).mode).toBe('2d');
  await open(page, '#/ode?mode=3d&p=rossler');
  expect((await state(page)).mode).toBe('3d');
  expect((await state(page)).preset).toBe('rossler');
  await open(page, '#/matrix?m=1,0,0,1');
  await open(page, '#/matrix?m=0,-1,1,0');
  await expect(page.locator('#matrix-tags')).toContainText('旋转 90°');
  // clicking the nav item of the open module keeps its state
  await page.locator('.nav-item[data-module="matrix"]').click();
  await expect(page.locator('#matrix-tags')).toContainText('旋转 90°');
  check();
});

test('mobile layout: panel stacks under the stage without horizontal overflow', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const check = watchErrors(page);
  for (const hash of ['#/matrix', '#/complex', '#/ode', '#/threebody']) {
    await open(page, hash);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, stage: document.querySelector('#stage').getBoundingClientRect().height, panelTop: document.querySelector('#panel').getBoundingClientRect().top }));
    expect(m.sw, hash).toBeLessThanOrEqual(m.w + 1);
    expect(m.stage).toBeGreaterThan(350);
    expect(m.panelTop).toBeGreaterThan(m.stage);
  }
  check();
  await page.close();
});
