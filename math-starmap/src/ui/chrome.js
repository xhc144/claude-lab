// The frame around the sky: top bar with search, legend & filters, zoom buttons, tooltip, toast,
// first-visit intro and the help dialog.

import { el, escapeHtml, rgba } from '../core/util.js';
import { RELATIONS, RELATION_ORDER, KINDS, LEVELS } from '../config.js';
import { renderMath } from '../core/tex.js';
import { ICON, BRAND } from './icons.js';

function highlight(text, q) {
  const k = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (k < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, k))}<mark>${escapeHtml(text.slice(k, k + q.length))}</mark>${escapeHtml(text.slice(k + q.length))}`;
}
const FIELD = { title: '', alias: '别名', pinyin: '拼音', en: '英文', tag: '标签', summary: '摘要', text: '正文' };

export class Topbar {
  constructor(app) {
    this.app = app;
    this.root = el('header', { id: 'top', class: 'glass' });
    const brand = el('button', { class: 'brand', title: '回到全景', onclick: () => app.home() });
    brand.innerHTML = `${BRAND}<span class="brand-text"><span class="brand-name">数学知识星图</span><span class="brand-sub">Math Starmap</span></span>`;
    this.menuBtn = el('button', { class: 'icon-btn', 'aria-label': '打开导航', title: '导航：星系、考纲、航线、进度', html: ICON.menu, onclick: () => app.drawer.toggle() });
    this.input = el('input', { type: 'search', placeholder: '搜索概念、定理、公式……支持拼音与英文', 'aria-label': '搜索知识星', autocomplete: 'off', spellcheck: 'false' });
    this.results = el('div', { class: 'results glass scroll', role: 'listbox' });
    const box = el('div', { class: 'search-box' }, el('span', { html: ICON.search }), this.input, el('span', { class: 'kbd', text: '/' }));
    this.search = el('div', { class: 'search' }, box, this.results);
    this.modeSeg = el('div', { class: 'seg', role: 'group', 'aria-label': '视图' },
      el('button', { 'data-mode': 'map', title: '星图：整个知识宇宙', text: '星图', onclick: () => app.setMode('map') }),
      el('button', { 'data-mode': 'explore', title: '星链：从一颗星无限展开（E）', text: '星链', onclick: () => app.setMode('explore') }));
    this.favBtn = el('button', { class: 'icon-btn hide-s', title: '收藏与最近浏览', 'aria-label': '收藏', html: ICON.star, onclick: () => app.drawer.toggle('favs') });
    this.progBtn = el('button', { class: 'icon-btn hide-s', title: '学习进度', 'aria-label': '学习进度', html: ICON.chart, onclick: () => app.drawer.toggle('progress') });
    this.helpBtn = el('button', { class: 'icon-btn hide-s', title: '帮助与快捷键（?）', 'aria-label': '帮助', html: ICON.help, onclick: () => app.help.open() });
    this.root.append(this.menuBtn, brand, this.search, el('div', { class: 'tools' }, this.modeSeg, this.favBtn, this.progBtn, this.helpBtn));
    this.bindSearch();
    app.store.on('change', () => this.sync());
  }
  sync() {
    for (const b of this.modeSeg.children) b.classList.toggle('on', b.dataset.mode === this.app.mode);
    this.menuBtn.classList.toggle('on', this.app.drawer.isOpen());
    const nf = this.app.store.data.fav.length;
    this.favBtn.innerHTML = ICON.star + (nf ? `<span class="badge">${nf > 99 ? '99+' : nf}</span>` : '');
  }
  focus() { this.input.focus(); this.input.select(); }
  bindSearch() {
    const app = this.app;
    let active = 0, list = [];
    const draw = () => {
      const q = this.input.value.trim();
      this.results.innerHTML = '';
      if (!q) { this.results.classList.remove('open'); app.universe.hits = null; return; }
      list = app.searcher.query(q, 40);
      app.universe.hits = list.length ? new Set(list.map((r) => r.i)) : null;
      if (!list.length) { this.results.append(el('div', { class: 'empty', text: `没有找到「${q}」。换个说法，或用拼音首字母试试。` })); this.results.classList.add('open'); return; }
      this.results.append(el('div', { class: 'hint', text: `${list.length >= 40 ? '40+' : list.length} 个结果 · ↑↓ 选择 · Enter 前往` }));
      list.forEach((r, k) => {
        const n = app.graph.nodes[r.i];
        const b = el('button', { class: `result${k === active ? ' active' : ''}`, role: 'option', style: { color: rgba(n.galaxy.rgb, 1) }, onmousedown: (e) => e.preventDefault(), onclick: () => go(r.i) },
          el('span', { class: 'dot' }),
          el('span', { class: 't', style: { color: 'var(--text)' }, html: highlight(n.t, q) }),
          el('span', { class: 'meta', text: `${FIELD[r.field] ? `${FIELD[r.field]} · ` : ''}${n.galaxy.name} · ${n.ty}` }),
          el('span', { class: 's', html: n.s || '' }));
        this.results.append(b);
      });
      renderMath(this.results);
      this.results.classList.add('open');
    };
    const go = (i) => {
      this.results.classList.remove('open');
      this.input.blur();
      app.universe.hits = null;
      app.select(i, { fly: true, from: 'search' });
    };
    this.input.addEventListener('input', () => { active = 0; draw(); });
    this.input.addEventListener('focus', () => { if (this.input.value.trim()) draw(); });
    this.input.addEventListener('blur', () => setTimeout(() => { this.results.classList.remove('open'); }, 120));
    this.input.addEventListener('keydown', (e) => {
      const items = [...this.results.querySelectorAll('.result')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((b, k) => b.classList.toggle('active', k === active));
        items[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (list[active]) go(list[active].i);
      } else if (e.key === 'Escape') {
        this.input.value = '';
        draw();
        this.input.blur();
      }
    });
  }
}

export class Legend {
  constructor(app) {
    this.app = app;
    this.root = el('div', { id: 'legend', class: 'glass' });
    this.render();
    app.store.on('change', (w) => { if (w && (w.type === 'settings' || w.type === 'reset')) this.render(); });
    try { if (localStorage.getItem('math-starmap:legend') === 'c' || innerWidth < 760) this.root.classList.add('collapsed'); } catch { /* ignore */ }
  }
  render() {
    const app = this.app;
    const s = app.store.data.settings;
    this.root.innerHTML = '';
    const toggle = el('button', { text: this.root.classList.contains('collapsed') ? '展开' : '收起', onclick: () => {
      this.root.classList.toggle('collapsed');
      try { localStorage.setItem('math-starmap:legend', this.root.classList.contains('collapsed') ? 'c' : 'o'); } catch { /* ignore */ }
      this.render();
    } });
    const line = (R) => {
      const dash = R.dash && R.dash.length ? `stroke-dasharray="${R.dash.join(' ')}"` : '';
      const body = R.double ? `<path d="M1 3h24M1 7h24" stroke="${R.color}" stroke-width="1.6"/>` : `<path d="M1 5h22" stroke="${R.color}" stroke-width="2" ${dash}/>${R.arrow ? `<path d="M20 1.5 25 5l-5 3.5z" fill="${R.color}"/>` : ''}`;
      return `<svg width="26" height="10" viewBox="0 0 26 10">${body}</svg>`;
    };
    const rels = el('div', { class: 'lg-rels' }, ...RELATION_ORDER.map((r) => {
      const R = RELATIONS[r];
      return el('button', { class: `lg-rel${s.rels[r] === false ? ' off' : ''}`, title: `${R.desc}（点击显示 / 隐藏）`, 'aria-pressed': String(s.rels[r] !== false), html: `${line(R)}<span>${R.name}</span>`, onclick: () => { app.store.setting(`rels.${r}`, s.rels[r] === false); app.relationsChanged(); } });
    }));
    const kinds = el('div', { class: 'lg-kinds' }, ...Object.values(KINDS).map((k) => el('span', { text: `${k.glyph} ${k.name}` })));
    const levels = el('div', { class: 'lg-levels' }, ...Object.entries(LEVELS).map(([id, L]) => el('button', { class: s.levels[id] === false ? 'off' : '', title: L.desc, 'aria-pressed': String(s.levels[id] !== false), text: L.name, onclick: () => { app.store.setting(`levels.${id}`, s.levels[id] === false); app.relationsChanged(); } })));
    this.root.append(el('div', { class: 'lg-head' }, el('span', { text: '图例 · 筛选' }), toggle), el('div', { class: 'lg-body' }, rels, kinds, levels));
  }
}

export class Tooltip {
  constructor() { this.root = el('div', { id: 'tooltip', class: 'glass', role: 'tooltip' }); this.i = -1; }
  show(app, i, x, y) {
    const n = app.graph.nodes[i];
    if (this.i !== i) {
      this.i = i;
      const st = app.store.status(n.id);
      this.root.innerHTML = `<div class="tt-t" style="color:${rgba(n.galaxy.rgb, 1)}">${escapeHtml(n.t)}</div><div class="tt-m">${escapeHtml(n.galaxy.name)} · ${escapeHtml(n.cluster.name)} · ${escapeHtml(n.ty)}${st === 2 ? ' · 已掌握' : st === 1 ? ' · 学习中' : ''}</div><div class="tt-s">${n.s || ''}</div>`;
      renderMath(this.root);
    }
    const w = this.root.offsetWidth || 260, h = this.root.offsetHeight || 80;
    let left = x + 16, top = y + 16;
    if (left + w > innerWidth - 8) left = x - w - 16;
    if (top + h > innerHeight - 8) top = y - h - 16;
    this.root.style.left = `${Math.max(8, left)}px`;
    this.root.style.top = `${Math.max(8, top)}px`;
    this.root.classList.add('on');
  }
  hide() { this.root.classList.remove('on'); this.i = -1; }
}

export class Toast {
  constructor() { this.root = el('div', { id: 'toast', class: 'glass', role: 'status', 'aria-live': 'polite' }); }
  show(msg) {
    this.root.textContent = msg;
    this.root.classList.add('on');
    clearTimeout(this.t);
    this.t = setTimeout(() => this.root.classList.remove('on'), 2000);
  }
}

export function buildZoom(app) {
  return el('div', { id: 'zoom', class: 'glass' },
    el('button', { class: 'icon-btn', title: '放大', 'aria-label': '放大', html: ICON.plus, onclick: () => app.zoomBy(1.6) }),
    el('button', { class: 'icon-btn', title: '缩小', 'aria-label': '缩小', html: ICON.minus, onclick: () => app.zoomBy(1 / 1.6) }),
    el('button', { class: 'icon-btn', title: '全景 / 适配视图（0）', 'aria-label': '全景', html: ICON.home, onclick: () => app.fit() }),
    el('button', { class: 'icon-btn', title: '随机飞向一颗星（R）', 'aria-label': '随机一颗星', html: ICON.dice, onclick: () => app.randomStar() }));
}

export class Intro {
  constructor(app) {
    this.app = app;
    const G = app.graph;
    const syl = [...G.syllabusIndex.values()];
    this.root = el('div', { id: 'intro', class: 'hide' },
      el('div', { class: 'intro-in' },
        el('div', { class: 'intro-kicker', text: 'Math Starmap · 2027 新领军考纲' }),
        el('h1', { class: 'intro-title', text: '数学知识星图' }),
        el('p', { class: 'intro-sub', text: '每一个定义、定理、方法与例子都是一颗星；前置、推导、推广、等价、应用把它们连成星座。缩放拖动穿行星系，点开一颗星，它会不断展开出新的知识。' }),
        el('div', { class: 'intro-stats' },
          el('div', {}, el('b', { text: G.nodes.length }), el('span', { text: '知识星' })),
          el('div', {}, el('b', { text: G.edges.length }), el('span', { text: '条关系' })),
          el('div', {}, el('b', { text: `${syl.filter((s) => s.nodes.length).length}/${syl.length}` }), el('span', { text: '考纲列项' })),
          el('div', {}, el('b', { text: G.tours.length }), el('span', { text: '条航线' }))),
        el('div', { class: 'intro-actions' },
          el('button', { class: 'btn primary', text: '开始探索', onclick: () => this.close() }),
          el('button', { class: 'btn gold', text: '跟随一条航线', onclick: () => { this.close(); app.drawer.open('routes'); } }),
          el('button', { class: 'btn', text: '从考纲出发', onclick: () => { this.close(); app.drawer.open('syllabus'); } }),
          el('button', { class: 'btn', text: '随机一颗星', onclick: () => { this.close(); app.randomStar(); } })),
        el('div', { class: 'intro-galaxies' }, ...G.galaxies.map((g) => el('span', { style: { color: rgba(g.rgb, 1) } }, el('i'), el('span', { style: { color: 'var(--text-2)' }, text: g.name })))),
        el('div', { class: 'intro-tips' }, ...['拖动 平移', '滚轮 / 双指 缩放', '单击 打开星卡', '双击 星链展开', '/ 搜索', '? 帮助'].map((t) => el('span', { text: t })))));
  }
  open() { this.root.classList.remove('hide'); }
  isOpen() { return !this.root.classList.contains('hide'); }
  close() {
    if (!this.isOpen()) return;
    this.root.classList.add('hide');
    if (!this.app.store.data.introSeen) { this.app.store.data.introSeen = true; this.app.store.save({ type: 'intro' }); }
  }
}

export class Help {
  constructor(app) {
    this.root = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '帮助', onclick: (e) => { if (e.target === this.root) this.close(); } });
    const rows = [
      ['拖动空白处', '平移星图（松手有惯性）'],
      ['滚轮 / 双指捏合', '以指针为中心缩放；越近显示越多星名'],
      ['单击一颗星', '飞过去并打开星卡；它的关系按颜色与线型亮起，光点沿方向流动'],
      ['拖动一颗星', '把它拉开，相连的星被牵动，松手后弹回'],
      ['双击一颗星 / E', '进入星链：从这颗星展开，每点一颗星就继续展开它的邻居'],
      ['星链里的小卫星', '内容 · 证明 · 例题 · 应用 · 动画：点一下跳到星卡相应部分'],
      ['/ 或 Ctrl K', '搜索：标题、别名、拼音（全拼或首字母）、英文、正文'],
      ['Esc', '关闭星卡 / 结束航线 / 清除选择'],
      ['0', '全景（星链里为适配视图）'],
      ['R', '随机飞向一颗星'],
      ['M / L', '标记为已掌握 / 学习中'],
      ['F', '收藏 / 取消收藏'],
    ];
    const tbl = el('table', {}, ...rows.map(([a, b]) => el('tr', {}, el('td', { text: a }), el('td', { text: b }))));
    const rel = el('table', {}, ...RELATION_ORDER.map((r) => el('tr', {}, el('td', { html: `<span style="color:${RELATIONS[r].color}">━━</span> ${RELATIONS[r].name}` }), el('td', { text: RELATIONS[r].desc }))));
    this.root.append(el('div', { class: 'modal-in glass scroll' },
      el('button', { class: 'icon-btn card-close', 'aria-label': '关闭', html: ICON.close, onclick: () => this.close() }),
      el('h2', { text: '怎样使用星图' }), tbl,
      el('h2', { text: '连线的含义', style: { marginTop: '18px' } }), rel,
      el('p', { html: '星的形状表示类型：● 定义　✦ 定理（带衍射光芒）　◆ 方法　○ 例子　⬡ 应用。金色光晕表示已掌握，虚线环表示学习中。层级「高中 / 考纲 / 拓展」可在图例里筛选；“考纲”指清华大学 2027 新领军计划考试大纲明确列出的大学内容。' }),
      el('p', { html: '学习状态、收藏与浏览记录只保存在本机浏览器（localStorage），可在「进度」里导出备份。知识库是纯文本 Markdown，源码与扩充说明见 <a href="https://github.com/xhc144/claude-lab/tree/main/math-starmap" target="_blank" rel="noopener">math-starmap/</a>。' }),
      el('div', { class: 'row' }, el('button', { class: 'btn', text: '再看一次开场', onclick: () => { this.close(); app.intro.open(); } }))));
  }
  open() { this.root.classList.add('on'); }
  close() { this.root.classList.remove('on'); }
  isOpen() { return this.root.classList.contains('on'); }
}
