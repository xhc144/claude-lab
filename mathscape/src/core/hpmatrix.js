// High-precision analysis of a real 2×2 matrix [[a, b], [c, d]] whose entries are bigreal values.
//
// With rational entries everything that is algebraic is also given in closed form: the
// characteristic polynomial, the eigenvalues λ = (T ± √Δ)/2 and eigenvectors with the radical
// simplified (√45 = 3√5), singular values σ = (√P ± √Q)/2 where P = (a+d)² + (c−b)²,
// Q = (a−d)² + (b+c)², the condition number and the inverse as fractions. Decimal values carry
// P significant digits; the smaller eigenvalue / singular value is computed as D/λ₁ and |D|/σ₁
// so that no digits are lost to cancellation.

import {
  GUARD, rat, ZERO, ONE, TWO, add, sub, mul, div, neg, abs, sqrt, sign, cmp, isZero, isExact,
  atan2, pi, mag, gcd, isqrt, ratString, toApprox, ndigits,
} from './bigreal.js';

const FOUR = rat(4n);
const babs = (x) => (x < 0n ? -x : x);
const lcm = (a, b) => (a === 0n || b === 0n ? 0n : babs(a / gcd(a, b) * b));
const intStr = (n) => (n < 0n ? `−${-n}` : `${n}`);

let PRIMES = null;
function smallPrimes() {
  if (PRIMES) return PRIMES;
  const N = 3000;
  const sieve = new Uint8Array(N + 1);
  PRIMES = [];
  for (let p = 2; p <= N; p++) {
    if (sieve[p]) continue;
    PRIMES.push(BigInt(p));
    for (let q = p * p; q <= N; q += p) sieve[q] = 1;
  }
  return PRIMES;
}

/** n = s² · r with r as square-free as trial division by small primes can tell (n ≥ 1). */
export function squareFree(n) {
  let s = 1n;
  let r = 1n;
  for (const p of smallPrimes()) {
    if (p * p > n) break;
    let e = 0;
    while (n % p === 0n) { n /= p; e++; }
    if (e) {
      s *= p ** BigInt(e >> 1);
      if (e & 1) r *= p;
    }
  }
  if (n > 1n) {
    const t = isqrt(n);
    if (t * t === n) s *= t;
    else r *= n;
  }
  return [s, r];
}

/** √q = coef · √r for a rational q ≥ 0 (coef rational, r a positive integer). */
export function sqrtRat(q) {
  if (q.n === 0n) return { coef: ZERO, r: 1n };
  const [s, r] = squareFree(q.n * q.d);
  return { coef: rat(s, q.d), r };
}

/** "B√r" or "Bi√r" pieces. */
function surdTerm(B, r, imag) {
  const b = B === 1n ? '' : `${B}`;
  const rad = r === 1n ? '' : `√${r}`;
  if (imag) return `${b}i${rad}`;
  return r === 1n ? `${B}` : `${b}${rad}`;
}

/** (A ± B√r)/C as text, already reduced. */
function pmForm(A, B, r, C, imag) {
  const t = surdTerm(B, r, imag);
  if (A === 0n) return C === 1n ? `±${t}` : `±${t}/${C}`;
  const num = `${intStr(A)} ± ${t}`;
  return C === 1n ? num : `(${num})/${C}`;
}

/** Integers A, B, C > 0 with x + y√r = (A + B√r)/C, divided by their common factor. */
function integerize(x, y) {
  const C = lcm(x.d, y.d);
  let A = x.n * (C / x.d);
  let B = y.n * (C / y.d);
  const g = gcd(gcd(A, B), C) || 1n;
  return [A / g, B / g, C / g];
}

/** Text of a rational for formulas: 3, −1/2. */
const q = (x) => ratString(x);

function polyText(T, D) {
  const coef = (c, s) => {
    if (c.n === 0n) return '';
    const neg_ = c.n < 0n;
    const a = neg_ ? rat(-c.n, c.d) : c;
    const body = s ? (a.n === 1n && a.d === 1n ? s : a.d === 1n ? `${a.n}${s}` : `(${q(a)})${s}`) : q(a);
    return ` ${neg_ ? '−' : '+'} ${body}`;
  };
  return `λ²${coef(neg(T), 'λ')}${coef(D, '')}`;
}

/** Reduce an integer vector and make its first non-zero component positive. */
function normVec(v) {
  const g = v.reduce((acc, x) => gcd(acc, x), 0n) || 1n;
  let w = v.map((x) => x / g);
  const first = w.find((x) => x !== 0n);
  if (first < 0n) w = w.map((x) => -x);
  return w;
}
const vecText = (v) => `(${v.map((x) => (typeof x === 'string' ? x : intStr(x))).join(', ')})`;

