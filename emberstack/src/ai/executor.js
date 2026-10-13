// Turning a job into physical moves. Every move goes through the same g.act* calls the mouse uses:
// pick up a card (and whatever lies on it), drop it somewhere. Steps resolve their cards at the
// moment they run, so piles that changed in the meantime are handled gracefully.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { CARD_W, CARD_H } from '../sim/constants.js';

const matches = (c, ref) => (ref[0] === '#' ? CARDS[c.d].tags.includes(ref.slice(1)) : c.d === ref);

/** how many cards from the top of a stack match ref (a pile run) */
export function topRun(g, st, ref) {
  let n = 0;
  for (let i = st.cards.length - 1; i >= 0; i--) {
    const c = g.s.cards[st.cards[i]];
    if (!matches(c, ref)) break;
    if (n > 0 && c.d !== g.s.cards[st.cards[st.cards.length - 1]].d) break;
    n++;
  }
  return n;
}

export class Exec {
  constructor(job, steps, opts = {}) {
    this.job = job;
    this.steps = steps;
    this.i = 0;
    this.site = opts.site || null; // card id of the site's root
    this.lockIds = new Set(opts.lock || []);
    this.wait = 0;
    this.state = 'run';
    this.born = 0;
    this.verify = opts.verify || null;
    this.label = opts.label || job.why;
  }
}

/** choose a free, lit spot near the camp for a new work stack */
export function workSpot(brain, g, W, h = CARD_H, avoid = null) {
  const a = W.anchor;
  const nl = W.nightLights;
  const cands = [];
  for (let ring = 1; ring <= 7; ring++) {
    const r = ring * 85;
    const n = 6 + ring * 4;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + ring * 0.37;
      const x = a.x + Math.cos(ang) * r * 1.2 - CARD_W / 2;
      const y = a.y + Math.sin(ang) * r - CARD_H / 2;
      cands.push([x, y, ring]);
    }
  }
  let fallback = null;
  const danger = W.threats.filter((t) => ['boss', 'lair'].includes(t.d.mob?.beh) || t.d.kind === 'lair').map((t) => t.p)
    .concat(W.lairs.map((l) => g.cardPos(l)));
  for (const [x, y] of cands) {
    const spot = g.freeSpot(x, y, h, { exclude: avoid });
    if (Math.hypot(spot.x - x, spot.y - y) > 30) continue;
    const cx = spot.x + CARD_W / 2, cy = spot.y + CARD_H / 2;
    if (danger.some((p) => Math.hypot(p.x - cx, p.y - cy) < 520)) continue;
    if (!nl.length || nl.some((L) => Math.hypot(L.x - cx, L.y - cy) < L.r - 45)) return spot;
    if (!fallback) fallback = spot;
  }
  return fallback || g.freeSpot(a.x + 140, a.y, h, { exclude: avoid });
}

/** find a source for n cards matching ref: prefer the biggest pile run that is free */
function findSource(brain, g, ref, exclude) {
  let best = null, bn = 0;
  for (const st of Object.values(g.s.stacks)) {
    if (st.held || st.battle || st.mob || exclude.has(st.id)) continue;
    const run = topRun(g, st, ref);
    if (!run) continue;
    // the run's cards must be free and not reserved
    const top = g.s.cards[st.cards[st.cards.length - 1]];
    if (!g.isFree(top) || brain.locked.has(top.id)) continue;
    // never strip a running task's inputs
    if (st.task) continue;
    if (run > bn) { bn = run; best = st; }
  }
  return best ? { st: best, run: bn } : null;
}

/** run the next step of an execution; returns 'act' (used an action), 'wait', 'done' or 'fail' */
export function runStep(brain, g, ex) {
  if (ex.state !== 'run') return ex.state;
  const step = ex.steps[ex.i];
  if (!step) {
    // verification
    if (ex.verify) {
      const sc = g.s.cards[ex.site];
      const st = sc && g.s.stacks[sc.s];
      if (st && st.task && st.task.r === ex.verify) { ex.state = 'done'; return 'done'; }
      ex.wait += 1;
      if (ex.wait > 6) { ex.state = 'fail'; ex.why = '组合没有生效'; return 'fail'; }
      return 'wait';
    }
    ex.state = 'done';
    return 'done';
  }
  const res = doStep(brain, g, ex, step);
  if (res === 'next') { ex.i++; return 'wait'; }
  if (res === 'act') { ex.i++; return 'act'; }
  if (res === 'actRepeat') return 'act';
  if (res === 'fail') { ex.state = 'fail'; return 'fail'; }
  return res;
}

function siteStack(g, ex) {
  const c = g.s.cards[ex.site];
  return c ? g.s.stacks[c.s] : null;
}

