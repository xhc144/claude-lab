#!/usr/bin/env node
// Protocol-faithful mock of four LLM wire protocols, for automated tests and offline UI development.
// It is NOT a model: answers come from a small scripted "research brain" so that the full Lunheng
// pipeline (tags, ledger, verification, report) can be exercised deterministically without API keys.
//
//   /openai/v1/chat/completions        OpenAI Chat Completions SSE (Bearer auth, stream_options usage)
//   /anthropic/v1/messages             Anthropic Messages SSE (x-api-key + anthropic-version)
//   /gemini/v1beta/models/{m}:streamGenerateContent?alt=sse   (x-goog-api-key)
//   /ollama/api/chat                   Ollama NDJSON
//
// Fault injection by model id: "*flaky*" → first call 429 + Retry-After; "*broken*" → 500;
// "*dropstream*" → first call disconnects mid-stream; "o*"/"gpt-5*" (openai) → strict reasoning params.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

export const MOCK_KEYS = { openai: 'sk-mock-openai-0123456789', anthropic: 'sk-ant-mock-0123456789', gemini: 'AIza-mock-0123456789' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────────── scripted research brain ─────────────────────────────

function digestClaims(text) {
  const out = [];
  const re = /### (C\d+) · (\S+) · 【([^】]+)】[^\n]*\n(?:陈述：)?([^\n]*)/g;
  for (const m of text.matchAll(re)) out.push({ id: m[1], kind: m[2], status: m[3], statement: m[4] });
  return out;
}

function listAfter(text, label) {
  const m = text.match(new RegExp(`${label}([^。\\n]*)`));
  return m ? (m[1].match(/[CO]\d+/g) || []) : [];
}

function objectionTypes(text) {
  const map = {};
  for (const m of text.matchAll(/- (O\d+)［[^·］]+· [^·］]+ · ([^ ·］]+) ·/g)) map[m[1]] = m[2];
  for (const m of text.matchAll(/- (O\d+) 针对 (C\d+)（[^·）]+· [^·）]+ · ([^）]+)）/g)) map[m[1]] = m[3];
  return map;
}

export function researchBrain(system, messages) {
  const first = messages.find((m) => m.role === 'user')?.content || '';
  const last = messages[messages.length - 1]?.content || '';
  const label = (system.match(/研究员 ([A-L])，角色/) || [])[1] || 'A';
  const phase = (first.match(/阶段：(\S+)/) || [])[1] || '';
  const round = +((first.match(/第 (\d+) 轮/) || [])[1] || 1);
  const euler = /n\^?2\s*\+\s*n\s*\+\s*41|n²\s*\+\s*n\s*\+\s*41/.test(first);

  if (last.includes('沙箱已执行你的代码')) {
    const found = /1681|n=40|40\b/.test(last);
    return `根据沙箱输出，${found ? '最小的合数值出现在 $n=40$，$1681=41^2$。' : '计算没有发现异常。'}\n\n<stance target="C0" position="${found ? 'disagree' : 'unsure'}" confidence="${found ? 0.99 : 0.5}">计算结果${found ? '确认反例' : '不足以判断'}</stance>`;
  }
  if (last.includes('没有使用标记协议')) return '<stance target="C0" position="unsure" confidence="0.5">格式修复</stance>';
  if (phase === '撰写报告') {
    return `## 问题重述\n研究命题询问一个多项式是否恒取素数值。\n\n## 研究过程\n团队先独立分析，随后交叉质询与独立核验。\n\n## 主要发现\n${euler ? '$n=40$ 给出 $1681=41^2$，命题不成立；前 40 个值均为素数这一观察成立。' : '尚未获得完整证明。'}\n\n## 未解决问题\n是否存在对无穷多个 $n$ 取素数值的二次多项式（Bunyakovsky 猜想）仍未解决。`;
  }
  if (phase === '定向问询') return `研究员 ${label} 回答：这是一个好问题。根据当前账本，关键在于核验已有的论证。`;

  const claims = digestClaims(first);
  const find = (pred) => claims.find((c) => c.id !== 'C0' && pred(c));
  const bogus = find((c) => /对所有非负整数/.test(c.statement));
  const counter = find((c) => /1681/.test(c.statement));
  const finite = find((c) => /0\\le n\\le 39|0≤n≤39/.test(c.statement));

  if (phase === '独立研究') {
    if (!euler) {
      return `研究员 ${label} 的独立分析：需要进一步的证明。\n\n<claim ref="n1" kind="conjecture" relation="supports" target="C0"><statement>（研究员 ${label}）初步判断该命题在一般情形下成立。</statement></claim>\n<stance target="C0" position="unsure" confidence="0.5">证据不足</stance>`;
    }
    switch (label) {
      case 'A': return '我逐一检验了前 40 个值。\n\n<claim ref="n1" kind="observation" relation="supports" target="C0"><statement>对 $0\\le n\\le 39$，$n^2+n+41$ 均为素数。</statement><proof>逐一验算 $n=0,1,\\dots,39$ 的取值并做试除。</proof></claim>\n<stance target="C0" position="agree" confidence="0.6">前 40 项均为素数</stance>';
      case 'B': return '这是欧拉的著名多项式。\n\n<claim ref="n1" kind="theorem" relation="proves" target="C0"><statement>对所有非负整数 $n$，$n^2+n+41$ 是素数。</statement><proof>判别式为 $1-4\\cdot 41=-163$，而 $\\mathbb{Q}(\\sqrt{-163})$ 的类数为 1，因此 $n^2+n+41$ 不可能有非平凡因子。</proof></claim>\n<stance target="C0" position="agree" confidence="0.85">类数论证</stance>';
      case 'C': return '先找小反例。注意 $n=40$ 时 $n^2+n+41 = 40\\cdot 41 + 41 = 41^2$。\n\n<claim ref="n1" kind="counterexample" target="C0"><statement>当 $n=40$ 时，$n^2+n+41=1681=41^2$，不是素数。</statement><proof>$40^2+40+41=40\\cdot(40+1)+41=41\\cdot 41=1681$。</proof></claim>\n<compute purpose="寻找最小的 n 使 n^2+n+41 为合数" target="n1">\nfor (let n = 0; n < 100; n++) {\n  const v = n * n + n + 41;\n  let prime = true;\n  for (let d = 2; d * d <= v; d++) if (v % d === 0) { prime = false; break; }\n  if (!prime) { console.log("n=" + n, v); break; }\n}\n</compute>\n<stance target="C0" position="disagree" confidence="0.95">n=40 是反例</stance>';
      case 'D': return '大量数值证据支持该多项式“经常”取素数。\n\n<claim ref="n1" kind="conjecture" relation="supports" target="C0"><statement>$n^2+n+41$ 对无穷多个 $n$ 取素数值。</statement></claim>\n<stance target="C0" position="agree" confidence="0.55">数值证据很强</stance>';
      case 'E': return '我暂时无法判断。\n\n<stance target="C0" position="unsure" confidence="0.5">需要更多分析</stance>\n<question>是否存在非常数整系数多项式对所有自然数都取素数值？</question>';
      default: return '<stance target="C0" position="agree" confidence="0.6">倾向成立</stance>';
    }
  }

  if (phase === '交叉质询' || phase === '专项攻关') {
    const targets = listAfter(first, '分配给你的目标：');
    const parts = [`研究员 ${label} 的审查意见。`];
    for (const t of targets) {
      const c = claims.find((x) => x.id === t);
      if (!c) continue;
      if (bogus && t === bogus.id) parts.push(`<objection target="${t}" type="counterexample" severity="fatal">取 $n=40$ 即得合数，类数为 1 只说明 $\\mathbb{Z}[\\frac{1+\\sqrt{-163}}{2}]$ 是唯一分解整环，并不意味着多项式恒取素数值。<counterexample>$40^2+40+41=1681=41^2$</counterexample></objection>\n<stance target="${t}" position="disagree" confidence="0.95">存在反例</stance>`);
      else if (counter && t === counter.id) parts.push(`<stance target="${t}" position="agree" confidence="0.95">验算无误</stance>`);
      else if (finite && t === finite.id) parts.push(`<stance target="${t}" position="agree" confidence="0.9">有限验算</stance>`);
      else if (/无穷多个/.test(c.statement)) parts.push(`<objection target="${t}" type="gap" severity="minor">这是 Bunyakovsky 猜想的特例，目前没有证明。</objection>\n<stance target="${t}" position="unsure" confidence="0.5">未证明</stance>`);
      else parts.push(`<stance target="${t}" position="unsure" confidence="0.5">尚需证明</stance>`);
    }
    if (euler) parts.push(['B', 'D'].includes(label) ? '<stance target="C0" position="agree" confidence="0.6">仍倾向成立</stance>' : '<stance target="C0" position="disagree" confidence="0.9">反例成立</stance>');
    else parts.push('<stance target="C0" position="unsure" confidence="0.5">尚无定论</stance>');
    return parts.join('\n\n');
  }

  if (phase === '答辩修正') {
    const types = objectionTypes(first);
    const parts = ['逐条回应：'];
    for (const [oid, type] of Object.entries(types)) {
      if (type === '反例') parts.push(`<response objection="${oid}" action="concede">质疑成立：$n=40$ 确实给出 $41^2$，我的类数论证混淆了“唯一分解”与“取素数值”。</response>`);
      else parts.push(`<response objection="${oid}" action="rebut">该断言明确标注为猜想，没有声称已证明。</response>`);
    }
    parts.push('<stance target="C0" position="disagree" confidence="0.9">承认反例</stance>');
    return parts.join('\n\n');
  }

  if (phase === '独立核验') {
    const toCheck = listAfter(first, '需要你核验的断言：');
    const toRule = listAfter(first, '需要你裁定的质疑：');
    const types = objectionTypes(first);
    const parts = ['独立核验记录：'];
    for (const t of toCheck) {
      const c = claims.find((x) => x.id === t);
      if (!c) continue;
      if (bogus && t === bogus.id) parts.push(`<verdict target="${t}" result="false">$n=40$ 时取值 $1681=41^2$，陈述为假。</verdict>`);
      else if ((counter && t === counter.id) || (finite && t === finite.id)) parts.push(`<verdict target="${t}" result="valid">逐步验算：$40\\cdot 41+41=41^2$；每一步均成立。</verdict>`);
      else parts.push(`<verdict target="${t}" result="unverifiable">没有足够的论证可供核验。</verdict>`);
    }
    for (const o of toRule) parts.push(`<ruling objection="${o}" result="${types[o] === '反例' ? 'upheld' : 'dismissed'}">${types[o] === '反例' ? '反例经验算成立。' : '该质疑不影响结论。'}</ruling>`);
    return parts.join('\n\n');
  }

  if (phase === '综合规划') {
    const settled = /C0 · 主命题 · 【已证伪】|C0 · 主命题 · 【已证明】/.test(first);
    return `<summary>第 ${round} 轮：${settled ? '主命题已由经过独立核验的论证判定。' : '仍有待核验的断言。'}</summary>\n<focus target="C0" priority="high">核心命题</focus>\n<assign researcher="B" task="refute" target="C0">尝试寻找反例</assign>\n<decision value="${settled || round >= 2 ? 'conclude' : 'continue'}">${settled ? '主命题已判定' : '继续研究'}</decision>`;
  }
  return '<stance target="C0" position="unsure" confidence="0.5"/>';
}

// ───────────────────────────── protocol servers ─────────────────────────────

function chunkText(text, n = 24) {
  const parts = [];
  for (let i = 0; i < text.length; i += n) parts.push(text.slice(i, i + n));
  return parts;
}

const approxTokens = (s) => Math.ceil(String(s).length / 3);

export function createMockServer({ delayMs = Number(process.env.MOCK_DELAY ?? 3), log = false } = {}) {
  const attempts = new Map();
  const stats = { requests: [] };

  function once(key) {
    const n = (attempts.get(key) || 0) + 1;
    attempts.set(key, n);
    return n === 1;
  }

  async function body(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const s = Buffer.concat(chunks).toString('utf8');
    return s ? JSON.parse(s) : {};
  }

  const json = (res, status, obj, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); };

  async function faults(res, model, key, format) {
    if (/broken/.test(model)) { json(res, 500, format('internal server error')); return true; }
    if (/flaky/.test(model) && once(`flaky:${key}:${model}`)) { json(res, 429, format('rate limit reached'), { 'retry-after': '1' }); return true; }
    return false;
  }

  // OpenAI-compatible
  async function openai(req, res, path) {
    const auth = req.headers.authorization || '';
    if (path === '/openai/v1/models' && req.method === 'GET') {
      if (auth !== `Bearer ${MOCK_KEYS.openai}`) return json(res, 401, { error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', code: 'invalid_api_key' } });
      return json(res, 200, { object: 'list', data: [{ id: 'mock-gpt', object: 'model' }, { id: 'mock-reasoner', object: 'model' }, { id: 'gpt-5-mock', object: 'model' }] });
    }
    if (path !== '/openai/v1/chat/completions' || req.method !== 'POST') return json(res, 404, { error: { message: 'not found' } });
    const b = await body(req);
    stats.requests.push({ protocol: 'openai', body: b, headers: req.headers });
    if (auth !== `Bearer ${MOCK_KEYS.openai}`) {
      const shown = auth.replace(/^Bearer\s+/, '');
      return json(res, 401, { error: { message: `Incorrect API key provided: ${shown}. You can find your API key at https://platform.openai.com/account/api-keys.`, type: 'invalid_request_error', code: 'invalid_api_key' } });
    }
    const model = b.model || '';
    if (/^(o\d|gpt-5)/.test(model)) {
      if (b.max_tokens != null) return json(res, 400, { error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", type: 'invalid_request_error', param: 'max_tokens', code: 'unsupported_parameter' } });
      if (b.temperature != null && b.temperature !== 1) return json(res, 400, { error: { message: "Unsupported value: 'temperature' does not support 0.6 with this model. Only the default (1) value is supported.", type: 'invalid_request_error', param: 'temperature', code: 'unsupported_value' } });
    }
    if (/nostreamopts/.test(model) && b.stream_options) return json(res, 400, { error: { message: 'Unrecognized request argument supplied: stream_options', type: 'invalid_request_error' } });
    if (await faults(res, model, 'openai', (m) => ({ error: { message: m, type: 'server_error' } }))) return;
    if (!Array.isArray(b.messages) || !b.stream) return json(res, 400, { error: { message: 'messages and stream required' } });
    const system = b.messages.find((m) => m.role === 'system')?.content || '';
    const convo = b.messages.filter((m) => m.role !== 'system');
    const text = researchBrain(system, convo);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const base = { id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model };
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })}\n\n`);
    res.write(': keep-alive\n\n');
    if (/reasoner/.test(model)) {
      for (const t of chunkText('先分析题意，再考虑边界情形……', 6)) {
        res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { reasoning_content: t }, finish_reason: null }] })}\n\n`);
        await sleep(delayMs);
      }
    }
    const drop = /dropstream/.test(model) && once(`drop:${model}`);
    const parts = chunkText(text);
    for (let i = 0; i < parts.length; i++) {
      if (drop && i === Math.floor(parts.length / 2)) { res.destroy(); return; }
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { content: parts[i] }, finish_reason: null }] })}\n\n`);
      await sleep(delayMs);
    }
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
    if (b.stream_options?.include_usage) {
      const pt = approxTokens(JSON.stringify(b.messages));
      res.write(`data: ${JSON.stringify({ ...base, choices: [], usage: { prompt_tokens: pt, completion_tokens: approxTokens(text), total_tokens: pt + approxTokens(text), completion_tokens_details: { reasoning_tokens: /reasoner/.test(model) ? 7 : 0 } } })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }

  // Anthropic Messages
  async function anthropic(req, res, path) {
    const key = req.headers['x-api-key'];
    const errEnv = (type, message) => ({ type: 'error', error: { type, message }, request_id: 'req_mock' });
    if (path.startsWith('/anthropic/v1/models') && req.method === 'GET') {
      if (key !== MOCK_KEYS.anthropic) return json(res, 401, errEnv('authentication_error', 'invalid x-api-key'));
      return json(res, 200, { data: [{ type: 'model', id: 'claude-mock-sonnet', display_name: 'Claude Mock Sonnet' }], has_more: false });
    }
    if (path !== '/anthropic/v1/messages' || req.method !== 'POST') return json(res, 404, errEnv('not_found_error', 'Not found'));
    const b = await body(req);
    stats.requests.push({ protocol: 'anthropic', body: b, headers: req.headers });
    if (key !== MOCK_KEYS.anthropic) return json(res, 401, errEnv('authentication_error', 'invalid x-api-key'));
    if (!req.headers['anthropic-version']) return json(res, 400, errEnv('invalid_request_error', 'anthropic-version: header is required'));
    if (!b.max_tokens) return json(res, 400, errEnv('invalid_request_error', 'max_tokens: Field required'));
    if (b.messages?.some((m) => m.role === 'system')) return json(res, 400, errEnv('invalid_request_error', 'messages: Unexpected role "system"'));
    if (/strict/.test(b.model) && b.temperature != null) return json(res, 400, errEnv('invalid_request_error', '`temperature` is deprecated for this model.'));
    if (await faults(res, b.model, 'anthropic', (m) => errEnv(/rate/.test(m) ? 'rate_limit_error' : 'api_error', m))) return;
    const text = researchBrain(typeof b.system === 'string' ? b.system : '', b.messages);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    const inTok = approxTokens(JSON.stringify(b.messages) + (b.system || ''));
    ev('message_start', { message: { id: 'msg_mock', type: 'message', role: 'assistant', model: b.model, content: [], stop_reason: null, usage: { input_tokens: inTok, output_tokens: 1 } } });
    let idx = 0;
    if (b.thinking) {
      ev('content_block_start', { index: idx, content_block: { type: 'thinking', thinking: '' } });
      for (const t of chunkText('考虑命题的量词与边界。', 5)) { ev('content_block_delta', { index: idx, delta: { type: 'thinking_delta', thinking: t } }); await sleep(delayMs); }
      ev('content_block_delta', { index: idx, delta: { type: 'signature_delta', signature: 'sig' } });
      ev('content_block_stop', { index: idx });
      idx++;
    }
    ev('content_block_start', { index: idx, content_block: { type: 'text', text: '' } });
    ev('ping', {});
    for (const t of chunkText(text)) { ev('content_block_delta', { index: idx, delta: { type: 'text_delta', text: t } }); await sleep(delayMs); }
    ev('content_block_stop', { index: idx });
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: approxTokens(text) } });
    ev('message_stop', {});
    res.end();
  }

  // Gemini
  async function gemini(req, res, path, url) {
    const key = req.headers['x-goog-api-key'];
    const errEnv = (code, message, status) => ({ error: { code, message, status } });
    if (path === '/gemini/v1beta/models' && req.method === 'GET') {
      if (key !== MOCK_KEYS.gemini) return json(res, 400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } });
      return json(res, 200, { models: [{ name: 'models/gemini-mock-pro', displayName: 'Gemini Mock Pro', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embedding-mock', supportedGenerationMethods: ['embedContent'] }] });
    }
    const m = path.match(/^\/gemini\/v1beta\/models\/([^:]+):streamGenerateContent$/);
    if (!m || req.method !== 'POST') return json(res, 404, errEnv(404, 'not found', 'NOT_FOUND'));
    if (url.searchParams.get('alt') !== 'sse') return json(res, 400, errEnv(400, 'alt=sse expected by mock', 'INVALID_ARGUMENT'));
    const b = await body(req);
    stats.requests.push({ protocol: 'gemini', body: b, headers: req.headers, model: m[1] });
    if (key !== MOCK_KEYS.gemini) return json(res, 400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }] } });
    if (await faults(res, m[1], 'gemini', (msg) => errEnv(/rate/.test(msg) ? 429 : 500, msg, /rate/.test(msg) ? 'RESOURCE_EXHAUSTED' : 'INTERNAL'))) return;
    for (let i = 1; i < b.contents.length; i++) if (b.contents[i].role === b.contents[i - 1].role) return json(res, 400, errEnv(400, 'Please ensure that multiturn requests alternate between user and model.', 'INVALID_ARGUMENT'));
    const system = b.systemInstruction?.parts?.map((p) => p.text).join('') || '';
    const messages = b.contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map((p) => p.text).join('\n\n') }));
    const text = researchBrain(system, messages);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\r\n\r\n`);
    if (b.generationConfig?.thinkingConfig?.includeThoughts) {
      send({ candidates: [{ content: { role: 'model', parts: [{ text: '**Analyzing** the claim', thought: true }] }, index: 0 }], modelVersion: m[1] });
    }
    const parts = chunkText(text, 40);
    for (let i = 0; i < parts.length; i++) {
      const last = i === parts.length - 1;
      const chunk = { candidates: [{ content: { role: 'model', parts: [{ text: parts[i] }] }, index: 0, ...(last ? { finishReason: 'STOP' } : {}) }], modelVersion: m[1] };
      if (last) chunk.usageMetadata = { promptTokenCount: approxTokens(JSON.stringify(b.contents)), candidatesTokenCount: approxTokens(text), thoughtsTokenCount: 5, totalTokenCount: 0 };
      send(chunk);
      await sleep(delayMs);
    }
    res.end();
  }

  // Ollama
  async function ollama(req, res, path) {
    if (path === '/ollama/api/tags' && req.method === 'GET') {
      return json(res, 200, { models: [{ name: 'qwen3:8b', model: 'qwen3:8b', details: { parameter_size: '8.2B' } }, { name: 'llama3.1:8b', model: 'llama3.1:8b', details: { parameter_size: '8.0B' } }] });
    }
    if (path !== '/ollama/api/chat' || req.method !== 'POST') return json(res, 404, { error: 'not found' });
    const b = await body(req);
    stats.requests.push({ protocol: 'ollama', body: b, headers: req.headers });
    if (b.think === true && /nothink/.test(b.model)) return json(res, 400, { error: `"${b.model}" does not support thinking` });
    if (await faults(res, b.model, 'ollama', (m) => ({ error: m }))) return;
    const system = b.messages.find((x) => x.role === 'system')?.content || '';
    const text = researchBrain(system, b.messages.filter((x) => x.role !== 'system'));
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    if (b.think) res.write(JSON.stringify({ model: b.model, message: { role: 'assistant', content: '', thinking: '思考中…' }, done: false }) + '\n');
    for (const t of chunkText(text)) { res.write(JSON.stringify({ model: b.model, created_at: new Date().toISOString(), message: { role: 'assistant', content: t }, done: false }) + '\n'); await sleep(delayMs); }
    res.write(JSON.stringify({ model: b.model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: approxTokens(JSON.stringify(b.messages)), eval_count: approxTokens(text) }) + '\n');
    res.end();
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    const path = url.pathname;
    if (log) console.log(req.method, path);
    try {
      if (path.startsWith('/openai/')) return await openai(req, res, path);
      if (path.startsWith('/anthropic/')) return await anthropic(req, res, path);
      if (path.startsWith('/gemini/')) return await gemini(req, res, path, url);
      if (path.startsWith('/ollama/')) return await ollama(req, res, path);
      json(res, 404, { error: 'unknown protocol prefix' });
    } catch (err) {
      if (!res.headersSent) json(res, 500, { error: { message: String(err.message) } });
      else res.end();
    }
  });
  return { server, stats, reset: () => { attempts.clear(); stats.requests.length = 0; } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.MOCK_PORT || 8849);
  const { server } = createMockServer({ delayMs: Number(process.env.MOCK_DELAY ?? 25), log: !!process.env.MOCK_LOG });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Lunheng 协议模拟服务器（仅用于测试，不是真实模型）：http://127.0.0.1:${port}`);
    console.log(`  OpenAI 兼容  Base URL http://127.0.0.1:${port}/openai/v1      Key ${MOCK_KEYS.openai}`);
    console.log(`  Anthropic   Base URL http://127.0.0.1:${port}/anthropic       Key ${MOCK_KEYS.anthropic}`);
    console.log(`  Gemini      Base URL http://127.0.0.1:${port}/gemini          Key ${MOCK_KEYS.gemini}`);
    console.log(`  Ollama      Base URL http://127.0.0.1:${port}/ollama          （无需 Key）`);
  });
}
