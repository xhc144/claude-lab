// Renders the 鸿雁 mark to PNG / ICO / BMP assets in build/ using headless Chromium.
// Usage: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build');
fs.mkdirSync(out, { recursive: true });

const GOOSE = 'M8 42 C16 39.5 24 37 30 34.5 C27 26 21 18 11 11.5 C24 13.5 34 21 38.5 31 C42.5 27.5 46.5 23.5 50.5 20.2 C52.6 18.4 55.4 18.6 56.6 20.4 L61.5 22 L56.3 23.2 C52.8 25.4 49.4 29.6 45.8 33.6 C39.5 40 29 43.2 18.5 43.2 C14.6 43.2 11 42.8 8 42 Z';

/** App icon: full-bleed squircle (a little inset so Windows' tile plates look balanced). */
function iconSvg(size, { inset = 2, radius = 17 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ef7350"/><stop offset=".55" stop-color="#d2412a"/><stop offset="1" stop-color="#a92d1b"/></linearGradient>
    <linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="${inset}" y="${inset}" width="${64 - 2 * inset}" height="${64 - 2 * inset}" rx="${radius}" fill="url(#g)"/>
  <rect x="${inset}" y="${inset}" width="${64 - 2 * inset}" height="${64 - 2 * inset}" rx="${radius}" fill="url(#h)"/>
  <path d="${GOOSE}" fill="#fff" transform="translate(-2.6 4.4)"/>
</svg>`;
}

function ico(pngs) {
  // ICO container with PNG-compressed images (supported since Windows Vista).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderSvg(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  return page.locator('svg').screenshot({ omitBackground: true });
}

const icoSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const pngs = [];
for (const s of icoSizes) {
  // small sizes: fill more of the canvas so the mark stays legible
  const svg = s <= 24 ? iconSvg(s, { inset: 0.5, radius: 15 }) : iconSvg(s);
  pngs.push({ size: s, data: await renderSvg(svg, s) });
}
fs.writeFileSync(path.join(out, 'icon.ico'), ico(pngs));
fs.writeFileSync(path.join(out, 'icon.png'), await renderSvg(iconSvg(512), 512));
const trayPngs = [16, 20, 24, 32, 40, 48].map((s) => pngs.find((p) => p.size === s) || null).filter(Boolean);
fs.writeFileSync(path.join(out, 'tray.ico'), ico(trayPngs));
fs.writeFileSync(path.join(out, 'tray.png'), pngs.find((p) => p.size === 32).data);

// NSIS wizard bitmaps (24-bit BMP): sidebar 164x314 and header 150x57.
async function bmp(width, height, html) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
  // decode the PNG in the page via canvas to get raw pixels
  const pixels = await page.evaluate(async ({ data, width, height }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, width, height).data);
  }, { data: png.toString('base64'), width, height });
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const body = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = ((height - 1 - y) * width + x) * 4;
      const di = y * rowSize + x * 3;
      body[di] = pixels[si + 2];
      body[di + 1] = pixels[si + 1];
      body[di + 2] = pixels[si];
    }
  }
  const head = Buffer.alloc(54);
  head.write('BM', 0);
  head.writeUInt32LE(54 + body.length, 2);
  head.writeUInt32LE(54, 10);
  head.writeUInt32LE(40, 14);
  head.writeInt32LE(width, 18);
  head.writeInt32LE(height, 22);
  head.writeUInt16LE(1, 26);
  head.writeUInt16LE(24, 28);
  head.writeUInt32LE(body.length, 34);
  head.writeInt32LE(2835, 38);
  head.writeInt32LE(2835, 42);
  return Buffer.concat([head, body]);
}

const font = `font-family:'Segoe UI','Microsoft YaHei UI','Noto Sans CJK SC',sans-serif`;
fs.writeFileSync(path.join(out, 'installer-sidebar.bmp'), await bmp(164, 314, `
  <div style="width:164px;height:314px;position:relative;overflow:hidden;background:linear-gradient(165deg,#f6f2ea 0%,#efe8dc 55%,#e9dfcf 100%);${font}">
    <div style="position:absolute;width:260px;height:260px;border-radius:50%;right:-120px;top:-90px;background:radial-gradient(circle,rgba(208,67,42,.18),transparent 65%)"></div>
    <div style="position:absolute;left:22px;top:34px">${iconSvg(52)}</div>
    <div style="position:absolute;left:22px;top:100px;font-size:26px;font-weight:700;letter-spacing:5px;color:#1c1a17">鸿雁</div>
    <div style="position:absolute;left:23px;top:136px;font-size:11px;letter-spacing:3px;color:#8b857a">HONGYAN MAIL</div>
    <svg style="position:absolute;left:0;bottom:0" width="164" height="110" viewBox="0 0 164 110">
      <path d="M0 70 C 20 52, 40 50, 60 60 C 80 70, 96 44, 116 42 C 136 40, 150 58, 164 54 L164 110 L0 110 Z" fill="#1c1a17" fill-opacity=".12"/>
      <path d="M0 88 C 24 76, 44 72, 70 80 C 92 86, 116 70, 140 74 C 150 76, 158 78, 164 78 L164 110 L0 110 Z" fill="#1c1a17" fill-opacity=".18"/>
      <circle cx="122" cy="22" r="10" fill="#d0432a" fill-opacity=".85"/>
    </svg>
  </div>`));
fs.writeFileSync(path.join(out, 'installer-header.bmp'), await bmp(150, 57, `
  <div style="width:150px;height:57px;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-right:10px;box-sizing:border-box;background:#ffffff;${font}">
    <span style="font-size:15px;font-weight:700;letter-spacing:3px;color:#1c1a17">鸿雁邮箱</span>${iconSvg(34)}
  </div>`));

await browser.close();
console.log('icons written to', out, fs.readdirSync(out).join(', '));
