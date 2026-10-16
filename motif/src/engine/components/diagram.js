// Infographic & diagram components: table, timeline, steps, features, compare, flow,
// hierarchy, matrix, pyramid. Each has its own choreography built on the shared vocabulary.
import {
  role, paintFor, textAnimator, drawText, blockState, withState, drawCard, drawIcon, pickIcon,
  roundRect, toCss, EASE, clamp01, colorOf, blockPreset, mix,
  recItem,
} from './kit.js';
import { fontString, drawInline, measureInline } from '../text/text.js';
import { parseNumberish } from '../../core/util/misc.js';

const TAU = Math.PI * 2;
const popE = (env, t, d = 0.55) => (env.motion.spring ? env.motion.spring(clamp01(t / (d * 1.1))) : EASE.outBack(clamp01(t / d)));
/** Pick the largest scale k from the ladder for which fits(k) is true. */
function ladder(fits, ks = [1.5, 1.35, 1.2, 1.08, 1, 0.9, 0.8, 0.7, 0.62]) {
  for (const k of ks) if (fits(k)) return k;
  return ks[ks.length - 1];
}
const lay = (c, text, roleName, size, w, extra = {}) => c.te.layout(text ?? '', role(c.env, roleName, extra.role), size, { maxWidth: w, ...extra });

function iconBadge(ctx, c, name, cx, cy, R, t, o = {}) {
  const { p } = c;
  const k = o.k ?? 1;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = o.fill || toCss(o.color || p.accent, p.dark ? 0.17 : 0.13); ctx.fill();
  if (o.ring) { ctx.lineWidth = Math.max(1.5, c.env.unit * 2.5); ctx.strokeStyle = o.color || p.accent; ctx.stroke(); }
  drawIcon(ctx, name, 0, 0, R * 1.05, o.iconColor || o.color || p.accentText, { stroke: 2, draw: o.draw ?? clamp01(t / 0.8) });
  ctx.restore();
}

// ───────────────────────────── table ─────────────────────────────
function tableModel(block, c, w, maxH) {
  const { env, te } = c;
  const cols = (block.columns || []).map((col) => (typeof col === 'object' && col ? col : { label: String(col ?? '') }));
  const rows = (block.rows || []).map((r) => (Array.isArray(r) ? r : [r]));
  const ncol = Math.max(cols.length, ...rows.map((r) => r.length));
  while (cols.length < ncol) cols.push({ label: '' });
  const numeric = cols.map((col, j) => col.align ? col.align === 'right' : rows.length > 0 && rows.every((r) => r[j] == null || r[j] === '' || parseNumberish(String(r[j])) != null && /^[\s¥$€£+\-−]*[\d.,]+\s*[%万亿kKmMbB倍x]?\s*$/.test(String(r[j]))));
  for (const key of ['h3', 'lead', 'body', 'small', 'caption']) {
    if (key === 'h3' && rows.length > 4) continue;
    const fs = env.sizes[key] * (key === 'h3' ? 0.85 : 1);
    const f = fontString(role(env, 'text'), fs);
    const hf = fontString(role(env, 'label'), Math.max(env.sizes.label, fs * 0.55));
    const pad = fs * 1.1;
    const natural = cols.map((col, j) => Math.max(te.width(String(col.label).toUpperCase(), hf) , ...rows.map((r) => te.width(String(r[j] ?? ''), f))) + pad);
    const total = natural.reduce((a, b) => a + b, 0);
    const widths = natural.map((x) => (x / total) * w);
    const rowH = fs * 2.3;
    const headH = Math.max(env.sizes.label, fs * 0.55) * 3;
    const h = headH + rowH * rows.length;
    if (h <= maxH && total <= w * 1.05 || key === 'caption') return { cols, rows, numeric, widths, fs, pad, rowH, headH, h, ncol };
  }
  return null;
}

const table = {
  type: 'table',
  measure(block, c, w, maxH) { const m = tableModel(block, c, w, maxH - (block.title ? c.env.sizes.body * 2 : 0)); return { h: m.h + (block.title ? c.env.sizes.body * 2 : 0) }; },
  build(block, c, rect) {
    const { env, p, te } = c;
    const titleL = block.title ? lay(c, block.title, 'heading', env.sizes.body * 1.05, rect.w) : null;
    const tH = titleL ? titleL.height + env.sizes.body * 0.7 : 0;
    const M = tableModel(block, c, rect.w, rect.h - tH);
    const y0 = rect.y + tH + Math.max(0, (rect.h - tH - M.h) / 2) * (c.hint?.valign === 'center' ? 1 : 0);
    const per = Math.min(0.12, 1.4 / Math.max(1, M.rows.length)) * env.motion.tempo;
    const rowStart = 0.35;
    const tHl = rowStart + per * M.rows.length + 0.4;
    const hlRow = block.highlight?.row, hlCol = block.highlight?.col;
    const f = fontString(role(env, 'text'), M.fs);
    const fb = fontString(role(env, 'text', { weight: 650 }), M.fs);
    const hfs = Math.max(env.sizes.label, M.fs * 0.55);
    const hf = fontString(role(env, 'label'), hfs);
    const xs = []; let acc = rect.x; for (const w of M.widths) { xs.push(acc); acc += w; }
    const txt = (ctx, s, x, y, font, color, align) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; drawInline(ctx, s, x, y); ctx.textAlign = 'left'; };
    return {
      duration: tHl + 0.5, hold: 1.5 + M.rows.length * M.ncol * 0.12,
      draw(ctx, t) {
        if (titleL) drawText(ctx, titleL, rect.x, rect.y, rect.w, paintFor(c, p.ink, { flat: true }), textAnimator(env, titleL, 'fade', { unit: 'line' }), t);
        const e = env.motion.ease(clamp01(t / (env.motion.duration * 0.9)));
        // header
        ctx.save(); ctx.globalAlpha *= clamp01(t / 0.4);
        M.cols.forEach((col, j) => {
          const label = env.fonts.label.case === 'upper' ? String(col.label).toUpperCase() : String(col.label);
          if ('letterSpacing' in ctx) ctx.letterSpacing = `${(env.fonts.label.tracking || 0) * hfs}px`;
          ctx.font = hf; ctx.fillStyle = j === hlCol ? p.accentText : p.mutedText; ctx.textBaseline = 'middle';
          ctx.textAlign = M.numeric[j] ? 'right' : 'left';
          drawInline(ctx, label, M.numeric[j] ? xs[j] + M.widths[j] - M.pad / 2 : xs[j] + (j ? M.pad / 2 : 0), y0 + M.headH * 0.5);
          ctx.textAlign = 'left';
        });
        ctx.restore();
        ctx.fillStyle = p.ink; ctx.fillRect(rect.x, y0 + M.headH - Math.max(1, env.unit * 1.5), rect.w * e, Math.max(1.5, env.unit * 2));
        // highlight row background
        const hm = EASE.inOutCubic(clamp01((t - tHl) / 0.5));
        if (hlRow != null && hlRow < M.rows.length && hm > 0) {
          ctx.fillStyle = p.highlight;
          ctx.fillRect(rect.x, y0 + M.headH + hlRow * M.rowH, rect.w * hm, M.rowH);
        }
        if (hlCol != null && hm > 0) { ctx.fillStyle = toCss(p.accent, 0.08); ctx.fillRect(xs[hlCol], y0, M.widths[hlCol], (M.headH + M.rowH * M.rows.length) * hm); }
        M.rows.forEach((r, i) => {
          const ti = t - rowStart - i * per;
          if (ti <= 0) return;
          const a = clamp01(ti / 0.45);
          const y = y0 + M.headH + i * M.rowH;
          recItem(i, { x: rect.x, y, w: rect.w, h: M.rowH }, ctx);
          ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - env.motion.ease(clamp01(ti / 0.6))) * M.fs * 0.6);
          for (let j = 0; j < M.ncol; j++) {
            const v = String(r[j] ?? '');
            const strong = j === 0 || i === hlRow || j === hlCol;
            txt(ctx, v, M.numeric[j] ? xs[j] + M.widths[j] - M.pad / 2 : xs[j] + (j ? M.pad / 2 : 0), y + M.rowH / 2, strong ? fb : f, i === hlRow || j === hlCol ? p.ink : j === 0 ? p.ink : mix(p.ink, p.mutedText, 0.4), M.numeric[j] ? 'right' : 'left');
          }
          ctx.restore();
          if (i < M.rows.length - 1) { ctx.fillStyle = p.softLine; ctx.fillRect(rect.x, y + M.rowH - 0.5, rect.w * clamp01(ti / 0.6), Math.max(1, env.unit)); }
        });
      },
    };
  },
};

