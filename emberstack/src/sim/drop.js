// Picking up and dropping cards — the only way anyone (player or AI) changes the board.
// Dropping onto a stack first lets the target absorb what it can use (fuel into a fire, food into a
// granary, goods into a market, gear onto a person …), then stacks the rest on top.

import { CARDS } from '../data/cards.js';
import { MAX_STACK, CARD_W, CARD_H } from './constants.js';
import { matchStack } from './match.js';
import { startBattle, joinBattle, leaveBattle } from './combat.js';

export const GREAT_FLAME_STAGES = [
  { name: '地基', need: { stone: 10, brick: 8 } },
  { name: '骨架', need: { iron: 6, gear: 4, glass: 2 } },
  { name: '火心', need: { ember_shard: 4, holy_flame: 1 } },
];

const BOTTOM_ONLY = new Set(['structure', 'node', 'region', 'wonder', 'lair', 'enemy', 'event']);

export function canPick(g, c) {
  if (!c) return { ok: false, why: '卡牌不存在' };
  const def = CARDS[c.d];
  const st = g.s.stacks[c.s];
  if (!st) return { ok: false, why: '卡牌不存在' };
  if (st.held) return { ok: false, why: '正被拿起' };
  if (def.fixed) return { ok: false, why: '无法移动' };
  if (def.kind === 'enemy' || def.kind === 'lair') return { ok: false, why: '敌人无法移动' };
  if (def.kind === 'beast' && !def.tags.includes('livestock') && def.id !== 'saddle_horse') return { ok: false, why: '野兽无法拖动——拖一个人上去捕猎' };
  if (st.battle && !def.tags.includes('person')) return { ok: false, why: '战斗中' };
  return { ok: true };
}

export function pick(g, cardId) {
  const c = g.s.cards[cardId];
  const can = canPick(g, c);
  if (!can.ok) return { ok: false, why: can.why };
  const st = g.s.stacks[c.s];
  if (st.battle) leaveBattle(g, cardId);
  const sub = g.detach(cardId);
  sub.held = true;
  sub.task = null;
  sub.z = ++g.s.z;
  g.emit({ type: 'pick', sid: sub.id, id: cardId });
  return { ok: true, sid: sub.id };
}

export function release(g, sid, x, y, targetSid) {
  const sub = g.s.stacks[sid];
  if (!sub) return { ok: false, why: '无' };
  sub.held = false;
  sub.x = x;
  sub.y = y;
  g.clampStack(sub);
  sub.dirty = true;
  if (targetSid && targetSid !== sid && g.s.stacks[targetSid]) {
    const res = dropOnto(g, sub, g.s.stacks[targetSid]);
    if (res.ok) return res;
    if (g.s.stacks[sid]) {
      // rejected: leave it beside the target instead of on top of it
      const t = g.s.stacks[targetSid];
      const spot = g.freeSpot(t.x + CARD_W + 16, t.y, g.stackH(sub), { exclude: sid });
      sub.x = spot.x;
      sub.y = spot.y;
      g.emit({ type: 'reject', sid, why: res.why });
      return { ok: false, why: res.why, placed: true };
    }
    return res;
  }
  g.emit({ type: 'place', sid });
  return { ok: true, placed: true };
}

function persons(g, st) {
  return st.cards.filter((id) => CARDS[g.s.cards[id].d].tags.includes('person'));
}

