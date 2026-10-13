// Society: stability and unrest, famine and plague, revolts and secessions, revolutions that change
// governments (peacefully or through civil war), the collapse of overstretched empires into
// successor states with drifted languages, golden ages, and peaceful unions of kindred peoples.

import { log } from '../chronicle.js';
import { createNation, childLanguage, refreshName, rel, valueDistance, enemiesOf } from './nation.js';
import { transferCity } from './city.js';
import { newRuler, rulerTraitSum, fullName, createPerson } from './people.js';
import { declareWar } from './diplomacy.js';
import { preferredGov } from './ideas.js';
import { GOVS } from './data.js';
import { loseTechs } from './tech.js';
import { pushFx } from '../state.js';

export function stepStability(w, n) {
  const g = GOVS[n.gov];
  let s = 0.62 + g.stab + rulerTraitSum(w, n, 'stab') + (n.legitimacy - 0.6) * 0.25;
  s -= n.weariness * 0.35;
  const cap = 4 + n.era * 1.5 + (n.tf.law ? 3 : 0) + (n.tf.feudalism ? 2 : 0) + (n.tf.railroad ? 4 : 0) + (n.tf.radio ? 6 : 0);
  if (n.cities.length > cap) s -= (n.cities.length - cap) * 0.025; // overextension
  let unrest = 0, pop = 0;
  for (const ci of n.cities) { const c = w.cities[ci]; unrest += c.unrest * c.pop; pop += c.pop; }
  s -= pop > 0 ? (unrest / pop) * 0.4 : 0;
  if (n.goldenAge > 0) s += 0.1;
  if (n.darkAge > 0) s -= 0.08;
  if (n.religion != null && w.religions[n.religion]?.player) s += 0.04 * w.religions[n.religion].devotion;
  n.stability += (Math.max(0, Math.min(1, s)) - n.stability) * 0.25;
  n.weariness = Math.max(0, n.weariness * 0.9 + enemiesOf(w, n).length * 0.05);
  if (n.goldenAge > 0) n.goldenAge--;
  if (n.darkAge > 0) n.darkAge--;
  n.legitimacy = Math.min(1, n.legitimacy + 0.01);
}

export function stepUnrest(w, c, n) {
  let u = 0;
  if (c.starving > 0) u += 0.25;
  if (w.tick - c.lastConquest < 120) u += 0.25 * (1 - (w.tick - c.lastConquest) / 120);
  // faith mismatch
  if (n.religion != null) {
    const other = 1 - (c.religion[n.religion] || 0);
    u += other * 0.25 * Math.max(0, n.values.piety + 0.3);
  }
  // ideas that favour another government
  for (const id in c.ideas) {
    if (c.ideas[id] < 0.3) continue;
    if (id === 'liberty' && (n.gov === 'monarchy' || n.gov === 'empire' || n.gov === 'junta' || n.gov === 'theocracy')) u += 0.12 * c.ideas[id];
    if (id === 'socialism' && n.gov !== 'commune' && n.gov !== 'democracy') u += 0.1 * c.ideas[id];
    if (id === 'nationalism' && c.origNation !== n.id) u += 0.15 * c.ideas[id];
  }
  if (c.disease > 0.1) u += c.disease * 0.4;
  if (c.origNation !== n.id && w.nations[c.origNation]?.alive && w.nations[c.origNation].species !== n.species) u += 0.1;
  const cap = w.cities[n.capital];
  if (cap && c !== cap) {
    const d = Math.hypot(cap.x - c.x, cap.y - c.y);
    u += Math.max(0, d - 15 - (n.tf.railroad ? 25 : 0) - (n.tf.radio ? 40 : 0)) * 0.006;
  }
  u -= (n.stability - 0.5) * 0.4;
  if (c.buildings.includes('temple')) u -= 0.06;
  if (c.blessed > 0) u -= 0.2;
  c.unrest += (Math.max(0, Math.min(1, u)) - c.unrest) * 0.2;
}

