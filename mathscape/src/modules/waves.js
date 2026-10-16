// Module 11 — waves: the 2-D wave equation on a ripple tank (drops, sources, walls, lenses, mirrors,
// moving sources), standing waves on a drum, and Chladni sand figures on a vibrating plate.

import { h } from '../ui/dom.js';
import { Layer, observeSize, animationLoop } from '../ui/canvas.js';
import { section, slider, toggle, segmented, button, chips, readout, iconButton } from '../ui/controls.js';
import { C, MONO } from '../ui/theme.js';
import { Wave, chladni, slitWall, outsideEllipse, lens, lensFocal } from '../core/waves.js';

const DT = 0.5;
const SCENES = [
  { id: 'ripple', label: '涟漪', note: '点击水面滴下水滴，按住拖动像手指划过水面。四周是吸收层，波传出去就不再反射回来。' },
  { id: 'two', label: '双源干涉', note: '两个同频同相的波源：到两源路程差为整数个波长的地方互相加强，差半个波长的地方互相抵消；亮带和暗带都是双曲线。切到“强度”看得更清楚。' },
  { id: 'slit', label: '双缝', note: '平面波穿过两条窄缝，在屏后叠出明暗相间的条纹——杨氏双缝实验。条纹间距约为 λL/d。' },
  { id: 'single', label: '单缝衍射', note: '缝只有几个波长宽时，波会绕进缝后的“阴影”里；第一道暗纹在 sin θ = λ/a 处。' },
  { id: 'lens', label: '透镜', note: '透镜里的波速只有 0.6（折射率 n ≈ 1.67）。中间厚、边缘薄，中间的波被拖慢得更多，平直的波前弯成圆弧，汇聚到焦点。' },
  { id: 'ellipse', label: '椭圆镜', note: '从椭圆一个焦点出发的波，经边界反射后会同时到达另一个焦点（到两焦点的距离之和处处相等）——“回音壁”就是这个道理。' },
  { id: 'doppler', label: '多普勒', note: '波源向右移动：前方的波被压密（频率升高），后方被拉疏（频率降低），救护车驶过时音调的变化就是这样来的。' },
  { id: 'mach', label: '音障', note: '波源比波跑得还快（马赫数 M > 1）：各时刻发出的波前叠成一个锥面，半顶角 θ = arcsin(1/M)，这就是音爆。虚线是理论上的马赫锥。' },
  { id: 'drum', label: '鼓面驻波', note: '四边固定的矩形鼓面的本征振动 sin(mπx/W)·sin(nπy/H)：深色的节线始终不动，整个鼓面以同一个频率 ω = cπ√((m/W)² + (n/H)²) 起伏。' },
  { id: 'chladni', label: '克拉尼图形', note: '在振动的金属板上撒沙：振动强的地方把沙子弹开，沙子最后停在不动的节线上，画出这些图形。' },
];

// signed amplitude → colour: blue troughs, dark rest level, amber crests
function waveColour(v) {
  const t = Math.min(1, Math.abs(v));
  const base = [8, 11, 18];
  const stops = v < 0 ? [[37, 99, 235], [165, 205, 255]] : [[234, 120, 40], [255, 232, 180]];
  const mid = t < 0.65 ? t / 0.65 : 1, hi = t < 0.65 ? 0 : (t - 0.65) / 0.35;
  return [0, 1, 2].map((k) => base[k] + (stops[0][k] - base[k]) * mid + (stops[1][k] - stops[0][k]) * hi);
}
const WAVE_LUT = Array.from({ length: 256 }, (_, i) => waveColour((i - 127.5) / 127.5));
function intensityColour(t) {
  const stops = [[7, 10, 16], [52, 40, 130], [34, 190, 230], [236, 254, 255]];
  const u = Math.min(1, t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(u)), f = u - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
}
const INT_LUT = Array.from({ length: 256 }, (_, i) => intensityColour(i / 255));

