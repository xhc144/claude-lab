// Closing: existence vs construction, then back to the coffee cup.
import { W, C, FONT, clamp, lerp, ease, smooth, ramp, glowDot, ring, arrow, text, hexA, L, background, tex, drawTex } from '../lib.js';
import { f as fDisk, fixedPoint } from './statement.js';
import { initCoffee, paintCup, STAGES } from './coffee.js';

const CX = 560, CY = 440, R = 300;
let XS, TE;

export default {
  async init() {
    initCoffee();
    XS = fixedPoint();
    TE = await tex('\\exists\\, x^{*}:\\ f(x^{*}) = x^{*}', C.gold, 50);
  },
  draw(ctx, t, S) {
    const zh = S.lang === 'zh';
    const font = zh ? FONT.zh : FONT.sans;
    const tf = zh ? FONT.zhSerif : FONT.serif;
    const [c0, c1, c2, c3, c4, c5] = Array.from({ length: 6 }, (_, i) => S.cue(i));
    const toCup = ramp(t, c5 - 0.2, 1.2);
    if (toCup < 1) {
      background(ctx, 800, 450);
      // the field with its fixed point hidden behind a question mark
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hexA(C.blue, 0.08); ctx.strokeStyle = hexA(C.blue, 0.8); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) {
        const x = i / 9.4, y = j / 9.4;
        if (x * x + y * y > 0.95) continue;
        const [fx, fy] = fDisk(x, y);
        const sx = CX + x * R, sy = CY - y * R;
        const len = Math.hypot(fx - x, fy - y), L2 = 34 * (1 - Math.exp(-len / 0.35)) / (len || 1);
        arrow(ctx, sx, sy, sx + (fx - x) * L2, sy - (fy - y) * L2, { color: hexA(C.ink, 0.45), width: 2, head: 8 });
      }
      const q = ramp(t, c0 + 0.6, 0.6);
      const [px, py] = [CX + XS[0] * R, CY - XS[1] * R];
      const wobble = Math.sin(t * 2.2) * 40;
      text(ctx, '?', CX + wobble * 0.3, CY + 50, { size: 220, weight: 700, align: 'center', color: C.gold, alpha: q * 0.9, font: FONT.serif, glow: 'rgba(0,0,0,0.8)', glowBlur: 30 });
      // right column
      const RX = 1000;
      drawTex(ctx, TE, RX, 200, { anchor: 'l', alpha: ramp(t, c0 + 0.2, 0.6) });
      text(ctx, L(S.lang, '…but where?', '……但在哪里？'), RX, 290, { size: 44, weight: 600, alpha: ramp(t, c0 + 1.6, 0.6), font, color: C.ink });
      // stamp
      const st = ramp(t, c1 + 0.1, 0.35, ease);
      if (st > 0) {
        ctx.save();
        ctx.translate(RX + 250, 400);
        ctx.rotate(-0.08);
        ctx.scale(1.6 - 0.6 * st, 1.6 - 0.6 * st);
        ctx.globalAlpha = st;
        ctx.strokeStyle = C.red; ctx.lineWidth = 5;
        ctx.strokeRect(-240, -44, 480, 88);
        ctx.restore();
        ctx.save();
        ctx.translate(RX + 250, 400);
        ctx.rotate(-0.08);
        ctx.scale(1.6 - 0.6 * st, 1.6 - 0.6 * st);
        text(ctx, L(S.lang, 'EXISTENCE PROOF', '存在性证明'), 0, 16, { size: 46, weight: 700, align: 'center', color: C.red, alpha: st, font, spacing: zh ? 8 : 4 });
        ctx.restore();
      }
      const b = ramp(t, c2 + 0.3, 0.7);
      text(ctx, L(S.lang, 'L. E. J. Brouwer → intuitionism', 'L. E. J. 布劳威尔 → 直觉主义'), RX, 540, { size: 36, weight: 600, alpha: b, font: tf });
      text(ctx, L(S.lang, '“to exist” must mean “can be constructed”', '“存在” 必须意味着 “能被构造出来”'), RX, 592, { size: 30, alpha: ramp(t, c3 + 0.2, 0.7), font, color: C.dim });
      const cs = ramp(t, c4 + 0.3, 0.7);
      text(ctx, L(S.lang, 'Computing fixed points: PPAD-complete', '计算不动点：PPAD 完全问题'), RX, 690, { size: 30, alpha: cs, font, color: C.cyan, weight: 600 });
      text(ctx, L(S.lang, 'Papadimitriou 1994 · Nash: Chen–Deng, DGP 2006', 'Papadimitriou 1994 · 纳什均衡：陈汐–邓小铁、DGP 2006'), RX, 736, { size: 24, alpha: cs, font, color: C.dim });
    }
    if (toCup > 0) {
      ctx.save();
      ctx.globalAlpha = toCup;
      const s = STAGES.map(() => 1);
      const CXc = 960, CYc = 440;
      const z = 1 + 0.05 * ramp(t, c5, S.dur - c5);
      ctx.translate(CXc, CYc); ctx.scale(z, z); ctx.translate(-CXc, -CYc);
      paintCup(ctx, s, { ghost: 0, fix: ramp(t, c5 + 1.0, 0.8), label: 0, time: t, lang: S.lang });
      ctx.restore();
      // end card
      const e = ramp(t, S.end(5) + 0.8, 1.0);
      if (e > 0) {
        ctx.fillStyle = `rgba(5,7,15,${0.86 * e})`;
        ctx.fillRect(0, 0, W, 1080);
        text(ctx, L(S.lang, "Brouwer's Fixed Point Theorem", '布劳威尔不动点定理'), 960, 420, { size: zh ? 84 : 76, weight: 700, align: 'center', font: tf, alpha: e });
        drawTex(ctx, TE, 960, 520, { alpha: e });
        text(ctx, L(S.lang, 'There is always a point that stays.', '总有一点，始终不动。'), 960, 620, { size: 36, align: 'center', font: zh ? FONT.zh : FONT.serif, color: C.dim, alpha: ramp(t, S.end(5) + 1.6, 1.0) });
      }
    }
  },
};
