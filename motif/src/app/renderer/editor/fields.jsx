// Inspector forms generated from the component catalog's param specs — the same specs that drive
// validation, the CLI docs and the AI tool schema, so every parameter an AI can set a person can
// edit too.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, ICON_NAMES } from '../icons.jsx';
import { Field, Group, NumberInput, Segmented, Select, Switch, TextArea, TextInput, Popover, toast } from '../ui.jsx';
import { editor } from './store.js';
import { call } from '../api.js';
import { checkExpr } from '../../../core/expr.js';
import { normalizeChartData } from '../../../core/catalog/data.js';

// ───────────────────────────── labels ─────────────────────────────
const KEY_LABEL = {
  text: '文本', kicker: '眉题', subtitle: '副标题', size: '字号', columns: '分栏/列', items: '条目', detail: '说明', icon: '图标', style: '样式',
  author: '作者', role: '身份', avatar: '头像', label: '标签', tone: '色调', code: '代码', language: '语言', title: '标题', highlight: '强调',
  typing: '打字效果', value: '数值', prefix: '前缀', suffix: '后缀/单位', decimals: '小数位', delta: '变化', deltaLabel: '变化说明', context: '注释',
  trend: '趋势数据', ring: '环形进度', kind: '类型', data: '数据', annotate: '注释', at: '位置', series: '系列', legend: '图例', labels: '数值标签',
  smooth: '平滑', sort: '排序', min: '最小值', max: '最大值', colors: '颜色', axis: '坐标轴', x: 'X', y: 'Y', rows: '行', row: '行', col: '列',
  total: '总数', date: '日期', orientation: '方向', winner: '胜出列', vs: 'VS 标记', nodes: '节点', id: 'ID', edges: '连线', direction: '方向',
  root: '根节点', axes: '轴', xLabel: 'X 轴名', yLabel: 'Y 轴名', quadrants: '象限', invert: '反转', asset: '资源', src: '路径/URL', fit: '填充',
  focus: '焦点', mount: '外框', move: '画面运动', caption: '图注', overlay: '暗化', images: '图片', layout: '排列', name: '名称', badge: '底座',
  trim: '裁剪', volume: '音量', color: '颜色', fill: '填充', latex: '公式', steps: '推导步骤', functions: '函数', expr: '表达式', t: '参数范围',
  dashed: '虚线', points: '点', area: '面积', from: '起点', to: '终点', tangent: '切线', param: '参数', grid: '网格', shapes: '图形', view: '视窗',
  showPoints: '显示点', matrix: '矩阵', vectors: '向量', showDet: '显示行列式', range: '范围', fx: 'Fx', fy: 'Fy', particles: '粒子', shape: '形状',
  path: '路径', terms: '项数', cycles: '周期', preset: '预设', params: '参数', trail: '轨迹', arcs: '连线', spin: '自转', animate: '动画', count: '数量',
  material: '材质', rotate: '旋转', angle: '角度', atoms: '原子', bonds: '化学键', w: '宽', h: '高', enter: '入场动画', delay: '延迟', speed: '速度',
  emphasis: '强调动画', exit: '退场', scale: '缩放', align: '对齐', card: '卡片', slot: '区域', key: '变形键', hidden: '隐藏', locked: '锁定', frame: '手动位置',
};
const VALUE_LABEL = {
  auto: '自动', none: '无', s: '小', m: '中', l: '大', xl: '特大', dots: '圆点', numbers: '数字', icons: '图标', checks: '勾选', dashes: '短横', cards: '卡片',
  accent: '强调', positive: '正向', negative: '负向', warning: '警示', neutral: '中性', plain: '朴素', divided: '分隔线', bar: '柱状', hbar: '条形', line: '折线',
  area: '面积', pie: '饼图', donut: '环形', scatter: '散点', stacked: '堆叠', waterfall: '瀑布', funnel: '漏斗', radar: '雷达', gauge: '仪表', progress: '进度',
  race: '排名竞赛', top: '上', bottom: '下', all: '全部', end: '末端', asc: '升序', desc: '降序', horizontal: '横向', vertical: '纵向', arrows: '箭头', circle: '圆形',
  right: '向右', down: '向下', tree: '树形', mindmap: '思维导图', cover: '铺满', contain: '完整', rounded: '圆角', arch: '拱形', phone: '手机', laptop: '笔记本',
  browser: '浏览器', polaroid: '相纸', kenburns: '慢推', parallax: '视差', grid: '网格', mosaic: '拼贴', row: '一行', square: '方形', rect: '矩形', arrow: '箭头',
  highlight: '高亮', brace: '括号', heart: '心形', star: '星形', infinity: '无穷', note: '音符', custom: '自定义', solid: '实体', wire: '线框', glass: '玻璃',
  metal: '金属', matte: '哑光', glow: '发光', left: '左', center: '中', card: '卡片', main: '主区', media: '视觉区', aside: '侧栏', header: '页眉', footer: '页脚',
  fade: '淡出', reverse: '倒放', pulse: '脉冲', shake: '抖动', float: '漂浮', 1: '1', 2: '2', 3: '3', 4: '4',
};
export const labelFor = (key, spec) => KEY_LABEL[key] || (spec?.desc ? spec.desc.split(/[，,（(：:。]/)[0].slice(0, 8) : key);
export const valueLabel = (v) => VALUE_LABEL[v] ?? String(v);

// ───────────────────────────── generic param field ─────────────────────────────
/**
 * One parameter. onChange(value, {commit}) — value null/undefined removes it.
 * ctx: { coalesceKey, doc } — passed to nested editors.
 */
export function ParamField({ name, spec, value, onChange, ctx, inline }) {
  const label = labelFor(name, spec);
  const help = spec.desc && spec.desc !== label ? spec.desc : undefined;
  const t = spec.type;
  if (t === 'object') {
    return (
      <Group title={label} open={value != null && Object.keys(value || {}).length > 0}>
        {Object.entries(spec.fields || {}).map(([k, sp]) => (
          <ParamField key={k} name={k} spec={sp} value={value?.[k]} ctx={ctx} onChange={(v, o) => onChange({ [k]: v === undefined ? null : v }, { ...o, merge: true })} />
        ))}
      </Group>
    );
  }
  if (t === 'array' && spec.item?.type === 'object') {
    return (
      <Field label={label} required={spec.required} stacked title={help}>
        <ListEditor value={value} itemSpec={spec.item} onChange={onChange} ctx={ctx} />
      </Field>
    );
  }
  if (t === 'array' && spec.item?.type === 'array') {
    return <Field label={label} stacked title={help}><GridEditor value={value} onChange={onChange} numeric={spec.item.item?.type === 'number'} /></Field>;
  }
  if (t === 'data') return <Field label={label} required={spec.required} stacked title={help}><DataEditor value={value} onChange={onChange} /></Field>;
  const stacked = ['richtext', 'latex'].includes(t) || (t === 'array' && !['number', 'integer'].includes(spec.item?.type)) || (t === 'any' && value && typeof value === 'object');
  return (
    <Field label={label} required={spec.required} stacked={stacked && !inline} title={help}>
      <ScalarField spec={spec} value={value} onChange={onChange} ctx={ctx} />
    </Field>
  );
}

function ScalarField({ spec, value, onChange, ctx }) {
  const t = spec.type;
  switch (t) {
    case 'string': return <TextInput value={value} placeholder={spec.default ?? ''} onChange={(v) => onChange(v === '' ? null : v)} onCommit={(v) => onChange(v === '' ? null : v, { commit: true })} />;
    case 'richtext': return <RichText value={value} onChange={onChange} />;
    case 'number': case 'integer': {
      const unit = /秒/.test(spec.desc || '') ? 's' : /0–1|0-1/.test(spec.desc || '') ? '' : undefined;
      const step = t === 'integer' ? 1 : /0–1|0-1/.test(spec.desc || '') ? 0.05 : Math.abs(value) < 5 ? 0.1 : 1;
      return <NumberInput value={value} step={step} unit={unit} placeholder={spec.default != null ? String(spec.default) : '自动'} onChange={(v) => onChange(v)} onCommit={(v) => onChange(v, { commit: true })} />;
    }
    case 'boolean': return <div style={{ paddingTop: 5 }}><Switch value={value ?? spec.default ?? false} onChange={(v) => onChange(v, { commit: true })} /></div>;
    case 'enum': {
      const vals = spec.values;
      const cur = value ?? spec.default;
      const short = vals.length <= 4 && vals.every((v) => valueLabel(v).length <= 4);
      return short
        ? <Segmented value={cur} options={vals.map((v) => ({ value: v, label: valueLabel(v), title: String(v) }))} onChange={(v) => onChange(v === spec.default ? null : v, { commit: true })} />
        : <Select value={cur} options={vals.map((v) => ({ value: v, label: `${valueLabel(v)}${valueLabel(v) !== String(v) ? `  ·  ${v}` : ''}` }))} onChange={(v) => onChange(v === spec.default ? null : v, { commit: true })} />;
    }
    case 'color': return <ColorField value={value} onChange={onChange} />;
    case 'icon': return <IconField value={value} onChange={onChange} />;
    case 'asset': return <AssetField value={value} onChange={onChange} kind={/视频/.test(spec.desc) ? 'video' : /模型|3D/.test(spec.desc) ? 'model' : /音/.test(spec.desc) ? 'audio' : 'image'} />;
    case 'expr': return <ExprField value={value} onChange={onChange} />;
    case 'latex': return <TextArea mono rows={2} value={value} onChange={(v) => onChange(v)} onCommit={(v) => onChange(v, { commit: true })} placeholder="LaTeX，如 \frac{a}{b}" />;
    case 'range': return <RangeField value={value} onChange={onChange} />;
    case 'array': return <SimpleList value={value} itemSpec={spec.item} onChange={onChange} />;
    case 'any': default: return <AnyField value={value} onChange={onChange} />;
  }
}

// ───────────────────────────── specialised editors ─────────────────────────────
function RichText({ value, onChange }) {
  const ref = useRef(null);
  const wrap = (a, b = a) => {
    const el = ref.current; if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const v = el.value;
    const next = v.slice(0, s) + a + v.slice(s, e) + b + v.slice(e);
    onChange(next, { commit: true });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + a.length, e + a.length); });
  };
  return (
    <div>
      <TextArea inputRef={ref} rows={2} value={value} onChange={(v) => onChange(v === '' ? null : v)} onCommit={(v) => onChange(v === '' ? null : v, { commit: true })} />
      <div className="row" style={{ gap: 2, marginTop: 3 }}>
        <button className="ibtn sm" title="加粗 **…**" onClick={() => wrap('**')}><Icon name="bold" size={13} /></button>
        <button className="ibtn sm" title="强调色 ==…==" onClick={() => wrap('==')}><Icon name="highlighter" size={13} /></button>
        <button className="ibtn sm" title="斜体 *…*" onClick={() => wrap('*')}><Icon name="italic" size={13} /></button>
        <button className="ibtn sm" title="代码 `…`" onClick={() => wrap('`')}><Icon name="code" size={13} /></button>
        <span className="dim" style={{ fontSize: 11, marginLeft: 4 }}>**加粗** ==强调== *斜体*</span>
      </div>
    </div>
  );
}

