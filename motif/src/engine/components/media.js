// Media components: image, gallery, icon, video, shape, code.
import {
  role, paintFor, textAnimator, drawText, blockState, withState, drawCard, drawIcon,
  roundRect, toCss, EASE, clamp01, colorOf, blockPreset, mix,
} from './kit.js';
import { fontString } from '../text/text.js';

const TAU = Math.PI * 2;

const IMAGE_FILTER = { noir: 'grayscale(0.85) contrast(1.08) brightness(0.92)', blueprint: 'grayscale(0.6) contrast(1.05)', ink: 'sepia(0.25) saturate(0.85)', editorial: 'saturate(0.92) contrast(1.02)' };

/** Draw img into box with cover/contain fit, focus point and zoom. */
export function drawImageFit(ctx, img, box, { fit = 'cover', focus = [0.5, 0.5], zoom = 1, pan = [0, 0] } = {}) {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
  if (!iw || !ih) return;
  let s = fit === 'contain' ? Math.min(box.w / iw, box.h / ih) : Math.max(box.w / iw, box.h / ih);
  s *= zoom;
  const dw = iw * s, dh = ih * s;
  let dx, dy;
  if (fit === 'contain' && zoom === 1) { dx = box.x + (box.w - dw) / 2; dy = box.y + (box.h - dh) / 2; }
  else {
    dx = box.x + (box.w - dw) * focus[0] + pan[0] * box.w;
    dy = box.y + (box.h - dh) * focus[1] + pan[1] * box.h;
    dx = Math.min(box.x, Math.max(box.x + box.w - dw, dx));
    dy = Math.min(box.y, Math.max(box.y + box.h - dh, dy));
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function frameKind(block, c) {
  if (block.frame && block.frame !== 'auto') return block.frame;
  if (c.hint?.bleed || c.hint?.backdrop) return 'none';
  return 'rounded';
}

/** Compute the inner content box and draw the device/window chrome for a frame kind. */
function chrome(ctx, c, kind, r, phase) {
  const { env, p } = c;
  const u = env.unit;
  switch (kind) {
    case 'phone': {
      const aspect = 9 / 19.5;
      let h = r.h, w = h * aspect;
      if (w > r.w) { w = r.w; h = w / aspect; }
      const x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2;
      const bez = w * 0.045;
      if (phase === 'under') {
        ctx.save(); ctx.shadowColor = p.shadow; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 20 * u;
        roundRect(ctx, x, y, w, h, w * 0.14); ctx.fillStyle = '#0b0b0d'; ctx.fill(); ctx.restore();
        ctx.lineWidth = 2 * u; ctx.strokeStyle = '#3a3a40'; roundRect(ctx, x + u, y + u, w - 2 * u, h - 2 * u, w * 0.14); ctx.stroke();
      }
      const inner = { x: x + bez, y: y + bez, w: w - bez * 2, h: h - bez * 2, r: w * 0.11 };
      if (phase === 'over') { roundRect(ctx, x + w * 0.36, y + bez * 1.6, w * 0.28, bez * 1.5, bez * 0.75); ctx.fillStyle = '#0b0b0d'; ctx.fill(); }
      return inner;
    }
    case 'laptop': {
      const aspect = 16 / 10;
      let w = r.w, sh = w / aspect;
      const baseH = w * 0.035;
      if (sh + baseH > r.h) { sh = r.h - baseH; w = sh * aspect; }
      const x = r.x + (r.w - w) / 2, y = r.y + (r.h - sh - baseH) / 2;
      const bez = w * 0.025;
      if (phase === 'under') {
        ctx.save(); ctx.shadowColor = p.shadow; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 16 * u;
        roundRect(ctx, x + w * 0.06, y, w * 0.88, sh, w * 0.02); ctx.fillStyle = '#121216'; ctx.fill(); ctx.restore();
        const g = ctx.createLinearGradient(0, y + sh, 0, y + sh + baseH);
        g.addColorStop(0, '#d9dbe0'); g.addColorStop(1, '#9ea1a8');
        ctx.fillStyle = g; roundRect(ctx, x, y + sh - 1, w, baseH, baseH * 0.4); ctx.fill();
        ctx.fillStyle = '#7d8087'; ctx.fillRect(x + w * 0.44, y + sh, w * 0.12, baseH * 0.3);
      }
      return { x: x + w * 0.06 + bez, y: y + bez, w: w * 0.88 - bez * 2, h: sh - bez * 1.6, r: 2 * u };
    }
    case 'browser': {
      const bar = Math.max(28 * u, r.h * 0.07);
      const rad = Math.min(14 * u, env.theme.shape.radius * u + 6 * u);
      if (phase === 'under') {
        ctx.save(); ctx.shadowColor = p.shadow; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 14 * u;
        roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = p.dark ? '#1e2028' : '#ffffff'; ctx.fill(); ctx.restore();
        ctx.save(); roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip();
        ctx.fillStyle = p.dark ? '#2a2d37' : '#eef0f3'; ctx.fillRect(r.x, r.y, r.w, bar);
        ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { ctx.beginPath(); ctx.arc(r.x + bar * 0.55 + i * bar * 0.42, r.y + bar / 2, bar * 0.13, 0, TAU); ctx.fillStyle = col; ctx.fill(); });
        roundRect(ctx, r.x + r.w * 0.25, r.y + bar * 0.22, r.w * 0.5, bar * 0.56, bar * 0.28); ctx.fillStyle = p.dark ? '#1b1d24' : '#ffffff'; ctx.fill();
        ctx.restore();
      }
      return { x: r.x, y: r.y + bar, w: r.w, h: r.h - bar, r: 0, clipBottom: rad };
    }
    case 'polaroid': {
      const pad = Math.min(r.w, r.h) * 0.05;
      if (phase === 'under') {
        ctx.save(); ctx.shadowColor = p.shadow; ctx.shadowBlur = 30 * u; ctx.shadowOffsetY = 10 * u;
        ctx.fillStyle = '#fbfaf6'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore();
      }
      return { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 4.2, r: 0 };
    }
    case 'circle': {
      const d = Math.min(r.w, r.h);
      return { x: r.x + (r.w - d) / 2, y: r.y + (r.h - d) / 2, w: d, h: d, r: d / 2, circle: true };
    }
    case 'arch': {
      const w = Math.min(r.w, r.h * 0.78);
      return { x: r.x + (r.w - w) / 2, y: r.y, w, h: r.h, r: 0, arch: true };
    }
    case 'none': return { ...r, r: 0 };
    default: return { ...r, r: env.theme.shape.radius * u * 1.2, shadow: !c.hint?.bleed };
  }
}

function clipInner(ctx, inner) {
  ctx.beginPath();
  if (inner.circle) ctx.arc(inner.x + inner.w / 2, inner.y + inner.h / 2, inner.w / 2, 0, TAU);
  else if (inner.arch) { const R = inner.w / 2; ctx.moveTo(inner.x, inner.y + inner.h); ctx.lineTo(inner.x, inner.y + R); ctx.arc(inner.x + R, inner.y + R, R, Math.PI, 0); ctx.lineTo(inner.x + inner.w, inner.y + inner.h); ctx.closePath(); }
  else if (inner.clipBottom) { roundRect(ctx, inner.x, inner.y - inner.clipBottom, inner.w, inner.h + inner.clipBottom, inner.clipBottom); }
  else roundRect(ctx, inner.x, inner.y, inner.w, inner.h, inner.r || 0);
  ctx.clip();
}

function placeholderArt(ctx, c, box, label) {
  const { p, env } = c;
  ctx.save();
  ctx.fillStyle = toCss(p.ink, 0.06); ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = toCss(p.ink, 0.08); ctx.lineWidth = 2 * env.unit;
  ctx.beginPath();
  for (let k = -box.h; k < box.w; k += 26 * env.unit) { ctx.moveTo(box.x + k, box.y + box.h); ctx.lineTo(box.x + k + box.h, box.y); }
  ctx.stroke();
  drawIcon(ctx, 'image', box.x + box.w / 2, box.y + box.h / 2 - env.sizes.body * 0.4, Math.min(box.w, box.h) * 0.18, toCss(p.ink, 0.35));
  if (label) { ctx.font = fontString(role(env, 'text'), env.sizes.caption); ctx.fillStyle = p.mutedText; ctx.textAlign = 'center'; ctx.fillText(label, box.x + box.w / 2, box.y + box.h / 2 + Math.min(box.w, box.h) * 0.15); ctx.textAlign = 'left'; }
  ctx.restore();
}

function imageRef(block) { return block.asset || (block.src ? { src: block.src } : null); }

const image = {
  type: 'image',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.66), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const kind = frameKind(block, c);
    const capL = block.caption && !c.hint?.bleed ? c.te.layout(block.caption, role(env, 'text'), env.sizes.small, { maxWidth: rect.w, align: 'center' }) : null;
    const capH = capL ? capL.height + env.sizes.small * 0.8 : 0;
    const box = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - (kind === 'polaroid' ? 0 : capH) };
    const motion = block.motion && typeof block.motion === 'string' ? block.motion : block.motion?.enter === 'none' ? 'none' : (block.kenburns === false ? 'none' : (typeof block.motion === 'string' ? block.motion : 'auto'));
    const focus = Array.isArray(block.focus) ? block.focus : [0.5, 0.42];
    const bleed = !!(c.hint?.bleed || c.hint?.backdrop);
    const overlay = c.hint?.overlay ?? block.overlay ?? 0;
    const filter = IMAGE_FILTER[env.theme.id];
    const dur = env.motion.duration * 1.3;
    const ref = imageRef(block);
    return {
      duration: bleed ? 0.8 : dur + (capL ? 0.4 : 0), hold: 1.2,
      draw(ctx, t, ds) {
        const img = ref ? c.assets?.image(ref) : null;
        const sceneDur = ds?.sceneDur || 8;
        const lt = ds?.sceneT ?? t;
        const kb = motion === 'none' ? 0 : clamp01(lt / sceneDur);
        const zoom = 1 + (motion === 'none' ? 0 : bleed ? 0.09 : 0.05) * EASE.inOutSine(kb);
        const e = env.motion.ease(clamp01(t / dur));
        ctx.save();
        if (bleed) {
          ctx.globalAlpha *= EASE.outQuad(clamp01((t + 0.2) / 0.9));
          if (t < 0.9) { const b = (1 - clamp01((t + 0.2) / 0.9)) * 14 * env.unit; if (b > 0.5) ctx.filter = `blur(${b.toFixed(1)}px)`; }
        } else {
          // mask reveal: grows from the bottom with a slight settle
          ctx.beginPath();
          const rh = box.h * e;
          ctx.rect(box.x - 60 * env.unit, box.y + box.h - rh - 60 * env.unit, box.w + 120 * env.unit, rh + 120 * env.unit);
          ctx.clip();
          const s = 1.06 - 0.06 * e;
          ctx.translate(box.x + box.w / 2, box.y + box.h / 2); ctx.scale(s, s); ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
        }
        const inner = chrome(ctx, c, kind, box, 'under');
        if (inner.shadow) {
          ctx.save(); ctx.shadowColor = p.shadow; ctx.shadowBlur = 36 * env.unit; ctx.shadowOffsetY = 14 * env.unit;
          roundRect(ctx, inner.x, inner.y, inner.w, inner.h, inner.r); ctx.fillStyle = p.surface; ctx.fill(); ctx.restore();
        }
        ctx.save();
        clipInner(ctx, inner);
        if (img) {
          if (filter && !ctx.filter?.includes('blur')) ctx.filter = filter;
          ctx.imageSmoothingQuality = 'high';
          drawImageFit(ctx, img, inner, { fit: block.fit || 'cover', focus, zoom });
          ctx.filter = 'none';
        } else placeholderArt(ctx, c, inner, ref ? (c.assets?.failed(ref) ? '图片缺失' : '') : '未设置图片');
        if (overlay > 0) {
          const g = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
          g.addColorStop(0, toCss(p.bg, overlay * 0.55)); g.addColorStop(1, toCss(p.bg, Math.min(0.95, overlay * 1.35)));
          ctx.fillStyle = g; ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
        }
        ctx.restore();
        chrome(ctx, c, kind, box, 'over');
        ctx.restore();
        if (capL) {
          const cy = kind === 'polaroid' ? box.y + box.h - capH - box.w * 0.03 : box.y + box.h + env.sizes.small * 0.6;
          drawText(ctx, capL, rect.x, cy, rect.w, paintFor(c, kind === 'polaroid' ? '#333' : p.mutedText, { flat: true }), textAnimator(env, capL, 'fade', { unit: 'line' }), t - dur * 0.6);
        }
      },
    };
  },
  prepare(block, { assets }) { const r = imageRef(block); if (r) assets.image(r); },
};

