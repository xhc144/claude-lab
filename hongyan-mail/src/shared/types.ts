// Types shared by the main process, the preload bridge and the renderer.

export type Security = 'tls' | 'starttls' | 'none';
export type AuthType = 'password' | 'oauth2';
export type OAuthProviderId = 'google' | 'microsoft';

export interface ServerConfig {
  host: string;
  port: number;
  security: Security;
}

export interface Address {
  name: string;
  address: string;
}

export type SpecialUse = 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive' | 'all' | 'flagged' | 'important';

export type Category = 'primary' | 'notifications' | 'promotions' | 'social';

export type SyncState = 'idle' | 'connecting' | 'syncing' | 'error' | 'offline' | 'disabled';

export interface SyncProgress {
  label: string;
  done: number;
  total: number;
}

export interface AccountStatus {
  state: SyncState;
  message?: string;
  diagnosis?: Diagnosis | null;
  progress?: SyncProgress | null;
  lastSyncAt?: number | null;
}

export interface AccountSummary {
  id: number;
  email: string;
  displayName: string;
  label: string;
  color: string;
  providerId: string | null;
  providerName: string;
  authType: AuthType;
  oauthProvider: OAuthProviderId | null;
  imap: ServerConfig;
  smtp: ServerConfig;
  username: string;
  smtpUsername: string | null;
  allowInsecureTls: boolean;
  signature: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  status: AccountStatus;
}

export interface FolderInfo {
  id: number;
  accountId: number;
  path: string;
  name: string;
  parentPath: string | null;
  delimiter: string | null;
  specialUse: SpecialUse | null;
  total: number;
  unread: number;
  selectable: boolean;
  depth: number;
  syncedCount: number;
  backfillDone: boolean;
}

export interface MessageSummary {
  id: number;
  accountId: number;
  folderId: number;
  uid: number;
  msgKey: string;
  threadKey: string;
  subject: string;
  from: Address | null;
  to: Address[];
  cc: Address[];
  date: number;
  snippet: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  forwarded: boolean;
  draft: boolean;
  hasAttachments: boolean;
  category: Category;
  size: number;
  bodyCached: boolean;
}

export interface AttachmentInfo {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  inline: boolean;
  contentId: string | null;
}

export interface MessageDetail extends MessageSummary {
  replyTo: Address[];
  bcc: Address[];
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  html: string | null;
  text: string | null;
  attachments: AttachmentInfo[];
  listUnsubscribe: string | null;
  trustedSender: boolean;
  folderPath: string;
  folderSpecialUse: SpecialUse | null;
  /** Capability token required by hy-att:// URLs for this message's attachments. */
  attachmentToken: string;
}

export type UnifiedBox = 'inbox' | 'starred' | 'unread' | 'sent' | 'drafts' | 'attachments' | 'archive' | 'trash' | 'junk';

export type ViewSpec =
  | { kind: 'unified'; box: UnifiedBox }
  | { kind: 'folder'; accountId: number; folderId: number }
  | { kind: 'search'; query: string; accountId?: number | null };

export type ListFilter = 'all' | 'unread' | 'starred' | 'attachments';

export interface ListQuery {
  view: ViewSpec;
  filter: ListFilter;
  category: Category | 'all';
  /** Restrict a unified view to one account. */
  accountId?: number | null;
}

export interface ListResult {
  items: MessageSummary[];
  total: number;
  start: number;
}

export interface CategoryCounts {
  all: number;
  primary: number;
  notifications: number;
  promotions: number;
  social: number;
}

export interface UnifiedCounts {
  inboxUnread: number;
  starred: number;
  drafts: number;
  outbox: number;
  unreadTotal: number;
}

// ---------- Discovery & diagnostics ----------

export type AuthHintKind = 'app-password' | 'authorization-code' | 'password' | 'oauth-recommended' | 'oauth-required';

export interface ProviderInfo {
  id: string;
  name: string;
  imap: ServerConfig;
  smtp: ServerConfig;
  /** Suggested way to sign in. */
  auth: AuthHintKind;
  oauth?: OAuthProviderId;
  /** Username format: full email address or local part. */
  usernameStyle: 'email' | 'local';
  /** Short Chinese explanation of how to enable IMAP / obtain the credential. */
  help: string[];
  helpUrl?: string;
  passwordLabel: string;
  /** Hosts for which Gmail-specific behaviours apply. */
  quirks?: { gmail?: boolean; smtpSavesSent?: boolean };
}

export interface DiscoveryResult {
  email: string;
  domain: string;
  source: 'builtin' | 'mx' | 'ispdb' | 'autoconfig' | 'guess' | 'none';
  provider: ProviderInfo | null;
  /** Human-readable notes about how the configuration was found. */
  notes: string[];
}

export type DiagStepId = 'dns' | 'tcp' | 'tls' | 'greeting' | 'auth' | 'folders' | 'smtp-dns' | 'smtp-tcp' | 'smtp-tls' | 'smtp-auth' | 'oauth';
export type DiagStepStatus = 'pending' | 'running' | 'ok' | 'warn' | 'fail' | 'skipped';

export interface DiagStep {
  id: DiagStepId;
  label: string;
  status: DiagStepStatus;
  detail?: string;
  ms?: number;
}

export interface Diagnosis {
  /** Short machine-readable kind, e.g. 'auth', 'dns', 'tls-cert'. */
  kind: string;
  title: string;
  explanation: string;
  suggestions: string[];
  technical?: string;
  /** If true the user must change something (credentials, settings) before retrying helps. */
  needsUserAction: boolean;
  helpUrl?: string;
}

