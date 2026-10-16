// Layout: the typesetting settings a user can adjust (page, fonts, spacing, headings, formulas,
// images, page breaks), plus per-element overrides chosen in the live preview, and the document
// transforms that apply them to the IR before it is written as TeX or HTML.
//
// Every block and inline formula gets a stable "oid" (original id) before any transform. The TeX
// writer and the HTML preview both start from the same transformed document, so a click on an
// element in the preview addresses the same thing the PDF shows.

import { blockTextLength } from './ir.js';

export const LAYOUT_DEFAULTS = Object.freeze({
  theme: 'web',            // web: 接近网页原貌（无衬线、KaTeX 字形）  print: 印刷书籍风格（衬线）
  paper: 'a4',             // a4 | b5 | a5 | letter
  sizePt: 10.5,            // 正文字号（pt）：9 10 10.5 11 12 14
  margins: 'normal',       // narrow | normal | wide | custom
  marginMm: { top: 22, bottom: 22, left: 22, right: 22 },
  lineSpread: 1.35,        // 行距倍数
  parSkip: 0.55,           // 段间距（行）
  parIndent: false,        // 首行缩进两字
  cjkFont: 'auto',         // auto | song | hei | kai | fang
  latinFont: 'auto',       // auto | stix | lm | sans | fira
  mathFont: 'auto',        // auto | lm | stix | fira
  monoFont: 'auto',        // auto | system | lm | fira
  headingNumbers: 'auto',  // auto | none | arabic | chinese
  headingShift: 0,         // 所有标题整体升降：-1 0 1 2
  headingScale: 1,         // 标题字号倍数：0.85 1 1.15
  eqNumbers: 'none',       // none | all | tagged
  eqWithinSection: false,  // 编号形如 (2.3)
  mathMode: 'keep',        // keep | long-display | all-display | short-inline | all-inline
  longMath: 36,            // “长公式”的 TeX 长度阈值
  imageWidth: 0.8,         // 图片默认宽度（占版心比例）
  imageMaxHeight: 0.45,    // 图片最大高度（占版心高度比例）
  questionNewPage: false,  // 每个问题从新页开始
  pageNumbers: true,
  runningHeader: true,     // 页眉显示标题
  toc: 'auto',             // auto | on | off
  accent: 'indigo',        // indigo | teal | ink | crimson | amber | violet
  questionStyle: 'bubble', // bubble（网页气泡）| box（左边线色块）| plain
  codeTheme: 'light',      // light | dark
  dynamic: 'image',        // 动态内容：image 截图 | text 静态文字 | both
  followPage: true,        // 提问气泡沿用网页里的配色（截取网页时读到的颜色）
});

export const ACCENTS = {
  indigo: '2F4F8F', teal: '0F766E', ink: '1F2328', crimson: 'B4232C', amber: 'B45309', violet: '6D28D9',
};

export const PAPERS = {
  a4: { w: 210, h: 297, tex: 'a4paper' },
  b5: { w: 176, h: 250, tex: 'b5paper' },
  a5: { w: 148, h: 210, tex: 'a5paper' },
  letter: { w: 216, h: 279, tex: 'letterpaper' },
};

const MARGIN_PRESETS = {
  narrow: { top: 14, bottom: 16, left: 14, right: 14 },
  normal: { top: 22, bottom: 22, left: 22, right: 22 },
  wide: { top: 28, bottom: 28, left: 32, right: 32 },
};

const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
const num = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/**
 * Fills in defaults and clamps every value. Old settings files (paper / fontSize only) keep working:
 * fontSize 'large' becomes 12pt (小四).
 */
