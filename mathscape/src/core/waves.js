// Waves on a membrane: the 2-D wave equation u_tt = c²∇²u (with optional damping) by the explicit
// leapfrog scheme on a grid with spacing 1:
//   u⁺ = 2u − u⁻ + (c·Δt)²·Δu,     Δu = u_E + u_W + u_N + u_S − 4u
// stable for c·Δt ≤ 1/√2 (CFL). Walls are cells held at u = 0; a source adds a forcing term
// A·sin(ωt + φ) to u_tt (spread bilinearly, so it may sit between cells and move); near an absorbing
// edge a sponge layer damps outgoing waves instead of reflecting them. The time-averaged intensity
// ⟨u²⟩ is tracked as an exponential moving average, which turns interference into still fringes.
// Chladni figures: the nodal lines of an (approximate) square-plate mode
//   f(x, y) = cos(nπx)cos(mπy) ∓ cos(mπx)cos(nπy).

export class Wave {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.u = new Float32Array(n);
    this.prev = new Float32Array(n);
    this.next = new Float32Array(n);
    this.speed = new Float32Array(n).fill(1); // local wave speed c (relative)
    this.wall = new Uint8Array(n);
    this.sponge = new Float32Array(n);
    this.I = new Float32Array(n); // ⟨u²⟩
    this.sources = [];
    this.damping = 0;
    this.iRate = 0.01; // intensity averaging rate per step
    this.t = 0;
    this.setAbsorbing(true);
  }

  setAbsorbing(on, width = 18) {
    this.absorbing = on;
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.min(x, y, w - 1 - x, h - 1 - y);
        this.sponge[y * w + x] = on && d < width ? 0.12 * ((width - d) / width) ** 2 : 0;
      }
    }
  }

  clearWaves() { this.u.fill(0); this.prev.fill(0); this.I.fill(0); this.t = 0; }
  clearAll() { this.clearWaves(); this.wall.fill(0); this.speed.fill(1); this.sources = []; }

  /**
   * A water drop: a Gaussian crest of radius r with a shallow trough twice as wide around it, at
   * rest. The two carry equal and opposite volume, so the drop leaves no net bulge behind (a
   * plain bump would, and in two dimensions it drains away only very slowly).
   */
  drop(cx, cy, amp = 1, r = 3) {
    const { w, h } = this;
    const R = Math.ceil(6 * r);
    for (let y = Math.max(1, cy - R); y < Math.min(h - 1, cy + R); y++) {
      for (let x = Math.max(1, cx - R); x < Math.min(w - 1, cx + R); x++) {
        const q = ((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r);
        const v = amp * (Math.exp(-q) - 0.25 * Math.exp(-q / 4));
        const i = y * w + x;
        if (!this.wall[i]) { this.u[i] += v; this.prev[i] += v; }
      }
    }
  }

  step(dt = 0.5) {
    const { w, h, u, prev, next, speed, wall, sponge } = this;
    const g = this.damping;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (wall[i]) { next[i] = 0; continue; }
        const lap = u[i - 1] + u[i + 1] + u[i - w] + u[i + w] - 4 * u[i];
        const c = speed[i] * dt;
        const d = g + sponge[i];
        // in the sponge the velocity is damped and, gently, the displacement too (or a slow
        // bulge left behind by a drop would never drain away)
        next[i] = (2 - d - 0.2 * sponge[i]) * u[i] - (1 - d) * prev[i] + c * c * lap;
      }
    }
    // (the outermost ring is never updated: a fixed, reflecting edge; the sponge in front of it absorbs)
    for (const s of this.sources) {
      const f = dt * dt * s.amp * Math.sin(s.omega * this.t + (s.phase || 0));
      const x0 = Math.floor(s.x), y0 = Math.floor(s.y), fx = s.x - x0, fy = s.y - y0;
      if (x0 < 1 || y0 < 1 || x0 >= w - 2 || y0 >= h - 2) continue;
      const i = y0 * w + x0;
      next[i] += f * (1 - fx) * (1 - fy);
      next[i + 1] += f * fx * (1 - fy);
      next[i + w] += f * (1 - fx) * fy;
      next[i + w + 1] += f * fx * fy;
      if (s.vx) s.x += s.vx * dt;
      if (s.vy) s.y += s.vy * dt;
    }
    this.t += dt;
    const r = this.iRate, I = this.I;
    if (r > 0) for (let i = 0; i < next.length; i++) I[i] += r * (next[i] * next[i] - I[i]);
    this.prev = u;
    this.u = next;
    this.next = prev;
  }

  /** Add a source; `wavelength` (in cells) sets ω = 2πc/λ for the background speed c = 1. */
  addSource(x, y, { wavelength = 16, amp = 1, phase = 0, vx = 0, vy = 0 } = {}) {
    const s = { x, y, amp, phase, vx, vy, omega: (2 * Math.PI) / wavelength };
    this.sources.push(s);
    return s;
  }

  /** Mark cells as wall where pred(x, y) holds (existing waves there are removed). */
  walls(pred, on = 1) {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!pred(x, y)) continue;
        const i = y * w + x;
        this.wall[i] = on;
        if (on) { this.u[i] = 0; this.prev[i] = 0; }
      }
    }
  }

  /** Set the local wave speed where pred(x, y) holds (refractive index n = 1/speed). */
  medium(pred, speed) {
    const { w, h } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pred(x, y)) this.speed[y * w + x] = speed;
  }

  /** Discrete energy: kinetic + potential (constant for the undamped, unforced scheme). */
  energy(dt = 0.5) {
    const { w, h, u, prev, speed } = this;
    let e = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const v = (u[i] - prev[i]) / dt;
        const gx = u[i + 1] - u[i], gy = u[i + w] - u[i];
        const gpx = prev[i + 1] - prev[i], gpy = prev[i + w] - prev[i];
        e += 0.5 * v * v + 0.25 * speed[i] ** 2 * (gx * gx + gy * gy + gpx * gpx + gpy * gpy);
      }
    }
    return e;
  }

  /** Set the membrane to the standing mode sin(mπx/W)·sin(nπy/H), at rest. */
  mode(m, n, amp = 1) {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = amp * Math.sin((m * Math.PI * x) / (w - 1)) * Math.sin((n * Math.PI * y) / (h - 1));
        this.u[y * w + x] = v;
        this.prev[y * w + x] = v;
      }
    }
  }
}

