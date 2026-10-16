import test from 'node:test';
import assert from 'node:assert/strict';
import { escape, perturb, newton, renderRows, referenceOrbit, toFixed, attractingPeriod, autoIterations, paletteLUT, orbit, seriesApprox } from '../../src/core/fractal.js';
import { fromDecimal, add, mul, fromNumber, toDecimal } from '../../src/core/bigreal.js';

test('escape time: interior, exterior and smooth values', () => {
  assert.equal(escape(0, 0, 0, 0, 500, false, 0), -1); // c = 0: fixed point 0
  assert.equal(escape(0, 0, -1, 0, 500, false, 0), -1); // period-2 bulb
  assert.equal(escape(0, 0, -0.122, 0.745, 2000, false, 1e-12), -1); // period-3 bulb via the periodicity check
  const v = escape(0, 0, 1, 0, 500, false, 0); // 0, 1, 2, 5, 26, 677 > 256: n = 5, ν = 6 − log₂ log₂ 677
  assert.ok(Math.abs(v - (6 - Math.log2(Math.log2(677)))) < 1e-12, String(v));
  // the smooth count is continuous across the integer jumps of the plain count
  let prev = escape(0, 0, 0.3, 0, 5000, false, 0);
  for (let k = 1; k <= 200; k++) {
    const cur = escape(0, 0, 0.3 + k * 1e-5, 0, 5000, false, 0);
    assert.ok(Math.abs(cur - prev) < 2, `jump at ${k}: ${prev} → ${cur}`);
    prev = cur;
  }
  // Julia set of c = 0 is the unit circle
  assert.equal(escape(0.9, 0, 0, 0, 1000, false, 0), -1);
  assert.ok(escape(1.1, 0, 0, 0, 1000, false, 0) > 0);
  // Burning Ship: c = −1.75 stays bounded (real axis, same as Mandelbrot)
  assert.equal(escape(0, 0, -1.75, 0, 1000, true, 0), -1);
});

