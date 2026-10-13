// Static metadata for this repository and illustrative layout patterns.
import { PUBLIC_REPOS, OWN_PROJECTS, OCW_MATH, OCW_PHYSICS, ACTIVITY, SNAPSHOT_DATE, OCW_TOTALS } from '../data/projects.js';
import { countUp } from '../core/fx.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function repoCard(r, i) {
  return `<article class="repo panel reveal" style="--i:${i}" data-repo="${r.name}">
    <div class="repo-top">
      <p class="repo-name"><a href="${r.url}" target="_blank" rel="noopener">${r.name} ↗</a><span class="tag tag-ok">PUBLIC</span></p>
      <h4 class="repo-title">${esc(r.title)}</h4>
      <p class="repo-blurb">${esc(r.blurb)}</p>
    </div>
    <div class="repo-stats">${r.stats.map(([k, v, u]) => `<div><b><span data-count="${v}">0</span><small>${u}</small></b><span>${k}</span></div>`).join('')}</div>
    <div class="repo-foot mono"><span>${esc(r.tag)}${r.version ? ' · ' + r.version : ''}</span><span data-pushed>最近推送 ${r.pushed}</span>${r.site ? `<a href="${r.site}" target="_blank" rel="noopener">导航网页 ↗</a>` : ''}</div>
  </article>`;
}

function bars() {
  const max = Math.max(...OCW_MATH.map((x) => x[1]), ...OCW_PHYSICS.map((x) => x[1]));
  const col = (title, rows, cls) => `<div><h5>${title}</h5>${rows.map(([n, p], i) => `<div class="bar ${cls}" style="--w:${(p / max).toFixed(3)};--i:${i}"><span>${n}</span><i></i><b>${p}</b></div>`).join('')}</div>`;
  return col(`数学 · ${OCW_TOTALS.mathBooks} 类`, OCW_MATH, '') + col(`物理 · ${OCW_TOTALS.physBooks} 类`, OCW_PHYSICS, 'phys');
}

function spectrum() {
  const repos = Object.keys(ACTIVITY);
  const start = new Date('2026-10-01T00:00:00Z');
  const days = 12;
  const colors = { '周期 A': '#ff5b1f', '周期 B': '#4fe3ff' };
  const W = 960, H = 260, L = 40, B = 40, T = 16;
  const totals = Array.from({ length: days }, (_, d) => {
    const key = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
    return repos.map((r) => ACTIVITY[r][key] || 0);
  });
  const maxSum = Math.max(...totals.map((t) => t.reduce((a, b) => a + b, 0)));
  const bw = (W - L - 10) / days;
  let rects = '';
  totals.forEach((vals, d) => {
    let y = H - B;
    vals.forEach((v, k) => {
      if (!v) return;
      const h = (v / maxSum) * (H - B - T);
      y -= h;
      rects += `<rect x="${(L + d * bw + 4).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 8).toFixed(1)}" height="${h.toFixed(1)}" fill="${colors[repos[k]]}" opacity="0.85"><title>${repos[k]}：${v} 示意值</title></rect>`;
    });
    const sum = vals.reduce((a, b) => a + b, 0);
    if (sum) rects += `<text x="${(L + d * bw + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${sum}</text>`;
    rects += `<text x="${(L + d * bw + bw / 2).toFixed(1)}" y="${H - B + 18}" text-anchor="middle">10-${String(d + 1).padStart(2, '0')}</text>`;
  });
  const legend = repos.map((r, k) => `<g transform="translate(${L + k * 190},${H - 6})"><rect width="10" height="10" y="-9" fill="${colors[r]}"/><text x="16">${r}</text></g>`).join('');
  return `<svg viewBox="0 0 ${W} ${H + 14}" role="img" aria-label="周期叠加示意图"><line x1="${L}" x2="${W - 10}" y1="${H - B}" y2="${H - B}" stroke="rgba(236,232,225,0.2)"/>${rects}${legend}</svg>`;
}

function liveSync() {
 document.getElementById('sync-dot').className = 'sync-dot snap';
 document.getElementById('sync-text').textContent = 'LOCAL · 本仓库项目与示意数据';
 document.getElementById('sync-meta').textContent = SNAPSHOT_DATE;
}

export function initArchive() {
  document.getElementById('repo-grid').innerHTML = PUBLIC_REPOS.map(repoCard).join('');
  document.getElementById('ocw-bars').innerHTML = bars();
  document.getElementById('own-grid').innerHTML = OWN_PROJECTS.map((p, i) => `<article class="own reveal" style="--i:${i}">
      <p class="own-k"><span>${esc(p.kind)}</span><span class="tag ${p.state === '公开' ? 'tag-ok' : 'tag-live'}">${esc(p.state)}</span></p>
      <h4>${esc(p.title)}</h4><p>${esc(p.note)}</p>
      ${p.url ? `<a class="own-link" href="${p.url}" target="_blank" rel="noopener">查看仓库 ↗</a>` : p.anchor ? `<a class="own-link" href="${p.anchor}" data-nav="${p.anchor.slice(1)}">在本站查看 →</a>` : ''}
    </article>`).join('');
  document.getElementById('spectrum').innerHTML = spectrum();
  for (const el of document.querySelectorAll('[data-snapshot]')) el.textContent = SNAPSHOT_DATE;

  // count-ups when they scroll into view
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      countUp(e.target, Number(e.target.dataset.count), { duration: 1800 });
    }
  }, { threshold: 0.6 });
  for (const el of document.querySelectorAll('[data-count]')) io.observe(el);

  let synced = false;
  const sec = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !synced) { synced = true; liveSync(); sec.disconnect(); }
  }, { rootMargin: '400px' });
  sec.observe(document.getElementById('archive'));
}
