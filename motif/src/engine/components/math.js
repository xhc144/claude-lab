// Math & science components: equation, plot, geometry, transform, vectorfield, fourier, simulation.
import { role, paintFor, textAnimator, drawText, roundRect, toCss, EASE, clamp01, colorOf, mix } from './kit.js';
import { fontString } from '../text/text.js';
import { texGlyphs, glyphPath } from '../math/tex.js';
import { compileExpr } from '../../core/expr.js';
import { niceScale } from './chart.js';
import { rng } from '../../core/util/misc.js';

const TAU = Math.PI * 2;

// ───────────────────────────── TeX drawing ─────────────────────────────
const PALETTE_NAMES = ['accent', 'accent2', 'accent3', 'accent4', 'accent5', 'positive', 'negative', 'warning', 'muted', 'ink', 'faint'];
const hexOf = (c) => { const m = /^#([0-9a-f]{6})/i.exec(c); return m ? '#' + m[1] : c; };

export function prepTex(latex, p) {
  let s = String(latex ?? '');
  s = s.replace(/\\hl\{/g, `\\color{${hexOf(p.accent)}}{`);
  s = s.replace(/\\(?:color|textcolor)\{([a-z]+\d?)\}/g, (m, name) => {
    if (PALETTE_NAMES.includes(name) && p[name]) return m.replace(name, hexOf(p[name]));
    const dm = /^data(\d)$/.exec(name);
    if (dm) return m.replace(name, hexOf(p.data[+dm[1] % p.data.length]));
    return m;
  });
  return s;
}

/** Draw TeX at (x,y) = top-left (or center/right via align). progress 0..1 writes glyphs left→right. */
export function drawTex(ctx, T, x, y, em, color, o = {}) {
  if (!T || T.error) return 0;
  const s = em / 1000;
  const w = T.width * s;
  const ox = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const oy = o.valign === 'middle' ? y - (T.height * s) / 2 : y;
  const prog = o.progress ?? 1;
  const n = T.glyphs.length;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  T.glyphs.forEach((g, i) => {
    const local = prog >= 1 ? 1 : clamp01(prog * (n + 3) - i * (n + 3) / Math.max(1, n) * (1 - 3 / (n + 3)));
    if (local <= 0) return;
    ctx.save();
    ctx.transform(...g.m);
    ctx.fillStyle = g.color || color;
    if (g.kind === 'rect') { const [rx, ry, rw, rh] = g.rect; ctx.fillRect(rx, ry, rw * (local < 1 ? local : 1), rh); }
    else {
      const P = glyphPath(g.d);
      if (local < 1) {
        ctx.strokeStyle = g.color || color; ctx.lineWidth = 22; ctx.setLineDash([3200 * clamp01(local / 0.7), 4000]);
        ctx.stroke(P); ctx.setLineDash([]);
        ctx.globalAlpha *= clamp01((local - 0.35) / 0.65);
      }
      ctx.fill(P);
    }
    ctx.restore();
  });
  ctx.restore();
  return w;
}

// ───────────────────────────── equation ─────────────────────────────
const equation = {
  type: 'equation',
  measure(block, c, w, maxH) {
    const T = texGlyphs(prepTex(block.latex, c.p));
    const steps = (block.steps || []).map((s) => texGlyphs(prepTex(s, c.p)));
    const all = [T, ...steps].filter((x) => !x.error && x.width);
    if (!all.length) return { h: Math.min(maxH, c.env.sizes.h1), fill: false };
    const maxW = Math.max(...all.map((x) => x.width)), maxHh = Math.max(...all.map((x) => x.height));
    const em = Math.min(sizeFor(block, c), (w * 0.94 * 1000) / maxW);
    const labelH = block.label ? c.env.sizes.body * 2 : 0;
    return { h: Math.min(maxH, (maxHh / 1000) * em * 1.25 + labelH), fill: false };
  },
  build(block, c, rect) {
    const { env, p } = c;
    const seq = [block.latex, ...(block.steps || [])].map((s) => texGlyphs(prepTex(s, p)));
    const valid = seq.filter((x) => !x.error && x.width);
    const issues = seq.filter((x) => x.error).map((x) => ({ level: 'error', message: `公式解析失败：${x.error}`, hint: '检查 LaTeX 语法（不需要 $ 包围）' }));
    if (!valid.length) return { duration: 0.5, hold: 1, issues, draw(ctx) { ctx.fillStyle = p.negative; ctx.font = fontString(role(env, 'mono'), env.sizes.small); ctx.fillText(String(block.latex).slice(0, 80), rect.x, rect.y + env.sizes.small); } };
    const L = block.label ? c.te.layout(block.label, role(env, 'text'), env.sizes.body, { maxWidth: rect.w, align: c.hint?.align === 'left' ? 'left' : 'center' }) : null;
    const labelH = L ? L.height + env.sizes.body : 0;
    const maxW = Math.max(...valid.map((x) => x.width)), maxHh = Math.max(...valid.map((x) => x.height));
    const em = Math.min(sizeFor(block, c), (rect.w * 0.96 * 1000) / maxW, ((rect.h - labelH) * 1000) / (maxHh * 1.15));
    const align = c.hint?.align === 'left' || block.style?.align === 'left' ? 'left' : 'center';
    const s = em / 1000;
    const cy = rect.y + (rect.h - labelH) / 2;
    const origin = (T) => ({ x: align === 'center' ? rect.x + rect.w / 2 - (T.width * s) / 2 : rect.x, y: cy - (T.height * s) / 2 });
    const T0 = valid[0];
    const n0 = T0.glyphs.length;
    const per = Math.min(0.075, 1.6 / Math.max(1, n0)) * env.motion.tempo;
    const writeDur = per * n0 + 0.7;
    const hold = 1.6 * env.motion.tempo, morph = 1.15 * env.motion.tempo;
    const order0 = T0.glyphs.map((g, i) => i).sort((a, b) => T0.glyphs[a].bbox[0] - T0.glyphs[b].bbox[0]);
    const rank0 = new Map(order0.map((gi, k) => [gi, k]));
    // match glyphs between consecutive steps
    const matches = [];
    for (let k = 1; k < valid.length; k++) {
      const A = valid[k - 1], B = valid[k];
      const used = new Set();
      const map = B.glyphs.map((g) => {
        let best = -1, bd = Infinity;
        A.glyphs.forEach((h, i) => {
          if (used.has(i) || h.c !== g.c) return;
          const d = Math.abs(h.bbox[0] / A.width - g.bbox[0] / B.width);
          if (d < bd) { bd = d; best = i; }
        });
        if (best >= 0) used.add(best);
        return best;
      });
      matches.push({ map, used });
    }
    const color = colorOf(p, block.style?.color, p.ink);
    const drawGlyph = (ctx, g, o, alpha = 1, dy = 0) => {
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(o.x, o.y + dy);
      ctx.scale(s, s);
      ctx.transform(...g.m);
      ctx.fillStyle = g.color || color;
      if (g.kind === 'rect') { const [rx, ry, rw, rh] = g.rect; ctx.fillRect(rx, ry, rw, rh); } else ctx.fill(glyphPath(g.d));
      ctx.restore();
    };
    const total = writeDur + (valid.length - 1) * (hold + morph);
    return {
      duration: total, hold: 1.8, issues,
      draw(ctx, t) {
        const k = valid.length === 1 ? 0 : Math.max(0, Math.min(valid.length - 1, Math.floor((t - writeDur) / (hold + morph)) + 1));
        const phaseStart = writeDur + (k - 1) * (hold + morph) + hold;
        if (k === 0 || t < phaseStart) {
          const cur = k === 0 ? 0 : k - 1;
          const T = valid[cur];
          const o = origin(T);
          if (cur === 0 && t < writeDur) {
            // write-on: stroke the outline, then fill
            T.glyphs.forEach((g, gi) => {
              const q = (t - rank0.get(gi) * per) / 0.7;
              if (q <= 0) return;
              if (q >= 1) return drawGlyph(ctx, g, o);
              ctx.save();
              ctx.translate(o.x, o.y); ctx.scale(s, s); ctx.transform(...g.m);
              const col = g.color || color;
              if (g.kind === 'rect') { const [rx, ry, rw, rh] = g.rect; ctx.fillStyle = col; ctx.fillRect(rx, ry, rw * EASE.outCubic(q), rh); }
              else {
                const P = glyphPath(g.d);
                ctx.strokeStyle = col; ctx.lineWidth = 18 / Math.max(0.3, Math.hypot(g.m[0], g.m[1]));
                ctx.setLineDash([3000 * EASE.inOutSine(clamp01(q / 0.75)), 6000]);
                ctx.stroke(P); ctx.setLineDash([]);
                ctx.globalAlpha *= EASE.inQuad(clamp01((q - 0.4) / 0.6));
                ctx.fillStyle = col; ctx.fill(P);
              }
              ctx.restore();
            });
          } else T.glyphs.forEach((g) => drawGlyph(ctx, g, o));
        } else {
          // morph valid[k-1] → valid[k]
          const A = valid[k - 1], B = valid[k];
          const { map, used } = matches[k - 1];
          const u = EASE.inOutCubic(clamp01((t - phaseStart) / morph));
          const oa = origin(A), ob = origin(B);
          A.glyphs.forEach((g, i) => { if (!used.has(i)) drawGlyph(ctx, g, oa, 1 - EASE.outQuad(clamp01(u * 1.6)), -u * em * 0.25); });
          B.glyphs.forEach((g, j) => {
            const i = map[j];
            if (i < 0) return drawGlyph(ctx, g, ob, EASE.inQuad(clamp01((u - 0.35) / 0.65)), (1 - u) * em * 0.25);
            const ga = A.glyphs[i];
            const m = g.m.map((v, q) => ga.m[q] + (v - ga.m[q]) * u);
            const o = { x: oa.x + (ob.x - oa.x) * u, y: oa.y + (ob.y - oa.y) * u };
            drawGlyph(ctx, { ...g, m, color: u < 0.5 ? ga.color || g.color : g.color || ga.color }, o);
          });
        }
        if (L) drawText(ctx, L, rect.x, rect.y + rect.h - L.height, rect.w, paintFor(c, p.mutedText, { flat: true }), textAnimator(env, L, 'fade', { unit: 'line' }), t - writeDur * 0.8);
      },
    };
  },
};
function sizeFor(block, c) {
  const z = c.env.sizes;
  return { s: z.h2, m: z.h1, l: z.display * 1.2, xl: z.display * 1.6 }[block.size] || (block.steps?.length ? z.h1 * 1.15 : z.display * 1.2);
}

// ───────────────────────────── coordinate plane ─────────────────────────────
function plane(rect, view, equal, padPx) {
  let [x0, x1, y0, y1] = view;
  const r = { x: rect.x + padPx, y: rect.y + padPx * 0.4, w: rect.w - padPx * 1.4, h: rect.h - padPx * 1.4 };
  if (equal) {
    const sx = r.w / (x1 - x0), sy = r.h / (y1 - y0);
    const s = Math.min(sx, sy);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - r.w / s / 2; x1 = cx + r.w / s / 2; y0 = cy - r.h / s / 2; y1 = cy + r.h / s / 2;
  }
  const X = (x) => r.x + ((x - x0) / (x1 - x0)) * r.w;
  const Y = (y) => r.y + r.h - ((y - y0) / (y1 - y0)) * r.h;
  return { X, Y, x0, x1, y0, y1, r, sx: r.w / (x1 - x0), sy: r.h / (y1 - y0) };
}

function drawAxes(ctx, c, P, t, o = {}) {
  const { env, p } = c;
  const e = EASE.inOutCubic(clamp01(t / (0.9 * env.motion.tempo)));
  const xs = niceScale(P.x0, P.x1, Math.max(4, Math.round(P.r.w / (env.sizes.body * 4))));
  const ys = niceScale(P.y0, P.y1, Math.max(3, Math.round(P.r.h / (env.sizes.body * 3))));
  const ax = Math.min(Math.max(0, P.y0), P.y1), ay = Math.min(Math.max(0, P.x0), P.x1);
  if (o.grid !== false) {
    ctx.save(); ctx.globalAlpha *= clamp01((t - 0.2) / 0.6);
    ctx.strokeStyle = toCss(p.ink, p.dark ? 0.08 : 0.07); ctx.lineWidth = Math.max(1, env.unit);
    ctx.beginPath();
    for (const v of xs.ticks) if (v > P.x0 && v < P.x1) { ctx.moveTo(P.X(v), P.r.y); ctx.lineTo(P.X(v), P.r.y + P.r.h); }
    for (const v of ys.ticks) if (v > P.y0 && v < P.y1) { ctx.moveTo(P.r.x, P.Y(v)); ctx.lineTo(P.r.x + P.r.w, P.Y(v)); }
    ctx.stroke(); ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = toCss(p.ink, 0.75); ctx.fillStyle = toCss(p.ink, 0.75); ctx.lineWidth = Math.max(1.5, env.unit * 2.2); ctx.lineCap = 'round';
  const yA = P.Y(ax), xA = P.X(ay);
  ctx.beginPath(); ctx.moveTo(P.r.x, yA); ctx.lineTo(P.r.x + P.r.w * e, yA); ctx.moveTo(xA, P.r.y + P.r.h); ctx.lineTo(xA, P.r.y + P.r.h - P.r.h * e); ctx.stroke();
  const ah = env.sizes.small * 0.45;
  if (e > 0.98) {
    ctx.beginPath(); ctx.moveTo(P.r.x + P.r.w + ah * 0.4, yA); ctx.lineTo(P.r.x + P.r.w - ah, yA - ah * 0.6); ctx.lineTo(P.r.x + P.r.w - ah, yA + ah * 0.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(xA, P.r.y - ah * 0.4); ctx.lineTo(xA - ah * 0.6, P.r.y + ah); ctx.lineTo(xA + ah * 0.6, P.r.y + ah); ctx.fill();
  }
  const f = fontString(role(env, 'text'), env.sizes.caption);
  ctx.font = f; ctx.fillStyle = p.mutedText; ctx.globalAlpha *= clamp01((t - 0.4) / 0.5);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const fmt = (v, step) => (Math.abs(v) < 1e-9 ? '0' : step < 1 ? v.toFixed(Math.min(3, Math.ceil(-Math.log10(step)))) : String(Math.round(v)));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const v of xs.ticks) if (v > P.x0 && v < P.x1 && Math.abs(v) > 1e-9) { ctx.fillRect(P.X(v) - 0.5, yA - 4, 1.5, 8); ctx.fillText(o.piX ? piLabel(v) : fmt(v, xs.step), P.X(v), yA + env.sizes.caption * 0.45); }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const v of ys.ticks) if (v > P.y0 && v < P.y1 && Math.abs(v) > 1e-9) { ctx.fillRect(xA - 4, P.Y(v) - 0.5, 8, 1.5); ctx.fillText(fmt(v, ys.step), xA - env.sizes.caption * 0.5, P.Y(v)); }
  if (o.axes?.x) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(o.axes.x, P.r.x + P.r.w, yA - env.sizes.caption * 0.4); }
  if (o.axes?.y) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.axes.y, xA + env.sizes.caption * 0.6, P.r.y); }
  ctx.restore();
}
function piLabel(v) {
  const k = v / Math.PI;
  if (Math.abs(k - Math.round(k)) < 1e-6) { const r = Math.round(k); return r === 0 ? '0' : r === 1 ? 'π' : r === -1 ? '−π' : `${r}π`; }
  return v.toFixed(1);
}

