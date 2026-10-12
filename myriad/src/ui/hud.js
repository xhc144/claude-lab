// Heads-up display: the top bar (clock, speed, world statistics, actions), the tool palette,
// the overlay picker with its legend, the minimap, toasts, the hover tooltip and the director's
// captions.

import { h, $, esc, rgbCss } from './dom.js';
import { icon } from './icons.js';
import { SPEEDS } from './game.js';
import { CATEGORIES, TOOLS, TOOL } from '../sim/powers.js';
import { OVERLAYS } from '../render/overlay.js';
import { ERAS, IDEAS } from '../sim/civ/data.js';
import { ASPECTS } from '../sim/civ/religion.js';
import { BIOMES, SEASONS, RESOURCES, KM_PER_UNIT } from '../sim/constants.js';
import { year, season, tempAt } from '../sim/state.js';
import { CATS } from '../sim/chronicle.js';
import { fmtNum } from '../core/util.js';
import { ARCHETYPES } from '../sim/life/genome.js';
import { findCreatureAt } from '../sim/life/creatures.js';
import { TIERS } from '../sim/civ/city.js';

const TOOL_ICON = {
  inspect: 'inspect', raise: 'raise', lower: 'lower', flatten: 'flatten', mountain: 'mountain', island: 'island', smooth: 'smooth',
  rain: 'rain', spring: 'spring', drought: 'drought', wet: 'wet', heat: 'heat', cool: 'cool', plant: 'plant', spawn: 'spawn',
  fertility: 'fertility', mutate: 'mutate', cull: 'cull', uplift: 'uplift', chimera: 'chimera', tribe: 'tribe', bless: 'bless',
  inspire: 'inspire', whisper: 'whisper', prophecy: 'prophecy', hero: 'hero', discord: 'discord', peace: 'peace', gold: 'gold',
  lightning: 'lightning', fire: 'fire', meteor: 'meteor', volcano: 'volcano', quake: 'quake', tsunami: 'tsunami', tornado: 'tornado',
  plague: 'plague', locust: 'locust', iceage: 'iceage', comet: 'comet', nuke: 'nuke', monster: 'monster', bubble: 'bubble',
  portal: 'portal', monolith: 'monolith', worldtree: 'worldtree', fog: 'fog', erase: 'erase',
};
const CAT_ICON = { observe: 'inspect', terrain: 'mountain', water: 'rain', life: 'leaf', civ: 'tribe', disaster: 'meteor', wonder: 'portal' };

