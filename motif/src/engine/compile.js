// Compiler: document → timed, laid-out scene instances. Pure function of (doc, theme, fonts).
import { layoutScene, natureOf } from './layout.js';
import { getComponent, placeholder } from './components/index.js';
import { resolveTheme, makeEnv } from './env.js';
import { IN_DELAY } from './transitions.js';
import { stableStringify, hash32, clamp } from '../core/util/misc.js';

const TONE_OK = new Set(['base', 'inverse', 'accent']);

export function sceneTone(env, scene, layout, i) {
  if (scene.tone && scene.tone !== 'auto' && TONE_OK.has(scene.tone)) return scene.tone;
  const th = env.theme.layout || {};
  if (th.toneCycle && layout !== 'cover') return th.toneCycle[i % th.toneCycle.length];
  if (layout === 'section') return th.sectionTone || 'accent';
  return 'base';
}

export function resolveTransition(env, doc, scene, prev, layout, i) {
  if (i === 0) return null;
  const T = env.motion.tempo;
  let tr = scene.transition;
  if (!tr || tr === 'auto') {
    const keysPrev = new Set((prev?.blocks || []).map((b) => b.key).filter(Boolean));
    const shared = (scene.blocks || []).some((b) => b.key && keysPrev.has(b.key));
    if (shared) tr = { type: 'morph', duration: 1.0 * T };
    else if (doc.style?.transition && doc.style.transition !== 'auto') tr = { type: doc.style.transition };
    else tr = layout === 'section' || layout === 'closing' ? { ...env.motion.sectionTransition } : { ...env.motion.transition };
  } else tr = { ...tr };
  if (!tr.duration) {
    const base = tr.type === env.motion.transition.type ? env.motion.transition.duration : tr.type === env.motion.sectionTransition.type ? env.motion.sectionTransition.duration : 0.9;
    tr.duration = tr.type === 'cut' ? 0 : base * T;
  }
  return tr;
}

/** Component context factory. */
function ctxFor(env, te, assets, scene, index, palette, block, hint) {
  return { env, te, assets, scene, index, p: palette, block, hint: hint || {} };
}

/**
 * @param doc normalised document
 * @param o { te: TextEngine, assets, userThemes, cache: Map }
 */
export function compile(doc, o) {
  const theme = resolveTheme(doc, o.userThemes);
  const env = makeEnv(doc, theme, { assets: o.assets });
  const scenes = doc.scenes.filter((s) => !s.hidden);
  const n = scenes.length;
  const envKey = hash32(stableStringify({ t: theme, f: doc.format, s: doc.style }));
  const cache = o.cache || new Map();
  const out = [];
  const issues = [];

  scenes.forEach((scene, i) => {
    const key = `${envKey}:${i}:${n}:${hash32(stableStringify(scene))}:${hash32(stableStringify(doc.assets))}`;
    let cs = cache.get(scene.id);
    if (!cs || cs.key !== key) {
      cs = buildScene(scene, i, n, env, o);
      cs.key = key;
      cache.set(scene.id, cs);
    }
    out.push(cs);
  });
  // drop cache entries for removed scenes
  for (const k of [...cache.keys()]) if (!scenes.some((s) => s.id === k)) cache.delete(k);

  // transitions & timing
  let t = 0;
  out.forEach((cs, i) => {
    const prev = scenes[i - 1];
    cs.transitionIn = resolveTransition(env, doc, scenes[i], prev, cs.layout, i);
    cs.index = i;
  });
  out.forEach((cs, i) => {
    const next = out[i + 1];
    const tin = cs.transitionIn;
    const lead = tin ? tin.duration * Math.max(IN_DELAY[tin.type] ?? 0.32, 0.25) + 0.1 : 0.35;
    // re-time instances with the lead-in (cached builds are lead-independent)
    let contentEnd = 0;
    for (const it of cs.items) {
      it.start = it.baseStart + (it.bleed ? 0 : lead);
      contentEnd = Math.max(contentEnd, it.start + it.inst.duration);
    }
    const nextD = next?.transitionIn?.duration || 0;
    const sc = scenes[i];
    let dur;
    if (typeof sc.duration === 'number') dur = sc.duration;
    else dur = clamp(contentEnd + cs.hold + nextD * 0.55 + (sc.hold || 0), 2.4, 30);
    cs.duration = dur;
    cs.contentEnd = contentEnd;
    if (tin && i > 0) {
      const prevCs = out[i - 1];
      tin.duration = Math.min(tin.duration, prevCs.duration * 0.6, dur * 0.6);
      t = prevCs.start + prevCs.duration - tin.duration;
    }
    cs.start = Math.max(0, t);
    cs.end = cs.start + dur;
    t = cs.end;
    for (const it of cs.items) for (const iss of it.inst.issues || []) issues.push({ ...iss, scene: sc.id, block: it.block.id, sceneIndex: i });
    if (typeof sc.duration === 'number' && sc.duration < contentEnd + 0.5) issues.push({ level: 'warning', scene: sc.id, sceneIndex: i, message: `场景时长 ${sc.duration}s 短于动画完成所需的 ${contentEnd.toFixed(1)}s`, hint: '把 duration 改为 "auto" 或加长' });
  });
  const duration = out.length ? out[out.length - 1].end : 0;
  return { doc, theme, env, scenes: out, duration, issues, persistent: !!theme.background?.persistent };
}

