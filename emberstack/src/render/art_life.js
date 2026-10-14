// People, beasts and monsters for card illustrations.

import { INK, lighten, darken, mix } from './paint.js';

const SKIN = ['#e2b48a', '#d29d74', '#c58b62', '#e8c09a'];

/**
 * A standing person, feet at (x, y). o: { robe, robe2, hat, item, cape, skin, hair, beard, belt, scale, glow }
 */
export function figure(P, x, y, s, o = {}) {
  const g = P.g;
  const robe = o.robe || '#7a5236';
  const skin = o.skin || SKIN[0];
  const hair = o.hair || '#2c1c12';
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 18, 4, 0.4);
    if (o.glow) P.halo(o.glowAt?.[0] ?? 14, o.glowAt?.[1] ?? -30, 26, o.glow, 0.55);
    // cape behind
    if (o.cape) {
      P.poly([-10, -38, -20, -2, 20, -2, 10, -38]).lfill(o.cape, -20, -38, 20, 0, 0.25).ink(1.1);
    }
    // legs / boots under the hem
    P.rect(-8, -6, 6, 6, 1.5).fill(darken(robe, 0.55)).ink(0.9);
    P.rect(2, -6, 6, 6, 1.5).fill(darken(robe, 0.55)).ink(0.9);
    // robe
    P.path((c) => {
      c.moveTo(-5, -40);
      c.quadraticCurveTo(-10, -39, -12, -36);
      c.lineTo(-16, -4);
      c.quadraticCurveTo(0, 0, 16, -4);
      c.lineTo(12, -36);
      c.quadraticCurveTo(10, -39, 5, -40);
      c.closePath();
    }).lfill(robe, -16, -40, 16, 0, 0.3).ink(1.3);
    P.path((c) => { c.moveTo(-12, -36); c.lineTo(-16, -4); c.quadraticCurveTo(0, 0, 16, -4); c.lineTo(12, -36); c.closePath(); }).shadeHatch(0, -40, 18, 0, 0.35);
    // robe folds and trim
    P.curve(-4, -30, -6, -16, -7, -4, 0.7, 'rgba(20,10,5,0.45)');
    P.curve(4, -28, 6, -14, 8, -4, 0.7, 'rgba(20,10,5,0.45)');
    if (o.robe2) P.poly([-3, -40, 3, -40, 2, -4, -2, -4]).fill(o.robe2).ink(0.6);
    // belt
    P.rect(-13, -24, 26, 3.4, 1).fill(o.belt || '#3a2416').ink(0.8);
    P.rect(-1.6, -24.4, 3.2, 4, 0.6).fill('#c9a45a');
    // arms
    const arm = (sx, sy, hx, hy) => {
      P.path((c) => { c.moveTo(sx, sy); c.lineTo(hx, hy); }).ink(6.5, INK);
      P.path((c) => { c.moveTo(sx, sy); c.lineTo(hx, hy); }).ink(4.6, mix(robe, '#000000', 0.08));
      P.circle(hx, hy, 2.4).fill(skin).ink(0.8);
    };
    const pose = o.pose || 'hold';
    if (pose === 'raise') { arm(-11, -35, -15, -16); arm(11, -35, 16, -46); }
    else if (pose === 'both') { arm(-11, -35, -6, -22); arm(11, -35, 6, -22); }
    else if (pose === 'cast') { arm(-11, -35, -18, -40); arm(11, -35, 18, -40); }
    else { arm(-11, -35, -15, -16); arm(11, -35, 15, -22); }
    // item
    if (o.item) item(P, o.item, pose);
    // head
    P.circle(0, -47, 7.6).lfill(skin, -7, -54, 7, -40, 0.22).ink(1.2);
    // hair
    P.path((c) => { c.arc(0, -47, 7.6, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(4, -50, 0, -51); c.quadraticCurveTo(-4, -50, -7.6, -47); c.closePath(); }).fill(hair);
    // face
    P.circle(-2.6, -46.5, 0.85).fill(INK);
    P.circle(2.6, -46.5, 0.85).fill(INK);
    if (o.beard) P.path((c) => { c.moveTo(-5, -44); c.quadraticCurveTo(0, -36, 5, -44); c.quadraticCurveTo(0, -41, -5, -44); }).fill(o.beard).ink(0.7);
    else P.curve(-1.6, -43, 0, -42.2, 1.6, -43, 0.6, 'rgba(60,25,15,0.7)');
    // rim light from the fire (right side)
    P.path((c) => c.arc(0, -47, 7.6, -0.9, 0.9)).ink(1, 'rgba(255,190,120,0.55)');
    P.curve(12, -35, 15, -20, 16, -5, 1, 'rgba(255,180,110,0.35)');
    if (o.hat) hat(P, o.hat, o.hatColor);
  });
}

