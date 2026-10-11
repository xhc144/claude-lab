import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rk4Step, rk4Work, DormandPrince, integrate, densify, jacobian2, classifyEquilibrium,
  findEquilibria, contourZero, largestLyapunov,
} from '../../src/core/ode.js';

test('RK4 is fourth-order accurate on y\' = y', () => {
  const f = (t, y, dy) => { dy[0] = y[0]; };
  const err = (n) => {
    const y = Float64Array.of(1);
    const w = rk4Work(1);
    for (let k = 0; k < n; k++) rk4Step(f, k / n, y, 1 / n, w);
    return Math.abs(y[0] - Math.E);
  };
  const ratio = err(20) / err(40);
  assert.ok(ratio > 14 && ratio < 18, `convergence ratio ${ratio}`);
});

test('Dormand–Prince meets its tolerance on the harmonic oscillator, both directions', () => {
  const f = (t, y, dy) => { dy[0] = y[1]; dy[1] = -y[0]; };
  for (const rtol of [1e-6, 1e-9, 1e-12]) {
    const dp = new DormandPrince(f, 2, { rtol, atol: rtol * 1e-2 });
    dp.reset(0, [1, 0]);
    assert.ok(dp.advanceTo(10 * Math.PI));
    const e = Math.hypot(dp.y[0] - 1, dp.y[1]);
    assert.ok(e < 200 * rtol, `rtol ${rtol}: error ${e}`);
  }
  const back = new DormandPrince(f, 2, { rtol: 1e-10, atol: 1e-12 });
  back.reset(0, [1, 0], 0, -1);
  assert.ok(back.advanceTo(-Math.PI / 2));
  assert.ok(Math.abs(back.y[0]) < 1e-8 && Math.abs(back.y[1] - 1) < 1e-8); // (cos(−π/2), −sin(−π/2)) = (0, 1)
});

test('Dormand–Prince lands exactly on tEnd and reports blow-up', () => {
  const f = (t, y, dy) => { dy[0] = y[0] * y[0]; }; // y = 1/(1 − t), singular at t = 1
  const dp = new DormandPrince(f, 1, { rtol: 1e-10, atol: 1e-12 });
  dp.reset(0, [1]);
  assert.ok(dp.advanceTo(0.5));
  assert.equal(dp.t, 0.5);
  assert.ok(Math.abs(dp.y[0] - 2) < 1e-8);
  // with a relative tolerance a solver may step across the pole, so blow-up is caught by `stop`
  const sol = integrate(f, [1], { duration: 2, stop: (y) => Math.abs(y[0]) > 1e6 });
  assert.equal(sol.status, 'stopped');
  assert.ok(sol.t.at(-1) < 1 && sol.t.at(-1) > 0.999);
});

test('integrate + densify produce a smooth curve with stop condition', () => {
  const f = (t, y, dy) => { dy[0] = -y[1]; dy[1] = y[0]; };
  const sol = integrate(f, [1, 0], { duration: 2 * Math.PI, rtol: 1e-9 });
  assert.equal(sol.status, 'done');
  const pts = densify(sol, 0.01);
  for (let k = 0; k < pts.length; k += 3) {
    // Hermite interpolant stays on the unit circle
    assert.ok(Math.abs(Math.hypot(pts[k], pts[k + 1]) - 1) < 1e-6);
  }
  for (let k = 3; k < pts.length; k += 3) assert.ok(Math.hypot(pts[k] - pts[k - 3], pts[k + 1] - pts[k - 2]) <= 0.0101);
  const stopped = integrate(f, [1, 0], { duration: 10, stop: (y) => y[1] < -0.5 });
  assert.equal(stopped.status, 'stopped');
});

test('equilibrium classification by trace/determinant', () => {
  const cases = [
    [{ a: 1, b: 0, c: 0, d: -1 }, 'saddle'],
    [{ a: -1, b: 0, c: 0, d: -2 }, 'stable-node'],
    [{ a: 1, b: 0, c: 0, d: 2 }, 'unstable-node'],
    [{ a: -0.1, b: -1, c: 1, d: -0.1 }, 'stable-focus'],
    [{ a: 0.1, b: -1, c: 1, d: 0.1 }, 'unstable-focus'],
    [{ a: 0, b: -1, c: 1, d: 0 }, 'center'],
    [{ a: -1, b: 1, c: 0, d: -1 }, 'stable-star'],
    [{ a: 1, b: 0, c: 0, d: 0 }, 'degenerate'],
  ];
  for (const [J, type] of cases) assert.equal(classifyEquilibrium(J).type, type, JSON.stringify(J));
  const sad = classifyEquilibrium({ a: 2, b: 0, c: 0, d: -3 });
  assert.deepEqual(sad.eigen.real, [2, -3]);
});