const THEME_COLORS = [['accent', '强调'], ['accent2', '辅助'], ['ink', '正文'], ['muted', '次要'], ['positive', '正向'], ['negative', '负向'], ['warning', '警示']];
export function ColorField({ value, onChange }) {
  const pal = editor.engine?.C?.env?.palette?.('base');
  const sw = (name) => { const c = pal?.[name]; return c ? (typeof c === 'string' ? c : `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`) : '#888'; };
  const isHex = typeof value === 'string' && value.startsWith('#');
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="row" style={{ gap: 6 }}>
        <span className={`swatch ${!value ? 'checker' : ''}`} style={{ background: value ? (isHex ? value : sw(value)) : undefined }}>
          <input type="color" value={isHex ? value.slice(0, 7) : '#888888'} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(e.target.value, { commit: true })} />
        </span>
        <TextInput value={value} placeholder="主题自动" mono onCommit={(v) => onChange(v || null, { commit: true })} />
        {value ? <button className="ibtn sm" title="清除" onClick={() => onChange(null, { commit: true })}><Icon name="x" size={13} /></button> : null}
      </div>
      <div className="chip-row">
        {THEME_COLORS.map(([k, l]) => <button key={k} className={`chip ${value === k ? 'on' : ''}`} onClick={() => onChange(k, { commit: true })}><span className="sw" style={{ background: sw(k) }} />{l}</button>)}
      </div>
    </div>
  );
}

