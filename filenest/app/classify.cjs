'use strict';
// 学科大类判断：先分大类，再按 Topics 分到细分主题。全部在本地按文件名（以及少量文本开头）计算，不联网。
const fs = require('node:fs');
const path = require('node:path');
const { readPdf } = require('./pdf.cjs');

const FALLBACK = '其他';

const DEFAULT_CATEGORIES = [
  { Name: '数学', Extensions: [], DefaultTopic: '讲义与综合', Keywords: [
    '数学', '数分', '高数', '高等数学', '微积分', '积分', '微分', '导数', '求导', '极限', '级数', '渐近', '不等式', '方程', '函数',
    '代数', '线性代数', '线代', '矩阵', '行列式', '特征值', '向量', '几何', '拓扑', '流形', '曲率', '曲线', '曲面', '纽结', '扭结',
    '同调', '同伦', '群论', '表示论', '数论', '组合', '图论', '概率', '统计', '随机', '布朗运动', '鞅', '马尔可夫', '测度', '实变',
    '复变', '泛函', '数学分析', '实分析', '复分析', '傅里叶', '傅立叶', '反演', '卡特兰', '定理', '引理', '证明', '题库', '竞赛',
    '奥数', '高联', '一试', '二试', '领军', '英才班', '丘成桐', '求真', '王者百题', '数值分析', '数值积分', '最优化', '张量', '范畴',
    '交换代数', '代数几何', '微分几何', '偏微分', '常微分', '动力系统', '迭代', '反正弦律', '可积', '换元', '多项式',
    '检验', '回归', '边形', '单位球', '数理', '零试', '批改', '卡方', '分布', '中心极限', '大数定律', '波利亚', '插值', '四顶点', '李群', '伽罗瓦', '简章', '考纲', 'regression', 'optimiz',
    'math', 'maths', 'mathematic', 'calculus', 'algebra', 'geometr', 'topolog', 'integral', 'series', 'asymptotic', 'matri',
    'theorem', 'lemma', 'proof', 'probabilit', 'statistic', 'stochastic', 'brownian', 'martingale', 'knot', 'seifert', 'tensor',
    'homolog', 'manifold', 'fourier', 'eigen', 'combinator', 'napkin', 'putnam', 'imo', 'cmc', 'qiuzhen', 'lickorish', 'poisson', 'sturm'
  ], Topics: [
    { Name: '领军与升学', Keywords: ['领军', '英才班', '丘成桐', '求真', '清华', '零试', '招生', '简章', '博士资格', '诺特', '拔尖', '省一', '成绩', '排名', '考纲', 'qiuzhen', 'ymsc', 'tsinghua', 'qinghua'] },
    { Name: '竞赛与题库', Keywords: ['竞赛', '高联', '联赛', '一试', '二试', '题库', '王者百题', '原创题', '练习', '习题', '例题', '模拟', '试卷', '题目', '命题', '批改', '解答', '题解', '一题一页', '训练', '数之谜', 'cmc', 'xmo', 'imo', 'olympiad', 'putnam', 'problem', 'competition', 'gaolian'] },
    { Name: '概率与统计', Keywords: ['概率', '统计', '随机', '布朗', '鞅', '检验', '回归', '中心极限', '大数定律', '马尔可夫', '卡方', '特征函数', '分布', '波利亚', 'probabilit', 'statistic', 'stochastic', 'brownian', 'martingale', 'poisson', 'regression'] },
    { Name: '数值分析与优化', Keywords: ['数值', '最优化', '优化', '插值', '迭代', 'optimiz', 'numerical', 'quadrature'] },
    { Name: '几何与拓扑', Keywords: ['几何', '拓扑', '纽结', '扭结', '曲线', '曲面', '曲率', '流形', '同调', '同伦', '四顶点', '张量', 'knot', 'seifert', 'topolog', 'geometr', 'manifold', 'homolog', 'tensor', 'lickorish', 'ega', 'sga'] },
    { Name: '代数与数论', Keywords: ['代数', '线性代数', '矩阵', '行列式', '特征值', '群', '表示论', '数论', '多项式', '交换代数', '李群', '伽罗瓦', 'algebra', 'matri', 'eigen', 'burnside'] },
    { Name: '分析与微积分', Keywords: ['积分', '级数', '渐近', '微积分', '数分', '数学分析', '实变', '复变', '傅里叶', '极限', '不等式', '导数', '求导', '微分方程', '反演', 'integral', 'series', 'asymptotic', 'fourier', 'sturm', 'calculus'] }
  ] },
  { Name: '物理', Extensions: [], DefaultTopic: '综合与备考', Keywords: [
    '物理', '力学', '理论力学', '经典力学', '电动力学', '电磁', '电荷', '电场', '磁场', '磁势', '磁偶极', '电流', '量子', '热力学',
    '统计物理', '相对论', '场论', '光学', '天体', '宇宙', '粒子', '原子', '核物理', '凝聚态', '动量', '开普勒', '万有引力', '四大力学',
    'physics', 'quantum', 'electrodynamic', 'mechanics', 'relativity', 'thermodynamic', 'optics', 'electromagnet'
  ], Topics: [
    { Name: '综合与备考', Keywords: ['四大力学', '物理竞赛', '冲刺', '备考', '大学物理', '普通物理', '现学现考'] },
    { Name: '电磁与相对论', Keywords: ['电动', '电磁', '电荷', '电场', '磁场', '磁势', '磁偶极', '相对论', '场论', 'electro', 'relativity'] },
    { Name: '量子与热统', Keywords: ['量子', '热力学', '统计物理', 'quantum', 'thermodynamic'] },
    { Name: '力学', Keywords: ['力学', '开普勒', '万有引力', '轨道', '振动', '拉格朗日', '摆', 'mechanics', 'lagrange'] }
  ] },
  { Name: '英语', Extensions: [], DefaultTopic: '学习资料', Keywords: [
    '英语', '英文', '单词', '词汇', '词频', '语法', '阅读理解', '完形', '听力', '口语', '雅思', '托福', '四级', '六级', '音标', '自然拼读',
    'english', 'vocabulary', 'vocab', 'phonics', 'grammar', 'ielts', 'toefl', 'subtlex'
  ], Topics: [
    { Name: '词汇', Keywords: ['单词', '词汇', '词频', '核心100词', 'vocabulary', 'vocab', 'subtlex'] },
    { Name: '试卷与测评', Keywords: ['试卷', '试题', '诊断', '摸底', '考情', '真题', '高考', 'tda'] }
  ] },
  { Name: '化学与生物', Extensions: [], Keywords: [
    '化学', '生物', '有机', '无机', '细胞', '遗传', '基因', '生态', 'chemistry', 'biology'
  ] },
  // 网页另存（多是 AI 对话）不再按 .html 扩展名归到这里，而是看标题内容。
  { Name: '编程与软件', Extensions: ['exe', 'msi', 'apk', 'dmg', 'iso', 'py', 'js', 'ts', 'cpp', 'c', 'h', 'hpp', 'java', 'go', 'rs', 'ipynb', 'bat', 'ps1', 'sh', 'jar', 'skill'], Keywords: [
    '编程', '程序', '代码', '算法', '数据结构', '计算机', '信息学', '软件', '安装', '插件', '网站', '网页', '前端', '后端', '脚本',
    'code', 'coding', 'program', 'python', 'java', 'javascript', 'cpp', 'c++', 'csp', 'noip', 'leetcode', 'algorithm', 'api',
    'github', 'skill', 'setup', 'install', 'site', 'web', 'app', 'server', 'docker', 'linux', 'vscode', 'dev', 'codex'
  ], Topics: [
    { Name: '安装包', Keywords: ['setup', 'install', '安装'], Extensions: ['exe', 'msi', 'apk', 'dmg', 'iso'] },
    { Name: '信息学竞赛', Keywords: ['信息学', '算法', '数据结构', 'csp', 'noip', 'oi', 'cpp', 'c++', 'leetcode', 'algorithm'] },
    { Name: 'AI技能与工具', Keywords: ['skill', '插件', '提示词', 'claude', 'chatgpt', 'codex', 'gpt', 'openai', 'prompt', 'agent', 'latex'], Extensions: ['skill'] },
    { Name: '网站与网页', Keywords: ['网站', '网页', '主页', '前端', 'site', 'web', 'index', 'resume', 'homepage'] },
    { Name: '应用与游戏', Keywords: ['游戏', '应用', 'game', 'app', 'roguelike'] }
  ] },
  // 媒体按扩展名优先（权重高于标题里的学科词），再按标题细分。
  { Name: '视频音频', ExtensionScore: 10, DefaultTopic: '短片与其他', Keywords: ['视频', '音频', '录音', '录屏'], Extensions: ['mp4', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'webm', 'm4v', 'mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma'], Topics: [
    { Name: '音乐与音频', Keywords: ['音乐', '歌', 'music', 'melody', 'song'], Extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma'] },
    { Name: '数学科普视频', Keywords: ['数学', '代数', '几何', '拓扑', '同调', '李群', '域论', '扭结', '纽结', '数值分析', '定理', '证明', '群论', 'knot', 'langlands', 'homology', 'algebra', 'geometr', 'topolog', 'theorem', 'class_field', 'fixed_point', 'math'] }
  ] },
  { Name: '图片', ExtensionScore: 10, Keywords: ['图片', '照片', '截图', '壁纸'], Extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff', 'ico'] }
];

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.tex']);

function cleanList(values, lower = true) {
  const seen = new Set(), out = [];
  for (const raw of Array.isArray(values) ? values : []) {
    let v = String(raw ?? '').normalize('NFKC').trim();
    if (lower) v = v.toLowerCase();
    v = v.replace(/^\.+/, '');
    if (!v || v.length > 40 || seen.has(v)) continue;
    seen.add(v); out.push(v);
  }
  return out;
}

function prepareKeywords(list) {
  return cleanList(list).map(k => ({ text: k, latin: /^[\x00-\x7f]+$/.test(k), re: /^[\x00-\x7f]+$/.test(k) ? new RegExp('(?<![a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : null }));
}

function prepare(categories) {
  return (Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES).map(c => ({
    name: String(c.Name),
    keywords: prepareKeywords(c.Keywords),
    extensions: new Set(cleanList(c.Extensions)),
    extensionScore: Number(c.ExtensionScore) > 0 ? Number(c.ExtensionScore) : 1.5,
    // 大类下的细分主题：命中关键词/扩展名得分最高者；都不命中时用 DefaultTopic（为空则直接放在大类文件夹里）。
    topics: (Array.isArray(c.Topics) ? c.Topics : []).map(t => ({ name: String(t.Name), keywords: prepareKeywords(t.Keywords), extensions: new Set(cleanList(t.Extensions)) })),
    defaultTopic: c.DefaultTopic ? String(c.DefaultTopic) : ''
  }));
}

function pickTopic(c, name, ext, extra) {
  let best = null;
  for (const t of c.topics) {
    const inName = hits(t, name);
    let score = inName.length * 2 + (ext && t.extensions.has(ext) ? 1.5 : 0);
    if (extra) score += Math.min(2, hits(t, extra).filter(k => !inName.includes(k)).length * 0.5);
    if (score > 0 && (!best || score > best.score)) best = { name: t.name, score };
  }
  return best ? best.name : c.defaultTopic;
}

function normalizeName(name) { return String(name).normalize('NFKC').toLowerCase(); }

function hits(prepared, haystack) {
  const found = [];
  for (const k of prepared.keywords) {
    if (k.latin ? k.re.test(haystack) : haystack.includes(k.text)) found.push(k.text);
  }
  return found;
}

function readTextProbe(file) {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(16384);
      const n = fs.readSync(fd, buffer, 0, buffer.length, 0);
      const text = buffer.subarray(0, n).toString('utf8');
      return text.includes('\0') ? '' : normalizeName(text);
    } finally { fs.closeSync(fd); }
  } catch { return ''; }
}

// 目录：用它自己的名字 + 里面一部分文件名一起判断。
function directoryProbe(dir, limit = 200) {
  const names = [];
  const walk = (d, depth) => {
    if (names.length >= limit || depth > 2) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (names.length >= limit) return;
      names.push(e.name);
      if (e.isDirectory() && !e.isSymbolicLink()) walk(path.join(d, e.name), depth + 1);
    }
  };
  walk(dir, 0);
  return normalizeName(names.join(' '));
}

/**
 * 判断一个文件或文件夹属于哪个学科大类。
 * 打分：文件名命中关键词每个 +2（命中大类名本身再 +3）；扩展名匹配 +1.5；
 * 文本文件开头/文件夹内文件名命中关键词每个 +0.5（每类最多 +2）。最高分胜出，平分按列表顺序。
 */
// displayName：按改名后的名字判断；sig：文件签名，用于 PDF 读取缓存。
function categorize(fullPath, { categories, isDirectory = false, fallback = FALLBACK, probe = true, displayName = null, sig = '' } = {}) {
  const prepared = Array.isArray(categories) && categories.length && categories[0].keywords ? categories : prepare(categories);
  const base = displayName || path.basename(fullPath);
  const ext = isDirectory ? '' : path.extname(base).slice(1).toLowerCase();
  const name = normalizeName(isDirectory ? base : base.slice(0, base.length - (ext ? ext.length + 1 : 0)));
  let extra = '';
  if (probe) {
    if (isDirectory) extra = directoryProbe(fullPath);
    else if (TEXT_EXTENSIONS.has('.' + ext)) extra = readTextProbe(fullPath);
    else if (ext === 'pdf') { const info = readPdf(fullPath, sig); if (info) extra = normalizeName(info.title + ' ' + info.text); }
  }
  let best = null;
  for (const c of prepared) {
    const inName = hits(c, name);
    let score = inName.length * 2 + (inName.includes(normalizeName(c.name)) ? 3 : 0);
    const reasons = inName.map(k => '“' + k + '”');
    if (ext && c.extensions.has(ext)) { score += c.extensionScore; reasons.push('.' + ext + ' 文件'); }
    if (extra) {
      const inside = hits(c, extra).filter(k => !inName.includes(k));
      if (inside.length) { score += Math.min(2, inside.length * 0.5); reasons.push((isDirectory ? '内含' : '正文含') + inside.slice(0, 3).map(k => '“' + k + '”').join('')); }
    }
    if (score > 0 && (!best || score > best.score)) best = { category: c.name, score, reasons, c };
  }
  if (!best) return { category: fallback, topic: '', score: 0, reason: '没有命中任何分类关键词，放入“' + fallback + '”' };
  const topic = pickTopic(best.c, name, ext, extra);
  return { category: best.category, topic, score: best.score, reason: '命中 ' + best.reasons.slice(0, 4).join('、') + ' → ' + best.category + (topic ? ' / ' + topic : '') };
}

function safeLabel(label) {
  let s = String(label ?? '').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (s.length > 40) s = s.slice(0, 40).trim();
  if (!s || /^\d{4}-\d{2}(-\d{2})?$/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s)) return '';
  return s;
}

module.exports = { DEFAULT_CATEGORIES, FALLBACK, prepare, categorize, safeLabel };
