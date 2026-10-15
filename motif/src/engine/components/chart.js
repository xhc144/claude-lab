// Motion-first chart engine. Every kind follows the same choreography:
//   frame (axes, grid, labels) → marks (staggered growth) → values → highlight → annotations.
// Styling comes from theme.chart (grid, radius, glow, hatch, outline, dot) and the palette.
import {
  role, drawText, roundRect, toCss, EASE, clamp01, colorOf, formatNumber, decimalsOf, mix, drawIcon, textAnimator, paintFor,
} from './kit.js';
import { fontString } from '../text/text.js';

const TAU = Math.PI * 2;

export function niceScale(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  if (min === max) { max = min === 0 ? 1 : min * 1.2; if (min > 0) min = 0; }
  const span = max - min;
  let step = 10 ** Math.floor(Math.log10(span / count));
  const err = span / count / step;
  if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
  const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) ticks.push(+v.toFixed(10));
  return { min: lo, max: hi, step, ticks };
}

function axisLabel(v, step) {
  const dec = step < 1 ? Math.min(3, Math.ceil(-Math.log10(step))) : 0;
  const a = Math.abs(v);
  if (a >= 1e9) return formatNumber(v / 1e9, { decimals: a % 1e9 ? 1 : 0 }) + 'B';
  if (a >= 1e6) return formatNumber(v / 1e6, { decimals: a % 1e6 ? 1 : 0 }) + 'M';
  return formatNumber(v, { decimals: dec });
}

