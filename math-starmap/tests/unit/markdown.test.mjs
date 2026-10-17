// The Markdown dialect of the knowledge base: math placeholders, wiki links, callouts, tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, plainText } from '../../scripts/lib/markdown.mjs';
import { parseContentFile, splitBody } from '../../scripts/lib/kb.mjs';

test('inline and display math are kept verbatim for KaTeX', () => {
  const { html, math } = compile('设 $f(x)=x^2<1$。\n\n$$\\int_0^1 x\\,dx=\\tfrac12$$');
  assert.match(html, /<span class="m">f\(x\)=x\^2&lt;1<\/span>/);
  assert.match(html, /<div class="mb">\\int_0\^1 x\\,dx=\\tfrac12<\/div>/);
  assert.deepEqual(math.map((m) => m.display), [false, true]);
});

test('display math inside a paragraph becomes its own block', () => {
  const { html } = compile('由此得到$$a=b$$');
  assert.doesNotMatch(html, /<p>[^<]*<div class="mb">/);
});

test('wiki links resolve titles and are collected', () => {
  const { html, links } = compile('见 [[derivative|导数]] 与 [[limit]]。', { title: (id) => (id === 'limit' ? '极限' : id) });
  assert.match(html, /<a class="wl" href="#\/n\/derivative" data-id="derivative">导数<\/a>/);
  assert.match(html, />极限<\/a>/);
  assert.deepEqual(links, ['derivative', 'limit']);
});

test('callouts, lists, headings and tables', () => {
  const { html } = compile('> [!定理] 罗尔\n> 内容 **加粗**\n\n- 一\n- 二\n\n#### 小标题\n\n| a | b |\n|---|---|\n| 1 | 2 |');
  assert.match(html, /<div class="callout c-thm"><div class="ct"><b>定理<\/b> <span class="ct-t">罗尔<\/span><\/div><p>内容 <strong>加粗<\/strong><\/p><\/div>/);
  assert.match(html, /<ul><li>一<\/li><li>二<\/li><\/ul>/);
  assert.match(html, /<h4>小标题<\/h4>/);
  assert.match(html, /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
});

test('HTML in the source is escaped', () => {
  const { html } = compile('<script>alert(1)</script> & 1<2');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('plain text for search drops math and markup', () => {
  assert.equal(plainText('设 $x$ 见 [[a|甲]] **b**'), '设 见 甲 b');
});

test('node files: front matter, metadata lines and sections', () => {
  const text = [
    '---', 'galaxy: hs', 'cluster: demo', 'title: 演示', 'order: 1', 'level: hs', '---', '',
    '## 导数 {#derivative}', 'type: 定义 | en: Derivative | w: 5', '前置: function, limit', '',
    '函数在一点的变化率。', '', '### 证明', '略。', '',
    '## 切线 {#tangent-line}', 'type: 方法', '', '切线方程。', '',
  ].join('\n');
  const { cluster, nodes } = parseContentFile(text, 'demo.md');
  assert.equal(cluster.id, 'demo');
  assert.deepEqual(nodes.map((n) => n.id), ['derivative', 'tangent-line']);
  assert.equal(nodes[0].meta.en, 'Derivative');
  assert.equal(nodes[0].meta['前置'], 'function, limit');
  const { summary, sections } = splitBody(nodes[0].body);
  assert.equal(summary, '函数在一点的变化率。');
  assert.equal(sections[0][0], 'proof');
});

test('a heading without an id is an error', () => {
  assert.throws(() => parseContentFile('---\ngalaxy: hs\ncluster: x\ntitle: x\n---\n\n## 没有 id\n', 'x.md'), /needs an id/);
});
