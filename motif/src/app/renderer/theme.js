// Appearance of the editor chrome: dark, light or following the system. Canvases are not
// affected (they render the document's own theme).
import { call, isElectron } from './api.js';

const KEY = 'motif.theme';
let mode = 'dark';
let mq = null;

function resolved() {
  if (mode === 'system') return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return mode === 'light' ? 'light' : 'dark';
}

function paint() {
  const t = resolved();
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  if (isElectron) call('window.titleBarOverlay', { color: '#00000000', symbolColor: t === 'light' ? '#3a3f4b' : '#c9cbd6', height: 44 }).catch(() => {});
}

/** Apply 'dark' | 'light' | 'system'. */
export function applyAppearance(next) {
  mode = ['dark', 'light', 'system'].includes(next) ? next : 'dark';
  if (!mq && typeof matchMedia !== 'undefined') {
    mq = matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', () => { if (mode === 'system') paint(); });
  }
  paint();
}

/** Before React mounts: reuse the last resolved theme so the window does not flash. */
export function restoreAppearance() {
  try { document.documentElement.dataset.theme = localStorage.getItem(KEY) || 'dark'; } catch { /* ignore */ }
}
