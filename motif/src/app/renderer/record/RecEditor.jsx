// Recording editor: a focused workspace for screen recordings, after DogSC's editor (MIT,
// github.com/laogou717/dogsc): the picture in the middle with a floating transport, an
// inspector for the frame, camera motion, cursor, webcam and sound, and a multi-track timeline
// (clips with thumbnails, zoom segments, clicks, audio). Everything edits the `screen` block of
// the document through the same op pipeline as the full editor, so undo, autosave, the CLI and
// the AI all keep working, and "高级编辑" opens the same project in the full editor.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { editor, useEditor } from '../editor/store.js';
import { Icon } from '../icons.jsx';
import { Spinner, toast } from '../ui.jsx';
import { fmtTime, platform } from '../api.js';
import { ExportDialog } from '../editor/ExportDialog.jsx';
import { HistoryDialog } from '../editor/Panels.jsx';
import { RecTimeline } from './RecTimeline.jsx';
import { RecInspector } from './RecInspector.jsx';
import {
  screenBlockOf, screenSettings, normalizeClips, outDuration, outToSrc, srcToOut, sortZooms, normalizeZoom,
  splitAt, removeClip, planZooms, parsePointerTrack, clipStarts,
} from '../../../core/screen/index.js';
import './rec.css';
import { useRec, setBlock } from './state.js';

export { useRec, setBlock, usePointer } from './state.js';