/** Monotone cubic interpolation (Fritsch–Carlson) → function of x. */
function monotone(xs, ys) {
  const n = xs.length;
  if (n < 2) return () => ys[0] ?? 0;
  const dx = [], m = [], d = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / d[i - 1] + (dx[i] + 2 * dx[i - 1]) / d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = dx[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const linearInterp = (xs, ys) => (x) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + ((ys[i + 1] - ys[i]) * (x - xs[i])) / (xs[i + 1] - xs[i]);
  return ys[ys.length - 1];
};

function hl(block, labels) {
  const h = block.highlight;
  if (h == null || h === '') return null;
  const arr = Array.isArray(h) ? h : [h];
  const set = new Set();
  for (const x of arr) {
    if (typeof x === 'number' && Number.isInteger(x) && x < labels.length && !labels.includes(String(x))) set.add(x);
    else { const i = labels.indexOf(String(x)); if (i >= 0) set.add(i); }
  }
  return set.size ? set : null;
}

function resolveAt(at, labels) {
  if (typeof at === 'number' && Number.isInteger(at) && !labels.includes(String(at))) return at;
  const i = labels.indexOf(String(at));
  return i >= 0 ? i : null;
}

class ChartCtx {
  constructor(block, c, rect) {
    this.block = block; this.c = c; this.env = c.env; this.p = c.p; this.te = c.te; this.rect = rect;
    const d = block.data || { labels: [], series: [] };
    this.labels = (d.labels || []).map(String);
    this.series = (d.series || []).map((s) => ({ ...s, values: (s.values || []).map((v) => (v == null || !Number.isFinite(+v) ? null : +v)) }));
    this.catColors = d.colors || null;
    const u = this.env.unit;
    this.u = u;
    this.T = this.env.motion.tempo;
    this.cs = this.env.theme.chart || {};
    // charts are read on phones in 9:16 and from a distance on wide frames: scale labels with the box
    const k = this.env.portrait ? 1.4 : Math.max(1, Math.min(1.25, this.rect.w / (this.env.W * 0.6)));
    this.small = this.env.sizes.small * k;
    this.cap = this.env.sizes.caption * k;
    this.labelFont = fontString(role(this.env, 'text', { weight: 450 }), this.cap * 1.08);
    this.valueFont = fontString(role(this.env, 'number', { weight: Math.max(600, this.env.fonts.number.weight) }), this.small * 1.02);
    this.allVals = this.series.flatMap((s) => s.values).filter((v) => v != null);
    const dec = block.decimals ?? Math.max(0, ...this.allVals.slice(0, 50).map(decimalsOf));
    this.dec = Math.min(dec, 2);
    this.hl = hl(block, this.labels);
  }
  color(i) {
    const b = this.block;
    if (b.colors?.[i]) return colorOf(this.p, b.colors[i]);
    if (this.series[i]?.color) return colorOf(this.p, this.series[i].color);
    return this.p.data[i % this.p.data.length];
  }
  catColor(i) {
    if (this.catColors?.[i]) return colorOf(this.p, this.catColors[i]);
    return this.p.data[i % this.p.data.length];
  }
  fmt(v, dec = this.dec) { return (this.block.prefix || '') + formatNumber(v, { decimals: dec }) + (this.block.suffix || ''); }
  text(str, x, y, font, color, align = 'left', baseline = 'alphabetic') {
    const ctx = this.ctx;
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillText(str, x, y);
    ctx.textAlign = 'left';
  }
  tw(str, font) { return this.te.width(str, font); }
  setGrid(ctx) {
    ctx.strokeStyle = this.p.gridLine;
    ctx.lineWidth = Math.max(1, this.u * 1.2);
    if (this.cs.grid === 'dashed') ctx.setLineDash([4 * this.u, 7 * this.u]); else ctx.setLineDash([]);
  }
  glow(ctx, color, k = 1) {
    if (!this.cs.glow) return;
    ctx.shadowColor = toCss(color, 0.55); ctx.shadowBlur = 18 * this.u * k;
  }
  dimColor() { return this.p.dark ? mix(this.p.muted, this.p.bg, 0.55) : mix(this.p.muted, this.p.bg, 0.6); }
  barPath(ctx, x, y, w, h, r, up = true) {
    r = Math.max(0, Math.min(r, w / 2, Math.abs(h)));
    ctx.beginPath();
    if (h === 0) return;
    if (up) {
      ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h);
    } else {
      ctx.moveTo(x, y); ctx.lineTo(x, y + h - r); ctx.arcTo(x, y + h, x + r, y + h, r); ctx.lineTo(x + w - r, y + h); ctx.arcTo(x + w, y + h, x + w, y + h - r, r); ctx.lineTo(x + w, y);
    }
    ctx.closePath();
  }
  fillMark(ctx, color, box) {
    const cs = this.cs, p = this.p;
    if (cs.hatch) {
      ctx.fillStyle = toCss(color, 0.18); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, this.u * 2); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = toCss(color, 0.55); ctx.lineWidth = Math.max(1, this.u * 1.4);
      const s = 9 * this.u;
      ctx.beginPath();
      for (let k = -box.h; k < box.w + box.h; k += s) { ctx.moveTo(box.x + k, box.y + box.h); ctx.lineTo(box.x + k + box.h, box.y); }
      ctx.stroke(); ctx.restore();
      ctx.beginPath();
      return;
    }
    if (cs.glow && p.gradient && p.tone === 'base') {
      const g = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
      g.addColorStop(0, color); g.addColorStop(1, toCss(color, 0.35));
      ctx.fillStyle = g;
    } else ctx.fillStyle = color;
    ctx.fill();
    if (cs.outline) { ctx.shadowColor = 'transparent'; ctx.strokeStyle = p.line; ctx.lineWidth = Math.max(2, this.u * 3.5); ctx.stroke(); }
  }
  dot(ctx, x, y, r, color) {
    const style = this.cs.dot || 'solid';
    ctx.beginPath();
    if (style === 'square') { ctx.rect(x - r, y - r, r * 2, r * 2); ctx.fillStyle = color; ctx.fill(); return; }
    ctx.arc(x, y, r, 0, TAU);
    if (style === 'ring' || style === 'outlined') {
      ctx.fillStyle = style === 'outlined' ? '#ffffff' : this.p.bg; ctx.fill();
      ctx.lineWidth = Math.max(2, r * (style === 'outlined' ? 0.55 : 0.45)); ctx.strokeStyle = style === 'outlined' ? this.p.line : color; ctx.stroke();
      if (style === 'outlined') { ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
      return;
    }
    ctx.fillStyle = color;
    if (style === 'glow') { ctx.shadowColor = color; ctx.shadowBlur = r * 3; }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  legend(ctx, items, x, y, w, t, align = 'left') {
    const fs = this.cap * 1.1;
    const font = fontString(role(this.env, 'text', { weight: 500 }), fs);
    let widths = items.map((it) => fs * 1.6 + this.tw(it.name, font) + fs * 1.4);
    let total = widths.reduce((a, b) => a + b, 0);
    let cx = align === 'center' ? x + (w - total) / 2 : x;
    items.forEach((it, i) => {
      const a = clamp01((t - i * 0.08) / 0.4);
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a;
      ctx.fillStyle = it.color;
      roundRect(ctx, cx, y - fs * 0.42, fs * 0.9, fs * 0.9, fs * 0.2); ctx.fill();
      this.text(it.name, cx + fs * 1.4, y + fs * 0.05, font, this.p.mutedText, 'left', 'middle');
      ctx.restore();
      cx += widths[i];
    });
    return fs * 2;
  }
  title(ctx, t) {
    if (!this.block.title) return 0;
    const L = this.te.layout(this.block.title, role(this.env, 'heading'), this.env.sizes.body * 1.05, { maxWidth: this.rect.w });
    drawText(ctx, L, this.rect.x, this.rect.y, this.rect.w, paintFor(this.c, this.p.ink, { flat: true }), textAnimator(this.env, L, 'fade', { unit: 'line' }), t);
    return L.height + this.env.sizes.body * 0.6;
  }
  titleH() {
    if (!this.block.title) return 0;
    return this.te.layout(this.block.title, role(this.env, 'heading'), this.env.sizes.body * 1.05, { maxWidth: this.rect.w }).height + this.env.sizes.body * 0.6;
  }
  annotation(ctx, x, y, text, t, dir = 'up') {
    const e = this.env.motion.spring ? this.env.motion.spring(clamp01(t / 0.6)) : EASE.outBack(clamp01(t / 0.5));
    if (e <= 0) return;
    const fs = this.small * 0.95;
    const font = fontString(role(this.env, 'text', { weight: 600 }), fs);
    const w = this.tw(text, font) + fs * 1.6, h = fs * 2.1;
    const off = fs * 2.2;
    let bx = x - w / 2, by = dir === 'up' ? y - off - h : y + off;
    bx = Math.max(this.rect.x, Math.min(bx, this.rect.x + this.rect.w - w));
    by = Math.max(this.rect.y - h * 0.5, by);
    ctx.save();
    ctx.globalAlpha *= clamp01(t / 0.25);
    ctx.strokeStyle = this.p.ink; ctx.lineWidth = Math.max(1, this.u * 1.5);
    const ly0 = dir === 'up' ? y - fs * 0.4 : y + fs * 0.4, ly1 = dir === 'up' ? by + h : by;
    ctx.beginPath(); ctx.moveTo(x, ly0); ctx.lineTo(x, ly0 + (ly1 - ly0) * clamp01(t / 0.3)); ctx.stroke();
    ctx.translate(bx + w / 2, by + h / 2); ctx.scale(e, e); ctx.translate(-(bx + w / 2), -(by + h / 2));
    roundRect(ctx, bx, by, w, h, h / 2);
    ctx.fillStyle = this.p.ink; ctx.fill();
    this.text(text, bx + w / 2, by + h / 2 + fs * 0.05, font, this.p.bg, 'center', 'middle');
    ctx.restore();
  }
}

// ───────────────────────────── cartesian (bar / stacked / line / area / waterfall) ─────────────────────────────
function cartesian(C, kind) {
  const { env, rect, p } = C;
  const n = C.labels.length;
  const S = C.series.length;
  const titleH = C.titleH();
  const showLegend = (C.block.legend === 'top' || C.block.legend === 'bottom' || (C.block.legend !== 'none' && S > 1 && (kind === 'bar' || kind === 'stacked'))) && C.block.legend !== 'none';
  const legendH = showLegend ? C.cap * 2.6 : 0;
  // values domain
  let lo = 0, hi = 0;
  if (kind === 'stacked') {
    for (let i = 0; i < n; i++) { let pos = 0, neg = 0; for (const s of C.series) { const v = s.values[i] || 0; if (v >= 0) pos += v; else neg += v; } hi = Math.max(hi, pos); lo = Math.min(lo, neg); }
  } else if (kind === 'waterfall') {
    let run = 0;
    C.wf = C.series[0].values.map((v, i) => {
      const isTotal = /总|合计|总计|total|net|end|sum/i.test(C.labels[i]) && i > 0;
      const from = isTotal ? 0 : run;
      const to = isTotal ? run : run + (v || 0);
      if (!isTotal) run = to;
      lo = Math.min(lo, from, to); hi = Math.max(hi, from, to);
      return { from, to, isTotal, v: isTotal ? run : v };
    });
  } else {
    const vals = C.allVals.length ? C.allVals : [0, 1];
    lo = Math.min(0, ...vals); hi = Math.max(...vals);
    if ((kind === 'line' || kind === 'area') && lo >= 0 && Math.min(...vals) > hi * 0.55 && C.block.min == null) lo = Math.min(...vals) * 0.85;
  }
  if (C.block.min != null) lo = C.block.min;
  if (C.block.max != null) hi = C.block.max;
  const sc = niceScale(lo, hi * (kind === 'bar' || kind === 'stacked' ? 1.04 : 1.02), env.portrait ? 4 : 5);
  // y-axis label width
  const yw = Math.max(...sc.ticks.map((v) => C.tw(axisLabel(v, sc.step), C.labelFont))) + C.cap * 0.9;
  // end labels for line/area (direct labeling)
  const endLabels = (kind === 'line' || kind === 'area') && C.block.labels !== 'none';
  const endW = endLabels ? Math.min(rect.w * 0.26, Math.max(...C.series.map((s, i) => C.tw((S > 1 ? s.name + '  ' : '') + C.fmt(s.values[s.values.length - 1] ?? 0), C.valueFont))) + C.small * 1.4) : 0;
  const xLabH = C.cap * 2.4 + (C.block.axis?.x ? C.cap * 1.6 : 0);
  const plot = { x: rect.x + yw, y: rect.y + titleH + legendH + C.small * 1.6, w: rect.w - yw - endW, h: 0 };
  plot.h = rect.y + rect.h - xLabH - plot.y;
  const yOf = (v) => plot.y + plot.h - ((v - sc.min) / (sc.max - sc.min)) * plot.h;
  const base = yOf(Math.max(sc.min, Math.min(0, sc.max)));
  const band = plot.w / Math.max(1, n);
  // x label thinning
  const maxLab = Math.max(...C.labels.map((l) => C.tw(l, C.labelFont)));
  const every = Math.max(1, Math.ceil((maxLab + C.cap) / band));
  const T = C.T;
  const tFrame = 0.55 * T;
  const tMarks = 0.3 * T;
  const per = Math.min(0.085, 0.95 / Math.max(1, n)) * T;
  const markDur = 0.9 * T;
  const lineDur = Math.min(2.4, 1.1 + n * 0.04) * T;
  const marksEnd = kind === 'line' || kind === 'area' ? tMarks + lineDur + (S - 1) * 0.3 * T : tMarks + per * (n - 1) + markDur;
  const tHl = marksEnd + 0.1;
  const annots = (C.block.annotate || []).map((a) => ({ ...a, i: resolveAt(a.at, C.labels) })).filter((a) => a.i != null && a.i < n);
  const tAnn = tHl + (C.hl ? 0.45 : 0.05);
  const duration = annots.length ? tAnn + 0.5 + annots.length * 0.25 : C.hl ? tHl + 0.5 : marksEnd;
  const showVals = C.block.labels === 'all' || (C.block.labels !== 'none' && C.block.labels !== 'end' && n * S <= 14 && kind !== 'line' && kind !== 'area');
  const xFor = (i) => (kind === 'line' || kind === 'area' ? plot.x + (n === 1 ? plot.w / 2 : (i / (n - 1)) * plot.w) : plot.x + band * (i + 0.5));

  function frame(ctx, t) {
    const e = env.motion.ease(clamp01(t / tFrame));
    // grid & ticks
    sc.ticks.forEach((v, k) => {
      const a = clamp01((t - k * 0.05) / 0.4);
      if (a <= 0) return;
      const y = yOf(v);
      ctx.save(); ctx.globalAlpha *= a;
      if (C.cs.grid !== 'none' && Math.abs(y - base) > 1) { C.setGrid(ctx); ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + (plot.w + endW * 0.3) * e, y); ctx.stroke(); }
      ctx.setLineDash([]);
      C.text(axisLabel(v, sc.step), plot.x - C.cap * 0.7, y, C.labelFont, p.mutedText, 'right', 'middle');
      ctx.restore();
    });
    // baseline
    ctx.strokeStyle = p.softLine; ctx.lineWidth = Math.max(1, C.u * 1.6); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(plot.x, base); ctx.lineTo(plot.x + plot.w * e, base); ctx.stroke();
    // x labels
    C.labels.forEach((l, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      if (i !== n - 1 && n - 1 - i < every) return; // the last label always shows; drop its crowded neighbour
      const a = clamp01((t - tMarks - i * per) / 0.45);
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a;
      const isH = C.hl?.has(i);
      C.text(l, xFor(i), plot.y + plot.h + C.cap * 1.5 + (1 - a) * C.cap * 0.6, isH ? fontString(role(env, 'text', { weight: 700 }), C.cap * 1.08) : C.labelFont, isH ? p.ink : p.mutedText, kind === 'line' && i === 0 && n > 1 ? 'left' : kind === 'line' && i === n - 1 && n > 1 ? 'right' : 'center', 'middle');
      ctx.restore();
    });
    if (C.block.axis?.y) C.text(C.block.axis.y, rect.x, plot.y - C.small * 0.9, fontString(role(env, 'label'), C.cap), p.mutedText, 'left', 'middle');
    if (C.block.axis?.x) C.text(C.block.axis.x, plot.x + plot.w, rect.y + rect.h - C.cap * 0.4, fontString(role(env, 'label'), C.cap), p.mutedText, 'right', 'alphabetic');
  }

  const hlMix = (t) => (C.hl ? EASE.inOutCubic(clamp01((t - tHl) / 0.5)) : 0);

  function drawBars(ctx, t) {
    const inner = band * (S > 1 ? 0.8 : C.cs.barRadius > 10 ? 0.58 : 0.64);
    const bw = inner / S;
    const r = (C.cs.barRadius || 0) * C.u;
    const hm = hlMix(t);
    for (let i = 0; i < n; i++) {
      const ti = t - tMarks - i * per;
      if (ti <= 0) continue;
      const pr = clamp01(ti / markDur);
      const e = env.motion.spring && C.cs.barRadius > 10 ? env.motion.spring(pr) : env.motion.ease(pr);
      for (let s = 0; s < S; s++) {
        const v = C.series[s].values[i];
        if (v == null) continue;
        const x = plot.x + band * i + (band - inner) / 2 + s * bw + bw * 0.06;
        const w = bw * (S > 1 ? 0.88 : 1);
        const top = yOf(v);
        const h = (base - top) * e;
        let col = S === 1 && C.catColors ? C.catColor(i) : C.color(s);
        if (C.hl && !C.hl.has(i)) col = mix(col, C.dimColor(), hm);
        ctx.save();
        if (!C.hl || C.hl.has(i)) C.glow(ctx, col, C.hl?.has(i) ? 1 + hm : 1);
        if (h >= 0) C.barPath(ctx, x, base - h, w, h, r, true); else C.barPath(ctx, x, base, w, -h, r, false);
        C.fillMark(ctx, col, { x, y: Math.min(base, base - h), w, h: Math.abs(h) });
        ctx.restore();
        if (showVals && pr > 0.25) {
          const a = clamp01((pr - 0.25) / 0.5);
          ctx.save(); ctx.globalAlpha *= a * (C.hl && !C.hl.has(i) ? 1 - hm * 0.55 : 1);
          const vy = v >= 0 ? base - h - C.small * 0.6 : base - h + C.small * 1.1;
          C.text(C.fmt(v * e), x + w / 2, vy, S > 2 ? fontString(role(env, 'number', { weight: 600 }), C.cap) : C.valueFont, C.hl?.has(i) ? p.ink : p.mutedText, 'center', 'alphabetic');
          ctx.restore();
        }
      }
    }
    // annotations
    annots.forEach((a, k) => {
      const v = Math.max(...C.series.map((s) => s.values[a.i] ?? -Infinity));
      C.annotation(ctx, xFor(a.i), yOf(v) - (showVals ? C.small * 1.8 : C.small * 0.5), a.text, t - tAnn - k * 0.25);
    });
  }

  function drawStacked(ctx, t) {
    const inner = band * 0.6;
    const r = (C.cs.barRadius || 0) * C.u;
    const hm = hlMix(t);
    for (let i = 0; i < n; i++) {
      const ti = t - tMarks - i * per;
      if (ti <= 0) continue;
      const e = env.motion.ease(clamp01(ti / (markDur * 1.15)));
      const x = plot.x + band * i + (band - inner) / 2;
      const total = C.series.reduce((sum, s) => sum + Math.max(0, s.values[i] || 0), 0);
      const limit = total * e;
      let acc = 0;
      C.series.forEach((s, si) => {
        const v = Math.max(0, s.values[i] || 0);
        const seg = Math.max(0, Math.min(v, limit - acc));
        if (seg <= 0) { acc += v; return; }
        const y0 = yOf(acc), y1 = yOf(acc + seg);
        let col = C.color(si);
        if (C.hl && !C.hl.has(i)) col = mix(col, C.dimColor(), hm);
        const isTop = si === C.series.length - 1 || acc + v >= total - 1e-9;
        ctx.save();
        C.barPath(ctx, x, y1, inner, y0 - y1 - (si > 0 ? 0 : 0), isTop && seg === v ? r : 0, true);
        C.fillMark(ctx, col, { x, y: y1, w: inner, h: y0 - y1 });
        ctx.restore();
        if (si < C.series.length - 1 && seg === v) { ctx.fillStyle = p.bg; ctx.fillRect(x, y1 - C.u, inner, C.u * 2); }
        acc += v;
      });
      if (C.block.labels !== 'none' && e > 0.6) {
        ctx.save(); ctx.globalAlpha *= clamp01((e - 0.6) / 0.4);
        C.text(C.fmt(total), x + inner / 2, yOf(total) - C.small * 0.6, C.valueFont, p.ink, 'center');
        ctx.restore();
      }
    }
    annots.forEach((a, k) => {
      const total = C.series.reduce((sum, s) => sum + Math.max(0, s.values[a.i] || 0), 0);
      C.annotation(ctx, xFor(a.i), yOf(total) - C.small * 1.8, a.text, t - tAnn - k * 0.25);
    });
  }

  function drawWaterfall(ctx, t) {
    const inner = band * 0.62;
    const r = Math.min(6, C.cs.barRadius || 0) * C.u;
    C.wf.forEach((w, i) => {
      const ti = t - tMarks - i * per * 1.4;
      if (ti <= 0) return;
      const e = env.motion.ease(clamp01(ti / markDur));
      const x = plot.x + band * i + (band - inner) / 2;
      const yA = yOf(w.from), yB = yOf(w.from + (w.to - w.from) * e);
      const col = w.isTotal ? p.accent : w.to >= w.from ? p.positive : p.negative;
      ctx.save();
      C.barPath(ctx, x, Math.min(yA, yB), inner, Math.abs(yB - yA), r, true);
      C.fillMark(ctx, col, { x, y: Math.min(yA, yB), w: inner, h: Math.abs(yB - yA) });
      ctx.restore();
      if (i < C.wf.length - 1 && e >= 1) {
        const a = clamp01((ti - markDur) / 0.3);
        ctx.save(); ctx.globalAlpha *= a; C.setGrid(ctx); ctx.setLineDash([3 * C.u, 4 * C.u]);
        ctx.beginPath(); ctx.moveTo(x + inner, yOf(w.to)); ctx.lineTo(x + band, yOf(w.to)); ctx.stroke(); ctx.restore();
      }
      if (e > 0.5) {
        ctx.save(); ctx.globalAlpha *= clamp01((e - 0.5) * 2);
        const d = w.isTotal ? w.v : w.to - w.from;
        const txt = (w.isTotal ? '' : d >= 0 ? '+' : '') + C.fmt(d);
        C.text(txt, x + inner / 2, Math.min(yA, yOf(w.to)) - C.small * 0.55, C.valueFont, w.isTotal ? p.ink : col, 'center');
        ctx.restore();
      }
    });
  }

  function drawLines(ctx, t) {
    const lw = (C.cs.lineWidth || 3) * C.u * (S > 3 ? 0.8 : 1);
    const hm = hlMix(t);
    const xs = C.labels.map((_, i) => xFor(i));
    C.series.forEach((s, si) => {
      const ts = t - tMarks - si * 0.3 * T;
      if (ts <= 0) return;
      const pr = clamp01(ts / lineDur);
      const e = EASE.inOutCubic(pr);
      const pts = s.values.map((v, i) => [xs[i], v]).filter(([, v]) => v != null);
      if (!pts.length) return;
      const px = pts.map((q) => q[0]), py = pts.map((q) => yOf(q[1]));
      const f = C.block.smooth === false ? linearInterp(px, py) : monotone(px, py);
      const x0 = px[0], x1 = px[px.length - 1];
      const head = x0 + (x1 - x0) * e;
      let col = C.color(si);
      if (C.hl && !C.hl.has(si) && C.hl.size) col = mix(col, C.dimColor(), hm * 0.8);
      const step = Math.max(2, 3 * C.u);
      // area
      const areaAlpha = kind === 'area' ? Math.max(0.22, C.cs.area || 0.2) : C.cs.area || 0;
      if (areaAlpha > 0 && (S <= 2 || kind === 'area')) {
        ctx.save();
        const g = ctx.createLinearGradient(0, plot.y, 0, base);
        g.addColorStop(0, toCss(col, areaAlpha)); g.addColorStop(1, toCss(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x0, base);
        for (let x = x0; x <= head; x += step) ctx.lineTo(x, f(x));
        ctx.lineTo(head, f(head)); ctx.lineTo(head, base); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      C.glow(ctx, col);
      ctx.beginPath(); ctx.moveTo(x0, f(x0));
      for (let x = x0 + step; x < head; x += step) ctx.lineTo(x, f(x));
      ctx.lineTo(head, f(head));
      ctx.stroke();
      ctx.restore();
      // data points revealed as the head passes
      if (n <= 30) pts.forEach(([x, v], k) => {
        if (x > head + 0.5) return;
        const a = clamp01((head - x) / (C.small * 2) + (pr >= 1 ? 1 : 0));
        ctx.save(); ctx.globalAlpha *= Math.min(1, a + 0.2);
        C.dot(ctx, x, yOf(v), Math.max(3, lw * (C.hl?.has(k) && C.hl.size && S === 1 ? 1.6 : 1.05)), col);
        ctx.restore();
      });
      // head glow dot
      if (pr < 1) { ctx.save(); C.dot(ctx, head, f(head), lw * 1.5, col); ctx.restore(); }
      // value tooltip following the head
      if (pr < 1 && S === 1) {
        const k = Math.min(pts.length - 1, Math.round(((head - x0) / (x1 - x0 || 1)) * (pts.length - 1)));
        C.text(C.fmt(pts[k][1]), head, f(head) - C.small * 1.1, C.valueFont, p.ink, 'center');
      }
      // end label (direct labeling)
      if (endLabels && pr >= 1) {
        const a = clamp01((ts - lineDur) / 0.4);
        const lastV = pts[pts.length - 1][1];
        ctx.save(); ctx.globalAlpha *= a;
        let ly = yOf(lastV);
        // simple collision avoidance between series labels
        if (S > 1) { const order = C.series.map((ss, k) => ({ k, y: yOf(ss.values.filter((v) => v != null).pop() ?? 0) })).sort((u, v) => u.y - v.y); let prev = -Infinity; const minGap = C.small * 1.3; for (const o of order) { o.y = Math.max(o.y, prev + minGap); prev = o.y; if (o.k === si) ly = o.y; } }
        const tx = x1 + C.small * 0.7;
        if (S > 1) C.text(s.name, tx, ly - C.small * 0.25, fontString(role(env, 'text', { weight: 600 }), C.cap), col, 'left', 'alphabetic');
        C.text(C.fmt(lastV), tx, S > 1 ? ly + C.small * 0.85 : ly, C.valueFont, S > 1 ? p.ink : col, 'left', S > 1 ? 'alphabetic' : 'middle');
        ctx.restore();
      }
    });
    annots.forEach((a, k) => {
      const s = C.series[a.series || 0];
      const v = s?.values[a.i];
      if (v == null) return;
      C.annotation(ctx, xFor(a.i), yOf(v) - C.small * 0.6, a.text, t - tAnn - k * 0.25);
    });
  }

  return {
    duration,
    hold: 2.2 + Math.min(3, n * S * 0.06),
    draw(ctx, t) {
      C.ctx = ctx;
      C.title(ctx, t);
      if (showLegend) C.legend(ctx, C.series.map((s, i) => ({ name: s.name || `系列 ${i + 1}`, color: C.color(i) })), rect.x, rect.y + titleH + C.cap, rect.w, t);
      frame(ctx, t);
      if (kind === 'bar') drawBars(ctx, t);
      else if (kind === 'stacked') drawStacked(ctx, t);
      else if (kind === 'waterfall') drawWaterfall(ctx, t);
      else drawLines(ctx, t);
    },
  };
}

// ───────────────────────────── hbar (ranking) ─────────────────────────────
function hbar(C) {
  const { env, rect, p } = C;
  let idx = C.labels.map((_, i) => i);
  const vals = C.series[0]?.values || [];
  if (C.block.sort === 'desc') idx.sort((a, b) => (vals[b] ?? 0) - (vals[a] ?? 0));
  if (C.block.sort === 'asc') idx.sort((a, b) => (vals[a] ?? 0) - (vals[b] ?? 0));
  const n = idx.length;
  const titleH = C.titleH();
  const fs = n > 10 ? C.cap * 1.05 : C.small;
  const lfont = fontString(role(env, 'text', { weight: 500 }), fs);
  const labW = Math.min(rect.w * 0.34, Math.max(...C.labels.map((l) => C.tw(l, lfont))) + fs);
  const valW = Math.max(...vals.map((v) => C.tw(C.fmt(v ?? 0), C.valueFont))) + fs;
  const plot = { x: rect.x + labW, y: rect.y + titleH, w: rect.w - labW - valW, h: rect.h - titleH };
  const band = plot.h / n;
  const bh = Math.min(band * 0.66, fs * 2.4);
  const max = Math.max(...vals.map((v) => v ?? 0), C.block.max ?? 0) || 1;
  const T = C.T;
  const per = Math.min(0.09, 1.1 / n) * T;
  const dur = 0.95 * T;
  const tHl = per * n + dur;
  const r = Math.min(bh / 2, (C.cs.barRadius || 0) * C.u);
  return {
    duration: tHl + (C.hl ? 0.5 : 0), hold: 2 + n * 0.12,
    draw(ctx, t) {
      C.ctx = ctx;
      C.title(ctx, t);
      const hm = C.hl ? EASE.inOutCubic(clamp01((t - tHl) / 0.5)) : 0;
      idx.forEach((i, k) => {
        const ti = t - 0.15 - k * per;
        if (ti <= 0) return;
        const e = env.motion.ease(clamp01(ti / dur));
        const y = plot.y + band * k + (band - bh) / 2;
        const v = vals[i] ?? 0;
        const w = (v / max) * plot.w * e;
        let col = C.catColors ? C.catColor(i) : C.color(0);
        if (C.hl && !C.hl.has(i)) col = mix(col, C.dimColor(), hm);
        ctx.save(); ctx.globalAlpha *= clamp01(ti / 0.3);
        C.text(C.labels[i], plot.x - fs * 0.8, y + bh / 2, C.hl?.has(i) ? fontString(role(env, 'text', { weight: 700 }), fs) : lfont, C.hl && !C.hl.has(i) ? p.mutedText : p.ink, 'right', 'middle');
        // track
        roundRect(ctx, plot.x, y, plot.w, bh, r); ctx.fillStyle = toCss(p.ink, p.dark ? 0.05 : 0.045); ctx.fill();
        ctx.save(); if (!C.hl || C.hl.has(i)) C.glow(ctx, col);
        roundRect(ctx, plot.x, y, Math.max(w, r * 2 * e), bh, r);
        C.fillMark(ctx, col, { x: plot.x, y, w, h: bh });
        ctx.restore();
        C.text(C.fmt(v * e), plot.x + w + fs * 0.6, y + bh / 2, C.valueFont, C.hl && !C.hl.has(i) ? p.mutedText : p.ink, 'left', 'middle');
        ctx.restore();
      });
    },
  };
}

// ───────────────────────────── pie / donut ─────────────────────────────
function pie(C, donut) {
  const { env, rect, p, te } = C;
  const vals = (C.series[0]?.values || []).map((v) => Math.max(0, v || 0));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const n = vals.length;
  const titleH = C.titleH();
  const area = { x: rect.x, y: rect.y + titleH, w: rect.w, h: rect.h - titleH };
  const side = area.w > area.h * 1.25;
  const fs = n <= 5 ? env.sizes.body * 0.86 : C.small;
  const lfont = fontString(role(env, 'text', { weight: 500 }), fs);
  const legendW = side ? Math.min(area.w * 0.48, Math.max(...C.labels.map((l) => C.tw(l, lfont))) + fs * 6) : area.w;
  const legendH = side ? 0 : Math.ceil(n / 2) * fs * 2.2;
  const R = Math.min((side ? area.w - legendW - fs * 2 : area.w) / 2, (area.h - legendH) / 2) * 0.96;
  const cx = side ? area.x + R + (area.w - legendW - fs * 2 - 2 * R) / 2 : area.x + area.w / 2;
  const cy = area.y + (area.h - legendH) / 2;
  const inner = donut ? R * 0.64 : 0;
  const T = C.T;
  const sweepDur = 1.4 * T;
  const tHl = 0.2 + sweepDur;
  const hlIdx = C.hl ? [...C.hl][0] : null;
  const pct = (v) => (v / total) * 100;
  const pctDec = vals.some((v) => pct(v) < 10 && pct(v) % 1) ? 1 : 0;
  const isPct = C.block.suffix === '%' && Math.abs(total - 100) < 1.5;
  return {
    duration: tHl + (C.hl ? 0.6 : 0.2), hold: 2.2 + n * 0.25,
    draw(ctx, t) {
      C.ctx = ctx;
      C.title(ctx, t);
      const sweep = EASE.inOutCubic(clamp01((t - 0.2) / sweepDur)) * TAU;
      const hm = C.hl ? EASE.inOutCubic(clamp01((t - tHl) / 0.5)) : 0;
      // track ring
      if (donut) { ctx.beginPath(); ctx.arc(cx, cy, (R + inner) / 2, 0, TAU); ctx.strokeStyle = toCss(p.ink, 0.06); ctx.lineWidth = R - inner; ctx.stroke(); }
      let a0 = -Math.PI / 2;
      const gap = n > 1 ? Math.min(0.025, 0.4 / n) : 0;
      vals.forEach((v, i) => {
        const a1 = a0 + (v / total) * TAU;
        const s = a0, e = Math.min(a1, -Math.PI / 2 + sweep);
        if (e > s) {
          let col = C.catColor(i);
          if (hlIdx != null && hlIdx !== i) col = mix(col, C.dimColor(), hm * 0.85);
          const pop = hlIdx === i ? hm * R * 0.06 : 0;
          const mid = (s + e) / 2;
          ctx.save();
          ctx.translate(Math.cos(mid) * pop, Math.sin(mid) * pop);
          ctx.beginPath();
          ctx.arc(cx, cy, R, s + gap / 2, Math.max(s + gap / 2, e - gap / 2));
          if (inner) ctx.arc(cx, cy, inner, Math.max(s + gap / 2, e - gap / 2), s + gap / 2, true); else ctx.lineTo(cx, cy);
          ctx.closePath();
          if (hlIdx === i) C.glow(ctx, col, 1.5);
          ctx.fillStyle = col; ctx.fill();
          if (C.cs.outline) { ctx.strokeStyle = p.line; ctx.lineWidth = 3 * C.u; ctx.stroke(); }
          ctx.restore();
          // percent label on large slices (pie) or outside for donut highlight
          if (e >= a1 - 1e-6 && pct(v) >= 7 && !donut) {
            const a = clamp01((t - 0.2 - ((a1 + Math.PI / 2) / TAU) * sweepDur) / 0.4);
            ctx.save(); ctx.globalAlpha *= a;
            C.text(`${formatNumber(pct(v), { decimals: pctDec })}%`, cx + Math.cos(mid) * R * 0.66, cy + Math.sin(mid) * R * 0.66, C.valueFont, mix(col, '#000', 0.001) && (C.p.dark ? '#0b0b0b' : '#ffffff'), 'center', 'middle');
            ctx.restore();
          }
        }
        a0 = a1;
      });
      // center label
      if (donut) {
        const focus = hlIdx != null ? vals[hlIdx] : total;
        const show = hlIdx != null ? (isPct ? focus : pct(focus)) : total;
        const e = EASE.outExpo(clamp01((t - 0.3) / (1.4 * T)));
        const big = hlIdx != null || isPct ? `${formatNumber(show * e, { decimals: hlIdx != null && !isPct ? pctDec : C.dec })}${hlIdx != null && !isPct ? '%' : C.block.suffix || ''}` : C.fmt(show * e);
        const nsz = Math.min(inner * 0.62, (inner * 1.6) / Math.max(3, big.length) * 1.7);
        C.text(big, cx, cy + nsz * 0.12, fontString(role(env, 'number'), nsz), p.ink, 'center', 'middle');
        const sub = hlIdx != null ? C.labels[hlIdx] : (C.block.title ? '' : '合计');
        if (sub) { ctx.save(); ctx.globalAlpha *= clamp01((t - 0.6) / 0.4); C.text(sub, cx, cy + nsz * 0.85, fontString(role(env, 'text'), Math.min(fs, nsz * 0.38)), p.mutedText, 'center', 'middle'); ctx.restore(); }
      }
      // legend with values
      const lx = side ? area.x + area.w - legendW : area.x;
      const rowH = fs * 2.2;
      const ly0 = side ? cy - (n * rowH) / 2 : area.y + area.h - legendH;
      vals.forEach((v, i) => {
        const appear = 0.2 + (vals.slice(0, i).reduce((a, b) => a + b, 0) / total) * sweepDur;
        const a = clamp01((t - appear) / 0.45);
        if (a <= 0) return;
        const col = side ? 1 : 2;
        const x = side ? lx : lx + (i % 2) * (area.w / 2);
        const y = side ? ly0 + i * rowH : ly0 + Math.floor(i / 2) * rowH;
        ctx.save(); ctx.globalAlpha *= a * (hlIdx != null && hlIdx !== i ? 1 - hm * 0.5 : 1);
        ctx.translate((1 - a) * fs, 0);
        ctx.fillStyle = C.catColor(i);
        roundRect(ctx, x, y + rowH / 2 - fs * 0.45, fs * 0.9, fs * 0.9, fs * 0.22); ctx.fill();
        C.text(C.labels[i] ?? '', x + fs * 1.5, y + rowH / 2, hlIdx === i ? fontString(role(env, 'text', { weight: 700 }), fs) : lfont, p.ink, 'left', 'middle');
        const valueTxt = isPct || C.block.suffix === '%' ? `${formatNumber(v, { decimals: C.dec })}%` : `${C.fmt(v)} · ${formatNumber(pct(v), { decimals: pctDec })}%`;
        C.text(valueTxt, x + (side ? legendW : area.w / 2 - fs), y + rowH / 2, C.valueFont, p.mutedText, 'right', 'middle');
        ctx.restore();
        void col;
      });
    },
  };
}

// ───────────────────────────── scatter ─────────────────────────────
function scatter(C) {
  const { env, rect, p } = C;
  const pts = C.series.flatMap((s, si) => (s.points || s.values.map((v, i) => [i, v])).filter((q) => q[0] != null && q[1] != null).map((q) => ({ x: +q[0], y: +q[1], r: q[2], label: q[3], si })));
  const titleH = C.titleH();
  const xs = niceScale(Math.min(...pts.map((q) => q.x)), Math.max(...pts.map((q) => q.x)), 5);
  const ys = niceScale(Math.min(0, ...pts.map((q) => q.y)), Math.max(...pts.map((q) => q.y)), 5);
  const yw = Math.max(...ys.ticks.map((v) => C.tw(axisLabel(v, ys.step), C.labelFont))) + C.cap;
  const plot = { x: rect.x + yw, y: rect.y + titleH + C.small, w: rect.w - yw - C.small, h: rect.h - titleH - C.small - C.cap * 3 };
  const X = (v) => plot.x + ((v - xs.min) / (xs.max - xs.min)) * plot.w;
  const Y = (v) => plot.y + plot.h - ((v - ys.min) / (ys.max - ys.min)) * plot.h;
  const rmax = Math.max(...pts.map((q) => q.r || 0));
  const R = (q) => (q.r && rmax ? Math.sqrt(q.r / rmax) * C.small * 2.2 + C.u * 4 : C.u * 7);
  const order = pts.map((q, i) => i).sort((a, b) => pts[a].x - pts[b].x);
  const per = Math.min(0.05, 1.4 / pts.length) * C.T;
  return {
    duration: 0.5 + per * pts.length + 0.6, hold: 2.5,
    draw(ctx, t) {
      C.ctx = ctx; C.title(ctx, t);
      const e = env.motion.ease(clamp01(t / 0.6));
      ys.ticks.forEach((v) => { const y = Y(v); ctx.save(); ctx.globalAlpha *= e; C.setGrid(ctx); ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); ctx.stroke(); ctx.setLineDash([]); C.text(axisLabel(v, ys.step), plot.x - C.cap * 0.6, y, C.labelFont, p.mutedText, 'right', 'middle'); ctx.restore(); });
      xs.ticks.forEach((v) => { ctx.save(); ctx.globalAlpha *= e; C.text(axisLabel(v, xs.step), X(v), plot.y + plot.h + C.cap * 1.4, C.labelFont, p.mutedText, 'center', 'middle'); ctx.restore(); });
      if (C.block.axis?.x) C.text(C.block.axis.x, plot.x + plot.w, rect.y + rect.h, fontString(role(env, 'label'), C.cap), p.mutedText, 'right');
      if (C.block.axis?.y) C.text(C.block.axis.y, plot.x, plot.y - C.cap * 0.4, fontString(role(env, 'label'), C.cap), p.mutedText, 'left');
      order.forEach((qi, k) => {
        const q = pts[qi];
        const ti = t - 0.45 - k * per;
        if (ti <= 0) return;
        const s = env.motion.spring ? env.motion.spring(clamp01(ti / 0.6)) : EASE.outBack(clamp01(ti / 0.45));
        const col = C.color(q.si);
        ctx.save();
        ctx.globalAlpha *= 0.85;
        ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), R(q) * s, 0, TAU);
        ctx.fillStyle = toCss(col, q.r ? 0.55 : 0.9); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, C.u * 1.5); ctx.stroke();
        ctx.restore();
        if (q.label && s > 0.8) C.text(String(q.label), X(q.x), Y(q.y) - R(q) - C.cap * 0.6, fontString(role(env, 'text', { weight: 600 }), C.cap), p.ink, 'center');
      });
    },
  };
}

