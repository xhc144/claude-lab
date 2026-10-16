#!/usr/bin/env node
// End-to-end check of the desktop editor: launches the real Electron app against a temporary
// library, walks the main workflow, and saves screenshots to out/e2e/.
//   node tests/e2e/gui.mjs [--keep] [--step=name]
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
const outDir = path.join(root, 'out/e2e');
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-e2e-'));
const env = { ...process.env, MOTIF_HOME: path.join(tmp, 'library'), MOTIF_USER_DATA: path.join(tmp, 'userdata') };
delete env.ELECTRON_RUN_AS_NODE;

const results = [];
// Watchdog: a hung step must fail fast with readable output, not sit until the CI job limit.
const watchdog = setTimeout(() => { console.log(`✗ watchdog: no finish after 9 min (last check: ${results.at(-1)?.name || 'none'})`); process.exit(2); }, 9 * 60 * 1000);
watchdog.unref();

const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

const app = await electron.launch({
  executablePath: require('electron'),
  args: [root, ...(process.platform === 'linux' ? ['--no-sandbox', '--use-angle=swiftshader', ...(process.env.DISPLAY ? [] : ['--ozone-platform=headless'])] : [])],
  env, timeout: 60000,
});
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.setViewportSize?.({ width: 1520, height: 940 }).catch(() => {});
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const call = (m, ...a) => page.evaluate(([m, a]) => window.motif.call(m, ...a), [m, a]);

