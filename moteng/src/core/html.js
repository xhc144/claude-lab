// Document → HTML, for two readers:
//   • the live preview in the app: every block and formula carries data-oid, so a click there can
//     change exactly that element (formula inline ↔ display, heading level, image width, page break);
//     page size, margins, fonts and spacing come from CSS variables that mirror the TeX layout.
//   • the interactive HTML export: one self-contained file (KaTeX fonts, images and charts inlined)
//     where formulas copy their TeX, code copies, and HTML / SVG / JavaScript code runs in a sandbox.
// Both start from prepareDocument(), the same transformed document the TeX writer uses.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import { prepareDocument, normalizeLayout, PAPERS, accentHex, resolvedFonts } from './layout.js';
import { resolveLanguage } from './latex/highlight.js';
import { blockTextLength } from './ir.js';

const require = createRequire(import.meta.url);

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// KaTeX knows most of what the pages use; the macros moteng.sty adds are given here too.
const MACROS = {
  '\\R': '\\mathbb{R}', '\\N': '\\mathbb{N}', '\\Z': '\\mathbb{Z}', '\\Q': '\\mathbb{Q}', '\\C': '\\mathbb{C}',
  '\\RR': '\\mathbb{R}', '\\NN': '\\mathbb{N}', '\\ZZ': '\\mathbb{Z}', '\\QQ': '\\mathbb{Q}', '\\CC': '\\mathbb{C}',
  '\\E': '\\mathbb{E}', '\\argmax': '\\operatorname*{arg\\,max}', '\\argmin': '\\operatorname*{arg\\,min}',
  '\\sgn': '\\operatorname{sgn}', '\\rank': '\\operatorname{rank}', '\\diag': '\\operatorname{diag}',
  '\\Var': '\\operatorname{Var}', '\\Cov': '\\operatorname{Cov}', '\\abs': '\\lvert #1\\rvert', '\\norm': '\\lVert #1\\rVert',
};

function mathHtml(tex, display, numbered) {
  try {
    return katex.renderToString(String(tex), { displayMode: display, throwOnError: true, strict: 'ignore', trust: false, macros: { ...MACROS }, output: 'html', leqno: false, fleqn: false });
  } catch {
    try {
      return katex.renderToString(String(tex), { displayMode: display, throwOnError: false, strict: 'ignore', macros: { ...MACROS }, output: 'html' });
    } catch {
      return `<code class="mt-badmath">${esc(tex)}</code>`;
    }
  }
}

function codeHtml(text, lang) {
  const l = resolveLanguage(lang);
  if (l && l !== 'plaintext' && text.length < 60000) {
    try { return hljs.highlight(text, { language: l, ignoreIllegals: true }).value; } catch { /* plain */ }
  }
  return esc(text);
}

