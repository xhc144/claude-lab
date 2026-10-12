// Dimension 0: dossier barcode, the orbit of interests, the clickable singularity.
import { barcode } from '../core/fx.js';
import { unlock } from '../ui/eggs.js';
import { audio } from '../core/audio.js';
import { onFrame } from '../core/loop.js';

export function initDim0(universe) {
  for (const el of document.querySelectorAll('[data-barcode]')) barcode(el, el.dataset.barcode);
  const today = new Date();
  for (const el of document.querySelectorAll('[data-today]')) el.textContent = today.toISOString().slice(0, 10);
  const spans = [...document.querySelectorAll('[data-orbit] span')];
  // words ride a tilted ring but always face the viewer; depth sets scale and brightness
  const wrap = document.querySelector('.orbit-wrap');
  let ang = 0;
  onFrame(({ dt }) => {
    const r = wrap.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    ang += dt * 0.12;
    const R = Math.min(460, r.width * 0.42), tilt = 0.22;
    spans.forEach((s, i) => {
      const a = ang + (i / spans.length) * Math.PI * 2;
      const x = Math.sin(a) * R, z = Math.cos(a), y = -z * R * tilt;
      const k = 0.62 + 0.38 * (z + 1) / 2;
      s.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${k.toFixed(3)})`;
      s.style.opacity = (0.18 + 0.82 * ((z + 1) / 2) ** 1.5).toFixed(3);
      s.style.zIndex = String(Math.round((z + 1) * 50));
    });
  });
  const hit = document.querySelector('.singularity-hit');
  hit.addEventListener('click', () => {
    if (universe) universe.explode();
    audio.impact();
    unlock('bang', { message: '大爆炸：一个点里装着整个宇宙。粒子会在几秒后回到奇点。' });
  });
}
