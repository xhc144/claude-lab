// Rendering math that runs without a DOM: adaptive curve sampling and domain colouring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveCurve, robustBounds } from '../../src/core/curves.js';
import { DomainJob, HUE_LUT, oklch, phaseColor } from '../../src/core/domaincolor.js';
import { complexFunction } from '../../src/core/expr.js';

const seglens = (line) => {
  const d = [];
  for (let k = 2; k < line.length; k += 2) d.push(Math.hypot(line[k] - line[k - 2], line[k + 1] - line[k - 1]));
  return d;
};

test('adaptiveCurve: smooth curve is one polyline refined to the tolerance', () => {
  const lines = adaptiveCurve((s, o) => { o[0] = Math.cos(2 * Math.PI * s); o[1] = Math.sin(2 * Math.PI * s); }, 0, 1, { samples: 8, tol: 0.01 });
  assert.equal(lines.length, 1);
  for (const d of seglens(lines[0])) assert.ok(d <= 0.01 + 1e-12);
  for (let k = 0; k < lines[0].length; k += 2) assert.ok(Math.abs(Math.hypot(lines[0][k], lines[0][k + 1]) - 1) < 1e-12);
});

test('adaptiveCurve: the image of the unit circle under log z breaks at the branch cut', () => {
  const { fn } = complexFunction('log(z)');
  const out = new Float64Array(2);
  const lines = adaptiveCurve((s, o) => { fn(Math.cos(2 * Math.PI * s), Math.sin(2 * Math.PI * s), 0, 0, out); o[0] = out[0]; o[1] = out[1]; }, 0, 1, { samples: 50, tol: 0.02, breakLen: 0.5 });
  assert.equal(lines.length, 2); // Im log z runs 0 → π, jumps to −π, runs back to 0
  for (const l of lines) {
    for (const d of seglens(l)) assert.ok(d <= 0.5);
    for (let k = 0; k < l.length; k += 2) assert.ok(Math.abs(l[k]) < 1e-12); // Re log z = ln 1 = 0
  }
});

test('adaptiveCurve: a line through a pole splits and is refined towards infinity', () => {
  const lines = adaptiveCurve((s, o) => { const x = -1 + 2 * s; o[0] = 1 / x; o[1] = 0; }, 0, 1, { samples: 51, tol: 0.05, breakLen: 2, maxDepth: 14 });
  assert.equal(lines.length, 2);
  const ends = [lines[0].at(-2), lines[1][0]];
  assert.ok(ends[0] < -50 && ends[1] > 50, `ends ${ends}`);
});

test('adaptiveCurve: NaN regions split the curve; offscreen segments are not refined', () => {
  const lines = adaptiveCurve((s, o) => { o[0] = s > 0.4 && s < 0.6 ? NaN : s; o[1] = 0; }, 0, 1, { samples: 20, tol: 0.01 });
  assert.equal(lines.length, 2);
  let calls = 0;
  adaptiveCurve((s, o) => { calls++; o[0] = 1e6 + 1e6 * s; o[1] = 0; }, 0, 1, { samples: 20, tol: 1e-3, bounds: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 } });
  assert.ok(calls < 200, `${calls} evaluations for an invisible curve`);
});

test('robustBounds ignores outliers near poles', () => {
  const pts = [];
  for (let k = 0; k < 1000; k++) pts.push(Math.cos(k), Math.sin(k));
  pts.push(1e9, -1e9);
  const b = robustBounds([pts], 0.01);
  assert.ok(b.xmax <= 1 && b.xmin >= -1 && b.ymax <= 1 && b.ymin >= -1);
});

test('hue wheel: constant OKLab lightness, red/green/blue at arg 0, 2π/3, 4π/3', () => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const oklabL = (r, g, b) => {
    const [R, G, B] = [r, g, b].map((v) => lin(v / 255));
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  };
  const n = HUE_LUT.length / 3;
  assert.equal(n, 1024);
  for (let k = 0; k < n; k += 16) {
    const L = oklabL(HUE_LUT[3 * k], HUE_LUT[3 * k + 1], HUE_LUT[3 * k + 2]);
    assert.ok(Math.abs(L - 0.72) < 0.01, `entry ${k}: L = ${L}`);
  }
  const [r0, g0, b0] = phaseColor(1, 0);
  assert.ok(r0 > g0 && r0 > b0, 'arg 0 is red');
  const [r1, g1, b1] = phaseColor(Math.cos(2.1), Math.sin(2.1));
  assert.ok(g1 > r1 && g1 > b1, 'arg 2π/3 is green');
  const [r2, g2, b2] = phaseColor(Math.cos(4.2), Math.sin(4.2));
  assert.ok(b2 > r2 && b2 > g2, 'arg 4π/3 is blue');
  // achromatic OKLCH is neutral grey
  const [gr, gg, gb] = oklch(0.6, 0, 123);
  assert.ok(Math.abs(gr - gg) < 1e-9 && Math.abs(gg - gb) < 1e-9);
});

test('DomainJob: chunked rendering equals one pass; pixels follow arg f(z)', () => {
  const { fn } = complexFunction('(z^2 - 1)/(z - i)');
  const opts = { x0: -2, y0: 2, dx: 4 / 64, dy: 4 / 48, fn, style: 'enhanced' };
  const whole = new DomainJob(64, 48, opts);
  whole.run(Infinity);
  const chunked = new DomainJob(64, 48, opts);
  let rounds = 0;
  while (!chunked.run(0)) rounds++;
  assert.ok(rounds > 3);
  assert.deepEqual(chunked.data, whole.data);

  const id = new DomainJob(40, 40, { x0: -1, y0: 1, dx: 0.05, dy: 0.05, fn: complexFunction('z').fn, style: 'phase' });
  id.run();
  for (const [i, j] of [[35, 20], [5, 5], [20, 35], [12, 30]]) {
    const x = -1 + (i + 0.5) * 0.05, y = 1 - (j + 0.5) * 0.05;
    const p = 4 * (j * 40 + i);
    assert.deepEqual([...id.data.slice(p, p + 3)], phaseColor(x, y));
  }
});

test('DomainJob: poles render white, undefined values grey', () => {
  // pixel i samples x0 + (i + ½)·dx: pixel 0 is z = 0 exactly, pixel 1 is z = 0.5
  const inv = new DomainJob(2, 1, { x0: -0.25, y0: 0.5, dx: 0.5, dy: 1, fn: complexFunction('1/z').fn, style: 'phase' });
  inv.run();
  assert.deepEqual([...inv.data.slice(0, 3)], [245, 245, 245]);
  assert.deepEqual([...inv.data.slice(4, 7)], phaseColor(2, 0));
  const nan = new DomainJob(1, 1, { x0: -0.5, y0: 0.5, dx: 1, dy: 1, fn: complexFunction('z/z').fn, style: 'phase' });
  nan.run(); // samples z = 0: 0/0
  assert.deepEqual([...nan.data.slice(0, 3)], [128, 128, 128]);
});
