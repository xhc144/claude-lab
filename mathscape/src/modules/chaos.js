// Module 7 — chaos in one-dimensional maps: the bifurcation diagram of x ↦ f_r(x), the Lyapunov
// exponent λ(r), cobweb plots, and the Feigenbaum constants computed from superstable cycles.

import { h } from '../ui/dom.js';
import { Layer, observeSize, animationLoop } from '../ui/canvas.js';
import { section, slider, toggle, chips, readout, button } from '../ui/controls.js';
import { fmt } from '../ui/format.js';
import { C, MONO, FONT, alpha, ramp } from '../ui/theme.js';
import { tolerances } from '../ui/settings.js';
import { evalConstant } from '../core/expr.js';
import * as B from '../core/bigreal.js';
import { MAPS, detectPeriod, lyapunov, bifurcationColumn, feigenbaum, aitken, FEIGENBAUM_DELTA, FEIGENBAUM_ALPHA } from '../core/chaos.js';

const R_INF = 3.5699456718709449;
const R_PRESETS = [
  { id: 'p2', label: '周期 2', r: 3.2 },
  { id: 'p4', label: '周期 4', r: 3.5 },
  { id: 'onset', label: '混沌开端 r∞', r: R_INF },
  { id: 'p3', label: '周期 3 窗口', r: 1 + Math.sqrt(8) + 0.001 },
  { id: 'inter', label: '阵发混沌', r: 1 + Math.sqrt(8) - 0.0005 },
  { id: 'full', label: '完全混沌 r = 4', r: 4 },
];
const LAMBDA_H = 92; // λ strip height
const PAD = { l: 46, r: 14, t: 14, b: 26, gap: 30 };

