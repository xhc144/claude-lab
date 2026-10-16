// Component catalog: the public contract for blocks. Rendering lives in src/engine/components;
// this file is isomorphic metadata used by validation, the editor's inspector forms, the CLI,
// the MCP tool schema and the generated Skill reference.
import { P } from './spec.js';
import { normalizeChartData, normalizeItems } from './data.js';
import { parseNumberish, isPlainObject } from '../util/misc.js';

const ICON_DESC = 'Lucide 图标名（如 rocket, users, shield-check, trending-up, globe, cpu, leaf）。motif icons --search 查询。';
const TONES = ['auto', 'accent', 'positive', 'negative', 'warning', 'neutral'];

function normStatLike(it) {
  const o = typeof it === 'object' && it ? { ...it } : { value: it };
  if (o.value == null && o.number != null) { o.value = o.number; delete o.number; }
  if (o.label == null && o.title != null) { o.label = o.title; delete o.title; }
  if (o.label == null && o.name != null) { o.label = o.name; delete o.name; }
  if (typeof o.value === 'string') {
    const p = parseNumberish(o.value);
    if (p && !/\d.*[^\d.,%\s]+.*\d/.test(o.value)) {
      o.raw = o.value;
      o.value = p.value;
      if (p.prefix && o.prefix == null) o.prefix = p.prefix;
      if (p.suffix && o.suffix == null) o.suffix = p.suffix;
      const dec = /\.(\d+)/.exec(o.raw.replace(/[,，]/g, ''));
      if (dec && o.decimals == null) o.decimals = dec[1].length;
      delete o.raw;
    }
  }
  return o;
}

