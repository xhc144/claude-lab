// Frame renderer: draws a compiled document at time t. Deterministic — the same (doc, t) always
// produces the same pixels, which is what makes scrubbing, AI previews and export identical.
import { drawBackground, backgroundSpec, makeCanvas } from './backgrounds.js';
import { composite } from './transitions.js';
import { EASE, clamp01 } from './motion/easing.js';
import { toCss } from '../core/util/color.js';
import { fontString, TextEngine, drawLayout, splitMath } from './text/text.js';
import { roundRect, REC } from './components/kit.js';
import { drawGuide, guideSay } from './guide.js';

const layers = [];
function layer(i, w, h) {
  let c = layers[i];
  if (!c) { c = layers[i] = makeCanvas(w, h); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

export function activeScenes(C, t) {
  const out = [];
  for (const s of C.scenes) if (t >= s.start - 1e-6 && t < s.end + 1e-6) out.push(s);
  if (!out.length && C.scenes.length) out.push(t <= 0 ? C.scenes[0] : C.scenes[C.scenes.length - 1]);
  return out.slice(-2);
}

function cameraTransform(ctx, env, cam, lt, dur) {
  if (!cam || cam.type === 'none' || !cam.amount) return;
  const A = cam.amount;
  const { W, H } = env;
  const u = clamp01(lt / Math.max(1, dur));
  let s = 1, dx = 0, dy = 0;
  switch (cam.type) {
    case 'drift': s = 1 + A * 0.016 * EASE.inOutSine(u); dx = Math.sin(lt * 0.21 + 1.3) * A * W * 0.004; dy = Math.cos(lt * 0.17) * A * H * 0.004; break;
    case 'push': s = 1 + A * 0.04 * EASE.outSine(u); break;
    case 'pull': s = 1 + A * 0.04 * (1 - EASE.outSine(u)); break;
    case 'pan': dx = (0.5 - u) * A * W * 0.025; s = 1 + A * 0.01; break;
    default:
  }
  ctx.translate(W / 2 + dx, H / 2 + dy);
  ctx.scale(s, s);
  ctx.translate(-W / 2, -H / 2);
}

function drawDecor(ctx, C, S, d, lt) {
  const { env } = C;
  const p = S.palette;
  if (d.kind === 'scrim') {
    const { W, H } = env;
    let g;
    if (d.side === 'bottom') { g = ctx.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, toCss(p.bg, 0)); g.addColorStop(1, toCss(p.bg, 0.85)); }
    else if (d.side === 'left') { g = ctx.createLinearGradient(0, 0, W * 0.75, 0); g.addColorStop(0, toCss(p.bg, 0.9)); g.addColorStop(1, toCss(p.bg, 0)); }
    else { g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, toCss(p.bg, 0.35)); g.addColorStop(1, toCss(p.bg, 0.7)); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return;
  }
  if (d.kind === 'section-number') {
    const style = d.style;
    const e = env.motion.ease(clamp01((lt - 0.1) / (env.motion.duration * 1.2)));
    if (e <= 0) return;
    const num = String(d.n).padStart(2, '0');
    const nr = env.fonts.number;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    if (style === 'giant-number') {
      const size = Math.min(env.H * 0.62, env.W * (env.portrait ? 0.95 : 2));
      ctx.font = fontString(nr, size);
      if ('fontStretch' in ctx) ctx.fontStretch = nr.stretch || 'normal';
      ctx.fillStyle = toCss(p.ink, 0.95);
      ctx.textAlign = 'right';
      ctx.beginPath(); ctx.rect(0, 0, env.W, env.H); ctx.clip();
      ctx.fillText(num, env.W - env.grid.mx * 0.6, env.H * 0.98 + (1 - e) * size * 0.7);
    } else if (style === 'rule') {
      ctx.globalAlpha = e;
      ctx.font = fontString(env.fonts.label, env.sizes.label);
      ctx.fillStyle = p.accentText; ctx.textAlign = 'center';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${env.sizes.label * 0.35}px`;
      const label = `CHAPTER  ${num}`;
      ctx.fillText(label, d.x, d.y + d.size * 0.7);
      const w = env.sizes.label * 3 * e;
      ctx.fillRect(d.x - w / 2, d.y + d.size * 0.95, w, Math.max(1, env.unit));
    } else if (style === 'sticker') {
      const R = d.size * 0.55;
      const k = env.motion.spring ? env.motion.spring(clamp01(lt / 0.7)) : e;
      ctx.translate(d.x + R, d.y + R * 0.6);
      ctx.rotate((-8 * Math.PI) / 180);
      ctx.scale(k, k);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = p.ink; ctx.fill();
      ctx.font = fontString(nr, R * 0.95);
      if ('fontStretch' in ctx) ctx.fontStretch = nr.stretch || 'normal';
      ctx.fillStyle = p.bg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(num, 0, R * 0.04);
    } else {
      ctx.font = fontString(nr, d.size);
      if ('fontStretch' in ctx) ctx.fontStretch = nr.stretch || 'normal';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(nr.tracking || 0) * d.size}px`;
      ctx.textAlign = d.align === 'center' ? 'center' : 'left';
      ctx.beginPath(); ctx.rect(d.x - d.size, d.y - d.size * 0.2, d.size * 6, d.size * 1.05); ctx.clip();
      ctx.lineWidth = Math.max(1.5, env.unit * 2.2);
      ctx.strokeStyle = p.accentText === p.ink ? toCss(p.ink, 0.6) : p.accentText;
      ctx.strokeText(num, d.x, d.y + d.size * 0.82 + (1 - e) * d.size);
    }
    ctx.restore();
  }
}

function drawScene(ctx, C, S, lt, o) {
  const { env } = C;
  const ownBg = !C.persistent || S.tone !== 'base' || (S.scene.background && S.scene.background !== 'auto') || o.forceBg;
  if (ownBg) drawBackground(ctx, env, backgroundSpec(env, S.scene), S.palette, (o.globalT ?? lt), 'under', env.assets);
  ctx.save();
  if (!o.noCamera) cameraTransform(ctx, env, S.camera, lt, S.duration);
  const ds = { sceneT: lt, sceneDur: S.duration, frame: o.frame };
  // While an explanation track is live, components report where they drew text and items.
  const guided = !!(S.guide && lt >= S.guide.start - 0.05);
  if (guided) { REC.on = true; REC.texts = []; REC.items = []; REC.base = ctx.getTransform(); }
  let scrimDrawn = false;
  for (const it of S.items) {
    if (!it.bleed && !scrimDrawn) {
      for (const d of S.decor) if (d.kind === 'scrim') drawDecor(ctx, C, S, d, lt);
      scrimDrawn = true;
    }
    if (o.skip && o.skip.has(it.block.id)) continue;
    const local = lt - it.start;
    if (local < -0.0001 && !it.bleed) continue;
    REC.block = it.block.id; REC.item = null;
    ctx.save();
    try { it.inst.draw(ctx, local, ds); } catch (err) { if (!it._err) { it._err = true; console.error(err); } }
    ctx.restore();
  }
  if (!scrimDrawn) for (const d of S.decor) if (d.kind === 'scrim') drawDecor(ctx, C, S, d, lt);
  REC.on = false;
  for (const d of S.decor) if (d.kind !== 'scrim') drawDecor(ctx, C, S, d, lt);
  if (guided) { try { drawGuide(ctx, C, S, lt); } catch (err) { if (!S._guideErr) { S._guideErr = true; console.error(err); } } }
  ctx.restore();
  if (ownBg && !C.persistent) drawBackground(ctx, env, backgroundSpec(env, S.scene), S.palette, (o.globalT ?? lt), 'over', env.assets);
}

function drawChrome(ctx, C, t, S) {
  const { env, doc } = C;
  const st = doc.style || {};
  const p = S.palette;
  const { W, H } = env;
  if (st.progress) {
    const h = Math.max(3, 4 * env.unit);
    ctx.fillStyle = toCss(p.ink, 0.12); ctx.fillRect(0, H - h, W, h);
    ctx.fillStyle = p.accent; ctx.fillRect(0, H - h, W * clamp01(t / C.duration), h);
  }
  const label = env.fonts.label;
  const fs = env.sizes.caption;
  ctx.textBaseline = 'alphabetic';
  if (st.pageNumbers && C.scenes.length > 1) {
    ctx.font = fontString({ ...label, case: 'none' }, fs);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * 0.1}px`;
    ctx.fillStyle = p.mutedText; ctx.textAlign = 'right';
    ctx.fillText(`${String(S.index + 1).padStart(2, '0')} / ${String(C.scenes.length).padStart(2, '0')}`, W - env.grid.mx, H - env.grid.my * 0.42);
    ctx.textAlign = 'left';
  }
  if (doc.brand?.name || doc.brand?.footer) {
    ctx.font = fontString({ ...label, case: 'none' }, fs);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * 0.08}px`;
    ctx.fillStyle = p.mutedText;
    ctx.fillText([doc.brand.name, doc.brand.footer].filter(Boolean).join('  ·  '), env.grid.mx, H - env.grid.my * 0.42);
  }
  if (st.captions) {
    const say = guideSay(S, t - S.start);
    const text = say || S.scene.narration?.text;
    if (say) {
      drawCaption(ctx, env, say);
    } else if (text) {
      const sentences = captionSentences(text);
      const weight = (x) => x.replace(/\$[^$]*\$/g, (m) => 'x'.repeat(Math.ceil(m.length / 3))).length;
      const total = sentences.reduce((s, x) => s + weight(x), 0) || 1;
      const lt = (t - S.start) / S.duration;
      let acc = 0, cur = sentences[sentences.length - 1];
      for (const s of sentences) { acc += weight(s) / total; if (lt <= acc) { cur = s; break; } }
      drawCaption(ctx, env, cur);
    }
  }
}

