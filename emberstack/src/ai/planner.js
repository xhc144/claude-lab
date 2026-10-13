// The planner turns the situation into prioritised needs ("we need 2 wood for the campfire, which
// we need to survive the night") and expands every need backwards through the recipe graph into
// concrete jobs: harvest this node, craft that recipe, explore there, hunt that deer.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { TECHS } from '../data/techs.js';
import { PRODUCERS, REGION_LOOT, BEAST_LOOT, isKnown, techGap, itemCost, foodRate } from './knowledge.js';
import { objectiveProgress, objectiveText } from '../sim/objectives.js';
import { techStatus } from '../sim/economy.js';
import { seasonMult } from '../sim/tasks.js';

const nm = (id) => CARDS[id]?.name || id;

export function newPlan(W, strat) {
  return {
    W, strat, memo: new Map(), claimed: new Map(), claimedInc: new Map(), incPrio: new Map(), jobs: new Map(), goals: [],
    techNeed: new Map(), unmet: [], sell: [],
  };
}

function claim(P, item, n) { P.claimed.set(item, (P.claimed.get(item) || 0) + n); }
export function availFree(P, item) { return Math.max(0, P.W.freeN(item) - (P.claimed.get(item) || 0)); }

export function goal(P, name, prio, cat, detail = '') {
  P.goals.push({ name, prio: Math.round(prio), cat, detail });
}

export function addJob(P, job) {
  const ex = P.jobs.get(job.key);
  if (ex) {
    ex.prio = Math.max(ex.prio, job.prio);
    ex.n = (ex.n || 0) + (job.n || 0);
    ex.want = Math.max(ex.want || 1, job.want || 1);
    if (job.prio >= ex.prio) { ex.why = job.why; ex.cat = job.cat; }
    return ex;
  }
  P.jobs.set(job.key, { want: 1, n: 1, ...job });
  return P.jobs.get(job.key);
}

/** concrete card id for a tag requirement: a free card if any, else the cheapest producible */
export function resolveTag(P, tag) {
  const W = P.W;
  let best = null, bc = Infinity;
  for (const d of Object.values(CARDS)) {
    if (!d.tags.includes(tag)) continue;
    if (availFree(P, d.id) > 0) return d.id;
    const c = itemCost(W, d.id, P.memo);
    if (c < bc) { bc = c; best = d.id; }
  }
  return best;
}

/** request n of an item: use free stock first, then what is being made, then produce the rest */
export function need(P, item, n, prio, why, cat, depth = 0) {
  if (n <= 0 || !item) return;
  if (item[0] === '#') {
    const tag = item.slice(1);
    // satisfy from any free card carrying the tag
    let have = 0;
    for (const c of P.W.free(item)) {
      if (have >= n) break;
      const left = availFree(P, c.d);
      if (left > 0) { claim(P, c.d, 1); have++; }
    }
    if (have >= n) return;
    const id = resolveTag(P, tag);
    if (id) produce(P, id, n - have, prio, why, cat, depth);
    return;
  }
  const free = availFree(P, item);
  const take = Math.min(n, free);
  claim(P, item, take);
  let rest = n - take;
  const inc = Math.max(0, (P.W.incoming.get(item) || 0) - (P.claimedInc.get(item) || 0));
  const ti = Math.min(rest, Math.ceil(inc));
  P.claimedInc.set(item, (P.claimedInc.get(item) || 0) + ti);
  if (ti > 0) P.incPrio.set(item, Math.max(P.incPrio.get(item) || 0, prio));
  rest -= ti;
  if (rest > 0) produce(P, item, rest, prio, why, cat, depth);
}

