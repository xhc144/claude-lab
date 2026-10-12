// A crosshair cursor that grows over anything clickable and can carry a short label.
import { onFrame } from '../core/loop.js';
import { env } from '../core/env.js';

export const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, inside: false, lastMove: performance.now() };

export function initCursor() {
  const fine = matchMedia('(pointer: fine)').matches;
  const el = document.getElementById('cursor');
  const label = el.querySelector('.c-label');
  const ring = el.querySelector('.c-ring');
  const dot = el.querySelector('.c-dot');
  let rx = pointer.x, ry = pointer.y;
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ny = -((e.clientY / innerHeight) * 2 - 1);
    pointer.inside = true;
    pointer.lastMove = performance.now();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.inside = false; });
  if (!fine || env.reducedMotion) return;
  document.body.classList.add('has-cursor');
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  const interactive = 'a, button, input, [data-cursor], .knot-drag, .instrument canvas, .star, .hs';
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest(interactive);
    el.classList.toggle('is-hover', !!t);
    let text = '';
    if (t) text = t.dataset.cursor || (t.matches('.knot-drag') ? 'DRAG · 旋转' : t.matches('canvas') ? (t.closest('[data-cursor-label]')?.dataset.cursorLabel || 'INTERACT') : t.matches('a') && t.target === '_blank' ? 'OPEN ↗' : '');
    label.textContent = text;
  });
  onFrame(({ dt }) => {
    const k = 1 - Math.exp(-dt * 22);
    rx += (pointer.x - rx) * k; ry += (pointer.y - ry) * k;
    dot.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    label.style.transform = `translate(${rx}px, ${ry}px)`;
  });
}
