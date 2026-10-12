// Scroll-driven state: per-element progress (--p), the active chapter, and scroll velocity.
//   data-progress            p = (vh − top) / height     (0 when the element enters, 1 when its bottom reaches the viewport bottom)
//   data-progress="pin"      p = −top / (height − vh)    (progress while a sticky child is pinned)
import { onFrame } from './loop.js';
import { bus } from './bus.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const tracked = [];
export const scrollState = { y: 0, v: 0, speed: 0, total: 0, chapter: null };

export function track(el, cb, mode = el.dataset.progress === 'pin' ? 'pin' : 'enter') {
  const t = { el, cb, mode, last: -1 };
  tracked.push(t);
  return t;
}

export function progressOf(el, mode = 'enter') {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (mode === 'pin') { const span = r.height - vh; return span > 0 ? clamp(-r.top / span, 0, 1) : 0; }
  return clamp((vh - r.top) / r.height, 0, 1);
}

export function initScroll() {
  const chapters = [...document.querySelectorAll('[data-chapter]')];
  for (const el of document.querySelectorAll('[data-progress]')) if (!tracked.some((t) => t.el === el)) track(el, null);
  let lastY = window.scrollY;
  onFrame(({ dt }) => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    // a jump of more than two screens in one frame is a teleport (anchor, scrollTo), not motion
    const jump = Math.abs(y - lastY) > vh * 2;
    const v = jump || performance.now() < navUntil ? 0 : (y - lastY) / Math.max(dt, 1e-3);
    lastY = y;
    scrollState.v = v;
    scrollState.speed += (Math.abs(v) - scrollState.speed) * Math.min(1, dt * 5);
    scrollState.y = y;
    const max = document.documentElement.scrollHeight - vh;
    scrollState.total = max > 0 ? clamp(y / max, 0, 1) : 0;
    for (const t of tracked) {
      const p = progressOf(t.el, t.mode);
      if (Math.abs(p - t.last) > 1e-4) {
        t.last = p;
        t.el.style.setProperty('--p', p.toFixed(4));
        if (t.cb) t.cb(p);
      }
    }
    const mid = vh * 0.5;
    let cur = null;
    for (const c of chapters) {
      const r = c.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { cur = c; break; }
    }
    if (!cur && chapters.length) cur = y < 10 ? chapters[0] : chapters[chapters.length - 1];
    if (cur !== scrollState.chapter) {
      const prev = scrollState.chapter;
      scrollState.chapter = cur;
      bus.emit('chapter', { el: cur, prev });
    }
  });
}

let navUntil = 0;
export function scrollToId(id, { offset = 0 } = {}) {
  navUntil = performance.now() + 1800; // smooth navigation is not the visitor scrolling fast
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top: id === 'hero' ? 0 : y, behavior: 'smooth' });
}
