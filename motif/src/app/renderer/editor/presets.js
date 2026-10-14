// Starter scenes and blocks offered by the "add" menus. Each is a real, well-formed design that the
// theme renders properly; people replace the words and numbers.
import { COMPONENTS } from '../../../core/catalog/components.js';
import { clone } from '../../../core/util/misc.js';

export const SCENE_PRESETS = [
  { id: 'cover', label: '封面', icon: 'presentation', hint: '大标题 + 副标题', scene: { layout: 'cover', blocks: [{ type: 'title', kicker: '2026', text: '在这里写下 ==主标题==', subtitle: '一句话说明这部作品讲什么' }] } },
  { id: 'section', label: '章节页', icon: 'bookmark', hint: '段落之间的停顿', scene: { layout: 'section', blocks: [{ type: 'title', kicker: '第一部分', text: '章节标题' }] } },
  { id: 'points', label: '要点', icon: 'list', hint: '标题 + 3–5 条要点', scene: { blocks: [{ type: 'title', text: '三个关键变化' }, { type: 'bullets', items: ['第一条要点，简短有力', '第二条要点，一句话讲清', '第三条要点，避免长句'] }] } },
  { id: 'stats', label: '关键数字', icon: 'hash', hint: '2–4 个大数字', scene: { blocks: [{ type: 'title', text: '一年的成绩' }, { type: 'stats', items: [{ value: 86, suffix: '亿', label: '年度营收' }, { value: 65, suffix: '%', label: '同比增长', delta: '+' }, { value: 380, suffix: '万', label: '付费用户' }] }] } },
  { id: 'chart', label: '图表', icon: 'chart-column', hint: '一个重点图表', scene: { layout: 'focus', blocks: [{ type: 'title', text: '五年增长走势' }, { type: 'chart', kind: 'bar', suffix: '亿', data: { labels: ['2021', '2022', '2023', '2024', '2025'], series: [{ name: '营收', values: [12, 19, 31, 52, 86] }] }, highlight: '2025' }] } },
  { id: 'split', label: '图文分栏', icon: 'columns-2', hint: '文字 + 图片/图表', scene: { layout: 'split', blocks: [{ type: 'title', text: '左侧讲观点', subtitle: '右侧放证据：图片、图表或 3D' }, { type: 'bullets', items: ['要点一', '要点二'] }, { type: 'chart', kind: 'donut', data: { 订阅: 54, 企业服务: 28, 广告: 12, 其他: 6 }, suffix: '%' }] } },
  { id: 'timeline', label: '时间线', icon: 'git-commit-horizontal', hint: '里程碑与历程', scene: { blocks: [{ type: 'title', text: '发展历程' }, { type: 'timeline', items: [{ date: '2019', title: '公司成立' }, { date: '2021', title: 'A 轮融资' }, { date: '2023', title: '用户破百万' }, { date: '2025', title: '实现盈利' }] }] } },
  { id: 'steps', label: '步骤 / 流程', icon: 'list-ordered', hint: '分步说明', scene: { blocks: [{ type: 'title', text: '四步完成接入' }, { type: 'steps', items: [{ title: '注册', text: '创建团队空间' }, { title: '连接', text: '接入数据源' }, { title: '配置', text: '选择指标' }, { title: '发布', text: '分享看板' }] }] } },
  { id: 'compare', label: '对比', icon: 'columns-2', hint: '两种方案并列', scene: { blocks: [{ type: 'title', text: '过去 vs 现在' }, { type: 'compare', columns: [{ title: '过去', items: ['手工整理数据', '一周出一次报告'] }, { title: '现在', items: ['自动同步', '实时看板'] }], winner: 1 }] } },
  { id: 'quote', label: '引言', icon: 'quote', hint: '一句有分量的话', scene: { layout: 'quote', blocks: [{ type: 'quote', text: '简单是最终的复杂。', author: '达·芬奇' }] } },
  { id: 'equation', label: '公式', icon: 'sigma', hint: '数学 / 科学推导', scene: { layout: 'focus', blocks: [{ type: 'title', text: '勾股定理' }, { type: 'equation', latex: 'a^2 + b^2 = c^2', label: '直角三角形两直角边的平方和等于斜边的平方' }] } },
  { id: 'plot', label: '函数图像', icon: 'chart-spline', hint: '动态绘制曲线', scene: { layout: 'focus', blocks: [{ type: 'title', text: '正弦与余弦' }, { type: 'plot', functions: [{ expr: 'sin(x)', label: '\\sin x' }, { expr: 'cos(x)', label: '\\cos x', dashed: true }], x: [-6.3, 6.3], y: [-1.5, 1.5] }] } },
  { id: 'globe', label: '3D 地球', icon: 'globe', hint: '全球分布与连线', scene: { layout: 'split', blocks: [{ type: 'title', text: '覆盖全球 40 个国家' }, { type: 'globe', points: ['北京', '新加坡', '伦敦', '旧金山'], arcs: [{ from: '北京', to: '新加坡' }, { from: '北京', to: '伦敦' }, { from: '北京', to: '旧金山' }], focus: '北京' }] } },
  { id: 'image', label: '全屏图片', icon: 'image', hint: '大图 + 叠加标题', scene: { layout: 'full', blocks: [{ type: 'title', text: '一张图胜过千言' }, { type: 'image', caption: '拖入一张图片替换' }] } },
  { id: 'closing', label: '结尾', icon: 'flag', hint: '致谢与联系方式', scene: { layout: 'closing', blocks: [{ type: 'title', text: '谢谢', subtitle: 'hello@example.com' }] } },
  { id: 'blank', label: '空白', icon: 'square-dashed', hint: '自己添加元素', scene: { blocks: [] } },
];

/** A ready-to-render block for a component type (from the catalog's first example). */
export function blockPreset(type) {
  const c = COMPONENTS[type];
  if (!c) return { type };
  const ex = c.examples?.[0];
  if (ex) return clone({ ...ex, type });
  const b = { type };
  for (const [k, p] of Object.entries(c.params || {})) if (p.required) b[k] = p.type === 'array' ? [] : p.type === 'number' ? 0 : '';
  return b;
}
