// Playlist model with shuffle / repeat and (Electron) persistence of file paths.
import { nameFromFile } from './metadata.js';

const KEY = 'pu.playlist.v1';
let uid = 1;

export class Playlist extends EventTarget {
  constructor() {
    super();
    this.items = [];
    this.index = -1;
    this.shuffle = false;
    this.repeat = 'all'; // 'all' | 'one' | 'off'
    this.order = [];
  }

  _emit() { this.dispatchEvent(new Event('change')); }

  add(entries, { front = false } = {}) {
    const added = entries.map((e) => {
      const n = nameFromFile(e.name || '未命名');
      return {
        id: uid++, kind: e.kind || 'file', name: e.name, path: e.path || '', file: e.file || null,
        title: e.title || n.title, artist: e.artist || n.artist || '', duration: e.duration || 0,
        status: 'idle', cover: null, buffer: null, analysis: null, bpm: 0, error: ''
      };
    });
    if (front) this.items.unshift(...added); else this.items.push(...added);
    if (front && this.index >= 0) this.index += added.length;
    this._reshuffle();
    this._emit();
    this.save();
    return added;
  }

  remove(id) {
    const i = this.items.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [it] = this.items.splice(i, 1);
    if (it.cover) URL.revokeObjectURL(it.cover);
    if (i < this.index) this.index--;
    else if (i === this.index) this.index = Math.min(this.index, this.items.length - 1);
    this._reshuffle();
    this._emit();
    this.save();
  }

  clear() { this.items = []; this.index = -1; this._emit(); this.save(); }

  get current() { return this.items[this.index] || null; }
  indexOf(id) { return this.items.findIndex((x) => x.id === id); }

  _reshuffle() {
    this.order = this.items.map((_, i) => i);
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
  }

  // Index of the track that follows (auto-advance or "next" button).
  nextIndex(manual = false) {
    const n = this.items.length;
    if (!n) return -1;
    if (this.repeat === 'one' && !manual) return this.index;
    if (this.shuffle) {
      const k = this.order.indexOf(this.index);
      const nk = k + 1;
      if (nk >= n) return this.repeat === 'off' && !manual ? -1 : this.order[0];
      return this.order[nk];
    }
    const ni = this.index + 1;
    if (ni >= n) return this.repeat === 'off' && !manual ? -1 : 0;
    return ni;
  }

  prevIndex() {
    const n = this.items.length;
    if (!n) return -1;
    if (this.shuffle) {
      const k = this.order.indexOf(this.index);
      return this.order[(k - 1 + n) % n];
    }
    return (this.index - 1 + n) % n;
  }

  save() {
    try {
      const paths = this.items.filter((x) => x.path).map((x) => ({ name: x.name, path: x.path, title: x.title, artist: x.artist, duration: x.duration }));
      localStorage.setItem(KEY, JSON.stringify(paths.slice(0, 500)));
    } catch { /* ignore */ }
  }

  static saved() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  }
}
