// Design lint: checks that need layout (overlaps, overflow, density, contrast, rhythm).
// Static schema checks live in core/doc.js validateDocument.
import { plainText } from './text/text.js';
import { contrast } from '../core/util/color.js';

const area = (r) => Math.max(0, r.w) * Math.max(0, r.h);
function overlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function textOf(b) {
  const parts = [];
  const walk = (v, k) => {
    if (v == null || ['id', 'asset', 'src', 'type', 'kind', 'style', 'motion', 'frame', 'data', 'latex', 'expr', 'code'].includes(k)) return;
    if (typeof v === 'string') parts.push(plainText(v));
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (typeof v === 'object') for (const [kk, x] of Object.entries(v)) walk(x, kk);
  };
  walk(b);
  return parts.join(' ');
}

export function lintCompiled(C, assets) {
  const out = [...(C.issues || [])];
  const { env } = C;
  const W = env.W, H = env.H;
  let sameRun = 1;
  C.scenes.forEach((S, i) => {
    const sid = S.id;
    const items = S.items.filter((it) => !it.bleed);
    for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
      const A = items[a], B = items[b];
      const ov = overlap(A.rect, B.rect);
      if (ov > 0.08 * Math.min(area(A.rect), area(B.rect)) && ov > 400) out.push({ level: 'warning', scene: sid, sceneIndex: i, block: B.block.id, message: `块 ${A.block.type}(${A.block.id}) 与 ${B.block.type}(${B.block.id}) 重叠`, hint: '移除手动 frame，或调整位置/尺寸' });
    }
    for (const it of items) {
      const r = it.rect;
      if (r.x < -W * 0.02 || r.y < -H * 0.02 || r.x + r.w > W * 1.02 || r.y + r.h > H * 1.02) out.push({ level: 'warning', scene: sid, sceneIndex: i, block: it.block.id, message: `${it.block.type} 超出画面`, hint: '检查 frame 坐标（0–1 比例）' });
      if (r.h < env.sizes.body * 1.2 && it.block.type !== 'shape') out.push({ level: 'warning', scene: sid, sceneIndex: i, block: it.block.id, message: `${it.block.type} 可用空间过小（${Math.round(r.h)}px 高）`, hint: '减少同场景的内容，或拆分场景' });
    }
    const txt = S.scene.blocks.map(textOf).join(' ');
    const cjk = (txt.match(/[一-鿿]/g) || []).length;
    const words = txt.replace(/[一-鿿]/g, ' ').split(/\s+/).filter(Boolean).length;
    const load = cjk + words * 2;
    if (load > 160) out.push({ level: 'warning', scene: sid, sceneIndex: i, message: `场景文字过多（约 ${cjk} 字 + ${words} 词）`, hint: '视频中每屏建议 ≤ 80 字：精简、拆成要点或分成两个场景' });
    const reading = 1.2 + cjk / 7 + words / 3;
    if (typeof S.scene.duration === 'number' && S.scene.duration < Math.min(reading, 12) * 0.8) out.push({ level: 'warning', scene: sid, sceneIndex: i, message: `场景时长 ${S.scene.duration}s 不足以读完文字（约需 ${reading.toFixed(1)}s）`, hint: '改为 "auto" 或加长' });
    if (i > 0 && S.layout === C.scenes[i - 1].layout && S.layout !== 'cover') { sameRun++; if (sameRun === 3) out.push({ level: 'info', scene: sid, sceneIndex: i, message: `连续 3 个场景都使用 ${S.layout} 版式，节奏略单调`, hint: '穿插 section / quote / full 等版式，或改变 tone' }); }
    else sameRun = 1;
    const p = S.palette;
    if (contrast(p.ink, p.bg) < 4.5) out.push({ level: 'warning', scene: sid, sceneIndex: i, message: `正文颜色与背景对比度不足（${contrast(p.ink, p.bg).toFixed(1)}:1）`, hint: '调整主题覆盖或强调色' });
    for (const it of S.items) {
      const b = it.block;
      const refs = b.type === 'image' ? [b.asset || (b.src ? { src: b.src } : null)] : b.type === 'gallery' ? (b.images || []).map((x) => (typeof x === 'string' ? x : x.asset || { src: x.src })) : [];
      for (const r of refs) if (r && assets?.failed(r)) out.push({ level: 'error', scene: sid, sceneIndex: i, block: b.id, message: `图片无法加载：${typeof r === 'string' ? r : r.src}`, hint: '用 motif assets add 导入文件后引用资源 ID' });
      if ((b.type === 'image' || b.type === 'gallery') && !refs.filter(Boolean).length) out.push({ level: 'warning', scene: sid, sceneIndex: i, block: b.id, message: '图片块没有设置图片', hint: '设置 asset 或 src' });
    }
  });
  if (C.duration > 600) out.push({ level: 'info', message: `总时长 ${(C.duration / 60).toFixed(1)} 分钟，较长`, hint: '短视频建议 15–90 秒，讲解视频 2–6 分钟' });
  return out;
}
