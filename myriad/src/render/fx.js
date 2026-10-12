// Visual effects: a small particle system plus scripted effects (meteor falls, lightning,
// mushroom clouds, light from the heavens) triggered by events the simulation queues in w.fx, and
// ambient effects read directly from the world each frame (wildfires, erupting volcanoes, factory
// smoke, comets in the sky).

import { hash2 } from '../core/rng.js';
import { clamp } from '../core/util.js';

const MAX_P = 1800;

export class FxLayer {
  constructor(world) {
    this.w = world;
    this.parts = [];
    this.effects = [];
    this.shake = 0;
    this.flash = 0;
  }

  emit(p) {
    if (this.parts.length < MAX_P) this.parts.push(p);
  }

  /** consume events queued by the simulation */
  pull(R) {
    const w = this.w;
    const q = w.fx;
    if (!q.length) return;
    w.fx = [];
    for (const e of q) this.spawn(e, R);
  }

  spawn(e, R) {
    const rnd = Math.random;
    switch (e.type) {
      case 'shockwave': case 'tsunami':
        this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: e.r || 5, t: 0, dur: e.type === 'tsunami' ? 2.4 : 1.3, color: e.type === 'tsunami' ? [120, 200, 255] : e.color || [255, 230, 190] });
        if (e.type === 'shockwave') this.shake = Math.max(this.shake, Math.min(14, (e.r || 5) * 0.8));
        break;
      case 'quake':
        this.shake = Math.max(this.shake, (e.power - 4) * 3);
        for (let k = 0; k < 3; k++) this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: e.r * (0.5 + k * 0.4), t: -k * 0.25, dur: 1.4, color: [210, 170, 120] });
        break;
      case 'eruption':
        for (let k = 0; k < 6; k++) this.emit({ x: e.x, y: e.y, vx: (rnd() - 0.5) * 3, vy: -2 - rnd() * 3, g: 6, life: 0.9 + rnd() * 0.6, t: 0, size: 0.25 + rnd() * 0.2, color: [255, 120 + rnd() * 80, 30], glow: true });
        for (let k = 0; k < 2; k++) this.emit({ x: e.x + (rnd() - 0.5), y: e.y, vx: (rnd() - 0.5) * 0.4, vy: -0.8 - rnd() * 0.5, life: 3 + rnd() * 2, t: 0, size: 0.6 + rnd() * 0.6, grow: 0.6, color: [70, 64, 62], alpha: 0.5, smoke: true });
        break;
      case 'meteorFall':
        this.effects.push({ kind: 'meteor', x: e.x, y: e.y, r: e.r || 2, t: 0, dur: 0.8 });
        break;
      case 'lightning':
        this.effects.push({ kind: 'bolt', x: e.x, y: e.y, t: 0, dur: 0.35, seed: rnd() * 1000 });
        this.flash = Math.max(this.flash, 0.25);
        break;
      case 'nuke':
        this.effects.push({ kind: 'nuke', x: e.x, y: e.y, t: 0, dur: 5 });
        this.flash = 1;
        this.shake = Math.max(this.shake, 16);
        break;
      case 'revelation': case 'wonder':
        this.effects.push({ kind: 'beam', x: e.x, y: e.y, t: 0, dur: e.type === 'wonder' ? 3 : 2.4, color: e.color || [255, 230, 150] });
        break;
      case 'bless': case 'gold': case 'sparkle': case 'found': {
        const col = e.type === 'gold' ? [255, 210, 80] : e.type === 'bless' ? [255, 236, 150] : e.color || [200, 255, 220];
        const n = e.type === 'found' ? 10 : 18;
        const r = e.r || 1.5;
        for (let k = 0; k < n; k++) this.emit({ x: e.x + (rnd() - 0.5) * r * 2, y: e.y + (rnd() - 0.5) * r * 2, vx: (rnd() - 0.5) * 0.3, vy: e.type === 'gold' ? 1.2 + rnd() : -0.6 - rnd() * 0.8, life: 1.2 + rnd(), t: 0, size: 0.12 + rnd() * 0.12, color: col, glow: true, twinkle: true });
        if (e.type === 'found') this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 2.5, t: 0, dur: 1, color: e.color || [255, 255, 255] });
        break;
      }
      case 'rain':
        for (let k = 0; k < 20; k++) this.emit({ x: e.x + (rnd() - 0.5) * e.r * 2, y: e.y + (rnd() - 0.5) * e.r * 2 - 2, vx: -0.4, vy: 6, life: 0.35, t: 0, size: 0.05, len: 0.6, color: [170, 200, 255], alpha: 0.7, streak: true });
        break;
      case 'whisper':
        for (let k = 0; k < 10; k++) this.emit({ x: e.x + (rnd() - 0.5) * 2, y: e.y + (rnd() - 0.5), vx: (rnd() - 0.5) * 0.3, vy: -0.4, life: 2.2, t: 0, size: 0.35, color: [190, 150, 255], glyph: '~∴◦⁂'[k % 4], alpha: 0.9 });
        break;
      case 'plague':
        for (let k = 0; k < 24; k++) this.emit({ x: e.x + (rnd() - 0.5) * 3, y: e.y + (rnd() - 0.5) * 3, vx: (rnd() - 0.5) * 0.3, vy: (rnd() - 0.5) * 0.3, life: 2.5, t: 0, size: 0.15, color: [140, 220, 90], alpha: 0.8, glow: true });
        break;
      case 'swarm':
        for (let k = 0; k < 60; k++) this.emit({ x: e.x + (rnd() - 0.5) * (e.r || 4) * 2, y: e.y + (rnd() - 0.5) * (e.r || 4) * 2, vx: (rnd() - 0.5) * 2, vy: (rnd() - 0.5) * 2, life: 2.5, t: 0, size: 0.06, color: [50, 40, 20], alpha: 0.9, jitter: true });
        break;
      case 'battle':
        for (let k = 0; k < 4; k++) this.emit({ x: e.x + (rnd() - 0.5) * 0.8, y: e.y + (rnd() - 0.5) * 0.8, vx: (rnd() - 0.5) * 2, vy: (rnd() - 0.5) * 2, life: 0.4, t: 0, size: 0.08, color: [255, 230, 160], glow: true });
        this.emit({ x: e.x, y: e.y, vx: 0, vy: -0.3, life: 1.5, t: 0, size: 0.4, grow: 0.5, color: [150, 140, 130], alpha: 0.35, smoke: true });
        break;
      case 'conquest':
        this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 3, t: 0, dur: 1.2, color: e.color });
        break;
      case 'cityfire':
        for (let k = 0; k < 20; k++) this.emit({ x: e.x + (rnd() - 0.5) * 1.5, y: e.y + (rnd() - 0.5), vx: 0, vy: -0.8, life: 1 + rnd() * 2, t: 0, size: 0.2, color: [255, 140, 40], glow: true });
        break;
      case 'launch':
        this.effects.push({ kind: 'launch', x: e.x, y: e.y, t: 0, dur: 4 });
        break;
      case 'skycomet':
        this.effects.push({ kind: 'skystreak', t: 0, dur: 3, n: 1, big: true });
        break;
      case 'starfall':
        this.effects.push({ kind: 'skystreak', t: 0, dur: 4, n: 24 });
        break;
      default:
    }
  }

  draw(ctx, R, dt, view) {
    this.pull(R);
    const w = this.w;
    const cam = R.cam;
    const z = cam.zoom;
    const time = R.time;
    this.ambient(dt, view, time, z);

    // particles
    const parts = this.parts;
    let n = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      parts[n++] = p;
      if (p.g) p.vy += p.g * dt;
      if (p.jitter) { p.vx += (Math.random() - 0.5) * 6 * dt; p.vy += (Math.random() - 0.5) * 6 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 - 4 || p.y > view.y1) continue;
      const [sx, sy] = cam.toScreen(p.x, p.y);
      const u = p.t / p.life;
      let a = (p.alpha ?? 1) * (1 - u) * (p.twinkle ? 0.6 + 0.4 * Math.sin(p.t * 20 + i) : 1);
      const size = Math.max(1, (p.size + (p.grow || 0) * p.t) * z);
      ctx.globalAlpha = clamp(a, 0, 1);
      if (p.glyph) {
        ctx.fillStyle = `rgb(${p.color[0]},${p.color[1]},${p.color[2]})`;
        ctx.font = `${Math.max(10, size * 2)}px serif`;
        ctx.fillText(p.glyph, sx, sy);
      } else if (p.streak) {
        ctx.strokeStyle = `rgb(${p.color[0]},${p.color[1]},${p.color[2]})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - p.vx * 0.06 * z, sy - p.vy * 0.06 * z);
        ctx.stroke();
      } else {
        if (p.glow) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgb(${p.color[0]},${p.color[1]},${p.color[2]})`;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.fillStyle = `rgb(${p.color[0]},${p.color[1]},${p.color[2]})`;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    parts.length = n;
    ctx.globalAlpha = 1;

    // scripted effects
    const effs = this.effects;
    let m = 0;
    for (const e of effs) {
      e.t += dt;
      if (e.t >= e.dur) continue;
      effs[m++] = e;
      if (e.t < 0) continue;
      this.drawEffect(ctx, R, e, cam, z, time);
    }
    effs.length = m;

    // comets approaching the world are visible in the sky
    for (const c of w.comets || []) {
      const u = 1 - c.eta / c.total;
      const [tx, ty] = cam.toScreen(c.x, c.y);
      const hx = tx + (1 - u) * cam.vw * 0.6 + 60, hy = ty - (1 - u) * cam.vh * 0.7 - 60;
      const size = 3 + u * 10;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, size * 3);
      g.addColorStop(0, 'rgba(255,255,240,0.95)');
      g.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, size * 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(190,220,255,0.35)';
      ctx.lineWidth = size;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + size * 12, hy - size * 9); ctx.stroke();
    }

    // flash and shake
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,252,240,${Math.min(1, this.flash)})`;
      ctx.fillRect(0, 0, cam.vw, cam.vh);
      this.flash = Math.max(0, this.flash - dt * 1.6);
    }
    if (this.shake > 0) {
      R.shakeX = (Math.random() - 0.5) * this.shake;
      R.shakeY = (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 18);
    } else { R.shakeX = 0; R.shakeY = 0; }
  }

  drawEffect(ctx, R, e, cam, z, time) {
    const u = e.t / e.dur;
    const [sx, sy] = e.x !== undefined ? cam.toScreen(e.x, e.y) : [0, 0];
    ctx.save();
    switch (e.kind) {
      case 'ring': {
        const r = e.r * z * (0.2 + u * 0.8);
        ctx.strokeStyle = `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${(1 - u) * 0.9})`;
        ctx.lineWidth = Math.max(1.5, z * 0.4 * (1 - u));
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'meteor': {
        // a burning rock streaks in from the upper right, then explodes
        const fall = 0.55;
        if (u < fall) {
          const k = u / fall;
          const hx = sx + (1 - k) * 420, hy = sy - (1 - k) * 520;
          const g = ctx.createLinearGradient(hx, hy, hx + 140, hy - 170);
          g.addColorStop(0, 'rgba(255,240,200,0.95)');
          g.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 3 + e.r * 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 140, hy - 170); ctx.stroke();
          ctx.fillStyle = '#fff6dc';
          ctx.beginPath(); ctx.arc(hx, hy, 2 + e.r, 0, Math.PI * 2); ctx.fill();
        } else {
          const k = (u - fall) / (1 - fall);
          if (!e.boomed) { e.boomed = true; this.flash = Math.max(this.flash, Math.min(0.8, e.r * 0.12)); this.shake = Math.max(this.shake, e.r * 3); for (let i = 0; i < 30; i++) this.emit({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 0.8 + Math.random(), t: 0, size: 0.15 + Math.random() * 0.2, color: [255, 160, 60], glow: true }); }
          const r = e.r * z * (0.5 + k * 2.5);
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          g.addColorStop(0, `rgba(255,250,220,${1 - k})`);
          g.addColorStop(0.4, `rgba(255,150,50,${(1 - k) * 0.8})`);
          g.addColorStop(1, 'rgba(120,40,10,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'bolt': {
        let x = sx + (hash2(e.seed, 1, 1) - 0.5) * 60, y = sy - 400;
        ctx.strokeStyle = `rgba(235,240,255,${1 - u})`;
        ctx.shadowColor = 'rgba(160,190,255,1)';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 1; k <= 12; k++) {
          const t = k / 12;
          x = sx + (x - sx) * (1 - 1 / (13 - k)) + (hash2(e.seed, k, 2) - 0.5) * 34 * (1 - t);
          y = sy - 400 * (1 - t);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      }
      case 'nuke': {
        // fireball, then a rising mushroom cloud
        const r = z * 4;
        const rise = Math.min(1, u * 1.6);
        const stemTop = sy - r * 2.5 * rise;
        ctx.globalAlpha = Math.min(1, (1 - u) * 1.8);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.4);
        g.addColorStop(0, 'rgba(255,255,230,1)');
        g.addColorStop(0.5, 'rgba(255,160,60,0.8)');
        g.addColorStop(1, 'rgba(120,40,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r * (0.5 + rise), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150,110,90,0.85)';
        ctx.fillRect(sx - r * 0.25, stemTop, r * 0.5, sy - stemTop);
        const cg = ctx.createRadialGradient(sx, stemTop, 0, sx, stemTop, r * 1.6);
        cg.addColorStop(0, 'rgba(255,190,120,0.95)');
        cg.addColorStop(0.6, 'rgba(160,110,90,0.9)');
        cg.addColorStop(1, 'rgba(90,70,60,0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.ellipse(sx, stemTop, r * (0.8 + rise), r * (0.5 + rise * 0.5), 0, 0, Math.PI * 2); ctx.fill();
        if (!e.ringed) { e.ringed = true; this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, t: 0, dur: 1.5, color: [255, 240, 220] }); }
        break;
      }
      case 'beam': {
        const a = Math.sin(Math.PI * u);
        const g = ctx.createLinearGradient(sx, sy - 500, sx, sy);
        g.addColorStop(0, `rgba(${e.color[0]},${e.color[1]},${e.color[2]},0)`);
        g.addColorStop(1, `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${0.55 * a})`);
        ctx.fillStyle = g;
        const bw = Math.max(8, z * 1.6);
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.moveTo(sx - bw * 0.3, sy - 500); ctx.lineTo(sx + bw * 0.3, sy - 500);
        ctx.lineTo(sx + bw, sy); ctx.lineTo(sx - bw, sy); ctx.closePath();
        ctx.fill();
        const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, bw * 3);
        rg.addColorStop(0, `rgba(255,255,240,${0.7 * a})`);
        rg.addColorStop(1, 'rgba(255,255,240,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(sx, sy, bw * 3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'launch': {
        const h = u * u * 600;
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - u)})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 10, sy - h * 0.6, sx + 30 * u, sy - h); ctx.stroke();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.arc(sx + 30 * u, sy - h, 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'skystreak': {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const W = R.canvas.width, H = R.canvas.height;
        for (let k = 0; k < e.n; k++) {
          const t0 = e.n > 1 ? hash2(k, 3, 9) * 0.7 : 0;
          const lu = (u - t0) / (e.n > 1 ? 0.3 : 1);
          if (lu < 0 || lu > 1) continue;
          const x = hash2(k, 1, 9) * W * 1.2, y = hash2(k, 2, 9) * H * 0.5;
          const len = e.big ? 260 : 120;
          ctx.strokeStyle = `rgba(230,240,255,${Math.sin(Math.PI * lu) * 0.8})`;
          ctx.lineWidth = e.big ? 3 : 1.5;
          ctx.beginPath(); ctx.moveTo(x - lu * len * 2, y + lu * len); ctx.lineTo(x - lu * len * 2 + len, y + lu * len - len * 0.5); ctx.stroke();
        }
        break;
      }
      default:
    }
    ctx.restore();
  }

  /** effects read straight from the world: wildfire, eruptions, smoke */
  ambient(dt, view, time, z) {
    const w = this.w;
    const x0 = Math.max(0, Math.floor(view.x0)), x1 = Math.min(w.W - 1, Math.ceil(view.x1));
    const y0 = Math.max(0, Math.floor(view.y0)), y1 = Math.min(w.H - 1, Math.ceil(view.y1));
    const area = (x1 - x0 + 1) * (y1 - y0 + 1);
    const p = Math.min(1, 6000 / Math.max(1, area)) * dt * 6;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = y * w.W + x;
        if (!w.fire[c]) continue;
        if (Math.random() < p * 2) this.emit({ x: x + Math.random(), y: y + Math.random(), vx: (Math.random() - 0.5) * 0.2, vy: -0.6 - Math.random() * 0.5, life: 0.5 + Math.random() * 0.4, t: 0, size: 0.18 + Math.random() * 0.15, color: [255, 110 + Math.random() * 100, 30], glow: true });
        if (Math.random() < p * 0.5) this.emit({ x: x + Math.random(), y: y + Math.random(), vx: 0.1, vy: -0.5, life: 2.5, t: 0, size: 0.3, grow: 0.4, color: [60, 56, 54], alpha: 0.35, smoke: true });
      }
    }
    for (const v of w.volcanoes) {
      if (v.x < x0 - 3 || v.x > x1 + 3 || v.y < y0 - 3 || v.y > y1 + 3) continue;
      if (v.erupting > 0 && Math.random() < dt * 8) {
        this.emit({ x: v.x + 0.5, y: v.y + 0.5, vx: (Math.random() - 0.5) * 2.5, vy: -2 - Math.random() * 2.5, g: 5, life: 1, t: 0, size: 0.2, color: [255, 140, 40], glow: true });
        this.emit({ x: v.x + 0.5, y: v.y, vx: (Math.random() - 0.5) * 0.3, vy: -0.7, life: 4, t: 0, size: 0.6, grow: 0.7, color: [80, 74, 72], alpha: 0.5, smoke: true });
      } else if (v.heat > 0.6 && Math.random() < dt * 0.8) {
        this.emit({ x: v.x + 0.5, y: v.y, vx: 0.1, vy: -0.3, life: 3, t: 0, size: 0.3, grow: 0.3, color: [200, 200, 200], alpha: 0.3, smoke: true });
      }
    }
    if (z >= 5) {
      for (const city of w.cities) {
        if (!city.alive || city.x < x0 || city.x > x1 || city.y < y0 || city.y > y1) continue;
        const ind = city.buildings.includes('factory') || city.buildings.includes('powerplant');
        if (ind && Math.random() < dt * 3) this.emit({ x: city.x + 0.5 + (Math.random() - 0.5), y: city.y, vx: 0.15, vy: -0.4, life: 3, t: 0, size: 0.2, grow: 0.35, color: [110, 104, 100], alpha: 0.4, smoke: true });
      }
    }
  }
}
