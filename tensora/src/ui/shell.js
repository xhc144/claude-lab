// The console frame: floating navigation rail, command deck, mobile tab bar and "more" sheet,
// the ⌘K command palette, notifications drawer and the account / workspace menus.

import { icon } from './icons.js';
import { openLayer, openMenu, toast } from './overlay.js';
import { state, bus, setPref, unreadCount } from '../core/state.js';
import { live } from '../core/live.js';
import { MODELS, NODES } from '../core/data.js';
import { esc, fmt, $ } from '../core/util.js';

export const NAV = [
  { group: '', domain: 'core', items: [{ id: 'overview', label: '总览', icon: 'overview', key: 'o' }] },
  { group: 'API 网关', domain: 'gateway', items: [
    { id: 'models', label: '模型广场', icon: 'models', key: 'm' },
    { id: 'keys', label: 'API 密钥', icon: 'key', key: 'k' },
    { id: 'usage', label: '调用统计', icon: 'usage', key: 'u' },
    { id: 'tokens', label: 'Token 消耗', icon: 'tokens', key: 't' },
  ] },
  { group: '训练平台', domain: 'train', items: [
    { id: 'training', label: '模型训练', icon: 'training', key: 'n' },
    { id: 'jobs', label: '训练任务', icon: 'jobs', key: 'j' },
  ] },
  { group: '算力', domain: 'compute', items: [{ id: 'cluster', label: 'GPU 集群', icon: 'cluster', key: 'c' }] },
  { group: '账户', domain: 'billing', items: [
    { id: 'billing', label: '费用分析', icon: 'billing', key: 'b' },
    { id: 'settings', label: '设置', icon: 'settings', key: 's' },
  ] },
];
export const NAV_ITEMS = NAV.flatMap((g) => g.items.map((it) => ({ ...it, domain: g.domain, group: g.group || '总览' })));
export const DOMAIN_LABEL = { core: '指挥中心', gateway: 'API 网关', train: '训练平台', compute: '算力', billing: '账户' };

const LOGO = (id) => `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--acc-a)"/><stop offset="1" stop-color="var(--acc-b)"/></linearGradient></defs>
  <g class="logo-orbit"><ellipse cx="20" cy="20" rx="17" ry="7" fill="none" stroke="url(#${id})" stroke-width="1.4" opacity=".55" transform="rotate(-28 20 20)"/></g>
  <path d="M20 5.5 32.5 12.75v14.5L20 34.5 7.5 27.25v-14.5z" fill="none" stroke="url(#${id})" stroke-width="2"/>
  <path d="M20 12v16M13.1 16l13.8 8M26.9 16l-13.8 8" stroke="url(#${id})" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="20" cy="20" r="3.2" fill="url(#${id})"/>
</svg>`;

