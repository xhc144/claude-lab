// Module 9 — symmetry: draw, and every stroke is repeated by a symmetry group of the plane — a
// rosette (kaleidoscope) C_n / D_n, one of the 7 frieze groups or one of the 17 wallpaper groups.
// Mirror lines, glide lines and rotation centres can be shown on top.

import { h } from '../ui/dom.js';
import { Layer, observeSize, animationLoop } from '../ui/canvas.js';
import { section, slider, toggle, segmented, button, chips, iconButton } from '../ui/controls.js';
import { C, FONT } from '../ui/theme.js';
import { WALLPAPER, FRIEZE, LATTICES, group, elements, image } from '../core/symmetry.js';

const COLORS = ['#7aa2ff', '#a78bfa', '#f472b6', '#fb7185', '#fbbf24', '#4ade80', '#22d3ee', '#e8ecf4'];
const ORDER_COLOURS = { 2: '#fbbf24', 3: '#4ade80', 4: '#22d3ee', 6: '#f472b6' };
const KIND_LABEL = { rosette: '万花筒', frieze: '带状饰', wallpaper: '墙纸' };

function create({ stage, panel, toast, query, setQuery }) {
  const st = {
    kind: KIND_LABEL[query.get('k')] ? query.get('k') : 'wallpaper',
    id: 'p4m',
    rosType: 'D',
    n: 6,
    cell: 150,
    strokes: [],
    current: null,
    color: COLORS[0],
    width: 3,
    rainbow: true,
    glow: true,
    showLattice: true,
    showElements: false,
    auto: null,
  };
  const qg = query.get('g');
  if (st.kind === 'wallpaper' && WALLPAPER[qg]) st.id = qg;
  if (st.kind === 'frieze') st.id = FRIEZE[qg] ? qg : 'p2mg';
  if (st.kind === 'rosette') {
    st.rosType = qg === 'C' ? 'C' : 'D';
    const n = Number(query.get('n'));
    if (Number.isInteger(n) && n >= 1 && n <= 24) st.n = n;
  }

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const fx = new Layer(stage, { passive: true });
  const art = document.createElement('canvas');
  const artCtx = art.getContext('2d');
  const info = h('div', { class: 'overlay-card tl', id: 'sym-info' });
  const hint = h('div', { class: 'stage-hint' }, '在画布上随意画：每一笔都会按所选的对称群复制 · 滚轮改变格子大小');
  const autoBtn = iconButton({ iconName: 'play', title: '自动作画（A）', cls: 'play', id: 'sym-auto', onClick: () => setAuto(!st.auto) });
  const transport = h('div', { class: 'transport' },
    iconButton({ iconName: 'reverse', title: '撤销（U）', id: 'sym-undo', onClick: undo }),
    autoBtn,
    iconButton({ iconName: 'trash', title: '清空', id: 'sym-clear', onClick: clearAll }));
  stage.append(info, hint, transport);

  let G = null; // the current Cartesian group
  const W = () => layer.w, H = () => layer.h;
  // world: origin at the stage centre, y up (so rotations turn counter-clockwise)
  const sx = (x) => W() / 2 + x, sy = (y) => H() / 2 - y;

  function rebuildGroup() {
    if (st.kind === 'rosette') G = group('rosette', st.rosType, { n: st.n });
    else G = group(st.kind, st.id, { cell: st.cell });
  }

  /** Lattice translations (k, l) whose copies of a figure of radius R can reach the view. */
  function translations(R) {
    if (G.periodic === 0) return [[0, 0]];
    const [a0, b0, a1, b1] = G.L;
    const det = a0 * b1 - b0 * a1;
    const w = W() / 2 + R, hh = H() / 2 + R;
    const corners = [[-w, -hh], [w, -hh], [-w, hh], [w, hh]].map(([x, y]) => [(b1 * x - b0 * y) / det, (-a1 * x + a0 * y) / det]);
    const ks = corners.map((c) => c[0]), ls = corners.map((c) => c[1]);
    const out = [];
    const l0 = G.periodic === 2 ? Math.floor(Math.min(...ls)) - 1 : 0, l1 = G.periodic === 2 ? Math.ceil(Math.max(...ls)) + 1 : 0;
    for (let k = Math.floor(Math.min(...ks)) - 1; k <= Math.ceil(Math.max(...ks)) + 1; k++) {
      for (let l = l0; l <= l1; l++) out.push([k, l]);
    }
    return out;
  }

  // ------------------------------------------------------------------ painting strokes
  const hueAt = (s, d) => (s.hue0 + d * 0.35) % 360;
  function strokeStyle(ctx, s, d) {
    ctx.strokeStyle = s.rainbow ? `hsl(${hueAt(s, d)}, 85%, 66%)` : s.color;
  }

  /** Draw the copies of the part of stroke s from point index i0 on (0 = all of it). */
  function paintStroke(ctx, s, i0 = 0) {
    const pts = s.pts;
    if (pts.length < 2) return;
    const R = Math.max(...pts.map(([x, y]) => Math.hypot(x, y))) + Math.max(0, ...G.ops.map((o) => Math.hypot(o.tau[0], o.tau[1]))) + s.width;
    const T = translations(R);
    const from = Math.max(0, i0 - 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // chunks of equal colour (rainbow strokes change hue along their length)
    const chunk = s.rainbow ? 6 : pts.length;
    for (let a = from; a < pts.length - 1; a += chunk) {
      const b = Math.min(pts.length - 1, a + chunk);
      for (const pass of s.glow ? [0, 1] : [1]) {
        ctx.lineWidth = pass === 0 ? s.width * 3.2 : s.width;
        ctx.globalAlpha = pass === 0 ? 0.16 : 0.95;
        strokeStyle(ctx, s, s.len[a]);
        ctx.beginPath();
        for (const o of G.ops) {
          for (const [k, l] of T) {
            for (let i = a; i <= b; i++) {
              const p = image(G, o, pts[i], k, l);
              if (i === a) ctx.moveTo(sx(p[0]), sy(p[1])); else ctx.lineTo(sx(p[0]), sy(p[1]));
            }
          }
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function repaint() {
    rebuildGroup();
    artCtx.setTransform(1, 0, 0, 1, 0, 0);
    artCtx.clearRect(0, 0, art.width, art.height);
    artCtx.setTransform(layer.dpr, 0, 0, layer.dpr, 0, 0);
    for (const s of st.strokes) paintStroke(artCtx, s);
    if (st.current) paintStroke(artCtx, st.current);
    compose();
    drawElements();
    paintInfo();
  }

  function compose() {
    const { ctx } = layer;
    layer.reset();
    ctx.fillStyle = '#080b12';
    ctx.fillRect(0, 0, W(), H());
    ctx.drawImage(art, 0, 0, W(), H());
  }

  // ------------------------------------------------------------------ lattice and symmetry elements
  function drawElements() {
    fx.reset();
    const ctx = fx.ctx;
    if (G.periodic === 0) {
      if (!st.showElements && !st.showLattice) return;
      const e = elements(G);
      ctx.save();
      ctx.strokeStyle = 'rgba(122, 162, 255, 0.55)';
      ctx.lineWidth = 1.2;
      for (const m of st.showElements ? e.mirrors : []) {
        const L = Math.hypot(W(), H());
        ctx.beginPath();
        ctx.moveTo(sx(-m.u[0] * L), sy(-m.u[1] * L));
        ctx.lineTo(sx(m.u[0] * L), sy(m.u[1] * L));
        ctx.stroke();
      }
      ctx.restore();
      if (st.showElements) for (const c of e.centres) centreMark(ctx, c.p, c.order);
      return;
    }
    const T = translations(0);
    const [a0, b0, a1, b1] = G.L;
    if (st.showLattice) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      for (const [k, l] of T) {
        const ox = k * a0 + l * b0, oy = k * a1 + l * b1;
        if (G.periodic === 2) {
          ctx.moveTo(sx(ox), sy(oy));
          ctx.lineTo(sx(ox + a0), sy(oy + a1));
          ctx.moveTo(sx(ox), sy(oy));
          ctx.lineTo(sx(ox + b0), sy(oy + b1));
        } else if (l === 0) {
          ctx.moveTo(sx(ox), 0);
          ctx.lineTo(sx(ox), H());
        }
      }
      ctx.stroke();
      ctx.restore();
    }
    if (!st.showElements) return;
    const e = elements(G);
    const Li = (() => { const d = a0 * b1 - b0 * a1; return [b1 / d, -b0 / d, -a1 / d, a0 / d]; })();
    const toF = (p) => [Li[0] * p[0] + Li[1] * p[1], Li[2] * p[0] + Li[3] * p[1]];
    // clip a line (p + s·u) to the cell [0,1)² in fractional coordinates (frieze: x only)
    const clip = (p, u) => {
      const f = toF(p), g = toF(u);
      let s0 = -1e9, s1 = 1e9;
      const dims = G.periodic === 2 ? [0, 1] : [0];
      for (const i of dims) {
        if (Math.abs(g[i]) < 1e-12) { if (f[i] < -1e-9 || f[i] > 1 + 1e-9) return null; continue; }
        let a = (0 - f[i]) / g[i], b = (1 - f[i]) / g[i];
        if (a > b) [a, b] = [b, a];
        s0 = Math.max(s0, a); s1 = Math.min(s1, b);
      }
      if (G.periodic === 1) { const lim = H(); s0 = Math.max(s0, -lim); s1 = Math.min(s1, lim); }
      return s0 < s1 ? [p[0] + s0 * u[0], p[1] + s0 * u[1], p[0] + s1 * u[0], p[1] + s1 * u[1]] : null;
    };
    const segs = (list) => list.map((m) => clip(m.p, m.u)).filter(Boolean);
    const mir = segs(e.mirrors), gl = segs(e.glides);
    ctx.save();
    ctx.lineWidth = 2;
    for (const [list, dash, col] of [[mir, [], 'rgba(122, 162, 255, 0.85)'], [gl, [7, 6], 'rgba(244, 114, 182, 0.85)']]) {
      ctx.strokeStyle = col;
      ctx.setLineDash(dash);
      ctx.beginPath();
      for (const [k, l] of T) {
        const ox = k * a0 + l * b0, oy = k * a1 + l * b1;
        for (const s of list) { ctx.moveTo(sx(s[0] + ox), sy(s[1] + oy)); ctx.lineTo(sx(s[2] + ox), sy(s[3] + oy)); }
      }
      ctx.stroke();
    }
    ctx.restore();
    for (const [k, l] of T) {
      const ox = k * a0 + l * b0, oy = k * a1 + l * b1;
      for (const c of e.centres) centreMark(ctx, [c.p[0] + ox, c.p[1] + oy], c.order);
    }
  }

  function centreMark(ctx, p, order) {
    const x = sx(p[0]), y = sy(p[1]);
    if (x < -10 || y < -10 || x > W() + 10 || y > H() + 10) return;
    const r = 6.5;
    ctx.save();
    ctx.fillStyle = ORDER_COLOURS[order] || '#e8ecf4';
    ctx.strokeStyle = '#080b12';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (order === 2) ctx.ellipse(x, y, r * 1.15, r * 0.6, 0, 0, 2 * Math.PI);
    else {
      for (let i = 0; i < order; i++) {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / order;
        i ? ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ drawing input
  const toWorld = (px, py) => [px - W() / 2, H() / 2 - py];
  function beginStroke(p) {
    st.current = { pts: [p], len: [0], color: st.color, width: st.width, rainbow: st.rainbow, glow: st.glow, hue0: Math.random() * 360 };
  }
  function extendStroke(p) {
    const s = st.current;
    const q = s.pts.at(-1);
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < 2) return;
    s.pts.push(p);
    s.len.push(s.len.at(-1) + d);
    artCtx.setTransform(layer.dpr, 0, 0, layer.dpr, 0, 0);
    paintStroke(artCtx, s, s.pts.length - 2);
    compose();
  }
  function endStroke() {
    if (st.current && st.current.pts.length > 1) st.strokes.push(st.current);
    st.current = null;
    paintInfo();
  }
  let pid = null;
  const local = (e) => { const r = layer.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    if (e.button > 0) return;
    setAuto(false);
    pid = e.pointerId;
    layer.canvas.setPointerCapture?.(e.pointerId);
    beginStroke(toWorld(...local(e)));
    hint.style.opacity = 0;
    e.preventDefault();
  };
  const onMove = (e) => { if (e.pointerId === pid && st.current) extendStroke(toWorld(...local(e))); };
  const onUp = (e) => { if (e.pointerId === pid) { pid = null; endStroke(); } };
  const onWheel = (e) => {
    if (st.kind === 'rosette') return;
    e.preventDefault();
    st.cell = Math.max(50, Math.min(400, st.cell * Math.exp(-e.deltaY * 0.001)));
    cellSlider.set(st.cell);
    repaint();
  };
  layer.canvas.addEventListener('pointerdown', onDown);
  layer.canvas.addEventListener('pointermove', onMove);
  layer.canvas.addEventListener('pointerup', onUp);
  layer.canvas.addEventListener('pointercancel', onUp);
  layer.canvas.addEventListener('wheel', onWheel, { passive: false });
  layer.canvas.style.touchAction = 'none';
  layer.canvas.style.cursor = 'crosshair';

  function undo() { st.strokes.pop(); repaint(); }
  function clearAll() { setAuto(false); st.strokes = []; repaint(); }

  /** A smooth random curve inside one cell (or around the rosette centre). */
  function doodle() {
    const R = st.kind === 'rosette' ? Math.min(W(), H()) * 0.42 : st.cell * 0.36;
    const ph = Array.from({ length: 6 }, () => Math.random() * 2 * Math.PI);
    const fr = [1, 2 + Math.floor(Math.random() * 3), 3 + Math.floor(Math.random() * 4)];
    const amp = [0.55, 0.3, 0.15];
    const cx = st.kind === 'rosette' ? R * 0.35 : st.cell * (0.15 + 0.3 * Math.random());
    const cy = st.kind === 'rosette' ? R * 0.1 : st.cell * (0.1 + 0.2 * Math.random());
    return (t) => {
      let x = cx, y = cy;
      for (let j = 0; j < 3; j++) { x += R * amp[j] * Math.cos(fr[j] * t + ph[j]); y += R * amp[j] * Math.sin(fr[j] * t * 1.3 + ph[j + 3]); }
      return [x, y];
    };
  }
  function randomStroke() {
    const f = doodle();
    beginStroke(f(0));
    for (let i = 1; i <= 220; i++) {
      const p = f((i / 220) * 2 * Math.PI);
      const q = st.current.pts.at(-1);
      st.current.pts.push(p);
      st.current.len.push(st.current.len.at(-1) + Math.hypot(p[0] - q[0], p[1] - q[1]));
    }
    st.strokes.push(st.current);
    st.current = null;
    repaint();
  }

  // automatic drawing: a pen wandering along a random smooth curve
  const loop = animationLoop((dt) => {
    if (!st.auto) return;
    st.auto.t += dt * 0.9;
    if (st.auto.t > 2 * Math.PI) {
      endStroke();
      st.auto = { t: 0, f: doodle() };
      st.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      beginStroke(st.auto.f(0));
      return;
    }
    extendStroke(st.auto.f(st.auto.t));
  });
  function setAuto(on) {
    if (!!on === !!st.auto) return;
    if (on) {
      st.auto = { t: 0, f: doodle() };
      beginStroke(st.auto.f(0));
      loop.start();
    } else {
      st.auto = null;
      endStroke();
      loop.stop();
    }
    autoBtn.innerHTML = '';
    const t = document.createElement('template');
    t.innerHTML = on
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 v13 l11-6.5 z" fill="currentColor"/></svg>';
    autoBtn.append(t.content.firstElementChild);
  }

  // ------------------------------------------------------------------ panel
  const kindSeg = segmented({
    id: 'sym-kind',
    options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })),
    value: st.kind,
    onChange: (v) => {
      st.kind = v;
      st.id = v === 'wallpaper' ? 'p4m' : v === 'frieze' ? 'p2mg' : st.id;
      paintPickers();
      repaint();
      syncQuery();
    },
  });
  const wallChips = chips({
    id: 'sym-wallpaper',
    items: Object.entries(WALLPAPER).map(([id, g]) => ({ id, label: id, title: `${g.orbifold} · ${LATTICES[g.lattice].label}格 · ${g.desc}` })),
    onPick: (id) => { st.id = id; repaint(); syncQuery(); },
  });
  const friezeChips = chips({
    id: 'sym-frieze',
    items: Object.entries(FRIEZE).map(([id, g]) => ({ id, label: `${g.name} ${id}`, title: g.desc })),
    onPick: (id) => { st.id = id; repaint(); syncQuery(); },
  });
  const rosSeg = segmented({
    id: 'sym-rosette-type',
    options: [{ value: 'C', label: 'Cₙ 只旋转' }, { value: 'D', label: 'Dₙ 旋转 + 镜面' }],
    value: st.rosType,
    onChange: (v) => { st.rosType = v; repaint(); syncQuery(); },
  });
  const nSlider = slider({ label: '阶数 <span class="math">n</span>', min: 1, max: 16, step: 1, value: st.n, id: 'sym-n', format: (v) => String(v), onInput: (v) => { st.n = v; repaint(); syncQuery(); } });
  const rosBox = h('div', { class: 'field' }, rosSeg.el, nSlider.el);
  const groupInfo = h('div', { class: 'note', id: 'sym-group-info' });
  function paintPickers() {
    kindSeg.set(st.kind);
    wallChips.el.style.display = st.kind === 'wallpaper' ? '' : 'none';
    friezeChips.el.style.display = st.kind === 'frieze' ? '' : 'none';
    rosBox.style.display = st.kind === 'rosette' ? '' : 'none';
    cellSlider.el.style.display = st.kind === 'rosette' ? 'none' : '';
  }

  const colorChips = h('div', { class: 'swatches', id: 'sym-colors' });
  COLORS.forEach((c) => {
    const b = h('button', { type: 'button', class: 'swatch-btn', style: { background: c }, title: c, 'aria-label': `颜色 ${c}` });
    b.addEventListener('click', () => { st.color = c; st.rainbow = false; rainbowToggle.set(false); paintSwatches(); });
    colorChips.append(b);
  });
  const paintSwatches = () => { [...colorChips.children].forEach((b, i) => b.classList.toggle('on', !st.rainbow && COLORS[i] === st.color)); };
  const rainbowToggle = toggle({ label: '彩虹笔', value: st.rainbow, id: 'sym-rainbow', onChange: (v) => { st.rainbow = v; paintSwatches(); } });
  const cellSlider = slider({ label: '格子大小', min: 50, max: 400, step: 1, value: st.cell, id: 'sym-cell', format: (v) => `${Math.round(v)} px`, onInput: (v) => { st.cell = v; repaint(); } });

  panel.append(
    section('对称群', [kindSeg.el, wallChips.el, friezeChips.el, rosBox, groupInfo]),
    section('画笔', [colorChips, rainbowToggle.el,
      slider({ label: '粗细', min: 1, max: 14, step: 0.5, value: st.width, format: (v) => `${v} px`, onInput: (v) => { st.width = v; } }).el,
      toggle({ label: '发光', value: st.glow, onChange: (v) => { st.glow = v; } }).el,
      h('div', { class: 'btn-row' },
        button({ label: '随机一笔', iconName: 'shuffle', small: true, id: 'sym-random', onClick: randomStroke }),
        button({ label: '撤销', small: true, onClick: undo }),
        button({ label: '清空', small: true, onClick: clearAll }))]),
    section('显示', [cellSlider.el, h('div', { class: 'toggles two' },
      toggle({ label: '晶格', value: st.showLattice, id: 'sym-lattice', swatch: '#94a3b8', onChange: (v) => { st.showLattice = v; drawElements(); } }).el,
      toggle({ label: '对称元素', value: st.showElements, id: 'sym-elements', swatch: C.accent, onChange: (v) => { st.showElements = v; drawElements(); } }).el),
    h('div', { class: 'legend', html: '<span><i class="ln"></i>镜面</span><span><i class="ln dash"></i>滑移反射</span><span><i class="dot" style="background:#fbbf24"></i>2</span><span><i class="dot" style="background:#4ade80"></i>3</span><span><i class="dot" style="background:#22d3ee"></i>4</span><span><i class="dot" style="background:#f472b6"></i>6 重中心</span>' })]),
    section('原理', [h('div', { class: 'note', html: '平面上保持图案不变的全部变换（平移、旋转、反射、滑移反射）构成一个群。只在一个方向平移的有 <b>7</b> 种（带状饰），在两个方向平移的恰好 <b>17</b> 种（墙纸群，费多罗夫 1891）；旋转只能是 2、3、4、6 重——这就是<b>晶体学限制</b>：五重对称铺不满平面。' })]),
  );

  function paintInfo() {
    let title, sub;
    if (st.kind === 'rosette') {
      title = `${st.rosType === 'D' ? 'D' : 'C'}${String(st.n).replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c])}`;
      sub = st.rosType === 'D' ? `${st.n} 个旋转 + ${st.n} 面镜子，共 ${2 * st.n} 个元素` : `${st.n} 个旋转，没有镜面`;
      wallChips.set(null); friezeChips.set(null);
    } else if (st.kind === 'frieze') {
      const g = FRIEZE[st.id];
      title = `${g.name} ${st.id}　${g.orbifold}`;
      sub = g.desc;
      friezeChips.set(st.id);
    } else {
      const g = WALLPAPER[st.id];
      title = `${st.id}　${g.orbifold}`;
      sub = `${LATTICES[g.lattice].label}格 · 每格 ${g.ops.length} 份 · ${g.desc}`;
      wallChips.set(st.id);
    }
    groupInfo.innerHTML = `<b>${title}</b><br>${sub}`;
    info.textContent = '';
    info.append(h('div', { class: 'title' }, KIND_LABEL[st.kind]), h('div', { class: 'big' }, title), h('div', { class: 'big', style: { color: C.text2, fontFamily: FONT, fontSize: '12px' } }, `${st.strokes.length} 笔 · 每笔复制 ${G ? G.ops.length : 0} 份${G?.periodic ? ' × 平移' : ''}`));
  }

  function syncQuery() {
    setQuery({ k: st.kind === 'wallpaper' ? null : st.kind, g: st.kind === 'rosette' ? st.rosType : st.id, n: st.kind === 'rosette' ? st.n : null });
  }

  const stopResize = observeSize(stage, (w, hh) => {
    const first = layer.w === 0;
    layer.resize(w, hh);
    fx.resize(w, hh);
    art.width = Math.round(w * layer.dpr);
    art.height = Math.round(hh * layer.dpr);
    rebuildGroup();
    if (first && !st.strokes.length) { randomStroke(); if (st.kind === 'rosette') randomStroke(); } // something to look at
    repaint();
  });
  paintPickers();
  paintSwatches();
  syncQuery();

  return {
    help: {
      tips: [
        '在画布上拖动作画：每一笔都会被所选对称群的每个元素复制。',
        '“墙纸”里有全部 17 种平面对称群；打开“对称元素”看镜面（实线）、滑移反射（虚线）和 2/3/4/6 重旋转中心。',
        '比较 p3m1 与 p31m、p4m 与 p4g：旋转相同，镜面的位置不同。',
      ],
      keys: [['U', '撤销'], ['A', '自动作画'], ['N', '随机一笔']],
    },
    onKey(e) {
      if (e.key === 'u' || e.key === 'U' || e.key === 'Backspace') { undo(); e.preventDefault(); }
      else if (e.key === 'a' || e.key === 'A') setAuto(!st.auto);
      else if (e.key === 'n' || e.key === 'N') randomStroke();
    },
    snapshot: () => {
      // strokes and the symmetry overlay together
      const c = document.createElement('canvas');
      c.width = layer.canvas.width;
      c.height = layer.canvas.height;
      const g = c.getContext('2d');
      g.drawImage(layer.canvas, 0, 0);
      g.drawImage(fx.canvas, 0, 0);
      return c;
    },
    state: () => {
      const e = elements(G);
      return {
        kind: st.kind, id: st.kind === 'rosette' ? `${st.rosType}${st.n}` : st.id, strokes: st.strokes.length, copies: G.ops.length, auto: !!st.auto,
        elements: { mirrors: e.mirrors.length, glides: e.glides.length, orders: [...new Set(e.centres.map((c) => c.order))].sort((a, b) => a - b) },
      };
    },
    destroy() {
      loop.stop();
      stopResize();
      layer.canvas.removeEventListener('pointerdown', onDown);
      layer.canvas.removeEventListener('pointermove', onMove);
      layer.canvas.removeEventListener('pointerup', onUp);
      layer.canvas.removeEventListener('pointercancel', onUp);
      layer.canvas.removeEventListener('wheel', onWheel);
    },
  };
}

export default {
  id: 'symmetry',
  title: '对称与万花筒',
  short: '对称',
  subtitle: '画一笔，看它被旋转、反射与平移复制：万花筒、7 种带状饰和全部 17 种墙纸群',
  icon: 'symmetry',
  create,
};