// ───────────────────────────── timeline ─────────────────────────────
const timeline = {
  type: 'timeline',
  measure(block, c, w, maxH) {
    const vertical = block.orientation === 'vertical' || (block.orientation !== 'horizontal' && (c.env.portrait || (block.items || []).length > 6));
    if (vertical) return { h: Math.min(maxH, (block.items || []).length * c.env.sizes.body * 3.4), fill: true, max: (block.items || []).length * c.env.sizes.body * 5 };
    return { h: Math.min(maxH, c.env.sizes.body * 13), fill: true, max: c.env.sizes.body * 18 };
  },
  build(block, c, rect) {
    const { env, p } = c;
    const items = block.items || [];
    const n = items.length;
    const vertical = block.orientation === 'vertical' || (block.orientation !== 'horizontal' && (env.portrait || n > 6));
    const T = env.motion.tempo;
    const lineDur = Math.min(2.4, 0.8 + n * 0.28) * T;
    const hl = block.highlight;
    let dotR = env.sizes.body * 0.36;
    if (!vertical) {
      const slot = rect.w / n;
      const build = (k) => items.map((it) => ({
        D: lay(c, it.date ?? '', 'number', env.sizes.h3 * k * (n <= 4 ? 1.1 : 0.9), slot * 0.92, { align: 'left' }),
        Tt: lay(c, it.title ?? '', 'text', env.sizes.lead * k * 0.9, slot * 0.88, { role: { weight: 600 } }),
        X: it.text ? lay(c, it.text, 'text', env.sizes.body * k * 0.85, slot * 0.88) : null,
      }));
      const hOf = (ms, k) => Math.max(...ms.map((m) => m.D.height + m.Tt.height + (m.X ? m.X.height : 0))) + env.sizes.body * k * 3.2;
      let models;
      const k = ladder((kk) => { models = build(kk); return hOf(models, kk) <= rect.h && models.every((m) => m.Tt.lines.length <= 3); });
      models = build(k);
      const lineY = rect.y + Math.max(env.sizes.body * 2.6 * k, (rect.h - hOf(models, k)) / 2 + env.sizes.body * 2.2 * k);
      return {
        duration: 0.2 + lineDur + 0.6, hold: 1.5 + n * 0.5,
        draw(ctx, t) {
          const lp = EASE.inOutCubic(clamp01((t - 0.1) / lineDur));
          ctx.fillStyle = p.softLine;
          ctx.fillRect(rect.x, lineY - env.unit, rect.w * lp, Math.max(2, env.unit * 2));
          if (hl != null) {
            const hx = rect.x + slot * (hl + 0.5);
            ctx.fillStyle = p.accent; ctx.fillRect(rect.x, lineY - env.unit * 1.5, Math.min(hx - rect.x, rect.w * lp), Math.max(3, env.unit * 3));
          }
          items.forEach((it, i) => {
            const x = rect.x + slot * (i + 0.5);
            const reach = (x - rect.x) / rect.w;
            const ti = t - 0.1 - reach * lineDur;
            if (ti <= 0) return;
            const k = popE(env, ti);
            recItem(i, { x: x - dotR, y: lineY - dotR, w: dotR * 2, h: dotR * 2 }, ctx);
            const isH = hl === i, past = hl != null && i < hl;
            const col = isH || hl == null ? p.accent : past ? p.accent : p.mutedText;
            ctx.save();
            ctx.translate(x, lineY); ctx.scale(k, k);
            if (isH) { ctx.beginPath(); ctx.arc(0, 0, dotR * 2.2, 0, TAU); ctx.fillStyle = toCss(p.accent, 0.18 + 0.08 * Math.sin(t * 3)); ctx.fill(); }
            ctx.beginPath(); ctx.arc(0, 0, dotR * (isH ? 1.25 : 1), 0, TAU);
            ctx.fillStyle = past || isH || hl == null ? col : p.bg; ctx.fill();
            ctx.lineWidth = Math.max(2, env.unit * 3); ctx.strokeStyle = col; ctx.stroke();
            ctx.restore();
            if (it.icon) iconBadge(ctx, c, it.icon, x, lineY - env.sizes.body * 2.4, env.sizes.body * 0.85, ti, { k });
            const m = models[i];
            const a = clamp01((ti - 0.15) / 0.5);
            ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - env.motion.ease(clamp01((ti - 0.15) / 0.7))) * env.sizes.body * 0.6);
            const tx = x - slot * 0.44;
            let y = lineY + dotR * 2.8;
            drawText(ctx, m.D, tx, y, slot * 0.9, paintFor(c, isH ? p.accentText : p.ink), null, 0);
            y += m.D.height + env.sizes.small * 0.2;
            drawText(ctx, m.Tt, tx, y, slot * 0.88, paintFor(c, p.ink, { flat: true }), null, 0);
            y += m.Tt.height + env.sizes.small * 0.2;
            if (m.X) drawText(ctx, m.X, tx, y, slot * 0.88, paintFor(c, p.mutedText, { flat: true }), null, 0);
            ctx.restore();
          });
        },
      };
    }
    // vertical
    const rowH = rect.h / n;
    // tall rows (portrait, few items) get proportionally larger type
    const kv = Math.max(1, Math.min(1.6, rowH / (env.sizes.body * 3.6)));
    const B = env.sizes.body * kv;
    dotR *= kv;
    const lx = rect.x + B * 4.6;
    const models = items.map((it) => ({
      D: lay(c, it.date ?? '', 'number', B, B * 4, { align: 'right' }),
      Tt: lay(c, it.title ?? '', 'text', B * 1.1, rect.w - (lx - rect.x) - B * 1.5, { role: { weight: 600 } }),
      X: it.text ? lay(c, it.text, 'text', env.sizes.small * kv, rect.w - (lx - rect.x) - B * 1.5) : null,
    }));
    return {
      duration: 0.2 + lineDur + 0.6, hold: 1.5 + n * 0.5,
      draw(ctx, t) {
        const lp = EASE.inOutCubic(clamp01((t - 0.1) / lineDur));
        ctx.fillStyle = p.softLine;
        ctx.fillRect(lx - env.unit, rect.y + rowH * 0.3, Math.max(2, env.unit * 2), (rect.h - rowH * 0.6) * lp);
        items.forEach((it, i) => {
          const y = rect.y + rowH * (i + 0.3);
          const ti = t - 0.1 - (i / n) * lineDur;
          if (ti <= 0) return;
          const k = popE(env, ti);
          const isH = hl === i;
          recItem(i, { x: lx - dotR, y: y - dotR, w: dotR * 2, h: dotR * 2 }, ctx);
          ctx.save(); ctx.translate(lx, y); ctx.scale(k, k);
          ctx.beginPath(); ctx.arc(0, 0, dotR * (isH ? 1.3 : 1), 0, TAU); ctx.fillStyle = isH || hl == null ? p.accent : p.bg; ctx.fill();
          ctx.lineWidth = Math.max(2, env.unit * 3); ctx.strokeStyle = p.accent; ctx.stroke(); ctx.restore();
          const m = models[i];
          ctx.save(); ctx.globalAlpha *= clamp01((ti - 0.1) / 0.45);
          drawText(ctx, m.D, lx - B * 4.3, y - m.D.lineHeight / 2, B * 3.8, paintFor(c, isH ? p.accentText : p.mutedText), null, 0);
          drawText(ctx, m.Tt, lx + B * 1.2, y - m.Tt.lineHeight / 2, rect.w, paintFor(c, p.ink, { flat: true }), null, 0);
          if (m.X) drawText(ctx, m.X, lx + B * 1.2, y - m.Tt.lineHeight / 2 + m.Tt.height + 4, rect.w, paintFor(c, p.mutedText, { flat: true }), null, 0);
          ctx.restore();
        });
      },
    };
  },
};

