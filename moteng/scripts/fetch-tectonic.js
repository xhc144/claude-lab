// Downloads the Tectonic TeX engine into vendor/tectonic/ for bundling.
//   node scripts/fetch-tectonic.js            (current platform)
//   TECTONIC_SHA256=<hex> node scripts/fetch-tectonic.js   (verify the archive)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { unzipSync } from 'fflate';

const VERSION = process.env.TECTONIC_VERSION || '0.17.0';
const TARGETS = {
  'win32-x64': `tectonic-${VERSION}-x86_64-pc-windows-msvc.zip`,
  'linux-x64': `tectonic-${VERSION}-x86_64-unknown-linux-musl.tar.gz`,
  'linux-arm64': `tectonic-${VERSION}-aarch64-unknown-linux-musl.tar.gz`,
  'darwin-x64': `tectonic-${VERSION}-x86_64-apple-darwin.tar.gz`,
  'darwin-arm64': `tectonic-${VERSION}-aarch64-apple-darwin.tar.gz`,
};

const key = `${process.platform}-${process.arch}`;
const asset = TARGETS[key];
if (!asset) {
  console.error(`没有 ${key} 平台的 Tectonic 预编译包`);
  process.exit(1);
}
const url = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${VERSION}/${asset}`;
const outDir = path.resolve(import.meta.dirname, '../vendor/tectonic');
const exe = path.join(outDir, process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');

function untar(buf) {
  const files = {};
  for (let p = 0; p + 512 <= buf.length;) {
    const name = buf.subarray(p, p + 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(buf.subarray(p + 124, p + 136).toString('utf8').replace(/\0.*$/s, '').trim() || '0', 8);
    const type = String.fromCharCode(buf[p + 156] || 48);
    if (type === '0' || type === '\0') files[name] = buf.subarray(p + 512, p + 512 + size);
    p += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

if (fs.existsSync(exe) && !process.argv.includes('--force')) {
  console.log(`已存在：${exe}`);
  process.exit(0);
}
console.log(`下载 ${url}`);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`下载失败：HTTP ${res.status}`);
  process.exit(1);
}
const archive = Buffer.from(await res.arrayBuffer());
const sha = crypto.createHash('sha256').update(archive).digest('hex');
console.log(`SHA-256 ${sha}  ${asset}  (${(archive.length / 1048576).toFixed(1)} MB)`);
if (process.env.TECTONIC_SHA256 && process.env.TECTONIC_SHA256.toLowerCase() !== sha) {
  console.error('校验和不符，已停止');
  process.exit(1);
}
const files = asset.endsWith('.zip') ? unzipSync(new Uint8Array(archive)) : untar(zlib.gunzipSync(archive));
const entry = Object.keys(files).find((n) => /(^|\/)tectonic(\.exe)?$/.test(n));
if (!entry) {
  console.error('压缩包里没有 tectonic 可执行文件：' + Object.keys(files).join(', '));
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(exe, files[entry]);
fs.chmodSync(exe, 0o755);
fs.writeFileSync(path.join(outDir, 'VERSION.txt'), `tectonic ${VERSION}\n${asset}\nsha256 ${sha}\n${url}\n`);
console.log(`已保存：${exe}`);
