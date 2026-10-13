import { create } from 'zustand';
import type {
  AccountSummary, AppEvent, AppInfo, Category, ComposePrefill, DiagStep, FolderInfo, ListFilter, ListQuery,
  MessageSummary, Settings, UnifiedCounts, ViewSpec, OutboxItem
} from '@shared/types';
import { api, errorMessage, onEvent } from './api';
import { applyTheme } from './lib/theme';
import { drawBadge } from './lib/badge';
import { folderName, sameView } from './lib/folders';

export const PAGE = 100;

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error' | 'progress';
  message: string;
  detail?: string;
  action?: { label: string; run: () => void };
  duration?: number;
}

export interface ComposerState {
  key: string;
  prefill: ComposePrefill;
  minimized: boolean;
}

export type Modal =
  | { type: 'settings'; section?: string; accountId?: number }
  | { type: 'add-account'; reauthAccountId?: number }
  | { type: 'diagnose'; accountId: number }
  | { type: 'palette' }
  | { type: 'move'; ids: number[]; accountId: number }
  | { type: 'shortcuts' }
  | { type: 'source'; messageId: number }
  | { type: 'image'; src: string; name: string; messageId: number; index: number }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }
  | { type: 'prompt'; title: string; label: string; initial: string; confirmLabel?: string; onSubmit: (v: string) => void }
  | { type: 'schedule'; onPick: (t: number) => void }
  | null;

interface ListState {
  key: string;
  total: number;
  pages: Record<number, MessageSummary[]>;
  loaded: boolean;
}

const EMPTY_COUNTS: UnifiedCounts = { inboxUnread: 0, starred: 0, drafts: 0, outbox: 0, unreadTotal: 0 };

export interface AppState {
  booted: boolean;
  onboarding: boolean;
  info: AppInfo | null;
  settings: Settings | null;
  dark: boolean;
  accounts: AccountSummary[];
  folders: FolderInfo[];
  counts: UnifiedCounts;
  view: ViewSpec;
  panel: 'mail' | 'outbox' | 'drafts';
  filter: ListFilter;
  category: Category | 'all';
  accountFilter: number | null;
  list: ListState;
  selection: number[];
  anchor: number | null;
  openId: number | null;
  readerVersion: number;
  search: string;
  composers: ComposerState[];
  modal: Modal;
  toasts: Toast[];
  diagRuns: Record<string, DiagStep[]>;
  outbox: OutboxItem[];
  maximized: boolean;
  online: boolean;
  collapsedFolders: Record<number, boolean>;
  collapsedAccounts: Record<number, boolean>;

  boot(): Promise<void>;
  setView(v: ViewSpec, opts?: { keepSearch?: boolean }): void;
  setPanel(p: 'mail' | 'outbox' | 'drafts'): void;
  setFilter(f: ListFilter): void;
  setCategory(c: Category | 'all'): void;
  setAccountFilter(id: number | null): void;
  setSearch(q: string): void;
  loadPage(page: number): void;
  reloadList(): Promise<void>;
  itemAt(index: number): MessageSummary | undefined;
  indexOf(id: number): number;
  open(id: number | null): void;
  select(id: number, mode: 'single' | 'toggle' | 'range'): void;
  selectAll(): void;
  clearSelection(): void;
  moveFocus(delta: number): void;
  refreshFolders(): Promise<void>;
  refreshCounts(): Promise<void>;
  refreshAccounts(): Promise<void>;
  refreshOutbox(): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  toast(t: Omit<Toast, 'id'>): number;
  dismissToast(id: number): void;
  openModal(m: Modal): void;
  closeModal(): void;
  compose(prefill?: Partial<ComposePrefill>): void;
  updateComposer(key: string, patch: Partial<ComposerState>): void;
  closeComposer(key: string): void;
  // message actions
  act(kind: 'archive' | 'trash' | 'spam' | 'notspam' | 'delete', ids?: number[]): Promise<void>;
  moveTo(ids: number[], folderId: number): Promise<void>;
  setSeen(ids: number[], seen: boolean): void;
  setFlagged(ids: number[], flagged: boolean): void;
  reply(mode: 'reply' | 'replyAll' | 'forward' | 'draft', id: number): Promise<void>;
}

let toastSeq = 1;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
let countsTimer: ReturnType<typeof setTimeout> | null = null;
let composerSeq = 1;

