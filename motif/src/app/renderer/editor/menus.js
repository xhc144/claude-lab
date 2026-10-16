// Context menu definitions shared by the stage, the layer list and the timeline.
import { editor, findBlock } from './store.js';
import { addGuideStep } from './GuideEditor.jsx';

export function blockMenu(id) {
  const fb = findBlock(editor.s.doc, id);
  if (!fb) return [];
  const { block: b, scene: s } = fb;
  const i = s.blocks.indexOf(b);
  return [
    { label: '复制', icon: 'copy', kbd: 'Ctrl+D', onClick: () => editor.duplicateBlock(id) },
    { label: '前移一层', icon: 'arrow-up', disabled: i === s.blocks.length - 1, onClick: () => editor.edit([{ op: 'move_block', block: id, position: i + 2 }], { message: '调整层级' }) },
    { label: '后移一层', icon: 'arrow-down', disabled: i === 0, onClick: () => editor.edit([{ op: 'move_block', block: id, position: i }], { message: '调整层级' }) },
    b.frame ? { label: '恢复自动布局', icon: 'layout-grid', onClick: () => editor.updateBlock(id, { frame: null }, { message: '恢复自动布局' }) } : null,
    '-',
    { label: b.hidden ? '显示' : '隐藏', icon: b.hidden ? 'eye' : 'eye-off', onClick: () => editor.updateBlock(id, { hidden: b.hidden ? null : true }, { message: b.hidden ? '显示' : '隐藏' }) },
    { label: b.locked ? '解锁' : '锁定', icon: b.locked ? 'lock-open' : 'lock', onClick: () => editor.updateBlock(id, { locked: b.locked ? null : true }, { message: b.locked ? '解锁' : '锁定' }) },
    '-',
    { label: '讲解标注：圈出', icon: 'circle', onClick: () => addGuideStep(s.id, { target: id, do: 'circle' }) },
    { label: '讲解标注：下划线', icon: 'underline', onClick: () => addGuideStep(s.id, { target: id, do: 'underline' }) },
    { label: '讲解标注：指向', icon: 'mouse-pointer-2', onClick: () => addGuideStep(s.id, { target: id, do: 'point' }) },
    '-',
    { label: '保存为组件…', icon: 'component', onClick: () => window.dispatchEvent(new CustomEvent('motif:save-component', { detail: { block: id } })) },
    { label: '让 AI 改进这个元素', icon: 'sparkles', onClick: () => window.dispatchEvent(new CustomEvent('motif:open-ai', { detail: { prompt: '帮我改进选中的元素：' } })) },
    '-',
    { label: '删除', icon: 'trash', kbd: 'Del', danger: true, onClick: () => editor.removeBlock(id) },
  ].filter(Boolean);
}
