// Full-screen "lab" view of an instrument card: a fresh, larger instance plus the card's text.
import { bus } from '../core/bus.js';
import { createInstrument } from '../instruments/index.js';
import { renderTex } from '../core/tex.js';

export function initLab() {
  const root = document.getElementById('lab');
  const body = root.querySelector('.lab-body');
  const name = root.querySelector('.lab-name');
  let current = null;
  const close = () => {
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    if (current) { current.destroy(); current = null; }
    setTimeout(() => { if (!current) body.innerHTML = ''; }, 400);
  };
  const open = (card) => {
    const type = card.dataset.instrument;
    body.innerHTML = '';
    const host = document.createElement('div');
    host.className = 'instrument';
    host.dataset.instrument = type;
    host.innerHTML = '<canvas></canvas><div class="ins-controls"></div>';
    const text = document.createElement('div');
    text.className = 'lab-text';
    const src = card.querySelector('.card-body');
    text.innerHTML = `<p class="kicker mono">${card.querySelector('.card-head span').textContent}</p>`;
    for (const el of src.children) if (!el.classList.contains('ins-controls')) text.appendChild(el.cloneNode(true));
    body.append(host, text);
    name.textContent = `LAB · ${card.querySelector('h4').textContent}`;
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    renderTex(text);
    requestAnimationFrame(() => { current = createInstrument(host, { large: true, alwaysOn: true }); });
  };
  for (const b of document.querySelectorAll('[data-expand]')) b.addEventListener('click', () => open(b.closest('[data-instrument]')));
  root.querySelector('.lab-close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  bus.on('escape', close);
}