// ───────────────────────────── plot ─────────────────────────────
const plot = {
  type: 'plot',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.62), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const issues = [];
    const fns = (block.functions || []).map((f, i) => {
      try {
        if (f.x != null && f.y != null) return { kind: 'param', fx: compileExpr(f.x).fn, fy: compileExpr(f.y).fn, t: f.t || [0, TAU], f, i };
        return { kind: 'fx', fn: compileExpr(f.expr).fn, f, i };
      } catch (e) { issues.push({ level: 'error', message: `函数 ${i + 1} 表达式错误：${e.message}`, hint: f.expr }); return null; }
    }).filter(Boolean);
    const param = block.param || null;
    const T = env.motion.tempo;
    const intro = 0.9 * T, perFn = 1.5 * T;
    const fnStart = (k) => intro * 0.6 + k * perFn * 0.55;
    const fnsEnd = fnStart(Math.max(0, fns.length - 1)) + perFn;
    const paramDur = param ? 3.2 * T : 0;
    const tangentDur = block.tangent ? 3.4 * T : 0;
    const areaDur = block.area ? 1.4 * T : 0;
    const tPts = fnsEnd + 0.1, tArea = tPts + (block.points?.length ? 0.6 : 0), tTan = tArea + areaDur, tParam = tTan + tangentDur;
    const duration = tParam + paramDur + 0.3;
    const scopeAt = (t) => {
      const s = { t: Math.max(0, t), x: 0 };
      if (param) s[param.name || 'a'] = param.from + (param.to - param.from) * EASE.inOutSine(clamp01((t - tParam) / Math.max(0.01, paramDur)));
      return s;
    };
    const xr = Array.isArray(block.x) ? block.x : [-6, 6];
    let yr = Array.isArray(block.y) ? block.y : null;
    if (!yr) {
      const vals = [];
      for (const F of fns) {
        const sc = scopeAt(duration);
        if (F.kind === 'fx') for (let k = 0; k <= 200; k++) { sc.x = xr[0] + (k / 200) * (xr[1] - xr[0]); const v = F.fn(sc); if (Number.isFinite(v)) vals.push(v); }
        else for (let k = 0; k <= 200; k++) { sc.t = F.t[0] + (k / 200) * (F.t[1] - F.t[0]); const v = F.fy(sc); if (Number.isFinite(v)) vals.push(v); }
      }
      vals.sort((a, b) => a - b);
      const lo = vals[Math.floor(vals.length * 0.02)] ?? -1, hi = vals[Math.floor(vals.length * 0.98)] ?? 1;
      const pad = (hi - lo) * 0.15 || 1;
      yr = [Math.min(lo - pad, 0 - pad * 0.3), Math.max(hi + pad, pad * 0.3)];
    }
    const equal = block.equal ?? (fns.some((F) => F.kind === 'param'));
    const P = plane(rect, [xr[0], xr[1], yr[0], yr[1]], equal, env.sizes.body * 1.6);
    const piX = Math.abs(xr[1] - Math.PI * Math.round(xr[1] / Math.PI)) < 0.2 && Math.abs(xr[1]) >= 3;
    const lw = Math.max(2.5, env.unit * (env.theme.chart.lineWidth || 3.5));
    const colorOfFn = (F) => colorOf(p, F.f.color, p.data[F.i % p.data.length]);
    const labels = fns.map((F) => (F.f.label ? texGlyphs(prepTex(F.f.label, p)) : null));
    const areaLabel = block.area?.label ? texGlyphs(prepTex(block.area.label, p)) : null;
    const clipRect = (ctx) => { ctx.beginPath(); ctx.rect(P.r.x, P.r.y - 2, P.r.w, P.r.h + 4); ctx.clip(); };
    return {
      duration, hold: 2, issues,
      draw(ctx, t) {
        drawAxes(ctx, c, P, t, { grid: block.grid, axes: block.axes, piX });
        const sc = scopeAt(t);
        // area
        if (block.area && t > tArea) {
          try {
            const g = compileExpr(block.area.expr || block.functions?.[0]?.expr).fn;
            const a = block.area.from ?? xr[0], b = block.area.to ?? xr[1];
            const e = EASE.inOutCubic(clamp01((t - tArea) / areaDur));
            const bx = a + (b - a) * e;
            ctx.save(); clipRect(ctx);
            ctx.beginPath(); ctx.moveTo(P.X(a), P.Y(0));
            const s2 = { ...sc };
            for (let k = 0; k <= 120; k++) { s2.x = a + (k / 120) * (bx - a); ctx.lineTo(P.X(s2.x), P.Y(g(s2))); }
            ctx.lineTo(P.X(bx), P.Y(0)); ctx.closePath();
            ctx.fillStyle = toCss(p.accent, 0.28); ctx.fill();
            ctx.restore();
            if (areaLabel && e > 0.6) { ctx.save(); ctx.globalAlpha *= clamp01((e - 0.6) / 0.4); s2.x = (a + b) / 2; drawTex(ctx, areaLabel, P.X((a + b) / 2), (P.Y(g(s2) / 2)), env.sizes.lead, p.ink, { align: 'center', valign: 'middle' }); ctx.restore(); }
          } catch { /* reported at validation */ }
        }
        fns.forEach((F, k) => {
          const pr = clamp01((t - fnStart(k)) / perFn);
          if (pr <= 0) return;
          const e = EASE.inOutCubic(pr);
          const col = colorOfFn(F);
          ctx.save(); clipRect(ctx);
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          if (F.f.dashed) ctx.setLineDash([lw * 3, lw * 2.5]);
          if (env.theme.chart.glow) { ctx.shadowColor = col; ctx.shadowBlur = lw * 2.5; }
          ctx.beginPath();
          let pen = false, last = null;
          const N = Math.ceil(P.r.w / 2);
          const s2 = { ...sc };
          for (let q = 0; q <= N * e; q++) {
            let X, Y;
            if (F.kind === 'fx') { s2.x = xr[0] + (q / N) * (xr[1] - xr[0]); const v = F.fn(s2); X = P.X(s2.x); Y = P.Y(v); }
            else { s2.t = F.t[0] + (q / N) * (F.t[1] - F.t[0]); X = P.X(F.fx(s2)); Y = P.Y(F.fy(s2)); }
            if (!Number.isFinite(Y) || !Number.isFinite(X) || Math.abs(Y - P.r.y) > P.r.h * 4) { pen = false; continue; }
            if (pen && last && Math.abs(Y - last[1]) > P.r.h * 0.9) pen = false;
            if (pen) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
            pen = true; last = [X, Y];
          }
          ctx.stroke();
          ctx.restore();
          if (last && pr < 1) { ctx.beginPath(); ctx.arc(last[0], last[1], lw * 1.4, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
          if (labels[k] && pr >= 1 && last) {
            ctx.save(); ctx.globalAlpha *= clamp01((t - fnStart(k) - perFn) / 0.4);
            const lx = Math.min(last[0] + env.sizes.small * 0.4, P.r.x + P.r.w - (labels[k].width * env.sizes.lead) / 1000);
            const ly = Math.max(P.r.y, Math.min(P.r.y + P.r.h - env.sizes.lead, last[1] - env.sizes.lead * 1.2));
            drawTex(ctx, labels[k], lx, ly, env.sizes.lead, col);
            ctx.restore();
          }
        });
        // points
        (block.points || []).forEach((pt, k) => {
          const pr = clamp01((t - tPts - k * 0.15) / 0.4);
          if (pr <= 0) return;
          const X = P.X(pt.x), Y = P.Y(pt.y);
          const r = Math.max(4, env.unit * 7) * EASE.outBack(pr);
          ctx.save();
          ctx.setLineDash([4 * env.unit, 5 * env.unit]); ctx.strokeStyle = toCss(p.ink, 0.35 * pr); ctx.lineWidth = Math.max(1, env.unit * 1.5);
          ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, P.Y(Math.max(P.y0, Math.min(0, P.y1)))); ctx.moveTo(X, Y); ctx.lineTo(P.X(Math.max(P.x0, Math.min(0, P.x1))), Y); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fillStyle = colorOf(p, pt.color, p.accent); ctx.fill();
          ctx.lineWidth = Math.max(2, env.unit * 2.5); ctx.strokeStyle = p.bg; ctx.stroke();
          if (pt.label) { ctx.globalAlpha *= pr; ctx.font = fontString(role(env, 'text', { weight: 600 }), env.sizes.small); ctx.fillStyle = p.ink; ctx.textBaseline = 'bottom'; ctx.fillText(pt.label, X + r * 1.4, Y - r * 0.6); }
          ctx.restore();
        });
        // tangent line sweeping along the curve
        if (block.tangent && t > tTan) {
          try {
            const g = compileExpr(block.tangent.expr || block.functions?.[0]?.expr).fn;
            const a = block.tangent.from ?? xr[0] + (xr[1] - xr[0]) * 0.15, b = block.tangent.to ?? xr[1] - (xr[1] - xr[0]) * 0.15;
            const u = EASE.inOutSine(clamp01((t - tTan) / tangentDur));
            const x = a + (b - a) * u;
            const s2 = { ...sc, x };
            const y = g(s2);
            const h = (xr[1] - xr[0]) * 1e-4;
            s2.x = x + h; const y1 = g(s2); s2.x = x - h; const y0 = g(s2);
            const m = (y1 - y0) / (2 * h);
            const L = (xr[1] - xr[0]) * 0.22;
            ctx.save(); clipRect(ctx);
            ctx.globalAlpha *= clamp01((t - tTan) / 0.3);
            ctx.strokeStyle = p.accent; ctx.lineWidth = lw * 0.8;
            ctx.beginPath(); ctx.moveTo(P.X(x - L), P.Y(y - m * L)); ctx.lineTo(P.X(x + L), P.Y(y + m * L)); ctx.stroke();
            ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), lw * 1.8, 0, TAU); ctx.fillStyle = p.accent; ctx.fill();
            ctx.restore();
            ctx.save(); ctx.globalAlpha *= clamp01((t - tTan) / 0.3);
            ctx.font = fontString(role(env, 'mono'), env.sizes.small); ctx.fillStyle = p.accentText;
            ctx.fillText(`slope = ${m.toFixed(2)}`, P.r.x + env.sizes.small, P.r.y + env.sizes.small * 1.2);
            ctx.restore();
          } catch { /* ignore */ }
        }
        if (param && t > tParam - 0.3) {
          ctx.save(); ctx.globalAlpha *= clamp01((t - tParam + 0.3) / 0.3);
          ctx.font = fontString(role(env, 'mono', { weight: 600 }), env.sizes.body); ctx.fillStyle = p.accentText; ctx.textAlign = 'right';
          ctx.fillText(`${param.name || 'a'} = ${sc[param.name || 'a'].toFixed(2)}`, P.r.x + P.r.w, P.r.y + env.sizes.body);
          ctx.restore();
        }
      },
    };
  },
};

