// 数学知识星图 — app controller: wires the data, the two views (星图 universe, 星链 explorer),
// the card, drawer, search, tours and routing together and runs the frame loop.

import { Graph } from './core/graph.js';
import { Store } from './core/store.js';
import { Search } from './core/search.js';
import { el, rgba } from './core/util.js';
import { Universe } from './view/universe.js';
import { Explorer } from './view/explore.js';
import { bindInput } from './view/input.js';
import { Card } from './ui/card.js';
import { Drawer } from './ui/drawer.js';
import { Topbar, Legend, Tooltip, Toast, Intro, Help, buildZoom } from './ui/chrome.js';
import { TourPlayer } from './ui/tour.js';

class App {
  constructor() {
    const data = window.STARMAP_GRAPH;
    this.root = document.getElementById('app');
    this.canvas = document.getElementById('sky');
    this.canvas.tabIndex = 0;
    this.ctx = this.canvas.getContext('2d');
    this.graph = new Graph(data);
    this.store = new Store();
    this.searcher = new Search(this.graph);
    this.universe = new Universe(this.graph, this.store);
    this.explorer = new Explorer(this.graph, this.store, this.universe);
    this.universe.panelShift = () => this.panelShift();
    this.mode = 'map';
    this.sel = -1;
    this.lastSel = -1;
    this.content = null;

    this.drawer = new Drawer(this);
    this.card = new Card(this);
    this.topbar = new Topbar(this);
    this.legend = new Legend(this);
    this.tooltip = new Tooltip();
    this.toastBox = new Toast();
    this.tour = new TourPlayer(this);
    this.intro = new Intro(this);
    this.help = new Help(this);
    this.minimap = el('canvas', { id: 'minimap', class: 'glass', 'aria-label': '小地图：点击跳转' });
    this.hud = el('div', { id: 'hud', class: 'glass' });
    this.root.append(this.topbar.root, this.drawer.root, this.legend.root, buildZoom(this), this.minimap, this.card.root, this.hud, this.tour.root, this.tooltip.root, this.toastBox.root, this.help.root, this.intro.root);
    this.topbar.sync();

    bindInput(this, this.canvas);
    this.bindMinimap();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('popstate', () => this.route(location.hash, { fromHistory: true }));
    this.store.on('change', (w) => { if (w && w.type === 'reset') this.universe.select(this.sel); });
    this.resize();

    // first frame: the whole sky, slightly further out, then drift in
    this.overview(true);
    this.loadContent();
    const hash = location.hash;
    if (hash && hash.length > 2) this.route(hash);
    else if (!this.store.data.introSeen) this.intro.open();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    setTimeout(() => this.root.classList.remove('booting'), 60);
  }