function hat(P, type, color) {
  switch (type) {
    case 'hood':
      P.path((c) => { c.moveTo(-9, -44); c.quadraticCurveTo(-9, -58, 0, -60); c.quadraticCurveTo(9, -58, 9, -44); c.quadraticCurveTo(6, -52, 0, -53); c.quadraticCurveTo(-6, -52, -9, -44); c.closePath(); })
        .lfill(color || '#5a4a3a', -9, -60, 9, -44).ink(1.1);
      break;
    case 'straw':
      P.ellipse(0, -51, 13, 3.4).fill(color || '#c9a35a').ink(1);
      P.path((c) => { c.moveTo(-6, -51); c.quadraticCurveTo(0, -60, 6, -51); c.closePath(); }).fill(lighten(color || '#c9a35a', 0.1)).ink(1);
      break;
    case 'cap':
      P.path((c) => { c.arc(0, -49, 8, Math.PI, 0); c.closePath(); }).fill(color || '#3e5a6e').ink(1);
      break;
    case 'helmet':
      P.path((c) => { c.arc(0, -48, 8.6, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(8.6, -45); c.lineTo(-8.6, -45); c.closePath(); }).lfill(color || '#8a96a3', -8, -57, 8, -45, 0.4).ink(1.1);
      P.rect(-0.9, -47, 1.8, 6).fill(darken(color || '#8a96a3', 0.2)).ink(0.6);
      break;
    case 'scholar':
      P.rect(-8, -56, 16, 4, 1).fill(color || '#2c3a5a').ink(1);
      P.rect(-5, -53, 10, 3).fill(darken(color || '#2c3a5a', 0.2)).ink(0.8);
      break;
    case 'band':
      P.rect(-7.8, -51, 15.6, 2.4).fill(color || '#a23b2b');
      break;
    case 'crown':
      P.poly([-8, -52, -8, -58, -4, -54, 0, -60, 4, -54, 8, -58, 8, -52]).lfill(color || '#d9a83a', -8, -60, 8, -52, 0.4).ink(1);
      break;
    case 'flame':
      P.glow('rgba(255,160,60,0.9)', 8, () => P.path((c) => { c.moveTo(-4, -54); c.quadraticCurveTo(-5, -60, 0, -66); c.quadraticCurveTo(5, -60, 4, -54); c.closePath(); }).vfill('#fff3b0', '#ff7a1a', -66, -54));
      break;
    case 'cog':
      P.circle(0, -55, 4).fill('#9a8a6a').ink(0.9);
      break;
    default:
      break;
  }
}

/** items held in the right hand (hand near (15,-22)) */
export function item(P, kind, pose) {
  const hx = pose === 'raise' ? 16 : 15, hy = pose === 'raise' ? -46 : -22;
  switch (kind) {
    case 'axe': P.at(hx, hy, 1, -0.35, () => { P.rect(-1, -16, 2.2, 22, 1).fill('#8a5a32').ink(0.8); P.path((c) => { c.moveTo(1, -16); c.quadraticCurveTo(9, -14, 8, -8); c.lineTo(1, -10); c.closePath(); }).lfill('#9aa6ae', 1, -16, 9, -8).ink(0.9); }); break;
    case 'pick': P.at(hx, hy, 1, -0.3, () => { P.rect(-1, -16, 2.2, 22, 1).fill('#8a5a32').ink(0.8); P.path((c) => { c.moveTo(-9, -12); c.quadraticCurveTo(0, -20, 9, -12); c.quadraticCurveTo(0, -16, -9, -12); }).fill('#8f99a3').ink(0.9); }); break;
    case 'spear': P.at(hx, hy, 1, 0.12, () => { P.rect(-1, -36, 2, 46, 1).fill('#8a5a32').ink(0.8); P.poly([0, -44, 3, -35, 0, -33, -3, -35]).lfill('#b9c2c9', -3, -44, 3, -33).ink(0.8); }); break;
    case 'bow': P.at(hx + 2, hy, 1, 0, () => { P.path((c) => { c.moveTo(0, -20); c.quadraticCurveTo(10, 0, 0, 20); }).ink(2.2, '#7a4a22'); P.line(0, -20, 0, 20, 0.6, '#e8dcc0'); }); break;
    case 'sword': P.at(hx, hy, 1, -0.2, () => { P.poly([-1.4, -26, 0, -30, 1.4, -26, 1.2, -4, -1.2, -4]).lfill('#c8d0d6', -2, -30, 2, -4).ink(0.8); P.rect(-5, -4, 10, 2, 0.8).fill('#b98f3a').ink(0.7); P.rect(-1, -2, 2, 6).fill('#5a3a22'); }); break;
    case 'mace': P.at(hx, hy, 1, -0.25, () => { P.rect(-1, -16, 2.2, 22, 1).fill('#6a4a2a').ink(0.8); P.circle(0, -19, 5).lfill('#8a929a', -5, -24, 5, -14).ink(0.9); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.line(Math.cos(a) * 5, -19 + Math.sin(a) * 5, Math.cos(a) * 7, -19 + Math.sin(a) * 7, 1.2); } }); break;
    case 'shield': P.at(-16, -20, 1, 0, () => { P.path((c) => { c.moveTo(-8, -10); c.lineTo(8, -10); c.lineTo(7, 4); c.quadraticCurveTo(0, 12, -7, 4); c.closePath(); }).lfill('#8a5a32', -8, -10, 8, 10).ink(1.1); P.circle(0, -1, 2.4).fill('#c9a45a').ink(0.6); }); break;
    case 'lantern': P.at(hx, hy + 6, 1, 0, () => { P.line(0, -12, 0, -6, 0.9); P.halo(0, 0, 16, 'rgba(255,190,90,1)', 0.6); P.rect(-4, -6, 8, 11, 1.5).fill('rgba(255,210,120,0.95)').ink(1); P.rect(-5, -7, 10, 2, 0.8).fill('#5a3a1a'); P.rect(-5, 4, 10, 2, 0.8).fill('#5a3a1a'); }); break;
    case 'torch': P.at(hx, hy, 1, 0.15, () => { P.rect(-1.2, -14, 2.4, 20, 1).fill('#6a4222').ink(0.8); flame(P, 0, -14, 0.8); }); break;
    case 'book': P.at(hx - 2, hy + 2, 1, 0.1, () => { P.rect(-6, -5, 12, 9, 1).lfill('#7a2e2a', -6, -5, 6, 4).ink(0.9); P.line(-4, -3, 4, -3, 0.5, '#e8d8a8'); }); break;
    case 'herbs': P.at(hx, hy + 3, 1, 0, () => { P.ellipse(0, 0, 5, 6).lfill('#7a6a3a', -5, -6, 5, 6).ink(0.9); P.path((c) => { c.moveTo(-2, -5); c.quadraticCurveTo(-6, -12, -1, -11); c.moveTo(1, -5); c.quadraticCurveTo(5, -13, 3, -9); }).ink(1.4, '#4f8a3a'); }); break;
    case 'map': P.at(hx - 2, hy + 1, 1, -0.1, () => { P.rect(-7, -6, 14, 10, 1).fill('#e2d2a6').ink(0.9); P.curve(-5, -3, 0, 2, 5, -2, 0.6, '#a33'); P.line(-7, -6, -7, 4, 1.2, '#8a6a3a'); }); break;
    case 'scale': P.at(hx, hy, 1, 0, () => { P.line(0, -14, 0, 4, 1.2); P.line(-8, -12, 8, -12, 1.2); P.path((c) => c.arc(-8, -8, 4, 0, Math.PI)).fill('#c9a45a').ink(0.8); P.path((c) => c.arc(8, -8, 4, 0, Math.PI)).fill('#c9a45a').ink(0.8); }); break;
    case 'compass': P.at(hx, hy, 1, 0, () => { P.circle(0, 0, 5).fill('#c9a45a').ink(0.9); P.circle(0, 0, 3.6).fill('#f0e6c8'); P.poly([0, -3, 1, 0, 0, 3, -1, 0]).fill('#a33'); }); break;
    case 'musket': P.at(hx, hy, 1, -0.6, () => { P.rect(-1.4, -30, 2.8, 30, 1).fill('#4a4f55').ink(0.8); P.rect(-2.2, -4, 4.4, 12, 1.5).fill('#6a4222').ink(0.8); }); break;
    case 'staff': P.at(hx, hy, 1, 0.05, () => { P.rect(-1.2, -34, 2.4, 44, 1).fill('#6a4a2a').ink(0.8); P.halo(0, -36, 10, 'rgba(255,230,160,1)', 0.7); P.circle(0, -36, 3).fill('#fff2c0'); }); break;
    case 'flame': P.at(hx + 2, hy - 8, 1.1, 0, () => { P.halo(0, 0, 16, 'rgba(255,170,70,1)', 0.7); flame(P, 0, 4, 1.2); }); break;
    case 'hoe': P.at(hx, hy, 1, -0.2, () => { P.rect(-1, -18, 2.2, 26, 1).fill('#8a5a32').ink(0.8); P.poly([1, -18, 8, -16, 8, -12, 1, -14]).fill('#8f99a3').ink(0.8); }); break;
    case 'wrench': P.at(hx, hy, 1, -0.4, () => { P.rect(-1.2, -14, 2.4, 18, 1).fill('#8a929a').ink(0.8); P.circle(0, -16, 4).fill('#8a929a').ink(0.8); P.circle(0, -17, 1.6).fill('#3a2a1a'); }); break;
    case 'rod': P.at(hx, hy, 1, 0.5, () => { P.line(0, 6, 0, -30, 1.4, '#8a5a32'); P.curve(0, -30, 10, -20, 8, 4, 0.5, '#e8e0d0'); }); break;
    default: break;
  }
}

