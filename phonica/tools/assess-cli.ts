// Command-line front-end to the assessment engine (development & CI checks).
// usage: assess-cli.ts <audio.wav> "<reference text>" [us|uk] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import * as ort from 'onnxruntime-node';
import { Engine } from '../src/engine/assess.ts';
import { decodeWav } from '../src/engine/wav.ts';

const args = process.argv.slice(2);
const [wavPath, text] = args;
const accent = (args[2] === 'uk' ? 'uk' : 'us') as 'us' | 'uk';
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const modelDir = process.env.PHONICA_MODELS ?? 'models';
const modelName = process.env.PHONICA_MODEL ?? 'en_w2v2_fc_10ms.int8';
const engine = new Engine({
  ort, modelPath: `${modelDir}/${modelName}.onnx`, modelMetaPath: `${modelDir}/${modelName.replace(/\.(int8|fp32)$/, '')}.json`, modelName,
  verifierPath: `${modelDir}/w2v2_lv60_espeak_cv_ft.int8.onnx`, verifierMetaPath: `${modelDir}/w2v2_lv60_espeak_cv_ft.json`,
  lexiconDir: 'resources/lexicon', scoringDir: 'resources/scoring', appVersion: 'cli',
});
await engine.init();
const wav = decodeWav(readFileSync(wavPath));
const r = await engine.assess({ text, accent, mode: 'sentence', samples: wav.samples, sampleRate: wav.sampleRate });
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(r, null, 1));
console.log(`overall ${r.scores.overall} | accuracy ${r.scores.accuracy} fluency ${r.scores.fluency} completeness ${r.scores.completeness} prosody ${r.scores.prosody} stress ${r.scores.stress} intonation ${r.scores.intonation} | ${r.engine.analysisMs} ms`);
for (const w of r.words) {
  const ph = w.phones.map((p) => `${p.ipa}${p.error ? `!${p.error.type[0]}${p.error.heardIpa ? '→' + p.error.heardIpa : ''}` : ''}:${p.score}`).join(' ');
  console.log(`  ${w.text.padEnd(12)} ${String(w.score).padStart(3)} ${w.skipped ? 'SKIPPED' : ''} [${ph}] ${w.start.toFixed(2)}-${w.end.toFixed(2)} ${w.notes.join(' ')}`);
}
console.log(`  rate ${r.fluency.wordsPerMinute} wpm, artic ${r.fluency.articulationRate} syl/s, pauses ${r.fluency.pauseCount}, f0 ${r.prosody.f0MedianHz}Hz range ${r.prosody.pitchRangeSt}st, intonation ${JSON.stringify(r.prosody.intonation.map((i) => [i.expected, i.detected, i.slopeSt]))}`);
for (const i of r.issues) console.log(`  [${i.severity}] ${i.title} — ${i.detail.slice(0, 140)}`);
