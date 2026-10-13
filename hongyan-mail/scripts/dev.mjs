// Development runner: Vite dev server for the renderer, esbuild watch for main/preload,
// and Electron restarted whenever the main bundle changes.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildMain } from './esbuild-main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBin = createRequire(import.meta.url)('electron');

const server = await createServer({ configFile: path.join(root, 'vite.config.mts') });
await server.listen();
const url = `http://localhost:${server.config.server.port}/`;
console.log('renderer dev server:', url);

let child = null;
let restarting = false;
function startElectron() {
  child = spawn(electronBin, ['.', ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, HY_RENDERER_URL: url }
  });
  child.on('exit', (code) => {
    if (!restarting) { server.close(); process.exit(code ?? 0); }
  });
}
let first = true;
await buildMain({
  root,
  watch: true,
  onRebuild: (r) => {
    if (r.errors.length) return;
    if (first) { first = false; return; }
    if (child) { restarting = true; child.once('exit', () => { restarting = false; startElectron(); }); child.kill(); }
  }
});
startElectron();
