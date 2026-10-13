// Production build: renderer via Vite, main + preload bundled with esbuild.
import { build as viteBuild } from 'vite';
import { buildMain } from './esbuild-main.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t0 = Date.now();
await Promise.all([
  buildMain({ root, production: true }),
  viteBuild({ configFile: path.join(root, 'vite.config.mts'), logLevel: 'warn', mode: 'production' })
]);
console.log(`build finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
