// Login sessions (HttpOnly cookie) with a per-session CSRF token, plus login throttling.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readJson, writeJson } from '../util/json-store.mjs';
import { token } from '../util/ids.mjs';
import { safeEqual } from '../security/vault.mjs';

export const COOKIE = 'lunheng_sid';
const sha = (s) => createHash('sha256').update(s).digest('hex');

export class AuthSessions {
  constructor({ dataDir, ttlMs }) {
    this.file = join(dataDir, 'auth-sessions.json');
    this.ttlMs = ttlMs;
    this.map = new Map();
    this.timer = null;
  }

  async load() {
    const data = (await readJson(this.file, null)) || { sessions: [] };
    const now = Date.now();
    for (const s of data.sessions) if (s.expires > now) this.map.set(s.hash, s);
    return this;
  }

  #persist() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => writeJson(this.file, { sessions: [...this.map.values()] }).catch(() => {}), 300);
  }

  create(userId) {
    const t = token(32);
    const rec = { hash: sha(t), userId, csrf: token(24), createdAt: Date.now(), expires: Date.now() + this.ttlMs };
    this.map.set(rec.hash, rec);
    this.#persist();
    return { token: t, csrf: rec.csrf };
  }

  get(t) {
    if (!t) return null;
    const rec = this.map.get(sha(t));
    if (!rec) return null;
    if (rec.expires < Date.now()) { this.map.delete(rec.hash); this.#persist(); return null; }
    return rec;
  }

  destroy(t) {
    if (t && this.map.delete(sha(t))) this.#persist();
  }

  destroyUser(userId, exceptToken) {
    const keep = exceptToken ? sha(exceptToken) : null;
    for (const [h, s] of this.map) if (s.userId === userId && h !== keep) this.map.delete(h);
    this.#persist();
  }

  checkCsrf(rec, value) {
    return !!rec && !!value && safeEqual(rec.csrf, value);
  }

  async flush() {
    clearTimeout(this.timer);
    await writeJson(this.file, { sessions: [...this.map.values()] });
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(value, { secure, maxAgeMs }) {
  const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (secure) parts.push('Secure');
  parts.push(maxAgeMs ? `Max-Age=${Math.floor(maxAgeMs / 1000)}` : 'Max-Age=0');
  return parts.join('; ');
}

/** Sliding-window attempt limiter keyed by client and username. */
export class Throttle {
  constructor({ max = 10, windowMs = 15 * 60_000 } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }
  check(key) {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, list);
    return list.length < this.max;
  }
  hit(key) {
    const list = this.hits.get(key) || [];
    list.push(Date.now());
    this.hits.set(key, list);
  }
  reset(key) { this.hits.delete(key); }
}
