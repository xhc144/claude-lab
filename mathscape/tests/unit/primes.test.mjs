import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sieve, piTable, factor, ulamIndex, gaussianPrime, PI_POW10, liFixed, riemannRFixed, roundFixed, zetaFixed,
  li, riemannR, hardyZ, zetaZeros, chebyshevPsi, psiExplicit,
} from '../../src/core/primes.js';
import { pi, mul, div, rat } from '../../src/core/bigreal.js';

test('the sieve counts π(10^k) up to 10^7', () => {
  const P = piTable(sieve(1e7));
  for (let k = 1; k <= 7; k++) assert.equal(BigInt(P[10 ** k]), PI_POW10[k]);
  assert.deepEqual(factor(360), [[2, 3], [3, 2], [5, 1]]);
  assert.deepEqual(factor(9999991), [[9999991, 1]]);
});

test('the Ulam spiral numbers the plane once, consecutive numbers side by side', () => {
  const seen = new Map();
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) seen.set(ulamIndex(x, y), [x, y]);
  assert.equal(seen.size, 81);
  for (let n = 1; n <= 81; n++) assert.ok(seen.has(n));
  for (let n = 1; n < 81; n++) {
    const [a, b] = [seen.get(n), seen.get(n + 1)];
    assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1, `step ${n}`);
  }
  assert.deepEqual([seen.get(2), seen.get(3), seen.get(5), seen.get(10)], [[1, 0], [1, 1], [-1, 1], [2, -1]]);
});

test('Gaussian primes', () => {
  assert.ok(gaussianPrime(1, 1)); // norm 2
  assert.ok(gaussianPrime(3, 0) && gaussianPrime(0, 7) && gaussianPrime(2, 1));
  assert.ok(!gaussianPrime(5, 0)); // 5 = (2 + i)(2 − i)
  assert.ok(!gaussianPrime(2, 0) && !gaussianPrime(3, 3));
});

test('ζ(2) = π²/6 and ζ(4) = π⁴/90 to 40 digits', () => {
  const F = 40, S = 10n ** 40n;
  const P = pi(60);
  const want2 = div(mul(P, P, 60), rat(6n), 60), want4 = div(mul(mul(P, P, 60), mul(P, P, 60), 60), rat(90n), 60);
  const fx = (v) => (v.m * 10n ** BigInt(v.e + F + 20)) / 10n ** 20n;
  assert.ok(Math.abs(Number(zetaFixed(2, F) - fx(want2))) < 10);
  assert.ok(Math.abs(Number(zetaFixed(4, F) - fx(want4))) < 10);
});

test('li(10^k) − π(10^k) matches the published differences up to 10^25', () => {
  const DIFF = [null, null, null, 10, 17, 38, 130, 339, 754, 1701, 3104, 11588, 38263, 108971, 314890, 1052619, 3214632, 7956589,
    21949555, 99877775, 222744644, 597394254, 1932355208, 7250186216, 17146907278, 55160980939];
  for (let k = 3; k <= 25; k++) {
    const d = roundFixed(liFixed(10n ** BigInt(k)), 40) - PI_POW10[k];
    assert.ok(d === BigInt(DIFF[k]) || d === BigInt(DIFF[k]) + 1n, `k = ${k}: ${d} vs ${DIFF[k]}`);
  }
  assert.ok(Math.abs(li(1e6) - 78627.5491594622) < 1e-6);
});

test('Riemann R(x) is far closer to π(x) than li(x)', () => {
  // published R(10^k) − π(10^k), rounded
  const RD = { 3: 0, 4: -2, 5: -5, 6: 29, 7: 88, 8: 97, 9: -79 };
  for (const [k, want] of Object.entries(RD)) {
    const d = Number(riemannRFixed(10n ** BigInt(k), 40) / 10n ** 30n) / 1e10 - Number(PI_POW10[k]);
    assert.ok(Math.abs(d - want) < 1.01, `k = ${k}: ${d}`);
  }
  assert.ok(Math.abs(riemannR(1e6) - Number(riemannRFixed(10n ** 6n, 30)) / 1e30) < 1e-7);
});

test('zeros of ζ on the critical line', () => {
  const KNOWN = [14.134725142, 21.022039639, 25.010857580, 30.424876126, 32.935061588, 37.586178159, 40.918719012, 43.327073281, 48.005150881, 49.773832478];
  const z = zetaZeros(30);
  KNOWN.forEach((g, i) => assert.ok(Math.abs(z[i] - g) < 2e-9, `γ${i + 1} = ${z[i]}`));
  assert.equal(z.filter((g) => g < 100).length, 29);
  assert.ok(Math.abs(hardyZ(17.8)) > 0.5); // between zeros
});

test('the explicit formula rebuilds Chebyshev’s ψ(x) from the zeros', () => {
  const isP = sieve(200);
  const zeros = zetaZeros(200);
  for (const x of [20.5, 50.5, 97.5]) {
    const exact = chebyshevPsi(x, isP);
    assert.ok(Math.abs(psiExplicit(x, zeros) - exact) < 0.6, `x = ${x}: ${psiExplicit(x, zeros)} vs ${exact}`);
    assert.ok(Math.abs(psiExplicit(x, zeros, 0) - exact) > Math.abs(psiExplicit(x, zeros) - exact));
  }
});