const captionTE = new WeakMap();

/** Narration split into caption sentences; never inside a formula or a decimal number (3.14). */
function captionSentences(text) {
  const parts = [];
  let buf = '';
  for (const seg of splitMath(text)) {
    if (seg.math != null) { buf += `$${seg.math}$`; continue; }
    const pieces = seg.text.split(/(?<=[。！？!?；;]|(?<!\d)\.(?!\d)|\d\.(?!\d))\s*/);
    pieces.forEach((piece, i) => {
      buf += piece;
      if (i < pieces.length - 1) { if (buf.trim()) parts.push(buf.trim()); buf = ''; }
    });
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.length ? parts : [text];
}

// Laid out like any other text, so inline TeX is typeset and a long sentence wraps onto a
// second line (slightly smaller if needed) instead of being squeezed horizontally.
function drawCaption(ctx, env, cur) {
  const { W, H } = env;
  let te = captionTE.get(ctx);
  if (!te) { te = new TextEngine(ctx); captionTE.set(ctx, te); }
  const role = { ...env.fonts.text, case: 'none', tracking: 0, lineHeight: 1.3 };
  const size = env.sizes.small * 1.05, maxWidth = W * 0.8;
  let L = te.layout(cur, role, size, { maxWidth, balance: true, align: 'center' });
  if (L.lines.length > 2) L = te.fit(cur, role, { maxWidth, maxLines: 2, min: size * 0.7, max: size, balance: true, align: 'center' });
  const padX = size * 0.8, padY = size * 0.3;
  const bottom = H - env.grid.my * 0.95 + size * 0.3;
  const bw = L.width + padX * 2, bh = L.height + padY * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  roundRect(ctx, W / 2 - bw / 2, bottom - bh, bw, bh, size * 0.4); ctx.fill();
  drawLayout(ctx, L, W / 2 - L.width / 2, bottom - bh + padY, L.width, { color: '#ffffff', accent: '#ffffff', mark: 'rgba(255,255,255,0.25)' });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/**
 * Render compiled doc C at time t into ctx. `scale` maps design px → canvas px.
 * opts: { scale, chrome, frame, solo (render only one scene id), noCamera (editing: keep blocks where the layout put them) }
 */
export function renderFrame(ctx, C, t, opts = {}) {
  const { env } = C;
  const scale = opts.scale ?? 1;
  const pw = Math.round(env.W * scale), ph = Math.round(env.H * scale);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  if (!C.scenes.length) {
    drawBackground(ctx, env, { ...env.theme.background }, env.palette('base'), t, 'under');
    ctx.restore();
    return;
  }
  const act = opts.solo ? C.scenes.filter((s) => s.id === opts.solo) : activeScenes(C, t);
  if (C.persistent) drawBackground(ctx, env, { ...env.theme.background }, env.palette('base'), t, 'under', env.assets);
  if (act.length === 1) {
    const S = act[0];
    drawScene(ctx, C, S, opts.solo ? t : t - S.start, { globalT: t, frame: opts.frame, noCamera: opts.noCamera });
  } else {
    const [A, B] = act;
    const tr = B.transitionIn || { type: 'fade', duration: 0.6 };
    const p = clamp01((t - B.start) / Math.max(0.001, tr.duration));
    const transparentOK = C.persistent && A.tone === 'base' && B.tone === 'base' && ['fade', 'push', 'zoom', 'blur', 'morph'].includes(tr.type);
    const la = layer(0, pw, ph), lb = layer(1, pw, ph);
    for (const [L, S] of [[la, A], [lb, B]]) {
      const g = L.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, pw, ph);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      if (!transparentOK && C.persistent && S.tone === 'base' && !(S.scene.background && S.scene.background !== 'auto')) drawBackground(g, env, { ...env.theme.background }, env.palette('base'), t, 'under', env.assets);
      drawScene(g, C, S, t - S.start, { globalT: t, frame: opts.frame, noCamera: opts.noCamera });
    }
    if (transparentOK && (tr.type === 'fade' || tr.type === 'morph')) {
      ctx.save(); ctx.globalAlpha = 1 - EASE.inOutSine(p); ctx.drawImage(la, 0, 0, env.W, env.H); ctx.restore();
      ctx.save(); ctx.globalAlpha = EASE.inOutSine(p); ctx.drawImage(lb, 0, 0, env.W, env.H); ctx.restore();
    } else {
      composite(ctx, tr, p, la, lb, { W: env.W, H: env.H, unit: env.unit, palIn: B.palette, palOut: A.palette });
    }
  }
  if (C.persistent) drawBackground(ctx, env, { ...env.theme.background }, env.palette('base'), t, 'over', env.assets);
  if (opts.chrome !== false) drawChrome(ctx, C, t, act[act.length - 1]);
  ctx.restore();
}

/** Scene-local time where everything has settled (for stills / thumbnails). */
export function settledTime(S) {
  return Math.min(S.duration - 0.05, Math.max(S.contentEnd + 0.3, S.duration * 0.6));
}
