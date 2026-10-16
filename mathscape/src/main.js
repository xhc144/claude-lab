// App shell: start page, navigation, routing between modules, header actions, settings and help
// dialogs, toasts.

import { h, icon, downloadCanvas } from './ui/dom.js';
import { ICONS } from './ui/icons.js';
import { iconButton } from './ui/controls.js';
import { settings, updateSettings, onSettings, precisionLabel, highPrecision, lastVisit, rememberVisit, DIGIT_CHOICES } from './ui/settings.js';
import { precisionControls } from './ui/prefs.js';
import home from './modules/home.js';
import matrix from './modules/matrix.js';
import complexMap from './modules/complex.js';
import ode from './modules/ode.js';
import threebody from './modules/threebody.js';
import fractal from './modules/fractal.js';
import fourier from './modules/fourier.js';
import chaos from './modules/chaos.js';
import life from './modules/life.js';
import symmetry from './modules/symmetry.js';
import probability from './modules/probability.js';
import waves from './modules/waves.js';

const MODULES = [matrix, complexMap, ode, threebody, fractal, fourier, chaos, life, symmetry, probability, waves];
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
  nav.append(h('a', {
    class: 'nav-item', href: `#/${m.id}`, 'data-module': m.id, title: `${m.title}（${k + 1}）`,
    // clicking the module that is already open keeps its state instead of resetting it
    onClick: (e) => { if (current?.def.id === m.id) e.preventDefault(); },
  },
    icon(ICONS[m.icon]), h('span', null, m.short), h('span', { class: 'key' }, String(k + 1))));
});
const helpBtn = iconButton({ iconName: 'help', title: '帮助与快捷键（?）', onClick: () => openHelp(), id: 'help-btn' });
const settingsBtn = iconButton({ iconName: 'settings', title: '设置：计算精度、开启页面', onClick: () => openSettings(), id: 'settings-btn' });
const brand = h('a', { class: 'brand', href: '#/', title: '开启页面（0）', 'aria-label': '数境 MathScape 开启页面', html: ICONS.brand });
const sidebar = h('aside', { class: 'sidebar' },
  brand,
  nav,
  h('div', { class: 'sidebar-bottom' }, settingsBtn, helpBtn));

const titleEl = h('h1', { id: 'module-title' });
const subtitleEl = h('div', { class: 'subtitle', id: 'module-subtitle' });
const actionsEl = h('div', { class: 'actions' });
const moduleActions = h('div', { class: 'actions', style: { marginLeft: 0 } });
const stage = h('div', { class: 'stage', id: 'stage' });
const panel = h('aside', { class: 'panel', id: 'panel', 'aria-label': '控制面板' });
const precPill = h('button', { type: 'button', class: 'prec-pill', id: 'prec-pill', title: '计算精度（P 切换）', onClick: () => openSettings() },
  h('span', { class: 'dot' }), h('span', { class: 'txt' }));
const header = h('header', { class: 'header' }, h('div', { class: 'titles' }, titleEl, subtitleEl), actionsEl);
actionsEl.append(
  moduleActions,
  precPill,
  iconButton({ iconName: 'camera', title: '导出 PNG', id: 'export-btn', onClick: exportPNG }),
  iconButton({ iconName: 'link', title: '复制当前状态链接', id: 'share-btn', onClick: share }),
  iconButton({ iconName: 'expand', title: '全屏', onClick: () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.()) }),
);
const mainEl = h('main', { class: 'main' }, header, stage);
const homeEl = h('div', { class: 'home', id: 'home' });
root.append(sidebar, mainEl, panel, homeEl);

function paintPrecision() {
  precPill.classList.toggle('hp', highPrecision());
  precPill.querySelector('.txt').textContent = precisionLabel();
}
paintPrecision();

// ---- routing
let current = null; // { def, inst }

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [id, q = ''] = raw.split('?');
  return { id: byId[id] ? id : 'home', query: new URLSearchParams(q) };
}

