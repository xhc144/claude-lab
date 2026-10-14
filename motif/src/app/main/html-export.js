// Standalone HTML export: one self-contained file with the engine, only the font subsets the
// document uses (base64), inlined assets and a player/presenter UI. Opens offline by double-click.
import fs from 'node:fs';
import path from 'node:path';
import FONTS from '../../generated/fonts.json';
import { resolveTheme } from '../../engine/env.js';
import { listUserThemes } from '../../core/store/index.js';

function parseRanges(r) {
  if (!r) return null;
  return r.split(',').map((s) => s.trim().replace(/^U\+/i, '')).map((s) => {
    const [a, b] = s.split('-');
    const lo = parseInt(a.replace(/\?/g, '0'), 16), hi = b ? parseInt(b, 16) : parseInt(a.replace(/\?/g, 'f'), 16);
    return [lo, hi];
  });
}

function usedCodepoints(doc) {
  const set = new Set();
  const walk = (v) => {
    if (typeof v === 'string') for (const ch of v) set.add(ch.codePointAt(0));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(doc.scenes); walk(doc.title); walk(doc.brand);
  for (const ch of '0123456789.,%+-−—…“”:/() ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz合计推荐VS') set.add(ch.codePointAt(0));
  return set;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary' };

export async function exportHtml({ doc, projectDir, out, distDir, onProgress }) {
  const theme = resolveTheme(doc, safe(() => listUserThemes(), {}));
  const families = new Set(['Motif Mono', 'Motif Sans SC', 'Motif Inter']);
  for (const r of Object.values(theme.fonts)) for (const f of r.family) families.add(f);
  const cps = usedCodepoints(doc);
  let css = '';
  let fontBytes = 0;
  for (const fam of families) {
    const m = FONTS[fam];
    if (!m) continue;
    for (const face of m.faces) {
      const ranges = parseRanges(face.range);
      if (ranges && ![...cps].some((cp) => ranges.some(([a, b]) => cp >= a && cp <= b))) continue;
      const file = path.join(distDir, 'fonts', face.file);
      if (!fs.existsSync(file)) continue;
      const b64 = fs.readFileSync(file).toString('base64');
      fontBytes += b64.length;
      css += `@font-face{font-family:'${fam}';font-style:${face.style};font-weight:${face.weight};${face.stretch ? `font-stretch:${face.stretch};` : ''}font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');${face.range ? `unicode-range:${face.range};` : ''}}\n`;
    }
  }
  onProgress?.({ stage: 'fonts', bytes: fontBytes });
  const d = JSON.parse(JSON.stringify(doc));
  for (const a of Object.values(d.assets || {})) {
    const f = projectDir ? path.join(projectDir, a.file) : null;
    if (f && fs.existsSync(f) && fs.statSync(f).size < 80 * 1024 * 1024) a.file = `data:${MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}`;
  }
  const engine = fs.readFileSync(path.join(distDir, 'render.js'), 'utf8');
  const player = fs.readFileSync(path.join(distDir, 'player.js'), 'utf8');
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.title)}</title>
<meta name="generator" content="Motif">
<style>${css}
html,body{margin:0;height:100%;background:#0b0b0d;color:#eee;font-family:'Motif Inter','Motif Sans SC',system-ui,sans-serif;overflow:hidden}
#stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
canvas{display:block;box-shadow:0 20px 80px rgba(0,0,0,.5)}
#bar{position:absolute;left:0;right:0;bottom:0;padding:14px 18px;display:flex;gap:14px;align-items:center;background:linear-gradient(transparent,rgba(0,0,0,.75));opacity:0;transition:opacity .25s}
body:hover #bar,#bar.show{opacity:1}
#bar button{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:8px;height:34px;min-width:34px;padding:0 12px;font:inherit;font-size:14px;cursor:pointer}
#bar button:hover{background:rgba(255,255,255,.22)}
#track{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.18);position:relative;cursor:pointer}
#fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#fff}
.tick{position:absolute;top:-3px;width:2px;height:12px;background:rgba(255,255,255,.55)}
#time{font-variant-numeric:tabular-nums;font-size:13px;opacity:.85;min-width:92px;text-align:right}
#loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;opacity:.7}
</style></head>
<body><div id="stage"><canvas id="c"></canvas></div><div id="loading">加载中…</div>
<div id="bar"><button id="play" title="播放/暂停 (空格)">▶</button><button id="mode" title="演示模式：点击/→ 逐场景前进">演示</button><div id="track"><div id="fill"></div></div><span id="time">0:00</span><button id="fs" title="全屏 (F)">⛶</button></div>
<script>${engine.replace(/<\/script/gi, '<\\/script')}</script>
<script>window.MOTIF_DOC=${JSON.stringify(d).replace(/</g, '\\u003c')};</script>
<script>${player.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, html);
  return { ok: true, out: path.resolve(out), bytes: Buffer.byteLength(html), fontBytes };
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function safe(fn, d) { try { return fn(); } catch { return d; } }
