'use strict';
// PDF 读取：取标题和前两页文字，用来给“看不出内容”的文件名改名、辅助分类。
// 依赖 poppler 的 pdfinfo / pdftotext（TeX Live 自带）；找不到时一切照旧，只是不读内容。
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

let tools;
function findTools() {
  if (tools !== undefined) return tools;
  const exe = process.platform === 'win32' ? '.exe' : '';
  // 优先 TeX Live 自带的（中文字体映射完整；Git 自带的那份读中文常是乱码），再找 PATH
  const dirs = [];
  if (process.platform === 'win32') {
    try { for (const v of fs.readdirSync('C:\\texlive').sort().reverse()) dirs.push(path.join('C:\\texlive', v, 'bin', 'windows')); } catch {}
  }
  dirs.push(...(process.env.PATH || '').split(path.delimiter).filter(Boolean));
  const find = name => { for (const d of dirs) { const p = path.join(d, name + exe); try { if (fs.statSync(p).isFile()) return p; } catch {} } return null; };
  const info = find('pdfinfo'), text = find('pdftotext');
  tools = info && text ? { info, text } : null;
  return tools;
}

const run = (exe, args) => execFileSync(exe, args, { encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

// 按文件签名缓存，计划每 15 秒跑一次，不重复读。
const cache = new Map();

/** 读 PDF：{ title, text }；读不了返回 null。 */
function readPdf(file, sig) {
  const t = findTools();
  if (!t) return null;
  const key = file + '|' + (sig || '');
  if (cache.has(key)) return cache.get(key);
  let out = null;
  try {
    let title = '';
    try { const m = /^Title:\s*(.*)$/m.exec(run(t.info, ['-enc', 'UTF-8', file])); if (m) title = m[1].trim(); } catch {}
    let text = '';
    try { text = run(t.text, ['-enc', 'UTF-8', '-l', '2', file, '-']); } catch {}
    out = { title, text: text.slice(0, 16384) };
  } catch { out = null; }
  if (cache.size > 500) cache.clear();
  cache.set(key, out);
  return out;
}

const GENERIC = new Set([
  'main', 'document', 'untitled', 'output', 'out', 'download', 'downloads', 'file', 'files', 'new', 'temp', 'tmp', 'test',
  'handout', 'notes', 'note', 'lecture', 'lectures', 'paper', 'draft', 'preview', 'print', 'scan', 'export', 'result',
  'solution', 'solutions', 'answer', 'answers', 'report', 'book', 'slides', 'index', 'article', 'thesis', 'final',
  '讲义', '笔记', '文档', '未命名', '新建', '下载', '文件', '论文', '报告', '答案', '解答', '题目', '试卷', '作业', '资料', '扫描件', '预览'
]);

/** 文件名（不含扩展名）是否“看不出内容”：乱码、纯数字/编号、main、讲义 这类通用名。 */
function isMeaninglessName(stem) {
  let s = String(stem).normalize('NFKC').trim();
  // 去掉 “(2)”“_1”“-v3”“ copy” 这类尾巴再判断
  s = s.replace(/(\s*[(（]\d+[)）]|[\s_-]+(v?\d+|copy|副本|final|最终版?))+$/i, '').trim();
  if (!s) return true;
  if (GENERIC.has(s.toLowerCase())) return true;
  if (/^[\d\s._-]+$/.test(s)) return true;                               // 纯数字、日期
  if (/^[0-9a-f]{8}(-?[0-9a-f]{4}){3}-?[0-9a-f]{12}$/i.test(s)) return true;  // UUID
  // 网址编码残留的乱码：大部分是大写十六进制和 %
  const hex = (s.match(/[0-9A-F%]/g) || []).length;
  if (s.length >= 8 && hex / s.length >= 0.6 && /[0-9]/.test(s) && /[A-F]/.test(s)) return true;
  return false;
}

function cleanTitle(s) {
  // 文件名里不能用的符号换成全角，标题里的冒号、问号还能保留
  let t = String(s || '').normalize('NFKC').replace(/:/g, '：').replace(/\?/g, '？').replace(/\|/g, '｜')
    .replace(/[<>"/\\*\x00-\x1f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').replace(/\s*([：？｜])\s*/g, '$1').trim();
  t = t.replace(/^(microsoft (word|powerpoint) - )/i, '').replace(/\.(tex|docx?|pptx?|dvi|pdf)$/i, '').trim();
  if (t.length > 60) t = t.slice(0, 60).trim();
  return t.replace(/[. ]+$/, '');
}

function usableTitle(t) {
  if (!t || t.length < 2) return false;
  if (isMeaninglessName(t)) return false;
  if (/^(untitled|latex with hyperref|original|skill compiled)\b|\bpage \d+\b|^第\s*\d+\s*页$/i.test(t)) return false;
  // 解码错误的元数据会是一堆冷僻文字：要求字母大部分是中文、拉丁、希腊或西里尔字母
  const letters = (t.match(/\p{L}/gu) || []).length;
  const common = (t.match(/[\p{Script=Han}\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]/gu) || []).length;
  if (!letters || common / letters < 0.8) return false;
  return /\p{Script=Han}{2}|[A-Za-z]{3}/u.test(t);   // 至少两个汉字或一个英文单词，排除公式碎片
}

/** 从 PDF 标题或首页文字里挑一个文件名；挑不出返回 ''。 */
function titleFromPdf(info) {
  if (!info) return '';
  const meta = cleanTitle(info.title);
  if (usableTitle(meta)) return meta;
  const lines = info.text.split(/\r?\n|\f/).map(cleanTitle).filter(l => usableTitle(l) && l.length <= 60 && !/^[\d\s.、)）]+/.test(l));
  if (!lines.length) return '';
  const first = lines[0];
  // 很短的大标题（如“进阶九学”）带上紧接着的副标题
  if (first.length < 6 && lines[1] && lines[1] !== first && lines[1].length <= 30) return cleanTitle(first + '_' + lines[1]);
  return first;
}

/** 文件名里没有中文（纯英文、数字、符号）。 */
function hasNoChinese(stem) { return !/\p{Script=Han}/u.test(String(stem)); }

/** PDF 里的中文标题：元数据标题或首页靠前的一行短标题（至少两个汉字，不像正文句子）；没有返回 ''。 */
function chineseTitleFromPdf(info) {
  if (!info) return '';
  // 至少三个汉字（排除“区域 2”这类图中标签），不像正文句子
  const ok = t => usableTitle(t) && (t.match(/\p{Script=Han}/gu) || []).length >= 3 && t.length <= 40 && !/[，。；！,;]/.test(t) && !/^(设|若|例|证明|解|已知|求|定义|定理|注)/.test(t);
  const strip = t => cleanTitle(t).replace(/^(第\s*\d+\s*[章节讲]|\d+(\.\d+)*)\s+/, '');   // 去掉开头的章节号
  const meta = strip(info.title);
  if (ok(meta)) return meta;
  const page = info.text.split('\f')[0];
  if ((page.match(/\p{Script=Han}/gu) || []).length < 40) return '';   // 首页几乎没字（多是图集），里面的短行是图注，不当标题
  const head = page.split(/\r?\n/).map(strip).filter(Boolean).slice(0, 12);
  return head.find(ok) || '';
}

/** 英文文件名加上中文：“中文标题_原英文名”；原名本来就没意义（main、handout…）时只用中文标题；取不到中文返回 ''。 */
function bilingualName(stem, info) {
  const zh = chineseTitleFromPdf(info);
  if (!zh) return '';
  return isMeaninglessName(stem) ? zh : zh + '_' + stem;
}

module.exports = { readPdf, isMeaninglessName, titleFromPdf, findTools, hasNoChinese, chineseTitleFromPdf, bilingualName };
