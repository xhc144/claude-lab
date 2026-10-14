// Color utilities shared by core (theme validation, contrast lint) and engine (rendering).
// Colors are stored as CSS strings in documents; internally we work in linear sRGB / OKLab.

const NAMED = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  transparent: 'rgba(0,0,0,0)', gray: '#808080', grey: '#808080', yellow: '#ffff00',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', cyan: '#00ffff', magenta: '#ff00ff',
};

/** Parse a CSS color into {r,g,b,a} with r,g,b in 0..255. Returns null for unknown strings. */
export function parseColor(input) {
  if (input == null) return null;
  if (typeof input === 'object' && 'r' in input) return { a: 1, ...input };
  let s = String(input).trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/.exec(s))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const v = parseInt(h.slice(0, 6), 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  if ((m = /^rgba?\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const ch = (v) => (v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v));
    return { r: ch(p[0]), g: ch(p[1]), b: ch(p[2]), a: p[3] == null ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]) };
  }
  if ((m = /^hsla?\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const h = parseFloat(p[0]), sat = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100;
    const a = p[3] == null ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    const k = (n) => (n + h / 30) % 12;
    const f = (n) => l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a };
  }
  if ((m = /^oklch\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const L = p[0].endsWith('%') ? parseFloat(p[0]) / 100 : parseFloat(p[0]);
    const rgb = oklchToRgb({ l: L, c: parseFloat(p[1]), h: parseFloat(p[2]) });
    return { ...rgb, a: p[3] == null ? 1 : parseFloat(p[3]) };
  }
  return null;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const toLinear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLinear = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab({ r, g, b }) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb({ l, a, b }) {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: Math.round(clamp01(fromLinear(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_) / 255) * 255),
    g: Math.round(clamp01(fromLinear(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_) / 255) * 255),
    b: Math.round(clamp01(fromLinear(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_) / 255) * 255),
  };
}

export function rgbToOklch(rgb) {
  const { l, a, b } = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l, c, h };
}

export function oklchToRgb({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  return oklabToRgb({ l, a: c * Math.cos(hr), b: c * Math.sin(hr) });
}

const hex2 = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');

export function toHex(color) {
  const c = parseColor(color);
  if (!c) return '#000000';
  return '#' + hex2(c.r) + hex2(c.g) + hex2(c.b) + (c.a < 1 ? hex2(c.a * 255) : '');
}

export function toCss(color, alpha = 1) {
  const c = parseColor(color);
  if (!c) return 'rgba(0,0,0,0)';
  const a = (c.a ?? 1) * alpha;
  if (a >= 1) return '#' + hex2(c.r) + hex2(c.g) + hex2(c.b);
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${+a.toFixed(4)})`;
}

/** Alpha multiply. */
export const alpha = (color, a) => toCss(color, a);

/** Perceptual mix in OKLab. t=0 → a, t=1 → b. */
export function mix(ca, cb, t) {
  const A = parseColor(ca), B = parseColor(cb);
  if (!A || !B) return ca;
  const la = rgbToOklab(A), lb = rgbToOklab(B);
  const rgb = oklabToRgb({ l: la.l + (lb.l - la.l) * t, a: la.a + (lb.a - la.a) * t, b: la.b + (lb.b - la.b) * t });
  const a = (A.a ?? 1) + ((B.a ?? 1) - (A.a ?? 1)) * t;
  return toCss({ ...rgb, a });
}

/** Adjust OKLCH lightness/chroma/hue. */
export function adjust(color, { l = 0, c = 0, h = 0, cScale = 1 } = {}) {
  const p = parseColor(color);
  if (!p) return color;
  const o = rgbToOklch(p);
  return toCss({ ...oklchToRgb({ l: clamp01(o.l + l), c: Math.max(0, o.c * cScale + c), h: (o.h + h + 360) % 360 }), a: p.a });
}

export const lighten = (color, amt = 0.1) => adjust(color, { l: amt });
export const darken = (color, amt = 0.1) => adjust(color, { l: -amt });

export function luminance(color) {
  const c = parseColor(color);
  if (!c) return 0;
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const isDark = (color) => luminance(color) < 0.18;

/** Pick whichever of the candidates contrasts most with the background. */
export function bestOn(bg, candidates = ['#ffffff', '#111111']) {
  let best = candidates[0], score = -1;
  for (const c of candidates) {
    const s = contrast(bg, c);
    if (s > score) { score = s; best = c; }
  }
  return best;
}

/** Ensure fg has at least `min` contrast against bg by moving its lightness. */
export function ensureContrast(fg, bg, min = 4.5) {
  if (contrast(fg, bg) >= min) return toCss(fg);
  const dir = isDark(bg) ? 1 : -1;
  let c = fg;
  for (let i = 0; i < 20 && contrast(c, bg) < min; i++) c = adjust(c, { l: 0.04 * dir });
  return c;
}

/** Sequential ramp between two colors (OKLab), n steps. */
export function ramp(a, b, n) {
  return Array.from({ length: n }, (_, i) => mix(a, b, n === 1 ? 0 : i / (n - 1)));
}

export const isColor = (s) => parseColor(s) != null;
