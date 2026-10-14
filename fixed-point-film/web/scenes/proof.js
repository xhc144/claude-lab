// Sperner => Brouwer: label each vertex by the corner its arrow moves away from most; refine; rainbow
// triangles close in on the fixed point.
import { C, RGB, FONT, clamp, lerp, ease, smooth, ramp, glowDot, ring, arrow, text, hexA, L, background, tex, drawTex } from '../lib.js';
import { A, B, CC, grid, isRainbow } from './tri.js';

// f(λ) = Σ w_k(λ) Q_k with w_k ∝ λ_k^p: continuous, and maps the triangle into the hull of the Q_k.
const Q = [[0.22, 0.58, 0.20], [0.58, 0.12, 0.30], [0.74, 0.20, 0.06]];
const PW = 1.6;
export function fb(l) {
  const w = l.map((x) => Math.pow(Math.max(x, 0), PW));
  const s = w[0] + w[1] + w[2];
  return [0, 1, 2].map((i) => (w[0] * Q[0][i] + w[1] * Q[1][i] + w[2] * Q[2][i]) / s);
}
const toXY = (l) => [l[0] * A[0] + l[1] * B[0] + l[2] * CC[0], l[0] * A[1] + l[1] * B[1] + l[2] * CC[1]];
const label = (l) => {
  const fl = fb(l);
  let bi = 0, bv = -Infinity;
  for (let i = 0; i < 3; i++) if (l[i] - fl[i] > bv) { bv = l[i] - fl[i]; bi = i; }
  return bi;
};

let LEVELS, FIX, FIXXY, EX, TF1, TF2, TF3;

function solveFixed() {
  let best = [1 / 3, 1 / 3, 1 / 3], bd = Infinity;
  for (let i = 0; i <= 120; i++) for (let j = 0; i + j <= 120; j++) {
    const l = [1 - (i + j) / 120, i / 120, j / 120];
    const fl = fb(l), d = Math.hypot(fl[1] - l[1], fl[2] - l[2]);
    if (d < bd) { bd = d; best = l; }
  }
  let [, u, v] = best;
  for (let it = 0; it < 40; it++) {
    const F = (a, b) => { const r = fb([1 - a - b, a, b]); return [r[1] - a, r[2] - b]; };
    const h = 1e-7, [r1, r2] = F(u, v), [a1, a2] = F(u + h, v), [b1, b2] = F(u, v + h);
    const j11 = (a1 - r1) / h, j21 = (a2 - r2) / h, j12 = (b1 - r1) / h, j22 = (b2 - r2) / h;
    const det = j11 * j22 - j12 * j21;
    u -= (j22 * r1 - j12 * r2) / det;
    v -= (-j21 * r1 + j11 * r2) / det;
  }
  return [1 - u - v, u, v];
}

