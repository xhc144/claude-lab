#!/usr/bin/env node
// Zero-dependency static check:
//   1. every .js / .mjs file parses (node --check)
//   2. every relative `import { a, b as c } from './x.js'` points to an existing file that
//      actually exports those names (catches typos in browser-only modules that the unit tests
//      never import)

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIRS = ['src', 'tests', 'scripts'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(name)) out.push(p);
  }
  return out;
}

const files = DIRS.flatMap((d) => (existsSync(join(ROOT, d)) ? walk(join(ROOT, d)) : []));
const problems = [];

for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    problems.push(`${relative(ROOT, f)}: syntax error\n${e.stderr}`);
  }
}

const exportCache = new Map();
function exportsOf(file) {
  if (exportCache.has(file)) return exportCache.get(file);
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\b/.test(src)) names.add('default');
  exportCache.set(file, names);
  return names;
}

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/^import\s+([^;'"]*?)\s+from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) {
    const target = resolve(dirname(f), m[2]);
    if (!existsSync(target)) { problems.push(`${relative(ROOT, f)}: cannot resolve ${m[2]}`); continue; }
    const clause = m[1];
    const wanted = [];
    const named = /\{([^}]*)\}/.exec(clause);
    if (named) for (const part of named[1].split(',')) { const n = part.trim().split(/\s+as\s+/)[0]; if (n) wanted.push(n); }
    const def = /^([A-Za-z_$][\w$]*)\s*(,|$)/.exec(clause.trim());
    if (def) wanted.push('default');
    const have = exportsOf(target);
    for (const n of wanted) if (!have.has(n)) problems.push(`${relative(ROOT, f)}: ${m[2]} has no export "${n}"`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n✗ ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`✓ ${files.length} files: syntax OK, all relative imports resolve to real exports`);
