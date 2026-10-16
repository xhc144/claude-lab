import test from 'node:test';
import assert from 'node:assert/strict';
import { TextEngine, parseRich } from '../../src/engine/text/text.js';
import { fakeCtx } from './helpers.mjs';

const te = new TextEngine(fakeCtx());
const role = { family: ['x'], weight: 700 };
const lines = (t, w, o = { balance: true }) => te.layout(t, role, 20, { maxWidth: w, ...o }).lines.map((l) => l.units.map((u) => u.t).join(''));

test('numbers stay with their units', () => {
  for (const [t, w] of [['内测企业 18 个月增长 9 倍', 220], ['延迟从 26 小时降到 3 秒', 200]]) {
    const ls = lines(t, w);
    assert.ok(!ls.some((l, i) => i > 0 && /^(个月|月|小时|倍|秒)/.test(l)), ls.join(' / '));
  }
});

test('balanced headings prefer breaking at punctuation', () => {
  assert.deepEqual(lines('确定的方程，不可预测的运动', 145), ['确定的方程，', '不可预测的运动']);
});

test('kinsoku: no line starts with closing punctuation', () => {
  for (let w = 60; w < 260; w += 13) {
    const ls = lines('第一，我们做了产品。第二，我们做了市场！第三：用户。', w, {});
    assert.ok(ls.every((l) => !/^[，。！：、]/.test(l)), ls.join(' / '));
  }
});

test('fit shrinks to the box and reports overflow', () => {
  const L = te.fit('一二三四五六七八九十', role, { maxWidth: 100, maxLines: 1, min: 6, max: 40 });
  assert.ok(L.width <= 100.5 && L.lines.length === 1);
  const O = te.fit('一二三四五六七八九十一二三四五', role, { maxWidth: 50, maxLines: 1, min: 12, max: 40 });
  assert.equal(O.overflow, true);
});

test('rich text markup', () => {
  const runs = parseRich('普通 **加粗** ==强调== *斜体*');
  assert.ok(runs.some((r) => r.b && r.text === '加粗'));
  assert.ok(runs.some((r) => r.accent && r.text === '强调'));
  assert.ok(runs.some((r) => r.i && r.text === '斜体'));
});

test('inline TeX is lifted out of rich text', () => {
  const runs = parseRich('函数 $f(x)=x^2$ 和 **重点 $\\nabla f$** 与 \\(a\\neq b\\)');
  assert.deepEqual(runs.filter((r) => r.math).map((r) => r.text), ['f(x)=x^2', '\\nabla f', 'a\\neq b']);
  assert.ok(runs.find((r) => r.text === '\\nabla f').b, 'markup around a formula still applies');
  // "\n" means a line break in text, but never inside TeX (\nabla, \neq, \nu)
  assert.ok(!runs.some((r) => r.text.includes('\n')));
});

test('dollar amounts are not formulas', () => {
  for (const s of ['价格从 $5 涨到 $10', '$5–$10 区间', 'costs $3.50 or $4']) assert.ok(!parseRich(s).some((r) => r.math), s);
  assert.ok(parseRich('代码 `$x$` 原样').some((r) => r.code && r.text === '$x$'));
});

test('a formula is one unbreakable unit; without a DOM it falls back to its source', () => {
  const L = te.layout('设 $a^2+b^2=c^2$ 成立', role, 20, { maxWidth: 1000 });
  const units = L.lines.flatMap((l) => l.units);
  assert.ok(units.some((u) => u.t === '$a^2+b^2=c^2$'), units.map((u) => u.t).join('|'));
});
