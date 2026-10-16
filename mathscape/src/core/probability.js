// Probability experiments: exact distributions to compare simulations against, and a small
// seedable random number generator (so simulations are reproducible in tests).

/** mulberry32: a fast 32-bit PRNG returning numbers in [0, 1). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box–Muller). */
export function gaussian(random = Math.random) {
  const u = 1 - random(), v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Binomial probabilities P(K = k), k = 0 … n, computed by the ratio recurrence. */
export function binomialPMF(n, p) {
  const out = new Float64Array(n + 1);
  if (p <= 0) { out[0] = 1; return out; }
  if (p >= 1) { out[n] = 1; return out; }
  // start from the mode and normalise, so huge n neither under- nor overflows
  const mode = Math.floor((n + 1) * p);
  out[mode] = 1;
  for (let k = mode; k < n; k++) out[k + 1] = (out[k] * (n - k) * p) / ((k + 1) * (1 - p));
  for (let k = mode; k > 0; k--) out[k - 1] = (out[k] * k * (1 - p)) / ((n - k + 1) * p);
  const s = out.reduce((a, b) => a + b, 0);
  for (let k = 0; k <= n; k++) out[k] /= s;
  return out;
}

export const normalPDF = (x, mu = 0, sigma = 1) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

/** Distribution of the sum of k fair dice with `sides` faces: index = sum. */
export function diceSum(k, sides = 6) {
  let dist = [1];
  for (let d = 0; d < k; d++) {
    const next = new Array(dist.length + sides).fill(0);
    dist.forEach((p, s) => { for (let f = 1; f <= sides; f++) next[s + f] += p / sides; });
    dist = next;
  }
  return dist;
}

/**
 * One Buffon needle of length ℓ dropped on lines spaced d apart (ℓ ≤ d): centre height y ∈ [0, d)
 * and angle θ; it crosses a line when its half-height ℓ/2·|sin θ| reaches one.
 * P(cross) = 2ℓ/(πd), so π ≈ 2ℓN/(d·crossings).
 */
export function buffonDrop(l, d, random = Math.random) {
  const y = random() * d;
  const theta = random() * Math.PI;
  const half = (l / 2) * Math.sin(theta);
  return { y, theta, cross: y - half <= 0 || y + half >= d };
}

export const buffonPi = (l, d, n, crossings) => (crossings > 0 ? (2 * l * n) / (d * crossings) : NaN);

/** Simple ±1 random walk positions S_0 = 0 … S_n. */
export function walk(n, random = Math.random) {
  const out = new Int32Array(n + 1);
  for (let k = 1; k <= n; k++) out[k] = out[k - 1] + (random() < 0.5 ? -1 : 1);
  return out;
}

/** Sample mean and variance (unbiased). */
export function meanVar(values) {
  let n = 0, m = 0, s = 0;
  for (const v of values) {
    n++;
    const d = v - m;
    m += d / n;
    s += d * (v - m);
  }
  return { mean: m, variance: n > 1 ? s / (n - 1) : 0, n };
}
