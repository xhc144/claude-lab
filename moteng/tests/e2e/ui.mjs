// End-to-end check of the window: live preview, the element toolbar, layout panel and live PDF.
//   xvfb-run -a node tests/e2e/ui.mjs          (screenshots in tests/e2e/screenshots/)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright-core';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../..');
const shots = path.join(root, 'tests/e2e/screenshots');
fs.mkdirSync(shots, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-ui-'));
let failures = 0;
const step = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); } catch (e) { failures++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

const app = await electron.launch({
  executablePath: require('electron'),
  args: [root, '--no-sandbox', `--user-data-dir=${userData}`],
  env: { ...process.env, TECTONIC_CACHE_DIR: process.env.TECTONIC_CACHE_DIR || path.join(root, 'vendor/tectonic/cache') },
});
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
win.on('pageerror', (e) => console.log('    [page error]', e.message));
const shot = (name) => win.screenshot({ path: path.join(shots, `${name}.png`) });

try {
  await step('a DIL page loads into the queue and the preview', async () => {
    await win.waitForFunction(() => typeof window.__motengSelfTestShow === 'function');
    const r = await win.evaluate((p) => window.__motengSelfTestShow([{ input: p }]), path.join(root, 'fixtures/selftest/chatgpt-dil.html'));
    if (!(r.maths > 3)) throw new Error(JSON.stringify(r));
    await win.waitForSelector('#doc .mt-img.mt-dyn img');
    await shot('01-preview');
  });

  await step('clicking an inline formula offers "转为行间公式" and the preview splits the paragraph', async () => {
    const before = await win.locator('#doc .mt-dm').count();
    await win.locator('#doc .mt-m[data-tex="D=X_{i+1}-X_i"]').click();
    await win.waitForSelector('#toolbar:not([hidden])');
    await shot('02-formula-toolbar');
    await win.locator('#toolbar button', { hasText: '转为行间公式' }).click();
    await win.waitForFunction((n) => document.querySelectorAll('#doc .mt-dm').length === n + 1, before);
    if (!(await win.locator('#doc .mt-dm[data-moved]').count())) throw new Error('moved formula not marked');
    if (!(await win.locator('#adjusted').isVisible())) throw new Error('adjustment count not shown');
  });

  await step('the displayed formula can go back inline', async () => {
    await win.locator('#doc .mt-dm[data-moved]').click();
    await win.locator('#toolbar button', { hasText: /转为行内公式|恢复为行内公式/ }).click();
    await win.waitForFunction(() => !document.querySelector('#doc .mt-dm[data-moved]'));
  });

  await step('a heading changes level; a paragraph gets a page break', async () => {
    await win.locator('#doc .mt-h').first().click();
    await win.locator('#toolbar button', { hasText: '3 级' }).click();
    await win.waitForSelector('#doc .mt-h3');
    await win.locator('#doc .mt-p').nth(3).click();
    await shot('03a-paragraph-toolbar');
    console.log('    toolbar', await win.locator('#toolbar').evaluate((t) => ({ hidden: t.hidden, style: t.getAttribute('style'), rect: JSON.stringify(t.getBoundingClientRect()), html: t.innerHTML.slice(0, 200) })));
    await win.locator('#toolbar button', { hasText: '在此前分页' }).click();
    await win.waitForSelector('#doc .mt-pagebreak');
  });

  await step('batch: all inline formulas to display, then back', async () => {
    await win.locator('#panel .sec', { hasText: '公式' }).locator('summary').click({ trial: true }).catch(() => {});
    await win.locator('#panel button', { hasText: '全部 → 行间' }).click();
    await win.waitForTimeout(1500);
    console.log('    left inline', await win.evaluate(() => [...document.querySelectorAll('#doc .mt-m')].map((m) => m.dataset.tex + ' in ' + m.parentElement.className + '/' + m.closest('[data-oid]').parentElement.className).slice(0, 5)));
    await win.waitForFunction(() => document.querySelectorAll('#doc .mt-m').length === 0);
    await shot('03-all-display');
    await win.locator('#panel button', { hasText: '保持原样' }).click();
    await win.waitForFunction(() => document.querySelectorAll('#doc .mt-m').length > 3);
  });

  await step('page settings change the paper in the preview', async () => {
    const w0 = await win.locator('#paper').evaluate((e) => e.offsetWidth);
    await win.locator('#panel summary', { hasText: '页面' }).click();
    await win.locator('#panel button', { hasText: 'A5' }).click();
    await win.waitForFunction((w) => document.querySelector('#paper').offsetWidth < w - 100, w0);
    await win.locator('#panel button', { hasText: 'A4' }).click();
  });

  await step('the PDF tab compiles the same document', async () => {
    await win.locator('#tabs button[data-tab="pdf"]').click();
    await win.waitForFunction(() => /已更新/.test(document.querySelector('#pdf-state').textContent), null, { timeout: 240000 });
    const src = await win.locator('#pdf').getAttribute('src');
    if (!/preview\.pdf/.test(src || '')) throw new Error(`pdf src ${src}`);
    await shot('04-pdf');
    await win.locator('#tabs button[data-tab="layout"]').click();
  });
} finally {
  await app.close();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
