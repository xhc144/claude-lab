// Faith and mythogenesis. Peoples start with folk beliefs. Whenever the player acts on the world
// near them, they remember it as an omen, and the kind of acts they witness (thunderbolts and
// meteors, rain and blessings, riddles and portals, new land and new life) accumulate into an
// impression of what their god is like. When the impression is strong enough a revelation founds a
// religion worshipping the player — named in their own language, with an epithet drawn from what
// they saw ("Star-Burner", "Rain-Giver"…) and an aspect that shapes their culture. Religions spread
// between cities, become state faiths, split into sects, and pray to the player in times of need.

import { RNG } from '../../core/rng.js';
import { word } from '../../core/lang.js';
import { log } from '../chronicle.js';
import { pushFx } from '../state.js';

export const ASPECTS = {
  wrath: { name: '敬畏', desc: '畏惧天威：尚武、严律、献祭', color: [226, 92, 74], glyph: '雷', values: { mil: 0.25, piety: 0.2, open: -0.1 } },
  mercy: { name: '仁慈', desc: '感恩赐福：和平、互助、繁衍', color: [240, 206, 110], glyph: '光', values: { mil: -0.25, coll: 0.15 } },
  mystery: { name: '玄秘', desc: '追问奥秘：求知、冥想、异端频出', color: [160, 112, 240], glyph: '玄', values: { trad: -0.2, piety: 0.1 } },
  creation: { name: '造化', desc: '礼赞创造：开拓、营建、敬畏自然', color: [96, 192, 128], glyph: '源', values: { open: 0.15, trad: 0.05 } },
  ancestors: { name: '祖灵', desc: '敬奉祖先的古老信仰', color: [184, 148, 106], glyph: '祖', values: { trad: 0.2 } },
  nature: { name: '万物有灵', desc: '山川草木皆有灵', color: [122, 176, 106], glyph: '灵', values: { trad: 0.1 } },
};

export const ACT_ASPECT = {
  meteor: 'wrath', lightning: 'wrath', quake: 'wrath', volcano: 'wrath', plague: 'wrath', fire: 'wrath', tsunami: 'wrath', tornado: 'wrath',
  nuke: 'wrath', smite: 'wrath', flood: 'wrath', drought: 'wrath', freeze: 'wrath', heat: 'wrath', comet: 'wrath', monster: 'wrath', discord: 'wrath', ice: 'wrath', locust: 'wrath',
  bless: 'mercy', rain: 'mercy', heal: 'mercy', harvest: 'mercy', peace: 'mercy', fertility: 'mercy', inspire: 'mercy', hero: 'mercy', gold: 'mercy', spring: 'mercy',
  whisper: 'mystery', portal: 'mystery', time: 'mystery', fog: 'mystery', monolith: 'mystery', chimera: 'mystery', mutate: 'mystery', prophecy: 'mystery',
  raise: 'creation', lower: 'creation', spawn: 'creation', plant: 'creation', island: 'creation', worldtree: 'creation', uplift: 'creation', mountain: 'creation',
};

const ACT_EPITHET = {
  meteor: ['焚星者', '坠星之主'], lightning: ['雷霆之主', '执雷者'], quake: ['撼地者', '裂地之神'], volcano: ['熔火之神', '炎山之主'],
  plague: ['疫病之主', '灰手之神'], fire: ['焚野者'], tsunami: ['怒涛之主'], tornado: ['旋风之神'], nuke: ['末日之火'], smite: ['天罚者'],
  flood: ['洪水之主'], drought: ['旱魃'], freeze: ['寒冬之主'], heat: ['炎阳之神'], comet: ['彗星之主'], monster: ['巨兽之主'], discord: ['纷争之神'], ice: ['冰河之主'], locust: ['蝗群之主'],
  bless: ['赐福者', '慈光之神'], rain: ['慈雨者', '降雨者'], heal: ['净疫者', '医者'], harvest: ['丰饶之母', '五谷之神'], peace: ['和平之主'],
  fertility: ['繁衍之神'], inspire: ['启智者', '点灯人'], hero: ['英雄之父'], gold: ['黄金之神'], spring: ['泉之神'],
  whisper: ['低语者', '入梦者'], portal: ['开门者', '虚空行者'], time: ['时之主', '永恒者'], fog: ['遗忘之神'], monolith: ['无言之碑'],
  chimera: ['嫁接者', '万形之主'], mutate: ['畸变之神'], prophecy: ['预言者'],
  raise: ['塑山者', '举地者'], lower: ['沉渊者'], spawn: ['万兽之父', '造物主'], plant: ['播种者', '青林之神'], island: ['造岛者'],
  worldtree: ['世界树之灵'], uplift: ['开智者', '点化者'], mountain: ['筑山者'],
};

