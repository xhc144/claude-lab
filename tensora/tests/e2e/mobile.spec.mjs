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
