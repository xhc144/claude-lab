// Persistent settings. API keys are encrypted with the OS keychain (DPAPI on
// Windows) through Electron's safeStorage and never written in plain text.
import { app, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Settings, AiProviderConfig } from '../shared/types.ts';

const FILE = () => join(app.getPath('userData'), 'settings.json');

export function defaultDataDir(): string {
  return join(app.getPath('documents'), 'Phonica');
}

export const DEFAULT_PROVIDERS: AiProviderConfig[] = [
  { id: 'openai', name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-audio-preview', audioInput: true, temperature: 0.4, maxTokens: 4000 },
  { id: 'anthropic', name: 'Claude (Anthropic)', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-opus-5-5', audioInput: false, temperature: 0.4, maxTokens: 16000 },
  { id: 'deepseek', name: 'DeepSeek', kind: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat', audioInput: false, temperature: 0.4, maxTokens: 4000 },
  { id: 'gemini', name: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '', model: 'gemini-2.5-flash', audioInput: true, temperature: 0.4, maxTokens: 4000 },
];

export function defaultSettings(): Settings {
  return {
    accent: 'us',
    voiceUS: 'af_heart',
    voiceUK: 'bf_emma',
    ttsSpeed: 1,
    theme: 'system',
    inputDeviceId: 'default',
    recordSampleRate: 48000,
    autoStopSilenceSec: 0,
    exportBitrate: 64,
    exportSampleRate: 24000,
    exportIncludeReference: false,
    aiProviders: DEFAULT_PROVIDERS.map((p) => ({ ...p })),
    aiActiveProvider: 'openai',
    aiLanguage: 'zh',
    dataDir: defaultDataDir(),
    autoUpdate: true,
  };
}

type Stored = Omit<Settings, 'aiProviders'> & { aiProviders: Array<Omit<AiProviderConfig, 'apiKey'> & { apiKeyEnc?: string; apiKeyPlain?: string }> };

let cache: Settings | null = null;

function enc(key: string): { apiKeyEnc?: string; apiKeyPlain?: string } {
  if (!key) return {};
  if (safeStorage.isEncryptionAvailable()) return { apiKeyEnc: safeStorage.encryptString(key).toString('base64') };
  // no keychain (rare on Linux without a secret service): keep it, but mark it plainly
  return { apiKeyPlain: key };
}

function dec(p: { apiKeyEnc?: string; apiKeyPlain?: string }): string {
  if (p.apiKeyEnc) {
    try {
      return safeStorage.decryptString(Buffer.from(p.apiKeyEnc, 'base64'));
    } catch {
      return '';
    }
  }
  return p.apiKeyPlain ?? '';
}

export function loadSettings(): Settings {
  if (cache) return cache;
  const d = defaultSettings();
  try {
    if (existsSync(FILE())) {
      const s = JSON.parse(readFileSync(FILE(), 'utf8')) as Partial<Stored>;
      const providers = (s.aiProviders ?? []).map((p) => ({ ...p, apiKey: dec(p) }) as AiProviderConfig & { apiKeyEnc?: string; apiKeyPlain?: string });
      for (const p of providers) { delete p.apiKeyEnc; delete p.apiKeyPlain; }
      cache = { ...d, ...s, aiProviders: providers.length ? providers : d.aiProviders } as Settings;
    } else cache = d;
  } catch {
    cache = d;
  }
  return cache!;
}

export function saveSettings(next: Settings): Settings {
  const stored: Stored = {
    ...next,
    aiProviders: next.aiProviders.map(({ apiKey, ...rest }) => ({ ...rest, ...enc(apiKey) })),
  };
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(FILE(), JSON.stringify(stored, null, 1));
  cache = { ...next };
  return cache;
}

/** Settings as sent to the renderer: keys are masked. */
export function publicSettings(s: Settings): Settings {
  return { ...s, aiProviders: s.aiProviders.map((p) => ({ ...p, apiKey: p.apiKey ? '••••' + p.apiKey.slice(-4) : '' })) };
}

/** Merge settings coming back from the renderer, keeping keys that were not edited. */
export function mergeFromRenderer(cur: Settings, incoming: Settings): Settings {
  return {
    ...incoming,
    aiProviders: incoming.aiProviders.map((p) => {
      const old = cur.aiProviders.find((o) => o.id === p.id);
      const masked = p.apiKey.startsWith('••••');
      return { ...p, apiKey: masked ? (old?.apiKey ?? '') : p.apiKey.trim() };
    }),
  };
}