const gallery = {
  type: 'gallery',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.6), fill: true }; },
  build(block, c, rect) {
    const { env } = c;
    const imgs = (block.images || []).slice(0, 9);
    const n = imgs.length || 1;
    const gap = env.grid.gutter;
    const lay = block.layout && block.layout !== 'auto' ? block.layout : n === 3 ? 'mosaic' : n <= 4 ? 'row' : 'grid';
    const boxes = [];
    if (lay === 'mosaic' && n >= 3) {
      const bw = (rect.w - gap) * 0.58;
      boxes.push({ x: rect.x, y: rect.y, w: bw, h: rect.h });
      const rh = (rect.h - gap * (n - 2)) / (n - 1);
      for (let i = 1; i < n; i++) boxes.push({ x: rect.x + bw + gap, y: rect.y + (i - 1) * (rh + gap), w: rect.w - bw - gap, h: rh });
    } else {
      const cols = lay === 'row' ? n : Math.ceil(Math.sqrt(n * (rect.w / rect.h)));
      const rows = Math.ceil(n / cols);
      const cw = (rect.w - gap * (cols - 1)) / cols, ch = (rect.h - gap * (rows - 1)) / rows;
      for (let i = 0; i < n; i++) boxes.push({ x: rect.x + (i % cols) * (cw + gap), y: rect.y + Math.floor(i / cols) * (ch + gap), w: cw, h: ch });
    }
    const insts = imgs.map((im, i) => image.build({ ...(typeof im === 'string' ? { asset: im } : im), frame: 'rounded', caption: im.caption }, c, boxes[i]));
    const per = Math.min(0.18, 1.2 / n) * env.motion.tempo;
    return {
      duration: per * (n - 1) + (insts[0]?.duration || 1), hold: 1.5 + n * 0.3,
      draw(ctx, t, ds) { insts.forEach((it, i) => { const ti = t - i * per; if (ti > 0) { ctx.save(); it.draw(ctx, ti, ds); ctx.restore(); } }); },
    };
  },
  prepare(block, { assets }) { for (const im of block.images || []) assets.image(typeof im === 'string' ? im : im.asset || { src: im.src }); },
};

