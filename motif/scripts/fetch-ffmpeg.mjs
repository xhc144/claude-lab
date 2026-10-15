#!/usr/bin/env node
// Downloads a pinned static FFmpeg build for packaging into vendor/ffmpeg/<platform>-<arch>/.
//   node scripts/fetch-ffmpeg.mjs [--platform win32] [--arch x64]
// Source: github.com/eugeneware/ffmpeg-static releases (LGPL/GPL static builds).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RELEASE = 'b6.1.1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const platform = arg('platform', process.platform);
const arch = arg('arch', process.arch);
const exe = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const dir = path.join(root, 'vendor', 'ffmpeg', `${platform}-${arch}`);
const dest = path.join(dir, exe);
if (fs.existsSync(dest) && fs.statSync(dest).size > 1e6) { console.log('ffmpeg present:', path.relative(root, dest)); process.exit(0); }
fs.mkdirSync(dir, { recursive: true });
const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${RELEASE}/ffmpeg-${platform}-${arch}.gz`;
const gz = path.join(dir, 'ffmpeg.gz');
console.log('downloading', url);
try {
  // curl honours the HTTPS proxy settings of CI and corporate networks; fall back to fetch
  execFileSync('curl', ['-fsSL', '--retry', '3', '-o', gz, url], { stdio: 'inherit' });
} catch {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${url}`);
  fs.writeFileSync(gz, Buffer.from(await res.arrayBuffer()));
}
fs.writeFileSync(dest, zlib.gunzipSync(fs.readFileSync(gz)));
fs.rmSync(gz);
if (platform !== 'win32') fs.chmodSync(dest, 0o755);
for (const f of ['LICENSE', 'README']) {
  try { execFileSync('curl', ['-fsSL', '-o', path.join(dir, `${f}.txt`), `https://github.com/eugeneware/ffmpeg-static/releases/download/${RELEASE}/ffmpeg-${platform}-${arch}.${f}`], { stdio: 'ignore' }); } catch { /* optional */ }
}
console.log('ffmpeg →', path.relative(root, dest), `${(fs.statSync(dest).size / 1e6).toFixed(1)} MB`);
