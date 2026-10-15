// Hover / hit-area audit: launches the app against the local test server and checks that close buttons and
// toolbar buttons receive the pointer where they are drawn, that nothing sits under the native window buttons,
// and that the reader's close button lines up with the window's close button. Also grabs the real X screen
// (including the native title-bar buttons) when ImageMagick's `import` is available.
//
//   xvfb-run -a node tests/e2e/hover-audit.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright-core';
import { startMailServer } from '../../scripts/test-server/mail-server.mjs';
import { seed } from './seed.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'tests/e2e/screenshots');
fs.mkdirSync(out, { recursive: true });

const srv = await startMailServer({ imapPort: 32143, imapsPort: 32993, smtpPort: 32587, smtpsPort: 32465 });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'hy-audit-'));
let app;
const problems = [];
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) problems.push(msg); };
try {
  await seed(srv);
  app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--lang=zh-CN'], env: { ...process.env, HY_USER_DATA: userData } });
  const win = await app.firstWindow();
  await win.waitForSelector('.welcome', { timeout: 20000 });
  await win.evaluate((p) => window.hy.invoke('addAccount', {
    email: 'alice@hy.test', displayName: 'Alice', providerId: null, imap: { host: '127.0.0.1', port: p.imaps, security: 'tls' },
    smtp: { host: '127.0.0.1', port: p.smtps, security: 'tls' }, username: 'alice@hy.test', authType: 'password', password: 'alice-pass', allowInsecureTls: true
  }), srv.ports);
  await win.reload();
  await win.waitForSelector('.row:not(.is-skeleton)', { timeout: 30000 });
  await win.locator('.row', { hasText: 'Q4 产品路线图' }).click();
  await win.waitForSelector('.email-frame');

  const geo = await win.evaluate(() => {
    const wco = navigator.windowControlsOverlay;
    const r = wco?.visible ? wco.getTitlebarAreaRect() : null;
    const controlsW = r ? window.innerWidth - (r.x + r.width) : null;
    const close = [...document.querySelectorAll('.reader-toolbar .icon-btn')].pop().getBoundingClientRect();
    const main = document.querySelector('.main').getBoundingClientRect();
    const topbar = document.querySelector('.topbar').getBoundingClientRect();
    return { visible: !!wco?.visible, rect: r && { x: r.x, y: r.y, w: r.width, h: r.height }, controlsW, W: window.innerWidth, closeCenter: close.left + close.width / 2, closeTop: close.top, main: { top: main.top, right: main.right }, topbarH: topbar.height };
  });
  console.log('geometry', JSON.stringify(geo));
  if (geo.visible) {
    check(geo.rect.h === 46 && geo.topbarH === 46, `title-bar overlay (${geo.rect.h}px) and top bar (${geo.topbarH}px) are the same height`);
    check(geo.main.top === 0 && geo.main.right === geo.W, 'the main sheet is flush with the window corner under the native buttons');
    const wcoClose = geo.W - geo.controlsW / 6;
    check(Math.abs(geo.closeCenter - wcoClose) <= 2, `reader close button centred under the window close button (${geo.closeCenter.toFixed(1)} vs ${wcoClose.toFixed(1)})`);
    check(geo.closeTop >= geo.rect.h, 'reader toolbar starts below the native buttons');
  } else console.log('  (window controls overlay not visible on this platform)');

  // Every target must be the element actually under the pointer at its centre, and show its hover background.
  const hoverCheck = async (selector, label) => {
    const el = win.locator(selector).first();
    await el.waitFor();
    await win.waitForTimeout(500); // let enter animations settle
    // reach it the way a person does: over its parent first (reveals hover toolbars), then onto the button
    const parentBox = await el.evaluate((n) => { const r = n.parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await win.mouse.move(parentBox.x + 4, parentBox.y + parentBox.height / 2);
    await win.waitForTimeout(300);
    const box = await el.boundingBox();
    await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await win.waitForTimeout(250);
    const r = await el.evaluate((node, b) => {
      const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { hit: node === hit || node.contains(hit), hover: node.matches(':hover'), bg: getComputedStyle(node).backgroundColor, at: hit ? hit.className || hit.tagName : null };
    }, box);
    const underControls = geo.visible && box.y < geo.rect.h && box.x + box.width > geo.W - geo.controlsW;
    check(r.hit && r.hover && !underControls && r.bg !== 'rgba(0, 0, 0, 0)', `${label}: hit-test ${r.hit}${r.hit ? '' : ` (${r.at})`}, :hover ${r.hover}, background ${r.bg}${underControls ? ', UNDER WINDOW BUTTONS' : ''}`);
  };
  await hoverCheck('.reader-toolbar .icon-btn[aria-label="关闭"]', 'reader close');
  await hoverCheck('.row .row-actions .icon-btn', 'row hover action');
  await win.screenshot({ path: path.join(out, 'audit-reader-close-hover.png') });
  try { execFileSync('import', ['-window', 'root', path.join(out, 'audit-screen.png')], { env: process.env, stdio: 'ignore' }); } catch { /* no X grab */ }

  await win.keyboard.press('Control+,');
  await win.waitForSelector('.settings');
  await hoverCheck('.modal-close', 'settings dialog close');
  await win.keyboard.press('Escape');

  await win.locator('.compose-btn').click();
  await win.waitForSelector('.composer');
  await hoverCheck('.composer-head-actions .icon-btn:last-child', 'composer close');
  await win.locator('.composer-head-actions .icon-btn').nth(-2).click();
  await win.waitForTimeout(400);
  const maxed = await win.locator('.composer.is-max').count();
  if (maxed) {
    await hoverCheck('.composer.is-max .composer-head-actions .icon-btn:last-child', 'maximised composer close');
    await win.screenshot({ path: path.join(out, 'audit-composer-max.png') });
  }
  await win.keyboard.press('Escape');

} catch (e) {
  problems.push(String(e.stack || e));
  console.error(e);
} finally {
  await app?.close().catch(() => {});
  await srv.stop();
  fs.rmSync(userData, { recursive: true, force: true });
  console.log(problems.length ? `\n${problems.length} problem(s)` : '\nno problems');
  process.exit(problems.length ? 1 : 0);
}
