// In-app AI assistant. Users bring their own model: Anthropic, any OpenAI-compatible endpoint
// (OpenAI, DeepSeek, Qwen/DashScope, Kimi, GLM…) or a local server (Ollama, LM Studio).
// The assistant edits projects through exactly the same tools the CLI/MCP expose, so whatever
// it does is validated, recorded in history and immediately editable by hand.
import { net, safeStorage } from 'electron';
import fs from 'node:fs';
import { TOOLS } from '../../cli/tools.js';
import * as store from '../../core/store/index.js';
import { summarizeDocument, describeBlock } from '../../core/doc.js';
import { uid } from '../../core/util/misc.js';

export const PROVIDER_PRESETS = [
  { preset: 'anthropic', kind: 'anthropic', name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', vision: true, keyUrl: 'https://console.anthropic.com/settings/keys' },
  { preset: 'openai', kind: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5', vision: true, keyUrl: 'https://platform.openai.com/api-keys' },
  { preset: 'deepseek', kind: 'openai', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', vision: false, keyUrl: 'https://platform.deepseek.com/api_keys' },
  { preset: 'qwen', kind: 'openai', name: '通义千问 Qwen（阿里云百炼）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', vision: false, keyUrl: 'https://bailian.console.aliyun.com/' },
  { preset: 'moonshot', kind: 'openai', name: 'Kimi（月之暗面）', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2-turbo-preview', vision: false, keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
  { preset: 'zhipu', kind: 'openai', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus', vision: false, keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { preset: 'openrouter', kind: 'openai', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4.5', vision: true, keyUrl: 'https://openrouter.ai/keys' },
  { preset: 'ollama', kind: 'openai', name: 'Ollama（本地）', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:14b', vision: false, noKey: true },
  { preset: 'lmstudio', kind: 'openai', name: 'LM Studio（本地）', baseUrl: 'http://localhost:1234/v1', model: 'local-model', vision: false, noKey: true },
  { preset: 'custom', kind: 'openai', name: '自定义（OpenAI 兼容接口）', baseUrl: '', model: '', vision: false },
];

// ───────────────────────────── provider config (keys encrypted at rest) ─────────────────────────────
function aiConfig() { return store.readConfig().ai || { providers: [], active: null }; }
function writeAiConfig(ai) { store.writeConfig({ ai }); }

function encryptKey(key) {
  if (!key) return null;
  if (safeStorage.isEncryptionAvailable()) return { enc: 'safe', data: safeStorage.encryptString(key).toString('base64') };
  return { enc: 'plain', data: Buffer.from(key, 'utf8').toString('base64') };
}
function decryptKey(k) {
  if (!k) return '';
  try { return k.enc === 'safe' ? safeStorage.decryptString(Buffer.from(k.data, 'base64')) : Buffer.from(k.data, 'base64').toString('utf8'); } catch { return ''; }
}

/** Provider list for the renderer — keys never leave the main process. */
export function listProviders() {
  const ai = aiConfig();
  return {
    active: ai.active || ai.providers[0]?.id || null,
    providers: ai.providers.map(({ key, ...p }) => ({ ...p, hasKey: !!key, keyHint: key ? maskKey(decryptKey(key)) : '' })),
    presets: PROVIDER_PRESETS,
    encrypted: safeStorage.isEncryptionAvailable(),
  };
}
const maskKey = (k) => (k ? `${k.slice(0, 3)}…${k.slice(-4)}` : '');

export function saveProvider(p) {
  const ai = aiConfig();
  const id = p.id || uid('ai', 6);
  const old = ai.providers.find((x) => x.id === id);
  const next = {
    id, preset: p.preset || old?.preset || 'custom', kind: p.kind || old?.kind || 'openai',
    name: p.name || old?.name || '模型', baseUrl: String(p.baseUrl ?? old?.baseUrl ?? '').replace(/\/+$/, ''),
    model: p.model ?? old?.model ?? '', vision: !!(p.vision ?? old?.vision), temperature: p.temperature ?? old?.temperature ?? null,
    maxTokens: Number(p.maxTokens ?? old?.maxTokens ?? 8192) || 8192,
    key: p.key === undefined ? old?.key || null : p.key === '' ? null : encryptKey(p.key),
  };
  ai.providers = old ? ai.providers.map((x) => (x.id === id ? next : x)) : [...ai.providers, next];
  if (!ai.active || p.makeActive) ai.active = id;
  writeAiConfig(ai);
  return listProviders();
}

export function deleteProvider(id) {
  const ai = aiConfig();
  ai.providers = ai.providers.filter((p) => p.id !== id);
  if (ai.active === id) ai.active = ai.providers[0]?.id || null;
  writeAiConfig(ai);
  return listProviders();
}

export function setActiveProvider(id) { const ai = aiConfig(); ai.active = id; writeAiConfig(ai); return listProviders(); }

function getProvider(id) {
  const ai = aiConfig();
  const p = ai.providers.find((x) => x.id === (id || ai.active)) || ai.providers[0];
  if (!p) throw Object.assign(new Error('尚未配置 AI 模型'), { hint: '在 设置 → AI 模型 中添加一个模型（云端或本地）' });
  return { ...p, apiKey: decryptKey(p.key) };
}

// ───────────────────────────── HTTP ─────────────────────────────
async function postJson(url, headers, body, signal) {
  let res;
  try {
    res = await net.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error('已停止'), { cancelled: true });
    throw Object.assign(new Error(`无法连接 ${new URL(url).host}：${e.message}`), { hint: '检查网络、代理或接口地址（本地模型请确认服务已启动）' });
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || json?.error || text.slice(0, 300);
    const hint = res.status === 401 || res.status === 403 ? 'API Key 无效或无权限' : res.status === 404 ? '接口地址或模型名称可能有误' : res.status === 429 ? '请求过于频繁或额度不足' : undefined;
    throw Object.assign(new Error(`模型接口返回 ${res.status}：${typeof msg === 'string' ? msg : JSON.stringify(msg)}`), { hint });
  }
  if (!json) throw new Error('模型接口返回了无法解析的内容');
  return json;
}

function toolDefs() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, schema: t.input }));
}