// ───────────────────────────── geometry ─────────────────────────────
const geometry = {
  type: 'geometry',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.7), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const pts = {};
    for (const [k, v] of Object.entries(block.points || {})) if (Array.isArray(v)) pts[k] = { x: +v[0], y: +v[1] };
    const shapes = block.shapes || [];
    const all = Object.values(pts);
    let view = block.view;
    if (!view) {
      const xs = all.map((q) => q.x), ys = all.map((q) => q.y);
      for (const sh of shapes) if (sh.type === 'circle' && pts[sh.center]) { const r = sh.radius ?? (pts[sh.through] ? Math.hypot(pts[sh.through].x - pts[sh.center].x, pts[sh.through].y - pts[sh.center].y) : 1); xs.push(pts[sh.center].x - r, pts[sh.center].x + r); ys.push(pts[sh.center].y - r, pts[sh.center].y + r); }
      const x0 = Math.min(...xs, 0), x1 = Math.max(...xs, 1), y0 = Math.min(...ys, 0), y1 = Math.max(...ys, 1);
      const pad = Math.max(x1 - x0, y1 - y0) * 0.14;
      view = [x0 - pad, x1 + pad, y0 - pad, y1 + pad];
    }
    const P = plane(rect, view, true, 0);
    const T = env.motion.tempo;
    const per = Math.min(0.75, 4 / Math.max(1, shapes.length)) * T;
    const dur = 0.8 * T;
    const lw = Math.max(2.5, env.unit * 3.5);
    const cx = all.reduce((s, q) => s + q.x, 0) / (all.length || 1), cy = all.reduce((s, q) => s + q.y, 0) / (all.length || 1);
    const XY = (q) => [P.X(q.x), P.Y(q.y)];
    const ptStart = 0.1;
    const shStart = ptStart + Math.min(1, all.length * 0.12);
    const texCache = new Map();
    const tex = (s) => { if (!texCache.has(s)) texCache.set(s, texGlyphs(prepTex(/[\\^_{]/.test(s) || /^[A-Za-zα-ωθ]$/.test(s) ? s : `\\text{${s}}`, p))); return texCache.get(s); };
    return {
      duration: shStart + per * shapes.length + dur, hold: 2.5,
      draw(ctx, t) {
        shapes.forEach((sh, k) => {
          const q = EASE.inOutCubic(clamp01((t - shStart - k * per) / dur));
          if (q <= 0) return;
          const col = colorOf(p, sh.color, k === 0 ? p.ink : p.data[(k - 1) % p.data.length]);
          ctx.save();
          ctx.strokeStyle = col; ctx.lineWidth = sh.width ? sh.width * env.unit : lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          if (sh.dashed) ctx.setLineDash([lw * 3, lw * 2.5]);
          const seg = (A, B, u) => { const [x0, y0] = XY(A), [x1, y1] = XY(B); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u); ctx.stroke(); };
          switch (sh.type) {
            case 'segment': if (pts[sh.from] && pts[sh.to]) seg(pts[sh.from], pts[sh.to], q); break;
            case 'line': case 'ray': {
              const A = pts[sh.through?.[0] ?? sh.from], B = pts[sh.through?.[1] ?? sh.to];
              if (!A || !B) break;
              const dx = B.x - A.x, dy = B.y - A.y, L = 1000;
              const S = sh.type === 'ray' ? A : { x: A.x - dx * L, y: A.y - dy * L };
              seg(S, { x: A.x + dx * L, y: A.y + dy * L }, q);
              break;
            }
            case 'polygon': {
              const ps = (sh.points || []).map((n) => pts[n]).filter(Boolean);
              if (ps.length < 2) break;
              const per2 = ps.map((A, i) => { const B = ps[(i + 1) % ps.length]; return Math.hypot(B.x - A.x, B.y - A.y); });
              const total = per2.reduce((a, b) => a + b, 0);
              if (sh.fill !== false && q >= 1) { ctx.beginPath(); ps.forEach((A, i) => { const [x, y] = XY(A); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fillStyle = toCss(colorOf(p, sh.fill === true || sh.fill == null ? sh.color : sh.fill, p.accent), 0.14 * clamp01((t - shStart - k * per - dur) / 0.4)); ctx.fill(); }
              let budget = total * q;
              ctx.beginPath();
              let [x, y] = XY(ps[0]); ctx.moveTo(x, y);
              for (let i = 0; i < ps.length && budget > 0; i++) {
                const A = ps[i], B = ps[(i + 1) % ps.length];
                const u = Math.min(1, budget / per2[i]);
                [x, y] = XY({ x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u });
                ctx.lineTo(x, y);
                budget -= per2[i];
              }
              ctx.stroke();
              break;
            }
            case 'circle': {
              const C = pts[sh.center];
              if (!C) break;
              const r = sh.radius ?? (pts[sh.through] ? Math.hypot(pts[sh.through].x - C.x, pts[sh.through].y - C.y) : 1);
              ctx.beginPath(); ctx.arc(P.X(C.x), P.Y(C.y), r * P.sx, 0, TAU * q); ctx.stroke();
              break;
            }
            case 'arc': {
              const C = pts[sh.center];
              if (!C) break;
              const a0 = ((sh.start ?? 0) * Math.PI) / 180, a1 = ((sh.end ?? 90) * Math.PI) / 180;
              ctx.beginPath(); ctx.arc(P.X(C.x), P.Y(C.y), (sh.radius ?? 1) * P.sx, -a0, -(a0 + (a1 - a0) * q), true); ctx.stroke();
              break;
            }
            case 'angle': case 'right-angle': {
              const V = pts[sh.at], A = pts[sh.from], B = pts[sh.to];
              if (!V || !A || !B) break;
              const a1 = Math.atan2(A.y - V.y, A.x - V.x), a2 = Math.atan2(B.y - V.y, B.x - V.x);
              let d = a2 - a1; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
              const R = (sh.radius ?? 0.12 * Math.max(view[1] - view[0], view[3] - view[2]) * 0.5) * P.sx;
              const [vx, vy] = XY(V);
              if (sh.type === 'right-angle') {
                const s = R * 0.7, u1 = [Math.cos(a1), -Math.sin(a1)], u2 = [Math.cos(a2), -Math.sin(a2)];
                ctx.globalAlpha *= q; ctx.lineWidth = lw * 0.75;
                ctx.beginPath(); ctx.moveTo(vx + u1[0] * s, vy + u1[1] * s); ctx.lineTo(vx + (u1[0] + u2[0]) * s, vy + (u1[1] + u2[1]) * s); ctx.lineTo(vx + u2[0] * s, vy + u2[1] * s); ctx.stroke();
                break;
              }
              ctx.beginPath(); ctx.moveTo(vx, vy); ctx.arc(vx, vy, R, -a1, -(a1 + d * q), d > 0); ctx.closePath();
              ctx.fillStyle = toCss(col, 0.18); ctx.fill();
              ctx.beginPath(); ctx.arc(vx, vy, R, -a1, -(a1 + d * q), d > 0); ctx.stroke();
              if (sh.label && q >= 1) { const am = a1 + d / 2; drawTex(ctx, tex(sh.label), vx + Math.cos(am) * R * 1.55, vy - Math.sin(am) * R * 1.55, env.sizes.lead, col, { align: 'center', valign: 'middle' }); }
              break;
            }
            case 'label': {
              let at = sh.at ? pts[sh.at] : null;
              if (!at && sh.between) { const A = pts[sh.between[0]], B = pts[sh.between[1]]; if (A && B) { at = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }; const nx = -(B.y - A.y), ny = B.x - A.x, L = Math.hypot(nx, ny) || 1; const dir = (at.x - cx) * nx + (at.y - cy) * ny > 0 ? 1 : -1; const off = 0.07 * (view[1] - view[0]); at = { x: at.x + (nx / L) * off * dir, y: at.y + (ny / L) * off * dir }; } }
              if (Array.isArray(sh.pos)) at = { x: sh.pos[0], y: sh.pos[1] };
              if (!at) break;
              ctx.globalAlpha *= q;
              drawTex(ctx, tex(String(sh.text ?? '')), P.X(at.x), P.Y(at.y), env.sizes.lead, colorOf(p, sh.color, p.ink), { align: 'center', valign: 'middle' });
              break;
            }
            default:
          }
          ctx.restore();
        });
        if (block.showPoints !== false) {
          Object.entries(pts).forEach(([name, q], i) => {
            const a = clamp01((t - ptStart - i * 0.12) / 0.4);
            if (a <= 0) return;
            const [x, y] = XY(q);
            ctx.save();
            ctx.beginPath(); ctx.arc(x, y, Math.max(4, env.unit * 6) * EASE.outBack(a), 0, TAU); ctx.fillStyle = p.ink; ctx.fill();
            const dx = q.x - cx, dy = q.y - cy, L = Math.hypot(dx, dy) || 1;
            ctx.globalAlpha *= a;
            drawTex(ctx, tex(name), x + (dx / L) * env.sizes.lead * 0.9, y - (dy / L) * env.sizes.lead * 0.9, env.sizes.lead, p.ink, { align: 'center', valign: 'middle' });
            ctx.restore();
          });
        }
      },
    };
  },
};

