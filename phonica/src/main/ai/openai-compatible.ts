// OpenAI-compatible Chat Completions (OpenAI, DeepSeek, Gemini's OpenAI
// endpoint, local servers, gateways). Audio is sent as an `input_audio` content
// part when the configured model accepts audio.
import { net } from 'electron';
import type { AiProviderConfig } from '../../shared/types.ts';
import type { AiRequest, AiResult } from './types.ts';

export async function runOpenAiCompatible(p: AiProviderConfig, req: AiRequest, onDelta: (t: string) => void, signal: AbortSignal): Promise<AiResult> {
  const url = p.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const userContent: any[] = [{ type: 'text', text: req.userText }];
  if (req.audio) userContent.push({ type: 'input_audio', input_audio: { data: req.audio.base64, format: req.audio.format } });
  const body: Record<string, unknown> = {
    model: p.model,
    stream: true,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: userContent },
    ],
  };
  if (req.audio && /audio/i.test(p.model)) body.modalities = ['text'];
  const newStyle = p.kind === 'openai';
  if (newStyle) body.max_completion_tokens = p.maxTokens;
  else body.max_tokens = p.maxTokens;
  if (Number.isFinite(p.temperature)) body.temperature = p.temperature;

  let res = await post(url, p.apiKey, body, signal);
  if (res.status === 400) {
    // some models reject temperature or the token-limit field name: retry once without them
    const txt = await res.text();
    if (/temperature|max_tokens|max_completion_tokens|unsupported/i.test(txt)) {
      delete body.temperature;
      if (body.max_completion_tokens) { body.max_tokens = body.max_completion_tokens; delete body.max_completion_tokens; } else { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
      res = await post(url, p.apiKey, body, signal);
    } else throw new Error(apiError(400, txt));
  }
  if (!res.ok) throw new Error(apiError(res.status, await res.text()));
  if (!res.body) throw new Error('服务没有返回内容');

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
  let model = p.model;
  let usage: AiResult['usage'];
  let finish = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        if (j.error) throw new Error(j.error.message ?? JSON.stringify(j.error));
        model = j.model ?? model;
        const delta = j.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          content += delta;
          onDelta(delta);
        }
        if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
        if (j.usage) usage = { inputTokens: j.usage.prompt_tokens, outputTokens: j.usage.completion_tokens };
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return { content, model, usage, truncated: finish === 'length' };
}

function post(url: string, key: string, body: unknown, signal: AbortSignal) {
  return net.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal,
  });
}

function apiError(status: number, txt: string): string {
  let msg = txt.slice(0, 400);
  try {
    const j = JSON.parse(txt);
    msg = j.error?.message ?? j.message ?? msg;
  } catch {
    /* plain text */
  }
  const hint = status === 401 ? '（API 密钥无效）' : status === 404 ? '（接口地址或模型名称不正确）' : status === 429 ? '（请求过于频繁或额度不足）' : '';
  return `HTTP ${status}${hint}：${msg}`;
}
