// Inspector views: everything there is to know about a place, a creature, a city, an army, a
// nation, a species or a religion, with links between them.

import { h, esc, rgbCss } from './dom.js';
import { icon } from './icons.js';
import { flagCanvas } from './flags.js';
import { sparkline } from './charts.js';
import { fmtNum, fmtPct } from '../core/util.js';
import { BIOMES, RESOURCES, IMPROVEMENTS, KM_PER_UNIT, GENES, GENE_LABELS, NG, TICKS_PER_YEAR } from '../sim/constants.js';
import { tempAt } from '../sim/state.js';
import { ERAS, TECHS, TECH, BUILDING, WONDER, GOVS, IDEA, RULER_TRAITS } from '../sim/civ/data.js';
import { TIERS } from '../sim/civ/city.js';
import { ASPECTS, PRAYER_NAMES } from '../sim/civ/religion.js';
import { fullName, ageOf, roleName } from '../sim/civ/people.js';
import { describeTraits } from '../sim/life/species.js';
import { effectiveCost } from '../sim/civ/tech.js';
import { FORM_CHAR } from '../sim/life/genome.js';

const yearOfTick = (w, t) => w.startYear + Math.floor(t / TICKS_PER_YEAR);
const kv = (pairs) => h('div.kv', { html: pairs.filter(Boolean).map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('') });
const bar = (v, color) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v * 100))}%;${color ? `background:${color}` : ''}"></i></div>`;
const h3 = (t) => h('div.h3', { text: t });

function link(game, text, sel) {
  const a = h('a.link', { text });
  a.addEventListener('click', () => game.select(sel, true));
  return a;
}

function buttons(...items) {
  const row = h('div.row-btns');
  for (const [label, ic, fn] of items) {
    const b = h('button.btn.ghost', { html: (ic ? icon(ic, 14) : '') + esc(label) });
    b.addEventListener('click', fn);
    row.append(b);
  }
  return row;
}

export function inspector(game, sel) {
  const w = game.world;
  if (!sel) return h('div.empty', { html: `${icon('inspect', 34)}<br>点击地图上的任何东西查看详情：<br>地块、生物、城市、军队……<br><br><span style="color:var(--dim)">提示：右键拖动平移，滚轮缩放</span>` });
  switch (sel.type) {
    case 'cell': return cellView(game, sel.x, sel.y);
    case 'creature': return creatureView(game, sel);
    case 'city': return cityView(game, w.cities[sel.id]);
    case 'army': return armyView(game, w.armies.find((a) => a.id === sel.id));
    case 'nation': return nationView(game, w.nations[sel.id]);
    case 'species': return speciesView(game, w.species[sel.id]);
    case 'religion': return religionView(game, w.religions[sel.id]);
    case 'person': return personView(game, w.persons[sel.id]);
    default: return h('div.empty', { text: '—' });
  }
}

function cellView(game, x, y) {
  const w = game.world;
  const c = y * w.W + x;
  const hgt = w.elev[c] - w.seaLevel;
  const water = hgt < 0 || w.lake[c] > 0;
  const el = h('div');
  el.append(h('div.h2', { text: BIOMES[w.biome[c]].name }), h('div.sub', { text: `坐标 (${x}, ${y})` }));
  el.append(kv([
    [water ? '水深' : '海拔', `${Math.round(Math.abs(hgt) * KM_PER_UNIT * 1000)} m`],
    ['此刻气温', `${tempAt(w, c).toFixed(1)} °C`],
    ['年均气温', `${(w.baseTemp[c] + w.climate.offset).toFixed(1)} °C`],
    ['降水', fmtPct(w.rain[c])],
    [water ? '浮游生物' : '植被', fmtPct(w.veg[c])],
    !water && ['土壤肥力', fmtPct(w.fert[c])],
    !water && w.flow[c] > 14 && ['河流流量', fmtNum(w.flow[c])],
    w.res[c] && ['资源', RESOURCES[w.res[c]].name],
    w.impr[c] && ['地上', IMPROVEMENTS[w.impr[c]]],
    w.road[c] && ['道路', ['', '土路', '铁路', '公路'][w.road[c]]],
    w.pollution[c] > 0.02 && ['污染', fmtPct(w.pollution[c])],
    w.rad[c] > 0.02 && ['辐射', fmtPct(w.rad[c])],
    w.fire[c] && ['状态', '正在燃烧'],
    w.flood[c] > 0.0003 && ['积水', `${Math.round(w.flood[c] * KM_PER_UNIT * 1000)} m`],
  ]));
  if (w.owner[c] >= 0) {
    el.append(h3('归属'));
    const n = w.nations[w.owner[c]];
    const p = h('div', {}, link(game, n.name, { type: 'nation', id: n.id }));
    if (w.ownerCity[c] >= 0) p.append(' · ', link(game, w.cities[w.ownerCity[c]].name.z, { type: 'city', id: w.ownerCity[c] }));
    el.append(p);
  }
  const ruin = w.ruins.find((r) => r.x === x && r.y === y);
  if (ruin) {
    el.append(h3('遗迹'));
    el.append(h('div', { text: `${ruin.name}：${ruin.nation}的城市，${ruin.year} 年${ruin.cause}。${ruin.discovered ? '已被发掘。' : '尚未被发现。'}` }));
  }
  return el;
}

