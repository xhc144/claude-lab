// Runs inside the hidden render window. Fetches a job from the main process, renders with the
// same engine as the editor, and streams frames/files back. Every exported frame is produced by
// engine.render(t) — identical to what the editor previews.
(async function () {
  const W = window.motifWorker;
  if (!W) return;
  const canvas = document.getElementById('c');
  const toBuf = (type, q) => new Promise((res) => canvas.toBlob((b) => b.arrayBuffer().then(res), type, q));
  let job;
  try {
    job = await W.job();
    const info = await MotifHost.load(job.doc, { scale: job.scale || 1, assetBase: job.assetBase, userThemes: job.userThemes || {} });
    const engine = MotifHost.engine;
    const ctx = canvas.getContext('2d', { willReadFrequently: job.type === 'video' });
    const scenes = info.scenes;
    const render = async (t) => { await engine.prepareFrame(t); engine.render(t, ctx, { scale: canvas.width / engine.C.env.W }); };
    const timeOf = (spec) => {
      if (typeof spec === 'number') return spec;
      const m = /^(?:scene:)?(\d+|s_[a-z0-9]+)(?:@(end|start|mid|[\d.]+))?$/.exec(String(spec));
      if (!m) return Number(spec) || 0;
      const sc = /^\d+$/.test(m[1]) ? scenes[Number(m[1]) - 1] : scenes.find((s) => s.id === m[1]);
      if (!sc) return 0;
      const at = m[2] || 'end';
      if (at === 'end') return sc.settled;
      if (at === 'start') return sc.start + 0.05;
      if (at === 'mid') return sc.start + sc.duration / 2;
      return sc.start + Number(at);
    };
    switch (job.type) {
      case 'info': {
        const lint = MotifHost.lint ? MotifHost.lint() : [];
        const layouts = scenes.map((s) => ({ id: s.id, layout: s.layout, tone: s.tone, start: s.start, duration: s.duration, items: engine.layoutAt(s.settled) }));
        return await W.done({ ok: true, info: { duration: info.duration, width: info.width, height: info.height, scenes, issues: info.issues, lint, layouts } });
      }
      case 'stills': {
        const specs = job.times?.length ? job.times : scenes.map((_, i) => `${i + 1}@end`);
        const files = [];
        for (let i = 0; i < specs.length; i++) {
          const t = timeOf(specs[i]);
          await render(t);
          const name = (job.names && job.names[i]) || `frame-${String(i + 1).padStart(3, '0')}.${job.jpeg ? 'jpg' : 'png'}`;
          await W.file(name, await toBuf(job.jpeg ? 'image/jpeg' : 'image/png', 0.92));
          files.push({ name, t });
          W.progress({ done: i + 1, total: specs.length });
        }
        return await W.done({ ok: true, files, duration: info.duration });
      }
      case 'sheet': {
        // contact sheet: settled frame of every scene in a grid, with scene numbers
        const n = scenes.length;
        const cols = job.cols || (n <= 4 ? 2 : n <= 9 ? 3 : 4);
        const rows = Math.ceil(n / cols);
        const cw = canvas.width, ch = canvas.height;
        const tile = document.createElement('canvas');
        tile.width = cw; tile.height = ch;
        const sheetScale = Math.min(1, (job.maxWidth || 2400) / (cols * cw));
        const out = document.createElement('canvas');
        const gap = 16, label = 34;
        out.width = Math.round(cols * cw * sheetScale + gap * (cols + 1));
        out.height = Math.round(rows * (ch * sheetScale + label) + gap * (rows + 1));
        const g = out.getContext('2d');
        g.fillStyle = '#16171a'; g.fillRect(0, 0, out.width, out.height);
        for (let i = 0; i < n; i++) {
          const s = scenes[i];
          await render(s.settled);
          const x = gap + (i % cols) * (cw * sheetScale + gap), y = gap + Math.floor(i / cols) * (ch * sheetScale + label + gap);
          g.fillStyle = '#e8e8ea'; g.font = '600 18px "Motif Inter", "Motif Sans SC", sans-serif'; g.textBaseline = 'middle';
          g.fillText(`${i + 1}. ${s.id} · ${s.layout} · ${s.duration.toFixed(1)}s`, x + 2, y + label / 2);
          g.drawImage(canvas, x, y + label, cw * sheetScale, ch * sheetScale);
          W.progress({ done: i + 1, total: n });
        }
        canvas.width = out.width; canvas.height = out.height;
        canvas.getContext('2d').drawImage(out, 0, 0);
        await W.file(job.name || 'sheet.png', await toBuf(job.jpeg ? 'image/jpeg' : 'image/png', 0.88));
        return await W.done({ ok: true, files: [{ name: job.name || 'sheet.png' }], scenes: scenes.length, duration: info.duration });
      }
      case 'video': case 'frames': {
        const fps = job.fps || job.doc.format.fps || 30;
        let f0, f1;
        if (job.frameRange) { f0 = job.frameRange[0]; f1 = job.frameRange[1]; }
        else {
          const t0 = job.range?.[0] ?? 0, t1 = Math.min(job.range?.[1] ?? info.duration, info.duration);
          f0 = Math.round(t0 * fps); f1 = Math.max(f0 + 1, Math.round(t1 * fps));
        }
        const total = f1 - f0;
        const plan = await W.frame({ begin: true, width: canvas.width, height: canvas.height, fps, total, duration: total / fps, start: f0 / fps, scenes });
        const direct = job.type === 'video' && plan && plan.exe && W.encoderStart;
        if (direct) W.encoderStart(plan.exe, plan.args);
        const prof = job.profile ? {} : null;
        for (let i = 0; i < total; i++) {
          const t = (f0 + i) / fps;
          const pa = performance.now();
          await render(t);
          if (prof) { const sc = engine.sceneAt(t)?.id || '?'; prof[sc] = (prof[sc] || 0) + performance.now() - pa; }
          if (job.type === 'frames') await W.file(`frame_${String(i).padStart(5, '0')}.png`, await toBuf('image/png'));
          else {
            const pb = performance.now();
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const pc = performance.now();
            if (direct) await W.encoderWrite(data); else await W.frame(data);
            if (prof) { prof._read = (prof._read || 0) + pc - pb; prof._send = (prof._send || 0) + performance.now() - pc; }
          }
          if (i % 5 === 0 || i === total - 1) W.progress({ done: i + 1, total, t });
        }
        let encoded = null;
        if (direct) { W.progress({ stage: 'finalizing' }); encoded = await W.encoderEnd(); if (encoded.code !== 0) return await W.done({ ok: false, error: `FFmpeg 退出码 ${encoded.code}：${encoded.err}` }); }
        if (prof) W.progress({ profile: prof });
        return await W.done({ ok: true, frames: total, duration: total / fps, totalDuration: info.duration, profile: prof, encodedInRenderer: !!direct });
      }
      default:
        return await W.done({ ok: false, error: `未知任务类型 ${job.type}` });
    }
  } catch (e) {
    await W.done({ ok: false, error: e && e.message ? e.message : String(e), stack: e && e.stack });
  }
})();
