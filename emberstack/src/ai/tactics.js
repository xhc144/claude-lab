// Combat judgement: who to send into a fight, when to pull the wounded out, when the army is strong
// enough to go after a lair or a boss, and what kind of soldiers the coming threats call for.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { PRODUCERS } from './knowledge.js';
import { combatStats, damageMult } from '../sim/combat.js';
import { CARD_W, CARD_H } from '../sim/constants.js';
import { Exec, workSpot } from './executor.js';
import { need, goal } from './planner.js';

/** Lanchester-style group power: total damage per second × total hit points */
export function groupPower(g, cards, foeTraits = [], foeDef = 0) {
  let dps = 0, hp = 0;
  for (const c of cards) {
    const s = combatStats(g, c);
    const ts = { traits: foeTraits };
    const d = (Math.max(1, s.atk * damageMult(s, ts) - foeDef) * 0.88) / s.spd;
    dps += d;
    hp += Math.max(0, c.hp || 0);
  }
  return { dps, hp, power: dps * hp };
}

export function enemyPower(g, cards, ourTraits = { def: 0 }) {
  let dps = 0, hp = 0;
  for (const c of cards) {
    const d = CARDS[c.d];
    const s = combatStats(g, c);
    let dd = (Math.max(1, s.atk - (ourTraits.def || 0)) * 0.88) / s.spd;
    if (d.mob && d.mob.summon) dd *= 1.5; // summons add up
    dps += dd;
    hp += c.hp || d.hp || 1;
  }
  return { dps, hp, power: dps * hp };
}

function traitsOf(cards) {
  const t = new Set();
  for (const c of cards) for (const x of CARDS[c.d].traits || []) t.add(x);
  return [...t];
}

/** people who could be sent to fight right now (not children, not already fighting) */
export function availableFighters(brain, W, traits = []) {
  const g = W.g;
  const out = [];
  for (const p of W.people) {
    const d = CARDS[p.d];
    if (d.tags.includes('child')) continue;
    const st = g.s.stacks[p.s];
    if (!st || st.battle || st.held || brain.locked.has(p.id)) continue;
    if (st.task && st.task.m.consume.includes(p.id)) continue;
    if ((p.hp || 0) <= 2) continue;
    const s = combatStats(g, p);
    const ts = { traits };
    const v = Math.max(0.3, s.atk * damageMult(s, ts)) / s.spd;
    out.push({ p, v: v * (p.hp || 1), soldier: d.tags.includes('soldier') });
  }
  out.sort((a, b) => (b.soldier - a.soldier) || b.v - a.v);
  return out;
}

function anyCardIn(b) { return b.b[0] || b.a[0]; }