function geneBars(g, off = 0) {
  const box = h('div');
  for (let k = 0; k < NG; k++) {
    const v = g[off + k];
    box.append(h('div.gene-row', { html: `<span>${GENE_LABELS[GENES[k]]}</span><div class="gbar"><i style="width:${v * 100}%"></i></div><span>${v.toFixed(2)}</span>` }));
  }
  return box;
}

function creatureView(game, sel) {
  const w = game.world;
  const L = w.life;
  const i = game.findCreatureSlot(sel);
  if (i < 0) return h('div.empty', { text: '这只生物已经死去。' });
  const sp = w.species[L.sp[i]];
  const el = h('div');
  const title = h('div.h2', {}, h('span.swatch', { style: { background: rgbCss(sp.color) } }), sp.name);
  el.append(title, h('div.sub', { text: `${sp.latin} · 个体 #${L.uid[i]}` }));
  const tr = describeTraits(sp);
  const box = kv([
    ['年龄', `${(L.age[i] / TICKS_PER_YEAR).toFixed(1)} / ${(L.pMaxAge[i] / TICKS_PER_YEAR).toFixed(0)} 年`],
    ['能量', `${Math.round((L.energy[i] / L.pEmax[i]) * 100)}%` + bar(L.energy[i] / L.pEmax[i], '#92d46e')],
    ['体型', L.pSize[i].toFixed(2)],
    ['速度', `${L.pSpeed[i].toFixed(2)} 格/季`],
    ['食性', tr.diet],
    ['栖息', tr.hab],
    ['适宜温度', `${L.pTopt[i].toFixed(0)}°C ± ${L.pTol[i].toFixed(0)}`],
    ['智力', L.pIntel[i].toFixed(2)],
    ['群居', L.pSocial[i].toFixed(2)],
  ]);
  el.append(box);
  el.append(h3('基因组'), geneBars(L.gen, i * NG));
  el.append(buttons(
    ['跟随', 'target', () => game.follow(sel)],
    ['查看物种', 'leaf', () => game.select({ type: 'species', id: sp.id })],
  ));
  return el;
}