// ───────────────────────────── linear transform ─────────────────────────────
const transform = {
  type: 'transform',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.62), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const M = block.matrix || [[1, 1], [0, 1]];
    const [[a, b], [cc, d]] = M;
    const R = block.range || 3.2;
    const P = plane(rect, [-R * 1.5, R * 1.5, -R, R], true, 0);
    const T = env.motion.tempo;
    const tIn = 1.2 * T, tM = 2.6 * T;
    const vecs = block.vectors || [];
    const colI = p.data[2] || p.positive, colJ = p.data[3] || p.negative, colG = p.data[0] || p.accent2;
    const lw = Math.max(2, env.unit * 2.5);
    const arrow = (ctx, x0, y0, x1, y1, col, w) => {
      const ang = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), hs = Math.min(L * 0.35, w * 5);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(ang) * hs * 0.8, y1 - Math.sin(ang) * hs * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.4) * hs, y1 - Math.sin(ang - 0.4) * hs); ctx.lineTo(x1 - Math.cos(ang + 0.4) * hs, y1 - Math.sin(ang + 0.4) * hs); ctx.closePath(); ctx.fill();
    };
    const det = a * d - b * cc;
    return {
      duration: tIn + tM + 0.6, hold: 2.5,
      draw(ctx, t) {
        const u = EASE.inOutCubic(clamp01((t - tIn) / tM));
        const m = [1 + (a - 1) * u, b * u, cc * u, 1 + (d - 1) * u];
        const tf = (x, y) => [P.X(m[0] * x + m[1] * y), P.Y(m[2] * x + m[3] * y)];
        const e = clamp01(t / (0.9 * T));
        ctx.save(); ctx.beginPath(); ctx.rect(P.r.x, P.r.y, P.r.w, P.r.h); ctx.clip();
        // static background grid
        ctx.strokeStyle = toCss(p.ink, 0.08); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = -Math.ceil(R * 2); k <= Math.ceil(R * 2); k++) { ctx.moveTo(P.X(k), P.r.y); ctx.lineTo(P.X(k), P.r.y + P.r.h); ctx.moveTo(P.r.x, P.Y(k)); ctx.lineTo(P.r.x + P.r.w, P.Y(k)); }
        ctx.stroke();
        // transformed grid
        ctx.globalAlpha *= e;
        const G = Math.ceil(R * 3);
        ctx.strokeStyle = toCss(colG, 0.6); ctx.lineWidth = Math.max(1, env.unit * 1.4);
        ctx.beginPath();
        for (let k = -G; k <= G; k++) {
          let [x0, y0] = tf(k, -G), [x1, y1] = tf(k, G); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
          [x0, y0] = tf(-G, k); [x1, y1] = tf(G, k); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        }
        ctx.stroke();
        ctx.strokeStyle = toCss(p.ink, 0.6); ctx.lineWidth = Math.max(1.5, env.unit * 2);
        ctx.beginPath(); let [x0, y0] = tf(-G, 0), [x1, y1] = tf(G, 0); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); [x0, y0] = tf(0, -G); [x1, y1] = tf(0, G); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        // unit square (determinant)
        if (block.showDet !== false) {
          const q = [tf(0, 0), tf(1, 0), tf(1, 1), tf(0, 1)];
          ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
          ctx.fillStyle = toCss(p.accent, 0.3); ctx.fill();
        }
        ctx.restore();
        const [ox, oy] = tf(0, 0);
        ctx.save(); ctx.globalAlpha *= clamp01((t - 0.5) / 0.5);
        arrow(ctx, ox, oy, ...tf(1, 0), colI, lw * 1.6);
        arrow(ctx, ox, oy, ...tf(0, 1), colJ, lw * 1.6);
        vecs.forEach((v, k) => arrow(ctx, ox, oy, ...tf(v[0], v[1]), p.data[(k + 4) % p.data.length], lw * 1.3));
        ctx.restore();
        // matrix + det readout
        const curDet = m[0] * m[3] - m[1] * m[2];
        ctx.save(); ctx.globalAlpha *= clamp01((t - 0.6) / 0.5);
        const fs = env.sizes.body;
        const bx = P.r.x + fs * 0.5, by = P.r.y + fs * 0.5;
        roundRect(ctx, bx, by, fs * 9.5, fs * 4.6, fs * 0.4); ctx.fillStyle = toCss(p.bg, 0.82); ctx.fill();
        ctx.font = fontString(role(env, 'mono', { weight: 500 }), fs * 0.9); ctx.fillStyle = p.ink; ctx.textBaseline = 'top';
        ctx.fillText(`[ ${m[0].toFixed(2).padStart(5)}  ${m[1].toFixed(2).padStart(5)} ]`, bx + fs * 0.6, by + fs * 0.6);
        ctx.fillText(`[ ${m[2].toFixed(2).padStart(5)}  ${m[3].toFixed(2).padStart(5)} ]`, bx + fs * 0.6, by + fs * 1.8);
        ctx.fillStyle = p.accentText; ctx.fillText(`det = ${curDet.toFixed(2)}`, bx + fs * 0.6, by + fs * 3.1);
        ctx.restore();
        void det;
      },
    };
  },
};

