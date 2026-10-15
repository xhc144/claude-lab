// One dimension: a continuous f:[0,1]->[0,1] must cross y = x (intermediate value theorem).
import { C, FONT, clamp, lerp, ease, smooth, ramp, glowDot, ring, arrow, text, hexA, L, background, tex, drawTex, strokePoly } from '../lib.js';

const X0 = 300, Y0 = 760, SIDE = 600;
const P = (x, y) => [X0 + x * SIDE, Y0 - y * SIDE];
const FS = [
  (x) => 0.78 - 0.45 * x + 0.12 * Math.sin(9 * x),
  (x) => 0.5 + 0.42 * Math.sin(7 * x + 0.8),
  (x) => 0.12 + 0.82 * x * x + 0.04 * Math.sin(14 * x),
];
let TG, TS, TC;

function curveAt(t, S) {
  const c3 = S.cue(3);
  const u1 = ramp(t, c3 + 3.0, 1.4), u2 = ramp(t, c3 + 5.2, 1.4);
  return (x) => {
    const a = lerp(FS[0](x), FS[1](x), u1);
    return lerp(a, FS[2](x), u2);
  };
}

function crossings(f) {
  const out = [];
  const n = 600;
  let px = 0, pg = f(0) - 0;
  for (let i = 1; i <= n; i++) {
    const x = i / n, g = f(x) - x;
    if (pg === 0) out.push(px);
    else if (pg * g < 0) {
      let a = px, b = x;
      for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if ((f(a) - a) * (f(m) - m) <= 0) b = m; else a = m; }
      out.push((a + b) / 2);
    }
    px = x; pg = g;
  }
  return out;
}