export function flame(P, x, y, s = 1, hot = false) {
  P.at(x, y, s, 0, () => {
    P.halo(0, -6, 14, 'rgba(255,150,50,1)', 0.45);
    P.path((c) => { c.moveTo(-6, 0); c.quadraticCurveTo(-8, -9, -2, -15); c.quadraticCurveTo(-1, -9, 1, -8); c.quadraticCurveTo(1, -16, 4, -19); c.quadraticCurveTo(9, -9, 6, 0); c.closePath(); })
      .vfill(hot ? '#fff6d0' : '#ffd36a', '#e8541c', -19, 0).ink(0.8, 'rgba(120,40,10,0.8)');
    P.path((c) => { c.moveTo(-3, 0); c.quadraticCurveTo(-3, -6, 0, -10); c.quadraticCurveTo(3, -6, 3, 0); c.closePath(); }).fill('rgba(255,250,215,0.85)');
  });
}

// ---------------------------------------------------------------- beasts --------------------------
/** quadruped side view facing left, feet at y.
 * o: { body, len, h, head, neck, headUp, legs, tail, horns, ears, snout, mane, tusks, fangs, eye, eyeGlow, slim } */
export function quadruped(P, x, y, s, o) {
  const body = o.body || '#8a6a4a';
  const dark = darken(body, 0.32);
  P.at(x, y, s, 0, () => {
    const L = o.len || 30, H = o.h || 14, legH = o.legs || 12, r = o.head || 6;
    P.shadow(0, 0, L * 0.75, 4, 0.4);
    const by = -legH - H / 2;
    const top = by - H / 2, bot = by + H / 2;
    const fx = -L / 2, bx = L / 2;
    const canine = !!o.fangs;
    const legW = Math.max(3.4, Math.min(8, H * 0.3)) * (o.slim || legH > H * 1.1 ? 0.78 : 1);
    const leg = (lx, hind, col, w) => {
      const t = legW / 2, kneeY = bot + (0 - bot) * 0.5, sh = hind ? 2 : -0.5;
      P.path((c) => {
        c.moveTo(lx - t * 1.4, bot - H * 0.4);
        c.quadraticCurveTo(lx - t * 1.5, kneeY - 3, lx - t * 0.75 + sh, kneeY);
        c.lineTo(lx - t * 0.6, -2.2);
        c.lineTo(lx - t * 1.1, 0);
        c.lineTo(lx + t * 0.85, 0);
        c.lineTo(lx + t * 0.6, -2.2);
        c.lineTo(lx + t * 0.75 + sh, kneeY);
        c.quadraticCurveTo(lx + t * (hind ? 1.9 : 1.5), kneeY - 4, lx + t * 1.5, bot - H * 0.4);
        c.closePath();
      }).lfill(col, lx - t * 1.5, bot - H * 0.4, lx + t * 1.5, 0, 0.25).ink(w);
      P.rect(lx - t * 1.1, -2.2, t * 1.95, 2.2, 0.7).fill(darken(col, 0.6));
    };
    // far legs
    leg(bx - L * 0.12, true, dark, 0.9);
    leg(fx + L * 0.24, false, dark, 0.9);
    // tail
    if (o.tail !== undefined) {
      const tx = bx - L * 0.04, ty = top + H * 0.22, tw = canine ? 3.2 : 1.6;
      P.path((c) => {
        c.moveTo(tx, ty - tw * 0.6);
        c.quadraticCurveTo(tx + 10, ty - 4 + o.tail, tx + 9, ty + 12 + o.tail * 0.4);
        c.quadraticCurveTo(tx + 6, ty + 4 + o.tail * 0.5, tx, ty + tw);
        c.closePath();
      }).lfill(canine ? lighten(body, 0.05) : darken(body, 0.15), tx, ty, tx + 10, ty + 12).ink(0.9);
    }
    // body silhouette: chest, withers, back, rump, belly
    const hump = o.mane ? H * 0.22 : H * 0.08;
    const bodyPath = (c) => {
      c.moveTo(fx - 1, by + H * 0.12);
      c.bezierCurveTo(fx - 2.5, top + H * 0.1, fx + L * 0.08, top - hump, fx + L * 0.3, top - hump * 0.6);
      c.bezierCurveTo(fx + L * 0.55, top + H * 0.1, bx - L * 0.22, top - H * 0.06, bx - L * 0.08, top + H * 0.04);
      c.bezierCurveTo(bx + 1.5, top + H * 0.2, bx + 2, by + H * 0.32, bx - L * 0.05, bot - H * 0.02);
      c.bezierCurveTo(bx - L * 0.3, bot + H * (canine ? 0.02 : 0.14), fx + L * 0.38, bot + H * (canine ? -0.02 : 0.16), fx + L * 0.12, bot - H * 0.04);
      c.quadraticCurveTo(fx - 0.5, bot - H * 0.12, fx - 1, by + H * 0.12);
      c.closePath();
    };
    P.path(bodyPath).lfill(body, fx, top, bx, bot, 0.32).ink(1.2);
    P.path(bodyPath).shadeHatch(fx, top, bx, bot + 2, 0.28);
    // shoulder and haunch muscle lines
    P.curve(fx + L * 0.16, top + H * 0.3, fx + L * 0.28, by + H * 0.1, fx + L * 0.2, bot - 1, 0.7, 'rgba(20,10,5,0.4)');
    P.curve(bx - L * 0.26, top + H * 0.25, bx - L * 0.06, by, bx - L * 0.2, bot - 1, 0.7, 'rgba(20,10,5,0.4)');
    // fur tufts along the back
    for (let i = 0; i < 6; i++) {
      const tx = fx + L * (0.25 + i * 0.1), ty = top + 1.2 + Math.sin(i * 1.7) * 0.6;
      P.line(tx, ty, tx + 1.8, ty + 2.4, 0.6, 'rgba(255,240,210,0.35)');
    }
    // near legs
    leg(bx - L * 0.2, true, body, 1);
    leg(fx + L * 0.13, false, body, 1);
    // neck
    const hx = fx - (o.neck ?? 6), hy = top - (o.headUp ?? 4);
    P.path((c) => {
      c.moveTo(fx + L * 0.3, top - hump * 0.5 + 1);
      c.quadraticCurveTo(fx + L * 0.05, top - hump - 2, hx + r * 0.55, hy - r * 0.55);
      c.lineTo(hx + r * 0.35, hy + r * 0.7);
      c.quadraticCurveTo(fx - 2, by - H * 0.05, fx + 1, by + H * 0.3);
      c.closePath();
    }).lfill(body, hx, hy, fx + L * 0.3, by, 0.3).ink(1.1);
    if (o.mane) {
      P.path((c) => {
        c.moveTo(fx + L * 0.34, top - hump * 0.4);
        c.quadraticCurveTo(fx + L * 0.06, top - hump - 5, hx + r * 0.6, hy - r * 0.8);
        c.lineTo(hx + r * 0.9, hy - r * 0.1);
        c.quadraticCurveTo(fx + L * 0.06, top - hump + 1, fx + L * 0.3, top + 2);
        c.closePath();
      }).fill(darken(body, 0.3)).ink(0.8);
      for (let i = 0; i < 5; i++) {
        const t = i / 4, mx = fx + L * 0.3 + (hx + r * 0.6 - fx - L * 0.3) * t, my = top - hump * 0.4 + (hy - r * 0.8 - top + hump * 0.4) * t - 2;
        P.line(mx, my, mx + 1.5, my - 2.6, 1, darken(body, 0.45));
      }
    }
    // head: skull and muzzle
    const mlen = o.snout === false ? 0 : r * (canine ? 1.55 : o.tusks ? 1.35 : 1.25);
    P.ellipse(hx, hy, r, r * 0.8).lfill(body, hx - r, hy - r, hx + r, hy + r, 0.3).ink(1.1);
    if (mlen) {
      P.path((c) => {
        c.moveTo(hx - r * 0.2, hy - r * 0.62);
        c.quadraticCurveTo(hx - r * 0.9, hy - r * 0.55, hx - mlen, hy - r * 0.05);
        c.quadraticCurveTo(hx - mlen - r * 0.18, hy + r * 0.3, hx - mlen + r * 0.1, hy + r * 0.45);
        c.quadraticCurveTo(hx - r * 0.6, hy + r * (canine ? 0.55 : 0.75), hx + r * 0.2, hy + r * 0.6);
        c.closePath();
      }).lfill(lighten(body, 0.08), hx - mlen, hy - r, hx, hy + r, 0.25).ink(1);
      P.ellipse(hx - mlen + r * 0.05, hy + r * 0.02, r * 0.2, r * 0.16).fill('#1a120c');
      if (canine) P.curve(hx - mlen + r * 0.2, hy + r * 0.32, hx - r * 0.5, hy + r * 0.42, hx - r * 0.1, hy + r * 0.3, 0.7, INK);
    }
    // eye
    P.ellipse(hx - r * 0.28, hy - r * 0.2, r * 0.17, r * 0.13).fill(o.eye || INK);
    if (o.eyeGlow) P.halo(hx - r * 0.28, hy - r * 0.2, 4.5, o.eyeGlow, 0.95);
    else P.circle(hx - r * 0.24, hy - r * 0.25, r * 0.05).fill('rgba(255,250,235,0.9)');
    // ears
    if (o.ears) {
      if (canine) P.poly([hx + r * 0.05, hy - r * 0.6, hx + r * 0.25, hy - r * 1.75, hx + r * 0.8, hy - r * 0.45]).lfill(darken(body, 0.1), hx, hy - r * 1.7, hx + r, hy, 0.2).ink(0.9);
      else P.path((c) => { c.moveTo(hx + r * 0.3, hy - r * 0.55); c.quadraticCurveTo(hx + r * 1.3, hy - r * 1.4, hx + r * 1.15, hy - r * 0.3); c.closePath(); }).fill(darken(body, 0.15)).ink(0.9);
    }
    if (o.horns === 'antler') {
      const ant = (c) => { c.moveTo(hx + r * 0.2, hy - r * 0.7); c.lineTo(hx + r * 0.5, hy - r * 2.2); c.lineTo(hx + r * 0.1, hy - r * 3.1); c.moveTo(hx + r * 0.5, hy - r * 2.2); c.lineTo(hx + r * 1.4, hy - r * 2.9); c.moveTo(hx + r * 0.4, hy - r * 1.6); c.lineTo(hx - r * 0.4, hy - r * 2.2); };
      P.path(ant).ink(2.2, INK);
      P.path(ant).ink(1.2, '#e2d2b0');
    }
    if (o.horns === 'curl') {
      P.path((c) => { c.moveTo(hx + r * 0.2, hy - r * 0.6); c.quadraticCurveTo(hx + r * 1.7, hy - r * 1.6, hx + r * 1.1, hy + r * 0.3); }).ink(3.4, INK);
      P.path((c) => { c.moveTo(hx + r * 0.2, hy - r * 0.6); c.quadraticCurveTo(hx + r * 1.7, hy - r * 1.6, hx + r * 1.1, hy + r * 0.3); }).ink(2.2, '#d9c8a0');
    }
    if (o.tusks) {
      const tx0 = hx - Math.max(mlen, r * 0.6) * 0.75;
      const tusk = (c) => { c.moveTo(tx0, hy + r * 0.4); c.quadraticCurveTo(tx0 - r * 1.1, hy + r * 1.4, tx0 - r * 1.5, hy - r * 0.2); };
      P.path(tusk).ink(o.tusks + 1, INK);
      P.path(tusk).ink(o.tusks, '#efe6d0');
    }
    if (o.fangs) P.poly([hx - mlen + r * 0.35, hy + r * 0.38, hx - mlen + r * 0.45, hy + r * 0.75, hx - mlen + r * 0.6, hy + r * 0.4]).fill('#fff').ink(0.4);
  });
}

