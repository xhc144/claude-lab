// Pre-renders the built-in demo track «极光 Aurora» (src/renderer/audio/demo.js) to an Opus file
// shipped with the app. Synthesising it at run time takes 20–30 s on a fast CPU and many minutes
// without a GPU (software rendering competes for the CPU); decoding the file takes well under a
// second. The synthesiser stays the source of truth and the fallback if the file is missing.
//
//   node scripts/make-demo-audio.mjs     (needs ffmpeg with libopus, and Chromium for Playwright)
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src/renderer/assets/demo-aurora.ogg');
const SR = 48000;

const executablePath = process.env.CHROMIUM_PATH || (process.env.PLAYWRIGHT_BROWSERS_PATH ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
await page.goto('about:blank');
const t0 = Date.now();
const b64 = await page.evaluate(async ({ code, SR }) => {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const { renderDemoTrack } = await import(url);
  const buf = await renderDemoTrack(SR);
  const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
  const pcm = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767;
    pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}, { code: readFileSync(path.join(root, 'src/renderer/audio/demo.js'), 'utf8'), SR });
await browser.close();
console.log(`synthesised in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const dir = mkdtempSync(path.join(tmpdir(), 'pu-demo-'));
try {
  const raw = path.join(dir, 'demo.s16le');
  writeFileSync(raw, Buffer.from(b64, 'base64'));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', String(SR), '-ac', '2', '-i', raw,
    '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-application', 'audio', '-map_metadata', '-1', '-fflags', '+bitexact', out], { stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`${path.relative(root, out)}  ${(statSync(out).size / 1e6).toFixed(2)} MB`);
