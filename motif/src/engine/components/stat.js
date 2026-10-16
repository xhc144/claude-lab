// Numeric storytelling components: stat, stats, pictogram.
import {
  role, paintFor, textAnimator, drawText, blockState, withState, drawCard, drawIcon,
  roundRect, toCss, EASE, clamp01, colorOf, formatNumber, decimalsOf, numberWidth, drawTabular, blockPreset, mix,
  recItem,
} from './kit.js';
import { fontString, familyList, drawInline, measureInline } from '../text/text.js';
import { parseNumberish } from '../../core/util/misc.js';

function deltaInfo(delta) {
  if (delta == null || delta === '') return null;
  const s = String(delta).trim();
  const p = parseNumberish(s.replace(/^[▲▼↑↓]/, ''));
  const neg = /^[-−▼↓]/.test(s) || (p && p.value < 0);
  const txt = typeof delta === 'number' ? (delta > 0 ? '+' : '') + delta : s.replace(/^[▲▼↑↓]\s*/, '');
  return { text: txt.replace(/^-/, '−'), neg };
}

/** Lays out one stat (number + label + delta + context) inside width w and height budget. */
function statLayout(it, c, w, maxH, o = {}) {
  const { env, te } = c;
  const numRole = role(env, 'number');
  const value = typeof it.value === 'number' ? it.value : null;
  const dec = it.decimals ?? (value != null ? decimalsOf(value) : 0);
  const finalStr = value != null ? formatNumber(value, { decimals: dec }) : String(it.value ?? '');
  const prefix = it.prefix || '', suffix = it.suffix || '';
  const sizeMax = o.maxSize || env.sizes.display * 1.35;
  const affix = 0.52;
  const label = it.label ? te.layout(it.label, role(env, 'text', { weight: Math.max(500, env.fonts.text.weight) }), o.labelSize || env.sizes.lead * 0.92, { maxWidth: w, align: o.align, balance: true }) : null;
  const ctxL = it.context ? te.layout(it.context, role(env, 'text'), env.sizes.small, { maxWidth: w, align: o.align }) : null;
  const delta = deltaInfo(it.delta);
  const deltaH = delta ? env.sizes.small * 1.9 : 0;
  const trendH = it.trend?.length > 1 ? env.sizes.body * 2.2 : 0;
  const iconH = it.icon ? env.sizes.h3 * 1.3 : 0;
  const rest = (label ? label.height + env.sizes.body * 0.45 : 0) + (ctxL ? ctxL.height + env.sizes.small * 0.5 : 0) + (delta ? deltaH + env.sizes.small * 0.7 : 0) + trendH + iconH;
  let size = Math.min(sizeMax, Math.max(env.sizes.h2, (maxH - rest) / 1.05));
  const widthAt = (sz) => {
    const font = fontString(numRole, sz);
    const afont = fontString({ ...numRole, weight: Math.max(300, numRole.weight - 150) }, sz * affix);
    return numberWidth(te, finalStr, font, numRole.tracking * sz) + (prefix ? te.width(prefix, afont) + sz * 0.06 : 0) + (suffix ? te.width(suffix, afont) + sz * 0.06 : 0);
  };
  for (let k = 0; k < 12 && widthAt(size) > w; k++) size *= 0.9;
  const numH = size * 1.02;
  return {
    value, dec, finalStr, prefix, suffix, size, numRole, affix, label, ctxL, delta, deltaH, trendH, iconH,
    numW: widthAt(size), h: iconH + numH + rest, numH,
  };
}