export const COMPONENTS = {
  // ───────────────────────────── text ─────────────────────────────
  title: {
    label: '标题', category: 'text', nature: 'headline',
    summary: '场景主标题，可带眉题（kicker）与副标题。',
    description: '每个场景通常以一个 title 开头。text 支持轻量标记：**加粗**、==强调色==、*斜体*、`代码`、~~删除~~，以及行内公式 $a^2+b^2=c^2$（或 \\(…\\)）。标题宜短（中文 ≤ 20 字、英文 ≤ 8 词），系统会自动平衡换行、避头尾、按空间缩放字号。',
    params: {
      text: P.rich('标题文本', { required: true }),
      kicker: P.str('眉题：标题上方的小号分类/章节标签，如 "第一部分" "2025 Q3"'),
      subtitle: P.rich('副标题/导语，一句话补充'),
      size: P.enm(['auto', 's', 'm', 'l', 'xl'], 'auto', '字号等级；auto 由布局决定（封面最大）'),
    },
    aliases: { heading: {}, headline: {}, h1: {}, header: {} },
    examples: [{ type: 'title', kicker: '2025 年度报告', text: '用户增长 ==三倍== 的一年', subtitle: '从 120 万到 380 万，我们做对了什么' }],
    normalize(b) { if (b.text == null && b.title != null) { b.text = b.title; delete b.title; } return b; },
  },

  text: {
    label: '正文', category: 'text', nature: 'copy',
    summary: '段落文本，空行分段。',
    description: '用于一两段说明文字。超过约 80 个汉字会显得拥挤——优先拆成 bullets 或下一个场景。size=l 适合作为导语（lead）。',
    params: {
      text: P.rich('正文，空行分段，支持轻量标记', { required: true }),
      size: P.enm(['auto', 's', 'm', 'l'], 'auto', '字号；l 为导语大字'),
      columns: P.enm([1, 2], 1, '分栏'),
    },
    aliases: { paragraph: {}, body: {}, p: {}, description: {} },
    examples: [{ type: 'text', text: '我们把复杂的渲染流程沉淀进软件本身，**AI 只需提供内容与数据**。' }],
    normalize(b) { if (b.text == null && b.content != null) { b.text = b.content; delete b.content; } if (Array.isArray(b.text)) b.text = b.text.join('\n\n'); return b; },
  },

  bullets: {
    label: '要点列表', category: 'text', nature: 'copy',
    summary: '3–6 条要点，可带图标/编号/勾选/卡片样式。',
    description: '每条要点尽量一行（中文 ≤ 24 字）。可给每项 detail 作为补充说明。style=cards 时作为网格卡片（视觉块）展示；icons 时请给每项 icon，未给时系统会根据文本关键词自动选择图标。',
    params: {
      items: P.arr(P.obj({ text: P.rich('要点'), detail: P.rich('补充说明'), icon: P.icon(ICON_DESC) }), '要点数组；也可以直接给字符串数组', { required: true }),
      style: P.enm(['auto', 'dots', 'numbers', 'icons', 'checks', 'dashes', 'cards'], 'auto', '列表样式'),
      columns: P.enm(['auto', 1, 2, 3], 'auto', '列数'),
    },
    aliases: { list: {}, points: {}, checklist: { style: 'checks' }, numbered: { style: 'numbers' } },
    examples: [{ type: 'bullets', style: 'icons', items: [{ text: '端到端加密', icon: 'shield-check' }, { text: '毫秒级同步', icon: 'zap' }, { text: '离线可用', icon: 'wifi-off' }] }],
    normalize(b) { b.items = normalizeItems(b.items ?? b.points ?? b.list); delete b.points; delete b.list; return b; },
  },

  quote: {
    label: '引言', category: 'text', nature: 'copy',
    summary: '大号引言 + 署名。',
    description: '适合用户评价、名人名言、核心观点。引言宜 15–60 字。',
    params: {
      text: P.rich('引言内容', { required: true }),
      author: P.str('署名'),
      role: P.str('身份/出处'),
      avatar: P.asset('头像图片资源'),
    },
    aliases: { testimonial: {}, blockquote: {} },
    examples: [{ type: 'quote', text: '设计不只是外观和感觉，设计是它如何运作。', author: 'Steve Jobs' }],
    normalize(b) { if (b.text == null && b.quote) { b.text = b.quote; delete b.quote; } return b; },
  },

  callout: {
    label: '提示框', category: 'text', nature: 'copy',
    summary: '带图标的强调提示/结论框。',
    description: '用于一句结论、注意事项或关键洞察。',
    params: {
      text: P.rich('内容', { required: true }),
      label: P.str('小标题，如 "关键结论"'),
      icon: P.icon(ICON_DESC),
      tone: P.enm(TONES, 'auto', '语气色'),
    },
    aliases: { note: {}, insight: {}, tip: { tone: 'positive' }, warning: { tone: 'warning' } },
    examples: [{ type: 'callout', label: '关键结论', text: '留存率提升主要来自新手引导的重构。', icon: 'lightbulb' }],
  },

  code: {
    label: '代码', category: 'text', nature: 'visual',
    summary: '代码块，带语法高亮与打字动画。',
    description: '支持 js/ts/python/json/bash/sql/rust/go/java/c/cpp/html/css 的基础高亮。highlight 指定要强调的行号（从 1 开始）。',
    params: {
      code: P.str('代码文本', { required: true, multiline: true }),
      language: P.str('语言'),
      title: P.str('窗口标题/文件名'),
      highlight: P.arr(P.int('行号'), '强调行'),
      typing: P.bool('逐字打出', true),
    },
    aliases: { snippet: {} },
    examples: [{ type: 'code', language: 'python', title: 'train.py', code: 'model = Motif()\nmodel.render("intro.mp4")' }],
  },

  // ───────────────────────────── data ─────────────────────────────
  stat: {
    label: '关键数字', category: 'data', nature: 'visual',
    summary: '一个大号数字（滚动计数）+ 标签 + 变化量。',
    description: 'value 可写数字或 "35%" "¥1.2亿" "3.8M" 这类字符串，系统自动解析前后缀并做计数动画。delta 显示涨跌（"+12%" 或数字），trend 给出一组数字时会画迷你走势线。',
    params: {
      value: P.any('数值（数字或带单位字符串）', { required: true }),
      label: P.rich('说明标签'),
      prefix: P.str('前缀，如 ¥ $'),
      suffix: P.str('后缀/单位，如 % 万 亿 x'),
      decimals: P.int('小数位'),
      delta: P.any('变化量，如 "+12%" 或 -3.2'),
      deltaLabel: P.str('变化量说明，如 "同比"'),
      context: P.rich('补充一句话'),
      icon: P.icon(ICON_DESC),
      trend: P.arr(P.num('值'), '迷你走势数据'),
      ring: P.num('0–100：在数字周围画进度环'),
    },
    aliases: { number: {}, kpi: {}, metric: {}, bignumber: {} },
    examples: [{ type: 'stat', value: '3.8M', label: '月活跃用户', delta: '+212%', deltaLabel: '同比' }],
    normalize(b) { return normStatLike(b); },
  },

  stats: {
    label: '数字组', category: 'data', nature: 'visual',
    summary: '2–4 个关键数字并列成组。',
    description: '每项同 stat 的字段（value/label/delta/prefix/suffix/icon）。超过 4 个会自动换行成网格。',
    params: {
      items: P.arr(P.obj({ value: P.any('数值'), label: P.rich('标签'), delta: P.any('变化'), prefix: P.str('前缀'), suffix: P.str('后缀'), icon: P.icon('图标'), decimals: P.int('小数位') }), '数字项', { required: true }),
      style: P.enm(['auto', 'plain', 'cards', 'divided'], 'auto', '样式'),
    },
    aliases: { kpis: {}, metrics: {}, numbers: {} },
    examples: [{ type: 'stats', items: [{ value: 98.6, suffix: '%', label: '可用性' }, { value: '12ms', label: 'P50 延迟' }, { value: 4.9, decimals: 1, label: '用户评分' }] }],
    normalize(b) { b.items = (Array.isArray(b.items) ? b.items : normalizeItems(b.items, 'label')).map(normStatLike); return b; },
  },

  chart: {
    label: '图表', category: 'data', nature: 'visual',
    summary: '动态数据图表：柱/条/折线/面积/饼/环/散点/堆叠/瀑布/漏斗/雷达/仪表/进度/排名动画。',
    description: [
      'kind 选择图表类型：bar 柱状、hbar 横向条形（排名）、line 折线、area 面积、pie 饼图、donut 环图、scatter 散点/气泡、stacked 堆叠柱、waterfall 瀑布、funnel 漏斗、radar 雷达、gauge 仪表盘、progress 进度条组、race 动态排名（每列一期，条形排序动画）。',
      'data 接受多种写法：{labels:[...], series:[{name, values:[...]}]}；[{label, value}] 行数组；{"A":1,"B":2} 映射；[["A",1],["B",2]]；{columns:[...], rows:[[...]]}；CSV 字符串；散点用 {points:[[x,y],...]}。',
      'highlight 指定要强调的类别（标签或序号），其余变灰；annotate 在某个类别上加注释气泡。单位用 suffix/prefix。动画由主题自动编排（坐标轴→数据→标签→注释）。',
    ].join('\n'),
    params: {
      kind: P.enm(['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'scatter', 'stacked', 'waterfall', 'funnel', 'radar', 'gauge', 'progress', 'race'], 'bar', '图表类型'),
      data: P.data('数据（多种写法，见描述）', { required: true }),
      title: P.str('图表小标题（场景已有标题时可省略）'),
      prefix: P.str('数值前缀'),
      suffix: P.str('数值后缀/单位'),
      decimals: P.int('数值小数位'),
      highlight: P.any('强调的类别：标签字符串、序号或数组'),
      annotate: P.arr(P.obj({ at: P.any('类别标签或序号'), text: P.str('注释'), series: P.int('系列序号') }), '注释气泡'),
      legend: P.enm(['auto', 'top', 'bottom', 'none'], 'auto', '图例'),
      labels: P.enm(['auto', 'all', 'end', 'none'], 'auto', '数值标签'),
      smooth: P.bool('折线平滑', true),
      sort: P.enm(['none', 'asc', 'desc'], 'none', '排序'),
      min: P.num('坐标轴最小值'),
      max: P.num('坐标轴最大值（gauge/progress 的满值）'),
      colors: P.arr(P.color('颜色'), '自定义系列颜色（默认取主题数据色板）'),
      axis: P.obj({ x: P.str('X 轴标题'), y: P.str('Y 轴标题') }, '轴标题'),
    },
    aliases: {
      barchart: { kind: 'bar' }, bar: { kind: 'bar' }, column: { kind: 'bar' }, columns: { kind: 'bar' }, hbar: { kind: 'hbar' }, ranking: { kind: 'hbar' },
      linechart: { kind: 'line' }, line: { kind: 'line' }, area: { kind: 'area' }, areachart: { kind: 'area' }, pie: { kind: 'pie' }, piechart: { kind: 'pie' },
      donut: { kind: 'donut' }, doughnut: { kind: 'donut' }, scatter: { kind: 'scatter' }, bubble: { kind: 'scatter' }, stacked: { kind: 'stacked' },
      waterfall: { kind: 'waterfall' }, funnel: { kind: 'funnel' }, radar: { kind: 'radar' }, gauge: { kind: 'gauge' }, progress: { kind: 'progress' },
      barrace: { kind: 'race' }, race: { kind: 'race' }, graph: {}, plotdata: {},
    },
    examples: [
      { type: 'chart', kind: 'bar', data: { labels: ['2021', '2022', '2023', '2024', '2025'], series: [{ name: '营收', values: [12, 19, 31, 52, 86] }] }, suffix: '亿', highlight: '2025', annotate: [{ at: '2025', text: '同比 +65%' }] },
      { type: 'chart', kind: 'donut', data: [{ label: '移动端', value: 62 }, { label: '桌面端', value: 28 }, { label: '平板', value: 10 }], suffix: '%' },
    ],
    normalize(b) {
      if (b.kind == null && b.chart) { b.kind = b.chart; delete b.chart; }
      if (b.kind == null && b.chartType) { b.kind = b.chartType; delete b.chartType; }
      if (typeof b.kind === 'string') {
        // "pie3d" → pie, "bar_chart" → bar, "Line Graph" → line (3D bars have their own component)
        const k = b.kind.toLowerCase().replace(/[\s_-]+/g, '').replace(/3d$/, '').replace(/(chart|graph)$/, '').replace(/[^a-z]/g, '') || 'bar';
        const map = { column: 'bar', columns: 'bar', vbar: 'bar', horizontalbar: 'hbar', barh: 'hbar', doughnut: 'donut', ring: 'donut', bubble: 'scatter', stackedbar: 'stacked', barrace: 'race', linechart: 'line', barchart: 'bar' };
        b.kind = map[k] || k;
      }
      const meta = {};
      const raw = b.data ?? b.values ?? b.rows ?? b.series;
      if (b.data == null && b.labels && (b.values || b.series)) b.data = { labels: b.labels, values: b.values, series: b.series };
      b.data = normalizeChartData(b.data ?? raw, meta);
      delete b.values; delete b.rows; delete b.series; delete b.labels;
      if (meta.suffix && b.suffix == null) b.suffix = meta.suffix;
      if (meta.prefix && b.prefix == null) b.prefix = meta.prefix;
      return b;
    },
  },

  table: {
    label: '表格', category: 'data', nature: 'visual',
    summary: '精排表格：逐行入场、强调行/列、数字右对齐。',
    description: '用于少量结构化对比（≤ 7 行 × 5 列为佳）。columns 为表头，rows 为二维数组。highlight 可指定强调的行号或列号（从 0 开始，不含表头）。',
    params: {
      columns: P.arr(P.any('表头文本或 {label, align}'), '表头', { required: true }),
      rows: P.arr(P.arr(P.any('单元格')), '数据行', { required: true }),
      highlight: P.obj({ row: P.int('强调行'), col: P.int('强调列') }, '强调'),
      title: P.str('表格标题'),
    },
    aliases: { grid: {}, datatable: {} },
    examples: [{ type: 'table', columns: ['方案', '成本', '周期', '风险'], rows: [['自研', '高', '9 个月', '中'], ['采购', '中', '2 个月', '低'], ['合作', '低', '4 个月', '中']], highlight: { row: 1 } }],
    normalize(b) {
      if (!b.columns && Array.isArray(b.rows) && Array.isArray(b.rows[0])) { b.columns = b.rows[0]; b.rows = b.rows.slice(1); }
      if (typeof b.data === 'string' && !b.rows) {
        const lines = b.data.trim().split(/\n/).map((l) => l.split(/,|\t/));
        b.columns = lines[0]; b.rows = lines.slice(1); delete b.data;
      }
      if (Array.isArray(b.rows) && b.rows.length && isPlainObject(b.rows[0])) {
        const cols = b.columns && b.columns.length ? b.columns.map((c) => (isPlainObject(c) ? c.key ?? c.label : c)) : Object.keys(b.rows[0]);
        b.rows = b.rows.map((r) => cols.map((c) => r[c]));
        if (!b.columns) b.columns = cols;
      }
      return b;
    },
  },

  pictogram: {
    label: '象形图', category: 'data', nature: 'visual',
    summary: '用图标阵列表达比例，如 "10 人中有 7 人"。',
    description: 'value/total 为高亮数量与总数（total 默认 10，最多 100）。icon 默认 user。',
    params: {
      value: P.num('高亮数量', { required: true }),
      total: P.int('总数', { default: 10 }),
      icon: P.icon(ICON_DESC),
      label: P.rich('说明'),
      columns: P.int('每行个数'),
    },
    aliases: { isotype: {}, iconarray: {} },
    examples: [{ type: 'pictogram', value: 7, total: 10, icon: 'user', label: '**7/10** 的用户每天都会打开应用' }],
  },

  // ───────────────────────────── infographic / diagram ─────────────────────────────
  timeline: {
    label: '时间线', category: 'diagram', nature: 'visual',
    summary: '里程碑时间线，线条生长、节点依次点亮。',
    description: 'items 每项 {date, title, text?, icon?}。3–7 项最佳。highlight 指定强调项序号（如当前阶段）。',
    params: {
      items: P.arr(P.obj({ date: P.str('时间'), title: P.rich('事件'), text: P.rich('说明'), icon: P.icon('图标') }), '事件', { required: true }),
      orientation: P.enm(['auto', 'horizontal', 'vertical'], 'auto', '方向（auto：横屏水平、竖屏垂直）'),
      highlight: P.int('强调项序号'),
    },
    aliases: { milestones: {}, roadmap: {}, history: {} },
    examples: [{ type: 'timeline', items: [{ date: '2019', title: '创立' }, { date: '2021', title: 'A 轮融资' }, { date: '2023', title: '用户破百万' }, { date: '2025', title: '全球化' }], highlight: 3 }],
    normalize(b) { b.items = normalizeItems(b.items ?? b.events ?? b.milestones, 'title').map((it) => { if (it.date == null && it.time != null) { it.date = it.time; delete it.time; } if (it.date == null && it.year != null) { it.date = String(it.year); delete it.year; } return it; }); delete b.events; delete b.milestones; return b; },
  },

  steps: {
    label: '流程步骤', category: 'diagram', nature: 'visual',
    summary: '有序流程：编号节点 + 连接箭头；circle 样式为循环。',
    description: 'items 每项 {title, text?, icon?}，3–6 步最佳。style: arrows 箭头链、numbers 大编号、cards 卡片、circle 循环图。',
    params: {
      items: P.arr(P.obj({ title: P.rich('步骤'), text: P.rich('说明'), icon: P.icon('图标') }), '步骤', { required: true }),
      style: P.enm(['auto', 'arrows', 'numbers', 'cards', 'circle'], 'auto', '样式'),
      highlight: P.int('强调步骤序号'),
    },
    aliases: { process: {}, workflow: {}, cycle: { style: 'circle' }, stages: {} },
    examples: [{ type: 'steps', items: [{ title: '导入素材', icon: 'file-up' }, { title: '自动设计', icon: 'wand-sparkles' }, { title: '精修', icon: 'sliders-horizontal' }, { title: '导出', icon: 'film' }] }],
    normalize(b) { b.items = normalizeItems(b.items ?? b.steps, 'title'); delete b.steps; return b; },
  },

  features: {
    label: '图标网格', category: 'diagram', nature: 'visual',
    summary: '图标 + 标题 + 说明的特性网格。',
    description: 'items 每项 {icon, title, text?}。2–6 项。未给 icon 时按关键词自动匹配。',
    params: {
      items: P.arr(P.obj({ icon: P.icon(ICON_DESC), title: P.rich('标题'), text: P.rich('说明') }), '特性', { required: true }),
      columns: P.enm(['auto', 2, 3, 4], 'auto', '列数'),
      style: P.enm(['auto', 'cards', 'plain'], 'auto', '样式'),
    },
    aliases: { iconGrid: {}, icongrid: {}, cards: {}, grid_features: {}, benefits: {} },
    examples: [{ type: 'features', items: [{ icon: 'gauge', title: '更快', text: '渲染速度提升 4 倍' }, { icon: 'palette', title: '更美', text: '10 套专业主题' }, { icon: 'bot', title: '更智能', text: 'AI 一键成片' }] }],
    normalize(b) { b.items = normalizeItems(b.items ?? b.features, 'title'); delete b.features; return b; },
  },

  compare: {
    label: '对比', category: 'diagram', nature: 'visual',
    summary: '两栏（或多栏）对比：之前/之后、方案 A/B、优/劣。',
    description: 'columns 为 2–3 个 {title, items[], value?, icon?, tone?}。winner 指定胜出栏序号以强调。也可用 left/right 两个字段。',
    params: {
      columns: P.arr(P.obj({ title: P.rich('栏标题'), items: P.arr(P.rich('条目'), '条目'), value: P.any('可选大数字'), icon: P.icon('图标'), tone: P.enm(TONES, 'auto', '色调') }), '对比栏', { required: true }),
      winner: P.int('胜出栏序号'),
      vs: P.bool('中间显示 VS', true),
    },
    aliases: { comparison: {}, versus: {}, vs: {}, beforeafter: {}, proscons: {} },
    examples: [{ type: 'compare', columns: [{ title: '过去', items: ['手动排版 3 天', '图表靠截图'] }, { title: '现在', items: ['自动成片 3 分钟', '数据驱动动画'] }], winner: 1 }],
    normalize(b) {
      if (!b.columns && (b.left || b.right)) { b.columns = [b.left, b.right].filter(Boolean); delete b.left; delete b.right; }
      if (!b.columns && b.before && b.after) { b.columns = [b.before, b.after]; delete b.before; delete b.after; if (b.winner == null) b.winner = 1; }
      b.columns = (b.columns || []).map((c) => (typeof c === 'string' ? { title: c, items: [] } : { ...c, items: normalizeItems(c.items ?? c.points).map((i) => i.text) }));
      return b;
    },
  },

  flow: {
    label: '流程图', category: 'diagram', nature: 'visual',
    summary: '节点-连线图（自动分层布局），连线流动动画。',
    description: 'nodes: [{id, label, icon?, tone?}]；edges: [["a","b","可选标签"], …] 或 {from,to,label}。direction right（左→右）或 down（上→下）。适合架构图、数据流、决策流程。',
    params: {
      nodes: P.arr(P.obj({ id: P.str('节点 ID'), label: P.rich('文本'), icon: P.icon('图标'), tone: P.enm(TONES, 'auto', '色调') }), '节点', { required: true }),
      edges: P.arr(P.any('[from, to, label?] 或 {from, to, label}'), '连线'),
      direction: P.enm(['auto', 'right', 'down'], 'auto', '方向'),
    },
    aliases: { diagram: {}, architecture: {}, graph_diagram: {}, dataflow: {} },
    examples: [{ type: 'flow', nodes: [{ id: 'in', label: '素材', icon: 'files' }, { id: 'ai', label: 'AI 分析', icon: 'brain' }, { id: 'eng', label: '渲染引擎', icon: 'cpu' }, { id: 'out', label: '成片', icon: 'clapperboard' }], edges: [['in', 'ai'], ['ai', 'eng'], ['eng', 'out']] }],
    normalize(b) {
      b.nodes = normalizeItems(b.nodes, 'label').map((n, i) => ({ ...n, id: String(n.id ?? n.label ?? i) }));
      b.edges = (b.edges || b.links || []).map((e) => (Array.isArray(e) ? { from: String(e[0]), to: String(e[1]), label: e[2] } : { from: String(e.from ?? e.source), to: String(e.to ?? e.target), label: e.label }));
      delete b.links;
      return b;
    },
  },

  hierarchy: {
    label: '层级图', category: 'diagram', nature: 'visual',
    summary: '树状层级 / 组织架构 / 思维导图。',
    description: 'root: {label, children:[{label, children:[…]}]}。style tree 自上而下，mindmap 自中心向两侧。建议 ≤ 3 层、≤ 15 个节点。',
    params: {
      root: P.any('根节点 {label, icon?, children:[…]}', { required: true }),
      style: P.enm(['auto', 'tree', 'mindmap'], 'auto', '样式'),
    },
    aliases: { tree: {}, orgchart: {}, mindmap: { style: 'mindmap' } },
    examples: [{ type: 'hierarchy', root: { label: '律影', children: [{ label: '引擎', children: [{ label: '排版' }, { label: '动画' }] }, { label: '接口', children: [{ label: 'CLI' }, { label: 'MCP' }] }] } }],
    normalize(b) { if (!b.root && b.tree) { b.root = b.tree; delete b.tree; } if (!b.root && b.label) { b.root = { label: b.label, children: b.children }; delete b.label; delete b.children; } return b; },
  },

  matrix: {
    label: '四象限', category: 'diagram', nature: 'visual',
    summary: '2×2 矩阵：坐标轴 + 象限 + 散布的条目。',
    description: 'axes: {x:["低","高"], y:["低","高"], xLabel, yLabel}；quadrants: 4 个象限标题（左上、右上、左下、右下）；items: [{label, x:0–1, y:0–1}]。',
    params: {
      axes: P.obj({ x: P.arr(P.str(''), 'X 轴两端'), y: P.arr(P.str(''), 'Y 轴两端'), xLabel: P.str('X 轴名'), yLabel: P.str('Y 轴名') }, '坐标轴'),
      quadrants: P.arr(P.str('象限标题'), '左上、右上、左下、右下'),
      items: P.arr(P.obj({ label: P.str('条目'), x: P.num('0–1'), y: P.num('0–1') }), '条目'),
      highlight: P.int('强调象限 0–3'),
    },
    aliases: { quadrant: {}, swot: {}, '2x2': {} },
    examples: [{ type: 'matrix', axes: { xLabel: '投入', yLabel: '价值' }, quadrants: ['重点投入', '战略项目', '快速见效', '暂缓'], items: [{ label: '自动成片', x: 0.3, y: 0.85 }] }],
  },

  pyramid: {
    label: '金字塔', category: 'diagram', nature: 'visual',
    summary: '分层金字塔（自上而下）。',
    description: 'items 自顶到底，每项 {title, text?}。3–5 层。',
    params: { items: P.arr(P.obj({ title: P.rich('层'), text: P.rich('说明') }), '层级', { required: true }), invert: P.bool('倒金字塔（漏斗形）', false) },
    aliases: { layers: {} },
    examples: [{ type: 'pyramid', items: [{ title: '愿景' }, { title: '战略' }, { title: '执行' }] }],
    normalize(b) { b.items = normalizeItems(b.items, 'title'); return b; },
  },

  // ───────────────────────────── media ─────────────────────────────
  image: {
    label: '图片', category: 'media', nature: 'visual',
    summary: '图片：智能裁切、缓慢推拉（Ken Burns）、蒙版与相框。',
    description: 'asset 为项目资源 ID（motif assets add 导入后获得）；也可写 src 为本地路径或 URL（导入时会复制进项目）。mount 外框: rounded 圆角、circle 圆形、arch 拱形、phone 手机样机、laptop 笔记本样机、browser 浏览器窗口、polaroid 相纸。move 画面运动: kenburns 慢推、parallax 视差、none。',
    params: {
      asset: P.asset('图片资源 ID'),
      src: P.str('图片路径或 URL（未导入时）'),
      fit: P.enm(['cover', 'contain'], 'cover', '填充方式'),
      focus: P.arr(P.num(''), '焦点 [x,y]（0–1），裁切时保留'),
      mount: P.enm(['auto', 'none', 'rounded', 'circle', 'arch', 'phone', 'laptop', 'browser', 'polaroid'], 'auto', '外框 / 样机'),
      move: P.enm(['auto', 'kenburns', 'parallax', 'none'], 'auto', '画面运动'),
      caption: P.rich('图注'),
      overlay: P.num('暗化遮罩 0–1（全屏图上叠字时使用）'),
    },
    aliases: { photo: {}, picture: {}, img: {}, screenshot: { mount: 'browser', fit: 'contain' } },
    examples: [{ type: 'image', asset: 'ast_hero', mount: 'rounded', caption: '新版编辑器' }],
    normalize(b) {
      if (!b.asset && !b.src && b.url) { b.src = b.url; delete b.url; }
      if (!b.asset && !b.src && b.file) { b.src = b.file; delete b.file; }
      // legacy / natural spellings: frame:"phone" is a mount, motion:"kenburns" is camera-like movement
      if (typeof b.frame === 'string') { b.mount = b.frame; delete b.frame; }
      if (typeof b.motion === 'string') { b.move = b.motion; delete b.motion; }
      return b;
    },
  },

  gallery: {
    label: '图集', category: 'media', nature: 'visual',
    summary: '多张图片的网格/拼贴，依次入场。',
    description: 'images 为资源 ID 或 {asset, caption} 数组，2–6 张。',
    params: {
      images: P.arr(P.any('资源 ID 或 {asset, caption}'), '图片', { required: true }),
      layout: P.enm(['auto', 'grid', 'mosaic', 'row'], 'auto', '排列'),
    },
    aliases: { photos: {}, collage: {} },
    examples: [{ type: 'gallery', images: ['ast_a', 'ast_b', 'ast_c'] }],
    normalize(b) { b.images = (b.images || []).map((i) => (typeof i === 'string' ? (/^ast_/.test(i) ? { asset: i } : { src: i }) : i)); return b; },
  },

  icon: {
    label: '图标', category: 'media', nature: 'visual',
    summary: '单个大图标（描线绘制动画），可带标签。',
    description: '用于强调一个概念。name 为 Lucide 图标名。',
    params: { name: P.icon(ICON_DESC, { required: true }), label: P.rich('标签'), badge: P.enm(['auto', 'none', 'circle', 'square'], 'auto', '底座') },
    aliases: { symbol: {} },
    examples: [{ type: 'icon', name: 'sparkles', label: '自动设计' }],
    normalize(b) { if (!b.name && b.icon) { b.name = b.icon; delete b.icon; } return b; },
  },

  video: {
    label: '视频', category: 'media', nature: 'visual',
    summary: '嵌入视频片段（逐帧精确同步）。',
    description: 'asset 为视频资源 ID。trim: [开始秒, 结束秒]。导出时逐帧解码，保证与动画同步。',
    params: {
      asset: P.asset('视频资源 ID', { required: true }),
      trim: P.arr(P.num(''), '[开始, 结束] 秒'),
      fit: P.enm(['cover', 'contain'], 'cover', '填充'),
      mount: P.enm(['auto', 'none', 'rounded', 'phone', 'laptop', 'browser'], 'auto', '外框 / 样机'),
      volume: P.num('音量 0–1（导出时混入）'),
    },
    aliases: { clip: {}, footage: {} },
    examples: [{ type: 'video', asset: 'ast_demo', trim: [2, 8], mount: 'laptop' }],
    normalize(b) { if (typeof b.frame === 'string') { b.mount = b.frame; delete b.frame; } return b; },
  },

  shape: {
    label: '形状', category: 'media', nature: 'visual',
    summary: '装饰与标注形状：矩形、圆、线、箭头、高亮框。',
    description: '通常配合 frame 手动定位使用（编辑器中绘制）。kind: rect/circle/line/arrow/highlight/brace。',
    params: {
      kind: P.enm(['rect', 'circle', 'line', 'arrow', 'highlight', 'brace'], 'rect', '形状'),
      color: P.color('颜色'),
      fill: P.bool('填充', false),
      text: P.rich('附带文字'),
    },
    aliases: { arrow: { kind: 'arrow' }, box: { kind: 'rect' }, circle: { kind: 'circle' } },
    examples: [{ type: 'shape', kind: 'arrow', color: 'accent', frame: { x: 0.5, y: 0.5, w: 0.2, h: 0.05 } }],
  },

  // ───────────────────────────── math & science ─────────────────────────────
  equation: {
    label: '公式', category: 'math', nature: 'visual',
    summary: 'LaTeX 公式，逐笔书写动画；steps 可展示推导步骤（逐步变换）。',
    description: 'latex 为公式（不需要 $ 包围）。steps 为后续推导式数组，按时间依次变换（相同符号保持、变化部分淡入淡出）。可用 \\color{accent}{…} 或 \\hl{…} 强调部分（accent 等主题色名有效）。label 为右侧编号/说明。',
    params: {
      latex: P.latex('LaTeX 公式', { required: true }),
      steps: P.arr(P.latex('后续步骤'), '推导步骤'),
      size: P.enm(['auto', 's', 'm', 'l', 'xl'], 'auto', '字号'),
      label: P.rich('说明/编号'),
    },
    aliases: { formula: {}, math: {}, latex: {}, tex: {} },
    examples: [{ type: 'equation', latex: 'e^{i\\pi} + 1 = 0', label: '欧拉恒等式' }, { type: 'equation', latex: '(a+b)^2', steps: ['a^2 + 2ab + b^2'] }],
    normalize(b) { if (!b.latex && b.tex) { b.latex = b.tex; delete b.tex; } if (!b.latex && b.formula) { b.latex = b.formula; delete b.formula; } if (typeof b.latex === 'string') b.latex = b.latex.trim().replace(/^\$+|\$+$/g, ''); return b; },
  },

  plot: {
    label: '函数图像', category: 'math', nature: 'visual',
    summary: '坐标系 + 函数曲线（描绘动画），可加点、面积、切线、参数动画。',
    description: [
      'functions: [{expr:"sin(x)", label?, color?, dashed?}]，表达式支持 + - * / ^、sin cos tan exp log ln sqrt abs floor pi e 等；也可 {x:"cos(t)", y:"sin(t)", t:[0, 6.28]} 参数方程。',
      'x/y 为范围 [min,max]（y 可省略自动）。points: [{x, y, label}]。area: {expr, from, to} 阴影积分面积。tangent: {expr, from, to} 切点沿 x 移动的切线。',
      'param: {name:"a", from:0, to:2} 让表达式中的参数随时间变化（表达式中写 a）。',
    ].join('\n'),
    params: {
      functions: P.arr(P.obj({ expr: P.expr('y = f(x) 的表达式'), x: P.expr('参数方程 x(t)'), y: P.expr('参数方程 y(t)'), t: P.arr(P.num(''), 't 范围'), label: P.latex('标签（LaTeX）'), color: P.color('颜色'), dashed: P.bool('虚线', false) }), '函数', { required: true }),
      x: P.range('x 范围 [min,max]'),
      y: P.range('y 范围 [min,max]，省略则自动'),
      points: P.arr(P.obj({ x: P.num(''), y: P.num(''), label: P.str('标签') }), '标注点'),
      area: P.obj({ expr: P.expr('被积函数'), from: P.num('下限'), to: P.num('上限'), label: P.latex('标签') }, '面积阴影'),
      tangent: P.obj({ expr: P.expr('函数'), from: P.num('起点 x'), to: P.num('终点 x') }, '移动切线'),
      param: P.obj({ name: P.str('参数名'), from: P.num('起始值'), to: P.num('结束值') }, '随时间变化的参数'),
      grid: P.bool('网格', true),
      axes: P.obj({ x: P.str('x 轴标签'), y: P.str('y 轴标签') }, '轴标签'),
    },
    aliases: { function: {}, graph2d: {}, functionplot: {}, curve: {} },
    examples: [{ type: 'plot', functions: [{ expr: 'sin(x)', label: '\\sin x' }, { expr: 'cos(x)', label: '\\cos x', dashed: true }], x: [-6.3, 6.3], y: [-1.5, 1.5] }],
    normalize(b) {
      if (!b.functions && (b.expr || b.fn || b.f)) { b.functions = [{ expr: b.expr || b.fn || b.f }]; delete b.expr; delete b.fn; delete b.f; }
      if (typeof b.functions === 'string') b.functions = [b.functions];
      b.functions = (b.functions || []).map((f) => (typeof f === 'string' ? { expr: f.replace(/^\s*(?:y|f\(x\))\s*=\s*/, '') } : { ...f, expr: typeof f.expr === 'string' ? f.expr.replace(/^\s*(?:y|f\(x\))\s*=\s*/, '') : f.expr }));
      if (b.xRange && !b.x) { b.x = b.xRange; delete b.xRange; }
      if (b.yRange && !b.y) { b.y = b.yRange; delete b.yRange; }
      return b;
    },
  },

  geometry: {
    label: '几何作图', category: 'math', nature: 'visual',
    summary: '尺规式几何构造：点、线段、圆、多边形、角、标签，按顺序绘制。',
    description: 'points: {A:[x,y], B:[x,y]…}；shapes 按顺序绘制：{type:"segment", from:"A", to:"B"} / {type:"polygon", points:["A","B","C"], fill?} / {type:"circle", center:"O", radius:2 | through:"A"} / {type:"angle", at:"B", from:"A", to:"C", label:"θ"} / {type:"line", through:["A","B"]} / {type:"label", at:"A", text:"…"} / {type:"right-angle", at, from, to}。坐标范围由 view [xmin,xmax,ymin,ymax] 指定，省略自动。',
    params: {
      points: P.any('命名点 {A:[x,y], …}', { required: true }),
      shapes: P.arr(P.any('图元'), '按顺序绘制的图元', { required: true }),
      view: P.arr(P.num(''), '[xmin, xmax, ymin, ymax]'),
      showPoints: P.bool('显示点与点名', true),
    },
    aliases: { construction: {}, geo: {} },
    examples: [{ type: 'geometry', points: { A: [0, 0], B: [4, 0], C: [0, 3] }, shapes: [{ type: 'polygon', points: ['A', 'B', 'C'] }, { type: 'right-angle', at: 'A', from: 'B', to: 'C' }, { type: 'label', between: ['B', 'C'], text: 'c' }] }],
  },

  transform: {
    label: '线性变换', category: 'math', nature: 'visual',
    summary: '平面网格在 2×2 矩阵作用下连续变形（基向量、单位面积随之变化）。',
    description: 'matrix: [[a,b],[c,d]]。vectors: [[x,y]…] 额外向量。showDet 显示行列式面积。',
    params: {
      matrix: P.arr(P.arr(P.num('')), '2×2 矩阵', { required: true }),
      vectors: P.arr(P.arr(P.num('')), '额外向量'),
      showDet: P.bool('显示单位方格面积（行列式）', true),
      range: P.int('网格半宽', { default: 6 }),
    },
    aliases: { lineartransform: {}, matrixtransform: {} },
    examples: [{ type: 'transform', matrix: [[1, 1], [0, 1]] }],
  },

  vectorfield: {
    label: '向量场', category: 'math', nature: 'visual',
    summary: '二维向量场箭头 + 流线粒子。',
    description: 'fx, fy 为分量表达式（变量 x, y）。range 为 [xmin,xmax,ymin,ymax]。',
    params: {
      fx: P.expr('x 分量', { required: true }), fy: P.expr('y 分量', { required: true }),
      range: P.arr(P.num(''), '[xmin,xmax,ymin,ymax]'),
      particles: P.bool('流线粒子', true),
    },
    aliases: { field: {}, flowfield: {} },
    examples: [{ type: 'vectorfield', fx: '-y', fy: 'x' }],
  },

  fourier: {
    label: '傅里叶圆', category: 'math', nature: 'visual',
    summary: '旋转圆（周转圆）叠加描绘图形，展示傅里叶级数。',
    description: 'shape: heart 心形 / square 方波 / star 星 / infinity 无穷 / note 音符 / custom（配合 path SVG 路径）。terms 为圆的数量（5–200）。',
    params: {
      shape: P.enm(['heart', 'square', 'star', 'infinity', 'note', 'custom'], 'heart', '目标图形'),
      path: P.str('自定义 SVG path（shape=custom）'),
      terms: P.int('项数', { default: 40 }),
      cycles: P.num('绘制圈数', { default: 1 }),
    },
    aliases: { epicycles: {} },
    examples: [{ type: 'fourier', shape: 'heart', terms: 60 }],
  },

  simulation: {
    label: '物理模拟', category: 'math', nature: 'visual',
    summary: '确定性物理模拟：单摆、双摆、抛体、轨道、弹簧、波、干涉、随机游走。',
    description: 'preset 选择模型，params 微调（如 pendulum: {length, angle, damping}；projectile: {speed, angle, g}；orbit: {bodies}；wave: {frequency, amplitude}）。同一时间点总是渲染同一画面，可精确导出。',
    params: {
      preset: P.enm(['pendulum', 'double-pendulum', 'projectile', 'orbit', 'spring', 'wave', 'interference', 'random-walk'], 'pendulum', '模型'),
      params: P.any('模型参数'),
      trail: P.bool('轨迹', true),
      labels: P.bool('显示物理量标注', true),
    },
    aliases: { physics: {}, pendulum: { preset: 'pendulum' }, orbit: { preset: 'orbit' }, wave: { preset: 'wave' }, projectile: { preset: 'projectile' } },
    examples: [{ type: 'simulation', preset: 'double-pendulum' }],
  },

  // ───────────────────────────── 3D ─────────────────────────────
  globe: {
    label: '地球', category: '3d', nature: 'visual',
    summary: '3D 地球：点阵大陆、城市标记、飞线弧，缓慢转向焦点。',
    description: 'points: [{lat, lon, label?, value?}]；arcs: [{from:[lat,lon], to:[lat,lon]}] 或 {from:"城市名", to:"城市名"}（内置约 80 个主要城市坐标）；focus: [lat, lon] 或城市名。style: dots 点阵、solid 实体、wire 线框。',
    params: {
      points: P.arr(P.any('{lat, lon, label} 或城市名'), '标记点'),
      arcs: P.arr(P.any('{from, to}'), '飞线'),
      focus: P.any('镜头焦点 [lat, lon] 或城市名'),
      style: P.enm(['auto', 'dots', 'solid', 'wire'], 'auto', '样式'),
      spin: P.num('自转速度倍率', { default: 1 }),
    },
    aliases: { earth: {}, world: {}, map3d: {} },
    examples: [{ type: 'globe', points: ['北京', '纽约', '伦敦', '新加坡'], arcs: [{ from: '北京', to: '纽约' }, { from: '北京', to: '伦敦' }], focus: '北京' }],
  },

  bars3d: {
    label: '3D 柱状', category: '3d', nature: 'visual',
    summary: '3D 柱状矩阵，镜头环绕，柱体逐个升起。',
    description: 'data 同 chart（labels × series 构成网格），或一维数据单行显示。',
    params: { data: P.data('数据', { required: true }), suffix: P.str('单位'), highlight: P.any('强调') },
    aliases: { chart3d: {}, bar3d: {} },
    examples: [{ type: 'bars3d', data: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: '华东', values: [3, 5, 6, 9] }, { name: '华南', values: [2, 4, 7, 8] }] } }],
    normalize(b) { b.data = normalizeChartData(b.data); return b; },
  },

  surface: {
    label: '曲面', category: '3d', nature: 'visual',
    summary: '3D 函数曲面 z=f(x,y)，色带映射，镜头环绕。',
    description: 'expr 用变量 x, y（可含随时间变化的 t 产生波动）。range: [min,max] 同时作用于 x 与 y。',
    params: { expr: P.expr('z = f(x, y)', { required: true }), range: P.range('定义域'), animate: P.bool('随时间波动（表达式含 t）', false) },
    aliases: { surface3d: {}, plot3d: {} },
    examples: [{ type: 'surface', expr: 'sin(sqrt(x^2+y^2)*2)/ (1+0.3*(x^2+y^2))', range: [-4, 4] }],
    normalize(b) { if (typeof b.expr === 'string') b.expr = b.expr.replace(/^\s*z\s*=\s*/, ''); return b; },
  },

  particles: {
    label: '粒子', category: '3d', nature: 'visual',
    summary: '3D 粒子场：星系、球体、波浪，或聚合成文字。',
    description: 'shape: galaxy 星系 / sphere 球壳 / wave 波浪 / text（聚合成 text 文字）/ network 网络连线。',
    params: { shape: P.enm(['galaxy', 'sphere', 'wave', 'text', 'network'], 'galaxy', '形态'), text: P.str('shape=text 时的文字'), count: P.int('粒子数', { default: 6000 }) },
    aliases: { starfield: {}, galaxy: { shape: 'galaxy' } },
    examples: [{ type: 'particles', shape: 'text', text: 'MOTIF' }],
  },

  shape3d: {
    label: '3D 主视觉', category: '3d', nature: 'visual',
    summary: '抽象 3D 主视觉物体（扭结、二十面体、玻璃球、圆环），主题材质与灯光。',
    description: '用于封面或章节页的视觉焦点。material: glass 玻璃、metal 金属、matte 哑光、wire 线框、glow 发光。',
    params: {
      shape: P.enm(['torusknot', 'icosahedron', 'sphere', 'torus', 'blob', 'cube', 'rings'], 'torusknot', '形状'),
      material: P.enm(['auto', 'glass', 'metal', 'matte', 'wire', 'glow'], 'auto', '材质'),
      color: P.color('主色'),
    },
    aliases: { hero3d: {}, object3d: {} },
    examples: [{ type: 'shape3d', shape: 'torusknot', material: 'glass' }],
  },

  model: {
    label: '3D 模型', category: '3d', nature: 'visual',
    summary: '导入 glTF/GLB 模型，影棚灯光转台展示。',
    description: 'asset 为 .glb/.gltf 资源。rotate 自动转台。',
    params: { asset: P.asset('模型资源 ID', { required: true }), rotate: P.bool('转台', true), angle: P.num('初始角度（度）') },
    aliases: { gltf: {}, glb: {}, product3d: {} },
    examples: [{ type: 'model', asset: 'ast_product' }],
  },

  molecule: {
    label: '分子', category: '3d', nature: 'visual',
    summary: '3D 球棍分子模型。',
    description: 'preset: water 水、co2 二氧化碳、methane 甲烷、ethanol 乙醇、benzene 苯、caffeine 咖啡因、glucose 葡萄糖、dna 双螺旋片段；或 atoms: [{el:"C", x,y,z}] + bonds: [[i,j,order]]。',
    params: {
      preset: P.enm(['water', 'co2', 'methane', 'ethanol', 'benzene', 'caffeine', 'glucose', 'dna'], 'caffeine', '预设分子'),
      atoms: P.arr(P.any('{el, x, y, z}'), '自定义原子'),
      bonds: P.arr(P.any('[i, j, order]'), '自定义化学键'),
      labels: P.bool('显示元素符号', true),
    },
    aliases: { chemistry: {}, atom: {} },
    examples: [{ type: 'molecule', preset: 'caffeine' }],
  },
};

export const COMPONENT_TYPES = Object.keys(COMPONENTS);

/** alias name (lowercase, no punctuation) → { type, preset } */
export const TYPE_ALIASES = (() => {
  const m = {};
  for (const [type, spec] of Object.entries(COMPONENTS)) {
    m[type.toLowerCase()] = { type, preset: {} };
    for (const [alias, preset] of Object.entries(spec.aliases || {})) {
      const k = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!m[k]) m[k] = { type, preset };
    }
  }
  m.stat3 = { type: 'stats', preset: {} };
  m.image3d = { type: 'model', preset: {} };
  return m;
})();

export function resolveType(name) {
  if (!name) return null;
  const k = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  return TYPE_ALIASES[k] || null;
}

export const CATEGORY_LABELS = { text: '文字', data: '数据', diagram: '信息图', media: '媒体', math: '数学与科学', '3d': '3D' };