// ───────────────────────────── progress / gauge / funnel / radar ─────────────────────────────
function progress(C) {
  const { env, rect, p } = C;
  const vals = C.series[0]?.values || [];
  const max = C.block.max ?? (C.block.suffix === '%' || vals.every((v) => v <= 100) ? 100 : Math.max(...vals));
  const n = vals.length;
  const titleH = C.titleH();
  const rowH = Math.min((rect.h - titleH) / n, C.small * 4.2);
  const y0 = rect.y + titleH + Math.max(0, (rect.h - titleH - rowH * n) / 2);
  const th = Math.max(6 * C.u, rowH * 0.2);
  const per = Math.min(0.14, 1.2 / n) * C.T;
  const lfont = fontString(role(env, 'text', { weight: 550 }), C.small);
  return {
    duration: per * n + 1.1 * C.T, hold: 1.8 + n * 0.2,
    draw(ctx, t) {
      C.ctx = ctx; C.title(ctx, t);
      vals.forEach((v, i) => {
        const ti = t - i * per;
        if (ti <= 0) return;
        const e = env.motion.ease(clamp01(ti / (1.1 * C.T)));
        const y = y0 + i * rowH;
        ctx.save(); ctx.globalAlpha *= clamp01(ti / 0.3);
        C.text(C.labels[i] ?? '', rect.x, y + rowH * 0.36, lfont, p.ink, 'left', 'middle');
        C.text(C.fmt((v ?? 0) * e), rect.x + rect.w, y + rowH * 0.36, C.valueFont, C.hl?.has(i) ? p.accentText : p.mutedText, 'right', 'middle');
        const ty = y + rowH * 0.62;
        roundRect(ctx, rect.x, ty, rect.w, th, th / 2); ctx.fillStyle = toCss(p.ink, p.dark ? 0.08 : 0.07); ctx.fill();
        const col = C.catColors ? C.catColor(i) : C.hl && !C.hl.has(i) ? C.dimColor() : C.color(0);
        ctx.save(); C.glow(ctx, col);
        roundRect(ctx, rect.x, ty, Math.max(th, rect.w * Math.min(1, (v ?? 0) / max) * e), th, th / 2); ctx.fillStyle = col; ctx.fill();
        ctx.restore();
        ctx.restore();
      });
    },
  };
}