const SCHISM_PREFIX = ['新', '正统', '改革', '北方', '南方', '东方', '西方', '原初', '神秘', '净化'];

export function createReligion(w, n, city, opts) {
  const rng = new RNG(w.rng.int(1e9));
  const aspect = opts.aspect || 'ancestors';
  const A = ASPECTS[aspect];
  const deity = opts.deity || (n.deity || (n.deity = word(n.lang, rng, { min: 2, max: 3, maxChars: 3 })));
  let name;
  if (opts.name) name = opts.name;
  else if (opts.player) {
    const ep = opts.epithet;
    name = rng.pick([`${deity.z}教`, `${ep}之道`, `${deity.z}圣约`, `${ep}信仰`, `${deity.z}正道`]);
  } else name = aspect === 'nature' ? `${n.root.z}万灵信仰` : `${n.root.z}祖灵信仰`;
  const r = {
    id: w.religions.length,
    name,
    deity,
    epithet: opts.epithet || null,
    aspect,
    player: !!opts.player,
    founded: w.tick,
    founder: opts.founder ?? null,
    origin: n.id,
    holyCity: city ? city.id : null,
    parent: opts.parent ?? null,
    color: opts.color || A.color.map((c) => Math.max(0, Math.min(255, c + rng.range(-30, 30)))),
    glyph: A.glyph,
    followers: 0,
    alive: true,
    devotion: 0.5,
    prayersAnswered: 0,
    prayersIgnored: 0,
  };
  w.religions.push(r);
  return r;
}

/** each new people starts with a folk faith */
export function folkReligion(w, n, city) {
  const nature = w.monoliths.length && w.monoliths.some((m) => Math.hypot(m.x - city.x, m.y - city.y) < 25);
  const r = createReligion(w, n, city, { aspect: nature || w.rng.chance(0.4) ? 'nature' : 'ancestors' });
  n.religion = r.id;
  city.religion = { [r.id]: 0.95 };
  return r;
}

/** the player did something: everybody who could see it remembers */
export function recordOmen(w, x, y, kind, strength = 1, radius = 6) {
  const aspect = ACT_ASPECT[kind];
  if (!aspect) return;
  const reach = radius + 18;
  const seen = new Set();
  for (const c of w.cities) {
    if (!c.alive) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d > reach) continue;
    const n = w.nations[c.nation];
    const wgt = strength * (1 - d / (reach + 6)) * (d < radius + 2 ? 1.5 : 1);
    if (!seen.has(n.id)) {
      seen.add(n.id);
      n.divine[aspect] += wgt;
      n.divine.acts[kind] = (n.divine.acts[kind] || 0) + wgt;
      n.divine.lastX = x; n.divine.lastY = y;
    }
    // miracles strengthen the faith of those who already worship the player
    for (const rid in c.religion) {
      const r = w.religions[rid];
      if (r.player) { c.religion[rid] = Math.min(1, c.religion[rid] + 0.04 * strength); r.devotion = Math.min(1, r.devotion + 0.01 * strength); }
    }
  }
  return seen.size;
}

function topAct(acts) {
  let best = null, bv = 0;
  for (const k in acts) if (acts[k] > bv) { bv = acts[k]; best = k; }
  return best;
}

