// Scene layout: picks a layout for `auto`, carves the frame into regions on the theme grid, and
// flows blocks inside regions. Responsive by construction — the same scene re-flows for 16:9,
// 9:16, 1:1 and 4:5 because regions are derived from the frame, not stored as coordinates.
import { COMPONENTS } from '../core/catalog/components.js';

/** Manually positioned (editor drag / AI frame). Only an {x,y,w,h} object counts. */
export const isFramed = (b) => !!b.frame && typeof b.frame === 'object';

const BACKDROP = new Set(['image', 'video', 'shape3d', 'particles', 'globe', 'model', 'surface', 'simulation', 'vectorfield']);
const SOLID_3D = new Set(['shape3d', 'model', 'molecule', 'surface', 'bars3d']);
const WIDE_VISUAL = new Set(['timeline', 'steps', 'table', 'flow', 'compare', 'features', 'stats', 'gallery', 'hierarchy']);

export function natureOf(b) {
  if (b.type === 'bullets' && b.style === 'cards') return 'visual';
  return COMPONENTS[b.type]?.nature || 'visual';
}

export function resolveLayout(scene, index, count) {
  if (scene.layout && scene.layout !== 'auto') return scene.layout;
  const blocks = scene.blocks.filter((b) => !b.hidden && !isFramed(b));
  const titles = blocks.filter((b) => b.type === 'title');
  const copy = blocks.filter((b) => natureOf(b) === 'copy');
  const vis = blocks.filter((b) => natureOf(b) === 'visual');
  if (!vis.length) {
    if (copy.length === 1 && copy[0].type === 'quote' && titles.length === 0) return 'quote';
    if (!copy.length && titles.length) {
      if (index === 0) return 'cover';
      if (index === count - 1 && count > 2) return 'closing';
      return titles[0].kicker && /^\s*(\d+|[一二三四五六七八九十]+|part|chapter|第)/i.test(titles[0].kicker) ? 'section' : 'cover';
    }
    // Title + a substantial list/paragraph reads best as an editorial split: headline left, copy right.
    const weight = copy.reduce((s, b) => s + String(b.text || '').length + (b.items || []).length * 16, 0);
    if (titles.length && copy.length === 1 && (copy[0].type === 'bullets' ? (copy[0].items || []).length >= 3 : weight >= 60)) return 'split';
    return 'stack';
  }
  if (vis.length === 1) {
    const v = vis[0];
    if (index === 0 && !copy.length && BACKDROP.has(v.type)) return 'cover';
    if (WIDE_VISUAL.has(v.type)) return copy.length && !['stats', 'compare'].includes(v.type) ? 'split' : 'stack';
    if ((v.type === 'image' || v.type === 'screen') && !copy.length && !titles.length) return 'full';
    if (v.type === 'stat' && !copy.length) return 'split';
    if (copy.length) return 'split';
    return 'focus';
  }
  const sameType = vis.every((b) => b.type === vis[0].type);
  if (sameType) return 'grid';
  return copy.length ? 'split' : 'grid';
}

function gapBetween(env, a, b) {
  const s = env.sizes.body;
  if (!a) return 0;
  if (a.type === 'title') return natureOf(b) === 'visual' ? s * 1.5 : s * 1.15;
  if (natureOf(b) === 'visual') return s * 1.3;
  return s * 0.95;
}

/**
 * Flow blocks vertically inside region r.
 * measureFn(block, w, maxH) → {h, fill}
 */
function flow(blocks, r, env, measureFn, valign = 'top') {
  if (!blocks.length) return [];
  const gaps = blocks.map((b, i) => gapBetween(env, blocks[i - 1], b));
  const totalGap = gaps.reduce((a, b) => a + b, 0);
  const avail = r.h - totalGap;
  const ms = blocks.map((b) => measureFn(b, r.w, avail));
  const fixed = ms.reduce((s, m, i) => s + (m.fill ? 0 : m.h), 0);
  const fills = ms.filter((m) => m.fill);
  let free = avail - fixed;
  // fill blocks share the remainder, but never below their measured minimum
  const fillH = fills.length ? Math.max(free / fills.length, 0) : 0;
  const heights = ms.map((m) => (m.fill ? Math.max(Math.min(fillH, m.max ?? Infinity), Math.min(m.h, fillH)) : Math.min(m.h, avail)));
  const used = heights.reduce((a, b) => a + b, 0) + totalGap;
  let y = r.y + (fills.length ? 0 : valign === 'center' ? Math.max(0, (r.h - used) / 2) : valign === 'bottom' ? Math.max(0, r.h - used) : 0);
  if (fills.length && used < r.h && valign === 'center') y += (r.h - used) / 2;
  return blocks.map((b, i) => {
    y += gaps[i];
    const rect = { x: r.x, y, w: r.w, h: heights[i] };
    y += heights[i];
    return { block: b, rect };
  });
}

