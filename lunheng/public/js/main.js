// Boot, session check and hash routing.
import { get, onUnauthorized, setCsrf } from './api.js';
import { h, clear } from './lib/dom.js';
import { setCurrency } from './lib/fmt.js';
import { startBackground } from './viz/bg.js';
import { mountAuth } from './views/auth.js';
import { buildShell } from './views/shell.js';
import { mountArchive } from './views/archive.js';
import { mountGateway } from './views/gateway.js';
import { mountWizard } from './views/wizard.js';
import { mountConsole } from './views/console.js';
import { mountSettings } from './views/settings.js';

export const app = { meta: null, user: null };
const root = document.getElementById('app');
let cleanup = null;
let shell = null;

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

export function applyUser(user) {
  app.user = user;
  setCurrency(user?.settings?.currency || 'USD', user?.settings?.cnyPerUsd || 7.1);
}

async function route() {
  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
  const hash = location.hash.replace(/^#/, '') || '/';
  if (!app.user) {
    shell = null;
    clear(root);
    cleanup = mountAuth(root, { onLogin: (user) => { applyUser(user); navigate('#/'); } });
    return;
  }
  if (!shell) { clear(root); shell = buildShell(root); }
  const [, section, id] = hash.split('/');
  shell.setActive(section || 'archive');
  const host = shell.main;
  clear(host);
  if (!section) cleanup = await mountArchive(host);
  else if (section === 'new') cleanup = await mountWizard(host, { from: id });
  else if (section === 'gateway') cleanup = await mountGateway(host);
  else if (section === 'settings') cleanup = await mountSettings(host);
  else if (section === 's' && id) cleanup = await mountConsole(host, id);
  else navigate('#/');
}

async function boot() {
  startBackground(document.getElementById('bg'));
  try {
    app.meta = await get('/api/meta');
  } catch {
    clear(root, h('div.empty', {}, h('h3', {}, '无法连接论衡服务器'), h('p', {}, '请确认服务已启动后刷新页面。')));
    return;
  }
  try {
    const me = await get('/api/auth/me');
    if (me.user) { setCsrf(me.csrf); applyUser(me.user); }
  } catch { app.user = null; }
  onUnauthorized(() => { app.user = null; shell = null; route(); });
  window.addEventListener('hashchange', route);
  route();
}

export function logout() {
  app.user = null;
  shell = null;
  navigate('#/');
}

boot();
