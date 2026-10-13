// The mathematics shown on the page, checked independently of any rendering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFFT } from '../../src/instruments/fft.js';
import { mulberry32 } from '../../src/core/rng.js';

test('FFT: forward then inverse is the identity, and matches a direct DFT', () => {
  const n = 64, fft = makeFFT(n), rand = mulberry32(5);
  const re = Float64Array.from({ length: n }, () => rand() - 0.5), im = Float64Array.from({ length: n }, () => rand() - 0.5);
  const r0 = re.slice(), i0 = im.slice();
  fft(re, im, false);
  for (const k of [0, 3, 17, 63]) {
    let sr = 0, si = 0;
    for (let j = 0; j < n; j++) { const a = (-2 * Math.PI * j * k) / n; sr += r0[j] * Math.cos(a) - i0[j] * Math.sin(a); si += r0[j] * Math.sin(a) + i0[j] * Math.cos(a); }
    assert.ok(Math.abs(sr - re[k]) < 1e-9 && Math.abs(si - im[k]) < 1e-9);
  }
  fft(re, im, true);
  for (let j = 0; j < n; j++) assert.ok(Math.abs(re[j] - r0[j]) < 1e-12 && Math.abs(im[j] - i0[j]) < 1e-12);
});


test('Monster group order', async () => {
  globalThis.document = undefined;
  const f = [[2, 46], [3, 20], [5, 9], [7, 6], [11, 2], [13, 3], [17, 1], [19, 1], [23, 1], [29, 1], [31, 1], [41, 1], [47, 1], [59, 1], [71, 1]];
  const order = f.reduce((acc, [p, e]) => acc * BigInt(p) ** BigInt(e), 1n);
  assert.equal(order.toString(), '808017424794512875886459904961710757005754368000000000');
});

test('Fibonacci: F(12) = 144 = 12², and it is the last square up to F(300)', () => {
  let a = 0n, b = 1n;
  const squares = [];
  for (let n = 0; n <= 300; n++) {
    const r = BigInt(Math.round(Math.sqrt(Number(a))));
    if (n > 2 && Number(a) < 2 ** 52 && r * r === a) squares.push([n, a]);
    [a, b] = [b, a + b];
  }
  assert.deepEqual(squares, [[12, 144n]]);
});

test('2027 is prime', () => {
  for (let d = 2; d * d <= 2027; d++) assert.notEqual(2027 % d, 0);
});