// ───────────────────────────── steps ─────────────────────────────
function arrowHead(ctx, x, y, ang, s) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(ang - 0.45) * s, y - Math.sin(ang - 0.45) * s);
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(ang + 0.45) * s, y - Math.sin(ang + 0.45) * s);
  ctx.stroke();
}

const steps = {
  type: 'steps',
  measure(block, c, w, maxH) {
    const n = (block.items || []).length;
    const style = block.style && block.style !== 'auto' ? block.style : 'arrows';
    if (style === 'circle') return { h: Math.min(maxH, w * 0.7), fill: true };
    if (c.env.portrait) return { h: Math.min(maxH, n * c.env.sizes.body * 3.6), fill: true, max: n * c.env.sizes.body * 5.2 };
    const anyText = (block.items || []).some((i) => i.text);
    return { h: Math.min(maxH, c.env.sizes.body * (anyText ? 12 : 9)), fill: true, max: c.env.sizes.body * (anyText ? 19 : 15) };
  },
  build(block, c, rect) {
    const { env, p } = c;
    const items = block.items || [];
    const n = items.length;
    let style = block.style && block.style !== 'auto' ? block.style : 'arrows';
    const T = env.motion.tempo;
    const per = Math.min(0.42, 2.2 / n) * T;
    const hl = block.highlight;
    if (style === 'circle') return cycle(block, c, rect, items, per);
    if (env.portrait) style = 'vertical';
    if (style === 'vertical') {
      const rowH = rect.h / n;
      const R = Math.min(rowH * 0.32, env.sizes.body * 1.1);
      return {
        duration: per * n + 0.8, hold: 1.2 + n * 0.5,
        draw(ctx, t) {
          items.forEach((it, i) => {
            const ti = t - i * per;
            if (ti <= 0) return;
            const cy = rect.y + rowH * (i + 0.5);
            const k = popE(env, ti);
            recItem(i, { x: rect.x, y: cy - R, w: R * 2, h: R * 2 }, ctx);
            if (i < n - 1) { ctx.fillStyle = p.softLine; ctx.fillRect(rect.x + R - env.unit, cy + R * 1.2, env.unit * 2, (rowH - R * 2.4) * clamp01((ti - 0.3) / 0.4)); }
            ctx.save(); ctx.translate(rect.x + R, cy); ctx.scale(k, k);
            ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = hl == null || hl === i ? p.accent : toCss(p.accent, 0.2); ctx.fill();
            ctx.font = fontString(role(env, 'number'), R * 0.9); ctx.fillStyle = hl == null || hl === i ? p.onAccent : p.accentText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(i + 1), 0, R * 0.05); ctx.restore();
            const L = lay(c, it.title, 'text', env.sizes.body, rect.w - R * 3, { role: { weight: 600 } });
            ctx.save(); ctx.globalAlpha *= clamp01((ti - 0.15) / 0.4);
            drawText(ctx, L, rect.x + R * 2.8, cy - (it.text ? L.height : L.height / 2), rect.w, paintFor(c, p.ink, { flat: true }), null, 0);
            if (it.text) drawText(ctx, lay(c, it.text, 'text', env.sizes.small, rect.w - R * 3), rect.x + R * 2.8, cy + 4, rect.w, paintFor(c, p.mutedText, { flat: true }), null, 0);
            ctx.restore();
          });
        },
      };
    }
    const gap = env.sizes.body * (style === 'cards' ? 0.8 : 1.6);
    const cw = (rect.w - gap * (n - 1)) / n;
    let R, models, contentH, blockH;
    const make = (k) => {
      R = Math.min(env.sizes.body * 1.35 * k, cw * 0.22);
      models = items.map((it) => ({
        Tt: lay(c, it.title, 'heading', env.sizes.h3 * k * (n > 4 ? 0.82 : 0.95), cw - (style === 'cards' ? env.sizes.body * 1.6 : 0), { balance: true }),
        X: it.text ? lay(c, it.text, 'text', env.sizes.body * k * 0.88, cw - (style === 'cards' ? env.sizes.body * 1.6 : 0)) : null,
      }));
      contentH = Math.max(...models.map((m) => m.Tt.height + (m.X ? m.X.height + env.sizes.small * 0.5 : 0)));
      blockH = R * 2 + env.sizes.body * 1.4 + contentH;
      return blockH <= rect.h && models.every((m) => m.Tt.lines.length <= 2);
    };
    make(ladder(make));
    const y0 = rect.y + Math.max(0, (rect.h - blockH) / 2);
    return {
      duration: per * n + 0.9, hold: 1.5 + n * 0.6,
      draw(ctx, t) {
        items.forEach((it, i) => {
          const x = rect.x + i * (cw + gap);
          const ti = t - i * per;
          if (ti <= 0) return;
          const k = popE(env, ti);
          const isH = hl === i;
          const m = models[i];
          recItem(i, style === 'cards' ? { x, y: y0 - env.sizes.body * 0.8, w: cw, h: blockH + env.sizes.body * 1.6 } : { x: x, y: y0, w: R * 2, h: R * 2 }, ctx);
          if (style === 'cards') {
            withState(ctx, blockState(c, ti, blockPreset(env), { size: env.sizes.h2 }), { x, y: y0 - env.sizes.body * 0.8, w: cw, h: blockH + env.sizes.body * 1.6 }, () => {
              drawCard(ctx, c, { x, y: y0 - env.sizes.body * 0.8, w: cw, h: blockH + env.sizes.body * 1.6 });
            });
          }
          const pad = style === 'cards' ? env.sizes.body * 0.8 : 0;
          const cx = x + pad + R;
          const cy = y0 + R;
          // connector arrow to next step
          if (i < n - 1 && style !== 'cards') {
            const a = EASE.inOutCubic(clamp01((ti - 0.25) / (per * 1.1)));
            if (a > 0) {
              ctx.save(); ctx.strokeStyle = p.softLine; ctx.lineWidth = Math.max(2, env.unit * 2.4); ctx.lineCap = 'round';
              const x0 = cx + R + env.sizes.body * 0.5, x1 = x + cw + gap + R - R - env.sizes.body * 0.5;
              const xe = x0 + (x1 - x0) * a;
              ctx.setLineDash([2, env.unit * 9]);
              ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(xe, cy); ctx.stroke();
              ctx.setLineDash([]);
              if (a > 0.95) { ctx.strokeStyle = p.mutedText; arrowHead(ctx, xe, cy, 0, R * 0.45); }
              ctx.restore();
            }
          }
          ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
          ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
          const filled = hl == null ? i === 0 || style === 'numbers' : isH;
          ctx.fillStyle = filled ? p.accent : toCss(p.accent, p.dark ? 0.15 : 0.12); ctx.fill();
          if (!filled) { ctx.lineWidth = Math.max(1.5, env.unit * 2); ctx.strokeStyle = toCss(p.accent, 0.6); ctx.stroke(); }
          if (it.icon) drawIcon(ctx, it.icon, 0, 0, R * 1.0, filled ? p.onAccent : p.accentText, { draw: clamp01(ti / 0.8) });
          else { ctx.font = fontString(role(env, 'number'), R * 0.95); ctx.fillStyle = filled ? p.onAccent : p.accentText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.fillText(String(i + 1).padStart(2, '0'), 0, R * 0.06); }
          ctx.restore();
          ctx.save(); ctx.globalAlpha *= clamp01((ti - 0.15) / 0.45);
          ctx.translate(0, (1 - env.motion.ease(clamp01((ti - 0.15) / 0.7))) * env.sizes.body * 0.5);
          let y = cy + R + env.sizes.body;
          if (it.icon && style !== 'cards') {
            ctx.font = fontString(role(env, 'label'), env.sizes.label); ctx.fillStyle = p.accentText; ctx.textBaseline = 'alphabetic';
            if ('letterSpacing' in ctx) ctx.letterSpacing = `${env.sizes.label * 0.12}px`;
            ctx.fillText(`STEP ${String(i + 1).padStart(2, '0')}`, x + pad, y - env.sizes.body * 0.25);
            y += env.sizes.label * 0.4;
          }
          drawText(ctx, m.Tt, x + pad, y, cw, paintFor(c, p.ink, { flat: true }), null, 0);
          if (m.X) drawText(ctx, m.X, x + pad, y + m.Tt.height + env.sizes.small * 0.5, cw, paintFor(c, p.mutedText, { flat: true }), null, 0);
          ctx.restore();
        });
      },
    };
  },
};

