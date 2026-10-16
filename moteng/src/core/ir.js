// HTML → document IR.
//
// Blocks:  heading{level,inl} para{inl} list{ordered,start,items:[Block[]]} code{lang,text}
//          math{tex} table{rows:[{header,cells:[Inline[]]}],widths?} quote{blocks} hr
//          image{src,alt} note{kind,title,blocks}
// Inlines: text{v} b{c} i{c} s{c} sup{c} sub{c} code{v} math{tex} link{href,c} br check{on}
//          img{src,alt} (small inline picture, e.g. an emoji image)
//
// The walk is generic; platform quirks enter only through ctx (skip/thinking
// selectors) and through the handful of renderer patterns recognised below.

import { MATH_ROOT_SELECTOR, texFromElement } from './math.js';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'BUTTON', 'SVG', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
  'NAV', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'DIALOG', 'HEAD',
]);

const SKIP_SELECTOR = [
  '[hidden]', '[aria-hidden="true"]', '.sr-only', '.visually-hidden', '.screen-reader-only',
  '[data-markdown-copy="exclude"]', '[data-code-block-controls]', '[role="toolbar"]', '[role="tooltip"]',
  '[role="slider"]', '[data-d-component="button"]', '[data-d-component="slider"]', '[data-d-component="icon"]',
  '.katex-html', '.MathJax_Preview', 'mjx-assistive-mml',
  '.code-block-decoration', '.md-code-block-banner', '.md-code-block-infostring',
  '[class*="copy-button"]', '[class*="CopyButton"]', '[class*="line-number"]', '[class*="linenumber"]',
  '.react-syntax-highlighter-line-number', '.cm-gutters', '.cm-announced', '.cm-tooltip', '.cm-panels',
].join(', ');

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'ASIDE', 'UL', 'OL', 'LI', 'TABLE', 'THEAD',
  'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'HR', 'FIGURE',
  'FIGCAPTION', 'DETAILS', 'SUMMARY', 'DL', 'DT', 'DD', 'CENTER', 'ADDRESS', 'FIELDSET', 'BODY', 'HTML',
]);

const CODE_WRAPPER = [
  '[data-code-block]', 'code-block', '.md-code-block', '[data-testid="code-block"]', '.code-block',
  '.codeblock', '.code-block-wrapper', '.hyc-common-markdown__code', '.markdown-code-block', '.ds-code-block',
].join(', ');

const UI_LABELS = /^(复制|复制代码|拷贝|运行|运行代码|编辑|下载|预览|收起|展开|copy|copy code|copied!?|run|edit|download|preview|collapse|expand|wrap|启用自动换行|自动换行|代码|code)$/i;

const KNOWN_LANGS = new Set(('python py javascript js typescript ts jsx tsx java c cpp c++ csharp c# cs go golang rust rs ruby rb php '
  + 'swift kotlin scala r matlab octave julia lua perl bash sh shell zsh powershell ps1 bat cmd sql html xml css scss '
  + 'less json yaml yml toml ini markdown md latex tex dockerfile makefile cmake haskell hs ocaml fsharp f# elixir '
  + 'erlang clojure lisp scheme racket dart vb vbnet fortran assembly asm nasm verilog vhdl solidity graphql '
  + 'plaintext text txt diff mermaid prolog coq lean lean4 isabelle wolfram mathematica sage maxima pascal delphi '
  + 'objective-c objc groovy nim zig awk sed vim protobuf terraform hcl nginx apache csv tsv').split(' '));