// ---------------------------------------------------------------------------- scene geometry

/** A screen at column x (thickness t) with openings: gaps = [[yCentre, width], …]. */
export const slitWall = (x, t, gaps) => (cx, cy) => cx >= x && cx < x + t && !gaps.some(([c, wd]) => Math.abs(cy - c) < wd / 2);

/** Everything outside the ellipse with centre (cx, cy) and semi-axes a, b. */
export const outsideEllipse = (cx, cy, a, b) => (x, y) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 >= 1;

/**
 * A symmetric biconvex lens: the intersection of two discs of radius R, centred at x0 ± (R − t/2) on
 * the row cy (so its thickness on axis is t). Its thin-lens focal length is f = R / (2(n − 1)).
 */
export function lens(x0, cy, R, t) {
  const d = R - t / 2;
  return (x, y) => (x - (x0 - d)) ** 2 + (y - cy) ** 2 < R * R && (x - (x0 + d)) ** 2 + (y - cy) ** 2 < R * R;
}
export const lensFocal = (R, speed) => R / (2 * (1 / speed - 1));

/** Chladni amplitude at (x, y) ∈ [0, 1]²; sign = −1 or +1 picks the antisymmetric / symmetric mix. */
export const chladni = (x, y, m, n, sign = -1) =>
  Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) + sign * Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
