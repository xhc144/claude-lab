// The statement: continuous f: D -> D has x* with f(x*) = x*; dots move, then the displacement field.
import { W, C, FONT, clamp, lerp, ease, smooth, ramp, glowDot, ring, arrow, text, hexA, L, background, tex, drawTex, revealClip } from '../lib.js';

const CX = 1340, CY = 450, R = 330;
// f(z) = 0.78 e^{i(0.9 + 1.4|z|^2)} z + (0.16 - 0.10 i), |f| <= 0.97 < 1
export function f(x, y) {
  const r2 = x * x + y * y, th = 0.9 + 1.4 * r2;
  const c = Math.cos(th) * 0.78, s = Math.sin(th) * 0.78;
  return [c * x - s * y + 0.16, s * x + c * y - 0.10];
}
export function fixedPoint() {
  let best = [0, 0], bd = 1e9;
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
    const x = i / 20, y = j / 20;
    if (x * x + y * y > 1) continue;
    const [a, b] = f(x, y);
    const d = Math.hypot(a - x, b - y);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  let [x, y] = best;
  for (let it = 0; it < 30; it++) {
    const h = 1e-6;
    const [a, b] = f(x, y), rx = a - x, ry = b - y;
    const [a1, b1] = f(x + h, y), [a2, b2] = f(x, y + h);
    const j11 = (a1 - a) / h - 1, j21 = (b1 - b) / h, j12 = (a2 - a) / h, j22 = (b2 - b) / h - 1;
    const det = j11 * j22 - j12 * j21;
    x -= (j22 * rx - j12 * ry) / det;
    y -= (-j21 * rx + j11 * ry) / det;
  }
  return [x, y];
}
const S2 = (p) => [CX + p[0] * R, CY - p[1] * R];

let X, T1, T2, TD, DOTS, GRID;

