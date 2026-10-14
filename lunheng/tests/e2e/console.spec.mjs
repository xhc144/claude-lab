import { test, expect } from '@playwright/test';

const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT || 18849}`;
const KEYS = { openai: 'sk-mock-openai-0123456789', anthropic: 'sk-ant-mock-0123456789', gemini: 'AIza-mock-0123456789' };

test('register → configure gateway → run a five-model study → read the report', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/');
  await page.locator('.tabs button', { hasText: '注册' }).click();
  await page.fill('input[name=username]', 'e2e');
  await page.fill('input[name=password]', 'e2e-password-123');
  await page.click('button[type=submit]');
  await expect(page.locator('h1', { hasText: '研究档案' })).toBeVisible();

  // Add one provider through the UI: OpenAI-compatible relay pointing at the mock.
  await page.goto('/#/gateway');
  await page.locator('button', { hasText: '添加服务商' }).click();
  await page.locator('.preset', { hasText: '自定义 · OpenAI 兼容' }).click();
  const dialog = page.locator('.modal');
  await dialog.locator('label.field', { hasText: '名称' }).locator('input').fill('Relay');
  await dialog.locator('label.field', { hasText: 'Base URL' }).locator('input').fill(`${MOCK}/openai/v1`);
  await dialog.locator('label.field', { hasText: 'API Key' }).locator('input').fill(KEYS.openai);
  await dialog.locator('button', { hasText: '添加模型' }).click();
  await dialog.locator('tbody tr').last().locator('input').first().fill('mock-gpt');
  await dialog.locator('button', { hasText: /^添加$/ }).click();
  await expect(page.locator('.prov', { hasText: 'Relay' })).toBeVisible();
  // The key never comes back to the browser.
  await expect(page.locator('.prov', { hasText: 'Relay' })).toContainText('sk-••••6789');
  expect(await page.content()).not.toContain(KEYS.openai);

  // Connection test from the UI.
  await page.locator('.prov', { hasText: 'Relay' }).locator('button', { hasText: '测试连接' }).click();
  await page.locator('.modal button', { hasText: '发送测试请求' }).click();
  await expect(page.locator('.test-out.ok')).toContainText('连接成功');
  await page.keyboard.press('Escape');

  // Remaining providers via the API (one per protocol).
  await page.evaluate(async ({ MOCK, KEYS }) => {
    const me = await (await fetch('/api/auth/me')).json();
    const H = { 'content-type': 'application/json', 'x-csrf-token': me.csrf };
    const add = (b) => fetch('/api/providers', { method: 'POST', headers: H, body: JSON.stringify(b) });
    await add({ presetId: 'custom-anthropic', name: 'Claude mock', vendor: 'Anthropic', baseUrl: `${MOCK}/anthropic`, apiKey: KEYS.anthropic, models: [{ id: 'claude-mock-sonnet', price: { input: 2, output: 10, currency: 'USD' } }] });
    await add({ presetId: 'custom-gemini', name: 'Gemini mock', vendor: 'Google', baseUrl: `${MOCK}/gemini`, apiKey: KEYS.gemini, models: [{ id: 'gemini-mock-pro', price: { input: 1.25, output: 10, currency: 'USD' } }] });
    await add({ presetId: 'ollama', baseUrl: `${MOCK}/ollama`, models: [{ id: 'qwen3:8b' }] });
    await add({ presetId: 'custom-openai', name: 'DeepSeek mock', vendor: 'DeepSeek', baseUrl: `${MOCK}/openai/v1`, apiKey: KEYS.openai, models: [{ id: 'mock-reasoner', price: { input: 2, output: 3, currency: 'CNY' } }] });
  }, { MOCK, KEYS });

  // Wizard.
  await page.goto('/#/new');
  await page.locator('.samples button', { hasText: '欧拉多项式' }).click();
  await expect(page.locator('.preview-math .katex').first()).toBeVisible();
  await page.locator('.steps .s').nth(1).click();
  await expect(page.locator('.team-row')).toHaveCount(5);
  await page.locator('button', { hasText: '创建并开始研究' }).click();
  await expect(page).toHaveURL(/#\/s\//);

  // Live console → completion.
  await expect(page.locator('.cbar button', { hasText: '查看报告' })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.cbar .chip.status')).toContainText('C0 已证伪');
  await page.locator('.stage-tabs button', { hasText: '断言账本' }).click();
  await expect(page.locator('.claim').filter({ has: page.locator('.ch .kind', { hasText: /^反例$/ }) }).locator('.ch .chip.status')).toContainText('已证明');
  await page.locator('.stage-tabs button', { hasText: '论证图谱' }).click();
  await expect(page.locator('.graph canvas')).toBeVisible();
  await page.locator('.stage-tabs button', { hasText: '共识演化' }).click();
  await expect(page.locator('.cons svg').first()).toBeVisible();
  await page.locator('.stage-tabs button', { hasText: '研究报告' }).click();
  await expect(page.locator('.report')).toContainText('主命题已被证伪');
  await expect(page.locator('.report')).toContainText('一、已证明的结论');
  await page.locator('.stage-tabs button', { hasText: '调用遥测' }).click();
  await expect(page.locator('.tele table.data').first()).toContainText('claude-mock-sonnet');

  expect(errors).toEqual([]);
});