export function bird(P, x, y, s, o = {}) {
  const body = o.body || '#8a6a4a';
  P.at(x, y, s, 0, () => {
    if (!o.fly) P.shadow(0, 0, 12, 3);
    if (o.fly) {
      P.path((c) => { c.moveTo(0, -14); c.quadraticCurveTo(-16, -30, -28, -22); c.quadraticCurveTo(-16, -20, -4, -10); c.closePath(); }).lfill(darken(body, 0.1), -28, -30, 0, -10).ink(1);
      P.path((c) => { c.moveTo(0, -14); c.quadraticCurveTo(16, -30, 28, -22); c.quadraticCurveTo(16, -20, 4, -10); c.closePath(); }).lfill(darken(body, 0.1), 0, -30, 28, -10).ink(1);
    }
    P.ellipse(0, -10, 9, 7).lfill(body, -9, -17, 9, -3).ink(1.1);
    P.circle(-7, -17, 4.4).lfill(lighten(body, 0.05), -11, -21, -3, -13).ink(1);
    P.poly([-11, -17, -15, -15.5, -11, -15]).fill(o.beak || '#d9a03a').ink(0.7);
    P.circle(-8, -18, 0.8).fill(o.eye || INK);
    if (o.eyeGlow) P.halo(-8, -18, 4, o.eyeGlow, 0.9);
    if (!o.fly) {
      P.path((c) => { c.moveTo(3, -12); c.quadraticCurveTo(12, -12, 14, -6); c.quadraticCurveTo(8, -8, 3, -6); c.closePath(); }).fill(darken(body, 0.2)).ink(0.8);
      P.line(-2, -3, -3, 0, 1, '#b07a2a');
      P.line(2, -3, 3, 0, 1, '#b07a2a');
    }
    if (o.crest) P.path((c) => { c.moveTo(-7, -21); c.lineTo(-5, -26); c.lineTo(-4, -21); }).fill(o.crest).ink(0.6);
  });
}

