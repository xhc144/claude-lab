// 2-D camera: world point (x, y) at the screen centre, zoom k (screen px per world unit).
// Flights use van Wijk & Nuij's "smooth and efficient zooming and panning" path, so a long jump
// zooms out, glides across and zooms back in, like a camera crossing the sky.

import { clamp } from '../core/util.js';

const RHO = Math.SQRT2, RHO2 = 2, RHO4 = 4;

function interpolateZoom(p0, p1) {
  const [ux0, uy0, w0] = p0, [ux1, uy1, w1] = p1;
  const dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
  let S, f;
  if (d2 < 1e-12) {
    S = Math.log(w1 / w0) / RHO;
    f = (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(RHO * t * S)];
  } else {
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + RHO4 * d2) / (2 * w0 * RHO2 * d1);
    const b1 = (w1 * w1 - w0 * w0 - RHO4 * d2) / (2 * w1 * RHO2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / RHO;
    f = (t) => {
      const s = t * S;
      const u = (w0 / (RHO2 * d1)) * (Math.cosh(r0) * Math.tanh(RHO * s + r0) - Math.sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * Math.cosh(r0)) / Math.cosh(RHO * s + r0)];
    };
  }
  f.duration = Math.abs(S) * 1000 * (RHO / Math.SQRT2);
  return f;
}

export class Camera {
  constructor({ minK = 0.03, maxK = 8 } = {}) {
    this.x = 0; this.y = 0; this.k = 0.2;
    this.w = 1; this.h = 1;
    this.minK = minK; this.maxK = maxK;
    this.anim = null;      // flight in progress
    this.zoomTarget = null; // smooth wheel zoom { k, sx, sy }
    this.vx = 0; this.vy = 0; // pan inertia (world units / ms)
    this.moving = false;
  }
  resize(w, h) { this.w = w; this.h = h; }
  toScreen(x, y) { return [(x - this.x) * this.k + this.w / 2, (y - this.y) * this.k + this.h / 2]; }
  toWorld(sx, sy) { return [(sx - this.w / 2) / this.k + this.x, (sy - this.h / 2) / this.k + this.y]; }
  /** world rectangle visible on screen, with a margin in px */
  bounds(margin = 0) {
    const m = margin / this.k;
    return { x0: this.x - this.w / 2 / this.k - m, x1: this.x + this.w / 2 / this.k + m, y0: this.y - this.h / 2 / this.k - m, y1: this.y + this.h / 2 / this.k + m };
  }
  stop() { this.anim = null; this.zoomTarget = null; this.vx = this.vy = 0; }

  flyTo(x, y, k, { duration, onDone, ease = true } = {}) {
    k = clamp(k, this.minK, this.maxK);
    const wScreen = Math.min(this.w, this.h) || 1;
    const f = interpolateZoom([this.x, this.y, wScreen / this.k], [x, y, wScreen / k]);
    const d = duration ?? clamp(f.duration * 0.9, 450, 2600);
    this.zoomTarget = null; this.vx = this.vy = 0;
    this.anim = { f, t0: performance.now(), d, onDone, ease, wScreen };
  }
  /** zoom by a factor around a screen point, smoothed over a few frames */
  zoomAt(sx, sy, factor) {
    this.anim = null;
    const base = this.zoomTarget ? this.zoomTarget.k : this.k;
    this.zoomTarget = { k: clamp(base * factor, this.minK, this.maxK), sx, sy };
  }
  panBy(dxScreen, dyScreen) {
    this.anim = null;
    this.x -= dxScreen / this.k;
    this.y -= dyScreen / this.k;
  }
  fling(vxScreen, vyScreen) { this.vx = -vxScreen / this.k; this.vy = -vyScreen / this.k; }

  /** advance animations; returns true while the camera is moving */
  update(dt, now = performance.now()) {
    let moving = false;
    if (this.anim) {
      const a = this.anim;
      let t = clamp((now - a.t0) / a.d, 0, 1);
      const te = a.ease ? (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) : t;
      const [x, y, w] = a.f(te);
      this.x = x; this.y = y; this.k = a.wScreen / w;
      moving = true;
      if (t >= 1) { this.anim = null; a.onDone?.(); }
    }
    if (this.zoomTarget) {
      const z = this.zoomTarget;
      const [wx, wy] = this.toWorld(z.sx, z.sy);
      const nk = this.k + (z.k - this.k) * Math.min(1, dt * 0.018);
      this.k = Math.abs(z.k - nk) / z.k < 0.002 ? z.k : nk;
      // keep the world point under the cursor fixed
      this.x = wx - (z.sx - this.w / 2) / this.k;
      this.y = wy - (z.sy - this.h / 2) / this.k;
      if (this.k === z.k) this.zoomTarget = null;
      moving = true;
    }
    if (Math.abs(this.vx) + Math.abs(this.vy) > 1e-4) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      const decay = Math.pow(0.992, dt);
      this.vx *= decay; this.vy *= decay;
      if (Math.abs(this.vx) * this.k + Math.abs(this.vy) * this.k < 0.01) this.vx = this.vy = 0;
      moving = true;
    }
    this.moving = moving;
    return moving;
  }
}
