import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mat, det, trace, mul, apply, inverse, eigen, svd, polar, interpolate, rank, classify, power,
  transpose, IDENTITY, rotation, approxEqual, norm, logm, expm, powReal, svdPath,
} from '../../src/core/linalg.js';

const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const matClose = (A, B, tol = 1e-12) => assert.ok(approxEqual(A, B, tol), `${JSON.stringify(A)} ≉ ${JSON.stringify(B)}`);

function* randomMatrices(n) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 6 - 3;
  for (let k = 0; k < n; k++) yield mat(rnd(), rnd(), rnd(), rnd());
}

test('basic operations', () => {
  const A = mat(1, 2, 3, 4);
  assert.equal(det(A), -2);
  assert.equal(trace(A), 5);
  assert.deepEqual(apply(A, 1, 0), [1, 3]); // first column = image of î
  assert.deepEqual(apply(A, 0, 1), [2, 4]); // second column = image of ĵ
  matClose(mul(A, inverse(A)), IDENTITY);
  assert.equal(inverse(mat(1, 2, 2, 4)), null);
  matClose(power(mat(1, 1, 1, 0), 10), mat(89, 55, 55, 34)); // Fibonacci
  for (const M of randomMatrices(50)) {
    const N = mat(0.3, -1, 2, 0.7);
    close(det(mul(M, N)), det(M) * det(N), 1e-12);
    matClose(transpose(mul(M, N)), mul(transpose(N), transpose(M)), 1e-12);
  }
});

test('eigen decomposition: A v = λ v', () => {
  for (const M of randomMatrices(300)) {
    const e = eigen(M);
    if (e.kind === 'real') {
      e.values.forEach((l, k) => {
        const v = e.vectors[k];
        const [x, y] = apply(M, ...v);
        close(Math.hypot(...v), 1);
        assert.ok(Math.hypot(x - l * v[0], y - l * v[1]) < 1e-9, 'eigen residual');
      });
      close(e.values[0] + e.values[1], trace(M), 1e-10);
      close(e.values[0] * e.values[1], det(M), 1e-10);
      assert.ok(e.values[0] >= e.values[1]);
    } else if (e.kind === 'complex') {
      close(2 * e.re, trace(M), 1e-10);
      close(e.re ** 2 + e.im ** 2, det(M), 1e-10);
      assert.ok(e.im > 0);
    }
  }
  const r = eigen(rotation(Math.PI / 3));
  assert.equal(r.kind, 'complex');
  close(r.angle, Math.PI / 3);
  close(r.modulus, 1);
  const shear = eigen(mat(1, 1, 0, 1));
  assert.equal(shear.kind, 'repeated');
  assert.equal(shear.scalar, false);
  assert.deepEqual(shear.vectors[0], [1, 0]);
  assert.equal(eigen(mat(2, 0, 0, 2)).scalar, true);
});

test('SVD reconstructs the matrix with ordered non-negative singular values', () => {
  for (const M of [...randomMatrices(300), mat(0, 0, 0, 0), mat(1, 2, 2, 4), mat(0, -1, 1, 0), mat(-1, 0, 0, 1)]) {
    const { sigma, U, Vt } = svd(M);
    assert.ok(sigma[0] >= sigma[1] && sigma[1] >= 0);
    matClose(mul(mul(U, mat(sigma[0], 0, 0, sigma[1])), Vt), M, 1e-11);
    matClose(mul(transpose(U), U), IDENTITY, 1e-12);
    matClose(mul(Vt, transpose(Vt)), IDENTITY, 1e-12);
    close(sigma[0] * sigma[1], Math.abs(det(M)), 1e-10);
    // σ₁² + σ₂² = ‖M‖_F²
    close(sigma[0] ** 2 + sigma[1] ** 2, M.a ** 2 + M.b ** 2 + M.c ** 2 + M.d ** 2, 1e-10);
  }
});

test('polar decomposition M = Q·P', () => {
  for (const M of randomMatrices(200)) {
    const { Q, P } = polar(M);
    matClose(mul(Q, P), M, 1e-11);
    matClose(mul(transpose(Q), Q), IDENTITY, 1e-12);
    close(P.b, P.c, 1e-12); // symmetric
    assert.ok(P.a + P.d >= -1e-12 && det(P) >= -1e-10); // positive semi-definite
  }
});