/** carve cities out of a nation into a brand-new successor state */
export function splitNation(w, n, cityIds, opts = {}) {
  if (!cityIds.length) return null;
  const seat = w.cities[cityIds[0]];
  const values = { ...n.values };
  for (const k in values) values[k] = Math.max(-1, Math.min(1, values[k] + w.rng.range(-0.3, 0.3)));
  const m = createNation(w, {
    species: n.species, lang: childLanguage(w, n), parent: n.id, gov: opts.gov || n.gov,
    values, techs: n.techs, religion: opts.religion ?? n.religion, parentFlag: n.flag,
  });
  m.tf = { ...n.tf };
  m.era = n.era;
  m.techCount = n.techCount;
  m.deity = n.deity;
  for (const id in n.ideas) m.ideas[id] = true;
  for (const ci of cityIds) transferCity(w, w.cities[ci], m, 'secession');
  if (m.capital < 0 || !w.cities[m.capital].alive) { m.capital = seat.id; seat.capital = true; }
  for (const ci of cityIds) { const c = w.cities[ci]; c.unrest *= 0.3; c.origNation = m.id; }
  newRuler(w, m, 'revolution');
  // inherit contacts
  for (const k in n.rel) { if (Number(k) !== m.id && n.rel[k].contact) rel(w, m, w.nations[k]).contact = true; }
  const r = rel(w, n, m);
  r.contact = true;
  r.op = opts.hostile ? -60 : -10;
  return m;
}

function revoltAt(w, n, c, rng) {
  // nearby unhappy cities join the uprising
  const group = [c.id];
  for (const ci of n.cities) {
    const d = w.cities[ci];
    if (d === c || d.capital) continue;
    if (d.unrest > 0.55 && Math.hypot(d.x - c.x, d.y - c.y) < 18) group.push(d.id);
  }
  if (group.length >= n.cities.length) group.pop();
  if (!group.length) return;
  // returning to an old nation of the same people?
  const orig = w.nations[c.origNation];
  if (orig && orig.alive && orig !== n && rng.chance(0.5)) {
    for (const ci of group) transferCity(w, w.cities[ci], orig, 'secession');
    log(w, 'society', `${c.name.z}等 ${group.length} 城发动起义，脱离${n.name}，回归${orig.name}。`, { imp: 2, x: c.x, y: c.y, nations: [n.id, orig.id] });
    declareWar(w, n, orig, 'border', true);
    return;
  }
  const leader = createPerson(w, n, 'rebel', { city: c.id, age: 30 });
  const m = splitNation(w, n, group, { hostile: true, gov: rng.chance(0.5) ? n.gov : 'chiefdom' });
  if (!m) return;
  leader.nation = m.id;
  log(w, 'society', `${fullName(leader)}在${c.name.z}揭竿而起，${group.length} 座城市脱离${n.name}，建立${m.name}。`, { imp: 2, x: c.x, y: c.y, nations: [n.id, m.id] });
  pushFx(w, { type: 'conquest', x: c.x + 0.5, y: c.y + 0.5, color: m.color });
  if (rng.chance(0.6)) declareWar(w, n, m, 'border', true);
}

