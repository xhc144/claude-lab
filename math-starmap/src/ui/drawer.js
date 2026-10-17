// Navigation drawer: 星系 / 考纲 / 航线 / 路径 / 动画 / 收藏 / 进度.

import { el, escapeHtml, rgba } from '../core/util.js';
import { RELATIONS } from '../config.js';
import { ANIMATIONS } from '../anim/registry.js';
import { renderMath } from '../core/tex.js';
import { ICON } from './icons.js';

const TABS = [['galaxies', '星系'], ['syllabus', '考纲'], ['routes', '航线'], ['path', '路径'], ['anims', '动画'], ['favs', '收藏'], ['progress', '进度']];

export class Drawer {
  constructor(app) {
    this.app = app;
    this.tab = 'galaxies';
    this.root = el('nav', { id: 'drawer', class: 'glass', 'aria-label': '导航' });
    this.tabsEl = el('div', { class: 'tabs', role: 'tablist' });
    this.panes = {};
    for (const [id, label] of TABS) {
      this.tabsEl.append(el('button', { class: 'tab', role: 'tab', 'data-tab': id, text: label, onclick: () => this.show(id) }));
      this.panes[id] = el('div', { class: 'pane scroll', role: 'tabpanel', 'data-pane': id });
    }
    this.root.append(this.tabsEl, ...Object.values(this.panes));
    this.route = { from: -1, to: -1 };
    this.learn = { target: -1, skip: true };
    app.store.on('change', (w) => { if (this.isOpen() && w && ['progress', 'fav', 'import', 'reset', 'history'].includes(w.type)) this.render(); });
  }
  isOpen() { return this.root.classList.contains('open'); }
  open(tab) { if (tab) this.tab = tab; this.root.classList.add('open'); this.app.root.classList.add('drawer-open'); this.render(); this.app.topbar?.sync(); }
  close() { this.root.classList.remove('open'); this.app.root.classList.remove('drawer-open'); this.app.topbar?.sync(); }
  toggle(tab) { if (this.isOpen() && (!tab || tab === this.tab)) this.close(); else this.open(tab); }
  show(tab) { this.tab = tab; this.render(); }

