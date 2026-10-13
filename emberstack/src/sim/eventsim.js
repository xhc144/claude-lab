// Random events and the decisions they ask for.

import { EVENTS } from '../data/events.js';
import { CARDS } from '../data/cards.js';
import { CARAVAN_POOL } from '../data/trade.js';
import { CARD_W, CARD_H } from './constants.js';
import { spawnAttacker } from './mobs.js';

export function rollEvents(g) {
  const R = g.rules;
  if (!R.eventRate) return;
  if (!g.rng.chance(R.eventRate)) return;
  const pool = [];
  for (const id of R.events || []) {
    const e = EVENTS[id];
    if (!e || !e.w) continue;
    if (g.s.day < e.minDay) continue;
    if (e.needShades && !R.shades) continue;
    if (e.id === 'eclipse' && R.dark) continue;
    // don't repeat the same event two days running
    if (g.s.lastEvent === id) continue;
    pool.push([id, e.w]);
  }
  const id = g.rng.weighted(pool);
  if (id) fireEvent(g, id);
}

export function fireEvent(g, id) {
  const e = EVENTS[id];
  g.s.lastEvent = id;
  g.s.stats.events++;
  if (e.kind === 'instant') {
    applyEffect(g, e.effect, e);
    g.emit({ type: 'event', id, instant: true });
    g.msg(`【${e.name}】${e.text}`, 'event');
    return null;
  }
  // a decision card
  const pos = g.freeSpot(g.colonyCenter().x + 260, g.colonyCenter().y - 200, CARD_H);
  const c = g.spawn(e.card, pos, { at: pos });
  c.ev = id;
  c.exp = g.s.day + (e.timeout || 2);
  g.emit({ type: 'event', id, cardId: c.id });
  g.msg(`【${e.name}】点击卡牌做出选择。`, 'event');
  return c;
}

export function spawnCaravan(g) {
  const cc = g.colonyCenter();
  const pos = g.freeSpot(cc.x - 380, cc.y - 220, CARD_H);
  const c = g.spawn('caravan', pos, { at: pos });
  const pool = CARAVAN_POOL.filter((o) => !o.bio || o.bio.includes(g.level.biome)).map((o) => [o, o.w]);
  const n = g.hasMerchant() ? 5 : 4;
  const offers = [];
  for (let i = 0; i < n && pool.length; i++) {
    const o = g.rng.weighted(pool);
    pool.splice(pool.findIndex((p) => p[0] === o), 1);
    offers.push({ give: o.give, get: o.get, left: 2 });
  }
  c.offers = offers;
  c.exp = g.s.day + 2;
  g.msg('一支商队来到了营地，停留两天。点击它交易。', 'event');
  g.emit({ type: 'caravan', cardId: c.id });
  return c;
}

/** expire old event cards at dawn, applying the default choice */
export function expireEvents(g) {
  for (const c of Object.values(g.s.cards)) {
    if (!c.exp || g.s.day < c.exp) continue;
    const def = CARDS[c.d];
    if (def.kind !== 'event') continue;
    if (c.ev) {
      const e = EVENTS[c.ev];
      if (e && e.def >= 0) applyChoice(g, c, e.def, true);
      else g.removeCard(c.id, 'expire');
    } else {
      g.msg(def.name + '离开了。', 'info');
      g.removeCard(c.id, 'expire');
    }
  }
}

/** costs written as [['#food', n]] or [['coin', n]] or [[id, n]]; checks free cards on the board */
export function canPay(g, give) {
  for (const [k, n] of give) {
    if (k === '#food') { if (g.freeFood() < n) return false; }
    else if (k === 'coin') { if (g.coinValue() < n) return false; }
    else if (g.freeCards(k).length < n) return false;
  }
  return true;
}

export function pay(g, give, to) {
  for (const [k, n] of give) {
    if (k === '#food') g.payFood(n, to);
    else if (k === 'coin') g.payCoins(n, to);
    else for (const c of g.freeCards(k).slice(0, n)) { g.emit({ type: 'payFly', d: c.d, from: g.cardPos(c), to }); g.removeCard(c.id, 'pay'); }
  }
}

export function applyChoice(g, card, idx, auto = false) {
  const e = EVENTS[card.ev];
  if (!e) return { ok: false, why: '无事件' };
  const ch = e.choices[idx];
  if (!ch) return { ok: false, why: '无此选项' };
  const at = g.cardPos(card);
  if (!canPay(g, ch.give)) {
    if (auto) {
      // the default can't be paid either: fall back to the last (free) choice
      const last = e.choices[e.choices.length - 1];
      if (last !== ch) return applyChoice(g, card, e.choices.length - 1, true);
    }
    return { ok: false, why: '材料不足' };
  }
  pay(g, ch.give, at);
  for (const [id, n] of ch.get) for (let i = 0; i < n; i++) g.spawn(id, at, {});
  if (ch.fog) g.addFog(ch.fog, e.name);
  if (ch.effect) applyEffect(g, ch.effect, e);
  g.removeCard(card.id, 'resolve');
  g.emit({ type: 'choice', ev: e.id, idx, auto });
  g.msg(`【${e.name}】${auto ? '（无人理会）' : ''}${ch.label}`, 'event');
  return { ok: true };
}

