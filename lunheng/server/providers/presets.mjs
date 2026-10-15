// Built-in provider presets. Every preset maps to one of four wire protocols (kind):
//   openai    – OpenAI Chat Completions + SSE (also DeepSeek, Qwen/DashScope, Kimi, GLM, Doubao/Ark, Grok, relays)
//   anthropic – Anthropic Messages API + SSE (x-api-key, anthropic-version)
//   gemini    – Google Generative Language API streamGenerateContent + SSE (x-goog-api-key)
//   ollama    – Ollama native /api/chat + NDJSON
//
// Prices are reference list prices per 1M tokens (input / output) in the vendor's billing currency, as
// published around 2025-2026. They drive cost estimates and budget limits only; edit them per model in the
// gateway settings whenever a vendor changes its price list.

const m = (id, label, input, output, currency, extra = {}) => ({ id, label, price: { input, output, currency }, ...extra });

export const PRESETS = [
  {
    id: 'openai', name: 'OpenAI', vendor: 'OpenAI', kind: 'openai', monogram: 'AI', hue: 160,
    baseUrl: 'https://api.openai.com/v1', authStyle: 'bearer', thinkingStyle: 'openai', streamUsage: true,
    keyUrl: 'https://platform.openai.com/api-keys', docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
    temperatureRange: [0, 2],
    models: [
      m('gpt-5', 'GPT-5', 1.25, 10, 'USD', { reasoning: true }),
      m('gpt-5-mini', 'GPT-5 mini', 0.25, 2, 'USD', { reasoning: true }),
      m('gpt-4.1', 'GPT-4.1', 2, 8, 'USD'),
      m('o3', 'o3', 2, 8, 'USD', { reasoning: true }),
      m('o4-mini', 'o4-mini', 1.1, 4.4, 'USD', { reasoning: true }),
    ],
  },
  {
    id: 'anthropic', name: 'Anthropic Claude', vendor: 'Anthropic', kind: 'anthropic', monogram: 'A\\', hue: 20,
    baseUrl: 'https://api.anthropic.com', authStyle: 'x-api-key', thinkingStyle: 'anthropic', streamUsage: true,
    keyUrl: 'https://console.anthropic.com/settings/keys', docsUrl: 'https://docs.claude.com/en/api/messages',
    temperatureRange: [0, 1],
    models: [
      m('claude-opus-5-5', 'Claude Opus 5.5', 4, 20, 'USD', { reasoning: true }),
      m('claude-sonnet-5-5', 'Claude Sonnet 5.5', 2, 10, 'USD', { reasoning: true }),
      m('claude-haiku-5-5', 'Claude Haiku 5.5', 0.1, 0.5, 'USD', { reasoning: true }),
      m('claude-fable-5-1', 'Claude Fable 5.1', 10, 50, 'USD', { reasoning: true }),
      m('claude-opus-4-8', 'Claude Opus 4.8', 5, 25, 'USD', { reasoning: true }),
      m('claude-sonnet-4-6', 'Claude Sonnet 4.6', 3, 15, 'USD', { reasoning: true }),
      m('claude-haiku-4-5', 'Claude Haiku 4.5', 1, 5, 'USD'),
    ],
  },
  {
    id: 'gemini', name: 'Google Gemini', vendor: 'Google', kind: 'gemini', monogram: 'G', hue: 215,
    baseUrl: 'https://generativelanguage.googleapis.com', authStyle: 'x-goog-api-key', thinkingStyle: 'gemini', streamUsage: true,
    keyUrl: 'https://aistudio.google.com/apikey', docsUrl: 'https://ai.google.dev/api/generate-content',
    temperatureRange: [0, 2],
    models: [
      m('gemini-2.5-pro', 'Gemini 2.5 Pro', 1.25, 10, 'USD', { reasoning: true }),
      m('gemini-2.5-flash', 'Gemini 2.5 Flash', 0.3, 2.5, 'USD', { reasoning: true }),
      m('gemini-3-pro-preview', 'Gemini 3 Pro (preview)', 2, 12, 'USD', { reasoning: true }),
      m('gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', 0.1, 0.4, 'USD'),
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek 深度求索', vendor: 'DeepSeek', kind: 'openai', monogram: 'DS', hue: 228,
    baseUrl: 'https://api.deepseek.com', authStyle: 'bearer', thinkingStyle: 'none', streamUsage: true,
    keyUrl: 'https://platform.deepseek.com/api_keys', docsUrl: 'https://api-docs.deepseek.com/',
    temperatureRange: [0, 2],
    models: [
      m('deepseek-reasoner', 'DeepSeek Reasoner（思考模式）', 2, 3, 'CNY', { reasoning: true }),
      m('deepseek-chat', 'DeepSeek Chat（非思考）', 2, 3, 'CNY'),
    ],
  },
  {
    id: 'qwen', name: '通义千问 Qwen（阿里云百炼）', vendor: 'Alibaba', kind: 'openai', monogram: 'Qw', hue: 252,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    altBaseUrls: [{ label: '国际站（新加坡）', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' }],
    authStyle: 'bearer', thinkingStyle: 'qwen', streamUsage: true,
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1', docsUrl: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope',
    temperatureRange: [0, 1.99],
    models: [
      m('qwen3-max', 'Qwen3-Max', 6, 24, 'CNY'),
      m('qwen-plus', 'Qwen-Plus', 0.8, 2, 'CNY', { reasoning: true }),
      m('qwq-plus', 'QwQ-Plus（推理）', 1.6, 4, 'CNY', { reasoning: true }),
      m('qwen-turbo', 'Qwen-Turbo', 0.3, 0.6, 'CNY'),
    ],
  },
  {
    id: 'kimi', name: 'Kimi（月之暗面 Moonshot）', vendor: 'Moonshot', kind: 'openai', monogram: 'K', hue: 275,
    baseUrl: 'https://api.moonshot.cn/v1',
    altBaseUrls: [{ label: '国际站', url: 'https://api.moonshot.ai/v1' }],
    authStyle: 'bearer', thinkingStyle: 'none', streamUsage: true,
    keyUrl: 'https://platform.moonshot.cn/console/api-keys', docsUrl: 'https://platform.moonshot.cn/docs/api/chat',
    temperatureRange: [0, 1],
    models: [
      m('kimi-k2-thinking', 'Kimi K2 Thinking', 4, 16, 'CNY', { reasoning: true }),
      m('kimi-k2-0905-preview', 'Kimi K2 0905', 4, 16, 'CNY'),
      m('kimi-k2-turbo-preview', 'Kimi K2 Turbo', 8, 58, 'CNY'),
    ],
  },
  {
    id: 'zhipu', name: '智谱 GLM（BigModel）', vendor: 'Zhipu', kind: 'openai', monogram: 'GLM', hue: 200,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    altBaseUrls: [{ label: 'Z.ai 国际站', url: 'https://api.z.ai/api/paas/v4' }],
    // Zhipu accepts the raw key as a Bearer token; "zhipu-jwt" signs a short-lived JWT from an "id.secret" key.
    authStyle: 'bearer', authStyles: ['bearer', 'zhipu-jwt'], thinkingStyle: 'zhipu', streamUsage: true,
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', docsUrl: 'https://docs.bigmodel.cn/api-reference',
    temperatureRange: [0, 1],
    models: [
      m('glm-4.6', 'GLM-4.6', 2, 8, 'CNY', { reasoning: true }),
      m('glm-4.5', 'GLM-4.5', 2, 8, 'CNY', { reasoning: true }),
      m('glm-4.5-air', 'GLM-4.5-Air', 0.8, 2, 'CNY', { reasoning: true }),
      m('glm-4.5-flash', 'GLM-4.5-Flash（免费）', 0, 0, 'CNY'),
    ],
  },
  {
    id: 'doubao', name: '豆包（火山方舟 Ark）', vendor: 'ByteDance', kind: 'openai', monogram: 'DB', hue: 190,
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', authStyle: 'bearer', thinkingStyle: 'doubao', streamUsage: true,
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey', docsUrl: 'https://www.volcengine.com/docs/82379/1494384',
    temperatureRange: [0, 2],
    note: '模型 ID 可填写模型名称（如 doubao-seed-1-6-250615）或推理接入点 ID（ep-xxxx）。',
    models: [
      m('doubao-seed-1-6-250615', 'Doubao Seed 1.6', 0.8, 8, 'CNY', { reasoning: true }),
      m('doubao-seed-1-6-thinking-250715', 'Doubao Seed 1.6 Thinking', 0.8, 8, 'CNY', { reasoning: true }),
      m('doubao-seed-1-6-flash-250828', 'Doubao Seed 1.6 Flash', 0.15, 1.5, 'CNY', { reasoning: true }),
    ],
  },
  {
    id: 'grok', name: 'xAI Grok', vendor: 'xAI', kind: 'openai', monogram: 'X', hue: 0,
    baseUrl: 'https://api.x.ai/v1', authStyle: 'bearer', thinkingStyle: 'none', streamUsage: true,
    keyUrl: 'https://console.x.ai/', docsUrl: 'https://docs.x.ai/docs/api-reference',
    temperatureRange: [0, 2],
    models: [
      m('grok-4', 'Grok 4', 3, 15, 'USD', { reasoning: true }),
      m('grok-4-fast-reasoning', 'Grok 4 Fast (reasoning)', 0.2, 0.5, 'USD', { reasoning: true }),
      m('grok-3-mini', 'Grok 3 mini', 0.3, 0.5, 'USD', { reasoning: true }),
    ],
  },
  {
    id: 'ollama', name: 'Ollama 本地模型', vendor: 'Local', kind: 'ollama', monogram: 'OL', hue: 95,
    baseUrl: 'http://127.0.0.1:11434', authStyle: 'none', thinkingStyle: 'ollama', streamUsage: true,
    keyOptional: true, docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
    temperatureRange: [0, 2],
    note: '本地模型不计费。建议上下文 ≥ 16K（num_ctx），可在模型高级参数里调整。点击「拉取模型列表」读取本机已安装模型。',
    models: [],
  },
  {
    id: 'custom-openai', name: '自定义 · OpenAI 兼容', vendor: 'Custom', kind: 'openai', monogram: '⇄', hue: 300,
    baseUrl: '', authStyle: 'bearer', authStyles: ['bearer', 'api-key', 'x-api-key', 'none'], thinkingStyle: 'none', streamUsage: true,
    custom: true, temperatureRange: [0, 2],
    note: '适用于 OpenRouter、OneAPI/NewAPI 等中转、vLLM、LM Studio、Azure 兼容端点等。Base URL 填到 /v1 这一级（请求发送到 {Base URL}/chat/completions）。',
    models: [],
  },
  {
    id: 'custom-anthropic', name: '自定义 · Anthropic 兼容', vendor: 'Custom', kind: 'anthropic', monogram: '⇄A', hue: 30,
    baseUrl: '', authStyle: 'x-api-key', authStyles: ['x-api-key', 'bearer'], thinkingStyle: 'anthropic', streamUsage: true,
    custom: true, temperatureRange: [0, 1],
    note: '兼容 Anthropic Messages 协议的中转。请求发送到 {Base URL}/v1/messages。',
    models: [],
  },
  {
    id: 'custom-gemini', name: '自定义 · Gemini 兼容', vendor: 'Custom', kind: 'gemini', monogram: '⇄G', hue: 220,
    baseUrl: '', authStyle: 'x-goog-api-key', authStyles: ['x-goog-api-key', 'bearer'], thinkingStyle: 'gemini', streamUsage: true,
    custom: true, temperatureRange: [0, 2],
    note: '兼容 Gemini generateContent 协议的中转。请求发送到 {Base URL}/v1beta/models/{model}:streamGenerateContent。',
    models: [],
  },
];

export const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]));

export function getPreset(id) {
  return PRESET_MAP.get(id) || null;
}

/** Public description for the browser (no secrets live in presets, but keep the shape explicit). */
export function publicPresets() {
  return PRESETS.map((p) => ({
    id: p.id, name: p.name, vendor: p.vendor, kind: p.kind, monogram: p.monogram, hue: p.hue,
    baseUrl: p.baseUrl, altBaseUrls: p.altBaseUrls || [], authStyle: p.authStyle, authStyles: p.authStyles || [p.authStyle],
    thinkingStyle: p.thinkingStyle, keyUrl: p.keyUrl || '', docsUrl: p.docsUrl || '', note: p.note || '',
    custom: !!p.custom, keyOptional: !!p.keyOptional || p.authStyle === 'none', temperatureRange: p.temperatureRange,
    models: p.models,
  }));
}
