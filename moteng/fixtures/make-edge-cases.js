// Generates fixtures/selftest/edge-cases.html: a DeepSeek-shaped page that packs
// the constructs most likely to break a TeX run. Run: node fixtures/make-edge-cases.js
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const K = (tex) => `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow></mrow><annotation encoding="application/x-tex">${esc(tex)}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base">⋯</span></span></span>`;
const KD = (tex) => `<span class="katex-display">${K(tex)}</span>`;

function png(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3;
    raw[o] = Math.round(40 + 180 * x / w); raw[o + 1] = Math.round(80 + 120 * y / h); raw[o + 2] = 200;
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const user = (text) => `<div class="ds-message _9663006" data-nav-id="1"><div class="fbb737a4">${esc(text)}</div></div>`;
const bot = (html, think = '') => `<div class="ds-message _4f9bf79">${think ? `<div class="ds-think-content"><div class="ds-markdown"><p>${think}</p></div></div>` : ''}<div class="ds-markdown">${html}</div><div class="ds-message-feedback-container"><button>复制</button></div></div>`;

const answer1 = `
<h2>1. 公式的各种写法</h2>
<p>实数集 ${K('\\R')}、粗体向量 ${K('\\bm{x}')}、秩 ${K('\\operatorname{rank}A')}、示性函数 ${K('\\mathbb{1}_{A}')}，以及带中文的 ${K('x=\\text{常数}')} 和 ${K('面积=\\pi r^2')}。</p>
<p>化学式 ${K('\\ce{H2O + CO2}')}，注释 ${K('a+b % 这是注释')}，井号 ${K('\\#S = n')}，行内换行 ${K('a=1 \\\\ b=2')}，行内矩阵 ${K('\\begin{matrix} a & b \\\\ c & d \\end{matrix}')}。</p>
${KD('\\begin{align} f(x) &= x^2 \\\\ f\'(x) &= 2x \\tag{1} \\end{align}')}
${KD('a &= b + c \\\\ &= d')}
${KD('\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2} \\tag{★}')}
<p>下面这个命令不存在，应当退回源码：${K('\\foo{x} + \\bar{y}')}，这个括号不配对：${K('\\left( x + 1')}。</p>
${KD('\\undefinedmacro{a}{b} = \\frac{1}{2}')}
${KD('\\begin{cases} x, & x \\ge 0 \\\\[4pt] -x, & x < 0 \\end{cases}')}
<p>MathJax 3 只留下 MathML：<mjx-container class="MathJax" jax="CHTML"><mjx-math aria-hidden="true">x</mjx-math><mjx-assistive-mml><math><msup><mi>e</mi><mrow><mi>i</mi><mi>π</mi></mrow></msup><mo>+</mo><mn>1</mn><mo>=</mo><mn>0</mn></math></mjx-assistive-mml></mjx-container>，Gemini 式写法：<span class="math-inline" data-math="\\int_0^1 x^2\\,dx = \\tfrac13">∫</span>。</p>
<h3>1.1 标题里的公式 ${K('O(n^2)')}</h3>
<h4>第三步：特殊字符</h4>
<p>反斜杠 \\ 花括号 {} 美元 $ 与 &amp; 井号 # 百分号 % 下划线 _ 尖号 ^ 波浪 ~ 小于 &lt; 大于 &gt; 竖线 | 引号 "x" ‘单’ “双” 破折号 —— 省略号 …… 表情 ✅ ❌ 🚀 👉 😀 ⚠️。</p>
<p>很长的网址：<a href="https://example.com/a/very/long/path/that/keeps/going/and/going?query=1&amp;x=%E4%B8%AD#frag">https://example.com/a/very/long/path/that/keeps/going/and/going?query=1&amp;x=%E4%B8%AD#frag</a>，<strong>加粗里有 <a href="https://example.org">链接</a> 和 ${K('x^2')}</strong>，<em>斜体 italic</em>，<del>删除线</del>，<code>inline_code{x}</code>，H<sub>2</sub>O，x<sup>2</sup>。</p>
<blockquote><p>引用的一段话，带公式 ${K('\\alpha+\\beta')}。</p></blockquote>
<hr>
`;

const answer2 = `
<h2>2. 代码</h2>
<div class="md-code-block"><div class="md-code-block-banner"><span class="md-code-block-infostring">bash</span><button>复制</button></div><pre>#!/usr/bin/env bash
echo "$HOME" | sed -e 's/\\(a\\)/{\\1}/g' # 100% sure
for f in *.tex; do xelatex "$f"; done
</pre></div>
<pre><code class="language-javascript">const t = \`\${a} {b}\`;
function f(x) {
\treturn x.map((y) =&gt; y * 2); // 注释：中文
}
const veryLongLine = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
/* 多行
   注释 */
</code></pre>
<pre><code>\\end{Verbatim} 这一行不能结束代码块
plain text \\section{x}</code></pre>
<h2>3. 表格</h2>
<table><thead><tr><th>方法</th><th>复杂度</th><th>说明</th></tr></thead>
<tbody><tr><td>回代</td><td>${K('O(n^2)')}</td><td>见 <code>solve()</code>，[注] 方括号开头</td></tr>
<tr><td colspan="2">合并的单元格</td><td><a href="https://example.com">链接</a></td></tr>
<tr><td>* 星号开头</td><td>${KD('\\frac{n(n-1)}{2}')}</td><td><ul><li>列表一</li><li>列表二</li></ul></td></tr></tbody></table>
<table><tr><th>a</th><th>b</th><th>c</th><th>d</th><th>e</th><th>f</th><th>g</th></tr><tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td></tr></table>
<h2>4. 列表</h2>
<ol start="3"><li>第三项</li><li>第四项<ul><li>二层<ul><li>三层<ul><li>四层<ul><li>五层<ul><li>六层</li></ul></li></ul></li></ul></li></ul></li></ul></li></ol>
<ul><li><input type="checkbox" checked disabled> 已完成</li><li><input type="checkbox" disabled> 未完成</li><li>[方括号开头的条目]</li></ul>
<h2>5. 图片</h2>
<p><img src="data:image/png;base64,${png(96, 48).toString('base64')}" alt="渐变示意图"></p>
<p><img src="https://invalid.example/not-here.png" alt="取不到的图"></p>
`;

const html = `<!DOCTYPE html>
<!-- saved from url=(0062)https://chat.deepseek.com/a/chat/s/00000000-0000-4000-8000-0000 -->
<html lang="zh-CN"><head><meta charset="utf-8"><title>排版压力测试 - DeepSeek</title></head>
<body><div class="ds-virtual-list-items">
${user('请把下面这些都排出来：公式 $\\int_0^1 x\\,dx$、价格 $5 and $10，以及 \\(a^2+b^2=c^2\\)。\n\n第二段问题。')}
${bot(answer1, '先想一想：用户要求测试 <b>各种</b> 写法。')}
${user('继续：代码、表格、列表和图片。')}
${bot(answer2)}
</div></body></html>
`;

const out = path.join(import.meta.dirname, 'selftest', 'edge-cases.html');
fs.writeFileSync(out, html);
console.log('wrote', out, html.length);