/** all ways to get an item right now, cheapest first */
export function methodsFor(P, item) {
  const W = P.W, g = W.g;
  const out = [];
  for (const p of PRODUCERS.get(item) || []) {
    const r = RECIPES[p.r];
    if (!isKnown(g, W.mem, r.id)) continue;
    if (r.kind === 'harvest') {
      const nodeId = Object.keys(r.keep)[0];
      const nd = CARDS[nodeId].node;
      if (nd.tech && !g.hasTech(nd.tech)) {
        const gap = techGap(g, nd.tech);
        if (gap === Infinity || !W.count(nodeId)) continue;
        out.push({ kind: 'tech', tech: nd.tech, cost: gap * 20 + r.t, r: r.id });
        continue;
      }
      const nodes = W.nodes.filter((c) => c.d === nodeId && (nd.charges < 0 || c.ch > 0));
      if (!nodes.length) {
        // replant trees from saplings; otherwise look for the node out in the wild
        if (CARDS[nodeId].tags.includes('tree') && nodeId === 'tree') {
          if (W.count('young_tree')) out.push({ kind: 'wait', cost: r.t / Math.max(0.05, p.n) + 60, item: nodeId });
          else if (availFree(P, 'sapling') > 0) out.push({ kind: 'plant', cost: r.t / Math.max(0.05, p.n) + 80 });
        }
        for (const e of REGION_LOOT.get(nodeId) || []) {
          const regs = W.regions.filter((c) => c.d === e.region && c.ch > 0);
          if (regs.length) out.push({ kind: 'explore', region: regs[0], cost: r.t / Math.max(0.05, p.n) + (CARDS[e.region].region.t / e.p) * 1.4 });
        }
        continue;
      }
      const sm = seasonMult(g, nd);
      if (sm <= 0) continue;
      out.push({ kind: 'harvest', r: r.id, node: nodeId, nodes, yieldN: p.n, cost: r.t / Math.max(0.05, p.n) / sm, extra: !!p.extra });
      continue;
    }
    if (r.kind === 'explore') continue;
    const gap = techGap(g, r.tech);
    if (gap === Infinity) continue;
    if (gap > 0) {
      out.push({ kind: 'tech', tech: r.tech, cost: gap * 20 + recipeCost(P, r, p.n), r: r.id });
      continue;
    }
    const c = recipeCost(P, r, p.n);
    if (c === Infinity) continue;
    out.push({ kind: 'craft', r: r.id, yieldN: p.n, cost: c });
  }
  for (const e of REGION_LOOT.get(item) || []) {
    const regs = W.regions.filter((c) => c.d === e.region && c.ch > 0);
    if (!regs.length) continue;
    out.push({ kind: 'explore', region: regs[0], cost: (CARDS[e.region].region.t / e.p) * 1.6 });
  }
  for (const e of BEAST_LOOT.get(item) || []) {
    const bs = W.beasts.filter((c) => c.d === e.beast);
    if (!bs.length) continue;
    out.push({ kind: 'hunt', beast: bs[0], cost: 14 / e.n + CARDS[e.beast].hp * 2 });
  }
  for (const cv of W.caravans) {
    cv.offers.forEach((o, i) => {
      if (o.left <= 0) return;
      const got = o.get.find(([id]) => id === item);
      if (!got) return;
      out.push({ kind: 'buy', caravan: cv, idx: i, cost: o.give.reduce((a, [id, n]) => a + n * (id === 'coin' ? 4 : 8), 0) / got[1] });
    });
  }
  out.sort((a, b) => a.cost - b.cost);
  return out;
}

function recipeCost(P, r, yieldN) {
  const W = P.W;
  let c = (r.t * (r.night ? 3.5 : 1) * Math.max(1, r.w)) / Math.max(0.05, yieldN);
  for (const [ref, n] of Object.entries(r.in)) {
    let sub;
    if (ref[0] === '#') {
      const id = resolveTag(P, ref.slice(1));
      sub = id ? (availFree(P, id) > 0 ? 1 : itemCost(W, id, P.memo)) : Infinity;
    } else sub = availFree(P, ref) >= n ? 1 : itemCost(W, ref, P.memo);
    c += (sub * n) / Math.max(0.05, yieldN);
  }
  for (const ref of Object.keys(r.keep)) {
    if (ref[0] === '#') continue;
    if (!W.count(ref)) c += Math.min(500, itemCost(W, ref, P.memo)) * 0.35;
  }
  return c;
}

