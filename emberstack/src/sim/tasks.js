// Stack tasks: when a stack matches a recipe it starts working; progress advances with the
// workers' skill, tools, season, light and buildings nearby; on completion inputs are consumed and
// outputs fly out (or, for buildings, appear in place).

import { CARDS } from '../data/cards.js';
import { RECIPES, TAG_NAMES } from '../data/recipes.js';
import { matchStack } from './match.js';
import { CARD_W, CARD_H } from './constants.js';
import { startBattle, joinBattle } from './combat.js';

export function rematch(g, st) {
  st.dirty = false;
  if (st.held || st.battle || (st.mob && st.cards.length === 1)) {
    st.task = null;
    return;
  }
  const cards = st.cards.map((id) => g.s.cards[id]);
  const m = matchStack(cards, g.ctx);
  if (!m) {
    if (st.task) g.emit({ type: 'taskEnd', sid: st.id, r: st.task.r });
    st.task = null;
    return;
  }
  if (st.task && st.task.r === m.r) {
    st.task.m = m;
    return;
  }
  st.task = { r: m.r, p: 0, m, block: null };
  const r = RECIPES[m.r];
  if (r.hidden && !g.s.disc.includes(r.id)) {
    g.s.disc.push(r.id);
    g.emit({ type: 'discover', r: r.id, sid: st.id });
    g.msg(`发现隐藏配方：${r.name}！`, 'discover');
  }
  if (!g.s.used.includes(r.id)) g.s.used.push(r.id);
  g.emit({ type: 'taskStart', sid: st.id, r: r.id });
}

export function seasonMult(g, nodeDef) {
  if (!g.rules.seasons) return nodeDef.season ? nodeDef.season[g.s.forceSeason ?? 1] ?? 1 : 1;
  const s = g.season();
  if (!nodeDef.season) return 1;
  return nodeDef.season[s] ?? 1;
}

function hasLightProvider(g, st) {
  for (const id of st.cards) {
    const c = g.s.cards[id];
    if (g.cardLight(c) > 0) return true;
  }
  return false;
}

export function blockReason(g, st, r, m) {
  if (r.night && !g.isNight()) return '等待夜晚';
  if (!r.dark && g.isNight() && !g.stackLit(st)) return '太暗了';
  if (r.kind === 'harvest') {
    const node = g.s.cards[m.keep[0]];
    const nd = CARDS[node.d].node;
    if (seasonMult(g, nd) <= 0) return '冬季休眠';
    if (nd.charges > 0 && node.ch <= 0) return '等待恢复';
    if (nd.needTool) {
      const tooled = [...m.aids, ...m.workers, ...m.extra].some((id) => {
        const d = CARDS[g.s.cards[id].d];
        return d.tags.includes(nd.needTool) || (d.skills && (d.skills[nd.skill] || 1) >= 1.5);
      });
      if (!tooled) return '需要' + (TAG_NAMES[nd.needTool] || nd.needTool);
    }
    if (nd.tech && !g.hasTech(nd.tech)) return '需要科技「采矿」';
  }
  if (r.kind === 'explore') {
    const reg = CARDS[g.s.cards[m.keep[0]].d].region;
    if ((reg.need === 'light' || reg.needLight) && !hasLightProvider(g, st)) return '需要光源';
    if (reg.need === 'boat' && !m.aids.some((id) => CARDS[g.s.cards[id].d].tags.includes('boat'))) return '需要舟';
  }
  if (r.cond === 'housing') {
    if (g.rules.noBirth) return '无法繁衍';
    if (g.population() >= g.housing()) return '房屋已满';
  }
  return null;
}

export function workerMult(g, w, skill) {
  const def = CARDS[w.d];
  let m = (def.skills && def.skills[skill]) || 1;
  if (w.st && w.st.hungry) m *= 0.6;
  if (w.st && w.st.sick) m *= 0.6;
  return m;
}

export function taskSpeed(g, st, r, m) {
  let mult = 1;
  const ws = [...m.workers, ...m.extra].map((id) => g.s.cards[id]).filter(Boolean);
  if (ws.length) {
    const vals = ws.map((w) => workerMult(g, w, r.skill)).sort((a, b) => b - a);
    mult = vals[0];
    for (let i = 1; i < vals.length; i++) mult += vals[i] * 0.6;
  }
  // tools / aids: best multiplier per aid tag
  for (const a of r.aids) {
    let best = 0;
    for (const id of m.aids) {
      const d = CARDS[g.s.cards[id].d];
      if (d.tags.includes(a) && d.toolMult) best = best ? Math.max(best, d.toolMult) : d.toolMult;
    }
    if (best) mult *= best;
  }
  if (r.kind === 'harvest') {
    const nd = CARDS[g.s.cards[m.keep[0]].d].node;
    mult *= seasonMult(g, nd);
    if (g.s.flags.harvestMoon === g.s.day) mult *= 1.5;
  }
  if (r.skill === 'build' && g.hasTech('mathematics')) mult *= 1.2;
  if (r.skill === 'sail' && g.hasTech('navigation')) mult *= 1.3;
  if (Object.keys(r.keep).some((k) => CARDS[k] && CARDS[k].kind === 'structure') && g.steamBoost(st)) mult *= 1.5;
  return mult * (g.rules.workSpeed || 1);
}

export function updateTasks(g, dt) {
  for (const st of Object.values(g.s.stacks)) {
    if (st.dirty) rematch(g, st);
    const task = st.task;
    if (!task) continue;
    const r = RECIPES[task.r];
    const block = blockReason(g, st, r, task.m);
    task.block = block;
    if (block) { task.bt = (task.bt || 0) + dt; continue; }
    task.bt = 0;
    task.p += (dt * taskSpeed(g, st, r, task.m)) / r.t;
    if (task.p >= 1) complete(g, st, r, task.m);
  }
}