/** urgent combat actions; returns a list of Execs to run before anything else */
export function combatActions(brain, W) {
  const g = W.g, S = brain.strat;
  const execs = [];
  const used = new Set();
  // 1) battles in progress: reinforce or retreat
  for (const b of W.battles) {
    const ours = b.a.map((id) => g.s.cards[id]).filter((c) => c && CARDS[c.d].kind === 'folk');
    const theirs = b.b.map((id) => g.s.cards[id]).filter(Boolean);
    if (!theirs.length) continue;
    const tt = traitsOf(theirs);
    const foeDef = Math.max(...theirs.map((c) => combatStats(g, c).def));
    const op = groupPower(g, ours, tt, foeDef);
    const ep = enemyPower(g, theirs);
    let ratio = op.power / Math.max(1, ep.power);
    const wantRatio = 1.6 + S.caution;
    const shadeFight = theirs.every((c) => (CARDS[c.d].traits || []).includes('shade')) && !theirs.some((c) => (CARDS[c.d].traits || []).includes('boss'));
    const lit = g.lightAt(b.x, b.y) > 0.05 || g.ambient() >= 0.5;
    const allIn = groupPower(g, [...ours, ...availableFighters(brain, W, tt).filter((f) => !used.has(f.p.id)).map((f) => f.p)], tt, foeDef).power / Math.max(1, ep.power);
    const far = Math.hypot(b.x - W.anchor.x, b.y - W.anchor.y) > 450;
    const fleeable = theirs.every((c) => ['neutral', 'flee', 'wander'].includes(CARDS[c.d].mob?.beh));
    const nearSleeper = W.threats.some((o) => o.d.mob.beh === 'boss' && !(o.c.ai && o.c.ai.act) && !theirs.includes(o.c) && Math.hypot(o.p.x - b.x, o.p.y - b.y) < 480);
    if (nearSleeper && ratio > 0.9) continue; // don't pile people next to a sleeping boss
    if (nearSleeper) {
      for (const p of ours) {
        if (used.has(p.id)) continue;
        used.add(p.id);
        const spot = workSpot(brain, g, W);
        execs.push(new Exec({ key: 'retreat:' + p.id, kind: 'retreat', prio: 205, why: `${p.name}离沉睡的首领太近了，撤回营地`, cat: '战斗' },
          [{ op: 'move', id: p.id, x: spot.x, y: spot.y }], { lock: [p.id] }));
      }
      continue;
    }
    if ((shadeFight && !lit && ratio < 1.4) || (allIn < 0.6 && far && fleeable)) {
      // don't fight shades in the dark: step back into the light where they cannot follow
      for (const p of ours) {
        if (used.has(p.id)) continue;
        used.add(p.id);
        const spot = workSpot(brain, g, W);
        execs.push(new Exec({ key: 'retreat:' + p.id, kind: 'retreat', prio: 205, why: shadeFight ? `${p.name}在黑暗中遭遇暗影，撤回火光里` : `${p.name}寡不敌众，撤回营地`, cat: '战斗' },
          [{ op: 'move', id: p.id, x: spot.x, y: spot.y }], { lock: [p.id] }));
      }
      continue;
    }
    if (ratio < wantRatio) {
      const avail = availableFighters(brain, W, tt).filter((f) => !used.has(f.p.id));
      const extra = [];
      for (const f of avail) {
        if (ratio >= wantRatio + 0.4) break;
        if (shadeFight && combatStats(g, f.p).dmg !== 'light' && !lit) continue;
        // workers busy on something important stay unless the fight is going badly
        const st = g.s.stacks[f.p.s];
        if (st.task && ratio > 1.1 && !f.soldier) continue;
        extra.push(f.p);
        used.add(f.p.id);
        const np = groupPower(g, [...ours, ...extra], tt, foeDef);
        ratio = np.power / Math.max(1, ep.power);
      }
      for (const p of extra) {
        execs.push(new Exec({ key: 'fight:' + p.id, kind: 'fight', prio: 200, why: `支援战斗（${CARDS[theirs[0].d].name}）`, cat: '战斗' },
          [{ op: 'drop', id: p.id, target: anyCardIn(b) }], { lock: [p.id] }));
      }
    }
    // pull out the badly wounded if the line holds without them
    if (S.caution >= 0.5) {
      for (const p of ours) {
        const mh = g.maxHp(p);
        if (p.hp > 2 || mh < 5 || ours.length < 2) continue;
        const rest = ours.filter((x) => x !== p);
        const rp = groupPower(g, rest, tt, foeDef).power / Math.max(1, ep.power);
        if (rp < 1.3) continue;
        const spot = workSpot(brain, g, W);
        execs.push(new Exec({ key: 'retreat:' + p.id, kind: 'retreat', prio: 210, why: `${p.name}伤势过重，撤出战斗`, cat: '战斗' },
          [{ op: 'move', id: p.id, x: spot.x, y: spot.y }], { lock: [p.id] }));
        break;
      }
    }
  }
  // 2) never loiter next to a sleeping boss
  const sleepers = W.threats.filter((t) => t.d.mob?.beh === 'boss' && !(t.c.ai && t.c.ai.act));
  if (sleepers.length) {
    for (const p of W.people) {
      const st = g.s.stacks[p.s];
      if (!st || st.battle || used.has(p.id) || brain.locked.has(p.id)) continue;
      const pp = { x: st.x + CARD_W / 2, y: st.y + CARD_H / 2 };
      if (!sleepers.some((t) => Math.hypot(t.p.x - pp.x, t.p.y - pp.y) < 340)) continue;
      used.add(p.id);
      const spot = workSpot(brain, g, W);
      execs.push(new Exec({ key: 'away:' + p.id, kind: 'retreat', prio: 215, why: `${p.name}离沉睡的${sleepers[0].d.name}太近了，退回营地`, cat: '战斗' },
        [{ op: 'move', id: p.id, x: spot.x, y: spot.y }], { lock: [p.id] }));
    }
  }
  // 3) enemies on the way
  for (const th of W.threats) {
    if (th.inBattle) continue;
    const beh = th.d.mob.beh;
    if (beh === 'boss' && !(th.c.ai && th.c.ai.act)) continue;
    if (beh === 'neutral' || beh === 'wander' || beh === 'flee') continue;
    if (beh === 'shade') {
      // keep people out of the dark rather than chasing shades around
      for (const p of W.people) {
        const st = g.s.stacks[p.s];
        if (!st || st.battle || used.has(p.id) || brain.locked.has(p.id)) continue;
        const pp = { x: st.x + CARD_W / 2, y: st.y + CARD_H / 2 };
        if (Math.hypot(pp.x - th.p.x, pp.y - th.p.y) > 520) continue;
        if (g.lightAt(pp.x, pp.y) > 0.05) continue;
        // take the person (and anything above) into the light
        const spot = workSpot(brain, g, W);
        used.add(p.id);
        execs.push(new Exec({ key: 'shelter:' + p.id, kind: 'shelter', prio: 190, why: `${p.name}身处黑暗，退回火光中`, cat: '生存' },
          [{ op: 'move', id: p.id, x: spot.x, y: spot.y }], { lock: [p.id] }));
      }
      continue;
    }
    const nearPeople = W.people.some((p) => { const st = g.s.stacks[p.s]; return st && !st.battle && Math.hypot(st.x + CARD_W / 2 - th.p.x, st.y + CARD_H / 2 - th.p.y) < 300; });
    if (th.dist > 650 && !nearPeople && beh !== 'boss') continue;
    const sleeper = W.threats.find((o) => o !== th && o.d.mob.beh === 'boss' && !(o.c.ai && o.c.ai.act) && Math.hypot(o.p.x - th.p.x, o.p.y - th.p.y) < 520);
    if (sleeper) continue;
    const tt = th.d.traits || [];
    const foe = enemyPower(g, [th.c]);
    const avail = availableFighters(brain, W, tt).filter((f) => !used.has(f.p.id));
    const team = [];
    let pw = 0;
    for (const f of avail) {
      if (pw >= foe.power * (1.8 + S.caution)) break;
      if (!f.soldier && team.length >= 1 && g.s.stacks[f.p.s].task && pw > foe.power) continue;
      team.push(f.p);
      pw = groupPower(g, team, tt, th.d.def || 0).power;
    }
    if (pw >= foe.power * 1.3 && team.length && (team.length >= 2 || pw >= foe.power * 3)) {
      for (const p of team) used.add(p.id);
      execs.push(new Exec({ key: 'intercept:' + th.c.id, kind: 'fight', prio: 185, why: `迎击来袭的${th.d.name}`, cat: '战斗' },
        team.map((p) => ({ op: 'drop', id: p.id, target: th.c.id, optional: true })), { lock: team.map((p) => p.id) }));
    }
  }
  return execs;
}

