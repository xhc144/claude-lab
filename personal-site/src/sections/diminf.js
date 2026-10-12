// Dimension ∞: countdown to 1 January 2027 (Beijing time).
import { onFrame } from '../core/loop.js';

export function initDimInf() {
  const target = Date.UTC(2026, 11, 31, 16, 0, 0); // 2027-01-01 00:00 UTC+8
  const out = {};
  for (const b of document.querySelectorAll('[data-cd]')) out[b.dataset.cd] = b;
  let lastS = -1;
  onFrame(() => {
    const ms = Math.max(0, target - Date.now());
    const s = Math.floor(ms / 1000);
    if (s === lastS) return;
    lastS = s;
    out.d.textContent = String(Math.floor(s / 86400)).padStart(3, '0');
    out.h.textContent = String(Math.floor(s / 3600) % 24).padStart(2, '0');
    out.m.textContent = String(Math.floor(s / 60) % 60).padStart(2, '0');
    out.s.textContent = String(s % 60).padStart(2, '0');
  });
}
