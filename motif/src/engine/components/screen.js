// Screen recording component: the recorded picture on a background, in a window frame, with the
// automatic camera (zoom segments that follow the cursor), a smoothed software cursor with click
// effects, and the webcam picture-in-picture. Deterministic per frame like every component: the
// frame at output time t only depends on the block and the recorded files.
//
// Times: the block plays the source through `clips` (cuts and speed). Zooms, the pointer track and
// the webcam are in source time, so the frame at output time t samples everything at
// src = outToSrc(clips, t).
import { roundRect, clamp01, toCss } from './kit.js';
import { drawImageFit } from './media.js';
import {
  BACKGROUNDS, screenSettings, screenRect, cameraRect,
  normalizeClips, outDuration, outToSrc,
  sortZooms, sampleZoom, viewport,
  parsePointerTrack, CursorPath, FollowPath,
} from '../../core/screen/index.js';

const TAU = Math.PI * 2;

/**
 * Smoothing for video frames. Live previews draw on a GPU canvas, where a clipped video frame
 * drawn with 'medium'/'high' smoothing can wipe what was drawn before it (seen with SwiftShader);
 * bilinear is safe there. Exports render on a CPU canvas and get the sharper filter, which keeps
 * small text readable when a large screen is scaled down.
 */
export function videoQuality(ds) { return ds?.live ? 'low' : 'high'; }

/** Pointer track entry for a block (loaded by prepare). */
function pointerEntry(assets, ref) {
  if (!ref || !assets) return null;
  const url = assets.urlFor(ref);
  return url ? assets.extra.get('ptr:' + url) || null : null;
}

const pathCache = new WeakMap();
function pathsFor(data, zooms, duration, smooth) {
  if (!data) return null;
  let byKey = pathCache.get(data);
  if (!byKey) { byKey = new Map(); pathCache.set(data, byKey); }
  const key = `${smooth}|${duration.toFixed(3)}|${JSON.stringify(zooms)}`;
  let hit = byKey.get(key);
  if (!hit) {
    const track = parsePointerTrack(data);
    const path = new CursorPath(track, { smooth: smooth ? 'smooth' : 'raw' });
    const follow = track.events.length ? new FollowPath(path, zooms, { duration }) : null;
    hit = { track, path, follow };
    if (byKey.size > 6) byKey.clear();
    byKey.set(key, hit);
  }
  return hit;
}

function gradient(ctx, r, preset) {
  const g = BACKGROUNDS[preset] || BACKGROUNDS.aurora;
  const a = ((g.angle - 90) * Math.PI) / 180;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const len = (Math.abs(Math.cos(a)) * r.w + Math.abs(Math.sin(a)) * r.h) / 2;
  const lg = ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
  g.stops.forEach((c, i) => lg.addColorStop(i / Math.max(1, g.stops.length - 1), c));
  ctx.fillStyle = lg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // A soft light from the upper left and a deeper corner, so a flat gradient reads as depth.
  const R = Math.max(r.w, r.h);
  const rg = ctx.createRadialGradient(r.x + r.w * 0.22, r.y + r.h * 0.12, 0, r.x + r.w * 0.22, r.y + r.h * 0.12, R * 0.75);
  rg.addColorStop(0, toCss(g.glow, 0.32)); rg.addColorStop(1, toCss(g.glow, 0));
  ctx.fillStyle = rg; ctx.fillRect(r.x, r.y, r.w, r.h);
  const vg = ctx.createRadialGradient(r.x + r.w * 0.85, r.y + r.h * 1.05, 0, r.x + r.w * 0.85, r.y + r.h * 1.05, R * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0.18)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);
}

function drawBackdrop(ctx, c, r, s, video, ds) {
  const bg = s.background;
  const u = c.env.unit;
  switch (bg.type) {
    case 'none': return;
    case 'color': ctx.fillStyle = bg.color || '#16181f'; ctx.fillRect(r.x, r.y, r.w, r.h); return;
    case 'image': {
      const img = bg.image ? c.assets?.image(bg.image) : null;
      if (img) drawImageFit(ctx, img, r, { fit: 'cover' });
      else gradient(ctx, r, bg.preset);
      return;
    }
    case 'blur': {
      ctx.fillStyle = '#111318'; ctx.fillRect(r.x, r.y, r.w, r.h);
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.imageSmoothingQuality = videoQuality(ds);
        ctx.filter = `blur(${Math.max(4, (Number(bg.blur) || 40) * u)}px) saturate(1.25) brightness(0.72)`;
        const m = Math.max(r.w, r.h) * 0.08;
        drawImageFit(ctx, video, { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 }, { fit: 'cover' });
        ctx.restore();
      }
      return;
    }
    default: gradient(ctx, r, bg.preset);
  }
}

