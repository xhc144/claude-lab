export interface AiRequest {
  system: string;
  userText: string;
  /** compressed recording for models that accept audio */
  audio?: { base64: string; format: 'mp3' | 'wav' };
}

export interface AiResult {
  content: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  truncated?: boolean;
}