function cycle(block, c, rect, items, per) {
  const { env, p } = c;
  const n = items.length;
  const R = Math.min(rect.w, rect.h) * 0.33;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const nr = Math.min(env.sizes.body * 1.7, R * 0.3);
  return {
    duration: per * n + 1.2, hold: 2 + n * 0.4,
    draw(ctx, t) {
      // ring arrows
      ctx.save();
      ctx.strokeStyle = p.softLine; ctx.lineWidth = Math.max(2, env.unit * 3); ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i / n) * TAU + (nr * 1.5) / R, a1 = -Math.PI / 2 + ((i + 1) / n) * TAU - (nr * 1.5) / R;
        const pr = EASE.inOutCubic(clamp01((t - i * per - 0.3) / (per * 1.2)));
        if (pr <= 0) continue;
        const ae = a0 + (a1 - a0) * pr;
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, ae); ctx.stroke();
        if (pr > 0.9) arrowHead(ctx, cx + Math.cos(ae) * R, cy + Math.sin(ae) * R, ae + Math.PI / 2, nr * 0.5);
      }
      ctx.restore();
      items.forEach((it, i) => {
        const a = -Math.PI / 2 + (i / n) * TAU;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const ti = t - i * per;
        if (ti <= 0) return;
        recItem(i, { x: x - nr, y: y - nr, w: nr * 2, h: nr * 2 }, ctx);
        const k = popE(env, ti);
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        ctx.beginPath(); ctx.arc(0, 0, nr, 0, TAU); ctx.fillStyle = p.data[i % p.data.length]; ctx.fill();
        if (it.icon) drawIcon(ctx, it.icon, 0, 0, nr * 1.05, p.dark ? '#111' : '#fff', { draw: clamp01(ti / 0.8) });
        else { ctx.font = fontString(role(env, 'number'), nr * 0.9); ctx.fillStyle = p.dark ? '#111' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), 0, nr * 0.05); }
        ctx.restore();
        const L = lay(c, it.title, 'text', env.sizes.lead * 0.9, R * 0.9, { role: { weight: 650 }, align: Math.abs(Math.cos(a)) < 0.3 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right' });
        const ox = Math.cos(a) * (nr + env.sizes.small * 0.8), oy = Math.sin(a) * (nr + env.sizes.small * 0.8);
        const lx = Math.abs(Math.cos(a)) < 0.3 ? x - R * 0.45 : Math.cos(a) > 0 ? x + ox : x + ox - R * 0.9;
        const ly = Math.abs(Math.cos(a)) < 0.3 ? (Math.sin(a) < 0 ? y - nr - env.sizes.small * 0.6 - L.height : y + nr + env.sizes.small * 0.6) : y - L.height / 2 + oy * 0.2;
        ctx.save(); ctx.globalAlpha *= clamp01((ti - 0.2) / 0.4);
        drawText(ctx, L, lx, ly, R * 0.9, paintFor(c, p.ink, { flat: true }), null, 0);
        ctx.restore();
      });
      if (block.title || items.length) {
        const center = block.center;
        if (center) { const L = lay(c, center, 'heading', env.sizes.lead, R * 1.1, { align: 'center', balance: true }); drawText(ctx, L, cx - R * 0.55, cy - L.height / 2, R * 1.1, paintFor(c, p.ink), textAnimator(env, L, 'fade', { unit: 'line' }), t - 0.4); }
      }
    },
  };
}

// ───────────────────────────── features ─────────────────────────────
const features = {
  type: 'features',
  measure(block, c, w, maxH) {
    const n = (block.items || []).length;
    const cols = featureCols(block, c, w);
    const rows = Math.ceil(n / cols);
    const anyText = (block.items || []).some((i) => i.text);
    return { h: Math.min(maxH * 0.9, rows * c.env.sizes.body * (anyText ? 13 : 9.5)), fill: true, max: rows * c.env.sizes.body * (anyText ? 16.5 : 12) };
  },
  build(block, c, rect) {
    const { env, p } = c;
    const items = block.items || [];
    const n = items.length;
    const cols = featureCols(block, c, rect.w);
    const rows = Math.ceil(n / cols);
    const style = block.style && block.style !== 'auto' ? block.style : env.theme.shape.card === 'flat' || env.theme.shape.card === 'paper' || env.theme.shape.card === 'line' ? 'plain' : 'cards';
    const gap = env.grid.gutter * 1.3;
    const cw = (rect.w - gap * (cols - 1)) / cols;
    let pad, iconR, models, cellH;
    const make = (k) => {
      pad = style === 'cards' ? env.sizes.body * 1.15 * Math.min(k, 1.2) : 0;
      iconR = env.sizes.body * (n <= 3 ? 1.15 : 1) * k;
      models = items.map((it) => ({
        Tt: lay(c, it.title, 'heading', env.sizes.h3 * k * (cols >= 4 ? 0.82 : 0.95), cw - pad * 2),
        X: it.text ? lay(c, it.text, 'text', env.sizes.body * k * 0.85, cw - pad * 2) : null,
        icon: it.icon || pickIcon(`${it.title} ${it.text || ''}`),
      }));
      cellH = Math.max(...models.map((m) => pad * 2 + iconR * 2 + env.sizes.body * 0.9 + m.Tt.height + (m.X ? m.X.height + env.sizes.small * 0.5 : 0)));
      return cellH * rows + gap * (rows - 1) <= rect.h;
    };
    make(ladder(make, [1.3, 1.18, 1.06, 0.96, 0.86, 0.76, 0.66]));
    const totalH = rows * cellH + (rows - 1) * gap;
    const y0 = rect.y + Math.max(0, (rect.h - totalH) / 2);
    const per = Math.min(0.16, 1.4 / n) * env.motion.tempo;
    return {
      duration: per * n + env.motion.duration + 0.4, hold: 1.5 + n * 0.5,
      draw(ctx, t) {
        items.forEach((it, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const box = { x: rect.x + col * (cw + gap), y: y0 + row * (cellH + gap), w: cw, h: cellH };
          const ti = t - i * per;
          if (ti <= 0) return;
          const m = models[i];
          recItem(i, box, ctx);
          withState(ctx, blockState(c, ti, blockPreset(env), { size: env.sizes.h2 }), box, () => {
            if (style === 'cards') drawCard(ctx, c, box);
            else if (col > 0) { ctx.fillStyle = p.softLine; ctx.fillRect(box.x - gap / 2, box.y, Math.max(1, env.unit), box.h * clamp01(ti / 0.6)); }
            iconBadge(ctx, c, m.icon, box.x + pad + iconR, box.y + pad + iconR, iconR, ti - 0.1, { k: popE(env, ti - 0.05) });
            let y = box.y + pad + iconR * 2 + env.sizes.body * 0.9;
            drawText(ctx, m.Tt, box.x + pad, y, cw - pad * 2, paintFor(c, p.ink, { flat: true }), null, 0);
            if (m.X) drawText(ctx, m.X, box.x + pad, y + m.Tt.height + env.sizes.small * 0.5, cw - pad * 2, paintFor(c, p.mutedText, { flat: true }), null, 0);
          });
        });
      },
    };
  },
};
function featureCols(block, c, w) {
  const n = (block.items || []).length;
  if (block.columns && block.columns !== 'auto') return Number(block.columns);
  if (c.env.portrait) return n <= 3 ? 1 : 2;
  if (w < c.env.W * 0.55) return n <= 2 ? n : 2;
  return n <= 4 ? n : n === 5 || n === 6 ? 3 : 4;
}