export function listQuery(s: Pick<AppState, 'view' | 'filter' | 'category' | 'accountFilter'>): ListQuery {
  return { view: s.view, filter: s.filter, category: s.category, accountId: s.accountFilter };
}

const keyOf = (q: ListQuery) => JSON.stringify(q);

export const emptyPrefill = (accountId: number | null): ComposePrefill => ({
  mode: 'new', accountId, to: [], cc: [], bcc: [], subject: '', html: '', attachments: [], inReplyTo: null, references: [],
  replyToMessageId: null, forwardOfMessageId: null, draftId: null, serverDraftMessageId: null
});

export const useApp = create<AppState>((set, get) => ({
  booted: false,
  onboarding: false,
  info: null,
  settings: null,
  dark: false,
  accounts: [],
  folders: [],
  counts: EMPTY_COUNTS,
  view: { kind: 'unified', box: 'inbox' },
  panel: 'mail',
  filter: 'all',
  category: 'all',
  accountFilter: null,
  list: { key: '', total: 0, pages: {}, loaded: false },
  selection: [],
  anchor: null,
  openId: null,
  readerVersion: 0,
  search: '',
  composers: [],
  modal: null,
  toasts: [],
  diagRuns: {},
  outbox: [],
  maximized: false,
  online: navigator.onLine,
  collapsedFolders: {},
  collapsedAccounts: {},

  async boot() {
    const [info, settings, accounts, folders, counts] = await Promise.all([
      api.getAppInfo(), api.getSettings(), api.listAccounts(), api.listFolders(), api.unifiedCounts()
    ]);
    const dark = applyTheme(settings);
    try {
      const ui = JSON.parse(localStorage.getItem('hy.ui') || '{}');
      set({ collapsedFolders: ui.collapsedFolders || {}, collapsedAccounts: ui.collapsedAccounts || {} });
    } catch { /* ignore */ }
    set({ info, settings, accounts, folders, counts, dark, booted: true, onboarding: accounts.length === 0 });
    onEvent(handleEvent);
    window.hy.ready();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => { const s = get().settings; if (s) set({ dark: applyTheme(s) }); });
    window.addEventListener('online', () => { set({ online: true }); api.setNetworkOnline(true); });
    window.addEventListener('offline', () => { set({ online: false }); api.setNetworkOnline(false); });
    if (!navigator.onLine) api.setNetworkOnline(false);
    void get().reloadList();
    void get().refreshOutbox();
    updateBadge(counts.inboxUnread, dark);
  },

  setView(v, opts) {
    const s = get();
    if (sameView(s.view, v) && s.panel === 'mail') return;
    set({
      view: v,
      panel: 'mail',
      filter: 'all',
      category: 'all',
      selection: [],
      anchor: null,
      openId: null,
      search: opts?.keepSearch || v.kind === 'search' ? s.search : '',
      list: { key: '', total: 0, pages: {}, loaded: false }
    });
    api.setActiveFolder(v.kind === 'folder' ? v.folderId : null).catch(() => {});
    void get().reloadList();
  },

  setPanel(p) {
    set({ panel: p, selection: [], openId: null });
    if (p === 'outbox') void get().refreshOutbox();
  },

  setFilter(f) {
    set({ filter: f, selection: [], openId: null, list: { ...get().list, key: '' } });
    void get().reloadList();
  },

  setCategory(c) {
    set({ category: c, selection: [], openId: null, list: { ...get().list, key: '' } });
    void get().reloadList();
  },

  setAccountFilter(id) {
    set({ accountFilter: id, selection: [], openId: null, list: { ...get().list, key: '' } });
    void get().reloadList();
  },

  setSearch(q) {
    set({ search: q });
  },

  loadPage(page) {
    const s = get();
    if (s.list.pages[page] || pendingPages.has(`${s.list.key}:${page}`)) return;
    const q = listQuery(s);
    const key = keyOf(q);
    if (key !== s.list.key) return;
    pendingPages.add(`${key}:${page}`);
    api.listMessages(q, page * PAGE, PAGE).then((r) => {
      pendingPages.delete(`${key}:${page}`);
      const cur = get().list;
      if (cur.key !== key) return;
      set({ list: { ...cur, total: r.total, pages: { ...cur.pages, [page]: r.items } } });
      requestPreviews(r.items);
    }).catch(() => pendingPages.delete(`${key}:${page}`));
  },

  async reloadList() {
    const s = get();
    const q = listQuery(s);
    const key = keyOf(q);
    const same = key === s.list.key;
    const pages = same ? Object.keys(s.list.pages).map(Number) : [0];
    if (!pages.length) pages.push(0);
    try {
      const results = await Promise.all(pages.map((p) => api.listMessages(q, p * PAGE, PAGE)));
      if (keyOf(listQuery(get())) !== key) return;
      const next: Record<number, MessageSummary[]> = {};
      pages.forEach((p, i) => { next[p] = results[i].items; });
      const total = results[0]?.total ?? 0;
      set({ list: { key, total, pages: next, loaded: true } });
      // Drop selections that disappeared (moved or deleted elsewhere).
      const visible = new Set(Object.values(next).flat().map((m) => m.id));
      const sel = get().selection.filter((id) => visible.has(id));
      if (sel.length !== get().selection.length) set({ selection: sel });
      requestPreviews(results.flatMap((r) => r.items));
    } catch (e) {
      console.error(e);
    }
  },

  itemAt(index) {
    const l = get().list;
    return l.pages[Math.floor(index / PAGE)]?.[index % PAGE];
  },

  indexOf(id) {
    const l = get().list;
    for (const [p, items] of Object.entries(l.pages)) {
      const i = items.findIndex((m) => m.id === id);
      if (i >= 0) return Number(p) * PAGE + i;
    }
    return -1;
  },

  open(id) {
    set({ openId: id, selection: id == null ? [] : [id], anchor: id });
  },

  select(id, mode) {
    const s = get();
    if (mode === 'single') {
      set({ selection: [id], anchor: id, openId: id });
      return;
    }
    if (mode === 'toggle') {
      const has = s.selection.includes(id);
      const sel = has ? s.selection.filter((x) => x !== id) : [...s.selection, id];
      set({ selection: sel, anchor: id, openId: sel.length === 1 ? sel[0] : sel.length === 0 ? null : s.openId });
      return;
    }
    const a = s.anchor != null ? s.indexOf(s.anchor) : -1;
    const b = s.indexOf(id);
    if (a < 0 || b < 0) { set({ selection: [id], anchor: id, openId: id }); return; }
    const ids: number[] = [];
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) { const m = s.itemAt(i); if (m) ids.push(m.id); }
    set({ selection: ids, openId: ids.length === 1 ? ids[0] : s.openId });
  },

  selectAll() {
    const ids = Object.values(get().list.pages).flat().map((m) => m.id);
    set({ selection: ids });
  },

  clearSelection() {
    set({ selection: [], openId: null });
  },

  moveFocus(delta) {
    const s = get();
    const cur = s.openId != null ? s.indexOf(s.openId) : s.selection.length ? s.indexOf(s.selection[s.selection.length - 1]) : -1;
    const next = Math.max(0, Math.min(s.list.total - 1, cur + delta));
    if (cur === -1 && delta < 0) return;
    const m = s.itemAt(cur === -1 ? 0 : next);
    if (m) s.select(m.id, 'single');
    else s.loadPage(Math.floor(next / PAGE));
  },

  async refreshFolders() {
    const folders = await api.listFolders();
    set({ folders });
  },

  async refreshCounts() {
    const counts = await api.unifiedCounts();
    set({ counts });
    updateBadge(counts.inboxUnread, get().dark);
  },

  async refreshAccounts() {
    const accounts = await api.listAccounts();
    set({ accounts });
  },

  async refreshOutbox() {
    set({ outbox: await api.listOutbox() });
  },

  async updateSettings(patch) {
    const settings = await api.updateSettings(patch);
    set({ settings, dark: applyTheme(settings) });
  },

  toast(t) {
    const id = toastSeq++;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    const duration = t.duration ?? (t.kind === 'error' ? 7000 : t.action ? 6000 : 3200);
    if (duration > 0) setTimeout(() => get().dismissToast(id), duration);
    return id;
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  openModal(m) {
    set({ modal: m });
  },

  closeModal() {
    set({ modal: null });
  },

  compose(prefill) {
    const s = get();
    const accountId = prefill?.accountId ?? s.settings?.defaultAccountId ?? s.accounts.find((a) => a.enabled)?.id ?? null;
    if (!s.accounts.length) {
      s.toast({ kind: 'info', message: '请先添加一个邮箱账户' });
      s.openModal({ type: 'add-account' });
      return;
    }
    const key = `c${composerSeq++}`;
    const composers = s.composers.map((c) => ({ ...c, minimized: true }));
    set({ composers: [...composers, { key, prefill: { ...emptyPrefill(accountId), ...prefill, accountId }, minimized: false }] });
  },

  updateComposer(key, patch) {
    set({ composers: get().composers.map((c) => (c.key === key ? { ...c, ...patch } : patch.minimized === false ? { ...c, minimized: true } : c)) });
  },

  closeComposer(key) {
    set({ composers: get().composers.filter((c) => c.key !== key) });
  },

  async act(kind, ids) {
    const s = get();
    const target = ids ?? (s.selection.length ? s.selection : s.openId != null ? [s.openId] : []);
    if (!target.length) return;
    const nextId = neighbourAfterRemoval(target);
    const labels = { archive: '已归档', trash: '已删除', spam: '已移入垃圾邮件', notspam: '已移回收件箱', delete: '已永久删除' } as const;
    const doIt = async () => {
      try {
        let undo: string | null = null;
        let permanent = false;
        if (kind === 'archive') undo = (await api.archiveMessages(target)).undoToken;
        else if (kind === 'trash') { const r = await api.trashMessages(target); undo = r.undoToken; permanent = r.permanent; }
        else if (kind === 'spam' || kind === 'notspam') undo = (await api.markSpam(target, kind === 'spam')).undoToken;
        else { await api.deletePermanently(target); permanent = true; }
        if (s.openId != null && target.includes(s.openId)) {
          if (nextId != null) get().select(nextId, 'single');
          else set({ openId: null, selection: [] });
        } else set({ selection: [] });
        const n = target.length;
        get().toast({
          kind: 'info',
          message: `${n > 1 ? `${n} 封邮件` : ''}${permanent ? labels.delete : labels[kind]}`,
          action: undo ? { label: '撤销', run: () => api.undo(undo!).catch((e) => get().toast({ kind: 'error', ...errorMessage(e), message: errorMessage(e).title })) } : undefined
        });
      } catch (e) {
        const m = errorMessage(e);
        get().toast({ kind: 'error', message: m.title, detail: m.detail });
      }
    };
    const inTrash = target.every((id) => {
      const m = findLoaded(id);
      const f = m && get().folders.find((x) => x.id === m.folderId);
      return f?.specialUse === 'trash';
    });
    if ((kind === 'delete' || (kind === 'trash' && inTrash)) && s.settings?.confirmDelete !== false) {
      s.openModal({
        type: 'confirm',
        title: '永久删除邮件？',
        message: `将从服务器上永久删除 ${target.length} 封邮件，此操作无法撤销。`,
        confirmLabel: '永久删除',
        danger: true,
        onConfirm: () => void doIt()
      });
      return;
    }
    await doIt();
  },

  async moveTo(ids, folderId) {
    const nextId = neighbourAfterRemoval(ids);
    try {
      const { undoToken } = await api.moveMessages(ids, folderId);
      const f = get().folders.find((x) => x.id === folderId);
      if (get().openId != null && ids.includes(get().openId!)) {
        if (nextId != null) get().select(nextId, 'single');
        else set({ openId: null, selection: [] });
      }
      get().toast({
        kind: 'info',
        message: `已移动到「${f ? folderName(f) : '文件夹'}」`,
        action: undoToken ? { label: '撤销', run: () => api.undo(undoToken).catch(() => {}) } : undefined
      });
    } catch (e) {
      const m = errorMessage(e);
      get().toast({ kind: 'error', message: m.title, detail: m.detail });
    }
  },

  setSeen(ids, seen) {
    patchLoaded(ids, { seen });
    api.setSeen(ids, seen).catch(() => {});
  },

  setFlagged(ids, flagged) {
    patchLoaded(ids, { flagged });
    api.setFlagged(ids, flagged).catch(() => {});
  },

  async reply(mode, id) {
    try {
      const prefill = await api.composePrefill(mode, id);
      get().compose(prefill);
    } catch (e) {
      const m = errorMessage(e);
      get().toast({ kind: 'error', message: m.title, detail: m.detail });
    }
  }
}));

