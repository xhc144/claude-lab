#!/usr/bin/env node
// Run the AI headlessly on one level and print what happened.
//   node scripts/ai-run.mjs 1-1 [--strategy balanced] [--seed 1] [--days 30] [--log]
import { Game } from '../src/sim/game.js';
import { Brain } from '../src/ai/brain.js';
import { LEVELS } from '../src/data/levels.js';
import { DT } from '../src/sim/constants.js';
import { stars } from '../src/sim/objectives.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const id = args[0] || '1-1';
const level = LEVELS[id];
const g = new Game(level, { seed: Number(opt('seed', 1)) });
const brain = new Brain(g, { strategy: opt('strategy', 'balanced') });
const maxDays = Number(opt('days', 30));
const showLog = args.includes('--log');
brain.onLog = showLog ? (e) => console.log(`  [D${e.day} ${(g.phase()*24).toFixed(0).padStart(2)}h] ${e.cat} · ${e.text}`) : null;
const t0 = Date.now();
let lastDay = 0;
while (!g.s.result && g.s.day <= maxDays) {
  brain.update(DT);
  g.step(DT);
  const ev = g.drain();
  if (showLog) for (const e of ev) if (e.type === 'msg' && ['goal','death','danger','boss','discover','tech','win'].includes(e.kind)) console.log(`  >>> D${e.day} ${e.text}`);
  if (g.s.day !== lastDay) {
    lastDay = g.s.day;
    if (args.includes('--daily')) {
      const cnt = {}; for (const c of Object.values(g.s.cards)) cnt[c.d] = (cnt[c.d]||0)+1;
      console.log(`day ${g.s.day} pop ${g.population()} food ${g.totalFood()} fog ${Math.round(g.s.fog)} focus=${brain.focus} tech=${g.s.tech.join(',')}`);
      console.log('   ', JSON.stringify(cnt));
    }
  }
}
const cnt = {}; for (const c of Object.values(g.s.cards)) cnt[c.d] = (cnt[c.d]||0)+1;
console.log(`\n${id} ${level.name}: ${g.s.result || 'timeout'} day ${g.s.day} ${g.s.reason} stars=${stars(g)} deaths=${g.s.stats.deaths} actions=${brain.stats.actions} ${Date.now()-t0}ms`);
console.log('objectives', g.s.objectives.map(o => `${o.type}:${o.cur}/${o.need}`).join(' '));
console.log('tech', g.s.tech.join(','));
console.log('cards', JSON.stringify(cnt));