/** yearly: impressions fade; strong ones become revelations */
export function stepMythogenesis(w, n, rng) {
  const d = n.divine;
  d.wrath *= 0.975; d.mercy *= 0.975; d.mystery *= 0.975; d.creation *= 0.975;
  for (const k in d.acts) { d.acts[k] *= 0.975; if (d.acts[k] < 0.05) delete d.acts[k]; }
  const total = d.wrath + d.mercy + d.mystery + d.creation;
  if (total < 5 || !n.cities.length) return null;
  let aspect = 'wrath', av = d.wrath;
  for (const a of ['mercy', 'mystery', 'creation']) if (d[a] > av) { av = d[a]; aspect = a; }
  const cur = n.religion != null ? w.religions[n.religion] : null;
  // already worshipping a god of this nature: nothing new to reveal
  if (cur && cur.player && cur.aspect === aspect) return null;
  if (cur && cur.player && av < total * 0.55) return null;
  if (!rng.chance(cur && cur.player ? 0.08 : 0.3)) return null;
  const act = topAct(d.acts) || 'bless';
  const epithet = rng.pick(ACT_EPITHET[act] || ['无名之神']);
  // the prophet arises in the city closest to the most recent omen
  let city = w.cities[n.capital];
  let bd = 1e9;
  for (const ci of n.cities) {
    const c = w.cities[ci];
    const dd = Math.hypot(c.x - (d.lastX ?? c.x), c.y - (d.lastY ?? c.y));
    if (dd < bd) { bd = dd; city = c; }
  }
  const r = createReligion(w, n, city, { aspect, player: true, epithet, parent: cur && cur.player ? cur.id : null });
  city.religion[r.id] = 0.6;
  normalize(city.religion);
  for (const ci of n.cities) { const c = w.cities[ci]; c.religion[r.id] = (c.religion[r.id] || 0) + 0.15; normalize(c.religion); }
  d.wrath *= 0.5; d.mercy *= 0.5; d.mystery *= 0.5; d.creation *= 0.5;
  const reform = cur && cur.player;
  log(w, 'faith', reform
    ? `${n.adj}对神的理解变了：在${city.name.z}，新的启示把神称作「${epithet}」，${r.name}由此诞生。`
    : `启示降临${city.name.z}！${n.adj}相信，那位降下种种奇迹的存在名叫「${r.deity.z}」，尊号「${epithet}」。${r.name}诞生了——这是第一次有人为你命名。`,
  { imp: w.flags.firstPlayerReligion ? 2 : 3, x: city.x, y: city.y, nations: [n.id] });
  w.flags.firstPlayerReligion = true;
  pushFx(w, { type: 'revelation', x: city.x + 0.5, y: city.y + 0.5, color: r.color });
  return r;
}

export function normalize(rel) {
  let s = 0;
  for (const k in rel) s += rel[k];
  if (s > 1) for (const k in rel) rel[k] /= s;
  for (const k in rel) if (rel[k] < 0.01) delete rel[k];
}

/** yearly diffusion of faiths between nearby and trading cities */
export function spreadReligions(w, links) {
  const cities = w.cities.filter((c) => c.alive);
  const press = new Map();
  for (const c of cities) {
    press.clear();
    let tot = 0;
    const n = w.nations[c.nation];
    for (const [d, wgt0] of links.get(c.id) || []) {
      const wgt = wgt0 * Math.sqrt(d.pop + 50) * (d.buildings.includes('temple') ? 1.6 : d.buildings.includes('shrine') ? 1.2 : 1);
      for (const rid in d.religion) {
        press.set(rid, (press.get(rid) || 0) + d.religion[rid] * wgt);
        tot += d.religion[rid] * wgt;
      }
    }
    const recept = 0.03 + 0.03 * Math.max(0, n.values.piety + 0.5);
    if (tot > 0) {
      for (const [rid, p] of press) {
        const target = p / tot;
        const cur = c.religion[rid] || 0;
        if (target > cur) c.religion[rid] = cur + (target - cur) * recept;
      }
    }
    // the state faith is promoted, others slowly fade; secular ideas erode everything
    if (n.religion != null && w.religions[n.religion]?.alive) c.religion[n.religion] = (c.religion[n.religion] || 0) + 0.012;
    const secular = Math.max(0, -n.values.piety) * 0.012 + (n.ideas.rationalism ? 0.006 : 0) + (n.ideas.nihilism ? 0.008 : 0);
    if (secular > 0) for (const rid in c.religion) c.religion[rid] *= 1 - secular;
    normalize(c.religion);
  }
  // followers and death of religions
  for (const r of w.religions) r.followers = 0;
  for (const c of cities) for (const rid in c.religion) w.religions[rid].followers += c.pop * c.religion[rid];
  for (const r of w.religions) {
    if (r.alive && r.followers < 1 && w.tick - r.founded > 40) {
      r.alive = false;
      r.died = w.tick;
      if (r.player) log(w, 'faith', `最后一位${r.name}的信徒离世，「${r.epithet}」从人们的记忆中淡去。`, { imp: 1 });
    }
  }
}

/** pop-weighted majority faith becomes the state religion */
export function updateStateReligion(w, n) {
  const tally = {};
  let total = 0;
  for (const ci of n.cities) {
    const c = w.cities[ci];
    total += c.pop;
    for (const rid in c.religion) tally[rid] = (tally[rid] || 0) + c.pop * c.religion[rid];
  }
  let best = null, bv = 0;
  for (const k in tally) if (tally[k] > bv) { bv = tally[k]; best = Number(k); }
  if (best != null && best !== n.religion && bv > total * 0.45) {
    const old = n.religion != null ? w.religions[n.religion] : null;
    n.religion = best;
    const r = w.religions[best];
    log(w, 'faith', `${n.name}改奉${r.name}为国教${old ? `，取代了${old.name}` : ''}。`, { imp: r.player ? 2 : 1, nations: [n.id] });
    return true;
  }
  return false;
}

