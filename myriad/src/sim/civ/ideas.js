// Ideas as memes. Once a nation knows the enabling technology, a thinker may conceive an idea in
// one of its cities; from there it spreads along roads and trade routes to compatible cultures,
// faster after printing, radio and networks. Ideas held by most of a nation's people are adopted:
// they shift its culture values and push towards the government they favour, which is where
// revolutions come from.

import { IDEAS, IDEA, TECH } from './data.js';
import { log } from '../chronicle.js';
import { createPerson, fullName } from './people.js';

const VKEYS = ['trad', 'coll', 'piety', 'mil', 'open'];

/** how well an idea fits a nation's values (−1..1) */
export function compatibility(n, idea) {
  let s = 0, k = 0;
  for (const key of VKEYS) {
    const d = idea.v[key];
    if (d === undefined) continue;
    s += Math.sign(d) * n.values[key];
    k++;
  }
  return k ? s / k : 0;
}

export function stepIdeaOrigins(w, n, rng) {
  if (!n.cities.length) return;
  for (const idea of IDEAS) {
    if (idea.tech && !n.techs[TECH[idea.tech].i]) continue;
    if (w.ideaBorn[idea.id] && rng.next() > 0.15) continue; // most ideas are born once and spread; a few are reinvented
    const present = n.cities.some((ci) => (w.cities[ci].ideas[idea.id] || 0) > 0.05);
    if (present) continue;
    const p = 0.006 * (1 + Math.max(0, compatibility(n, idea)) * 3) * (n.stats.culture > 10 ? 1.5 : 1);
    if (!rng.chance(p)) continue;
    const city = w.cities[rng.weighted(n.cities, (ci) => w.cities[ci].pop + 100)];
    city.ideas[idea.id] = 0.35;
    const first = !w.ideaBorn[idea.id];
    w.ideaBorn[idea.id] = w.ideaBorn[idea.id] || { nation: n.id, tick: w.tick };
    if (first) {
      const p = createPerson(w, n, 'thinker', { city: city.id, age: 35 });
      p.deeds.push(`提出「${idea.name}」`);
      log(w, 'culture', `${city.name.z}的思想家${fullName(p)}提出了「${idea.name}」。`, { imp: 1, x: city.x, y: city.y, nations: [n.id] });
    }
  }
}

/** yearly diffusion along city links; links: Map cityId → [[city, weight]] */
export function spreadIdeas(w, links) {
  const boost = (n) => 1 + (n.tf.printing ? 0.6 : 0) + (n.tf.radio ? 0.8 : 0) + (n.tf.networks ? 1.5 : 0);
  const updates = [];
  for (const c of w.cities) {
    if (!c.alive) continue;
    const n = w.nations[c.nation];
    const b = boost(n);
    const inflow = {};
    let tw = 0;
    for (const [d, wgt] of links.get(c.id) || []) {
      tw += wgt;
      for (const id in d.ideas) inflow[id] = (inflow[id] || 0) + d.ideas[id] * wgt;
    }
    const upd = {};
    for (const id in inflow) {
      const idea = IDEA[id];
      if (idea.tech && !n.techs[TECH[idea.tech].i] && !n.tf.writing) continue;
      const target = inflow[id] / Math.max(1, tw);
      const cur = c.ideas[id] || 0;
      const comp = compatibility(n, idea);
      if (target > cur) upd[id] = cur + (target - cur) * 0.06 * b * (1 + comp);
    }
    // ideas that clash with the culture slowly wither, the rest decay a little
    for (const id in c.ideas) {
      const comp = compatibility(n, IDEA[id]);
      const v = (upd[id] ?? c.ideas[id]) * (comp < -0.2 ? 0.96 : 0.995) + (comp > 0.3 ? 0.004 : 0);
      upd[id] = Math.min(1, v);
    }
    updates.push([c, upd]);
  }
  for (const [c, upd] of updates) {
    for (const id in upd) { if (upd[id] < 0.02) delete c.ideas[id]; else c.ideas[id] = upd[id]; }
  }
}

/** national adoption and the slow drift of culture values */
export function stepNationIdeas(w, n) {
  let pop = 0;
  const avg = {};
  for (const ci of n.cities) {
    const c = w.cities[ci];
    pop += c.pop;
    for (const id in c.ideas) avg[id] = (avg[id] || 0) + c.ideas[id] * c.pop;
  }
  if (pop <= 0) return;
  for (const idea of IDEAS) {
    const a = (avg[idea.id] || 0) / pop;
    const had = !!n.ideas[idea.id];
    if (!had && a > 0.45) {
      n.ideas[idea.id] = true;
      log(w, 'culture', `「${idea.name}」深入${n.adj}人心。`, { imp: 1, nations: [n.id] });
    } else if (had && a < 0.2) delete n.ideas[idea.id];
    if (a > 0.1) for (const key of VKEYS) if (idea.v[key]) n.values[key] = Math.max(-1, Math.min(1, n.values[key] + idea.v[key] * a * 0.01));
  }
}

/** the government most favoured by the nation's ideas (weighted), or null */
export function preferredGov(w, n) {
  const score = {};
  let pop = 0;
  for (const ci of n.cities) {
    const c = w.cities[ci];
    pop += c.pop;
    for (const id in c.ideas) {
      const g = IDEA[id].gov;
      if (g) score[g] = (score[g] || 0) + c.ideas[id] * c.pop;
    }
  }
  let best = null, bv = 0;
  for (const g in score) if (score[g] > bv) { bv = score[g]; best = g; }
  return best && bv / Math.max(1, pop) > 0.35 ? { gov: best, strength: bv / pop } : null;
}
