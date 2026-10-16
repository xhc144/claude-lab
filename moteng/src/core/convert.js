// End to end: saved page → main.tex (+ images, class files) → PDF.

import fs from 'node:fs';
import path from 'node:path';
import { loadInput, loadHtmlString, mimeFromName } from './load.js';
import { extractConversation } from './extract.js';
import { renderTex } from './latex/document.js';
import { fragmentAt, inlinePlain } from './latex/writer.js';
import { detectFonts } from './latex/fonts.js';
import { findEngines, compileOnce, cleanAux } from './compile.js';

const HERE = import.meta.dirname;

/** Directories holding moteng.sty and the mojing classes (packaged or source tree). */
export function texResources(resourcesDir) {
  const candidates = [
    resourcesDir && { moteng: path.join(resourcesDir, 'tex', 'moteng'), mojing: path.join(resourcesDir, 'tex', 'mojing') },
    { moteng: path.resolve(HERE, '../../tex'), mojing: path.resolve(HERE, '../../../mojing/tex') },
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c.moteng, 'moteng.sty')) && fs.existsSync(path.join(c.mojing, 'mojing-notes.cls'))) return c;
  }
  throw new Error('找不到 moteng.sty 或墨经模板文件，安装可能不完整');
}

export function safeName(title) {
  const s = String(title || '对话').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return [...(s || '对话')].slice(0, 60).join('');
}

function uniqueDir(root, name) {
  let dir = path.join(root, name);
  for (let i = 2; fs.existsSync(dir) && fs.readdirSync(dir).some((f) => !/^(main\.(tex|log|pdf)|moteng(-compat)?\.sty|mojing-.*|images|.*\.pdf)$/.test(f)); i++) {
    dir = path.join(root, `${name} (${i})`);
  }
  return dir;
}

function eachImage(blocks, fn) {
  for (const b of blocks) {
    if (b.t === 'image') fn(b);
    if (b.inl) b.inl.forEach((x) => { if (x.t === 'img') fn(x); });
    if (b.items) b.items.forEach((it) => eachImage(it, fn));
    if (b.blocks) eachImage(b.blocks, fn);
    if (b.rows) b.rows.forEach((r) => r.cells.forEach((c) => c.forEach((x) => { if (x.t === 'img') fn(x); })));
  }
}

const TEX_IMAGE = /^image\/(png|jpeg)$|^application\/pdf$/;

function sniffMime(bytes, fallback) {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return 'image/webp';
  if (b[0] === 0x25 && b[1] === 0x50) return 'application/pdf';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  const head = Buffer.from(b.subarray(0, 200)).toString('utf8');
  if (/<svg|<\?xml/.test(head)) return 'image/svg+xml';
  return fallback;
}

async function fetchBytes(url, timeoutMs = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: (res.headers.get('content-type') || '').split(';')[0] };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function collectImages(conv, loaded, outDir, opts, warnings) {
  const all = [];
  for (const m of conv.messages) eachImage(m.blocks, (b) => all.push(b));
  if (!all.length) return;
  const imgDir = path.join(outDir, 'images');
  let n = 0;
  const seen = new Map();
  const missing = [];
  const unsupported = [];
  for (const b of all) {
    if (!b.src) { b.file = null; continue; }
    if (seen.has(b.src)) { b.file = seen.get(b.src); continue; }
    let res = loaded.resolve(b.src);
    if (!res && /^https?:/i.test(b.src) && opts.fetchImages !== false) res = await fetchBytes(b.src);
    if (!res) {
      b.file = null;
      missing.push(b.alt || shortSrc(b.src));
      seen.set(b.src, null);
      continue;
    }
    let bytes = res.bytes;
    let mime = sniffMime(bytes, res.mime || mimeFromName(b.src));
    if (!TEX_IMAGE.test(mime) && opts.convertImage) {
      try {
        const png = await opts.convertImage(bytes, mime);
        if (png) { bytes = png; mime = 'image/png'; }
      } catch { /* keep original */ }
    }
    if (!TEX_IMAGE.test(mime)) {
      b.file = null;
      unsupported.push(`${mime.replace('image/', '')}：${b.alt || shortSrc(b.src)}`);
      seen.set(b.src, null);
      continue;
    }
    fs.mkdirSync(imgDir, { recursive: true });
    const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'pdf';
    const file = `images/img-${++n}.${ext}`;
    fs.writeFileSync(path.join(outDir, file), bytes);
    b.file = file;
    seen.set(b.src, file);
  }
  const list = (a) => a.slice(0, 3).join('；') + (a.length > 3 ? ' 等' : '');
  if (missing.length) warnings.push(`${missing.length} 张图片没能取到（${list(missing)}），PDF 中以文字代替。保存网页时选“网页，全部”可以连图片一起保存`);
  if (unsupported.length) warnings.push(`${unsupported.length} 张图片的格式无法放进 PDF（${list(unsupported)}）`);
}

