// Anthropic Messages API (streaming SSE): POST {base}/v1/messages with x-api-key + anthropic-version.
import { readSSE } from '../streams.mjs';
import { ProviderError, extractErrorMessage } from '../errors.mjs';
import { joinUrl } from './openai.mjs';

export const ANTHROPIC_VERSION = '2023-06-01';

// Models that take adaptive thinking and reject sampling parameters / budget_tokens.
export const isAdaptiveClaude = (id) => /claude-(fable|mythos)|claude-(opus|sonnet|haiku)-(4-[6-9]|[5-9])/i.test(id || '');
// Models that support the server-side refusal fallback ("fallbacks": "default").
const FALLBACK_MODELS = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/i;

function authHeaders(style, apiKey) {
  if (!apiKey) return {};
  return style === 'bearer' ? { authorization: `Bearer ${apiKey}` } : { 'x-api-key': apiKey };
}

export function buildRequest({ provider, model, apiKey, req, learned = {} }) {
  const drop = new Set(learned.drop || []);
  const adaptive = isAdaptiveClaude(model.id);
  const mode = req.thinking || 'auto';
  const maxTokens = req.maxTokens || 8192;
  const body = {
    model: model.id,
    max_tokens: maxTokens,
    stream: true,
    messages: req.messages.map((mm) => ({ role: mm.role, content: mm.content })),
  };
  if (req.system) body.system = req.system;

  if (adaptive) {
    // Thinking is adaptive on current models; "summarized" makes the reasoning visible in the console.
    if (mode !== 'off') body.thinking = { type: 'adaptive', display: 'summarized' };
    if (mode === 'on') body.output_config = { effort: 'high' };
  } else if (mode === 'on' && maxTokens > 2048) {
    body.thinking = { type: 'enabled', budget_tokens: Math.max(1024, Math.min(16000, Math.floor(maxTokens / 2))) };
  } else if (req.temperature != null) {
    body.temperature = Math.min(1, Math.max(0, req.temperature));
  }

  const headers = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
    'anthropic-version': ANTHROPIC_VERSION,
    ...authHeaders(provider.authStyle, apiKey),
    ...(provider.extraHeaders || {}),
  };
  const official = /(^|\.)anthropic\.com$/i.test(safeHost(provider.baseUrl));
  if (official && FALLBACK_MODELS.test(model.id) && !drop.has('fallbacks')) {
    body.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  Object.assign(body, model.extraBody || {});
  for (const k of drop) {
    if (k === 'thinking.display' && body.thinking) delete body.thinking.display;
    else delete body[k];
  }
  if (!body.fallbacks) delete headers['anthropic-beta'];
  return { url: joinUrl(provider.baseUrl, '/v1/messages'), init: { method: 'POST', headers, body: JSON.stringify(body) }, body };
}

function safeHost(u) {
  try { return new URL(u).hostname; } catch { return ''; }
}

export async function parseStream(response, emit) {
  const out = { text: '', thinking: '', usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 }, finishReason: '', model: '' };
  let gotUsage = false;
  for await (const msg of readSSE(response.body)) {
    if (msg.comment !== undefined) { emit({ type: 'ping' }); continue; }
    let ev;
    try { ev = JSON.parse(msg.data); } catch { continue; }
    switch (ev.type) {
      case 'message_start': {
        const u = ev.message?.usage || {};
        out.model = ev.message?.model || '';
        out.usage.inputTokens = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        if (u.output_tokens) out.usage.outputTokens = u.output_tokens;
        gotUsage = true;
        break;
      }
      case 'content_block_delta': {
        const d = ev.delta || {};
        if (d.type === 'text_delta' && d.text) { out.text += d.text; emit({ type: 'text', text: d.text }); }
        else if (d.type === 'thinking_delta' && d.thinking) { out.thinking += d.thinking; emit({ type: 'thinking', text: d.thinking }); }
        break;
      }
      case 'message_delta': {
        if (ev.delta?.stop_reason) out.finishReason = ev.delta.stop_reason;
        if (ev.usage?.output_tokens != null) out.usage.outputTokens = ev.usage.output_tokens;
        if (ev.usage?.input_tokens) out.usage.inputTokens = ev.usage.input_tokens + (ev.usage.cache_read_input_tokens || 0) + (ev.usage.cache_creation_input_tokens || 0);
        break;
      }
      case 'ping': emit({ type: 'ping' }); break;
      case 'error': {
        const message = extractErrorMessage(ev);
        const t = ev.error?.type || '';
        throw new ProviderError({ kind: t === 'overloaded_error' ? 'overloaded' : t === 'rate_limit_error' ? 'rate_limit' : 'server', message });
      }
      default: break;
    }
  }
  if (out.finishReason === 'refusal' && !out.text.trim()) {
    throw new ProviderError({ kind: 'refusal', message: 'Claude 安全分类器拒绝了该请求（stop_reason: refusal）', retryable: false });
  }
  if (!gotUsage) out.usage = null;
  return out;
}

export function listModelsRequest({ provider, apiKey }) {
  return {
    url: joinUrl(provider.baseUrl, '/v1/models?limit=100'),
    init: { method: 'GET', headers: { 'anthropic-version': ANTHROPIC_VERSION, ...authHeaders(provider.authStyle, apiKey), ...(provider.extraHeaders || {}) } },
  };
}

export function parseModelList(json) {
  return (json?.data || []).map((x) => ({ id: x.id, label: x.display_name || x.id })).filter((x) => x.id);
}

export function repairFor(message, body, learned) {
  const s = String(message).toLowerCase();
  const drop = new Set(learned.drop || []);
  const tryDrop = (key, test) => {
    if (!drop.has(key) && test) { drop.add(key); return { ...learned, drop: [...drop] }; }
    return null;
  };
  return (
    tryDrop('fallbacks', body.fallbacks && /fallback|anthropic-beta|beta/.test(s)) ||
    tryDrop('thinking.display', body.thinking?.display && /display/.test(s)) ||
    tryDrop('output_config', body.output_config && /output_config|effort/.test(s)) ||
    tryDrop('temperature', body.temperature != null && /temperature/.test(s)) ||
    tryDrop('thinking', body.thinking && /thinking|budget_tokens/.test(s)) ||
    null
  );
}