/** decide whether to march on a lair or boss now; returns an Exec or null */
export function assault(brain, W, targetCard, prio, why) {
  const g = W.g, S = brain.strat;
  const d = CARDS[targetCard.d];
  const st = g.s.stacks[targetCard.s];
  if (!st || st.battle) return null;
  const tt = d.traits || [];
  const foe = enemyPower(g, [targetCard]);
  // minions that will be summoned or are around
  let mult = 1;
  if (d.mob && d.mob.summon) {
    const s = CARDS[d.mob.summon.id];
    mult += (s.hp * s.atk * Math.min(2, d.mob.summon.max)) / Math.max(1, d.hp * d.atk) * 0.8;
  }
  if (d.mob && d.mob.spawn) mult += 0.4;
  const need = foe.power * mult * (1.6 + S.caution * 1.2) / (S.aggressive ? 1.25 : 1);
  const avail = availableFighters(brain, W, tt);
  // winning is not enough: the enemy focuses its blows, so estimate how many of ours would fall
  const boss = tt.includes('boss');
  const allow = (boss ? 1.5 : d.kind === 'lair' ? 1.1 : 0.7) * (S.aggressive ? 1.15 : 1) * (1.3 - S.caution * 0.5);
  const sm = Math.sqrt(mult);
  const team = [];
  let pw = 0, deaths = Infinity;
  for (const f of avail) {
    team.push(f.p);
    const gp = groupPower(g, team, tt, d.def || 0);
    pw = gp.power;
    const T = (foe.hp * sm) / Math.max(0.01, gp.dps);
    deaths = (foe.dps * sm * T) / Math.max(1, gp.hp / team.length);
    if (pw >= need * 1.15 && deaths <= allow) break;
  }
  brain.armyReady = Math.min(pw / Math.max(1, need), deaths > 0 ? allow / deaths : 1);
  if (pw < need || deaths > allow) return null;
  return new Exec({ key: 'assault:' + targetCard.id, kind: 'fight', prio, why: why || `进攻${d.name}`, cat: '战斗' },
    team.map((p) => ({ op: 'drop', id: p.id, target: targetCard.id, optional: true })), { lock: team.map((p) => p.id) });
}

