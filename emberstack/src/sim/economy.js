// Research, trade, the market, opening bundles and reading scrolls.

import { CARDS } from '../data/cards.js';
import { TECHS } from '../data/techs.js';
import { RECIPES, HIDDEN_RECIPES } from '../data/recipes.js';
import { MARKET_OFFERS } from '../data/trade.js';
import { canPay, pay, applyChoice } from './eventsim.js';
import { CARD_H } from './constants.js';

export function techStatus(g, id) {
  const t = TECHS[id];
  if (!t) return { ok: false, why: '未知科技' };
  if (g.hasTech(id)) return { ok: false, done: true, why: '已掌握' };
  if (!g.techAllowed(id)) return { ok: false, locked: true, why: '本关卡不可研究' };
  const miss = t.req.filter((r) => !g.hasTech(r));
  if (miss.length) return { ok: false, why: '需要先研究：' + miss.map((r) => TECHS[r].name).join('、') };
  const have = g.freeCards('insight').length;
  if (have < t.cost) return { ok: false, short: t.cost - have, why: `灵感不足（${have}/${t.cost}）` };
  return { ok: true };
}

export function research(g, id) {
  const st = techStatus(g, id);
  if (!st.ok) return st;
  const t = TECHS[id];
  const hud = { x: g.board.w / 2, y: 0 };
  for (const c of g.freeCards('insight').slice(0, t.cost)) {
    g.emit({ type: 'payFly', d: c.d, from: g.cardPos(c), to: hud });
    g.removeCard(c.id, 'research');
  }
  g.addTech(id);
  g.s.stats.researched++;
  g.msg(`研究完成：${t.name}——${t.desc}`, 'tech');
  g.emit({ type: 'research', tech: id });
  return { ok: true };
}

export function marketOffers(g) {
  return MARKET_OFFERS.filter((o) => !o.tech || g.hasTech(o.tech));
}

export function buy(g, marketCardId, offerId) {
  const m = g.s.cards[marketCardId];
  if (!m || !CARDS[m.d].market) return { ok: false, why: '不是集市' };
  const o = marketOffers(g).find((x) => x.id === offerId);
  if (!o) return { ok: false, why: '无此商品' };
  if (!canPay(g, o.give)) return { ok: false, why: '铜贝不足' };
  const at = g.cardPos(m);
  pay(g, o.give, at);
  for (const [id, n] of o.get) for (let i = 0; i < n; i++) g.spawn(id, at, {});
  g.s.stats.trades++;
  g.emit({ type: 'trade', id: marketCardId });
  return { ok: true };
}

export function trade(g, caravanId, idx) {
  const c = g.s.cards[caravanId];
  if (!c || !c.offers) return { ok: false, why: '商队已离开' };
  const o = c.offers[idx];
  if (!o || o.left <= 0) return { ok: false, why: '已售罄' };
  if (!canPay(g, o.give)) return { ok: false, why: '材料不足' };
  const at = g.cardPos(c);
  pay(g, o.give, at);
  for (const [id, n] of o.get) for (let i = 0; i < n; i++) g.spawn(id, at, {});
  o.left--;
  g.s.stats.trades++;
  g.emit({ type: 'trade', id: caravanId });
  return { ok: true };
}

/** pick a hint for a scroll: an undiscovered hidden recipe whose inputs exist in this world */
function pickHint(g) {
  const known = new Set([...g.s.disc, ...Object.keys(g.s.hints)]);
  const cand = HIDDEN_RECIPES.filter((id) => !known.has(id) && RECIPES[id].hint);
  if (!cand.length) return null;
  const weights = cand.map((id) => {
    const r = RECIPES[id];
    const refs = [...Object.keys(r.in), ...Object.keys(r.keep)].filter((k) => k[0] !== '#');
    const present = refs.filter((k) => g.countDef(k) > 0 || g.everSeen(k)).length;
    return [id, 1 + present * 2];
  });
  return g.rng.weighted(weights);
}

export function openCard(g, cardId) {
  const c = g.s.cards[cardId];
  if (!c) return { ok: false, why: '卡牌不存在' };
  const def = CARDS[c.d];
  const st = g.s.stacks[c.s];
  if (st && (st.held || st.battle)) return { ok: false, why: '现在不行' };
  const o = def.open;
  if (!o) return { ok: false, why: '无法打开' };
  const at = g.cardPos(c);
  switch (o.type) {
    case 'bundle': {
      const pool = o.loot.slice();
      g.removeCard(c.id, 'open');
      const got = [];
      for (let i = 0; i < o.n; i++) {
        const id = g.rng.weighted(pool);
        got.push(g.spawn(id, at, {}).d);
      }
      g.emit({ type: 'open', d: def.id, x: at.x, y: at.y, got });
      return { ok: true, got };
    }
    case 'scroll': {
      const hid = c.hint && !g.s.disc.includes(c.hint) ? c.hint : pickHint(g);
      g.removeCard(c.id, 'open');
      g.spawn('insight', at, {});
      if (hid) {
        g.s.hints[hid] = 1;
        g.msg(`残卷上写着：「${RECIPES[hid].hint}」`, 'hint');
        g.emit({ type: 'hint', r: hid });
      } else g.msg('残卷上的字迹已经无法辨认，但读的人仍有所得。', 'info');
      return { ok: true, hint: hid };
    }
    case 'tome': {
      g.removeCard(c.id, 'open');
      for (let i = 0; i < (o.insight || 3); i++) g.spawn('insight', at, {});
      g.emit({ type: 'open', d: def.id, x: at.x, y: at.y });
      return { ok: true };
    }
    case 'reveal': {
      g.removeCard(c.id, 'open');
      const p = g.freeSpot(at.x + 200, at.y - 100, CARD_H);
      g.spawn(o.region, p, { at: p });
      g.msg('藏宝图指向了一处地方……', 'explore');
      return { ok: true };
    }
    default:
      return { ok: false, why: '需要在对话中处理' };
  }
}

export function choose(g, cardId, idx) {
  const c = g.s.cards[cardId];
  if (!c || !c.ev) return { ok: false, why: '事件已结束' };
  return applyChoice(g, c, idx, false);
}
