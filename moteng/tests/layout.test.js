import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeLayout, prepareDocument, isLongInline, LAYOUT_DEFAULTS } from '../src/core/layout.js';
import { renderTex } from '../src/core/latex/document.js';
import { renderHtml, renderHtmlDocument } from '../src/core/html.js';
import { markdownToHtml, splitTranscript, conversationsFromJson } from '../src/core/markdown.js';
import { expandInputs } from '../src/core/load.js';
import { readConversation } from '../src/core/convert.js';

const FIX = path.resolve(import.meta.dirname, '../fixtures');

function conv(blocksA, question = 'Q') {
  return {
    title: 'T', platformName: 'ChatGPT', assistantName: 'ChatGPT', url: '', date: null,
    messages: [{ role: 'user', blocks: [{ t: 'para', inl: [{ t: 'text', v: question }] }] }, { role: 'assistant', blocks: blocksA }],
  };
}

const para = (...inl) => ({ t: 'para', inl });
const txt = (v) => ({ t: 'text', v });
const m = (tex) => ({ t: 'math', tex });

test('normalizeLayout: defaults, clamping and settings from 1.1', () => {
  const d = normalizeLayout({});
  assert.equal(d.theme, 'web');
  assert.equal(d.sizePt, 10.5);
  assert.equal(normalizeLayout({}, { fontSize: 'large' }).sizePt, 12, 'old 小四 setting carries over');
  assert.equal(normalizeLayout({ paper: 'b5' }).paper, 'b5');
  assert.equal(normalizeLayout({ lineSpread: 9 }).lineSpread, 2.4);
  assert.equal(normalizeLayout({ theme: 'nope' }).theme, 'web');
  assert.deepEqual(normalizeLayout({ margins: 'custom', marginMm: { top: 10, left: 80 } }).marginMm, { top: 10, bottom: 22, left: 60, right: 22 });
});

test('inline formula → display, by click and by rule', () => {
  const c = conv([para(txt('由 '), m('a+b'), txt(' 得到 '), m('\\frac{1}{2}\\sum_{k=1}^n k^2'), txt('。'))]);
  const base = prepareDocument(c, normalizeLayout({}), {});
  assert.equal(base.turns[0].answer.length, 1);
  const oid = base.turns[0].answer[0].inl[1].oid;
  assert.equal(oid, 't0.a.0.m0');
  // One formula by click.
  const one = prepareDocument(c, normalizeLayout({}), { math: { [oid]: 'display' } }).turns[0].answer;
  assert.deepEqual(one.map((b) => b.t), ['para', 'math', 'para']);
  assert.equal(one[1].tex, 'a+b');
  assert.equal(one[1].oid, oid, 'the displayed formula keeps its id, so the preview can turn it back');
  // Long formulas by rule.
  assert.ok(isLongInline('\\frac{1}{2}\\sum_{k=1}^n k^2'));
  const long = prepareDocument(c, normalizeLayout({ mathMode: 'long-display' }), {}).turns[0].answer;
  assert.deepEqual(long.map((b) => b.t), ['para', 'math', 'para']);
  assert.match(long[1].tex, /\\sum/);
  // Everything.
  const all = prepareDocument(c, normalizeLayout({ mathMode: 'all-display' }), {}).turns[0].answer;
  assert.equal(all.filter((b) => b.t === 'math').length, 2);
});

test('display formula → inline joins the sentence around it', () => {
  const c = conv([para(txt('令')), m('Y=TX'), para(txt('，于是方程变成'))]);
  const oid = prepareDocument(c, normalizeLayout({}), {}).turns[0].answer[1].oid;
  const r = prepareDocument(c, normalizeLayout({}), { math: { [oid]: 'inline' } }).turns[0].answer;
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].inl.map((x) => x.t), ['text', 'text', 'math', 'text']);
  assert.equal(r[0].inl[3].v, '，于是方程变成', 'no space before Chinese punctuation');
  // Multi-line displays stay displays under the "all inline" rule.
  const c2 = conv([para(txt('a')), m('a &= b \\\\ &= c')]);
  assert.equal(prepareDocument(c2, normalizeLayout({ mathMode: 'all-inline' }), {}).turns[0].answer[1].t, 'math');
});

test('heading level, hide, page break and image width overrides', () => {
  const c = conv([{ t: 'heading', level: 2, inl: [txt('一、结论')] }, para(txt('正文')), { t: 'image', src: 'x.png', alt: '' }, para(txt('去掉'))]);
  const ids = prepareDocument(c, normalizeLayout({}), {}).turns[0].answer.map((b) => b.oid);
  const r = prepareDocument(c, normalizeLayout({}), { heading: { [ids[0]]: 0 }, breakBefore: { [ids[1]]: true }, image: { [ids[2]]: 0.5 }, hide: { [ids[3]]: true } }).turns[0].answer;
  assert.equal(r.length, 3);
  assert.equal(r[0].t, 'para', 'heading demoted to a bold paragraph');
  assert.ok(r[1].breakBefore);
  assert.equal(r[2].width, 0.5);
});

