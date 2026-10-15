// Ollama native API: POST {base}/api/chat streaming NDJSON; model list from GET {base}/api/tags.
import { readNDJSON } from '../streams.mjs';
import { ProviderError } from '../errors.mjs';
import { joinUrl, authHeaders } from './openai.mjs';

export function buildRequest({ provider, model, apiKey, req, learned = {} }) {
  const drop = new Set(learned.drop || []);
  const messages = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const mm of req.messages) messages.push({ role: mm.role, content: mm.content });
  const options = { num_ctx: model.contextWindow || 16384 };
  if (req.maxTokens) options.num_predict = req.maxTokens;
  if (req.temperature != null) options.temperature = req.temperature;
  const body = { model: model.id, messages, stream: true, options };
  const mode = req.thinking || 'auto';
  if (mode !== 'auto' && !drop.has('think')) body.think = mode === 'on';
  const extra = model.extraBody || {};
  if (extra.options) Object.assign(options, extra.options);
  for (const [k, v] of Object.entries(extra)) if (k !== 'options') body[k] = v;
  return {
    url: joinUrl(provider.baseUrl, '/api/chat'),
    init: {
      method: 'POST',
      // Ollama has no auth by default; a key is forwarded as Bearer for reverse proxies that require one.
      headers: { 'content-type': 'application/json', ...authHeaders(apiKey ? 'bearer' : 'none', apiKey), ...(provider.extraHeaders || {}) },
      body: JSON.stringify(body),
    },
    body,
  };
}

export async function parseStream(response, emit) {
  const out = { text: '', thinking: '', usage: null, finishReason: '', model: '' };
  let inThink = false;
  for await (const obj of readNDJSON(response.body)) {
    if (obj.error) throw new ProviderError({ kind: 'server', message: String(obj.error) });
    if (obj.model) out.model = obj.model;
    const msg = obj.message || {};
    if (msg.thinking) { out.thinking += msg.thinking; emit({ type: 'thinking', text: msg.thinking }); }
    if (msg.content) {
      // Older Ollama builds stream reasoning models' <think> blocks inline in content.
      let text = msg.content;
      while (text) {
        if (inThink) {
          const end = text.indexOf('</think>');
          const part = end < 0 ? text : text.slice(0, end);
          if (part) { out.thinking += part; emit({ type: 'thinking', text: part }); }
          if (end < 0) break;
          inThink = false; text = text.slice(end + 8);
        } else {
          const start = !out.text.trim() ? text.indexOf('<think>') : -1;
          if (start >= 0 && !text.slice(0, start).trim()) { inThink = true; text = text.slice(start + 7); continue; }
          out.text += text; emit({ type: 'text', text }); break;
        }
      }
    }
    if (obj.done) {
      out.finishReason = obj.done_reason || 'stop';
      out.usage = { inputTokens: obj.prompt_eval_count || 0, outputTokens: obj.eval_count || 0, reasoningTokens: 0 };
    }
  }
  return out;
}

export function listModelsRequest({ provider, apiKey }) {
  return {
    url: joinUrl(provider.baseUrl, '/api/tags'),
    init: { method: 'GET', headers: { ...authHeaders(apiKey ? 'bearer' : 'none', apiKey) } },
  };
}

export function parseModelList(json) {
  return (json?.models || []).map((x) => ({
    id: x.model || x.name,
    label: [x.name, x.details?.parameter_size].filter(Boolean).join(' · '),
  })).filter((x) => x.id);
}

export function repairFor(message, body, learned) {
  const s = String(message).toLowerCase();
  const drop = new Set(learned.drop || []);
  if (body.think !== undefined && !drop.has('think') && /think/.test(s)) {
    drop.add('think');
    return { ...learned, drop: [...drop] };
  }
  return null;
}
