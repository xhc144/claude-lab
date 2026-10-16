// Arbitrary-precision real arithmetic on BigInt (used by the high-precision mode).
//
// A value is one of
//   exact   { q: true,  n, d }   the rational n/d (BigInt, d > 0, gcd(n, d) = 1)
//   approx  { q: false, m, e }   the decimal m · 10^e, |m| carrying about W significant digits
//
// Every operation takes W, the number of working significant digits. Arithmetic on exact values
// stays exact (+ − × ÷, integer powers, square roots of perfect squares); anything irrational
// (√2, π, sin 1, …) becomes an approximation with W significant digits. Callers ask for a few
// more digits than they print (GUARD), so the printed digits are correct.
//
// Transcendental functions work in fixed point: an integer X standing for X / 10^F. Arguments are
// reduced first (exp: by multiples of ln 2 and halving, ln: by powers of 10 and 2, sin/cos: by
// multiples of π/2, atan: by argument halving) so the Taylor series converge quickly, and F gets
// extra digits whenever cancellation would otherwise eat into the result (ln near 1, sin of a
// tiny argument, …).

export const GUARD = 12;

export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomainError';
  }
}

// ---------------------------------------------------------------------------------------------
// BigInt helpers

const babs = (x) => (x < 0n ? -x : x);

export function gcd(a, b) {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

const P10 = [1n];
/** 10^k as a BigInt (small powers cached). */
export function pow10(k) {
  if (k < 0) throw new RangeError('pow10: negative exponent');
  if (k < 1024) {
    while (P10.length <= k) P10.push(P10[P10.length - 1] * 10n);
    return P10[k];
  }
  return 10n ** BigInt(k);
}

/** Number of decimal digits of |x| (0 for 0). */
export const ndigits = (x) => (x === 0n ? 0 : babs(x).toString().length);

/** round(a / b), halves away from zero. */
function rdiv(a, b) {
  if (b < 0n) { a = -a; b = -b; }
  let q = a / b;
  const r = a - q * b;
  if (2n * babs(r) >= b) q += a < 0n ? -1n : 1n;
  return q;
}

/** floor(a / b) for b > 0. */
function fdiv(a, b) {
  const q = a / b;
  return a < 0n && q * b !== a ? q - 1n : q;
}

/** ⌊√n⌋ for n ≥ 0 (Newton from above). */
export function isqrt(n) {
  if (n < 0n) throw new DomainError('负数不能开平方');
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(16).length * 4 >> 1) + 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** ⌊n^(1/k)⌋ for n ≥ 0, k ≥ 1. */
export function iroot(n, k) {
  if (k === 1) return n;
  if (n < 2n) return n;
  const K = BigInt(k);
  let x = 1n << BigInt(Math.ceil((n.toString(16).length * 4) / k) + 1);
  for (;;) {
    const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
    if (y >= x) return x;
    x = y;
  }
}

// ---------------------------------------------------------------------------------------------
// Values

/** The exact rational n/d in lowest terms. */
export function rat(n, d = 1n) {
  n = BigInt(n);
  d = BigInt(d);
  if (d === 0n) throw new DomainError('除以零');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return g > 1n ? { q: true, n: n / g, d: d / g } : { q: true, n, d };
}

const approx = (m, e) => ({ q: false, m, e });
const ZERO_APPROX = approx(0n, 0);

export const ZERO = rat(0n);
export const ONE = rat(1n);
export const TWO = rat(2n);

export const isExact = (x) => x.q;
export const isZero = (x) => (x.q ? x.n === 0n : x.m === 0n);
export const isInteger = (x) => x.q && x.d === 1n;
export function sign(x) {
  const v = x.q ? x.n : x.m;
  return v > 0n ? 1 : v < 0n ? -1 : 0;
}

/** Round m · 10^e to at most W significant digits. */
function round(m, e, W) {
  if (m === 0n) return ZERO_APPROX;
  const k = ndigits(m) - W;
  if (k > 0) {
    m = rdiv(m, pow10(k));
    e += k;
  }
  return approx(m, e);
}

/** x as an approximation with W significant digits. */
export function toApprox(x, W) {
  if (!x.q) return round(x.m, x.e, W);
  if (x.n === 0n) return ZERO_APPROX;
  const s = W + 1 + ndigits(x.d) - ndigits(x.n);
  const m = s >= 0 ? rdiv(x.n * pow10(s), x.d) : rdiv(x.n, x.d * pow10(-s));
  return round(m, -s, W);
}

/** Decimal exponent of the leading digit (x ≈ d.ddd × 10^mag); −Infinity for 0. */
export function mag(x) {
  if (isZero(x)) return -Infinity;
  const a = toApprox(x, 4);
  return a.e + ndigits(a.m) - 1;
}

/** Exact value of a JavaScript number (every finite double is a dyadic rational). */
export function fromNumber(v) {
  if (!Number.isFinite(v)) throw new DomainError('数值不是有限数');
  if (Number.isInteger(v)) return rat(BigInt(v));
  let k = 0;
  while (!Number.isInteger(v)) { v *= 2; k++; }
  return rat(BigInt(v), 1n << BigInt(k));
}

/** Exact value of a decimal literal such as "12", "0.1", ".5", "1.25e-3". */
export function fromDecimal(str) {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(str).trim());
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) throw new DomainError(`无法识别的数字 “${str}”`);
  const frac = m[3] || '';
  let n = BigInt((m[2] || '0') + frac);
  let d = pow10(frac.length);
  const ex = Number(m[4] || 0);
  if (Math.abs(ex) > 100000) throw new DomainError('指数过大');
  if (ex > 0) n *= pow10(ex);
  else if (ex < 0) d *= pow10(-ex);
  return rat(m[1] === '-' ? -n : n, d);
}

