import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, gaussian, binomialPMF, normalPDF, diceSum, buffonDrop, buffonPi, walk, meanVar } from '../../src/core/probability.js';

test('binomial probabilities, including large n', () => {
  const b = binomialPMF(4, 0.5);
  assert.deepEqual(Array.from(b), [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16]);
  const big = binomialPMF(2000, 0.3);
  assert.ok(Math.abs(big.reduce((a, c) => a + c, 0) - 1) < 1e-12);
  const mean = big.reduce((a, p, k) => a + p * k, 0);
  assert.ok(Math.abs(mean - 600) < 1e-9);
  // de Moivre–Laplace: close to the normal density near the mean
  assert.ok(Math.abs(big[600] / normalPDF(600, 600, Math.sqrt(2000 * 0.3 * 0.7)) - 1) < 0.01);
});

test('dice sums: exact distribution of two and three dice', () => {
  const two = diceSum(2);
  assert.ok(Math.abs(two[7] - 6 / 36) < 1e-15);
  assert.ok(Math.abs(two[2] - 1 / 36) < 1e-15);
  const three = diceSum(3);
  assert.ok(Math.abs(three[10] - 27 / 216) < 1e-15);
  assert.ok(Math.abs(three.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('simulations agree with theory (seeded)', () => {
  const r = rng(12345);
  // Buffon: π from 200 000 needles within ~1 %
  let cross = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) if (buffonDrop(0.8, 1, r).cross) cross++;
  assert.ok(Math.abs(buffonPi(0.8, 1, N, cross) - Math.PI) < 0.03);
  // Gaussian samples: mean 0, variance 1
  const g = meanVar(Array.from({ length: 50000 }, () => gaussian(r)));
  assert.ok(Math.abs(g.mean) < 0.02 && Math.abs(g.variance - 1) < 0.03);
  // random walk endpoints: E|S_n| ≈ √(2n/π)
  const n = 400;
  let abs = 0;
  for (let i = 0; i < 4000; i++) abs += Math.abs(walk(n, r)[n]);
  assert.ok(Math.abs(abs / 4000 / Math.sqrt((2 * n) / Math.PI) - 1) < 0.05);
  // the generator is reproducible
  const a = rng(7), b = rng(7);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});
