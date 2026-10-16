import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTex, splitTypedMath, topLevelShape } from '../src/core/math.js';
import { escapeText, escapeCode, escapeTextBreakingUrls } from '../src/core/latex/escape.js';
import { highlightCode } from '../src/core/latex/highlight.js';
import { Writer, finalize, fragmentAt } from '../src/core/latex/writer.js';
import { renderTex } from '../src/core/latex/document.js';
import { cjkFontTeX } from '../src/core/latex/fonts.js';

test('normalizeTex: display shapes', () => {
  assert.deepEqual(normalizeTex('a &= b \\\\ &= c', true), { tex: '\\begin{align*}\na &= b \\\\ &= c\n\\end{align*}', env: 'raw' });
  assert.equal(normalizeTex('a \\\\ b', true).tex, '\\begin{gather*}\na \\\\ b\n\\end{gather*}');
  assert.equal(normalizeTex('\\begin{align} x &= 1 \\end{align}', true).tex, '\\begin{align*} x &= 1 \\end{align*}');
  assert.equal(normalizeTex('\\begin{cases} 1 & 2 \\\\ 3 & 4 \\end{cases}', true).env, 'display');
  assert.equal(normalizeTex('x\n\n= 1', true).tex, 'x\n= 1', 'blank lines removed');
});

test('normalizeTex: inline repairs', () => {
  assert.equal(normalizeTex('a + b % comment', false).tex, 'a + b');
  assert.equal(normalizeTex('50\\% off', false).tex, '50\\% off');
  assert.equal(normalizeTex('#S', false).tex, '\\#S');
  assert.equal(normalizeTex('a \\\\ b', false).tex, 'a \\quad  b');
  assert.equal(normalizeTex('x \\tag{1}', false).tex, 'x ');
  assert.equal(normalizeTex('面积=\\pi r^2', false).tex, '\\text{面积}=\\pi r^2');
  assert.equal(normalizeTex('x=\\text{常数}', false).tex, 'x=\\text{常数}', 'no double wrap');
  assert.deepEqual(topLevelShape('\\begin{matrix} a & b \\\\ c \\end{matrix}'), { rows: false, tabs: false });
});

test('splitTypedMath: TeX the user typed, money left alone', () => {
  const s = splitTypedMath('求 $\\int_0^1 x\\,dx$，价格 $5 和 $10，还有 \\(a^2\\) 与 $$E=mc^2$$');
  const math = s.filter((x) => x.math !== undefined);
  assert.deepEqual(math.map((x) => [x.math, x.display]), [['\\int_0^1 x\\,dx', false], ['a^2', false], ['E=mc^2', true]]);
});

test('escapeText handles every TeX special and emoji', () => {
  assert.equal(escapeText('\\ { } $ & # % _ ^ ~'), '\\textbackslash{} \\{ \\} \\$ \\& \\# \\% \\_ \\textasciicircum{} \\textasciitilde{}');
  assert.equal(escapeText('好✅😀'), '好\\mtcheck{}');
  assert.equal(escapeText('好✅', { symbols: false }), '好');
  assert.equal(escapeText('a\u200bb\u00a0c'), 'ab~c');
  assert.match(escapeCode('a/b.c_d'), /a\/\\allowbreak\{\}b\.\\allowbreak\{\}c\\_\\allowbreak\{\}d/);
  assert.match(escapeTextBreakingUrls('见 https://x.cn/a_b'), /^见 https:\\allowbreak/);
});

test('highlightCode closes every group at the end of each line', () => {
  const out = highlightCode('"""doc\nstring"""\nx = {1: "a"}  # c', 'python');
  for (const line of out.split('\n')) {
    let depth = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\' && /[{}]/.test(line[i + 1] || '')) { i++; continue; }
      if (line[i] === '{') depth++;
      if (line[i] === '}') depth--;
    }
    assert.equal(depth, 0, `unbalanced line: ${line}`);
  }
  assert.ok(out.includes('\\mtLB{}') && out.includes('\\mtHLco{'));
});