// Neutral → provider message formats. A turn's internal tool traffic stays inside the loop; the
// renderer keeps only user/assistant text, and every turn re-reads the live project summary.
async function callModel(p, system, messages, tools, signal) {
  if (p.kind === 'anthropic') {
    const body = { model: p.model, max_tokens: p.maxTokens || 8192, system, messages };
    if (tools.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema }));
    if (p.temperature != null) body.temperature = p.temperature;
    const r = await postJson(`${p.baseUrl || 'https://api.anthropic.com'}/v1/messages`, { 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' }, body, signal);
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
    const calls = r.content.filter((c) => c.type === 'tool_use').map((c) => ({ id: c.id, name: c.name, args: c.input || {} }));
    return { text, calls, raw: { role: 'assistant', content: r.content }, usage: r.usage };
  }
  const body = { model: p.model, messages: [{ role: 'system', content: system }, ...messages] };
  if (tools.length) Object.assign(body, { tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.schema } })), tool_choice: 'auto' });
  if (p.temperature != null) body.temperature = p.temperature;
  if (p.maxTokens) body.max_tokens = p.maxTokens;
  const headers = p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {};
  if (p.preset === 'openrouter') Object.assign(headers, { 'HTTP-Referer': 'https://motif.app', 'X-Title': 'Motif' });
  const r = await postJson(`${p.baseUrl}/chat/completions`, headers, body, signal);
  const m = r.choices?.[0]?.message || {};
  const calls = (m.tool_calls || []).map((c) => {
    let args = {};
    try { args = typeof c.function.arguments === 'string' ? JSON.parse(c.function.arguments || '{}') : c.function.arguments || {}; } catch { args = { __parseError: c.function.arguments }; }
    return { id: c.id || uid('call', 6), name: c.function.name, args };
  });
  const raw = { role: 'assistant', content: m.content || '', ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) };
  return { text: typeof m.content === 'string' ? m.content : '', calls, raw, usage: r.usage };
}

