// Text sources that are not saved web pages:
//   • Markdown / plain text: a copied answer, or a transcript written by an exporter extension
//     ("## Prompt:" / "## Response:", "**User:**", "### 你说：" …)
//   • JSON: ChatGPT's data export (conversations.json, one or many conversations), Claude's export,
//     or a plain [{ role, content }] list.
// Each becomes HTML that the normal extractor understands: one element per message with
// data-message-author-role, Markdown rendered to HTML, formulas as data-latex / .math-block.

import { Marked } from 'marked';

const marked = new Marked({ gfm: true, breaks: false });

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ChatGPT's export marks citations with private-use characters: "citeturn0search1".
function stripCitations(s) {
  return String(s)
    .replace(/[^]*/g, '')
    .replace(/【\d+(?::\d+)?†[^】]*】/g, '')
    .replace(/[-]/g, '');
}

/**
 * Markdown (with TeX between $…$, $$…$$, \(…\), \[…\]) → HTML.
 * Code is protected first, so a "$" inside code is never a formula.
 */
export function markdownToHtml(md) {
  const store = [];
  const hold = (html) => `MOTENGPH${store.push(html) - 1}X`;
  let src = stripCitations(String(md).replace(/\r\n?/g, '\n'));
  // Fenced code.
  src = src.replace(/(^|\n)([ \t]*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\2\3[ \t]*(?=\n|$)/g, (_, pre, indent, fence, info, body) => {
    const lang = info.trim().split(/\s+/)[0] || '';
    return `${pre}\n${hold(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(body)}</code></pre>`)}\n`;
  });
  // Inline code.
  src = src.replace(/(`+)([^`\n][\s\S]*?[^`\n]|[^`\n])\1(?!`)/g, (_, ticks, body) => hold(`<code>${escapeHtml(body.trim())}</code>`));
  // Display math.
  const display = (tex) => `\n\n${hold(`<div class="math-block" data-math="${escapeHtml(tex.trim())}"></div>`)}\n\n`;
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => display(tex));
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => display(tex));
  // Inline math.
  const inline = (tex) => hold(`<span class="math-inline" data-latex="${escapeHtml(tex.trim())}"></span>`);
  src = src.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => inline(tex));
  src = src.replace(/(?<![\\$\w])\$(?![\s$])((?:\\\$|[^$\n])+?)(?<![\s\\])\$(?![\w$])/g, (m, tex) => {
    // "$5 and $10" is money.
    if (!/[\\^_=+\-*/<>()a-zA-Z]/.test(tex) || /^\d+([.,]\d+)?$/.test(tex.trim())) return m;
    return inline(tex);
  });
  let html = marked.parse(src);
  // A display formula alone in a paragraph: drop the paragraph.
  html = html.replace(/<p>\s*(MOTENGPH\d+X)\s*<\/p>/g, '$1');
  for (let i = 0; i < 3 && /MOTENGPH\d+X/.test(html); i++) html = html.replace(/MOTENGPH(\d+)X/g, (_, n) => store[+n]);
  return html;
}

// ---------------------------------------------------------------------------
// Transcripts
// ---------------------------------------------------------------------------

const USER_WORDS = 'user|you|human|me|prompt|question|q|用户|我|你|你说|提问|问题|问';
const AI_WORDS = 'assistant|ai|chatgpt|gpt-?[\\w.-]*|claude|gemini|deepseek|kimi|grok|copilot|bot|response|answer|a|助手|回答|答|chatgpt\\s*说|ai\\s*说';
const MARKER = new RegExp(`^\\s*(?:#{1,6}\\s*|>\\s*)?(?:\\*\\*|__)?\\s*(${USER_WORDS}|${AI_WORDS})\\s*(?:\\*\\*|__)?\\s*[:：]?\\s*(?:\\*\\*|__)?\\s*[:：]?\\s*$`, 'i');
const USER_RE = new RegExp(`^(${USER_WORDS})$`, 'i');

/** Split a Markdown transcript into messages; null when the text has no speaker markers. */
export function splitTranscript(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const marks = [];
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) return;
    const m = line.match(MARKER);
    // A speaker line is a heading, bold, or ends with a colon; one-letter names ("问", "Q") need the colon.
    const styled = /^\s*(#|>|\*\*|__)/.test(line);
    const colon = /[:：]\s*(\*\*|__)?\s*$/.test(line);
    if (m && (colon || (styled && [...m[1].trim()].length > 1))) marks.push({ i, role: USER_RE.test(m[1].trim().replace(/\s+/g, '')) || USER_RE.test(m[1].trim()) ? 'user' : 'assistant' });
  });
  const roles = new Set(marks.map((m) => m.role));
  if (marks.length < 2 || roles.size < 2) return null;
  const messages = [];
  const head = lines.slice(0, marks[0].i).join('\n');
  marks.forEach((m, k) => {
    const body = lines.slice(m.i + 1, k + 1 < marks.length ? marks[k + 1].i : lines.length).join('\n').replace(/^\s*(---|\*\*\*)\s*$/gm, '').trim();
    if (body) messages.push({ role: m.role, text: body });
  });
  return { head, messages };
}

