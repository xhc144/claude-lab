// Text motion: scramble-to-text, count-ups with jittering digits, typed lines.
const GLYPHS = '∂∑∫∇πλΩΦψ∞≅⊗∮ℝℂℤ01#%&<>/=+';
const running = new WeakMap();

export function scramble(el, text = el.dataset.text || el.textContent, { duration = 1100, glyphs = GLYPHS, delay = 0 } = {}) {
  el.dataset.text = text;
  const token = {};
  running.set(el, token);
  const chars = [...text];
  const start = performance.now() + delay;
  const reveal = chars.map((_, i) => (i / chars.length) * duration * 0.55 + Math.random() * duration * 0.45);
  return new Promise((resolve) => {
    const step = (now) => {
      if (running.get(el) !== token) return resolve();
      const t = now - start;
      let out = '';
      let done = true;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === ' ' || t >= reveal[i]) out += chars[i];
        else { done = false; out += t < 0 ? ' ' : glyphs[(Math.random() * glyphs.length) | 0]; }
      }
      el.textContent = out;
      if (done) { el.textContent = text; resolve(); } else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

const fmt = new Intl.NumberFormat('en-US');
export function countUp(el, to, { duration = 1600, decimals = 0, suffix = '' } = {}) {
  const start = performance.now();
  const token = {};
  running.set(el, token);
  const step = (now) => {
    if (running.get(el) !== token) return;
    const t = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - t, 4);
    let v = to * e;
    if (t < 0.85 && decimals === 0 && to > 9) v += (Math.random() - 0.5) * Math.max(1, to * 0.04) * (1 - t);
    el.textContent = (decimals ? Math.max(0, v).toFixed(decimals) : fmt.format(Math.max(0, Math.round(v)))) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = (decimals ? to.toFixed(decimals) : fmt.format(to)) + suffix;
  };
  requestAnimationFrame(step);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Deterministic barcode from a string (pure decoration).
export function barcode(el, text) {
  let h = 2166136261;
  const bars = [];
  for (let k = 0; k < 42; k++) {
    h ^= text.charCodeAt(k % text.length) + k;
    h = Math.imul(h, 16777619) >>> 0;
    bars.push(`<i style="width:${1 + (h % 3)}px;opacity:${0.35 + ((h >> 3) % 7) / 10}"></i>`);
  }
  el.innerHTML = bars.join('');
}