export function buildHUD(game, ui) {
  const root = game.root;

  // ---- top bar
  const top = h('div#topbar.panel');
  top.innerHTML = `
    <div class="brand"><div class="logo">万象</div><div class="sub">MYRIAD<b id="world-name">—</b></div></div>
    <div class="sep"></div>
    <div class="clock"><div class="year" id="clk-year">0 年</div><div class="era" id="clk-era">—</div></div>
    <div class="speed" id="speed"></div>
    <div class="stats" id="stats"></div>
    <div class="top-actions" id="actions"></div>`;
  root.append(top);
  const speed = $('#speed', top);
  SPEEDS.forEach((s, i) => {
    const b = h('button.sp-btn', { title: i === 0 ? '暂停（空格）' : `速度 ${s.name}（数字键 ${i}）`, dataset: { i } });
    b.innerHTML = i === 0 ? icon('pause', 16) : i === SPEEDS.length - 1 ? icon('fast', 16) : s.name;
    b.addEventListener('click', () => game.setSpeed(i));
    speed.append(b);
  });
  const stepBtn = h('button.sp-btn', { title: '单步前进一个季节（.）' });
  stepBtn.innerHTML = icon('step', 15);
  stepBtn.addEventListener('click', () => { game.setSpeed(0); game.stepOnce(); });
  speed.append(stepBtn);
  const syncSpeed = () => speed.querySelectorAll('.sp-btn[data-i]').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === game.speed));
  game.on('speed', syncSpeed);
  syncSpeed();

  const statDefs = [
    ['species', '物种', () => game.world.speciesAliveCount],
    ['life', '生灵', () => fmtNum(game.world.life.count)],
    ['nations', '国家', () => game.world.nations.filter((n) => n.alive && n.cities.length).length],
    ['pop', '人口', () => fmtNum(game.world.nations.reduce((s, n) => s + (n.alive ? n.stats.pop : 0), 0))],
    ['temp', '气温', () => { const t = game.world.climate.offset; return (t >= 0 ? '+' : '') + t.toFixed(1) + '°'; }],
    ['co2', 'CO₂', () => Math.round(game.world.climate.co2) + ''],
    ['faith', '信徒', () => fmtNum(game.world.religions.reduce((s, r) => s + (r.alive && r.player ? r.followers : 0), 0))],
    ['energy', '神力', () => Math.floor(game.world.divine.energy) + ''],
  ];
  const stats = $('#stats', top);
  for (const [id, k] of statDefs) {
    const c = h('div.chip', { dataset: { id }, title: k }, h('span.k', { text: k }), h('span.v', { text: '—' }));
    if (id === 'energy') c.classList.add('energy');
    c.addEventListener('click', () => ui.side.open(id === 'faith' || id === 'energy' ? 'faith' : id === 'species' || id === 'life' ? 'species' : id === 'nations' ? 'nations' : 'stats'));
    stats.append(c);
  }
  const actions = $('#actions', top);
  const act = (name, title, fn, id) => {
    const b = h('button.ibtn', { title, id });
    b.innerHTML = icon(name, 19);
    b.addEventListener('click', fn);
    actions.append(b);
    return b;
  };
  const dirBtn = act('film', '导演模式：镜头自动追踪重大事件（D）', () => game.setDirector(!game.director), 'btn-director');
  game.on('director', (on) => dirBtn.classList.toggle('on', on));
  act('timeline', '时间线：回到过去，开辟新的历史分支（T）', () => ui.modals.timeline(), 'btn-timeline');
  act('save', '存档 / 读档 / 导出（Ctrl+S）', () => ui.modals.saves(), 'btn-save');
  const codexBtn = act('codex', '万象图鉴（成就）', () => ui.modals.codex(), 'btn-codex');
  game.on('codex', () => { if (!codexBtn.querySelector('.dot')) codexBtn.append(h('span.dot')); });
  const soundBtn = act(game.settings.sound ? 'sound' : 'mute', '声音', () => ui.toggleSound(), 'btn-sound');
  ui.soundBtn = soundBtn;
  act('settings', '设置', () => ui.modals.settings(), 'btn-settings');
  act('help', '帮助（?）', () => ui.modals.help(), 'help-btn');
  act('list', '显示 / 隐藏侧栏（Tab）', () => ui.side.toggle(), 'btn-side');
  act('back', '返回标题画面', () => ui.modals.confirmMenu(), 'btn-menu');

  game.on('ui', () => {
    const w = game.world;
    if (!w) return;
    $('#world-name').textContent = w.name || '';
    $('#clk-year').textContent = `创世 ${year(w).toLocaleString()} 年 · ${SEASONS[season(w)]}`;
    const alive = w.nations.filter((n) => n.alive && n.cities.length);
    const era = alive.reduce((m, n) => Math.max(m, n.era), -1);
    $('#clk-era').textContent = era >= 0 ? `${ERAS[era].name} · ${alive.length} 国` : w.life.count ? '史前 · 万物生长' : '洪荒 · 寂静的世界';
    for (const [id, , fn] of statDefs) {
      const c = stats.querySelector(`[data-id="${id}"]`);
      if (id === 'energy') { c.style.display = w.settings.mode === 'divine' ? '' : 'none'; }
      if (id === 'faith') c.style.display = w.religions.some((r) => r.player) ? '' : 'none';
      c.querySelector('.v').textContent = fn();
      if (id === 'temp') { c.classList.toggle('warm', w.climate.offset > 1); c.classList.toggle('cold', w.climate.offset < -1); }
    }
  });

  // ---- tool bar
  const bar = h('div#toolbar.panel');
  root.append(bar);
  const grid = h('div#toolgrid.panel');
  root.append(grid);
  let openCat = null;
  for (const cat of CATEGORIES) {
    const b = h('button.cat-btn', { dataset: { cat: cat.id }, title: cat.name });
    b.innerHTML = icon(CAT_ICON[cat.id], 22) + `<span>${cat.name.slice(0, 2)}</span>`;
    b.addEventListener('click', () => {
      if (cat.id === 'observe') { game.setTool('inspect'); openCat = null; renderGrid(); return; }
      openCat = openCat === cat.id ? null : cat.id;
      renderGrid();
    });
    bar.append(b);
  }
  bar.append(h('div.tb-gap'));
  const designBtn = h('button.cat-btn', { title: '物种设计器' });
  designBtn.innerHTML = icon('dna', 22) + '<span>设计</span>';
  designBtn.addEventListener('click', () => ui.modals.designer());
  bar.append(designBtn);
  const climBtn = h('button.cat-btn', { title: '全球气候控制' });
  climBtn.innerHTML = icon('sun', 22) + '<span>气候</span>';
  climBtn.addEventListener('click', () => ui.modals.climate());
  bar.append(climBtn);

  function renderGrid() {
    bar.querySelectorAll('.cat-btn[data-cat]').forEach((b) => {
      const tool = TOOL[game.tool];
      b.classList.toggle('on', b.dataset.cat === openCat || (!openCat && tool && tool.cat === b.dataset.cat));
    });
    if (!openCat) { grid.classList.remove('open'); return; }
    const cat = CATEGORIES.find((c) => c.id === openCat);
    const divine = game.world && game.world.settings.mode === 'divine';
    grid.innerHTML = '';
    grid.append(h('div.tg-title', { html: `${cat.name}<small>${divine ? '消耗神力' : '沙盒模式 · 不限神力'}</small>` }));
    const tools = h('div.tools');
    for (const t of TOOLS.filter((x) => x.cat === openCat)) {
      const b = h('button.tool-btn', { title: t.desc, dataset: { tool: t.id } });
      b.innerHTML = icon(TOOL_ICON[t.id] || 'help', 22) + `<span>${t.name}</span>` + (divine && t.cost ? `<span class="cost">${t.cost}${t.mode === 'brush' ? '/秒' : ''}</span>` : '');
      if (game.tool === t.id) b.classList.add('on');
      if (divine && game.world.divine.energy < t.cost) b.classList.add('disabled');
      b.addEventListener('click', () => { game.setTool(t.id); renderGrid(); });
      tools.append(b);
    }
    grid.append(tools);
    const t = TOOL[game.tool];
    if (t && t.cat === openCat) {
      grid.append(h('div.tool-desc', { html: `<b>${esc(t.name)}</b>　${esc(t.desc)}${t.mode === 'pair' ? '<br>（需要依次点击两处）' : ''}` }));
      if (t.mode === 'brush' || t.r) grid.append(slider('范围', 1, 16, 0.5, game.brush.r, (v) => { game.brush.r = v; }));
      if (t.id !== 'inspect') grid.append(slider('强度', 0.05, 1, 0.05, game.brush.strength, (v) => { game.brush.strength = v; }, (v) => Math.round(v * 100) + '%'));
      toolOptions(t, grid);
    } else grid.append(h('div.tool-desc', { text: '选择一个工具。左键使用，右键或中键拖动平移，滚轮缩放。' }));
    grid.classList.add('open');
  }

  function slider(label, min, max, stepv, value, on, fmt = (v) => String(v)) {
    const out = h('output', { text: fmt(value) });
    const input = h('input', { type: 'range', min, max, step: stepv, value });
    input.addEventListener('input', () => { const v = Number(input.value); out.textContent = fmt(v); on(v); });
    return h('div.slider-row', {}, h('span', { text: label }), input, out);
  }

  function toolOptions(t, el) {
    if (t.id === 'spawn') {
      const sel = h('select');
      const opts = [['', '— 选择要投放的物种 —']];
      for (const k in ARCHETYPES) opts.push(['a:' + k, `原型 · ${ARCHETYPES[k].name}`]);
      for (const d of ui.designs) opts.push(['d:' + d.id, `设计 · ${d.name}`]);
      for (const s of (game.world?.species || []).filter((s) => s.extinct === null && s.pop > 0).slice(-40)) opts.push(['s:' + s.id, `复制 · ${s.name}`]);
      for (const [v, l] of opts) sel.append(h('option', { value: v, text: l }));
      sel.value = game.param.spawnKey || '';
      sel.addEventListener('change', () => {
        const v = sel.value;
        game.param.spawnKey = v;
        if (v.startsWith('a:')) { const a = ARCHETYPES[v.slice(2)]; game.param.genes = a.genes; game.param.name = a.name; }
        else if (v.startsWith('d:')) { const d = ui.designs.find((x) => x.id === v.slice(2)); game.param.genes = d.genes; game.param.name = d.name; }
        else if (v.startsWith('s:')) { const s = game.world.species[Number(v.slice(2))]; game.param.genes = Array.from(s.ref); game.param.name = null; }
        else game.param.genes = null;
      });
      const b = h('button.btn.ghost', { html: icon('dna', 15) + '打开物种设计器' });
      b.addEventListener('click', () => ui.modals.designer());
      el.append(h('div.opt-row', {}, h('label', { text: '物种' }), sel, b));
    } else if (t.id === 'whisper') {
      const sel = h('select');
      for (const i of IDEAS) sel.append(h('option', { value: i.id, text: i.name }));
      sel.value = game.param.idea;
      sel.addEventListener('change', () => { game.param.idea = sel.value; });
      el.append(h('div.opt-row', {}, h('label', { text: '低语的观念' }), sel));
    } else if (t.id === 'prophecy') {
      const sel = h('select');
      for (const a of ['wrath', 'mercy', 'mystery', 'creation']) sel.append(h('option', { value: a, text: `${ASPECTS[a].name} —— ${ASPECTS[a].desc}` }));
      sel.value = game.param.aspect;
      sel.addEventListener('change', () => { game.param.aspect = sel.value; });
      const ep = h('input.input', { placeholder: '自定义尊号（可留空）', value: game.param.epithet || '' });
      ep.addEventListener('input', () => { game.param.epithet = ep.value.trim() || null; });
      el.append(h('div.opt-row', {}, h('label', { text: '显现的神性' }), sel, ep));
    } else if (t.id === 'tribe') {
      const sel = h('select');
      sel.append(h('option', { value: '', text: '自动（现有智慧物种，或原人）' }));
      for (const s of (game.world?.species || []).filter((s) => s.extinct === null && s.hab !== 0 && (s.sapient || s.pop > 0)).slice(-60)) sel.append(h('option', { value: s.id, text: `${s.name}${s.sapient ? '（智慧）' : ''}` }));
      sel.value = game.param.species ?? '';
      sel.addEventListener('change', () => { game.param.species = sel.value === '' ? null : Number(sel.value); });
      el.append(h('div.opt-row', {}, h('label', { text: '建立部落的物种' }), sel, h('div.hint', { text: '选择非智慧物种时，它会被直接赋予智慧。' })));
    }
  }
  game.on('tool', renderGrid);
  game.on('world', renderGrid);
  ui.renderToolGrid = renderGrid;
  renderGrid();

  // ---- overlay picker & legend
  const ov = h('div#overlays.panel');
  root.append(ov);
  const legend = h('div#legend.panel');
  root.append(legend);
  OVERLAYS.forEach((o, i) => {
    if (i === 6) ov.append(h('div.ov-sep'));
    const b = h('button.ov-btn', { dataset: { ov: o.id }, text: o.name, title: `叠加层：${o.name}（V 键循环切换）` });
    b.addEventListener('click', () => ui.setOverlay(o.id));
    ov.append(b);
  });
  ui.setOverlay = (id) => {
    game.R.opts.overlay = id;
    ov.querySelectorAll('.ov-btn').forEach((b) => b.classList.toggle('on', b.dataset.ov === id));
    renderLegend(id);
  };
  function renderLegend(id) {
    const grads = {
      temp: ['linear-gradient(90deg,#283ca0,#468ce6,#78d2e6,#f0f0a0,#faa03c,#dc3228)', '−30°C', '0°', '+40°C'],
      rain: ['linear-gradient(90deg,#966e3c,#dcc878,#8cc878,#3ca0c8,#1e46b4)', '干旱', '', '湿润'],
      elev: ['linear-gradient(90deg,#0a1e50,#2864aa,#78be78,#c8be6e,#966e50,#fafafa)', '深海', '海平面', '高山'],
      fert: ['linear-gradient(90deg,#785a3c,#beaa5a,#5aaa46,#1e6e28)', '贫瘠', '', '肥沃'],
      pollution: ['linear-gradient(90deg,rgba(140,120,70,.3),#8c7846,#3c281e)', '轻度', '', '重度（绿色为辐射）'],
    };
    legend.innerHTML = '';
    const w = game.world;
    if (grads[id]) {
      const [g, a, b, c] = grads[id];
      legend.append(h('div', { text: OVERLAYS.find((o) => o.id === id).name }), h('div.grad', { style: { background: g } }), h('div.lrow', { html: `<span>${a}</span><span>${b}</span><span>${c}</span>` }));
    } else if (id === 'era') {
      legend.append(h('div', { text: '各国所处的时代' }));
      ERAS.forEach((e) => legend.append(h('div.li2', { html: `<i class="sw" style="background:${e.color}"></i>${e.name}` })));
    } else if (id === 'religion' && w) {
      legend.append(h('div', { text: '各城市的主流信仰' }));
      for (const r of w.religions.filter((r) => r.alive).sort((a, b) => b.followers - a.followers).slice(0, 8)) legend.append(h('div.li2', { html: `<i class="sw" style="background:${rgbCss(r.color)}"></i>${esc(r.name)}${r.player ? ' ★' : ''}` }));
    } else if (id === 'ideas') {
      legend.append(h('div', { text: '各城市最强势的思潮' }));
      for (const i of IDEAS.filter((i) => game.world && game.world.ideaBorn[i.id]).slice(0, 10)) legend.append(h('div.li2', { html: `<i class="sw" style="background:${i.color}"></i>${i.name}` }));
    } else if (id === 'species' && w) {
      legend.append(h('div', { text: '各地数量最多的物种' }));
      for (const s of w.species.filter((s) => s.extinct === null && s.pop > 0).sort((a, b) => b.pop - a.pop).slice(0, 8)) legend.append(h('div.li2', { html: `<i class="sw" style="background:${rgbCss(s.color)}"></i>${esc(s.name)}` }));
    } else if (id === 'biome') {
      legend.append(h('div', { text: '生物群系' }));
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach((b) => legend.append(h('div.li2', { html: `<i class="sw" style="background:${rgbCss(BIOMES[b].color)}"></i>${BIOMES[b].name}` })));
    }
    legend.classList.toggle('show', !!legend.childElementCount);
  }
  ui.setOverlay('none');

  // ---- minimap
  const mm = h('div#minimap.panel');
  const mmc = h('canvas');
  mm.append(mmc);
  root.append(mm);
  let mmTimer = 0;
  game.on('frame', (dt) => {
    mmTimer -= dt;
    if (mmTimer > 0 || !game.world) return;
    mmTimer = 0.2;
    const r = mmc.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (mmc.width !== Math.round(r.width * dpr)) { mmc.width = Math.round(r.width * dpr); mmc.height = Math.round(r.height * dpr); }
    const ctx = mmc.getContext('2d');
    const w = game.world;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, mmc.width, mmc.height);
    const s = Math.min(mmc.width / w.W, mmc.height / w.H);
    const ox = (mmc.width - w.W * s) / 2, oy = (mmc.height - w.H * s) / 2;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(game.R.terrain.canvas, ox, oy, w.W * s, w.H * s);
    if (w.nations.length) { ctx.globalAlpha = 0.85; ctx.drawImage(game.R.overlay.border, ox, oy, w.W * s, w.H * s); ctx.globalAlpha = 1; }
    const cam = game.R.cam;
    const [x0, y0] = cam.toWorld(0, 0), [x1, y1] = cam.toWorld(cam.vw, cam.vh);
    ctx.strokeStyle = '#f6e2a8';
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeRect(ox + x0 * s, oy + y0 * s, (x1 - x0) * s, (y1 - y0) * s);
    mm._map = { s: s / dpr, ox: ox / dpr, oy: oy / dpr };
  });
  const mmMove = (e) => {
    if (!mm._map || !game.world) return;
    const r = mmc.getBoundingClientRect();
    const { s, ox, oy } = mm._map;
    game.R.cam.x = (e.clientX - r.left - ox) / s;
    game.R.cam.y = (e.clientY - r.top - oy) / s;
    game.R.cam.anim = null;
    game.R.cam.follow = null;
  };
  let mmDown = false;
  mmc.addEventListener('pointerdown', (e) => { mmDown = true; mmc.setPointerCapture(e.pointerId); mmMove(e); });
  mmc.addEventListener('pointermove', (e) => { if (mmDown) mmMove(e); });
  mmc.addEventListener('pointerup', () => { mmDown = false; });

  // ---- toasts
  const toasts = h('div#toasts');
  root.append(toasts);
  game.on('toast', (t) => {
    const el = h('div.toast', { html: (t.year != null ? `<span class="yr">${t.year} 年</span>` : '') + esc(t.text) });
    el.style.setProperty('--c', t.ach ? '#b59cff' : (CATS[t.cat] || {}).color || '#e8c878');
    if (t.imp >= 3) el.classList.add('imp3');
    if (t.ach) el.classList.add('ach');
    if (t.x != null) el.addEventListener('click', () => game.flyTo(t.x + 0.5, t.y + 0.5));
    toasts.append(el);
    while (toasts.childElementCount > 5) toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, t.quick ? 2600 : t.imp >= 3 ? 9000 : 6000);
  });

  // ---- hover tooltip
  const tip = h('div#tip.panel');
  root.append(tip);
  let tipT = 0;
  game.on('hover', (p) => {
    if (!p || !game.world) { tip.style.display = 'none'; return; }
    const now = performance.now();
    if (now - tipT < 60) return;
    tipT = now;
    const html = describeAt(game, p.x, p.y);
    if (!html) { tip.style.display = 'none'; return; }
    tip.innerHTML = html;
    tip.style.display = 'block';
    const r = game.root.getBoundingClientRect();
    let x = p.sx + 16, y = p.sy + 16;
    if (x + 270 > r.width) x = p.sx - 270;
    if (y + 120 > r.height) y = p.sy - 120;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });

  // ---- director captions
  const cap = h('div#caption');
  root.append(cap);
  game.on('caption', (c) => {
    if (!c) { cap.classList.remove('show'); return; }
    cap.innerHTML = `<small>${c.year} 年 · ${(CATS[c.cat] || {}).name || ''}</small>${esc(c.text)}`;
    cap.classList.add('show');
  });
  game.on('director', (on) => { if (!on) cap.classList.remove('show'); });
}

