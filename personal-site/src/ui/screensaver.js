// After 45 s without input: a Lorenz attractor slowly draws itself. Any input dismisses it.
import { pointer } from './cursor.js';
import { unlock } from './eggs.js';

export function initScreensaver({ isBusy }) {
  const root = document.getElementById('screensaver');
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let last = performance.now(), on = false, raf = 0;
  let x = 0.1, y = 0, z = 0, hue = 0;
  const bump = () => { last = performance.now(); if (on) stop(); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']) addEventListener(ev, bump, { passive: true });
  const draw = () => {
    const w = canvas.width, h = canvas.height, s = Math.min(w, h) / 62;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.012)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.2 * devicePixelRatio;
    for (let k = 0; k < 18; k++) {
      const dt = 0.004;
      const nx = x + dt * 10 * (y - x), ny = y + dt * (x * (28 - z) - y), nz = z + dt * (x * y - (8 / 3) * z);
      ctx.strokeStyle = `hsla(${(hue += 0.08) % 360}, 90%, 60%, 0.5)`;
      ctx.beginPath();
      ctx.moveTo(w / 2 + x * s, h * 0.9 - z * s);
      ctx.lineTo(w / 2 + nx * s, h * 0.9 - nz * s);
      ctx.stroke();
      x = nx; y = ny; z = nz;
    }
    raf = requestAnimationFrame(draw);
  };
  const start = () => {
    on = true;
    canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    root.classList.add('on');
    unlock('idle', { message: '系统待机。混沌仍在演化——这是洛伦茨吸引子，动一下鼠标就能回来。' });
    raf = requestAnimationFrame(draw);
  };
  const stop = () => { on = false; root.classList.remove('on'); cancelAnimationFrame(raf); };
  setInterval(() => {
    if (!on && !isBusy() && !document.hidden && performance.now() - last > 45000 && performance.now() - pointer.lastMove > 45000) start();
  }, 1000);
}
