// Battles: two sides of cards facing each other. Every combatant attacks on its own cooldown.
// Damage types form a triangle of counters:
//   穿刺 pierce  ×1.25 vs beasts, ×0.5 vs armored
//   钝击 blunt   ×1.25 vs armored
//   光芒 light   ×2 vs shades (everything else deals ×0.5 to shades)
// Flying enemies are hard to reach: melee attacks against them deal only a third of the damage.

import { CARDS } from '../data/cards.js';
import { CARD_W } from './constants.js';

export function startBattle(g, x, y) {
  const id = g.s.nextBattle++;
  const b = { id, x, y, a: [], b: [], t: 0 };
  g.s.battles[id] = b;
  g.emit({ type: 'battleStart', bid: id, x, y });
  return b;
}

export function joinBattle(g, b, cardId, side) {
  const c = g.s.cards[cardId];
  if (!c) return;
  const cur = g.s.stacks[c.s];
  if (cur && cur.battle) {
    if (cur.battle === b.id) return;
    leaveBattle(g, cardId);
  }
  const st = g.extract(cardId);
  st.battle = b.id;
  st.task = null;
  st.held = false;
  b[side].push(cardId);
  c.cd = 0.4 + g.rng.next() * 0.8;
  if (c.ai) c.ai.m = 'fight';
}

export function leaveBattle(g, cardId) {
  const c = g.s.cards[cardId];
  if (!c) return;
  const st = g.s.stacks[c.s];
  if (!st || !st.battle) return;
  const b = g.s.battles[st.battle];
  st.battle = null;
  st.dirty = true;
  if (b) {
    b.a = b.a.filter((id) => id !== cardId);
    b.b = b.b.filter((id) => id !== cardId);
    g.emit({ type: 'retreat', id: cardId });
  }
}

export function maxHp(g, c) {
  const def = CARDS[c.d];
  if (c.mhp) return c.mhp;
  let hp = def.hp || 1;
  if (c.gear) for (const gid of Object.values(c.gear)) if (gid) hp += CARDS[gid].gear.hp || 0;
  hp += c.bonusHp || 0;
  if (def.kind === 'structure' && g.hasTech('fortification')) hp = Math.round(hp * 1.5);
  return hp;
}

export function combatStats(g, c) {
  const def = CARDS[c.d];
  let atk = def.atk || 0;
  let dfn = def.def || 0;
  let dmg = def.dmg || 'blunt';
  let ranged = !!def.ranged;
  let crit = 0.06;
  let thorns = 0;
  if (c.gear) {
    for (const gid of Object.values(c.gear)) {
      if (!gid) continue;
      const gg = CARDS[gid].gear;
      atk += gg.atk || 0;
      dfn += gg.def || 0;
      if (gg.dmg && gg.atk) dmg = gg.dmg;
      if (gg.ranged) ranged = true;
      if (gg.crit) crit = Math.max(crit, gg.crit);
      if (gg.thorns) thorns += gg.thorns;
    }
  }
  if (def.kind === 'folk') {
    if (def.tags.includes('soldier') && g.hasTech('tactics')) atk += 1;
    atk += Math.min(2, Math.floor((c.kills || 0) / 3));
    if (c.st && c.st.sick) atk = Math.max(0, atk - 1);
  } else if (def.kind === 'enemy' || def.kind === 'lair') {
    atk = Math.round(atk * (g.rules.enemyAtk || 1));
  }
  if (def.kind === 'structure' && def.taunt) atk = 0;
  let traits = def.traits || [];
  // the Great Flame strips the Ash King of his armour
  if (c.d === 'ash_king' && g.countDef('great_flame')) { dfn = 0; traits = traits.filter((t) => t !== 'armored'); }
  return {
    atk, def: dfn, dmg, ranged, crit, thorns, spd: def.spd || 1.6,
    traits, taunt: !!def.taunt, flying: traits.includes('flying'),
  };
}

function pickTarget(g, attacker, as, foes) {
  const cand = [];
  for (const id of foes) {
    const t = g.s.cards[id];
    if (!t) continue;
    const ts = combatStats(g, t);
    let w = 1;
    if (ts.flying && !as.ranged) w = 0.4;
    if (ts.taunt) w = 6;
    if (CARDS[attacker.d].kind === 'folk') {
      if (as.ranged && ts.flying) w *= 4;
      if (as.dmg === 'light' && ts.traits.includes('shade')) w *= 3;
      if (as.dmg === 'blunt' && ts.traits.includes('armored')) w *= 2;
      w *= 1 + 2 / Math.max(1, t.hp);
    }
    cand.push([t, w]);
  }
  return g.rng.weighted(cand);
}

