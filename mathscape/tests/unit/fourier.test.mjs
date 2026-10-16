import test from 'node:test';
import assert from 'node:assert/strict';
import { resample, dft, sortTerms, evalSeries, energyFraction, SHAPES } from '../../src/core/fourier.js';

test('a circle traced once is a single term c₁', () => {
  const N = 64;
  const pts = Array.from({ length: N }, (_, j) => [2 * Math.cos((2 * Math.PI * j) / N) + 0.5, 2 * Math.sin((2 * Math.PI * j) / N)]);
  const c = dft(pts);
  const one = c.find((t) => t.k === 1), zero = c.find((t) => t.k === 0);
  assert.ok(Math.abs(one.amp - 2) < 1e-12);
  assert.ok(Math.abs(zero.re - 0.5) < 1e-12 && Math.abs(zero.im) < 1e-12);
  for (const t of c) if (t.k !== 0 && t.k !== 1) assert.ok(t.amp < 1e-12, `k=${t.k}`);
  // clockwise circle → k = −1
  const cw = dft(pts.map(([x, y]) => [x, -y]));
  assert.ok(Math.abs(cw.find((t) => t.k === -1).amp - 2) < 1e-12);
});

test('all N terms reproduce the samples exactly; Parseval holds', () => {
  const pts = resample(SHAPES.star.pts(), 128);
  const terms = sortTerms(dft(pts), 'amp');
  for (let j = 0; j < 128; j += 7) {
    const [x, y] = evalSeries(terms, terms.length, j / 128);
    assert.ok(Math.hypot(x - pts[j][0], y - pts[j][1]) < 1e-10, `j=${j}`);
  }
  const mean = pts.reduce((s, [x, y]) => s + x * x + y * y, 0) / pts.length;
  const sum = terms.reduce((s, t) => s + t.amp * t.amp, 0);
  assert.ok(Math.abs(mean - sum) < 1e-12);
  assert.equal(energyFraction(terms, terms.length), 1);
  // more terms never lose energy, and the largest circles come first
  let prev = 0;
  for (const K of [1, 2, 5, 10, 40]) {
    const e = energyFraction(terms, K);
    assert.ok(e >= prev);
    prev = e;
  }
  assert.ok(energyFraction(terms, 12) > 0.9);
});

test('resampling spaces points evenly by arc length', () => {
  const sq = resample([[0, 0], [1, 0], [1, 1], [0, 1]], 40); // perimeter 4 → spacing 0.1
  for (let k = 0; k < 40; k++) {
    const [a, b] = [sq[k], sq[(k + 1) % 40]];
    assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 0.1) < 1e-9 || k % 10 === 9, `k=${k}`);
  }
});

test('frequency order: 0, 1, −1, 2, −2, …; a square shows the Gibbs overshoot', () => {
  const terms = sortTerms(dft(resample(SHAPES.square.pts(), 256)), 'freq');
  assert.deepEqual(terms.slice(0, 5).map((t) => t.k), [0, 1, -1, 2, -2]);
  // truncated series overshoots the straight sides near the corners by about 9 % of the jump
  let maxX = 0;
  for (let t = 0; t < 1; t += 1 / 2048) maxX = Math.max(maxX, evalSeries(terms, 41, t)[0]);
  assert.ok(maxX > 0.9, `max ${maxX}`);
  for (const [id, s] of Object.entries(SHAPES)) assert.ok(s.pts().length >= 4, id);
});