const icon = {
  type: 'icon',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, Math.min(w, c.env.sizes.display * 2.4)), fill: false }; },
  build(block, c, rect) {
    const { env, p } = c;
    const L = block.label ? c.te.layout(block.label, role(env, 'heading'), env.sizes.lead, { maxWidth: rect.w, align: 'center', balance: true }) : null;
    const lh = L ? L.height + env.sizes.body : 0;
    const R = Math.min(rect.w, rect.h - lh) * 0.42;
    const cx = rect.x + rect.w / 2, cy = rect.y + (rect.h - lh) / 2;
    const badge = block.badge && block.badge !== 'auto' ? block.badge : 'circle';
    return {
      duration: 1.4 * env.motion.tempo, hold: 1,
      draw(ctx, t) {
        const k = env.motion.spring ? env.motion.spring(clamp01(t / 0.8)) : EASE.outBack(clamp01(t / 0.7));
        if (k <= 0) return;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
        if (badge !== 'none') {
          ctx.beginPath();
          if (badge === 'square') roundRect(ctx, -R, -R, R * 2, R * 2, R * 0.3); else ctx.arc(0, 0, R, 0, TAU);
          const g = ctx.createRadialGradient(0, -R * 0.4, 0, 0, 0, R * 1.2);
          g.addColorStop(0, toCss(p.accent, p.dark ? 0.32 : 0.2)); g.addColorStop(1, toCss(p.accent, p.dark ? 0.08 : 0.06));
          ctx.fillStyle = g; ctx.fill();
          ctx.lineWidth = Math.max(1.5, env.unit * 2); ctx.strokeStyle = toCss(p.accent, 0.4); ctx.stroke();
        }
        if (env.theme.chart?.glow) { ctx.shadowColor = p.accent; ctx.shadowBlur = R * 0.3; }
        drawIcon(ctx, block.name, 0, 0, R * 1.05, p.accentText, { stroke: 1.6, draw: clamp01((t - 0.1) / (1.1 * env.motion.tempo)) });
        ctx.restore();
        if (L) drawText(ctx, L, rect.x, cy + R + env.sizes.body, rect.w, paintFor(c, p.ink), textAnimator(env, L, env.motion.enter, {}), t - 0.4);
      },
    };
  },
};

