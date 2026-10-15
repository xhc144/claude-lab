// Electron utility process that hosts the speech engine (ONNX models, espeak
// WebAssembly, DSP). Keeping it out of the main process keeps the UI smooth
// and isolates native-code failures.
import * as ort from 'onnxruntime-node';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Engine } from '../engine/assess.ts';
import { Tts, TTS_SAMPLE_RATE } from '../engine/tts.ts';
import { resample } from '../engine/wav.ts';
import { frameEnergyDb, pitchYin } from '../engine/dsp.ts';
import type { Accent } from '../shared/types.ts';

interface InitMsg {
  models: string;
  lexicon: string;
  tts: string;
  scoring: string;
  aligner: string;
  verifier: string;
  ttsModel: string;
  appVersion: string;
}

type Req = { id: number; type: string; payload: any };

const port = (process as any).parentPort as { on: (e: 'message', cb: (m: { data: Req }) => void) => void; postMessage: (m: unknown) => void };

let engine: Engine | null = null;
let tts: Tts | null = null;
let initError: string | null = null;
let config: InitMsg | null = null;

function reply(id: number, ok: boolean, result: unknown) {
  port.postMessage({ id, ok, ...(ok ? { result } : { error: result }) });
}

async function init(c: InitMsg) {
  config = c;
  try {
    const threads = Math.max(1, Math.min(8, (await import('node:os')).cpus().length));
    engine = new Engine({
      ort,
      modelPath: join(c.models, `${c.aligner}.onnx`),
      modelMetaPath: join(c.models, `${c.aligner.replace(/\.(int8|fp32)$/, '')}.json`),
      modelName: c.aligner,
      verifierPath: existsSync(join(c.models, `${c.verifier}.onnx`)) ? join(c.models, `${c.verifier}.onnx`) : undefined,
      verifierMetaPath: join(c.models, `${c.verifier.replace(/\.(int8|fp32)$/, '')}.json`),
      lexiconDir: c.lexicon,
      scoringDir: c.scoring,
      appVersion: c.appVersion,
      threads,
    });
    await engine.init();
    const ttsPath = join(c.models, c.ttsModel);
    if (existsSync(ttsPath)) tts = new Tts(ort, ttsPath, c.tts);
    return { ready: true, calibrated: engine.calibrated, scoring: engine.scoringMeta, tts: !!tts, verifier: engine.hasVerifier };
  } catch (e) {
    initError = (e as Error).message;
    throw e;
  }
}

async function handle(m: Req) {
  const { id, type, payload } = m;
  try {
    switch (type) {
      case 'init':
        return reply(id, true, await init(payload));
      case 'status':
        return reply(id, true, { ready: !!engine, error: initError, calibrated: engine?.calibrated ?? false, scoring: engine?.scoringMeta ?? null, tts: !!tts, verifier: engine?.hasVerifier ?? false });
      case 'assess': {
        if (!engine) throw new Error(initError ?? '评测引擎尚未就绪');
        const samples = new Float32Array(payload.samples);
        const r = await engine.assess({ text: payload.text, accent: payload.accent, mode: payload.mode, samples, sampleRate: payload.sampleRate }, (stage, frac) => port.postMessage({ id, progress: { stage, frac } }));
        return reply(id, true, r);
      }
      case 'lookup':
        if (!engine) throw new Error('评测引擎尚未就绪');
        return reply(id, true, await engine.lookup(payload.word));
      case 'textIpa':
        if (!engine) throw new Error('评测引擎尚未就绪');
        return reply(id, true, await engine.textIpa(payload.text, payload.accent as Accent));
      case 'tts': {
        if (!tts) throw new Error('语音合成模型未安装');
        const audio = await tts.synthesize(payload.text, payload.voice, payload.speed ?? 1);
        let words: Array<{ text: string; start: number; end: number }> = [];
        let f0: number[] = [];
        if (payload.align && engine) {
          // align the reference with the same engine so single words can be replayed,
          // and measure its pitch for intonation comparison
          const a16 = resample(audio, TTS_SAMPLE_RATE, 16000);
          try {
            words = await engine.alignOnly(payload.text, a16, payload.voice.startsWith('b') ? 'uk' : 'us');
          } catch {
            words = [];
          }
          f0 = Array.from(pitchYin(a16, frameEnergyDb(a16, 16000)).f0, (v) => Math.round(v));
        }
        return reply(id, true, { samples: audio, sampleRate: TTS_SAMPLE_RATE, words, f0 });
      }
      default:
        throw new Error(`unknown request ${type}`);
    }
  } catch (e) {
    reply(id, false, { message: (e as Error).message, code: (e as any).code ?? 'error' });
  }
}

// Requests are processed one at a time; the models are not re-entrant.
let chain: Promise<void> = Promise.resolve();
port.on('message', (e) => {
  chain = chain.then(() => handle(e.data)).catch(() => undefined);
});
void config;
