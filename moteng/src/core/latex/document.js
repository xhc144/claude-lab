// Conversation → complete .tex in one of the two styles.
//   chat  : ctexart, questions as bubbles or tinted boxes, answers flowing below
//   notes : 墨经 mojing-notes lecture notes, one 讲 per question
// The layout (layout.js) sets page, fonts, spacing, headings, formula numbering, images and page
// breaks; per-element overrides from the live preview are applied by prepareDocument first.

import { Writer, finalize, inlinePlain } from './writer.js';
import { escapeText, escapeUrl, escapeCode, escapeBookmark } from './escape.js';
import { cjkFontTeX, cjkMainTeX, monoFontTeX } from './fonts.js';
import { blockTextLength } from '../ir.js';
import { shorten } from '../extract.js';
import { normalizeLayout, prepareDocument, minHeading, PAPERS, accentHex, resolvedFonts } from '../layout.js';

// TeX the user typed ("$\\int_0^1 x\\,dx$") reads badly in a title; keep the words around it.
function withoutTypedMath(s) {
  return s.replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]*?[\\^_][^$\n]*?\$/g, '…').replace(/(…\s*)+/g, '…');
}

function firstText(blocks) {
  for (const b of blocks || []) {
    if (b.t === 'para' || b.t === 'heading') {
      const s = withoutTypedMath(inlinePlain(b.inl)).replace(/\s+/g, ' ').trim();
      if (s) return s;
    }
    if (b.t === 'list') for (const it of b.items) { const s = firstText(it); if (s) return s; }
  }
  return '';
}

function fmtDate(d) {
  if (!d || Number.isNaN(d.getTime?.())) return '';
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).replace(/\/$/, '');
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Latin, math and code fonts (all ship with TeX, or are tried by name first)
// ---------------------------------------------------------------------------

const LM_SANS = '\\setsansfont{lmsans10}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-oblique, BoldItalicFont=*-boldoblique, Scale=MatchLowercase]';
const HEROS = (cmd) => `\\${cmd}{texgyreheros}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic${cmd === 'setsansfont' ? ', Scale=MatchLowercase' : ''}]`;
const FIRA = (cmd) => `\\${cmd}{FiraSans}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-SemiBold, ItalicFont=*-Italic, BoldItalicFont=*-SemiBoldItalic${cmd === 'setsansfont' ? ', Scale=MatchLowercase' : ''}]`;

function latinTeX(fonts, safe) {
  const lines = [];
  switch (fonts.latin) {
    case 'lm':
      lines.push('\\setmainfont{lmroman10}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic]', LM_SANS);
      break;
    case 'sans':
      // The web page's own face on Windows (Segoe UI), else a Helvetica-like face from TeX.
      lines.push(safe ? HEROS('setmainfont') : `\\IfFontExistsTF{Segoe UI}{\\setmainfont{Segoe UI}}{${HEROS('setmainfont')}}`);
      lines.push(safe ? HEROS('setsansfont') : `\\IfFontExistsTF{Segoe UI}{\\setsansfont{Segoe UI}}{${HEROS('setsansfont')}}`);
      break;
    case 'fira':
      lines.push(FIRA('setmainfont'), FIRA('setsansfont'));
      break;
    default:
      lines.push('\\setmainfont{STIXTwoText}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-SemiBold, ItalicFont=*-Italic, BoldItalicFont=*-SemiBoldItalic]', LM_SANS);
  }
  if (fonts.mono === 'fira') lines.push('\\setmonofont{FiraMono}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-Bold, Scale=MatchLowercase]');
  else lines.push('\\setmonofont{lmmono10}[Extension=.otf, UprightFont=*-regular, ItalicFont=*-italic, Scale=MatchLowercase]');
  const math = { lm: 'latinmodern-math.otf', fira: 'FiraMath-Regular.otf', stix: 'STIXTwoMath-Regular.otf' }[fonts.math] || 'STIXTwoMath-Regular.otf';
  lines.push(`\\setmathfont{${math}}`);
  return lines.join('\n');
}

function header(conv, opts) {
  return [
    '% !TEX program = xelatex',
    `% ${conv.title}`,
    `% 由 墨誊 Moteng 从 ${conv.platformName} 对话网页生成${conv.url ? `：${conv.url}` : ''}`,
    '% 编译：xelatex（需要同目录下的 moteng.sty' + (opts.style === 'notes' ? '、moteng-compat.sty 与墨经 mojing-*.cls/.sty' : '') + '）',
    '',
  ].join('\n');
}

const pt = (x) => `${(+x).toFixed(2)}pt`;

function headingSizes(L) {
  const s = L.sizePt * L.headingScale;
  return [1.62, 1.3, 1.12, 1].map((f) => [Math.max(L.sizePt, s * f), Math.max(L.sizePt, s * f) * 1.3]);
}

