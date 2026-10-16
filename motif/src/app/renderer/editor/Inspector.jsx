// Right-hand inspector: block / scene / project properties, plus the AI assistant tab.
import { useEffect, useState } from 'react';
import { editor, useEditor, findBlock } from './store.js';
import { Icon, TYPE_ICON } from '../icons.jsx';
import { Field, Group, NumberInput, Segmented, Select, Switch, TextArea, TextInput, openMenu, toast, Spinner } from '../ui.jsx';
import { COMPONENTS } from '../../../core/catalog/components.js';
import { COMMON_BLOCK_PARAMS } from '../../../core/catalog/spec.js';
import { LAYOUTS, TRANSITIONS, BACKGROUNDS, MOTIONS, CAMERAS, TONES, FORMATS } from '../../../core/catalog/scene.js';
import { THEMES } from '../../../core/themes/index.js';
import { ParamField, ColorField, labelFor } from './fields.jsx';
import { blockMenu } from './menus.js';
import { AIPanel } from './AIPanel.jsx';
import { GuideEditor } from './GuideEditor.jsx';
import { call } from '../api.js';

export function Inspector({ tab, setTab, onOpenThemes, onOpenPalette }) {
  const sel = useEditor((s) => s.sel);
  useEffect(() => { if (sel.block && tab !== 'ai') setTab('block'); }, [sel.block]);
  useEffect(() => { if (!sel.block && tab === 'block') setTab('scene'); }, [sel.block, sel.scene]);
  return (
    <>
      <div className="tabs">
        <button className={tab === 'block' ? 'on' : ''} disabled={!sel.block} style={!sel.block ? { opacity: 0.4 } : null} onClick={() => setTab('block')}>元素</button>
        <button className={tab === 'scene' ? 'on' : ''} onClick={() => setTab('scene')}>场景</button>
        <button className={tab === 'project' ? 'on' : ''} onClick={() => setTab('project')}>作品</button>
        <div className="spacer" />
        <button className={`ai-tab ${tab === 'ai' ? 'on' : ''}`} onClick={() => setTab('ai')}><span className="ai-orb" style={{ width: 14, height: 14 }} />AI 助手</button>
      </div>
      {tab === 'ai' ? <AIPanel /> : (
        <div className="insp">
          {tab === 'block' && sel.block ? <BlockInspector id={sel.block} /> : null}
          {tab === 'scene' ? <SceneInspector id={sel.scene} onOpenPalette={onOpenPalette} /> : null}
          {tab === 'project' ? <ProjectInspector onOpenThemes={onOpenThemes} /> : null}
        </div>
      )}
    </>
  );
}

