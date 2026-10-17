// Toolkit for the interactive animations: a HiDPI canvas that follows its container's width,
// sliders / selects / buttons, a math → screen plotter with axes, and an animation loop that
// pauses while the canvas is off screen.

import { texInline } from '../core/tex.js';

export const COLORS = {
  text: '#e9edff', muted: '#8f9ac2', grid: 'rgba(150,172,255,0.09)', axis: 'rgba(200,214,255,0.45)',
  a: '#7fb4ff', b: '#ffd166', c: '#ff8a65', d: '#4ee3c1', e: '#c49bff', f: '#ff9ad5', white: '#ffffff',
};
export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';

/**
 * Create the stage inside `host`.
 * @returns { canvas, ctx, w, h, controls, readout, onResize(fn), loop(fn), destroy(), add(fn) }
 */
export function stage(host, { height = 280, ratio = null, hint = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'ax';
  const canvas = document.createElement('canvas');
  const controls = document.createElement('div');
  controls.className = 'ax-controls';
  const readout = document.createElement('div');
  readout.className = 'ax-readout';
  wrap.append(canvas);
  if (hint) { const h = document.createElement('div'); h.className = 'ax-hint'; h.textContent = hint; wrap.append(h); }
  host.append(wrap, controls, readout);
  const ctx = canvas.getContext('2d');
  const S = { canvas, ctx, w: 0, h: 0, controls, readout, dpr: 1, visible: true, cleanups: [] };
  const resizeFns = [];
  const resize = () => {
    const w = Math.max(200, wrap.clientWidth || host.clientWidth || 400);
    const h = ratio ? Math.round(w * ratio) : height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === S.w && h === S.h && dpr === S.dpr) return;
    S.w = w; S.h = h; S.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const f of resizeFns) f(w, h);
    S.dirty = true;
  };
  S.onResize = (f) => resizeFns.push(f);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(wrap); else window.addEventListener('resize', resize);
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { S.visible = es[0].isIntersecting; }, { threshold: 0 }) : null;
  if (io) io.observe(canvas);
  resize();
  let raf = 0, last = 0, fn = null;
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min(50, t - last) : 16;
    last = t;
    resize();
    if (!S.visible || !fn) return;
    fn(dt, t);
  };
  /** run fn(dt, t) every frame while visible; draw only when it returns true or S.dirty */
  S.loop = (f) => { fn = f; if (!raf) raf = requestAnimationFrame(tick); };
  S.add = (f) => S.cleanups.push(f);
  S.destroy = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    ro?.disconnect();
    io?.disconnect();
    if (!ro) window.removeEventListener('resize', resize);
    for (const f of S.cleanups) f();
    wrap.remove(); controls.remove(); readout.remove();
  };
  S.clear = (bg = '#04060f') => { ctx.fillStyle = bg; ctx.fillRect(0, 0, S.w, S.h); };
  S.setReadout = (s) => { if (S._r !== s) { S._r = s; readout.innerHTML = texInline(s); } };
  S.pointer = (handlers) => pointer(canvas, handlers, S);
  return S;
}

export function slider(S, { label, min, max, step = 0.01, value, fmt = (v) => v, oninput }) {
  const lab = document.createElement('label');
  const span = document.createElement('span');
  span.innerHTML = texInline(label);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  const out = document.createElement('output');
  out.textContent = fmt(+value);
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); oninput?.(+input.value); S.dirty = true; });
  lab.append(span, input, out);
  S.controls.append(lab);
  return { el: input, get value() { return +input.value; }, set(v) { input.value = v; out.textContent = fmt(+v); } };
}

export function select(S, { label, options, value, onchange }) {
  const lab = document.createElement('label');
  lab.style.flex = '0 1 auto';
  const span = document.createElement('span');
  span.textContent = label;
  const sel = document.createElement('select');
  for (const [v, t] of options) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o); }
  sel.value = value;
  sel.addEventListener('change', () => { onchange?.(sel.value); S.dirty = true; });
  lab.append(span, sel);
  S.controls.append(lab);
  return sel;
}

export function button(S, label, onclick) {
  const b = document.createElement('button');
  b.className = 'btn sm';
  b.textContent = label;
  b.addEventListener('click', () => { onclick(b); S.dirty = true; });
  S.controls.append(b);
  return b;
}

export function checkbox(S, label, value, onchange) {
  const lab = document.createElement('label');
  lab.style.flex = '0 1 auto';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => { onchange(input.checked); S.dirty = true; });
  const span = document.createElement('span');
  span.innerHTML = texInline(label);
  lab.append(input, span);
  S.controls.append(lab);
  return input;
}

