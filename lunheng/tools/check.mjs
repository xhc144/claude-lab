#!/usr/bin/env node
// Syntax-check every server, client, tool and test module.
import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    if (['node_modules', '.git', 'data', '.tmp', 'test-results', 'playwright-report'].includes(name)) continue;
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.mjs', '.js'].includes(extname(p))) files.push(p);
  }
};
walk(root);
let failed = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { failed++; console.error(`✗ ${f}\n${e.stderr}`); }
}
console.log(`${files.length - failed}/${files.length} modules pass syntax check`);
process.exit(failed ? 1 : 0);