// ───────────────────────────── block ─────────────────────────────
function BlockInspector({ id }) {
  const doc = useEditor((s) => s.doc);
  const fb = findBlock(doc, id);
  const [focusKey, setFocusKey] = useState(0);
  useEffect(() => {
    const f = () => setFocusKey((k) => k + 1);
    addEventListener('motif:focus-inspector', f);
    return () => removeEventListener('motif:focus-inspector', f);
  }, []);
  useEffect(() => { if (focusKey) document.querySelector('.insp .input, .insp textarea')?.focus(); }, [focusKey]);
  if (!fb) return null;
  const { block: b, scene: s } = fb;
  const spec = COMPONENTS[b.type];
  const upd = (key) => (v, o = {}) => editor.updateBlock(id, { [key]: v === undefined ? null : v }, { message: `修改${labelFor(key, spec?.params?.[key])}`, coalesce: o.commit ? null : `blk:${id}:${key}` });
  const updMerge = (key) => (v, o = {}) => editor.updateBlock(id, { [key]: v }, { message: `修改${labelFor(key)}`, coalesce: o.commit ? null : `blk:${id}:${key}` });
  return (
    <>
      <div className="insp-head">
        <span className="t-ico"><Icon name={TYPE_ICON[b.type] || 'square'} size={16} /></span>
        <div className="grow">
          <div className="t-name">{spec?.label || b.type}</div>
          <div className="t-sub mono">{b.id} · 场景 {doc.scenes.indexOf(s) + 1}</div>
        </div>
        <button className="ibtn" title="复制" onClick={() => editor.duplicateBlock(id)}><Icon name="copy" size={15} /></button>
        <button className="ibtn" title="删除" onClick={() => editor.removeBlock(id)}><Icon name="trash" size={15} /></button>
        <button className="ibtn" title="更多" onClick={(e) => openMenu(e, blockMenu(id))}><Icon name="ellipsis" size={15} /></button>
      </div>
      {spec?.summary ? <div style={{ padding: '0 14px 10px', color: 'var(--fg2)', fontSize: 12 }}>{spec.summary}</div> : null}
      <div className="section">
        <h4>内容</h4>
        {Object.entries(spec?.params || {}).map(([k, sp]) => (
          <ParamField key={`${id}:${k}`} name={k} spec={sp} value={b[k]} onChange={(v, o) => (o?.merge ? updMerge(k)(v, o) : upd(k)(v, o))} ctx={{ block: b }} />
        ))}
      </div>
      <div className="section">
        <h4>动画</h4>
        <MotionEditor b={b} />
      </div>
      <div className="section">
        <h4>样式</h4>
        <Field label="颜色"><ColorField value={b.style?.color} onChange={(v, o) => editor.updateBlock(id, { style: { color: v ?? null } }, { message: '修改颜色', coalesce: o?.commit ? null : `blk:${id}:style.color` })} /></Field>
        <Field label="缩放"><NumberInput value={b.style?.scale} step={0.05} min={0.3} max={3} placeholder="1" onCommit={(v) => editor.updateBlock(id, { style: { scale: v } }, { message: '缩放' })} /></Field>
        <Field label="对齐"><Segmented value={b.style?.align || 'auto'} options={[{ value: 'auto', label: '自动' }, { value: 'left', icon: 'text-align-start', title: '左' }, { value: 'center', icon: 'text-align-center', title: '中' }, { value: 'right', icon: 'text-align-end', title: '右' }]} onChange={(v) => editor.updateBlock(id, { style: { align: v === 'auto' ? null : v } }, { message: '对齐' })} /></Field>
        <Field label="卡片"><Segmented value={b.style?.card || 'auto'} options={[{ value: 'auto', label: '自动' }, { value: 'none', label: '无' }, { value: 'card', label: '卡片' }]} onChange={(v) => editor.updateBlock(id, { style: { card: v === 'auto' ? null : v } }, { message: '卡片' })} /></Field>
      </div>
      <div className="section">
        <h4>位置与布局</h4>
        <Field label="区域" help="自动布局时放在哪个区域"><Select value={b.slot || 'auto'} options={COMMON_BLOCK_PARAMS.slot.values.map((v) => ({ value: v, label: { auto: '自动', main: '主区（文字）', media: '视觉区', aside: '侧栏', header: '页眉', footer: '页脚' }[v] }))} onChange={(v) => editor.updateBlock(id, { slot: v === 'auto' ? null : v }, { message: '区域' })} /></Field>
        {b.frame && typeof b.frame === 'object' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '4px 0' }}>
              {['x', 'y', 'w', 'h'].map((k) => (
                <div key={k} className="row" style={{ gap: 4 }}><span className="dim" style={{ width: 12 }}>{k.toUpperCase()}</span>
                  <NumberInput value={Math.round((b.frame[k] ?? 0) * (k === 'x' || k === 'w' ? doc.format.width : doc.format.height))} step={1} unit="px"
                    onCommit={(v) => editor.updateBlock(id, { frame: { [k]: +((v ?? 0) / (k === 'x' || k === 'w' ? doc.format.width : doc.format.height)).toFixed(4) } }, { message: '位置' })} />
                </div>
              ))}
            </div>
            <button className="btn sm" onClick={() => editor.updateBlock(id, { frame: null }, { message: '恢复自动布局' })}><Icon name="layout-grid" size={13} />恢复自动布局</button>
          </>
        ) : <div className="dim" style={{ fontSize: 11.5, padding: '2px 0 4px' }}>由版式自动排布。在画布上拖动即可改为手动定位。</div>}
        <Field label="变形键" help="相邻场景 key 相同的元素在 morph 转场中平滑过渡"><TextInput value={b.key} placeholder="（可选）" onCommit={(v) => editor.updateBlock(id, { key: v || null }, { message: '变形键' })} /></Field>
        <Field label="隐藏"><div style={{ paddingTop: 5 }}><Switch value={!!b.hidden} onChange={(v) => editor.updateBlock(id, { hidden: v || null }, { message: v ? '隐藏' : '显示' })} /></div></Field>
        <Field label="锁定"><div style={{ paddingTop: 5 }}><Switch value={!!b.locked} onChange={(v) => editor.updateBlock(id, { locked: v || null }, { message: v ? '锁定' : '解锁' })} /></div></Field>
      </div>
    </>
  );
}

