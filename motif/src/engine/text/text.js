// Typography engine: rich-text parsing, CJK-aware line breaking (kinsoku), CJK/Latin spacing,
// balanced headings, orphan control, auto-fit and per-unit animated drawing on canvas.
// Inline TeX ($…$ or \(…\)) works in every text: it is typeset by MathJax and laid out as one
// unbreakable unit on the text baseline.
import { texGlyphs, glyphPath } from '../math/tex.js';

// ───────────────────────────── inline math ─────────────────────────────
// $…$ follows the pandoc rule so prices stay text: the opening $ is followed by a non-space, the
// closing $ follows a non-space and is not followed by a digit ("$5 and $10", "$5–$10" are text).
const MATH_RE = /\\\((.+?)\\\)|\$(?=[^\s$])((?:\\.|[^$\\\n])+?)(?<=[^\s\\])\$(?!\d)/g;
const PUA = 0xe000;

/** Split a string into [{text}|{math}] segments. */
export function splitMath(input) {
  const s = String(input ?? '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(MATH_RE)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ math: m[1] ?? m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}
export const hasMath = (s) => typeof s === 'string' && (s.includes('$') || s.includes('\\(')) && splitMath(s).some((x) => x.math != null);

// ───────────────────────────── rich text ─────────────────────────────
const RICH_RE = /`([^`]+)`|\*\*(.+?)\*\*|==(.+?)==|\{\{(.+?)\}\}|~~(.+?)~~|(?<![\p{L}\p{N}*])\*(?!\s)(.+?)(?<!\s)\*(?![\p{L}\p{N}*])/gu;

export function parseRich(input, style = {}, maths = null) {
  let s = String(input ?? '').replace(/\r\n?/g, '\n');
  if (!maths) {
    // Lift math out first: TeX must not see the markup rules or the literal "\n" → newline rule
    // (which would turn \nabla, \neq, \nu into a line break).
    maths = [];
    s = s.replace(MATH_RE, (m, a, b) => (maths.length < 6000 ? String.fromCharCode(PUA + maths.push(a ?? b) - 1) : m));
    s = s.replace(/\\n/g, '\n');
    return parseRich(s, style, maths).flatMap((r) => restoreMath(r, maths));
  }
  const out = [];
  let last = 0;
  const re = new RegExp(RICH_RE.source, 'gu');
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), ...style });
    if (m[1] != null) out.push({ text: m[1], ...style, code: true });
    else if (m[2] != null) out.push(...parseRich(m[2], { ...style, b: true }, maths));
    else if (m[3] != null) out.push(...parseRich(m[3], { ...style, accent: true }, maths));
    else if (m[4] != null) out.push(...parseRich(m[4], { ...style, mark: true }, maths));
    else if (m[5] != null) out.push(...parseRich(m[5], { ...style, strike: true }, maths));
    else if (m[6] != null) out.push(...parseRich(m[6], { ...style, i: true }, maths));
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last), ...style });
  return out.filter((r) => r.text.length);
}

function restoreMath(run, maths) {
  if (!/[\ue000-\uf8ff]/.test(run.text)) return [run];
  const back = (c) => { const i = c.charCodeAt(0) - PUA; return i >= 0 && i < maths.length ? maths[i] : null; };
  // inside `code` math stays literal
  if (run.code) return [{ ...run, text: run.text.replace(/[\ue000-\uf8ff]/g, (c) => (back(c) != null ? `$${back(c)}$` : c)) }];
  const out = [];
  let buf = '';
  for (const c of run.text) {
    const tex = back(c);
    if (tex == null) { buf += c; continue; }
    if (buf) { out.push({ ...run, text: buf }); buf = ''; }
    out.push({ ...run, text: tex, math: true });
  }
  if (buf) out.push({ ...run, text: buf });
  return out;
}

/** Text without markup; inline math keeps its $…$ source. */
export const plainText = (s) => parseRich(s).map((r) => (r.math ? `$${r.text}$` : r.text)).join('');

// ───────────────────────────── classification ─────────────────────────────
const CJK_RE = /[⺀-⿟　-〿぀-ヿ㄀-ㄯ㆐-ㇿ㐀-䶿一-鿿가-힯豈-﫿︰-﹏＀-￯]/;
const CJK_PUNCT_RE = /[　-〿＀-／：-＠［-｀｛-･︰-﹏“”‘’…—·]/;
const NO_START = new Set([...'，。、；：！？）」』〉》】〕’”…—～·％‰,.;:!?)]}%ー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ']);
const NO_END = new Set([...'（「『〈《【〔‘“([{$¥￥#@']);
const isSpace = (c) => c === ' ' || c === '\t' || c === ' ';

/** Split runs into breakable units. */
let segmenter = null;
function wordStarts(text) {
  try {
    if (!segmenter) segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    const set = new Set();
    for (const s of segmenter.segment(text)) set.add(s.index);
    return set;
  } catch { return null; }
}

export function tokenize(runs, opts = {}) {
  const units = [];
  for (const run of runs) {
    let text = run.text;
    const style = { ...run };
    delete style.text;
    if (run.math) { delete style.math; units.push({ t: text, k: 'math', s: style }); continue; }
    if (opts.upper) text = text.toUpperCase();
    const starts = opts.words ? wordStarts(text) : null;
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\n') { units.push({ t: '\n', k: 'nl', s: style }); i++; continue; }
      if (isSpace(ch)) {
        let j = i; while (j < text.length && isSpace(text[j])) j++;
        units.push({ t: ' ', k: 'sp', s: style }); i = j; continue;
      }
      const cp = text.codePointAt(i);
      const c = String.fromCodePoint(cp);
      if (CJK_RE.test(c) || cp > 0x1f000) {
        const k = CJK_PUNCT_RE.test(c) ? 'cp' : 'cjk';
        const last = units[units.length - 1];
        // Headings keep CJK words together (Intl.Segmenter) so lines never split 数|据.
        if (starts && k === 'cjk' && last && last.k === 'cjk' && last.s === style && !starts.has(i) && last.t.length < 6) last.t += c;
        else units.push({ t: c, k, s: style });
        i += c.length; continue;
      }
      let j = i;
      while (j < text.length) {
        const cj = text[j];
        if (cj === '\n' || isSpace(cj)) break;
        const cpj = text.codePointAt(j);
        const cc = String.fromCodePoint(cpj);
        if (CJK_RE.test(cc) || cpj > 0x1f000) break;
        j += cc.length;
      }
      units.push({ t: text.slice(i, j), k: 'w', s: style });
      i = j;
    }
  }
  // Keep a number with its unit/measure word: "18 个月", "3 小时", "26 亿" never split across lines.
  for (let i = 1; i < units.length - 1; i++) {
    const a = units[i - 1], u = units[i], b = units[i + 1];
    if (u.k === 'sp' && a.k === 'w' && NUMERIC_END.test(a.t) && b.k === 'cjk') u.nb = true;
  }
  // …including two-character units split by the segmenter: 个|月, 小|时, 分|钟, 公|里, 百|万
  for (let i = 1; i < units.length - 1; i++) {
    const u = units[i], b = units[i + 1], a = units[i - 1];
    const afterNum = (a.k === 'sp' && a.nb) || (a.k === 'w' && NUMERIC_END.test(a.t));
    if (afterNum && u.k === 'cjk' && u.t.length === 1 && b.k === 'cjk' && UNIT_PAIRS.has(u.t + b.t[0])) u.glueNext = true;
  }
  return units;
}
function endsAtPunct(l) { const last = l.units[l.units.length - 1]; return !!last && (last.k === 'cp' || /[,.;:!?，。；：！？、）)」”]$/.test(last.t)); }
const NUMERIC_END = /(^|[^A-Za-z])[\d.,]+[%‰+]?$/;
const UNIT_PAIRS = new Set(['个月', '小时', '分钟', '公里', '百万', '千万', '美元', '万元', '亿元', '个人', '周年', '年级', '平方', '立方', '公斤', '毫秒', '秒钟', '倍数', '百分']);

// ───────────────────────────── fonts ─────────────────────────────
export function familyList(fam) {
  return (Array.isArray(fam) ? fam : [fam]).map((f) => (/^[a-z-]+$/.test(f) ? f : `"${f}"`)).join(', ') + ', sans-serif';
}

export function fontString(role, size, style = {}) {
  let weight = role.weight || 400;
  if (style.b) weight = Math.min(900, role.strong || weight + 220);
  if (style.code) return `${Math.max(400, weight - 100)} ${size * 0.9}px ${familyList(['Motif Mono', 'Motif Sans SC'])}`;
  return `${style.i ? 'italic ' : ''}${Math.round(weight)} ${size}px ${familyList(role.family)}`;
}

// ───────────────────────────── engine ─────────────────────────────
export class TextEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.cache = new Map();
  }

  _setFont(font, tracking, stretch) {
    const c = this.ctx;
    if (c.font !== font) c.font = font;
    const ls = `${tracking}px`;
    if ('letterSpacing' in c && c.letterSpacing !== ls) c.letterSpacing = ls;
    if ('fontStretch' in c) c.fontStretch = stretch || 'normal';
  }

  width(text, font, tracking = 0, stretch) {
    const key = font + '|' + tracking + '|' + (stretch || '') + '|' + text;
    let w = this.cache.get(key);
    if (w == null) {
      this._setFont(font, tracking, stretch);
      w = this.ctx.measureText(text).width;
      if (this.cache.size > 60000) this.cache.clear();
      this.cache.set(key, w);
    }
    return w;
  }

  /**
   * Lay out rich text.
   * @param {string|object[]} input  rich string or runs
   * @param {object} role  font role {family, weight, tracking(em), lineHeight, case, stretch}
   * @param {number} size  px
   * @param {object} o  {maxWidth, balance, align, orphans}
   */
  layout(input, role, size, o = {}) {
    const runs = typeof input === 'string' || input == null ? parseRich(input) : input;
    const units = tokenize(runs, { upper: role.case === 'upper', words: o.words ?? !!o.balance });
    const tracking = (role.tracking || 0) * size;
    const stretch = role.stretch;
    const cjkGap = size * 0.2;
    for (const u of units) {
      if (u.k === 'nl') { u.w = 0; continue; }
      u.font = fontString(role, size, u.s);
      if (u.k === 'math') {
        const T = mathGlyphs(u.t);
        if (T) { u.tex = T; u.w = (T.width * size) / 1000; continue; }
        // not valid TeX (or no DOM, e.g. in Node): show the source as written
        u.k = 'w'; u.t = `$${u.t}$`;
      }
      u.w = this.width(u.t, u.font, u.s.code ? 0 : tracking, stretch);
    }
    // CJK ↔ Latin spacing (盘古之白): add a gap where an ideograph meets a word or formula without a space.
    const latin = (k) => k === 'w' || k === 'math';
    for (let i = 1; i < units.length; i++) {
      const a = units[i - 1], b = units[i];
      if ((a.k === 'cjk' && latin(b.k)) || (latin(a.k) && b.k === 'cjk')) b.gap = cjkGap;
    }
    const maxWidth = o.maxWidth ?? Infinity;
    let lines = breakLines(units, maxWidth);
    if (o.balance && lines.length > 1 && Number.isFinite(maxWidth)) {
      const n = lines.length;
      const natural = Math.max(...lines.map((l) => l.width));
      let lo = natural / n * 0.9, hi = natural;
      for (let k = 0; k < 14; k++) {
        const mid = (lo + hi) / 2;
        if (breakLines(units, mid).length > n) lo = mid; else hi = mid;
      }
      lines = breakLines(units, hi + 0.5);
      // Prefer a slightly less even layout whose lines end at punctuation (。，、：) over one that
      // splits a phrase: "确定的方程，/ 不可预测的运动" rather than "确定的 / 方程，不可 / …".
      const endsWell = endsAtPunct;
      if (!lines.slice(0, -1).every(endsWell)) {
        for (let k = 1; k <= 10; k++) {
          const alt = breakLines(units, hi + ((maxWidth - hi) * k) / 10 + 0.5);
          if (alt.length > n) continue;
          const widths = alt.map((l) => l.width);
          if (alt.length > 1 && alt.slice(0, -1).every(endsWell) && Math.min(...widths) >= Math.max(...widths) * 0.34) { lines = alt; break; }
        }
      }
    } else if (o.orphans !== false && lines.length > 1 && Number.isFinite(maxWidth)) {
      // Orphan control: never leave 1–2 characters (or one short word) alone on the last line.
      const weight = (L) => L.units.reduce((n, u) => n + (u.k === 'cjk' ? [...u.t].length : u.k === 'w' || u.k === 'math' ? 2 : 0), 0);
      if (weight(lines[lines.length - 1]) <= 2) {
        const n = lines.length;
        for (let k = 1; k <= 10; k++) {
          const alt = breakLines(units, maxWidth - size * k);
          if (alt.length > n + (n >= 3 ? 0 : 1)) break;
          if (weight(alt[alt.length - 1]) >= 3) { lines = alt; break; }
        }
      }
    }
    const lh = size * (o.lineHeight ?? role.lineHeight ?? 1.3);
    const width = Math.max(0, ...lines.map((l) => l.width));
    let idx = 0;
    lines.forEach((l, li) => {
      l.y = li * lh;
      l.index = li;
      for (const u of l.units) if (u.k !== 'sp') u.order = idx++;
    });
    return { lines, width, height: lines.length * lh, size, lineHeight: lh, role, unitCount: idx, maxWidth, align: o.align || 'left', tracking, stretch };
  }

  /** Largest size in [min,max] whose layout fits the box (and maxLines). */
  fit(input, role, o) {
    const { maxWidth, maxHeight = Infinity, maxLines = Infinity, min = 12, max = 200 } = o;
    let lo = min, hi = max, best = null;
    const ok = (sz) => {
      const L = this.layout(input, role, sz, o);
      return { L, fits: L.height <= maxHeight && L.lines.length <= maxLines && L.width <= maxWidth + 0.5 };
    };
    const top = ok(hi);
    if (top.fits) best = top.L;
    else {
      for (let k = 0; k < 9; k++) {
        const mid = (lo + hi) / 2;
        const r = ok(mid);
        if (r.fits) { lo = mid; best = r.L; } else hi = mid;
      }
      if (!best) { best = ok(min).L; best.overflow = true; }
    }
    // A slightly smaller size is worth it if every line can then end at punctuation.
    if (best.overflow) return best;
    if (o.balance && best.lines.length > 1 && !best.lines.slice(0, -1).every(endsAtPunct) && /[，、：；。,]/.test(typeof input === 'string' ? input : '')) {
      for (const f of [0.95, 0.9, 0.85]) {
        const r = ok(best.size * f);
        if (r.fits && r.L.lines.slice(0, -1).every(endsAtPunct)) return r.L;
      }
    }
    return best;
  }
}

function breakLines(unitsIn, maxWidth) {
  const units = unitsIn.slice(); // hard-breaking inserts fragments; never mutate the caller's array
  const lines = [];
  let cur = [], w = 0, lastBreak = -1;
  const pushLine = (arr) => {
    while (arr.length && arr[arr.length - 1].k === 'sp') arr.pop();
    let x = 0;
    const out = arr.map((u, i) => {
      const gap = i === 0 ? 0 : (u.gap || 0);
      x += gap;
      const p = { ...u, x };
      x += u.w;
      return p;
    });
    lines.push({ units: out, width: x });
  };
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.k === 'nl') { pushLine(cur); cur = []; w = 0; lastBreak = -1; continue; }
    if (u.k === 'sp') {
      if (!cur.length) continue;
      cur.push(u); w += u.w; if (!u.nb) lastBreak = cur.length; continue;
    }
    const prev = cur[cur.length - 1];
    const glued = prev && ((prev.k === 'sp' && prev.nb) || prev.glueNext || (prev.k === 'w' && u.k === 'cjk' && NUMERIC_END.test(prev.t)));
    const first = u.k === 'math' ? '' : u.t[0], lastCh = prev && prev.k !== 'math' ? prev.t[prev.t.length - 1] : '';
    const canBreakHere = cur.length > 0 && !glued && !NO_START.has(first) && !NO_END.has(lastCh) && (prev.k === 'sp' || u.k === 'cjk' || u.k === 'cp' || prev.k === 'cjk' || prev.k === 'cp');
    if (canBreakHere) lastBreak = cur.length;
    const add = u.w + (cur.length ? u.gap || 0 : 0);
    if (w + add > maxWidth && cur.length) {
      if (u.k === 'w' && u.w > maxWidth && !cur.some((c) => c.k !== 'sp')) {
        // nothing to break against; overflow
      } else if (canBreakHere) {
        pushLine(cur); cur = []; w = 0; lastBreak = -1;
      } else if (lastBreak > 0) {
        const carry = cur.slice(lastBreak);
        pushLine(cur.slice(0, lastBreak));
        cur = carry.filter((c, k) => !(k === 0 && c.k === 'sp'));
        w = cur.reduce((s, c, k) => s + c.w + (k ? c.gap || 0 : 0), 0);
        lastBreak = -1;
      }
    }
    // Very long latin word wider than the line: hard-break by characters.
    if (u.k === 'w' && u.w > maxWidth && maxWidth > 0 && u.t.length > 1) {
      const per = u.w / u.t.length;
      const n = Math.max(1, Math.floor((maxWidth - w) / per));
      if (cur.length && n < 2) { pushLine(cur); cur = []; w = 0; }
      const n2 = Math.max(1, Math.floor((maxWidth - w) / per));
      const head = { ...u, t: u.t.slice(0, n2), w: per * n2 };
      const tail = { ...u, t: u.t.slice(n2), w: per * (u.t.length - n2) };
      cur.push(head); pushLine(cur); cur = []; w = 0; lastBreak = -1;
      units.splice(i + 1, 0, tail);
      continue;
    }
    cur.push(u);
    w += cur.length > 1 ? add : u.w;
  }
  if (cur.length || !lines.length) pushLine(cur);
  return lines;
}

// ───────────────────────────── drawing ─────────────────────────────

/**
 * Draw a laid-out text block.
 * @param ctx canvas context
 * @param L layout from TextEngine.layout
 * @param x,y top-left of the text box; w = box width used for alignment
 * @param paint { color, accent, accentFill(ctx, box)->fillStyle, mark, code, strike }
 * @param unitState optional (unit, line) => state|null for animation; returns false to skip
 */
export function drawLayout(ctx, L, x, y, w, paint, unitState, applyState) {
  const align = L.align;
  const lh = L.lineHeight;
  const baseOff = lh / 2 + L.size * 0.36;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${L.tracking}px`;
  if ('fontStretch' in ctx) ctx.fontStretch = L.stretch || 'normal';
  for (const line of L.lines) {
    const ox = align === 'center' ? (w - line.width) / 2 : align === 'right' ? w - line.width : 0;
    const by = y + line.y + baseOff;
    // marker highlights behind text
    for (const u of line.units) {
      if (!u.s.mark || u.k === 'sp') continue;
      const st = unitState ? unitState(u, line) : null;
      if (st === false) continue;
      const p = st?.markProgress ?? 1;
      if (p <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= st?.alpha ?? 1;
      ctx.fillStyle = paint.mark;
      const ux = x + ox + u.x - L.size * 0.08;
      ctx.fillRect(ux, by - L.size * 0.78, (u.w + L.size * 0.16) * p, L.size * 0.98);
      ctx.restore();
    }
    for (const u of line.units) {
      if (u.k === 'sp') continue;
      const ux = x + ox + u.x;
      let st = null;
      if (unitState) {
        st = unitState(u, line);
        if (st === false) continue;
      }
      ctx.save();
      if (st && applyState) {
        if (!applyState(ctx, st, { x: ux, y: y + line.y, w: u.w, h: lh, pad: L.size * 0.05 }, { x: ux + u.w / 2, y: by - L.size * 0.35 })) { ctx.restore(); continue; }
      }
      ctx.font = u.font;
      if ('letterSpacing' in ctx) ctx.letterSpacing = u.s.code ? '0px' : `${L.tracking}px`;
      if (u.s.code) {
        ctx.fillStyle = paint.codeBg || 'rgba(127,127,127,0.18)';
        roundRect(ctx, ux - L.size * 0.12, by - L.size * 0.8, u.w + L.size * 0.24, L.size * 1.02, L.size * 0.18);
        ctx.fill();
      }
      let fill = paint.color;
      if (u.s.accent) fill = paint.accentFill ? paint.accentFill(ctx, { x: ux, y: by - L.size, w: u.w, h: L.size }) : paint.accent;
      if (u.s.code) fill = paint.code || paint.color;
      ctx.fillStyle = fill;
      if (u.s.accent && paint.glow) { ctx.shadowColor = paint.glow; ctx.shadowBlur = L.size * 0.5; }
      if (u.k === 'math') {
        const prog = st?.typeChars != null && st.typeChars < u.t.length ? st.typeChars / Math.max(1, u.t.length) : 1;
        if (prog > 0) drawMathGlyphs(ctx, u.tex, ux, by, L.size, fill, prog);
      } else if (st?.typeChars != null && st.typeChars < u.t.length) {
        const part = [...u.t].slice(0, st.typeChars).join('');
        if (part) ctx.fillText(part, ux, by);
      } else {
        ctx.fillText(u.t, ux, by);
      }
      if (u.s.strike) {
        ctx.fillRect(ux, by - L.size * 0.3, u.w, Math.max(1.5, L.size * 0.06));
      }
      ctx.restore();
    }
  }
}

