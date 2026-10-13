// Boot: draw the shell, start the live engine and the backdrop, then route hash URLs to pages.
// A page is { domain, mount(view, ctx), update?(params, ctx) }; ctx.keep(fn) registers cleanup.

import { renderShell, setActiveNav, NAV_ITEMS } from './ui/shell.js';
import { createAurora } from './ui/aurora.js';
import { installSpotlight } from './ui/kit.js';
import { toast, closeAllLayers } from './ui/overlay.js';
import { hideTip } from './ui/charts.js';
import { live } from './core/live.js';
import { state, bus } from './core/state.js';
import { copyText, reducedMotion } from './core/util.js';

import overview from './pages/overview.js';
import models from './pages/models.js';
import keys from './pages/keys.js';
import usage from './pages/usage.js';
import tokens from './pages/tokens.js';
import training from './pages/training.js';
import jobs from './pages/jobs.js';
import cluster from './pages/cluster.js';
import billing from './pages/billing.js';
import settings from './pages/settings.js';

const PAGES = { overview, models, keys, usage, tokens, training, jobs, cluster, billing, settings };

const app = document.getElementById('app');
document.documentElement.dataset.accent = state.prefs.accent;
document.documentElement.dataset.motion = state.prefs.motion;
document.documentElement.dataset.density = state.prefs.density;
renderShell(app);
const view = document.getElementById('view');
const aurora = createAurora(document.getElementById('aurora'));
installSpotlight(document.body);

bus.on('toast', (t) => toast(t));
bus.on('prefs', ({ key, value }) => {
  if (key === 'accent' || key === 'motion' || key === 'density') document.documentElement.dataset[key] = value;
  if (key === 'motion') aurora.restart();
});
bus.on('tick', () => aurora.pulse((live.rps - 120) / 360));

// copy buttons inside code blocks anywhere in the app
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const text = b.dataset.copy || b.closest('.code')?.querySelector('pre')?.textContent || '';
  const ok = await copyText(text);
  toast({ kind: ok ? 'good' : 'warn', title: ok ? '已复制到剪贴板' : '无法访问剪贴板', body: ok ? '' : '请手动选中文本复制', timeout: 1800 });
});

let current = null; // { id, page, ctx }
let navToken = 0;

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [id, ...params] = raw.split('/').filter(Boolean);
  return { id: PAGES[id] ? id : 'overview', params };
}

function makeCtx(params) {
  const disposers = [];
  return {
    params,
    disposers,
    keep: (fn) => { if (typeof fn === 'function') disposers.push(fn); return fn; },
    navigate: (path) => { location.hash = '/' + path; },
    replace: (path) => { try { history.replaceState(null, '', '#/' + path); } catch { /* sandboxed frames may refuse */ } },
  };
}

function route() {
  const { id, params } = parse();
  hideTip();
  closeAllLayers();
  if (current && current.id === id && current.page.update) {
    current.page.update(params, current.ctx);
    window.__tensora = { page: id, params };
    return;
  }
  const page = PAGES[id];
  const swap = () => {
    if (current) current.ctx.disposers.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } });
    const ctx = makeCtx(params);
    // each page gets a fresh root so listeners it attaches never leak into the next page
    const root = document.createElement('div');
    root.className = 'page-root';
    view.replaceChildren(root);
    view.className = `view page-${id}`;
    window.scrollTo(0, 0);
    page.mount(root, ctx);
    [...view.querySelectorAll('.rv')].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 14)));
    view.classList.add('entering');
    setTimeout(() => view.classList.remove('entering'), 900);
    current = { id, page, ctx };
    window.__tensora = { page: id, params }; // read by the end-to-end tests
    setActiveNav(id);
    aurora.setTheme(NAV_ITEMS.find((x) => x.id === id)?.domain || 'core');
  };
  const token = ++navToken;
  if (current && !reducedMotion()) {
    view.classList.add('leaving');
    setTimeout(() => { if (token !== navToken) return; view.classList.remove('leaving'); swap(); }, 140);
  } else swap();
}

addEventListener('hashchange', route);
route();
live.start();
