// Shared vocabulary of the star map: galaxies (subject areas), relation types, node kinds and levels.
// Imported by the browser app and by scripts/build.mjs, so the knowledge base and the UI agree.

export const GALAXIES = [
  {
    id: 'hs', name: '高中数学', en: 'School Mathematics', hue: 212, syllabus: ['M0'],
    desc: '集合与逻辑、函数、三角、数列、不等式、向量、复数、导数初步——所有星系共同的引力中心。',
  },
  {
    id: 'analysis', name: '数学分析', en: 'Analysis', hue: 268, syllabus: ['M1-A'],
    desc: '实数、极限、单变量与多元微积分、级数、傅里叶级数、常微分方程，并向测度、复分析与泛函拓展。',
  },
  {
    id: 'algebra', name: '代数', en: 'Algebra', hue: 322, syllabus: ['M1-L', 'M1-G'],
    desc: '线性代数（矩阵、向量空间、若尔当标准形、谱定理、张量积）与群论（西罗定理、表示与特征标），拓展到环、域与数论。',
  },
  {
    id: 'geometry', name: '几何与拓扑', en: 'Geometry & Topology', hue: 140, syllabus: ['M1-T'],
    desc: '平面、立体与解析几何，凸性、染色、三角剖分、欧拉数、图论、纽结与亏格，实数轴的拓扑与曲线微分几何。',
  },
  {
    id: 'prob', name: '概率统计与组合', en: 'Probability, Statistics & Combinatorics', hue: 44, syllabus: ['M2-P', 'M2-C', 'M2-S'],
    desc: '计数原理、抽屉与容斥、递推；概率模型、随机变量、随机游走与极限定理；抽样、估计、检验与回归。',
  },
  {
    id: 'applied', name: '应用数学', en: 'Applied Mathematics', hue: 12, syllabus: ['M2-N', 'M2-L', 'M2-O'],
    desc: '误差与近似计算、方程求根、插值逼近、数值积分；矩阵分解与迭代法、特征值计算；凸优化、梯度下降与线性规划。',
  },
  {
    id: 'physics', name: '物理', en: 'Physics', hue: 186, syllabus: ['P'],
    desc: '力学、热学、电磁学、振动波动与光学、近代物理，以及实验、量纲分析与数量级估算。',
  },
];

// Relation s → t. `out` labels t as seen from s; `in` labels s as seen from t.
export const RELATIONS = {
  pre: { name: '前置', color: '#7fb4ff', dash: [], arrow: true, out: '后续知识', in: '前置知识', desc: 'A 是学习 B 的前置' },
  der: { name: '推导', color: '#ffd166', dash: [], arrow: true, flow: true, out: '由此推出', in: '推导自', desc: '由 A 推导出 B' },
  gen: { name: '推广', color: '#c49bff', dash: [12, 6], arrow: true, out: '推广为', in: '特例', desc: 'B 是 A 的推广' },
  eq: { name: '等价', color: '#4ee3c1', dash: [], double: true, out: '等价于', in: '等价于', desc: 'A 与 B 等价' },
  app: { name: '应用', color: '#ff8a65', dash: [2, 6], arrow: true, out: '应用于', in: '用到', desc: 'A 应用于 B' },
  ex: { name: '例子', color: '#ff9ad5', dash: [6, 4], arrow: true, out: '例子', in: '是其例子', desc: 'B 是 A 的例子' },
  rel: { name: '相关', color: '#a8b6cc', dash: [3, 6], out: '相关', in: '相关', desc: 'A 与 B 相关或类比' },
};
export const RELATION_ORDER = ['pre', 'der', 'gen', 'eq', 'app', 'ex', 'rel'];
// relations whose direction means "learn s before t"
export const ORDER_RELATIONS = ['pre', 'der'];

export const KINDS = {
  def: { name: '定义', glyph: '●' },
  thm: { name: '定理', glyph: '✦' },
  method: { name: '方法', glyph: '◆' },
  example: { name: '例子', glyph: '○' },
  app: { name: '应用', glyph: '⬡' },
};
// the word written after `type:` in the knowledge base → kind
export const TYPE_WORDS = {
  定义: 'def', 概念: 'def', 对象: 'def', 结构: 'def', 记号: 'def', 公理: 'def', 物理量: 'def',
  定理: 'thm', 公式: 'thm', 性质: 'thm', 引理: 'thm', 推论: 'thm', 定律: 'thm', 原理: 'thm', 准则: 'thm',
  不等式: 'thm', 判别法: 'thm', 恒等式: 'thm', 方程: 'thm', 判据: 'thm',
  方法: 'method', 算法: 'method', 技巧: 'method', 思想: 'method', 策略: 'method', 方法论: 'method',
  例子: 'example', 例题: 'example', 模型: 'example', 反例: 'example', 问题: 'example', 猜想: 'example',
  应用: 'app', 实验: 'app', 现象: 'app', 仪器: 'app',
};

export const LEVELS = {
  hs: { name: '高中', desc: '中学数学与高中物理核心内容' },
  core: { name: '考纲', desc: '2027 新领军考纲明确列出的大学内容' },
  ext: { name: '拓展', desc: '超出考纲的大学数学与物理拓展' },
};

// section headings in a node body (### …) → section kind; drives the satellites in the explore view
export const SECTION_KINDS = {
  statement: { name: '内容', words: ['定义', '定理', '陈述', '内容', '公式', '定律'] },
  intuition: { name: '直观', words: ['直观', '几何意义', '物理意义', '动机', '为什么'] },
  proof: { name: '证明', words: ['证明', '推导', '证明思路', '证明概要'] },
  example: { name: '例题', words: ['例', '例题', '例子', '典型例题', '示例', '计算'] },
  app: { name: '应用', words: ['应用', '用途', '联系'] },
  note: { name: '注记', words: ['注', '注记', '注意', '易错', '历史', '拓展', '反例', '辨析'] },
};

export const STATUS = { 0: '未学', 1: '学习中', 2: '已掌握' };

export function galaxyColor(hue, l = 70, a = 1) {
  return `hsla(${hue}, 88%, ${l}%, ${a})`;
}
