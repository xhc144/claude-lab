// Thin client for the preload bridge. Falls back to a stub in a plain browser so UI pieces can be
// developed and tested without Electron.
const bridge = typeof window !== 'undefined' ? window.motif : null;

export const isElectron = !!bridge;
export const platform = bridge?.platform || 'web';

export function call(method, ...args) {
  if (!bridge) return Promise.reject(new Error(`桌面环境不可用（${method}）`));
  return bridge.call(method, ...args);
}

export function on(channel, fn) { return bridge ? bridge.on(channel, fn) : () => {}; }
export function pathOf(file) { return bridge ? bridge.pathOf(file) : null; }

export const fmtTime = (s) => {
  if (!isFinite(s)) s = 0;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(1).padStart(4, '0')}`;
};

export const fmtBytes = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${Math.round(n / 1e3)} KB` : `${n || 0} B`);

export function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