export function normalizeLayout(input = {}, legacy = {}) {
  const L = { ...LAYOUT_DEFAULTS, ...(input || {}) };
  const d = LAYOUT_DEFAULTS;
  const out = {};
  out.theme = pick(L.theme, ['web', 'print'], d.theme);
  out.paper = pick(L.paper ?? legacy.paper, Object.keys(PAPERS), legacy.paper && PAPERS[legacy.paper] ? legacy.paper : d.paper);
  if (input && input.sizePt === undefined && legacy.fontSize === 'large') out.sizePt = 12;
  else out.sizePt = num(L.sizePt, 8, 16, d.sizePt);
  out.margins = pick(L.margins, ['narrow', 'normal', 'wide', 'custom'], d.margins);
  const mm = out.margins === 'custom' ? { ...d.marginMm, ...(L.marginMm || {}) } : MARGIN_PRESETS[out.margins];
  out.marginMm = Object.fromEntries(['top', 'bottom', 'left', 'right'].map((k) => [k, num(mm[k], 6, 60, d.marginMm[k])]));
  if (out.margins !== 'custom' && out.paper !== 'a4' && out.paper !== 'letter') {
    // Smaller paper: scale the preset margins with the page width.
    const f = PAPERS[out.paper].w / 210;
    for (const k of Object.keys(out.marginMm)) out.marginMm[k] = Math.round(out.marginMm[k] * Math.max(0.75, f));
  }
  out.lineSpread = num(L.lineSpread, 1, 2.4, d.lineSpread);
  out.parSkip = num(L.parSkip, 0, 2, d.parSkip);
  out.parIndent = !!L.parIndent;
  out.cjkFont = pick(L.cjkFont, ['auto', 'song', 'hei', 'kai', 'fang'], d.cjkFont);
  out.latinFont = pick(L.latinFont, ['auto', 'stix', 'lm', 'sans', 'fira'], d.latinFont);
  out.mathFont = pick(L.mathFont, ['auto', 'lm', 'stix', 'fira'], d.mathFont);
  out.monoFont = pick(L.monoFont, ['auto', 'system', 'lm', 'fira'], d.monoFont);
  out.headingNumbers = pick(L.headingNumbers, ['auto', 'none', 'arabic', 'chinese'], d.headingNumbers);
  out.headingShift = Math.round(num(L.headingShift, -1, 2, 0));
  out.headingScale = num(L.headingScale, 0.7, 1.4, 1);
  out.eqNumbers = pick(L.eqNumbers, ['none', 'all', 'tagged'], d.eqNumbers);
  out.eqWithinSection = !!L.eqWithinSection;
  out.mathMode = pick(L.mathMode, ['keep', 'long-display', 'all-display', 'short-inline', 'all-inline'], d.mathMode);
  out.longMath = Math.round(num(L.longMath, 8, 200, d.longMath));
  out.imageWidth = num(L.imageWidth, 0.15, 1, d.imageWidth);
  out.imageMaxHeight = num(L.imageMaxHeight, 0.15, 0.9, d.imageMaxHeight);
  out.questionNewPage = !!L.questionNewPage;
  out.pageNumbers = L.pageNumbers !== false;
  out.runningHeader = L.runningHeader !== false;
  out.toc = pick(L.toc, ['auto', 'on', 'off'], d.toc);
  out.accent = ACCENTS[L.accent] ? L.accent : /^[0-9a-f]{6}$/i.test(String(L.accent || '')) ? String(L.accent).toUpperCase() : d.accent;
  out.questionStyle = pick(L.questionStyle, ['bubble', 'box', 'plain'], d.questionStyle);
  out.codeTheme = pick(L.codeTheme, ['light', 'dark'], d.codeTheme);
  out.dynamic = pick(L.dynamic, ['image', 'text', 'both'], d.dynamic);
  out.followPage = L.followPage !== false;
  return out;
}

export function accentHex(layout) {
  return ACCENTS[layout.accent] || layout.accent || ACCENTS.indigo;
}

/** The fonts a layout resolves to, per theme. */
export function resolvedFonts(layout) {
  const web = layout.theme === 'web';
  return {
    cjk: layout.cjkFont === 'auto' ? (web ? 'hei' : 'song') : layout.cjkFont,
    latin: layout.latinFont === 'auto' ? (web ? 'sans' : 'stix') : layout.latinFont,
    math: layout.mathFont === 'auto' ? (web ? 'lm' : 'stix') : layout.mathFont,
    mono: layout.monoFont === 'auto' ? 'system' : layout.monoFont,
  };
}

export function normalizeOverrides(o = {}) {
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  return {
    math: obj(o.math),           // oid → 'display' | 'inline'
    heading: obj(o.heading),     // oid → 1..4 (level) | 0 (plain paragraph)
    image: obj(o.image),         // oid → width fraction
    breakBefore: obj(o.breakBefore), // oid → true
    hide: obj(o.hide),           // oid → true
    eqNumber: obj(o.eqNumber),   // oid → true | false
  };
}

export function overridesCount(o) {
  const n = normalizeOverrides(o);
  return Object.values(n).reduce((a, m) => a + Object.keys(m).length, 0);
}

// ---------------------------------------------------------------------------
// Turns and ids
// ---------------------------------------------------------------------------

