// Off-screen previews of whole documents (template gallery, imports): one engine, a serial queue,
// and an animated mode for hover previews.
import { MotifEngine } from '../../../engine/index.js';
import { normalizeDocument } from '../../../core/doc.js';
import { fileUrl } from '../editor/store.js';

let chain = Promise.resolve();
const engines = new Map();

function engineFor(assetBase) {
  const key = assetBase || '';
  if (!engines.has(key)) {
    engines.set(key, new MotifEngine({
      resolveUrl: (a) => {
        const f = a.file || a.src;
        if (!f) return null;
        if (/^(https?:|data:|blob:|motif:)/.test(f)) return f;
        if (/^([a-zA-Z]:[\\/]|\/)/.test(f)) return fileUrl(f);
        return assetBase ? assetBase + f : null;
      },
    }));
  }
  return engines.get(key);
}

/** Render the settled frame of one scene of `doc` into `canvas` (CSS width decides resolution). */
export function renderThumb(doc, canvas, { scene = 0, assetBase, width } = {}) {
  chain = chain.then(async () => {
    if (!canvas.isConnected) return;
    const eng = engineFor(assetBase);
    const d = normalizeDocument(doc).doc;
    await eng.setDocument(d, { normalized: true });
    const tm = eng.timing().scenes[Math.min(scene, eng.timing().scenes.length - 1)];
    if (!tm) return;
    const W = eng.C.env.W, H = eng.C.env.H;
    const cssW = width || canvas.clientWidth || 320;
    const s = (cssW * Math.min(2, devicePixelRatio || 1)) / W;
    canvas.width = Math.round(W * s); canvas.height = Math.round(H * s);
    eng.render(tm.settled, canvas.getContext('2d'), { scale: s, noCamera: true });
  }).catch((e) => console.warn('preview', e));
  return chain;
}

/** Play `doc` in a loop on `canvas` until the returned stop() is called. */
export function playPreview(doc, canvas, { assetBase } = {}) {
  let stopped = false, raf = 0;
  const eng = new MotifEngine({ resolveUrl: engineFor(assetBase).assets.resolveUrl });
  (async () => {
    await eng.setDocument(normalizeDocument(doc).doc, { normalized: true });
    const W = eng.C.env.W;
    const s = (canvas.clientWidth * Math.min(2, devicePixelRatio || 1)) / W;
    const D = Math.min(eng.duration, 24);
    const t0 = performance.now();
    const loop = (now) => {
      if (stopped) return;
      const t = ((now - t0) / 1000) % D;
      if (canvas.width !== Math.round(W * s)) { canvas.width = Math.round(W * s); canvas.height = Math.round(eng.C.env.H * s); }
      eng.render(t, canvas.getContext('2d'), { scale: s });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  })();
  return () => { stopped = true; cancelAnimationFrame(raf); };
}
