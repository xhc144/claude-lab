// Scene layout: picks a layout for `auto`, carves the frame into regions on the theme grid, and
// flows blocks inside regions. Responsive by construction — the same scene re-flows for 16:9,
// 9:16, 1:1 and 4:5 because regions are derived from the frame, not stored as coordinates.
import { COMPONENTS } from '../core/catalog/components.js';

const BACKDROP = new Set(['image', 'video', 'shape3d', 'particles', 'globe', 'model', 'surface', 'simulation', 'vectorfield']);
const WIDE_VISUAL = new Set(['timeline', 'steps', 'table', 'flow', 'compare', 'features', 'stats', 'gallery', 'hierarchy']);

export function natureOf(b) {
  if (b.type === 'bullets' && b.style === 'cards') return 'visual';
  return COMPONENTS[b.type]?.nature || 'visual';
}

export function resolveLayout(scene, index, count) {
  if (scene.layout && scene.layout !== 'auto') return scene.layout;
  const blocks = scene.blocks.filter((b) => !b.hidden && !b.frame);
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
    if (v.type === 'image' && !copy.length && !titles.length) return 'full';
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
  const S = grid.safe;
  const th = env.theme.layout || {};
  const portrait = env.portrait;
  const square = !portrait && env.aspect < 1.2;
  const blocks = scene.blocks.filter((b) => !b.hidden);
  const framed = blocks.filter((b) => b.frame);
  const flowB = blocks.filter((b) => !b.frame);
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
      const align = variant.align || (layout === 'closing' ? 'center' : th.coverAlign || 'left');
      const backdrop = vis.find((b) => BACKDROP.has(b.type));
      let textR = { ...S };
      if (backdrop) {
        if (backdrop.type === 'image' || backdrop.type === 'video') {
          out.push({ block: backdrop, rect: { x: 0, y: 0, w: W, h: H }, hint: { bleed: true, overlay: backdrop.overlay ?? 0.45 } });
          decor.push({ kind: 'scrim', side: align === 'center' ? 'full' : 'left' });
          if (title) hint(title, { onImage: true });
        } else if (portrait || align === 'center') {
          const vr = portrait ? { x: 0, y: H * 0.42, w: W, h: H * 0.58 } : { x: 0, y: 0, w: W, h: H };
          out.push({ block: backdrop, rect: vr, hint: { backdrop: true, dim: align === 'center' && !portrait ? 0.55 : 0 } });
          if (portrait) textR = { ...S, h: H * 0.42 - S.y };
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
      const num = scene.sectionNumber ?? index;
      const r = align === 'center' ? { x: S.x + S.w * 0.1, y: S.y, w: S.w * 0.8, h: S.h } : { x: S.x, y: S.y, w: S.w * (portrait ? 1 : 0.78), h: S.h };
      if (title) hint(title, { titleRole: 'display', align, maxLines: 3 });
      copy.forEach((b) => hint(b, { align, textSize: 'lead' }));
      const items = [title, ...copy, ...vis].filter(Boolean);
      const numH = th.section === 'giant-number' ? 0 : env.sizes.display * 1.25;
      const placed = flow(items, { ...r, y: r.y + numH * 0.5, h: r.h - numH * 0.5 }, env, measure, 'center');
      const top = placed.length ? placed[0].rect.y : r.y + r.h / 2;
      decor.push({ kind: 'section-number', n: num, x: align === 'center' ? W / 2 : r.x, y: top - numH * 1.0, size: env.sizes.display * 1.15, align, style: th.section || 'number' });
      place(placed);
      break;
    }
    case 'quote': {
      const q = copy.find((b) => b.type === 'quote') || copy[0];
      const align = variant.align || (env.theme.layout?.titleAlign === 'center' ? 'center' : 'left');
      const r = { x: S.x + S.w * (align === 'center' ? 0.1 : 0.06), y: S.y, w: S.w * (align === 'center' ? 0.8 : 0.76), h: S.h };
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
        if (title) hint(title, { titleRole: 'h1', align: 'left', maxLines: 3 });
        copy.forEach((b) => hint(b, { compact: true }));
        const tp = flow(text, { ...S, h: S.h * 0.45 }, env, measure, 'top');
        const usedH = tp.length ? tp[tp.length - 1].rect.y + tp[tp.length - 1].rect.h - S.y : 0;
        place(tp);
        const mr = { x: S.x, y: S.y + usedH + env.sizes.body * 1.5, w: S.w, h: S.h - usedH - env.sizes.body * 1.5 };
        place(gridOrStack(media, mr, env, measure));
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
      place(hp);
      const hEnd = hp.length ? hp[hp.length - 1].rect.y + hp[hp.length - 1].rect.h : S.y;
      const gap = hp.length ? env.sizes.body * 1.5 : 0;
      const body = { x: S.x, y: hEnd + gap, w: S.w, h: S.y + S.h - hEnd - gap };
      if (layout === 'grid') place(gridOrStack(rem, body, env, measure, 'center', true));
      else {
        rem.forEach((b) => { if (natureOf(b) === 'copy' && layout === 'stack') hint(b, { textSize: rem.length === 1 ? 'lead' : 'body' }); });
        place(flow(rem, body, env, measure, 'center'));
      }
      break;
    }
    case 'full': {
      const media = vis[0];
      if (media) out.push({ block: media, rect: { x: 0, y: 0, w: W, h: H }, hint: { bleed: true, overlay: media.overlay ?? 0.35 } });
      const others = vis.slice(1);
      const tr = { x: S.x, y: S.y + S.h * 0.45, w: S.w * (portrait ? 1 : 0.62), h: S.h * 0.55 };
      if (title) hint(title, { titleRole: 'h1', align: 'left', onImage: true });
      copy.forEach((b) => hint(b, { onImage: true }));
      decor.push({ kind: 'scrim', side: 'bottom' });
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
    if (m.fill) return [{ block: blocks[0], rect: { ...r } }];
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