export function fish(P, x, y, s, o = {}) {
  const c1 = o.color || '#7aa6b8';
  P.at(x, y, s, o.rot || 0, () => {
    P.path((c) => { c.moveTo(-16, 0); c.quadraticCurveTo(-4, -9, 10, -2); c.lineTo(17, -7); c.lineTo(15, 0); c.lineTo(17, 7); c.lineTo(10, 2); c.quadraticCurveTo(-4, 9, -16, 0); c.closePath(); })
      .lfill(o.cooked ? '#c07a3a' : c1, -16, -9, 16, 9, 0.35).ink(1.1);
    P.circle(-10, -1.4, 1.3).fill(o.cooked ? '#3a1a0a' : '#f4f0e0').ink(0.5);
    P.curve(-6, -5, -3, 0, -6, 5, 0.6, 'rgba(30,15,5,0.5)');
    if (!o.cooked) for (let i = 0; i < 3; i++) P.curve(-1 + i * 3.4, -3, 1 + i * 3.4, 0, -1 + i * 3.4, 3, 0.4, 'rgba(255,255,255,0.4)');
    if (o.cooked) { P.line(-2, -4, 2, 4, 1.4, 'rgba(60,20,5,0.6)'); P.line(4, -3, 7, 3, 1.4, 'rgba(60,20,5,0.6)'); }
  });
}