/** Window chrome above the picture. Returns nothing; draws the bar into [pic.x, pic.y - bar]. */
function drawWindowBar(ctx, s, pic, rad, dark) {
  const bar = pic.bar;
  if (!bar) return;
  const x = pic.x, y = pic.y - bar, w = pic.w;
  ctx.save();
  roundRect(ctx, x, y, w, bar + rad, rad); ctx.clip();
  ctx.fillStyle = dark ? '#24262d' : '#eceef2';
  ctx.fillRect(x, y, w, bar);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    ctx.beginPath(); ctx.arc(x + bar * 0.62 + i * bar * 0.46, y + bar / 2, bar * 0.14, 0, TAU); ctx.fillStyle = col; ctx.fill();
  });
  if (s.window === 'browser') {
    const pw = Math.min(w * 0.46, bar * 16);
    roundRect(ctx, x + (w - pw) / 2, y + bar * 0.2, pw, bar * 0.6, bar * 0.3);
    ctx.fillStyle = dark ? '#16171c' : '#ffffff'; ctx.fill();
  }
  ctx.restore();
}

/** Rectangle with only the bottom corners rounded (picture under a window title bar). */
function bottomRounded(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.closePath();
}

// ───────────────────────────── cursor ─────────────────────────────

/** Arrow cursor outline, tip at (0, 0), height 1. */
function arrowPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 0.86);
  ctx.lineTo(0.22, 0.66);
  ctx.lineTo(0.37, 1.0);
  ctx.lineTo(0.5, 0.94);
  ctx.lineTo(0.355, 0.61);
  ctx.lineTo(0.63, 0.61);
  ctx.closePath();
}

function drawCursorShape(ctx, shape, x, y, h, angle, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (shape === 'text') {
    ctx.lineCap = 'round';
    const w = h * 0.22;
    for (const [col, lw] of [['rgba(255,255,255,0.95)', h * 0.13], ['#111216', h * 0.055]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.5); ctx.lineTo(w, -h * 0.5);
      ctx.moveTo(0, -h * 0.5); ctx.lineTo(0, h * 0.5);
      ctx.moveTo(-w, h * 0.5); ctx.lineTo(w, h * 0.5);
      ctx.stroke();
    }
  } else if (shape === 'cross') {
    for (const [col, lw] of [['rgba(255,255,255,0.95)', h * 0.12], ['#111216', h * 0.05]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-h * 0.45, 0); ctx.lineTo(h * 0.45, 0); ctx.moveTo(0, -h * 0.45); ctx.lineTo(0, h * 0.45); ctx.stroke();
    }
  } else {
    ctx.rotate(angle);
    ctx.scale(h, h);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = h * 0.18; ctx.shadowOffsetY = h * 0.06;
    arrowPath(ctx);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.075; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    // inner black arrow
    ctx.save(); ctx.translate(0.07, 0.13); ctx.scale(0.78, 0.78); arrowPath(ctx); ctx.restore();
    ctx.fillStyle = '#111216'; ctx.fill();
    if (shape === 'hand') { ctx.beginPath(); ctx.arc(0.5, 0.18, 0.12, 0, TAU); ctx.fillStyle = '#111216'; ctx.fill(); }
    if (shape === 'wait') { ctx.beginPath(); ctx.arc(0.62, 0.95, 0.16, 0, TAU); ctx.fillStyle = '#4f7cff'; ctx.fill(); }
  }
  ctx.restore();
}