const LANG_LABEL = { python: 'Python', javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript', html: 'HTML', xml: 'XML', css: 'CSS', bash: 'Bash', shell: 'Shell', sql: 'SQL', json: 'JSON', cpp: 'C++', c: 'C', java: 'Java', go: 'Go', rust: 'Rust', latex: 'LaTeX', tex: 'TeX', svg: 'SVG', r: 'R', matlab: 'MATLAB' };

class HtmlWriter {
  constructor(ctx) {
    this.ctx = ctx; // { imageUrl(file) → url, interactive, eqNumbers, numberWithin }
    this.eq = 0;
    this.section = 0;
  }

  inlines(inl) {
    let out = '';
    for (const x of inl || []) {
      switch (x.t) {
        case 'text': out += esc(x.v); break;
        case 'br': out += '<br>'; break;
        case 'math': out += `<span class="mt-m" data-oid="${esc(x.oid || '')}" data-tex="${esc(x.tex)}"${x.fromDisplay ? ' data-moved="1"' : ''}>${mathHtml(x.tex, !!x.displaystyle && false, false)}</span>`; break;
        case 'code': out += `<code class="mt-ic">${esc(x.v)}</code>`; break;
        case 'b': out += `<strong>${this.inlines(x.c)}</strong>`; break;
        case 'i': out += `<em>${this.inlines(x.c)}</em>`; break;
        case 's': out += `<del>${this.inlines(x.c)}</del>`; break;
        case 'sup': out += `<sup>${this.inlines(x.c)}</sup>`; break;
        case 'sub': out += `<sub>${this.inlines(x.c)}</sub>`; break;
        case 'check': out += x.on ? '☑ ' : '☐ '; break;
        case 'link': out += /^(https?|mailto|ftp):/i.test(x.href) ? `<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${this.inlines(x.c)}</a>` : this.inlines(x.c); break;
        case 'img': out += x.file ? `<img class="mt-inline-img" src="${esc(this.ctx.imageUrl(x.file))}" alt="${esc(x.alt)}">` : `<span class="mt-missing">[图片：${esc(x.alt || '')}]</span>`; break;
        default: break;
      }
    }
    return out;
  }

  blocks(blocks, opts = {}) {
    return (blocks || []).map((b) => this.block(b, opts)).join('\n');
  }

  attrs(b, extra = '') {
    return `data-oid="${esc(b.oid || '')}"${b.breakBefore ? ' data-break="1"' : ''}${extra}`;
  }

  block(b, opts) {
    const brk = b.breakBefore ? '<div class="mt-pagebreak" aria-hidden="true"><span>分页</span></div>' : '';
    return brk + this.blockBody(b, opts);
  }

  blockBody(b, opts) {
    switch (b.t) {
      case 'para': return `<p class="mt-p" ${this.attrs(b)}>${this.inlines(b.inl)}</p>`;
      case 'heading': {
        if (opts.inBox) return `<p class="mt-p" ${this.attrs(b)}><strong>${this.inlines(b.inl)}</strong></p>`;
        const base = this.headingBase ?? 1;
        const lvl = Math.max(1, Math.min(4, b.userLevel ? b.level : b.level - base + 1));
        return `<h${lvl + 1} class="mt-h mt-h${lvl}" ${this.attrs(b, ` data-level="${lvl}"`)}>${this.inlines(b.inl)}</h${lvl + 1}>`;
      }
      case 'math': {
        const numbered = b.numbered ?? this.ctx.eqNumbers === 'all';
        const tagged = /\\tag\*?\{/.test(b.tex);
        let num = '';
        if (numbered && !tagged) {
          this.eq++;
          num = `<span class="mt-eqno">(${this.ctx.numberWithin && this.section ? `${this.section}.` : ''}${this.eq})</span>`;
        }
        const tex = b.numbered === false ? b.tex.replace(/\\tag\*?\{[^{}]*\}/g, '') : b.tex;
        return `<div class="mt-dm" ${this.attrs(b, ` data-tex="${esc(b.tex)}"${b.fromInline ? ' data-moved="1"' : ''}`)}>${mathHtml(tex, true)}${num}</div>`;
      }
      case 'code': {
        const lang = (b.lang || '').toLowerCase();
        const label = LANG_LABEL[lang] || b.lang || '';
        const runnable = this.ctx.interactive && /^(html|xml|svg|javascript|js)$/.test(lang) && b.text.length < 200000;
        return `<figure class="mt-code" ${this.attrs(b, ` data-lang="${esc(lang)}"`)}><figcaption><span>${esc(label || '代码')}</span><span class="mt-code-actions">${runnable ? '<button type="button" data-act="run">运行</button>' : ''}<button type="button" data-act="copy">复制</button></span></figcaption><pre><code class="hljs">${codeHtml(b.text, b.lang)}</code></pre>${runnable ? '<div class="mt-run" hidden></div>' : ''}<textarea class="mt-src" hidden readonly>${esc(b.text)}</textarea></figure>`;
      }
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
        return `<${tag} class="mt-list" ${this.attrs(b)}${start}>${b.items.map((it) => `<li>${this.blocks(it, opts)}</li>`).join('')}</${tag}>`;
      }
      case 'table': {
        const rows = b.rows.map((r) => `<tr>${r.cells.map((c, i) => {
          const tag = r.header ? 'th' : 'td';
          const span = r.spans && r.spans[i] > 1 ? ` colspan="${r.spans[i]}"` : '';
          return `<${tag}${span}>${this.inlines(c)}</${tag}>`;
        }).join('')}</tr>`).join('');
        return `<div class="mt-table-wrap" ${this.attrs(b)}><table class="mt-table${b.grid ? ' is-grid' : ''}">${rows}</table></div>`;
      }
      case 'quote': return `<blockquote class="mt-quote" ${this.attrs(b)}>${this.blocks(b.blocks, opts)}</blockquote>`;
      case 'hr': return `<hr class="mt-hr" ${this.attrs(b)}>`;
      case 'image': {
        const w = b.width ? ` style="width:${(b.width * 100).toFixed(1)}%"` : '';
        if (!b.file) return `<p class="mt-missing" ${this.attrs(b)}>[图片：${esc(b.alt || '未能保存')}]</p>`;
        const cap = b.alt && !/^(image|img|图片|图像|已生成图片|generated image|uploaded image)$/i.test(b.alt.trim()) ? `<figcaption>${esc(b.alt)}</figcaption>` : '';
        return `<figure class="mt-img" ${this.attrs(b, b.width ? ` data-width="${b.width}"` : '')}><img src="${esc(this.ctx.imageUrl(b.file))}" alt="${esc(b.alt)}"${w}>${cap}</figure>`;
      }
      case 'dynamic': return this.dynamic(b);
      case 'note': {
        if (b.kind === 'widget' && b.file && this.ctx.dynamic !== 'text') {
          const pic = this.picture(b, '交互组件（保存网页时的状态）');
          if (this.ctx.dynamic === 'image') return pic;
          return `${pic}<aside class="mt-note is-widget"><div class="mt-note-title">组件中的文字</div>${this.blocks(b.blocks, { inBox: true })}</aside>`;
        }
        const kind = b.kind === 'widget' ? 'is-widget' : b.kind === 'thinking' ? 'is-thinking' : 'is-details';
        return `<aside class="mt-note ${kind}" ${this.attrs(b)}>${b.title ? `<div class="mt-note-title">${esc(b.title)}</div>` : ''}${this.blocks(b.blocks, { inBox: true })}</aside>`;
      }
      default: return '';
    }
  }

  picture(b, caption) {
    const w = b.width ? ` style="width:${(b.width * 100).toFixed(1)}%"` : b.pxWidth ? ` style="width:min(100%, ${Math.round(b.pxWidth)}px)"` : '';
    return `<figure class="mt-img mt-dyn" ${this.attrs(b, b.width ? ` data-width="${b.width}"` : '')}><img src="${esc(this.ctx.imageUrl(b.file))}" alt=""${w}><figcaption>${esc(caption)}</figcaption></figure>`;
  }

  dynamic(b) {
    const what = { svg: '图表', chart: '图表', iframe: '交互内容', canvas: '画布' }[b.kind] || '动态内容';
    const caption = `${b.title ? `${b.title} · ` : ''}${what}`;
    // The export keeps vector SVG where the page had one: it scales and stays sharp.
    if (this.ctx.interactive && b.kind === 'svg' && b.svg) {
      return `<figure class="mt-img mt-dyn mt-svg" ${this.attrs(b)}>${sanitizeSvg(b.svg)}<figcaption>${esc(caption)}</figcaption></figure>`;
    }
    if (b.file) return this.picture(b, `${b.kind === 'svg' && b.title ? `${b.title} · ` : ''}${what}（保存网页时的画面）`);
    if (b.kind === 'canvas') return '';
    if (b.svg) return `<figure class="mt-img mt-dyn mt-svg" ${this.attrs(b)}>${sanitizeSvg(b.svg)}<figcaption>${esc(caption)}</figcaption></figure>`;
    return `<p class="mt-missing" ${this.attrs(b)}>[${esc(what)}${b.title ? `：${esc(b.title)}` : ''}：未能截取画面]</p>`;
  }
}

/** SVG from a saved page, without scripts or event handlers. */
export function sanitizeSvg(svg) {
  return String(svg)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, '$1#')
    .replace(/\swidth="100%"/i, '');
}