export default {
  async init(S) {
    X = fixedPoint();
    T1 = await tex('f : D \\to D', C.ink, 50);
    T2 = await tex('\\exists\\, x^{*}\\in D:\\quad f(x^{*}) = x^{*}', C.gold, 50);
    TD = await tex('D', C.blue, 54);
    DOTS = [];
    for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) {
      const x = i / 16, y = j / 16;
      if (x * x + y * y <= 1) DOTS.push([x, y]);
    }
    GRID = [];
    for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) {
      const x = i / 9.3, y = j / 9.3;
      if (x * x + y * y <= 0.97) GRID.push([x, y]);
    }
  },
  draw(ctx, t, S) {
    background(ctx, 1000, 450);
    const zh = S.lang === 'zh';
    const c0 = S.cue(0), c1 = S.cue(1), c2 = S.cue(2), c3 = S.cue(3);
    const tf = zh ? FONT.zhSerif : FONT.serif;
    // left column
    const a0 = ramp(t, c0, 0.8);
    text(ctx, L(S.lang, "Brouwer's Fixed Point Theorem", '布劳威尔不动点定理'), 130, 190 - 16 * (1 - a0), { size: zh ? 62 : 58, weight: 600, font: tf, alpha: a0 });
    text(ctx, L(S.lang, 'L. E. J. Brouwer (1881–1966), Netherlands', 'L. E. J. 布劳威尔（1881–1966），荷兰'), 132, 246, { size: 28, color: C.dim, alpha: ramp(t, c0 + 0.5, 0.8), font: zh ? FONT.zh : FONT.sans });

    // D and B^n icons
    const a1 = ramp(t, c1 + 0.2, 0.7) * (1 - ramp(t, c2, 0.5));
    if (a1 > 0) {
      ctx.save(); ctx.globalAlpha = a1;
      const g1 = ctx.createRadialGradient(205, 370, 5, 205, 370, 52);
      g1.addColorStop(0, hexA(C.blue, 0.45)); g1.addColorStop(1, hexA(C.blue, 0.2));
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(205, 370, 50, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.blue; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      text(ctx, L(S.lang, 'closed disk (boundary included)', '闭圆盘（包含边界）'), 290, 380, { size: 32, alpha: a1, font: zh ? FONT.zh : FONT.sans });
      const a1b = ramp(t, c1 + 1.6, 0.7) * (1 - ramp(t, c2, 0.5));
      ctx.save(); ctx.globalAlpha = a1b;
      const g2 = ctx.createRadialGradient(188, 482, 4, 205, 500, 54);
      g2.addColorStop(0, '#cfe5ff'); g2.addColorStop(0.35, C.blue); g2.addColorStop(1, '#0f2a52');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(205, 500, 50, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      text(ctx, L(S.lang, 'solid ball, any dimension n', '任意维数 n 的实心闭球'), 290, 510, { size: 32, alpha: a1b, font: zh ? FONT.zh : FONT.sans });
    }
    // formula
    const af = ramp(t, c2 + 0.5, 0.8);
    if (af > 0) {
      const y0 = 420;
      drawTex(ctx, T1, 140, y0 - 30, { anchor: 'l', alpha: af });
      text(ctx, L(S.lang, 'continuous', '连续'), 140 + T1.w + 26, y0 - 14, { size: 40, color: C.dim, alpha: af, font: zh ? FONT.zh : FONT.serif });
      const ag = ramp(t, c2 + 2.4, 0.8);
      text(ctx, '⟹', 140, y0 + 82, { size: 48, color: C.dim, alpha: ag, font: FONT.serif });
      revealClip(ctx, 210, y0 + 20, 700, 120, ag, () => drawTex(ctx, T2, 222, y0 + 66, { anchor: 'l', glow: 'rgba(255,209,102,0.35)' }));
    }
    const note = ramp(t, c3 + 1.5, 0.8);
    text(ctx, L(S.lang, 'arrow:  x  →  f(x)', '箭头：x → f(x)'), 140, 660, { size: 34, color: C.dim, alpha: note, font: zh ? FONT.zh : FONT.serif });
    text(ctx, L(S.lang, 'one arrow has length 0', '总有一个箭头长度为 0'), 140, 712, { size: 34, color: C.gold, alpha: ramp(t, c3 + 3.4, 0.8), font: zh ? FONT.zh : FONT.serif, weight: 600 });

    // disk
    const dk = ramp(t, c1 + 0.1, 1.2);
    if (dk > 0) {
      ctx.save();
      const g = ctx.createRadialGradient(CX - 80, CY - 90, 20, CX, CY, R);
      g.addColorStop(0, hexA(C.blue, 0.16)); g.addColorStop(1, hexA(C.blue, 0.06));
      ctx.globalAlpha = smooth(dk);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = C.blue; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(CX, CY, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dk); ctx.stroke();
      ctx.restore();
      drawTex(ctx, TD, CX + R * 0.8, CY - R * 0.86, { alpha: ramp(t, c1 + 0.9, 0.6) });
    }
    // dots travel x -> f(x)
    const dotA = ramp(t, c2 + 0.6, 0.6) * (1 - ramp(t, c3 - 0.2, 0.6));
    if (dotA > 0) {
      const u = ramp(t, c2 + 1.6, 2.6) * (1 - ramp(t, c2 + 5.6, 1.6));
      for (const [x, y] of DOTS) {
        const [fx, fy] = f(x, y);
        const px = lerp(x, fx, u), py = lerp(y, fy, u);
        const hue = (Math.atan2(y, x) * 180) / Math.PI + 180;
        const light = 45 + 25 * Math.hypot(x, y);
        ctx.fillStyle = `hsla(${hue},75%,${light}%,${dotA})`;
        const [sx, sy] = S2([px, py]);
        ctx.beginPath(); ctx.arc(sx, sy, 4.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // displacement field
    const fa = ramp(t, c3 + 0.1, 1.0);
    if (fa > 0) {
      for (const [x, y] of GRID) {
        const [fx, fy] = f(x, y);
        const len = Math.hypot(fx - x, fy - y);
        // capped length: direction is exact, length grows with |f(x) - x| but saturates
        const k = (0.105 * (1 - Math.exp(-len / 0.35))) / (len || 1);
        const [sx, sy] = S2([x, y]), [ex, ey] = S2([x + (fx - x) * k, y + (fy - y) * k]);
        const hue = 260 - 220 * clamp(len / 1.4);
        const d = Math.hypot(x - X[0], y - X[1]);
        const appear = ramp(t, c3 + 0.1 + d * 1.1, 0.5);
        ctx.save();
        ctx.globalAlpha = fa * appear;
        arrow(ctx, sx, sy, ex, ey, { color: `hsl(${hue},80%,66%)`, width: 2.6, head: 10 });
        ctx.restore();
      }
      const xa = ramp(t, c3 + 2.6, 0.6);
      const [px, py] = S2(X);
      glowDot(ctx, px, py, 9, C.gold, xa, 5);
      ring(ctx, px, py, 22 + 7 * Math.sin(t * 4), C.gold, 3, xa);
      text(ctx, 'x*', px + 26, py - 20, { size: 38, font: FONT.serif, weight: 600, color: C.gold, alpha: xa, glow: 'rgba(0,0,0,0.9)' });
    }
  },
};
