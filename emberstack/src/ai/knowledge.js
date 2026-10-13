// What the AI knows about the rules: which recipes it may use (the public recipe book plus what
// it has discovered or read about), how every item can be obtained, and roughly what each item
// costs in worker-seconds. It never peeks at hidden recipes it has not found.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { TECHS } from '../data/techs.js';

// ---- static indexes over the rule data ------------------------------------------------------------
export const PRODUCERS = new Map(); // item -> [{r, n}]
export const NODE_DROPS = new Map(); // item -> [{node, n, harvest recipe}]
export const REGION_LOOT = new Map(); // item -> [{region, p}]
export const BEAST_LOOT = new Map(); // item -> [{beast, n}]
export const BUNDLE_LOOT = new Map(); // item -> [{bundle, p}]

function push(map, k, v) { if (!map.has(k)) map.set(k, []); map.get(k).push(v); }

for (const r of Object.values(RECIPES)) {
  if (r.kind === 'explore') continue;
  for (const [id, n, p] of r.out) push(PRODUCERS, id, { r: r.id, n: n * (p ?? 1) });
  if (r.kind === 'harvest') {
    const node = Object.keys(r.keep)[0];
    for (const [id, p] of CARDS[node].node.extra || []) push(PRODUCERS, id, { r: r.id, n: p, extra: true });
  }
}
for (const d of Object.values(CARDS)) {
  if (d.region) {
    const tot = d.region.loot.reduce((a, e) => a + e[1], 0);
    for (const [id, w] of d.region.loot) push(REGION_LOOT, id, { region: d.id, p: (w / tot) * 1.3 });
  }
  if (d.mob && d.mob.loot && d.kind === 'beast') for (const [id, n, p] of d.mob.loot) push(BEAST_LOOT, id, { beast: d.id, n: n * (p ?? 1) });
  if (d.open && d.open.type === 'bundle') {
    const tot = d.open.loot.reduce((a, e) => a + e[1], 0);
    for (const [id, w] of d.open.loot) push(BUNDLE_LOOT, id, { bundle: d.id, p: (w / tot) * d.open.n });
  }
}

/** recipes this AI may plan with */
export function isKnown(g, mem, rid) {
  const r = RECIPES[rid];
  if (!r.hidden) return true;
  return g.s.disc.includes(rid) || mem.disc.has(rid) || !!g.s.hints[rid];
}

/** total tech cost (insight) still missing to unlock `tech` */
export function techGap(g, tech) {
  if (!tech || g.hasTech(tech)) return 0;
  if (!g.techAllowed(tech)) return Infinity;
  let cost = 0;
  const seen = new Set();
  (function walk(t) {
    if (seen.has(t) || g.hasTech(t)) return;
    seen.add(t);
    if (!g.techAllowed(t)) { cost = Infinity; return; }
    cost += TECHS[t].cost;
    for (const q of TECHS[t].req) walk(q);
  })(tech);
  return cost;
}

/**
 * Cost model: estimated worker-seconds to obtain one unit of an item, given what is on the board.
 * Memoised per planning pass (`memo`).
 */
export function itemCost(W, item, memo, depth = 0, visiting = new Set()) {
  if (memo.has(item)) return memo.get(item);
  if (W.freeN && W.freeN(item) > 0 && depth > 0) return 2;
  if (depth > 5 || visiting.has(item)) return Infinity;
  visiting.add(item);
  let best = Infinity;
  const g = W.g;
  // harvesting a node that exists
  for (const p of PRODUCERS.get(item) || []) {
    const r = RECIPES[p.r];
    if (!isKnown(g, W.mem, r.id)) continue;
    if (r.kind === 'harvest') {
      const node = Object.keys(r.keep)[0];
      if (r.tech && !g.hasTech(r.tech)) continue;
      if (!W.nodeCount(node)) {
        // no such node right now: replant it or go find one
        if (CARDS[node].tags.includes('tree') && (W.freeN('sapling') || W.count('young_tree'))) best = Math.min(best, r.t / Math.max(0.05, p.n) + 90);
        for (const e of REGION_LOOT.get(node) || []) if (W.count(e.region)) best = Math.min(best, r.t / Math.max(0.05, p.n) + CARDS[e.region].region.t / e.p);
        continue;
      }
      best = Math.min(best, r.t / Math.max(0.05, p.n));
      continue;
    }
    // crafting
    let c = (r.t * (r.night ? 3.5 : 1) * Math.max(1, r.w)) / Math.max(0.05, p.n);
    const gap = techGap(g, r.tech);
    if (gap === Infinity) continue;
    c += gap * 18;
    for (const [ref, n] of Object.entries(r.in)) {
      const sub = ref[0] === '#' ? tagCost(W, ref.slice(1), memo, depth + 1, visiting) : itemCost(W, ref, memo, depth + 1, visiting);
      c += (sub * n) / Math.max(0.05, p.n);
      if (c === Infinity) break;
    }
    for (const [ref] of Object.entries(r.keep)) {
      if (ref[0] === '#') { if (!W.tagPresent(ref.slice(1))) c += 60; continue; }
      if (!W.count(ref)) c += Math.min(400, itemCost(W, ref, memo, depth + 1, visiting)) * 0.4;
    }
    best = Math.min(best, c);
  }
  // exploring
  for (const e of REGION_LOOT.get(item) || []) {
    if (!W.count(e.region)) continue;
    best = Math.min(best, CARDS[e.region].region.t / e.p);
  }
  // hunting
  for (const e of BEAST_LOOT.get(item) || []) {
    if (!W.count(e.beast)) continue;
    best = Math.min(best, 12 / e.n);
  }
  visiting.delete(item);
  memo.set(item, best);
  return best;
}

function tagCost(W, tag, memo, depth, visiting) {
  let best = Infinity;
  for (const d of Object.values(CARDS)) {
    if (!d.tags.includes(tag)) continue;
    if (W.free(d.id).length) return 1;
    if (depth < 4) best = Math.min(best, itemCost(W, d.id, memo, depth, visiting));
  }
  return best;
}

/** food value per worker-second for harvesting a node right now */
export function foodRate(W, nodeId) {
  const nd = CARDS[nodeId].node;
  if (!nd) return 0;
  let food = 0;
  for (const [id, n] of nd.out) {
    const d = CARDS[id];
    let f = d.food || 0;
    if (d.tags.includes('raw') && W.canCook) f *= 2;
    if (id === 'grain' && W.g.hasTech('milling') && W.count('mill') && W.count('bakery')) f = 2;
    food += f * n;
  }
  return food / nd.t;
}