export function applyEffect(g, effect, e) {
  const cc = g.colonyCenter();
  switch (effect) {
    case 'raid':
      g.s.flags.raidNight = g.s.day;
      break;
    case 'wolves':
      g.s.flags.wolfNight = g.s.day;
      break;
    case 'cache': {
      const pos = g.freeSpot(cc.x + g.rng.range(-300, 300), cc.y + g.rng.range(200, 320), CARD_H);
      g.spawn(g.rng.weighted([['supply_basic', 3], ['food_crate', 2], ['explorer_bundle', 1.5], ['crafter_bundle', 1], ['seed_pouch', 1]]), pos, { at: pos });
      break;
    }
    case 'storm':
      for (const c of Object.values(g.s.cards)) {
        const d = CARDS[c.d];
        if (d.fuelMax && d.kind === 'structure') c.fuel = Math.max(0, (c.fuel || 0) - 2);
        if (d.id === 'torch') c.fuel = 0;
      }
      g.emit({ type: 'storm' });
      break;
    case 'eclipse':
      g.s.flags.eclipse = g.s.day;
      break;
    case 'meteor': {
      const p = g.freeSpot(g.rng.range(200, g.board.w - 300), g.rng.range(200, g.board.h - 300), CARD_H);
      g.spawn('meteor_crater', p, { at: p });
      g.spawn('insight', p, {});
      g.emit({ type: 'meteor', x: p.x + CARD_W / 2, y: p.y + CARD_H / 2 });
      break;
    }
    case 'aurora':
      g.addFog(-6, '极光');
      g.spawn('insight', cc, {});
      break;
    case 'harvest_moon':
      g.s.flags.harvestMoon = g.s.day;
      break;
    case 'plague': {
      if (g.countDef('well') > 0) { g.msg('水井让营地躲过了疫病。', 'good'); break; }
      const ps = g.people().filter((c) => CARDS[c.d].appetite > 0);
      const n = Math.min(ps.length, 1 + Math.floor(ps.length / 4));
      g.rng.shuffle(ps);
      for (let i = 0; i < n; i++) { ps[i].st = ps[i].st || {}; ps[i].st.sick = 1; }
      break;
    }
    case 'migration': {
      const bio = g.level.biome;
      const kinds = bio === 'tundra' ? [['mammoth', 1], ['seal', 1]] : bio === 'isles' ? [['seal', 2], ['fowl', 1]] : bio === 'mountain' ? [['goat', 2], ['horse', 1]] : [['deer', 2], ['rabbit', 1], ['fowl', 1], ['boar', 0.5]];
      const n = 2 + g.rng.int(0, 2);
      for (let i = 0; i < n; i++) {
        const p = g.freeSpot(cc.x + g.rng.range(-600, 600), cc.y + g.rng.range(-500, 500), CARD_H);
        g.spawn(g.rng.weighted(kinds), p, { at: p });
      }
      break;
    }
    case 'ash_tide':
      g.addFog(6, '灰潮');
      g.s.flags.ashTide = g.s.day;
      break;
    case 'flood_warning':
      g.s.flags.flood = g.s.day + 1;
      break;
    case 'song':
      g.addFog(-3, '篝火之歌');
      break;
    case 'shrine': {
      const p = g.freeSpot(cc.x + 200, cc.y + 160, CARD_H);
      g.spawn('shrine', p, { at: p });
      break;
    }
    default:
      break;
  }
}

/** the flood: loose goods in the low half of the map wash away unless a dike stands near */
export function flood(g) {
  const dikes = Object.values(g.s.cards).filter((c) => c.d === 'dike').map((c) => g.cardPos(c));
  const lowY = g.level.floodY ?? g.board.h * 0.55;
  let lost = 0;
  for (const st of Object.values(g.s.stacks)) {
    if (st.mob || st.battle || st.held) continue;
    const cy = st.y + CARD_H / 2;
    if (cy < lowY) continue;
    const p = { x: st.x + CARD_W / 2, y: cy };
    if (dikes.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < 380)) continue;
    for (const id of [...st.cards]) {
      const d = CARDS[g.s.cards[id].d];
      if ((d.kind === 'resource' || d.kind === 'food' || d.kind === 'tool' || d.kind === 'coin') && g.rng.chance(0.55)) {
        g.removeCard(id, 'flood');
        lost++;
      }
    }
  }
  g.s.stats.floods++;
  g.emit({ type: 'flood', y: lowY });
  g.msg(lost ? `洪水冲走了 ${lost} 张卡牌！` : '洪水退去了，营地安然无恙。', lost ? 'danger' : 'good');
}
