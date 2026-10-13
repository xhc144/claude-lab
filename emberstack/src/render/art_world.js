// Plants, terrain features, buildings and objects for card illustrations.

import { lighten, darken, srand } from './paint.js';
import { flame } from './art_life.js';

// ---------------------------------------------------------------- plants --------------------------
export function tree(P, x, y, s, o = {}) {
  const leaf = o.leaf || '#5d8a3a';
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 18, 4, 0.4);
    P.path((c) => { c.moveTo(-4, 0); c.quadraticCurveTo(-3, -14, -2, -24); c.lineTo(2, -24); c.quadraticCurveTo(3, -14, 4, 0); c.closePath(); }).lfill('#6a4428', -4, -24, 4, 0).ink(1.1);
    const blobs = o.blobs || [[0, -36, 15], [-10, -28, 10], [10, -28, 10], [-6, -44, 9], [7, -42, 9]];
    for (const [bx, by, r] of blobs) P.circle(bx, by, r).lfill(leaf, bx - r, by - r, bx + r, by + r, 0.32).ink(1.1);
    for (const [bx, by, r] of blobs) P.circle(bx, by, r).shadeHatch(bx - r, by - r, bx + r, by + r, 0.22);
    if (o.fruit) for (const [fx, fy] of [[-8, -30], [6, -38], [9, -27], [-3, -42]]) P.circle(fx, fy, 2.2).fill(o.fruit).ink(0.6);
    if (o.glow) P.halo(0, -32, 30, o.glow, 0.25);
  });
}

export function pine(P, x, y, s, o = {}) {
  const leaf = o.leaf || '#2f5a40';
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 14, 3.5, 0.4);
    P.rect(-2, -10, 4, 10, 1).fill('#5a3a22').ink(0.9);
    for (let i = 0; i < 4; i++) {
      const w = 15 - i * 3.2, yy = -8 - i * 11;
      P.poly([-w, yy, 0, yy - 17, w, yy]).lfill(leaf, -w, yy - 17, w, yy, 0.3).ink(1.1);
      if (o.snow) P.poly([-w * 0.6, yy - 5, 0, yy - 17, w * 0.6, yy - 5, w * 0.3, yy - 7, 0, yy - 5, -w * 0.3, yy - 7]).fill('rgba(245,250,255,0.85)');
    }
  });
}

export function deadTree(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 14, 3.5);
    P.path((c) => { c.moveTo(-4, 0); c.lineTo(-2, -30); c.lineTo(-10, -44); c.moveTo(-2, -30); c.lineTo(4, -48); c.moveTo(0, -22); c.lineTo(10, -36); c.moveTo(4, -40); c.lineTo(12, -46); c.moveTo(4, 0); c.lineTo(2, -30); }).ink(3.4, '#3a2a20');
    P.path((c) => { c.moveTo(-4, 0); c.lineTo(-2, -30); c.lineTo(-10, -44); c.moveTo(-2, -30); c.lineTo(4, -48); c.moveTo(0, -22); c.lineTo(10, -36); }).ink(1.4, '#6a5444');
  });
}

export function bush(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 18, 4);
    for (const [bx, by, r] of [[-9, -8, 9], [8, -8, 9], [0, -14, 11]]) P.circle(bx, by, r).lfill(o.leaf || '#4f7a35', bx - r, by - r, bx + r, by + r).ink(1);
    if (o.berry) for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 4 + (i % 3) * 3; P.circle(Math.cos(a) * rr, -11 + Math.sin(a) * rr * 0.7, 1.9).fill(o.berry).ink(0.5); P.circle(Math.cos(a) * rr - 0.5, -11.6 + Math.sin(a) * rr * 0.7, 0.5).fill('rgba(255,255,255,0.7)'); }
  });
}

export function grass(P, x, y, s, color = '#8aa04a', n = 14, h = 18) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 16, 3);
    for (let i = 0; i < n; i++) {
      const bx = -14 + (i / n) * 28, lean = (i % 3 - 1) * 4;
      P.path((c) => { c.moveTo(bx - 1.4, 0); c.quadraticCurveTo(bx + lean * 0.5, -h * 0.6, bx + lean, -h * (0.7 + (i % 4) * 0.12)); c.quadraticCurveTo(bx + lean * 0.3, -h * 0.5, bx + 1.4, 0); c.closePath(); }).fill(i % 2 ? color : darken(color, 0.15)).ink(0.5);
    }
  });
}