// ───────────────────────────── math units ─────────────────────────────
function mathGlyphs(tex) {
  const T = texGlyphs(tex, false);
  return T && !T.error && T.glyphs.length ? T : null;
}

/** Draw inline TeX with its baseline at y. `prog` < 1 shows the first glyphs only (typewriter). */
function drawMathGlyphs(ctx, T, x, y, size, color, prog = 1) {
  const s = size / 1000;
  const n = prog >= 1 ? T.glyphs.length : Math.ceil(T.glyphs.length * prog);
  ctx.save();
  ctx.translate(x, y + T.minY * s);
  ctx.scale(s, s);
  for (let i = 0; i < n; i++) {
    const g = T.glyphs[i];
    ctx.save();
    ctx.transform(...g.m);
    ctx.fillStyle = g.color || color;
    if (g.kind === 'rect') { const [rx, ry, rw, rh] = g.rect; ctx.fillRect(rx, ry, rw, rh); } else ctx.fill(glyphPath(g.d));
    ctx.restore();
  }
  ctx.restore();
}

function fontPx(font) { const m = /(\d+(?:\.\d+)?)px/.exec(font || ''); return m ? +m[1] : 16; }

/** Width of a one-line label drawn with drawInline, using the context's current font. */
export function measureInline(ctx, text) {
  if (!hasMath(text)) return ctx.measureText(String(text ?? '')).width;
  const fs = fontPx(ctx.font);
  return splitMath(text).reduce((w, seg) => {
    if (seg.text != null) return w + ctx.measureText(seg.text).width;
    const T = mathGlyphs(seg.math);
    return w + (T ? (T.width * fs) / 1000 : ctx.measureText(`$${seg.math}$`).width);
  }, 0);
}

