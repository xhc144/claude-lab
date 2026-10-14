#!/usr/bin/env node
// Builds every bundle with esbuild:
//   dist/render.js    engine runtime (browser, IIFE)       → render worker, player, tests
//   dist/editor.js    editor UI (browser, React)
//   dist/main.cjs     Electron main process
//   dist/preload.cjs  Electron preload bridge
//   dist/cli.mjs      motif CLI + MCP server (Node)
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const watch = process.argv.includes('--watch');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)?.split(',');
const prod = !watch;

if (!fs.existsSync(path.join(root, 'src/generated/icons.json')) || !fs.existsSync(path.join(dist, 'fonts/fonts.css'))) {
  execFileSync(process.execPath, [path.join(root, 'scripts/gen-assets.mjs')], { stdio: 'inherit' });
}
fs.mkdirSync(dist, { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'static'))) fs.cpSync(path.join(root, 'static', f), path.join(dist, f), { recursive: true });

// pdf.js runs in Node for PDF import; ship its two module files next to the CLI.
const pdfSrc = path.join(root, 'node_modules/pdfjs-dist/legacy/build');
if (fs.existsSync(pdfSrc)) {
  fs.mkdirSync(path.join(dist, 'vendor/pdfjs'), { recursive: true });
  for (const f of ['pdf.mjs', 'pdf.worker.mjs']) fs.copyFileSync(path.join(pdfSrc, f), path.join(dist, 'vendor/pdfjs', f));
}

const define = { __VERSION__: JSON.stringify(pkg.version), 'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development') };
const common = { bundle: true, sourcemap: prod ? false : 'inline', minify: prod, legalComments: 'none', logLevel: 'warning', define, loader: { '.json': 'json' } };

const targets = {
  render: { ...common, entryPoints: [path.join(root, 'src/engine/runtime.js')], outfile: path.join(dist, 'render.js'), format: 'iife', platform: 'browser', target: 'chrome120' },
  editor: { ...common, entryPoints: [path.join(root, 'src/app/renderer/main.jsx')], outfile: path.join(dist, 'editor.js'), format: 'iife', platform: 'browser', target: 'chrome120', jsx: 'automatic', loader: { ...common.loader, '.css': 'css', '.woff2': 'file' } },
  main: { ...common, entryPoints: [path.join(root, 'src/app/main/index.js')], outfile: path.join(dist, 'main.cjs'), format: 'cjs', platform: 'node', target: 'node22', external: ['electron'] },
  preload: { ...common, entryPoints: [path.join(root, 'src/app/preload/index.js')], outfile: path.join(dist, 'preload.cjs'), format: 'cjs', platform: 'node', target: 'node22', external: ['electron'] },
  workerPreload: { ...common, entryPoints: [path.join(root, 'src/app/worker/preload.js')], outfile: path.join(dist, 'worker-preload.cjs'), format: 'cjs', platform: 'node', target: 'node22', external: ['electron'] },
  cli: { ...common, minify: false, entryPoints: [path.join(root, 'src/cli/index.js')], outfile: path.join(dist, 'cli.mjs'), format: 'esm', platform: 'node', target: 'node22', banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }, external: ['electron'] },
};

const selected = Object.entries(targets).filter(([k]) => (only ? only.includes(k) : true)).filter(([, cfg]) => fs.existsSync(cfg.entryPoints[0]));
const t0 = Date.now();
if (watch) {
  for (const [name, cfg] of selected) { const ctx = await context(cfg); await ctx.watch(); console.log('watching', name); }
} else {
  await Promise.all(selected.map(([, cfg]) => build(cfg)));
  console.log(`built ${selected.map(([k]) => k).join(', ')} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