function chatPreamble(conv, opts, L) {
  const paper = PAPERS[L.paper] || PAPERS.a4;
  const m = L.marginMm;
  const fonts = resolvedFonts(L);
  const web = L.theme === 'web';
  const sysFonts = opts.fonts && !opts.safeFonts;
  const cjk = sysFonts ? cjkFontTeX(opts.fonts, { noFakeSlant: opts.noFakeSlant }) : '';
  const cjkMain = cjkMainTeX(sysFonts ? opts.fonts : null, fonts.cjk, { safe: !sysFonts, noFakeSlant: opts.noFakeSlant });
  const mono = sysFonts && fonts.mono === 'system' ? monoFontTeX(opts.fonts) : '';
  // ctex sets 10.5pt (五号) and 12pt (小四) itself; other sizes go through scrextend.
  const zihao = L.sizePt === 10.5 ? 'zihao=5' : L.sizePt === 12 ? 'zihao=-4' : 'zihao=false';
  const sizeCmd = zihao === 'zihao=false' ? `\\usepackage{scrextend}\n\\changefontsizes[${pt(L.sizePt * 1.3)}]{${pt(L.sizePt)}}\n` : '';
  const hs = headingSizes(L);
  const hfont = web ? '\\bfseries' : '\\sffamily\\bfseries';
  const fmt = (i) => `\\raggedright\\fontsize{${pt(hs[i][0])}}{${pt(hs[i][1])}}\\selectfont${hfont}\\color{mtInk}`;
  const numbers = L.headingNumbers === 'auto' ? 'none' : L.headingNumbers;
  const numbering = numbers === 'chinese'
    ? `  subsection={number=\\chinese{subsection}, name={,、}},\n  subsubsection={number=（\\chinese{subsubsection}）, name={,}, aftername=\\hspace{.2em}},\n`
    : numbers === 'arabic'
      ? `  subsection={number=\\arabic{subsection}, aftername=\\hspace{.6em}},\n  subsubsection={number=\\arabic{subsection}.\\arabic{subsubsection}, aftername=\\hspace{.6em}},\n`
      : '';
  const title = escapeText(shorten(conv.title, 40));
  const head = L.runningHeader ? `\\fancyhead[L]{\\small\\color{mtGray}${title}}` : '';
  const foot = L.pageNumbers ? (L.runningHeader ? '\\fancyhead[R]{\\small\\color{mtGray}\\thepage}' : '\\fancyfoot[C]{\\small\\color{mtGray}\\thepage}') : '';
  return `${header(conv, opts)}\\documentclass[UTF8, ${paper.tex}, ${zihao}, fontset=fandol, linespread=${L.lineSpread.toFixed(2)}]{ctexart}
${sizeCmd}\\usepackage[${paper.tex}, top=${m.top}mm, bottom=${m.bottom}mm, left=${m.left}mm, right=${m.right}mm, headheight=14pt, headsep=${Math.max(4, Math.min(10, m.top / 3)).toFixed(1)}mm, footskip=${Math.max(8, Math.min(14, m.bottom / 2)).toFixed(1)}mm]{geometry}
\\usepackage{amsmath, amssymb, mathtools}
\\usepackage[warnings-off={mathtools-colon, mathtools-overbracket}]{unicode-math}
${latinTeX(fonts, opts.safeFonts)}
${cjk}
${cjkMain}
${mono}
\\usepackage{fancyhdr}
\\usepackage[style=chat, theme=${L.theme}, accent=${accentHex(L)}, code=${L.codeTheme}]{moteng}
${pageColorTeX(conv, L)}
\\ctexset{
  section={format=${fmt(0)}, beforeskip=1.3\\baselineskip, afterskip=.6\\baselineskip},
  subsection={format=${fmt(numbers === 'none' ? 0 : 0)}, beforeskip=1.15\\baselineskip, afterskip=.5\\baselineskip},
  subsubsection={format=${fmt(1)}, beforeskip=1\\baselineskip, afterskip=.4\\baselineskip},
  paragraph={format=\\fontsize{${pt(hs[2][0])}}{${pt(hs[2][1])}}\\selectfont\\bfseries\\color{mtInk}, beforeskip=.7\\baselineskip, afterskip=.5em},
${numbering}}
\\setcounter{secnumdepth}{${numbers === 'none' ? 0 : 3}}
${L.eqWithinSection ? '\\numberwithin{equation}{section}\n\\renewcommand{\\theequation}{\\arabic{section}.\\arabic{equation}}' : ''}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
${head}
${foot}
\\fancypagestyle{plain}{\\fancyhf{}${foot}}
\\def\\mtImageMaxHeight{${L.imageMaxHeight.toFixed(2)}}
\\hypersetup{pdftitle={${escapeBookmark(conv.title)}}, pdfcreator={Moteng}, pdfsubject={${escapeBookmark(conv.platformName)}}}
\\setlength{\\parskip}{${L.parSkip.toFixed(2)}\\baselineskip plus 2pt minus 1pt}
\\setlength{\\parindent}{${L.parIndent ? '2em' : '0pt'}}
`;
}

