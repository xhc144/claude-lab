// Title card: a slowly turning vector field whose arrows all vanish at one golden point.
import { W, C, FONT, background, text, arrow, glowDot, ring, ramp, easeOut, tex, drawTex, hexA, L } from '../lib.js';

let F;
const CX = 960, CY = 480, RAD = 360;

export default {
  async init(S) {
    F = await tex('f(x^{*}) = x^{*}', C.gold, 64);
  },
  draw(ctx, t, S) {
    background(ctx, CX, CY);
    const zh = S.lang === 'zh';
    // background field: rotation + contraction toward the centre point
    const fieldA = ramp(t, 0, 1.2) * 0.32;
    const th = 1.15 + 0.25 * Math.sin(t * 0.5);
    for (let gx = -RAD; gx <= RAD; gx += 48) {
      for (let gy = -RAD; gy <= RAD; gy += 48) {
        const r = Math.hypot(gx, gy);
        if (r > RAD || r < 30) continue;
        const vx = -(Math.cos(th) * gx - Math.sin(th) * gy) * 0.13;
        const vy = -(Math.sin(th) * gx + Math.cos(th) * gy) * 0.13;
        arrow(ctx, CX + gx, CY + gy, CX + gx + vx, CY + gy + vy, {
          color: C.blue, width: 2, head: 8, alpha: fieldA * (1 - r / RAD * 0.6),
        });
      }
    }
    ring(ctx, CX, CY, RAD + 10, hexA(C.blue, 0.25), 2, ramp(t, 0, 1));
    const g = ramp(t, 0.5, 1.0, easeOut);
    glowDot(ctx, CX, CY, 9, C.gold, g, 5);
    ring(ctx, CX, CY, 20 + 26 * ((t * 0.7) % 1), C.gold, 2, g * (1 - ((t * 0.7) % 1)));

    const a1 = ramp(t, 0.3, 0.9), a2 = ramp(t, 0.9, 0.9), a3 = ramp(t, 1.5, 0.9);
    const rise = (a) => (1 - a) * 24;
    if (zh) {
      text(ctx, '布劳威尔不动点定理', W / 2, 290 + rise(a1), { size: 104, weight: 700, font: FONT.zhSerif, align: 'center', alpha: a1, glow: 'rgba(0,0,0,0.8)', glowBlur: 30 });
      text(ctx, "Brouwer's Fixed Point Theorem", W / 2, 365 + rise(a2), { size: 42, font: FONT.serif, align: 'center', color: C.dim, alpha: a2 });
      text(ctx, '圆盘到自身的连续映射，一定有不动点', W / 2, 640 + rise(a3), { size: 36, font: FONT.zh, align: 'center', color: C.ink, alpha: a3 });
    } else {
      text(ctx, "Brouwer's Fixed Point Theorem", W / 2, 300 + rise(a1), { size: 96, weight: 600, font: FONT.serif, align: 'center', alpha: a1, glow: 'rgba(0,0,0,0.8)', glowBlur: 30 });
      text(ctx, 'L. E. J. Brouwer · c. 1910', W / 2, 365 + rise(a2), { size: 36, font: FONT.serif, align: 'center', color: C.dim, alpha: a2 });
      text(ctx, 'Every continuous map of a disk to itself has a fixed point.', W / 2, 640 + rise(a3), { size: 36, font: FONT.serif, align: 'center', color: C.ink, alpha: a3 });
    }
    drawTex(ctx, F, W / 2, 735 + rise(a3), { alpha: a3, glow: 'rgba(255,209,102,0.35)' });
  },
};