function cityView(game, c) {
  const w = game.world;
  if (!c) return h('div.empty', { text: '—' });
  const n = w.nations[c.nation];
  const el = h('div');
  const title = h('div.h2', {}, flagCanvas(n.flag, 26, 17), c.name.z);
  el.append(title);
  el.append(h('div.sub', { html: `${esc(c.name.r)} · ${TIERS[c.tier].name}${c.capital ? ' · 首都' : ''}${c.alive ? '' : ' · 已毁灭'}` }));
  const nat = h('div', {}, link(game, n.name, { type: 'nation', id: n.id }));
  if (c.origNation !== c.nation && w.nations[c.origNation]) nat.append(h('span', { style: { color: 'var(--dim2)' }, text: `（原属${w.nations[c.origNation].name}）` }));
  el.append(nat);
  el.append(kv([
    ['人口', fmtNum(c.pop)],
    ['承载力', fmtNum(c.K)],
    ['建立于', `${yearOfTick(w, c.founded)} 年`],
    ['土地', `${c.cells} 格 · 粮食潜力 ${c.food.toFixed(1)}`],
    ['产能', c.yields.prod.toFixed(1)],
    ['财富', c.yields.wealth.toFixed(1)],
    ['科研', c.yields.sci.toFixed(1)],
    ['文化', `${c.yields.culture.toFixed(1)}（累计 ${fmtNum(c.culture)}）`],
    ['信仰', c.yields.faith.toFixed(1)],
    ['城防', `${Math.round(c.defense)} / ${Math.round(c.maxDefense || 0)}` + bar(c.defense / Math.max(1, c.maxDefense || 1), '#7fd3e6')],
    ['民怨', fmtPct(c.unrest) + bar(c.unrest, '#ec6f5e')],
    c.disease > 0.02 && ['疫病', `${c.plague || '疫病'} ${fmtPct(c.disease)}`],
    ['商路', `${c.routes || 0} 条`],
    c.starving > 0 && ['状态', '<span style="color:#ffb3a8">饥荒</span>'],
    c.blessed > 0 && ['神恩', '受到赐福'],
    c.inspired > 0 && ['启迪', '灵感迸发'],
  ]));
  if (c.prayer) {
    el.append(h3('祈祷'));
    el.append(h('div', { html: `<span class="tag gold">${PRAYER_NAMES[c.prayer.need]}</span> 信徒们正在向「${esc(w.religions[c.prayer.rel]?.epithet || '神')}」祈祷，还剩约 ${Math.max(0, Math.round((c.prayer.until - w.tick) / 4))} 年。` }));
  }
  el.append(h3('建筑'));
  const b = h('div');
  for (const id of c.buildings) b.append(h('span.tag', { text: BUILDING[id].name, title: BUILDING[id].desc }));
  for (const id of c.wonders) b.append(h('span.tag.gold', { text: '★ ' + WONDER[id].name, title: WONDER[id].desc }));
  if (!c.buildings.length && !c.wonders.length) b.append(h('span', { style: { color: 'var(--dim2)' }, text: '尚无建筑' }));
  el.append(b);
  if (c.build) {
    const item = c.build.wonder ? WONDER[c.build.id] : BUILDING[c.build.id];
    el.append(h('div', { style: { marginTop: '6px', fontSize: '12px', color: 'var(--dim)' }, html: `正在建造：${c.build.wonder ? '奇观 ' : ''}${esc(item.name)} ${bar(c.build.prog / c.build.cost)}` }));
  }
  const rel = Object.entries(c.religion).sort((a, b) => b[1] - a[1]);
  if (rel.length) {
    el.append(h3('信仰'));
    for (const [rid, share] of rel) {
      const r = w.religions[rid];
      const row = h('div', { style: { fontSize: '12px', marginBottom: '4px' } });
      row.append(link(game, r.name + (r.player ? ' ★' : ''), { type: 'religion', id: r.id }), ` ${fmtPct(share)}`);
      row.insertAdjacentHTML('beforeend', bar(share, rgbCss(r.color)));
      el.append(row);
    }
  }
  const ideas = Object.entries(c.ideas).sort((a, b) => b[1] - a[1]);
  if (ideas.length) {
    el.append(h3('思潮'));
    const box = h('div');
    for (const [id, s] of ideas) box.append(h('span.tag', { text: `${IDEA[id].name} ${Math.round(s * 100)}`, style: { borderColor: IDEA[id].color } }));
    el.append(box);
  }
  el.append(buttons(
    ['跟随', 'target', () => game.follow({ type: 'city', id: c.id })],
    ['国家', 'flag', () => game.select({ type: 'nation', id: n.id })],
  ));
  return el;
}

function armyView(game, a) {
  const w = game.world;
  if (!a || !a.alive) return h('div.empty', { text: '这支军队已经不复存在。' });
  const n = w.nations[a.nation];
  const el = h('div');
  el.append(h('div.h2', {}, flagCanvas(n.flag, 26, 17), a.naval ? '舰队' : '军团'), h('div', {}, link(game, n.name, { type: 'nation', id: n.id })));
  const target = a.target >= 0 ? w.cities[a.target] : null;
  const gen = a.general != null ? w.persons[a.general] : null;
  el.append(kv([
    ['兵力', `${fmtNum(a.str)} / ${fmtNum(a.max)}` + bar(a.str / a.max, '#ec6f5e')],
    ['战力系数', a.q.toFixed(2)],
    ['士气', fmtPct(a.morale) + bar(a.morale, '#e8c878')],
    ['统帅', gen ? esc(fullName(gen)) : '无名将领'],
    ['状态', a.battle ? '交战中' : a.state === 'return' ? '返回' : target ? `进军 ${esc(target.name.z)}` : '待命'],
    ['战果', `歼敌 ${fmtNum(a.kills)}`],
  ]));
  el.append(buttons(['跟随', 'target', () => game.follow({ type: 'army', id: a.id })]));
  return el;
}

