// Primes: sieving, spirals, how many primes there are (π(x) against x/ln x, Li(x) and Riemann's
// R(x), the latter two to 40+ digits with BigInt fixed point), the zeros of ζ on the critical line
// (Euler–Maclaurin) and the explicit formula that rebuilds the prime staircase from those zeros.

import { ln as bigLn, rat as bigRat } from './bigreal.js';

// ---------------------------------------------------------------------------------------------
// sieve and factorisation

/** Sieve of Eratosthenes: isPrime[k] = 1 for prime k ≤ n. */
export function sieve(n) {
  const isPrime = new Uint8Array(n + 1).fill(1);
  isPrime[0] = 0;
  if (n >= 1) isPrime[1] = 0;
  for (let p = 2; p * p <= n; p++) {
    if (!isPrime[p]) continue;
    for (let m = p * p; m <= n; m += p) isPrime[m] = 0;
  }
  return isPrime;
}

/** Prime counting function π(k) for every k ≤ n (Uint32Array). */
export function piTable(isPrime) {
  const out = new Uint32Array(isPrime.length);
  let c = 0;
  for (let k = 0; k < isPrime.length; k++) { c += isPrime[k]; out[k] = c; }
  return out;
}

/** Prime factorisation by trial division: [[p, e], …]. */
export function factor(n) {
  const out = [];
  for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
    if (n % p) continue;
    let e = 0;
    while (n % p === 0) { n /= p; e++; }
    out.push([p, e]);
  }
  if (n > 1) out.push([n, 1]);
  return out;
}

export function isPrimeNumber(n) {
  if (n < 2 || !Number.isInteger(n)) return false;
  if (n % 2 === 0) return n === 2;
  for (let p = 3; p * p <= n; p += 2) if (n % p === 0) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// spirals

/** Ulam spiral: the index (1, 2, 3, …) at lattice point (x, y), counter-clockwise from (0, 0) → (1, 0). */
export function ulamIndex(x, y) {
  const k = Math.max(Math.abs(x), Math.abs(y));
  if (k === 0) return 1;
  const m = (2 * k + 1) ** 2;
  if (y === -k) return m - (k - x);
  if (x === -k) return m - 2 * k - (y + k);
  if (y === k) return m - 4 * k - (x + k);
  return m - 6 * k - (k - y);
}

/** Sacks spiral: n at radius √n and angle 2π√n (perfect squares on the positive x axis). */
export const sacks = (n) => { const r = Math.sqrt(n); return [r * Math.cos(2 * Math.PI * r), r * Math.sin(2 * Math.PI * r)]; };

/** Gaussian integer a + bi is a Gaussian prime. */
export function gaussianPrime(a, b, isPrime = isPrimeNumber) {
  a = Math.abs(a); b = Math.abs(b);
  if (a === 0) return isPrime(b) && b % 4 === 3;
  if (b === 0) return isPrime(a) && a % 4 === 3;
  return isPrime(a * a + b * b);
}

// ---------------------------------------------------------------------------------------------
// counting primes

export const PI_POW10 = [
  '1', '4', '25', '168', '1229', '9592', '78498', '664579', '5761455', '50847534', '455052511',
  '4118054813', '37607912018', '346065536839', '3204941750802', '29844570422669', '279238341033925',
  '2623557157654233', '24739954287740860', '234057667276344607', '2220819602560918840',
  '21127269486018731928', '201467286689315906290', '1925320391606803968923',
  '18435599767349200867866', '176846309399143769411680',
].map(BigInt); // π(10^k), k = 0 … 25 (OEIS A006880; 10^0 stands for the empty count, kept as 0 below)
PI_POW10[0] = 0n;

const GAMMA_DIGITS = '57721566490153286060651209008240243104215933593992359880576723488486772677766467';
const pow10n = (k) => 10n ** BigInt(k);

/** ln x as a fixed-point BigInt with F decimals. */
function lnFixed(x, F) {
  const v = bigLn(bigRat(x), F + 10);
  return v.e >= -F ? v.m * pow10n(v.e + F) : v.m / pow10n(-F - v.e);
}

/**
 * Logarithmic integral li(x) = ∫₀ˣ dt / ln t (principal value) for an integer x ≥ 2, as a
 * fixed-point BigInt with F decimals:  li(x) = γ + ln ln x + Σ (ln x)ⁿ / (n · n!)  — all terms
 * positive, so nothing cancels.
 */
export function liFixed(x, F = 40) {
  const S = pow10n(F);
  const L = lnFixed(x, F);
  const lnL = bigLn({ q: false, m: L, e: -F }, F + 10);
  let sum = BigInt(GAMMA_DIGITS.slice(0, F)) + (lnL.e >= -F ? lnL.m * pow10n(lnL.e + F) : lnL.m / pow10n(-F - lnL.e));
  let t = S;
  for (let n = 1n; ; n++) {
    t = (t * L) / (S * n);
    if (t === 0n) break;
    sum += t / n;
  }
  return sum;
}

const zetaCache = new Map();
/**
 * ζ(s) for an integer s ≥ 2 as a fixed-point BigInt with F decimals, by Borwein's accelerated
 * alternating series (error below 3·(3 + √8)^(−n)).
 */
export function zetaFixed(s, F = 40) {
  const key = `${s}|${F}`;
  if (zetaCache.has(key)) return zetaCache.get(key);
  const S = pow10n(F + 5);
  const n = Math.ceil((F + 6) / 0.76); // log10(3 + √8) ≈ 0.766
  // d_k = n Σ_{i ≤ k} (n + i − 1)! 4^i / ((n − i)! (2i)!)
  const d = [];
  let term = 1n; // (n + i − 1)! 4^i / ((n − i)! (2i)!) · (n − 1)!⁻¹ · n! … built up as a ratio
  let acc = 0n;
  const N = BigInt(n);
  // term_i = (n+i−1)! 4^i / ((n−i)! (2i)!); term_0 = (n−1)!/n! = 1/n — scale by n to keep integers
  term = 1n; // n · term_0
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      const I = BigInt(i);
      term = (term * (N + I - 1n) * (N - I + 1n) * 4n) / ((2n * I - 1n) * (2n * I));
    }
    acc += term;
    d.push(acc);
  }
  const dn = d[n];
  let sum = 0n;
  for (let k = 0; k < n; k++) {
    const t = ((d[k] - dn) * S) / BigInt(k + 1) ** BigInt(s);
    sum += k % 2 ? -t : t;
  }
  const p = 1n << BigInt(s - 1);
  const v = (-sum * p) / (dn * (p - 1n)) / pow10n(5);
  zetaCache.set(key, v);
  return v;
}

