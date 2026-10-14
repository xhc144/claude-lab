// Per-user provider configuration. API keys and custom header values are stored encrypted (see vault.mjs)
// and are never included in anything this module returns to the HTTP layer.
import { join } from 'node:path';
import { readJson, writeJson } from '../util/json-store.mjs';
import { newId } from '../util/ids.mjs';
import { keyHint } from '../security/vault.mjs';
import { getPreset } from './presets.mjs';

const KINDS = ['openai', 'anthropic', 'gemini', 'ollama'];
const AUTH_STYLES = ['bearer', 'x-api-key', 'api-key', 'x-goog-api-key', 'zhipu-jwt', 'none'];
const THINKING_STYLES = ['openai', 'anthropic', 'gemini', 'qwen', 'zhipu', 'doubao', 'ollama', 'none'];
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'content-type', 'connection', 'transfer-encoding', 'cookie']);

export class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

const str = (v, max, name) => {
  if (v == null) return '';
  if (typeof v !== 'string') throw new ValidationError(`${name} 必须是字符串`);
  if (v.length > max) throw new ValidationError(`${name} 过长`);
  return v.trim();
};

function cleanJsonObject(v, name, maxBytes = 8192) {
  if (v == null || v === '') return {};
  let obj = v;
  if (typeof v === 'string') {
    try { obj = JSON.parse(v); } catch { throw new ValidationError(`${name} 不是合法 JSON`); }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) throw new ValidationError(`${name} 必须是 JSON 对象`);
  if (JSON.stringify(obj).length > maxBytes) throw new ValidationError(`${name} 过大`);
  return obj;
}

function cleanPrice(p) {
  if (!p) return null;
  const input = Number(p.input);
  const output = Number(p.output);
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return null;
  const currency = p.currency === 'CNY' ? 'CNY' : 'USD';
  return { input, output, currency };
}

function cleanModels(models) {
  if (!Array.isArray(models)) return [];
  if (models.length > 300) throw new ValidationError('模型数量过多');
  const seen = new Set();
  const out = [];
  for (const m of models) {
    const id = str(m?.id, 200, '模型 ID');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: str(m.label, 120, '模型名称') || id,
      price: cleanPrice(m.price),
      contextWindow: Number.isFinite(+m.contextWindow) && +m.contextWindow > 0 ? Math.round(+m.contextWindow) : undefined,
      reasoning: !!m.reasoning,
      extraBody: cleanJsonObject(m.extraBody, `模型 ${id} 的附加参数`),
    });
  }
  return out;
}

function cleanHeaders(h) {
  const obj = cleanJsonObject(h, '自定义请求头', 4096);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const name = String(k).trim();
    if (!/^[A-Za-z0-9-]{1,64}$/.test(name)) throw new ValidationError(`请求头名称无效：${name}`);
    if (FORBIDDEN_HEADERS.has(name.toLowerCase())) throw new ValidationError(`不允许覆盖请求头 ${name}`);
    out[name] = String(v).slice(0, 2048);
  }
  return out;
}