/** a widespread religion may split along national or cultural lines */
export function maybeSchism(w, rng) {
  for (const r of w.religions) {
    if (!r.alive || r.followers < 20000 || w.tick - r.founded < 200) continue;
    const holders = w.nations.filter((n) => n.alive && n.religion === r.id);
    if (holders.length < 2 && !(r.aspect === 'mystery' && rng.chance(0.3))) continue;
    if (!rng.chance(r.aspect === 'mystery' ? 0.02 : 0.008)) continue;
    const n = rng.pick(holders.length ? holders : w.nations.filter((x) => x.alive && x.cities.length));
    if (!n || !n.cities.length) continue;
    const city = w.cities[rng.pick(n.cities)];
    const child = createReligion(w, n, city, {
      aspect: r.aspect, player: r.player, epithet: r.epithet, deity: r.deity, parent: r.id,
      name: rng.pick(SCHISM_PREFIX) + r.name,
    });
    for (const ci of n.cities) {
      const c = w.cities[ci];
      const s = c.religion[r.id] || 0;
      if (s > 0) { c.religion[child.id] = s * 0.7; c.religion[r.id] = s * 0.3; }
    }
    n.religion = child.id;
    log(w, 'faith', `${r.name}发生分裂：${n.adj}自立为${child.name}，彼此视对方为异端。`, { imp: 2, x: city.x, y: city.y, nations: [n.id] });
    return child;
  }
  return null;
}

/** cities that worship the player pray in times of trouble */
export function updatePrayers(w, rng) {
  for (const c of w.cities) {
    if (!c.alive) continue;
    if (c.prayer && w.tick > c.prayer.until) {
      const r = w.religions[c.prayer.rel];
      if (r) { r.devotion = Math.max(0, r.devotion - 0.04); r.prayersIgnored++; }
      c.prayer = null;
    }
    if (c.prayer) continue;
    let rel = null, share = 0;
    for (const rid in c.religion) { const r = w.religions[rid]; if (r.player && c.religion[rid] > share) { share = c.religion[rid]; rel = r; } }
    if (!rel || share < 0.25) continue;
    let need = null;
    if (c.siege > 0) need = 'smite';
    else if (c.disease > 0.15) need = 'heal';
    else if (c.starving > 0) need = w.rain[c.y * w.W + c.x] < 0.35 ? 'rain' : 'bless';
    else if (c.unrest > 0.6) need = 'peace';
    if (need && rng.chance(0.35)) c.prayer = { need, rel: rel.id, until: w.tick + 24, since: w.tick };
  }
}

export const PRAYER_NAMES = { smite: '击退围城之敌', heal: '平息瘟疫', rain: '降下甘霖', bless: '赐予丰收', peace: '平息动乱' };

/** called by the powers when the player acts near a praying city */
export function answerPrayers(w, x, y, kind, radius) {
  const answered = [];
  const match = { smite: ['smite', 'lightning', 'meteor'], heal: ['heal'], rain: ['rain', 'spring'], bless: ['bless', 'harvest', 'rain'], peace: ['bless', 'peace'] };
  for (const c of w.cities) {
    if (!c.alive || !c.prayer) continue;
    if (Math.hypot(c.x - x, c.y - y) > radius + 3) continue;
    if (!match[c.prayer.need].includes(kind)) continue;
    const r = w.religions[c.prayer.rel];
    if (r) { r.devotion = Math.min(1, r.devotion + 0.12); r.prayersAnswered++; }
    for (const rid in c.religion) if (w.religions[rid].player) c.religion[rid] = Math.min(1, c.religion[rid] + 0.15);
    normalize(c.religion);
    w.divine.energy += 40;
    w.divine.answered = (w.divine.answered || 0) + 1;
    log(w, 'divine', `${c.name.z}的祈祷得到了回应——${PRAYER_NAMES[c.prayer.need]}。信徒们奔走相告。`, { imp: 1, x: c.x, y: c.y, nations: [c.nation] });
    pushFx(w, { type: 'revelation', x: c.x + 0.5, y: c.y + 0.5, color: [255, 230, 150] });
    c.prayer = null;
    answered.push(c);
  }
  return answered;
}
