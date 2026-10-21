// The canvas stage: renders the live document through the same engine used for export, and lets
// people select, move and resize blocks, edit text in place, and drop media in.
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { editor, useEditor, findBlock } from './store.js';
import { Icon, TYPE_ICON } from '../icons.jsx';
import { COMPONENTS } from '../../../core/catalog/components.js';
import { openMenu, toast } from '../ui.jsx';
import { call, pathOf } from '../api.js';
import { blockMenu } from './menus.js';

const PAD = 36;
const TEXT_PARAM = { title: 'text', text: 'text', quote: 'text', callout: 'text', code: 'code', equation: 'latex' };

export function Stage({ zoom = 'fit', showSafe }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const { doc, playing, sel, inlineEdit, status } = useEditor((s) => ({ doc: s.doc, playing: s.playing, sel: s.sel, inlineEdit: s.inlineEdit, status: s.status }));
  const time = useEditor((s) => s.time);
  const version = useEditor((s) => s.version + s.frame * 100000);
  const [guides, setGuides] = useState([]);
  const [hover, setHover] = useState(null);
  const [dropOver, setDropOver] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = doc?.format.width || 1920, H = doc?.format.height || 1080;
  const fit = Math.min((box.w - PAD * 2) / W, (box.h - PAD * 2) / H);
  const scale = Math.max(0.05, zoom === 'fit' ? fit : Number(zoom));
  const vw = Math.round(W * scale), vh = Math.round(H * scale);
  const left = Math.round((box.w - vw) / 2), top = Math.round((box.h - vh) / 2);

  // draw: at most one frame per animation frame, always with the latest state. A pending draw is
  // never cancelled by a newer change — during playback the play loop updates the time every frame,
  // and cancel-and-reschedule would starve the canvas (it froze on the first frame).
  const drawArgs = useRef(null);
  drawArgs.current = { time, vw, vh, W, playing };
  const drawRef = useRef(0);
  useEffect(() => {
    if (drawRef.current) return;
    drawRef.current = requestAnimationFrame(() => {
      drawRef.current = 0;
      const c = canvasRef.current;
      if (!c || !editor.engine?.C) return;
      const a = drawArgs.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.round(a.vw * dpr), ch = Math.round(a.vh * dpr);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      editor.engine.render(a.time, c.getContext('2d'), { scale: cw / a.W, noCamera: !a.playing, live: true, playing: a.playing });
    });
  }, [time, version, vw, vh, W, playing]);
  useEffect(() => () => { cancelAnimationFrame(drawRef.current); drawRef.current = 0; }, []);

  const sceneNow = editor.sceneAtTime(time);
  const items = !playing && sceneNow && editor.engine ? editor.engine.layoutOf(sceneNow.id) : [];
  const toScreen = (r) => ({ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale });
  const selBlock = findBlock(doc, sel.block)?.block;

  // ── pointer interactions ──
  const onBoxDown = (e, it) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const fb = findBlock(editor.s.doc, it.id);
    if (!fb) return;
    if (editor.s.sel.block !== it.id) { editor.selectBlock(it.id, fb.scene.id); }
    if (fb.block.locked) return;
    startDrag(e, it, 'move');
  };

  const startDrag = (e, it, mode) => {
    e.preventDefault();
    const base = editor.s.doc;
    const fb = findBlock(base, it.id);
    const r0 = it.rect;
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    let last = null;
    const others = items.filter((o) => o.id !== it.id && !o.bleed).map((o) => o.rect);
    const xs = [0, W / 2, W, ...others.flatMap((r) => [r.x, r.x + r.w / 2, r.x + r.w])];
    const ys = [0, H / 2, H, ...others.flatMap((r) => [r.y, r.y + r.h / 2, r.y + r.h])];
    const snapTol = 6 / scale;
    const snap = (v, list) => { let best = null; for (const c of list) { const d = Math.abs(c - v); if (d < snapTol && (!best || d < best.d)) best = { c, d }; } return best; };
    const mv = (ev) => {
      const dx = (ev.clientX - x0) / scale, dy = (ev.clientY - y0) / scale;
      if (!moved && Math.hypot(dx, dy) * scale < 3) return;
      moved = true;
      let { x, y, w, h } = r0;
      const g = [];
      if (mode === 'move') {
        x += dx; y += dy;
        if (!ev.altKey) {
          const cand = [[x, 0], [x + w / 2, w / 2], [x + w, w]];
          let bx = null; for (const [v, off] of cand) { const s = snap(v, xs); if (s && (!bx || s.d < bx.d)) bx = { ...s, off }; }
          if (bx) { x = bx.c - bx.off; g.push({ v: true, at: bx.c }); }
          const cy = [[y, 0], [y + h / 2, h / 2], [y + h, h]];
          let by = null; for (const [v, off] of cy) { const s = snap(v, ys); if (s && (!by || s.d < by.d)) by = { ...s, off }; }
          if (by) { y = by.c - by.off; g.push({ v: false, at: by.c }); }
        }
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) y = r0.y; else x = r0.x; }
      } else {
        if (mode.includes('e')) w = Math.max(20, r0.w + dx);
        if (mode.includes('s')) h = Math.max(20, r0.h + dy);
        if (mode.includes('w')) { x = Math.min(r0.x + r0.w - 20, r0.x + dx); w = r0.w - (x - r0.x); }
        if (mode.includes('n')) { y = Math.min(r0.y + r0.h - 20, r0.y + dy); h = r0.h - (y - r0.y); }
        if (ev.shiftKey && mode.length === 2) { const ar = r0.w / r0.h; if (w / h > ar) w = h * ar; else h = w / ar; if (mode.includes('w')) x = r0.x + r0.w - w; if (mode.includes('n')) y = r0.y + r0.h - h; }
        if (!ev.altKey) {
          if (mode.includes('e')) { const s = snap(x + w, xs); if (s) { w = s.c - x; g.push({ v: true, at: s.c }); } }
          if (mode.includes('s')) { const s = snap(y + h, ys); if (s) { h = s.c - y; g.push({ v: false, at: s.c }); } }
          if (mode.includes('w')) { const s = snap(x, xs); if (s) { w += x - s.c; x = s.c; g.push({ v: true, at: s.c }); } }
          if (mode.includes('n')) { const s = snap(y, ys); if (s) { h += y - s.c; y = s.c; g.push({ v: false, at: s.c }); } }
        }
      }
      setGuides(g);
      const frame = { x: +(x / W).toFixed(4), y: +(y / H).toFixed(4), w: +(w / W).toFixed(4), h: +(h / H).toFixed(4) };
      last = frame;
      editor.edit([{ op: 'update_block', block: it.id, set: { frame } }], { base, transient: true });
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      setGuides([]);
      if (moved && last) {
        const first = !fb.block.frame;
        editor.edit([{ op: 'update_block', block: it.id, set: { frame: last } }], { base, message: mode === 'move' ? '移动' : '调整大小' });
        if (first) toast('该元素已改为手动定位；在检查器中可「恢复自动布局」', { duration: 4000 });
      }
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  const onBgDown = (e) => {
    if (e.button !== 0) return;
    editor.set({ inlineEdit: null });
    if (sceneNow) editor.selectScene(sceneNow.id, { seek: false });
  };

  const onDbl = (it) => {
    const fb = findBlock(editor.s.doc, it.id);
    if (!fb || fb.block.locked) return;
    const key = TEXT_PARAM[fb.block.type];
    if (key) editor.set({ inlineEdit: { id: it.id, key } });
    else window.dispatchEvent(new CustomEvent('motif:focus-inspector', { detail: { block: it.id } }));
  };

  // keyboard: nudge / delete / duplicate
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const id = editor.s.sel.block;
      if (!id) return;
      const fb = findBlock(editor.s.doc, id);
      if (!fb) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !fb.block.locked) { e.preventDefault(); editor.removeBlock(id); }
      else if (e.key === 'Escape') editor.selectBlock(null);
      else if (e.key === 'Enter' && TEXT_PARAM[fb.block.type]) { e.preventDefault(); editor.set({ inlineEdit: { id, key: TEXT_PARAM[fb.block.type] } }); }
      else if (e.key.startsWith('Arrow') && !fb.block.locked) {
        e.preventDefault();
        const it = editor.engine.layoutOf(fb.scene.id).find((x) => x.id === id);
        if (!it) return;
        const step = e.shiftKey ? 10 : 1;
        const f = fb.block.frame || { x: it.rect.x / W, y: it.rect.y / H, w: it.rect.w / W, h: it.rect.h / H };
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        editor.updateBlock(id, { frame: { ...f, x: +(f.x + dx / W).toFixed(4), y: +(f.y + dy / H).toFixed(4) } }, { message: '微调位置', coalesce: `nudge:${id}` });
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [W, H]);

  // ── drops: project assets (from the Assets panel) or files from the OS ──
  const onDrop = async (e) => {
    e.preventDefault();
    setDropOver(false);
    const assetId = e.dataTransfer.getData('application/x-motif-asset');
    const comp = e.dataTransfer.getData('application/x-motif-component');
    const type = e.dataTransfer.getData('application/x-motif-block');
    if (assetId) { insertAsset(editor.s.doc.assets[assetId]); return; }
    if (type) { window.dispatchEvent(new CustomEvent('motif:add-block', { detail: { type } })); return; }
    if (comp) { window.dispatchEvent(new CustomEvent('motif:insert-component', { detail: { id: comp } })); return; }
    const files = [...e.dataTransfer.files].map((f) => pathOf(f)).filter(Boolean);
    if (!files.length) return;
    e.stopPropagation();
    try {
      const r = await call('assets.import', editor.project.id, files);
      editor.setDoc(r.doc);
      editor.set({ rev: r.doc.meta?.revision });
      for (const a of r.assets) insertAsset(a);
    } catch (err) { toast.error(err); }
  };

  if (status !== 'ready' || !doc) return <div className="stage-wrap checker" ref={wrapRef} />;

  return (
    <div className="stage-wrap checker" ref={wrapRef} onMouseDown={onBgDown}
      onDragOver={(e) => { e.preventDefault(); setDropOver(true); }} onDragLeave={() => setDropOver(false)} onDrop={onDrop}
      onContextMenu={(e) => { if (sceneNow) openMenu(e, sceneMenuItems(sceneNow.id)); }}>
      <canvas ref={canvasRef} className="stage-canvas" style={{ left, top, width: vw, height: vh, outline: dropOver ? '2px solid var(--acc)' : undefined }} />
      {!doc.scenes.length ? (
        <div className="stage-empty">
          <div className="empty">
            <div className="ico"><Icon name="layout-template" size={22} /></div>
            <div style={{ color: 'var(--fg0)', fontSize: 14 }}>空白作品</div>
            <div>从左侧添加场景，或让 AI 助手根据你的内容生成。</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => editor.addScene({ layout: 'cover', blocks: [{ type: 'title', text: doc.title, subtitle: '副标题' }] })}><Icon name="plus" size={14} />添加封面</button>
              <button className="btn ai" onClick={() => window.dispatchEvent(new CustomEvent('motif:open-ai'))}><Icon name="sparkles" size={14} />AI 生成</button>
            </div>
          </div>
        </div>
      ) : null}
      {showSafe ? <div className="overlay" style={{ left: left + vw * 0.05, top: top + vh * 0.05, width: vw * 0.9, height: vh * 0.9, border: '1px dashed rgba(255,255,255,.25)' }} /> : null}
      <div className="overlay" style={{ left, top, width: vw, height: vh }}>
        {items.map((it) => {
          const b = findBlock(doc, it.id)?.block;
          if (!b || b.hidden) return null;
          const on = sel.block === it.id;
          if (inlineEdit?.id === it.id) return null;
          if (it.bleed && !on) return null;
          return (
            <div key={it.id} className={`ov-box ${on ? 'sel' : ''} ${b.locked ? 'locked' : ''}`} style={{ ...toScreen(it.rect), ...(hover === it.id && !on ? { borderColor: 'rgba(152,140,255,.65)' } : null), ...(it.bleed ? { pointerEvents: 'none' } : null) }}
              onMouseDown={(e) => onBoxDown(e, it)} onDoubleClick={() => onDbl(it)}
              onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)}
              onContextMenu={(e) => { e.stopPropagation(); editor.selectBlock(it.id); openMenu(e, blockMenu(it.id)); }}>
              {on ? (
                <>
                  <span className="tag"><Icon name={TYPE_ICON[b.type] || 'square'} size={11} />{COMPONENTS[b.type]?.label || b.type}{b.frame ? ' · 手动' : ''}{b.locked ? ' · 已锁定' : ''}</span>
                  {!b.locked ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => <span key={h} className={`hd ${h}`} onMouseDown={(e) => { e.stopPropagation(); startDrag(e, it, h); }} />) : null}
                </>
              ) : null}
            </div>
          );
        })}
        {guides.map((g, i) => <div key={i} className="ov-guide" style={g.v ? { left: g.at * scale, top: 0, width: 1, height: vh } : { top: g.at * scale, left: 0, height: 1, width: vw }} />)}
        {inlineEdit ? <InlineEditor key={inlineEdit.id} edit={inlineEdit} items={items} scale={scale} /> : null}
      </div>
      <div className="stage-hud">
        {sceneNow ? <span className="badge">场景 {sceneNow.index + 1} · {layoutLabel(sceneNow.layout)}</span> : null}
        {selBlock ? <span className="badge acc">{COMPONENTS[selBlock.type]?.label}</span> : null}
        <span className="badge">{W}×{H}</span>
      </div>
    </div>
  );
}