// ───────────────────────────── video ─────────────────────────────
/** Video frames are made seekable by the engine via prepareFrame(t) (see engine/index.js). */
const video = {
  type: 'video',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.5625), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const kind = frameKind(block, c);
    const bleed = !!(c.hint?.bleed || c.hint?.backdrop);
    const trim = Array.isArray(block.trim) ? block.trim : [0, null];
    const dur = env.motion.duration;
    const track = c.assets?.video?.(block.asset);
    return {
      duration: bleed ? 0.6 : dur, hold: Math.max(1, (trim[1] ?? 6) - trim[0]),
      videoTime: (localT) => trim[0] + Math.max(0, localT),
      track, asset: block.asset, trim,
      draw(ctx, t) {
        const e = env.motion.ease(clamp01(t / dur));
        ctx.save();
        ctx.globalAlpha *= bleed ? clamp01((t + 0.2) / 0.7) : clamp01(t / 0.35);
        if (!bleed) { const s = 0.94 + 0.06 * e; ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2); ctx.scale(s, s); ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2)); }
        const inner = chrome(ctx, c, kind, rect, 'under');
        ctx.save(); clipInner(ctx, inner);
        const el = track?.element;
        if (el && el.readyState >= 2) drawImageFit(ctx, el, inner, { fit: block.fit || 'cover' });
        else { placeholderArt(ctx, c, inner, '视频'); }
        if (c.hint?.overlay) { ctx.fillStyle = toCss(p.bg, c.hint.overlay); ctx.fillRect(inner.x, inner.y, inner.w, inner.h); }
        ctx.restore();
        chrome(ctx, c, kind, rect, 'over');
        ctx.restore();
      },
    };
  },
};