const VALUE_LABELS = [['trad', '革新', '传统'], ['coll', '个人', '集体'], ['piety', '世俗', '虔诚'], ['mil', '和平', '尚武'], ['open', '排外', '开放']];

function valueBar(v) {
  const x = (v + 1) / 2;
  return `<div class="bar" style="position:relative;background:linear-gradient(90deg,rgba(127,211,230,.25),rgba(255,255,255,.06),rgba(232,200,120,.25))"><i style="position:absolute;left:calc(${x * 100}% - 3px);width:6px;background:#fff;border-radius:3px"></i></div>`;
}

function nationView(game, n) {
  const w = game.world;
  if (!n) return h('div.empty', { text: '—' });
  const el = h('div');
  el.append(h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '6px' } }, flagCanvas(n.flag, 54, 36), h('div', {}, h('div.h2', { text: n.name }), h('div.sub', { style: { margin: 0 }, text: `${n.root.r} · ${GOVS[n.gov].name}${n.alive ? '' : ' · 已灭亡'}` }))));
  const sp = n.species != null ? w.species[n.species] : null;
  const cap = w.cities[n.capital];
  const ldr = w.persons[n.leader];
  const age = Math.round(((n.fell ?? w.tick) - n.founded) / TICKS_PER_YEAR);
  const pairs = [
    ['时代', `<span style="color:${ERAS[n.era].color}">${ERAS[n.era].name}</span>`],
    ['立国', `${yearOfTick(w, n.founded)} 年（${age} 年）`],
    ['人口', fmtNum(n.stats.pop)],
    ['城市', `${n.cities.length}（峰值 ${n.peakCities}）`],
    ['领土', `${n.stats.cells} 格`],
    ['国库', fmtNum(n.treasury)],
    ['稳定', fmtPct(n.stability) + bar(n.stability, '#92d46e')],
    ['厌战', fmtPct(Math.min(1, n.weariness)) + bar(Math.min(1, n.weariness), '#ec6f5e')],
  ];
  el.append(kv(pairs));
  const links = h('div', { style: { fontSize: '12px', marginTop: '8px', lineHeight: '1.9' } });
  if (sp) links.append('种族：', link(game, sp.name, { type: 'species', id: sp.id }), '　');
  if (cap) links.append('首都：', link(game, cap.name.z, { type: 'city', id: cap.id }));
  if (n.parent != null && w.nations[n.parent]) links.append(h('br'), '源自：', link(game, w.nations[n.parent].name, { type: 'nation', id: n.parent }));
  if (n.religion != null && w.religions[n.religion]) links.append(h('br'), '国教：', link(game, w.religions[n.religion].name + (w.religions[n.religion].player ? ' ★' : ''), { type: 'religion', id: n.religion }));
  if (n.domestic != null) links.append(h('br'), '驯化：', link(game, w.species[n.domestic].name, { type: 'species', id: n.domestic }));
  el.append(links);
  if (ldr) {
    el.append(h3('统治者'));
    const traits = (ldr.traits || []).map((t) => `<span class="tag" title="${esc(RULER_TRAITS[t].desc)}">${RULER_TRAITS[t].name}</span>`).join('');
    el.append(h('div', { html: `${esc(ldr.title || '领袖')} <b>${esc(fullName(ldr))}</b>，${ageOf(w, ldr)} 岁，在位 ${Math.round((w.tick - ldr.start) / 4)} 年<br>${traits}` }));
  }
  // research
  el.append(h3('科技'));
  if (n.research) {
    const t = TECH[n.research];
    const cost = effectiveCost(w, n, t);
    el.append(h('div', { style: { fontSize: '12px' }, html: `正在研究「${t.name}」 ${Math.round((n.researchPts / cost) * 100)}%${bar(n.researchPts / cost, '#7fd3e6')}` }));
  }
  const tb = h('div', { style: { marginTop: '6px' } });
  for (const t of TECHS) if (n.techs[t.i]) tb.append(h('span.tag', { text: t.name, title: t.desc, style: { borderColor: ERAS[t.era].color + '88' } }));
  el.append(tb);
  // values
  el.append(h3('文化价值观'));
  for (const [k, a, b] of VALUE_LABELS) el.append(h('div', { style: { display: 'grid', gridTemplateColumns: '34px 1fr 34px', gap: '6px', alignItems: 'center', fontSize: '11px', color: 'var(--dim)' }, html: `<span>${a}</span>${valueBar(n.values[k])}<span style="text-align:right">${b}</span>` }));
  const ideas = Object.keys(n.ideas);
  if (ideas.length) {
    const box = h('div', { style: { marginTop: '6px' } });
    for (const id of ideas) box.append(h('span.tag', { text: IDEA[id].name }));
    el.append(box);
  }
  // how they see the player
  const d = n.divine;
  const tot = d.wrath + d.mercy + d.mystery + d.creation;
  if (tot > 0.05) {
    el.append(h3('他们眼中的你'));
    for (const a of ['wrath', 'mercy', 'mystery', 'creation']) {
      el.append(h('div', { style: { display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: '6px', alignItems: 'center', fontSize: '11px', color: 'var(--dim)' }, html: `<span>${ASPECTS[a].name}</span>${bar(d[a] / Math.max(1, tot), rgbCss(ASPECTS[a].color))}<span style="text-align:right">${d[a].toFixed(1)}</span>` }));
    }
    el.append(h('div', { style: { fontSize: '11px', color: 'var(--dim2)', marginTop: '4px' }, text: '你在他们附近的每一次作为都被记作征兆。印象足够深时，他们会为你命名、为你立教。' }));
  }
  // relations
  const rels = Object.entries(n.rel).filter(([k, r]) => r.contact && w.nations[k].alive).sort((a, b) => (a[1].state === 'war' ? -1 : 0) - (b[1].state === 'war' ? -1 : 0) || b[1].op - a[1].op);
  if (rels.length) {
    el.append(h3('外交'));
    const list = h('div.list');
    for (const [k, r] of rels.slice(0, 14)) {
      const m = w.nations[k];
      const st = r.state === 'war' ? '<span class="tag red">战争</span>' : r.state === 'alliance' ? '<span class="tag green">同盟</span>' : w.tick < r.truce ? '<span class="tag">停战</span>' : '';
      const li = h('div.li', { html: `<span></span><div><div class="nm">${esc(m.name)}</div><div class="meta">好感 ${Math.round(r.op)}${r.trade > 0 ? ' · 贸易' : ''}</div></div><div class="num">${st}</div>` });
      li.firstChild.replaceWith(flagCanvas(m.flag, 22, 15));
      li.addEventListener('click', () => game.select({ type: 'nation', id: m.id }));
      list.append(li);
    }
    el.append(list);
  }
  if (n.hist.length > 2) {
    el.append(h3('人口变迁'));
    const cv = h('canvas.chart', { style: { height: '40px' } });
    el.append(cv);
    requestAnimationFrame(() => sparkline(cv, n.hist.map((x) => x[1]), rgbCss(n.color)));
  }
  // notable people
  const people = w.persons.filter((p) => p && !p.gone && p.nation === n.id && p.role !== 'ruler' && p.deeds && p.deeds.length).slice(-8).reverse();
  if (people.length) {
    el.append(h3('人物'));
    for (const p of people) el.append(h('div', { style: { fontSize: '12px', marginBottom: '3px' }, html: `<span class="tag">${roleName(p.role)}</span>${esc(fullName(p))} —— ${esc(p.deeds.join('，'))}` }));
  }
  el.append(buttons(['定位首都', 'target', () => cap && game.flyTo(cap.x + 0.5, cap.y + 0.5, 6)]));
  return el;
}

