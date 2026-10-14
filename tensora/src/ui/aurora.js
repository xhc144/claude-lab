// The living backdrop: a low-resolution canvas of drifting light fields whose hues follow the
// current domain (gateway / training / compute / billing) and breathe with live throughput.
// Rendered at ~1/8 scale and stretched by the browser, so it costs almost nothing per frame.

import { reducedMotion } from '../core/util.js';

const THEMES = {
  gateway: [[48, 214, 238], [120, 104, 255], [20, 120, 220]],
  train: [[150, 112, 255], [214, 82, 170], [70, 90, 230]],
  compute: [[255, 168, 72], [40, 200, 220], [210, 90, 60]],
  billing: [[60, 214, 150], [70, 150, 255], [120, 104, 255]],
  core: [[60, 200, 240], [140, 110, 255], [255, 160, 80]],
};

export function createAurora(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let cur = THEMES.core.map((c) => c.slice());
  let target = THEMES.core;
  let energy = 0.5, energyTarget = 0.5;
  let raf = 0, last = 0, t = Math.random() * 1000;
  const SCALE = 8;

  function size() {
    canvas.width = Math.max(32, Math.ceil(innerWidth / SCALE));
    canvas.height = Math.max(32, Math.ceil(innerHeight / SCALE));
  }

  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const blobs = [
      { x: 0.18 + 0.1 * Math.sin(t * 0.00011), y: 0.08 + 0.08 * Math.cos(t * 0.00013), r: 0.62, c: cur[0], a: 0.30 },
      { x: 0.86 + 0.08 * Math.cos(t * 0.00009), y: 0.18 + 0.1 * Math.sin(t * 0.00012), r: 0.55, c: cur[1], a: 0.24 },
      { x: 0.62 + 0.14 * Math.sin(t * 0.00007), y: 0.96 + 0.06 * Math.cos(t * 0.0001), r: 0.7, c: cur[2], a: 0.18 },
      { x: 0.35 + 0.2 * Math.cos(t * 0.00005), y: 0.55 + 0.12 * Math.sin(t * 0.00008), r: 0.38, c: cur[0], a: 0.07 + energy * 0.06 },
    ];
    const m = Math.max(w, h);
    for (const b of blobs) {
      const g = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, b.r * m);
      const a = b.a * (0.8 + energy * 0.4);
      g.addColorStop(0, `rgba(${b.c[0] | 0},${b.c[1] | 0},${b.c[2] | 0},${a})`);
      g.addColorStop(0.55, `rgba(${b.c[0] | 0},${b.c[1] | 0},${b.c[2] | 0},${a * 0.25})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // vignette keeps the edges deep so glass panels read cleanly
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(w / 2, h * 0.4, m * 0.2, w / 2, h * 0.5, m * 0.85);
    v.addColorStop(0, 'rgba(4,6,11,0)');
    v.addColorStop(1, 'rgba(4,6,11,0.7)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 33 || document.hidden) return; // ~30 fps is plenty for slow light
    const dt = now - last;
    last = now;
    t += dt;
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) cur[i][k] += (target[i][k] - cur[i][k]) * 0.035;
    energy += (energyTarget - energy) * 0.04;
    draw();
  }

  size();
  draw();
  addEventListener('resize', () => { size(); draw(); });
  const start = () => { cancelAnimationFrame(raf); if (!reducedMotion()) raf = requestAnimationFrame(frame); };
  start();

  return {
    setTheme(name) {
      target = THEMES[name] || THEMES.core;
      if (reducedMotion()) { cur = target.map((c) => c.slice()); draw(); }
    },
    pulse(e) { energyTarget = Math.max(0, Math.min(1, e)); },
    restart: start,
  };
}
