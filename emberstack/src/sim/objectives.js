// Level goals, losing conditions and star ratings. Each objective reports {cur, need} so the HUD,
// the result screen and the AI all read the same numbers.

import { CARDS } from '../data/cards.js';
import { TECHS } from '../data/techs.js';

const nm = (id) => CARDS[id]?.name || id;

export function objectiveText(o) {
  switch (o.type) {
    case 'build': return o.text || `${o.lit ? '点亮' : '建造'}${nm(o.card)}${o.n > 1 ? ' ×' + o.n : ''}`;
    case 'have': return o.text || `拥有${nm(o.card)} ×${o.n}`;
    case 'coins': return o.text || `积攒 ${o.n} 铜贝`;
    case 'food': return o.text || `储备 ${o.n} 份食物`;
    case 'pop': return o.text || `人口达到 ${o.n}`;
    case 'survive': return o.text || `坚持 ${o.days} 天`;
    case 'research': return o.text || (o.tech ? `研究「${TECHS[o.tech].name}」` : `研究 ${o.n} 项科技`);
    case 'kill': return o.text || `击败${nm(o.card)}${o.n > 1 ? ' ×' + o.n : ''}`;
    case 'explore': return o.text || `探索 ${o.n} 次`;
    case 'deliver': return o.text || `向祭坛献上${nm(o.card)} ×${o.n}`;
    case 'discover': return o.text || `发现 ${o.n} 个隐藏配方`;
    case 'fog': return o.text || `灰雾降到 ${o.below}% 以下`;
    case 'made': return o.text || `制作${nm(o.card)} ×${o.n}`;
    case 'trade': return o.text || `完成 ${o.n} 笔交易`;
    case 'earn': return o.text || `通过集市赚取 ${o.n} 铜贝`;
    case 'soldiers': return o.text || `拥有 ${o.n} 名士兵`;
    case 'lights': return o.text || `点亮 ${o.n} 处光源`;
    case 'festival': return o.text || `举办 ${o.n} 次庆典`;
    default: return o.text || o.type;
  }
}

export function objectiveProgress(g, o) {
  const s = g.s;
  switch (o.type) {
    case 'build': {
      let n = 0;
      for (const c of Object.values(s.cards)) if (c.d === o.card && (!o.lit || g.cardLight(c) > 0)) n++;
      return { cur: n, need: o.n || 1 };
    }
    case 'have': return { cur: g.countDef(o.card), need: o.n };
    case 'coins': return { cur: g.coinValue(), need: o.n };
    case 'food': return { cur: g.totalFood(), need: o.n };
    case 'pop': return { cur: g.population(), need: o.n };
    case 'survive': return { cur: Math.min(o.days, s.day - 1), need: o.days };
    case 'research':
      if (o.tech) return { cur: g.hasTech(o.tech) ? 1 : 0, need: 1 };
      return { cur: s.stats.researched, need: o.n };
    case 'kill': return { cur: s.stats.killsBy[o.card] || 0, need: o.n || 1 };
    case 'explore': return { cur: s.stats.explored, need: o.n };
    case 'deliver': {
      let n = 0;
      for (const c of Object.values(s.cards)) if (c.del) n += c.del[o.card] || 0;
      return { cur: n, need: o.n };
    }
    case 'discover': return { cur: s.disc.length, need: o.n };
    case 'fog': return { cur: s.fog <= o.below ? 1 : 0, need: 1, val: s.fog };
    case 'made': return { cur: s.stats.made[o.card] || 0, need: o.n };
    case 'trade': return { cur: s.stats.trades, need: o.n };
    case 'earn': return { cur: s.stats.coinsEarned, need: o.n };
    case 'soldiers': return { cur: g.people().filter((c) => CARDS[c.d].tags.includes('soldier')).length, need: o.n };
    case 'lights': return { cur: g.lights.filter((L) => L.struct).length, need: o.n };
    case 'festival': return { cur: s.stats.festivals, need: o.n };
    default: return { cur: 0, need: 1 };
  }
}

export function checkObjectives(g) {
  if (g.s.result) return;
  let all = true;
  for (const o of g.s.objectives) {
    const p = objectiveProgress(g, o);
    o.cur = p.cur;
    o.need = p.need;
    const done = p.cur >= p.need;
    if (done && !o.done) {
      o.done = true;
      g.emit({ type: 'objective', text: objectiveText(o) });
      g.msg(`目标达成：${objectiveText(o)}`, 'goal');
    }
    // "sticky" objectives stay done; others (like fog) must hold at the moment of victory
    if (!done && !o.sticky) o.done = false;
    if (!o.done) all = false;
  }
  // losing
  if (g.population() === 0 && !g.people().some((c) => CARDS[c.d].tags.includes('worker'))) {
    g.finish('lose', '营地里已经没有人了。');
    return;
  }
  for (const l of g.level.lose || []) {
    if (l.type === 'fog' && g.s.fog >= 100) { g.finish('lose', '灰雾吞没了营地。'); return; }
    if (l.type === 'time' && g.s.day > l.days) { g.finish('lose', `没能在 ${l.days} 天内完成目标。`); return; }
    if (l.type === 'lost' && !Object.values(g.s.cards).some((c) => c.d === l.card || (l.alt && c.d === l.alt))) { g.finish('lose', `${nm(l.card)}被摧毁了。`); return; }
    if (l.type === 'deaths' && g.s.stats.deaths >= l.n) { g.finish('lose', `失去了 ${l.n} 位同伴。`); return; }
  }
  if (all && g.s.objectives.length) g.finish('win', '所有目标都已达成。');
}

export function starText(c) {
  switch (c.type) {
    case 'days': return `${c.lte} 天内完成`;
    case 'nodeath': return '无人牺牲';
    case 'pop': return `人口至少 ${c.n}`;
    case 'fog': return `灰雾不超过 ${c.below}%`;
    case 'discover': return `发现 ${c.n} 个隐藏配方`;
    case 'kills': return `击败 ${c.n} 个敌人`;
    case 'research': return `研究 ${c.n} 项科技`;
    default: return c.text || c.type;
  }
}

export function starMet(g, c) {
  const s = g.s;
  switch (c.type) {
    case 'days': return s.day <= c.lte;
    case 'nodeath': return s.stats.deaths === 0;
    case 'pop': return g.population() >= c.n;
    case 'fog': return s.stats.maxFog <= c.below;
    case 'discover': return s.disc.length >= c.n;
    case 'kills': return s.stats.kills >= c.n;
    case 'research': return s.stats.researched >= c.n;
    default: return false;
  }
}

export function stars(g) {
  if (g.s.result !== 'win') return 0;
  let n = 1;
  for (const c of g.level.stars || []) if (starMet(g, c)) n++;
  return n;
}