/** fighting power of a group of enemy card types (by definition, before they exist) */
export function defsPower(list) {
  let dps = 0, hp = 0;
  for (const [d, n] of list) {
    const c = CARDS[d];
    if (!c || !c.hp) continue;
    let dd = ((c.atk || 0) * 0.88) / (c.spd || 1.6);
    hp += c.hp * n;
    dps += dd * n;
    if (c.mob && c.mob.summon) {
      const s = CARDS[c.mob.summon.id];
      dps += ((s.atk * 0.88) / (s.spd || 1.6)) * n;
      hp += s.hp * n;
    }
  }
  return dps * hp;
}

/** add needs for soldiers and gear in proportion to the threats we know about */
export function militaryNeeds(brain, P) {
  const W = P.W, g = W.g, S = P.strat;
  const groups = [];
  const traits = new Set();
  const note = (d) => { for (const t of CARDS[d]?.traits || []) traits.add(t); };
  for (const e of W.warnings) {
    if (e.day - W.day > 4) continue;
    const list = (e.spawn || []).map(([d, n]) => [d, n]);
    if (e.wake) list.push([e.wake, 1]);
    list.forEach(([d]) => note(d));
    groups.push(defsPower(list) * (e.day - W.day <= 1 ? 1.15 : 1));
  }
  const roaming = [];
  for (const th of W.threats) {
    const beh = th.d.mob.beh;
    if (beh === 'shade' || beh === 'flee' || beh === 'wander' || beh === 'neutral') continue;
    if (beh === 'boss') {
      if (!(th.c.ai && th.c.ai.act) && !(P.killTargets || []).some((k) => k.card === th.c.d)) continue;
      groups.push(defsPower([[th.c.d, 1]]));
      note(th.c.d);
      continue;
    }
    roaming.push([th.c.d, 1]);
    note(th.c.d);
  }
  if (roaming.length) groups.push(defsPower(roaming));
  for (const l of W.lairs) {
    const sp = CARDS[l.d].mob.spawn;
    groups.push(defsPower([[l.d, 1], [sp.id, sp.max]]) * 0.8);
    note(sp.id);
  }
  for (const k of P.killTargets || []) {
    if (!W.cards.some((c) => c.d === k.card)) continue;
    groups.push(defsPower([[k.card, 1]]));
    note(k.card);
  }
  if (g.rules.shades && g.techAllowed('lamplight')) { traits.add('shade'); groups.push(defsPower([['shade', Math.ceil(g.s.fog / 15)]])); }
  const want = Math.max(0, ...groups) * S.army * 1.3;
  const fighters = W.people.filter((p) => CARDS[p.d].kind === 'folk' && !CARDS[p.d].tags.includes('child'));
  const have = groupPower(g, fighters, [...traits]).power;
  brain.threat = { want: Math.round(want), have: Math.round(have), traits: [...traits] };
  if (P.escort) {
    for (const t of P.escort.traits) traits.add(t);
    const n = W.soldiers.length;
    trainSoldiers(brain, P, Math.max(1, 2 - n), P.escort.prio, [...traits]);
  }
  if (P.soldierTarget) {
    const n = W.soldiers.length;
    if (n < P.soldierTarget) trainSoldiers(brain, P, P.soldierTarget - n, P.soldierPrio, [...traits]);
  }
  if (want <= 0 || have >= want) return;
  const soon = W.warnings.some((e) => e.day - W.day <= 2) || W.threats.some((t) => !t.inBattle && !['shade', 'flee', 'wander', 'neutral'].includes(t.d.mob.beh) && t.dist < 900);
  // with nothing on the way, arming up waits behind the level's goals (even for a warlord)
  const prio = soon ? 78 * Math.min(1.4, S.army) : 44 * Math.min(1.3, S.army);
  goal(P, '加强武备', prio, '战斗', `${Math.round((have / want) * 100)}%`);
  const units = Math.max(1, Math.min(3, Math.ceil((1 - have / want) * 4)));
  // a big gap needs more hands, not just better weapons
  if (have < want * 0.6) P.popTarget = Math.max(P.popTarget || 0, Math.min(W.pop + 3, Math.round(S.popTarget * 1.5)));
  trainSoldiers(brain, P, units, prio, [...traits]);
}

