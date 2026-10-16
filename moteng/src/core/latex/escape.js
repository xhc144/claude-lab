// Escaping plain text for XeLaTeX.

const SPECIAL = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
  '%': '\\%', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
};

// Pictographs most text fonts lack. A few become symbols; the rest are dropped
// (XeTeX would print nothing for them anyway, with a warning).
const EMOJI_MAP = {
  '✅': '\\mtcheck{}', '✔': '\\mtcheck{}', '☑': '\\mtcheck{}', '✓': '\\mtcheck{}',
  '❌': '\\mtcross{}', '✖': '\\mtcross{}', '✗': '\\mtcross{}', '❎': '\\mtcross{}',
  '⚠': '\\mtwarn{}', '👉': '\\(\\Rightarrow\\)', '➡': '\\(\\rightarrow\\)', '⭐': '\\(\\star\\)', '★': '\\(\\bigstar\\)',
  '💡': '\\mtidea{}', '📌': '\\mtpin{}', '🔹': '\\(\\diamond\\)', '🔸': '\\(\\diamond\\)', '▶': '\\(\\triangleright\\)',
  '☐': '\\(\\square\\)', '■': '\\(\\blacksquare\\)', '□': '\\(\\square\\)', '●': '\\(\\bullet\\)', '•': '\\textbullet{}',
};

const EMOJI_RE = /(\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])(️|︎|[\u{1F3FB}-\u{1F3FF}])?(‍(\p{Extended_Pictographic})(️)?)*/gu;

// Characters that are safe in our fonts and must not be treated as emoji.
const KEEP = new Set(['©', '®', '™', '↔', '↕', '↩', '↪', '‼', '⁉', 'ℹ', '⌚', '⌛', '▪', '▫', '◻', '◼', '◽', '◾', '♠', '♣', '♥', '♦', '♀', '♂', '⚪', '⚫', '〰', '〽', '㊗', '㊙', '↗', '↘', '↙', '↖', '→', '←', '↑', '↓']);

export function escapeText(s, { symbols = true } = {}) {
  let out = '';
  const clean = String(s)
    .replace(/[​‌‍⁠﻿­]/g, '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
  let last = 0;
  EMOJI_RE.lastIndex = 0;
  let m;
  const plain = (t) => t.replace(/[\\{}$&#%_^~]/g, (c) => SPECIAL[c]).replace(/ /g, '~').replace(/[︎️]/g, '');
  while ((m = EMOJI_RE.exec(clean))) {
    out += plain(clean.slice(last, m.index));
    const base = m[1];
    if (KEEP.has(base) && !m[0].includes('‍')) out += plain(base);
    else if (EMOJI_MAP[base] && symbols) out += EMOJI_MAP[base];
    last = m.index + m[0].length;
  }
  out += plain(clean.slice(last));
  return out;
}

// Text in \texttt: escaped, and allowed to break after punctuation so a long
// path or identifier does not run into the margin.
export function escapeCode(s) {
  const e = escapeText(String(s).replace(/\t/g, '    '));
  return e.replace(/([/.,:;=_\-]|\\_)(?=[^\s{}])/g, '$1\\allowbreak{}').replace(/ /g, '\\ ');
}

// Text that may hold long URLs: allow line breaks inside them.
export function escapeTextBreakingUrls(s) {
  const str = String(s);
  const re = /(https?:\/\/|www\.)[^\s<>"'，。；、）)]+/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(str))) {
    out += escapeText(str.slice(last, m.index));
    out += escapeText(m[0]).replace(/([/.?&=:;,-]|\\[#%_&])(?=.)/g, '$1\\allowbreak{}');
    last = m.index + m[0].length;
  }
  return out + escapeText(str.slice(last));
}

// For \href: keep the URL working, drop what TeX cannot take.
export function escapeUrl(url) {
  return String(url).replace(/\\/g, '/').replace(/[{}]/g, '').replace(/([#%])/g, '\\$1').replace(/\s/g, '%20');
}

// PDF bookmark text (hyperref's \texorpdfstring second argument).
export function escapeBookmark(s) {
  return escapeText(s, { symbols: false }).replace(/\\\(|\\\)/g, '');
}
