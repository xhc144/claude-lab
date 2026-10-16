// Where each chat site keeps its messages. A platform is tried when its host
// matches the saved URL or its fingerprint selector occurs in the page; each
// entry lists selector generations newest first, because sites keep several
// layouts alive at once. Anything unknown falls through to the generic finder.

export const PLATFORMS = [
  {
    id: 'chatgpt', name: 'ChatGPT',
    hosts: /(^|\.)(chatgpt\.com|chat\.openai\.com)$/,
    fingerprint: '[data-message-author-role], [data-chatgpt-search-unit-key], [data-dil-message-id], [data-user-message-bubble]',
    messages: [
      // 2026 web app: one turn holds "…:user" and "…:assistant" units.
      { sel: '[data-chatgpt-search-unit-key$=":user"], [data-chatgpt-search-unit-key$=":assistant"]', role: (el) => (/:user$/.test(el.getAttribute('data-chatgpt-search-unit-key')) ? 'user' : 'assistant') },
      { sel: '[data-message-author-role]', role: (el) => el.getAttribute('data-message-author-role') },
      { sel: 'li[data-message-role]', role: (el) => el.getAttribute('data-message-role') },
      { sel: 'article[data-testid^="conversation-turn"]', role: (el) => (el.querySelector('[data-message-author-role="user"], h5, h4')?.textContent?.match(/你说|You said/) ? 'user' : 'assistant') },
    ],
    content: {
      user: '[data-user-message-bubble] .whitespace-pre-wrap, .whitespace-pre-wrap, [data-user-message-bubble]',
      assistant: '[data-dil-message-id], [data-markdown-text-style="assistant-message"], .markdown',
    },
    skip: '[data-message-author-role] > h5, h4.sr-only, h5.sr-only, h6.sr-only, [data-testid$="turn-action-button"], .turn-action-controls',
    thinking: '[data-testid="thoughts"], [data-message-author-role="tool"]',
    titleSuffix: /\s*[-–—|]\s*ChatGPT\s*$/i,
    genericTitle: /^(chatgpt|new chat|新聊天)$/i,
  },
  {
    id: 'claude', name: 'Claude',
    hosts: /(^|\.)claude\.ai$/,
    fingerprint: '[data-testid="user-message"], .font-claude-response, .font-claude-message, .font-user-message',
    messages: [
      { sel: '[data-testid="user-message"], .font-claude-response:not(#markdown-artifact), .font-claude-message, [data-is-streaming]', role: (el) => (el.matches('[data-testid="user-message"]') ? 'user' : 'assistant') },
      { sel: '.font-user-message, .font-claude-message', role: (el) => (/font-user/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: null, assistant: '.standard-markdown, .progressive-markdown, .font-claude-response-body' },
    skip: '[data-testid="action-bar-copy"], [class*="artifact-block-cell"] button',
    thinking: '[data-testid="thinking"], [class*="thinking-block"], .transition-all[class*="rounded"] > button + div',
    titleSuffix: /\s*[-–—|]\s*Claude\s*$/i,
  },
  {
    id: 'gemini', name: 'Gemini',
    hosts: /(^|\.)gemini\.google\.com$/,
    fingerprint: 'user-query, model-response',
    messages: [
      { sel: 'user-query, model-response', role: (el) => (el.tagName.toLowerCase() === 'user-query' ? 'user' : 'assistant') },
    ],
    content: { user: '.query-text', assistant: 'message-content .markdown, message-content, .markdown-main-panel' },
    skip: '.query-text .cdk-visually-hidden, .response-container-header, sources-carousel, .bard-avatar, .chip-container',
    thinking: 'model-thoughts, .thoughts-container',
    titleSuffix: /\s*[-–—|]\s*(Google\s+)?Gemini\s*$/i,
    genericTitle: /^(google )?gemini$/i,
  },
  {
    id: 'deepseek', name: 'DeepSeek',
    hosts: /(^|\.)deepseek\.com$/,
    fingerprint: '.ds-message, .ds-markdown',
    messages: [
      { sel: '.ds-message', role: (el) => ([...el.querySelectorAll('.ds-markdown')].some((m) => !m.closest('.ds-think-content')) ? 'assistant' : 'user') },
      { sel: '._9663006, ._4f9bf79', role: (el) => (el.matches('._9663006') ? 'user' : 'assistant') },
    ],
    content: { user: '.fbb737a4, .ds-message > div', assistant: '.ds-assistant-message-main-content, .ds-markdown' },
    skip: '.ds-message-feedback-container, .ds-flex[class*="action"]',
    thinking: '.ds-think-content, ._74c0879, .e1675d8b',
    titleSuffix: /\s*[-–—|]\s*DeepSeek.*$/i,
    genericTitle: /^deepseek/i,
  },
  {
    id: 'grok', name: 'Grok',
    hosts: /(^|\.)(grok\.com|x\.ai)$/,
    fingerprint: 'div[id^="response-"] .response-content-markdown',
    messages: [
      { sel: 'div[id^="response-"]', role: (el) => (el.matches('.items-end') ? 'user' : 'assistant') },
    ],
    content: { user: '.response-content-markdown, .message-bubble', assistant: '.response-content-markdown, .message-bubble' },
    skip: '.action-buttons, [class*="thinking-container"] button',
    thinking: '[class*="thinking-container"]',
    titleSuffix: /\s*[-–—|]\s*Grok\s*$/i,
  },
  {
    id: 'copilot', name: 'Copilot',
    hosts: /(^|\.)(copilot\.microsoft\.com|copilot\.com)$/,
    fingerprint: '.group\\/user-message, .group\\/ai-message',
    messages: [
      { sel: '.group\\/user-message, .group\\/ai-message', role: (el) => (/group\/user-message/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: '[data-content="user-message"]', assistant: '.group\\/ai-message-item' },
    skip: 'h2.sr-only, h3.sr-only',
    titleSuffix: /\s*[-–—|]\s*(Microsoft\s+)?Copilot.*$/i,
  },
  {
    id: 'kimi', name: 'Kimi',
    hosts: /(^|\.)(kimi\.com|kimi\.moonshot\.cn|moonshot\.cn)$/,
    fingerprint: '.chat-content-item, .segment-content-box, [class*="chat-content-item"]',
    messages: [
      { sel: '.chat-content-item-user, .chat-content-item-assistant', role: (el) => (/item-user/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
      { sel: '.segment-user, .segment-assistant', role: (el) => (/segment-user/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: '.user-content, .segment-content-box', assistant: '.markdown, .segment-content-box' },
    skip: '.segment-assistant-actions, .chat-action',
    thinking: '.thinking-container, [class*="think-stage"]',
    titleSuffix: /\s*[-–—|]\s*Kimi.*$/i,
  },
  {
    id: 'doubao', name: '豆包',
    hosts: /(^|\.)doubao\.com$/,
    fingerprint: '[data-testid="send_message"], [data-testid="receive_message"]',
    messages: [
      { sel: '[data-testid="send_message"], [data-testid="receive_message"]', role: (el) => (el.getAttribute('data-testid') === 'send_message' ? 'user' : 'assistant') },
    ],
    content: { user: '[data-testid="message_text_content"]', assistant: '[data-testid="message_text_content"], .flow-markdown-body' },
    skip: '[data-testid="message_action_bar"], [class*="message-action"]',
    thinking: '[data-testid="think_block"], [class*="thinking-block"]',
    titleSuffix: /\s*[-–—|]\s*豆包.*$/i,
  },
  {
    id: 'qwen', name: '通义千问',
    hosts: /(^|\.)(chat\.qwen\.ai|qwen\.ai|tongyi\.com|qianwen\.com|tongyi\.aliyun\.com)$/,
    fingerprint: '.chat-user-message, .chat-response-message, [class*="questionItem"], [class*="answerItem"]',
    messages: [
      { sel: '.chat-user-message, .chat-response-message', role: (el) => (/user-message/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
      { sel: '[class*="questionItem"], [class*="answerItem"]', role: (el) => (/questionItem/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: '.user-message-content, [class*="bubble"]', assistant: '#response-content-container, .markdown-content-container, .tongyi-markdown, [class*="markdown"]' },
    thinking: '.qwen-chat-thinking-status-card, [class*="deepThink"], [class*="thinking"]',
    titleSuffix: /\s*[-–—|]\s*(Qwen|通义|千问).*$/i,
  },
  {
    id: 'yuanbao', name: '腾讯元宝',
    hosts: /(^|\.)yuanbao\.tencent\.com$/,
    fingerprint: '.agent-chat__list__item, .hyc-common-markdown',
    messages: [
      { sel: '.agent-chat__list__item--human, .agent-chat__list__item--ai', role: (el) => (/--human/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: '.hyc-content-text, .agent-chat__bubble__content', assistant: '.hyc-common-markdown:not(.hyc-common-markdown-style-cot)' },
    thinking: '.hyc-component-reasoner__think, .hyc-common-markdown-style-cot',
    titleSuffix: /\s*[-–—|]\s*(腾讯)?元宝.*$/i,
  },
  {
    id: 'chatglm', name: '智谱清言',
    hosts: /(^|\.)(chatglm\.cn|z\.ai|zhipuai\.cn)$/,
    fingerprint: '.question-item, .answer-item, .conversation-item',
    messages: [
      { sel: '.question-item, .answer-item', role: (el) => (/question/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
      { sel: '.chat-user, .chat-assistant', role: (el) => (/user/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: '.question-txt, .question, .user-message', assistant: '.markdown-body, .answer-content-wrap, .answer' },
    thinking: '.thinking-chain-container, [class*="think"]',
    titleSuffix: /\s*[-–—|]\s*(智谱清言|ChatGLM|Z\.ai).*$/i,
  },
  {
    id: 'perplexity', name: 'Perplexity',
    hosts: /(^|\.)perplexity\.ai$/,
    fingerprint: '[class*="group/query"], .prose',
    messages: [
      { sel: '[class*="group/query"], [id^="markdown-content-"]', role: (el) => (/group\/query/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: null, assistant: '.prose' },
    skip: '.citation, [class*="citation"]',
    titleSuffix: /\s*[-–—|]\s*Perplexity\s*$/i,
  },
  {
    id: 'poe', name: 'Poe',
    hosts: /(^|\.)poe\.com$/,
    fingerprint: '[class*="Message_humanMessageBubble"], [class*="Message_botMessageBubble"]',
    messages: [
      { sel: '[class*="Message_humanMessageBubble"], [class*="Message_botMessageBubble"]', role: (el) => (/human/.test(el.getAttribute('class')) ? 'user' : 'assistant') },
    ],
    content: { user: '[class*="Markdown_markdownContainer"]', assistant: '[class*="Markdown_markdownContainer"]' },
    titleSuffix: /\s*[-–—|]\s*Poe\s*$/i,
  },
  {
    id: 'mistral', name: 'Le Chat',
    hosts: /(^|\.)(chat\.mistral\.ai|mistral\.ai)$/,
    fingerprint: '[data-message-author-role]',
    messages: [
      { sel: '[data-message-author-role]', role: (el) => el.getAttribute('data-message-author-role') },
    ],
    content: { user: null, assistant: '[data-message-part-type="answer"], .prose' },
    titleSuffix: /\s*[-–—|]\s*Le Chat.*$/i,
  },
];

export function platformById(id) {
  return PLATFORMS.find((p) => p.id === id) || null;
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

export function detectPlatform(document, url) {
  const host = hostOf(url);
  if (host) {
    const byHost = PLATFORMS.find((p) => p.hosts.test(host));
    if (byHost) return byHost;
  }
  for (const p of PLATFORMS) {
    try { if (document.querySelector(p.fingerprint)) return p; } catch { /* invalid selector in this DOM lib */ }
  }
  return null;
}