export function IconField({ value, onChange }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn" style={{ flex: 1, justifyContent: 'flex-start' }} onClick={(e) => setAnchor(e.currentTarget)}>
          {value ? <Icon name={value} size={15} /> : <Icon name="shapes" size={15} style={{ opacity: 0.4 }} />}
          <span className="ellipsis">{value || '选择图标'}</span>
        </button>
        {value ? <button className="ibtn sm" onClick={() => onChange(null, { commit: true })} title="清除"><Icon name="x" size={13} /></button> : null}
      </div>
      {anchor ? <IconPicker anchor={anchor} value={value} onPick={(n) => { onChange(n, { commit: true }); setAnchor(null); }} onClose={() => setAnchor(null)} /> : null}
    </>
  );
}

const ICON_ZH = { 火箭: 'rocket', 用户: 'user', 团队: 'users', 安全: 'shield', 增长: 'trending-up', 全球: 'globe', 芯片: 'cpu', 环保: 'leaf', 钱: 'banknote', 数据: 'database', 云: 'cloud', 时间: 'clock', 目标: 'target', 灯泡: 'lightbulb', 想法: 'lightbulb', 闪电: 'zap', 心: 'heart', 星: 'star', 图表: 'chart', 消息: 'message', 邮件: 'mail', 电话: 'phone', 地图: 'map', 位置: 'map-pin', 设置: 'settings', 搜索: 'search', 锁: 'lock', 钥匙: 'key', 书: 'book', 学习: 'graduation-cap', 医疗: 'stethoscope', 健康: 'heart-pulse', 车: 'car', 自行车: 'bike', 飞机: 'plane', 房子: 'house', 工厂: 'factory', 代码: 'code', 机器人: 'bot', 奖杯: 'trophy', 礼物: 'gift', 购物: 'shopping-cart', 音乐: 'music', 相机: 'camera', 视频: 'video', 文件: 'file', 日历: 'calendar', 天气: 'sun', 水: 'droplet', 火: 'flame', 树: 'tree', 动物: 'paw-print' };
function IconPicker({ anchor, value, onPick, onClose }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return ['sparkles', 'rocket', 'zap', 'target', 'trending-up', 'users', 'shield-check', 'globe', 'cpu', 'cloud', 'database', 'lightbulb', 'leaf', 'heart', 'star', 'trophy', 'clock', 'calendar', 'chart-column', 'chart-pie', 'banknote', 'wallet', 'shopping-cart', 'message-circle', 'mail', 'phone', 'map-pin', 'house', 'building-2', 'factory', 'graduation-cap', 'book-open', 'code', 'bot', 'brain', 'wand-sparkles', 'layers', 'workflow', 'puzzle', 'handshake', 'award', 'flag', 'compass', 'camera', 'music', 'video', 'image', 'file-text', 'settings', 'lock', 'key-round', 'wifi', 'smartphone', 'laptop', 'monitor', 'truck', 'plane', 'bike', 'car', 'sun', 'moon', 'droplet', 'flame', 'tree-pine', 'flower-2', 'paw-print', 'stethoscope', 'heart-pulse', 'atom', 'sigma', 'infinity', 'check', 'x', 'plus', 'arrow-right', 'circle-check', 'circle-alert'].filter((n) => ICON_NAMES.includes(n));
    const zh = Object.entries(ICON_ZH).filter(([k]) => k.includes(qq) || qq.includes(k)).map(([, v]) => v);
    const terms = [qq, ...zh];
    return ICON_NAMES.filter((n) => terms.some((t) => n.includes(t))).slice(0, 240);
  }, [q]);
  return (
    <Popover anchor={anchor} onClose={onClose} placement="left-start">
      <div style={{ width: 320, padding: 10 }}>
        <input autoFocus className="input" placeholder={`搜索 ${ICON_NAMES.length} 个图标（中英文）`} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        <div className="icon-grid">
          {list.map((n) => <button key={n} className={value === n ? 'on' : ''} title={n} onClick={() => onPick(n)}><Icon name={n} size={18} /></button>)}
        </div>
        {!list.length ? <div className="empty" style={{ padding: 16 }}>没有匹配的图标</div> : null}
      </div>
    </Popover>
  );
}

