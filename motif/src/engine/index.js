// Public engine API used by the editor, the render worker and the HTML player.
import { normalizeDocument } from '../core/doc.js';
import { TextEngine, plainText, fontString } from './text/text.js';
import { compile } from './compile.js';
import { renderFrame, activeScenes, settledTime } from './render.js';
import { resolveTheme } from './env.js';
import { AssetStore } from './assets.js';
import { getComponent } from './components/index.js';

function collectText(doc) {
  const out = [];
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k !== 'id' && k !== 'asset' && k !== 'src') walk(x); }
  };
  for (const s of doc.scenes) walk(s.blocks);
  walk(doc.brand);
  walk(doc.title);
  return out.map((s) => plainText(s)).join(' ');
}

export class MotifEngine {
  constructor({ canvas = null, resolveUrl, userThemes = {}, onInvalidate } = {}) {
    this.canvas = canvas;
    const mc = (typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(8, 8)).getContext('2d');
    this.te = new TextEngine(mc);
    this.userThemes = userThemes;
    this.onInvalidate = onInvalidate || (() => {});
    this.assets = new AssetStore({ resolveUrl, onLoad: () => { this.cache.clear(); this._recompile(); this.onInvalidate(); } });
    this.cache = new Map();
    this.doc = null;
    this.C = null;
    this._fontsLoaded = new Set();
  }

  /** Load fonts covering every glyph used by the document for every typographic role. */
  async loadFonts(doc) {
    if (typeof document === 'undefined' || !document.fonts) return;
    const theme = resolveTheme(doc, this.userThemes);
    const text = collectText(doc) + ' 0123456789.,%+-−—…“”"\'()（）：:/ ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const chars = [...new Set(text)].join('');
    const jobs = [];
    for (const role of Object.values(theme.fonts)) {
      for (const style of [{}, { b: true }, { i: true }]) {
        const f = fontString(role, 40, style);
        const key = f + '|' + chars;
        if (this._fontsLoaded.has(key)) continue;
        this._fontsLoaded.add(key);
        jobs.push(document.fonts.load(f, chars).catch(() => {}));
      }
    }
    jobs.push(document.fonts.load(fontString({ family: ['Motif Mono', 'Motif Sans SC'], weight: 500 }, 40), chars).catch(() => {}));
    await Promise.all(jobs);
    await document.fonts.ready;
    this.te.cache.clear();
  }

  async setDocument(input, { normalized = false } = {}) {
    const doc = normalized ? input : normalizeDocument(input).doc;
    const themeChanged = !this.doc || JSON.stringify(this.doc.theme) !== JSON.stringify(doc.theme);
    this.doc = doc;
    this.assets.setDocument(doc);
    await this.loadFonts(doc);
    if (themeChanged) this.cache.clear();
    await this.prepare(doc);
    this._recompile();
    return this.C;
  }

  /** Synchronous update for interactive editing (fonts for new glyphs load in the background). */
  update(doc) {
    this.doc = doc;
    this.assets.setDocument(doc);
    this._recompile();
    this.loadFonts(doc).then(() => { this.cache.clear(); this._recompile(); this.onInvalidate(); });
    this.prepare(doc).then(() => this.onInvalidate());
    return this.C;
  }

  async prepare(doc) {
    const jobs = [];
    for (const s of doc.scenes) for (const b of s.blocks) {
      const comp = getComponent(b.type);
      if (comp?.prepare) jobs.push(Promise.resolve(comp.prepare(b, { assets: this.assets, doc })).catch((e) => console.warn(e)));
      if (b.type === 'video' && b.asset) this.assets.video(b.asset);
      if (b.type === 'image' || b.type === 'gallery') {
        const refs = b.type === 'image' ? [b.asset ? b.asset : b.src ? { src: b.src } : null] : (b.images || []);
        refs.filter(Boolean).forEach((r) => this.assets.image(r));
      }
    }
    for (const s of doc.scenes) if (s.background?.type === 'image') this.assets.image(s.background.asset || { src: s.background.src });
    await Promise.all(jobs);
    await this.assets.whenReady();
  }

  _recompile() {
    if (!this.doc) return;
    this.C = compile(this.doc, { te: this.te, assets: this.assets, userThemes: this.userThemes, cache: this.cache });
  }

  /** Seek embedded videos to the frame at time t (await before rendering exported frames). */
  async prepareFrame(t) {
    if (!this.C) return;
    const jobs = [];
    for (const S of activeScenes(this.C, t)) for (const it of S.items) {
      if (it.inst.track && it.inst.videoTime) jobs.push(it.inst.track.seek(it.inst.videoTime(t - S.start - it.start)));
    }
    if (jobs.length) await Promise.all(jobs);
  }

  get duration() { return this.C?.duration || 0; }
  get scenes() { return this.C?.scenes || []; }
  get issues() { return this.C?.issues || []; }

  /** Render at time t into a context (or the engine's own canvas). */
  render(t, ctx = this.canvas?.getContext('2d'), opts = {}) {
    if (!this.C || !ctx) return;
    const scale = opts.scale ?? ctx.canvas.width / this.C.env.W;
    renderFrame(ctx, this.C, t, { ...opts, scale });
  }

  sceneAt(t) { const a = this.C ? activeScenes(this.C, t) : []; return a[a.length - 1] || null; }
  sceneStart(id) { return this.C?.scenes.find((s) => s.id === id)?.start ?? 0; }
  settledTimeOf(id) { const S = this.C?.scenes.find((s) => s.id === id); return S ? S.start + settledTime(S) : 0; }

  /** Rectangles of every block in the scene active at t (design coordinates). */
  layoutAt(t) {
    const S = this.sceneAt(t);
    if (!S) return [];
    return S.items.map((it) => ({ id: it.block.id, type: it.block.type, rect: it.rect, start: S.start + it.start, duration: it.inst.duration, framed: !!it.block.frame && typeof it.block.frame === 'object', bleed: it.bleed }));
  }

  /** Timing of every scene and its blocks (scene-relative block starts), for timelines. */
  timing() {
    if (!this.C) return { duration: 0, scenes: [] };
    return {
      duration: this.C.duration,
      scenes: this.C.scenes.map((S) => ({
        id: S.id, index: S.index, start: S.start, duration: S.duration, end: S.end, settled: S.start + settledTime(S),
        contentEnd: S.contentEnd, layout: S.layout, tone: S.tone, transition: S.transitionIn ? { type: S.transitionIn.type, duration: S.transitionIn.duration } : null,
        items: S.items.map((it) => ({ id: it.block.id, type: it.block.type, start: it.start, duration: it.inst.duration, rect: it.rect, bleed: it.bleed, framed: !!it.block.frame && typeof it.block.frame === 'object' })),
      })),
    };
  }

  /** Layout rectangles of one scene (design coordinates), regardless of the current time. */
  layoutOf(sceneId) {
    const S = this.C?.scenes.find((s) => s.id === sceneId);
    return S ? S.items.map((it) => ({ id: it.block.id, type: it.block.type, rect: it.rect, framed: !!it.block.frame && typeof it.block.frame === 'object', bleed: it.bleed })) : [];
  }

  hitTest(x, y, t) {
    const items = this.layoutAt(t).filter((i) => !i.bleed);
    for (let k = items.length - 1; k >= 0; k--) {
      const r = items[k].rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return items[k].id;
    }
    const bleed = this.layoutAt(t).find((i) => i.bleed);
    return bleed ? bleed.id : null;
  }
}

export { normalizeDocument, settledTime };