function doStep(brain, g, ex, step) {
  const who = 'ai';
  switch (step.op) {
    case 'makeSite': {
      // take `n` cards of `ref` from a pile and lay them at a work spot
      const src = findSource(brain, g, step.ref, new Set());
      if (!src) { ex.why = '缺少' + (CARDS[step.ref]?.name || step.ref); return 'fail'; }
      const k = Math.min(step.n, src.run);
      const card = g.s.cards[src.st.cards[src.st.cards.length - k]];
      const spot = step.at || workSpot(brain, g, brain.W, CARD_H + 30 * (step.total || 3), src.st.id);
      const r = g.actMove(card.id, spot.x, spot.y, who);
      if (!r.ok) { ex.why = r.why; return 'fail'; }
      ex.site = card.id;
      ex.lockIds.add(card.id);
      if (k < step.n) {
        ex.steps.splice(ex.i + 1, 0, { op: 'bring', ref: step.ref, n: step.n - k });
      }
      return 'act';
    }
    case 'bring': {
      const site = siteStack(g, ex);
      if (!site) { ex.why = '工作点消失了'; return 'fail'; }
      let left = step.n;
      if (left <= 0) return 'next';
      const src = findSource(brain, g, step.ref, new Set([site.id]));
      if (!src) {
        if (step.optional) return 'next';
        ex.why = '缺少' + (CARDS[step.ref]?.name || step.ref);
        return 'fail';
      }
      const k = Math.min(left, src.run);
      const card = g.s.cards[src.st.cards[src.st.cards.length - k]];
      const r = g.actDrop(card.id, ex.site, who);
      if (!r.ok) { ex.why = r.why; return 'fail'; }
      step.n -= k;
      return step.n > 0 ? 'actRepeat' : 'act';
    }
    case 'bringCard': {
      const site = siteStack(g, ex);
      const c = g.s.cards[step.id];
      if (!site || !c) { if (step.optional) return 'next'; ex.why = '人或物不在了'; return 'fail'; }
      if (site.cards.includes(c.id)) return 'next';
      const st = g.s.stacks[c.s];
      if (!st || st.battle) { if (step.optional) return 'next'; ex.why = '正在战斗'; return 'fail'; }
      // clear whatever lies on top of the card first
      const i = st.cards.indexOf(c.id);
      if (i < st.cards.length - 1) {
        const above = st.cards[i + 1];
        const spot = g.freeSpot(st.x + CARD_W + 20, st.y, CARD_H + 40, { exclude: st.id });
        const r0 = g.actMove(above, spot.x, spot.y, who);
        return r0.ok ? 'actRepeat' : 'fail';
      }
      const r = g.actDrop(c.id, ex.site, who);
      if (!r.ok) { if (step.optional) return 'next'; ex.why = r.why; return 'fail'; }
      return 'act';
    }
    case 'clearSite': {
      const site = siteStack(g, ex);
      if (!site) { ex.why = '工作点消失了'; return 'fail'; }
      if (site.task && !step.keepTask) {
        ex.why = '工作点正忙';
        return 'fail';
      }
      const keep = new Set(step.keep || []);
      // remove the lowest card that is not wanted (everything above it comes off together)
      for (let i = 1; i < site.cards.length; i++) {
        const c = g.s.cards[site.cards[i]];
        if (keep.has(c.d)) continue;
        const spot = g.freeSpot(site.x - CARD_W - 30, site.y, CARD_H + 60, { exclude: site.id });
        const r = g.actMove(c.id, spot.x, spot.y, who);
        return r.ok ? 'actRepeat' : 'fail';
      }
      return 'next';
    }
    case 'relocate': {
      // bring a site into the light (or to a chosen spot)
      const site = siteStack(g, ex);
      if (!site) return 'next';
      const root = g.s.cards[site.cards[0]];
      if (CARDS[root.d].fixed) return 'next';
      const cx = site.x + CARD_W / 2, cy = site.y + CARD_H / 2;
      if (!step.force && brain.W.nightLit(cx, cy, 20)) return 'next';
      if (site.task && !step.force) return 'next';
      const spot = workSpot(brain, g, brain.W, g.stackH(site) + 20, site.id);
      const lit = brain.W.nightLights.some((L) => Math.hypot(L.x - spot.x - CARD_W / 2, L.y - spot.y - CARD_H / 2) < L.r - 30);
      if (!lit && !step.force) return 'next';
      const r = g.actMove(root.id, spot.x, spot.y, who);
      return r.ok ? 'act' : 'next';
    }
    case 'drop': {
      // drop a specific card onto a target card (clearing anything stacked on it first)
      const c = g.s.cards[step.id];
      const t = g.s.cards[step.target];
      if (!c || !t) { ex.why = '目标不在了'; return step.optional ? 'next' : 'fail'; }
      const cst = g.s.stacks[c.s];
      const ci = cst ? cst.cards.indexOf(c.id) : -1;
      if (cst && !cst.battle && ci >= 0 && ci < cst.cards.length - 1 && !step.whole) {
        const above = cst.cards[ci + 1];
        const spot = g.freeSpot(cst.x + CARD_W + 20, cst.y, CARD_H + 40, { exclude: cst.id });
        const r0 = g.actMove(above, spot.x, spot.y, who);
        return r0.ok ? 'actRepeat' : (step.optional ? 'next' : 'fail');
      }
      const r = g.actDrop(c.id, t.id, who);
      if (!r.ok) { ex.why = r.why; return step.optional ? 'next' : 'fail'; }
      return 'act';
    }
    case 'dropRef': {
      // drop n cards matching ref (from piles) onto a target card
      const t = g.s.cards[step.target];
      if (!t) { ex.why = '目标不在了'; return 'fail'; }
      if (step.n <= 0) return 'next';
      const tst = g.s.stacks[t.s];
      const src = findSource(brain, g, step.ref, new Set([tst ? tst.id : -1]));
      if (!src) { if (step.optional) return 'next'; ex.why = '缺少' + (CARDS[step.ref]?.name || step.ref); return 'fail'; }
      const k = Math.min(step.n, src.run, step.each || 99);
      const card = g.s.cards[src.st.cards[src.st.cards.length - k]];
      const r = g.actDrop(card.id, t.id, who);
      if (!r.ok) { ex.why = r.why; return 'fail'; }
      step.n -= k;
      return step.n > 0 ? 'actRepeat' : 'act';
    }
    case 'move': {
      const c = g.s.cards[step.id];
      if (!c) return 'next';
      const r = g.actMove(c.id, step.x, step.y, who);
      return r.ok ? 'act' : 'next';
    }
    case 'note': {
      // let the brain record the experiment's outcome before the cards are put back
      if (ex.onNote) ex.onNote();
      return 'next';
    }
    case 'scatter': {
      // undo an experiment that did nothing: put the cards back where they belong
      const site = siteStack(g, ex);
      if (!site || site.task || site.cards.length < 2) return 'next';
      const top = g.s.cards[site.cards[site.cards.length - 1]];
      const pile = Object.values(g.s.stacks).find((s2) => s2 !== site && !s2.task && !s2.mob && !s2.battle && !s2.held && s2.cards.length < 25 && s2.cards.every((id) => g.s.cards[id].d === top.d));
      const r = pile ? g.actDrop(top.id, pile.cards[0], who) : g.actMove(top.id, ...Object.values(g.freeSpot(site.x + CARD_W + 30, site.y, CARD_H, { exclude: site.id })), who);
      return r.ok ? 'actRepeat' : 'next';
    }
    case 'wait': {
      if (step.until === undefined) step.until = g.s.t + (step.dur || 1.2);
      return g.s.t >= step.until ? 'next' : 'wait';
    }
    case 'research': {
      const r = g.actResearch(step.tech, who);
      if (!r.ok) { ex.why = r.why; return 'fail'; }
      return 'act';
    }
    case 'open': {
      const r = g.actOpen(step.id, who);
      return r.ok ? 'act' : 'fail';
    }
    case 'trade': {
      const r = g.actTrade(step.id, step.idx, who);
      if (!r.ok) { ex.why = r.why; return 'fail'; }
      return 'act';
    }
    case 'buy': {
      const r = g.actBuy(step.id, step.offer, who);
      if (!r.ok) { ex.why = r.why; return 'fail'; }
      return 'act';
    }
    case 'choose': {
      const r = g.actChoose(step.id, step.idx, who);
      if (!r.ok) { ex.why = r.why; return 'fail'; }
      return 'act';
    }
    default:
      return 'next';
  }
}

/** recipe slots that need bringing, split into the site card, inputs, kept extras, tools and workers */
export function recipeLayout(r) {
  const siteRefs = [];
  const extraKeep = [];
  for (const [ref, n] of Object.entries(r.keep)) {
    if (ref === '#worker' || ref === '#adult') continue;
    const bottom = ref[0] === '#' ? ['cook', 'house', 'research'].includes(ref.slice(1)) : ['structure', 'node', 'region', 'wonder'].includes(CARDS[ref].kind) || CARDS[ref].tags.includes('livestock');
    if (bottom && !siteRefs.length) siteRefs.push(ref);
    else extraKeep.push([ref, n]);
  }
  return { siteRef: siteRefs[0] || null, extraKeep, inputs: Object.entries(r.in) };
}

export function recipeName(id) { return RECIPES[id]?.name || id; }
