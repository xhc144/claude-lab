// Generates the self-test recordings (synthetic speech) used by --self-test and
// the engine tests. sink.wav has two controlled substitutions made at the
// phoneme level: /θ/→/s/ in "think" and /v/→/w/ in "very".
import * as ort from 'onnxruntime-node';
import { writeFileSync } from 'node:fs';
import { Tts, TTS_SAMPLE_RATE } from '../src/engine/tts.ts';
import { encodeWav } from '../src/engine/wav.ts';
const tts = new Tts(ort, 'models/kokoro-v1.0.int8.onnx', 'resources/tts');
const text = 'I think the weather is very nice today.';
console.log('phonemes:', await tts.phonemes(text, 'us'));
const good = await tts.synthesize(text, 'af_heart', 1);
writeFileSync('resources/selftest/think.wav', encodeWav(good, TTS_SAMPLE_RATE, 16));
const bad = await tts.synthesize(text, 'af_heart', 1, (p) => {
  const q = p.replace('θˈɪŋk', 'sˈɪŋk').replace('vˈɛɹi', 'wˈɛɹi');
  if (q === p) throw new Error('substitution targets not found in ' + p);
  console.log('substituted:', q);
  return q;
});
writeFileSync('resources/selftest/sink.wav', encodeWav(bad, TTS_SAMPLE_RATE, 16));
