// The editor workspace: scenes · stage · inspector · timeline.
import { useEffect, useRef, useState } from 'react';
import { editor, useEditor } from './store.js';
import { Icon } from '../icons.jsx';
import { Spinner, toast, openMenu } from '../ui.jsx';
import { on, fmtTime, platform } from '../api.js';
import { Stage } from './Stage.jsx';
import { SceneList, AddScenePopover } from './SceneList.jsx';
import { Inspector } from './Inspector.jsx';
import { Timeline } from './Timeline.jsx';
import { Palette } from './Palette.jsx';
import { ThemeGallery } from './ThemeGallery.jsx';
import { ExportDialog } from './ExportDialog.jsx';
import { Present } from './Present.jsx';
import { AssetsPanel, ComponentsPanel, HistoryDialog, saveComponentFlow } from './Panels.jsx';
import { blockPreset } from './presets.js';
import { THEMES } from '../../../core/themes/index.js';
import { isRecordingDoc } from '../../../core/screen/index.js';
import { RecEditor } from '../record/RecEditor.jsx';

export function Editor({ projectId, onHome, onCommand }) {
  const status = useEditor((s) => s.status);
  const error = useEditor((s) => s.error);
  const isRec = useEditor((s) => !!s.doc && isRecordingDoc(s.doc));
  const hasScreen = useEditor((s) => !!s.doc?.scenes.some((sc) => sc.blocks.some((b) => b.type === 'screen')));
  const modeKey = `motif.recmode.${projectId}`;
  const [mode, setModeState] = useState(() => { try { return localStorage.getItem(modeKey) || 'auto'; } catch { return 'auto'; } });
  const setMode = (m) => { setModeState(m); try { localStorage.setItem(modeKey, m); } catch { /* ignore */ } };
  const recView = useRef(false);
  const [leftTab, setLeftTab] = useState('scenes');
  const [rightTab, setRightTab] = useState('scene');
  const [modal, setModal] = useState(null);
  const [tlH, setTlH] = useState(() => Number(localStorage.getItem('motif.tlH')) || 210);
  const [zoom, setZoom] = useState('fit');

  useEffect(() => { editor.open(projectId); return () => editor.close(); }, [projectId]);
  useEffect(() => { try { localStorage.setItem('motif.tlH', String(tlH)); } catch { /* ignore */ } }, [tlH]);

  // cross-component requests
  useEffect(() => {
    const offs = [
      ['motif:open-ai', () => setRightTab('ai')],
      ['motif:show-guide', () => { setRightTab('scene'); setTimeout(() => document.getElementById('guide-editor')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80); }],
      ['motif:save-component', (e) => saveComponentFlow(e.detail)],
      ['motif:add-block', (e) => editor.addBlock(blockPreset(e.detail.type))],
    ].map(([n, f]) => { addEventListener(n, f); return () => removeEventListener(n, f); });
    return () => offs.forEach((f) => f());
  }, []);

  // keyboard
  useEffect(() => {
    const k = (e) => {
      if (modal === 'present' || recView.current) return;
      const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); editor.redo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); editor.flushNow().then(() => toast.ok('已保存（Motif 会自动保存每一次修改）')); return; }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setModal('palette'); return; }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); setModal('export'); return; }
      if (mod && e.key.toLowerCase() === 'd' && !typing) {
        e.preventDefault();
        if (editor.s.sel.block) editor.duplicateBlock(editor.s.sel.block); else if (editor.s.sel.scene) editor.duplicateScene(editor.s.sel.scene);
        return;
      }
      if (typing) return;
      if (e.key === ' ') { e.preventDefault(); editor.toggle(); }
      else if (e.key === 'F5') { e.preventDefault(); setModal('present'); }
      else if (e.key === 'Home') editor.seek(0);
      else if (e.key === 'End') editor.seek(editor.s.timing.duration - 0.01);
      else if (!editor.s.sel.block && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('.scenes')) {
        const list = editor.s.doc?.scenes || [];
        const i = list.findIndex((s) => s.id === editor.s.sel.scene);
        const n = list[i + (e.key === 'ArrowRight' ? 1 : -1)];
        if (n) { e.preventDefault(); editor.selectScene(n.id); }
      } else if (e.key === '/') { e.preventDefault(); setModal('palette'); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [modal]);

  // menu commands
  useEffect(() => on('command', (cmd) => {
    if (recView.current && ['export', 'play', 'present'].includes(cmd)) { dispatchEvent(new CustomEvent('motif:rec-command', { detail: cmd })); return; }
    const inText = document.activeElement?.closest?.('input, textarea, [contenteditable]');
    if ((cmd === 'undo' || cmd === 'redo') && inText) document.execCommand(cmd);
    else if (cmd === 'undo') editor.undo();
    else if (cmd === 'redo') editor.redo();
    else if (cmd === 'export') setModal('export');
    else if (cmd === 'present') setModal('present');
    else if (cmd === 'play') editor.toggle();
    else onCommand?.(cmd);
  }), [onCommand]);

  recView.current = status === 'ready' && ((isRec && mode !== 'advanced') || mode === 'recording');
  if (recView.current) return <RecEditor onHome={onHome} onAdvanced={() => { editor.pause(); setMode('advanced'); }} />;

  if (status === 'error') {
    return (
      <div className="editor" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="empty">
          <div className="ico" style={{ color: 'var(--err)' }}><Icon name="circle-alert" size={22} /></div>
          <div style={{ color: 'var(--fg0)' }}>无法打开作品</div>
          <div>{error?.message}</div>
          <button className="btn" onClick={onHome}>返回素材库</button>
        </div>
      </div>
    );
  }

  const startResize = (e) => {
    const y0 = e.clientY, h0 = tlH;
    const mv = (ev) => setTlH(Math.max(110, Math.min(innerHeight * 0.6, h0 - (ev.clientY - y0))));
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  return (
    <div className="editor" style={{ '--tl-h': `${tlH}px` }}>
      <TopBar onHome={onHome} openModal={setModal} onAI={() => setRightTab('ai')} onRecording={hasScreen ? () => { editor.pause(); setMode('recording'); } : null} />
      <div className="left panel">
        <div className="tabs">
          <button className={leftTab === 'scenes' ? 'on' : ''} onClick={() => setLeftTab('scenes')}>场景</button>
          <button className={leftTab === 'assets' ? 'on' : ''} onClick={() => setLeftTab('assets')}>资源</button>
          <button className={leftTab === 'components' ? 'on' : ''} onClick={() => setLeftTab('components')}>组件</button>
        </div>
        {status !== 'ready' ? <div className="empty"><Spinner /></div>
          : leftTab === 'scenes' ? <SceneList /> : leftTab === 'assets' ? <AssetsPanel /> : <ComponentsPanel />}
      </div>
      <div className="center">
        <StageBar zoom={zoom} setZoom={setZoom} openModal={setModal} />
        {status === 'ready' ? <Stage zoom={zoom} /> : <div className="stage-wrap checker" style={{ display: 'grid', placeItems: 'center' }}><Spinner size={22} /></div>}
      </div>
      <div className="right panel">
        {status === 'ready' ? <Inspector tab={rightTab} setTab={setRightTab} onOpenThemes={() => setModal('themes')} onOpenPalette={() => setModal('palette')} /> : null}
      </div>
      <div className="bottom">
        <div className="splitter-h" onMouseDown={startResize} />
        {status === 'ready' ? <Timeline /> : null}
      </div>
      {modal === 'palette' ? <Palette onClose={() => setModal(null)} /> : null}
      {modal === 'themes' ? <ThemeGallery onClose={() => setModal(null)} /> : null}
      {modal === 'export' ? <ExportDialog onClose={() => setModal(null)} /> : null}
      {modal === 'history' ? <HistoryDialog onClose={() => setModal(null)} /> : null}
      {modal === 'present' ? <Present startScene={editor.s.sel.scene} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

function TopBar({ onHome, openModal, onAI, onRecording }) {
  const { doc, save, canUndo, canRedo } = useEditor((s) => ({ doc: s.doc, save: s.save, canUndo: s.canUndo, canRedo: s.canRedo }));
  const [title, setTitle] = useState('');
  useEffect(() => { setTitle(doc?.title || ''); }, [doc?.title]);
  const tb = platform === 'darwin' ? 'mac' : 'win';
  return (
    <div className={`titlebar ${tb}`}>
      <button className="ibtn" title="素材库" onClick={onHome}><Icon name="house" size={16} /></button>
      <div className="brand" style={{ paddingLeft: 2 }}><span className="logo" /></div>
      <input className="title-edit" value={title} size={Math.max(6, Math.min(40, title.length + 2))} onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title.trim() && title !== doc.title) editor.edit([{ op: 'set_title', title: title.trim() }], { message: '重命名' }); else setTitle(doc?.title || ''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTitle(doc.title); e.currentTarget.blur(); } }} />
      <span className={`save-state ${save}`} title={save === 'error' ? '保存失败' : save === 'saving' ? '保存中' : '已保存到素材库'}><span className="dot" />{save === 'saving' ? '保存中' : save === 'error' ? '未保存' : '已保存'}</span>
      <span className="tb-sep" />
      <button className="ibtn" title="撤销 Ctrl+Z" disabled={!canUndo} onClick={() => editor.undo()}><Icon name="undo-2" size={16} /></button>
      <button className="ibtn" title="重做 Ctrl+Y" disabled={!canRedo} onClick={() => editor.redo()}><Icon name="redo-2" size={16} /></button>
      <button className="ibtn" title="版本历史" onClick={() => openModal('history')}><Icon name="clock-arrow-up" size={16} /></button>
      <div className="drag grow" />
      {onRecording ? <button className="btn ghost" onClick={onRecording} title="剪辑录屏：运镜、光标、片段与摄像头"><Icon name="monitor-dot" size={15} />录屏编辑</button> : null}
      <button className="btn ghost" onClick={() => openModal('themes')} title="设计系统"><Icon name="palette" size={15} />{THEMES[doc?.theme.id]?.name?.split(' ')[0] || '主题'}</button>
      <button className="btn ghost" onClick={() => openModal('present')} title="演示 F5"><Icon name="presentation" size={15} />演示</button>
      <button className="btn ai" onClick={onAI}><Icon name="sparkles" size={14} />AI</button>
      <button className="btn primary" onClick={() => openModal('export')}><Icon name="download" size={14} />导出</button>
    </div>
  );
}

