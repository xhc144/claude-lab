// The painted table the cards lie on: one large offscreen canvas per level, plus seasonal overlays.
// Each biome has its own palette and scatter of details (grass, pebbles, pools, snow, cracks …).

import { makeCanvas, srand, noisePattern, mix, darken, lighten } from './paint.js';

export const BIOMES = {
  valley: { base: '#5f6a3c', alt: ['#717f44', '#4e5a32', '#7e7646'], tuft: '#93a356', dirt: '#8a7450', stone: '#9a948a', flower: ['#e8d070', '#e8e0d0', '#c86a8a'] },
  forest: { base: '#4a5a36', alt: ['#3e4e30', '#566640', '#5a5634'], tuft: '#6a8a46', dirt: '#6a5438', stone: '#7a7a70', flower: ['#d8c870', '#b8d0e8'], leaves: ['#a86a2a', '#c88a3a', '#7a4a22'] },
  marsh: { base: '#5a6448', alt: ['#4e5a42', '#6a6e50', '#5a6a58'], tuft: '#7a8a50', dirt: '#6a5e44', stone: '#8a8a80', water: '#4a7470', flower: ['#d8d8a0'] },
  mountain: { base: '#77705e', alt: ['#857c68', '#6a6454', '#8a8470'], tuft: '#8a9058', dirt: '#8a7a5e', stone: '#a8a296', flower: ['#d0c8e8'] },
  tundra: { base: '#d6dde2', alt: ['#e6ecf0', '#c4ced6', '#dfe6ea'], tuft: '#9aa4a0', dirt: '#b8c0c4', stone: '#8a929a', ice: '#a8cce0', flower: [] },
  isles: { base: '#c9b487', alt: ['#d6c294', '#b8a476', '#c4b482'], tuft: '#8a9a58', dirt: '#b09a70', stone: '#9a968c', water: '#3e7c8c', flower: ['#e8e0d0'] },
  ash: { base: '#3c3430', alt: ['#463c36', '#342c2a', '#4a3a32'], tuft: '#5a5048', dirt: '#2e2624', stone: '#5a5450', ember: '#ff8a3a', flower: [] },
};

