// Zero-dependency bundler (same approach as mathscape/scripts/build.mjs): every module becomes a
// function scope inside one classic script. Supports exactly the module syntax this codebase uses:
//   import { a, b as c } from './x.js';   import x from './x.js';   import * as X from './x.js';
//   export function|class|const|let NAME …;   export default …;

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const IMPORT_RE = /^import\s+([^;'"]*?)\s+from\s+['"](\.{1,2}\/[^'"]+)['"];?[ \t]*$/gm;

export function bundle(entry, root) {
  const modules = new Map();
  const order = [];
  const load = (file, stack = []) => {
    if (modules.has(file)) return;
    if (stack.includes(file)) throw new Error(`circular import: ${[...stack, file].map((f) => relative(root, f)).join(' -> ')}`);
    const src = readFileSync(file, 'utf8');
    const id = relative(root, file).replace(/\\/g, '/');
    for (const m of src.matchAll(IMPORT_RE)) load(resolve(dirname(file), m[2]), [...stack, file]);
    modules.set(file, { id, src });
    order.push(file);
  };
  const transform = (file) => {
    const { id, src } = modules.get(file);
    const exportsList = [];
    let hasDefault = false;
    let code = src.replace(IMPORT_RE, (_, clause, spec) => {
      const dep = JSON.stringify(modules.get(resolve(dirname(file), spec)).id);
      const ns = /^\s*\*\s+as\s+([A-Za-z_$][\w$]*)\s*$/.exec(clause);
      if (ns) return `const ${ns[1]} = __m[${dep}];`;
      const parts = [];
      const named = /\{([^}]*)\}/.exec(clause);
      const def = /^\s*([A-Za-z_$][\w$]*)\s*(,|$)/.exec(clause);
      if (def) parts.push(`const ${def[1]} = __m[${dep}].default;`);
      if (named) {
        const fields = named[1].split(',').map((s) => s.trim()).filter(Boolean)
          .map((s) => { const [a, b] = s.split(/\s+as\s+/); return b ? `${a}: ${b}` : a; });
        parts.push(`const { ${fields.join(', ')} } = __m[${dep}];`);
      }
      if (!parts.length) throw new Error(`${id}: unsupported import clause “${clause}”`);
      return parts.join(' ');
    });
    code = code.replace(/^export\s+default\s+/m, () => { hasDefault = true; return 'const __default__ = '; });
    code = code.replace(/^export\s+((?:async\s+)?(?:function\*?|class|const|let|var))\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
      exportsList.push(name);
      return `${kind} ${name}`;
    });
    if (/^\s*(import|export)\s/m.test(code)) throw new Error(`${id}: unsupported import/export form left after transform`);
    const ret = [...exportsList, ...(hasDefault ? ['default: __default__'] : [])].join(', ');
    return `// ---- ${id}\n__m[${JSON.stringify(id)}] = (() => {\n"use strict";\n${code}\nreturn { ${ret} };\n})();\n`;
  };
  load(entry);
  return { js: `(() => {\nconst __m = Object.create(null);\n${order.map(transform).join('\n')}\n})();\n`, count: order.length };
}