// The question bubble in the page's own colours (read when the app rendered the saved page).
function pageColorTeX(conv, L) {
  const c = conv.pageColors;
  if (!L.followPage || !c || !c.bubbleBg || L.questionStyle !== 'bubble') return '';
  const hex = (x) => String(x).replace('#', '').toUpperCase();
  const lines = [`\\definecolor{mtBubble}{HTML}{${hex(c.bubbleBg)}}`];
  if (c.bubbleFg) lines.push(`\\definecolor{mtBubbleText}{HTML}{${hex(c.bubbleFg)}}`);
  return lines.join('\n');
}

function notesPreamble(conv, opts, L) {
  const fonts = resolvedFonts(L);
  const sysFonts = opts.fonts && !opts.safeFonts;
  const cjk = sysFonts ? cjkFontTeX(opts.fonts, { noFakeSlant: opts.noFakeSlant }) : '';
  // The notes template is a serif design; only an explicit choice changes its body face.
  const cjkMain = L.cjkFont !== 'auto' ? cjkMainTeX(sysFonts ? opts.fonts : null, fonts.cjk, { safe: !sysFonts, noFakeSlant: opts.noFakeSlant }) : '';
  const mono = sysFonts ? monoFontTeX(opts.fonts) : '';
  const latin = opts.safeFonts ? ', latin=lm' : '';
  const classOpts = ['nomargin', 'cjk=fandol'];
  return `${header(conv, opts)}\\RequirePackage{moteng-compat}
\\documentclass[${classOpts.join(', ')}${latin}]{mojing-notes}
\\usepackage[style=notes]{moteng}
${cjk}
${cjkMain}
${mono}
\\def\\mtImageMaxHeight{${L.imageMaxHeight.toFixed(2)}}
\\course{${escapeText(conv.title)}}
\\term{${escapeText([conv.platformName + ' 对话', fmtDate(conv.date)].filter(Boolean).join(' · '))}}
\\instructor{${escapeText(conv.assistantName)}}
\\hypersetup{pdftitle={${escapeBookmark(conv.title)}}, pdfcreator={Moteng}}
`;
}

function hasCode(blocks) {
  return (blocks || []).some((b) => b.t === 'code' || b.t === 'table' || (b.blocks && hasCode(b.blocks)) || (b.items && b.items.some(hasCode)));
}

/**
 * @param conv     extractConversation() result (images already collected)
 * @param opts     { style, layout, overrides, fonts, safeFonts, noFakeSlant, includeQuestions, toc }
 * @returns {{ tex, map, kinds, warnings, turns }}
 */
