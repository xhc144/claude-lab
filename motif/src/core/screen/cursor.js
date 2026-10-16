// Cursor of a screen recording: the recorded pointer track, a smoothed path for drawing, click
// effects, idle hiding, motion tilt, and the camera-follow path automatic zooms look along.
//
// The cursor spring (240 Hz second-order spring, jitter threshold, clicks pinned exactly to where
// they happened with a smoother-step correction) and the tilt model follow DogSC (MIT,
// © 2026 神烦老狗, github.com/laogou717/dogsc, Sources/RecorderCore/PointerTrack.swift).
//
// Pointer track file (JSON asset):
//   { version: 1, width, height, scale, events: [[t, x, y, k, c?], …] }
//   t seconds into the recording · x, y in 0–1 of the recorded picture
//   k: 0 move · 1 left button down · 2 right button down · 3 button up
//   c: cursor shape at that moment ('arrow' | 'text' | 'hand' | 'wait' | 'cross' | 'resize'), optional

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoother = (v) => { const t = clamp(v, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

export const CURSOR_SPRING = { mass: 2.8, stiffness: 450, damping: 66 };
const RATE = 240;

export function parsePointerTrack(data) {
  if (!data) return { width: 0, height: 0, events: [] };
  const raw = Array.isArray(data) ? data : data.events || [];
  const events = raw.map((e) => (Array.isArray(e) ? { t: +e[0], x: +e[1], y: +e[2], k: +(e[3] || 0), c: e[4] || null } : { t: +e.t, x: +e.x, y: +e.y, k: +(e.k || 0), c: e.c || null }))
    .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.x) && Number.isFinite(e.y))
    .sort((a, b) => a.t - b.t);
  return { width: data.width || 0, height: data.height || 0, scale: data.scale || 1, events };
}

function lowerIndex(arr, t, key = 't') {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m][key] <= t) lo = m + 1; else hi = m; }
  return lo - 1;
}

export class CursorPath {
  /** track: parsePointerTrack() result. smooth: 'smooth' (spring) | 'raw'. */
  constructor(track, { smooth = 'smooth', spring = CURSOR_SPRING } = {}) {
    this.events = track.events || [];
    this.clicks = this.events.filter((e) => e.k === 1 || e.k === 2);
    this.smooth = smooth;
    this.t0 = this.events.length ? this.events[0].t : 0;
    if (smooth === 'smooth' && this.events.length > 1) this.buildSpring(spring);
  }

