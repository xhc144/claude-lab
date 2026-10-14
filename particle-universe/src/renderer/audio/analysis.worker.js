import { analyze, transferList } from './analysis.js';

self.onmessage = (e) => {
  const { id, samples, sampleRate } = e.data;
  try {
    let lastP = -1;
    const result = analyze(samples, sampleRate, (p) => {
      if (p - lastP >= 0.02 || p === 1) { lastP = p; self.postMessage({ id, progress: p }); }
    });
    self.postMessage({ id, result }, transferList(result));
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
