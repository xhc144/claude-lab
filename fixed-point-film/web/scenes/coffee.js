// Cold open: a latte is stirred by a sequence of disk-preserving swirls; one point ends where it began.
import { W, H, C, FONT, clamp, lerp, ease, smooth, ramp, rng, glowDot, ring, arrow, text, hexA, L } from '../lib.js';

const CX = 960, CY = 440, R = 290, N = 2 * R;

// Each stage rotates points about c by an angle that depends only on the distance to c,
// so it is a homeomorphism of the cup onto itself (local swirls vanish outside radius rho).
export const STAGES = [
  { c: [-0.30, 0.10], rho: 0.62, a: 3.6 },
  { c: [0, 0], a: 1.15, k: 1.5 },
  { c: [0.31, -0.21], rho: 0.62, a: -3.3 },
  { c: [0.03, 0.40], rho: 0.55, a: 2.9 },
  { c: [0, 0], a: -0.85, k: -1.7 },
];

function angle(st, x, y, s) {
  const dx = x - st.c[0], dy = y - st.c[1];
  const d2 = dx * dx + dy * dy;
  if (st.rho === undefined) return s * (st.a + st.k * (1 - d2));
  const u2 = d2 / (st.rho * st.rho);
  if (u2 >= 1) return 0;
  const w = 1 - u2;
  return s * st.a * w * w;
}

function rot(st, x, y, th) {
  const dx = x - st.c[0], dy = y - st.c[1];
  const cs = Math.cos(th), sn = Math.sin(th);
  return [st.c[0] + cs * dx - sn * dy, st.c[1] + sn * dx + cs * dy];
}

export function forward(x, y, s) {
  for (let k = 0; k < STAGES.length; k++) {
    if (s[k] <= 0) continue;
    [x, y] = rot(STAGES[k], x, y, angle(STAGES[k], x, y, s[k]));
  }
  return [x, y];
}

const FULL = STAGES.map(() => 1);

function findFixedPoint() {
  const cands = [];
  const n = 120;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -1 + (2 * (i + 0.5)) / n, y = -1 + (2 * (j + 0.5)) / n;
    if (x * x + y * y > 0.97) continue;
    const [fx, fy] = forward(x, y, FULL);
    cands.push([Math.hypot(fx - x, fy - y), x, y]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  const found = [];
  for (const [, x0, y0] of cands.slice(0, 60)) {
    let x = x0, y = y0;
    for (let it = 0; it < 40; it++) {
      const h = 1e-5;
      const [gx, gy] = forward(x, y, FULL); const rx = gx - x, ry = gy - y;
      const [ax, ay] = forward(x + h, y, FULL); const [bx, by] = forward(x, y + h, FULL);
      const j11 = (ax - x - h - rx) / h, j21 = (ay - y - ry) / h;
      const j12 = (bx - x - rx) / h, j22 = (by - y - h - ry) / h;
      const det = j11 * j22 - j12 * j21;
      if (Math.abs(det) < 1e-12) break;
      x -= (j22 * rx - j12 * ry) / det;
      y -= (-j21 * rx + j11 * ry) / det;
    }
    const [fx, fy] = forward(x, y, FULL);
    if (Math.hypot(fx - x, fy - y) < 1e-9 && x * x + y * y < 0.95 && !found.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-3)) found.push([x, y]);
  }
  // show the most "interesting" one: away from the centre of the cup
  found.sort((a, b) => Math.hypot(b[0], b[1]) - Math.hypot(a[0], a[1]));
  return { fixed: found.find((p) => Math.hypot(p[0], p[1]) < 0.8) || found[0], all: found };
}

let cream, foam, img, buf, bufCtx, FIX, TRACK;

function heart(u, v) {
  const hx = u / 0.40, hy = -v / 0.40 + 0.15;
  const q = hx * hx + hy * hy - 1;
  return q * q * q - hx * hx * hy * hy * hy;
}

