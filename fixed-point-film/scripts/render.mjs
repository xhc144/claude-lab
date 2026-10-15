// Frame capture: N headless Chromium pages render disjoint frame ranges and pipe JPEGs into ffmpeg.
//   node scripts/render.mjs en                 full film -> output/fixed_point_en.mp4
//   node scripts/render.mjs en --still 3,40.5  PNG stills -> build/stills/
//   options: --fps 30  --workers 4  --from S --to S (partial render, seconds)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const lang = args[0] || 'en';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const fps = Number(opt('fps', 30));
const workers = Number(opt('workers', 4));
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/web/index.html?lang=${lang}`);
  await page.waitForFunction(() => window.READY || window.INIT_ERROR, null, { timeout: 600000 });
  const err = await page.evaluate(() => window.INIT_ERROR);
  if (err) throw new Error(err);
  return page;
}

async function frameJpeg(page, t) {
  await page.evaluate((tt) => window.renderFrame(tt), t);
  return page.screenshot({ type: 'jpeg', quality: 93, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

function encoder(out) {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  return { ff, done };
}

async function main() {
  const server = await serve(0);
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  try {
    const still = opt('still');
    if (still) {
      const page = await openPage(browser, port);
      fs.mkdirSync(path.join(ROOT, 'build/stills'), { recursive: true });
      for (const s of still.split(',')) {
        const t = Number(s);
        await page.evaluate((tt) => window.renderFrame(tt), t);
        const file = path.join(ROOT, `build/stills/${lang}_${t.toFixed(2)}.png`);
        await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
        console.log(file);
      }
      return;
    }
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, port)));
    const duration = await pages[0].evaluate(() => window.DURATION);
    const from = Number(opt('from', 0)), to = Math.min(Number(opt('to', duration)), duration);
    const total = Math.round((to - from) * fps);
    const tmp = path.join(ROOT, `build/${lang}/chunks`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const per = Math.ceil(total / workers);
    let doneFrames = 0;
    const t0 = Date.now();
    await Promise.all(pages.map(async (page, w) => {
      const a = w * per, b = Math.min(total, a + per);
      const { ff, done } = encoder(path.join(tmp, `chunk_${w}.mp4`));
      for (let f = a; f < b; f++) {
        const jpg = await frameJpeg(page, from + f / fps);
        if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
        doneFrames++;
        if (doneFrames % 300 === 0) {
          const el = (Date.now() - t0) / 1000;
          console.log(`${doneFrames}/${total} frames  ${(doneFrames / el).toFixed(1)} fps  eta ${((total - doneFrames) / (doneFrames / el) / 60).toFixed(1)} min`);
        }
      }
      ff.stdin.end();
      await done;
    }));
    const list = pages.map((_, w) => `file '${path.join(tmp, `chunk_${w}.mp4`)}'`).join('\n');
    fs.writeFileSync(path.join(tmp, 'list.txt'), list);
    const video = path.join(ROOT, `build/${lang}/video.mp4`);
    await new Promise((res, rej) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', video], { stdio: 'inherit' })
      .on('close', (c) => (c === 0 ? res() : rej(new Error('concat ' + c)))));
    console.log(`video -> ${video} (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