function AssetField({ value, onChange, kind }) {
  const doc = editor.s.doc;
  const [anchor, setAnchor] = useState(null);
  const a = value ? doc?.assets?.[value] : null;
  return (
    <>
      <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', height: a && a.kind === 'image' ? 52 : 30, padding: a?.kind === 'image' ? 4 : undefined }} onClick={(e) => setAnchor(e.currentTarget)}>
        {a?.kind === 'image' ? <img src={editor.project.assetBase + a.file} style={{ width: 60, height: 42, objectFit: 'cover', borderRadius: 4 }} /> : <Icon name={kind === 'video' ? 'clapperboard' : kind === 'model' ? 'boxes' : kind === 'audio' ? 'music' : 'image'} size={15} />}
        <span className="ellipsis">{a ? a.name : value ? `缺失：${value}` : '选择资源…'}</span>
      </button>
      {anchor ? <AssetPicker anchor={anchor} kind={kind} value={value} onPick={(id) => { onChange(id, { commit: true }); setAnchor(null); }} onClose={() => setAnchor(null)} /> : null}
    </>
  );
}

export function AssetPicker({ anchor, kind, value, onPick, onClose }) {
  const doc = editor.s.doc;
  const list = Object.values(doc.assets || {}).filter((a) => !kind || a.kind === kind);
  const importNew = async () => {
    try {
      const r = await call('assets.import', editor.project.id);
      if (!r.assets.length) return;
      editor.setDoc(r.doc); editor.set({ rev: r.doc.meta?.revision });
      const hit = r.assets.find((a) => !kind || a.kind === kind);
      if (hit) onPick(hit.id);
    } catch (e) { toast.error(e); }
  };
  return (
    <Popover anchor={anchor} onClose={onClose} placement="left-start">
      <div style={{ width: 300, padding: 10 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <b style={{ color: 'var(--fg0)' }} className="grow">项目资源</b>
          <button className="btn sm" onClick={importNew}><Icon name="upload" size={13} />导入…</button>
        </div>
        {list.length ? (
          <div className="assets-grid" style={{ padding: 0, maxHeight: 300 }}>
            {list.map((a) => (
              <div key={a.id} className={`asset pick ${value === a.id ? 'on' : ''}`} onClick={() => onPick(a.id)}>
                <div className="pv">{a.kind === 'image' ? <img src={editor.project.assetBase + a.file} /> : <Icon name={a.kind === 'video' ? 'clapperboard' : a.kind === 'audio' ? 'music' : 'file'} size={22} />}</div>
                <div className="nm">{a.name}</div>
              </div>
            ))}
          </div>
        ) : <div className="empty" style={{ padding: 18 }}>还没有{kind === 'video' ? '视频' : kind === 'audio' ? '音频' : kind === 'model' ? '3D 模型' : '图片'}资源</div>}
      </div>
    </Popover>
  );
}

function ExprField({ value, onChange }) {
  const [err, setErr] = useState(null);
  return (
    <div>
      <TextInput mono value={value} invalid={!!err} placeholder="如 sin(x) * exp(-x/4)" onChange={(v) => { const e = v ? checkExpr(v) : null; setErr(e?.error || e?.message || (typeof e === 'string' ? e : null)); if (!e) onChange(v || null); }} onCommit={(v) => { if (!err) onChange(v || null, { commit: true }); }} />
      {err ? <div className="help" style={{ color: 'var(--err)' }}>{err}</div> : null}
    </div>
  );
}

function RangeField({ value, onChange }) {
  const v = Array.isArray(value) ? value : [];
  return (
    <div className="row" style={{ gap: 6 }}>
      <NumberInput value={v[0]} step={0.1} placeholder="自动" onCommit={(n) => onChange([n, v[1] ?? null], { commit: true })} />
      <span className="dim">→</span>
      <NumberInput value={v[1]} step={0.1} placeholder="自动" onCommit={(n) => onChange([v[0] ?? null, n], { commit: true })} />
    </div>
  );
}

function AnyField({ value, onChange }) {
  if (value != null && typeof value === 'object') return <JsonField value={value} onChange={onChange} />;
  return <TextInput value={value == null ? '' : String(value)} placeholder="自动" onChange={(v) => onChange(parseLoose(v))} onCommit={(v) => onChange(parseLoose(v), { commit: true })} />;
}
const parseLoose = (v) => (v === '' ? null : /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v);

export function JsonField({ value, onChange, rows = 4 }) {
  const [err, setErr] = useState(null);
  return (
    <div>
      <TextArea mono rows={rows} value={JSON.stringify(value, null, 1)} onCommit={(v) => { try { const j = v.trim() ? JSON.parse(v) : null; setErr(null); onChange(j, { commit: true }); } catch (e) { setErr(e.message); } }} />
      {err ? <div className="help" style={{ color: 'var(--err)' }}>JSON 无效：{err}</div> : null}
    </div>
  );
}

function SimpleList({ value, itemSpec, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const t = itemSpec?.type;
  const set = (i, v, o) => { const n = list.slice(); n[i] = v; onChange(n, o); };
  if (t === 'number' || t === 'integer') {
    return <TextInput mono value={list.join(', ')} placeholder="逗号分隔数字" onCommit={(v) => onChange(v.trim() ? v.split(/[,，\s]+/).filter(Boolean).map(Number).filter((n) => isFinite(n)) : null, { commit: true })} />;
  }
  return (
    <div className="list-ed">
      {list.map((it, i) => (
        <div key={i} className="list-simple">
          <div className="grow">
            {t === 'color' ? <ColorField value={it} onChange={(v, o) => set(i, v, o)} />
              : t === 'icon' ? <IconField value={it} onChange={(v, o) => set(i, v, o)} />
                : t === 'any' && it && typeof it === 'object' ? <JsonField value={it} rows={2} onChange={(v, o) => set(i, v, o)} />
                  : <TextInput mono={t === 'latex'} value={typeof it === 'object' ? JSON.stringify(it) : it} onChange={(v) => set(i, t === 'any' ? parseLoose(v) : v)} onCommit={(v) => set(i, t === 'any' ? parseLoose(v) : v, { commit: true })} />}
          </div>
          <button className="ibtn sm" title="上移" disabled={i === 0} onClick={() => { const n = list.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n, { commit: true }); }}><Icon name="arrow-up" size={12} /></button>
          <button className="ibtn sm" title="删除" onClick={() => onChange(list.filter((_, j) => j !== i), { commit: true })}><Icon name="x" size={12} /></button>
        </div>
      ))}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...list, t === 'number' ? 0 : ''], { commit: true })}><Icon name="plus" size={12} />添加</button>
    </div>
  );
}