export default {
  async init(S) {
    FIX = solveFixed();
    FIXXY = toXY(FIX);
    LEVELS = [8, 16, 32, 64].map((n) => {
      const g = grid(n);
      const col = [];
      for (const v of g.verts) if (v) col[v.id] = label(v.bary);
      const rainbow = g.tris.map((_, k) => k).filter((k) => isRainbow(g, col, k));
      return { n, g, col, rainbow };
    });
    // example vertex for the explanation: an interior vertex of the coarse grid, far from the fixed point
    const g8 = LEVELS[0].g;
    EX = g8.verts[g8.id(2, 4)];
    window.PROOF = { fixed: FIX, rainbow: LEVELS.map((l) => l.rainbow.length) };
    TF1 = await tex('f(x^{*})_i \\le x^{*}_i \\quad (i = 1,2,3)', C.ink, 42);
    TF2 = await tex('\\textstyle\\sum_i f(x^{*})_i = \\sum_i x^{*}_i = 1', C.ink, 42);
    TF3 = await tex('\\Longrightarrow\\quad f(x^{*}) = x^{*}', C.gold, 48);
  },
  draw(ctx, t, S) {
    background(ctx, 800, 450);
    const zh = S.lang === 'zh';
    const font = zh ? FONT.zh : FONT.sans;
    const [c0, c1, c2, c3, c4, c5, c6, c7] = Array.from({ length: 8 }, (_, i) => S.cue(i));
    const lvlT = [c4 + 0.3, c4 + 1.7, c4 + 3.1];      // refine 8→16→32→64
    const lvl = lvlT.filter((x) => t >= x).length;
    const zoomTarget = [1, 1.5, 2.6, 4.2];
    let zoom = 1;
    for (let k = 0; k < 3; k++) zoom = lerp(zoom, zoomTarget[k + 1], ramp(t, lvlT[k], 1.3));
    zoom = lerp(zoom, 1, ramp(t, c7 - 0.2, 1.6));
    const zu = (zoom - 1) / 3.2;
    const camX = lerp(0, 610 - FIXXY[0], clamp(zu * 3)), camY = lerp(0, 470 - FIXXY[1], clamp(zu * 3));

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, 1210, 1080); ctx.clip();
    ctx.translate(FIXXY[0] + camX, FIXXY[1] + camY);
    ctx.scale(zoom, zoom);
    ctx.translate(-FIXXY[0], -FIXXY[1]);
    const px = 1 / zoom;

    // big triangle
    ctx.save();
    ctx.fillStyle = 'rgba(120,140,200,0.06)';
    ctx.strokeStyle = 'rgba(210,220,255,0.85)'; ctx.lineWidth = 3 * px;
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...CC); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    const colourOn = ramp(t, c1 + 1.6, 2.4, (x) => x);
    const rainbowOn = ramp(t, c3 + 0.4, 0.6);
    for (let li = 0; li < LEVELS.length; li++) {
      const fadeIn = li === 0 ? 1 : ramp(t, lvlT[li - 1], 0.6);
      const fadeOut = li === LEVELS.length - 1 ? 1 : 1 - ramp(t, lvlT[li], 0.6);
      let a = Math.min(fadeIn, fadeOut);
      if (li === 0) a = Math.max(a, ramp(t, c7 - 0.2, 1.2));     // back to the coarse view at the end
      if (li === LEVELS.length - 1) a *= 1 - ramp(t, c7 - 0.2, 1.2);
      if (a <= 0) continue;
      const { n, g, col, rainbow } = LEVELS[li];
      // edges
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(150,165,210,0.35)';
      ctx.lineWidth = (li === 0 ? 2 : 1.4) * px;
      ctx.beginPath();
      for (const e of g.edges.values()) {
        const p = g.verts[e.a], q = g.verts[e.b];
        ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      // rainbow triangles
      if (rainbowOn > 0) for (const k of rainbow) {
        const [p, q, r] = g.tris[k].map((v) => g.verts[v]);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.lineTo(r.x, r.y); ctx.closePath();
        ctx.fillStyle = `rgba(255,236,170,${0.38 * rainbowOn})`;
        ctx.shadowColor = C.gold; ctx.shadowBlur = 20;
        ctx.fill();
        ctx.strokeStyle = hexA(C.gold, rainbowOn); ctx.lineWidth = 3 * px; ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      // vertices + arrows
      const arrowsA = li === 0 ? ramp(t, c0 + 1.2, 1.0) * (1 - 0.55 * ramp(t, c3 + 0.4, 0.6)) : 0;
      for (const v of g.verts) {
        if (!v) continue;
        const order = (v.i + v.j * 0.7) / (n * 1.7);
        const coloured = li > 0 ? 1 : clamp(colourOn * 1.6 - order);
        const c = col[v.id];
        const colr = coloured > 0.5 ? RGB[c] : '#c9d2ee';
        if (arrowsA > 0) {
          const fl = fb(v.bary);
          const [x1, y1] = toXY(fl);
          const k = 0.32;
          arrow(ctx, v.x, v.y, v.x + (x1 - v.x) * k, v.y + (y1 - v.y) * k, { color: colr, width: 2.6, head: 11, alpha: a * arrowsA * 0.9 });
        }
        const r = (li === 0 ? 8 : li === 1 ? 5.5 : li === 2 ? 3.6 : 2.6) * (li > 0 ? 1 / Math.max(1, zoom / zoomTarget[li]) : 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = colr;
        ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // corners
    [[A, 0], [B, 1], [CC, 2]].forEach(([p, c]) => glowDot(ctx, p[0], p[1], 16 * px, RGB[c], 1, 3));

    // example vertex: barycentric coordinates before / after
    const exA = ramp(t, c1 + 0.2, 0.5) * (1 - ramp(t, c2 + 0.2, 0.6));
    if (exA > 0) {
      ring(ctx, EX.x, EX.y, 22, '#ffffff', 3, exA);
      for (let i = 0; i < 3; i++) {
        const corner = [A, B, CC][i];
        ctx.save(); ctx.globalAlpha = exA * 0.5; ctx.setLineDash([6, 8]); ctx.strokeStyle = RGB[i]; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(EX.x, EX.y); ctx.lineTo(...corner); ctx.stroke(); ctx.restore();
      }
    }
    // side labels: the missing coordinate is 0 and cannot decrease
    const sideA = ramp(t, c2 + 0.3, 0.6) * (1 - ramp(t, c3 + 0.2, 0.6));
    if (sideA > 0) {
      const sides = [[A, B, 2], [A, CC, 1], [B, CC, 0]];
      sides.forEach(([p, q, missing], k) => {
        const a = sideA * ramp(t, c2 + 0.3 + 0.4 * k, 0.5);
        const g = ctx.createLinearGradient(p[0], p[1], q[0], q[1]);
        const ends = [0, 1, 2].filter((i) => i !== missing);
        g.addColorStop(0, RGB[ends[0]]); g.addColorStop(1, RGB[ends[1]]);
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); ctx.restore();
      });
    }
    // the fixed point
    const fx = ramp(t, c5 - 0.6, 0.6);
    if (fx > 0) {
      glowDot(ctx, FIXXY[0], FIXXY[1], 8 * px, C.gold, fx, 5);
      ring(ctx, FIXXY[0], FIXXY[1], (24 + 8 * Math.sin(t * 4)) * px, C.gold, 3 * px, fx);
    }
    ctx.restore();

    // soft edge where the zoomed picture is clipped
    if (zoom > 1.02) {
      const sg = ctx.createLinearGradient(1090, 0, 1212, 0);
      sg.addColorStop(0, 'rgba(8,11,22,0)'); sg.addColorStop(1, `rgba(8,11,22,${clamp((zoom - 1) * 2)})`);
      ctx.fillStyle = sg; ctx.fillRect(1090, 0, 122, 1080);
      const tg = ctx.createLinearGradient(0, 0, 0, 90);
      tg.addColorStop(0, `rgba(6,8,17,${clamp((zoom - 1) * 2)})`); tg.addColorStop(1, 'rgba(6,8,17,0)');
      ctx.fillStyle = tg; ctx.fillRect(0, 0, 1212, 90);
    }
    // right column
    const RX = 1250;
    const tf = zh ? FONT.zhSerif : FONT.serif;
    const h = ramp(t, c0 + 0.2, 0.8);
    text(ctx, L(S.lang, 'Sperner ⟹ Brouwer', '斯佩纳 ⟹ 布劳威尔'), RX, 150, { size: 56, weight: 700, font: tf, alpha: h });
    text(ctx, L(S.lang, 'arrow  v → f(v),  coordinates (λR, λG, λB)', '箭头 v → f(v)，坐标 (λ红, λ绿, λ蓝)'), RX, 204, { size: 26, color: C.dim, alpha: h, font });
    const exP = ramp(t, c1 + 0.2, 0.6) * (1 - ramp(t, c2 + 0.2, 0.6));
    if (exP > 0) {
      const fl = fb(EX.bary);
      const fmt = (l) => `(${l.map((x) => x.toFixed(2)).join(', ')})`;
      const dec = [0, 1, 2].map((i) => EX.bary[i] - fl[i]);
      const lab = label(EX.bary);
      text(ctx, 'v      = ' + fmt(EX.bary), RX, 320, { size: 34, font: FONT.serif, alpha: exP });
      text(ctx, 'f(v)  = ' + fmt(fl), RX, 372, { size: 34, font: FONT.serif, alpha: exP });
      const names = zh ? ['红', '绿', '蓝'] : ['red', 'green', 'blue'];
      [0, 1, 2].forEach((i) => {
        const a = exP * ramp(t, c1 + 0.9 + 0.25 * i, 0.4);
        const s = dec[i] > 0 ? (zh ? `${names[i]}：减少 ${dec[i].toFixed(2)}` : `${names[i]}: down ${dec[i].toFixed(2)}`) : (zh ? `${names[i]}：增加` : `${names[i]}: up`);
        text(ctx, s, RX, 440 + i * 46, { size: 30, color: RGB[i], alpha: a, font, weight: i === lab ? 700 : 400 });
      });
      const ac = exP * ramp(t, c1 + 1.9, 0.5);
      text(ctx, L(S.lang, `moves away from ${names[lab]} most → colour it ${names[lab]}`, `最远离${names[lab]}色顶点 → 染${names[lab]}色`), RX, 600, { size: 30, alpha: ac, font, color: RGB[lab], weight: 600 });
    }
    const sP = ramp(t, c2 + 0.4, 0.6) * (1 - ramp(t, c4 + 0.2, 0.6));
    if (sP > 0) {
      text(ctx, L(S.lang, 'On a side, one coordinate is 0', '边上的点有一个坐标为 0'), RX, 320, { size: 32, alpha: sP, font });
      text(ctx, L(S.lang, '— it cannot go down.', '——它不可能再减少。'), RX, 368, { size: 32, alpha: sP, font, color: C.dim });
      text(ctx, L(S.lang, 'So sides use only their', '所以边上只会用到'), RX, 440, { size: 32, alpha: sP * ramp(t, c2 + 2.2, 0.5), font });
      text(ctx, L(S.lang, 'two end colors: Sperner!', '两端的颜色：正是斯佩纳染色！'), RX, 488, { size: 32, alpha: sP * ramp(t, c2 + 2.2, 0.5), font, color: C.gold });
      const rA = sP * ramp(t, c3 + 0.4, 0.5);
      text(ctx, L(S.lang, 'rainbow triangle: arrows move', '三色三角形：箭头同时'), RX, 580, { size: 32, alpha: rA, font, color: C.gold });
      text(ctx, L(S.lang, 'away from all three corners', '远离三个顶点'), RX, 628, { size: 32, alpha: rA, font, color: C.gold });
    }
    const nA = ramp(t, c4 + 0.3, 0.5) * (1 - ramp(t, c5 + 0.2, 0.5));
    if (nA > 0) {
      const n = LEVELS[Math.min(lvl, 3)].n;
      text(ctx, L(S.lang, `each side cut into ${n}`, `每条边 ${n} 等分`), RX, 330, { size: 40, weight: 600, alpha: nA, font });
      text(ctx, L(S.lang, 'rainbow triangles shrink', '三色三角形不断收缩'), RX, 392, { size: 32, alpha: nA, font, color: C.gold });
      text(ctx, L(S.lang, 'toward one point', '逼近同一个点'), RX, 438, { size: 32, alpha: nA, font, color: C.gold });
    }
    const fA = ramp(t, c5 + 0.3, 0.6);
    if (fA > 0) {
      drawTex(ctx, TF1, RX, 340, { anchor: 'l', alpha: fA });
      drawTex(ctx, TF2, RX, 430, { anchor: 'l', alpha: ramp(t, c6 + 0.2, 0.6) });
      drawTex(ctx, TF3, RX, 540, { anchor: 'l', alpha: ramp(t, c6 + 3.2, 0.6), glow: 'rgba(255,209,102,0.35)' });
      text(ctx, L(S.lang, 'arrow length = 0', '箭头长度 = 0'), RX, 640, { size: 34, weight: 600, color: C.gold, alpha: ramp(t, c7 + 0.4, 0.6), font });
    }
  },
};