/**
 * Full analysis with P printed digits. Values are bigreal numbers; *Form fields are strings
 * (closed forms, only when every entry is rational).
 */
export function analyze(M, P) {
  const W = P + GUARD;
  const W2 = W + 6;
  const { a, b, c, d } = M;
  const exact = [a, b, c, d].every(isExact);
  const T = add(a, d, W2);
  const D = sub(mul(a, d, W2), mul(b, c, W2), W2);
  let disc = sub(mul(T, T, W2), mul(FOUR, D, W2), W2);
  // an approximate discriminant below its own rounding noise is zero
  if (!exact && !isZero(disc)) {
    const scale = Math.max(0, 2 * Math.max(mag(T), mag(D) / 2, mag(a), mag(b), mag(c), mag(d)));
    if (mag(disc) < scale - W + 4) disc = ZERO;
  }
  const ds = sign(disc);
  const out = { exact, P, det: D, trace: T, disc };

  // ---- eigenvalues
  if (ds > 0) {
    const s = sqrt(disc, W2);
    const qv = div(add(T, sign(T) >= 0 ? s : neg(s), W2), TWO, W2); // larger in magnitude
    const other = isZero(qv) ? div(sub(T, s, W2), TWO, W2) : div(D, qv, W2);
    const [l1, l2] = cmp(qv, other, W2) >= 0 ? [qv, other] : [other, qv];
    out.eig = { kind: 'real', values: [l1, l2] };
  } else if (ds === 0) {
    const l = div(T, TWO, W2);
    const z = (x) => isZero(x) || (!exact && mag(x) < mag(l) - W + 4);
    const scalar = z(b) && z(c) && z(sub(a, d, W2));
    out.eig = { kind: 'repeated', values: [l, l], scalar };
  } else {
    const re = div(T, TWO, W2);
    const im = div(sqrt(neg(disc), W2), TWO, W2);
    const modulus = sqrt(D, W2);
    const angle = atan2(im, re, W2);
    out.eig = { kind: 'complex', re, im, modulus, angleDeg: div(mul(angle, rat(180n), W2), pi(W2), W2) };
  }

  // ---- singular values: σ₁ = (√P + √Q)/2, σ₂ = |D|/σ₁
  const Pq = add(mul(add(a, d, W2), add(a, d, W2), W2), mul(sub(c, b, W2), sub(c, b, W2), W2), W2);
  const Qq = add(mul(sub(a, d, W2), sub(a, d, W2), W2), mul(add(b, c, W2), add(b, c, W2), W2), W2);
  const s1 = div(add(sqrt(Pq, W2), sqrt(Qq, W2), W2), TWO, W2);
  const s2 = isZero(s1) ? ZERO : div(abs(D), s1, W2);
  out.sigma = [s1, s2];
  out.kappa = isZero(s2) ? null : div(s1, s2, W2);
  out.inverse = isZero(D) ? null : [div(d, D, W2), div(neg(b), D, W2), div(neg(c), D, W2), div(a, D, W2)];
  out.rank = !isZero(D) ? 2 : [a, b, c, d].some((x) => !isZero(x)) ? 1 : 0;
  if (!exact && out.rank === 2 && mag(s2) < mag(s1) - W + 4) out.rank = 1;

  if (exact) Object.assign(out, closedForms(M, T, D, disc, Pq, Qq));
  return out;
}