function create({ stage, panel, toast, query, setQuery }) {
  const tol = tolerances();
  const st = {
    map: MAPS[query.get('m')] ? query.get('m') : 'logistic',
    r: 3.56,
    x0: 0.3,
    view: null, // { r0, r1, y0, y1 }
    history: [],
    show: { lambda: true, markers: true },
    samples: tol.hp ? 4000 : 1200,
  };
  const qr = Number(query.get('r'));
  if (Number.isFinite(qr) && query.get('r')) st.r = qr;
  const qv = (query.get('v') || '').split(',').map(Number);
  st.view = qv.length === 4 && qv.every(Number.isFinite) && qv[1] > qv[0] && qv[3] > qv[2]
    ? { r0: qv[0], r1: qv[1], y0: qv[2], y1: qv[3] } : defaultView();
  function defaultView() { const m = MAPS[st.map]; return { r0: m.view[0], r1: m.view[1], y0: 0, y1: 1 }; }
  const map = () => MAPS[st.map];

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const info = h('div', { class: 'overlay-card tl', id: 'chaos-info', style: { left: `${PAD.l + 8}px` } });
  const hint = h('div', { class: 'stage-hint', style: { bottom: `${LAMBDA_H + PAD.b + PAD.gap + 18}px` } }, '单击设定 r · 拖出方框放大 · 滚轮缩放 · Backspace 返回上一视图');
  stage.append(info, hint);

  // ------------------------------------------------------------------ geometry
  const G = { W: 0, H: 0, x0: 0, x1: 0, y0: 0, y1: 0, ly0: 0, ly1: 0 };
  function layout() {
    G.W = layer.w; G.H = layer.h;
    G.x0 = PAD.l; G.x1 = G.W - PAD.r;
    G.y0 = PAD.t;
    G.y1 = G.H - PAD.b - (st.show.lambda ? LAMBDA_H + PAD.gap : 0);
    G.ly0 = G.y1 + PAD.gap; G.ly1 = G.ly0 + LAMBDA_H;
  }
  const rx = (r) => G.x0 + ((r - st.view.r0) / (st.view.r1 - st.view.r0)) * (G.x1 - G.x0);
  const xr = (px) => st.view.r0 + ((px - G.x0) / (G.x1 - G.x0)) * (st.view.r1 - st.view.r0);
  const yy = (x) => G.y0 + ((st.view.y1 - x) / (st.view.y1 - st.view.y0)) * (G.y1 - G.y0);

  // ------------------------------------------------------------------ progressive diagram
  const img = document.createElement('canvas');
  const imgCtx = img.getContext('2d');
  let job = null;
  let lambdas = new Float32Array(0);
  function restart() {
    layout();
    const dpr = layer.dpr;
    const cols = Math.max(1, Math.round((G.x1 - G.x0) * dpr));
    const rows = Math.max(1, Math.round((G.y1 - G.y0) * dpr));
    img.width = cols;
    img.height = rows;
    job = { cols, rows, col: 0, counts: new Float32Array(rows), data: imgCtx.createImageData(cols, rows), view: { ...st.view }, map: st.map };
    lambdas = new Float32Array(cols).fill(NaN);
    drawAll();
  }
  function work(budget = 10) {
    if (!job || job.col >= job.cols) return false;
    const t0 = performance.now();
    const { f, df } = MAPS[job.map];
    const { r0, r1, y0, y1 } = job.view;
    const lnS = Math.log(1 + st.samples / 6);
    while (job.col < job.cols && performance.now() - t0 < budget) {
      const c = job.col++;
      const r = r0 + ((c + 0.5) / job.cols) * (r1 - r0);
      job.counts.fill(0);
      bifurcationColumn(f, r, st.x0, 400, st.samples, y0, y1, job.rows, job.counts);
      const d = job.data.data;
      for (let row = 0; row < job.rows; row++) {
        const n = job.counts[row];
        const q = 4 * (row * job.cols + c);
        if (n === 0) { d[q + 3] = 0; continue; }
        const t = Math.min(1, Math.log(1 + n) / lnS);
        const [R, Gc, Bc] = ramp(0.25 + 0.75 * t);
        d[q] = R; d[q + 1] = Gc; d[q + 2] = Bc; d[q + 3] = Math.min(255, 90 + 200 * t);
      }
      if (st.show.lambda) lambdas[c] = lyapunov(f, df, r, st.x0, { transient: 300, n: tol.hp ? 3000 : 800 });
    }
    imgCtx.putImageData(job.data, 0, 0);
    return true;
  }

  // ------------------------------------------------------------------ drawing
  let box = null; // rubber band
  function drawAll() {
    const { ctx } = layer;
    layer.reset();
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, G.W, G.H);
    // diagram
    ctx.fillStyle = '#080b11';
    ctx.fillRect(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0);
    ctx.imageSmoothingEnabled = false;
    if (job) ctx.drawImage(img, G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0);
    axes(ctx);
    if (st.show.markers && st.map === 'logistic') drawMarkers(ctx);
    if (st.show.lambda) drawLambda(ctx);
    // r cursor
    const px = rx(st.r);
    if (px >= G.x0 && px <= G.x1) {
      ctx.save();
      ctx.strokeStyle = alpha(C.cyan, 0.85);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px, G.y0);
      ctx.lineTo(px, st.show.lambda ? G.ly1 : G.y1);
      ctx.stroke();
      ctx.fillStyle = C.cyan;
      ctx.beginPath();
      ctx.moveTo(px, G.y1);
      ctx.lineTo(px - 6, G.y1 + 9);
      ctx.lineTo(px + 6, G.y1 + 9);
      ctx.fill();
      ctx.restore();
    }
    if (box) {
      ctx.save();
      ctx.strokeStyle = alpha(C.accent, 0.9);
      ctx.fillStyle = alpha(C.accent, 0.1);
      ctx.setLineDash([5, 4]);
      const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1);
      ctx.fillRect(x, y, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
      ctx.strokeRect(x, y, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
      ctx.restore();
    }
  }

  function ticks(a, b, n = 6) {
    const raw = (b - a) / n;
    const p = 10 ** Math.floor(Math.log10(raw));
    const m = raw / p;
    const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
    const out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return { out, step };
  }
  const tickText = (v, step) => {
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return v.toFixed(Math.min(12, d)).replace('-', '−');
  };

  function axes(ctx) {
    ctx.save();
    ctx.font = `10.5px ${MONO}`;
    ctx.fillStyle = C.text3;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    const tr = ticks(st.view.r0, st.view.r1, 8);
    ctx.textAlign = 'center';
    for (const v of tr.out) {
      const x = rx(v);
      ctx.beginPath(); ctx.moveTo(x, G.y0); ctx.lineTo(x, G.y1); ctx.stroke();
      ctx.fillText(tickText(v, tr.step), x, (st.show.lambda ? G.ly1 : G.y1) + 16);
    }
    const ty = ticks(st.view.y0, st.view.y1, 5);
    ctx.textAlign = 'right';
    for (const v of ty.out) {
      const y = yy(v);
      ctx.beginPath(); ctx.moveTo(G.x0, y); ctx.lineTo(G.x1, y); ctx.stroke();
      ctx.fillText(tickText(v, ty.step), G.x0 - 6, y + 3.5);
    }
    ctx.fillStyle = C.text2;
    ctx.font = `italic 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('x', 8, G.y0 + 10);
    ctx.fillText('r', 12, (st.show.lambda ? G.ly1 : G.y1) + 16);
    ctx.restore();
  }

  let markers = [];
  function drawMarkers(ctx) {
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'center';
    let lastLabel = -Infinity;
    for (const m of markers) {
      const x = rx(m.r);
      if (x < G.x0 || x > G.x1) continue;
      ctx.strokeStyle = alpha(C.v, 0.35);
      ctx.beginPath(); ctx.moveTo(x, G.y0); ctx.lineTo(x, G.y1); ctx.stroke();
      if (x - lastLabel < 18) continue; // the markers crowd towards r∞: label only where there is room
      lastLabel = x;
      ctx.fillStyle = alpha(C.v, 0.85);
      ctx.fillText(m.label, x, G.y0 + 10);
    }
    ctx.restore();
  }

  function drawLambda(ctx) {
    ctx.save();
    ctx.fillStyle = '#080b11';
    ctx.fillRect(G.x0, G.ly0, G.x1 - G.x0, LAMBDA_H);
    const lo = -2.5, hi = 1;
    const ly = (v) => G.ly0 + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * LAMBDA_H;
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
    ctx.beginPath(); ctx.moveTo(G.x0, ly(0)); ctx.lineTo(G.x1, ly(0)); ctx.stroke();
    const n = lambdas.length;
    const wpx = (G.x1 - G.x0) / Math.max(1, n);
    for (let c = 0; c < n; c++) {
      const v = lambdas[c];
      if (!Number.isFinite(v)) continue;
      ctx.fillStyle = v > 0 ? 'rgba(255, 107, 129, 0.75)' : 'rgba(122, 162, 255, 0.55)';
      const y = ly(v), y0 = ly(0);
      ctx.fillRect(G.x0 + c * wpx, Math.min(y, y0), Math.max(1, wpx), Math.abs(y - y0) || 1);
    }
    ctx.font = `10.5px ${FONT}`;
    ctx.fillStyle = C.text3;
    ctx.textAlign = 'right';
    ctx.fillText('λ', G.x0 - 8, G.ly0 + 12);
    ctx.font = `10px ${MONO}`;
    ctx.fillText('0', G.x0 - 6, ly(0) + 3.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 107, 129, 0.9)';
    ctx.fillText('λ > 0 混沌', G.x0 + 6, G.ly0 + 12);
    ctx.fillStyle = 'rgba(122, 162, 255, 0.9)';
    ctx.fillText('λ < 0 周期', G.x0 + 76, G.ly0 + 12);
    ctx.restore();
  }

  // ------------------------------------------------------------------ interaction
  let press = null;
  const local = (e) => { const r = layer.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const inPlot = (x, y) => x >= G.x0 && x <= G.x1 && y >= G.y0 && y <= (st.show.lambda ? G.ly1 : G.y1);
  layer.canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e);
    if (!inPlot(x, y)) return;
    layer.canvas.setPointerCapture?.(e.pointerId);
    press = { x, y, moved: false };
    e.preventDefault();
  });
  layer.canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    layer.canvas.style.cursor = inPlot(x, y) ? 'crosshair' : 'default';
    if (!press) return;
    if (Math.hypot(x - press.x, y - press.y) > 5) press.moved = true;
    if (press.moved && press.y <= G.y1) {
      box = { x0: press.x, y0: press.y, x1: Math.max(G.x0, Math.min(G.x1, x)), y1: Math.max(G.y0, Math.min(G.y1, y)) };
      drawAll();
    } else if (!press.moved || press.y > G.y1) {
      setR(xr(x), { quiet: true });
    }
  });
  const release = (e) => {
    if (!press) return;
    const [x] = local(e);
    if (box && Math.abs(box.x1 - box.x0) > 8 && Math.abs(box.y1 - box.y0) > 8) {
      const ra = xr(Math.min(box.x0, box.x1)), rb = xr(Math.max(box.x0, box.x1));
      const ya = st.view.y1 - ((Math.max(box.y0, box.y1) - G.y0) / (G.y1 - G.y0)) * (st.view.y1 - st.view.y0);
      const yb = st.view.y1 - ((Math.min(box.y0, box.y1) - G.y0) / (G.y1 - G.y0)) * (st.view.y1 - st.view.y0);
      setView({ r0: ra, r1: rb, y0: ya, y1: yb });
    } else if (!press.moved) {
      setR(xr(x));
    }
    box = null;
    press = null;
    hint.style.opacity = 0;
    drawAll();
    syncQuery();
  };
  layer.canvas.addEventListener('pointerup', release);
  layer.canvas.addEventListener('pointercancel', release);
  layer.canvas.addEventListener('wheel', (e) => {
    const [x, y] = local(e);
    if (!inPlot(x, y) || y > G.y1) return;
    e.preventDefault();
    const f = Math.exp((e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0015);
    const r = xr(x), xv = st.view.y1 - ((y - G.y0) / (G.y1 - G.y0)) * (st.view.y1 - st.view.y0);
    const v = st.view;
    setView({ r0: r - (r - v.r0) * f, r1: r + (v.r1 - r) * f, y0: xv - (xv - v.y0) * f, y1: xv + (v.y1 - xv) * f }, { push: false });
  }, { passive: false });
  layer.canvas.style.touchAction = 'none';

  function setView(v, { push = true } = {}) {
    const m = map();
    const minW = 1e-12;
    if (v.r1 - v.r0 < minW || v.y1 - v.y0 < minW) { toast('已到双精度能分辨的最小范围'); return; }
    if (push) st.history.push({ ...st.view });
    st.view = { r0: Math.max(m.range[0], v.r0), r1: Math.min(m.range[1], v.r1), y0: v.y0, y1: v.y1 };
    restart();
    scheduleSync();
  }
  function back() {
    if (!st.history.length) { setView(defaultView(), { push: false }); return; }
    setView(st.history.pop(), { push: false });
  }

  // ------------------------------------------------------------------ r and the cobweb
  const cobCanvas = h('canvas', { class: 'panel-canvas', id: 'cobweb', width: 300, height: 300 });
  const seriesCanvas = h('canvas', { class: 'panel-canvas', id: 'series', width: 300, height: 90 });
  const rInput = h('input', { class: 'text-input mono', type: 'text', id: 'chaos-r', 'aria-label': 'r', spellcheck: 'false' });
  const read = readout([['state', '长期行为'], ['lambda', '李雅普诺夫指数 λ'], ['cycle', '吸引环']], { id: 'chaos-readout' });

  function setR(r, { quiet = false } = {}) {
    const m = map();
    st.r = Math.max(m.range[0], Math.min(m.range[1], r));
    if (document.activeElement !== rInput) rInput.value = fmt(st.r, 10);
    rSlider.set(st.r);
    rChips.set(R_PRESETS.find((p) => Math.abs(p.r - st.r) < 1e-12)?.id ?? null);
    updateOrbit();
    drawAll();
    if (!quiet) scheduleSync();
  }

  let lastPeriod = 0, lastLambda = 0;
  function updateOrbit() {
    const { f, df } = map();
    const p = detectPeriod(f, st.r, st.x0);
    const lam = lyapunov(f, df, st.r, st.x0, { n: tol.hp ? 20000 : 4000 });
    lastPeriod = p;
    lastLambda = lam;
    read.set('state', p ? `周期 ${p} 的吸引环` : lam > 0 ? '混沌（对初值敏感）' : '周期很长或收敛很慢', p ? 'good' : lam > 0 ? 'bad' : '');
    read.set('lambda', fmt(lam, tol.hp ? 8 : 4), lam > 0 ? 'bad' : 'good');
    if (p && p <= 8) {
      let x = st.x0;
      for (let k = 0; k < 4000; k++) x = f(st.r, x);
      const cyc = [];
      for (let k = 0; k < p; k++) { cyc.push(x); x = f(st.r, x); }
      read.set('cycle', cyc.sort((a, b) => a - b).map((v) => fmt(v, tol.hp ? 10 : 4)).join(', '));
    } else read.set('cycle', p ? `${p} 个点` : '—');
    drawCobweb();
    info.textContent = '';
    info.append(
      h('div', { class: 'title' }, `${map().label}映射　${map().formula}`),
      h('div', { class: 'big' }, `r = ${fmt(st.r, 8)}`),
      h('div', { class: 'big', style: { color: p ? C.ok : lam > 0 ? C.danger : C.text2 } }, p ? `周期 ${p}` : lam > 0 ? `混沌 · λ = ${fmt(lam, 3)}` : `λ = ${fmt(lam, 3)}`));
  }

  function drawCobweb() {
    const { f } = map();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cobCanvas, seriesCanvas]) {
      const w = c.clientWidth || 300, hh = c === cobCanvas ? w : 90;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
    }
    const ctx = cobCanvas.getContext('2d');
    const S = cobCanvas.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, S, S);
    const p = 0.08 * S;
    const X = (x) => p + x * (S - 2 * p), Y = (y) => S - p - y * (S - 2 * p);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = dpr;
    ctx.strokeRect(X(0), Y(1), X(1) - X(0), Y(0) - Y(1));
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.6 * dpr;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = i / 200; const y = f(st.r, x); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
    ctx.stroke();
    // cobweb: (x, x) → (x, f(x)) → (f(x), f(x)) …
    let x = st.x0;
    const n = 160;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(X(x), Y(0));
    for (let k = 0; k < n; k++) {
      const y = f(st.r, x);
      ctx.lineTo(X(x), Y(y));
      ctx.lineTo(X(y), Y(y));
      x = y;
    }
    ctx.strokeStyle = alpha(C.v, 0.55);
    ctx.stroke();
    ctx.fillStyle = C.text3;
    ctx.font = `${10 * dpr}px ${MONO}`;
    ctx.fillText('x_{n+1} = f(x_n)', X(0) + 4 * dpr, Y(1) + 12 * dpr);
    // time series
    const sc = seriesCanvas.getContext('2d');
    const W = seriesCanvas.width, H = seriesCanvas.height;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.fillStyle = '#0a0d14';
    sc.fillRect(0, 0, W, H);
    sc.strokeStyle = C.cyan;
    sc.lineWidth = 1.2 * dpr;
    sc.beginPath();
    x = st.x0;
    for (let k = 0; k < 80; k++) {
      const px = (k / 79) * (W - 8 * dpr) + 4 * dpr, py = H - 4 * dpr - x * (H - 8 * dpr);
      k ? sc.lineTo(px, py) : sc.moveTo(px, py);
      x = f(st.r, x);
    }
    sc.stroke();
  }

  // ------------------------------------------------------------------ Feigenbaum table
  const feigenBox = h('div', { class: 'feigen', id: 'feigen' }, h('div', { class: 'hint' }, '计算中…'));
  let feigenRows = null;
  let feigenTimer = 0;
  function computeFeigenbaum() {
    const levels = tol.hp ? 16 : 11;
    const t0 = performance.now();
    // in chunks, so the page stays responsive while double-double works through 2¹⁶-cycles
    feigenTimer = setTimeout(() => {
      feigenRows = feigenbaum(levels, { dd: tol.hp });
      markers = feigenRows.slice(1, 9).map((row) => ({ r: tol.hp ? row.r[0] + row.r[1] : row.r, label: `2${'⁰¹²³⁴⁵⁶⁷⁸'[row.n]}` }));
      markers.push({ r: R_INF, label: 'r∞' });
      renderFeigen(performance.now() - t0);
      drawAll();
    }, 30);
  }
  function digitsMatch(est, truth) {
    const s = fmt(est, 15).replace('−', '-');
    let k = 0;
    while (k < s.length && s[k] === truth[k]) k++;
    return `<b class="good">${s.slice(0, k)}</b>${s.slice(k)}`.replace('-', '−');
  }
  function renderFeigen(ms) {
    const rows = feigenRows;
    const rText = (r) => (tol.hp ? B.toDecimal(B.add(B.fromNumber(r[0]), B.fromNumber(r[1]), 40), 26) : fmt(r, 14));
    const table = h('table', { class: 'feigen-table' },
      h('thead', null, h('tr', null, h('th', null, 'n'), h('th', null, '超稳定 rₙ（周期 2ⁿ）'), h('th', null, 'δₙ'))),
      h('tbody', null, rows.map((row) => h('tr', null,
        h('td', null, String(row.n)),
        h('td', { class: 'mono' }, rText(row.r)),
        h('td', { class: 'mono', html: row.delta ? digitsMatch(row.delta, FEIGENBAUM_DELTA) : '' })))));
    const d = rows.map((r) => r.delta);
    const L = d.length - 1;
    const acc = aitken(d[L - 2], d[L - 1], d[L]);
    const alphaRow = rows.filter((r) => r.alpha != null && r.n <= 10).at(-1);
    feigenBox.textContent = '';
    feigenBox.append(table,
      h('dl', { class: 'readout', style: { marginTop: '10px' } },
        h('dt', null, 'δ 的艾特肯加速'), h('dd', { id: 'feigen-aitken', html: digitsMatch(acc, FEIGENBAUM_DELTA) }),
        h('dt', null, '已知 δ'), h('dd', null, FEIGENBAUM_DELTA),
        h('dt', null, `α 估计（n = ${alphaRow.n}）`), h('dd', { html: digitsMatch(alphaRow.alpha, FEIGENBAUM_ALPHA) }),
        h('dt', null, '算术'), h('dd', null, `${tol.hp ? '双倍双精度（约 32 位）' : '双精度（约 16 位）'} · ${fmt(ms / 1000, 2)} s`)),
      h('div', { class: 'hint', html: tol.hp
        ? '高精度用两个双精度数之和表示一个数（约 32 位有效数字），可算到周期 2¹⁶ = 65536 的超稳定环；绿色是与已知 δ 一致的数字。'
        : '双精度在 n ≈ 10 之后，相邻 rₙ 的差已接近舍入误差，δₙ 开始偏离。按 <kbd>P</kbd> 开启高精度，改用双倍双精度算到 n = 16。' }));
  }

  // ------------------------------------------------------------------ panel
  const mapChips = chips({
    id: 'chaos-maps',
    items: Object.entries(MAPS).map(([id, m]) => ({ id, label: m.label })),
    value: st.map,
    onPick: (id) => { st.map = id; st.history = []; st.view = defaultView(); rSlider.setRange(MAPS[id].range[0], MAPS[id].range[1], 0.0001); setR(st.r); restart(); syncQuery(); },
  });
  const rSlider = slider({ label: '参数 <span class="math">r</span>', min: map().range[0], max: map().range[1], step: 0.0001, value: st.r, id: 'chaos-r-slider', format: (v) => fmt(v, 4), onInput: (v) => setR(v) });
  const rChips = chips({ id: 'chaos-r-presets', items: R_PRESETS.map((p) => ({ id: p.id, label: p.label })), onPick: (id) => setR(R_PRESETS.find((p) => p.id === id).r) });
  rInput.addEventListener('input', () => {
    try { const v = evalConstant(rInput.value); if (!Number.isFinite(v)) throw new Error('x'); rInput.classList.remove('invalid'); setR(v); } catch { rInput.classList.add('invalid'); }
  });
  rInput.addEventListener('keydown', (e) => e.stopPropagation());
  const tg = (key, text, swatch) => toggle({ label: text, value: st.show[key], swatch, onChange: (v) => { st.show[key] = v; restart(); } });

  panel.append(
    section('映射', [mapChips.el, h('div', { class: 'hint', id: 'chaos-formula' })]),
    section('参数', [rSlider.el, h('div', { class: 'expr-field field' }, h('div', { class: 'expr-wrap' }, h('span', { class: 'prefix' }, 'r ='), rInput)), rChips.el, read.el]),
    section('蛛网图与时间序列', [cobCanvas, seriesCanvas, h('div', { class: 'hint' }, '黄线从 x₀ 出发：竖直走到曲线 y = f(x)，再水平走到对角线 y = x，如此反复。收敛到一个点是不动点，绕成方框是周期环，乱成一团就是混沌。')]),
    section('费根鲍姆常数', [feigenBox]),
    section('显示', [h('div', { class: 'toggles' },
      tg('lambda', '李雅普诺夫指数 λ(r)', C.danger).el,
      tg('markers', '超稳定参数 rₙ 标记', C.v).el),
    slider({ label: '每列取样数', min: 300, max: 8000, step: 100, value: st.samples, format: (v) => String(v), onInput: (v) => { st.samples = v; restart(); } }).el,
    h('div', { class: 'btn-row' }, button({ label: '返回上一视图', small: true, onClick: back }), button({ label: '复位', small: true, onClick: () => { st.history = []; setView(defaultView(), { push: false }); } }))]),
  );
  const paintFormula = () => { document.getElementById('chaos-formula').textContent = `${map().formula}。横轴是参数 r，纵轴是丢掉前 400 步后轨道到达的位置，越亮表示停留越多。`; };

  // ------------------------------------------------------------------ loop & URL
  const loop = animationLoop(() => {
    if (work()) drawAll();
  });
  let syncTimer = 0;
  const scheduleSync = () => { clearTimeout(syncTimer); syncTimer = setTimeout(syncQuery, 250); };
  function syncQuery() {
    clearTimeout(syncTimer);
    const v = st.view;
    const isDefault = JSON.stringify(v) === JSON.stringify(defaultView());
    setQuery({ m: st.map === 'logistic' ? null : st.map, r: +st.r.toPrecision(12), v: isDefault ? null : [v.r0, v.r1, v.y0, v.y1].map((x) => +x.toPrecision(10)).join(',') });
  }

  const stopResize = observeSize(stage, (w, hh) => {
    layer.resize(w, hh);
    restart();
  });
  paintFormula();
  mapChips.el.addEventListener('click', paintFormula);
  setR(st.r, { quiet: true });
  computeFeigenbaum();
  loop.start();
  syncQuery();

  return {
    help: {
      tips: [
        '横轴 r、纵轴 x：每一竖条是 r 固定时轨道长期停留的位置。一分为二是倍周期分岔，一片云是混沌，云中的空白竖带是周期窗口（最显眼的是 r ≈ 3.83 的周期 3）。',
        '单击设定 r（下方的蛛网图随之变化），拖出方框放大，<kbd>Backspace</kbd> 返回。放大分岔点附近，会看到同样的图案以 δ ≈ 4.669 的比例重复出现。',
        '下方条带是李雅普诺夫指数：红色 λ > 0 表示相邻轨道指数分离（混沌）。',
      ],
      keys: [['← / →', '微调 r（Shift 加大）'], ['Backspace', '返回上一视图']],
    },
    onKey(e) {
      const step = (st.view.r1 - st.view.r0) / ((G.x1 - G.x0) || 1) * (e.shiftKey ? 10 : 1);
      if (e.key === 'ArrowLeft') { setR(st.r - step); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setR(st.r + step); e.preventDefault(); }
      else if (e.key === 'Backspace') { back(); e.preventDefault(); }
    },
    snapshot: () => layer.canvas,
    state: () => ({
      map: st.map, r: st.r, view: { ...st.view }, period: lastPeriod, lambda: lastLambda,
      done: job ? job.col >= job.cols : false, feigen: feigenRows ? feigenRows.map((r) => r.delta) : null, hp: tol.hp,
    }),
    rToClient(r) { const b = layer.canvas.getBoundingClientRect(); return [b.left + rx(r), b.top + (G.y0 + G.y1) / 2]; },
    destroy() {
      loop.stop();
      clearTimeout(syncTimer);
      clearTimeout(feigenTimer);
      stopResize();
    },
  };
}

export default {
  id: 'chaos',
  title: '混沌与分岔',
  short: '混沌',
  subtitle: '一条简单的公式 x ↦ r·x(1 − x)，从稳定、倍周期到混沌，以及无处不在的费根鲍姆常数',
  icon: 'chaos',
  create,
};
