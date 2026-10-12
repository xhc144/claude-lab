// Turns untrusted e-mail HTML / text into a self-contained, script-free document for a sandboxed iframe.
import DOMPurify from 'dompurify';
import type { AttachmentInfo } from '@shared/types';

export interface EmailDocOptions {
  html: string | null;
  text: string | null;
  messageId: number;
  attachments: AttachmentInfo[];
  allowRemote: boolean;
  dark: boolean;
  darkMode: 'original' | 'adaptive';
  collapseQuotes: boolean;
}

export interface EmailDoc {
  doc: string;
  remoteCount: number;
  isPlain: boolean;
  themed: boolean;
}

const REMOTE_RE = /^(https?:)?\/\//i;
const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const CSS_URL_RE = /url\(\s*(['"]?)(https?:)?\/\/[^)]*\1\s*\)/gi;

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Plain text → HTML with links, e-mail addresses and nested quote levels. */
export function textToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let depth = 0;
  const linkify = (s: string) =>
    escapeHtml(s)
      .replace(/\b(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}，。；：！？）】])/g, '<a href="$1">$1</a>')
      .replace(/(^|[\s(（])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1<a href="mailto:$2">$2</a>');
  for (const line of lines) {
    const m = /^((?:>\s?)+)/.exec(line);
    const level = m ? (m[1].match(/>/g) || []).length : 0;
    while (depth < level) { html += '<blockquote class="hy-tq">'; depth++; }
    while (depth > level) { html += '</blockquote>'; depth--; }
    html += linkify(m ? line.slice(m[1].length) : line) + '\n';
  }
  while (depth-- > 0) html += '</blockquote>';
  return `<div class="hy-plain">${html}</div>`;
}

const QUOTE_SELECTORS = [
  '.gmail_quote', 'blockquote[type="cite"]', '.moz-cite-prefix', '#divRplyFwdMsg', '#appendonsend', '.yahoo_quoted',
  'div[name="divRplyFwdMsg"]', '.OutlookMessageHeader', '#reply-intro', '.protonmail_quote', '.zmail_extra'
];

function collapseQuotes(doc: Document) {
  const body = doc.body;
  if (!body) return;
  let start: Element | null = null;
  for (const sel of QUOTE_SELECTORS) {
    const el = body.querySelector(sel);
    if (el && (!start || (start.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING))) start = el;
  }
  if (!start) {
    // Text markers used by QQ / Foxmail / NetEase / Outlook web.
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (/^\s*(-{3,}\s*(原始邮件|Original Message|Forwarded message|转发的邮件)\s*-{3,}|在\s.{4,60}写道[:：]\s*$|On\s.{6,120}wrote:\s*$)/i.test(n.textContent || '')) {
        start = n.parentElement;
        break;
      }
    }
  }
  if (!start || start === body) return;
  // Climb to the direct child of body so that everything after the quote start can be folded.
  let anchor: Element = start;
  while (anchor.parentElement && anchor.parentElement !== body && anchor.parentElement.children.length === 1) anchor = anchor.parentElement;
  const parent = anchor.parentElement;
  if (!parent) return;
  const toMove: Node[] = [];
  let cur: Node | null = anchor;
  while (cur) { toMove.push(cur); cur = cur.nextSibling; }
  const textBefore = (body.textContent || '').length - toMove.reduce((s, x) => s + (x.textContent || '').length, 0);
  if (textBefore < 2) return; // the whole message is a quote: don't hide it
  const details = doc.createElement('details');
  details.className = 'hy-fold';
  const summary = doc.createElement('summary');
  summary.title = '显示引用的内容';
  summary.textContent = '···';
  details.appendChild(summary);
  parent.insertBefore(details, anchor);
  for (const x of toMove) details.appendChild(x);
}

function baseCss(o: { dark: boolean; themed: boolean; isPlain: boolean; adaptive: boolean; paper: boolean }) {
  const text = o.themed && o.dark ? '#e9e5de' : '#1d1b17';
  const muted = o.themed && o.dark ? '#a39d93' : '#6d675e';
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d0432a';
  return `
  :root { color-scheme: ${o.themed && o.dark ? 'dark' : 'light'}; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { font-family: "Inter Variable", "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif; font-size: 14.5px; line-height: 1.65;
    color: ${text}; overflow-wrap: anywhere; word-break: normal; -webkit-font-smoothing: antialiased; padding: ${o.paper ? '18px 22px 20px' : '2px 2px 8px'}; overflow: hidden; }
  img { max-width: 100%; height: auto; }
  img[data-hy-blocked] { background: repeating-linear-gradient(135deg, rgba(128,128,128,.07) 0 6px, rgba(128,128,128,.13) 6px 12px); border-radius: 4px; }
  img[data-hy-pixel] { display: none !important; }
  pre, code { white-space: pre-wrap; font-family: "Cascadia Code", Consolas, monospace; font-size: 13px; }
  a { color: ${accent}; }
  table { border-collapse: collapse; }
  .hy-plain { white-space: pre-wrap; font-size: 14.5px; line-height: 1.7; }
  blockquote.hy-tq, .hy-plain blockquote { margin: 0 0 0 2px; padding: 0 0 0 12px; border-left: 3px solid ${o.dark && o.themed ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)'}; color: ${muted}; }
  details.hy-fold { margin-top: 10px; }
  details.hy-fold > summary { list-style: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 16px; line-height: 10px;
    border-radius: 8px; cursor: pointer; color: ${muted}; background: ${o.dark && o.themed ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}; font-size: 13px; letter-spacing: 1px; user-select: none; }
  details.hy-fold > summary::-webkit-details-marker { display: none; }
  details.hy-fold > summary:hover { background: ${o.dark && o.themed ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.1)'}; }
  details.hy-fold[open] > summary { margin-bottom: 8px; }
  ${o.adaptive ? `
  html { filter: invert(0.92) hue-rotate(180deg); }
  img, video, picture, svg image, [style*="background-image"], [background] { filter: invert(1) hue-rotate(180deg); }
  ` : ''}
  ::selection { background: ${accent}33; }
  `;
}

export function buildEmailDoc(o: EmailDocOptions): EmailDoc {
  const isPlain = !o.html;
  const themed = isPlain;
  const adaptive = !isPlain && o.dark && o.darkMode === 'adaptive';
  const source = o.html ?? textToHtml(o.text || '');
  let remoteCount = 0;
  const cidMap = new Map<string, number>();
  for (const a of o.attachments) if (a.contentId) cidMap.set(a.contentId.toLowerCase(), a.index);
  const resolveCid = (v: string) => {
    const idx = cidMap.get(v.slice(4).trim().toLowerCase());
    return idx !== undefined ? `hy-att://m/${o.messageId}/${idx}` : '';
  };

  DOMPurify.removeAllHooks();
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;
    for (const attr of ['src', 'background', 'poster']) {
      const v = el.getAttribute?.(attr);
      if (!v) continue;
      if (/^cid:/i.test(v)) {
        el.setAttribute(attr, resolveCid(v));
      } else if (REMOTE_RE.test(v)) {
        remoteCount++;
        if (!o.allowRemote) {
          el.setAttribute('data-hy-blocked', '');
          // a transparent pixel keeps the layout without the browser's broken-image icon
          if (attr === 'src') el.setAttribute('src', BLANK_GIF);
          else el.removeAttribute(attr);
          const w = Number(el.getAttribute('width') || 0);
          const h = Number(el.getAttribute('height') || 0);
          if ((w && w <= 2) || (h && h <= 2)) el.setAttribute('data-hy-pixel', '');
        } else if (v.startsWith('//')) el.setAttribute(attr, 'https:' + v);
      }
    }
    if (el.hasAttribute?.('srcset')) {
      if (!o.allowRemote) el.removeAttribute('srcset');
    }
    const style = el.getAttribute?.('style');
    if (style) {
      const matches = style.match(CSS_URL_RE);
      if (matches) remoteCount += matches.length;
      if (style.includes('cid:')) el.setAttribute('style', style.replace(/url\(\s*(['"]?)cid:([^'")]+)\1\s*\)/gi, (_m, _q, cid) => `url("${resolveCid('cid:' + cid)}")`));
    }
    if (el.tagName === 'A') {
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
  });

  const doc = DOMPurify.sanitize(source, {
    WHOLE_DOCUMENT: true,
    RETURN_DOM: false,
    ADD_TAGS: ['style'],
    ADD_ATTR: ['target', 'background', 'bgcolor', 'align', 'valign', 'cellpadding', 'cellspacing', 'border', 'width', 'height', 'color', 'face', 'size'],
    FORBID_TAGS: ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select', 'option', 'meta', 'link', 'base', 'audio', 'video', 'source', 'track', 'portal'],
    FORBID_ATTR: ['srcdoc', 'formaction', 'action', 'ping'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|cid|hy-att|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
  }) as unknown as string;
  DOMPurify.removeAllHooks();

  // Count url(...) inside <style> blocks too.
  const styleRemote = (doc.match(/<style[\s\S]*?<\/style>/gi) || []).join('').match(CSS_URL_RE);
  if (styleRemote) remoteCount += styleRemote.length;

  const parsed = new DOMParser().parseFromString(doc, 'text/html');
  if (o.collapseQuotes) collapseQuotes(parsed);
  const head = parsed.head;
  const csp = parsed.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', `default-src 'none'; style-src 'unsafe-inline'; img-src data: hy-att: ${o.allowRemote ? 'https: http:' : ''}; font-src data: ${o.allowRemote ? 'https:' : ''}; media-src hy-att: data:`);
  head.prepend(csp);
  const base = parsed.createElement('base');
  base.setAttribute('target', '_blank');
  head.prepend(base);
  const style = parsed.createElement('style');
  style.textContent = baseCss({ dark: o.dark, themed, isPlain, adaptive, paper: o.dark && !themed && !adaptive });
  head.prepend(style);
  return { doc: '<!doctype html>' + parsed.documentElement.outerHTML, remoteCount, isPlain, themed: themed || adaptive };
}

/** Sanitises HTML for the compose editor (quoted replies, pasted content). */
export function sanitizeForEditor(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base', 'title', 'head'],
    FORBID_ATTR: ['srcdoc', 'formaction', 'action', 'contenteditable'],
    ALLOW_DATA_ATTR: false
  }) as unknown as string;
}
