// Physics and algebra inside the instruments (pure functions only; no DOM needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, toJS, toGLSL } from '../../src/instruments/domain.js';

test('expression grammar: precedence, implicit multiplication, functions', () => {
  const ev = (s, z = [0.3, -0.7]) => toJS(parse(s))(z, [1, 0]);
  const close = (a, b) => Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
  assert.ok(close(ev('-2^2'), [-4, 0]));
  assert.ok(close(ev('2^3^2'), [512, 0]));
  assert.ok(close(ev('2i'), [0, 2]));
  assert.ok(close(ev('zi'), [0.7, 0.3]));
  assert.ok(close(ev('z(z+1)'), ev('z^2+z')));
  const e = ev('exp(i*pi)');
  assert.ok(Math.abs(e[0] + 1) < 1e-12 && Math.abs(e[1]) < 1e-12);
  const s = ev('sin(z)^2+cos(z)^2');
  assert.ok(Math.abs(s[0] - 1) < 1e-12 && Math.abs(s[1]) < 1e-12);
});

test('expression grammar rejects anything outside the whitelist', () => {
  for (const bad of ['window', 'z;alert(1)', 'z^', '(z+1', 'foo(z)', 'z$']) assert.throws(() => parse(bad), bad);
  assert.match(toGLSL(parse('z^3-1')), /cpowi\(z, 3\)/);
});

// Equations of motion copied verbatim from pendulum.js (unit masses and lengths).
const G = 9.81;
function deriv(s, d) {
  const [t1, t2, w1, w2] = s, D = t2 - t1, cD = Math.cos(D), sD = Math.sin(D), den1 = 2 - cD * cD;
  d[0] = w1; d[1] = w2;
  d[2] = (w1 * w1 * sD * cD + G * Math.sin(t2) * cD + w2 * w2 * sD - 2 * G * Math.sin(t1)) / den1;
  d[3] = (-w2 * w2 * sD * cD + 2 * (G * Math.sin(t1) * cD - w1 * w1 * sD - G * Math.sin(t2))) / den1;
}
const energy = ([t1, t2, w1, w2]) => w1 * w1 + 0.5 * w2 * w2 + w1 * w2 * Math.cos(t1 - t2) - 2 * G * Math.cos(t1) - G * Math.cos(t2);

test('double pendulum: RK4 conserves energy over 10 s of chaotic motion', () => {
  let s = [2.2, 2.2, 0, 0];
  const e0 = energy(s), h = 1 / 360;
  const k = [0, 1, 2, 3].map(() => new Array(4));
  for (let i = 0; i < 3600; i++) {
    deriv(s, k[0]);
    deriv(s.map((v, j) => v + (h / 2) * k[0][j]), k[1]);
    deriv(s.map((v, j) => v + (h / 2) * k[1][j]), k[2]);
    deriv(s.map((v, j) => v + h * k[2][j]), k[3]);
    s = s.map((v, j) => v + (h / 6) * (k[0][j] + 2 * k[1][j] + 2 * k[2][j] + k[3][j]));
  }
  assert.ok(Math.abs(energy(s) - e0) / Math.abs(e0) < 1e-5);
});

test('double pendulum equations agree with the Lagrangian (small-angle normal modes)', () => {
  // linearised: ω² = g(2 ± √2) for unit masses/lengths
  const eps = 1e-6, d = new Array(4);
  const J = [];
  for (let j = 0; j < 2; j++) {
    const s = [0, 0, 0, 0]; s[j] = eps; deriv(s, d); J.push([d[2] / eps, d[3] / eps]);
  }
  // matrix M with θ'' = M θ (columns from J)
  const a = J[0][0], b = J[1][0], c = J[0][1], e = J[1][1];
  const tr = a + e, det = a * e - b * c;
  const l1 = tr / 2 + Math.sqrt(tr * tr / 4 - det), l2 = tr / 2 - Math.sqrt(tr * tr / 4 - det);
  const want = [-G * (2 - Math.SQRT2), -G * (2 + Math.SQRT2)];
  assert.ok(Math.abs(l1 - want[0]) < 1e-4 && Math.abs(l2 - want[1]) < 1e-4);
});

test('S₃: the standard representation matrices are a homomorphism with characters 2, 0, −1', async () => {
  const S3 = Math.sqrt(3) / 2;
  const M = { e: [1, 0, 0, 1], r: [-0.5, -S3, S3, -0.5], r2: [-0.5, S3, -S3, -0.5], s1: [-1, 0, 0, 1], s2: [0.5, S3, S3, -0.5], s3: [0.5, -S3, -S3, -0.5] };
  const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
  const eq = (A, B) => A.every((v, i) => Math.abs(v - B[i]) < 1e-12);
  assert.ok(eq(mul(M.r, M.r), M.r2));
  assert.ok(eq(mul(M.r, mul(M.r, M.r)), M.e));
  for (const s of ['s1', 's2', 's3']) assert.ok(eq(mul(M[s], M[s]), M.e));
  assert.ok(eq(mul(M.s1, mul(M.r, M.s1)), M.r2)); // s r s = r⁻¹
  const tr = (A) => A[0] + A[3];
  assert.equal(tr(M.e), 2);
  for (const s of ['s1', 's2', 's3']) assert.ok(Math.abs(tr(M[s])) < 1e-12);
  for (const r of ['r', 'r2']) assert.ok(Math.abs(tr(M[r]) + 1) < 1e-12);
  // each reflection fixes its vertex: vertices at 90°, 210°, 330°
  const v = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const ap = (A, p) => [A[0] * p[0] + A[1] * p[1], A[2] * p[0] + A[3] * p[1]];
  for (const [s, deg] of [['s1', 90], ['s2', 210], ['s3', 330]]) { const p = v(deg), q = ap(M[s], p); assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-12, s); }
});

test('split-step Schrödinger: unitary away from the absorbers, T + R = 1, tunnelling below the barrier', async () => {
  const { Quantum } = await import('../../src/instruments/quantum.js');
  const { makeFFT } = await import('../../src/instruments/fft.js');
  const host = { dataset: { instrument: 'quantum' }, querySelector: () => null };
  const q = new Quantum(host, {});
  q.fft1 = makeFFT(1024);
  q.V0 = 1.4; q.k0 = 1.6; q.mode = '1d';
  q.reset();
  const norm = () => { let s = 0; for (let j = 0; j < 1024; j++) s += (q.re[j] ** 2 + q.im[j] ** 2) * (240 / 1024); return s; };
  assert.ok(Math.abs(norm() - 1) < 1e-9);
  for (let k = 0; k < 200; k++) q.step1d();
  assert.ok(Math.abs(norm() + q.absL + q.absR - 1) < 1e-6, 'norm is conserved (absorbed part booked)');
  for (let k = 0; k < 1400; k++) q.step1d();
  let left = 0, right = 0;
  for (let j = 0; j < 1024; j++) { const p = (q.re[j] ** 2 + q.im[j] ** 2) * (240 / 1024); if (j * (240 / 1024) < 119) left += p; else right += p; }
  const T = right + q.absR, R = left + q.absL;
  assert.ok(Math.abs(T + R - 1) < 1e-6);
  // ⟨E⟩ = k₀²/2 = 1.28 < V₀ = 1.4, yet a sizeable fraction tunnels through the width-2 barrier
  assert.ok(T > 0.05 && T < 0.6, `T = ${T}`);
});
