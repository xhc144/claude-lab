// Explanation pointer editor (scene tab): the steps a virtual cursor walks through — target, part,
// mark, what is said — with live timing from the engine. Clicking a step jumps the playhead there.
import { editor, useEditor } from './store.js';
import { Icon, TYPE_ICON } from '../icons.jsx';
import { Field, Segmented, Select, Switch, TextArea, TextInput, NumberInput } from '../ui.jsx';
import { COMPONENTS } from '../../../core/catalog/components.js';
import { GUIDE_ACTIONS, guideTarget } from '../../../core/catalog/guide.js';

export const ACTION_ICON = { point: 'mouse-pointer-2', circle: 'circle', underline: 'underline', highlight: 'highlighter', box: 'square-dashed', arrow: 'move-up-right', focus: 'scan', cross: 'x', check: 'check' };
const CURSORS = [
  { value: 'arrow', icon: 'mouse-pointer-2', title: '鼠标箭头' },
  { value: 'pen', icon: 'pen-line', title: '画笔' },
  { value: 'laser', icon: 'circle-dot', title: '激光点' },
  { value: 'hand', icon: 'pointer', title: '手指' },
  { value: 'none', icon: 'eye-off', title: '不显示光标（只画标注）' },
];

const LISTY = new Set(['bullets', 'steps', 'timeline', 'features', 'stats', 'compare', 'table', 'flow', 'pyramid', 'chart']);
function partHint(type) {
  if (type === 'equation') return 'LaTeX 片段，如 c^2（留空=整个公式）';
  if (type === 'plot') return '坐标 x, y · 函数序号 · x轴';
  if (type === 'geometry') return '点名 A · 线段 AB · 图形 ABC';
  if (type === 'chart') return '分类名或序号';
  if (LISTY.has(type)) return '条目序号（1 起）或其中的文字';
  return '要指的文字片段（留空=整个元素）';
}
/** "3, 4" → [3, 4]; "2" → 2 for list-like targets; anything else stays text. */
export function parsePart(v, type) {
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  const xy = /^\(?\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)\s*\)?$/.exec(s);
  if (xy && (type === 'plot' || type === 'geometry')) return [+xy[1], +xy[2]];
  if (/^\d+$/.test(s) && (LISTY.has(type) || type === 'plot')) return +s;
  return s;
}
const partText = (p) => (p == null ? '' : Array.isArray(p) ? p.join(', ') : String(p));

/** Add a step to a scene's guide (used by the panel, the block menu and the stage). */
export function addGuideStep(sceneId, step) {
  const s = editor.s.doc.scenes.find((x) => x.id === sceneId);
  if (!s) return;
  const g = s.guide || { cursor: 'arrow', steps: [] };
  editor.updateScene(sceneId, { guide: { ...g, steps: [...(g.steps || []), step] } }, { message: '添加讲解步骤', coalesce: null });
  dispatchEvent(new CustomEvent('motif:show-guide', { detail: { scene: sceneId, step: (g.steps || []).length } }));
}

