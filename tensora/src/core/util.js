// Small shared helpers: DOM shortcuts, escaping, seeded randomness, number/date formatting,
// safe localStorage and a number tween. Everything here is pure or DOM-only (no app state).

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

/** mulberry32: tiny deterministic PRNG so the demo data looks the same on every visit. */
export function rng(seed = 1) {
  let a = seed >>> 0;
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
    const u = 1 - next(), v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return next;
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- formatting ---------------------------------------------------------------------------

const trim0 = (s) => s.replace(/\.0+$|(\.\d*?)0+$/, '$1');

export const fmt = {
  int: (n) => Math.round(n).toLocaleString('en-US'),
  num: (n, d = 1) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  compact(n, d = 1) {
    const a = Math.abs(n);
    if (a >= 1e12) return trim0((n / 1e12).toFixed(d + 1)) + 'T';
    if (a >= 1e9) return trim0((n / 1e9).toFixed(d + 1)) + 'B';
    if (a >= 1e6) return trim0((n / 1e6).toFixed(d)) + 'M';
    if (a >= 1e4) return trim0((n / 1e3).toFixed(d)) + 'K';
    if (a >= 1e3) return trim0((n / 1e3).toFixed(2)) + 'K';
    return trim0(Number(n).toFixed(a < 10 && a % 1 ? 2 : 0));
  },
  cny: (n, d = 0) => (n < 0 ? '−¥' : '¥') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  cnyCompact(n) {
    const a = Math.abs(n);
    if (a >= 1e8) return '¥' + trim0((n / 1e8).toFixed(2)) + ' 亿';
    if (a >= 1e4) return '¥' + trim0((n / 1e4).toFixed(1)) + ' 万';
    return fmt.cny(n);
  },
  pct: (n, d = 1) => `${Number(n).toFixed(d)}%`,
  ms: (n) => (n >= 1000 ? `${trim0((n / 1000).toFixed(2))} s` : `${Math.round(n)} ms`),
  dur(sec) {
    sec = Math.max(0, Math.round(sec));
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d) return `${d} 天 ${h} 小时`;
    if (h) return `${h} 小时 ${m} 分`;
    if (m) return `${m} 分 ${sec % 60} 秒`;
    return `${sec} 秒`;
  },
  bytes(n) {
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${trim0(n.toFixed(n < 10 && i ? 1 : 0))} ${u[i]}`;
  },
  time(ts, sec = true) {
    const d = new Date(ts);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}${sec ? ':' + p(d.getSeconds()) : ''}`;
  },
  date(ts, withYear = false) {
    const d = new Date(ts);
    const p = (x) => String(x).padStart(2, '0');
    return `${withYear ? d.getFullYear() + '-' : ''}${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
  rel(ts, now = Date.now()) {
    const s = Math.round((now - ts) / 1000);
    if (s < 10) return '刚刚';
    if (s < 60) return `${s} 秒前`;
    if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
    if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`;
    return fmt.date(ts, true);
  },
};

// ---- storage (per-visitor conveniences only; never required for the app to work) --------

const NS = 'tensora:';
export const saved = {
  get(key, dflt) {
    try { const v = localStorage.getItem(NS + key); return v == null ? dflt : JSON.parse(v); } catch { return dflt; }
  },
  set(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); } catch { /* storage blocked: keep in memory only */ }
  },
};

export const reducedMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off'; } catch { return false; }
};

/** Tween the text of `el` from its current number to `to`. Returns a cancel function. */
export function tweenNumber(el, to, format, dur = 700) {
  if (!el) return () => {};
  const from = Number(el.dataset.v ?? to);
  el.dataset.v = to;
  if (reducedMotion() || from === to) { el.textContent = format(to); return () => {}; }
  const t0 = performance.now();
  let raf = 0;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = format(from + (to - from) * e);
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export function debounce(fn, ms = 120) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Copy text; falls back to a hidden textarea selection when the async clipboard is refused. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`;