function closedForms({ a, b, c, d }, T, D, disc, Pq, Qq) {
  const f = { polyForm: polyText(T, D) };
  const ds = sign(disc);
  const half = (x) => div(x, TWO, 0);

  // eigenvalues (T ± √Δ)/2 and eigenvectors
  if (ds === 0) {
    f.eigForm = `λ = ${q(half(T))}（二重）`;
    if (isZero(b) && isZero(c)) f.vecForm = '任意非零向量';
    else {
      const raw = !isZero(b) ? [mul(TWO, b, 0), sub(d, a, 0)] : [sub(a, d, 0), mul(TWO, c, 0)];
      const L = lcm(raw[0].d, raw[1].d);
      f.vecForm = `${vecText(normVec(raw.map((x) => x.n * (L / x.d))))}（仅一条）`;
    }
  } else {
    const { coef, r } = sqrtRat(ds > 0 ? disc : neg(disc));
    const [A, B, C] = integerize(half(T), half(coef));
    const imag = ds < 0;
    if (!imag && r === 1n) {
      const l1 = rat(A + B, C), l2 = rat(A - B, C);
      f.eigForm = `λ₁ = ${q(l1)}, λ₂ = ${q(l2)}`;
    } else {
      f.eigForm = `λ = ${pmForm(A, B, r, C, imag)}`;
    }
    // v = (2b, d − a ± √Δ), or (a − d ± √Δ, 2c) when b = 0
    if (isZero(b) && isZero(c)) {
      f.vecForm = cmp(a, d, 0) > 0 ? 'v₁ = (1, 0), v₂ = (0, 1)' : 'v₁ = (0, 1), v₂ = (1, 0)';
    } else {
      const useB = !isZero(b);
      const x0 = useB ? mul(TWO, b, 0) : mul(TWO, c, 0);
      const y0 = useB ? sub(d, a, 0) : sub(a, d, 0);
      const L = lcm(lcm(x0.d, y0.d), coef.d);
      let X = x0.n * (L / x0.d), Y = y0.n * (L / y0.d), Z = coef.n * (L / coef.d);
      if (!imag && r === 1n) {
        const v1 = normVec(useB ? [X, Y + Z] : [Y + Z, X]);
        const v2 = normVec(useB ? [X, Y - Z] : [Y - Z, X]);
        f.vecForm = `v₁ = ${vecText(v1)}, v₂ = ${vecText(v2)}`;
      } else {
        const g = gcd(gcd(X, Y), Z) || 1n;
        X /= g; Y /= g; Z /= g;
        if (X < 0n) { X = -X; Y = -Y; } // flip both components; ± absorbs the sign of Z
        const pm = `${Y === 0n ? '±' : `${intStr(Y)} ± `}${surdTerm(babs(Z), r, imag)}`;
        f.vecForm = `v = ${useB ? vecText([X, pm]) : vecText([pm, X])}`;
      }
    }
  }

  // singular values (√P ± √Q)/2
  const sp = sqrtRat(Pq), sq = sqrtRat(Qq);
  const surdHalf = (s1, s2, sgn) => {
    // (s1.coef√r1 + sgn·s2.coef√r2)/2
    if (s1.r === s2.r) {
      const k = half(add(s1.coef, sgn > 0 ? s2.coef : neg(s2.coef), 0));
      const kk = abs(k);
      if (s1.r === 1n) return q(kk);
      const [, B, C] = integerize(ZERO, kk);
      return C === 1n ? surdTerm(B, s1.r, false) : `${surdTerm(B, s1.r, false)}/${C}`;
    }
    const L = lcm(s1.coef.d, s2.coef.d);
    let A1 = s1.coef.n * (L / s1.coef.d), A2 = s2.coef.n * (L / s2.coef.d) * BigInt(sgn);
    const g = gcd(gcd(A1, A2), 2n * L) || 1n;
    A1 /= g; A2 /= g;
    const C = (2n * L) / g;
    if (A1 < 0n || (A1 === 0n && A2 < 0n)) { A1 = -A1; A2 = -A2; }
    const t1 = surdTerm(A1, s1.r, false);
    const t2 = surdTerm(babs(A2), s2.r, false);
    const num = A1 === 0n ? t2 : A2 === 0n ? t1 : `${t1} ${A2 < 0n ? '−' : '+'} ${t2}`;
    return C === 1n ? num : A1 === 0n || A2 === 0n ? `${num}/${C}` : `(${num})/${C}`;
  };
  const geq = cmp(Pq, Qq, 0) >= 0;
  f.sigmaForm = [surdHalf(sp, sq, 1), geq ? surdHalf(sp, sq, -1) : surdHalf(sq, sp, -1)];

  // κ = σ₁/σ₂ = (P + Q + 2√(PQ)) / |P − Q|,  P − Q = 4 det
  if (!isZero(D)) {
    const s = sqrtRat(mul(Pq, Qq, 0));
    const den = abs(mul(FOUR, D, 0));
    const x = div(add(Pq, Qq, 0), den, 0);
    const y = div(mul(TWO, s.coef, 0), den, 0);
    if (s.r === 1n || isZero(y)) f.kappaForm = q(add(x, mul(y, rat(isqrt(s.r)), 0), 0));
    else {
      const [A, B, C] = integerize(x, y);
      const num = `${intStr(A)} + ${surdTerm(B, s.r, false)}`;
      f.kappaForm = C === 1n ? num : `(${num})/${C}`;
    }
    f.inverseForm = [div(d, D, 0), div(neg(b), D, 0), div(neg(c), D, 0), div(a, D, 0)].map(q);
  }
  return f;
}

