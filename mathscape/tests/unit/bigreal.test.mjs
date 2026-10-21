import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../src/core/bigreal.js';
import { analyze, matPow, squareFree } from '../../src/core/hpmatrix.js';
import { parse, realContext } from '../../src/core/expr.js';
import { eigen } from '../../src/core/linalg.js';

const ev = (src, P = 50) => B.evaluate(parse(src, realContext([])), P + B.GUARD);
const dec = (x, P = 50) => B.toDecimal(x, P, { ascii: true });
const val = (src, P = 50) => dec(ev(src, P), P);

// reference digits (OEIS / standard tables)
const PI100 = '3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117068';

test('constants to 50 and 100 significant digits', () => {
  assert.equal(val('pi', 100), PI100);
  assert.equal(val('e'), '2.7182818284590452353602874713526624977572470937');
  assert.equal(val('sqrt(2)'), '1.4142135623730950488016887242096980785696718753769');
  assert.equal(val('ln(2)'), '0.69314718055994530941723212145817656807550013436026');
  assert.equal(val('ln(10)'), '2.3025850929940456840179914546843642076011014886288');
  assert.equal(val('(1 + sqrt(5))/2'), '1.6180339887498948482045868343656381177203091798058');
});

test('elementary functions match reference values', () => {
  assert.equal(val('sin(1)'), '0.84147098480789650665250232163029899962256306079837');
  assert.equal(val('cos(1)'), '0.54030230586813971740093660744297660373231042061792');
  assert.equal(val('exp(100)', 30), '2.68811714181613544841262555158e43');
  assert.equal(val('exp(-50)', 30), '1.92874984796391778301734281653e-22');
  assert.equal(val('tanh(2)', 30), '0.964027580075816883946413724101');
  assert.equal(val('asinh(1)', 30), '0.88137358701954302523260932498');
  assert.equal(val('atanh(0.5)', 30), '0.549306144334054845697622618461');
  // identities that exercise argument reduction
  for (const src of ['4atan(1)', '2asin(1)', 'acos(-1)', '6asin(1/2)', '-4atan2(-1,-1)/3']) assert.equal(val(src, 100), PI100, src);
  assert.equal(val('exp(ln(7))'), '7');
  assert.equal(val('log10(1000)'), '3');
  assert.equal(val('log2(1024)'), '10');
  assert.equal(val('cos(pi/6)^2 + sin(pi/6)^2'), '1');
  assert.equal(val('tan(pi/4)'), '1');
});

test('no digits are lost to cancellation', () => {
  // ln(1 + x) ≈ x − x²/2 and sinh x ≈ x + x³/6 for tiny x
  assert.equal(val('ln(1 + 1e-30)'), '9.999999999999999999999999999995e-31');
  assert.equal(val('sinh(1e-20)'), '1.0000000000000000000000000000000000000000166666667e-20');
  assert.equal(val('sin(1e-30)'), '1e-30');
  // sin π and cos(π/2) are zero to working precision, not noise like 1e-60
  assert.equal(val('sin(pi)'), '0');
  assert.equal(val('cos(pi/2)'), '0');
});

test('rational arithmetic stays exact', () => {
  const x = ev('0.1 + 0.2');
  assert.ok(B.isExact(x));
  assert.equal(B.ratString(x), '3/10'); // the classic double-precision failure: 0.1 + 0.2 ≠ 0.3
  assert.equal(B.ratString(ev('1/3 + 1/6')), '1/2');
  assert.equal(B.ratString(ev('1e-20')), '1/100000000000000000000');
  assert.equal(B.ratString(ev('2^-3')), '1/8');
  assert.equal(B.ratString(ev('sqrt(9/4)')), '3/2');
  assert.equal(B.ratString(ev('cbrt(27)')), '3');
  assert.equal(B.ratString(ev('8^(2/3)')), '4');
  assert.equal(B.ratString(ev('(-8)^(1/3)')), '-2'.replace('-', '−'));
  assert.equal(B.ratString(ev('hypot(3, 4)')), '5');
  assert.equal(B.ratString(ev('mod(7, 3)')), '1');
  assert.ok(!B.isExact(ev('sqrt(2)')));
  // every double is a dyadic rational
  assert.equal(B.ratString(B.fromNumber(0.1)), '3602879701896397/36028797018963968');
  assert.equal(B.toNumber(ev('1/3')), 1 / 3);
});

test('domain errors are reported, not turned into NaN', () => {
  for (const src of ['ln(-1)', 'sqrt(-1)', 'asin(2)', '1/0', '0^-1', '(-2)^0.5']) {
    assert.throws(() => ev(src), B.DomainError, src);
  }
});

test('printing: positional and scientific notation, grouping', () => {
  assert.equal(B.toDecimal(ev('1/8'), 50), '0.125');
  assert.equal(B.toDecimal(ev('-1/3'), 10), '−0.3333333333');
  assert.equal(B.toDecimal(ev('1e-30'), 10), '1×10⁻³⁰');
  assert.equal(B.toDecimal(ev('1e-30'), 10, { ascii: true }), '1e-30');
  assert.equal(B.toDecimal(ev('pi'), 16, { group: 5 }), '3.14159 26535 89793');
});

test('square-free decomposition', () => {
  assert.deepEqual(squareFree(45n), [3n, 5n]);
  assert.deepEqual(squareFree(72n), [6n, 2n]);
  assert.deepEqual(squareFree(1n), [1n, 1n]);
  assert.deepEqual(squareFree(10007n ** 2n * 3n), [10007n, 3n]);
});

const M = (...src) => { const [a, b, c, d] = src.map((s) => ev(s)); return { a, b, c, d }; };

