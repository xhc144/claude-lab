// HiDPI canvas layers, a 2D world↔screen viewport, and pointer interaction (pan, zoom, pinch,
// draggable handles, click, hover).

import { h } from './dom.js';

export const DPR_CAP = 2;

export class Layer {
  constructor(parent, { passive = false, cls = '' } = {}) {
    this.canvas = h('canvas', { class: `layer ${passive ? 'passive' : ''} ${cls}`.trim() });
    parent.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
  }

  resize(w, hgt, dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)) {
    this.w = w;
    this.h = hgt;
    this.dpr = dpr;
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(hgt * dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    this.reset();
  }

  /** Clear and restore the CSS-pixel transform. */
  reset() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // canvas state persists across frames: restore everything drawing code may have changed
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}

/** Call cb(width, height) whenever the element's content box changes size. */
export function observeSize(el, cb) {
  let last = '';
  const ro = new ResizeObserver(() => {
    const r = el.getBoundingClientRect();
    const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
    if (key === last || r.width < 2 || r.height < 2) return;
    last = key;
    cb(r.width, r.height);
  });
  ro.observe(el);
  return () => ro.disconnect();
}

/** Uniform-scale 2D view: world (x right, y up) ↔ CSS pixels (x right, y down). */
export class Viewport {
  constructor({ cx = 0, cy = 0, scale = 80, minScale = 1e-3, maxScale = 1e7 } = {}) {
    this.cx = cx;
    this.cy = cy;
    this.scale = scale; // pixels per world unit
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.w = 1;
    this.h = 1;
  }

  setSize(w, hgt) { this.w = w; this.h = hgt; }
  sx(x) { return this.w / 2 + (x - this.cx) * this.scale; }
  sy(y) { return this.h / 2 - (y - this.cy) * this.scale; }
  wx(px) { return this.cx + (px - this.w / 2) / this.scale; }
  wy(py) { return this.cy - (py - this.h / 2) / this.scale; }
  toScreen(x, y) { return [this.sx(x), this.sy(y)]; }
  toWorld(px, py) { return [this.wx(px), this.wy(py)]; }

  get bounds() {
    return { xmin: this.wx(0), xmax: this.wx(this.w), ymin: this.wy(this.h), ymax: this.wy(0) };
  }

  zoomAt(px, py, factor) {
    const [x, y] = this.toWorld(px, py);
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    // keep the world point under the cursor fixed
    this.cx = x - (px - this.w / 2) / this.scale;
    this.cy = y + (py - this.h / 2) / this.scale;
  }

  panPx(dx, dy) {
    this.cx -= dx / this.scale;
    this.cy += dy / this.scale;
  }

  /** Show the world rectangle with a relative padding. */
  fit(xmin, xmax, ymin, ymax, pad = 0.08) {
    const w = Math.max(1e-9, xmax - xmin), hh = Math.max(1e-9, ymax - ymin);
    this.cx = (xmin + xmax) / 2;
    this.cy = (ymin + ymax) / 2;
    this.scale = Math.min(this.w / (w * (1 + 2 * pad)), this.h / (hh * (1 + 2 * pad)));
  }

  /** Fit so that a disc of the given radius around (cx, cy) is visible. */
  fitRadius(r, cx = 0, cy = 0, pad = 0.06) {
    this.fit(cx - r, cx + r, cy - r, cy + r, pad);
  }

  state() { return { cx: this.cx, cy: this.cy, scale: this.scale }; }
  setState(s) { Object.assign(this, s); }
}

/**
 * Pointer interaction on `el` for viewport `vp`.
 *  hitTest(px, py)       -> handle or null (handles are dragged instead of panning)
 *  onDragStart(handle, wx, wy, e), onDrag(handle, wx, wy, e), onDragEnd(handle)
 *  onClick(wx, wy, e)    click without movement on empty space
 *  onHover(px, py, wx, wy, handle) / onLeave()
 *  onView()              after pan / zoom
 *  cursor(handle)        CSS cursor for hover
 */
