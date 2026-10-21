// Snapshots of dynamic content, in the Electron main process.
//
// A saved chat page keeps the DOM of its charts and widgets (Recharts SVG with an HTML legend,
// ChatGPT's interactive "DIL" cards with sliders, diagrams) and the stylesheets that draw them,
// but not the scripts that made them move. Chromium renders the saved page offline, with
// scripts off, exactly as the browser showed it at save time; each element marked by the
// extractor (data-moteng-dyn) is then captured at 2× on its own, with everything else on the
// page made invisible so sidebars and sticky bars never cover it.
//
// SVG diagrams saved as <img src="data:image/svg+xml…"> become vector PDFs (sharp at any zoom),
// with a PNG twin for the preview and the HTML export.

import { BrowserWindow, protocol, session, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const SCHEME = 'moteng-snap';
const PARTITION = 'moteng-snapshot';

/** Must run before app.whenReady(). */
export function registerSnapshotScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
}

let current = null; // { html, resolve, allowNetwork } — one render at a time (see exclusive)
let chain = Promise.resolve();
function exclusive(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}
let handlerReady = false;

function snapSession() {
  const ses = session.fromPartition(PARTITION, { cache: false });
  if (!handlerReady) {
    ses.protocol.handle(SCHEME, async (req) => {
      const url = new URL(req.url);
      if (!current) return new Response('', { status: 404 });
      if (url.pathname === '/__moteng_page__.html') {
        return new Response(current.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      let rel = url.pathname.replace(/^\/+/, '');
      try { rel = decodeURIComponent(rel); } catch { /* raw */ }
      const hit = current.resolve(rel) || current.resolve(`./${rel}`) || current.resolve(path.posix.basename(rel));
      if (!hit) return new Response('', { status: 404 });
      return new Response(Buffer.from(hit.bytes), { headers: { 'content-type': hit.mime && hit.mime !== 'application/octet-stream' ? hit.mime : mimeOf(rel) } });
    });
    // Nothing leaves the machine unless the user allowed fetching images from the web.
    ses.webRequest.onBeforeRequest((details, cb) => {
      const u = details.url;
      if (u.startsWith(`${SCHEME}:`) || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return cb({});
      if (current?.allowNetwork && /^https:\/\//i.test(u) && /\.(css|woff2?|ttf|otf|png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) return cb({});
      cb({ cancel: true });
    });
    ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    handlerReady = true;
  }
  return ses;
}

function mimeOf(name) {
  const ext = String(name).toLowerCase().split(/[?#]/)[0].split('.').pop();
  return { css: 'text/css', js: 'text/javascript', html: 'text/html', htm: 'text/html', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' }[ext] || 'application/octet-stream';
}

const CAPTURE_CSS = `
html.mt-cap *, html.mt-cap *::before, html.mt-cap *::after { transition: none !important; animation: none !important; caret-color: transparent !important; content-visibility: visible !important; }
html.mt-cap body * { visibility: hidden !important; }
html.mt-cap [data-moteng-cap], html.mt-cap [data-moteng-cap] * { visibility: visible !important; }
html.mt-cap [data-moteng-cap] .recharts-tooltip-wrapper { visibility: hidden !important; }
`;

// The saved page, ready to be rendered from our scheme: scripts, CSP and <base> removed.
function pageHtml(annotated) {
  // Scripts are on in the capture window (the capture itself is a script), so every script of
  // the page goes: <script>, inline handlers, javascript: URLs, and frames (captured on their own).
  let html = String(annotated)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .replace(/(<iframe\b[^>]*?)\ssrc(doc)?\s*=\s*("[^"]*"|'[^']*')/gi, '$1')
    .replace(/<(object|embed)\b[\s\S]*?(<\/\1>|\/>)/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<link[^>]+rel=["']?(preload|modulepreload|prefetch|preconnect|dns-prefetch)[^>]*>/gi, '');
  const inject = `<style id="moteng-capture">${CAPTURE_CSS}</style>`;
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${inject}</head>`) : inject + html;
  return html;
}

function newWindow({ width = 1280, height = 900, javascript = true } = {}) {
  return new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    paintWhenInitiallyHidden: true,
    // Offscreen rendering: a hidden normal window may never produce a frame to capture.
    webPreferences: { session: snapSession(), javascript, sandbox: true, contextIsolation: true, nodeIntegration: false, images: true, webgl: false, offscreen: true, backgroundThrottling: false },
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (win, code) => timed(win.webContents.executeJavaScript(code, true), 15000, '渲染');
const timed = (p, ms, what) => Promise.race([p, wait(ms).then(() => { throw new Error(`${what}超时`); })]);

async function cdp(win) {
  const dbg = win.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');
  return (method, params = {}) => timed(dbg.sendCommand(method, params), 20000, method === 'Page.captureScreenshot' ? '截图' : '渲染');
}

async function loadPage(win, url, timeout = 20000) {
  await Promise.race([
    win.loadURL(url),
    wait(timeout).then(() => { throw new Error('页面渲染超时'); }),
  ]);
  // Fonts and images from the saved folder.
  await timed(win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true', true), 5000, '字体').catch(() => {});
}

/** Colours of the page's own question bubble, text and links (for "follow the page's colours"). */
const PROBE = `(() => {
  const vis = (c) => c && c !== 'transparent' && !/rgba\\(.*,\\s*0\\)$/.test(c);
  const out = {};
  const q = document.querySelector('[data-moteng-role="user"]');
  if (q) {
    const text = (q.textContent || '').trim().slice(0, 20);
    let best = null;
    for (const el of [q, ...q.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if (vis(cs.backgroundColor) && (el.textContent || '').includes(text)) best = el;
    }
    if (best) { const cs = getComputedStyle(best); out.bubbleBg = cs.backgroundColor; out.bubbleFg = cs.color; out.bubbleRadius = cs.borderRadius; }
  }
  const a = document.querySelector('[data-moteng-role="assistant"]');
  if (a) { const cs = getComputedStyle(a); out.text = cs.color; out.font = cs.fontFamily; out.size = cs.fontSize; }
  const link = a && a.querySelector('a[href]');
  if (link) out.link = getComputedStyle(link).color;
  out.dark = /dark/.test(document.documentElement.className + ' ' + (document.documentElement.dataset.theme || ''));
  return out;
})()`;

function rgbToHex(c) {
  const m = String(c || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? `#${[m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('')}` : null;
}

/**
 * Capture every dynamic element of a prepared conversation. Sets b.file (images/dyn-N.png),
 * b.pxWidth (CSS px at capture time) on the blocks; returns the page colours.
 */
export function snapshotConversation(...args) {
  return exclusive(() => snapshotConversationNow(...args));
}

async function snapshotConversationNow({ conv, loaded, workDir, warnings }, { allowNetwork = false, onProgress } = {}) {
  const items = [];
  const walk = (bs) => (bs || []).forEach((b) => {
    if ((b.t === 'dynamic' || (b.t === 'note' && b.kind === 'widget')) && b.dyn) items.push(b);
    if (b.items) b.items.forEach(walk);
    if (b.blocks) walk(b.blocks);
  });
  conv.messages.forEach((m) => walk(m.blocks));
  if (!conv.annotatedHtml) return null;
  current = { html: pageHtml(conv.annotatedHtml), resolve: loaded.resolve, allowNetwork };
  const win = newWindow();
  let colours = null;
  try {
    await loadPage(win, `${SCHEME}://page/__moteng_page__.html`);
    await wait(250);
    try {
      const p = await js(win, PROBE);
      colours = { bubbleBg: rgbToHex(p.bubbleBg), bubbleFg: rgbToHex(p.bubbleFg), text: rgbToHex(p.text), link: rgbToHex(p.link), font: p.font, dark: !!p.dark };
    } catch { /* optional */ }
    const send = await cdp(win);
    const imgDir = path.join(workDir, 'images');
    fs.mkdirSync(imgDir, { recursive: true });
    let n = 0;
    for (const b of items) {
      n++;
      onProgress?.(`截取图表与交互组件 ${n}/${items.length}`);
      try {
        if (b.kind === 'iframe') {
          const ok = await captureFrame(b, loaded, imgDir, n, allowNetwork);
          if (!ok) continue;
          b.file = `images/dyn-${n}.png`;
          continue;
        }
        const shot = await captureElement(win, send, b.dyn);
        if (!shot) continue;
        if (shot.blank && b.kind === 'canvas') continue;
        const trimmed = trimImage(shot.png);
        fs.writeFileSync(path.join(imgDir, `dyn-${n}.png`), trimmed.png);
        b.file = `images/dyn-${n}.png`;
        // CSS px (captures are 2×).
        b.pxWidth = trimmed.width / 2;
        b.pxHeight = trimmed.height / 2;
      } catch (e) {
        warnings?.push(`第 ${n} 处动态内容截取失败：${e.message}`);
      }
    }
  } finally {
    try { win.webContents.debugger.detach(); } catch { /* not attached */ }
    win.destroy();
    current = null;
  }
  conv.pageColors = colours;
  return colours;
}

async function captureElement(win, send, key) {
  const sel = `[data-moteng-dyn="${key}"]`;
  // Offscreen pages repaint only what is in the viewport, and not reliably after scrolling; so
  // the element is lifted to the top-left corner at its own width (still in its place in the DOM,
  // so it keeps every inherited style), captured there, and put back.
  const box = await js(win, `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      // These would make the fixed element position against the ancestor instead of the viewport.
      if (cs.transform !== 'none') p.style.setProperty('transform', 'none', 'important');
      if (cs.filter !== 'none') p.style.setProperty('filter', 'none', 'important');
      if (cs.perspective !== 'none') p.style.setProperty('perspective', 'none', 'important');
      p.style.setProperty('contain', 'none', 'important');
      p.style.setProperty('will-change', 'auto', 'important');
      // No stacking context on the way up, so z-index puts the element above sidebars and bars.
      p.style.setProperty('z-index', 'auto', 'important');
      p.style.setProperty('isolation', 'auto', 'important');
      p.style.setProperty('mix-blend-mode', 'normal', 'important');
      if (+cs.opacity < 1) p.style.setProperty('opacity', '1', 'important');
      // Nor any clipping.
      p.style.setProperty('overflow', 'visible', 'important');
      if (cs.clipPath !== 'none') p.style.setProperty('clip-path', 'none', 'important');
      if (cs.maskImage && cs.maskImage !== 'none') p.style.setProperty('mask', 'none', 'important');
    }
    let bg = 'transparent';
    for (let p = el; p && (bg === 'transparent' || /rgba\\(.*,\\s*0\\)$/.test(bg)); p = p.parentElement) bg = getComputedStyle(p).backgroundColor;
    if (!bg || bg === 'transparent' || /rgba\\(.*,\\s*0\\)$/.test(bg)) bg = '#ffffff';
    el.dataset.motengStyle = el.getAttribute('style') || '';
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('left', '0px', 'important');
    el.style.setProperty('top', '0px', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('width', r.width + 'px', 'important');
    el.style.setProperty('max-width', 'none', 'important');
    el.style.setProperty('z-index', '2147483647', 'important');
    el.style.setProperty('background-color', bg, 'important');
    el.style.setProperty('transform', 'none', 'important');
    document.querySelectorAll('[data-moteng-cap]').forEach((e) => e.removeAttribute('data-moteng-cap'));
    el.setAttribute('data-moteng-cap', '');
    if (!${JSON.stringify(!!process.env.MOTENG_SNAP_SHOWALL)}) document.documentElement.classList.add('mt-cap');
    window.scrollTo(0, 0);
    const q = el.getBoundingClientRect();
    return { width: q.width, height: q.height };
  })()`);
  if (!box) return null;
  const width = Math.max(1280, Math.ceil(box.width + 20));
  const height = Math.min(8000, Math.max(900, Math.ceil(box.height + 20)));
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await wait(200);
  const r = await js(win, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
  const clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.ceil(r.width), height: Math.ceil(r.height), scale: 1 };
  const res = await send('Page.captureScreenshot', { format: 'png', clip });
  if (process.env.MOTENG_SNAP_DEBUG) {
    const full = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.MOTENG_SNAP_DEBUG, `full-${key}.png`), Buffer.from(full.data, 'base64'));
    const at = await js(win, `document.elementsFromPoint(20, 60).slice(0, 6).map((e) => { const cs = getComputedStyle(e); return e.tagName + '.' + String(e.className).slice(0, 40) + ' vis=' + cs.visibility + ' bg=' + cs.backgroundColor + ' z=' + cs.zIndex + ' pos=' + cs.position; })`);
    fs.writeFileSync(path.join(process.env.MOTENG_SNAP_DEBUG, `rect-${key}.json`), JSON.stringify({ box, r, clip, at }, null, 1));
  }
  await send('Emulation.clearDeviceMetricsOverride');
  await js(win, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return; el.setAttribute('style', el.dataset.motengStyle || ''); delete el.dataset.motengStyle; el.removeAttribute('data-moteng-cap'); document.documentElement.classList.remove('mt-cap'); })()`);
  const png = Buffer.from(res.data, 'base64');
  return { png, width: r.width, height: r.height, blank: png.length < 2500 };
}

/**
 * Cut away uniform margins (empty chart areas, padding in the page's background colour), keeping a
 * small border. Works on the BGRA bitmap of the PNG.
 */
export function trimImage(pngBytes, { pad = 12, tolerance = 10 } = {}) {
  const img = nativeImage.createFromBuffer(Buffer.from(pngBytes));
  const { width, height } = img.getSize();
  if (!width || !height) return { png: pngBytes, width, height };
  const px = img.toBitmap();
  const at = (x, y) => (y * width + x) * 4;
  const bg = [px[0], px[1], px[2]];
  const differs = (i) => Math.abs(px[i] - bg[0]) > tolerance || Math.abs(px[i + 1] - bg[1]) > tolerance || Math.abs(px[i + 2] - bg[2]) > tolerance;
  let top = height; let bottom = -1; let left = width; let right = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (differs(at(x, y))) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return { png: pngBytes, width, height, blank: true };
  const x0 = Math.max(0, left - pad);
  const y0 = Math.max(0, top - pad);
  const x1 = Math.min(width, right + pad + 1);
  const y1 = Math.min(height, bottom + pad + 1);
  // Not worth it for a few pixels.
  if ((x1 - x0) * (y1 - y0) > width * height * 0.97) return { png: pngBytes, width, height };
  const cropped = img.crop({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  return { png: cropped.toPNG(), width: x1 - x0, height: y1 - y0 };
}

// An interactive frame saved with the page: render it on its own, scripts on, sandboxed and offline.
async function captureFrame(b, loaded, imgDir, n, allowNetwork) {
  let html = b.srcdoc || '';
  let resolver = loaded.resolve;
  if (!html) {
    const hit = loaded.resolve(b.src);
    if (!hit) return false;
    html = Buffer.from(hit.bytes).toString('utf8');
    const dir = path.posix.dirname(String(b.src).split(/[?#]/)[0]);
    resolver = (rel) => loaded.resolve(path.posix.join(dir, rel)) || loaded.resolve(rel);
  }
  if (!html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim() && !/<(svg|canvas|img|div)\b/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))) return false;
  current = { html: html.replace(/<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi, ''), resolve: resolver, allowNetwork };
  const width = Math.round(Math.min(1280, Math.max(320, b.w || 760)));
  const win = newWindow({ width, height: Math.round(Math.max(240, Math.min(4000, b.h || 600))), javascript: true });
  try {
    await loadPage(win, `${SCHEME}://page/__moteng_page__.html`, 15000);
    await wait(1500);
    const send = await cdp(win);
    const size = await js(win, '({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })');
    const h = Math.min(4000, Math.max(120, b.h || size.h));
    await send('Emulation.setDeviceMetricsOverride', { width, height: h, deviceScaleFactor: 2, mobile: false });
    await wait(150);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height: h, scale: 1 }, captureBeyondViewport: true });
    fs.writeFileSync(path.join(imgDir, `dyn-${n}.png`), Buffer.from(res.data, 'base64'));
    b.pxWidth = width;
    try { win.webContents.debugger.detach(); } catch { /* */ }
    return true;
  } finally {
    win.destroy();
  }
}

/**
 * SVG → vector PDF (for TeX) plus a PNG twin (for the preview). Returns null on failure.
 * `currentColor` and system fonts resolve as the page drew them (dark ink on white).
 */
export function svgToPdf(bytes) {
  return exclusive(() => svgToPdfNow(bytes));
}

async function svgToPdfNow(bytes) {
  const svg = Buffer.from(bytes).toString('utf8');
  const vb = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  let w = vb ? +vb[1] : +(svg.match(/\swidth\s*=\s*["']([\d.]+)(px)?["']/i)?.[1] || 0);
  let h = vb ? +vb[2] : +(svg.match(/\sheight\s*=\s*["']([\d.]+)(px)?["']/i)?.[1] || 0);
  if (!w || !h) { w = 600; h = 400; }
  // Draw at the width the page showed (the chat column, ~720px), keeping the aspect ratio.
  const scale = Math.min(4, Math.max(0.5, 720 / w));
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  current = { html: `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${W}px ${H}px;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:${W}px;height:${H}px;color:#0d0d0d}</style></head><body><img src="${dataUrl}"></body></html>`, resolve: () => null, allowNetwork: false };
  const win = newWindow({ width: W, height: H });
  try {
    await loadPage(win, `${SCHEME}://page/__moteng_page__.html`, 10000);
    await timed(win.webContents.executeJavaScript('new Promise((r) => { const i = document.querySelector("img"); if (i.complete) r(); else { i.onload = r; i.onerror = r; } })', true), 10000, '载入矢量图');
    const pdf = await timed(win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } }), 20000, '生成矢量图');
    const send = await cdp(win);
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
    await wait(80);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, captureBeyondViewport: true });
    try { win.webContents.debugger.detach(); } catch { /* */ }
    return { pdf: new Uint8Array(pdf), png: new Uint8Array(Buffer.from(shot.data, 'base64')), width: W, height: H };
  } catch {
    return null;
  } finally {
    win.destroy();
    current = null;
  }
}