const pendingPages = new Set<string>();

function findLoaded(id: number): MessageSummary | undefined {
  for (const items of Object.values(useApp.getState().list.pages)) {
    const m = items.find((x) => x.id === id);
    if (m) return m;
  }
  return undefined;
}

function patchLoaded(ids: number[], patch: Partial<MessageSummary>) {
  const s = useApp.getState();
  const set = new Set(ids);
  const pages: Record<number, MessageSummary[]> = {};
  for (const [p, items] of Object.entries(s.list.pages)) pages[Number(p)] = items.map((m) => (set.has(m.id) ? { ...m, ...patch } : m));
  useApp.setState({ list: { ...s.list, pages }, readerVersion: s.readerVersion + 1 });
}

function neighbourAfterRemoval(ids: number[]): number | null {
  const s = useApp.getState();
  const removed = new Set(ids);
  const idx = Math.max(...ids.map((id) => s.indexOf(id)));
  for (let i = idx + 1; i < s.list.total; i++) {
    const m = s.itemAt(i);
    if (!m) break;
    if (!removed.has(m.id)) return m.id;
  }
  for (let i = Math.min(...ids.map((id) => s.indexOf(id))) - 1; i >= 0; i--) {
    const m = s.itemAt(i);
    if (m && !removed.has(m.id)) return m.id;
  }
  return null;
}

