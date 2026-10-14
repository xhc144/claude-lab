// Google Generative Language API: POST {base}/v1beta/models/{model}:streamGenerateContent?alt=sse
// Auth: x-goog-api-key header (keys never go into the query string, so they cannot leak into access logs).
import { readSSE } from '../streams.mjs';
import { ProviderError, extractErrorMessage } from '../errors.mjs';
import { joinUrl } from './openai.mjs';

function authHeaders(style, apiKey) {
  if (!apiKey) return {};
  return style === 'bearer' ? { authorization: `Bearer ${apiKey}` } : { 'x-goog-api-key': apiKey };
}

const modelPath = (id) => (String(id).startsWith('models/') ? String(id) : `models/${id}`);

export function buildRequest({ provider, model, apiKey, req, learned = {} }) {
  const drop = new Set(learned.drop || []);
  const contents = [];
  for (const mm of req.messages) {
    const role = mm.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    // Gemini requires alternating roles; merge consecutive same-role turns.
    if (last && last.role === role) last.parts.push({ text: mm.content });
    else contents.push({ role, parts: [{ text: mm.content }] });
  }
  const generationConfig = {};
  if (req.maxTokens) generationConfig.maxOutputTokens = req.maxTokens;
  if (req.temperature != null) generationConfig.temperature = req.temperature;
  const mode = req.thinking || 'auto';
  if (mode !== 'off') {
    const tc = { includeThoughts: true };
    if (mode === 'on') {
      if (/gemini-3/i.test(model.id)) tc.thinkingLevel = 'high';
      else tc.thinkingBudget = -1;
    }
    generationConfig.thinkingConfig = tc;
  }
  const body = { contents, generationConfig };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  Object.assign(body, model.extraBody || {});
  if (drop.has('thinkingConfig')) delete body.generationConfig.thinkingConfig;
  if (drop.has('temperature')) delete body.generationConfig.temperature;
  return {
    url: joinUrl(provider.baseUrl, `/v1beta/${modelPath(model.id)}:streamGenerateContent?alt=sse`),
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...authHeaders(provider.authStyle, apiKey), ...(provider.extraHeaders || {}) },
      body: JSON.stringify(body),
    },
    body,
  };
}

export async function parseStream(response, emit) {
  const out = { text: '', thinking: '', usage: null, finishReason: '', model: '' };
  for await (const msg of readSSE(response.body)) {
    if (msg.comment !== undefined) { emit({ type: 'ping' }); continue; }
    let chunk;
    try { chunk = JSON.parse(msg.data); } catch { continue; }
    if (chunk.error) throw new ProviderError({ kind: chunk.error.code === 429 ? 'rate_limit' : chunk.error.code >= 500 ? 'server' : 'bad_request', status: chunk.error.code || 0, message: extractErrorMessage(chunk) });
    if (chunk.modelVersion) out.model = chunk.modelVersion;
    if (chunk.promptFeedback?.blockReason) {
      throw new ProviderError({ kind: 'refusal', message: `提示被 Gemini 安全策略拦截（${chunk.promptFeedback.blockReason}）`, retryable: false });
    }
    const cand = chunk.candidates?.[0];
    for (const part of cand?.content?.parts || []) {
      if (typeof part.text !== 'string' || !part.text) continue;
      if (part.thought) { out.thinking += part.text; emit({ type: 'thinking', text: part.text }); }
      else { out.text += part.text; emit({ type: 'text', text: part.text }); }
    }
    if (cand?.finishReason) out.finishReason = cand.finishReason;
    const u = chunk.usageMetadata;
    if (u) {
      out.usage = {
        inputTokens: u.promptTokenCount || 0,
        // Thought tokens are billed at the output rate.
        outputTokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
        reasoningTokens: u.thoughtsTokenCount || 0,
      };
    }
  }
  if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(out.finishReason) && !out.text.trim()) {
    throw new ProviderError({ kind: 'refusal', message: `Gemini 因安全策略停止生成（${out.finishReason}）`, retryable: false });
  }
  return out;
}

export function listModelsRequest({ provider, apiKey }) {
  return {
    url: joinUrl(provider.baseUrl, '/v1beta/models?pageSize=200'),
    init: { method: 'GET', headers: { ...authHeaders(provider.authStyle, apiKey), ...(provider.extraHeaders || {}) } },
  };
}

export function parseModelList(json) {
  return (json?.models || [])
    .filter((x) => !x.supportedGenerationMethods || x.supportedGenerationMethods.includes('generateContent'))
    .map((x) => ({ id: String(x.name || '').replace(/^models\//, ''), label: x.displayName || x.name }))
    .filter((x) => x.id);
}

export function repairFor(message, body, learned) {
  const s = String(message).toLowerCase();
  const drop = new Set(learned.drop || []);
  if (body.generationConfig?.thinkingConfig && !drop.has('thinkingConfig') && /think/.test(s)) {
    drop.add('thinkingConfig');
    return { ...learned, drop: [...drop] };
  }
  if (body.generationConfig?.temperature != null && !drop.has('temperature') && /temperature/.test(s)) {
    drop.add('temperature');
    return { ...learned, drop: [...drop] };
  }
  return null;
}