function setQuery(params) {
  if (!current || current.def.id === 'home') return;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, v);
  const s = q.toString();
  const hash = `#/${current.def.id}${s ? `?${s}` : ''}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  lastHash = location.hash;
  rememberVisit(location.hash);
}

// Hash written by the app itself (replaceState never fires hashchange). Any other hash change —
// a pasted share link, a manual edit, back/forward — remounts the module with the new state,
// even when the module stays the same.
let lastHash = '';
let mounting = false;

function mount(force = false) {
  const { id, query } = parseHash();
  if (!force && current && current.def.id === id && location.hash === lastHash) return;
  mounting = true;
  window.__mathscape.mountedFor = location.hash;
  // ?hp=50 in a link switches high precision on (shared links keep their precision)
  const hp = Number(query.get('hp'));
  if (query.has('hp') && DIGIT_CHOICES.includes(hp) && !(highPrecision() && settings.digits === hp)) {
    updateSettings({ precision: 'high', digits: hp });
    setTimeout(() => toast(`已开启高精度计算（${hp} 位有效数字）`), 50);
  }
  if (current) {
    try { current.inst.destroy?.(); } catch (e) { console.error(e); }
  }
  stage.textContent = '';
  panel.textContent = '';
  moduleActions.textContent = '';
  homeEl.textContent = '';
  panel.scrollTop = 0;
  const atHome = id === 'home';
  root.classList.toggle('at-home', atHome);
  brand.classList.toggle('active', atHome);
  for (const a of nav.querySelectorAll('.nav-item')) a.classList.toggle('active', a.dataset.module === id);
  if (atHome) {
    document.title = '数境 MathScape · 交互式数学可视化';
    current = { def: home, inst: null };
    homeEl.scrollTop = 0;
    current.inst = home.create({ root: homeEl, modules: MODULES, toast, openSettings });
  } else {
    const def = byId[id];
    titleEl.textContent = def.title;
    subtitleEl.textContent = def.subtitle;
    document.title = `${def.title} · 数境 MathScape`;
    stage.classList.remove('module-enter');
    void stage.offsetWidth; // restart the entrance animation
    stage.classList.add('module-enter');
    current = { def, inst: null };
    current.inst = def.create({ stage, panel, actions: moduleActions, toast, query, setQuery });
    rememberVisit(location.hash);
  }
  window.__mathscape.current = current.inst;
  window.__mathscape.module = id;
  lastHash = location.hash; // create() may already have rewritten it via setQuery
  mounting = false;
}

window.__mathscape = {
  modules: MODULES.map((m) => m.id),
  current: null,
  module: null,
  errors: [],
  settings,
  setSettings: (patch) => updateSettings(patch),
};
window.addEventListener('hashchange', () => mount());
window.addEventListener('error', (e) => { window.__mathscape.errors.push(String(e.message)); });
window.addEventListener('unhandledrejection', (e) => { window.__mathscape.errors.push(String(e.reason)); });

// Precision changes apply at once: a module that can update itself in place does so, the others
// are re-created from their URL state (which holds everything worth keeping).
onSettings((s, changed) => {
  paintPrecision();
  if (mounting || !current || !changed.some((k) => k === 'precision' || k === 'digits')) return;
  if (current.inst?.onSettings) current.inst.onSettings(s, changed);
  else if (current.def.id !== 'home') mount(true);
});

// ---- header actions
function exportPNG() {
  const canvas = current?.inst?.snapshot?.();
  if (!canvas) { toast('当前视图无法导出'); return; }
  downloadCanvas(canvas, `mathscape-${current.def.id}.png`);
  toast('已导出 PNG');
}

async function share() {
  let url = location.href;
  // the recipient sees the same precision
  if (highPrecision() && !/[?&]hp=/.test(url)) url += `${url.includes('?') ? '&' : '?'}hp=${settings.digits}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('链接已复制，打开即可恢复当前状态');
  } catch {
    toast(url, 4000);
  }
}

// ---- dialogs
let modal = null;
function closeModal() {
  modal?.cleanup?.();
  modal?.remove();
  modal = null;
}

