// The application core: owns the database, account syncs, the outbox and every operation the UI performs.
// It deliberately does not import Electron so that it can be exercised by the integration tests.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { simpleParser, type ParsedMail, type AddressObject, type SimpleParserOptions } from 'mailparser';
import type {
  AccountDraftInput, AccountPatch, AccountSummary, AppEvent, AttachmentInfo, Category, ComposeAttachment, ComposePayload,
  ComposePrefill, ContactSuggestion, DiagnosisReport, DiscoveryResult, DraftRecord, FolderInfo, ListQuery, ListResult,
  MessageDetail, OAuthProviderId, OAuthResult, OutboxItem, SearchServerResult, Settings, SpecialUse, AccountCredentialInput,
  Address, Diagnosis
} from '../../shared/types';
import { Database } from './db';
import { MailStore, type AccountRow, type MessageRow } from './store';
import { SettingsStore } from './settings';
import { BodyStore } from './body-store';
import { AccountSync, SyncError } from './sync';
import { discover, isValidEmail, type FetchFn } from './discovery';
import { runDiagnosis } from './diagnose';
import { OAuthManager, type HttpPost, type OAuthTokens } from './oauth';
import { explainError } from './explain';
import { providerById, providerForImapHost } from './providers';
import { buildRaw, createTransport, newMessageId } from './smtp';
import { baseSubject, htmlToText, makeSnippet } from './mime';
import type { ImapAuth } from './imap';
import type { Logger } from './logger';

export interface SecretBox {
  available: boolean;
  backend: string;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

export interface Platform {
  dataDir: string;
  secrets: SecretBox;
  fetch: FetchFn;
  httpPost: HttpPost;
  openExternal(url: string): Promise<void> | void;
  emit(e: AppEvent): void;
  notifyNewMail(items: Array<{ accountId: number; id: number; from: string; subject: string; snippet: string }>): void;
  log: Logger;
}

interface StoredSecret {
  password?: string;
  oauth?: OAuthTokens;
}

interface UndoEntry {
  accountId: number;
  items: Array<{ id: number; folderId: number }>;
  pending: Promise<unknown>;
  created: number;
}

const ACCOUNT_COLORS = ['#D9472B', '#2F8F83', '#3F5BA9', '#C98A1B', '#7E4FA0', '#B5466B', '#4A7C3A', '#2B7BB9', '#8C5A3C', '#5B6470'];

const fmtAddr = (a: Address) => (a.name ? `${a.name} <${a.address}>` : a.address);
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function addrList(v: AddressObject | AddressObject[] | undefined): Address[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  const out: Address[] = [];
  for (const o of arr) for (const a of o.value || []) if (a.address) out.push({ name: a.name || '', address: a.address.toLowerCase() });
  return out;
}

export class MailCore {
  readonly db: Database;
  readonly store: MailStore;
  readonly settings: SettingsStore;
  readonly bodies: BodyStore;
  readonly oauth: OAuthManager;
  private syncs = new Map<number, AccountSync>();
  private parsedCache = new Map<number, ParsedMail>();
  private undos = new Map<string, UndoEntry>();
  private refreshing = new Map<number, Promise<OAuthTokens>>();
  private outboxTimer: NodeJS.Timeout | null = null;
  private outboxBusy = false;
  private online = true;
  private log: Logger;

  constructor(private platform: Platform) {
    this.log = platform.log;
    fs.mkdirSync(platform.dataDir, { recursive: true });
    this.db = new Database(path.join(platform.dataDir, 'hongyan.db'));
    this.store = new MailStore(this.db);
    this.settings = new SettingsStore(this.db);
    this.bodies = new BodyStore(path.join(platform.dataDir, 'mail'));
    this.oauth = new OAuthManager((p) => this.settings.get().oauth[p], platform.httpPost, (url) => platform.openExternal(url));
  }

  // ================================================================ lifecycle

  start() {
    // Optimistic moves interrupted by a crash leave rows with negative UIDs: drop them, sync re-fetches.
    const orphans = this.db.all<{ id: number; account_id: number }>('SELECT id, account_id FROM messages WHERE uid < 0');
    if (orphans.length) {
      this.store.deleteByIds(orphans.map((o) => o.id));
      this.db.run('UPDATE folders SET last_full_check_at = NULL');
    }
    this.db.run("UPDATE outbox SET status = 'failed', error = ? WHERE status = 'sending'", JSON.stringify({
      kind: 'interrupted', title: '发送被中断', explanation: '上次退出时这封邮件正在发送，无法确定是否已经发出。', suggestions: ['请在「已发送」中确认后，再决定是否重新发送。'], needsUserAction: true
    } satisfies Diagnosis));
    for (const row of this.store.listAccountRows()) if (row.enabled) this.startSync(row);
    this.scheduleOutbox();
  }

  async shutdown() {
    if (this.outboxTimer) clearTimeout(this.outboxTimer);
    this.oauth.cancel();
    await Promise.all([...this.syncs.values()].map((s) => s.stop()));
    this.syncs.clear();
    this.db.close();
  }

  private emit(e: AppEvent) {
    this.platform.emit(e);
  }

  private startSync(row: AccountRow) {
    const sync = new AccountSync(row, {
      store: this.store,
      bodies: this.bodies,
      log: this.log,
      resolveAuth: (a) => this.resolveAuth(a),
      emit: (e) => this.emit(e),
      onNewMail: (accountId, ids) => this.onNewMail(accountId, ids),
      onBodyDownloaded: (accountId, id, raw) => { void this.indexBody(id, raw); void accountId; },
      settings: () => this.settings.get()
    });
    this.syncs.set(row.id, sync);
    sync.setOnline(this.online);
    sync.start();
  }

  private sync(accountId: number): AccountSync {
    const s = this.syncs.get(accountId);
    if (!s) throw new SyncError('账户已停用', { kind: 'disabled', title: '账户已停用', explanation: '该账户的同步已关闭。', suggestions: ['在账户设置中启用该账户。'], needsUserAction: true });
    return s;
  }

  setOnline(online: boolean) {
    this.online = online;
    for (const s of this.syncs.values()) s.setOnline(online);
    if (online) this.scheduleOutbox(0);
  }

  // ================================================================ settings

  getSettings(): Settings {
    return this.settings.get();
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const before = this.settings.get();
    const next = this.settings.update(patch);
    if (patch.syncIntervalMinutes !== undefined && patch.syncIntervalMinutes !== before.syncIntervalMinutes) for (const s of this.syncs.values()) s.rescheduleTimers();
    this.emit({ type: 'settings-changed', settings: next });
    return next;
  }

  // ================================================================ credentials

  private readSecret(row: AccountRow): StoredSecret {
    if (!row.secret) return {};
    try { return JSON.parse(this.platform.secrets.decrypt(Buffer.from(row.secret))); } catch (e) {
      this.log.error(`account ${row.id}: cannot decrypt credentials`, e);
      return {};
    }
  }

  private encryptSecret(s: StoredSecret): Buffer {
    return this.platform.secrets.encrypt(JSON.stringify(s));
  }