function titleFromMarkdown(md) {
  const m = String(md).match(/^\s*#\s+(.+)$/m);
  return m ? m[1].replace(/[*_`]/g, '').trim() : '';
}

/** Messages → a page the extractor reads with its generic rules. */
export function conversationHtml({ title = '', messages }) {
  const body = messages.map((m) => {
    const inner = m.role === 'user'
      ? `<div class="whitespace-pre-wrap">${escapeHtml(m.text)}</div>`
      : `<div class="markdown">${markdownToHtml(m.text)}</div>`;
    return `<div data-message-author-role="${m.role === 'user' ? 'user' : 'assistant'}">${inner}</div>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><main>${body}</main></body></html>`;
}

export function loadMarkdownText(text, name) {
  const t = splitTranscript(text);
  if (t) {
    const title = titleFromMarkdown(t.head) || name;
    return { html: conversationHtml({ title, messages: t.messages }), meta: { title, platformName: 'Markdown 对话记录' } };
  }
  const title = titleFromMarkdown(text) || name;
  const md = String(text).replace(/^\s*#\s+.+\n/, '');
  return {
    html: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><main><div data-message-author-role="assistant"><div class="markdown">${markdownToHtml(md)}</div></div></main></body></html>`,
    meta: { title, platformName: 'Markdown 文档' },
  };
}

// ---------------------------------------------------------------------------
// JSON exports
// ---------------------------------------------------------------------------

function partText(p) {
  if (typeof p === 'string') return p;
  if (p && typeof p.text === 'string') return p.text;
  return '';
}

// ChatGPT data export: { title, create_time, mapping: { id: { message, parent, children } }, current_node }
function chatgptMessages(c) {
  const map = c.mapping || {};
  let id = c.current_node;
  if (!id || !map[id]) {
    // No current node recorded: follow the first child from the root.
    id = Object.keys(map).find((k) => !map[k].parent) || null;
    while (id && map[id] && map[id].children && map[id].children.length) id = map[id].children.at(-1);
  }
  const chain = [];
  for (let guard = 0; id && map[id] && guard < 100000; guard++) {
    chain.push(map[id]);
    id = map[id].parent;
  }
  chain.reverse();
  const out = [];
  for (const node of chain) {
    const m = node.message;
    if (!m || !m.author) continue;
    const role = m.author.role;
    if (role !== 'user' && role !== 'assistant') continue;
    if (m.metadata && (m.metadata.is_visually_hidden_from_conversation || m.metadata.is_user_system_message)) continue;
    if (role === 'assistant' && m.recipient && m.recipient !== 'all') continue;
    const ct = m.content || {};
    if (ct.content_type && !/^(text|multimodal_text)$/.test(ct.content_type)) continue;
    const text = (ct.parts || []).map(partText).filter(Boolean).join('\n\n').trim();
    if (!text) continue;
    const prev = out.at(-1);
    if (prev && prev.role === role) prev.text += `\n\n${text}`;
    else out.push({ role, text });
  }
  return out;
}

// Claude export: { name, created_at, chat_messages: [{ sender: human|assistant, text, content: [{ type, text }] }] }
function claudeMessages(c) {
  return (c.chat_messages || []).map((m) => ({
    role: m.sender === 'human' ? 'user' : 'assistant',
    text: (Array.isArray(m.content) && m.content.length ? m.content.filter((p) => p.type === 'text').map((p) => p.text).join('\n\n') : m.text || '').trim(),
  })).filter((m) => m.text);
}

function genericMessages(list) {
  return list.map((m) => ({
    role: /^(user|human)$/i.test(m.role || m.author || m.sender || '') ? 'user' : 'assistant',
    text: (typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map(partText).join('\n\n') : m.text || '').trim(),
  })).filter((m) => m.text && !/^system$/i.test(m.role));
}

function unixDate(v) {
  if (!v) return null;
  const d = typeof v === 'number' ? new Date(v * (v < 1e12 ? 1000 : 1)) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** All conversations in a JSON export: [{ title, date, platformName, assistantName, messages }]. */
export function conversationsFromJson(text) {
  let data;
  try { data = JSON.parse(String(text).replace(/^﻿/, '')); } catch (e) { throw new Error(`不是有效的 JSON 文件：${e.message}`); }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.conversations) ? data.conversations : [data];
  const out = [];
  if (list.length && list.every((m) => m && typeof m === 'object' && 'role' in m && !('mapping' in m))) {
    const messages = genericMessages(list);
    if (messages.length) out.push({ title: '', date: null, platformName: 'JSON 对话记录', assistantName: 'AI', messages });
    return out;
  }
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    if (c.mapping) {
      const messages = chatgptMessages(c);
      if (messages.length) out.push({ title: c.title || '', date: unixDate(c.create_time), platformName: 'ChatGPT（导出数据）', assistantName: 'ChatGPT', messages });
    } else if (Array.isArray(c.chat_messages)) {
      const messages = claudeMessages(c);
      if (messages.length) out.push({ title: c.name || '', date: unixDate(c.created_at), platformName: 'Claude（导出数据）', assistantName: 'Claude', messages });
    } else if (Array.isArray(c.messages)) {
      const messages = genericMessages(c.messages);
      if (messages.length) out.push({ title: c.title || c.name || '', date: unixDate(c.create_time || c.created_at), platformName: 'JSON 对话记录', assistantName: 'AI', messages });
    }
  }
  return out;
}