function openModal(label, ...content) {
  if (modal) closeModal();
  modal = h('div', { class: 'modal-backdrop', onClick: (e) => { if (e.target === modal) closeModal(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
      iconButton({ iconName: 'close', title: '关闭', onClick: closeModal, cls: 'close' }),
      content));
  document.body.append(modal);
  modal.querySelector('.close')?.focus();
  return modal;
}

function openHelp() {
  const inst = current?.inst;
  const def = current?.def;
  const tips = inst?.help?.tips || [];
  const keys = [
    ['0', '开启页面'],
    [`1 – ${MODULES.length}`, '切换模块'],
    ['P', '切换双精度 / 高精度'],
    ['?', '打开 / 关闭帮助'],
    ['滚轮 / 双指', '缩放视图'],
    ['拖动空白处', '平移视图'],
    ...(inst?.help?.keys || []),
  ];
  openModal('帮助',
    h('h2', null, def && def.id !== 'home' ? def.title : '数境 MathScape'),
    h('div', { class: 'hint' }, def?.subtitle || ''),
    tips.length ? [h('h3', null, '操作与说明'), h('ul', null, tips.map((t) => h('li', { html: t })))] : null,
    h('h3', null, '快捷键'),
    h('div', { class: 'shortcuts' }, keys.flatMap(([k, d]) => [h('div', null, h('kbd', null, k)), h('div', null, d)])),
    h('h3', null, '关于'),
    h('div', { class: 'hint' }, '数境 MathScape：所有图形都由浏览器实时计算绘制，无任何预渲染素材。数值方法与公式见项目 README。'));
}

function openSettings() {
  const ctl = precisionControls({ idPrefix: 'settings', showStart: true });
  const m = openModal('设置',
    h('h2', null, '设置'),
    h('div', { class: 'hint' }, '设置保存在本机浏览器中。'),
    h('h3', null, '计算精度'),
    ctl.el,
    h('ul', { class: 'prec-effects' },
      h('li', { html: '<b>矩阵</b>：有理数元素按分数精确运算；特征值、特征向量、奇异值与条件数给出根式；小数展开到所选位数；A<sup>n</sup> 精确幂；并与双精度结果对比误差。' }),
      h('li', { html: '<b>复变</b>：探针读数显示 12 位有效数字，幅角原理沿围道加密采样。' }),
      h('li', { html: '<b>微分方程</b>：轨线与分界线的自适应积分容差从 10<sup>−8</sup> 收紧到 10<sup>−12</sup>。' }),
      h('li', { html: '<b>三体</b>：默认误差容限从 10<sup>−10</sup> 收紧到 10<sup>−13</sup>，守恒量显示更多位数。' })),
    h('div', { class: 'hint' }, '快捷键 P 可随时切换；带 ?hp=50 的链接会为打开它的人开启高精度。'));
  m.cleanup = ctl.destroy;
}

// ---- keyboard
window.addEventListener('keydown', (e) => {
  const tag = (e.target?.tagName || '').toLowerCase();
  const typing = tag === 'input' && !['range', 'checkbox'].includes(e.target.type) || tag === 'textarea' || tag === 'select';
  if (e.key === 'Escape' && modal) { closeModal(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { modal ? closeModal() : openHelp(); e.preventDefault(); return; }
  if (e.key === '0') { location.hash = '#/'; return; }
  if (/^[1-9]$/.test(e.key) && MODULES[+e.key - 1]) { location.hash = `#/${MODULES[+e.key - 1].id}`; return; }
  if (e.key === 'p' || e.key === 'P') {
    updateSettings({ precision: highPrecision() ? 'standard' : 'high' });
    toast(highPrecision() ? `已开启高精度（${settings.digits} 位）` : '已切换回双精度');
    return;
  }
  if (modal) return;
  current?.inst?.onKey?.(e);
});

if (!location.hash) {
  const last = lastVisit();
  history.replaceState(null, '', settings.startPage || !last ? '#/' : last.hash);
}
mount();