// ───────────────────────────── compare ─────────────────────────────
const compare = {
  type: 'compare',
  measure(block, c, w, maxH) { const h = c.env.sizes.body * (8 + Math.max(0, ...(block.columns || []).map((col) => (col.items || []).length)) * 2.4); return { h: Math.min(maxH, h), fill: true, max: h * 1.3 }; },
  build(block, c, rect) {
    const { env, p } = c;
    const cols = block.columns || [];
    const n = cols.length;
    const vs = block.vs !== false && n === 2;
    const gap = vs ? env.sizes.body * 3.2 : env.grid.gutter * 1.5;
    const cw = (rect.w - gap * (n - 1)) / n;
    const pad = env.sizes.body * 1.3;
    const win = block.winner;
    let models, colH, isz;
    const make = (k) => {
      isz = env.sizes.lead * 0.92 * k;
      models = cols.map((col, j) => ({
        Tt: lay(c, col.title ?? '', 'heading', env.sizes.h2 * 0.9 * k, cw - pad * 2),
        V: col.value != null ? lay(c, String(col.value), 'number', env.sizes.h1 * k, cw - pad * 2) : null,
        items: (col.items || []).map((it) => lay(c, it, 'text', isz, cw - pad * 2 - isz * 1.6)),
        tone: col.tone && col.tone !== 'auto' ? colorOf(p, col.tone) : win == null ? p.data[j % p.data.length] : win === j ? p.accent : p.mutedText,
      }));
      colH = Math.max(...models.map((m) => pad * 2 + m.Tt.height + (m.V ? m.V.height + env.sizes.body * 0.4 : 0) + env.sizes.body * 1.2 + m.items.reduce((s, L) => s + L.height + isz * 0.6, 0)));
      return colH <= rect.h;
    };
    make(ladder(make, [1.2, 1.08, 1, 0.9, 0.8, 0.7, 0.6]));
    const h = Math.min(rect.h, colH);
    const y0 = rect.y + (rect.h - h) / 2;
    const per = 0.35 * env.motion.tempo;
    return {
      duration: per * n + 0.4 + Math.max(...models.map((m) => m.items.length)) * 0.15 + 0.8, hold: 2 + models.reduce((s, m) => s + m.items.length, 0) * 0.35,
      draw(ctx, t) {
        models.forEach((m, j) => {
          const box = { x: rect.x + j * (cw + gap), y: y0, w: cw, h };
          const tj = t - j * per;
          if (tj <= 0) return;
          recItem(j, box, ctx);
          const isW = win === j, isL = win != null && win !== j;
          const hm = win != null ? EASE.inOutCubic(clamp01((t - per * n - 0.6) / 0.5)) : 0;
          withState(ctx, blockState(c, tj, j === 0 ? 'slide-right' : 'slide-left', { size: env.sizes.h2 }), box, () => {
            ctx.save();
            if (isL) ctx.globalAlpha *= 1 - hm * 0.35;
            drawCard(ctx, c, box);
            if (isW && hm > 0) {
              ctx.save(); roundRect(ctx, box.x, box.y, box.w, box.h, env.theme.shape.radius * env.unit);
              ctx.lineWidth = Math.max(2, env.unit * 3); ctx.strokeStyle = toCss(p.accent, hm); ctx.shadowColor = toCss(p.accent, 0.5 * hm); ctx.shadowBlur = 30 * env.unit; ctx.stroke(); ctx.restore();
            }
            ctx.fillStyle = m.tone; ctx.fillRect(box.x + pad, box.y + pad * 0.7, env.sizes.body * 1.6 * clamp01(tj / 0.5), Math.max(3, env.unit * 4));
            let y = box.y + pad * 1.15;
            drawText(ctx, m.Tt, box.x + pad, y, cw, paintFor(c, p.ink), null, 0);
            y += m.Tt.height + env.sizes.body * 0.4;
            if (m.V) { drawText(ctx, m.V, box.x + pad, y, cw, paintFor(c, m.tone === p.mutedText ? p.ink : m.tone), null, 0); y += m.V.height + env.sizes.body * 0.4; }
            y += env.sizes.body * 0.4;
            m.items.forEach((L, k) => {
              const tk = tj - 0.3 - k * 0.15;
              if (tk <= 0) return;
              ctx.save(); ctx.globalAlpha *= clamp01(tk / 0.35);
              drawIcon(ctx, isL || (win == null && j === 0 && n === 2 && /过去|之前|before|旧|传统|劣|缺点|cons/i.test(String(cols[j].title))) ? 'x' : 'check', box.x + pad + isz * 0.5, y + L.lineHeight / 2, isz * 0.85, isL ? p.mutedText : m.tone, { stroke: 2.6, draw: clamp01(tk / 0.4) });
              drawText(ctx, L, box.x + pad + isz * 1.6, y, cw, paintFor(c, isL ? p.mutedText : p.ink, { flat: true }), null, 0);
              ctx.restore();
              y += L.height + isz * 0.6;
            });
            if (isW && hm > 0.2) {
              const bs = env.sizes.caption;
              const label = '推荐';
              ctx.font = fontString(role(env, 'text', { weight: 700 }), bs);
              const bw = c.te.width(label, ctx.font) + bs * 1.6;
              ctx.globalAlpha *= clamp01((hm - 0.2) / 0.4);
              roundRect(ctx, box.x + box.w - pad - bw, box.y + pad * 0.6, bw, bs * 1.9, bs * 0.95); ctx.fillStyle = p.accent; ctx.fill();
              ctx.fillStyle = p.onAccent; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(label, box.x + box.w - pad - bw / 2, box.y + pad * 0.6 + bs * 0.98); ctx.textAlign = 'left';
            }
            ctx.restore();
          });
        });
        if (vs) {
          const k = popE(env, t - per * 1.2);
          if (k > 0) {
            const x = rect.x + cw + gap / 2, y = y0 + h / 2, R = gap * 0.36;
            ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
            ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = p.ink; ctx.fill();
            ctx.font = fontString(role(env, 'display', { weight: 800 }), R * 0.8); ctx.fillStyle = p.bg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
            ctx.fillText('VS', 0, R * 0.06); ctx.restore();
          }
        }
      },
    };
  },
};

