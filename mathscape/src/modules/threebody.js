// Module 4 — the gravitational three-body (N-body) problem in the plane.

import { h } from '../ui/dom.js';
import { Layer, Viewport, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { drawGrid, arrow, label, backdrop } from '../ui/draw.js';
import { section, slider, toggle, button, chips, readout, iconButton, selectBox } from '../ui/controls.js';
import { fmt, fmtVec } from '../ui/format.js';
import { C, FONT, MONO, alpha, ramp } from '../ui/theme.js';
import { NBody, PRESETS, INTEGRATORS, randomSystem } from '../core/nbody.js';

const TRAIL_MAX = 12000;
const VEL_SCALE = 0.8; // world units of arrow per unit of velocity

function create({ stage, panel, actions, toast, query, setQuery }) {
  const st = {
    preset: PRESETS[0],
    seed: null,
    initial: null, // snapshot to reset to
    sys: null,
    method: 'dopri',
    dt: 0.002,
    rtol: 1e-10,
    speed: 1,
    playing: true,
    trailLen: 4000,
    show: { potential: true, trails: true, velocity: false, com: true, labels: true },
    comFrame: true,
    E0: 0,
    L0: 0,
    hist: [],
    trails: [],
    steps: 0,
    stepsPerSec: 0,
    drag: null,
    hover: null,
  };

  // ------------------------------------------------------------------ DOM
  const root = h('div', { class: 'layer', style: { position: 'absolute', inset: 0 } });
  stage.append(root);
  const bg = new Layer(root, { passive: true });
  const fg = new Layer(root);
  const hud = h('div', { class: 'overlay-card tl', id: 'nbody-hud', style: { minWidth: '210px' } });
  const tip = h('div', { class: 'tooltip', style: { display: 'none' } });
  root.append(hud, tip);
  const vp = new Viewport({ scale: 200 });

  // transport bar
  const playBtn = iconButton({ iconName: 'pause', title: '播放 / 暂停（Space）', cls: 'play', id: 'nbody-play', onClick: () => setPlaying(!st.playing) });
  const timeEl = h('div', { class: 'time', id: 'nbody-time' }, 't = 0.00');
  const transport = h('div', { class: 'transport' },
    iconButton({ iconName: 'reset', title: '回到初始状态（R）', id: 'nbody-reset', onClick: () => resetToInitial() }),
    playBtn,
    iconButton({ iconName: 'step', title: '单步前进 0.05（→）', onClick: () => { setPlaying(false); simulate(0.05); } }),
    iconButton({ iconName: 'reverse', title: '时间反演：所有速度取反', id: 'nbody-reverse', onClick: () => reverseTime() }),
    h('div', { class: 'sep' }),
    timeEl);
  root.append(transport);

  // glow sprites, one per colour
  const sprites = new Map();
  function sprite(color) {
    if (sprites.has(color)) return sprites.get(color);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, alpha(color, 0.85));
    grd.addColorStop(0.18, alpha(color, 0.45));
    grd.addColorStop(0.45, alpha(color, 0.12));
    grd.addColorStop(1, alpha(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    sprites.set(color, c);
    return c;
  }
  const colorOf = (i) => C.bodies[i % C.bodies.length];

  // ------------------------------------------------------------------ simulation
  function load(cfg, { preset = null, seed = null } = {}) {
    st.preset = preset;
    st.seed = seed;
    st.sys = new NBody(cfg);
    st.sys.rtol = st.rtol;
    st.sys.atol = st.rtol * 1e-2;
    st.sys.softening = softSlider ? softSlider.value : 0;
    st.sys.toCenterOfMassFrame();
    st.initial = st.sys.snapshot();
    restartBookkeeping();
    const r = preset?.view || viewRadius();
    if (vp.w > 1) vp.fitRadius(r);
    rebuildBodyList();
    presetChips?.set(preset?.id ?? null);
    noteEl && (noteEl.textContent = preset ? preset.note : `随机生成的束缚三体系统（种子 ${seed}）。总能量为负，但大多数随机初值最终都会抛出一个天体。`);
    syncQuery();
  }

  function viewRadius() {
    let r = 1;
    for (let i = 0; i < st.sys.n; i++) r = Math.max(r, Math.hypot(...st.sys.pos(i)) * 1.5);
    return r;
  }

  function restartBookkeeping() {
    st.sys.t = 0;
    st.sys.invalidate();
    st.E0 = st.sys.energy();
    st.L0 = st.sys.angularMomentum();
    st.hist = [];
    st.trails = Array.from({ length: st.sys.n }, () => ({ buf: new Float32Array(2 * TRAIL_MAX), head: -1, n: 0 }));
    st.steps = 0;
    recordTrails();
  }

  function resetToInitial() {
    const { masses, pos, vel } = st.initial;
    st.sys.setBodies(masses, pos, vel);
    st.sys.softening = softSlider.value;
    restartBookkeeping();
    rebuildBodyList();
    drawAll();
  }

  function recordTrails() {
    const [cx, cy] = st.comFrame ? st.sys.centerOfMass() : [0, 0];
    for (let i = 0; i < st.sys.n; i++) {
      const tr = st.trails[i];
      const [x, y] = st.sys.pos(i);
      tr.head = (tr.head + 1) % TRAIL_MAX;
      tr.buf[2 * tr.head] = x - cx;
      tr.buf[2 * tr.head + 1] = y - cy;
      tr.n = Math.min(tr.n + 1, TRAIL_MAX);
    }
  }

  /**
   * Advance by `duration` in small chunks so trails stay smooth; returns false on failure.
   * With `realtime` (the playback loop) a frame stops after ~24 ms of work, so a hard stretch
   * such as a close encounter plays in slow motion instead of freezing the page. Explicit steps
   * (step button, →, the test hook) always advance by exactly `duration`.
   */
  function simulate(duration, { realtime = false } = {}) {
    const sys = st.sys;
    const chunk = 0.004;
    const n = realtime ? Math.min(400, Math.max(1, Math.ceil(duration / chunk))) : Math.max(1, Math.ceil(duration / chunk));
    const t0 = performance.now();
    for (let k = 0; k < n; k++) {
      const r = sys.advance(duration / n, st.method, { dt: st.dt, budget: realtime ? 40000 : Infinity });
      st.steps += r.steps;
      if (!r.ok) {
        setPlaying(false);
        toast('积分失败：天体几乎相撞，步长下溢。可增大软化长度 ε 或换用其他积分器。', 4200);
        break;
      }
      recordTrails();
      if (realtime && performance.now() - t0 > 24) break; // keep the frame responsive
    }
    const E = sys.energy();
    const rel = Math.abs((E - st.E0) / st.E0);
    st.hist.push([sys.t, rel]);
    if (st.hist.length > 3000) st.hist.splice(0, st.hist.length - 3000);
    return sys.failed !== true;
  }

  function reverseTime() {
    st.sys.reverse();
    toast('时间反演：速度已全部取反，系统将沿原路返回');
    rebuildBodyList();
  }

  function setPlaying(p) {
    st.playing = p;
    playBtn.innerHTML = '';
    playBtn.append(h('span', { html: (p ? PAUSE : PLAY) }));
  }
  const PLAY = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5.5 v13 l11-6.5 z" fill="currentColor"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/></svg>';

  // ------------------------------------------------------------------ drawing
  const potCanvas = document.createElement('canvas');
  let potImg = null;
  function drawPotential(ctx) {
    const cell = 6;
    const W = Math.ceil(vp.w / cell), H = Math.ceil(vp.h / cell);
    if (potCanvas.width !== W || potCanvas.height !== H) { potCanvas.width = W; potCanvas.height = H; potImg = null; }
    if (!potImg) potImg = new ImageData(W, H);
    const data = potImg.data;
    const sys = st.sys;
    const n = sys.n;
    const [cx, cy] = st.comFrame ? sys.centerOfMass() : [0, 0];
    const bx = new Float64Array(n), by = new Float64Array(n);
    for (let i = 0; i < n; i++) { const [x, y] = sys.pos(i); bx[i] = x - cx; by[i] = y - cy; }
    const soft2 = (8 / vp.scale) ** 2; // visual softening of ~8 px
    const M = sys.totalMass();
    const ref = Math.log(M / (Math.max(vp.w, vp.h) / vp.scale)); // potential level at view scale
    for (let j = 0; j < H; j++) {
      const y = vp.wy((j + 0.5) * cell);
      for (let i = 0; i < W; i++) {
        const x = vp.wx((i + 0.5) * cell);
        let phi = 0;
        for (let k = 0; k < n; k++) phi += sys.m[k] / Math.sqrt((x - bx[k]) ** 2 + (y - by[k]) ** 2 + soft2);
        const v = Math.log(phi) - ref; // ≥ about 0 at the view edge, grows towards the bodies
        const t = Math.min(1, Math.max(0, v / 5));
        const band = 0.82 + 0.18 * Math.abs(((v * 2.2) % 1 + 1) % 1 - 0.5) * 2;
        const [r, g, b] = ramp(t * 0.95);
        const a = (0.16 + 0.6 * t) * band;
        const p = 4 * (j * W + i);
        data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255 * a;
      }
    }
    potCanvas.getContext('2d').putImageData(potImg, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(potCanvas, 0, 0, W * cell, H * cell);
    ctx.restore();
  }

  function drawBg() {
    bg.reset();
    const ctx = bg.ctx;
    const W = vp.w, H = vp.h;
    backdrop(ctx, W, H, '#0d1220', '#06080d', 0.5, bg.dpr);
    if (st.show.potential) drawPotential(ctx);
    drawGrid(ctx, vp, { minor: false, alpha: 0.55 });
  }

  function drawFg() {
    fg.reset();
    const ctx = fg.ctx;
    const sys = st.sys;
    const [cx, cy] = st.comFrame ? sys.centerOfMass() : [0, 0];
    const sx = (x) => vp.sx(x), sy = (y) => vp.sy(y);
    if (st.show.trails) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const CH = 20;
      st.trails.forEach((tr, i) => {
        const n = Math.min(tr.n, st.trailLen);
        if (n < 2) return;
        const start = (tr.head - n + 1 + TRAIL_MAX) % TRAIL_MAX;
        const per = Math.ceil(n / CH);
        for (let c = 0; c < CH; c++) {
          const i0 = c * per, i1 = Math.min(n - 1, (c + 1) * per);
          if (i1 <= i0) continue;
          ctx.beginPath();
          for (let k = i0; k <= i1; k++) {
            const q = (start + k) % TRAIL_MAX;
            const px = sx(tr.buf[2 * q]), py = sy(tr.buf[2 * q + 1]);
            if (k === i0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          const a = (c + 1) / CH;
          ctx.globalAlpha = 0.04 + 0.8 * a * a;
          ctx.lineWidth = 0.8 + 1.6 * a;
          ctx.strokeStyle = colorOf(i);
          ctx.stroke();
        }
      });
      ctx.restore();
    }
    if (st.show.com) {
      const [mx, my] = sys.centerOfMass();
      const px = sx(mx - cx), py = sy(my - cy);
      ctx.save();
      ctx.strokeStyle = 'rgba(232,236,244,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - 7, py); ctx.lineTo(px + 7, py);
      ctx.moveTo(px, py - 7); ctx.lineTo(px, py + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
    const mMax = Math.max(...sys.m);
    const showVel = st.show.velocity || !st.playing;
    for (let i = 0; i < sys.n; i++) {
      const [x, y] = sys.pos(i);
      const px = sx(x - cx), py = sy(y - cy);
      const r = 5 + 5 * Math.cbrt(sys.m[i] / mMax);
      const col = colorOf(i);
      const spr = sprite(col);
      const R = r * 6;
      ctx.drawImage(spr, px - R, py - R, 2 * R, 2 * R);
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, 2 * Math.PI);
      const grd = ctx.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.35, col);
      grd.addColorStop(1, alpha(col, 0.85));
      ctx.fillStyle = grd;
      ctx.fill();
      if (st.hover === `b${i}` || st.drag === `b${i}`) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
      if (showVel) {
        const [vx, vy] = sys.vel(i);
        const ex = sx(x - cx + vx * VEL_SCALE), ey = sy(y - cy + vy * VEL_SCALE);
        arrow(ctx, px, py, ex, ey, { color: alpha(col, 0.9), width: 1.8, head: 9 });
        if (!st.playing) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(ex, ey, st.hover === `v${i}` || st.drag === `v${i}` ? 7 : 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#0c1018';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = col;
          ctx.stroke();
          ctx.restore();
        }
      }
      if (st.show.labels) {
        label(ctx, `m${'₁₂₃₄₅₆'[i]} = ${fmt(sys.m[i], 2)}`, px + r + 6, py - r - 6, { color: col, font: `600 11px ${FONT}`, bg: 'rgba(8,11,17,0.55)' });
      }
    }
  }

  function drawHud() {
    const sys = st.sys;
    const E = sys.energy();
    const rel = Math.abs((E - st.E0) / st.E0);
    const L = sys.angularMomentum();
    const [px, py] = sys.momentum();
    timeEl.textContent = `t = ${sys.t.toFixed(2)}`;
    hudRead.set('t', fmt(sys.t, 3));
    hudRead.set('E', fmt(E, 8));
    hudRead.set('dE', rel === 0 ? '0' : rel.toExponential(2), rel < 1e-8 ? 'good' : rel < 1e-4 ? 'warn' : 'bad');
    hudRead.set('L', fmt(L, 8));
    hudRead.set('dL', fmt(Math.abs(L - st.L0), 3));
    hudRead.set('P', fmt(Math.hypot(px, py), 3));
    hudRead.set('rmin', fmt(sys.minDistance(), 4));
    hudRead.set('steps', `${Math.round(st.stepsPerSec)} 步/秒`);
    hud.innerHTML = '';
    hud.append(
      h('div', { class: 'title' }, st.preset ? st.preset.name : `随机系统 #${st.seed}`),
      h('dl', { class: 'readout' },
        h('dt', null, '时间 t'), h('dd', null, sys.t.toFixed(3)),
        h('dt', null, '能量 E'), h('dd', null, fmt(E, 6)),
        h('dt', null, '|ΔE / E₀|'), h('dd', { class: rel < 1e-8 ? 'good' : rel < 1e-4 ? 'warn' : 'bad', id: 'hud-de' }, rel === 0 ? '0' : rel.toExponential(2)),
        h('dt', null, '角动量 L'), h('dd', null, fmt(L, 6))));
  }

  function drawChart() {
    const c = chartLayer;
    c.reset();
    const ctx = c.ctx;
    const W = c.w, H = c.h;
    const padL = 34, padR = 6, padT = 8, padB = 16;
    const lo = -16, hi = 0;
    const Y = (v) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB);
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = C.text3;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(148,163,184,0.13)';
    for (let e = lo; e <= hi; e += 4) {
      ctx.beginPath();
      ctx.moveTo(padL, Y(e));
      ctx.lineTo(W - padR, Y(e));
      ctx.stroke();
      ctx.fillText(`1e${e}`, padL - 4, Y(e));
    }
    if (st.hist.length < 2) return;
    const t1 = st.hist.at(-1)[0], t0 = st.hist[0][0];
    const X = (t) => padL + ((t - t0) / Math.max(1e-9, t1 - t0)) * (W - padL - padR);
    ctx.beginPath();
    st.hist.forEach(([t, r], k) => {
      const v = Math.log10(Math.max(r, 1e-17));
      if (k) ctx.lineTo(X(t), Y(Math.max(lo, v))); else ctx.moveTo(X(t), Y(Math.max(lo, v)));
    });
    ctx.strokeStyle = '#7aa2ff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`t ∈ [${fmt(t0, 1)}, ${fmt(t1, 1)}]`, padL + 4, H - padB + 2);
  }

  function drawAll() {
    drawBg();
    drawFg();
    drawHud();
    drawChart();
  }

  // ------------------------------------------------------------------ main loop
  let stepAcc = 0, timeAcc = 0, hudTick = 0;
  const loop = animationLoop((dt) => {
    if (st.playing && !st.drag) {
      const before = st.steps;
      simulate(dt * st.speed, { realtime: true });
      stepAcc += st.steps - before;
      timeAcc += dt;
      if (timeAcc > 0.5) { st.stepsPerSec = stepAcc / timeAcc; stepAcc = 0; timeAcc = 0; }
    }
    drawBg();
    drawFg();
    if ((hudTick += dt) > 0.1) { hudTick = 0; drawHud(); drawChart(); }
  });

  // ------------------------------------------------------------------ interaction (editing)
  function hitTest(px, py) {
    const sys = st.sys;
    const [cx, cy] = st.comFrame ? sys.centerOfMass() : [0, 0];
    if (!st.playing) {
      for (let i = 0; i < sys.n; i++) {
        const [x, y] = sys.pos(i), [vx, vy] = sys.vel(i);
        if (Math.hypot(vp.sx(x - cx + vx * VEL_SCALE) - px, vp.sy(y - cy + vy * VEL_SCALE) - py) < 10) return `v${i}`;
      }
    }
    for (let i = 0; i < sys.n; i++) {
      const [x, y] = sys.pos(i);
      if (Math.hypot(vp.sx(x - cx) - px, vp.sy(y - cy) - py) < 14) return `b${i}`;
    }
    return null;
  }
  let dragFrame = [0, 0];
  const detach = attachPointer(fg.canvas, vp, {
    hitTest,
    onDragStart(hd) {
      st.drag = hd;
      if (st.playing) setPlaying(false);
      dragFrame = st.comFrame ? st.sys.centerOfMass() : [0, 0];
    },
    onDrag(hd, x, y) {
      const i = +hd.slice(1);
      const sys = st.sys;
      const [cx, cy] = dragFrame;
      if (hd[0] === 'b') sys.setPos(i, x + cx, y + cy);
      else {
        const [bx, by] = sys.pos(i);
        sys.setVel(i, (x + cx - bx) / VEL_SCALE, (y + cy - by) / VEL_SCALE);
      }
      edited();
    },
    onDragEnd() { st.drag = null; st.initial = st.sys.snapshot(); presetChips.set(null); st.preset = null; noteEl.textContent = '自定义初值：暂停时可拖动天体与速度箭头。'; syncQuery(); },
    onHover(px, py, x, y, hit) {
      st.hover = hit;
      if (hit && hit[0] === 'b') {
        const i = +hit.slice(1);
        tip.style.display = '';
        tip.style.left = `${px}px`;
        tip.style.top = `${py}px`;
        tip.innerHTML = '';
        tip.append(h('div', { class: 't-title', style: { color: colorOf(i) } }, `天体 ${i + 1} · m = ${fmt(st.sys.m[i], 3)}`),
          h('div', { class: 't-mono' }, `r = ${fmtVec(...st.sys.pos(i), 3)}`),
          h('div', { class: 't-mono' }, `v = ${fmtVec(...st.sys.vel(i), 3)}`),
          h('div', { class: 't-mono', style: { color: C.text3 } }, st.playing ? '暂停后可拖动编辑' : '拖动改变位置；拖动箭头端点改变速度'));
      } else tip.style.display = 'none';
    },
    onLeave() { st.hover = null; tip.style.display = 'none'; },
  });

  function edited() {
    restartBookkeeping();
    rebuildBodyList(false);
  }

  const stopResize = observeSize(root, (w, hh) => {
    const first = vp.w <= 1;
    bg.resize(w, hh);
    fg.resize(w, hh);
    vp.setSize(w, hh);
    if (first) vp.fitRadius(st.preset?.view || viewRadius());
    drawAll();
  });

  // ------------------------------------------------------------------ panel
  const presetChips = chips({ items: PRESETS.map((p) => ({ id: p.id, label: p.name })), id: 'nbody-presets', onPick: (id) => { const p = PRESETS.find((q) => q.id === id); load(p, { preset: p }); setPlaying(true); } });
  const noteEl = h('div', { class: 'note', id: 'nbody-note' });
  const methodBox = selectBox({
    options: Object.entries(INTEGRATORS).map(([value, v]) => ({ value, label: v.label })),
    value: st.method,
    id: 'nbody-method',
    onChange: (v) => { st.method = v; st.sys.invalidate(); updateMethodUI(); syncQuery(); },
  });
  const dtSlider = slider({ label: '固定步长 Δt', min: -4, max: -1, step: 0.05, value: Math.log10(st.dt), format: (v) => (10 ** v).toExponential(1), onInput: (v) => { st.dt = 10 ** v; } });
  const tolSlider = slider({ label: '相对误差容限', min: -13, max: -4, step: 0.5, value: Math.log10(st.rtol), format: (v) => `1e${v}`, onInput: (v) => { st.rtol = 10 ** v; st.sys.rtol = st.rtol; st.sys.atol = st.rtol * 1e-2; } });
  const softSlider = slider({ label: '软化长度 ε', min: 0, max: 0.2, step: 0.001, value: 0, format: (v) => fmt(v, 3), onInput: (v) => { st.sys.softening = v; st.E0 = st.sys.energy(); st.hist = []; } });
  function updateMethodUI() {
    const adaptive = INTEGRATORS[st.method].adaptive;
    dtSlider.el.style.display = adaptive ? 'none' : '';
    tolSlider.el.style.display = adaptive ? '' : 'none';
  }
  const hudRead = readout([
    ['t', '时间 t'], ['E', '总能量 E'], ['dE', '相对能量误差'], ['L', '角动量 L'], ['dL', '|L − L₀|'], ['P', '总动量 |P|'], ['rmin', '最小间距'], ['steps', '积分速率'],
  ], { id: 'nbody-readout' });
  const chartWrap = h('div', { style: { position: 'relative', height: '120px', borderRadius: '10px', background: 'var(--bg-2)', border: '1px solid var(--border)', overflow: 'hidden' } });
  const chartLayer = new Layer(chartWrap, { passive: true });
  const bodyList = h('div', { class: 'field', id: 'body-list', style: { gap: '12px' } });
  const tg = (key, text, swatch) => toggle({ label: text, value: st.show[key], swatch, onChange: (v) => { st.show[key] = v; } });

  panel.append(
    section('初始构型', [presetChips.el, noteEl,
      h('div', { class: 'btn-row' }, button({ label: '随机构型', iconName: 'shuffle', small: true, id: 'nbody-random', onClick: () => { const cfg = randomSystem((Math.random() * 1e9) | 0); load(cfg, { seed: cfg.seed }); setPlaying(true); } }))]),
    section('播放', [
      slider({ label: '模拟速度（时间单位 / 秒）', min: 0.05, max: 8, step: 0.05, value: st.speed, format: (v) => `${fmt(v, 2)}`, id: 'nbody-speed', onInput: (v) => { st.speed = v; } }).el,
      slider({ label: '轨迹长度', min: 50, max: TRAIL_MAX, step: 50, value: st.trailLen, format: (v) => String(v), onInput: (v) => { st.trailLen = v; } }).el,
      h('div', { class: 'toggles two' },
        tg('trails', '轨迹', '#ffb454').el,
        tg('potential', '引力势场', '#9646b4').el,
        tg('velocity', '速度矢量', '#5ccfe6').el,
        tg('com', '质心', '#e8ecf4').el,
        tg('labels', '质量标签', '#a9b2c4').el,
        toggle({ label: '质心参考系', value: st.comFrame, onChange: (v) => { st.comFrame = v; restartTrailsOnly(); } }).el),
    ]),
    section('数值积分', [methodBox.el, tolSlider.el, dtSlider.el, softSlider.el,
      h('div', { class: 'hint' }, '自适应方法在近距离相遇时自动缩小步长；辛积分器（Yoshida、Verlet）步长固定，长期能量误差有界但不随时间漂移。试试用固定步长跑“毕达哥拉斯问题”，观察能量误差在相遇时跳变。')]),
    section('守恒量监测', [hudRead.el, chartWrap, h('div', { class: 'hint' }, '上图：相对能量误差 |ΔE/E₀| 的对数随时间变化。牛顿引力下 E、L、P 都应严格守恒，偏差完全来自数值误差。')]),
    section('天体', [bodyList,
      h('div', { class: 'btn-row' },
        button({ label: '添加天体', iconName: 'plus', small: true, id: 'nbody-add', onClick: addBody }),
        button({ label: '总动量归零', small: true, onClick: () => { st.sys.toCenterOfMassFrame(); st.initial = st.sys.snapshot(); edited(); toast('已切换到质心参考系（总动量为 0）'); } })),
      h('div', { class: 'hint' }, '暂停后可在画布上拖动天体改变位置、拖动速度箭头端点改变速度。')]),
  );

  function restartTrailsOnly() {
    st.trails = Array.from({ length: st.sys.n }, () => ({ buf: new Float32Array(2 * TRAIL_MAX), head: -1, n: 0 }));
    recordTrails();
  }

  function rebuildBodyList(full = true) {
    if (!full && bodyList.childElementCount === st.sys.n) return;
    bodyList.textContent = '';
    for (let i = 0; i < st.sys.n; i++) {
      const s = slider({
        label: `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${colorOf(i)};margin-right:6px"></span>天体 ${i + 1} 质量`,
        min: 0.01, max: 10, step: 0.01, value: st.sys.m[i], format: (v) => fmt(v, 2),
        onInput: (v) => { st.sys.setMass(i, v); st.initial.masses[i] = v; st.preset = null; presetChips.set(null); edited(); },
      });
      const row = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-end' } }, h('div', { style: { flex: 1 } }, s.el),
        st.sys.n > 2 ? iconButton({ iconName: 'minus', title: '移除该天体', onClick: () => removeBody(i) }) : null);
      bodyList.append(row);
    }
  }

  function addBody() {
    if (st.sys.n >= 6) { toast('最多 6 个天体'); return; }
    const snap = st.sys.snapshot();
    const r = viewRadius() / 1.5 || 1;
    const ang = Math.random() * 2 * Math.PI;
    snap.masses.push(0.3);
    snap.pos.push([r * 1.1 * Math.cos(ang), r * 1.1 * Math.sin(ang)]);
    const v = Math.sqrt(st.sys.totalMass() / (r * 1.1)) * 0.8;
    snap.vel.push([-v * Math.sin(ang), v * Math.cos(ang)]);
    load(snap, {});
    st.preset = null;
    noteEl.textContent = '添加了一颗新天体。';
  }

  function removeBody(i) {
    const snap = st.sys.snapshot();
    for (const k of ['masses', 'pos', 'vel']) snap[k].splice(i, 1);
    load(snap, {});
    noteEl.textContent = '移除了一颗天体。';
  }

  function syncQuery() {
    if (!presetChips) return;
    setQuery({ p: st.preset?.id ?? null, seed: st.seed ?? null, m: st.method === 'dopri' ? null : st.method });
  }

  // ------------------------------------------------------------------ init
  {
    const m = query.get('m');
    if (m && INTEGRATORS[m]) { st.method = m; methodBox.set(m); }
    const seed = Number(query.get('seed'));
    const p = PRESETS.find((q) => q.id === query.get('p'));
    if (!p && Number.isFinite(seed) && query.get('seed')) { const cfg = randomSystem(seed); load(cfg, { seed }); }
    else load(p || PRESETS[0], { preset: p || PRESETS[0] });
    updateMethodUI();
    setPlaying(true);
    const r = chartWrap.getBoundingClientRect();
    chartLayer.resize(r.width || 300, r.height || 120);
    new ResizeObserver(() => { const b = chartWrap.getBoundingClientRect(); if (b.width > 0) chartLayer.resize(b.width, b.height); }).observe(chartWrap);
    loop.start();
  }

  return {
    help: {
      tips: [
        '牛顿万有引力（G = 1）下的平面 N 体问题。默认用自适应 Dormand–Prince 5(4) 积分，相对误差 10⁻¹⁰。',
        '预设包括 8 字形轨道、拉格朗日与欧拉的经典解、Šuvakov–Dmitrašinović 发现的周期轨道族，以及著名的毕达哥拉斯三体问题。',
        '“时间反演”把所有速度取反：精确的数值解会沿原路返回，直到混沌把舍入误差放大。',
        '暂停后拖动天体、拖动速度箭头端点即可自定义初值；右侧监测能量、角动量与动量的守恒情况。',
      ],
      keys: [['Space', '播放 / 暂停'], ['R', '回到初始状态'], ['→', '单步前进'], ['V', '时间反演']],
    },
    onKey(e) {
      if (e.key === ' ') { setPlaying(!st.playing); e.preventDefault(); }
      else if (e.key === 'r' || e.key === 'R') resetToInitial();
      else if (e.key === 'ArrowRight') { setPlaying(false); simulate(0.05); }
      else if (e.key === 'v' || e.key === 'V') reverseTime();
    },
    snapshot() {
      const c = document.createElement('canvas');
      c.width = bg.canvas.width; c.height = bg.canvas.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(bg.canvas, 0, 0);
      ctx.drawImage(fg.canvas, 0, 0);
      return c;
    },
    // test hooks
    state: () => {
      const s = st.sys;
      return {
        preset: st.preset?.id ?? null, n: s.n, t: s.t, playing: st.playing, method: st.method,
        energy: s.energy(), E0: st.E0, relE: Math.abs((s.energy() - st.E0) / st.E0),
        L: s.angularMomentum(), L0: st.L0, P: s.momentum(), failed: s.failed,
        pos: Array.from({ length: s.n }, (_, i) => s.pos(i)), vel: Array.from({ length: s.n }, (_, i) => s.vel(i)), masses: Array.from(s.m),
      };
    },
    setPlaying,
    advance: (T) => simulate(T),
    worldToClient(x, y) {
      const [cx, cy] = st.comFrame ? st.sys.centerOfMass() : [0, 0];
      const r = fg.canvas.getBoundingClientRect();
      return [r.left + vp.sx(x - cx), r.top + vp.sy(y - cy)];
    },
    destroy() {
      loop.stop();
      detach();
      stopResize();
    },
  };
}

export default {
  id: 'threebody',
  title: '三体运动',
  short: '三体',
  subtitle: '牛顿引力下的三体（N 体）问题：经典周期解、混沌、守恒律与数值积分器的比较',
  icon: 'threebody',
  create,
};