const MOTION_GROUPS = [
  ['推荐', ['auto', 'rise-blur', 'mask-up', 'focus', 'pop', 'slam', 'write']],
  ['基础', ['none', 'fade', 'rise', 'drop', 'slide-left', 'slide-right', 'scale', 'blur']],
  ['揭示', ['mask-left', 'wipe', 'type', 'ink', 'brush', 'draw', 'pop-soft']],
];
function MotionEditor({ b }) {
  const m = b.motion || {};
  const set = (patch, msg = '修改动画') => editor.updateBlock(b.id, { motion: patch }, { message: msg });
  return (
    <>
      <Field label="入场">
        <select className="select" value={m.enter || 'auto'} onChange={(e) => set({ enter: e.target.value === 'auto' ? null : e.target.value }, '入场动画')}>
          {MOTION_GROUPS.map(([g, list]) => <optgroup key={g} label={g}>{list.filter((k) => MOTIONS[k]).map((k) => <option key={k} value={k}>{MOTIONS[k]}</option>)}</optgroup>)}
        </select>
      </Field>
      <Field label="延迟" help="相对自动编排的偏移（秒）"><NumberInput value={m.delay} step={0.05} unit="s" placeholder="0" onCommit={(v) => set({ delay: v || null }, '动画延迟')} /></Field>
      <Field label="速度"><NumberInput value={m.speed} step={0.1} min={0.2} max={4} placeholder="1" onCommit={(v) => set({ speed: v }, '动画速度')} /></Field>
      <Field label="强调"><Select value={m.emphasis || 'none'} options={[['none', '无'], ['pulse', '脉冲'], ['glow', '辉光'], ['shake', '抖动'], ['float', '漂浮']].map(([value, label]) => ({ value, label }))} onChange={(v) => set({ emphasis: v === 'none' ? null : v }, '强调动画')} /></Field>
      <Field label="退场"><Segmented value={m.exit || 'auto'} options={[{ value: 'auto', label: '自动' }, { value: 'none', label: '无' }, { value: 'fade', label: '淡出' }, { value: 'reverse', label: '倒放' }]} onChange={(v) => set({ exit: v === 'auto' ? null : v }, '退场')} /></Field>
      {m.at != null ? <Field label="绝对时间"><div className="row"><NumberInput value={m.at} step={0.1} unit="s" onCommit={(v) => set({ at: v })} /><button className="ibtn sm" title="恢复自动编排" onClick={() => set({ at: null })}><Icon name="x" size={12} /></button></div></Field> : null}
    </>
  );
}