/**
 * fillText for one-line labels (chart axes, diagram labels, captions…) that may contain inline TeX.
 * Uses the context's font, fillStyle, textAlign and textBaseline; plain strings go straight to fillText.
 */
export function drawInline(ctx, text, x, y, maxWidth) {
  const str = String(text ?? '');
  if (!hasMath(str)) { if (maxWidth == null) ctx.fillText(str, x, y); else ctx.fillText(str, x, y, maxWidth); return; }
  const fs = fontPx(ctx.font);
  const segs = splitMath(str).map((seg) => {
    if (seg.text != null) return { text: seg.text, w: ctx.measureText(seg.text).width };
    const T = mathGlyphs(seg.math);
    return T ? { T, w: (T.width * fs) / 1000 } : { text: `$${seg.math}$`, w: ctx.measureText(`$${seg.math}$`).width };
  });
  const total = segs.reduce((a, b) => a + b.w, 0);
  const k = maxWidth != null && total > maxWidth ? maxWidth / total : 1;
  const align = ctx.textAlign, base = ctx.textBaseline;
  let cx = align === 'center' ? x - (total * k) / 2 : align === 'right' || align === 'end' ? x - total * k : x;
  // the TeX is placed on the alphabetic baseline the label would use
  const by = base === 'middle' ? y + fs * 0.35 : base === 'top' || base === 'hanging' ? y + fs * 0.8 : base === 'bottom' || base === 'ideographic' ? y - fs * 0.22 : y;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (k < 1) { ctx.translate(cx, by); ctx.scale(k, 1); ctx.translate(-cx, -by); }
  for (const seg of segs) {
    if (seg.T) drawMathGlyphs(ctx, seg.T, cx, by, fs, ctx.fillStyle);
    else ctx.fillText(seg.text, cx, by);
    cx += seg.w;
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Collect every (role font, text) pair so fonts can be loaded before layout. */
export function textSample(input) {
  return plainText(input);
}