  buildSpring({ mass, stiffness, damping }) {
    const ev = this.events;
    const first = ev[0];
    const last = ev.at(-1);
    const m = Math.max(mass, 0.01), k = Math.max(stiffness, 0.01), c = Math.max(damping, 0.01);
    const end = last.t + Math.max(0.65, 6 * Math.sqrt(m / k));
    const n = Math.max(2, Math.ceil((end - first.t) * RATE) + 1);
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    let px = first.x, py = first.y, vx = 0, vy = 0;
    let sx = first.x, sy = first.y;
    let j = 1;
    const jitter2 = 0.00035 * 0.00035;
    xs[0] = px; ys[0] = py;
    const dt = 1 / RATE;
    for (let i = 1; i < n; i++) {
      const t = first.t + i * dt;
      while (j < ev.length && ev[j].t <= t) j++;
      const lo = ev[j - 1];
      let tx, ty;
      if (j < ev.length) {
        const hi = ev[j];
        const d = Math.max(hi.t - lo.t, 1e-9);
        // Moves sampled close together are a continuous movement; a long gap is a jump.
        if (hi.t - lo.t < 0.25) { const p = clamp((t - lo.t) / d, 0, 1); tx = lo.x + (hi.x - lo.x) * p; ty = lo.y + (hi.y - lo.y) * p; } else { tx = lo.x; ty = lo.y; }
      } else { tx = last.x; ty = last.y; }
      if ((tx - sx) ** 2 + (ty - sy) ** 2 >= jitter2) { sx = tx; sy = ty; }
      const ax = (k * (sx - px) - c * vx) / m;
      const ay = (k * (sy - py) - c * vy) / m;
      vx += ax * dt; vy += ay * dt;
      px = clamp(px + vx * dt, 0, 1); py = clamp(py + vy * dt, 0, 1);
      xs[i] = px; ys[i] = py;
    }
    // Pin every click to where it really happened, blending the correction in and out.
    const lead = 0.18, trail = 0.18;
    this.clicks.forEach((cl, ci) => {
      const prev = this.clicks[ci - 1]?.t;
      const next = this.clicks[ci + 1]?.t;
      const s0 = Math.max(first.t, cl.t - lead, prev != null ? (prev + cl.t) / 2 : -Infinity);
      const s1 = Math.min(end, cl.t + trail, next != null ? (cl.t + next) / 2 : Infinity);
      const ia = Math.round((cl.t - first.t) * RATE);
      if (ia < 0 || ia >= n) return;
      const cx = cl.x - xs[ia], cy = cl.y - ys[ia];
      const i0 = Math.max(0, Math.ceil((s0 - first.t) * RATE));
      const i1 = Math.min(n - 1, Math.floor((s1 - first.t) * RATE));
      for (let i = i0; i <= i1; i++) {
        const t = first.t + i / RATE;
        const w = t <= cl.t ? smoother((t - s0) / Math.max(cl.t - s0, 1e-9)) : 1 - smoother((t - cl.t) / Math.max(s1 - cl.t, 1e-9));
        xs[i] = clamp(xs[i] + cx * w, 0, 1);
        ys[i] = clamp(ys[i] + cy * w, 0, 1);
      }
      xs[ia] = cl.x; ys[ia] = cl.y;
    });
    this.sx = xs; this.sy = ys; this.end = end;
  }

  /** Raw (recorded) position at t, linearly interpolated. */
  raw(t) {
    const ev = this.events;
    if (!ev.length || t < ev[0].t) return null;
    const i = lowerIndex(ev, t);
    const a = ev[Math.max(0, i)];
    const b = ev[i + 1];
    if (!b || b.t - a.t >= 0.25) return [a.x, a.y];
    const p = (t - a.t) / Math.max(b.t - a.t, 1e-9);
    return [a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p];
  }

  /** Position to draw at t: the spring path, or the raw track. */
  at(t) {
    if (!this.events.length || t < this.t0) return null;
    if (!this.sx) return this.raw(t);
    const f = (t - this.t0) * RATE;
    const i = Math.floor(f);
    if (i >= this.sx.length - 1) return [this.sx.at(-1), this.sy.at(-1)];
    const p = f - i;
    return [this.sx[i] + (this.sx[i + 1] - this.sx[i]) * p, this.sy[i] + (this.sy[i + 1] - this.sy[i]) * p];
  }

  /** Cursor shape recorded at t. */
  shape(t) {
    const i = lowerIndex(this.events, t);
    for (let k = i; k >= 0 && k > i - 400; k--) if (this.events[k].c) return this.events[k].c;
    return 'arrow';
  }

  /** The most recent click within `duration` before t: { progress 0–1, kind, x, y } | null. */
  clickAt(t, duration = 0.5) {
    const i = lowerIndex(this.clicks, t);
    const c = this.clicks[i];
    if (!c || t - c.t > duration) return null;
    return { progress: clamp((t - c.t) / duration, 0, 1), elapsed: t - c.t, kind: c.k === 2 ? 'right' : 'left', x: c.x, y: c.y };
  }

  /** Seconds since the pointer last moved (for "hide when idle"). */
  idleFor(t) {
    const i = lowerIndex(this.events, t);
    if (i < 0) return Infinity;
    let k = i;
    while (k > 0 && Math.abs(this.events[k].x - this.events[k - 1].x) + Math.abs(this.events[k].y - this.events[k - 1].y) < 1e-4 && this.events[k].k === 0) k--;
    return t - this.events[k].t;
  }

