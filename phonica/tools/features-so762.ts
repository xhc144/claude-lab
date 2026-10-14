// Turns a speechocean762 dump (tools/dump-so762.ts) into training matrices.
//   phase 1: features-so762.ts phone <dump.jsonl> <out.json>
//   phase 2: features-so762.ts sent  <dump.jsonl> <scoring-partial.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { fluencyStats, type TimedWord } from '../src/engine/fluency.ts';
import { prosodyStats, type ProsodyWord } from '../src/engine/prosody.ts';
import { phoneFeatures, wordFeatures, sentenceFeatures, Mlp } from '../src/engine/scoring.ts';
import { PHONES, isVowel, stripStress } from '../src/engine/phones.ts';
import { FUNCTION_WORDS } from '../src/engine/text.ts';
import type { PhoneEvidence } from '../src/engine/gop.ts';

const [phase, dumpPath, a3, a4] = process.argv.slice(2);
const lines = readFileSync(dumpPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

function evOf(e: any): PhoneEvidence {
  return { lpp: e.lpp, lpr: e.lpr, lprLow: e.low, segPost: e.sp, frameAcc: e.fa, silFrac: e.sil, competitor: -1, margin: e.mar, frames: e.n };
}

function analyse(u: any) {
  const hop = u.hop;
  const timed: TimedWord[] = u.words.map((w: any, i: number) => ({
    index: i, text: w.text, start: w.start * hop, end: w.end * hop, skipped: w.skipped,
    syllables: w.phones.filter((p: any) => isVowel(p.p)).length || 1, punctAfter: '', isFunction: FUNCTION_WORDS.has(w.text.toLowerCase()),
  }));
  const gaps = u.gaps.map((g: any) => ({ kind: g.kind, start: g.start * hop, end: g.end * hop }));
  const flu = fluencyStats(timed, gaps);
  const rateFactor = Math.max(0.5, Math.min(2, (flu.articulationRate || 4) / 4.0));
  return { timed, gaps, flu, rateFactor };
}

function phoneRows(u: any, rateFactor: number) {
  const rows: Array<{ x: number[]; y: number; w: number; p: number }> = [];
  u.words.forEach((w: any, wi: number) => {
    const lprs = w.phones.map((p: any) => (p.ev ? p.ev.lpr : -20));
    const wm = lprs.reduce((a: number, b: number) => a + b, 0) / Math.max(1, lprs.length);
    const wmin = Math.min(...lprs);
    w.phones.forEach((p: any, pi: number) => {
      if (!p.ev) return;
      const x = phoneFeatures({
        arpa: p.p, ev: evOf(p.ev), durSec: (p.e - p.s) * u.hop,
        prevLpr: pi > 0 ? lprs[pi - 1] : null, nextLpr: pi + 1 < lprs.length ? lprs[pi + 1] : null,
        wordMeanLpr: wm, wordMinLpr: wmin, rateFactor,
        ctc: p.ctc ? { gop: p.ctc.g, del: p.ctc.d, peak: p.ctc.k } : null, wordCtcLL: w.cll ?? null,
      });
      rows.push({ x, y: p.h, w: wi, p: pi });
    });
  });
  return rows;
}

if (phase === 'phone') {
  const X: number[][] = [];
  const Y: number[] = [];
  const U: string[] = [];
  const P: string[] = [];
  for (const u of lines) {
    const { rateFactor } = analyse(u);
    for (const r of phoneRows(u, rateFactor)) {
      X.push(r.x.map((v) => Math.round(v * 1000) / 1000));
      Y.push(r.y);
      U.push(u.id);
      P.push(stripStress(u.words[r.w].phones[r.p].p));
    }
  }
  writeFileSync(a3, JSON.stringify({ X, Y, U, P }));
  console.error(`phone rows: ${X.length}`);
} else {
  const partial = JSON.parse(readFileSync(a3, 'utf8'));
  const phoneModel = new Mlp(partial.phone);
  const wordModel = partial.word ? new Mlp(partial.word) : null;
  const WX: number[][] = [];
  const WY: number[] = [];
  const SX: number[][] = [];
  const SY: number[][] = [];
  const ids: string[] = [];
  for (const u of lines) {
    const { timed, flu, rateFactor } = analyse(u);
    const rows = phoneRows(u, rateFactor);
    const pred = new Map<string, number>();
    for (const r of rows) pred.set(`${r.w}:${r.p}`, phoneModel.predict(r.x));
    const allPhone: number[] = [];
    const allLpr: number[] = [];
    const wordScores: number[] = [];
    let canonical = 0;
    u.words.forEach((w: any, wi: number) => {
      const ps = w.phones.map((_: any, pi: number) => pred.get(`${wi}:${pi}`) ?? 0);
      const lprs = w.phones.map((p: any) => (p.ev ? p.ev.lpr : -20));
      const fas = w.phones.map((p: any) => (p.ev ? p.ev.fa : 0));
      canonical += w.phones.length;
      const expected = w.phones.reduce((s: number, p: any) => s + (PHONES[stripStress(p.p)]?.meanDurMs ?? 80) / 1000, 0) / rateFactor;
      const x = wordFeatures({ phoneScores: ps, phoneLpr: lprs, phoneFrameAcc: fas, skipped: w.skipped, isFunction: FUNCTION_WORDS.has(w.text.toLowerCase()), durSec: (w.end - w.start) * u.hop, expectedSec: expected });
      WX.push(x.map((v) => Math.round(v * 1000) / 1000));
      WY.push(w.acc);
      allPhone.push(...ps);
      allLpr.push(...lprs);
      wordScores.push(wordModel ? wordModel.predict(x) : (ps.reduce((a: number, b: number) => a + b, 0) / Math.max(1, ps.length)) * 5);
    });
    const pw: ProsodyWord[] = u.words.map((w: any, i: number) => ({
      index: i, skipped: w.skipped, isFunction: timed[i].isFunction, start: w.start * u.hop, end: w.end * u.hop,
      phones: w.phones.map((p: any) => ({ arpa: p.p, start: p.s * u.hop, end: p.e * u.hop })),
    }));
    const pro = prosodyStats(pw, Float32Array.from(u.energy), Float32Array.from(u.f0), [{ index: 0, type: u.words.length > 3 ? 'statement' : 'fragment', firstWord: 0, lastWord: u.words.length - 1 }], flu.speechStart, flu.speechEnd);
    const sx = sentenceFeatures({
      phoneScores: allPhone, wordScores, phoneLpr: allLpr, skippedFrac: u.words.filter((w: any) => w.skipped).length / u.words.length,
      wordCount: u.words.length, recognizedRatio: u.rec.length / Math.max(1, canonical), fluency: flu, prosody: pro, leadSilence: flu.speechStart,
    });
    SX.push(sx.map((v) => Math.round(v * 1000) / 1000));
    SY.push([u.acc, u.flu, u.pro, u.comp, u.total]);
    ids.push(u.id);
  }
  writeFileSync(a4, JSON.stringify({ WX, WY, SX, SY, ids }));
  console.error(`word rows ${WX.length}, sentence rows ${SX.length}`);
}