export interface DiagnosisReport {
  ok: boolean;
  steps: DiagStep[];
  diagnosis: Diagnosis | null;
  serverInfo?: { imapGreeting?: string; capabilities?: string[]; smtpGreeting?: string; folders?: number };
}

export interface AccountCredentialInput {
  authType: AuthType;
  password?: string;
  /** Handle of a completed OAuth flow (tokens are held in the main process). */
  oauthSession?: string;
  oauthProvider?: OAuthProviderId;
}

export interface AccountDraftInput extends AccountCredentialInput {
  email: string;
  displayName: string;
  providerId: string | null;
  imap: ServerConfig;
  smtp: ServerConfig;
  username: string;
  smtpUsername?: string | null;
  allowInsecureTls?: boolean;
}

export interface AccountPatch {
  displayName?: string;
  label?: string;
  color?: string;
  signature?: string;
  enabled?: boolean;
  imap?: ServerConfig;
  smtp?: ServerConfig;
  username?: string;
  smtpUsername?: string | null;
  allowInsecureTls?: boolean;
  credentials?: AccountCredentialInput;
}

export interface OAuthResult {
  session: string;
  email: string | null;
  provider: OAuthProviderId;
}

// ---------- Compose ----------

export interface ComposeAttachment {
  /** Local file to attach. */
  path?: string;
  /** Attachment taken from an existing message (forwarding). */
  fromMessage?: { messageId: number; index: number };
  filename: string;
  contentType?: string;
  size: number;
}

export interface ComposePayload {
  accountId: number;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  subject: string;
  html: string;
  attachments: ComposeAttachment[];
  inReplyTo?: string | null;
  references?: string[];
  /** Local id of the message being replied to / forwarded (to set \Answered). */
  replyToMessageId?: number | null;
  forwardOfMessageId?: number | null;
  draftId?: number | null;
  /** Server copy of the draft to delete once sent. */
  serverDraftMessageId?: number | null;
}

export interface DraftRecord extends ComposePayload {
  id: number;
  updatedAt: number;
}

export type OutboxStatus = 'queued' | 'sending' | 'failed' | 'sent';

export interface OutboxItem {
  id: number;
  accountId: number;
  subject: string;
  to: Address[];
  sendAt: number;
  status: OutboxStatus;
  error: Diagnosis | null;
  attempts: number;
  createdAt: number;
}

export interface ComposePrefill {
  mode: 'new' | 'reply' | 'replyAll' | 'forward' | 'draft';
  accountId: number | null;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  subject: string;
  html: string;
  attachments: ComposeAttachment[];
  inReplyTo: string | null;
  references: string[];
  replyToMessageId: number | null;
  forwardOfMessageId: number | null;
  draftId: number | null;
  serverDraftMessageId: number | null;
}

// ---------- Settings ----------

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentId = 'cinnabar' | 'indigo' | 'celadon' | 'amber' | 'wisteria' | 'ink';
export type Density = 'comfortable' | 'compact';

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface Settings {
  theme: ThemeMode;
  accent: AccentId;
  density: Density;
  readingPane: 'right' | 'off';
  showSnippets: boolean;
  showAvatars: boolean;
  categoriesEnabled: boolean;
  conversationView: boolean;
  markReadDelay: number; // seconds; 0 = immediately, -1 = never
  syncIntervalMinutes: number;
  prefetchBodies: boolean;
  notifications: boolean;
  notificationSound: boolean;
  blockRemoteImages: boolean;
  darkEmailMode: 'original' | 'adaptive';
  undoSendSeconds: number;
  closeToTray: boolean;
  launchAtLogin: boolean;
  startMinimized: boolean;
  defaultAccountId: number | null;
  autodiscoverOnline: boolean;
  oauth: { google: OAuthClientConfig; microsoft: OAuthClientConfig };
  sidebarCollapsed: boolean;
  listWidth: number;
  mica: boolean;
  confirmDelete: boolean;
  trayHintShown: boolean;
}

export interface AppInfo {
  version: string;
  platform: string;
  osRelease: string;
  isWindows11: boolean;
  dataDir: string;
  encryptionAvailable: boolean;
  encryptionBackend: string;
  electron: string;
  chrome: string;
  dev: boolean;
}

// ---------- Events from main to renderer ----------

export type AppEvent =
  | { type: 'accounts-changed' }
  | { type: 'folders-changed'; accountId: number }
  | { type: 'messages-changed'; accountId: number; folderIds: number[]; reason?: string }
  | { type: 'sync-status'; accountId: number; status: AccountStatus }
  | { type: 'outbox-changed' }
  | { type: 'drafts-changed' }
  | { type: 'settings-changed'; settings: Settings }
  | { type: 'diagnose-progress'; runId: string; steps: DiagStep[] }
  | { type: 'toast'; kind: 'info' | 'success' | 'error'; message: string; detail?: string }
  | { type: 'compose'; prefill: Partial<ComposePrefill> }
  | { type: 'open-message'; messageId: number }
  | { type: 'send-result'; outboxId: number; ok: boolean; subject: string; error?: Diagnosis | null }
  | { type: 'navigate'; view: ViewSpec }
  | { type: 'window-state'; maximized: boolean; focused: boolean };

export interface SearchServerResult {
  imported: number;
  searchedFolders: number;
  errors: string[];
}

export interface BlockedSender {
  /** "name@example.com", or "@example.com" for a whole domain. */
  pattern: string;
  createdAt: number;
}

export interface ContactSuggestion extends Address {
  count: number;
}

/** Error shape thrown across IPC. */
export interface IpcError {
  message: string;
  code?: string;
  diagnosis?: Diagnosis | null;
}