/** Nearest double. */
export function toNumber(x) {
  if (x.q && ndigits(x.n) < 16 && ndigits(x.d) < 16) return Number(x.n) / Number(x.d);
  return Number(toDecimal(x, 20, { ascii: true, sci: true }));
}

// ---------------------------------------------------------------------------------------------
// Arithmetic

export function neg(x) {
  return x.q ? { q: true, n: -x.n, d: x.d } : approx(-x.m, x.e);
}

export function abs(x) {
  return sign(x) < 0 ? neg(x) : x;
}

export function add(x, y, W) {
  if (x.q && y.q) return rat(x.n * y.d + y.n * x.d, x.d * y.d);
  const a = toApprox(x, W);
  const b = toApprox(y, W);
  if (a.m === 0n) return b;
  if (b.m === 0n) return a;
  const ta = a.e + ndigits(a.m);
  const tb = b.e + ndigits(b.m);
  if (ta - tb > W + 2) return a;
  if (tb - ta > W + 2) return b;
  const e = Math.min(a.e, b.e);
  return round(a.m * pow10(a.e - e) + b.m * pow10(b.e - e), e, W);
}

export const sub = (x, y, W) => add(x, neg(y), W);

export function mul(x, y, W) {
  if ((x.q && x.n === 0n) || (y.q && y.n === 0n)) return ZERO;
  if (x.q && y.q) return rat(x.n * y.n, x.d * y.d);
  const a = toApprox(x, W);
  const b = toApprox(y, W);
  return round(a.m * b.m, a.e + b.e, W);
}

export function div(x, y, W) {
  if (isZero(y)) throw new DomainError('除以零');
  if (x.q && x.n === 0n) return ZERO;
  if (x.q && y.q) return rat(x.n * y.d, x.d * y.n);
  const a = toApprox(x, W);
  const b = toApprox(y, W);
  if (a.m === 0n) return a;
  const s = W + 1 + ndigits(b.m) - ndigits(a.m);
  const m = s >= 0 ? rdiv(a.m * pow10(s), b.m) : rdiv(a.m, b.m * pow10(-s));
  return round(m, a.e - b.e - s, W);
}

export const cmp = (x, y, W) => sign(sub(x, y, W));

