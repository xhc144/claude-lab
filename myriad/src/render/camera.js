// Camera: world position (in cells) of the screen centre and zoom in screen pixels per cell,
// with smooth animated moves for the director mode and "go to" links.

import { clamp } from '../core/util.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0; this.zoom = 4;
    this.vw = 1; this.vh = 1; // viewport size in CSS pixels
    this.minZoom = 1; this.maxZoom = 48;
    this.anim = null;
    this.follow = null; // () => {x, y} | null
  }

  setViewport(w, h) { this.vw = w; this.vh = h; }

  fit(W, H) {
    this.x = W / 2; this.y = H / 2;
    this.zoom = Math.min(this.vw / (W * 1.06), this.vh / (H * 1.12));
    this.minZoom = this.zoom * 0.6;
  }

  toScreen(wx, wy) { return [(wx - this.x) * this.zoom + this.vw / 2, (wy - this.y) * this.zoom + this.vh / 2]; }
  toWorld(sx, sy) { return [(sx - this.vw / 2) / this.zoom + this.x, (sy - this.vh / 2) / this.zoom + this.y]; }

  /** zoom by factor keeping the world point under (sx, sy) fixed */
  zoomAt(factor, sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const [wx2, wy2] = this.toWorld(sx, sy);
    this.x += wx - wx2; this.y += wy - wy2;
    this.anim = null;
  }

  pan(dxScreen, dyScreen) {
    this.x -= dxScreen / this.zoom; this.y -= dyScreen / this.zoom;
    this.anim = null;
    this.follow = null;
  }

  /** animate to (x, y) at zoom z over `dur` seconds */
  flyTo(x, y, z = this.zoom, dur = 1.2) {
    this.anim = { x0: this.x, y0: this.y, z0: this.zoom, x1: x, y1: y, z1: clamp(z, this.minZoom, this.maxZoom), t: 0, dur };
  }

  update(dt, W, H) {
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const u = clamp(a.t / a.dur, 0, 1);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      // zoom out a little in the middle of long flights, like a bird's eye hop
      const d = Math.hypot(a.x1 - a.x0, a.y1 - a.y0);
      const hop = d > 40 ? Math.sin(Math.PI * u) * Math.min(0.45, d / 400) : 0;
      this.x = a.x0 + (a.x1 - a.x0) * e;
      this.y = a.y0 + (a.y1 - a.y0) * e;
      this.zoom = Math.exp(Math.log(a.z0) + (Math.log(a.z1) - Math.log(a.z0)) * e) * (1 - hop);
      if (u >= 1) this.anim = null;
    } else if (this.follow) {
      const p = this.follow();
      if (!p) this.follow = null;
      else { this.x += (p.x - this.x) * Math.min(1, dt * 4); this.y += (p.y - this.y) * Math.min(1, dt * 4); }
    }
    // keep the world in view
    const mx = this.vw / this.zoom / 2, my = this.vh / this.zoom / 2;
    this.x = clamp(this.x, Math.min(W / 2, -W * 0.1 + mx), Math.max(W / 2, W * 1.1 - mx));
    this.y = clamp(this.y, Math.min(H / 2, -H * 0.1 + my), Math.max(H / 2, H * 1.15 - my));
  }
}
