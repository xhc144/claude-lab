#!/usr/bin/env node
// Build the site into dist/: one classic (IIFE) script + one stylesheet + fonts.
// A classic script (not an ES module) is what lets dist/index.html open straight from disk (file://)
// as well as from any static host such as GitHub Pages.
//
//   node scripts/build.mjs                 one-off production build
//   node scripts/build.mjs --watch --serve rebuild on change and serve dist/ on http://127.0.0.1:5180

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const args = new Set(process.argv.slice(2));
const watch = args.has('--watch');
const serve = args.has('--serve');

// KaTeX ships every font as woff2 + woff + ttf. Every browser we target reads woff2,
// so drop the other two formats instead of copying ~60 files into dist/.
const katexWoff2Only = {
  name: 'katex-woff2-only',
  setup(build) {
    build.onLoad({ filter: /katex(\.min)?\.css$/ }, (args) => {
      const css = readFileSync(args.path, 'utf8')
        .replace(/,\s*url\([^)]*\.woff\)\s*format\("woff"\)/g, '')
        .replace(/,\s*url\([^)]*\.ttf\)\s*format\("truetype"\)/g, '');
      return { contents: css, loader: 'css' };
    });
  },
};

function copyStatic() {
  mkdirSync(DIST, { recursive: true });
  const html = readFileSync(join(ROOT, 'src/index.html'), 'utf8');
  writeFileSync(join(DIST, 'index.html'), html);
  for (const f of readdirSync(join(ROOT, 'src/public'))) copyFileSync(join(ROOT, 'src/public', f), join(DIST, f));
}

const options = {
  entryPoints: { app: join(ROOT, 'src/main.js') },
  bundle: true,
  format: 'iife',
  target: ['es2020', 'chrome99', 'firefox112', 'safari16'],
  outdir: join(DIST, 'assets'),
  assetNames: 'fonts/[name]-[hash]',
  loader: { '.woff2': 'file', '.glsl': 'text' },
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'linked',
  charset: 'utf8',
  logLevel: 'info',
  plugins: [katexWoff2Only, {
    name: 'copy-static',
    setup(build) { build.onEnd(() => copyStatic()); },
  }],
};

if (!watch) rmSync(DIST, { recursive: true, force: true });

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  if (serve) {
    const { host, port } = await ctx.serve({ servedir: DIST, port: 5180, host: '127.0.0.1' });
    console.log(`serving http://${host}:${port}/`);
  }
} else {
  await esbuild.build(options);
}
