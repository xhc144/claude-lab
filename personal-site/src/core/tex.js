// KaTeX rendering for every [data-tex] element (inline by default, display with [data-display]).
import katex from 'katex';

export function tex(src, display = false) {
  return katex.renderToString(src, { throwOnError: false, displayMode: display, output: 'html', strict: 'ignore' });
}

export function renderTex(root = document) {
  for (const el of root.querySelectorAll('[data-tex]')) {
    if (el.dataset.texDone) continue;
    try {
      katex.render(el.dataset.tex, el, { throwOnError: false, displayMode: el.classList.contains('formula') || el.hasAttribute('data-display'), output: 'html', strict: 'ignore' });
      el.dataset.texDone = '1';
    } catch (err) {
      el.textContent = el.dataset.tex;
    }
  }
}
