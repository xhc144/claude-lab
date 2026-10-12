// Random events: natural, social and strange happenings that give each world's history its own
// texture. Each event has a weight that depends on the state of the world (no plagues of locusts
// without fields, no assassinations without kings) and an effect that feeds back into the
// simulation.

import { log } from './chronicle.js';
import { pushFx, forDisk, year } from './state.js';
import { rel } from './civ/nation.js';
import { newRuler, fullName } from './civ/people.js';
import { loseTechs, grantTech, available } from './civ/tech.js';
import { IDEAS, TECH } from './civ/data.js';
import { forCreaturesNear } from './life/creatures.js';
import { B } from './constants.js';

const aliveCities = (w) => w.cities.filter((c) => c.alive);
const aliveNations = (w) => w.nations.filter((n) => n.alive && n.cities.length);

function pickCity(w, rng, f = () => true) {
  const cs = aliveCities(w).filter(f);
  return cs.length ? rng.weighted(cs, (c) => Math.sqrt(c.pop) + 1) : null;
}
function pickNation(w, rng, f = () => true) {
  const ns = aliveNations(w).filter(f);
  return ns.length ? rng.pick(ns) : null;
}
const at = (c) => ({ x: c.x, y: c.y, nations: [c.nation] });

export const EVENTS = [
  {
    id: 'harvest', name: '丰年',
    weight: (w) => (w.cities.length ? 3 : 0),
    run(w, rng) {
      const n = pickNation(w, rng, (n) => n.tf.agriculture);
      if (!n) return false;
      for (const ci of n.cities) w.cities[ci].blessed = Math.max(w.cities[ci].blessed, 4);
      n.stability = Math.min(1, n.stability + 0.05);
      log(w, 'nature', `风调雨顺，${n.name}迎来罕见的丰年，仓廪充实。`, { imp: 1, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'drought', name: '大旱',
    weight: (w) => (w.settings.disasters ? 2 : 0),
    run(w, rng) {
      const c = pickCity(w, rng) || null;
      const x = c ? c.x : rng.int(w.W), y = c ? c.y : rng.int(w.H);
      forDisk(w, x, y, 14, (cc) => { w.veg[cc] *= 0.45; w.flood[cc] = 0; });
      if (c) log(w, 'nature', `大旱降临${c.name.z}一带，田地龟裂，河流断流。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'locusts', name: '蝗灾',
    weight: (w) => (w.settings.disasters && w.cities.some((c) => c.alive && w.nations[c.nation].tf.agriculture) ? 1.5 : 0),
    run(w, rng) {
      const c = pickCity(w, rng, (c) => w.nations[c.nation].tf.agriculture);
      if (!c) return false;
      forDisk(w, c.x, c.y, 12, (cc) => { w.veg[cc] *= 0.25; });
      c.pop *= 0.92;
      pushFx(w, { type: 'swarm', x: c.x + 0.5, y: c.y + 0.5 });
      log(w, 'nature', `遮天蔽日的蝗群扑向${c.name.z}，所过之处寸草不留。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'fire', name: '城中大火',
    weight: (w) => (w.cities.some((c) => c.alive && c.tier >= 2) ? 1.5 : 0),
    run(w, rng) {
      const c = pickCity(w, rng, (c) => c.tier >= 2);
      if (!c) return false;
      c.pop *= 0.9;
      if (c.buildings.length) c.buildings.splice(rng.int(c.buildings.length), 1);
      pushFx(w, { type: 'cityfire', x: c.x + 0.5, y: c.y + 0.5 });
      log(w, 'society', `${c.name.z}燃起大火，烧了三天三夜。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'assassination', name: '刺杀',
    weight: (w) => (aliveNations(w).length ? 0.8 : 0),
    run(w, rng) {
      const n = pickNation(w, rng, (n) => n.stability < 0.6 && w.persons[n.leader]);
      if (!n) return false;
      const p = w.persons[n.leader];
      p.died = w.tick;
      p.epithet = p.epithet || '遇刺者';
      n.legitimacy -= 0.25;
      n.stability -= 0.1;
      const q = newRuler(w, n, n.gov === 'monarchy' || n.gov === 'empire' ? 'heir' : 'coup');
      log(w, 'society', `${n.name}${p.title}${fullName(p)}遇刺身亡，${fullName(q)}继位。`, { imp: 2, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'marriage', name: '联姻',
    weight: (w) => (aliveNations(w).filter((n) => n.gov === 'monarchy' || n.gov === 'empire').length >= 2 ? 1 : 0),
    run(w, rng) {
      const ms = aliveNations(w).filter((n) => n.gov === 'monarchy' || n.gov === 'empire');
      const a = rng.pick(ms);
      const b = rng.pick(ms.filter((m) => m !== a && a.rel[m.id] && a.rel[m.id].contact && a.rel[m.id].state !== 'war'));
      if (!a || !b) return false;
      const r = rel(w, a, b);
      r.op = Math.min(100, r.op + 40);
      log(w, 'civ', `${a.name}与${b.name}王室联姻，两国关系空前亲密。`, { imp: 1, nations: [a.id, b.id] });
      return true;
    },
  },
  {
    id: 'renaissance', name: '文艺复兴',
    weight: (w) => (aliveNations(w).some((n) => n.era >= 4) ? 0.7 : 0),
    run(w, rng) {
      const n = pickNation(w, rng, (n) => n.era >= 4);
      if (!n) return false;
      n.goldenAge = Math.max(n.goldenAge, 30);
      for (const ci of n.cities) w.cities[ci].culture += 150;
      log(w, 'culture', `${n.adj}掀起一场思想与艺术的复兴运动，旧日的经典被重新发现。`, { imp: 2, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'invention', name: '偶然的发明',
    weight: (w) => (aliveNations(w).length ? 1 : 0),
    run(w, rng) {
      const n = pickNation(w, rng);
      if (!n || !n.research) return false;
      const t = TECH[n.research];
      grantTech(w, n, t.id, 'accident');
      log(w, 'science', `一次失败的实验意外成功——${n.adj}提前掌握了「${t.name}」。`, { imp: 1, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'migration', name: '大迁徙',
    weight: (w) => (aliveCities(w).some((c) => c.starving > 0) ? 2 : 0),
    run(w, rng) {
      const from = pickCity(w, rng, (c) => c.starving > 0);
      if (!from) return false;
      let best = null, bd = 1e9;
      for (const c of aliveCities(w)) {
        if (c === from || c.pop > c.K) continue;
        const d = Math.hypot(c.x - from.x, c.y - from.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) return false;
      const moving = from.pop * 0.15;
      from.pop -= moving;
      best.pop += moving;
      if (best.nation !== from.nation) best.unrest = Math.min(1, best.unrest + 0.15);
      log(w, 'society', `饥荒驱使数以千计的${w.nations[from.nation].adj}离开${from.name.z}，涌向${best.name.z}。`, { imp: 1, x: from.x, y: from.y, nations: [from.nation, best.nation] });
      return true;
    },
  },
  {
    id: 'bandits', name: '流寇',
    weight: (w) => (aliveNations(w).some((n) => n.stability < 0.45) ? 1.5 : 0),
    run(w, rng) {
      const n = pickNation(w, rng, (n) => n.stability < 0.45);
      if (!n) return false;
      const c = w.cities[rng.pick(n.cities)];
      c.unrest = Math.min(1, c.unrest + 0.3);
      c.pop *= 0.95;
      log(w, 'society', `流寇四起，${c.name.z}周边的商路几乎断绝。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'comet', name: '彗星',
    weight: () => 0.5,
    run(w, rng) {
      for (const n of aliveNations(w)) n.divine.mystery += 0.6;
      pushFx(w, { type: 'skycomet' });
      log(w, 'nature', '一颗拖着长尾的彗星划过夜空，持续了四十个夜晚。各地的祭司都在解读它的含义。', { imp: 1 });
      return true;
    },
  },
  {
    id: 'starsong', name: '星落之歌',
    weight: () => 0.25,
    run(w, rng) {
      for (const n of aliveNations(w)) { n.divine.mystery += 0.8; n.divine.creation += 0.3; }
      pushFx(w, { type: 'starfall' });
      log(w, 'nature', '流星雨倾泻整夜，有人发誓听见了星辰坠落时的歌声。', { imp: 1 });
      return true;
    },
  },
  {
    id: 'redtide', name: '赤潮',
    weight: (w) => (w.settings.disasters ? 0.8 : 0),
    run(w, rng) {
      const c = pickCity(w, rng, (c) => c.port);
      const x = c ? c.x : rng.int(w.W), y = c ? c.y : rng.int(w.H);
      let hit = 0;
      forDisk(w, x, y, 16, (cc) => { if (w.elev[cc] < w.seaLevel) { w.veg[cc] *= 0.15; hit++; } });
      if (!hit) return false;
      log(w, 'nature', `${c ? c.name.z + '外的' : ''}海面泛起血红色的潮水，鱼群成片死去。`, { imp: 1, ...(c ? at(c) : { x, y }) });
      return true;
    },
  },
  {
    id: 'whitestag', name: '白兽现世',
    weight: (w) => (w.species.some((s) => s.extinct === null && s.pop > 30) ? 0.6 : 0),
    run(w, rng) {
      const c = pickCity(w, rng);
      if (!c) return false;
      let found = null;
      forCreaturesNear(w, c.x, c.y, 15, (j) => { found = w.species[w.life.sp[j]]; return false; });
      if (!found) return false;
      const n = w.nations[c.nation];
      n.values.piety = Math.min(1, n.values.piety + 0.1);
      n.divine.creation += 0.5;
      log(w, 'faith', `${c.name.z}附近出现了一只通体雪白的${found.name}，人们视之为祥瑞。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'sleeping', name: '沉睡病',
    weight: (w) => (aliveCities(w).length > 5 ? 0.35 : 0),
    run(w, rng) {
      const c = pickCity(w, rng, (c) => c.tier >= 1);
      if (!c) return false;
      c.inspired = 0;
      c.disease = Math.max(c.disease, 0.12);
      c.plague = '长眠症';
      log(w, 'society', `${c.name.z}的居民一个接一个陷入不醒的长眠，醒着的人在街头守夜。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'bell', name: '古钟自鸣',
    weight: (w) => (w.ruins.some((r) => r.discovered) ? 0.6 : 0),
    run(w, rng) {
      const r = rng.pick(w.ruins.filter((r) => r.discovered));
      const o = w.owner[r.y * w.W + r.x];
      if (o < 0) return false;
      const n = w.nations[o];
      const av = available(n);
      if (!av.length) return false;
      const t = rng.pick(av);
      grantTech(w, n, t.id, 'ruin');
      log(w, 'science', `「${r.name}」遗迹中的古钟在无人之夜自鸣。循声而至的${n.adj}学者在钟下发现了失落的「${t.name}」之术。`, { imp: 2, x: r.x, y: r.y, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'childprophet', name: '预言之子',
    weight: (w) => (w.religions.some((r) => r.alive && r.player) ? 0.8 : 0.1),
    run(w, rng) {
      const c = pickCity(w, rng, (c) => Object.keys(c.religion).some((k) => w.religions[k].player));
      if (!c) return false;
      const rid = Object.keys(c.religion).find((k) => w.religions[k].player);
      const r = w.religions[rid];
      for (const ci of w.nations[c.nation].cities) { const d = w.cities[ci]; d.religion[rid] = Math.min(1, (d.religion[rid] || 0) + 0.08); }
      log(w, 'faith', `${c.name.z}有个孩子声称梦见了「${r.epithet}」，说出的预言一一应验。${r.name}的信众激增。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'parhelion', name: '幻日',
    weight: () => 0.3,
    run(w, rng) {
      const n = pickNation(w, rng);
      if (!n) return false;
      n.divine.wrath += 0.4; n.divine.mystery += 0.4;
      log(w, 'nature', `${n.name}的天空同时出现了三个太阳。占卜者们争吵不休。`, { imp: 1, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'coalfire', name: '地火',
    weight: (w) => (w.nations.some((n) => n.alive && n.tf && n.tf.steam) ? 0.4 : 0),
    run(w, rng) {
      const c = pickCity(w, rng, (c) => w.nations[c.nation].tf.steam);
      if (!c) return false;
      forDisk(w, c.x, c.y, 4, (cc) => { w.pollution[cc] = Math.min(1, w.pollution[cc] + 0.4); });
      w.climate.co2 += 3;
      log(w, 'nature', `${c.name.z}附近的煤层起火，地下的火焰燃烧不熄，浓烟终年不散。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'oracle', name: '怪诞神谕',
    weight: (w) => (aliveNations(w).length ? 0.4 : 0),
    run(w, rng) {
      const n = pickNation(w, rng);
      if (!n) return false;
      const keys = ['trad', 'coll', 'piety', 'mil', 'open'];
      const k = rng.pick(keys);
      const d = rng.sign() * 0.35;
      n.values[k] = Math.max(-1, Math.min(1, n.values[k] + d));
      const what = { trad: d > 0 ? '恪守祖制' : '破旧立新', coll: d > 0 ? '万众一心' : '人人自主', piety: d > 0 ? '敬畏神明' : '质疑神明', mil: d > 0 ? '以剑开疆' : '铸剑为犁', open: d > 0 ? '广纳四方' : '闭关自守' }[k];
      log(w, 'faith', `${n.name}的神谕宣称：「${what}」。举国为之一变。`, { imp: 1, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'meltdown', name: '核电站熔毁',
    weight: (w) => (aliveCities(w).some((c) => c.buildings.includes('nuclear')) ? 0.25 : 0),
    run(w, rng) {
      const c = pickCity(w, rng, (c) => c.buildings.includes('nuclear'));
      if (!c) return false;
      c.buildings.splice(c.buildings.indexOf('nuclear'), 1);
      forDisk(w, c.x + 2, c.y + 1, 4, (cc, xx, yy, d2) => { w.rad[cc] = Math.min(1, w.rad[cc] + 0.6 * (1 - Math.sqrt(d2) / 4)); });
      c.pop *= 0.85;
      w.dirty.climate = true;
      pushFx(w, { type: 'shockwave', x: c.x + 2.5, y: c.y + 1.5, r: 5, color: [140, 255, 120] });
      log(w, 'society', `${c.name.z}的核电站发生熔毁，方圆数十里化为禁区。`, { imp: 2, ...at(c) });
      return true;
    },
  },
  {
    id: 'thinker', name: '思想激荡',
    weight: (w) => (aliveNations(w).some((n) => n.tf.philosophy) ? 0.6 : 0),
    run(w, rng) {
      const n = pickNation(w, rng, (n) => n.tf.philosophy);
      if (!n) return false;
      const ideas = IDEAS.filter((i) => !i.tech || n.techs[TECH[i.tech].i]);
      const idea = rng.pick(ideas);
      const c = w.cities[rng.pick(n.cities)];
      c.ideas[idea.id] = Math.min(1, (c.ideas[idea.id] || 0) + 0.5);
      log(w, 'culture', `${c.name.z}的广场上，「${idea.name}」的辩论通宵达旦。`, { imp: 1, ...at(c) });
      return true;
    },
  },
  {
    id: 'mutiny', name: '兵变',
    weight: (w) => (w.armies.length > 3 ? 0.5 : 0),
    run(w, rng) {
      const a = rng.pick(w.armies.filter((a) => a.alive && a.morale < 0.6));
      if (!a) return false;
      const n = w.nations[a.nation];
      a.alive = false;
      n.stability -= 0.06;
      log(w, 'war', `${n.name}的一支军队因欠饷哗变，士兵们四散回乡。`, { imp: 1, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'darkness', name: '大遗忘',
    weight: (w) => (aliveNations(w).some((n) => n.stability < 0.25 && n.era >= 2) ? 0.3 : 0),
    run(w, rng) {
      const n = pickNation(w, rng, (n) => n.stability < 0.25 && n.era >= 2);
      if (!n) return false;
      const lost = loseTechs(w, n, 1);
      if (!lost.length) return false;
      n.darkAge = Math.max(n.darkAge, 30);
      log(w, 'science', `战乱中最后一位通晓「${lost[0]}」的匠人死去，${n.adj}再也无人知晓其中奥秘。`, { imp: 1, nations: [n.id] });
      return true;
    },
  },
  {
    id: 'herds', name: '兽群迁徙',
    weight: (w) => (w.life.count > 1500 ? 0.5 : 0),
    run(w, rng) {
      const sp = rng.weighted(w.species.filter((s) => s.extinct === null && s.pop > 40 && s.hab === 2), (s) => s.pop);
      if (!sp) return false;
      log(w, 'life', `数以万计的${sp.name}开始季节性大迁徙，大地为之震颤。`, { imp: 1, x: sp.x, y: sp.y });
      return true;
    },
  },
  {
    id: 'volcanicwinter', name: '无夏之年',
    weight: (w) => (w.climate.dust > 0.3 ? 2 : 0),
    run(w, rng) {
      log(w, 'nature', `火山灰遮蔽了天空，这一年没有夏天。各地收成锐减，${year(w)} 年被称作「无夏之年」。`, { imp: 2 });
      for (const c of aliveCities(w)) c.pop *= 0.97;
      return true;
    },
  },
];

/** yearly: maybe run one random event */
export function stepEvents(w, rng) {
  if (!rng.chance(0.14 + Math.min(0.2, w.cities.length * 0.002))) return null;
  const last = w.eventLast || (w.eventLast = {});
  const e = rng.weighted(EVENTS, (e) => (w.tick - (last[e.id] ?? -1e9) < 40 ? 0 : e.weight(w)));
  if (!e) return null;
  last[e.id] = w.tick;
  return e.run(w, rng) ? e.id : null;
}

/** force a specific event (used by the scenario lab and tests) */
export function runEvent(w, id) {
  const e = EVENTS.find((x) => x.id === id);
  return e ? e.run(w, w.rng) : false;
}

export { B };