export function initCoffee() {
  if (cream) return;
  cream = new Float32Array(N * N);
  foam = new Float32Array(N * N);
  const r = rng(11);
  const dots = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.3;
    dots.push([0.74 * Math.cos(a), 0.74 * Math.sin(a), 0.055 + 0.012 * (k % 3)]);
  }
  // value noise for foam texture
  const G = 48, grid = new Float32Array((G + 1) * (G + 1)).map(() => r());
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / R - 1, v = (j + 0.5) / R - 1;
    let c = clamp(0.5 - heart(u, v) * 9);
    for (const [dx, dy, rr] of dots) {
      const d = Math.hypot(u - dx, v - dy);
      c = Math.max(c, clamp((rr - d) * R * 0.5 + 0.5));
    }
    const ring2 = Math.abs(Math.hypot(u, v) - 0.9);
    c = Math.max(c, 0.55 * clamp((0.018 - ring2) * R * 0.4 + 0.5));
    cream[j * N + i] = c;
    const gx = ((i / N) * G), gy = ((j / N) * G);
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = smooth(gx - x0), fy = smooth(gy - y0);
    const g = (a, b) => grid[b * (G + 1) + a];
    const n1 = lerp(lerp(g(x0, y0), g(x0 + 1, y0), fx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), fx), fy);
    foam[j * N + i] = n1;
  }
  img = new ImageData(N, N);
  buf = document.createElement('canvas');
  buf.width = buf.height = N;
  bufCtx = buf.getContext('2d');
  const fp = findFixedPoint();
  FIX = fp.fixed;
  window.COFFEE_FIXED = fp.all;
  TRACK = [];
  const tr = rng(5);
  for (let k = 0; k < 13; k++) {
    const a = (k / 13) * Math.PI * 2 + tr() * 0.4;
    const rr = 0.25 + 0.55 * tr();
    TRACK.push([rr * Math.cos(a), rr * Math.sin(a)]);
  }
  TRACK.push(FIX);
}

function sampleCream(x, y) {
  const fx = (x + 1) * R - 0.5, fy = (y + 1) * R - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return [0, 0.5];
  const ax = fx - i, ay = fy - j, o = j * N + i;
  const c = (cream[o] * (1 - ax) + cream[o + 1] * ax) * (1 - ay) + (cream[o + N] * (1 - ax) + cream[o + N + 1] * ax) * ay;
  return [c, foam[o]];
}

function paintSurface(s) {
  const d = img.data;
  const active = [];
  for (let k = STAGES.length - 1; k >= 0; k--) if (s[k] > 0) active.push(k);
  for (let j = 0; j < N; j++) {
    const v = (j + 0.5) / R - 1;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / R - 1;
      const r2 = u * u + v * v;
      const o = (j * N + i) * 4;
      if (r2 > 1.01) { d[o + 3] = 0; continue; }
      let x = u, y = v;
      for (const k of active) {
        const st = STAGES[k];
        const th = -angle(st, x, y, s[k]);
        const dx = x - st.c[0], dy = y - st.c[1];
        const cs = Math.cos(th), sn = Math.sin(th);
        x = st.c[0] + cs * dx - sn * dy;
        y = st.c[1] + sn * dx + cs * dy;
      }
      const [c, f] = sampleCream(x, y);
      const r = Math.sqrt(r2);
      // espresso: dark centre, crema toward the rim
      const t = smooth((r - 0.55) / 0.45);
      const shade = 0.88 + 0.24 * f;
      const br = (52 + 70 * t) * shade, bg = (30 + 40 * t) * shade, bb = (18 + 20 * t) * shade;
      const cr = 246 * (0.94 + 0.06 * f), cg = 233 * (0.94 + 0.06 * f), cb = 214 * (0.94 + 0.06 * f);
      d[o] = br + (cr - br) * c;
      d[o + 1] = bg + (cg - bg) * c;
      d[o + 2] = bb + (cb - bb) * c;
      d[o + 3] = 255;
    }
  }
  bufCtx.putImageData(img, 0, 0);
}