export function produce(P, item, n, prio, why, cat, depth = 0) {
  const W = P.W;
  if (depth > 6 || n <= 0) return;
  const ms = methodsFor(P, item);
  const m = ms[0];
  if (!m) {
    P.unmet.push({ item, why, prio });
    return;
  }
  const label = why;
  switch (m.kind) {
    case 'tech':
      P.techNeed.set(m.tech, Math.max(P.techNeed.get(m.tech) || 0, prio));
      break;
    case 'harvest': {
      const node = pickNode(P, m.nodes);
      const nd = CARDS[node.d].node;
      const want = Math.max(1, Math.min(1 + (nd.multi ?? 2), Math.ceil(n / 3)));
      addJob(P, { key: 'h:' + node.id, kind: 'harvest', r: m.r, site: node.id, item, n, want, prio, why: label, cat });
      if (nd.needTool && !W.workers.some((w) => (CARDS[w.d].skills?.[nd.skill] || 1) >= 1.5)) {
        const tools = W.free('#' + nd.needTool);
        if (!tools.length) need(P, '#' + nd.needTool, 1, prio + 1, '开采需要' + (nd.needTool === 'pick' ? '镐' : '工具'), cat, depth + 1);
      }
      break;
    }
    case 'craft': {
      const r = RECIPES[m.r];
      const batches = Math.max(1, Math.ceil(n / Math.max(0.3, m.yieldN)));
      for (const [ref, k] of Object.entries(r.keep)) {
        if (ref === '#worker' || ref === '#adult') continue;
        if (ref[0] === '#') {
          const tag = ref.slice(1);
          if (!W.tagPresent(tag)) {
            const id = tag === 'cook' ? 'campfire' : tag === 'house' ? 'lean_to' : resolveTag(P, tag);
            if (id) produce(P, id, 1, prio + 0.5, `${nm(item)}需要${nm(id)}`, cat, depth + 1);
          }
          continue;
        }
        const have = W.count(ref);
        if (have < k) produce(P, ref, k - have, prio + 0.5, `${nm(item)}需要${nm(ref)}`, cat, depth + 1);
      }
      const ahead = Math.min(batches, CARDS[item].kind === 'structure' ? 1 : 2);
      for (const [ref, k] of Object.entries(r.in)) need(P, ref, k * ahead, prio - 0.5, `为了${nm(item)}`, cat, depth + 1);
      addJob(P, { key: 'c:' + r.id, kind: 'craft', r: r.id, item, n: batches, prio, why: label, cat });
      break;
    }
    case 'plant':
      addJob(P, { key: 'c:plant_sapling', kind: 'craft', r: 'plant_sapling', item: 'young_tree', n: Math.min(3, availFree(P, 'sapling')), prio: prio + 2, why: label + '（种下树苗）', cat });
      break;
    case 'wait':
      break;
    case 'explore':
      addJob(P, { key: 'e:' + m.region.id, kind: 'explore', r: 'explore_' + m.region.d, site: m.region.id, item, prio: prio * 0.8, why: label + '（去探索' + nm(m.region.d) + '）', cat });
      break;
    case 'hunt':
      addJob(P, { key: 'hunt:' + m.beast.id, kind: 'hunt', target: m.beast.id, item, prio, why: label + '（狩猎' + nm(m.beast.d) + '）', cat });
      break;
    case 'buy':
      addJob(P, { key: 'buy:' + m.caravan.id + ':' + m.idx, kind: 'trade', caravan: m.caravan.id, idx: m.idx, item, prio, why: label + '（向商队购买）', cat });
      break;
  }
}

function pickNode(P, nodes) {
  const W = P.W;
  const a = W.anchor;
  let best = null, bs = -Infinity;
  for (const c of nodes) {
    const st = W.g.s.stacks[c.s];
    if (!st) continue;
    let s = 0;
    const p = W.g.cardPos(c);
    s -= Math.hypot(p.x - a.x, p.y - a.y) / 200;
    if (st.task) s += 2; // join a node already being worked
    if (W.nightLit(p.x, p.y)) s += 1.5;
    s += Math.min(3, (c.ch < 0 ? 5 : c.ch) / 2);
    if (st.battle) s -= 100;
    if (W.threats.some((t) => t.d.mob?.beh === 'boss' && !(t.c.ai && t.c.ai.act) && Math.hypot(t.p.x - p.x, t.p.y - p.y) < 450)) s -= 50;
    if (s > bs) { bs = s; best = c; }
  }
  return best || nodes[0];
}