export default {
  async init() {
    TG = await tex('g(x) = f(x) - x', C.ink, 46);
    TS = await tex('g(0) \\ge 0, \\qquad g(1) \\le 0', C.ink, 46);
    TC = await tex('\\Longrightarrow\\ \\ \\exists\\, c:\\ g(c) = 0,\\ \\ f(c) = c', C.gold, 46);
  },
  draw(ctx, t, S) {
    background(ctx, 800, 450);
    const zh = S.lang === 'zh';
    const c0 = S.cue(0), c1 = S.cue(1), c2 = S.cue(2), c3 = S.cue(3);
    const font = zh ? FONT.zh : FONT.sans;
    // disk flattens into [0,1]
    const flat = ramp(t, c0 + 0.3, 1.6);
    const show = 1 - ramp(t, c1 + 0.6, 0.6);
    if (show > 0) {
      const cx = X0 + SIDE / 2, cy = lerp(450, Y0, flat);
      ctx.save();
      ctx.globalAlpha = show;
      ctx.fillStyle = hexA(C.blue, 0.15 * (1 - flat));
      ctx.strokeStyle = C.blue; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, lerp(220, SIDE / 2, flat), Math.max(0.5, 220 * (1 - flat)), 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // axes and square
    const ax = ramp(t, c1 + 0.2, 1.0);
    if (ax > 0) {
      ctx.save();
      ctx.globalAlpha = ax;
      ctx.strokeStyle = hexA(C.dim, 0.5); ctx.lineWidth = 2;
      ctx.strokeRect(X0, Y0 - SIDE, SIDE, SIDE);
      ctx.strokeStyle = C.blue; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X0 + SIDE, Y0); ctx.stroke();
      ctx.restore();
      text(ctx, '0', X0, Y0 + 44, { size: 32, align: 'center', color: C.dim, alpha: ax, font: FONT.serif });
      text(ctx, '1', X0 + SIDE, Y0 + 44, { size: 32, align: 'center', color: C.dim, alpha: ax, font: FONT.serif });
      text(ctx, '1', X0 - 26, Y0 - SIDE + 10, { size: 32, align: 'center', color: C.dim, alpha: ax, font: FONT.serif });
      // diagonal
      const dg = ramp(t, c1 + 0.8, 1.0);
      ctx.save();
      ctx.globalAlpha = ax;
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = hexA(C.ink, 0.7); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(dg, dg)); ctx.stroke();
      ctx.restore();
      text(ctx, 'y = x', ...P(0.86, 0.95), { size: 32, font: FONT.serif, color: C.ink, alpha: dg, align: 'right' });
    }
    // curve
    const f = curveAt(t, S);
    const draw = ramp(t, c1 + 1.6, 2.2);
    if (draw > 0) {
      // sign of g: shade between the curve and the diagonal
      const sh = ramp(t, c2 + 0.6, 0.8);
      if (sh > 0) {
        for (let i = 0; i < 300; i++) {
          const xa = i / 300, xb = (i + 1) / 300;
          const g = f((xa + xb) / 2) - (xa + xb) / 2;
          ctx.fillStyle = hexA(g > 0 ? C.green : C.red, 0.2 * sh);
          ctx.beginPath();
          ctx.moveTo(...P(xa, xa)); ctx.lineTo(...P(xb, xb)); ctx.lineTo(...P(xb, f(xb))); ctx.lineTo(...P(xa, f(xa)));
          ctx.closePath(); ctx.fill();
        }
      }
      const pts = [];
      const n = Math.max(2, Math.floor(400 * draw));
      for (let i = 0; i <= n; i++) { const x = (i / 400); pts.push(P(x, f(x))); }
      strokePoly(ctx, pts, { color: C.cyan, width: 6, glow: hexA(C.cyan, 0.6) });
      const la = ramp(t, c1 + 3.0, 0.6);
      ctx.save(); ctx.globalAlpha = la; ctx.strokeStyle = C.cyan; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X0 + 4, Y0 - SIDE - 34); ctx.lineTo(X0 + 54, Y0 - SIDE - 34); ctx.stroke(); ctx.restore();
      text(ctx, 'y = f(x)', X0 + 70, Y0 - SIDE - 23, { size: 32, font: FONT.serif, color: C.cyan, alpha: la });
    }
    // endpoint conditions
    const e = ramp(t, c2 + 0.2, 0.6);
    if (e > 0) {
      const [lx, ly] = P(0, f(0)), [rx, ry] = P(1, f(1));
      glowDot(ctx, lx, ly, 9, C.green, e);
      glowDot(ctx, rx, ry, 9, C.red, ramp(t, c2 + 1.4, 0.6));
      text(ctx, 'f(0) ≥ 0', lx - 24, ly + 10, { size: 32, align: 'right', font: FONT.serif, color: C.green, alpha: e });
      text(ctx, 'f(1) ≤ 1', rx + 24, ry + 10, { size: 32, font: FONT.serif, color: C.red, alpha: ramp(t, c2 + 1.4, 0.6) });
      const ab = 1 - ramp(t, c3 + 2.4, 0.6);
      text(ctx, L(S.lang, 'above y = x', '在对角线上方'), lx + 26, ly - 30, { size: 26, color: C.green, alpha: e * 0.9 * ab, font });
      text(ctx, L(S.lang, 'below y = x', '在对角线下方'), rx - 26, ry + 66, { size: 26, color: C.red, alpha: ramp(t, c2 + 1.4, 0.6) * 0.9 * ab, font, align: 'right' });
    }
    // crossings
    const cr = ramp(t, c3 + 1.0, 0.5);
    if (cr > 0) {
      for (const x of crossings(f)) {
        const [px, py] = P(x, x);
        glowDot(ctx, px, py, 10, C.gold, cr, 4);
        ring(ctx, px, py, 22 + 6 * Math.sin(t * 4), C.gold, 3, cr);
      }
    }
    // right panel
    const tx = 1060;
    const r1 = ramp(t, c2 + 2.4, 0.7), r2 = ramp(t, c2 + 3.4, 0.7), r3 = ramp(t, c3 + 1.2, 0.7);
    drawTex(ctx, TG, tx, 300, { anchor: 'l', alpha: r1 });
    drawTex(ctx, TS, tx, 390, { anchor: 'l', alpha: r2 });
    drawTex(ctx, TC, tx, 480, { anchor: 'l', alpha: r3, glow: 'rgba(255,209,102,0.3)' });
    const r4 = ramp(t, c3 + 4.0, 0.8);
    text(ctx, L(S.lang, 'Intermediate Value Theorem', '介值定理'), tx, 600, { size: zh ? 52 : 50, weight: 700, color: C.gold, alpha: r4, font: zh ? FONT.zhSerif : FONT.serif });
    text(ctx, L(S.lang, 'Brouwer in dimension 1', '一维的布劳威尔定理'), tx, 652, { size: 32, color: C.dim, alpha: r4, font });
    text(ctx, L(S.lang, 'one dimension', '一维'), tx, 200, { size: 40, weight: 600, color: C.dim, alpha: ramp(t, c0, 0.6) * (1 - ramp(t, c2 + 2.0, 0.5)), font });
  },
};