test('TeX follows the layout: paper, margins, sizes, fonts, numbering, breaks', () => {
  const c = conv([{ t: 'heading', level: 2, inl: [txt('结论')] }, para(txt('令')), m('x^2'), { t: 'image', src: 'a', alt: '', file: 'images/a.png' }]);
  const tex = renderTex(c, { style: 'chat', layout: { paper: 'b5', margins: 'custom', marginMm: { top: 15, bottom: 16, left: 17, right: 18 }, sizePt: 11, eqNumbers: 'all', headingNumbers: 'chinese', cjkFont: 'kai', latinFont: 'lm', mathFont: 'fira', questionNewPage: true, imageWidth: 0.6, accent: 'teal' }, fonts: null }).tex;
  assert.match(tex, /b5paper/);
  assert.match(tex, /top=15mm, bottom=16mm, left=17mm, right=18mm/);
  assert.match(tex, /\\changefontsizes\[14\.30pt\]\{11\.00pt\}/);
  assert.match(tex, /FandolKai-Regular\.otf/, 'kai body font (TeX-bundled when no system fonts)');
  assert.match(tex, /lmroman10/);
  assert.match(tex, /FiraMath-Regular\.otf/);
  assert.match(tex, /\\begin\{equation\}\nx\^2\n\\end\{equation\}/);
  assert.match(tex, /number=\\chinese\{subsection\}/);
  assert.match(tex, /accent=0F766E/);
  assert.match(tex, /\\mtimage\[max width=0\.600\\linewidth\]/);
  // The formula introduced by "令" stays in its paragraph (no blank line before the display).
  assert.match(tex, /令\n(\u0001|[^\n])*\n?\\begin\{equation\}/u);
  const t2 = renderTex(conv([para(txt('a'))]), { style: 'chat', layout: { theme: 'print', questionStyle: 'box', pageNumbers: false, runningHeader: false }, fonts: null }).tex;
  assert.match(t2, /\\begin\{mtquestion\}/);
  assert.match(t2, /STIXTwoText/);
  assert.doesNotMatch(t2, /\\thepage/);
});

