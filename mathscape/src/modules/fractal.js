// Module 5 — escape-time fractals: Mandelbrot, Julia, Burning Ship, Newton. Progressive rendering
// on a pool of Web Workers; in high precision the Mandelbrot and Julia sets zoom far past the
// double-precision limit by perturbation around a BigInt reference orbit (see core/fractal.js).

import { h } from '../ui/dom.js';
import { Layer, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { section, slider, toggle, segmented, button, chips, readout, iconButton } from '../ui/controls.js';
import { fmt } from '../ui/format.js';
import { C } from '../ui/theme.js';
import { highPrecision, updateSettings } from '../ui/settings.js';
import { createPool } from '../ui/pool.js';
import { evalConstant } from '../core/expr.js';
import * as B from '../core/bigreal.js';
import {
  escape, perturb, newton, renderRows, referenceOrbit, seriesApprox, toFixed, orbit, attractingPeriod, autoIterations, PALETTES, paletteLUT,
} from '../core/fractal.js';

const KINDS = {
  mandelbrot: { label: '曼德博', note: 'z ↦ z² + c，从 z₀ = 0 出发。让轨道保持有界的参数 c 组成曼德博集（黑色）；颜色表示 |z| 逃出半径 256 所需的平滑步数。' },
  julia: { label: '朱利亚', note: '固定 c，从每个像素 z₀ 出发迭代 z ↦ z² + c。c 落在曼德博集内时朱利亚集连成一片，落在集外时碎成“康托尘埃”。' },
  ship: { label: '燃烧之船', note: 'z ↦ (|Re z| + i·|Im z|)² + c。取绝对值破坏了解析性，于是长出船帆与桅杆般的结构（按惯例虚轴朝下画）。' },
  newton: { label: '牛顿', note: '对 z³ − 1 做牛顿迭代 z ↦ z − (z³ − 1)/(3z²)。颜色表示收敛到三个立方根中的哪一个，明暗表示步数；三片吸引域的边界在每一点处都相互交汇。' },
};
const DEEP = new Set(['mandelbrot', 'julia']); // kinds with perturbation deep zoom

const SPIRAL = ['-0.743643887037158704752191506114774', '0.131825904205311970493132056385139'];
const LOCATIONS = {
  mandelbrot: [
    { id: 'full', label: '全景', x: '-0.65', y: '0', s: 3.3 },
    { id: 'seahorse', label: '海马谷', x: '-0.7445', y: '0.1215', s: 0.024 },
    { id: 'elephant', label: '大象谷', x: '0.2725', y: '0.0067', s: 0.016 },
    { id: 'spiral', label: '双螺旋', x: SPIRAL[0], y: SPIRAL[1], s: 2e-6 },
    { id: 'mini', label: '迷你副本', x: '-1.7548776662466927', y: '0', s: 0.034 },
    { id: 'dendrite', label: '枝晶尖 c = i', x: '0', y: '1', s: 0.02 },
    { id: 'deep', label: '深处 10⁻²⁰', x: SPIRAL[0], y: SPIRAL[1], s: 3e-20, hp: true },
  ],
  julia: [
    { id: 'full', label: '全景', x: '0', y: '0', s: 3.3 },
    { id: 'zoom', label: '局部放大', x: '0.32', y: '0.05', s: 0.2 },
  ],
  ship: [
    { id: 'full', label: '全景', x: '-0.45', y: '0.45', s: 3.6 },
    { id: 'armada', label: '舰队', x: '-1.7625', y: '0.035', s: 0.09 },
  ],
  newton: [
    { id: 'full', label: '全景', x: '0', y: '0', s: 3.2 },
    { id: 'meet', label: '三叶交汇', x: '-0.42', y: '0.24', s: 0.3 },
  ],
};
const JULIAS = [
  { id: 'rabbit', label: '兔子', c: [-0.123, 0.745] },
  { id: 'dragon', label: '闪电', c: [-0.8, 0.156] },
  { id: 'spiral', label: '螺旋', c: [0.285, 0.01] },
  { id: 'basilica', label: '巴西利卡', c: [-1, 0] },
  { id: 'dendrite', label: '枝晶', c: [0, 1] },
  { id: 'galaxy', label: '星系', c: [-0.7269, 0.1889] },
  { id: 'dust', label: '尘埃', c: [0.38, 0.32] },
];

const NEWTON_HUES = [[255, 107, 129], [122, 162, 255], [251, 191, 36]];
const DIVE_RATE = 0.55; // e-folds of zoom per second while diving (×1.7 / s)
const MAX_ITER = 300000;

const fmtSci = (x, d = 2) => {
  if (!(x > 0)) return '0';
  if (x >= 1e-3 && x < 1e5) return fmt(x, d + 1);
  const e = Math.floor(Math.log10(x));
  const m = x / 10 ** e;
  const sup = String(e).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
  return `${fmt(m, d)}×10${sup}`;
};

/** An exact rational for a bigreal value (approximations m·10^e become m·10^e / 1). */
function asRational(x) {
  if (x.q) return x;
  return x.e >= 0 ? B.rat(x.m * B.pow10(x.e)) : B.rat(x.m, B.pow10(-x.e));
}

function create({ stage, panel, toast, query, setQuery }) {
  const hp = highPrecision();
  // ------------------------------------------------------------------ state
  const st = {
    kind: KINDS[query.get('k')] ? query.get('k') : 'mandelbrot',
    cx: B.fromDecimal('-0.65'),
    cy: B.ZERO,
    span: 3.3,
    julia: [-0.123, 0.745],
    palette: PALETTES[query.get('p')] ? query.get('p') : 'aurora',
    density: 1,
    offset: 0,
    flow: false,
    iterMul: 1,
    showOrbit: true,
    showJulia: true,
    hover: null, // { px, py }
  };
  try {
    if (query.get('x')) st.cx = B.fromDecimal(query.get('x'));
    if (query.get('y')) st.cy = B.fromDecimal(query.get('y'));
  } catch { /* keep defaults */ }
  const qs = Number(query.get('s'));
  if (qs > 0 && Number.isFinite(qs)) st.span = qs;
  else if (!query.get('x')) Object.assign(st, viewOf(LOCATIONS[st.kind][0]));
  const qj = (query.get('j') || '').split(',').map(Number);
  if (qj.length === 2 && qj.every(Number.isFinite)) st.julia = qj;
  for (const [k, key] of [['d', 'density'], ['o', 'offset'], ['it', 'iterMul']]) {
    const v = Number(query.get(k));
    if (query.get(k) && Number.isFinite(v)) st[key] = v;
  }

  function viewOf(loc) {
    return { cx: B.fromDecimal(loc.x), cy: B.fromDecimal(loc.y), span: loc.s };
  }
  const cxN = () => B.toNumber(st.cx);
  const cyN = () => B.toNumber(st.cy);
  // smallest view width the current arithmetic can resolve
  const minSpan = () => (hp && DEEP.has(st.kind) ? 1e-280 : 4e-13 * Math.max(1, Math.hypot(cxN(), cyN())));
  /** Round the centre to the digits the current zoom needs (keeps the rationals small). */
  function tidyCentre() {
    const D = Math.max(20, Math.ceil(Math.log10(Math.max(1, Math.abs(cxN()), Math.abs(cyN())) / st.span)) + 14);
    st.cx = asRational(B.toApprox(st.cx, D));
    st.cy = asRational(B.toApprox(st.cy, D));
  }
  const centreText = (x) => B.toDecimal(x, Math.max(17, Math.ceil(-Math.log10(st.span)) + 6), { ascii: true });

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const fx = new Layer(stage, { passive: true });
  const buf = document.createElement('canvas');
  const bufCtx = buf.getContext('2d');
  const info = h('div', { class: 'overlay-card tl', id: 'fractal-info' });
  const progress = h('div', { class: 'render-progress' }, h('div', { class: 'bar' }));
  const banner = h('div', { class: 'stage-banner', id: 'fractal-limit', style: { display: 'none' } },
    h('span', null, '已到双精度的极限：再放大，相邻像素的坐标在双精度下已无法区分。'),
    button({ label: '开启高精度，继续放大', small: true, variant: 'primary', onClick: () => updateSettings({ precision: 'high' }) }));
  const tip = h('div', { class: 'tooltip', style: { display: 'none' } });
  const insetCanvas = h('canvas', { class: 'inset-canvas' });
  const insetLabel = h('div', { class: 'inset-label' });
  const inset = h('div', { class: 'overlay-card br inset', id: 'julia-inset', style: { display: 'none' } }, insetCanvas, insetLabel);
  const diveBtn = iconButton({ iconName: 'play', title: '深潜：持续放大（Space）', cls: 'play', id: 'fractal-dive', onClick: () => setDive(!loop.running) });
  const transport = h('div', { class: 'transport' },
    iconButton({ iconName: 'minus', title: '缩小（−）', onClick: () => zoomBy(1 / 2.5) }),
    iconButton({ iconName: 'fit', title: '复位（R）', onClick: () => goTo(LOCATIONS[st.kind][0]) }),
    iconButton({ iconName: 'plus', title: '放大（+）', onClick: () => zoomBy(2.5) }),
    h('div', { class: 'sep' }),
    diveBtn);
  stage.append(info, progress, banner, tip, inset, transport);

  // ------------------------------------------------------------------ render pipeline
  const pool = createPool([escape, perturb, newton, renderRows], 'renderRows');
  const R = {
    w: 0, h: 0, rs: 1, vals: null, pix: null,
    view: null, // { cx, cy, span } the image shows
    token: 0, cancel: null, maxIter: 0, method: '', bits: 0, skip: 0, refLen: 0,
    vMin: 0, done: false, progress: 0, ms: 0, renders: 0, interior: 0, raised: 0, iterFloor: 0, floorSpan: Infinity,
  };
  let lut = paletteLUT(st.palette);
  let refCache = null;

  function resizeBuffers(w, hh) {
    R.rs = Math.min(layer.dpr, 1.5);
    R.w = Math.max(1, Math.round(w * R.rs));
    R.h = Math.max(1, Math.round(hh * R.rs));
    buf.width = R.w;
    buf.height = R.h;
    R.vals = new Float32Array(R.w * R.h).fill(-2);
    R.pix = new ImageData(R.w, R.h);
  }

  /** Paint values → colours for rows [y0, y1). */
  function paint(y0 = 0, y1 = R.h) {
    const { vals, w } = R;
    const d = R.pix.data;
    const newtonKind = R.view?.kind === 'newton';
    const k1 = 0.85 * st.density;
    for (let p = y0 * w, end = y1 * w; p < end; p++) {
      const v = vals[p];
      const q = 4 * p;
      if (v === -2) { d[q + 3] = 0; continue; }
      d[q + 3] = 255;
      if (v < 0) { d[q] = 6; d[q + 1] = 8; d[q + 2] = 13; continue; }
      if (newtonKind) {
        const root = Math.floor(v / 1000), n = v - 1000 * root;
        const base = NEWTON_HUES[root] || NEWTON_HUES[0];
        const shade = 0.2 + 0.8 * Math.exp(-0.16 * n * st.density);
        const t = (((st.offset + 0.06 * n) % 1) + 1) % 1;
        const li = 3 * ((t * 1024) | 0);
        d[q] = shade * (0.8 * base[0] + 0.2 * lut[li]);
        d[q + 1] = shade * (0.8 * base[1] + 0.2 * lut[li + 1]);
        d[q + 2] = shade * (0.8 * base[2] + 0.2 * lut[li + 2]);
        continue;
      }
      // logarithmic scale: comparable numbers of colour cycles at every depth
      let t = k1 * Math.log(1 + (v - R.vMin) / 6) + st.offset;
      t -= Math.floor(t);
      const li = 3 * ((t * 1024) | 0);
      d[q] = lut[li];
      d[q + 1] = lut[li + 1];
      d[q + 2] = lut[li + 2];
    }
    bufCtx.putImageData(R.pix, 0, 0, 0, y0, w, y1 - y0);
  }

  function currentIterations() {
    const auto = autoIterations(st.span, st.kind);
    return Math.min(MAX_ITER, Math.round(Math.max(auto, R.iterFloor) * st.iterMul));
  }

  /**
   * Render the current view. preview = true: coarse passes only (while dragging or diving).
   */
  function startRender({ preview = false } = {}) {
    R.cancel?.();
    if (!R.w) return;
    const token = ++R.token;
    if (!preview) R.renders++;
    const view = { cx: st.cx, cy: st.cy, span: st.span, kind: st.kind, julia: [...st.julia] };
    const w = R.w, hh = R.h;
    const ps = st.span / w;
    let maxIter = currentIterations();
    const t0 = performance.now();
    const cx = cxN(), cy = cyN();
    // perturbation when doubles cannot resolve the pixels (always available in high precision)
    const usePerturb = hp && DEEP.has(st.kind) && ps < 4e-14 * Math.max(1, Math.hypot(cx, cy));
    let sa = null;
    let shared = { ref: null, refLen: 0 };

    const prepare = () => {
      R.method = usePerturb ? 'perturb' : 'double';
      if (!usePerturb) { pool.broadcast({ ref: null, refLen: 0 }); return; }
      // bits in steps of 64, so a dive into a fixed centre reuses the same reference orbit
      const bits = Math.ceil((-Math.log2(ps) + 64) / 64) * 64;
      const isJulia = st.kind === 'julia';
      const key = `${st.kind}|${B.ratString(st.cx)}|${B.ratString(st.cy)}|${isJulia ? st.julia.join(',') : ''}`;
      let orb;
      if (refCache && refCache.key === key && refCache.bits >= bits && refCache.maxIter >= maxIter) {
        orb = refCache.orb;
      } else {
        const X = toFixed(st.cx, bits), Y = toFixed(st.cy, bits);
        const jx = toFixed(B.fromNumber(st.julia[0]), bits), jy = toFixed(B.fromNumber(st.julia[1]), bits);
        orb = isJulia ? referenceOrbit(X, Y, jx, jy, bits, maxIter) : referenceOrbit(0n, 0n, X, Y, bits, maxIter);
        refCache = { key, bits, maxIter, orb };
      }
      // probes at the corners of the view decide how many iterations the series may skip
      const hw = (w / 2) * ps, hh2 = (hh / 2) * ps;
      sa = seriesApprox(orb.ref, orb.len, isJulia, [[-hw, hh2], [hw, hh2], [-hw, -hh2], [hw, -hh2], [0, hh2], [hw, 0]]);
      shared = { ref: orb.ref, refLen: orb.len };
      pool.broadcast(shared);
      Object.assign(R, { bits, skip: sa.skip, refLen: orb.len });
    };
    prepare();

    const passes = preview ? [8, 3] : [8, 3, 1];
    R.view = view;
    R.done = false;
    R.maxIter = maxIter;
    let passIndex = 0;
    let rowsDone = 0;
    const jobsFor = (step) => {
      const rowsPer = Math.max(step, 8 * step);
      const jobs = [];
      for (let y0 = 0; y0 < hh; y0 += rowsPer) {
        jobs.push({
          kind: st.kind, w, h: hh, y0, y1: Math.min(hh, y0 + rowsPer), step, ps, cx, cy,
          jx: st.julia[0], jy: st.julia[1], maxIter, eps: ps * 1e-3 > 1e-15 ? ps * 1e-3 : 0,
          sa: usePerturb ? sa : null, useRef: usePerturb,
        });
      }
      return jobs;
    };
    const onResult = (job, out) => {
      if (token !== R.token) return;
      const { step, y0, y1 } = job;
      const cols = Math.ceil(w / step);
      let k = 0;
      for (let j = y0; j < y1; j += step) {
        for (let i = 0; i < w; i += step) {
          const v = out[k++];
          // fill the step × step block (finer passes overwrite it later)
          const jEnd = Math.min(hh, j + step), iEnd = Math.min(w, i + step);
          for (let jj = j; jj < jEnd; jj++) R.vals.fill(v, jj * w + i, jj * w + iEnd);
        }
      }
      void cols;
      rowsDone += y1 - y0;
      R.progress = (passIndex + rowsDone / hh) / passes.length;
      paint(y0, y1);
      requestDraw();
    };
    const runPass = () => {
      if (token !== R.token) return;
      if (passIndex >= passes.length) {
        R.done = !preview;
        R.ms = performance.now() - t0;
        R.progress = 1;
        updateReadouts();
        requestDraw();
        return;
      }
      rowsDone = 0;
      R.cancel = pool.run(jobsFor(passes[passIndex]), onResult, () => {
        if (token !== R.token) return;
        if (passIndex === 0) {
          // statistics of the coarse pass: colour scale, and whether the iteration cap is too low
          let vMin = Infinity, inside = 0, nearCap = 0, n = 0;
          for (let p = 0; p < R.vals.length; p += 7) {
            const v = R.vals[p];
            if (v === -2) continue;
            n++;
            if (v < 0) inside++;
            else {
              if (v < vMin) vMin = v;
              if (v > 0.5 * maxIter) nearCap++;
            }
          }
          R.interior = n ? inside / n : 0;
          R.vMin = st.kind === 'newton' || !Number.isFinite(vMin) ? 0 : Math.max(0, vMin - 1);
          // many pixels hit the cap while a fair share of the escaping ones only just made it (or
          // none escaped at all): the cap is probably too low — double it and redo
          const capped = nearCap > 0.02 * n || vMin === Infinity;
          if (!preview && st.kind !== 'newton' && R.interior > 0.25 && capped && R.raised < 4 && maxIter < MAX_ITER && st.iterMul >= 1) {
            R.raised++;
            R.iterFloor = Math.min(MAX_ITER, maxIter * (vMin === Infinity ? 4 : 2));
            R.floorSpan = st.span;
            startRender();
            return;
          }
          paint();
        }
        passIndex++;
        runPass();
      });
    };
    runPass();
    updateReadouts();
    progress.style.opacity = 1;
  }

  let renderTimer = 0;
  function requestRender(delay = 0, opts = {}) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => startRender(opts), delay);
  }

  /** View changed by the user: preview the old image transformed, re-render soon. */
  function viewChanged({ quick = false } = {}) {
    // forget a raised iteration floor after zooming far back out
    if (st.span > R.floorSpan * 200) { R.iterFloor = 0; R.floorSpan = Infinity; R.raised = 0; }
    if (st.span < R.floorSpan / 1e6) R.raised = 0;
    clampSpan();
    requestDraw();
    const now = performance.now();
    if (now - lastPreviewAt > 60) { lastPreviewAt = now; startRender({ preview: true }); }
    requestRender(quick ? 60 : 220);
    scheduleSync();
  }
  let lastPreviewAt = 0;

  function clampSpan() {
    const lim = minSpan();
    const limited = st.span < lim;
    if (limited) st.span = lim;
    banner.style.display = limited && !hp && DEEP.has(st.kind) ? '' : 'none';
    if (limited && loop.running) setDive(false);
    if (st.span > 50) st.span = 50;
    return limited;
  }

  // ------------------------------------------------------------------ drawing
  let raf = 0;
  const requestDraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };

  function draw() {
    const { ctx } = layer;
    layer.reset();
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, layer.w, layer.h);
    if (R.view) {
      // where the rendered image sits in the current view (it may be from a previous view)
      const W = layer.w, H = layer.h;
      const k = W / st.span;
      const dx = B.toNumber(B.sub(R.view.cx, st.cx, 40)) * k;
      const dy = B.toNumber(B.sub(R.view.cy, st.cy, 40)) * k;
      const sw = (R.view.span / st.span) * W;
      const sh = sw * (R.h / R.w);
      ctx.imageSmoothingEnabled = Math.abs(sw - W) > 0.5;
      ctx.drawImage(buf, W / 2 + dx - sw / 2, H / 2 - dy - sh / 2, sw, sh);
    }
    drawOverlay();
    progress.firstChild.style.width = `${(R.progress * 100).toFixed(1)}%`;
    progress.style.opacity = R.progress >= 1 ? 0 : 1;
  }

  const toScreen = (x, y) => [layer.w / 2 + ((x - cxN()) / st.span) * layer.w, layer.h / 2 - ((y - cyN()) / st.span) * layer.w];
  const toWorld = (px, py) => [cxN() + ((px - layer.w / 2) / layer.w) * st.span, cyN() - ((py - layer.h / 2) / layer.w) * st.span];

  function drawOverlay() {
    fx.reset();
    const ctx = fx.ctx;
    if (!st.hover || !st.showOrbit || st.span < 1e-9) return;
    const [wx, wy] = toWorld(st.hover.px, st.hover.py);
    let pts;
    if (st.kind === 'mandelbrot') pts = orbit(0, 0, wx, wy, 120);
    else if (st.kind === 'julia') pts = orbit(wx, wy, st.julia[0], st.julia[1], 120);
    else if (st.kind === 'ship') pts = orbit(0, 0, wx, -wy, 120, true).map(([x, y]) => [x, -y]);
    else {
      // Newton: the path of the iterates
      pts = [[wx, wy]];
      let [x, y] = [wx, wy];
      for (let n = 0; n < 40; n++) {
        const x2 = x * x - y * y, y2 = 2 * x * y, x3 = x2 * x - y2 * y, y3 = x2 * y + y2 * x;
        const nr = 2 * x3 + 1, ni = 2 * y3, dr = 3 * x2, di = 3 * y2, den = dr * dr + di * di;
        if (!den) break;
        [x, y] = [(nr * dr + ni * di) / den, (ni * dr - nr * di) / den];
        pts.push([x, y]);
        if (Math.hypot(pts.at(-1)[0] - pts.at(-2)[0], pts.at(-1)[1] - pts.at(-2)[1]) < 1e-9) break;
      }
    }
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    pts.forEach(([x, y], k) => {
      const [sx, sy] = toScreen(x, y);
      if (k) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
    });
    ctx.stroke();
    pts.forEach(([x, y], k) => {
      const [sx, sy] = toScreen(x, y);
      ctx.beginPath();
      ctx.arc(sx, sy, k === 0 ? 3.5 : 2.2, 0, 2 * Math.PI);
      ctx.fillStyle = k === 0 ? C.v : `rgba(255, 255, 255, ${Math.max(0.25, 0.9 - k * 0.01)})`;
      ctx.fill();
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------ hover: tooltip, Julia inset
  let lastHoverC = null;
  function updateHover() {
    if (!st.hover) { tip.style.display = 'none'; inset.style.display = 'none'; drawOverlay(); return; }
    const { px, py } = st.hover;
    const [wx, wy] = toWorld(px, py);
    lastHoverC = [wx, wy];
    const dg = st.span < 1e-6 ? 12 : 6;
    const zText = `${fmt(wx, dg)} ${wy < 0 ? '−' : '+'} ${fmt(Math.abs(wy), dg)}i`;
    let status = '';
    if (st.kind === 'mandelbrot') {
      const p = attractingPeriod(wx, wy);
      status = p.escaped ? '轨道逃逸：c 不在集合内' : p.period ? `轨道收敛到周期 ${p.period} 的吸引环` : '轨道有界（混沌或收敛很慢）';
    } else if (st.kind === 'julia') {
      const v = escape(wx, wy, st.julia[0], st.julia[1], 2000, false, 0);
      status = v < 0 ? '轨道有界：z₀ 在填充朱利亚集内' : `约 ${fmt(v, 1)} 步后逃逸`;
    } else if (st.kind === 'newton') {
      const v = newton(wx, wy, 100);
      status = v < 0 ? '未收敛' : `收敛到根 ${['1', '−½ + (√3/2)i', '−½ − (√3/2)i'][Math.floor(v / 1000)]}，约 ${Math.round(v % 1000)} 步`;
    } else {
      const v = escape(0, 0, wx, -wy, 2000, true, 0);
      status = v < 0 ? '轨道有界' : `约 ${fmt(v, 1)} 步后逃逸`;
    }
    tip.style.display = '';
    tip.style.left = `${px}px`;
    tip.style.top = `${py}px`;
    tip.textContent = '';
    tip.append(h('div', { class: 't-title' }, `${st.kind === 'mandelbrot' || st.kind === 'ship' ? 'c' : 'z₀'} = ${zText}`), h('div', { class: 't-mono' }, status));
    if (st.kind === 'mandelbrot' && st.showJulia) renderInset(wx, wy);
    else inset.style.display = 'none';
    drawOverlay();
  }

  function renderInset(jx, jy) {
    inset.style.display = '';
    const W = 210, H = 140;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (insetCanvas.width !== W * dpr) { insetCanvas.width = W * dpr; insetCanvas.height = H * dpr; }
    const ctx = insetCanvas.getContext('2d');
    const img = ctx.createImageData(insetCanvas.width, insetCanvas.height);
    const pw = insetCanvas.width, ph = insetCanvas.height;
    const k = 3.4 / pw;
    for (let j = 0; j < ph; j += 2) {
      for (let i = 0; i < pw; i += 2) {
        const v = escape((i - pw / 2) * k, (ph / 2 - j) * k, jx, jy, 160, false, 1e-6);
        let r = 6, g = 8, b = 13;
        if (v >= 0) {
          let t = 0.85 * st.density * Math.log(1 + v / 6) + st.offset;
          t -= Math.floor(t);
          const li = 3 * ((t * 1024) | 0);
          r = lut[li]; g = lut[li + 1]; b = lut[li + 2];
        }
        for (let dj = 0; dj < 2 && j + dj < ph; dj++) {
          for (let di = 0; di < 2 && i + di < pw; di++) {
            const q = 4 * ((j + dj) * pw + i + di);
            img.data[q] = r; img.data[q + 1] = g; img.data[q + 2] = b; img.data[q + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    insetLabel.textContent = `朱利亚集 · c = ${fmt(jx, 4)} ${jy < 0 ? '−' : '+'} ${fmt(Math.abs(jy), 4)}i　按 J 打开`;
  }

  // ------------------------------------------------------------------ interaction
  const adapter = {
    get scale() { return layer.w / st.span; },
    wx: (px) => toWorld(px, 0)[0],
    wy: (py) => toWorld(0, py)[1],
    panPx(dx, dy) {
      const k = st.span / layer.w;
      st.cx = B.sub(st.cx, B.fromNumber(dx * k), 0);
      st.cy = B.add(st.cy, B.fromNumber(dy * k), 0);
      tidyCentre();
    },
    zoomAt(px, py, f) {
      // keep the point under the cursor fixed: centre += (p − centre)·(1 − 1/f)
      const k = st.span / layer.w;
      const ox = (px - layer.w / 2) * k, oy = (layer.h / 2 - py) * k;
      const g = 1 - 1 / f;
      st.cx = B.add(st.cx, B.fromNumber(ox * g), 0);
      st.cy = B.add(st.cy, B.fromNumber(oy * g), 0);
      st.span /= f;
      tidyCentre();
    },
  };
  const detach = attachPointer(layer.canvas, adapter, {
    idleCursor: 'crosshair',
    onClick(x, y, e, px, py) {
      adapter.zoomAt(px, py, e.shiftKey ? 1 / 2.5 : 2.5);
      viewChanged({ quick: true });
    },
    onHover(px, py) { st.hover = { px, py }; requestHover(); },
    onLeave() { st.hover = null; updateHover(); },
    onView: () => { st.hover = null; tip.style.display = 'none'; viewChanged(); },
  });
  let hoverRaf = 0;
  const requestHover = () => { if (!hoverRaf) hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; updateHover(); }); };

  function zoomBy(f) {
    adapter.zoomAt(layer.w / 2, layer.h / 2, f);
    viewChanged({ quick: true });
  }

  function goTo(loc, { quiet = false } = {}) {
    setDive(false);
    Object.assign(st, viewOf(loc));
    R.iterFloor = 0; R.floorSpan = Infinity; R.raised = 0;
    if (loc.hp && !hp && !quiet) {
      toast('这个位置要在高精度下渲染：已为你开启高精度');
      syncQuery();
      updateSettings({ precision: 'high' }); // re-creates the module from the URL
      return;
    }
    clampSpan();
    startRender();
    syncQuery();
    paintPresets();
  }

  function setKind(kind) {
    setDive(false);
    st.kind = kind;
    kindSeg.set(kind);
    goTo(LOCATIONS[kind][0], { quiet: true });
    paintKindUI();
  }

  // ------------------------------------------------------------------ dive
  let lastPreview = 0;
  const loop = animationLoop((dt, now) => {
    const f = Math.exp(DIVE_RATE * dt);
    adapter.zoomAt(layer.w / 2, layer.h / 2, f);
    if (clampSpan()) { requestDraw(); return; }
    requestDraw();
    if (now - lastPreview > 280) { lastPreview = now; startRender({ preview: true }); }
    scheduleSync();
  });
  function setDive(on) {
    if (on === loop.running) return;
    if (on) { loop.start(); diveBtn.innerHTML = ''; diveBtn.append(iconEl('pause')); }
    else { loop.stop(); diveBtn.innerHTML = ''; diveBtn.append(iconEl('play')); if (R.w) requestRender(120); }
  }
  const iconEl = (name) => {
    const t = document.createElement('template');
    t.innerHTML = name === 'pause'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 v13 l11-6.5 z" fill="currentColor"/></svg>';
    return t.content.firstElementChild;
  };

  // ------------------------------------------------------------------ panel
  const kindSeg = segmented({
    id: 'fractal-kind',
    options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })),
    value: st.kind,
    onChange: (v) => setKind(v),
  });
  const kindNote = h('div', { class: 'hint', id: 'fractal-note' });
  const jre = h('input', { class: 'num-input', type: 'text', id: 'julia-re', 'aria-label': 'Re c', spellcheck: 'false' });
  const jim = h('input', { class: 'num-input', type: 'text', id: 'julia-im', 'aria-label': 'Im c', spellcheck: 'false' });
  const juliaChips = chips({
    id: 'julia-presets',
    items: JULIAS.map((j) => ({ id: j.id, label: j.label })),
    onPick: (id) => setJulia(JULIAS.find((j) => j.id === id).c),
  });
  const juliaBox = h('div', { class: 'field', id: 'julia-box' },
    h('div', { class: 'field-row julia-c' }, h('span', { class: 'label', html: '<span class="math">c</span> =' }), jre, h('span', { class: 'label' }, '+'), jim, h('span', { class: 'label math' }, 'i')),
    juliaChips.el);
  for (const inp of [jre, jim]) {
    inp.addEventListener('input', () => {
      try {
        const v = [evalConstant(jre.value), evalConstant(jim.value)];
        if (!v.every(Number.isFinite)) throw new Error('x');
        jre.classList.remove('invalid'); jim.classList.remove('invalid');
        st.julia = v;
        juliaChips.set(null);
        startRender();
        scheduleSync();
      } catch { inp.classList.add('invalid'); }
    });
    inp.addEventListener('keydown', (e) => e.stopPropagation());
  }
  function setJulia(c) {
    st.julia = [...c];
    jre.value = fmt(c[0], 6);
    jim.value = fmt(c[1], 6);
    const m = JULIAS.find((j) => j.c[0] === c[0] && j.c[1] === c[1]);
    juliaChips.set(m ? m.id : null);
    if (st.kind !== 'julia') setKind('julia');
    else { startRender(); syncQuery(); }
  }

  const presetBox = h('div', { id: 'fractal-presets' });
  let presetChips = null;
  function paintPresets() {
    presetBox.textContent = '';
    presetChips = chips({
      items: LOCATIONS[st.kind].map((l) => ({ id: l.id, label: l.hp ? `${l.label} <span class="chip-badge">高精度</span>` : l.label })),
      onPick: (id) => goTo(LOCATIONS[st.kind].find((l) => l.id === id)),
    });
    presetBox.append(presetChips.el);
  }

  const read = readout([
    ['c', '中心'],
    ['w', '视野宽度'],
    ['z', '放大倍数'],
    ['it', '迭代上限'],
    ['m', '计算方式'],
    ['t', '渲染'],
  ], { id: 'fractal-readout' });

  const iterSlider = slider({
    label: '迭代倍率', min: -2, max: 3, step: 0.5, value: Math.log2(st.iterMul), id: 'fractal-iter',
    format: (v) => `×${fmt(2 ** v, 2)}`,
    onInput: (v) => { st.iterMul = 2 ** v; R.raised = 0; requestRender(150); scheduleSync(); },
  });
  const paletteChips = chips({
    id: 'fractal-palette',
    items: Object.entries(PALETTES).map(([id, p]) => ({ id, label: p.label })),
    value: st.palette,
    onPick: (id) => { st.palette = id; lut = paletteLUT(id); paint(); requestDraw(); scheduleSync(); },
  });
  const densitySlider = slider({
    label: '色彩密度', min: -2, max: 2, step: 0.05, value: Math.log2(st.density), id: 'fractal-density',
    format: (v) => `×${fmt(2 ** v, 2)}`,
    onInput: (v) => { st.density = 2 ** v; paint(); requestDraw(); scheduleSync(); },
  });
  const offsetSlider = slider({
    label: '色彩相位', min: 0, max: 1, step: 0.01, value: st.offset, id: 'fractal-offset',
    format: (v) => fmt(v, 2),
    onInput: (v) => { st.offset = v; paint(); requestDraw(); scheduleSync(); },
  });
  const flowLoop = animationLoop((dt) => {
    st.offset = (st.offset + dt * 0.08) % 1;
    offsetSlider.set(st.offset);
    paint();
    requestDraw();
  });
  const precisionNote = h('div', { class: 'note', id: 'fractal-precision' });

  panel.append(
    section('分形', [kindSeg.el, juliaBox, kindNote]),
    section('位置', [presetBox, read.el,
      h('div', { class: 'hint', html: '单击放大 2.5 倍（<kbd>Shift</kbd> + 单击缩小），滚轮缩放，拖动平移；▶ 深潜会朝中心一直放大。悬停可看轨道与对应的朱利亚集。' })]),
    section('精度', [precisionNote]),
    section('迭代', [iterSlider.el, h('div', { class: 'hint' }, '迭代上限随放大自动增加；若大片区域达到上限（黑色）而边缘仍在逃逸，会自动再提高。')]),
    section('配色', [paletteChips.el, densitySlider.el, offsetSlider.el,
      toggle({ label: '色彩流动', value: st.flow, id: 'fractal-flow', onChange: (v) => { st.flow = v; v ? flowLoop.start() : flowLoop.stop(); } }).el]),
    section('显示', [h('div', { class: 'toggles' },
      toggle({ label: '鼠标处的轨道', value: st.showOrbit, swatch: '#ffffff', onChange: (v) => { st.showOrbit = v; drawOverlay(); } }).el,
      toggle({ label: '朱利亚集预览（曼德博集上）', value: st.showJulia, swatch: C.accent2, onChange: (v) => { st.showJulia = v; updateHover(); } }).el)]),
  );

  function paintKindUI() {
    juliaBox.style.display = st.kind === 'julia' ? '' : 'none';
    kindNote.textContent = KINDS[st.kind].note;
    paintPresets();
  }

  function updateReadouts() {
    const D = Math.max(12, Math.min(40, Math.ceil(-Math.log10(st.span)) + 4));
    const xs = B.toDecimal(st.cx, D), ys = B.toDecimal(B.abs(st.cy), D);
    read.set('c', `${xs} ${B.sign(st.cy) < 0 ? '−' : '+'} ${ys}i`);
    read.set('w', fmtSci(st.span));
    read.set('z', `${fmtSci(3.3 / st.span)} 倍`);
    read.set('it', `${R.maxIter.toLocaleString('en-US')}${R.iterFloor ? '（已自动提高）' : ''}`);
    if (R.method === 'perturb') {
      read.set('m', `摄动 · 参考轨道 ${R.bits} 位二进制 · 级数逼近跳过 ${R.skip.toLocaleString('en-US')} 步`, 'good');
    } else {
      read.set('m', `双精度直接迭代${pool.threaded ? ` · ${pool.size} 个线程` : ''}`);
    }
    read.set('t', R.done ? `${fmt(R.ms / 1000, 2)} s · ${R.w}×${R.h} 像素` : '渲染中…');
    info.textContent = '';
    info.append(...[
      h('div', { class: 'title' }, `${KINDS[st.kind].label}${st.kind === 'julia' ? ` · c = ${fmt(st.julia[0], 4)} ${st.julia[1] < 0 ? '−' : '+'} ${fmt(Math.abs(st.julia[1]), 4)}i` : ''}`),
      h('div', { class: 'big' }, `宽度 ${fmtSci(st.span)}`),
      h('div', { class: 'big', style: { color: C.text2 } }, `放大 ${fmtSci(3.3 / st.span)} 倍`),
      R.method === 'perturb' ? h('div', { class: 'hp-badge' }, `摄动 · ${R.bits} 位`) : null,
    ].filter(Boolean));
    precisionNote.innerHTML = DEEP.has(st.kind)
      ? hp
        ? '<b>高精度已开启</b>：视野宽度小于约 10⁻¹³ 时，改用<b>摄动法</b>——视野中心的参考轨道用 BigInt 定点数精确迭代，每个像素只用双精度追踪它与参考轨道的微小差值，并用<b>级数逼近</b>跳过开头成千上万步。可一直放大到约 10⁻²⁸⁰。'
        : '双精度（约 16 位有效数字）只能放大到约 10⁻¹³：再深，相邻像素的坐标就无法区分，画面会变成色块。<b>开启高精度</b>（按 P）后可用摄动法一直放大到约 10⁻²⁸⁰。'
      : '燃烧之船与牛顿分形用双精度直接迭代（取绝对值与除法使摄动法不适用），可放大到约 10⁻¹³。';
  }

  // ------------------------------------------------------------------ URL
  let syncTimer = 0;
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncQuery, 300); }
  function syncQuery() {
    clearTimeout(syncTimer);
    setQuery({
      k: st.kind === 'mandelbrot' ? null : st.kind,
      x: centreText(st.cx),
      y: centreText(st.cy),
      s: +st.span.toPrecision(6),
      j: st.kind === 'julia' ? st.julia.map((v) => +v.toPrecision(10)).join(',') : null,
      p: st.palette === 'aurora' ? null : st.palette,
      d: st.density === 1 ? null : +st.density.toFixed(3),
      o: st.offset ? +st.offset.toFixed(3) : null,
      it: st.iterMul === 1 ? null : st.iterMul,
    });
    updateReadouts();
  }

  // ------------------------------------------------------------------ boot
  const stopResize = observeSize(stage, (w, hh) => {
    layer.resize(w, hh);
    fx.resize(w, hh);
    resizeBuffers(w, hh);
    clampSpan();
    startRender();
  });
  jre.value = fmt(st.julia[0], 6);
  jim.value = fmt(st.julia[1], 6);
  juliaChips.set(JULIAS.find((j) => j.c[0] === st.julia[0] && j.c[1] === st.julia[1])?.id ?? null);
  paintKindUI();
  syncQuery();

  return {
    help: {
      tips: [
        '单击放大 2.5 倍，<kbd>Shift</kbd> + 单击缩小；滚轮或双指缩放，拖动平移。',
        '▶ 深潜：朝画面中心一直放大。双精度到 10⁻¹³ 左右就是极限；开启高精度后用摄动法与级数逼近继续深入。',
        '在曼德博集上悬停：白线是 0, c, c² + c, … 的轨道；右下角是同一个 c 的朱利亚集，按 <kbd>J</kbd> 打开它。',
        '配色只改变颜色映射，不重新计算；打开“色彩流动”让颜色沿等势线流动。',
      ],
      keys: [['Space', '深潜 / 停止'], ['+ / −', '放大 / 缩小'], ['R', '复位视野'], ['J', '打开光标处 c 的朱利亚集']],
    },
    onKey(e) {
      if (e.key === ' ') { setDive(!loop.running); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') zoomBy(2.5);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 2.5);
      else if (e.key === 'r' || e.key === 'R') goTo(LOCATIONS[st.kind][0]);
      else if ((e.key === 'j' || e.key === 'J') && st.kind === 'mandelbrot' && lastHoverC) setJulia(lastHoverC);
    },
    snapshot: () => layer.canvas,
    // test hooks
    state: () => ({
      kind: st.kind, x: centreText(st.cx), y: centreText(st.cy), span: st.span, julia: [...st.julia],
      maxIter: R.maxIter, method: R.method, bits: R.bits, skip: R.skip, done: R.done, progress: R.progress, interior: R.interior,
      limited: banner.style.display !== 'none', diving: loop.running, threads: pool.size, renders: R.renders,
    }),
    zoomBy,
    goTo: (id) => goTo(LOCATIONS[st.kind].find((l) => l.id === id)),
    destroy() {
      setDive(false);
      flowLoop.stop();
      R.cancel?.();
      R.token++;
      clearTimeout(renderTimer);
      clearTimeout(syncTimer);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(hoverRaf);
      detach();
      stopResize();
      pool.destroy();
    },
  };
}

export default {
  id: 'fractal',
  title: '分形',
  short: '分形',
  subtitle: '曼德博集、朱利亚集、燃烧之船与牛顿分形：无限放大，开启高精度后可潜到 10⁻²⁸⁰',
  icon: 'fractal',
  create,
};