test('closed forms: Fibonacci matrix and the golden ratio', () => {
  const r = analyze(M('1', '1', '1', '0'), 50);
  assert.equal(r.exact, true);
  assert.equal(r.polyForm, 'λ² − λ − 1');
  assert.equal(r.eigForm, 'λ = (1 ± √5)/2');
  assert.equal(r.vecForm, 'v = (2, −1 ± √5)');
  assert.deepEqual(r.sigmaForm, ['(1 + √5)/2', '(√5 − 1)/2']);
  assert.equal(r.kappaForm, '(3 + √5)/2');
  assert.equal(dec(r.eig.values[0]), '1.6180339887498948482045868343656381177203091798058');
  assert.equal(dec(r.eig.values[1]), '-0.61803398874989484820458683436563811772030917980576');
  assert.deepEqual(r.inverseForm, ['0', '1', '1', '−1']);
});

test('closed forms: symmetric, shear, rotation, rational eigenvalues', () => {
  const s = analyze(M('2', '1', '1', '3'), 50);
  assert.equal(s.eigForm, 'λ = (5 ± √5)/2');
  assert.deepEqual(s.sigmaForm, ['(5 + √5)/2', '(5 − √5)/2']); // SPD: σ = λ
  assert.deepEqual(s.inverseForm, ['3/5', '−1/5', '−1/5', '2/5']);
  const sh = analyze(M('1', '1', '0', '1'), 50);
  assert.equal(sh.eig.kind, 'repeated');
  assert.equal(sh.eigForm, 'λ = 1（二重）');
  assert.equal(sh.vecForm, '(1, 0)（仅一条）');
  assert.deepEqual(sh.sigmaForm, ['(√5 + 1)/2', '(√5 − 1)/2']);
  const rot = analyze(M('0', '-1', '1', '0'), 50);
  assert.equal(rot.eigForm, 'λ = ±i');
  assert.equal(dec(rot.eig.angleDeg), '90');
  const q = analyze(M('1', '2', '3', '4'), 50);
  assert.equal(q.eigForm, 'λ = (5 ± √33)/2');
  assert.equal(q.kappaForm, '(15 + √221)/2');
  const d = analyze(M('2', '0', '0', '3'), 50);
  assert.equal(d.eigForm, 'λ₁ = 3, λ₂ = 2');
  assert.equal(d.vecForm, 'v₁ = (0, 1), v₂ = (1, 0)');
  const p = analyze(M('0.5', '0.5', '0.5', '0.5'), 50);
  assert.equal(p.rank, 1);
  assert.equal(p.vecForm, 'v₁ = (1, 1), v₂ = (1, −1)');
  assert.equal(p.kappa, null);
});

test('a nearly repeated eigenvalue that double precision gets wrong', () => {
  // [[1, 1], [1e-20, 1]] has λ = 1 ± 1e-10. In doubles 1 − 1e-20 rounds to 1, so det = 1,
  // the discriminant is 0 and the eigenvalue looks repeated.
  assert.equal(eigen({ a: 1, b: 1, c: 1e-20, d: 1 }).kind, 'repeated');
  const r = analyze(M('1', '1', '1e-20', '1'), 50);
  assert.equal(r.eig.kind, 'real');
  assert.equal(r.eigForm, 'λ₁ = 10000000001/10000000000, λ₂ = 9999999999/10000000000');
  assert.equal(dec(r.eig.values[0]), '1.0000000001');
  // near-singular: det = 1e-15 exactly, the small singular value computed without cancellation
  const n = analyze(M('1', '1', '1', '1 + 1e-15'), 50);
  assert.equal(dec(n.det), '1e-15');
  assert.equal(dec(n.sigma[1], 20), '4.9999999999999987500e-16'.replace(/0+e/, 'e'));
});

test('irrational entries: 50-digit approximations', () => {
  const r = analyze(M('cos(pi/6)', '-sin(pi/6)', 'sin(pi/6)', 'cos(pi/6)'), 50);
  assert.equal(r.exact, false);
  assert.equal(r.eigForm, undefined);
  assert.equal(dec(r.det), '1');
  assert.equal(r.eig.kind, 'complex');
  assert.equal(dec(r.eig.angleDeg), '30');
  assert.equal(dec(r.eig.re), '0.86602540378443864676372317075293618347140262690519');
});

test('exact matrix powers: Fibonacci numbers and fractions', () => {
  const fib = matPow(M('1', '1', '1', '0'), 100, 50);
  assert.equal(fib.exact, true);
  assert.deepEqual(fib.entries.map((x) => B.ratString(x)), ['573147844013817084101', '354224848179261915075', '354224848179261915075', '218922995834555169026']);
  // F(10000) has 2090 digits
  assert.equal(B.ndigits(matPow(M('1', '1', '1', '0'), 10000, 50).entries[1].n), 2090);
  // (1/2 I)^-3 = 8 I, and fractions come out in lowest terms
  assert.deepEqual(matPow(M('1/2', '0', '0', '1/2'), -3, 50).entries.map((x) => B.ratString(x)), ['8', '0', '0', '8']);
  const fr = matPow(M('3/4', '1/6', '0', '1'), 5, 50).entries;
  for (const x of fr) assert.equal(B.gcd(x.n, x.d), 1n);
  assert.equal(B.ratString(fr[0]), '243/1024');
  // irrational entries: R(30°)¹² = I, with rounding noise removed
  const rot = matPow(M('cos(pi/6)', '-sin(pi/6)', 'sin(pi/6)', 'cos(pi/6)'), 12, 50);
  assert.equal(rot.exact, false);
  assert.deepEqual(rot.entries.map((x) => dec(x)), ['1', '0', '0', '1']);
});