test('fragment map points an error line at the right formula', () => {
  const w = new Writer({ headingCmds: ['section'], headingToc: false });
  const body = w.blocks([
    { t: 'para', inl: [{ t: 'text', v: '一' }, { t: 'math', tex: 'a' }, { t: 'text', v: '二' }, { t: 'math', tex: '\\bad' }] },
    { t: 'math', tex: 'x \\\\ y' },
  ], 'r');
  const { tex, map } = finalize(body, w.kinds);
  const lines = tex.split('\n');
  const badLine = lines.findIndex((l) => l.includes('\\bad')) + 1;
  assert.equal(fragmentAt(map, badLine).id, 'r.0.m1');
  const gather = lines.findIndex((l) => l.includes('gather*')) + 1;
  assert.equal(fragmentAt(map, gather).id, 'r.1');
  // The same ids come back after a fallback, and the bad formula turns into source text.
  const w2 = new Writer({ headingCmds: ['section'], headingToc: false }, new Set(['r.0.m1']));
  const again = finalize(w2.blocks([
    { t: 'para', inl: [{ t: 'text', v: '一' }, { t: 'math', tex: 'a' }, { t: 'text', v: '二' }, { t: 'math', tex: '\\bad' }] },
  ], 'r'), w2.kinds);
  assert.match(again.tex, /\\mtbadmath\{\\textbackslash\{\}bad\}/);
  assert.ok(again.map.some((f) => f.id === 'r.0.m1'));
});

test('font block is guarded so the .tex compiles elsewhere', () => {
  const tex = cjkFontTeX({ serif: { dir: 'C:/Windows/Fonts/', file: 'simsun.ttc', index: 0 }, serifBold: { dir: 'C:/Windows/Fonts/', file: 'simhei.ttf', index: 0 }, sans: null, kai: null, fang: null });
  // By family name first (Tectonic cannot open fonts by absolute path), then by file.
  assert.match(tex, /^\\IfFontExistsTF\{SimSun\}\{%\n {2}\\setCJKmainfont\{SimSun\}\[BoldFont=SimHei, AutoFakeSlant=0\.2\]/);
  assert.match(tex, /\\IfFileExists\{C:\/Windows\/Fonts\/simsun\.ttc\}/);
  assert.match(tex, /\\setCJKmainfont\{simsun\.ttc\}\[Path=C:\/Windows\/Fonts\/, FontIndex=0, BoldFont=simhei\.ttf/);
});

test('renderTex: both styles produce a complete document', () => {
  const conv = {
    title: '测试 #1', platformName: 'ChatGPT', assistantName: 'ChatGPT', url: 'https://chatgpt.com/c/x', date: new Date(2026, 9, 16),
    messages: [
      { role: 'user', blocks: [{ t: 'para', inl: [{ t: 'text', v: '[问题] $x^2$ 是什么' }] }] },
      { role: 'assistant', blocks: [{ t: 'heading', level: 2, inl: [{ t: 'text', v: '一、定义' }] }, { t: 'para', inl: [{ t: 'math', tex: 'x^2' }] }] },
    ],
  };
  for (const style of ['chat', 'notes']) {
    const r = renderTex(conv, { style, fonts: null });
    assert.match(r.tex, /\\begin\{document\}[\s\S]*\\end\{document\}\s*$/);
    assert.ok(!/[\u0001\u0002]/.test(r.tex), 'markers stripped');
    assert.ok(r.tex.includes('测试 \\#1'));
  }
  const notes = renderTex(conv, { style: 'notes', fonts: null }).tex;
  assert.match(notes, /\\documentclass\[nomargin, cjk=fandol\]\{mojing-notes\}/);
  assert.match(notes, /\\begin\{problem\}\\relax/);
  assert.match(notes, /\\section\*\{一、定义\}/, 'self-numbered headings stay unnumbered');
  const chat = renderTex(conv, { style: 'chat', fonts: null }).tex;
  assert.match(chat, /\{\}\[问题\]/, 'a leading [ is protected');
});
