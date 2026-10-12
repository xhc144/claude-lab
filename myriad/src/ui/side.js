// The side panel: inspector, chronicle, nations (with the histomap), species (with the tree of
// life), faith (the names they gave you, prayers waiting for an answer) and world statistics.

import { h, esc, rgbCss } from './dom.js';
import { icon } from './icons.js';
import { inspector } from './inspect.js';
import { flagCanvas } from './flags.js';
import { lineChart, histomap, phyloTree } from './charts.js';
import { CATS } from '../sim/chronicle.js';
import { ERAS } from '../sim/civ/data.js';
import { ASPECTS, PRAYER_NAMES } from '../sim/civ/religion.js';
import { describeTraits } from '../sim/life/species.js';
import { fmtNum } from '../core/util.js';
import { SERIES } from '../sim/stats.js';

const TABS = [
  { id: 'inspect', name: '详情', icon: 'inspect' },
  { id: 'chronicle', name: '编年史', icon: 'scroll' },
  { id: 'nations', name: '国家', icon: 'flag' },
  { id: 'species', name: '物种', icon: 'leaf' },
  { id: 'faith', name: '信仰', icon: 'temple' },
  { id: 'stats', name: '统计', icon: 'chart' },
];

export function buildSide(game, ui) {
  const side = h('div#side.panel');
  const tabs = h('div.tabs');
  const body = h('div.tab-body');
  side.append(tabs, body);
  game.root.append(side);
  let current = 'inspect';
  const state = { chronCat: 'all', chronMajor: false, showDead: false, showExtinct: false, chronShown: 0, chronVersion: -1 };
  for (const t of TABS) {
    const b = h('button.tab', { dataset: { tab: t.id }, html: icon(t.icon, 17) + t.name });
    b.addEventListener('click', () => open(t.id));
    tabs.append(b);
  }

  function open(id) {
    current = id;
    side.classList.remove('closed');
    tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    render(true);
  }

  function render(force = false) {
    if (!game.world || side.classList.contains('closed')) return;
    const scroll = body.scrollTop;
    switch (current) {
      case 'inspect': body.replaceChildren(inspector(game, game.selection)); break;
      case 'chronicle': renderChronicle(force); return;
      case 'nations': body.replaceChildren(nationsTab()); break;
      case 'species': body.replaceChildren(speciesTab()); break;
      case 'faith': body.replaceChildren(faithTab()); break;
      case 'stats': body.replaceChildren(statsTab()); break;
    }
    if (!force) body.scrollTop = scroll;
  }

  // ---- chronicle
  function renderChronicle(force) {
    const w = game.world;
    if (!force && state.chronVersion === w.chronicleSeq) return;
    state.chronVersion = w.chronicleSeq;
    const box = h('div');
    const filters = h('div.filters');
    const mk = (id, name, color) => {
      const b = h('button.fbtn', { text: name });
      if (color) b.style.borderLeft = `3px solid ${color}`;
      b.classList.toggle('on', state.chronCat === id);
      b.addEventListener('click', () => { state.chronCat = id; renderChronicle(true); });
      filters.append(b);
    };
    mk('all', '全部');
    for (const k in CATS) mk(k, CATS[k].name, CATS[k].color);
    const major = h('button.fbtn', { text: '只看大事' });
    major.classList.toggle('on', state.chronMajor);
    major.addEventListener('click', () => { state.chronMajor = !state.chronMajor; renderChronicle(true); });
    filters.append(major);
    box.append(filters);
    const list = h('div.chron');
    const entries = w.chronicle.filter((e) => (state.chronCat === 'all' || e.cat === state.chronCat) && (!state.chronMajor || e.imp >= 2));
    const shown = entries.slice(-300).reverse();
    for (const e of shown) {
      const row = h('div.ce', { html: `<span class="yr">${e.year}</span><span class="tx">${esc(e.text)}</span>` });
      row.classList.add('imp' + e.imp);
      row.style.setProperty('--c', (CATS[e.cat] || {}).color);
      if (e.x != null) row.addEventListener('click', () => game.flyTo(e.x + 0.5, e.y + 0.5));
      list.append(row);
    }
    if (!shown.length) list.append(h('div.empty', { text: '还没有记载。' }));
    box.append(list);
    const keep = body.scrollTop;
    body.replaceChildren(box);
    body.scrollTop = force ? 0 : keep;
  }

  // ---- nations
  function nationsTab() {
    const w = game.world;
    const box = h('div');
    box.append(h('div.chart-label', { html: '<b>世界史长卷</b><span>各国人口份额随时间的变化</span>' }));
    const cv = h('canvas.chart.tall');
    box.append(cv);
    requestAnimationFrame(() => {
      const hit = histomap(cv, w);
      cv.onclick = (e) => { const r = cv.getBoundingClientRect(); const n = hit(e.clientX - r.left, e.clientY - r.top); if (n) game.select({ type: 'nation', id: n.id }, true); };
    });
    const tog = h('button.fbtn', { text: state.showDead ? '隐藏已灭亡' : '显示已灭亡' });
    tog.addEventListener('click', () => { state.showDead = !state.showDead; render(true); });
    box.append(h('div.filters', {}, tog));
    const list = h('div.list');
    const ns = w.nations.filter((n) => state.showDead || (n.alive && n.cities.length)).sort((a, b) => (b.alive - a.alive) || b.stats.pop - a.stats.pop || b.peakPop - a.peakPop);
    for (const n of ns) {
      const li = h('div.li', { html: `<span></span><div><div class="nm">${esc(n.name)}</div><div class="meta">${ERAS[n.era].name} · ${n.cities.length} 城${n.alive ? '' : ` · 亡于 ${Math.floor((n.fell || 0) / 4)} 年`}</div></div><div class="num">${fmtNum(n.alive ? n.stats.pop : n.peakPop)}</div>` });
      li.firstChild.replaceWith(flagCanvas(n.flag, 24, 16));
      if (!n.alive) li.classList.add('dead');
      li.addEventListener('click', () => game.select({ type: 'nation', id: n.id }, true));
      list.append(li);
    }
    if (!ns.length) list.append(h('div.empty', { html: '这个世界还没有文明。<br>等待某个物种演化出智慧，或使用「文明 → 立族」/「生命 → 点化」。' }));
    box.append(list);
    return box;
  }

  // ---- species
  function speciesTab() {
    const w = game.world;
    const box = h('div');
    box.append(h('div.chart-label', { html: `<b>生命之树</b><span>${w.species.length} 个物种曾经出现</span>` }));
    const wrap = h('div', { style: { maxHeight: '320px', overflowY: 'auto', borderRadius: '8px', background: 'rgba(0,0,0,0.22)' } });
    const cv = h('canvas', { style: { width: '100%', display: 'block' } });
    wrap.append(cv);
    box.append(wrap);
    requestAnimationFrame(() => {
      const sel = game.selection && game.selection.type === 'species' ? game.selection.id : null;
      const t = phyloTree(cv, w, { selected: sel });
      cv.style.height = t.height + 'px';
      cv.onclick = (e) => { const r = cv.getBoundingClientRect(); const s = t.hit(e.clientX - r.left, e.clientY - r.top); if (s) game.select({ type: 'species', id: s.id }, true); };
    });
    const tog = h('button.fbtn', { text: state.showExtinct ? '隐藏已灭绝' : '显示已灭绝' });
    tog.addEventListener('click', () => { state.showExtinct = !state.showExtinct; render(true); });
    box.append(h('div.filters', { style: { marginTop: '10px' } }, tog));
    const list = h('div.list');
    const ss = w.species.filter((s) => (s.extinct === null && (s.pop > 0 || s.sapient)) || (state.showExtinct && s.peak >= 10)).sort((a, b) => (a.extinct === null ? 0 : 1) - (b.extinct === null ? 0 : 1) || b.pop - a.pop || b.peak - a.peak).slice(0, 150);
    for (const s of ss) {
      const tr = describeTraits(s);
      const li = h('div.li', { html: `<span class="swatch" style="background:${rgbCss(s.color)}"></span><div><div class="nm">${s.sapient ? '★ ' : ''}${esc(s.name)}</div><div class="meta">${tr.size}${tr.diet} · ${tr.hab} · ${tr.climate}</div></div><div class="num">${s.extinct === null ? s.pop : '†'}</div>` });
      if (s.extinct !== null) li.classList.add('dead');
      li.addEventListener('click', () => game.select({ type: 'species', id: s.id }, true));
      list.append(li);
    }
    if (!ss.length) list.append(h('div.empty', { html: '这个世界还没有生命。<br>使用「生命 → 造物」投放第一批生灵。' }));
    box.append(list);
    return box;
  }

  // ---- faith
  function faithTab() {
    const w = game.world;
    const box = h('div');
    const mine = w.religions.filter((r) => r.player);
    box.append(h('div.h2', { text: '你的名号' }));
    if (!mine.length) {
      box.append(h('div.sub', { html: '你还没有名字。<br><br>在文明附近施展神力——降下甘霖、劈下雷霆、隆起群山、投放生灵——他们会把这些当作征兆记在心里。当印象足够深刻，就会有人为你命名、为你立教；你的所作所为，决定了他们崇拜的是怎样一位神。<br><br>也可以直接使用「文明 → 神谕」。' }));
    } else {
      const list = h('div.list');
      for (const r of mine.sort((a, b) => b.followers - a.followers)) {
        const n = w.nations[r.origin];
        const li = h('div.li', { html: `<span class="swatch" style="background:${rgbCss(r.color)}"></span><div><div class="nm">「${esc(r.epithet)}」${esc(r.deity.z)}</div><div class="meta">${esc(r.name)} · ${ASPECTS[r.aspect].name} · ${esc(n ? n.adj : '')}${r.alive ? '' : ' · 已消亡'}</div></div><div class="num">${fmtNum(r.followers)}</div>` });
        if (!r.alive) li.classList.add('dead');
        li.addEventListener('click', () => game.select({ type: 'religion', id: r.id }));
        list.append(li);
      }
      box.append(list);
    }
    if (w.settings.mode === 'divine') box.append(h('div.sub', { style: { marginTop: '10px' }, html: `神力 <b style="color:var(--violet)">${Math.floor(w.divine.energy)}</b>，来自信徒的崇拜（${fmtNum(w.divine.worshippers || 0)} 份虔诚）。回应祈祷会得到额外的神力。` }));
    const praying = w.cities.filter((c) => c.alive && c.prayer);
    box.append(h('div.h3', { text: `祈祷（${praying.length}）` }));
    if (!praying.length) box.append(h('div.sub', { text: '没有城市在祈祷。信奉你的城市遭遇饥荒、瘟疫、围城或动乱时会向你求助。' }));
    for (const c of praying) {
      const row = h('div.li', { html: `<span>${icon('temple', 16)}</span><div><div class="nm">${esc(c.name.z)}</div><div class="meta">${PRAYER_NAMES[c.prayer.need]} · 剩余约 ${Math.max(0, Math.round((c.prayer.until - w.tick) / 4))} 年</div></div><div class="num">定位</div>` });
      row.addEventListener('click', () => { game.select({ type: 'city', id: c.id }); game.flyTo(c.x + 0.5, c.y + 0.5, 9); });
      box.append(row);
    }
    box.append(h('div.h3', { text: '世间诸教' }));
    const all = h('div.list');
    for (const r of w.religions.filter((r) => r.alive && r.followers > 0).sort((a, b) => b.followers - a.followers).slice(0, 30)) {
      const li = h('div.li', { html: `<span class="swatch" style="background:${rgbCss(r.color)}"></span><div><div class="nm">${esc(r.name)}${r.player ? ' ★' : ''}</div><div class="meta">${ASPECTS[r.aspect].name}</div></div><div class="num">${fmtNum(r.followers)}</div>` });
      li.addEventListener('click', () => game.select({ type: 'religion', id: r.id }));
      all.append(li);
    }
    box.append(all);
    return box;
  }

  // ---- statistics
  function statsTab() {
    const w = game.world;
    const s = w.series;
    const box = h('div');
    const charts = [
      [['temp', '#ff9a6a']], [['co2', '#c8b090']], [['sea', '#7fc6ff']],
      [['species', '#9fd36b']], [['creatures', '#6fb48a']], [['pop', '#e8c878']],
      [['nations', '#e8a0ff'], ['wars', '#ec6f5e']], [['faith', '#b59cff']],
    ];
    for (const set of charts) {
      const label = set.map(([k, c]) => `<span style="color:${c}">${SERIES[k].name}</span>`).join(' / ');
      const last = set.map(([k]) => fmtNum(s[k][s[k].length - 1] ?? 0) + SERIES[k].unit).join(' / ');
      box.append(h('div.chart-label', { html: `<b>${label}</b><span>${last}</span>` }));
      const cv = h('canvas.chart');
      box.append(cv);
      requestAnimationFrame(() => lineChart(cv, s.t, set.map(([k, c]) => ({ values: s[k], color: c, fill: set.length === 1 })), { zero: set[0][0] === 'temp' || set[0][0] === 'sea', fmt: set[0][0] === 'temp' ? (v) => v.toFixed(1) : undefined }));
    }
    const p = w._prof || {};
    box.append(h('div.h3', { text: '性能' }));
    box.append(h('div', { style: { fontSize: '11px', color: 'var(--dim2)', lineHeight: '1.7' }, text: `模拟 ${Math.round(game.tpsMeasured)} 季/秒 · 帧耗时 ${game.frameMs.toFixed(1)} ms · 生物 ${(p.creatures || 0).toFixed(1)} ms · 文明 ${(p.civ || 0).toFixed(1)} ms · 自然 ${(p.nature || 0).toFixed(1)} ms` }));
    return box;
  }

  let timer = 0;
  game.on('frame', (dt) => {
    timer -= dt;
    if (timer > 0) return;
    timer = current === 'inspect' ? 0.5 : current === 'chronicle' ? 0.7 : 2.5;
    render(false);
  });
  game.on('select', () => { if (current !== 'inspect') open('inspect'); else render(true); });
  game.on('world', () => render(true));

  ui.side = {
    open,
    toggle() { side.classList.toggle('closed'); if (!side.classList.contains('closed')) render(true); },
    get current() { return current; },
  };
  open('chronicle');
}