export function RecEditor({ onHome, onAdvanced }) {
  const status = useEditor((s) => s.status);
  const rec = useRec();
  const [modal, setModal] = useState(null);
  const [sel, setSel] = useState(null); // { kind: 'zoom', id } | { kind: 'clip', index }
  const [tab, setTab] = useState(() => localStorage.getItem('motif.rec.tab') || 'frame');
  const [tlH, setTlH] = useState(() => Number(localStorage.getItem('motif.rec.tlH')) || 236);
  useEffect(() => { try { localStorage.setItem('motif.rec.tab', tab); localStorage.setItem('motif.rec.tlH', String(tlH)); } catch { /* ignore */ } }, [tab, tlH]);

  const lt = () => editor.s.time - (rec?.start || 0);
  const ops = useMemo(() => ({
    split() {
      if (!rec) return;
      const next = splitAt(rec.clips, lt());
      if (next.length === rec.clips.length) { toast('离片段边缘太近，无法分割'); return; }
      setBlock(rec, { clips: next }, { message: '分割片段' });
    },
    removeSelected() {
      if (!rec || !sel) return;
      if (sel.kind === 'zoom') { setBlock(rec, { zooms: rec.zooms.filter((z) => z.id !== sel.id) }, { message: '删除缩放' }); setSel(null); }
      if (sel.kind === 'clip') {
        if (rec.clips.length <= 1) { toast('至少保留一个片段'); return; }
        setBlock(rec, { clips: removeClip(rec.clips, sel.index) }, { message: '删除片段' }); setSel(null);
      }
    },
    addZoom(at) {
      if (!rec) return;
      const t = at ?? lt();
      const src = outToSrc(rec.clips, t).src;
      const d = rec.settings.zoom;
      const len = Math.min(3, Math.max(1, rec.D - src));
      const z = normalizeZoom({ id: `z${Date.now().toString(36)}`, start: src, end: src + len, scale: d.scale, mode: rec.block.pointer ? 'auto' : 'manual', easing: d.easing, enter: d.enter, exit: d.exit, focus: [0.5, 0.5] });
      // never overlap the next segment
      const next = rec.zooms.find((x) => x.start > src);
      if (next && z.end > next.start - 0.05) z.end = Math.max(src + 0.3, next.start - 0.05);
      if (rec.zooms.some((x) => src >= x.start && src <= x.end)) { toast('这里已经有缩放片段'); return; }
      setBlock(rec, { zooms: [...rec.zooms, z].sort((a, b) => a.start - b.start) }, { message: '添加缩放' });
      setSel({ kind: 'zoom', id: z.id });
      setTab('camera');
    },
    autoZoom(track) {
      if (!rec || !track) return;
      const d = rec.settings.zoom;
      const zooms = planZooms(track.events, { duration: rec.D, scale: d.scale, easing: d.easing, enter: d.enter, exit: d.exit });
      setBlock(rec, { zooms: [...rec.zooms.filter((z) => z.mode === 'manual'), ...zooms.map((z) => ({ ...z, id: `a${z.id}${Date.now().toString(36)}` }))].sort((a, b) => a.start - b.start) }, { message: '自动运镜' });
      toast.ok(zooms.length ? `按点击生成了 ${zooms.length} 段缩放` : '录像里没有点击，未生成缩放');
    },
  }), [rec, sel]);

  // keyboard
  useEffect(() => {
    const k = (e) => {
      if (modal) return;
      const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); editor.redo(); return; }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); setModal('export'); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); editor.flushNow().then(() => toast.ok('已保存')); return; }
      if (typing || mod) return;
      const fps = rec?.doc.format.fps || 30;
      if (e.key === ' ') { e.preventDefault(); editor.toggle(); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); ops.split(); }
      else if (e.key.toLowerCase() === 'z') { e.preventDefault(); ops.addZoom(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ops.removeSelected(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); editor.pause(); editor.seek(editor.s.time + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === 'Home') editor.seek(rec?.start || 0);
      else if (e.key === 'End') editor.seek((rec?.start || 0) + (rec?.length || 0) - 0.01);
      else if (e.key === 'Escape') setSel(null);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [modal, ops, rec]);

  useEffect(() => {
    const f = (e) => { if (e.detail === 'export') setModal('export'); if (e.detail === 'play') editor.toggle(); };
    addEventListener('motif:rec-command', f);
    return () => removeEventListener('motif:rec-command', f);
  }, []);

  const startResize = (e) => {
    const y0 = e.clientY, h0 = tlH;
    const mv = (ev) => setTlH(Math.max(150, Math.min(innerHeight * 0.6, h0 - (ev.clientY - y0))));
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  return (
    <div className="rec-editor" style={{ '--tl-h': `${tlH}px` }}>
      <RecTopBar onHome={onHome} onAdvanced={onAdvanced} openModal={setModal} rec={rec} />
      <div className="rec-center">
        {status === 'ready' && rec ? <RecCanvas rec={rec} /> : <div className="rec-canvas-wrap"><Spinner size={22} /></div>}
      </div>
      <div className="rec-right">
        {status === 'ready' && rec ? <RecInspector rec={rec} tab={tab} setTab={setTab} sel={sel} setSel={setSel} ops={ops} /> : null}
      </div>
      <div className="rec-bottom">
        <div className="splitter-h" onMouseDown={startResize} />
        {status === 'ready' && rec ? <RecTimeline rec={rec} sel={sel} setSel={(s) => { setSel(s); if (s?.kind === 'zoom') setTab('camera'); }} ops={ops} /> : null}
      </div>
      {modal === 'export' ? <ExportDialog recording onClose={() => setModal(null)} /> : null}
      {modal === 'history' ? <HistoryDialog onClose={() => setModal(null)} /> : null}
    </div>
  );
}

function RecTopBar({ onHome, onAdvanced, openModal, rec }) {
  const { doc, save, canUndo, canRedo } = useEditor((s) => ({ doc: s.doc, save: s.save, canUndo: s.canUndo, canRedo: s.canRedo }));
  const [title, setTitle] = useState('');
  useEffect(() => { setTitle(doc?.title || ''); }, [doc?.title]);
  return (
    <div className={`titlebar ${platform === 'darwin' ? 'mac' : 'win'}`}>
      <button className="ibtn" title="素材库" onClick={onHome}><Icon name="house" size={16} /></button>
      <span className="rec-badge"><span className="rec-dot" />录屏</span>
      <input className="title-edit" value={title} size={Math.max(6, Math.min(40, title.length + 2))} onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title.trim() && doc && title !== doc.title) editor.edit([{ op: 'set_title', title: title.trim() }], { message: '重命名' }); else setTitle(doc?.title || ''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTitle(doc?.title || ''); e.currentTarget.blur(); } }} />
      <span className={`save-state ${save}`}><span className="dot" />{save === 'saving' ? '保存中' : save === 'error' ? '未保存' : '已保存'}</span>
      <span className="tb-sep" />
      <button className="ibtn" title="撤销 Ctrl+Z" disabled={!canUndo} onClick={() => editor.undo()}><Icon name="undo-2" size={16} /></button>
      <button className="ibtn" title="重做 Ctrl+Y" disabled={!canRedo} onClick={() => editor.redo()}><Icon name="redo-2" size={16} /></button>
      <button className="ibtn" title="版本历史" onClick={() => openModal('history')}><Icon name="clock-arrow-up" size={16} /></button>
      {rec && rec.scenes.length > 1 ? (
        <select className="select" style={{ width: 'auto', height: 28, marginLeft: 6 }} value={rec.scene.id} onChange={(e) => editor.selectScene(e.target.value)}>
          {rec.scenes.map((s, i) => <option key={s.id} value={s.id}>{s.name || `录屏 ${i + 1}`}</option>)}
        </select>
      ) : null}
      <div className="drag grow" />
      <button className="btn ghost" title="在完整编辑器中添加标题、字幕、其他场景" onClick={onAdvanced}><Icon name="layout-panel-left" size={15} />高级编辑</button>
      <button className="btn primary" onClick={() => openModal('export')}><Icon name="download" size={14} />导出</button>
    </div>
  );
}

