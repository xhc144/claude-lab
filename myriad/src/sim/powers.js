// The player's powers. Every tool reshapes the world through the same simulation the world runs
// on its own — and every act near a people is remembered as an omen (see religion.js), so the way
// you play decides what kind of god they believe in. In "divine" mode the powers cost divine
// energy, which flows from worship; in sandbox mode they are free.

import { clamp } from '../core/util.js';
import { makeNoise2D } from '../core/noise.js';
import { NG, G, IMP, R } from './constants.js';
import { forDisk, markTerrainChanged, pushFx, cellAt } from './state.js';
import { ignite } from './vegetation.js';
import { meteorImpact, earthquake, tsunami, eruptVolcano, pushImpact } from './geology.js';
import { addVolcano } from './worldgen.js';
import { log } from './chronicle.js';
import { seedPopulation, forCreaturesNear, killCreature, findCreatureAt, genomeOf } from './life/creatures.js';
import { createSpecies } from './life/species.js';
import { foundTribe } from './civ/civ.js';
import { recordOmen, answerPrayers, createReligion, ASPECTS, normalize } from './civ/religion.js';
import { grantTech, loseTechs } from './civ/tech.js';
import { makePeace, declareWar } from './civ/diplomacy.js';
import { rel } from './civ/nation.js';
import { createPerson, fullName } from './civ/people.js';
import { infect } from './civ/society.js';
import { IDEA, TECH } from './civ/data.js';
import { spawnTornado, spawnMonster, summonComet } from './entities.js';
import { nukeEffects } from './civ/war.js';
import { destroyCity } from './civ/city.js';

export const CATEGORIES = [
  { id: 'observe', name: '观察' },
  { id: 'terrain', name: '塑地' },
  { id: 'water', name: '水与气候' },
  { id: 'life', name: '生命' },
  { id: 'civ', name: '文明' },
  { id: 'disaster', name: '灾变' },
  { id: 'wonder', name: '奇术' },
];