test('Newton basins of z³ − 1', () => {
  const root = (x, y) => Math.floor(newton(x, y, 100) / 1000);
  assert.equal(root(2, 0.1), 0);
  assert.equal(root(-1, 2), 1);
  assert.equal(root(-1, -2), 2);
  // symmetric under rotation by 120°
  const a = (2 * Math.PI) / 3;
  for (const [x, y] of [[0.7, 0.3], [1.5, -0.9], [-0.2, 0.05]]) {
    const r0 = root(x, y);
    const r1 = root(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
    assert.equal(r1, (r0 + 1) % 3);
  }
});

const fixed = (s, bits) => toFixed(fromDecimal(s), bits);

test('reference orbit in BigInt fixed point matches double iteration at shallow depth', () => {
  const bits = 120;
  const { ref, len } = referenceOrbit(0n, 0n, fixed('-0.122', bits), fixed('0.745', bits), bits, 300);
  assert.equal(len, 300); // inside the period-3 bulb: never escapes
  let x = 0, y = 0;
  for (let n = 1; n <= 30; n++) {
    [x, y] = [x * x - y * y - 0.122, 2 * x * y + 0.745];
    assert.ok(Math.abs(ref[2 * n] - x) < 1e-12 && Math.abs(ref[2 * n + 1] - y) < 1e-12, `n=${n}`);
  }
  const esc = referenceOrbit(0n, 0n, fixed('1', bits), 0n, bits, 300);
  assert.equal(esc.len, 5); // 0, 1, 2, 5, 26, 677
});

test('perturbation agrees with direct iteration (Mandelbrot and Julia)', () => {
  const bits = 128;
  const C = ['-0.743643887037158704752191506114774', '0.131825904205311970493132056385139'];
  const cx = Number(C[0]), cy = Number(C[1]);
  const maxIter = 3000;
  const { ref, len } = referenceOrbit(0n, 0n, fixed(C[0], bits), fixed(C[1], bits), bits, maxIter);
  let agree = 0, total = 0;
  for (let k = 0; k < 400; k++) {
    // offsets of ~1e-5: direct doubles are still accurate here
    const ox = (Math.sin(k * 12.9898) * 43758.5453 % 1) * 2e-5, oy = (Math.sin(k * 78.233) * 12345.678 % 1) * 2e-5;
    const a = escape(0, 0, cx + ox, cy + oy, maxIter, false, 0);
    const b = perturb(ref, len, 0, 0, ox, oy, maxIter, 0);
    total++;
    // near the boundary plain double iteration itself drifts after hundreds of steps
    if ((a < 0 && b < 0) || (a >= 0 && b >= 0 && Math.abs(a - b) < 1e-2)) agree++;
  }
  assert.ok(agree / total > 0.97, `${agree}/${total}`);
  // Julia set of c = −0.8 + 0.156i around the centre 0.1 + 0.2i
  const J = [-0.8, 0.156];
  const jr = referenceOrbit(fixed('0.1', bits), fixed('0.2', bits), fixed('-0.8', bits), fixed('0.156', bits), bits, 2000);
  let jAgree = 0;
  for (let k = 0; k < 200; k++) {
    const ox = ((k % 20) - 10) * 3e-3, oy = (Math.floor(k / 20) - 5) * 3e-3;
    const a = escape(0.1 + ox, 0.2 + oy, J[0], J[1], 2000, false, 0);
    const b = perturb(jr.ref, jr.len, ox, oy, 0, 0, 2000, 0);
    if ((a < 0 && b < 0) || Math.abs(a - b) < 1e-2) jAgree++;
  }
  assert.ok(jAgree / 200 > 0.97, `julia ${jAgree}/200`);
});

test('deep zoom at 10⁻³⁰: perturbation still resolves detail that doubles cannot', () => {
  const C = ['-0.743643887037158704752191506114774', '0.131825904205311970493132056385139'];
  const span = 1e-30, w = 64, ps = span / w;
  const bits = Math.ceil(-Math.log2(ps)) + 64;
  const maxIter = 60000; // this spiral needs ~50 000 iterations at 10⁻³⁰
  const { ref, len } = referenceOrbit(0n, 0n, fixed(C[0], bits), fixed(C[1], bits), bits, maxIter);
  const probes = [[-32 * ps, 4 * ps], [32 * ps, 4 * ps], [-32 * ps, -4 * ps], [32 * ps, -4 * ps]];
  const sa = seriesApprox(ref, len, false, probes);
  assert.ok(sa.skip > 5000, `series approximation skips ${sa.skip} iterations`);
  const out = renderRows({ kind: 'mandelbrot', w, h: 8, y0: 0, y1: 8, step: 1, ps, cx: 0, cy: 0, maxIter, ref, refLen: len, eps: 0, sa });
  const vals = Array.from(out).filter((v) => v >= 0);
  assert.ok(vals.length > 0.5 * out.length, 'mostly escaping pixels');
  assert.ok(vals.every(Number.isFinite));
  // distinct pixels get distinct values: real structure, not one flat colour
  assert.ok(new Set(vals.map((v) => v.toFixed(3))).size > 40);
  // in plain doubles all those pixels are the same point
  const cx = Number(C[0]);
  assert.equal(cx + ps, cx);
  // the centre, kept as an exact rational, moves by sub-double amounts without loss
  const moved = add(fromDecimal(C[0]), mul(fromNumber(ps), fromNumber(3), 0), 0);
  assert.notEqual(toDecimal(moved, 40, { ascii: true }), toDecimal(fromDecimal(C[0]), 40, { ascii: true }));
});

test('periods of the bulbs and orbits', () => {
  assert.equal(attractingPeriod(0, 0).period, 1);
  assert.equal(attractingPeriod(-1, 0).period, 2);
  assert.equal(attractingPeriod(-0.122, 0.745).period, 3); // the “rabbit”
  assert.equal(attractingPeriod(-1.31, 0).period, 4);
  assert.equal(attractingPeriod(0.5, 0).escaped, true);
  assert.deepEqual(orbit(0, 0, 0, 1, 4), [[0, 0], [0, 1], [-1, 1], [0, -1], [-1, 1]]); // c = i is pre-periodic
});

test('iteration limits grow with depth; palettes fill the table', () => {
  assert.ok(autoIterations(3.5, 'mandelbrot') < autoIterations(1e-6, 'mandelbrot'));
  assert.ok(autoIterations(1e-30, 'mandelbrot') > 4000);
  const lut = paletteLUT('aurora');
  assert.equal(lut.length, 3 * 1024);
});

test('series approximation skips iterations without changing the picture', () => {
  const C = ['-0.743643887037158704752191506114774', '0.131825904205311970493132056385139'];
  const span = 1e-22, w = 40, h = 24, ps = span / w;
  const bits = Math.ceil(-Math.log2(ps)) + 64;
  const maxIter = 30000;
  const { ref, len } = referenceOrbit(0n, 0n, fixed(C[0], bits), fixed(C[1], bits), bits, maxIter);
  const probes = [[-w / 2 * ps, h / 2 * ps], [w / 2 * ps, h / 2 * ps], [-w / 2 * ps, -h / 2 * ps], [w / 2 * ps, -h / 2 * ps]];
  const sa = seriesApprox(ref, len, false, probes);
  assert.ok(sa.skip > 1000, `skip ${sa.skip}`);
  const job = { kind: 'mandelbrot', w, h, y0: 0, y1: h, step: 1, ps, cx: 0, cy: 0, maxIter, ref, refLen: len, eps: 0 };
  const plain = renderRows(job);
  const fast = renderRows({ ...job, sa });
  let same = 0;
  for (let k = 0; k < plain.length; k++) if ((plain[k] < 0 && fast[k] < 0) || Math.abs(plain[k] - fast[k]) < 1e-3 * Math.max(1, plain[k])) same++;
  assert.ok(same / plain.length > 0.99, `${same}/${plain.length}`);
});
