// ODE module, 3D view — strange attractors of x' = f, y' = g, z' = h, with an orbit camera,
// several trajectories started a tiny distance apart (sensitive dependence on initial
// conditions), their separation on a log scale, and a Benettin estimate of the largest
// Lyapunov exponent.

import { h } from '../ui/dom.js';
import { Layer, observeSize, animationLoop } from '../ui/canvas.js';
import { section, slider, toggle, button, chips, exprField } from '../ui/controls.js';
import { fmt } from '../ui/format.js';
import { C, FONT, MONO, MATH } from '../ui/theme.js';
import { realFunction } from '../core/expr.js';
import { rk4Step, rk4Work, largestLyapunov } from '../core/ode.js';

const VARS = ['x', 'y', 'z', 't', 'a', 'b', 'c', 'd'];
const COLORS = ['#ffb454', '#5ccfe6', '#f472b6', '#bae67e', '#d4bfff', '#ffd580'];

export const PRESETS_3D = [
  {
    id: 'lorenz', label: '洛伦茨', f: 'a(y - x)', g: 'x(b - z) - y', h: 'x y - c z', dt: 0.004, ic: [1, 1, 1],
    params: { a: { v: 10, min: 0.1, max: 30, label: 'σ' }, b: { v: 28, min: 0.1, max: 120, label: 'ρ' }, c: { v: 8 / 3, min: 0.1, max: 10, label: 'β' } },
    note: 'Lorenz (1963) 的大气对流简化模型。σ = 10, ρ = 28, β = 8/3 时出现著名的蝴蝶形奇怪吸引子，最大李雅普诺夫指数约 0.906。ρ < 24.74 时轨线落入两个稳定平衡点之一。',
  },
  {
    id: 'rossler', label: '罗斯勒', f: '-y - z', g: 'x + a y', h: 'b + z(x - c)', dt: 0.01, ic: [1, 1, 0],
    params: { a: { v: 0.2, min: 0, max: 0.5, label: 'a' }, b: { v: 0.2, min: 0.01, max: 2, label: 'b' }, c: { v: 5.7, min: 1, max: 14, label: 'c' } },
    note: 'Rössler (1976)：只有一个非线性项 zx 的混沌系统，轨线在平面上螺旋外扩，再被“折叠”回中心。把 c 从 2 调到 6 可以看到倍周期分岔通向混沌。',
  },
  {
    id: 'thomas', label: '托马斯', f: 'sin(y) - a x', g: 'sin(z) - a y', h: 'sin(x) - a z', dt: 0.02, ic: [0.1, 0, 0],
    params: { a: { v: 0.208186, min: 0.05, max: 0.33, label: 'b（耗散）' } },
    note: 'Thomas 的循环对称吸引子：在 x、y、z 轮换下不变。b 越小耗散越弱，b → 0 时成为保守的“混沌游走”。',
  },
  {
    id: 'aizawa', label: '相泽', f: '(z - b) x - d y', g: 'd x + (z - b) y', h: '0.6 + a z - z^3/3 - (x^2 + y^2)(1 + 0.25 z) + 0.1 z x^3', dt: 0.005, ic: [0.1, 0, 0],
    params: { a: { v: 0.95, min: 0.5, max: 1.2, label: 'a' }, b: { v: 0.7, min: 0.3, max: 1.2, label: 'b' }, d: { v: 3.5, min: 1, max: 6, label: 'd' } },
    note: 'Aizawa 吸引子：轨线沿球面状曲面缠绕，再从中央的“管道”穿出。',
  },
  {
    id: 'halvorsen', label: '哈尔沃森', f: '-a x - 4y - 4z - y^2', g: '-a y - 4z - 4x - z^2', h: '-a z - 4x - 4y - x^2', dt: 0.004, ic: [-1.48, -1.51, 2.04],
    params: { a: { v: 1.89, min: 1.2, max: 2.6, label: 'a' } },
    note: 'Halvorsen 吸引子，同样具有 x→y→z→x 的循环对称性。',
  },
  {
    id: 'chen', label: '陈氏', f: 'a(y - x)', g: '(c - a) x - x z + c y', h: 'x y - b z', dt: 0.002, ic: [-10, 0, 37],
    params: { a: { v: 35, min: 20, max: 45, label: 'a' }, b: { v: 3, min: 1, max: 6, label: 'b' }, c: { v: 28, min: 15, max: 32, label: 'c' } },
    note: '陈关荣 (1999) 构造的混沌系统，与洛伦茨系统拓扑上不等价，其吸引子更为“饱满”。',
  },
];