// ───────────────────────────── flow (layered DAG) ─────────────────────────────
function layerGraph(nodes, edges) {
  const ids = nodes.map((n) => n.id);
  const out = new Map(ids.map((id) => [id, []])), inn = new Map(ids.map((id) => [id, []]));
  for (const e of edges) if (out.has(e.from) && inn.has(e.to) && e.from !== e.to) { out.get(e.from).push(e.to); inn.get(e.to).push(e.from); }
  // longest-path layering with cycle protection
  const layer = new Map();
  const visiting = new Set();
  const depth = (id) => {
    if (layer.has(id)) return layer.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const d = Math.max(-1, ...inn.get(id).map(depth)) + 1;
    visiting.delete(id);
    layer.set(id, d);
    return d;
  };
  ids.forEach(depth);
  const layers = [];
  for (const id of ids) { const l = layer.get(id); (layers[l] ||= []).push(id); }
  // barycenter ordering, two sweeps
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let l = 1; l < layers.length; l++) {
      const prev = layers[l - 1];
      const pos = (id) => { const ps = inn.get(id).map((x) => prev.indexOf(x)).filter((i) => i >= 0); return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0; };
      layers[l].sort((a, b) => pos(a) - pos(b));
    }
  }
  return { layers: layers.filter(Boolean), layer, out, inn };
}

const flow = {
  type: 'flow',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.5), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const nodes = block.nodes || [];
    const edges = block.edges || [];
    const G = layerGraph(nodes, edges);
    const dir = block.direction && block.direction !== 'auto' ? block.direction : env.portrait || G.layers.length > 5 && rect.h > rect.w ? 'down' : 'right';
    const L = G.layers.length;
    const maxPer = Math.max(...G.layers.map((l) => l.length));
    const along = dir === 'right' ? rect.w : rect.h, across = dir === 'right' ? rect.h : rect.w;
    const nodeW = Math.min((along / L) * 0.74, env.sizes.body * 11);
    const fs = Math.min(env.sizes.lead * 0.95, nodeW / 6.2, (across / maxPer) * 0.22);
    const iconS = fs * 1.4;
    const pos = new Map();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    G.layers.forEach((ids, li) => {
      ids.forEach((id, k) => {
        const n = byId.get(id);
        const Tt = lay(c, n.label ?? id, 'text', fs, nodeW - fs * (n.icon ? 3.2 : 1.6), { role: { weight: 600 }, align: n.icon ? 'left' : 'center', balance: true });
        const h = Math.max(Tt.height, n.icon ? iconS : 0) + fs * 1.5;
        const a = (along / L) * (li + 0.5);
        const b = (across / (ids.length)) * (k + 0.5);
        const cx = dir === 'right' ? rect.x + a : rect.x + b;
        const cy = dir === 'right' ? rect.y + b : rect.y + a;
        pos.set(id, { x: cx - nodeW / 2, y: cy - h / 2, w: nodeW, h, cx, cy, Tt, n, li });
      });
    });
    const T = env.motion.tempo;
    const perLayer = 0.55 * T;
    const edgeDur = 0.6 * T;
    const done = perLayer * L + edgeDur;
    const radius = Math.min(env.theme.shape.radius * env.unit, 18 * env.unit);
    const edgeGeo = edges.map((e) => {
      const A = pos.get(e.from), B = pos.get(e.to);
      if (!A || !B) return null;
      let x0, y0, x1, y1, c1x, c1y, c2x, c2y;
      if (dir === 'right') {
        x0 = A.x + A.w; y0 = A.cy; x1 = B.x; y1 = B.cy;
        if (B.li <= A.li) { x0 = A.cx; y0 = A.y + A.h; x1 = B.cx; y1 = B.y + B.h; const d = Math.max(A.h, B.h) * 1.4; c1x = x0; c1y = y0 + d; c2x = x1; c2y = y1 + d; }
        else { const dx = (x1 - x0) * 0.5; c1x = x0 + dx; c1y = y0; c2x = x1 - dx; c2y = y1; }
      } else {
        x0 = A.cx; y0 = A.y + A.h; x1 = B.cx; y1 = B.y;
        if (B.li <= A.li) { x0 = A.x + A.w; y0 = A.cy; x1 = B.x + B.w; y1 = B.cy; const d = Math.max(A.w, B.w) * 0.5; c1x = x0 + d; c1y = y0; c2x = x1 + d; c2y = y1; }
        else { const dy = (y1 - y0) * 0.5; c1x = x0; c1y = y0 + dy; c2x = x1; c2y = y1 - dy; }
      }
      const at = (u) => { const m = 1 - u; return [m * m * m * x0 + 3 * m * m * u * c1x + 3 * m * u * u * c2x + u * u * u * x1, m * m * m * y0 + 3 * m * m * u * c1y + 3 * m * u * u * c2y + u * u * u * y1]; };
      return { e, A, B, at, start: perLayer * (A.li + 0.8) };
    }).filter(Boolean);
    return {
      duration: done + 0.3, hold: 2 + nodes.length * 0.3,
      draw(ctx, t) {
        // edges under nodes
        for (const g of edgeGeo) {
          const pr = EASE.inOutCubic(clamp01((t - g.start) / edgeDur));
          if (pr <= 0) continue;
          ctx.save();
          ctx.strokeStyle = toCss(p.ink, 0.35); ctx.lineWidth = Math.max(1.6, env.unit * 2.2); ctx.lineCap = 'round';
          ctx.beginPath();
          const steps = 40;
          for (let k = 0; k <= steps * pr; k++) { const [x, y] = g.at(k / steps); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          const [ex, ey] = g.at(pr);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          if (pr > 0.97) {
            const [px, py] = g.at(0.96);
            ctx.strokeStyle = toCss(p.ink, 0.55);
            arrowHead(ctx, ex, ey, Math.atan2(ey - py, ex - px), fs * 0.55);
          }
          // flowing pulses after the build
          if (pr >= 1) {
            const sp = 0.45;
            for (let q = 0; q < 2; q++) {
              const u = ((t - g.start) * sp + q * 0.5) % 1;
              const [qx, qy] = g.at(u);
              ctx.beginPath(); ctx.arc(qx, qy, Math.max(2.5, env.unit * 3.5), 0, TAU);
              ctx.fillStyle = p.accent; ctx.shadowColor = p.accent; ctx.shadowBlur = env.theme.chart.glow ? 12 : 0; ctx.fill();
            }
          }
          if (g.e.label && pr > 0.6) {
            const [mx, my] = g.at(0.5);
            ctx.globalAlpha *= clamp01((pr - 0.6) / 0.3);
            ctx.font = fontString(role(env, 'text', { weight: 500 }), env.sizes.caption);
            const tw = measureInline(ctx, String(g.e.label));
            ctx.fillStyle = p.bg; roundRect(ctx, mx - tw / 2 - 6, my - env.sizes.caption * 0.75, tw + 12, env.sizes.caption * 1.5, 6); ctx.fill();
            ctx.fillStyle = p.mutedText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; drawInline(ctx, String(g.e.label), mx, my);
          }
          ctx.restore();
        }
        for (const P of pos.values()) {
          const ti = t - P.li * perLayer;
          if (ti <= 0) continue;
          const k = popE(env, ti, 0.5);
          const tone = P.n.tone && P.n.tone !== 'auto' ? colorOf(p, P.n.tone) : P.li === 0 ? p.accent : null;
          recItem(nodes.indexOf(P.n), P, ctx, P.n.id);
          ctx.save();
          ctx.translate(P.cx, P.cy); ctx.scale(k, k); ctx.translate(-P.cx, -P.cy);
          ctx.globalAlpha *= clamp01(ti / 0.25);
          drawCard(ctx, c, P, { radius });
          if (tone) { roundRect(ctx, P.x, P.y, P.w, P.h, radius); ctx.lineWidth = Math.max(2, env.unit * 2.5); ctx.strokeStyle = tone; ctx.stroke(); }
          let tx = P.x + fs * 0.8;
          if (P.n.icon) { drawIcon(ctx, P.n.icon, tx + iconS / 2, P.cy, iconS, tone || p.accentText, { draw: clamp01(ti / 0.8) }); tx += iconS + fs * 0.6; }
          drawText(ctx, P.Tt, P.n.icon ? tx : P.x + fs * 0.8, P.cy - P.Tt.height / 2, P.n.icon ? P.w - (tx - P.x) - fs * 0.6 : P.w - fs * 1.6, paintFor(c, p.ink, { flat: true }), null, 0);
          ctx.restore();
        }
      },
    };
  },
};

