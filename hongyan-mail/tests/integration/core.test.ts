// End-to-end tests of the mail core against a real Dovecot IMAP server and an SMTP server.
// Requires: apt install dovecot-imapd; run as root (Dovecot drops privileges to the vmail user).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { MailCore, type Platform } from '../../src/main/core/mail-core';
import type { AppEvent, AccountDraftInput } from '../../src/shared/types';
// @ts-expect-error untyped helper module
import { startMailServer, buildRaw } from '../../scripts/test-server/mail-server.mjs';

const require = createRequire(import.meta.url);
const { ImapFlow } = require('imapflow');

let srv: any;
let core: MailCore;
let dataDir: string;
const events: AppEvent[] = [];
const notified: any[] = [];

async function waitFor<T>(fn: () => T | Promise<T>, label: string, timeout = 20000): Promise<T> {
  const start = Date.now();
  let last: any;
  while (Date.now() - start < timeout) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timeout waiting for ${label}: ${last}`);
}

function account(user: string, pass: string, overrides: Partial<AccountDraftInput> = {}): AccountDraftInput {
  return {
    email: user,
    displayName: user.split('@')[0],
    providerId: null,
    imap: { host: '127.0.0.1', port: srv.ports.imaps, security: 'tls' },
    smtp: { host: '127.0.0.1', port: srv.ports.smtps, security: 'tls' },
    username: user,
    authType: 'password',
    password: pass,
    allowInsecureTls: true,
    ...overrides
  };
}

async function serverClient(user: string, pass: string) {
  const c = new ImapFlow({ host: '127.0.0.1', port: srv.ports.imap, secure: false, tls: { rejectUnauthorized: false }, auth: { user, pass }, logger: false });
  await c.connect();
  return c;
}

const inbox = (accountId: number) => core.listFolders().find((f) => f.accountId === accountId && f.specialUse === 'inbox')!;
const folder = (accountId: number, su: string) => core.listFolders().find((f) => f.accountId === accountId && f.specialUse === su)!;

beforeAll(async () => {
  srv = await startMailServer({ imapPort: 21143, imapsPort: 21993, smtpPort: 21587, smtpsPort: 21465 });
  const now = Date.now();
  const rootId = '<root-1@hy.test>';
  srv.deliver('alice@hy.test', buildRaw({ from: 'Bob <bob@hy.test>', to: 'alice@hy.test', subject: '季度报价单', text: '你好 Alice，附件是第三季度的报价。\n请查收。', date: new Date(now - 5 * 3600e3), messageId: rootId }));
  srv.deliver('alice@hy.test', buildRaw({ from: 'Carol <carol@hy.test>', to: 'alice@hy.test', subject: 'Re: 季度报价单', text: '我补充一点：价格含税。', date: new Date(now - 4 * 3600e3), inReplyTo: rootId, references: rootId }));
  srv.deliver('alice@hy.test', buildRaw({ from: 'Shop <news@shop.example>', to: 'alice@hy.test', subject: '双十一大促 全场 5 折', text: '限时优惠', html: '<h1>大促</h1><p>限时 <b>优惠</b> <img src="https://tracker.example/p.gif"></p>', date: new Date(now - 3 * 3600e3), headers: { 'List-Unsubscribe': '<https://shop.example/unsub?u=1>', Precedence: 'bulk' } }));
  srv.deliver('alice@hy.test', buildRaw({ from: 'GitHub <notifications@github.com>', to: 'alice@hy.test', subject: '[hy/repo] Build failed', text: 'CI failed', date: new Date(now - 2 * 3600e3), headers: { 'List-Id': 'hy/repo <repo.hy.github.com>' } }));
  // message with an attachment
  const b = 'mixb';
  const att = Buffer.from('%PDF-1.4 fake pdf content').toString('base64');
  srv.deliver('alice@hy.test', Buffer.from([
    'From: Dave <dave@hy.test>', 'To: alice@hy.test', 'Subject: 合同附件', `Date: ${new Date(now - 3600e3).toUTCString()}`, 'Message-ID: <att-1@hy.test>', 'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${b}"`, '', `--${b}`, 'Content-Type: text/plain; charset=utf-8', '', '请查看合同。', `--${b}`,
    'Content-Type: application/pdf; name="合同.pdf"', 'Content-Disposition: attachment; filename="=?UTF-8?B?5ZCI5ZCMLnBkZg==?="', 'Content-Transfer-Encoding: base64', '', att, `--${b}--`, ''
  ].join('\r\n')));
  for (let i = 0; i < 820; i++) {
    srv.deliver('carol@hy.test', buildRaw({ from: `Sender ${i} <s${i}@example.com>`, to: 'carol@hy.test', subject: `批量邮件 ${i}`, text: `正文 ${i}`, date: new Date(now - i * 60e3) }));
  }

  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hy-core-'));
  const platform: Platform = {
    dataDir,
    secrets: { available: true, backend: 'test', encrypt: (s) => Buffer.from('enc:' + s), decrypt: (b) => b.toString().slice(4) },
    fetch: async () => ({ ok: false, status: 404, text: async () => '' }),
    httpPost: async () => ({ status: 500, json: {} }),
    openExternal: () => {},
    emit: (e) => events.push(e),
    notifyNewMail: (items) => notified.push(...items),
    log: { debug() {}, info() {}, warn: (m) => process.env.HY_DEBUG && console.warn(m), error: (m, e) => console.error(m, e) }
  };
  core = new MailCore(platform);
  core.start();
}, 120000);