// ------------------------------------------------------------------------- food & fuel --------------

/** food is fungible: pick the best food sources available and staff them */
export function needFood(P, units, prio, why, workers = 1) {
  const W = P.W, g = W.g;
  if (units <= 0) return;
  const cands = [];
  for (const c of W.nodes) {
    const d = CARDS[c.d];
    const nd = d.node;
    if (!nd || !nd.out.some(([id]) => CARDS[id].food > 0 || id === 'grain')) continue;
    if (nd.charges > 0 && c.ch <= 0) continue;
    if (nd.tech && !g.hasTech(nd.tech)) continue;
    const sm = seasonMult(g, nd);
    if (sm <= 0) continue;
    const st = g.s.stacks[c.s];
    if (!st || st.battle) continue;
    let rate = foodRate(W, c.d) * sm;
    if (nd.charges > 0) rate *= Math.min(1, c.ch / 3);
    cands.push({ c, rate, r: 'harvest_' + c.d });
  }
  // milk a goat
  for (const goat of W.free('domestic_goat')) cands.push({ c: goat, rate: 2 / 12, r: 'milk_goat', craftSite: true });
  cands.sort((a, b) => b.rate - a.rate);
  // staff as many workers as the shortfall calls for, best sources first
  const horizon = Math.max(20, (1 - W.phase) * W.dayLen);
  let covered = 0;
  let staffed = 0;
  for (const cd of cands) {
    if (covered >= units && staffed >= workers) break;
    const nd = CARDS[cd.c.d].node;
    const want = Math.max(1, Math.min(1 + (nd ? nd.multi ?? 2 : 0), workers - staffed, Math.ceil((units - covered) / Math.max(0.5, cd.rate * horizon))));
    staffed += want;
    if (cd.craftSite) addJob(P, { key: 'c:milk:' + cd.c.id, kind: 'craft', r: cd.r, site: cd.c.id, item: 'milk', n: 1, prio, why, cat: '生存' });
    else addJob(P, { key: 'h:' + cd.c.id, kind: 'harvest', r: cd.r, site: cd.c.id, item: 'food', n: units, want, prio, why, cat: '生存' });
    covered += cd.rate * horizon * want;
  }
  // hunting is quick food
  for (const b of W.beasts) {
    if (covered >= units) break;
    const d = CARDS[b.d];
    const meat = (d.mob.loot || []).filter(([id]) => CARDS[id].food > 0).reduce((a, [id, n]) => a + n * (CARDS[id].food || 0) * (W.canCook ? 3 : 1), 0);
    if (meat <= 0) continue;
    if (d.atk >= 3 && W.strengthVs(d.traits || []) < (d.hp * d.atk) * 3) continue;
    addJob(P, { key: 'hunt:' + b.id, kind: 'hunt', target: b.id, item: 'food', prio: prio - 2, why: why + '（狩猎' + d.name + '）', cat: '生存' });
    covered += meat;
  }
  // processing chains: farms, bread
  if (covered < units && g.hasTech('farming') && !W.count('field') && W.season !== 3) produce(P, 'field', 1, prio - 8, '开垦田地，长久之计', '生存');
  if (covered < units * 0.5) P.unmet.push({ item: 'food', why, prio });
}

// ------------------------------------------------------------------------- objectives ---------------