function harvestExtras(g, st, r, m, outs) {
  const node = g.s.cards[m.keep[0]];
  const nd = CARDS[node.d].node;
  const season = g.season();
  for (const [id, p, seasons] of nd.extra || []) {
    if (seasons && g.rules.seasons && !seasons.includes(season)) continue;
    if (g.rng.chance(p)) outs.push(id);
  }
  const workers = [...m.workers, ...m.extra].map((id) => g.s.cards[id]);
  if (nd.sting && !m.aids.some((id) => CARDS[g.s.cards[id].d].tags.includes('portable_light')) && g.rng.chance(nd.sting)) {
    const w = g.rng.pick(workers);
    if (w) { g.hurt(w, 1, '被蜂蛰了'); }
  }
  if (nd.fumes && g.rng.chance(nd.fumes)) {
    const w = g.rng.pick(workers);
    if (w) g.hurt(w, 1, '被毒气灼伤');
  }
  if (nd.healNode) for (const w of workers) if (w) g.heal(w, nd.healNode);
  let depleted = false;
  if (nd.charges > 0) {
    node.ch -= 1;
    if (node.ch <= 0 && !nd.perennial) depleted = true;
  }
  return depleted ? node : null;
}

function exploreDone(g, st, r, m, outs) {
  const region = g.s.cards[m.keep[0]];
  const rd = CARDS[region.d].region;
  const explorers = [...m.workers, ...m.extra].map((id) => g.s.cards[id]).filter(Boolean);
  const loot = region.loot || rd.loot;
  if (region.once && region.once.length) outs.push(region.once.shift());
  const n = 1 + (g.rng.chance(0.3) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const id = g.rng.weighted(loot);
    if (id) outs.push(id);
  }
  g.s.stats.explored++;
  region.ch -= 1;
  let foe = null;
  const safe = explorers.some((c) => CARDS[c.d].safeExplore) ? 0.5 : 1;
  const danger = (region.danger ?? rd.danger) * safe * (g.rules.danger ?? 1);
  const foes = region.foes || rd.foes;
  if (foes && foes.length && g.rng.chance(danger)) foe = g.rng.weighted(foes);
  return { region, rd, explorers, foe };
}

export function complete(g, st, r, m) {
  const sx = st.x, sy = st.y;
  const from = { x: sx + CARD_W / 2, y: sy + CARD_H / 2 };
  const consumed = m.consume.map((id) => g.s.cards[id]).filter(Boolean);
  const carryFrom = r.carry ? consumed.find((c) => c.d === r.carry) : null;
  const rootConsumed = consumed.some((c) => c.id === st.cards[0]);
  const outs = [];
  for (const [id, n, p] of r.out) if (p === undefined || g.rng.chance(p)) for (let i = 0; i < n; i++) outs.push(id);
  let depletedNode = null;
  let ex = null;
  if (r.kind === 'harvest') depletedNode = harvestExtras(g, st, r, m, outs);
  if (r.kind === 'explore') ex = exploreDone(g, st, r, m, outs);

  for (const c of consumed) g.removeCard(c.id, 'consume');

  const inPlace = r.fx === 'build' || r.fx === 'upgrade' || r.skill === 'train';
  // buildings and trained people appear where the materials were; the leftover workers step aside
  if (inPlace && rootConsumed && g.s.stacks[st.id]) {
    const rest = g.s.stacks[st.id];
    const spot = g.freeSpot(sx + CARD_W + 20, sy, g.stackH(rest), { exclude: rest.id });
    rest.x = spot.x;
    rest.y = spot.y;
  }
  const made = [];
  for (const id of outs) {
    const def = CARDS[id];
    const opts = {};
    if (carryFrom && def.kind === 'folk') opts.carry = carryFrom;
    if (inPlace && rootConsumed && (def.kind === 'structure' || def.kind === 'folk' || def.kind === 'wonder')) {
      opts.at = { x: sx, y: sy };
    }
    if (r.kind === 'explore') opts.near = ex.region;
    const c = g.spawn(id, from, opts);
    made.push(c);
    g.s.stats.made[id] = (g.s.stats.made[id] || 0) + 1;
  }
  if (r.effect && r.effect.fog) g.addFog(r.effect.fog, r.name);
  if (depletedNode) {
    g.removeCard(depletedNode.id, 'deplete');
  }
  if (ex) {
    if (ex.region.ch <= 0) {
      const at = g.s.stacks[ex.region.s];
      const pos = at ? { x: at.x, y: at.y } : from;
      const reveal = ex.region.reveal || ex.rd.reveal || [];
      g.removeCard(ex.region.id, 'deplete');
      for (const rid of reveal) {
        const c = g.spawn(rid, from, { at: g.freeSpot(pos.x, pos.y - 40, CARD_H) });
        g.msg(`探索到尽头，发现了「${CARDS[rid].name}」！`, 'explore');
        if (c && CARDS[rid].mob) g.initMob(c);
      }
    }
    if (ex.foe) {
      const alive = ex.explorers.filter((c) => g.s.cards[c.id]);
      if (alive.length) {
        const foe = g.spawnMob(ex.foe, from.x + 40, from.y - 160);
        const b = startBattle(g, from.x, from.y - 40);
        for (const c of alive) joinBattle(g, b, c.id, 'a');
        joinBattle(g, b, foe.id, 'b');
        g.msg(`探索时遭遇了${CARDS[ex.foe].name}！`, 'danger');
      }
    }
  }
  g.emit({ type: 'craft', r: r.id, x: from.x, y: from.y, outs: made.map((c) => c.id), fx: r.fx });
  const still = g.s.stacks[st.id];
  if (still) {
    still.task = null;
    still.dirty = true;
  }
}
