import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { zipSync, strToU8 } from 'fflate';
import { loadInput, loadHtmlString } from '../src/core/load.js';
import { extractConversation } from '../src/core/extract.js';

const FIX = path.resolve(import.meta.dirname, '../fixtures');

function conv(file, opts) {
  return extractConversation(loadInput(path.join(FIX, file)), opts);
}

function all(blocks, pred, out = []) {
  for (const b of blocks) {
    if (pred(b)) out.push(b);
    if (b.items) b.items.forEach((it) => all(it, pred, out));
    if (b.blocks) all(b.blocks, pred, out);
  }
  return out;
}

function inlineMath(blocks) {
  const out = [];
  const walk = (inl) => inl.forEach((x) => { if (x.t === 'math') out.push(x.tex); if (x.c) walk(x.c); });
  all(blocks, (b) => !!b.inl).forEach((b) => walk(b.inl));
  all(blocks, (b) => b.t === 'table').forEach((t) => t.rows.forEach((r) => r.cells.forEach(walk)));
  return out;
}

test('ChatGPT 2026 page: roles, title, math, code, table, widget', () => {
  const c = conv('selftest/chatgpt-2026.html');
  assert.equal(c.platform, 'chatgpt');
  assert.equal(c.title, '求解上三角方程 O(n²)');
  assert.deepEqual(c.messages.map((m) => m.role), ['user', 'assistant']);
  const a = c.messages[1].blocks;
  const display = all(a, (b) => b.t === 'math').map((b) => b.tex);
  assert.ok(display.some((t) => t.includes('\\boxed{y_i=t_{ii}x_i+u_i}')));
  assert.ok(display.some((t) => t.startsWith('\\begin{cases}')));
  assert.ok(inlineMath(a).includes('O(n^3)'));
  const code = all(a, (b) => b.t === 'code');
  assert.equal(code.length, 1);
  assert.equal(code[0].lang, 'python');
  assert.match(code[0].text, /^def solve\(S, T, b\):\n {4}n = len\(b\)/);
  assert.ok(!/运行|复制/.test(code[0].text));
  const table = all(a, (b) => b.t === 'table' && !b.grid)[0];
  assert.equal(table.rows.length, 4);
  assert.ok(table.rows[0].header);
  const widgets = all(a, (b) => b.t === 'note' && b.kind === 'widget');
  assert.equal(widgets.length, 2);
  // Buttons of the widget never reach the text.
  assert.ok(!JSON.stringify(widgets).includes('下一步'));
  const headings = all(a, (b) => b.t === 'heading').map((h) => h.inl.map((x) => x.v || x.tex).join(''));
  assert.deepEqual(headings.slice(0, 2), ['一、为什么直接计算不行？', '二、怎么想到 O(n^2) 的算法？']);
});

test('user prompt keeps its line breaks', () => {
  const c = conv('selftest/chatgpt-2026.html');
  const para = c.messages[0].blocks[0];
  assert.equal(para.t, 'para');
  assert.ok(para.inl.filter((x) => x.t === 'br').length >= 3);
});

