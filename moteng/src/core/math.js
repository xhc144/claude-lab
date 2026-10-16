// Math: find the TeX source behind rendered formulas, and make KaTeX/MathJax
// flavoured TeX acceptable to XeLaTeX + amsmath + unicode-math.

// Elements that wrap one rendered formula. Order matters only for documentation:
// the extractor takes the outermost match.
export const MATH_ROOT_SELECTOR = [
  '[data-d-component="math"]',            // ChatGPT 2026 (DIL renderer)
  '[data-math]',                          // Gemini .math-inline / .math-block
  '[data-math-source]',
  '[data-latex]', '[data-tex]', '[data-formula]',
  '[copy-text]',                          // 豆包
  '.katex-display', '.katex',
  'mjx-container', '.MathJax', '.MathJax_Display', '.MathJax_Preview',
  'math',
  'script[type^="math/tex"]',
].join(', ');

const DISPLAY_MARKER = '.katex-display, mjx-container[display="true"], math[display="block"], [data-assistant-math-rendered="display"], .math-block, .MathJax_Display, [data-d-block]';

function attr(el, name) {
  return el.getAttribute ? el.getAttribute(name) : null;
}

function stripDelimiters(tex) {
  let t = tex.trim();
  const pairs = [['\\(', '\\)'], ['\\[', '\\]'], ['$$', '$$'], ['$', '$']];
  for (const [a, b] of pairs) {
    if (t.length > a.length + b.length && t.startsWith(a) && t.endsWith(b)) {
      return { tex: t.slice(a.length, t.length - b.length).trim(), display: a === '\\[' || a === '$$' };
    }
  }
  return { tex: t, display: null };
}

/** Returns { tex, display, source } or null when the element carries no formula. */
export function texFromElement(el) {
  const display = isDisplay(el);
  for (const name of ['data-math', 'data-math-source', 'data-latex', 'data-tex', 'data-formula', 'copy-text', 'data-custom-copy-text']) {
    const v = attr(el, name);
    if (v && v.trim()) {
      const s = stripDelimiters(v);
      return { tex: s.tex, display: s.display ?? display, source: name };
    }
  }
  if (el.tagName === 'SCRIPT') {
    return { tex: el.textContent.trim(), display: /mode=display/.test(attr(el, 'type') || ''), source: 'script' };
  }
  for (const a of el.querySelectorAll('annotation, annotation-xml')) {
    const enc = (attr(a, 'encoding') || '').toLowerCase();
    if (enc.includes('tex')) {
      const tex = a.textContent.trim();
      if (tex) return { tex, display, source: 'annotation' };
    }
  }
  // MathJax v2 keeps the source in a sibling <script type="math/tex">.
  const sib = el.nextElementSibling;
  if (sib && sib.tagName === 'SCRIPT' && /^math\/tex/.test(attr(sib, 'type') || '')) {
    return { tex: sib.textContent.trim(), display: /mode=display/.test(attr(sib, 'type')), source: 'script' };
  }
  const script = el.querySelector('script[type^="math/tex"]');
  if (script) return { tex: script.textContent.trim(), display: /mode=display/.test(attr(script, 'type')), source: 'script' };
  const math = el.tagName === 'MATH' ? el : el.querySelector('math');
  if (math) {
    const tex = mathmlToTex(math);
    if (tex.trim()) return { tex, display: display || attr(math, 'display') === 'block', source: 'mathml' };
  }
  const label = attr(el, 'aria-label');
  if (label && /[\\^_{}]/.test(label)) return { tex: label, display, source: 'aria-label' };
  return null;
}