/** paint the ground for a board of w×h world units; returns { canvas, scale } */
export function paintGround(biome, w, h, center, seed = 7) {
  const B = BIOMES[biome] || BIOMES.valley;
  const sc = Math.min(0.75, 2200 / Math.max(w, h));
  const cv = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc));
  const g = cv.getContext('2d');
  const r = srand(seed + biome.length * 31);
  g.scale(sc, sc);

  // base wash
  const bg = g.createRadialGradient(center.x, center.y, 100, center.x, center.y, Math.max(w, h) * 0.8);
  bg.addColorStop(0, lighten(B.base, 0.08));
  bg.addColorStop(1, darken(B.base, 0.18));
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // large soft blotches of colour variation
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = r() * h, rad = 120 + r() * 340;
    const c = B.alt[i % B.alt.length];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, hexA(c, 0.45));
    gr.addColorStop(1, hexA(c, 0));
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // water features
  if (biome === 'marsh') {
    for (let i = 0; i < 16; i++) pool(g, r, r() * w, r() * h, 60 + r() * 140, B.water);
  }
  if (biome === 'isles') {
    // the sea surrounds the island
    g.save();
    const sea = g.createRadialGradient(center.x, center.y, Math.min(w, h) * 0.42, center.x, center.y, Math.max(w, h) * 0.7);
    sea.addColorStop(0, hexA(B.water, 0));
    sea.addColorStop(0.35, hexA(B.water, 0.85));
    sea.addColorStop(1, hexA(darken(B.water, 0.3), 1));
    g.fillStyle = sea;
    g.fillRect(0, 0, w, h);
    g.restore();
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, d = Math.min(w, h) * (0.48 + r() * 0.5);
      const x = center.x + Math.cos(a) * d * (w / h) * 0.75, y = center.y + Math.sin(a) * d * 0.75;
      g.strokeStyle = 'rgba(230,245,250,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 14, y);
      g.quadraticCurveTo(x, y - 5, x + 14, y);
      g.stroke();
    }
  }
  if (biome === 'tundra') {
    for (let i = 0; i < 10; i++) {
      const x = r() * w, y = r() * h, rx = 80 + r() * 160;
      g.fillStyle = hexA(B.ice, 0.5);
      g.beginPath();
      g.ellipse(x, y, rx, rx * 0.45, r() * 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(x - rx * 0.6 + r() * rx, y - 10 + r() * 20);
        g.lineTo(x - rx * 0.6 + r() * rx, y - 10 + r() * 20);
        g.stroke();
      }
    }
  }

  // worn dirt paths from the camp outward
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.8;
    const len = 700 + r() * 900;
    g.strokeStyle = hexA(B.dirt, 0.35);
    g.lineWidth = 34 + r() * 20;
    g.beginPath();
    g.moveTo(center.x, center.y);
    const mx = center.x + Math.cos(a + 0.4) * len * 0.5, my = center.y + Math.sin(a + 0.4) * len * 0.5;
    g.quadraticCurveTo(mx, my, center.x + Math.cos(a) * len, center.y + Math.sin(a) * len);
    g.stroke();
    g.strokeStyle = hexA(darken(B.dirt, 0.2), 0.18);
    g.lineWidth = 6;
    g.stroke();
  }
  // camp clearing
  const cg = g.createRadialGradient(center.x, center.y, 30, center.x, center.y, 520);
  cg.addColorStop(0, hexA(B.dirt, 0.55));
  cg.addColorStop(0.6, hexA(B.dirt, 0.2));
  cg.addColorStop(1, hexA(B.dirt, 0));
  g.fillStyle = cg;
  g.fillRect(center.x - 520, center.y - 520, 1040, 1040);

  // grass tufts
  const tufts = biome === 'ash' ? 500 : biome === 'tundra' ? 380 : 2200;
  for (let i = 0; i < tufts; i++) {
    const x = r() * w, y = r() * h;
    if (biome === 'isles' && Math.hypot((x - center.x) / (w / h), y - center.y) > Math.min(w, h) * 0.42) continue;
    const n = 3 + Math.floor(r() * 4), hh = 7 + r() * 9;
    g.strokeStyle = hexA(i % 3 ? B.tuft : darken(B.tuft, 0.3), 0.55);
    g.lineWidth = 1.4;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const dx = (k - n / 2) * 2.4;
      g.moveTo(x + dx, y);
      g.quadraticCurveTo(x + dx + (r() - 0.5) * 6, y - hh * 0.6, x + dx + (r() - 0.5) * 9, y - hh);
    }
    g.stroke();
  }
  // pebbles
  for (let i = 0; i < 140; i++) {
    const x = r() * w, y = r() * h, s = 2 + r() * 6;
    g.fillStyle = hexA(darken(B.stone, 0.4), 0.5);
    g.beginPath();
    g.ellipse(x + 1, y + 1.5, s, s * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hexA(mix(B.stone, B.base, 0.3 + r() * 0.4), 0.8);
    g.beginPath();
    g.ellipse(x, y, s, s * 0.7, r(), 0, Math.PI * 2);
    g.fill();
  }
  // flowers / leaves / embers
  for (let i = 0; i < (B.flower.length ? 90 : 0); i++) {
    const x0 = r() * w, y0 = r() * h;
    g.fillStyle = B.flower[i % B.flower.length];
    g.globalAlpha = 0.45;
    for (let m = 0; m < 4; m++) {
    const x = x0 + (r() - 0.5) * 50, y = y0 + (r() - 0.5) * 30;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(x + Math.cos(k * 1.57) * 1.8, y + Math.sin(k * 1.57) * 1.8, 1.5, 0, Math.PI * 2);
      g.fill();
    }
    }
    g.globalAlpha = 1;
  }
  // woodcut hatching: clusters of short parallel strokes give the ground a printed texture
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = r() * w, y = r() * h, n = 4 + Math.floor(r() * 6), len = 10 + r() * 18;
    g.strokeStyle = i % 4 ? 'rgba(20,14,8,0.10)' : 'rgba(255,245,220,0.07)';
    g.lineWidth = 1.6;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      g.moveTo(x + k * 4, y + k * 1.5);
      g.lineTo(x + k * 4 + len * 0.5, y + k * 1.5 - len);
    }
    g.stroke();
  }
  if (B.leaves) {
    for (let i = 0; i < 700; i++) {
      const x = r() * w, y = r() * h;
      g.fillStyle = hexA(B.leaves[i % B.leaves.length], 0.6);
      g.beginPath();
      g.ellipse(x, y, 4, 2, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (biome === 'ash') {
    for (let i = 0; i < 46; i++) crack(g, r, r() * w, r() * h, B.ember);
  }
  if (biome === 'mountain') {
    for (let i = 0; i < 26; i++) outcrop(g, r, r() * w, r() * h, B.stone);
  }

  // paper grain over everything
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 0.09;
  g.globalCompositeOperation = 'overlay';
  g.fillStyle = noisePattern(g);
  g.fillRect(0, 0, cv.width, cv.height);
  g.restore();

  // darkened rim — the edge of the known world
  g.save();
  const rim = 160;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, rim, 0, 0, w, rim], [0, h, 0, h - rim, 0, h - rim, w, rim], [0, 0, rim, 0, 0, 0, rim, h], [w, 0, w - rim, 0, w - rim, 0, rim, h]]) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(18,12,8,0.75)');
    gr.addColorStop(1, 'rgba(18,12,8,0)');
    g.fillStyle = gr;
    g.fillRect(rx, ry, rw, rh);
  }
  g.restore();
  return { canvas: cv, scale: sc };
}