// ───────────────────────────── vector field ─────────────────────────────
const vectorfield = {
  type: 'vectorfield',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.62), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    let fx, fy;
    const issues = [];
    try { fx = compileExpr(block.fx ?? '-y').fn; fy = compileExpr(block.fy ?? 'x').fn; } catch (e) { issues.push({ level: 'error', message: e.message }); fx = () => 0; fy = () => 0; }
    const range = block.range || [-4, 4, -2.5, 2.5];
    const P = plane(rect, range, true, 0);
    const n = 22;
    const step = (P.x1 - P.x0) / n;
    const grid = [];
    const s = { x: 0, y: 0, t: 0 };
    let maxMag = 0;
    for (let x = P.x0 + step / 2; x < P.x1; x += step) for (let y = P.y0 + step / 2; y < P.y1; y += step) { s.x = x; s.y = y; const vx = fx(s), vy = fy(s); const m = Math.hypot(vx, vy); if (Number.isFinite(m)) { maxMag = Math.max(maxMag, m); grid.push({ x, y, vx, vy, m }); } }
    const r = rng('vf' + c.block.id);
    const parts = Array.from({ length: block.particles === false ? 0 : 260 }, () => ({ x: P.x0 + r() * (P.x1 - P.x0), y: P.y0 + r() * (P.y1 - P.y0), ph: r() * 3 }));
    const life = 3, dt = 1 / 30;
    const speed = (P.x1 - P.x0) / (maxMag || 1) * 0.06;
    const lowC = p.data[0] || p.accent2, hiC = p.accent;
    return {
      duration: 1.6, hold: 4, issues,
      draw(ctx, t) {
        ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
        const cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2, maxD = Math.hypot(P.x1 - cx, P.y1 - cy);
        for (const g of grid) {
          const a = clamp01((t - (Math.hypot(g.x - cx, g.y - cy) / maxD) * 0.9) / 0.4);
          if (a <= 0) continue;
          const L = Math.min(1, g.m / (maxMag || 1)) * step * 0.42 + step * 0.08;
          const ux = g.vx / (g.m || 1), uy = g.vy / (g.m || 1);
          const x0 = P.X(g.x - ux * L / 2), y0 = P.Y(g.y - uy * L / 2), x1 = P.X(g.x + ux * L / 2), y1 = P.Y(g.y + uy * L / 2);
          const col = mix(lowC, hiC, Math.min(1, g.m / (maxMag || 1)));
          ctx.globalAlpha = a * 0.75; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.5, env.unit * 2);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          const ang = Math.atan2(y1 - y0, x1 - x0), hs = step * P.sx * 0.12;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.5) * hs, y1 - Math.sin(ang - 0.5) * hs); ctx.lineTo(x1 - Math.cos(ang + 0.5) * hs, y1 - Math.sin(ang + 0.5) * hs); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (t > 1) {
          const a = clamp01((t - 1) / 0.8);
          for (const q of parts) {
            const age = (t + q.ph) % life;
            const born = t - age;
            if (born < 1 - 0.0001 && age > t - 1) continue;
            let x = q.x, y = q.y;
            const trail = [];
            const steps = Math.floor(age / dt);
            for (let k = 0; k < steps; k++) {
              s.x = x; s.y = y; const vx = fx(s), vy = fy(s);
              x += vx * speed * dt * 30 * dt; y += vy * speed * dt * 30 * dt;
              if (k > steps - 18) trail.push([P.X(x), P.Y(y)]);
            }
            if (trail.length < 2) continue;
            const fade = Math.min(1, age / 0.4, (life - age) / 0.5) * a;
            ctx.strokeStyle = toCss(p.ink, 0.65 * fade); ctx.lineWidth = Math.max(1.5, env.unit * 2.2); ctx.lineCap = 'round';
            ctx.beginPath(); trail.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
          }
        }
        ctx.restore();
      },
    };
  },
};