/** x^k for an integer k (BigInt or number). */
export function powInt(x, k, W) {
  k = BigInt(k);
  if (k < 0n) return div(ONE, powInt(x, -k, W), W);
  if (k === 0n) return ONE;
  // exact while the result stays a manageable size (about 200 000 digits)
  if (x.q && Number(k) * (ndigits(x.n) + ndigits(x.d)) <= 200000) return rat(x.n ** k, x.d ** k);
  const Wk = W + 2 + ndigits(k);
  let r = ONE;
  let b = x;
  while (k > 0n) {
    if (k & 1n) r = mul(r, b, Wk);
    k >>= 1n;
    if (k > 0n) b = mul(b, b, Wk);
  }
  return toApprox(r, W);
}

export function sqrt(x, W) {
  const s = sign(x);
  if (s < 0) throw new DomainError('负数不能开平方');
  if (s === 0) return x;
  if (x.q) {
    const rn = isqrt(x.n);
    const rd = isqrt(x.d);
    if (rn * rn === x.n && rd * rd === x.d) return rat(rn, rd);
  }
  const a = toApprox(x, W + 2);
  let shift = Math.max(0, 2 * W + 4 - ndigits(a.m));
  if ((a.e - shift) % 2 !== 0) shift++;
  return round(isqrt(a.m * pow10(shift)), (a.e - shift) / 2, W);
}

// ---------------------------------------------------------------------------------------------
// Fixed point and constants

/** round(x · 10^F) for F ≥ 0. */
function fixed(x, F) {
  if (x.q) return rdiv(x.n * pow10(F), x.d);
  const k = x.e + F;
  return k >= 0 ? x.m * pow10(k) : rdiv(x.m, pow10(-k));
}

/** atan(1/k) · 10^F. */
function atanInv(k, F) {
  let x = pow10(F) / k;
  const k2 = k * k;
  let sum = x;
  let n = 1n;
  let minus = true;
  while (x !== 0n) {
    x /= k2;
    n += 2n;
    sum += minus ? -(x / n) : x / n;
    minus = !minus;
  }
  return sum;
}

/** atanh(1/k) · 10^F. */
function atanhInv(k, F) {
  let x = pow10(F) / k;
  const k2 = k * k;
  let sum = x;
  let n = 1n;
  while (x !== 0n) {
    x /= k2;
    n += 2n;
    sum += x / n;
  }
  return sum;
}

const CONSTS = { pi: { F: -1, v: 0n }, ln2: { F: -1, v: 0n }, ln10: { F: -1, v: 0n } };
function constant(name, F, compute) {
  const c = CONSTS[name];
  if (c.F < F) {
    const G = F + 10;
    CONSTS[name] = { F: G, v: compute(G) };
  }
  const { F: G, v } = CONSTS[name];
  return G === F ? v : v / pow10(G - F);
}
const PI = (F) => constant('pi', F, (G) => 4n * (4n * atanInv(5n, G) - atanInv(239n, G))); // Machin
const LN2 = (F) => constant('ln2', F, (G) => 2n * atanhInv(3n, G));
const LN10 = (F) => constant('ln10', F, (G) => 3n * LN2(G) + 2n * atanhInv(9n, G)); // 10 = 2³ · 1.25

export const pi = (W) => round(PI(W + 2), -(W + 2), W);

// ---------------------------------------------------------------------------------------------
// Elementary functions

export function exp(x, W) {
  if (isZero(x)) return x.q ? ONE : toApprox(ONE, W);
  if (sign(x) < 0) return div(ONE, exp(neg(x), W + 2), W);
  if (cmp(x, rat(100000n), 8) > 0) throw new DomainError('exp 的参数过大');
  const F = W + 12 + Math.max(0, mag(x) + 1);
  const S = pow10(F);
  const X = fixed(x, F);
  const L = LN2(F);
  const k = rdiv(X, L); // x = k·ln 2 + r, |r| ≤ ln 2 / 2
  const r = (X - k * L) / 4096n; // r / 2¹²
  // u = exp(r) − 1 by Taylor, then (1 + u)² − 1 = 2u + u² twelve times
  let u = r;
  let term = r;
  for (let n = 2n; term !== 0n; n++) {
    term = (term * r) / (S * n);
    u += term;
  }
  for (let i = 0; i < 12; i++) u = 2n * u + (u * u) / S;
  return round((S + u) << k, -F, W);
}