export function cleanLang(raw) {
  if (!raw) return '';
  const t = String(raw).trim().toLowerCase().replace(/^language-|^lang-/, '');
  if (!t || t.length > 20) return '';
  if (KNOWN_LANGS.has(t)) return t;
  return /^[a-z][\w+#.-]*$/.test(t) && !UI_LABELS.test(t) ? t : '';
}

function isElement(n) {
  return n && n.nodeType === 1;
}

function tag(el) {
  return el.tagName ? el.tagName.toUpperCase() : '';
}

function cls(el) {
  return (el.getAttribute && el.getAttribute('class')) || '';
}

function comp(el) {
  return el.getAttribute ? el.getAttribute('data-d-component') : null;
}

function isSkipped(el, ctx) {
  const t = tag(el);
  if (SKIP_TAGS.has(t)) return t !== 'INPUT' || el.getAttribute('type') !== 'checkbox';
  if (el.matches(SKIP_SELECTOR)) return true;
  if (ctx.skip && el.matches(ctx.skip)) return true;
  const style = el.getAttribute('style') || '';
  if (/display\s*:\s*none/i.test(style)) return true;
  return false;
}

function isMathRoot(el) {
  return el.matches(MATH_ROOT_SELECTOR);
}

function isBold(el) {
  const t = tag(el);
  if (t === 'STRONG' || t === 'B') return true;
  if (el.hasAttribute('data-d-default-strong')) return true;
  const w = el.getAttribute('data-d-weight');
  if (w && /^(bold|semibold|extrabold|black)$/.test(w) && comp(el) !== 'title' && tag(el) === 'SPAN') return true;
  const style = el.getAttribute('style') || '';
  return /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
}

function isItalic(el) {
  const t = tag(el);
  if (t === 'EM' || t === 'CITE' || t === 'VAR') return true;
  if (t === 'I') return !/\b(icon|fa-|material|anticon)/i.test(cls(el)) && (el.textContent || '').trim() !== '';
  return /font-style\s*:\s*italic/i.test(el.getAttribute('style') || '');
}

function preWrap(el, inherited) {
  if (/\bwhitespace-pre(-wrap|-line)?\b|\bwhite-space-pre/.test(cls(el))) return true;
  const style = el.getAttribute('style') || '';
  if (/white-space\s*:\s*pre/i.test(style)) return true;
  return inherited;
}

function containsBlock(el) {
  for (const c of el.children) {
    if (BLOCK_TAGS.has(tag(c)) || tag(c).includes('-')) return true;
    if (c.matches(CODE_WRAPPER)) return true;
    if (containsBlock(c)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Code blocks
// ---------------------------------------------------------------------------

function codeText(el) {
  const lines = el.querySelectorAll('.cm-line');
  if (lines.length) return [...lines].map((l) => l.textContent).join('\n');
  let out = '';
  const walk = (n) => {
    if (n.nodeType === 3) { out += n.textContent; return; }
    if (!isElement(n)) return;
    if (n.matches('[class*="line-number"], [class*="linenumber"], .react-syntax-highlighter-line-number, button')) return;
    if (tag(n) === 'BR') { out += '\n'; return; }
    const blockLine = tag(n) === 'DIV' || tag(n) === 'P';
    if (blockLine && out && !out.endsWith('\n')) out += '\n';
    n.childNodes.forEach(walk);
    if (blockLine && !out.endsWith('\n')) out += '\n';
  };
  walk(el);
  return out;
}

function langFromAttrs(el) {
  for (const n of [el, ...el.querySelectorAll('[data-language], code[class], pre[class], .cm-content')]) {
    const dl = n.getAttribute('data-language') || n.getAttribute('data-lang');
    if (dl) return cleanLang(dl);
    const m = cls(n).match(/(?:^|\s)(?:language|lang)-([\w+#.-]+)/);
    if (m) return cleanLang(m[1]);
  }
  return '';
}

// The visible header ("Python", "bash") of a code card.
function langFromHeader(wrapper, codeEl) {
  const walker = [];
  const visit = (n) => {
    if (!isElement(n) || n === codeEl || codeEl.contains(n)) return;
    if (tag(n) === 'BUTTON' || tag(n) === 'SVG') return;
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const t = c.textContent.trim();
        if (t) walker.push(t);
      } else visit(c);
    }
  };
  for (const c of wrapper.children) {
    if (c === codeEl || c.contains(codeEl)) {
      // Header may sit inside the same parent as the pre.
      for (const cc of c.children) if (cc !== codeEl && !cc.contains(codeEl)) visit(cc);
      continue;
    }
    visit(c);
  }
  for (const t of walker) {
    const l = cleanLang(t);
    if (l) return l;
  }
  return '';
}

function codeBlockFrom(el) {
  const inner = el.querySelector('.cm-content') || el.querySelector('pre code') || el.querySelector('pre') || el.querySelector('code');
  const source = inner || el;
  const text = codeText(source).replace(/ /g, ' ').replace(/\n+$/, '');
  const lang = langFromAttrs(el) || (inner ? langFromHeader(el, inner) : '');
  return { t: 'code', lang, text };
}

function preBlock(pre) {
  const code = pre.querySelector('code') || pre;
  const text = codeText(code).replace(/ /g, ' ').replace(/\n+$/, '');
  let lang = langFromAttrs(pre);
  if (!lang) {
    // Claude / generic: a short label just before the <pre> (or before its wrapper).
    const near = [pre.previousElementSibling];
    if (pre.parentElement && pre.parentElement.firstElementChild === pre) near.push(pre.parentElement.previousElementSibling);
    for (const el of near) {
      const t = el && el.textContent.trim();
      if (t && t.length <= 24 && !el.querySelector('pre, code, p, li')) {
        lang = cleanLang(t.split(/\s+/)[0]);
        if (lang) break;
      }
    }
  }
  return { t: 'code', lang, text };
}

// ---------------------------------------------------------------------------
// Inline walk
// ---------------------------------------------------------------------------

function pushText(arr, v) {
  if (!v) return;
  const last = arr[arr.length - 1];
  if (last && last.t === 'text') last.v += v;
  else arr.push({ t: 'text', v });
}

function textOf(node, pre) {
  let v = node.textContent.replace(/[​‌‍﻿­]/g, '');
  if (pre) return v;
  return v.replace(/[ \t\n\r\f]+/g, ' ');
}

function inlineImage(el) {
  const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
  const alt = el.getAttribute('alt') || '';
  const w = parseInt(el.getAttribute('width') || '0', 10);
  const small = /emoji|avatar|favicon|icon/i.test(cls(el) + ' ' + src) || (w > 0 && w <= 32);
  return { src, alt, small };
}

function inlinesOf(el, ctx, pre) {
  const out = [];
  for (const n of el.childNodes) {
    if (n.nodeType === 3) {
      const v = textOf(n, pre);
      if (pre && v.includes('\n')) {
        v.split('\n').forEach((part, i) => {
          if (i) out.push({ t: 'br' });
          pushText(out, part);
        });
      } else pushText(out, v);
      continue;
    }
    if (!isElement(n)) continue;
    if (tag(n) === 'INPUT' && n.getAttribute('type') === 'checkbox') {
      out.push({ t: 'check', on: n.hasAttribute('checked') });
      continue;
    }
    if (isMathRoot(n)) {
      const m = texFromElement(n);
      if (m && m.display && ctx.allowBlocks) out.push({ t: 'block', blocks: [{ t: 'math', tex: m.tex }] });
      else if (m) out.push({ t: 'math', tex: m.tex });
      else pushText(out, n.textContent);
      continue;
    }
    if (isSkipped(n, ctx)) continue;
    const t = tag(n);
    if (t === 'BR') { out.push({ t: 'br' }); continue; }
    if (t === 'IMG') {
      const im = inlineImage(n);
      if (im.small) { if (im.alt) pushText(out, im.alt); continue; }
      if (ctx.allowBlocks) out.push({ t: 'block', blocks: [{ t: 'image', src: im.src, alt: im.alt }] });
      else out.push({ t: 'img', src: im.src, alt: im.alt });
      continue;
    }
    if (ctx.thinking && n.matches(ctx.thinking)) {
      if (ctx.allowBlocks) out.push({ t: 'block', blocks: thinkingBlock(n, ctx) });
      continue;
    }
    // Block content inside an inline wrapper (or a block element met in inline position).
    if (ctx.allowBlocks && (BLOCK_TAGS.has(t) || t.includes('-') || n.matches(CODE_WRAPPER)) && t !== 'TD' && t !== 'TH') {
      out.push({ t: 'block', blocks: blocksOf(n, ctx, pre) });
      continue;
    }
    if (ctx.allowBlocks && containsBlock(n)) {
      out.push({ t: 'block', blocks: blocksOf(n, ctx, pre) });
      continue;
    }
    const p = preWrap(n, pre);
    if (t === 'CODE' || t === 'KBD' || t === 'SAMP' || t === 'TT') {
      out.push({ t: 'code', v: n.textContent.replace(/\s+/g, ' ') });
      continue;
    }
    const children = inlinesOf(n, ctx, p);
    if (!children.length) continue;
    if (t === 'A' && n.getAttribute('href') && !/^(javascript:|#)/.test(n.getAttribute('href'))) {
      out.push({ t: 'link', href: n.getAttribute('href'), c: children });
    } else if (isBold(n)) out.push({ t: 'b', c: children });
    else if (isItalic(n)) out.push({ t: 'i', c: children });
    else if (t === 'DEL' || t === 'S' || t === 'STRIKE') out.push({ t: 's', c: children });
    else if (t === 'SUP') out.push({ t: 'sup', c: children });
    else if (t === 'SUB') out.push({ t: 'sub', c: children });
    else for (const c of children) {
      if (c.t === 'text') pushText(out, c.v);
      else out.push(c);
    }
  }
  return out;
}

function trimInlines(inl) {
  while (inl.length && ((inl[0].t === 'text' && !inl[0].v.trim()) || inl[0].t === 'br')) inl.shift();
  while (inl.length && ((inl.at(-1).t === 'text' && !inl.at(-1).v.trim()) || inl.at(-1).t === 'br')) inl.pop();
  if (inl[0]?.t === 'text') inl[0].v = inl[0].v.replace(/^\s+/, '');
  if (inl.at(-1)?.t === 'text') inl.at(-1).v = inl.at(-1).v.replace(/\s+$/, '');
  return inl;
}

// ---------------------------------------------------------------------------
// Block walk
// ---------------------------------------------------------------------------

function headingLevel(el) {
  const m = tag(el).match(/^H([1-6])$/);
  if (m) return +m[1];
  const role = el.getAttribute('role');
  if (role === 'heading') return +(el.getAttribute('aria-level') || 3);
  return 0;
}

function listBlock(el, ctx, pre) {
  const ordered = tag(el) === 'OL' || el.getAttribute('data-d-marker') === 'number';
  const start = parseInt(el.getAttribute('start') || '1', 10) || 1;
  const items = [];
  for (const li of el.children) {
    if (tag(li) !== 'LI') {
      if (isSkipped(li, ctx)) continue;
      // Stray content between items belongs to the previous item.
      const extra = blocksOf(li, ctx, pre);
      if (items.length) items.at(-1).push(...extra);
      else if (extra.length) items.push(extra);
      continue;
    }
    items.push(blocksOf(li, ctx, pre));
  }
  return { t: 'list', ordered, start, items: items.filter((b) => b.length) };
}

// Flatten block content for a table cell.
export function cellInlines(blocks) {
  const out = [];
  const sep = () => { if (out.length && out.at(-1).t !== 'br') out.push({ t: 'br' }); };
  for (const b of blocks) {
    switch (b.t) {
      case 'para': case 'heading': sep(); out.push(...(b.t === 'heading' ? [{ t: 'b', c: b.inl }] : b.inl)); break;
      case 'math': sep(); out.push({ t: 'math', tex: b.tex, displaystyle: true }); break;
      case 'code': sep(); out.push({ t: 'code', v: b.text.replace(/\n/g, ' ⏎ ') }); break;
      case 'list':
        b.items.forEach((item, i) => {
          sep();
          out.push({ t: 'text', v: b.ordered ? `${b.start + i}. ` : '• ' });
          out.push(...cellInlines(item));
        });
        break;
      case 'image': sep(); out.push({ t: 'img', src: b.src, alt: b.alt }); break;
      case 'quote': case 'note': sep(); out.push(...cellInlines(b.blocks)); break;
      case 'table':
        for (const r of b.rows) { sep(); r.cells.forEach((c, i) => { if (i) out.push({ t: 'text', v: ' | ' }); out.push(...c); }); }
        break;
      default: break;
    }
  }
  return trimInlines(out);
}

function tableBlock(el, ctx) {
  const rows = [];
  const trs = [...el.querySelectorAll('tr')].filter((tr) => tr.closest('table') === el);
  for (const tr of trs) {
    const cells = [...tr.children].filter((c) => tag(c) === 'TD' || tag(c) === 'TH');
    if (!cells.length) continue;
    const header = tr.parentElement && tag(tr.parentElement) === 'THEAD' || cells.every((c) => tag(c) === 'TH');
    rows.push({
      header,
      cells: cells.map((c) => cellInlines(blocksOf(c, ctx, false))),
      spans: cells.map((c) => parseInt(c.getAttribute('colspan') || '1', 10) || 1),
    });
  }
  return rows.length ? { t: 'table', rows } : null;
}

// ChatGPT's DIL grid (cards side by side) → a borderless table.
function gridBlock(el, ctx) {
  const items = [...el.children].filter((c) => !isSkipped(c, ctx));
  const cells = items.map((c) => cellInlines(blocksOf(c, ctx, false))).filter((c) => c.length);
  if (!cells.length) return null;
  const per = cells.length <= 4 ? cells.length : (cells.length % 3 === 0 ? 3 : 4);
  const rows = [];
  for (let i = 0; i < cells.length; i += per) {
    const slice = cells.slice(i, i + per);
    while (slice.length < per) slice.push([]);
    rows.push({ header: false, cells: slice, spans: slice.map(() => 1) });
  }
  return { t: 'table', rows, grid: true };
}

function thinkingBlock(el, ctx) {
  if (!ctx.includeThinking) return [];
  const inner = blocksOf(el, { ...ctx, thinking: null }, false);
  return inner.length ? [{ t: 'note', kind: 'thinking', title: '思考过程', blocks: inner }] : [];
}

function isWidget(el) {
  return comp(el) === 'box' && !!el.querySelector('[data-d-component="button"], [data-d-component="slider"], [role="slider"]');
}

function demoteHeadings(blocks) {
  return blocks.map((b) => {
    if (b.t === 'heading') return { t: 'para', inl: [{ t: 'b', c: b.inl }] };
    if (b.t === 'note' || b.t === 'quote') return { ...b, blocks: demoteHeadings(b.blocks) };
    return b;
  });
}

// A code card's header ("python", "Code") often comes out as a paragraph of its
// own right before the code; fold it into the block as the language.
function absorbCodeLabels(blocks) {
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const prev = blocks[i - 1];
    if (b.t !== 'code' || prev.t !== 'para' || prev.inl.length !== 1 || prev.inl[0].t !== 'text') continue;
    const label = prev.inl[0].v.trim();
    if (label.length > 24) continue;
    const lang = cleanLang(label);
    if (lang || /^(code|代码|代码块)$/i.test(label)) {
      if (!b.lang && lang) b.lang = lang;
      blocks.splice(i - 1, 1);
      i--;
    }
  }
  return blocks;
}

export function blocksOf(root, ctx, pre = false) {
  const out = [];
  let inl = [];
  const flush = () => {
    trimInlines(inl);
    if (inl.length) out.push({ t: 'para', inl });
    inl = [];
  };
  const addInline = (items) => {
    for (const it of items) {
      if (it.t === 'block') { flush(); out.push(...it.blocks); }
      else if (it.t === 'text') pushText(inl, it.v);
      else inl.push(it);
    }
  };
  const bctx = { ...ctx, allowBlocks: true };
  for (const n of root.childNodes) {
    if (n.nodeType === 3) {
      const v = textOf(n, pre);
      addInline(pre && v.includes('\n') ? v.split('\n').flatMap((p, i) => (i ? [{ t: 'br' }, { t: 'text', v: p }] : [{ t: 'text', v: p }])) : [{ t: 'text', v }]);
      continue;
    }
    if (!isElement(n)) continue;
    if (isMathRoot(n)) {
      const m = texFromElement(n);
      if (!m) { addInline([{ t: 'text', v: n.textContent }]); continue; }
      if (m.display) { flush(); out.push({ t: 'math', tex: m.tex }); } else inl.push({ t: 'math', tex: m.tex });
      continue;
    }
    if (tag(n) === 'INPUT' && n.getAttribute('type') === 'checkbox') { inl.push({ t: 'check', on: n.hasAttribute('checked') }); continue; }
    if (isSkipped(n, ctx)) continue;
    if (ctx.thinking && n.matches(ctx.thinking)) { flush(); out.push(...thinkingBlock(n, ctx)); continue; }
    const t = tag(n);
    const p = preWrap(n, pre);
    if (n.matches(CODE_WRAPPER) && n.querySelector('pre, code, .cm-content')) { flush(); out.push(codeBlockFrom(n)); continue; }
    if (n.matches('.cm-editor, .cm-content')) { flush(); out.push({ t: 'code', lang: langFromAttrs(n), text: codeText(n) }); continue; }
    if (t === 'PRE') { flush(); out.push(preBlock(n)); continue; }
    const level = headingLevel(n);
    if (level) {
      flush();
      const h = trimInlines(inlinesOf(n, { ...ctx, allowBlocks: false }, false));
      if (h.length) out.push({ t: 'heading', level, inl: h });
      continue;
    }
    if (t === 'UL' || t === 'OL' || comp(n) === 'list') { flush(); const l = listBlock(n, ctx, p); if (l.items.length) out.push(l); continue; }
    if (t === 'TABLE') { flush(); const tb = tableBlock(n, ctx); if (tb) out.push(tb); continue; }
    if (t === 'BLOCKQUOTE') { flush(); const q = blocksOf(n, ctx, p); if (q.length) out.push({ t: 'quote', blocks: q }); continue; }
    if (t === 'HR') { flush(); out.push({ t: 'hr' }); continue; }
    if (t === 'IMG') {
      const im = inlineImage(n);
      if (im.small) { if (im.alt) pushText(inl, im.alt); continue; }
      flush();
      out.push({ t: 'image', src: im.src, alt: im.alt });
      continue;
    }
    if (t === 'FIGURE') {
      flush();
      const inner = blocksOf(n, ctx, p);
      out.push(...inner);
      continue;
    }
    if (t === 'DETAILS') {
      flush();
      const summary = n.querySelector(':scope > summary');
      const title = summary ? summary.textContent.trim() : '';
      const body = blocksOf(n, { ...ctx, skip: ctx.skip ? `${ctx.skip}, summary` : 'summary' }, p);
      if (body.length) out.push({ t: 'note', kind: 'details', title, blocks: body });
      continue;
    }
    if (isWidget(n)) {
      flush();
      const inner = demoteHeadings(blocksOf(n, ctx, p));
      if (inner.length) out.push({ t: 'note', kind: 'widget', title: '交互组件（静态快照）', blocks: inner });
      continue;
    }
    if (comp(n) === 'grid') { flush(); const g = gridBlock(n, ctx); if (g) out.push(g); continue; }
    if (comp(n) === 'row') {
      flush();
      const parts = [...n.children].filter((c) => !isSkipped(c, ctx)).map((c) => trimInlines(inlinesOf(c, { ...ctx, allowBlocks: false }, false))).filter((x) => x.length);
      if (parts.length) out.push({ t: 'para', inl: parts.flatMap((x, i) => (i ? [{ t: 'text', v: ' ' }, ...x] : x)) });
      continue;
    }
    if (BLOCK_TAGS.has(t) || t.includes('-') || (comp(n) && tag(n) !== 'SPAN')) {
      flush();
      out.push(...blocksOf(n, ctx, p));
      continue;
    }
    // Inline element.
    addInline(inlinesOf({ childNodes: [n] }, bctx, pre));
  }
  flush();
  return absorbCodeLabels(out);
}

/** Plain text a user typed into the prompt box: keep line breaks. */
export function promptBlocks(root, ctx) {
  return blocksOf(root, ctx, true);
}

/** Count of characters of visible text, for heuristics. */
export function blockTextLength(blocks) {
  let n = 0;
  const inl = (arr) => { for (const x of arr || []) n += x.v ? x.v.length : x.tex ? x.tex.length : x.c ? (inl(x.c), 0) : 0; };
  for (const b of blocks) {
    if (b.inl) inl(b.inl);
    if (b.text) n += b.text.length;
    if (b.tex) n += b.tex.length;
    if (b.items) b.items.forEach((it) => { n += blockTextLength(it); });
    if (b.blocks) n += blockTextLength(b.blocks);
    if (b.rows) b.rows.forEach((r) => r.cells.forEach((c) => inl(c)));
  }
  return n;
}
