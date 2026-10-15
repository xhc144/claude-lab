// Renders the application icon procedurally (Canvas 2D in headless Chromium) at every size
// Windows uses, then writes build/icon.png and a PNG-compressed multi-resolution build/icon.ico.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512];

const draw = `(S) => {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = S * 0.47;
  // deep-space disc
  const bg = g.createRadialGradient(cx, cy * 0.92, R * 0.1, cx, cy, R);
  bg.addColorStop(0, '#2a1d5e'); bg.addColorStop(0.55, '#110c2c'); bg.addColorStop(1, '#05040f');
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // background stars
  const nStars = S >= 64 ? Math.round(S * 0.6) : 0;
  for (let i = 0; i < nStars; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + rnd() * 0.6) + ')'; const r = rnd() * S * 0.004 + S * 0.0015; g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'lighter';
  // particle ring (tilted accretion disc)
  const tilt = -0.42, rx = R * 0.78, ry = R * 0.3;
  const cols = [[126, 240, 255], [157, 140, 255], [255, 122, 209]];
  const n = S >= 128 ? 5200 : S >= 48 ? 900 : 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = 0.82 + 0.28 * Math.pow(rnd(), 0.6) * (rnd() < 0.5 ? -1 : 1) * 0.6;
    const x0 = Math.cos(a) * rx * rr, y0 = Math.sin(a) * ry * rr + (rnd() - 0.5) * S * 0.02;
    const x = cx + x0 * Math.cos(tilt) - y0 * Math.sin(tilt), y = cy + x0 * Math.sin(tilt) + y0 * Math.cos(tilt);
    const t = (Math.cos(a + 0.6) + 1) / 2;
    const c0 = t < 0.5 ? cols[0] : cols[1], c1 = t < 0.5 ? cols[1] : cols[2], k = (t % 0.5) * 2;
    const col = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    const front = Math.sin(a) > 0 ? 1 : 0.55;
    g.fillStyle = 'rgba(' + col.join(',') + ',' + (0.18 * front) + ')';
    const pr = S * (0.004 + rnd() * 0.006);
    g.beginPath(); g.arc(x, y, pr, 0, 7); g.fill();
  }
  // solid ring for small sizes / extra definition
  g.lineWidth = Math.max(1.2, S * (S >= 128 ? 0.018 : 0.07));
  const lg = g.createLinearGradient(cx - rx, cy, cx + rx, cy);
  lg.addColorStop(0, '#7ef0ff'); lg.addColorStop(0.5, '#9d8cff'); lg.addColorStop(1, '#ff7ad1');
  g.strokeStyle = lg; g.globalAlpha = S >= 128 ? 0.55 : 1;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
  // core glow
  const core = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5);
  core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(0.12, 'rgba(220,250,255,0.95)');
  core.addColorStop(0.35, 'rgba(126,200,255,0.35)'); core.addColorStop(1, 'rgba(126,140,255,0)');
  g.fillStyle = core; g.beginPath(); g.arc(cx, cy, R * 0.5, 0, 7); g.fill();
  // front arc of the ring over the core
  g.lineWidth = Math.max(1, S * (S >= 128 ? 0.012 : 0.05));
  g.strokeStyle = lg; g.globalAlpha = 0.9;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, tilt, 0.15, Math.PI - 0.15); g.stroke();
  g.globalAlpha = 1;
  // sparkles
  if (S >= 32) {
    for (const [px, py, s] of [[0.79, 0.24, 0.05], [0.2, 0.74, 0.035]]) {
      const x = px * S, y = py * S, r = s * S;
      const sg = g.createRadialGradient(x, y, 0, x, y, r);
      sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(1, 'rgba(255,180,240,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }
  g.restore();
  // rim light
  g.globalCompositeOperation = 'source-over';
  g.lineWidth = Math.max(1, S * 0.012);
  g.strokeStyle = 'rgba(190, 200, 255, 0.35)';
  g.beginPath(); g.arc(cx, cy, R - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
  return c.toDataURL('image/png');
}`;

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();
const pngs = {};
for (const s of sizes) {
  const url = await page.evaluate(`(${draw})(${s})`);
  pngs[s] = Buffer.from(url.split(',')[1], 'base64');
}
await browser.close();

fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build/icon.png'), pngs[512]);
fs.writeFileSync(path.join(root, 'build/icon-256.png'), pngs[256]);
const icoSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s >= 256 ? 0 : s, e); header.writeUInt8(s >= 256 ? 0 : s, e + 1);
  header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[s].length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += pngs[s].length;
});
fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([header, ...icoSizes.map((s) => pngs[s])]));
// favicon for the web build
fs.mkdirSync(path.join(root, 'src/renderer/assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/renderer/assets/icon-64.png'), pngs[64]);
console.log('icons written:', icoSizes.join(', '));
