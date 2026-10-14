import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../server/app.mjs';
import { createMockServer, MOCK_KEYS } from '../../tools/mock-providers.mjs';

export { MOCK_KEYS };

export async function listen(server) {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${server.address().port}`;
}

export async function startMock(opts = {}) {
  const mock = createMockServer({ delayMs: 0, ...opts });
  const url = await listen(mock.server);
  return { ...mock, url, close: () => new Promise((r) => mock.server.close(r)) };
}

export async function startApp(overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'lunheng-test-'));
  const app = await createApp({ dataDir: dir, allowPrivateHosts: true, signup: 'open', ...overrides });
  const url = await listen(app.server);
  return {
    app, url, dir,
    async close() { await app.close(); await rm(dir, { recursive: true, force: true }); },
  };
}

/** Minimal browser-like client: keeps the session cookie and sends the CSRF header. */
export class Client {
  constructor(base) { this.base = base; this.cookie = ''; this.csrf = ''; }
  async req(method, path, body, { raw = false } = {}) {
    const headers = { origin: this.base };
    if (this.cookie) headers.cookie = this.cookie;
    if (this.csrf) headers['x-csrf-token'] = this.csrf;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    if (raw) return res;
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    if (data && data.csrf) this.csrf = data.csrf;
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b = {}) { return this.req('POST', p, b); }
  put(p, b = {}) { return this.req('PUT', p, b); }
  del(p) { return this.req('DELETE', p); }
}

export async function waitFor(fn, { timeout = 20000, interval = 50 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, interval));
  }
}

/** Register a user and configure four providers against the mock (one per protocol). */
export async function setupLab(base, mockUrl, name = 'alice') {
  const c = new Client(base);
  const reg = await c.post('/api/auth/register', { username: name, password: 'correct horse battery' });
  if (reg.status !== 200) throw new Error(JSON.stringify(reg.data));
  const mk = async (body) => (await c.post('/api/providers', body)).data.provider;
  const openai = await mk({ presetId: 'custom-openai', name: 'Mock OpenAI', vendor: 'MockAI', baseUrl: `${mockUrl}/openai/v1`, apiKey: MOCK_KEYS.openai, models: [{ id: 'mock-gpt', price: { input: 1, output: 2, currency: 'USD' } }, { id: 'mock-reasoner', price: { input: 4, output: 16, currency: 'CNY' } }] });
  const anthropic = await mk({ presetId: 'custom-anthropic', name: 'Mock Anthropic', vendor: 'MockAnthropic', baseUrl: `${mockUrl}/anthropic`, apiKey: MOCK_KEYS.anthropic, models: [{ id: 'claude-mock-sonnet', price: { input: 3, output: 15, currency: 'USD' } }] });
  const gemini = await mk({ presetId: 'custom-gemini', name: 'Mock Gemini', vendor: 'MockGoogle', baseUrl: `${mockUrl}/gemini`, apiKey: MOCK_KEYS.gemini, models: [{ id: 'gemini-mock-pro', price: { input: 1.25, output: 10, currency: 'USD' } }] });
  const ollama = await mk({ presetId: 'ollama', baseUrl: `${mockUrl}/ollama`, models: [{ id: 'qwen3:8b' }] });
  return { c, providers: { openai, anthropic, gemini, ollama } };
}

export function eulerTeam(p) {
  return [
    { providerId: p.openai.id, modelId: 'mock-gpt', role: 'chair' },
    { providerId: p.anthropic.id, modelId: 'claude-mock-sonnet', role: 'prover' },
    { providerId: p.gemini.id, modelId: 'gemini-mock-pro', role: 'skeptic' },
    { providerId: p.ollama.id, modelId: 'qwen3:8b', role: 'experimentalist' },
    { providerId: p.openai.id, modelId: 'mock-reasoner', role: 'verifier' },
  ];
}
