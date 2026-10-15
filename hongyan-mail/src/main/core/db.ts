// SQLite storage built on Node's bundled node:sqlite (no native add-on to rebuild).
import { DatabaseSync, type StatementSync } from 'node:sqlite';

type Param = null | number | bigint | string | Uint8Array;
export type Params = Param[] | Record<string, Param>;

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL,
    provider_id TEXT,
    provider_name TEXT NOT NULL DEFAULT '',
    auth_type TEXT NOT NULL,
    oauth_provider TEXT,
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL,
    imap_security TEXT NOT NULL,
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL,
    smtp_security TEXT NOT NULL,
    username TEXT NOT NULL,
    smtp_username TEXT,
    allow_insecure_tls INTEGER NOT NULL DEFAULT 0,
    secret BLOB,
    signature TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    quirks TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    last_sync_at INTEGER
  );

  CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    delimiter TEXT,
    parent_path TEXT,
    special_use TEXT,
    selectable INTEGER NOT NULL DEFAULT 1,
    subscribed INTEGER NOT NULL DEFAULT 1,
    uid_validity TEXT,
    uid_next INTEGER,
    highest_modseq TEXT,
    server_total INTEGER NOT NULL DEFAULT 0,
    server_unseen INTEGER,
    synced_min_uid INTEGER,
    synced_max_uid INTEGER NOT NULL DEFAULT 0,
    backfill_done INTEGER NOT NULL DEFAULT 0,
    last_sync_at INTEGER,
    last_full_check_at INTEGER,
    sync_enabled INTEGER NOT NULL DEFAULT 1,
    UNIQUE(account_id, path)
  );

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    uid INTEGER NOT NULL,
    message_id TEXT,
    msg_key TEXT NOT NULL,
    thread_key TEXT NOT NULL,
    in_reply_to TEXT,
    refs TEXT,
    subject TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    from_addr TEXT NOT NULL DEFAULT '',
    to_json TEXT NOT NULL DEFAULT '[]',
    cc_json TEXT NOT NULL DEFAULT '[]',
    bcc_json TEXT NOT NULL DEFAULT '[]',
    reply_to_json TEXT NOT NULL DEFAULT '[]',
    date INTEGER NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    seen INTEGER NOT NULL DEFAULT 0,
    flagged INTEGER NOT NULL DEFAULT 0,
    answered INTEGER NOT NULL DEFAULT 0,
    forwarded INTEGER NOT NULL DEFAULT 0,
    draft INTEGER NOT NULL DEFAULT 0,
    has_attachments INTEGER NOT NULL DEFAULT 0,
    snippet TEXT,
    preview_part TEXT,
    category TEXT NOT NULL DEFAULT 'primary',
    list_unsubscribe TEXT,
    body_cached INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE(folder_id, uid)
  );
  CREATE INDEX idx_msg_folder_date ON messages(folder_id, date DESC);
  CREATE INDEX idx_msg_account_date ON messages(account_id, date DESC);
  CREATE INDEX idx_msg_date ON messages(date DESC);
  CREATE INDEX idx_msg_thread ON messages(account_id, thread_key);
  CREATE INDEX idx_msg_key ON messages(account_id, msg_key);
  CREATE INDEX idx_msg_unseen ON messages(folder_id, seen);
  CREATE INDEX idx_msg_flagged ON messages(flagged, date DESC);
  CREATE INDEX idx_msg_from ON messages(from_addr);

  CREATE VIRTUAL TABLE messages_fts USING fts5(subject, participants, body, tokenize = 'trigram');
  CREATE TRIGGER trg_msg_delete AFTER DELETE ON messages BEGIN
    DELETE FROM messages_fts WHERE rowid = old.id;
  END;

  CREATE TABLE contacts (
    address TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    seen_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    last_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE sender_rules (
    address TEXT PRIMARY KEY,
    category TEXT NOT NULL
  );

  CREATE TABLE trusted_senders (address TEXT PRIMARY KEY);

  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    data TEXT NOT NULL,
    server_message_key TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    send_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  `,
  // v2: senders whose mail goes straight to the junk folder (an address, or a whole domain as "@example.com")
  `
  CREATE TABLE blocked_senders (
    pattern TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
  `
];

export class Database {
  readonly raw: DatabaseSync;
  private cache = new Map<string, StatementSync>();
  private depth = 0;

  constructor(file: string) {
    this.raw = new DatabaseSync(file);
    this.raw.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -16000;
      PRAGMA busy_timeout = 5000;
    `);
    this.migrate();
  }

  private migrate() {
    const row = this.raw.prepare('PRAGMA user_version').get() as { user_version: number };
    let version = row.user_version;
    while (version < MIGRATIONS.length) {
      this.transaction(() => {
        this.raw.exec(MIGRATIONS[version]);
        this.raw.exec(`PRAGMA user_version = ${version + 1}`);
      });
      version++;
    }
  }

  stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  all<T = any>(sql: string, ...params: Param[]): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  get<T = any>(sql: string, ...params: Param[]): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  run(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
    const r = this.stmt(sql).run(...params);
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  exec(sql: string) {
    this.raw.exec(sql);
  }

  /** Runs fn inside a transaction (nested calls join the outer transaction). */
  transaction<T>(fn: () => T): T {
    if (this.depth > 0) {
      this.depth++;
      try { return fn(); } finally { this.depth--; }
    }
    this.raw.exec('BEGIN');
    this.depth = 1;
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (e) {
      try { this.raw.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw e;
    } finally {
      this.depth = 0;
    }
  }

  close() {
    this.cache.clear();
    this.raw.close();
  }
}

export const b = (v: boolean | undefined | null): number => (v ? 1 : 0);
