// Small vector glyphs shared by card faces, the board overlays and the HTML interface. Every icon is
// drawn centred on (x, y) inside an s×s box, in the same ink-and-colour language as the cards.

import { INK } from './paint.js';

const TAU = Math.PI * 2;

function inked(g, fill, w = 0.9) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.lineWidth = w * 0.1;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke();
}

const ICONS = {
  heart(g, c = '#c8443a') {
    g.beginPath();
    g.moveTo(0, 0.38);
    g.bezierCurveTo(-0.55, 0.02, -0.52, -0.42, -0.24, -0.42);
    g.bezierCurveTo(-0.08, -0.42, 0, -0.3, 0, -0.2);
    g.bezierCurveTo(0, -0.3, 0.08, -0.42, 0.24, -0.42);
    g.bezierCurveTo(0.52, -0.42, 0.55, 0.02, 0, 0.38);
    g.closePath();
    inked(g, c);
    g.beginPath();
    g.arc(-0.22, -0.2, 0.08, 0, TAU);
    g.fillStyle = 'rgba(255,240,220,0.7)';
    g.fill();
  },
  sword(g, c = '#d8d4c8') {
    g.save();
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, -0.5); g.lineTo(0.08, -0.38); g.lineTo(0.08, 0.16); g.lineTo(-0.08, 0.16); g.lineTo(-0.08, -0.38); g.closePath();
    inked(g, c);
    g.beginPath(); g.rect(-0.22, 0.16, 0.44, 0.08); inked(g, '#b8862e');
    g.beginPath(); g.rect(-0.05, 0.24, 0.1, 0.2); inked(g, '#6a3e22');
    g.restore();
  },
  shield(g, c = '#7a8aa0') {
    g.beginPath();
    g.moveTo(0, -0.44);
    g.quadraticCurveTo(0.22, -0.32, 0.4, -0.34);
    g.quadraticCurveTo(0.42, 0.18, 0, 0.46);
    g.quadraticCurveTo(-0.42, 0.18, -0.4, -0.34);
    g.quadraticCurveTo(-0.22, -0.32, 0, -0.44);
    g.closePath();
    inked(g, c);
    g.beginPath(); g.moveTo(0, -0.36); g.lineTo(0, 0.36); g.lineWidth = 0.06; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.stroke();
  },
  bowl(g, c = '#b5793a') {
    g.beginPath();
    g.moveTo(-0.46, -0.04); g.quadraticCurveTo(-0.4, 0.42, 0, 0.42); g.quadraticCurveTo(0.4, 0.42, 0.46, -0.04); g.closePath();
    inked(g, c);
    g.beginPath(); g.ellipse(0, -0.04, 0.46, 0.1, 0, 0, TAU); inked(g, '#e8b860', 0.7);
    for (const dx of [-0.16, 0.04, 0.22]) {
      g.beginPath(); g.moveTo(dx, -0.18); g.quadraticCurveTo(dx + 0.08, -0.3, dx, -0.42);
      g.lineWidth = 0.05; g.strokeStyle = 'rgba(255,250,240,0.8)'; g.stroke();
    }
  },
  flame(g, c = '#f08a2a') {
    g.beginPath();
    g.moveTo(0, -0.48);
    g.quadraticCurveTo(0.38, -0.08, 0.3, 0.18);
    g.quadraticCurveTo(0.24, 0.44, 0, 0.44);
    g.quadraticCurveTo(-0.24, 0.44, -0.3, 0.18);
    g.quadraticCurveTo(-0.34, -0.06, -0.08, -0.18);
    g.quadraticCurveTo(-0.02, -0.3, 0, -0.48);
    g.closePath();
    inked(g, c);
    g.beginPath(); g.moveTo(0, -0.06); g.quadraticCurveTo(0.16, 0.14, 0.12, 0.26); g.quadraticCurveTo(0, 0.38, -0.12, 0.26); g.quadraticCurveTo(-0.12, 0.08, 0, -0.06);
    g.fillStyle = '#ffe28a'; g.fill();
  },
  coin(g, c = '#d9a83a') {
    g.beginPath(); g.arc(0, 0, 0.42, 0, TAU); inked(g, c);
    g.beginPath(); g.arc(0, 0, 0.3, 0, TAU); g.lineWidth = 0.05; g.strokeStyle = 'rgba(90,50,10,0.7)'; g.stroke();
    g.beginPath(); g.rect(-0.08, -0.08, 0.16, 0.16); g.fillStyle = '#5a3a12'; g.fill();
  },
  sun(g, c = '#ffd060') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a - 0.2) * 0.28, Math.sin(a - 0.2) * 0.28);
      g.lineTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5);
      g.lineTo(Math.cos(a + 0.2) * 0.28, Math.sin(a + 0.2) * 0.28);
      g.fillStyle = '#f0a83a'; g.fill();
    }
    g.beginPath(); g.arc(0, 0, 0.26, 0, TAU); inked(g, c);
  },
  house(g, c = '#b58a5a') {
    g.beginPath(); g.moveTo(-0.34, -0.02); g.lineTo(-0.34, 0.42); g.lineTo(0.34, 0.42); g.lineTo(0.34, -0.02); inked(g, c);
    g.beginPath(); g.moveTo(-0.48, 0.02); g.lineTo(0, -0.44); g.lineTo(0.48, 0.02); g.closePath(); inked(g, '#8a3e2a');
    g.beginPath(); g.rect(-0.08, 0.14, 0.16, 0.28); g.fillStyle = '#3a2214'; g.fill();
  },
  hourglass(g, c = '#d8c08a') {
    g.beginPath(); g.moveTo(-0.3, -0.42); g.lineTo(0.3, -0.42); g.lineTo(0.04, 0); g.lineTo(0.3, 0.42); g.lineTo(-0.3, 0.42); g.lineTo(-0.04, 0); g.closePath();
    inked(g, 'rgba(230,240,245,0.85)');
    g.beginPath(); g.moveTo(-0.18, 0.4); g.lineTo(0, 0.16); g.lineTo(0.18, 0.4); g.closePath(); g.fillStyle = c; g.fill();
    g.beginPath(); g.moveTo(-0.38, -0.46); g.lineTo(0.38, -0.46); g.moveTo(-0.38, 0.46); g.lineTo(0.38, 0.46); g.lineWidth = 0.1; g.strokeStyle = '#6a3e22'; g.stroke();
  },
  leaf(g, c = '#6aa04a') {
    g.beginPath(); g.moveTo(-0.4, 0.4); g.quadraticCurveTo(-0.42, -0.38, 0.42, -0.42); g.quadraticCurveTo(0.36, 0.38, -0.4, 0.4); g.closePath(); inked(g, c);
    g.beginPath(); g.moveTo(-0.4, 0.4); g.quadraticCurveTo(0, 0, 0.3, -0.3); g.lineWidth = 0.05; g.strokeStyle = 'rgba(30,50,20,0.7)'; g.stroke();
  },
  skull(g, c = '#e8e0cc') {
    g.beginPath(); g.arc(0, -0.08, 0.36, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(0.2, 0.28); g.lineTo(0.2, 0.42); g.lineTo(-0.2, 0.42); g.lineTo(-0.2, 0.28); g.closePath(); inked(g, c);
    g.fillStyle = '#2a1a12';
    g.beginPath(); g.arc(-0.14, -0.04, 0.09, 0, TAU); g.fill();
    g.beginPath(); g.arc(0.14, -0.04, 0.09, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(0, 0.08); g.lineTo(-0.05, 0.17); g.lineTo(0.05, 0.17); g.fill();
  },
  spark(g, c = '#9ad8ff') {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? 0.14 : 0.48;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    inked(g, c, 0.7);
  },
  pick(g, c = '#a8a8b0') {
    g.beginPath(); g.moveTo(-0.32, 0.44); g.lineTo(0.18, -0.14); g.lineWidth = 0.13; g.strokeStyle = INK; g.stroke();
    g.lineWidth = 0.07; g.strokeStyle = '#8a5a32'; g.stroke();
    g.beginPath(); g.moveTo(-0.3, -0.4); g.quadraticCurveTo(0.2, -0.36, 0.44, 0.06); g.quadraticCurveTo(0.12, -0.12, -0.3, -0.4); g.closePath(); inked(g, c);
  },
  axe(g, c = '#a8a8b0') {
    g.beginPath(); g.moveTo(-0.3, 0.44); g.lineTo(0.2, -0.34); g.lineWidth = 0.13; g.strokeStyle = INK; g.stroke();
    g.lineWidth = 0.07; g.strokeStyle = '#8a5a32'; g.stroke();
    g.beginPath(); g.moveTo(0.04, -0.2); g.quadraticCurveTo(0.5, -0.24, 0.44, 0.12); g.lineTo(0.16, -0.02); g.closePath(); inked(g, c);
  },
  gear(g, c = '#b0a080') {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r = i % 2 ? 0.34 : 0.46;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    inked(g, c, 0.7);
    g.beginPath(); g.arc(0, 0, 0.13, 0, TAU); g.fillStyle = '#3a2a1a'; g.fill();
  },
  fog(g, c = '#b8b0c8') {
    for (const [y, x0, x1] of [[-0.24, -0.4, 0.3], [0.02, -0.3, 0.42], [0.28, -0.44, 0.24]]) {
      g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y - 0.16, x1, y);
      g.lineWidth = 0.13; g.strokeStyle = INK; g.stroke();
      g.lineWidth = 0.07; g.strokeStyle = c; g.stroke();
    }
  },
  cycle(g, c = '#c8b07a') {
    g.beginPath(); g.arc(0, 0, 0.34, -0.4, Math.PI * 1.55); g.lineWidth = 0.16; g.strokeStyle = INK; g.stroke();
    g.lineWidth = 0.08; g.strokeStyle = c; g.stroke();
    const a = -0.4, x = Math.cos(a) * 0.34, y = Math.sin(a) * 0.34;
    g.beginPath(); g.moveTo(x - 0.16, y - 0.12); g.lineTo(x + 0.14, y - 0.16); g.lineTo(x + 0.06, y + 0.14); g.closePath(); inked(g, c, 0.6);
  },
  box(g, c = '#a8784a') {
    g.beginPath(); g.rect(-0.4, -0.18, 0.8, 0.58); inked(g, c);
    g.beginPath(); g.rect(-0.44, -0.36, 0.88, 0.2); inked(g, '#8a5a32');
    g.beginPath(); g.rect(-0.07, -0.36, 0.14, 0.76); g.fillStyle = '#d9a83a'; g.fill();
  },
  people(g, c = '#c8a07a') {
    for (const [x, y, s] of [[-0.18, 0.04, 0.85], [0.18, 0.08, 0.95]]) {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.beginPath(); g.arc(0, -0.22, 0.14, 0, TAU); inked(g, c, 0.6);
      g.beginPath(); g.moveTo(-0.24, 0.36); g.quadraticCurveTo(-0.22, -0.06, 0, -0.06); g.quadraticCurveTo(0.22, -0.06, 0.24, 0.36); g.closePath(); inked(g, '#7a5a3a', 0.6);
      g.restore();
    }
  },
  moon(g, c = '#e8ecd8') {
    g.beginPath(); g.arc(0, 0, 0.42, 0.6, Math.PI * 2 - 0.6, false); g.arc(0.2, -0.06, 0.32, Math.PI * 2 - 0.9, 0.9, true); g.closePath(); inked(g, c);
  },
  snow(g, c = '#d8ecf8') {
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      g.beginPath(); g.moveTo(Math.cos(a) * -0.44, Math.sin(a) * -0.44); g.lineTo(Math.cos(a) * 0.44, Math.sin(a) * 0.44);
      g.lineWidth = 0.14; g.strokeStyle = INK; g.stroke();
      g.lineWidth = 0.07; g.strokeStyle = c; g.stroke();
    }
  },
  arrow(g, c = '#d8d4c8') {
    g.save(); g.rotate(-Math.PI / 4);
    g.beginPath(); g.moveTo(0, 0.46); g.lineTo(0, -0.2); g.lineWidth = 0.12; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.06; g.strokeStyle = '#8a5a32'; g.stroke();
    g.beginPath(); g.moveTo(0, -0.48); g.lineTo(0.16, -0.18); g.lineTo(-0.16, -0.18); g.closePath(); inked(g, c, 0.7);
    g.beginPath(); g.moveTo(0, 0.3); g.lineTo(-0.14, 0.46); g.moveTo(0, 0.3); g.lineTo(0.14, 0.46); g.lineWidth = 0.08; g.strokeStyle = '#c8443a'; g.stroke();
    g.restore();
  },
  hammer(g, c = '#a8a8b0') {
    g.save(); g.rotate(Math.PI / 5);
    g.beginPath(); g.moveTo(0, 0.48); g.lineTo(0, -0.16); g.lineWidth = 0.14; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.07; g.strokeStyle = '#8a5a32'; g.stroke();
    g.beginPath(); g.rect(-0.3, -0.42, 0.6, 0.28); inked(g, c, 0.8);
    g.restore();
  },
  ray(g, c = '#ffe08a') {
    g.beginPath(); g.moveTo(-0.12, -0.48); g.lineTo(0.22, -0.08); g.lineTo(0.02, -0.04); g.lineTo(0.14, 0.48); g.lineTo(-0.22, 0.02); g.lineTo(-0.02, -0.02); g.closePath(); inked(g, c, 0.7);
  },
  wing(g, c = '#d8d0c0') {
    g.beginPath(); g.moveTo(-0.44, 0.2); g.quadraticCurveTo(-0.2, -0.46, 0.46, -0.36); g.quadraticCurveTo(0.2, -0.2, 0.36, -0.12); g.quadraticCurveTo(0.08, 0, 0.24, 0.1); g.quadraticCurveTo(-0.08, 0.16, -0.44, 0.2); g.closePath(); inked(g, c, 0.7);
  },
  eye(g, c = '#e8e0cc') {
    g.beginPath(); g.moveTo(-0.46, 0); g.quadraticCurveTo(0, -0.42, 0.46, 0); g.quadraticCurveTo(0, 0.42, -0.46, 0); g.closePath(); inked(g, c);
    g.beginPath(); g.arc(0, 0, 0.16, 0, TAU); g.fillStyle = '#3a2a1a'; g.fill();
  },
  boot(g, c = '#8a5a32') {
    g.beginPath(); g.moveTo(-0.24, -0.44); g.lineTo(0.08, -0.44); g.lineTo(0.08, 0.1); g.lineTo(0.44, 0.22); g.lineTo(0.44, 0.42); g.lineTo(-0.24, 0.42); g.closePath(); inked(g, c);
  },
  boat(g, c = '#8a5a32') {
    g.beginPath(); g.moveTo(-0.46, 0.08); g.lineTo(0.46, 0.08); g.lineTo(0.3, 0.36); g.lineTo(-0.3, 0.36); g.closePath(); inked(g, c);
    g.beginPath(); g.moveTo(0, 0.08); g.lineTo(0, -0.46); g.lineTo(0.3, -0.04); g.closePath(); inked(g, '#e8dcc0', 0.7);
  },
  scroll(g, c = '#e8d8b0') {
    g.beginPath(); g.rect(-0.32, -0.36, 0.64, 0.72); inked(g, c);
    for (const y of [-0.16, 0, 0.16]) { g.beginPath(); g.moveTo(-0.2, y); g.lineTo(0.2, y); g.lineWidth = 0.05; g.strokeStyle = 'rgba(60,40,20,0.6)'; g.stroke(); }
    g.beginPath(); g.ellipse(0, -0.38, 0.38, 0.08, 0, 0, TAU); inked(g, '#b8945a', 0.6);
    g.beginPath(); g.ellipse(0, 0.38, 0.38, 0.08, 0, 0, TAU); inked(g, '#b8945a', 0.6);
  },
  plus(g, c = '#7ac85a') {
    g.beginPath(); g.rect(-0.12, -0.4, 0.24, 0.8); g.rect(-0.4, -0.12, 0.8, 0.24); inked(g, c, 0.6);
  },
  clock(g, c = '#e8dcc0') {
    g.beginPath(); g.arc(0, 0, 0.42, 0, TAU); inked(g, c);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -0.28); g.moveTo(0, 0); g.lineTo(0.2, 0.08); g.lineWidth = 0.08; g.strokeStyle = INK; g.stroke();
  },
  wave(g, c = '#6ab0c8') {
    for (const y of [-0.16, 0.14]) {
      g.beginPath(); g.moveTo(-0.46, y); g.quadraticCurveTo(-0.23, y - 0.2, 0, y); g.quadraticCurveTo(0.23, y + 0.2, 0.46, y);
      g.lineWidth = 0.14; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.07; g.strokeStyle = c; g.stroke();
    }
  },
  crown(g, c = '#e8b83a') {
    g.beginPath(); g.moveTo(-0.42, 0.3); g.lineTo(-0.42, -0.24); g.lineTo(-0.2, 0); g.lineTo(0, -0.36); g.lineTo(0.2, 0); g.lineTo(0.42, -0.24); g.lineTo(0.42, 0.3); g.closePath(); inked(g, c);
  },
  target(g, c = '#c8443a') {
    g.beginPath(); g.arc(0, 0, 0.42, 0, TAU); inked(g, '#efe3c8');
    g.beginPath(); g.arc(0, 0, 0.27, 0, TAU); g.fillStyle = c; g.fill();
    g.beginPath(); g.arc(0, 0, 0.11, 0, TAU); g.fillStyle = '#efe3c8'; g.fill();
  },
  lock(g, c = '#b0a080') {
    g.beginPath(); g.arc(0, -0.12, 0.22, Math.PI, 0); g.lineWidth = 0.14; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.07; g.strokeStyle = c; g.stroke();
    g.beginPath(); g.rect(-0.32, -0.1, 0.64, 0.5); inked(g, c);
  },
  pause(g, c = '#efe3c8') { g.beginPath(); g.rect(-0.3, -0.38, 0.2, 0.76); g.rect(0.1, -0.38, 0.2, 0.76); inked(g, c, 0.6); },
  play(g, c = '#efe3c8') { g.beginPath(); g.moveTo(-0.26, -0.4); g.lineTo(0.4, 0); g.lineTo(-0.26, 0.4); g.closePath(); inked(g, c, 0.6); },
  brain(g, c = '#e8a8b0') {
    g.beginPath(); g.ellipse(-0.14, 0, 0.26, 0.36, 0, 0, TAU); inked(g, c, 0.7);
    g.beginPath(); g.ellipse(0.14, 0, 0.26, 0.36, 0, 0, TAU); inked(g, c, 0.7);
    g.beginPath(); g.moveTo(0, -0.3); g.lineTo(0, 0.3); g.moveTo(-0.24, -0.06); g.quadraticCurveTo(-0.1, 0.02, -0.2, 0.16); g.moveTo(0.24, -0.06); g.quadraticCurveTo(0.1, 0.02, 0.2, 0.16); g.lineWidth = 0.05; g.strokeStyle = INK; g.stroke();
  },
};

export const ICON_NAMES = Object.keys(ICONS);

/** draw icon `name` centred at (x, y) with size s; `color` overrides the default fill */
export function drawIcon(g, name, x, y, s, color) {
  const f = ICONS[name];
  if (!f) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  f(g, color);
  g.restore();
}

const urlCache = new Map();
/** an icon rendered to a data URL, for <img> tags in the HTML interface */
export function iconURL(name, px = 32, color) {
  const key = name + '|' + px + '|' + (color || '');
  let u = urlCache.get(key);
  if (u) return u;
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  drawIcon(g, name, px / 2, px / 2, px * 0.92, color);
  u = c.toDataURL();
  urlCache.set(key, u);
  return u;
}
