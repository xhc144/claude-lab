// App-wide mutable state plus a tiny event bus. Pages read from `state` and listen on `bus`;
// anything that changes shared data emits a topic so every mounted view can refresh itself.

import { KEYS, JOBS, NOTIFICATIONS, MODELS } from './data.js';
import { saved } from './util.js';

const listeners = new Map();

export const bus = {
  on(topic, fn) {
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic).add(fn);
    return () => listeners.get(topic)?.delete(fn);
  },
  emit(topic, payload) {
    for (const fn of [...(listeners.get(topic) || [])]) {
      try { fn(payload); } catch (e) { console.error(`[bus:${topic}]`, e); }
    }
  },
};

export const state = {
  keys: KEYS,
  jobs: JOBS,
  notifications: NOTIFICATIONS,
  models: MODELS,
  favorites: new Set(saved.get('favorites', ['tensora-ultra-2', 'nebulos-coder-3'])),
  balance: 186_420,
  budget: saved.get('budget', 600_000),
  alerts: saved.get('alerts', { at50: true, at80: true, at100: true, daily: false, anomaly: true }),
  prefs: {
    rail: saved.get('rail', 'wide'),
    accent: saved.get('accent', 'ion'),
    motion: saved.get('motion', 'full'),
    density: saved.get('density', 'cozy'),
  },
  workspace: '生产环境',
  user: { name: '林知远', role: '所有者', initials: '林' },
};

export function setPref(key, value) {
  state.prefs[key] = value;
  saved.set(key, value);
  bus.emit('prefs', { key, value });
}

export function toggleFavorite(id) {
  const fav = state.favorites;
  fav.has(id) ? fav.delete(id) : fav.add(id);
  saved.set('favorites', [...fav]);
  bus.emit('favorites', id);
  return fav.has(id);
}

export function pushNotification(n) {
  state.notifications.unshift({ id: `n${Date.now()}`, at: Date.now(), read: false, ...n });
  bus.emit('notifications');
}

export const unreadCount = () => state.notifications.filter((n) => !n.read).length;
