// The species registry and the tree of life. A species is defined by a reference genome (the
// running mean of its members); a newborn whose lineage has drifted too far from it founds a new
// species, which remembers its parent — that is the phylogenetic tree the UI draws. Species get
// procedural Chinese names built from colour, most distinctive trait and body form, plus a
// mock-Latin binomial.

import { NG, G } from '../constants.js';
import { hsl } from '../../core/util.js';
import { phenotype, hueChar, featureChar, latinName, FORM_CHAR } from './genome.js';
import { log } from '../chronicle.js';

const tmpT = {};

export function speciesColor(g, o) {
  const h = g[o + G.hue] * 360;
  const s = 0.45 + g[o + G.pattern] * 0.4;
  const l = 0.48 + (0.5 - Math.abs(g[o + G.warmth] - 0.5)) * 0.15;
  return hsl(h, s, l);
}

const REGION = (w, x, y) => {
  const b = w.biome[Math.min(w.N - 1, (y | 0) * w.W + (x | 0))];
  const t = ['渊', '海', '湾', '礁', '湖', '冰', '原', '杉', '林', '野', '丛', '漠', '原', '莽', '沼', '岩', '雪', '滩', '烬', '荒'][b] || '野';
  return t;
};

/** generate a name not used by any living species */
export function nameSpecies(w, g, o, x, y, rng) {
  phenotype(g, o, tmpT);
  const hue = hueChar(g[o + G.hue]);
  const feat = featureChar(g, o, rng.next());
  const form = FORM_CHAR[tmpT.form];
  let name = feat === hue ? hue + form : hue + feat + form;
  const taken = new Set(w.species.filter((s) => s.extinct === null).map((s) => s.name));
  if (taken.has(name)) name = REGION(w, x, y) + name;
  let k = 2;
  const base = name;
  while (taken.has(name)) name = base + '·' + '二三四五六七八九十'[Math.min(8, k++ - 2)];
  return { name, latin: latinName(tmpT.form, hue, feat, rng), form: tmpT.form, feat };
}

/** register a new species founded by genome g[o..o+NG) at (x, y) */
export function createSpecies(w, g, o, parent, x, y, rng, forcedName = null) {
  const ref = new Float32Array(NG);
  for (let k = 0; k < NG; k++) ref[k] = g[o + k];
  const nm = nameSpecies(w, g, o, x, y, rng);
  phenotype(g, o, tmpT);
  const sp = {
    id: w.species.length,
    name: forcedName || nm.name,
    latin: nm.latin,
    form: nm.form,
    parent,
    born: w.tick,
    extinct: null,
    ref,
    founder: Float32Array.from(ref),
    pop: 0,
    peak: 0,
    births: 0,
    color: speciesColor(g, o),
    hab: tmpT.hab,
    fly: tmpT.fly,
    x, y, // centroid of the population (updated by census)
    sapient: false,
    nations: [],
    domestic: null, // nation id that domesticated it
    hist: [],
    depth: parent >= 0 && w.species[parent] ? w.species[parent].depth + 1 : 0,
    children: 0,
    designed: false,
  };
  w.species.push(sp);
  if (parent >= 0 && w.species[parent]) w.species[parent].children++;
  return sp;
}

export const aliveSpecies = (w) => w.species.filter((s) => s.extinct === null && s.pop > 0);

/** summary of traits for UI */
export function describeTraits(sp) {
  const g = sp.ref;
  phenotype(g, 0, tmpT);
  const diet = g[G.diet] < 0.35 ? '植食' : g[G.diet] > 0.65 ? '肉食' : '杂食';
  const hab = tmpT.fly ? '飞行' : ['水生', '两栖', '陆生'][tmpT.hab];
  const sz = g[G.size] < 0.15 ? '微小' : g[G.size] < 0.35 ? '小型' : g[G.size] < 0.6 ? '中型' : g[G.size] < 0.82 ? '大型' : '巨型';
  const clim = g[G.warmth] < 0.3 ? '耐寒' : g[G.warmth] > 0.72 ? '喜热' : '温和';
  return { diet, hab, size: sz, climate: clim, topt: tmpT.topt, maxAge: tmpT.maxAge / 4, speed: tmpT.speed };
}

/** called when a species' population hits zero */
export function markExtinct(w, sp) {
  // a sapient species lives on in its cities even when none roam the wild
  if (sp.sapient && w.nations && sp.nations.some((id) => w.nations[id] && w.nations[id].alive)) { sp.pop = 0; return; }
  sp.extinct = w.tick;
  sp.pop = 0;
  sp.hist.push([w.tick, 0]);
  if (sp.peak >= 25 || sp.sapient) {
    log(w, 'life', `${sp.name}灭绝了。它们曾繁盛一时，种群峰值达 ${sp.peak}。`, { imp: sp.sapient || sp.peak > 150 ? 2 : 1, x: sp.x, y: sp.y });
  }
}
