// Per-account IMAP synchronisation: one worker connection driven by a priority job queue,
// plus a second connection that IDLEs on the inbox for push notifications.
import type { ImapFlow, FetchMessageObject, ListResponse, MailboxObject } from 'imapflow';
import type { AccountStatus, AppEvent, Diagnosis, Settings, SpecialUse } from '../../shared/types';
import type { AccountRow, FolderRow, MailStore, MessageRow, NewMessage } from './store';
import type { BodyStore } from './body-store';
import type { Logger } from './logger';
import { createImapClient, isConnectionError, type ImapAuth } from './imap';
import { explainError } from './explain';
import { classify } from './classify';
import {
  cleanMessageId, decodePartRef, encodePartPath, findPreviewPart, hasAttachments, normalizeAddress, normalizeAddresses,
  parseHeaderBlock, parseReferences, snippetFromPart, decodeWords
} from './mime';

export interface SyncDeps {
  store: MailStore;
  bodies: BodyStore;
  log: Logger;
  resolveAuth(account: AccountRow): Promise<ImapAuth>;
  emit(e: AppEvent): void;
  onNewMail(accountId: number, ids: number[]): void;
  onBodyDownloaded(accountId: number, id: number, raw: Buffer): void;
  settings(): Settings;
}

export const HEADER_FIELDS = [
  'references', 'list-unsubscribe', 'list-unsubscribe-post', 'list-id', 'precedence', 'auto-submitted', 'x-mailer',
  'feedback-id', 'x-campaign', 'x-campaignid', 'x-autoreply', 'x-auto-response-suppress', 'x-sg-eid', 'x-mc-user'
];

const INITIAL_BATCH = 300;
const BACKFILL_CHUNK = 500;
const FETCH_CHUNK = 250;
const PREVIEW_BYTES = 2048;
const FULL_CHECK_MS = 15 * 60_000;

type Priority = 0 | 1 | 2 | 3; // 0 user action, 1 interactive fetch, 2 sync, 3 background

interface Job {
  key: string | null;
  priority: Priority;
  label: string;
  run: (c: ImapFlow) => Promise<any>;
  resolve: (v: any) => void;
  reject: (e: any) => void;
  promise: Promise<any>;
  attempts: number;
}

export class SyncError extends Error {
  constructor(message: string, public diagnosis: Diagnosis, public code?: string) {
    super(message);
  }
}