function toolResultMessages(p, results) {
  if (p.kind === 'anthropic') {
    return [{ role: 'user', content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, is_error: !r.ok, content: [{ type: 'text', text: r.text }, ...(r.image ? [{ type: 'image', source: { type: 'base64', media_type: r.image.mime, data: r.image.data } }] : [])] })) }];
  }
  const msgs = results.map((r) => ({ role: 'tool', tool_call_id: r.id, content: r.text }));
  const imgs = results.filter((r) => r.image);
  if (p.vision && imgs.length) msgs.push({ role: 'user', content: [{ type: 'text', text: '（上面工具返回的渲染画面）' }, ...imgs.map((r) => ({ type: 'image_url', image_url: { url: `data:${r.image.mime};base64,${r.image.data}` } }))] });
  return msgs;
}

function systemPrompt(project, selection) {
  let ctx = '';
  try {
    const { doc } = store.loadProject(project);
    ctx = `\n\n## 当前项目\nID：${doc.id}\n${summarizeDocument(doc)}`;
    if (selection?.block) {
      for (const s of doc.scenes) { const b = s.blocks.find((x) => x.id === selection.block); if (b) ctx += `\n\n用户当前选中块 ${b.id}（场景 ${s.id}）：${describeBlock(b)}\n${JSON.stringify(b).slice(0, 1500)}`; }
    } else if (selection?.scene) ctx += `\n\n用户当前选中场景 ${selection.scene}。`;
  } catch { /* no project */ }
  return `你是 Motif（律影）动态视觉创作软件内置的设计助手。你通过工具直接编辑用户打开的作品，用户会在编辑器里实时看到变化，并可以继续手动修改。

工作方式：
- 你提供内容、数据与少量设计参数；版式、字体、配色、动画编排、转场与镜头由 Motif 的设计系统自动完成。不要试图逐像素布局。
- 修改作品一律用 motif_apply_ops（原子操作，失败会返回原因与提示）。改之前确认场景与块 ID（见下方项目摘要，或 motif_get_project）。
- 不确定某组件的参数时，先用 motif_catalog 查询（如 "chart"、"timeline"、"scene"、"ops"）。
- 每场景只讲一件事：标题短（中文 ≤ 20 字）、要点 ≤ 5 条、正文 ≤ 80 字；数据优先用图表/数字组件表达。
- 讲解公式、图表、流程等需要停留较久的内容时，用场景的 guide（讲解指针）让光标依次圈出/划线/指向局部，每步配一句 say；写法用 motif_catalog("scene") 查看「讲解指针」。
- 改完运行 motif_lint，修正 error 与重要 warning；需要目视确认时用 motif_render_still 或 motif_preview。
- 不要编造事实与数据；缺少信息时用占位并告诉用户。
- 用用户使用的语言简洁回复，说明你改了什么（场景序号 + 要点），不要贴大段 JSON。${ctx}`;
}

const running = new Map();

/**
 * Run one assistant turn (possibly many tool rounds).
 * req: { chatId, provider, project, selection, messages:[{role,content}] }
 * emit(event): {type:'text'|'tool'|'tool_result'|'changed'|'done'|'error', …}
 */
