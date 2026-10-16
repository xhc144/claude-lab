import { test, expect } from '@playwright/test';
import { watchErrors, open, canvasStats, APP } from './helpers.mjs';

test.describe('start page and settings', () => {
  test('start page: hero, four live previews, gallery, and navigation', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '');
    await expect(page.locator('.hero-title')).toContainText('MathScape');
    await expect(page.locator('#home-modules .mcard')).toHaveCount(4);
    await expect(page.locator('#home-gallery .gitem')).toHaveCount(9);
    // every preview is computed and drawn (not blank)
    for (let k = 1; k <= 4; k++) {
      await expect.poll(async () => (await canvasStats(page, `#home-modules .mcard:nth-child(${k}) canvas`)).distinct, { timeout: 10000 })
        .toBeGreaterThan(8);
    }
    expect((await canvasStats(page, '.hero-canvas canvas')).distinct).toBeGreaterThan(20);
    // the main column and panel are hidden on the start page
    await expect(page.locator('#stage')).toBeHidden();
    await page.locator('#home-modules .mcard[data-module="threebody"]').click();
    await expect(page.locator('#module-title')).toHaveText('三体运动');
    // 0 returns to the start page, which now offers to continue
    await page.locator('body').click({ position: { x: 5, y: 890 } });
    await page.keyboard.press('0');
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('#home-resume')).toContainText('三体运动');
    await page.locator('#home-resume').click();
    await expect(page.locator('#module-title')).toHaveText('三体运动');
    check();
  });

  test('gallery links open their example; the brand returns home', async ({ page }) => {
    await open(page, '');
    await page.locator('#home-gallery a[href^="#/matrix?m=1,1,1,0"]').click();
    await expect(page.locator('#module-title')).toHaveText('矩阵线性变换');
    await expect(page.locator('#matrix-presets .chip.on')).toHaveText('斐波那契');
    await page.locator('.brand').click();
    await expect(page.locator('#home-modules')).toBeVisible();
    await expect(page.locator('.brand')).toHaveClass(/active/);
  });

  test('turning the start page off reopens the last module', async ({ page }) => {
    await open(page, '#/complex?f=1%2Fz');
    await page.locator('#settings-btn').click();
    await page.locator('#settings-start').uncheck({ force: true });
    await page.keyboard.press('Escape');
    await page.goto(`${APP}`);
    await page.waitForFunction(() => window.__mathscape?.module === 'complex');
    await expect(page.locator('#fz-input')).toHaveValue('1/z');
  });

  test('precision: pill, settings dialog, P shortcut, persistence, ?hp= links', async ({ page }) => {
    const check = watchErrors(page);
    await open(page, '#/matrix');
    await expect(page.locator('#prec-pill')).toHaveText('双精度');
    await page.locator('#prec-pill').click();
    await expect(page.locator('.modal')).toContainText('计算精度');
    await page.locator('#settings-mode button[data-value="high"]').click();
    await expect(page.locator('#prec-pill')).toHaveText('高精度 · 50 位');
    await page.locator('#settings-digits .chip[data-id="100"]').click();
    await expect(page.locator('#prec-pill')).toHaveText('高精度 · 100 位');
    await page.keyboard.press('Escape');
    // remembered across reloads
    await page.reload();
    await page.waitForFunction(() => window.__mathscape?.current != null);
    await expect(page.locator('#prec-pill')).toHaveText('高精度 · 100 位');
    await page.locator('body').click({ position: { x: 5, y: 890 } });
    await page.keyboard.press('p');
    await expect(page.locator('#prec-pill')).toHaveText('双精度');
    // a link with ?hp=20 turns high precision on for whoever opens it
    await open(page, '#/matrix?m=2,0,0,3&hp=20');
    await expect(page.locator('#prec-pill')).toHaveText('高精度 · 20 位');
    await expect(page.locator('#hp-status')).toHaveText('精确 · 20 位');
    check();
  });

  test('panel sections fold and stay folded', async ({ page }) => {
    await open(page, '#/matrix');
    const sec = page.locator('#panel .section').filter({ has: page.locator('.section-title', { hasText: '预设' }) });
    await sec.locator('.section-toggle').click();
    await expect(sec).toHaveClass(/collapsed/);
    await expect(sec.locator('.chips')).toBeHidden();
    await page.reload();
    await page.waitForFunction(() => window.__mathscape?.current != null);
    await expect(page.locator('#panel .section').filter({ has: page.locator('.section-title', { hasText: '预设' }) })).toHaveClass(/collapsed/);
  });

  test('every module works and draws in high precision mode', async ({ page }) => {
    const check = watchErrors(page);
    await page.goto(`${APP}#/`);
    await page.evaluate(() => window.__mathscape.setSettings({ precision: 'high', digits: 50 }));
    for (const [hash, sel] of [['#/matrix', '#stage canvas'], ['#/complex', '#pane-z canvas'], ['#/ode', '#stage canvas'], ['#/ode?mode=3d', '#stage canvas'], ['#/threebody', '#stage canvas:nth-of-type(2)']]) {
      await open(page, hash);
      await expect.poll(async () => (await canvasStats(page, sel)).distinct, { timeout: 15000, message: hash }).toBeGreaterThan(hash.includes('threebody') ? 8 : 40);
    }
    // the three-body integrator starts with the tighter tolerance
    expect((await page.evaluate(() => window.__mathscape.current.state())).rtol).toBe(1e-13);
    check();
  });

  test('mobile: start page has no horizontal overflow and the document scrolls', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const check = watchErrors(page);
    await open(page, '');
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, h: innerHeight }));
    expect(m.sw).toBeLessThanOrEqual(m.w + 1);
    expect(m.sh).toBeGreaterThan(m.h * 2);
    check();
    await page.close();
  });
});
