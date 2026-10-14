// Markdown + LaTeX rendering for untrusted model output. Pipeline: shield code → extract math →
// marked → KaTeX → DOMPurify. Everything inserted into the DOM goes through sanitize().
import { marked } from '/vendor/marked.esm.js';
import katex from '/vendor/katex/katex.mjs';
import DOMPurify from '/vendor/purify.es.mjs';
import { KIND, OTYPE, SEV, VERDICT, POS } from './fmt.js';

marked.setOptions({ gfm: true, breaks: true });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const PURIFY = {
  USE_PROFILES: { html: true, mathMl: true, svg: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed'],
  ADD_ATTR: ['target'],
};

export function sanitize(html) {
  return DOMPurify.sanitize(html, PURIFY);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function tex(src, display) {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false, maxExpand: 2000, maxSize: 40, output: 'htmlAndMathml' });
  } catch {
    return `<code>${esc(src)}</code>`;
  }
}

/** Markdown + math → HTML string (NOT yet sanitized). */
function mdRaw(src) {
  const code = [];
  const math = [];
  let s = String(src ?? '');
  s = s.replace(/```[\s\S]*?(```|$)|`[^`\n]+`/g, (m) => `\u0001${code.push(m) - 1}\u0001`);
  const keep = (display) => (m, body) => `@@M${math.push(tex(body.trim(), display)) - 1}@@`;
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, keep(true));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, keep(true));
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, keep(false));
  s = s.replace(/(?<![\\$\w])\$(?!\s)([^\n$]+?)(?<![\s\\])\$(?![\d$])/g, keep(false));
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => code[+i]);
  let html = marked.parse(s);
  html = html.replace(/@@M(\d+)@@/g, (_, i) => math[+i]);
  return html;
}

const cache = new Map();
export function md(src) {
  const key = String(src ?? '');
  let v = cache.get(key);
  if (v === undefined) {
    v = sanitize(mdRaw(key));
    if (cache.size > 3000) cache.delete(cache.keys().next().value);
    cache.set(key, v);
  }
  return v;
}

/** Inline (single paragraph) rendering, e.g. for statements in compact lists. */
export function mdInline(src) {
  const html = md(src);
  return html.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
}

// ───────────────────────── protocol tags → cards ─────────────────────────

const TAGS = ['claim', 'objection', 'response', 'verdict', 'ruling', 'compute', 'question', 'withdraw', 'stance', 'summary', 'focus', 'assign', 'decision'];
const TAG_RE = new RegExp(`<(${TAGS.join('|')})\\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\\/>|>([\\s\\S]*?)<\\/\\1\\s*>)`, 'gi');
const attrs = (s) => Object.fromEntries([...String(s || '').matchAll(/([a-zA-Z_][\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>/]+))/g)].map((m) => [m[1].toLowerCase(), m[3] ?? m[4] ?? m[5] ?? '']));
const inner = (body, t) => (String(body).match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}\\s*>`, 'i')) || [])[1]?.trim() || '';
const strip = (body, ts) => ts.reduce((s, t) => s.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*?<\\/${t}\\s*>`, 'gi'), ''), String(body)).trim();

const REL = { proves: '证明', refutes: '否定', supports: '支持', generalizes: '推广' };
const ACT = { concede: '承认', rebut: '反驳', revise: '修订' };
const RUL = { upheld: '质疑成立', dismissed: '质疑驳回' };

function card(cls, label, head, body) {
  return `<div class="tagcard ${cls}"><div class="tg"><span class="k">${label}</span>${head}</div>${body ? `<div class="tb">${body}</div>` : ''}</div>`;
}

function tagHtml(tag, a, body, mapping) {
  const ref = (r) => esc(mapping?.[String(r || '').toLowerCase()] || r || '');
  switch (tag) {
    case 'claim': {
      const st = inner(body, 'statement') || strip(body, ['proof', 'evidence']);
      const proof = inner(body, 'proof');
      const ev = inner(body, 'evidence');
      const id = mapping?.[String(a.ref || '').toLowerCase()];
      const head = `${id ? `<span class="ref">${esc(id)}</span>` : ''} ${esc(KIND[a.kind] || a.kind || '断言')}${a.relation ? ` · ${esc(REL[a.relation] || a.relation)} ${esc(a.target || 'C0')}` : ''}${a.depends ? ` · 依赖 ${esc(a.depends)}` : ''}${a.confidence ? ` · 置信 ${esc(a.confidence)}` : ''}`;
      return card('claim-t', 'CLAIM', head, `${mdRaw(st)}${proof ? `<details${proof.length < 700 ? ' open' : ''}><summary class="lab">PROOF · 证明</summary>${mdRaw(proof)}</details>` : ''}${ev ? `<div class="lab">EVIDENCE</div>${mdRaw(ev)}` : ''}`);
    }
    case 'objection': {
      const ce = inner(body, 'counterexample');
      return card('objection-t', 'OBJECTION', `→ <span class="ref">${ref(a.target)}</span> · ${esc(OTYPE[a.type] || a.type || '')} · ${esc(SEV[a.severity] || a.severity || '')}`, `${mdRaw(strip(body, ['counterexample']))}${ce ? `<div class="lab">COUNTEREXAMPLE · 反例</div>${mdRaw(ce)}` : ''}`);
    }
    case 'response': {
      const rs = inner(body, 'revised_statement');
      const rp = inner(body, 'revised_proof');
      return card('response-t', 'RESPONSE', `<span class="ref">${ref(a.objection || a.target)}</span> · ${esc(ACT[a.action] || a.action || '')}`, `${mdRaw(strip(body, ['revised_statement', 'revised_proof']))}${rs ? `<div class="lab">REVISED STATEMENT</div>${mdRaw(rs)}` : ''}${rp ? `<details><summary class="lab">REVISED PROOF</summary>${mdRaw(rp)}</details>` : ''}`);
    }
    case 'verdict': return card('verdict-t', 'VERDICT', `<span class="ref">${ref(a.target)}</span> · ${esc(VERDICT[a.result] || a.result || '')}`, mdRaw(body));
    case 'ruling': return card('ruling-t', 'RULING', `<span class="ref">${ref(a.objection || a.target)}</span> · ${esc(RUL[a.result] || a.result || '')}`, mdRaw(body));
    case 'compute': return card('compute-t', 'COMPUTE', esc(a.purpose || '计算实验'), `<pre><code>${esc(body.replace(/^```[\w-]*\n?|```$/g, ''))}</code></pre>`);
    case 'question': return card('', 'QUESTION', '开放问题', mdRaw(body));
    case 'withdraw': return card('objection-t', 'WITHDRAW', `撤回 <span class="ref">${ref(a.target)}</span>`, mdRaw(body));
    case 'stance': return `<span class="stance-chip ${esc(a.position)}">${esc(ref(a.target || 'C0'))} · ${esc(POS[a.position] || a.position || '')}${a.confidence ? ` · ${esc(a.confidence)}` : ''}${body ? ` — ${esc(body.slice(0, 80))}` : ''}</span>`;
    case 'summary': return card('summary-t', 'SUMMARY', '本轮综合', mdRaw(body));
    case 'focus': return card('summary-t', 'FOCUS', `<span class="ref">${ref(a.target)}</span>${a.priority === 'high' ? ' · 高优先级' : ''}`, mdRaw(body));
    case 'assign': return card('summary-t', 'ASSIGN', `研究员 ${esc(a.researcher)} · ${esc(a.task || '')}${a.target ? ` → <span class="ref">${ref(a.target)}</span>` : ''}`, mdRaw(body));
    case 'decision': return card('summary-t', 'DECISION', a.value === 'conclude' ? '结束研究' : '继续研究', mdRaw(body));
    default: return '';
  }
}

/** Render a researcher's answer: prose as Markdown, protocol tags as structured cards. */
export function renderContribution(text, mapping = {}) {
  const src = String(text || '');
  let out = '';
  let last = 0;
  for (const m of src.matchAll(TAG_RE)) {
    out += mdRaw(src.slice(last, m.index));
    out += tagHtml(m[1].toLowerCase(), attrs(m[2]), (m[4] ?? '').trim(), mapping);
    last = m.index + m[0].length;
  }
  out += mdRaw(src.slice(last));
  return sanitize(out);
}

/** Wrap ledger references (C3, O2, E1) in clickable spans, skipping code and math. */
export function linkRefs(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('code, pre, .katex, .ref') ? NodeFilter.FILTER_REJECT : /\b[COE]\d+\b/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of n.nodeValue.matchAll(/\b([COE]\d+)\b/g)) {
      frag.append(n.nodeValue.slice(last, m.index));
      const s = document.createElement('span');
      s.className = 'ref';
      s.dataset.ref = m[1];
      s.textContent = m[1];
      frag.append(s);
      last = m.index + m[0].length;
    }
    frag.append(n.nodeValue.slice(last));
    n.replaceWith(frag);
  }
  for (const s of root.querySelectorAll('.ref:not([data-ref])')) s.dataset.ref = s.textContent.trim();
  return root;
}
