import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, startMock, setupLab, MOCK_KEYS } from './helpers.mjs';
import { Budget } from '../../server/engine/budget.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let mock, lab, c, P, gw, uid;

before(async () => {
  mock = await startMock();
  lab = await startApp();
  ({ c, providers: P } = await setupLab(lab.url, mock.url));
  gw = lab.app.gateway;
  uid = (await c.get('/api/auth/me')).data.user.id;
});
after(async () => { await lab.close(); await mock.close(); });

const ask = (providerId, modelId, extra = {}) => {
  const deltas = { text: '', thinking: '' };
  return gw.invoke({
    userId: uid, providerId, modelId, system: '你是「论衡」多智能体学术研究实验室的研究员 A，角色：主持人。',
    messages: [{ role: 'user', content: '# 研究命题（C0）\n测试\n\n领域：数学 · 第 1 轮 · 阶段：独立研究' }],
    maxTokens: 1024, temperature: 0.6, onDelta: (d) => { deltas[d.type] += d.text; }, ...extra,
  }).then((r) => ({ ...r, deltas }));
};

test('OpenAI-compatible: streaming, reasoning_content, usage and CNY pricing', async () => {
  mock.reset();
  const r = await ask(P.openai.id, 'mock-reasoner');
  assert.match(r.text, /<stance/);
  assert.equal(r.deltas.text, r.text);
  assert.ok(r.thinking.length > 0 && r.deltas.thinking === r.thinking, 'reasoning streamed as thinking');
  assert.equal(r.usage.estimated, false);
  assert.ok(r.usage.inputTokens > 0 && r.usage.outputTokens > 0);
  assert.equal(r.usage.reasoningTokens, 7);
  const expected = (r.usage.inputTokens * 4 + r.usage.outputTokens * 16) / 1e6 / 7.1;
  assert.ok(Math.abs(r.costUsd - expected) < 1e-12);
  const req = mock.stats.requests.at(-1);
  assert.equal(req.headers.authorization, `Bearer ${MOCK_KEYS.openai}`);
  assert.deepEqual(req.body.stream_options, { include_usage: true });
  assert.equal(req.body.messages[0].role, 'system');
});

test('Anthropic: x-api-key, anthropic-version, system field, thinking deltas, usage', async () => {
  mock.reset();
  const r = await ask(P.anthropic.id, 'claude-mock-sonnet', { thinking: 'on', maxTokens: 8000 });
  const req = mock.stats.requests.at(-1);
  assert.equal(req.headers['x-api-key'], MOCK_KEYS.anthropic);
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(typeof req.body.system, 'string');
  assert.ok(!req.body.messages.some((m) => m.role === 'system'));
  assert.equal(req.body.thinking.type, 'enabled', 'older models take a thinking budget');
  assert.ok(req.body.thinking.budget_tokens < req.body.max_tokens);
  assert.equal(req.body.temperature, undefined, 'temperature is not sent with extended thinking');
  assert.ok(r.thinking.length > 0);
  assert.ok(r.usage.inputTokens > 0 && r.usage.outputTokens > 0);
});