// ───────────────────────────── shape ─────────────────────────────
const shape = {
  type: 'shape',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, c.env.sizes.body * 3), fill: false }; },
  build(block, c, rect) {
    const { env, p } = c;
    const col = colorOf(p, block.color, p.accent);
    const lw = Math.max(2, env.unit * (env.theme.shape.stroke + 2));
    const kind = block.kind || 'rect';
    const L = block.text ? c.te.layout(block.text, role(env, 'text', { weight: 600 }), env.sizes.body, { maxWidth: Math.max(rect.w * 0.9, 200), align: 'center' }) : null;
    return {
      duration: 0.9 * env.motion.tempo, hold: 0.8,
      draw(ctx, t) {
        const d = EASE.inOutCubic(clamp01(t / (0.8 * env.motion.tempo)));
        if (d <= 0) return;
        ctx.save();
        ctx.strokeStyle = col; ctx.fillStyle = block.fill ? toCss(col, 0.18) : 'transparent'; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const { x, y, w, h } = rect;
        const perim = (path, len) => { ctx.setLineDash([len * d, len]); path(); ctx.stroke(); ctx.setLineDash([]); };
        switch (kind) {
          case 'circle': { const cx = x + w / 2, cy = y + h / 2; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, -Math.PI / 2, -Math.PI / 2 + TAU * d); if (block.fill) { ctx.globalAlpha *= d; ctx.fill(); ctx.globalAlpha /= d || 1; } ctx.stroke(); break; }
          case 'line': ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w * d, y + h / 2); ctx.stroke(); break;
          case 'arrow': {
            const ex = x + w * d, ey = y + h / 2;
            ctx.beginPath(); ctx.moveTo(x, ey); ctx.lineTo(ex, ey); ctx.stroke();
            if (d > 0.9) { const s = Math.min(h, lw * 6); ctx.beginPath(); ctx.moveTo(ex - s, ey - s * 0.6); ctx.lineTo(ex, ey); ctx.lineTo(ex - s, ey + s * 0.6); ctx.stroke(); }
            break;
          }
          case 'highlight': { ctx.globalAlpha *= 0.85; ctx.fillStyle = toCss(col, 0.28); ctx.fillRect(x, y, w * d, h); break; }
          case 'brace': {
            ctx.beginPath();
            const m = x + w / 2, q = h * 0.5;
            ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y + q, x + w * 0.25, y + q); ctx.lineTo(m - w * 0.05, y + q); ctx.quadraticCurveTo(m, y + q, m, y + h);
            ctx.moveTo(x + w, y); ctx.quadraticCurveTo(x + w, y + q, x + w * 0.75, y + q); ctx.lineTo(m + w * 0.05, y + q); ctx.quadraticCurveTo(m, y + q, m, y + h);
            ctx.globalAlpha *= d; ctx.stroke(); break;
          }
          default: perim(() => { roundRect(ctx, x, y, w, h, env.theme.shape.radius * env.unit * 0.5); if (block.fill) ctx.fill(); }, 2 * (w + h));
        }
        ctx.restore();
        if (L) drawText(ctx, L, x + (w - Math.max(rect.w * 0.9, 200)) / 2, kind === 'brace' ? y + h + env.sizes.body * 0.4 : y + h / 2 - L.height / 2, Math.max(rect.w * 0.9, 200), paintFor(c, kind === 'highlight' || block.fill ? p.ink : col, { flat: true }), textAnimator(env, L, 'fade', { unit: 'line' }), t - 0.4);
      },
    };
  },
};

