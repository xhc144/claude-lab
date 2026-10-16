// End to end: saved page → main.tex (+ images, class files) → PDF.

import fs from 'node:fs';
import path from 'node:path';
import { loadInput, loadHtmlString, mimeFromName } from './load.js';
import { extractConversation } from './extract.js';
import { renderTex } from './latex/document.js';
import { fragmentAt, inlinePlain } from './latex/writer.js';
import { detectFonts } from './latex/fonts.js';
import { renderHtmlDocument } from './html.js';
import { normalizeLayout, normalizeOverrides } from './layout.js';
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
  for (let i = 2; fs.existsSync(dir) && fs.readdirSync(dir).some((f) => !/^(main\.(tex|log|pdf)|moteng(-compat)?\.sty|moteng-layout\.json|mojing-.*|images|.*\.(pdf|html))$/.test(f)); i++) {
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
        const out = await opts.convertImage(bytes, mime);
        if (out && out.pdf) {
          // Vector drawing (SVG): a PDF for TeX, a PNG twin for the preview and the HTML export.
          fs.mkdirSync(imgDir, { recursive: true });
          const stem = `images/img-${++n}`;
          fs.writeFileSync(path.join(outDir, `${stem}.pdf`), out.pdf);
          if (out.png) fs.writeFileSync(path.join(outDir, `${stem}.png`), out.png);
          b.file = `${stem}.pdf`;
          if (out.width) b.pxWidth = out.width;
          seen.set(b.src, b.file);
          continue;
        }
        if (out) { bytes = out; mime = 'image/png'; }
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
  // TeX wraps log lines at 79 columns; fontspec continues them with "(fontspec)   ".
  // (fontspec breaks at a space, TeX itself mid-word).
  const flat = String(log || '').replace(/\r?\n\(fontspec\)\s+/g, ' ').replace(/\r?\n/g, '');
  // fontspec reports every face it opens as <->"[file.ttc:2]/OT…" or <->"Family Name/OT…".
  const faces = [...flat.matchAll(/<->"(?:\[([^\]]+)\]|([^"[\/]+))\//g)]
    .map((m) => (m[1] || m[2]).split(/[\\/]/).pop().replace(/:\d+$/, '').replace(/\.(ttc|ttf|otf)$/i, '').trim());
  // The class loads Fandol first and our font block overrides it, so the last
  // serif CJK face opened is the body font.
  const serif = faces.filter((f) => /sim|songti|serif|fandolsong|^stsong/i.test(f) && !/hei|sans|msyh|yahei|kai|fang|mono|deng|bold/i.test(f));
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
  const loaded = input && typeof input === 'object' && input.html !== undefined ? loadHtmlString(input.html, input) : loadInput(input);
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
/**
 * Read the page, collect its images and (when the app provides `snapshot`) capture its charts and
 * widgets, all into `workDir`. The result can be built several times with different layouts.
 */
export async function prepare(input, options = {}) {
  const progress = options.onProgress || (() => {});
  const warnings = [];
  progress('read', '读取网页');
  const { loaded, conv } = readConversation(input, { includeThinking: options.includeThinking, title: options.title, platform: options.platform });
  if (!conv.messages.length) throw new Error('没有在这个网页里找到对话内容。请确认保存的是对话页面（Ctrl+S 保存“网页，全部”或“单个文件”）。');
  if (conv.generic) warnings.push('没有识别出网站类型，按通用规则提取；请检查问答是否完整');
  const workDir = options.workDir;
  fs.mkdirSync(workDir, { recursive: true });
  progress('images', '整理图片');
  await collectImages(conv, loaded, workDir, options, warnings);
  if (options.snapshot && conv.dynamicCount) {
    progress('snapshot', '截取图表与交互组件');
    try {
      await options.snapshot({ conv, loaded, workDir, warnings, input });
    } catch (e) {
      warnings.push(`图表与交互组件没能截取（${e.message}），以文字代替`);
    }
  }
  const missingDyn = [];
  forEachDynamic(conv, (b) => { if (b.t === 'dynamic' && !b.file && b.kind !== 'canvas') missingDyn.push(b); });
  if (missingDyn.length) warnings.push(`${missingDyn.length} 处图表或交互内容${options.snapshot ? '没能截取画面' : '需要在墨誊窗口中转换才能截取画面（命令行没有浏览器）'}，PDF 中以文字说明代替`);
  return { loaded, conv, warnings, workDir, input };
}

export function forEachDynamic(conv, fn) {
  const walk = (bs) => (bs || []).forEach((b) => {
    if (b.t === 'dynamic' || (b.t === 'note' && b.kind === 'widget' && b.dyn)) fn(b);
    if (b.items) b.items.forEach(walk);
    if (b.blocks) walk(b.blocks);
  });
  for (const m of conv.messages) walk(m.blocks);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function dataUrl(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf', webp: 'image/webp', gif: 'image/gif' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** The interactive HTML file for a prepared conversation (images inlined). */
export function writeHtmlExport(prepared, outFile, options = {}) {
  const base = prepared.workDir;
  const html = renderHtmlDocument(prepared.conv, {
    layout: options.layout,
    overrides: options.overrides,
    includeQuestions: options.includeQuestions,
    pageColors: options.pageColors,
    imageUrl: (f) => {
      // PDF pictures (vector charts) have a PNG twin for the browser.
      const png = f.replace(/\.pdf$/i, '.png');
      const pick = /\.pdf$/i.test(f) && fs.existsSync(path.join(base, png)) ? png : f;
      try { return dataUrl(path.join(base, pick)); } catch { return pick; }
    },
  });
  fs.writeFileSync(outFile, html, 'utf8');
  return outFile;
}

/**
 * @param {string|{html:string,name?:string,url?:string}|{path:string,index:number}} input
 * @param {object} options
 *   style: 'chat' | 'notes'           版式
 *   layout, overrides                 排版设置与逐个元素的调整（layout.js）
 *   outRoot: string                   输出根目录（每次转换建一个子文件夹）
 *   compile: boolean                  是否生成 PDF（默认 true）
 *   exportHtml: boolean               同时输出可交互的 HTML
 *   engine: engine object | null      findEngines() 的一项；省略则自动选择
 *   prepared                          prepare() 的结果（应用里预览过的同一份文档）
 *   resourcesDir, includeThinking, includeQuestions, title, toc
 *   fetchImages, convertImage(bytes, mime) → png bytes, snapshot({conv, loaded, workDir})
 *   onProgress(stage, detail)
 */
export async function convert(input, options = {}) {
  const progress = options.onProgress || (() => {});
  let style = options.style === 'notes' ? 'notes' : 'chat';
  const inPath = typeof input === 'string' ? input : input && input.path;
  const outRoot = options.outRoot || path.dirname(inPath ? path.resolve(inPath) : process.cwd());
  let prepared = options.prepared;
  let outDir = options.outDir;
  if (!prepared) {
    // Read first to learn the title, then prepare straight into the output folder.
    const { conv } = readConversation(input, { includeThinking: options.includeThinking, title: options.title, platform: options.platform });
    outDir = outDir || uniqueDir(outRoot, safeName(options.title || conv.title));
    prepared = await prepare(input, { ...options, workDir: outDir });
  }
  const { conv } = prepared;
  const warnings = [...prepared.warnings];
  const name = safeName(options.title || conv.title);
  outDir = outDir || uniqueDir(outRoot, name);
  fs.mkdirSync(outDir, { recursive: true });
  if (path.resolve(prepared.workDir) !== path.resolve(outDir)) copyDir(path.join(prepared.workDir, 'images'), path.join(outDir, 'images'));
  try {
    fs.writeFileSync(path.join(outDir, 'moteng-layout.json'), JSON.stringify({ style, layout: normalizeLayout(options.layout), overrides: normalizeOverrides(options.overrides) }, null, 2));
  } catch { /* optional */ }
  let htmlPath = null;
  if (options.exportHtml) {
    progress('html', '生成交互式 HTML');
    htmlPath = writeHtmlExport(prepared, path.join(outDir, `${name}.html`), options);
  }

  const res = texResources(options.resourcesDir);
  const fonts = options.fonts === undefined ? detectFonts() : options.fonts;
  const texOpts = { ...options, style, fonts, safeFonts: !!options.safeFonts, noFakeSlant: !!options.noFakeSlant };
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
    outDir, texPath: path.join(outDir, 'main.tex'), pdfPath: null, htmlPath, title: conv.title, platform: conv.platformName,
    turns: rendered.turns, messages: conv.messages.length, style: texOpts.style, warnings, log: '', engine: null, repaired: 0,
    dynamic: (() => { let total = 0; let captured = 0; forEachDynamic(conv, (b) => { total++; if (b.file) captured++; }); return { total, captured }; })(),
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
    if (process.env.MOTENG_DEBUG) console.error('[moteng] compile error', err || last.errors[0], last.code, last.signal);
    // Some XeTeX builds crash on fake-slanted CJK faces (Tectonic with Noto CJK on Linux); the log
    // then ends at an innocent line. Retry once without fake slant before blaming that line.
    const crashed = last.code !== 0 && (last.signal || last.code > 128 || last.code < 0);
    if (crashed && !texOpts.noFakeSlant && texOpts.fonts && !texOpts.safeFonts) {
      texOpts.noFakeSlant = true;
      rendered = write();
      continue;
    }
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
    if (!frag && !texOpts.noFakeSlant && texOpts.fonts && !texOpts.safeFonts) {
      texOpts.noFakeSlant = true;
      rendered = write();
      continue;
    }
    if (!frag && !texOpts.safeFonts) {
      texOpts.safeFonts = true;
      warnings.push('本机字体在 TeX 中加载失败，改用 TeX 自带字体');
      rendered = write();
      continue;
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
