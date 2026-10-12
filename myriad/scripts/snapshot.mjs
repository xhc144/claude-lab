#!/usr/bin/env node
// Render a world's terrain to a PNG without a browser (debugging / README images).
//   node scripts/snapshot.mjs --seed 7 --preset continents --years 0 --out out.png
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createWorld, step } from '../src/sim/world.js';
import { TerrainRenderer, S } from '../src/render/terrain.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

export function encodePNG(width, height, rgba) {
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function fakeCanvas(W, H) {
  const buf = new Uint8ClampedArray(W * H * 4);
  return {
    width: W, height: H, buf,
    getContext: () => ({
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img, x, y) => {
        for (let yy = 0; yy < img.height; yy++) {
          const ty = y + yy; if (ty >= H) break;
          for (let xx = 0; xx < img.width; xx++) {
            const tx = x + xx; if (tx >= W) continue;
            const s = (yy * img.width + xx) * 4, d = (ty * W + tx) * 4;
            buf[d] = img.data[s]; buf[d + 1] = img.data[s + 1]; buf[d + 2] = img.data[s + 2]; buf[d + 3] = 255;
          }
        }
      },
    }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = performance.now();
  const w = createWorld({ seed: Number(opt('seed', 7)), preset: opt('preset', 'continents'), size: opt('size', 'medium'), start: opt('start', 'none') });
  const t1 = performance.now();
  const ticks = Number(opt('years', 0)) * 4;
  for (let i = 0; i < ticks; i++) step(w);
  const t2 = performance.now();
  const tr = new TerrainRenderer(w, fakeCanvas);
  tr.update(1e9, 0);
  const t3 = performance.now();
  const out = opt('out', 'snapshot.png');
  writeFileSync(out, encodePNG(w.W * S, w.H * S, tr.canvas.buf));
  console.log(`gen ${(t1 - t0).toFixed(0)}ms, sim ${ticks} ticks ${(t2 - t1).toFixed(0)}ms (${((t2 - t1) / Math.max(1, ticks)).toFixed(2)} ms/tick), render ${(t3 - t2).toFixed(0)}ms → ${out}`);
}
