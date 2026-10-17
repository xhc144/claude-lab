// Build-time TeX check: load the same vendored KaTeX the site ships and render every formula.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { MACROS } from '../../src/core/macros.js';

export function loadKatex(root) {
  const src = readFileSync(join(root, 'vendor/katex/katex.min.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(src, { module, exports: module.exports, console });
  return module.exports.default || module.exports;
}

/** Render every snippet; returns a list of error strings. CJK text must be wrapped in \text{…}. */
export function checkMath(katex, math) {
  const errors = [];
  const seen = new Map();
  for (const { tex, display, where } of math) {
    const key = (display ? 'D' : 'I') + tex;
    if (seen.has(key)) { if (seen.get(key)) errors.push(`${where}: ${seen.get(key)}`); continue; }
    let problem = '';
    try {
      katex.renderToString(tex, {
        displayMode: display, throwOnError: true, macros: { ...MACROS },
        strict: (code, msg) => { if (code === 'unicodeTextInMathMode' || code === 'unknownSymbol') throw new Error(`${msg} — wrap text in \\text{…}`); return 'ignore'; },
      });
    } catch (e) {
      problem = `TeX error in “${tex.slice(0, 80)}”: ${String(e.message).split('\n')[0]}`;
    }
    seen.set(key, problem);
    if (problem) errors.push(`${where}: ${problem}`);
  }
  return errors;
}