export function GuideEditor({ scene: s }) {
  const timing = useEditor((st) => st.timing);
  const selBlock = useEditor((st) => st.sel.block);
  const t = timing.scenes.find((x) => x.id === s.id);
  const g = s.guide || null;
  const steps = g?.steps || [];
  const save = (guide, msg) => editor.updateScene(s.id, { guide: guide && (guide.steps?.length || guide.cursor) ? guide : null }, { message: msg, coalesce: null });
  const setStep = (i, patch, msg = '修改讲解步骤') => {
    const next = steps.map((st, k) => {
      if (k !== i) return st;
      const o = { ...st, ...patch };
      for (const key of Object.keys(o)) if (o[key] === undefined || o[key] === null || o[key] === '') delete o[key];
      return o;
    });
    save({ ...g, steps: next }, msg);
  };
  const move = (i, d) => { const next = [...steps]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); save({ ...g, steps: next }, '调整讲解顺序'); };
  const remove = (i) => save({ ...g, steps: steps.filter((_, k) => k !== i) }, '删除讲解步骤');
  const blocks = s.blocks.filter((b) => !b.hidden);
  const targetOpts = blocks.map((b, i) => ({ value: b.id, label: `${i + 1}. ${COMPONENTS[b.type]?.label || b.type} ${plain(b.text || b.title || b.latex || b.name || '')}`.trim() }));
  const timed = t?.guide || [];
  const miss = editor.engine?.C?.scenes.find((x) => x.id === s.id)?.guideMiss;
  const jump = (i) => {
    const tg = timed.find((x) => x.idx === i);
    if (!tg || !t) return;
    editor.pause();
    editor.seek(t.start + tg.at + tg.drawDur + 0.3);
  };
  const add = () => {
    const own = selBlock && s.blocks.some((b) => b.id === selBlock) ? selBlock : guideTarget(s, null)?.id;
    addGuideStep(s.id, { target: own, do: steps.length ? 'underline' : 'circle' });
    setTimeout(() => jump(steps.length), 60);
  };
  return (
    <div className="section guide-ed" id="guide-editor">
      <h4>
        <Icon name="mouse-pointer-2" size={13} />讲解指针 {steps.length ? <span className="badge">{steps.length}</span> : null}
        <span className="spacer" />
        <button className="btn sm" onClick={add} disabled={!blocks.length}><Icon name="plus" size={12} />添加步骤</button>
      </h4>
      {!steps.length ? (
        <div className="guide-empty">
          讲公式、图表或步骤时，让光标依次圈出、划线、指向要讲的部分，并配上这一步的讲解词，不再让一页静止很久。
          <div className="dim" style={{ marginTop: 6 }}>选中一个元素后点「添加步骤」，或在元素右键菜单里选「讲解标注」。</div>
        </div>
      ) : (
        <>
          <Field label="光标"><Segmented value={g.cursor || 'arrow'} options={CURSORS} onChange={(v) => save({ ...g, cursor: v }, '讲解光标')} /></Field>
          <div className="guide-steps">
            {steps.map((st, i) => {
              const b = guideTarget(s, st.target);
              const tg = timed.find((x) => x.idx === i);
              const missing = miss?.has?.(i);
              return (
                <div key={i} className="guide-step" onClick={(e) => { if (!e.target.closest('input,textarea,select,button')) jump(i); }}>
                  <div className="gs-head">
                    <span className="gs-n">{i + 1}</span>
                    <Select value={st.do} options={Object.entries(GUIDE_ACTIONS).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(v) => setStep(i, { do: v }, '讲解动作')} style={{ width: 86 }} />
                    <Select value={b?.id || ''} placeholder={b ? undefined : '（目标已删除）'} options={targetOpts} onChange={(v) => setStep(i, { target: v }, '讲解目标')} style={{ flex: 1, minWidth: 0 }} />
                    <span className="gs-tools">
                      <button className="ibtn sm" title="上移" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrow-up" size={12} /></button>
                      <button className="ibtn sm" title="下移" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><Icon name="arrow-down" size={12} /></button>
                      <button className="ibtn sm" title="删除" onClick={() => remove(i)}><Icon name="trash" size={12} /></button>
                    </span>
                  </div>
                  <div className="gs-row">
                    <Icon name={TYPE_ICON[b?.type] || 'crosshair'} size={13} />
                    <TextInput value={partText(st.part)} placeholder={partHint(b?.type)} invalid={missing} mono={b?.type === 'equation'} onCommit={(v) => setStep(i, { part: parsePart(v, b?.type) }, '讲解位置')} />
                  </div>
                  {missing ? <div className="gs-warn"><Icon name="triangle-alert" size={12} />画面上找不到「{partText(st.part)}」</div> : null}
                  <TextArea rows={2} value={st.say} placeholder="这一步说什么（决定停留时长；开启字幕时显示）" onCommit={(v) => setStep(i, { say: v }, '讲解词')} />
                  <div className="gs-row gs-meta">
                    <TextInput value={st.note} placeholder="小标签（可选）" onCommit={(v) => setStep(i, { note: v }, '讲解标签')} />
                    <span className="gs-time" title="开始时间（场景内）；留空自动接上一步">
                      <NumberInput value={st.at} step={0.1} min={0} unit="s" placeholder={tg ? tg.at.toFixed(1) : '自动'} onCommit={(v) => setStep(i, { at: v ?? undefined }, '讲解时间')} />
                    </span>
                    <label className="gs-keep" title="标注保留到场景结束"><Switch value={!!st.keep} onChange={(v) => setStep(i, { keep: v || undefined }, '保留标注')} />保留</label>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 6 }}>场景时长会自动延长到讲完为止{t?.guide?.length ? `（讲解至 ${Math.max(...t.guide.map((x) => x.end)).toFixed(1)}s）` : ''}。</div>
        </>
      )}
    </div>
  );
}
const plain = (v) => String(v || '').replace(/\*\*|==|~~|`|\*/g, '').split('\n')[0].slice(0, 16);
