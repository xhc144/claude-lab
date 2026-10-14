// Shared drawing helpers. Every scene is a pure function of time, so nothing here keeps per-frame state.

export const W = 1920;
export const H = 1080;

export const C = {
  bg0: '#0d1428',
  bg1: '#05070f',
  ink: '#eef2ff',
  dim: '#9aa6c7',
  faint: '#4a5576',
  red: '#ff5d6c',
  green: '#3ddc97',
  blue: '#4ea8ff',
  gold: '#ffd166',
  cyan: '#6ee7f2',
  violet: '#b49cff',
};
export const RGB = [C.red, C.green, C.blue];

export const FONT = {
  serif: '"Source Serif 4", "Noto Serif SC", serif',
  sans: '"Inter", "Noto Sans SC", sans-serif',
  zh: '"Noto Sans SC", sans-serif',
  zhSerif: '"Noto Serif SC", "Noto Sans SC", serif',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
/** 0→1 ramp starting at time a, lasting d seconds, eased. */
export const ramp = (t, a, d, f = ease) => f((t - a) / d);
/** fade in at a over d, fade out at b over d2. */
export const window01 = (t, a, b, d = 0.4, d2 = d) => Math.min(ramp(t, a, d, smooth), 1 - ramp(t, b - d2, d2, smooth));
export const pulse = (t, period = 1.6) => 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2);

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function background(ctx, cx = W / 2, cy = H * 0.42) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.75);
  g.addColorStop(0, C.bg0);
  g.addColorStop(1, C.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function text(ctx, str, x, y, o = {}) {
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = `${o.weight ?? 400} ${o.size ?? 32}px ${o.font ?? FONT.sans}`;
  ctx.fillStyle = o.color ?? C.ink;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 18; }
  if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** Word/character wrap; CJK breaks anywhere, Latin at spaces. */
export function wrap(ctx, str, maxW) {
  const cjk = /[　-鿿＀-￯]/.test(str);
  const tokens = cjk ? str.match(/[A-Za-z0-9().,=\-–'’*\[\]]+\s*|./gu) : str.split(/(?<=\s)/);
  const lines = [];
  let cur = '';
  for (const tok of tokens) {
    const next = cur + tok;
    if (ctx.measureText(next.trimEnd()).width > maxW && cur) {
      lines.push(cur.trimEnd());
      cur = tok.trimStart();
    } else cur = next;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  // CJK: never start a line with closing punctuation
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^[，。：；、！？）」』”]+/);
    if (m) { lines[i - 1] += m[0]; lines[i] = lines[i].slice(m[0].length); }
  }
  return lines;
}

export function balancedWrap(ctx, str, maxW) {
  let lines = wrap(ctx, str, maxW);
  if (lines.length === 2 && /[　-鿿]/.test(str)) {
    // Chinese: prefer to break right after a punctuation mark near the middle
    let best = null;
    for (let i = 1; i < str.length - 1; i++) {
      if (!'，、：；。！？'.includes(str[i])) continue;
      const a = str.slice(0, i + 1), b = str.slice(i + 1);
      const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
      if (wa <= maxW && wb <= maxW && (!best || Math.max(wa, wb) < best.w)) best = { w: Math.max(wa, wb), lines: [a, b] };
    }
    if (best && best.w < maxW * 0.92) return best.lines;
  }
  if (lines.length === 2) {
    // shrink the box until the two lines are roughly balanced
    let lo = maxW * 0.5, hi = maxW;
    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      if (wrap(ctx, str, mid).length > 2) lo = mid; else hi = mid;
    }
    lines = wrap(ctx, str, hi + 2);
  }
  return lines;
}

export function arrow(ctx, x0, y0, x1, y1, o = {}) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const head = Math.min(o.head ?? 14, len * 0.6);
  const ux = dx / len, uy = dy / len;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.strokeStyle = ctx.fillStyle = o.color ?? C.ink;
  ctx.lineWidth = o.width ?? 3;
  ctx.lineCap = 'round';
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * head * 0.7, y1 - uy * head * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * head - uy * head * 0.5, y1 - uy * head + ux * head * 0.5);
  ctx.lineTo(x1 - ux * head + uy * head * 0.5, y1 - uy * head - ux * head * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function glowDot(ctx, x, y, r, color, alpha = 1, halo = 3) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * halo);
  g.addColorStop(0, hexA(color, 0.55));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function ring(ctx, x, y, r, color, width = 3, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = 'rgba(20,28,52,0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,180,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Point along a polyline at arc-length fraction u, plus the drawn prefix. */
export function polyAt(pts, u) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l);
    total += l;
  }
  let target = clamp(u) * total;
  const prefix = [pts[0]];
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? clamp(target / seg[i]) : 0;
      const p = [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
      prefix.push(p);
      return { p, prefix, index: i };
    }
    target -= seg[i];
    prefix.push(pts[i + 1]);
  }
  return { p: pts[pts.length - 1], prefix: pts, index: pts.length - 2 };
}

export function strokePoly(ctx, pts, o = {}) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.strokeStyle = o.color ?? C.ink;
  ctx.lineWidth = o.width ?? 3;
  ctx.lineCap = ctx.lineJoin = 'round';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 14; }
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (o.close) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** A ✗ badge reading "no fixed point". */
export function crossBadge(ctx, x, y, label, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const s = 16;
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
  ctx.stroke();
  ctx.restore();
  text(ctx, label, x + 34, y + 11, { size: 30, color: C.red, weight: 600, alpha });
}

// ---------------------------------------------------------------- TeX via MathJax (SVG → Image)
const texCache = new Map();

export async function tex(src, color = C.ink, px = 44) {
  const key = `${src}|${color}|${px}`;
  if (texCache.has(key)) return texCache.get(key);
  const node = window.MathJax.tex2svg(src, { display: false });
  const svg = node.querySelector('svg');
  const exPx = px * 0.45;
  const wEx = parseFloat(svg.getAttribute('width'));
  const hEx = parseFloat(svg.getAttribute('height'));
  const w = wEx * exPx, h = hEx * exPx;
  const SCALE = 3; // rasterise large; drawImage scales down cleanly
  svg.setAttribute('width', `${w * SCALE}px`);
  svg.setAttribute('height', `${h * SCALE}px`);
  svg.setAttribute('style', `color:${color}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const data = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
  await img.decode();
  const out = { img, w, h };
  texCache.set(key, out);
  return out;
}

/** Draw a prepared TeX image. anchor: 'c' centre, 'l' left-middle, 'r' right-middle. */
export function drawTex(ctx, t, x, y, o = {}) {
  if (!t) return;
  const s = o.scale ?? 1;
  const w = t.w * s, h = t.h * s;
  let dx = -w / 2;
  if (o.anchor === 'l') dx = 0;
  if (o.anchor === 'r') dx = -w;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 16; }
  ctx.drawImage(t.img, x + dx, y - h / 2, w, h);
  ctx.restore();
}

/** Text that is revealed left-to-right with a soft edge (for formulas and titles). */
export function revealClip(ctx, x, y, w, h, u, draw) {
  if (u <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w * clamp(u) + 1, h);
  ctx.clip();
  draw();
  ctx.restore();
}

export const L = (lang, en, zh) => (lang === 'zh' ? zh : en);