export function ln(x, W) {
  if (sign(x) <= 0) throw new DomainError('对数的参数必须为正');
  if (x.q && x.n === x.d) return ZERO;
  const xm1 = sub(x, ONE, W + 4);
  if (isZero(xm1)) return ZERO_APPROX;
  const F = W + 12 + Math.max(0, -mag(xm1));
  const S = pow10(F);
  const a = toApprox(x, F);
  const k = ndigits(a.m);
  const E = a.e + k - 1; // x = y · 10^E, 1 ≤ y < 10
  const sh = F - k + 1;
  let Y = sh >= 0 ? babs(a.m) * pow10(sh) : rdiv(babs(a.m), pow10(-sh));
  const y = Number(a.m.toString().slice(0, 16)) / 10 ** (Math.min(16, k) - 1);
  const j = Math.round(Math.log2(y)); // y / 2^j ∈ [0.7, 1.42]
  if (j > 0) Y = rdiv(Y, 1n << BigInt(j));
  const z = rdiv((Y - S) * S, Y + S); // ln Y = 2 atanh((Y − 1)/(Y + 1))
  const z2 = (z * z) / S;
  let term = z;
  let sum = z;
  let n = 1n;
  while (term !== 0n) {
    term = (term * z2) / S;
    n += 2n;
    sum += term / n;
  }
  return round(2n * sum + BigInt(j) * LN2(F) + BigInt(E) * LN10(F), -F, W);
}

/** [sin, cos] of x · 10^-F, both scaled by 10^F. */
function sinCosFixed(X, F) {
  const S = pow10(F);
  const half = PI(F) / 2n;
  const k = rdiv(X, half);
  const R = X - k * half; // |R| ≤ π/4
  const R2 = (R * R) / S;
  let s = R;
  let t = R;
  for (let n = 1n; t !== 0n; n += 2n) {
    t = -(t * R2) / (S * (n + 1n) * (n + 2n));
    s += t;
  }
  let c = S;
  t = S;
  for (let n = 0n; t !== 0n; n += 2n) {
    t = -(t * R2) / (S * (n + 1n) * (n + 2n));
    c += t;
  }
  return [[s, c], [c, -s], [-s, -c], [-c, s]][Number(((k % 4n) + 4n) % 4n)];
}

/**
 * Shared driver for functions whose result can be much smaller than their argument (sin near kπ,
 * cos near π/2 + kπ). An exact argument is retried with more digits until the result has W
 * significant digits; for an approximate argument a result below its own uncertainty is
 * reported as (approximately) zero.
 */
function fixedResult(x, W, F0, compute) {
  let F = F0;
  const xm = isZero(x) ? 0 : mag(x);
  for (let attempt = 0; attempt < 4; attempt++) {
    const v = compute(F);
    if (ndigits(v) >= W + 2) return round(v, -F, W);
    if (!x.q) {
      const noise = F + xm - W + 3;
      if (noise > 0 && babs(v) <= pow10(noise)) return ZERO_APPROX;
      if (noise <= 0) return round(v, -F, W);
    }
    F += W + 4 - ndigits(v);
  }
  return round(compute(F), -F, W);
}

function trig(x, W, which) {
  if (isZero(x)) return which === 0 ? x : x.q ? ONE : toApprox(ONE, W);
  const xm = mag(x);
  if (xm > 60) throw new DomainError('三角函数的参数过大');
  const F0 = W + 12 + Math.abs(xm);
  return fixedResult(x, W, F0, (F) => sinCosFixed(fixed(x, F), F)[which]);
}

