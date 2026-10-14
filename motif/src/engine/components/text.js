// Text-family components: title, text, bullets, quote, callout.
import {
  role, paintFor, textAnimator, drawText, blockState, withState, drawCard, drawIcon, pickIcon,
  roundRect, toCss, EASE, clamp01, colorOf, blockPreset,
} from './kit.js';

const alignOf = (block, c, fallback = 'left') => (block.style?.align && block.style.align !== 'auto' ? block.style.align : c.hint?.align || fallback);
const enterOf = (block, c, fallback) => (block.motion?.enter && block.motion.enter !== 'auto' ? block.motion.enter : fallback);

// ───────────────────────────── kicker (eyebrow) ─────────────────────────────
function kickerMetrics(c, text, w) {
  const { env, te } = c;
  const style = env.theme.decor?.kicker || 'plain';
  const r = role(env, 'label');
  const size = env.sizes.label * (c.hint?.kickerScale || 1);
  const L = te.layout(text, r, size, { maxWidth: w * 0.9 });
  const padX = ['pill', 'sticker', 'seal'].includes(style) ? size * 0.9 : 0;
  const padY = ['pill', 'sticker', 'seal'].includes(style) ? size * 0.42 : 0;
  const lead = { rule: size * 2.6, square: size * 1.25, bar: size * 0.9, bracket: size * 0.9 }[style] || 0;
  const tail = style === 'bracket' ? size * 0.9 : 0;
  return { L, style, size, padX, padY, lead, tail, w: L.width + padX * 2 + lead + tail, h: L.height + padY * 2 };
}

