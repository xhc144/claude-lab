import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { tokenize } from '../src/engine/text.ts';
import { Lexicon, nonRhotic } from '../src/engine/lexicon.ts';
import { pronIpa, formatEspeakIpa, syllabify, espeakToArpa, substitutionAdvice, phoneDistance } from '../src/engine/phones.ts';
import { forceAlign } from '../src/engine/align.ts';
import { encodeWav, decodeWav, resample } from '../src/engine/wav.ts';
import { frameEnergyDb, pitchYin } from '../src/engine/dsp.ts';
import { fluencyStats } from '../src/engine/fluency.ts';
import { PHONE_FEATURES, phoneFeatures, WORD_FEATURES, wordFeatures, SENTENCE_FEATURES } from '../src/engine/scoring.ts';

test('tokenizer keeps offsets, punctuation and expands numbers', () => {
  const { tokens, sentences } = tokenize("Mr. Smith paid $25 for 3 books. Isn't it great? Where's the U.K. office!");
  assert.equal(tokens[0].text, 'Mr.');
  assert.deepEqual(tokens[0].spoken, ['mister']);
  const money = tokens.find((t) => t.text === '$25')!;
  assert.deepEqual(money.spoken, ['twenty', 'five', 'dollars']);
  assert.equal(tokens.find((t) => t.text === 'books')!.punctAfter, '.');
  assert.equal(sentences.length, 3);
  assert.equal(sentences[1].type, 'yes-no-question');
  assert.equal(sentences[2].type, 'exclamation');
  for (const t of tokens) assert.equal(tokenize("Mr. Smith paid $25 for 3 books. Isn't it great? Where's the U.K. office!").text.slice(t.start, t.end), t.text);
});

test('wh-questions are detected', () => {
  const { sentences } = tokenize('What time does it start? Do you like tea?');
  assert.equal(sentences[0].type, 'wh-question');
  assert.equal(sentences[1].type, 'yes-no-question');
});

test('lexicon gives CMUdict variants, British forms and OOV pronunciations', async () => {
  const lex = new Lexicon('resources/lexicon');
  await lex.loadEspeak();
  const car = await lex.prons('car', 'uk');
  assert.ok(car.some((p) => p.phones.join(' ') === 'K AA1'), 'non-rhotic variant for UK');
  assert.ok(car.some((p) => p.phones.join(' ') === 'K AA1 R'), 'rhotic variant kept');
  const the = await lex.prons('the', 'us');
  assert.ok(the.length >= 2, 'weak and strong forms');
  const oov = await lex.prons('blorptastic', 'us');
  assert.ok(oov.length >= 1 && oov[0].phones.length >= 6);
  const poss = await lex.prons("teacher's", 'us');
  assert.equal(poss[0].phones[poss[0].phones.length - 1], 'Z');
});

test('IPA rendering', () => {
  assert.equal(pronIpa('W AO1 T ER0'.split(' '), 'us'), 'ˈwɔːtər');
  assert.equal(pronIpa('W AO1 T ER0'.split(' '), 'uk'), 'ˈwɔːtə');
  assert.equal(pronIpa('IH0 K S P R EH1 SH AH0 N'.split(' '), 'us'), 'ɪkˈspreʃən');
  assert.equal(formatEspeakIpa('təmˈɑːtəʊ'), 'təˈmɑːtəʊ');
  assert.equal(formatEspeakIpa('bˈɑːθ'), 'bɑːθ');
  assert.deepEqual(syllabify('AE1 K T IH0 NG'.split(' ')).map((s) => s.join(' ')), ['AE1 K', 'T IH0 NG']);
  assert.deepEqual(espeakToArpa('θˈɪŋk'), ['TH', 'IH1', 'NG', 'K']);
  assert.deepEqual(nonRhotic('B ER1 D'.split(' ')), ['B', 'ER1', 'D']);
  assert.deepEqual(nonRhotic('W AO1 T ER0'.split(' ')), ['W', 'AO1', 'T', 'AH0']);
});