function create({ stage, panel, query, setQuery }) {
  const qs = query.get('s');
  const st = {
    scene: SCENES.some((s) => s.id === qs) ? qs : 'ripple',
    playing: true,
    steps: 4,
    display: 'wave',
    tool: 'drop',
    lambda: 14,
    mach: 0.6,
    m: 3, n: 2,
    cm: 2, cn: 5, sign: -1, showAmp: false,
    damp: 0,
    absorb: true,
    rain: false,
    scale: null,
    sandAmp: 0,
  };
  const ql = Number(query.get('l'));
  if (ql >= 8 && ql <= 32) st.lambda = Math.round(ql);

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const info = h('div', { class: 'overlay-card tl', id: 'waves-info' });
  const playBtn = iconButton({ iconName: 'pause', title: '播放 / 暂停（Space）', cls: 'play', id: 'waves-play', onClick: () => setPlaying(!st.playing) });
  const transport = h('div', { class: 'transport' },
    iconButton({ iconName: 'reset', title: '重新开始这个场景（R）', id: 'waves-reset', onClick: () => build() }),
    playBtn,
    iconButton({ iconName: 'step', title: '前进一小步（→）', id: 'waves-step', onClick: () => { setPlaying(false); advance(4); draw(); } }),
    h('div', { class: 'sep' }),
    iconButton({ iconName: 'trash', title: '清空水槽（C）', id: 'waves-clear', onClick: () => clearTank() }));
  stage.append(info, transport);

  let GW = 0, GH = 0, wave = null;
  const img = { canvas: document.createElement('canvas'), ctx: null, data: null };
  const sceneInfo = {}; // geometry of the current scene, for overlays and readouts

  // ------------------------------------------------------------------ scenes
  function resizeGrid(w, hh) {
    const gw = Math.max(180, Math.min(320, Math.round(w / 3)));
    const gh = Math.max(110, Math.min(260, Math.round((gw * hh) / Math.max(1, w))));
    if (gw === GW && gh === GH) return false;
    GW = gw; GH = gh;
    wave = new Wave(GW, GH);
    img.canvas.width = GW;
    img.canvas.height = GH;
    img.ctx = img.canvas.getContext('2d');
    img.data = img.ctx.createImageData(GW, GH);
    return true;
  }

  function lineSource(x, amp = 0.5) {
    for (let y = 1; y < GH - 1; y++) wave.addSource(x, y, { wavelength: st.lambda, amp });
  }

  function build() {
    if (!wave) return;
    const W = GW, H = GH, s = st.scene;
    wave.clearAll();
    for (const k of Object.keys(sceneInfo)) delete sceneInfo[k];
    st.scale = null;
    const absorb = s === 'drum' || s === 'ellipse' ? false : st.absorb;
    wave.setAbsorbing(absorb);
    wave.damping = st.damp;
    if (s === 'ripple') {
      wave.drop(Math.round(W * 0.36), Math.round(H * 0.45), 2.5, 2.5);
      wave.drop(Math.round(W * 0.62), Math.round(H * 0.6), 2, 2.5);
    } else if (s === 'two') {
      const d = 3 * st.lambda;
      wave.addSource(W * 0.5, H / 2 - d / 2, { wavelength: st.lambda, amp: 6 });
      wave.addSource(W * 0.5, H / 2 + d / 2, { wavelength: st.lambda, amp: 6 });
      sceneInfo.d = d;
    } else if (s === 'slit' || s === 'single') {
      lineSource(20);
      const x = Math.round(W * 0.36);
      const gaps = s === 'slit'
        ? [[H / 2 - 2 * st.lambda, Math.max(4, 0.5 * st.lambda)], [H / 2 + 2 * st.lambda, Math.max(4, 0.5 * st.lambda)]]
        : [[H / 2, 2.5 * st.lambda]];
      wave.walls(slitWall(x, 3, gaps));
      Object.assign(sceneInfo, { wallX: x, d: 4 * st.lambda, a: 2.5 * st.lambda, L: W - 20 - x });
    } else if (s === 'lens') {
      lineSource(20);
      const R = 0.75 * H, a = 0.36 * H, t = 2 * (R - Math.sqrt(R * R - a * a));
      const x0 = Math.round(W * 0.3);
      wave.medium(lens(x0, H / 2, R, t), 0.6);
      Object.assign(sceneInfo, { lensX: x0, R, thin: lensFocal(R, 0.6) });
    } else if (s === 'ellipse') {
      const a = W * 0.45, b = Math.min(H * 0.43, a * 0.8), c = Math.sqrt(a * a - b * b);
      wave.walls(outsideEllipse(W / 2, H / 2, a, b));
      wave.damping = Math.max(st.damp, 0.0004);
      wave.drop(Math.round(W / 2 - c), Math.round(H / 2), 2.5, 2);
      Object.assign(sceneInfo, { a, b, c, f1: [W / 2 - c, H / 2], f2: [W / 2 + c, H / 2] });
    } else if (s === 'doppler' || s === 'mach') {
      sceneInfo.mover = wave.addSource(W * (s === 'mach' ? 0.12 : 0.2), H / 2, { wavelength: st.lambda, amp: 8, vx: st.mach });
    } else if (s === 'drum') {
      wave.mode(st.m, st.n, 1);
    }
    syncPanel();
    syncQuery();
    draw();
  }

  function clearTank() {
    if (st.scene === 'chladni') { sprinkle(); return; }
    wave.clearAll();
    wave.setAbsorbing(st.absorb);
    for (const k of Object.keys(sceneInfo)) delete sceneInfo[k];
    st.scale = null;
    draw();
  }

  function advance(n) {
    for (let k = 0; k < n; k++) {
      const mv = sceneInfo.mover;
      if (mv && mv.x > GW * 0.86) { mv.x = GW * (st.scene === 'mach' ? 0.12 : 0.2); wave.clearWaves(); }
      if (st.rain && Math.random() < 0.012) wave.drop(2 + Math.floor(Math.random() * (GW - 4)), 2 + Math.floor(Math.random() * (GH - 4)), 1.2, 1.6);
      wave.step(DT);
    }
  }

  // ------------------------------------------------------------------ Chladni plate
  const SAND = 14000;
  const sand = { x: new Float32Array(SAND), y: new Float32Array(SAND), ampImg: null, ampKey: '' };
  function sprinkle() {
    for (let i = 0; i < SAND; i++) { sand.x[i] = Math.random(); sand.y[i] = Math.random(); }
    measureSand();
  }
  function shakeSand(rounds) {
    const { cm, cn, sign } = st;
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < SAND; i++) {
        const a = Math.abs(chladni(sand.x[i], sand.y[i], cm, cn, sign)) / 2;
        const s = 0.03 * a;
        sand.x[i] = Math.min(1, Math.max(0, sand.x[i] + (Math.random() - 0.5) * 2 * s));
        sand.y[i] = Math.min(1, Math.max(0, sand.y[i] + (Math.random() - 0.5) * 2 * s));
      }
    }
  }
  function measureSand() {
    let tot = 0;
    for (let i = 0; i < SAND; i += 7) tot += Math.abs(chladni(sand.x[i], sand.y[i], st.cm, st.cn, st.sign)) / 2;
    st.sandAmp = tot / Math.ceil(SAND / 7);
  }
  function plateRect() {
    const P = Math.floor(Math.min(layer.w * 0.9, (layer.h - 80) * 0.94));
    return { P, x0: Math.round((layer.w - P) / 2), y0: Math.round((layer.h - 70 - P) / 2) + 4 };
  }
  function amplitudeImage() {
    const key = `${st.cm},${st.cn},${st.sign}`;
    if (sand.ampKey === key) return sand.ampImg;
    const N = 220;
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    const im = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = chladni((x + 0.5) / N, (y + 0.5) / N, st.cm, st.cn, st.sign) / 2;
        const col = WAVE_LUT[Math.max(0, Math.min(255, Math.round(127.5 + v * 127.5)))];
        const q = 4 * (y * N + x);
        im.data[q] = col[0]; im.data[q + 1] = col[1]; im.data[q + 2] = col[2]; im.data[q + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    sand.ampImg = c;
    sand.ampKey = key;
    return c;
  }
  function drawChladni(ctx) {
    const { P, x0, y0 } = plateRect();
    if (st.showAmp) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(amplitudeImage(), x0, y0, P, P);
      ctx.globalAlpha = 1;
    } else {
      const g = ctx.createLinearGradient(x0, y0, x0 + P, y0 + P);
      g.addColorStop(0, '#1d2433');
      g.addColorStop(1, '#0e121b');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, P, P);
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, P + 1, P + 1);
    ctx.fillStyle = 'rgba(244, 222, 170, 0.85)';
    ctx.beginPath();
    const sz = Math.max(1.1, P / 520);
    for (let i = 0; i < SAND; i++) ctx.rect(x0 + sand.x[i] * P - sz / 2, y0 + sand.y[i] * P - sz / 2, sz, sz);
    ctx.fill();
    info.textContent = '';
    info.append(
      h('div', { class: 'title' }, '克拉尼图形 · 正方形板'),
      h('div', { class: 'big' }, `m = ${st.cm}, n = ${st.cn}`),
      h('div', { class: 'big', style: { color: C.text2, fontSize: '12px', fontFamily: 'inherit' } },
        st.cm === st.cn && st.sign < 0 ? 'm = n 时反对称组合恒为 0，换一组试试' : `cos ${st.cn}πx·cos ${st.cm}πy ${st.sign < 0 ? '−' : '+'} cos ${st.cm}πx·cos ${st.cn}πy`));
    read.set('t', '—');
    read.set('lambda', '—');
    read.set('extra', `沙子离节线的平均振幅 ${st.sandAmp.toFixed(3)}`);
  }

  // ------------------------------------------------------------------ rendering
  function gainTarget(field, sqrt) {
    // a robust peak: the 98th percentile of a sample of |u| (point sources would dominate a max);
    // behind a slit screen only the far side counts, where the fringes are
    const n = 1500, vals = new Float32Array(n);
    const x0 = sceneInfo.wallX ? sceneInfo.wallX + 4 : 0, cols = GW - x0;
    for (let k = 0; k < n; k++) {
      const j = Math.floor(((k + 0.5) / n) * cols * GH);
      const i = (j % GH) * GW + x0 + Math.floor(j / GH);
      vals[k] = sqrt ? Math.sqrt(field[i]) : Math.abs(field[i]);
    }
    vals.sort();
    // the floor keeps faint leftovers (the slowly fading wake of a drop) from being blown up to full colour
    return Math.max(sqrt ? 0.06 : 0.09, vals[Math.floor(n * 0.985)] * 1.25);
  }

  function draw() {
    const { ctx } = layer;
    layer.reset();
    ctx.fillStyle = '#070a10';
    ctx.fillRect(0, 0, layer.w, layer.h);
    if (st.scene === 'chladni') { drawChladni(ctx); return; }
    if (!wave) return;
    const intensity = st.display === 'intensity';
    const field = intensity ? wave.I : wave.u;
    const target = gainTarget(field, intensity);
    st.scale = st.scale == null ? target : st.scale + 0.08 * (target - st.scale);
    const inv = 1 / st.scale;
    const d = img.data.data;
    const { wall, speed } = wave;
    for (let i = 0; i < field.length; i++) {
      const q = 4 * i;
      if (wall[i]) {
        const edge = !(wall[i - 1] ?? 1) || !(wall[i + 1] ?? 1) || !(wall[i - GW] ?? 1) || !(wall[i + GW] ?? 1);
        if (edge) { d[q] = 120; d[q + 1] = 134; d[q + 2] = 160; } else { d[q] = 24; d[q + 1] = 29; d[q + 2] = 40; }
        d[q + 3] = 255;
        continue;
      }
      let col;
      if (intensity) col = INT_LUT[Math.min(255, Math.round(Math.sqrt(field[i]) * inv * 255))];
      else col = WAVE_LUT[Math.max(0, Math.min(255, Math.round(127.5 + field[i] * inv * 127.5)))];
      const slow = speed[i] < 1 ? 1 : 0;
      d[q] = col[0] + 6 * slow; d[q + 1] = col[1] + 26 * slow; d[q + 2] = col[2] + 18 * slow; d[q + 3] = 255;
    }
    img.ctx.putImageData(img.data, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img.canvas, 0, 0, layer.w, layer.h);
    drawOverlays(ctx);
    paintInfo();
  }

  const sx = (x) => ((x + 0.5) / GW) * layer.w;
  const sy = (y) => ((y + 0.5) / GH) * layer.h;
  function drawOverlays(ctx) {
    // sources
    for (const s of wave.sources) {
      if (sceneInfo.mover !== s && (st.scene === 'slit' || st.scene === 'single' || st.scene === 'lens')) continue;
      ctx.beginPath();
      ctx.arc(sx(s.x), sy(s.y), 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (st.scene === 'slit' || st.scene === 'single' || st.scene === 'lens') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx(20), 0);
      ctx.lineTo(sx(20), layer.h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (sceneInfo.f1) {
      for (const [k, f] of [['F₁', sceneInfo.f1], ['F₂', sceneInfo.f2]]) {
        const X = sx(f[0]), Y = sy(f[1]);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(X - 5, Y); ctx.lineTo(X + 5, Y); ctx.moveTo(X, Y - 5); ctx.lineTo(X, Y + 5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = `12px ${MONO}`;
        ctx.fillText(k, X + 6, Y - 6);
      }
    }
    if (sceneInfo.mover && st.mach > 1) {
      const s = sceneInfo.mover;
      const th = Math.asin(1 / st.mach);
      const L = GW;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(sx(s.x - L * Math.cos(th)), sy(s.y - L * Math.sin(th)));
      ctx.lineTo(sx(s.x), sy(s.y));
      ctx.lineTo(sx(s.x - L * Math.cos(th)), sy(s.y + L * Math.sin(th)));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function paintInfo() {
    const sc = SCENES.find((s) => s.id === st.scene);
    info.textContent = '';
    info.append(
      h('div', { class: 'title' }, `${sc.label} · ${GW}×${GH} 网格`),
      h('div', { class: 'big' }, `t = ${wave.t.toFixed(1)}`),
      h('div', { class: 'big', style: { color: C.text2 } }, st.display === 'intensity' ? '时间平均强度 ⟨u²⟩' : '波形 u(x, y)'));
    read.set('t', wave.t.toFixed(1));
    const omega = (2 * Math.PI) / st.lambda;
    read.set('lambda', st.scene === 'drum' ? '—' : `λ = ${st.lambda}，ω = ${omega.toFixed(3)}`);
    read.set('extra', extraReadout());
  }

  function extraReadout() {
    const s = st.scene;
    if (s === 'two') return `源距 d = ${sceneInfo.d ?? '—'}（${sceneInfo.d ? (sceneInfo.d / st.lambda).toFixed(0) : '—'}λ）`;
    if (s === 'slit') return `条纹间距 λL/d ≈ ${((st.lambda * sceneInfo.L) / sceneInfo.d).toFixed(0)} 格（屏在右边缘）`;
    if (s === 'single') return `第一暗纹 θ = arcsin(λ/a) = ${((Math.asin(st.lambda / sceneInfo.a) * 180) / Math.PI).toFixed(1)}°`;
    if (s === 'lens') return `薄透镜焦距 R/2(n−1) ≈ ${sceneInfo.thin.toFixed(0)} 格（厚透镜会更近）`;
    if (s === 'ellipse') return `走过 2a = ${(2 * sceneInfo.a).toFixed(0)}（t ≈ ${(2 * sceneInfo.a).toFixed(0)}）汇聚到 F₂`;
    if (s === 'doppler' || s === 'mach') {
      if (st.mach < 1) return `M = ${st.mach.toFixed(2)}：前方 λ′ = λ(1 − M) = ${(st.lambda * (1 - st.mach)).toFixed(1)}，后方 ${(st.lambda * (1 + st.mach)).toFixed(1)}`;
      return `M = ${st.mach.toFixed(2)}：马赫角 arcsin(1/M) = ${((Math.asin(1 / st.mach) * 180) / Math.PI).toFixed(1)}°`;
    }
    if (s === 'drum') {
      const w = Math.PI * Math.hypot(st.m / (GW - 1), st.n / (GH - 1));
      return `ω = ${w.toFixed(4)}，周期 ${((2 * Math.PI) / w).toFixed(1)}`;
    }
    return `${wave.sources.length} 个波源，${countWalls()} 格墙`;
  }
  function countWalls() { let n = 0; for (const v of wave.wall) n += v; return n; }

  // ------------------------------------------------------------------ interaction
  const toGrid = (e) => {
    const r = layer.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * GW - 0.5, ((e.clientY - r.top) / r.height) * GH - 0.5];
  };
  let dragging = null;
  function paintWall(x, y, on) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const X = Math.round(x) + dx, Y = Math.round(y) + dy;
        if (X < 1 || Y < 1 || X >= GW - 1 || Y >= GH - 1) continue;
        const i = Y * GW + X;
        wave.wall[i] = on;
        if (on) { wave.u[i] = 0; wave.prev[i] = 0; }
      }
    }
  }
  function strokeTo(p) {
    const a = dragging.last;
    const n = Math.max(1, Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1])));
    for (let k = 1; k <= n; k++) {
      const x = a[0] + ((p[0] - a[0]) * k) / n, y = a[1] + ((p[1] - a[1]) * k) / n;
      if (dragging.kind === 'wall') paintWall(x, y, dragging.on);
      else if (k % 3 === 0 || k === n) {
        if (Math.hypot(x - dragging.dropAt[0], y - dragging.dropAt[1]) >= 3) { wave.drop(Math.round(x), Math.round(y), 0.8, 2); dragging.dropAt = [x, y]; }
      }
    }
    dragging.last = p;
  }
  const onDown = (e) => {
    if (st.scene === 'chladni' || e.button > 0) return;
    const p = toGrid(e);
    if (st.tool === 'source') {
      const near = wave.sources.findIndex((s) => Math.hypot(s.x - p[0], s.y - p[1]) < 5);
      if (near >= 0) {
        const [s] = wave.sources.splice(near, 1);
        if (s === sceneInfo.mover) delete sceneInfo.mover;
      } else if (wave.sources.length < 400) wave.addSource(p[0], p[1], { wavelength: st.lambda, amp: 6 });
      draw();
      return;
    }
    layer.canvas.setPointerCapture?.(e.pointerId);
    if (st.tool === 'wall') {
      const i = Math.round(p[1]) * GW + Math.round(p[0]);
      dragging = { kind: 'wall', on: wave.wall[i] ? 0 : 1, last: p };
      paintWall(p[0], p[1], dragging.on);
    } else {
      dragging = { kind: 'drop', last: p, dropAt: p };
      wave.drop(Math.round(p[0]), Math.round(p[1]), 2.5, 2.5);
    }
    draw();
  };
  const onMove = (e) => {
    if (!dragging) return;
    strokeTo(toGrid(e));
    if (!st.playing) draw();
  };
  const onUp = () => { dragging = null; };
  layer.canvas.addEventListener('pointerdown', onDown);
  layer.canvas.addEventListener('pointermove', onMove);
  layer.canvas.addEventListener('pointerup', onUp);
  layer.canvas.addEventListener('pointercancel', onUp);
  layer.canvas.style.touchAction = 'none';
  const setCursor = () => { layer.canvas.style.cursor = st.scene === 'chladni' ? 'default' : st.tool === 'wall' ? 'cell' : 'crosshair'; };

  // ------------------------------------------------------------------ panel
  const sceneChips = chips({
    id: 'waves-scenes',
    items: SCENES.map((s) => ({ id: s.id, label: s.label })),
    value: st.scene,
    onPick: (id) => setScene(id),
  });
  const sceneNote = h('div', { class: 'hint', id: 'waves-note' });

  const lambdaSlider = slider({
    label: '波长 λ（格）', min: 8, max: 32, step: 1, value: st.lambda, id: 'waves-lambda', format: (v) => String(v),
    onInput: (v) => {
      st.lambda = v;
      if (['two', 'slit', 'single'].includes(st.scene)) build(); // the geometry is laid out in wavelengths
      else for (const s of wave.sources) s.omega = (2 * Math.PI) / v;
      syncQuery();
    },
  });
  const machSlider = slider({
    label: '波源速度 M = v/c', min: 0.1, max: 2, step: 0.05, value: st.mach, id: 'waves-mach', format: (v) => v.toFixed(2),
    onInput: (v) => { st.mach = v; if (sceneInfo.mover) sceneInfo.mover.vx = v; },
  });
  const mSlider = slider({ label: '横向波腹数 m', min: 1, max: 8, step: 1, value: st.m, id: 'waves-m', format: (v) => String(v), onInput: (v) => { st.m = v; build(); } });
  const nSlider = slider({ label: '纵向波腹数 n', min: 1, max: 8, step: 1, value: st.n, id: 'waves-n', format: (v) => String(v), onInput: (v) => { st.n = v; build(); } });
  const waveSection = section('波', [lambdaSlider.el, machSlider.el, mSlider.el, nSlider.el]);

  const cmSlider = slider({ label: 'm', min: 1, max: 10, step: 1, value: st.cm, id: 'chladni-m', format: (v) => String(v), onInput: (v) => { st.cm = v; draw(); } });
  const cnSlider = slider({ label: 'n', min: 1, max: 10, step: 1, value: st.cn, id: 'chladni-n', format: (v) => String(v), onInput: (v) => { st.cn = v; draw(); } });
  const signSeg = segmented({ id: 'chladni-sign', options: [{ value: '-1', label: '反对称 −' }, { value: '1', label: '对称 +' }], value: String(st.sign), onChange: (v) => { st.sign = Number(v); draw(); } });
  const chladniPresets = chips({
    id: 'chladni-presets',
    items: [[1, 2], [1, 4], [2, 5], [3, 5], [3, 7], [4, 7], [5, 9]].map(([a, b]) => ({ id: `${a},${b}`, label: `${a}·${b}` })),
    onPick: (id) => { const [a, b] = id.split(',').map(Number); st.cm = a; st.cn = b; cmSlider.set(a); cnSlider.set(b); draw(); },
  });
  const chladniSection = section('板的振型', [chladniPresets.el, cmSlider.el, cnSlider.el, signSeg.el,
    h('div', { class: 'btn-row' }, button({ label: '重新撒沙', iconName: 'shuffle', small: true, id: 'chladni-sprinkle', onClick: () => { sprinkle(); draw(); } })),
    toggle({ label: '显示振幅', value: st.showAmp, swatch: '#ea7828', onChange: (v) => { st.showAmp = v; draw(); } }).el,
    h('div', { class: 'hint' }, '换一组 m、n，沙子会从旧的节线上被抖开，再慢慢聚到新的节线上。振幅图里蓝色和橙色的区域反相振动，沙子停在它们的交界处。')]);

  const displaySeg = segmented({
    id: 'waves-display',
    options: [{ value: 'wave', label: '波形' }, { value: 'intensity', label: '强度 ⟨u²⟩' }],
    value: st.display,
    onChange: (v) => { st.display = v; st.scale = null; draw(); },
  });
  const stepsSlider = slider({ label: '速度（步 / 帧）', min: 1, max: 10, step: 1, value: st.steps, id: 'waves-steps', format: (v) => String(v), onInput: (v) => { st.steps = v; } });
  const dampSlider = slider({ label: '阻尼', min: 0, max: 0.01, step: 0.0005, value: st.damp, id: 'waves-damp', format: (v) => (v ? v.toFixed(4) : '无'), onInput: (v) => { st.damp = v; wave.damping = st.scene === 'ellipse' ? Math.max(v, 0.0004) : v; } });
  const absorbToggle = toggle({ label: '吸收边界', value: st.absorb, swatch: '#475569', id: 'waves-absorb', onChange: (v) => { st.absorb = v; wave.setAbsorbing(v); } });
  const rainToggle = toggle({ label: '下雨', value: st.rain, swatch: '#7aa2ff', id: 'waves-rain', onChange: (v) => { st.rain = v; } });
  const mediumSection = section('显示与介质', [displaySeg.el, stepsSlider.el, dampSlider.el, h('div', { class: 'toggles two' }, absorbToggle.el, rainToggle.el),
    h('div', { class: 'hint' }, '“强度”显示 u² 的时间平均：干涉、衍射的亮暗条纹会静止下来。关掉吸收边界，波会在四壁来回反射。')]);

  const toolSeg = segmented({
    id: 'waves-tool',
    options: [{ value: 'drop', label: '水滴' }, { value: 'wall', label: '画墙' }, { value: 'source', label: '波源' }],
    value: st.tool,
    onChange: (v) => { st.tool = v; setCursor(); },
  });
  const toolSection = section('工具', [toolSeg.el, h('div', { class: 'hint' }, '水滴：点击或拖动。画墙：拖动画出挡板，从墙上开始拖则擦除——自己搭一个三缝或者波导。波源：点击放一个持续振荡的点波源（都同相位），点它一下移除。')]);

  const read = readout([['t', '时间'], ['lambda', '波长 · 角频率'], ['extra', '这一幕']], { id: 'waves-readout' });
  const readSection = section('读数', [read.el, h('div', { class: 'hint' }, '有限差分：u⁺ = 2u − u⁻ + (cΔt)²·Δu，Δt = 0.5，网格间距 1。')]);

  panel.append(section('场景', [sceneChips.el, sceneNote]), waveSection, chladniSection, mediumSection, toolSection, readSection);

  function syncPanel() {
    const s = st.scene;
    const sc = SCENES.find((x) => x.id === s);
    sceneNote.textContent = sc.note;
    const tank = s !== 'chladni';
    waveSection.style.display = tank ? '' : 'none';
    chladniSection.style.display = tank ? 'none' : '';
    mediumSection.style.display = tank ? '' : 'none';
    toolSection.style.display = tank ? '' : 'none';
    lambdaSlider.el.style.display = s === 'drum' ? 'none' : '';
    machSlider.el.style.display = s === 'doppler' || s === 'mach' ? '' : 'none';
    mSlider.el.style.display = s === 'drum' ? '' : 'none';
    nSlider.el.style.display = s === 'drum' ? '' : 'none';
    transport.querySelector('#waves-step').style.display = tank ? '' : 'none';
    setCursor();
  }

  function sceneDefaults(id) {
    if (id === 'doppler') { st.mach = 0.6; machSlider.set(0.6); }
    if (id === 'mach') { st.mach = 1.6; machSlider.set(1.6); }
    if (id === 'two' || id === 'slit' || id === 'single') { st.display = 'intensity'; displaySeg.set('intensity'); }
    else if (st.display === 'intensity') { st.display = 'wave'; displaySeg.set('wave'); }
    if (id === 'chladni') sprinkle();
  }
  function setScene(id) {
    st.scene = id;
    sceneChips.set(id);
    sceneDefaults(id);
    build();
  }

  function syncQuery() {
    setQuery({ s: st.scene !== 'ripple' ? st.scene : null, l: st.lambda !== 14 && st.scene !== 'chladni' && st.scene !== 'drum' ? st.lambda : null });
  }

  function setPlaying(on) {
    st.playing = on;
    playBtn.innerHTML = '';
    const t = document.createElement('template');
    t.innerHTML = on
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 v13 l11-6.5 z" fill="currentColor"/></svg>';
    playBtn.append(t.content.firstElementChild);
  }

  let frame = 0;
  const loop = animationLoop(() => {
    if (!wave) return;
    if (st.playing) {
      if (st.scene === 'chladni') {
        shakeSand(3);
        if (++frame % 8 === 0) measureSand();
      } else advance(st.steps);
    }
    if (st.playing || st.scene === 'chladni') draw();
  });

  const stopResize = observeSize(stage, (w, hh) => {
    layer.resize(w, hh);
    if (resizeGrid(w, hh)) build();
    else draw();
  });
  sceneDefaults(st.scene);
  setPlaying(true);
  syncPanel();
  loop.start();

  return {
    help: {
      tips: [
        '波动方程 u_tt = c²∇²u 用有限差分一步步推进：每一格的加速度正比于它和四个邻居的平均差。',
        '“双缝”“单缝”“双源”默认显示强度：干涉条纹的位置可以和读数里的公式对照。',
        '用“画墙”自己搭挡板和缝，用“波源”放置相干的点波源。',
        '“音障”里把 M 拖到 1 附近，看波前怎样在波源前方堆积成激波。',
        '“克拉尼图形”里换 m、n，沙子会重新排出新的节线图案。',
      ],
      keys: [['Space', '播放 / 暂停'], ['→', '前进一小步'], ['R', '重新开始'], ['C', '清空水槽'], ['I', '波形 / 强度']],
    },
    onKey(e) {
      if (e.key === ' ') { setPlaying(!st.playing); e.preventDefault(); }
      else if (e.key === 'ArrowRight' && st.scene !== 'chladni') { setPlaying(false); advance(4); draw(); }
      else if (e.key === 'r' || e.key === 'R') { if (st.scene === 'chladni') sprinkle(); build(); }
      else if (e.key === 'c' || e.key === 'C') clearTank();
      else if ((e.key === 'i' || e.key === 'I') && st.scene !== 'chladni') { st.display = st.display === 'wave' ? 'intensity' : 'wave'; displaySeg.set(st.display); st.scale = null; draw(); }
    },
    snapshot: () => layer.canvas,
    state: () => ({
      scene: st.scene, t: wave ? wave.t : 0, playing: st.playing, tool: st.tool, display: st.display,
      lambda: st.lambda, mach: st.mach, grid: [GW, GH],
      sources: wave ? wave.sources.length : 0, walls: wave ? countWalls() : 0,
      m: st.m, n: st.n, cm: st.cm, cn: st.cn, sandAmp: st.sandAmp,
    }),
    field: (x, y) => wave.u[y * GW + x],
    intensity: (x, y) => wave.I[y * GW + x],
    gridToClient(x, y) { const r = layer.canvas.getBoundingClientRect(); return [r.left + ((x + 0.5) / GW) * r.width, r.top + ((y + 0.5) / GH) * r.height]; },
    setPlaying,
    destroy() {
      loop.stop();
      stopResize();
      layer.canvas.removeEventListener('pointerdown', onDown);
      layer.canvas.removeEventListener('pointermove', onMove);
      layer.canvas.removeEventListener('pointerup', onUp);
      layer.canvas.removeEventListener('pointercancel', onUp);
    },
  };
}

export default {
  id: 'waves',
  title: '波动',
  short: '波动',
  subtitle: '水波槽里的干涉、衍射、透镜和音障，鼓面的驻波，还有沙子画出的克拉尼图形',
  icon: 'waves',
  create,
};