// ───────────────────────────── code ─────────────────────────────
const KW = new Set('const let var function return if else for while do break continue new class extends import from export default async await try catch finally throw typeof instanceof in of def lambda pass yield with as elif None True False null true false undefined this self fn pub struct enum impl match use mod mut trait where loop package func go defer type interface map chan select case switch public private protected static void int float double bool string char long short final SELECT FROM WHERE JOIN ON GROUP BY ORDER INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE AND OR NOT AS LIMIT echo fi then done esac'.split(' '));

function highlightLine(line, lang) {
  const toks = [];
  const re = /(\/\/.*$|#(?!include).*$|--.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)(?=\s*\()|([A-Za-z_][\w]*)|(\s+)|([^\sA-Za-z_\d"'`]+)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[1] && !(lang === 'js' && m[1].startsWith('#')) && !(m[1].startsWith('--') && !['sql', 'lua', 'haskell'].includes(lang)) && !(m[1].startsWith('#') && ['js', 'ts', 'json', 'css', 'html'].includes(lang))) toks.push(['comment', m[1]]);
    else if (m[1]) toks.push(['plain', m[1]]);
    else if (m[2]) toks.push(['string', m[2]]);
    else if (m[3]) toks.push(['number', m[3]]);
    else if (m[4]) toks.push([KW.has(m[4]) ? 'keyword' : 'func', m[4]]);
    else if (m[5]) toks.push([KW.has(m[5]) ? 'keyword' : /^[A-Z]/.test(m[5]) ? 'type' : 'plain', m[5]]);
    else toks.push(['plain', m[0]]);
  }
  return toks;
}

