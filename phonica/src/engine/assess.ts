// The assessment pipeline: text → canonical phones → acoustic posteriors →
// forced alignment → phone/word/sentence scores, diagnostics and prosody.
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AcousticModel } from './acoustic.ts';
import { CtcVerifier, type CtcWordResult } from './ctc.ts';
import { forceAlign, type AlignWordSpec } from './align.ts';
import { phoneEvidence, recognizePhones, type PhoneEvidence } from './gop.ts';
import { Lexicon, type Pron, nonRhotic } from './lexicon.ts';
import { tokenize, FUNCTION_WORDS } from './text.ts';
import { resample } from './wav.ts';
import { frameEnergyDb, pitchYin, formants, HOP_SEC } from './dsp.ts';
import { fluencyStats, type TimedWord } from './fluency.ts';
import { prosodyStats, type ProsodyWord } from './prosody.ts';
import { salientSubstitution, neighbourPhone, SALIENT_SUB_CAP, SALIENT_SUB_WORD_CAP } from './substitution.ts';
import { loadScoring, phoneFeatures, wordFeatures, sentenceFeatures, type ScoringModels } from './scoring.ts';
import { PHONES, PHONE_LIST, isVowel, phoneIpa, pronIpa, stripStress, substitutionAdvice, formatEspeakIpa, syllabify } from './phones.ts';
import type { AssessRequest, AssessmentResult, Issue, PhoneResult, WordResult, Accent, VowelPoint } from '../shared/types.ts';

type Ort = typeof import('onnxruntime-node');

export interface EngineOptions {
  ort: Ort;
  modelPath: string;
  modelMetaPath: string;
  modelName: string;
  /** multilingual CTC phoneme model used for alignment-free GOP and "heard" diagnosis */
  verifierPath?: string;
  verifierMetaPath?: string;
  lexiconDir: string;
  scoringDir: string;
  appVersion: string;
  threads?: number;
}

export class EngineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const ERROR_LIKE = new Set(['AH', 'ER', 'UH', 'IH']);

/** Alignment graph costs (log domain), shared with the calibration tooling. */
export const ALIGN_PARAMS = {
  skipPenalty: Number(process.env.PHONICA_SKIP ?? 40),
  maxSkip: 3,
  fillerEntry: Number(process.env.PHONICA_FILL_ENTRY ?? 8),
  fillerFrame: Number(process.env.PHONICA_FILL_FRAME ?? 2.5),
  silEntry: 1,
  beam: 60,
};

