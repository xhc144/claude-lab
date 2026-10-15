// Resolves a document + theme into a render environment: pixel sizes for every typographic
// role, the layout grid, the motion tempo (scaled by "energy"), and per-tone palettes.
import { THEMES, DEFAULT_THEME } from '../core/themes/index.js';
import { deepMerge, rng, hash32 } from '../core/util/misc.js';
import { mix, adjust, toCss, isDark, ensureContrast, parseColor, contrast } from '../core/util/color.js';
import { cubicBezier, spring, EASE } from './motion/easing.js';

/** Merge built-in theme, optional user theme (extends) and document overrides. */
export function resolveTheme(doc, userThemes = {}) {
  const ref = doc.theme || { id: DEFAULT_THEME };
  let base = THEMES[ref.id] || userThemes[ref.id];
  if (base && base.extends && !THEMES[ref.id]) base = deepMerge(THEMES[base.extends] || THEMES[DEFAULT_THEME], base.overrides || base);
  if (!base) base = THEMES[DEFAULT_THEME];
  let theme = ref.overrides ? deepMerge(base, ref.overrides) : base;
  if (ref.accent && parseColor(ref.accent)) {
    theme = deepMerge(theme, { palette: { accent: ref.accent, highlight: toCss(ref.accent, 0.2), data: [ref.accent, ...theme.palette.data.filter((c) => c !== theme.palette.accent).slice(0, 7)] } });
  }
  if (ref.fonts) theme = deepMerge(theme, { fonts: ref.fonts });
  return theme;
}

const ROLE_STEPS = { caption: -1.6, label: -1.9, small: -1, body: 0, lead: 0.9, h3: 1.4, h2: 2.4, h1: 3.6, display: 4.6 };

export function makeEnv(doc, theme, opts = {}) {
  const W = doc.format.width, H = doc.format.height;
  const short = Math.min(W, H);
  const portrait = H > W * 1.05;
  const unit = short / 1080;
  const density = doc.style?.density || 'normal';
  const dens = density === 'airy' ? 1.08 : density === 'compact' ? 0.9 : 1;
  const base = theme.type.base * unit * dens * (portrait ? 1.08 : 1);
  const ratio = theme.type.ratio || 1.33;
  const sizes = {};
  for (const [k, step] of Object.entries(ROLE_STEPS)) sizes[k] = base * ratio ** step;
  sizes.display = Math.min(sizes.display, (portrait ? W * 0.16 : H * 0.17));

  const g = theme.grid;
  const mx = W * (portrait ? Math.max(0.07, g.marginX) : g.marginX) * (density === 'airy' ? 1.15 : density === 'compact' ? 0.85 : 1);
  const my = H * (portrait ? Math.min(g.marginY, 0.07) : g.marginY) * (density === 'airy' ? 1.12 : density === 'compact' ? 0.85 : 1);
  const gutter = W * g.gutter;
  const cols = portrait ? 6 : g.columns;
  const safe = { x: mx, y: my, w: W - 2 * mx, h: H - 2 * my };
  const colW = (safe.w - gutter * (cols - 1)) / cols;
  const grid = { mx, my, gutter, cols, colW, safe, col: (i, span = 1) => ({ x: safe.x + i * (colW + gutter), w: span * colW + (span - 1) * gutter }) };

  const energy = doc.style?.energy ?? 0.6;
  const tempo = 1.32 - energy * 0.62; // energy 0 → slower (1.32×), energy 1 → faster (0.7×)
  const mo = theme.motion;
  const ease = Array.isArray(mo.ease) ? cubicBezier(...mo.ease) : EASE[mo.ease] || EASE.outCubic;
  const springFn = mo.spring ? spring(mo.spring) : null;
  const motion = {
    personality: mo.personality,
    ease,
    spring: springFn,
    duration: mo.duration * tempo,
    stagger: mo.stagger * tempo,
    unit: mo.unit,
    enter: mo.enter,
    titleEnter: mo.titleEnter || mo.enter,
    distanceEm: mo.distance,
    blur: mo.blur * unit,
    overshoot: (mo.overshoot || 0) * (0.5 + energy),
    camera: { ...mo.camera, amount: (mo.camera?.amount || 0) * (0.6 + energy * 0.7) },
    transition: mo.transition,
    sectionTransition: mo.sectionTransition || mo.transition,
    tempo,
  };

  const env = {
    doc, theme, W, H, unit, portrait, aspect: W / H, sizes, grid, motion, energy,
    density, fonts: theme.fonts,
    seed: hash32(doc.id || 'motif'),
    rng: (key) => rng(hash32(String(doc.id) + ':' + key)),
    palettes: {},
    ...opts,
  };
  env.palette = (tone = 'base') => {
    if (!env.palettes[tone]) env.palettes[tone] = buildPalette(theme, tone);
    return env.palettes[tone];
  };
  return env;
}

/** Palette for a scene tone; derived colours computed once. */
export function buildPalette(theme, tone) {
  const p = { ...theme.palette, ...(tone !== 'base' && theme.tones?.[tone] ? theme.tones[tone] : {}) };
  p.tone = tone;
  p.dark = isDark(p.bg);
  // Data colours must stay distinguishable from the tone background.
  p.data = (p.data || theme.palette.data).map((c) => (contrast(c, p.bg) < 1.6 ? adjust(c, { l: p.dark ? 0.25 : -0.3 }) : c));
  if (tone === 'accent' || tone === 'inverse') {
    p.data = p.data.map((c) => (contrast(c, p.bg) < 2 ? (p.dark ? '#ffffff' : '#111111') : c));
    if (tone === 'accent') p.data[0] = p.accent && contrast(p.accent, p.bg) > 2 ? p.accent : p.ink;
  }
  p.accentText = ensureContrast(p.accent, p.bg, 3);
  p.mutedText = ensureContrast(p.muted, p.bg, 3.2);
  p.onAccent = p.onAccent || (isDark(p.accent) ? '#ffffff' : '#111111');
  p.gridLine = toCss(p.ink, p.dark ? 0.1 : 0.09);
  p.softLine = toCss(p.ink, p.dark ? 0.16 : 0.14);
  p.shadow = p.dark ? 'rgba(0,0,0,0.45)' : 'rgba(20,30,50,0.14)';
  p.dim = mix(p.muted, p.bg, 0.45);
  return p;
}

/** Resolve a color token or literal against a palette. */
export function colorOf(p, c, fallback) {
  if (c == null || c === '' || c === 'auto') return fallback ?? p.ink;
  if (typeof c !== 'string') return fallback ?? p.ink;
  if (p[c] && typeof p[c] === 'string') return p[c];
  const m = /^data(\d+)$/.exec(c);
  if (m) return p.data[Number(m[1]) % p.data.length];
  const tone = { accent: p.accent, positive: p.positive, negative: p.negative, warning: p.warning, neutral: p.muted }[c];
  if (tone) return tone;
  return parseColor(c) ? c : fallback ?? p.ink;
}

/** Resolved motion params for a unit of a given font size. */
export function motionParams(env, sizePx, overrides = {}) {
  const m = env.motion;
  return {
    ease: m.ease,
    spring: m.spring,
    distance: (m.distanceEm || 0.4) * sizePx,
    blur: m.blur,
    ...overrides,
  };
}
