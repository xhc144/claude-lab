// Preferences shared by all modules: computing precision and whether the start page opens first.
// Kept in localStorage when it is available; every access is guarded, so a private window or
// blocked storage just means the defaults are used.

const KEY = 'mathscape.settings.v1';
const LAST = 'mathscape.last.v1';

export const DIGIT_CHOICES = [20, 50, 100, 300, 1000];
const DEFAULTS = { precision: 'standard', digits: 50, startPage: true };

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

function sanitize(s) {
  const out = { ...DEFAULTS };
  if (!s || typeof s !== 'object') return out;
  if (s.precision === 'standard' || s.precision === 'high') out.precision = s.precision;
  if (DIGIT_CHOICES.includes(s.digits)) out.digits = s.digits;
  if (typeof s.startPage === 'boolean') out.startPage = s.startPage;
  return out;
}

export const settings = sanitize(read(KEY));
const listeners = new Set();

/** Merge `patch` into the settings; listeners get (settings, changedKeys). */
export function updateSettings(patch) {
  const next = sanitize({ ...settings, ...patch });
  const changed = Object.keys(next).filter((k) => next[k] !== settings[k]);
  if (!changed.length) return;
  Object.assign(settings, next);
  write(KEY, settings);
  for (const fn of listeners) fn(settings, changed);
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const highPrecision = () => settings.precision === 'high';

export const precisionLabel = () => (highPrecision() ? `高精度 · ${settings.digits} 位` : '双精度');

/**
 * Numeric parameters that depend on the precision mode. Standard mode keeps the original
 * double-precision defaults; high precision tightens tolerances and shows more digits.
 */
export function tolerances() {
  const hp = highPrecision();
  return {
    hp,
    odeRtol: hp ? 1e-12 : 1e-8, // phase-plane trajectories (relative)
    odeAtol: hp ? 1e-14 : 1e-10, // … absolute, times the view span
    sepRtol: hp ? 1e-12 : 1e-9, // separatrices
    sepAtol: hp ? 1e-15 : 1e-12,
    odeMaxSteps: hp ? 60000 : 12000,
    nbodyRtol: hp ? 1e-13 : 1e-10, // three-body default tolerance
    windingTurn: hp ? 0.1 : 0.4, // argument principle: max turn between contour samples
    windingSamples: hp ? 2880 : 720,
    digits: hp ? 12 : 4, // significant digits in readouts
  };
}

/** The last module state the visitor had open (for “continue where you left off”). */
export const lastVisit = () => {
  const v = read(LAST);
  return v && typeof v.hash === 'string' && v.hash.startsWith('#/') ? v : null;
};
export const rememberVisit = (hash) => write(LAST, { hash, at: Date.now() });