export function objectiveNeeds(P) {
  const W = P.W, g = W.g, S = P.strat;
  const base = 62 * S.objective;
  for (const o of g.s.objectives) {
    const pr = objectiveProgress(g, o);
    if (pr.cur >= pr.need) continue;
    const frac = pr.need ? pr.cur / pr.need : 0;
    const prio = Math.min(98, base + 8 * frac);
    const why = '目标：' + objectiveText(o);
    switch (o.type) {
      case 'build': {
        const have = W.cards.filter((c) => c.d === o.card).length;
        const lit = o.lit ? W.cards.filter((c) => c.d === o.card && g.cardLight(c) > 0).length : have;
        goal(P, '建造' + nm(o.card), prio, '目标', `${pr.cur}/${pr.need}`);
        if (have < pr.need) produce(P, o.card, pr.need - have, prio, why || '目标：建造' + nm(o.card), '目标');
        if (o.lit && lit < pr.need) P.relight = (P.relight || []).concat(o.card);
        break;
      }
      case 'have':
        goal(P, '拥有' + nm(o.card), prio, '目标', `${pr.cur}/${pr.need}`);
        need(P, o.card, pr.need, prio, '目标：拥有' + nm(o.card), '目标');
        break;
      case 'made':
        goal(P, '制作' + nm(o.card), prio, '目标', `${pr.cur}/${pr.need}`);
        produce(P, o.card, pr.need - pr.cur, prio, '目标：制作' + nm(o.card), '目标');
        break;
      case 'pop':
        goal(P, '人口 ' + pr.need, prio, '目标', `${pr.cur}/${pr.need}`);
        P.popTarget = Math.max(P.popTarget || 0, pr.need);
        P.popPrio = Math.max(P.popPrio || 0, prio);
        break;
      case 'research':
        goal(P, o.tech ? '研究' + TECHS[o.tech].name : `研究 ${pr.need} 项`, prio, '目标', `${pr.cur}/${pr.need}`);
        if (o.tech) P.techNeed.set(o.tech, Math.max(P.techNeed.get(o.tech) || 0, prio));
        else P.researchCount = prio;
        break;
      case 'kill':
        goal(P, '击败' + nm(o.card), prio, '战斗', `${pr.cur}/${pr.need}`);
        P.killTargets = (P.killTargets || []).concat({ card: o.card, prio });
        break;
      case 'explore':
        goal(P, `探索 ${pr.need} 次`, prio, '探索', `${pr.cur}/${pr.need}`);
        P.exploreBoost = Math.max(P.exploreBoost || 0, prio);
        break;
      case 'deliver': {
        goal(P, '献上' + nm(o.card), prio, '目标', `${pr.cur}/${pr.need}`);
        const altar = W.cards.find((c) => CARDS[c.d].deliver);
        const left = pr.need - pr.cur;
        const free = W.free(o.card);
        if (altar && free.length) addJob(P, { key: 'deliver:' + o.card, kind: 'deliver', target: altar.id, item: o.card, n: Math.min(left, free.length), prio: prio + 3, why: '把' + nm(o.card) + '献上祭坛', cat: '目标' });
        if (free.length < left) produce(P, o.card, left - free.length, prio, '目标：献上' + nm(o.card), '目标');
        break;
      }
      case 'discover':
        goal(P, `发现 ${pr.need} 个隐藏配方`, prio, '实验', `${pr.cur}/${pr.need}`);
        P.experimentBoost = Math.max(P.experimentBoost || 0, prio);
        break;
      case 'fog':
        goal(P, `灰雾 < ${o.below}%`, prio + 6, '目标', `${Math.round(g.s.fog)}%`);
        P.fogTarget = Math.min(P.fogTarget ?? 100, o.below);
        P.fogPrio = Math.max(P.fogPrio || 0, prio + 6);
        break;
      case 'survive':
        goal(P, `坚持 ${pr.need} 天`, 40, '生存', `${pr.cur}/${pr.need}`);
        break;
      case 'coins':
      case 'earn':
        goal(P, o.type === 'coins' ? `积攒 ${pr.need} 铜贝` : `赚取 ${pr.need} 铜贝`, prio, '经济', `${pr.cur}/${pr.need}`);
        P.coinTarget = Math.max(P.coinTarget || 0, o.type === 'coins' ? pr.need : g.coinValue() + (pr.need - pr.cur));
        P.coinPrio = prio;
        break;
      case 'food':
        goal(P, `储备 ${pr.need} 份食物`, prio, '生存', `${pr.cur}/${pr.need}`);
        P.foodTarget = Math.max(P.foodTarget || 0, pr.need * 1.05);
        P.foodTargetPrio = prio;
        break;
      case 'soldiers':
        goal(P, `${pr.need} 名士兵`, prio, '战斗', `${pr.cur}/${pr.need}`);
        P.soldierTarget = Math.max(P.soldierTarget || 0, pr.need);
        P.soldierPrio = prio;
        break;
      case 'lights':
        goal(P, `点亮 ${pr.need} 处光源`, prio, '目标', `${pr.cur}/${pr.need}`);
        produce(P, cheapestLight(P), pr.need - pr.cur, prio, '目标：点亮更多光源', '目标');
        break;
      case 'festival':
        goal(P, `举办 ${pr.need} 次庆典`, prio, '目标', `${pr.cur}/${pr.need}`);
        if (!W.count('festival_ground')) produce(P, 'festival_ground', 1, prio, '需要庆典台', '目标');
        if (W.freeN('feast')) addJob(P, { key: 'festival', kind: 'deliver', target: W.cards.find((c) => c.d === 'festival_ground')?.id, item: 'feast', n: 1, prio: prio + 2, why: '举办庆典', cat: '目标' });
        else produce(P, 'feast', 1, prio, '准备盛宴', '目标');
        break;
      case 'trade':
        goal(P, `交易 ${pr.need} 次`, prio, '经济', `${pr.cur}/${pr.need}`);
        P.tradeWanted = prio;
        break;
      default:
        break;
    }
  }
}