function drawStat(ctx, c, it, S, x, y, w, t, o = {}) {
  const { env, p, te } = c;
  const align = o.align || 'left';
  const dur = 1.5 * env.motion.tempo;
  const e = EASE.outExpo(clamp01(t / dur));
  const ax = align === 'center' ? x + w / 2 : x;
  let cy = y;
  if (S.iconH) {
    const R = S.iconH * 0.42;
    const ix = align === 'center' ? ax : x + R;
    withState(ctx, blockState(c, t, 'pop'), null, () => {
      ctx.beginPath(); ctx.arc(ix, cy + R, R, 0, Math.PI * 2);
      ctx.fillStyle = toCss(p.accent, p.dark ? 0.16 : 0.12); ctx.fill();
      drawIcon(ctx, it.icon, ix, cy + R, R * 1.05, p.accentText, { draw: clamp01(t / 0.8) });
    });
    cy += S.iconH;
  }
  // number
  const st = blockState(c, t, 'rise', { size: S.size * 0.25 });
  if (st !== false) {
    ctx.save();
    if (st.alpha != null) ctx.globalAlpha *= st.alpha;
    ctx.translate(0, st.dy || 0);
    const shown = S.value != null ? formatNumber(S.value * e, { decimals: S.dec }) : S.finalStr;
    const font = fontString(S.numRole, S.size);
    const afont = fontString({ ...S.numRole, weight: Math.max(300, S.numRole.weight - 150) }, S.size * S.affix);
    const base = cy + S.size * 0.86;
    let nx = align === 'center' ? ax - S.numW / 2 : x;
    const color = colorOf(p, o.color || it.color, p.ink);
    ctx.textBaseline = 'alphabetic';
    if ('fontStretch' in ctx) ctx.fontStretch = S.numRole.stretch || 'normal';
    const grad = env.theme.decor?.glow && p.tone === 'base' && o.highlight !== false;
    if (grad) {
      const g = ctx.createLinearGradient(nx, cy, nx + S.numW, cy + S.size);
      p.gradient.forEach((col, i) => g.addColorStop(i / (p.gradient.length - 1), col));
      ctx.fillStyle = g;
      ctx.shadowColor = toCss(p.accent, 0.35); ctx.shadowBlur = S.size * 0.3;
    } else ctx.fillStyle = color;
    if (S.prefix) {
      ctx.font = afont;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      drawInline(ctx, S.prefix, nx, base - S.size * 0.36);
      nx += measureInline(ctx, S.prefix) + S.size * 0.06;
    }
    nx += drawTabular(ctx, te, shown, nx, base, font, S.numRole.tracking * S.size);
    if (S.suffix) {
      ctx.font = afont;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      drawInline(ctx, S.suffix, nx + S.size * 0.06, base);
    }
    ctx.restore();
  }
  cy += S.numH;
  if (S.label) {
    cy += env.sizes.body * 0.3;
    const a = textAnimator(env, S.label, 'rise', { maxSpread: 0.4, unit: 'line' });
    drawText(ctx, S.label, x, cy, w, paintFor(c, p.mutedText, { flat: true }), a, t - 0.25);
    cy += S.label.height + env.sizes.body * 0.15;
  }
  if (S.delta) {
    cy += env.sizes.small * 0.55;
    const tone = S.delta.neg ? p.negative : p.positive;
    const fs = env.sizes.small;
    const font = fontString(role(env, 'text', { weight: 650 }), fs);
    const tw = te.width(S.delta.text, font);
    const extra = it.deltaLabel ? te.width(' ' + it.deltaLabel, fontString(role(env, 'text'), fs)) : 0;
    const pw = tw + fs * 2.4;
    const bx = align === 'center' ? ax - (pw + extra) / 2 : x;
    withState(ctx, blockState(c, t - 0.55, 'pop'), { x: bx, y: cy, w: pw, h: S.deltaH }, () => {
      roundRect(ctx, bx, cy, pw, S.deltaH, S.deltaH / 2);
      ctx.fillStyle = toCss(tone, p.dark ? 0.2 : 0.14); ctx.fill();
      drawIcon(ctx, S.delta.neg ? 'arrow-down-right' : 'arrow-up-right', bx + fs * 0.95, cy + S.deltaH / 2, fs * 0.95, tone, { stroke: 2.6 });
      ctx.font = font; ctx.fillStyle = tone; ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.fillText(S.delta.text, bx + fs * 1.7, cy + S.deltaH / 2 + fs * 0.04);
      if (it.deltaLabel) { ctx.font = fontString(role(env, 'text'), fs); ctx.fillStyle = p.mutedText; drawInline(ctx, ' ' + it.deltaLabel, bx + pw + fs * 0.1, cy + S.deltaH / 2 + fs * 0.04); }
    });
    cy += S.deltaH;
  }
  if (S.ctxL) {
    cy += env.sizes.small * 0.5;
    withState(ctx, blockState(c, t - 0.7, 'fade'), null, () => drawText(ctx, S.ctxL, x, cy, w, paintFor(c, p.mutedText, { flat: true }), null, 0));
    cy += S.ctxL.height;
  }
  if (S.trendH) {
    const tr = it.trend.map(Number).filter(Number.isFinite);
    const min = Math.min(...tr), max = Math.max(...tr);
    const tw = Math.min(w, env.sizes.body * 9), th = S.trendH * 0.7;
    const tx = align === 'center' ? ax - tw / 2 : x;
    const ty = cy + S.trendH * 0.2;
    const dp = clamp01((t - 0.4) / (1.2 * env.motion.tempo));
    if (dp > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(tx - 4, ty - 8, tw * EASE.inOutCubic(dp) + 8, th + 16); ctx.clip();
      ctx.strokeStyle = p.accent; ctx.lineWidth = Math.max(2, env.unit * 3); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      tr.forEach((v, i) => { const px = tx + (i / (tr.length - 1)) * tw; const py = ty + th - ((v - min) / (max - min || 1)) * th; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
      ctx.restore();
      const lx = tx + tw * EASE.inOutCubic(dp);
      const i = Math.min(tr.length - 1, Math.floor(EASE.inOutCubic(dp) * (tr.length - 1)));
      const fr = EASE.inOutCubic(dp) * (tr.length - 1) - i;
      const v = tr[i] + ((tr[Math.min(i + 1, tr.length - 1)] - tr[i]) * fr);
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.arc(lx, ty + th - ((v - min) / (max - min || 1)) * th, Math.max(3, env.unit * 5), 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawRing(ctx, c, it, cx, cy, R, t) {
  const { env, p } = c;
  // ring: fraction (0.62), percentage (62) or true (use the value itself as a percentage)
  const raw = it.ring === true ? Number(it.value) : Number(it.ring);
  const pct = Math.max(0, Math.min(1, it.ring !== true && raw > 0 && raw <= 1 ? raw : raw / 100)) || 0;
  const e = env.motion.ease(clamp01((t - 0.1) / (1.6 * env.motion.tempo)));
  const lw = R * 0.09;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = toCss(p.ink, 0.1);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  if (e > 0) {
    ctx.strokeStyle = p.accent;
    if (env.theme.chart.glow) { ctx.shadowColor = p.accent; ctx.shadowBlur = lw * 1.5; }
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * e); ctx.stroke();
  }
  ctx.restore();
}

const stat = {
  type: 'stat',
  measure(block, c, w, maxH) {
    if (block.ring != null && block.ring !== false) return { h: Math.min(w, maxH), fill: true };
    const hero = c.hint?.hero;
    return { h: statLayout(block, c, w, Math.min(maxH, c.env.sizes.display * (hero ? 3.6 : 2.6)), hero ? { maxSize: c.env.sizes.display * 1.9, labelSize: c.env.sizes.lead * 1.1, align: 'center' } : {}).h, fill: false };
  },
  build(block, c, rect) {
    const { env } = c;
    const align = block.style?.align && block.style.align !== 'auto' ? block.style.align : c.hint?.align || (rect.w < env.W * 0.45 ? 'center' : 'left');
    if (block.ring != null && block.ring !== false) {
      const R = Math.min(rect.w, rect.h) * 0.42;
      const S = statLayout({ ...block, label: null, delta: null, trend: null, icon: null, context: null }, c, R * 1.35, R * 0.8, { align: 'center', maxSize: R * 0.6 });
      const L = block.label ? c.te.layout(block.label, role(env, 'text'), env.sizes.body, { maxWidth: R * 1.4, align: 'center', balance: true }) : null;
      return {
        duration: 1.8 * env.motion.tempo, hold: 1.5,
        draw(ctx, t) {
          const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
          drawRing(ctx, c, block, cx, cy, R, t);
          drawStat(ctx, c, block, S, cx - R * 0.675, cy - S.numH / 2 - (L ? L.height * 0.45 : 0), R * 1.35, t, { align: 'center' });
          if (L) drawText(ctx, L, cx - R * 0.7, cy + S.numH * 0.5, R * 1.4, paintFor(c, c.p.mutedText, { flat: true }), textAnimator(env, L, 'fade', { unit: 'line' }), t - 0.4);
        },
      };
    }
    const S = statLayout(block, c, rect.w, rect.h, { align, maxSize: c.hint?.statSize || (c.hint?.hero ? env.sizes.display * 1.9 : undefined), ...(c.hint?.hero ? { labelSize: env.sizes.lead * 1.1 } : {}) });
    const yOff = c.hint?.valign === 'top' ? 0 : Math.max(0, (rect.h - S.h) / 2);
    return {
      duration: 1.6 * env.motion.tempo + (S.delta ? 0.3 : 0), hold: 1.2 + (S.label?.unitCount || 0) * 0.05,
      draw(ctx, t) { drawStat(ctx, c, block, S, rect.x, rect.y + yOff, rect.w, t, { align }); },
    };
  },
};

function statsGrid(block, c, w) {
  const { env } = c;
  const n = block.items?.length || 0;
  const cols = env.portrait ? (n <= 2 ? n : 2) : n <= 4 ? n : Math.ceil(n / 2);
  return { cols, rows: Math.ceil(n / cols), gap: env.grid.gutter * (n > 3 ? 1.2 : 2) };
}

function statsStyle(block, env) {
  if (block.style && block.style !== 'auto') return block.style;
  return { glass: 'cards', elevated: 'cards', brutal: 'cards', outline: 'cards' }[env.theme.shape.card] || 'divided';
}

const stats = {
  type: 'stats',
  measure(block, c, w, maxH) {
    const { cols, rows, gap } = statsGrid(block, c, w);
    const cw = (w - gap * (cols - 1)) / cols;
    const style = statsStyle(block, c.env);
    const pad = style === 'cards' ? c.env.sizes.body * 1.1 : 0;
    const hs = (block.items || []).map((it) => statLayout(it, c, cw - pad * 2, Math.min(maxH / rows, c.env.sizes.display * 2.4), { maxSize: c.env.sizes.display }).h + pad * 2);
    const h = Math.max(...hs, 0) * rows + gap * (rows - 1);
    return { h, fill: true, max: h * 1.45 };
  },
  build(block, c, rect) {
    const { env, p } = c;
    const items = block.items || [];
    const { cols, rows, gap } = statsGrid(block, c, rect.w);
    const style = statsStyle(block, env);
    const cw = (rect.w - gap * (cols - 1)) / cols;
    const pad = style === 'cards' ? env.sizes.body * 1.1 : style === 'divided' ? env.sizes.body * 0.2 : 0;
    const align = c.hint?.align === 'center' || cols >= 3 && style !== 'divided' ? 'left' : 'left';
    const rowH = Math.min(rect.h / rows - gap * (rows - 1) / rows, env.sizes.display * 3.2);
    // Use a common number size so the row reads as a set.
    const Ss0 = items.map((it) => statLayout(it, c, cw - pad * 2, rowH - pad * 2, { align, maxSize: env.sizes.display * (cols >= 4 ? 0.95 : 1.15) }));
    const common = Math.min(...Ss0.map((s) => s.size));
    const Ss = items.map((it) => statLayout(it, c, cw - pad * 2, rowH - pad * 2, { align, maxSize: common }));
    const cellH = Math.max(...Ss.map((s) => s.h)) + pad * 2;
    const totalH = cellH * rows + gap * (rows - 1);
    const y0 = rect.y + Math.max(0, (rect.h - totalH) / 2);
    const stagger = Math.min(0.22, 1.2 / Math.max(1, items.length)) * env.motion.tempo;
    const preset = blockPreset(env);
    return {
      duration: stagger * (items.length - 1) + 1.7 * env.motion.tempo, hold: 1.5 + items.length * 0.4,
      draw(ctx, t) {
        items.forEach((it, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const box = { x: rect.x + col * (cw + gap), y: y0 + row * (cellH + gap), w: cw, h: cellH };
          const ti = t - i * stagger;
          if (ti <= 0) return;
          recItem(i, box, ctx);
          if (style === 'cards') withState(ctx, blockState(c, ti, preset, { size: env.sizes.h2 }), box, () => drawCard(ctx, c, box));
          if (style === 'divided' && col > 0) {
            const e = env.motion.ease(clamp01(ti / env.motion.duration));
            ctx.fillStyle = p.softLine;
            ctx.fillRect(box.x - gap / 2, box.y, Math.max(1, env.unit * 1.2), box.h * e);
          }
          drawStat(ctx, c, it, Ss[i], box.x + pad + (style === 'divided' && col > 0 ? gap * 0.05 : 0), box.y + pad + (cellH - pad * 2 - Ss[i].h) / 2, cw - pad * 2, ti, { align });
        });
      },
    };
  },
};

// ───────────────────────────── pictogram ─────────────────────────────
const pictogram = {
  type: 'pictogram',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.62), fill: true }; },
  build(block, c, rect) {
    const { env, p, te } = c;
    const total = Math.max(1, Math.min(100, Math.round(block.total ?? 10)));
    const value = Math.max(0, Math.min(total, Number(block.value) || 0));
    const L = block.label ? te.layout(block.label, role(env, 'text', { weight: 500 }), env.sizes.lead * (env.portrait ? 1.15 : 1), { maxWidth: rect.w, balance: true, align: env.portrait ? 'center' : 'left' }) : null;
    const labelH = L ? L.height + env.sizes.body : 0;
    const area = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - labelH };
    let cols = block.columns || (env.portrait && total <= 10 ? Math.ceil(total / 2) : total <= 10 ? total : total <= 20 ? 10 : Math.ceil(Math.sqrt(total * (area.w / area.h))));
    cols = Math.min(cols, total);
    const rowsN = Math.ceil(total / cols);
    const cell = Math.min(area.w / cols, area.h / rowsN, env.sizes.display * 1.5);
    const gw = cell * cols, gh = cell * rowsN;
    const centered = env.portrait || block.style?.align === 'center' || c.hint?.align === 'center';
    const gx = area.x + (centered ? (area.w - gw) / 2 : 0);
    // icons and label read as one group, centred in the box
    const gy = rect.y + Math.max(0, (rect.h - gh - labelH) / 2);
    const ly = gy + gh + env.sizes.body;
    const lx = centered && L ? rect.x + (rect.w - L.width) / 2 : rect.x;
    const icon = block.icon || 'user';
    const per = Math.min(0.08, 1.6 / total) * env.motion.tempo;
    const on = colorOf(p, block.style?.color, p.accent);
    const off = toCss(p.ink, p.dark ? 0.18 : 0.16);
    return {
      duration: per * total + 0.8, hold: 1.5,
      draw(ctx, t) {
        for (let i = 0; i < total; i++) {
          const ti = t - i * per;
          if (ti <= 0) continue;
          const col = i % cols, row = Math.floor(i / cols);
          const cx = gx + (col + 0.5) * cell, cy = gy + (row + 0.5) * cell;
          const k = env.motion.spring ? env.motion.spring(clamp01(ti / 0.6)) : EASE.outBack(clamp01(ti / 0.4));
          const lit = i < value;
          const fill = lit ? on : off;
          ctx.save();
          ctx.translate(cx, cy); ctx.scale(k, k);
          drawIcon(ctx, icon, 0, 0, cell * 0.72, fill, { stroke: lit ? 2.4 : 1.8 });
          ctx.restore();
        }
        if (L) drawText(ctx, L, lx, ly, L.width, paintFor(c, p.ink, { flat: true }), textAnimator(env, L, 'rise', { unit: 'line' }), t - per * total * 0.6);
      },
    };
  },
};

export default [stat, stats, pictogram];
export { statLayout, drawStat };
