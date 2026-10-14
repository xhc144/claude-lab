// Scene transitions: compositors that blend an outgoing and an incoming scene layer.
import { cubicBezier, EASE, clamp01 } from './motion/easing.js';
import { toCss } from '../core/util/color.js';
import { noiseField, makeCanvas } from './backgrounds.js';

const TAU = Math.PI * 2;
const inOut = cubicBezier(0.76, 0, 0.24, 1);
const outFast = cubicBezier(0.16, 1, 0.3, 1);

/** Fraction of the transition during which the incoming scene is hidden (its content should wait). */
export const IN_DELAY = { dip: 0.5, band: 0.5, stripes: 0.5, cut: 0, ink: 0.15, scan: 0.1, blur: 0.25 };

let scratch = null;
function getScratch(w, h) {
  if (!scratch || scratch.width !== w || scratch.height !== h) scratch = makeCanvas(w, h);
  return scratch;
}

let blurScratch = null;
/** Draw a layer blurred: blur a 1/3-resolution copy and upscale (cheap and visually identical for large blurs). */
function drawBlurred(ctx, layer, W, H, blurPx, alpha = 1, s = 1) {
  if (alpha <= 0) return;
  if (blurPx < 0.6) {
    ctx.save(); ctx.globalAlpha *= alpha;
    if (s !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); }
    ctx.drawImage(layer, 0, 0, W, H); ctx.restore(); return;
  }
  const k = 3;
  const w = Math.max(16, Math.round(layer.width / k)), h = Math.max(9, Math.round(layer.height / k));
  if (!blurScratch || blurScratch.width !== w || blurScratch.height !== h) blurScratch = makeCanvas(w, h);
  const g = blurScratch.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.filter = `blur(${((blurPx * w) / W).toFixed(2)}px)`;
  g.drawImage(layer, 0, 0, w, h);
  g.filter = 'none';
  ctx.save(); ctx.globalAlpha *= alpha;
  if (s !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(blurScratch, 0, 0, W, H);
  ctx.restore();
}

