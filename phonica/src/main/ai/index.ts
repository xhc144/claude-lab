// AI deep analysis on top of the local assessment. Independent of the core:
// nothing here is needed for recording, assessment or export.
import { runAnthropic } from './anthropic.ts';
import { runOpenAiCompatible } from './openai-compatible.ts';
import { analysisPrompt, compactForAi } from '../../shared/report.ts';
import type { AiProviderConfig, AssessmentResult } from '../../shared/types.ts';
import type { AiResult } from './types.ts';

export function providerAcceptsAudio(p: AiProviderConfig): boolean {
  return p.kind !== 'anthropic' && p.kind !== 'deepseek' && p.audioInput;
}

export async function analyse(
  p: AiProviderConfig,
  result: AssessmentResult,
  audioMp3: Uint8Array | null,
  language: 'zh' | 'en',
  onDelta: (t: string) => void,
  signal: AbortSignal,
): Promise<AiResult & { withAudio: boolean }> {
  if (!p.apiKey && !/localhost|127\.0\.0\.1/.test(p.baseUrl)) throw new Error('请先在“设置 → AI 服务”中填写 API 密钥');
  const withAudio = !!audioMp3 && providerAcceptsAudio(p);
  const system = '你是严谨、友善的英语发音教练。你的分析必须以提供的测量数据为依据，不编造数据中没有的细节；凡是不确定的地方要明确说明。';
  const userText = `${analysisPrompt(result, { withAudio, audioFile: withAudio ? 'recording.mp3' : undefined, language, forExport: false })}\n\n## 传统评测数据（JSON）\n\n\`\`\`json\n${JSON.stringify(compactForAi(result))}\n\`\`\``;
  const req = { system, userText, audio: withAudio ? { base64: Buffer.from(audioMp3!).toString('base64'), format: 'mp3' as const } : undefined };
  const r = p.kind === 'anthropic' ? await runAnthropic(p, req, onDelta, signal) : await runOpenAiCompatible(p, req, onDelta, signal);
  return { ...r, withAudio };
}

export async function testProvider(p: AiProviderConfig, signal: AbortSignal): Promise<string> {
  const req = { system: 'Reply with exactly: OK', userText: 'ping' };
  const small = { ...p, maxTokens: 64 };
  const r = p.kind === 'anthropic' ? await runAnthropic({ ...small, maxTokens: 1024 }, req, () => {}, signal) : await runOpenAiCompatible(small, req, () => {}, signal);
  return `${r.model}: ${r.content.trim().slice(0, 60) || '(空响应)'}`;
}
