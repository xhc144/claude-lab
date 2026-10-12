// Bundles the Electron main and preload processes into dist/ with esbuild.
// Every runtime dependency is bundled, so the packaged app needs no node_modules.
import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

// imapflow lazily creates a pino logger only when no logger is passed. We always pass
// our own, so swap pino for a tiny stub instead of bundling it (and its worker threads).
const pinoStub = {
  name: 'pino-stub',
  setup(b) {
    b.onResolve({ filter: /^pino$/ }, () => ({ path: 'pino-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'const noop=()=>{};const l={trace:noop,debug:noop,info:noop,warn:noop,error:noop,fatal:noop,child:()=>l};module.exports=()=>l;module.exports.default=module.exports;',
      loader: 'js'
    }));
  }
};

export async function buildMain({ root, production = false, watch = false, onRebuild } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const common = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    sourcemap: production ? false : 'inline',
    minify: production,
    keepNames: true,
    external: ['electron'],
    logLevel: 'warning',
    define: {
      'process.env.HY_VERSION': JSON.stringify(pkg.version),
      'process.env.HY_DEV': JSON.stringify(production ? '' : '1')
    },
    plugins: [pinoStub, ...(onRebuild ? [{ name: 'notify', setup(b) { b.onEnd((r) => onRebuild(r)); } }] : [])]
  };
  const configs = [
    { ...common, entryPoints: [path.join(root, 'src/main/index.ts')], outfile: path.join(root, 'dist/main/index.js') },
    { ...common, entryPoints: [path.join(root, 'src/preload/index.ts')], outfile: path.join(root, 'dist/preload/index.js') }
  ];
  if (watch) {
    const ctxs = await Promise.all(configs.map((c) => esbuild.context(c)));
    await Promise.all(ctxs.map((c) => c.watch()));
    return ctxs;
  }
  await Promise.all(configs.map((c) => esbuild.build(c)));
}