  // ---- layout
  resize() {
    const w = innerWidth, h = innerHeight;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w * h * dpr * dpr > 5e6) dpr = Math.max(1, Math.sqrt(5e6 / (w * h)));
    this.dpr = dpr;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.universe.cam.resize(w, h);
    this.explorer.cam.resize(w, h);
    const r = this.minimap.getBoundingClientRect();
    this.minimap.width = Math.round((r.width || 190) * dpr);
    this.minimap.height = Math.round((r.height || 136) * dpr);
  }
  isNarrow() { return this.w < 760; }
  panelShift() { return this.card.isOpen() && !this.isNarrow() ? Math.min(460, this.w - 24) + 24 : 0; }

  overview(far = false) {
    const gs = this.graph.galaxies;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const G of gs) { x0 = Math.min(x0, G.x - G.r); x1 = Math.max(x1, G.x + G.r); y0 = Math.min(y0, G.y - G.r); y1 = Math.max(y1, G.y + G.r); }
    const k = Math.min(this.w / (x1 - x0), (this.h - 80) / (y1 - y0)) * 0.98;
    const cam = this.universe.cam;
    if (far) {
      cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2 + 30; cam.k = k * 0.55;
      cam.flyTo((x0 + x1) / 2, (y0 + y1) / 2 + 20, k, { duration: 3200 });
    } else cam.flyTo((x0 + x1) / 2, (y0 + y1) / 2 + 20, k);
  }

  // ---- frame loop
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(60, t - this.last);
    this.last = t;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const u = this.universe;
    const target = this.mode === 'explore' ? 1 : 0;
    u.dim += (target - u.dim) * Math.min(1, dt * 0.006);
    if (Math.abs(u.dim - target) < 0.002) u.dim = target;
    u.render(ctx, this.w, this.h, dt);
    if (this.mode === 'explore' || u.dim > 0.01) {
      ctx.globalAlpha = this.mode === 'explore' ? Math.min(1, u.dim * 1.3) : u.dim;
      this.explorer.render(ctx, this.w, this.h, dt);
      ctx.globalAlpha = 1;
    }
    if (this.mode === 'map' && (!this.miniT || t - this.miniT > 120)) {
      this.miniT = t;
      const m = this.minimap.getContext('2d');
      m.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      u.drawMinimap(m, this.minimap.width / this.dpr, this.minimap.height / this.dpr);
    }
  }

  bindMinimap() {
    const go = (e) => {
      const r = this.minimap.getBoundingClientRect();
      const [x, y] = this.universe.minimapToWorld(e.clientX - r.left, e.clientY - r.top);
      const cam = this.universe.cam;
      cam.flyTo(x, y, Math.max(cam.k, 0.25), { duration: 700 });
    };
    this.minimap.addEventListener('pointerdown', go);
  }

  // ---- content (full card text) loads after the first frame
  loadContent() {
    const src = document.querySelector('script[data-content]')?.dataset.content || 'data/content.js';
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      this.content = window.STARMAP_CONTENT || {};
      this.searcher.addContent(this.content);
      if (this.card.isOpen()) this.card.renderBody();
    };
    s.onerror = () => this.toast('完整内容载入失败，请刷新重试');
    document.head.append(s);
  }

  // ---- selection
  select(i, { fly = true, from = '', keepPath = false, zoom } = {}) {
    if (i == null || i < 0) return;
    const n = this.graph.nodes[i];
    this.sel = i;
    this.lastSel = i;
    if (!keepPath && this.universe.path && this.universe.path.kind !== 'learn' && !this.tour.active()) this.clearPath();
    this.universe.select(i);
    this.card.open(i);
    if (this.mode === 'explore') {
      if (!this.explorer.items.has(i)) { this.explorer.start(i); setTimeout(() => this.explorer.fit(), 650); }
      this.explorer.sel = i;
      if (fly) {
        const it = this.explorer.items.get(i);
        const cam = this.explorer.cam;
        if (it) cam.flyTo(it.x + this.panelShift() / 2 / cam.k, it.y, Math.max(cam.k, 0.7), { duration: 600 });
      }
    } else if (fly) {
      this.universe.flyToNode(i, zoom);
    }
    this.store.visit(n.id);
    this.setHash(`#/${this.mode === 'explore' ? 'x' : 'n'}/${n.id}`, from !== 'tour');
    document.title = `${n.t} · 数学知识星图`;
    if (this.drawer.isOpen() && this.drawer.tab === 'path') this.drawer.render();
  }
  onStarClick(i) {
    if (this.mode === 'explore') {
      const it = this.explorer.items.get(i);
      if (it && !it.expanded) { const k = this.explorer.expand(i); if (!k) this.toast('它的邻居都已经在图上了'); }
      else if (it && it.expanded && this.sel === i && i !== this.explorer.root) { this.explorer.collapse(i); }
      this.select(i, { fly: false, from: 'click' });
      return;
    }
    if (this.tour.active()) { this.select(i, { fly: true, keepPath: true }); return; }
    this.select(i, { fly: true, from: 'click' });
  }
  deselect() {
    this.sel = -1;
    this.universe.select(-1);
    this.explorer.sel = this.mode === 'explore' ? this.explorer.root : -1;
    this.card.close();
    this.setHash(this.mode === 'explore' && this.explorer.root >= 0 ? `#/x/${this.graph.nodes[this.explorer.root].id}` : '#/', true);
    document.title = '数学知识星图 · Math Starmap';
  }

  setMode(mode, root) {
    if (mode === 'explore') {
      const r = root ?? (this.sel >= 0 ? this.sel : this.lastSel >= 0 ? this.lastSel : this.graph.node('derivative')?.index ?? 0);
      if (this.tour.active()) this.tour.stop();
      this.mode = 'explore';
      this.root.classList.add('mode-explore');
      this.explorer.start(r);
      this.explorer.cam.k = 0.6;
      setTimeout(() => this.explorer.fit(900), 500);
      this.select(r, { fly: false, from: 'mode' });
      this.hint(`星链 · 点击星星继续展开，再点一次已选中的星把它收起`, [['展开全部', () => { const k = this.explorer.expandAll(); this.toast(k ? `又展开了 ${k} 颗星` : '没有更多邻居了'); setTimeout(() => this.explorer.fit(), 700); }], ['适配视图', () => this.explorer.fit()], ['返回星图', () => this.setMode('map')]]);
    } else {
      this.mode = 'map';
      this.root.classList.remove('mode-explore');
      this.hint(null);
      if (this.sel >= 0) { this.universe.select(this.sel); this.universe.flyToNode(this.sel); this.setHash(`#/n/${this.graph.nodes[this.sel].id}`, true); }
    }
    this.topbar.sync();
  }
  hint(text, actions = []) {
    this.hud.innerHTML = '';
    if (!text) { this.hud.classList.remove('on'); return; }
    this.hud.append(el('span', { html: text }), ...actions.map(([label, fn]) => el('button', { class: 'btn sm', text: label, onclick: fn })));
    this.hud.classList.add('on');
  }

  // ---- paths
  setPath(path) { this.universe.path = path; }
  clearPath() { this.universe.path = null; if (this.drawer.isOpen() && this.drawer.tab === 'routes') { this.drawer.routeResult = null; this.drawer.render(); } }
  showLearningPath(i) {
    if (this.mode !== 'map') this.setMode('map');
    const d = this.drawer;
    d.learn.target = i;
    const order = this.graph.learningPath(i, { skip: d.learn.skip ? (u) => this.store.status(this.graph.nodes[u].id) === 2 : null });
    this.setPath({ nodes: order, kind: 'learn', numbered: true });
    d.open('path');
    this.universe.fitView(order, { maxK: 1.1, padding: 140 });
    this.toast(`学会「${this.graph.nodes[i].t}」需要 ${order.length - 1} 颗前置星`);
  }

  // ---- navigation
  flyGalaxy(gi) { if (this.mode !== 'map') this.setMode('map'); this.universe.fitGalaxy(gi); if (this.isNarrow()) this.drawer.close(); }
  flyCluster(ci) {
    if (this.mode !== 'map') this.setMode('map');
    const c = this.graph.clusters[ci];
    this.universe.fitView(c.members, { maxK: 1.4, padding: 100 });
    this.universe.hits = new Set(c.members);
    clearTimeout(this.hitT);
    this.hitT = setTimeout(() => { this.universe.hits = null; }, 3500);
    if (this.isNarrow()) this.drawer.close();
  }
  fit() { if (this.mode === 'explore') this.explorer.fit(); else this.overview(); }
  zoomBy(f) { const cam = this.mode === 'explore' ? this.explorer.cam : this.universe.cam; cam.zoomAt(cam.w / 2, cam.h / 2, f); }
  randomStar() {
    const nodes = this.graph.nodes.filter((n) => this.store.data.settings.levels[n.lv] !== false);
    const total = nodes.reduce((a, n) => a + n.w, 0);
    let r = Math.random() * total;
    for (const n of nodes) { r -= n.w; if (r <= 0) { this.select(n.index, { fly: true, zoom: 1.3 }); return; } }
  }
  home() {
    if (this.tour.active()) this.tour.stop();
    if (this.mode !== 'map') this.setMode('map');
    this.deselect();
    this.clearPath();
    this.overview();
  }
  relationsChanged() {
    if (this.sel >= 0) this.universe.select(this.sel);
    this.explorer.heat = 1;
  }

  // ---- routing: #/n/id (star), #/x/id (星链), #/tour/id, #/learn/id
  setHash(h, replace) {
    if (location.hash === h) return;
    try { if (replace) history.replaceState(null, '', h); else history.pushState(null, '', h); } catch { /* sandboxed */ }
  }
  route(hash, { fromHistory = false } = {}) {
    const m = /^#\/(n|x|tour|learn)\/([a-z0-9-]+)$/.exec(hash || '');
    if (!m) { if (fromHistory) this.deselect(); return; }
    const [, kind, id] = m;
    if (kind === 'tour') { this.tour.start(id); return; }
    const n = this.graph.node(id);
    if (!n) return;
    if (kind === 'x') { this.setMode('explore', n.index); return; }
    if (kind === 'learn') { this.showLearningPath(n.index); return; }
    if (this.mode !== 'map') this.setMode('map');
    this.select(n.index, { fly: true, from: fromHistory ? 'tour' : 'route', zoom: 1.2 });
  }

  // ---- small helpers used by the UI
  toast(msg) { this.toastBox.show(msg); }
  download(name, text) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  attachMiniSearch(input, box, onPick) {
    let list = [];
    const draw = () => {
      const q = input.value.trim();
      box.innerHTML = '';
      if (!q) { box.classList.remove('open'); return; }
      list = this.searcher.query(q, 8);
      for (const r of list) {
        const n = this.graph.nodes[r.i];
        box.append(el('button', { class: 'result', style: { color: rgba(n.galaxy.rgb, 1) }, onmousedown: (e) => e.preventDefault(), onclick: () => { box.classList.remove('open'); input.value = n.t; onPick(r.i); } },
          el('span', { class: 'dot' }), el('span', { class: 't', style: { color: 'var(--text)' }, text: n.t }), el('span', { class: 'meta', text: n.galaxy.name })));
      }
      if (!list.length) box.append(el('div', { class: 'empty', text: '没有找到' }));
      box.classList.add('open');
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && list[0]) { box.classList.remove('open'); input.value = this.graph.nodes[list[0].i].t; onPick(list[0].i); } });
    input.addEventListener('blur', () => setTimeout(() => box.classList.remove('open'), 150));
  }
}

function boot() {
  if (!window.STARMAP_GRAPH) {
    document.getElementById('boot').innerHTML = '<p>星图数据没有载入。请通过网页服务器打开（例如 <code>npm start</code>）。</p>';
    return;
  }
  try {
    window.starmap = new App();
  } catch (e) {
    console.error(e);
    document.getElementById('boot').innerHTML = `<p>星图启动失败：${String(e.message).replace(/</g, '&lt;')}</p>`;
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