/** tooltip text for a world position */
export function describeAt(game, x, y) {
  const w = game.world;
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return null;
  const c = Math.floor(y) * w.W + Math.floor(x);
  for (const city of w.cities) {
    if (city.alive && Math.abs(city.x + 0.5 - x) < 0.9 && Math.abs(city.y + 0.5 - y) < 0.9) {
      const n = w.nations[city.nation];
      return `<b>${esc(city.name.z)}</b> <span class="dim">${TIERS[city.tier].name}${city.capital ? ' · 首都' : ''}</span><br>${esc(n.name)}<br>人口 ${fmtNum(city.pop)}`;
    }
  }
  const j = findCreatureAt(w, x, y, Math.max(0.6, 5 / game.R.cam.zoom));
  if (j >= 0) {
    const sp = w.species[w.life.sp[j]];
    return `<b>${esc(sp.name)}</b> <span class="dim">${esc(sp.latin)}</span><br>种群 ${sp.pop}`;
  }
  const h0 = w.elev[c] - w.seaLevel;
  const water = h0 < 0 || w.lake[c] > 0;
  const T = tempAt(w, c);
  let s = `<b>${BIOMES[w.biome[c]].name}</b> <span class="dim">${water ? '水深' : '海拔'} ${Math.round(Math.abs(h0) * KM_PER_UNIT * 1000)} m</span><br>气温 ${T.toFixed(0)}°C · 降水 ${Math.round(w.rain[c] * 100)}%`;
  if (!water) s += ` · 植被 ${Math.round(w.veg[c] * 100)}%`;
  if (w.flow[c] > 14 && !water) s += '<br>河流';
  if (w.res[c]) s += `<br>资源：${RESOURCES[w.res[c]].name}`;
  if (w.owner[c] >= 0) s += `<br><span class="dim">领土：</span>${esc(w.nations[w.owner[c]].name)}`;
  if (w.fire[c]) s += '<br>🔥 正在燃烧';
  if (w.rad[c] > 0.05) s += '<br>☢ 辐射污染';
  return s;
}
