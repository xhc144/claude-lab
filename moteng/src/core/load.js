// Loads a saved chat page from whatever the browser produced:
//   • "网页，全部"  → page.html + page_files/      (folder or the .html itself)
//   • "网页，单个文件" → page.mhtml / page.mht
//   • a .zip of either of the above (Windows zips often carry GBK or #Uxxxx names)
//   • raw HTML from the clipboard
// The result is { html, url, savedAt, name, resolve(src) → {bytes, mime, name} | null }.

import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { parseMhtml } from './mhtml.js';

const HTML_EXT = /\.(html?|xhtml)$/i;
const MHTML_EXT = /\.(mhtml|mht)$/i;

// Browser helper frames that land next to a saved page; never the conversation.
const HELPER_PAGE = /(^|\/)(frame|runner|sw|iframe|sandbox|blank)\.html?$/i;

const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
};

export function mimeFromName(name) {
  const ext = String(name).toLowerCase().split(/[?#]/)[0].split('.').pop();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

// Info-ZIP writes non-ASCII names it cannot represent as "#Uxxxx".
function decodeZipName(raw) {
  return raw.replace(/#U([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function decodeBytesName(bytes, utf8Flag) {
  if (utf8Flag) return new TextDecoder('utf-8').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Chinese Windows "Send to → Compressed folder" writes names in GBK without the UTF-8 flag.
    try { return new TextDecoder('gbk').decode(bytes); } catch { return new TextDecoder('latin1').decode(bytes); }
  }
}

// fflate decodes names as UTF-8/latin1 itself; re-read the raw central directory
// so that GBK names survive.
function zipEntryNames(buf) {
  const names = [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return names;
  let p = view.getUint32(eocd + 16, true);
  const count = view.getUint16(eocd + 10, true);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const flags = view.getUint16(p + 8, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const raw = buf.subarray(p + 46, p + 46 + nameLen);
    names.push({ raw: new TextDecoder('latin1').decode(raw), name: decodeZipName(decodeBytesName(raw, flags & 0x800)) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function decodeHtmlBytes(bytes) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const m = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  const charset = (m ? m[1] : 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset === 'gb2312' ? 'gbk' : charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// "<!-- saved from url=(0058)https://chatgpt.com/c/... -->" is written by Chrome and Edge.
export function savedFromUrl(html) {
  const m = html.slice(0, 2000).match(/saved from url=\(\d+\)(\S+?)\s*-->/i);
  if (m) return m[1];
  const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i)
    || html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)/i);
  return canon ? canon[1] : '';
}

function pickMainHtml(files) {
  const htmls = files.filter((f) => HTML_EXT.test(f.name) && !HELPER_PAGE.test(f.name));
  if (!htmls.length) return null;
  // The page itself sits highest in the tree; among equals take the largest.
  htmls.sort((a, b) => a.name.split('/').length - b.name.split('/').length || b.size - a.size);
  const top = htmls[0].name.split('/').length;
  return htmls.filter((f) => f.name.split('/').length === top).sort((a, b) => b.size - a.size)[0];
}

function makeResolver(lookup, baseDir) {
  return (src) => {
    if (!src) return null;
    if (src.startsWith('data:')) {
      const m = src.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!m) return null;
      const bytes = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
      return { bytes: new Uint8Array(bytes), mime: m[1] || 'application/octet-stream', name: 'inline' };
    }
    let rel = src.split('#')[0];
    try { rel = decodeURIComponent(rel); } catch { /* keep raw */ }
    const hit = lookup(rel, baseDir);
    return hit || null;
  };
}

function loadZip(buf, fileName) {
  const entries = unzipSync(buf);
  const realNames = zipEntryNames(buf);
  const byRaw = new Map(realNames.map((n) => [n.raw, n.name]));
  const files = [];
  for (const [rawName, data] of Object.entries(entries)) {
    if (rawName.endsWith('/')) continue;
    const latin = Buffer.from(rawName, 'utf8').toString('latin1');
    const name = byRaw.get(rawName) || byRaw.get(latin) || decodeZipName(rawName);
    files.push({ name: name.replace(/\\/g, '/'), data, size: data.length });
  }
  // A zip inside the zip (the user zipped a folder that already held a zip) — open it as well
  // when the outer one has no page of its own.
  let main = pickMainHtml(files);
  const mhtml = files.find((f) => MHTML_EXT.test(f.name));
  if (!main && mhtml) return loadMhtmlBytes(mhtml.data, path.basename(mhtml.name));
  if (!main) {
    const inner = files.find((f) => /\.zip$/i.test(f.name));
    if (inner) return loadZip(inner.data, inner.name);
    throw new Error(`压缩包 ${fileName} 里没有找到网页文件（.html / .mhtml）`);
  }
  const html = decodeHtmlBytes(main.data);
  const mainDir = path.posix.dirname(main.name);
  const index = new Map(files.map((f) => [f.name, f]));
  const lookup = (rel) => {
    if (/^[a-z]+:/i.test(rel)) return null;
    const p = path.posix.normalize(path.posix.join(mainDir === '.' ? '' : mainDir, rel)).replace(/^\.\//, '');
    const f = index.get(p) || files.find((x) => x.name.endsWith('/' + path.posix.basename(p)) && x.name.includes(path.posix.basename(path.posix.dirname(p))));
    return f ? { bytes: f.data, mime: mimeFromName(f.name), name: path.posix.basename(f.name) } : null;
  };
  return {
    html,
    url: savedFromUrl(html),
    name: path.basename(main.name).replace(HTML_EXT, ''),
    resolve: makeResolver(lookup),
  };
}

function loadMhtmlBytes(bytes, fileName) {
  const doc = parseMhtml(bytes);
  if (!doc.html) throw new Error(`${fileName} 不是有效的 MHTML 网页`);
  const parts = doc.parts;
  const lookup = (rel) => {
    const part = parts.get(rel) || [...parts.values()].find((p) => p.location && (p.location.endsWith(rel) || rel.endsWith(p.location)));
    return part ? { bytes: part.bytes, mime: part.type, name: path.posix.basename(part.location || 'part') } : null;
  };
  return {
    html: doc.html,
    url: doc.url || savedFromUrl(doc.html),
    savedAt: doc.date,
    name: fileName.replace(MHTML_EXT, ''),
    resolve: makeResolver(lookup),
  };
}

function loadHtmlFile(file) {
  const html = decodeHtmlBytes(fs.readFileSync(file));
  const baseDir = path.dirname(file);
  const lookup = (rel) => {
    if (/^[a-z]+:/i.test(rel) && !/^file:/i.test(rel)) return null;
    const p = /^file:/i.test(rel) ? new URL(rel).pathname.replace(/^\/([A-Za-z]:)/, '$1') : path.resolve(baseDir, rel);
    try {
      return { bytes: new Uint8Array(fs.readFileSync(p)), mime: mimeFromName(p), name: path.basename(p) };
    } catch {
      return null;
    }
  };
  return {
    html,
    url: savedFromUrl(html),
    savedAt: fs.statSync(file).mtime,
    name: path.basename(file).replace(HTML_EXT, ''),
    resolve: makeResolver(lookup),
  };
}

/** Load from a path on disk (file, .mhtml, .zip or folder). */
export function loadInput(input) {
  const stat = fs.statSync(input);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(input).map((n) => ({ name: n, size: fs.statSync(path.join(input, n)).size }))
      .filter((f) => fs.statSync(path.join(input, f.name)).isFile());
    const main = pickMainHtml(files) || files.find((f) => MHTML_EXT.test(f.name));
    if (!main) {
      // "page_files" folder dropped on its own: the page is its sibling or inside it.
      const sibling = input.replace(/_files[\\/]*$/, '.html');
      if (sibling !== input && fs.existsSync(sibling)) return loadHtmlFile(sibling);
      throw new Error(`文件夹 ${path.basename(input)} 里没有找到网页文件`);
    }
    return loadInput(path.join(input, main.name));
  }
  if (MHTML_EXT.test(input)) return loadMhtmlBytes(new Uint8Array(fs.readFileSync(input)), path.basename(input));
  if (/\.zip$/i.test(input)) {
    const out = loadZip(new Uint8Array(fs.readFileSync(input)), path.basename(input));
    out.savedAt = out.savedAt || stat.mtime;
    return out;
  }
  const buf = fs.readFileSync(input);
  // Some browsers save MHTML with a .html name.
  if (/^\s*(From:|MIME-Version:|Content-Type: multipart\/related)/i.test(buf.subarray(0, 512).toString('latin1'))) {
    return loadMhtmlBytes(new Uint8Array(buf), path.basename(input));
  }
  return loadHtmlFile(input);
}

/** HTML pasted from the clipboard: a fragment, usually without the page around it. */
export function loadHtmlString(html, { name = '剪贴板', url = '' } = {}) {
  return {
    html,
    url: url || savedFromUrl(html),
    savedAt: new Date(),
    name,
    fragment: !/<html[\s>]/i.test(html),
    resolve: makeResolver(() => null),
  };
}
