// Inline SVG icons (24×24, stroke = currentColor).

const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  brand: `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="bg-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7aa2ff"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><path d="M5 23 C 9 7, 23 7, 27 23" fill="none" stroke="url(#bg-g)" stroke-width="2.6" stroke-linecap="round"/><path d="M5 23 L 27 23" stroke="rgba(167,180,210,.35)" stroke-width="1.4" stroke-linecap="round"/><circle cx="16" cy="11" r="3.2" fill="#e8ecf4"/></svg>`,
  matrix: svg('<path d="M4 18 L9 6 L20 6 L15 18 Z" opacity=".35"/><path d="M4 18 L15 18"/><path d="M4 18 L9 6"/><path d="M15 18 l-2.2-.6 M15 18 l-1.2 1.9" /><path d="M9 6 l-1.6 1.4 M9 6 l.4 2.1"/>'),
  complex: svg('<circle cx="7.5" cy="12" r="4.5"/><path d="M14.5 12 h3.5 m-1.6-1.8 1.8 1.8-1.8 1.8"/><path d="M19 7.5 c 2.5 2.5 2.5 6.5 0 9" opacity=".6"/><path d="M5 10 l5 4 M5 14 l5-4" opacity=".45"/>'),
  ode: svg('<path d="M12 12 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0"/><path d="M12 7.5 a4.5 4.5 0 0 1 4.5 4.5 a5.5 5.5 0 0 1 -5.5 5.5 a7 7 0 0 1 -7 -7 a8 8 0 0 1 8 -8"/><path d="M20 4 l-2.5.5 .5 2.5" opacity=".6"/>'),
  threebody: svg('<ellipse cx="12" cy="12" rx="9" ry="5.2" transform="rotate(-22 12 12)" opacity=".45"/><circle cx="5.5" cy="14.5" r="2" fill="currentColor"/><circle cx="17.5" cy="8" r="1.6" fill="currentColor"/><circle cx="14" cy="17" r="1.2" fill="currentColor"/>'),
  play: svg('<path d="M8 5.5 v13 l11-6.5 z" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" stroke="none"/>'),
  reset: svg('<path d="M4 12 a8 8 0 1 0 2.4 -5.7"/><path d="M4 4 v4.5 h4.5"/>'),
  step: svg('<path d="M6 5.5 v13 l9-6.5 z"/><path d="M18 5.5 v13"/>'),
  reverse: svg('<path d="M4 9 h13 l-3-3"/><path d="M20 15 h-13 l3 3"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5 a2.6 2.6 0 1 1 3.6 2.4 c-.8.4-1.1.9-1.1 1.6 v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  camera: svg('<path d="M4 8 h3 l1.5-2 h7 l1.5 2 h3 v11 h-16 z"/><circle cx="12" cy="13" r="3.5"/>'),
  fit: svg('<path d="M4 9 V4 h5 M15 4 h5 v5 M20 15 v5 h-5 M9 20 H4 v-5"/>'),
  trash: svg('<path d="M5 7 h14 M10 7 V5 h4 v2 M7 7 l1 12 h8 l1-12"/>'),
  plus: svg('<path d="M12 5 v14 M5 12 h14"/>'),
  minus: svg('<path d="M5 12 h14"/>'),
  expand: svg('<path d="M14 4 h6 v6 M10 20 H4 v-6 M20 4 l-7 7 M4 20 l7-7"/>'),
  link: svg('<path d="M10 14 a4 4 0 0 0 5.7 0 l3-3 a4 4 0 0 0 -5.7 -5.7 l-1 1"/><path d="M14 10 a4 4 0 0 0 -5.7 0 l-3 3 a4 4 0 0 0 5.7 5.7 l1-1"/>'),
  close: svg('<path d="M6 6 l12 12 M18 6 L6 18"/>'),
  shuffle: svg('<path d="M4 7 h3 c5 0 5 10 10 10 h3 M17 14 l3 3-3 3"/><path d="M4 17 h3 c1.5 0 2.5-.9 3.3-2 M13.7 9 c.8-1.1 1.8-2 3.3-2 h3 M17 4 l3 3-3 3"/>'),
};