export function compressUids(uids: number[]): string {
  const sorted = [...new Set(uids)].filter((u) => u > 0).sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? String(sorted[i]) : `${sorted[i]}:${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(',');
}

function mapSpecialUse(l: { specialUse?: string; path: string; flags: Set<string> }): SpecialUse | null {
  const su = (l.specialUse || '').toLowerCase();
  if (l.path.toUpperCase() === 'INBOX' || su === '\\inbox') return 'inbox';
  switch (su) {
    case '\\sent': return 'sent';
    case '\\drafts': return 'drafts';
    case '\\trash': return 'trash';
    case '\\junk': return 'junk';
    case '\\archive': return 'archive';
    case '\\all': return 'all';
    case '\\flagged': return 'flagged';
  }
  if (l.flags.has('\\Important')) return 'important';
  return null;
}

const SYNC_ORDER: Record<string, number> = { inbox: 0, sent: 1, drafts: 2, archive: 3, '': 4, junk: 6, trash: 7, all: 8 };

export class AccountSync {
  readonly id: number;
  private client: ImapFlow | null = null;
  private connecting: Promise<ImapFlow> | null = null;
  private idleClient: ImapFlow | null = null;
  private idleStarting = false;
  private jobs: Job[] = [];
  private running = false;
  private stopped = true;
  private status: AccountStatus = { state: 'idle' };
  private uidCache = new Map<number, number[]>();
  private needsExpungeCheck = new Set<number>();
  private failures = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private idleRetryTimer: NodeJS.Timeout | null = null;
  private inboxDebounce: NodeJS.Timeout | null = null;
  private statusTimer: NodeJS.Timeout | null = null;
  private lastFullCheck = 0;
  private blocked: Diagnosis | null = null;
  private online = true;
  private activeFolderId: number | null = null;
  private lastPrefetch = 0;

  constructor(private account: AccountRow, private deps: SyncDeps) {
    this.id = account.id;
  }

  get isGmail(): boolean {
    try { if (JSON.parse(this.account.quirks || '{}').gmail) return true; } catch { /* ignore */ }
    return /imap\.gmail\.com$/i.test(this.account.imap_host);
  }

  getStatus(): AccountStatus {
    return this.status;
  }

  // ------------------------------------------------------------ lifecycle

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.blocked = null;
    this.setStatus({ state: 'connecting', message: '正在连接…' });
    this.enqueue('folders', 2, '更新文件夹', (c) => this.refreshFolders(c, false)).then(() => {
      this.queueAllFolders();
      this.startIdle();
    }).catch(() => { /* reported via status */ });
    this.schedulePoll();
  }

  async stop() {
    this.stopped = true;
    for (const t of [this.retryTimer, this.pollTimer, this.keepAliveTimer, this.idleRetryTimer, this.inboxDebounce, this.statusTimer]) if (t) clearTimeout(t);
    const pending = this.jobs.splice(0);
    for (const j of pending) j.reject(new Error('同步已停止'));
    const clients = [this.client, this.idleClient];
    this.client = null;
    this.idleClient = null;
    this.connecting = null;
    await Promise.all(clients.map(async (c) => {
      if (!c) return;
      try { await Promise.race([c.logout(), new Promise((r) => setTimeout(r, 1500))]); } catch { /* ignore */ }
      try { c.close(); } catch { /* ignore */ }
    }));
  }

  updateAccount(row: AccountRow) {
    this.account = row;
  }

  async restart() {
    await this.stop();
    this.uidCache.clear();
    this.failures = 0;
    this.start();
  }

  setOnline(online: boolean) {
    const was = this.online;
    this.online = online;
    if (online && !was && !this.stopped) {
      this.failures = 0;
      if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
      this.syncNow();
    }
    if (!online) this.setStatus({ state: 'offline', message: '网络已断开' });
  }

  syncNow() {
    if (this.stopped) { this.start(); return; }
    this.blocked = null;
    this.failures = 0;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    this.enqueue('folders', 2, '更新文件夹', (c) => this.refreshFolders(c, false))
      .then(() => { this.queueAllFolders(true); this.startIdle(); })
      .catch(() => {});
  }

  setActiveFolder(folderId: number | null) {
    this.activeFolderId = folderId;
    if (folderId == null || this.stopped) return;
    const f = this.deps.store.getFolder(folderId);
    if (!f || f.account_id !== this.id) return;
    if (!f.last_sync_at || Date.now() - f.last_sync_at > 20_000) {
      this.needsExpungeCheck.add(folderId);
      this.enqueue(`quick:${folderId}`, 1, `同步 ${f.name}`, (c) => this.quickSync(c, folderId)).catch(() => {});
    }
  }

  // ------------------------------------------------------------ status

  private setStatus(s: Partial<AccountStatus> & { state: AccountStatus['state'] }) {
    this.status = { ...s, diagnosis: s.diagnosis ?? null, progress: s.progress ?? null, lastSyncAt: this.account.last_sync_at };
    if (this.statusTimer) return;
    this.statusTimer = setTimeout(() => {
      this.statusTimer = null;
      this.deps.emit({ type: 'sync-status', accountId: this.id, status: this.status });
    }, 120);
  }

  private backfillProgress(): AccountStatus['progress'] {
    const folders = this.deps.store.listFolderRows(this.id).filter((f) => f.selectable && f.sync_enabled);
    const pending = folders.filter((f) => !f.backfill_done);
    if (!pending.length) return null;
    let total = 0;
    let done = 0;
    for (const f of folders) {
      const local = this.deps.store.countInFolder(f.id);
      total += Math.max(f.server_total, local);
      done += local;
    }
    return { label: '正在下载历史邮件', done, total };
  }

  private refreshIdleStatus() {
    if (this.blocked) return;
    const busy = this.jobs.some((j) => j.priority <= 2);
    if (busy) return;
    this.setStatus({ state: 'idle', progress: this.backfillProgress() });
  }

  // ------------------------------------------------------------ queue

  private enqueue<T>(key: string | null, priority: Priority, label: string, run: (c: ImapFlow) => Promise<T>): Promise<T> {
    if (this.stopped) return Promise.reject(new Error('账户同步未运行'));
    if (key) {
      const existing = this.jobs.find((j) => j.key === key);
      if (existing) {
        if (priority < existing.priority) existing.priority = priority;
        return existing.promise;
      }
    }
    let resolve!: (v: any) => void;
    let reject!: (e: any) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    this.jobs.push({ key, priority, label, run, resolve, reject, promise, attempts: 0 });
    queueMicrotask(() => this.pump());
    return promise;
  }

  private takeNext(maxPriority: number): Job | undefined {
    let best = -1;
    for (let i = 0; i < this.jobs.length; i++) {
      if (this.jobs[i].priority > maxPriority) continue;
      if (best < 0 || this.jobs[i].priority < this.jobs[best].priority) best = i;
    }
    return best >= 0 ? this.jobs.splice(best, 1)[0] : undefined;
  }

  private async pump() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      while (this.jobs.length && !this.stopped) {
        if (this.blocked) {
          // Credentials are wrong: fail user requests right away, keep background work parked.
          for (const j of this.jobs.filter((x) => x.priority <= 1)) {
            this.jobs.splice(this.jobs.indexOf(j), 1);
            j.reject(new SyncError(this.blocked.title, this.blocked, 'blocked'));
          }
          break;
        }
        if (!this.online) {
          for (const j of this.jobs.filter((x) => x.priority === 0)) {
            this.jobs.splice(this.jobs.indexOf(j), 1);
            j.reject(new SyncError('网络不可用', { kind: 'network', title: '网络不可用', explanation: '当前没有网络连接，操作未能同步到服务器。', suggestions: ['联网后重试。'], needsUserAction: false }));
          }
          break;
        }
        // While waiting to reconnect only interactive work may try to connect early.
        const job = this.takeNext(this.retryTimer ? 1 : 3);
        if (!job) break;
        if (job.priority <= 2) this.setStatus({ state: 'syncing', message: job.label, progress: this.status.progress });
        let client: ImapFlow;
        try {
          client = await this.ensureClient();
        } catch (e: any) {
          const d = e instanceof SyncError ? e.diagnosis : explainError(e, this.ctx('imap'));
          job.priority <= 1 ? job.reject(e instanceof SyncError ? e : new SyncError(d.title, d)) : this.jobs.unshift(job);
          this.onConnectFailure(e, d);
          break;
        }
        if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
        try {
          job.resolve(await job.run(client));
          this.failures = 0;
        } catch (e: any) {
          if (isConnectionError(e) || !client.usable) {
            this.deps.log.warn(`account ${this.id}: connection lost during "${job.label}": ${e?.message}`);
            this.dropClient();
            if (job.attempts++ < 2 && job.priority > 0) this.jobs.unshift(job);
            else job.reject(new SyncError('与服务器的连接中断', explainError(e, this.ctx('imap'))));
          } else {
            this.deps.log.warn(`account ${this.id}: job "${job.label}" failed: ${e?.message}`);
            job.reject(e instanceof SyncError ? e : new SyncError(e?.message || '操作失败', explainError(e, this.ctx('imap'))));
          }
        }
      }
    } finally {
      this.running = false;
      if (!this.jobs.length && !this.stopped) this.refreshIdleStatus();
    }
  }

  private ctx(phase: 'imap' | 'smtp') {
    return {
      phase,
      server: { host: this.account.imap_host, port: this.account.imap_port, security: this.account.imap_security },
      providerId: this.account.provider_id,
      authType: this.account.auth_type,
      email: this.account.email
    } as const;
  }

  private onConnectFailure(e: any, d: Diagnosis) {
    this.failures++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (d.needsUserAction) {
      this.blocked = d;
      this.setStatus({ state: 'error', message: d.title, diagnosis: d });
      // Retry occasionally anyway: some servers report throttling as an auth failure.
      this.retryTimer = setTimeout(() => { this.retryTimer = null; this.blocked = null; this.pump(); }, 20 * 60_000);
      return;
    }
    const delays = [5, 15, 30, 60, 120, 300];
    const delay = delays[Math.min(this.failures - 1, delays.length - 1)] * 1000;
    this.setStatus({ state: this.online ? 'error' : 'offline', message: `${d.title}，${Math.round(delay / 1000)} 秒后重试`, diagnosis: d });
    this.deps.log.warn(`account ${this.id}: connect failed (${d.kind}): ${e?.message}`);
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.pump(); this.startIdle(); }, delay);
  }

  private dropClient() {
    const c = this.client;
    this.client = null;
    if (c) { try { c.close(); } catch { /* ignore */ } }
  }

  private async ensureClient(): Promise<ImapFlow> {
    if (this.client && this.client.usable) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      if (!this.status.state || this.status.state !== 'syncing') this.setStatus({ state: 'connecting', message: '正在连接…' });
      const auth = await this.deps.resolveAuth(this.account);
      const c = createImapClient({
        server: { host: this.account.imap_host, port: this.account.imap_port, security: this.account.imap_security },
        auth,
        allowInsecureTls: !!this.account.allow_insecure_tls,
        log: this.deps.log,
        label: `${this.account.email}`
      });
      c.on('error', (err: any) => this.deps.log.warn(`account ${this.id}: imap error ${err?.code || ''} ${err?.message}`));
      c.on('close', () => { if (this.client === c) this.client = null; });
      await c.connect();
      if (this.stopped) {
        try { c.close(); } catch { /* ignore */ }
        throw new Error('同步已停止');
      }
      this.client = c;
      this.armKeepAlive();
      return c;
    })();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private armKeepAlive() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      if (this.stopped || !this.client || this.running) return;
      const c = this.client;
      c.noop().catch(() => { if (this.client === c) this.dropClient(); });
    }, 4 * 60_000);
  }

  // ------------------------------------------------------------ scheduling

  private queueAllFolders(force = false) {
    const folders = this.deps.store.listFolderRows(this.id)
      .filter((f) => f.selectable && f.sync_enabled)
      .sort((a, b) => (SYNC_ORDER[a.special_use || ''] ?? 4) - (SYNC_ORDER[b.special_use || ''] ?? 4));
    for (const f of folders) {
      if (force) this.needsExpungeCheck.add(f.id);
      this.enqueue(`quick:${f.id}`, 2, `同步 ${f.name}`, (c) => this.quickSync(c, f.id)).catch(() => {});
    }
    for (const f of folders) if (!f.backfill_done) this.queueBackfill(f.id);
  }

  private queueBackfill(folderId: number) {
    this.enqueue(`backfill:${folderId}`, 3, '下载历史邮件', (c) => this.backfill(c, folderId)).catch(() => {});
  }

  private schedulePoll() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    const minutes = Math.max(1, this.deps.settings().syncIntervalMinutes || 3);
    this.pollTimer = setTimeout(() => {
      if (this.stopped) return;
      this.enqueue('poll', 2, '检查新邮件', (c) => this.poll(c)).catch(() => {}).finally(() => this.schedulePoll());
    }, minutes * 60_000);
  }

  rescheduleTimers() {
    if (!this.stopped) this.schedulePoll();
  }

  private scheduleInboxSync(expunge = false) {
    const inbox = this.deps.store.folderBySpecial(this.id, 'inbox');
    if (!inbox) return;
    if (expunge) this.needsExpungeCheck.add(inbox.id);
    if (this.inboxDebounce) clearTimeout(this.inboxDebounce);
    this.inboxDebounce = setTimeout(() => {
      this.inboxDebounce = null;
      this.enqueue(`quick:${inbox.id}`, 1, '接收新邮件', (c) => this.quickSync(c, inbox.id)).catch(() => {});
    }, 350);
  }

  // ------------------------------------------------------------ IDLE watcher

  private async startIdle() {
    if (this.stopped || this.idleClient || this.idleStarting || this.blocked) return;
    const inbox = this.deps.store.folderBySpecial(this.id, 'inbox');
    if (!inbox) return;
    this.idleStarting = true;
    let c: ImapFlow | null = null;
    try {
      const auth = await this.deps.resolveAuth(this.account);
      c = createImapClient({
        server: { host: this.account.imap_host, port: this.account.imap_port, security: this.account.imap_security },
        auth,
        allowInsecureTls: !!this.account.allow_insecure_tls,
        log: this.deps.log,
        autoIdle: true,
        label: `${this.account.email} idle`,
        timeouts: { socket: 10 * 60_000 }
      });
      const client = c;
      client.on('exists', (d: any) => { if (d.count > d.prevCount) this.scheduleInboxSync(); });
      client.on('expunge', () => this.scheduleInboxSync(true));
      client.on('flags', () => this.scheduleInboxSync());
      client.on('error', (err: any) => this.deps.log.warn(`account ${this.id}: idle error ${err?.message}`));
      client.on('close', () => {
        if (this.idleClient === client) this.idleClient = null;
        if (!this.stopped && !this.blocked) {
          if (this.idleRetryTimer) clearTimeout(this.idleRetryTimer);
          this.idleRetryTimer = setTimeout(() => { this.idleRetryTimer = null; this.startIdle(); this.scheduleInboxSync(true); }, 15_000);
        }
      });
      await client.connect();
      await client.mailboxOpen(inbox.path);
      if (this.stopped) { client.close(); return; }
      this.idleClient = client;
    } catch (e: any) {
      this.deps.log.warn(`account ${this.id}: idle connection failed: ${e?.message}`);
      try { c?.close(); } catch { /* ignore */ }
      if (!this.stopped) {
        if (this.idleRetryTimer) clearTimeout(this.idleRetryTimer);
        this.idleRetryTimer = setTimeout(() => { this.idleRetryTimer = null; this.startIdle(); }, 60_000);
      }
    } finally {
      this.idleStarting = false;
    }
  }

  // ------------------------------------------------------------ folders

  /** Lists folders, reconciles them with the database and returns ids whose status changed. */
  private async refreshFolders(c: ImapFlow, withStatus: boolean): Promise<number[]> {
    const list: ListResponse[] = await c.list(withStatus ? { statusQuery: { messages: true, uidNext: true, uidValidity: true, unseen: true, highestModseq: true } } : undefined);
    const store = this.deps.store;
    const anySubscribed = list.some((l) => l.subscribed);
    const keep = new Set<string>();
    const changed: number[] = [];
    store.db.transaction(() => {
      for (const l of list) {
        const flags = l.flags || new Set<string>();
        if (flags.has('\\Noselect') || flags.has('\\NonExistent')) continue;
        const su = mapSpecialUse(l);
        if (su === 'flagged' || su === 'important') continue; // virtual views (Gmail Starred / Important)
        if (anySubscribed && !l.subscribed && !su) continue;
        keep.add(l.path);
        const id = store.upsertFolder(this.id, {
          path: l.path,
          name: decodeWords(l.name),
          delimiter: l.delimiter || null,
          parentPath: l.parentPath || null,
          specialUse: su,
          selectable: true,
          subscribed: !!l.subscribed,
          syncEnabled: true
        });
        if (withStatus && l.status) {
          const f = store.getFolder(id)!;
          const st = l.status;
          const moved =
            (st.uidNext !== undefined && st.uidNext !== f.uid_next) ||
            (st.messages !== undefined && st.messages !== f.server_total) ||
            (st.highestModseq !== undefined && f.highest_modseq !== null && String(st.highestModseq) !== f.highest_modseq) ||
            (st.uidValidity !== undefined && f.uid_validity !== null && String(st.uidValidity) !== f.uid_validity);
          if (moved || !f.last_sync_at) changed.push(id);
        }
      }
    });
    for (const f of store.listFolderRows(this.id)) {
      if (!keep.has(f.path)) {
        const ids = store.db.all<{ id: number }>('SELECT id FROM messages WHERE folder_id = ?', f.id).map((r) => r.id);
        store.deleteFolder(f.id);
        this.deps.bodies.remove(this.id, ids);
        this.uidCache.delete(f.id);
      }
    }
    this.deps.emit({ type: 'folders-changed', accountId: this.id });
    return changed;
  }

  private async poll(c: ImapFlow) {
    const changed = await this.refreshFolders(c, true);
    const full = Date.now() - this.lastFullCheck > FULL_CHECK_MS;
    if (full) this.lastFullCheck = Date.now();
    const folders = this.deps.store.listFolderRows(this.id).filter((f) => f.selectable && f.sync_enabled);
    for (const f of folders) {
      const isActive = f.id === this.activeFolderId || f.special_use === 'inbox';
      if (full) this.needsExpungeCheck.add(f.id);
      if (changed.includes(f.id) || isActive || full) {
        this.enqueue(`quick:${f.id}`, 2, `同步 ${f.name}`, (cc) => this.quickSync(cc, f.id)).catch(() => {});
      }
      if (!f.backfill_done) this.queueBackfill(f.id);
    }
    this.startIdle();
  }

  // ------------------------------------------------------------ sync of one folder

  private async allUids(c: ImapFlow, folderId: number, refresh = false): Promise<number[]> {
    if (!refresh && this.uidCache.has(folderId)) return this.uidCache.get(folderId)!;
    const res = ((await c.search({ all: true }, { uid: true })) || []) as number[];
    const sorted = [...res].sort((a, b) => a - b);
    this.uidCache.set(folderId, sorted);
    return sorted;
  }

  async quickSync(c: ImapFlow, folderId: number): Promise<void> {
    const store = this.deps.store;
    let f = store.getFolder(folderId);
    if (!f || !f.selectable || !f.sync_enabled) return;
    const wasSelected = !!c.mailbox && (c.mailbox as MailboxObject).path === f.path;
    const lock = await c.getMailboxLock(f.path);
    const changedFolders = new Set<number>();
    try {
      // A mailbox that stays selected (e.g. right after moving mail out of it) only learns about new mail through
      // untagged EXISTS: its UIDNEXT and HIGHESTMODSEQ go stale and new messages would be skipped. Re-select it.
      if (wasSelected) await c.mailboxOpen(f.path);
      const mb = c.mailbox as MailboxObject;
      const uidValidity = String(mb.uidValidity);
      if (f.uid_validity && f.uid_validity !== uidValidity) {
        this.deps.log.info(`account ${this.id}: UIDVALIDITY changed for ${f.path}, resetting`);
        const removed = store.resetFolder(f.id);
        this.deps.bodies.remove(this.id, removed);
        this.uidCache.delete(f.id);
        changedFolders.add(f.id);
        f = store.getFolder(folderId)!;
      }
      const firstSync = f.synced_max_uid === 0 && store.countInFolder(f.id) === 0;
      let newIds: number[] = [];

      if (mb.exists === 0) {
        const local = store.uidsInFolder(f.id);
        if (local.length) {
          this.deps.bodies.remove(this.id, store.deleteByUids(f.id, local));
          changedFolders.add(f.id);
        }
        this.uidCache.set(f.id, []);
        store.updateFolder(f.id, { uid_validity: uidValidity, uid_next: mb.uidNext, server_total: 0, backfill_done: 1, last_sync_at: Date.now(), highest_modseq: mb.highestModseq ? String(mb.highestModseq) : null });
        return;
      }

      if (firstSync) {
        const all = await this.allUids(c, f.id, true);
        const newest = all.slice(-INITIAL_BATCH);
        const unseen = (((await c.search({ seen: false }, { uid: true })) || []) as number[]).filter((u) => u < (newest[0] ?? 0));
        const extra = unseen.sort((a, b) => a - b).slice(-1500);
        newIds = await this.fetchAndStore(c, f, [...newest].reverse(), true);
        if (extra.length) await this.fetchAndStore(c, f, extra.reverse(), extra.length <= 300);
        store.updateFolder(f.id, {
          synced_min_uid: newest[0] ?? null,
          synced_max_uid: all[all.length - 1] ?? 0,
          backfill_done: all.length <= newest.length ? 1 : 0
        });
        changedFolders.add(f.id);
        newIds = []; // nothing is "new" on the first sync
      } else {
        const maxKnown = f.synced_max_uid;
        if (!mb.uidNext || mb.uidNext - 1 > maxKnown) {
          const fresh = (((await c.search({ uid: `${maxKnown + 1}:*` }, { uid: true })) || []) as number[]).filter((u) => u > maxKnown).sort((a, b) => a - b);
          if (fresh.length) {
            newIds = await this.fetchAndStore(c, f, [...fresh].reverse(), fresh.length <= 1000);
            const cache = this.uidCache.get(f.id);
            if (cache) this.uidCache.set(f.id, [...cache, ...fresh.filter((u) => u > (cache[cache.length - 1] ?? 0))]);
            store.updateFolder(f.id, { synced_max_uid: fresh[fresh.length - 1] });
            if (newIds.length) changedFolders.add(f.id);
          }
        }
        if (await this.syncFlags(c, f, mb)) changedFolders.add(f.id);
        if (await this.syncExpunges(c, f, mb)) changedFolders.add(f.id);
      }

      store.updateFolder(f.id, {
        uid_validity: uidValidity,
        uid_next: mb.uidNext ?? null,
        highest_modseq: mb.highestModseq ? String(mb.highestModseq) : null,
        server_total: mb.exists,
        last_sync_at: Date.now()
      });
      if (newIds.length && f.special_use === 'inbox') this.deps.onNewMail(this.id, newIds);
    } finally {
      lock.release();
      this.account.last_sync_at = Date.now();
      store.updateAccountFields(this.id, { last_sync_at: this.account.last_sync_at });
      if (changedFolders.size) this.deps.emit({ type: 'messages-changed', accountId: this.id, folderIds: [...changedFolders], reason: 'sync' });
    }
    if (f.special_use === 'inbox' && this.deps.settings().prefetchBodies && Date.now() - this.lastPrefetch > 60_000) {
      this.lastPrefetch = Date.now();
      this.enqueue(`prefetch:${f.id}`, 3, '预取邮件正文', (cc) => this.prefetchBodies(cc, f!.id)).catch(() => {});
    }
  }

  private async syncFlags(c: ImapFlow, f: FolderRow, mb: MailboxObject): Promise<boolean> {
    const store = this.deps.store;
    const local = store.flagsInFolder(f.id);
    if (!local.size) return false;
    let changed = false;
    const apply = (msg: FetchMessageObject) => {
      if (!msg.flags || !local.has(msg.uid)) return;
      if (store.updateFlags(f.id, msg.uid, msg.flags)) changed = true;
    };
    const condstore = c.enabled.has('CONDSTORE') && !!mb.highestModseq && !!f.highest_modseq;
    if (condstore) {
      const since = BigInt(f.highest_modseq!);
      if (mb.highestModseq! <= since) return false;
      for await (const msg of c.fetch('1:*', { uid: true, flags: true }, { uid: true, changedSince: since })) apply(msg);
      return changed;
    }
    const uids = [...local.keys()].sort((a, b) => a - b);
    const full = local.size <= 4000 || this.needsExpungeCheck.has(f.id);
    const range = full ? '1:*' : `${uids[Math.max(0, uids.length - 2000)]}:*`;
    for await (const msg of c.fetch(range, { uid: true, flags: true }, { uid: true })) apply(msg);
    return changed;
  }

  /** Removes messages deleted on the server and re-fetches ones missing locally inside the synced range. */
  private async syncExpunges(c: ImapFlow, f: FolderRow, mb: MailboxObject): Promise<boolean> {
    const store = this.deps.store;
    const localUids = store.uidsInFolder(f.id);
    const forced = this.needsExpungeCheck.has(f.id);
    if (!forced && f.backfill_done && mb.exists === localUids.length) return false;
    if (!forced && !f.backfill_done) return false;
    this.needsExpungeCheck.delete(f.id);
    const server = await this.allUids(c, f.id, true);
    const serverSet = new Set(server);
    const gone = localUids.filter((u) => !serverSet.has(u));
    let changed = false;
    if (gone.length) {
      this.deps.bodies.remove(this.id, store.deleteByUids(f.id, gone));
      changed = true;
    }
    const localSet = new Set(localUids);
    const lo = f.synced_min_uid ?? 1;
    const missing = server.filter((u) => u >= lo && u <= f.synced_max_uid && !localSet.has(u));
    if (missing.length) {
      await this.fetchAndStore(c, f, missing.reverse(), missing.length <= 300);
      changed = true;
    }
    return changed;
  }

  private async backfill(c: ImapFlow, folderId: number): Promise<void> {
    const store = this.deps.store;
    const f = store.getFolder(folderId);
    if (!f || f.backfill_done || !f.selectable) return;
    const lock = await c.getMailboxLock(f.path);
    let done = false;
    try {
      const all = await this.allUids(c, f.id);
      const floor = f.synced_min_uid ?? Number.MAX_SAFE_INTEGER;
      const below = all.filter((u) => u < floor);
      if (!below.length) {
        store.updateFolder(f.id, { backfill_done: 1 });
        done = true;
      } else {
        const chunk = below.slice(-BACKFILL_CHUNK);
        await this.fetchAndStore(c, f, [...chunk].reverse(), false);
        done = below.length <= chunk.length;
        store.updateFolder(f.id, { synced_min_uid: chunk[0], backfill_done: done ? 1 : 0 });
      }
    } finally {
      lock.release();
    }
    this.deps.emit({ type: 'messages-changed', accountId: this.id, folderIds: [folderId], reason: 'backfill' });
    this.setStatus({ state: this.status.state === 'syncing' ? 'syncing' : 'idle', message: this.status.message, progress: this.backfillProgress() });
    if (!done) this.queueBackfill(folderId);
  }

  private toNewMessage(f: FolderRow, msg: FetchMessageObject): NewMessage {
    const env = msg.envelope || {};
    const headers = parseHeaderBlock(msg.headers);
    const messageId = cleanMessageId(env.messageId);
    const msgKey = messageId || `uid:${f.id}:${f.uid_validity || ''}:${msg.uid}`;
    const refs = parseReferences(headers['references']);
    const inReplyTo = cleanMessageId(env.inReplyTo);
    const store = this.deps.store;
    let threadKey = msgKey;
    if (refs.length) threadKey = store.threadKeyForMsgKey(this.id, refs[0]) || refs[0];
    else if (inReplyTo) threadKey = store.threadKeyForMsgKey(this.id, inReplyTo) || inReplyTo;
    else if (messageId) threadKey = store.threadKeyForMsgKey(this.id, messageId) || messageId;
    const from = normalizeAddress(env.from?.[0]) || normalizeAddress(env.sender?.[0]);
    const subject = (env.subject || '').replace(/\s+/g, ' ').trim();
    // Sort by the Date header like most desktop clients (migrated mail keeps its age); fall back to the
    // server's arrival time when the header is missing or implausibly far in the future (spam).
    const internal = msg.internalDate ? new Date(msg.internalDate).getTime() : NaN;
    const sent = env.date ? new Date(env.date).getTime() : NaN;
    const sentOk = !isNaN(sent) && sent > 0 && sent < Date.now() + 36 * 3600_000;
    const date = sentOk ? sent : !isNaN(internal) ? internal : Date.now();
    const preview = findPreviewPart(msg.bodyStructure as any);
    const fromAddr = from?.address || '';
    const category = (fromAddr && store.senderCategory(fromAddr)) || classify({ fromAddr, fromName: from?.name || '', subject, headers });
    return {
      uid: msg.uid,
      messageId,
      msgKey,
      threadKey,
      inReplyTo,
      refs,
      subject,
      from,
      to: normalizeAddresses(env.to),
      cc: normalizeAddresses(env.cc),
      bcc: normalizeAddresses(env.bcc),
      replyTo: normalizeAddresses(env.replyTo),
      date,
      size: msg.size || 0,
      flags: msg.flags || new Set(),
      hasAttachments: hasAttachments(msg.bodyStructure as any),
      snippet: null,
      previewPart: preview ? encodePartPath(preview) : null,
      category,
      listUnsubscribe: headers['list-unsubscribe'] || null
    };
  }

  /** Fetches headers for uids (given newest first) in chunks; optionally fetches previews. */
  private async fetchAndStore(c: ImapFlow, f: FolderRow, uids: number[], withPreview: boolean): Promise<number[]> {
    const store = this.deps.store;
    const inserted: number[] = [];
    const isSent = f.special_use === 'sent';
    for (let i = 0; i < uids.length; i += FETCH_CHUNK) {
      const chunk = uids.slice(i, i + FETCH_CHUNK);
      const rows: NewMessage[] = [];
      for await (const msg of c.fetch(compressUids(chunk), {
        uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true, size: true, headers: HEADER_FIELDS
      }, { uid: true })) {
        if (msg.uid) rows.push(this.toNewMessage(f, msg));
      }
      const ids = store.insertMessages(this.id, f.id, rows, isSent);
      inserted.push(...ids);
      if (withPreview && ids.length) await this.fetchPreviews(c, f, store.getRows(ids));
      if (uids.length > FETCH_CHUNK) this.deps.emit({ type: 'messages-changed', accountId: this.id, folderIds: [f.id], reason: 'sync' });
    }
    return inserted;
  }

  /** Downloads the first bytes of each message's text part to build list previews. Mailbox must be selected. */
  private async fetchPreviews(c: ImapFlow, f: FolderRow, rows: MessageRow[]) {
    const store = this.deps.store;
    const groups = new Map<string, MessageRow[]>();
    for (const r of rows) {
      const ref = decodePartRef(r.preview_part);
      if (!ref || r.uid <= 0) continue;
      const key = ref.part;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    for (const [part, list] of groups) {
      const byUid = new Map(list.map((r) => [r.uid, r]));
      for (let i = 0; i < list.length; i += FETCH_CHUNK) {
        const chunk = list.slice(i, i + FETCH_CHUNK);
        for await (const msg of c.fetch(compressUids(chunk.map((r) => r.uid)), { uid: true, bodyParts: [{ key: part, start: 0, maxLength: PREVIEW_BYTES }] }, { uid: true })) {
          const row = byUid.get(msg.uid);
          const buf = msg.bodyParts?.get(part);
          if (!row) continue;
          const ref = decodePartRef(row.preview_part)!;
          let snippet = '';
          try { snippet = buf ? snippetFromPart(buf, ref) : ''; } catch { snippet = ''; }
          store.setSnippet(row.id, snippet);
        }
      }
    }
    void f;
  }

  private async prefetchBodies(c: ImapFlow, folderId: number) {
    const store = this.deps.store;
    const f = store.getFolder(folderId);
    if (!f) return;
    const rows = store.bodiesToPrefetch(folderId, 25, 3 * 1024 * 1024);
    const cachedCount = store.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM messages WHERE folder_id = ? AND body_cached = 1', folderId)?.c ?? 0;
    if (!rows.length || cachedCount >= 300) return;
    const lock = await c.getMailboxLock(f.path);
    try {
      for (const r of rows) {
        if (this.jobs.some((j) => j.priority <= 1)) break; // yield to interactive work
        const msg = await c.fetchOne(String(r.uid), { uid: true, source: true }, { uid: true });
        if (msg && msg.source) {
          this.deps.bodies.write(this.id, r.id, msg.source);
          this.deps.onBodyDownloaded(this.id, r.id, msg.source);
        }
      }
    } finally {
      lock.release();
    }
    if (rows.length === 25) setTimeout(() => this.enqueue(`prefetch:${folderId}`, 3, '预取邮件正文', (cc) => this.prefetchBodies(cc, folderId)).catch(() => {}), 2000);
  }

  // ------------------------------------------------------------ actions used by the core

  /** Downloads the full source of a message (interactive priority). */
  fetchSource(messageId: number): Promise<Buffer> {
    return this.enqueue(`body:${messageId}`, 1, '下载邮件', async (c) => {
      const row = this.deps.store.getRow(messageId);
      if (!row || row.uid <= 0) throw new SyncError('邮件不存在或正在移动', { kind: 'gone', title: '邮件暂时不可用', explanation: '这封邮件正在移动或已被删除。', suggestions: ['稍后重试。'], needsUserAction: false });
      const f = this.deps.store.getFolder(row.folder_id)!;
      const lock = await c.getMailboxLock(f.path);
      try {
        const msg = await c.fetchOne(String(row.uid), { uid: true, source: true }, { uid: true });
        if (!msg || !msg.source) {
          this.needsExpungeCheck.add(f.id);
          this.enqueue(`quick:${f.id}`, 2, `同步 ${f.name}`, (cc) => this.quickSync(cc, f.id)).catch(() => {});
          throw new SyncError('服务器上找不到这封邮件', { kind: 'gone', title: '邮件已不存在', explanation: '这封邮件可能已在其他设备上被删除或移动。', suggestions: ['列表将自动刷新。'], needsUserAction: false });
        }
        return msg.source;
      } finally {
        lock.release();
      }
    });
  }

  ensurePreviews(ids: number[]): Promise<void> {
    const rows = this.deps.store.missingPreviews(ids);
    if (!rows.length) return Promise.resolve();
    const byFolder = new Map<number, MessageRow[]>();
    for (const r of rows) {
      if (!byFolder.has(r.folder_id)) byFolder.set(r.folder_id, []);
      byFolder.get(r.folder_id)!.push(r);
    }
    const jobs = [...byFolder].map(([folderId, list]) =>
      this.enqueue(null, 1, '加载预览', async (c) => {
        const f = this.deps.store.getFolder(folderId);
        if (!f) return;
        const fresh = this.deps.store.missingPreviews(list.map((r) => r.id));
        if (!fresh.length) return;
        const lock = await c.getMailboxLock(f.path);
        try { await this.fetchPreviews(c, f, fresh); } finally { lock.release(); }
        this.deps.emit({ type: 'messages-changed', accountId: this.id, folderIds: [folderId], reason: 'previews' });
      }));
    return Promise.all(jobs).then(() => {});
  }

  /** Adds or removes a flag on the server for the given local message ids. */
  storeFlag(ids: number[], flag: string, add: boolean): Promise<void> {
    return this.enqueue(null, 0, '更新标记', async (c) => {
      const rows = this.deps.store.getRows(ids).filter((r) => r.uid > 0);
      for (const [folderId, list] of groupBy(rows, (r) => r.folder_id)) {
        const f = this.deps.store.getFolder(folderId);
        if (!f) continue;
        const lock = await c.getMailboxLock(f.path);
        try {
          const range = compressUids(list.map((r) => r.uid));
          if (add) await c.messageFlagsAdd(range, [flag], { uid: true });
          else await c.messageFlagsRemove(range, [flag], { uid: true });
        } finally {
          lock.release();
        }
      }
    });
  }

  /** Sets \\Seen on every message of a folder on the server, including mail not yet downloaded. */
  markAllSeen(folderId: number): Promise<void> {
    return this.enqueue(null, 0, '全部标为已读', async (c) => {
      const f = this.deps.store.getFolder(folderId);
      if (!f) return;
      const lock = await c.getMailboxLock(f.path);
      try {
        if ((c.mailbox as MailboxObject).exists > 0) await c.messageFlagsAdd('1:*', ['\\Seen']);
      } finally {
        lock.release();
      }
      this.deps.store.updateFolder(f.id, { server_unseen: 0 });
    });
  }

  /** Permanently removes every message of a folder on the server (used to empty trash / junk). */
  emptyFolder(folderId: number): Promise<void> {
    return this.enqueue(null, 0, '清空文件夹', async (c) => {
      const f = this.deps.store.getFolder(folderId);
      if (!f) return;
      const lock = await c.getMailboxLock(f.path);
      try {
        if ((c.mailbox as MailboxObject).exists > 0) await c.messageDelete('1:*');
      } finally {
        lock.release();
      }
      this.uidCache.delete(f.id);
      this.enqueue(`quick:${f.id}`, 2, `同步 ${f.name}`, (cc) => this.quickSync(cc, f.id)).catch(() => {});
    });
  }

  /** Moves messages on the server. `items` carry the original location (rows were already moved locally). */
  move(items: Array<{ id: number; folderId: number; uid: number }>, destFolderId: number): Promise<Map<number, number | null>> {
    return this.enqueue(null, 0, '移动邮件', async (c) => {
      const dest = this.deps.store.getFolder(destFolderId);
      if (!dest) throw new Error('目标文件夹不存在');
      const result = new Map<number, number | null>();
      for (const [folderId, list] of groupBy(items, (i) => i.folderId)) {
        const src = this.deps.store.getFolder(folderId);
        if (!src) continue;
        const lock = await c.getMailboxLock(src.path);
        try {
          const res = await c.messageMove(compressUids(list.map((i) => i.uid)), dest.path, { uid: true });
          for (const it of list) result.set(it.id, res && res.uidMap ? res.uidMap.get(it.uid) ?? null : null);
        } finally {
          lock.release();
        }
        this.uidCache.delete(src.id);
      }
      this.uidCache.delete(dest.id);
      return result;
    });
  }

  expunge(items: Array<{ folderId: number; uid: number }>): Promise<void> {
    return this.enqueue(null, 0, '删除邮件', async (c) => {
      for (const [folderId, list] of groupBy(items, (i) => i.folderId)) {
        const f = this.deps.store.getFolder(folderId);
        if (!f) continue;
        const lock = await c.getMailboxLock(f.path);
        try { await c.messageDelete(compressUids(list.map((i) => i.uid)), { uid: true }); } finally { lock.release(); }
        this.uidCache.delete(f.id);
      }
    });
  }

  append(folderId: number, raw: Buffer, flags: string[]): Promise<number | null> {
    return this.enqueue(null, 0, '保存邮件', async (c) => {
      const f = this.deps.store.getFolder(folderId);
      if (!f) throw new Error('文件夹不存在');
      const res = await c.append(f.path, raw, flags);
      this.enqueue(`quick:${f.id}`, 2, `同步 ${f.name}`, (cc) => this.quickSync(cc, f.id)).catch(() => {});
      return res ? res.uid ?? null : null;
    });
  }

  /** True if a message with this Message-ID exists in the folder on the server. */
  hasMessageId(folderId: number, messageId: string): Promise<boolean> {
    return this.enqueue(null, 1, '检查已发送', async (c) => {
      const f = this.deps.store.getFolder(folderId);
      if (!f) return false;
      const lock = await c.getMailboxLock(f.path);
      try {
        const res = await c.search({ header: { 'message-id': messageId } }, { uid: true });
        return Array.isArray(res) && res.length > 0;
      } finally {
        lock.release();
      }
    });
  }

  syncFolderNow(folderId: number): Promise<void> {
    return this.enqueue(`quick:${folderId}`, 1, '同步', (c) => this.quickSync(c, folderId));
  }

  createFolder(path: string): Promise<string> {
    return this.enqueue(null, 0, '新建文件夹', async (c) => {
      const res = await c.mailboxCreate(path);
      // Folders are only shown when subscribed (like most desktop clients), so subscribe explicitly.
      await c.mailboxSubscribe(res.path).catch(() => false);
      await this.refreshFolders(c, false);
      return res.path;
    });
  }

  renameFolder(path: string, newPath: string): Promise<void> {
    return this.enqueue(null, 0, '重命名文件夹', async (c) => {
      const res = await c.mailboxRename(path, newPath);
      // RENAME does not move the subscription (RFC 3501 §6.3.5).
      await c.mailboxUnsubscribe(path).catch(() => false);
      await c.mailboxSubscribe(res.newPath || newPath).catch(() => false);
      await this.refreshFolders(c, false);
      this.queueAllFolders();
    });
  }

  deleteFolder(path: string): Promise<void> {
    return this.enqueue(null, 0, '删除文件夹', async (c) => {
      await c.mailboxDelete(path);
      await c.mailboxUnsubscribe(path).catch(() => false);
      await this.refreshFolders(c, false);
    });
  }

  delimiter(): string {
    return this.deps.store.listFolderRows(this.id).find((f) => f.delimiter)?.delimiter || '/';
  }

  /** Server-side full-text search; imports headers of matches not yet stored locally. */
  searchServer(text: string, folderIds: number[]): Promise<{ imported: number; folders: number; errors: string[] }> {
    return this.enqueue(null, 1, '在服务器上搜索', async (c) => {
      let imported = 0;
      let folders = 0;
      const errors: string[] = [];
      for (const folderId of folderIds) {
        const f = this.deps.store.getFolder(folderId);
        if (!f) continue;
        const lock = await c.getMailboxLock(f.path);
        try {
          folders++;
          const query = this.isGmail ? { gmraw: text } : { text };
          const uids = (((await c.search(query as any, { uid: true })) || []) as number[]);
          const local = new Set(this.deps.store.uidsInFolder(f.id));
          const missing = uids.filter((u) => !local.has(u)).sort((a, b) => b - a).slice(0, 500);
          if (missing.length) imported += (await this.fetchAndStore(c, f, missing, true)).length;
        } catch (e: any) {
          errors.push(`${f.name}: ${e?.message || e}`);
        } finally {
          lock.release();
        }
      }
      if (imported) this.deps.emit({ type: 'messages-changed', accountId: this.id, folderIds, reason: 'search' });
      return { imported, folders, errors };
    });
  }
}

function groupBy<T, K>(list: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of list) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}
