// Pre-rendered pieces of the sky: star glows, diffraction spikes, parallax starfield tiles and
// one procedural nebula per galaxy (fractal value noise tinted with the galaxy's hue).

import { mulberry32, rgba, hslToRgb } from '../core/util.js';

const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

/** soft round glow: white core fading into the star's colour */
export function makeGlow(rgb, size = 128) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.07, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.16, rgba(rgb, 0.75));
  grad.addColorStop(0.36, rgba(rgb, 0.22));
  grad.addColorStop(0.62, rgba(rgb, 0.06));
  grad.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** four-ray diffraction spikes, drawn for theorem stars */
export function makeSpikes(rgb, size = 256) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const r = size / 2;
  g.globalCompositeOperation = 'lighter';
  for (const [ang, len] of [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.42], [-Math.PI / 4, 0.42]]) {
    g.save();
    g.translate(r, r);
    g.rotate(ang);
    const grad = g.createLinearGradient(-r * len, 0, r * len, 0);
    grad.addColorStop(0, rgba(rgb, 0));
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grad;
    const th = len === 1 ? 1.6 : 1;
    g.beginPath();
    g.moveTo(-r * len, 0); g.lineTo(0, -th); g.lineTo(r * len, 0); g.lineTo(0, th); g.closePath();
    g.fill();
    g.restore();
  }
  return c;
}

/** a tile of background stars; layers drift at different speeds for parallax */
export function makeStarTile(seed, size, count, maxR, warm = 0.25) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const rand = mulberry32(seed);
  for (let k = 0; k < count; k++) {
    const x = rand() * size, y = rand() * size;
    const m = Math.pow(rand(), 3.2);
    const r = 0.25 + m * maxR;
    const hue = rand() < warm ? 30 + rand() * 30 : 200 + rand() * 40;
    const [R, G, B] = hslToRgb(hue, 0.5 + rand() * 0.4, 0.82 + rand() * 0.12);
    const a = 0.25 + m * 0.75;
    if (r > 1.1) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
      grad.addColorStop(0, `rgba(${R},${G},${B},${a})`);
      grad.addColorStop(0.3, `rgba(${R},${G},${B},${a * 0.35})`);
      grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
      g.fillStyle = grad;
      g.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    }
    g.fillStyle = `rgba(${R},${G},${B},${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

// ---- value noise
function noise2(seed) {
  const perm = new Uint8Array(512);
  const rand = mulberry32(seed);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => rand());
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
    const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/**
 * Nebula for one galaxy, in a square canvas that maps to the world square
 * [cx - R, cx + R] × [cy - R, cy + R]. `blobs` are cluster centres (world coordinates, radius).
 */
export function makeNebula({ hue, seed, cx, cy, R, blobs, size = 256 }) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const n = noise2(seed);
  const n2 = noise2(seed + 7);
  const base = hslToRgb(hue, 0.85, 0.55);
  const alt = hslToRgb(hue + 38, 0.8, 0.5);
  const deep = hslToRgb(hue - 30, 0.7, 0.35);
  const scale = 4.2 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = cx + ((px + 0.5) / size * 2 - 1) * R;
      const wy = cy + ((py + 0.5) / size * 2 - 1) * R;
      // density: sum of soft blobs around clusters, shaped by noise
      let dens = 0;
      for (const b of blobs) {
        const dx = (wx - b.x) / (b.r * 1.5), dy = (wy - b.y) / (b.r * 1.5);
        dens += Math.exp(-(dx * dx + dy * dy) * 1.6) * b.m;
      }
      const dx = (wx - cx) / R, dy = (wy - cy) / R;
      const rr = dx * dx + dy * dy;
      dens += Math.exp(-rr * 3.2) * 0.55;
      let f = 0, amp = 0.5, fr = 1;
      for (let o = 0; o < 5; o++) { f += amp * n(px * scale * fr + 11.3, py * scale * fr + 7.1); amp *= 0.5; fr *= 2.03; }
      const w = n2(px * scale * 1.7 + 3.3, py * scale * 1.7 + 9.9);
      const d = Math.max(0, dens * (f * 1.5 - 0.42)) * Math.max(0, 1 - rr * 0.9);
      const a = Math.min(1, d * 1.15);
      const k = (py * size + px) * 4;
      const mix = w;
      img.data[k] = (base[0] * (1 - mix) + alt[0] * mix) * 0.85 + deep[0] * 0.15;
      img.data[k + 1] = (base[1] * (1 - mix) + alt[1] * mix) * 0.85 + deep[1] * 0.15;
      img.data[k + 2] = (base[2] * (1 - mix) + alt[2] * mix) * 0.85 + deep[2] * 0.15;
      img.data[k + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
