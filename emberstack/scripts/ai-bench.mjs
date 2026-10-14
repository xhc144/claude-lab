#!/usr/bin/env node
// Benchmark the AI across levels, strategies and seeds (headless, in parallel worker threads).
//   node scripts/ai-bench.mjs [--levels 1-1,1-2] [--strategies balanced,rush] [--seeds 3] [--quick]
//   node scripts/ai-bench.mjs --modes [--diffs 1,3,5] [--biomes valley,forest]   (expeditions, endless, challenges)
//   --progress prints every finished run, --objs adds objective progress to failures
// --quick runs every level once with the default strategy and exits 1 if any level is lost.
// Level ids may also be specs: exp:<biome>:<diff>, endless:<biome>, ch:<challenge id>.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

async function runOne({ id, strategy, seed }) {
  const { Game } = await import('../src/sim/game.js');
  const { Brain } = await import('../src/ai/brain.js');
  const { LEVELS } = await import('../src/data/levels.js');
  const { DT } = await import('../src/sim/constants.js');
  const { stars } = await import('../src/sim/objectives.js');
  const level = await resolveLevel(id, seed);
  const g = new Game(level, { seed: level.seed ?? seed });
  const brain = new Brain(g, { strategy });
  const limit = (level.lose || []).find((l) => l.type === 'time')?.days || (level.mode === 'endless' ? 60 : 40);
  while (!g.s.result && g.s.day <= limit + 1) {
    brain.update(DT);
    g.step(DT);
    g.events.length = 0;
  }
  return { id, strategy, seed, result: g.s.result || 'timeout', day: g.s.day, stars: stars(g), deaths: g.s.stats.deaths, reason: g.s.reason, disc: g.s.disc.length, objs: g.s.objectives.map((o) => `${o.type}${o.card ? ':' + o.card : ''}${o.tech ? ':' + o.tech : ''} ${o.cur}/${o.need}`).join(', '), pop: g.population() };
}

async function resolveLevel(id, seed) {
  const { LEVELS } = await import('../src/data/levels.js');
  if (LEVELS[id]) return LEVELS[id];
  const { makeExpedition, makeChallenge } = await import('../src/modes/expedition.js');
  const [kind, a, b] = id.split(':');
  if (kind === 'exp') return makeExpedition({ mode: 'expedition', biome: a, diff: Number(b), seed });
  if (kind === 'endless') return makeExpedition({ mode: 'endless', biome: a, diff: 2, seed });
  if (kind === 'ch') return makeChallenge(a);
  throw new Error('unknown level ' + id);
}

if (!isMainThread) {
  parentPort.on('message', async (job) => {
    try { parentPort.postMessage(await runOne(job)); }
    catch (e) { parentPort.postMessage({ ...job, result: 'error', reason: e.stack, day: 0, stars: 0, deaths: 0 }); }
  });
} else {
  const { LEVELS } = await import('../src/data/levels.js');
  const { STRATEGY_IDS } = await import('../src/ai/strategies.js');
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const quick = args.includes('--quick');
  let levels = (opt('levels', '') || Object.keys(LEVELS).join(',')).split(',').filter((id) => LEVELS[id] || id.endsWith('*') || id.includes(':'))
    .flatMap((id) => (id.endsWith('*') ? Object.keys(LEVELS).filter((x) => x.startsWith(id.slice(0, -1))) : [id]));
  if (args.includes('--modes')) {
    const { BIOMES, CHALLENGES } = await import('../src/modes/expedition.js');
    const biomes = opt('biomes', Object.keys(BIOMES).join(',')).split(',');
    const diffs = opt('diffs', '1,3,5').split(',').map(Number);
    levels = [...biomes.flatMap((b) => diffs.map((d) => `exp:${b}:${d}`)), ...biomes.map((b) => `endless:${b}`), ...CHALLENGES.map((c) => `ch:${c.id}`)];
  }
  const nameOf = (id) => LEVELS[id]?.name || '';
  const strategies = quick ? ['balanced'] : opt('strategies', STRATEGY_IDS.join(',')).split(',');
  const seeds = Number(opt('seeds', quick ? 1 : 3));
  const jobs = [];
  for (const id of levels) for (const strategy of strategies) for (let s = 1; s <= seeds; s++) jobs.push({ id, strategy, seed: s * 7919 + 11 });
  const n = Math.min(jobs.length, Number(opt('threads', availableParallelism())));
  const results = [];
  const t0 = Date.now();
  await new Promise((resolve) => {
    let next = 0, done = 0;
    const self = fileURLToPath(import.meta.url);
    for (let i = 0; i < n; i++) {
      const w = new Worker(self, { workerData: {} });
      const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else w.terminate(); };
      w.on('message', (r) => {
        results.push(r);
        if (r.result === 'error') console.error(r.id, r.strategy, r.reason);
        else if (args.includes('--progress')) console.log(`  · ${r.id} ${r.strategy} ${r.result}@${r.day}${r.result === 'win' ? '' : ' ' + (r.reason || '').slice(0, 20) + (args.includes('--objs') ? ' {' + r.objs + ' pop ' + r.pop + '}' : '')}`);
        done++;
        if (done === jobs.length) resolve();
        feed();
      });
      feed();
    }
  });
  let lost = 0;
  for (const id of levels) {
    const line = [id.padEnd(id.includes(':') ? 22 : 5), nameOf(id).padEnd(8)];
    for (const st of strategies) {
      const rs = results.filter((r) => r.id === id && r.strategy === st);
      const wins = rs.filter((r) => r.result === 'win');
      if (wins.length < rs.length) lost++;
      const avg = (k) => (wins.reduce((a, r) => a + r[k], 0) / Math.max(1, wins.length)).toFixed(1);
      let cell = `${st}:${wins.length}/${rs.length}${wins.length ? ` d${avg('day')} ★${avg('stars')}` : ''} †${rs.reduce((a, r) => a + r.deaths, 0)}`;
      const fails = rs.filter((r) => r.result !== 'win').map((r) => `${r.result}@${r.day}${r.reason ? ':' + r.reason.slice(0, 14) : ''}${args.includes('--objs') ? ' {' + r.objs + ' pop ' + r.pop + '}' : ''}`);
      if (fails.length) cell += ' [' + fails.join('; ') + ']';
      line.push(cell);
    }
    console.log(line.join('  '));
  }
  console.log(`\n${levels.length} levels × ${strategies.length} strategies × ${seeds} seeds on ${n} threads in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (quick && lost) { console.error(`✗ ${lost} level(s) not won`); process.exit(1); }
}