function shortSrc(src) {
  if (src.startsWith('data:')) return '内嵌图片';
  return src.length > 50 ? src.slice(0, 47) + '…' : src;
}

function copyTexSupport(outDir, style, res) {
  fs.copyFileSync(path.join(res.moteng, 'moteng.sty'), path.join(outDir, 'moteng.sty'));
  if (style === 'notes') {
    fs.copyFileSync(path.join(res.moteng, 'moteng-compat.sty'), path.join(outDir, 'moteng-compat.sty'));
    for (const f of fs.readdirSync(res.mojing)) {
      if (/^mojing-(core|math|theorem|tikz)\.sty$|^mojing-notes\.cls$/.test(f)) fs.copyFileSync(path.join(res.mojing, f), path.join(outDir, f));
    }
  }
}

// Which Chinese body font XeTeX actually loaded (fontspec reports the file it opened).
export function cjkFontFromLog(log) {
  const flat = String(log || '').replace(/\r?\n/g, '');
  const files = [...flat.matchAll(/<->"\[?([^"\]:]+?\.(?:ttc|ttf|otf))/gi)].map((m) => m[1].split(/[\\/]/).pop());
  // The class loads Fandol first and our font block overrides it, so the last
  // serif CJK face opened is the body font.
  const serif = files.filter((f) => /sim|songti|sourcehanserif|noto.*serif|fandolsong/i.test(f) && !/hei|sans|msyh|yahei|kai|fang|mono|deng|bold/i.test(f));
  return serif.at(-1) || null;
}

function describeFragment(conv, frag) {
  const kindName = { math: '行内公式', display: '公式', code: '代码块', table: '表格', heading: '标题', para: '段落', image: '图片' }[frag.kind] || '内容';
  return kindName;
}

/**
 * Parse a saved page (path or {html,name,url}) and return the conversation.
 */
export function readConversation(input, opts = {}) {
  const loaded = typeof input === 'string' ? loadInput(input) : loadHtmlString(input.html, input);
  const conv = extractConversation(loaded, opts);
  return { loaded, conv };
}

/**
 * @param {string|{html:string,name?:string,url?:string}} input
 * @param {object} options
 *   style: 'chat' | 'notes'           版式
 *   outRoot: string                   输出根目录（每次转换建一个子文件夹）
 *   compile: boolean                  是否生成 PDF（默认 true）
 *   engine: engine object | null      findEngines() 的一项；省略则自动选择
 *   resourcesDir, includeThinking, includeQuestions, paper, fontSize, title, toc
 *   fetchImages, convertImage(bytes, mime) → png bytes
 *   onProgress(stage, detail)
 */
