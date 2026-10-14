// Easing curves and analytic springs. All functions map normalised progress 0..1 → 0..1(ish).

export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** Damped spring settling to 1. Returns easing over normalised time plus its settle time. */
export function spring({ stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  let f;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const B = (zeta * w0 - velocity) / wd;
    f = (t) => 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + B * Math.sin(wd * t));
  } else {
    const B = w0 - velocity;
    f = (t) => 1 - Math.exp(-w0 * t) * (1 + B * t);
  }
  // settle time: last time |1 - f| > 0.002, scanning 0..10s
  let settle = 0;
  for (let t = 0; t < 10; t += 1 / 240) if (Math.abs(1 - f(t)) > 0.002) settle = t;
  settle = Math.max(settle, 0.05);
  const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : f(p * settle));
  ease.settle = settle;
  return ease;
}

const pow = (k) => (t) => 1 - (1 - t) ** k;
export const EASE = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: pow(2),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: pow(3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: pow(4),
  outQuint: pow(5),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  inBack: (t) => { const c1 = 1.70158; return (c1 + 1) * t ** 3 - c1 * t * t; },
  inOutCirc: (t) => (t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2),
  smooth: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** progress of a window [start, start+dur] at time t */
export const prog = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : clamp01((t - start) / dur));