export const sin = (x, W) => trig(x, W, 0);
export const cos = (x, W) => trig(x, W, 1);
export const tan = (x, W) => div(sin(x, W + 4), cos(x, W + 4), W);

/** atan(X · 10^-F) · 10^F for |X| ≤ 10^F. */
function atanFixed(X, F) {
  const S = pow10(F);
  let k = 0n;
  while (babs(X) * 10n > S && k < 8n) {
    X = rdiv(X * S, S + isqrt(S * S + X * X)); // atan x = 2 atan(x / (1 + √(1 + x²)))
    k++;
  }
  const X2 = (X * X) / S;
  let t = X;
  let sum = X;
  let minus = true;
  for (let n = 1n; t !== 0n; minus = !minus) {
    t = (t * X2) / S;
    n += 2n;
    sum += minus ? -(t / n) : t / n;
  }
  return sum << k;
}

export function atan(x, W) {
  if (isZero(x)) return x;
  const xm = mag(x);
  const F = W + 12 + Math.max(0, -xm);
  if (cmp(abs(x), ONE, W) > 0) {
    const r = PI(F) / 2n - atanFixed(fixed(div(ONE, abs(x), F), F), F);
    return round(sign(x) < 0 ? -r : r, -F, W);
  }
  return round(atanFixed(fixed(x, F), F), -F, W);
}

export function atan2(y, x, W) {
  const sx = sign(x);
  const sy = sign(y);
  if (sx === 0) {
    if (sy === 0) return ZERO;
    const h = div(pi(W + 2), TWO, W);
    return sy > 0 ? h : neg(h);
  }
  const base = atan(div(y, x, W + 4), W + 4);
  if (sx > 0) return toApprox(base, W);
  return add(base, sy < 0 ? neg(pi(W + 4)) : pi(W + 4), W);
}

const extraFor = (x) => (isZero(x) ? 0 : Math.max(0, -mag(x)));

export function asin(x, W) {
  const c = cmp(abs(x), ONE, W + 4);
  if (c > 0) throw new DomainError('asin 的参数必须在 [−1, 1] 内');
  const W2 = W + 4 + extraFor(sub(ONE, abs(x), W + 4));
  return atan2(x, sqrt(mul(sub(ONE, x, W2), add(ONE, x, W2), W2), W2), W);
}

export function acos(x, W) {
  if (cmp(abs(x), ONE, W + 4) > 0) throw new DomainError('acos 的参数必须在 [−1, 1] 内');
  const W2 = W + 4 + extraFor(sub(ONE, abs(x), W + 4));
  return atan2(sqrt(mul(sub(ONE, x, W2), add(ONE, x, W2), W2), W2), x, W);
}

export function sinh(x, W) {
  if (isZero(x)) return x;
  const W2 = W + 4 + extraFor(x);
  const ex = exp(x, W2);
  return div(sub(ex, div(ONE, ex, W2), W2), TWO, W);
}

export function cosh(x, W) {
  const ex = exp(x, W + 4);
  return div(add(ex, div(ONE, ex, W + 4), W + 4), TWO, W);
}

export function tanh(x, W) {
  if (isZero(x)) return x;
  if (cmp(abs(x), rat(1000n), 8) > 0) return toApprox(rat(BigInt(sign(x))), W);
  const W2 = W + 4 + extraFor(x);
  const e2 = exp(mul(TWO, x, W2), W2); // tanh x = (e^{2x} − 1)/(e^{2x} + 1)
  return div(sub(e2, ONE, W2), add(e2, ONE, W2), W);
}

export function asinh(x, W) {
  if (isZero(x)) return x;
  const W2 = W + 4 + extraFor(x);
  const ax = abs(x);
  const r = ln(add(ax, sqrt(add(mul(ax, ax, W2), ONE, W2), W2), W2), W);
  return sign(x) < 0 ? neg(r) : r;
}