// mode: 'brush' (held, continuous), 'click' (one shot), 'pick' (choose a target), 'pair' (two clicks)
export const TOOLS = [
  { id: 'inspect', cat: 'observe', name: '查看', mode: 'pick', cost: 0, desc: '点击地块、生物、城市或军队查看详情。拖动平移，滚轮缩放。' },
  { id: 'raise', cat: 'terrain', name: '隆起', mode: 'brush', cost: 1, r: 4, act: 'raise', desc: '抬升地面。持续按住可造出高原与山脉。' },
  { id: 'lower', cat: 'terrain', name: '沉降', mode: 'brush', cost: 1, r: 4, act: 'lower', desc: '压低地面，可开凿海湾与湖泊。' },
  { id: 'flatten', cat: 'terrain', name: '平整', mode: 'brush', cost: 1, r: 4, act: 'raise', desc: '把地面推平到画笔中心的高度。' },
  { id: 'mountain', cat: 'terrain', name: '造山', mode: 'brush', cost: 2, r: 3, act: 'mountain', desc: '拔起陡峭的山峰，改变风向与降雨。' },
  { id: 'island', cat: 'terrain', name: '造岛', mode: 'click', cost: 25, r: 7, act: 'island', desc: '从海中升起一座新岛。' },
  { id: 'smooth', cat: 'terrain', name: '风化', mode: 'brush', cost: 1, r: 4, act: 'raise', desc: '让地形变得平缓圆润。' },
  { id: 'rain', cat: 'water', name: '降雨', mode: 'brush', cost: 1, r: 5, act: 'rain', desc: '降下甘霖：植物生长，火焰熄灭；下得太多会成灾。' },
  { id: 'spring', cat: 'water', name: '泉涌', mode: 'brush', cost: 1, r: 1.5, act: 'spring', desc: '让大地涌出泉水，形成洪流、湖泊。' },
  { id: 'drought', cat: 'water', name: '干旱', mode: 'brush', cost: 1, r: 5, act: 'drought', desc: '让一片土地永久变得更干燥。' },
  { id: 'wet', cat: 'water', name: '润泽', mode: 'brush', cost: 1, r: 5, act: 'rain', desc: '让一片土地永久变得更湿润。' },
  { id: 'heat', cat: 'water', name: '炽热', mode: 'brush', cost: 1, r: 5, act: 'heat', desc: '永久提高局部气温。' },
  { id: 'cool', cat: 'water', name: '酷寒', mode: 'brush', cost: 1, r: 5, act: 'freeze', desc: '永久降低局部气温。' },
  { id: 'plant', cat: 'life', name: '播种', mode: 'brush', cost: 1, r: 4, act: 'plant', desc: '让植被繁茂生长，土壤变得肥沃。' },
  { id: 'spawn', cat: 'life', name: '造物', mode: 'click', cost: 30, r: 3, act: 'spawn', desc: '投放一个物种。可在物种设计器中自定义基因。' },
  { id: 'fertility', cat: 'life', name: '繁衍', mode: 'brush', cost: 1, r: 4, act: 'fertility', desc: '赐予生灵充沛的精力，让它们立刻繁殖。' },
  { id: 'mutate', cat: 'life', name: '突变', mode: 'brush', cost: 2, r: 4, act: 'mutate', desc: '让这片土地带上微弱的辐射：后代的突变大大增加。' },
  { id: 'cull', cat: 'life', name: '灭绝', mode: 'brush', cost: 2, r: 3, act: 'plague', desc: '抹去画笔下的生灵。' },
  { id: 'uplift', cat: 'life', name: '点化', mode: 'pick', cost: 150, act: 'uplift', desc: '点击一只生物：它的物种获得智慧，在此建立部落。' },
  { id: 'chimera', cat: 'life', name: '嫁接', mode: 'pair', cost: 80, act: 'chimera', desc: '依次点击两种生物，融合它们的基因，造出嵌合新物种。' },
  { id: 'tribe', cat: 'civ', name: '立族', mode: 'click', cost: 120, act: 'spawn', desc: '在此安置一个新的部落。' },
  { id: 'bless', cat: 'civ', name: '赐福', mode: 'brush', cost: 3, r: 4, act: 'bless', desc: '城市丰收、安定；回应祈祷。' },
  { id: 'inspire', cat: 'civ', name: '启迪', mode: 'pick', cost: 60, act: 'inspire', desc: '点击城市：五年内科研大增，并可能立刻取得突破。' },
  { id: 'whisper', cat: 'civ', name: '低语', mode: 'pick', cost: 40, act: 'whisper', desc: '向一座城市低语一种观念（在工具选项中选择）。' },
  { id: 'prophecy', cat: 'civ', name: '神谕', mode: 'pick', cost: 100, act: 'prophecy', desc: '点击城市：以你选择的神性，在此创立崇拜你的宗教。' },
  { id: 'hero', cat: 'civ', name: '英雄', mode: 'pick', cost: 80, act: 'hero', desc: '点击城市：一位伟人诞生。' },
  { id: 'discord', cat: 'civ', name: '纷争', mode: 'pair', cost: 60, act: 'discord', desc: '依次点击两国的城市：挑起战争。' },
  { id: 'peace', cat: 'civ', name: '和平', mode: 'pick', cost: 60, act: 'peace', desc: '点击城市：该国与所有敌国立即停战。' },
  { id: 'gold', cat: 'civ', name: '金雨', mode: 'click', cost: 40, r: 3, act: 'gold', desc: '降下黄金：国库充盈，地下出现金矿。' },
  { id: 'lightning', cat: 'disaster', name: '雷霆', mode: 'click', cost: 8, r: 1.2, act: 'lightning', desc: '劈下闪电：起火，击溃军队，回应求援的祈祷。' },
  { id: 'fire', cat: 'disaster', name: '野火', mode: 'brush', cost: 2, r: 3, act: 'fire', desc: '点燃植被。' },
  { id: 'meteor', cat: 'disaster', name: '陨石', mode: 'click', cost: 60, r: 3, act: 'meteor', desc: '召唤陨石。强度越高越大，最大可造成生物大灭绝。' },
  { id: 'volcano', cat: 'disaster', name: '火山', mode: 'click', cost: 70, r: 4, act: 'volcano', desc: '升起一座火山并让它喷发。' },
  { id: 'quake', cat: 'disaster', name: '地震', mode: 'click', cost: 50, r: 6, act: 'quake', desc: '撼动大地，近海强震会引发海啸。' },
  { id: 'tsunami', cat: 'disaster', name: '海啸', mode: 'click', cost: 50, r: 12, act: 'tsunami', desc: '掀起巨浪拍向海岸。' },
  { id: 'tornado', cat: 'disaster', name: '龙卷', mode: 'click', cost: 30, r: 2, act: 'tornado', desc: '召唤游走的龙卷风。' },
  { id: 'plague', cat: 'disaster', name: '瘟疫', mode: 'pick', cost: 60, act: 'plague', desc: '点击城市：降下瘟疫，它会沿商路蔓延。' },
  { id: 'locust', cat: 'disaster', name: '蝗灾', mode: 'click', cost: 30, r: 10, act: 'locust', desc: '蝗群吞噬一大片植被与庄稼。' },
  { id: 'iceage', cat: 'disaster', name: '冰河', mode: 'click', cost: 400, act: 'ice', desc: '开启一场持续两百年的冰期：海平面下降，冰原南侵。' },
  { id: 'comet', cat: 'disaster', name: '末日彗星', mode: 'click', cost: 300, act: 'comet', desc: '召来一颗将在三十年后撞击的彗星。拥有火箭的文明也许能拦截它。' },
  { id: 'nuke', cat: 'disaster', name: '核火', mode: 'click', cost: 250, r: 4, act: 'nuke', desc: '在此处引爆核火。' },
  { id: 'monster', cat: 'disaster', name: '巨兽', mode: 'click', cost: 200, act: 'monster', desc: '唤醒一头追猎城市的巨兽，直到有英雄将它斩杀。' },
  { id: 'bubble', cat: 'wonder', name: '时之泡', mode: 'click', cost: 150, r: 8, act: 'time', desc: '在此处创造一个时间流速四倍的气泡。' },
  { id: 'portal', cat: 'wonder', name: '虚空之门', mode: 'pair', cost: 120, act: 'portal', desc: '依次点击两处，打开一对相连的门。生灵会穿门而过。' },
  { id: 'monolith', cat: 'wonder', name: '回响碑', mode: 'click', cost: 150, r: 10, act: 'monolith', desc: '竖起一座无言的石碑：周围生灵的后代会越来越聪明。' },
  { id: 'worldtree', cat: 'wonder', name: '世界树', mode: 'click', cost: 200, r: 14, act: 'worldtree', desc: '种下世界树：周围风调雨顺，草木繁盛。' },
  { id: 'fog', cat: 'wonder', name: '遗忘之雾', mode: 'pick', cost: 120, act: 'fog', desc: '点击城市：该国遗忘最近的发现，陷入黑暗时代。' },
  { id: 'erase', cat: 'wonder', name: '抹除奇物', mode: 'click', cost: 0, desc: '移除附近的时之泡、虚空之门、回响碑或世界树。' },
];
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