test('finds and classifies equilibria of classic systems', () => {
  // undamped pendulum: centers at 2kπ, saddles at (2k+1)π
  const pend = (x, y) => [y, -Math.sin(x)];
  const eq = findEquilibria(pend, { xmin: -7, xmax: 7, ymin: -3, ymax: 3 });
  const xs = eq.map((p) => p.x).sort((a, b) => a - b);
  const want = [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI];
  assert.equal(xs.length, 5);
  xs.forEach((x, k) => assert.ok(Math.abs(x - want[k]) < 1e-8));
  for (const p of eq) {
    const k = Math.round(p.x / Math.PI);
    assert.equal(p.type, k % 2 === 0 ? 'center' : 'saddle');
    assert.ok(Math.abs(p.y) < 1e-8);
  }
  // Van der Pol (μ = 1): unstable focus at the origin
  const vdp = findEquilibria((x, y) => [y, (1 - x * x) * y - x], { xmin: -3, xmax: 3, ymin: -3, ymax: 3 });
  assert.equal(vdp.length, 1);
  assert.equal(vdp[0].type, 'unstable-focus');
  // Lotka–Volterra x' = x(1 − y), y' = y(x − 1): saddle at 0, center at (1, 1)
  const lv = findEquilibria((x, y) => [x * (1 - y), y * (x - 1)], { xmin: -0.5, xmax: 3, ymin: -0.5, ymax: 3 });
  const byType = Object.fromEntries(lv.map((p) => [p.type, p]));
  assert.ok(byType.saddle && Math.hypot(byType.saddle.x, byType.saddle.y) < 1e-8);
  assert.ok(byType.center && Math.hypot(byType.center.x - 1, byType.center.y - 1) < 1e-8);
  // a root whose Newton basin (|x| < 1/√3) falls between uniform seeds is still found
  const narrow = findEquilibria((x, y) => [x - x ** 3, -y], { xmin: -7.3, xmax: 7.3, ymin: -6, ymax: 6 }, { seeds: 12 });
  assert.deepEqual(narrow.map((p) => p.type).sort(), ['saddle', 'stable-node', 'stable-node']);
  assert.ok(narrow.some((p) => Math.hypot(p.x, p.y) < 1e-9));
  // Jacobian
  const J = jacobian2((x, y) => [x * x * y, Math.sin(x) + y], 1, 2);
  assert.ok(Math.abs(J.a - 4) < 1e-7 && Math.abs(J.b - 1) < 1e-7 && Math.abs(J.c - Math.cos(1)) < 1e-7 && Math.abs(J.d - 1) < 1e-7);
});

test('marching squares traces the unit circle and rejects poles', () => {
  const segs = contourZero((x, y) => x * x + y * y - 1, { xmin: -2, xmax: 2, ymin: -2, ymax: 2 }, 60, 60);
  assert.ok(segs.length > 100);
  for (let k = 0; k < segs.length; k += 2) assert.ok(Math.abs(Math.hypot(segs[k], segs[k + 1]) - 1) < 0.01);
  // 1/x changes sign across x = 0 but has no zero there
  const pole = contourZero((x) => 1 / x, { xmin: -1.03, xmax: 0.97, ymin: -1, ymax: 1 }, 40, 40);
  assert.equal(pole.length, 0);
});

test('Lorenz system: largest Lyapunov exponent ≈ 0.906', () => {
  const lorenz = (t, y, dy) => {
    dy[0] = 10 * (y[1] - y[0]);
    dy[1] = y[0] * (28 - y[2]) - y[1];
    dy[2] = y[0] * y[1] - (8 / 3) * y[2];
  };
  const lam = largestLyapunov(lorenz, [1, 1, 1], { dt: 0.005, duration: 400 });
  assert.ok(lam > 0.84 && lam < 0.97, `λ = ${lam}`);
});
