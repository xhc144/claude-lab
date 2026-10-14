// OpenAI Chat Completions protocol (streaming SSE). Used by OpenAI and every OpenAI-compatible vendor:
// DeepSeek, DashScope (Qwen), Moonshot (Kimi), BigModel (GLM), Volcengine Ark (Doubao), xAI (Grok), relays.
import { createHmac } from 'node:crypto';
import { readSSE } from '../streams.mjs';
import { ProviderError, extractErrorMessage } from '../errors.mjs';

export const isOpenAIReasoningModel = (id) => /^(o\d|gpt-5)(?!.*chat)/i.test(id || '');

export function joinUrl(base, path) {
  return String(base || '').replace(/\/+$/, '') + path;
}

/** Zhipu "id.secret" key → HS256 JWT (legacy BigModel auth, still accepted). */
export function zhipuJwt(apiKey, now = Date.now()) {
  const [id, secret] = String(apiKey).split('.');
  if (!id || !secret) throw new ProviderError({ kind: 'config', message: '智谱 JWT 模式需要 “id.secret” 格式的 API Key' });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', sign_type: 'SIGN' });
  const body = b64({ api_key: id, exp: now + 30 * 60_000, timestamp: now });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function authHeaders(style, apiKey) {
  if (!apiKey || style === 'none') return {};
  switch (style) {
    case 'api-key': return { 'api-key': apiKey };
    case 'x-api-key': return { 'x-api-key': apiKey };
    case 'zhipu-jwt': return { authorization: `Bearer ${zhipuJwt(apiKey)}` };
    default: return { authorization: `Bearer ${apiKey}` };
  }
}

function thinkingParams(style, mode, modelId) {
  if (mode === 'auto') return {};
  const on = mode === 'on';
  switch (style) {
    case 'openai': return isOpenAIReasoningModel(modelId) ? { reasoning_effort: on ? 'high' : 'low' } : {};
    case 'qwen': return { enable_thinking: on };
    case 'zhipu': return { thinking: { type: on ? 'enabled' : 'disabled' } };
    case 'doubao': return { thinking: { type: on ? 'enabled' : 'disabled' } };
    default: return {};
  }
}

export function buildRequest({ provider, model, apiKey, req, learned = {} }) {
  const msgs = [];
  if (req.system) msgs.push({ role: 'system', content: req.system });
  for (const mm of req.messages) msgs.push({ role: mm.role, content: mm.content });

  const reasoningModel = provider.presetId === 'openai' && isOpenAIReasoningModel(model.id);
  const tokenParam = learned.tokenParam || (reasoningModel ? 'max_completion_tokens' : 'max_tokens');
  const body = { model: model.id, messages: msgs, stream: true };
  if (req.maxTokens) body[tokenParam] = req.maxTokens;
  if (req.temperature != null && !reasoningModel) body.temperature = req.temperature;
  if (provider.streamUsage !== false) body.stream_options = { include_usage: true };
  Object.assign(body, thinkingParams(provider.thinkingStyle, req.thinking || 'auto', model.id));
  Object.assign(body, model.extraBody || {});
  for (const k of learned.drop || []) delete body[k];

  const url = new URL(joinUrl(provider.baseUrl, '/chat/completions'));
  for (const [k, v] of Object.entries(provider.extraQuery || {})) url.searchParams.set(k, v);
  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...authHeaders(provider.authStyle, apiKey), ...(provider.extraHeaders || {}) },
      body: JSON.stringify(body),
    },
    body,
  };
}

/** Consume the SSE stream. emit({type:'text'|'thinking', text}) for deltas; returns the final tally. */
export async function parseStream(response, emit) {
  const out = { text: '', thinking: '', usage: null, finishReason: '', model: '' };
  let thinkTag = false;
  for await (const msg of readSSE(response.body)) {
    if (msg.comment !== undefined) { emit({ type: 'ping' }); continue; }
    const data = msg.data.trim();
    if (data === '[DONE]') break;
    let chunk;
    try { chunk = JSON.parse(data); } catch { continue; }
    if (chunk.error) {
      const message = extractErrorMessage(chunk);
      throw new ProviderError({ kind: /overload|rate|busy|capacity/i.test(message) ? 'overloaded' : 'server', message });
    }
    if (chunk.model) out.model = chunk.model;
    if (chunk.usage) out.usage = chunk.usage;
    for (const choice of chunk.choices || []) {
      if (choice.usage) out.usage = choice.usage; // Moonshot reports usage inside the final choice
      const d = choice.delta || choice.message || {};
      const reasoning = d.reasoning_content ?? d.reasoning ?? null;
      if (reasoning) { out.thinking += reasoning; emit({ type: 'thinking', text: reasoning }); }
      if (typeof d.content === 'string' && d.content) {
        // Some open models (served via relays/vLLM) inline their reasoning as <think>…</think>.
        let text = d.content;
        while (text) {
          if (thinkTag) {
            const end = text.indexOf('</think>');
            const part = end < 0 ? text : text.slice(0, end);
            if (part) { out.thinking += part; emit({ type: 'thinking', text: part }); }
            if (end < 0) break;
            thinkTag = false; text = text.slice(end + 8);
          } else {
            const start = !out.text.trim() ? text.indexOf('<think>') : -1;
            if (start >= 0 && !text.slice(0, start).trim()) { thinkTag = true; text = text.slice(start + 7); continue; }
            out.text += text; emit({ type: 'text', text }); break;
          }
        }
      }
      if (choice.finish_reason) out.finishReason = choice.finish_reason;
    }
  }
  if (out.usage) {
    const u = out.usage;
    out.usage = {
      inputTokens: u.prompt_tokens ?? u.input_tokens ?? 0,
      outputTokens: u.completion_tokens ?? u.output_tokens ?? 0,
      reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? u.reasoning_tokens ?? 0,
    };
  }
  if (out.finishReason === 'content_filter') {
    if (!out.text) throw new ProviderError({ kind: 'refusal', message: '内容被服务商安全过滤拦截', retryable: false });
  }
  return out;
}

export function listModelsRequest({ provider, apiKey }) {
  return {
    url: joinUrl(provider.baseUrl, '/models'),
    init: { method: 'GET', headers: { accept: 'application/json', ...authHeaders(provider.authStyle, apiKey), ...(provider.extraHeaders || {}) } },
  };
}

export function parseModelList(json) {
  const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : Array.isArray(json?.models) ? json.models : [];
  return arr.map((x) => ({ id: x.id || x.name || x.model, label: x.display_name || x.name || x.id })).filter((x) => x.id);
}

/** Map a 400 message to a request adjustment. Returns a learned patch or null. */
export function repairFor(message, body, learned) {
  const s = String(message).toLowerCase();
  const drop = new Set(learned.drop || []);
  const next = { ...learned };
  if (/max_tokens/.test(s) && /max_completion_tokens/.test(s) && body.max_tokens != null) return { ...next, tokenParam: 'max_completion_tokens' };
  if (/max_completion_tokens/.test(s) && body.max_completion_tokens != null && /unsupported|unknown|unrecognized|not support|invalid/.test(s)) return { ...next, tokenParam: 'max_tokens' };
  const candidates = ['temperature', 'top_p', 'reasoning_effort', 'stream_options', 'enable_thinking', 'thinking'];
  for (const k of candidates) {
    if (body[k] === undefined || drop.has(k)) continue;
    if (s.includes(k) || s.includes(k.replace(/_/g, ' '))) {
      drop.add(k);
      return { ...next, drop: [...drop] };
    }
  }
  return null;
}