export function wheat(P, x, y, s, n = 7) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 14, 3);
    for (let i = 0; i < n; i++) {
      const bx = -10 + (i / (n - 1)) * 20, top = -26 - (i % 3) * 3, lean = (i - n / 2) * 0.8;
      P.curve(bx, 0, bx + lean * 0.5, top * 0.5, bx + lean, top, 0.9, '#a88a3a');
      for (let k = 0; k < 4; k++) P.ellipse(bx + lean - 0.5 + (k % 2) * 1.4, top - 2 + k * 2.2, 1.3, 2.2, 0.4).fill('#e2c060').ink(0.4);
    }
  });
}

export function mushroom(P, x, y, s, cap = '#b84a2a', o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 8, 2);
    P.path((c) => { c.moveTo(-2.4, 0); c.quadraticCurveTo(-2, -6, -1.6, -9); c.lineTo(1.6, -9); c.quadraticCurveTo(2, -6, 2.4, 0); c.closePath(); }).fill('#efe3c8').ink(0.8);
    P.path((c) => { c.moveTo(-8, -8); c.quadraticCurveTo(-7, -17, 0, -17); c.quadraticCurveTo(7, -17, 8, -8); c.closePath(); }).lfill(cap, -8, -17, 8, -8).ink(1);
    for (const [dx, dy] of [[-4, -12], [2, -14], [4, -10]]) P.circle(dx, dy, 1.1).fill('#f6ecd8');
    if (o.glow) P.halo(0, -10, 12, o.glow, 0.5);
  });
}

export function herbs(P, x, y, s, color = '#5a9a4a') {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 14, 3);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.4;
      const ex = Math.cos(a) * 16, ey = Math.sin(a) * 16;
      P.curve(0, 0, ex * 0.4, ey * 0.6, ex, ey, 0.9, '#3a6a2a');
      P.ellipse(ex * 0.8, ey * 0.8, 4, 2, a).fill(i % 2 ? color : lighten(color, 0.15)).ink(0.6);
    }
    for (const [fx, fy] of [[-6, -14], [5, -15], [0, -18]]) P.circle(fx, fy, 1.6).fill('#e8e0f0').ink(0.4);
  });
}

export function reeds(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    for (let i = 0; i < 8; i++) {
      const bx = -12 + i * 3.4, top = -30 + (i % 3) * 4;
      P.curve(bx, 0, bx + 1, top / 2, bx + (i % 2 ? 2 : -1), top, 1, '#7a8a4a');
      if (i % 2 === 0) P.ellipse(bx + (i % 2 ? 2 : -1), top + 3, 1.6, 4.5).fill('#6a4a2a').ink(0.5);
    }
  });
}

// ---------------------------------------------------------------- terrain -------------------------
export function rocks(P, x, y, s, color = '#8e8a80', o = {}) {
  const rr = srand(o.seed || 7);
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 24, 5, 0.45);
    const set = o.set || [[-10, -2, 12, 10], [9, -2, 11, 9], [0, -8, 13, 12]];
    for (const [rx, ry, w, h] of set) {
      const pts = [];
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        pts.push(rx + Math.cos(a) * w * (0.8 + rr() * 0.3), ry + Math.sin(a) * h * (0.8 + rr() * 0.3));
      }
      pts.push(rx + w, ry, rx - w, ry);
      P.poly(pts).lfill(color, rx - w, ry - h, rx + w, ry, 0.35).ink(1.2);
      P.poly(pts).shadeHatch(rx - w, ry - h, rx + w, ry, 0.3);
      P.line(rx - w * 0.3, ry - h * 0.6, rx + w * 0.2, ry - h * 0.75, 0.8, 'rgba(255,250,235,0.45)');
      if (o.gems) for (let k = 0; k < 3; k++) {
        const gx = rx - w * 0.4 + rr() * w * 0.8, gy = ry - h * 0.2 - rr() * h * 0.6;
        crystal(P, gx, gy, 0.35 + rr() * 0.2, o.gems, o.glow);
      }
      if (o.veins) P.path((c) => { c.moveTo(rx - w * 0.6, ry - h * 0.3); c.lineTo(rx - w * 0.1, ry - h * 0.5); c.lineTo(rx + w * 0.4, ry - h * 0.2); }).ink(1.6, o.veins);
    }
  });
}