export function damageMult(as, ts) {
  let mult = 1;
  if (ts.traits.includes('flying') && !as.ranged) mult *= 0.34;
  if (ts.traits.includes('shade')) mult *= as.dmg === 'light' ? 2 : 0.5;
  if (ts.traits.includes('armored')) {
    if (as.dmg === 'pierce') mult *= 0.5;
    else if (as.dmg === 'blunt') mult *= 1.25;
  }
  if (ts.traits.includes('beast') && as.dmg === 'pierce') mult *= 1.25;
  return mult;
}

function attack(g, b, att, foes) {
  const as = combatStats(g, att);
  if (as.atk <= 0) return;
  const tgt = pickTarget(g, att, as, foes);
  if (!tgt) return;
  const ts = combatStats(g, tgt);
  if (!g.rng.chance(0.88)) {
    g.emit({ type: 'miss', a: att.id, t: tgt.id });
    return;
  }
  let dmg = as.atk * damageMult(as, ts);
  const crit = g.rng.chance(as.crit);
  if (crit) dmg *= 2;
  dmg = Math.max(1, Math.round(dmg) - ts.def);
  g.emit({ type: 'hit', a: att.id, t: tgt.id, dmg, crit, kind: as.dmg, ranged: as.ranged });
  if (ts.traits.includes('burning') && !as.ranged && g.rng.chance(0.35)) g.hurt(att, 1, '被灼伤');
  if (ts.thorns && !as.ranged) g.hurt(att, ts.thorns, '');
  g.hurt(tgt, dmg, '', att);
}

export function updateBattles(g, dt) {
  for (const b of Object.values(g.s.battles)) {
    b.t += dt;
    // drop combatants that vanished
    b.a = b.a.filter((id) => g.s.cards[id]);
    b.b = b.b.filter((id) => g.s.cards[id]);
    // layout: people below, foes above
    layoutSide(g, b, b.a, b.y + 40);
    layoutSide(g, b, b.b, b.y - 150);
    for (const [mine, foes] of [[b.a, b.b], [b.b, b.a]]) {
      for (const id of [...mine]) {
        const c = g.s.cards[id];
        if (!c) continue;
        c.cd = (c.cd ?? 1) - dt;
        if (c.cd <= 0) {
          const s = combatStats(g, c);
          c.cd = s.spd * (0.9 + g.rng.next() * 0.2);
          attack(g, b, c, foes);
        }
        // boss summons
        const def = CARDS[c.d];
        if (def.mob && def.mob.summon && g.s.cards[id]) {
          c.sumT = (c.sumT || 0) + dt;
          const sm = def.mob.summon;
          if (c.sumT >= sm.every) {
            c.sumT = 0;
            const alive = b.b.filter((x) => g.s.cards[x] && g.s.cards[x].d === sm.id).length;
            if (alive < sm.max) {
              const st = g.s.stacks[c.s];
              const m = g.spawnMob(sm.id, st.x + (g.rng.next() - 0.5) * 300, st.y - 120);
              joinBattle(g, b, m.id, 'b');
              g.emit({ type: 'summon', id: m.id, by: c.id });
            }
          }
        }
      }
    }
    b.a = b.a.filter((id) => g.s.cards[id]);
    b.b = b.b.filter((id) => g.s.cards[id]);
    if (!b.a.length || !b.b.length) endBattle(g, b);
  }
}

function layoutSide(g, b, ids, y) {
  const n = ids.length;
  const gap = CARD_W + 14;
  ids.forEach((id, i) => {
    const c = g.s.cards[id];
    if (!c) return;
    const st = g.s.stacks[c.s];
    if (!st) return;
    st.x = b.x - (n * gap) / 2 + i * gap + 7;
    st.y = y;
  });
}

export function endBattle(g, b) {
  const won = b.b.length === 0;
  for (const id of [...b.a, ...b.b]) {
    const c = g.s.cards[id];
    if (!c) continue;
    const st = g.s.stacks[c.s];
    if (st) {
      st.battle = null;
      st.dirty = true;
    }
    if (c.ai) c.ai.m = 'idle';
  }
  delete g.s.battles[b.id];
  g.emit({ type: 'battleEnd', bid: b.id, won, x: b.x, y: b.y });
}

/** which battle (if any) a card is fighting in */
export function battleOf(g, cardId) {
  const c = g.s.cards[cardId];
  if (!c) return null;
  const st = g.s.stacks[c.s];
  return st && st.battle ? g.s.battles[st.battle] : null;
}

/** rough fighting strength (hp × damage per second) used by the AI and the HUD */
export function strengthOf(g, c, vsTraits = []) {
  const s = combatStats(g, c);
  const ts = { traits: vsTraits };
  const dps = (s.atk * damageMult(s, ts) * 0.88) / s.spd;
  return Math.max(0.05, dps) * Math.max(1, c.hp || 1);
}
