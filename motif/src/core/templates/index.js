// Built-in templates. Each is a complete, designed document with realistic placeholder content;
// creating a project from a template copies it with fresh IDs. Users can save their own.

export const BUILTIN_TEMPLATES = [
  {
    id: 'launch', name: '产品发布会', tags: ['科技', '发布', '深色'],
    description: '极光主题的科技发布节奏：3D 主视觉开场 → 痛点数字 → 能力网格 → 增长图表 → 全球网络 → 用户证言 → 结尾。',
    doc: {
      title: '新品发布', theme: { id: 'aurora' }, style: { energy: 0.7 },
      scenes: [
        { blocks: [{ type: 'title', kicker: '2026 秋季发布', text: '重新定义 ==创作==', subtitle: '一个让人与 AI 共同完成作品的引擎' }, { type: 'shape3d', shape: 'torusknot', material: 'glass' }] },
        { layout: 'split', blocks: [{ type: 'title', text: '创作者 73% 的时间花在重复劳动上' }, { type: 'stat', value: 73, suffix: '%', label: '时间用于排版、对齐与导出', delta: '+18%', deltaLabel: '三年增幅' }] },
        { blocks: [{ type: 'title', text: '三项核心能力' }, { type: 'features', items: [{ icon: 'wand-sparkles', title: '一键成片', text: '内容与数据进，成片出' }, { icon: 'palette', title: '专业设计系统', text: '十套主题与动画语言' }, { icon: 'bot', title: 'AI 原生', text: 'Skill / CLI / MCP 直接驱动' }] }] },
        { layout: 'split', blocks: [{ type: 'title', text: '付费用户五年增长 7 倍' }, { type: 'text', text: '海外市场贡献了超过一半的增量。' }, { type: 'chart', kind: 'bar', data: { labels: ['2021', '2022', '2023', '2024', '2025'], values: [12, 19, 31, 52, 86] }, suffix: '万', highlight: '2025', annotate: [{ at: '2025', text: '同比 +65%' }] }] },
        { blocks: [{ type: 'title', text: '服务遍布全球' }, { type: 'globe', points: ['北京', '新加坡', '伦敦', '纽约', '圣保罗'], arcs: [{ from: '北京', to: '伦敦' }, { from: '北京', to: '纽约' }, { from: '新加坡', to: '圣保罗' }], focus: '北京' }] },
        { blocks: [{ type: 'quote', text: '它把我们一周的工作缩短到了一个下午。', author: '林晓', role: '某品牌设计负责人' }] },
        { blocks: [{ type: 'title', text: '即刻开始', subtitle: 'motif.example · 免费下载' }] },
      ],
    },
  },
  {
    id: 'annual-report', name: '年度报告', tags: ['报告', '数据', '浅色'],
    description: '报刊主题：衬线大标题、章节页、关键数字、图表与表格，适合年报、调研和复盘。',
    doc: {
      title: '2025 年度报告', theme: { id: 'editorial' }, style: { energy: 0.45, pageNumbers: true },
      scenes: [
        { blocks: [{ type: 'title', kicker: 'ANNUAL REPORT 2025', text: '稳健增长的一年', subtitle: '营收、用户与效率的全面复盘' }] },
        { layout: 'section', blocks: [{ type: 'title', kicker: '第一部分', text: '经营概览' }] },
        { blocks: [{ type: 'title', text: '关键指标' }, { type: 'stats', items: [{ value: '86 亿', label: '全年营收', delta: '+65%' }, { value: 3.8, suffix: 'M', decimals: 1, label: '月活跃用户', delta: '+212%' }, { value: 41.2, suffix: '%', label: '毛利率', delta: '+3.4pt' }] }] },
        { blocks: [{ type: 'title', text: '季度营收走势' }, { type: 'chart', kind: 'line', data: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: '2025', values: [16, 19, 23, 28] }, { name: '2024', values: [10, 12, 14, 16] }] }, suffix: '亿' }] },
        { layout: 'split', blocks: [{ type: 'title', text: '收入结构' }, { type: 'text', text: '订阅收入首次超过一半，**企业客户**贡献最大增量。' }, { type: 'chart', kind: 'donut', data: [{ label: '订阅', value: 54 }, { label: '企业服务', value: 31 }, { label: '其他', value: 15 }], suffix: '%', highlight: '订阅' }] },
        { blocks: [{ type: 'title', text: '区域表现' }, { type: 'table', columns: ['区域', '营收', '同比', '占比'], rows: [['华东', '31.2 亿', '+58%', '36%'], ['华南', '22.4 亿', '+71%', '26%'], ['海外', '19.6 亿', '+124%', '23%'], ['其他', '12.8 亿', '+22%', '15%']], highlight: { row: 2 } }] },
        { blocks: [{ type: 'title', text: '重要里程碑' }, { type: 'timeline', items: [{ date: '3 月', title: '发布 3.0' }, { date: '6 月', title: '进入东南亚' }, { date: '9 月', title: '用户破 300 万' }, { date: '12 月', title: '实现盈利' }], highlight: 3 }] },
        { blocks: [{ type: 'title', text: '谢谢', subtitle: '2026，继续前行' }] },
      ],
    },
  },
  {
    id: 'pitch', name: '融资路演', tags: ['商业', '路演', '浅色'],
    description: '商务主题的十页路演结构：问题、方案、市场、模式、增长、竞争、团队、融资计划。',
    doc: {
      title: '融资路演', theme: { id: 'corporate' }, style: { energy: 0.55, progress: true },
      scenes: [
        { blocks: [{ type: 'title', kicker: 'A 轮融资', text: '让每家中小企业都有自己的数据团队', subtitle: '星图分析 · 2026' }] },
        { layout: 'split', blocks: [{ type: 'title', text: '问题：数据多，洞察少' }, { type: 'bullets', items: ['82% 的中小企业没有数据分析师', '报表平均滞后 9 天', '决策仍靠经验'] }] },
        { blocks: [{ type: 'title', text: '我们的方案' }, { type: 'steps', items: [{ title: '接入', text: '10 分钟连接数据源', icon: 'plug' }, { title: '理解', text: 'AI 自动建模', icon: 'brain' }, { title: '洞察', text: '每日推送关键变化', icon: 'lightbulb' }] }] },
        { layout: 'split', blocks: [{ type: 'title', text: '市场规模 1,200 亿' }, { type: 'chart', kind: 'donut', data: [{ label: '可服务市场', value: 1200 }, { label: '首年目标', value: 36 }], suffix: '亿' }] },
        { blocks: [{ type: 'title', text: '收入增长' }, { type: 'chart', kind: 'area', data: { labels: ['1月', '3月', '5月', '7月', '9月', '11月'], values: [40, 72, 130, 210, 340, 520] }, suffix: '万' }] },
        { blocks: [{ type: 'title', text: '竞争格局' }, { type: 'matrix', axes: { xLabel: '易用性', yLabel: '分析深度' }, quadrants: ['专业工具', '我们', '传统报表', '轻量工具'], items: [{ label: '星图', x: 0.82, y: 0.8 }, { label: '竞品 A', x: 0.3, y: 0.75 }, { label: '竞品 B', x: 0.7, y: 0.3 }], highlight: 1 }] },
        { layout: 'split', blocks: [{ type: 'title', text: '本轮融资 5,000 万' }, { type: 'chart', kind: 'pie', data: [{ label: '研发', value: 50 }, { label: '市场', value: 30 }, { label: '运营', value: 20 }], suffix: '%' }] },
        { blocks: [{ type: 'title', text: '谢谢', subtitle: 'contact@example.com' }] },
      ],
    },
  },
  {
    id: 'math-lesson', name: '数学微课', tags: ['教育', '数学', '深色'],
    description: '数理主题：公式书写、推导变换、函数图像与几何作图，适合 3–5 分钟知识讲解。',
    doc: {
      title: '勾股定理', theme: { id: 'lumen' }, style: { energy: 0.5, captions: true },
      scenes: [
        { blocks: [{ type: 'title', kicker: '几何 · 第 3 讲', text: '勾股定理', subtitle: '直角三角形三边之间的关系' }], narration: '今天我们来认识勾股定理。' },
        { blocks: [{ type: 'title', text: '一个直角三角形' }, { type: 'geometry', points: { A: [0, 0], B: [4, 0], C: [0, 3] }, shapes: [{ type: 'polygon', points: ['A', 'B', 'C'] }, { type: 'right-angle', at: 'A', from: 'B', to: 'C' }, { type: 'label', between: ['A', 'B'], text: 'a' }, { type: 'label', between: ['A', 'C'], text: 'b' }, { type: 'label', between: ['B', 'C'], text: 'c' }] }], narration: '设两条直角边为 a 和 b，斜边为 c。' },
        { blocks: [{ type: 'title', text: '定理' }, { type: 'equation', latex: 'a^2 + b^2 = c^2', label: '两直角边的平方和等于斜边的平方' }], narration: '那么 a 方加 b 方等于 c 方。', guide: { steps: [{ target: 'equation', part: 'a^2', do: 'underline', say: '一条直角边的平方' }, { target: 'equation', part: 'b^2', do: 'underline', say: '加上另一条直角边的平方' }, { target: 'equation', part: 'c^2', do: 'circle', note: '斜边', say: '等于斜边的平方' }] } },
        { blocks: [{ type: 'title', text: '代入验证' }, { type: 'equation', latex: '3^2 + 4^2', steps: ['9 + 16', '25', '5^2'] }], narration: '以 3、4、5 为例。' },
        { blocks: [{ type: 'title', text: '小结' }, { type: 'bullets', style: 'checks', items: ['只适用于直角三角形', '已知两边可求第三边', '逆定理可判定直角'] }] },
      ],
    },
  },
  {
    id: 'social-short', name: '竖屏短视频', tags: ['社交', '竖屏', '营销'],
    description: '9:16 波普风格：强钩子标题 → 大数字 → 三个要点 → 数据 → 行动号召，约 25 秒。',
    doc: {
      title: '短视频', theme: { id: 'pop' }, format: { aspect: '9:16' }, style: { energy: 0.9 },
      scenes: [
        { blocks: [{ type: 'title', kicker: '你知道吗', text: '每天 ==3 小时== 被浪费在找文件上' }] },
        { blocks: [{ type: 'stat', value: 1095, suffix: ' 小时', label: '一年加起来' }] },
        { blocks: [{ type: 'title', text: '三招解决' }, { type: 'bullets', style: 'numbers', items: ['统一命名规则', '一个收件箱', '每周五清理'] }] },
        { blocks: [{ type: 'title', text: '试过的人都说好' }, { type: 'chart', kind: 'hbar', data: [{ label: '效率提升', value: 42 }, { label: '加班减少', value: 31 }, { label: '心情变好', value: 67 }], suffix: '%' }] },
        { blocks: [{ type: 'title', text: '关注我', subtitle: '每天一个效率技巧' }] },
      ],
    },
  },
  {
    id: 'brand-story', name: '品牌故事', tags: ['文化', '中国风', '浅色'],
    description: '水墨主题：书法标题、宣纸与远山、墨晕转场，适合文化品牌、节日与历史叙事。',
    doc: {
      title: '一盏茶的百年', theme: { id: 'ink' }, style: { energy: 0.35 },
      scenes: [
        { blocks: [{ type: 'title', kicker: '始于一九二三', text: '一盏茶的百年', subtitle: '从山间茶园到千家万户' }] },
        { blocks: [{ type: 'quote', text: '茶之为饮，发乎神农氏。', author: '陆羽', role: '《茶经》' }] },
        { blocks: [{ type: 'title', text: '百年来时路' }, { type: 'timeline', items: [{ date: '1923', title: '山间茶坊' }, { date: '1956', title: '公私合营' }, { date: '1988', title: '远销海外' }, { date: '2023', title: '百年老字号' }] }] },
        { layout: 'split', blocks: [{ type: 'title', text: '一片叶子的旅程' }, { type: 'steps', items: [{ title: '采摘' }, { title: '萎凋' }, { title: '揉捻' }, { title: '烘焙' }] }] },
        { blocks: [{ type: 'title', text: '敬下一个百年' }] },
      ],
    },
  },
  {
    id: 'tech-architecture', name: '技术架构讲解', tags: ['技术', '工程', '深色'],
    description: '蓝图主题：架构流程图、代码片段、方案对比与实施步骤。',
    doc: {
      title: '系统架构', theme: { id: 'blueprint' }, style: { energy: 0.55 },
      scenes: [
        { blocks: [{ type: 'title', kicker: 'RFC-042', text: '实时数据管道重构', subtitle: '从批处理到流式' }] },
        { blocks: [{ type: 'title', text: '新架构' }, { type: 'flow', nodes: [{ id: 'src', label: '业务库', icon: 'database' }, { id: 'cdc', label: 'CDC 采集', icon: 'radio' }, { id: 'kafka', label: '消息队列', icon: 'layers' }, { id: 'flink', label: '流计算', icon: 'cpu' }, { id: 'olap', label: '分析库', icon: 'chart-column' }, { id: 'api', label: '查询 API', icon: 'plug' }], edges: [['src', 'cdc'], ['cdc', 'kafka'], ['kafka', 'flink'], ['flink', 'olap'], ['olap', 'api']] }] },
        { layout: 'split', blocks: [{ type: 'title', text: '核心处理逻辑' }, { type: 'code', language: 'python', title: 'pipeline.py', code: 'stream = source("orders")\nstream \\\n  .window(minutes=1) \\\n  .agg(revenue=sum("amount")) \\\n  .sink("olap.revenue_1m")', highlight: [3] }] },
        { blocks: [{ type: 'title', text: '收益' }, { type: 'compare', columns: [{ title: '批处理', items: ['延迟 24 小时', '夜间任务易失败', '重算成本高'] }, { title: '流式', items: ['延迟 < 5 秒', '持续增量计算', '按需回放'] }], winner: 1 }] },
      ],
    },
  },
  {
    id: 'film-opening', name: '电影感片头', tags: ['电影', '品牌', '深色'],
    description: '暗场主题：失焦入场、黑场转场、胶片颗粒与宽银幕遮幅，适合预告与开场。',
    doc: {
      title: '片头', theme: { id: 'noir' }, style: { energy: 0.3 },
      scenes: [
        { duration: 4, blocks: [{ type: 'title', kicker: 'A MOTIF FILM', text: '光与影之间' }] },
        { duration: 4.5, blocks: [{ type: 'quote', text: '每一帧，都是一次选择。' }] },
        { duration: 5, blocks: [{ type: 'title', text: '即将上映', subtitle: '2026 · 冬' }] },
      ],
    },
  },
  {
    id: 'course', name: '课程讲解', tags: ['教育', '清新', '浅色'],
    description: '青野主题：友好圆润的教学节奏，图标要点、象形图、流程与小测。',
    doc: {
      title: '睡眠的科学', theme: { id: 'meadow' }, style: { energy: 0.55 },
      scenes: [
        { blocks: [{ type: 'title', kicker: '健康课 · 第 1 课', text: '睡眠的科学', subtitle: '为什么我们需要睡够 7 小时' }] },
        { layout: 'split', blocks: [{ type: 'title', text: '睡眠不足很普遍' }, { type: 'pictogram', value: 6, total: 10, icon: 'user', label: '**6/10** 的成年人睡眠不足 7 小时' }] },
        { blocks: [{ type: 'title', text: '一夜的睡眠周期' }, { type: 'steps', style: 'circle', items: [{ title: '入睡', icon: 'moon' }, { title: '浅睡', icon: 'cloud' }, { title: '深睡', icon: 'bed' }, { title: '快速眼动', icon: 'eye' }] }] },
        { blocks: [{ type: 'title', text: '好睡眠的四个习惯' }, { type: 'features', items: [{ icon: 'clock', title: '固定作息' }, { icon: 'smartphone', title: '睡前少屏幕' }, { icon: 'coffee', title: '午后不咖啡' }, { icon: 'sun', title: '早晨晒太阳' }] }] },
      ],
    },
  },
  {
    id: 'manifesto', name: '观点宣言', tags: ['品牌', '海报', '浅色'],
    description: '瑞士主题：巨型无衬线、红黑对比、色带转场，用强有力的短句表达立场。',
    doc: {
      title: '宣言', theme: { id: 'swiss' }, style: { energy: 0.8 },
      scenes: [
        { blocks: [{ type: 'title', kicker: '宣言 01', text: '少即是多' }] },
        { layout: 'section', blocks: [{ type: 'title', kicker: '01', text: '形式追随功能' }] },
        { blocks: [{ type: 'title', text: '网格不是束缚，是自由' }, { type: 'text', text: '当秩序成为默认，创造力才能集中在真正重要的地方。' }] },
        { layout: 'split', blocks: [{ type: 'title', text: '一个数字胜过千言' }, { type: 'stat', value: 1, label: '个清晰的信息' }] },
      ],
    },
  },
];
