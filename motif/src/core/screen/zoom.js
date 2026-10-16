// Camera zoom for screen recordings: easing curves, sampling of zoom segments, and the viewport
// transform that keeps the zoomed picture inside the frame.
//
// The model and the maths follow DogSC (MIT, © 2026 神烦老狗, github.com/laogou717/dogsc,
// Sources/RecorderCore/ZoomAnimation.swift), re-implemented in JavaScript:
//   • a zoom segment holds one focus; it eases in for `enter` seconds, holds until `end`,
//     then eases out for `exit` seconds;
//   • touching segments hand off continuously (the next one starts from the previous held view);
//   • scale and travel share one progress value, and the focus is framed towards a safe area so
//     the zoom never pushes the picture off-frame.
// All times here are source times (seconds into the recording).

export const EASINGS = ['linear', 'quad', 'cubic', 'quint', 'spring'];

const CURVES = {
  linear: [0, 0, 1, 1],
  quad: [0.45, 0, 0.55, 1],
  cubic: [0.65, 0, 0.35, 1],
  quint: [0.82, 0, 0.18, 1],
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const num01 = (v) => (Number.isFinite(Number(v)) ? clamp(Number(v), 0, 1) : 0.5);

/** Cubic-bezier easing value (CSS-style control points). */
export function bezier([x1, y1, x2, y2], x) {
  const t0 = clamp(x, 0, 1);
  if (t0 <= 0 || t0 >= 1) return t0;
  const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const dx = (t) => 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
  let t = t0;
  for (let i = 0; i < 7; i++) {
    const err = bx(t) - t0;
    if (Math.abs(err) < 1e-5) return by(t);
    const d = dx(t);
    if (Math.abs(d) < 1e-5) break;
    const n = t - err / d;
    if (n < 0 || n > 1) break;
    t = n;
  }
  let lo = 0, hi = 1;
  t = t0;
  for (let i = 0; i < 20; i++) {
    const x2v = bx(t);
    if (Math.abs(x2v - t0) < 1e-5) break;
    if (x2v < t0) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return by(t);
}

export const SPRING = { mass: 2.4, stiffness: 210, damping: 42 };

/** A damped spring's step response, normalised to reach 1 at the end of the transition. */
export function springProgress(v, { mass = SPRING.mass, stiffness = SPRING.stiffness, damping = SPRING.damping } = {}) {
  const t = clamp(v, 0, 1);
  if (t <= 0 || t >= 1) return t;
  const m = Math.max(mass, 0.01), k = Math.max(stiffness, 0.01), c = Math.max(damping, 0.01);
  const w0 = Math.sqrt(k / m);
  const zeta = Math.min(c / (2 * Math.sqrt(k * m)), 0.9999);
  const wd = w0 * Math.sqrt(Math.max(1 - zeta * zeta, 1e-12));
  const D = 0.72;
  const resp = (s) => 1 - Math.exp(-zeta * w0 * s) * (Math.cos(wd * s) + (zeta * w0 / wd) * Math.sin(wd * s));
  return clamp(resp(t * D) / resp(D), 0, 1);
}

export function ease(name, v, spring) {
  if (name === 'spring') return springProgress(v, spring);
  return bezier(CURVES[name] || CURVES.cubic, v);
}

/** Fill defaults and clamp a zoom segment. Times are source seconds. */
export function normalizeZoom(z = {}) {
  const start = Math.max(0, Number(z.start) || 0);
  const end = Math.max(start + 0.05, Number(z.end) || start + 2);
  const f = Array.isArray(z.focus) ? z.focus : [0.5, 0.5];
  return {
    id: z.id || undefined,
    start, end,
    scale: clamp(Number(z.scale) || 1.6, 1, 6),
    focus: [num01(f[0]), num01(f[1])],
    mode: z.mode === 'manual' ? 'manual' : 'auto',
    easing: EASINGS.includes(z.easing) ? z.easing : 'spring',
    enter: clamp(z.enter ?? 0.7, 0, 5),
    exit: clamp(z.exit ?? 0.7, 0, 5),
  };
}

export function sortZooms(zooms) {
  return (zooms || []).map(normalizeZoom).filter((z) => z.end - z.start > 0.01).sort((a, b) => a.start - b.start);
}

const ADJ = 1 / 120;

/**
 * Camera state at source time t.
 * opts.autoFocus(t) → [x, y] | null : where an automatic segment should look (the cursor).
 * Returns { scale, focus: [x, y], progress (framing 0–1), segment, transition }.
 */
export function sampleZoom(zooms, t, opts = {}) {
  const list = opts.sorted ? zooms : sortZooms(zooms);
  const spring = opts.spring;
  let idx = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    const z = list[i];
    if (t >= z.start && t <= z.end + z.exit) { idx = i; break; }
  }
  if (idx < 0) return { scale: 1, focus: [0.5, 0.5], progress: 0, segment: null };
  const z = list[idx];
  const target = focusOf(z, opts.autoFocus, t);
  const prev = idx > 0 ? list[idx - 1] : null;
  const handoff = prev && Math.abs(prev.end - z.start) <= ADJ ? prev : null;
  const enter = Math.min(handoff && z.enter <= 0.001 ? 0.7 : z.enter, z.end - z.start);
  let p;
  if (enter > 0.001 && t < z.start + enter) p = ease(z.easing, (t - z.start) / enter, spring);
  else if (t <= z.end) p = 1;
  else if (z.exit > 0.001) p = 1 - ease(z.easing, (t - z.end) / z.exit, spring);
  else p = 0;
  if (handoff && t <= z.end) {
    const from = { scale: handoff.scale, focus: focusOf(handoff, opts.autoFocus, z.start) };
    return {
      scale: lerp(from.scale, z.scale, p),
      focus: [lerp(from.focus[0], target[0], p), lerp(from.focus[1], target[1], p)],
      progress: 1, segment: z,
      transition: z.mode === 'manual' ? { from, to: { scale: z.scale, focus: target }, p } : null,
    };
  }
  return { scale: lerp(1, z.scale, p), focus: target, progress: p, segment: z };
}

function focusOf(z, autoFocus, t) {
  if (z.mode === 'auto' && autoFocus) {
    const f = autoFocus(t);
    if (f) return [clamp(f[0], 0, 1), clamp(f[1], 0, 1)];
  }
  return z.focus;
}

/** Inset where a framed focus may sit inside the visible picture (0.30 → middle 40%). */
export const FRAMING_INSET = 0.3;

/**
 * Viewport transform of the source picture for a zoom sample: the source rectangle [0,1]² is
 * scaled by `scale` about its centre and translated by `tx, ty` (in picture units). The focus is
 * eased towards the safe framing area as the zoom progresses, and the result is clamped so the
 * zoomed picture always covers the frame.
 */
export function viewport(sample) {
  const one = (scale, focus, progress) => {
    const s = clamp(scale, 1, 6);
    const lf = [clamp(focus[0], 0, 1), clamp(focus[1], 0, 1)];
    const dest = lf.map((v) => clamp(v, FRAMING_INSET, 1 - FRAMING_INSET));
    const pr = clamp(progress, 0, 1);
    const want = [lerp(lf[0], dest[0], pr), lerp(lf[1], dest[1], pr)];
    const scaled = [0.5 + s * (lf[0] - 0.5), 0.5 + s * (lf[1] - 0.5)];
    let tx = want[0] - scaled[0];
    let ty = want[1] - scaled[1];
    // The scaled picture spans [0.5 - s/2 + t, 0.5 + s/2 + t]; it must cover [0, 1].
    tx = clamp(tx, 1 - 0.5 - s / 2, -0.5 + s / 2);
    ty = clamp(ty, 1 - 0.5 - s / 2, -0.5 + s / 2);
    return { scale: s, tx, ty };
  };
  if (sample.transition) {
    const a = one(sample.transition.from.scale, sample.transition.from.focus, 1);
    const b = one(sample.transition.to.scale, sample.transition.to.focus, 1);
    const p = sample.transition.p;
    return { scale: lerp(a.scale, b.scale, p), tx: lerp(a.tx, b.tx, p), ty: lerp(a.ty, b.ty, p) };
  }
  return one(sample.scale, sample.focus, sample.progress);
}

/** Where a source point lands on the frame (both in 0–1 picture units) under a viewport. */
export function project(vp, x, y) {
  return [0.5 + vp.scale * (x - 0.5) + vp.tx, 0.5 + vp.scale * (y - 0.5) + vp.ty];
}
