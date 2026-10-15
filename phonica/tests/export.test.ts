import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildExport, encodeMp3, estimateMp3Bytes, validBitrate } from '../src/main/exporter.ts';
import { textReport, analysisPrompt } from '../src/shared/report.ts';
import type { AssessmentResult } from '../src/shared/types.ts';

function fakeResult(): AssessmentResult {
  const phones = [{ arpa: 'TH', ipa: 'θ', start: 0.3, end: 0.38, score: 30, rating: 'poor' as const, gop: { lpp: -3, lpr: -2.5, frameAcc: 0.1, margin: -1, silFrac: 0, ctc: -4 }, error: { type: 'substitution' as const, heard: 'S', heardIpa: 's', advice: 'x' } }];
  return {
    schema: 'phonica.assessment/1', id: '00000000-0000-4000-8000-000000000000', createdAt: '2026-10-14T00:00:00.000Z', text: 'think', accent: 'us', mode: 'word',
    engine: { app: 't', acousticModel: 'm', acousticRevision: null, scoring: 's', scoringMetrics: {}, analysisMs: 1 },
    audio: { durationSec: 2, sampleRate: 48000, analysisRate: 16000 },
    scores: { overall: 60, accuracy: 55, fluency: 70, completeness: 100, prosody: 65, stress: null, intonation: null, rhythm: null },
    words: [{ index: 0, tokenIndex: 0, text: 'think', spoken: 'think', start: 0.3, end: 0.7, skipped: false, isFunction: false, score: 55, rating: 'poor', phones, pron: { arpa: ['TH', 'IH1', 'NG', 'K'], source: 'cmudict', accent: 'both', matchesTarget: true }, ipaUS: 'θɪŋk', ipaUK: 'θɪŋk', notes: [] }],
    tokens: [{ index: 0, text: 'think', charStart: 0, charEnd: 5, punctAfter: '', sentence: 0, words: [0] }],
    sentences: [{ index: 0, text: 'think', type: 'fragment', firstWord: 0, lastWord: 0, start: 0.3, end: 0.7, score: 55 }],
    fluency: { speechStart: 0.3, speechEnd: 0.7, speakingTime: 0.4, articulationTime: 0.4, wordsPerMinute: 150, syllablesPerSecond: 2.5, articulationRate: 2.5, pauseCount: 0, disfluentPauseCount: 0, longPauseCount: 0, fillerCount: 0, pauseRatio: 0, meanLengthOfRun: 1, longestPause: 0, pauses: [] },
    prosody: { f0MedianHz: 180, pitchRangeSt: 4, pitchSdSt: 1, monotone: false, nPVI: 0, contentFunctionDiff: 0, stressAccuracy: 1, intonation: [] },
    recognized: [], vowels: [], speakerProfile: 'female', tracks: { hop: 0.01, f0: [], energyDb: [] },
    issues: [{ severity: 'high', category: 'phoneme', title: '/θ/ 读得像 /s/', detail: 'd' }], summary: { level: '需加强', strengths: [], focus: [] },
  };
}

test('MP3 encoding hits the requested bit-rate', () => {
  const sr = 48000;
  const x = new Float32Array(sr * 3);
  for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / sr) + 0.05 * Math.sin(i);
  const m = encodeMp3(x, sr, 64, 24000);
  assert.equal(m.sampleRate, 24000);
  assert.equal(m.kbps, 64);
  const est = estimateMp3Bytes(3, 64, 24000);
  assert.ok(Math.abs(m.data.length - est) / est < 0.1, `${m.data.length} vs ${est}`);
  assert.equal(m.data[0], 0xff); // frame sync
  assert.equal(validBitrate(16000, 192), 160);
});

test('ZIP export contains audio, report, JSON with full analysis and prompt', () => {
  const r = fakeResult();
  const x = new Float32Array(48000 * 2);
  const out = buildExport(r, x, 48000, { kind: 'zip', bitrate: 64, sampleRate: 24000, includeReference: false });
  assert.equal(out.files.length, 1);
  const files = unzipSync(out.files[0].data);
  for (const f of ['recording.mp3', 'report.md', 'analysis.json', 'prompt.md', 'reference.txt', 'README.txt']) assert.ok(files[f], `missing ${f}`);
  const json = JSON.parse(strFromU8(files['analysis.json']));
  assert.equal(json.assessment.words[0].phones[0].error.heardIpa, 's');
  assert.equal(json.audio.bitrate, 64);
  assert.ok(json.schema_notes.scores);
  const report = strFromU8(files['report.md']);
  assert.match(report, /逐词分析/);
  assert.match(report, /\/θ\/ \(TH\) \| 替换 \| \/s\//);
});

test('prompts state whether the AI hears the audio', () => {
  const r = fakeResult();
  assert.match(analysisPrompt(r, { withAudio: true, language: 'zh', forExport: false }), /【听音】/);
  assert.match(analysisPrompt(r, { withAudio: false, language: 'zh', forExport: false }), /未直接听取录音/);
  assert.match(textReport(r), /总体评分/);
});
