import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { OAuthManager, decodeJwtEmail } from '../../src/main/core/oauth';
import { Database } from '../../src/main/core/db';
import { MailStore, type NewMessage } from '../../src/main/core/store';
import { SettingsStore, DEFAULT_SETTINGS } from '../../src/main/core/settings';

const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    }).on('error', reject);
  });
}

describe('OAuth2 loopback flow', () => {
  it('runs the PKCE authorization-code flow end to end', async () => {
    const posts: Array<{ url: string; form: Record<string, string> }> = [];
    let authUrl = '';
    const m = new OAuthManager(
      () => ({ clientId: 'cid-123', clientSecret: 'sec' }),
      async (url, form) => {
        posts.push({ url, form });
        return { status: 200, json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, id_token: jwt({ email: 'Me@Gmail.com' }) } };
      },
      async (url) => { authUrl = url; }
    );
    const pending = m.start('google', 'me@gmail.com');
    while (!authUrl) await new Promise((r) => setTimeout(r, 10));
    const u = new URL(authUrl);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('client_id')).toBe('cid-123');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toContain('https://mail.google.com/');
    expect(u.searchParams.get('login_hint')).toBe('me@gmail.com');
    const redirect = u.searchParams.get('redirect_uri')!;
    expect(redirect).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    // a forged callback with the wrong state is refused
    const bad = await get(`${redirect}?code=evil&state=wrong`);
    expect(bad.status).toBe(400);
    const ok = await get(`${redirect}?code=the-code&state=${u.searchParams.get('state')}`);
    expect(ok.body).toContain('授权完成');
    const r = await pending;
    expect(r.email).toBe('me@gmail.com');
    expect(posts[0].form).toMatchObject({ code: 'the-code', grant_type: 'authorization_code', client_id: 'cid-123', client_secret: 'sec' });
    expect(posts[0].form.code_verifier.length).toBeGreaterThan(40);
    const s = m.take(r.session)!;
    expect(s.tokens).toMatchObject({ accessToken: 'AT', refreshToken: 'RT' });
    expect(m.take(r.session)).toBeNull();
  });

  it('refreshes tokens and keeps the old refresh token when none is returned', async () => {
    const m = new OAuthManager(() => ({ clientId: 'ms', clientSecret: '' }), async (_url, form) => {
      expect(form.grant_type).toBe('refresh_token');
      expect(form.scope).toContain('IMAP.AccessAsUser.All');
      return { status: 200, json: { access_token: 'NEW', expires_in: 60 } };
    }, () => {});
    const t = await m.refresh('microsoft', { accessToken: 'OLD', refreshToken: 'KEEP', expiresAt: 0, email: 'a@outlook.com' });
    expect(t).toMatchObject({ accessToken: 'NEW', refreshToken: 'KEEP', email: 'a@outlook.com' });
  });

  it('reports revoked grants', async () => {
    const m = new OAuthManager(() => ({ clientId: 'x', clientSecret: '' }), async () => ({ status: 400, json: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } }), () => {});
    await expect(m.refresh('google', { accessToken: '', refreshToken: 'r', expiresAt: 0, email: null })).rejects.toMatchObject({ code: 'EOAUTH_REVOKED' });
  });

  it('requires a configured client id', async () => {
    const m = new OAuthManager(() => ({ clientId: '', clientSecret: '' }), async () => ({ status: 200, json: {} }), () => {});
    await expect(m.start('microsoft')).rejects.toThrow(/客户端 ID/);
  });

  it('reads e-mail claims from id tokens', () => {
    expect(decodeJwtEmail(jwt({ preferred_username: 'User@Outlook.com' }))).toBe('user@outlook.com');
    expect(decodeJwtEmail('garbage')).toBeNull();
  });
});

