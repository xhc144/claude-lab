// Module 2 — complex functions w = f(z): domain colouring, images of grid lines, local
// conformality probe, and the argument principle on a draggable contour.

import { h } from '../ui/dom.js';
import { Layer, Viewport, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { drawGrid, label, handle } from '../ui/draw.js';
import { section, slider, toggle, segmented, button, chips, readout, exprField, iconButton } from '../ui/controls.js';
import { fmt, fmtComplex, deg } from '../ui/format.js';
import { C, FONT, MATH } from '../ui/theme.js';
import { complexFunction } from '../core/expr.js';
import { windingNumber } from '../core/complex.js';
import { DomainJob } from '../core/domaincolor.js';
import { adaptiveCurve, robustBounds } from '../core/curves.js';
import { tolerances } from '../ui/settings.js';

const PRESETS = [
  { id: 'sq', label: 'z²', f: 'z^2', grid: 'cart', R: 1.5 },
  { id: 'cubic', label: 'z³ − 1', f: 'z^3 - 1', grid: 'polar', R: 1.5 },
  { id: 'inv', label: '1/z', f: '1/z', grid: 'cart', R: 2 },
  { id: 'mobius', label: '(z−1)/(z+1)', f: '(z-1)/(z+1)', grid: 'cart', R: 2 },
  { id: 'exp', label: 'eᶻ', f: 'exp(z)', grid: 'cart', R: 1.6 },
  { id: 'log', label: 'log z', f: 'log(z)', grid: 'polar', R: 2.4 },
  { id: 'sqrt', label: '√z', f: 'sqrt(z)', grid: 'cart', R: 2 },
  { id: 'sin', label: 'sin z', f: 'sin(z)', grid: 'cart', R: 1.6 },
  { id: 'jouk', label: 'z + 1/z', f: 'z + 1/z', grid: 'polar', R: 2.4 },
  { id: 'gamma', label: 'Γ(z)', f: 'gamma(z)', grid: 'cart', R: 2, view: 4.5 },
  { id: 'rational', label: '有理函数', f: '(z^2 - 1)(z - 2 - i)^2/(z^2 + 2 + 2i)', grid: 'cart', R: 2, view: 3.2 },
  { id: 'blaschke', label: 'Blaschke 因子', f: '(z - a)/(1 - conj(a) z)', grid: 'polar', R: 0.98, a: [0.45, 0.3], view: 1.6 },
  { id: 'poly', label: 'z⁵ − z + a', f: 'z^5 - z + a', grid: 'polar', R: 1.3, a: [0.25, 0.1], view: 1.8 },
  { id: 'conj', label: 'z̄（非解析）', f: 'conj(z)', grid: 'cart', R: 1.5 },
];

// colour ramps for the two grid-line families
const lerpRGB = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
const FAM_A = [[251, 191, 36], [251, 113, 133]]; // Re z = c  or  |z| = r
const FAM_B = [[34, 211, 238], [167, 139, 250]]; // Im z = c  or  arg z = θ
const rgb = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

function create({ stage, panel, toast, query, setQuery }) {
  // precision mode (read once: a change of setting re-creates the module)
  const tol = tolerances();
  const st = {
    src: query.get('f') || 'z^2',
    F: null,
    a: [0.5, 0.3],
    style: 'enhanced',
    showColor: true,
    showRef: true,
    grid: 'cart',
    R: 1.5,
    density: 10,
    center: [0, 0],
    showGridZ: true,
    t: 1,
    probe: null,
    pinned: false,
    contour: { on: false, cx: 0.8, cy: 0.2, r: 1.2 },
    mapped: [],
    contourImg: null,
    winding: null,
    drag: null,
  };
  if (query.get('a')) {
    const [x, y] = query.get('a').split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) st.a = [x, y];
  }
  try { st.F = complexFunction(st.src); } catch { st.src = 'z^2'; st.F = complexFunction(st.src); }
  const out = new Float64Array(2);
  const f = (x, y) => { st.F.fn(x, y, st.a[0], st.a[1], out); return [out[0], out[1]]; };

  // ------------------------------------------------------------------ DOM
  const split = h('div', { class: 'split' });
  const paneZ = h('div', { class: 'pane', id: 'pane-z' });
  const paneW = h('div', { class: 'pane', id: 'pane-w' });
  split.append(paneZ, paneW);
  stage.append(split);
  const bgZ = new Layer(paneZ, { passive: true });
  const fgZ = new Layer(paneZ);
  const bgW = new Layer(paneW, { passive: true });
  const fgW = new Layer(paneW);
  paneZ.append(h('div', { class: 'pane-label', html: '<span class="math">z</span> 平面 · 定义域着色' }));
  paneW.append(h('div', { class: 'pane-label', html: '<span class="math">w</span> = <span class="math">f</span>(<span class="math">z</span>) 平面 · 网格的像' }));
  const probeCard = h('div', { class: 'overlay-card bl', id: 'probe-card', style: { display: 'none', minWidth: '210px' } });
  paneZ.append(probeCard);
  const windChip = h('div', { class: 'overlay-card tr', id: 'winding-chip', style: { display: 'none', top: '48px' } });
  paneZ.append(windChip);
  const vpZ = new Viewport({ scale: 100 });
  const vpW = new Viewport({ scale: 100 });
  paneZ.append(h('div', { class: 'pane-tools' }, iconButton({ iconName: 'fit', title: '复位定义域视图', onClick: () => { fitZ(); invalidate('zview', 'mapped'); } })));
  paneW.append(h('div', { class: 'pane-tools' }, iconButton({ iconName: 'fit', title: '适配像的范围', id: 'fit-w', onClick: () => { fitW(); invalidate('wview'); } })));

  // ------------------------------------------------------------------ computation
  const morph = (x, y, o) => {
    st.F.fn(x, y, st.a[0], st.a[1], out);
    const t = st.t;
    o[0] = (1 - t) * x + t * out[0];
    o[1] = (1 - t) * y + t * out[1];
  };

  /** Grid lines in the domain as parametric curves s ∈ [0, 1] → z, with a colour. */
  function gridCurves() {
    const [cx, cy] = st.center;
    const R = st.R;
    const n = st.density;
    const curves = [];
    if (st.grid === 'cart') {
      for (let k = 0; k <= n; k++) {
        const c = -R + (2 * R * k) / n;
        const tk = k / n;
        curves.push({ fam: 0, color: lerpRGB(...FAM_A, tk), axis: Math.abs(cx + c) < 1e-9, P: (s) => [cx + c, cy - R + 2 * R * s] });
        curves.push({ fam: 1, color: lerpRGB(...FAM_B, tk), axis: Math.abs(cy + c) < 1e-9, P: (s) => [cx - R + 2 * R * s, cy + c] });
      }
    } else {
      const nr = Math.max(2, Math.round(n / 2));
      for (let k = 1; k <= nr; k++) {
        const r = (R * k) / nr;
        curves.push({ fam: 0, color: lerpRGB(...FAM_A, k / nr), P: (s) => [cx + r * Math.cos(2 * Math.PI * s), cy + r * Math.sin(2 * Math.PI * s)] });
      }
      const nt = Math.max(4, 2 * Math.round(n / 2) + 4);
      for (let k = 0; k < nt; k++) {
        const th = (2 * Math.PI * k) / nt;
        curves.push({ fam: 1, color: lerpRGB(...FAM_B, k / nt), P: (s) => [cx + 1e-9 + R * s * Math.cos(th), cy + R * s * Math.sin(th)] });
      }
    }
    return curves;
  }

  function computeMapped() {
    const tol = 1.6 / vpW.scale;
    const b = vpW.bounds;
    const pad = (b.xmax - b.xmin) * 0.5;
    const bounds = { xmin: b.xmin - pad, xmax: b.xmax + pad, ymin: b.ymin - pad, ymax: b.ymax + pad };
    st.mapped = gridCurves().map((c) => ({
      ...c,
      lines: adaptiveCurve((s, o) => { const [x, y] = c.P(s); morph(x, y, o); }, 0, 1, { samples: 140, tol, breakLen: 60 / vpW.scale, maxDepth: 12, bounds }),
    }));
    if (st.contour.on) {
      const { cx, cy, r } = st.contour;
      const P = (s, o) => morph(cx + r * Math.cos(2 * Math.PI * s), cy + r * Math.sin(2 * Math.PI * s), o);
      st.contourImg = adaptiveCurve(P, 0, 1, { samples: 400, tol, breakLen: 60 / vpW.scale, maxDepth: 12, bounds });
      st.winding = windingNumber((s, o) => { st.F.fn(cx + r * Math.cos(2 * Math.PI * s), cy + r * Math.sin(2 * Math.PI * s), st.a[0], st.a[1], o); }, { samples: tol.windingSamples, maxTurn: tol.windingTurn, maxDepth: tol.hp ? 18 : 14 });
    } else {
      st.contourImg = null;
      st.winding = null;
    }
  }

  function fitZ() {
    const p = PRESETS.find((q) => q.f === st.src);
    const v = p?.view || 2.6;
    vpZ.fit(-v, v, -v, v, 0.02);
  }

  function fitW() {
    // sample the full map (t = 1 regardless of the morph slider) for a stable frame
    const t = st.t;
    st.t = 1;
    const lines = gridCurves().flatMap((c) => adaptiveCurve((s, o) => { const [x, y] = c.P(s); morph(x, y, o); }, 0, 1, { samples: 80, tol: Infinity }));
    st.t = t;
    const b = robustBounds(lines, 0.03);
    if (!b || !Number.isFinite(b.xmin) || !Number.isFinite(b.ymax)) { vpW.fit(-3, 3, -3, 3); return; }
    let { xmin, xmax, ymin, ymax } = b;
    const span = Math.max(xmax - xmin, ymax - ymin, 0.5);
    const mx = (xmin + xmax) / 2, my = (ymin + ymax) / 2;
    xmin = mx - span / 2; xmax = mx + span / 2; ymin = my - span / 2; ymax = my + span / 2;
    vpW.fit(xmin, xmax, ymin, ymax, 0.08);
  }

  // ------------------------------------------------------------------ domain colouring jobs
  const off = { z: document.createElement('canvas'), w: document.createElement('canvas') };
  const jobs = { z: null, w: null };
  let jobRaf = 0;

  function startJob(which, quality) {
    const vp = which === 'z' ? vpZ : vpW;
    const W = Math.max(8, Math.round(vp.w * quality)), H = Math.max(8, Math.round(vp.h * quality));
    const fn = which === 'z' ? st.F.fn : (x, y, ar, ai, o) => { o[0] = x; o[1] = y; };
    const style = which === 'z' ? st.style : 'enhanced';
    const job = new DomainJob(W, H, { x0: vp.wx(0), y0: vp.wy(0), dx: vp.w / W / vp.scale, dy: vp.h / H / vp.scale, fn, ar: st.a[0], ai: st.a[1], style });
    job.view = vp.state();
    job.quality = quality;
    return job;
  }

  function blit(which, job) {
    const c = off[which];
    c.width = job.W;
    c.height = job.H;
    c.getContext('2d').putImageData(new ImageData(job.data, job.W, job.H), 0, 0);
    paintBg(which);
  }

  function paintBg(which) {
    const layer = which === 'z' ? bgZ : bgW;
    const vp = which === 'z' ? vpZ : vpW;
    const c = off[which];
    layer.reset();
    const ctx = layer.ctx;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, vp.w, vp.h);
    const show = which === 'z' ? st.showColor : st.showRef;
    if (!show || !c.width || !c._view) return;
    // the offscreen image was rendered for view c._view; map it into the current view
    const v = c._view;
    const k = vp.scale / v.scale;
    const wImg = vp.w * k, hImg = vp.h * k;
    const left = vp.sx(v.cx) - (vp.w / 2) * k;
    const top = vp.sy(v.cy) - (vp.h / 2) * k;
    ctx.save();
    ctx.globalAlpha = which === 'z' ? 1 : 0.3;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, left, top, wImg, hImg);
    ctx.restore();
    if (which === 'w') {
      ctx.fillStyle = 'rgba(12, 16, 24, 0.35)';
      ctx.fillRect(0, 0, vp.w, vp.h);
    }
  }

  /** Re-render colouring: a fast low-resolution pass now, full resolution over the next frames. */
  function refreshColoring(which) {
    const show = which === 'z' ? st.showColor : st.showRef;
    if (!show) { jobs[which] = null; paintBg(which); return; }
    const quick = startJob(which, which === 'z' ? 0.34 : 0.25);
    quick.run();
    off[which]._view = quick.view;
    blit(which, quick);
    jobs[which] = startJob(which, which === 'z' ? 1 : 0.5);
    // while the user keeps dragging, each frame would restart (and discard) the full-resolution
    // job: wait until input pauses so interactive frames only pay for the quick pass
    jobHoldUntil = performance.now() + 140;
    scheduleJobs();
  }

  let jobHoldUntil = 0;
  function scheduleJobs() {
    if (jobRaf) return;
    jobRaf = requestAnimationFrame(function step() {
      jobRaf = 0;
      if (performance.now() < jobHoldUntil) { jobRaf = requestAnimationFrame(step); return; }
      let pending = false;
      for (const which of ['z', 'w']) {
        const job = jobs[which];
        if (!job) continue;
        if (job.run(9)) {
          jobs[which] = null;
          off[which]._view = job.view;
          blit(which, job);
        } else pending = true;
      }
      if (pending) jobRaf = requestAnimationFrame(step);
    });
  }

  // ------------------------------------------------------------------ drawing
  function drawZ() {
    fgZ.reset();
    const ctx = fgZ.ctx;
    drawGrid(ctx, vpZ, { minor: false, labels: true, imaginary: true, alpha: st.showColor ? 0.55 : 1 });
    const sx = (x) => vpZ.sx(x), sy = (y) => vpZ.sy(y);
    const [cx, cy] = st.center;
    const R = st.R;
    if (st.showGridZ) {
      for (const c of gridCurves()) {
        ctx.beginPath();
        const N = st.grid === 'polar' && c.fam === 0 ? 128 : 1;
        for (let k = 0; k <= N; k++) {
          const [x, y] = c.P(k / N);
          if (k) ctx.lineTo(sx(x), sy(y)); else ctx.moveTo(sx(x), sy(y));
        }
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = 'rgba(8, 11, 17, 0.45)';
        ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = rgb(c.color, 0.95);
        ctx.stroke();
      }
      // region handle (drag to move the grid)
      const gx = sx(cx), gy = sy(cy);
      ctx.save();
      ctx.fillStyle = 'rgba(8, 11, 17, 0.7)';
      ctx.strokeStyle = 'rgba(232, 236, 244, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(gx - 5, gy - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const rx = st.grid === 'cart' ? sx(cx + R) : sx(cx + R);
      const ry = st.grid === 'cart' ? sy(cy + R) : sy(cy);
      handle(ctx, rx, ry, '#e8ecf4', { r: 4.5, active: st.drag === 'gr' });
    }
    if (st.contour.on) {
      const { cx: ox, cy: oy, r } = st.contour;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx(ox), sy(oy), r * vpZ.scale, 0, 2 * Math.PI);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(8, 11, 17, 0.45)';
      ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.restore();
      handle(ctx, sx(ox), sy(oy), '#ffffff', { r: 5, active: st.drag === 'cc' });
      handle(ctx, sx(ox + r), sy(oy), '#ffffff', { r: 4.5, active: st.drag === 'cr' });
    }
    if (st.F.usesParam) {
      const px = sx(st.a[0]), py = sy(st.a[1]);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#0c1018';
      ctx.strokeStyle = C.v;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(-6.5, -6.5, 13, 13);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      label(ctx, `a = ${fmtComplex(st.a[0], st.a[1], 2)}`, px + 12, py - 14, { color: C.v, font: `600 12px ${FONT}` });
    }
    if (st.probe) {
      const [x, y] = st.probe;
      const px = sx(x), py = sy(y);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 24, py); ctx.lineTo(px - 19, py);
      ctx.moveTo(px + 19, py); ctx.lineTo(px + 24, py);
      ctx.moveTo(px, py - 24); ctx.lineTo(px, py - 19);
      ctx.moveTo(px, py + 19); ctx.lineTo(px, py + 24);
      ctx.stroke();
      // a small cross of two directions, mapped on the right to show rotation/scaling
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.i;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 16, py); ctx.stroke();
      ctx.strokeStyle = C.j;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 16); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, st.pinned ? 4 : 2.5, 0, 2 * Math.PI); ctx.fill();
      ctx.restore();
    }
  }

  function drawW() {
    fgW.reset();
    const ctx = fgW.ctx;
    drawGrid(ctx, vpW, { minor: false, labels: true, imaginary: true, alpha: 0.8 });
    const sx = (x) => vpW.sx(x), sy = (y) => vpW.sy(y);
    ctx.lineJoin = 'round';
    for (const c of st.mapped) {
      ctx.beginPath();
      for (const l of c.lines) {
        ctx.moveTo(sx(l[0]), sy(l[1]));
        for (let k = 2; k < l.length; k += 2) ctx.lineTo(sx(l[k]), sy(l[k + 1]));
      }
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgb(c.color, 0.92);
      ctx.stroke();
    }
    if (st.contourImg) {
      ctx.save();
      ctx.beginPath();
      for (const l of st.contourImg) {
        ctx.moveTo(sx(l[0]), sy(l[1]));
        for (let k = 2; k < l.length; k += 2) ctx.lineTo(sx(l[k]), sy(l[k + 1]));
      }
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
      // origin marker: the winding number is counted around w = 0
      ctx.save();
      ctx.fillStyle = C.danger;
      ctx.beginPath();
      ctx.arc(sx(0), sy(0), 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
    if (st.probe) {
      const [x, y] = st.probe;
      const o = new Float64Array(2);
      morph(x, y, o);
      if (Number.isFinite(o[0]) && Number.isFinite(o[1])) {
        const px = sx(o[0]), py = sy(o[1]);
        // image of the small circle and the two direction ticks around z
        const rho = 16 / vpZ.scale;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k <= 64; k++) {
          const th = (2 * Math.PI * k) / 64;
          morph(x + rho * Math.cos(th), y + rho * Math.sin(th), o);
          if (k) ctx.lineTo(sx(o[0]), sy(o[1])); else ctx.moveTo(sx(o[0]), sy(o[1]));
        }
        ctx.stroke();
        const seg = (dx, dy, col) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          for (let k = 1; k <= 8; k++) {
            morph(x + (dx * rho * k) / 8, y + (dy * rho * k) / 8, o);
            ctx.lineTo(sx(o[0]), sy(o[1]));
          }
          ctx.stroke();
        };
        seg(1, 0, C.i);
        seg(0, 1, C.j);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function updateProbe() {
    if (!st.probe) { probeCard.style.display = 'none'; probeRead.set('z', '—'); return; }
    const [x, y] = st.probe;
    const [u, v] = f(x, y);
    let fx, fy;
    if (tol.hp) {
      // five-point stencil, error O(h⁴): about 13 correct digits instead of 10
      const hs = 1e-3 * Math.max(1, Math.hypot(x, y));
      const d = (dx, dy) => {
        const [a2, b2] = f(x + 2 * dx, y + 2 * dy), [a1, b1] = f(x + dx, y + dy);
        const [c1, e1] = f(x - dx, y - dy), [c2, e2] = f(x - 2 * dx, y - 2 * dy);
        return [(-a2 + 8 * a1 - 8 * c1 + c2) / (12 * hs), (-b2 + 8 * b1 - 8 * e1 + e2) / (12 * hs)];
      };
      fx = d(hs, 0);
      fy = d(0, hs);
    } else {
      const hstep = 1e-5 * Math.max(1, Math.hypot(x, y));
      const [u1, v1] = f(x + hstep, y), [u0, v0] = f(x - hstep, y);
      const [u3, v3] = f(x, y + hstep), [u2, v2] = f(x, y - hstep);
      fx = [(u1 - u0) / (2 * hstep), (v1 - v0) / (2 * hstep)];
      fy = [(u3 - u2) / (2 * hstep), (v3 - v2) / (2 * hstep)];
    }
    // Wirtinger derivatives: ∂f/∂z = (f_x − i f_y)/2, ∂f/∂z̄ = (f_x + i f_y)/2
    const dz = [(fx[0] + fy[1]) / 2, (fx[1] - fy[0]) / 2];
    const dzb = [(fx[0] - fy[1]) / 2, (fx[1] + fy[0]) / 2];
    const mod = Math.hypot(u, v);
    const dzbAbs = Math.hypot(...dzb);
    const analytic = dzbAbs < (tol.hp ? 1e-8 : 1e-5) * Math.max(1, Math.hypot(...dz));
    const dc = tol.hp ? 8 : 4; // digits in the stage card / in the panel
    const dp = tol.hp ? 12 : 5;
    const rows = [
      ['z', fmtComplex(x, y, dc - 1)],
      ['f(z)', fmtComplex(u, v, dc)],
      ['|f|, arg f', Number.isFinite(mod) ? `${fmt(mod, dc)}, ${deg(Math.atan2(v, u))}` : '∞'],
      ["f′(z)", Number.isFinite(dz[0]) ? fmtComplex(dz[0], dz[1], dc) : '—'],
    ];
    probeCard.style.display = '';
    probeCard.innerHTML = '';
    probeCard.append(h('div', { class: 'title' }, st.pinned ? '探针（已固定 · 双击取消）' : '探针（单击固定）'),
      h('dl', { class: 'readout' }, rows.flatMap(([k, val]) => [h('dt', { style: { fontFamily: MATH, fontStyle: 'italic' } }, k), h('dd', null, val)])));
    probeRead.set('z', fmtComplex(x, y, dp - 1));
    probeRead.set('w', fmtComplex(u, v, dp));
    probeRead.set('mod', Number.isFinite(mod) ? `${fmt(mod, dp)}  ∠ ${deg(Math.atan2(v, u))}` : '∞');
    probeRead.set('dz', Number.isFinite(dz[0]) ? fmtComplex(dz[0], dz[1], dp) : '—');
    probeRead.set('scale', Number.isFinite(dz[0]) ? `放大 ${fmt(Math.hypot(...dz), 4)} 倍，旋转 ${deg(Math.atan2(dz[1], dz[0]))}` : '—');
    probeRead.set('dzb', Number.isFinite(dzbAbs) ? `${fmt(dzbAbs, 3)}  ${analytic ? '✓ 满足 C–R 方程' : '✗ 非解析'}` : '—', analytic ? 'good' : 'warn');
  }

  function updateWinding() {
    if (!st.contour.on || !st.winding) { windChip.style.display = 'none'; windRead.set('n', '—'); return; }
    const w = st.winding;
    windChip.style.display = '';
    windChip.innerHTML = '';
    const ok = w.reliable && w.minModulus > 1e-9;
    windChip.append(h('div', { class: 'title' }, '幅角原理'),
      h('div', { class: 'big', style: { fontSize: '15px' } }, ok ? `Z − P = ${w.winding}` : '曲线经过零点或极点'));
    windRead.set('n', ok ? String(w.winding) : '无法确定（曲线过零点/极点）', ok ? 'good' : 'warn');
    windRead.set('exact', fmt(w.exact, tol.hp ? 12 : 6));
  }

  // ------------------------------------------------------------------ invalidation
  // dirty flags: color (z colouring), wcolor (w reference colouring), mapped (grid images),
  // z / w (foreground redraw), probe (readouts)
  const dirty = { color: false, wcolor: false, mapped: false, z: false, w: false, probe: false };
  const GROUPS = {
    fn: ['color', 'mapped', 'z', 'w', 'probe'], // function or parameter changed
    zview: ['color', 'z'], // z viewport moved
    wview: ['wcolor', 'mapped', 'w'], // w viewport moved
    zfg: ['z'],
    overlays: ['z', 'w', 'probe'],
  };
  let raf = 0;
  function invalidate(...what) {
    for (const k of what) for (const d of GROUPS[k] || [k]) dirty[d] = true;
    if (!raf) raf = requestAnimationFrame(flush);
  }
  function flush() {
    raf = 0;
    if (dirty.mapped) { computeMapped(); dirty.w = true; updateWinding(); }
    if (dirty.color) refreshColoring('z');
    if (dirty.wcolor) refreshColoring('w');
    if (dirty.z) drawZ();
    if (dirty.w) drawW();
    if (dirty.probe) updateProbe();
    for (const k in dirty) dirty[k] = false;
  }

  // ------------------------------------------------------------------ interaction
  const hitZ = (px, py) => {
    const near = (x, y, r = 12) => Math.hypot(vpZ.sx(x) - px, vpZ.sy(y) - py) < r;
    if (st.F.usesParam && near(st.a[0], st.a[1], 14)) return 'a';
    if (st.contour.on) {
      if (near(st.contour.cx + st.contour.r, st.contour.cy)) return 'cr';
      if (near(st.contour.cx, st.contour.cy)) return 'cc';
    }
    if (st.showGridZ) {
      const [cx, cy] = st.center;
      if (st.grid === 'cart' ? near(cx + st.R, cy + st.R) : near(cx + st.R, cy)) return 'gr';
      if (near(cx, cy, 9)) return 'gc';
    }
    if (st.pinned && st.probe && near(st.probe[0], st.probe[1], 12)) return 'probe';
    return null;
  };
  const detachZ = attachPointer(fgZ.canvas, vpZ, {
    hitTest: hitZ,
    cursor: (hd) => (hd === 'cr' || hd === 'gr' ? 'ew-resize' : 'grab'),
    onDragStart(hd) { st.drag = hd; },
    onDrag(hd, x, y) {
      if (hd === 'a') { st.a = [x, y]; invalidate('fn'); syncQuery(); paramRead.set('a', fmtComplex(x, y, 4)); }
      else if (hd === 'cc') { st.contour.cx = x; st.contour.cy = y; invalidate('mapped', 'zfg'); }
      else if (hd === 'cr') { st.contour.r = Math.max(0.02, Math.hypot(x - st.contour.cx, y - st.contour.cy)); invalidate('mapped', 'zfg'); }
      else if (hd === 'gc') { st.center = [x, y]; invalidate('mapped', 'zfg'); }
      else if (hd === 'gr') {
        const [cx, cy] = st.center;
        const R = st.grid === 'cart' ? Math.max(Math.abs(x - cx), Math.abs(y - cy)) : Math.hypot(x - cx, y - cy);
        st.R = Math.max(0.05, R);
        rSlider.set(Math.min(+rSlider.input.max, st.R));
        invalidate('mapped', 'zfg');
      } else if (hd === 'probe') { st.probe = [x, y]; invalidate('overlays'); }
    },
    onDragEnd() { st.drag = null; invalidate('zfg'); },
    onClick(x, y) { st.probe = [x, y]; st.pinned = true; invalidate('overlays'); },
    onHover(px, py, x, y) {
      if (st.pinned) return;
      st.probe = [x, y];
      invalidate('overlays');
    },
    onLeave() { if (!st.pinned && st.probe) { st.probe = null; invalidate('overlays'); } },
    onView: () => invalidate('zview'),
  });
  fgZ.canvas.addEventListener('dblclick', () => { st.pinned = false; st.probe = null; invalidate('overlays'); });
  const detachW = attachPointer(fgW.canvas, vpW, { onView: () => invalidate('wview') });

  const sizes = { z: false, w: false };
  const stopZ = observeSize(paneZ, (w, hh) => {
    bgZ.resize(w, hh); fgZ.resize(w, hh); vpZ.setSize(w, hh);
    if (!sizes.z) { sizes.z = true; fitZ(); }
    invalidate('zview', 'mapped');
  });
  const stopW = observeSize(paneW, (w, hh) => {
    bgW.resize(w, hh); fgW.resize(w, hh); vpW.setSize(w, hh);
    if (!sizes.w) { sizes.w = true; fitW(); }
    invalidate('wview');
  });

  // ------------------------------------------------------------------ morph animation
  const anim = { t0: 0 };
  const loop = animationLoop((dt, now) => {
    const s = Math.min(1, (now - anim.t0) / 2200);
    st.t = s < 0.5 ? 4 * s ** 3 : 1 - (-2 * s + 2) ** 3 / 2;
    tSlider.set(st.t);
    invalidate('mapped', 'probe');
    if (s >= 1) { loop.stop(); morphBtn.querySelector('span').textContent = '播放变形'; }
  });
  function playMorph() {
    if (loop.running) { loop.stop(); morphBtn.querySelector('span').textContent = '播放变形'; return; }
    anim.t0 = performance.now();
    morphBtn.querySelector('span').textContent = '停止';
    loop.start();
  }

  // ------------------------------------------------------------------ panel
  let fitTimer = 0;
  const fnField = exprField({
    prefix: 'f(z) =',
    value: st.src,
    id: 'fz-input',
    compile: (src) => complexFunction(src),
    onValid(F, src) {
      st.F = F;
      st.src = src;
      presetChips.set(PRESETS.find((p) => p.f === src)?.id ?? null);
      paramBox.style.display = F.usesParam ? '' : 'none';
      invalidate('fn');
      syncQuery();
      clearTimeout(fitTimer);
      fitTimer = setTimeout(() => { fitW(); invalidate('wview'); }, 450);
    },
  });
  const presetChips = chips({
    items: PRESETS.map((p) => ({ id: p.id, label: p.label, title: p.f })),
    value: PRESETS.find((p) => p.f === st.src)?.id,
    onPick: (id) => applyPreset(PRESETS.find((p) => p.id === id)),
  });
  function applyPreset(p) {
    if (p.a) st.a = [...p.a];
    st.grid = p.grid;
    gridSeg.set(p.grid);
    st.R = p.R;
    rSlider.set(p.R);
    st.center = [0, 0];
    st.src = p.f;
    fnField.set(p.f, false);
    st.F = complexFunction(p.f);
    presetChips.set(p.id);
    paramBox.style.display = st.F.usesParam ? '' : 'none';
    paramRead.set('a', fmtComplex(st.a[0], st.a[1], 4));
    fitZ();
    fitW();
    invalidate('fn', 'zview', 'wview');
    syncQuery();
  }

  const paramRead = readout([['a', '参数 <span class="math">a</span>']]);
  paramRead.set('a', fmtComplex(st.a[0], st.a[1], 4));
  const paramBox = h('div', { style: { display: st.F.usesParam ? '' : 'none' } }, paramRead.el,
    h('div', { class: 'hint' }, '在 z 平面拖动黄色菱形改变复参数 a，着色与网格实时更新。'));

  const styleSeg = segmented({
    options: [{ value: 'enhanced', label: '增强相位图' }, { value: 'phase', label: '纯相位' }, { value: 'checker', label: '棋盘格' }],
    value: st.style,
    id: 'style-seg',
    onChange: (v) => { st.style = v; invalidate('zview'); },
  });
  const gridSeg = segmented({
    options: [{ value: 'cart', label: '直角网格' }, { value: 'polar', label: '极坐标网格' }],
    value: st.grid,
    onChange: (v) => { st.grid = v; invalidate('mapped', 'zfg'); },
  });
  const rSlider = slider({ label: '网格范围 <span class="math">R</span>', min: 0.1, max: 6, step: 0.01, value: st.R, onInput: (v) => { st.R = v; invalidate('mapped', 'zfg'); } });
  const dSlider = slider({ label: '网格密度', min: 2, max: 24, step: 1, value: st.density, format: (v) => `${v}`, onInput: (v) => { st.density = v; invalidate('mapped', 'zfg'); } });
  const tSlider = slider({ label: '变形 <span class="math">w</span> = (1−<span class="math">t</span>)<span class="math">z</span> + <span class="math">t f</span>(<span class="math">z</span>)', min: 0, max: 1, step: 0.001, value: 1, format: (v) => fmt(v, 2), id: 'morph-slider', onInput: (v) => { loop.stop(); st.t = v; invalidate('mapped', 'probe'); } });
  const morphBtn = button({ label: '播放变形', iconName: 'play', variant: 'primary', onClick: playMorph, id: 'morph-play' });

  const probeRead = readout([
    ['z', '<span class="math">z</span>'],
    ['w', '<span class="math">f</span>(<span class="math">z</span>)'],
    ['mod', '模与辐角'],
    ['dz', '<span class="math">f′</span>(<span class="math">z</span>) = ∂<span class="math">f</span>/∂<span class="math">z</span>'],
    ['scale', '局部作用'],
    ['dzb', '|∂<span class="math">f</span>/∂<span class="math">z̄</span>|'],
  ], { id: 'probe-readout' });
  const windRead = readout([['n', '零点数 − 极点数'], ['exact', '总辐角变化 / 2π']], { id: 'winding-readout' });
  const contourToggle = toggle({
    label: '显示围道（幅角原理）', value: st.contour.on, id: 'contour-toggle', swatch: '#ffffff',
    onChange: (v) => { st.contour.on = v; invalidate('mapped', 'zfg'); },
  });

  panel.append(
    section('函数', [
      fnField.el,
      presetChips.el,
      paramBox,
      h('div', { class: 'hint', html: '变量 <code>z</code>（也可用 <code>x</code> = Re z, <code>y</code> = Im z）、常数 <code>i</code> <code>pi</code> <code>e</code>、参数 <code>a</code>；函数 sin cos tan exp log sqrt sinh cosh tanh asin acos atan gamma conj abs arg re im。支持隐式乘法，如 <code>2z(z-i)</code>。' }),
    ]),
    section('定义域着色', [
      styleSeg.el,
      h('div', { class: 'toggles' },
        toggle({ label: 'z 平面着色', value: st.showColor, onChange: (v) => { st.showColor = v; invalidate('zview'); } }).el,
        toggle({ label: 'w 平面参考色轮', value: st.showRef, onChange: (v) => { st.showRef = v; invalidate('wview'); } }).el),
      h('div', { class: 'hint', html: '颜色表示 arg f(z)：<span style="color:#ff7a7a">红</span>→<span style="color:#d6c84a">黄</span>→<span style="color:#4fd18b">绿</span>→<span style="color:#4fb6f0">蓝</span>→<span style="color:#c58cf0">紫</span> 逆时针一圈。所有颜色汇聚的点是零点或极点：绕零点颜色逆时针排列，绕极点顺时针；绕 n 圈即 n 阶。明暗条纹是 |f| 每翻倍一次的等高线。w 平面的参考色轮与之对应：z 处的颜色就是 f(z) 在右图所在处的颜色。' }),
    ]),
    section('网格映射', [
      gridSeg.el,
      rSlider.el,
      dSlider.el,
      h('div', { class: 'toggles' }, toggle({ label: '在 z 平面显示网格', value: st.showGridZ, onChange: (v) => { st.showGridZ = v; invalidate('zfg'); } }).el),
      morphBtn,
      tSlider.el,
      h('div', { class: 'hint' }, '拖动方块移动网格中心，拖动白色圆点调整范围。解析函数在 f′ ≠ 0 处保角：像网格依然处处正交。'),
    ]),
    section('探针', [probeRead.el, h('div', { class: 'hint', html: '在 z 平面移动鼠标；单击固定探针，双击取消。绿色 / 红色短线是 z 处的水平与竖直方向，右图显示它们的像：解析函数只把它们一起旋转 arg f′、放大 |f′| 倍。' })]),
    section('幅角原理', [contourToggle.el, windRead.el, h('div', { class: 'hint' }, '对围道内无零极点落在边界上的亚纯函数，f(γ) 绕原点的圈数 = 内部零点个数 − 极点个数（按重数计）。拖动圆心或边缘的白点。')]),
  );

  function syncQuery() {
    setQuery({ f: st.src, a: st.F.usesParam ? `${+st.a[0].toFixed(4)},${+st.a[1].toFixed(4)}` : null });
  }

  const initial = PRESETS.find((p) => p.f === st.src);
  if (initial) { st.grid = initial.grid; st.R = initial.R; gridSeg.set(st.grid); rSlider.set(st.R); }

  return {
    help: {
      tips: [
        '左图：定义域着色（相位图）。颜色是 f(z) 的辐角，明暗条纹是 |f| 的等高线。',
        '右图：左侧网格线在 f 下的像（颜色一一对应）。拖动“变形”滑块观察从恒等映射连续变到 f 的过程。',
        '探针显示 f(z)、导数 f′(z) 与 ∂f/∂z̄；解析函数的 ∂f/∂z̄ = 0（柯西–黎曼方程）。',
        '打开“幅角原理”：拖动圆形围道，右图白色曲线 f(γ) 绕红点（原点）的圈数就是围道内零点数减极点数。',
      ],
      keys: [['单击', '固定探针'], ['双击', '取消固定'], ['Space', '播放网格变形']],
    },
    onKey(e) { if (e.key === ' ') { playMorph(); e.preventDefault(); } },
    snapshot() {
      const c = document.createElement('canvas');
      const r1 = paneZ.getBoundingClientRect(), r2 = paneW.getBoundingClientRect();
      const s = bgZ.dpr;
      const vertical = r2.top >= r1.bottom - 1;
      c.width = vertical ? bgZ.canvas.width : bgZ.canvas.width + bgW.canvas.width + 2 * s;
      c.height = vertical ? bgZ.canvas.height + bgW.canvas.height + 2 * s : Math.max(bgZ.canvas.height, bgW.canvas.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1b2232';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bgZ.canvas, 0, 0); ctx.drawImage(fgZ.canvas, 0, 0);
      const ox = vertical ? 0 : bgZ.canvas.width + 2 * s, oy = vertical ? bgZ.canvas.height + 2 * s : 0;
      ctx.drawImage(bgW.canvas, ox, oy); ctx.drawImage(fgW.canvas, ox, oy);
      return c;
    },
    // test hooks
    state: () => ({ src: st.src, a: [...st.a], t: st.t, winding: st.winding && { n: st.winding.winding, reliable: st.winding.reliable }, lines: st.mapped.reduce((s, c) => s + c.lines.length, 0), probe: st.probe && [...st.probe], jobsPending: Boolean(jobs.z || jobs.w) }),
    setContour(cx, cy, r) { st.contour = { on: true, cx, cy, r }; contourToggle.set(true); invalidate('mapped', 'zfg'); },
    worldToClient(x, y) { const r = fgZ.canvas.getBoundingClientRect(); return [r.left + vpZ.sx(x), r.top + vpZ.sy(y)]; },
    destroy() {
      loop.stop();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(jobRaf);
      clearTimeout(fitTimer);
      detachZ(); detachW(); stopZ(); stopW();
    },
  };
}

export default {
  id: 'complex',
  title: '复变函数映射',
  short: '复变',
  subtitle: '定义域着色、网格的像、局部保角性与幅角原理',
  icon: 'complex',
  create,
};