/**
 * Aⁿ for an integer n (negative powers use the inverse). Exact for rational entries while the
 * result stays below about `maxDigits` digits per entry; otherwise P-digit decimals.
 */
export function matPow(M, n, P, { maxDigits = 120000 } = {}) {
  const W = P + GUARD;
  let { a, b, c, d } = M;
  if (n < 0) {
    const D = sub(mul(a, d, W + 4), mul(b, c, W + 4), W + 4);
    if (isZero(D)) throw new Error('矩阵奇异，没有负数次幂');
    [a, b, c, d] = [div(d, D, W + 4), div(neg(b), D, W + 4), div(neg(c), D, W + 4), div(a, D, W + 4)];
    n = -n;
  }
  const entries = [a, b, c, d];
  if (n === 0) return { entries: [ONE, ZERO, ZERO, ONE], exact: true };
  if (entries.every(isExact)) {
    // A = N/δ with an integer matrix N, so Aⁿ = Nⁿ/δⁿ needs no fractions until the end
    const delta = entries.reduce((acc, x) => lcm(acc, x.d), 1n);
    const N = entries.map((x) => x.n * (delta / x.d));
    const big = N.reduce((acc, x) => (babs(x) > acc ? babs(x) : acc), 1n);
    const est = n * (Math.log10(2) + ndigits(big) + ndigits(delta));
    if (est <= maxDigits) {
      const mm = (X, Y) => [X[0] * Y[0] + X[1] * Y[2], X[0] * Y[1] + X[1] * Y[3], X[2] * Y[0] + X[3] * Y[2], X[2] * Y[1] + X[3] * Y[3]];
      let R = [1n, 0n, 0n, 1n];
      let B = N;
      for (let k = n; k > 0; k = Math.floor(k / 2)) {
        if (k % 2) R = mm(R, B);
        if (k > 1) B = mm(B, B);
      }
      return { entries: R.map((x) => overPower(x, delta, n)), exact: true };
    }
  }
  const Wn = W + 4 + Math.ceil(Math.log10(n + 1));
  const mm = (X, Y) => [
    add(mul(X[0], Y[0], Wn), mul(X[1], Y[2], Wn), Wn), add(mul(X[0], Y[1], Wn), mul(X[1], Y[3], Wn), Wn),
    add(mul(X[2], Y[0], Wn), mul(X[3], Y[2], Wn), Wn), add(mul(X[2], Y[1], Wn), mul(X[3], Y[3], Wn), Wn),
  ];
  let R = [ONE, ZERO, ZERO, ONE];
  let B = entries.map((x) => toApprox(x, Wn));
  for (let k = n; k > 0; k = Math.floor(k / 2)) {
    if (k % 2) R = mm(R, B);
    if (k > 1) B = mm(B, B);
  }
  // entries far below the largest one are rounding noise (e.g. R(30°)¹² = I + 10⁻⁶³)
  const top = Math.max(...R.map(mag));
  return { entries: R.map((x) => (mag(x) < top - W + 3 ? toApprox(ZERO, W) : toApprox(x, W))), exact: false };
}

/** Prime factorisation [[p, e], …] of a modest n > 0, or null when a large factor remains. */
function factor(n) {
  const out = [];
  for (let p = 2n; p * p <= n && p < 1000000n; p += p === 2n ? 1n : 2n) {
    let e = 0;
    while (n % p === 0n) { n /= p; e++; }
    if (e) out.push([p, e]);
  }
  if (n > 1n) {
    if (n >= 1000000000000n) return null;
    out.push([n, 1]);
  }
  return out;
}

/**
 * x / δⁿ in lowest terms. Euclid's algorithm on numbers with tens of thousands of digits is
 * slow, but the denominator's primes are known, so it suffices to divide them out of x.
 */
function overPower(x, delta, n) {
  if (x === 0n || delta === 1n) return rat(x, delta ** BigInt(n));
  const fs = factor(delta);
  if (!fs) return rat(x, delta ** BigInt(n));
  let den = 1n;
  for (const [p, e] of fs) {
    let left = e * n; // powers of p still in the denominator
    // divide out p^k in halving chunks
    for (let k = left; k > 0 && left > 0;) {
      const pk = p ** BigInt(Math.min(k, left));
      if (x % pk === 0n) { x /= pk; left -= Math.min(k, left); } else k = Math.floor(k / 2);
    }
    den *= p ** BigInt(left);
  }
  return { q: true, n: x, d: den };
}

