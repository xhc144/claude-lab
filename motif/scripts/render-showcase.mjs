#!/usr/bin/env node
// Renders every document in examples/showcase/ through the real pipeline (create → lint →
// contact sheet → MP4) into out/showcase/. Uses a throwaway library unless --library is given.
//   node scripts/render-showcase.mjs [--only 01] [--quality high|standard|small] [--library dir]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const cli = path.join(root, 'dist/cli.mjs');
if (!fs.existsSync(cli)) execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
const lib = arg('library') ? path.resolve(arg('library')) : fs.mkdtempSync(path.join(os.tmpdir(), 'motif-showcase-'));
const out = path.join(root, 'out/showcase');
fs.mkdirSync(out, { recursive: true });
const env = { ...process.env, MOTIF_HOME: lib };
const run = (...a) => JSON.parse(execFileSync(process.execPath, [cli, ...a, '--json'], { env, encoding: 'utf8', maxBuffer: 64 << 20 }));
const only = arg('only');
const files = fs.readdirSync(path.join(root, 'examples/showcase')).filter((f) => f.endsWith('.json') && (!only || f.startsWith(only))).sort();
for (const f of files) {
  const name = path.basename(f, '.json');
  const t0 = Date.now();
  const p = run('new', '--from', path.join(root, 'examples/showcase', f), '--agent', 'showcase');
  const lint = run('lint', p.id);
  run('preview', p.id, '--out', path.join(out, `${name}.jpg`), '--scale', '0.4');
  const v = run('export', p.id, '--format', 'mp4', '--quality', arg('quality', 'high'), '--out', path.join(out, `${name}.mp4`));
  console.log(`${name}: ${p.scenes} 场景 · lint ${lint.counts.error}E/${lint.counts.warning}W · ${v.duration?.toFixed(1)}s 成片 · ${(v.bytes / 1e6).toFixed(1)} MB · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log('→', path.relative(root, out));
