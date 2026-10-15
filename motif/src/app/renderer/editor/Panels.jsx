// Left-rail panels (assets, reusable components) and the history dialog.
import { useEffect, useState } from 'react';
import { editor, useEditor } from './store.js';
import { Icon, TYPE_ICON } from '../icons.jsx';
import { call, fmtBytes, fmtWhen } from '../api.js';
import { Modal, openMenu, toast, confirmDialog, promptDialog, Spinner } from '../ui.jsx';
import { insertAsset } from './Stage.jsx';
import { COMPONENTS } from '../../../core/catalog/components.js';

export function AssetsPanel() {
  const doc = useEditor((s) => s.doc);
  const project = useEditor((s) => s.project);
  const [over, setOver] = useState(false);
  const list = Object.values(doc?.assets || {});
  const used = new Set(JSON.stringify(doc?.scenes || []).match(/ast_[a-z0-9]+/g) || []);
  if (doc?.audio?.music?.asset) used.add(doc.audio.music.asset);
  if (doc?.brand?.logo) used.add(doc.brand.logo);
  const importFiles = async (files) => {
    try {
      const r = await call('assets.import', project.id, files);
      if (r.assets.length) { editor.setDoc(r.doc); editor.set({ rev: r.doc.meta?.revision }); toast.ok(`已导入 ${r.assets.length} 个资源`); }
    } catch (e) { toast.error(e); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const fs = [...e.dataTransfer.files].map((f) => window.motif?.pathOf(f)).filter(Boolean); if (fs.length) importFiles(fs); }}>
      <div className="row" style={{ padding: '10px 10px 0' }}>
        <span className="dim grow" style={{ fontSize: 11.5 }}>{list.length} 个资源 · 拖到画布插入</span>
        <button className="btn sm" onClick={() => importFiles()}><Icon name="upload" size={12} />导入</button>
      </div>
      {list.length ? (
        <div className="assets-grid">
          {list.map((a) => (
            <div key={a.id} className="asset" draggable title={`${a.name}\n${a.kind}${a.width ? ` · ${a.width}×${a.height}` : ''}${a.duration ? ` · ${a.duration.toFixed(1)}s` : ''} · ${fmtBytes(a.size)}`}
              onDragStart={(e) => e.dataTransfer.setData('application/x-motif-asset', a.id)}
              onDoubleClick={() => insertAsset(a)}
              onContextMenu={(e) => openMenu(e, [
                { label: '插入到当前场景', icon: 'plus', onClick: () => insertAsset(a) },
                a.kind === 'image' ? { label: '设为场景背景', icon: 'image', onClick: () => editor.updateScene(editor.s.sel.scene, { background: { type: 'image', asset: a.id, overlay: 0.35 } }, { message: '背景图片' }) } : null,
                a.kind === 'audio' ? { label: '设为背景音乐', icon: 'music', onClick: () => insertAsset(a) } : null,
                '-',
                { label: used.has(a.id) ? '移除（正在使用）' : '移除', icon: 'trash', danger: true, onClick: async () => { if (used.has(a.id) && !(await confirmDialog({ title: '移除资源', message: `「${a.name}」正在被使用，移除后相关元素将显示占位。`, ok: '移除', danger: true }))) return; editor.edit([{ op: 'remove_asset', asset: a.id }], { message: '移除资源' }); } },
              ])}>
              <div className="pv">
                {a.kind === 'image' ? <img src={project.assetBase + a.file} loading="lazy" /> : a.kind === 'video' ? <video src={project.assetBase + a.file} muted preload="metadata" /> : <Icon name={a.kind === 'audio' ? 'music' : a.kind === 'model' ? 'boxes' : 'file'} size={26} />}
                {used.has(a.id) ? <span className="badge ok" style={{ position: 'absolute', top: 5, left: 5 }}>使用中</span> : null}
              </div>
              <div className="nm">{a.name}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 10 }}>
          <div className={`drop-zone ${over ? 'over' : ''}`} onClick={() => importFiles()}>
            <div className="col" style={{ alignItems: 'center', gap: 6 }}>
              <Icon name="upload" size={22} />
              <div>拖入图片、视频、音频或 3D 模型</div>
              <div className="dim" style={{ fontSize: 11.5 }}>PNG JPG WebP SVG · MP4 WebM MOV · MP3 WAV · GLB</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComponentsPanel() {
  const [list, setList] = useState(null);
  const load = () => call('components.list').then(setList).catch(() => setList([]));
  useEffect(() => { load(); const f = () => load(); addEventListener('motif:components-changed', f); return () => removeEventListener('motif:components-changed', f); }, []);
  const insert = async (c) => {
    try {
      const full = await call('components.get', c.id);
      if (full.kind === 'scene') editor.addScene(full.data, editor.s.sel.scene);
      else editor.addBlock(full.data);
      toast.ok(`已插入「${c.name}」`);
    } catch (e) { toast.error(e); }
  };
  useEffect(() => {
    const f = (e) => { const c = list?.find((x) => x.id === e.detail.id); if (c) insert(c); };
    addEventListener('motif:insert-component', f);
    return () => removeEventListener('motif:insert-component', f);
  }, [list]);
  if (!list) return <div className="empty"><Spinner /></div>;
  return (
    <div style={{ overflow: 'auto', padding: 10, flex: 1 }}>
      {list.length ? (
        <div className="col" style={{ gap: 6 }}>
          {list.map((c) => (
            <div key={c.id} className="card" style={{ padding: '8px 10px', cursor: 'pointer' }} draggable
              onDragStart={(e) => e.dataTransfer.setData('application/x-motif-component', c.id)}
              onClick={() => insert(c)}
              onContextMenu={(e) => openMenu(e, [
                { label: '插入', icon: 'plus', onClick: () => insert(c) },
                { label: '删除', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog({ title: '删除组件', message: `删除「${c.name}」？已使用它的作品不受影响。`, ok: '删除', danger: true })) { await call('components.delete', c.id); load(); } } },
              ])}>
              <div className="row" style={{ gap: 8 }}>
                <span className="t-ico" style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--bg3)', color: 'var(--acc-hi)' }}><Icon name={c.kind === 'scene' ? 'layout-template' : TYPE_ICON[c.type] || 'component'} size={14} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ color: 'var(--fg0)' }}>{c.name}</div>
                  <div className="dim" style={{ fontSize: 11 }}>{c.kind === 'scene' ? `场景 · ${c.type}` : COMPONENTS[c.type]?.label || c.type}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="ico"><Icon name="component" size={20} /></div>
          <div>还没有保存的组件</div>
          <div className="dim" style={{ fontSize: 11.5 }}>在元素或场景上右键 →「保存为组件」，即可在任何作品中复用；AI 也能通过 CLI / MCP 使用它们。</div>
        </div>
      )}
    </div>
  );
}

export async function saveComponentFlow({ block, scene }) {
  const name = await promptDialog({ title: block ? '保存元素为组件' : '保存场景为组件', label: '组件名称', placeholder: '如：季度增长图表' });
  if (!name) return;
  try {
    await editor.flushNow();
    await call('components.save', { name, project: editor.project.id, block, scene });
    dispatchEvent(new CustomEvent('motif:components-changed'));
    toast.ok(`已保存组件「${name}」`);
  } catch (e) { toast.error(e); }
}

export function HistoryDialog({ onClose }) {
  const project = useEditor((s) => s.project);
  const rev = useEditor((s) => s.rev);
  const [list, setList] = useState(null);
  const load = () => call('history.list', project.id).then(setList).catch((e) => { toast.error(e); setList([]); });
  useEffect(() => { editor.flushNow().then(load); }, [rev]);
  const restore = async (h) => {
    if (!(await confirmDialog({ title: `恢复到修订 ${h.revision}？`, message: '当前状态会保留在历史中，可以随时再恢复回来。', ok: '恢复' }))) return;
    try {
      const doc = await call('history.restore', project.id, h.revision);
      editor.undoStack.push({ doc: editor.s.doc, label: `恢复修订 ${h.revision}` });
      editor.setDoc(doc);
      editor.set({ rev: doc.meta.revision, canUndo: true });
      toast.ok(`已恢复到修订 ${h.revision}`);
    } catch (e) { toast.error(e); }
  };
  const name = async () => {
    const label = await promptDialog({ title: '命名当前版本', label: '版本名称（命名版本永久保留）', placeholder: '如：给客户的初稿' });
    if (!label) return;
    await call('history.name', project.id, label);
    load();
  };
  return (
    <Modal title="版本历史" sub="人与 AI 的每一次修改都会被记录" icon="clock-arrow-up" onClose={onClose} width={560}
      footer={<><button className="btn" onClick={name}><Icon name="bookmark" size={14} />命名当前版本</button><div className="spacer" /><button className="btn primary" onClick={onClose}>关闭</button></>}>
      {!list ? <div className="empty"><Spinner /></div> : (
        <div className="hist" style={{ maxHeight: 480, overflow: 'auto' }}>
          {list.map((h, i) => (
            <div key={h.revision} className={`hist-item ${i === 0 ? 'on' : ''}`} onDoubleClick={() => i > 0 && restore(h)}>
              <span className={`av ${h.author === 'human' ? 'human' : 'ai'}`}><Icon name={h.author === 'human' ? 'user' : 'bot'} size={13} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="msg">{h.named ? <span className="badge acc" style={{ marginRight: 6 }}><Icon name="bookmark" size={10} />{h.named}</span> : null}{h.message || '修改'}</div>
                <div className="when">修订 {h.revision} · {h.author === 'human' ? '你' : h.author === 'ai' ? 'AI' : h.author} · {fmtWhen(h.time)} · {h.scenes} 个场景</div>
              </div>
              {i === 0 ? <span className="badge">当前</span> : <button className="btn sm" onClick={() => restore(h)}>恢复</button>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
