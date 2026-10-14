import { test, expect } from '@playwright/test';
import { watchErrors, open, go, waitRoute, ROUTES } from './helpers.mjs';

test('phone layout: no horizontal scroll, tab bar and more sheet', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'overview');
  await expect(page.locator('.tabbar')).toBeVisible();
  await expect(page.locator('.rail')).toBeHidden();
  for (const r of ROUTES) {
    await go(page, r);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${r} scrolls sideways`).toBeLessThanOrEqual(0);
  }
  await page.locator('#more-btn').click();
  await expect(page.locator('.more-grid')).toBeVisible();
  await page.locator('.more-i[data-route="tokens"]').click();
  await waitRoute(page, 'tokens');
  await expect(page.locator('#m-title')).toHaveText('Token 消耗');
  check();
});

test('dataset preview fits the phone and its close button remains reachable', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'training');
  await page.locator('#ds-grid [data-preview]').first().click();
  await expect(page.locator('.drawer')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector('.drawer');
    const close = panel.querySelector('.lx');
    const body = panel.querySelector('.lb');
    const r = panel.getBoundingClientRect(), c = close.getBoundingClientRect();
    return r.left >= -0.5 && r.right <= innerWidth + 0.5 && c.left >= 0 && c.right <= innerWidth
      && body.scrollWidth <= body.clientWidth;
  })).toBe(true);
  await page.locator('.drawer .lx').click();
  await expect(page.locator('.layer')).toHaveCount(0);
  check();
});
