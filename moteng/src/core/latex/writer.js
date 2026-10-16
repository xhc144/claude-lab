// IR blocks → LaTeX body.
//
// Every formula, code block, table, heading and paragraph is wrapped in a
// fragment marker carrying a path id ("t2.a.5.m1"). After rendering, the markers
// become a line map, so a compile error on line N can be traced to the
// smallest fragment around it, and that fragment alone is re-rendered in its
// "fallback" form on the next pass. Ids depend only on the IR, never on what
// was rendered, so they are stable across passes.

import { escapeText, escapeCode, escapeUrl, escapeBookmark, escapeTextBreakingUrls } from './escape.js';
import { highlightCode, plainCode, resolveLanguage } from './highlight.js';
import { normalizeTex, splitTypedMath } from '../math.js';

const S = '\u0001';
const E = '\u0002';

const LANG_LABEL = {
  python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript', java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#',
  go: 'Go', rust: 'Rust', ruby: 'Ruby', php: 'PHP', swift: 'Swift', kotlin: 'Kotlin', scala: 'Scala', r: 'R',
  matlab: 'MATLAB', julia: 'Julia', lua: 'Lua', perl: 'Perl', bash: 'Bash', shell: 'Shell', powershell: 'PowerShell',
  sql: 'SQL', html: 'HTML', xml: 'XML', css: 'CSS', json: 'JSON', yaml: 'YAML', toml: 'TOML', markdown: 'Markdown',
  latex: 'LaTeX', tex: 'TeX', haskell: 'Haskell', dart: 'Dart', plaintext: '', text: '', mathematica: 'Mathematica',
  lean: 'Lean', lean4: 'Lean 4', coq: 'Coq', sage: 'Sage', fortran: 'Fortran', verilog: 'Verilog', vhdl: 'VHDL',
};

const NUMBERED_HEADING = /^\s*([一二三四五六七八九十百零]+\s*[、.．]|\d+(\.\d+)*\s*[.、．)）]|\d+(\.\d+)+\s|[（(]\s*[一二三四五六七八九十\d]+\s*[)）]|第\s*[一二三四五六七八九十百\d]+\s*[章节部分步讲问题]|[IVX]+\.\s|(Step|Part)\s*\d|步骤\s*\d)/i;

export function inlinePlain(inl) {
  return inl.map((x) => {
    if (x.t === 'text') return x.v;
    if (x.t === 'math') return x.tex;
    if (x.t === 'code') return x.v;
    if (x.t === 'br') return ' ';
    if (x.c) return inlinePlain(x.c);
    return '';
  }).join('');
}

export class Writer {
  /**
   * @param {object} opts   { headingCmds: string[], headingNumbered: bool, ... }
   * @param {Set<string>} fallback  fragment ids to render in their safe form
   */
  constructor(opts, fallback = new Set()) {
    this.opts = opts;
    this.fallback = fallback;
    this.kinds = new Map();
    this.warnings = [];
    this.listDepth = 0;
  }

  frag(id, kind, render, safe) {
    this.kinds.set(id, kind);
    const body = this.fallback.has(id) ? safe() : render();
    return `${S}${id}${E}${body}${S}/${id}${E}`;
  }

  // ---------------------------------------------------------------- inline
  // Each inline formula sits on a line of its own ("%" eats the line ends), so
  // an error line points at exactly one formula.
  math(tex, id, mode) {
    return '%\n' + this.frag(id, 'math', () => {
      const n = normalizeTex(tex, false);
      const body = mode === 'cell-display' ? `\\displaystyle ${n.tex}` : n.tex;
      if (mode === 'heading') return `\\texorpdfstring{\\(${body}\\)}{${escapeBookmark(tex)}}`;
      return `\\(${body}\\)`;
    }, () => `\\mtbadmath{${escapeCode(tex)}}`) + '%\n';
  }

