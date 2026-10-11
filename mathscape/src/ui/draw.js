// Canvas drawing primitives: coordinate grid with labelled axes, arrows, labels, markers.

import { C, MONO, FONT, alpha } from './theme.js';

const sprites = new Map();
/**
 * Soft radial glow as a cached sprite. Drawing it with drawImage is far cheaper than
 * ctx.shadowBlur, which pushes the whole canvas onto a slow raster path every frame.
 */
export function glow(ctx, x, y, radius, color, strength = 1) {
  let spr = sprites.get(color);
  if (!spr) {
    spr = document.createElement('canvas');
    spr.width = spr.height = 128;
    const g = spr.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, alpha(color, 0.9));
    grd.addColorStop(0.2, alpha(color, 0.45));
    grd.addColorStop(0.5, alpha(color, 0.12));
    grd.addColorStop(1, alpha(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    sprites.set(color, spr);
  }
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * strength;
  ctx.drawImage(spr, x - radius, y - radius, 2 * radius, 2 * radius);
  ctx.globalAlpha = a;
}

const backdrops = new Map();
/**
 * Fill the canvas with a soft radial vignette. The gradient is rendered once per size into an
 * offscreen canvas and blitted afterwards — filling a full-screen gradient every frame is
 * surprisingly expensive on software-rasterised canvases.
 */
export function backdrop(ctx, W, H, inner = '#0f1420', outer = '#090c13', cy = 0.45, dpr = 1) {
  const key = `${W}x${H}|${inner}|${outer}|${cy}|${dpr}`;
  let c = backdrops.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * dpr));
    c.height = Math.max(1, Math.round(H * dpr));
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(c.width * 0.5, c.height * cy, 0, c.width * 0.5, c.height * 0.5, Math.hypot(c.width, c.height) * 0.62);
    grd.addColorStop(0, inner);
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    if (backdrops.size > 24) backdrops.clear();
    backdrops.set(key, c);
  }
  ctx.drawImage(c, 0, 0, W, H);
}

/** A 1-2-5 step in world units giving roughly `target` pixels between major grid lines. */
export function niceStep(scale, target = 90) {
  const raw = target / scale;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const k = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return { step: k * p, minor: (k * p) / (k === 2 ? 4 : 5) };
}

export function tickLabel(v, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  if (Math.abs(v) < step * 1e-6) return '0';
  const s = Math.abs(v) >= 1e5 || Math.abs(v) < 1e-4 ? v.toExponential(1) : v.toFixed(decimals);
  return s.replace('-', '−');
}

/**
 * Background grid for viewport vp.
 * opts: { minor, major, axes, labels, imaginary (label y-axis ticks with i) }
 */
export function drawGrid(ctx, vp, opts = {}) {
  const { minor = true, axes = true, labels = true, imaginary = false, target = 90, alpha = 1 } = opts;
  const { xmin, xmax, ymin, ymax } = vp.bounds;
  const { step, minor: mstep } = niceStep(vp.scale, target);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  const line = (x0, y0, x1, y1) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
  const snap = (v) => Math.round(v) + 0.5;
  if (minor && mstep * vp.scale > 7) {
    ctx.beginPath();
    for (let x = Math.ceil(xmin / mstep) * mstep; x <= xmax; x += mstep) line(snap(vp.sx(x)), 0, snap(vp.sx(x)), vp.h);
    for (let y = Math.ceil(ymin / mstep) * mstep; y <= ymax; y += mstep) line(0, snap(vp.sy(y)), vp.w, snap(vp.sy(y)));
    ctx.strokeStyle = C.gridMinor;
    ctx.stroke();
  }
  ctx.beginPath();
  for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) line(snap(vp.sx(x)), 0, snap(vp.sx(x)), vp.h);
  for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) line(0, snap(vp.sy(y)), vp.w, snap(vp.sy(y)));
  ctx.strokeStyle = C.gridMajor;
  ctx.stroke();

  if (axes) {
    ctx.beginPath();
    if (xmin <= 0 && xmax >= 0) line(snap(vp.sx(0)), 0, snap(vp.sx(0)), vp.h);
    if (ymin <= 0 && ymax >= 0) line(0, snap(vp.sy(0)), vp.w, snap(vp.sy(0)));
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  if (labels) {
    ctx.font = `10.5px ${MONO}`;
    ctx.fillStyle = C.text3;
    // x labels sit under the x-axis (clamped into view)
    const ay = Math.min(vp.h - 16, Math.max(4, vp.sy(0) + 5));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) {
      if (Math.abs(x) < step * 1e-6) continue;
      const px = vp.sx(x);
      if (px < 18 || px > vp.w - 18) continue;
      ctx.fillText(tickLabel(x, step), px, ay);
    }
    const ax = Math.min(vp.w - 6, Math.max(30, vp.sx(0) - 6));
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) {
      if (Math.abs(y) < step * 1e-6) continue;
      const py = vp.sy(y);
      if (py < 12 || py > vp.h - 12) continue;
      let s = tickLabel(y, step);
      if (imaginary) s = s === '1' ? 'i' : s === '−1' ? '−i' : `${s}i`;
      ctx.fillText(s, ax, py);
    }
  }
  ctx.restore();
  return step;
}

/** Arrow from (x0, y0) to (x1, y1) in screen pixels. */
export function arrow(ctx, x0, y0, x1, y1, { color = C.text, width = 2.5, head = 11, halo = 0 } = {}) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len, uy = dy / len;
  const hl = Math.min(head, len * 0.6);
  const hw = hl * 0.55;
  ctx.save();
  if (halo) {
    // soft halo: a wide translucent stroke under the arrow (much cheaper than shadowBlur)
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = color;
    ctx.lineWidth = width + halo;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - ux * hl * 0.8, y1 - uy * hl * 0.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * hl * 0.8, y1 - uy * hl * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hl - uy * hw, y1 - uy * hl + ux * hw);
  ctx.lineTo(x1 - ux * hl * 0.78, y1 - uy * hl * 0.78);
  ctx.lineTo(x1 - ux * hl + uy * hw, y1 - uy * hl - ux * hw);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Text label with a rounded dark background. */
export function label(ctx, text, x, y, { color = C.text, bg = C.labelBg, font = `12px ${FONT}`, align = 'left', baseline = 'middle', pad = 5, border = null } = {}) {
  ctx.save();
  ctx.font = font;
  const m = ctx.measureText(text);
  const w = m.width + 2 * pad;
  const hgt = 18 + (pad - 5) * 2;
  let bx = x;
  if (align === 'center') bx = x - w / 2;
  else if (align === 'right') bx = x - w;
  let by = y - hgt / 2;
  if (baseline === 'top') by = y;
  else if (baseline === 'bottom') by = y - hgt;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, hgt, 6);
    ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke(); }
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + pad, by + hgt / 2 + 0.5);
  ctx.restore();
  return { x: bx, y: by, w, h: hgt };
}

/** Round handle used for draggable points. */
export function handle(ctx, x, y, color, { r = 6.5, active = false } = {}) {
  ctx.save();
  if (active) {
    ctx.beginPath();
    ctx.arc(x, y, r + 7, 0, 2 * Math.PI);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = '#0c1018';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.38, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Stroke a flat [x, y, x, y, …] world-coordinate polyline through the viewport. */
export function polyline(ctx, vp, pts, stride = 2, start = 0, end = pts.length) {
  ctx.beginPath();
  let pen = false;
  for (let k = start; k < end; k += stride) {
    const x = pts[k], y = pts[k + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
    const px = vp.sx(x), py = vp.sy(y);
    if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
  }
}