function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : `${x.getFullYear()} 年 ${x.getMonth() + 1} 月 ${x.getDate()} 日`;
}

/**
 * The document as HTML (body part only).
 * opts: { layout, overrides, style, includeQuestions, imageUrl(file), interactive }
 * Returns { html, stats, layout }.
 */
export function renderHtml(conv, opts = {}) {
  const L = normalizeLayout(opts.layout);
  const doc = prepareDocument(conv, L, opts.overrides);
  const w = new HtmlWriter({ imageUrl: opts.imageUrl || ((f) => f), interactive: !!opts.interactive, eqNumbers: L.eqNumbers, numberWithin: L.eqWithinSection, dynamic: L.dynamic });
  const answerName = conv.assistantName || 'AI';
  const parts = [];
  const meta = [conv.platformName, fmtDate(conv.date)].filter(Boolean);
  parts.push(`<header class="mt-title"><h1>${esc(conv.title)}</h1><div class="mt-meta">${meta.map(esc).join(' · ')}${conv.url && /^https?:/.test(conv.url) ? ` · <a href="${esc(conv.url)}" target="_blank" rel="noopener noreferrer">${esc(conv.url.replace(/^https?:\/\//, '').slice(0, 64))}</a>` : ''}</div></header>`);
  const asked = doc.turns.filter((t) => t.question).length;
  let n = 0;
  doc.turns.forEach((turn, k) => {
    if (k > 0) parts.push(turn.breakBefore ? `<div class="mt-pagebreak is-turn" data-oid="t${k}" aria-hidden="true"><span>分页</span></div>` : `<hr class="mt-turnsep" data-oid="t${k}">`);
    if (turn.question) {
      n++;
      w.section = n;
      if (L.eqWithinSection) w.eq = 0;
      if (opts.includeQuestions !== false) {
        const label = asked > 1 ? `问题 ${n}` : '问题';
        const long = blockTextLength(turn.question) >= 700;
        parts.push(`<section class="mt-q is-${L.questionStyle}${long ? ' is-long' : ''}" data-oid="t${k}.q"><div class="mt-q-label">${esc(label)}</div>${w.blocks(turn.question, { inBox: true })}</section>`);
      }
    }
    if (turn.answer.length) {
      const levels = [];
      const walk = (bs) => bs.forEach((b) => { if (b.t === 'heading' && !b.userLevel) levels.push(b.level); if (b.items) b.items.forEach(walk); });
      walk(turn.answer);
      w.headingBase = (levels.length ? Math.min(...levels) : 2) - L.headingShift;
      parts.push(`<section class="mt-a" data-oid="t${k}.a"><div class="mt-a-label">${esc(answerName)}</div>${w.blocks(turn.answer)}</section>`);
    }
  });
  return { html: parts.join('\n'), stats: doc.stats, layout: L, numbering: L.headingNumbers };
}

const FONT_STACKS = {
  cjk: {
    song: '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", SimSun, serif',
    hei: '"Microsoft YaHei", "PingFang SC", "Source Han Sans SC", "Noto Sans CJK SC", sans-serif',
    kai: 'KaiTi, STKaiti, "Kaiti SC", "LXGW WenKai", serif',
    fang: 'FangSong, STFangsong, serif',
  },
  latin: {
    stix: '"STIX Two Text", "Times New Roman", Times',
    lm: '"Latin Modern Roman", "CMU Serif", "Computer Modern", Georgia',
    sans: '"Segoe UI", "Helvetica Neue", Helvetica, Arial',
    fira: '"Fira Sans", "Segoe UI", Arial',
  },
  mono: {
    system: 'Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", monospace',
    lm: '"Latin Modern Mono", "CMU Typewriter Text", Consolas, monospace',
    fira: '"Fira Mono", "Fira Code", Consolas, monospace',
  },
};

/** CSS variables for the preview, mirroring the TeX layout (1mm = 3.7795px at 96 dpi). */
export function layoutCss(layoutIn, { pageColors } = {}) {
  const L = normalizeLayout(layoutIn);
  const p = PAPERS[L.paper] || PAPERS.a4;
  const f = resolvedFonts(L);
  const mm = (v) => `${(v * 3.7795).toFixed(1)}px`;
  const vars = {
    '--mt-page-w': mm(p.w), '--mt-page-h': mm(p.h),
    '--mt-mt': mm(L.marginMm.top), '--mt-mb': mm(L.marginMm.bottom), '--mt-ml': mm(L.marginMm.left), '--mt-mr': mm(L.marginMm.right),
    '--mt-size': `${(L.sizePt * 96 / 72).toFixed(2)}px`,
    '--mt-lh': (L.lineSpread * 1.2).toFixed(3),
    '--mt-parskip': `${(L.parSkip * L.lineSpread * 1.2).toFixed(3)}em`,
    '--mt-indent': L.parIndent ? '2em' : '0',
    '--mt-font': `${FONT_STACKS.latin[f.latin] || FONT_STACKS.latin.stix}, ${FONT_STACKS.cjk[f.cjk] || FONT_STACKS.cjk.song}`,
    '--mt-mono': FONT_STACKS.mono[f.mono] || FONT_STACKS.mono.system,
    '--mt-head-font': L.theme === 'web' ? 'inherit' : `${FONT_STACKS.latin.sans}, ${FONT_STACKS.cjk.hei}`,
    '--mt-hscale': L.headingScale.toFixed(3),
    '--mt-accent': `#${accentHex(L)}`,
    '--mt-img-w': `${(L.imageWidth * 100).toFixed(1)}%`,
    '--mt-img-h': `${(L.imageMaxHeight * p.h * 3.7795).toFixed(0)}px`,
    '--mt-bubble': (L.followPage && L.questionStyle === 'bubble' && pageColors?.bubbleBg) || (L.theme === 'web' ? '#f1f1f1' : `color-mix(in srgb, #${accentHex(L)} 8%, white)`),
    '--mt-bubble-fg': (L.followPage && L.questionStyle === 'bubble' && pageColors?.bubbleFg) || 'inherit',
  };
  return `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;
}

let katexCssCache = null;
function katexCssInline() {
  if (katexCssCache) return katexCssCache;
  const dir = path.dirname(require.resolve('katex/dist/katex.min.css'));
  let css = fs.readFileSync(path.join(dir, 'katex.min.css'), 'utf8');
  // Only the woff2 faces, as data URLs (about 300 KB): the file works offline and anywhere.
  css = css.replace(/src:url\(fonts\/([^)]+?)\.woff2\) format\("woff2"\)(,url\([^)]+\) format\("[a-z]+"\))*/g, (m, name) => {
    const file = path.join(dir, 'fonts', `${name}.woff2`);
    try { return `src:url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}) format("woff2")`; } catch { return m; }
  });
  katexCssCache = css;
  return css;
}

export function documentCssPath() {
  return path.join(import.meta.dirname, 'html-doc.css');
}

/** Self-contained interactive HTML file. `imageData(file)` returns a data: URL for an image file. */
export function renderHtmlDocument(conv, opts = {}) {
  const body = renderHtml(conv, { ...opts, interactive: true });
  const css = fs.readFileSync(documentCssPath(), 'utf8');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="墨誊 Moteng">
<title>${esc(conv.title)}</title>
<style>${katexCssInline()}</style>
<style>${layoutCss(opts.layout, { pageColors: opts.pageColors || conv.pageColors })}
${css}
body{margin:0;background:#f3f3f1}
.mt-doc{box-sizing:border-box;max-width:var(--mt-page-w);margin:24px auto;padding:var(--mt-mt) var(--mt-mr) var(--mt-mb) var(--mt-ml);background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 30px rgba(0,0,0,.06);border-radius:4px}
@media (max-width:820px){.mt-doc{margin:0;padding:20px 16px;border-radius:0;box-shadow:none}}
@media print{body{background:#fff}.mt-doc{box-shadow:none;margin:0;max-width:none;padding:0}.mt-code-actions,.mt-run{display:none!important}.mt-pagebreak{break-after:page;visibility:hidden;height:0;margin:0}}
</style>
</head>
<body>
<article class="mt-doc theme-${esc(body.layout.theme)} code-${esc(body.layout.codeTheme)}">
${body.html}
</article>
<footer class="mt-footer">由 墨誊 Moteng 生成 · 点击公式可复制 TeX 源码</footer>
<script>
${EXPORT_SCRIPT}
</script>
</body>
</html>
`;
}

// Behaviour of the exported page: copy TeX / code, run HTML, SVG and JavaScript in a sandbox.
const EXPORT_SCRIPT = `(function(){
  function toast(t){var d=document.createElement('div');d.className='mt-toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},1400);}
  function copy(t){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('已复制')},function(){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast('已复制')});}
  document.addEventListener('click',function(e){
    var m=e.target.closest('.mt-m,.mt-dm');
    if(m&&!getSelection().toString()){copy(m.getAttribute('data-tex'));return;}
    var b=e.target.closest('button[data-act]');if(!b)return;
    var fig=b.closest('.mt-code');var src=fig.querySelector('.mt-src').value;
    if(b.dataset.act==='copy'){copy(src);return;}
    var box=fig.querySelector('.mt-run');var lang=fig.dataset.lang;
    if(!box.hidden){box.hidden=true;box.innerHTML='';b.textContent='运行';return;}
    var doc=lang==='javascript'||lang==='js'
      ?'<!doctype html><meta charset="utf-8"><body style="font:13px/1.5 Consolas,monospace;margin:8px"><pre id="o"></pre><script>var o=document.getElementById("o");function w(k,a){o.textContent+=(k?k+" ":"")+[].map.call(a,function(x){try{return typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(" ")+"\\\\n"}console.log=function(){w("",arguments)};console.error=function(){w("✗",arguments)};window.onerror=function(m){w("✗",[m])};<\\/script><script>'+src.replace(/<\\/script/gi,'<\\\\/script')+'<\\/script>'
      :src;
    var f=document.createElement('iframe');f.setAttribute('sandbox','allow-scripts');f.srcdoc=doc;box.appendChild(f);box.hidden=false;b.textContent='收起';
  });
})();`;
