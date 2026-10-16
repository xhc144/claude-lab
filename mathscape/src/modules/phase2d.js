// ODE module, 2D view — phase plane of x' = f(x, y), y' = g(x, y): direction field, flowing
// particles, trajectories (adaptive Dormand–Prince), equilibria with linear classification,
// separatrices of saddles, nullclines and time series.

import { h } from '../ui/dom.js';
import { Layer, Viewport, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { drawGrid, glow, backdrop } from '../ui/draw.js';
import { section, slider, toggle, button, chips, exprField } from '../ui/controls.js';
import { fmt, fmtVec, fmtComplex } from '../ui/format.js';
import { C, FONT, MONO, rampCss } from '../ui/theme.js';
import { realFunction } from '../core/expr.js';
import { integrate, densify, findEquilibria, contourZero, rk4Step, rk4Work } from '../core/ode.js';
import { tolerances } from '../ui/settings.js';

const VARS = ['x', 'y', 't', 'a', 'b', 'c', 'd'];
const TRAJ_COLORS = ['#fbbf24', '#22d3ee', '#f472b6', '#a3e635', '#c084fc', '#fb923c', '#60a5fa', '#34d399'];

export const PRESETS_2D = [
  {
    id: 'vdp', label: '范德波尔振子', f: 'y', g: 'a(1 - x^2)y - x',
    params: { a: { v: 1, min: 0, max: 5, label: 'μ' } }, view: [-4.5, 4.5, -4.5, 4.5],
    seeds: [[0.1, 0.1], [3.5, 3]], note: '非线性阻尼振子：任何非零初值最终都被吸引到同一个极限环。μ 越大越接近张弛振荡。',
  },
  {
    id: 'pendulum', label: '阻尼单摆', f: 'y', g: '-sin(x) - a y',
    params: { a: { v: 0.25, min: 0, max: 2, label: '阻尼 γ' } }, view: [-8, 8, -4, 4],
    seeds: [[-6, 2.6], [0.5, 2.1]], note: 'x 为摆角、y 为角速度。γ = 0 时 (2kπ, 0) 是中心、((2k+1)π, 0) 是鞍点，鞍点的分界线把“摆动”和“翻转”分开；γ > 0 时中心变为稳定焦点。',
  },
  {
    id: 'lv', label: '捕食者–猎物', f: 'a x - b x y', g: '-c y + d x y',
    params: { a: { v: 1, min: 0.1, max: 3, label: 'α 猎物增长' }, b: { v: 1, min: 0.1, max: 3, label: 'β 捕食率' }, c: { v: 1, min: 0.1, max: 3, label: 'γ 捕食者死亡' }, d: { v: 1, min: 0.1, max: 3, label: 'δ 转化率' } },
    view: [-0.4, 4.2, -0.4, 4.2], seeds: [[1.8, 1], [2.6, 1]], note: 'Lotka–Volterra 方程：x 为猎物、y 为捕食者。存在守恒量 δx − γ ln x + βy − α ln y，所以轨线都是围绕 (γ/δ, α/β) 的闭曲线。',
  },
  {
    id: 'duffing', label: '杜芬双势阱', f: 'y', g: 'x - x^3 - a y',
    params: { a: { v: 0.2, min: 0, max: 1.5, label: '阻尼 δ' } }, view: [-2.4, 2.4, -1.8, 1.8],
    seeds: [[-2, 1.2], [2, -1.2]], note: '双势阱中的粒子：原点是鞍点，(±1, 0) 是稳定焦点。鞍点的稳定流形把平面分成两个吸引域，它们像螺旋一样交错。',
  },
  {
    id: 'hopf', label: '霍普夫分岔', f: 'a x - y - x(x^2 + y^2)', g: 'x + a y - y(x^2 + y^2)',
    params: { a: { v: 0.5, min: -1, max: 1, label: 'μ' } }, view: [-2, 2, -2, 2],
    seeds: [[0.05, 0], [1.6, 1.2]], note: '超临界 Hopf 分岔的正规形。μ < 0 时原点是稳定焦点；μ 穿过 0，原点失稳，诞生半径 √μ 的稳定极限环。拖动 μ 观察。',
  },
  {
    id: 'linear', label: '线性系统', f: 'a x + b y', g: 'c x + d y',
    params: { a: { v: -0.4, min: -2, max: 2, label: 'a' }, b: { v: 1, min: -2, max: 2, label: 'b' }, c: { v: -1, min: -2, max: 2, label: 'c' }, d: { v: -0.4, min: -2, max: 2, label: 'd' } },
    view: [-3, 3, -3, 3], seeds: [[2, 2], [-2, -1]], note: 'x′ = Ax，A = [[a, b], [c, d]]。原点的类型完全由 tr A 与 det A 决定：det < 0 鞍点；det > 0 时看 tr 的符号与 tr² − 4det（结点 / 焦点 / 中心）。',
  },
  {
    id: 'competition', label: '竞争物种', f: 'x(3 - x - 2y)', g: 'y(2 - x - y)',
    params: {}, view: [-0.3, 3.6, -0.3, 3], seeds: [[0.5, 2.5], [2.5, 0.4]], note: 'Strogatz 的经典例子：兔与羊竞争草场。内部平衡点是鞍点，其稳定流形把初值分成两类——结局总是一方灭绝（双稳态）。',
  },
  {
    id: 'brusselator', label: '布鲁塞尔子', f: 'a - (b + 1) x + x^2 y', g: 'b x - x^2 y',
    params: { a: { v: 1, min: 0.2, max: 3, label: 'A' }, b: { v: 3, min: 0.5, max: 6, label: 'B' } }, view: [-0.2, 4.6, -0.2, 5.2],
    seeds: [[1, 1]], note: '自催化化学反应模型。B > 1 + A² 时平衡点 (A, B/A) 失稳，出现极限环（化学振荡）。',
  },
];

export function createPhase2D({ stage, panel, toast, query, setQuery, active }) {
  // precision mode (read once: a change of setting re-creates the module)
  const tol = tolerances();
  const eqDigits = tol.hp ? 10 : 4;
  const st = {
    preset: PRESETS_2D[0],
    fSrc: '', gSrc: '',
    fx: null, fy: null,
    p: { a: 1, b: 1, c: 1, d: 1 },
    trajs: [],
    selected: -1,
    eq: [],
    seps: [],
    null: { f: null, g: null },
    show: { field: true, particles: true, nullclines: true, equilibria: true, separatrices: true, series: true, dots: true },
    T: 40,
    speed: 1,
    tAnim: 0,
    hover: null,
  };

  // ------------------------------------------------------------------ DOM
  const root = h('div', { class: 'layer', style: { position: 'absolute', inset: 0 } });
  stage.append(root);
  const base = new Layer(root);
  const fx = new Layer(root, { passive: true });
  const coordCard = h('div', { class: 'overlay-card tl', id: 'phase-coords', style: { minWidth: '200px' } },
    h('div', { class: 'title' }, '光标'), h('div', { class: 'big', style: { color: C.text3 } }, '移到相平面上查看 (x, y) 与 (ẋ, ẏ)'));
  const tip = h('div', { class: 'tooltip', style: { display: 'none' } });
  const strip = h('div', { class: 'bottom-strip', id: 'series-strip' });
  const stripLayer = new Layer(strip, { passive: true });
  root.append(coordCard, tip, strip);
  const hint = h('div', { class: 'stage-hint', style: { bottom: '150px' } }, '单击添加轨线 · 拖动平移 · 滚轮缩放');
  root.append(hint);
  const vp = new Viewport();

  // ------------------------------------------------------------------ field
  const F = (x, y, t = 0) => {
    const { a, b, c, d } = st.p;
    return [st.fx(x, y, t, a, b, c, d), st.fy(x, y, t, a, b, c, d)];
  };
  const sys = (t, Y, dY) => {
    const { a, b, c, d } = st.p;
    dY[0] = st.fx(Y[0], Y[1], t, a, b, c, d);
    dY[1] = st.fy(Y[0], Y[1], t, a, b, c, d);
  };

  function compile(fSrc, gSrc) {
    const f = realFunction(fSrc, VARS);
    const g = realFunction(gSrc, VARS);
    st.fSrc = fSrc; st.gSrc = gSrc;
    st.fx = f; st.fy = g;
  }

  // ------------------------------------------------------------------ trajectories
  function solve(x0, y0, span, box) {
    const stop = (Y) => !(Number.isFinite(Y[0]) && Number.isFinite(Y[1])) || Math.abs(Y[0] - box.cx) > box.r || Math.abs(Y[1] - box.cy) > box.r;
    const opts = { duration: st.T, rtol: tol.odeRtol, atol: tol.odeAtol * span, maxSteps: tol.odeMaxSteps, stop };
    const fw = integrate(sys, [x0, y0], { ...opts, direction: 1 });
    const bw = integrate(sys, [x0, y0], { ...opts, direction: -1 });
    const seg = span / 600;
    const pf = densify(fw, seg), pb = densify(bw, seg);
    // merge into one polyline in increasing time: reversed backward part + forward part
    const n = pb.length / 3 + pf.length / 3 - 1;
    const pts = new Float64Array(3 * n);
    let k = 0;
    for (let i = pb.length - 3; i >= 3; i -= 3) { pts[k++] = pb[i]; pts[k++] = pb[i + 1]; pts[k++] = pb[i + 2]; }
    pts.set(pf, k);
    return { pts, t0: pts[2], t1: pts[pts.length - 1] };
  }

  function viewBox() {
    const b = vp.bounds;
    const span = Math.max(b.xmax - b.xmin, b.ymax - b.ymin);
    return { span, box: { cx: (b.xmin + b.xmax) / 2, cy: (b.ymin + b.ymax) / 2, r: 2.5 * span } };
  }

  let trajVersion = 0;
  function recomputeTrajectories() {
    trajVersion++;
    const { span, box } = viewBox();
    for (const tr of st.trajs) Object.assign(tr, solve(tr.x0, tr.y0, span, box));
  }

  function addTrajectory(x, y, select = true) {
    const { span, box } = viewBox();
    const tr = { x0: x, y0: y, color: TRAJ_COLORS[st.trajs.length % TRAJ_COLORS.length], ...solve(x, y, span, box) };
    st.trajs.push(tr);
    trajVersion++;
    if (select) st.selected = st.trajs.length - 1;
    trajCount.textContent = String(st.trajs.length);
    syncQuery();
    return tr;
  }

  // ------------------------------------------------------------------ equilibria & separatrices
  function recomputeStructure() {
    const b = vp.bounds;
    st.eq = findEquilibria((x, y) => F(x, y), b, { seeds: 12, tol: tol.hp ? 1e-14 : 1e-10 }).slice(0, 40);
    st.seps = [];
    const span = Math.max(b.xmax - b.xmin, b.ymax - b.ymin);
    if (st.show.separatrices) {
      const box = { cx: (b.xmin + b.xmax) / 2, cy: (b.ymin + b.ymax) / 2, r: 2 * span };
      const stop = (Y) => !(Number.isFinite(Y[0]) && Number.isFinite(Y[1])) || Math.abs(Y[0] - box.cx) > box.r || Math.abs(Y[1] - box.cy) > box.r;
      for (const e of st.eq) {
        if (e.type !== 'saddle' || !e.eigen.real) continue;
        e.eigen.real.forEach((lam, k) => {
          const v = e.eigen.vectors[k];
          const dir = lam > 0 ? 1 : -1; // unstable manifold forward, stable manifold backward in time
          for (const s of [1, -1]) {
            const eps = 1e-5 * span;
            const sol = integrate(sys, [e.x + s * eps * v[0], e.y + s * eps * v[1]], { duration: 60, direction: dir, rtol: tol.sepRtol, atol: tol.sepAtol * span, maxSteps: tol.odeMaxSteps, stop });
            st.seps.push({ unstable: lam > 0, pts: densify(sol, span / 600) });
          }
        });
      }
    }
    if (st.show.nullclines) {
      const nx = Math.max(40, Math.round(vp.w / 5)), ny = Math.max(30, Math.round(vp.h / 5));
      const pad = { xmin: b.xmin, xmax: b.xmax, ymin: b.ymin, ymax: b.ymax };
      st.null.f = contourZero((x, y) => F(x, y)[0], pad, nx, ny);
      st.null.g = contourZero((x, y) => F(x, y)[1], pad, nx, ny);
    }
    updateEqList();
  }

  // ------------------------------------------------------------------ drawing (static layer)
  function drawBase() {
    base.reset();
    const ctx = base.ctx;
    const W = vp.w, H = vp.h;
    backdrop(ctx, W, H, '#0f1420', '#090c13', 0.4, base.dpr);
    drawGrid(ctx, vp, { alpha: 0.9 });
    if (st.show.field) drawField(ctx);
    if (st.show.nullclines) {
      drawSegments(ctx, st.null.f, '#fb923c');
      drawSegments(ctx, st.null.g, '#a78bfa');
    }
    if (st.show.separatrices) {
      for (const s of st.seps) {
        drawPolyline(ctx, s.pts, s.unstable ? 'rgba(251, 113, 133, 0.9)' : 'rgba(96, 165, 250, 0.9)', 2);
      }
    }
    st.trajs.forEach((tr, k) => {
      drawPolyline(ctx, tr.pts, tr.color, k === st.selected ? 2.6 : 1.9, 3, k === st.selected);
      arrowsAlong(ctx, tr.pts, tr.color);
      ctx.beginPath();
      ctx.arc(vp.sx(tr.x0), vp.sy(tr.y0), 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#0c1018';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = tr.color;
      ctx.stroke();
    });
    if (st.show.equilibria) for (const e of st.eq) drawEquilibrium(ctx, e);
  }

  function drawField(ctx) {
    const sp = 30;
    const cols = Math.ceil(vp.w / sp) + 1, rows = Math.ceil(vp.h / sp) + 1;
    const ox = (vp.w - (cols - 1) * sp) / 2, oy = (vp.h - (rows - 1) * sp) / 2;
    const samples = [];
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const px = ox + i * sp, py = oy + j * sp;
        const [u, v] = F(vp.wx(px), vp.wy(py));
        const m = Math.hypot(u, v);
        if (!Number.isFinite(m)) continue;
        const lm = Math.log(m + 1e-12);
        samples.push([px, py, u, v, lm]);
        if (m > 1e-12) { lo = Math.min(lo, lm); hi = Math.max(hi, lm); }
      }
    }
    const BUCKETS = 12;
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    for (const [px, py, u, v, lm] of samples) {
      const m = Math.hypot(u, v);
      if (m < 1e-12) continue;
      const s = hi > lo ? (lm - lo) / (hi - lo) : 0.5;
      const L = sp * (0.32 + 0.22 * s);
      const dx = (u / m) * L, dy = (-v / m) * L;
      const x0 = px - dx / 2, y0 = py - dy / 2, x1 = px + dx / 2, y1 = py + dy / 2;
      const p = paths[Math.min(BUCKETS - 1, Math.floor(s * BUCKETS))];
      p.moveTo(x0, y0);
      p.lineTo(x1, y1);
      const ux = dx / L, uy = dy / L;
      p.moveTo(x1 - ux * 5 - uy * 3, y1 - uy * 5 + ux * 3);
      p.lineTo(x1, y1);
      p.lineTo(x1 - ux * 5 + uy * 3, y1 - uy * 5 - ux * 3);
    }
    ctx.save();
    ctx.lineWidth = 1.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    paths.forEach((p, k) => {
      ctx.strokeStyle = rampCss(0.3 + (0.7 * k) / (BUCKETS - 1), 0.5);
      ctx.stroke(p);
    });
    ctx.restore();
  }

  function drawSegments(ctx, segs, color) {
    if (!segs || !segs.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let k = 0; k < segs.length; k += 4) {
      ctx.moveTo(vp.sx(segs[k]), vp.sy(segs[k + 1]));
      ctx.lineTo(vp.sx(segs[k + 2]), vp.sy(segs[k + 3]));
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPolyline(ctx, pts, color, width, stride = 3, halo = false) {
    if (!pts || pts.length < 2 * stride) return;
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < pts.length; k += stride) {
      const px = vp.sx(pts[k]), py = vp.sy(pts[k + 1]);
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (halo) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = color;
      ctx.lineWidth = width + 5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  function arrowsAlong(ctx, pts, color) {
    let acc = 60;
    const placed = []; // closed orbits revisit the same places: keep arrowheads apart
    ctx.save();
    ctx.fillStyle = color;
    for (let k = 3; k < pts.length; k += 3) {
      const x0 = vp.sx(pts[k - 3]), y0 = vp.sy(pts[k - 2]);
      const x1 = vp.sx(pts[k]), y1 = vp.sy(pts[k + 1]);
      const d = Math.hypot(x1 - x0, y1 - y0);
      acc += d;
      if (acc < 150 || d < 1e-6) continue;
      if (x1 < -20 || x1 > vp.w + 20 || y1 < -20 || y1 > vp.h + 20) continue;
      if (placed.some(([px, py]) => (px - x1) ** 2 + (py - y1) ** 2 < 70 * 70)) continue;
      placed.push([x1, y1]);
      acc = 0;
      const ux = (x1 - x0) / d, uy = (y1 - y0) / d;
      ctx.beginPath();
      ctx.moveTo(x1 + ux * 6, y1 + uy * 6);
      ctx.lineTo(x1 - ux * 5 - uy * 4.5, y1 - uy * 5 + ux * 4.5);
      ctx.lineTo(x1 - ux * 2, y1 - uy * 2);
      ctx.lineTo(x1 - ux * 5 + uy * 4.5, y1 - uy * 5 - ux * 4.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  const EQ_STYLE = {
    saddle: { color: '#fbbf24', shape: 'diamond' },
    'stable-node': { color: '#4ade80', shape: 'filled' },
    'stable-focus': { color: '#4ade80', shape: 'filled' },
    'stable-star': { color: '#4ade80', shape: 'filled' },
    'unstable-node': { color: '#fb7185', shape: 'hollow' },
    'unstable-focus': { color: '#fb7185', shape: 'hollow' },
    'unstable-star': { color: '#fb7185', shape: 'hollow' },
    center: { color: '#22d3ee', shape: 'ring' },
    degenerate: { color: '#94a3b8', shape: 'ring' },
  };

  function drawEquilibrium(ctx, e) {
    const { color, shape } = EQ_STYLE[e.type] || EQ_STYLE.degenerate;
    const x = vp.sx(e.x), y = vp.sy(e.y);
    ctx.save();
    glow(ctx, x, y, 22, color, 0.8);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = color;
    ctx.fillStyle = shape === 'filled' ? color : '#0c1018';
    ctx.beginPath();
    if (shape === 'diamond') {
      ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.arc(x, y, 6.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      if (shape === 'ring') {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ particles (dynamic layer)
  const NP = 800, TRAIL = 12;
  const P = { x: new Float64Array(NP), y: new Float64Array(NP), age: new Float32Array(NP), life: new Float32Array(NP), hx: new Float32Array(NP * TRAIL), hy: new Float32Array(NP * TRAIL), head: new Uint8Array(NP), n: new Uint8Array(NP) };
  const work = rk4Work(2);
  const Y = new Float64Array(2);
  function spawn(i) {
    P.x[i] = vp.wx(Math.random() * vp.w);
    P.y[i] = vp.wy(Math.random() * vp.h);
    P.age[i] = 0;
    P.life[i] = 1.5 + Math.random() * 3;
    P.n[i] = 0;
    P.head[i] = 0;
  }
  function resetParticles() { for (let i = 0; i < NP; i++) { spawn(i); P.age[i] = Math.random() * P.life[i]; } }

  /** Time step so the fastest visible flow moves about 6 px per frame. */
  let flowScale = 1;
  function measureFlow() {
    const vals = [];
    for (let k = 0; k < 64; k++) {
      const [u, v] = F(vp.wx(Math.random() * vp.w), vp.wy(Math.random() * vp.h));
      const m = Math.hypot(u, v);
      if (Number.isFinite(m)) vals.push(m);
    }
    vals.sort((p, q) => p - q);
    const typical = vals.length ? vals[Math.floor(vals.length * 0.7)] : 1;
    flowScale = typical > 0 ? 1 / typical : 1;
  }

  function stepParticles(dt) {
    // integration time per frame chosen so typical flow moves ~90 px/s on screen
    const step = (Math.min(0.05, dt) * st.speed * 90 * flowScale) / vp.scale;
    for (let i = 0; i < NP; i++) {
      P.age[i] += dt;
      if (P.age[i] > P.life[i]) { spawn(i); continue; }
      Y[0] = P.x[i]; Y[1] = P.y[i];
      rk4Step(sys, 0, Y, step, work);
      const px = vp.sx(Y[0]), py = vp.sy(Y[1]);
      if (!Number.isFinite(px) || !Number.isFinite(py) || px < -10 || px > vp.w + 10 || py < -10 || py > vp.h + 10 || (Math.abs(px - vp.sx(P.x[i])) < 0.02 && Math.abs(py - vp.sy(P.y[i])) < 0.02 && P.n[i] > 3)) {
        spawn(i);
        continue;
      }
      P.x[i] = Y[0]; P.y[i] = Y[1];
      const hd = (P.head[i] + 1) % TRAIL;
      P.head[i] = hd;
      P.hx[i * TRAIL + hd] = px;
      P.hy[i * TRAIL + hd] = py;
      if (P.n[i] < TRAIL) P.n[i]++;
    }
  }

  function drawParticles(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    for (let seg = 1; seg < TRAIL; seg++) {
      ctx.beginPath();
      for (let i = 0; i < NP; i++) {
        if (P.n[i] <= seg) continue;
        const a = (P.head[i] - seg + 1 + TRAIL) % TRAIL, b = (P.head[i] - seg + TRAIL) % TRAIL;
        ctx.moveTo(P.hx[i * TRAIL + a], P.hy[i * TRAIL + a]);
        ctx.lineTo(P.hx[i * TRAIL + b], P.hy[i * TRAIL + b]);
      }
      ctx.strokeStyle = `rgba(206, 224, 255, ${0.5 * (1 - seg / TRAIL) ** 1.3})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  function pointAt(tr, t) {
    const pts = tr.pts;
    let lo = 0, hi = pts.length / 3 - 1;
    if (t <= pts[2]) return [pts[0], pts[1]];
    if (t >= pts[3 * hi + 2]) return [pts[3 * hi], pts[3 * hi + 1]];
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[3 * mid + 2] <= t) lo = mid; else hi = mid;
    }
    const t0 = pts[3 * lo + 2], t1 = pts[3 * hi + 2];
    const s = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    return [pts[3 * lo] + s * (pts[3 * hi] - pts[3 * lo]), pts[3 * lo + 1] + s * (pts[3 * hi + 1] - pts[3 * lo + 1])];
  }

  function drawFx() {
    fx.reset();
    const ctx = fx.ctx;
    if (st.show.particles) drawParticles(ctx);
    if (st.show.dots) {
      st.trajs.forEach((tr) => {
        // each dot runs over its forward time range, looping
        const span = tr.t1 - 0;
        if (span <= 0) return;
        const t = (st.tAnim % span);
        const [x, y] = pointAt(tr, t);
        const px = vp.sx(x), py = vp.sy(y);
        glow(ctx, px, py, 22, tr.color);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    if (st.hover) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(vp.sx(st.hover.x), vp.sy(st.hover.y), 13, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ time series strip
  // The plot itself only changes with the trajectory, so it is rendered once into an offscreen
  // canvas; each frame just blits it and draws the moving time cursor.
  const seriesCache = { canvas: document.createElement('canvas'), key: '', X: null };
  function drawSeries() {
    const tr = st.trajs[st.selected];
    const key = `${st.selected}|${st.trajs.length}|${trajVersion}|${stripLayer.canvas.width}x${stripLayer.canvas.height}`;
    if (seriesCache.key !== key) renderSeriesCache();
    seriesCache.key = key;
    stripLayer.reset();
    const ctx = stripLayer.ctx;
    ctx.drawImage(seriesCache.canvas, 0, 0, stripLayer.w, stripLayer.h);
    if (tr && seriesCache.X && st.show.dots && tr.t1 > 0) {
      const x = seriesCache.X(st.tAnim % tr.t1);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, stripLayer.h - 18);
      ctx.stroke();
    }
  }

  function renderSeriesCache() {
    const c = seriesCache.canvas;
    c.width = stripLayer.canvas.width;
    c.height = stripLayer.canvas.height;
    const ctx = c.getContext('2d');
    ctx.setTransform(stripLayer.dpr, 0, 0, stripLayer.dpr, 0, 0);
    const W = stripLayer.w, H = stripLayer.h;
    const tr = st.trajs[st.selected];
    seriesCache.X = null;
    ctx.font = `11px ${FONT}`;
    if (!tr) {
      ctx.fillStyle = C.text3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('单击相平面添加一条轨线，这里显示它的 x(t)、y(t)', W / 2, H / 2);
      return;
    }
    const pts = tr.pts;
    const n = pts.length / 3;
    // show forward time only (t ≥ 0)
    let k0 = 0;
    while (k0 < n - 1 && pts[3 * k0 + 2] < 0) k0++;
    const tEnd = pts[3 * (n - 1) + 2];
    let lo = Infinity, hi = -Infinity;
    for (let k = k0; k < n; k++) { lo = Math.min(lo, pts[3 * k], pts[3 * k + 1]); hi = Math.max(hi, pts[3 * k], pts[3 * k + 1]); }
    if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
    const padL = 44, padR = 14, padT = 22, padB = 18;
    const X = (t) => padL + ((t - 0) / Math.max(1e-9, tEnd)) * (W - padL - padR);
    seriesCache.X = X;
    const Yv = (v) => H - padB - ((v - lo) / (hi - lo)) * (H - padT - padB);
    ctx.strokeStyle = 'rgba(148,163,184,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const v of [lo, (lo + hi) / 2, hi]) { ctx.moveTo(padL, Yv(v)); ctx.lineTo(W - padR, Yv(v)); }
    if (lo < 0 && hi > 0) { ctx.moveTo(padL, Yv(0)); ctx.lineTo(W - padR, Yv(0)); }
    ctx.stroke();
    ctx.fillStyle = C.text3;
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const axisLabel = (v) => (Math.abs(v) < 1e-9 * (hi - lo) ? '0' : fmt(v, 2));
    ctx.fillText(axisLabel(hi), padL - 6, Yv(hi));
    ctx.fillText(axisLabel(lo), padL - 6, Yv(lo));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`t = ${fmt(tEnd, 1)}`, W - padR - 52, H - padB + 3);
    const plot = (idx, color) => {
      ctx.beginPath();
      for (let k = k0; k < n; k++) {
        const px = X(pts[3 * k + 2]), py = Yv(pts[3 * k + idx]);
        if (k === k0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };
    plot(0, '#7aa2ff');
    plot(1, '#f472b6');
    ctx.font = `600 11px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7aa2ff';
    ctx.fillText('x(t)', padL + 6, 11);
    ctx.fillStyle = '#f472b6';
    ctx.fillText('y(t)', padL + 46, 11);
    ctx.fillStyle = tr.color;
    ctx.fillText(`轨线 #${st.selected + 1}  起点 ${fmtVec(tr.x0, tr.y0)}`, padL + 90, 11);
  }

  // ------------------------------------------------------------------ hover / coordinates
  function updateCoords(x, y) {
    const [u, v] = F(x, y);
    coordCard.innerHTML = '';
    coordCard.append(
      h('div', { class: 'title' }, '光标'),
      h('div', { class: 'big' }, `(x, y) = ${fmtVec(x, y, 3)}`),
      h('div', { class: 'big', style: { color: C.text2, marginTop: '2px' } }, `(ẋ, ẏ) = ${fmtVec(u, v, 3)}`));
  }

  function eqAt(px, py) {
    if (!st.show.equilibria) return null;
    let best = null, bd = 12;
    for (const e of st.eq) {
      const d = Math.hypot(vp.sx(e.x) - px, vp.sy(e.y) - py);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function eigenText(e) {
    return e.eigen.real ? `λ = ${fmt(e.eigen.real[0], 3)}, ${fmt(e.eigen.real[1], 3)}` : `λ = ${fmtComplex(e.eigen.re, e.eigen.im, 3)}, ${fmtComplex(e.eigen.re, -e.eigen.im, 3)}`;
  }

  function showTip(e, px, py) {
    if (!e) { tip.style.display = 'none'; return; }
    tip.style.display = '';
    tip.style.left = `${px}px`;
    tip.style.top = `${py}px`;
    tip.innerHTML = '';
    tip.append(
      h('div', { class: 't-title', style: { color: (EQ_STYLE[e.type] || EQ_STYLE.degenerate).color } }, e.label),
      h('div', { class: 't-mono' }, `(${fmt(e.x, eqDigits)}, ${fmt(e.y, eqDigits)})`),
      h('div', { class: 't-mono' }, eigenText(e)),
      h('div', { class: 't-mono' }, `tr J = ${fmt(e.tr, 3)}, det J = ${fmt(e.det, 3)}`));
  }

  // ------------------------------------------------------------------ scheduling
  let baseDirty = true;
  const markBase = () => { baseDirty = true; };
  // Slider input can fire several times per frame: record what is stale and recompute it once,
  // at the start of the next animation frame (or immediately when asked to).
  const pending = { traj: false, structure: false };
  function invalidateAll({ trajectories = true, structureNow = false } = {}) {
    if (trajectories) pending.traj = true;
    pending.structure = true;
    if (structureNow) flushPending();
    markBase();
  }
  function flushPending() {
    if (pending.traj) { pending.traj = false; recomputeTrajectories(); }
    if (pending.structure) { pending.structure = false; measureFlow(); recomputeStructure(); }
  }

  const loop = animationLoop((dt) => {
    flushPending();
    if (baseDirty) { drawBase(); baseDirty = false; }
    st.tAnim += dt * st.speed * 1.5;
    if (st.show.particles) stepParticles(dt);
    drawFx();
    if (st.show.series) drawSeries();
  });

  // ------------------------------------------------------------------ interaction
  let viewTimer = 0;
  const detach = attachPointer(base.canvas, vp, {
    onClick(x, y) {
      hint.style.opacity = 0;
      addTrajectory(x, y);
      markBase();
    },
    onHover(px, py, x, y) {
      updateCoords(x, y);
      const e = eqAt(px, py);
      st.hover = e ? { x: e.x, y: e.y } : null;
      showTip(e, px, py);
    },
    onLeave() { st.hover = null; tip.style.display = 'none'; },
    onView() {
      hint.style.opacity = 0;
      for (let i = 0; i < NP; i++) P.n[i] = 0;
      markBase();
      clearTimeout(viewTimer);
      viewTimer = setTimeout(() => { invalidateAll(); syncQuery(); }, 120);
    },
  });
  const stopResize = observeSize(root, (w, hh) => {
    const first = vp.w <= 1;
    base.resize(w, hh);
    fx.resize(w, hh);
    vp.setSize(w, hh);
    const r = strip.getBoundingClientRect();
    stripLayer.resize(r.width, r.height);
    if (first) applyView(st.preset.view);
    resetParticles();
    invalidateAll({ structureNow: true });
  });

  function applyView(v) {
    // keep the time-series strip from covering the region of interest
    vp.fit(v[0], v[1], v[2], v[3], 0.04, st.show.series ? { bottom: (strip.offsetHeight || 128) + 20 } : null);
  }

  // ------------------------------------------------------------------ panel
  const presetChips = chips({ items: PRESETS_2D.map((p) => ({ id: p.id, label: p.label })), value: st.preset.id, onPick: (id) => loadPreset(PRESETS_2D.find((p) => p.id === id)), id: 'ode2d-presets' });
  const fField = exprField({ prefix: 'ẋ =', id: 'ode-f', compile: (src) => realFunction(src, VARS), onValid: (fn, src) => { st.fx = fn; st.fSrc = src; presetChips.set(null); invalidateAll(); syncQuery(); } });
  const gField = exprField({ prefix: 'ẏ =', id: 'ode-g', compile: (src) => realFunction(src, VARS), onValid: (fn, src) => { st.fy = fn; st.gSrc = src; presetChips.set(null); invalidateAll(); syncQuery(); } });
  const note = h('div', { class: 'note', id: 'ode-note' });
  const paramBox = h('div', { class: 'field', style: { gap: '10px' } });
  const sliders = {};
  for (const k of ['a', 'b', 'c', 'd']) {
    sliders[k] = slider({
      label: k, min: -2, max: 2, step: 0.001, value: st.p[k], id: `param-${k}`,
      onInput: (v) => { st.p[k] = v; invalidateAll(); syncQueryLater(); },
    });
    paramBox.append(sliders[k].el);
  }
  const trajCount = h('span', null, '0');
  const tg = (key, text, swatch) => toggle({ label: text, value: st.show[key], swatch, id: `ode-show-${key}`, onChange: (v) => {
    st.show[key] = v;
    if (key === 'series') strip.style.display = v ? '' : 'none';
    if (key === 'nullclines' || key === 'separatrices') recomputeStructure();
    if (key === 'particles') resetParticles();
    markBase();
  } });
  const eqList = h('div', { class: 'field', id: 'eq-list', style: { gap: '6px' } });

  const panelEl = h('div', null,
    section('系统', [
      presetChips.el,
      fField.el,
      gField.el,
      h('div', { class: 'hint', html: '变量 <code>x</code> <code>y</code> <code>t</code>，参数 <code>a</code> <code>b</code> <code>c</code> <code>d</code>（下方滑块），函数 sin cos exp log sqrt abs tanh min max mod …' }),
      note,
    ]),
    section('参数', [paramBox], { aside: '拖动实时更新' }),
    section('轨线', [
      h('div', { class: 'hint' }, '在相平面上单击：从该点向前、向后积分（自适应 Dormand–Prince 5(4)，相对误差 10⁻⁸）。'),
      slider({ label: '积分时长 <span class="math">T</span>（双向）', min: 5, max: 200, step: 1, value: st.T, format: (v) => fmt(v, 0), onInput: (v) => { st.T = v; recomputeTrajectories(); markBase(); } }).el,
      slider({ label: '动画速度', min: 0.1, max: 4, step: 0.05, value: st.speed, format: (v) => `${fmt(v, 2)}×`, onInput: (v) => { st.speed = v; } }).el,
      h('div', { class: 'btn-row' },
        button({ label: '撤销', small: true, onClick: () => { st.trajs.pop(); st.selected = st.trajs.length - 1; trajCount.textContent = String(st.trajs.length); markBase(); syncQuery(); } }),
        button({ label: '清除全部', small: true, iconName: 'trash', id: 'clear-trajs', onClick: () => { st.trajs = []; st.selected = -1; trajCount.textContent = '0'; markBase(); syncQuery(); } })),
      h('div', { class: 'hint' }, '当前轨线数：', trajCount),
    ]),
    section('显示', [
      h('div', { class: 'toggles two' },
        tg('field', '方向场', '#a35bd0').el,
        tg('particles', '流动粒子', '#c8dcff').el,
        tg('nullclines', 'ẋ = 0 / ẏ = 0', '#fb923c').el,
        tg('equilibria', '平衡点', '#4ade80').el,
        tg('separatrices', '分界线', '#fb7185').el,
        tg('dots', '运动质点', '#ffffff').el,
        tg('series', '时间序列', '#7aa2ff').el),
      h('div', { class: 'hint', html: '零倾线：<span style="color:#fb923c">橙</span> ẋ = 0，<span style="color:#a78bfa">紫</span> ẏ = 0；分界线：<span style="color:#fb7185">红</span> 不稳定流形，<span style="color:#60a5fa">蓝</span> 稳定流形。平衡点：<span style="color:#4ade80">●</span> 稳定、<span style="color:#fb7185">○</span> 不稳定、<span style="color:#fbbf24">◆</span> 鞍点、<span style="color:#22d3ee">◎</span> 中心。' }),
    ]),
    section('平衡点', [eqList], { aside: '牛顿法 + 雅可比矩阵' }),
  );
  panel.append(panelEl);

  let eqKey = '';
  function updateEqList() {
    // rebuilt only when the (rounded) content changes: DOM churn every frame forces panel layout
    const key = st.eq.slice(0, 8).map((e) => `${e.type}${fmtVec(e.x, e.y, 3)}${eigenText(e)}`).join('|') + st.eq.length;
    if (key === eqKey) return;
    eqKey = key;
    eqList.textContent = '';
    if (!st.eq.length) { eqList.append(h('div', { class: 'hint' }, '视野内没有找到平衡点。')); return; }
    for (const e of st.eq.slice(0, 8)) {
      eqList.append(h('div', { class: 'note', style: { padding: '8px 10px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
          h('b', { style: { color: (EQ_STYLE[e.type] || EQ_STYLE.degenerate).color, fontWeight: 600 } }, e.label),
          h('span', { style: { fontFamily: MONO, fontSize: '12px' } }, fmtVec(e.x, e.y, tol.hp ? 8 : 3))),
        h('div', { style: { fontFamily: MONO, fontSize: '11.5px', color: C.text3 } }, eigenText(e))));
    }
    if (st.eq.length > 8) eqList.append(h('div', { class: 'hint' }, `…以及另外 ${st.eq.length - 8} 个`));
  }

  function loadPreset(p, { keepTrajs = false, params = null } = {}) {
    st.preset = p;
    presetChips.set(p.id);
    compile(p.f, p.g);
    fField.set(p.f, false);
    gField.set(p.g, false);
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
    if (vp.w > 1) applyView(p.view);
    if (!keepTrajs) {
      st.trajs = [];
      st.selected = -1;
      for (const [x, y] of p.seeds) addTrajectory(x, y);
    }
    resetParticles();
    invalidateAll({ structureNow: vp.w > 1 });
    syncQuery();
  }

  let qTimer = 0;
  function syncQueryLater() { clearTimeout(qTimer); qTimer = setTimeout(syncQuery, 250); }
  function syncQuery() {
    if (!active()) return;
    const q = { mode: '2d' };
    if (presetChips && st.preset && st.fSrc === st.preset.f && st.gSrc === st.preset.g) q.p = st.preset.id;
    else { q.f = st.fSrc; q.g = st.gSrc; }
    q.k = ['a', 'b', 'c', 'd'].map((k) => +st.p[k].toFixed(4)).join(',');
    q.s = st.trajs.map((tr) => `${+tr.x0.toFixed(3)}_${+tr.y0.toFixed(3)}`).join(';');
    setQuery(q);
  }

  // ------------------------------------------------------------------ initial state from URL
  {
    const p = PRESETS_2D.find((q) => q.id === query.get('p')) || PRESETS_2D[0];
    const k = (query.get('k') || '').split(',').map(Number);
    const params = k.length === 4 && k.every(Number.isFinite) ? { a: k[0], b: k[1], c: k[2], d: k[3] } : null;
    loadPreset(p, { params });
    if (query.get('f') && query.get('g')) {
      try {
        compile(query.get('f'), query.get('g'));
        fField.set(st.fSrc, false);
        gField.set(st.gSrc, false);
        presetChips.set(null);
        for (const key of ['a', 'b', 'c', 'd']) { sliders[key].el.style.display = ''; if (params) { st.p[key] = params[key]; sliders[key].set(params[key]); } }
      } catch { /* keep preset */ }
    }
    if (query.has('s')) {
      st.trajs = [];
      for (const pair of query.get('s').split(';').filter(Boolean)) {
        const [x, y] = pair.split('_').map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) st.trajs.push({ x0: x, y0: y, color: TRAJ_COLORS[st.trajs.length % TRAJ_COLORS.length], pts: new Float64Array(0), t0: 0, t1: 0 });
      }
      st.selected = st.trajs.length - 1;
      trajCount.textContent = String(st.trajs.length);
    }
  }

  return {
    panel: panelEl,
    start() { loop.start(); },
    stop() { loop.stop(); },
    help: {
      tips: [
        '单击相平面任意一点，从该点出发向前、向后积分得到一条轨线；白色质点沿轨线按真实时间运动，下方面板同步画出 x(t)、y(t)。',
        '平衡点通过牛顿法求得，用数值雅可比矩阵的迹与行列式分类；悬停查看特征值。',
        '鞍点的稳定 / 不稳定流形（分界线）由沿特征向量方向微小偏移后反向 / 正向积分得到。',
        '参数滑块实时驱动方向场、零倾线、平衡点与全部轨线的重新计算——拖动霍普夫分岔的 μ 过 0 观察极限环诞生。',
      ],
      keys: [['单击', '添加轨线'], ['Backspace', '删除最后一条轨线'], ['C', '清除全部轨线']],
    },
    onKey(e) {
      if (e.key === 'Backspace') { st.trajs.pop(); st.selected = st.trajs.length - 1; trajCount.textContent = String(st.trajs.length); markBase(); e.preventDefault(); }
      if (e.key === 'c' || e.key === 'C') { st.trajs = []; st.selected = -1; trajCount.textContent = '0'; markBase(); }
    },
    snapshot() {
      const c = document.createElement('canvas');
      c.width = base.canvas.width; c.height = base.canvas.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(base.canvas, 0, 0);
      ctx.drawImage(fx.canvas, 0, 0);
      return c;
    },
    state: () => ({
      mode: '2d', preset: st.preset.id, f: st.fSrc, g: st.gSrc, p: { ...st.p },
      trajectories: st.trajs.map((t) => ({ x0: t.x0, y0: t.y0, n: t.pts.length / 3, t0: t.t0, t1: t.t1 })),
      equilibria: st.eq.map((e) => ({ x: e.x, y: e.y, type: e.type })),
      separatrices: st.seps.length,
      nullclineSegments: (st.null.f?.length || 0) / 4 + (st.null.g?.length || 0) / 4,
    }),
    setParam(k, v) { st.p[k] = v; sliders[k].set(v); invalidateAll({ structureNow: true }); },
    worldToClient(x, y) { const r = base.canvas.getBoundingClientRect(); return [r.left + vp.sx(x), r.top + vp.sy(y)]; },
    destroy() {
      loop.stop();
      clearTimeout(viewTimer); clearTimeout(qTimer);
      detach();
      stopResize();
      root.remove();
      panelEl.remove();
    },
  };
}
