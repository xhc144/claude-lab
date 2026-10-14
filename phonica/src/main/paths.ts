// Locations of bundled resources (models, lexicon, voices) in development and
// in the packaged app.
import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ResourcePaths {
  models: string;
  lexicon: string;
  tts: string;
  scoring: string;
  materials: string;
}

export function resourcePaths(): ResourcePaths {
  const packaged = app.isPackaged;
  const base = packaged ? process.resourcesPath : app.getAppPath();
  const res = join(base, 'resources');
  const devModels = process.env.PHONICA_MODELS && existsSync(process.env.PHONICA_MODELS) ? process.env.PHONICA_MODELS : join(base, 'models');
  return {
    models: packaged ? join(base, 'models') : devModels,
    lexicon: join(res, 'lexicon'),
    tts: join(res, 'tts'),
    scoring: join(res, 'scoring'),
    materials: join(res, 'materials'),
  };
}

export const MODEL_FILES = {
  aligner: 'en_w2v2_fc_10ms.int8',
  verifier: 'w2v2_lv60_espeak_cv_ft.int8',
  tts: 'kokoro-v1.0.int8.onnx',
};
