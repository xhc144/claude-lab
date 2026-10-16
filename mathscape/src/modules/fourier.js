// Module 6 — Fourier epicycles: any closed curve, even one drawn by hand, is redrawn by a chain
// of rotating circles. The number of circles controls how faithful the drawing is.

import { h } from '../ui/dom.js';
import { Layer, observeSize, animationLoop } from '../ui/canvas.js';
import { backdrop, glow } from '../ui/draw.js';
import { section, slider, toggle, segmented, button, chips, readout, iconButton } from '../ui/controls.js';
import { fmt } from '../ui/format.js';
import { C, MONO, alpha } from '../ui/theme.js';
import { tolerances } from '../ui/settings.js';
import { resample, dft, sortTerms, evalSeries, energyFraction, SHAPES } from '../core/fourier.js';

const STRIP = 118; // spectrum strip height (px)

function create({ stage, panel, toast, query, setQuery }) {
  const tol = tolerances();
  const N = tol.hp ? 1024 : 512; // samples = number of circles available
  const st = {
    shape: SHAPES[query.get('s')] ? query.get('s') : 'heart',
    custom: null, // hand-drawn points
    K: 48,
    order: query.get('o') === 'freq' ? 'freq' : 'amp',
    speed: 1,
    t: 0,
    playing: true,
    show: { circles: true, original: true, approx: false, spectrum: true },
    follow: false,
    drawing: false,
    stroke: [],
    sweep: null, // animated K
  };
  const qk = Number(query.get('K'));
  if (Number.isInteger(qk) && qk >= 1) st.K = Math.min(N, qk);
  if (query.get('d')) {
    const v = query.get('d').split(',').map(Number);
    if (v.length >= 16 && v.length % 2 === 0 && v.every(Number.isFinite)) {
      st.custom = [];
      for (let i = 0; i < v.length; i += 2) st.custom.push([v[i] / 1000, v[i + 1] / 1000]);
      st.shape = 'draw';
    }
  }

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const info = h('div', { class: 'overlay-card tl', id: 'fourier-info' });
  const strip = h('div', { class: 'bottom-strip', id: 'fourier-spectrum', style: { height: `${STRIP}px` } });
  const stripLayer = new Layer(strip, { passive: true });
  const drawHint = h('div', { class: 'stage-hint', style: { display: 'none', bottom: `${STRIP + 24}px` } }, '按住鼠标（或手指）画一条曲线，松开后自动闭合并分解成圆');
  const playBtn = iconButton({ iconName: 'pause', title: '播放 / 暂停（Space）', cls: 'play', id: 'fourier-play', onClick: () => setPlaying(!st.playing) });
  const transport = h('div', { class: 'transport', style: { bottom: `${STRIP + 24}px` } },
    iconButton({ iconName: 'minus', title: '少一个圆（←）', onClick: () => setK(st.K - 1) }),
    playBtn,
    iconButton({ iconName: 'plus', title: '多一个圆（→）', onClick: () => setK(st.K + 1) }),
    h('div', { class: 'sep' }),
    iconButton({ iconName: 'pen', title: '手绘一个图形（D）', id: 'fourier-draw', onClick: () => setDrawing(!st.drawing) }));
  stage.append(info, strip, drawHint, transport);

  // ------------------------------------------------------------------ series
  let pts = [];
  let terms = [];
  let approx = [];
  let trace = [];
  let maxAmp = 1;

  function compute() {
    const src = st.shape === 'draw' && st.custom ? st.custom : SHAPES[st.shape === 'draw' ? 'heart' : st.shape].pts();
    pts = resample(src, N);
    terms = sortTerms(dft(pts), st.order);
    maxAmp = Math.max(...terms.filter((t) => t.k !== 0).map((t) => t.amp), 1e-9);
    rebuildApprox();
  }
  function rebuildApprox() {
    approx = [];
    for (let i = 0; i <= 600; i++) approx.push(evalSeries(terms, st.K, i / 600));
    trace = [];
    updateReadouts();
  }

  // ------------------------------------------------------------------ view
  const view = { scale: 1, ox: 0, oy: 0, zoom: 1, fx: 0, fy: 0 };
  function layout() {
    const W = layer.w, H = layer.h - (st.show.spectrum ? STRIP + 12 : 0);
    view.scale = Math.min(W, H) * 0.42;
    view.ox = W / 2;
    view.oy = H / 2 + 4;
  }
  const sx = (x) => view.ox + (x - view.fx) * view.scale * view.zoom;
  const sy = (y) => view.oy - (y - view.fy) * view.scale * view.zoom;

  // ------------------------------------------------------------------ drawing
  function draw() {
    const { ctx } = layer;
    layer.reset();
    backdrop(ctx, layer.w, layer.h, '#10141f', '#080b11', 0.45, layer.dpr);
    const tip = evalSeries(terms, st.K, st.t);
    // camera: follow the pen with a smooth zoom
    const targetZoom = st.follow ? 5 : 1;
    view.zoom += (targetZoom - view.zoom) * 0.12;
    const fx = st.follow ? tip[0] : 0, fy = st.follow ? tip[1] : 0;
    view.fx += (fx - view.fx) * (st.follow ? 0.5 : 0.12);
    view.fy += (fy - view.fy) * (st.follow ? 0.5 : 0.12);

    if (st.drawing) {
      drawStroke(ctx);
      return;
    }
    if (st.show.original) {
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.28)';
      ctx.lineWidth = 1.2;
      poly(ctx, pts, true);
      ctx.restore();
    }
    if (st.show.approx) {
      ctx.strokeStyle = alpha(C.accent2, 0.45);
      ctx.lineWidth = 1.4;
      poly(ctx, approx, true);
    }
    // the drawn trace: brighter towards the pen
    if (trace.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const n = trace.length;
      const chunks = 8;
      for (let c = 0; c < chunks; c++) {
        const a = Math.floor((c * (n - 1)) / chunks), b = Math.floor(((c + 1) * (n - 1)) / chunks) + 1;
        ctx.strokeStyle = alpha(C.v, 0.25 + (0.75 * (c + 1)) / chunks);
        ctx.lineWidth = 2.2;
        poly(ctx, trace.slice(a, b + 1), false);
      }
    }
    // the epicycles
    let x = 0, y = 0;
    if (st.show.circles) {
      ctx.lineWidth = 1;
      for (let i = 0; i < Math.min(st.K, terms.length); i++) {
        const { k, re, im, amp } = terms[i];
        const a = 2 * Math.PI * k * st.t;
        const nx = x + re * Math.cos(a) - im * Math.sin(a);
        const ny = y + re * Math.sin(a) + im * Math.cos(a);
        const r = amp * view.scale * view.zoom;
        if (k !== 0 && r > 0.6) {
          const fade = Math.max(0.12, 0.5 - i * 0.004);
          ctx.strokeStyle = `rgba(122, 162, 255, ${fade})`;
          ctx.beginPath();
          ctx.arc(sx(x), sy(y), r, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(232, 236, 244, ${Math.max(0.3, 0.85 - i * 0.004)})`;
        ctx.beginPath();
        ctx.moveTo(sx(x), sy(y));
        ctx.lineTo(sx(nx), sy(ny));
        ctx.stroke();
        x = nx;
        y = ny;
      }
    }
    glow(ctx, sx(tip[0]), sy(tip[1]), 16, C.v, 1);
    ctx.fillStyle = '#fff6da';
    ctx.beginPath();
    ctx.arc(sx(tip[0]), sy(tip[1]), 3, 0, 2 * Math.PI);
    ctx.fill();
    if (st.show.spectrum) drawSpectrum();
  }

  function poly(ctx, p, closed) {
    if (p.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(sx(p[0][0]), sy(p[0][1]));
    for (let i = 1; i < p.length; i++) ctx.lineTo(sx(p[i][0]), sy(p[i][1]));
    if (closed) ctx.closePath();
    ctx.stroke();
  }

  function drawStroke(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), view.scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    if (st.stroke.length > 1) {
      ctx.strokeStyle = C.v;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      poly(ctx, st.stroke, false);
      const [a, b] = [st.stroke[0], st.stroke.at(-1)];
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = alpha(C.v, 0.45);
      ctx.beginPath();
      ctx.moveTo(sx(b[0]), sy(b[1]));
      ctx.lineTo(sx(a[0]), sy(a[1]));
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSpectrum() {
    const c = stripLayer;
    c.reset();
    const ctx = c.ctx;
    const W = c.w, H = c.h;
    const kmax = Math.min(80, Math.floor(N / 2) - 1);
    const used = new Set(terms.slice(0, st.K).map((t) => t.k));
    const byK = new Map(terms.map((t) => [t.k, t]));
    const padL = 10, padR = 10, padT = 22, padB = 18;
    const bw = (W - padL - padR) / (2 * kmax + 1);
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = C.text3;
    ctx.fillText('频谱 |c_k|（对数刻度）· 亮色 = 正在使用的圆', padL, 14);
    for (let k = -kmax; k <= kmax; k++) {
      const t = byK.get(k);
      if (!t || k === 0) continue;
      const lv = Math.max(0, 1 + Math.log10(t.amp / maxAmp) / 4); // four decades
      const bh = lv * (H - padT - padB);
      const x = padL + (k + kmax) * bw;
      ctx.fillStyle = used.has(k) ? (k > 0 ? C.accent : C.accent2) : 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(x + 0.5, H - padB - bh, Math.max(1, bw - 1), bh);
    }
    ctx.fillStyle = C.text3;
    ctx.textAlign = 'center';
    for (const k of [-kmax, -40, -20, 0, 20, 40, kmax]) {
      if (Math.abs(k) > kmax) continue;
      ctx.fillText(String(k).replace('-', '−'), padL + (k + kmax + 0.5) * bw, H - 5);
    }
    ctx.textAlign = 'right';
    ctx.fillText('k > 0 逆时针　k < 0 顺时针', W - padR, 14);
  }

  // ------------------------------------------------------------------ animation
  const loop = animationLoop((dt) => {
    if (st.sweep) {
      st.sweep.u = Math.min(1, st.sweep.u + dt / 9);
      const K = Math.max(1, Math.round(N ** st.sweep.u));
      if (K !== st.K) { st.K = K; kSlider.set(Math.log2(K)); rebuildApprox(); }
      if (st.sweep.u >= 1) { st.sweep = null; syncQuery(); }
    }
    if (st.playing && !st.drawing) {
      const prevT = st.t;
      st.t += dt * 0.07 * st.speed;
      if (st.t >= 1) { st.t -= 1; trace = []; }
      // sample the pen finely enough for a smooth trace
      const steps = Math.max(1, Math.ceil((st.t - prevT + (st.t < prevT ? 1 : 0)) * 1200));
      for (let s = 1; s <= steps; s++) {
        const tt = prevT + ((st.t - prevT + (st.t < prevT ? 1 : 0)) * s) / steps;
        trace.push(evalSeries(terms, st.K, tt % 1));
      }
      if (trace.length > 6000) trace.splice(0, trace.length - 6000);
    }
    draw();
  });

  function setPlaying(on) {
    st.playing = on;
    playBtn.innerHTML = '';
    playBtn.append(iconSvg(on ? 'pause' : 'play'));
  }
  const iconSvg = (name) => {
    const t = document.createElement('template');
    t.innerHTML = name === 'pause'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 v13 l11-6.5 z" fill="currentColor"/></svg>';
    return t.content.firstElementChild;
  };

  function setK(K) {
    st.sweep = null;
    st.K = Math.max(1, Math.min(N, Math.round(K)));
    kSlider.set(Math.log2(st.K));
    rebuildApprox();
    syncQuery();
  }

  // ------------------------------------------------------------------ hand drawing
  const toWorld = (px, py) => [(px - view.ox) / (view.scale * view.zoom) + view.fx, -(py - view.oy) / (view.scale * view.zoom) + view.fy];
  let drawingPointer = null;
  function setDrawing(on) {
    st.drawing = on;
    st.stroke = [];
    drawHint.style.display = on ? '' : 'none';
    layer.canvas.style.cursor = on ? 'crosshair' : 'default';
    document.getElementById('fourier-draw')?.classList.toggle('active', on);
    if (on) { st.follow = false; followToggle.set(false); }
  }
  const down = (e) => {
    if (!st.drawing) return;
    drawingPointer = e.pointerId;
    layer.canvas.setPointerCapture?.(e.pointerId);
    const r = layer.canvas.getBoundingClientRect();
    st.stroke = [toWorld(e.clientX - r.left, e.clientY - r.top)];
    e.preventDefault();
  };
  const move = (e) => {
    if (!st.drawing || e.pointerId !== drawingPointer) return;
    const r = layer.canvas.getBoundingClientRect();
    const p = toWorld(e.clientX - r.left, e.clientY - r.top);
    const q = st.stroke.at(-1);
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) * view.scale > 2) st.stroke.push(p);
  };
  const up = (e) => {
    if (!st.drawing || e.pointerId !== drawingPointer) return;
    drawingPointer = null;
    if (st.stroke.length < 8) { toast('线条太短，请画一个更大的图形'); st.stroke = []; return; }
    // keep the drawing within the usual frame
    const xs = st.stroke.map((p) => p[0]), ys = st.stroke.map((p) => p[1]);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const k = 1.8 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6);
    st.custom = resample(st.stroke.map(([x, y]) => [(x - cx) * k, (y - cy) * k]), 128);
    st.shape = 'draw';
    shapeChips.set(null);
    setDrawing(false);
    st.t = 0;
    compute();
    syncQuery();
    toast(`已分解成 ${N} 个圆，现在用 ${st.K} 个画出来`);
  };
  layer.canvas.addEventListener('pointerdown', down);
  layer.canvas.addEventListener('pointermove', move);
  layer.canvas.addEventListener('pointerup', up);
  layer.canvas.addEventListener('pointercancel', up);
  layer.canvas.style.touchAction = 'none';

  // ------------------------------------------------------------------ panel
  const shapeChips = chips({
    id: 'fourier-shapes',
    items: Object.entries(SHAPES).map(([id, s]) => ({ id, label: s.label })),
    value: st.shape,
    onPick: (id) => { st.shape = id; st.custom = null; st.t = 0; setDrawing(false); compute(); syncQuery(); },
  });
  const kSlider = slider({
    label: '圆的个数 <span class="math">K</span>', min: 0, max: Math.log2(N), step: 0.01, value: Math.log2(st.K), id: 'fourier-k',
    format: (v) => String(Math.max(1, Math.round(2 ** v))),
    onInput: (v) => { st.sweep = null; st.K = Math.max(1, Math.round(2 ** v)); rebuildApprox(); syncQuery(); },
  });
  const orderSeg = segmented({
    id: 'fourier-order',
    options: [{ value: 'amp', label: '大圆优先', title: '按振幅 |c_k| 从大到小' }, { value: 'freq', label: '低频优先', title: 'k = 0, 1, −1, 2, −2, …' }],
    value: st.order,
    onChange: (v) => { st.order = v; terms = sortTerms(terms, v); rebuildApprox(); syncQuery(); },
  });
  const read = readout([
    ['N', '采样点 = 可用的圆'],
    ['K', '正在使用'],
    ['E', '能量占比（帕塞瓦尔）'],
    ['err', '相对均方误差'],
    ['R', '最大的圆半径'],
  ], { id: 'fourier-readout' });
  const followToggle = toggle({ label: '镜头跟随笔尖', value: st.follow, id: 'fourier-follow', onChange: (v) => { st.follow = v; } });
  const tg = (key, text, swatch) => toggle({ label: text, value: st.show[key], swatch, onChange: (v) => { st.show[key] = v; strip.style.display = st.show.spectrum ? '' : 'none'; layout(); } });

  panel.append(
    section('图形', [shapeChips.el,
      h('div', { class: 'btn-row' }, button({ label: '自己画一个', iconName: 'pen', id: 'fourier-draw-btn', onClick: () => setDrawing(true) })),
      h('div', { class: 'hint' }, '画任意一笔（不必闭合），松开后首尾自动相连，再沿弧长均匀取样做离散傅里叶变换。')]),
    section('傅里叶级数', [kSlider.el, orderSeg.el,
      h('div', { class: 'btn-row' }, button({ label: '从 1 个圆逐渐加到全部', iconName: 'play', small: true, id: 'fourier-sweep', onClick: () => { st.sweep = { u: 0 }; st.t = 0; trace = []; } })),
      read.el]),
    section('播放', [
      slider({ label: '速度', min: 0.1, max: 4, step: 0.05, value: st.speed, format: (v) => `${fmt(v, 2)}×`, onInput: (v) => { st.speed = v; } }).el,
      h('div', { class: 'toggles two' },
        tg('circles', '圆与半径', C.accent).el,
        tg('original', '原图形', '#94a3b8').el,
        tg('approx', '完整近似曲线', C.accent2).el,
        tg('spectrum', '频谱', C.accent).el),
      followToggle.el]),
    section('原理', [h('div', { class: 'note', html: '把曲线看成复平面上的点 <span class="math">z</span>(<span class="math">t</span>)，它可以写成 Σ <span class="math">c<sub>k</sub></span> e<sup>2πi<span class="math">kt</span></sup>：每一项是一个半径 |<span class="math">c<sub>k</sub></span>|、每周转 <span class="math">k</span> 圈的圆，首尾相接。尖角处需要很多高频小圆；正方形的近似在角附近总会冲出约 9%，这就是<b>吉布斯现象</b>。' })]),
  );

  function updateReadouts() {
    const E = energyFraction(terms, st.K);
    read.set('N', String(N));
    read.set('K', `${st.K} 个圆`);
    read.set('E', `${fmt(E * 100, tol.hp ? 8 : 3)}%`, E > 0.999 ? 'good' : E > 0.98 ? '' : 'warn');
    read.set('err', fmt(Math.sqrt(Math.max(0, 1 - E)), 4));
    read.set('R', fmt(maxAmp, 4));
    info.textContent = '';
    info.append(
      h('div', { class: 'title' }, st.shape === 'draw' ? '手绘图形' : SHAPES[st.shape].label),
      h('div', { class: 'big' }, `${st.K} / ${N} 个圆`),
      h('div', { class: 'big', style: { color: C.text2 } }, `能量 ${fmt(E * 100, 2)}%`));
  }

  function syncQuery() {
    const d = st.shape === 'draw' && st.custom ? resample(st.custom, 64).flatMap(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)]).join(',') : null;
    setQuery({ s: st.shape === 'draw' ? null : st.shape, d, K: st.K, o: st.order === 'amp' ? null : st.order });
  }

  const stopResize = observeSize(stage, (w, hh) => {
    layer.resize(w, hh);
    stripLayer.resize(strip.getBoundingClientRect().width, STRIP);
    layout();
    draw();
  });
  compute();
  setPlaying(true);
  loop.start();
  syncQuery();

  return {
    help: {
      tips: [
        '每个圆的半径是一个傅里叶系数的模 |c<sub>k</sub>|，转速是 k 圈 / 周；所有圆首尾相接，最后一个圆的端点画出图形。',
        '“大圆优先”让少量的圆就画出大致轮廓；“低频优先”是课本上的部分和 S<sub>K</sub>。',
        '“自己画一个”：按住拖动画任意一笔，松开即分解。打开“镜头跟随笔尖”看最小的圆。',
      ],
      keys: [['Space', '播放 / 暂停'], ['← / →', '少 / 多一个圆'], ['D', '手绘']],
    },
    onKey(e) {
      if (e.key === ' ') { setPlaying(!st.playing); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') setK(st.K - 1);
      else if (e.key === 'ArrowRight') setK(st.K + 1);
      else if (e.key === 'd' || e.key === 'D') setDrawing(!st.drawing);
    },
    snapshot: () => layer.canvas,
    state: () => ({ shape: st.shape, K: st.K, N, order: st.order, energy: energyFraction(terms, st.K), t: st.t, drawing: st.drawing, playing: st.playing, custom: st.custom ? st.custom.length : 0 }),
    worldToClient(x, y) { const r = layer.canvas.getBoundingClientRect(); return [r.left + sx(x), r.top + sy(y)]; },
    destroy() {
      loop.stop();
      stopResize();
      layer.canvas.removeEventListener('pointerdown', down);
      layer.canvas.removeEventListener('pointermove', move);
      layer.canvas.removeEventListener('pointerup', up);
      layer.canvas.removeEventListener('pointercancel', up);
    },
  };
}

export default {
  id: 'fourier',
  title: '傅里叶本轮',
  short: '傅里叶',
  subtitle: '任何闭合曲线都能用一串旋转的圆画出来：选一个图形，或者自己画一笔',
  icon: 'fourier',
  create,
};
