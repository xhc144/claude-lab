// Builds the main process, the engine utility process, the preload script and
// the renderer. usage: node scripts/build.mjs [--dev]
import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';
import react from '@vitejs/plugin-react';
import { rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(join(root, 'dist'), { recursive: true });

const esmBanner = "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fu } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);";

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: dev ? 'inline' : false,
  minify: !dev,
  legalComments: 'none',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'warning',
};

await esbuild({
  ...common,
  entryPoints: { main: join(root, 'src/main/main.ts'), engine: join(root, 'src/main/engine-process.ts') },
  outdir: join(root, 'dist/main'),
  outExtension: { '.js': '.mjs' },
  format: 'esm',
  external: ['electron', 'onnxruntime-node', 'electron-updater'],
  banner: { js: esmBanner },
});

await esbuild({
  ...common,
  entryPoints: [join(root, 'src/preload/preload.ts')],
  outfile: join(root, 'dist/preload/preload.cjs'),
  format: 'cjs',
  external: ['electron'],
});

await vite({
  root: join(root, 'src/renderer'),
  base: './',
  logLevel: 'warn',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: join(root, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: dev,
    minify: !dev,
    target: 'chrome130',
    chunkSizeWarningLimit: 2000,
  },
});

writeFileSync(join(root, 'dist/build-info.json'), JSON.stringify({ version: pkg.version, builtAt: new Date().toISOString(), dev }, null, 1));
console.log(`built ${pkg.name} ${pkg.version}${dev ? ' (dev)' : ''}`);