// ───────────────────────────── fourier epicycles ─────────────────────────────
function shapePoints(kind, path, N) {
  const pts = [];
  if (kind === 'custom' && path && typeof document !== 'undefined') {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', path);
    const L = el.getTotalLength();
    for (let i = 0; i < N; i++) { const q = el.getPointAtLength((i / N) * L); pts.push([q.x, -q.y]); }
  } else {
    for (let i = 0; i < N; i++) {
      const u = (i / N) * TAU;
      switch (kind) {
        case 'square': { const k = (i / N) * 4, side = Math.floor(k), f = k - side; pts.push([[-1 + 2 * f, 1], [1, 1 - 2 * f], [1 - 2 * f, -1], [-1, -1 + 2 * f]][side]); break; }
        case 'star': { const r = 0.55 + 0.45 * Math.cos(5 * u) ** 2 * (Math.cos(5 * u) > 0 ? 1 : 0.2); const R = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(5 * u)); pts.push([R * Math.sin(u), R * Math.cos(u)]); void r; break; }
        case 'infinity': { const d = 1 + Math.sin(u) ** 2; pts.push([Math.cos(u) / d * 1.3, (Math.sin(u) * Math.cos(u)) / d * 1.3]); break; }
        case 'note': { const k = i / N; if (k < 0.5) { const a = k * 2 * TAU; pts.push([-0.35 + 0.3 * Math.cos(a), -0.75 + 0.22 * Math.sin(a)]); } else { const q = (k - 0.5) * 2; pts.push(q < 0.5 ? [-0.05, -0.75 + q * 2 * 1.6] : [-0.05 + (q - 0.5) * 2 * 0.5, 0.85 - (q - 0.5) * 2 * 0.3]); } break; }
        default: { const x = 16 * Math.sin(u) ** 3, y = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u); pts.push([x / 17, y / 17]); }
      }
    }
  }
  return pts;
}

const fourier = {
  type: 'fourier',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.7), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const N = 256;
    const raw = shapePoints(block.shape || 'heart', block.path, N);
    const mx = raw.reduce((s, q) => s + q[0], 0) / N, my = raw.reduce((s, q) => s + q[1], 0) / N;
    const span = Math.max(...raw.map((q) => Math.max(Math.abs(q[0] - mx), Math.abs(q[1] - my)))) || 1;
    const pts = raw.map((q) => [(q[0] - mx) / span, (q[1] - my) / span]);
    const coefs = [];
    for (let k = -N / 2; k < N / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) { const a = (-TAU * k * n) / N; re += pts[n][0] * Math.cos(a) - pts[n][1] * Math.sin(a); im += pts[n][0] * Math.sin(a) + pts[n][1] * Math.cos(a); }
      coefs.push({ k, re: re / N, im: im / N, amp: Math.hypot(re, im) / N });
    }
    coefs.sort((a, b) => b.amp - a.amp);
    const terms = coefs.slice(0, Math.max(2, Math.min(200, block.terms || 40)));
    const scale = Math.min(rect.w, rect.h) * 0.36;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const cycleDur = 9 * env.motion.tempo;
    const cycles = block.cycles || 1;
    const intro = 0.8;
    const evalAt = (u) => { let x = 0, y = 0; for (const c0 of terms) { const a = TAU * c0.k * u; x += c0.re * Math.cos(a) - c0.im * Math.sin(a); y += c0.re * Math.sin(a) + c0.im * Math.cos(a); } return [x, y]; };
    const trace = Array.from({ length: 601 }, (_, i) => evalAt(i / 600));
    return {
      duration: intro + cycleDur * cycles + 0.4, hold: 1.5,
      draw(ctx, t) {
        const a = clamp01(t / intro);
        const u = Math.max(0, (t - intro) / cycleDur);
        const frac = Math.min(1, u);
        // traced path so far
        ctx.save();
        ctx.strokeStyle = p.accent; ctx.lineWidth = Math.max(2.5, env.unit * 3.5); ctx.lineJoin = 'round';
        if (env.theme.chart.glow) { ctx.shadowColor = p.accent; ctx.shadowBlur = 12 * env.unit; }
        ctx.beginPath();
        const upto = u >= 1 ? 600 : Math.floor(frac * 600);
        for (let i = 0; i <= upto; i++) { const [x, y] = trace[i]; const X = cx + x * scale, Y = cy - y * scale; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke(); ctx.restore();
        // epicycles
        let x = 0, y = 0;
        const uu = u % 1;
        ctx.save(); ctx.globalAlpha *= a * (u >= cycles ? Math.max(0.15, 1 - (u - cycles) * 3) : 1);
        terms.forEach((c0, i) => {
          const r = c0.amp * scale;
          const ang = TAU * c0.k * uu + Math.atan2(c0.im, c0.re);
          const nx = x + c0.amp * Math.cos(ang), ny = y + c0.amp * Math.sin(ang);
          if (r > 0.6) {
            ctx.strokeStyle = toCss(p.ink, i < 8 ? 0.35 : 0.18); ctx.lineWidth = Math.max(1, env.unit * 1.2);
            ctx.beginPath(); ctx.arc(cx + x * scale, cy - y * scale, r, 0, TAU); ctx.stroke();
            ctx.strokeStyle = toCss(p.ink, 0.7); ctx.beginPath(); ctx.moveTo(cx + x * scale, cy - y * scale); ctx.lineTo(cx + nx * scale, cy - ny * scale); ctx.stroke();
          }
          x = nx; y = ny;
        });
        ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(cx + x * scale, cy - y * scale, Math.max(4, env.unit * 6), 0, TAU); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.globalAlpha *= a;
        ctx.font = fontString(role(env, 'mono'), env.sizes.small); ctx.fillStyle = p.mutedText;
        ctx.fillText(`N = ${terms.length}`, rect.x, rect.y + env.sizes.small);
        ctx.restore();
      },
    };
  },
};