test('Anthropic: current models get adaptive thinking and no sampling params', async () => {
  const { buildRequest } = await import('../../server/providers/adapters/anthropic.mjs');
  const { body, init } = buildRequest({ provider: { baseUrl: 'https://api.anthropic.com', authStyle: 'x-api-key' }, model: { id: 'claude-opus-5-5' }, apiKey: 'k', req: { messages: [{ role: 'user', content: 'x' }], maxTokens: 9000, temperature: 0.7, thinking: 'on' } });
  assert.deepEqual(body.thinking, { type: 'adaptive', display: 'summarized' });
  assert.deepEqual(body.output_config, { effort: 'high' });
  assert.equal(body.temperature, undefined);
  assert.equal(body.fallbacks, 'default');
  assert.equal(init.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  const relay = buildRequest({ provider: { baseUrl: 'https://relay.example.com', authStyle: 'bearer' }, model: { id: 'claude-opus-5-5' }, apiKey: 'k', req: { messages: [], maxTokens: 100 } });
  assert.equal(relay.body.fallbacks, undefined, 'beta fallbacks only on the official endpoint');
  assert.equal(relay.init.headers.authorization, 'Bearer k');
});

test('Gemini: x-goog-api-key header (never in URL), role mapping, thoughts and usage', async () => {
  mock.reset();
  const r = await ask(P.gemini.id, 'gemini-mock-pro', {
    messages: [{ role: 'user', content: '阶段：独立研究' }, { role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }, { role: 'user', content: 'c' }],
  });
  const req = mock.stats.requests.at(-1);
  assert.equal(req.headers['x-goog-api-key'], MOCK_KEYS.gemini);
  assert.deepEqual(req.body.contents.map((x) => x.role), ['user', 'model', 'user'], 'consecutive user turns merged');
  assert.ok(req.body.systemInstruction.parts[0].text.includes('研究员 A'));
  assert.equal(req.body.generationConfig.thinkingConfig.includeThoughts, true);
  assert.ok(r.thinking.includes('Analyzing'));
  assert.ok(r.usage.outputTokens > r.usage.reasoningTokens && r.usage.reasoningTokens === 5);
});

test('Ollama: native NDJSON, num_ctx and think repair', async () => {
  mock.reset();
  const r = await ask(P.ollama.id, 'qwen3:8b');
  assert.match(r.text, /stance/);
  const req = mock.stats.requests.at(-1);
  assert.equal(req.body.options.num_ctx, 16384);
  assert.equal(req.body.options.num_predict, 1024);
  const r2 = await ask(P.ollama.id, 'nothink-model', { thinking: 'on' });
  assert.equal(r2.repairs, 1, 'think dropped after "does not support thinking"');
  const prov = (await c.get('/api/providers')).data.providers.find((p) => p.id === P.ollama.id);
  assert.deepEqual(prov.learned['nothink-model'].drop, ['think']);
});

test('OpenAI reasoning models: the gateway learns max_completion_tokens and drops temperature', async () => {
  mock.reset();
  const r = await ask(P.openai.id, 'gpt-5-mock');
  assert.ok(r.repairs >= 1);
  const last = mock.stats.requests.at(-1).body;
  assert.equal(last.max_tokens, undefined);
  assert.equal(last.max_completion_tokens, 1024);
  assert.equal(last.temperature, undefined);
  // Learned once, reused afterwards with no extra round-trips.
  mock.reset();
  const again = await ask(P.openai.id, 'gpt-5-mock');
  assert.equal(again.repairs, 0);
  assert.equal(mock.stats.requests.length, 1);
});

test('relays that reject stream_options are adapted and usage is estimated', async () => {
  const r = await ask(P.openai.id, 'relay-nostreamopts');
  assert.equal(r.repairs, 1);
  assert.equal(r.usage.estimated, true);
  assert.ok(r.usage.outputTokens > 0);
});

test('429 with Retry-After is retried; 5xx exhausts retries; auth errors are not retried', async () => {
  const retries = [];
  const ok = await ask(P.anthropic.id, 'claude-flaky', { onRetry: (i) => retries.push(i) });
  assert.equal(ok.retries, 1);
  assert.equal(retries[0].error.kind, 'rate_limit');
  assert.ok(retries[0].delayMs >= 1000 && retries[0].delayMs <= 1000, 'Retry-After honoured');

  const t0 = Date.now();
  await assert.rejects(ask(P.gemini.id, 'gemini-broken', { maxRetries: 1 }), (e) => e.kind === 'server' && e.status === 500);
  assert.ok(Date.now() - t0 >= 400);

  mock.reset();
  await c.put(`/api/providers/${P.openai.id}`, { apiKey: 'sk-wrong-key-1234567890abcdef' });
  await assert.rejects(ask(P.openai.id, 'mock-gpt'), (e) => {
    assert.equal(e.kind, 'auth');
    assert.equal(e.retryable, false);
    assert.ok(!e.message.includes('sk-wrong-key-1234567890abcdef'), 'echoed key is redacted');
    assert.match(e.message, /REDACTED/);
    return true;
  });
  assert.equal(mock.stats.requests.length, 1, 'no retry on 401');
  await c.put(`/api/providers/${P.openai.id}`, { apiKey: MOCK_KEYS.openai });
});

test('Gemini invalid key (HTTP 400 API_KEY_INVALID) is classified as an auth error', async () => {
  await c.put(`/api/providers/${P.gemini.id}`, { apiKey: 'AIza-wrong' });
  await assert.rejects(ask(P.gemini.id, 'gemini-mock-pro'), (e) => e.kind === 'auth' && !e.retryable);
  await c.put(`/api/providers/${P.gemini.id}`, { apiKey: MOCK_KEYS.gemini });
});

test('a stream dropped mid-way is retried from scratch', async () => {
  const seen = [];
  const r = await ask(P.openai.id, 'mock-dropstream', { onRetry: (i) => seen.push(i) });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].discardedPartial, true);
  assert.match(r.text, /stance/);
});

test('budget reservations block calls before they are sent', async () => {
  mock.reset();
  const budget = new Budget({ limitUsd: 0.0001 });
  await assert.rejects(ask(P.anthropic.id, 'claude-mock-sonnet', { budget, maxTokens: 4000 }), (e) => e.kind === 'budget');
  assert.equal(mock.stats.requests.length, 0);
  const roomy = new Budget({ limitUsd: 1 });
  const r = await ask(P.anthropic.id, 'claude-mock-sonnet', { budget: roomy });
  assert.ok(Math.abs(roomy.spentUsd - r.costUsd) < 1e-12);
  assert.equal(roomy.reservedUsd, 0);
});

test('model catalogues for all four protocols', async () => {
  const ids = async (p) => (await c.get(`/api/providers/${p.id}/models`)).data.models.map((m) => m.id);
  assert.deepEqual(await ids(P.openai), ['mock-gpt', 'mock-reasoner', 'gpt-5-mock']);
  assert.deepEqual(await ids(P.anthropic), ['claude-mock-sonnet']);
  assert.deepEqual(await ids(P.gemini), ['gemini-mock-pro'], 'non-generative models filtered out');
  assert.deepEqual(await ids(P.ollama), ['qwen3:8b', 'llama3.1:8b']);
});

test('connection test endpoint reports latency and output', async () => {
  const r = await c.post(`/api/providers/${P.anthropic.id}/test`, { modelId: 'claude-mock-sonnet' });
  assert.equal(r.data.ok, true);
  assert.ok(r.data.latencyMs >= 0);
  const bad = await c.post(`/api/providers/${P.openai.id}/test`, { modelId: 'mock-broken' });
  assert.equal(bad.data.ok, false);
  assert.equal(bad.data.error.kind, 'server');
});

test('private-network endpoints are refused when the policy disallows them', async () => {
  lab.app.gateway.config.allowPrivateHosts = false;
  try {
    await assert.rejects(ask(P.ollama.id, 'qwen3:8b'), (e) => e.kind === 'policy');
  } finally {
    lab.app.gateway.config.allowPrivateHosts = true;
  }
});

test('API keys are encrypted at rest', async () => {
  const raw = await readFile(join(lab.dir, 'users', uid, 'providers.json'), 'utf8');
  for (const k of Object.values(MOCK_KEYS)) assert.ok(!raw.includes(k), 'plaintext key must not be on disk');
  assert.match(raw, /"keyBox"/);
});
