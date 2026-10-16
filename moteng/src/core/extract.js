// Saved page → conversation { title, platform, url, date, messages: [{ role, blocks }] }.

import { parseHTML } from 'linkedom';
import { PLATFORMS, detectPlatform, platformById } from './platforms.js';
import { blocksOf, promptBlocks, blockTextLength } from './ir.js';

function safeAll(root, sel) {
  if (!sel) return [];
  try { return [...root.querySelectorAll(sel)]; } catch { return []; }
}

function docOrder(document) {
  const order = new Map();
  let i = 0;
  for (const el of document.querySelectorAll('*')) order.set(el, i++);
  return order;
}

// Keep only elements not nested inside another element of the same set.
export function topLevel(els) {
  const set = new Set(els);
  return els.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
    return true;
  });
}

function insideChrome(el) {
  return !!el.closest('nav, aside, [role="navigation"], [role="complementary"], [data-app-shell-left-panel-appearance]');
}

function normRole(r) {
  const v = String(r || '').toLowerCase();
  if (/^(user|human|me|self|you|question|query)$/.test(v)) return 'user';
  if (/^(system|tool)$/.test(v)) return v;
  return 'assistant';
}

function findByPlatform(document, platform) {
  for (const gen of platform.messages) {
    const els = topLevel(safeAll(document, gen.sel)).filter((el) => !insideChrome(el));
    if (els.length) return els.map((el) => ({ el, role: normRole(gen.role(el)) }));
  }
  return [];
}

const MARKDOWN_ROOTS = '.markdown, .markdown-body, .prose, [class*="markdown"], [class*="Markdown"], .md-content, [class*="answer-content"], [class*="response-content"]';
const USER_ROOTS = '[class*="user-message"], [class*="userMessage"], [class*="user_message"], [class*="UserMessage"], [class*="human-message"], [class*="humanMessage"], [class*="user-bubble"], [class*="question-content"], [class*="query-text"], [data-testid*="user"], [data-role="user"], [data-author="user"], [data-sender="user"]';

function findGeneric(document, order) {
  const tagged = topLevel(safeAll(document, '[data-message-author-role], [data-role], [data-author], [data-sender]'))
    .filter((el) => !insideChrome(el) && el.textContent.trim());
  if (tagged.length >= 2) {
    return tagged.map((el) => ({
      el,
      role: normRole(el.getAttribute('data-message-author-role') || el.getAttribute('data-role') || el.getAttribute('data-author') || el.getAttribute('data-sender')),
    }));
  }
  const answers = topLevel(safeAll(document, MARKDOWN_ROOTS)).filter((el) => !insideChrome(el) && el.textContent.trim().length > 0);
  const answerSet = new Set(answers);
  const users = topLevel(safeAll(document, USER_ROOTS)).filter((el) => {
    if (insideChrome(el) || !el.textContent.trim()) return false;
    for (const a of answerSet) if (a.contains(el) || el.contains(a)) return false;
    return true;
  });
  const all = [...answers.map((el) => ({ el, role: 'assistant' })), ...users.map((el) => ({ el, role: 'user' }))];
  all.sort((a, b) => order.get(a.el) - order.get(b.el));
  return all;
}

function contentRoots(el, sel, thinkingSel) {
  if (!sel) return [el];
  const roots = topLevel(safeAll(el, sel)).filter((r) => !(thinkingSel && r.closest(thinkingSel) && r.closest(thinkingSel) !== el && el.contains(r.closest(thinkingSel))));
  if (el.matches?.(sel)) return [el];
  return roots.length ? roots : [el];
}

function stripSuffix(title, platform) {
  let t = (title || '').trim();
  if (platform?.titleSuffix) t = t.replace(platform.titleSuffix, '').trim();
  for (const p of PLATFORMS) t = t.replace(p.titleSuffix, '').trim();
  if (platform?.genericTitle && platform.genericTitle.test(t)) return '';
  return t;
}