function gauge(C) {
  const { env, rect, p } = C;
  const v = C.series[0]?.values?.[0] ?? 0;
  const max = C.block.max ?? (C.block.suffix === '%' || v <= 100 ? 100 : v * 1.25);
  const min = C.block.min ?? 0;
  const titleH = C.titleH();
  const R = Math.min(rect.w / 2, (rect.h - titleH) * 0.78) * 0.92;
  const cx = rect.x + rect.w / 2, cy = rect.y + titleH + (rect.h - titleH) / 2 + R * 0.4;
  const lw = R * 0.14;
  const frac = Math.max(0, Math.min(1, (v - min) / (max - min)));
  return {
    duration: 1.8 * C.T, hold: 2,
    draw(ctx, t) {
      C.ctx = ctx; C.title(ctx, t);
      const e = EASE.outCubic(clamp01((t - 0.2) / (1.6 * C.T)));
      ctx.save(); ctx.lineCap = 'round';
      ctx.lineWidth = lw; ctx.strokeStyle = toCss(p.ink, 0.08);
      ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, TAU); ctx.stroke();
      // ticks
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI + (k / 10) * Math.PI;
        const al = clamp01((t - k * 0.04) / 0.3);
        ctx.globalAlpha = al;
        ctx.strokeStyle = p.softLine; ctx.lineWidth = Math.max(1, C.u * (k % 5 ? 1.2 : 2.4));
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - lw * 0.9), cy + Math.sin(a) * (R - lw * 0.9)); ctx.lineTo(cx + Math.cos(a) * (R - lw * (k % 5 ? 1.25 : 1.5)), cy + Math.sin(a) * (R - lw * (k % 5 ? 1.25 : 1.5))); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
      g.addColorStop(0, p.data[1] || p.accent); g.addColorStop(1, p.accent);
      ctx.strokeStyle = g; ctx.lineWidth = lw; C.glow(ctx, p.accent);
      if (frac * e > 0) { ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * frac * e); ctx.stroke(); }
      ctx.restore();
      const big = C.fmt(v * EASE.outExpo(clamp01((t - 0.2) / (1.6 * C.T))));
      const nsz = Math.min(R * 0.5, (R * 2.4) / Math.max(3, big.length));
      C.text(big, cx, cy - nsz * 0.12, fontString(role(env, 'number'), nsz), p.ink, 'center', 'alphabetic');
      if (C.labels[0] && C.labels[0] !== '1') C.text(C.labels[0], cx, cy + C.small * 1.2, fontString(role(env, 'text'), C.small), p.mutedText, 'center', 'middle');
      C.text(axisLabel(min, 1), cx - R, cy + lw * 1.1, C.labelFont, p.mutedText, 'center', 'middle');
      C.text(axisLabel(max, 1), cx + R, cy + lw * 1.1, C.labelFont, p.mutedText, 'center', 'middle');
    },
  };
}

