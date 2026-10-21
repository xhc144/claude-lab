// Screen recordings in Motif: the `screen` block's settings, presets and helpers shared by the
// catalog, the engine, the recorder and the recording editor.
export * from './zoom.js';
export * from './planner.js';
export * from './cursor.js';
export * from './timeline.js';
export * from './project.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Backgrounds behind the recorded screen. Gradients are drawn procedurally (no image files). */
export const BACKGROUNDS = {
  aurora: { label: '极光', stops: ['#0f1b4d', '#3b2a8f', '#0e6f8a'], angle: 135, glow: '#7c6dff' },
  sunset: { label: '日落', stops: ['#ff7e5f', '#feb47b', '#ff6a88'], angle: 160, glow: '#ffd6a5' },
  ocean: { label: '深海', stops: ['#0b2545', '#13315c', '#1d70a2'], angle: 150, glow: '#4cc9f0' },
  forest: { label: '青野', stops: ['#0f3d3e', '#1b5e4a', '#76a96b'], angle: 140, glow: '#b5e48c' },
  candy: { label: '糖果', stops: ['#f6d5f7', '#fbe9d7', '#c3e7f7'], angle: 120, glow: '#ffffff' },
  dusk: { label: '暮色', stops: ['#2b1055', '#7597de', '#d3a5c9'], angle: 165, glow: '#f7c8e0' },
  midnight: { label: '午夜', stops: ['#090a0f', '#1b1d2a', '#2c2f45'], angle: 180, glow: '#5b5fef' },
  slate: { label: '石板', stops: ['#d9dde4', '#c4cad4', '#eef0f3'], angle: 135, glow: '#ffffff' },
  paper: { label: '宣纸', stops: ['#f6f1e7', '#efe6d4', '#f9f6ef'], angle: 120, glow: '#ffffff' },
  ember: { label: '余烬', stops: ['#1a0b0b', '#5c1a1b', '#c8553d'], angle: 145, glow: '#f28f3b' },
};

export const SCREEN_DEFAULTS = Object.freeze({
  background: { type: 'gradient', preset: 'aurora', color: '#16181f', blur: 40 },
  padding: 0.07,
  radius: 16,
  shadow: 0.55,
  window: 'none',
  cursor: { show: 'auto', size: 1.25, smooth: true, hideIdle: false, idleDelay: 1.2, click: 'ripple', clickColor: null, highlight: false, tilt: 2 },
  camera: { show: true, position: 'br', size: 0.2, shape: 'circle', border: 3, shadow: 0.5, mirror: true, shrinkOnZoom: true },
  audio: { mic: 1, system: 0.8 },
  zoom: { scale: 1.6, easing: 'spring', enter: 0.7, exit: 0.7 },
  // shutter as a fraction of one output frame (0 = off, 1 = the whole frame)
  motionBlur: { camera: 0.6, cursor: 0.5 },
});

export const CAMERA_POSITIONS = ['br', 'bl', 'tr', 'tl'];

/** Settings of a screen block with defaults filled in and values clamped. */
export function screenSettings(b = {}) {
  const d = SCREEN_DEFAULTS;
  const bg = { ...d.background, ...(b.background || {}) };
  if (!['gradient', 'color', 'image', 'blur', 'none'].includes(bg.type)) bg.type = 'gradient';
  if (bg.type === 'gradient' && !BACKGROUNDS[bg.preset]) bg.preset = 'aurora';
  const cur = { ...d.cursor, ...(b.cursor || {}) };
  cur.size = clamp(Number(cur.size) || 1.25, 0.5, 4);
  cur.idleDelay = clamp(Number(cur.idleDelay) || 1.2, 0.2, 8);
  cur.tilt = clamp(Number(cur.tilt ?? 2), 0, 4);
  if (!['auto', 'recorded', 'overlay', 'none'].includes(cur.show)) cur.show = 'auto';
  if (!['ripple', 'ring', 'pulse', 'none'].includes(cur.click)) cur.click = 'ripple';
  const cam = { ...d.camera, ...(b.camera_layout || {}) };
  cam.size = clamp(Number(cam.size) || 0.2, 0.08, 0.5);
  if (!CAMERA_POSITIONS.includes(cam.position)) cam.position = 'br';
  if (!['circle', 'rounded', 'square'].includes(cam.shape)) cam.shape = 'circle';
  return {
    background: bg,
    padding: clamp(Number(b.padding ?? d.padding), 0, 0.3),
    radius: clamp(Number(b.radius ?? d.radius), 0, 80),
    shadow: clamp(Number(b.shadow ?? d.shadow), 0, 1),
    window: ['none', 'mac', 'browser'].includes(b.window) ? b.window : d.window,
    cursor: cur,
    camera: cam,
    audio: { ...d.audio, ...(b.audio || {}) },
    zoom: { ...d.zoom, ...(b.zoomDefaults || {}) },
    motionBlur: {
      camera: clamp(Number(b.motionBlur?.camera ?? d.motionBlur.camera) || 0, 0, 1),
      cursor: clamp(Number(b.motionBlur?.cursor ?? d.motionBlur.cursor) || 0, 0, 1),
    },
  };
}

/**
 * Rectangle of the recorded picture inside a W×H frame, after padding and window chrome.
 * Returns { x, y, w, h, bar } where bar is the height of a window title bar above the picture.
 */
export function screenRect(W, H, srcW, srcH, s, { cameraSide = null } = {}) {
  void cameraSide;
  const pad = s.background.type === 'none' ? 0 : Math.round(Math.min(W, H) * s.padding);
  const bar = s.window === 'none' ? 0 : Math.round(Math.min(W, H) * 0.035);
  const aw = W - pad * 2, ah = H - pad * 2 - bar;
  const ar = srcW && srcH ? srcW / srcH : 16 / 9;
  let w = aw, h = aw / ar;
  if (h > ah) { h = ah; w = ah * ar; }
  return { x: Math.round((W - w) / 2), y: Math.round((H - h - bar) / 2 + bar), w: Math.round(w), h: Math.round(h), bar };
}

/** Webcam bubble rectangle, given the frame size and how far the screen is zoomed in. */
export function cameraRect(W, H, cam, zoomScale = 1) {
  const base = Math.min(W, H) * cam.size;
  const shrink = cam.shrinkOnZoom ? 1 - 0.35 * clamp((zoomScale - 1) / 0.8, 0, 1) : 1;
  const w = Math.round(base * shrink * (cam.shape === 'circle' ? 1 : 16 / 12));
  const h = Math.round(base * shrink);
  const m = Math.round(Math.min(W, H) * 0.035);
  const x = cam.position.endsWith('l') ? m : W - w - m;
  const y = cam.position.startsWith('t') ? m : H - h - m;
  return { x, y, w, h };
}
