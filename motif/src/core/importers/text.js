// Markdown / plain text / CSV / JSON importers and the PDF importer (pdf.js text layer).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCSV } from '../catalog/data.js';

export function importMarkdown(text, { sourceName, baseDir }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  const media = [];
  let docTitle = '';
  let cur = { title: '', level: 0, items: [], source: sourceName };
  let para = [];
  let list = null;
  let i = 0;
  const flushPara = () => { if (para.length) { cur.items.push({ kind: 'paragraph', text: para.join(' ').trim() }); para = []; } };
  const flushList = () => { if (list) { cur.items.push(list); list = null; } };
  const flush = () => { flushPara(); flushList(); };
  while (i < lines.length) {
    const ln = lines[i];
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(ln))) {
      flush();
      const lvl = m[1].length;
      if (lvl === 1 && !docTitle && !sections.length && !cur.items.length) { docTitle = m[2].trim(); cur.title = docTitle; cur.level = 0; i++; continue; }
      if (cur.title || cur.items.length) sections.push(cur);
      cur = { title: m[2].trim(), level: lvl, items: [], source: sourceName };
    } else if (/^```/.test(ln)) {
      flush();
      const lang = ln.replace(/^```/, '').trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      cur.items.push(lang === 'math' || lang === 'latex' ? { kind: 'equation', latex: buf.join('\n') } : { kind: 'code', code: buf.join('\n'), language: lang });
    } else if (/^\$\$/.test(ln.trim())) {
      flush();
      const buf = [ln.trim().replace(/^\$\$/, '')];
      if (!/\$\$\s*$/.test(ln.trim().slice(2))) { i++; while (i < lines.length && !/\$\$/.test(lines[i])) buf.push(lines[i++]); buf.push((lines[i] || '').replace(/\$\$.*/, '')); }
      cur.items.push({ kind: 'equation', latex: buf.join(' ').replace(/\$\$/g, '').trim() });
    } else if ((m = /^\s*(?:[-*+•]|\d+[.)、])\s+(.*)$/.exec(ln))) {
      flushPara();
      if (!list) list = { kind: 'bullets', items: [], ordered: /^\s*\d/.test(ln) };
      if (/^\s{2,}/.test(ln) && list.items.length) list.items[list.items.length - 1] += ` — ${m[1].trim()}`;
      else list.items.push(m[1].trim());
    } else if (/^\s*>/.test(ln)) {
      flush();
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      const txt = buf.join(' ').trim();
      const am = /^(.*?)\s*[—–-]{1,2}\s*([^—–-]{1,30})$/.exec(txt);
      cur.items.push(am ? { kind: 'quote', text: am[1].replace(/^["“]|["”]$/g, ''), author: am[2] } : { kind: 'quote', text: txt });
      continue;
    } else if (/^\s*\|.*\|\s*$/.test(ln)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const row = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!row.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(row);
        i++;
      }
      cur.items.push({ kind: 'table', rows, header: true });
      continue;
    } else if ((m = /!\[([^\]]*)\]\(([^)]+)\)/.exec(ln))) {
      flush();
      const f = path.resolve(baseDir || '.', m[2]);
      if (fs.existsSync(f)) { const ref = `media:${path.basename(f)}`; media.push({ ref, file: f, name: path.basename(f) }); cur.items.push({ kind: 'image', ref, caption: m[1] }); }
    } else if (!ln.trim()) {
      flush();
    } else {
      flushList();
      para.push(ln.trim());
    }
    i++;
  }
  flush();
  if (cur.title || cur.items.length) sections.push(cur);
  return { kind: 'markdown', title: docTitle, sections, media };
}

export function importText(text, o) {
  // Treat short lines followed by blank lines as headings; reuse markdown parser after light conversion.
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const conv = lines.map((l, i) => {
    const t = l.trim();
    const next = (lines[i + 1] || '').trim();
    if (t && t.length <= 24 && !/[。.!?！？，,]$/.test(t) && (!next || i === 0)) return `## ${t}`;
    if (/^[一二三四五六七八九十]+[、.]/.test(t)) return `## ${t.replace(/^[一二三四五六七八九十]+[、.]\s*/, '')}`;
    return l;
  });
  return importMarkdown(conv.join('\n'), o);
}

export function importCsv(text, { sourceName }) {
  const rows = parseCSV(text);
  return { kind: 'csv', sections: [{ title: path.basename(sourceName, path.extname(sourceName)), level: 2, source: sourceName, items: [{ kind: 'table', rows, header: true }] }], media: [] };
}

export function importJson(text, { sourceName }) {
  const j = JSON.parse(text);
  if (j && (j.scenes || j.slides) && !Array.isArray(j)) return { kind: 'motif', document: j, sections: [], media: [] };
  if (Array.isArray(j) && j.length && typeof j[0] === 'object') {
    const keys = Object.keys(j[0]);
    return { kind: 'json', sections: [{ title: path.basename(sourceName, '.json'), level: 2, source: sourceName, items: [{ kind: 'table', rows: [keys, ...j.map((r) => keys.map((k) => r[k]))], header: true }] }], media: [] };
  }
  return { kind: 'json', sections: [{ title: path.basename(sourceName), level: 2, source: sourceName, items: [{ kind: 'code', code: JSON.stringify(j, null, 2).slice(0, 1200), language: 'json' }] }], media: [] };
}