function buildScene(scene, i, n, env, o) {
  const te = o.te;
  const L0 = layoutSceneWith(scene, i, n, env, o, 'base');
  const tone = sceneTone(env, scene, L0.layout, i);
  const palette = env.palette(tone);
  const L = L0; // layout is palette-independent; only the build uses the tone palette
  const T = env.motion.tempo;
  const energy = env.energy;
  const items = [];
  let prev = null;
  const ordered = [...L.placements].sort((a, b) => (a.hint.bleed || a.hint.backdrop ? -1 : 0) - (b.hint.bleed || b.hint.backdrop ? -1 : 0));
  for (const pl of ordered) {
    const comp = getComponent(pl.block.type) || placeholder;
    const c = ctxFor(env, te, o.assets, scene, i, palette, pl.block, pl.hint);
    let inst;
    try { inst = comp.build(pl.block, c, pl.rect); }
    catch (err) {
      inst = placeholder.build(pl.block, c, pl.rect);
      inst.issues = [{ level: 'error', message: `渲染 ${pl.block.type} 失败：${err.message}` }];
      if (globalThis.console) console.error(err);
    }
    const m = pl.block.motion || {};
    const bleed = !!(pl.hint.bleed || pl.hint.backdrop);
    let start;
    if (typeof m.at === 'number') start = m.at;
    else if (bleed) start = 0;
    else if (!prev) start = 0;
    else {
      const pn = natureOf(prev.block), cn = natureOf(pl.block);
      if (pn === 'headline' && cn === 'visual') start = prev.baseStart + Math.min(prev.inst.duration * 0.45, 0.55 * T);
      else start = prev.baseStart + clamp(prev.inst.duration * (0.55 - energy * 0.2), 0.14 * T, 1.1 * T);
    }
    if (typeof m.delay === 'number' && typeof m.at !== 'number') start += m.delay;
    const item = { block: pl.block, rect: pl.rect, hint: pl.hint, inst, baseStart: Math.max(0, start), start: 0, bleed, c };
    items.push(item);
    if (!bleed) prev = item;
  }
  const holds = items.reduce((s, it) => s + (it.inst.hold || 0), 0);
  const hold = clamp(holds * 0.75, 1.3, 9) * (1.15 - energy * 0.3);
  return { id: scene.id, scene, layout: L.layout, tone, palette, items, decor: L.decor, hold, camera: cameraFor(env, scene, L.layout) };
}

function layoutSceneWith(scene, i, n, env, o, tone) {
  const palette = env.palette(tone);
  const mk = {
    measure(b, hint, w, maxH) {
      const comp = getComponent(b.type) || placeholder;
      try { return comp.measure(b, ctxFor(env, o.te, o.assets, scene, i, palette, b, hint), w, maxH); }
      catch (err) { if (globalThis.console) console.error(err); return { h: Math.min(maxH, 100), fill: true }; }
    },
  };
  return layoutScene(scene, env, mk, i, n);
}

function cameraFor(env, scene, layout) {
  let cam = scene.camera && scene.camera !== 'auto' ? { ...scene.camera } : env.doc.style?.camera && env.doc.style.camera !== 'auto' ? { type: env.doc.style.camera } : { ...env.motion.camera };
  if (cam.amount == null) cam.amount = env.motion.camera.amount || 0.5;
  if (layout === 'full' && cam.type === 'none') cam = { type: 'push', amount: 0.4 };
  return cam;
}
