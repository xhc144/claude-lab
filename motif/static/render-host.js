// Page-side helpers used by the render worker and tests. Exposes window.MotifHost.
(function () {
  const canvas = document.getElementById('c');
  let engine = null;
  const base = location.href.replace(/[^/]*$/, '');
  window.MotifHost = {
    async load(doc, opts = {}) {
      engine = new Motif.MotifEngine({
        resolveUrl: (a) => {
          const f = a.file || a.src;
          if (!f) return null;
          if (/^(https?:|data:|blob:|motif:|file:)/.test(f)) return f;
          if (opts.assetBase) return opts.assetBase.replace(/\/?$/, '/') + f.replace(/^\/+/, '');
          return base + f;
        },
        userThemes: opts.userThemes || {},
      });
      const C = await engine.setDocument(doc);
      const scale = opts.scale || 1;
      canvas.width = Math.round(C.env.W * scale);
      canvas.height = Math.round(C.env.H * scale);
      return {
        duration: engine.duration,
        width: canvas.width, height: canvas.height,
        scenes: engine.scenes.map((s) => ({ id: s.id, start: s.start, duration: s.duration, layout: s.layout, tone: s.tone, settled: s.start + Motif.settledTime(s), transition: s.transitionIn })),
        issues: engine.issues,
      };
    },
    async ready() { await engine.assets.whenReady(); },
    render(t) {
      const ctx = canvas.getContext('2d');
      engine.render(t, ctx, { scale: canvas.width / engine.C.env.W });
    },
    png(t) { this.render(t); return canvas.toDataURL('image/png'); },
    jpeg(t, q = 0.9) { this.render(t); return canvas.toDataURL('image/jpeg', q); },
    rgba(t) { this.render(t); const ctx = canvas.getContext('2d'); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; },
    layout(t) { return engine.layoutAt(t); },
    lint() { return Motif.lintCompiled(engine.C, engine.assets); },
    get engine() { return engine; },
  };
})();