test('interpolation endpoints and polar path keeps det > 0', () => {
  const M = mat(0, -2, 2, 0); // rotate 90° and scale by 2
  matClose(interpolate(M, 0), IDENTITY);
  matClose(interpolate(M, 1), M);
  matClose(interpolate(M, 0.5, 'linear'), mat(0.5, -1, 1, 0.5));
  for (let t = 0; t <= 1; t += 0.05) assert.ok(det(interpolate(M, t, 'polar')) > 0);
  // halfway along the polar path: rotation 45°, scale 1.5
  const H = interpolate(M, 0.5, 'polar');
  close(Math.atan2(H.c, H.a), Math.PI / 4);
  close(Math.sqrt(det(H)), 1.5);
  // reflection: polar mode falls back to linear and must cross det = 0
  const R = mat(1, 0, 0, -1);
  matClose(interpolate(R, 0.5, 'polar'), interpolate(R, 0.5, 'linear'));
});

test('rank and geometric classification', () => {
  assert.equal(rank(mat(1, 2, 3, 4)), 2);
  assert.equal(rank(mat(1, 2, 2, 4)), 1);
  assert.equal(rank(mat(0, 0, 0, 0)), 0);
  const has = (M, text) => assert.ok(classify(M).some((s) => s.includes(text)), `${JSON.stringify(M)} -> ${classify(M)}`);
  has(IDENTITY, '恒等');
  has(rotation(Math.PI / 6), '旋转 30°');
  has(mat(1, 0, 0, -1), '反射');
  has(mat(1, 0, 0, 0), '正交投影');
  has(mat(1, 1, 0, 0), '斜投影');
  has(mat(0, 1, 0, 0), '幂零');
  has(mat(1, 1, 0, 1), '剪切');
  has(mat(2, 0, 0, 2), '均匀缩放');
  has(mat(2, 1, 1, 2), '对称');
  has(mat(1, -1, 1, 1), '保角');
  has(mat(1, 2, 3, 4), '翻转定向');
});

test('matrix logarithm and exponential: exp(log M) = M, Mᵗ is a one-parameter group', () => {
  const close = (A, B, tol, msg) => assert.ok(approxEqual(A, B, tol), `${msg}: ${JSON.stringify(A)} vs ${JSON.stringify(B)}`);
  const cases = [
    mat(2, 1, 1, 3), // real positive eigenvalues
    mat(0.9, -0.45, 0.45, 0.9), // complex
    mat(1, 1, 0, 1), // shear (repeated, defective)
    mat(-2, 0, 0, -2), // −2I = 2·R(π)
    mat(3, 0, 0, 3),
    rotation(2.5),
  ];
  for (const M of cases) {
    const L = logm(M);
    assert.ok(L, `log exists for ${JSON.stringify(M)}`);
    close(expm(L), M, 1e-12, 'exp(log M)');
    close(powReal(M, 2), mul(M, M), 1e-11, 'M^2');
    close(mul(powReal(M, 0.3), powReal(M, 0.7)), M, 1e-12, 'M^0.3 M^0.7');
  }
  // sqrt of the shear [[1, 1], [0, 1]] is [[1, 1/2], [0, 1]]
  close(powReal(mat(1, 1, 0, 1), 0.5), mat(1, 0.5, 0, 1), 1e-14, 'shear^½');
  // no real logarithm: det ≤ 0, or distinct negative eigenvalues
  assert.equal(logm(mat(1, 2, 3, 4)), null);
  assert.equal(logm(mat(1, 1, 1, 0)), null);
  assert.equal(logm(mat(-1, 0, 0, -2)), null);
  assert.equal(logm(mat(-1, 1, 0, -1)), null);
  // exp of a generator of rotations
  close(expm(mat(0, -Math.PI / 2, Math.PI / 2, 0)), mat(0, -1, 1, 0), 1e-15, 'exp(π/2 J)');
  // the SVD path ends at M and passes through Vᵀ and Σ·Vᵀ; 'exp' interpolation falls back to polar
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 6 - 3; };
  for (let k = 0; k < 200; k++) {
    const M = mat(rnd(), rnd(), rnd(), rnd());
    close(svdPath(M, 1), M, 1e-9 * Math.max(1, norm(M)), 'svdPath(1)');
    close(svdPath(M, 0), IDENTITY, 1e-15, 'svdPath(0)');
    const { Vt } = svd(M);
    if (det(M) > 0) close(svdPath(M, 1 / 3), Vt, 1e-12, 'svdPath(1/3) = Vᵀ');
    assert.ok(Number.isFinite(interpolate(M, 0.5, 'exp').a));
  }
});