test('phonetic advice and distances', () => {
  assert.match(substitutionAdvice('TH', 'S'), /舌尖/);
  assert.match(substitutionAdvice('V', 'W'), /上齿/);
  assert.ok(phoneDistance('IY', 'IH') < phoneDistance('IY', 'AA'));
  assert.ok(phoneDistance('S', 'Z') < phoneDistance('S', 'M'));
});

test('forced alignment recovers segment boundaries, skips and fillers', () => {
  // vocab: 0 = silence, 1..4 = phones, 5 = unrelated phone
  const V = 6;
  const frames = 60;
  const lab = new Array(frames).fill(0);
  for (let t = 5; t < 15; t++) lab[t] = 1;
  for (let t = 15; t < 25; t++) lab[t] = 2;
  for (let t = 30; t < 45; t++) lab[t] = 5; // an inserted, unrelated sound
  for (let t = 45; t < 55; t++) lab[t] = 3;
  const logp = new Float32Array(frames * V);
  for (let t = 0; t < frames; t++) for (let c = 0; c < V; c++) logp[t * V + c] = Math.log(c === lab[t] ? 0.95 : 0.01);
  const words = [{ variants: [{ classIds: [1, 2], penalty: 0 }] }, { variants: [{ classIds: [4, 4, 4], penalty: 0 }] }, { variants: [{ classIds: [3], penalty: 0 }] }];
  const al = forceAlign(logp, frames, V, words, { silId: 0, nonPhoneIds: [0], minFrames: () => 2, skipPenalty: 40, maxSkip: 3, fillerEntry: 8, fillerFrame: 2.5, silEntry: 1, beam: 60 });
  assert.equal(al.words[0].skipped, false);
  assert.equal(al.words[0].phones[0].start, 5);
  assert.equal(al.words[0].phones[1].start, 15);
  assert.equal(al.words[2].phones[0].start, 45);
  assert.ok(al.gaps.some((g) => g.kind === 'filler' && g.start >= 30 && g.end <= 45 && g.end - g.start >= 8), 'inserted sound absorbed by the filler model');
  // the absent word is kept at its minimum duration rather than stretched over the insertion
  assert.equal(al.words[1].end - al.words[1].start, 6);
});

test('WAV round trip and resampling preserve the signal', () => {
  const sr = 48000;
  const x = new Float32Array(sr);
  for (let i = 0; i < sr; i++) x[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr);
  const d = decodeWav(encodeWav(x, sr, 16));
  assert.equal(d.sampleRate, sr);
  assert.ok(Math.abs(d.samples[1000] - x[1000]) < 1e-3);
  const y = resample(x, sr, 16000);
  assert.equal(y.length, 16000);
  let err = 0;
  for (let i = 100; i < 15900; i++) err = Math.max(err, Math.abs(y[i] - 0.5 * Math.sin((2 * Math.PI * 440 * i) / 16000)));
  assert.ok(err < 0.01, `resampling error ${err}`);
});

test('pitch tracker measures a synthetic voice', () => {
  const sr = 16000;
  const x = new Float32Array(sr);
  for (let i = 0; i < sr; i++) {
    const f = 150 + 50 * (i / sr); // glide 150 -> 200 Hz
    let v = 0;
    for (let h = 1; h <= 5; h++) v += Math.sin(2 * Math.PI * f * h * (i / sr)) / h;
    x[i] = 0.3 * v;
  }
  const e = frameEnergyDb(x, sr);
  const { f0 } = pitchYin(x, e);
  assert.ok(Math.abs(f0[20] - 170) < 5, `f0 at 0.2 s = ${f0[20]}`); // instantaneous frequency of the chirp: 150 + 100 t
  assert.ok(Math.abs(f0[80] - 230) < 8, `f0 at 0.8 s = ${f0[80]}`);
});

test('fluency classifies pauses', () => {
  const words = [
    { index: 0, text: 'hello', start: 0.2, end: 0.6, skipped: false, syllables: 2, punctAfter: ',', isFunction: false },
    { index: 1, text: 'my', start: 1.2, end: 1.4, skipped: false, syllables: 1, punctAfter: '', isFunction: true },
    { index: 2, text: 'friend', start: 2.0, end: 2.4, skipped: false, syllables: 1, punctAfter: '.', isFunction: false },
  ];
  const f = fluencyStats(words, []);
  assert.equal(f.pauseCount, 2);
  assert.equal(f.pauses[0].kind, 'boundary');
  assert.equal(f.pauses[1].kind, 'hesitation');
  assert.equal(f.pauses[1].disfluent, true);
});