/** pointer helper: handlers.down(x, y) → truthy to start a drag; move(x, y); up() */
export function pointer(canvas, h, S) {
  let active = false;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { const [x, y] = pos(e); if (h.down && h.down(x, y, e) === false) return; active = true; canvas.setPointerCapture(e.pointerId); e.preventDefault(); if (S) S.dirty = true; };
  const move = (e) => { const [x, y] = pos(e); if (active) { h.move?.(x, y, e); if (S) S.dirty = true; } else h.hover?.(x, y, e); };
  const up = () => { if (active) { active = false; h.up?.(); if (S) S.dirty = true; } };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

/** map a math rectangle onto the canvas, keeping aspect if `equal` */
export function plot(S, { x0, x1, y0, y1, equal = false, pad = 26 }) {
  const P = {};
  const fit = () => {
    const W = S.w - pad * 2, H = S.h - pad * 2;
    let sx = W / (x1 - x0), sy = H / (y1 - y0);
    let ox = pad, oy = pad;
    if (equal) {
      const s = Math.min(sx, sy);
      ox += (W - s * (x1 - x0)) / 2; oy += (H - s * (y1 - y0)) / 2;
      sx = sy = s;
    }
    Object.assign(P, { sx, sy, ox, oy });
  };
  P.fit = fit;
  P.view = (v) => { ({ x0, x1, y0, y1 } = { x0, x1, y0, y1, ...v }); fit(); };
  P.X = (x) => P.ox + (x - x0) * P.sx;
  P.Y = (y) => P.oy + (y1 - y) * P.sy;
  P.ix = (px) => x0 + (px - P.ox) / P.sx;
  P.iy = (py) => y1 - (py - P.oy) / P.sy;
  P.bounds = () => ({ x0, x1, y0, y1 });
  P.axes = (ctx, { grid = true, labels = true, xstep, ystep } = {}) => {
    const xs = xstep || niceStep((x1 - x0) / 8), ys = ystep || niceStep((y1 - y0) / 6);
    ctx.lineWidth = 1;
    if (grid) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      for (let x = Math.ceil(x0 / xs) * xs; x <= x1 + 1e-9; x += xs) { ctx.moveTo(P.X(x), P.Y(y0)); ctx.lineTo(P.X(x), P.Y(y1)); }
      for (let y = Math.ceil(y0 / ys) * ys; y <= y1 + 1e-9; y += ys) { ctx.moveTo(P.X(x0), P.Y(y)); ctx.lineTo(P.X(x1), P.Y(y)); }
      ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    if (y0 <= 0 && y1 >= 0) { ctx.moveTo(P.X(x0), P.Y(0)); ctx.lineTo(P.X(x1), P.Y(0)); }
    if (x0 <= 0 && x1 >= 0) { ctx.moveTo(P.X(0), P.Y(y0)); ctx.lineTo(P.X(0), P.Y(y1)); }
    ctx.stroke();
    if (labels) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const yAxis = y0 <= 0 && y1 >= 0 ? P.Y(0) + 3 : P.Y(y0) + 3;
      for (let x = Math.ceil(x0 / xs) * xs; x <= x1 + 1e-9; x += xs) if (Math.abs(x) > 1e-9) ctx.fillText(fmtNum(x), P.X(x), yAxis);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const xAxis = x0 <= 0 && x1 >= 0 ? P.X(0) - 4 : P.X(x0) - 4;
      for (let y = Math.ceil(y0 / ys) * ys; y <= y1 + 1e-9; y += ys) if (Math.abs(y) > 1e-9) ctx.fillText(fmtNum(y), xAxis, P.Y(y));
    }
  };
  P.curve = (ctx, f, { color = COLORS.a, width = 2, from = x0, to = x1, n = 400, dash = null } = {}) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false;
    for (let k = 0; k <= n; k++) {
      const x = from + ((to - from) * k) / n;
      const y = f(x);
      if (!isFinite(y) || Math.abs(y) > 1e6) { pen = false; continue; }
      const py = P.Y(y);
      if (pen) ctx.lineTo(P.X(x), py); else ctx.moveTo(P.X(x), py);
      pen = true;
    }
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  };
  P.param = (ctx, fx, fy, t0, t1, { color = COLORS.a, width = 2, n = 400 } = {}) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const t = t0 + ((t1 - t0) * k) / n;
      const x = P.X(fx(t)), y = P.Y(fy(t));
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  };
  P.dot = (ctx, x, y, { r = 4.5, color = COLORS.white, ring = null } = {}) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), r, 0, Math.PI * 2); ctx.fill();
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), r + 3, 0, Math.PI * 2); ctx.stroke(); }
  };
  P.line = (ctx, ax, ay, bx, by, { color = COLORS.white, width = 1.5, dash = null } = {}) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(P.X(ax), P.Y(ay)); ctx.lineTo(P.X(bx), P.Y(by)); ctx.stroke();
    if (dash) ctx.setLineDash([]);
  };
  P.text = (ctx, s, x, y, { color = COLORS.text, align = 'left', base = 'middle', size = 12, dx = 0, dy = 0 } = {}) => {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillText(s, P.X(x) + dx, P.Y(y) + dy);
  };
  fit();
  S.onResize(fit);
  return P;
}

export function arrow(ctx, x1, y1, x2, y2, { color = COLORS.white, width = 2, head = 9 } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.4) * head, y2 - Math.sin(a - 0.4) * head);
  ctx.lineTo(x2 - Math.cos(a + 0.4) * head, y2 - Math.sin(a + 0.4) * head);
  ctx.closePath(); ctx.fill();
}

export function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
export function fmtNum(v, d = 2) {
  if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(1);
  return String(+v.toFixed(d));
}
export function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const TAU = Math.PI * 2;