function funnel(C) {
  const { env, rect, p } = C;
  const vals = C.series[0]?.values || [];
  const n = vals.length;
  const max = Math.max(...vals.map((v) => v || 0)) || 1;
  const titleH = C.titleH();
  const top = rect.y + titleH;
  const gap = C.u * 6;
  const h = (rect.h - titleH - gap * (n - 1)) / n;
  const wMax = rect.w * 0.62;
  const cx = rect.x + rect.w * 0.36;
  const per = Math.min(0.18, 1.2 / n) * C.T;
  return {
    duration: per * n + 0.9 * C.T, hold: 2 + n * 0.3,
    draw(ctx, t) {
      C.ctx = ctx; C.title(ctx, t);
      vals.forEach((v, i) => {
        const ti = t - i * per;
        if (ti <= 0) return;
        const e = env.motion.ease(clamp01(ti / (0.9 * C.T)));
        const y = top + i * (h + gap);
        const w0 = ((v || 0) / max) * wMax;
        const w1 = ((vals[i + 1] ?? v * 0.82) / max) * wMax;
        const ww0 = w0 * e, ww1 = Math.min(w0, w1 + (w0 - w1) * 0.4) * e;
        ctx.save(); ctx.globalAlpha *= clamp01(ti / 0.3);
        ctx.beginPath();
        ctx.moveTo(cx - ww0 / 2, y); ctx.lineTo(cx + ww0 / 2, y); ctx.lineTo(cx + ww1 / 2, y + h); ctx.lineTo(cx - ww1 / 2, y + h); ctx.closePath();
        const col = C.catColors ? C.catColor(i) : mix(C.color(0), C.p.data[1] || C.color(0), i / Math.max(1, n - 1));
        C.glow(ctx, col); C.fillMark(ctx, col, { x: cx - ww0 / 2, y, w: ww0, h });
        ctx.restore();
        const a = clamp01((ti - 0.3) / 0.4);
        ctx.save(); ctx.globalAlpha *= a;
        const lx = cx + wMax / 2 + C.small;
        C.text(C.labels[i] ?? '', lx, y + h * 0.38, fontString(role(env, 'text', { weight: 600 }), C.small), p.ink, 'left', 'middle');
        C.text(C.fmt(v ?? 0) + (i > 0 && vals[0] ? `  ·  ${formatNumber(((v || 0) / vals[0]) * 100, { decimals: 1 })}%` : ''), lx, y + h * 0.72, C.labelFont, p.mutedText, 'left', 'middle');
        ctx.restore();
      });
    },
  };
}

