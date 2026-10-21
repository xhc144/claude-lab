// Inline SVG icons (stroke = currentColor).
const svg = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', 16),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  star: svg('<path d="m12 3.5 2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/>', 16),
  starFill: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.5 2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/></svg>',
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  home: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  dice: svg('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  route: svg('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 17c6 0 2-10 8-10"/>'),
  path: svg('<path d="M4 19h4l3-6 3 3 6-10"/><circle cx="20" cy="6" r="1.6"/>'),
  web: svg('<circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="6" r="1.6"/><circle cx="19" cy="7" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/><path d="M10.2 10.6 6.3 7M13.9 10.9 17.6 8M10.5 13.8l-3.3 3M13.7 13.8l3.2 3"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>', 16),
  pause: svg('<path d="M8 5v14M16 5v14"/>', 16),
  prev: svg('<path d="m15 6-6 6 6 6"/>', 16),
  next: svg('<path d="m9 6 6 6-6 6"/>', 16),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  galaxy: svg('<path d="M12 12c0-3 3-5 6-4 2.5.9 3 4.5.5 6.5-3.5 2.8-10 1.5-12-2.5S7 3 12 3"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'),
  scroll: svg('<path d="M7 4h11a2 2 0 0 1 2 2v1h-4M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7M7 4a2 2 0 0 1 2 2v12"/><path d="M11 9h4M11 13h4"/>'),
  film: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9 5 3-5 3z"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1"/>'),
  fold: svg('<path d="M7 14l5-5 5 5"/>'),
};

export const BRAND = `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="bm" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".22" stop-color="#d6e4ff"/><stop offset=".58" stop-color="#8b7dff" stop-opacity=".5"/><stop offset="1" stop-color="#05060d" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="26" fill="url(#bm)"/><path d="M32 4v56M4 32h56" stroke="#eef3ff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><circle cx="32" cy="32" r="4.5" fill="#fff"/><circle cx="52" cy="13" r="2.4" fill="#ffd166"/><circle cx="12" cy="49" r="2" fill="#7fb4ff"/><circle cx="50" cy="50" r="1.6" fill="#ff9ad5"/><path d="M52 13 32 32 12 49M32 32l18 18" stroke="#ffd166" stroke-width="1" opacity=".55"/></svg>`;