function drawKicker(ctx, c, k, x, y, align, t, color) {
  const { env, p } = c;
  const st = blockState(c, t, 'fade', { duration: env.motion.duration * 0.8 });
  if (st === false) return;
  const ease = clamp01(t / (env.motion.duration * 0.9));
  const e = env.motion.ease(ease);
  let bx = align === 'center' ? x - k.w / 2 : align === 'right' ? x - k.w : x;
  ctx.save();
  ctx.globalAlpha *= st.alpha ?? 1;
  const ink = color || colorOf(p, env.fonts.label.color, p.mutedText);
  const accent = p.accentText;
  switch (k.style) {
    case 'pill': {
      roundRect(ctx, bx, y, k.w, k.h, k.h / 2);
      ctx.fillStyle = toCss(p.ink, p.dark ? 0.06 : 0.05);
      ctx.fill();
      ctx.lineWidth = Math.max(1, env.unit * 1.2);
      ctx.strokeStyle = toCss(p.ink, 0.18);
      ctx.stroke();
      break;
    }
    case 'sticker': {
      ctx.translate(bx + k.w / 2, y + k.h / 2);
      ctx.rotate((-3 * Math.PI) / 180 * e);
      ctx.translate(-(bx + k.w / 2), -(y + k.h / 2));
      roundRect(ctx, bx, y, k.w, k.h, k.h / 2);
      ctx.fillStyle = p.ink;
      ctx.fill();
      break;
    }
    case 'seal': {
      roundRect(ctx, bx, y, k.w, k.h, k.size * 0.2);
      ctx.fillStyle = p.accent;
      ctx.fill();
      break;
    }
    case 'rule': {
      ctx.fillStyle = accent;
      ctx.fillRect(bx, y + k.h / 2 - Math.max(1, env.unit * 1.2), k.size * 1.9 * e, Math.max(2, env.unit * 2.4));
      break;
    }
    case 'square': {
      ctx.fillStyle = p.accent;
      const s = k.size * 0.62;
      ctx.fillRect(bx, y + k.h / 2 - s / 2, s * e, s);
      break;
    }
    case 'bar': {
      ctx.fillStyle = p.accent;
      roundRect(ctx, bx, y + k.h * 0.08, k.size * 0.28, k.h * 0.84 * e, k.size * 0.14);
      ctx.fill();
      break;
    }
    case 'bracket': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, env.unit * 2);
      const bh = k.h * 1.1, by = y - k.h * 0.05, bw = k.size * 0.35;
      ctx.beginPath();
      ctx.moveTo(bx + bw, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh);
      const rx = bx + k.w;
      ctx.moveTo(rx - bw, by); ctx.lineTo(rx, by); ctx.lineTo(rx, by + bh); ctx.lineTo(rx - bw, by + bh);
      ctx.stroke();
      break;
    }
    case 'rule-center': {
      ctx.fillStyle = toCss(accent, 0.8);
      const len = k.size * 3 * e;
      ctx.fillRect(bx - k.size * 0.9 - len, y + k.h / 2, len, Math.max(1, env.unit));
      ctx.fillRect(bx + k.w + k.size * 0.9, y + k.h / 2, len, Math.max(1, env.unit));
      break;
    }
    default:
  }
  let textColor = ink;
  if (k.style === 'sticker') textColor = p.bg;
  else if (k.style === 'seal') textColor = p.onAccent;
  else if (k.style === 'pill') textColor = p.ink;
  if (k.style === 'pill') {
    // small glowing dot before the label
    ctx.fillStyle = p.accent;
    ctx.shadowColor = p.accent; ctx.shadowBlur = k.size;
    ctx.beginPath(); ctx.arc(bx + k.padX * 0.62, y + k.h / 2, k.size * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  const tx = bx + k.padX + k.lead + (k.style === 'pill' ? k.size * 0.4 : 0);
  ctx.translate((1 - e) * -k.size * 0.6, 0);
  drawText(ctx, k.L, tx, y + k.padY, k.L.width, { color: textColor, accent: textColor, mark: p.highlight }, null, t);
  ctx.restore();
}

// ───────────────────────────── title ─────────────────────────────
function titleLayout(block, c, w, maxH = Infinity) {
  const { env, te } = c;
  const hint = c.hint || {};
  const align = alignOf(block, c, env.theme.layout?.titleAlign || 'left');
  const sizeKey = block.size && block.size !== 'auto' ? { s: 'h2', m: 'h1', l: 'display', xl: 'display' }[block.size] : hint.titleRole || 'h1';
  const target = env.sizes[sizeKey] * (block.size === 'xl' ? 1.18 : 1) * (block.style?.scale || 1) * (hint.titleScale || 1);
  const titleRole = role(env, sizeKey === 'display' || sizeKey === 'h1' ? 'display' : 'heading');
  const kicker = block.kicker ? kickerMetrics(c, block.kicker, w) : null;
  const subSize = sizeKey === 'display' ? env.sizes.lead : env.sizes.lead * 0.88;
  const sub = block.subtitle ? te.layout(block.subtitle, role(env, 'text'), subSize, { maxWidth: Math.min(w, Math.max(w * 0.82, subSize * 22)), balance: true, align }) : null;
  const kGap = kicker ? Math.max(env.sizes.label * 1.1, target * 0.3) : 0;
  const sGap = sub ? Math.max(env.sizes.body * 0.8, target * 0.36) : 0;
  const avail = maxH - (kicker ? kicker.h + kGap : 0) - (sub ? sub.height + sGap : 0);
  const L = te.fit(block.text ?? '', titleRole, {
    maxWidth: w, maxHeight: Math.max(avail, env.sizes.h3 * 1.2), maxLines: hint.maxLines || (sizeKey === 'display' ? 3 : 3),
    min: Math.min(target, env.sizes.h3), max: target, balance: true, align,
  });
  const ruleH = hint.rule && env.theme.decor?.rule ? env.sizes.body * 0.9 : 0;
  const h = (kicker ? kicker.h + kGap : 0) + L.height + (sub ? sGap + sub.height : 0) + ruleH;
  return { L, kicker, sub, kGap, sGap, align, h, ruleH, overflow: L.overflow };
}

const title = {
  type: 'title',
  measure(block, c, w, maxH) {
    const T = titleLayout(block, c, w, maxH);
    return { h: T.h };
  },
  build(block, c, rect) {
    const { env, p } = c;
    const T = titleLayout(block, c, rect.w, rect.h);
    const preset = enterOf(block, c, env.motion.titleEnter);
    const anim = textAnimator(env, T.L, preset, { speed: block.motion?.speed, maxSpread: 1.0 });
    const subAnim = T.sub ? textAnimator(env, T.sub, env.motion.enter === 'type' ? 'wipe' : env.motion.enter, { maxSpread: 0.9, unit: 'line' }) : null;
    const t0 = T.kicker ? 0.18 : 0;
    const subStart = t0 + Math.min(anim.duration * 0.6, 0.75 * env.motion.tempo);
    const duration = Math.max(t0 + anim.duration, subAnim ? subStart + subAnim.duration : 0);
    const paint = paintFor(c, colorOf(p, block.style?.color, p.ink));
    const subPaint = paintFor(c, p.mutedText, { flat: true });
    const issues = T.overflow ? [{ level: 'warning', message: '标题过长，已缩到最小字号仍放不下', hint: '缩短标题或使用 subtitle 承载补充信息' }] : [];
    return {
      duration, issues,
      hold: (T.L.unitCount + (T.sub?.unitCount || 0)) * 0.06,
      textBox: { x: rect.x, y: rect.y, w: rect.w, h: T.h },
      draw(ctx, t) {
        let y = rect.y + (c.hint?.valign === 'center' ? Math.max(0, (rect.h - T.h) / 2) : c.hint?.valign === 'bottom' ? Math.max(0, rect.h - T.h) : 0);
        const ax = T.align === 'center' ? rect.x + rect.w / 2 : T.align === 'right' ? rect.x + rect.w : rect.x;
        if (T.kicker) {
          drawKicker(ctx, c, T.kicker, ax, y, T.align, t);
          y += T.kicker.h + T.kGap;
        }
        drawText(ctx, T.L, rect.x, y, rect.w, paint, anim, t - t0);
        y += T.L.height;
        if (T.ruleH) {
          const e = env.motion.ease(clamp01((t - subStart + 0.2) / env.motion.duration));
          if (e > 0) {
            ctx.fillStyle = p.accent;
            const rw = env.sizes.body * 2.2 * e;
            const rx = T.align === 'center' ? ax - rw / 2 : ax;
            ctx.fillRect(rx, y + T.ruleH * 0.35, rw, Math.max(2, env.unit * 3));
          }
          y += T.ruleH;
        }
        if (T.sub) drawText(ctx, T.sub, rect.x, y + T.sGap, rect.w, subPaint, subAnim, t - subStart);
      },
    };
  },
};

// ───────────────────────────── text ─────────────────────────────
function textLayout(block, c, w, maxH = Infinity) {
  const { env, te } = c;
  const align = alignOf(block, c, 'left');
  const sizes = block.size === 'l' ? ['lead', 'body', 'small'] : block.size === 's' ? ['small', 'caption'] : block.size === 'm' ? ['body', 'small'] : c.hint?.textSize ? [c.hint.textSize, 'body', 'small'] : ['body', 'small', 'caption'];
  const r = role(env, 'text');
  const cols = block.columns === 2 && w > env.sizes.body * 24 ? 2 : 1;
  const gap = env.grid.gutter * 1.5;
  const colW = cols === 2 ? (w - gap) / 2 : w;
  const paras = String(block.text ?? '').split(/\n\s*\n/);
  let best = null;
  for (const key of sizes) {
    const size = env.sizes[key] * (block.style?.scale || 1);
    const Ls = paras.map((pa) => te.layout(pa, r, size, { maxWidth: Math.min(colW, size * 34), align: align === 'center' ? 'center' : align }));
    const pgap = size * 0.7;
    const total = Ls.reduce((s, L) => s + L.height, 0) + pgap * (Ls.length - 1);
    const h = cols === 2 ? total / 2 + size * 1.5 : total;
    best = { Ls, size, pgap, h, align, cols, colW, gap };
    if (h <= maxH) return best;
  }
  best.overflow = true;
  return best;
}

const text = {
  type: 'text',
  measure(block, c, w, maxH) { return { h: textLayout(block, c, w, maxH).h }; },
  build(block, c, rect) {
    const { env, p } = c;
    const T = textLayout(block, c, rect.w, rect.h);
    const preset = enterOf(block, c, env.motion.enter);
    const anims = T.Ls.map((L) => textAnimator(env, L, preset, { maxSpread: 1.1, unit: L.lines.length > 2 && env.motion.unit !== 'char' ? 'line' : undefined }));
    const starts = [];
    let acc = 0;
    anims.forEach((a) => { starts.push(acc); acc += Math.min(a.duration * 0.5, 0.5); });
    const duration = Math.max(...anims.map((a, i) => starts[i] + a.duration));
    const paint = paintFor(c, colorOf(p, block.style?.color, c.hint?.textColor || p.ink), { flat: true });
    const chars = T.Ls.reduce((s, L) => s + L.unitCount, 0);
    return {
      duration, hold: chars * 0.055,
      issues: T.overflow ? [{ level: 'warning', message: `正文过长（${chars} 字/词），已缩到最小字号仍放不下`, hint: '拆成要点或分成两个场景' }] : [],
      draw(ctx, t) {
        let y = rect.y + (c.hint?.valign === 'center' ? Math.max(0, (rect.h - T.h) / 2) : 0);
        if (T.cols === 2) {
          // flow paragraphs into two columns by line count
          const allLines = [];
          T.Ls.forEach((L, i) => { L.lines.forEach((ln) => allLines.push({ L, ln, i })); });
          const half = Math.ceil(allLines.length / 2);
          let ys = [y, y];
          allLines.forEach((entry, k) => {
            const col = k < half ? 0 : 1;
            const x = rect.x + col * (T.colW + T.gap);
            const sub = { ...entry.L, lines: [{ ...entry.ln, y: 0 }], height: entry.L.lineHeight };
            const st = anims[entry.i];
            drawText(ctx, sub, x, ys[col], T.colW, paint, { ...st, state: (u, l, tt) => st.state(u, entry.ln, tt) }, t - starts[entry.i]);
            ys[col] += entry.L.lineHeight;
          });
          return;
        }
        T.Ls.forEach((L, i) => {
          drawText(ctx, L, rect.x, y, rect.w, paint, anims[i], t - starts[i]);
          y += L.height + T.pgap;
        });
      },
    };
  },
};

// ───────────────────────────── bullets ─────────────────────────────
function bulletStyle(block) {
  if (block.style && block.style !== 'auto') return block.style;
  const items = block.items || [];
  if (items.some((i) => i.icon)) return 'icons';
  if (items.length >= 3 && items.every((i) => String(i.text || '').length <= 12) && items.length <= 4 && items.some((i) => i.detail)) return 'cards';
  return 'dots';
}

function bulletsLayout(block, c, w, maxH = Infinity) {
  const { env, te } = c;
  const style = bulletStyle(block);
  const items = block.items || [];
  const n = items.length;
  if (style === 'cards') return cardsLayout(block, c, w, maxH);
  const cols = block.columns && block.columns !== 'auto' ? Number(block.columns) : n >= 7 && w > env.sizes.body * 30 ? 2 : 1;
  const gap = env.grid.gutter * 2;
  const colW = (w - gap * (cols - 1)) / cols;
  const short = items.every((it) => String(it.text || '').length <= 16 && !it.detail);
  const keys = c.hint?.roomy && n <= 5 && short ? ['h3', 'lead', 'body', 'small'] : n <= 4 && !c.hint?.compact ? ['lead', 'body', 'small', 'caption'] : ['body', 'small', 'caption'];
  let res;
  for (const key of keys) {
    const size = env.sizes[key] * (block.style?.scale || 1);
    const markerW = { dots: 1.15, dashes: 1.4, numbers: 1.8, icons: 2.1, checks: 1.9 }[style] * size;
    const rows = items.map((it) => {
      const L = te.layout(it.text ?? '', role(env, 'text', { weight: Math.max(env.fonts.text.weight, it.detail ? 560 : env.fonts.text.weight) }), size, { maxWidth: colW - markerW });
      const D = it.detail ? te.layout(it.detail, role(env, 'text'), size * 0.78, { maxWidth: colW - markerW }) : null;
      return { it, L, D, h: L.height + (D ? D.height + size * 0.2 : 0) };
    });
    const itemGap = size * (rows.some((r) => r.D) ? 0.95 : 0.7);
    const perCol = Math.ceil(n / cols);
    let h = 0;
    for (let col = 0; col < cols; col++) {
      const slice = rows.slice(col * perCol, (col + 1) * perCol);
      h = Math.max(h, slice.reduce((s, r) => s + r.h, 0) + itemGap * Math.max(0, slice.length - 1));
    }
    res = { style, rows, size, markerW, itemGap, cols, colW, gap, perCol, h };
    if (h <= maxH) return res;
  }
  res.overflow = true;
  return res;
}

function cardsLayout(block, c, w, maxH) {
  const { env, te } = c;
  const items = block.items || [];
  const n = items.length;
  const cols = block.columns && block.columns !== 'auto' ? Number(block.columns) : env.portrait ? (n <= 2 ? 1 : 2) : n <= 3 ? n : n === 4 ? (w > env.W * 0.7 ? 4 : 2) : 3;
  const gap = env.grid.gutter * 1.2;
  const cw = (w - gap * (cols - 1)) / cols;
  const pad = env.sizes.body * 0.95;
  let res;
  for (const key of ['lead', 'body', 'small']) {
    const size = env.sizes[key];
    const rows = items.map((it) => {
      const L = te.layout(it.text ?? it.title ?? '', role(env, 'heading'), size * 1.02, { maxWidth: cw - pad * 2 });
      const D = it.detail ? te.layout(it.detail, role(env, 'text'), size * 0.74, { maxWidth: cw - pad * 2 }) : null;
      return { it, L, D, h: pad * 2 + size * 1.9 + L.height + (D ? D.height + size * 0.35 : 0) };
    });
    const nrows = Math.ceil(n / cols);
    const rowH = [];
    for (let r = 0; r < nrows; r++) rowH.push(Math.max(...rows.slice(r * cols, (r + 1) * cols).map((x) => x.h)));
    const h = rowH.reduce((a, b) => a + b, 0) + gap * (nrows - 1);
    res = { style: 'cards', rows, size, cols, cw, gap, pad, rowH, h };
    if (h <= maxH) return res;
  }
  res.overflow = true;
  return res;
}

const bullets = {
  type: 'bullets',
  measure(block, c, w, maxH) { return { h: bulletsLayout(block, c, w, maxH).h }; },
  build(block, c, rect) {
    const { env, p } = c;
    const B = bulletsLayout(block, c, rect.w, rect.h);
    const preset = enterOf(block, c, env.motion.enter);
    const itemStagger = Math.min(env.motion.stagger * 2.6, 2.4 / Math.max(1, B.rows.length));
    const anims = B.rows.map((r) => textAnimator(env, r.L, B.style === 'cards' ? 'none' : preset, { maxSpread: 0.6 }));
    const duration = (B.rows.length - 1) * itemStagger + Math.max(...anims.map((a) => a.duration), env.motion.duration);
    const paint = paintFor(c, colorOf(p, block.style?.color, p.ink), { flat: true });
    const dPaint = paintFor(c, p.mutedText, { flat: true });
    const chars = B.rows.reduce((s, r) => s + r.L.unitCount + (r.D?.unitCount || 0), 0);
    const yOff = c.hint?.valign === 'center' ? Math.max(0, (rect.h - B.h) / 2) : 0;
    return {
      duration, hold: chars * 0.05 + 0.6,
      issues: B.overflow ? [{ level: 'warning', message: '要点过多或过长，内容超出区域', hint: '减少条目、缩短文字，或拆成两个场景' }] : [],
      draw(ctx, t) {
        if (B.style === 'cards') return drawBulletCards(ctx, c, B, rect, t, itemStagger, yOff);
        B.rows.forEach((r, i) => {
          const col = Math.floor(i / B.perCol);
          const k = i % B.perCol;
          let y = rect.y + yOff;
          for (let j = col * B.perCol; j < col * B.perCol + k; j++) y += B.rows[j].h + B.itemGap;
          const x = rect.x + col * (B.colW + B.gap);
          const ti = t - i * itemStagger;
          if (ti <= 0) return;
          drawMarker(ctx, c, B, r, i, x, y, ti);
          drawText(ctx, r.L, x + B.markerW, y, B.colW - B.markerW, paint, anims[i], ti - 0.08);
          if (r.D) {
            const st = blockState(c, ti - 0.3, 'fade');
            withState(ctx, st, null, () => drawText(ctx, r.D, x + B.markerW, y + r.L.height + B.size * 0.2, B.colW - B.markerW, dPaint, null, 0));
          }
        });
      },
    };
  },
};

function drawMarker(ctx, c, B, r, i, x, y, t) {
  const { env, p } = c;
  const s = B.size;
  const cy = y + r.L.lineHeight / 2;
  const k = env.motion.spring ? env.motion.spring(clamp01(t / 0.6)) : EASE.outBack(clamp01(t / 0.45));
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp01(t / 0.2);
  const color = p.accent;
  switch (B.style) {
    case 'numbers': {
      ctx.font = `${Math.max(600, env.fonts.number.weight)} ${s * 0.95}px ${env.fonts.number.family.map((f) => `"${f}"`).join(',')}`;
      ctx.fillStyle = p.accentText;
      ctx.textBaseline = 'middle';
      ctx.translate(x, cy);
      ctx.scale(k, k);
      ctx.fillText(String(i + 1).padStart(2, '0'), 0, 0);
      break;
    }
    case 'icons': case 'checks': {
      const name = B.style === 'checks' ? 'check' : r.it.icon || pickIcon(r.it.text);
      const R = s * 0.78;
      ctx.translate(x + R, cy);
      ctx.scale(k, k);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = toCss(color, p.dark ? 0.16 : 0.12);
      ctx.fill();
      drawIcon(ctx, name, 0, 0, R * 1.05, p.accentText, { stroke: 2.2, draw: clamp01(t / 0.7) });
      break;
    }
    case 'dashes': {
      ctx.fillStyle = color;
      ctx.fillRect(x, cy - s * 0.04, s * 0.8 * k, Math.max(2, s * 0.08));
      break;
    }
    default: {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + s * 0.28, cy, s * 0.17 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBulletCards(ctx, c, B, rect, t, stagger, yOff) {
  const { env, p } = c;
  const paint = paintFor(c, p.ink, { flat: true });
  const dPaint = paintFor(c, p.mutedText, { flat: true });
  const preset = blockPreset(env);
  B.rows.forEach((r, i) => {
    const col = i % B.cols, row = Math.floor(i / B.cols);
    const x = rect.x + col * (B.cw + B.gap);
    let y = rect.y + yOff;
    for (let k = 0; k < row; k++) y += B.rowH[k] + B.gap;
    const box = { x, y, w: B.cw, h: B.rowH[row] };
    const ti = t - i * stagger;
    withState(ctx, blockState(c, ti, preset, { size: B.size * 2 }), box, () => {
      drawCard(ctx, c, box);
      const icon = r.it.icon || pickIcon(r.it.text);
      const R = B.size * 0.95;
      ctx.beginPath(); ctx.arc(x + B.pad + R, y + B.pad + R, R, 0, Math.PI * 2);
      ctx.fillStyle = toCss(p.accent, p.dark ? 0.16 : 0.12); ctx.fill();
      drawIcon(ctx, icon, x + B.pad + R, y + B.pad + R, R * 1.1, p.accentText, { stroke: 2, draw: clamp01((ti - 0.15) / 0.8) });
      const ty = y + B.pad + B.size * 1.9 + B.size * 0.3;
      drawText(ctx, r.L, x + B.pad, ty, B.cw - B.pad * 2, paint, null, 0);
      if (r.D) drawText(ctx, r.D, x + B.pad, ty + r.L.height + B.size * 0.35, B.cw - B.pad * 2, dPaint, null, 0);
    });
  });
}

// ───────────────────────────── quote ─────────────────────────────
function quoteLayout(block, c, w, maxH = Infinity) {
  const { env, te } = c;
  const align = alignOf(block, c, 'left');
  const len = String(block.text || '').length;
  const target = len < 30 ? env.sizes.h1 : len < 70 ? env.sizes.h2 : env.sizes.h3;
  const qRole = role(env, 'heading', env.theme.id === 'editorial' || env.theme.id === 'noir' ? { weight: 400 } : {});
  const markSize = Math.min(target * 2.4, env.sizes.display * 1.4);
  const att = [block.author, block.role].filter(Boolean).length;
  const A = block.author ? te.layout(`— ${block.author}`, role(env, 'text', { weight: 600 }), env.sizes.body, { maxWidth: w, align }) : null;
  const R = block.role ? te.layout(block.role, role(env, 'text'), env.sizes.small, { maxWidth: w, align }) : null;
  const attH = att ? (A?.height || 0) + (R ? R.height + 4 : 0) + env.sizes.body * 1.2 : 0;
  const L = te.fit(block.text ?? '', qRole, { maxWidth: w * (align === 'center' ? 0.92 : 1), maxHeight: maxH - markSize * 0.55 - attH, min: env.sizes.body, max: target, balance: true, align, lineHeight: (qRole.lineHeight || 1.15) + 0.08 });
  return { L, A, R, markSize, align, attH, h: markSize * 0.55 + L.height + attH };
}

const quote = {
  type: 'quote',
  measure(block, c, w, maxH) { return { h: quoteLayout(block, c, w, maxH).h }; },
  build(block, c, rect) {
    const { env, p } = c;
    const Q = quoteLayout(block, c, rect.w, rect.h);
    const preset = enterOf(block, c, env.motion.titleEnter === 'type' ? 'write' : env.motion.titleEnter);
    const anim = textAnimator(env, Q.L, preset, { maxSpread: 1.6 });
    const t1 = 0.25;
    const tA = t1 + anim.duration * 0.8;
    const paint = paintFor(c, p.ink);
    const mPaint = paintFor(c, p.mutedText, { flat: true });
    const yOff = c.hint?.valign === 'center' ? Math.max(0, (rect.h - Q.h) / 2) : 0;
    const qw = Q.align === 'center' ? (rect.w - Q.L.width) / 2 : 0;
    return {
      duration: tA + env.motion.duration, hold: Q.L.unitCount * 0.07 + 0.8,
      draw(ctx, t) {
        let y = rect.y + yOff;
        const k = env.motion.spring ? env.motion.spring(clamp01(t / 0.7)) : EASE.outBack(clamp01(t / 0.6));
        if (k > 0) {
          ctx.save();
          ctx.globalAlpha *= clamp01(t / 0.3) * 0.9;
          const markFam = env.theme.id === 'pop' ? env.fonts.display.family : ['Motif Fraunces', 'Motif Serif SC'];
          ctx.font = `${env.theme.id === 'pop' ? 900 : 600} ${Q.markSize}px ${markFam.map((f) => `"${f}"`).join(',')}, serif`;
          ctx.fillStyle = p.accent;
          ctx.textBaseline = 'alphabetic';
          const mx = Q.align === 'center' ? rect.x + rect.w / 2 - Q.markSize * 0.25 : rect.x + qw - Q.markSize * 0.06;
          ctx.translate(mx, y + Q.markSize * 0.78);
          ctx.scale(k, k);
          ctx.fillText('“', 0, 0);
          ctx.restore();
        }
        y += Q.markSize * 0.55;
        drawText(ctx, Q.L, rect.x, y, rect.w, paint, anim, t - t1);
        y += Q.L.height + env.sizes.body * 1.2;
        const st = blockState(c, t - tA, 'rise', { size: env.sizes.body });
        withState(ctx, st, null, () => {
          if (Q.A) drawText(ctx, Q.A, rect.x, y, rect.w, paintFor(c, p.ink, { flat: true }), null, 0);
          if (Q.R) drawText(ctx, Q.R, rect.x, y + Q.A.height + 4, rect.w, mPaint, null, 0);
        });
      },
    };
  },
};

// ───────────────────────────── callout ─────────────────────────────
function calloutLayout(block, c, w) {
  const { env, te } = c;
  const size = env.sizes.body;
  const pad = size * 0.95;
  const iconW = block.icon !== false ? size * 2.2 : 0;
  const inner = w - pad * 2 - iconW - size * 0.3;
  const Lb = block.label ? te.layout(block.label, role(env, 'label'), env.sizes.label, { maxWidth: inner }) : null;
  const L = te.layout(block.text ?? '', role(env, 'text', { weight: Math.max(450, env.fonts.text.weight) }), size, { maxWidth: inner });
  const h = pad * 2 + (Lb ? Lb.height + size * 0.35 : 0) + L.height;
  return { L, Lb, pad, iconW, size, h: Math.max(h, iconW + pad * 1.4) };
}

const callout = {
  type: 'callout',
  measure(block, c, w) { return { h: calloutLayout(block, c, w).h }; },
  build(block, c, rect) {
    const { env, p } = c;
    const C = calloutLayout(block, c, rect.w);
    const tone = colorOf(p, block.tone && block.tone !== 'auto' ? block.tone : 'accent', p.accent);
    const box = { x: rect.x, y: rect.y, w: rect.w, h: C.h };
    const preset = blockPreset(env, block.motion?.enter);
    const anim = textAnimator(env, C.L, 'fade', { unit: 'line' });
    return {
      duration: env.motion.duration + 0.3 + anim.duration * 0.5, hold: C.L.unitCount * 0.06,
      draw(ctx, t) {
        withState(ctx, blockState(c, t, preset, { size: C.size * 2 }), box, () => {
          drawCard(ctx, c, box);
          ctx.fillStyle = tone;
          const barW = Math.max(3, env.unit * 5);
          const e = env.motion.ease(clamp01(t / env.motion.duration));
          roundRect(ctx, box.x, box.y, barW, box.h * e, Math.min(barW / 2, env.theme.shape.radius * env.unit));
          ctx.fill();
          let x = box.x + C.pad + barW * 0.5;
          if (C.iconW) {
            const R = C.size * 0.95;
            ctx.beginPath(); ctx.arc(x + R, box.y + C.pad + R * 0.95, R, 0, Math.PI * 2);
            ctx.fillStyle = toCss(tone, 0.14); ctx.fill();
            drawIcon(ctx, block.icon || 'lightbulb', x + R, box.y + C.pad + R * 0.95, R * 1.1, tone, { draw: clamp01((t - 0.2) / 0.8) });
            x += C.iconW;
          }
          let y = box.y + C.pad;
          if (C.Lb) { drawText(ctx, C.Lb, x, y, C.Lb.width, { color: tone, accent: tone, mark: p.highlight }, null, 0); y += C.Lb.height + C.size * 0.35; }
          drawText(ctx, C.L, x, y, rect.w, paintFor(c, p.ink, { flat: true }), anim, t - 0.25);
        });
      },
    };
  },
};

export default [title, text, bullets, quote, callout];
export { titleLayout, kickerMetrics, drawKicker };