export function acosh(x, W) {
  if (cmp(x, ONE, W + 4) < 0) throw new DomainError('acosh 的参数必须 ≥ 1');
  const W2 = W + 4 + extraFor(sub(x, ONE, W + 4));
  return ln(add(x, sqrt(sub(mul(x, x, W2), ONE, W2), W2), W2), W);
}

export function atanh(x, W) {
  if (cmp(abs(x), ONE, W + 4) >= 0) throw new DomainError('atanh 的参数必须在 (−1, 1) 内');
  if (isZero(x)) return x;
  const W2 = W + 4 + extraFor(x) + extraFor(sub(ONE, abs(x), W + 4));
  return div(ln(div(add(ONE, x, W2), sub(ONE, x, W2), W2), W2), TWO, W);
}

/** x^y: exact for rational x and integer y, or when y = p/q and x is a perfect q-th power. */
export function pow(x, y, W) {
  if (isInteger(y)) {
    if (isZero(x)) {
      if (y.n < 0n) throw new DomainError('0 不能取负数次幂');
      return y.n === 0n ? ONE : x;
    }
    if (babs(y.n) > 100000n) {
      const r = exp(mul(y, ln(abs(x), W + 8 + ndigits(y.n)), W + 8), W);
      return sign(x) < 0 && (y.n & 1n) ? neg(r) : r;
    }
    return powInt(x, y.n, W);
  }
  const sx = sign(x);
  if (sx === 0) {
    if (sign(y) > 0) return x;
    throw new DomainError('0 不能取非正数次幂');
  }
  if (y.q && y.d <= 64n) {
    const k = Number(y.d);
    // odd roots of negative rationals are real: (−8)^(1/3) = −2
    if (sx < 0 && y.d % 2n === 0n) throw new DomainError('负数不能取分数次幂');
    if (x.q) {
      const an = babs(x.n);
      const rn = iroot(an, k);
      const rd = iroot(x.d, k);
      if (rn ** y.d === an && rd ** y.d === x.d) return powInt(rat(sx < 0 ? -rn : rn, rd), y.n, W);
    }
    if (sx < 0) {
      const r = exp(mul(y, ln(neg(x), W + 8), W + 8), W);
      return y.n % 2n === 0n ? r : neg(r);
    }
  } else if (sx < 0) {
    throw new DomainError('负数不能取非整数次幂');
  }
  return exp(mul(y, ln(x, W + 8 + Math.max(0, mag(y))), W + 8), W);
}

export function cbrt(x, W) {
  if (isZero(x)) return x;
  return pow(x, rat(1n, 3n), W);
}

export function floor(x) {
  if (x.q) return rat(fdiv(x.n, x.d));
  return rat(fdiv(fixed(x, 6), pow10(6)));
}
export const ceil = (x) => neg(floor(neg(x)));
export const roundInt = (x) => floor(add(x, rat(1n, 2n), 60));

// ---------------------------------------------------------------------------------------------
// Printing

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/**
 * Decimal string with at most P significant digits (trailing zeros dropped).
 *   ascii : '-' and 'e' notation instead of '−' and '×10ⁿ'
 *   sci   : always scientific notation
 *   group : group fraction digits in blocks of this size with thin spaces (display only)
 */
export function toDecimal(x, P, { ascii = false, sci = false, group = 0 } = {}) {
  if (isZero(x)) return '0';
  const a = toApprox(x, P);
  let s = babs(a.m).toString().replace(/0+$/, '');
  const e = a.e + (ndigits(a.m) - s.length); // value = s · 10^e
  const E = e + s.length - 1; // exponent of the leading digit
  const minus = a.m < 0n ? (ascii ? '-' : '−') : '';
  const grp = (frac) => (group > 0 ? frac.replace(new RegExp(`(\\d{${group}})(?=\\d)`, 'g'), '$1 ') : frac);
  if (!sci && E >= -7 && E < Math.max(21, P)) {
    let out;
    if (e >= 0) out = s + '0'.repeat(e);
    else {
      const intLen = s.length + e;
      out = intLen > 0 ? `${s.slice(0, intLen)}.${grp(s.slice(intLen))}` : `0.${grp('0'.repeat(-intLen) + s)}`;
    }
    return minus + out;
  }
  const mant = s.length > 1 ? `${s[0]}.${grp(s.slice(1))}` : s;
  if (ascii) return `${minus}${mant}e${E}`;
  return `${minus}${mant}×10${String(E).split('').map((ch) => SUPERSCRIPT[ch]).join('')}`;
}