  private async resolveAuth(row: AccountRow): Promise<ImapAuth> {
    const secret = this.readSecret(row);
    if (row.auth_type === 'oauth2') {
      if (!secret.oauth) throw new SyncError('缺少授权信息', { kind: 'oauth-missing', title: '需要重新授权', explanation: '没有找到该账户的 OAuth2 授权信息。', suggestions: ['在账户设置中点击「重新授权」。'], needsUserAction: true });
      let tokens = secret.oauth;
      if (tokens.expiresAt - Date.now() < 5 * 60_000) tokens = await this.refreshTokens(row, tokens);
      return { user: row.username, accessToken: tokens.accessToken };
    }
    return { user: row.username, pass: secret.password || '' };
  }

  private refreshTokens(row: AccountRow, tokens: OAuthTokens): Promise<OAuthTokens> {
    const existing = this.refreshing.get(row.id);
    if (existing) return existing;
    const p = (async () => {
      try {
        const fresh = await this.oauth.refresh(row.oauth_provider as OAuthProviderId, tokens);
        const secret = this.readSecret(this.store.getAccountRow(row.id) || row);
        this.store.updateAccountFields(row.id, { secret: this.encryptSecret({ ...secret, oauth: fresh }) });
        return fresh;
      } catch (e: any) {
        const d = explainError(e, { phase: 'oauth', authType: 'oauth2' });
        if (e?.code === 'EOAUTH_REVOKED') {
          throw new SyncError(d.title, { ...d, kind: 'oauth-rejected', title: 'OAuth2 授权已失效', explanation: '授权已被撤销或过期，需要重新登录。', suggestions: ['在账户设置中点击「重新授权」。'], needsUserAction: true });
        }
        throw new SyncError(d.title, d);
      } finally {
        this.refreshing.delete(row.id);
      }
    })();
    this.refreshing.set(row.id, p);
    return p;
  }

  private draftAuth(input: AccountCredentialInput, username: string): () => Promise<ImapAuth> {
    return async () => {
      if (input.authType === 'oauth2') {
        const s = input.oauthSession ? this.oauth.peek(input.oauthSession) : null;
        if (!s) throw Object.assign(new Error('OAuth2 授权已过期，请重新登录 (cancel)'), { code: 'EOAUTH' });
        return { user: username, accessToken: s.tokens.accessToken };
      }
      return { user: username, pass: input.password || '' };
    };
  }

  // ================================================================ accounts

  private accountSummary(row: AccountRow): AccountSummary {
    const status = row.enabled ? this.syncs.get(row.id)?.getStatus() ?? { state: 'idle' as const } : { state: 'disabled' as const };
    return this.store.accountSummary(row, status);
  }

  listAccounts(): AccountSummary[] {
    return this.store.listAccountRows().map((r) => this.accountSummary(r));
  }

  async discover(email: string): Promise<DiscoveryResult> {
    if (!isValidEmail(email)) return { email, domain: '', source: 'none', provider: null, notes: ['请输入有效的邮箱地址'] };
    return discover(email.trim(), { online: this.settings.get().autodiscoverOnline, fetch: this.platform.fetch });
  }

  testConnection(input: AccountDraftInput, runId: string): Promise<DiagnosisReport> {
    return runDiagnosis({
      email: input.email,
      imap: input.imap,
      smtp: input.smtp,
      username: input.username,
      smtpUsername: input.smtpUsername,
      allowInsecureTls: !!input.allowInsecureTls,
      providerId: input.providerId,
      authType: input.authType,
      getAuth: this.draftAuth(input, input.username)
    }, (steps) => this.emit({ type: 'diagnose-progress', runId, steps }), this.log);
  }

  async diagnoseAccount(id: number, runId: string, override?: AccountCredentialInput): Promise<DiagnosisReport> {
    const row = this.store.getAccountRow(id);
    if (!row) throw new Error('账户不存在');
    return runDiagnosis({
      email: row.email,
      imap: { host: row.imap_host, port: row.imap_port, security: row.imap_security },
      smtp: { host: row.smtp_host, port: row.smtp_port, security: row.smtp_security },
      username: row.username,
      smtpUsername: row.smtp_username,
      allowInsecureTls: !!row.allow_insecure_tls,
      providerId: row.provider_id,
      authType: override?.authType || row.auth_type,
      getAuth: override ? this.draftAuth(override, row.username) : () => this.resolveAuth(row)
    }, (steps) => this.emit({ type: 'diagnose-progress', runId, steps }), this.log);
  }

  private secretFromInput(input: AccountCredentialInput): { secret: StoredSecret; oauthProvider: OAuthProviderId | null } {
    if (input.authType === 'oauth2') {
      const s = input.oauthSession ? this.oauth.take(input.oauthSession) : null;
      if (!s) throw new Error('OAuth2 授权已过期，请重新点击登录按钮完成授权。');
      return { secret: { oauth: s.tokens }, oauthProvider: s.provider };
    }
    if (!input.password) throw new Error('请填写密码 / 授权码');
    return { secret: { password: input.password }, oauthProvider: null };
  }

  addAccount(input: AccountDraftInput): AccountSummary {
    const email = input.email.trim().toLowerCase();
    if (!isValidEmail(email)) throw new Error('邮箱地址格式不正确');
    if (this.store.listAccountRows().some((r) => r.email === email)) throw new Error('这个邮箱已经添加过了');
    const { secret, oauthProvider } = this.secretFromInput(input);
    const provider = providerById(input.providerId) || providerForImapHost(input.imap.host, input.imap.port);
    const used = new Set(this.store.listAccountRows().map((r) => r.color));
    const color = ACCOUNT_COLORS.find((c) => !used.has(c)) || ACCOUNT_COLORS[this.store.listAccountRows().length % ACCOUNT_COLORS.length];
    const id = this.store.insertAccount({
      email,
      display_name: input.displayName.trim() || email.split('@')[0],
      label: '',
      color,
      provider_id: provider?.id || input.providerId,
      provider_name: provider?.name || email.split('@')[1],
      auth_type: input.authType,
      oauth_provider: oauthProvider || input.oauthProvider || null,
      imap_host: input.imap.host.trim(),
      imap_port: input.imap.port,
      imap_security: input.imap.security,
      smtp_host: input.smtp.host.trim(),
      smtp_port: input.smtp.port,
      smtp_security: input.smtp.security,
      username: input.username.trim(),
      smtp_username: input.smtpUsername?.trim() || null,
      allow_insecure_tls: input.allowInsecureTls ? 1 : 0,
      secret: this.encryptSecret(secret),
      signature: '',
      enabled: 1,
      quirks: JSON.stringify(provider?.quirks || {})
    });
    const row = this.store.getAccountRow(id)!;
    if (this.settings.get().defaultAccountId == null) this.settings.update({ defaultAccountId: id });
    this.startSync(row);
    this.emit({ type: 'accounts-changed' });
    return this.accountSummary(row);
  }

