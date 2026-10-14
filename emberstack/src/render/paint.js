// Painter: the drawing vocabulary of 薪火纪's "lantern-lit woodcut" style. Card illustrations are
// composed from these primitives in a 100×76 art-window space: ink outlines, gradient-shaded fills,
// woodcut hatching, rim light from the fire, and painted backdrops.

export const INK = '#21160f';
export const PAPER = '#efe3c8';

export function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

/** mix two #rrggbb colours */
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
export const lighten = (c, t) => mix(c, '#fff7e6', t);
export const darken = (c, t) => mix(c, '#140c08', t);

let noiseTile = null;
/** a small tileable noise texture used for paper grain and painted surfaces */
export function noisePattern(ctx) {
  if (!noiseTile) {
    const c = makeCanvas(96, 96);
    const g = c.getContext('2d');
    const img = g.createImageData(96, 96);
    let s = 1234567;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 128 + ((s >> 8) % 90) - 45;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    noiseTile = c;
  }
  return ctx.createPattern(noiseTile, 'repeat');
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** seeded random for deterministic decoration */
export function srand(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Painter {
  constructor(g, seed = 1) {
    this.g = g;
    this.r = srand(seed);
    this.t = 0; // animation time (unused for cached art)
  }
  // ------------------------------------------------------------------ low-level
  path(fn) { const g = this.g; g.beginPath(); fn(g); return this; }
  ink(w = 1.3, c = INK) { const g = this.g; g.lineWidth = w; g.strokeStyle = c; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); return this; }
  fill(c) { this.g.fillStyle = c; this.g.fill(); return this; }
  /** vertical gradient fill between two colours over [y0, y1] */
  vfill(c1, c2, y0, y1) {
    const gr = this.g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    this.g.fillStyle = gr;
    this.g.fill();
    return this;
  }
  /** diagonal "lit from the upper left" gradient */
  lfill(base, x0, y0, x1, y1, amt = 0.32) {
    const gr = this.g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, lighten(base, amt));
    gr.addColorStop(0.55, base);
    gr.addColorStop(1, darken(base, amt));
    this.g.fillStyle = gr;
    this.g.fill();
    return this;
  }
  rfill(c1, c2, x, y, r) {
    const gr = this.g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    this.g.fillStyle = gr;
    this.g.fill();
    return this;
  }
  /** woodcut hatching inside the current path */
  hatch(spacing = 2.6, angle = -0.8, alpha = 0.22, color = INK, w = 0.6) {
    const g = this.g;
    g.save();
    g.clip();
    g.globalAlpha *= alpha;
    g.strokeStyle = color;
    g.lineWidth = w;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    g.beginPath();
    for (let d = -140; d < 140; d += spacing) {
      g.moveTo(50 + ca * -140 - sa * d, 38 + sa * -140 + ca * d);
      g.lineTo(50 + ca * 140 - sa * d, 38 + sa * 140 + ca * d);
    }
    g.stroke();
    g.restore();
    return this;
  }
  /** shade the lower-right half of the current path with hatching */
  shadeHatch(x0, y0, x1, y1, alpha = 0.3) {
    const g = this.g;
    g.save();
    g.clip();
    g.beginPath();
    g.moveTo(x1, y0);
    g.lineTo(x1, y1);
    g.lineTo(x0, y1);
    g.closePath();
    g.clip();
    g.globalAlpha *= alpha;
    g.strokeStyle = INK;
    g.lineWidth = 0.55;
    g.beginPath();
    for (let d = -100; d < 200; d += 2.2) { g.moveTo(d, 0); g.lineTo(d - 76, 76); }
    g.stroke();
    g.restore();
    return this;
  }
  glow(color, blur, fn) {
    const g = this.g;
    g.save();
    g.shadowColor = color;
    g.shadowBlur = blur;
    fn();
    g.restore();
    return this;
  }
  ellipse(x, y, rx, ry, rot = 0) { return this.path((g) => g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)); }
  circle(x, y, r) { return this.path((g) => g.arc(x, y, r, 0, Math.PI * 2)); }
  rect(x, y, w, h, r = 0) {
    return this.path((g) => {
      if (!r) { g.rect(x, y, w, h); return; }
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    });
  }
  poly(pts) {
    return this.path((g) => {
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.closePath();
    });
  }
  /** smooth closed blob through points */
  blob(pts) {
    return this.path((g) => {
      const n = pts.length / 2;
      const P = (i) => [pts[((i + n) % n) * 2], pts[((i + n) % n) * 2 + 1]];
      const [x0, y0] = P(0), [x1, y1] = P(1);
      g.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
      for (let i = 1; i <= n; i++) {
        const [ax, ay] = P(i), [bx, by] = P(i + 1);
        g.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
      }
      g.closePath();
    });
  }
  line(x0, y0, x1, y1, w = 1.2, c = INK) { return this.path((g) => { g.moveTo(x0, y0); g.lineTo(x1, y1); }).ink(w, c); }
  curve(x0, y0, cx, cy, x1, y1, w = 1.2, c = INK) { return this.path((g) => { g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); }).ink(w, c); }
  shadow(x, y, rx, ry = rx * 0.28, a = 0.35) {
    const g = this.g;
    const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    gr.addColorStop(0, `rgba(20,12,6,${a})`);
    gr.addColorStop(1, 'rgba(20,12,6,0)');
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    g.translate(-x, -y);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return this;
  }
  /** a soft round glow (fire, crystals, magic) */
  halo(x, y, r, color, a = 0.6) {
    const g = this.g;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color.replace(/[\d.]+\)$/, a + ')'));
    gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    return this;
  }
  with(fn) { this.g.save(); fn(); this.g.restore(); return this; }
  at(x, y, s = 1, rot = 0, fn) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    if (s !== 1) g.scale(s, s);
    fn();
    g.restore();
    return this;
  }

  // ------------------------------------------------------------------ backdrops
  sky(top, bottom, horizon = 76) {
    this.rect(-2, -2, 104, horizon + 2).vfill(top, bottom, 0, horizon);
    return this;
  }
  sun(x, y, r, color = '#ffd889') {
    this.halo(x, y, r * 3, 'rgba(255,214,140,1)', 0.35);
    this.circle(x, y, r).fill(color);
    return this;
  }
  moon(x, y, r) {
    this.halo(x, y, r * 3, 'rgba(200,220,255,1)', 0.25);
    this.circle(x, y, r).fill('#e9efe6');
    this.circle(x + r * 0.45, y - r * 0.2, r * 0.9).fill('rgba(30,40,70,0.55)');
    return this;
  }
  stars(n = 18, y1 = 40) {
    for (let i = 0; i < n; i++) {
      const x = this.r() * 100, y = this.r() * y1, r = 0.3 + this.r() * 0.7;
      this.circle(x, y, r).fill(`rgba(255,246,220,${0.4 + this.r() * 0.5})`);
    }
    return this;
  }
  hills(color, y, amp = 6, n = 4, seed = 0) {
    const rr = srand(seed + 17);
    this.path((g) => {
      g.moveTo(-2, 78);
      g.lineTo(-2, y);
      const step = 104 / n;
      for (let i = 0; i <= n; i++) {
        const x = -2 + i * step;
        const yy = y - amp * (0.4 + rr() * 0.8);
        g.quadraticCurveTo(x - step / 2, yy - amp * 0.4, x, y - rr() * amp * 0.5);
      }
      g.lineTo(102, 78);
      g.closePath();
    }).fill(color);
    return this;
  }
  mountains(color, y, h = 26, n = 3, seed = 0, snow = false) {
    const rr = srand(seed + 5);
    const pts = [-2, 78, -2, y];
    for (let i = 0; i < n; i++) {
      const x0 = -2 + (i / n) * 106, x1 = -2 + ((i + 1) / n) * 106;
      const px = (x0 + x1) / 2 + (rr() - 0.5) * 10;
      pts.push(px, y - h * (0.6 + rr() * 0.5), x1, y - rr() * 4);
    }
    pts.push(102, 78);
    this.poly(pts).vfill(lighten(color, 0.15), color, y - h, y);
    if (snow) {
      for (let i = 4; i < pts.length - 2; i += 4) {
        const px = pts[i], py = pts[i + 1];
        this.poly([px, py, px - 5, py + 6, px - 1.5, py + 4.5, px + 1, py + 7, px + 5, py + 6]).fill('rgba(245,250,255,0.9)');
      }
    }
    return this;
  }
  ground(color, y = 60, color2) {
    this.rect(-2, y, 104, 80 - y).vfill(color, color2 || darken(color, 0.25), y, 78);
    return this;
  }
  treeline(color, y, h = 10, seed = 0) {
    const rr = srand(seed + 3);
    this.path((g) => {
      g.moveTo(-2, 78);
      g.lineTo(-2, y);
      for (let x = -2; x <= 104; x += 5) {
        const hh = h * (0.5 + rr() * 0.7);
        g.lineTo(x + 2.5, y - hh);
        g.lineTo(x + 5, y - hh * 0.3);
      }
      g.lineTo(104, 78);
      g.closePath();
    }).fill(color);
    return this;
  }
  water(y, c1 = '#3e7c8c', c2 = '#1f4552') {
    this.rect(-2, y, 104, 80 - y).vfill(c1, c2, y, 78);
    for (let i = 0; i < 9; i++) {
      const wy = y + 3 + this.r() * (74 - y), wx = this.r() * 100;
      this.curve(wx - 6, wy, wx, wy - 1.4, wx + 6, wy, 0.7, 'rgba(230,245,250,0.45)');
    }
    return this;
  }
  fog(y, a = 0.35, color = '220,214,205') {
    const g = this.g;
    const gr = g.createLinearGradient(0, y - 14, 0, y + 10);
    gr.addColorStop(0, `rgba(${color},0)`);
    gr.addColorStop(0.5, `rgba(${color},${a})`);
    gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr;
    g.fillRect(-2, y - 14, 104, 24);
    return this;
  }
  vignette(a = 0.5) {
    const g = this.g;
    const gr = g.createRadialGradient(50, 40, 18, 50, 40, 70);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(15,8,4,${a})`);
    g.fillStyle = gr;
    g.fillRect(-2, -2, 104, 80);
    return this;
  }
  grain(a = 0.07) {
    const g = this.g;
    g.save();
    g.globalAlpha = a;
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = noisePattern(g);
    g.fillRect(-2, -2, 104, 80);
    g.restore();
    return this;
  }
  /** a radial "spotlight" backdrop for objects */
  spot(c1, c2) {
    const g = this.g;
    const gr = g.createRadialGradient(50, 40, 4, 50, 44, 66);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.fillRect(-2, -2, 104, 80);
    return this;
  }
  /** a table top (objects rest on it) */
  table(y = 58, c = '#6a4325') {
    this.rect(-2, y, 104, 80 - y).vfill(lighten(c, 0.12), darken(c, 0.35), y, 78);
    this.line(-2, y, 102, y, 1, darken(c, 0.5));
    for (let i = 0; i < 4; i++) this.line(-2, y + 4 + i * 4, 102, y + 4 + i * 4, 0.4, 'rgba(30,15,5,0.25)');
    return this;
  }
  rays(x, y, n, len, color = 'rgba(255,220,150,0.18)', w = 6) {
    const g = this.g;
    g.save();
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a - w / len) * len, y + Math.sin(a - w / len) * len);
      g.lineTo(x + Math.cos(a + w / len) * len, y + Math.sin(a + w / len) * len);
      g.closePath();
      g.fill();
    }
    g.restore();
    return this;
  }
}