export function cheapestLight(P) {
  const g = P.W.g;
  const opts = ['torch_post', 'shrine', 'lamp_post', 'watchtower', 'campfire'].filter((id) => {
    const rs = (PRODUCERS.get(id) || []).map((p) => RECIPES[p.r]);
    return rs.some((r) => techGap(g, r.tech) !== Infinity);
  });
  opts.sort((a, b) => itemCost(P.W, a, P.memo) - itemCost(P.W, b, P.memo));
  return opts[0] || 'campfire';
}

/** pick the tech to work towards: what plans require, what objectives demand, what the situation asks */
export function chooseTech(P) {
  const W = P.W, g = W.g, S = P.strat;
  const scores = [];
  const cands = Object.keys(TECHS).filter((id) => !g.hasTech(id) && g.techAllowed(id));
  for (const id of cands) {
    const t = TECHS[id];
    const st = techStatus(g, id);
    const prereqOk = t.req.every((r) => g.hasTech(r));
    if (!prereqOk) continue;
    let s = 10 * S.research - t.cost * 1.5;
    // needed (directly or as a prerequisite of something needed)
    for (const [tn, pr] of P.techNeed) {
      if (tn === id) s += pr * 1.2;
      else if (isPrereq(id, tn, g)) s += pr * 0.9;
    }
    // situational value
    const R = g.rules;
    if (id === 'cooking') s += 30;
    if (id === 'torches' && (R.shades || R.dark)) s += 26;
    if (id === 'lore' && (R.fogRate > 0 || R.shades)) s += 24 + g.s.fog / 3;
    if (id === 'hunting' && (W.hostiles.length || W.warnings.length || W.lairs.length)) s += 22;
    if (id === 'shelter') s += 20;
    if (id === 'farming' && R.seasons) s += 28;
    if (id === 'storage' && R.seasons && W.daysToWinter <= 8) s += 30;
    if (id === 'archery' && W.threats.some((x) => x.d.traits.includes('flying'))) s += 40;
    if (id === 'herbalism' && W.people.some((p) => p.st && p.st.sick)) s += 30;
    if (id === 'stone_tools') s += 18;
    if (id === 'fishing' && W.count('river') + W.count('pond')) s += 10;
    if (id === 'writing' || id === 'philosophy') s += 8 * S.research;
    if (id === 'masonry' && R.cold) s += 15;
    if (id === 'curing' && R.seasons && W.count('salt_flat') && W.daysToWinter <= 8) s += 26;
    if (id === 'husbandry' && R.cold) s += 18;
    if (id === 'tactics' && (W.lairs.length || P.killTargets)) s += 12;
    scores.push([id, s, st.ok]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  return scores.length && scores[0][1] > 0 ? scores[0][0] : null;
}

function isPrereq(a, b, g) {
  const seen = new Set();
  let found = false;
  (function walk(t) {
    if (found || seen.has(t) || g.hasTech(t)) return;
    seen.add(t);
    for (const r of TECHS[t].req) {
      if (r === a) { found = true; return; }
      walk(r);
    }
  })(b);
  return found;
}