export function isDisplay(el) {
  if (el.matches?.(DISPLAY_MARKER)) return true;
  if (el.closest?.('.katex-display, mjx-container[display="true"], .math-block')) return true;
  if (el.querySelector?.('.katex-display, mjx-container[display="true"], math[display="block"]')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// MathML → TeX, for MathJax 3 pages that keep only assistive MathML.
// ---------------------------------------------------------------------------
const MO_MAP = {
  '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∮': '\\oint', '∞': '\\infty', '≤': '\\le', '≥': '\\ge',
  '≠': '\\ne', '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div', '⋅': '\\cdot', '·': '\\cdot',
  '→': '\\to', '←': '\\leftarrow', '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow', '↦': '\\mapsto',
  '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup', '∩': '\\cap',
  '∀': '\\forall', '∃': '\\exists', '∂': '\\partial', '∇': '\\nabla', '≈': '\\approx', '≡': '\\equiv',
  '∼': '\\sim', '…': '\\ldots', '⋯': '\\cdots', '⋮': '\\vdots', '⋱': '\\ddots', '∘': '\\circ',
  '⟨': '\\langle', '⟩': '\\rangle', '∥': '\\parallel', '⊥': '\\perp', '¬': '\\neg', '∧': '\\wedge', '∨': '\\vee',
  '{': '\\{', '}': '\\}', '%': '\\%', '#': '\\#', '&': '\\&', '\u2061': '', '\u2062': '', '\u2063': '',
};
const MI_MAP = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'ϵ': '\\epsilon',
  'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
  'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon',
  'φ': '\\varphi', 'ϕ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega', 'Γ': '\\Gamma', 'Δ': '\\Delta',
  'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi', 'Ψ': '\\Psi',
  'Ω': '\\Omega', 'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}',
  '∞': '\\infty', 'ℓ': '\\ell', '∅': '\\emptyset',
};

function kids(el) {
  return [...el.children];
}

function group(s) {
  const t = s.trim();
  return /^(\\[a-zA-Z]+|[^\\\s])$/.test(t) ? t : `{${t}}`;
}

export function mathmlToTex(el) {
  const tag = el.tagName.toLowerCase().replace(/^m:/, '');
  const c = kids(el);
  const sub = (i) => (c[i] ? mathmlToTex(c[i]) : '');
  const text = (el.textContent || '').trim();
  switch (tag) {
    case 'math': case 'mrow': case 'mstyle': case 'mpadded': case 'mphantom': case 'menclose': case 'semantics': case 'mtd':
      if (tag === 'semantics') return c[0] ? mathmlToTex(c[0]) : '';
      return c.map(mathmlToTex).join(' ').replace(/\s+/g, ' ').trim();
    case 'annotation': case 'annotation-xml': case 'mprescripts': case 'none':
      return '';
    case 'mi': {
      if (MI_MAP[text]) return MI_MAP[text];
      if (text.length > 1) return `\\mathrm{${text}}`;
      return attr(el, 'mathvariant') === 'normal' ? `\\mathrm{${text}}` : text;
    }
    case 'mn': return text;
    case 'mo': return MO_MAP[text] !== undefined ? MO_MAP[text] : text;
    case 'mtext': return text ? `\\text{${text}}` : '';
    case 'ms': return `\\text{"${text}"}`;
    case 'mspace': return '\\,';
    case 'msup': return `${group(sub(0))}^${group(sub(1))}`;
    case 'msub': return `${group(sub(0))}_${group(sub(1))}`;
    case 'msubsup': return `${group(sub(0))}_${group(sub(1))}^${group(sub(2))}`;
    case 'mfrac': return attr(el, 'linethickness') === '0' ? `\\binom{${sub(0)}}{${sub(1)}}` : `\\frac{${sub(0)}}{${sub(1)}}`;
    case 'msqrt': return `\\sqrt{${c.map(mathmlToTex).join(' ')}}`;
    case 'mroot': return `\\sqrt[${sub(1)}]{${sub(0)}}`;
    case 'mover': {
      const acc = (c[1]?.textContent || '').trim();
      const map = { '^': '\\hat', 'ˆ': '\\hat', '~': '\\tilde', '˜': '\\tilde', '¯': '\\overline', '‾': '\\overline', '→': '\\vec', '˙': '\\dot', '¨': '\\ddot', '⏞': '\\overbrace' };
      if (map[acc]) return `${map[acc]}{${sub(0)}}`;
      return `\\overset{${sub(1)}}{${sub(0)}}`;
    }
    case 'munder': {
      const base = sub(0);
      if (/^\\(sum|prod|lim|max|min|sup|inf|bigcup|bigcap)$/.test(base) || /^\\mathrm\{(lim|max|min|sup|inf)\}$/.test(base)) {
        return `${base.replace(/^\\mathrm\{(\w+)\}$/, '\\$1')}_${group(sub(1))}`;
      }
      return `\\underset{${sub(1)}}{${base}}`;
    }
    case 'munderover': return `${sub(0)}_${group(sub(1))}^${group(sub(2))}`;
    case 'mfenced': {
      const open = attr(el, 'open') ?? '(';
      const close = attr(el, 'close') ?? ')';
      const esc = (d) => ({ '{': '\\{', '}': '\\}', '': '.' }[d] ?? d);
      return `\\left${esc(open)} ${c.map(mathmlToTex).join(', ')} \\right${esc(close)}`;
    }
    case 'mtable': {
      const rows = c.map((tr) => kids(tr).map(mathmlToTex).join(' & '));
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }
    case 'mtr': case 'mlabeledtr': return c.map(mathmlToTex).join(' & ');
    case 'mmultiscripts': return c.map(mathmlToTex).join(' ');
    default: return c.length ? c.map(mathmlToTex).join(' ') : text;
  }
}

// ---------------------------------------------------------------------------
// Normalising TeX for LaTeX.
// ---------------------------------------------------------------------------

// Remove "% comment" up to the end of line, as KaTeX does; keep \%.
function stripComments(tex) {
  return tex.replace(/(^|[^\\])((?:\\\\)*)%[^\n]*/g, '$1$2');
}

const CJK_RUN = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]+/g;

