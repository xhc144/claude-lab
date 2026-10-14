// Downloads the ONNX models into ./models and verifies their SHA-256.
// The wav2vec2 models are exported by .github/workflows/phonica-models.yml.
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'models');
mkdirSync(out, { recursive: true });
const REL = 'https://github.com/xhc144/claude-lab/releases/download/phonica-models-v1';
const FILES = [
  { name: 'en_w2v2_fc_10ms.json', url: `${REL}/en_w2v2_fc_10ms.json` },
  { name: 'w2v2_lv60_espeak_cv_ft.json', url: `${REL}/w2v2_lv60_espeak_cv_ft.json` },
  { name: 'en_w2v2_fc_10ms.int8.onnx', url: `${REL}/en_w2v2_fc_10ms.int8.onnx`, meta: 'en_w2v2_fc_10ms.json' },
  { name: 'w2v2_lv60_espeak_cv_ft.int8.onnx', url: `${REL}/w2v2_lv60_espeak_cv_ft.int8.onnx`, meta: 'w2v2_lv60_espeak_cv_ft.json' },
  { name: 'kokoro-v1.0.int8.onnx', url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx', sha256: '6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb' },
];

function sha256(path) {
  const h = createHash('sha256');
  h.update(readFileSync(path));
  return h.digest('hex');
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const tmp = dest + '.part';
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      renameSync(tmp, dest);
      return;
    } catch (e) {
      if (attempt === 4) throw e;
      console.warn(`retry ${attempt} ${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

for (const f of FILES) {
  const dest = join(out, f.name);
  let expected = f.sha256;
  if (f.meta) expected = JSON.parse(readFileSync(join(out, f.meta), 'utf8')).files[f.name].sha256;
  if (existsSync(dest) && (!expected || sha256(dest) === expected)) {
    console.log(`ok      ${f.name}`);
    continue;
  }
  process.stdout.write(`fetch   ${f.name} … `);
  await download(f.url, dest);
  if (expected && sha256(dest) !== expected) throw new Error(`checksum mismatch for ${f.name}`);
  console.log(`${(statSync(dest).size / 1e6).toFixed(1)} MB`);
}
console.log('models ready in', out);