export function crystal(P, x, y, s, color = '#8ad8e8', glow) {
  P.at(x, y, s, 0, () => {
    if (glow) P.halo(0, -10, 18, glow, 0.6);
    for (const [dx, h, w, rot] of [[-5, 18, 4, -0.3], [0, 26, 5, 0], [6, 16, 4, 0.35]]) {
      P.at(dx, 0, 1, rot, () => {
        P.poly([-w, 0, -w, -h + w, 0, -h, w, -h + w, w, 0]).lfill(color, -w, -h, w, 0, 0.45).ink(0.9);
        P.line(0, -h, 0, 0, 0.5, 'rgba(255,255,255,0.6)');
      });
    }
  });
}

export function pit(P, x, y, s, inner = '#7a5a3a', rim = '#6a7a3a') {
  P.at(x, y, s, 0, () => {
    P.ellipse(0, 0, 30, 10).fill(rim).ink(1);
    P.ellipse(0, 1, 24, 7).vfill(darken(inner, 0.2), inner, -6, 8).ink(1);
    P.ellipse(0, 1, 24, 7).hatch(2.2, 0.3, 0.25);
  });
}

export function pool(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.ellipse(0, 0, 32, 11).fill(o.rim || '#6a6a52').ink(1);
    P.ellipse(0, 0.5, 27, 8.5).vfill(o.c1 || '#5a9aa8', o.c2 || '#2a5a68', -8, 8).ink(0.8);
    P.curve(-14, -2, -6, -4, 2, -2, 0.7, 'rgba(255,255,255,0.5)');
    P.curve(4, 2, 10, 0, 16, 2, 0.6, 'rgba(255,255,255,0.35)');
    if (o.steam) for (let i = 0; i < 3; i++) P.curve(-10 + i * 10, -4, -14 + i * 10, -14, -8 + i * 10, -22, 1.6, 'rgba(255,255,255,0.35)');
  });
}

// ---------------------------------------------------------------- buildings -----------------------
export function fireRing(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.halo(0, -12, 40, 'rgba(255,150,60,1)', o.out ? 0.05 : 0.45);
    P.shadow(0, 2, 22, 5);
    // logs
    P.at(0, -2, 1, 0.3, () => P.rect(-14, -2.5, 28, 5, 2.5).lfill('#6a4428', -14, -3, 14, 3).ink(1));
    P.at(0, -2, 1, -0.3, () => P.rect(-14, -2.5, 28, 5, 2.5).lfill('#7a5030', -14, -3, 14, 3).ink(1));
    // stones
    const n = o.stones || 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sx = Math.cos(a) * 17, sy = Math.sin(a) * 5 + 1;
      P.ellipse(sx, sy, 4.4, 3.2).lfill(o.stoneColor || '#8a847a', sx - 4, sy - 3, sx + 4, sy + 3, 0.35).ink(0.9);
    }
    if (!o.out) flame(P, 0, -3, o.big ? 1.8 : 1.35, true);
    else P.path((c) => { c.moveTo(-3, -4); c.quadraticCurveTo(-6, -12, 0, -18); }).ink(1.4, 'rgba(180,180,180,0.4)');
  });
}