// ───────────────────────────── hierarchy ─────────────────────────────
const hierarchy = {
  type: 'hierarchy',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.55), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const root = typeof block.root === 'string' ? { label: block.root } : block.root || { label: '' };
    const all = [];
    const walk = (n, d, parent) => { const node = { label: n.label ?? n.title ?? n.name ?? '', icon: n.icon, d, parent, kids: [] }; all.push(node); if (parent) parent.kids.push(node); (n.children || []).forEach((ch) => walk(typeof ch === 'string' ? { label: ch } : ch, d + 1, node)); return node; };
    const R = walk(root, 0, null);
    const depth = Math.max(...all.map((n) => n.d)) + 1;
    const style = block.style === 'mindmap' ? 'mindmap' : 'tree';
    const T = env.motion.tempo;
    const per = 0.5 * T;
    if (style === 'tree') {
      const leaves = all.filter((n) => !n.kids.length);
      const slot = rect.w / leaves.length;
      leaves.forEach((n, i) => { n.x = rect.x + slot * (i + 0.5); });
      const place = (n) => { if (n.kids.length) { n.kids.forEach(place); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; } };
      place(R);
      const levelH = rect.h / depth;
      const fs = Math.min(env.sizes.lead, slot / 4.6, levelH * 0.28);
      all.forEach((n) => {
        n.y = rect.y + levelH * (n.d + 0.5);
        n.L = lay(c, n.label, n.d === 0 ? 'heading' : 'text', n.d === 0 ? fs * 1.15 : fs, Math.max(slot * 0.86, fs * 4), { align: 'center', balance: true, role: { weight: n.d === 0 ? undefined : 600 } });
        n.w = Math.min(Math.max(n.L.width + fs * 1.6, fs * 4), Math.max(slot * 0.92, n.L.width + fs * 1.6));
        n.h = n.L.height + fs * 1.1;
      });
      return {
        duration: per * depth + 0.8, hold: 2 + all.length * 0.2,
        draw(ctx, t) {
          for (const n of all) if (n.parent) {
            const pr = EASE.inOutCubic(clamp01((t - per * n.d + per * 0.4) / (per * 0.9)));
            if (pr <= 0) continue;
            const P = n.parent;
            const midY = (P.y + P.h / 2 + n.y - n.h / 2) / 2;
            ctx.save(); ctx.strokeStyle = toCss(p.ink, 0.3); ctx.lineWidth = Math.max(1.5, env.unit * 2);
            ctx.beginPath(); ctx.moveTo(P.x, P.y + P.h / 2);
            const pts = [[P.x, midY], [n.x, midY], [n.x, n.y - n.h / 2]];
            const segs = [P.y + P.h / 2, ...pts.map((q) => q)];
            void segs;
            const total = (midY - (P.y + P.h / 2)) + Math.abs(n.x - P.x) + (n.y - n.h / 2 - midY);
            let budget = total * pr, cx = P.x, cy = P.y + P.h / 2;
            for (const [qx, qy] of pts) { const d = Math.abs(qx - cx) + Math.abs(qy - cy); const u = Math.min(1, budget / (d || 1)); ctx.lineTo(cx + (qx - cx) * u, cy + (qy - cy) * u); budget -= d; if (budget <= 0) break; cx = qx; cy = qy; }
            ctx.stroke(); ctx.restore();
          }
          for (const n of all) {
            const ti = t - per * n.d;
            if (ti <= 0) continue;
            const k = popE(env, ti, 0.5);
            const box = { x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h };
            ctx.save(); ctx.translate(n.x, n.y); ctx.scale(k, k); ctx.translate(-n.x, -n.y);
            if (n.d === 0) { roundRect(ctx, box.x, box.y, box.w, box.h, n.h / 2); ctx.fillStyle = p.accent; ctx.fill(); }
            else drawCard(ctx, c, box, { radius: Math.min(n.h / 2, env.theme.shape.radius * env.unit) });
            drawText(ctx, n.L, box.x + (box.w - n.L.width) / 2 - (n.L.maxWidth - n.L.width) * 0, n.y - n.L.height / 2, n.L.width, paintFor(c, n.d === 0 ? p.onAccent : p.ink, { flat: true }), null, 0);
            ctx.restore();
          }
        },
      };
    }
    // mindmap: root center, children alternate left/right
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const kids = R.kids;
    const left = kids.filter((_, i) => i % 2 === 1), right = kids.filter((_, i) => i % 2 === 0);
    const fs = env.sizes.body * 0.9;
    const placeSide = (arr, sgn) => {
      const leafCount = (n) => Math.max(1, n.kids.reduce((s, k) => s + leafCount(k), 0));
      const total = arr.reduce((s, n) => s + leafCount(n), 0);
      let acc = 0;
      arr.forEach((n) => {
        const lc = leafCount(n);
        n.x = cx + sgn * rect.w * 0.24; n.y = rect.y + rect.h * ((acc + lc / 2) / total); n.side = sgn;
        let a2 = acc;
        n.kids.forEach((k) => { k.x = cx + sgn * rect.w * 0.43; k.y = rect.y + rect.h * ((a2 + 0.5) / total); k.side = sgn; a2 += 1; });
        acc += lc;
      });
    };
    placeSide(right, 1); placeSide(left, -1);
    R.x = cx; R.y = cy;
    all.forEach((n) => { n.L = lay(c, n.label, n.d === 0 ? 'heading' : 'text', n.d === 0 ? env.sizes.lead : fs * (n.d === 1 ? 1.05 : 0.9), rect.w * 0.17, { align: 'center', balance: true, role: { weight: n.d === 1 ? 650 : undefined } }); n.w = n.L.width + fs * 1.4; n.h = n.L.height + fs * 0.9; });
    return {
      duration: per * depth + 0.8, hold: 2 + all.length * 0.2,
      draw(ctx, t) {
        for (const n of all) if (n.parent) {
          const pr = EASE.inOutCubic(clamp01((t - per * n.d + per * 0.4) / (per * 0.9)));
          if (pr <= 0) continue;
          const P = n.parent;
          const x0 = P.x + (P === R ? 0 : n.side * P.w / 2), y0 = P.y, x1 = n.x - n.side * n.w / 2, y1 = n.y;
          ctx.save(); ctx.strokeStyle = n.d === 1 ? p.data[all.indexOf(n) % p.data.length] : toCss(p.ink, 0.3); ctx.lineWidth = Math.max(1.5, env.unit * (n.d === 1 ? 3 : 2)); ctx.lineCap = 'round';
          ctx.beginPath();
          for (let k = 0; k <= 30 * pr; k++) { const u = k / 30; const x = x0 + (x1 - x0) * u; const y = y0 + (y1 - y0) * EASE.inOutSine(u); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke(); ctx.restore();
        }
        for (const n of all) {
          const ti = t - per * n.d;
          if (ti <= 0) continue;
          const k = popE(env, ti, 0.5);
          ctx.save(); ctx.translate(n.x, n.y); ctx.scale(k, k);
          const box = { x: -n.w / 2, y: -n.h / 2, w: n.w, h: n.h };
          if (n.d === 0) { roundRect(ctx, box.x, box.y, box.w, box.h, n.h / 2); ctx.fillStyle = p.accent; ctx.fill(); }
          else if (n.d === 1) drawCard(ctx, c, box, { radius: n.h / 2 });
          drawText(ctx, n.L, -n.L.width / 2, -n.L.height / 2, n.L.width, paintFor(c, n.d === 0 ? p.onAccent : n.d === 1 ? p.ink : p.mutedText, { flat: true }), null, 0);
          ctx.restore();
        }
      },
    };
  },
};

