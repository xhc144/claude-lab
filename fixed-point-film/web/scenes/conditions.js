// Why each hypothesis matters: an annulus, an open interval, a jump.
import { C, FONT, clamp, lerp, ease, smooth, ramp, glowDot, ring, arrow, text, hexA, L, background, panel, crossBadge, tex, drawTex } from '../lib.js';

const PX = [360, 960, 1560], PY = 140, PWD = 540, PHT = 600;
let TA, TB, TC;

export default {
  async init() {
    TA = await tex('x \\mapsto R_{\\theta}\\, x', C.dim, 36);
    TB = await tex('f(x) = \\tfrac{x}{2},\\quad x \\in (0,1)', C.dim, 36);
    TC = await tex('f(x) = \\begin{cases} 0.8 & x < \\tfrac12 \\\\ 0.2 & x \\ge \\tfrac12 \\end{cases}', C.dim, 32);
  },
  draw(ctx, t, S) {
    background(ctx);
    const zh = S.lang === 'zh';
    const font = zh ? FONT.zh : FONT.sans;
    const c0 = S.cue(0), c1 = S.cue(1), c2 = S.cue(2), c3 = S.cue(3), c4 = S.cue(4);
    const title = ramp(t, c0, 0.6);
    text(ctx, L(S.lang, 'Every condition matters', '每个条件都不可或缺'), 960, 96, { size: 46, weight: 700, align: 'center', alpha: title, font: zh ? FONT.zhSerif : FONT.serif });
    const caps = [L(S.lang, 'a hole', '有洞'), L(S.lang, 'no boundary', '没有边界'), L(S.lang, 'a jump', '不连续')];
    const starts = [c1, c2, c3];
    const nofix = L(S.lang, 'no fixed point', '没有不动点');
    for (let k = 0; k < 3; k++) {
      const a = ramp(t, starts[k] - 0.1, 0.6);
      if (a <= 0) continue;
      const x0 = PX[k] - PWD / 2;
      panel(ctx, x0, PY, PWD, PHT, a);
      text(ctx, caps[k], PX[k], PY + 64, { size: 40, weight: 700, align: 'center', alpha: a, font });
      crossBadge(ctx, PX[k] - 110, PY + PHT - 52, nofix, ramp(t, starts[k] + 2.0, 0.5));
    }
    // (a) annulus under rotation
    const aA = ramp(t, c1 - 0.1, 0.6);
    if (aA > 0) {
      const cx = PX[0], cy = PY + 270, ro = 160, ri = 66;
      ctx.save();
      ctx.globalAlpha = aA;
      ctx.fillStyle = hexA(C.blue, 0.2);
      ctx.beginPath(); ctx.arc(cx, cy, ro, 0, Math.PI * 2); ctx.arc(cx, cy, ri, 0, Math.PI * 2, true); ctx.fill('evenodd');
      ctx.strokeStyle = C.blue; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, ro, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      const spin = 0.8 * Math.max(0, t - c1 - 0.6);
      for (const [rr, n] of [[84, 10], [108, 13], [132, 16], [152, 19]]) {
        for (let j = 0; j < n; j++) {
          const ang = (j / n) * Math.PI * 2 + spin + rr;
          const x = cx + rr * Math.cos(ang), y = cy + rr * Math.sin(ang);
          ctx.fillStyle = hexA(C.cyan, 0.9 * aA);
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
          if (j % 3 === 0 && rr > 90) {
            const l = 0.28;
            arrow(ctx, x, y, x - rr * l * Math.sin(ang), y + rr * l * Math.cos(ang), { color: C.ink, width: 2, head: 8, alpha: 0.7 * aA * ramp(t, c1 + 0.8, 0.5) });
          }
        }
      }
      drawTex(ctx, TA, cx, PY + PHT - 128 + 8, { alpha: aA });
    }
    // (b) open interval, f(x) = x/2
    const aB = ramp(t, c2 - 0.1, 0.6);
    if (aB > 0) {
      const xa = PX[1] - 200, xb = PX[1] + 200, y = PY + 280;
      ctx.save();
      ctx.globalAlpha = aB;
      ctx.strokeStyle = C.blue; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(xa + 10, y); ctx.lineTo(xb - 10, y); ctx.stroke();
      ctx.restore();
      ring(ctx, xa, y, 10, C.blue, 3, aB);
      ring(ctx, xb, y, 10, C.blue, 3, aB);
      text(ctx, '0', xa, y + 52, { size: 32, align: 'center', color: C.dim, alpha: aB, font: FONT.serif });
      text(ctx, '1', xb, y + 52, { size: 32, align: 'center', color: C.dim, alpha: aB, font: FONT.serif });
      text(ctx, L(S.lang, 'endpoints removed', '端点被去掉'), PX[1], y - 70, { size: 26, align: 'center', color: C.dim, alpha: aB, font });
      const tau = 1.1 * Math.max(0, t - c2 - 0.7);
      for (let k = 1; k <= 9; k++) {
        const u0 = k / 10;
        const u = u0 * Math.pow(2, -tau);
        const x = lerp(xa, xb, u);
        glowDot(ctx, x, y, 6, C.cyan, aB, 2.2);
        if (u > 0.02) arrow(ctx, x, y - 22, x - Math.min(36, (u / 2) * 400), y - 22, { color: C.ink, width: 2, head: 7, alpha: 0.6 * aB });
      }
      ring(ctx, xa, y, 16 + 4 * Math.sin(t * 5), C.red, 2, aB * ramp(t, c2 + 2.2, 0.5));
      drawTex(ctx, TB, PX[1], PY + PHT - 128 + 8, { alpha: aB });
    }
    // (c) a jump over the diagonal
    const aC = ramp(t, c3 - 0.1, 0.6);
    if (aC > 0) {
      const s = 250, x0 = PX[2] - s / 2, y0 = PY + 145 + s;
      const P = (x, y) => [x0 + x * s, y0 - y * s];
      ctx.save();
      ctx.globalAlpha = aC;
      ctx.strokeStyle = hexA(C.dim, 0.5); ctx.lineWidth = 2; ctx.strokeRect(x0, y0 - s, s, s);
      ctx.setLineDash([9, 8]); ctx.strokeStyle = hexA(C.ink, 0.7); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(1, 1)); ctx.stroke();
      ctx.setLineDash([]);
      const d = ramp(t, c3 + 0.4, 1.2);
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(...P(0, 0.8)); ctx.lineTo(...P(Math.min(0.5, d), 0.8)); ctx.stroke();
      if (d > 0.5) { ctx.beginPath(); ctx.moveTo(...P(0.5, 0.2)); ctx.lineTo(...P(d, 0.2)); ctx.stroke(); }
      ctx.restore();
      if (d > 0.5) {
        ctx.save(); ctx.globalAlpha = aC; ctx.setLineDash([4, 6]); ctx.strokeStyle = C.red; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(...P(0.5, 0.78)); ctx.lineTo(...P(0.5, 0.22)); ctx.stroke(); ctx.restore();
        ring(ctx, ...P(0.5, 0.8), 8, C.cyan, 3, aC);
        glowDot(ctx, ...P(0.5, 0.2), 7, C.cyan, aC, 1.5);
      }
      drawTex(ctx, TC, PX[2], PY + PHT - 128 + 8, { alpha: aC });
    }
    // what the theorem needs
    const chips = zh ? ['封闭', '有界', '没有洞', '连续'] : ['closed', 'bounded', 'no holes', 'continuous'];
    const wch = 300, gap = 30, total = chips.length * wch + (chips.length - 1) * gap;
    chips.forEach((c, k) => {
      const a = ramp(t, c4 + 0.3 + 0.55 * k, 0.5);
      if (a <= 0) return;
      const x = 960 - total / 2 + k * (wch + gap);
      const y = 768 + (1 - a) * 20;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = hexA(C.green, 0.14); ctx.strokeStyle = hexA(C.green, 0.8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, wch, 64, 32); ctx.fill(); ctx.stroke();
      ctx.restore();
      text(ctx, '✓  ' + c, x + wch / 2, y + 44, { size: 34, weight: 600, align: 'center', color: C.green, alpha: a, font });
    });
  },
};
