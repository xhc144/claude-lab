// One-dimensional maps x ↦ f_r(x): period doubling, chaos, Lyapunov exponents and the Feigenbaum
// constants.
//
// Feigenbaum: for the logistic map the parameter r_n at which x = ½ lies on a cycle of period 2ⁿ
// ("superstable") is found by Newton's method on G(r) = f_r^{2ⁿ}(½) − ½, with dG/dr carried along
// the iteration. The gaps shrink geometrically, δ_n = (r_{n−1} − r_{n−2})/(r_n − r_{n−1}) → δ =
// 4.6692016…, and the cycle's width near ½ shrinks by α = −2.5029… per doubling. Doubles run out of
// digits around n = 12 (the r_n agree to 10⁻¹⁰); double-double arithmetic (~32 digits) goes deeper.

import * as DD from './dd.js';

export const MAPS = {
  logistic: {
    label: '逻辑斯蒂', formula: 'x ↦ r·x(1 − x)', view: [2.5, 4], range: [0, 4],
    f: (r, x) => r * x * (1 - x), df: (r, x) => r * (1 - 2 * x),
  },
  sine: {
    label: '正弦', formula: 'x ↦ (r/4)·sin πx', view: [2.5, 4], range: [0, 4],
    f: (r, x) => (r / 4) * Math.sin(Math.PI * x), df: (r, x) => (r / 4) * Math.PI * Math.cos(Math.PI * x),
  },
  tent: {
    label: '帐篷', formula: 'x ↦ (r/2)·min(x, 1 − x)', view: [1.5, 4], range: [0, 4],
    f: (r, x) => (r / 2) * Math.min(x, 1 - x), df: (r, x) => (x < 0.5 ? r / 2 : -r / 2),
  },
};

/** x₀, x₁, …, x_n. */
export function iterate(f, r, x0, n) {
  const out = [x0];
  let x = x0;
  for (let k = 0; k < n; k++) { x = f(r, x); out.push(x); }
  return out;
}

/** Period of the attracting cycle (1 … maxP) after a transient, or 0 (chaotic / not found). */
export function detectPeriod(f, r, x0 = 0.3, { transient = 4000, maxP = 128, tol = 1e-9 } = {}) {
  let x = x0;
  for (let k = 0; k < transient; k++) x = f(r, x);
  const x1 = x;
  for (let p = 1; p <= maxP; p++) {
    x = f(r, x);
    if (Math.abs(x - x1) < tol) return p;
  }
  return 0;
}

/** Lyapunov exponent λ = mean of ln|f′(x_k)|; λ > 0 means chaos. */
export function lyapunov(f, df, r, x0 = 0.3, { transient = 500, n = 4000 } = {}) {
  let x = x0;
  for (let k = 0; k < transient; k++) x = f(r, x);
  let sum = 0;
  for (let k = 0; k < n; k++) {
    sum += Math.log(Math.max(1e-300, Math.abs(df(r, x))));
    x = f(r, x);
  }
  return sum / n;
}

/**
 * Histogram of the long-run orbit for one parameter value: `samples` iterates after `transient`,
 * binned into `rows` bins over [y0, y1] (row 0 at the top). Adds into out (Float32Array).
 */
export function bifurcationColumn(f, r, x0, transient, samples, y0, y1, rows, out, offset = 0, stride = 1) {
  let x = x0;
  for (let k = 0; k < transient; k++) x = f(r, x);
  const k1 = rows / (y1 - y0);
  for (let k = 0; k < samples; k++) {
    x = f(r, x);
    const row = Math.floor((y1 - x) * k1);
    if (row >= 0 && row < rows) out[offset + row * stride] += 1;
  }
  return x;
}

// ---------------------------------------------------------------------------------------------
// Feigenbaum constants

/** Superstable parameter near guess for period 2ⁿ, in doubles: Newton on f^{2ⁿ}(½) − ½. */
function superstable(n, guess) {
  let r = guess;
  const P = 2 ** n;
  for (let it = 0; it < 40; it++) {
    let x = 0.5, d = 0;
    for (let k = 0; k < P; k++) {
      d = x * (1 - x) + r * (1 - 2 * x) * d;
      x = r * x * (1 - x);
    }
    const step = (x - 0.5) / d;
    r -= step;
    if (Math.abs(step) < 1e-16 * r) break;
  }
  return r;
}

/** The same in double-double arithmetic: r as [hi, lo]. */
function superstableDD(n, guess) {
  let r = guess;
  const P = 2 ** n;
  const HALF = DD.dd(0.5), ONE = DD.dd(1);
  for (let it = 0; it < 40; it++) {
    let x = HALF, d = DD.dd(0);
    for (let k = 0; k < P; k++) {
      const t = DD.mul(x, DD.sub(ONE, x)); // x(1 − x)
      d = DD.add(t, DD.mul(DD.mul(r, DD.sub(ONE, DD.mulNum(x, 2))), d));
      x = DD.mul(r, t);
    }
    const step = DD.div(DD.sub(x, HALF), d);
    r = DD.sub(r, step);
    if (Math.abs(step[0]) < 1e-31 * r[0]) break;
  }
  return r;
}

/** The point of the 2ⁿ-cycle half a period after ½ (its distance to ½ is d_n). */
function halfway(n, r) {
  let x = 0.5;
  for (let k = 0; k < 2 ** (n - 1); k++) x = r * x * (1 - x);
  return x - 0.5;
}

/**
 * Superstable parameters r_0 … r_levels and the constant estimates. With dd = true the r_n are
 * double-double pairs [hi, lo] and δ_n is computed in double-double.
 * Returns [{ n, r, delta, alpha }] (r: number or [hi, lo]; delta/alpha: numbers or null).
 */
export function feigenbaum(levels, { dd = false } = {}) {
  const rows = [];
  const R = [];
  for (let n = 0; n <= levels; n++) {
    let r;
    if (n === 0) r = dd ? DD.dd(2) : 2;
    else if (n === 1) r = dd ? DD.add(DD.dd(1), DD.sqrt(DD.dd(5))) : 1 + Math.sqrt(5);
    else {
      // extrapolate the next gap with the latest δ estimate
      const est = rows[n - 1].delta || 4.67;
      if (dd) {
        const gap = DD.sub(R[n - 1], R[n - 2]);
        r = superstableDD(n, DD.add(R[n - 1], [gap[0] / est, 0]));
      } else {
        r = superstable(n, R[n - 1] + (R[n - 1] - R[n - 2]) / est);
      }
    }
    R.push(r);
    let delta = null;
    if (n >= 2) {
      delta = dd ? DD.toNumber(DD.div(DD.sub(R[n - 1], R[n - 2]), DD.sub(R[n], R[n - 1]))) : (R[n - 1] - R[n - 2]) / (R[n] - R[n - 1]);
    }
    rows.push({ n, r, delta, d: n >= 1 ? halfway(n, dd ? DD.toNumber(r) : r) : null, alpha: null });
  }
  for (let n = 1; n < rows.length - 1; n++) rows[n].alpha = rows[n].d / rows[n + 1].d;
  return rows;
}

/** Aitken's Δ² acceleration of the last three terms of a sequence. */
export function aitken(a, b, c) {
  const den = c - 2 * b + a;
  return den === 0 ? c : c - ((c - b) * (c - b)) / den;
}

export const FEIGENBAUM_DELTA = '4.669201609102990671853203820466';
export const FEIGENBAUM_ALPHA = '-2.502907875095892822283902873218';
