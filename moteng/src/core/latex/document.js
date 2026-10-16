// Conversation → complete .tex in one of the two styles.
//   chat  : ctexart, questions in tinted boxes, answers flowing below
//   notes : 墨经 mojing-notes lecture notes, one 讲 per question

import { Writer, finalize, inlinePlain } from './writer.js';
import { escapeText, escapeUrl, escapeCode, escapeBookmark } from './escape.js';
import { cjkFontTeX, monoFontTeX } from './fonts.js';
import { blockTextLength } from '../ir.js';
import { shorten } from '../extract.js';

function turnsOf(messages) {
  const turns = [];
  for (const m of messages) {
    if (m.role === 'user') turns.push({ question: m.blocks, answer: [] });
    else if (turns.length) turns.at(-1).answer.push(...m.blocks);
    else turns.push({ question: null, answer: [...m.blocks] });
  }
  return turns;
}

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

function minHeading(blocks) {
  let min = 7;
  const walk = (bs) => bs.forEach((b) => {
    if (b.t === 'heading') min = Math.min(min, b.level);
    if (b.t === 'list') b.items.forEach(walk);
  });
  walk(blocks || []);
  return min === 7 ? 2 : min;
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

const SAFE_LATIN = `\\setmainfont{lmroman10}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic]
\\setsansfont{lmsans10}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-oblique, BoldItalicFont=*-boldoblique]
\\setmonofont{lmmono10}[Extension=.otf, UprightFont=*-regular, ItalicFont=*-italic]
\\setmathfont{latinmodern-math.otf}`;

const STIX_LATIN = `\\setmainfont{STIXTwoText}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-SemiBold, ItalicFont=*-Italic, BoldItalicFont=*-SemiBoldItalic]
\\setsansfont{lmsans10}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-oblique, BoldItalicFont=*-boldoblique, Scale=MatchLowercase]
\\setmonofont{lmmono10}[Extension=.otf, UprightFont=*-regular, ItalicFont=*-italic, Scale=MatchLowercase]
\\setmathfont{STIXTwoMath-Regular.otf}`;

function header(conv, opts) {
  return [
    '% !TEX program = xelatex',
    `% ${conv.title}`,
    `% 由 墨誊 Moteng 从 ${conv.platformName} 对话网页生成${conv.url ? `：${conv.url}` : ''}`,
    '% 编译：xelatex（需要同目录下的 moteng.sty' + (opts.style === 'notes' ? ' 与墨经 mojing-*.cls/.sty' : '') + '）',
    '',
  ].join('\n');
}

function chatPreamble(conv, opts) {
  const size = { small: '5', normal: '5', large: '-4' }[opts.fontSize || 'normal'] || '5';
  const paper = opts.paper === 'b5' ? 'b5paper' : 'a4paper';
  const margins = opts.paper === 'b5' ? 'top=20mm, bottom=20mm, left=18mm, right=18mm' : 'top=22mm, bottom=22mm, left=22mm, right=22mm';
  const fonts = opts.fonts && !opts.safeFonts ? cjkFontTeX(opts.fonts) : '';
  const mono = opts.fonts && !opts.safeFonts ? monoFontTeX(opts.fonts) : '';
  return `${header(conv, opts)}\\documentclass[UTF8, ${paper}, zihao=${size}, fontset=fandol, linespread=1.25]{ctexart}
\\usepackage[${paper}, ${margins}, headheight=14pt]{geometry}
\\usepackage{amsmath, amssymb, mathtools}
\\usepackage[warnings-off={mathtools-colon, mathtools-overbracket}]{unicode-math}
${opts.safeFonts ? SAFE_LATIN : STIX_LATIN}
${fonts}
${mono}
\\usepackage{fancyhdr}
\\usepackage[style=chat]{moteng}
\\ctexset{
  section={format=\\raggedright\\Large\\sffamily\\bfseries\\color{mtInk}, beforeskip=1.4\\baselineskip, afterskip=.6\\baselineskip},
  subsection={format=\\raggedright\\large\\sffamily\\bfseries\\color{mtInk}, beforeskip=1.1\\baselineskip, afterskip=.4\\baselineskip},
  subsubsection={format=\\raggedright\\normalsize\\sffamily\\bfseries\\color{mtInk}, beforeskip=.9\\baselineskip, afterskip=.3\\baselineskip},
  paragraph={format=\\normalsize\\bfseries\\color{mtInk}, beforeskip=.6\\baselineskip, afterskip=1em},
}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\fancyhead[L]{\\small\\color{mtGray}${escapeText(shorten(conv.title, 40))}}
\\fancyhead[R]{\\small\\color{mtGray}\\thepage}
\\hypersetup{pdftitle={${escapeBookmark(conv.title)}}, pdfcreator={Moteng}, pdfsubject={${escapeBookmark(conv.platformName)}}}
\\setlength{\\parskip}{.35\\baselineskip}
\\setlength{\\parindent}{0pt}
`;
}

function notesPreamble(conv, opts) {
  const fonts = opts.fonts && !opts.safeFonts ? cjkFontTeX(opts.fonts) : '';
  const mono = opts.fonts && !opts.safeFonts ? monoFontTeX(opts.fonts) : '';
  const latin = opts.safeFonts ? ', latin=lm' : '';
  const classOpts = ['nomargin', 'cjk=fandol'];
  return `${header(conv, opts)}\\documentclass[${classOpts.join(', ')}${latin}]{mojing-notes}
\\usepackage[style=notes]{moteng}
${fonts}
${mono}
\\course{${escapeText(conv.title)}}
\\term{${escapeText([conv.platformName + ' 对话', fmtDate(conv.date)].filter(Boolean).join(' · '))}}
\\instructor{${escapeText(conv.assistantName)}}
\\hypersetup{pdftitle={${escapeBookmark(conv.title)}}, pdfcreator={Moteng}}
`;
}

/**
 * @returns {{ tex, map, kinds, warnings, turns }}
 */
export function renderTex(conv, opts, fallback = new Set()) {
  const style = opts.style === 'notes' ? 'notes' : 'chat';
  const turns = turnsOf(conv.messages);
  const out = [];
  const writerOpts = { headingToc: true };
  const w = new Writer(writerOpts, fallback);
  const answerName = conv.assistantName || 'AI';

  if (style === 'chat') {
    out.push(chatPreamble(conv, opts));
    out.push('\\begin{document}');
    const meta = [conv.platformName, fmtDate(conv.date)].filter(Boolean).map(escapeText);
    out.push(`\\begin{center}
{\\LARGE\\sffamily\\bfseries\\color{mtInk} ${escapeText(conv.title)}\\par}
\\smallskip
{\\small\\color{mtGray} ${meta.join(' \\quad·\\quad ')}${conv.url && /^https?:/.test(conv.url) ? ` \\quad·\\quad \\href{${escapeUrl(conv.url)}}{${escapeCode(shortUrl(conv.url))}}` : ''}\\par}
\\end{center}
\\mtrule`);
    if (opts.toc ?? turns.length >= 4) out.push('{\\small\\tableofcontents}\n\\mtrule');
    turns.forEach((turn, k) => {
      const base = minHeading(turn.answer);
      w.opts.headingCmds = ['section', 'subsection', 'subsubsection', 'paragraph'];
      w.opts.headingBase = base;
      w.opts.headingNumbered = false;
      if (turn.question) {
        const label = turns.filter((t) => t.question).length > 1 ? `问题 ${turns.slice(0, k + 1).filter((t) => t.question).length}` : '问题';
        const summary = shorten(firstText(turn.question) || label, 40);
        out.push(`\\phantomsection\\addcontentsline{toc}{section}{${escapeText(label)}：${escapeText(summary)}}`);
        if (opts.includeQuestions !== false) {
          out.push(`\\begin{mtquestion}{${escapeText(label)}}\n${w.prompt(turn.question, `t${k}.q`)}\n\\end{mtquestion}`);
        }
      }
      if (turn.answer.length) {
        out.push(`\\mtanswerhead{${escapeText(answerName)}}`);
        // The answer's own top-level headings go one level under the question entry.
        w.opts.headingCmds = ['subsection', 'subsubsection', 'paragraph', 'textbf'];
        out.push(w.blocks(turn.answer, `t${k}.a`));
      }
      if (k < turns.length - 1) out.push('\\mtturnsep');
    });
    out.push('\\end{document}\n');
  } else {
    out.push(notesPreamble(conv, opts));
    out.push('\\begin{document}');
    const asked = turns.filter((t) => t.question);
    const avg = turns.reduce((a, t) => a + blockTextLength(t.answer), 0) / Math.max(1, turns.length);
    // Many short exchanges read better as sections of one lecture than as many lectures.
    const compact = turns.length > 3 && avg < 1500;
    const lectureTitle = (turn, i) => (turns.length === 1 ? conv.title : shorten(firstText(turn.question) || `第 ${i + 1} 部分`, 30));
    if (turns.length >= 3 && !compact) out.push('\\tableofcontents');
    const date = fmtDate(conv.date);
    const lectureOpts = (short) => [`short={${escapeText(short)}}`, date ? `date={${escapeText(date)}}` : '', 'scribe={墨誊 Moteng}'].filter(Boolean).join(', ');
    if (compact) out.push(`\\lecture[${lectureOpts(shorten(conv.title, 18))}]{${escapeText(conv.title)}}`);
    turns.forEach((turn, k) => {
      const base = minHeading(turn.answer);
      w.opts.headingBase = base;
      w.opts.headingNumbered = true;
      if (compact) {
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
  return { tex, map, kinds: w.kinds, warnings: w.warnings, turns: turns.length };
}