const LAYOUT_LABEL = { cover: '封面', section: '章节页', split: '左右分栏', focus: '视觉聚焦', stack: '上下堆叠', grid: '网格', full: '全屏', quote: '引言', closing: '结尾', free: '自由' };
export const layoutLabel = (l) => LAYOUT_LABEL[l] || l;

function InlineEditor({ edit, items, scale }) {
  const it = items.find((x) => x.id === edit.id);
  const fb = findBlock(editor.s.doc, edit.id);
  const [v, setV] = useState(() => String(fb?.block[edit.key] ?? ''));
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = useCallback(() => { editor.set({ inlineEdit: null }); }, []);
  if (!it || !fb) return null;
  const r = it.rect;
  const fontPx = Math.max(13, Math.min(28, r.h * scale * 0.18));
  return (
    <textarea ref={ref} className={`inline-edit ${edit.key !== 'text' ? 'mono' : ''}`} value={v} spellCheck={false}
      style={{ left: r.x * scale - 4, top: r.y * scale - 4, width: Math.max(220, r.w * scale + 8), height: Math.max(64, r.h * scale + 8), fontSize: fontPx, fontFamily: edit.key !== 'text' ? 'var(--mono)' : undefined }}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => { setV(e.target.value); editor.updateBlock(edit.id, { [edit.key]: e.target.value }, { message: '编辑文字', coalesce: `inline:${edit.id}` }); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commit(); } e.stopPropagation(); }} />
  );
}