export function attachPointer(el, vp, opts = {}) {
  const pointers = new Map();
  let mode = 'idle'; // idle | pending | pan | drag | pinch
  let handle = null;
  let start = null;
  let pinch = null;
  const pan = opts.pan !== false;

  const local = (e) => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function down(e) {
    if (e.button !== undefined && e.button > 1) return;
    el.setPointerCapture?.(e.pointerId);
    const [px, py] = local(e);
    pointers.set(e.pointerId, [px, py]);
    if (pointers.size === 2) {
      if (mode === 'drag') opts.onDragEnd?.(handle);
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
      mode = 'pinch';
      return;
    }
    if (pointers.size > 2) return;
    const hit = opts.hitTest?.(px, py, e) ?? null;
    start = { px, py, t: performance.now() };
    if (hit) {
      handle = hit;
      mode = 'drag';
      el.style.cursor = 'grabbing';
      opts.onDragStart?.(handle, vp.wx(px), vp.wy(py), e);
    } else {
      mode = 'pending';
    }
    e.preventDefault();
  }

  function move(e) {
    const [px, py] = local(e);
    if (!pointers.has(e.pointerId)) {
      if (mode === 'idle') {
        const hit = opts.hitTest?.(px, py, e) ?? null;
        el.style.cursor = hit ? (opts.cursor?.(hit) || 'grab') : (opts.idleCursor || (pan ? 'crosshair' : 'default'));
        opts.onHover?.(px, py, vp.wx(px), vp.wy(py), hit);
      }
      return;
    }
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [px, py]);
    if (mode === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (pan) vp.panPx(mx - pinch.mx, my - pinch.my);
      if (pinch.d > 0 && opts.zoom !== false) vp.zoomAt(mx, my, d / pinch.d);
      pinch = { d, mx, my };
      opts.onView?.();
      return;
    }
    if (mode === 'drag') {
      opts.onDrag?.(handle, vp.wx(px), vp.wy(py), e);
      return;
    }
    if (mode === 'pending' && Math.hypot(px - start.px, py - start.py) > 4) {
      mode = pan ? 'pan' : 'idle-press';
      if (pan) el.style.cursor = 'grabbing';
    }
    if (mode === 'pan') {
      vp.panPx(px - prev[0], py - prev[1]);
      opts.onView?.();
    }
  }

  function up(e) {
    if (!pointers.has(e.pointerId)) return;
    const [px, py] = local(e);
    pointers.delete(e.pointerId);
    if (mode === 'pinch') {
      if (pointers.size === 0) mode = 'idle';
      else mode = 'pinch-rest';
      return;
    }
    if (mode === 'pinch-rest') { if (pointers.size === 0) mode = 'idle'; return; }
    if (mode === 'drag') opts.onDragEnd?.(handle);
    else if (mode === 'pending') opts.onClick?.(vp.wx(px), vp.wy(py), e, px, py);
    mode = 'idle';
    handle = null;
    const hit = opts.hitTest?.(px, py, e) ?? null;
    el.style.cursor = hit ? (opts.cursor?.(hit) || 'grab') : (opts.idleCursor || (pan ? 'crosshair' : 'default'));
  }

  function wheel(e) {
    if (opts.zoom === false) return;
    e.preventDefault();
    const [px, py] = local(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    vp.zoomAt(px, py, Math.exp(-dy * 0.0015));
    opts.onView?.();
  }

  function leave() { if (mode === 'idle') opts.onLeave?.(); }

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('wheel', wheel, { passive: false });
  el.style.cursor = opts.idleCursor || (pan ? 'crosshair' : 'default');
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('pointerleave', leave);
    el.removeEventListener('wheel', wheel);
  };
}

/** requestAnimationFrame loop helper: loop.start(), loop.stop(), loop.running. */
export function animationLoop(frame) {
  let id = 0;
  let last = 0;
  const loop = {
    running: false,
    start() {
      if (loop.running) return;
      loop.running = true;
      last = performance.now();
      const tick = (now) => {
        if (!loop.running) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        frame(dt, now);
        if (loop.running) id = requestAnimationFrame(tick);
      };
      id = requestAnimationFrame(tick);
    },
    stop() {
      loop.running = false;
      cancelAnimationFrame(id);
    },
  };
  return loop;
}