function itemTitle(it, fields) {
  if (it == null) return '';
  if (typeof it !== 'object') return String(it);
  for (const k of ['title', 'text', 'label', 'name', 'date', 'value', 'expr', 'id']) if (it[k] != null && it[k] !== '') return String(it[k]).replace(/\*\*|==/g, '');
  const k = Object.keys(fields || {})[0];
  return k && it[k] != null ? String(it[k]) : '';
}

function ListEditor({ value, itemSpec, onChange, ctx }) {
  const list = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(() => (list.length <= 3 ? new Set(list.map((_, i) => i)) : new Set([0])));
  const fields = itemSpec.fields || {};
  const set = (i, patch, o) => { const n = list.map((x) => (typeof x === 'object' && x ? { ...x } : { text: x })); n[i] = { ...n[i], ...patch }; for (const k of Object.keys(patch)) if (patch[k] == null) delete n[i][k]; onChange(n, o); };
  const move = (i, d) => { const n = list.slice(); const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n, { commit: true }); };
  const blank = () => { const k = Object.keys(fields)[0]; return k ? { [k]: '' } : {}; };
  return (
    <div className="list-ed">
      {list.map((it, i) => {
        const isOpen = open.has(i);
        return (
          <div key={i} className="list-item">
            <div className="li-head" onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}>
              <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={13} />
              <span className="dim" style={{ width: 16 }}>{i + 1}</span>
              <span className="ttl">{itemTitle(it, fields) || '（空）'}</span>
              <button className="ibtn sm" title="上移" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }}><Icon name="arrow-up" size={12} /></button>
              <button className="ibtn sm" title="下移" disabled={i === list.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }}><Icon name="arrow-down" size={12} /></button>
              <button className="ibtn sm" title="复制" onClick={(e) => { e.stopPropagation(); const n = list.slice(); n.splice(i + 1, 0, JSON.parse(JSON.stringify(it))); onChange(n, { commit: true }); }}><Icon name="copy" size={12} /></button>
              <button className="ibtn sm" title="删除" onClick={(e) => { e.stopPropagation(); onChange(list.filter((_, j) => j !== i), { commit: true }); }}><Icon name="x" size={12} /></button>
            </div>
            {isOpen ? (
              <div className="li-body">
                {Object.entries(fields).map(([k, sp]) => (
                  <ParamField key={k} name={k} spec={sp} value={typeof it === 'object' ? it?.[k] : k === Object.keys(fields)[0] ? it : undefined} ctx={ctx}
                    onChange={(v, o) => set(i, { [k]: o?.merge ? { ...(it?.[k] || {}), ...v } : v }, o)} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { onChange([...list, blank()], { commit: true }); setOpen((s) => new Set([...s, list.length])); }}><Icon name="plus" size={12} />添加一项</button>
    </div>
  );
}

/** 2-D grid (table rows, matrices). Pasting tab/comma separated text fills the grid. */
function GridEditor({ value, onChange, numeric }) {
  const rows = Array.isArray(value) && value.length ? value.map((r) => (Array.isArray(r) ? r : [r])) : [['', ''], ['', '']];
  const ncol = Math.max(1, ...rows.map((r) => r.length));
  const conv = (v) => (numeric || /^-?\d+(\.\d+)?$/.test(String(v).trim()) ? (String(v).trim() === '' ? '' : Number(v)) : v);
  const setCell = (i, j, v, commit) => { const n = rows.map((r) => { const c = r.slice(); while (c.length < ncol) c.push(''); return c; }); n[i][j] = conv(v); onChange(n, { commit }); };
  const onPaste = (e, i0, j0) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const grid = text.replace(/\r/g, '').split('\n').filter((l) => l.length).map((l) => l.split('\t'));
    const n = rows.map((r) => r.slice());
    grid.forEach((r, di) => r.forEach((v, dj) => { const i = i0 + di, j = j0 + dj; while (n.length <= i) n.push(new Array(ncol).fill('')); while (n[i].length <= j) n[i].push(''); n[i][j] = conv(v); }));
    onChange(n, { commit: true });
  };
  return (
    <div>
      <div className="grid-ed">
        <table><tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {Array.from({ length: ncol }, (_, j) => (
                <td key={j}><GridCell value={r[j] ?? ''} onChange={(v) => setCell(i, j, v, false)} onCommit={(v) => setCell(i, j, v, true)} onPaste={(e) => onPaste(e, i, j)} /></td>
              ))}
              <td className="rm"><button className="ibtn sm" onClick={() => onChange(rows.filter((_, k) => k !== i), { commit: true })}><Icon name="x" size={11} /></button></td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <div className="row" style={{ gap: 4, marginTop: 5 }}>
        <button className="btn sm" onClick={() => onChange([...rows, new Array(ncol).fill(numeric ? 0 : '')], { commit: true })}><Icon name="plus" size={12} />行</button>
        <button className="btn sm" onClick={() => onChange(rows.map((r) => [...r, numeric ? 0 : '']), { commit: true })}><Icon name="plus" size={12} />列</button>
        <button className="btn sm" disabled={ncol <= 1} onClick={() => onChange(rows.map((r) => r.slice(0, ncol - 1)), { commit: true })}><Icon name="x" size={12} />列</button>
        <span className="dim" style={{ fontSize: 11 }}>可从 Excel 直接粘贴</span>
      </div>
    </div>
  );
}

function GridCell({ value, onChange, onCommit, onPaste, header }) {
  const [v, setV] = useState(String(value ?? ''));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(String(value ?? '')); }, [value]);
  return <input value={v} style={header ? { fontWeight: 600 } : null} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; onCommit(v); }} onPaste={onPaste} onChange={(e) => { setV(e.target.value); onChange(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

/** Chart data as a spreadsheet: first column = categories, header row = series names. */
function DataEditor({ value, onChange }) {
  const d = useMemo(() => normalizeChartData(value), [value]);
  const hasPoints = d.series.some((s) => s.points?.length);
  const [mode, setMode] = useState(hasPoints ? 'json' : 'grid');
  if (mode === 'json') {
    return (
      <div>
        <JsonField value={value} rows={6} onChange={onChange} />
        {!hasPoints ? <button className="btn sm" style={{ marginTop: 4 }} onClick={() => setMode('grid')}>表格编辑</button> : null}
      </div>
    );
  }
  const header = ['类别', ...d.series.map((s) => s.name || '数值')];
  const rows = d.labels.map((l, i) => [l, ...d.series.map((s) => s.values[i] ?? '')]);
  const toData = (hdr, body) => ({
    labels: body.map((r) => String(r[0] ?? '')),
    series: hdr.slice(1).map((name, j) => ({ name: name === '数值' && hdr.length === 2 ? '' : String(name), values: body.map((r) => { const v = r[j + 1]; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,，%]/g, '')); return isFinite(n) ? n : null; }), ...(d.series[j]?.color ? { color: d.series[j].color } : {}) })),
    ...(d.colors ? { colors: d.colors } : {}),
  });
  const commit = (hdr, body, c) => onChange(toData(hdr, body), { commit: c });
  const onPaste = (e, i0, j0) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const grid = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length).map((l) => l.split('\t'));
    // pasting a full table with a header row at the top-left replaces everything
    if (i0 === -1 && j0 === 0) { onChange(normalizeChartData(grid), { commit: true }); return; }
    const hdr = header.slice(); const body = rows.map((r) => r.slice());
    grid.forEach((r, di) => r.forEach((v, dj) => { const i = i0 + di, j = j0 + dj; if (i < 0) { hdr[j] = v; return; } while (body.length <= i) body.push(new Array(hdr.length).fill('')); while (hdr.length <= j) { hdr.push(`系列 ${hdr.length}`); body.forEach((b) => b.push('')); } body[i][j] = v; }));
    commit(hdr, body, true);
  };
  return (
    <div>
      <div className="grid-ed">
        <table>
          <thead><tr>
            {header.map((h, j) => <th key={j}><GridCell header value={h} onPaste={(e) => onPaste(e, -1, j)} onChange={() => {}} onCommit={(v) => { const hdr = header.slice(); hdr[j] = v; commit(hdr, rows, true); }} /></th>)}
            <th className="rm" />
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => <td key={j}><GridCell value={c} onPaste={(e) => onPaste(e, i, j)} onChange={(v) => { const b = rows.map((x) => x.slice()); b[i][j] = v; commit(header, b, false); }} onCommit={(v) => { const b = rows.map((x) => x.slice()); b[i][j] = v; commit(header, b, true); }} /></td>)}
                <td className="rm"><button className="ibtn sm" title="删除行" onClick={() => commit(header, rows.filter((_, k) => k !== i), true)}><Icon name="x" size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => commit(header, [...rows, [`类别 ${rows.length + 1}`, ...d.series.map(() => 0)]], true)}><Icon name="plus" size={12} />类别</button>
        <button className="btn sm" onClick={() => commit([...header, `系列 ${header.length}`], rows.map((r) => [...r, 0]), true)}><Icon name="plus" size={12} />系列</button>
        <button className="btn sm" disabled={header.length <= 2} onClick={() => commit(header.slice(0, -1), rows.map((r) => r.slice(0, -1)), true)}><Icon name="x" size={12} />系列</button>
        <button className="btn sm ghost" onClick={() => setMode('json')}>JSON</button>
        <span className="dim" style={{ fontSize: 11 }}>可从 Excel 粘贴整张表</span>
      </div>
    </div>
  );
}
