// What a visitor does on the map — learning status, favourites, history, settings — saved in this
// browser's localStorage. Every access is guarded: private windows or blocked storage just mean the
// map forgets on reload.

import { Emitter } from './util.js';

const KEY = 'math-starmap:v1';
const DEFAULTS = () => ({
  progress: {},   // id → 1 学习中 | 2 已掌握
  fav: [],        // ids, newest first
  history: [],    // recently opened ids, newest first
  visited: {},    // id → first visit time (ms)
  settings: { labels: true, motion: true, levels: { hs: true, core: true, ext: true }, rels: { pre: true, der: true, gen: true, eq: true, app: true, ex: true, rel: true } },
  introSeen: false,
});

export class Store extends Emitter {
  constructor() {
    super();
    this.data = DEFAULTS();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.merge(JSON.parse(raw));
    } catch { /* storage unavailable */ }
  }
  merge(d) {
    const base = DEFAULTS();
    this.data = {
      ...base, ...d,
      settings: { ...base.settings, ...(d.settings || {}), levels: { ...base.settings.levels, ...(d.settings?.levels || {}) }, rels: { ...base.settings.rels, ...(d.settings?.rels || {}) } },
    };
    if (!Array.isArray(this.data.fav)) this.data.fav = [];
    if (!Array.isArray(this.data.history)) this.data.history = [];
    if (typeof this.data.progress !== 'object' || !this.data.progress) this.data.progress = {};
  }
  save(what) {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
    this.emit('change', what);
  }
  status(id) { return this.data.progress[id] || 0; }
  setStatus(id, s) {
    if (s) this.data.progress[id] = s; else delete this.data.progress[id];
    this.save({ type: 'progress', id });
  }
  isFav(id) { return this.data.fav.includes(id); }
  toggleFav(id) {
    const f = this.data.fav;
    const k = f.indexOf(id);
    if (k >= 0) f.splice(k, 1); else f.unshift(id);
    this.save({ type: 'fav', id });
    return k < 0;
  }
  visit(id) {
    const h = this.data.history.filter((x) => x !== id);
    h.unshift(id);
    this.data.history = h.slice(0, 60);
    if (!this.data.visited[id]) this.data.visited[id] = Date.now();
    this.save({ type: 'history', id });
  }
  setting(path, value) {
    const parts = path.split('.');
    let o = this.data.settings;
    while (parts.length > 1) o = o[parts.shift()];
    o[parts[0]] = value;
    this.save({ type: 'settings', path });
  }
  exportJSON() {
    return JSON.stringify({ app: 'math-starmap', version: 1, exported: new Date().toISOString(), progress: this.data.progress, fav: this.data.fav, visited: this.data.visited }, null, 1);
  }
  importJSON(text) {
    const d = JSON.parse(text);
    if (d.app !== 'math-starmap') throw new Error('不是数学知识星图导出的进度文件');
    this.data.progress = { ...this.data.progress, ...(d.progress || {}) };
    this.data.fav = [...new Set([...(d.fav || []), ...this.data.fav])];
    this.data.visited = { ...(d.visited || {}), ...this.data.visited };
    this.save({ type: 'import' });
  }
  reset() {
    const s = this.data.settings;
    this.data = { ...DEFAULTS(), settings: s, introSeen: true };
    this.save({ type: 'reset' });
  }
}
