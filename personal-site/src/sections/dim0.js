// Dimension 0: dossier barcode, the orbit of interests, the clickable singularity.
import { barcode } from '../core/fx.js';
import { unlock } from '../ui/eggs.js';
import { audio } from '../core/audio.js';

export function initDim0(universe) {
  for (const el of document.querySelectorAll('[data-barcode]')) barcode(el, el.dataset.barcode);
  const today = new Date();
  for (const el of document.querySelectorAll('[data-today]')) el.textContent = today.toISOString().slice(0, 10);
  const spans = [...document.querySelectorAll('[data-orbit] span')];
  spans.forEach((s, i) => s.style.setProperty('--a', `${(i / spans.length) * 360}deg`));
  const hit = document.querySelector('.singularity-hit');
  hit.addEventListener('click', () => {
    if (universe) universe.explode();
    audio.impact();
    unlock('bang', { message: '大爆炸：一个点里装着整个宇宙。粒子会在几秒后回到奇点。' });
  });
}