export function renderTex(conv, opts, fallback = new Set()) {
  const style = opts.style === 'notes' ? 'notes' : 'chat';
  // Old callers pass paper / fontSize only.
  const L = normalizeLayout(opts.layout, { paper: opts.paper, fontSize: opts.fontSize });
  const doc = prepareDocument(conv, L, opts.overrides);
  const turns = doc.turns;
  const out = [];
  const writerOpts = {
    headingToc: true,
    eqNumbers: L.eqNumbers,
    imageWidth: L.imageWidth,
    dynamic: L.dynamic,
    codeChip: style === 'chat' && L.theme === 'web',
  };
  const w = new Writer(writerOpts, fallback);
  const answerName = conv.assistantName || 'AI';
  const tocWanted = L.toc === 'on' || (L.toc === 'auto' && (opts.toc ?? turns.length >= 4));

  if (style === 'chat') {
    out.push(chatPreamble(conv, opts, L));
    out.push('\\begin{document}');
    const meta = [conv.platformName, fmtDate(conv.date)].filter(Boolean).map(escapeText);
    out.push(`\\begin{center}
{\\fontsize{${pt(Math.max(16, L.sizePt * 1.9 * L.headingScale))}}{${pt(Math.max(16, L.sizePt * 1.9 * L.headingScale) * 1.25)}}\\selectfont${L.theme === 'web' ? '' : '\\sffamily'}\\bfseries\\color{mtInk} ${escapeText(conv.title)}\\par}
\\smallskip
{\\small\\color{mtGray} ${meta.join(' \\quad·\\quad ')}${conv.url && /^https?:/.test(conv.url) ? ` \\quad·\\quad \\href{${escapeUrl(conv.url)}}{${escapeCode(shortUrl(conv.url))}}` : ''}\\par}
\\end{center}
\\mtrule`);
    if (tocWanted) out.push('{\\small\\tableofcontents}\n\\mtrule');
    const asked = turns.filter((t) => t.question).length;
    turns.forEach((turn, k) => {
      const base = minHeading(turn.answer.filter((b) => !b.userLevel)) - L.headingShift;
      w.opts.headingBase = base;
      w.opts.headingNumbered = L.headingNumbers !== 'none' && L.headingNumbers !== 'auto';
      if (k > 0) out.push(turn.breakBefore ? '\\clearpage' : '\\mtturnsep');
      if (turn.question) {
        const n = turns.slice(0, k + 1).filter((t) => t.question).length;
        const label = asked > 1 ? `问题 ${n}` : '问题';
        const summary = shorten(firstText(turn.question) || label, 40);
        // One section per question: equation numbers (2.3) and the table of contents follow it.
        out.push(`\\refstepcounter{section}\\setcounter{subsection}{0}\\phantomsection\\addcontentsline{toc}{section}{${escapeText(label)}：${escapeText(summary)}}`);
        if (opts.includeQuestions !== false) {
          w.opts.headingCmds = ['textbf'];
          const body = w.prompt(turn.question, `t${k}.q`);
          const len = blockTextLength(turn.question);
          if (L.questionStyle === 'plain') out.push(`\\begin{mtquestionplain}{${escapeText(label)}}\n${body}\n\\end{mtquestionplain}`);
          else if (L.questionStyle === 'bubble' && len < 700 && !hasCode(turn.question)) out.push(`\\mtbubble{${escapeText(label)}}{%\n${body}%\n}`);
          else if (L.questionStyle === 'bubble') out.push(`\\begin{mtquestionbubble}{${escapeText(label)}}\n${body}\n\\end{mtquestionbubble}`);
          else out.push(`\\begin{mtquestion}{${escapeText(label)}}\n${body}\n\\end{mtquestion}`);
        }
      }
      if (turn.answer.length) {
        out.push(`\\mtanswerhead{${escapeText(answerName)}}`);
        // The answer's own top-level headings go one level under the question entry.
        w.opts.headingCmds = ['subsection', 'subsubsection', 'paragraph', 'textbf'];
        out.push(w.blocks(turn.answer, `t${k}.a`));
      }
    });
    out.push('\\end{document}\n');
  } else {
    out.push(notesPreamble(conv, opts, L));
    out.push('\\begin{document}');
    const asked = turns.filter((t) => t.question);
    const avg = turns.reduce((a, t) => a + blockTextLength(t.answer), 0) / Math.max(1, turns.length);
    // Many short exchanges read better as sections of one lecture than as many lectures.
    const compact = turns.length > 3 && avg < 1500;
    const lectureTitle = (turn, i) => (turns.length === 1 ? conv.title : shorten(firstText(turn.question) || `第 ${i + 1} 部分`, 30));
    if (turns.length >= 3 && !compact && L.toc !== 'off') out.push('\\tableofcontents');
    else if (L.toc === 'on') out.push('\\tableofcontents');
    const date = fmtDate(conv.date);
    const lectureOpts = (short) => [`short={${escapeText(short)}}`, date ? `date={${escapeText(date)}}` : '', 'scribe={墨誊 Moteng}'].filter(Boolean).join(', ');
    if (compact) out.push(`\\lecture[${lectureOpts(shorten(conv.title, 18))}]{${escapeText(conv.title)}}`);
    turns.forEach((turn, k) => {
      const base = minHeading(turn.answer.filter((b) => !b.userLevel)) - L.headingShift;
      w.opts.headingBase = base;
      w.opts.headingNumbered = L.headingNumbers !== 'none';
      if (compact) {
        if (turn.breakBefore) out.push('\\clearpage');
        if (turn.question) out.push(`\\section{${escapeText(lectureTitle(turn, k))}}`);
        w.opts.headingCmds = ['subsection', 'subsubsection', 'paragraph', 'textbf'];
      } else {
        const title = lectureTitle(turn, k);
        out.push(`\\lecture[${lectureOpts(shorten(title, 18))}]{${escapeText(title)}}`);
        w.opts.headingCmds = ['section', 'subsection', 'subsubsection', 'paragraph'];
      }
      if (turn.question && opts.includeQuestions !== false) {
        out.push(`\\begin{problem}\\relax\n${w.prompt(turn.question, `t${k}.q`)}\n\\end{problem}`);
      }
      if (turn.answer.length) {
        out.push(`\\mtanswerhead{解答 \\textmd{\\color{mtGray}（${escapeText(answerName)}）}}`);
        out.push(w.blocks(turn.answer, `t${k}.a`));
      }
    });
    if (!asked.length && !turns.length) out.push('（这个网页里没有找到对话内容。）');
    out.push('\\end{document}\n');
  }
  const { tex, map } = finalize(out.join('\n\n'), w.kinds);
  return { tex, map, kinds: w.kinds, warnings: w.warnings, turns: turns.length, stats: doc.stats };
}
