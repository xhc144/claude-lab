// Asset loading for the renderer (images, video frames, models). The host provides `resolveUrl`
// which maps a document asset (or src path) to a URL the page can load.

export class AssetStore {
  constructor({ resolveUrl, onLoad, onFrame } = {}) {
    this.onFrame = onFrame || (() => {});
    this.resolveUrl = resolveUrl || ((a) => a?.file || a?.src || a);
    this.onLoad = onLoad || (() => {});
    this.images = new Map();
    this.pending = new Map();
    this.doc = null;
    this.extra = new Map();
    this.videos = new Map();
  }

  /** Seekable video track: { element, ready, seek(seconds) → Promise }. */
  video(ref) {
    const url = this.urlFor(ref);
    if (!url || typeof document === 'undefined') return null;
    let tr = this.videos.get(url);
    if (!tr) {
      const el = document.createElement('video');
      el.muted = true; el.playsInline = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
      const ready = new Promise((r) => { el.addEventListener('loadeddata', r, { once: true }); el.addEventListener('error', r, { once: true }); setTimeout(r, 15000); });
      el.src = url;
      tr = {
        element: el, ready,
        seek: (time) => new Promise((res) => {
          const target = Math.max(0, Math.min(time, (el.duration || time + 1) - 0.02));
          if (el.readyState >= 2 && Math.abs(el.currentTime - target) < 0.004) return res();
          const done = () => { el.removeEventListener('seeked', done); res(); };
          el.addEventListener('seeked', done);
          el.currentTime = target;
          setTimeout(done, 3000);
        }),
        // Live preview (editor playback): play the element in real time, re-seek only on drift.
        sync: (time, playing, rate = 1) => this._sync(el, time, playing, rate),
      };
      this.videos.set(url, tr);
      this.pending.set('v:' + url, ready.then(() => { this.pending.delete('v:' + url); this.onLoad(url); }));
    }
    return tr;
  }

  /** Audio element for live preview of a document audio asset ({ element, sync }). */
  audio(ref) {
    const url = this.urlFor(ref);
    if (!url || typeof document === 'undefined') return null;
    const key = 'a:' + url;
    let tr = this.videos.get(key);
    if (!tr) {
      const el = document.createElement('audio');
      el.preload = 'auto'; el.src = url;
      tr = { element: el, sync: (time, playing, rate = 1, volume = 1) => { el.volume = Math.max(0, Math.min(1, volume)); this._sync(el, time, playing, rate); } };
      this.videos.set(key, tr);
    }
    return tr;
  }

  _sync(el, time, playing, rate) {
    el._motifSync = performance.now();
    const dur = Number.isFinite(el.duration) ? el.duration : Infinity;
    const target = Math.max(0, Math.min(time, dur - 0.02));
    if (playing && time < dur) {
      const r = Math.max(0.25, Math.min(8, rate || 1));
      if (Math.abs(el.playbackRate - r) > 1e-3) el.playbackRate = r;
      if (Math.abs(el.currentTime - target) > 0.25 * Math.max(1, r) && !el.seeking) el.currentTime = target;
      if (el.paused) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - target) > 0.01 && !el.seeking) {
        el.currentTime = target;
        // Paused scrubbing: redraw once the new frame is decoded.
        el.addEventListener('seeked', () => this.onFrame(), { once: true });
      }
    }
    if (!this._watch) {
      // Elements that stop being drawn (scene left, playback stopped elsewhere) go quiet.
      this._watch = setInterval(() => {
        let live = 0;
        for (const tr of this.videos.values()) {
          const e = tr.element;
          if (!e.paused && performance.now() - (e._motifSync || 0) > 300) e.pause();
          if (!e.paused) live++;
        }
        if (!live) { clearInterval(this._watch); this._watch = null; }
      }, 200);
    }
  }

  /** Pause every live-preview media element. */
  pauseAll() { for (const tr of this.videos.values()) if (!tr.element.paused) tr.element.pause(); }

  setDocument(doc) { this.doc = doc; }

  urlFor(ref) {
    if (!ref) return null;
    const asset = typeof ref === 'string' ? this.doc?.assets?.[ref] : null;
    if (asset) return this.resolveUrl(asset);
    if (typeof ref === 'object' && ref.asset) return this.urlFor(ref.asset);
    if (typeof ref === 'object' && ref.src) return this.resolveUrl({ src: ref.src });
    return this.resolveUrl({ src: ref });
  }

  /** Returns a decoded image or null (and starts loading). */
  image(ref) {
    const url = this.urlFor(ref);
    if (!url) return null;
    const hit = this.images.get(url);
    if (hit) return hit.ok ? hit.img : null;
    if (!this.pending.has(url)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      const pr = new Promise((resolve) => {
        img.onload = async () => {
          try { await img.decode?.(); } catch { /* ignore */ }
          this.images.set(url, { ok: true, img });
          this.pending.delete(url);
          this.onLoad(url);
          resolve();
        };
        img.onerror = () => { this.images.set(url, { ok: false }); this.pending.delete(url); resolve(); };
      });
      this.pending.set(url, pr);
      img.src = url;
    }
    return null;
  }

  failed(ref) { const url = this.urlFor(ref); return url ? this.images.get(url)?.ok === false : true; }

  /** Register a non-image async resource (e.g. MathJax output, glTF). */
  track(key, promise) {
    if (this.extra.has(key)) return this.extra.get(key);
    const entry = { done: false, value: null, promise: null };
    entry.promise = Promise.resolve(promise).then((v) => { entry.done = true; entry.value = v; this.onLoad(key); return v; }, (err) => { entry.done = true; entry.error = err; this.onLoad(key); });
    this.extra.set(key, entry);
    this.pending.set('x:' + key, entry.promise.finally(() => this.pending.delete('x:' + key)));
    return entry;
  }

  async whenReady(timeoutMs = 20000) {
    const t0 = Date.now();
    while (this.pending.size && Date.now() - t0 < timeoutMs) {
      await Promise.race([Promise.all([...this.pending.values()]), new Promise((r) => setTimeout(r, 250))]);
    }
  }
}