function trainSoldiers(brain, P, n, prio, traits) {
  const W = P.W, g = W.g;
  const trainees = W.people.filter((p) => p.d === 'survivor' && !g.s.stacks[p.s]?.battle).length;
  // options in order of preference given enemy traits
  const opts = [];
  const has = (t) => g.techAllowed(t) || g.hasTech(t);
  const armored = traits.includes('armored') && !traits.includes('flying');
  if ((traits.includes('flying') || traits.includes('burning')) && has('archery')) opts.push('bow');
  if (traits.includes('shade') && has('lamplight')) opts.push('lantern');
  if (armored && has('tactics')) opts.push('mace');
  // against armour, pierce does half damage: clubs and armour beat spears
  if (!armored && has('hunting')) opts.push('spear');
  if (!armored && has('archery')) opts.push('bow');
  const gearOpts = [];
  if (armored) gearOpts.push('club');
  if (has('iron')) gearOpts.push('iron_sword', 'iron_armor');
  if (has('bronze')) gearOpts.push('bronze_sword', 'bronze_armor');
  if (has('husbandry')) gearOpts.push('leather_armor');
  gearOpts.push('club');
  let made = 0;
  if (trainees > 0 && opts.length) {
    // the preferred kit may need research first; when soldiers are wanted now (a goal), use what can be made today
    const ready = (it) => W.freeN(it) > 0 || (PRODUCERS.get(it) || []).some((p) => { const r = RECIPES[p.r]; return (!r.hidden || brain.mem.disc.has(r.id)) && (!r.tech || g.hasTech(r.tech)); });
    const item = P.soldierTarget && !ready(opts[0]) ? opts.find(ready) || opts[0] : opts[0];
    const k = Math.min(n, trainees);
    if (item === 'mace') { need(P, 'mace', k, prio, '训练锤卫', '战斗'); need(P, 'shield', k, prio, '训练锤卫', '战斗'); }
    else need(P, item, k, prio, '训练士兵', '战斗');
    P.trainWith = item;
    made += k;
  }
  // gear for whoever lacks it
  const bare = W.people.filter((p) => CARDS[p.d].kind === 'folk' && !CARDS[p.d].tags.includes('child') && p.gear && !p.gear.weapon);
  if (made < n && bare.length) {
    const weapon = gearOpts.find((id) => CARDS[id].gear.slot === 'weapon');
    if (weapon) need(P, weapon, Math.min(n - made, bare.length), prio - 6, '为战士打造武器', '战斗');
  }
  const unarmored = W.people.filter((p) => CARDS[p.d].tags.includes('soldier') && p.gear && !p.gear.armor);
  const armor = gearOpts.find((id) => CARDS[id].gear.slot === 'armor');
  if (unarmored.length && armor) need(P, armor, Math.min(2, unarmored.length), prio - 10, '为士兵准备护甲', '战斗');
}