// ---------------------------------------------------------------- monsters ------------------------
export function shade(P, x, y, s, o = {}) {
  const c = o.color || '#3b2b52';
  P.at(x, y, s, 0, () => {
    P.halo(0, -26, 34, o.aura || 'rgba(120,80,170,1)', 0.35);
    P.path((cx) => {
      cx.moveTo(-14, 0);
      cx.quadraticCurveTo(-18, -20, -10, -36);
      cx.quadraticCurveTo(-8, -50, 0, -52);
      cx.quadraticCurveTo(8, -50, 10, -36);
      cx.quadraticCurveTo(18, -20, 14, 0);
      for (let i = 0; i < 5; i++) cx.quadraticCurveTo(10 - i * 6, -6 + (i % 2) * 7, 8 - (i + 1) * 5.6, 0);
      cx.closePath();
    }).vfill(lighten(c, 0.15), 'rgba(20,10,30,0.15)', -52, 0);
    P.path((cx) => { cx.moveTo(-14, -2); cx.quadraticCurveTo(-18, -20, -10, -36); cx.quadraticCurveTo(-8, -50, 0, -52); cx.quadraticCurveTo(8, -50, 10, -36); cx.quadraticCurveTo(18, -20, 14, -2); }).ink(1.2, 'rgba(15,8,25,0.9)');
    if (o.horns) { P.path((cx) => { cx.moveTo(-6, -48); cx.quadraticCurveTo(-14, -56, -12, -64); cx.moveTo(6, -48); cx.quadraticCurveTo(14, -56, 12, -64); }).ink(2.4, '#1a0f22'); }
    for (const ex of [-3.6, 3.6]) {
      P.halo(ex, -40, 5, o.eye || 'rgba(255,120,200,1)', 0.95);
      P.ellipse(ex, -40, 1.6, 1.1).fill('#fff2fa');
    }
    // wisps
    for (let i = 0; i < 4; i++) P.curve(-12 + i * 8, -2, -16 + i * 8, 8, -8 + i * 8, 12, 0.8, 'rgba(160,120,210,0.35)');
  });
}