/** yearly: revolts, revolutions, collapse, golden ages */
export function stepSocietyNation(w, n, rng) {
  // revolts in deeply unhappy cities
  for (const ci of n.cities.slice()) {
    const c = w.cities[ci];
    if (!c || !c.alive || c.capital || c.nation !== n.id) continue;
    if (c.unrest > 0.82 && rng.chance(0.12)) { revoltAt(w, n, c, rng); return; }
  }
  // ideas demanding another government
  const pref = preferredGov(w, n);
  if (pref && pref.gov !== n.gov && GOVS[pref.gov]) {
    const flexible = n.gov === 'republic' || n.gov === 'democracy' || n.gov === 'oligarchy' || n.gov === 'technocracy';
    const ruler = w.persons[n.leader];
    if (n.stability > 0.55 && flexible && rng.chance(0.05)) {
      const old = n.name;
      n.gov = pref.gov;
      refreshName(n);
      newRuler(w, n, 'election');
      log(w, 'society', `${old}和平改制，成为${n.name}。`, { imp: 2, nations: [n.id] });
      return;
    }
    if (n.stability < 0.45 && rng.chance(0.06 + pref.strength * 0.1)) {
      revolution(w, n, pref.gov, rng);
      return;
    }
  }
  // overstretched, unstable realms fall apart
  if (n.cities.length >= 10 && n.stability < 0.25 && rng.chance(0.05)) { collapse(w, n, rng); return; }
  // succession crisis in hereditary realms with weak legitimacy
  if ((n.gov === 'monarchy' || n.gov === 'empire') && n.legitimacy < 0.45 && n.cities.length >= 4 && rng.chance(0.02)) {
    const far = n.cities.map((ci) => w.cities[ci]).filter((c) => !c.capital).sort((a, b) => b.unrest - a.unrest).slice(0, Math.ceil(n.cities.length / 3));
    if (far.length) {
      const m = splitNation(w, n, far.map((c) => c.id), { hostile: true });
      if (m) {
        log(w, 'society', `王位继承战争爆发！觊觎王位者在${far[0].name.z}称王，建立${m.name}。`, { imp: 2, x: far[0].x, y: far[0].y, nations: [n.id, m.id] });
        declareWar(w, m, n, 'conquest', true);
      }
    }
    return;
  }
  // governments mature as realms grow
  if (n.gov === 'chiefdom' && (n.tf.writing || n.tf.masonry) && n.cities.length >= 3 && rng.chance(0.15)) {
    const old = n.name;
    n.gov = n.values.piety > 0.55 && rng.chance(0.5) ? 'theocracy' : 'monarchy';
    refreshName(n);
    const p = w.persons[n.leader];
    log(w, 'civ', `${old}的${p ? p.title + fullName(p) : '首领'}加冕称王，${n.name}建立。`, { imp: 1, nations: [n.id] });
    if (p) p.title = n.gov === 'theocracy' ? '大祭司' : '国王';
    return;
  }
  if (n.gov === 'tribe' && n.cities.length >= 3 && rng.chance(0.1)) { n.gov = 'chiefdom'; refreshName(n); return; }
  if (n.gov === 'monarchy' && n.cities.length >= 14 && n.stability > 0.5 && rng.chance(0.08)) {
    const old = n.name;
    n.gov = 'empire';
    refreshName(n);
    const p = w.persons[n.leader];
    if (p) p.title = '皇帝';
    log(w, 'civ', `${old}统御 ${n.cities.length} 城，${p ? fullName(p) : '国王'}登基称帝，${n.name}建立。`, { imp: 2, nations: [n.id] });
    return;
  }
  if (n.gov === 'empire' && n.cities.length < 7 && rng.chance(0.05)) { n.gov = 'monarchy'; refreshName(n); }
  // golden age
  if (n.goldenAge <= 0 && n.stability > 0.82 && n.stats.culture > 30 && rng.chance(0.03)) {
    n.goldenAge = 25 + rng.int(25);
    const cap = w.cities[n.capital];
    log(w, 'culture', `${n.name}迎来黄金时代：艺术、学术与商贸空前繁荣。`, { imp: 2, x: cap?.x, y: cap?.y, nations: [n.id] });
  }
}

function revolution(w, n, gov, rng) {
  const old = n.name;
  const unhappy = n.cities.map((ci) => w.cities[ci]).filter((c) => c.unrest > 0.4 && !c.capital);
  if (unhappy.length >= 2 && unhappy.length < n.cities.length && rng.chance(0.5)) {
    // civil war: the revolutionaries hold part of the country
    const m = splitNation(w, n, unhappy.map((c) => c.id), { gov, hostile: true });
    if (m) {
      log(w, 'society', `${old}爆发内战！${GOVS[gov].name}派占据 ${unhappy.length} 座城市，建立${m.name}。`, { imp: 3, x: unhappy[0].x, y: unhappy[0].y, nations: [n.id, m.id] });
      declareWar(w, m, n, 'ideology', true);
      return;
    }
  }
  n.gov = gov;
  refreshName(n);
  endOldOrder(w, n);
  log(w, 'society', `革命席卷${old}！旧政权被推翻，${n.name}建立。`, { imp: 2, nations: [n.id] });
  n.stability = 0.5;
  for (const ci of n.cities) w.cities[ci].unrest *= 0.5;
}

function endOldOrder(w, n) {
  const p = w.persons[n.leader];
  if (p) { p.died = w.tick; p.epithet = p.epithet || '末代'; }
  newRuler(w, n, 'revolution');
}

