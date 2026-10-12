// End-to-end checks on the built site, opened straight from disk (file://) the way a visitor who
// downloaded the ZIP would open it.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const URL = pathToFileURL(resolve('dist/index.html')).href;
const SHOTS = resolve('shots/e2e');
mkdirSync(SHOTS, { recursive: true });

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test('boot sequence runs real precomputation and enters silently', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(URL);
  await expect(page.locator('#boot.ready')).toBeVisible({ timeout: 60000 });
  const log = await page.locator('.boot-log').textContent();
  expect(log).toContain('solve z² + w³ = e^{iθ} on S³');
  expect(log).toMatch(/ok\s+\d+\.\d ms/);
  await page.screenshot({ path: `${SHOTS}/boot.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/is-booting/);
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.hero-title .ht').first()).toHaveText('XHC', { timeout: 8000 });
  expect(errors).toEqual([]);
});

test('every instrument mounts and the universe is alive', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(URL + '?skip');
  await page.waitForFunction(() => window.__universe && window.__universe.shape === 'galaxy');
  const types = await page.$$eval('[data-instrument]', (els) => els.map((e) => [e.dataset.instrument, !!e.__inst]));
  expect(types.length).toBe(13);
  for (const [type, ok] of types) expect(ok, type).toBe(true);
  // scrolling into the knot stage morphs the particles into the Milnor fibre
  await page.evaluate(() => { const el = document.getElementById('knot-stage'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + innerHeight * 0.5); });
  await page.waitForFunction(() => window.__universe.shape === 'fiber', null, { timeout: 20000 });
  await expect(page.locator('.kstep.is-on')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('terminal: commands, navigation and the egg counter', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(URL + '?skip');
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(500);
  await page.keyboard.press('/');
  await expect(page.locator('#terminal.open')).toBeVisible();
  const run = async (cmd) => { await page.locator('#term-in').fill(cmd); await page.locator('#term-in').press('Enter'); };
  await run('whoami');
  await expect(page.locator('#term-out')).toContainText('2027 清华大学求真书院数学领军计划');
  await run('fib 12');
  await expect(page.locator('#term-out')).toContainText('F(12) = 144');
  await run('factor 2027');
  await expect(page.locator('#term-out')).toContainText('2027 = 2027');
  await run('monster');
  await expect(page.locator('#term-out')).toContainText('808017424794512875886459904961710757005754368000000000');
  await run('nonsense');
  await expect(page.locator('#term-out')).toContainText('未知命令');
  await page.screenshot({ path: `${SHOTS}/terminal.png` });
  // opening the terminal and fib 12 each unlock an egg
  await expect(page.locator('#egg-count')).toHaveText('02');
  await run('cd 3');
  await expect(page.locator('#terminal.open')).toHaveCount(0, { timeout: 3000 });
  await page.waitForFunction(() => window.__universe.shape === 'fiber' || document.body.className.includes('chapter-dim3'), null, { timeout: 15000 });
  expect(errors).toEqual([]);
});

test('typing 144 and euler on the page, the egg panel lists progress', async ({ page }) => {
  await page.goto(URL + '?skip');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(800);
  await page.keyboard.type('144');
  await page.keyboard.type('euler');
  await expect(page.locator('#egg-count')).toHaveText('02');
  await page.locator('#egg-btn').click();
  await expect(page.locator('#eggs-panel.open')).toBeVisible();
  await expect(page.locator('#eggs-list li.found')).toHaveCount(2);
  await page.screenshot({ path: `${SHOTS}/eggs.png` });
});

test('lab view opens a larger instance with its own controls', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(URL + '?skip');
  await page.locator('[data-instrument="fourier"] [data-expand]').scrollIntoViewIfNeeded();
  await page.locator('[data-instrument="fourier"] [data-expand]').click();
  await expect(page.locator('#lab.open')).toBeVisible();
  await expect(page.locator('#lab .lab-body .ins-controls .chip')).toHaveCount(3);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/lab.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('#lab.open')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('phase portrait accepts typed functions and rejects bad ones', async ({ page }) => {
  await page.goto(URL + '?skip');
  const input = page.locator('.ins-domain .fx-input input');
  await input.scrollIntoViewIfNeeded();
  await input.fill('sin(z)/z');
  await page.waitForTimeout(500);
  await expect(page.locator('.ins-domain .fx-err')).toHaveText('');
  await input.fill('z^2 + window');
  await page.waitForTimeout(500);
  await expect(page.locator('.ins-domain .fx-err')).not.toHaveText('');
  await expect(page.locator('.ins-domain .fx-input')).toHaveClass(/bad/);
});

test('mobile layout has no horizontal overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(URL + '?skip');
  await page.waitForTimeout(1000);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('entering with sound starts the synthesiser', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(URL);
  await expect(page.locator('#boot.ready')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('#sound-btn')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
  await page.locator('#sound-btn').click();
  await expect(page.locator('#sound-btn')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('knot stage: untie three times, slide θ to 12π', async ({ page }) => {
  await page.goto(URL + '?skip');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => { const el = document.getElementById('knot-stage'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + innerHeight * 0.3); });
  await page.waitForTimeout(800);
  for (let k = 0; k < 3; k++) await page.locator('[data-knot="untie"]').click();
  await expect(page.locator('.toast').last()).toContainText('Alexander');
  await page.locator('[data-knot="theta"]').evaluate((el) => { el.value = el.max; el.dispatchEvent(new Event('input')); });
  await expect(page.locator('#egg-count')).toHaveText('02');
});
