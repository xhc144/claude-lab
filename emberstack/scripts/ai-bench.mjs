#!/usr/bin/env node
// Benchmark the AI across levels, strategies and seeds (headless, as fast as the CPU allows).
//   node scripts/ai-bench.mjs [--levels 1-1,1-2] [--strategies balanced,rush] [--seeds 3] [--quick]
// --quick runs every level once with the default strategy and fails (exit 1) if any level is lost.
import { Game } from '../src/sim/game.js';
import { Brain } from '../src/ai/brain.js';
import { LEVELS } from '../src/data/levels.js';
import { STRATEGY_IDS } from '../src/ai/strategies.js';
import { DT } from '../src/sim/constants.js';
import { stars } from '../src/sim/objectives.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const quick = args.includes('--quick');
const levels = (opt('levels', '') || Object.keys(LEVELS).join(',')).split(',').filter((id) => LEVELS[id]);
const strategies = quick ? ['balanced'] : opt('strategies', STRATEGY_IDS.join(',')).split(',');
const seeds = Number(opt('seeds', quick ? 1 : 3));

function run(id, strategy, seed) {
  const level = LEVELS[id];
  const g = new Game(level, { seed });
  const brain = new Brain(g, { strategy });
  const limit = (level.lose || []).find((l) => l.type === 'time')?.days || 40;
  while (!g.s.result && g.s.day <= limit + 1) {
    brain.update(DT);
    g.step(DT);
    g.events.length = 0;
  }
  return { result: g.s.result || 'timeout', day: g.s.day, stars: stars(g), deaths: g.s.stats.deaths, reason: g.s.reason };
}

const rows = [];
let lost = 0;
const t0 = Date.now();
for (const id of levels) {
  const line = [id.padEnd(5), LEVELS[id].name.padEnd(8)];
  for (const st of strategies) {
    let wins = 0, days = 0, starsSum = 0, deaths = 0;
    const fails = [];
    for (let s = 1; s <= seeds; s++) {
      const r = run(id, st, s * 7919 + 11);
      if (r.result === 'win') { wins++; days += r.day; starsSum += r.stars; }
      else fails.push(`${r.result}@${r.day}:${r.reason}`);
      deaths += r.deaths;
    }
    if (wins < seeds) lost++;
    line.push(`${st}:${wins}/${seeds}${wins ? ` d${(days / wins).toFixed(1)} ★${(starsSum / wins).toFixed(1)}` : ''} †${deaths}`);
    if (fails.length && !quick) line.push('[' + fails.join('; ') + ']');
    if (fails.length && quick) line.push('[' + fails.join('; ') + ']');
  }
  rows.push(line.join('  '));
  console.log(line.join('  '));
}
console.log(`\n${levels.length} levels × ${strategies.length} strategies × ${seeds} seeds in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (quick && lost) { console.error(`✗ ${lost} level(s) not won`); process.exit(1); }