export function insertAsset(a) {
  if (!a) return;
  if (a.kind === 'image') editor.addBlock({ type: 'image', asset: a.id });
  else if (a.kind === 'video') editor.addBlock({ type: 'video', asset: a.id });
  else if (a.kind === 'model') editor.addBlock({ type: 'model', asset: a.id });
  else if (a.kind === 'audio') { editor.edit([{ op: 'set_audio', music: { asset: a.id } }], { message: '设置背景音乐' }); toast.ok(`已设为背景音乐：${a.name}`); }
  else toast(`无法直接插入 ${a.name}`);
}

export function sceneMenuItems(id) {
  const doc = editor.s.doc;
  const i = doc.scenes.findIndex((s) => s.id === id);
  const s = doc.scenes[i];
  if (!s) return [];
  return [
    { label: '从此场景播放', icon: 'play', onClick: () => editor.playScene(id) },
    '-',
    { label: '复制场景', icon: 'copy', kbd: 'Ctrl+D', onClick: () => editor.duplicateScene(id) },
    { label: s.hidden ? '取消隐藏' : '隐藏（不导出）', icon: s.hidden ? 'eye' : 'eye-off', onClick: () => editor.updateScene(id, { hidden: s.hidden ? null : true }, { message: s.hidden ? '显示场景' : '隐藏场景' }) },
    { label: '上移', icon: 'arrow-up', disabled: i === 0, onClick: () => editor.moveScene(id, i) },
    { label: '下移', icon: 'arrow-down', disabled: i === doc.scenes.length - 1, onClick: () => editor.moveScene(id, i + 2) },
    '-',
    { label: '保存为组件…', icon: 'component', onClick: () => window.dispatchEvent(new CustomEvent('motif:save-component', { detail: { scene: id } })) },
    '-',
    { label: '删除场景', icon: 'trash', danger: true, onClick: () => editor.removeScene(id) },
  ];
}
