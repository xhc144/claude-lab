// Theme gallery: every design system rendered live with the person's own current scene.
import { useEffect, useRef, useState } from 'react';
import { Modal, Spinner, openMenu, confirmDialog, toast } from '../ui.jsx';
import { ThemeEditor } from './ThemeEditor.jsx';
import { Icon } from '../icons.jsx';
import { editor, useEditor } from './store.js';
import { call } from '../api.js';
import { MotifEngine } from '../../../engine/index.js';
import { THEMES } from '../../../core/themes/index.js';
import { clone } from '../../../core/util/misc.js';

export function ThemeGallery({ onClose }) {
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.sel);
  const [user, setUser] = useState([]);
  const [cur, setCur] = useState(doc.theme.id);
  const canvases = useRef({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | theme

  const loadUser = () => call('themes.list').then((r) => setUser(r.user || [])).catch(() => {});
  useEffect(() => { loadUser(); }, []);

  const scene = doc.scenes.find((s) => s.id === sel.scene) || doc.scenes[0];
  const ids = [...Object.keys(THEMES), ...user.map((t) => t.id)];

  useEffect(() => {
    let alive = true;
    const eng = new MotifEngine({ resolveUrl: editor.engine.assets.resolveUrl, userThemes: Object.fromEntries(user.map((t) => [t.id, t])) });
    (async () => {
      for (const id of ids) {
        if (!alive) return;
        const c = canvases.current[id];
        if (!c || !scene) continue;
        const d = clone(doc);
        d.theme = { ...d.theme, id };
        d.scenes = [clone(scene)];
        d.style = { ...d.style, progress: false, pageNumbers: false };
        try {
          await eng.setDocument(d, { normalized: true });
          const S = eng.C.scenes[0];
          const W = eng.C.env.W;
          const scale = (c.clientWidth * Math.min(2, devicePixelRatio)) / W;
          c.width = Math.round(W * scale); c.height = Math.round(eng.C.env.H * scale);
          const tm = eng.timing().scenes[0];
          eng.render(tm.settled - S.start, c.getContext('2d'), { scale, solo: S.id, chrome: false, noCamera: true });
        } catch (e) { console.warn('theme preview', id, e); }
        await new Promise((r) => setTimeout(r, 0));
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, scene?.id]);

  const apply = (id) => {
    setCur(id);
    editor.edit([{ op: 'set_theme', theme: id }], { message: `主题：${THEMES[id]?.name || id}` });
  };

  const portrait = doc.format.height > doc.format.width;
  return (
    <Modal title="设计系统" sub="每套主题都包含配色、字体、版式规则、动画语言、转场与镜头。预览为当前场景。" icon="palette" onClose={onClose} width={1040}
      footer={<><span className="dim grow" style={{ fontSize: 12 }}>{loading ? <span className="row"><Spinner size={12} />正在渲染预览…</span> : '切换主题不会改动内容，可随时撤销'}</span><button className="btn" onClick={() => setEditing('new')}><Icon name="plus" size={14} />新建自定义主题</button><button className="btn primary" onClick={onClose}>完成</button></>}>
      <div className="theme-grid" style={portrait ? { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' } : null}>
        {ids.map((id) => {
          const t = THEMES[id] || user.find((u) => u.id === id);
          const base = THEMES[id] || THEMES[t?.extends] || {};
          return (
            <button key={id} className={`theme-card ${cur === id ? 'on' : ''}`} onClick={() => apply(id)}
              onContextMenu={(e) => { if (THEMES[id]) return; openMenu(e, [
                { label: '编辑主题…', icon: 'pen-line', onClick: () => setEditing(user.find((u) => u.id === id)) },
                { label: '删除主题', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog({ title: `删除主题「${t?.name}」？`, message: '使用它的作品会回到基础主题的样式。', ok: '删除', danger: true })) { await call('themes.delete', id); toast.ok('已删除'); loadUser(); } } },
              ]); }}>
              <div className="pv" style={{ aspectRatio: `${doc.format.width} / ${doc.format.height}` }}>
                <canvas ref={(el) => { if (el) canvases.current[id] = el; }} />
                {cur === id ? <span className="badge acc" style={{ position: 'absolute', right: 8, top: 8 }}><Icon name="check" size={11} />当前</span> : null}
              </div>
              <div className="tx">
                <b>{t?.name || id}</b>{!THEMES[id] ? <span className="badge" style={{ marginLeft: 6 }}>自定义</span> : null}
                <div className="dim" style={{ fontSize: 11.5, marginTop: 3, lineHeight: 1.45 }}>{(t?.description || '').slice(0, 52)}</div>
                <div className="sw-row">{(base.palette?.data || []).slice(0, 6).map((c, i) => <i key={i} style={{ background: c }} />)}</div>
              </div>
            </button>
          );
        })}
      </div>
      {editing ? <ThemeEditor initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); setCur(t.id); loadUser(); }} /> : null}
    </Modal>
  );
}