/**
 * @returns {{ layout, placements:[{block, rect, hint}], decor:[], tone }}
 */
export function layoutScene(scene, env, mk, index, count) {
  const layout = resolveLayout(scene, index, count);
  const { W, H, grid } = env;
  let S = grid.safe;
  // keep content clear of burned-in captions
  if (env.doc?.style?.captions && scene.narration?.text) S = { ...S, h: S.h - env.sizes.small * 3 };
  const th = env.theme.layout || {};
  const portrait = env.portrait;
  const square = !portrait && env.aspect < 1.2;
  const blocks = scene.blocks.filter((b) => !b.hidden);
  const framed = blocks.filter(isFramed);
  const flowB = blocks.filter((b) => !isFramed(b));
  const title = flowB.find((b) => b.type === 'title');
  const rest = flowB.filter((b) => b !== title);
  const copy = rest.filter((b) => natureOf(b) === 'copy');
  const vis = rest.filter((b) => natureOf(b) === 'visual');
  const out = [];
  const decor = [];
  const hints = new Map();
  const hint = (b, h) => hints.set(b, { ...(hints.get(b) || {}), ...h });
  const measure = (b, w, maxH) => mk.measure(b, hints.get(b) || {}, w, maxH);
  const place = (arr) => arr.forEach((p) => out.push({ ...p, hint: hints.get(p.block) || {} }));
  const variant = scene.variant || {};
  const flip = variant.flip ?? (index % 2 === 1 && th.alternate !== false);

  switch (layout) {
    case 'cover':
    case 'closing': {
      const backdrop = vis.find((b) => BACKDROP.has(b.type));
      // A solid 3D object behind centred type fights the headline; give it its own half instead.
      const sideObject = backdrop && !portrait && !variant.align && SOLID_3D.has(backdrop.type);
      const align = variant.align || (sideObject ? 'left' : layout === 'closing' ? 'center' : th.coverAlign || 'left');
      let textR = { ...S };
      if (backdrop) {
        if (backdrop.type === 'image' || backdrop.type === 'video') {
          out.push({ block: backdrop, rect: { x: 0, y: 0, w: W, h: H }, hint: { bleed: true, overlay: backdrop.overlay ?? 0.45 } });
          decor.push({ kind: 'scrim', side: align === 'center' ? 'full' : 'left' });
          if (title) hint(title, { onImage: true });
        } else if (portrait || align === 'center') {
          const vr = portrait ? { x: 0, y: H * 0.42, w: W, h: H * 0.58 } : { x: 0, y: 0, w: W, h: H };
          out.push({ block: backdrop, rect: vr, hint: { backdrop: true } });
          if (portrait) textR = { ...S, h: H * 0.42 - S.y };
          else textR = { x: S.x + S.w * 0.1, y: S.y, w: S.w * 0.8, h: S.h * (backdrop.type === 'globe' ? 0.5 : 1) };
        } else {
          const vx = S.x + S.w * (flip ? 0 : 0.46);
          out.push({ block: backdrop, rect: { x: flip ? 0 : vx, y: 0, w: W - vx + (flip ? -W + S.x + S.w * 0.54 + vx : 0), h: H }, hint: { backdrop: true } });
          if (flip) { out[out.length - 1].rect = { x: 0, y: 0, w: S.x + S.w * 0.54, h: H }; textR = { x: S.x + S.w * 0.52, y: S.y, w: S.w * 0.48, h: S.h }; }
          else textR = { x: S.x, y: S.y, w: S.w * 0.5, h: S.h };
        }
      }
      if (!backdrop && align === 'center') textR = { x: S.x + S.w * 0.08, y: S.y, w: S.w * 0.84, h: S.h };
      if (!backdrop && align !== 'center' && !portrait) textR = { x: S.x, y: S.y, w: S.w * 0.82, h: S.h };
      const items = [title, ...copy, ...vis.filter((b) => b !== backdrop)].filter(Boolean);
      if (title) hint(title, { titleRole: 'display', align, rule: true, maxLines: 3 });
      copy.forEach((b) => hint(b, { align, textSize: 'lead' }));
      const valign = layout === 'closing' ? 'center' : th.coverValign || 'center';
      place(flow(items, textR, env, measure, valign));
      break;
    }
    case 'section': {
      const align = variant.align || (th.section === 'rule' ? 'center' : 'left');
      let num = scene.sectionNumber;
      if (num == null) {
        const visible = (env.doc?.scenes || []).filter((sc) => !sc.hidden);
        num = 0;
        for (let i = 0; i <= index && i < visible.length; i++) if (resolveLayout(visible[i], i, visible.length) === 'section') num++;
        num = num || index;
      }
      const r = align === 'center' ? { x: S.x + S.w * 0.1, y: S.y, w: S.w * 0.8, h: S.h } : { x: S.x, y: S.y, w: S.w * (portrait ? 1 : 0.78), h: S.h };
      if (title) hint(title, { titleRole: 'display', align, maxLines: 3 });
      copy.forEach((b) => hint(b, { align, textSize: 'lead' }));
      const items = [title, ...copy, ...vis].filter(Boolean);
      const giant = th.section === 'giant-number';
      const numH = giant ? 0 : env.sizes.display * 1.25;
      // portrait: the giant numeral owns the lower half, so the words sit above it
      const tr = giant && portrait ? { ...r, h: r.h * 0.5 } : { ...r, y: r.y + numH * 0.5, h: r.h - numH * 0.5 };
      const placed = flow(items, tr, env, measure, 'center');
      const top = placed.length ? placed[0].rect.y : r.y + r.h / 2;
      decor.push({ kind: 'section-number', n: num, x: align === 'center' ? W / 2 : r.x, y: top - numH * 1.0, size: env.sizes.display * 1.15, align, style: th.section || 'number' });
      place(placed);
      break;
    }
    case 'quote': {
      const q = copy.find((b) => b.type === 'quote') || copy[0];
      const align = variant.align || (env.theme.layout?.titleAlign === 'center' ? 'center' : 'left');
      const r = portrait ? { ...S } : { x: S.x + S.w * (align === 'center' ? 0.1 : 0.06), y: S.y, w: S.w * (align === 'center' ? 0.8 : 0.76), h: S.h };
      const items = [title, q, ...copy.filter((b) => b !== q), ...vis].filter(Boolean);
      items.forEach((b) => hint(b, { align, titleRole: 'h2' }));
      place(flow(items, r, env, measure, 'center'));
      break;
    }
    case 'split': {
      const media = vis.length ? vis : copy.slice(-1);
      const text = [title, ...copy.filter((b) => !media.includes(b))].filter(Boolean);
      const textHeavy = copy.reduce((s, b) => s + String(b.text || '').length + (b.items?.length || 0) * 18, 0) > 140;
      if (portrait || square && media.some((b) => WIDE_VISUAL.has(b.type))) {
        if (title) hint(title, { titleRole: 'h1', align: 'left', maxLines: 4 });
        copy.forEach((b) => hint(b, { textSize: 'lead' }));
        media.forEach((b) => hint(b, { valign: 'center', ...(text.length ? {} : { hero: true, align: 'center' }) }));
        if (!text.length) { place(gridOrStack(media, S, env, measure, 'center')); break; }
        const fills = media.length === 1 && measure(media[0], S.w, S.h * 0.6).fill;
        if (!fills) { place(flow([...text, ...media], S, env, measure, 'center')); break; }
        const tp = flow(text, { ...S, h: S.h * 0.42 }, env, measure, 'top');
        const usedH = tp.length ? tp[tp.length - 1].rect.y + tp[tp.length - 1].rect.h - S.y : 0;
        const gap = env.sizes.body * 1.6;
        const mr = { x: S.x, y: S.y + usedH + gap, w: S.w, h: S.h - usedH - gap };
        const mp = gridOrStack(media, mr, env, measure, 'top');
        // a capped visual leaves slack: centre title + visual together as one group
        const mh = mp[0].rect.h;
        const off = Math.max(0, (S.h - (usedH + gap + mh)) / 2);
        tp.forEach((p) => { p.rect = { ...p.rect, y: p.rect.y + off }; });
        mp[0].rect = { ...mp[0].rect, y: S.y + off + usedH + gap };
        place(tp); place(mp);
        break;
      }
      const copyMedia = !vis.length;
      const ratio = variant.ratio ?? (copyMedia ? 0.4 : media.some((b) => b.type === 'stat') ? 0.5 : textHeavy ? 0.46 : 0.42);
      const flipS = copyMedia ? variant.flip === true : flip;
      const tw = S.w * ratio - grid.gutter;
      const mw = S.w * (1 - ratio) - grid.gutter * 1.5;
      const tx = flipS ? S.x + S.w - tw : S.x;
      const mx = flipS ? S.x : S.x + S.w - mw;
      if (title) hint(title, { titleRole: 'h1', align: 'left', maxLines: 4 });
      copy.forEach((b) => hint(b, { textSize: textHeavy ? 'body' : 'lead' }));
      media.forEach((b) => hint(b, { align: 'left', valign: 'center', ...(copyMedia ? { textSize: 'lead', roomy: true } : {}) }));
      place(flow(text, { x: tx, y: S.y, w: tw, h: S.h }, env, measure, 'center'));
      place(gridOrStack(media, { x: mx, y: S.y, w: mw, h: S.h }, env, measure, 'center'));
      break;
    }
    case 'focus':
    case 'stack':
    case 'grid': {
      const header = [title, ...(layout === 'stack' ? [] : copy.filter((b) => b.type === 'text' && String(b.text || '').length < 90))].filter(Boolean);
      if (title) hint(title, { titleRole: vis.length || copy.length > 1 ? 'h2' : 'h1', align: variant.align || 'left', maxLines: 2 });
      const rem = flowB.filter((b) => !header.includes(b));
      const hp = flow(header, { ...S, h: S.h * 0.32 }, env, measure, 'top');
      const placeHeader = () => place(hp);
      const hEnd = hp.length ? hp[hp.length - 1].rect.y + hp[hp.length - 1].rect.h : S.y;
      const gap = hp.length ? env.sizes.body * 1.5 : 0;
      const body = { x: S.x, y: hEnd + gap, w: S.w, h: S.y + S.h - hEnd - gap };
      let bp;
      if (layout === 'grid') bp = gridOrStack(rem, body, env, measure, portrait ? 'top' : 'center', true);
      else {
        rem.forEach((b) => { if (natureOf(b) === 'copy' && layout === 'stack') hint(b, { textSize: rem.length === 1 || portrait ? 'lead' : 'body' }); });
        bp = flow(rem, body, env, measure, portrait ? 'top' : 'center');
      }
      // Portrait (short video): the title + content read as one centred group, not a header
      // pinned to the top with a gap below.
      if (portrait && bp.length) {
        const bottom = Math.max(...bp.map((p) => p.rect.y + p.rect.h));
        const off = Math.max(0, (S.y + S.h - bottom) / 2);
        if (off > 0) for (const p of [...hp, ...bp]) p.rect = { ...p.rect, y: p.rect.y + off };
      }
      placeHeader();
      place(bp);
      break;
    }
    case 'full': {
      const media = vis[0];
      if (media) out.push({ block: media, rect: { x: 0, y: 0, w: W, h: H }, hint: { bleed: true, overlay: media.overlay ?? (media.type === 'screen' ? 0 : 0.35) } });
      const others = vis.slice(1);
      const tr = { x: S.x, y: S.y + S.h * 0.45, w: S.w * (portrait ? 1 : 0.62), h: S.h * 0.55 };
      if (title) hint(title, { titleRole: 'h1', align: 'left', onImage: true });
      copy.forEach((b) => hint(b, { onImage: true }));
      if (media?.type !== 'screen' || title || copy.length) decor.push({ kind: 'scrim', side: 'bottom' });
      place(flow([title, ...copy, ...others].filter(Boolean), tr, env, measure, 'bottom'));
      break;
    }
    case 'free':
    default: {
      place(flow(flowB, S, env, measure, 'top'));
    }
  }
  for (const b of framed) {
    const f = b.frame;
    out.push({ block: b, rect: { x: (f.x ?? 0) * W, y: (f.y ?? 0) * H, w: (f.w ?? 0.3) * W, h: (f.h ?? 0.2) * H }, hint: { ...(hints.get(b) || {}), framed: true } });
  }
  return { layout, placements: out, decor };
}