test('feature vectors match their declared layouts', () => {
  const x = phoneFeatures({ arpa: 'TH', ev: { lpp: -0.5, lpr: -0.2, lprLow: -0.4, segPost: -0.3, frameAcc: 0.8, silFrac: 0, competitor: 3, margin: 2, frames: 9 }, durSec: 0.09, prevLpr: 0, nextLpr: -1, wordMeanLpr: -0.3, wordMinLpr: -1, rateFactor: 1, ctc: { gop: 2, del: 5, peak: 0.9 }, wordCtcLL: -0.2 });
  assert.equal(x.length, PHONE_FEATURES.length);
  const w = wordFeatures({ phoneScores: [2, 1.5], phoneLpr: [0, -1], phoneFrameAcc: [1, 0.5], skipped: false, isFunction: false, durSec: 0.3, expectedSec: 0.25 });
  assert.equal(w.length, WORD_FEATURES.length);
  assert.ok(SENTENCE_FEATURES.length > 20);
});

const MODELS = process.env.PHONICA_MODELS ?? 'models';
const haveModels = existsSync(`${MODELS}/en_w2v2_fc_10ms.int8.onnx`) && existsSync(`${MODELS}/w2v2_lv60_espeak_cv_ft.int8.onnx`);

test('engine assesses correct speech highly and flags a substitution', { skip: !haveModels && 'models not downloaded' }, async () => {
  const ort = await import('onnxruntime-node');
  const { Engine } = await import('../src/engine/assess.ts');
  const engine = new Engine({
    ort, modelPath: `${MODELS}/en_w2v2_fc_10ms.int8.onnx`, modelMetaPath: `${MODELS}/en_w2v2_fc_10ms.json`, modelName: 'en_w2v2_fc_10ms.int8',
    verifierPath: `${MODELS}/w2v2_lv60_espeak_cv_ft.int8.onnx`, verifierMetaPath: `${MODELS}/w2v2_lv60_espeak_cv_ft.json`,
    lexiconDir: 'resources/lexicon', scoringDir: 'resources/scoring', appVersion: 'test',
  });
  await engine.init();
  const text = 'I think the weather is very nice today.';
  const good = decodeWav(readFileSync('resources/selftest/think.wav'));
  const r = await engine.assess({ text, accent: 'us', mode: 'sentence', samples: good.samples, sampleRate: good.sampleRate });
  assert.equal(r.words.length, 8);
  assert.ok(r.words.every((w) => !w.skipped), 'all words found');
  assert.ok(r.scores.accuracy >= 80, `accuracy ${r.scores.accuracy}`);
  assert.equal(r.scores.completeness, 100);
  // word timings are increasing and within the audio
  for (let i = 1; i < r.words.length; i++) assert.ok(r.words[i].start >= r.words[i - 1].end - 1e-6);
  assert.ok(r.words[7].end <= r.audio.durationSec + 0.01);
  // sink.wav: /θ/→/s/ in "think" and /v/→/w/ in "very", substituted at the phoneme level
  const bad = decodeWav(readFileSync('resources/selftest/sink.wav'));
  const r2 = await engine.assess({ text, accent: 'us', mode: 'sentence', samples: bad.samples, sampleRate: bad.sampleRate });
  const th = r2.words.find((w) => w.spoken === 'think')!.phones[0];
  assert.equal(th.error?.type, 'substitution', 'θ→s is reported as a substitution');
  assert.equal(th.error?.heard, 'S');
  assert.ok(th.score < r.words.find((w) => w.spoken === 'think')!.phones[0].score);
  // the aligner's evidence for /w/ is exposed even when the calibrated score stays high
  const v = r2.words.find((w) => w.spoken === 'very')!.phones[0];
  assert.equal(v.closest?.arpa, 'W');
  assert.ok(v.gop.lpr < -3, `lpr ${v.gop.lpr}`);
  assert.ok(r2.issues.some((i) => i.category === 'phoneme' && i.title.includes('/θ/')));
});
