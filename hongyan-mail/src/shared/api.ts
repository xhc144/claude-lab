// The request/response surface the renderer can call in the main process.
// Every method is invoked through a single IPC channel ('hy:invoke').
import type {
  AccountDraftInput, AccountPatch, AccountSummary, AppInfo, CategoryCounts, ComposePayload, ComposePrefill,
  ContactSuggestion, DiagnosisReport, DiscoveryResult, DraftRecord, FolderInfo, ListQuery, ListResult,
  MessageDetail, OAuthProviderId, OAuthResult, OutboxItem, SearchServerResult, ServerConfig, Settings,
  UnifiedCounts, ComposeAttachment, AccountCredentialInput, Category
} from './types';

export interface MailApi {
  // app
  getAppInfo(): Promise<AppInfo>;
  openDataDir(): Promise<void>;
  openLogsDir(): Promise<void>;
  openExternal(url: string): Promise<void>;
  setUnreadBadge(count: number, pngDataUrl: string | null): Promise<void>;
  setTitleBarColors(colors: { color: string; symbolColor: string }): Promise<void>;
  windowControl(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
  setNetworkOnline(online: boolean): Promise<void>;

  // settings
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  // accounts
  listAccounts(): Promise<AccountSummary[]>;
  discover(email: string): Promise<DiscoveryResult>;
  testConnection(input: AccountDraftInput, runId: string): Promise<DiagnosisReport>;
  addAccount(input: AccountDraftInput): Promise<AccountSummary>;
  updateAccount(id: number, patch: AccountPatch): Promise<AccountSummary>;
  removeAccount(id: number): Promise<void>;
  reorderAccounts(ids: number[]): Promise<void>;
  diagnoseAccount(id: number, runId: string, override?: AccountCredentialInput): Promise<DiagnosisReport>;
  startOAuth(provider: OAuthProviderId, loginHint?: string): Promise<OAuthResult>;
  cancelOAuth(): Promise<void>;

  // folders
  listFolders(): Promise<FolderInfo[]>;
  createFolder(accountId: number, name: string, parentPath?: string | null): Promise<void>;
  renameFolder(folderId: number, newName: string): Promise<void>;
  deleteFolder(folderId: number): Promise<void>;
  setActiveFolder(folderId: number | null): Promise<void>;

  // messages
  listMessages(query: ListQuery, start: number, count: number): Promise<ListResult>;
  categoryCounts(query: ListQuery): Promise<CategoryCounts>;
  unifiedCounts(): Promise<UnifiedCounts>;
  getMessage(id: number): Promise<MessageDetail>;
  getThread(id: number): Promise<{ ids: number[]; current: number }>;
  ensurePreviews(ids: number[]): Promise<void>;
  setSeen(ids: number[], seen: boolean): Promise<void>;
  setFlagged(ids: number[], flagged: boolean): Promise<void>;
  moveMessages(ids: number[], destFolderId: number): Promise<{ undoToken: string | null }>;
  archiveMessages(ids: number[]): Promise<{ undoToken: string | null }>;
  trashMessages(ids: number[]): Promise<{ undoToken: string | null; permanent: boolean }>;
  deletePermanently(ids: number[]): Promise<void>;
  markSpam(ids: number[], spam: boolean): Promise<{ undoToken: string | null }>;
  undo(token: string): Promise<void>;
  setCategory(ids: number[], category: Category, applyToSender: boolean): Promise<void>;
  markFolderRead(folderId: number): Promise<void>;
  trustSender(address: string): Promise<void>;
  saveAttachment(messageId: number, index: number): Promise<string | null>;
  saveAllAttachments(messageId: number): Promise<string | null>;
  openAttachment(messageId: number, index: number): Promise<void>;
  exportEml(messageId: number): Promise<string | null>;
  getSource(messageId: number): Promise<string>;
  printMessage(messageId: number): Promise<void>;
  unsubscribe(messageId: number): Promise<'opened' | 'sent' | 'none'>;

  // search
  searchServer(query: string, accountId?: number | null): Promise<SearchServerResult>;

  // compose
  suggestContacts(prefix: string): Promise<ContactSuggestion[]>;
  composePrefill(mode: 'reply' | 'replyAll' | 'forward' | 'draft', messageId: number): Promise<ComposePrefill>;
  pickAttachments(): Promise<ComposeAttachment[]>;
  statFiles(paths: string[]): Promise<ComposeAttachment[]>;
  send(payload: ComposePayload, sendAt?: number | null): Promise<{ outboxId: number; sendAt: number }>;
  cancelSend(outboxId: number): Promise<ComposePayload | null>;
  listOutbox(): Promise<OutboxItem[]>;
  retryOutbox(id: number): Promise<void>;
  deleteOutbox(id: number): Promise<void>;
  editOutbox(id: number): Promise<ComposePayload | null>;
  saveDraft(payload: ComposePayload, uploadToServer: boolean): Promise<number>;
  deleteDraft(id: number): Promise<void>;
  listDrafts(): Promise<DraftRecord[]>;

  // sync
  syncNow(accountId?: number | null): Promise<void>;
}

export type ApiMethod = keyof MailApi;

export interface Bridge {
  invoke<K extends ApiMethod>(method: K, ...args: Parameters<MailApi[K]>): ReturnType<MailApi[K]>;
  onEvent(cb: (event: import('./types').AppEvent) => void): () => void;
  platform: string;
  /** Absolute path of a file dropped onto the window. */
  pathForFile(file: File): string;
}

// Placeholder so the module is not type-only (keeps isolatedModules happy for re-exports).
export const API_CHANNEL = 'hy:invoke';
export const EVENT_CHANNEL = 'hy:event';
export type { ServerConfig };