function RecCanvas({ rec }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const time = useEditor((s) => s.time);
  const playing = useEditor((s) => s.playing);
  const version = useEditor((s) => s.version + s.frame * 100000);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = rec.doc.format.width, H = rec.doc.format.height;
  const k = Math.max(0.05, Math.min((box.w - 48) / W, (box.h - 96) / H));
  const vw = Math.round(W * k), vh = Math.round(H * k);
  const args = useRef(null);
  args.current = { time, vw, vh, W, playing };
  const raf = useRef(0);
  useEffect(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const c = canvasRef.current;
      if (!c || !editor.engine?.C) return;
      const a = args.current;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const cw = Math.round(a.vw * dpr), ch = Math.round(a.vh * dpr);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      editor.engine.render(a.time, c.getContext('2d'), { scale: cw / a.W, live: true, playing: a.playing });
    });
  }, [time, version, vw, vh, W, playing]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; editor.engine?.assets.pauseAll(); }, []);
  useEffect(() => { if (!playing) editor.engine?.assets.pauseAll(); }, [playing]);

  // play inside this recording: stop at its end
  const local = time - rec.start;
  useEffect(() => { if (playing && local >= rec.length - 0.02) { editor.pause(); editor.seek(rec.start + rec.length - 0.01); } }, [playing, local, rec]);

  const m = outToSrc(rec.clips, Math.max(0, local));
  return (
    <div className="rec-canvas-wrap" ref={wrapRef}>
      <div className="rec-canvas" style={{ width: vw, height: vh }} onClick={() => editor.toggle()}>
        <canvas ref={canvasRef} style={{ width: vw, height: vh }} />
      </div>
      <div className="rec-transport">
        <button className="ibtn" title="到开头" onClick={() => editor.seek(rec.start)}><Icon name="skip-back" size={15} /></button>
        <button className="ibtn" title="后退 5 秒" onClick={() => editor.seek(Math.max(rec.start, editor.s.time - 5))}><Icon name="rotate-ccw" size={15} /></button>
        <button className="ibtn play" title="播放 / 暂停 Space" onClick={() => { if (!playing && local >= rec.length - 0.05) editor.seek(rec.start); editor.toggle(); }}><Icon name={playing ? 'pause' : 'play'} size={18} /></button>
        <button className="ibtn" title="前进 5 秒" onClick={() => editor.seek(Math.min(rec.start + rec.length - 0.01, editor.s.time + 5))}><Icon name="rotate-cw" size={15} /></button>
        <span className="tc">{fmtTime(Math.max(0, local))}<span className="tot"> / {fmtTime(rec.length)}</span></span>
        {m.speed !== 1 ? <span className="badge">{m.speed}×</span> : null}
      </div>
    </div>
  );
}

export { clipStarts, srcToOut };
