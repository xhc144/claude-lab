// End-to-end self test (`--smoke`): demo track → analysis → every scene → short export.
import { platform } from './platform.js';
import { SCENES } from '../scenes/index.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSmoke(app) {
  const log = (m) => platform.smoke.log(m);
  const q = new URLSearchParams(location.search);
  const result = { ok: false, steps: [], scenes: {}, gpu: app.engine.gpu, tier: app.engine.tierIndex };
  const t0 = performance.now();
  try {
    const info = await platform.info();
    result.info = info;
    log('gpu ' + app.engine.gpu);
    await app.playDemo();
    result.steps.push('demo-loaded');
    result.analysis = { bpm: app.track.analysis.bpm, beats: app.track.analysis.beats.length, drops: Array.from(app.track.analysis.drops), sections: app.track.analysis.sections.length, kicks: app.track.analysis.kicks.length / 2 };
    log('analysis ' + JSON.stringify(result.analysis));
    app.set('scene.autoSwitch', 'off');
    app.seek(42);
    const per = Number(q.get('sceneMs') || 3500);
    for (const s of SCENES) {
      app.setScene(s.id);
      const fpsSamples = [];
      const start = performance.now();
      while (performance.now() - start < per) { await wait(250); fpsSamples.push(app.stats.fps); }
      result.scenes[s.id] = { fps: Math.round(fpsSamples.slice(2).reduce((a, b) => a + b, 0) / Math.max(1, fpsSamples.length - 2)), tier: app.engine.tierIndex, particles: app.engine.particles.count };
      log(`scene ${s.id} ${JSON.stringify(result.scenes[s.id])}`);
    }
    result.steps.push('scenes');
    if (platform.electron && q.get('export') !== '0') {
      const out = info.smokeDir + (navigator.userAgent.includes('Windows') ? '\\' : '/') + 'particle-universe-smoke.' + (q.get('format') || 'mp4');
      const orig = platform.videoWriter;
      platform.videoWriter = async (name, ext) => {
        const p = out.replace(/\.(mp4|webm)$/, '.' + ext);
        const id = await window.pu.fileOpen(p);
        const pend = new Set();
        return {
          path: p,
          write(d, pos) { const pr = window.pu.fileWrite(id, d.slice(), pos); pend.add(pr); pr.finally(() => pend.delete(pr)); },
          async close() { await Promise.all([...pend]); await window.pu.fileClose(id); },
          async abort() { await Promise.all([...pend]); await window.pu.fileClose(id); }
        };
      };
      app.set('scene.autoSwitch', 'music');
      const res = await app.exporter.run({ w: 1280, h: 720, fps: 30, quality: 'standard', format: q.get('format') || 'mp4', start: 40, end: 46, tier: Math.min(app.engine.tierIndex, 3), name: 'smoke', onProgress: (p) => { if (p.frame % 30 === 0) log(`export ${p.frame}/${p.total} ${p.speed.toFixed(2)}x`); } });
      platform.videoWriter = orig;
      const st = await window.pu.statFile(res.path);
      result.export = { ...res, bytes: st ? st.size : 0 };
      log('export ' + JSON.stringify(result.export));
      result.steps.push('export');
    }
    result.ok = true;
  } catch (e) {
    result.error = String(e && (e.stack || e.message) || e);
  }
  result.seconds = (performance.now() - t0) / 1000;
  platform.smoke.result(result);
}