function speciesView(game, sp) {
  const w = game.world;
  if (!sp) return h('div.empty', { text: '—' });
  const el = h('div');
  el.append(h('div.h2', {}, h('span.swatch', { style: { background: rgbCss(sp.color) } }), sp.name + (sp.sapient ? ' ★' : '')));
  el.append(h('div.sub', { text: `${sp.latin} · ${FORM_CHAR[sp.form]}形` }));
  const tr = describeTraits(sp);
  el.append(kv([
    ['特征', `${tr.size} · ${tr.diet} · ${tr.hab} · ${tr.climate}`],
    ['种群', sp.extinct === null ? `${sp.pop}（峰值 ${sp.peak}）` : `已灭绝（峰值 ${sp.peak}）`],
    ['出现', `${yearOfTick(w, sp.born)} 年`],
    sp.extinct !== null && ['灭绝', `${yearOfTick(w, sp.extinct)} 年`],
    ['适宜温度', `${tr.topt.toFixed(0)}°C`],
    ['寿命', `约 ${tr.maxAge.toFixed(0)} 年`],
    ['后裔', `${sp.children} 个直系分支`],
    ['累计出生', fmtNum(sp.births)],
  ]));
  const links = h('div', { style: { fontSize: '12px', marginTop: '8px', lineHeight: '1.9' } });
  if (sp.parent >= 0) links.append('祖先：', link(game, w.species[sp.parent].name, { type: 'species', id: sp.parent }), h('br'));
  if (sp.domestic != null && w.nations[sp.domestic]) links.append('被驯化：', link(game, w.nations[sp.domestic].name, { type: 'nation', id: sp.domestic }), h('br'));
  if (sp.nations.length) {
    links.append('建立的文明：');
    for (const id of sp.nations) links.append(link(game, w.nations[id].name + (w.nations[id].alive ? '' : '†'), { type: 'nation', id }), ' ');
  }
  el.append(links);
  if (sp.hist.length > 2) {
    el.append(h3('种群变迁'));
    const cv = h('canvas.chart', { style: { height: '40px' } });
    el.append(cv);
    requestAnimationFrame(() => sparkline(cv, sp.hist.map((x) => x[1]), rgbCss(sp.color)));
  }
  el.append(h3('平均基因组'), geneBars(sp.ref));
  el.append(buttons(
    ['定位', 'target', () => game.flyTo(sp.x, sp.y, 9)],
    ['投放此物种', 'spawn', () => { game.param.genes = Array.from(sp.ref); game.param.name = null; game.param.spawnKey = 's:' + sp.id; game.setTool('spawn'); }],
  ));
  return el;
}

