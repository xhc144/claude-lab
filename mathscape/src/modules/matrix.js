// Module 1 — 2×2 matrices as linear transformations of the plane.

import { h, icon } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { Layer, Viewport, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { drawGrid, arrow, label, handle, niceStep, backdrop } from '../ui/draw.js';
import { section, slider, toggle, segmented, button, chips, readout } from '../ui/controls.js';
import { fmt, fmtVec, fmtComplex, deg } from '../ui/format.js';
import { C, FONT, MATH, alpha } from '../ui/theme.js';
import { settings, highPrecision } from '../ui/settings.js';
import { precisionControls } from '../ui/prefs.js';
import { evalConstant, parse, realContext } from '../core/expr.js';
import {
  mat, IDENTITY, det, trace, apply, inverse, eigen, svd, interpolate, rank, classify, transpose, mul, logm, expm, scale,
} from '../core/linalg.js';
import * as B from '../core/bigreal.js';
import { analyze, matPow } from '../core/hpmatrix.js';

const KEYS = ['a', 'b', 'c', 'd'];

// Each preset keeps the source text of its entries, so high precision can evaluate them exactly.
const preset = (id, label, src, extra = {}) => ({ id, label, src, m: mat(...src.map((s) => evalConstant(s))), ...extra });
const PRESETS = [
  preset('rot', '旋转 30°', ['sqrt(3)/2', '-1/2', '1/2', 'sqrt(3)/2']),
  preset('shear', '剪切', ['1', '1', '0', '1']),
  preset('stretch', '拉伸', ['2', '0', '0', '0.5']),
  preset('sym', '对称矩阵', ['2', '1', '1', '2']),
  preset('reflect', '反射', ['0', '1', '1', '0']),
  preset('proj', '投影', ['0.5', '0.5', '0.5', '0.5']),
  preset('singular', '奇异', ['1', '2', '0.5', '1']),
  preset('spiral', '螺旋（复特征值）', ['0.9', '-0.45', '0.45', '0.9']),
  preset('fib', '斐波那契', ['1', '1', '1', '0']),
  preset('flip', 'det < 0', ['1', '2', '3', '4']),
  preset('nearrep', '近重根', ['1', '1', '1e-20', '1'], { hp: true, title: '特征值 1 ± 10⁻¹⁰：双精度把它算成二重根' }),
  preset('illcond', '病态', ['1', '1', '1', '1 + 1e-15'], { hp: true, title: 'det = 10⁻¹⁵，条件数约 4×10¹⁵：双精度的行列式错了 11%' }),
];

const MODES = {
  linear: { label: '线性', title: '(1 − t)I + tA', note: '线性插值沿 (1 − t)I + tA 走直线，特征方向全程不变；det A < 0 时必然经过奇异矩阵。' },
  polar: { label: '极分解', title: 'R(tθ)·((1 − t)I + tP)', note: '极分解插值把 A = R·P 的旋转部分 R 刚性转过去，行列式始终为正。' },
  exp: { label: '指数 Aᵗ', title: 'Aᵗ = exp(t·log A)', note: 'Aᵗ = exp(t·log A) 是经过 A 的单参数群：AˢAᵗ = Aˢ⁺ᵗ，t 取整数时恰好是 Aⁿ，所以 Aᵗv 是连接迭代点 Aⁿv 的光滑曲线。' },
  svd: { label: 'SVD 分步', title: 'A = UΣVᵀ：旋转 → 伸缩 → 旋转', note: '奇异值分解 A = UΣVᵀ 分三步播放：先旋转 Vᵀ，再沿坐标轴伸缩 Σ（单位圆变成椭圆），最后旋转 U。' },
};

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const sub = (k) => '₀₁₂₃₄₅₆₇₈₉'[k];
const PLAIN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const numSrc = (x) => String(Object.is(x, -0) ? 0 : x);

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
    src: { a: '1', b: '1', c: '0', d: '1' }, // source text of each entry (number or expression)
    t: 1,
    mode: 'linear',
    v: [1.4, 0.8],
    show: { grid: true, original: true, square: true, circle: true, eigen: true, vector: true, orbit: false },
    orbitN: 16,
    drag: null,
    hover: null,
  };
  const qx = query.get('x');
  const qm = query.get('m');
  let loaded = false;
  if (qx) {
    const parts = qx.split(';').map((s) => s.trim());
    try {
      const vals = parts.map((s) => evalConstant(s));
      if (parts.length === 4 && vals.every(Number.isFinite)) {
        st.A = mat(...vals);
        KEYS.forEach((k, n) => { st.src[k] = parts[n]; });
        loaded = true;
      }
    } catch { /* fall back to m */ }
  }
  if (!loaded && qm) {
    const parts = qm.split(',').map((s) => s.trim().replace(/ /g, '+'));
    const vals = parts.map(Number);
    if (parts.length === 4 && vals.every(Number.isFinite)) {
      st.A = mat(...vals);
      KEYS.forEach((k, n) => { st.src[k] = PLAIN.test(parts[n]) ? parts[n] : numSrc(vals[n]); });
    }
  }
  if (MODES[query.get('mode')]) st.mode = query.get('mode');

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
      label(ctx, `${matName()}v`, sx(wx) + 9, sy(wy) - 11, { color: C.cyan, font: `italic 15px ${MATH}`, bg: null });
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
    const nm = matName();
    lab(`${nm}î ${fmtVec(ix, iy)}`, ix, iy, C.i, oix, oiy);
    lab(`${nm}ĵ ${fmtVec(jx, jy)}`, jx, jy, C.j, ojx, ojy);

    // origin
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), 3, 0, 2 * Math.PI);
    ctx.fillStyle = C.text;
    ctx.fill();

    updateOverlay(m);
  }

  const hasLog = () => logm(st.A) != null;
  const matName = () => (st.t >= 1 ? 'A' : st.mode === 'exp' && hasLog() ? 'Aᵗ' : 'A(t)');

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
    const L = logm(st.A);
    if (L) {
      // continuous orbit Aᵗv through the iterates (one-parameter group exp(tL))
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const n = pts.length - 1;
      const per = 32;
      for (let k = 0; k <= n * per; k++) {
        const [px, py] = apply(expm(scale(L, k / per)), st.v[0], st.v[1]);
        if (!Number.isFinite(px) || Math.hypot(px, py) > 1e7) break;
        if (k) ctx.lineTo(vp.sx(px), vp.sy(py)); else ctx.moveTo(vp.sx(px), vp.sy(py));
      }
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(vp.sx(px), vp.sy(py)) : ctx.moveTo(vp.sx(px), vp.sy(py))));
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
  function svdPhase() {
    const s = svd(st.A);
    const k = Math.min(2, Math.floor(st.t * 3));
    if (k === 0) return `① 旋转 Vᵀ：转 ${deg(s.theta)}`;
    if (k === 1) return `② 伸缩 Σ：σ₁ = ${fmt(s.sigma[0], 3)}，σ₂ = ${s.flip ? '−' : ''}${fmt(s.sigma[1], 3)}`;
    return `③ 旋转 U：转 ${deg(s.phi)}`;
  }

  function updateOverlay(m) {
    const D = det(m);
    const animating = st.t < 1;
    overlay.textContent = '';
    overlay.append(...[
      h('div', { class: 'title' }, animating ? `${MODES[st.mode].label}  t = ${fmt(st.t, 2)}` : '当前矩阵 A'),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { style: { fontFamily: MATH, fontStyle: 'italic', fontSize: '16px' } }, `${matName()} =`),
        h('div', { class: 'mini-matrix' },
          h('span', { style: { color: C.i } }, fmt(m.a, 2)), h('span', { style: { color: C.j } }, fmt(m.b, 2)),
          h('span', { style: { color: C.i } }, fmt(m.c, 2)), h('span', { style: { color: C.j } }, fmt(m.d, 2)))),
      h('div', { class: 'big', style: { marginTop: '8px', color: D >= 0 ? C.v : C.orange } }, `det = ${fmt(D, 3)}`),
      animating && st.mode === 'svd' ? h('div', { class: 'phase', id: 'svd-phase' }, svdPhase()) : null,
      highPrecision() ? h('div', { class: 'hp-badge' }, `高精度 · ${settings.digits} 位`) : null,
    ].filter(Boolean));
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
  // Dragged entries are rounded to sub-pixel decimals, so the value shown, the URL and the exact
  // (high-precision) value all agree; Shift snaps to the minor grid.
  const clean = (x, step) => Number(x.toFixed(Math.min(20, Math.max(0, 1 - Math.floor(Math.log10(step))))));
  const snap = (x, e) => {
    const s = e.shiftKey ? niceStep(vp.scale).minor : 10 ** Math.floor(Math.log10(0.25 / vp.scale));
    return clean(Math.round(x / s) * s, s) + 0;
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
      else if (hd === 'i') { st.A = mat(x, st.A.b, y, st.A.d); st.src.a = numSrc(x); st.src.c = numSrc(y); }
      else if (hd === 'j') { st.A = mat(st.A.a, x, st.A.c, y); st.src.b = numSrc(x); st.src.d = numSrc(y); }
      if (hd !== 'v') matrixChanged();
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
    st.t = anim.from + (anim.to - anim.from) * (st.mode === 'svd' ? s : easeInOut(s));
    tSlider.set(st.t);
    render();
    if (s >= 1) { loop.stop(); playBtn.querySelector('span').textContent = '播放变换'; }
  });
  function play() {
    if (loop.running) { stopAnim(); return; }
    anim.from = st.t >= 0.999 ? 0 : st.t;
    anim.to = 1;
    // the three SVD steps get more time
    anim.dur = (st.mode === 'svd' ? 3.6 : 1.8) * (1 - anim.from) + 0.2;
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
  const paintCell = (k) => {
    const inp = cells[KEYS.indexOf(k)];
    if (document.activeElement !== inp) inp.value = fmt(st.A[k], 4);
    const expr = !PLAIN.test(st.src[k].replace(/\s+/g, ''));
    inp.classList.toggle('expr', expr);
    inp.title = expr ? `${st.src[k]} = ${st.A[k]}` : st.src[k];
  };
  const cells = KEYS.map((k) => {
    const inp = h('input', { class: `num-input ${k === 'a' || k === 'c' ? 'col-i' : 'col-j'}`, type: 'text', id: `m-${k}`, 'aria-label': `矩阵元素 ${k}`, spellcheck: 'false', autocomplete: 'off' });
    // editing shows the entry's source (e.g. sqrt(3)/2); otherwise the value is shown
    inp.addEventListener('focus', () => { inp.value = st.src[k]; inp.select(); });
    inp.addEventListener('input', () => {
      try {
        const v = evalConstant(inp.value);
        if (!Number.isFinite(v)) throw new Error('not finite');
        inp.classList.remove('invalid');
        st.A = { ...st.A, [k]: v };
        st.src[k] = inp.value.trim();
        stopAnim();
        st.t = 1;
        tSlider.set(1);
        matrixChanged();
        requestRender();
      } catch {
        inp.classList.add('invalid');
      }
    });
    inp.addEventListener('blur', () => { inp.classList.remove('invalid'); inp.value = fmt(st.A[k], 4); paintCell(k); syncQuery(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 1 : 0.1);
        inp.value = fmt(st.A[k] + d, 4);
        inp.dispatchEvent(new Event('input'));
      }
      if (e.key === 'Enter') inp.blur();
    });
    return inp;
  });

  const presetChips = chips({
    id: 'matrix-presets',
    items: PRESETS.map((p) => ({ id: p.id, label: p.hp ? `${p.label} <span class="chip-badge">高精度</span>` : p.label, title: p.title })),
    onPick: (id) => {
      const p = PRESETS.find((q) => q.id === id);
      setMatrix(p.m, true, p.src);
      if (p.hp && !highPrecision()) toast('这个例子要在高精度下看：按 P 或在面板底部开启高精度');
    },
  });

  const playBtn = button({ label: '播放变换', iconName: 'play', variant: 'primary', onClick: play, id: 'play-transform' });
  const tSlider = slider({ label: '变换进度 <span class="math">t</span>', min: 0, max: 1, step: 0.001, value: st.t, format: (v) => fmt(v, 2), id: 't-slider', onInput: (v) => { stopAnim(); st.t = v; requestRender(); } });
  const modeNote = h('div', { class: 'hint', id: 'mode-note' });
  const paintModeNote = () => {
    modeNote.textContent = MODES[st.mode].note;
    if (st.mode === 'exp' && !hasLog()) modeNote.append(h('span', { class: 'warn-text' }, ' 当前 A 没有实对数（det ≤ 0 或有负特征值），暂用极分解插值。'));
  };
  const modeSeg = segmented({
    id: 'anim-mode',
    options: Object.entries(MODES).map(([value, m]) => ({ value, label: m.label, title: m.title })),
    value: st.mode,
    onChange: (v) => { st.mode = v; paintModeNote(); requestRender(); syncQuery(); },
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

  // ---- high precision
  const hpCtl = precisionControls({ idPrefix: 'mx-prec', compact: true });
  const hpStatus = h('span', { class: 'aside', id: 'hp-status' });
  const hpBody = h('div', { class: 'hp-body', id: 'hp-body' });
  const hpPowN = h('input', { class: 'num-input', type: 'text', id: 'hp-pow-n', value: '10', inputmode: 'numeric', 'aria-label': '幂次 n', spellcheck: 'false' });
  const hpPowOut = h('div', { class: 'hp-pow-out', id: 'hp-pow-out' });
  const hpPow = h('div', { class: 'hp-pow' },
    h('div', { class: 'field-row' }, h('span', { class: 'label', html: '精确幂 <span class="math">A<sup>n</sup></span>，<span class="math">n</span> =' }), hpPowN),
    hpPowOut);
  hpPowN.addEventListener('input', () => scheduleHP(250));
  hpPowN.addEventListener('keydown', (e) => e.stopPropagation());
  const hpSection = section('高精度计算', [hpCtl.el, hpBody, hpPow], { aside: hpStatus, id: 'hp-section' });

  panel.append(
    section('矩阵', [
      h('div', { class: 'matrix-editor' },
        h('span', { class: 'name' }, 'A ='),
        h('div', { class: 'matrix-bracket' }, cells)),
      h('div', { class: 'hint', html: '第一列（绿）是 î 的像，第二列（红）是 ĵ 的像。可输入表达式，如 <code>cos(pi/6)</code>、<code>1/3</code>（点开单元格可看到原式）；<kbd>↑</kbd><kbd>↓</kbd> 微调，按住 <kbd>Shift</kbd> 拖动吸附网格。' }),
      h('div', { class: 'btn-row' },
        button({ label: '转置', small: true, onClick: () => setMatrix(transpose(st.A), false, [st.src.a, st.src.c, st.src.b, st.src.d]), title: 'Aᵀ' }),
        button({ label: '求逆', small: true, id: 'btn-inverse', onClick: doInverse, title: 'A⁻¹（有理数元素时精确）' }),
        button({ label: '平方', small: true, onClick: doSquare, title: 'A²' }),
        button({ label: '单位阵', small: true, onClick: () => setMatrix(IDENTITY, true, ['1', '0', '0', '1']), title: 'I' }),
        button({ iconName: 'shuffle', small: true, id: 'btn-random', onClick: randomMatrix, title: '随机整数矩阵' })),
    ]),
    section('预设', [presetChips.el]),
    section('变换动画', [
      h('div', { class: 'btn-row' }, playBtn),
      tSlider.el,
      modeSeg.el,
      modeNote,
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
    section('性质', [props.el, tagsEl], { aside: '双精度 · 实时' }),
    hpSection,
  );

  // ------------------------------------------------------------------ high-precision values
  const hpCache = new Map();
  /** Entry k at W digits: { v, ok } — ok = false when its source could not be evaluated exactly. */
  function hpEntry(k, W) {
    const key = `${st.src[k]}|${W}`;
    let r = hpCache.get(key);
    if (!r) {
      try { r = { v: B.evaluate(parse(st.src[k], realContext([])), W), ok: true }; } catch { r = { v: B.fromNumber(st.A[k]), ok: false }; }
      if (hpCache.size > 200) hpCache.clear();
      hpCache.set(key, r);
    }
    return r;
  }
  const hpMatrix = (W) => {
    const e = KEYS.map((k) => hpEntry(k, W));
    return { M: { a: e[0].v, b: e[1].v, c: e[2].v, d: e[3].v }, fallback: e.some((x) => !x.ok) };
  };
  /** The four entries as exact rationals, or null. */
  function exactEntries() {
    const { M: E, fallback } = hpMatrix(40);
    return !fallback && KEYS.every((k) => B.isExact(E[k])) ? E : null;
  }
  const srcOf = (x, W) => (B.isExact(x) ? B.ratString(x, { ascii: true }) : B.toDecimal(x, W, { ascii: true }));

  function doInverse() {
    const E = exactEntries();
    if (E || highPrecision()) {
      const W = highPrecision() ? settings.digits + B.GUARD : 40;
      const X = E || hpMatrix(W).M;
      const D = B.sub(B.mul(X.a, X.d, W), B.mul(X.b, X.c, W), W);
      if (B.isZero(D) || (!E && !inverse(st.A))) { toast('矩阵奇异（det = 0），不可逆'); return; }
      const inv = [B.div(X.d, D, W), B.div(B.neg(X.b), D, W), B.div(B.neg(X.c), D, W), B.div(X.a, D, W)];
      setMatrix(mat(...inv.map(B.toNumber)), false, inv.map((x) => srcOf(x, W)));
      return;
    }
    const I = inverse(st.A);
    if (I) setMatrix(I); else toast('矩阵奇异（det = 0），不可逆');
  }

  function doSquare() {
    const E = exactEntries();
    if (E || highPrecision()) {
      const W = highPrecision() ? settings.digits + B.GUARD : 40;
      const { entries } = matPow(E || hpMatrix(W).M, 2, W - B.GUARD);
      setMatrix(mat(...entries.map(B.toNumber)), false, entries.map((x) => srcOf(x, W)));
      return;
    }
    setMatrix(mul(st.A, st.A));
  }

  function randomMatrix() {
    let e;
    do e = Array.from({ length: 4 }, () => Math.floor(Math.random() * 7) - 3);
    while (e[0] * e[3] - e[1] * e[2] === 0);
    setMatrix(mat(...e), true, e.map(String));
  }

  // ------------------------------------------------------------------ high-precision panel
  const expanded = new Set();
  let hpTimer = 0;
  let hpDirty = true;
  let lastHP = null;

  function scheduleHP(delay = 140) {
    hpDirty = true;
    clearTimeout(hpTimer);
    hpTimer = setTimeout(renderHP, delay);
  }

  const copyBtn = (text, what) => {
    const b = h('button', { type: 'button', class: 'mini-btn', title: `复制${what}` }, icon(ICONS.copy));
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); toast(`已复制${what}`); } catch { toast('无法访问剪贴板'); }
    });
    return b;
  };

  /** A long number: clamped to a few lines with “展开” and a copy button. */
  function bigNum(text, key, { copy = text, what = '数值', prefix = null } = {}) {
    const LIMIT = 20000;
    const shown = text.length > LIMIT ? `${text.slice(0, LIMIT)} …（共 ${text.length} 个字符，复制可得完整结果）` : text;
    const long = text.length > 84;
    const body = h('div', { class: `bignum${long && !expanded.has(key) ? ' clamped' : ''}` }, prefix ? h('span', { class: 'pre' }, prefix) : null, shown);
    const tools = h('div', { class: 'bigtools' }, copyBtn(copy, what));
    if (long) {
      const more = h('button', { type: 'button', class: 'mini-btn text' }, expanded.has(key) ? '收起' : '展开');
      more.addEventListener('click', () => {
        if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
        const open = expanded.has(key);
        body.classList.toggle('clamped', !open);
        more.textContent = open ? '收起' : '展开';
      });
      tools.append(more);
    }
    return h('div', { class: 'bigwrap' }, body, tools);
  }

  const P_ = () => settings.digits;
  const decimal = (x) => B.toDecimal(x, P_(), { group: 5 });
  const ascii = (x) => B.toDecimal(x, P_(), { ascii: true });
  /** Exact rational (plus its decimal expansion) or P-digit decimal, as bigNum blocks. */
  function valueBlock(x, key, name = '', pm = false) {
    const lead = (rel) => `${name ? `${name} ` : ''}${rel}${pm ? ' ±' : ''}`;
    if (B.isExact(x)) {
      const fr = B.ratString(x);
      const q = bigNum(fr, `${key}-q`, { prefix: lead('='), copy: B.ratString(x, { ascii: true }), what: '精确值' });
      if (x.d === 1n || fr.length > 60) return q;
      return h('div', null, q, bigNum(decimal(x), key, { prefix: lead('≈'), copy: ascii(x) }));
    }
    return bigNum(decimal(x), key, { prefix: lead('≈'), copy: ascii(x) });
  }

  const row = (labelHtml, ...content) => h('div', { class: 'hp-row' }, h('div', { class: 'hp-label', html: labelHtml }), ...content);
  const formEl = (text) => (text && text.length <= 110 ? h('div', { class: 'hp-form' }, text) : text ? h('div', { class: 'hint' }, '（根式很长，从略）') : null);

  /** Agreement between a double and the high-precision value: correct significant digits. */
  function agreement(f, x) {
    if (!Number.isFinite(f)) return 0;
    const W = 30;
    const diff = B.abs(B.sub(B.fromNumber(f), x, W));
    if (B.isZero(diff)) return Infinity;
    const scaleRef = B.isZero(x) ? B.ONE : B.abs(x);
    const rel = B.toNumber(B.div(diff, scaleRef, W));
    return Math.max(0, -Math.log10(rel));
  }

  function renderHP() {
    clearTimeout(hpTimer);
    hpBody.textContent = '';
    hpPow.style.display = highPrecision() ? '' : 'none';
    if (!highPrecision()) {
      hpStatus.textContent = '未开启';
      hpStatus.className = 'aside';
      hpBody.append(h('div', { class: 'hint', html: '开启后：有理数元素按分数<b>精确</b>运算；特征值、特征向量、奇异值与条件数给出<b>根式</b>；小数展开到所选位数（最高 1000 位）；可精确计算 A<sup>n</sup>；并逐项对比双精度结果还剩几位正确。试试预设里的“近重根”和“病态”。' }));
      lastHP = null;
      hpDirty = false;
      return;
    }
    if (hpSection.classList.contains('collapsed')) { hpDirty = true; return; }
    const t0 = performance.now();
    const P = P_();
    const W = P + B.GUARD;
    const { M: X, fallback } = hpMatrix(W);
    let r;
    try {
      r = analyze(X, P);
    } catch (e) {
      hpBody.append(h('div', { class: 'note' }, `高精度计算失败：${e.message}`));
      return;
    }
    lastHP = r;
    hpStatus.textContent = r.exact ? `精确 · ${P} 位` : `${P} 位近似`;
    hpStatus.className = `aside ${r.exact ? 'exact' : ''}`;

    const list = h('div', { class: 'hp-list' });
    list.append(h('div', { class: `hp-mode ${r.exact ? 'exact' : ''}` },
      r.exact
        ? '四个元素都是有理数：下面的分数与根式是精确值，小数为四舍五入到所选位数的展开。'
        : `元素含无理数（如 √3、π），以下为 ${P} 位有效数字的近似值。`,
      fallback ? h('span', { class: 'warn-text' }, ' 有元素无法高精度求值，按双精度值处理。') : null));

    list.append(row('det <span class="math">A</span>', valueBlock(r.det, 'det')));
    list.append(row('tr <span class="math">A</span>', valueBlock(r.trace, 'tr')));
    if (r.polyForm) list.append(row('特征多项式', formEl(r.polyForm)));

    const e = r.eig;
    const eigRow = row('特征值', formEl(r.eigForm));
    if (e.kind === 'complex') {
      eigRow.append(
        valueBlock(e.re, 'eig-re', 'Re λ'),
        valueBlock(e.im, 'eig-im', 'Im λ', true),
        valueBlock(e.modulus, 'eig-mod', '|λ|'),
        valueBlock(e.angleDeg, 'eig-arg', '辐角（度）'));
    } else if (e.kind === 'repeated') {
      if (!r.eigForm) eigRow.append(valueBlock(e.values[0], 'eig1', 'λ'));
      eigRow.append(h('div', { class: 'hint' }, e.scalar ? 'A = λI：任意非零向量都是特征向量。' : '只有一条特征方向（不可对角化）。'));
    } else {
      eigRow.append(valueBlock(e.values[0], 'eig1', 'λ₁'), valueBlock(e.values[1], 'eig2', 'λ₂'));
    }
    list.append(eigRow);
    if (r.vecForm) list.append(row('特征向量', formEl(r.vecForm)));
    list.append(row('奇异值',
      r.sigmaForm ? formEl(`σ₁ = ${r.sigmaForm[0]}，σ₂ = ${r.sigmaForm[1]}`) : null,
      valueBlock(r.sigma[0], 'sv1', 'σ₁'), valueBlock(r.sigma[1], 'sv2', 'σ₂')));
    list.append(row('条件数 κ = σ₁/σ₂', r.kappa ? [formEl(r.kappaForm ? `κ = ${r.kappaForm}` : null), valueBlock(r.kappa, 'kappa', 'κ')] : h('div', { class: 'hp-form bad' }, '∞（矩阵奇异）')));
    if (r.inverse) {
      // fractions while they stay short, otherwise 20-digit decimals
      const inv = r.inverse.map((x, k) => (r.inverseForm && r.inverseForm[k].length <= 24 ? r.inverseForm[k] : B.toDecimal(x, Math.min(P, 20))));
      list.append(row('逆矩阵', h('div', { class: 'hp-mat' }, inv.map((s) => h('span', null, s)))));
    } else {
      list.append(row('逆矩阵', h('div', { class: 'hp-form bad' }, '不存在（det = 0）')));
    }
    hpBody.append(list);

    // ---- double precision vs high precision
    const fe = eigen(st.A);
    const fs = svd(st.A);
    const cmpRows = [];
    const add = (name, f, x) => {
      const d = agreement(f, x);
      cmpRows.push({ name, f, d });
    };
    add('det A', det(st.A), r.det);
    let kindNote = null;
    const KIND = { real: '两个不同实根', repeated: '二重根', complex: '一对共轭复根' };
    if (fe.kind !== e.kind) {
      kindNote = `双精度把特征值判成了「${KIND[fe.kind]}」，实际是「${KIND[e.kind]}」。`;
    } else if (e.kind === 'real') {
      add('λ₁', fe.values[0], e.values[0]);
      add('λ₂', fe.values[1], e.values[1]);
    } else if (e.kind === 'complex') {
      add('Re λ', fe.re, e.re);
      add('Im λ', fe.im, e.im);
    } else {
      add('λ', fe.values[0], e.values[0]);
    }
    add('σ₁', fs.sigma[0], r.sigma[0]);
    add('σ₂', fs.sigma[1], r.sigma[1]);
    const worst = kindNote ? 0 : Math.min(...cmpRows.map((c) => c.d));
    const cls = (d) => (d >= 12 ? 'good' : d >= 6 ? 'warn' : 'bad');
    const digitsText = (d) => (d === Infinity ? '完全一致' : `${fmt(Math.min(d, 17), 1)} 位`);
    const summary = kindNote
      ? h('div', { class: 'hp-summary bad', id: 'hp-summary' }, kindNote)
      : h('div', { class: `hp-summary ${cls(worst)}`, id: 'hp-summary' },
        worst >= 15 ? '双精度在这里几乎没有损失（约 16 位都正确）。'
          : worst >= 6 ? `双精度结果最少只有 ${digitsText(worst)}正确。`
            : `双精度结果最少只有 ${digitsText(worst)}正确：这个矩阵是病态的，舍入误差被放大了。`);
    const table = h('div', { class: 'hp-cmp', id: 'hp-cmp' },
      h('div', { class: 'th' }, '量'), h('div', { class: 'th' }, '双精度结果'), h('div', { class: 'th' }, '正确位数'),
      cmpRows.flatMap((c) => [
        h('div', null, c.name),
        h('div', { class: 'mono' }, Number.isFinite(c.f) ? c.f.toPrecision(17).replace('-', '−') : '—'),
        h('div', { class: `mono ${cls(c.d)}` }, digitsText(c.d)),
      ]));
    hpBody.append(h('div', { class: 'hp-sub' }, '与双精度对比'), summary, table);

    // ---- exact powers
    renderPow(X);
    hpBody.append(h('div', { class: 'hint hp-time' }, `计算用时 ${fmt(performance.now() - t0, 1)} ms`));
    hpDirty = false;
  }

  function renderPow(X) {
    hpPowOut.textContent = '';
    const n = Number(hpPowN.value.trim());
    if (!Number.isInteger(n) || Math.abs(n) > 1000000) {
      hpPowN.classList.add('invalid');
      hpPowOut.append(h('div', { class: 'hint' }, 'n 需为整数，|n| ≤ 1000000。'));
      return;
    }
    hpPowN.classList.remove('invalid');
    let res;
    const t0 = performance.now();
    try { res = matPow(X, n, P_()); } catch (e) { hpPowOut.append(h('div', { class: 'note' }, e.message)); return; }
    const ms = performance.now() - t0;
    const texts = res.entries.map((x) => (res.exact ? B.ratString(x) : decimal(x)));
    const asciiTexts = res.entries.map((x) => (res.exact ? B.ratString(x, { ascii: true }) : ascii(x)));
    const longest = Math.max(...res.entries.map((x) => (res.exact ? B.ndigits(x.n) : 0)));
    hpPowOut.append(
      h('div', { class: 'hp-pow-grid' }, texts.map((t, k) => bigNum(t, `pow-${k}`, { copy: asciiTexts[k], what: `第 ${k + 1} 个元素` }))),
      h('div', { class: 'hint' },
        res.exact ? `精确结果（整数 / 分数）· 分子最长 ${longest} 位 · ${fmt(ms, 1)} ms` : `${P_()} 位有效数字（元素含无理数或结果过大）· ${fmt(ms, 1)} ms`),
      h('div', { class: 'btn-row' }, (() => {
        const b = button({ label: '复制 Aⁿ（JSON）', iconName: 'copy', small: true });
        b.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(JSON.stringify([[asciiTexts[0], asciiTexts[1]], [asciiTexts[2], asciiTexts[3]]])); toast('已复制'); } catch { toast('无法访问剪贴板'); }
        });
        return b;
      })()));
  }

  // compute when the folded section is opened again
  hpSection.querySelector('.section-toggle')?.addEventListener('click', () => { if (hpDirty) setTimeout(renderHP, 0); });

  // ------------------------------------------------------------------ state changes
  function setMatrix(A, animate = false, src = null) {
    st.A = mat(A.a, A.b, A.c, A.d);
    KEYS.forEach((k, n) => { st.src[k] = src ? String(src[n]) : numSrc(st.A[k]); });
    matrixChanged();
    syncQuery();
    if (animate) { st.t = 0; play(); } else { stopAnim(); st.t = 1; tSlider.set(1); requestRender(); }
  }

  function matrixChanged() {
    const A = st.A;
    KEYS.forEach(paintCell);
    const norm = (s) => s.replace(/\s+/g, '');
    const match = PRESETS.find((p) => p.src.every((s, n) => norm(s) === norm(st.src[KEYS[n]])))
      || PRESETS.find((p) => KEYS.every((k) => p.m[k] === A[k]));
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
    paintModeNote();
    scheduleHP();
  }

  function syncQuery() {
    const s = KEYS.map((k) => st.src[k].replace(/\s+/g, ''));
    const mode = st.mode === 'linear' ? null : st.mode;
    if (s.every((x) => PLAIN.test(x))) setQuery({ m: s.join(','), mode });
    else setQuery({ m: KEYS.map((k) => +st.A[k].toPrecision(6)).join(','), x: s.join(';'), mode });
  }

  matrixChanged();
  renderHP();

  // ------------------------------------------------------------------ public API
  return {
    help: {
      tips: [
        '拖动 <b style="color:#4ade80">绿色</b> / <b style="color:#fb7185">红色</b> 箭头端点：直接设定矩阵的两列，即 î 与 ĵ 的像。',
        '黄色平行四边形是单位正方形的像，其<b>有向面积</b>就是 det A；变为橙色表示 det &lt; 0（定向翻转）。',
        '青色椭圆是单位圆的像，两条虚线半轴长度就是奇异值 σ₁ ≥ σ₂。',
        '紫色虚线是特征方向：这条直线上的向量只被拉伸 λ 倍，不改变方向。',
        '打开“迭代轨道”查看 v, Av, A²v, …；A 有实对数时还会画出连接它们的连续曲线 Aᵗv。',
        '变换动画有四种路径：线性、极分解、指数 Aᵗ、SVD 分步（旋转 → 伸缩 → 旋转）。',
        '开启<b>高精度</b>（快捷键 P）后，面板底部给出精确分数、根式、任意位数的小数和 Aⁿ 精确幂，并标出双精度结果还剩几位正确。',
      ],
      keys: [['Space', '播放 / 暂停变换动画'], ['F', '视图复位'], ['Shift + 拖动', '吸附到网格']],
    },
    onKey(e) {
      if (e.key === ' ') { play(); e.preventDefault(); }
      if (e.key === 'f' || e.key === 'F') { vp.fit(-4.2, 4.2, -3, 3, 0); requestRender(); }
    },
    onSettings() {
      renderHP();
      requestRender();
    },
    snapshot: () => layer.canvas,
    // test hooks
    state: () => ({ A: { ...st.A }, M: M(), src: { ...st.src }, t: st.t, v: [...st.v], mode: st.mode, view: vp.state() }),
    hp: () => (lastHP ? {
      exact: lastHP.exact,
      eigKind: lastHP.eig.kind,
      eigForm: lastHP.eigForm ?? null,
      values: lastHP.eig.kind === 'complex' ? [] : lastHP.eig.values.map((x) => B.toDecimal(x, settings.digits, { ascii: true })),
      det: B.toDecimal(lastHP.det, settings.digits, { ascii: true }),
    } : null),
    renderHP,
    setMatrix: (a, b, c, d) => setMatrix(mat(a, b, c, d)),
    worldToClient(x, y) {
      const r = layer.canvas.getBoundingClientRect();
      return [r.left + vp.sx(x), r.top + vp.sy(y)];
    },
    destroy() {
      stopAnim();
      clearTimeout(hpTimer);
      cancelAnimationFrame(raf);
      detach();
      stopResize();
      hpCtl.destroy();
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
