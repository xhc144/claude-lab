// The entrance vocabulary. A preset maps a raw progress (0..1 over the preset's duration) to a
// visual state that any drawable (text unit, card, chart mark, image) can apply. Themes choose
// presets and tempo; components only ask "how should unit i look at time t?".
import { EASE, clamp01 } from './easing.js';

export const IDENTITY = Object.freeze({ alpha: 1, dx: 0, dy: 0, scale: 1, sx: 1, sy: 1, rot: 0, blur: 0, clip: null, done: true });

/**
 * @param {string} preset
 * @param {number} p raw linear progress 0..1
 * @param {object} m resolved motion (ease fn, spring fn, distance px, blur px, w/h of the unit)
 */
export function enterState(preset, p, m) {
  if (p >= 1) return IDENTITY;
  const e = m.ease(clamp01(p));
  const a = EASE.outQuad(clamp01(p * 1.6));
  const dist = m.distance;
  switch (preset) {
    case 'none': return IDENTITY;
    case 'fade': return st({ alpha: e });
    case 'rise': return st({ alpha: a, dy: (1 - e) * dist });
    case 'rise-blur': return st({ alpha: a, dy: (1 - e) * dist, blur: (1 - EASE.outCubic(clamp01(p * 1.2))) * m.blur });
    case 'drop': return st({ alpha: a, dy: -(1 - e) * dist });
    case 'slide-left': return st({ alpha: a, dx: (1 - e) * dist * 2.2 });
    case 'slide-right': return st({ alpha: a, dx: -(1 - e) * dist * 2.2 });
    case 'mask-up': return st({ alpha: 1, dy: (1 - e) * (m.h || dist) * 1.05, clip: 'box' });
    case 'mask-left': return st({ alpha: 1, dx: -(1 - e) * (m.w || dist) * 0.6, clip: 'box', reveal: { dir: 'right', amount: e } });
    case 'wipe': return st({ alpha: 1, reveal: { dir: 'right', amount: e, soft: 0.25 } });
    case 'brush': return st({ alpha: clamp01(p * 3), reveal: { dir: 'right', amount: e, soft: 0.6 }, blur: (1 - e) * 2 });
    case 'scale': return st({ alpha: a, scale: 0.86 + 0.14 * e });
    case 'pop': { const s = m.spring ? m.spring(p) : EASE.outBack(p); return st({ alpha: clamp01(p * 4), scale: 0.4 + 0.6 * s }); }
    case 'pop-soft': { const s = m.spring ? m.spring(p) : EASE.outBack(p); return st({ alpha: clamp01(p * 3), scale: 0.82 + 0.18 * s, dy: (1 - s) * dist * 0.5 }); }
    case 'slam': { const s = m.spring ? m.spring(p) : EASE.outBack(p); return st({ alpha: clamp01(p * 5), scale: 1.7 - 0.7 * s }); }
    case 'focus': return st({ alpha: EASE.outCubic(clamp01(p * 1.15)), scale: 1 + 0.07 * (1 - e), blur: (1 - e) * m.blur, dy: (1 - e) * dist * 0.3 });
    case 'blur': return st({ alpha: a, blur: (1 - e) * m.blur });
    case 'write': return st({ alpha: EASE.outCubic(clamp01(p * 1.3)), blur: (1 - e) * Math.max(2, m.blur), dx: -(1 - e) * dist * 0.25 });
    case 'ink': return st({ alpha: EASE.outQuad(clamp01(p * 1.1)) ** 0.8, blur: (1 - e) * m.blur, scale: 1 + 0.05 * (1 - e) });
    case 'type': return st({ alpha: p > 0 ? 1 : 0 });
    case 'draw': return st({ alpha: 1, draw: e });
    default: return st({ alpha: a, dy: (1 - e) * dist });
  }
}

function st(o) {
  return { alpha: 1, dx: 0, dy: 0, scale: 1, sx: 1, sy: 1, rot: 0, blur: 0, clip: null, reveal: null, draw: 1, done: false, ...o };
}

/** Apply a state around a pivot inside a given box. Caller must ctx.save()/restore(). */
export function applyState(ctx, s, box, pivot) {
  if (s === IDENTITY || s.done) return true;
  if (s.alpha <= 0.001) return false;
  ctx.globalAlpha *= s.alpha;
  if (s.clip === 'box' && box) {
    ctx.beginPath();
    const pad = box.pad ?? 0;
    ctx.rect(box.x - pad * 4, box.y - pad, box.w + pad * 8, box.h + pad * 2);
    ctx.clip();
  }
  if (s.reveal && box) {
    const { dir, amount } = s.reveal;
    const r = amount;
    ctx.beginPath();
    const ext = 4;
    if (dir === 'right') ctx.rect(box.x - ext, box.y - box.h, (box.w + ext * 2) * r, box.h * 3);
    else if (dir === 'left') ctx.rect(box.x + box.w * (1 - r), box.y - box.h, box.w * r + ext, box.h * 3);
    else if (dir === 'down') ctx.rect(box.x - box.w, box.y - ext, box.w * 3, (box.h + ext * 2) * r);
    else ctx.rect(box.x - box.w, box.y + box.h * (1 - r), box.w * 3, box.h * r + ext);
    ctx.clip();
  }
  if (s.dx || s.dy) ctx.translate(s.dx, s.dy);
  if (s.scale !== 1 || s.rot || s.sx !== 1 || s.sy !== 1) {
    const px = pivot ? pivot.x : box ? box.x + box.w / 2 : 0;
    const py = pivot ? pivot.y : box ? box.y + box.h / 2 : 0;
    ctx.translate(px, py);
    if (s.rot) ctx.rotate(s.rot);
    ctx.scale(s.scale * s.sx, s.scale * s.sy);
    ctx.translate(-px, -py);
  }
  if (s.blur > 0.3 && box) {
    // Bound the filter layer: an unclipped canvas filter blurs a full-frame layer per draw call.
    const m = s.blur * 3 + (box.pad || 0) * 4;
    const sc = Math.max(1, s.scale || 1);
    ctx.beginPath();
    ctx.rect(box.x - m - box.w * (sc - 1), box.y - m - box.h * (sc - 1), box.w * sc + m * 2 + box.w * (sc - 1), box.h * sc + m * 2 + box.h * (sc - 1));
    ctx.clip();
    ctx.filter = `blur(${s.blur.toFixed(1)}px)`;
  }
  return true;
}

/** Emphasis loops after build (pulse / glow / float / shake). Returns {scale, dy, glow}. */
export function emphasisState(kind, t) {
  if (!kind || kind === 'none' || t <= 0) return null;
  switch (kind) {
    case 'pulse': return { scale: 1 + 0.035 * Math.sin(t * 4) ** 2 };
    case 'float': return { dy: Math.sin(t * 1.6) * 6 };
    case 'shake': { const k = Math.max(0, 1 - t / 0.6); return { dx: Math.sin(t * 60) * 8 * k }; }
    case 'glow': return { glow: 0.5 + 0.5 * Math.sin(t * 3) };
    default: return null;
  }
}
