// Stroke icons (24×24 grid, 1.8px strokes).
const P = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 6.2v11.6a.8.8 0 0 1-1.25.66L9 13.1a1.3 1.3 0 0 1 0-2.2l7.75-5.36A.8.8 0 0 1 18 6.2z" fill="currentColor" stroke="none"/><path d="M6.5 6v12"/>',
  next: '<path d="M6 6.2v11.6a.8.8 0 0 0 1.25.66L15 13.1a1.3 1.3 0 0 0 0-2.2L7.25 5.54A.8.8 0 0 0 6 6.2z" fill="currentColor" stroke="none"/><path d="M17.5 6v12"/>',
  shuffle: '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8c1 1.6 2.3 2.6 4.3 2.6H21"/><path d="M18 13l3 3-3 3"/><path d="M3 17h3.5c1.4 0 2.4-.5 3.3-1.4"/><path d="M14 8.4c.9-.9 2-1.4 3.5-1.4H21"/><path d="M18 4l3 3-3 3"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
  repeat1: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/><path d="M11.5 10.5l1-.5v4"/>',
  volume: '<path d="M4 9.5h3l4.2-3.6a.6.6 0 0 1 1 .46v11.28a.6.6 0 0 1-1 .46L7 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.6 6.4a7.5 7.5 0 0 1 0 11.2"/>',
  mute: '<path d="M4 9.5h3l4.2-3.6a.6.6 0 0 1 1 .46v11.28a.6.6 0 0 1-1 .46L7 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  scenes: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>',
  camera: '<path d="M4 8.5a2 2 0 0 1 2-2h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.6" r="3.6"/>',
  fullscreen: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
  exitFullscreen: '<path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c5 0 8.5 4.3 9.5 7a14 14 0 0 1-2.6 3.7M6.6 6.6C4.4 8 3 10.2 2.5 12c1 2.7 4.5 7 9.5 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  activity: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  music: '<path d="M9 18V6.5l11-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/><path d="M8 11.5l2-2.5 2 2 2.5-3.5 1.5 2" />',
  sparkles: '<path d="M12 3.5l1.6 4.3a2 2 0 0 0 1.2 1.2L19 10.5l-4.2 1.5a2 2 0 0 0-1.2 1.2L12 17.5l-1.6-4.3a2 2 0 0 0-1.2-1.2L5 10.5l4.2-1.5a2 2 0 0 0 1.2-1.2z"/><path d="M19 16v4M17 18h4"/>',
  orbit: '<circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(-25 12 12)"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5v-6a1.5 1.5 0 0 1 3 0v6M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-2.6 0-4.4-1.4-5.8-3.6L3.4 13a1.5 1.5 0 0 1 2.4-1.8L8 13.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5M4 13a8 8 0 0 0 14.3 4.6L20 15.5"/><path d="M4 4v4.5h4.5M20 20v-4.5h-4.5"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 16.5v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8h2a4.4 4.4 0 0 0 4.4-4.4C21 6.9 17 3.5 12 3.5z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor"/><circle cx="10" cy="7.3" r="1.1" fill="currentColor"/><circle cx="14.5" cy="7.3" r="1.1" fill="currentColor"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  atom: '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/>',
  chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14.5h10"/>'
};

export function icon(name, size = 20, extra = '') {
  const body = P[name] || P.info;
  return `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const LOGO = `<svg class="logo" viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
<defs>
  <radialGradient id="lg-core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#bff6ff"/><stop offset="1" stop-color="#7ef0ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="lg-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ef0ff"/><stop offset=".5" stop-color="#9d8cff"/><stop offset="1" stop-color="#ff7ad1"/></linearGradient>
</defs>
<ellipse cx="32" cy="32" rx="27" ry="10" fill="none" stroke="url(#lg-ring)" stroke-width="3.2" transform="rotate(-28 32 32)"/>
<ellipse cx="32" cy="32" rx="27" ry="10" fill="none" stroke="url(#lg-ring)" stroke-width="1.6" opacity=".55" transform="rotate(38 32 32)"/>
<circle cx="32" cy="32" r="13" fill="url(#lg-core)"/>
<circle cx="52" cy="18" r="2.2" fill="#ff7ad1"/><circle cx="11" cy="45" r="1.6" fill="#7ef0ff"/>
</svg>`;