/** give free gear to whoever benefits most; heal the injured */
export function equipAndHeal(brain, W) {
  const g = W.g;
  const execs = [];
  for (const gc of W.gear) {
    const gd = CARDS[gc.d].gear;
    // a shield is worth more as half of a maceguard's kit than as a trinket
    if (CARDS[gc.d].tags.includes('trainer') && (g.hasTech('tactics') || (g.techAllowed('tactics') && brain.threat && brain.threat.traits.includes('armored')))) continue;
    let best = null, bs = 0;
    for (const p of W.people) {
      const d = CARDS[p.d];
      if (d.kind !== 'folk' || d.tags.includes('child') || brain.locked.has(p.id)) continue;
      const st = g.s.stacks[p.s];
      if (!st || st.held) continue;
      const cur = p.gear && p.gear[gd.slot];
      const cg = cur ? CARDS[cur].gear : null;
      const curV = cg ? (cg.atk || 0) * 3 + (cg.hp || 0) + (cg.def || 0) * 3 + (cg.light ? 3 : 0) + (cg.warm && g.rules.cold ? 6 : 0) : 0;
      const newV = (gd.atk || 0) * 3 + (gd.hp || 0) + (gd.def || 0) * 3 + (gd.light ? 3 : 0) + (gd.warm && g.rules.cold ? 6 : 0);
      if (newV <= curV) continue;
      let s = newV - curV;
      if (d.tags.includes('soldier')) s *= 2;
      if (st.battle) s *= 1.5;
      if (s > bs) { bs = s; best = p; }
    }
    if (best) {
      execs.push(new Exec({ key: 'equip:' + gc.id, kind: 'equip', prio: 120, why: `给${best.name}装备${CARDS[gc.d].name}`, cat: '战斗' },
        [{ op: 'drop', id: gc.id, target: best.id }], { lock: [gc.id] }));
      break;
    }
  }
  for (const m of W.medicine) {
    const md = CARDS[m.d];
    let best = null, bs = 0;
    for (const p of W.people) {
      const mh = g.maxHp(p);
      const lack = mh - p.hp + (p.st && p.st.sick ? 4 : 0);
      if (lack < Math.min(3, md.heal) || brain.locked.has(p.id)) continue;
      if (lack > bs) { bs = lack; best = p; }
    }
    if (best) {
      execs.push(new Exec({ key: 'heal:' + m.id, kind: 'heal', prio: 130, why: `用${md.name}治疗${best.name}`, cat: '生存' },
        [{ op: 'drop', id: m.id, target: best.id }], { lock: [m.id] }));
      break;
    }
  }
  return execs;
}
