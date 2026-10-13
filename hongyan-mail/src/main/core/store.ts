// Data access for accounts, folders, messages, contacts, drafts and the outbox.
import type {
  AccountSummary, Address, AuthType, Category, CategoryCounts, FolderInfo, ListQuery, MessageSummary,
  OAuthProviderId, Security, SpecialUse, UnifiedCounts
} from '../../shared/types';
import { isEmptyQuery, parseQuery, type ParsedQuery } from '../../shared/search';
import { b, type Database } from './db';

export interface AccountRow {
  id: number;
  email: string;
  display_name: string;
  label: string;
  color: string;
  provider_id: string | null;
  provider_name: string;
  auth_type: AuthType;
  oauth_provider: OAuthProviderId | null;
  imap_host: string;
  imap_port: number;
  imap_security: Security;
  smtp_host: string;
  smtp_port: number;
  smtp_security: Security;
  username: string;
  smtp_username: string | null;
  allow_insecure_tls: number;
  secret: Uint8Array | null;
  signature: string;
  sort_order: number;
  enabled: number;
  quirks: string;
  created_at: number;
  last_sync_at: number | null;
}

export interface FolderRow {
  id: number;
  account_id: number;
  path: string;
  name: string;
  delimiter: string | null;
  parent_path: string | null;
  special_use: SpecialUse | null;
  selectable: number;
  subscribed: number;
  uid_validity: string | null;
  uid_next: number | null;
  highest_modseq: string | null;
  server_total: number;
  server_unseen: number | null;
  synced_min_uid: number | null;
  synced_max_uid: number;
  backfill_done: number;
  last_sync_at: number | null;
  last_full_check_at: number | null;
  sync_enabled: number;
}

export interface MessageRow {
  id: number;
  account_id: number;
  folder_id: number;
  uid: number;
  message_id: string | null;
  msg_key: string;
  thread_key: string;
  in_reply_to: string | null;
  refs: string | null;
  subject: string;
  from_name: string;
  from_addr: string;
  to_json: string;
  cc_json: string;
  bcc_json: string;
  reply_to_json: string;
  date: number;
  size: number;
  seen: number;
  flagged: number;
  answered: number;
  forwarded: number;
  draft: number;
  has_attachments: number;
  snippet: string | null;
  preview_part: string | null;
  category: Category;
  list_unsubscribe: string | null;
  body_cached: number;
  created_at: number;
}

export interface NewMessage {
  uid: number;
  messageId: string | null;
  msgKey: string;
  threadKey: string;
  inReplyTo: string | null;
  refs: string[];
  subject: string;
  from: Address | null;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  replyTo: Address[];
  date: number;
  size: number;
  flags: Set<string>;
  hasAttachments: boolean;
  snippet: string | null;
  previewPart: string | null;
  category: Category;
  listUnsubscribe: string | null;
}

const FOLDER_PRIORITY = `CASE f.special_use WHEN 'inbox' THEN 0 WHEN 'sent' THEN 1 WHEN 'archive' THEN 2 WHEN 'drafts' THEN 3 WHEN 'all' THEN 8 WHEN 'trash' THEN 9 WHEN 'junk' THEN 9 ELSE 4 END`;

const SUMMARY_COLS = `m.id, m.account_id, m.folder_id, m.uid, m.msg_key, m.thread_key, m.subject, m.from_name, m.from_addr,
  m.to_json, m.cc_json, m.date, m.snippet, m.seen, m.flagged, m.answered, m.forwarded, m.draft, m.has_attachments,
  m.category, m.size, m.body_cached`;

const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export function rowToSummary(r: any): MessageSummary {
  return {
    id: r.id,
    accountId: r.account_id,
    folderId: r.folder_id,
    uid: r.uid,
    msgKey: r.msg_key,
    threadKey: r.thread_key,
    subject: r.subject,
    from: r.from_addr ? { name: r.from_name, address: r.from_addr } : null,
    to: parseJson(r.to_json, []),
    cc: parseJson(r.cc_json, []),
    date: r.date,
    snippet: r.snippet,
    seen: !!r.seen,
    flagged: !!r.flagged,
    answered: !!r.answered,
    forwarded: !!r.forwarded,
    draft: !!r.draft,
    hasAttachments: !!r.has_attachments,
    category: r.category,
    size: r.size,
    bodyCached: !!r.body_cached
  };
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}

