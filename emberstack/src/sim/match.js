// Recipe matching. A stack matches a recipe when its cards can be assigned to the recipe's slots
// (consumed inputs, kept inputs, workers) and every card left over is an allowed extra: another
// worker (up to `multi`), one helper per aid tag, one portable light, or — for batch recipes —
// another copy of a consumed input. The most specific recipe (most slots) wins.
//
// Matching works on counts of interchangeable cards rather than on individual cards, so piles of
// twenty identical cards cost nothing extra.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';

const byKey = new Map(); // def id or '#tag' -> [recipe]
const ORDER = new Map();
let i = 0;
for (const r of Object.values(RECIPES)) {
  ORDER.set(r.id, i++);
  const refs = new Set([...Object.keys(r.in), ...Object.keys(r.keep)]);
  for (const ref of refs) {
    if (!byKey.has(ref)) byKey.set(ref, []);
    byKey.get(ref).push(r);
  }
}

/** recipes in which a given card (def) can take part as an input */
export function recipesUsing(defId) {
  const def = CARDS[defId];
  const out = new Set(byKey.get(defId) || []);
  for (const t of def.tags) for (const r of byKey.get('#' + t) || []) out.add(r);
  return [...out];
}

function fits(key, ref, ctx) {
  if (ref === '#worker') return key.worker;
  if (ref[0] === '#') return key.tags.has(ref.slice(1));
  return key.def === ref && !key.inactive;
}

/**
 * Build the interchangeable groups of a stack: one group per (def, inactive) pair.
 * ctx.isActive(card) tells whether a worker can work right now (automatons need oil).
 */
function groupsOf(cards, ctx) {
  const map = new Map();
  for (const c of cards) {
    const def = CARDS[c.d];
    const inactive = def.tags.includes('worker') && ctx && ctx.isActive && !ctx.isActive(c);
    const k = c.d + (inactive ? '!' : '');
    let g = map.get(k);
    if (!g) {
      g = { k, def: c.d, inactive, tags: new Set(def.tags), worker: def.tags.includes('worker') && !inactive, ids: [] };
      map.set(k, g);
    }
    g.ids.push(c.id);
  }
  return [...map.values()];
}

function slotsOf(r) {
  const slots = [];
  for (const [ref, n] of Object.entries(r.in)) slots.push({ ref, n, kind: 'in' });
  for (const [ref, n] of Object.entries(r.keep)) slots.push({ ref, n, kind: 'keep' });
  if (r.w) slots.push({ ref: '#worker', n: r.w, kind: 'w' });
  // exact refs first, then tags, workers last
  slots.sort((a, b) => rank(a) - rank(b));
  return slots;
}
function rank(s) { return s.ref === '#worker' ? 2 : s.ref[0] === '#' ? 1 : 0; }

const SLOT_CACHE = new Map();
function cachedSlots(r) {
  let s = SLOT_CACHE.get(r.id);
  if (!s) SLOT_CACHE.set(r.id, (s = slotsOf(r)));
  return s;
}

