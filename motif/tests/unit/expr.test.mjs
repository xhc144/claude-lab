import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExpr, checkExpr, fx } from '../../src/core/expr.js';

test('evaluates maths safely', () => {
  const f = fx('sin(x)^2 + cos(x)^2');
  for (const x of [0, 1, 2.5]) assert.ok(Math.abs(f(x) - 1) < 1e-9);
  assert.equal(fx('2x + 1')(3), 7);
  assert.ok(Math.abs(fx('sqrt(abs(x)) * pi')(4) - 2 * Math.PI) < 1e-9);
  assert.equal(compileExpr('a*x').fn({ a: 3, x: 2 }), 6);
});

test('rejects code injection and reports syntax errors', () => {
  assert.ok(checkExpr('constructor.constructor("return process")()'));
  assert.ok(checkExpr('x +* 2'));
  assert.equal(checkExpr('exp(-x/4)'), null);
});
