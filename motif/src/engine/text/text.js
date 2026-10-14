// Typography engine: rich-text parsing, CJK-aware line breaking (kinsoku), CJK/Latin spacing,
// balanced headings, orphan control, auto-fit and per-unit animated drawing on canvas.

// ───────────────────────────── rich text ─────────────────────────────
const RICH_RE = /`([^`]+)`|\*\*(.+?)\*\*|==(.+?)==|\{\{(.+?)\}\}|~~(.+?)~~|(?<![\p{L}\p{N}*])\*(?!\s)(.+?)(?<!\s)\*(?![\p{L}\p{N}*])/gu;

export function parseRich(input, style = {}) {
  const s = String(input ?? '').replace(/\r\n?/g, '\n').replace(/\\n/g, '\n');
  const out = [];
  let last = 0;
  const re = new RegExp(RICH_RE.source, 'gu');
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), ...style });
    if (m[1] != null) out.push({ text: m[1], ...style, code: true });
    else if (m[2] != null) out.push(...parseRich(m[2], { ...style, b: true }));
    else if (m[3] != null) out.push(...parseRich(m[3], { ...style, accent: true }));
    else if (m[4] != null) out.push(...parseRich(m[4], { ...style, mark: true }));
    else if (m[5] != null) out.push(...parseRich(m[5], { ...style, strike: true }));
    else if (m[6] != null) out.push(...parseRich(m[6], { ...style, i: true }));
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last), ...style });
  return out.filter((r) => r.text.length);
}

export const plainText = (s) => parseRich(s).map((r) => r.text).join('');

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
    if (opts.upper) text = text.toUpperCase();
    const style = { ...run };
    delete style.text;
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
  return units;
}

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
      u.w = this.width(u.t, u.font, u.s.code ? 0 : tracking, stretch);
    }
    // CJK ↔ Latin spacing (盘古之白): add a gap where an ideograph meets a word without a space.
    for (let i = 1; i < units.length; i++) {
      const a = units[i - 1], b = units[i];
      if ((a.k === 'cjk' && b.k === 'w') || (a.k === 'w' && b.k === 'cjk')) b.gap = cjkGap;
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
    } else if (o.orphans !== false && lines.length > 1 && Number.isFinite(maxWidth)) {
      const lastLine = lines[lines.length - 1];
      const visible = lastLine.units.filter((u) => u.k !== 'sp');
      if (visible.length === 1 && visible[0].k !== 'w' || (visible.length === 1 && visible[0].t.length <= 3)) {
        const prev = lines[lines.length - 2];
        const tryW = prev.width - (prev.units[prev.units.length - 1]?.w || 0) * 1.5 - 1;
        const alt = breakLines(units, tryW);
        if (alt.length === lines.length) lines = alt;
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
    if (top.fits) return top.L;
    for (let k = 0; k < 9; k++) {
      const mid = (lo + hi) / 2;
      const r = ok(mid);
      if (r.fits) { lo = mid; best = r.L; } else hi = mid;
    }
    if (!best) { best = ok(min).L; best.overflow = true; }
    return best;
  }
}

function breakLines(units, maxWidth) {
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
      cur.push(u); w += u.w; lastBreak = cur.length; continue;
    }
    const prev = cur[cur.length - 1];
    const canBreakHere = cur.length > 0 && !NO_START.has(u.t[0]) && !(prev && NO_END.has(prev.t[prev.t.length - 1])) && (prev.k === 'sp' || u.k === 'cjk' || u.k === 'cp' || prev.k === 'cjk' || prev.k === 'cp');
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
      if (st?.typeChars != null && st.typeChars < u.t.length) {
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
