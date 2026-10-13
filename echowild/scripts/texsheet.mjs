#!/usr/bin/env node
// Dev tool: render every block texture into one labelled PNG contact sheet for art review.
//   node scripts/texsheet.mjs [out.png] [scale]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { buildBlockTextures } from '../src/render/textures.js';

const out = process.argv[2] || 'texsheet.png';
const SC = Number(process.argv[3] || 4);
const t = buildBlockTextures();
const COLS = 24;
const cell = 16 * SC + 4;
const rows = Math.ceil(t.layers / COLS);
const W = COLS * cell, H = rows * cell;
const img = new Uint8Array(W * H * 4);
for (let k = 0; k < img.length; k += 4) { img[k] = 40; img[k + 1] = 44; img[k + 2] = 52; img[k + 3] = 255; }
for (let l = 0; l < t.layers; l++) {
  const ox = (l % COLS) * cell + 2, oy = Math.floor(l / COLS) * cell + 2;
  for (let y = 0; y < 16 * SC; y++) for (let x = 0; x < 16 * SC; x++) {
    const s = (l * 256 + Math.floor(y / SC) * 16 + Math.floor(x / SC)) * 4;
    const a = t.data[s + 3] / 255;
    const checker = ((x >> 3) + (y >> 3)) % 2 ? 90 : 120;
    const d = ((oy + y) * W + ox + x) * 4;
    for (let c = 0; c < 3; c++) img[d + c] = t.data[s + c] * a + checker * (1 - a);
    if (t.data[s + 3] >= 128 && t.data[s + 3] < 251) { img[d] = Math.min(255, img[d] + 0); img[d + 2] = Math.min(255, img[d + 2]); }
  }
}
function png(w, h, rgba) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4); data.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
writeFileSync(out, png(W, H, img));
console.log(`${out}: ${t.layers} textures, ${W}x${H}`);
console.log(t.names.map((n, i) => `${i}:${n}`).join(' '));