  async updateAccount(id: number, patch: AccountPatch): Promise<AccountSummary> {
    const row = this.store.getAccountRow(id);
    if (!row) throw new Error('账户不存在');
    const fields: Partial<AccountRow> = {};
    let reconnect = false;
    if (patch.displayName !== undefined) fields.display_name = patch.displayName;
    if (patch.label !== undefined) fields.label = patch.label;
    if (patch.color !== undefined) fields.color = patch.color;
    if (patch.signature !== undefined) fields.signature = patch.signature;
    if (patch.imap) { fields.imap_host = patch.imap.host.trim(); fields.imap_port = patch.imap.port; fields.imap_security = patch.imap.security; reconnect = true; }
    if (patch.smtp) { fields.smtp_host = patch.smtp.host.trim(); fields.smtp_port = patch.smtp.port; fields.smtp_security = patch.smtp.security; }
    if (patch.username !== undefined) { fields.username = patch.username.trim(); reconnect = true; }
    if (patch.smtpUsername !== undefined) fields.smtp_username = patch.smtpUsername?.trim() || null;
    if (patch.allowInsecureTls !== undefined) { fields.allow_insecure_tls = patch.allowInsecureTls ? 1 : 0; reconnect = true; }
    if (patch.credentials) {
      const { secret, oauthProvider } = this.secretFromInput(patch.credentials);
      fields.secret = this.encryptSecret(secret);
      fields.auth_type = patch.credentials.authType;
      fields.oauth_provider = oauthProvider;
      reconnect = true;
    }
    if (patch.enabled !== undefined) fields.enabled = patch.enabled ? 1 : 0;
    this.store.updateAccountFields(id, fields);
    const updated = this.store.getAccountRow(id)!;
    const existing = this.syncs.get(id);
    if (!updated.enabled && existing) {
      await existing.stop();
      this.syncs.delete(id);
    } else if (updated.enabled && !existing) {
      this.startSync(updated);
    } else if (existing) {
      existing.updateAccount(updated);
      if (reconnect) await existing.restart();
    }
    this.emit({ type: 'accounts-changed' });
    return this.accountSummary(updated);
  }

  async removeAccount(id: number) {
    const s = this.syncs.get(id);
    if (s) { await s.stop(); this.syncs.delete(id); }
    this.store.deleteAccount(id);
    this.bodies.removeAccount(id);
    for (const k of [...this.parsedCache.keys()]) if (!this.store.getRow(k)) this.parsedCache.delete(k);
    const st = this.settings.get();
    if (st.defaultAccountId === id) this.settings.update({ defaultAccountId: this.store.listAccountRows()[0]?.id ?? null });
    this.emit({ type: 'accounts-changed' });
  }

  reorderAccounts(ids: number[]) {
    this.db.transaction(() => ids.forEach((id, i) => this.store.updateAccountFields(id, { sort_order: i })));
    this.emit({ type: 'accounts-changed' });
  }

  async startOAuth(provider: OAuthProviderId, loginHint?: string): Promise<OAuthResult> {
    try {
      const r = await this.oauth.start(provider, loginHint);
      return { session: r.session, email: r.email, provider };
    } catch (e: any) {
      const d = explainError(e, { phase: 'oauth' });
      throw new SyncError(d.title, d);
    }
  }

  cancelOAuth() {
    this.oauth.cancel();
  }

  syncNow(accountId?: number | null) {
    if (accountId) this.syncs.get(accountId)?.syncNow();
    else for (const s of this.syncs.values()) s.syncNow();
  }

  // ================================================================ folders

  listFolders(): FolderInfo[] {
    return this.store.folderInfos();
  }

  setActiveFolder(folderId: number | null) {
    if (folderId == null) return;
    const f = this.store.getFolder(folderId);
    if (f) this.syncs.get(f.account_id)?.setActiveFolder(folderId);
  }

  async createFolder(accountId: number, name: string, parentPath?: string | null) {
    const clean = name.trim();
    if (!clean) throw new Error('请输入文件夹名称');
    const sync = this.sync(accountId);
    const delim = sync.delimiter();
    if (clean.includes(delim)) throw new Error(`文件夹名称不能包含「${delim}」`);
    await sync.createFolder(parentPath ? `${parentPath}${delim}${clean}` : clean);
  }

  async renameFolder(folderId: number, newName: string) {
    const f = this.store.getFolder(folderId);
    if (!f) throw new Error('文件夹不存在');
    if (f.special_use) throw new Error('系统文件夹不能重命名');
    const sync = this.sync(f.account_id);
    const delim = f.delimiter || sync.delimiter();
    const parent = f.parent_path || (f.path.includes(delim) ? f.path.slice(0, f.path.lastIndexOf(delim)) : '');
    await sync.renameFolder(f.path, parent ? `${parent}${delim}${newName.trim()}` : newName.trim());
  }

  async deleteFolder(folderId: number) {
    const f = this.store.getFolder(folderId);
    if (!f) return;
    if (f.special_use) throw new Error('系统文件夹不能删除');
    await this.sync(f.account_id).deleteFolder(f.path);
  }

  // ================================================================ listing

  listMessages(q: ListQuery, start: number, count: number): ListResult {
    const r = this.store.listMessages(q, start, Math.min(count, 500));
    return { ...r, start };
  }

  categoryCounts(q: ListQuery) {
    return this.store.categoryCounts(q);
  }

  unifiedCounts() {
    const outbox = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM outbox WHERE status != 'sent'")?.c ?? 0;
    return this.store.unifiedCounts(outbox);
  }

  ensurePreviews(ids: number[]) {
    const byAccount = new Map<number, number[]>();
    for (const r of this.store.missingPreviews(ids)) {
      if (!byAccount.has(r.account_id)) byAccount.set(r.account_id, []);
      byAccount.get(r.account_id)!.push(r.id);
    }
    for (const [acc, list] of byAccount) this.syncs.get(acc)?.ensurePreviews(list).catch(() => {});
  }

  // ================================================================ message content

  private async rawSource(row: MessageRow): Promise<Buffer> {
    const cached = this.bodies.read(row.account_id, row.id);
    if (cached) return cached;
    const raw = await this.sync(row.account_id).fetchSource(row.id);
    this.bodies.write(row.account_id, row.id, raw);
    void this.indexBody(row.id, raw);
    return raw;
  }

  async parsed(id: number): Promise<{ row: MessageRow; mail: ParsedMail }> {
    const row = this.store.getRow(id);
    if (!row) throw new SyncError('邮件不存在', { kind: 'gone', title: '邮件不存在', explanation: '这封邮件已被删除或移动。', suggestions: [], needsUserAction: false });
    const hit = this.parsedCache.get(id);
    if (hit) {
      this.parsedCache.delete(id);
      this.parsedCache.set(id, hit);
      return { row, mail: hit };
    }
    const raw = await this.rawSource(row);
    const mail = await simpleParser(raw, { skipImageLinks: true, skipTextLinks: false, maxHtmlLengthToParse: 8 * 1024 * 1024 } as SimpleParserOptions);
    if (raw.length < 30 * 1024 * 1024) {
      this.parsedCache.set(id, mail);
      while (this.parsedCache.size > 16) this.parsedCache.delete(this.parsedCache.keys().next().value!);
    }
    return { row, mail };
  }