function radar(C) {
  const { env, rect, p } = C;
  const n = C.labels.length;
  const titleH = C.titleH();
  const showLegend = C.series.length > 1;
  const legendH = showLegend ? C.cap * 2.6 : 0;
  const R = Math.min(rect.w, rect.h - titleH - legendH) / 2 * 0.72;
  const cx = rect.x + rect.w / 2, cy = rect.y + titleH + legendH + (rect.h - titleH - legendH) / 2;
  const max = C.block.max ?? niceScale(0, Math.max(...C.allVals, 1), 4).max;
  const ang = (i) => -Math.PI / 2 + (i / n) * TAU;
  return {
    duration: 0.6 + C.series.length * 0.35 + 1.0 * C.T, hold: 2.5,
    draw(ctx, t) {
      C.ctx = ctx; C.title(ctx, t);
      if (showLegend) C.legend(ctx, C.series.map((s, i) => ({ name: s.name || `系列 ${i + 1}`, color: C.color(i) })), rect.x, rect.y + titleH + C.cap, rect.w, t, 'center');
      const e = env.motion.ease(clamp01(t / 0.7));
      ctx.save(); C.setGrid(ctx); ctx.setLineDash([]);
      for (let k = 1; k <= 4; k++) {
        ctx.globalAlpha = clamp01((t - k * 0.06) / 0.4);
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const a = ang(i % n); const r = (R * k) / 4 * e; i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        ctx.stroke();
      }
      ctx.globalAlpha = e;
      for (let i = 0; i < n; i++) { const a = ang(i); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
      ctx.restore();
      C.labels.forEach((l, i) => {
        const a = ang(i);
        const lx = cx + Math.cos(a) * (R + C.small * 1.2), ly = cy + Math.sin(a) * (R + C.small * 1.1);
        ctx.save(); ctx.globalAlpha *= clamp01((t - 0.3 - i * 0.04) / 0.4);
        C.text(l, lx, ly, fontString(role(env, 'text', { weight: 550 }), C.cap * 1.1), p.ink, Math.abs(Math.cos(a)) < 0.2 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right', 'middle');
        ctx.restore();
      });
      C.series.forEach((s, si) => {
        const ts = t - 0.6 - si * 0.35;
        if (ts <= 0) return;
        const k = env.motion.spring ? env.motion.spring(clamp01(ts / 0.9)) : env.motion.ease(clamp01(ts / (1.0 * C.T)));
        const col = C.color(si);
        ctx.save();
        ctx.beginPath();
        s.values.forEach((v, i) => { const a = ang(i); const r = ((v || 0) / max) * R * k; i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); });
        ctx.closePath();
        ctx.fillStyle = toCss(col, 0.22); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, C.u * 3); ctx.lineJoin = 'round'; C.glow(ctx, col); ctx.stroke();
        ctx.restore();
        s.values.forEach((v, i) => { const a = ang(i); const r = ((v || 0) / max) * R * k; ctx.save(); C.dot(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(3, C.u * 5), col); ctx.restore(); });
      });
    },
  };
}