let inkMask = null;
function inkMaskCanvas(p, soft) {
  const w = 384, h = 216;
  if (!inkMask) inkMask = { c: makeCanvas(w, h), field: noiseField(w, h, 5) };
  const g = inkMask.c.getContext('2d');
  const img = g.createImageData(w, h);
  const lo = p * (1 + soft) - soft;
  for (let i = 0; i < w * h; i++) {
    const v = inkMask.field[i];
    const a = clamp01((lo + soft - v) / soft);
    img.data[i * 4 + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  return inkMask.c;
}

function dirVec(dir) {
  return { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir] || [-1, 0];
}

/**
 * @param ctx destination (design coordinates)
 * @param tr  {type, direction, color, ...}
 * @param p   raw progress 0..1
 * @param out, inn   layer canvases (pixel size = W*scale × H*scale)
 * @param e  {W, H, scale, palIn, palOut}
 */
export function composite(ctx, tr, p, out, inn, e) {
  const { W, H } = e;
  const draw = (layer, alpha = 1, x = 0, y = 0, s = 1) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (s !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); }
    ctx.drawImage(layer, x, y, W, H);
    ctx.restore();
  };
  const type = tr.type;
  switch (type) {
    case 'cut': draw(p < 0.02 ? out : inn); break;
    case 'fade': { draw(out); draw(inn, EASE.inOutSine(p)); break; }
    case 'dip': {
      const color = tr.color || e.palIn.bg;
      if (p < 0.5) { draw(out); ctx.fillStyle = toCss(color, EASE.inOutSine(p * 2)); ctx.fillRect(0, 0, W, H); }
      else { draw(inn); ctx.fillStyle = toCss(color, 1 - EASE.inOutSine((p - 0.5) * 2)); ctx.fillRect(0, 0, W, H); }
      break;
    }
    case 'push': {
      const [dx, dy] = dirVec(tr.direction || 'left');
      const k = inOut(p);
      draw(out, 1, dx * W * k, dy * H * k);
      draw(inn, 1, -dx * W * (1 - k), -dy * H * (1 - k));
      break;
    }
    case 'slide': {
      const [dx, dy] = dirVec(tr.direction || 'left');
      const k = outFast(p);
      draw(out, 1, dx * W * 0.18 * k, dy * H * 0.18 * k, 1 - 0.05 * k);
      ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 60 * e.unit;
      ctx.drawImage(inn, -dx * W * (1 - k), -dy * H * (1 - k), W, H);
      ctx.restore();
      break;
    }
    case 'wipe': {
      draw(out);
      const k = inOut(p);
      const dir = tr.direction || 'left';
      const sc = getScratch(inn.width, inn.height);
      const g = sc.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, sc.width, sc.height);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(inn, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      const soft = 0.18;
      const horizontal = dir === 'left' || dir === 'right';
      const len = horizontal ? sc.width : sc.height;
      const pos = (k * (1 + soft) - soft) * len;
      const grad = horizontal ? g.createLinearGradient(dir === 'left' ? len : 0, 0, dir === 'left' ? 0 : len, 0) : g.createLinearGradient(0, dir === 'up' ? len : 0, 0, dir === 'up' ? 0 : len);
      const a = clamp01(pos / len), b = clamp01((pos + soft * len) / len);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(a, 'rgba(0,0,0,1)'); grad.addColorStop(b, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, sc.width, sc.height);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(sc, 0, 0, W, H);
      break;
    }
    case 'band': {
      const cols = [tr.color || e.palIn.accent, e.palIn.accent2 && e.palIn.accent2 !== e.palIn.bg ? e.palIn.ink : e.palIn.ink];
      const lead = inOut(clamp01(p / 0.55));
      const trail = inOut(clamp01((p - 0.45) / 0.55));
      draw(p < 0.5 ? out : inn);
      const dir = tr.direction || 'left';
      const sgn = dir === 'right' ? -1 : 1;
      // two bands: accent leads, ink follows; they enter from right and exit to the left
      for (let i = 1; i >= 0; i--) {
        const off = i * 0.08;
        const l = inOut(clamp01((p - off) / 0.5)), r = inOut(clamp01((p - 0.5 - off * 0.5) / 0.5));
        const x0 = W * (1 - l), x1 = W * (1 - r);
        ctx.fillStyle = cols[i % cols.length];
        if (sgn > 0) ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0) + (p > 0.5 ? 0 : 0), H);
        else ctx.fillRect(W - Math.max(x0, x1), 0, Math.abs(x1 - x0), H);
      }
      void lead; void trail;
      break;
    }
    case 'stripes': {
      const n = 5;
      const cols = e.palIn.data;
      draw(p < 0.5 ? out : inn);
      for (let i = 0; i < n; i++) {
        const d = i * 0.06;
        const a = inOut(clamp01((p - d) / 0.5)), b = inOut(clamp01((p - 0.5 - d * 0.6) / 0.45));
        const h = H / n;
        const y = i * h;
        const x0 = W * (1 - a), x1 = W * (1 - b);
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(x1 < x0 ? x1 : x0, y - 1, Math.abs(x0 - x1), h + 2);
      }
      break;
    }
    case 'iris': {
      draw(out);
      const k = inOut(p);
      const cx = (tr.origin?.[0] ?? 0.5) * W, cy = (tr.origin?.[1] ?? 0.5) * H;
      const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * k;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      ctx.drawImage(inn, 0, 0, W, H);
      ctx.restore();
      if (k > 0 && k < 1) { ctx.strokeStyle = e.palIn.accent; ctx.lineWidth = 10 * e.unit * (1 - k); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); }
      break;
    }
    case 'zoom': {
      const k = inOut(p);
      drawBlurred(ctx, out, W, H, k * 14 * e.unit, 1 - EASE.inQuad(clamp01(p * 1.4)), 1 + 0.35 * k);
      drawBlurred(ctx, inn, W, H, (1 - k) * 10 * e.unit, EASE.outQuad(clamp01((p - 0.15) / 0.75)), 0.86 + 0.14 * outFast(p));
      break;
    }
    case 'blur': {
      const a = clamp01(p / 0.6), b = clamp01((p - 0.35) / 0.65);
      drawBlurred(ctx, out, W, H, EASE.inQuad(a) * 24 * e.unit, 1 - EASE.inOutSine(a));
      drawBlurred(ctx, inn, W, H, b < 1 ? (1 - EASE.outQuad(b)) * 24 * e.unit : 0, EASE.inOutSine(b));
      break;
    }
    case 'scan': {
      const dir = tr.direction || 'right';
      const k = inOut(p);
      draw(out);
      ctx.save();
      ctx.beginPath();
      const pos = (dir === 'down' ? H : W) * k;
      if (dir === 'down') ctx.rect(0, 0, W, pos); else ctx.rect(0, 0, pos, H);
      ctx.clip();
      ctx.drawImage(inn, 0, 0, W, H);
      ctx.restore();
      if (k > 0 && k < 1) {
        const c = e.palIn.accent;
        ctx.save();
        ctx.shadowColor = c; ctx.shadowBlur = 30 * e.unit;
        ctx.fillStyle = c;
        if (dir === 'down') ctx.fillRect(0, pos - 2 * e.unit, W, 3 * e.unit); else ctx.fillRect(pos - 2 * e.unit, 0, 3 * e.unit, H);
        ctx.globalAlpha = 0.18;
        const gg = dir === 'down' ? ctx.createLinearGradient(0, pos - 120 * e.unit, 0, pos) : ctx.createLinearGradient(pos - 160 * e.unit, 0, pos, 0);
        gg.addColorStop(0, toCss(c, 0)); gg.addColorStop(1, c);
        ctx.fillStyle = gg;
        if (dir === 'down') ctx.fillRect(0, pos - 120 * e.unit, W, 120 * e.unit); else ctx.fillRect(pos - 160 * e.unit, 0, 160 * e.unit, H);
        ctx.restore();
      }
      break;
    }
    case 'ink': {
      draw(out);
      const k = EASE.inOutSine(p);
      const mask = inkMaskCanvas(k, 0.22);
      const sc = getScratch(inn.width, inn.height);
      const g = sc.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, sc.width, sc.height);
      g.drawImage(inn, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
      g.drawImage(mask, 0, 0, sc.width, sc.height);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(sc, 0, 0, W, H);
      break;
    }
    case 'morph':
    default: { draw(out); draw(inn, EASE.inOutSine(p)); }
  }
}