// ───────────────────────────── scene ─────────────────────────────
const LAYOUT_ICON = { auto: 'wand-sparkles', cover: 'presentation', section: 'bookmark', split: 'columns-2', focus: 'scan', stack: 'rows-3', grid: 'layout-grid', full: 'maximize', quote: 'quote', closing: 'flag', free: 'move' };
function SceneInspector({ id, onOpenPalette }) {
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.sel);
  const timing = useEditor((s) => s.timing);
  const s = doc?.scenes.find((x) => x.id === id);
  if (!s) return <div className="empty"><div>没有选中场景</div></div>;
  const i = doc.scenes.indexOf(s);
  const t = timing.scenes.find((x) => x.id === id);
  const up = (set, msg) => editor.updateScene(id, set, { message: msg, coalesce: null });
  const tr = s.transition === 'auto' ? { type: 'auto' } : s.transition || { type: 'auto' };
  const bg = s.background === 'auto' ? { type: 'auto' } : s.background || { type: 'auto' };
  const cam = s.camera === 'auto' ? { type: 'auto' } : s.camera || { type: 'auto' };
  return (
    <>
      <div className="insp-head">
        <span className="t-ico"><Icon name={LAYOUT_ICON[s.layout] || 'square'} size={16} /></span>
        <div className="grow">
          <TextInput value={s.name} placeholder={`场景 ${i + 1}`} onCommit={(v) => up({ name: v || null }, '场景名称')} style={{ fontWeight: 600 }} />
          <div className="t-sub" style={{ marginTop: 3 }}>{t ? `${t.start.toFixed(1)}s 开始 · 时长 ${t.duration.toFixed(1)}s · 版式 ${LAYOUTS[t.layout]?.label || t.layout}` : ''}</div>
        </div>
      </div>
      <div className="section">
        <h4>版式</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {Object.entries(LAYOUTS).map(([k, l]) => (
            <button key={k} className={`chip ${s.layout === k ? 'on' : ''}`} style={{ height: 46, flexDirection: 'column', justifyContent: 'center', borderRadius: 8, gap: 3 }} title={l.description} onClick={() => up({ layout: k }, '版式')}>
              <Icon name={LAYOUT_ICON[k]} size={15} /><span style={{ fontSize: 11 }}>{l.label}</span>
            </button>
          ))}
        </div>
        {(s.layout === 'split' || t?.layout === 'split') ? <Field label="左右互换"><div style={{ paddingTop: 5 }}><Switch value={!!s.variant?.flip} onChange={(v) => up({ variant: { flip: v || null } }, '左右互换')} /></div></Field> : null}
        <Field label="色调"><Segmented value={s.tone || 'auto'} options={Object.entries(TONES).map(([k, v]) => ({ value: k, label: v.split(/[（(]/)[0].replace('主题', '').replace('色场', '').slice(0, 3), title: v }))} onChange={(v) => up({ tone: v }, '色调')} /></Field>
      </div>
      <div className="section">
        <h4>时间</h4>
        <Field label="时长">
          <div className="row" style={{ gap: 6 }}>
            <Segmented value={typeof s.duration === 'number' ? 'fixed' : 'auto'} options={[{ value: 'auto', label: '自动' }, { value: 'fixed', label: '固定' }]} onChange={(v) => up({ duration: v === 'auto' ? 'auto' : +(t?.duration || 5).toFixed(1) }, '时长')} />
            {typeof s.duration === 'number' ? <NumberInput value={s.duration} step={0.1} min={1} unit="s" onCommit={(v) => up({ duration: v || 'auto' }, '时长')} /> : <span className="dim">{t ? `${t.duration.toFixed(1)}s` : ''}</span>}
          </div>
        </Field>
        <Field label="额外停留" help="动画完成后多停留几秒"><NumberInput value={s.hold} step={0.5} min={0} unit="s" placeholder="0" onCommit={(v) => up({ hold: v || null }, '停留')} /></Field>
      </div>
      <div className="section">
        <h4>转场（进入此场景）</h4>
        <Field label="类型"><Select value={tr.type} options={Object.entries(TRANSITIONS).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(v) => up({ transition: v === 'auto' ? 'auto' : { ...(typeof s.transition === 'object' ? s.transition : {}), type: v } }, '转场')} /></Field>
        {tr.type !== 'auto' ? <div className="help" style={{ margin: '-2px 0 4px 96px', color: 'var(--fg3)', fontSize: 11.5 }}>{TRANSITIONS[tr.type]?.description}</div> : null}
        {tr.type !== 'auto' && tr.type !== 'cut' ? <Field label="时长"><NumberInput value={tr.duration} step={0.05} min={0.1} max={3} unit="s" placeholder="自动" onCommit={(v) => up({ transition: { ...tr, duration: v } }, '转场时长')} /></Field> : null}
        {['push', 'slide', 'wipe', 'band', 'stripes'].includes(tr.type) ? <Field label="方向"><Segmented value={tr.direction || 'left'} options={[{ value: 'left', icon: 'arrow-left', title: '向左' }, { value: 'right', icon: 'arrow-right', title: '向右' }, { value: 'up', icon: 'arrow-up', title: '向上' }, { value: 'down', icon: 'arrow-down', title: '向下' }]} onChange={(v) => up({ transition: { ...tr, direction: v } }, '转场方向')} /></Field> : null}
      </div>
      <div className="section">
        <h4>背景与镜头</h4>
        <Field label="背景"><Select value={bg.type} options={Object.entries(BACKGROUNDS).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(v) => up({ background: v === 'auto' ? 'auto' : { type: v } }, '背景')} /></Field>
        {bg.type === 'solid' ? <Field label="颜色"><ColorField value={bg.color} onChange={(v) => up({ background: { ...bg, color: v } }, '背景颜色')} /></Field> : null}
        {bg.type === 'image' ? (
          <>
            <ParamField name="asset" spec={{ type: 'asset', desc: '背景图片' }} value={bg.asset} onChange={(v) => up({ background: { ...bg, asset: v } }, '背景图片')} />
            <Field label="暗化"><NumberInput value={bg.overlay} step={0.05} min={0} max={1} placeholder="0.35" onCommit={(v) => up({ background: { ...bg, overlay: v } }, '背景暗化')} /></Field>
            <Field label="模糊"><NumberInput value={bg.blur} step={1} min={0} max={60} unit="px" placeholder="0" onCommit={(v) => up({ background: { ...bg, blur: v } }, '背景模糊')} /></Field>
          </>
        ) : null}
        <Field label="镜头"><Select value={cam.type} options={Object.entries(CAMERAS).map(([k, v]) => ({ value: k, label: v }))} onChange={(v) => up({ camera: v === 'auto' ? 'auto' : { type: v } }, '镜头')} /></Field>
        {cam.type !== 'auto' && cam.type !== 'none' ? <Field label="幅度"><NumberInput value={cam.amount} step={0.1} min={0} max={2} placeholder="0.5" onCommit={(v) => up({ camera: { ...cam, amount: v } }, '镜头幅度')} /></Field> : null}
      </div>
      <div className="section">
        <h4>元素 <span className="badge">{s.blocks.length}</span><span className="spacer" /><button className="btn sm" onClick={onOpenPalette}><Icon name="plus" size={12} />添加</button></h4>
        <div className="col" style={{ gap: 2 }}>
          {s.blocks.map((b, bi) => (
            <div key={b.id} className={`hist-item ${sel.block === b.id ? 'on' : ''}`} style={{ gridTemplateColumns: '22px 1fr auto', padding: '5px 6px' }}
              onClick={() => editor.selectBlock(b.id, s.id)} onContextMenu={(e) => openMenu(e, blockMenu(b.id))}>
              <Icon name={TYPE_ICON[b.type] || 'square'} size={14} />
              <span className="msg" style={{ opacity: b.hidden ? 0.45 : 1 }}>{COMPONENTS[b.type]?.label} <span className="dim">{plain(b.text || b.title || b.name || b.latex || '')}</span></span>
              <span className="row" style={{ gap: 0 }}>
                {b.frame && typeof b.frame === 'object' ? <Icon name="move" size={12} title="手动定位" /> : null}
                <button className="ibtn sm" disabled={bi === 0} onClick={(e) => { e.stopPropagation(); editor.edit([{ op: 'move_block', block: b.id, position: bi }], { message: '调整顺序' }); }}><Icon name="arrow-up" size={12} /></button>
                <button className="ibtn sm" onClick={(e) => { e.stopPropagation(); editor.updateBlock(b.id, { hidden: b.hidden ? null : true }, { message: '显示/隐藏' }); }}><Icon name={b.hidden ? 'eye-off' : 'eye'} size={12} /></button>
              </span>
            </div>
          ))}
          {!s.blocks.length ? <div className="dim" style={{ padding: 6 }}>空场景 — 点「添加」放入内容</div> : null}
        </div>
      </div>
      <GuideEditor scene={s} />
      <div className="section">
        <h4>演讲备注 / 旁白</h4>
        <TextArea rows={3} value={s.notes} placeholder="演示模式下显示；也会写入讲义 PDF" onCommit={(v) => up({ notes: v || null }, '备注')} />
        <div style={{ height: 6 }} />
        <TextArea rows={2} value={s.narration?.text} placeholder="旁白文本（开启字幕时显示在画面底部）" onCommit={(v) => up({ narration: v ? { text: v } : null }, '旁白')} />
      </div>
    </>
  );
}
const plain = (t) => String(t || '').replace(/\*\*|==|~~|`|\*/g, '').split('\n')[0].slice(0, 30);

// ───────────────────────────── project ─────────────────────────────
function ProjectInspector({ onOpenThemes }) {
  const doc = useEditor((s) => s.doc);
  const [lint, setLint] = useState(null);
  const [linting, setLinting] = useState(false);
  if (!doc) return null;
  const st = doc.style || {};
  const theme = THEMES[doc.theme.id];
  const setStyle = (patch, msg) => editor.edit([{ op: 'set_style', ...patch }], { message: msg || '风格', coalesce: Object.keys(patch).join() });
  const runLint = async () => {
    setLinting(true);
    try { await editor.flushNow(); setLint(await call('project.lint', editor.project.id)); }
    catch (e) { toast.error(e); }
    finally { setLinting(false); }
  };
  const goIssue = (iss) => {
    if (iss.block) editor.selectBlock(iss.block, iss.scene);
    else if (iss.scene) editor.selectScene(iss.scene);
  };
  return (
    <>
      <div className="section">
        <h4>作品</h4>
        <Field label="标题"><TextInput value={doc.title} onCommit={(v) => v && v !== doc.title && editor.edit([{ op: 'set_title', title: v }], { message: '重命名' })} /></Field>
        <Field label="简介"><TextArea rows={2} value={doc.meta?.description} placeholder="用于素材库与 AI 理解" onCommit={(v) => editor.edit([{ op: 'set', path: '/meta/description', value: v }], { message: '简介' })} /></Field>
      </div>
      <div className="section">
        <h4>设计系统</h4>
        <button className="card" style={{ width: '100%', padding: 10, display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', textAlign: 'left', color: 'inherit' }} onClick={onOpenThemes}>
          <span style={{ display: 'flex', gap: 2 }}>{(theme?.palette?.data || []).slice(0, 5).map((c, i) => <i key={i} style={{ width: 8, height: 28, borderRadius: 3, background: c }} />)}</span>
          <span className="grow"><b style={{ color: 'var(--fg0)' }}>{theme?.name || doc.theme.id}</b><br /><span className="dim" style={{ fontSize: 11.5 }}>{theme?.description?.slice(0, 40)}</span></span>
          <Icon name="chevron-right" size={15} />
        </button>
        <Field label="强调色"><ColorField value={doc.theme.accent} onChange={(v, o) => editor.edit([{ op: 'set_theme', accent: v && !/^(accent|accent2|ink|muted|positive|negative|warning)$/.test(v) ? v : null }], { message: '强调色', coalesce: o?.commit ? null : 'accent' })} /></Field>
        <Field label="节奏能量" help="低 = 沉稳克制，高 = 快速有力">
          <div className="row"><span className="dim" style={{ fontSize: 11 }}>沉稳</span><input className="range" type="range" min={0} max={1} step={0.05} value={st.energy ?? 0.6} onChange={(e) => setStyle({ energy: Number(e.target.value) }, '节奏能量')} /><span className="dim" style={{ fontSize: 11 }}>活力</span></div>
        </Field>
        <Field label="密度"><Segmented value={st.density || 'normal'} options={[{ value: 'airy', label: '舒朗' }, { value: 'normal', label: '标准' }, { value: 'compact', label: '紧凑' }]} onChange={(v) => setStyle({ density: v }, '密度')} /></Field>
        <Field label="默认转场"><Select value={st.transition || 'auto'} options={Object.entries(TRANSITIONS).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(v) => setStyle({ transition: v }, '默认转场')} /></Field>
        <Field label="默认镜头"><Select value={st.camera || 'auto'} options={Object.entries(CAMERAS).map(([k, v]) => ({ value: k, label: v }))} onChange={(v) => setStyle({ camera: v }, '默认镜头')} /></Field>
      </div>
      <div className="section">
        <h4>画幅</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {Object.entries(FORMATS).map(([k, f]) => (
            <button key={k} className={`chip ${doc.format.aspect === k ? 'on' : ''}`} style={{ height: 50, flexDirection: 'column', justifyContent: 'center', borderRadius: 8, gap: 4 }} title={f.label} onClick={() => editor.edit([{ op: 'set_format', aspect: k }], { message: `画幅 ${k}` })}>
              <span style={{ width: f.width > f.height ? 22 : 22 * f.width / f.height, height: f.width > f.height ? 22 * f.height / f.width : 22, border: '1.5px solid currentColor', borderRadius: 2 }} />
              <span style={{ fontSize: 11 }}>{k}</span>
            </button>
          ))}
        </div>
        <Field label="帧率"><Segmented value={doc.format.fps} options={[24, 25, 30, 60].map((v) => ({ value: v, label: String(v) }))} onChange={(v) => editor.edit([{ op: 'set_format', fps: v }], { message: '帧率' })} /></Field>
      </div>
      <div className="section">
        <h4>画面元素</h4>
        <Field label="进度条"><div style={{ paddingTop: 5 }}><Switch value={!!st.progress} onChange={(v) => setStyle({ progress: v }, '进度条')} /></div></Field>
        <Field label="页码"><div style={{ paddingTop: 5 }}><Switch value={!!st.pageNumbers} onChange={(v) => setStyle({ pageNumbers: v }, '页码')} /></div></Field>
        <Field label="旁白字幕"><div style={{ paddingTop: 5 }}><Switch value={!!st.captions} onChange={(v) => setStyle({ captions: v }, '字幕')} /></div></Field>
        <Field label="品牌名"><TextInput value={doc.brand?.name} placeholder="显示在角落" onCommit={(v) => editor.edit([{ op: 'set_brand', name: v || null }], { message: '品牌' })} /></Field>
        <Field label="页脚"><TextInput value={doc.brand?.footer} onCommit={(v) => editor.edit([{ op: 'set_brand', footer: v || null }], { message: '页脚' })} /></Field>
        <ParamField name="logo" spec={{ type: 'asset', desc: 'Logo 图片' }} value={doc.brand?.logo} onChange={(v) => editor.edit([{ op: 'set_brand', logo: v || null }], { message: 'Logo' })} />
      </div>
      <div className="section">
        <h4>背景音乐</h4>
        <ParamField name="music" spec={{ type: 'asset', desc: '音频' }} value={doc.audio?.music?.asset} onChange={(v) => editor.edit([{ op: 'set_audio', music: v ? { asset: v } : null }], { message: '背景音乐' })} />
        {doc.audio?.music ? (
          <>
            <Field label="音量"><input className="range" type="range" min={0} max={1} step={0.05} value={doc.audio.music.volume ?? 0.7} onChange={(e) => editor.edit([{ op: 'set_audio', music: { volume: Number(e.target.value) } }], { message: '音量', coalesce: 'vol' })} /></Field>
            <Field label="淡入 / 淡出"><div className="row" style={{ gap: 6 }}><NumberInput value={doc.audio.music.fadeIn} step={0.5} min={0} unit="s" onCommit={(v) => editor.edit([{ op: 'set_audio', music: { fadeIn: v } }], { message: '淡入' })} /><NumberInput value={doc.audio.music.fadeOut} step={0.5} min={0} unit="s" onCommit={(v) => editor.edit([{ op: 'set_audio', music: { fadeOut: v } }], { message: '淡出' })} /></div></Field>
          </>
        ) : null}
      </div>
      <div className="section">
        <h4>设计检查<span className="spacer" /><button className="btn sm" onClick={runLint} disabled={linting}>{linting ? <Spinner size={12} /> : <Icon name="scan" size={12} />}检查</button></h4>
        {lint ? (
          lint.issues.length ? (
            <div className="issues">
              {lint.issues.map((iss, k) => (
                <div key={k} className="issue" onClick={() => goIssue(iss)}>
                  <span className={`lv ${iss.level}`}><Icon name={iss.level === 'error' ? 'circle-x' : iss.level === 'warning' ? 'triangle-alert' : 'info'} size={14} /></span>
                  <div className="grow">
                    <div>{iss.sceneIndex != null ? <span className="dim">场景 {iss.sceneIndex + 1} · </span> : null}{iss.message}</div>
                    {iss.hint ? <div className="h">{iss.hint}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="row" style={{ color: 'var(--ok)' }}><Icon name="circle-check" size={15} />没有发现问题</div>
        ) : <div className="dim" style={{ fontSize: 11.5 }}>检查文字溢出、重叠、对比度、文字密度与节奏。</div>}
      </div>
    </>
  );
}