export function hut(P, x, y, s, o = {}) {
  const wall = o.wall || '#8a6a42';
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 28, 5);
    if (o.kind === 'lean') {
      P.poly([-24, 0, 18, -30, 24, 0]).lfill('#7a6a3a', -24, -30, 24, 0, 0.3).ink(1.3);
      P.poly([-24, 0, 18, -30, 24, 0]).hatch(2.4, 2.1, 0.35, '#3a2a14', 0.9);
      P.poly([-2, 0, 10, -16, 14, 0]).fill('#2a1a10');
      return;
    }
    if (o.kind === 'snow') {
      P.path((c) => { c.moveTo(-24, 0); c.quadraticCurveTo(-24, -30, 0, -30); c.quadraticCurveTo(24, -30, 24, 0); c.closePath(); }).lfill('#dfe8ee', -24, -30, 24, 0, 0.25).ink(1.2);
      for (let r = 0; r < 3; r++) P.curve(-22 + r * 2, -8 - r * 8, 0, -12 - r * 9, 22 - r * 2, -8 - r * 8, 0.6, 'rgba(60,80,100,0.5)');
      P.path((c) => { c.moveTo(-6, 0); c.quadraticCurveTo(-6, -12, 0, -12); c.quadraticCurveTo(6, -12, 6, 0); c.closePath(); }).fill('#2a3a4a');
      return;
    }
    P.rect(-20, -22, 40, 22).lfill(wall, -20, -22, 20, 0, 0.25).ink(1.2);
    if (o.kind === 'stone') for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) P.rect(-20 + k * 8 + (r % 2) * 4, -22 + r * 5.5, 8, 5.5).ink(0.5, 'rgba(30,20,10,0.5)');
    else for (let k = 0; k < 6; k++) P.line(-20, -20 + k * 3.6, 20, -20 + k * 3.6, 0.5, 'rgba(30,20,10,0.4)');
    P.poly([-25, -21, 0, -40, 25, -21]).lfill(o.roof || '#7a3a26', -25, -40, 25, -21, 0.3).ink(1.3);
    P.poly([-25, -21, 0, -40, 25, -21]).hatch(2, 2.4, 0.3);
    P.rect(-5, -13, 10, 13, 1).fill('#3a2414').ink(1);
    P.rect(9, -16, 7, 6, 0.6).fill('rgba(255,200,110,0.9)').ink(0.8);
    P.halo(12.5, -13, 9, 'rgba(255,190,90,1)', 0.35);
    if (o.chimney) { P.rect(10, -38, 5, 10).fill('#6a5a4a').ink(0.9); P.curve(12, -40, 9, -48, 14, -56, 1.8, 'rgba(220,220,220,0.4)'); }
  });
}

export function tower(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 18, 4);
    const top = o.h || -58;
    P.poly([-10, 0, -7, top + 8, 7, top + 8, 10, 0]).lfill(o.wall || '#8a7a6a', -10, top, 10, 0, 0.3).ink(1.2);
    if (o.stripes) for (let i = 0; i < 3; i++) P.poly([-9.5 + i * 0.9, -10 - i * 14, -9 + i * 0.9, -16 - i * 14, 9 - i * 0.9, -16 - i * 14, 9.5 - i * 0.9, -10 - i * 14]).fill(o.stripes);
    for (let i = 0; i < 6; i++) P.line(-8, -8 - i * 8, 8, -8 - i * 8, 0.5, 'rgba(30,20,10,0.35)');
    P.rect(-11, top + 4, 22, 5, 1).fill(darken(o.wall || '#8a7a6a', 0.25)).ink(1);
    if (o.light) {
      P.rays(0, top, 10, 50, o.ray || 'rgba(255,225,150,0.16)', 8);
      P.halo(0, top, 22, o.light, 0.8);
      P.rect(-6, top - 6, 12, 10, 1).fill('rgba(255,236,170,0.95)').ink(1);
    } else if (o.fire) { P.rect(-7, top - 2, 14, 6, 1).fill('#5a4a3a').ink(0.9); flame(P, 0, top - 1, 0.9); }
    P.poly([-12, top - 4, 0, top - 16, 12, top - 4]).lfill(o.roof || '#5a3a2a', -12, top - 16, 12, top - 4).ink(1.1);
    P.rect(-3, -9, 6, 9, 1).fill('#2a1a10').ink(0.8);
  });
}

export function post(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 10, 3);
    P.rect(-2, -40, 4, 40, 1.2).lfill(o.pole || '#6a4428', -2, -40, 2, 0).ink(1);
    P.rect(-6, -2, 12, 3, 1).fill('#5a4a3a').ink(0.8);
    if (o.lamp) {
      P.halo(0, -44, 22, 'rgba(255,200,110,1)', 0.65);
      P.path((c) => { c.moveTo(-6, -40); c.lineTo(-5, -50); c.lineTo(5, -50); c.lineTo(6, -40); c.closePath(); }).fill('rgba(255,225,150,0.95)').ink(1);
      P.poly([-7, -50, 0, -56, 7, -50]).fill('#3a3a42').ink(0.9);
    } else flame(P, 0, -40, 1.05);
  });
}

export function anvil(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 20, 4);
    P.rect(-6, -10, 12, 10, 1).fill('#3a3e44').ink(1);
    P.path((c) => { c.moveTo(-20, -18); c.lineTo(16, -18); c.quadraticCurveTo(22, -18, 22, -14); c.lineTo(8, -12); c.lineTo(8, -10); c.lineTo(-8, -10); c.lineTo(-8, -12); c.quadraticCurveTo(-16, -12, -20, -18); c.closePath(); }).lfill('#5a626a', -20, -18, 22, -10, 0.45).ink(1.2);
    P.line(-16, -17, 14, -17, 0.8, 'rgba(255,255,255,0.4)');
  });
}

