// Small stacked notifications (bottom-right).
const host = () => document.getElementById('toasts');

export function toast(kicker, html, { duration = 5200 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="t-k">${kicker}</span><div class="t-b">${html}</div>`;
  host().appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 500); };
  setTimeout(close, duration);
  el.addEventListener('click', close);
  return el;
}