export function wisp(P, x, y, s, color = 'rgba(140,220,255,1)', core = '#e8fbff') {
  P.at(x, y, s, 0, () => {
    P.halo(0, 0, 22, color, 0.6);
    P.path((c) => { c.moveTo(-6, 2); c.quadraticCurveTo(-2, 16, 8, 24); c.quadraticCurveTo(2, 14, 6, 2); c.closePath(); }).fill(color.replace(/[\d.]+\)$/, '0.45)'));
    P.circle(0, 0, 7).rfill(core, color.replace(/[\d.]+\)$/, '0.7)'), 0, 0, 7);
    P.circle(-2.4, -1, 1).fill(INK);
    P.circle(2.4, -1, 1).fill(INK);
  });
}

export function golem(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 24, 5, 0.5);
    P.halo(0, -28, 34, 'rgba(255,110,30,1)', 0.35);
    const rock = (pts) => { P.poly(pts).lfill('#4a3a34', pts[0], pts[1], pts[4], pts[5], 0.25).ink(1.3); };
    rock([-14, -4, -18, -26, -8, -32, 2, -28, 0, -4]);
    rock([0, -4, 2, -28, 12, -32, 18, -24, 14, -4]);
    rock([-10, -32, -12, -48, 0, -54, 12, -48, 12, -32]);
    rock([-22, -40, -30, -30, -26, -14, -18, -18, -16, -34]);
    rock([22, -40, 30, -30, 26, -14, 18, -18, 16, -34]);
    rock([-6, -54, -8, -62, 4, -64, 8, -56]);
    // lava cracks
    P.path((c) => { c.moveTo(-6, -46); c.lineTo(-2, -40); c.lineTo(-4, -34); c.moveTo(6, -44); c.lineTo(3, -38); c.moveTo(-8, -24); c.lineTo(-4, -14); c.lineTo(-8, -8); c.moveTo(8, -26); c.lineTo(6, -16); }).ink(1.6, '#ff9a3a');
    P.halo(-3, -57, 5, 'rgba(255,200,80,1)', 1);
    P.halo(3, -57, 5, 'rgba(255,200,80,1)', 1);
  });
}