test('HTML preview carries ids for every formula, heading and image', () => {
  const c = conv([{ t: 'heading', level: 2, inl: [txt('结论')] }, para(txt('有 '), m('x^2'), txt('。')), m('\\int_0^1 f'), { t: 'image', src: 'a', alt: '', file: 'images/a.png' }]);
  const r = renderHtml(c, { layout: { eqNumbers: 'all' }, imageUrl: (f) => `file:///w/${f}` });
  assert.match(r.html, /<span class="mt-m" data-oid="t0\.a\.1\.m0" data-tex="x\^2">/);
  assert.match(r.html, /class="mt-dm" data-oid="t0\.a\.2"/);
  assert.match(r.html, /class="katex/);
  assert.match(r.html, /<span class="mt-eqno">\(1\)<\/span>/);
  assert.match(r.html, /file:\/\/\/w\/images\/a\.png/);
  assert.match(r.html, /class="mt-h mt-h1" data-oid="t0\.a\.0"/);
  assert.equal(r.stats.inlineMath, 1);
  const doc = renderHtmlDocument(c, { imageUrl: (f) => f });
  assert.match(doc, /font-family:KaTeX_Main;[^}]*src:url\(data:font\/woff2;base64,/, 'KaTeX fonts are inlined');
  assert.match(doc, /data-act="copy"|mt-m/);
});

test('Markdown: formulas, code protected, transcripts split by speaker', () => {
  const html = markdownToHtml('设 $x^2$ 与 \\(y\\)，价格 $5 和 $10。\n\n$$E=mc^2$$\n\n```js\nconst a = "$b$";\n```');
  assert.match(html, /data-latex="x\^2"/);
  assert.match(html, /data-latex="y"/);
  assert.match(html, /class="math-block" data-math="E=mc\^2"/);
  assert.match(html, /价格 \$5 和 \$10/);
  assert.match(html, /const a = &quot;\$b\$&quot;/);
  const t = splitTranscript('# 标题\n\n## Prompt:\n问题一\n\n## Response:\n回答一\n\n**User:**\n问题二\n\n**ChatGPT:**\n回答二');
  assert.deepEqual(t.messages.map((x) => x.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(t.messages[3].text, '回答二');
  assert.equal(splitTranscript('只是一段回答，没有说话人。'), null);
});

test('JSON exports: ChatGPT mapping (current branch only), Claude, plain lists', () => {
  const gpt = [{
    title: '对话', create_time: 1760000000, current_node: 'c',
    mapping: {
      r: { message: null, parent: null, children: ['a'] },
      a: { parent: 'r', children: ['b', 'x'], message: { author: { role: 'user' }, content: { content_type: 'text', parts: ['问'] } } },
      x: { parent: 'a', children: [], message: { author: { role: 'assistant' }, recipient: 'all', content: { content_type: 'text', parts: ['被重新生成掉的回答'] } } },
      b: { parent: 'a', children: ['c'], message: { author: { role: 'assistant' }, recipient: 'python', content: { content_type: 'code', text: 'print(1)' } } },
      c: { parent: 'b', children: [], message: { author: { role: 'assistant' }, recipient: 'all', content: { content_type: 'text', parts: ['答 \\(x\\)\ue200cite\ue202turn0\ue201'] } } },
    },
  }];
  const r = conversationsFromJson(JSON.stringify(gpt));
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].messages, [{ role: 'user', text: '问' }, { role: 'assistant', text: '答 \\(x\\)\ue200cite\ue202turn0\ue201' }]);
  const claude = conversationsFromJson(JSON.stringify([{ name: 'C', chat_messages: [{ sender: 'human', text: 'hi' }, { sender: 'assistant', content: [{ type: 'text', text: 'hello' }] }] }]));
  assert.equal(claude[0].platformName, 'Claude（导出数据）');
  assert.equal(conversationsFromJson('[{"role":"user","content":"a"},{"role":"assistant","content":"b"}]')[0].messages.length, 2);
});

test('folders expand into one entry per conversation; _files folders and helper pages are skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-expand-'));
  fs.copyFileSync(path.join(FIX, 'selftest/chatgpt-2026.html'), path.join(dir, '一.html'));
  fs.mkdirSync(path.join(dir, '一_files'));
  fs.writeFileSync(path.join(dir, '一_files', 'runner.html'), '<html></html>');
  fs.writeFileSync(path.join(dir, '一_files', 'page.html'), '<html></html>');
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'sub', '笔记.md'), '## Prompt:\n问\n## Response:\n答 $x$');
  fs.writeFileSync(path.join(dir, 'sub', 'conversations.json'), JSON.stringify([{ title: 'A', mapping: { a: { parent: null, children: [], message: { author: { role: 'user' }, content: { content_type: 'text', parts: ['q'] } } } } }, { title: 'B', mapping: { a: { parent: null, children: [], message: { author: { role: 'user' }, content: { content_type: 'text', parts: ['q'] } } } } }]));
  const items = expandInputs([dir]);
  assert.deepEqual(items.map((i) => i.name).sort(), ['A', 'B', '一.html', '笔记.md'].sort());
  assert.deepEqual(items.filter((i) => i.index !== undefined).map((i) => i.index), [0, 1]);
  // A single file stays a single entry; a _files folder points to its page.
  assert.equal(expandInputs([path.join(dir, '一.html')]).length, 1);
  assert.equal(expandInputs([path.join(dir, '一_files')])[0].path, path.join(dir, '一.html'));
  const md = readConversation(path.join(dir, 'sub', '笔记.md')).conv;
  assert.deepEqual(md.messages.map((x) => x.role), ['user', 'assistant']);
  assert.equal(readConversation({ path: path.join(dir, 'sub', 'conversations.json'), index: 1 }).conv.title, 'B');
});

test('ChatGPT DIL page: chart and widget are marked for capture; data: SVG diagrams resolve', () => {
  const { conv: c, loaded } = readConversation(path.join(FIX, 'selftest/chatgpt-dil.html'));
  const blocks = c.messages[1].blocks;
  const chart = blocks.find((b) => b.t === 'dynamic' && b.kind === 'chart');
  assert.ok(chart && chart.dyn && /recharts-surface/.test(chart.svg));
  assert.match(chart.title, /N = 2、N = 5、N = 10/);
  const widget = blocks.find((b) => b.t === 'note' && b.kind === 'widget');
  assert.ok(widget.dyn);
  assert.match(c.annotatedHtml, new RegExp(`data-moteng-dyn="${chart.dyn}"`));
  assert.match(c.annotatedHtml, /data-moteng-role="user"/);
  const img = blocks.find((b) => b.t === 'image');
  const res = loaded.resolve(img.src);
  assert.ok(res && /<svg/.test(Buffer.from(res.bytes).toString('utf8')), 'data:image/svg+xml;charset=utf-8,… decodes');
  // The hidden DIL execution frame is not content.
  assert.ok(!blocks.some((b) => b.kind === 'iframe'));
});

test('a zip of only the _files folder says where the conversation is', async () => {
  const { zipSync, strToU8 } = await import('fflate');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-zip-'));
  const z = path.join(dir, '对话_files.zip');
  fs.writeFileSync(z, zipSync({ '对话_files/runner.html': strToU8('<html><body></body></html>'), '对话_files/a.css': strToU8('a{}') }));
  assert.throws(() => readConversation(z), /附属文件.*同名的 \.html/);
  assert.equal(typeof LAYOUT_DEFAULTS.theme, 'string');
});
