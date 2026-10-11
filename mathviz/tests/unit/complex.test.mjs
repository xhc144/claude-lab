import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, windingNumber } from '../../src/core/complex.js';
import { complexFunction } from '../../src/core/expr.js';

const near = (got, want, tol = 1e-12) => {
  const scale = Math.max(1, Math.hypot(want[0], want[1]));
  assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) <= tol * scale, `got ${got}, want ${want}`);
};

// deterministic pseudo-random sample points
function* points(n, R = 3) {
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < n; k++) yield [(rnd() * 2 - 1) * R, (rnd() * 2 - 1) * R];
}

const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

test('exp and log are mutually inverse (principal branch)', () => {
  for (const z of points(200)) {
    near(call('exp', ...call('log', ...z)), z, 1e-13);
    const l = call('log', ...z);
    assert.ok(l[1] > -Math.PI && l[1] <= Math.PI);
  }
});

test('Pythagorean identity and double-angle formulas', () => {
  for (const z of points(200, 2)) {
    const s = call('sin', ...z);
    const c = call('cos', ...z);
    near(add(mul(s, s), mul(c, c)), [1, 0], 1e-11);
    near(call('sin', 2 * z[0], 2 * z[1]), mul([2, 0], mul(s, c)), 1e-11);
    const ch = call('cosh', ...z), sh = call('sinh', ...z);
    near(add(mul(ch, ch), mul([-1, 0], mul(sh, sh))), [1, 0], 1e-10);
  }
});

test('tan/tanh match sin/cos ratios, inverse trig round-trips', () => {
  for (const z of points(200, 1.5)) {
    const t = call('tan', ...z);
    near(t, call('div', ...call('sin', ...z), ...call('cos', ...z)), 1e-10);
    near(call('tanh', ...z), call('div', ...call('sinh', ...z), ...call('cosh', ...z)), 1e-10);
    // principal inverses round-trip inside their principal strips
    const w = [z[0] * 0.4, z[1] * 0.4];
    near(call('sin', ...call('asin', ...w)), w, 1e-11);
    near(call('cos', ...call('acos', ...w)), w, 1e-11);
    near(call('tan', ...call('atan', ...w)), w, 1e-11);
  }
  near(call('asin', 0.5, 0), [Math.PI / 6, 0]);
  near(call('acos', 0.5, 0), [Math.PI / 3, 0]);
  near(call('atan', 1, 0), [Math.PI / 4, 0]);
  near(call('tan', 0, 40), [0, 1]); // large imaginary part: no overflow
  near(call('tanh', -40, 0.3), [-1, 0]);
});

test('sqrt is the principal square root', () => {
  for (const z of points(300)) {
    const r = call('sqrt', ...z);
    near(mul(r, r), z, 1e-13);
    assert.ok(r[0] >= 0);
  }
  near(call('sqrt', -4, 0), [0, 2]);
  near(call('sqrt', -4, -0), [0, 2]);
  near(call('sqrt', 0, 0), [0, 0]);
});

test('integer and general powers', () => {
  for (const z of points(100, 1.5)) {
    let p = [1, 0];
    for (let n = 1; n <= 7; n++) {
      p = mul(p, z);
      near(call('powi', ...z, n), p, 1e-12);
      near(call('pow', ...z, n, 0), p, 1e-12);
    }
    near(mul(call('powi', ...z, -3), call('powi', ...z, 3)), [1, 0], 1e-11);
  }
  near(call('pow', 0, 1, 0, 1), [Math.exp(-Math.PI / 2), 0]); // i^i
  near(call('pow', 0, 0, 2, 0), [0, 0]);
});

test('division is robust: Smith algorithm, division by zero gives ∞', () => {
  near(call('div', 1, 0, 1e300, 1e300), [5e-301, -5e-301], 1e-12);
  const inf = call('div', 1, 2, 0, 0);
  assert.equal(inf[0], Infinity);
  assert.ok(Number.isNaN(call('div', 0, 0, 0, 0)[0]));
});

test('Gamma function: known values and functional equation', () => {
  near(call('gamma', 5, 0), [24, 0], 1e-12);
  near(call('gamma', 0.5, 0), [Math.sqrt(Math.PI), 0], 1e-12);
  near(call('gamma', -0.5, 0), [-2 * Math.sqrt(Math.PI), 0], 1e-12);
  // |Γ(i)|² = π / sinh(π)
  const g = call('gamma', 0, 1);
  assert.ok(Math.abs(g[0] ** 2 + g[1] ** 2 - Math.PI / Math.sinh(Math.PI)) < 1e-12);
  for (const z of points(100, 3)) {
    // Γ(z + 1) = z·Γ(z)
    near(call('gamma', z[0] + 1, z[1]), mul(z, call('gamma', ...z)), 1e-10);
  }
});

test('compiled expressions satisfy the Cauchy–Riemann equations when analytic', () => {
  const out = new Float64Array(2);
  for (const src of ['z^3 - 2z + 1', 'exp(z)*sin(z)', '(z-1)/(z^2+1)', 'gamma(z)', 'sqrt(z)', 'log(z)']) {
    const { fn } = complexFunction(src);
    for (const [x, y] of points(40, 1.2)) {
      const zx = x + 0.05, zy = y + 1.7; // stay away from branch cuts on the real axis
      const h = 1e-6;
      fn(zx + h, zy, 0, 0, out); const ux1 = out[0], vx1 = out[1];
      fn(zx - h, zy, 0, 0, out); const ux0 = out[0], vx0 = out[1];
      fn(zx, zy + h, 0, 0, out); const uy1 = out[0], vy1 = out[1];
      fn(zx, zy - h, 0, 0, out); const uy0 = out[0], vy0 = out[1];
      const ux = (ux1 - ux0) / (2 * h), vx = (vx1 - vx0) / (2 * h);
      const uy = (uy1 - uy0) / (2 * h), vy = (vy1 - vy0) / (2 * h);
      const scale = Math.max(1, Math.hypot(ux, vx));
      assert.ok(Math.abs(ux - vy) < 1e-5 * scale && Math.abs(uy + vx) < 1e-5 * scale, `${src} at ${zx},${zy}`);
    }
  }
});

test('winding number counts zeros minus poles (argument principle)', () => {
  const out = new Float64Array(2);
  const circle = (src, cx, cy, r, ar = 0, ai = 0) => {
    const { fn } = complexFunction(src);
    return windingNumber((t, P) => {
      fn(cx + r * Math.cos(2 * Math.PI * t), cy + r * Math.sin(2 * Math.PI * t), ar, ai, out);
      P[0] = out[0]; P[1] = out[1];
    });
  };
  assert.equal(circle('z^3 - 1', 0, 0, 2).winding, 3);
  assert.equal(circle('z^3 - 1', 1, 0, 0.5).winding, 1);
  assert.equal(circle('1/z', 0, 0, 1).winding, -1);
  assert.equal(circle('(z-1)^2/(z+1)', 0, 0, 3).winding, 1);
  assert.equal(circle('(z-1)^2/(z+1)', 1, 0, 0.5).winding, 2);
  assert.equal(circle('exp(z)', 0, 0, 5).winding, 0);
  assert.equal(circle('z^5 - z + a', 0, 0, 3, 0.2, 0.1).winding, 5);
  assert.equal(circle('sin(z)', 0, 0, 10).winding, 7); // zeros at 0, ±π, ±2π, ±3π
  const r = circle('z^2', 0, 0, 1);
  assert.ok(r.reliable && Math.abs(r.exact - 2) < 1e-9);
});