export function dropOnto(g, sub, target) {
  if (target.held) return { ok: false, why: '目标正被拿起' };
  const troot = g.s.cards[target.cards[0]];
  const ttop = g.s.cards[target.cards[target.cards.length - 1]];
  const trd = CARDS[troot.d];
  const ttd = CARDS[ttop.d];

  // join a battle
  if (target.battle) {
    const ps = persons(g, sub);
    if (!ps.length) return { ok: false, why: '只有人物能加入战斗' };
    const b = g.s.battles[target.battle];
    for (const id of ps) joinBattle(g, b, id, 'a');
    g.emit({ type: 'reinforce', bid: b.id });
    return { ok: true, battle: b.id };
  }
  // attack a hostile creature or lair
  if (trd.kind === 'enemy' || trd.kind === 'lair') {
    const ps = persons(g, sub);
    if (!ps.length) return { ok: false, why: '只有人物能攻击敌人' };
    const tc = { x: target.x + CARD_W / 2, y: target.y + CARD_H / 2 };
    const b = startBattle(g, tc.x, tc.y + 110);
    joinBattle(g, b, troot.id, 'b');
    for (const id of ps) joinBattle(g, b, id, 'a');
    if (troot.ai) troot.ai.act = true;
    return { ok: true, battle: b.id };
  }
  // wild beasts: taming recipes stack, otherwise people hunt
  if (target.mob && trd.kind === 'beast' && !trd.tags.includes('livestock')) {
    const combined = [...target.cards, ...sub.cards].map((id) => g.s.cards[id]);
    if (matchStack(combined, g.ctx)) return merge(g, sub, target);
    const ps = persons(g, sub);
    if (ps.length) {
      const tc = { x: target.x + CARD_W / 2, y: target.y + CARD_H / 2 };
      const b = startBattle(g, tc.x, tc.y + 110);
      joinBattle(g, b, troot.id, 'b');
      for (const id of ps) joinBattle(g, b, id, 'a');
      g.emit({ type: 'hunt', id: troot.id });
      return { ok: true, battle: b.id };
    }
    if (target.cards.length === 1 && sub.cards.every((id) => !CARDS[g.s.cards[id].d].tags.includes('person'))) {
      // bait laid next to the beast (e.g. grain on a goat) — allowed so a worker can follow
      return merge(g, sub, target);
    }
    return { ok: false, why: '无法叠放' };
  }
  if (ttd.kind === 'event' || trd.kind === 'event') return { ok: false, why: '事件卡不能叠放' };

  absorbAll(g, sub, target);
  if (!g.s.stacks[sub.id]) return { ok: true, absorbed: true };

  const sroot = CARDS[g.s.cards[sub.cards[0]].d];
  if (BOTTOM_ONLY.has(sroot.kind) || (sroot.kind === 'beast' && !sroot.tags.includes('livestock') && sroot.id !== 'saddle_horse')) {
    return { ok: false, why: sroot.name + '只能放在最下面' };
  }
  if (target.cards.length + sub.cards.length > MAX_STACK) return { ok: false, why: '堆叠太高了' };
  return merge(g, sub, target);
}

function merge(g, sub, target) {
  for (const id of sub.cards) {
    target.cards.push(id);
    g.s.cards[id].s = target.id;
  }
  delete g.s.stacks[sub.id];
  target.dirty = true;
  target.z = ++g.s.z;
  g.emit({ type: 'stack', sid: target.id });
  return { ok: true, stacked: true };
}

// ---------------------------------------------------------------- absorption -----------------------

function fuelValue(def) {
  if (def.tags.includes('oil')) return 3;
  return def.fuel || 0;
}

export function sellValue(g, def) {
  if (!def.value) return 0;
  if (['folk', 'structure', 'node', 'region', 'wonder', 'enemy', 'lair', 'event'].includes(def.kind)) return 0;
  if (def.kind === 'beast' && !def.tags.includes('livestock')) return 0;
  if (def.id === 'coin') return 0;
  let v = def.value;
  let mult = 1;
  if (g.hasTech('banking')) mult *= 1.25;
  if (g.hasMerchant()) mult *= 1.5;
  if (def.id === 'gold') return 10;
  return Math.max(1, Math.floor(v * mult));
}

/** can `absorber` take `c` right now? returns an action key or null */
export function absorbKind(g, absorber, c) {
  const ad = CARDS[absorber.d];
  const cd = CARDS[c.d];
  if (absorber.id === c.id) return null;
  if (ad.fuelMax && ad.fuelTags && ad.fuelTags.some((t) => cd.tags.includes(t)) && fuelValue(cd) > 0 && (absorber.fuel || 0) < ad.fuelMax) return 'fuel';
  if (ad.store && cd.food > 0 && (absorber.store || 0) + (c.fl ?? cd.food) <= ad.store.cap) return 'store';
  if (ad.market && sellValue(g, cd) > 0) return 'sell';
  if (ad.kind === 'folk') {
    if (cd.kind === 'gear') return 'equip';
    if (cd.heal && (absorber.hp < g.maxHp(absorber) || (absorber.st && absorber.st.sick))) return 'heal';
  }
  if (ad.deliver && g.level.altar && g.level.altar[c.d] && (absorber.del?.[c.d] || 0) < g.level.altar[c.d]) return 'deliver';
  if (ad.stages) {
    const stg = GREAT_FLAME_STAGES[absorber.stage || 0];
    if (stg && stg.need[c.d] && (absorber.prog?.[c.d] || 0) < stg.need[c.d]) return 'stage';
  }
  if (ad.id === 'festival_ground' && (c.d === 'feast' || c.d === 'mead')) return 'festival';
  if (ad.id === 'shrine' && c.d === 'candle') return 'offering';
  return null;
}