// ───────────────────────────── race (animated ranking over periods) ─────────────────────────────
function race(C) {
  const { env, rect, p } = C;
  const periods = C.labels;
  const ents = C.series;
  const P = periods.length;
  const top = Math.min(ents.length, 10);
  const titleH = C.titleH();
  const plotTop = rect.y + titleH;
  const plotH = rect.h - titleH;
  const band = plotH / top;
  const bh = band * 0.68;
  const fs = Math.min(C.small, bh * 0.55);
  const lfont = fontString(role(env, 'text', { weight: 600 }), fs);
  const labW = Math.min(rect.w * 0.26, Math.max(...ents.map((s) => C.tw(s.name, lfont))) + fs);
  const perPeriod = 1.25 * C.T;
  const intro = 0.6;
  const valueAt = (s, f) => {
    const i = Math.floor(f), fr = f - i;
    const a = s.values[Math.min(i, P - 1)] ?? 0, b = s.values[Math.min(i + 1, P - 1)] ?? a;
    return a + (b - a) * fr;
  };
  const ranksAt = (f) => {
    const vals = ents.map((s, k) => ({ k, v: valueAt(s, f) })).sort((a, b) => b.v - a.v);
    const r = new Array(ents.length);
    vals.forEach((o, i) => { r[o.k] = i; });
    return { r, max: vals[0]?.v || 1 };
  };
  return {
    duration: intro + perPeriod * (P - 1) + 0.6, hold: 1.5,
    draw(ctx, t) {
      C.ctx = ctx; C.title(ctx, t);
      const f = Math.max(0, Math.min(P - 1, (t - intro) / perPeriod));
      const fi = Math.floor(f), fr = EASE.inOutCubic(f - fi);
      const ff = fi + fr;
      const r0 = ranksAt(fi), r1 = ranksAt(Math.min(P - 1, fi + 1));
      const { max } = ranksAt(ff);
      const grow = env.motion.ease(clamp01(t / intro));
      // period label
      const big = periods[Math.round(f)] ?? '';
      const bsz = Math.min(plotH * 0.22, rect.w * 0.14);
      ctx.save(); ctx.globalAlpha = 0.18 + 0.1 * grow;
      C.text(big, rect.x + rect.w, plotTop + plotH - bsz * 0.15, fontString(role(env, 'number'), bsz), p.ink, 'right', 'alphabetic');
      ctx.restore();
      const plotW = rect.w - labW - C.small * 5;
      ents.forEach((s, k) => {
        const rank = r0.r[k] + (r1.r[k] - r0.r[k]) * fr;
        if (rank > top - 0.01 + 0.5) return;
        const y = plotTop + rank * band + (band - bh) / 2;
        const v = valueAt(s, ff);
        const w = Math.max(0, (v / max) * plotW * grow);
        const col = s.color ? colorOf(p, s.color) : C.color(k);
        ctx.save();
        ctx.globalAlpha *= clamp01(top - rank + 0.3);
        C.text(s.name, rect.x + labW - fs * 0.6, y + bh / 2, lfont, p.ink, 'right', 'middle');
        roundRect(ctx, rect.x + labW, y, w, bh, Math.min(bh / 2, (C.cs.barRadius || 0) * C.u));
        C.fillMark(ctx, col, { x: rect.x + labW, y, w, h: bh });
        C.text(C.fmt(v), rect.x + labW + w + fs * 0.5, y + bh / 2, C.valueFont, p.ink, 'left', 'middle');
        ctx.restore();
      });
    },
  };
}

