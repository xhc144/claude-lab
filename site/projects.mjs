// Single source of truth for the public project index (docs/index.html) and the film players.
// scripts/build-site.mjs renders these entries; add a project here, not in the generated HTML.

export const REPO = 'https://github.com/xhc144/claude-lab';
export const SITE = 'https://xhc144.github.io/claude-lab/';
const tree = (dir) => `${REPO}/tree/main/${dir}`;
const blob = (path) => `${REPO}/blob/main/${path}`;

export const categories = [
  { id: 'play', label: '浏览器交互', en: 'Play in the browser', blurb: '打开即用的数学仪器、沙盒与游戏，静态运行、无需登录。' },
  { id: 'ai', label: 'AI 与产品原型', en: 'AI & product prototypes', blurb: '多智能体研究实验室与 AI 基础设施控制台。' },
  { id: 'desktop', label: '桌面软件', en: 'Desktop software', blurb: 'Windows 软件：签名安装包发布在 GitHub Releases，装好后自动更新。Pages 只提供介绍与链接。' },
  { id: 'film', label: '影片', en: 'Films made with code', blurb: '画面、配音、配乐都由代码生成的数学讲解与程序化短片，可在线观看。' },
  { id: 'writing', label: '写作与工具', en: 'Writing & tools', blurb: '中文数学 LaTeX 模板、视频讲解稿与 Claude 技能。' },
];

