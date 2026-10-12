// Dimension n: the paper constellation and the learning route from the public ai-self-study repo.
import { PAPERS, AI_ROUTE } from '../data/projects.js';
import { mulberry32 } from '../core/rng.js';

export function initDimN() {
  const host = document.getElementById('constellation');
  const rand = mulberry32(9);
  const pts = PAPERS.map((p, i) => {
    const a = (i / PAPERS.length) * Math.PI * 2 + 0.3;
    const r = 0.28 + rand() * 0.12;
    return { ...p, x: 50 + Math.cos(a) * r * 100 * 0.95, y: 50 + Math.sin(a) * r * 100 * 0.78 };
  });
  const lines = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length, k = (i + 3) % pts.length;
    lines.push([pts[i], pts[j]]);
    if (i % 2 === 0) lines.push([pts[i], pts[k]]);
  }
  host.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" vector-effect="non-scaling-stroke"/>`).join('')}</svg>` +
    pts.map((p, i) => {
      const s = 8 + Math.sqrt(p.pages) * 2.2;
      return `<div class="star" style="left:${p.x}%;top:${p.y}%;--tw:${(i * 0.37) % 3}s"><i style="width:${s}px;height:${s}px"></i><b>${p.key}</b><span>${p.zh} · ${p.pages} 页</span><div class="star-tip">教材第 ${p.unit} 单元 · ${p.note}</div></div>`;
    }).join('');
  document.getElementById('route').innerHTML = AI_ROUTE.map((r) => `<li>${r}</li>`).join('');
}