function collapse(w, n, rng) {
  const cities = n.cities.map((ci) => w.cities[ci]);
  const k = Math.min(4, 2 + Math.floor(cities.length / 12));
  // pick k seeds far apart (the capital stays with the rump state)
  const seeds = [w.cities[n.capital]];
  while (seeds.length < k) {
    let best = null, bd = -1;
    for (const c of cities) {
      const d = Math.min(...seeds.map((s) => Math.hypot(s.x - c.x, s.y - c.y)));
      if (d > bd) { bd = d; best = c; }
    }
    if (!best || bd < 8) break;
    seeds.push(best);
  }
  if (seeds.length < 2) return;
  const groups = seeds.map(() => []);
  for (const c of cities) {
    let gi = 0, bd = 1e9;
    seeds.forEach((s, i) => { const d = Math.hypot(s.x - c.x, s.y - c.y); if (d < bd) { bd = d; gi = i; } });
    groups[gi].push(c.id);
  }
  const old = n.name;
  const born = [];
  for (let i = 1; i < groups.length; i++) {
    const m = splitNation(w, n, groups[i], { hostile: rng.chance(0.5) });
    if (m) born.push(m);
  }
  if (!born.length) return;
  log(w, 'society', `庞大的${old}分崩离析，${born.map((m) => m.name).join('、')}从它的废墟上崛起。`, { imp: 3, nations: [n.id, ...born.map((m) => m.id)] });
  // knowledge is lost in the chaos unless an archive preserves it
  if (!w.wondersBuilt.archive || w.wondersBuilt.archive.nation !== n.id) {
    for (const m of [n, ...born]) {
      if (rng.chance(0.5)) {
        const lost = loseTechs(w, m, 1 + rng.int(2));
        if (lost.length) { m.darkAge = 40; log(w, 'science', `${m.name}陷入黑暗时代，「${lost.join('」「')}」失传了。`, { imp: 1, nations: [m.id] }); }
      }
    }
  }
}

/** kindred nations may unite peacefully */
export function maybeFederation(w, rng) {
  if (!rng.chance(0.15)) return;
  const nations = w.nations.filter((n) => n.alive && n.cities.length);
  for (const a of nations) {
    for (const k in a.rel) {
      const b = w.nations[k];
      const r = a.rel[k];
      if (!b.alive || r.state === 'war' || r.op < 75 || a.species !== b.species) continue;
      if (valueDistance(a, b) > 0.7 || a.religion !== b.religion) continue;
      if (!rng.chance(0.08)) continue;
      const [big, small] = a.stats.pop >= b.stats.pop ? [a, b] : [b, a];
      for (const ci of small.cities.slice()) transferCity(w, w.cities[ci], big, 'union');
      log(w, 'civ', `${small.name}与${big.name}和平合并，${small.adj}与${big.adj}自此成为一个民族。`, { imp: 2, nations: [big.id, small.id] });
      return;
    }
  }
}

// ---- disease -------------------------------------------------------------------------------------

const PLAGUE_NAMES = ['热病', '灰斑病', '血咳症', '沉睡病', '黑疹', '颤抖病', '白瘟', '红热', '枯骨病', '蓝唇症'];

export function stepDisease(w, links, rng) {
  for (const c of w.cities) {
    if (!c.alive) continue;
    const n = w.nations[c.nation];
    const medicine = (n.tf.medicine ? 0.5 : 1) * (n.tf.sanitation ? 0.6 : 1) * (c.buildings.includes('hospital') ? 0.6 : 1);
    if (c.disease > 0) {
      // the sick die, the survivors become immune
      const mort = c.disease * 0.08 * medicine;
      const dead = c.pop * mort;
      c.pop -= dead;
      w.plagueDeaths = (w.plagueDeaths || 0) + dead;
      c.immunity = Math.min(1, c.immunity + c.disease * 0.25);
      c.disease = Math.max(0, c.disease * (0.75 - c.immunity * 0.3) - 0.01);
      // spread along links
      for (const [d] of links.get(c.id) || []) {
        if (d.disease < 0.05 && rng.next() < c.disease * 0.25 * (1 - d.immunity)) { d.disease = 0.2; d.plague = c.plague; }
      }
    } else {
      c.immunity *= 0.97;
      // new plagues brew in crowded, dirty cities
      const dense = c.pop > 15000 && !n.tf.sanitation;
      if (dense && rng.chance(0.0015 * (c.pop / 50000))) {
        c.disease = 0.35;
        c.plague = c.name.z + rng.pick(PLAGUE_NAMES);
        log(w, 'society', `「${c.plague}」在${c.name.z}爆发。`, { imp: 2, x: c.x, y: c.y, nations: [n.id] });
      }
    }
  }
}

/** a plague released by the player */
export function infect(w, city, strength = 0.6) {
  city.disease = Math.max(city.disease, strength);
  city.plague = city.plague || '神谴之疫';
}