export function renderShell(app) {
  app.innerHTML = `
  <canvas id="aurora" aria-hidden="true"></canvas>
  <div class="grain" aria-hidden="true"></div>
  <div class="shell" id="shell">
    <aside class="rail" aria-label="主导航">
      <a class="brand" href="#/overview" aria-label="Tensora 星枢 首页">${LOGO('lg-rail')}<span class="wm"><b>Tensora</b><small>星枢 · AI Infra</small></span></a>
      <nav class="nav" id="nav">
        ${NAV.map((g) => `<div class="ng" data-domain="${g.domain}">
          ${g.group ? `<span class="ng-l">${g.group}</span>` : ''}
          ${g.items.map((it) => `<a class="ni" href="#/${it.id}" data-route="${it.id}" data-tip="${it.label}">${icon(it.icon)}<span class="ni-l">${it.label}</span><em class="ni-b" data-badge="${it.id}" hidden></em></a>`).join('')}
        </div>`).join('')}
      </nav>
      <div class="rail-foot">
        <button class="health" id="rail-health" type="button" data-tip="GPU 集群">
          <span class="h-ring" id="health-ring"></span>
          <span class="h-t"><b id="health-online">—</b><small>GPU 在线</small></span>
        </button>
        <button class="ni rail-toggle" id="rail-toggle" type="button" aria-label="收起或展开导航" data-tip="展开导航">${icon('left')}<span class="ni-l">收起导航</span></button>
      </div>
    </aside>

    <div class="stage">
      <header class="deck" id="deck">
        <a class="m-brand" href="#/overview" aria-label="首页">${LOGO('lg-deck')}</a>
        <div class="m-title"><span class="eyebrow" id="m-eyebrow"></span><b id="m-title"></b></div>
        <button class="search" id="open-palette" type="button">${icon('search')}<span>搜索模型、任务、密钥、节点…</span><kbd id="kbd-hint">⌘K</kbd></button>
        <div class="deck-r">
          <button class="ws" id="ws-btn" type="button" aria-haspopup="menu"><i class="ws-dot"></i><span id="ws-name">${state.workspace}</span>${icon('down')}</button>
          <button class="live-btn on" id="live-btn" type="button" aria-pressed="true"><i class="live-dot"></i><span>实时</span></button>
          <button class="icon-btn m-search" id="m-search" type="button" aria-label="搜索">${icon('search')}</button>
          <button class="icon-btn bell" id="notif-btn" type="button" aria-label="通知">${icon('bell')}<em class="badge" id="notif-badge" hidden></em></button>
          <button class="avatar" id="user-btn" type="button" aria-haspopup="menu" aria-label="账户菜单">${state.user.initials}</button>
        </div>
      </header>
      <p class="demo-notice" role="note">演示环境 · 所有数据均为模拟；不会调用真实模型、执行训练、产生交易或发送邮件。</p>
      <main id="view" class="view" tabindex="-1"></main>
    </div>

    <nav class="tabbar" aria-label="快捷导航">
      ${['overview', 'models', 'jobs', 'cluster'].map((id) => { const it = NAV_ITEMS.find((x) => x.id === id); return `<a href="#/${id}" data-route="${id}">${icon(it.icon)}<span>${it.label}</span></a>`; }).join('')}
      <button type="button" id="more-btn">${icon('grid')}<span>更多</span></button>
    </nav>
  </div>`;

  const shell = $('#shell');
  shell.dataset.rail = state.prefs.rail;
  if (!/Mac|iPhone|iPad/.test(navigator.platform || '')) $('#kbd-hint').textContent = 'Ctrl K';

  $('#rail-toggle').addEventListener('click', () => {
    const next = shell.dataset.rail === 'wide' ? 'slim' : 'wide';
    shell.dataset.rail = next;
    setPref('rail', next);
  });
  $('#rail-health').addEventListener('click', () => { location.hash = '/cluster'; });
  $('#open-palette').addEventListener('click', openPalette);
  $('#m-search').addEventListener('click', openPalette);
  $('#notif-btn').addEventListener('click', openNotifications);
  $('#more-btn').addEventListener('click', openMoreSheet);
  $('#live-btn').addEventListener('click', () => live.setRunning(!live.running));
  $('#ws-btn').addEventListener('click', (e) => openWorkspaceMenu(e.currentTarget));
  $('#user-btn').addEventListener('click', (e) => openUserMenu(e.currentTarget));

  bus.on('live', (on) => {
    const b = $('#live-btn');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
    b.querySelector('span').textContent = on ? '实时' : '已暂停';
    toast({ kind: on ? 'good' : 'info', title: on ? '实时数据已恢复' : '实时数据已暂停', body: on ? '图表与遥测重新开始滚动' : '画面停留在当前时刻，便于对比分析', timeout: 2600 });
  });
  bus.on('notifications', updateBadges);
  bus.on('jobs', updateBadges);
  bus.on('tick', () => {
    const g = live.gpu;
    $('#health-online').textContent = `${g.online}/${g.total}`;
    $('#health-ring').style.setProperty('--p', (g.util / 100).toFixed(3));
  });
  updateBadges();
  bindShortcuts();
}