/** Lay out one or more visual blocks in a region: single → fill; many → grid. */
function gridOrStack(blocks, r, env, measure, valign = 'top', forceGrid = false) {
  if (!blocks.length) return [];
  if (blocks.length === 1) {
    const m = measure(blocks[0], r.w, r.h);
    if (m.fill) {
      const h = Math.min(r.h, Math.max(m.h, m.max ?? Infinity));
      return [{ block: blocks[0], rect: { x: r.x, y: r.y + (valign === 'center' ? (r.h - h) / 2 : 0), w: r.w, h } }];
    }
    const h = Math.min(m.h, r.h);
    return [{ block: blocks[0], rect: { x: r.x, y: r.y + (valign === 'center' ? (r.h - h) / 2 : 0), w: r.w, h } }];
  }
  const same = blocks.every((b) => b.type === blocks[0].type);
  if (!same && !forceGrid) return flow(blocks, r, env, measure, valign);
  const n = blocks.length;
  const cols = env.portrait ? (n <= 2 ? 1 : 2) : n <= 3 ? n : n === 4 ? (r.w / r.h > 2.2 ? 4 : 2) : 3;
  const rows = Math.ceil(n / cols);
  const gap = env.grid.gutter * 1.4;
  const cw = (r.w - gap * (cols - 1)) / cols;
  const ch = (r.h - gap * (rows - 1)) / rows;
  return blocks.map((b, i) => ({ block: b, rect: { x: r.x + (i % cols) * (cw + gap), y: r.y + Math.floor(i / cols) * (ch + gap), w: cw, h: ch } }));
}
