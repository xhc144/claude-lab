// Runs the acoustic front-end over speechocean762 and dumps per-phone evidence,
// alignment timing and prosodic tracks together with the human labels, for
// calibration (tools/calibrate.py).  usage: dump-so762.ts <model> <part> <shard> <nshards> <out.jsonl>
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import * as ort from 'onnxruntime-node';
import { AcousticModel } from '../src/engine/acoustic.ts';
import { decodeWav } from '../src/engine/wav.ts';
import { forceAlign } from '../src/engine/align.ts';
import { phoneEvidence, recognizePhones } from '../src/engine/gop.ts';
import { frameEnergyDb, pitchYin } from '../src/engine/dsp.ts';
import { PHONE_LIST, stripStress } from '../src/engine/phones.ts';
import { ALIGN_PARAMS } from '../src/engine/assess.ts';
import { CtcVerifier } from '../src/engine/ctc.ts';

const [modelName, part, shardS, nshardS, out] = process.argv.slice(2);
const M = '/home/user/data/models';
const SO = '/home/user/data/so762';
const scores = JSON.parse(readFileSync(`${SO}/resource/scores.json`, 'utf8'));
const model = new AcousticModel(ort, `${M}/${modelName}.onnx`, `${M}/${modelName.replace(/\.(int8|fp32)$/, '')}.json`, modelName);
await model.load(Number(process.env.ORT_THREADS || 1));
const verName = process.env.VERIFIER ?? 'w2v2_lv60_espeak_cv_ft.int8';
const lv = new AcousticModel(ort, `${M}/${verName}.onnx`, `${M}/${verName.replace(/\.(int8|fp32)$/, '')}.json`, verName);
await lv.load(Number(process.env.ORT_THREADS || 1));
const ver = new CtcVerifier(lv);
const ids = readFileSync(`${SO}/${part}/wav.scp`, 'utf8').trim().split('\n').map((l) => l.split(/\s+/));
const shard = Number(shardS), nshards = Number(nshardS);
const sil = model.index('[SIL]');
const phoneIds = PHONE_LIST.map((p) => model.index(p));
const VOWEL_IDS = new Set(['IY','IH','EY','EH','AE','AA','AO','OW','UH','UW','AH','ER','AY','AW','OY'].map((p) => model.index(p)));
const r2 = (v: number) => Math.round(v * 100) / 100;
const doneIds = new Set(existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []);
let done = 0;
for (let i = shard; i < ids.length; i += nshards) {
  const [id, path] = ids[i];
  if (doneIds.has(id)) continue;
  const ref = scores[id];
  const wav = decodeWav(readFileSync(`${SO}/${path}`));
  const post = await model.posteriors(wav.samples);
  const words = ref.words.map((w: any) => ({ variants: [{ classIds: w.phones.map((p: string) => model.index(stripStress(p))), penalty: 0 }] }));
  const al = forceAlign(post.logp, post.frames, post.vocab, words, {
    silId: sil, nonPhoneIds: [sil, model.index('[UNK]'), model.index('[PAD]'), model.index('<s>'), model.index('</s>')].filter((x) => x >= 0),
    minFrames: (c) => (VOWEL_IDS.has(c) ? 3 : 2), ...ALIGN_PARAMS,
  });
  const lvPost = await lv.posteriors(wav.samples);
  const energy = frameEnergyDb(wav.samples, 16000);
  const pitch = pitchYin(wav.samples, energy);
  const rec = recognizePhones(post.logp, post.frames, post.vocab, phoneIds, sil);
  const wordsOut = ref.words.map((w: any, wi: number) => {
    const aw = al.words[wi];
    const ctc = aw.skipped ? null : ver.scoreWord(lvPost, w.phones, { start: aw.start * post.hop - 0.03, end: aw.end * post.hop + 0.03 });
    return {
      heard: ctc?.heardIpa ?? '', cll: ctc ? r2(ctc.llPerFrame) : null,
      text: w.text, acc: w.accuracy, stress: w.stress, total: w.total, skipped: aw.skipped,
      start: aw.start, end: aw.end,
      phones: w.phones.map((p: string, pi: number) => {
        const seg = aw.phones[pi];
        const cls = model.index(stripStress(p));
        const ev = seg ? phoneEvidence(post.logp, post.vocab, seg.start, seg.end, cls, phoneIds, sil) : null;
        return {
          p, h: w['phones-accuracy'][pi], s: seg?.start ?? -1, e: seg?.end ?? -1,
          ctc: ctc && { g: r2(ctc.phones[pi].gop), d: r2(ctc.phones[pi].delMargin), a: ctc.phones[pi].alt, k: r2(ctc.phones[pi].peak) },
          ev: ev && { lpp: r2(ev.lpp), lpr: r2(ev.lpr), low: r2(ev.lprLow), sp: r2(ev.segPost), fa: r2(ev.frameAcc), sil: r2(ev.silFrac), comp: model.labels[ev.competitor], mar: r2(ev.margin), n: ev.frames },
        };
      }),
    };
  });
  appendFileSync(out, JSON.stringify({
    id, text: ref.text, hop: post.hop, frames: post.frames, dur: wav.samples.length / 16000,
    acc: ref.accuracy, comp: ref.completeness, flu: ref.fluency, pro: ref.prosodic, total: ref.total,
    words: wordsOut, gaps: al.gaps, rec: rec.map((r) => [model.labels[r.cls], r.start, r.end]),
    energy: Array.from(energy, (v) => Math.round(v)), f0: Array.from(pitch.f0, (v) => Math.round(v)),
  }) + '\n');
  if (++done % 100 === 0) console.error(`${part} shard ${shard}: ${done}`);
}
console.error(`${part} shard ${shard}: finished ${done}`);