export function updateBadges() {
  const n = unreadCount();
  const b = $('#notif-badge');
  b.hidden = n === 0;
  b.textContent = n;
  const running = state.jobs.filter((j) => j.status === 'running').length;
  const jb = document.querySelector('[data-badge="jobs"]');
  if (jb) { jb.hidden = running === 0; jb.textContent = running; }
}

export function setActiveNav(id) {
  const item = NAV_ITEMS.find((x) => x.id === id);
  document.querySelectorAll('[data-route]').forEach((a) => {
    const on = a.dataset.route === id;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const more = $('#more-btn');
  more?.classList.toggle('on', !['overview', 'models', 'jobs', 'cluster'].includes(id));
  $('#m-eyebrow').textContent = DOMAIN_LABEL[item?.domain] || '';
  $('#m-title').textContent = item?.label || '';
  document.title = `${item?.label || '总览'} · Tensora 星枢`;
}

// ---- command palette ----------------------------------------------------------------------------

function paletteItems() {
  const items = [];
  for (const it of NAV_ITEMS) items.push({ group: '页面', label: it.label, hint: `G ${it.key.toUpperCase()}`, icon: it.icon, go: it.id, words: it.label + it.id });
  items.push({ group: '操作', label: '创建 API 密钥', icon: 'plus', go: 'keys/new', words: 'create key 新建 密钥' });
  items.push({ group: '操作', label: '新建训练任务', icon: 'training', go: 'training', words: 'new job fine-tune 微调 训练' });
  items.push({ group: '操作', label: live.running ? '暂停实时数据' : '恢复实时数据', icon: live.running ? 'pause' : 'play', run: () => live.setRunning(!live.running), words: 'live pause 实时' });
  items.push({ group: '操作', label: '打开通知中心', icon: 'bell', run: openNotifications, words: 'notification 通知' });
  items.push({ group: '操作', label: '充值账户余额', icon: 'wallet', go: 'billing/topup', words: 'recharge 充值 余额 billing' });
  items.push({ group: '操作', label: '查看快捷键', icon: 'command', run: showShortcuts, words: 'shortcut keyboard 快捷键' });
  for (const m of MODELS) items.push({ group: '模型', label: m.name, sub: m.tags.slice(0, 2).join(' · '), icon: 'models', go: `models/${m.id}`, words: m.name + m.id + m.tags.join('') });
  for (const j of state.jobs) items.push({ group: '训练任务', label: j.name, sub: j.id, icon: 'jobs', go: `jobs/${j.id}`, words: j.name + j.id });
  for (const k of state.keys) items.push({ group: 'API 密钥', label: k.name, sub: `sk-tsr-…${k.tail}`, icon: 'key', go: `keys/${k.id}`, words: k.name + k.tail });
  for (const n of NODES) items.push({ group: 'GPU 节点', label: n.id, sub: `${n.gpus.length} × GPU`, icon: 'server', go: `cluster/${n.id}`, words: n.id });
  return items;
}

function score(q, text) {
  if (!q) return 1;
  text = text.toLowerCase();
  if (text.includes(q)) return 10 - text.indexOf(q) / 100;
  let i = 0;
  for (const ch of text) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
}

export function openPalette() {
  const all = paletteItems();
  let sel = 0, shown = [];
  openLayer({
    kind: 'modal', cls: 'palette', title: '命令面板',
    body: `<div class="pal-in">${icon('search')}<input id="pal-q" placeholder="输入页面、模型、任务、密钥或操作…" autocomplete="off" spellcheck="false" aria-label="搜索" autofocus><kbd>Esc</kbd></div><div class="pal-list" id="pal-list" role="listbox"></div>
      <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>G</kbd> + 字母 快速跳转</span></div>`,
    onMount(panel, close) {
      const input = panel.querySelector('#pal-q');
      const list = panel.querySelector('#pal-list');
      const draw = () => {
        const q = input.value.trim().toLowerCase();
        shown = all.map((it) => ({ it, s: score(q, it.words + it.label) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, q ? 24 : 14).map((x) => x.it);
        if (!q) shown = all.filter((x) => x.group === '页面' || x.group === '操作').slice(0, 16);
        sel = Math.min(sel, Math.max(0, shown.length - 1));
        let lastGroup = '';
        list.innerHTML = shown.length ? shown.map((it, i) => {
          const head = it.group !== lastGroup ? `<div class="pal-g">${it.group}</div>` : '';
          lastGroup = it.group;
          return `${head}<button type="button" class="pal-i${i === sel ? ' on' : ''}" data-i="${i}" role="option" aria-selected="${i === sel}">${icon(it.icon)}<span class="pl">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.hint ? `<kbd>${it.hint}</kbd>` : icon('right', 'go')}</button>`;
        }).join('') : `<div class="pal-empty">没有匹配「${esc(input.value)}」的结果。试试模型名、任务 ID 或节点名。</div>`;
        list.querySelector('.pal-i.on')?.scrollIntoView({ block: 'nearest' });
      };
      const run = (i) => {
        const it = shown[i];
        if (!it) return;
        close();
        if (it.go) location.hash = '/' + it.go;
        else it.run?.();
      };
      input.addEventListener('input', () => { sel = 0; draw(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % shown.length; draw(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; draw(); }
        else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      });
      list.addEventListener('click', (e) => { const b = e.target.closest('.pal-i'); if (b) run(+b.dataset.i); });
      list.addEventListener('pointermove', (e) => {
        const b = e.target.closest('.pal-i');
        if (b && +b.dataset.i !== sel) { sel = +b.dataset.i; list.querySelectorAll('.pal-i').forEach((x) => x.classList.toggle('on', x === b)); }
      });
      draw();
    },
  });
}

// ---- notifications ----------------------------------------------------------------------------------

const LVL_ICON = { good: 'ok', warn: 'alert', crit: 'fail', info: 'info' };
export function openNotifications() {
  let filter = 'all';
  openLayer({
    kind: 'drawer', title: '通知中心', eyebrow: '事件与告警',
    body: `<div class="nt-bar"><div class="tabs" id="nt-tabs"><button type="button" class="on" data-f="all">全部</button><button type="button" data-f="unread">未读</button><button type="button" data-f="crit">严重</button></div><button class="btn xs ghost" id="nt-read" type="button">${icon('check')}全部标为已读</button></div><div class="nt-list" id="nt-list"></div>`,
    onMount(panel, close) {
      const list = panel.querySelector('#nt-list');
      const draw = () => {
        const items = state.notifications.filter((n) => filter === 'all' || (filter === 'unread' ? !n.read : n.level === 'crit'));
        list.innerHTML = items.length ? items.map((n) => `<button type="button" class="nt l-${n.level}${n.read ? '' : ' unread'}" data-id="${n.id}">
            <span class="nt-ic">${icon(LVL_ICON[n.level])}</span>
            <span class="nt-b"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${fmt.rel(n.at)}</small></span>
          </button>`).join('') : `<div class="empty">${icon('bell')}<b>这里很安静</b><span>${filter === 'unread' ? '所有通知都已读。' : '没有符合条件的通知。'}</span></div>`;
      };
      panel.querySelector('#nt-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-f]');
        if (!b) return;
        filter = b.dataset.f;
        panel.querySelectorAll('#nt-tabs button').forEach((x) => x.classList.toggle('on', x === b));
        draw();
      });
      panel.querySelector('#nt-read').addEventListener('click', () => {
        state.notifications.forEach((n) => { n.read = true; });
        bus.emit('notifications');
        draw();
        toast({ kind: 'good', title: '已全部标为已读', timeout: 2000 });
      });
      list.addEventListener('click', (e) => {
        const b = e.target.closest('.nt');
        if (!b) return;
        const n = state.notifications.find((x) => x.id === b.dataset.id);
        n.read = true;
        bus.emit('notifications');
        close();
        if (n.link) location.hash = '/' + n.link;
      });
      const off = bus.on('notifications', draw);
      draw();
      return off;
    },
  });
}

// ---- menus / sheets ----------------------------------------------------------------------------

function openMoreSheet() {
  openLayer({
    kind: 'drawer', title: '全部功能', eyebrow: 'Tensora 星枢',
    body: `<div class="more-grid">${NAV.map((g) => g.items.map((it) => `<a href="#/${it.id}" class="more-i" data-route="${it.id}">${icon(it.icon)}<span>${it.label}</span><small>${DOMAIN_LABEL[g.domain]}</small></a>`).join('')).join('')}</div>`,
    onMount(panel, close) { panel.addEventListener('click', (e) => { if (e.target.closest('a')) close(); }); },
  });
}

function openWorkspaceMenu(anchor) {
  const spaces = ['生产环境', '预发环境', '研究沙盒'];
  openMenu(anchor, spaces.map((s) => ({
    label: s, icon: s === '生产环境' ? 'shield' : s === '预发环境' ? 'branch' : 'sparkle', checked: s === state.workspace,
    fn: () => {
      if (s === state.workspace) return;
      state.workspace = s;
      $('#ws-name').textContent = s;
      document.getElementById('ws-btn').dataset.ws = spaces.indexOf(s);
      toast({ kind: 'info', title: `已切换到「${s}」`, body: '演示环境中所有工作区共享同一套模拟数据' });
    },
  })), { align: 'end' });
}

function openUserMenu(anchor) {
  openMenu(anchor, [
    { label: `${state.user.name} · ${state.user.role}`, icon: 'user', fn: () => { location.hash = '/settings'; } },
    { sep: true },
    { label: '外观与偏好', icon: 'settings', fn: () => { location.hash = '/settings'; } },
    { label: '键盘快捷键', icon: 'command', hint: '?', fn: showShortcuts },
    { label: '费用与发票', icon: 'billing', fn: () => { location.hash = '/billing'; } },
    { sep: true },
    { label: '退出登录', icon: 'logout', danger: true, fn: () => toast({ kind: 'info', title: '这是演示环境', body: '没有真实账户会话，所以无需退出。' }) },
  ]);
}

export function showShortcuts() {
  const rows = [
    ['⌘ K / Ctrl K', '打开命令面板'], ['/', '打开命令面板'], ['G 然后 O', '总览'], ['G 然后 M', '模型广场'], ['G 然后 K', 'API 密钥'],
    ['G 然后 U', '调用统计'], ['G 然后 T', 'Token 消耗'], ['G 然后 N', '模型训练'], ['G 然后 J', '训练任务'], ['G 然后 C', 'GPU 集群'],
    ['G 然后 B', '费用分析'], ['G 然后 S', '设置'], ['L', '暂停 / 恢复实时数据'], ['?', '显示本帮助'], ['← →', '在聚焦的图表上移动读数'],
  ];
  openLayer({
    kind: 'modal', title: '键盘快捷键', eyebrow: '效率',
    body: `<div class="kbd-grid">${rows.map(([k, v]) => `<div class="kr"><span>${v}</span><span>${k.split(' ').map((x) => (x === '然后' || x === '/' && k.length > 1 ? `<small>${x}</small>` : `<kbd>${x}</kbd>`)).join('')}</span></div>`).join('')}</div>`,
  });
}

function bindShortcuts() {
  let gArmed = 0;
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!document.querySelector('.palette')) openPalette(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.layer')) return;
    if (e.key === '/') { e.preventDefault(); openPalette(); return; }
    if (e.key === '?') { showShortcuts(); return; }
    if (e.key === 'l' || e.key === 'L') { live.setRunning(!live.running); return; }
    if (e.key === 'g' || e.key === 'G') { gArmed = Date.now(); return; }
    if (gArmed && Date.now() - gArmed < 1200) {
      const it = NAV_ITEMS.find((x) => x.key === e.key.toLowerCase());
      gArmed = 0;
      if (it) location.hash = '/' + it.id;
    }
  });
}
