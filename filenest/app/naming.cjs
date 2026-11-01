'use strict';
// 给“看不出内容”或纯英文的文件名找一个中文名：从内容里读（PDF 标题、网页 <title>、压缩包/文件夹里的中文名、tex/md/txt 标题行）。
// 只读本地内容，不联网、不翻译；找不到中文就返回 ''，名字保持原样。
const fs = require('node:fs');
const path = require('node:path');
const { readPdf, chineseTitleFromPdf, isMeaninglessName, titleFromPdf } = require('./pdf.cjs');

const HAN3 = s => (String(s).match(/\p{Script=Han}/gu) || []).length >= 3;
// 说明类文件名不能代表整个包
const GENERIC = /^(\d+[_\s.-]*)?(使用说明|说明|先读|先读我|先打开这里|从这里开始|开始游戏|打开即用|打开预览|打开网站|开发模式|恢复说明|安装说明|测试脚本说明|readme)/i;

function clean(s) {
  let t = String(s || '').normalize('NFKC').replace(/:/g, '：').replace(/\?/g, '？').replace(/\|/g, '｜')
    .replace(/[<>"/\\*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/\s*([：？｜])\s*/g, '$1').trim();
  t = t.replace(/\s*[-｜–—]\s*(Claude|ChatGPT|DeepSeek|Kimi|豆包)$/i, '').trim();   // 对话网页标题尾巴
  if (t.length > 40) t = t.slice(0, 40).trim();
  return t.replace(/[. _-]+$/, '');
}

function readHead(file, bytes = 262144) {
  const fd = fs.openSync(file, 'r');
  try { const b = Buffer.alloc(bytes); const n = fs.readSync(fd, b, 0, bytes, 0); return b.subarray(0, n).toString('utf8'); } finally { fs.closeSync(fd); }
}

function htmlTitle(file) {
  try { const m = /<title[^>]*>([^<]*)<\/title>/i.exec(readHead(file)); return m ? clean(m[1].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')) : ''; } catch { return ''; }
}

function textTitle(file, ext) {
  try {
    const t = readHead(file, 32768);
    if (ext === '.tex') { const m = /\\title\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/.exec(t); return m ? clean(m[1]) : ''; }
    const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (ext === '.md') { const h = lines.find(l => /^#\s+/.test(l)); return h ? clean(h.replace(/^#+\s+/, '')) : ''; }
    return lines[0] && lines[0].length <= 60 ? clean(lines[0]) : '';
  } catch { return ''; }
}

// 只读压缩包的目录（不解压）；中文名可能是 UTF-8 或 GBK
const gbk = (() => { try { return new TextDecoder('gbk'); } catch { return null; } })();
const utf8 = new TextDecoder('utf-8', { fatal: true });
function zipNames(file) {
  try {
    const st = fs.statSync(file); const size = Math.min(st.size, 4 * 1024 * 1024);
    const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(size);
    try { fs.readSync(fd, b, 0, size, st.size - size); } finally { fs.closeSync(fd); }
    const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); if (eocd < 0) return [];
    const count = b.readUInt16LE(eocd + 10), cdSize = b.readUInt32LE(eocd + 12);
    let off = eocd - cdSize; if (off < 0) return [];
    const out = [];
    for (let i = 0; i < count && out.length < 500 && off + 46 <= b.length; i++) {
      if (b.readUInt32LE(off) !== 0x02014b50) break;
      const flag = b.readUInt16LE(off + 8), nl = b.readUInt16LE(off + 28), el = b.readUInt16LE(off + 30), cl = b.readUInt16LE(off + 32);
      const raw = b.subarray(off + 46, off + 46 + nl);
      let name; try { name = utf8.decode(raw); } catch { name = gbk && !(flag & 0x800) ? gbk.decode(raw) : raw.toString('latin1'); }
      out.push(name.replace(/\\/g, '/')); off += 46 + nl + el + cl;
    }
    return out;
  } catch { return []; }
}

// 一组路径（相对）里挑一个中文名：先看顶层文件夹，再看文件（去扩展名、跳过说明类）
function pickFromNames(names) {
  const tops = [...new Set(names.map(n => n.split('/')[0]).filter(Boolean))];
  if (tops.length === 1 && names.some(n => n.includes('/')) && HAN3(tops[0]) && !GENERIC.test(tops[0])) return clean(tops[0]);
  for (const n of names) {
    const base = n.split('/').pop(); const stem = base.replace(/\.[^.]+$/, '');
    if (HAN3(stem) && !GENERIC.test(stem) && !/\.(js|css|下载|url)$/i.test(base)) return clean(stem);
  }
  return '';
}

function dirNames(dir, limit = 300) {
  const out = [];
  const walk = (d, prefix, depth) => {
    if (depth > 2 || out.length >= limit) return;
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) { if (out.length >= limit) return; out.push(prefix + e.name); if (e.isDirectory()) walk(path.join(d, e.name), prefix + e.name + '/', depth + 1); }
  };
  walk(dir, '', 0);
  return out;
}

/** 从内容里找中文名；找不到返回 ''。 */
function chineseNameFor(full, isDirectory, sig = '') {
  try {
    if (isDirectory) {
      for (const ix of ['index.html', 'index.htm']) { const p = path.join(full, ix); if (fs.existsSync(p)) { const t = htmlTitle(p); if (HAN3(t)) return t; } }
      return pickFromNames(dirNames(full));
    }
    const ext = path.extname(full).toLowerCase();
    let t = '';
    if (ext === '.pdf') t = chineseTitleFromPdf(readPdf(full, sig));
    else if (ext === '.html' || ext === '.htm') t = htmlTitle(full);
    else if (ext === '.zip') t = pickFromNames(zipNames(full));
    else if (['.tex', '.md', '.txt'].includes(ext)) t = textTitle(full, ext);
    return HAN3(t) ? t : '';
  } catch { return ''; }
}

/**
 * 内容里找不到中文时，拿去机器翻译的英文：有意义的英文原名；原名没意义时用 PDF 的英文标题。
 * 已经有中文、或内容里能找到中文的，返回 ''。
 */
function translationSource(full, isDirectory, sig = '') {
  const base = path.basename(full);
  const ext = isDirectory ? '' : path.extname(base);
  const stem = isDirectory ? base : base.slice(0, base.length - ext.length);
  if (/\p{Script=Han}/u.test(stem) && !isMeaninglessName(stem)) return '';
  if (chineseNameFor(full, isDirectory, sig)) return '';
  if (!isMeaninglessName(stem)) return /[A-Za-z]{3}/.test(stem) ? stem : '';
  if (ext.toLowerCase() === '.pdf') { const t = titleFromPdf(readPdf(full, sig)); return t && !/\p{Script=Han}/u.test(t) ? t : ''; }
  return '';
}

/**
 * 应该给出的新名字（不含扩展名）；不需要改返回 ''。原名没意义时只用中文，纯英文名时“中文_原名”。
 * translate：可选，(英文) => 中文译文 或 ''（查机器翻译缓存，同步）。
 */
function suggestName(full, isDirectory, sig = '', translate = null) {
  const base = path.basename(full);
  const ext = isDirectory ? '' : path.extname(base);
  const stem = isDirectory ? base : base.slice(0, base.length - ext.length);
  const meaningless = isMeaninglessName(stem);
  if (!meaningless && /\p{Script=Han}/u.test(stem)) return '';
  const zh = chineseNameFor(full, isDirectory, sig);
  if (zh) return meaningless ? zh : zh + '_' + stem;
  if (!translate) return '';
  const src = translationSource(full, isDirectory, sig);
  const t = src ? translate(src) : '';
  return t ? t + '_' + src : '';
}

module.exports = { chineseNameFor, suggestName, translationSource, zipNames, htmlTitle };