export function createAttractor3D({ stage, panel, query, setQuery, active }) {
  const st = {
    preset: PRESETS_3D[0],
    src: ['', '', ''],
    fns: [null, null, null],
    p: { a: 0, b: 0, c: 0, d: 0 },
    count: 3,
    eps: 1e-3,
    speed: 2,
    trail: 4000,
    t: 0,
    autoRotate: true,
    showAxes: true,
    showChart: true,
    cam: { yaw: -0.7, pitch: 0.35, zoom: 1 },
    frame: { cx: 0, cy: 0, cz: 0, s: 1 },
    trajs: [],
    sep: [],
    lyap: null,
  };

  // ------------------------------------------------------------------ DOM
  const root = h('div', { class: 'layer', style: { position: 'absolute', inset: 0 } });
  stage.append(root);
  const layer = new Layer(root);
  const strip = h('div', { class: 'bottom-strip', id: 'divergence-strip', style: { height: '112px', left: 'auto', width: 'min(440px, calc(100% - 24px))' } });
  const stripLayer = new Layer(strip, { passive: true });
  const info = h('div', { class: 'overlay-card tl', id: 'attractor-info' });
  root.append(strip, info, h('div', { class: 'stage-hint', style: { left: '22%' } }, '拖动旋转 · 滚轮缩放 · 双击复位视角'));

  // ------------------------------------------------------------------ dynamics
  const sys = (t, Y, dY) => {
    const { a, b, c, d } = st.p;
    dY[0] = st.fns[0](Y[0], Y[1], Y[2], t, a, b, c, d);
    dY[1] = st.fns[1](Y[0], Y[1], Y[2], t, a, b, c, d);
    dY[2] = st.fns[2](Y[0], Y[1], Y[2], t, a, b, c, d);
  };
  const work = rk4Work(3);

  function newTrajectories() {
    // start on the attractor (end of the framing transient) so the structure appears at once
    const [x, y, z] = st.frame.start || st.preset.ic;
    st.trajs = Array.from({ length: st.count }, (_, k) => ({
      y: Float64Array.of(x + k * st.eps, y, z),
      buf: new Float32Array(3 * 20000),
      head: -1,
      n: 0,
      color: COLORS[k % COLORS.length],
      dead: false,
    }));
    st.t = 0;
    st.sep = [];
  }

  function push(tr) {
    tr.head = (tr.head + 1) % (tr.buf.length / 3);
    tr.buf[3 * tr.head] = tr.y[0];
    tr.buf[3 * tr.head + 1] = tr.y[1];
    tr.buf[3 * tr.head + 2] = tr.y[2];
    tr.n = Math.min(tr.n + 1, tr.buf.length / 3);
  }

  function advance(steps) {
    const dt = st.preset.dt;
    for (let s = 0; s < steps; s++) {
      for (const tr of st.trajs) {
        if (tr.dead) continue;
        rk4Step(sys, st.t, tr.y, dt, work);
        if (!(Number.isFinite(tr.y[0]) && Number.isFinite(tr.y[1]) && Number.isFinite(tr.y[2])) || Math.abs(tr.y[0]) + Math.abs(tr.y[1]) + Math.abs(tr.y[2]) > 1e8) { tr.dead = true; continue; }
        push(tr);
      }
      st.t += dt;
    }
    if (st.trajs.length > 1) {
      const [p, q] = st.trajs;
      const d = Math.hypot(p.y[0] - q.y[0], p.y[1] - q.y[1], p.y[2] - q.y[2]);
      st.sep.push([st.t, d]);
      if (st.sep.length > 4000) st.sep.splice(0, st.sep.length - 4000);
    }
  }

  /** Centre and scale the camera on the attractor: run a transient, then measure its extent. */
  function autoFrame() {
    const Y = Float64Array.from(st.preset.ic);
    const dt = st.preset.dt;
    let t = 0;
    for (let k = 0; k < 4000; k++) { rk4Step(sys, t, Y, dt, work); t += dt; }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 12000; k++) {
      rk4Step(sys, t, Y, dt, work);
      t += dt;
      if (!Y.every(Number.isFinite)) break;
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], Y[i]); hi[i] = Math.max(hi[i], Y[i]); }
    }
    if (!lo.every(Number.isFinite) || !hi.every(Number.isFinite)) { st.frame = { cx: 0, cy: 0, cz: 0, s: 10, start: null }; return; }
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-3);
    st.frame = { cx: (lo[0] + hi[0]) / 2, cy: (lo[1] + hi[1]) / 2, cz: (lo[2] + hi[2]) / 2, s: span / 2, lo, hi, start: [...Y] };
  }

  let lyapTimer = 0;
  function estimateLyapunov() {
    clearTimeout(lyapTimer);
    st.lyap = null;
    lyapTimer = setTimeout(() => {
      const dt = st.preset.dt;
      const lam = largestLyapunov(sys, st.preset.ic, { dt, tau: 0.5, transient: 20, duration: Math.min(150, 40000 * dt) });
      st.lyap = Number.isFinite(lam) ? lam : NaN;
      updateInfo();
    }, 250);
  }

  // ------------------------------------------------------------------ projection & drawing
  function projector() {
    const W = layer.w, H = layer.h;
    const { yaw, pitch, zoom } = st.cam;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const { cx: ox, cy: oy, cz: oz, s } = st.frame;
    const D = 3.6;
    const k = Math.min(W, H) * 0.4 * zoom;
    const out = [0, 0, 0];
    return (x, y, z) => {
      const X = (x - ox) / s, Y = (y - oy) / s, Z = (z - oz) / s;
      const x1 = X * cy - Y * sy;
      const y1 = X * sy + Y * cy;
      const vert = Z * cp + y1 * sp;
      const depth = y1 * cp - Z * sp;
      const f = D / (D + depth);
      out[0] = W / 2 + x1 * f * k;
      out[1] = H / 2 - vert * f * k;
      out[2] = depth;
      return out;
    };
  }

  function draw() {
    layer.reset();
    const ctx = layer.ctx;
    const W = layer.w, H = layer.h;
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, '#111827');
    g.addColorStop(1, '#07090e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const P = projector();
    const { cx: ox, cy: oy, cz: oz, s } = st.frame;

    if (st.showAxes) {
      // ground grid under the attractor for a depth cue
      const zg = st.frame.lo ? st.frame.lo[2] : oz - s;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(148,163,184,0.08)';
      ctx.beginPath();
      const N = 10;
      for (let i = 0; i <= N; i++) {
        const u = -1.2 + (2.4 * i) / N;
        let a = P(ox + u * s, oy - 1.2 * s, zg); ctx.moveTo(a[0], a[1]);
        a = P(ox + u * s, oy + 1.2 * s, zg); ctx.lineTo(a[0], a[1]);
        a = P(ox - 1.2 * s, oy + u * s, zg); ctx.moveTo(a[0], a[1]);
        a = P(ox + 1.2 * s, oy + u * s, zg); ctx.lineTo(a[0], a[1]);
      }
      ctx.stroke();
      // axes through the frame centre
      const axes = [['x', [1, 0, 0], '#f87171'], ['y', [0, 1, 0], '#4ade80'], ['z', [0, 0, 1], '#60a5fa']];
      const o = [...P(ox, oy, oz)];
      for (const [name, d, col] of axes) {
        const e = P(ox + d[0] * s * 0.9, oy + d[1] * s * 0.9, oz + d[2] * s * 0.9);
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(o[0], o[1]);
        ctx.lineTo(e[0], e[1]);
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = col;
        ctx.font = `italic 14px ${MATH}`;
        ctx.fillText(name, e[0] + 4, e[1] - 4);
      }
      ctx.restore();
    }

    // trails: older segments fainter; additive blending gives a glow where strands overlap
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const CHUNKS = 24;
    for (const tr of st.trajs) {
      const n = Math.min(tr.n, st.trail);
      if (n < 2) continue;
      const L = tr.buf.length / 3;
      const start = (tr.head - n + 1 + L) % L;
      const per = Math.ceil(n / CHUNKS);
      for (let c = 0; c < CHUNKS; c++) {
        const i0 = c * per, i1 = Math.min(n - 1, (c + 1) * per);
        if (i1 <= i0) continue;
        ctx.beginPath();
        for (let i = i0; i <= i1; i++) {
          const q = (start + i) % L;
          const p = P(tr.buf[3 * q], tr.buf[3 * q + 1], tr.buf[3 * q + 2]);
          if (i === i0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        const age = (c + 1) / CHUNKS;
        ctx.globalAlpha = 0.1 + 0.62 * age;
        ctx.strokeStyle = tr.color;
        ctx.lineWidth = 0.7 + 1.1 * age;
        ctx.stroke();
      }
    }
    ctx.restore();
    // heads
    for (const tr of st.trajs) {
      if (tr.n < 1) continue;
      const q = tr.head;
      const p = P(tr.buf[3 * q], tr.buf[3 * q + 1], tr.buf[3 * q + 2]);
      ctx.save();
      ctx.shadowColor = tr.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawChart() {
    stripLayer.reset();
    const ctx = stripLayer.ctx;
    const W = stripLayer.w, H = stripLayer.h;
    const padL = 40, padR = 10, padT = 22, padB = 16;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = C.text2;
    ctx.textBaseline = 'middle';
    ctx.fillText('轨线 1 与 2 的距离（对数坐标）', 10, 11);
    if (st.sep.length < 2) return;
    const t1 = st.sep.at(-1)[0];
    const t0 = Math.max(st.sep[0][0], t1 - 40);
    const lo = -8, hi = 2;
    const X = (t) => padL + ((t - t0) / Math.max(1e-9, t1 - t0)) * (W - padL - padR);
    const Y = (d) => H - padB - ((Math.log10(Math.max(d, 1e-12)) - lo) / (hi - lo)) * (H - padT - padB);
    ctx.strokeStyle = 'rgba(148,163,184,0.14)';
    ctx.lineWidth = 1;
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = C.text3;
    ctx.textAlign = 'right';
    for (let e = lo; e <= hi; e += 2) {
      ctx.beginPath();
      ctx.moveTo(padL, Y(10 ** e));
      ctx.lineTo(W - padR, Y(10 ** e));
      ctx.stroke();
      ctx.fillText(`1e${e}`, padL - 5, Y(10 ** e));
    }
    ctx.beginPath();
    let first = true;
    for (const [t, d] of st.sep) {
      if (t < t0) continue;
      const px = X(t), py = Y(d);
      if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // reference slope e^{λt} from the Lyapunov estimate
    if (Number.isFinite(st.lyap) && st.lyap > 0) {
      const tStart = Math.max(t0, st.sep[0][0]);
      const d0 = st.sep.find(([t]) => t >= tStart)[1];
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(X(tStart), Y(d0));
      const tEnd = Math.min(t1, tStart + (hi - Math.log10(d0)) / (st.lyap / Math.LN10));
      ctx.lineTo(X(tEnd), Y(d0 * Math.exp(st.lyap * (tEnd - tStart))));
      ctx.stroke();
      ctx.restore();
    }
  }

  function updateInfo() {
    info.innerHTML = '';
    const d = st.sep.length ? st.sep.at(-1)[1] : NaN;
    info.append(
      h('div', { class: 'title' }, st.preset.label + ' 吸引子'),
      h('dl', { class: 'readout', style: { minWidth: '190px' } },
        h('dt', null, '时间 t'), h('dd', { id: 'attr-t' }, fmt(st.t, 2)),
        h('dt', null, '轨线间距'), h('dd', null, Number.isFinite(d) ? fmt(d, 3) : '—'),
        h('dt', { html: 'λ<sub>max</sub> 估计' }), h('dd', { id: 'attr-lyap' }, st.lyap == null ? '计算中…' : Number.isFinite(st.lyap) ? fmt(st.lyap, 3) : '发散')));
  }

  // ------------------------------------------------------------------ loop & interaction
  let infoTick = 0;
  const loop = animationLoop((dt) => {
    if (st.autoRotate && !dragging) st.cam.yaw += dt * 0.18;
    const steps = Math.max(1, Math.round(st.speed * (0.022 / st.preset.dt) * 60 * dt));
    advance(Math.min(steps, 4000));
    draw();
    if (st.showChart) drawChart();
    if ((infoTick += dt) > 0.15) { infoTick = 0; updateInfo(); }
  });

  let dragging = false;
  let last = null;
  const pointers = new Map();
  let pinch = 0;
  const cv = layer.canvas;
  cv.style.cursor = 'grab';
  const onDown = (e) => {
    cv.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    dragging = true;
    last = [e.clientX, e.clientY];
    cv.style.cursor = 'grabbing';
  };
  const onMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) st.cam.zoom = Math.min(8, Math.max(0.2, st.cam.zoom * (d / pinch)));
      pinch = d;
      return;
    }
    st.cam.yaw += (e.clientX - last[0]) * 0.008;
    st.cam.pitch = Math.min(1.5, Math.max(-1.5, st.cam.pitch + (e.clientY - last[1]) * 0.008));
    last = [e.clientX, e.clientY];
  };
  const onUp = (e) => { pointers.delete(e.pointerId); if (!pointers.size) { dragging = false; cv.style.cursor = 'grab'; } };
  const onWheel = (e) => { e.preventDefault(); st.cam.zoom = Math.min(8, Math.max(0.2, st.cam.zoom * Math.exp(-e.deltaY * 0.0015))); };
  const onDbl = () => { st.cam = { yaw: -0.7, pitch: 0.35, zoom: 1 }; };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('dblclick', onDbl);

  const stopResize = observeSize(root, (w, hh) => {
    layer.resize(w, hh);
    const r = strip.getBoundingClientRect();
    stripLayer.resize(r.width, r.height);
  });

  // ------------------------------------------------------------------ panel
  const presetChips = chips({ items: PRESETS_3D.map((p) => ({ id: p.id, label: p.label })), value: st.preset.id, id: 'ode3d-presets', onPick: (id) => loadPreset(PRESETS_3D.find((p) => p.id === id)) });
  const fields = ['ẋ =', 'ẏ =', 'ż ='].map((prefix, k) => exprField({
    prefix, id: `ode3-${k}`, compile: (src) => realFunction(src, VARS),
    onValid: (fn, src) => { st.fns[k] = fn; st.src[k] = src; presetChips.set(null); restart(false); syncQuery(); },
  }));
  const note = h('div', { class: 'note' });
  const sliders = {};
  const paramBox = h('div', { class: 'field', style: { gap: '10px' } });
  for (const k of ['a', 'b', 'c', 'd']) {
    sliders[k] = slider({ label: k, min: 0, max: 1, step: 0.001, value: 0, id: `param3-${k}`, onInput: (v) => { st.p[k] = v; paramsChanged(); } });
    paramBox.append(sliders[k].el);
  }
  let paramTimer = 0;
  function paramsChanged() {
    clearTimeout(paramTimer);
    paramTimer = setTimeout(() => { autoFrame(); estimateLyapunov(); syncQuery(); }, 200);
  }
  const countSlider = slider({ label: '轨线条数', min: 1, max: 6, step: 1, value: st.count, format: (v) => String(v), onInput: (v) => { st.count = v; restart(false); } });
  const epsSlider = slider({ label: '初值扰动 ε', min: -9, max: -1, step: 1, value: Math.log10(st.eps), format: (v) => `10^${v}`, onInput: (v) => { st.eps = 10 ** v; restart(false); } });

  const panelEl = h('div', null,
    section('系统', [
      presetChips.el,
      ...fields.map((f) => f.el),
      h('div', { class: 'hint', html: '变量 <code>x</code> <code>y</code> <code>z</code> <code>t</code>，参数 <code>a</code>–<code>d</code>。四阶 Runge–Kutta 定步长积分。' }),
      note,
    ]),
    section('参数', [paramBox]),
    section('蝴蝶效应', [
      countSlider.el,
      epsSlider.el,
      h('div', { class: 'hint' }, '第 k 条轨线的初值在 x 方向偏移 k·ε。它们起初完全重合，间距按 e^{λt} 指数增长（右下图，虚线斜率为估计的 λ_max），最终在吸引子上彻底分离。'),
      h('div', { class: 'btn-row' }, button({ label: '重新开始', iconName: 'reset', small: true, id: 'attr-restart', onClick: () => restart(false) }), button({ label: '重新取景', iconName: 'fit', small: true, onClick: () => { autoFrame(); st.cam.zoom = 1; } })),
    ]),
    section('显示', [
      slider({ label: '速度', min: 0.1, max: 5, step: 0.05, value: st.speed, format: (v) => `${fmt(v, 2)}×`, onInput: (v) => { st.speed = v; } }).el,
      slider({ label: '尾迹长度', min: 200, max: 20000, step: 100, value: st.trail, format: (v) => String(v), onInput: (v) => { st.trail = v; } }).el,
      h('div', { class: 'toggles two' },
        toggle({ label: '自动旋转', value: st.autoRotate, onChange: (v) => { st.autoRotate = v; } }).el,
        toggle({ label: '坐标轴与地面', value: st.showAxes, onChange: (v) => { st.showAxes = v; } }).el,
        toggle({ label: '距离曲线', value: st.showChart, onChange: (v) => { st.showChart = v; strip.style.display = v ? '' : 'none'; } }).el),
    ]),
  );
  panel.append(panelEl);

  function restart(reframe = true) {
    if (reframe) autoFrame();
    newTrajectories();
    estimateLyapunov();
    updateInfo();
  }

  function loadPreset(p, params = null) {
    st.preset = p;
    presetChips.set(p.id);
    st.src = [p.f, p.g, p.h];
    st.fns = st.src.map((s) => realFunction(s, VARS));
    fields.forEach((f, k) => f.set(st.src[k], false));
    note.textContent = p.note;
    for (const k of ['a', 'b', 'c', 'd']) {
      const spec = p.params[k];
      const s = sliders[k];
      if (spec) {
        s.el.style.display = '';
        s.setRange(spec.min, spec.max, 'any');
        st.p[k] = params?.[k] ?? spec.v;
        s.set(st.p[k]);
        s.setLabel(`<span class="math">${k}</span> · ${spec.label}`);
      } else {
        s.el.style.display = 'none';
        st.p[k] = params?.[k] ?? 0;
      }
    }
    st.cam.zoom = 1;
    restart(true);
    syncQuery();
  }

  function syncQuery() {
    if (!active()) return;
    const q = { mode: '3d' };
    const custom = st.src[0] !== st.preset.f || st.src[1] !== st.preset.g || st.src[2] !== st.preset.h;
    q.p = st.preset.id;
    if (custom) { q.f = st.src[0]; q.g = st.src[1]; q.h = st.src[2]; }
    q.k = ['a', 'b', 'c', 'd'].map((k) => +st.p[k].toFixed(5)).join(',');
    setQuery(q);
  }

  {
    const p = PRESETS_3D.find((q) => q.id === query.get('p')) || PRESETS_3D[0];
    const k = (query.get('k') || '').split(',').map(Number);
    const params = k.length === 4 && k.every(Number.isFinite) ? { a: k[0], b: k[1], c: k[2], d: k[3] } : null;
    loadPreset(p, params);
    if (query.get('f') && query.get('g') && query.get('h')) {
      try {
        st.fns = [query.get('f'), query.get('g'), query.get('h')].map((s) => realFunction(s, VARS));
        st.src = [query.get('f'), query.get('g'), query.get('h')];
        fields.forEach((f, i) => f.set(st.src[i], false));
        presetChips.set(null);
        restart(true);
      } catch { /* keep preset */ }
    }
  }

  return {
    panel: panelEl,
    start() { loop.start(); },
    stop() { loop.stop(); },
    help: {
      tips: [
        '拖动旋转视角，滚轮缩放，双击复位。几条轨线的初值只差 ε，起初完全重合，随后指数分离——这就是“蝴蝶效应”。',
        'λ_max 用 Benettin 方法估计：跟踪一对相距 10⁻⁸ 的轨线，每 0.5 个时间单位重新归一化间距并累加对数增长率。',
        '修改参数后吸引子会自动重新取景。试试把洛伦茨的 ρ 降到 20 以下：混沌消失，轨线落入稳定平衡点。',
      ],
      keys: [['Space', '暂停 / 继续'], ['R', '重新开始']],
    },
    onKey(e) {
      if (e.key === ' ') { loop.running ? loop.stop() : loop.start(); e.preventDefault(); }
      if (e.key === 'r' || e.key === 'R') restart(false);
    },
    snapshot: () => layer.canvas,
    state: () => ({ mode: '3d', preset: st.preset.id, t: st.t, count: st.trajs.length, lyap: st.lyap, sep: st.sep.length ? st.sep.at(-1)[1] : null, frame: { ...st.frame }, p: { ...st.p } }),
    destroy() {
      loop.stop();
      clearTimeout(lyapTimer); clearTimeout(paramTimer);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('dblclick', onDbl);
      stopResize();
      root.remove();
      panelEl.remove();
    },
  };
}