export function turnsOf(messages) {
  const turns = [];
  for (const m of messages) {
    if (m.role === 'user') turns.push({ question: m.blocks, answer: [] });
    else if (turns.length) turns.at(-1).answer.push(...m.blocks);
    else turns.push({ question: null, answer: [...m.blocks] });
  }
  return turns;
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function assignInline(inl, base, ctr) {
  for (const x of inl || []) {
    if (x.t === 'math') x.oid = `${base}.m${ctr.n++}`;
    if (x.c) assignInline(x.c, base, ctr);
  }
}

function assignBlocks(blocks, base) {
  blocks.forEach((b, i) => {
    const id = `${base}.${i}`;
    b.oid = id;
    if (b.inl) assignInline(b.inl, id, { n: 0 });
    if (b.items) b.items.forEach((it, j) => assignBlocks(it, `${id}.${j}`));
    if (b.blocks) assignBlocks(b.blocks, id);
    if (b.rows) b.rows.forEach((r, ri) => r.cells.forEach((c, ci) => assignInline(c, `${id}.r${ri}c${ci}`, { n: 0 })));
    if (b.fallback) assignBlocks(b.fallback, `${id}.f`);
  });
}

// ---------------------------------------------------------------------------
// Formula rules
// ---------------------------------------------------------------------------

const BIG_OPERATOR = /\\(frac|dfrac|sum|prod|int|iint|iiint|oint|lim|begin\{(p|b|v|B|V)?matrix\}|begin\{cases\}|binom|sqrt\[|underbrace|overbrace|bigcup|bigcap)/;

/** Would this inline formula read better on a line of its own? */
export function isLongInline(tex, threshold = LAYOUT_DEFAULTS.longMath) {
  const t = String(tex).trim();
  return t.length >= threshold || (BIG_OPERATOR.test(t) && t.length >= Math.min(14, threshold));
}

/** Short display formula that can sit inside the sentence. */
export function isShortDisplay(tex, threshold = LAYOUT_DEFAULTS.longMath) {
  const t = String(tex).trim();
  if (/\\\\|&|\\begin\{|\\tag/.test(t)) return false;
  return t.length < Math.max(10, Math.round(threshold * 0.7)) && !BIG_OPERATOR.test(t);
}

function wantDisplay(x, layout, overrides) {
  const o = overrides.math[x.oid];
  if (o) return o === 'display';
  if (layout.mathMode === 'all-display') return true;
  if (layout.mathMode === 'long-display') return isLongInline(x.tex, layout.longMath);
  return false;
}

function wantInline(b, layout, overrides) {
  const o = overrides.math[b.oid];
  if (o) return o === 'inline';
  if (/\\\\|&|\\begin\{(align|gather|cases|array|matrix|pmatrix|bmatrix)/.test(b.tex)) return false;
  if (layout.mathMode === 'all-inline') return true;
  if (layout.mathMode === 'short-inline') return isShortDisplay(b.tex, layout.longMath);
  return false;
}

const trimText = (inl, side) => {
  const a = inl;
  if (side === 'end') {
    while (a.length && a.at(-1).t === 'br') a.pop();
    if (a.at(-1)?.t === 'text') a.at(-1).v = a.at(-1).v.replace(/\s+$/, '');
    if (a.at(-1)?.t === 'text' && !a.at(-1).v) a.pop();
  } else {
    while (a.length && a[0].t === 'br') a.shift();
    if (a[0]?.t === 'text') a[0].v = a[0].v.replace(/^\s+/, '');
    if (a[0]?.t === 'text' && !a[0].v) a.shift();
  }
  return a;
};

// Split a paragraph at the inline formulas that should be displayed.
function splitPara(b, layout, overrides) {
  if (!b.inl.some((x) => x.t === 'math' && wantDisplay(x, layout, overrides))) return [b];
  const out = [];
  let cur = [];
  let part = 0;
  const flush = () => {
    trimText(cur, 'start');
    trimText(cur, 'end');
    if (cur.length && cur.some((x) => x.t !== 'text' || /\S/.test(x.v))) out.push({ ...b, inl: cur, oid: part ? `${b.oid}~${part}` : b.oid });
    part++;
    cur = [];
  };
  for (const x of b.inl) {
    if (x.t === 'math' && wantDisplay(x, layout, overrides)) {
      flush();
      out.push({ t: 'math', tex: x.tex, oid: x.oid, fromInline: true });
      continue;
    }
    cur.push(x);
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// The transform
// ---------------------------------------------------------------------------

function transformBlocks(blocks, layout, overrides, ctx) {
  let out = [];
  for (const b0 of blocks) {
    if (overrides.hide[b0.oid]) continue;
    let b = b0;
    if (b.items) b = { ...b, items: b.items.map((it) => transformBlocks(it, layout, overrides, ctx)).filter((it) => it.length) };
    if (b.blocks) b = { ...b, blocks: transformBlocks(b.blocks, layout, overrides, ctx) };
    if (b.t === 'heading') {
      const o = overrides.heading[b.oid];
      if (o === 0 || o === '0') b = { t: 'para', inl: [{ t: 'b', c: b.inl }], oid: b.oid, wasHeading: b.level };
      else {
        // A level chosen in the preview is absolute (1 = the answer's top heading level); the global
        // shift is applied by the writer relative to the answer's own top level.
        if (o) b = { ...b, level: Math.max(1, Math.min(4, Number(o))), userLevel: true };
      }
    }
    if (b.t === 'image' && overrides.image[b.oid]) b = { ...b, width: Math.max(0.1, Math.min(1, Number(overrides.image[b.oid]))) };
    if (b.t === 'math' && overrides.eqNumber[b.oid] !== undefined) b = { ...b, numbered: !!overrides.eqNumber[b.oid] };
    if (overrides.breakBefore[b.oid]) b = { ...b, breakBefore: true };
    if (b.t === 'para') {
      const pieces = ctx.noSplit ? [b] : splitPara(b, layout, overrides);
      const prev = out.at(-1);
      if (prev && prev.joinNext && pieces[0] && pieces[0].t === 'para' && !pieces[0].breakBefore) {
        // The sentence continues after a formula that was moved into the paragraph before.
        const first = pieces.shift();
        const head = first.inl[0];
        const glue = head && head.t === 'text' && /^[\s,.;:!?，。；：！？、）)]/.test(head.v) ? [] : [{ t: 'text', v: ' ' }];
        prev.inl = [...prev.inl, ...glue, ...first.inl];
      }
      if (prev) delete prev.joinNext;
      out.push(...pieces);
      continue;
    }
    if (b.t === 'math' && !ctx.noMerge && wantInline(b, layout, overrides)) {
      // Into the sentence before it; the text after it joins too when it continues the sentence.
      const prev = out.at(-1);
      const m = { t: 'math', tex: b.tex, oid: b.oid, fromDisplay: true };
      if (prev && prev.t === 'para') {
        prev.inl = [...trimText([...prev.inl], 'end'), { t: 'text', v: ' ' }, m];
        prev.joinNext = true;
      } else {
        out.push({ t: 'para', inl: [m], oid: `${b.oid}~p`, joinNext: true });
      }
      continue;
    }
    const prev = out.at(-1);
    if (b.t === 'para' && prev && prev.joinNext) {
      const first = b.inl[0];
      const glue = first && first.t === 'text' && /^[\s,.;:!?，。；：！？、）)]/.test(first.v) ? [] : [{ t: 'text', v: ' ' }];
      prev.inl = [...prev.inl, ...glue, ...b.inl];
      delete prev.joinNext;
      continue;
    }
    if (prev) delete prev.joinNext;
    out.push(b);
  }
  out.forEach((b) => delete b.joinNext);
  // Two transforms can leave empty paragraphs behind.
  out = out.filter((b) => b.t !== 'para' || b.inl.length);
  return out;
}

/**
 * Conversation → turns with oids, with the layout and the overrides applied.
 * Returns { turns: [{ question, answer, oid }], stats }.
 */
export function prepareDocument(conv, layout = LAYOUT_DEFAULTS, overrides = {}) {
  const L = layout.theme ? layout : normalizeLayout(layout);
  const O = normalizeOverrides(overrides);
  const raw = turnsOf(clone(conv.messages));
  const stats = { inlineMath: 0, displayMath: 0, longInline: 0, shortDisplay: 0, headings: 0, images: 0, dynamic: 0 };
  raw.forEach((t, k) => {
    if (t.question) assignBlocks(t.question, `t${k}.q`);
    assignBlocks(t.answer, `t${k}.a`);
  });
  const count = (blocks) => {
    for (const b of blocks) {
      if (b.t === 'math') { stats.displayMath++; if (isShortDisplay(b.tex, L.longMath)) stats.shortDisplay++; }
      if (b.t === 'heading') stats.headings++;
      if (b.t === 'image') stats.images++;
      if (b.t === 'dynamic') stats.dynamic++;
      const inl = (arr) => (arr || []).forEach((x) => { if (x.t === 'math') { stats.inlineMath++; if (isLongInline(x.tex, L.longMath)) stats.longInline++; } if (x.c) inl(x.c); });
      inl(b.inl);
      if (b.items) b.items.forEach(count);
      if (b.blocks) count(b.blocks);
    }
  };
  raw.forEach((t) => { if (t.question) count(t.question); count(t.answer); });
  const turns = raw.map((t, k) => ({
    oid: `t${k}`,
    // The prompt is plain text the user typed; formulas there stay as typed.
    question: t.question ? transformBlocks(t.question, L, O, { noSplit: true, noMerge: true }) : null,
    answer: transformBlocks(t.answer, L, O, {}),
    breakBefore: !!O.breakBefore[`t${k}`] || (L.questionNewPage && k > 0),
  }));
  return { turns, stats, layout: L, overrides: O };
}

/** Heading level after shift, for callers that only have the raw IR. */
export function minHeading(blocks) {
  let min = 7;
  const walk = (bs) => bs.forEach((b) => {
    if (b.t === 'heading') min = Math.min(min, b.level);
    if (b.t === 'list') b.items.forEach(walk);
  });
  walk(blocks || []);
  return min === 7 ? 2 : min;
}

export { blockTextLength };