function drawClick(ctx, kind, x, y, h, click, color) {
  const p = click.progress;
  const col = color || (click.kind === 'right' ? '#ffb020' : '#4f8cff');
  ctx.save();
  if (kind === 'ring') {
    const r = h * (1.1 - 0.55 * p);
    ctx.globalAlpha *= 1 - p;
    ctx.strokeStyle = col; ctx.lineWidth = h * 0.14;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  } else if (kind === 'pulse') {
    const r = h * (0.3 + 0.75 * Math.sin(Math.PI * Math.min(1, p * 1.2)));
    ctx.globalAlpha *= 0.45 * (1 - p);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  } else {
    const e = 1 - (1 - p) ** 3;
    for (const [k, a] of [[1, 0.9], [0.62, 0.5]]) {
      ctx.globalAlpha = a * (1 - p);
      ctx.strokeStyle = col; ctx.lineWidth = h * 0.09 * (1 - p * 0.6);
      ctx.beginPath(); ctx.arc(x, y, h * (0.25 + 1.15 * e * k), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 0.32 * (1 - p);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, h * 0.42 * (1 - p * 0.5), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ───────────────────────────── component ─────────────────────────────

const screen = {
  type: 'screen',
  measure(block, c, w, maxH) {
    const sw = block.source?.width || 16, sh = block.source?.height || 9;
    return { h: Math.min(maxH, w * (sh / sw)), fill: true };
  },
  prepare(block, { assets }) {
    if (block.asset) assets.video(block.asset);
    if (block.camera) assets.video(block.camera);
    const url = block.pointer ? assets.urlFor(block.pointer) : null;
    if (url) return assets.track('ptr:' + url, fetch(url).then((r) => { if (!r.ok) throw new Error(`光标轨迹读取失败（${r.status}）`); return r.json(); })).promise;
    return null;
  },
  build(block, c, rect) {
    const { env } = c;
    const s = screenSettings(block);
    const video = block.asset ? c.assets?.video?.(block.asset) : null;
    const cam = block.camera && s.camera.show !== false ? c.assets?.video?.(block.camera) : null;
    const el = video?.element;
    const srcW = block.source?.width || el?.videoWidth || 1920;
    const srcH = block.source?.height || el?.videoHeight || 1080;
    const D = Number(block.source?.duration) || (el && Number.isFinite(el.duration) ? el.duration : 0) || 5;
    const clips = normalizeClips(block.clips, D);
    const playLen = Math.max(0.1, outDuration(clips));
    const zooms = sortZooms(block.zooms);
    const pe = pointerEntry(c.assets, block.pointer);
    const P = pe?.done && !pe.error ? pathsFor(pe.value, zooms, D, s.cursor.smooth !== false) : null;
    const cursorInVideo = block.source?.cursorInVideo !== false;
    const overlay = !!P?.track.events.length && (s.cursor.show === 'overlay' || (s.cursor.show === 'auto' && !cursorInVideo));
    const effects = !!P?.track.events.length && s.cursor.show !== 'none';
    const full = rect.w >= env.W - 1 && rect.h >= env.H - 1;
    const pic = screenRect(rect.w, rect.h, srcW, srcH, s);
    pic.x += rect.x; pic.y += rect.y;
    const u = env.unit;
    const rad = s.radius * u;
    const issues = [];
    if (!block.asset) issues.push({ level: 'error', message: '录屏块缺少 asset（屏幕录像）' });
    if (pe?.error) issues.push({ level: 'warning', message: `光标轨迹不可用：${pe.error.message || pe.error}`, hint: '光标特效与自动运镜需要录制时生成的光标轨迹' });
    const srcAt = (lt) => outToSrc(clips, Math.max(0, lt));
    const toComp = (f) => [(pic.x + f[0] * pic.w - rect.x) / rect.w, (pic.y + f[1] * pic.h - rect.y) / rect.h];
    const autoFocus = P?.follow ? (t) => P.follow.at(t) : (P ? (t) => P.path.at(t) : null);
    const camOffset = Number(block.source?.cameraOffset) || 0;
    const mediaTracks = [];
    if (video) mediaTracks.push({ track: video, time: (lt) => srcAt(lt).src });
    if (cam) mediaTracks.push({ track: cam, time: (lt) => Math.max(0, srcAt(lt).src - camOffset) });

    const inst = {
      duration: full ? 0 : 0.45, hold: 0, immediate: true, minDuration: playLen,
      tracks: mediaTracks,
      /** Source time and camera state at output time lt (editor overlays use this). */
      sample(lt) {
        const m = srcAt(lt);
        const z = sampleZoom(zooms, m.src, { sorted: true, autoFocus });
        return { ...m, zoom: z };
      },
      draw(ctx, lt, ds = {}) {
        const m = srcAt(lt);
        const src = m.src;
        if (ds.live) {
          video?.sync?.(src, ds.playing, m.speed);
          cam?.sync?.(Math.max(0, src - camOffset), ds.playing, m.speed);
        }
        ctx.save();
        if (!full) {
          const a = clamp01(lt / 0.35);
          ctx.globalAlpha *= a;
          roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(rect.w, rect.h) * 0.02); ctx.clip();
        } else { ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip(); }

        // camera (zoom) over the whole composition
        const z = sampleZoom(zooms, src, { sorted: true, autoFocus });
        let vp = { scale: 1, tx: 0, ty: 0 };
        if (z.scale > 1.0001 || z.transition) {
          const mapped = { ...z, focus: toComp(z.focus) };
          if (z.transition) mapped.transition = { ...z.transition, from: { ...z.transition.from, focus: toComp(z.transition.from.focus) }, to: { ...z.transition.to, focus: toComp(z.transition.to.focus) } };
          vp = viewport(mapped);
        }
        ctx.save();
        ctx.translate(rect.x + rect.w * (0.5 + vp.tx), rect.y + rect.h * (0.5 + vp.ty));
        ctx.scale(vp.scale, vp.scale);
        ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));

        drawBackdrop(ctx, c, rect, s, el, ds);
        const top = pic.y - pic.bar;
        const fullH = pic.h + pic.bar;
        // shadow
        if (s.shadow > 0 && s.background.type !== 'none') {
          ctx.save();
          ctx.shadowColor = `rgba(0,0,0,${0.55 * s.shadow})`;
          ctx.shadowBlur = 60 * u * s.shadow; ctx.shadowOffsetY = 22 * u * s.shadow;
          roundRect(ctx, pic.x, top, pic.w, fullH, rad); ctx.fillStyle = '#000'; ctx.fill();
          ctx.restore();
        }
        drawWindowBar(ctx, s, pic, rad, s.background.type === 'blur' || /midnight|ocean|aurora|ember|dusk|forest/.test(s.background.preset));
        ctx.save();
        if (pic.bar) bottomRounded(ctx, pic.x, pic.y, pic.w, pic.h, rad);
        else roundRect(ctx, pic.x, pic.y, pic.w, pic.h, rad);
        ctx.clip();
        ctx.imageSmoothingQuality = videoQuality(ds);
        if (el && el.readyState >= 2) ctx.drawImage(el, pic.x, pic.y, pic.w, pic.h);
        else { ctx.fillStyle = '#1b1d24'; ctx.fillRect(pic.x, pic.y, pic.w, pic.h); }
        ctx.restore();

        // cursor and click effects, in picture space (they zoom with the picture)
        if (effects) {
          const pos = P.path.at(src);
          if (pos) {
            const h = pic.h * 0.03 * s.cursor.size;
            const x = pic.x + pos[0] * pic.w, y = pic.y + pos[1] * pic.h;
            let alpha = 1;
            if (s.cursor.hideIdle) alpha = 1 - clamp01((P.path.idleFor(src) - s.cursor.idleDelay) / 0.35);
            const click = s.cursor.click !== 'none' ? P.path.clickAt(src, 0.55) : null;
            if (click) drawClick(ctx, s.cursor.click, pic.x + click.x * pic.w, pic.y + click.y * pic.h, h, click, s.cursor.clickColor);
            if (overlay && alpha > 0.001) {
              if (s.cursor.highlight) {
                const g = ctx.createRadialGradient(x, y, 0, x, y, h * 1.6);
                g.addColorStop(0, `rgba(255,214,64,${0.45 * alpha})`); g.addColorStop(1, 'rgba(255,214,64,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, h * 1.6, 0, TAU); ctx.fill();
              }
              // Press: the arrow dips slightly while the button is down.
              const press = click ? 1 - 0.12 * Math.sin(Math.PI * Math.min(1, click.elapsed / 0.22)) * (click.elapsed < 0.22 ? 1 : 0) : 1;
              drawCursorShape(ctx, P.path.shape(src), x, y, h * press, P.path.tilt(src, s.cursor.tilt), alpha);
            }
          }
        }
        ctx.restore(); // camera

        // webcam bubble, outside the zoom (it shrinks while zoomed in)
        if (cam && cam.element.readyState >= 2) {
          const cr = cameraRect(rect.w, rect.h, s.camera, vp.scale);
          cr.x += rect.x; cr.y += rect.y;
          const shapeR = s.camera.shape === 'circle' ? Math.min(cr.w, cr.h) / 2 : s.camera.shape === 'rounded' ? Math.min(cr.w, cr.h) * 0.18 : 0;
          const clipCam = () => { if (s.camera.shape === 'circle') { ctx.beginPath(); ctx.arc(cr.x + cr.w / 2, cr.y + cr.h / 2, Math.min(cr.w, cr.h) / 2, 0, TAU); } else roundRect(ctx, cr.x, cr.y, cr.w, cr.h, shapeR); };
          ctx.save();
          if (s.camera.shadow > 0) { ctx.shadowColor = `rgba(0,0,0,${0.5 * s.camera.shadow})`; ctx.shadowBlur = 36 * u * s.camera.shadow; ctx.shadowOffsetY = 12 * u * s.camera.shadow; clipCam(); ctx.fillStyle = '#000'; ctx.fill(); }
          ctx.restore();
          ctx.save();
          clipCam(); ctx.clip();
          ctx.imageSmoothingQuality = videoQuality(ds);
          if (s.camera.mirror) { ctx.translate(cr.x * 2 + cr.w, 0); ctx.scale(-1, 1); }
          drawImageFit(ctx, cam.element, cr, { fit: 'cover' });
          ctx.restore();
          if (s.camera.border > 0) { ctx.save(); clipCam(); ctx.lineWidth = s.camera.border * u; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke(); ctx.restore(); }
        }
        ctx.restore();
      },
      issues,
    };
    return inst;
  },
};

export default [screen];
