#!/usr/bin/env node
// Dev launcher for the motif CLI. The packaged app ships dist/cli.mjs and a motif.cmd shim.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'dist/cli.mjs');
if (!fs.existsSync(cli)) execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
await import(pathToFileURL(cli).href);
