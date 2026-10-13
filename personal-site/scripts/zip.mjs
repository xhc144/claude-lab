#!/usr/bin/env node
// Package the site (built dist/ + full source, without node_modules) as release/xhc144-site.zip.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PARENT = dirname(ROOT), NAME = basename(ROOT);
const OUT = join(ROOT, 'release', 'xhc144-site.zip');
mkdirSync(dirname(OUT), { recursive: true });
rmSync(OUT, { force: true });
const exclude = ['node_modules/*', 'shots/*', 'test-results/*', 'playwright-report/*', 'release/*'].map((p) => `${NAME}/${p}`);
const r = spawnSync('zip', ['-r', '-q', '-X', OUT, NAME, '-x', ...exclude], { cwd: PARENT, stdio: 'inherit' });
if (r.status !== 0) { console.error('zip failed (is the `zip` command installed?)'); process.exit(1); }
console.log(`wrote ${OUT} (${(statSync(OUT).size / 1048576).toFixed(2)} MB)`);