function cleanBaseUrl(u) {
  const s = str(u, 500, 'Base URL').replace(/\/+$/, '');
  if (!s) throw new ValidationError('Base URL 不能为空');
  let url;
  try { url = new URL(s); } catch { throw new ValidationError('Base URL 格式无效'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ValidationError('Base URL 必须以 http:// 或 https:// 开头');
  if (url.username || url.password) throw new ValidationError('Base URL 不能包含账号密码');
  return s;
}

export class ProviderStore {
  constructor({ dataDir, vault }) {
    this.dataDir = dataDir;
    this.vault = vault;
    this.cache = new Map();
  }

  #file(userId) { return join(this.dataDir, 'users', userId, 'providers.json'); }

  async #load(userId) {
    if (this.cache.has(userId)) return this.cache.get(userId);
    const data = (await readJson(this.#file(userId), null)) || { providers: [] };
    this.cache.set(userId, data);
    return data;
  }

  async #save(userId) {
    await writeJson(this.#file(userId), this.cache.get(userId));
  }

  /** Strip secrets. This is the only shape that may cross the HTTP boundary. */
  toPublic(p) {
    return {
      id: p.id, presetId: p.presetId, name: p.name, kind: p.kind, vendor: p.vendor, baseUrl: p.baseUrl,
      authStyle: p.authStyle, thinkingStyle: p.thinkingStyle, streamUsage: p.streamUsage,
      hasKey: !!p.keyBox, keyHint: p.keyHint || '',
      headerNames: Object.keys(p.headerHints || {}), headerHints: p.headerHints || {},
      extraQuery: p.extraQuery || {}, concurrency: p.concurrency, timeoutMs: p.timeoutMs, idleTimeoutMs: p.idleTimeoutMs,
      maxRetries: p.maxRetries, enabled: p.enabled !== false, temperatureRange: p.temperatureRange,
      models: p.models, learned: p.learned || {}, lastTest: p.lastTest || null, createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
  }

  async list(userId) {
    const data = await this.#load(userId);
    return data.providers.map((p) => this.toPublic(p));
  }

  async get(userId, id) {
    const data = await this.#load(userId);
    const p = data.providers.find((x) => x.id === id);
    return p ? this.toPublic(p) : null;
  }

  /** Internal: provider record plus decrypted key, for the gateway only. */
  async getForCall(userId, id) {
    const data = await this.#load(userId);
    const p = data.providers.find((x) => x.id === id);
    if (!p) return null;
    const apiKey = p.keyBox ? this.vault.decrypt(userId, `provider:${p.id}:key`, p.keyBox) : '';
    const extraHeaders = p.headersBox ? JSON.parse(this.vault.decrypt(userId, `provider:${p.id}:headers`, p.headersBox)) : {};
    const preset = getPreset(p.presetId);
    return {
      provider: { ...p, extraHeaders, temperatureRange: p.temperatureRange || preset?.temperatureRange || [0, 2] },
      apiKey,
    };
  }

  async create(userId, input) {
    const data = await this.#load(userId);
    if (data.providers.length >= 50) throw new ValidationError('服务商数量已达上限');
    const preset = getPreset(input.presetId) || getPreset('custom-openai');
    const now = new Date().toISOString();
    const p = {
      id: newId('prv', 8),
      presetId: preset.id,
      vendor: preset.custom ? (str(input.vendor, 40, '厂商') || 'Custom') : preset.vendor,
      createdAt: now,
      updatedAt: now,
      learned: {},
    };
    this.#apply(userId, p, { ...defaultsFrom(preset), ...input }, preset, true);
    data.providers.push(p);
    await this.#save(userId);
    return this.toPublic(p);
  }

  async update(userId, id, patch) {
    const data = await this.#load(userId);
    const p = data.providers.find((x) => x.id === id);
    if (!p) return null;
    const preset = getPreset(p.presetId) || getPreset('custom-openai');
    this.#apply(userId, p, patch, preset, false);
    p.updatedAt = new Date().toISOString();
    await this.#save(userId);
    return this.toPublic(p);
  }

  #apply(userId, p, input, preset, creating) {
    const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
    if (creating || has('name')) p.name = str(input.name, 60, '名称') || preset.name;
    if (creating || has('baseUrl')) p.baseUrl = cleanBaseUrl(input.baseUrl);
    if (creating || has('kind')) {
      const kind = preset.custom ? input.kind || preset.kind : preset.kind;
      if (!KINDS.includes(kind)) throw new ValidationError('协议类型无效');
      p.kind = kind;
    }
    if (creating || has('authStyle')) {
      const style = input.authStyle || preset.authStyle;
      if (!AUTH_STYLES.includes(style)) throw new ValidationError('认证方式无效');
      p.authStyle = style;
    }
    if (creating || has('thinkingStyle')) {
      const style = input.thinkingStyle || preset.thinkingStyle;
      if (!THINKING_STYLES.includes(style)) throw new ValidationError('思考参数风格无效');
      p.thinkingStyle = style;
    }
    if (creating || has('streamUsage')) p.streamUsage = input.streamUsage !== false;
    if (creating || has('concurrency')) p.concurrency = clampInt(input.concurrency, 1, 32, 4);
    if (creating || has('timeoutMs')) p.timeoutMs = clampInt(input.timeoutMs, 10_000, 60 * 60_000, 15 * 60_000);
    if (creating || has('idleTimeoutMs')) p.idleTimeoutMs = clampInt(input.idleTimeoutMs, 10_000, 30 * 60_000, 5 * 60_000);
    if (creating || has('maxRetries')) p.maxRetries = clampInt(input.maxRetries, 0, 8, 3);
    if (creating || has('enabled')) p.enabled = input.enabled !== false;
    if (creating || has('extraQuery')) {
      const q = cleanJsonObject(input.extraQuery, '附加查询参数', 2048);
      p.extraQuery = Object.fromEntries(Object.entries(q).map(([k, v]) => [String(k), String(v)]));
    }
    if (creating || has('models')) p.models = cleanModels(input.models ?? preset.models);
    if (has('apiKey') && typeof input.apiKey === 'string' && input.apiKey.trim()) {
      const key = input.apiKey.trim();
      if (key.length > 4096) throw new ValidationError('API Key 过长');
      if (/\s/.test(key)) throw new ValidationError('API Key 不能包含空白字符');
      p.keyBox = this.vault.encrypt(userId, `provider:${p.id}:key`, key);
      p.keyHint = keyHint(key);
    }
    if (input.clearKey) { delete p.keyBox; p.keyHint = ''; }
    if (has('extraHeaders') && input.extraHeaders !== undefined && input.extraHeaders !== null) {
      const headers = cleanHeaders(input.extraHeaders);
      if (Object.keys(headers).length) {
        p.headersBox = this.vault.encrypt(userId, `provider:${p.id}:headers`, JSON.stringify(headers));
        p.headerHints = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, keyHint(v)]));
      } else {
        delete p.headersBox;
        p.headerHints = {};
      }
    }
  }

  async remove(userId, id) {
    const data = await this.#load(userId);
    const i = data.providers.findIndex((x) => x.id === id);
    if (i < 0) return false;
    data.providers.splice(i, 1);
    await this.#save(userId);
    return true;
  }

  async saveLearned(userId, id, modelId, learned) {
    const data = await this.#load(userId);
    const p = data.providers.find((x) => x.id === id);
    if (!p) return;
    p.learned = { ...(p.learned || {}), [modelId]: learned };
    await this.#save(userId);
  }

  async recordTest(userId, id, result) {
    const data = await this.#load(userId);
    const p = data.providers.find((x) => x.id === id);
    if (!p) return;
    p.lastTest = result;
    await this.#save(userId);
  }

  async removeUser(userId) {
    this.cache.delete(userId);
  }
}

function defaultsFrom(preset) {
  return {
    name: preset.name, baseUrl: preset.baseUrl, kind: preset.kind, authStyle: preset.authStyle, thinkingStyle: preset.thinkingStyle,
    streamUsage: preset.streamUsage, models: preset.models, concurrency: preset.kind === 'ollama' ? 1 : 4,
  };
}

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}