  inlines(inl, id, mode = 'text', ctr = { n: 0 }, safe = false) {
    let out = '';
    for (const x of inl) {
      switch (x.t) {
        case 'text': out += mode === 'heading' ? escapeText(x.v, { symbols: false }) : escapeTextBreakingUrls(x.v); break;
        case 'br': out += mode === 'heading' ? ' ' : mode === 'cell' ? '\\newline{}' : '\\newline{}\n'; break;
        case 'math': {
          const mid = `${id}.m${ctr.n++}`;
          out += safe ? `\\mtbadmath{${escapeCode(x.tex)}}` : this.math(x.tex, mid, x.displaystyle ? 'cell-display' : mode);
          break;
        }
        case 'code': out += `\\mtcode{${escapeCode(x.v)}}`; break;
        case 'b': out += `\\textbf{${this.inlines(x.c, id, mode, ctr, safe)}}`; break;
        case 'i': out += `\\textit{${this.inlines(x.c, id, mode, ctr, safe)}}`; break;
        case 's': out += mode === 'heading' ? this.inlines(x.c, id, mode, ctr, safe) : `\\sout{${this.inlines(x.c, id, mode, ctr, safe)}}`; break;
        case 'sup': out += `\\textsuperscript{${this.inlines(x.c, id, mode, ctr, safe)}}`; break;
        case 'sub': out += `\\textsubscript{${this.inlines(x.c, id, mode, ctr, safe)}}`; break;
        case 'check': out += x.on ? '\\(\\boxtimes\\)~' : '\\(\\square\\)~'; break;
        case 'link': {
          const text = this.inlines(x.c, id, mode, ctr, safe);
          if (mode === 'heading' || safe || !/^(https?|mailto|ftp):/i.test(x.href)) out += text;
          else out += `\\href{${escapeUrl(x.href)}}{${text}}`;
          break;
        }
        case 'img':
          out += x.file ? `\\includegraphics[max width=\\linewidth, max height=4em, keepaspectratio]{${x.file}}` : `\\mtmissing{${escapeText(x.alt || '图片')}}`;
          break;
        default: break;
      }
    }
    return out;
  }

  // ----------------------------------------------------------------- blocks
  blocks(blocks, id, ctx = {}) {
    const parts = [];
    blocks.forEach((b, i) => {
      const r = this.block(b, `${id}.${i}`, ctx);
      if (r) parts.push(r);
    });
    return parts.join('\n\n');
  }

  headingCommand(level, text) {
    const cmds = this.opts.headingCmds;
    const base = this.opts.headingBase ?? 1;
    const idx = Math.max(0, Math.min(cmds.length - 1, level - base));
    const numbered = this.opts.headingNumbered && !NUMBERED_HEADING.test(text) && idx < 2;
    return { cmd: cmds[idx], numbered, idx };
  }