  private async indexBody(id: number, raw: Buffer) {
    try {
      const mail = await simpleParser(raw, { skipImageLinks: true, skipTextLinks: true } as SimpleParserOptions);
      const text = (mail.text || (mail.html ? htmlToText(mail.html) : '')).slice(0, 200_000);
      const row = this.store.getRow(id);
      if (!row) return;
      this.store.setBodyCached(id, true, `${text}\n${mail.attachments.map((a) => a.filename || '').join(' ')}`);
      if (row.snippet === null || row.snippet === '') this.store.setSnippet(id, makeSnippet(text));
    } catch (e) {
      this.log.warn(`index body ${id} failed: ${(e as Error).message}`);
    }
  }

  attachmentInfos(mail: ParsedMail): AttachmentInfo[] {
    const html = typeof mail.html === 'string' ? mail.html : '';
    return mail.attachments.map((a, index) => {
      const cid = a.cid || (a.contentId ? a.contentId.replace(/^<|>$/g, '') : null);
      const referenced = !!cid && html.includes(`cid:${cid}`);
      return {
        index,
        filename: a.filename || defaultFilename(a.contentType, index),
        contentType: a.contentType || 'application/octet-stream',
        size: a.size || (a.content ? a.content.length : 0),
        inline: referenced,
        contentId: cid
      };
    });
  }

  async getMessage(id: number): Promise<MessageDetail> {
    const { row, mail } = await this.parsed(id);
    const folder = this.store.getFolder(row.folder_id);
    const from = row.from_addr ? { name: row.from_name, address: row.from_addr } : null;
    return {
      id: row.id,
      accountId: row.account_id,
      folderId: row.folder_id,
      uid: row.uid,
      msgKey: row.msg_key,
      threadKey: row.thread_key,
      subject: row.subject || mail.subject || '',
      from,
      to: JSON.parse(row.to_json),
      cc: JSON.parse(row.cc_json),
      bcc: JSON.parse(row.bcc_json || '[]'),
      replyTo: addrList(mail.replyTo),
      date: row.date,
      snippet: row.snippet,
      seen: !!row.seen,
      flagged: !!row.flagged,
      answered: !!row.answered,
      forwarded: !!row.forwarded,
      draft: !!row.draft,
      hasAttachments: !!row.has_attachments,
      category: row.category,
      size: row.size,
      bodyCached: true,
      messageId: row.message_id,
      inReplyTo: row.in_reply_to,
      references: row.refs ? row.refs.split(' ').filter(Boolean) : [],
      html: typeof mail.html === 'string' ? mail.html : null,
      text: mail.text || null,
      attachments: this.attachmentInfos(mail),
      listUnsubscribe: row.list_unsubscribe,
      trustedSender: from ? this.store.isTrusted(from.address) : false,
      folderPath: folder?.path || '',
      folderSpecialUse: folder?.special_use || null
    };
  }

  getThread(id: number): { ids: number[]; current: number } {
    const row = this.store.getRow(id);
    if (!row) return { ids: [], current: id };
    if (!this.settings.get().conversationView) return { ids: [id], current: id };
    const ids = this.store.threadIds(row.account_id, row.thread_key);
    if (!ids.includes(id)) ids.push(id);
    return { ids: ids.slice(-30), current: id };
  }

  async attachment(messageId: number, index: number): Promise<{ filename: string; contentType: string; content: Buffer }> {
    const { mail } = await this.parsed(messageId);
    const a = mail.attachments[index];
    if (!a) throw new Error('附件不存在');
    return { filename: sanitizeFilename(a.filename || defaultFilename(a.contentType, index)), contentType: a.contentType || 'application/octet-stream', content: a.content as Buffer };
  }

  async allAttachments(messageId: number) {
    const { mail } = await this.parsed(messageId);
    const infos = this.attachmentInfos(mail);
    return mail.attachments.map((a, i) => ({ filename: sanitizeFilename(infos[i].filename), content: a.content as Buffer, inline: infos[i].inline }));
  }

  async getSource(messageId: number): Promise<{ raw: Buffer; subject: string }> {
    const row = this.store.getRow(messageId);
    if (!row) throw new Error('邮件不存在');
    return { raw: await this.rawSource(row), subject: row.subject };
  }

  trustSender(address: string) {
    this.store.trust(address);
  }

  // ================================================================ flags & moves

  private related(ids: number[]): MessageRow[] {
    // For Gmail the same message appears in several folders (labels); keep local copies consistent.
    const rows = this.store.getRows(ids);
    const extra: MessageRow[] = [];
    for (const r of rows) {
      const acc = this.store.getAccountRow(r.account_id);
      if (!acc || !/imap\.gmail\.com$/i.test(acc.imap_host)) continue;
      extra.push(...this.db.all<MessageRow>('SELECT * FROM messages WHERE account_id = ? AND msg_key = ? AND id != ?', r.account_id, r.msg_key, r.id));
    }
    return [...rows, ...extra];
  }

  private emitChanged(rows: Array<{ account_id: number; folder_id: number }>, reason: string, extraFolders: number[] = []) {
    const byAcc = new Map<number, Set<number>>();
    for (const r of rows) {
      if (!byAcc.has(r.account_id)) byAcc.set(r.account_id, new Set());
      byAcc.get(r.account_id)!.add(r.folder_id);
    }
    for (const f of extraFolders) {
      const row = this.store.getFolder(f);
      if (!row) continue;
      if (!byAcc.has(row.account_id)) byAcc.set(row.account_id, new Set());
      byAcc.get(row.account_id)!.add(f);
    }
    for (const [accountId, folders] of byAcc) this.emit({ type: 'messages-changed', accountId, folderIds: [...folders], reason });
  }

  private setFlag(ids: number[], column: 'seen' | 'flagged', flag: string, value: boolean) {
    const rows = this.related(ids).filter((r) => !!r[column] !== value);
    if (!rows.length) return;
    this.store.setLocalFlag(rows.map((r) => r.id), column, value);
    this.emitChanged(rows, 'flags');
    const primary = rows.filter((r) => ids.includes(r.id));
    const byAccount = new Map<number, number[]>();
    for (const r of primary) {
      if (!byAccount.has(r.account_id)) byAccount.set(r.account_id, []);
      byAccount.get(r.account_id)!.push(r.id);
    }
    for (const [acc, list] of byAccount) {
      const s = this.syncs.get(acc);
      if (!s) continue;
      s.storeFlag(list, flag, value).catch((e) => {
        this.store.setLocalFlag(rows.filter((r) => r.account_id === acc).map((r) => r.id), column, !value);
        this.emitChanged(rows, 'flags-revert');
        this.toastError(e, column === 'seen' ? '无法更新已读状态' : '无法更新星标');
      });
    }
  }

  setSeen(ids: number[], seen: boolean) {
    this.setFlag(ids, 'seen', '\\Seen', seen);
  }

  setFlagged(ids: number[], flagged: boolean) {
    this.setFlag(ids, 'flagged', '\\Flagged', flagged);
  }

  markFolderRead(folderId: number) {
    const ids = this.db.all<{ id: number }>('SELECT id FROM messages WHERE folder_id = ? AND seen = 0 AND uid > 0', folderId).map((r) => r.id);
    if (ids.length) this.setSeen(ids, true);
  }

