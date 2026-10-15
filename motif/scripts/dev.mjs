#!/usr/bin/env node
// Development loop: rebuild bundles on change and run the editor (Ctrl+R in the window reloads
// the UI; restart this script after changing main-process code).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const watcher = spawn(process.execPath, [path.join(root, 'scripts/build.mjs'), '--watch'], { stdio: 'inherit', cwd: root });
setTimeout(() => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = spawn(require('electron'), [root, ...process.argv.slice(2)], { stdio: 'inherit', env, cwd: root });
  app.on('exit', (code) => { watcher.kill(); process.exit(code ?? 0); });
}, 2500);