// CJK inside math must sit in \text{}; a nested \text{} is harmless.
function wrapCjk(tex) {
  let out = '';
  let i = 0;
  let textDepth = -1;
  let depth = 0;
  while (i < tex.length) {
    const ch = tex[i];
    if (ch === '\\') {
      const m = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      const cmd = m ? m[0] : ch;
      if (textDepth < 0 && /^\\(text\w*|mbox|hbox|operatorname\*?|mathrm|textrm|textbf|textit|textsf|texttt|tag|label|ce|pu)$/.test(cmd)) {
        out += cmd;
        i += cmd.length;
        while (tex[i] === ' ' || tex[i] === '*') out += tex[i++];
        if (tex[i] === '{') {
          textDepth = depth;
        }
        continue;
      }
      out += cmd;
      i += cmd.length;
      continue;
    }
    if (ch === '{') {
      depth++;
      out += ch;
      i++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (textDepth >= 0 && depth === textDepth) textDepth = -1;
      out += ch;
      i++;
      continue;
    }
    if (textDepth < 0) {
      CJK_RUN.lastIndex = 0;
      const rest = tex.slice(i);
      const m = rest.match(/^[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]+/);
      if (m) {
        out += `\\text{${m[0]}}`;
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

// Scan the formula once and report what sits at the top level (outside any
// group or environment): row breaks and alignment tabs.
export function topLevelShape(tex) {
  let depth = 0;
  let env = 0;
  let rows = false;
  let tabs = false;
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === '\\') {
      const rest = tex.slice(i);
      if (rest.startsWith('\\begin{')) { env++; i += 6; continue; }
      if (rest.startsWith('\\end{')) { env--; i += 4; continue; }
      if (rest.startsWith('\\\\')) { if (!depth && !env) rows = true; i++; continue; }
      if (/^\\(cr|newline)(?![a-zA-Z])/.test(rest)) { if (!depth && !env) rows = true; }
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '&' && !depth && !env) tabs = true;
  }
  return { rows, tabs };
}

const ALIGN_ENVS = /^\\begin\{(align|align\*|gather|gather\*|equation|equation\*|multline|multline\*|flalign|flalign\*|alignat|alignat\*|eqnarray|eqnarray\*)\}/;

/**
 * Normalise a formula. Returns { tex, env } where env is:
 *   'inline'   → wrap in \( … \)
 *   'display'  → wrap in \[ … \]
 *   'raw'      → already a top-level display environment, emit as is
 */
export function normalizeTex(input, display) {
  let tex = stripComments(String(input).replace(/\r\n?/g, '\n'));
  tex = tex.replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\u00a0/g, ' ');
  // A blank line inside math is a paragraph break → "Missing $ inserted".
  tex = tex.replace(/\n[ \t]*\n+/g, '\n').trim();
  // MathJax-only commands.
  tex = tex.replace(/\\require\{[^}]*\}/g, '')
    .replace(/\\(class|cssId|style)\{[^}]*\}/g, '')
    .replace(/\\unicode\{(x[0-9a-fA-F]+|\d+)\}/g, (_, n) => String.fromCodePoint(n[0] === 'x' ? parseInt(n.slice(1), 16) : +n))
    .replace(/\\bbox(\[[^\]]*\])?/g, '')
    .replace(/\\enclose\{[^}]*\}(\[[^\]]*\])?/g, '\\boxed');
  // Raw # is a parameter char in TeX.
  tex = tex.replace(/(^|[^\\])#/g, '$1\\#');
  // Fullwidth/CJK text inside math.
  tex = wrapCjk(tex);
  // Unbalanced braces cannot be fixed safely; leave them for the repair loop.
  if (!display) {
    // \tag and row breaks are display-only.
    tex = tex.replace(/\\tag\*?\{[^}]*\}/g, '');
    const shape = topLevelShape(tex);
    if (shape.rows) tex = tex.replace(/\\\\(?![a-zA-Z])/g, '\\quad ');
    return { tex: tex.replace(/\n/g, ' '), env: 'inline' };
  }
  if (ALIGN_ENVS.test(tex)) {
    // Keep the author's environment, unnumbered: numbers would not match the page.
    tex = tex.replace(/\\(begin|end)\{(align|gather|equation|multline|flalign|alignat|eqnarray)\}/g, '\\$1{$2*}');
    tex = tex.replace(/\\(begin|end)\{eqnarray\*\}/g, '\\$1{align*}');
    return { tex, env: 'raw' };
  }
  const shape = topLevelShape(tex);
  if (shape.rows && shape.tabs) return { tex: `\\begin{align*}\n${tex}\n\\end{align*}`, env: 'raw' };
  if (shape.rows) return { tex: `\\begin{gather*}\n${tex}\n\\end{gather*}`, env: 'raw' };
  if (shape.tabs) return { tex: `\\begin{aligned}\n${tex}\n\\end{aligned}`, env: 'display' };
  return { tex, env: 'display' };
}

// TeX source detected in plain text the user typed (a prompt is not rendered).
// Returns segments [{text}|{math, display}].
export function splitTypedMath(text) {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$\w])\$(?![\s$])((?:\\\$|[^$\n])+?)(?<![\s\\])\$(?![\w$])/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    const body = m[1] ?? m[2] ?? m[3] ?? m[4];
    const isDisplay = m[1] !== undefined || m[2] !== undefined;
    // "$5 and $10" is money, not math.
    if (m[4] !== undefined && !/[\\^_=+\-*/<>()a-zA-Z]/.test(body)) continue;
    if (m[4] !== undefined && /^\d+([.,]\d+)?$/.test(body.trim())) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ math: body.trim(), display: isDisplay });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