// status → badge on the cover. kind: online | local | windows | film | source | quarantine
export const projects = [
  // ─── 浏览器交互 ───
  {
    id: 'mathscape', category: 'play', title: '数境', en: 'MathScape', cover: 'mathscape', status: { kind: 'online', label: '在线体验' },
    summary: '拖动矩阵与复函数的参数，实时观察线性变换、定义域着色、常微分方程相轨线和三体运动。',
    tags: ['数学可视化', '复变函数', 'ODE', '三体', '离线单文件'],
    keywords: 'matrix linear transform complex ode lorenz three body 矩阵 线性代数 微分方程 洛伦茨',
    links: [
      { label: '打开数境', href: 'mathscape/', primary: true },
      { label: '下载单文件', href: 'mathscape/index.html', download: 'mathscape.html' },
      { label: '源码', href: tree('mathscape') },
    ],
  },
  {
    id: 'personal-site', category: 'play', title: '0 → ∞ 交互实验室', en: 'Zero to Infinity', cover: 'personal-site', status: { kind: 'online', label: '在线体验' },
    summary: '沿维度旅行：复映射、傅里叶、三叶结、双摆、量子波包、神经网络与注意力等 13 台仪器，WebGL 粒子场随章节变化。',
    tags: ['13 台仪器', 'WebGL', '数学 / 物理 / AI'],
    keywords: 'fourier knot pendulum quantum neural network attention 傅里叶 纽结 双摆 量子 神经网络 注意力',
    links: [
      { label: '开始旅行', href: 'personal-site/', primary: true },
      { label: '源码', href: tree('personal-site') },
    ],
  },
  {
    id: 'myriad', category: 'play', title: '万象', en: 'Myriad', cover: 'myriad', status: { kind: 'online', label: '在线体验' },
    summary: '创世沙盒：板块、气候、河流、生态与文明自行演化；你是一股无名的力量，你的作为会被各个民族写进神话。',
    tags: ['创世模拟', '文明演化', '浏览器存档', '桌面操作最佳'],
    keywords: 'god game sandbox civilization ecology simulation 上帝 模拟 生态 文明 沙盒',
    links: [
      { label: '创造世界', href: 'myriad/', primary: true },
      { label: '下载单文件', href: 'myriad/index.html', download: 'myriad.html' },
      { label: '源码', href: tree('myriad') },
    ],
  },
  {
    id: 'emberstack', category: 'play', title: '薪火纪', en: 'Emberstack', cover: 'emberstack', status: { kind: 'online', label: '在线体验' },
    summary: '卡牌堆叠文明策略：采集、合成、科技、探索与战斗，7 章 28 关与远征 / 无尽 / 挑战模式，也可以完全交给会思考的 AI 玩家。',
    tags: ['卡牌策略', '自主 AI 玩家', '触屏可玩', '离线单文件'],
    keywords: 'card stacking strategy roguelike ai player 卡牌 堆叠 策略 关卡',
    links: [
      { label: '点燃薪火', href: 'emberstack/', primary: true },
      { label: '下载单文件', href: 'emberstack/index.html', download: 'emberstack.html' },
      { label: '源码', href: tree('emberstack') },
    ],
  },
  {
    id: 'echowild', category: 'play', title: '回响荒野', en: 'Echowild', cover: 'echowild', status: { kind: 'online', label: '在线体验' },
    summary: '程序化体素开放世界：探索、建造、生存与冒险，村落、电路、天气与声音全部由代码生成。',
    tags: ['三维体素', 'WebGL2', '桌面键鼠', '暂不支持触屏'],
    keywords: 'voxel 3d sandbox survival minecraft-like webgl 体素 生存 建造 三维',
    links: [
      { label: '进入荒野', href: 'echowild/', primary: true },
      { label: '离线单文件', href: 'echowild/echowild.html', download: 'echowild.html' },
      { label: '源码', href: tree('echowild') },
    ],
  },

  // ─── AI 与产品原型 ───
  {
    id: 'tensora', category: 'ai', title: '星枢', en: 'Tensora', cover: 'tensora', status: { kind: 'online', label: '在线体验' },
    summary: 'API 中转网关、模型训练平台与 GPU 算力控制台合一的前端原型：10 个页面，数据每秒实时模拟，全部为虚构。',
    tags: ['产品原型', '仪表盘', '桌面与手机', '离线单文件'],
    keywords: 'dashboard api gateway gpu cluster training console 控制台 网关 训练 算力',
    links: [
      { label: '打开控制台', href: 'tensora/', primary: true },
      { label: '下载单文件', href: 'tensora/index.html', download: 'tensora.html' },
      { label: '源码', href: tree('tensora') },
    ],
  },
  {
    id: 'lunheng', category: 'ai', title: '论衡', en: 'Lunheng', cover: 'lunheng', status: { kind: 'local', label: '本地运行' },
    summary: '5–10 个不同厂商的 AI 模型组成研究团队，独立推导、交叉质询、寻找反例并独立核验。结论由证明与反例判定，不看多数票。',
    tags: ['多智能体', '学术研究', 'Node.js 服务端', '10+ 模型厂商'],
    keywords: 'multi-agent debate research openai claude gemini deepseek qwen kimi 多智能体 辩论 研究 证明 反例',
    note: '服务端需要保存 API Key，因此不发布到 Pages：npm ci && npm start 后打开 127.0.0.1:8848。',
    links: [
      { label: '运行说明', href: blob('lunheng/README.md'), primary: true },
      { label: '源码', href: tree('lunheng') },
    ],
  },

  // ─── 桌面软件 ───
  {
    id: 'motif', category: 'desktop', title: '律影', en: 'Motif', cover: 'motif', status: { kind: 'windows', label: 'Windows' },
    summary: '动态视觉创作软件：导入 PPT / Word / Excel / PDF，自动设计成动画作品，导出视频、交互 HTML 或 PDF；AI 可通过 Skill、CLI、MCP 共同创作。',
    tags: ['10 套设计系统', '38 种组件', 'MCP / CLI', '视频导出'],
    keywords: 'motion design presentation video export mcp skill cli ppt 动画 演示 视频 设计',
    links: [
      { label: '下载安装包', href: `${REPO}/releases?q=motif-v&expanded=true`, primary: true },
      { label: '说明', href: blob('motif/README.md') },
      { label: '源码', href: tree('motif') },
    ],
  },
  {
    id: 'particle-universe', category: 'desktop', title: '音乐粒子宇宙', en: 'Particle Universe', cover: 'particle-universe', status: { kind: 'windows', label: 'Windows' },
    summary: '导入本地音乐，离线分析频谱、鼓点、节拍与高潮，驱动 13 万–419 万颗 GPU 粒子组成的 8 个场景，支持自动运镜与 MP4 / WebM 导出。',
    tags: ['音乐可视化', 'WebGL2', 'GPU 粒子', '便携版'],
    keywords: 'music visualizer particles gpu electron beat detection 音乐 可视化 粒子 节拍 黑洞 银河',
    links: [
      { label: '下载安装包', href: `${REPO}/releases?q=particle-universe-v&expanded=true`, primary: true },
      { label: '说明', href: blob('particle-universe/README.md') },
      { label: '源码', href: tree('particle-universe') },
    ],
  },
  {
    id: 'phonica', category: 'desktop', title: '声准', en: 'Phonica', status: { kind: 'windows', label: 'Windows · 已发布' },
    art: { glyph: '/ˈfoʊ/', hue: 168 },
    summary: '英语口语训练与发音评测：本机完成音素级强制对齐与 GOP 评分，提供英音 / 美音标准发音、历史进步与薄弱音素专项练习。',
    tags: ['发音评测', '离线模型', '可选 AI 分析', '安装包'],
    keywords: 'english pronunciation speaking assessment phoneme gop tts kokoro 英语 口语 发音 音素 评测',
    links: [
      { label: '下载安装包', href: `${REPO}/releases?q=phonica-v&expanded=true`, primary: true },
      { label: '说明', href: blob('phonica/README.md') },
      { label: '源码', href: tree('phonica') },
    ],
  },
  {
    id: 'moteng', category: 'desktop', title: '墨誊', en: 'Moteng', status: { kind: 'windows', label: 'Windows' },
    art: { glyph: '誊', hue: 210 },
    summary: '把浏览器保存的 ChatGPT、Claude、Gemini、DeepSeek 等 AI 对话网页转换成 LaTeX 源码与 PDF；公式取自网页里的 TeX，版式可选对话体或墨经讲义体，内置 Tectonic 排版引擎。',
    tags: ['AI 对话转 LaTeX', 'PDF', 'Tectonic', '自动更新'],
    keywords: 'chatgpt claude gemini deepseek latex pdf tectonic mhtml 对话 公式 排版 墨经',
    links: [
      { label: '下载安装包', href: `${REPO}/releases?q=moteng-v&expanded=true`, primary: true },
      { label: '说明', href: blob('moteng/README.md') },
      { label: '源码', href: tree('moteng') },
    ],
  },
  {
    id: 'hongyan-mail', category: 'desktop', title: '鸿雁邮箱', en: 'Hongyan Mail', status: { kind: 'windows', label: 'Windows' },
    art: { glyph: '雁', hue: 32 },
    summary: '本地多账户邮件客户端（Electron / IMAP / SMTP）。安装包从源码重新构建、测试并签名后发布，装好后自动更新；早先被 Defender 报告的历史安装包仍隔离、不提供下载。',
    tags: ['邮件客户端', 'Electron', '自动更新'],
    keywords: 'mail client imap smtp electron 邮件 邮箱 隔离 quarantine',
    links: [
      { label: '下载安装包', href: `${REPO}/releases?q=hongyan-mail-v&expanded=true`, primary: true },
      { label: '说明', href: blob('hongyan-mail/README.md') },
      { label: '隔离记录', href: blob('hongyan-mail/QUARANTINE.md') },
      { label: '源码', href: tree('hongyan-mail') },
    ],
  },

  // ─── 影片 ───
  {
    id: 'fermat-windmill', category: 'film', title: '风车里的素数', en: 'Primes in a Windmill', cover: 'fermat-windmill',
    summary: '费马平方和定理与扎吉尔的“一句话证明”：用风车图解释那个对合从何而来，附 12 层追问的模拟英语面试。',
    tags: ['数论', '中文版 / 英文版', '13 个章节', '中英对照讲稿'],
    keywords: 'fermat two squares zagier one sentence proof windmill involution number theory interview 费马 平方和 扎吉尔 对合 数论 面试',
    tools: 'Manim · sherpa-onnx（Kokoro 语音）· FFmpeg', build: 'bash build/make.sh',
    versions: [
      { id: 'zh', label: '中文版', src: 'fermat-windmill/output/fermat_windmill_zh.mp4', srt: 'fermat-windmill/output/fermat_windmill_zh.srt', note: '中文配音与字幕；面试章节的考官提问为英文原声' },
      { id: 'en', label: 'English', src: 'fermat-windmill/output/fermat_windmill_en.mp4', srt: 'fermat-windmill/output/fermat_windmill_en.srt', note: '约 140 词 / 分钟的放慢语速，难词附美式音标与中文释义' },
    ],
    extras: [
      { label: '中英对照讲稿（网页）', src: 'fermat-windmill/output/transcript_bilingual.html', name: 'transcript.html' },
      { label: '中英对照讲稿（PDF）', src: 'fermat-windmill/output/transcript_bilingual.pdf', name: 'transcript.pdf' },
    ],
  },
  {
    id: 'windmill-theorem', category: 'film', title: '一句话的证明，一架风车', en: 'The Windmill Theorem', cover: 'windmill-theorem',
    summary: '同一主题的另一个独立版本：费马平方和定理、扎吉尔对合与风车图，英文版为旁白 / 考官 / 考生三人对话的面试章节。',
    tags: ['数论', '中文版 / 英文版', '双语字幕'],
    keywords: 'fermat two squares zagier windmill interview 费马 平方和 风车 扎吉尔 面试',
    tools: 'Manim · TeX · FFmpeg', build: 'bash build.sh',
    notice: '当前成片带字幕与背景音乐，尚未加入旁白配音。',
    versions: [
      { id: 'zh', label: '中文版', src: 'windmill-theorem/output/windmill_theorem_zh.mp4', srt: 'windmill-theorem/output/windmill_theorem_zh.srt', note: '中文字幕（烧录）' },
      { id: 'en', label: 'English', src: 'windmill-theorem/output/windmill_theorem_en.mp4', srt: 'windmill-theorem/output/windmill_theorem_en.en-zh.srt', note: '英文字幕 + 逐句中文释义，难词标注音标' },
    ],
  },
  {
    id: 'fixed-point-film', category: 'film', title: '总有一点不动', en: 'The Point That Stays', cover: 'fixed-point-film',
    summary: '布劳威尔不动点定理：从搅咖啡和公园地图出发，经一维介值定理、三个反例、斯佩纳引理到纳什均衡与 Hex 棋。',
    tags: ['拓扑', '中文版 / 英文版', '配音与字幕'],
    keywords: 'brouwer fixed point sperner lemma hex nash topology 布劳威尔 不动点 斯佩纳 拓扑',
    tools: 'Canvas · MathJax · Playwright · Kokoro TTS · FFmpeg', build: 'bash build.sh',
    versions: [
      { id: 'zh', label: '中文版', src: 'fixed-point-film/output/fixed_point_zh.mp4', srt: 'fixed-point-film/output/fixed_point_zh.srt', note: '中文配音，中文字幕' },
      { id: 'en', label: 'English', src: 'fixed-point-film/output/fixed_point_en.mp4', srt: 'fixed-point-film/output/fixed_point_en.srt', note: '英文配音，英文字幕加中文小字' },
    ],
  },
  {
    id: 'optimization-film', category: 'film', title: '最优化的本质', en: 'The Essence of Optimization', cover: 'optimization-film',
    summary: '我们只能看见脚下，却想知道全局：不等式与极值、凸优化、梯度下降、线性规划，画面中的数值都经过核对。',
    tags: ['优化', '中文配音', '1080p60'],
    keywords: 'optimization convex gradient descent linear programming simplex duality lagrange 最优化 凸优化 梯度下降 线性规划 对偶',
    tools: 'Manim · 离线中文语音合成 · FFmpeg', build: 'python tools/build.py',
    versions: [
      { id: 'zh', label: '中文版', src: 'optimization-film/output/optimization_essence_1080p.mp4', srt: 'optimization-film/output/optimization_essence_1080p.srt', note: '中文配音，字幕已烧录' },
    ],
  },
  {
    id: 'two-sample-test-video', category: 'film', title: '差了 3.3 分，算不算数', en: 'Two-Sample Tests', cover: 'two-sample-test-video',
    summary: '双样本检验从哪来、为什么这么算：Z、合并方差 t、F、Welch、配对 t、两比例 Z，最后放进一棵决策树。',
    tags: ['统计', '中文配音', '8 个章节'],
    keywords: 'statistics hypothesis test t-test welch f-test paired proportion 统计 假设检验 t 检验 方差',
    tools: 'Manim · sherpa-onnx · FFmpeg', build: 'bash build.sh',
    versions: [
      { id: 'zh', label: '中文版', src: 'two-sample-test-video/output/two-sample-test.mp4', srt: 'two-sample-test-video/output/two-sample-test.srt', note: '中文配音，字幕压在画面里' },
    ],
  },
  {
    id: 'linear-regression-video', category: 'film', title: '线性回归：从一条直线，到一次投影', en: 'Linear Regression', status: { kind: 'source', label: '待配音' },
    art: { glyph: 'Xᵀy', hue: 150 },
    summary: '最小二乘为什么取平方、两个偏导条件从哪来、为什么它其实是一次正交投影，再讲 R² 的几何意义、“线性”指什么、“回归”这个名字从哪来。',
    tags: ['统计', '线性代数', '约 13 分钟', '通义千问配音'],
    keywords: 'linear regression least squares projection normal equation r squared galton 线性回归 最小二乘 投影 正规方程 回归',
    tools: 'Manim · Qwen TTS · FFmpeg', build: 'bash build.sh',
    notice: '画面与旁白稿已完成；成片需要用通义千问语音合成配音后在本地生成，暂未接入播放器。',
    links: [
      { label: '查看说明', href: blob('linear-regression-video/README.md'), primary: true },
      { label: '制作源码', href: tree('linear-regression-video') },
    ],
  },
  {
    id: 'symmetry-film', category: 'film', title: '对称的语言', en: 'The Language of Symmetry', cover: 'symmetry-film',
    summary: '从雪花、十二平均律与魔方，到双曲铺砌、五次方程、椭圆曲线和 E₈：一次关于群与对称的视觉旅行。',
    tags: ['抽象代数', '程序化影片', '合成配乐'],
    keywords: 'abstract algebra group symmetry galois rubik hyperbolic elliptic curve e8 抽象代数 群 对称 伽罗瓦 魔方',
    tools: 'Python · Skia · Numba · FFmpeg', build: 'bash build.sh preview',
    versions: [
      { id: 'zh', label: '成片', src: 'symmetry-film/output/abstract_algebra_promo_web.mp4', note: '1080p 网络版' },
    ],
  },
  {
    id: 'sea-above', category: 'film', title: '倒悬之海', en: 'The Sea Above', cover: 'sea-above',
    summary: '露珠向上落去，海洋悬在天空，世界卷成一个圆筒。全部画面由 GLSL 光线步进着色器在 CPU 上逐像素计算。',
    tags: ['三维短片', '光线步进', '合成声音'],
    keywords: 'ray marching glsl shader 3d short film whale ocean 光线步进 着色器 三维 短片 鲸',
    tools: 'Python · OpenGL / EGL · FFmpeg', build: './make_film.sh',
    versions: [
      { id: 'zh', label: '成片', src: 'sea-above/out/the_sea_above.mp4', note: '2.35:1 画幅，立体声' },
    ],
  },

  // ─── 写作与工具 ───
  {
    id: 'mojing', category: 'writing', title: '墨经', en: 'Mojing', cover: 'mojing', status: { kind: 'online', label: 'PDF 预览 · 下载' },
    summary: '中文数学 LaTeX 模板：讲义、习题与解答、竞赛试卷、论文、书籍、翻译对照。在线翻阅 10 份示例 PDF，下载 6 个完整模板。',
    tags: ['LaTeX', 'XeLaTeX', '6 套模板', '10 份 PDF'],
    keywords: 'latex template xelatex ctex lecture notes exam paper book translation 模板 讲义 试卷 论文 排版',
    links: [
      { label: '查看模板与下载', href: 'mojing/', primary: true },
      { label: '源码', href: tree('mojing') },
    ],
  },
  {
    id: 'video-scripts', category: 'writing', title: '视频讲解稿', en: 'Video scripts', status: { kind: 'source', label: '仓库文档' },
    art: { glyph: '∇f', hue: 205 },
    summary: '《最优化》6 集讲解稿（约 2 小时 20 分钟），按“旁白 + 画面提示”写成，附核对全部数值例子的 Python 脚本。',
    tags: ['讲稿', '最优化', 'Python 核对'],
    keywords: 'script lecture optimization numpy scipy 讲稿 剧本 最优化',
    links: [
      { label: '阅读讲稿', href: blob('video-scripts/optimization.md'), primary: true },
      { label: '目录', href: tree('video-scripts') },
    ],
  },
  {
    id: 'claude-skills', category: 'writing', title: 'Claude 数学技能', en: 'Claude Code skills', status: { kind: 'source', label: '6 个技能' },
    art: { glyph: '∮', hue: 268 },
    summary: '数学讲义写作、题目难度评估、数学 LaTeX 排版、墨经模板排版、概念讲解与考试辅导。在本仓库打开 Claude Code 时自动可用。',
    tags: ['Claude Code', '数学教学', 'LaTeX'],
    keywords: 'claude code skills math lecture writing difficulty latex typesetting explain concepts 技能 讲义 难度 排版 概念',
    links: [
      { label: '浏览技能', href: tree('.claude/skills'), primary: true },
    ],
  },
];