export function furnace(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 22, 4);
    P.path((c) => { c.moveTo(-18, 0); c.lineTo(-14, -30); c.quadraticCurveTo(0, -40, 14, -30); c.lineTo(18, 0); c.closePath(); }).lfill(o.color || '#8a5a3a', -18, -38, 18, 0, 0.3).ink(1.3);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) P.rect(-16 + k * 8 + (r % 2) * 4, -28 + r * 5.5, 8, 5.5).ink(0.45, 'rgba(30,15,5,0.45)');
    P.halo(0, -9, 16, 'rgba(255,140,40,1)', 0.7);
    P.path((c) => { c.moveTo(-7, 0); c.lineTo(-7, -10); c.quadraticCurveTo(0, -18, 7, -10); c.lineTo(7, 0); c.closePath(); }).vfill('#ffd36a', '#c4401a', -16, 0).ink(1);
    if (o.chimney !== false) { P.rect(-3, -48, 6, 12).fill(darken(o.color || '#8a5a3a', 0.2)).ink(1); P.curve(0, -50, -5, -58, 2, -66, 2.2, 'rgba(200,200,200,0.35)'); }
  });
}

export function tent(P, x, y, s, color = '#c9b48a', o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 26, 5);
    P.poly([-24, 0, 0, -32, 24, 0]).lfill(color, -24, -32, 24, 0, 0.3).ink(1.3);
    if (o.stripe) P.poly([-6, 0, 0, -32, 6, 0]).fill(o.stripe);
    P.poly([-6, 0, 0, -14, 6, 0]).fill('#2a1a10').ink(0.8);
    P.line(0, -32, 0, -38, 1.2);
    if (o.flag) P.poly([0, -38, 8, -36, 0, -34]).fill(o.flag).ink(0.6);
  });
}

export function wall(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 40, 5);
    if (o.wood) {
      for (let i = 0; i < 9; i++) { const bx = -36 + i * 9; P.poly([bx - 4, 0, bx - 4, -26 - (i % 2) * 3, bx, -32 - (i % 2) * 3, bx + 4, -26 - (i % 2) * 3, bx + 4, 0]).lfill('#7a5232', bx - 4, -34, bx + 4, 0).ink(1); }
      P.rect(-38, -18, 76, 3, 1).fill('#5a3a20').ink(0.8);
      return;
    }
    P.rect(-38, -24, 76, 24).lfill('#8a847a', -38, -24, 38, 0, 0.3).ink(1.2);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) P.rect(-38 + k * 10 + (r % 2) * 5, -24 + r * 6, 10, 6).ink(0.5, 'rgba(30,20,10,0.45)');
    for (let k = 0; k < 6; k++) P.rect(-38 + k * 14, -31, 8, 7).lfill('#8a847a', 0, -31, 0, -24).ink(1);
  });
}

// ---------------------------------------------------------------- objects -------------------------
export function logs(P, x, y, s, n = 3, color = '#9b6a3c') {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 2, 26, 5);
    const rows = n >= 3 ? [[-12, 0], [12, 0], [0, -11]] : [[0, 0], [0, -11]].slice(0, n);
    for (const [lx, ly] of rows) {
      P.rect(lx - 18, ly - 5.5, 30, 11, 5).lfill(color, lx - 18, ly - 6, lx + 12, ly + 6, 0.3).ink(1.1);
      P.ellipse(lx + 12, ly, 4, 5.5).fill(lighten(color, 0.35)).ink(1);
      P.ellipse(lx + 12, ly, 2.2, 3).ink(0.5, darken(color, 0.3));
      P.line(lx - 14, ly - 2, lx + 6, ly - 2.5, 0.5, 'rgba(40,20,10,0.4)');
    }
  });
}

export function planks(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 2, 28, 5);
    for (let i = 0; i < 3; i++) {
      P.at(0, -i * 6, 1, (i - 1) * 0.06, () => {
        P.rect(-26, -3, 52, 6, 1).lfill(['#c08a50', '#b07c46', '#c99a5e'][i], -26, -3, 26, 3).ink(1);
        P.line(-22, -0.5, 20, -1, 0.4, 'rgba(60,30,10,0.4)');
      });
    }
  });
}