function absorbAll(g, sub, target) {
  const troot = g.s.cards[target.cards[0]];
  const ttop = g.s.cards[target.cards[target.cards.length - 1]];
  const absorbers = ttop.id === troot.id ? [ttop] : [ttop, troot];
  for (const id of [...sub.cards]) {
    const c = g.s.cards[id];
    if (!c) continue;
    for (const a of absorbers) {
      const k = absorbKind(g, a, c);
      if (!k) continue;
      applyAbsorb(g, a, c, k, target);
      break;
    }
  }
}

function applyAbsorb(g, a, c, k, target) {
  const ad = CARDS[a.d];
  const cd = CARDS[c.d];
  const at = { x: target.x + CARD_W / 2, y: target.y + CARD_H / 2 };
  switch (k) {
    case 'fuel':
      a.fuel = Math.min(ad.fuelMax, (a.fuel || 0) + fuelValue(cd));
      g.removeCard(c.id, 'absorb');
      g.emit({ type: 'fuel', id: a.id, x: at.x, y: at.y });
      break;
    case 'store':
      a.store = (a.store || 0) + (c.fl ?? cd.food);
      g.removeCard(c.id, 'absorb');
      g.emit({ type: 'store', id: a.id, x: at.x, y: at.y });
      break;
    case 'sell': {
      const v = sellValue(g, cd);
      g.removeCard(c.id, 'sell');
      for (let i = 0; i < v; i++) g.spawn('coin', at, {});
      g.s.stats.coinsEarned += v;
      g.emit({ type: 'sell', id: a.id, v, x: at.x, y: at.y });
      break;
    }
    case 'equip': {
      const slot = cd.gear.slot;
      a.gear = a.gear || {};
      const old = a.gear[slot];
      const before = g.maxHp(a);
      a.gear[slot] = c.d;
      g.removeCard(c.id, 'absorb');
      const after = g.maxHp(a);
      a.hp = Math.max(1, Math.min(after, a.hp + Math.max(0, after - before)));
      if (old) g.spawn(old, at, {});
      g.emit({ type: 'equip', id: a.id, gear: c.d, x: at.x, y: at.y });
      break;
    }
    case 'heal':
      if (cd.id === 'elixir') a.bonusHp = (a.bonusHp || 0) + 2;
      g.heal(a, cd.heal);
      if (a.st) a.st.sick = 0;
      g.removeCard(c.id, 'absorb');
      break;
    case 'deliver':
      a.del = a.del || {};
      a.del[c.d] = (a.del[c.d] || 0) + 1;
      g.removeCard(c.id, 'absorb');
      g.emit({ type: 'deliver', id: a.id, d: c.d, x: at.x, y: at.y });
      break;
    case 'stage': {
      a.prog = a.prog || {};
      a.prog[c.d] = (a.prog[c.d] || 0) + 1;
      g.removeCard(c.id, 'absorb');
      const stg = GREAT_FLAME_STAGES[a.stage || 0];
      if (Object.entries(stg.need).every(([id, n]) => (a.prog[id] || 0) >= n)) {
        a.stage = (a.stage || 0) + 1;
        a.prog = {};
        g.emit({ type: 'stage', id: a.id, stage: a.stage, x: at.x, y: at.y });
        if (a.stage >= GREAT_FLAME_STAGES.length) {
          g.transform(a, 'great_flame');
          g.msg('大薪火重新燃起了！光芒照亮了整片大地。', 'win');
        } else g.msg(`大薪火的「${stg.name}」完成了。`, 'good');
      }
      break;
    }
    case 'festival':
      g.removeCard(c.id, 'absorb');
      g.addFog(c.d === 'feast' ? -10 : -3, '庆典');
      g.emit({ type: 'festival', id: a.id, x: at.x, y: at.y });
      g.msg(c.d === 'feast' ? '盛大的庆典！灰雾 -10。' : '人们举杯共饮。灰雾 -3。', 'good');
      g.s.stats.festivals++;
      break;
    case 'offering':
      g.removeCard(c.id, 'absorb');
      g.addFog(-2, '供奉');
      g.emit({ type: 'festival', id: a.id, x: at.x, y: at.y });
      break;
  }
}
