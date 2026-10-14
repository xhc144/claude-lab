import { test, expect } from '@playwright/test';
import { watchErrors, open, go, waitRoute, ROUTES } from './helpers.mjs';

test('every page mounts from the rail without errors', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'overview');
  await expect(page.locator('.page-title')).toContainText('林知远');
  for (const r of ROUTES.slice(1)) {
    await page.locator(`.rail [data-route="${r}"]`).click();
    await waitRoute(page, r);
    await expect(page.locator(`.rail [data-route="${r}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.page-head h1')).toBeVisible();
  }
  check();
});

test('live data streams and can be paused', async ({ page }) => {
  await open(page, 'overview');
  const rps = page.locator('#hero-rps');
  await expect(rps).not.toHaveText('0');
  const first = await rps.textContent();
  await expect.poll(async () => rps.textContent(), { timeout: 6000 }).not.toBe(first);
  await page.locator('#live-btn').click();
  await expect(page.locator('#live-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1200);
  const frozen = await rps.textContent();
  await page.waitForTimeout(1600);
  await expect(rps).toHaveText(frozen);
  await page.keyboard.press('l');
  await expect(page.locator('#live-btn')).toHaveAttribute('aria-pressed', 'true');
});

test('chart hover shows a tooltip read-out', async ({ page }) => {
  await open(page, 'usage');
  const svg = page.locator('#u-vol .viz-svg');
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page.locator('.viz-tip.on')).toContainText('次');
});

test('command palette searches and navigates', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'overview');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#pal-q')).toBeFocused();
  await page.keyboard.type('Nebulos Coder');
  await expect(page.locator('.pal-i.on')).toContainText('Nebulos Coder 3');
  await page.keyboard.press('Enter');
  await waitRoute(page, 'models/nebulos-coder-3');
  await expect(page.locator('.drawer')).toContainText('nebulos-coder-3');
  await page.keyboard.press('Escape');
  await expect(page.locator('.layer')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/models$/);
  // G then J jumps to training jobs
  await page.locator('body').click({ position: { x: 700, y: 120 } });
  await page.keyboard.press('g');
  await page.keyboard.press('j');
  await waitRoute(page, 'jobs');
  check();
});

test('create an API key: validation, one-time secret, list update', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'keys');
  const before = await page.locator('.krow').count();
  await page.locator('#new-key').click();
  await waitRoute(page, 'keys/new');
  await page.locator('#ck-submit').click();
  await expect(page.locator('#ck-name-h')).toContainText('至少 2 个字符');
  await page.locator('#ck-name').fill('生产 · 推荐系统');
  await page.locator('[data-scope="embed"]').click();
  await page.locator('#ck-submit').click();
  await expect(page.locator('.secret #sec-v')).toHaveText(/^sk-tsr-[0-9a-f]{40}$/);
  await page.locator('.secret [data-x]').click();
  await expect(page.locator('.krow')).toHaveCount(before + 1);
  await expect(page.locator('.krow').first()).toContainText('生产 · 推荐系统');
  // disable it, then undo from the toast
  await page.locator('.krow').first().locator('.switch').click();
  await expect(page.locator('.krow').first()).toHaveClass(/off/);
  await page.locator('.toast .t-act').first().click();
  await expect(page.locator('.krow').first()).not.toHaveClass(/off/);
  check();
});

test('marketplace filters, favourites and the streaming playground', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'models');
  await page.locator('[data-cat="code"]').click();
  await expect(page.locator('.mcard')).toHaveCount(1);
  await page.locator('[data-cat="all"]').click();
  await page.locator('#m-q').fill('voice');
  await expect(page.locator('.mcard')).toHaveCount(1);
  await expect(page.locator('.mcard')).toContainText('Corvid Voice 2');
  const fav = page.locator('.mcard [data-fav]');
  const was = await fav.getAttribute('aria-pressed');
  await fav.click();
  await expect(fav).toHaveAttribute('aria-pressed', was === 'true' ? 'false' : 'true');
  await page.locator('#m-q').fill('');
  await page.locator('.mcard[data-id="tensora-swift"]').click();
  await waitRoute(page, 'models/tensora-swift');
  await page.locator('[data-tab="price"]').click();
  await page.locator('#calc-in').fill('1000');
  await expect(page.locator('#calc-total')).toHaveText(/¥[\d,]+/);
  await page.locator('[data-tab="code"]').click();
  await page.locator('#code-lang [data-value="py"]').click();
  await expect(page.locator('#code-box pre')).toContainText('from openai import OpenAI');
  await page.locator('#md-try').click();
  await page.locator('#pg-send').click();
  await expect(page.locator('.msg.ai .ai-t')).toContainText('混合专家', { timeout: 8000 });
  await expect(page.locator('#pg-tok')).not.toHaveText('0');
  check();
});

test('training wizard estimates, validates VRAM and launches a job', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'training');
  await page.locator('[data-base="nebulos-moe-120b"]').click();
  for (let i = 0; i < 2; i++) await page.locator('#wz-next').click();
  await page.locator('#method [data-value="full"]').click();
  await page.locator('#wz-next').click();
  await page.locator('#gpus [data-value="8"]').click();
  await expect(page.locator('#estimate')).toContainText('显存不足');
  await page.locator('#wz-next').click();
  await expect(page.locator('#wz-next')).toBeDisabled();
  await page.locator('[data-step="3"]').click();
  await page.locator('#gpus [data-value="64"]').click();
  await expect(page.locator('#estimate')).toContainText('显存充足');
  await page.locator('#wz-next').click();
  await page.locator('#job-name').fill('端到端测试任务');
  await page.locator('#wz-next').click();
  await page.waitForFunction(() => window.__tensora?.page === 'jobs' && window.__tensora.params.length === 1);
  await expect(page.locator('.jd-head h2')).toHaveText('端到端测试任务');
  await expect(page.locator('.jd-head .pill')).toContainText(/排队中|运行中/);
  await expect(page.locator('.jd-head .pill').first()).toContainText('运行中', { timeout: 8000 });
  check();
});

test('job controls: pause, resume and logs', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'jobs/ft-7f3a');
  await page.locator('[data-a="pause"]').click();
  await expect(page.locator('.jd-head .pill').first()).toContainText('已暂停');
  await page.locator('[data-a="resume"]').click();
  await expect(page.locator('.jd-head .pill').first()).toContainText('运行中');
  await page.locator('[data-tab="logs"]').click();
  await expect(page.locator('#console .ln').first()).toBeVisible();
  check();
});

test('cluster: metric switch, node drawer and drain', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'cluster');
  await expect(page.locator('.gc')).toHaveCount(128);
  await page.locator('#c-metric [data-value="temp"]').click();
  await expect(page.locator('#c-key')).toContainText('°C');
  await page.locator('[data-tab="sg"]').click();
  await expect(page.locator('.node')).toHaveCount(2);
  await page.locator('.node').first().locator('.gc').first().click();
  await waitRoute(page, 'cluster/sg-l40s-01');
  await expect(page.locator('.drawer')).toContainText('NVLink');
  await page.locator('.drawer [data-act="drain"]').click();
  await page.locator('.confirm [data-ok]').click();
  await expect(page.locator('.node').first()).toHaveClass(/status-drain/);
  check();
});

test('billing top-up raises the balance; notifications can be cleared', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'billing');
  const bal = page.locator('.bal b');
  await expect(bal).toHaveText('¥186,420');
  await page.locator('#b-topup').click();
  await page.locator('.amt[data-v="50000"]').click();
  await page.locator('#tp-go').click();
  await expect(bal).toHaveText('¥236,420');
  await page.locator('#notif-btn').click();
  await page.locator('#nt-read').click();
  await expect(page.locator('#notif-badge')).toBeHidden();
  check();
});

test('route changes close open layers and page handlers do not leak', async ({ page }) => {
  const check = watchErrors(page);
  await open(page, 'models/tensora-ultra-2');
  await page.locator('#md-try').click();
  await expect(page.locator('.pg')).toBeVisible();
  await go(page, 'usage');
  await expect(page.locator('.layer')).toHaveCount(0);
  const row = page.locator('#log-body tr[data-id]').first();
  await row.hover();
  const id = await row.getAttribute('data-id');
  await row.click();
  await expect(page.locator('.drawer')).toContainText(id);
  expect(await page.evaluate(() => window.__tensora.page)).toBe('usage');
  check();
});
