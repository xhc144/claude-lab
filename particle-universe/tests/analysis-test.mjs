// Renders the built-in demo track once (Chromium OfflineAudioContext) and runs the analyser in Node.
import fs from 'node:fs';
import { analyze, DEBUG } from '../src/renderer/audio/analysis.js';
const wav = 'test-output/demo.f32';
if (!fs.existsSync(wav) || process.argv.includes('--fresh')) {
  const { chromium } = await import('playwright-core');
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: 'vite.config.mjs', server: { port: 5199 }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  await page.goto('http://localhost:5199/dev/engine-test.html?scene=none');
  const b64 = await page.evaluate(async () => {
    const { renderDemoTrack } = await import('/audio/demo.js');
    const buf = await renderDemoTrack(48000);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const m = new Float32Array(L.length);
    for (let i = 0; i < m.length; i++) m[i] = (L[i] + R[i]) * 0.5;
    let s = ''; const u8 = new Uint8Array(m.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  });
  fs.mkdirSync('test-output', { recursive: true });
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  await browser.close(); await server.close();
}
const buf = fs.readFileSync(wav);
const samples = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const t0 = performance.now();
const r = analyze(samples, 48000);
console.log('analysis ms', (performance.now() - t0).toFixed(0), 'frames', r.frames);
const bar = 240 / 124;
console.log('bpm', r.bpm.toFixed(2), 'conf', r.tempoConf.toFixed(2), 'beats', r.beats.length, 'downbeats', r.downbeats.length, 'first downbeats', Array.from(r.downbeats.slice(0, 4)).map((v) => v.toFixed(2)).join(','));
console.log('drops', Array.from(r.drops).map((v) => `${v.toFixed(2)}s (bar ${(v / bar).toFixed(2)})`).join(', '), ' expected bar 20 (38.71s) and bar 48 (92.90s)');
console.log('sections', Array.from(r.sections).map((v) => (v / bar).toFixed(1)).join(', '));
console.log('kicks', r.kicks.length / 2, 'snares', r.snares.length / 2, 'hats', r.hats.length / 2);
// kick timing accuracy against the score: kicks expected on every beat in groove/drops
const beat = 60 / 124;
let errs = [];
for (let i = 0; i < r.kicks.length / 2; i++) { const t = r.kicks[i * 2]; const nearest = Math.round(t / beat) * beat; errs.push((t - nearest) * 1000); }
errs.sort((a, b) => a - b);
console.log('kick offset ms median', errs[errs.length >> 1].toFixed(1), 'p10', errs[Math.floor(errs.length * 0.1)].toFixed(1), 'p90', errs[Math.floor(errs.length * 0.9)].toFixed(1));

console.log('phase', JSON.stringify(DEBUG.phase));
for (const d of DEBUG.drops) if ([2, 8, 16, 20, 36, 44, 48, 64].some((b) => Math.abs(d.t / bar - b) < 0.3)) console.log('bar', (d.t / bar).toFixed(2), Object.entries(d).map(([k, v]) => k + '=' + v.toFixed(3)).join(' '));
{
  const off = Array.from(r.beats).map((b) => { let o = (b % beat) / beat; return o; });
  const hist = new Array(10).fill(0); off.forEach((o) => hist[Math.min(9, Math.floor(o * 10))]++);
  console.log('beat phase histogram (fraction of beat)', hist.join(' '));
  const ko = []; for (let i = 0; i < r.kicks.length / 2; i++) ko.push((r.kicks[i * 2] % beat) / beat);
  const kh = new Array(10).fill(0); ko.forEach((o) => kh[Math.min(9, Math.floor(o * 10))]++);
  console.log('kick phase histogram', kh.join(' '));
}