export async function chat(req, emit) {
  const chatId = req.chatId || uid('chat', 6);
  const ac = new AbortController();
  running.set(chatId, ac);
  const p = getProvider(req.provider);
  if (!p.apiKey && !PROVIDER_PRESETS.find((x) => x.preset === p.preset)?.noKey && p.preset !== 'custom') {
    running.delete(chatId);
    throw Object.assign(new Error(`模型「${p.name}」没有设置 API Key`), { hint: '在 设置 → AI 模型 中填写' });
  }
  const tools = toolDefs();
  const msgs = req.messages.filter((m) => m.content).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));
  const MAX_ROUNDS = 18;
  let finalText = '';
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const sys = systemPrompt(req.project, req.selection);
      const r = await callModel(p, sys, msgs, tools, ac.signal);
      if (r.text) { emit({ type: 'text', text: r.text }); finalText += (finalText ? '\n\n' : '') + r.text; }
      msgs.push(r.raw);
      if (!r.calls.length) break;
      const results = [];
      for (const c of r.calls) {
        if (ac.signal.aborted) throw Object.assign(new Error('已停止'), { cancelled: true });
        emit({ type: 'tool', id: c.id, name: c.name, args: c.args });
        const res = await runTool(c, req.project);
        results.push(res);
        emit({ type: 'tool_result', id: c.id, name: c.name, ok: res.ok, summary: res.summary, image: res.image ? `data:${res.image.mime};base64,${res.image.data}` : undefined });
        if (res.mutated) emit({ type: 'changed' });
      }
      msgs.push(...toolResultMessages(p, results));
      if (round === MAX_ROUNDS - 1) emit({ type: 'text', text: '（已达到单轮工具调用上限，可以继续对话让我接着做。）' });
    }
    emit({ type: 'done', text: finalText });
  } catch (e) {
    emit({ type: e.cancelled ? 'cancelled' : 'error', message: e.message, hint: e.hint });
  } finally {
    running.delete(chatId);
  }
  return { chatId };
}

export function cancel(chatId) { running.get(chatId)?.abort(); }

const MUTATING = new Set(['motif_apply_ops', 'motif_write_document', 'motif_import_asset', 'motif_insert_component', 'motif_restore']);

async function runTool(c, project) {
  const t = TOOLS.find((x) => x.name === c.name);
  if (!t) return { id: c.id, ok: false, text: `未知工具 ${c.name}`, summary: '未知工具' };
  if (c.args?.__parseError) return { id: c.id, ok: false, text: `参数不是合法 JSON：${String(c.args.__parseError).slice(0, 200)}`, summary: '参数解析失败' };
  const args = { ...c.args };
  if ('project' in (t.input.properties || {}) && !args.project && project) args.project = project;
  try {
    const result = await t.run(args);
    let text = typeof result === 'string' ? result : JSON.stringify(result, null, 1);
    if (text.length > 24000) text = text.slice(0, 24000) + '\n…（已截断）';
    let image = null;
    if (t.image && result?.out && fs.existsSync(result.out)) image = { mime: /\.jpe?g$/i.test(result.out) ? 'image/jpeg' : 'image/png', data: fs.readFileSync(result.out).toString('base64') };
    const ok = result?.ok !== false;
    return { id: c.id, ok, text, image, mutated: MUTATING.has(c.name) && ok, summary: summarize(c.name, result) };
  } catch (e) {
    return { id: c.id, ok: false, text: `错误：${e.message}${e.hint ? `\n提示：${e.hint}` : ''}`, summary: e.message };
  }
}

function summarize(name, r) {
  if (!r || typeof r !== 'object') return '';
  if (name === 'motif_apply_ops') return r.ok ? `${r.results?.length || 0} 项修改 · 修订 ${r.revision}` : `失败：${r.results?.find((x) => !x.ok)?.error || ''}`;
  if (name === 'motif_lint') return `${r.counts?.error || 0} 错误 · ${r.counts?.warning || 0} 警告`;
  if (name === 'motif_get_project') return r.title ? `「${r.title}」${r.scenes?.length || 0} 个场景` : '';
  if (name === 'motif_export') return r.out || '';
  return '';
}

/** Minimal round-trip to validate a provider's address/key/model. */
export async function testProvider(id) {
  const p = getProvider(id);
  const t0 = Date.now();
  const r = await callModel(p, '只回复：OK', [{ role: 'user', content: 'ping' }], [], AbortSignal.timeout(30000));
  return { ok: true, ms: Date.now() - t0, reply: (r.text || '').slice(0, 60), model: p.model };
}
