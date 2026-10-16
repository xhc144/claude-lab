// End-to-end test: drives the real Electron app against the local Dovecot/SMTP test server,
// verifying the main user journeys and saving screenshots to tests/e2e/screenshots/.
//
//   npm run test:e2e            (Linux needs a display: wrap with `xvfb-run -a`)
//
// Env: HY_E2E_SCALE=2 for high-DPI screenshots, HY_E2E_ONLY=welcome to stop early.
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
const shotsDir = path.join(root, 'tests/e2e/screenshots');
fs.mkdirSync(shotsDir, { recursive: true });
const scale = Number(process.env.HY_E2E_SCALE || 1);

let failures = 0;
const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push(`  ✓ ${name} (${Date.now() - t0} ms)`);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    results.push(`  ✗ ${name}: ${e.message}`);
    console.log(`  ✗ ${name}\n      ${String(e.stack || e).split('\n').slice(0, 4).join('\n      ')}`);
    throw e;
  }
}

const srv = await startMailServer({ imapPort: 31143, imapsPort: 31993, smtpPort: 31587, smtpsPort: 31465 });
let app;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'hy-e2e-'));
try {
  const n = await seed(srv);
  // Older mail arrives already read, like a real mailbox.
  execFileSync('doveadm', ['-c', srv.confPath, 'flags', 'add', '-u', 'alice@hy.test', '\\Seen', 'mailbox', 'INBOX', 'sentbefore', '1d']);
  console.log(`seeded ${n} messages`);

  app = await electron.launch({
    executablePath: require('electron'),
    args: [root, '--no-sandbox', `--force-device-scale-factor=${scale}`, '--lang=zh-CN'],
    env: { ...process.env, HY_USER_DATA: userData, HY_DEVTOOLS: '1' }
  });
  const win = await app.firstWindow();
  win.on('console', (m) => { if (m.type() === 'error') console.log('    [renderer error]', m.text()); });
  win.on('pageerror', (e) => console.log('    [page error]', e.message));
  const shot = async (name, { keepToasts = false } = {}) => {
    if (!keepToasts) await win.evaluate(() => document.querySelectorAll('.toast-close').forEach((b) => b.click()));
    await win.waitForTimeout(450);
    await win.screenshot({ path: path.join(shotsDir, `${name}.png`) });
  };
  const setTheme = async (theme) => {
    await win.evaluate((t) => window.hy.invoke('updateSettings', { theme: t }), theme);
    await win.waitForTimeout(300);
  };

  await step('first run shows the welcome screen', async () => {
    await win.waitForSelector('.welcome', { timeout: 20000 });
    await shot('01-welcome');
  });
  if (process.env.HY_E2E_ONLY === 'welcome') throw new Error('stop');

  await step('add an account with manual server settings and live diagnostics', async () => {
    await win.getByPlaceholder('name@example.com').fill('alice@hy.test');
    await win.getByPlaceholder('例如：张三').fill('Alice 林');
    await win.getByRole('button', { name: '继续' }).click();
    await win.waitForSelector('.provider-card', { timeout: 30000 });
    const hosts = win.locator('.server-editor .server-row input:not(.port)');
    const ports = win.locator('.server-editor input.port');
    await hosts.nth(0).fill('127.0.0.1');
    await ports.nth(0).fill(String(srv.ports.imaps));
    await hosts.nth(1).fill('127.0.0.1');
    await ports.nth(1).fill(String(srv.ports.smtps));
    await win.locator('.switch-row .switch').click();
    await win.locator('input.pw').fill('alice-pass');
    await shot('02-credentials');
    await win.getByRole('button', { name: '连接' }).click();
    await win.getByRole('heading', { name: '连接成功' }).waitFor({ timeout: 30000 });
    await shot('03-connection-ok');
    await win.getByRole('button', { name: '完成' }).click();
    await win.waitForSelector('.done-badge');
    await shot('04-added');
    await win.getByRole('button', { name: '开始使用' }).click();
  });

  await step('inbox syncs with previews, categories and date groups', async () => {
    await win.waitForSelector('.row:not(.is-skeleton)', { timeout: 30000 });
    await win.waitForFunction(() => document.querySelectorAll('.row:not(.is-skeleton)').length >= 15, null, { timeout: 30000 });
    await win.waitForFunction(() => ![...document.querySelectorAll('.row-snippet')].some((e) => e.querySelector('.skeleton-text')), null, { timeout: 20000 });
    const subjects = await win.locator('.row-subject').allTextContents();
    if (!subjects[0].includes('Q4 产品路线图')) throw new Error('unexpected first message: ' + subjects[0]);
    await shot('05-inbox');
  });

  await step('a wrong password is diagnosed clearly', async () => {
    await win.evaluate(async () => {
      const r = await window.hy.invoke('testConnection', {
        email: 'alice@hy.test', displayName: 'x', providerId: 'qq', imap: { host: '127.0.0.1', port: 31993, security: 'tls' },
        smtp: { host: '127.0.0.1', port: 31465, security: 'tls' }, username: 'alice@hy.test', authType: 'password', password: 'bad', allowInsecureTls: true
      }, 'probe');
      if (!r.ok || r.value.ok || !r.value.diagnosis.title.includes('授权码')) throw new Error(JSON.stringify(r));
    });
  });

  await step('open a conversation, read HTML mail and attachments', async () => {
    await win.locator('.row', { hasText: 'Q4 产品路线图' }).click();
    await win.waitForSelector('.email-frame');
    await win.waitForSelector('.att-card');
    const frame = win.frameLocator('.email-frame');
    await frame.locator('table').waitFor();
    await shot('06-reader-html');
    const atts = await win.locator('.att-name').allTextContents();
    if (!atts.includes('Q4 路线图草案.pdf')) throw new Error('attachments: ' + atts);
  });

  await step('image attachments preview through tokened hy-att URLs only', async () => {
    await win.locator('.row', { hasText: '合同扫描件' }).click();
    await win.waitForFunction(() => { const img = document.querySelector('.att-thumb img'); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 15000 });
    const blocked = await win.evaluate(async () => {
      const src = document.querySelector('.att-thumb img').getAttribute('src');
      const bare = src.split('?')[0];
      const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res('loaded'); i.onerror = () => res('refused'); i.src = u + (u.includes('?') ? '&' : '?') + 'nocache=' + Math.random(); });
      return { ok: await load(src), bad: await load(bare), forged: await load(bare + '?t=0123456789abcdef01234567') };
    });
    if (blocked.ok !== 'loaded' || blocked.bad !== 'refused' || blocked.forged !== 'refused') throw new Error('attachment token check: ' + JSON.stringify(blocked));
    await shot('06b-image-attachment');
    // right-click → copy image puts the picture on the clipboard
    await app.evaluate(({ clipboard }) => clipboard.clear());
    await win.locator('.att-thumb img').click({ button: 'right' });
    await win.locator('.menu-item', { hasText: '复制图片' }).click();
    const t0 = Date.now();
    while (!(await app.evaluate(({ clipboard }) => clipboard.has('image/png')))) {
      if (Date.now() - t0 > 5000) throw new Error('image not copied');
      await win.waitForTimeout(150);
    }
  });

  await step('threads group replies with the original', async () => {
    await win.locator('.row', { hasText: '周五团建' }).first().click();
    await win.waitForFunction(() => document.querySelectorAll('.msg-card').length === 2, null, { timeout: 10000 });
    await shot('07-thread');
  });

  await step('remote images are blocked until allowed', async () => {
    await win.locator('.row', { hasText: '双十一预售' }).click();
    await win.waitForSelector('.remote-banner');
    await shot('08-remote-blocked');
    await win.getByRole('button', { name: '显示图片' }).click();
    await win.waitForSelector('.remote-banner', { state: 'detached' });
  });

  await step('category tabs filter the inbox', async () => {
    await win.locator('.cat-tab', { hasText: '推广' }).click();
    await win.waitForFunction(() => [...document.querySelectorAll('.row-subject')].every((e) => !e.textContent.includes('Q4')));
    const subjects = await win.locator('.row-subject').allTextContents();
    if (!subjects.some((s) => s.includes('双十一'))) throw new Error('promotions: ' + subjects);
    await shot('09-category-promotions');
    await win.locator('.cat-tab', { hasText: '全部' }).click();
  });

  await step('search finds mail by Chinese keyword', async () => {
    await win.keyboard.press('/');
    await win.keyboard.type('合同');
    await win.waitForFunction(() => document.querySelector('.list-title h1')?.textContent === '搜索结果');
    await win.waitForFunction(() => [...document.querySelectorAll('.row-subject')].some((e) => e.textContent.includes('合同扫描件')));
    await shot('10-search');
    await win.keyboard.press('Escape');
    await win.waitForFunction(() => document.querySelector('.list-title h1')?.textContent === '收件箱');
  });

  await step('compose, send through SMTP and undo window', async () => {
    await win.locator('.compose-btn').click();
    await win.waitForSelector('.composer');
    await win.locator('.rcpt-field input').first().fill('bob@hy.test');
    await win.keyboard.press('Enter');
    await win.locator('.subject-field input').fill('来自鸿雁的第一封信');
    await win.locator('.editor').click();
    await win.keyboard.type('Bob 你好，这是用鸿雁邮箱发出的测试邮件。');
    await shot('11-composer');
    await win.keyboard.press('Control+Enter');
    await win.waitForSelector('.toast.is-progress');
    await shot('12-sending-undo', { keepToasts: true });
    const t0 = Date.now();
    while (!srv.delivered.some((d) => d.rcpts.includes('bob@hy.test') && d.raw.toString().includes('Subject:'))) {
      if (Date.now() - t0 > 30000) throw new Error('mail not delivered');
      await win.waitForTimeout(250);
    }
    await win.waitForSelector('.toast.is-success');
  });

  await step('archive with undo', async () => {
    await win.locator('.row', { hasText: '周末一起去爬山' }).click();
    await win.keyboard.press('e');
    await win.waitForSelector('.toast .toast-action');
    await win.waitForFunction(() => ![...document.querySelectorAll('.row-subject')].some((e) => e.textContent.includes('周末一起去爬山')));
    await win.locator('.toast-action', { hasText: '撤销' }).click();
    await win.waitForFunction(() => [...document.querySelectorAll('.row-subject')].some((e) => e.textContent.includes('周末一起去爬山')), null, { timeout: 15000 });
  });

  await step('new mail is pushed via IDLE', async () => {
    const raw = Buffer.from(['From: 陈晨 <chenchen@hy.test>', 'To: alice@hy.test', 'Subject: =?UTF-8?B?' + Buffer.from('刚到的新邮件').toString('base64') + '?=', `Date: ${new Date().toUTCString()}`, 'Message-ID: <push-1@hy.test>', 'Content-Type: text/plain; charset=utf-8', '', 'IDLE push works'].join('\r\n'));
    srv.deliver('alice@hy.test', raw);
    await win.waitForFunction(() => [...document.querySelectorAll('.row-subject')].some((e) => e.textContent.includes('刚到的新邮件')), null, { timeout: 20000 });
  });

  await step('dark theme', async () => {
    await setTheme('dark');
    await win.locator('.row', { hasText: 'Q4 产品路线图' }).click();
    await win.waitForSelector('.att-card');
    await shot('13-dark-reader');
    await win.locator('.row', { hasText: '周五团建' }).first().click();
    await shot('14-dark-thread');
  });

  await step('settings and command palette', async () => {
    await win.keyboard.press('Control+,');
    await win.waitForSelector('.settings');
    await win.locator('.settings-nav-item', { hasText: '外观' }).click();
    await shot('15-dark-settings-appearance');
    await win.keyboard.press('Escape');
    await setTheme('light');
    await win.keyboard.press('Control+,');
    await win.locator('.settings-nav-item', { hasText: '账户' }).click();
    await shot('16-settings-accounts');
    await win.keyboard.press('Escape');
    await win.keyboard.press('Control+k');
    await win.waitForSelector('.palette-input input');
    await win.keyboard.type('星');
    await shot('17-palette');
    await win.keyboard.press('Escape');
  });

  await step('account diagnostics dialog', async () => {
    await win.locator('.acct-head').first().click({ button: 'right' });
    await win.locator('.menu-item', { hasText: '诊断连接' }).click();
    await win.waitForSelector('.diag-ok', { timeout: 30000 });
    await shot('18-diagnose-ok');
    await win.keyboard.press('Escape');
  });

  await step('second account appears in the unified inbox', async () => {
    await win.evaluate(() => window.hy.invoke('addAccount', {
      email: 'bob@hy.test', displayName: 'Bob', providerId: null, imap: { host: '127.0.0.1', port: 31993, security: 'tls' },
      smtp: { host: '127.0.0.1', port: 31465, security: 'tls' }, username: 'bob@hy.test', authType: 'password', password: 'bob-pass', allowInsecureTls: true
    }));
    await win.waitForFunction(() => [...document.querySelectorAll('.row-subject')].some((e) => e.textContent.includes('Lunch tomorrow')), null, { timeout: 30000 });
    await win.locator('.row', { hasText: 'Lunch tomorrow' }).click();
    await shot('19-unified-two-accounts');
  });

  await step('reply quotes the original message', async () => {
    await win.locator('.row', { hasText: 'Q4 产品路线图' }).click();
    await win.keyboard.press('r');
    await win.waitForSelector('.composer .hy-quote');
    await shot('20-reply');
    await win.locator('.composer-head-actions button').last().click();
    await win.waitForSelector('.composer', { state: 'detached' });
  });

  await step('bulk selection and context menu', async () => {
    await win.locator('.row', { hasText: 'GitHub' }).click();
    await win.locator('.row', { hasText: '京东' }).click({ modifiers: ['Control'] });
    await win.locator('.row', { hasText: '招商银行' }).click({ modifiers: ['Control'] });
    await win.waitForSelector('.bulk-panel');
    await shot('21-bulk');
    await win.locator('.row', { hasText: '王芳' }).click({ button: 'right' });
    await win.waitForSelector('.menu');
    await shot('22-context-menu');
    await win.keyboard.press('Escape');
  });

  const clipboard = () => app.evaluate(({ clipboard: cb }) => cb.readText());
  const doveSearch = (user, ...query) => execFileSync('doveadm', ['-c', srv.confPath, 'search', '-u', user, ...query]).toString().trim();
  const until = async (fn, label, timeout = 20000) => {
    const t0 = Date.now();
    while (!(await fn())) {
      if (Date.now() - t0 > timeout) throw new Error('timeout: ' + label);
      await win.waitForTimeout(200);
    }
  };

  await step('sender names, addresses and the message body can be selected and copied', async () => {
    await win.keyboard.press('Escape');
    await win.locator('.row', { hasText: 'GitHub' }).click();
    await win.waitForSelector('.email-frame');
    const frame = win.frameLocator('.email-frame');
    await frame.locator('blockquote').waitFor();
    if (await win.evaluate(() => getComputedStyle(document.querySelector('.mc-name')).userSelect) !== 'text') throw new Error('sender name not selectable');
    // double-click selects the address (and must not collapse the message)
    await win.locator('.mc-addr').dblclick({ position: { x: 12, y: 6 } });
    const sel = await win.evaluate(() => window.getSelection().toString());
    if (!sel.includes('notifications')) throw new Error('selection: ' + sel);
    if (await win.locator('.msg-card.is-collapsed').count()) throw new Error('header click collapsed the message');
    await win.locator('.mc-name').click({ button: 'right' });
    await win.locator('.menu-item', { hasText: '复制邮箱地址' }).click();
    await until(async () => (await clipboard()) === 'notifications@github.com', 'address copied');
    // right-click a link inside the e-mail
    await frame.locator('a', { hasText: 'View it on GitHub' }).click({ button: 'right' });
    await win.waitForSelector('.menu-item');
    await shot('29-link-context-menu');
    await frame.locator('body').press('Escape');
    await win.waitForSelector('.menu', { state: 'detached' });
    if (await win.locator('.reader-pane .msg-card').count() === 0) throw new Error('Escape in the menu also closed the message');
    await frame.locator('a', { hasText: 'View it on GitHub' }).click({ button: 'right' });
    await win.locator('.menu-item', { hasText: '复制链接地址' }).click();
    await until(async () => (await clipboard()) === 'https://github.com/hongyan/mail/pull/128', 'link copied');
    // select body text and copy it from the context menu
    await frame.locator('blockquote').evaluate((el) => { const d = el.ownerDocument; const r = d.createRange(); r.selectNodeContents(el); d.getSelection().removeAllRanges(); d.getSelection().addRange(r); });
    await frame.locator('blockquote').click({ button: 'right' });
    await win.locator('.menu-item', { hasText: /^复制/ }).first().click();
    await until(async () => (await clipboard()).includes('新增独立的 IDLE 连接'), 'body text copied');
    // hovering a link shows its address next to the link, not over the bottom of the message
    await frame.locator('a', { hasText: 'View it on GitHub' }).hover();
    await win.waitForSelector('.link-peek');
    const pos = await win.evaluate(() => {
      const f = document.querySelector('.email-frame').getBoundingClientRect();
      const a = document.querySelector('.email-frame').contentDocument.querySelector('a').getBoundingClientRect();
      const p = document.querySelector('.link-peek').getBoundingClientRect();
      return { linkBottom: f.top + a.bottom, peekTop: p.top, text: document.querySelector('.link-peek').textContent };
    });
    if (!pos.text.includes('github.com/hongyan/mail/pull/128') || pos.peekTop < pos.linkBottom || pos.peekTop - pos.linkBottom > 20) throw new Error('link peek: ' + JSON.stringify(pos));
    await shot('30-link-peek');
    await win.mouse.move(5, 300);
  });

  await step('text fields have a cut / copy / paste menu', async () => {
    await app.evaluate(({ clipboard: cb }) => cb.writeText('团建'));
    const search = win.getByPlaceholder('搜索邮件、联系人、附件…');
    await search.click({ button: 'right' });
    await win.waitForSelector('.menu-item');
    await shot('31-input-context-menu');
    await win.locator('.menu-item', { hasText: '粘贴' }).first().click();
    await win.waitForFunction(() => document.querySelector('.search input').value === '团建');
    await win.waitForFunction(() => document.querySelector('.list-title h1')?.textContent === '搜索结果');
    await search.press('Escape');
    await win.waitForFunction(() => document.querySelector('.list-title h1')?.textContent === '收件箱');
  });

  await step('blocking a sender moves their mail to Junk on the server, including new mail', async () => {
    await win.locator('.row', { hasText: '京东' }).click({ button: 'right' });
    await win.locator('.menu-item', { hasText: '屏蔽此发件人' }).click();
    await win.waitForSelector('.choice');
    await win.locator('.choice', { hasText: '整个域名' }).click();
    await shot('32-block-sender');
    await win.getByRole('button', { name: '屏蔽', exact: true }).click();
    await win.waitForFunction(() => ![...document.querySelectorAll('.row')].some((e) => e.textContent.includes('京东')));
    await until(() => doveSearch('alice@hy.test', 'mailbox', 'Junk', 'from', 'jd.example') !== '', 'moved to Junk on the server');
    if (doveSearch('alice@hy.test', 'mailbox', 'INBOX', 'from', 'jd.example') !== '') throw new Error('still in INBOX on the server');
    const raw = Buffer.from(['From: 京东 <deals@jd.example>', 'To: alice@hy.test', 'Subject: =?UTF-8?B?' + Buffer.from('京东 秒杀返场').toString('base64') + '?=', `Date: ${new Date().toUTCString()}`, 'Message-ID: <jd-2@jd.example>', 'Content-Type: text/plain; charset=utf-8', '', 'buy'].join('\r\n'));
    srv.deliver('alice@hy.test', raw);
    await until(() => doveSearch('alice@hy.test', 'mailbox', 'Junk', 'header', 'Message-ID', 'jd-2@jd.example') !== '', 'new mail from the blocked domain moved to Junk');
    await win.waitForTimeout(600);
    if (await win.locator('.row', { hasText: '秒杀返场' }).count()) throw new Error('blocked mail shown in the inbox');
    // junk never shows an unread counter
    const junkCount = await win.locator('.acct-folders .nav-item', { hasText: '垃圾邮件' }).locator('.nav-count').count();
    if (junkCount) throw new Error('junk folder shows an unread count');
    await win.keyboard.press('Control+,');
    await win.locator('.settings-nav-item', { hasText: '垃圾邮件' }).click();
    await win.locator('.set-row-title', { hasText: '@jd.example' }).waitFor();
    if (await win.locator('.mc-addr', { hasText: 'jd.example' }).count()) throw new Error('reader still shows the blocked message');
    await shot('33-settings-junk');
    await win.keyboard.press('Escape');
  });

  await step('compact density, collapsed sidebar and empty states', async () => {
    await win.evaluate(() => window.hy.invoke('updateSettings', { density: 'compact', sidebarCollapsed: true }));
    await win.locator('.row', { hasText: '李娜' }).first().click();
    await shot('23-compact-collapsed');
    await win.evaluate(() => window.hy.invoke('updateSettings', { density: 'comfortable', sidebarCollapsed: false }));
    await win.locator('.nav-item', { hasText: '星标' }).first().click();
    await win.waitForSelector('.empty-state');
    await shot('24-empty-starred');
    await win.locator('.nav-item', { hasText: '收件箱' }).first().click();
  });

  await step('account errors surface in the sidebar with a diagnosis', async () => {
    const bobId = await win.evaluate(async () => (await window.hy.invoke('listAccounts')).value.find((a) => a.email === 'bob@hy.test').id);
    await win.evaluate((id) => window.hy.invoke('updateAccount', id, { credentials: { authType: 'password', password: 'wrong-password' } }), bobId);
    await win.waitForSelector('.acct-error', { timeout: 30000 });
    await shot('25-account-error');
    await win.locator('.acct-error').click();
    await win.waitForSelector('.diag-card', { timeout: 30000 });
    await shot('26-diagnose-auth-failure');
    await win.keyboard.press('Escape');
    await win.evaluate((id) => window.hy.invoke('updateAccount', id, { credentials: { authType: 'password', password: 'bob-pass' } }), bobId);
  });

  await step('failed sends wait in the outbox with the reason', async () => {
    const aliceId = await win.evaluate(async () => (await window.hy.invoke('listAccounts')).value.find((a) => a.email === 'alice@hy.test').id);
    await win.evaluate((id) => window.hy.invoke('updateAccount', id, { smtp: { host: '127.0.0.1', port: 1, security: 'tls' } }), aliceId);
    await win.evaluate((id) => window.hy.invoke('send', { accountId: id, to: [{ name: 'Bob', address: 'bob@hy.test' }], cc: [], bcc: [], subject: '会议纪要（待发送）', html: '<p>x</p>', attachments: [] }, Date.now()), aliceId);
    await win.waitForSelector('.toast.is-error', { timeout: 30000 });
    await win.locator('.nav-item', { hasText: '发件箱' }).click();
    await win.waitForSelector('.outbox-item.is-failed');
    await shot('27-outbox-failed');
    await win.evaluate((id) => window.hy.invoke('updateAccount', id, { smtp: { host: '127.0.0.1', port: 31465, security: 'tls' } }), aliceId);
    await win.getByRole('button', { name: '重试' }).click();
    await win.waitForSelector('.outbox-item', { state: 'detached', timeout: 30000 });
  });

  await step('OAuth settings explain the one-time setup', async () => {
    await win.keyboard.press('Control+,');
    await win.locator('.settings-nav-item', { hasText: 'OAuth' }).click();
    await shot('28-settings-oauth');
    await win.keyboard.press('Escape');
  });

  await step('mark everything read, select all and delete, then empty the trash — on the server', async () => {
    await win.locator('.nav-item', { hasText: '收件箱' }).first().click();
    await win.waitForSelector('.row:not(.is-skeleton)');
    await win.locator('.list-tools .icon-btn[aria-label="全部标为已读"]').click();
    await until(() => doveSearch('alice@hy.test', 'mailbox', 'INBOX', 'unseen') === '', 'INBOX read on the server');
    await win.waitForFunction(() => !document.querySelector('.nav-group .nav-item .nav-count'));
    await win.locator('.row').first().click();
    await win.keyboard.press('Control+a');
    await win.waitForSelector('.bulk-panel');
    await shot('34-select-all');
    await win.locator('.bulk-actions button', { hasText: '删除' }).click();
    await win.waitForSelector('.empty-state', { timeout: 20000 });
    await until(() => doveSearch('alice@hy.test', 'mailbox', 'INBOX', 'all') === '', 'INBOX empty on the server');
    if (doveSearch('alice@hy.test', 'mailbox', 'Trash', 'all') === '') throw new Error('deleted mail did not go to Trash');
    await win.locator('.acct-folders .nav-item', { hasText: '已删除' }).first().click({ button: 'right' });
    await win.locator('.menu-item', { hasText: '清空已删除' }).click();
    await win.getByRole('button', { name: '永久删除' }).click();
    await until(() => doveSearch('alice@hy.test', 'mailbox', 'Trash', 'all') === '', 'Trash empty on the server');
  });
} catch (e) {
  if (e.message !== 'stop') console.error('E2E aborted:', e.message);
} finally {
  if (app) {
    const logFile = path.join(userData, 'logs', 'main.log');
    if (failures && fs.existsSync(logFile)) console.log('--- main.log (tail) ---\n' + fs.readFileSync(logFile, 'utf8').split('\n').slice(-30).join('\n'));
    await app.close().catch(() => {});
  }
  await srv.stop();
  fs.rmSync(userData, { recursive: true, force: true });
  console.log(`\n${results.length - failures} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}