/** "n/d" (or "n") with a proper minus sign; exact values only. */
export function ratString(x, { ascii = false } = {}) {
  const s = x.d === 1n ? babs(x.n).toString() : `${babs(x.n)}/${x.d}`;
  return x.n < 0n ? (ascii ? '-' : '−') + s : s;
}

/** Number of decimal digits of the integer part / numerator and denominator (for size checks). */
export function size(x) {
  return x.q ? ndigits(x.n) + ndigits(x.d) : ndigits(x.m);
}

// ---------------------------------------------------------------------------------------------
// Evaluating expression trees (see core/expr.js) to high precision

const FUNCS = {
  sin, cos, tan,
  sec: (x, W) => div(ONE, cos(x, W + 4), W),
  csc: (x, W) => div(ONE, sin(x, W + 4), W),
  cot: (x, W) => div(cos(x, W + 4), sin(x, W + 4), W),
  asin, acos,
  atan: (y, W, x) => (x === undefined ? atan(y, W) : atan2(y, x, W)),
  atan2: (y, W, x) => atan2(y, x, W),
  sinh, cosh, tanh, asinh, acosh, atanh,
  exp, log: ln, ln,
  log10: (x, W) => div(ln(x, W + 4), round(LN10(W + 6), -(W + 6), W + 4), W),
  log2: (x, W) => div(ln(x, W + 4), round(LN2(W + 6), -(W + 6), W + 4), W),
  sqrt, cbrt,
  abs: (x) => abs(x),
  sign: (x) => rat(BigInt(sign(x))),
  floor: (x) => floor(x),
  ceil: (x) => ceil(x),
  round: (x) => roundInt(x),
  mod: (a, W, b) => sub(a, mul(b, floor(div(a, b, W + 4)), W + 4), W),
  min: (a, W, b) => (cmp(a, b, W) <= 0 ? a : b),
  max: (a, W, b) => (cmp(a, b, W) >= 0 ? a : b),
  pow: (a, W, b) => pow(a, b, W),
  hypot: (a, W, b) => sqrt(add(mul(a, a, W + 4), mul(b, b, W + 4), W + 4), W),
};

/** Evaluate a constant real AST with W working digits. Throws DomainError on invalid input. */
export function evaluate(ast, W) {
  switch (ast.type) {
    case 'num': return fromDecimal(ast.raw ?? String(ast.value));
    case 'const':
      if (ast.name === 'pi') return pi(W);
      if (ast.name === 'tau') return mul(TWO, pi(W + 2), W);
      if (ast.name === 'e') return exp(ONE, W);
      throw new DomainError(`未知常数 ${ast.name}`);
    case 'neg': return neg(evaluate(ast.arg, W));
    case 'bin': {
      const W2 = W + 4;
      const l = evaluate(ast.left, W2);
      const r = evaluate(ast.right, W2);
      switch (ast.op) {
        case '+': return add(l, r, W);
        case '-': return sub(l, r, W);
        case '*': return mul(l, r, W);
        case '/': return div(l, r, W);
        case '^': return pow(l, r, W);
        default: throw new DomainError(`未知运算 ${ast.op}`);
      }
    }
    case 'call': {
      const fn = FUNCS[ast.name];
      if (!fn) throw new DomainError(`高精度模式不支持函数 ${ast.name}`);
      const args = ast.args.map((a) => evaluate(a, W + 6));
      return fn(args[0], W, args[1]);
    }
    case 'var': throw new DomainError(`常数表达式中不能有变量 ${ast.name}`);
    default: throw new DomainError('内部错误：未知节点');
  }
}