/** Riemann's R(x) = 1 + Σ_{k ≥ 1} (ln x)^k / (k · k! · ζ(k + 1)) (Gram's series), fixed point with F decimals. */
export function riemannRFixed(x, F = 40) {
  const S = pow10n(F);
  const L = lnFixed(x, F);
  let sum = S;
  let t = S;
  for (let k = 1; ; k++) {
    t = (t * L) / (S * BigInt(k));
    if (t === 0n) break;
    sum += (t * S) / (BigInt(k) * zetaFixed(k + 1, F));
  }
  return sum;
}

/** Round a fixed-point BigInt to the nearest integer. */
export const roundFixed = (v, F = 40) => { const S = pow10n(F); return (v >= 0n ? v + S / 2n : v - S / 2n) / S; };

/** Double-precision versions for plotting. */
export function li(x) {
  if (x <= 1) return x === 1 ? -Infinity : 0;
  const L = Math.log(x);
  let sum = 0.5772156649015329 + Math.log(Math.abs(L)), t = 1;
  for (let n = 1; n < 400; n++) {
    t *= L / n;
    sum += t / n;
    if (Math.abs(t / n) < 1e-17 * Math.abs(sum)) break;
  }
  return sum;
}
const ZETA_D = (() => { const z = [0, Infinity]; for (let s = 2; s < 400; s++) { let v = 0; for (let k = 1; k < 60; k++) v += k ** -s; z.push(s < 12 ? Number(zetaFixed(s, 20)) / 1e20 : v); } return z; })();
export function riemannR(x) {
  if (x <= 0) return 0;
  const L = Math.log(x);
  let sum = 1, t = 1;
  for (let k = 1; k < 398; k++) {
    t *= L / k;
    const term = t / (k * ZETA_D[k + 1]);
    sum += term;
    if (k > L && Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return sum;
}

// ---------------------------------------------------------------------------------------------
// zeros of ζ on the critical line

/** Riemann–Siegel theta function θ(t) (asymptotic series, fine for t ≥ 5). */
export function theta(t) {
  return (t / 2) * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8 + 1 / (48 * t) + 7 / (5760 * t ** 3) + 31 / (80640 * t ** 5);
}

// B_{2j} / (2j)! for the Euler–Maclaurin corrections
const BERN = [[1, 6], [-1, 30], [1, 42], [-1, 30], [5, 66], [-691, 2730], [7, 6], [-3617, 510], [43867, 798], [-174611, 330], [854513, 138], [-236364091, 2730]]
  .map(([a, b], j) => { let f = 1; for (let k = 2; k <= 2 * j + 2; k++) f *= k; return a / b / f; });

/**
 * ζ(½ + it) as [re, im] by Euler–Maclaurin summation with N ≈ t/2 + 10 terms, where the
 * correction terms shrink like (t / 2πN)^{2j} ≤ π^{−2j}: about 12 digits for any t.
 */
export function zetaCritical(t) {
  const N = Math.floor(t / 2) + 10;
  let re = 0, im = 0;
  for (let n = 1; n < N; n++) {
    const a = t * Math.log(n), m = 1 / Math.sqrt(n);
    re += m * Math.cos(a);
    im -= m * Math.sin(a);
  }
  // N^{−s} = N^{−½} e^{−it ln N}
  const lnN = Math.log(N), mN = 1 / Math.sqrt(N);
  const pr = mN * Math.cos(t * lnN), pi_ = -mN * Math.sin(t * lnN);
  // N^{1−s}/(s − 1) = N · N^{−s} / (−½ + it)
  {
    const nr = N * pr, ni = N * pi_, d = 0.25 + t * t;
    re += (nr * -0.5 + ni * t) / d;
    im += (ni * -0.5 - nr * t) / d;
  }
  re += pr / 2;
  im += pi_ / 2;
  // Σ_j B_{2j}/(2j)! · s(s+1)…(s+2j−2) · N^{−s−2j+1}
  let qr = 0.5, qi = t; // the rising product, starting with s
  let wr = pr / N, wi = pi_ / N; // N^{−s−1}
  for (let j = 0; j < BERN.length; j++) {
    const tr = qr * wr - qi * wi, ti = qr * wi + qi * wr;
    re += BERN[j] * tr;
    im += BERN[j] * ti;
    // q ← q (s + 2j + 1)(s + 2j + 2), w ← w / N²
    for (const k of [2 * j + 1, 2 * j + 2]) { const ar = 0.5 + k; const nr = qr * ar - qi * t; qi = qr * t + qi * ar; qr = nr; }
    wr /= N * N;
    wi /= N * N;
  }
  return [re, im];
}

/** Hardy's Z(t) = e^{iθ(t)} ζ(½ + it): real for real t, |Z| = |ζ|, and it changes sign at every simple zero. */
export function hardyZ(t) {
  const [re, im] = zetaCritical(t);
  const th = theta(t);
  return re * Math.cos(th) - im * Math.sin(th);
}

/** The first `count` zeros ½ + iγ of ζ, γ > 0, located by sign changes of Z and refined. */
export function zetaZeros(count) {
  const out = [];
  let t = 10, z = hardyZ(t);
  while (out.length < count) {
    const step = Math.min(0.1, 0.25 / Math.log(t / (2 * Math.PI)));
    const t2 = t + step, z2 = hardyZ(t2);
    if (Math.sign(z2) !== Math.sign(z)) {
      // Illinois-type regula falsi
      let lo = t, hi = t2, flo = z, fhi = z2, side = 0;
      for (let k = 0; k < 60 && hi - lo > 1e-13; k++) {
        const m = (lo * fhi - hi * flo) / (fhi - flo);
        const fm = hardyZ(m);
        if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; if (side === -1) fhi /= 2; side = -1; }
        else { hi = m; fhi = fm; if (side === 1) flo /= 2; side = 1; }
      }
      out.push((lo + hi) / 2);
    }
    t = t2;
    z = z2;
  }
  return out;
}

/** Chebyshev ψ(x) = Σ_{p^k ≤ x} ln p (exact, from a sieve covering x). */
export function chebyshevPsi(x, isPrime) {
  let s = 0;
  for (let p = 2; p <= x; p++) {
    if (!isPrime[p]) continue;
    for (let q = p; q <= x; q *= p) s += Math.log(p);
  }
  return s;
}

/**
 * Riemann–von Mangoldt explicit formula truncated to the first zeros γ₁ … γ_N:
 *   ψ(x) ≈ x − Σ_ρ x^ρ / ρ − ln 2π − ½ ln(1 − x⁻²),
 * each pair ρ, ρ̄ contributing 2√x (½ cos(γ ln x) + γ sin(γ ln x)) / (¼ + γ²).
 */
export function psiExplicit(x, zeros, N = zeros.length) {
  const L = Math.log(x), r = Math.sqrt(x);
  let s = x - Math.log(2 * Math.PI) - 0.5 * Math.log(1 - 1 / (x * x));
  for (let k = 0; k < N; k++) {
    const g = zeros[k];
    s -= (2 * r * (0.5 * Math.cos(g * L) + g * Math.sin(g * L))) / (0.25 + g * g);
  }
  return s;
}