export function treebeast(P, x, y, s) {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 28, 5, 0.5);
    // roots
    for (const [a, b] of [[-24, 0], [-12, 2], [10, 2], [24, 0]]) P.curve(0, -14, a * 0.6, -6, a, b, 3.4, '#3e2c1c');
    // trunk body
    P.path((c) => { c.moveTo(-14, -6); c.quadraticCurveTo(-20, -30, -10, -48); c.lineTo(10, -48); c.quadraticCurveTo(20, -30, 14, -6); c.closePath(); }).lfill('#5a4430', -18, -48, 18, -6, 0.25).ink(1.4);
    P.path((c) => { c.moveTo(-14, -6); c.quadraticCurveTo(-20, -30, -10, -48); c.lineTo(10, -48); c.quadraticCurveTo(20, -30, 14, -6); c.closePath(); }).hatch(2.2, 1.4, 0.3);
    // branches / arms
    P.curve(-12, -36, -28, -40, -32, -56, 3, '#4a3624');
    P.curve(12, -38, 26, -44, 30, -60, 3, '#4a3624');
    // rotting leaves crown
    for (const [cx, cy, r] of [[-16, -54, 9], [0, -60, 11], [16, -56, 9]]) P.circle(cx, cy, r).lfill('#4a5a2a', cx - r, cy - r, cx + r, cy + r).ink(1);
    // eyes & maw
    P.halo(-5, -34, 5, 'rgba(180,255,90,1)', 1);
    P.halo(5, -34, 5, 'rgba(180,255,90,1)', 1);
    P.path((c) => { c.moveTo(-6, -24); c.quadraticCurveTo(0, -18, 6, -24); c.quadraticCurveTo(0, -21, -6, -24); }).fill('#1a120a');
  });
}

export function tentacle(P, x, y, s, color = '#5a3a5e') {
  P.at(x, y, s, 0, () => {
    P.path((c) => { c.moveTo(-8, 0); c.quadraticCurveTo(-16, -30, 4, -44); c.quadraticCurveTo(18, -52, 12, -62); c.quadraticCurveTo(26, -50, 10, -36); c.quadraticCurveTo(-2, -26, 8, 0); c.closePath(); })
      .lfill(color, -16, -62, 26, 0, 0.3).ink(1.3);
    for (let i = 0; i < 5; i++) P.circle(-2 + i * 1.5, -6 - i * 8, 1.8).fill('#e8c6d8').ink(0.5);
  });
}

export function beetle(P, x, y, s, color = '#3e4a3a') {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 22, 4);
    for (let i = 0; i < 3; i++) { P.curve(-6 + i * 6, -8, -14 + i * 6, -2, -16 + i * 7, 0, 1.4); P.curve(-6 + i * 6, -8, 2 + i * 6, -2, 6 + i * 6, 0, 1.4); }
    P.ellipse(4, -12, 15, 9).lfill(color, -11, -21, 19, -3, 0.35).ink(1.2);
    P.line(4, -21, 4, -3, 0.8);
    P.ellipse(-12, -11, 6, 5).fill(darken(color, 0.2)).ink(1);
    P.curve(-16, -14, -24, -22, -20, -26, 1.2);
    P.curve(-16, -10, -26, -12, -26, -18, 1.2);
    P.halo(-14, -12, 3, 'rgba(255,240,140,1)', 0.8);
  });
}

export function serpent(P, x, y, s, color = '#3a6a5a') {
  P.at(x, y, s, 0, () => {
    P.shadow(0, 0, 26, 4);
    P.path((c) => { c.moveTo(24, -4); c.quadraticCurveTo(10, -14, 0, -4); c.quadraticCurveTo(-10, 6, -18, -10); c.quadraticCurveTo(-22, -22, -14, -30); }).ink(9, INK).path((c) => { c.moveTo(24, -4); c.quadraticCurveTo(10, -14, 0, -4); c.quadraticCurveTo(-10, 6, -18, -10); c.quadraticCurveTo(-22, -22, -14, -30); }).ink(7, color);
    P.ellipse(-12, -32, 7, 5, -0.3).lfill(color, -19, -37, -5, -27).ink(1.1);
    P.circle(-14, -34, 1).fill('#ffe080');
    P.path((c) => { c.moveTo(-19, -31); c.lineTo(-24, -30); c.moveTo(-24, -30); c.lineTo(-26, -32); c.moveTo(-24, -30); c.lineTo(-26, -28); }).ink(0.8, '#c33');
  });
}
