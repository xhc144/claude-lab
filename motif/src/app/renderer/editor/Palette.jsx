// "Add element" palette: every component in the catalog, searchable, insertable by click or drag.
import { useMemo, useState, useEffect } from 'react';
import { Icon, TYPE_ICON } from '../icons.jsx';
import { COMPONENTS, CATEGORY_LABELS } from '../../../core/catalog/components.js';
import { Modal } from '../ui.jsx';
import { editor } from './store.js';
import { blockPreset } from './presets.js';

const ORDER = ['text', 'data', 'diagram', 'media', 'math', '3d'];

export function Palette({ onClose }) {
  const [q, setQ] = useState('');
  const [kb, setKb] = useState(0);
  const groups = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const all = Object.entries(COMPONENTS).filter(([t, c]) => !qq || t.includes(qq) || c.label.includes(qq) || (c.summary || '').toLowerCase().includes(qq) || Object.keys(c.aliases || {}).some((a) => a.includes(qq)));
    return ORDER.map((cat) => [cat, all.filter(([, c]) => c.category === cat)]).filter(([, l]) => l.length);
  }, [q]);
  const flat = groups.flatMap(([, l]) => l.map(([t]) => t));
  useEffect(() => setKb(0), [q]);
  const add = (type) => { editor.addBlock(blockPreset(type)); onClose(); };
  return (
    <Modal title="添加元素" sub="内容由你提供，排版与动画由主题自动完成" icon="plus" onClose={onClose} width={640} bodyStyle={{ padding: 0 }}>
      <div className="palette" style={{ width: '100%' }}>
        <div className="ph">
          <input autoFocus className="input" placeholder="搜索：图表、时间线、公式、3D 地球…" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setKb((k) => Math.min(flat.length - 1, k + 1)); }
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setKb((k) => Math.max(0, k - 1)); }
              if (e.key === 'Enter' && flat[kb]) add(flat[kb]);
            }} />
        </div>
        <div className="pb">
          {groups.map(([cat, list]) => (
            <div key={cat}>
              <div className="cat">{CATEGORY_LABELS[cat] || cat}</div>
              <div className="items">
                {list.map(([t, c]) => (
                  <button key={t} className={`it ${flat[kb] === t ? 'kb' : ''}`} draggable title={c.description}
                    onDragStart={(e) => { e.dataTransfer.setData('application/x-motif-block', t); }}
                    onClick={() => add(t)}>
                    <span className="ic"><Icon name={TYPE_ICON[t] || 'square'} size={15} /></span>
                    <span style={{ minWidth: 0 }}><b>{c.label}</b><span>{c.summary}</span></span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!groups.length ? <div className="empty">没有匹配的组件</div> : null}
        </div>
      </div>
    </Modal>
  );
}
