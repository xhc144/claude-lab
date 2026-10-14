// Claude (Anthropic Messages API) via the official SDK. Claude models accept
// text and images but not audio, so Claude always analyses the measured data.
import Anthropic from '@anthropic-ai/sdk';
import { net } from 'electron';
import type { AiProviderConfig } from '../../shared/types.ts';
import type { AiRequest, AiResult } from './types.ts';

export async function runAnthropic(p: AiProviderConfig, req: AiRequest, onDelta: (t: string) => void, signal: AbortSignal): Promise<AiResult> {
  const client = new Anthropic({
    apiKey: p.apiKey,
    baseURL: p.baseUrl || undefined,
    // Chromium's network stack honours the system proxy settings
    fetch: ((url: any, init: any) => net.fetch(url, init)) as any,
    maxRetries: 2,
    timeout: 10 * 60 * 1000,
  });
  const official = !p.baseUrl || /api\.anthropic\.com/.test(p.baseUrl);
  const stream = client.beta.messages.stream(
    {
      model: p.model || 'claude-opus-5-5',
      max_tokens: Math.max(1024, p.maxTokens || 16000),
      system: req.system,
      messages: [{ role: 'user', content: req.userText }],
      // adaptive thinking is the default on current models; effort controls depth
      output_config: { effort: 'medium' },
      // on a safety decline, re-run on Anthropic's recommended fallback model server-side
      ...(official ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    },
    { signal },
  );
  stream.on('text', (t) => onDelta(t));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') {
    const d = msg.stop_details as { category?: string | null; explanation?: string | null } | null;
    throw new Error(`模型拒绝了这次请求${d?.category ? `（${d.category}）` : ''}${d?.explanation ? '：' + d.explanation : ''}`);
  }
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return {
    content: text,
    model: msg.model,
    usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
    truncated: msg.stop_reason === 'max_tokens',
  };
}
