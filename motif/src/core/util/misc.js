// Small isomorphic helpers: ids, hashing, seeded randomness, deep object utilities.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function uid(prefix = '', len = 8) {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % 36];
  return prefix ? `${prefix}_${s}` : s;
}

/** FNV-1a 32-bit string hash. */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) seeded by number or string. */
export function rng(seed = 1) {
  let a = typeof seed === 'string' ? hash32(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.gauss = () => {
    const u = Math.max(1e-9, next()), v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return next;
}

export const clone = (v) => (v === undefined ? undefined : globalThis.structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** Deep merge: objects merge recursively, arrays and scalars replace. `null` deletes a key. */
export function deepMerge(target, patch) {
  if (!isPlainObject(patch)) return clone(patch);
  const out = isPlainObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else if (isPlainObject(v) && isPlainObject(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = clone(v);
  }
  return out;
}

/** JSON-pointer-ish path helpers. Accepts "/a/0/b", "a.0.b" or ["a",0,"b"]. */
export function parsePath(p) {
  if (Array.isArray(p)) return p;
  const s = String(p);
  const parts = s.startsWith('/') ? s.slice(1).split('/') : s.split('.');
  return parts.filter((x) => x !== '').map((x) => x.replace(/~1/g, '/').replace(/~0/g, '~')).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
}

export function getPath(obj, p) {
  let cur = obj;
  for (const k of parsePath(p)) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function setPath(obj, p, value) {
  const parts = parsePath(p);
  if (!parts.length) return value;
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const next = cur[k];
    cur[k] = Array.isArray(next) ? [...next] : isPlainObject(next) ? { ...next } : typeof parts[i + 1] === 'number' ? [] : {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  if (value === undefined) {
    if (Array.isArray(cur) && typeof last === 'number') cur.splice(last, 1);
    else delete cur[last];
  } else if (Array.isArray(cur) && last === '-') cur.push(value);
  else cur[last] = value;
  return root;
}

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
export const sum = (arr) => arr.reduce((s, x) => s + (Number(x) || 0), 0);

/** Levenshtein distance for "did you mean" suggestions. */
export function editDistance(a, b) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function suggest(word, options) {
  let best = null, d = Infinity;
  for (const o of options) {
    const x = editDistance(word, o);
    if (x < d) { d = x; best = o; }
  }
  return d <= Math.max(2, Math.floor(String(word).length / 3)) ? best : null;
}

/** Stable JSON stringify (sorted keys) for hashing/caching. */
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

export const slugify = (s) => String(s || 'untitled').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'untitled';

/** Parse loose numeric input: "1,234.5", "35%", "¥1.2亿", "-3.4k". Returns {value, unit, prefix} or null. */
export function parseNumberish(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return { value: input, prefix: '', suffix: '' };
  if (typeof input !== 'string') return null;
  const s = input.trim();
  const m = /^([^\d\-+.]*?)\s*([-+−]?\d[\d,，]*(?:\.\d+)?|[-+−]?\.\d+)\s*(.*)$/.exec(s);
  if (!m) return null;
  const value = parseFloat(m[2].replace(/[,，]/g, '').replace('−', '-'));
  if (!Number.isFinite(value)) return null;
  return { value, prefix: m[1] || '', suffix: (m[3] || '').trim() };
}
