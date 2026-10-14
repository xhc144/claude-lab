// The AI player. Every second of game time it looks at the board, weighs what matters (food before
// winter, fuel before nightfall, soldiers before the wolves come, the level's goals), plans the work
// backwards through the recipe graph and hands out jobs; between thoughts it performs one physical
// action at a time (≈160 APM), exactly like a quick human player would.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { TECHS } from '../data/techs.js';
import { EVENTS } from '../data/events.js';
import { ACTION_INTERVAL, CARD_W, CARD_H } from '../sim/constants.js';
import { tryRecipe } from '../sim/match.js';
import { techStatus } from '../sim/economy.js';
import { canPay } from '../sim/eventsim.js';
import { sellValue } from '../sim/drop.js';
import { seasonMult } from '../sim/tasks.js';
import { perceive } from './world.js';
import { STRATEGIES } from './strategies.js';
import { isKnown, itemCost, foodRate } from './knowledge.js';
import { newPlan, need, produce, needFood, objectiveNeeds, chooseTech, goal, addJob, availFree, cheapestLight } from './planner.js';
import { Exec, runStep, recipeLayout, workSpot, topRun } from './executor.js';
import { combatActions, assault, militaryNeeds, equipAndHeal, availableFighters, groupPower, enemyPower, defsPower } from './tactics.js';

const nm = (id) => CARDS[id]?.name || id;

function PRODUCERS_KNOWN(g, mem, item) {
  return Object.values(RECIPES).some((r) => r.out.some(([o]) => o === item) && isKnown(g, mem, r.id));
}

export function newMemory() {
  return { disc: new Set(), tried: new Set(), wins: 0, games: 0 };
}

const TRAINERS = {
  spear: { train: 'train_spearman', max: 99 }, bow: { train: 'train_archer', max: 99 }, lantern: { train: 'train_lampwarden', max: 3 },
  book: { train: 'train_scholar', max: 2 }, herb_kit: { train: 'train_healer', max: 1 }, toolbox: { train: 'train_artisan', max: 2 },
  map: { train: 'train_scout', max: 1 }, scale: { train: 'train_merchant', max: 1 }, compass: { train: 'train_sailor', max: 2 },
  hoe: { train: 'train_farmer', max: 2, needs: 'field' }, star_chart: { train: 'train_sage', max: 2 }, musket: { train: 'train_musketeer', max: 99 },
  mace: { train: 'train_maceguard', max: 99 }, holy_flame: { train: 'train_flamekeeper', max: 2 },
};

export class Brain {
  constructor(g, opts = {}) {
    this.g = g;
    this.setStrategy(opts.strategy || 'balanced');
    this.mem = opts.mem || newMemory();
    this.enabled = opts.enabled ?? true;
    this.execs = [];
    this.locked = new Set();
    this.cd = 0;
    this.thinkT = 0;
    this.log = [];
    this.goals = [];
    this.fail = new Map();
    this.lastNote = new Map();
    this.stats = { actions: 0, thinks: 0, experiments: 0, found: 0, jobs: 0 };
    this.techTarget = null;
    this.lastExperiment = -999;
    this.W = null;
    this.threat = { want: 0, have: 0, traits: [] };
    this.focus = '';
    this.onLog = null;
  }

  setStrategy(id) {
    this.strategyId = STRATEGIES[id] ? id : 'balanced';
    this.base = STRATEGIES[this.strategyId];
    this.strat = { ...this.base };
  }

  note(cat, text, important = false) {
    const g = this.g;
    const k = cat + text;
    const last = this.lastNote.get(k);
    if (last !== undefined && g.s.t - last < 25) return;
    this.lastNote.set(k, g.s.t);
    const e = { t: g.s.t, day: g.s.day, cat, text, important };
    this.log.push(e);
    if (this.log.length > 300) this.log.splice(0, 100);
    if (this.onLog) this.onLog(e);
  }