afterAll(async () => {
  await core?.shutdown();
  await srv?.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('connection diagnostics', () => {
  it('passes every step with correct credentials', async () => {
    const report = await core.testConnection(account('alice@hy.test', 'alice-pass'), 'r1');
    expect(report.ok).toBe(true);
    expect(report.steps.every((s) => s.status === 'ok' || s.status === 'skipped')).toBe(true);
    expect(report.serverInfo?.capabilities).toContain('IDLE');
  });

  it('explains a wrong password', async () => {
    const report = await core.testConnection(account('alice@hy.test', 'wrong'), 'r2');
    expect(report.ok).toBe(false);
    expect(report.steps.find((s) => s.id === 'auth')!.status).toBe('fail');
    expect(report.diagnosis!.kind).toBe('auth');
    expect(report.steps.find((s) => s.id === 'smtp-auth')!.status).toBe('fail');
  });

  it('explains an untrusted certificate', async () => {
    const report = await core.testConnection(account('alice@hy.test', 'alice-pass', { allowInsecureTls: false }), 'r3');
    expect(report.ok).toBe(false);
    expect(report.diagnosis!.kind).toBe('tls-untrusted');
  });

  it('explains a closed port', async () => {
    const report = await core.testConnection(account('alice@hy.test', 'alice-pass', { imap: { host: '127.0.0.1', port: 1, security: 'tls' } }), 'r4');
    expect(report.diagnosis!.kind).toBe('refused');
  });

  it('explains TLS on a plain-text port', async () => {
    const report = await core.testConnection(account('alice@hy.test', 'alice-pass', { imap: { host: '127.0.0.1', port: srv.ports.imap, security: 'tls' } }), 'r5');
    expect(report.ok).toBe(false);
    expect(report.diagnosis!.kind).toBe('tls-mismatch');
  });

  it('works over STARTTLS', async () => {
    const report = await core.testConnection(account('alice@hy.test', 'alice-pass', {
      imap: { host: '127.0.0.1', port: srv.ports.imap, security: 'starttls' },
      smtp: { host: '127.0.0.1', port: srv.ports.smtp, security: 'starttls' }
    }), 'r6');
    expect(report.ok).toBe(true);
  });
});

describe('sync and actions', () => {
  let aliceId: number;

  it('adds an account and syncs the inbox with previews and categories', async () => {
    const acc = core.addAccount(account('alice@hy.test', 'alice-pass'));
    aliceId = acc.id;
    expect(acc.color).toMatch(/^#/);
    await waitFor(() => inbox(aliceId) && core.listMessages({ view: { kind: 'folder', accountId: aliceId, folderId: inbox(aliceId).id }, filter: 'all', category: 'all' }, 0, 50).total === 5, 'inbox sync');
    const list = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50);
    expect(list.items.map((m) => m.subject)).toEqual(['合同附件', '[hy/repo] Build failed', '双十一大促 全场 5 折', 'Re: 季度报价单', '季度报价单']);
    const bySubject = Object.fromEntries(list.items.map((m) => [m.subject, m]));
    expect(bySubject['双十一大促 全场 5 折'].category).toBe('promotions');
    expect(bySubject['[hy/repo] Build failed'].category).toBe('notifications');
    expect(bySubject['季度报价单'].category).toBe('primary');
    expect(bySubject['合同附件'].hasAttachments).toBe(true);
    expect(bySubject['季度报价单'].snippet).toContain('第三季度的报价');
    expect(bySubject['Re: 季度报价单'].threadKey).toBe(bySubject['季度报价单'].threadKey);
    const folders = core.listFolders().filter((f) => f.accountId === aliceId).map((f) => f.specialUse).sort();
    expect(folders).toEqual(['archive', 'drafts', 'inbox', 'junk', 'sent', 'trash']);
  });

  it('reads a message, its thread and attachments', async () => {
    const list = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items;
    const att = list.find((m) => m.subject === '合同附件')!;
    const detail = await core.getMessage(att.id);
    expect(detail.text).toContain('请查看合同');
    expect(detail.attachments).toHaveLength(1);
    expect(detail.attachments[0].filename).toBe('合同.pdf');
    const a = await core.attachment(att.id, 0);
    expect(a.content.toString()).toContain('%PDF');
    const promo = list.find((m) => m.subject.startsWith('双十一'))!;
    const promoDetail = await core.getMessage(promo.id);
    expect(promoDetail.html).toContain('<b>优惠</b>');
    expect(promoDetail.listUnsubscribe).toContain('https://shop.example/unsub');
    const reply = list.find((m) => m.subject === 'Re: 季度报价单')!;
    const thread = core.getThread(reply.id);
    expect(thread.ids).toHaveLength(2);
  });

  it('marks read and starred on the server', async () => {
    const msg = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items.find((m) => m.subject === '季度报价单')!;
    core.setSeen([msg.id], true);
    core.setFlagged([msg.id], true);
    const c = await serverClient('alice@hy.test', 'alice-pass');
    try {
      await waitFor(async () => {
        const lock = await c.getMailboxLock('INBOX');
        try {
          const m = await c.fetchOne(String(msg.uid), { flags: true }, { uid: true });
          return m && m.flags.has('\\Seen') && m.flags.has('\\Flagged');
        } finally { lock.release(); }
      }, 'server flags');
    } finally { await c.logout(); }
    expect(core.unifiedCounts().starred).toBe(1);
  });

  it('archives with undo', async () => {
    const msg = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items.find((m) => m.subject.startsWith('[hy/repo]'))!;
    const { undoToken } = await core.archiveMessages([msg.id]);
    expect(undoToken).toBeTruthy();
    // optimistic: gone from the inbox immediately
    expect(core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).total).toBe(4);
    const archiveId = folder(aliceId, 'archive').id;
    await waitFor(() => core.store.getRow(msg.id)!.uid > 0 && core.store.getRow(msg.id)!.folder_id === archiveId, 'move finalised');
    await core.undo(undoToken!);
    await waitFor(() => core.store.getRow(msg.id)!.uid > 0 && core.store.getRow(msg.id)!.folder_id === inbox(aliceId).id, 'undo finalised');
    const c = await serverClient('alice@hy.test', 'alice-pass');
    try {
      const st = await c.status('Archive', { messages: true });
      expect(st.messages).toBe(0);
      const st2 = await c.status('INBOX', { messages: true });
      expect(st2.messages).toBe(5);
    } finally { await c.logout(); }
  });

  it('moves to trash and deletes permanently from trash', async () => {
    const msg = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items.find((m) => m.subject.startsWith('双十一'))!;
    await core.trashMessages([msg.id]);
    const trashId = folder(aliceId, 'trash').id;
    await waitFor(() => core.store.getRow(msg.id)?.folder_id === trashId && core.store.getRow(msg.id)!.uid > 0, 'in trash');
    const res = await core.trashMessages([msg.id]);
    expect(res.permanent).toBe(true);
    expect(core.store.getRow(msg.id)).toBeUndefined();
    const c = await serverClient('alice@hy.test', 'alice-pass');
    try {
      await waitFor(async () => (await c.status('Trash', { messages: true })).messages === 0, 'trash empty on server');
    } finally { await c.logout(); }
  });

  it('receives new mail through IDLE and notifies', async () => {
    srv.deliver('alice@hy.test', buildRaw({ from: 'Erin <erin@hy.test>', to: 'alice@hy.test', subject: '实时推送测试', text: '这封邮件应当立刻出现' }));
    await waitFor(() => core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items.some((m) => m.subject === '实时推送测试'), 'idle push', 15000);
    await waitFor(() => notified.some((n) => n.subject === '实时推送测试'), 'notification');
  });

  it('sends mail through SMTP, files it in Sent and delivers it', async () => {
    const before = Date.now();
    const { outboxId, sendAt } = core.send({
      accountId: aliceId,
      to: [{ name: 'Bob', address: 'bob@hy.test' }],
      cc: [],
      bcc: [{ name: '', address: 'carol@hy.test' }],
      subject: '来自鸿雁的问候',
      html: '<p>你好 <b>Bob</b>！</p>',
      attachments: []
    });
    expect(sendAt).toBeGreaterThanOrEqual(before);
    expect(core.listOutbox().some((o) => o.id === outboxId)).toBe(true);
    await waitFor(() => events.some((e) => e.type === 'send-result' && e.outboxId === outboxId && e.ok), 'sent', 20000);
    const delivered = srv.delivered.find((d: any) => d.raw.toString().includes('Subject: =?UTF-8?') && d.rcpts.includes('carol@hy.test'));
    expect(delivered.rcpts).toEqual(['bob@hy.test', 'carol@hy.test']);
    expect(delivered.raw.toString()).not.toMatch(/^Bcc:/m);
    const sentId = folder(aliceId, 'sent').id;
    await waitFor(() => core.listMessages({ view: { kind: 'folder', accountId: aliceId, folderId: sentId }, filter: 'all', category: 'all' }, 0, 10).items.some((m) => m.subject === '来自鸿雁的问候'), 'sent copy', 20000);
  });

  it('cancels a queued send (undo send)', () => {
    const { outboxId } = core.send({ accountId: aliceId, to: [{ name: '', address: 'bob@hy.test' }], cc: [], bcc: [], subject: '撤回', html: '<p>x</p>', attachments: [] }, Date.now() + 60_000);
    const payload = core.cancelSend(outboxId);
    expect(payload?.subject).toBe('撤回');
    expect(core.listOutbox().some((o) => o.id === outboxId)).toBe(false);
  });

  it('finds messages with local full-text search', () => {
    const q = (query: string) => core.listMessages({ view: { kind: 'search', query }, filter: 'all', category: 'all' }, 0, 50).items.map((m) => m.subject);
    expect(q('报价')).toEqual(expect.arrayContaining(['季度报价单']));
    expect(q('from:carol')).toEqual(['Re: 季度报价单']);
    expect(q('has:attachment')).toEqual(['合同附件']);
    expect(q('第三季度')).toEqual(['季度报价单']);
  });

  it('builds reply / reply-all / forward prefills', async () => {
    const msg = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items.find((m) => m.subject === 'Re: 季度报价单')!;
    const r = await core.composePrefill('reply', msg.id);
    expect(r.to.map((a) => a.address)).toEqual(['carol@hy.test']);
    expect(r.subject).toBe('Re: 季度报价单');
    expect(r.inReplyTo).toBeTruthy();
    expect(r.references).toContain('<root-1@hy.test>');
    expect(r.html).toContain('写道');
    const att = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items.find((m) => m.subject === '合同附件')!;
    const f = await core.composePrefill('forward', att.id);
    expect(f.subject).toBe('Fwd: 合同附件');
    expect(f.attachments).toHaveLength(1);
    expect(f.attachments[0].fromMessage).toEqual({ messageId: att.id, index: 0 });
  });

  it('notices messages deleted on another device', async () => {
    const c = await serverClient('alice@hy.test', 'alice-pass');
    let uid = 0;
    try {
      const lock = await c.getMailboxLock('INBOX');
      try {
        const uids = await c.search({ subject: '实时推送测试' }, { uid: true });
        uid = uids[0];
        await c.messageDelete(String(uid), { uid: true });
      } finally { lock.release(); }
    } finally { await c.logout(); }
    await waitFor(() => !core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all' }, 0, 50).items.some((m) => m.subject === '实时推送测试'), 'expunge noticed', 30000);
  }, 45000);

  it('downloads the full history of a large mailbox', async () => {
    const carol = core.addAccount(account('carol@hy.test', 'carol-pass'));
    await waitFor(() => {
      const f = inbox(carol.id);
      return f && f.syncedCount >= 820 && f.backfillDone;
    }, 'backfill', 60000);
    // carol also received the Bcc copy from the send test
    const list = core.listMessages({ view: { kind: 'folder', accountId: carol.id, folderId: inbox(carol.id).id }, filter: 'all', category: 'all' }, 800, 50);
    expect(list.total).toBe(821);
    expect(list.items).toHaveLength(21);
    expect(list.items[20].subject).toBe('批量邮件 819');
  }, 90000);

  it('reports a clear error when the password is changed', async () => {
    await core.updateAccount(aliceId, { credentials: { authType: 'password', password: 'not-the-password' } });
    await waitFor(() => core.listAccounts().find((a) => a.id === aliceId)!.status.state === 'error', 'error state');
    const st = core.listAccounts().find((a) => a.id === aliceId)!.status;
    expect(st.diagnosis?.kind).toBe('auth');
    await core.updateAccount(aliceId, { credentials: { authType: 'password', password: 'alice-pass' } });
    await waitFor(() => core.listAccounts().find((a) => a.id === aliceId)!.status.state !== 'error', 'recovered');
  });
});

describe('folders, drafts, server search and send failures', () => {
  const alice = () => core.listAccounts().find((a) => a.email === 'alice@hy.test')!;

  it('creates, renames and deletes folders and moves mail into them', async () => {
    const a = alice();
    await core.createFolder(a.id, '项目/2026'.replace('/', '-'));
    await waitFor(() => core.listFolders().some((f) => f.accountId === a.id && f.name === '项目-2026'), 'folder created');
    const folderId = core.listFolders().find((f) => f.accountId === a.id && f.name === '项目-2026')!.id;
    const msg = core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all', accountId: a.id }, 0, 50).items.find((m) => m.subject === '合同附件')!;
    core.moveMessages([msg.id], folderId);
    await waitFor(() => core.store.getRow(msg.id)?.folder_id === folderId && core.store.getRow(msg.id)!.uid > 0, 'moved to custom folder');
    await core.renameFolder(folderId, '合同存档');
    await waitFor(() => core.listFolders().some((f) => f.accountId === a.id && f.name === '合同存档' && f.total === 1), 'renamed and resynced', 20000);
    const renamed = core.listFolders().find((f) => f.accountId === a.id && f.name === '合同存档')!;
    await expect(core.deleteFolder(core.listFolders().find((f) => f.accountId === a.id && f.specialUse === 'inbox')!.id)).rejects.toThrow('系统文件夹');
    await core.deleteFolder(renamed.id);
    await waitFor(() => !core.listFolders().some((f) => f.accountId === a.id && f.name === '合同存档'), 'folder deleted');
  });

  it('marks a whole folder as read', async () => {
    const a = alice();
    const inboxId = core.listFolders().find((f) => f.accountId === a.id && f.specialUse === 'inbox')!.id;
    const done = core.markFolderRead(inboxId);
    // local state changes at once (optimistic), the server gets one STORE 1:* +FLAGS (\Seen)
    expect(core.listFolders().find((f) => f.id === inboxId)!.unread).toBe(0);
    await done;
    const c = await serverClient('alice@hy.test', 'alice-pass');
    try {
      await waitFor(async () => (await c.status('INBOX', { unseen: true })).unseen === 0, 'server unseen 0');
    } finally { await c.logout(); }
  });

  it('uploads a draft to the server Drafts folder', async () => {
    const a = alice();
    const draftsId = core.listFolders().find((f) => f.accountId === a.id && f.specialUse === 'drafts')!.id;
    const id = await core.saveDraft({ accountId: a.id, to: [{ name: 'Bob', address: 'bob@hy.test' }], cc: [], bcc: [], subject: '还没写完的信', html: '<p>草稿内容</p>', attachments: [] }, true);
    expect(id).toBeGreaterThan(0);
    await waitFor(() => core.listMessages({ view: { kind: 'folder', accountId: a.id, folderId: draftsId }, filter: 'all', category: 'all' }, 0, 10).items.some((m) => m.subject === '还没写完的信' && m.draft), 'draft on server', 20000);
    expect(core.listDrafts().some((d) => d.subject === '还没写完的信')).toBe(false);
    const draft = core.listMessages({ view: { kind: 'folder', accountId: a.id, folderId: draftsId }, filter: 'all', category: 'all' }, 0, 10).items.find((m) => m.subject === '还没写完的信')!;
    const prefill = await core.composePrefill('draft', draft.id);
    expect(prefill.to[0].address).toBe('bob@hy.test');
    expect(prefill.html).toContain('草稿内容');
    expect(prefill.serverDraftMessageId).toBe(draft.id);
  });

  it('searches message bodies on the server and imports the matches', async () => {
    srv.deliver('alice@hy.test', buildRaw({ from: 'Frank <frank@hy.test>', to: 'alice@hy.test', subject: '普通的标题', text: '正文里藏着一个独特的暗号：青龙偃月刀' }));
    await waitFor(() => core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all', accountId: alice().id }, 0, 80).items.some((m) => m.subject === '普通的标题'), 'arrived');
    // The local index only has the 2 KB preview; the server search must find the body text too.
    const r = await core.searchServer('青龙偃月刀');
    expect(r.errors).toEqual([]);
    expect(r.searchedFolders).toBeGreaterThan(0);
    const local = core.listMessages({ view: { kind: 'search', query: '青龙偃月刀' }, filter: 'all', category: 'all' }, 0, 10).items.map((m) => m.subject);
    expect(local).toContain('普通的标题');
  });

  it('keeps failed mail in the outbox with a diagnosis and sends it on retry', async () => {
    const a = alice();
    await core.updateAccount(a.id, { smtp: { host: '127.0.0.1', port: 1, security: 'tls' } });
    const { outboxId } = core.send({ accountId: a.id, to: [{ name: '', address: 'bob@hy.test' }], cc: [], bcc: [], subject: '重试测试', html: '<p>x</p>', attachments: [] }, Date.now());
    await waitFor(() => events.some((e) => e.type === 'send-result' && e.outboxId === outboxId && !e.ok), 'failure reported', 20000);
    const item = core.listOutbox().find((o) => o.id === outboxId)!;
    expect(item.status).toBe('failed');
    expect(item.error!.kind).toBe('refused');
    await core.updateAccount(a.id, { smtp: { host: '127.0.0.1', port: srv.ports.smtps, security: 'tls' } });
    core.retryOutbox(outboxId);
    await waitFor(() => events.some((e) => e.type === 'send-result' && e.outboxId === outboxId && e.ok), 'sent after retry', 20000);
    expect(core.listOutbox().some((o) => o.id === outboxId)).toBe(false);
  });

  it('suggests contacts from synced mail', () => {
    expect(core.suggestContacts('bo').map((c) => c.address)).toContain('bob@hy.test');
  });
});

describe('junk management: blocking, bulk actions, emptying', () => {
  const alice = () => core.listAccounts().find((a) => a.email === 'alice@hy.test')!;
  const inboxQuery = () => ({ view: { kind: 'folder' as const, accountId: alice().id, folderId: inbox(alice().id).id }, filter: 'all' as const, category: 'all' as const });
  const serverCount = async (mailbox: string, what: 'messages' | 'unseen' = 'messages') => {
    const c = await serverClient('alice@hy.test', 'alice-pass');
    try { return ((await c.status(mailbox, { [what]: true })) as any)[what] as number; } finally { await c.logout(); }
  };

  it('blocks a whole domain: existing mail moves to Junk on the server, new mail follows', async () => {
    for (let i = 0; i < 3; i++) srv.deliver('alice@hy.test', buildRaw({ from: `Ads <promo${i}@ads.example>`, to: 'alice@hy.test', subject: `广告 ${i}`, text: '买买买' }));
    await waitFor(() => core.listMessages(inboxQuery(), 0, 100).items.filter((m) => m.subject.startsWith('广告')).length === 3, 'ads arrived');
    const junkBefore = await serverCount('Junk');
    const r = await core.blockSenders(['Ads <PROMO0@ads.example>', '*@ads.example']);
    expect(r.moved).toBe(3);
    expect(core.listBlockedSenders().map((b) => b.pattern).sort()).toEqual(['@ads.example', 'promo0@ads.example']);
    // gone from the inbox at once, and really moved on the server
    expect(core.listMessages(inboxQuery(), 0, 100).items.some((m) => m.subject.startsWith('广告'))).toBe(false);
    await waitFor(async () => (await serverCount('Junk')) === junkBefore + 3, 'moved to Junk on the server');
    // junk never counts as unread mail
    // (with categories on, the inbox counter is primary + notifications, as in the category tabs)
    const unreadIn = (category: 'primary' | 'notifications') => core.listMessages({ view: { kind: 'unified', box: 'inbox' }, filter: 'unread', category }, 0, 5000).total;
    expect(core.unifiedCounts().inboxUnread).toBe(unreadIn('primary') + unreadIn('notifications'));

    notified.length = 0;
    srv.deliver('alice@hy.test', buildRaw({ from: 'Ads <new@ads.example>', to: 'alice@hy.test', subject: '新广告', text: '又来了' }));
    await waitFor(async () => (await serverCount('Junk')) === junkBefore + 4, 'new mail from a blocked domain moved to Junk', 20000);
    const junk = folder(alice().id, 'junk');
    await waitFor(() => core.listMessages({ view: { kind: 'folder', accountId: alice().id, folderId: junk.id }, filter: 'all', category: 'all' }, 0, 50).items.some((m) => m.subject === '新广告'), 'visible in junk');
    expect(notified.some((n) => n.subject === '新广告')).toBe(false);
    await expect(core.blockSenders(['alice@hy.test'])).rejects.toThrow('自己');
    await expect(core.blockSenders(['not an address'])).rejects.toThrow();
    core.unblockSender('promo0@ads.example');
    expect(core.listBlockedSenders().map((b) => b.pattern)).toEqual(['@ads.example']);
  });

  it('selects every message of a view and marks it all read on the server', async () => {
    for (let i = 0; i < 3; i++) srv.deliver('alice@hy.test', buildRaw({ from: `Team <team${i}@hy.test>`, to: 'alice@hy.test', subject: `周报 ${i}`, text: '本周进展' }));
    await waitFor(() => core.listMessages({ ...inboxQuery(), filter: 'unread' }, 0, 100).total >= 3, 'unread arrived');
    const ids = core.queryIds(inboxQuery());
    expect(ids.length).toBe(core.listMessages(inboxQuery(), 0, 500).total);
    expect(ids).toEqual(core.listMessages(inboxQuery(), 0, 500).items.map((m) => m.id));
    const n = await core.markViewRead({ view: { kind: 'unified', box: 'inbox' }, filter: 'all', category: 'all', accountId: alice().id });
    expect(n).toBeGreaterThanOrEqual(3);
    expect(core.listMessages({ ...inboxQuery(), filter: 'unread' }, 0, 100).total).toBe(0);
    await waitFor(async () => (await serverCount('INBOX', 'unseen')) === 0, 'server unseen 0');
  });

  it('empties the junk folder permanently, and refuses to empty other folders', async () => {
    const junk = folder(alice().id, 'junk');
    const removed = await core.emptyFolder(junk.id);
    expect(removed).toBeGreaterThanOrEqual(4);
    expect(core.listMessages({ view: { kind: 'folder', accountId: alice().id, folderId: junk.id }, filter: 'all', category: 'all' }, 0, 10).total).toBe(0);
    await waitFor(async () => (await serverCount('Junk')) === 0, 'junk empty on the server');
    await expect(core.emptyFolder(inbox(alice().id).id)).rejects.toThrow('只能清空');
  });
});