let previewQueue = new Set<number>();
let previewTimer: ReturnType<typeof setTimeout> | null = null;
function requestPreviews(items: MessageSummary[]) {
  for (const m of items) if (m.snippet === null) previewQueue.add(m.id);
  if (!previewQueue.size || previewTimer) return;
  previewTimer = setTimeout(() => {
    previewTimer = null;
    const ids = [...previewQueue].slice(0, 300);
    previewQueue = new Set([...previewQueue].slice(300));
    api.ensurePreviews(ids).catch(() => {});
  }, 400);
}

function scheduleReload() {
  if (reloadTimer) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    void useApp.getState().reloadList();
    useApp.setState((s) => ({ readerVersion: s.readerVersion + 1 }));
  }, 140);
}

function scheduleCounts() {
  if (countsTimer) return;
  countsTimer = setTimeout(() => {
    countsTimer = null;
    const s = useApp.getState();
    void s.refreshFolders();
    void s.refreshCounts();
  }, 350);
}

let lastBadge = -1;
function updateBadge(count: number, dark: boolean) {
  if (count === lastBadge) return;
  lastBadge = count;
  api.setUnreadBadge(count, count ? drawBadge(count, dark) : null).catch(() => {});
}

function handleEvent(e: AppEvent) {
  const s = useApp.getState();
  switch (e.type) {
    case 'messages-changed':
      scheduleReload();
      scheduleCounts();
      break;
    case 'folders-changed':
      scheduleCounts();
      break;
    case 'accounts-changed':
      void s.refreshAccounts();
      scheduleCounts();
      scheduleReload();
      break;
    case 'sync-status':
      useApp.setState({ accounts: s.accounts.map((a) => (a.id === e.accountId ? { ...a, status: e.status } : a)) });
      break;
    case 'outbox-changed':
      void s.refreshOutbox();
      scheduleCounts();
      break;
    case 'drafts-changed':
      scheduleCounts();
      break;
    case 'settings-changed':
      useApp.setState({ settings: e.settings, dark: applyTheme(e.settings) });
      break;
    case 'diagnose-progress':
      useApp.setState({ diagRuns: { ...s.diagRuns, [e.runId]: e.steps } });
      break;
    case 'toast':
      s.toast({ kind: e.kind, message: e.message, detail: e.detail });
      break;
    case 'compose':
      s.compose(e.prefill);
      break;
    case 'open-message':
      if (s.view.kind !== 'unified' || s.view.box !== 'inbox') s.setView({ kind: 'unified', box: 'inbox' });
      useApp.setState({ panel: 'mail', openId: e.messageId, selection: [e.messageId], anchor: e.messageId });
      break;
    case 'navigate':
      s.setView(e.view);
      break;
    case 'send-result':
      if (e.ok) s.toast({ kind: 'success', message: '邮件已发送', detail: e.subject || undefined });
      else s.toast({ kind: 'error', message: `「${e.subject || '无主题'}」发送失败`, detail: e.error ? `${e.error.title}：${e.error.explanation}` : undefined, action: { label: '查看', run: () => useApp.getState().setPanel('outbox') }, duration: 10000 });
      break;
    case 'window-state':
      useApp.setState({ maximized: e.maximized });
      break;
  }
}

export function persistUi() {
  const s = useApp.getState();
  try {
    localStorage.setItem('hy.ui', JSON.stringify({ collapsedFolders: s.collapsedFolders, collapsedAccounts: s.collapsedAccounts }));
  } catch { /* storage unavailable */ }
}