try {
  await page.waitForSelector('.home', { timeout: 30000 });
  check('home renders', true);
  await shot('01-home-empty');

  // template gallery
  await page.click('.hero-card.main');
  await page.waitForSelector('.tpl-grid .tpl');
  await page.waitForTimeout(2500);
  await shot('02-new-project');
  const tplCount = await page.locator('.tpl').count();
  check('template gallery lists templates', tplCount >= 10, `${tplCount} cards`);
  await page.locator('.tpl', { hasText: '产品发布' }).first().click().catch(async () => { await page.locator('.tpl').nth(1).click(); });
  await page.click('.modal-foot .btn.primary');
  await page.waitForSelector('.editor .stage-canvas', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await shot('03-editor');
  const scenes = await page.locator('.scene-item').count();
  check('editor opens with scenes', scenes > 3, `${scenes} scenes`);

  // canvas actually painted (not blank)
  const painted = await page.evaluate(() => {
    const c = document.querySelector('.stage-canvas');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, n = 0; const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 997) { sum += d[i] + d[i + 1] + d[i + 2]; seen.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); n++; }
    return { colors: seen.size, avg: sum / n / 3 };
  });
  check('stage canvas painted', painted.colors > 8, `${painted.colors} colour buckets`);

  // select a block by clicking its overlay, edit its text through the inspector
  await page.locator('.scene-item').nth(1).click();
  await page.waitForTimeout(600);
  const box = page.locator('.ov-box').first();
  await box.click({ force: true });
  await page.waitForSelector('.insp-head .t-name');
  await shot('04-block-selected');
  const ta = page.locator('.insp textarea').first();
  await ta.fill('由 E2E 测试修改的标题');
  await ta.blur();
  await page.waitForTimeout(1200);
  const pid = await page.evaluate(() => JSON.parse(sessionStorage.getItem('motif.route')).id);
  const disk = await call('project.open', pid);
  const hit = JSON.stringify(disk.doc).includes('由 E2E 测试修改的标题');
  check('inspector edit saved to disk via ops', hit, `revision ${disk.doc.meta.revision}`);

  // undo restores
  await page.keyboard.press('Escape');
  await page.click('body', { position: { x: 5, y: 500 } }).catch(() => {});
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(1200);
  const afterUndo = await call('project.open', pid);
  check('undo restores previous text', !JSON.stringify(afterUndo.doc).includes('由 E2E 测试修改的标题'));

  // external change (simulates CLI/AI) is picked up live
  const ext = await call('project.apply', pid, [{ op: 'update_scene', scene: 1, set: { name: '外部修改的场景' } }], { author: 'ai', message: 'e2e external' });
  void ext;
  // project.apply via IPC marks the revision as known; write through the store from Node instead
  const store = await import(pathToFileURL(path.join(root, 'src/core/store/index.js')).href);
  process.env.MOTIF_HOME = env.MOTIF_HOME; process.env.MOTIF_USER_DATA = env.MOTIF_USER_DATA;
  store.editProject(pid, [{ op: 'update_scene', scene: 2, set: { name: 'AI 改的名字' } }], { author: 'ai', message: 'e2e external' });
  await page.waitForTimeout(1500);
  const live = await page.evaluate(() => [...document.querySelectorAll('.scene-item .nm')].map((e) => e.textContent).join('|'));
  check('external (AI/CLI) edit appears live', live.includes('AI 改的名字'), live.slice(0, 80));

  // playback paints frames (regression: the stage froze on its first frame while playing)
  await page.click('.stage-wrap', { position: { x: 6, y: 6 } }).catch(() => {});
  const sig = () => page.evaluate(() => { const c = document.querySelector('.stage-canvas'); const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 499) h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; return h; });
  const playBtn = page.locator('button[title^="播放 / 暂停"]');
  await call('project.open', pid);
  await playBtn.click();
  await page.waitForTimeout(700);
  const f1 = await sig(); await page.waitForTimeout(600); const f2 = await sig(); await page.waitForTimeout(600); const f3 = await sig();
  await playBtn.click();
  await page.waitForTimeout(300);
  check('playback paints moving frames', new Set([f1, f2, f3]).size >= 2, `${f1} ${f2} ${f3}`);

  // explanation pointer: add a step from the block's context menu → document, inspector, timeline
  await page.locator('.scene-item').nth(1).click();
  await page.waitForTimeout(600);
  await page.locator('.ov-box').first().click({ button: 'right', force: true });
  await page.locator('text=讲解标注：圈出').first().click();
  await page.waitForTimeout(1200);
  const guided = await call('project.open', pid);
  const gScene = guided.doc.scenes[1];
  check('pointer step added from block menu', gScene.guide?.steps?.length === 1 && gScene.guide.steps[0].do === 'circle', JSON.stringify(gScene.guide));
  await page.locator('.guide-step textarea').first().fill('这里是重点');
  await page.locator('.guide-step textarea').first().blur();
  await page.waitForTimeout(900);
  await page.locator('.guide-step').first().click({ position: { x: 6, y: 50 } });
  await page.waitForTimeout(1200);
  await shot('04b-guide');
  const gDoc = await call('project.open', pid);
  check('pointer step editable in the scene panel and shown on the timeline', gDoc.doc.scenes[1].guide.steps[0].say === '这里是重点' && (await page.locator('.tl-guide').count()) === 1);

  // add element palette
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.palette .it');
  await shot('05-palette');
  await page.locator('.palette .it', { hasText: '图表' }).first().click();
  await page.waitForTimeout(800);
  await shot('06-chart-added');
  const chartSel = await page.locator('.insp-head .t-name').textContent();
  check('palette inserts a chart and selects it', /图表/.test(chartSel || ''), chartSel);

  // timeline + scene tab
  await page.keyboard.press('Escape');
  await page.locator('.tabs button', { hasText: '场景' }).first().click();
  await page.waitForTimeout(400);
  await shot('07-scene-inspector');
  await page.locator('.tabs button', { hasText: '作品' }).first().click();
  await page.waitForTimeout(400);
  await shot('08-project-inspector');

  // theme gallery
  await page.locator('.titlebar .btn', { hasText: /极光|Aurora|主题|报刊|瑞士/ }).first().click();
  await page.waitForSelector('.theme-card');
  await page.waitForTimeout(6000);
  await shot('09-themes');
  await page.locator('.theme-card').nth(2).click();
  await page.waitForTimeout(800);
  await page.locator('.modal-foot .btn.primary').click();
  const themed = await call('project.open', pid);
  check('theme switch persisted', themed.doc.theme.id !== 'aurora', themed.doc.theme.id);

  // custom theme: derive a full design system from a few tokens, save it to the library, apply it
  await page.locator('.titlebar .btn', { hasText: /瑞士|Swiss|主题/ }).first().click();
  await page.waitForSelector('.theme-card');
  await page.locator('.modal-foot .btn', { hasText: '新建自定义主题' }).click();
  await page.waitForTimeout(2500);
  const nameInput = page.locator('.modal').last().locator('.input').first();
  await nameInput.fill('E2E 品牌主题');
  await nameInput.blur();
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.modal')].pop().querySelectorAll('input[type=color]')[2];
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, '#ff3366'); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(1500);
  await shot('09c-theme-editor');
  await page.locator('.modal-foot .btn.primary', { hasText: '保存并应用' }).click();
  await page.waitForTimeout(1500);
  const custom = await call('project.open', pid);
  const lib = await call('themes.list');
  const mine = lib.user.find((t) => t.name === 'E2E 品牌主题');
  check('custom theme saved to library and applied', !!mine && custom.doc.theme.id === mine.id && mine.palette.accent.toLowerCase().startsWith('#ff3366'), mine?.id);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (await page.locator('.modal').count()) await page.locator('.modal-foot .btn.primary').last().click();

  // presentation mode: full screen, steps scene by scene
  await page.keyboard.press('Escape');
  await page.keyboard.press('F5');
  await page.waitForSelector('.present canvas', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1500);
  await shot('09b-present');
  const presented = await page.evaluate(() => { const c = document.querySelector('.present canvas'); return c && c.width > 0; });
  check('presentation mode renders full screen', presented);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.present', { state: 'detached', timeout: 5000 });

  // AI panel (no provider yet → onboarding)
  await page.locator('.titlebar .btn.ai').click();
  await page.waitForTimeout(400);
  await shot('10-ai-panel');

  // export dialog
  await page.keyboard.press('Control+e');
  await page.waitForSelector('.modal .chip');
  await shot('11-export');
  await page.locator('.modal .chip', { hasText: 'PDF' }).click();
  await page.waitForTimeout(300);
  await page.locator('.modal-foot .btn.primary').click();
  await page.waitForSelector('text=导出完成', { timeout: 120000 });
  await shot('12-export-done');
  check('PDF export from GUI', true);
  await page.locator('.modal-foot .btn.primary').click();

  // history
  await page.locator('.titlebar .ibtn[title="版本历史"]').click();
  await page.waitForSelector('.hist-item');
  await shot('13-history');
  const hist = await page.locator('.hist-item').count();
  check('history lists revisions', hist > 3, `${hist} entries`);
  await page.keyboard.press('Escape');

  // settings → AI models / integrations
  await page.evaluate(() => dispatchEvent(new CustomEvent('motif:settings', { detail: { tab: 'ai' } })));
  await page.waitForSelector('.settings');
  await shot('14-settings-ai');
  await page.locator('.settings nav button', { hasText: 'AI 集成' }).click();
  await page.waitForTimeout(400);
  await shot('15-settings-integrations');
  await page.keyboard.press('Escape');

  // back to library: thumbnail written
  await page.locator('.titlebar .ibtn[title="素材库"]').click();
  await page.waitForSelector('.pcard');
  await page.waitForTimeout(1500);
  await shot('16-home-with-project');
  check('library shows the project', (await page.locator('.pcard').count()) >= 1);
} catch (e) {
  check('workflow', false, e.message.split('\n')[0]);
  await shot('error').catch(() => {});
} finally {
  if (errors.length) console.log('renderer errors:\n  ' + [...new Set(errors)].slice(0, 12).join('\n  '));
  await app.close().catch(() => {});
  if (!process.argv.includes('--keep')) fs.rmSync(tmp, { recursive: true, force: true });
  else console.log('library kept at', tmp);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
