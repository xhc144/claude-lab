// Dimension ∞: elapsed browser session time.
import { onFrame } from '../core/loop.js';

export function initDimInf() {
  const started = Date.now();
  const out = {};
  for (const b of document.querySelectorAll('[data-cd]')) out[b.dataset.cd] = b;
  let lastS = -1;
  onFrame(() => {
    const ms = Math.max(0, Date.now() - started);
    const s = Math.floor(ms / 1000);
    if (s === lastS) return;
    lastS = s;
    out.d.textContent = String(Math.floor(s / 86400)).padStart(3, '0');
    out.h.textContent = String(Math.floor(s / 3600) % 24).padStart(2, '0');
    out.m.textContent = String(Math.floor(s / 60) % 60).padStart(2, '0');
    out.s.textContent = String(s % 60).padStart(2, '0');
  });
}