function StageBar({ zoom, setZoom, openModal }) {
  const { playing, loop, duration } = useEditor((s) => ({ playing: s.playing, loop: s.loop, duration: s.timing.duration }));
  const [addAnchor, setAddAnchor] = useState(null);
  const selScene = useEditor((s) => s.sel.scene);
  return (
    <div className="stage-bar">
      <button className="btn sm" onClick={() => openModal('palette')} title="添加元素 Ctrl+K"><Icon name="plus" size={13} />元素</button>
      <button className="btn sm ghost" onClick={(e) => setAddAnchor(e.currentTarget)}><Icon name="layout-template" size={13} />场景</button>
      {addAnchor ? <AddScenePopover anchor={addAnchor} after={selScene} placement="bottom-start" onClose={() => setAddAnchor(null)} /> : null}
      <div className="spacer" />
      <div className="transport">
        <button className="ibtn" title="到开头 Home" onClick={() => editor.seek(0)}><Icon name="skip-back" size={15} /></button>
        <button className="ibtn" title="上一场景" onClick={() => stepScene(-1)}><Icon name="chevron-left" size={16} /></button>
        <button className="ibtn on" style={{ width: 34, height: 30 }} title="播放 / 暂停 Space" onClick={() => editor.toggle()}><Icon name={playing ? 'pause' : 'play'} size={16} /></button>
        <button className="ibtn" title="下一场景" onClick={() => stepScene(1)}><Icon name="chevron-right" size={16} /></button>
        <button className={`ibtn ${loop ? 'on' : ''}`} title="循环" onClick={() => editor.set({ loop: !loop })}><Icon name="repeat" size={15} /></button>
        <Timecode duration={duration} />
      </div>
      <div className="spacer" />
      <button className="btn sm ghost" onClick={(e) => openMenu(e, [
        { label: '适应窗口', onClick: () => setZoom('fit') },
        ...[0.25, 0.5, 0.75, 1].map((z) => ({ label: `${z * 100}%`, onClick: () => setZoom(z) })),
      ])}><Icon name="zoom-in" size={13} />{zoom === 'fit' ? '适应' : `${Math.round(zoom * 100)}%`}</button>
    </div>
  );
}

function stepScene(d) {
  const list = editor.s.doc?.scenes || [];
  const i = list.findIndex((s) => s.id === editor.s.sel.scene);
  const n = list[Math.max(0, Math.min(list.length - 1, i + d))];
  if (n) { editor.pause(); editor.selectScene(n.id); }
}

function Timecode({ duration }) {
  const t = useEditor((s) => s.time);
  return <span className="timecode">{fmtTime(t)} <span className="tot">/ {fmtTime(duration)}</span></span>;
}