function firstLine(blocks) {
  for (const b of blocks) {
    if (b.t === 'para' || b.t === 'heading') {
      const s = b.inl.map((x) => x.v || x.tex || (x.c ? x.c.map((y) => y.v || '').join('') : '')).join('').trim();
      if (s) return s;
    }
  }
  return '';
}

export function shorten(text, n = 36) {
  const s = text.replace(/\s+/g, ' ').trim();
  if ([...s].length <= n) return s;
  return [...s].slice(0, n).join('') + '…';
}

/**
 * @param {object} loaded  result of loadInput / loadHtmlString
 * @param {object} opts    { platform?: id, includeThinking?: bool }
 */
export function extractConversation(loaded, opts = {}) {
  const html = loaded.fragment ? `<!doctype html><html><head><meta charset="utf-8"></head><body>${loaded.html}</body></html>` : loaded.html;
  const { document } = parseHTML(html);
  const order = docOrder(document);
  let platform = opts.platform ? platformById(opts.platform) : detectPlatform(document, loaded.url);
  let found = platform ? findByPlatform(document, platform) : [];
  if (!found.length) {
    // The host was right but the layout is new, or the page is from another site.
    for (const p of PLATFORMS) {
      if (p === platform) continue;
      let hit = false;
      try { hit = !!document.querySelector(p.fingerprint); } catch { hit = false; }
      if (!hit) continue;
      found = findByPlatform(document, p);
      if (found.length) { platform = platform || p; break; }
    }
  }
  let generic = false;
  if (!found.length) {
    found = findGeneric(document, order);
    generic = true;
  }
  const ctxBase = {
    skip: platform?.skip || null,
    thinking: platform?.thinking || null,
    includeThinking: !!opts.includeThinking,
  };
  const messages = [];
  for (const { el, role } of found) {
    if (role === 'system' || role === 'tool') continue;
    const sel = platform ? platform.content[role === 'user' ? 'user' : 'assistant'] : null;
    let blocks = [];
    if (role === 'assistant' && ctxBase.thinking && ctxBase.includeThinking) {
      for (const th of topLevel(safeAll(el, ctxBase.thinking))) {
        const inner = blocksOf(th, { ...ctxBase, thinking: null }, false);
        if (inner.length) blocks.push({ t: 'note', kind: 'thinking', title: '思考过程', blocks: inner });
      }
    }
    for (const root of contentRoots(el, sel, ctxBase.thinking)) {
      const ctx = { ...ctxBase, includeThinking: false };
      blocks.push(...(role === 'user' ? promptBlocks(root, ctx) : blocksOf(root, ctx)));
    }
    if (!blocks.length || blockTextLength(blocks) === 0 && !blocks.some((b) => b.t === 'image')) continue;
    const prev = messages.at(-1);
    if (prev && prev.role === role) prev.blocks.push(...blocks);
    else messages.push({ role, blocks });
  }
  if (!messages.length) {
    const body = document.querySelector('main') || document.body;
    const blocks = body ? blocksOf(body, { skip: 'nav, aside, header, footer', thinking: null }) : [];
    if (blocks.length) messages.push({ role: 'assistant', blocks });
  }
  let title = opts.title || stripSuffix(document.title, platform);
  if (!title || /^(新聊天|new chat|untitled)$/i.test(title)) {
    const firstUser = messages.find((m) => m.role === 'user');
    title = firstUser ? shorten(firstLine(firstUser.blocks), 30) : '';
  }
  if (!title) title = loaded.name || '对话记录';
  return {
    title,
    platform: platform ? platform.id : 'generic',
    platformName: platform ? platform.name : (loaded.fragment ? '剪贴板内容' : '网页'),
    assistantName: platform ? platform.name : 'AI',
    generic,
    url: loaded.url || '',
    date: loaded.savedAt ? new Date(loaded.savedAt) : null,
    messages,
  };
}
