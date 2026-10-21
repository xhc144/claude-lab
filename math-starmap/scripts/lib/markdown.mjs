// A small Markdown → HTML compiler for the knowledge base, run at build time.
//
// Math is cut out first, so Markdown never touches TeX:
//   $…$   → <span class="m">TeX</span>        $$…$$ → <div class="mb">TeX</div>
// The browser typesets these with KaTeX; the build checks every snippet with the same KaTeX.
//
// Supported: paragraphs, #### headings, - / 1. lists (nested by indentation), > quotes and
// Obsidian callouts (> [!定理] 标题), | tables |, ``` code ```, ---, **bold**, *italic*, `code`,
// [text](url), and wiki links [[node-id]] / [[node-id|text]] that jump to another star.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

const PH = '\u0000';

/** Replace math with placeholders. Returns { text, math: [{ tex, display }] }. */
export function extractMath(src) {
  const math = [];
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && src[i + 1] === '$') { out += '$'; i += 2; continue; }
    if (c === '$') {
      const display = src[i + 1] === '$';
      const open = display ? 2 : 1;
      let j = i + open;
      let found = -1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$') {
          if (display) { if (src[j + 1] === '$') { found = j; break; } }
          else { found = j; break; }
        }
        if (!display && src[j] === '\n' && src[j + 1] === '\n') break; // inline math never spans paragraphs
        j++;
      }
      if (found < 0) throw new Error(`unclosed ${display ? '$$' : '$'} near: ${src.slice(i, i + 60).replace(/\n/g, '⏎')}`);
      const tex = src.slice(i + open, found).trim();
      if (!tex) throw new Error(`empty math near: ${src.slice(Math.max(0, i - 20), i + 20)}`);
      math.push({ tex, display });
      out += `${PH}${display ? 'D' : 'M'}${math.length - 1}${PH}`;
      i = found + open;
      continue;
    }
    out += c;
    i++;
  }
  return { text: out, math };
}

function inline(s, ctx) {
  let h = escapeHtml(s);
  const codes = [];
  h = h.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `${PH}C${codes.length - 1}${PH}`; });
  h = h.replace(/\[\[([a-z0-9][a-z0-9-]*)(?:\|([^\]]+))?\]\]/g, (_, id, text) => {
    ctx.links.add(id);
    return `<a class="wl" href="#/n/${id}" data-id="${id}">${text ?? `${PH}T${id}${PH}`}</a>`;
  });
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  h = h.replace(new RegExp(`${PH}C(\\d+)${PH}`, 'g'), (_, k) => `<code>${codes[+k]}</code>`);
  return h;
}

function restoreMath(h, math) {
  return h.replace(new RegExp(`${PH}([MD])(\\d+)${PH}`, 'g'), (_, kind, k) => {
    const m = math[+k];
    return kind === 'D' ? `<div class="mb">${escapeHtml(m.tex)}</div>` : `<span class="m">${escapeHtml(m.tex)}</span>`;
  });
}

const CALLOUT = {
  定义: 'def', 定理: 'thm', 命题: 'thm', 引理: 'thm', 推论: 'thm', 公式: 'thm', 定律: 'thm', 性质: 'thm', 不等式: 'thm',
  注: 'note', 注意: 'warn', 易错: 'warn', 直观: 'idea', 思路: 'idea', 例: 'ex', 例题: 'ex', 答: 'ex', 解: 'ex', 方法: 'idea', 算法: 'idea',
};

