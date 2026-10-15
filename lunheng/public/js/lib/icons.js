import { svg } from './dom.js';

const P = {
  archive: '<path d="M4 7h16M5 7v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M9 11h6M3 4h18v3H3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gateway: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M5 19l2.8-2.8M16.2 7.8 19 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor" stroke="none"/>',
  step: '<path d="M5 4v16l10-8zM17 4h3v16h-3z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>',
  report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  arena: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="3" r="1.4" fill="currentColor"/><circle cx="20" cy="15" r="1.4" fill="currentColor"/><circle cx="5" cy="17" r="1.4" fill="currentColor"/>',
  graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.3 7 15.6 7M7.2 8.2l3.7 7.6M16.9 9.3l-3.6 6.6"/>',
  ledger: '<path d="M4 4h16v16H4zM4 9h16M9 9v11"/>',
  consensus: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  transcript: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  telemetry: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5.3-5-5.9"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
};

export function icon(name) {
  return svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
}

export function logo() {
  return svg(`<svg viewBox="0 0 48 48" aria-label="论衡" role="img">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4de8ff"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
  <circle cx="24" cy="24" r="21" fill="none" stroke="url(#lg)" stroke-width="1.5" opacity=".55"/>
  <circle cx="24" cy="24" r="14" fill="none" stroke="url(#lg)" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>
  <path d="M24 9v26M11 19h26" stroke="url(#lg)" stroke-width="2" stroke-linecap="round"/>
  <path d="M11 19l-4 9h8zM37 19l-4 9h8z" fill="none" stroke="url(#lg)" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="24" cy="38" r="2.4" fill="#4de8ff"/><circle cx="24" cy="9" r="2" fill="#a78bfa"/>
</svg>`);
}
