// Generative model sigils: each model gets a unique emblem derived from a hash of its id,
// tinted by its provider's hue. Pure SVG strings, so they are crisp at any size.

import { hash, rng, esc } from '../core/util.js';
import { PROVIDERS } from '../core/data.js';

export function sigil(model, size = 44) {
  const h = hash(model.id);
  const r = rng(h);
  const hue = PROVIDERS[model.provider]?.hue ?? 200;
  const hue2 = (hue + 40 + r.int(0, 60)) % 360;
  const kind = h % 4;
  const n = 5 + (h % 5);
  const id = `sg${h.toString(36)}`;
  const c = 22;
  let art = '';
  if (kind === 0) {
    // petals
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 360;
      art += `<ellipse cx="${c}" cy="${c - 7}" rx="3.2" ry="8" transform="rotate(${a} ${c} ${c})"/>`;
    }
    art += `<circle cx="${c}" cy="${c}" r="3"/>`;
  } else if (kind === 1) {
    // orbit rings
    for (let i = 0; i < 3; i++) art += `<ellipse cx="${c}" cy="${c}" rx="13" ry="${4 + i * 1.5}" transform="rotate(${i * 60 + (h % 30)} ${c} ${c})"/>`;
    art += `<circle cx="${c}" cy="${c}" r="2.6" class="f"/>`;
  } else if (kind === 2) {
    // lattice of nodes
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + r() * 0.4;
      const rr = 7 + r() * 7;
      return [c + Math.cos(a) * rr, c + Math.sin(a) * rr];
    });
    pts.forEach((p, i) => { const q = pts[(i + 2) % n]; art += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`; });
    pts.forEach((p) => { art += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.8" class="f"/>`; });
  } else {
    // stacked waves
    for (let i = 0; i < 4; i++) {
      const y = 13 + i * 6, amp = 2 + r() * 3, ph = r() * 6;
      let d = `M8,${y}`;
      for (let x = 8; x <= 36; x += 2) d += `L${x},${(y + Math.sin(x / 4 + ph) * amp).toFixed(1)}`;
      art += `<path d="${d}"/>`;
    }
  }
  return `<svg class="sigil" viewBox="0 0 44 44" width="${size}" height="${size}" role="img" aria-label="${esc(model.name)}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 80% 52%)"/><stop offset="1" stop-color="hsl(${hue2} 75% 30%)"/></linearGradient></defs>
    <rect width="44" height="44" rx="12" fill="url(#${id})"/>
    <rect x=".5" y=".5" width="43" height="43" rx="11.5" fill="none" stroke="rgba(255,255,255,.22)"/>
    <g class="sg-art" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="1.3">${art}</g>
  </svg>`;
}