// ───────────────────────────── simulations ─────────────────────────────
function rk4(f, y, t, dt) {
  const k1 = f(t, y);
  const k2 = f(t + dt / 2, y.map((v, i) => v + (dt / 2) * k1[i]));
  const k3 = f(t + dt / 2, y.map((v, i) => v + (dt / 2) * k2[i]));
  const k4 = f(t + dt, y.map((v, i) => v + dt * k3[i]));
  return y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** Integrates once and caches samples at 120 Hz so any frame can be drawn in O(1). */
function sampled(f, y0, T, hz = 120) {
  const dt = 1 / hz;
  const out = [y0];
  let y = y0;
  for (let k = 0; k < T * hz; k++) { y = rk4(f, y, k * dt, dt); out.push(y); }
  return (t) => { const i = Math.max(0, Math.min(out.length - 2, t * hz)); const k = Math.floor(i), fr = i - k; return out[k].map((v, j) => v + (out[k + 1][j] - v) * fr); };
}

const simulation = {
  type: 'simulation',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.62), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const prm = block.params || {};
    const preset = block.preset || 'pendulum';
    const T = 40;
    const lw = Math.max(2, env.unit * 3);
    const ink = p.ink, acc = p.accent;
    const label = (ctx, text, x, y, col = p.mutedText, align = 'left') => { ctx.font = fontString(role(env, 'mono'), env.sizes.small); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.fillText(text, x, y); ctx.textAlign = 'left'; };
    const intro = 0.8;
    const base = { duration: intro + 0.4, hold: 8 };
    const showLabels = block.labels !== false;
    switch (preset) {
      case 'double-pendulum': {
        const g = 9.81, m1 = 1, m2 = 1, l1 = 1, l2 = 1;
        const f = (t, [a1, w1, a2, w2]) => {
          const d = a1 - a2, den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
          const dw1 = (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
          const dw2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
          return [w1, dw1, w2, dw2];
        };
        const S = sampled(f, [((prm.angle1 ?? 120) * Math.PI) / 180, 0, ((prm.angle2 ?? -20) * Math.PI) / 180, 0], T);
        const L = Math.min(rect.w, rect.h) * 0.24;
        const ox = rect.x + rect.w / 2, oy = rect.y + rect.h * 0.42;
        const pos = (st) => { const x1 = ox + Math.sin(st[0]) * L, y1 = oy + Math.cos(st[0]) * L; return [x1, y1, x1 + Math.sin(st[2]) * L, y1 + Math.cos(st[2]) * L]; };
        return {
          ...base,
          draw(ctx, t) {
            const a = clamp01(t / intro);
            const tt = Math.max(0, t - intro);
            ctx.save(); ctx.globalAlpha *= a;
            if (block.trail !== false) {
              const n = 260;
              for (let k = 1; k < n; k++) {
                const t0 = tt - (k / n) * 4, t1 = tt - ((k - 1) / n) * 4;
                if (t0 < 0) break;
                const [, , x0, y0] = pos(S(t0)), [, , x1, y1] = pos(S(t1));
                ctx.strokeStyle = toCss(mix(acc, p.data[1] || acc, k / n), (1 - k / n) * 0.9); ctx.lineWidth = lw * (1 - k / n * 0.6);
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
              }
            }
            const [x1, y1, x2, y2] = pos(S(tt));
            ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            for (const [x, y, r, col] of [[ox, oy, 0.35, ink], [x1, y1, 0.75, p.data[1] || ink], [x2, y2, 0.75, acc]]) { ctx.beginPath(); ctx.arc(x, y, env.sizes.body * r, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
            if (showLabels) label(ctx, `t = ${tt.toFixed(1)} s`, rect.x, rect.y + env.sizes.small);
            ctx.restore();
          },
        };
      }
      case 'projectile': {
        const v0 = prm.speed ?? 20, ang = ((prm.angle ?? 50) * Math.PI) / 180, g = prm.g ?? 9.81;
        const tf = (2 * v0 * Math.sin(ang)) / g, range = v0 * Math.cos(ang) * tf, hmax = (v0 * Math.sin(ang)) ** 2 / (2 * g);
        const P = plane(rect, [-range * 0.05, range * 1.08, -hmax * 0.08, hmax * 1.45], true, env.sizes.body * 1.6);
        const flight = 3.2 * env.motion.tempo;
        return {
          duration: intro + flight + 0.5, hold: 2.5,
          draw(ctx, t) {
            drawAxes(ctx, c, P, t, { axes: { x: 'x / m', y: 'y / m' } });
            const u = clamp01((t - intro) / flight);
            const tt = u * tf;
            const X = (s) => v0 * Math.cos(ang) * s, Y = (s) => v0 * Math.sin(ang) * s - 0.5 * g * s * s;
            ctx.save();
            ctx.strokeStyle = acc; ctx.lineWidth = lw; ctx.setLineDash([lw * 2, lw * 2]);
            ctx.beginPath(); for (let k = 0; k <= 100; k++) { const s = (k / 100) * tt; k ? ctx.lineTo(P.X(X(s)), P.Y(Y(s))) : ctx.moveTo(P.X(X(s)), P.Y(Y(s))); } ctx.stroke(); ctx.setLineDash([]);
            for (let k = 1; k <= 8; k++) { const s = (k / 9) * tf; if (s > tt) break; ctx.beginPath(); ctx.arc(P.X(X(s)), P.Y(Y(s)), env.unit * 6, 0, TAU); ctx.fillStyle = toCss(acc, 0.35); ctx.fill(); }
            const bx = P.X(X(tt)), by = P.Y(Y(tt));
            ctx.beginPath(); ctx.arc(bx, by, env.sizes.body * 0.45, 0, TAU); ctx.fillStyle = acc; ctx.fill();
            if (u < 1 && showLabels) {
              const vx = v0 * Math.cos(ang), vy = v0 * Math.sin(ang) - g * tt, k = P.sx * 0.12;
              const drawArrow = (dx, dy, col) => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dx, by - dy); ctx.stroke(); const an = Math.atan2(-dy, dx), hs = env.unit * 12; ctx.beginPath(); ctx.moveTo(bx + dx, by - dy); ctx.lineTo(bx + dx - Math.cos(an - 0.4) * hs, by - dy - Math.sin(an - 0.4) * hs); ctx.lineTo(bx + dx - Math.cos(an + 0.4) * hs, by - dy - Math.sin(an + 0.4) * hs); ctx.fill(); };
              drawArrow(vx * k, 0, p.data[1] || ink); drawArrow(0, vy * k, p.data[2] || ink);
            }
            ctx.restore();
            if (showLabels && u >= 1) {
              ctx.save(); ctx.globalAlpha *= clamp01((t - intro - flight) / 0.4);
              label(ctx, `R = ${range.toFixed(1)} m`, P.X(range), P.Y(0) - env.sizes.small * 1.4, p.ink, 'center');
              label(ctx, `H = ${hmax.toFixed(1)} m`, P.X(range / 2), P.Y(hmax) - env.sizes.small * 1.2, p.ink, 'center');
              ctx.restore();
            }
            if (showLabels) label(ctx, `v₀ = ${v0} m/s   θ = ${prm.angle ?? 50}°`, P.r.x + P.r.w, P.r.y + env.sizes.small, p.mutedText, 'right');
          },
        };
      }
      case 'orbit': {
        const e = prm.eccentricity ?? 0.55;
        const aR = Math.min(rect.w * 0.36, rect.h * 0.42 / Math.sqrt(1 - e * e));
        const bR = aR * Math.sqrt(1 - e * e);
        const cx = rect.x + rect.w / 2 + aR * e * 0.0, cy = rect.y + rect.h / 2;
        const focus = [cx + aR * e, cy];
        const period = 6 * env.motion.tempo;
        const posAt = (time) => { const M = (TAU * time) / period; let E = M; for (let k = 0; k < 12; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return [cx + aR * Math.cos(E), cy + bR * Math.sin(E)]; };
        return {
          ...base,
          draw(ctx, t) {
            const a = clamp01(t / intro);
            const tt = Math.max(0, t - intro);
            ctx.save(); ctx.globalAlpha *= a;
            ctx.strokeStyle = toCss(ink, 0.25); ctx.lineWidth = Math.max(1.5, env.unit * 1.8); ctx.setLineDash([env.unit * 6, env.unit * 6]);
            ctx.beginPath(); ctx.ellipse(cx, cy, aR, bR, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
            // Kepler's 2nd law: equal areas swept in equal times
            const slice = period / 8;
            for (let k = 0; k < 2; k++) {
              const t0 = k === 0 ? Math.floor(tt / period) * period : Math.floor(tt / period) * period + period / 2;
              const t1 = Math.min(tt, t0 + slice);
              if (t1 <= t0) continue;
              ctx.beginPath(); ctx.moveTo(...focus);
              for (let q = 0; q <= 40; q++) ctx.lineTo(...posAt(t0 + ((t1 - t0) * q) / 40));
              ctx.closePath(); ctx.fillStyle = toCss(k ? p.data[1] || acc : acc, 0.28); ctx.fill();
            }
            const g = ctx.createRadialGradient(...focus, 0, ...focus, env.sizes.body * 1.6);
            g.addColorStop(0, '#fff7d6'); g.addColorStop(0.4, '#ffc94d'); g.addColorStop(1, 'rgba(255,170,40,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(...focus, env.sizes.body * 1.6, 0, TAU); ctx.fill();
            const [px, py] = posAt(tt);
            ctx.beginPath(); ctx.arc(px, py, env.sizes.body * 0.42, 0, TAU); ctx.fillStyle = p.data[0] || acc; ctx.fill();
            if (showLabels) label(ctx, `e = ${e}`, rect.x, rect.y + env.sizes.small);
            ctx.restore();
          },
        };
      }
      case 'spring': {
        const k = prm.k ?? 8, m = prm.mass ?? 1, damp = prm.damping ?? 0.25;
        const S = sampled((t, [x, v]) => [v, (-k * x - damp * v) / m], [prm.x0 ?? 1, 0], T);
        const ax = rect.x + rect.w * 0.08, ay = rect.y + rect.h * 0.35;
        const restX = rect.x + rect.w * 0.32, amp = rect.w * 0.12;
        const gx = rect.x + rect.w * 0.52, gw = rect.w * 0.46, gy = rect.y + rect.h * 0.62, gh = rect.h * 0.3;
        return {
          ...base,
          draw(ctx, t) {
            const a = clamp01(t / intro);
            const tt = Math.max(0, t - intro);
            const x = S(tt)[0];
            ctx.save(); ctx.globalAlpha *= a;
            ctx.fillStyle = toCss(ink, 0.5); ctx.fillRect(ax - env.unit * 8, ay - rect.h * 0.12, env.unit * 8, rect.h * 0.24);
            const bx = restX + x * amp;
            ctx.strokeStyle = ink; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(ax, ay);
            const coils = 12;
            for (let q = 0; q <= coils * 2; q++) ctx.lineTo(ax + ((bx - ax - 30 * env.unit) * q) / (coils * 2) + 15 * env.unit, ay + (q % 2 ? -1 : 1) * (q && q < coils * 2 ? env.sizes.body * 0.6 : 0));
            ctx.lineTo(bx, ay); ctx.stroke();
            roundRect(ctx, bx, ay - env.sizes.body * 1.2, env.sizes.body * 2.4, env.sizes.body * 2.4, env.unit * 6); ctx.fillStyle = acc; ctx.fill();
            // x(t) graph
            ctx.strokeStyle = toCss(ink, 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
            ctx.strokeStyle = acc; ctx.lineWidth = lw * 0.8; ctx.beginPath();
            const win = 10;
            for (let q = 0; q <= 200; q++) { const s = (q / 200) * Math.min(tt, win) + Math.max(0, tt - win); const X = gx + ((s - Math.max(0, tt - win)) / win) * gw, Y = gy - S(s)[0] * gh * 0.9; q ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
            ctx.stroke();
            if (showLabels) label(ctx, 'x(t)', gx, gy - gh - env.sizes.small * 0.5);
            ctx.restore();
          },
        };
      }
      case 'wave': case 'interference': {
        if (preset === 'interference') {
          const W = 320, H = Math.round(320 * (rect.h / rect.w));
          const cnv = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(W, H);
          cnv.width = W; cnv.height = H;
          const g2 = cnv.getContext('2d');
          const img = g2.createImageData(W, H);
          const sep = prm.separation ?? 0.22, lam = prm.wavelength ?? 0.06;
          const c1 = [0.5 - sep / 2, 0.08], c2 = [0.5 + sep / 2, 0.08];
          const col0 = [15, 16, 20], A = [88, 196, 221], B = [255, 210, 94];
          const parse = (h) => { const m = /^#?([0-9a-f]{6})/i.exec(h); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : null; };
          const bg = parse(p.bg) || col0, ca = parse(p.data[0]) || A, cb = parse(p.accent) || B;
          return {
            ...base,
            draw(ctx, t) {
              const tt = Math.max(0, t - intro);
              const a = clamp01(t / intro);
              for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const u = x / W, v = (y / H) * (rect.h / rect.w);
                const d1 = Math.hypot(u - c1[0], v - c1[1]), d2 = Math.hypot(u - c2[0], v - c2[1]);
                const reach = tt * 0.12;
                const w1 = d1 < reach ? Math.sin((d1 / lam - tt * 2.2) * TAU) / Math.sqrt(1 + d1 * 6) : 0;
                const w2 = d2 < reach ? Math.sin((d2 / lam - tt * 2.2) * TAU) / Math.sqrt(1 + d2 * 6) : 0;
                const s = (w1 + w2) * 0.5;
                const i = (y * W + x) * 4;
                const col = s > 0 ? cb : ca, k = Math.min(1, Math.abs(s) * 1.4) * a;
                img.data[i] = bg[0] + (col[0] - bg[0]) * k; img.data[i + 1] = bg[1] + (col[1] - bg[1]) * k; img.data[i + 2] = bg[2] + (col[2] - bg[2]) * k; img.data[i + 3] = 255;
              }
              g2.putImageData(img, 0, 0);
              ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
              roundRect(ctx, rect.x, rect.y, rect.w, rect.h, env.theme.shape.radius * env.unit); ctx.clip();
              ctx.drawImage(cnv, rect.x, rect.y, rect.w, rect.h);
              ctx.restore();
              for (const q of [c1, c2]) { ctx.beginPath(); ctx.arc(rect.x + q[0] * rect.w, rect.y + q[1] * rect.w, env.unit * 7, 0, TAU); ctx.fillStyle = p.ink; ctx.fill(); }
            },
          };
        }
        const A = prm.amplitude ?? 1, f = prm.frequency ?? 0.5, lam = prm.wavelength ?? 4;
        const P = plane(rect, [0, lam * 2.5, -A * 1.8, A * 1.8], false, env.sizes.body * 1.4);
        return {
          ...base,
          draw(ctx, t) {
            drawAxes(ctx, c, P, t, { grid: false, axes: { x: 'x', y: 'y' } });
            const tt = Math.max(0, t - intro);
            const y = (x) => A * Math.sin(TAU * (x / lam - f * tt)) * clamp01((tt * f * lam * 2 - x) / 1 + 1);
            ctx.save();
            ctx.strokeStyle = acc; ctx.lineWidth = lw; if (env.theme.chart.glow) { ctx.shadowColor = acc; ctx.shadowBlur = lw * 3; }
            ctx.beginPath(); for (let q = 0; q <= 300; q++) { const x = (q / 300) * P.x1; q ? ctx.lineTo(P.X(x), P.Y(y(x))) : ctx.moveTo(P.X(x), P.Y(y(x))); } ctx.stroke();
            ctx.shadowBlur = 0;
            for (let q = 0; q <= 24; q++) { const x = (q / 24) * P.x1; ctx.beginPath(); ctx.arc(P.X(x), P.Y(y(x)), env.unit * 5, 0, TAU); ctx.fillStyle = p.ink; ctx.fill(); }
            if (showLabels) {
              const x0 = lam * 0.25 + f * tt * lam;
              const xa = ((x0 % lam) + lam) % lam + 0, xb = xa + lam;
              if (xb < P.x1) { ctx.strokeStyle = toCss(p.ink, 0.6); ctx.lineWidth = 1.5; const yy = P.Y(A * 1.35); ctx.beginPath(); ctx.moveTo(P.X(xa), yy); ctx.lineTo(P.X(xb), yy); ctx.stroke(); label(ctx, 'λ', P.X((xa + xb) / 2), yy - env.sizes.small * 0.7, p.ink, 'center'); }
            }
            ctx.restore();
          },
        };
      }
      case 'random-walk': {
        const n = prm.walkers ?? 60, steps = prm.steps ?? 160;
        const r = rng('rw' + c.block.id);
        const paths = Array.from({ length: n }, () => { let y = 0; const out = [0]; for (let k = 0; k < steps; k++) { y += r() < 0.5 ? -1 : 1; out.push(y); } return out; });
        const spread = Math.sqrt(steps) * 3;
        const P = plane({ ...rect, w: rect.w * 0.78 }, [0, steps, -spread, spread], false, env.sizes.body);
        const dur = 6 * env.motion.tempo;
        return {
          duration: intro + dur, hold: 2,
          draw(ctx, t) {
            drawAxes(ctx, c, P, t, { grid: false, axes: { x: 'steps' } });
            const u = clamp01((t - intro) / dur), kmax = Math.floor(u * steps);
            ctx.save(); ctx.lineWidth = Math.max(1, env.unit * 1.4);
            paths.forEach((pp, i) => { ctx.strokeStyle = toCss(p.data[i % p.data.length], 0.45); ctx.beginPath(); for (let k = 0; k <= kmax; k++) (k ? ctx.lineTo(P.X(k), P.Y(pp[k])) : ctx.moveTo(P.X(k), P.Y(pp[k]))); ctx.stroke(); });
            // histogram of current positions
            const bins = new Map();
            paths.forEach((pp) => { const v = pp[kmax]; bins.set(v, (bins.get(v) || 0) + 1); });
            const hx = rect.x + rect.w * 0.82;
            for (const [v, cnt] of bins) { ctx.fillStyle = toCss(p.accent, 0.8); ctx.fillRect(hx, P.Y(v) - P.sy * 0.9, (cnt / n) * rect.w * 0.6, P.sy * 1.8); }
            ctx.restore();
          },
        };
      }
      default: {
        // simple pendulum with angle readout and θ(t) graph
        const g = prm.g ?? 9.81, len = prm.length ?? 1.6, damp = prm.damping ?? 0.08;
        const S = sampled((t, [th, w]) => [w, (-g / len) * Math.sin(th) - damp * w], [((prm.angle ?? 55) * Math.PI) / 180, 0], T);
        const L = Math.min(rect.h * 0.7, rect.w * 0.35);
        const ox = rect.x + rect.w * 0.3, oy = rect.y + rect.h * 0.1;
        const gx = rect.x + rect.w * 0.58, gw = rect.w * 0.4, gy = rect.y + rect.h * 0.55, gh = rect.h * 0.3;
        const th0 = ((prm.angle ?? 55) * Math.PI) / 180;
        return {
          ...base,
          draw(ctx, t) {
            const a = clamp01(t / intro);
            const tt = Math.max(0, t - intro);
            const th = S(tt)[0];
            ctx.save(); ctx.globalAlpha *= a;
            ctx.strokeStyle = toCss(ink, 0.25); ctx.setLineDash([env.unit * 5, env.unit * 6]); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + L * 1.05); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = toCss(ink, 0.6); ctx.fillRect(ox - env.sizes.body * 2, oy - env.unit * 6, env.sizes.body * 4, env.unit * 6);
            if (block.trail !== false) {
              ctx.strokeStyle = toCss(acc, 0.35); ctx.lineWidth = lw * 0.7;
              ctx.beginPath(); ctx.arc(ox, oy, L, Math.PI / 2 - th0, Math.PI / 2 + th0); ctx.stroke();
            }
            const bx = ox + Math.sin(th) * L, by = oy + Math.cos(th) * L;
            ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(bx, by); ctx.stroke();
            if (showLabels) {
              ctx.strokeStyle = acc; ctx.fillStyle = toCss(acc, 0.2); ctx.lineWidth = lw * 0.6;
              ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, L * 0.25, Math.PI / 2, Math.PI / 2 - th, th > 0); ctx.closePath(); ctx.fill(); ctx.stroke();
              label(ctx, `θ = ${((th * 180) / Math.PI).toFixed(1)}°`, ox + L * 0.3, oy + L * 0.2, acc);
            }
            const g2 = ctx.createRadialGradient(bx - env.sizes.body * 0.3, by - env.sizes.body * 0.3, 0, bx, by, env.sizes.body * 1.1);
            g2.addColorStop(0, mix(acc, '#ffffff', 0.5)); g2.addColorStop(1, acc);
            ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(bx, by, env.sizes.body * 1.0, 0, TAU); ctx.fill();
            // θ(t) graph
            ctx.strokeStyle = toCss(ink, 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx, gy - gh); ctx.lineTo(gx, gy + gh); ctx.stroke();
            ctx.strokeStyle = acc; ctx.lineWidth = lw * 0.8; ctx.beginPath();
            const win = 8;
            for (let q = 0; q <= 240; q++) { const s = (q / 240) * Math.min(tt, win) + Math.max(0, tt - win); const X = gx + ((s - Math.max(0, tt - win)) / win) * gw, Y = gy - (S(s)[0] / th0) * gh * 0.9; q ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
            ctx.stroke();
            if (showLabels) label(ctx, 'θ(t)', gx + env.unit * 8, gy - gh);
            ctx.restore();
          },
        };
      }
    }
  },
};

export default [equation, plot, geometry, transform, vectorfield, fourier, simulation];