export class Engine {
  readonly model: AcousticModel;
  readonly lexicon: Lexicon;
  private verifierModel: AcousticModel | null = null;
  private verifier: CtcVerifier | null = null;
  private scoring: ScoringModels | null;
  private opts: EngineOptions;
  private silId: number;
  private phoneIds: number[];
  private nonPhoneIds: number[];

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.model = new AcousticModel(opts.ort, opts.modelPath, opts.modelMetaPath, opts.modelName);
    this.lexicon = new Lexicon(opts.lexiconDir);
    this.scoring = loadScoring(opts.scoringDir);
    this.silId = this.model.index('[SIL]');
    this.phoneIds = PHONE_LIST.map((p) => this.model.index(p));
    if (this.silId < 0 || this.phoneIds.some((i) => i < 0)) throw new Error('acoustic model vocabulary does not cover the ARPABET phone set');
    this.nonPhoneIds = this.model.labels.map((l, i) => (PHONES[l] ? -1 : i)).filter((i) => i >= 0);
    if (opts.verifierPath && opts.verifierMetaPath) {
      this.verifierModel = new AcousticModel(opts.ort, opts.verifierPath, opts.verifierMetaPath, 'verifier');
      this.verifier = new CtcVerifier(this.verifierModel);
    }
  }

  get hasVerifier(): boolean {
    return !!this.verifier;
  }

  get calibrated(): boolean {
    return !!this.scoring;
  }

  get scoringMeta() {
    return this.scoring?.meta ?? null;
  }

  async init(): Promise<void> {
    await this.model.load(this.opts.threads ?? 0);
    if (this.verifierModel) await this.verifierModel.load(this.opts.threads ?? 0);
    await this.lexicon.loadEspeak();
  }

  /** Word timings of a (reference) recording of `text`, e.g. synthesised speech. */
  async alignOnly(text: string, audio16k: Float32Array, accent: Accent): Promise<Array<{ text: string; start: number; end: number }>> {
    const { tokens } = tokenize(text);
    const units: Array<{ token: number; prons: Pron[] }> = [];
    for (const t of tokens) for (const w of t.spoken) units.push({ token: t.index, prons: await this.lexicon.prons(w, accent) });
    const post = await this.model.posteriors(audio16k);
    const al = this.align(post, units.map((u) => u.prons), accent);
    const out: Array<{ text: string; start: number; end: number }> = [];
    al.words.forEach((w, i) => {
      if (w.skipped) return;
      const tok = tokens[units[i].token];
      const last = out[out.length - 1];
      if (last && last.text === tok.text && i > 0 && units[i - 1].token === units[i].token) last.end = w.end * post.hop;
      else out.push({ text: tok.text, start: w.start * post.hop, end: w.end * post.hop });
    });
    return out;
  }

  private align(post: { logp: Float32Array; frames: number; vocab: number; hop: number }, prons: Pron[][], accent: Accent) {
    const hop = post.hop;
    const specs: AlignWordSpec[] = prons.map((ps) => ({
      variants: ps.map((p) => ({
        classIds: p.phones.map((x) => this.model.index(stripStress(x))),
        penalty: p.accent === 'both' || p.accent === accent ? (p.source === 'espeak-us' ? -0.5 : 0) : -5,
      })),
    }));
    const minF = hop < 0.015 ? 2 : 1;
    const vowelIds = new Set(PHONE_LIST.filter((p) => PHONES[p].kind === 'vowel').map((p) => this.model.index(p)));
    return forceAlign(post.logp, post.frames, post.vocab, specs, {
      silId: this.silId,
      nonPhoneIds: this.nonPhoneIds,
      minFrames: (c) => (vowelIds.has(c) ? minF + (hop < 0.015 ? 1 : 0) : minF),
      ...ALIGN_PARAMS,
    });
  }

  /** IPA of a word in both accents plus its dictionary pronunciations. */
  async lookup(word: string): Promise<{ word: string; ipaUS: string; ipaUK: string; prons: Pron[] }> {
    const w = word.toLowerCase().replace(/[^a-z'\-]/g, '');
    const prons = await this.lexicon.prons(w, 'us');
    return { word: w, ...(await this.wordIpa(w, prons)), prons };
  }

  private async wordIpa(w: string, prons: Pron[]): Promise<{ ipaUS: string; ipaUK: string }> {
    const us = prons.find((p) => p.accent !== 'uk') ?? prons[0];
    const ukRaw = await this.lexicon.espeakIpa(w, 'uk');
    const ipaUK = ukRaw ? formatEspeakIpa(ukRaw) : us ? pronIpa(nonRhotic(us.phones), 'uk') : '';
    return { ipaUS: us ? pronIpa(us.phones, 'us') : '', ipaUK };
  }

  /** IPA transcription of a whole text (for display before recording). */
  async textIpa(text: string, accent: Accent): Promise<Array<{ token: number; text: string; ipa: string; punct: string }>> {
    const { tokens } = tokenize(text);
    const out: Array<{ token: number; text: string; ipa: string; punct: string }> = [];
    for (const t of tokens) {
      const parts: string[] = [];
      for (const w of t.spoken) {
        const prons = await this.lexicon.prons(w, accent);
        const ipa = await this.wordIpa(w, prons);
        parts.push(accent === 'us' ? ipa.ipaUS : ipa.ipaUK);
      }
      out.push({ token: t.index, text: t.text, ipa: parts.join(' '), punct: t.punctAfter });
    }
    return out;
  }

  async assess(req: AssessRequest, progress?: (stage: string, frac: number) => void): Promise<AssessmentResult> {
    const t0 = Date.now();
    const accent = req.accent;
    progress?.('prepare', 0.05);
    const audio = req.sampleRate === 16000 ? req.samples : resample(req.samples, req.sampleRate, 16000);
    const durationSec = audio.length / 16000;
    if (durationSec < 0.3) throw new EngineError('too-short', '录音太短，请至少朗读一个完整的单词。');
    const energy = frameEnergyDb(audio, 16000);
    let peak = -Infinity;
    for (const e of energy) peak = Math.max(peak, e);
    if (peak < -50) throw new EngineError('silent', '没有检测到声音，请检查麦克风是否静音或选错了输入设备。');

    // ---- text ----
    const { tokens, sentences, text } = tokenize(req.text);
    if (!tokens.length) throw new EngineError('no-text', '朗读文本中没有可识别的英文单词。');
    type Unit = { token: number; word: string; prons: Pron[] };
    const units: Unit[] = [];
    for (const t of tokens) for (const w of t.spoken) units.push({ token: t.index, word: w, prons: await this.lexicon.prons(w, accent) });
    if (units.length > 1500) throw new EngineError('too-long', '文本过长，请分段练习（单次最多约 1500 个单词）。');

    // ---- acoustic model ----
    progress?.('acoustic', 0.15);
    const post = await this.model.posteriors(audio);
    progress?.('align', 0.6);
    const hop = post.hop;
    const al = this.align(post, units.map((u) => u.prons), accent);

    // ---- per-phone evidence ----
    type PW = { unit: Unit; pron: Pron; skipped: boolean; start: number; end: number; phones: Array<{ arpa: string; start: number; end: number; ev: PhoneEvidence | null }> };
    const pw: PW[] = units.map((u, i) => {
      const a = al.words[i];
      const pron = u.prons[a.variant] ?? u.prons[0];
      return {
        unit: u,
        pron,
        skipped: a.skipped,
        start: a.start * hop,
        end: a.end * hop,
        phones: pron.phones.map((arpa, pi) => {
          const seg = a.skipped ? undefined : a.phones[pi];
          return {
            arpa,
            start: seg ? seg.start * hop : -1,
            end: seg ? seg.end * hop : -1,
            ev: seg ? phoneEvidence(post.logp, post.vocab, seg.start, seg.end, this.model.index(stripStress(arpa)), this.phoneIds, this.silId) : null,
          };
        }),
      };
    });

    // ---- CTC verification (alignment-free GOP per word region) ----
    progress?.('verify', 0.65);
    const ctcWords: Array<CtcWordResult | null> = pw.map(() => null);
    const rhotic: Array<number | null> = pw.map(() => null);
    if (this.verifier && this.verifierModel) {
      const vpost = await this.verifierModel.posteriors(audio);
      pw.forEach((w, i) => {
        if (w.skipped) return;
        const region = { start: w.start - 0.03, end: w.end + 0.03 };
        ctcWords[i] = this.verifier!.scoreWord(vpost, w.pron.phones, region);
        // for accent notes: did the speaker produce a post-vocalic /r/? Only for words
        // whose British and American forms differ, and not before a vowel, where
        // RP also links with /r/ ("far away").
        const us = w.unit.prons.find((p) => p.accent === 'us');
        const hasUk = w.unit.prons.some((p) => p.accent === 'uk');
        const next = pw[i + 1];
        const linking = !!next && !next.skipped && isVowel(next.pron.phones[0] ?? '');
        if (us && hasUk && !linking) rhotic[i] = this.verifier!.rhoticPreference(vpost, us.phones, region);
      });
    }

    // ---- fluency (also gives the speaking-rate normaliser) ----
    const timed: TimedWord[] = pw.map((w, i) => ({
      index: i,
      text: w.unit.word,
      start: w.start,
      end: w.end,
      skipped: w.skipped,
      syllables: Math.max(1, w.pron.phones.filter(isVowel).length),
      punctAfter: isLastUnitOfToken(units, i) ? tokens[w.unit.token].punctAfter : '',
      isFunction: FUNCTION_WORDS.has(w.unit.word),
    }));
    const gaps = al.gaps.map((g) => ({ kind: g.kind, start: g.start * hop, end: g.end * hop }));
    const flu = fluencyStats(timed, gaps);
    const rateFactor = Math.max(0.5, Math.min(2, (flu.articulationRate || 4) / 4.0));

    // ---- phone & word scores ----
    progress?.('score', 0.75);
    const sc = this.scoring;
    const phoneScore: number[][] = [];
    const salientSub: Array<Array<'both' | 'ctc' | null>> = [];
    const wordScore: number[] = [];
    pw.forEach((w, wi) => {
      const cw = ctcWords[wi];
      const lprs = w.phones.map((p) => (p.ev ? p.ev.lpr : -20));
      const wm = lprs.reduce((a, b) => a + b, 0) / Math.max(1, lprs.length);
      const wmin = Math.min(...lprs);
      const conf: Array<'both' | 'ctc' | null> = w.phones.map(() => null);
      const ps = w.phones.map((p, pi) => {
        if (!p.ev) return 0;
        const c = cw?.phones[pi];
        const x = phoneFeatures({ arpa: p.arpa, ev: p.ev, durSec: p.end - p.start, prevLpr: pi > 0 ? lprs[pi - 1] : null, nextLpr: pi + 1 < lprs.length ? lprs[pi + 1] : null, wordMeanLpr: wm, wordMinLpr: wmin, rateFactor, ctc: c ? { gop: c.gop, del: c.delMargin, peak: c.peak } : null, wordCtcLL: cw ? cw.llPerFrame : null });
        const pred = sc ? sc.phone.predict(x) : Math.max(0, Math.min(2, 2 + p.ev.lpr / 2));
        // speechocean762 raters often accept the classic learner substitutions (/θ/→/s/,
        // /v/→/w/, /ð/→/z/ …). When the acoustic evidence clearly shows one, report it
        // and keep the phone out of the "good" band.
        const fcComp = p.ev.competitor >= 0 ? this.model.labels[p.ev.competitor] : '';
        const sub = c ? salientSubstitution(stripStress(p.arpa), c.alt, fcComp, p.ev.lpr, c.gop, neighbourPhone(pw, wi, pi, -1), neighbourPhone(pw, wi, pi, 1)) : null;
        if (sub) {
          conf[pi] = sub;
          return Math.min(pred, SALIENT_SUB_CAP);
        }
        return pred;
      });
      phoneScore.push(ps);
      salientSub.push(conf);
      const expected = w.pron.phones.reduce((s, p) => s + (PHONES[stripStress(p)]?.meanDurMs ?? 80) / 1000, 0) / rateFactor;
      const wx = wordFeatures({ phoneScores: ps, phoneLpr: lprs, phoneFrameAcc: w.phones.map((p) => p.ev?.frameAcc ?? 0), skipped: w.skipped, isFunction: FUNCTION_WORDS.has(w.unit.word), durSec: w.end - w.start, expectedSec: expected });
      const ws = w.skipped ? 0 : sc ? sc.word.predict(wx) : (ps.reduce((a, b) => a + b, 0) / Math.max(1, ps.length)) * 5;
      wordScore.push(conf.some(Boolean) ? Math.min(ws, SALIENT_SUB_WORD_CAP) : ws);
    });

    // ---- prosody ----
    progress?.('prosody', 0.82);
    const pitch = pitchYin(audio, energy);
    const sentRanges = sentences.map((s) => {
      const ws = units.map((u, i) => (u.token >= s.tokenStart && u.token < s.tokenEnd ? i : -1)).filter((i) => i >= 0);
      return { index: s.index, type: s.type, firstWord: ws[0] ?? 0, lastWord: ws[ws.length - 1] ?? 0 };
    });
    const prosWords: ProsodyWord[] = pw.map((w, i) => ({ index: i, skipped: w.skipped, isFunction: timed[i].isFunction, start: w.start, end: w.end, phones: w.phones.map((p) => ({ arpa: p.arpa, start: p.start, end: p.end })) }));
    const pro = prosodyStats(prosWords, energy, pitch.f0, sentRanges, flu.speechStart, flu.speechEnd);

    // ---- free phone recognition ----
    const rec = recognizePhones(post.logp, post.frames, post.vocab, this.phoneIds, this.silId);
    const canonicalCount = pw.reduce((s, w) => s + w.phones.length, 0);

    // ---- sentence-level scores ----
    const allPhone = phoneScore.flat();
    const allLpr = pw.flatMap((w) => w.phones.map((p) => (p.ev ? p.ev.lpr : -20)));
    const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const readWords = pw.filter((w, i) => !w.skipped && (wordScore[i] >= 2 || mean(w.phones.map((p) => p.ev?.frameAcc ?? 0)) > 0.25)).length;
    const completeness = Math.round((100 * readWords) / pw.length);
    // The regressors were trained on single sentences, so longer readings are scored
    // sentence by sentence (keeping every feature in its training range) and averaged
    // by word count.
    const perSentence: Array<{ index: number; words: number; accuracy: number; fluency: number; prosody: number; total: number } | null> = [];
    for (const sr of sentRanges) {
      const idx: number[] = [];
      for (let i = sr.firstWord; i <= sr.lastWord; i++) idx.push(i);
      const live = idx.filter((i) => !pw[i].skipped);
      if (!idx.length || !live.length || !sc) { perSentence.push(null); continue; }
      const t0 = pw[live[0]].start;
      const t1 = pw[live[live.length - 1]].end;
      const sFlu = sentRanges.length === 1 ? flu : fluencyStats(idx.map((i) => timed[i]), gaps.filter((g) => g.start >= t0 - 0.01 && g.end <= t1 + 0.01));
      const sPro = sentRanges.length === 1 ? pro : prosodyStats(idx.map((i) => prosWords[i]), energy, pitch.f0, [sr], sFlu.speechStart, sFlu.speechEnd);
      const canon = idx.reduce((n, i) => n + pw[i].phones.length, 0);
      const recIn = rec.filter((r) => r.start * hop >= t0 - 0.05 && r.end * hop <= t1 + 0.05).length;
      const prevEnd = sr.index > 0 ? [...pw.slice(0, sr.firstWord)].reverse().find((w) => !w.skipped)?.end : undefined;
      const sx = sentenceFeatures({
        phoneScores: idx.flatMap((i) => phoneScore[i]),
        wordScores: idx.map((i) => wordScore[i]),
        phoneLpr: idx.flatMap((i) => pw[i].phones.map((p) => (p.ev ? p.ev.lpr : -20))),
        skippedFrac: idx.filter((i) => pw[i].skipped).length / idx.length,
        wordCount: idx.length,
        recognizedRatio: (sentRanges.length === 1 ? rec.length : recIn) / Math.max(1, canon),
        fluency: sFlu,
        prosody: sPro,
        leadSilence: sentRanges.length === 1 || prevEnd === undefined ? sFlu.speechStart : Math.min(1, Math.max(0, t0 - prevEnd)),
      });
      perSentence.push({ index: sr.index, words: idx.length, accuracy: sc.sentence.accuracy.predict(sx) * 10, fluency: sc.sentence.fluency.predict(sx) * 10, prosody: sc.sentence.prosody.predict(sx) * 10, total: sc.sentence.total.predict(sx) * 10 });
    }
    const scored = perSentence.filter((x): x is NonNullable<typeof x> => !!x);
    const wsum = scored.reduce((n, x) => n + x.words, 0) || 1;
    const avg = (k: 'accuracy' | 'fluency' | 'prosody' | 'total') => scored.reduce((n, x) => n + x[k] * x.words, 0) / wsum;
    const S = sc && scored.length
      ? { accuracy: avg('accuracy'), fluency: avg('fluency'), prosody: avg('prosody'), total: avg('total') }
      : { accuracy: mean(wordScore) * 10, fluency: 0, prosody: 0, total: mean(wordScore) * 10 };
    // The speechocean762 sentences are read completely; scale for omitted text in longer readings.
    const completenessFactor = 0.4 + 0.6 * (completeness / 100);
    const multiWord = pw.length > 1;

    // ---- build word / phone results ----
    const words: WordResult[] = [];
    for (let i = 0; i < pw.length; i++) {
      const w = pw[i];
      const ipa = await this.wordIpa(w.unit.word, w.unit.prons);
      const cw = ctcWords[i];
      const phones: PhoneResult[] = w.phones.map((p, pi) => this.phoneResult(p, phoneScore[i][pi], w.skipped, accent, cw?.phones[pi] ?? null, salientSub[i][pi]));
      const ws = Math.round(wordScore[i] * 10);
      const stressInfo = pro.stress.find((s) => s.index === i);
      const syl = syllabify(w.pron.phones);
      const notes: string[] = [];
      if (!w.skipped && accentEvidence(rhotic[i], accent)) {
        notes.push(accent === 'us' ? '你使用了英式读法（如不卷舌）。按美音目标练习时可注意卷舌 /r/。' : '你使用了美式读法（如卷舌 /r/）。按英音目标练习时句末/辅音前的 r 不发音。');
      }
      if (stressInfo && !stressInfo.correct && !timed[i].isFunction) {
        notes.push(`重音位置：应重读第 ${stressInfo.expectedIndex + 1} 个音节，你的第 ${stressInfo.detectedIndex + 1} 个音节更突出。`);
      }
      const epen = !w.skipped ? this.detectEpenthesis(w, pw[i + 1], post.logp, post.vocab, hop, accent) : null;
      if (epen) notes.push(`词尾多加了一个元音 /${epen.ipa}/，辅音结尾要干净利落，不要拖出 "呃" 音。`);
      words.push({
        index: i,
        tokenIndex: w.unit.token,
        text: tokens[w.unit.token].text,
        spoken: w.unit.word,
        start: round3(w.start),
        end: round3(w.end),
        skipped: w.skipped,
        isFunction: timed[i].isFunction,
        score: w.skipped ? 0 : ws,
        rating: w.skipped ? 'missing' : ws >= 80 ? 'good' : ws >= 60 ? 'fair' : 'poor',
        phones,
        pron: { arpa: w.pron.phones, source: w.pron.source, accent: w.pron.accent, matchesTarget: w.pron.accent === 'both' || w.pron.accent === accent },
        ipaUS: ipa.ipaUS,
        ipaUK: ipa.ipaUK,
        stress: stressInfo && syl.length > 1 ? { expected: stressInfo.expectedIndex, detected: stressInfo.detectedIndex, correct: stressInfo.correct, score: stressInfo.score, syllables: stressInfo.syllables } : undefined,
        pauseAfter: flu.pauses.find((p) => p.afterWord === i)?.duration,
        epenthesis: epen ?? undefined,
        heard: cw?.heardIpa ? formatEspeakIpa(cw.heardIpa) : undefined,
        notes,
      });
    }

    // ---- vowel formants (reference vowel chart) ----
    const speakerProfile: AssessmentResult['speakerProfile'] = pro.f0MedianHz > 0 ? (pro.f0MedianHz < 165 ? 'male' : 'female') : 'unknown';
    const vowels: VowelPoint[] = [];
    words.forEach((w) => {
      if (w.skipped) return;
      w.phones.forEach((p, pi) => {
        if (!isVowel(p.arpa) || p.end - p.start < 0.05 || PHONES[stripStress(p.arpa)]?.diphthong) return;
        const f = formants(audio, p.start, p.end);
        if (f) vowels.push({ word: w.index, phone: pi, arpa: stripStress(p.arpa), f1: Math.round(f.f1), f2: Math.round(f.f2), score: p.score });
      });
    });

    const stressScore = pro.stress.length ? Math.round(100 * pro.stressAccuracy) : null;
    const intoChecks = pro.intonation.filter((x) => x.detected !== 'unknown' && x.expected !== 'any');
    const intonationScore = intoChecks.length ? Math.round((100 * intoChecks.filter((x) => x.ok).length) / intoChecks.length) : null;
    const scores: AssessmentResult['scores'] = {
      accuracy: Math.round(S.accuracy),
      fluency: multiWord ? Math.round(S.fluency * Math.min(1, completenessFactor + 0.2)) : Math.round(S.fluency),
      completeness,
      prosody: Math.round(S.prosody),
      overall: Math.round(S.total * completenessFactor),
      stress: stressScore,
      intonation: intonationScore,
      rhythm: null,
    };

    const result: AssessmentResult = {
      schema: 'phonica.assessment/1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      text,
      accent,
      mode: req.mode,
      engine: {
        app: this.opts.appVersion,
        acousticModel: this.model.meta.model_id + ' (' + this.opts.modelName + ')',
        acousticRevision: this.model.meta.revision,
        scoring: sc ? sc.meta.trainedOn : 'uncalibrated (log posterior ratio)',
        scoringMetrics: sc ? sc.meta.metrics : {},
        analysisMs: 0,
      },
      audio: { durationSec: round3(durationSec), sampleRate: req.sampleRate, analysisRate: 16000 },
      scores,
      words,
      tokens: tokens.map((t) => ({ index: t.index, text: t.text, charStart: t.start, charEnd: t.end, punctAfter: t.punctAfter, sentence: t.sentence, words: units.map((u, i) => (u.token === t.index ? i : -1)).filter((i) => i >= 0) })),
      sentences: sentRanges.map((s) => {
        const ws = words.slice(s.firstWord, s.lastWord + 1);
        const live = ws.filter((w) => !w.skipped);
        const ps = perSentence[s.index];
        return {
          index: s.index, text: sentences[s.index].text, type: s.type, firstWord: s.firstWord, lastWord: s.lastWord, start: live[0]?.start ?? 0, end: live[live.length - 1]?.end ?? 0,
          score: ps ? Math.round(ps.total) : Math.round(mean(ws.map((w) => w.score))),
          scores: ps ? { accuracy: Math.round(ps.accuracy), fluency: Math.round(ps.fluency), prosody: Math.round(ps.prosody), total: Math.round(ps.total) } : undefined,
        };
      }),
      fluency: {
        speechStart: round3(flu.speechStart),
        speechEnd: round3(flu.speechEnd),
        speakingTime: round3(flu.speakingTime),
        articulationTime: round3(flu.articulationTime),
        wordsPerMinute: Math.round(flu.wordsPerMinute),
        syllablesPerSecond: round2(flu.syllablesPerSecond),
        articulationRate: round2(flu.articulationRate),
        pauseCount: flu.pauseCount,
        disfluentPauseCount: flu.disfluentPauseCount,
        longPauseCount: flu.longPauseCount,
        fillerCount: flu.fillerCount,
        pauseRatio: round3(flu.pauseRatio),
        meanLengthOfRun: round2(flu.meanLengthOfRun),
        longestPause: round3(flu.longestPause),
        pauses: flu.pauses.map((p) => ({ ...p, start: round3(p.start), end: round3(p.end), duration: round3(p.duration) })),
      },
      prosody: {
        f0MedianHz: pro.f0MedianHz,
        pitchRangeSt: pro.pitchRangeSt,
        pitchSdSt: pro.pitchSdSt,
        monotone: pro.monotone,
        nPVI: pro.nPVI,
        contentFunctionDiff: pro.contentFunctionDiff,
        stressAccuracy: round3(pro.stressAccuracy),
        intonation: pro.intonation,
      },
      recognized: rec.map((r) => {
        const arpa = this.model.labels[r.cls];
        return { arpa, ipa: phoneIpa(arpa, accent), start: round3(r.start * hop), end: round3(r.end * hop), conf: round2(r.conf) };
      }),
      vowels,
      speakerProfile,
      tracks: { hop: HOP_SEC, f0: Array.from(pitch.f0, (v) => Math.round(v)), energyDb: Array.from(energy, (v) => Math.round(v * 10) / 10) },
      issues: [],
      summary: { level: '', strengths: [], focus: [] },
    };
    result.issues = buildIssues(result, gaps.filter((g) => g.kind === 'filler'));
    result.summary = buildSummary(result);
    result.engine.analysisMs = Date.now() - t0;
    progress?.('done', 1);
    return result;
  }

  private phoneResult(p: { arpa: string; start: number; end: number; ev: PhoneEvidence | null }, pred: number, skipped: boolean, accent: Accent, ctc: { gop: number; delMargin: number; alt: string; peak: number } | null, salient: 'both' | 'ctc' | null = null): PhoneResult {
    const base = stripStress(p.arpa);
    const ipa = phoneIpa(p.arpa, accent);
    if (skipped || !p.ev) {
      return { arpa: p.arpa, ipa, start: -1, end: -1, score: 0, rating: 'missing', gop: { lpp: -20, lpr: -20, frameAcc: 0, margin: -20, silFrac: 1 }, error: { type: 'deletion', advice: `整个单词没有读出来。${PHONES[base]?.tip ?? ''}` } };
    }
    const ev = p.ev;
    const score = Math.round(pred * 50);
    // closest competitor: CTC alternative when the verifier prefers it, else the aligner's
    const fcComp = ev.competitor >= 0 ? this.model.labels[ev.competitor] : '';
    const useCtc = ctc && ctc.alt && ctc.alt !== 'DEL' && ctc.gop < 1;
    const comp = useCtc ? ctc!.alt : fcComp;
    const compIpa = comp ? phoneIpa(comp + (isVowel(comp) ? '1' : ''), accent) : '';
    const r: PhoneResult = {
      arpa: p.arpa,
      ipa,
      start: round3(p.start),
      end: round3(p.end),
      score,
      rating: score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor',
      gop: { lpp: round2(ev.lpp), lpr: round2(ev.lpr), frameAcc: round2(ev.frameAcc), margin: round2(ev.margin), silFrac: round2(ev.silFrac), ...(ctc ? { ctc: round2(ctc.gop), ctcDel: round2(ctc.delMargin), ctcPeak: round2(ctc.peak) } : {}) },
    };
    if (comp) r.closest = { arpa: comp, ipa: compIpa, margin: round2(useCtc ? ctc!.gop : ev.margin) };
    const deleted = (ctc ? ctc.alt === 'DEL' && ctc.gop < -1 : false) || ev.silFrac >= 0.6 || (ev.frames <= 3 && ev.lpr < -4);
    // thresholds chosen on held-out speechocean762 training speakers; on the test set
    // < 60 flags ~4 % of phones (61 % of them rated wrong by the experts), < 80 ~10 %
    if (salient && ctc) {
      const basis = salient === 'both' ? `两个独立的声学模型都把这个音听成了 /${compIpa}/。` : `音素识别模型明确把这个音听成了 /${compIpa}/。`;
      r.error = { type: 'substitution', heard: ctc.alt, heardIpa: compIpa, ...(salient === 'both' ? { confirmed: true } : {}), advice: basis + substitutionAdvice(base, ctc.alt) };
    } else if (score < 80) {
      if (deleted && score < 60) {
        r.error = { type: 'deletion', advice: `/${ipa}/ 几乎没有发出来（漏音）。${PHONES[base]?.tip ?? ''}` };
        if (score < 40) r.rating = 'missing';
      } else if (comp && ((useCtc && ctc!.gop < 0) || (!useCtc && ev.margin < 0))) {
        r.error = { type: 'substitution', heard: comp, heardIpa: compIpa, advice: substitutionAdvice(base, comp) };
      } else if (score < 60) {
        r.error = { type: 'distortion', advice: `/${ipa}/ 发音不够准确。${PHONES[base]?.tip ?? ''}` };
      }
    }
    return r;
  }

  /** Extra vowel after a word-final consonant ("bed-uh"), from frame arg-max evidence. */
  private detectEpenthesis(w: { phones: Array<{ arpa: string; start: number; end: number }>; end: number }, next: { start: number; skipped: boolean } | undefined, logp: Float32Array, vocab: number, hop: number, accent: Accent) {
    const last = w.phones[w.phones.length - 1];
    if (!last || isVowel(last.arpa) || last.start < 0) return null;
    const a = Math.round(((last.start + last.end) / 2) / hop);
    const limit = next && !next.skipped && next.start > 0 ? next.start : last.end + 0.2;
    const b = Math.round(Math.min(limit, last.end + 0.2) / hop);
    let run = 0;
    let best = 0;
    let bestEnd = 0;
    let bestCls = -1;
    for (let t = a; t < b && t * vocab < logp.length; t++) {
      const o = t * vocab;
      let mx = -Infinity;
      let arg = -1;
      for (const c of this.phoneIds) if (logp[o + c] > mx) { mx = logp[o + c]; arg = c; }
      if (logp[o + this.silId] > mx) { run = 0; continue; }
      const lab = this.model.labels[arg];
      if (ERROR_LIKE.has(lab) && mx > Math.log(0.5)) {
        run++;
        if (run > best) { best = run; bestEnd = t + 1; bestCls = arg; }
      } else run = 0;
    }
    const minRun = Math.round(0.05 / hop);
    if (best < minRun) return null;
    const lab = this.model.labels[bestCls];
    return { ipa: phoneIpa(lab + '0', accent), start: round3((bestEnd - best) * hop), end: round3(bestEnd * hop) };
  }
}

/**
 * Only report an accent mismatch when it is audible: for a British target the
 * r-coloured realisation must be clearly more likely than the non-rhotic one
 * (and the reverse for an American target).
 */
function accentEvidence(rhoticPref: number | null, target: Accent): boolean {
  if (rhoticPref === null) return false;
  return target === 'uk' ? rhoticPref > 3 : rhoticPref < -3;
}

function isLastUnitOfToken(units: Array<{ token: number }>, i: number): boolean {
  return i + 1 >= units.length || units[i + 1].token !== units[i].token;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

// ---------------- diagnostics ----------------

function buildIssues(r: AssessmentResult, fillers: Array<{ start: number; end: number }>): Issue[] {
  const issues: Issue[] = [];
  // phoneme errors grouped by pattern
  const groups = new Map<string, { exp: string; expArpa: string; heard?: string; type: string; words: Set<number>; worst: number; advice: string; time: number }>();
  for (const w of r.words) {
    if (w.skipped) continue;
    for (const p of w.phones) {
      if (!p.error || p.rating === 'good') continue;
      const exp = stripStress(p.arpa);
      const key = `${exp}>${p.error.heard ?? p.error.type}`;
      const g = groups.get(key) ?? { exp, expArpa: p.arpa, heard: p.error.heard, type: p.error.type, words: new Set<number>(), worst: 100, advice: p.error.advice, time: p.start };
      g.words.add(w.index);
      g.worst = Math.min(g.worst, p.score);
      groups.set(key, g);
    }
  }
  for (const g of [...groups.values()].sort((a, b) => b.words.size - a.words.size || a.worst - b.worst)) {
    const ipa = phoneIpa(g.expArpa, r.accent);
    const wordsTxt = [...g.words].slice(0, 6).map((i) => r.words[i].text).join('、');
    const e = phoneIpa(g.expArpa, r.accent);
    const title = g.type === 'substitution' && g.heard ? `/${e}/ 读得像 /${phoneIpa(g.heard + (isVowel(g.heard) ? '1' : ''), r.accent)}/` : g.type === 'deletion' ? `/${e}/ 漏读或过弱` : `/${e}/ 发音不准确`;
    issues.push({ severity: g.worst < 40 || g.words.size >= 3 ? 'high' : g.worst < 60 ? 'medium' : 'low', category: 'phoneme', title, detail: `出现在：${wordsTxt}。${g.advice}`, words: [...g.words], phone: ipa, time: g.time });
  }
  const skipped = r.words.filter((w) => w.skipped);
  if (skipped.length) issues.push({ severity: skipped.length > 2 ? 'high' : 'medium', category: 'omission', title: `漏读了 ${skipped.length} 个单词`, detail: `未检测到：${skipped.slice(0, 10).map((w) => w.text).join('、')}${skipped.length > 10 ? ' 等' : ''}。请对照原文完整朗读。`, words: skipped.map((w) => w.index) });
  const epen = r.words.filter((w) => w.epenthesis);
  if (epen.length) issues.push({ severity: epen.length >= 3 ? 'medium' : 'low', category: 'insertion', title: '辅音结尾后多加了元音', detail: `例如：${epen.slice(0, 6).map((w) => w.text).join('、')}。英语单词常以辅音结尾，收尾时直接停住，不要加 "呃/ə"。`, words: epen.map((w) => w.index) });
  const longFillers = fillers.filter((f) => f.end - f.start >= 0.25 && f.start > r.fluency.speechStart && f.end < r.fluency.speechEnd);
  if (longFillers.length) issues.push({ severity: 'medium', category: 'insertion', title: `检测到 ${longFillers.length} 处多余的声音`, detail: '朗读中出现了原文之外的声音（如 "嗯、呃"、重复或多读的词）。', time: longFillers[0].start });

  const badStress = r.words.filter((w) => w.stress && !w.stress.correct && !w.isFunction && !w.skipped);
  if (badStress.length) {
    issues.push({ severity: badStress.length >= 3 ? 'medium' : 'low', category: 'stress', title: `${badStress.length} 个多音节词的重音可能不在正确音节`, detail: badStress.slice(0, 6).map((w) => `${w.text}（应重读第 ${w.stress!.expected + 1} 音节）`).join('、') + '：录音中另一个音节明显更突出。重读音节要更响、更长、音高更突出，非重读音节弱化。', words: badStress.map((w) => w.index) });
  }
  for (const it of r.prosody.intonation) {
    if (it.ok || it.detected === 'unknown') continue;
    const s = r.sentences[it.sentence];
    const want = it.expected === 'rise' ? '上扬（升调）' : '下降（降调）';
    const got = it.detected === 'rise' ? '上扬' : it.detected === 'fall' ? '下降' : '平直';
    const kind = it.type === 'yes-no-question' ? '一般疑问句' : it.type === 'wh-question' ? '特殊疑问句' : it.type === 'exclamation' ? '感叹句' : '陈述句';
    issues.push({ severity: 'medium', category: 'intonation', title: `句尾语调：${kind}结尾应${want}`, detail: `“${s?.text.slice(0, 60) ?? ''}” 结尾音高${got}（变化 ${it.slopeSt} 个半音）。`, time: s?.end });
  }
  if (r.prosody.monotone) issues.push({ severity: 'medium', category: 'intonation', title: '语调平淡', detail: `音高变化范围只有 ${r.prosody.pitchRangeSt} 个半音（自然朗读通常在 5–12 个半音）。重读词适当提高音调，句末自然下降。` });
  const f = r.fluency;
  const disfl = f.pauses.filter((p) => p.disfluent && p.kind !== 'boundary');
  if (disfl.length) issues.push({ severity: disfl.length >= 3 ? 'high' : 'medium', category: 'fluency', title: `${disfl.length} 处不自然的停顿`, detail: disfl.slice(0, 5).map((p) => `“${r.words[p.afterWord]?.text}” 之后停顿 ${p.duration.toFixed(2)} 秒`).join('；') + '。意群内部应连贯，停顿放在标点或意群边界。', time: disfl[0].start, words: disfl.map((p) => p.afterWord) });
  if (r.words.length >= 5 && f.speakingTime > 1.5) {
    if (f.articulationRate < 2.8) issues.push({ severity: f.articulationRate < 2.2 ? 'medium' : 'low', category: 'rate', title: '语速偏慢', detail: `发音速度 ${f.articulationRate.toFixed(1)} 音节/秒（${f.wordsPerMinute} 词/分）。母语者朗读通常为 4–5.5 音节/秒，可先保证准确，再逐步加快并练习连读。` });
    else if (f.articulationRate > 6.2) issues.push({ severity: 'low', category: 'rate', title: '语速偏快', detail: `发音速度 ${f.articulationRate.toFixed(1)} 音节/秒，可能影响清晰度。` });
  }
  if (r.words.length >= 12 && r.prosody.contentFunctionDiff < 0.15) issues.push({ severity: 'low', category: 'rhythm', title: '节奏偏平均', detail: `实词与虚词的突显度差异较小（${r.prosody.contentFunctionDiff}）。英语是重音计时语言：实词重读，冠词、介词、代词等功能词要弱读、读得更轻更短。` });
  const accentNotes = r.words.filter((w) => !w.skipped && w.notes.some((n) => n.includes('读法')));
  if (accentNotes.length) issues.push({ severity: 'low', category: 'accent', title: r.accent === 'us' ? '部分单词使用了英式读法' : '部分单词使用了美式读法', detail: `${accentNotes.slice(0, 6).map((w) => w.text).join('、')}。这不算发音错误，只是与所选目标口音不一致。`, words: accentNotes.map((w) => w.index) });
  const rank = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function buildSummary(r: AssessmentResult): AssessmentResult['summary'] {
  const o = r.scores.overall;
  const level = o >= 90 ? '优秀' : o >= 80 ? '良好' : o >= 70 ? '中等' : o >= 60 ? '及格' : '需加强';
  const strengths: string[] = [];
  const focus: string[] = [];
  if (r.scores.accuracy >= 85) strengths.push('单词发音准确');
  if (r.scores.fluency >= 85 && r.words.length > 3) strengths.push('朗读流利');
  if (r.scores.completeness >= 98 && r.words.length > 3) strengths.push('朗读完整');
  if (r.scores.stress !== null && r.scores.stress >= 85) strengths.push('单词重音正确');
  if (r.scores.intonation !== null && r.scores.intonation >= 99) strengths.push('句尾语调正确');
  const good = r.words.filter((w) => w.rating === 'good').length;
  if (r.words.length > 3 && good / r.words.length > 0.8) strengths.push(`${good}/${r.words.length} 个单词发音良好`);
  for (const i of r.issues.slice(0, 4)) focus.push(i.title);
  return { level, strengths: strengths.slice(0, 4), focus };
}