/** a blotchy snow cover laid over non-tundra ground in winter */
export function paintSnow(w, h, seed = 3) {
  const sc = Math.min(0.4, 1400 / Math.max(w, h));
  const cv = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc));
  const g = cv.getContext('2d');
  const r = srand(seed);
  g.scale(sc, sc);
  g.fillStyle = 'rgba(236,242,248,0.55)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const x = r() * w, y = r() * h, rad = 60 + r() * 220;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(250,252,255,0.75)');
    gr.addColorStop(1, 'rgba(250,252,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * w, y = r() * h, rad = 30 + r() * 90;
    g.fillStyle = 'rgba(150,170,200,0.12)';
    g.beginPath();
    g.ellipse(x, y, rad, rad * 0.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  return { canvas: cv, scale: sc };
}

function pool(g, r, x, y, rad, water) {
  g.fillStyle = hexA(darken(water, 0.35), 0.6);
  g.beginPath();
  g.ellipse(x + 4, y + 5, rad, rad * 0.55, 0, 0, Math.PI * 2);
  g.fill();
  const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.2, 4, x, y, rad);
  gr.addColorStop(0, lighten(water, 0.25));
  gr.addColorStop(1, water);
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, rad, rad * 0.55, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(30,40,30,0.5)';
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = 'rgba(220,240,240,0.35)';
  g.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    const yy = y - rad * 0.2 + k * rad * 0.18;
    g.beginPath();
    g.moveTo(x - rad * 0.4, yy);
    g.quadraticCurveTo(x, yy - 4, x + rad * 0.4, yy);
    g.stroke();
  }
  // reeds on the bank
  g.strokeStyle = 'rgba(60,70,40,0.8)';
  g.lineWidth = 1.6;
  for (let k = 0; k < 10; k++) {
    const a = r() * Math.PI * 2, bx = x + Math.cos(a) * rad * 0.95, by = y + Math.sin(a) * rad * 0.52;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + (r() - 0.5) * 6, by - 18 - r() * 14);
    g.stroke();
  }
}

function crack(g, r, x, y, ember) {
  let px = x, py = y;
  g.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const nx = px + (r() - 0.5) * 90, ny = py + (r() - 0.5) * 90;
    g.strokeStyle = 'rgba(15,8,6,0.85)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(nx, ny);
    g.stroke();
    g.strokeStyle = hexA(ember, 0.55);
    g.lineWidth = 1.6;
    g.stroke();
    px = nx;
    py = ny;
  }
  const gr = g.createRadialGradient(x, y, 0, x, y, 60);
  gr.addColorStop(0, hexA(ember, 0.18));
  gr.addColorStop(1, hexA(ember, 0));
  g.fillStyle = gr;
  g.fillRect(x - 60, y - 60, 120, 120);
}

function outcrop(g, r, x, y, stone) {
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const cx = x + (r() - 0.5) * 60, cy = y + (r() - 0.5) * 30, s = 14 + r() * 22;
    g.fillStyle = 'rgba(30,25,20,0.35)';
    g.beginPath();
    g.ellipse(cx + 5, cy + s * 0.4, s, s * 0.35, 0, 0, Math.PI * 2);
    g.fill();
    const gr = g.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
    gr.addColorStop(0, lighten(stone, 0.2));
    gr.addColorStop(1, darken(stone, 0.35));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(cx - s, cy + s * 0.3);
    g.lineTo(cx - s * 0.5, cy - s * 0.6);
    g.lineTo(cx + s * 0.3, cy - s * 0.7);
    g.lineTo(cx + s, cy + s * 0.2);
    g.lineTo(cx + s * 0.4, cy + s * 0.45);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30,22,16,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }
}

export function hexA(hex, a) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
}