// ───────────────────────────── matrix (2×2) ─────────────────────────────
const matrix = {
  type: 'matrix',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.75), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const s = Math.min(rect.w, rect.h);
    const pad = env.sizes.body * 1.8;
    const box = { x: rect.x + (rect.w - s) / 2 + pad, y: rect.y + pad * 0.3, w: s - pad * 1.3, h: s - pad * 1.3 };
    const q = block.quadrants || [];
    const ax = block.axes || {};
    const items = block.items || [];
    const hl = block.highlight;
    const T = env.motion.tempo;
    return {
      duration: 1.2 + items.length * 0.12 + 0.6, hold: 2.5 + items.length * 0.3,
      draw(ctx, t) {
        const e = env.motion.ease(clamp01(t / (0.9 * T)));
        const mx = box.x + box.w / 2, my = box.y + box.h / 2;
        // quadrant fills
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j], k) => {
          const a = clamp01((t - 0.3 - k * 0.1) / 0.5);
          if (a <= 0) return;
          ctx.save(); ctx.globalAlpha *= a;
          ctx.fillStyle = hl === k ? toCss(p.accent, 0.16) : toCss(p.ink, (i + j) % 2 ? 0.035 : 0.06);
          const g = env.unit * 4;
          roundRect(ctx, box.x + i * box.w / 2 + g, box.y + j * box.h / 2 + g, box.w / 2 - g * 2, box.h / 2 - g * 2, env.theme.shape.radius * env.unit * 0.6); ctx.fill();
          if (q[k]) {
            const L = lay(c, q[k], 'heading', env.sizes.lead * 0.9, box.w / 2 - env.sizes.body * 2, { align: i ? 'right' : 'left' });
            drawText(ctx, L, box.x + i * box.w / 2 + env.sizes.body, box.y + j * box.h / 2 + env.sizes.body * 0.8, box.w / 2 - env.sizes.body * 2, paintFor(c, hl === k ? p.accentText : p.mutedText, { flat: true }), null, 0);
          }
          ctx.restore();
        });
        // axes
        ctx.save(); ctx.strokeStyle = p.ink; ctx.lineWidth = Math.max(2, env.unit * 2.5); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(box.x, my); ctx.lineTo(box.x + box.w * e, my); ctx.moveTo(mx, box.y + box.h); ctx.lineTo(mx, box.y + box.h - box.h * e); ctx.stroke();
        if (e > 0.95) { arrowHead(ctx, box.x + box.w, my, 0, env.sizes.body * 0.5); arrowHead(ctx, mx, box.y, -Math.PI / 2, env.sizes.body * 0.5); }
        ctx.restore();
        const lf = fontString(role(env, 'label'), env.sizes.label * 1.25);
        ctx.save(); ctx.globalAlpha *= clamp01((t - 0.6) / 0.4); ctx.font = lf; ctx.fillStyle = p.mutedText; ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${env.sizes.label * 0.08}px`;
        if (ax.xLabel) { ctx.textAlign = 'right'; drawInline(ctx, ax.xLabel + ' →', box.x + box.w, my + env.sizes.label * 2); }
        if (ax.yLabel) { ctx.textAlign = 'left'; drawInline(ctx, '↑ ' + ax.yLabel, mx + env.sizes.label * 0.8, box.y - env.sizes.label * 0.2 + env.sizes.label * 0.6); }
        if (ax.x?.length === 2) { ctx.textAlign = 'left'; drawInline(ctx, ax.x[0], box.x, my + env.sizes.label * 1.6); }
        ctx.restore();
        items.forEach((it, k) => {
          const ti = t - 0.9 - k * 0.12;
          if (ti <= 0) return;
          const x = box.x + (it.x ?? 0.5) * box.w, y = box.y + (1 - (it.y ?? 0.5)) * box.h;
          const kk = popE(env, ti);
          ctx.save(); ctx.translate(x, y); ctx.scale(kk, kk);
          ctx.beginPath(); ctx.arc(0, 0, env.sizes.body * 0.32, 0, TAU); ctx.fillStyle = p.data[k % p.data.length]; ctx.fill();
          ctx.restore();
          if (it.label) { const L = lay(c, it.label, 'text', env.sizes.body, box.w * 0.34, { role: { weight: 600 } }); ctx.save(); ctx.globalAlpha *= clamp01((ti - 0.1) / 0.3); drawText(ctx, L, x + env.sizes.body * 0.5, y - L.height / 2, box.w * 0.3, paintFor(c, p.ink, { flat: true }), null, 0); ctx.restore(); }
        });
      },
    };
  },
};

// ───────────────────────────── pyramid ─────────────────────────────
const pyramid = {
  type: 'pyramid',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.62), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const items = block.items || [];
    const n = items.length;
    const pw = Math.min(rect.w * 0.52, rect.h * 1.15);
    const gap = env.unit * 6;
    const lh = (rect.h - gap * (n - 1)) / n;
    const x0 = rect.x;
    const apex = x0 + pw / 2;
    const per = 0.3 * env.motion.tempo;
    const order = block.invert ? items.map((_, i) => i) : items.map((_, i) => i);
    return {
      duration: per * n + 0.9, hold: 2 + n * 0.5,
      draw(ctx, t) {
        order.forEach((i) => {
          const it = items[i];
          const ti = t - (n - 1 - i) * per;
          if (ti <= 0) return;
          const e = env.motion.ease(clamp01(ti / 0.7));
          const yTop = rect.y + i * (lh + gap), yBot = yTop + lh;
          const wAt = (y) => { const f = (y - rect.y) / rect.h; return pw * (block.invert ? 1 - f * 0.82 : 0.12 + f * 0.88); };
          const wt = wAt(yTop), wb = wAt(yBot);
          ctx.save(); ctx.globalAlpha *= clamp01(ti / 0.3);
          ctx.translate(0, (1 - e) * lh * 0.4);
          ctx.beginPath(); ctx.moveTo(apex - wt / 2, yTop); ctx.lineTo(apex + wt / 2, yTop); ctx.lineTo(apex + wb / 2, yBot); ctx.lineTo(apex - wb / 2, yBot); ctx.closePath();
          ctx.fillStyle = mix(p.accent, p.data[1] || p.accent, i / Math.max(1, n - 1)); ctx.fill();
          ctx.font = fontString(role(env, 'number'), lh * 0.42); ctx.fillStyle = p.onAccent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          ctx.fillText(String(i + 1).padStart(2, '0'), apex, (yTop + yBot) / 2 + lh * 0.04);
          // leader + label
          const lx = apex + Math.max(wt, wb) / 2 + env.sizes.body * 0.8;
          ctx.strokeStyle = p.softLine; ctx.lineWidth = Math.max(1, env.unit * 1.5);
          ctx.beginPath(); ctx.moveTo(apex + (wt + wb) / 4 + env.unit * 6, (yTop + yBot) / 2); ctx.lineTo(rect.x + pw + env.sizes.body * 1.2, (yTop + yBot) / 2); ctx.stroke();
          const tx = rect.x + pw + env.sizes.body * 1.6;
          const Tt = lay(c, it.title, 'heading', Math.min(env.sizes.h3, lh * 0.4), rect.w - pw - env.sizes.body * 2);
          const X = it.text ? lay(c, it.text, 'text', Math.min(env.sizes.body, lh * 0.26), rect.w - pw - env.sizes.body * 2) : null;
          const th = Tt.height + (X ? X.height + 4 : 0);
          drawText(ctx, Tt, tx, (yTop + yBot) / 2 - th / 2, rect.w, paintFor(c, p.ink, { flat: true }), null, 0);
          if (X) drawText(ctx, X, tx, (yTop + yBot) / 2 - th / 2 + Tt.height + 4, rect.w, paintFor(c, p.mutedText, { flat: true }), null, 0);
          ctx.restore();
          void lx;
        });
      },
    };
  },
};

export default [table, timeline, steps, features, compare, flow, hierarchy, matrix, pyramid];