function emptyChart(C) {
  return {
    duration: 0.5, hold: 1, issues: [{ level: 'error', message: '图表没有数据' }],
    draw(ctx) {
      const { rect, p } = C;
      ctx.save(); ctx.strokeStyle = p.softLine; ctx.setLineDash([6, 6]); ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      C.ctx = ctx; C.text('无数据', rect.x + rect.w / 2, rect.y + rect.h / 2, C.labelFont, p.mutedText, 'center', 'middle'); ctx.restore();
    },
  };
}

const chart = {
  type: 'chart',
  measure(block, c, w, maxH) {
    const kind = block.kind || 'bar';
    const n = block.data?.labels?.length || 4;
    if (kind === 'progress') return { h: Math.min(maxH, n * c.env.sizes.small * 4.2), fill: false };
    if (kind === 'hbar') { const nn = block.data?.series ? n : (Array.isArray(block.data) ? block.data.length : n); return { h: Math.min(maxH, Math.max(nn * c.env.sizes.small * 2.6, Math.min(maxH * 0.6, nn * c.env.sizes.body * 3))), fill: true, max: nn * c.env.sizes.body * 3.6 + c.env.sizes.body * 2 }; }
    return { h: Math.min(maxH, w * 0.62), fill: true };
  },
  build(block, c, rect) {
    const C = new ChartCtx(block, c, rect);
    const kind = block.kind || 'bar';
    const hasData = C.series.some((s) => s.values.some((v) => v != null) || s.points?.length);
    if (!hasData) return emptyChart(C);
    switch (kind) {
      case 'hbar': return hbar(C);
      case 'pie': return pie(C, false);
      case 'donut': return pie(C, true);
      case 'scatter': return scatter(C);
      case 'progress': return progress(C);
      case 'gauge': return gauge(C);
      case 'funnel': return funnel(C);
      case 'radar': return radar(C);
      case 'race': return race(C);
      case 'line': case 'area': case 'stacked': case 'waterfall': return cartesian(C, kind);
      default: return cartesian(C, 'bar');
    }
  },
};

export default [chart];
