#!/usr/bin/env node
// Every app ships an identical copy of update-signer.cjs next to its updater (the apps are packaged
// separately and cannot reach this folder at run time). Fails if a copy differs from the canonical
// file; `--write` refreshes the copies instead.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, here, repoRoot } from './lib.mjs';

const canonical = readFileSync(join(here, 'update-signer.cjs'), 'utf8');
const write = process.argv.includes('--write');
let bad = 0;
for (const [app, a] of Object.entries(APPS)) {
  const file = join(repoRoot, a.signerCopy);
  const same = existsSync(file) && readFileSync(file, 'utf8') === canonical;
  if (same) continue;
  if (write) { writeFileSync(file, canonical); console.log(`updated ${a.signerCopy}`); continue; }
  console.error(`::error file=${a.signerCopy}::${app}: ${existsSync(file) ? 'differs from' : 'missing copy of'} scripts/windows-release/update-signer.cjs (run node scripts/windows-release/check-copies.mjs --write)`);
  bad++;
}
if (bad) process.exit(1);
console.log(`update-signer.cjs: ${Object.keys(APPS).length} copies in sync`);
