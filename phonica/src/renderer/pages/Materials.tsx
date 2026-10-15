import { useEffect, useMemo, useState } from 'react';
import type { Material } from '../../shared/types.ts';
import { CATEGORIES } from '../../shared/materials.ts';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import { Modal, Tabs, Empty } from '../components/ui.tsx';
import { IconPlus, IconUpload, IconEdit, IconTrash, IconBook } from '../components/icons.tsx';

export function Materials() {
  const { startPractice, toast } = useApp();
  const [all, setAll] = useState<Material[]>([]);
  const [cat, setCat] = useState('pairs');
  const [edit, setEdit] = useState<Material | null>(null);
  const load = () => api.listMaterials().then(setAll).catch((e) => toast(e.message, 'error'));
  useEffect(() => { void load(); }, []);
  const items = useMemo(() => all.filter((m) => (cat === 'mine' ? !m.builtin : m.builtin && m.category === cat)), [all, cat]);

  const save = async () => {
    if (!edit) return;
    if (!edit.text.trim()) return toast('内容不能为空', 'error');
    await api.saveMaterial({ ...edit, title: edit.title.trim() || edit.text.trim().slice(0, 30), category: 'mine' });
    setEdit(null);
    setCat('mine');
    void load();
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>素材库</h1>
          <p>最小对立词、重音、语调、绕口令与短文，或导入你自己的文章</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={async () => { const r = await api.importMaterial(); if (r) setEdit({ id: '', title: r.title, text: r.text, category: 'mine' }); }}><IconUpload />导入文件</button>
          <button className="btn primary" onClick={() => setEdit({ id: '', title: '', text: '', category: 'mine' })}><IconPlus />新建素材</button>
        </div>
      </div>
      <Tabs value={cat} onChange={setCat} tabs={Object.entries(CATEGORIES).map(([id, label]) => ({ id, label, badge: id === 'mine' ? all.filter((m) => !m.builtin).length || null : null }))} />
      {items.length === 0 ? (
        <Empty icon={<IconBook />}>{cat === 'mine' ? '还没有自己的素材。可以新建、粘贴或导入 txt / md / docx / 字幕文件。' : '暂无内容'}</Empty>
      ) : (
        <div className="mat-grid">
          {items.map((m) => (
            <div key={m.id} className="card mat" onClick={() => startPractice(m.text, m.id, m.title)}>
              <div className="row">
                <h4>{m.title}</h4>
                {m.level && <span className="badge right">{m.level}</span>}
              </div>
              <p>{m.text}</p>
              <div className="row tiny muted">
                <span>{m.text.split(/\s+/).length} 词</span>
                {!m.builtin && (
                  <div className="right row" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    <button className="btn sm ghost icon" onClick={() => setEdit(m)}><IconEdit /></button>
                    <button className="btn sm ghost icon" onClick={async () => { await api.deleteMaterial(m.id); void load(); }}><IconTrash /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? '编辑素材' : '新建素材'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>取消</button><button className="btn primary" onClick={save}>保存</button></>}>
          <div className="col">
            <div className="field"><label>标题</label><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="可留空，自动使用开头文字" /></div>
            <div className="field"><label>英文内容</label><textarea className="input" rows={10} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="粘贴英文单词、句子或文章" /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