const code = {
  type: 'code',
  measure(block, c, w, maxH) {
    const lines = String(block.code || '').split('\n').length;
    return { h: Math.min(maxH, (lines + 2.4) * c.env.sizes.small * 1.6 + c.env.sizes.body), fill: false };
  },
  build(block, c, rect) {
    const { env, p, te } = c;
    const lines = String(block.code || '').replace(/\t/g, '  ').split('\n');
    const lang = String(block.language || '').toLowerCase().replace('javascript', 'js').replace('typescript', 'ts').replace('python', 'py');
    const maxLen = Math.max(...lines.map((l) => l.length), 10);
    const bar = env.sizes.body * 1.6;
    const pad = env.sizes.body * 0.9;
    let fs = Math.min(env.sizes.body, (rect.h - bar - pad * 2) / (lines.length * 1.55));
    const monoRole = { family: ['Motif Mono', 'Motif Sans SC'], weight: 450 };
    const cw = te.width('M', fontString(monoRole, 100)) / 100;
    fs = Math.min(fs, (rect.w - pad * 2 - fs * 3) / (maxLen * cw));
    const lh = fs * 1.55;
    const boxH = Math.min(rect.h, bar + pad * 2 + lines.length * lh);
    const box = { x: rect.x, y: rect.y + (rect.h - boxH) / 2, w: rect.w, h: boxH };
    const dark = true;
    const bg = p.dark ? mix(p.bg, '#000000', 0.35) : '#16181d';
    const colors = { keyword: p.dark ? p.accent2 || '#c792ea' : '#c792ea', string: p.dark ? p.data[2] || '#c3e88d' : '#c3e88d', number: '#f78c6c', comment: '#6b7280', func: p.dark ? p.accent : '#82aaff', type: '#ffcb6b', plain: '#e5e7eb' };
    const toks = lines.map((l) => highlightLine(l, lang));
    const total = lines.reduce((s, l) => s + l.length + 1, 0);
    const typing = block.typing !== false;
    const cps = 55 * (0.7 + env.energy * 0.6);
    const tType = 0.5;
    const hl = new Set((block.highlight || []).map((n) => n - 1));
    const typeDur = typing ? total / cps : 0.4;
    const titleFont = fontString(role(env, 'text', { weight: 500 }), env.sizes.caption);
    void dark;
    return {
      duration: tType + typeDur + 0.5, hold: 1.5 + lines.length * 0.3,
      draw(ctx, t) {
        withState(ctx, blockState(c, t, 'rise', { size: env.sizes.h2 }), box, () => {
          ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40 * env.unit; ctx.shadowOffsetY = 14 * env.unit;
          roundRect(ctx, box.x, box.y, box.w, box.h, 14 * env.unit); ctx.fillStyle = bg; ctx.fill(); ctx.restore();
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; roundRect(ctx, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, 14 * env.unit); ctx.stroke();
          ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { ctx.beginPath(); ctx.arc(box.x + bar * 0.6 + i * bar * 0.42, box.y + bar / 2, bar * 0.12, 0, TAU); ctx.fillStyle = col; ctx.fill(); });
          if (block.title) { ctx.font = titleFont; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(block.title, box.x + box.w / 2, box.y + bar / 2); ctx.textAlign = 'left'; }
          let shown = typing ? Math.floor((t - tType) * cps) : total;
          const x0 = box.x + pad + fs * 2.6;
          ctx.textBaseline = 'alphabetic';
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          let caret = null;
          toks.forEach((lt, li) => {
            const y = box.y + bar + pad + li * lh;
            if (hl.has(li)) { const a = clamp01((t - tType - typeDur) / 0.5); ctx.fillStyle = toCss(p.accent, 0.14 * a); ctx.fillRect(box.x, y - lh * 0.12, box.w * a, lh); ctx.fillStyle = toCss(p.accent, a); ctx.fillRect(box.x, y - lh * 0.12, 3 * env.unit, lh); }
            ctx.font = fontString(monoRole, fs * 0.85); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.textAlign = 'right';
            if (shown > 0) ctx.fillText(String(li + 1), box.x + pad + fs * 1.6, y + lh * 0.7);
            ctx.textAlign = 'left';
            let x = x0;
            for (const [kind, text] of lt) {
              if (shown <= 0) break;
              const part = text.slice(0, shown);
              ctx.font = fontString({ ...monoRole, weight: kind === 'keyword' ? 600 : 450 }, fs);
              ctx.fillStyle = colors[kind] || colors.plain;
              if (kind === 'comment') ctx.font = fontString({ ...monoRole, weight: 400 }, fs);
              ctx.fillText(part, x, y + lh * 0.7);
              x += te.width(part, ctx.font);
              shown -= part.length;
              if (shown <= 0 && part.length <= text.length) caret = { x, y };
            }
            shown -= 1;
            if (shown === -1 && !caret) caret = { x, y };
          });
          if (caret && Math.floor(t * 2.4) % 2 === 0) { ctx.fillStyle = p.accent; ctx.fillRect(caret.x + 1, caret.y + lh * 0.1, fs * 0.55, lh * 0.75); }
        });
      },
    };
  },
};

export default [image, gallery, icon, video, shape, code];