describe('MailStore', () => {
  const setup = () => {
    const db = new Database(':memory:');
    const store = new MailStore(db);
    const accountId = store.insertAccount({
      email: 'me@x.com', display_name: 'Me', label: '', color: '#000', provider_id: null, provider_name: 'x', auth_type: 'password', oauth_provider: null,
      imap_host: 'imap.x.com', imap_port: 993, imap_security: 'tls', smtp_host: 'smtp.x.com', smtp_port: 465, smtp_security: 'tls', username: 'me@x.com',
      smtp_username: null, allow_insecure_tls: 0, secret: null, signature: '', enabled: 1, quirks: '{}'
    });
    const inbox = store.upsertFolder(accountId, { path: 'INBOX', name: 'INBOX', delimiter: '/', parentPath: null, specialUse: 'inbox', selectable: true, subscribed: true, syncEnabled: true });
    const all = store.upsertFolder(accountId, { path: '[Gmail]/All Mail', name: 'All Mail', delimiter: '/', parentPath: '[Gmail]', specialUse: 'all', selectable: true, subscribed: true, syncEnabled: true });
    return { db, store, accountId, inbox, all };
  };
  const msg = (uid: number, over: Partial<NewMessage> = {}): NewMessage => ({
    uid, messageId: `<m${uid}@x>`, msgKey: `<m${uid}@x>`, threadKey: `<m${uid}@x>`, inReplyTo: null, refs: [], subject: `Subject ${uid}`,
    from: { name: 'Sender', address: `s${uid}@y.com` }, to: [{ name: '', address: 'me@x.com' }], cc: [], bcc: [], replyTo: [], date: 1_700_000_000_000 + uid * 1000,
    size: 100, flags: new Set(), hasAttachments: false, snippet: `body text ${uid}`, previewPart: null, category: 'primary', listUnsubscribe: null, ...over
  });

  it('inserts idempotently and lists newest first', () => {
    const { store, accountId, inbox } = setup();
    expect(store.insertMessages(accountId, inbox, [msg(1), msg(2), msg(3)], false)).toHaveLength(3);
    expect(store.insertMessages(accountId, inbox, [msg(3)], false)).toHaveLength(0);
    const r = store.listMessages({ view: { kind: 'folder', accountId, folderId: inbox }, filter: 'all', category: 'all' }, 0, 10);
    expect(r.total).toBe(3);
    expect(r.items.map((m) => m.uid)).toEqual([3, 2, 1]);
  });

  it('deduplicates Gmail label copies in cross-folder views', () => {
    const { store, accountId, inbox, all } = setup();
    store.insertMessages(accountId, inbox, [msg(1, { flags: new Set(['\\Flagged']) })], false);
    store.insertMessages(accountId, all, [msg(1, { uid: 50, flags: new Set(['\\Flagged']) }), msg(2, { flags: new Set(['\\Flagged']) })], false);
    const r = store.listMessages({ view: { kind: 'unified', box: 'starred' }, filter: 'all', category: 'all' }, 0, 10);
    expect(r.total).toBe(2);
    expect(r.items.find((m) => m.msgKey === '<m1@x>')!.folderId).toBe(inbox);
  });

  it('full-text search handles Chinese of any length plus operators', () => {
    const { store, accountId, inbox } = setup();
    store.insertMessages(accountId, inbox, [
      msg(1, { subject: '季度报价单', snippet: '请查收附件' }),
      msg(2, { subject: '午饭', snippet: '去吃面', from: { name: '张伟', address: 'zw@y.com' } }),
      msg(3, { subject: 'Invoice 2024', snippet: 'payment due', hasAttachments: true })
    ], false);
    const q = (query: string) => store.listMessages({ view: { kind: 'search', query }, filter: 'all', category: 'all' }, 0, 10).items.map((m) => m.subject);
    expect(q('报价')).toEqual(['季度报价单']);
    expect(q('季度报价')).toEqual(['季度报价单']);
    expect(q('张伟')).toEqual(['午饭']);
    expect(q('invoice')).toEqual(['Invoice 2024']);
    expect(q('has:attachment')).toEqual(['Invoice 2024']);
    expect(q('from:zw@')).toEqual(['午饭']);
    expect(q('100%_')).toEqual([]);
  });

  it('suggests contacts, sent recipients first', () => {
    const { store, accountId, inbox } = setup();
    store.insertMessages(accountId, inbox, [msg(1, { from: { name: 'Zhang Wei', address: 'zhang@y.com' } })], false);
    store.insertMessages(accountId, inbox, [msg(2, { to: [{ name: 'Zhao', address: 'zhao@y.com' }] })], true);
    expect(store.suggestContacts('zh').map((c) => c.address)).toEqual(['zhao@y.com', 'zhang@y.com']);
  });

  it('sender rules recategorise existing and future mail', () => {
    const { store, accountId, inbox } = setup();
    store.insertMessages(accountId, inbox, [msg(1)], false);
    store.setSenderRule('s1@y.com', 'promotions');
    expect(store.senderCategory('s1@y.com')).toBe('promotions');
    expect(store.listMessages({ view: { kind: 'folder', accountId, folderId: inbox }, filter: 'all', category: 'promotions' }, 0, 10).total).toBe(1);
  });
});

describe('settings', () => {
  it('merges stored values with defaults and persists updates', () => {
    const db = new Database(':memory:');
    const s = new SettingsStore(db);
    expect(s.get().theme).toBe(DEFAULT_SETTINGS.theme);
    s.update({ theme: 'dark', oauth: { google: { clientId: 'g', clientSecret: '' }, microsoft: { clientId: '', clientSecret: '' } } });
    const again = new SettingsStore(db).get();
    expect(again.theme).toBe('dark');
    expect(again.oauth.google.clientId).toBe('g');
    expect(again.undoSendSeconds).toBe(DEFAULT_SETTINGS.undoSendSeconds);
  });
});
