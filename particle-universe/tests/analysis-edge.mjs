// Analyser robustness on degenerate inputs: silence, noise, pure tone, very short clips, a 90 BPM groove.
import assert from 'node:assert/strict';
import { analyze } from '../src/renderer/audio/analysis.js';

const sr = 48000;
const groove = (bpm, seconds) => {
  const a = new Float32Array(sr * seconds), beat = 60 / bpm;
  for (let t = 0; t < seconds; t += beat) {
    const s = Math.floor(t * sr);
    for (let i = 0; i < 9000 && s + i < a.length; i++) a[s + i] += Math.sin((2 * Math.PI * (60 + 100 * Math.exp(-i / 800)) * i) / sr) * Math.exp(-i / 4000) * 0.8;
  }
  return a;
};
const cases = {
  silence: [new Float32Array(sr * 20), (r) => { assert.equal(r.kicks.length, 0); assert.ok(r.tempoConf < 1.15); }],
  noise: [Float32Array.from({ length: sr * 20 }, () => (Math.random() - 0.5) * 0.5), () => {}],
  sine: [Float32Array.from({ length: sr * 30 }, (_, i) => Math.sin((i * 2 * Math.PI * 220) / sr) * 0.3), (r) => assert.equal(r.kicks.length, 0)],
  short: [Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i * 0.05)), () => {}],
  tiny: [new Float32Array(10), () => {}],
  groove90: [groove(90, 30), (r) => { assert.ok(Math.abs(r.bpm - 90) < 1.5, 'bpm ' + r.bpm); assert.ok(r.kicks.length / 2 > 35); }]
};
let failed = 0;
for (const [name, [samples, check]] of Object.entries(cases)) {
  try {
    const r = analyze(samples, sr);
    for (const x of r.feat) assert.ok(Number.isFinite(x), 'non-finite feature');
    for (const x of r.spec) assert.ok(x >= 0 && x <= 255);
    check(r);
    console.log('ok  ', name.padEnd(9), `bpm ${r.bpm.toFixed(1)} conf ${r.tempoConf.toFixed(2)} kicks ${r.kicks.length / 2} drops ${r.drops.length}`);
  } catch (e) {
    failed++;
    console.log('FAIL', name, e.message);
  }
}
process.exit(failed ? 1 : 0);