export function bricks(P, x, y, s, color = '#b5553a') {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 2, 24, 5);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - (r === 2 ? 1 : 0); k++) {
      const bx = -18 + k * 13 + (r % 2) * 6.5, by = -6 - r * 7;
      P.rect(bx, by, 12, 6.4, 1).lfill(color, bx, by, bx + 12, by + 6).ink(0.9);
    }
  });
}

export function ingot(P, x, y, s, color = '#c9773a', n = 3) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 2, 24, 5);
    const pos = n === 1 ? [[0, 0]] : [[-10, 0], [10, 0], [0, -8]].slice(0, n);
    for (const [ix, iy] of pos) {
      P.poly([ix - 11, iy, ix - 8, iy - 7, ix + 8, iy - 7, ix + 11, iy]).lfill(color, ix - 11, iy - 7, ix + 11, iy, 0.45).ink(1);
      P.poly([ix - 8, iy - 7, ix + 8, iy - 7, ix + 6, iy - 9, ix - 6, iy - 9]).fill(lighten(color, 0.35)).ink(0.8);
    }
  });
}

export function ore(P, x, y, s, rock = '#6a645c', gem = '#4ab08a', glow) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 2, 22, 5);
    P.blob([-16, -2, -14, -14, -2, -20, 12, -16, 17, -4, 6, 2]).lfill(rock, -16, -20, 17, 2, 0.3).ink(1.2);
    P.blob([-16, -2, -14, -14, -2, -20, 12, -16, 17, -4, 6, 2]).shadeHatch(-16, -20, 17, 2, 0.3);
    for (const [gx, gy, r] of [[-6, -10, 3.6], [5, -12, 3], [2, -4, 2.6], [10, -6, 2.2]]) {
      if (glow) P.halo(gx, gy, r * 3, glow, 0.6);
      P.poly([gx - r, gy, gx, gy - r * 1.3, gx + r, gy, gx, gy + r * 0.8]).lfill(gem, gx - r, gy - r, gx + r, gy + r, 0.5).ink(0.7);
    }
  });
}

export function pile(P, x, y, s, color = '#e8e0d0', o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 24, 5);
    P.path((c) => { c.moveTo(-22, 0); c.quadraticCurveTo(-12, -22, 0, -24); c.quadraticCurveTo(12, -22, 22, 0); c.closePath(); }).lfill(color, -22, -24, 22, 0, 0.3).ink(1.1);
    const rr = srand(o.seed || 3);
    for (let i = 0; i < (o.dots || 22); i++) { const px = (rr() - 0.5) * 34, py = -rr() * 18 - 1; if (Math.abs(px) > 22 - (-py) * 0.8) continue; P.circle(px, py, o.dot || 0.8).fill(o.dotColor || darken(color, 0.3)); }
  });
}

export function sack(P, x, y, s, color = '#c9b080', label) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 18, 4);
    P.path((c) => { c.moveTo(-14, 0); c.quadraticCurveTo(-18, -16, -8, -24); c.lineTo(-4, -28); c.lineTo(4, -28); c.lineTo(8, -24); c.quadraticCurveTo(18, -16, 14, 0); c.closePath(); }).lfill(color, -18, -28, 18, 0, 0.3).ink(1.2);
    P.path((c) => { c.moveTo(-6, -24); c.quadraticCurveTo(0, -21, 6, -24); }).ink(1.2, '#6a4a2a');
    if (label) P.circle(0, -11, 5).fill(label).ink(0.6);
  });
}

export function jar(P, x, y, s, color = '#b5793a', fillc, o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 14, 3.5);
    P.path((c) => { c.moveTo(-6, -26); c.lineTo(6, -26); c.lineTo(5, -22); c.quadraticCurveTo(14, -16, 12, -6); c.quadraticCurveTo(10, 0, 0, 0); c.quadraticCurveTo(-10, 0, -12, -6); c.quadraticCurveTo(-14, -16, -5, -22); c.closePath(); })
      .lfill(color, -14, -26, 14, 0, 0.35).ink(1.2);
    if (fillc) P.ellipse(0, -26, 6, 1.8).fill(fillc).ink(0.6);
    if (o.band) P.rect(-12.5, -14, 25, 2.4).fill(o.band);
    if (o.label) P.rect(-6, -15, 12, 8, 1).fill('#efe3c0').ink(0.6);
    if (o.cloth) { P.path((c) => { c.moveTo(-8, -26); c.quadraticCurveTo(0, -32, 8, -26); c.lineTo(6, -22); c.lineTo(-6, -22); c.closePath(); }).fill(o.cloth).ink(0.8); }
    P.curve(-8, -18, -10, -10, -7, -4, 0.9, 'rgba(255,255,255,0.35)');
  });
}

