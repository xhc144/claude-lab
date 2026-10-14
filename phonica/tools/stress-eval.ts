// Evaluates lexical-stress detection against the speechocean762 word stress labels
// (10 = correct stress, 5 = wrong) for a grid of prominence weights and margins.
//   node --experimental-transform-types tools/stress-eval.ts <dump.jsonl>...
import { readFileSync } from 'node:fs';
import { prosodyStats, type ProsodyWord, type StressParams } from '../src/engine/prosody.ts';
import { fluencyStats, type TimedWord } from '../src/engine/fluency.ts';
import { isVowel } from '../src/engine/phones.ts';
import { FUNCTION_WORDS } from '../src/engine/text.ts';

const utts = process.argv.slice(2).flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
const grid: StressParams[] = [];
for (const [energy, pitch, duration] of [[0.4, 0.3, 0.3], [0.3, 0.5, 0.2]]) {
  for (const margin of [0.35, 0.9]) grid.push({ energy, pitch, duration, margin });
}
for (const sp of grid) {
  let ok10 = 0, n10 = 0, flag5 = 0, n5 = 0;
  for (const u of utts) {
    const hop = u.hop;
    const timed: TimedWord[] = u.words.map((w: any, i: number) => ({ index: i, text: w.text, start: w.start * hop, end: w.end * hop, skipped: w.skipped, syllables: w.phones.filter((p: any) => isVowel(p.p)).length || 1, punctAfter: '', isFunction: FUNCTION_WORDS.has(w.text.toLowerCase()) }));
    const flu = fluencyStats(timed, u.gaps.map((g: any) => ({ kind: g.kind, start: g.start * hop, end: g.end * hop })));
    const pw: ProsodyWord[] = u.words.map((w: any, i: number) => ({ index: i, skipped: w.skipped, isFunction: timed[i].isFunction, start: w.start * hop, end: w.end * hop, phones: w.phones.map((p: any) => ({ arpa: p.p, start: p.s * hop, end: p.e * hop })) }));
    const pro = prosodyStats(pw, Float32Array.from(u.energy), Float32Array.from(u.f0), [], flu.speechStart, flu.speechEnd, sp);
    for (const st of pro.stress) {
      const lab = u.words[st.index].stress;
      if (lab === 10) { n10++; if (st.correct) ok10++; } else { n5++; if (!st.correct) flag5++; }
    }
  }
  console.log(`E${sp.energy} P${sp.pitch} D${sp.duration} m${sp.margin}: false flags on correct-stress words ${(100 * (1 - ok10 / n10)).toFixed(1)}% (n=${n10}), recall on wrong-stress words ${(100 * flag5 / n5).toFixed(1)}% (n=${n5})`);
}