  /** Lean of the arrow while it moves (radians), like a pen dragged across paper. */
  tilt(t, strength = 2) {
    const s = clamp(strength, 0, 4);
    if (!s) return 0;
    const w = 0.08;
    const a = this.at(t), b = this.at(t - w), c = this.at(t - 2 * w);
    if (!a || !b || !c) return 0;
    const vx = ((a[0] - b[0]) / w) * 0.62 + ((b[0] - c[0]) / w) * 0.38;
    const vy = ((a[1] - b[1]) / w) * 0.62 + ((b[1] - c[1]) / w) * 0.38;
    const speed = Math.hypot(vx, vy);
    const gain = Math.max(s, 0.25);
    const still = 0.006 / gain;
    if (!(speed > still)) return 0;
    const torque = clamp(((vx - vy) / speed) / Math.SQRT2, -1, 1);
    const r = clamp((speed - still) / (0.18 / gain), 0, 1);
    const resp = r * r * (3 - 2 * r);
    const idle = clamp(1 - this.idleFor(t) / 0.18, 0, 1);
    const deg = -9 * (0.35 + 0.65 * s) * resp * torque * idle;
    return (deg * Math.PI) / 180;
  }
}

/**
 * Where automatic zooms look: a camera that follows the cursor lazily. Inside the visible area's
 * central zone the camera stays put (working in one panel never moves the screen); when the
 * cursor leaves it, the camera glides just far enough to bring it back, on a critically damped
 * spring. Precomputed at 60 Hz over the recording; deterministic for export.
 */
export class FollowPath {
  constructor(path, zooms, { duration, deadzone = 0.55, response = 5.5 } = {}) {
    this.rate = 60;
    const D = Math.max(0, duration ?? (path.events.at(-1)?.t || 0) + 1);
    const n = Math.max(1, Math.ceil(D * this.rate) + 1);
    this.fx = new Float32Array(n);
    this.fy = new Float32Array(n);
    let fx = 0.5, fy = 0.5, vx = 0, vy = 0;
    let wasIn = false;
    const dt = 1 / this.rate;
    const w = response;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const p = path.at(t) || [0.5, 0.5];
      const z = activeAuto(zooms, t);
      if (!z) {
        fx = p[0]; fy = p[1]; vx = 0; vy = 0; wasIn = false;
      } else {
        if (!wasIn) {
          // Enter on the click region the planner chose (it already holds the clicks in view).
          fx = z.focus[0]; fy = z.focus[1]; vx = 0; vy = 0; wasIn = true;
        }
        const half = 0.5 / z.scale;
        const inner = half * deadzone;
        const dx = p[0] - fx, dy = p[1] - fy;
        const gx = Math.abs(dx) > inner ? p[0] - Math.sign(dx) * inner : fx;
        const gy = Math.abs(dy) > inner ? p[1] - Math.sign(dy) * inner : fy;
        // Critically damped spring towards the goal.
        const ax = w * w * (gx - fx) - 2 * w * vx;
        const ay = w * w * (gy - fy) - 2 * w * vy;
        vx += ax * dt; vy += ay * dt;
        fx = clamp(fx + vx * dt, 0, 1); fy = clamp(fy + vy * dt, 0, 1);
      }
      this.fx[i] = fx; this.fy[i] = fy;
    }
  }

  at(t) {
    const f = clamp(t * this.rate, 0, this.fx.length - 1);
    const i = Math.floor(f);
    const j = Math.min(this.fx.length - 1, i + 1);
    const p = f - i;
    return [this.fx[i] + (this.fx[j] - this.fx[i]) * p, this.fy[i] + (this.fy[j] - this.fy[i]) * p];
  }
}

function activeAuto(zooms, t) {
  let hit = null;
  for (const z of zooms) if (z.mode === 'auto' && t >= z.start && t <= z.end + z.exit) hit = z;
  return hit;
}
