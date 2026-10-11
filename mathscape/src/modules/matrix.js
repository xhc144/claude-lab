// Module 1 — 2×2 matrices as linear transformations of the plane.

import { h } from '../ui/dom.js';
import { Layer, Viewport, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { drawGrid, arrow, label, handle, niceStep, backdrop } from '../ui/draw.js';
import { section, slider, toggle, segmented, button, chips, readout } from '../ui/controls.js';
import { fmt, fmtVec, fmtComplex, deg } from '../ui/format.js';
import { C, FONT, MATH, alpha } from '../ui/theme.js';
import { evalConstant } from '../core/expr.js';
import {
  mat, IDENTITY, det, trace, apply, inverse, eigen, svd, interpolate, rank, classify, transpose, mul, rotation,
} from '../core/linalg.js';

const PRESETS = [
  { id: 'rot', label: '旋转 30°', m: rotation(Math.PI / 6) },
  { id: 'shear', label: '剪切', m: mat(1, 1, 0, 1) },
  { id: 'stretch', label: '拉伸', m: mat(2, 0, 0, 0.5) },
  { id: 'sym', label: '对称矩阵', m: mat(2, 1, 1, 2) },
  { id: 'reflect', label: '反射', m: mat(0, 1, 1, 0) },
  { id: 'proj', label: '投影', m: mat(0.5, 0.5, 0.5, 0.5) },
  { id: 'singular', label: '奇异', m: mat(1, 2, 0.5, 1) },
  { id: 'spiral', label: '螺旋（复特征值）', m: mat(0.9, -0.45, 0.45, 0.9) },
  { id: 'fib', label: '斐波那契', m: mat(1, 1, 1, 0) },
  { id: 'flip', label: 'det < 0', m: mat(1, 2, 3, 4) },
];

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const sub = (k) => '₀₁₂₃₄₅₆₇₈₉'[k];

/** Clip the infinite line p + s·d to a rectangle; returns [x0, y0, x1, y1] or null. */
function clipLine(px, py, dx, dy, b) {
  let s0 = -Infinity, s1 = Infinity;
  const axis = (p, d, lo, hi) => {
    if (Math.abs(d) < 1e-14) return p >= lo && p <= hi;
    let a = (lo - p) / d, c = (hi - p) / d;
    if (a > c) [a, c] = [c, a];
    s0 = Math.max(s0, a);
    s1 = Math.min(s1, c);
    return true;
  };
  if (!axis(px, dx, b.xmin, b.xmax) || !axis(py, dy, b.ymin, b.ymax) || s0 > s1) return null;
  return [px + s0 * dx, py + s0 * dy, px + s1 * dx, py + s1 * dy];
}

function create({ stage, panel, toast, query, setQuery }) {
  // ------------------------------------------------------------------ state
  const st = {
    A: mat(1, 1, 0, 1),
    t: 1,
    mode: 'linear',
    v: [1.4, 0.8],
    show: { grid: true, original: true, square: true, circle: true, eigen: true, vector: true, orbit: false },
    orbitN: 16,
    drag: null,
    hover: null,
  };
  const qm = query.get('m');
  if (qm) {
    const p = qm.split(',').map(Number);
    if (p.length === 4 && p.every(Number.isFinite)) st.A = mat(...p);
  }

  // ------------------------------------------------------------------ stage
  const layer = new Layer(stage);
  const vp = new Viewport({ scale: 70 });
  const overlay = h('div', { class: 'overlay-card tl', id: 'matrix-overlay' });
  const hint = h('div', { class: 'stage-hint' }, '拖动 î、ĵ 箭头端点改变矩阵 · 拖动 v 观察 Av · 滚轮缩放、拖动空白平移');
  stage.append(overlay, hint);

  const M = () => interpolate(st.A, st.t, st.mode);

  // ------------------------------------------------------------------ rendering
  let raf = 0;
  const requestRender = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  function render() {
    const { ctx } = layer;
    layer.reset();
    const W = vp.w, H = vp.h;
    backdrop(ctx, W, H, '#0f1420', '#090c13', 0.45, layer.dpr);

    const m = M();
    const b = vp.bounds;
    const sx = (x) => vp.sx(x), sy = (y) => vp.sy(y);

    drawGrid(ctx, vp, { alpha: st.show.original ? 1 : 0.35, labels: true });

    if (st.show.grid) drawTransformedGrid(ctx, m, b);

    // unit square → parallelogram (signed area = det)
    const D = det(m);
    if (st.show.square) {
      const [ax, ay] = apply(m, 1, 0), [bx, by] = apply(m, 0, 1);
      ctx.beginPath();
      ctx.moveTo(sx(0), sy(0));
      ctx.lineTo(sx(ax), sy(ay));
      ctx.lineTo(sx(ax + bx), sy(ay + by));
      ctx.lineTo(sx(bx), sy(by));
      ctx.closePath();
      const col = D >= 0 ? C.v : C.orange;
      ctx.fillStyle = alpha(col, 0.16);
      ctx.fill();
      ctx.strokeStyle = alpha(col, 0.75);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const cx = sx((ax + bx) / 2), cy = sy((ay + by) / 2);
      if (Math.abs(D) * vp.scale ** 2 > 2600) {
        label(ctx, `det = ${fmt(D, 3)}`, cx, cy, { align: 'center', color: col, font: `600 12.5px ${FONT}` });
      }
    }

    // unit circle → ellipse with singular axes
    if (st.show.circle) {
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx(0), sy(0), vp.scale, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      for (let k = 0; k <= 160; k++) {
        const th = (k / 160) * 2 * Math.PI;
        const [x, y] = apply(m, Math.cos(th), Math.sin(th));
        if (k === 0) ctx.moveTo(sx(x), sy(y)); else ctx.lineTo(sx(x), sy(y));
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const s = svd(m);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      for (let k = 0; k < 2; k++) {
        const ux = k === 0 ? s.U.a : s.U.b, uy = k === 0 ? s.U.c : s.U.d;
        const r = s.sigma[k];
        ctx.beginPath();
        ctx.moveTo(sx(-r * ux), sy(-r * uy));
        ctx.lineTo(sx(r * ux), sy(r * uy));
        ctx.stroke();
        if (r * vp.scale > 30) {
          ctx.save();
          ctx.setLineDash([]);
          label(ctx, `σ${sub(k + 1)}`, sx(r * ux) + 6, sy(r * uy) - 10, { color: C.cyan, font: `italic 13px ${MATH}`, bg: null });
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // eigen-directions: invariant lines through the origin
    if (st.show.eigen) {
      const e = eigen(m);
      if (e.kind !== 'complex' && !(e.kind === 'repeated' && e.scalar)) {
        e.vectors.forEach((v, k) => {
          const seg = clipLine(0, 0, v[0], v[1], b);
          if (!seg) return;
          ctx.save();
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = alpha(C.eig, 0.7);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sx(seg[0]), sy(seg[1]));
          ctx.lineTo(sx(seg[2]), sy(seg[3]));
          ctx.stroke();
          ctx.restore();
          // place the label near the edge in the direction of v
          const reach = Math.min(Math.abs(seg[2]) > 1e-9 || Math.abs(seg[3]) > 1e-9 ? Math.hypot(seg[2], seg[3]) : 1, 1e9);
          const r = Math.max(0.6, reach * 0.82);
          const lx = sx(v[0] * r), ly = sy(v[1] * r);
          label(ctx, `λ${e.vectors.length > 1 ? sub(k + 1) : ''} = ${fmt(e.values[k], 3)}`, lx, ly, { align: 'center', color: C.eig, border: alpha(C.eig, 0.35) });
        });
      }
    }

    // test vector v and its image
    if (st.show.vector) {
      const [vx, vy] = st.v;
      const [wx, wy] = apply(m, vx, vy);
      if (st.show.orbit) drawOrbit(ctx);
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.3)';
      ctx.beginPath();
      ctx.moveTo(sx(vx), sy(vy));
      ctx.lineTo(sx(wx), sy(wy));
      ctx.stroke();
      ctx.restore();
      arrow(ctx, sx(0), sy(0), sx(vx), sy(vy), { color: alpha(C.cyan, 0.45), width: 2 });
      arrow(ctx, sx(0), sy(0), sx(wx), sy(wy), { color: C.cyan, width: 2.6, halo: 5 });
      handle(ctx, sx(vx), sy(vy), C.cyan, { active: st.drag === 'v' || st.hover === 'v', r: 5.5 });
      label(ctx, 'v', sx(vx) + 9, sy(vy) - 11, { color: C.cyan, font: `italic 15px ${MATH}`, bg: null });
      label(ctx, st.t < 1 ? 'A(t)v' : 'Av', sx(wx) + 9, sy(wy) - 11, { color: C.cyan, font: `italic 15px ${MATH}`, bg: null });
    }

    // basis vectors (columns of M)
    const [ix, iy] = apply(m, 1, 0), [jx, jy] = apply(m, 0, 1);
    arrow(ctx, sx(0), sy(0), sx(ix), sy(iy), { color: C.i, width: 3, head: 13, halo: 6 });
    arrow(ctx, sx(0), sy(0), sx(jx), sy(jy), { color: C.j, width: 3, head: 13, halo: 6 });
    handle(ctx, sx(ix), sy(iy), C.i, { active: st.drag === 'i' || st.hover === 'i' });
    handle(ctx, sx(jx), sy(jy), C.j, { active: st.drag === 'j' || st.hover === 'j' });
    const lab = (txt, x, y, col, dx, dy) => label(ctx, txt, sx(x) + dx, sy(y) + dy, { color: col, font: `600 12px ${FONT}`, border: alpha(col, 0.3) });
    const off = (x, y) => {
      const n = Math.hypot(x, y) || 1;
      return [(x / n) * 16 + 4, (-y / n) * 16 - 4];
    };
    const [oix, oiy] = off(ix, iy), [ojx, ojy] = off(jx, jy);
    const nm = st.t < 1 ? 'A(t)' : 'A';
    lab(`${nm}î ${fmtVec(ix, iy)}`, ix, iy, C.i, oix, oiy);
    lab(`${nm}ĵ ${fmtVec(jx, jy)}`, jx, jy, C.j, ojx, ojy);

    // origin
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), 3, 0, 2 * Math.PI);
    ctx.fillStyle = C.text;
    ctx.fill();

    updateOverlay(m);
  }

  function drawTransformedGrid(ctx, m, b) {
    const D = det(m);
    const c1 = apply(m, 1, 0), c2 = apply(m, 0, 1);
    const n1 = Math.hypot(...c1), n2 = Math.hypot(...c2);
    let step = niceStep(vp.scale).step;
    // spacing (px) between neighbouring image lines of each family; widen the step if too dense
    const spacing = () => Math.min(n2 > 1e-12 ? (Math.abs(D) / n2) * step : 0, n1 > 1e-12 ? (Math.abs(D) / n1) * step : 0) * vp.scale;
    for (let guard = 0; guard < 8 && Math.abs(D) > 1e-9 && spacing() < 9; guard++) step *= 2;
    const inv = inverse(m);
    const corners = [[b.xmin, b.ymin], [b.xmax, b.ymin], [b.xmin, b.ymax], [b.xmax, b.ymax]];
    const range = (comp) => {
      if (!inv) return [-40, 40];
      const vals = corners.map(([x, y]) => apply(inv, x, y)[comp] / step);
      const lo = Math.floor(Math.min(...vals)), hi = Math.ceil(Math.max(...vals));
      return [Math.max(lo, -400), Math.min(hi, 400)];
    };
    const pad = { xmin: b.xmin - 1 / vp.scale, xmax: b.xmax + 1 / vp.scale, ymin: b.ymin - 1 / vp.scale, ymax: b.ymax + 1 / vp.scale };
    const families = [
      { k: range(0), base: c1, dir: c2 }, // images of vertical lines x = k·step
      { k: range(1), base: c2, dir: c1 }, // images of horizontal lines y = k·step
    ];
    const lines = [[], []]; // regular, axis
    for (const f of families) {
      if (Math.hypot(...f.dir) < 1e-12) continue;
      for (let k = f.k[0]; k <= f.k[1]; k++) {
        const seg = clipLine(k * step * f.base[0], k * step * f.base[1], f.dir[0], f.dir[1], pad);
        if (seg) lines[k === 0 ? 1 : 0].push(seg);
      }
    }
    ctx.save();
    ctx.lineWidth = 1.15;
    ctx.strokeStyle = 'rgba(122, 162, 255, 0.36)';
    ctx.beginPath();
    for (const s of lines[0]) { ctx.moveTo(vp.sx(s[0]), vp.sy(s[1])); ctx.lineTo(vp.sx(s[2]), vp.sy(s[3])); }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(160, 190, 255, 0.85)';
    ctx.beginPath();
    for (const s of lines[1]) { ctx.moveTo(vp.sx(s[0]), vp.sy(s[1])); ctx.lineTo(vp.sx(s[2]), vp.sy(s[3])); }
    ctx.stroke();
    ctx.restore();
  }

  function drawOrbit(ctx) {
    const pts = [];
    let [x, y] = st.v;
    for (let k = 0; k <= st.orbitN; k++) {
      pts.push([x, y]);
      [x, y] = apply(st.A, x, y);
      if (!Number.isFinite(x) || Math.hypot(x, y) > 1e7) break;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(vp.sx(px), vp.sy(py)) : ctx.moveTo(vp.sx(px), vp.sy(py))));
    ctx.stroke();
    pts.forEach(([px, py], k) => {
      ctx.beginPath();
      ctx.arc(vp.sx(px), vp.sy(py), k === 0 ? 3 : 3.2, 0, 2 * Math.PI);
      ctx.fillStyle = alpha(C.cyan, 0.9 - (0.6 * k) / Math.max(1, pts.length));
      ctx.fill();
      if (k > 0 && k <= 6) label(ctx, `A${k === 1 ? '' : ['²', '³', '⁴', '⁵', '⁶'][k - 2]}v`, vp.sx(px) + 6, vp.sy(py) + 10, { color: alpha(C.cyan, 0.8), font: `italic 12px ${MATH}`, bg: null });
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------ overlay & readouts
  function updateOverlay(m) {
    const D = det(m);
    overlay.innerHTML = '';
    overlay.append(
      h('div', { class: 'title' }, st.t < 1 ? `动画中  t = ${fmt(st.t, 2)}` : '当前矩阵 A'),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { style: { fontFamily: MATH, fontStyle: 'italic', fontSize: '16px' } }, st.t < 1 ? 'A(t) =' : 'A ='),
        h('div', { class: 'mini-matrix' },
          h('span', { style: { color: C.i } }, fmt(m.a, 2)), h('span', { style: { color: C.j } }, fmt(m.b, 2)),
          h('span', { style: { color: C.i } }, fmt(m.c, 2)), h('span', { style: { color: C.j } }, fmt(m.d, 2)))),
      h('div', { class: 'big', style: { marginTop: '8px', color: D >= 0 ? C.v : C.orange } }, `det = ${fmt(D, 3)}`));
  }

  // ------------------------------------------------------------------ interaction
  const hitTest = (px, py) => {
    const m = M();
    const cand = [];
    if (st.show.vector) cand.push(['v', st.v[0], st.v[1]]);
    cand.push(['i', ...apply(m, 1, 0)], ['j', ...apply(m, 0, 1)]);
    let best = null, bd = 14;
    for (const [id, x, y] of cand) {
      const d = Math.hypot(vp.sx(x) - px, vp.sy(y) - py);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  };
  const snap = (x, e) => {
    if (!e.shiftKey) return x;
    const s = niceStep(vp.scale).minor;
    return Math.round(x / s) * s;
  };
  const detach = attachPointer(layer.canvas, vp, {
    hitTest,
    onDragStart(hd) {
      st.drag = hd;
      hint.style.opacity = 0;
      if (hd !== 'v' && st.t < 1) { stopAnim(); st.t = 1; tSlider.set(1); }
    },
    onDrag(hd, x, y, e) {
      x = snap(x, e); y = snap(y, e);
      if (hd === 'v') st.v = [x, y];
      else if (hd === 'i') st.A = mat(x, st.A.b, y, st.A.d);
      else if (hd === 'j') st.A = mat(st.A.a, x, st.A.c, y);
      if (hd !== 'v') matrixChanged({ fromDrag: true });
      requestRender();
    },
    onDragEnd() { st.drag = null; requestRender(); syncQuery(); },
    onHover(px, py, x, y, hit) {
      if (st.hover !== hit) { st.hover = hit; requestRender(); }
    },
    onLeave() { if (st.hover) { st.hover = null; requestRender(); } },
    onView: () => { hint.style.opacity = 0; requestRender(); },
  });

  const stopResize = observeSize(stage, (w, hh) => {
    const first = vp.w <= 1;
    layer.resize(w, hh);
    vp.setSize(w, hh);
    if (first) vp.fit(-4.2, 4.2, -3, 3, 0);
    render();
  });

  // ------------------------------------------------------------------ animation
  const anim = { from: 0, to: 1, t0: 0, dur: 1.6 };
  const loop = animationLoop((dt, now) => {
    const s = Math.min(1, (now - anim.t0) / (anim.dur * 1000));
    st.t = anim.from + (anim.to - anim.from) * easeInOut(s);
    tSlider.set(st.t);
    render();
    if (s >= 1) { loop.stop(); playBtn.querySelector('span').textContent = '播放变换'; }
  });
  function play() {
    if (loop.running) { stopAnim(); return; }
    anim.from = st.t >= 0.999 ? 0 : st.t;
    anim.to = 1;
    anim.dur = 1.8 * (1 - anim.from) + 0.2;
    anim.t0 = performance.now();
    st.t = anim.from;
    playBtn.querySelector('span').textContent = '暂停';
    loop.start();
  }
  function stopAnim() {
    loop.stop();
    playBtn.querySelector('span').textContent = '播放变换';
  }

  // ------------------------------------------------------------------ panel
  const cells = ['a', 'b', 'c', 'd'].map((k) => {
    const inp = h('input', { class: `num-input ${k === 'a' || k === 'c' ? 'col-i' : 'col-j'}`, type: 'text', id: `m-${k}`, 'aria-label': `矩阵元素 ${k}`, spellcheck: 'false' });
    inp.addEventListener('input', () => {
      try {
        const v = evalConstant(inp.value);
        if (!Number.isFinite(v)) throw new Error('not finite');
        inp.classList.remove('invalid');
        st.A = { ...st.A, [k]: v };
        stopAnim();
        st.t = 1;
        tSlider.set(1);
        matrixChanged({ fromInput: k });
        requestRender();
      } catch {
        inp.classList.add('invalid');
      }
    });
    inp.addEventListener('blur', () => { inp.classList.remove('invalid'); inp.value = fmt(st.A[k], 4); syncQuery(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 1 : 0.1);
        inp.value = fmt(st.A[k] + d, 4);
        inp.dispatchEvent(new Event('input'));
      }
    });
    return inp;
  });

  const presetChips = chips({ items: PRESETS.map((p) => ({ id: p.id, label: p.label })), onPick: (id) => setMatrix(PRESETS.find((p) => p.id === id).m, true) });

  const playBtn = button({ label: '播放变换', iconName: 'play', variant: 'primary', onClick: play, id: 'play-transform' });
  const tSlider = slider({ label: '变换进度 <span class="math">t</span>', min: 0, max: 1, step: 0.001, value: st.t, format: (v) => fmt(v, 2), id: 't-slider', onInput: (v) => { stopAnim(); st.t = v; requestRender(); } });
  const modeSeg = segmented({
    options: [{ value: 'linear', label: '线性插值', title: '(1 − t)I + tA' }, { value: 'polar', label: '极分解插值', title: 'R(tθ)·((1 − t)I + tP)，旋转部分刚性转动' }],
    value: st.mode,
    onChange: (v) => { st.mode = v; requestRender(); },
  });

  const tg = (key, labelText, swatch) => toggle({ label: labelText, value: st.show[key], swatch, id: `show-${key}`, onChange: (v) => { st.show[key] = v; orbitSlider.el.style.display = st.show.orbit ? '' : 'none'; requestRender(); } });
  const orbitSlider = slider({ label: '迭代次数 <span class="math">n</span>', min: 1, max: 60, step: 1, value: st.orbitN, format: (v) => String(v), onInput: (v) => { st.orbitN = v; requestRender(); } });
  orbitSlider.el.style.display = 'none';

  const props = readout([
    ['det', 'det <span class="math">A</span>'],
    ['tr', 'tr <span class="math">A</span>'],
    ['rank', '秩'],
    ['char', '特征多项式'],
    ['eig', '特征值'],
    ['vec', '特征向量'],
    ['sv', '奇异值 σ₁, σ₂'],
    ['cond', '条件数 κ'],
    ['inv', '逆矩阵'],
  ], { id: 'matrix-props' });
  const tagsEl = h('div', { class: 'tags', id: 'matrix-tags' });

  panel.append(
    section('矩阵', [
      h('div', { class: 'matrix-editor' },
        h('span', { class: 'name' }, 'A ='),
        h('div', { class: 'matrix-bracket' }, cells)),
      h('div', { class: 'hint', html: '第一列（绿）是 î 的像，第二列（红）是 ĵ 的像。可输入表达式，如 <code>cos(pi/6)</code>；<kbd>↑</kbd><kbd>↓</kbd> 微调，按住 <kbd>Shift</kbd> 拖动吸附网格。' }),
      h('div', { class: 'btn-row' },
        button({ label: '转置', small: true, onClick: () => setMatrix(transpose(st.A)), title: 'Aᵀ' }),
        button({ label: '求逆', small: true, id: 'btn-inverse', onClick: () => { const I = inverse(st.A); if (I) setMatrix(I); else toast('矩阵奇异（det = 0），不可逆'); }, title: 'A⁻¹' }),
        button({ label: '平方', small: true, onClick: () => setMatrix(mul(st.A, st.A)), title: 'A²' }),
        button({ label: '单位阵', small: true, onClick: () => setMatrix(IDENTITY, true), title: 'I' })),
    ]),
    section('预设', [presetChips.el]),
    section('变换动画', [
      h('div', { class: 'btn-row' }, playBtn),
      tSlider.el,
      modeSeg.el,
      h('div', { class: 'hint' }, '线性插值沿 (1 − t)I + tA 走直线，特征方向全程不变；极分解插值把 A = R·P 的旋转部分 R 刚性转过去，行列式始终为正。'),
    ]),
    section('显示', [
      h('div', { class: 'toggles two' },
        tg('grid', '变换后网格', C.accent).el,
        tg('original', '原始网格', '#475569').el,
        tg('square', '单位正方形', C.v).el,
        tg('circle', '单位圆 → 椭圆', C.cyan).el,
        tg('eigen', '特征方向', C.eig).el,
        tg('vector', '向量 v', C.cyan).el,
        tg('orbit', '迭代轨道 Aⁿv', '#67e8f9').el),
      orbitSlider.el,
    ]),
    section('性质', [props.el, tagsEl], { aside: '实时计算' }),
  );

  function setMatrix(A, animate = false) {
    st.A = mat(A.a, A.b, A.c, A.d);
    matrixChanged();
    syncQuery();
    if (animate) { st.t = 0; play(); } else { stopAnim(); st.t = 1; tSlider.set(1); requestRender(); }
  }

  function matrixChanged({ fromInput = null } = {}) {
    const A = st.A;
    ['a', 'b', 'c', 'd'].forEach((k, n) => {
      if (k !== fromInput && document.activeElement !== cells[n]) cells[n].value = fmt(A[k], 4);
    });
    const match = PRESETS.find((p) => Math.abs(p.m.a - A.a) + Math.abs(p.m.b - A.b) + Math.abs(p.m.c - A.c) + Math.abs(p.m.d - A.d) < 1e-9);
    presetChips.set(match ? match.id : null);
    const D = det(A), T = trace(A);
    props.set('det', fmt(D, 4), D < 0 ? 'warn' : '');
    props.set('tr', fmt(T, 4));
    const r = rank(A);
    props.set('rank', String(r), r < 2 ? 'warn' : '');
    const term = (c, s) => (Math.abs(c) < 1e-12 ? '' : ` ${c < 0 ? '−' : '+'} ${fmt(Math.abs(c), 3) === '1' && s ? '' : fmt(Math.abs(c), 3)}${s}`);
    props.set('char', `λ²${term(-T, 'λ')}${term(D, '')}`);
    const e = eigen(A);
    if (e.kind === 'real') {
      props.set('eig', `λ₁ = ${fmt(e.values[0], 4)}, λ₂ = ${fmt(e.values[1], 4)}`);
      props.set('vec', `${fmtVec(...e.vectors[0], 3)}, ${fmtVec(...e.vectors[1], 3)}`);
    } else if (e.kind === 'repeated') {
      props.set('eig', `λ = ${fmt(e.values[0], 4)}（二重）`);
      props.set('vec', e.scalar ? '任意非零向量' : `${fmtVec(...e.vectors[0], 3)}（仅一条）`);
    } else {
      props.set('eig', `${fmtComplex(e.re, e.im, 4)}, ${fmtComplex(e.re, -e.im, 4)}`);
      props.set('vec', `无实特征向量：|λ| = ${fmt(e.modulus, 4)}，每次转 ${deg(e.angle)}`);
    }
    const s = svd(A);
    props.set('sv', `${fmt(s.sigma[0], 4)}, ${fmt(s.sigma[1], 4)}`);
    props.set('cond', s.sigma[1] > 1e-12 * s.sigma[0] ? fmt(s.sigma[0] / s.sigma[1], 4) : '∞', s.sigma[1] > 1e-12 * s.sigma[0] ? '' : 'bad');
    const I = inverse(A);
    if (I) props.setHTML('inv', `<span class="mini-matrix"><span>${fmt(I.a, 3)}</span><span>${fmt(I.b, 3)}</span><span>${fmt(I.c, 3)}</span><span>${fmt(I.d, 3)}</span></span>`);
    else props.set('inv', '不存在（det = 0）', 'bad');
    tagsEl.textContent = '';
    for (const t of classify(A)) tagsEl.append(h('div', { class: 'tag' }, t));
  }

  function syncQuery() {
    setQuery({ m: [st.A.a, st.A.b, st.A.c, st.A.d].map((v) => +v.toPrecision(6)).join(',') });
  }

  matrixChanged();

  // ------------------------------------------------------------------ public API
  return {
    help: {
      tips: [
        '拖动 <b style="color:#4ade80">绿色</b> / <b style="color:#fb7185">红色</b> 箭头端点：直接设定矩阵的两列，即 î 与 ĵ 的像。',
        '黄色平行四边形是单位正方形的像，其<b>有向面积</b>就是 det A；变为橙色表示 det &lt; 0（定向翻转）。',
        '青色椭圆是单位圆的像，两条虚线半轴长度就是奇异值 σ₁ ≥ σ₂。',
        '紫色虚线是特征方向：这条直线上的向量只被拉伸 λ 倍，不改变方向。',
        '打开“迭代轨道”查看 v, Av, A²v, …：复特征值时轨道呈螺旋，|λ| 决定向内或向外。',
      ],
      keys: [['Space', '播放 / 暂停变换动画'], ['F', '视图复位'], ['Shift + 拖动', '吸附到网格']],
    },
    onKey(e) {
      if (e.key === ' ') { play(); e.preventDefault(); }
      if (e.key === 'f' || e.key === 'F') { vp.fit(-4.2, 4.2, -3, 3, 0); requestRender(); }
    },
    snapshot: () => layer.canvas,
    // test hooks
    state: () => ({ A: { ...st.A }, t: st.t, v: [...st.v], view: vp.state() }),
    setMatrix: (a, b, c, d) => setMatrix(mat(a, b, c, d)),
    worldToClient(x, y) {
      const r = layer.canvas.getBoundingClientRect();
      return [r.left + vp.sx(x), r.top + vp.sy(y)];
    },
    destroy() {
      stopAnim();
      cancelAnimationFrame(raf);
      detach();
      stopResize();
    },
  };
}

export default {
  id: 'matrix',
  title: '矩阵线性变换',
  short: '矩阵',
  subtitle: '把 2×2 矩阵看作平面的变换：网格、行列式、特征方向与奇异值一目了然',
  icon: 'matrix',
  create,
};