test('DeepSeek-shaped edge cases: thinking, code labels, math sources', () => {
  const c = conv('selftest/edge-cases.html');
  assert.equal(c.platform, 'deepseek');
  assert.equal(c.title, '排版压力测试');
  assert.deepEqual(c.messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
  const a1 = c.messages[1].blocks;
  assert.equal(all(a1, (b) => b.t === 'note').length, 0, 'thinking is left out by default');
  const m = inlineMath(a1);
  assert.ok(m.includes('e^{i \\pi} + 1 = 0'), 'MathML without TeX is converted: ' + m.join(' | '));
  assert.ok(m.includes('\\int_0^1 x^2\\,dx = \\tfrac13'), 'Gemini data-math');
  const withThinking = conv('selftest/edge-cases.html', { includeThinking: true });
  const notes = all(withThinking.messages[1].blocks, (b) => b.t === 'note' && b.kind === 'thinking');
  assert.equal(notes.length, 1);
  const codes = all(c.messages[3].blocks, (b) => b.t === 'code');
  assert.deepEqual(codes.map((x) => x.lang), ['bash', 'javascript', '']);
  assert.ok(codes[1].text.includes('\treturn'), 'tabs survive');
  const lists = all(c.messages[3].blocks, (b) => b.t === 'list');
  assert.equal(lists[0].start, 3);
  const images = all(c.messages[3].blocks, (b) => b.t === 'image');
  assert.equal(images.length, 2);
});

const THIRD = [
  ['chatgpt-dom-5question-ans-pairs.html', 'chatgpt', 10],
  ['claude-codeblock-larger-dom.html', 'claude', 1],
  ['gemini-dom.html', 'gemini', 6],
  ['grok-dom-5question-ans-pairs.html', 'grok', 10],
  ['copilot-dom-2question-ans-pairs.html', 'copilot', 4],
];
for (const [file, platform, count] of THIRD) {
  test(`third-party DOM sample: ${file}`, () => {
    const c = conv(`third-party/${file}`);
    assert.equal(c.platform, platform);
    assert.equal(c.messages.length, count);
    if (count > 1) assert.equal(c.messages[0].role, 'user');
    for (let i = 1; i < c.messages.length; i++) assert.notEqual(c.messages[i].role, c.messages[i - 1].role);
  });
}

test('Copilot code card header becomes the language', () => {
  const c = conv('third-party/copilot-dom-2question-ans-pairs.html');
  const codes = all(c.messages[3].blocks, (b) => b.t === 'code');
  assert.equal(codes[0].lang, 'python');
  assert.ok(!all(c.messages[3].blocks, (b) => b.t === 'para').some((p) => p.inl.length === 1 && /^python$/i.test(p.inl[0].v || '')));
});

test('clipboard fragment without a page around it', () => {
  const html = '<p>答案是 <span class="katex"><span class="katex-mathml"><math><semantics><mrow></mrow><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span></span>。</p><pre><code class="language-python">print(1)</code></pre>';
  const c = extractConversation(loadHtmlString(html));
  assert.equal(c.messages.length, 1);
  assert.equal(c.messages[0].blocks[0].inl[1].tex, 'x^2');
  assert.equal(c.messages[0].blocks[1].lang, 'python');
});

test('zip with #Uxxxx names and a nested _files folder', () => {
  const page = fs.readFileSync(path.join(FIX, 'selftest/chatgpt-2026.html'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-test-'));
  const zipPath = path.join(tmp, 'saved.zip');
  const name = '#U6c42#U89e3 O(n#U00b2)';
  fs.writeFileSync(zipPath, zipSync({
    [`${name}_files/${name}.html`]: new Uint8Array(page),
    [`${name}_files/frame.html`]: strToU8('<html><body>frame</body></html>'),
    [`${name}_files/a.css`]: strToU8('body{}'),
  }));
  const loaded = loadInput(zipPath);
  assert.equal(loaded.name, '求解 O(n²)');
  const c = extractConversation(loaded);
  assert.equal(c.messages.length, 2);
});

test('MHTML (quoted-printable) with an embedded image part', () => {
  const html = '<html><head><title>MHTML 测试 - Claude</title></head><body><div data-testid=3D"user-message"><p>问题</p></div><div class=3D"font-claude-response"><div class=3D"standard-markdown"><p>回答 <img src=3D"https://x.test/i.png" alt=3D"图"></p></div></div></body></html>';
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex').toString('base64');
  const m = [
    'From: <Saved by Blink>',
    'Snapshot-Content-Location: https://claude.ai/chat/abc',
    'Subject: =?utf-8?Q?MHTML_=E6=B5=8B=E8=AF=95?=',
    'Date: Thu, 15 Oct 2026 10:00:00 +0800',
    'MIME-Version: 1.0',
    'Content-Type: multipart/related;',
    '\ttype="text/html";',
    '\tboundary="----MultipartBoundary--abc----"',
    '',
    '',
    '------MultipartBoundary--abc----',
    'Content-Type: text/html',
    'Content-ID: <frame-1@mhtml.blink>',
    'Content-Transfer-Encoding: quoted-printable',
    'Content-Location: https://claude.ai/chat/abc',
    '',
    Buffer.from(html, 'utf8').toString('latin1').replace(/[\u0080-ÿ]/g, (ch) => '=' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')),
    '',
    '------MultipartBoundary--abc----',
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    'Content-Location: https://x.test/i.png',
    '',
    png,
    '',
    '------MultipartBoundary--abc------',
    '',
  ].join('\r\n');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-test-'));
  const file = path.join(tmp, 'page.mhtml');
  fs.writeFileSync(file, Buffer.from(m, 'latin1'));
  const loaded = loadInput(file);
  assert.equal(loaded.url, 'https://claude.ai/chat/abc');
  const c = extractConversation(loaded);
  assert.equal(c.platform, 'claude');
  assert.equal(c.title, 'MHTML 测试');
  assert.deepEqual(c.messages.map((x) => x.role), ['user', 'assistant']);
  const img = loaded.resolve('https://x.test/i.png');
  assert.ok(img && img.bytes[0] === 0x89);
});

test('unknown site falls back to markdown roots', () => {
  const html = '<html><head><title>某个新网站</title></head><body><nav><div class="markdown">侧栏</div></nav><main><div class="user-message">你好</div><div class="markdown-body"><p>你好！</p></div></main></body></html>';
  const c = extractConversation(loadHtmlString(html, { name: 'x' }));
  assert.equal(c.generic, true);
  assert.deepEqual(c.messages.map((m) => m.role), ['user', 'assistant']);
});
