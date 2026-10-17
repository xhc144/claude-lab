// Typeset the <span class="m"> / <div class="mb"> placeholders the build leaves in the HTML.
import { MACROS } from './macros.js';

const cache = new Map();

export function texToHtml(tex, display) {
  const key = (display ? 'D' : 'I') + tex;
  let html = cache.get(key);
  if (html != null) return html;
  const katex = window.katex;
  if (!katex) return null;
  try {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, macros: { ...MACROS }, strict: 'ignore', output: 'html' });
  } catch (e) {
    html = `<code class="tex-error">${tex.replace(/[&<]/g, (c) => (c === '&' ? '&amp;' : '&lt;'))}</code>`;
  }
  if (cache.size > 6000) cache.clear();
  cache.set(key, html);
  return html;
}

export function renderMath(root) {
  if (!root || !window.katex) return;
  for (const e of root.querySelectorAll('span.m:not([data-k]), div.mb:not([data-k])')) {
    const display = e.tagName === 'DIV';
    const html = texToHtml(e.textContent, display);
    if (html == null) continue;
    e.dataset.k = '1';
    e.dataset.tex = e.textContent;
    e.innerHTML = html;
  }
}

/** Typeset $…$ inside a plain string (used by animation captions). */
export function texInline(s) {
  return s.replace(/\$([^$]+)\$/g, (_, t) => texToHtml(t, false) ?? t);
}