function table(ctx) {
  const g = ctx.createRadialGradient(CX, CY, 100, CX, CY, 1200);
  g.addColorStop(0, '#2a1c14');
  g.addColorStop(0.55, '#140d09');
  g.addColorStop(1, '#070504');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // faint wood grain
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#c08a5a';
  ctx.lineWidth = 2;
  for (let k = 0; k < 26; k++) {
    const y0 = k * 44 - 40;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 40) {
      const y = y0 + 10 * Math.sin(x * 0.004 + k * 1.7) + 5 * Math.sin(x * 0.013 + k);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function cup(ctx) {
  // saucer
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 26;
  let g = ctx.createRadialGradient(CX - 120, CY - 140, 50, CX, CY, R + 190);
  g.addColorStop(0, '#fbfaf7');
  g.addColorStop(0.75, '#e4e0d8');
  g.addColorStop(1, '#bdb7ad');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(CX, CY, R + 140, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(150,140,125,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(CX, CY, R + 95, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // handle (top-down it is a loop on the right)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.strokeStyle = '#ece8e1';
  ctx.lineWidth = 30;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX + R + 26, CY - 46);
  ctx.bezierCurveTo(CX + R + 130, CY - 62, CX + R + 130, CY + 62, CX + R + 26, CY + 46);
  ctx.stroke();
  ctx.restore();
  // cup body / rim
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  g = ctx.createRadialGradient(CX - 140, CY - 160, 40, CX, CY, R + 60);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.8, '#ebe7e0');
  g.addColorStop(1, '#c9c3b8');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(CX, CY, R + 42, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function surfaceLight(ctx) {
  ctx.save();
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.clip();
  let g = ctx.createRadialGradient(CX, CY, R * 0.7, CX, CY, R);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,4,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(CX - R, CY - R, 2 * R, 2 * R);
  g = ctx.createRadialGradient(CX - R * 0.45, CY - R * 0.5, 0, CX - R * 0.45, CY - R * 0.5, R * 0.75);
  g.addColorStop(0, 'rgba(255,248,235,0.16)');
  g.addColorStop(1, 'rgba(255,248,235,0)');
  ctx.fillStyle = g;
  ctx.fillRect(CX - R, CY - R, 2 * R, 2 * R);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(80,60,40,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(CX, CY, R + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

const toScreen = (p) => [CX + p[0] * R, CY + p[1] * R];

function spoon(ctx, bx, by, alpha) {
  if (alpha <= 0) return;
  const dir = [0.72, -0.69];
  const ex = bx + dir[0] * 640, ey = by + dir[1] * 640;
  const ang = Math.atan2(dir[1], dir[0]);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = -10;
  ctx.shadowOffsetY = 18;
  const g = ctx.createLinearGradient(bx, by - 20, ex, ey);
  g.addColorStop(0, '#d9dde3');
  g.addColorStop(0.5, '#9aa1ab');
  g.addColorStop(1, '#e8ebef');
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = 15;
  ctx.beginPath(); ctx.moveTo(bx + dir[0] * 30, by + dir[1] * 30); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.translate(bx, by);
  ctx.rotate(ang);
  const bg = ctx.createRadialGradient(-8, -6, 2, 0, 0, 40);
  bg.addColorStop(0, '#f4f6f8');
  bg.addColorStop(1, '#8d949e');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, 0, 40, 27, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Stage progress for a stirring that runs from t0 to t1. */
export function stageProgress(t, t0, t1) {
  const n = STAGES.length, span = (t1 - t0) / n;
  return STAGES.map((_, k) => ease((t - t0 - k * span) / span));
}

function spoonPos(t, t0, t1) {
  const n = STAGES.length, span = (t1 - t0) / n;
  const k = clamp(Math.floor((t - t0) / span), 0, n - 1);
  const p = clamp((t - t0 - k * span) / span);
  const pos = (kk, q) => {
    const st = STAGES[kk];
    const rr = st.rho === undefined ? 0.58 : st.rho * 0.5;
    const dir = Math.sign(st.a);
    const a = 0.8 * kk + dir * Math.PI * 2 * 1.1 * q;
    return [st.c[0] + rr * Math.cos(a), st.c[1] + rr * Math.sin(a)];
  };
  if (p < 0.15 && k > 0) {
    const a = pos(k - 1, 1), b = pos(k, 0), f = smooth(p / 0.15);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }
  return pos(k, k === 0 ? p : (p - 0.15) / 0.85);
}

/** Paint the whole cup with stirring progress s[] and optional overlays. */
export function paintCup(ctx, s, o = {}) {
  table(ctx);
  cup(ctx);
  paintSurface(s);
  ctx.save();
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(buf, CX - R, CY - R);
  ctx.restore();
  surfaceLight(ctx);
  // tracked "sprinkles"
  const ghostA = o.ghost ?? 0;
  TRACK.forEach((p0, idx) => {
    const isFix = idx === TRACK.length - 1;
    const [x, y] = toScreen(forward(p0[0], p0[1], s));
    const [gx, gy] = toScreen(p0);
    if (ghostA > 0 && !isFix) {
      ring(ctx, gx, gy, 9, '#fff6e6', 2, 0.75 * ghostA);
      arrow(ctx, gx, gy, x, y, { color: '#fff6e6', width: 2.2, head: 12, alpha: 0.7 * ghostA * (o.arrows ?? 1) });
    }
    const fixA = isFix ? (o.fix ?? 0) : 0;
    ctx.save();
    ctx.fillStyle = '#5b2a10';
    ctx.strokeStyle = 'rgba(255,240,220,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (fixA > 0) {
      glowDot(ctx, x, y, 9, C.gold, fixA, 4);
      ring(ctx, x, y, 22 + 10 * Math.sin(o.time * 4), C.gold, 3, fixA * 0.9);
    }
  });
  if (o.label > 0) {
    const [x, y] = toScreen(FIX);
    const lx = x - 300, ly = y + 120;
    ctx.save();
    ctx.globalAlpha *= o.label;
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 18, y + 16); ctx.lineTo(lx + 150, ly - 34); ctx.stroke();
    ctx.restore();
    text(ctx, L(o.lang, 'start = end', '起点 = 终点'), lx, ly, { size: 40, weight: 700, color: C.gold, alpha: o.label, align: 'center', glow: 'rgba(0,0,0,0.9)', font: o.lang === 'zh' ? FONT.zh : FONT.sans });
  }
}

export const COFFEE = { CX, CY, R, get FIX() { return FIX; } };

export default {
  init() { initCoffee(); },
  draw(ctx, t, S) {
    const t0 = S.cue(0) + 0.3, t1 = S.cue(2) - 0.2;
    const s = stageProgress(t, t0, t1);
    const zoom = 1 + 0.06 * smooth(t / S.dur);
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(zoom, zoom); ctx.translate(-CX, -CY);
    const ghost = ramp(t, S.cue(2) + 0.4, 0.8);
    paintCup(ctx, s, {
      ghost, arrows: 1,
      fix: ramp(t, S.cue(2) + 1.6, 0.6),
      label: ramp(t, S.cue(2) + 2.0, 0.6),
      time: t, lang: S.lang,
    });
    // spoon: dips in, stirs, lifts out
    const sp = spoonPos(t, t0, t1);
    const inA = ramp(t, t0 - 0.9, 0.7), outA = 1 - ramp(t, t1 + 0.1, 0.6);
    const lift = (1 - inA) + (1 - outA);
    const [bx, by] = toScreen(sp);
    spoon(ctx, bx + 520 * lift * 0.72, by - 520 * lift * 0.69, Math.min(inA, outA) > 0 ? 1 : 0);
    ctx.restore();
  },
};