  private toastError(e: any, title: string) {
    const d: Diagnosis | undefined = e?.diagnosis;
    this.emit({ type: 'toast', kind: 'error', message: title, detail: d ? `${d.title}：${d.explanation}` : e?.message });
  }

  /** Optimistically moves rows to per-account destinations; returns an undo token. */
  private moveRows(rows: MessageRow[], destFor: (r: MessageRow) => number | null, label: string): string | null {
    const movable = rows.filter((r) => r.uid > 0);
    const plan = movable.map((r) => ({ row: r, dest: destFor(r) })).filter((p) => p.dest && p.dest !== p.row.folder_id) as Array<{ row: MessageRow; dest: number }>;
    if (!plan.length) return null;
    for (const p of plan) this.store.moveLocal(p.row.id, p.dest, -p.row.id);
    this.emitChanged(plan.map((p) => p.row), 'move', plan.map((p) => p.dest));
    const pendings: Promise<unknown>[] = [];
    const groups = new Map<string, typeof plan>();
    for (const p of plan) {
      const k = `${p.row.account_id}:${p.dest}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    for (const [, list] of groups) {
      const acc = list[0].row.account_id;
      const dest = list[0].dest;
      const items = list.map((p) => ({ id: p.row.id, folderId: p.row.folder_id, uid: p.row.uid }));
      const s = this.syncs.get(acc);
      if (!s) continue;
      pendings.push(s.move(items, dest).then((map) => {
        let missing = false;
        for (const it of items) {
          const uid = map.get(it.id);
          if (uid) this.store.finalizeMove(it.id, dest, uid);
          else { this.store.deleteByIds([it.id]); this.bodies.remove(acc, [it.id]); this.parsedCache.delete(it.id); missing = true; }
        }
        if (missing) s.syncFolderNow(dest).catch(() => {});
        this.emitChanged([], 'move-done', [dest]);
      }).catch((e) => {
        for (const it of items) this.store.moveLocal(it.id, it.folderId, it.uid);
        this.emitChanged([], 'move-revert', [dest, ...items.map((i) => i.folderId)]);
        this.toastError(e, `${label}失败`);
        throw e;
      }));
    }
    const token = crypto.randomUUID();
    this.undos.set(token, {
      accountId: plan[0].row.account_id,
      items: plan.map((p) => ({ id: p.row.id, folderId: p.row.folder_id })),
      pending: Promise.allSettled(pendings),
      created: Date.now()
    });
    for (const [k, v] of this.undos) if (Date.now() - v.created > 10 * 60_000) this.undos.delete(k);
    return token;
  }

  async undo(token: string) {
    const u = this.undos.get(token);
    if (!u) throw new Error('无法撤销：操作已过期');
    this.undos.delete(token);
    await u.pending;
    const rows = this.store.getRows(u.items.map((i) => i.id));
    const back = new Map(u.items.map((i) => [i.id, i.folderId]));
    this.moveRows(rows, (r) => back.get(r.id) ?? null, '撤销');
  }

  moveMessages(ids: number[], destFolderId: number) {
    const dest = this.store.getFolder(destFolderId);
    if (!dest) throw new Error('目标文件夹不存在');
    const rows = this.store.getRows(ids).filter((r) => r.account_id === dest.account_id);
    return { undoToken: this.moveRows(rows, () => destFolderId, '移动') };
  }

  private async specialFolder(accountId: number, su: SpecialUse, createName?: string): Promise<number | null> {
    const f = this.store.folderBySpecial(accountId, su);
    if (f) return f.id;
    if (!createName) return null;
    const sync = this.sync(accountId);
    const path = await sync.createFolder(createName);
    const created = this.store.folderByPath(accountId, path);
    if (!created) return null;
    this.store.updateFolder(created.id, { special_use: su });
    this.emit({ type: 'folders-changed', accountId });
    return created.id;
  }

  async archiveMessages(ids: number[]) {
    const rows = this.store.getRows(ids);
    const dests = new Map<number, number | null>();
    for (const acc of new Set(rows.map((r) => r.account_id))) {
      const isGmail = /imap\.gmail\.com$/i.test(this.store.getAccountRow(acc)?.imap_host || '');
      dests.set(acc, isGmail ? await this.specialFolder(acc, 'all') : await this.specialFolder(acc, 'archive', 'Archive'));
    }
    return { undoToken: this.moveRows(rows, (r) => dests.get(r.account_id) ?? null, '归档') };
  }

  async trashMessages(ids: number[]) {
    const rows = this.store.getRows(ids);
    const permanent: MessageRow[] = [];
    const toTrash: MessageRow[] = [];
    const dests = new Map<number, number | null>();
    for (const r of rows) {
      if (!dests.has(r.account_id)) dests.set(r.account_id, await this.specialFolder(r.account_id, 'trash', 'Trash'));
      const f = this.store.getFolder(r.folder_id);
      if (f?.special_use === 'trash' || !dests.get(r.account_id)) permanent.push(r);
      else toTrash.push(r);
    }
    if (permanent.length) await this.deletePermanently(permanent.map((r) => r.id));
    return { undoToken: this.moveRows(toTrash, (r) => dests.get(r.account_id) ?? null, '删除'), permanent: permanent.length > 0 && !toTrash.length };
  }

  async deletePermanently(ids: number[]) {
    const rows = this.store.getRows(ids).filter((r) => r.uid > 0);
    if (!rows.length) return;
    this.store.deleteByIds(rows.map((r) => r.id));
    this.emitChanged(rows, 'delete');
    for (const acc of new Set(rows.map((r) => r.account_id))) {
      const list = rows.filter((r) => r.account_id === acc);
      this.bodies.remove(acc, list.map((r) => r.id));
      try {
        await this.sync(acc).expunge(list.map((r) => ({ folderId: r.folder_id, uid: r.uid })));
      } catch (e) {
        this.toastError(e, '永久删除失败');
        for (const f of new Set(list.map((r) => r.folder_id))) this.syncs.get(acc)?.syncFolderNow(f).catch(() => {});
      }
    }
  }

  async markSpam(ids: number[], spam: boolean) {
    const rows = this.store.getRows(ids);
    const dests = new Map<number, number | null>();
    for (const acc of new Set(rows.map((r) => r.account_id))) {
      dests.set(acc, spam ? await this.specialFolder(acc, 'junk', 'Junk') : await this.specialFolder(acc, 'inbox'));
    }
    return { undoToken: this.moveRows(rows, (r) => dests.get(r.account_id) ?? null, spam ? '移入垃圾邮件' : '移回收件箱') };
  }

  setCategory(ids: number[], category: Category, applyToSender: boolean) {
    const rows = this.store.getRows(ids);
    if (applyToSender) for (const a of new Set(rows.map((r) => r.from_addr).filter(Boolean))) this.store.setSenderRule(a, category);
    else this.store.setCategory(ids, category);
    this.emitChanged(rows, 'category');
  }

  // ================================================================ notifications

  private onNewMail(accountId: number, ids: number[]) {
    const st = this.settings.get();
    if (!st.notifications) return;
    const rows = this.store.getRows(ids).filter((r) => !r.seen && Date.now() - r.date < 3 * 24 * 3600_000);
    if (!rows.length) return;
    this.platform.notifyNewMail(rows.map((r) => ({
      accountId,
      id: r.id,
      from: r.from_name || r.from_addr || '（未知发件人）',
      subject: r.subject || '（无主题）',
      snippet: r.snippet || ''
    })));
  }

  // ================================================================ search

  async searchServer(query: string, accountId?: number | null): Promise<SearchServerResult> {
    const text = query.replace(/\b[a-z_]+[:：]("[^"]*"|\S+)/gi, '').trim() || query.trim();
    if (!text) return { imported: 0, searchedFolders: 0, errors: [] };
    let imported = 0;
    let searched = 0;
    const errors: string[] = [];
    const accounts = this.store.listAccountRows().filter((a) => a.enabled && (!accountId || a.id === accountId));
    await Promise.all(accounts.map(async (a) => {
      const s = this.syncs.get(a.id);
      if (!s) return;
      const folders = this.store.listFolderRows(a.id).filter((f) => f.selectable && f.sync_enabled);
      const all = folders.find((f) => f.special_use === 'all');
      const targets = all ? [all] : folders.filter((f) => f.special_use !== 'trash' && f.special_use !== 'junk');
      try {
        const r = await s.searchServer(text, targets.map((f) => f.id));
        imported += r.imported;
        searched += r.folders;
        errors.push(...r.errors.map((e) => `${a.email}: ${e}`));
      } catch (e: any) {
        errors.push(`${a.email}: ${e?.message || e}`);
      }
    }));
    return { imported, searchedFolders: searched, errors };
  }

  // ================================================================ compose

  suggestContacts(prefix: string): ContactSuggestion[] {
    if (!prefix.trim()) return [];
    return this.store.suggestContacts(prefix.trim());
  }

  private myAddresses(): Set<string> {
    return new Set(this.store.listAccountRows().map((r) => r.email.toLowerCase()));
  }

  async composePrefill(mode: 'reply' | 'replyAll' | 'forward' | 'draft', messageId: number): Promise<ComposePrefill> {
    const { row, mail } = await this.parsed(messageId);
    const mine = this.myAddresses();
    const from: Address | null = row.from_addr ? { name: row.from_name, address: row.from_addr } : null;
    const to: Address[] = JSON.parse(row.to_json);
    const cc: Address[] = JSON.parse(row.cc_json);
    const replyTo = addrList(mail.replyTo);
    const folder = this.store.getFolder(row.folder_id);
    const html = typeof mail.html === 'string' ? mail.html : mail.textAsHtml || `<pre>${escapeHtml(mail.text || '')}</pre>`;
    const inlined = this.inlineCidImages(html, mail);
    const base: ComposePrefill = {
      mode, accountId: row.account_id, to: [], cc: [], bcc: [], subject: '', html: '', attachments: [],
      inReplyTo: null, references: [], replyToMessageId: null, forwardOfMessageId: null, draftId: null, serverDraftMessageId: null
    };
    if (mode === 'draft') {
      return {
        ...base,
        to, cc, bcc: JSON.parse(row.bcc_json || '[]'),
        subject: row.subject,
        html: inlined,
        attachments: this.attachmentInfos(mail).filter((a) => !a.inline).map((a) => ({ fromMessage: { messageId, index: a.index }, filename: a.filename, contentType: a.contentType, size: a.size })),
        inReplyTo: row.in_reply_to,
        references: row.refs ? row.refs.split(' ').filter(Boolean) : [],
        serverDraftMessageId: messageId
      };
    }
    const when = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(row.date));
    const sender = from ? escapeHtml(fmtAddr(from)) : '（未知发件人）';
    if (mode === 'forward') {
      const header = [
        '---------- 转发的邮件 ----------',
        `发件人：${sender}`,
        `日期：${escapeHtml(when)}`,
        `主题：${escapeHtml(row.subject)}`,
        `收件人：${escapeHtml(to.map(fmtAddr).join(', '))}`,
        cc.length ? `抄送：${escapeHtml(cc.map(fmtAddr).join(', '))}` : ''
      ].filter(Boolean).join('<br>');
      return {
        ...base,
        subject: /^(fwd?|转发)\s*[:：]/i.test(row.subject) ? row.subject : `Fwd: ${row.subject}`,
        html: `<div class="hy-forward"><div style="color:#6b6b6b">${header}</div><br>${inlined}</div>`,
        attachments: this.attachmentInfos(mail).filter((a) => !a.inline).map((a) => ({ fromMessage: { messageId, index: a.index }, filename: a.filename, contentType: a.contentType, size: a.size })),
        forwardOfMessageId: messageId
      };
    }
    const fromMe = (from && mine.has(from.address)) || folder?.special_use === 'sent';
    let replyTargets = fromMe ? to : replyTo.length ? replyTo : from ? [from] : [];
    let ccList: Address[] = [];
    if (mode === 'replyAll') {
      const seen = new Set(replyTargets.map((a) => a.address));
      const all = fromMe ? cc : [...to, ...cc];
      ccList = all.filter((a) => !mine.has(a.address) && !seen.has(a.address) && (seen.add(a.address), true));
    }
    replyTargets = replyTargets.filter((a, i, arr) => arr.findIndex((b) => b.address === a.address) === i);
    const refs = row.refs ? row.refs.split(' ').filter(Boolean) : [];
    if (row.message_id && !refs.includes(row.message_id)) refs.push(row.message_id);
    return {
      ...base,
      to: replyTargets,
      cc: ccList,
      subject: /^(re|回复|答复)\s*[:：]/i.test(row.subject) ? row.subject : `Re: ${baseSubject(row.subject) === row.subject ? row.subject : row.subject}`,
      html: `<div class="hy-quote-header">${escapeHtml(when)}，${sender} 写道：</div><blockquote type="cite" class="hy-quote">${inlined}</blockquote>`,
      inReplyTo: row.message_id,
      references: refs.slice(-20),
      replyToMessageId: messageId
    };
  }

  private inlineCidImages(html: string, mail: ParsedMail): string {
    let budget = 3 * 1024 * 1024;
    return html.replace(/(["'(])cid:([^"')\s]+)/gi, (m, q, cid) => {
      const a = mail.attachments.find((x) => (x.cid || x.contentId?.replace(/^<|>$/g, '')) === cid);
      if (!a || !a.content || a.size > budget) return `${q}`;
      budget -= a.size;
      return `${q}data:${a.contentType};base64,${(a.content as Buffer).toString('base64')}`;
    });
  }

  statFiles(paths: string[]): ComposeAttachment[] {
    const out: ComposeAttachment[] = [];
    for (const p of paths) {
      try {
        const st = fs.statSync(p);
        if (st.isFile()) out.push({ path: p, filename: path.basename(p), size: st.size });
      } catch { /* skip */ }
    }
    return out;
  }

  private outboxDir(id: number) {
    return path.join(this.platform.dataDir, 'outbox', String(id));
  }

  send(payload: ComposePayload, sendAt?: number | null): { outboxId: number; sendAt: number } {
    const acc = this.store.getAccountRow(payload.accountId);
    if (!acc) throw new Error('请选择发件账户');
    const recipients = [...payload.to, ...payload.cc, ...payload.bcc];
    if (!recipients.length) throw new Error('请至少填写一位收件人');
    const bad = recipients.filter((r) => !isValidEmail(r.address));
    if (bad.length) throw new Error(`收件人地址无效：${bad.map((b) => b.address).join('、')}`);
    const total = payload.attachments.reduce((s, a) => s + (a.size || 0), 0);
    if (total > 50 * 1024 * 1024) throw new Error('附件总大小超过 50 MB，大多数邮件服务器不会接受，请改用网盘链接。');
    const when = sendAt && sendAt > Date.now() ? sendAt : Date.now() + Math.max(0, this.settings.get().undoSendSeconds) * 1000;
    const id = this.db.run('INSERT INTO outbox (account_id, data, send_at, status, created_at) VALUES (?, ?, ?, ?, ?)',
      payload.accountId, JSON.stringify(payload), when, 'queued', Date.now()).lastInsertRowid;
    // Copy local attachments now so that later edits or deletions of the originals do not matter.
    const stored = payload.attachments.map((a, i) => {
      if (!a.path) return a;
      const dir = this.outboxDir(id);
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, `${i}-${sanitizeFilename(a.filename)}`);
      fs.copyFileSync(a.path, dest);
      return { ...a, storedPath: dest } as ComposeAttachment & { storedPath: string };
    });
    this.db.run('UPDATE outbox SET data = ? WHERE id = ?', JSON.stringify({ ...payload, attachments: stored }), id);
    if (payload.draftId) this.deleteDraft(payload.draftId);
    this.emit({ type: 'outbox-changed' });
    this.scheduleOutbox();
    return { outboxId: id, sendAt: when };
  }

  cancelSend(outboxId: number): ComposePayload | null {
    const row = this.db.get<{ data: string; status: string }>('SELECT data, status FROM outbox WHERE id = ?', outboxId);
    if (!row || row.status === 'sending' || row.status === 'sent') return null;
    this.db.run('DELETE FROM outbox WHERE id = ?', outboxId);
    const payload = JSON.parse(row.data) as ComposePayload;
    // Point attachments at the outbox copies (the originals may be gone); keep the copies around.
    payload.attachments = payload.attachments.map((a: any) => (a.storedPath ? { ...a, path: a.storedPath } : a));
    this.emit({ type: 'outbox-changed' });
    this.scheduleOutbox();
    return payload;
  }

  editOutbox(id: number): ComposePayload | null {
    return this.cancelSend(id);
  }

  listOutbox(): OutboxItem[] {
    return this.db.all<any>("SELECT * FROM outbox WHERE status != 'sent' ORDER BY send_at").map((r) => {
      const p = JSON.parse(r.data) as ComposePayload;
      return { id: r.id, accountId: r.account_id, subject: p.subject, to: p.to, sendAt: r.send_at, status: r.status, error: r.error ? JSON.parse(r.error) : null, attempts: r.attempts, createdAt: r.created_at };
    });
  }

  retryOutbox(id: number) {
    this.db.run("UPDATE outbox SET status = 'queued', send_at = ?, error = NULL WHERE id = ? AND status = 'failed'", Date.now(), id);
    this.emit({ type: 'outbox-changed' });
    this.scheduleOutbox(0);
  }

  deleteOutbox(id: number) {
    this.db.run("DELETE FROM outbox WHERE id = ? AND status != 'sending'", id);
    fs.rmSync(this.outboxDir(id), { recursive: true, force: true });
    this.emit({ type: 'outbox-changed' });
  }

  private scheduleOutbox(delay?: number) {
    if (this.outboxTimer) clearTimeout(this.outboxTimer);
    const next = this.db.get<{ t: number | null }>("SELECT MIN(send_at) AS t FROM outbox WHERE status = 'queued'")?.t;
    if (next == null) return;
    const wait = delay ?? Math.max(0, next - Date.now());
    this.outboxTimer = setTimeout(() => void this.processOutbox(), Math.min(wait, 2 ** 31 - 1));
  }

  private async processOutbox() {
    if (this.outboxBusy) return;
    this.outboxBusy = true;
    try {
      for (;;) {
        const item = this.db.get<any>("SELECT * FROM outbox WHERE status = 'queued' AND send_at <= ? ORDER BY send_at LIMIT 1", Date.now());
        if (!item) break;
        if (!this.online) break;
        this.db.run("UPDATE outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ?", item.id);
        this.emit({ type: 'outbox-changed' });
        const payload = JSON.parse(item.data) as ComposePayload;
        try {
          await this.deliver(item.id, payload);
          this.db.run('DELETE FROM outbox WHERE id = ?', item.id);
          fs.rmSync(this.outboxDir(item.id), { recursive: true, force: true });
          this.emit({ type: 'send-result', outboxId: item.id, ok: true, subject: payload.subject });
        } catch (e: any) {
          const d: Diagnosis = e?.diagnosis || explainError(e, { phase: 'send', providerId: this.store.getAccountRow(payload.accountId)?.provider_id, authType: this.store.getAccountRow(payload.accountId)?.auth_type });
          const attempts = item.attempts + 1;
          const retry = !d.needsUserAction && attempts < 4;
          this.db.run('UPDATE outbox SET status = ?, error = ?, send_at = ? WHERE id = ?',
            retry ? 'queued' : 'failed', JSON.stringify(d), retry ? Date.now() + attempts * 60_000 : item.send_at, item.id);
          this.log.warn(`send ${item.id} failed (${d.kind}): ${e?.message}`);
          this.emit({ type: 'send-result', outboxId: item.id, ok: false, subject: payload.subject, error: d });
        }
        this.emit({ type: 'outbox-changed' });
      }
    } finally {
      this.outboxBusy = false;
      this.scheduleOutbox();
    }
  }

  private async resolveAttachments(payload: ComposePayload) {
    const out: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }> = [];
    for (const a of payload.attachments as Array<ComposeAttachment & { storedPath?: string }>) {
      if (a.fromMessage) {
        const att = await this.attachment(a.fromMessage.messageId, a.fromMessage.index);
        out.push({ filename: a.filename || att.filename, content: att.content, contentType: att.contentType });
      } else if (a.storedPath || a.path) {
        out.push({ filename: a.filename, path: a.storedPath || a.path, contentType: a.contentType });
      }
    }
    return out;
  }

  /** Sends one outbox item over SMTP, then files the copy in Sent and updates flags. */
  private async deliver(outboxId: number, payload: ComposePayload) {
    const acc = this.store.getAccountRow(payload.accountId);
    if (!acc) throw new Error('发件账户已被删除');
    const from: Address = { name: acc.display_name, address: acc.email };
    const messageId = newMessageId(acc.email);
    const msg = {
      from,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      html: payload.html,
      attachments: await this.resolveAttachments(payload),
      inReplyTo: payload.inReplyTo,
      references: payload.references,
      messageId,
      date: new Date()
    };
    const raw = await buildRaw(msg, false);
    const auth = await this.resolveAuth(acc);
    const transport = createTransport({
      server: { host: acc.smtp_host, port: acc.smtp_port, security: acc.smtp_security },
      auth: { ...auth, user: acc.smtp_username || auth.user },
      allowInsecureTls: !!acc.allow_insecure_tls
    });
    try {
      await transport.sendMail({
        envelope: { from: acc.email, to: [...payload.to, ...payload.cc, ...payload.bcc].map((a) => a.address) },
        raw
      } as any);
    } catch (e: any) {
      throw new SyncError(e?.message || '发送失败', explainError(e, {
        phase: 'send', server: { host: acc.smtp_host, port: acc.smtp_port, security: acc.smtp_security }, providerId: acc.provider_id, authType: acc.auth_type
      }));
    } finally {
      transport.close();
    }
    this.log.info(`sent outbox ${outboxId} as ${messageId}`);
    for (const a of [...payload.to, ...payload.cc]) {
      this.db.run(`INSERT INTO contacts (address, name, sent_count, last_at) VALUES (?, ?, 1, ?)
        ON CONFLICT(address) DO UPDATE SET sent_count = contacts.sent_count + 1, last_at = excluded.last_at,
        name = CASE WHEN excluded.name != '' THEN excluded.name ELSE contacts.name END`, a.address, a.name || '', Date.now());
    }
    // Post-send bookkeeping is best effort: the message has been sent already.
    void (async () => {
      const sync = this.syncs.get(acc.id);
      if (!sync) return;
      try {
        if (payload.replyToMessageId) this.markAnswered(payload.replyToMessageId, '\\Answered', 'answered');
        if (payload.forwardOfMessageId) this.markAnswered(payload.forwardOfMessageId, '$Forwarded', 'forwarded');
        if (payload.serverDraftMessageId) await this.deletePermanently([payload.serverDraftMessageId]).catch(() => {});
        const sent = this.store.folderBySpecial(acc.id, 'sent');
        if (!sent) return;
        const quirks = JSON.parse(acc.quirks || '{}');
        await new Promise((r) => setTimeout(r, quirks.smtpSavesSent ? 3000 : 4000));
        if (!quirks.smtpSavesSent && !(await sync.hasMessageId(sent.id, messageId))) {
          await sync.append(sent.id, await buildRaw(msg, true), ['\\Seen']);
        } else {
          await sync.syncFolderNow(sent.id);
        }
      } catch (e) {
        this.log.warn(`post-send bookkeeping failed: ${(e as Error).message}`);
      }
    })();
  }

  private markAnswered(id: number, flag: string, column: 'answered' | 'forwarded') {
    const row = this.store.getRow(id);
    if (!row) return;
    this.store.setLocalFlag([id], column, true);
    this.emitChanged([row], 'flags');
    this.syncs.get(row.account_id)?.storeFlag([id], flag, true).catch(() => {});
  }

  // ---------------- drafts

  async saveDraft(payload: ComposePayload, uploadToServer: boolean): Promise<number> {
    const now = Date.now();
    let id = payload.draftId || 0;
    const existing = id ? this.db.get<{ id: number; server_message_key: string | null }>('SELECT id, server_message_key FROM drafts WHERE id = ?', id) : undefined;
    if (existing) this.db.run('UPDATE drafts SET account_id = ?, data = ?, updated_at = ? WHERE id = ?', payload.accountId, JSON.stringify({ ...payload, draftId: id }), now, id);
    else id = this.db.run('INSERT INTO drafts (account_id, data, updated_at) VALUES (?, ?, ?)', payload.accountId, JSON.stringify(payload), now).lastInsertRowid;
    this.db.run('UPDATE drafts SET data = ? WHERE id = ?', JSON.stringify({ ...payload, draftId: id }), id);
    if (uploadToServer) {
      try { await this.uploadDraft(id, payload); } catch (e) { this.log.warn(`draft upload failed: ${(e as Error).message}`); }
    }
    this.emit({ type: 'drafts-changed' });
    return id;
  }

  private async uploadDraft(draftId: number, payload: ComposePayload) {
    const acc = this.store.getAccountRow(payload.accountId);
    const sync = acc && this.syncs.get(acc.id);
    const folder = acc && this.store.folderBySpecial(acc.id, 'drafts');
    if (!acc || !sync || !folder) return;
    const raw = await buildRaw({
      from: { name: acc.display_name, address: acc.email }, to: payload.to, cc: payload.cc, bcc: payload.bcc,
      subject: payload.subject, html: payload.html, attachments: await this.resolveAttachments(payload),
      inReplyTo: payload.inReplyTo, references: payload.references, messageId: newMessageId(acc.email)
    }, true);
    if (payload.serverDraftMessageId) await this.deletePermanently([payload.serverDraftMessageId]).catch(() => {});
    await sync.append(folder.id, raw, ['\\Draft', '\\Seen']);
    this.db.run('DELETE FROM drafts WHERE id = ?', draftId);
  }

  deleteDraft(id: number) {
    this.db.run('DELETE FROM drafts WHERE id = ?', id);
    this.emit({ type: 'drafts-changed' });
  }

  listDrafts(): DraftRecord[] {
    return this.db.all<any>('SELECT * FROM drafts ORDER BY updated_at DESC').map((r) => ({ ...(JSON.parse(r.data) as ComposePayload), id: r.id, draftId: r.id, updatedAt: r.updated_at }));
  }

  /** Parses List-Unsubscribe and returns the preferred action. */
  unsubscribeTarget(messageId: number): { kind: 'url'; url: string } | { kind: 'mailto'; to: string; subject: string } | null {
    const row = this.store.getRow(messageId);
    if (!row?.list_unsubscribe) return null;
    const targets = [...row.list_unsubscribe.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim());
    const http = targets.find((t) => /^https?:\/\//i.test(t));
    if (http) return { kind: 'url', url: http };
    const mailto = targets.find((t) => /^mailto:/i.test(t));
    if (mailto) {
      const u = new URL(mailto);
      return { kind: 'mailto', to: decodeURIComponent(u.pathname), subject: u.searchParams.get('subject') || 'unsubscribe' };
    }
    return null;
  }

  async unsubscribe(messageId: number): Promise<'opened' | 'sent' | 'none'> {
    const t = this.unsubscribeTarget(messageId);
    if (!t) return 'none';
    if (t.kind === 'url') {
      await this.platform.openExternal(t.url);
      return 'opened';
    }
    const row = this.store.getRow(messageId)!;
    this.send({ accountId: row.account_id, to: [{ name: '', address: t.to }], cc: [], bcc: [], subject: t.subject, html: '<p>unsubscribe</p>', attachments: [] }, Date.now());
    return 'sent';
  }
}

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim();
  return (cleaned || 'attachment').slice(0, 180);
}

export function defaultFilename(contentType: string | undefined, index: number): string {
  const ext: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf',
    'text/calendar': 'ics', 'message/rfc822': 'eml', 'text/plain': 'txt', 'text/html': 'html'
  };
  return `附件${index + 1}.${ext[(contentType || '').toLowerCase()] || 'bin'}`;
}