  block(b, id, ctx) {
    switch (b.t) {
      case 'para': {
        const body = (safe) => {
          const s = this.inlines(b.inl, id, 'text', { n: 0 }, safe);
          return /^\s*[[*]/.test(s) ? `{}${s}` : s;
        };
        return this.frag(id, 'para', () => body(false), () => body(true));
      }
      case 'heading': {
        if (ctx.inBox) {
          return this.frag(id, 'para', () => `\\textbf{${this.inlines(b.inl, id, 'text')}}`, () => `\\textbf{${escapeText(inlinePlain(b.inl))}}`);
        }
        const plain = inlinePlain(b.inl);
        const { cmd, numbered, idx } = this.headingCommand(b.level, plain);
        return this.frag(id, 'heading', () => {
          const title = this.inlines(b.inl, id, 'heading');
          if (cmd === 'textbf') return `\\par\\noindent\\textbf{${title}}\\par\\nobreak`;
          if (numbered) return `\\${cmd}{${title}}`;
          const toc = idx < 2 && this.opts.headingToc ? `\n\\addcontentsline{toc}{${cmd}}{${title}}` : '';
          const mark = idx < 2 ? `\\phantomsection` : '';
          return `${mark}\\${cmd}*{${title}}${toc}`;
        }, () => `\\par\\noindent\\textbf{${escapeText(plain)}}\\par`);
      }
      case 'math': {
        return this.frag(id, 'display', () => {
          const n = normalizeTex(b.tex, true);
          if (n.env === 'raw') return n.tex;
          return `\\[\n${n.tex}\n\\]`;
        }, () => `\\begin{mtbaddisplay}\n\\begin{Verbatim}\n${b.tex.replace(/\\end\{Verbatim\}/g, '\\end {Verbatim}')}\n\\end{Verbatim}\n\\end{mtbaddisplay}`);
      }
      case 'code': {
        const lang = resolveLanguage(b.lang) || b.lang || '';
        const label = escapeText(LANG_LABEL[lang] ?? LANG_LABEL[b.lang] ?? (b.lang || ''));
        const text = b.text.replace(/\\end\{Verbatim\}/g, '\\end {Verbatim}');
        return this.frag(id, 'code', () => `\\begin{mtcodebox}{${label}}\n\\begin{Verbatim}[commandchars=\\\\\\{\\}]\n${highlightCode(text, lang)}\n\\end{Verbatim}\n\\end{mtcodebox}`,
          () => `\\begin{mtcodebox}{${label}}\n\\begin{Verbatim}\n${text}\n\\end{Verbatim}\n\\end{mtcodebox}`);
      }
      case 'list': return this.list(b, id, ctx);
      case 'table': return b.grid ? this.grid(b, id) : this.table(b, id);
      case 'quote': return `\\begin{mtquote}\n${this.blocks(b.blocks, id, ctx)}\n\\end{mtquote}`;
      case 'hr': return '\\mtrule';
      case 'image': {
        if (b.file) {
          const cap = b.alt && !/^(image|img|图片|图像|已生成图片|generated image|uploaded image)$/i.test(b.alt.trim()) ? escapeText(b.alt) : '';
          return this.frag(id, 'image', () => `\\mtimage{${b.file}}{${cap}}`, () => `\\mtmissing{${escapeText(b.alt || b.file)}}`);
        }
        return `\\mtmissing{${escapeText(b.alt || '图片未能保存')}}`;
      }
      case 'note': {
        const style = b.kind === 'widget' ? 'mtwidget' : b.kind === 'thinking' ? 'mtthinking' : 'mtdetails';
        const inner = this.blocks(b.blocks, id, { ...ctx, inBox: true });
        if (!inner.trim()) return '';
        return `\\begin{mtnote}{${style}}{${escapeText(b.title || '')}}\n${inner}\n\\end{mtnote}`;
      }
      default: return '';
    }
  }

  list(b, id, ctx) {
    if (this.listDepth >= 4) {
      // LaTeX nests lists four deep; flatten anything below that.
      return b.items.map((item, i) => {
        const mark = b.ordered ? `${b.start + i}.` : '–';
        return `\\par\\hangindent=2em\\hangafter=1\\noindent ${mark}~${this.blocks(item, `${id}.${i}`, ctx)}`;
      }).join('\n');
    }
    this.listDepth++;
    const env = b.ordered ? 'enumerate' : 'itemize';
    const opt = b.ordered && b.start !== 1 ? `[start=${b.start}]` : '';
    const items = b.items.map((item, i) => {
      const body = this.blocks(item, `${id}.${i}`, ctx);
      return `\\item\\relax ${body || '\\mbox{}'}`;
    });
    this.listDepth--;
    return `\\begin{${env}}${opt}\n${items.join('\n')}\n\\end{${env}}`;
  }

  cell(inl, id) {
    const s = this.inlines(inl, id, 'cell');
    return /^\s*[[*]/.test(s) ? `{}${s}` : s;
  }

  table(b, id) {
    const cols = Math.max(...b.rows.map((r) => r.spans.reduce((a, c) => a + c, 0)));
    const render = () => {
      // Column widths follow the longest cell text, within limits.
      const weight = new Array(cols).fill(1);
      for (const r of b.rows) {
        let c = 0;
        r.cells.forEach((cell, i) => {
          const len = Math.min(60, Math.max(4, [...inlinePlain(cell)].length));
          if (r.spans[i] === 1) weight[c] = Math.max(weight[c], len);
          c += r.spans[i];
        });
      }
      const total = weight.reduce((a, c) => a + c, 0);
      const spec = weight.map((w) => `>{\\hsize=${((w / total) * cols).toFixed(3)}\\hsize\\raggedright\\arraybackslash}X`).join('');
      const row = (r, ri) => {
        const cells = [];
        r.cells.forEach((cell, i) => {
          const t = this.cell(cell, `${id}.r${ri}c${i}`);
          cells.push(r.header ? `\\textbf{${t}}` : t);
          for (let k = 1; k < r.spans[i]; k++) cells.push('');
        });
        while (cells.length < cols) cells.push('');
        return `${cells.join(' & ')} \\\\`;
      };
      const head = b.rows.findIndex((r) => !r.header);
      const headerRows = head < 0 ? b.rows : b.rows.slice(0, head);
      const bodyRows = head < 0 ? [] : b.rows.slice(head);
      const size = cols >= 6 ? '\\footnotesize' : cols >= 4 ? '\\small' : '';
      const lines = [`{${size}\\setlength{\\tabcolsep}{5pt}\\renewcommand{\\arraystretch}{1.25}`, `\\begin{xltabular}{\\linewidth}{@{}${spec}@{}}`, '\\toprule'];
      if (headerRows.length) {
        headerRows.forEach((r) => lines.push(row(r, b.rows.indexOf(r))));
        lines.push('\\midrule', '\\endhead');
      }
      bodyRows.forEach((r) => lines.push(row(r, b.rows.indexOf(r))));
      lines.push('\\bottomrule', '\\end{xltabular}}');
      return lines.join('\n');
    };
    const safe = () => b.rows.map((r) => `\\par\\noindent ${r.cells.map((c) => this.inlines(c, id, 'cell', { n: 0 }, true)).join(' \\quad| ')}`).join('\n') + '\\par';
    return this.frag(id, 'table', render, safe);
  }

  grid(b, id) {
    const cols = Math.max(...b.rows.map((r) => r.cells.length));
    const render = () => {
      const rows = b.rows.map((r, ri) => `${r.cells.map((c, i) => this.cell(c, `${id}.r${ri}c${i}`)).join(' & ')} \\\\`);
      return `\\par\\noindent\\begin{tabularx}{\\linewidth}{@{}*{${cols}}{>{\\centering\\arraybackslash}X}@{}}\n${rows.join('\n')}\n\\end{tabularx}\\par`;
    };
    const safe = () => b.rows.map((r) => `\\par\\noindent ${r.cells.map((c) => this.inlines(c, id, 'cell', { n: 0 }, true)).join(' \\quad ')}`).join('\n') + '\\par';
    return this.frag(id, 'table', render, safe);
  }

  // The user's prompt is plain text; TeX the user typed between $…$ is set as math.
  prompt(blocks, id) {
    const expand = (inl) => {
      const out = [];
      for (const x of inl) {
        if (x.t !== 'text' || !/[$\\]/.test(x.v)) { out.push(x.c ? { ...x, c: expand(x.c) } : x); continue; }
        for (const seg of splitTypedMath(x.v)) {
          if (seg.text !== undefined) out.push({ t: 'text', v: seg.text });
          else out.push({ t: 'math', tex: seg.math, displaystyle: seg.display });
        }
      }
      return out;
    };
    // Blank lines typed into the prompt separate paragraphs.
    const split = [];
    for (const b of blocks) {
      if (b.t !== 'para') { split.push(b); continue; }
      let cur = [];
      for (let i = 0; i < b.inl.length; i++) {
        const x = b.inl[i];
        if (x.t === 'br' && b.inl[i + 1]?.t === 'br') {
          if (cur.length) split.push({ t: 'para', inl: expand(cur) });
          cur = [];
          while (b.inl[i + 1]?.t === 'br') i++;
          continue;
        }
        cur.push(x);
      }
      if (cur.length) split.push({ t: 'para', inl: expand(cur) });
    }
    return this.blocks(split.map((b) => (b.t === 'para' ? { ...b, inl: trimBr(b.inl) } : b)), id, { inBox: true });
  }
}

function trimBr(inl) {
  const a = [...inl];
  while (a.length && (a[0].t === 'br' || (a[0].t === 'text' && !a[0].v.trim()))) a.shift();
  while (a.length && (a.at(-1).t === 'br' || (a.at(-1).t === 'text' && !a.at(-1).v.trim()))) a.pop();
  return a;
}

/** Strip fragment markers; return { tex, map: [{ id, kind, start, end }] } with 1-based lines. */
export function finalize(text, kinds) {
  const map = [];
  const open = [];
  let line = 1;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === S) {
      const j = text.indexOf(E, i);
      const tagText = text.slice(i + 1, j);
      if (tagText.startsWith('/')) {
        const id = tagText.slice(1);
        const k = open.map((o) => o.id).lastIndexOf(id);
        if (k >= 0) {
          const o = open.splice(k, 1)[0];
          map.push({ id, kind: kinds.get(id), start: o.start, end: line });
        }
      } else {
        open.push({ id: tagText, start: line });
      }
      i = j + 1;
      continue;
    }
    if (c === '\n') line++;
    out += c;
    i++;
  }
  return { tex: out, map };
}

/** The smallest fragment that contains `line` (or the nearest one before it). */
export function fragmentAt(map, line) {
  let best = null;
  for (const f of map) {
    if (f.start <= line && line <= f.end) {
      if (!best || (f.end - f.start) < (best.end - best.start) || ((f.end - f.start) === (best.end - best.start) && f.id.length > best.id.length)) best = f;
    }
  }
  if (best) return best;
  let before = null;
  for (const f of map) if (f.end < line && (!before || f.end > before.end)) before = f;
  return before;
}