  render() {
    for (const b of this.tabsEl.children) { const on = b.dataset.tab === this.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
    for (const [id, p] of Object.entries(this.panes)) p.classList.toggle('on', id === this.tab);
    const pane = this.panes[this.tab];
    pane.innerHTML = '';
    this[`render_${this.tab}`](pane);
    renderMath(pane);
  }

  nodeItem(i, meta) {
    const n = this.app.graph.nodes[i];
    return el('button', { class: 'list-item', style: { color: rgba(n.galaxy.rgb, 1) }, onclick: () => this.app.select(i, { fly: true }) },
      el('span', { class: 'dot' }), el('span', { class: 't', style: { color: 'var(--text)' }, text: n.t }), el('span', { class: 'meta', text: meta ?? `${n.galaxy.name} · ${n.ty}` }));
  }
  nodeChip(i) {
    const n = this.app.graph.nodes[i];
    return el('button', { class: `chip${this.app.store.status(n.id) === 2 ? ' mastered' : ''}`, style: { '--gc': rgba(n.galaxy.rgb, 1) }, title: n.t, onclick: () => this.app.select(i, { fly: true }) }, el('span', { class: 'd', style: { color: rgba(n.galaxy.rgb, 1) } }), n.t);
  }

  render_galaxies(p) {
    const app = this.app;
    const { per } = app.graph.stats((id) => app.store.status(id));
    p.append(el('p', { class: 'note', text: `${app.graph.nodes.length} 颗知识星分布在 7 个星系。星系内由核心向外，从基础主题排到进阶与拓展主题；点星系名飞过去，点星团名看它的星群。` }));
    app.graph.galaxies.forEach((G, gi) => {
      const st = per[gi];
      const clusters = app.graph.clusters.filter((c) => c.g === gi && c.members.length).sort((a, b) => a.order - b.order);
      p.append(el('div', { class: 'gal', style: { '--gc': rgba(G.rgb, 1) } },
        el('button', { class: 'gal-head', onclick: () => app.flyGalaxy(gi) },
          el('span', { class: 'gal-orb' }),
          el('span', {}, el('div', { class: 'gal-name', text: G.name }), el('div', { class: 'gal-en', text: G.en })),
          el('span', { class: 'gal-count', html: `${st.total} 颗星<br>${st.mastered ? `已掌握 ${st.mastered}` : ''}` })),
        el('p', { text: G.desc }),
        el('div', { class: 'bar' }, el('i', { class: 'm', style: { width: `${(st.mastered / st.total) * 100}%` } }), el('i', { class: 'l', style: { width: `${(st.learning / st.total) * 100}%` } })),
        el('div', { class: 'clusters' }, ...clusters.map((c) => el('button', { class: 'chip', style: { '--gc': rgba(G.rgb, 1) }, onclick: () => app.flyCluster(c.index) }, c.name, el('span', { class: 'n', text: c.members.length }))))));
    });
  }

  render_syllabus(p) {
    const app = this.app;
    const S = app.graph.syllabus;
    let total = 0, covered = 0;
    for (const it of app.graph.syllabusIndex.values()) { total++; if (it.nodes.length) covered++; }
    p.append(el('p', { class: 'note', html: `${escapeHtml(S.title)}，${escapeHtml(S.published)} 发布。下面按原文列出每组的官方表述，并把每个列项链接到对应的知识星（${covered}/${total} 项已覆盖）。${escapeHtml(S.note)}` }));
    let subject = '';
    for (const g of S.groups) {
      if (g.subject !== subject) { subject = g.subject; p.append(el('h3', { text: subject })); }
      const items = g.items.map((it) => app.graph.syllabusIndex.get(it.id));
      const nodes = new Set(items.flatMap((it) => it.nodes));
      const mastered = [...nodes].filter((i) => app.store.status(app.graph.nodes[i].id) === 2).length;
      const det = el('details', { class: 'syl-group' },
        el('summary', {}, el('span', { class: 'syl-code', text: g.code }), el('span', { class: 'syl-name', text: g.name }), el('span', { class: 'syl-cov', text: `${nodes.size} 星${mastered ? ` · 掌握 ${mastered}` : ''}` })),
        el('div', { class: 'syl-word', text: `“${g.wording}”（考纲第 ${g.page} 页）` }));
      if (g.code === 'P') det.append(el('div', { class: 'syl-word', text: S.physicsPolicy }));
      for (const it of items) {
        const done = it.nodes.filter((i) => app.store.status(app.graph.nodes[i].id) === 2).length;
        det.append(el('div', { class: 'syl-item' },
          el('div', { class: 'syl-item-name' }, el('span', { text: it.name }), el('span', { class: 'pct', text: it.nodes.length ? `${done}/${it.nodes.length}` : '—' })),
          el('div', { class: 'chips' }, ...it.nodes.slice(0, 24).map((i) => this.nodeChip(i)))));
      }
      p.append(det);
    }
  }

  // route planner + curated tours
  openRoute(from) {
    this.route.from = from;
    this.route.to = -1;
    this.open('routes');
    setTimeout(() => this.panes.routes.querySelector('input[data-role="to"]')?.focus(), 60);
  }
  render_routes(p) {
    const app = this.app;
    p.append(el('h3', { text: '规划航线' }), el('p', { class: 'note', text: '选两颗星，找出连接它们的最短关系链：前置、推导、推广、等价、应用……每一步都是一条真实的知识关系。' }));
    const form = el('div', { class: 'route-form' });
    const field = (label, role) => {
      const cur = this.route[role];
      const input = el('input', { type: 'search', placeholder: '搜索一颗星', 'data-role': role, value: cur >= 0 ? app.graph.nodes[cur].t : '' });
      const res = el('div', { class: 'mini-results glass' });
      app.attachMiniSearch(input, res, (i) => { this.route[role] = i; this.render(); if (this.route.from >= 0 && this.route.to >= 0) this.runRoute(); });
      return el('div', { class: 'field' }, el('label', { text: label }), input, res);
    };
    form.append(field('起点', 'from'), field('终点', 'to'));
    const row = el('div', { class: 'row' },
      el('button', { class: 'btn primary sm', disabled: !(this.route.from >= 0 && this.route.to >= 0), html: `${ICON.route}<span>计算航线</span>`, onclick: () => this.runRoute() }),
      el('button', { class: 'btn sm', html: '<span>随机两颗星</span>', onclick: () => { const N = app.graph.nodes.length; this.route.from = Math.floor(Math.random() * N); this.route.to = Math.floor(Math.random() * N); this.runRoute(); } }),
      app.universe.path ? el('button', { class: 'btn sm', text: '清除航线', onclick: () => app.clearPath() }) : '');
    p.append(form, row);
    if (this.routeResult) p.append(this.routeResult);
    p.append(el('h3', { text: '精选航线' }), el('p', { class: 'note', text: '带解说的知识之旅：镜头沿着星星依次飞行，每一站讲清它为什么连到下一站。' }));
    for (const t of app.graph.tours) {
      p.append(el('button', { class: 'tour-card', onclick: () => app.tour.start(t.id) },
        el('b', { text: t.title }), el('span', { text: t.desc }),
        el('div', { class: 'dots' }, ...t.steps.slice(0, 24).map((s) => el('i', { style: { background: rgba(app.graph.nodes[s.i].galaxy.rgb, 1) } })))));
    }
  }
  runRoute() {
    const app = this.app;
    const { from, to } = this.route;
    if (from < 0 || to < 0) return;
    const r = app.graph.route(from, to);
    const box = el('div', {});
    if (!r) { box.append(el('p', { class: 'empty-note', text: '这两颗星之间还没有关系链。' })); this.routeResult = box; this.render(); return; }
    const ol = el('ol', { class: 'path-steps' });
    r.nodes.forEach((i, k) => {
      const n = app.graph.nodes[i];
      const step = r.steps[k - 1];
      let tag = '';
      if (step) {
        const R = RELATIONS[step.edge.type];
        const label = step.edge.type === 'eq' || step.edge.type === 'rel' ? R.name : step.dir === 'out' ? R.out : R.in;
        tag = el('span', { class: 'rel', style: { color: R.color, borderColor: R.color }, text: label });
      }
      ol.append(el('li', { class: app.store.status(n.id) === 2 ? 'done' : '' }, el('span', { class: 'num', text: k + 1 }), el('button', { class: 't', text: n.t, onclick: () => app.select(i, { fly: true, keepPath: true }) }), tag));
    });
    box.append(el('h3', { text: `航线 · ${r.nodes.length} 站` }), el('p', { class: 'path-hint', text: '标签表示上一站与这一站的关系（从上一站看）。' }), ol,
      el('div', { class: 'row' }, el('button', { class: 'btn gold sm', html: `${ICON.play}<span>沿航线飞行</span>`, onclick: () => app.tour.startCustom('知识航线', r.nodes) })));
    this.routeResult = box;
    app.setPath({ nodes: r.nodes, kind: 'route', numbered: true });
    this.render();
  }

  // learning path to a target
  openLearn(target) { this.learn.target = target; this.open('path'); }
  render_path(p) {
    const app = this.app;
    const t = this.learn.target;
    p.append(el('h3', { text: '学习路径' }), el('p', { class: 'note', text: '选一颗目标星：沿“前置”与“推导”关系向下追溯，列出学会它所需的全部知识，并排成可以依次学习的顺序（先学的不依赖后学的）。' }));
    const input = el('input', { type: 'search', placeholder: '目标：搜索一颗星', value: t >= 0 ? app.graph.nodes[t].t : '' });
    const res = el('div', { class: 'mini-results glass' });
    app.attachMiniSearch(input, res, (i) => app.showLearningPath(i));
    p.append(el('div', { class: 'route-form' }, el('div', { class: 'field' }, el('label', { text: '目标' }), input, res)));
    if (t < 0) {
      p.append(el('p', { class: 'empty-note', text: '也可以在任意星卡上点「学习路径」。' }));
      const front = app.graph.frontier((id) => app.store.status(id), 8);
      if (front.length) { p.append(el('h3', { text: '可以学的下一颗星' })); for (const i of front) p.append(this.nodeItem(i)); }
      return;
    }
    const order = app.graph.learningPath(t, { skip: this.learn.skip ? (u) => app.store.status(app.graph.nodes[u].id) === 2 : null });
    const all = app.graph.learningPath(t);
    const done = all.filter((u) => app.store.status(app.graph.nodes[u].id) === 2).length;
    p.append(el('div', { class: 'row' },
      el('button', { class: `btn sm${this.learn.skip ? ' primary' : ''}`, text: this.learn.skip ? '已跳过已掌握的星' : '显示全部', onclick: () => { this.learn.skip = !this.learn.skip; app.showLearningPath(t); } }),
      el('button', { class: 'btn gold sm', html: `${ICON.play}<span>依次飞行</span>`, onclick: () => app.tour.startCustom(`学习路径 · ${app.graph.nodes[t].t}`, order) }),
      el('button', { class: 'btn sm', text: '清除', onclick: () => { this.learn.target = -1; app.clearPath(); this.render(); } })));
    p.append(el('p', { class: 'path-hint', text: `共 ${all.length} 颗星，已掌握 ${done} 颗${this.learn.skip ? `，还剩 ${order.length}` : ''}。点圆圈标记掌握。` }));
    const ol = el('ol', { class: 'path-steps' });
    order.forEach((i, k) => {
      const n = app.graph.nodes[i];
      const st = app.store.status(n.id);
      ol.append(el('li', { class: `${st === 2 ? 'done' : ''}${i === app.sel ? ' cur' : ''}` },
        el('button', { class: 'num', style: { cursor: 'pointer', background: st === 2 ? '' : 'none' }, title: st === 2 ? '标记为未学' : '标记为已掌握', text: k + 1, onclick: () => app.store.setStatus(n.id, st === 2 ? 0 : 2) }),
        el('button', { class: 't', text: n.t, onclick: () => app.select(i, { fly: true, keepPath: true }) }),
        el('span', { class: 'meta', style: { fontSize: '11px', color: rgba(n.galaxy.rgb, 1) }, text: n.galaxy.name })));
    });
    p.append(ol);
  }

  render_anims(p) {
    const app = this.app;
    p.append(el('p', { class: 'note', text: `${ANIMATIONS.length} 个交互动画，每个都嵌在对应的知识卡片里：拖动、调参数，看定理在眼前成立。` }));
    for (const a of ANIMATIONS) {
      const hosts = app.graph.nodes.filter((n) => n.an === a.id);
      const n = hosts[0];
      const tile = el('button', { class: 'anim-tile', style: { '--gc': n ? rgba(n.galaxy.rgb, 1) : 'var(--accent)' }, disabled: !n, onclick: () => { if (n) { app.select(n.index, { fly: true }); setTimeout(() => app.card.openSection('anim'), 500); } } },
        el('b', { text: a.title }), el('span', { text: n ? `${n.galaxy.name} · ${hosts.map((h) => h.t).join('、')}` : '暂无对应知识星' }));
      p.append(tile);
    }
  }

  render_favs(p) {
    const app = this.app;
    const fav = app.store.data.fav.map((id) => app.graph.node(id)).filter(Boolean);
    p.append(el('h3', { text: `收藏 · ${fav.length}` }));
    if (!fav.length) p.append(el('p', { class: 'empty-note', text: '在星卡上点「收藏」，常看的星会出现在这里，星图上也会带一颗金色小星。' }));
    for (const n of fav) p.append(this.nodeItem(n.index));
    const hist = app.store.data.history.map((id) => app.graph.node(id)).filter(Boolean).slice(0, 30);
    p.append(el('h3', { text: '最近浏览' }));
    if (!hist.length) p.append(el('p', { class: 'empty-note', text: '还没有浏览记录。' }));
    for (const n of hist) p.append(this.nodeItem(n.index));
  }

  render_progress(p) {
    const app = this.app;
    const { per, all } = app.graph.stats((id) => app.store.status(id));
    p.append(el('div', { class: 'stat-grid' },
      el('div', { class: 'stat' }, el('b', { text: all.mastered }), el('span', { text: '已掌握' })),
      el('div', { class: 'stat' }, el('b', { text: all.learning }), el('span', { text: '学习中' })),
      el('div', { class: 'stat' }, el('b', { text: `${Math.round((all.mastered / all.total) * 100)}%` }), el('span', { text: `共 ${all.total} 颗` }))));
    const ring = (G, st) => {
      const r = 22, C = 2 * Math.PI * r;
      const m = st.mastered / st.total, l = st.learning / st.total;
      return el('button', { class: 'ring', onclick: () => app.flyGalaxy(G.index), html: `<svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="5"/><circle cx="27" cy="27" r="${r}" fill="none" stroke="rgba(126,232,255,.7)" stroke-width="5" stroke-dasharray="${C * (m + l)} ${C}" transform="rotate(-90 27 27)" stroke-linecap="round"/><circle cx="27" cy="27" r="${r}" fill="none" stroke="${rgba(G.rgb, 1)}" stroke-width="5" stroke-dasharray="${C * m} ${C}" transform="rotate(-90 27 27)" stroke-linecap="round"/><text x="27" y="31" text-anchor="middle" font-size="11" fill="#fff">${Math.round(m * 100)}%</text></svg><b>${escapeHtml(G.name)}</b>` });
    };
    p.append(el('h3', { text: '各星系' }), el('div', { class: 'ring-row' }, ...app.graph.galaxies.map((G, k) => ring(G, per[k]))));
    const front = app.graph.frontier((id) => app.store.status(id), 10);
    p.append(el('h3', { text: '下一颗星' }), el('p', { class: 'note', text: front.length ? '这些星的前置知识你都已掌握，学会它们能打开最多的后续知识。' : '先在几颗基础星上标记「已掌握」，这里会推荐前置已齐备、可以接着学的星。' }));
    if (!front.length) for (const i of app.graph.roots().slice(0, 8)) p.append(this.nodeItem(i, '起点'));
    for (const i of front) p.append(this.nodeItem(i));
    const file = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      try { app.store.importJSON(await f.text()); app.toast('进度已导入'); } catch (e) { app.toast(`导入失败：${e.message}`); }
      file.value = '';
    });
    p.append(el('h3', { text: '备份' }), el('p', { class: 'note', text: '进度只保存在这台设备的浏览器里。换设备或清理浏览器数据前，先导出备份。' }),
      el('div', { class: 'row' },
        el('button', { class: 'btn sm', text: '导出进度', onclick: () => app.download('math-starmap-progress.json', app.store.exportJSON()) }),
        el('button', { class: 'btn sm', text: '导入进度', onclick: () => file.click() }),
        el('button', { class: 'btn sm', text: '清空进度', onclick: () => { if (confirm('清空全部学习状态、收藏和浏览记录？')) { app.store.reset(); app.toast('已清空'); } } }), file));
  }
}