export function bottle(P, x, y, s, liquid = '#c33a3a', o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 12, 3);
    if (o.glow) P.halo(0, -10, 20, o.glow, 0.5);
    P.path((c) => { c.moveTo(-3, -28); c.lineTo(3, -28); c.lineTo(3, -20); c.quadraticCurveTo(12, -16, 11, -7); c.quadraticCurveTo(10, 0, 0, 0); c.quadraticCurveTo(-10, 0, -11, -7); c.quadraticCurveTo(-12, -16, -3, -20); c.closePath(); })
      .fill('rgba(220,235,240,0.35)').ink(1.1);
    P.path((c) => { c.moveTo(-10.5, -10); c.quadraticCurveTo(0, -13, 10.5, -10); c.quadraticCurveTo(10, 0, 0, 0); c.quadraticCurveTo(-10, 0, -10.5, -10); c.closePath(); }).vfill(lighten(liquid, 0.2), darken(liquid, 0.25), -12, 0);
    P.rect(-3.6, -32, 7.2, 5, 1).fill('#8a5a32').ink(0.8);
    P.curve(-7, -14, -8, -8, -5, -4, 1, 'rgba(255,255,255,0.6)');
  });
}

export function plate(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 26, 5);
    P.ellipse(0, 0, 26, 7).lfill('#d9cdb0', -26, -7, 26, 7, 0.2).ink(1.1);
    P.ellipse(0, -0.5, 19, 4.6).ink(0.6, 'rgba(80,60,30,0.4)');
  });
}

export function bowl(P, x, y, s, soup = '#b56a2a') {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 20, 4);
    P.path((c) => { c.moveTo(-18, -12); c.quadraticCurveTo(-16, 2, 0, 2); c.quadraticCurveTo(16, 2, 18, -12); c.closePath(); }).lfill('#8a5a32', -18, -12, 18, 2).ink(1.2);
    P.ellipse(0, -12, 18, 4.5).fill(soup).ink(1);
    for (const [cx, cy, cc] of [[-6, -12.5, '#e2a040'], [4, -11.5, '#6a9a3a'], [8, -13, '#c05030']]) P.circle(cx, cy, 2).fill(cc);
    for (let i = 0; i < 3; i++) P.curve(-6 + i * 6, -18, -9 + i * 6, -24, -5 + i * 6, -30, 1.4, 'rgba(255,255,255,0.35)');
  });
}

export function coin(P, x, y, s, color = '#d9a83a') {
  P.at(x, y, s, 0, () => {
    P.ellipse(0, 0, 10, 10).lfill(color, -10, -10, 10, 10, 0.45).ink(1.1);
    P.ellipse(0, 0, 7, 7).ink(0.7, darken(color, 0.4));
    P.rect(-2, -2, 4, 4).fill(darken(color, 0.45));
  });
}

export function scroll(P, x, y, s, o = {}) {
  P.at(x, y, s, o.rot || 0, () => {
    P.shadow(0, 8, 24, 4);
    P.rect(-20, -12, 40, 22, 1).lfill('#e8d9b0', -20, -12, 20, 10, 0.2).ink(1);
    for (let i = 0; i < 4; i++) P.line(-14, -6 + i * 4.4, 10 - (i % 2) * 6, -6 + i * 4.4, 0.8, 'rgba(60,40,20,0.55)');
    P.rect(-23, -14, 5, 26, 2.5).lfill('#8a5a32', -23, -14, -18, 12).ink(0.9);
    P.rect(18, -14, 5, 26, 2.5).lfill('#8a5a32', 18, -14, 23, 12).ink(0.9);
    if (o.seal) { P.circle(10, 6, 3.4).fill(o.seal).ink(0.6); }
    if (o.torn) P.poly([4, -12, 8, -9, 12, -12, 16, -8, 20, -12, 20, -12]).fill('#2a1e14');
  });
}

