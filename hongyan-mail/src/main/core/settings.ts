import type { Settings } from '../../shared/types';
import type { Database } from './db';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'cinnabar',
  density: 'comfortable',
  readingPane: 'right',
  showSnippets: true,
  showAvatars: true,
  categoriesEnabled: true,
  conversationView: true,
  markReadDelay: 0,
  syncIntervalMinutes: 3,
  prefetchBodies: true,
  notifications: true,
  notificationSound: true,
  blockRemoteImages: true,
  darkEmailMode: 'original',
  undoSendSeconds: 5,
  closeToTray: true,
  launchAtLogin: false,
  startMinimized: false,
  defaultAccountId: null,
  autodiscoverOnline: true,
  oauth: {
    google: { clientId: '', clientSecret: '' },
    microsoft: { clientId: '', clientSecret: '' }
  },
  sidebarCollapsed: false,
  listWidth: 400,
  mica: false,
  confirmDelete: true,
  trayHintShown: false
};

export class SettingsStore {
  private cache: Settings;

  constructor(private db: Database) {
    const row = db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'app'");
    let stored: Partial<Settings> = {};
    if (row) {
      try { stored = JSON.parse(row.value); } catch { stored = {}; }
    }
    this.cache = merge(DEFAULT_SETTINGS, stored);
  }

  get(): Settings {
    return structuredClone(this.cache);
  }

  update(patch: Partial<Settings>): Settings {
    this.cache = merge(this.cache, patch);
    this.db.run("INSERT INTO settings(key, value) VALUES('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", JSON.stringify(this.cache));
    return this.get();
  }

  /** Small key/value store for internal state that is not a user setting. */
  getValue<T>(key: string, fallback: T): T {
    const row = this.db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'kv:' + key);
    if (!row) return fallback;
    try { return JSON.parse(row.value) as T; } catch { return fallback; }
  }

  setValue(key: string, value: unknown) {
    this.db.run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'kv:' + key, JSON.stringify(value));
  }
}

function merge<T>(base: T, patch: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined) continue;
    const cur = (base as any)?.[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)) out[k] = merge(cur, v as any);
    else out[k] = v;
  }
  return out;
}