function parseBlocks(lines, ctx) {
  const html = [];
  let i = 0;
  const isBlank = (l) => /^\s*$/.test(l);
  const listRe = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }

    // fenced code
    if (/^\s*```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      html.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    // display math on its own line(s)
    const dm = new RegExp(`^\\s*${PH}D(\\d+)${PH}\\s*$`).exec(line);
    if (dm) { html.push(`${PH}D${dm[1]}${PH}`); i++; continue; }
    // headings inside a section
    const hm = /^(#{4,6})\s+(.*)$/.exec(line);
    if (hm) { const lv = hm[1].length; html.push(`<h${lv}>${inline(hm[2], ctx)}</h${lv}>`); i++; continue; }
    if (/^\s*---+\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

    // quote / callout
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*> ?/, ''));
      const cm = /^\[!([^\]]+)\]\s*(.*)$/.exec(body[0] || '');
      if (cm) {
        const kind = CALLOUT[cm[1]] || 'note';
        const title = cm[2] ? ` <span class="ct-t">${inline(cm[2], ctx)}</span>` : '';
        html.push(`<div class="callout c-${kind}"><div class="ct"><b>${escapeHtml(cm[1])}</b>${title}</div>${parseBlocks(body.slice(1), ctx)}</div>`);
      } else {
        html.push(`<blockquote>${parseBlocks(body, ctx)}</blockquote>`);
      }
      continue;
    }

    // table
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = row(line);
      const align = row(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(row(lines[i++]));
      const cell = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c, ctx)}</${tag}>`;
      html.push(`<div class="tbl"><table><thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, k) => cell('td', c, k)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    // list (nested by indentation)
    const lm = listRe.exec(line);
    if (lm) {
      const base = lm[1].length;
      const ordered = /\d/.test(lm[2]);
      const items = [];
      while (i < lines.length) {
        const m = listRe.exec(lines[i]);
        if (m && m[1].length === base && /\d/.test(m[2]) === ordered) {
          items.push([m[3]]);
          i++;
          continue;
        }
        if (isBlank(lines[i])) {
          // a blank line ends the list unless the next line continues it
          const next = lines[i + 1];
          const nm = next != null ? listRe.exec(next) : null;
          if (next != null && ((nm && nm[1].length >= base) || (/^\s+/.test(next) && (next.match(/^\s*/)[0].length > base)))) { items[items.length - 1].push(''); i++; continue; }
          break;
        }
        const indent = lines[i].match(/^\s*/)[0].length;
        if (indent > base) { items[items.length - 1].push(lines[i].slice(Math.min(indent, base + 2))); i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      const start = ordered ? parseInt(lm[2], 10) : 1;
      html.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>${items.map((it) => {
        const inner = parseBlocks(it, ctx);
        // a single paragraph item is shown without <p>
        const m = /^<p>([\s\S]*)<\/p>$/.exec(inner);
        return `<li>${m && !m[1].includes('<p>') ? m[1] : inner}</li>`;
      }).join('')}</${tag}>`);
      continue;
    }

    // paragraph
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !listRe.test(lines[i]) && !/^\s*>/.test(lines[i]) && !/^#{4,6}\s/.test(lines[i])
      && !new RegExp(`^\\s*${PH}D\\d+${PH}\\s*$`).test(lines[i]) && !/^\s*```/.test(lines[i]) && !(/^\s*\|/.test(lines[i]) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || ''))) {
      para.push(lines[i++].trim());
    }
    if (para.length) {
      // display math written inside a paragraph splits it into text / formula / text
      for (const part of para.join('\n').split(new RegExp(`(${PH}D\\d+${PH})`))) {
        if (new RegExp(`^${PH}D\\d+${PH}$`).test(part)) html.push(part);
        else if (part.trim()) html.push(`<p>${inline(part.trim(), ctx)}</p>`);
      }
    } else i++;
  }
  return html.join('');
}

/**
 * Compile Markdown to HTML. Returns { html, math, links }.
 * `title(id)` resolves the default text of a [[wiki link]] after all nodes are known.
 */
export function compile(src, { title } = {}) {
  const { text, math } = extractMath(src.replace(/\r\n?/g, '\n'));
  const ctx = { links: new Set() };
  let html = parseBlocks(text.split('\n'), ctx);
  // display math that ended up inside a paragraph (e.g. "如下：$$…$$") becomes its own block
  html = html.replace(new RegExp(`<p>${PH}D(\\d+)${PH}</p>`, 'g'), `${PH}D$1${PH}`);
  html = restoreMath(html, math);
  html = html.replace(new RegExp(`${PH}T([a-z0-9-]+)${PH}`, 'g'), (_, id) => escapeHtml(title ? title(id) : id));
  html = html.replace(/<p>\s*(<div class="mb">[\s\S]*?<\/div>)\s*<\/p>/g, '$1');
  html = html.replace(/\n/g, ' ');
  return { html, math, links: [...ctx.links] };
}

/** Plain text for search: math kept as TeX-free tokens, tags dropped. */
export function plainText(src) {
  return src
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([a-z0-9-]+)\]\]/g, ' ')
    .replace(/[#>*`|[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