/** try to match one recipe; returns an allocation or null */
export function tryRecipe(r, cards, ctx) {
  const groups = groupsOf(cards, ctx);
  const slots = cachedSlots(r);
  const total = slots.reduce((a, s) => a + s.n, 0);
  if (total > cards.length) return null;
  const avail = groups.map((g) => g.ids.length);
  const alloc = slots.map(() => new Map()); // slot index -> group index -> count

  const leftoverOk = () => {
    let extraW = 0;
    const aidUsed = new Set();
    let lightUsed = false;
    const consumedDefs = new Set();
    for (let s = 0; s < slots.length; s++) if (slots[s].kind === 'in') for (const gi of alloc[s].keys()) consumedDefs.add(groups[gi].def);
    const aids = r.aids;
    const allowLight = r.w > 0 || r.kind === 'explore';
    for (let gi = 0; gi < groups.length; gi++) {
      let left = avail[gi];
      if (!left) continue;
      const g = groups[gi];
      if (r.batch && consumedDefs.has(g.def)) continue;
      if (g.worker && r.w > 0) {
        const take = Math.min(left, r.multi - extraW);
        extraW += take;
        left -= take;
      }
      while (left > 0) {
        let ok = false;
        for (const a of aids) {
          if (!aidUsed.has(a) && g.tags.has(a)) { aidUsed.add(a); ok = true; break; }
        }
        if (!ok && allowLight && !lightUsed && g.tags.has('portable_light')) { lightUsed = true; ok = true; }
        if (!ok) return false;
        left--;
      }
    }
    return true;
  };

  const rec = (si) => {
    if (si === slots.length) return leftoverOk();
    const slot = slots[si];
    const cand = [];
    for (let gi = 0; gi < groups.length; gi++) if (avail[gi] > 0 && fits(groups[gi], slot.ref, ctx)) cand.push(gi);
    // distribute slot.n among candidate groups
    const dist = (ci, need) => {
      if (need === 0) return rec(si + 1);
      if (ci >= cand.length) return false;
      const gi = cand[ci];
      const max = Math.min(need, avail[gi]);
      for (let take = max; take >= 0; take--) {
        if (take) { avail[gi] -= take; alloc[si].set(gi, take); }
        if (dist(ci + 1, need - take)) return true;
        if (take) { avail[gi] += take; alloc[si].delete(gi); }
      }
      return false;
    };
    return dist(0, slot.n);
  };

  if (!rec(0)) return null;

  // concrete card ids; consumed cards are taken from the top of each group, kept from the bottom
  const used = new Set();
  const take = (gi, n, fromTop) => {
    const ids = groups[gi].ids.filter((id) => !used.has(id));
    const pick = fromTop ? ids.slice(-n) : ids.slice(0, n);
    for (const id of pick) used.add(id);
    return pick;
  };
  const res = { r: r.id, consume: [], keep: [], workers: [], extra: [], aids: [], score: total };
  // workers: best skill first
  for (let s = 0; s < slots.length; s++) {
    for (const [gi, n] of alloc[s]) {
      const ids = take(gi, n, slots[s].kind === 'in');
      if (slots[s].kind === 'in') res.consume.push(...ids);
      else if (slots[s].kind === 'keep') res.keep.push(...ids);
      else res.workers.push(...ids);
    }
  }
  for (const c of cards) {
    if (used.has(c.id)) continue;
    const def = CARDS[c.d];
    if (r.w > 0 && def.tags.includes('worker') && res.extra.length < r.multi && (!ctx || !ctx.isActive || ctx.isActive(c))) res.extra.push(c.id);
    else if (r.aids.some((a) => def.tags.includes(a)) || def.tags.includes('portable_light')) res.aids.push(c.id);
  }
  return res;
}

const MATCH_CACHE = new Map();

/**
 * Best recipe for a stack of cards. ctx: { hasTech(id), isActive(card), techVersion }
 * Hidden recipes always work (that is how they are discovered); tech-gated recipes need the tech.
 */
export function matchStack(cards, ctx) {
  if (!cards.length) return null;
  const key = (ctx.techVersion || 0) + '|' + cards.map((c) => c.d + (ctx.isActive && CARDS[c.d].tags.includes('worker') && !ctx.isActive(c) ? '!' : '')).sort().join(',');
  let rid = MATCH_CACHE.get(key);
  if (rid === undefined) {
    rid = null;
    let best = null;
    const cand = new Set();
    for (const c of cards) {
      for (const r of byKey.get(c.d) || []) cand.add(r);
      for (const t of CARDS[c.d].tags) for (const r of byKey.get('#' + t) || []) cand.add(r);
    }
    for (const r of cand) {
      if (r.tech && !ctx.hasTech(r.tech)) continue;
      const m = tryRecipe(r, cards, ctx);
      if (!m) continue;
      if (!best || m.score > best.score || (m.score === best.score && ORDER.get(m.r) < ORDER.get(best.r))) best = m;
    }
    rid = best ? best.r : null;
    if (MATCH_CACHE.size > 20000) MATCH_CACHE.clear();
    MATCH_CACHE.set(key, rid);
    return best;
  }
  if (!rid) return null;
  return tryRecipe(RECIPES[rid], cards, ctx);
}

export function clearMatchCache() { MATCH_CACHE.clear(); }
