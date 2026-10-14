// TeX → glyph list. MathJax renders TeX to self-contained SVG paths (fontCache: none); we flatten
// the SVG tree into glyphs with absolute affine matrices so the canvas can draw, animate and
// morph individual symbols (write-on, step-by-step derivations).
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

let mjDoc = null, adaptor = null;
function doc() {
  if (mjDoc) return mjDoc;
  adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({ packages: AllPackages.filter((p) => !['bussproofs', 'require', 'autoload'].includes(p)) });
  const svg = new SVG({ fontCache: 'none' });
  mjDoc = mathjax.document('', { InputJax: tex, OutputJax: svg });
  return mjDoc;
}

const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];

function parseTransform(s) {
  let M = [1, 0, 0, 1, 0, 0];
  if (!s) return M;
  for (const m of s.matchAll(/(translate|scale|matrix|rotate)\(([^)]*)\)/g)) {
    const v = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let T;
    if (m[1] === 'translate') T = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (m[1] === 'scale') T = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (m[1] === 'matrix') T = v;
    else { const a = ((v[0] || 0) * Math.PI) / 180; T = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]; }
    M = mul(M, T);
  }
  return M;
}

const cache = new Map();

/**
 * @returns {{ glyphs: Array<{kind:'path'|'rect', d?:string, rect?:number[], m:number[], c:string, color:string|null, bbox:number[]}>, width:number, height:number, minX:number, minY:number, error?:string }}
 * Units: 1000 = 1 em. Coordinates are relative to the viewBox origin (top-left = 0,0).
 */
export function texGlyphs(latex, display = true) {
  const key = (display ? 'D' : 'I') + latex;
  if (cache.has(key)) return cache.get(key);
  let res;
  try {
    const node = doc().convert(String(latex), { display });
    const svgText = adaptor.innerHTML(node);
    res = flatten(svgText);
  } catch (e) {
    res = { glyphs: [], width: 0, height: 0, error: e.message };
  }
  if (cache.size > 300) cache.clear();
  cache.set(key, res);
  return res;
}

function flatten(svgText) {
  const xml = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = xml.documentElement;
  const err = svg.querySelector('[data-mjx-error]');
  if (err) return { glyphs: [], width: 0, height: 0, error: err.getAttribute('data-mjx-error') };
  const vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
  const [minX, minY, W, H] = vb;
  const glyphs = [];
  const walk = (el, M, color) => {
    for (const ch of el.children) {
      const tag = ch.tagName.toLowerCase();
      const M2 = mul(M, parseTransform(ch.getAttribute('transform')));
      const fill = ch.getAttribute('fill');
      const col = fill && fill !== 'currentColor' && fill !== 'none' ? fill : color;
      if (tag === 'path') {
        const d = ch.getAttribute('d');
        if (d) glyphs.push({ kind: 'path', d, m: [M2[0], M2[1], M2[2], M2[3], M2[4] - minX, M2[5] - minY], c: ch.getAttribute('data-c') || '', color: col });
      } else if (tag === 'rect' && ch.getAttribute('data-background') == null) {
        const x = +ch.getAttribute('x') || 0, y = +ch.getAttribute('y') || 0, w = +ch.getAttribute('width') || 0, h = +ch.getAttribute('height') || 0;
        glyphs.push({ kind: 'rect', rect: [x, y, w, h], m: [M2[0], M2[1], M2[2], M2[3], M2[4] - minX, M2[5] - minY], c: 'rect' + Math.round(w / 50), color: col });
      } else if (tag === 'g' || tag === 'svg') walk(ch, M2, col);
    }
  };
  walk(svg, [1, 0, 0, 1, 0, 0], null);
  // approximate bbox per glyph: origin + typical em box
  for (const g of glyphs) {
    const sx = Math.hypot(g.m[0], g.m[1]), sy = Math.hypot(g.m[2], g.m[3]);
    if (g.kind === 'rect') {
      const [x, y, w, h] = g.rect;
      const x0 = g.m[0] * x + g.m[2] * y + g.m[4], y0 = g.m[1] * x + g.m[3] * y + g.m[5];
      const x1 = g.m[0] * (x + w) + g.m[2] * (y + h) + g.m[4], y1 = g.m[1] * (x + w) + g.m[3] * (y + h) + g.m[5];
      g.bbox = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
    } else g.bbox = [g.m[4], g.m[5] - 700 * sy, 600 * sx, 900 * sy];
  }
  return { glyphs, width: W, height: H, minX, minY };
}

const pathCache = new Map();
export function glyphPath(d) {
  let p = pathCache.get(d);
  if (!p) { p = new Path2D(d); if (pathCache.size > 4000) pathCache.clear(); pathCache.set(d, p); }
  return p;
}
