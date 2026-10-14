// Runtime configuration. Everything is overridable through LUNHENG_* environment variables.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const bool = (v, fallback) => {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== undefined ? n : fallback;
};

export function loadConfig(env = process.env, overrides = {}) {
  const host = env.LUNHENG_HOST || '127.0.0.1';
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  const cfg = {
    host,
    port: num(env.LUNHENG_PORT, 8848),
    dataDir: resolve(env.LUNHENG_DATA_DIR || resolve(ROOT, 'data')),
    publicDir: resolve(ROOT, 'public'),
    // 32-byte key as hex or base64. When absent a key file is generated inside dataDir (mode 0600).
    masterKey: env.LUNHENG_MASTER_KEY || '',
    // open: anyone may register; invite: registration needs LUNHENG_INVITE_CODE; closed: only the first account.
    signup: ['open', 'invite', 'closed'].includes(env.LUNHENG_SIGNUP) ? env.LUNHENG_SIGNUP : 'open',
    inviteCode: env.LUNHENG_INVITE_CODE || '',
    // Model endpoints on private networks (Ollama, LAN relays) are only reachable when this is on.
    // Default: allowed when the console itself listens on loopback (single-user workstation).
    allowPrivateHosts: bool(env.LUNHENG_ALLOW_PRIVATE_HOSTS, loopback),
    secureCookies: bool(env.LUNHENG_SECURE_COOKIES, false),
    sessionTtlMs: num(env.LUNHENG_SESSION_TTL_HOURS, 24 * 7) * 3600_000,
    maxBodyBytes: 2 * 1024 * 1024,
    sandboxTimeoutMs: num(env.LUNHENG_SANDBOX_TIMEOUT_MS, 4000),
    sandboxMemoryMb: num(env.LUNHENG_SANDBOX_MEMORY_MB, 64),
    logLevel: env.LUNHENG_LOG_LEVEL || 'info',
    ...overrides,
  };
  return cfg;
}