function ftsPhrase(term: string): string {
  return '"' + term.replace(/"/g, '""') + '"';
}

export class MailStore {
  constructor(readonly db: Database) {}

  // ---------------- accounts ----------------

  listAccountRows(): AccountRow[] {
    return this.db.all<AccountRow>('SELECT * FROM accounts ORDER BY sort_order, id');
  }

  getAccountRow(id: number): AccountRow | undefined {
    return this.db.get<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
  }

  accountSummary(r: AccountRow, status: AccountSummary['status']): AccountSummary {
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      label: r.label,
      color: r.color,
      providerId: r.provider_id,
      providerName: r.provider_name,
      authType: r.auth_type,
      oauthProvider: r.oauth_provider,
      imap: { host: r.imap_host, port: r.imap_port, security: r.imap_security },
      smtp: { host: r.smtp_host, port: r.smtp_port, security: r.smtp_security },
      username: r.username,
      smtpUsername: r.smtp_username,
      allowInsecureTls: !!r.allow_insecure_tls,
      signature: r.signature,
      enabled: !!r.enabled,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      status: { ...status, lastSyncAt: r.last_sync_at }
    };
  }

  insertAccount(a: Omit<AccountRow, 'id' | 'created_at' | 'last_sync_at' | 'sort_order'>): number {
    const order = (this.db.get<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM accounts')?.m ?? -1) + 1;
    const r = this.db.run(
      `INSERT INTO accounts (email, display_name, label, color, provider_id, provider_name, auth_type, oauth_provider,
        imap_host, imap_port, imap_security, smtp_host, smtp_port, smtp_security, username, smtp_username,
        allow_insecure_tls, secret, signature, sort_order, enabled, quirks, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      a.email, a.display_name, a.label, a.color, a.provider_id, a.provider_name, a.auth_type, a.oauth_provider,
      a.imap_host, a.imap_port, a.imap_security, a.smtp_host, a.smtp_port, a.smtp_security, a.username, a.smtp_username,
      a.allow_insecure_tls, a.secret, a.signature, order, a.enabled, a.quirks, Date.now()
    );
    return r.lastInsertRowid;
  }

  updateAccountFields(id: number, fields: Partial<AccountRow>) {
    const keys = Object.keys(fields).filter((k) => k !== 'id');
    if (!keys.length) return;
    const sql = `UPDATE accounts SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
    this.db.raw.prepare(sql).run(...keys.map((k) => (fields as any)[k]), id);
  }

  deleteAccount(id: number) {
    this.db.transaction(() => {
      // Clear FTS rows in bulk first (the per-row trigger would be slow for large accounts).
      this.db.run('DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE account_id = ?)', id);
      this.db.run('DELETE FROM messages WHERE account_id = ?', id);
      this.db.run('DELETE FROM accounts WHERE id = ?', id);
      this.db.run('DELETE FROM drafts WHERE account_id = ?', id);
    });
  }

  // ---------------- folders ----------------

  listFolderRows(accountId?: number): FolderRow[] {
    return accountId === undefined
      ? this.db.all<FolderRow>('SELECT * FROM folders ORDER BY account_id, id')
      : this.db.all<FolderRow>('SELECT * FROM folders WHERE account_id = ? ORDER BY id', accountId);
  }

  getFolder(id: number): FolderRow | undefined {
    return this.db.get<FolderRow>('SELECT * FROM folders WHERE id = ?', id);
  }

  folderByPath(accountId: number, path: string): FolderRow | undefined {
    return this.db.get<FolderRow>('SELECT * FROM folders WHERE account_id = ? AND path = ?', accountId, path);
  }

  folderBySpecial(accountId: number, su: SpecialUse): FolderRow | undefined {
    return this.db.get<FolderRow>('SELECT * FROM folders WHERE account_id = ? AND special_use = ? ORDER BY id LIMIT 1', accountId, su);
  }

  upsertFolder(accountId: number, f: { path: string; name: string; delimiter: string | null; parentPath: string | null; specialUse: SpecialUse | null; selectable: boolean; subscribed: boolean; syncEnabled: boolean }): number {
    const existing = this.folderByPath(accountId, f.path);
    if (existing) {
      this.db.run('UPDATE folders SET name = ?, delimiter = ?, parent_path = ?, special_use = ?, selectable = ?, subscribed = ? WHERE id = ?',
        f.name, f.delimiter, f.parentPath, f.specialUse, b(f.selectable), b(f.subscribed), existing.id);
      return existing.id;
    }
    return this.db.run(
      'INSERT INTO folders (account_id, path, name, delimiter, parent_path, special_use, selectable, subscribed, sync_enabled) VALUES (?,?,?,?,?,?,?,?,?)',
      accountId, f.path, f.name, f.delimiter, f.parentPath, f.specialUse, b(f.selectable), b(f.subscribed), b(f.syncEnabled)
    ).lastInsertRowid;
  }

  deleteFolder(id: number) {
    this.db.transaction(() => {
      this.db.run('DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE folder_id = ?)', id);
      this.db.run('DELETE FROM messages WHERE folder_id = ?', id);
      this.db.run('DELETE FROM folders WHERE id = ?', id);
    });
  }

  updateFolder(id: number, fields: Partial<FolderRow>) {
    const keys = Object.keys(fields).filter((k) => k !== 'id');
    if (!keys.length) return;
    this.db.raw.prepare(`UPDATE folders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => (fields as any)[k]), id);
  }

  /** Removes every message of a folder (UIDVALIDITY changed). Returns ids removed. */
  resetFolder(id: number): number[] {
    const ids = this.db.all<{ id: number }>('SELECT id FROM messages WHERE folder_id = ?', id).map((r) => r.id);
    this.db.transaction(() => {
      this.db.run('DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE folder_id = ?)', id);
      this.db.run('DELETE FROM messages WHERE folder_id = ?', id);
      this.db.run('UPDATE folders SET synced_min_uid = NULL, synced_max_uid = 0, backfill_done = 0, highest_modseq = NULL WHERE id = ?', id);
    });
    return ids;
  }

  folderInfos(): FolderInfo[] {
    const rows = this.db.all<FolderRow & { unread: number; cnt: number }>(`
      SELECT f.*, COALESCE(u.unread, 0) AS unread, COALESCE(u.cnt, 0) AS cnt
      FROM folders f
      LEFT JOIN (SELECT folder_id, SUM(seen = 0) AS unread, COUNT(*) AS cnt FROM messages GROUP BY folder_id) u ON u.folder_id = f.id
      ORDER BY f.account_id, f.id`);
    return rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      path: r.path,
      name: r.name,
      parentPath: r.parent_path,
      delimiter: r.delimiter,
      specialUse: r.special_use,
      total: Math.max(r.server_total, r.cnt),
      unread: r.unread,
      selectable: !!r.selectable,
      depth: r.delimiter && r.path.includes(r.delimiter) ? r.path.split(r.delimiter).length - 1 : 0,
      syncedCount: r.cnt,
      backfillDone: !!r.backfill_done
    }));
  }

  // ---------------- messages: sync side ----------------

  uidsInFolder(folderId: number): number[] {
    return this.db.all<{ uid: number }>('SELECT uid FROM messages WHERE folder_id = ? AND uid > 0 ORDER BY uid', folderId).map((r) => r.uid);
  }

  countInFolder(folderId: number): number {
    return this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM messages WHERE folder_id = ? AND uid > 0', folderId)?.c ?? 0;
  }

  flagsInFolder(folderId: number): Map<number, { id: number; seen: number; flagged: number; answered: number; forwarded: number; draft: number }> {
    const map = new Map();
    for (const r of this.db.all('SELECT id, uid, seen, flagged, answered, forwarded, draft FROM messages WHERE folder_id = ? AND uid > 0', folderId)) map.set(r.uid, r);
    return map;
  }

  threadKeyForMsgKey(accountId: number, msgKey: string): string | null {
    return this.db.get<{ thread_key: string }>('SELECT thread_key FROM messages WHERE account_id = ? AND msg_key = ? LIMIT 1', accountId, msgKey)?.thread_key ?? null;
  }

  senderCategory(address: string): Category | null {
    return (this.db.get<{ category: Category }>('SELECT category FROM sender_rules WHERE address = ?', address)?.category) ?? null;
  }

  /** Inserts new messages (ignoring ones already present); returns ids of inserted rows. */
  insertMessages(accountId: number, folderId: number, msgs: NewMessage[], isSentFolder: boolean): number[] {
    const inserted: number[] = [];
    const now = Date.now();
    this.db.transaction(() => {
      for (const m of msgs) {
        const r = this.db.run(
          `INSERT OR IGNORE INTO messages (account_id, folder_id, uid, message_id, msg_key, thread_key, in_reply_to, refs, subject,
            from_name, from_addr, to_json, cc_json, bcc_json, reply_to_json, date, size, seen, flagged, answered, forwarded, draft,
            has_attachments, snippet, preview_part, category, list_unsubscribe, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          accountId, folderId, m.uid, m.messageId, m.msgKey, m.threadKey, m.inReplyTo, m.refs.join(' '), m.subject,
          m.from?.name || '', m.from?.address || '', JSON.stringify(m.to), JSON.stringify(m.cc), JSON.stringify(m.bcc), JSON.stringify(m.replyTo),
          m.date, m.size, b(m.flags.has('\\Seen')), b(m.flags.has('\\Flagged')), b(m.flags.has('\\Answered')), b(m.flags.has('$Forwarded')),
          b(m.flags.has('\\Draft')), b(m.hasAttachments), m.snippet, m.previewPart, m.category, m.listUnsubscribe, now
        );
        if (!r.changes) continue;
        const id = r.lastInsertRowid;
        inserted.push(id);
        const participants = [m.from, ...m.to, ...m.cc].filter(Boolean).map((a) => `${a!.name} ${a!.address}`).join(' ');
        this.db.run('INSERT INTO messages_fts (rowid, subject, participants, body) VALUES (?, ?, ?, ?)', id, m.subject, participants, m.snippet || '');
        this.touchContacts(m, isSentFolder);
      }
    });
    return inserted;
  }

  private touchContacts(m: NewMessage, isSent: boolean) {
    const upsert = (a: Address, sent: boolean) => {
      if (!a.address || /no[-_.]?reply|donotreply|mailer-daemon|postmaster/i.test(a.address)) return;
      this.db.run(
        `INSERT INTO contacts (address, name, seen_count, sent_count, last_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(address) DO UPDATE SET name = CASE WHEN excluded.name != '' THEN excluded.name ELSE contacts.name END,
           seen_count = contacts.seen_count + excluded.seen_count, sent_count = contacts.sent_count + excluded.sent_count,
           last_at = MAX(contacts.last_at, excluded.last_at)`,
        a.address, a.name || '', sent ? 0 : 1, sent ? 1 : 0, m.date
      );
    };
    if (isSent) for (const a of [...m.to, ...m.cc]) upsert(a, true);
    else if (m.from) upsert(m.from, false);
  }

  updateFlags(folderId: number, uid: number, flags: Set<string>): boolean {
    const r = this.db.run(
      'UPDATE messages SET seen = ?, flagged = ?, answered = ?, forwarded = ?, draft = ? WHERE folder_id = ? AND uid = ? AND (seen != ? OR flagged != ? OR answered != ? OR forwarded != ? OR draft != ?)',
      b(flags.has('\\Seen')), b(flags.has('\\Flagged')), b(flags.has('\\Answered')), b(flags.has('$Forwarded')), b(flags.has('\\Draft')),
      folderId, uid,
      b(flags.has('\\Seen')), b(flags.has('\\Flagged')), b(flags.has('\\Answered')), b(flags.has('$Forwarded')), b(flags.has('\\Draft'))
    );
    return r.changes > 0;
  }

  deleteByUids(folderId: number, uids: number[]): number[] {
    const ids: number[] = [];
    this.db.transaction(() => {
      for (const uid of uids) {
        const row = this.db.get<{ id: number }>('SELECT id FROM messages WHERE folder_id = ? AND uid = ?', folderId, uid);
        if (row) {
          ids.push(row.id);
          this.db.run('DELETE FROM messages WHERE id = ?', row.id);
        }
      }
    });
    return ids;
  }

  deleteByIds(ids: number[]) {
    this.db.transaction(() => { for (const id of ids) this.db.run('DELETE FROM messages WHERE id = ?', id); });
  }

  setSnippet(id: number, snippet: string) {
    this.db.run('UPDATE messages SET snippet = ? WHERE id = ?', snippet, id);
    this.db.run("UPDATE messages_fts SET body = ? WHERE rowid = ? AND body = ''", snippet, id);
  }

  setBodyCached(id: number, cached: boolean, text?: string) {
    this.db.run('UPDATE messages SET body_cached = ? WHERE id = ?', b(cached), id);
    if (text !== undefined) this.db.run('UPDATE messages_fts SET body = ? WHERE rowid = ?', text.slice(0, 200_000), id);
  }

  getRow(id: number): MessageRow | undefined {
    return this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', id);
  }

  getRows(ids: number[]): MessageRow[] {
    if (!ids.length) return [];
    return this.db.raw.prepare(`SELECT * FROM messages WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as unknown as MessageRow[];
  }

  setLocalFlag(ids: number[], column: 'seen' | 'flagged' | 'answered' | 'forwarded', value: boolean) {
    this.db.transaction(() => { for (const id of ids) this.db.run(`UPDATE messages SET ${column} = ? WHERE id = ?`, b(value), id); });
  }

  /** Moves a row locally (optimistic move). uid is set to -id until the server reports the new UID. */
  moveLocal(id: number, folderId: number, uid: number) {
    this.db.run('UPDATE messages SET folder_id = ?, uid = ? WHERE id = ?', folderId, uid, id);
  }

  /** Sets the server UID after a move; drops the row if sync already created one for that UID. */
  finalizeMove(id: number, folderId: number, uid: number) {
    const clash = this.db.get<{ id: number }>('SELECT id FROM messages WHERE folder_id = ? AND uid = ? AND id != ?', folderId, uid, id);
    if (clash) this.db.run('DELETE FROM messages WHERE id = ?', clash.id);
    this.db.run('UPDATE messages SET folder_id = ?, uid = ? WHERE id = ?', folderId, uid, id);
  }

  missingPreviews(ids: number[]): MessageRow[] {
    return this.getRows(ids).filter((r) => r.snippet === null && r.preview_part && r.uid > 0);
  }

  pendingPreviewRows(folderId: number, limit: number): MessageRow[] {
    return this.db.all<MessageRow>('SELECT * FROM messages WHERE folder_id = ? AND snippet IS NULL AND preview_part IS NOT NULL AND uid > 0 ORDER BY date DESC LIMIT ?', folderId, limit);
  }

  bodiesToPrefetch(folderId: number, limit: number, maxSize: number): MessageRow[] {
    return this.db.all<MessageRow>('SELECT * FROM messages WHERE folder_id = ? AND body_cached = 0 AND uid > 0 AND size <= ? ORDER BY date DESC LIMIT ?', folderId, maxSize, limit);
  }

  setCategory(ids: number[], category: Category) {
    this.db.transaction(() => { for (const id of ids) this.db.run('UPDATE messages SET category = ? WHERE id = ?', category, id); });
  }

  setSenderRule(address: string, category: Category) {
    this.db.run('INSERT INTO sender_rules (address, category) VALUES (?, ?) ON CONFLICT(address) DO UPDATE SET category = excluded.category', address, category);
    this.db.run('UPDATE messages SET category = ? WHERE from_addr = ?', category, address);
  }

  isTrusted(address: string): boolean {
    return !!this.db.get('SELECT 1 AS x FROM trusted_senders WHERE address = ?', address.toLowerCase());
  }

  trust(address: string) {
    this.db.run('INSERT OR IGNORE INTO trusted_senders (address) VALUES (?)', address.toLowerCase());
  }

  threadIds(accountId: number, threadKey: string): number[] {
    const rows = this.db.all<{ id: number; msg_key: string }>(`
      SELECT m.id, m.msg_key FROM messages m JOIN folders f ON f.id = m.folder_id
      WHERE m.account_id = ? AND m.thread_key = ? AND COALESCE(f.special_use, '') NOT IN ('trash', 'junk')
      ORDER BY m.date ASC, ${FOLDER_PRIORITY}`, accountId, threadKey);
    const seen = new Set<string>();
    const out: number[] = [];
    for (const r of rows) {
      if (seen.has(r.msg_key)) continue;
      seen.add(r.msg_key);
      out.push(r.id);
    }
    return out;
  }

  // ---------------- contacts ----------------

  suggestContacts(prefix: string, limit = 8) {
    const like = '%' + escapeLike(prefix.toLowerCase()) + '%';
    return this.db.all<{ address: string; name: string; seen_count: number; sent_count: number }>(
      `SELECT address, name, seen_count, sent_count FROM contacts
       WHERE address LIKE ? ESCAPE '\\' OR LOWER(name) LIKE ? ESCAPE '\\'
       ORDER BY (address LIKE ? ESCAPE '\\') DESC, sent_count * 5 + seen_count DESC, last_at DESC LIMIT ?`,
      like, like, escapeLike(prefix.toLowerCase()) + '%', limit
    ).map((r) => ({ address: r.address, name: r.name, count: r.sent_count * 5 + r.seen_count }));
  }

  // ---------------- listing ----------------

  private viewCondition(q: ListQuery, params: any[]): { where: string[]; dedupe: boolean; inboxLike: boolean } {
    const where: string[] = ['a.enabled = 1', 'm.uid != 0'];
    let dedupe = false;
    let inboxLike = false;
    const v = q.view;
    if (v.kind === 'folder') {
      where.push('m.folder_id = ?');
      params.push(v.folderId);
      const f = this.getFolder(v.folderId);
      inboxLike = f?.special_use === 'inbox';
    } else if (v.kind === 'unified') {
      switch (v.box) {
        case 'inbox': case 'sent': case 'drafts': case 'archive': case 'trash': case 'junk':
          where.push('f.special_use = ?');
          params.push(v.box);
          inboxLike = v.box === 'inbox';
          break;
        case 'starred':
          where.push("m.flagged = 1 AND COALESCE(f.special_use, '') NOT IN ('trash', 'junk')");
          dedupe = true;
          break;
        case 'unread':
          where.push("m.seen = 0 AND COALESCE(f.special_use, '') NOT IN ('trash', 'junk', 'sent', 'drafts', 'all')");
          dedupe = true;
          break;
        case 'attachments':
          where.push("m.has_attachments = 1 AND COALESCE(f.special_use, '') NOT IN ('trash', 'junk')");
          dedupe = true;
          break;
      }
      if (q.accountId) { where.push('m.account_id = ?'); params.push(q.accountId); }
    } else if (v.kind === 'search') {
      dedupe = true;
      const parsed = parseQuery(v.query);
      this.searchConditions(parsed, where, params);
      if (v.accountId) { where.push('m.account_id = ?'); params.push(v.accountId); }
    }
    if (q.filter === 'unread') where.push('m.seen = 0');
    else if (q.filter === 'starred') where.push('m.flagged = 1');
    else if (q.filter === 'attachments') where.push('m.has_attachments = 1');
    return { where, dedupe, inboxLike };
  }

  private searchConditions(p: ParsedQuery, where: string[], params: any[]) {
    if (isEmptyQuery(p)) { where.push('0'); return; }
    const long = p.text.filter((t) => [...t].length >= 3);
    const short = p.text.filter((t) => [...t].length < 3);
    if (long.length) {
      where.push('m.id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)');
      params.push(long.map(ftsPhrase).join(' AND '));
    }
    for (const t of short) {
      where.push("m.id IN (SELECT rowid FROM messages_fts WHERE subject LIKE ? ESCAPE '\\' OR participants LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')");
      const like = '%' + escapeLike(t) + '%';
      params.push(like, like, like);
    }
    for (const t of p.from) { where.push("(m.from_addr LIKE ? ESCAPE '\\' OR m.from_name LIKE ? ESCAPE '\\')"); params.push('%' + escapeLike(t) + '%', '%' + escapeLike(t) + '%'); }
    for (const t of p.to) { where.push("(m.to_json LIKE ? ESCAPE '\\' OR m.cc_json LIKE ? ESCAPE '\\')"); params.push('%' + escapeLike(t) + '%', '%' + escapeLike(t) + '%'); }
    for (const t of p.subject) { where.push("m.subject LIKE ? ESCAPE '\\'"); params.push('%' + escapeLike(t) + '%'); }
    if (p.hasAttachment) where.push('m.has_attachments = 1');
    if (p.unread !== undefined) where.push(p.unread ? 'm.seen = 0' : 'm.seen = 1');
    if (p.starred) where.push('m.flagged = 1');
    if (p.in.length) { where.push(`f.special_use IN (${p.in.map(() => '?').join(',')})`); params.push(...p.in); }
    else where.push("COALESCE(f.special_use, '') NOT IN ('trash', 'junk')");
    for (const t of p.folder) { where.push("(f.name LIKE ? ESCAPE '\\' OR f.path LIKE ? ESCAPE '\\')"); params.push('%' + escapeLike(t) + '%', '%' + escapeLike(t) + '%'); }
    if (p.account.length) {
      where.push(`(${p.account.map(() => "(a.email LIKE ? ESCAPE '\\' OR a.label LIKE ? ESCAPE '\\' OR a.provider_name LIKE ? ESCAPE '\\')").join(' OR ')})`);
      for (const t of p.account) params.push('%' + escapeLike(t) + '%', '%' + escapeLike(t) + '%', '%' + escapeLike(t) + '%');
    }
    if (p.before !== undefined) { where.push('m.date < ?'); params.push(p.before); }
    if (p.after !== undefined) { where.push('m.date >= ?'); params.push(p.after); }
    if (p.category) { where.push('m.category = ?'); params.push(p.category); }
  }

  listMessages(q: ListQuery, start: number, count: number): { items: MessageSummary[]; total: number } {
    const params: any[] = [];
    const { where, dedupe, inboxLike } = this.viewCondition(q, params);
    if (q.category !== 'all' && inboxLike) { where.push('m.category = ?'); params.push(q.category); }
    const from = 'FROM messages m JOIN folders f ON f.id = m.folder_id JOIN accounts a ON a.id = m.account_id';
    const cond = where.join(' AND ');
    let items: any[];
    let total: number;
    if (dedupe) {
      const inner = `SELECT ${SUMMARY_COLS}, ROW_NUMBER() OVER (PARTITION BY m.account_id, m.msg_key ORDER BY ${FOLDER_PRIORITY}, m.id) AS rn ${from} WHERE ${cond}`;
      items = this.db.raw.prepare(`SELECT * FROM (${inner}) WHERE rn = 1 ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`).all(...params, count, start);
      total = (this.db.raw.prepare(`SELECT COUNT(*) AS c FROM (SELECT DISTINCT m.account_id, m.msg_key ${from} WHERE ${cond})`).get(...params) as any).c;
    } else {
      items = this.db.raw.prepare(`SELECT ${SUMMARY_COLS} ${from} WHERE ${cond} ORDER BY m.date DESC, m.id DESC LIMIT ? OFFSET ?`).all(...params, count, start);
      total = (this.db.raw.prepare(`SELECT COUNT(*) AS c ${from} WHERE ${cond}`).get(...params) as any).c;
    }
    return { items: items.map(rowToSummary), total };
  }

  categoryCounts(q: ListQuery): CategoryCounts {
    const params: any[] = [];
    const { where } = this.viewCondition({ ...q, filter: 'all' }, params);
    where.push('m.seen = 0');
    const rows = this.db.raw.prepare(`SELECT m.category AS c, COUNT(*) AS n FROM messages m JOIN folders f ON f.id = m.folder_id JOIN accounts a ON a.id = m.account_id WHERE ${where.join(' AND ')} GROUP BY m.category`).all(...params) as any[];
    const out: CategoryCounts = { all: 0, primary: 0, notifications: 0, promotions: 0, social: 0 };
    for (const r of rows) { out[r.c as Category] = r.n; out.all += r.n; }
    return out;
  }

  unifiedCounts(outbox: number): UnifiedCounts {
    const one = (sql: string) => (this.db.get<{ c: number }>(sql)?.c ?? 0);
    return {
      inboxUnread: one("SELECT COUNT(*) AS c FROM messages m JOIN folders f ON f.id = m.folder_id JOIN accounts a ON a.id = m.account_id WHERE a.enabled = 1 AND f.special_use = 'inbox' AND m.seen = 0"),
      starred: one("SELECT COUNT(*) AS c FROM (SELECT DISTINCT m.account_id, m.msg_key FROM messages m JOIN folders f ON f.id = m.folder_id JOIN accounts a ON a.id = m.account_id WHERE a.enabled = 1 AND m.flagged = 1 AND COALESCE(f.special_use, '') NOT IN ('trash', 'junk'))"),
      drafts: one('SELECT COUNT(*) AS c FROM drafts'),
      outbox,
      unreadTotal: one("SELECT COUNT(*) AS c FROM messages m JOIN folders f ON f.id = m.folder_id JOIN accounts a ON a.id = m.account_id WHERE a.enabled = 1 AND m.seen = 0 AND COALESCE(f.special_use, '') NOT IN ('trash', 'junk', 'sent', 'drafts', 'all')")
    };
  }
}