export async function convert(input, options = {}) {
  const progress = options.onProgress || (() => {});
  const warnings = [];
  progress('read', '读取网页');
  const { loaded, conv } = readConversation(input, { includeThinking: options.includeThinking, title: options.title, platform: options.platform });
  if (!conv.messages.length) throw new Error('没有在这个网页里找到对话内容。请确认保存的是对话页面（Ctrl+S 保存“网页，全部”或“单个文件”）。');
  if (conv.generic) warnings.push('没有识别出网站类型，按通用规则提取；请检查问答是否完整');

  let style = options.style === 'notes' ? 'notes' : 'chat';
  const outRoot = options.outRoot || path.dirname(typeof input === 'string' ? path.resolve(input) : process.cwd());
  const name = safeName(options.title || conv.title);
  const outDir = options.outDir || uniqueDir(outRoot, name);
  fs.mkdirSync(outDir, { recursive: true });

  progress('images', '整理图片');
  await collectImages(conv, loaded, outDir, options, warnings);

  const res = texResources(options.resourcesDir);
  const fonts = options.fonts === undefined ? detectFonts() : options.fonts;
  const texOpts = { ...options, style, fonts, safeFonts: !!options.safeFonts };
  const fallback = new Set();

  const write = () => {
    const r = renderTex(conv, texOpts, fallback);
    fs.writeFileSync(path.join(outDir, 'main.tex'), r.tex, 'utf8');
    copyTexSupport(outDir, texOpts.style, res);
    return r;
  };
  progress('tex', '生成 TeX');
  let rendered = write();
  const result = {
    outDir, texPath: path.join(outDir, 'main.tex'), pdfPath: null, title: conv.title, platform: conv.platformName,
    turns: rendered.turns, messages: conv.messages.length, style: texOpts.style, warnings, log: '', engine: null, repaired: 0,
  };
  if (options.compile === false) return result;

  const engine = options.engine || findEngines({ resourcesDir: options.resourcesDir })[0];
  if (!engine) {
    warnings.push('没有找到 TeX 引擎，只生成了 .tex 文件。可安装 TeX Live / MiKTeX，或把 main.tex 所在文件夹上传到 Overleaf 用 XeLaTeX 编译。');
    return result;
  }
  result.engine = engine.label;
  const maxAttempts = options.maxAttempts ?? 30;
  let last;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    progress('compile', attempt ? `重新编译（已修复 ${fallback.size} 处）` : `编译 PDF（${engine.label}）`);
    last = await compileOnce(engine, outDir, { passes: 1, timeout: options.timeout });
    if (last.ok) break;
    if (last.killed) throw new Error('编译超时');
    const bodyStart = rendered.tex.split('\n').findIndex((l) => l.startsWith('\\begin{document}')) + 1;
    const mainErrors = last.errors.filter((e) => e.file === 'main.tex' && e.line > 0);
    const err = mainErrors[0];
    if (!err || err.line <= bodyStart) {
      // Preamble trouble: usually a font. Retry with fonts every TeX has, then the simpler style.
      if (!texOpts.safeFonts) {
        texOpts.safeFonts = true;
        warnings.push('本机字体在 TeX 中加载失败，改用 TeX 自带字体');
        result.fontError = (last.errors[0] && `${last.errors[0].file}:${last.errors[0].line}: ${last.errors[0].message}`) || last.out.slice(-600);
        rendered = write();
        continue;
      }
      if (texOpts.style === 'notes') {
        texOpts.style = 'chat';
        warnings.push('讲义版式编译失败，已改用对话版式');
        rendered = write();
        continue;
      }
      const first = last.errors[0];
      const e = new Error(`TeX 编译失败：${first ? first.message : '未知错误'}`);
      e.log = last.log;
      throw e;
    }
    let frag = fragmentAt(rendered.map, err.line);
    // Already in its safe form and still failing: widen to the enclosing fragment.
    while (frag && fallback.has(frag.id)) {
      const parentId = frag.id.split('.').slice(0, -1).join('.');
      frag = rendered.map.find((f) => f.id === parentId) || null;
      if (!frag) break;
    }
    if (!frag) {
      const e = new Error(`TeX 编译失败（第 ${err.line} 行）：${err.message}`);
      e.log = last.log;
      throw e;
    }
    fallback.add(frag.id);
    // TeX recovers at the end of a formula, so later errors that land inside
    // other formulas are independent: repair them in the same round.
    for (const e of mainErrors.slice(1, 40)) {
      if (e.line === err.line) continue;
      const f = fragmentAt(rendered.map, e.line);
      if (f && f.start <= e.line && e.line <= f.end && (f.kind === 'math' || f.kind === 'display') && !fallback.has(f.id)) fallback.add(f.id);
    }
    rendered = write();
  }
  result.log = last?.log || '';
  if (!last?.ok) {
    const e = new Error('多次修复后仍无法编译');
    e.log = result.log;
    throw e;
  }
  // Second pass for the table of contents and PDF bookmarks.
  if (engine.kind === 'xelatex') {
    progress('compile', '生成目录与书签');
    const again = await compileOnce(engine, outDir, { passes: 1, timeout: options.timeout });
    if (again.ok) last = again;
  }
  const kinds = new Map();
  for (const id of fallback) {
    const f = rendered.map.find((x) => x.id === id);
    if (f) kinds.set(describeFragment(conv, f), (kinds.get(describeFragment(conv, f)) || 0) + 1);
  }
  for (const [k, n] of kinds) warnings.push(`${n} 处${k}无法用 LaTeX 排出，已在 PDF 中以源码形式保留`);
  result.repaired = fallback.size;
  result.style = texOpts.style;
  result.cjkFont = cjkFontFromLog(last.log);
  const pdfName = `${name}.pdf`;
  const pdfPath = path.join(outDir, pdfName);
  fs.copyFileSync(last.pdf, pdfPath);
  try { fs.rmSync(last.pdf); } catch { /* keep */ }
  cleanAux(outDir);
  result.pdfPath = pdfPath;
  progress('done', '完成');
  return result;
}

export { findEngines } from './compile.js';
export { detectFonts } from './latex/fonts.js';
export { inlinePlain };
