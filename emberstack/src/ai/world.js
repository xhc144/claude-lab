// Perception: a structured snapshot of everything a player can see on the board, rebuilt every
// time the AI thinks. Nothing here reads hidden state (future events, loot rolls, hidden recipes).

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { CARD_W, CARD_H } from '../sim/constants.js';
import { strengthOf } from '../sim/combat.js';

export function perceive(g, brain) {
  const s = g.s;
  const W = {
    g, mem: brain.mem, brain, t: s.t, day: s.day, phase: g.phase(), night: g.isNight(), season: g.season(),
    dayLen: g.dayLen(), cards: Object.values(s.cards), stacks: Object.values(s.stacks),
  };
  const locked = brain.locked;
  const freeMap = new Map();
  const countMap = new Map();
  const tagFree = new Map();
  W.workers = [];
  W.children = [];
  W.people = [];
  W.hostiles = [];
  W.lairs = [];
  W.beasts = [];
  W.regions = [];
  W.fires = [];
  W.structs = [];
  W.nodes = [];
  W.events = [];
  W.caravans = [];
  W.openables = [];
  W.graves = [];
  W.gear = [];
  W.medicine = [];
  for (const c of W.cards) {
    const d = CARDS[c.d];
    countMap.set(c.d, (countMap.get(c.d) || 0) + 1);
    const st = s.stacks[c.s];
    if (!st) continue;
    if (d.tags.includes('person')) {
      W.people.push(c);
      if (d.tags.includes('child')) W.children.push(c);
      else if (d.tags.includes('worker') && g.isActive(c)) W.workers.push(c);
    }
    if (d.kind === 'enemy') W.hostiles.push(c);
    if (d.kind === 'lair') W.lairs.push(c);
    if (d.kind === 'beast' && st.mob) W.beasts.push(c);
    if (d.kind === 'region') W.regions.push(c);
    if (d.kind === 'structure' || d.kind === 'wonder') W.structs.push(c);
    if (d.fuelMax && d.kind === 'structure') W.fires.push(c);
    if (d.node && !(d.kind === 'structure' && !d.node)) W.nodes.push(c);
    if (d.kind === 'event') { if (c.offers) W.caravans.push(c); else if (c.ev) W.events.push(c); }
    if (c.d === 'grave') W.graves.push(c);
    if (locked.has(c.id)) continue;
    if (!g.isFree(c)) continue;
    if (d.open && (d.open.type === 'bundle' || d.open.type === 'scroll' || d.open.type === 'tome' || d.open.type === 'reveal')) W.openables.push(c);
    if (d.kind === 'gear') W.gear.push(c);
    if (d.heal && d.kind === 'tool') W.medicine.push(c);
    if (!freeMap.has(c.d)) freeMap.set(c.d, []);
    freeMap.get(c.d).push(c);
    for (const t of d.tags) {
      if (!tagFree.has(t)) tagFree.set(t, []);
      tagFree.get(t).push(c);
    }
  }
  W.free = (id) => (id[0] === '#' ? tagFree.get(id.slice(1)) || [] : freeMap.get(id) || []);
  W.freeN = (id) => W.free(id).length;
  W.count = (id) => countMap.get(id) || 0;
  W.nodeCount = (id) => {
    let n = 0;
    for (const c of W.nodes) if (c.d === id && (CARDS[id].node.charges < 0 || c.ch > 0 || CARDS[id].node.perennial)) n++;
    return n;
  };
  W.tagPresent = (tag) => W.cards.some((c) => CARDS[c.d].tags.includes(tag));

  // what running tasks are about to produce
  W.incoming = new Map();
  W.taskStacks = [];
  for (const st of W.stacks) {
    if (!st.task) continue;
    W.taskStacks.push(st);
    const r = RECIPES[st.task.r];
    if (st.task.block && st.task.block !== '太暗了' && st.task.block !== '等待夜晚') continue;
    for (const [id, n, p] of r.out) W.incoming.set(id, (W.incoming.get(id) || 0) + n * (p ?? 1));
  }

  // workers and what they do
  W.idle = [];
  W.busy = [];
  for (const w of W.workers) {
    const st = s.stacks[w.s];
    if (st.battle || locked.has(w.id)) continue;
    const stuck = st.task && st.task.block && (!['太暗了', '等待夜晚'].includes(st.task.block) || (st.task.block === '太暗了' && ((st.task.bt || 0) > 6 && (g.rules.dark || CARDS[g.s.cards[st.cards[0]].d].kind === 'region'))));
    if (st.task && !stuck && (st.task.m.workers.includes(w.id) || st.task.m.extra.includes(w.id) || st.task.m.keep.includes(w.id))) W.busy.push({ w, st, r: st.task.r });
    else if (st.task && st.task.m.consume.includes(w.id)) continue; // being trained
    else W.idle.push(w);
  }
  W.soldiers = W.people.filter((c) => CARDS[c.d].tags.includes('soldier'));

  // light: positions that stay lit through the night (structures / people with their own light)
  W.nightLights = g.lights.filter((L) => L.struct);
  W.nightLit = (x, y, margin = 0) => W.nightLights.some((L) => Math.hypot(L.x - x, L.y - y) < L.r - margin);
  const mainFire = W.fires.filter((c) => g.cardLight(c) > 0 || c.d === 'campfire' || c.d === 'hearth').sort((a, b) => (CARDS[b.d].light || 0) - (CARDS[a.d].light || 0))[0]
    || W.structs.find((c) => CARDS[c.d].light);
  W.anchor = mainFire ? g.cardPos(mainFire) : g.colonyCenter();
  W.mainFire = mainFire || null;
  // how many free card-sized spots remain inside the lights that burn all night
  W.litSpots = () => {
    if (W._litSpots !== undefined) return W._litSpots;
    const others = W.stacks.filter((st) => !st.mob && !st.held);
    let n = 0;
    const seen = [];
    for (const L of W.nightLights) {
      for (let r = 60; r < L.r - 50; r += 95) {
        const k = Math.max(1, Math.floor((2 * Math.PI * r) / 130));
        for (let i = 0; i < k; i++) {
          const a = (i / k) * Math.PI * 2;
          const x = L.x + Math.cos(a) * r - CARD_W / 2, y = L.y + Math.sin(a) * r - CARD_H / 2;
          if (seen.some((p) => Math.abs(p.x - x) < CARD_W + 10 && Math.abs(p.y - y) < CARD_H + 10)) continue;
          if (others.some((st) => x < st.x + CARD_W + 8 && x + CARD_W + 8 > st.x && y < st.y + g.stackH(st) + 8 && y + CARD_H + 8 > st.y)) continue;
          seen.push({ x, y });
          n++;
        }
      }
    }
    return (W._litSpots = n);
  };

  // food & needs
  W.canCook = W.cards.some((c) => CARDS[c.d].tags.includes('cook')) && g.hasTech('cooking');
  W.appetite = W.people.reduce((a, c) => a + (CARDS[c.d].appetite || 0), 0);
  let food = 0;
  for (const c of W.cards) {
    const d = CARDS[c.d];
    if (d.store) food += c.store || 0;
    if (!(d.food > 0)) continue;
    const st = s.stacks[c.s];
    if (!st || st.mob) continue;
    let f = c.fl ?? d.food;
    if (d.tags.includes('raw') && W.canCook) f *= 2;
    food += f;
  }
  W.food = food;
  // food that will still be edible after a few days (granary stores, preserved and grain)
  let durable = 0;
  for (const c of W.cards) {
    const d = CARDS[c.d];
    if (d.store) durable += c.store || 0;
    if (!(d.food > 0) || d.tags.includes('raw')) continue;
    const st = s.stacks[c.s];
    if (!st || st.mob) continue;
    if (c.sp === undefined || c.sp >= 3) durable += c.fl ?? d.food;
  }
  W.durable = durable;
  W.pop = g.population();
  W.housing = g.housing();
  // seasons
  const R = g.rules;
  if (R.seasons) {
    const sd = R.seasonDays || 3;
    const dayInYear = ((R.startSeason || 0) * sd + (s.day - 1)) % (sd * 4);
    const winterStart = sd * 3;
    W.daysToWinter = W.season === 3 ? 0 : winterStart - dayInYear;
    W.winterLeft = W.season === 3 ? sd * 4 - dayInYear : 0;
  } else {
    W.daysToWinter = 99;
    W.winterLeft = 0;
  }
  W.winterMult = R.winterAppetite ?? 1.5;
  W.dailyNeed = W.people.reduce((a, c) => a + (CARDS[c.d].appetite || 0), 0) * (W.season === 3 ? W.winterMult : 1);

  // threats
  const cc = W.anchor;
  W.threats = W.hostiles.map((c) => {
    const st = s.stacks[c.s];
    const p = { x: st.x + CARD_W / 2, y: st.y + CARD_H / 2 };
    return { c, d: CARDS[c.d], st, p, dist: Math.hypot(p.x - cc.x, p.y - cc.y), inBattle: !!st.battle };
  });
  W.battles = Object.values(s.battles);
  W.warnings = (g.level.schedule || []).filter((e, i) => e.warn && !s.sched.includes(i) && e.day >= s.day);
  W.strengthVs = (traits) => W.people.filter((c) => CARDS[c.d].kind === 'folk' && !CARDS[c.d].tags.includes('child')).reduce((a, c) => a + strengthOf(g, c, traits), 0);
  return W;
}