export function book(P, x, y, s, color = '#7a2e2a') {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 2, 22, 4);
    P.poly([-18, -4, 14, -4, 20, -10, -12, -10]).fill('#efe3c0').ink(0.9);
    P.rect(-18, -4, 32, 7, 1).lfill(color, -18, -4, 14, 3).ink(1);
    P.poly([14, -4, 20, -10, 20, -3, 14, 3]).fill(darken(color, 0.3)).ink(0.9);
    P.line(-14, -0.5, 10, -0.5, 0.6, '#d9b45a');
  });
}

export function gearShape(P, x, y, s, color = '#9a8a6a', teeth = 9) {
  P.at(x, y, s, 0, () => {
    const pts = [];
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 ? 13 : 16.5;
      pts.push(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r, Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r);
    }
    P.poly(pts).lfill(color, -16, -16, 16, 16, 0.45).ink(1.1);
    P.circle(0, 0, 5).fill(darken(color, 0.55)).ink(0.9);
    P.circle(0, 0, 9.5).ink(0.6, 'rgba(30,20,10,0.4)');
  });
}

export function chest(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 26, 5);
    if (o.open) P.halo(0, -20, 26, 'rgba(255,220,120,1)', 0.6);
    P.rect(-20, -16, 40, 16, 1.5).lfill(o.color || '#7a4a26', -20, -16, 20, 0).ink(1.2);
    P.path((c) => { c.moveTo(-20, -16); c.quadraticCurveTo(-20, -28, 0, -28); c.quadraticCurveTo(20, -28, 20, -16); c.closePath(); }).lfill(lighten(o.color || '#7a4a26', 0.1), -20, -28, 20, -16).ink(1.2);
    for (const bx of [-12, 12]) P.rect(bx - 2, -27, 4, 27).fill(o.band || '#c9a45a').ink(0.6);
    P.rect(-3, -18, 6, 6, 1).fill(o.band || '#c9a45a').ink(0.8);
  });
}

export function boat(P, x, y, s, o = {}) {
  P.at(x, y, s, 0, () => {
    P.path((c) => { c.moveTo(-30, -10); c.quadraticCurveTo(-26, 2, 0, 2); c.quadraticCurveTo(26, 2, 32, -12); c.lineTo(-30, -10); c.closePath(); }).lfill(o.hull || '#8a5a32', -30, -12, 32, 2).ink(1.3);
    for (let i = 0; i < 2; i++) P.curve(-26, -6 + i * 3.5, 0, -2 + i * 3.5, 28, -8 + i * 3.5, 0.5, 'rgba(40,20,10,0.5)');
    if (o.sail !== false) {
      P.line(0, -10, 0, -50, 1.6, '#5a3a20');
      P.path((c) => { c.moveTo(2, -48); c.quadraticCurveTo(22, -32, 2, -14); c.closePath(); }).lfill(o.sail || '#e8dcc0', 2, -48, 20, -14, 0.2).ink(1.1);
      P.path((c) => { c.moveTo(-2, -44); c.quadraticCurveTo(-16, -30, -2, -16); c.closePath(); }).fill(darken(o.sail || '#e8dcc0', 0.1)).ink(1);
    }
  });
}

export function cart(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 1, 30, 5);
    P.rect(-22, -22, 36, 14, 1).lfill('#8a5a32', -22, -22, 14, -8).ink(1.2);
    P.path((c) => { c.moveTo(-24, -22); c.quadraticCurveTo(-4, -40, 16, -22); c.closePath(); }).lfill('#d9c8a0', -24, -40, 16, -22, 0.2).ink(1.2);
    for (const wx of [-14, 6]) { P.circle(wx, -6, 6).fill('#5a3a20').ink(1); P.circle(wx, -6, 1.6).fill('#c9a45a'); }
    P.line(14, -14, 28, -10, 1.6, '#5a3a20');
  });
}

export function grave(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 18, 4);
    P.path((c) => { c.moveTo(-10, 0); c.lineTo(-10, -22); c.quadraticCurveTo(-10, -32, 0, -32); c.quadraticCurveTo(10, -32, 10, -22); c.lineTo(10, 0); c.closePath(); }).lfill('#8a8680', -10, -32, 10, 0, 0.3).ink(1.2);
    P.line(-5, -22, 5, -22, 1, 'rgba(30,20,10,0.6)');
    P.line(0, -27, 0, -15, 1, 'rgba(30,20,10,0.6)');
    for (const fx of [-14, 13]) P.circle(fx, -2, 2).fill('#e8e0f0').ink(0.4);
  });
}
