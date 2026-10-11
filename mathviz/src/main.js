// App shell: navigation, routing between modules, header actions, help dialog, toasts.

import { h, icon, downloadCanvas } from './ui/dom.js';
import { ICONS } from './ui/icons.js';
import { iconButton } from './ui/controls.js';
import matrix from './modules/matrix.js';
import complexMap from './modules/complex.js';
import ode from './modules/ode.js';
import threebody from './modules/threebody.js';

const MODULES = [matrix, complexMap, ode, threebody];
const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));

const root = document.getElementById('app');
root.textContent = '';

// ---- toasts
const toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' });
document.body.append(toastBox);
function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  toastBox.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---- layout
const nav = h('nav', { class: 'nav', 'aria-label': '模块' });
MODULES.forEach((m, k) => {
  nav.append(h('a', { class: 'nav-item', href: `#/${m.id}`, 'data-module': m.id, title: `${m.title}（${k + 1}）` },
    icon(ICONS[m.icon]), h('span', null, m.short), h('span', { class: 'key' }, String(k + 1))));
});
const helpBtn = iconButton({ iconName: 'help', title: '帮助与快捷键（?）', onClick: () => openHelp(), id: 'help-btn' });
const sidebar = h('aside', { class: 'sidebar' },
  h('a', { class: 'brand', href: '#/', title: '数境 MathScape', html: ICONS.brand }),
  nav,
  h('div', { class: 'sidebar-bottom' }, helpBtn));

const titleEl = h('h1', { id: 'module-title' });
const subtitleEl = h('div', { class: 'subtitle', id: 'module-subtitle' });
const actionsEl = h('div', { class: 'actions' });
const moduleActions = h('div', { class: 'actions', style: { marginLeft: 0 } });
const stage = h('div', { class: 'stage', id: 'stage' });
const panel = h('aside', { class: 'panel', id: 'panel', 'aria-label': '控制面板' });
const header = h('header', { class: 'header' }, h('div', { class: 'titles' }, titleEl, subtitleEl), actionsEl);
actionsEl.append(
  moduleActions,
  iconButton({ iconName: 'camera', title: '导出 PNG', id: 'export-btn', onClick: exportPNG }),
  iconButton({ iconName: 'link', title: '复制当前状态链接', id: 'share-btn', onClick: share }),
  iconButton({ iconName: 'expand', title: '全屏', onClick: () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.()) }),
);
root.append(sidebar, h('main', { class: 'main' }, header, stage), panel);

// ---- routing
let current = null; // { def, inst }

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [id, q = ''] = raw.split('?');
  return { id: byId[id] ? id : MODULES[0].id, query: new URLSearchParams(q) };
}

function setQuery(params) {
  if (!current) return;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, v);
  const s = q.toString();
  const hash = `#/${current.def.id}${s ? `?${s}` : ''}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function mount() {
  const { id, query } = parseHash();
  if (current && current.def.id === id) return;
  if (current) {
    try { current.inst.destroy?.(); } catch (e) { console.error(e); }
  }
  stage.textContent = '';
  panel.textContent = '';
  moduleActions.textContent = '';
  panel.scrollTop = 0;
  const def = byId[id];
  titleEl.textContent = def.title;
  subtitleEl.textContent = def.subtitle;
  document.title = `${def.title} · 数境 MathScape`;
  for (const a of nav.querySelectorAll('.nav-item')) a.classList.toggle('active', a.dataset.module === id);
  stage.classList.remove('module-enter');
  void stage.offsetWidth; // restart the entrance animation
  stage.classList.add('module-enter');
  current = { def, inst: null };
  current.inst = def.create({ stage, panel, actions: moduleActions, toast, query, setQuery });
  window.__mathscape.current = current.inst;
  window.__mathscape.module = id;
}

window.__mathscape = { modules: MODULES.map((m) => m.id), current: null, module: null, errors: [] };
window.addEventListener('hashchange', mount);
window.addEventListener('error', (e) => { window.__mathscape.errors.push(String(e.message)); });
window.addEventListener('unhandledrejection', (e) => { window.__mathscape.errors.push(String(e.reason)); });

// ---- header actions
function exportPNG() {
  const canvas = current?.inst?.snapshot?.();
  if (!canvas) { toast('当前视图无法导出'); return; }
  downloadCanvas(canvas, `mathscape-${current.def.id}.png`);
  toast('已导出 PNG');
}

async function share() {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast('链接已复制，打开即可恢复当前状态');
  } catch {
    toast(url, 4000);
  }
}

// ---- help
let modal = null;
function openHelp() {
  if (modal) return;
  const inst = current?.inst;
  const def = current?.def;
  const close = () => { modal?.remove(); modal = null; };
  const tips = inst?.help?.tips || [];
  const keys = [
    ['1 – 4', '切换模块'],
    ['?', '打开 / 关闭帮助'],
    ['滚轮 / 双指', '缩放视图'],
    ['拖动空白处', '平移视图'],
    ...(inst?.help?.keys || []),
  ];
  modal = h('div', { class: 'modal-backdrop', onClick: (e) => { if (e.target === modal) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '帮助' },
      iconButton({ iconName: 'close', title: '关闭', onClick: close, cls: 'close' }),
      h('h2', null, def ? def.title : '数境 MathScape'),
      h('div', { class: 'hint' }, def?.subtitle || ''),
      tips.length ? [h('h3', null, '操作与说明'), h('ul', null, tips.map((t) => h('li', { html: t })))] : null,
      h('h3', null, '快捷键'),
      h('div', { class: 'shortcuts' }, keys.flatMap(([k, d]) => [h('div', null, h('kbd', null, k)), h('div', null, d)])),
      h('h3', null, '关于'),
      h('div', { class: 'hint' }, '数境 MathScape：所有图形都由浏览器实时计算绘制，无任何预渲染素材。数值方法与公式见项目 README。')));
  document.body.append(modal);
}

// ---- keyboard
window.addEventListener('keydown', (e) => {
  const tag = (e.target?.tagName || '').toLowerCase();
  const typing = tag === 'input' && !['range', 'checkbox'].includes(e.target.type) || tag === 'textarea' || tag === 'select';
  if (e.key === 'Escape' && modal) { modal.remove(); modal = null; return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { modal ? (modal.remove(), (modal = null)) : openHelp(); e.preventDefault(); return; }
  if (/^[1-9]$/.test(e.key) && MODULES[+e.key - 1]) { location.hash = `#/${MODULES[+e.key - 1].id}`; return; }
  if (modal) return;
  current?.inst?.onKey?.(e);
});

if (!location.hash) history.replaceState(null, '', `#/${MODULES[0].id}`);
mount();
