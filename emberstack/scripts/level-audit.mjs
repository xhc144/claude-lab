#!/usr/bin/env node
// Rough per-level audit: sustainable food per day from the starting nodes vs. what the camp eats.
import { LEVELS } from '../src/data/levels.js';
import { CARDS } from '../src/data/cards.js';
for (const L of Object.values(LEVELS)) {
  let pop = 0, sustain = 0, stock = 0;
  for (const e of L.start) {
    const d = CARDS[e.c], n = e.n || 1;
    if (d.kind === 'folk') pop += n;
    if (d.food) stock += d.food * n;
    const nd = d.node;
    if (!nd) continue;
    const f = nd.out.reduce((a, [id, k]) => a + (CARDS[id].food || 0) * k * (CARDS[id].tags.includes('raw') ? 2 : 1), 0);
    if (!f) continue;
    // per day: perennial = regen per day (plus ~day of work), inexhaustible = one worker-day
    const perDay = nd.charges < 0 ? (72 / nd.t) * f : nd.perennial ? (nd.regen || 1) * f : 0;
    const sm = L.rules?.seasons === false && L.rules?.season === 3 ? (nd.season?.[3] ?? 1) : 1;
    sustain += perDay * n * sm;
  }
  const need = pop * 2;
  const flag = sustain < need * 1.2 ? '  ← thin' : '';
  console.log(`${L.id} ${L.name.padEnd(6)} pop ${pop} eats ${need}/day  sustainable≈${sustain.toFixed(0)}  stock ${stock}${flag}`);
}