  /** called every simulation step while the AI is in control */
  update(dt) {
    if (!this.enabled || this.g.s.result) return;
    this.thinkT -= dt;
    this.cd -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 1.0;
      this.think();
    }
    if (this.cd <= 0) {
      if (this.act()) this.cd = ACTION_INTERVAL;
      else this.cd = 0.15;
    }
  }

  act() {
    const g = this.g;
    this.execs.sort((a, b) => b.job.prio - a.job.prio);
    for (const ex of this.execs) {
      const r = runStep(this, g, ex);
      if (r === 'act') {
        this.stats.actions++;
        this.current = { label: ex.label || '', cat: ex.job.cat || '' };
        this.refreshLocks();
        return true;
      }
      if (r === 'fail') this.onFail(ex);
      if (r === 'done') this.onDone(ex);
    }
    this.execs = this.execs.filter((e) => e.state === 'run');
    this.refreshLocks();
    return false;
  }

  onFail(ex) {
    const k = ex.job.key;
    const n = (this.failCount ||= new Map()).get(k) || 0;
    this.failCount.set(k, n + 1);
    this.fail.set(k, this.g.s.t + 12 + n * 10);
    if (ex.job.kind === 'experiment') return this.onDone(ex);
    if (ex.why) this.note('思考', `放弃「${ex.label}」：${ex.why}`);
  }

  onDone(ex) {
    if (ex.job.kind === 'experiment' && !ex.noted) {
      const sc = this.g.s.cards[ex.site];
      const st = sc && this.g.s.stacks[sc.s];
      const found = st && st.task && RECIPES[st.task.r].hidden;
      this.mem.tried.add(ex.job.combo);
      if (found) {
        this.mem.disc.add(st.task.r);
        this.stats.found++;
        this.note('实验', `实验成功！发现了隐藏配方「${RECIPES[st.task.r].name}」`, true);
      } else this.note('实验', `尝试 ${ex.job.label}：没有反应，记下了。`);
    }
  }

  refreshLocks() {
    const L = new Set();
    for (const ex of this.execs) {
      if (ex.state !== 'run') continue;
      for (const id of ex.lockIds) L.add(id);
      const sc = this.g.s.cards[ex.site];
      if (sc) { const st = this.g.s.stacks[sc.s]; if (st) for (const id of st.cards) L.add(id); }
    }
    this.locked = L;
  }

  adapt(W) {
    const S = { ...this.base };
    if (this.base.adaptive) {
      const hungry = W.people.filter((p) => p.st && p.st.hungry).length;
      if (hungry) { S.foodDays += 0.8; S.caution += 0.1; }
      if (this.g.s.stats.deaths > 0) { S.caution = Math.min(1, S.caution + 0.15); S.army += 0.2; }
      if (W.food > W.dailyNeed * 3 && !hungry) S.objective += 0.25;
    }
    this.strat = S;
  }

  // =================================================================================== thinking
  think() {
    const g = this.g;
    this.stats.thinks++;
    this.execs = this.execs.filter((e) => e.state === 'run');
    this.refreshLocks();
    const W = (this.W = perceive(g, this));
    this.curfew = false;
    this.adapt(W);
    const P = newPlan(W, this.strat);
    this.P = P;
    const S = this.strat;
    const fresh = [];

    // ---- 0. decisions that need no worker: events, research, opening things
    this.decideEvents(W, P, fresh);
    // ---- 1. combat first
    for (const ex of combatActions(this, W)) fresh.push(ex);
    for (const ex of equipAndHeal(this, W)) fresh.push(ex);

    // ---- 2. survival
    const fuelUrgent = this.fuelNeeds(W, P, fresh);
    this.foodNeeds(W, P, fresh);
    // ---- 3. the level's goals
    objectiveNeeds(P);
    this.killTargets(W, P, fresh);
    // ---- 4. growth, fog, light, army
    this.growthNeeds(W, P);
    this.fogNeeds(W, P);
    this.lightNeeds(W, P);
    this.exploreNeeds(W, P);
    militaryNeeds(this, P);
    this.trainingJobs(W, P);
    // ---- 5. knowledge
    this.researchNeeds(W, P, fresh);
    // ---- 6. trade
    this.tradeNeeds(W, P, fresh);
    // ---- 7. background: stock, exploration, curiosity
    this.stockNeeds(W, P);
    this.housekeeping(W, P, fresh);

    this.hintJobs(W, P);
    this.darkFix(W, fresh);
    this.coldPrep(W, P, fresh);

    // ---- assign
    for (const ex of fresh) this.start(ex);
    // cards that the quick jobs above will move are not available to the planner's jobs
    P.execClaims = new Map();
    for (const ex of fresh) for (const st of ex.steps) if (st.op === 'dropRef' || st.op === 'bring') P.execClaims.set(st.ref, (P.execClaims.get(st.ref) || 0) + (st.n || 0));
    this.assign(W, P);
    if (W.idle.length > this.execs.length) this.experiment(W, P);
    this.morningReport(W);
    if (this.execs.filter((e) => e.job.kind !== 'tidy').length <= 2 && !this.execs.some((e) => e.job.kind === 'tidy')) this.tidy(W);

    this.goals = P.goals.sort((a, b) => b.prio - a.prio).slice(0, 8);
    this.focus = this.goals[0] ? this.goals[0].name : '';
    void fuelUrgent; void S;
  }

  start(ex) {
    if (this.execs.some((e) => e.job.key === ex.job.key && e.state === 'run')) return false;
    for (const id of ex.lockIds) if (this.locked.has(id)) return false;
    ex.born = this.g.s.t;
    this.execs.push(ex);
    for (const id of ex.lockIds) this.locked.add(id);
    this.stats.jobs++;
    if (ex.job.why && ex.job.kind !== 'tidy') this.note(ex.job.cat || '思考', ex.job.why + (ex.desc ? ' → ' + ex.desc : ''), ex.job.prio >= 150);
    return true;
  }

  // ----------------------------------------------------------------------------------- survival
  fuelNeeds(W, P, fresh) {
    const g = this.g, S = this.strat;
    let urgent = false;
    const winter = W.season === 3 && g.rules.seasons;
    for (const f of W.fires) {
      const d = CARDS[f.d];
      if (!d.light && !d.aura) continue;
      const burn = (d.burn || 1) * (winter && d.tags.includes('fire') && !d.warmth ? 2 : 1) + (g.rules.cold && d.tags.includes('fire') && !d.warmth ? 0.5 : 0);
      const days = (f.fuel || 0) / burn;
      const main = W.mainFire && f.id === W.mainFire.id;
      const want = main ? S.fuelDays + 0.5 : S.fuelDays * 0.6;
      if (days >= want) continue;
      const room = d.fuelMax - (f.fuel || 0);
      if (room < 1) continue;
      const prio = (f.fuel || 0) <= 0.5 ? (main ? 160 : 90) : days < 1.2 ? (main ? 120 : 60) : main ? 70 : 35;
      if (main && days < 1.2) urgent = true;
      const tags = d.fuelTags;
      // pick a free fuel card
      let item = null;
      // burn what is plentiful: score each free fuel by how much of it there is, and keep a little
      // coal back for the smelter and planks for building
      let bestScore = 0;
      const smelting = W.count('smelter') || W.count('forge') || W.count('clock_workshop');
      for (const id of ['wood', 'driftwood', 'resin', 'charcoal', 'plank', 'coal', 'oil']) {
        if (!tags.some((t) => CARDS[id].tags.includes(t))) continue;
        const n = availFree(P, id);
        if (n <= 0) continue;
        let sc = n * (id === 'oil' ? 3 : CARDS[id].fuel || 1);
        if (id === 'plank') sc *= 0.3;
        if (id === 'coal' && smelting && n <= 4) sc *= 0.25;
        if (id === 'wood' && n <= 2) sc *= 0.5;
        if (sc > bestScore) { bestScore = sc; item = id; }
      }
      if (item) {
        const per = item === 'oil' ? 3 : CARDS[item].fuel || 1;
        const n = Math.max(1, Math.min(availFree(P, item), Math.floor(room / per), Math.ceil((want * burn - (f.fuel || 0)) / per) + 1));
        P.claimed.set(item, (P.claimed.get(item) || 0) + n);
        fresh.push(new Exec({ key: 'fuel:' + f.id, kind: 'fuel', prio, why: `${d.name}只剩 ${Math.round((f.fuel || 0) * 10) / 10} 份燃料，添柴`, cat: '生存' },
          [{ op: 'dropRef', ref: item, n, target: f.id }], { lock: [f.id] }));
      } else {
        const fuelItem = tags.includes('oil') ? 'oil' : tags.includes('smeltfuel') && !tags.includes('fuel') ? 'charcoal' : 'wood';
        need(P, fuelItem, 2, prio - 5, `${d.name}需要燃料`, '生存');
      }
    }
    return urgent;
  }

  foodNeeds(W, P, fresh) {
    const g = this.g, S = this.strat;
    if (!W.appetite) return;
    // cook raw food on a free fire
    if (W.canCook) {
      const raw = ['raw_fish', 'raw_meat', 'mussel', 'mushroom', 'root'].filter((id) => availFree(P, id) > 0);
      if (raw.length) {
        const fires = W.structs.filter((c) => CARDS[c.d].tags.includes('cook') && !this.locked.has(c.id));
        for (const fire of fires) {
          const st = g.s.stacks[fire.s];
          if (!st || st.battle) continue;
          if (st.task && !RECIPES[st.task.r].id.startsWith('cook_')) continue;
          const already = st.cards.length > 1 ? g.s.cards[st.cards[st.cards.length - 1]].d : null;
          const item = already && raw.includes(already) ? already : raw[0];
          if (st.cards.length > 1 && !st.cards.slice(1).every((id) => g.s.cards[id].d === item)) continue;
          const n = availFree(P, item);
          P.claimed.set(item, (P.claimed.get(item) || 0) + n);
          fresh.push(new Exec({ key: 'cook:' + fire.id, kind: 'cook', prio: 75, why: `把${nm(item)}放到${nm(fire.d)}上烤熟（饱腹翻倍）`, cat: '生存' },
            [{ op: 'dropRef', ref: item, n, target: fire.id }], { lock: [fire.id] }));
          break;
        }
      }
    }
    // store perishables in a granary before they rot / before winter
    const gran = W.structs.find((c) => CARDS[c.d].store && (c.store || 0) < CARDS[c.d].store.cap - 3 && !this.locked.has(c.id));
    if (gran && (W.daysToWinter <= 5 || W.food > W.dailyNeed * 2)) {
      const perish = W.cards.filter((c) => c.sp !== undefined && (c.sp <= 2 || W.daysToWinter <= 5) && CARDS[c.d].food >= 2 && g.isFree(c) && !this.locked.has(c.id) && !CARDS[c.d].tags.includes('raw'));
      if (perish.length) {
        const id = perish[0].d;
        fresh.push(new Exec({ key: 'store:' + id, kind: 'store', prio: 40, why: `把快坏的${nm(id)}存进谷仓`, cat: '生存' },
          [{ op: 'dropRef', ref: id, n: Math.min(4, availFree(P, id)), target: gran.id }], { lock: [gran.id] }));
      }
    }
    const daily = W.dailyNeed;
    const hungry = W.people.filter((p) => p.st && p.st.hungry).length;
    // ---- winter: perishable food rots before it can be eaten, so stockpile what keeps
    if (g.rules.seasons && W.season !== 3 && W.daysToWinter <= 6) {
      const winterDays = g.rules.seasonDays || 3;
      const winterNeed = W.appetite * (W.winterMult || 1.5) * winterDays;
      this.winterNeed = winterNeed;
      if (W.durable < winterNeed) {
        const urgency = 1 - W.durable / winterNeed;
        const wp = 50 + 35 * urgency * (W.daysToWinter <= 3 ? 1.3 : 1);
        goal(P, '过冬储粮', wp, '生存', `${Math.round(W.durable)}/${Math.round(winterNeed)}`);
        if (g.techAllowed('storage') && !W.count('granary')) produce(P, 'granary', 1, wp + 5, '冬天要来了，建谷仓存粮（存进去的食物不会坏）', '生存');
        if (g.hasTech('cooking') && !W.count('drying_rack') && (W.beasts.length || availFree(P, 'raw_meat'))) produce(P, 'drying_rack', 1, wp - 10, '搭晾架，把肉风干过冬', '生存');
        if (g.hasTech('farming') && W.count('field') < Math.ceil(W.pop / 3) && W.daysToWinter >= 2) produce(P, 'field', 1, wp - 4, '多开一块田，谷物放不坏', '生存');
        if (g.hasTech('curing') && W.count('salt_flat') && availFree(P, 'raw_fish') + availFree(P, 'raw_meat') >= 2) produce(P, availFree(P, 'raw_fish') >= 2 ? 'salted_fish' : 'jerky', 2, wp, '腌制鱼肉过冬', '生存');
        needFood(P, winterNeed - W.durable, wp, `为冬天储备不会坏的粮食（${Math.round(W.durable)}/${Math.round(winterNeed)}）`, 2);
      }
    }
    let horizon = S.foodDays;
    if (g.rules.seasons && W.daysToWinter <= 4 && W.season !== 3) horizon += Math.min(3, (g.rules.seasonDays || 3)) * (W.winterMult || 1.5) * 0.7;
    if (W.season === 3) horizon += Math.min(W.winterLeft, 2) * 0.5;
    const target = Math.max(P.foodTarget || 0, daily * horizon);
    // what must be ready by the next dawn, and how much daylight is left to get it
    const timeLeft = Math.max(4, (1 - W.phase) * W.dayLen);
    const shortNow = daily - W.food;
    const rate = this.bestFoodRate(W);
    const workersNow = shortNow > 0 ? shortNow / Math.max(0.02, rate * timeLeft * 0.75) : 0;
    const nWorkers = Math.max(1, W.workers.length);
    if (shortNow <= 0 && W.food >= target && !hungry) {
      if (W.food < daily * (S.foodDays + 1.5)) needFood(P, Math.max(0, daily * 0.5), 16, '保持食物来源');
      return;
    }
    let prio, why;
    if (shortNow > 0) {
      prio = 72 + 58 * Math.min(1, workersNow / nWorkers);
      if (hungry) prio = Math.max(prio, 128);
      why = `明早要吃 ${Math.round(daily)} 份，现有 ${Math.round(W.food)} 份`;
    } else {
      prio = 38 + 22 * Math.min(1, (target - W.food) / Math.max(1, target));
      why = `储备食物（${Math.round(W.food)}/${Math.round(target)}）`;
    }
    if (P.foodTarget && P.foodTargetPrio) prio = Math.max(prio, P.foodTargetPrio);
    P.foodPrio = prio - 6;
    goal(P, shortNow > 0 ? '明天的口粮' : '储备食物', prio, '生存', `${Math.round(W.food)}/${Math.round(shortNow > 0 ? daily : target)}`);
    needFood(P, Math.max(shortNow, target - W.food), prio, why, shortNow > 0 ? Math.ceil(workersNow) : 1);
    // the land barely feeds us: invest in farming before it is too late
    const prodNow = this.prodAvg;
    if (prodNow !== undefined && prodNow < W.appetite * 1.25 && W.pop >= 3) {
      const ip = 48 + (prodNow < W.appetite ? 20 : 0);
      goal(P, '扩大粮食生产', ip, '生存', `日产 ${Math.round(prodNow)} / 日耗 ${Math.round(W.appetite)}`);
      if (g.techAllowed('farming') && !g.hasTech('farming')) P.techNeed.set('farming', Math.max(P.techNeed.get('farming') || 0, ip));
      else if (g.hasTech('farming') && W.season !== 3 && W.count('field') < Math.ceil(W.pop / 2.5)) produce(P, 'field', 1, ip, '开垦更多田地', '生存');
      if (g.hasTech('fishing') && !W.free('#rod').length && (W.count('river') || W.count('pond'))) need(P, 'fishing_rod', 1, ip - 6, '钓竿让捕鱼更快', '生存');
    }
    // winter: build a granary and preserve meat
    if (g.rules.seasons && W.daysToWinter <= 6 && W.pop >= 3 && g.techAllowed('storage') && !W.count('granary')) produce(P, 'granary', 1, prio - 15, '冬天要来了，建谷仓存粮', '生存');
    if (g.hasTech('cooking') && availFree(P, 'raw_meat') >= 2 && W.daysToWinter <= 5 && !W.count('drying_rack')) produce(P, 'drying_rack', 1, prio - 20, '风干肉过冬', '生存');
  }

  bestFoodRate(W) {
    let best = 0.04;
    for (const c of W.nodes) {
      const nd = CARDS[c.d].node;
      if (!nd.out.some(([id]) => CARDS[id].food > 0)) continue;
      if (nd.charges > 0 && c.ch <= 0) continue;
      const sm = seasonMult(this.g, nd);
      if (sm <= 0) continue;
      best = Math.max(best, foodRate(W, c.d) * sm);
    }
    return best;
  }

  // ----------------------------------------------------------------------------------- goals
  killTargets(W, P, fresh) {
    const g = this.g;
    const targets = [...(P.killTargets || [])];
    // lairs that keep sending raiders are worth removing too
    for (const l of W.lairs) if (!targets.some((t) => t.card === l.d)) targets.push({ card: l.d, prio: 55 * this.strat.army });
    for (const t of targets) {
      const cards = W.cards.filter((c) => c.d === t.card);
      if (!cards.length) {
        // maybe exploring reveals it
        for (const r of W.regions) {
          const rd = CARDS[r.d].region;
          if ((r.reveal || rd.reveal || []).includes(t.card)) {
            addJob(P, { key: 'e:' + r.id, kind: 'explore', r: 'explore_' + r.d, site: r.id, prio: t.prio, why: `寻找${nm(t.card)}的巢穴（探索${nm(r.d)}）`, cat: '探索', want: 2 });
          }
        }
        continue;
      }
      const target = cards[0];
      const st = g.s.stacks[target.s];
      if (st && st.battle) continue;
      // the Ash King is only mortal once the Great Flame burns: until then, build it and wait
      if (target.d === 'ash_king' && !W.count('great_flame') && !(target.ai && target.ai.act)) { goal(P, '先点燃大薪火', t.prio, '战斗', '灰烬之王在火光之外不可战胜'); continue; }
      const ex = assault(this, W, target, Math.max(150, t.prio + 80), `军力已足，进攻${nm(t.card)}！`);
      if (ex) fresh.push(ex);
      else goal(P, '集结军队：' + nm(t.card), t.prio, '战斗', `${Math.round((this.armyReady || 0) * 100)}%`);
    }
  }

  growthNeeds(W, P) {
    const g = this.g, S = this.strat;
    const objPop = P.popTarget || 0;
    let target = Math.max(objPop, Math.round(S.popTarget * S.growth));
    const militaryPop = objPop > 0 && !g.s.objectives.some((o) => o.type === 'pop');
    if (g.rules.noBirth) return;
    // food stock and production, dawn to dawn: production = stock change + what was eaten
    const prod = this.foodProduction(W);
    const hist = this.dawnFood || [];
    const trend = hist.length >= 2 ? hist[hist.length - 1] - hist[hist.length - 2] : 0;
    const recentHunger = W.people.some((p) => p.st && p.st.hungry);
    const perHead = 2 * (W.season === 3 || (g.rules.seasons && W.daysToWinter <= 3) ? W.winterMult || 1.5 : 1);
    const sustainable = prod === null || prod >= (W.appetite + perHead) * 1.05;
    let foodOk = (W.food >= W.dailyNeed * 1.6 + 2 && trend >= -1 && !recentHunger && sustainable) || (objPop > W.pop && !recentHunger && W.food >= W.dailyNeed);
    if (g.rules.seasons && (W.daysToWinter <= 5 || W.season === 3) && W.durable < (this.winterNeed || W.dailyNeed * 4) * 1.1) {
      foodOk = false;
      if (objPop <= W.pop) target = Math.min(target, W.pop);
    }
    if (W.food < W.dailyNeed && !objPop) return;
    if (W.pop >= target) return;
    const prio = objPop > W.pop ? P.popPrio || 70 : 32 * S.growth;
    goal(P, '人口增长', prio, '建设', `${W.pop}/${target}`);
    if (W.housing <= W.pop) {
      const house = this.bestHouse();
      produce(P, house, 1, prio, `需要更多房屋（${W.housing} 床位，${W.pop} 人）`, '建设');
      return;
    }
    if (!foodOk && !objPop) return;
    const adults = W.idle.filter((w) => CARDS[w.d].tags.includes('adult'));
    const houses = W.structs.filter((c) => CARDS[c.d].tags.includes('house') && !this.locked.has(c.id) && !g.s.stacks[c.s].task);
    if (houses.length && adults.length + W.busy.length >= 2) {
      addJob(P, { key: 'c:birth', kind: 'craft', r: 'birth', site: houses[0].id, item: 'child', n: 1, prio, why: `人口 ${W.pop}，房屋有空位，生个孩子`, cat: '建设' });
    }
  }

  /** measured food production per day (null until two dawns have passed) */
  foodProduction(W) {
    const g = this.g;
    if (this.lastDay !== W.day) {
      this.lastDay = W.day;
      (this.dawnFood ||= []).push(W.food);
      (this.dawnEaten ||= []).push(g.s.stats.eaten);
      if (this.dawnFood.length > 4) { this.dawnFood.shift(); this.dawnEaten.shift(); }
      const n = this.dawnFood.length;
      if (n >= 2) {
        const p = this.dawnFood[n - 1] - this.dawnFood[n - 2] + (this.dawnEaten[n - 1] - this.dawnEaten[n - 2]);
        this.prodAvg = this.prodAvg === undefined ? p : this.prodAvg * 0.5 + p * 0.5;
      }
    }
    return this.prodAvg === undefined ? null : this.prodAvg;
  }

  bestHouse() {
    const g = this.g;
    if (g.hasTech('masonry') && this.W.freeN('brick') >= 4) return 'stone_house';
    if (g.hasTech('carpentry')) return 'cabin';
    return 'lean_to';
  }

  fogNeeds(W, P) {
    const g = this.g, R = g.rules;
    if (!R.fogRate && !R.shades && P.fogTarget === undefined) return;
    const fog = g.s.fog;
    const loseRisk = (g.level.lose || []).some((l) => l.type === 'fog');
    const tgt = P.fogTarget ?? (loseRisk ? 55 : 70);
    // project fog in 3 days
    let rate = R.fogRate || 0;
    for (const c of W.cards) {
      const d = CARDS[c.d];
      if (d.fog && !(d.fog < 0 && d.fuelMax && !(c.fuel > 0))) rate += d.fog;
    }
    const proj = fog + rate * 3;
    if (proj < tgt - 5 && fog < tgt - 10) return;
    let prio = (P.fogPrio || 30) + Math.max(0, proj - tgt) * 0.8 + (loseRisk && fog > 70 ? 40 : 0);
    goal(P, '驱散灰雾', prio, '生存', `${Math.round(fog)}% → ${Math.round(proj)}%`);
    // graves: burying lowers fog
    for (const gr of W.graves) addJob(P, { key: 'c:bury:' + gr.id, kind: 'craft', r: 'bury', item: 'none', prio: prio + 4, why: '安葬逝者（灰雾 -2）', cat: '生存', siteCard: gr.id });
    const reducers = ['shrine', 'memorial', 'lighthouse', 'beacon', 'eternal_lamp'].filter((id) => {
      const ms = P.W && itemCost(W, id, P.memo);
      return ms < Infinity;
    });
    if (reducers.length) {
      reducers.sort((a, b) => itemCost(W, a, P.memo) / -CARDS[a].fog - itemCost(W, b, P.memo) / -CARDS[b].fog);
      produce(P, reducers[0], 1, prio, `灰雾 ${Math.round(fog)}%，正在上升（${rate >= 0 ? '+' : ''}${rate}/天）`, '生存');
    } else if (g.techAllowed('lore') && !g.hasTech('lore')) {
      P.techNeed.set('lore', Math.max(P.techNeed.get('lore') || 0, prio));
    }
    if (W.count('festival_ground') && W.freeN('feast')) addJob(P, { key: 'festival', kind: 'deliver', target: W.cards.find((c) => c.d === 'festival_ground').id, item: 'feast', n: 1, prio: prio + 2, why: '举办庆典驱散灰雾', cat: '生存' });
    // relight beacons
  }

  lightNeeds(W, P) {
    const g = this.g;
    if (!g.rules.shades && !g.rules.dark) return;
    // count working stacks that would sit in the dark at night
    const unlit = W.taskStacks.filter((st) => !W.nightLit(st.x + CARD_W / 2, st.y + CARD_H / 2) && !CARDS[g.s.cards[st.cards[0]].d].fixed && !RECIPES[st.task.r].dark);
    const crowd = W.stacks.filter((st) => !st.mob && W.nightLit(st.x + CARD_W / 2, st.y + CARD_H / 2)).length;
    const lightsBuilt = W.nightLights.length;
    const spots = W.litSpots();
    if (g.rules.dark && spots < 4) {
      produce(P, cheapestLight(P), 1, 92 - spots * 6, `火光里只剩 ${spots} 个空位，地下太黑了，立更多光源`, '生存');
    } else if ((unlit.length >= 2 && crowd > 7 && lightsBuilt < 2 + Math.floor(W.pop / 3)) || (g.rules.dark && lightsBuilt < 2) || (g.rules.shades && spots < 2)) {
      produce(P, cheapestLight(P), 1, 42 + (g.rules.dark ? 20 : 0), '营地太挤了，需要更多光照', '建设');
    }
    // portable light for the dark
    if (g.rules.dark && g.hasTech('torches') && availFree(P, 'torch') < 1) need(P, 'torch', 1, 40, '黑暗中需要火把', '生存');
  }

  trainingJobs(W, P) {
    const g = this.g;
    for (const [item, spec] of Object.entries(TRAINERS)) {
      const free = W.free(item);
      if (!free.length) continue;
      const r = RECIPES[spec.train];
      if (r.tech && !g.hasTech(r.tech)) continue;
      const out = r.out[0][0];
      if (W.count(out) >= spec.max) continue;
      if (spec.needs && !W.count(spec.needs)) continue;
      const traineeId = Object.keys(r.in).find((k) => CARDS[k] && CARDS[k].kind === 'folk');
      const trainees = W.people.filter((c) => c.d === traineeId && !this.locked.has(c.id) && !g.s.stacks[c.s]?.battle);
      if (!trainees.length) continue;
      if (item === 'mace' && !W.freeN('shield')) continue;
      // the Great Flame's heart needs a holy flame: don't spend one on a flamekeeper while the site waits
      if (item === 'holy_flame' && W.count('great_flame_site')) continue;
      const soldier = CARDS[out].tags.includes('soldier');
      addJob(P, { key: 'c:' + spec.train, kind: 'craft', r: spec.train, item: out, n: 1, prio: soldier ? 70 : 38, why: `训练一名${nm(out)}`, cat: soldier ? '战斗' : '建设' });
    }
    // knights
    if (g.hasTech('horsemanship') && W.freeN('saddle_horse') && W.freeN('iron_armor') && W.freeN('spearman'))
      addJob(P, { key: 'c:train_knight', kind: 'craft', r: 'train_knight', item: 'knight', n: 1, prio: 72, why: '训练骑卫', cat: '战斗' });
  }

  researchNeeds(W, P, fresh) {
    const g = this.g, S = this.strat;
    let target = this.techTarget;
    if (target && (g.hasTech(target) || !g.techAllowed(target))) target = null;
    const best = chooseTech(P);
    // switch only if the new choice is needed more urgently
    if (!target || (best && best !== target && (P.techNeed.get(best) || 0) > (P.techNeed.get(target) || 0) + 10)) target = best;
    this.techTarget = target;
    if (!target) return;
    const st = techStatus(g, target);
    const t = TECHS[target];
    const prio = Math.max(P.techNeed.get(target) || 0, 28 * S.research + (P.researchCount || 0) * 0.5);
    if (st.ok) {
      fresh.push(new Exec({ key: 'research:' + target, kind: 'research', prio: 155, why: `研究「${t.name}」：${t.desc}`, cat: '科技' }, [{ op: 'research', tech: target }]));
      return;
    }
    if (st.short) {
      goal(P, '研究「' + t.name + '」', prio, '科技', `${t.cost - st.short}/${t.cost}`);
      need(P, 'insight', t.cost, prio, `为研究「${t.name}」积累灵感`, '科技');
    }
  }

  tradeNeeds(W, P, fresh) {
    const g = this.g;
    // caravans: buy what we lack, sell what we have too much of
    for (const cv of W.caravans) {
      cv.offers.forEach((o, i) => {
        if (o.left <= 0 || !canPay(g, o.give)) return;
        const [gid, gn] = o.get[0];
        let value = 0;
        if (gid === 'coin') {
          // selling: only surplus
          const [sid, sn] = o.give[0];
          const surplus = availFree(P, sid) - sn;
          if (surplus >= 1 && (P.coinTarget || P.tradeWanted || CARDS[sid].kind === 'knowledge')) value = gn * 2;
        } else {
          const wanted = P.unmet.some((u) => u.item === gid) || (gid === 'survivor' && W.pop < (P.popTarget || 0)) || (gid === 'food_crate' && W.food < W.dailyNeed * 1.5);
          const coinCost = o.give.reduce((a, [id, n]) => a + (id === 'coin' ? n : 0), 0);
          const spare = g.coinValue() - (P.coinTarget || 0);
          if (wanted && spare >= coinCost) value = 30;
          if (P.tradeWanted && spare >= coinCost) value = Math.max(value, 20);
        }
        if (value > 0) fresh.push(new Exec({ key: 'trade:' + cv.id + ':' + i, kind: 'trade', prio: 80, why: `与商队交易：${o.give.map(([id, n]) => nm(id) + '×' + n).join('+')} → ${o.get.map(([id, n]) => nm(id) + '×' + n).join('+')}`, cat: '经济' },
          [{ op: 'trade', id: cv.id, idx: i }]));
      });
    }
    // coins needed: sell surplus at a market
    const market = W.structs.find((c) => CARDS[c.d].market);
    const coinTarget = P.coinTarget || 0;
    if (coinTarget && g.coinValue() < coinTarget) {
      if (!market) produce(P, 'market', 1, P.coinPrio || 60, '需要集市来换取铜贝', '经济');
      else {
        // the most valuable surplus item
        const cands = [];
        for (const [id, list] of this.freeGroups(W)) {
          const d = CARDS[id];
          const v = sellValue(g, d);
          if (v <= 0) continue;
          const keep = (P.claimed.get(id) || 0) + (['wood', 'stone', 'food'].includes(id) ? 2 : 0);
          const surplus = list.length - keep;
          if (surplus <= 0 || d.kind === 'folk') continue;
          if (d.tags.some((t) => ['boat', 'trainer', 'portable_light', 'pot', 'axe', 'pick', 'rod', 'hoe', 'livestock'].includes(t))) continue;
          if (P.unmet.some((u) => CARDS[u.item] && CARDS[u.item].name.includes(d.name))) continue; // keep what a wanted thing is probably made of
          if (d.food > 0 && W.food < W.dailyNeed * 2) continue;
          cands.push([id, v, surplus]);
        }
        cands.sort((a, b) => b[1] - a[1]);
        if (cands.length) {
          const [id, v, n] = cands[0];
          fresh.push(new Exec({ key: 'sell:' + id, kind: 'sell', prio: (P.coinPrio || 60) + 5, why: `在集市卖掉多余的${nm(id)}（${v} 铜贝/个）`, cat: '经济' },
            [{ op: 'dropRef', ref: id, n: Math.min(n, 6), target: market.id }], { lock: [market.id] }));
        }
        // and produce something sellable: cheap goods with good value per worker-second
        const goods = ['brick', 'cloth', 'leather', 'rope', 'plank', 'jerky', 'salt', 'honey', 'pottery'].filter((id) => CARDS[id] && sellValue(g, CARDS[id]) > 0 && itemCost(W, id, P.memo) < 80);
        goods.sort((a, b) => sellValue(g, CARDS[b]) / itemCost(W, b, P.memo) - sellValue(g, CARDS[a]) / itemCost(W, a, P.memo));
        if (goods.length) produce(P, goods[0], 2, (P.coinPrio || 60) - 5, '生产可出售的' + nm(goods[0]), '经济');
        else need(P, 'wood', 6, (P.coinPrio || 60) - 8, '砍木头去卖', '经济');
      }
    }
    if (P.tradeWanted && market && g.coinValue() >= 3) {
      const offers = g.marketOffers().filter((o) => canPay(g, o.give));
      if (offers.length) fresh.push(new Exec({ key: 'buy:' + offers[0].id, kind: 'trade', prio: P.tradeWanted, why: '在集市采购补给', cat: '经济' }, [{ op: 'buy', id: market.id, offer: offers[0].id }]));
    }
  }

  freeGroups(W) {
    const m = new Map();
    for (const c of W.cards) {
      if (!this.g.isFree(c) || this.locked.has(c.id)) continue;
      if (!m.has(c.d)) m.set(c.d, []);
      m.get(c.d).push(c);
    }
    return m;
  }

  stockNeeds(W, P) {
    const g = this.g, S = this.strat;
    const k = S.stock;
    need(P, 'wood', Math.round(4 * k + W.fires.length * 2), 14, '备些木材', '建设');
    need(P, 'stone', Math.round(3 * k), 11, '备些石块', '建设');
    if (g.techAllowed('shelter') || g.hasTech('weaving')) need(P, 'fiber', Math.round(2 * k), 9, '备些纤维', '建设');
    if (!W.freeN('flint') && !W.count('campfire') && !W.count('hearth')) need(P, 'flint', 1, 40, '生火需要燃石', '生存');
    // forests regrow only if someone plants them
    const trees = W.nodes.filter((c) => CARDS[c.d].tags.includes('tree')).length + W.count('young_tree');
    if (availFree(P, 'sapling') > 0 && trees < 4) addJob(P, { key: 'c:plant_sapling', kind: 'craft', r: 'plant_sapling', item: 'young_tree', n: 1, prio: 20 + (4 - trees) * 5, why: `树快砍光了（剩 ${trees} 棵），种下树苗`, cat: '建设' });
    // always have something to research toward
    if (this.techTarget) need(P, 'insight', 1, 10 * S.research, '积累灵感', '科技');
  }

  exploreNeeds(W, P) {
    const g = this.g, S = this.strat;
    for (const r of W.regions) {
      if (!(r.ch > 0)) continue;
      const rd = CARDS[r.d].region;
      const loot = r.loot || rd.loot;
      let score = 14 * S.explore + (P.exploreBoost || 0);
      if (P.unmet.some((u) => loot.some(([id]) => id === u.item))) score += 28;
      // running low on nodes? exploring brings new ones
      const nodesLeft = W.nodes.filter((c) => c.ch > 0 || c.ch < 0).length;
      if (nodesLeft < 4) score += 18;
      if (W.night && !rd.need) score *= 0.5;
      const danger = r.danger ?? rd.danger;
      if (danger > 0.3 && W.soldiers.length === 0) score *= 0.5;
      if (score < 10) continue;
      // a lone explorer is easy prey: where the ambushers are stronger than one person, go in a group
      const foes = r.foes || rd.foes || [];
      let strongFoes = false;
      if (foes.length && danger >= 0.1) {
        const lone = availableFighters(this, W, []).slice(0, 1).map((f) => f.p);
        const fp = Math.max(...foes.map(([f]) => defsPower([[f, 1]])));
        strongFoes = groupPower(g, lone, []).power < fp * 1.2;
      }
      const want = Math.min(3, (P.exploreBoost ? 2 : 1) + (strongFoes ? 1 : 0));
      addJob(P, { key: 'e:' + r.id, kind: 'explore', r: 'explore_' + r.d, site: r.id, prio: score, why: `探索${nm(r.d)}`, cat: '探索', want });
      // if the best team we could send would lose an ambush there, train an escort first
      if (foes.length && (r.danger ?? rd.danger) >= 0.05) {
        let foePow = 0;
        for (const [f] of foes) foePow = Math.max(foePow, defsPower([[f, 1]]));
        const ft = [...new Set(foes.flatMap(([f]) => CARDS[f].traits || []))];
        const best = availableFighters(this, W, ft).slice(0, 3).map((f) => f.p);
        if (groupPower(g, best, ft).power < foePow * 1.4 && score >= 30) {
          goal(P, '组建护卫队', score * 0.8, '战斗', nm(r.d));
          P.escort = { traits: ft, prio: score * 0.8 };
        }
      }
      if (rd.need === 'light' || rd.needLight) {
        if (!W.free('#portable_light').length && !W.people.some((p) => g.cardLight(p) > 0)) {
          if (g.hasTech('torches') || g.techAllowed('torches')) need(P, 'torch', 1, score, `探索${nm(r.d)}需要火把`, '探索');
        }
      }
      if (rd.need === 'boat' && !W.free('#boat').length) need(P, 'boat', 1, score, `前往${nm(r.d)}需要舟`, '探索');
    }
  }

  housekeeping(W, P, fresh) {
    const g = this.g;
    // open bundles, scrolls and tomes right away
    for (const c of W.openables) {
      if (this.locked.has(c.id)) continue;
      fresh.push(new Exec({ key: 'open:' + c.id, kind: 'open', prio: 100, why: `打开${nm(c.d)}`, cat: '整理' }, [{ op: 'open', id: c.id }], { lock: [c.id] }));
      break;
    }
    // automaton oil
    for (const a of W.people) {
      if (a.d !== 'automaton' || (a.fuel || 0) > 1) continue;
      if (availFree(P, 'oil') > 0) fresh.push(new Exec({ key: 'oil:' + a.id, kind: 'fuel', prio: 90, why: '给机关傀儡加油', cat: '生存' }, [{ op: 'dropRef', ref: 'oil', n: 1, target: a.id }]));
      else need(P, 'oil', 1, 50, '机关傀儡需要灯油', '生存');
    }
    // lit space is precious: piles and huts don't need light, work does
    if ((g.rules.dark || g.rules.shades) && W.nightLights.length && W.litSpots() < 3) {
      for (const st of W.stacks) {
        if (st.mob || st.battle || st.held || st.task) continue;
        const root = g.s.cards[st.cards[0]];
        const d = CARDS[root.d];
        if (d.fixed || this.locked.has(root.id) || st.cards.some((id) => this.locked.has(id))) continue;
        const idleThing = ['resource', 'food', 'knowledge', 'coin', 'tool', 'gear', 'misc', 'region'].includes(d.kind) || (d.kind === 'structure' && d.tags.includes('house'));
        if (!idleThing || st.cards.some((id) => CARDS[g.s.cards[id].d].tags.includes('person'))) continue;
        const cx = st.x + CARD_W / 2, cy = st.y + CARD_H / 2;
        const L = W.nightLights.find((l) => Math.hypot(l.x - cx, l.y - cy) < l.r - 20);
        if (!L) continue;
        // just outside the ring of light, away from the centre
        const a = Math.atan2(cy - L.y, cx - L.x) || 0;
        const spot = g.freeSpot(L.x + Math.cos(a) * (L.r + 90) - CARD_W / 2, L.y + Math.sin(a) * (L.r + 90) - CARD_H / 2, g.stackH(st), { exclude: st.id });
        if (W.nightLit(spot.x + CARD_W / 2, spot.y + CARD_H / 2)) continue;
        fresh.push(new Exec({ key: 'clear-light:' + root.id, kind: 'tidy', prio: 72, why: `把${d.name}挪出火光，给干活的人腾地方`, cat: '整理' },
          [{ op: 'move', id: root.id, x: spot.x, y: spot.y }], { lock: [root.id] }));
        break;
      }
    }
    // keep important structures and nodes inside the light (nights stop work in the dark)
    if ((g.rules.shades || W.phase < 0.6) && W.nightLights.length) {
      for (const st of W.stacks) {
        if (st.mob || st.battle || st.held || st.task) continue;
        const root = g.s.cards[st.cards[0]];
        const d = CARDS[root.d];
        if (d.fixed || this.locked.has(root.id)) continue;
        if (!(d.kind === 'node' || (d.kind === 'structure' && !d.light && !d.guard))) continue;
        if (d.node && d.node.charges > 0 && root.ch <= 0 && !d.node.perennial) continue;
        const cx = st.x + CARD_W / 2, cy = st.y + CARD_H / 2;
        if (W.nightLit(cx, cy, 10)) continue;
        if (Math.hypot(cx - W.anchor.x, cy - W.anchor.y) > 1500) continue;
        const spot = workSpot(this, g, W, g.stackH(st) + 20, st.id);
        if (!W.nightLights.some((L) => Math.hypot(L.x - spot.x - CARD_W / 2, L.y - spot.y - CARD_H / 2) < L.r - 25)) break;
        fresh.push(new Exec({ key: 'bring-in:' + root.id, kind: 'tidy', prio: 26, why: `把${d.name}搬进火光范围`, cat: '整理' },
          [{ op: 'move', id: root.id, x: spot.x, y: spot.y }], { lock: [root.id] }));
        break;
      }
    }
  }

  decideEvents(W, P, fresh) {
    const g = this.g;
    for (const ev of W.events) {
      const e = EVENTS[ev.ev];
      if (!e) continue;
      let best = -1, bv = -Infinity;
      e.choices.forEach((ch, i) => {
        if (!canPay(g, ch.give)) return;
        let v = 0;
        for (const [id, n] of ch.get) v += this.valueOf(W, id) * n;
        for (const [id, n] of ch.give) v -= (id === '#food' ? (W.food - n < W.dailyNeed ? 6 : 1.2) : this.valueOf(W, id)) * n;
        if (ch.fog) v -= ch.fog * (g.rules.fogRate || g.rules.shades ? 3 : 1);
        if (ch.effect === 'raid') v -= 30 * (1.2 - this.strat.caution) + 20;
        if (v > bv) { bv = v; best = i; }
      });
      if (best >= 0) {
        fresh.push(new Exec({ key: 'choose:' + ev.id, kind: 'choose', prio: 95, why: `【${e.name}】选择「${e.choices[best].label}」`, cat: '经济' }, [{ op: 'choose', id: ev.id, idx: best }], { lock: [ev.id] }));
      }
    }
  }

  valueOf(W, id) {
    const fed = W.food >= W.dailyNeed * 1.5 && (this.prodAvg === undefined || this.prodAvg >= W.appetite + 2);
    if (id === 'survivor') return W.pop < (this.P?.popTarget || 0) ? 30 : fed ? 14 : 3;
    if (id === 'child') return fed ? 6 : 1;
    if (id === 'child') return 8;
    if (id === 'scout') return 18;
    if (id === 'insight') return 8;
    if (id === 'coin') return 2;
    const d = CARDS[id];
    if (!d) return 1;
    return Math.max(1, (d.value || 1) * 2 + (d.food || 0));
  }

  // ----------------------------------------------------------------------------------- assignment
  assign(W, P) {
    const g = this.g;
    const jobs = [...P.jobs.values()].sort((a, b) => b.prio - a.prio);
    const idle = W.idle.filter((w) => !this.locked.has(w.id));
    const taken = new Set();
    // value of what each busy worker is doing now (for preemption)
    const busyVal = new Map();
    for (const b of W.busy) {
      const r = RECIPES[b.r];
      let key = null;
      if (r.kind === 'harvest') key = 'h:' + b.st.cards[0];
      else if (r.kind === 'explore') key = 'e:' + b.st.cards[0];
      else key = 'c:' + r.id;
      const j = P.jobs.get(key);
      let v = j ? j.prio : 6;
      // a task whose output is already counted on by some need keeps that need's priority
      for (const [id] of r.out) v = Math.max(v, (P.incPrio.get(id) || 0) - 4);
      if (r.kind === 'harvest' && CARDS[b.st.cards[0]] === undefined) void 0;
      if (r.kind === 'harvest' && RECIPES[r.id].out.some(([id]) => CARDS[id].food > 0)) v = Math.max(v, P.foodPrio || 0);
      busyVal.set(b.w.id, { v, b });
    }
    let started = 0;
    const reserved = new Map(P.execClaims || []);
    for (const job of jobs) {
      if (started >= 4) break;
      if ((this.fail.get(job.key) || 0) > g.s.t) continue;
      if (this.execs.some((e) => e.job.key === job.key && e.state === 'run')) continue;
      const plan = this.buildExec(W, P, job, idle, taken, reserved, busyVal);
      if (!plan) continue;
      if (this.start(plan)) started++;
    }
  }

  pickWorker(W, job, idle, taken, busyVal, skill, opts = {}) {
    const g = this.g;
    let best = null, bs = -Infinity;
    const site = job.site ? g.cardPos(g.s.cards[job.site] || { s: 0 }) : W.anchor;
    for (const w of idle) {
      if (taken.has(w.id) || this.locked.has(w.id)) continue;
      if (opts.adult && !CARDS[w.d].tags.includes('adult')) continue;
      const d = CARDS[w.d];
      let s = ((d.skills && d.skills[skill]) || 1) * 3;
      const p = g.cardPos(w);
      s -= Math.hypot(p.x - site.x, p.y - site.y) / 600;
      if (d.tags.includes('soldier') && job.cat !== '战斗') s -= 0.4;
      if (opts.light && g.cardLight(w) > 0) s += 4;
      if (w.st && w.st.hungry) s -= 0.5;
      if (s > bs) { bs = s; best = w; }
    }
    if (best) return best;
    // preempt someone doing something much less important
    let pre = null, pv = Infinity;
    for (const [id, { v, b }] of busyVal) {
      if (taken.has(id) || this.locked.has(id)) continue;
      if (opts.adult && !CARDS[b.w.d].tags.includes('adult')) continue;
      if (v + 22 > job.prio) continue;
      if (b.st.task && b.st.task.p > 0.75) continue;
      if (b.st.task && RECIPES[b.st.task.r].t >= 20 && b.st.task.p > 0.25 && job.prio < 128) continue;
      if (v < pv) { pv = v; pre = b.w; }
    }
    return pre;
  }

  buildExec(W, P, job, idle, taken, reserved, busyVal) {
    const g = this.g;
    if (this.curfew && (job.kind === 'harvest' || job.kind === 'explore' || job.kind === 'hunt' || job.kind === 'craft')) {
      // before a freezing dawn nobody leaves the warmth
      const site = job.site ? g.s.cards[job.site] : null;
      if (job.kind === 'explore' || job.kind === 'hunt') return null;
      if (site) {
        const p = g.cardPos(site);
        if (!g.lights.some((L) => L.warm && Math.hypot(L.x - p.x, L.y - p.y) < L.r - 20)) return null;
      }
    }
    const take = (w) => { taken.add(w.id); busyVal.delete(w.id); };
    const freeCount = (ref) => W.free(ref).filter((c) => !this.locked.has(c.id)).length - (reserved.get(ref) || 0);
    const reserve = (ref, n) => reserved.set(ref, (reserved.get(ref) || 0) + n);
    switch (job.kind) {
      case 'harvest': {
        const node = g.s.cards[job.site];
        if (!node) return null;
        const st = g.s.stacks[node.s];
        if (!st || st.battle || st.held) return null;
        const nd = CARDS[node.d].node;
        if (nd.charges > 0 && node.ch <= 0) return null;
        if (seasonMult(g, nd) <= 0) return null;
        const r = RECIPES[job.r];
        const cur = st.task && st.task.r === job.r ? st.task.m.workers.length + st.task.m.extra.length : 0;
        if (st.task && st.task.r !== job.r) return null;
        if (!st.task && st.cards.length > 1) {
          // something else lies on the node: clear it first
          const extra = st.cards.slice(1).map((id) => g.s.cards[id]);
          if (extra.some((c) => CARDS[c.d].tags.includes('person'))) return null;
        }
        const maxW = 1 + (nd.multi ?? r.multi ?? 1);
        const want = Math.min(job.want || 1, maxW) - cur;
        if (want <= 0) return null;
        const night = W.night || W.phase > 0.62;
        const lit = W.nightLit(st.x + CARD_W / 2, st.y + CARD_H / 2);
        const steps = [];
        if (!st.task) steps.push({ op: 'clearSite', keep: [] });
        const np = { x: st.x + CARD_W / 2, y: st.y + CARD_H / 2 };
        const nearBoss = W.threats.some((t) => t.d.mob?.beh === 'boss' && !(t.c.ai && t.c.ai.act) && Math.hypot(t.p.x - np.x, t.p.y - np.y) < 420);
        if (nearBoss) {
          if (CARDS[node.d].fixed || st.task) return null;
          steps.push({ op: 'relocate', force: true });
        } else if (night && !lit && !r.dark && !CARDS[node.d].fixed) steps.push({ op: 'relocate' });
        const w0 = this.pickWorker(W, job, idle, taken, busyVal, r.skill, { light: night && !lit });
        if (!w0) return null;
        take(w0);
        const lock = [node.id, w0.id];
        // tool
        if (r.aids.length && !st.cards.some((id) => r.aids.some((a) => CARDS[g.s.cards[id].d].tags.includes(a)))) {
          const tool = W.free('#' + r.aids[0]).find((c) => !this.locked.has(c.id) && !taken.has(c.id));
          if (tool) { steps.push({ op: 'bringCard', id: tool.id, optional: true }); lock.push(tool.id); taken.add(tool.id); }
          else if (nd.needTool && !(CARDS[w0.d].skills?.[nd.skill] >= 1.5)) return null;
        }
        // light for fixed nodes at night
        if (night && !lit && !r.dark && CARDS[node.d].fixed && g.cardLight(w0) <= 0) {
          const torch = W.free('#portable_light').find((c) => !this.locked.has(c.id) && !taken.has(c.id));
          if (torch) { steps.push({ op: 'bringCard', id: torch.id, optional: true }); lock.push(torch.id); taken.add(torch.id); }
          else if (g.rules.shades) return null;
        }
        steps.push({ op: 'bringCard', id: w0.id });
        const ws = [w0];
        for (let i = 1; i < want; i++) {
          const w = this.pickWorker(W, job, idle, taken, new Map(), r.skill);
          if (!w) break;
          take(w);
          ws.push(w);
          lock.push(w.id);
          steps.push({ op: 'bringCard', id: w.id, optional: true });
        }
        const ex = new Exec(job, steps, { site: node.id, lock, verify: job.r });
        ex.desc = `${ws.map((w) => w.name).join('、')}去${r.name}`;
        return ex;
      }
      case 'craft': {
        const r = RECIPES[job.r];
        if (!r || (r.tech && !g.hasTech(r.tech))) return null;
        const L = recipeLayout(r);
        // inputs available?
        const personInputs = [];
        for (const [ref, n] of L.inputs) {
          if (ref[0] !== '#' && CARDS[ref].kind === 'folk') { personInputs.push([ref, n]); continue; }
          if (ref === '#fuel' || ref === '#smeltfuel') {
            const opts = W.free(ref).filter((c) => !this.locked.has(c.id));
            if (opts.length < n) return null;
            continue;
          }
          if (freeCount(ref) < n) return null;
        }
        for (const [ref, n] of L.extraKeep) if (freeCount(ref) < n) return null;
        // site
        let siteCard = null;
        if (job.siteCard) siteCard = g.s.cards[job.siteCard];
        else if (L.siteRef) {
          const cands = W.cards.filter((c) => (L.siteRef[0] === '#' ? CARDS[c.d].tags.includes(L.siteRef.slice(1)) : c.d === L.siteRef) && !this.locked.has(c.id));
          for (const c of cands) {
            const st = g.s.stacks[c.s];
            if (!st || st.battle || st.held || st.cards[0] !== c.id) continue;
            if (st.task) {
              if (st.task.r === r.id) return null; // already running
              continue;
            }
            if (st.cards.slice(1).some((id) => CARDS[g.s.cards[id].d].tags.includes('person'))) continue;
            siteCard = c;
            break;
          }
          if (!siteCard) return null;
        }
        // people consumed by the recipe (training)
        const trainees = [];
        for (const [ref, n] of personInputs) {
          let cands = W.free(ref).filter((c) => !this.locked.has(c.id) && !taken.has(c.id));
          if (cands.length < n) {
            // pull someone off less important work
            const busy = W.people.filter((p) => p.d === ref && !this.locked.has(p.id) && !taken.has(p.id) && !cands.includes(p))
              .filter((p) => { const b = busyVal.get(p.id); const st = g.s.stacks[p.s]; return st && !st.battle && (!b || b.v + 15 < job.prio); });
            cands = cands.concat(busy);
          }
          if (cands.length < n) return null;
          for (let i = 0; i < n; i++) { trainees.push(cands[i]); taken.add(cands[i].id); busyVal.delete(cands[i].id); }
        }
        // workers (and adults for births)
        const ws = [];
        const adults = r.keep['#adult'] || 0;
        for (let i = 0; i < adults; i++) {
          const w = this.pickWorker(W, job, idle, taken, busyVal, 'none', { adult: true });
          if (!w) { for (const t of [...trainees, ...ws]) taken.delete(t.id); return null; }
          take(w);
          ws.push(w);
        }
        for (let i = 0; i < r.w; i++) {
          const w = this.pickWorker(W, job, idle, taken, busyVal, r.skill);
          if (!w) { for (const t of [...trainees, ...ws]) taken.delete(t.id); return null; }
          take(w);
          ws.push(w);
        }
        // urgent research gets a second pair of hands
        if (r.skill === 'research' && r.multi > 0 && job.prio >= 45) {
          const w = this.pickWorker(W, job, idle, taken, new Map(), r.skill);
          if (w) { take(w); ws.push(w); }
        }
        const steps = [];
        const lock = [...trainees.map((c) => c.id), ...ws.map((c) => c.id)];
        let total = 0;
        for (const [, n] of L.inputs) total += n;
        if (siteCard) {
          lock.push(siteCard.id);
          steps.push({ op: 'clearSite', keep: [] });
          const sst = g.s.stacks[siteCard.s];
          if ((W.night || W.phase > 0.62) && !r.dark && !W.nightLit(sst.x + CARD_W / 2, sst.y + CARD_H / 2)) steps.push({ op: 'relocate' });
          for (const [ref, n] of L.extraKeep) steps.push({ op: 'bring', ref, n });
          for (const [ref, n] of L.inputs) {
            if (personInputs.some(([p]) => p === ref)) continue;
            const k = siteCard.d === ref ? n - 1 : n;
            if (k > 0) steps.push({ op: 'bring', ref: ref, n: k });
          }
        } else {
          const items = L.inputs.filter(([ref]) => !personInputs.some(([p]) => p === ref));
          if (items.length) {
            const [first, n0] = items[0];
            steps.push({ op: 'makeSite', ref: first, n: n0, total });
            for (const [ref, n] of items.slice(1)) steps.push({ op: 'bring', ref, n });
          } else if (trainees.length) {
            // only people: lay the first one down as the site
            const spot = workSpot(this, g, W);
            steps.push({ op: 'move', id: trainees[0].id, x: spot.x, y: spot.y });
          }
          for (const [ref, n] of L.extraKeep) steps.push({ op: 'bring', ref, n });
        }
        for (const t of trainees) steps.push({ op: 'bringCard', id: t.id });
        for (const w of ws) steps.push({ op: 'bringCard', id: w.id });
        for (const [ref, n] of L.inputs) reserve(ref, n);
        const ex = new Exec(job, steps, { site: siteCard ? siteCard.id : trainees.length && !L.inputs.some(([ref]) => !personInputs.some(([p]) => p === ref)) ? trainees[0].id : null, lock, verify: r.id });
        if (r.id === 'birth') ex.desc = `${ws.map((w) => w.name).join('与')}在${nm(siteCard.d)}里生儿育女`;
        else ex.desc = ws.length ? `${ws.map((w) => w.name).join('、')}${r.name}` : r.name;
        return ex;
      }
      case 'explore': {
        const region = g.s.cards[job.site];
        if (!region) return null;
        const st = g.s.stacks[region.s];
        if (!st || st.battle) return null;
        const rd = CARDS[region.d].region;
        const cur = st.task ? st.task.m.workers.length + st.task.m.extra.length : 0;
        if (st.task && st.task.r !== job.r) return null;
        const want = Math.min(job.want || 1, 3) - cur;
        if (want <= 0) return null;
        const steps = [];
        const lock = [region.id];
        const needLight = rd.need === 'light' || rd.needLight || (g.rules.dark);
        const hasLight = st.cards.some((id) => g.cardLight(g.s.cards[id]) > 0);
        const w0 = this.pickWorker(W, job, idle, taken, busyVal, rd.need === 'boat' ? 'sail' : 'explore', { light: needLight });
        if (!w0) return null;
        if (!st.task) steps.push({ op: 'clearSite', keep: [] });
        if (needLight && !hasLight && g.cardLight(w0) <= 0) {
          const torch = W.free('#portable_light').find((c) => !this.locked.has(c.id) && !taken.has(c.id));
          if (!torch) return null;
          steps.push({ op: 'bringCard', id: torch.id });
          lock.push(torch.id);
          taken.add(torch.id);
        }
        if (rd.need === 'boat' && !st.cards.some((id) => CARDS[g.s.cards[id].d].tags.includes('boat'))) {
          const boat = W.free('#boat').find((c) => !this.locked.has(c.id) && !taken.has(c.id));
          if (!boat) return null;
          steps.push({ op: 'bringCard', id: boat.id });
          lock.push(boat.id);
          taken.add(boat.id);
        }
        const aid = W.free('#explore_aid').find((c) => !this.locked.has(c.id) && !taken.has(c.id));
        if (aid && !st.task) { steps.push({ op: 'bringCard', id: aid.id, optional: true }); lock.push(aid.id); taken.add(aid.id); }
        take(w0);
        lock.push(w0.id);
        steps.push({ op: 'bringCard', id: w0.id });
        const ws = [w0];
        // the region's known dangers: bring enough company to survive an ambush
        const foes = region.foes || rd.foes || [];
        const danger = region.danger ?? rd.danger;
        let foePow = 0;
        for (const [f] of foes) foePow = Math.max(foePow, defsPower([[f, 1]]));
        const teamPow = () => groupPower(g, ws, [...new Set(foes.flatMap(([f]) => CARDS[f].traits || []))]).power;
        const safe = () => danger < 0.05 || teamPow() >= foePow * (1.2 + this.strat.caution) * (job.prio >= 60 ? 0.75 : 1);
        for (let i = 1; i < 3 && (i < want || !safe()); i++) {
          const w = this.pickWorker(W, { ...job, cat: '战斗' }, idle, taken, new Map(), 'explore');
          if (!w) break;
          take(w);
          lock.push(w.id);
          ws.push(w);
          steps.push({ op: 'bringCard', id: w.id, optional: true });
        }
        if (!safe() && (danger * foePow > 8 || (danger >= 0.05 && teamPow() < foePow * 1.1 && job.prio < 100))) {
          for (const w of ws) { taken.delete(w.id); }
          return null;
        }
        const ex = new Exec(job, steps, { site: region.id, lock, verify: job.r });
        ex.desc = `${ws.map((w) => w.name).join('、')}出发探索${nm(region.d)}`;
        return ex;
      }
      case 'hunt': {
        const beast = g.s.cards[job.target];
        if (!beast) return null;
        const bst = g.s.stacks[beast.s];
        if (!bst || bst.battle) return null;
        const d = CARDS[beast.d];
        const team = [];
        let pw = 0;
        const foe = enemyPower(g, [beast]).power;
        const margin = (d.atk || 0) >= 2 ? 2.4 + this.strat.caution : 1.6;
        for (const f of availableFighters(this, W, d.traits || [])) {
          if (taken.has(f.p.id)) continue;
          const st = g.s.stacks[f.p.s];
          if (st.task && (busyVal.get(f.p.id)?.v || 0) + 10 > job.prio) continue;
          team.push(f.p);
          pw = groupPower(g, team, d.traits || [], d.def || 0).power;
          if (pw > foe * (margin + 0.4)) break;
        }
        if (!team.length || pw < foe * margin) return null;
        for (const p of team) take(p);
        const ex = new Exec(job, team.map((p) => ({ op: 'drop', id: p.id, target: beast.id, optional: true })), { lock: team.map((p) => p.id) });
        ex.desc = `${team.map((p) => p.name).join('、')}去捕猎${d.name}`;
        return ex;
      }
      case 'deliver': {
        if (!job.target || !g.s.cards[job.target]) return null;
        if (freeCount(job.item) <= 0) return null;
        const n = Math.min(job.n || 1, freeCount(job.item));
        reserve(job.item, n);
        return new Exec(job, [{ op: 'dropRef', ref: job.item, n, target: job.target }], { lock: [job.target] });
      }
      case 'trade': {
        return new Exec(job, [{ op: 'trade', id: job.caravan, idx: job.idx }]);
      }
      default:
        return null;
    }
  }

  // ----------------------------------------------------------------------------------- curiosity
  /** recipes read about in scrolls: try them for real once the ingredients are at hand */
  hintJobs(W, P) {
    const g = this.g;
    const boost = P.experimentBoost || 0;
    const objUnmet = P.unmet.some((u) => u.prio >= 55 && CARDS[u.item] && !PRODUCERS_KNOWN(g, this.mem, u.item));
    if (objUnmet || boost > 30) {
      // things to bind, wrap and mount with — most hidden crafts need one of them
      for (const id of ['rope', 'fiber', 'wood', 'leather']) if (!W.freeN(id) && itemCost(W, id, P.memo) < 60) { need(P, id, 1, 34, '备些材料做实验', '实验'); break; }
    }
    for (const rid of Object.keys(g.s.hints)) {
      if (g.s.disc.includes(rid)) continue;
      const r = RECIPES[rid];
      if (r.tech && !g.hasTech(r.tech)) continue;
      addJob(P, { key: 'c:' + rid, kind: 'craft', r: rid, item: r.out[0]?.[0], n: 1, prio: 24 + boost + this.strat.curiosity * 20, why: `按残卷的线索尝试「${r.name}」`, cat: '实验' });
    }
  }

  /** in cold lands, everyone must sleep by a fire (or wear fur) when dawn comes */
  coldPrep(W, P, fresh) {
    const g = this.g;
    const winter = g.rules.seasons && W.season === 3;
    const cold = g.rules.cold === 'always' || (g.rules.cold && (winter || (g.rules.seasons && W.daysToWinter <= 1)));
    if (!cold) return;
    const unwarm = W.people.filter((p) => !CARDS[p.d].tags.includes('construct') && !g.isWarm(p));
    if (unwarm.length) {
      goal(P, '御寒', 70 + unwarm.length * 4, '生存', `${W.people.length - unwarm.length}/${W.people.length} 人暖和`);
      if (g.techAllowed('husbandry')) need(P, 'fur_cloak', Math.min(2, unwarm.length), 58, '缝毛皮斗篷御寒', '生存');
      if (g.techAllowed('masonry') && !W.count('hearth') && W.mainFire && W.mainFire.d === 'campfire') produce(P, 'hearth', 1, 52, '把篝火砌成火塘（暖和又省柴）', '生存');
    }
    if (W.phase < 0.8) return;
    this.curfew = true;
    // nightfall before a freezing dawn: bring everyone into the warmth of a fire
    const warmLights = g.lights.filter((L) => L.warm);
    if (!warmLights.length) return;
    let n = 0;
    for (const p of unwarm) {
      if (n >= 3) break;
      const st = g.s.stacks[p.s];
      if (!st || st.battle || this.locked.has(p.id)) continue;
      // huddle with someone already warm (or at the fire itself if nothing is cooking there)
      const host = W.people.find((q) => q !== p && g.isWarm(q) && !this.locked.has(q.id) && (() => {
        const qs = g.s.stacks[q.s];
        return qs && !qs.battle && qs.cards.length < 5 && qs.cards[qs.cards.length - 1] === q.id && qs.cards.every((id) => CARDS[g.s.cards[id].d].tags.includes('person') || CARDS[g.s.cards[id].d].tags.includes('fire') || CARDS[g.s.cards[id].d].tags.includes('house'));
      })());
      if (host && st.cards[st.cards.length - 1] === p.id) {
        fresh.push(new Exec({ key: 'warm:' + p.id, kind: 'shelter', prio: 160, why: `${p.name}会在黎明冻伤，去和${host.name}挤在火边过夜`, cat: '生存' },
          [{ op: 'drop', id: p.id, target: host.id }], { lock: [p.id, host.id] }));
        n++;
        continue;
      }
      const root = g.s.cards[st.cards[0]];
      const movable = !CARDS[root.d].fixed && st.cards.every((id) => !this.locked.has(id));
      const L = warmLights.sort((a, b) => Math.hypot(a.x - st.x, a.y - st.y) - Math.hypot(b.x - st.x, b.y - st.y))[0];
      const a = (p.id * 2.399 + W.day) % (Math.PI * 2);
      const spot = g.freeSpot(L.x + Math.cos(a) * L.r * 0.55 - CARD_W / 2, L.y + Math.sin(a) * L.r * 0.55 - CARD_H / 2, g.stackH(st), { exclude: st.id });
      if (Math.hypot(spot.x + CARD_W / 2 - L.x, spot.y + CARD_H / 2 - L.y) > L.r - 10) continue;
      const id = movable ? root.id : p.id;
      fresh.push(new Exec({ key: 'warm:' + p.id, kind: 'shelter', prio: 160, why: `${p.name}会在黎明冻伤，${movable && root.id !== p.id ? '把活计搬到' : '回到'}火边过夜`, cat: '生存' },
        [{ op: 'move', id, x: spot.x, y: spot.y }], { lock: [id] }));
      n++;
    }
  }

  /** stacks that stopped because it got dark: carry them into the light (or bring a torch) */
  darkFix(W, fresh) {
    const g = this.g;
    if (!W.night && W.phase < 0.66) return;
    for (const st of W.taskStacks) {
      if (st.task.block !== '太暗了' && !(W.phase > 0.66 && !W.nightLit(st.x + CARD_W / 2, st.y + CARD_H / 2) && !RECIPES[st.task.r].dark)) continue;
      const root = g.s.cards[st.cards[0]];
      if (this.locked.has(root.id)) continue;
      const d = CARDS[root.d];
      if (!d.fixed) {
        const spot = workSpot(this, g, W, g.stackH(st) + 20, st.id);
        if (!W.nightLights.some((L) => Math.hypot(L.x - spot.x - CARD_W / 2, L.y - spot.y - CARD_H / 2) < L.r - 25)) continue;
        fresh.push(new Exec({ key: 'light:' + root.id, kind: 'tidy', prio: 88, why: `天黑了，把${RECIPES[st.task.r].name}挪进火光里`, cat: '生存' },
          [{ op: 'move', id: root.id, x: spot.x, y: spot.y }], { lock: [root.id] }));
        return;
      }
      const torch = W.free('#portable_light').find((c) => !this.locked.has(c.id));
      if (torch) {
        fresh.push(new Exec({ key: 'torch:' + root.id, kind: 'tidy', prio: 86, why: `给${d.name}边的人送去火把`, cat: '生存' },
          [{ op: 'drop', id: torch.id, target: g.s.cards[st.cards[st.cards.length - 1]].id }], { lock: [torch.id] }));
        return;
      }
    }
  }

  experiment(W, P) {
    const g = this.g, S = this.strat;
    const objUnmet = P.unmet.some((u) => u.prio >= 55 && CARDS[u.item] && !(PRODUCERS_KNOWN(g, this.mem, u.item)));
    const boost = (P.experimentBoost || 0) + (objUnmet ? 60 : 0);

    const rate = S.curiosity + boost / 50;
    if (rate <= 0.02) return;
    const gap = 40 / rate;
    if (g.s.t - this.lastExperiment < gap) return;
    const worker = W.idle.find((w) => !this.locked.has(w.id));
    // blind combination: two kinds of free cards (+ a worker), never tried before
    const kinds = [...new Set(W.cards.filter((c) => {
      if (!g.isFree(c) || this.locked.has(c.id)) return false;
      const d = CARDS[c.d];
      if ((P.claimed.get(c.d) || 0) >= W.freeN(c.d)) return false; // everything of it is spoken for
      if (['resource', 'food', 'knowledge', 'misc'].includes(d.kind)) return d.id !== 'insight' && d.id !== 'coin';
      return (d.kind === 'tool' || d.kind === 'gear') && d.rarity !== 'common' && !d.tags.includes('trainer');
    }).map((c) => c.d))];
    if (kinds.length < 2) return;
    const rng = g.rng; // the AI's own choices don't need a separate stream; it doesn't affect fairness
    void rng;
    // wanted items nobody knows how to make: guess ingredients from their names (珍珠 → 珍珠项链)
    const wanted = P.unmet.map((u) => u.item).filter((id) => CARDS[id]);
    const related = (id) => {
      const n1 = CARDS[id].name;
      let best = 0;
      for (const w of wanted) {
        const n2 = CARDS[w].name;
        if (n2.includes(n1) || n1.includes(n2)) best = Math.max(best, 12);
        else {
          let shared = 0;
          for (const ch of n1) if (n2.includes(ch)) shared++;
          if (shared >= 1) best = Math.max(best, shared * 2);
        }
      }
      return best;
    };
    const interesting = (id) => {
      const d = CARDS[id];
      return (d.rarity !== 'common' ? 3 : 1) + related(id) + (['wolf_pelt', 'heartwood', 'croc_tooth', 'molten_core', 'frost_heart', 'ember_shard', 'shadow_dust', 'obsidian', 'star_metal', 'pearl', 'feather', 'bone', 'resin', 'wax', 'ice', 'driftwood', 'seaweed', 'relic', 'ivory', 'crystal'].includes(id) ? 3 : 0);
    };
    const cands = [];
    for (let i = 0; i < kinds.length; i++) {
      for (let j = 0; j < kinds.length; j++) {
        if (i === j) continue;
        for (const na of [1, 2, 3]) {
          const a = kinds[i], b = kinds[j];
          if (a > b && na === 1) continue;
          if (W.freeN(a) < na || W.freeN(b) < 1) continue;
          for (const withW of worker ? [true, false] : [false]) {
            const key = `${a}×${na}+${b}${withW ? '+劳力' : ''}`;
            if (this.mem.tried.has(key)) continue;
            // skip combos that a known recipe already explains
            const fake = [];
            let fid = -1;
            for (let k = 0; k < na; k++) fake.push({ id: fid--, d: a });
            fake.push({ id: fid--, d: b });
            if (withW) fake.push({ id: fid--, d: 'survivor' });
            let known = false;
            for (const r of Object.values(RECIPES)) {
              if (!isKnown(g, this.mem, r.id)) continue;
              if (tryRecipe(r, fake, { isActive: () => true })) { known = true; break; }
            }
            if (known) { this.mem.tried.add(key); continue; }
            cands.push({ a, na, b, withW, key, s: interesting(a) + interesting(b) + (withW ? 1 : 0) - na * 0.3 + ((a.charCodeAt(0) + b.charCodeAt(1) + this.stats.thinks) % 7) / 7 });
          }
        }
      }
    }
    if (!cands.length) return;
    cands.sort((x, y) => y.s - x.s);
    const c = cands[0];
    const steps = [{ op: 'makeSite', ref: c.a, n: c.na, total: c.na + 2 }, { op: 'bring', ref: c.b, n: 1 }];
    const lock = [];
    if (c.withW) { steps.push({ op: 'bringCard', id: worker.id }); lock.push(worker.id); }
    const label = `${nm(c.a)}×${c.na} + ${nm(c.b)}${c.withW ? ' + 劳力' : ''}`;
    const ex = new Exec({ key: 'exp:' + c.key, kind: 'experiment', prio: 8 + boost, why: `做个实验：${label}`, cat: '实验', combo: c.key, label }, steps, { lock, verify: '__experiment__' });
    ex.verify = null;
    ex.steps.push({ op: 'wait' }, { op: 'note' }, { op: 'scatter' });
    ex.onNote = () => { this.onDone(ex); ex.noted = true; };
    this.lastExperiment = g.s.t;
    this.stats.experiments++;
    this.start(ex);
  }

  /** break up mixed idle stacks so piles stay tidy (also cleans up after experiments) */
  /** once a day the AI writes a short stock-take into its log: where things stand and what matters most */
  morningReport(W) {
    const g = this.g;
    if (this.reportDay === g.s.day) return;
    this.reportDay = g.s.day;
    const days = W.dailyNeed > 0 ? W.food / W.dailyNeed : 99;
    const parts = [`人口 ${W.people.length}`, `粮食够 ${days >= 9 ? '9+' : days.toFixed(1)} 天`];
    if (W.mainFire) parts.push(`${CARDS[W.mainFire.d].name}燃料 ${Math.round(W.mainFire.fuel || 0)}`);
    if (g.rules.seasons !== false && W.daysToWinter < 6) parts.push(W.daysToWinter <= 0 ? '正值冬天' : `${W.daysToWinter} 天后入冬`);
    if (W.threats.length) parts.push(`${W.threats.length} 个威胁`);
    if (g.s.fog > 0) parts.push(`灰雾 ${Math.round(g.s.fog)}%`);
    const focus = this.goals.slice(0, 3).map((x) => x.name).join('、');
    this.note('盘点', `第 ${g.s.day} 天：${parts.join('，')}。${focus ? '今天的重点：' + focus + '。' : ''}`, true);
  }

  tidy(W) {
    const g = this.g;
    for (const st of W.stacks) {
      if (st.task || st.battle || st.mob || st.held || st.cards.length < 2) continue;
      if (st.cards.some((id) => this.locked.has(id))) continue;
      const defs = st.cards.map((id) => g.s.cards[id].d);
      if (defs.every((d) => d === defs[0])) continue;
      const root = CARDS[defs[0]];
      // find the lowest card that differs from the one below it
      let i = 1;
      while (i < defs.length && defs[i] === defs[i - 1] && root.kind !== 'structure' && root.kind !== 'node') i++;
      if (i >= defs.length) continue;
      const top = g.s.cards[st.cards[i]];
      // prefer dropping onto an existing pile of the same thing
      const pile = W.stacks.find((s) => s !== st && !s.task && !s.mob && !s.battle && s.cards.every((id) => g.s.cards[id].d === top.d) && s.cards.length < 25);
      const steps = pile && topRun(g, st, top.d) === st.cards.length - i ? [{ op: 'drop', id: top.id, target: pile.cards[0] }]
        : [{ op: 'move', id: top.id, ...g.freeSpot(st.x + CARD_W + 30, st.y, CARD_H + 30 * (defs.length - i), { exclude: st.id }) }];
      this.start(new Exec({ key: 'tidy:' + st.id, kind: 'tidy', prio: 2, why: '', cat: '整理' }, steps, { lock: [top.id] }));
      return;
    }
    // merge scattered piles of the same material: a tidy camp is easier to read (and to plan with)
    const piles = new Map();
    for (const st of W.stacks) {
      if (st.task || st.battle || st.mob || st.held) continue;
      const d0 = g.s.cards[st.cards[0]].d;
      if (!['resource', 'food', 'knowledge', 'coin'].includes(CARDS[d0].kind)) continue;
      if (st.cards.some((id) => g.s.cards[id].d !== d0 || this.locked.has(id))) continue;
      if (!piles.has(d0)) piles.set(d0, []);
      piles.get(d0).push(st);
    }
    for (const list of piles.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => b.cards.length - a.cards.length);
      const big = list[0], small = list[list.length - 1];
      if (big.cards.length + small.cards.length > 30) continue;
      if (Math.hypot(big.x - small.x, big.y - small.y) > 900) continue;
      this.start(new Exec({ key: 'merge:' + small.id, kind: 'tidy', prio: 1, why: '', cat: '整理' }, [{ op: 'drop', id: small.cards[0], target: big.cards[0], whole: true }], { lock: small.cards.slice() }));
      return;
    }
  }
}
