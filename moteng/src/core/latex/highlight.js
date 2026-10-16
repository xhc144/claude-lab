// Code → fvextra Verbatim body with \mtHLkw{…}-style colouring (commandchars=\\\{\}).

import hljs from 'highlight.js/lib/common';

const ALIAS = {
  py: 'python', js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', zsh: 'bash', ps1: 'powershell',
  'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', rb: 'ruby', rs: 'rust', golang: 'go', yml: 'yaml', md: 'markdown',
  tex: 'latex', text: 'plaintext', txt: 'plaintext', plaintext: 'plaintext', html: 'xml', jsx: 'javascript', tsx: 'typescript',
  matlab: 'matlab', octave: 'matlab', mathematica: 'mathematica', wolfram: 'mathematica', vb: 'vbnet', hs: 'haskell',
};

// highlight.js scope → one of the colour classes defined in moteng.sty.
const CLASS_MAP = {
  keyword: 'kw', 'selector-tag': 'kw', 'meta-keyword': 'kw', doctag: 'kw',
  built_in: 'bi', type: 'ty', 'title.class': 'ty', 'title.class.inherited': 'ty', class: 'ty',
  literal: 'nu', number: 'nu', symbol: 'nu', 'selector-id': 'nu',
  string: 'st', regexp: 'st', 'meta-string': 'st', 'char.escape': 'st', subst: 'st',
  comment: 'co', quote: 'co',
  title: 'fn', 'title.function': 'fn', 'title.function.invoke': 'fn', section: 'fn', name: 'fn',
  attr: 'at', attribute: 'at', 'selector-attr': 'at', 'selector-class': 'at', property: 'at', params: 'pa',
  meta: 'me', 'meta.prompt': 'me', 'variable.language': 'kw', variable: 'va', 'template-variable': 'va',
  addition: 'ad', deletion: 'de', operator: 'op',
};

export function resolveLanguage(lang) {
  if (!lang) return null;
  const l = ALIAS[lang] || lang;
  return hljs.getLanguage(l) ? l : null;
}

function verbEscape(s) {
  return s.replace(/[\\{}]/g, (c) => (c === '\\' ? '\\mtBS{}' : c === '{' ? '\\mtLB{}' : '\\mtRB{}'));
}

function unescapeHtml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** Plain Verbatim body (no colouring). */
export function plainCode(text) {
  return verbEscape(text.replace(/\t/g, '    '));
}

/** Highlighted Verbatim body; every line closes its own groups. */
export function highlightCode(text, lang) {
  const body = text.replace(/\t/g, '    ');
  const language = resolveLanguage(lang);
  if (!language || language === 'plaintext' || body.length > 60000) return plainCode(body);
  let html;
  try {
    html = hljs.highlight(body, { language, ignoreIllegals: true }).value;
  } catch {
    return plainCode(body);
  }
  const stack = [];
  let out = '';
  const re = /<span class="([^"]+)">|<\/span>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      const scope = m[1].split(/\s+/).map((c) => c.replace(/^hljs-/, '').replace(/_$/, '')).join('.');
      const key = CLASS_MAP[scope] || CLASS_MAP[scope.split('.')[0]] || '';
      stack.push(key);
      if (key) out += `\\mtHL${key}{`;
    } else if (m[0] === '</span>') {
      const key = stack.pop();
      if (key) out += '}';
    } else {
      const text = unescapeHtml(m[2]);
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (i) {
          // Close open groups at the line end, reopen on the next line.
          const open = stack.filter(Boolean);
          out += '}'.repeat(open.length) + '\n' + open.map((k) => `\\mtHL${k}{`).join('');
        }
        out += verbEscape(line);
      });
    }
  }
  return out;
}
