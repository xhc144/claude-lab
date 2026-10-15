// Left rail: scene thumbnails (rendered by the live engine), reordering, adding scenes.
import { useEffect, useRef, useState } from 'react';
import { editor, useEditor } from './store.js';
import { Icon } from '../icons.jsx';
import { openMenu, Popover } from '../ui.jsx';
import { sceneMenuItems, layoutLabel } from './Stage.jsx';
import { SCENE_PRESETS } from './presets.js';

// Thumbnails render in idle slices so typing never waits on them.
const queue = new Map();
let pumping = false;
function enqueue(key, fn) { queue.set(key, fn); if (!pumping) { pumping = true; requestAnimationFrame(pump); } }
function pump() {
  const t0 = performance.now();
  for (const [k, fn] of queue) {
    queue.delete(k);
    try { fn(); } catch (e) { console.warn(e); }
    if (performance.now() - t0 > 12) break;
  }
  if (queue.size) requestAnimationFrame(pump); else pumping = false;
}

export function SceneThumb({ id, width = 190 }) {
  const ref = useRef(null);
  const sig = useEditor((s) => `${s.frame}|${s.doc?.format.width}x${s.doc?.format.height}|${s.timing.scenes.find((x) => x.id === id)?.settled}`);
  const lastKey = useRef(null);
  const version = useEditor((s) => s.version);
  useEffect(() => {
    const eng = editor.engine;
    const c = ref.current;
    if (!eng?.C || !c) return;
    const key = `${eng.cache.get(id)?.key}|${sig}|${width}`;
    if (key === lastKey.current) return;
    enqueue(id, () => {
      const S = eng.C?.scenes.find((s) => s.id === id);
      if (!S || !ref.current) return;
      const W = eng.C.env.W, H = eng.C.env.H;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const scale = (width * dpr) / W;
      c.width = Math.round(W * scale); c.height = Math.round(H * scale);
      const settled = editor.timingOf(id)?.settled ?? S.start + 1;
      eng.render(settled - S.start, c.getContext('2d'), { scale, solo: id, chrome: false, noCamera: true });
      lastKey.current = key;
    });
  }, [id, sig, version, width]);
  const doc = editor.s.doc;
  return <canvas ref={ref} style={{ aspectRatio: `${doc?.format.width || 16} / ${doc?.format.height || 9}` }} />;
}

export function SceneList() {
  const { doc, selScene } = useEditor((s) => ({ doc: s.doc, selScene: s.sel.scene }));
  const timing = useEditor((s) => s.timing);
  const [drag, setDrag] = useState(null); // {id, over, before}
  const [addAnchor, setAddAnchor] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current?.querySelector('.scene-item.on');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selScene]);

  if (!doc) return null;
  const portrait = doc.format.height > doc.format.width;
  return (
    <>
      <div className="scenes" ref={listRef} onKeyDown={(e) => {
        const i = doc.scenes.findIndex((s) => s.id === selScene);
        if (e.key === 'ArrowDown' && i < doc.scenes.length - 1) { e.preventDefault(); editor.selectScene(doc.scenes[i + 1].id); }
        if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); editor.selectScene(doc.scenes[i - 1].id); }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selScene) { e.preventDefault(); editor.removeScene(selScene); }
      }} tabIndex={0}>
        {doc.scenes.map((s, i) => {
          const t = timing.scenes.find((x) => x.id === s.id);
          const title = s.name || s.blocks.find((b) => b.type === 'title')?.text || s.blocks[0]?.type || '空场景';
          const cls = ['scene-item', selScene === s.id ? 'on' : '', s.hidden ? 'hidden' : '', drag?.over === s.id ? (drag.before ? 'drop-before' : 'drop-after') : ''].join(' ');
          return (
            <div key={s.id} className={cls} draggable
              onClick={() => editor.selectScene(s.id)}
              onDoubleClick={() => editor.playScene(s.id)}
              onContextMenu={(e) => { editor.selectScene(s.id); openMenu(e, sceneMenuItems(s.id)); }}
              onDragStart={(e) => { e.dataTransfer.setData('text/x-scene', s.id); e.dataTransfer.effectAllowed = 'move'; setDrag({ id: s.id }); }}
              onDragOver={(e) => { if (!drag) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDrag({ ...drag, over: s.id, before: e.clientY < r.top + r.height / 2 }); }}
              onDragEnd={() => setDrag(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (!drag || drag.id === s.id) { setDrag(null); return; }
                const from = doc.scenes.findIndex((x) => x.id === drag.id);
                let to = i + (drag.before ? 0 : 1);
                if (from < to) to -= 1;
                editor.moveScene(drag.id, to + 1);
                setDrag(null);
              }}>
              <div className="idx">{i + 1}</div>
              <div style={{ minWidth: 0 }}>
                <div className="th" style={portrait ? { maxWidth: 110 } : null}>
                  <SceneThumb id={s.id} width={portrait ? 110 : 190} />
                </div>
                <div className="cap">
                  <span className="nm" title={plain(title)}>{plain(title)}</span>
                  {s.hidden ? <Icon name="eye-off" size={12} /> : null}
                  <span className="dim">{t ? `${t.duration.toFixed(1)}s` : ''}</span>
                </div>
              </div>
            </div>
          );
        })}
        <button className="add-scene" onClick={(e) => setAddAnchor(e.currentTarget)}><span className="row" style={{ gap: 6 }}><Icon name="plus" size={14} />添加场景</span></button>
      </div>
      {addAnchor ? <AddScenePopover anchor={addAnchor} onClose={() => setAddAnchor(null)} after={selScene} /> : null}
    </>
  );
}

const plain = (t) => String(t || '').replace(/\*\*|==|~~|`|\*/g, '');

export function AddScenePopover({ anchor, onClose, after, placement = 'right-start' }) {
  return (
    <Popover anchor={anchor} onClose={onClose} placement={placement}>
      <div style={{ width: 380, padding: 10 }}>
        <div className="muted" style={{ fontSize: 11.5, margin: '2px 4px 8px' }}>选择场景类型 — 版式、字体、动画由主题自动完成</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {SCENE_PRESETS.map((p) => (
            <button key={p.id} className="palette-it" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 8, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
              onClick={() => { editor.addScene(JSON.parse(JSON.stringify(p.scene)), after); onClose(); }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--bg3)', color: 'var(--acc-hi)', flex: 'none' }}><Icon name={p.icon} size={14} /></span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', color: 'var(--fg0)', fontWeight: 550 }}>{p.label}</b>
                <span style={{ color: 'var(--fg3)', fontSize: 11 }}>{p.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}

export { layoutLabel };
