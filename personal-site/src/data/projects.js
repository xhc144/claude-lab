// Every number on this page comes from the public README of the repository it describes
// (snapshot taken 2026-10-12). Private repositories are never linked or quoted; the projects the
// owner keeps private are described only in the owner's own words.

export const SNAPSHOT_DATE = '2026-10-12';
export const GITHUB = 'https://github.com/xhc144';

// mit-ocw-notes — Chinese re-editions of MIT OpenCourseWare lecture notes (README, 当前状态).
export const OCW_MATH = [
  ['概率论', 237], ['常微分方程与动力系统', 196], ['图论', 157], ['拓扑', 132], ['最优化', 126],
  ['复变', 124], ['数理统计', 110], ['群表示', 97], ['数值代数', 90], ['数值分析', 79],
  ['实变', 75], ['微分几何', 71], ['泛函', 59], ['抽象代数', 58], ['偏微分方程', 49],
];
export const OCW_PHYSICS = [
  ['量子力学', 194], ['量子场论', 148], ['广义相对论', 109], ['理论力学', 93], ['波动与光学', 81],
  ['电动力学', 80], ['基础电磁学', 80], ['热学与统计物理', 69], ['基础力学', 58],
];
export const OCW_TOTALS = {
  mathBooks: OCW_MATH.length, mathPages: OCW_MATH.reduce((s, [, p]) => s + p, 0),
  physBooks: OCW_PHYSICS.length, physPages: OCW_PHYSICS.reduce((s, [, p]) => s + p, 0),
};

// ai-self-study — the nine full translations listed in papers/README.md, with their page counts.
export const PAPERS = [
  { key: 'DPO', zh: '直接偏好优化', pages: 36, unit: '7', note: 'KL 最优策略 → 偏好似然 → 梯度' },
  { key: 'Test-time compute', zh: '最优测试时计算', pages: 43, unit: '8', note: '验证器、难度与并行 / 顺序预算' },
  { key: 'DeepSeek-R1', zh: 'R1 · Nature 正式论文', pages: 18, unit: '7–8', note: '可验证奖励的强化学习' },
  { key: 'CHIVE', zh: '用反事实检验解释', pages: 34, unit: '10', note: '解释 → 反事实预测 → 干预证据' },
  { key: 'DGM', zh: '达尔文哥德尔机', pages: 128, unit: '11', note: '代码自更新、档案搜索、评估器投机' },
  { key: 'STARS', zh: '循环动力学稳定性', pages: 19, unit: '11', note: '稳定性、有效性与局部理论条件' },
  { key: 'AlphaProof', zh: '奥林匹克形式数学推理', pages: 39, unit: '11', note: 'AND/OR 搜索、形式核验' },
  { key: 'Engram', zh: '条件记忆与稀疏查找', pages: 34, unit: '11', note: '容量 / 计算 / 存储分配' },
  { key: 'CaT', zh: '以计算作为教师', pages: 31, unit: '8 / 11', note: '伪参考、相关错误与监督闭环' },
];

// ai-self-study docs/roadmap.md — the learning route, in order.
export const AI_ROUTE = [
  '条件文本预测', '参数学习与梯度', '因果注意力与缓存', '评价、数据与算力',
  '后训练与推理预算', '工具与信任', '机制解释与研究闭环', '条件记忆、形式核验与循环状态',
];

// Public repositories (from the GitHub account listing; pushed dates as of the snapshot).
export const PUBLIC_REPOS = [
  {
    name: 'mit-ocw-notes', title: 'MIT OCW 讲义归档与中文重编', status: 'live', tag: '数学 · 物理',
    pushed: '2026-10-12',
    blurb: '归档 MIT OpenCourseWare 公开讲义，并用中文原生 LaTeX 重编成整册中文讲义，附题面与解答；保留来源、署名与许可（CC BY-NC-SA 4.0）。',
    stats: [['数学整册', 15, '册'], ['数学页数', 1660, '页'], ['物理已验', 9, '科'], ['物理页数', 912, '页']],
    url: 'https://github.com/xhc144/mit-ocw-notes',
  },
  {
    name: 'ai-self-study', title: '现代人工智能研究学习', status: 'live', tag: 'AI · 论文',
    pushed: '2026-10-12',
    blurb: '从语言模型的数学与训练出发读懂近年的基础模型论文：中文教材、9 篇指定版本论文全文译文（机器辅助、非官方）、可复现的 CPU 实验与研究记录。',
    stats: [['学习单元', 11, '个'], ['数学附录', 3, '个'], ['论文译文', 9, '篇'], ['原创研究说明', 3, '份']],
    version: 'v0.3.1',
    url: 'https://github.com/xhc144/ai-self-study',
  },
  {
    name: 'claude-lab', title: 'Claude 实验仓库', status: 'live', tag: 'AI 协作 · 可视化',
    pushed: '2026-10-12',
    blurb: '我提出题目、交给 Claude 独立完成的实验：程序化影片《对称的语言》《倒悬之海》，交互式数学可视化软件「数境 MathScape」——以及这个网站本身。',
    stats: [['抽象代数影片', 220, '秒'], ['三维短片', 71, '秒'], ['MathScape 单元测试', 50, '个'], ['端到端测试', 32, '个']],
    url: 'https://github.com/xhc144/claude-lab',
  },
  {
    name: 'repository-index', title: '学习资料与作品导航', status: 'live', tag: '导航',
    pushed: '2026-10-08',
    blurb: '我全部项目的公开总目录与导航网页：课程与试卷资料、AI 原创与学科资料、书籍、工具与作品四个入口。导航公开，资料本身仍在私有仓库。',
    stats: [['导航入口', 4, '类']],
    url: 'https://github.com/xhc144/repository-index',
    site: 'https://xhc144.github.io/repository-index/',
  },
];

// The owner's own list of projects and explorations. Private or still in progress: no links, no details.
export const OWN_PROJECTS = [
  { title: '数学 LaTeX 讲义生成与审校 Skills', kind: 'AI 工具', state: '持续开发', note: '让智能体按规范起草、编译、审校数学讲义的技能包' },
  { title: '数学竞赛试卷整理', kind: '数学', state: '持续整理', note: '竞赛试题的收集、转写与归档' },
  { title: 'Seifert 曲面与三叶结可视化', kind: '拓扑 · 可视化', state: '持续开发', note: '本站第 3 维展示了为网站重新实现的交互版本', anchor: '#dim3' },
  { title: '数学参考教材知识体系', kind: '数学', state: '持续建设', note: '为备考与自学搭建的参考教材与知识结构' },
  { title: '物理学习资料', kind: '物理', state: '持续建设', note: '经典力学、电动力学、量子力学方向的资料', anchor: '#archive' },
  { title: 'AI 研究论文学习', kind: 'AI', state: '公开', note: '见公开仓库 ai-self-study', url: 'https://github.com/xhc144/ai-self-study' },
];

// Commits per day on the public repositories (git log, UTC dates) — repository activity, not a
// claim about who typed each commit.
export const ACTIVITY = {
  'mit-ocw-notes': { '2026-10-08': 86, '2026-10-09': 1, '2026-10-11': 74, '2026-10-12': 59 },
  'repository-index': { '2026-10-02': 1, '2026-10-03': 2, '2026-10-07': 11, '2026-10-08': 10 },
  'claude-lab': { '2026-10-11': 16, '2026-10-12': 3 },
  'ai-self-study': { '2026-10-11': 1, '2026-10-12': 2 },
};
