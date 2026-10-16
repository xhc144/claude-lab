// Fourier series of closed plane curves: a curve z(t), t ∈ [0, 1), is a sum of rotating circles
//   z(t) = Σ_k c_k e^{2πi k t},   c_k = ∫ z(t) e^{−2πi k t} dt ≈ (1/N) Σ_j z_j e^{−2πi k j/N}.
// Each term is a circle of radius |c_k| turning k times per period; chained tip to tail they
// redraw the curve ("epicycles"). By Parseval, Σ|c_k|² = mean |z|², so the share of that energy
// carried by the terms in use measures how good a truncated series is.

/** N points equally spaced by arc length along the closed polyline pts ([[x, y], …]). */
export function resample(pts, N) {
  const n = pts.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(bx - ax, by - ay);
  }
  const L = cum[n];
  const out = [];
  let seg = 0;
  for (let k = 0; k < N; k++) {
    const s = (k / N) * L;
    while (seg < n - 1 && cum[seg + 1] < s) seg++;
    const len = cum[seg + 1] - cum[seg];
    const u = len > 0 ? (s - cum[seg]) / len : 0;
    const [ax, ay] = pts[seg], [bx, by] = pts[(seg + 1) % n];
    out.push([ax + u * (bx - ax), ay + u * (by - ay)]);
  }
  return out;
}

/** Discrete Fourier coefficients c_k for k = −⌊N/2⌋ … ⌈N/2⌉ − 1: [{ k, re, im, amp, phase }]. */
export function dft(pts) {
  const N = pts.length;
  const out = [];
  const cos = new Float64Array(N), sin = new Float64Array(N);
  for (let j = 0; j < N; j++) { cos[j] = Math.cos((2 * Math.PI * j) / N); sin[j] = Math.sin((2 * Math.PI * j) / N); }
  for (let k = -Math.floor(N / 2); k < Math.ceil(N / 2); k++) {
    let re = 0, im = 0;
    for (let j = 0; j < N; j++) {
      // e^{−2πi k j/N}: the angle index k·j mod N picks the tabulated cos/sin
      const a = (((k * j) % N) + N) % N;
      const [x, y] = pts[j];
      re += x * cos[a] + y * sin[a];
      im += y * cos[a] - x * sin[a];
    }
    re /= N;
    im /= N;
    out.push({ k, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }
  return out;
}

/** Order of the terms: 'amp' = largest circles first, 'freq' = 0, 1, −1, 2, −2, … */
export function sortTerms(coeffs, mode = 'amp') {
  const terms = coeffs.slice();
  if (mode === 'freq') terms.sort((a, b) => Math.abs(a.k) - Math.abs(b.k) || b.k - a.k);
  else terms.sort((a, b) => (a.k === 0 ? -1 : b.k === 0 ? 1 : b.amp - a.amp));
  return terms;
}

/** Point of the series truncated to the first K terms at time t ∈ [0, 1). */
export function evalSeries(terms, K, t) {
  let x = 0, y = 0;
  for (let i = 0; i < Math.min(K, terms.length); i++) {
    const { k, re, im } = terms[i];
    const a = 2 * Math.PI * k * t;
    const c = Math.cos(a), s = Math.sin(a);
    x += re * c - im * s;
    y += re * s + im * c;
  }
  return [x, y];
}

/** Share of Σ|c_k|² (Parseval) carried by the first K terms (the constant term excluded). */
export function energyFraction(terms, K) {
  let all = 0, used = 0;
  terms.forEach((t, i) => {
    if (t.k === 0) return;
    const e = t.amp * t.amp;
    all += e;
    if (i < K) used += e;
  });
  return all > 0 ? used / all : 1;
}

// ---------------------------------------------------------------------------------------------
// Shapes (closed polylines, roughly within [−1, 1]²)

const param = (n, f) => Array.from({ length: n }, (_, i) => f((2 * Math.PI * i) / n));
const scaleTo = (pts, size = 1.8) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const k = size / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return pts.map(([x, y]) => [(x - cx) * k, (y - cy) * k]);
};

export const SHAPES = {
  heart: { label: '心形', pts: () => scaleTo(param(400, (t) => [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)])) },
  star: {
    label: '五角星',
    pts: () => scaleTo(Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 0.382 : 1, a = Math.PI / 2 + (i * Math.PI) / 5;
      return [r * Math.cos(a), r * Math.sin(a)];
    })),
  },
  pi: {
    label: 'π',
    pts: () => scaleTo([[-1.05, 0.62], [-1.05, 0.84], [1.05, 0.84], [1.05, 0.62], [0.58, 0.62], [0.58, -0.5], [0.66, -0.68], [0.86, -0.72], [0.82, -0.9], [0.52, -0.9], [0.36, -0.7], [0.34, 0.62], [-0.34, 0.62], [-0.38, -0.2], [-0.52, -0.66], [-0.66, -0.9], [-0.9, -0.9], [-0.7, -0.62], [-0.6, -0.2], [-0.58, 0.62]]),
  },
  cat: {
    label: '猫',
    pts: () => scaleTo([[0, -0.86], [0.42, -0.8], [0.74, -0.52], [0.9, -0.12], [0.88, 0.3], [0.8, 0.52], [0.92, 1.02], [0.52, 0.74], [0.2, 0.8], [0, 0.8], [-0.2, 0.8], [-0.52, 0.74], [-0.92, 1.02], [-0.8, 0.52], [-0.88, 0.3], [-0.9, -0.12], [-0.74, -0.52], [-0.42, -0.8]]),
  },
  square: { label: '正方形（吉布斯现象）', pts: () => [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]] },
  infinity: { label: '∞', pts: () => scaleTo(param(400, (t) => [Math.cos(t) / (1 + Math.sin(t) ** 2), (Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)]), 1.9) },
  trefoil: { label: '三叶玫瑰', pts: () => scaleTo(param(600, (t) => [Math.cos(3 * t) * Math.cos(t), Math.cos(3 * t) * Math.sin(t)])) },
  note: {
    label: '音符',
    pts: () => scaleTo([...param(60, (t) => [-0.35 + 0.33 * Math.cos(t), -0.62 + 0.24 * Math.sin(t)]).slice(0, 52), [-0.05, -0.55], [-0.05, 0.9], [0.4, 0.62], [0.42, 0.42], [0.06, 0.62], [0.06, -0.62]]),
  },
};