// ───────────────────────────── PDF ─────────────────────────────
let pdfjs = null;
async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  // bundled as ESM (CLI) and as CJS (app main process)
  const here = typeof __dirname !== 'undefined' ? __dirname : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const cands = [process.env.MOTIF_PDFJS, path.join(here, 'vendor/pdfjs/pdf.mjs'), path.join(here, '../dist/vendor/pdfjs/pdf.mjs'), path.join(here, '../vendor/pdfjs/pdf.mjs'), path.join(here, '../../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'), path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')].filter(Boolean);
  const file = cands.find((f) => fs.existsSync(f));
  if (!file) throw new Error('缺少 pdf.js 运行库（vendor/pdfjs）');
  pdfjs = await import(pathToFileURL(file).href);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(path.dirname(file), 'pdf.worker.mjs')).href;
  return pdfjs;
}

export async function importPdf(buf, { sourceName }) {
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise;
  const pages = [];
  const sizes = [];
  for (let p = 1; p <= Math.min(doc.numPages, 200); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const size = Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      let ln = lines.find((l) => Math.abs(l.y - y) < size * 0.5);
      if (!ln) { ln = { y, size, parts: [] }; lines.push(ln); }
      ln.parts.push({ x, s: it.str, w: it.width });
      ln.size = Math.max(ln.size, size);
      sizes.push(size);
    }
    lines.sort((a, b) => b.y - a.y);
    for (const l of lines) {
      l.parts.sort((a, b) => a.x - b.x);
      let txt = '', cells = 1, prevEnd = null;
      for (const q of l.parts) {
        if (prevEnd != null && q.x - prevEnd > l.size * 1.6) { txt += '\t'; cells++; }
        txt += q.s;
        prevEnd = q.x + (q.w || q.s.length * l.size * 0.9);
      }
      l.text = txt.replace(/[ ]+/g, ' ').trim();
      l.cells = cells;
    }
    pages.push(lines.filter((l) => l.text));
  }
  sizes.sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] || 10;
  const sections = [];
  let cur = null;
  let title = '';
  pages.forEach((lines, pi) => {
    let para = [];
    let prevY = null;
    const flush = () => { if (para.length) { const t = para.join('').replace(/\s+/g, ' ').trim(); if (t) (cur ||= { title: '', level: 2, items: [], source: `${sourceName} · 第 ${pi + 1} 页` }).items.push({ kind: 'paragraph', text: t }); para = []; } };
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (/^\d+$/.test(l.text) && l.size <= body) continue; // page numbers
      // table: ≥3 consecutive lines with the same number (≥2) of gap-separated cells
      if (l.cells >= 2) {
        let k = li;
        while (k < lines.length && lines[k].cells === l.cells) k++;
        if (k - li >= 3) {
          flush();
          (cur ||= { title: '', level: 2, items: [], source: `${sourceName} · 第 ${pi + 1} 页` }).items.push({ kind: 'table', rows: lines.slice(li, k).map((x) => x.text.split('\t').map((c) => c.trim())), header: true });
          li = k - 1;
          continue;
        }
      }
      const numbered = /^[一二三四五六七八九十]+[、.．]/.test(l.text) || /^第[一二三四五六七八九十\d]+[章节部分]/.test(l.text);
      if ((l.size >= body * 1.18 || numbered) && l.text.length < 40 && !/[。，；]$/.test(l.text)) {
        flush();
        if (!title && pi === 0) { title = l.text; continue; }
        if (cur && (cur.title || cur.items.length)) sections.push(cur);
        cur = { title: l.text.replace(/^[一二三四五六七八九十]+[、.．]\s*/, ''), level: l.size >= body * 1.5 || numbered ? 1 : 2, items: [], source: `${sourceName} · 第 ${pi + 1} 页` };
        continue;
      }
      const bullet = /^[\uf000-\uf8ff•·●▪◦\-–]\s*/.test(l.text) || /^\d{1,2}[.)、．]\s*(?=[\u4e00-\u9fffA-Za-z])/.test(l.text);
      if (bullet) {
        flush();
        cur ||= { title: '', level: 2, items: [], source: `${sourceName} · 第 ${pi + 1} 页` };
        const last = cur.items[cur.items.length - 1];
        const txt = l.text.replace(/^[\uf000-\uf8ff•·●▪◦\-–]\s*|^\d{1,2}[.)、．]\s*/, '').replace(/\t/g, ' ');
        if (last?.kind === 'bullets') last.items.push(txt); else cur.items.push({ kind: 'bullets', items: [txt] });
        prevY = l.y;
        continue;
      }
      if (prevY != null && prevY - l.y > l.size * 1.9) flush();
      para.push(/[一-鿿]$/.test(para[para.length - 1] || '') ? l.text : (para.length ? ' ' : '') + l.text);
      prevY = l.y;
    }
    flush();
  });
  if (cur && (cur.title || cur.items.length)) sections.push(cur);
  return { kind: 'pdf', title, sections, media: [], pages: doc.numPages };
}
