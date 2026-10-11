import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse, tokenize, realFunction, evalConstant, complexFunction, realContext, ExprError, variablesOf,
} from '../../src/core/expr.js';

const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test('operator precedence and associativity', () => {
  const cases = {
    '1+2*3': 7,
    '(1+2)*3': 9,
    '2^3^2': 512, // right associative
    '-2^2': -4, // unary minus binds looser than ^
    '2^-1': 0.5,
    '-(3)': -3,
    '8/4/2': 1, // left associative
    '10-4-3': 3,
    '2**10': 1024,
    '+5': 5,
    '--2': 2,
    '1e3 + 2.5e-1': 1000.25,
    '.5 + 0.25': 0.75,
    '3²': 9,
    '2³': 8,
    '6 × 7 − 2 ÷ 4': 41.5,
  };
  for (const [src, want] of Object.entries(cases)) close(evalConstant(src), want);
});

test('constants and functions', () => {
  close(evalConstant('pi'), Math.PI);
  close(evalConstant('π/2'), Math.PI / 2);
  close(evalConstant('e'), Math.E);
  close(evalConstant('sqrt(2)/2'), Math.SQRT1_2);
  close(evalConstant('cos(pi/3)'), 0.5);
  close(evalConstant('atan2(1, 1)'), Math.PI / 4);
  close(evalConstant('atan(1, -1)'), (3 * Math.PI) / 4);
  close(evalConstant('mod(-1, 3)'), 2);
  close(evalConstant('|-3| + abs(-4)'), 7);
  close(evalConstant('max(2, 7) - min(2, 7)'), 5);
  close(evalConstant('ln(e^2)'), 2);
  close(evalConstant('sec(0) + cot(pi/4)'), 2);
});

test('implicit multiplication', () => {
  const f = realFunction('2x + 3(y + 1) + x y + xy', ['x', 'y']);
  close(f(2, 5), 4 + 18 + 10 + 10);
  const g = realFunction('2 sin(x) cos(x)', ['x']);
  close(g(0.7), Math.sin(1.4));
  const h = realFunction('(x+1)(x-1)', ['x']);
  close(h(3), 8);
  // implicit product binds tighter than a following ^ only on its right factor: 2x^2 = 2·(x²)
  close(realFunction('2x^2', ['x'])(3), 18);
  close(realFunction('-x^2', ['x'])(3), -9);
});

test('variables, parameters and variablesOf', () => {
  const f = realFunction('a*x - b*x*y', ['x', 'y', 't', 'a', 'b', 'c', 'd']);
  close(f(2, 3, 0, 1.5, 0.5), 3 - 3);
  assert.deepEqual([...f.vars].sort(), ['a', 'b', 'x', 'y']);
  const ast = parse('sin(t) + z', realContext(['t', 'z']));
  assert.deepEqual([...variablesOf(ast)].sort(), ['t', 'z']);
});

test('helpful errors with positions', () => {
  const bad = [
    ['', '表达式为空'],
    ['1+', '不完整'],
    ['(1+2', '缺少右括号'],
    ['1+2)', '多余的右括号'],
    ['sin x', '需要括号'],
    ['foo(1)', '未知符号'],
    ['2 $ 3', '无法识别的字符'],
    ['atan2(1)', '参数'],
    ['|x', '配对'],
    ['()', '括号内缺少表达式'],
  ];
  for (const [src, msg] of bad) {
    assert.throws(() => realFunction(src, ['x']), (err) => {
      assert.ok(err instanceof ExprError, `${src}: not an ExprError`);
      assert.ok(err.message.includes(msg), `${src}: "${err.message}" lacks "${msg}"`);
      assert.ok(err.pos >= 0 && err.pos <= src.length);
      return true;
    });
  }
  // error position points at the offending token
  try { realFunction('x + qq', ['x']); } catch (e) { assert.equal(e.pos, 4); assert.equal(e.len, 2); }
});

test('tokenizer handles unicode operators and scientific notation', () => {
  const kinds = tokenize('2e-3·x − π').map((t) => t.t);
  assert.deepEqual(kinds, ['num', '*', 'id', '-', 'id', 'eof']);
  // "2e" followed by a letter is 2·e, not a malformed exponent
  close(evalConstant('2e'), 2 * Math.E);
});

test('compiled code cannot reach globals', () => {
  // identifiers are whitelisted, so names like constructor/alert are rejected at parse time
  assert.throws(() => realFunction('constructor', ['x']), ExprError);
  assert.throws(() => realFunction('alert(1)', ['x']), ExprError);
  assert.throws(() => complexFunction('process'), ExprError);
});

test('complex functions: compiled f(z) agrees with closed forms', () => {
  const out = new Float64Array(2);
  const ev = (src, zr, zi, ar = 0, ai = 0) => {
    const { fn } = complexFunction(src);
    fn(zr, zi, ar, ai, out);
    return [out[0], out[1]];
  };
  const cl = (got, want, tol = 1e-12) => { close(got[0], want[0], tol); close(got[1], want[1], tol); };
  cl(ev('z^2', 1, 2), [-3, 4]);
  cl(ev('z*z*z - 1', 0, 1), [-1, -1]);
  cl(ev('1/z', 0, 2), [0, -0.5]);
  cl(ev('(z-1)/(z+1)', 0, 1), [0, 1]);
  cl(ev('exp(i*pi)', 0, 0), [-1, 0]);
  cl(ev('i^i', 0, 0), [Math.exp(-Math.PI / 2), 0]);
  cl(ev('sqrt(-4)', 0, 0), [0, 2]);
  cl(ev('log(-1)', 0, 0), [0, Math.PI]);
  cl(ev('z + a', 1, 1, 2, -3), [3, -2]);
  cl(ev('x - i y', 3, 4), [3, -4]); // conj via real/imag parts
  cl(ev('conj(z)', 3, 4), [3, -4]);
  cl(ev('abs(z) + arg(z) i', 3, 4), [5, Math.atan2(4, 3)]);
  cl(ev('re(z) + im(z)', 3, 4), [7, 0]);
  cl(ev('z^-2', 0, 1), [-1, 0]);
  cl(ev('z^0.5', -4, 0), [0, 2]);
  cl(ev('2^z', 3, 0), [8, 0]);
  cl(ev('pow(z, 3)', 1, 1), [-2, 2]);
  cl(ev('-z', 1, 2), [-1, -2]);
  cl(ev('3-4i', 0, 0), [3, -4]);
});

test('complex: analytic hint', () => {
  assert.equal(complexFunction('sin(z)/z').analytic, true);
  assert.equal(complexFunction('conj(z)').analytic, false);
  assert.equal(complexFunction('x^2 - y^2').analytic, false);
  assert.equal(complexFunction('z + a').usesParam, true);
});