function religionView(game, r) {
  const w = game.world;
  if (!r) return h('div.empty', { text: '—' });
  const A = ASPECTS[r.aspect];
  const el = h('div');
  el.append(h('div.h2', {}, h('span.swatch', { style: { background: rgbCss(r.color) } }), r.name));
  el.append(h('div.sub', { text: r.player ? `崇拜你的宗教 · 尊号「${r.epithet}」` : '人们自己的信仰' }));
  const origin = w.nations[r.origin];
  const holy = r.holyCity != null ? w.cities[r.holyCity] : null;
  el.append(kv([
    ['神名', r.player ? `${esc(r.deity.z)}（${esc(r.deity.r)}）` : esc(r.deity.z)],
    ['神性', `${A.name} —— ${A.desc}`],
    ['创立', `${yearOfTick(w, r.founded)} 年`],
    ['信徒', fmtNum(r.followers)],
    r.player && ['虔诚', fmtPct(r.devotion) + bar(r.devotion, '#b59cff')],
    r.player && ['祈祷', `回应 ${r.prayersAnswered} · 忽视 ${r.prayersIgnored}`],
    !r.alive && ['状态', '已消亡'],
  ]));
  const links = h('div', { style: { fontSize: '12px', marginTop: '8px', lineHeight: '1.9' } });
  if (origin) links.append('发源：', link(game, origin.name, { type: 'nation', id: origin.id }), h('br'));
  if (holy) links.append('圣城：', link(game, holy.name.z, { type: 'city', id: holy.id }), h('br'));
  if (r.parent != null && w.religions[r.parent]) links.append('分裂自：', link(game, w.religions[r.parent].name, { type: 'religion', id: r.parent }), h('br'));
  const states = w.nations.filter((n) => n.alive && n.religion === r.id);
  if (states.length) { links.append('国教：'); for (const n of states) links.append(link(game, n.name, { type: 'nation', id: n.id }), ' '); }
  el.append(links);
  return el;
}

function personView(game, p) {
  const w = game.world;
  if (!p) return h('div.empty', { text: '—' });
  const el = h('div');
  el.append(h('div.h2', { text: fullName(p) }), h('div.sub', { text: roleName(p.role) }));
  el.append(kv([['国家', esc(w.nations[p.nation]?.name || '')], ['事迹', esc((p.deeds || []).join('，') || '—')]]));
  return el;
}

