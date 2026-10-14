// Persistent user settings.
const KEY = 'pu.settings.v1';

export const DEFAULTS = {
  particles: { size: 1, brightness: 1, speed: 1, turbulence: 1, streak: 1, transition: 3.2 },
  audio: { reactivity: 1, bass: 1, treble: 1, impact: 1, latency: 0 },
  fx: { bloom: 1, bloomRadius: 1, trails: 1, flare: 1, chroma: 1, grain: 1, vignette: 1, dof: 1, stars: 1, letterbox: false },
  color: { palette: 'auto', hue: 0, saturation: 1, contrast: 1, temperature: 0 },
  camera: { auto: true, style: 'cinematic', shake: 1, autoRotate: 0.05 },
  scene: { current: 'nebula', autoSwitch: 'music', interval: 60 },
  quality: { auto: true, tier: 3, renderScale: 1, maxTier: 4, showStats: false },
  player: { volume: 0.8, muted: false, shuffle: false, repeat: 'all' },
  export: { resolution: '1080p', fps: 60, quality: 'high', format: 'auto', particles: 'max', range: 'full' },
  sceneParams: {},
  ui: { uiHidden: false, firstRun: true }
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function merge(base, over) {
  if (over === undefined || over === null) return clone(base);
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return typeof over === typeof base ? over : base;
  if (typeof over !== 'object' || Array.isArray(over)) return clone(base);
  const out = clone(base);
  for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
  return out;
}

export function loadSettings() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }
  return merge(DEFAULTS, saved);
}

let saveTimer = null;
export function saveSettings(s) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  }, 300);
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

export function resetSettings(s, section) {
  if (section) s[section] = JSON.parse(JSON.stringify(DEFAULTS[section]));
  else Object.assign(s, JSON.parse(JSON.stringify(DEFAULTS)));
}