let ridgeNoise = null;

function cityNear(w, x, y, r = 2.5) {
  let best = null, bd = r;
  for (const c of w.cities) {
    if (!c.alive) continue;
    const d = Math.hypot(c.x + 0.5 - x, c.y + 0.5 - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** can the player afford this? returns true in sandbox */
export function canAfford(w, tool, amount = 1) {
  if (w.settings.mode !== 'divine') return true;
  return w.divine.energy >= tool.cost * amount;
}

function spend(w, tool, amount = 1) {
  if (w.settings.mode !== 'divine') return;
  w.divine.energy = Math.max(0, w.divine.energy - tool.cost * amount);
}

/**
 * Apply a tool at world position (x, y).
 * opts: { r, strength (0..1), dt (seconds, for brushes), param (tool-specific), from {x, y} for pair tools }
 * Returns { ok, msg } — msg is shown as a toast.
 */
export function applyTool(w, id, x, y, opts = {}) {
  const tool = TOOL[id];
  if (!tool) return { ok: false };
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return { ok: false };
  const r = opts.r ?? tool.r ?? 3;
  const k = opts.strength ?? 0.5;
  const dt = opts.dt ?? 0.016;
  const amount = tool.mode === 'brush' ? dt * 4 : 1;
  if (!canAfford(w, tool, amount)) return { ok: false, msg: '神力不足' };
  const res = run(w, tool, x, y, r, k, dt, opts) || { ok: true };
  if (res.ok !== false) {
    spend(w, tool, amount);
    w.divine.total = (w.divine.total || 0) + 1;
    if (tool.act) {
      const s = tool.mode === 'brush' ? dt * 1.5 : Math.min(3, 0.6 + tool.cost / 60);
      recordOmen(w, x, y, tool.act, s, r);
      answerPrayers(w, x, y, tool.act, r);
    }
  }
  return res;
}

function run(w, tool, x, y, r, k, dt, opts) {
  const rng = w.rng;
  const id = tool.id;
  const rate = dt * 4; // brushes are tuned per quarter second
  switch (id) {
    case 'inspect': return { ok: false };
    case 'raise': case 'lower': {
      const s = (id === 'raise' ? 1 : -1) * 0.02 * k * rate;
      forDisk(w, x, y, r, (c, xx, yy, d2) => { w.elev[c] = clamp(w.elev[c] + s * (1 - Math.sqrt(d2) / r), -1, 1.4); });
      markTerrainChanged(w);
      return { ok: true };
    }
    case 'flatten': {
      const target = w.elev[cellAt(w, x, y)];
      forDisk(w, x, y, r, (c, xx, yy, d2) => { w.elev[c] += (target - w.elev[c]) * 0.3 * rate * (1 - Math.sqrt(d2) / r); });
      markTerrainChanged(w);
      return { ok: true };
    }
    case 'smooth': {
      const tmp = [];
      forDisk(w, x, y, r, (c, xx, yy) => {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const ax = xx + dx, ay = yy + dy;
          if (ax < 0 || ay < 0 || ax >= w.W || ay >= w.H) continue;
          s += w.elev[ay * w.W + ax]; n++;
        }
        tmp.push([c, s / n]);
      });
      for (const [c, v] of tmp) w.elev[c] += (v - w.elev[c]) * Math.min(1, 0.5 * rate);
      markTerrainChanged(w);
      return { ok: true };
    }
    case 'mountain': {
      ridgeNoise = ridgeNoise || makeNoise2D(w.seed ^ 0x31337);
      forDisk(w, x, y, r, (c, xx, yy, d2) => {
        const f = 1 - Math.sqrt(d2) / r;
        const n = 0.5 + 0.5 * (1 - Math.abs(ridgeNoise(xx * 0.3, yy * 0.3)));
        w.elev[c] = Math.min(1.2, Math.max(w.elev[c], w.seaLevel) + 0.05 * k * rate * f * f * n);
      });
      markTerrainChanged(w);
      return { ok: true };
    }
    case 'island': {
      ridgeNoise = ridgeNoise || makeNoise2D(w.seed ^ 0x31337);
      forDisk(w, x, y, r, (c, xx, yy, d2) => {
        const d = Math.sqrt(d2) / r;
        const n = ridgeNoise(xx * 0.25, yy * 0.25) * 0.35;
        const h = w.seaLevel + (0.06 + 0.12 * k) * (1 - d * d) + n * 0.05 - 0.01;
        if (d + n * 0.4 < 0.95) w.elev[c] = Math.max(w.elev[c], h);
        else if (w.elev[c] < w.seaLevel - 0.03) w.elev[c] = Math.max(w.elev[c], w.seaLevel - 0.03); // shallow shelf
      });
      markTerrainChanged(w);
      pushFx(w, { type: 'shockwave', x, y, r: r * 1.5, color: [200, 240, 255] });
      log(w, 'divine', '海面翻涌，一座新的岛屿从深渊中升起。', { imp: 1, x, y });
      return { ok: true };
    }
    case 'rain': {
      forDisk(w, x, y, r, (c, xx, yy, d2) => {
        const f = 1 - Math.sqrt(d2) / r;
        if (w.elev[c] >= w.seaLevel) w.flood[c] += 0.0007 * k * rate * f;
        w.fire[c] = 0;
        w.veg[c] = Math.min(1, w.veg[c] + 0.02 * rate * f);
      });
      if (rng.chance(0.3)) pushFx(w, { type: 'rain', x, y, r });
      return { ok: true };
    }
    case 'spring': {
      const c = cellAt(w, x, y);
      if (w.elev[c] >= w.seaLevel) w.flood[c] += 0.006 * k * rate;
      return { ok: true };
    }
    case 'drought': case 'wet': {
      const s = id === 'wet' ? 1 : -1;
      forDisk(w, x, y, r, (c, xx, yy, d2) => {
        w.rainMod[c] = clamp(w.rainMod[c] + s * 0.03 * k * rate * (1 - Math.sqrt(d2) / r), -1, 1);
        if (s < 0) { w.flood[c] *= 0.8; w.veg[c] *= 1 - 0.03 * rate; }
      });
      w.dirty.climate = true;
      return { ok: true };
    }
    case 'heat': case 'cool': {
      const s = id === 'heat' ? 1 : -1;
      forDisk(w, x, y, r, (c, xx, yy, d2) => { w.tempMod[c] = clamp(w.tempMod[c] + s * 1.2 * k * rate * (1 - Math.sqrt(d2) / r), -40, 40); });
      w.dirty.climate = true;
      return { ok: true };
    }
    case 'plant': {
      forDisk(w, x, y, r, (c, xx, yy, d2) => {
        const f = 1 - Math.sqrt(d2) / r;
        w.veg[c] = Math.min(1, w.veg[c] + 0.06 * rate * f);
        if (w.elev[c] >= w.seaLevel) w.fert[c] = Math.min(1, w.fert[c] + 0.02 * rate * f);
      });
      return { ok: true };
    }
    case 'spawn': {
      const genes = opts.param && opts.param.genes ? opts.param.genes : null;
      if (!genes) return { ok: false, msg: '请先在物种设计器中选择或设计一个物种' };
      const sp = seedPopulation(w, genes, x, y, Math.round(8 + k * 20), 3, rng, opts.param.name || null);
      sp.designed = true;
      if (sp.pop === 0) return { ok: false, msg: `${sp.name}无法在这里生存（水生 / 陆生不符）` };
      log(w, 'divine', `新的生灵「${sp.name}」被投放到这个世界。`, { imp: 1, x, y });
      pushFx(w, { type: 'sparkle', x, y, color: sp.color });
      return { ok: true, msg: `投放了 ${sp.pop} 只${sp.name}` };
    }
    case 'fertility': {
      const L = w.life;
      forCreaturesNear(w, x, y, r, (j) => { L.energy[j] = L.pEmax[j]; L.cd[j] = 0; });
      return { ok: true };
    }
    case 'mutate': {
      forDisk(w, x, y, r, (c) => { w.rad[c] = Math.min(0.32, w.rad[c] + 0.04 * rate); });
      return { ok: true };
    }
    case 'cull': {
      forCreaturesNear(w, x, y, r, (j) => { if (rng.chance(0.4 * rate + 0.1)) killCreature(w, j, 'disaster'); });
      return { ok: true };
    }
    case 'uplift': {
      const j = findCreatureAt(w, x, y, 2.5);
      if (j < 0) return { ok: false, msg: '这里没有生物' };
      const sp = w.species[w.life.sp[j]];
      if (sp.hab === 0) return { ok: false, msg: '水生生物无法建立陆上文明' };
      sp.sapient = true;
      const L = w.life;
      // the chosen ones become clever
      for (let i = 0; i < L.hi; i++) if (L.alive[i] && L.sp[i] === sp.id) { L.gen[i * NG + G.intellect] = Math.max(L.gen[i * NG + G.intellect], 0.72); L.gen[i * NG + G.social] = Math.max(L.gen[i * NG + G.social], 0.5); }
      sp.ref[G.intellect] = Math.max(sp.ref[G.intellect], 0.72);
      const n = foundTribe(w, sp.id, L.x[j], L.y[j], { text: `你点化了${sp.name}。它们的眼神第一次有了思考的光芒，在此建立了部落。` });
      if (!n) return { ok: false, msg: '附近没有可以定居的土地' };
      pushFx(w, { type: 'revelation', x, y, color: [255, 240, 180] });
      return { ok: true, msg: `${sp.name}获得了智慧：${n.name}诞生` };
    }
    case 'chimera': {
      const from = opts.from;
      if (!from) return { ok: false };
      const a = findCreatureAt(w, from.x, from.y, 2.5), b = findCreatureAt(w, x, y, 2.5);
      if (a < 0 || b < 0) return { ok: false, msg: '两次点击都需要选中生物' };
      const ga = genomeOf(w, a), gb = genomeOf(w, b);
      const spA = w.species[w.life.sp[a]], spB = w.species[w.life.sp[b]];
      if (spA === spB) return { ok: false, msg: '请选择两种不同的生物' };
      const g = new Float32Array(NG);
      for (let i = 0; i < NG; i++) g[i] = clamp((rng.chance(0.5) ? ga[i] : gb[i]) * 0.7 + (ga[i] + gb[i]) * 0.15 + rng.gauss() * 0.04, 0, 1);
      const sp = seedPopulation(w, g, x, y, 14, 3, rng, null, spA.id);
      if (sp.pop === 0) { sp.extinct = w.tick; return { ok: false, msg: '嵌合体无法在这里存活' }; }
      w.flags.chimera = true;
      log(w, 'divine', `${spA.name}与${spB.name}的血脉被融合，诞生了嵌合物种「${sp.name}」。`, { imp: 2, x, y });
      pushFx(w, { type: 'sparkle', x, y, color: sp.color });
      return { ok: true, msg: `嵌合物种「${sp.name}」诞生` };
    }
    case 'tribe': {
      const sapients = w.species.filter((s) => s.sapient && s.hab !== 0);
      let spId = opts.param && opts.param.species != null ? opts.param.species : null;
      if (spId == null) {
        if (sapients.length) spId = rng.pick(sapients).id;
        else {
          const g = new Float32Array([0.42, 0.5, 0.45, 0.6, 0.86, 0.45, 0.6, 0.65, 0.76, 0.72, 0.38, 0.1, 0.1, 0.08, 0.4]);
          const sp = createSpecies(w, g, 0, -1, x, y, rng, '原人');
          sp.sapient = true;
          spId = sp.id;
        }
      }
      const n = foundTribe(w, spId, x, y, { r: 4, text: `一群${w.species[spId].name}在你的指引下来到此地，建立了部落。` });
      if (!n) return { ok: false, msg: '这里无法定居（需要陆地，且离其他城市有一定距离）' };
      return { ok: true, msg: `${n.name}诞生了` };
    }
    case 'bless': {
      let any = false;
      for (const c of w.cities) {
        if (!c.alive || Math.hypot(c.x + 0.5 - x, c.y + 0.5 - y) > r + 1) continue;
        c.blessed = Math.max(c.blessed, 12);
        c.unrest *= 0.7;
        c.disease *= 0.7;
        any = true;
      }
      forDisk(w, x, y, r, (c) => { w.veg[c] = Math.min(1, w.veg[c] + 0.02 * rate); });
      if (rng.chance(0.2)) pushFx(w, { type: 'bless', x, y, r });
      return { ok: true, any };
    }
    case 'inspire': {
      const c = cityNear(w, x, y);
      if (!c) return { ok: false, msg: '请点击一座城市' };
      const n = w.nations[c.nation];
      c.inspired = 20;
      let msg = `${c.name.z}的学者们灵感迸发`;
      if (n.research && rng.chance(0.5)) { const t = TECH[n.research]; grantTech(w, n, t.id, 'divine'); msg += `，「${t.name}」研究成功`; }
      log(w, 'divine', `${msg}。`, { imp: 1, x: c.x, y: c.y, nations: [n.id] });
      pushFx(w, { type: 'revelation', x: c.x + 0.5, y: c.y + 0.5, color: [140, 210, 255] });
      return { ok: true, msg };
    }
    case 'whisper': {
      const c = cityNear(w, x, y);
      if (!c) return { ok: false, msg: '请点击一座城市' };
      const ideaId = (opts.param && opts.param.idea) || 'republic';
      const idea = IDEA[ideaId];
      c.ideas[ideaId] = Math.min(1, (c.ideas[ideaId] || 0) + 0.75);
      w.ideaBorn[ideaId] = w.ideaBorn[ideaId] || { nation: c.nation, tick: w.tick, divine: true };
      log(w, 'divine', `${c.name.z}的人们在梦中听见了低语——「${idea.name}」。`, { imp: 1, x: c.x, y: c.y, nations: [c.nation] });
      pushFx(w, { type: 'whisper', x: c.x + 0.5, y: c.y + 0.5 });
      return { ok: true, msg: `向${c.name.z}低语了「${idea.name}」` };
    }
    case 'prophecy': {
      const c = cityNear(w, x, y);
      if (!c) return { ok: false, msg: '请点击一座城市' };
      const n = w.nations[c.nation];
      const aspect = (opts.param && opts.param.aspect) || 'mercy';
      const epithet = (opts.param && opts.param.epithet) || { wrath: '天罚者', mercy: '慈光之神', mystery: '低语者', creation: '造物之匠' }[aspect];
      const r0 = createReligion(w, n, c, { aspect, player: true, epithet });
      c.religion[r0.id] = 0.7;
      normalize(c.religion);
      w.flags.firstPlayerReligion = true;
      log(w, 'divine', `神谕降临${c.name.z}：你以「${epithet}」之名显现，${r0.name}诞生（${ASPECTS[aspect].name}之信）。`, { imp: 2, x: c.x, y: c.y, nations: [n.id] });
      pushFx(w, { type: 'revelation', x: c.x + 0.5, y: c.y + 0.5, color: r0.color });
      return { ok: true, msg: `${r0.name}诞生` };
    }
    case 'hero': {
      const c = cityNear(w, x, y);
      if (!c) return { ok: false, msg: '请点击一座城市' };
      const n = w.nations[c.nation];
      const atWar = Object.values(n.rel).some((q) => q.state === 'war');
      const role = atWar ? 'general' : rng.pick(['scientist', 'artist', 'merchant', 'explorer', 'prophet']);
      const p = createPerson(w, n, role, { city: c.id, age: 24 });
      p.deeds.push('神选之人');
      if (role === 'scientist' && n.research) grantTech(w, n, n.research, 'hero');
      if (role === 'artist') c.culture += 600;
      if (role === 'merchant') n.treasury += 200;
      if (role === 'general') n.generalBonus = 30;
      log(w, 'divine', `${c.name.z}降生了一位天命之子——${fullName(p)}。`, { imp: 1, x: c.x, y: c.y, nations: [n.id] });
      pushFx(w, { type: 'revelation', x: c.x + 0.5, y: c.y + 0.5, color: [255, 220, 140] });
      return { ok: true, msg: `伟人${fullName(p)}诞生` };
    }
    case 'discord': {
      const from = opts.from;
      if (!from) return { ok: false };
      const ca = cityNear(w, from.x, from.y, 3), cb = cityNear(w, x, y, 3);
      if (!ca || !cb) return { ok: false, msg: '两次点击都需要选中城市' };
      const a = w.nations[ca.nation], b = w.nations[cb.nation];
      if (a === b) {
        // civil strife within one nation
        for (const ci of a.cities) w.cities[ci].unrest = Math.min(1, w.cities[ci].unrest + 0.35);
        a.stability -= 0.2;
        log(w, 'divine', `不和的种子在${a.name}内部生根发芽。`, { imp: 1, nations: [a.id] });
        return { ok: true, msg: `${a.name}陷入内乱` };
      }
      const q = rel(w, a, b);
      q.contact = true;
      q.op = Math.min(q.op, -80);
      q.truce = 0;
      declareWar(w, a, b, 'divine');
      return { ok: true, msg: `${a.name}向${b.name}宣战` };
    }
    case 'peace': {
      const c = cityNear(w, x, y);
      if (!c) return { ok: false, msg: '请点击一座城市' };
      const n = w.nations[c.nation];
      let k2 = 0;
      for (const kk in n.rel) if (n.rel[kk].state === 'war') { makePeace(w, n, w.nations[kk], 'divine'); k2++; }
      for (const a of w.armies) if (a.nation === n.id) a.state = 'return';
      return { ok: k2 > 0, msg: k2 ? `${n.name}与 ${k2} 个国家停战` : `${n.name}并未处于战争中` };
    }
    case 'gold': {
      const c0 = cellAt(w, x, y);
      if (w.elev[c0] >= w.seaLevel) w.res[c0] = R.GOLD;
      for (const c of w.cities) {
        if (!c.alive || Math.hypot(c.x - x, c.y - y) > r + 6) continue;
        w.nations[c.nation].treasury += 120;
      }
      pushFx(w, { type: 'gold', x, y, r });
      w.elevVersion++;
      return { ok: true };
    }
    case 'lightning': {
      const c = cellAt(w, x, y);
      ignite(w, c);
      pushFx(w, { type: 'lightning', x, y });
      pushImpact(w, { kind: 'smite', x, y, r: 1.8, power: 1 });
      const city = cityNear(w, x, y, 1.5);
      if (city) city.pop *= 0.97;
      return { ok: true };
    }
    case 'fire': {
      forDisk(w, x, y, r, (c) => { if (rng.chance(0.3 * rate)) ignite(w, c); });
      return { ok: true };
    }
    case 'meteor': {
      const size = 1 + k * k * 8.5;
      pushFx(w, { type: 'meteorFall', x, y, r: size, delay: 0 });
      meteorImpact(w, x, y, size, rng);
      if (size > 6) log(w, 'divine', `一颗巨大的陨星撞击了世界。冲击波环绕大地，尘埃遮蔽天日——这是一场大灭绝的开端。`, { imp: 3, x, y });
      else if (size > 3) log(w, 'divine', '一颗燃烧的陨石从天而降，在大地上砸出巨坑。', { imp: 2, x, y });
      return { ok: true };
    }
    case 'volcano': {
      const v = addVolcano(w, Math.round(x), Math.round(y), 0.4 + k * 0.6);
      markTerrainChanged(w);
      eruptVolcano(w, v, rng, 0.6 + k);
      log(w, 'divine', '大地裂开，一座火山拔地而起，熔岩奔涌。', { imp: 2, x, y });
      return { ok: true };
    }
    case 'quake': {
      const mag = 5.5 + k * 3.5;
      const q = earthquake(w, Math.round(x), Math.round(y), mag, rng);
      log(w, 'divine', `里氏 ${mag.toFixed(1)} 级的地震撼动大地。`, { imp: mag > 7.5 ? 2 : 1, x, y });
      return { ok: true, msg: `${mag.toFixed(1)} 级地震`, q };
    }
    case 'tsunami': {
      tsunami(w, x, y, 0.004 + k * 0.01, 10 + k * 18);
      log(w, 'divine', '海水退去又呼啸而回，滔天巨浪扑向海岸。', { imp: 2, x, y });
      return { ok: true };
    }
    case 'tornado': {
      spawnTornado(w, x, y, 0.8 + k * 0.8);
      return { ok: true };
    }
    case 'plague': {
      const c = cityNear(w, x, y);
      if (!c) {
        forCreaturesNear(w, x, y, 6, (j) => { if (rng.chance(0.5)) killCreature(w, j, 'disease'); });
        return { ok: true, msg: '疫病在兽群中蔓延' };
      }
      infect(w, c, 0.4 + k * 0.5);
      log(w, 'divine', `一场瘟疫降临${c.name.z}。`, { imp: 2, x: c.x, y: c.y, nations: [c.nation] });
      pushFx(w, { type: 'plague', x: c.x + 0.5, y: c.y + 0.5 });
      return { ok: true };
    }
    case 'locust': {
      forDisk(w, x, y, r, (c) => { if (w.elev[c] >= w.seaLevel) w.veg[c] *= 0.15; });
      for (const c of w.cities) if (c.alive && Math.hypot(c.x - x, c.y - y) < r) c.pop *= 0.92;
      pushFx(w, { type: 'swarm', x, y, r });
      log(w, 'divine', '铺天盖地的蝗群降临，大地顷刻间变得光秃。', { imp: 1, x, y });
      return { ok: true };
    }
    case 'iceage': {
      w.climate.iceAge = 4 * 200;
      w.flags.iceAge = true;
      log(w, 'divine', '太阳变得苍白，冰川开始从两极向赤道推进。一个冰河时代降临了。', { imp: 3 });
      return { ok: true };
    }
    case 'comet': {
      summonComet(w, 30, 4 + k * 4);
      return { ok: true, msg: '彗星将在约 30 年后抵达' };
    }
    case 'nuke': {
      const c = cityNear(w, x, y, 3);
      pushFx(w, { type: 'nuke', x, y });
      if (c) {
        const dead = nukeEffects(w, c);
        log(w, 'divine', `☢ 天降核火，${c.name.z}在一道白光中被吞没，约 ${dead} 人死去。`, { imp: 3, x: c.x, y: c.y, nations: [c.nation] });
        if (c.pop < 200) destroyCity(w, c, '在核火中毁灭', { silent: true });
        w.nukes = (w.nukes || 0) - 1;
      } else {
        pushImpact(w, { kind: 'nuke', x, y, r: 4, power: 10 });
        forDisk(w, x, y, 5, (cc, xx, yy, d2) => { w.rad[cc] = Math.min(1, w.rad[cc] + 0.9 * (1 - Math.sqrt(d2) / 5)); w.veg[cc] *= 0.1; w.scorch[cc] = 40; });
        w.climate.dust += 0.25;
        w.dirty.climate = true;
      }
      w.nukes = (w.nukes || 0) + 1;
      return { ok: true };
    }
    case 'monster': {
      spawnMonster(w, x, y, 0.7 + k * 0.8);
      return { ok: true };
    }
    case 'bubble': {
      w.bubbles.push({ x, y, r: r * (0.6 + k * 0.8), k: 4, born: w.tick });
      log(w, 'divine', '一个时间流速异常的气泡在此成形，里面的一切都在加速度过岁月。', { imp: 1, x, y });
      return { ok: true };
    }
    case 'portal': {
      const from = opts.from;
      if (!from) return { ok: false };
      w.portals.push({ ax: from.x, ay: from.y, bx: x, by: y, born: w.tick });
      w.flags.portal = true;
      log(w, 'divine', '空间被撕开，一对相连的虚空之门出现在大地上。', { imp: 2, x, y });
      return { ok: true };
    }
    case 'monolith': {
      w.monoliths.push({ x, y, r: r * (0.7 + k * 0.6), born: w.tick });
      log(w, 'divine', '一座光滑的黑色石碑一夜之间矗立在荒野中。它不发一言，却让周围的生灵若有所思。', { imp: 2, x, y });
      return { ok: true };
    }
    case 'worldtree': {
      const rr = r * (0.7 + k * 0.6);
      w.trees = w.trees || [];
      w.trees.push({ x, y, r: rr, born: w.tick });
      forDisk(w, x, y, rr, (c, xx, yy, d2) => {
        const f = 1 - Math.sqrt(d2) / rr;
        w.magic[c] = Math.min(1, w.magic[c] + 0.8 * f);
        w.rainMod[c] = Math.min(0.5, w.rainMod[c] + 0.3 * f);
        w.tempMod[c] += (15 - (w.baseTemp[c] - w.tempMod[c])) * 0.3 * f; // a temperate grove
      });
      w.dirty.climate = true;
      log(w, 'divine', '一株世界树破土而出，枝叶遮蔽了半个天空。树荫下四季如春。', { imp: 2, x, y });
      return { ok: true };
    }
    case 'fog': {
      const c = cityNear(w, x, y);
      if (!c) return { ok: false, msg: '请点击一座城市' };
      const n = w.nations[c.nation];
      const lost = loseTechs(w, n, 1 + Math.round(k * 2));
      n.darkAge = 40;
      log(w, 'divine', `灰色的雾笼罩了${n.name}。雾散之后，人们发现自己忘记了${lost.length ? '「' + lost.join('」「') + '」' : '许多事'}。`, { imp: 2, nations: [n.id] });
      return { ok: true, msg: lost.length ? `${n.name}遗忘了：${lost.join('、')}` : `${n.name}已一无可忘` };
    }
    case 'erase': {
      const near = (o, ox, oy) => Math.hypot(ox - x, oy - y) < Math.max(3, (o.r || 0) * 0.5);
      const before = w.bubbles.length + w.portals.length + w.monoliths.length + (w.trees ? w.trees.length : 0);
      w.bubbles = w.bubbles.filter((b) => !near(b, b.x, b.y));
      w.portals = w.portals.filter((p) => !near(p, p.ax, p.ay) && !near(p, p.bx, p.by));
      w.monoliths = w.monoliths.filter((m) => !near(m, m.x, m.y));
      if (w.trees) w.trees = w.trees.filter((t) => !near(t, t.x, t.y));
      const after = w.bubbles.length + w.portals.length + w.monoliths.length + (w.trees ? w.trees.length : 0);
      return { ok: before !== after, msg: before !== after ? '奇物已移除' : '附近没有奇物' };
    }
    default:
      return { ok: false };
  }
}

/** global climate controls from the climate panel */
export function setClimate(w, key, value) {
  const cl = w.climate;
  if (key === 'solar') cl.solar = clamp(value, -12, 12);
  else if (key === 'co2') cl.co2 = clamp(value, 120, 4000);
  else if (key === 'dust') cl.dust = clamp(value, 0, 4);
  else if (key === 'sea') { w.seaLevelBase = clamp(value, -0.15, 0.15); }
  w.dirty.climate = true;
}
