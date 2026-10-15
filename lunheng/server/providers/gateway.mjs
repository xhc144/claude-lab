// The model gateway: one entry point for every provider call. Handles protocol adapters, auth,
// URL policy, per-provider concurrency, timeouts, retries with backoff, request repair for
// vendor-specific parameter quirks, usage accounting and budget reservations.
import * as openai from './adapters/openai.mjs';
import * as anthropic from './adapters/anthropic.mjs';
import * as gemini from './adapters/gemini.mjs';
import * as ollama from './adapters/ollama.mjs';
import { ProviderError, classifyHttpError, fromNetworkError, redact } from './errors.mjs';
import { costUsd, projectCostUsd, hasPrice } from './pricing.mjs';
import { assertAllowedUrl, UrlPolicyError } from '../security/netguard.mjs';
import { Semaphore } from '../util/semaphore.mjs';
import { estimateTokens, sleep } from '../util/text.mjs';
import { log } from '../util/log.mjs';

export const ADAPTERS = { openai, anthropic, gemini, ollama };

const MAX_REPAIRS = 4;

export function backoffDelay(attempt, retryAfterMs = 0, { base = 1000, cap = 30_000 } = {}) {
  if (retryAfterMs > 0) return Math.min(retryAfterMs, 60_000);
  const exp = Math.min(cap, base * 2 ** attempt);
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

export class Gateway {
  constructor({ config, providers, fetchImpl }) {
    this.config = config;
    this.providers = providers;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.semaphores = new Map();
  }

  #semaphore(userId, provider) {
    const key = `${userId}:${provider.id}`;
    let s = this.semaphores.get(key);
    if (!s) { s = new Semaphore(provider.concurrency || 4); this.semaphores.set(key, s); }
    else s.setLimit(provider.concurrency || 4);
    return s;
  }

  async #resolve(userId, providerId, modelId) {
    const found = await this.providers.getForCall(userId, providerId);
    if (!found) throw new ProviderError({ kind: 'config', message: `服务商 ${providerId} 不存在或已删除`, retryable: false });
    const { provider, apiKey } = found;
    if (provider.enabled === false) throw new ProviderError({ kind: 'config', message: `服务商「${provider.name}」已停用`, retryable: false });
    const adapter = ADAPTERS[provider.kind];
    if (!adapter) throw new ProviderError({ kind: 'config', message: `不支持的协议 ${provider.kind}`, retryable: false });
    if (!apiKey && !['none'].includes(provider.authStyle) && provider.kind !== 'ollama') {
      throw new ProviderError({ kind: 'auth', message: `服务商「${provider.name}」尚未配置 API Key`, retryable: false });
    }
    const model = provider.models.find((m) => m.id === modelId) || { id: modelId, label: modelId, price: null };
    if (!modelId) throw new ProviderError({ kind: 'config', message: '模型 ID 为空', retryable: false });
    try {
      await assertAllowedUrl(provider.baseUrl, this.config);
    } catch (err) {
      if (err instanceof UrlPolicyError) throw new ProviderError({ kind: 'policy', message: err.message, retryable: false });
      throw err;
    }
    return { provider, apiKey, model, adapter };
  }

  /**
   * Stream one completion.
   * @param {object} p
   * @param {string} p.userId
   * @param {string} p.providerId
   * @param {string} p.modelId
   * @param {string} [p.system]
   * @param {{role:'user'|'assistant', content:string}[]} p.messages
   * @param {number} [p.maxTokens]
   * @param {number} [p.temperature]
   * @param {'auto'|'on'|'off'} [p.thinking]
   * @param {AbortSignal} [p.signal]
   * @param {(d:{type:'text'|'thinking', text:string})=>void} [p.onDelta]
   * @param {(info:object)=>void} [p.onRetry]
   * @param {{reserve:Function, settle:Function}} [p.budget]
   * @param {object} [p.rates]
   */
  async invoke(p) {
    const { provider, apiKey, model, adapter } = await this.#resolve(p.userId, p.providerId, p.modelId);
    const secrets = [apiKey, ...Object.values(provider.extraHeaders || {})].filter(Boolean);
    const maxRetries = Number.isFinite(p.maxRetries) ? p.maxRetries : provider.maxRetries ?? 3;
    const timeoutMs = provider.timeoutMs || 15 * 60_000;
    const idleTimeoutMs = provider.idleTimeoutMs || 5 * 60_000;
    const temperature = p.temperature == null ? null : clampTemp(p.temperature, provider.temperatureRange);
    const req = { system: p.system || '', messages: p.messages, maxTokens: p.maxTokens || 4096, temperature, thinking: p.thinking || 'auto' };

    const inputEstimate = estimateTokens(req.system) + p.messages.reduce((a, m) => a + estimateTokens(m.content) + 4, 0);
    const reservation = p.budget?.reserve({
      usd: projectCostUsd(model.price, inputEstimate, req.maxTokens, p.rates),
      tokens: inputEstimate + req.maxTokens,
      priced: hasPrice(model.price),
    });

    const sem = this.#semaphore(p.userId, provider);
    let release;
    try {
      release = await sem.acquire(p.signal);
    } catch (err) {
      p.budget?.settle(reservation, null);
      throw fromNetworkError(err, { aborted: true });
    }

    const started = Date.now();
    let learned = provider.learned?.[model.id] || {};
    let repairs = 0;
    let attempt = 0;
    try {
      for (;;) {
        const { url, init, body } = adapter.buildRequest({ provider, model, apiKey, req, learned });
        const ctl = new AbortController();
        let timedOut = false;
        const onAbort = () => ctl.abort(p.signal.reason);
        p.signal?.addEventListener('abort', onAbort, { once: true });
        const hardTimer = setTimeout(() => { timedOut = true; ctl.abort(new Error('timeout')); }, timeoutMs);
        let idleTimer = setTimeout(() => { timedOut = true; ctl.abort(new Error('idle timeout')); }, idleTimeoutMs);
        const touch = () => {
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => { timedOut = true; ctl.abort(new Error('idle timeout')); }, idleTimeoutMs);
        };
        let emitted = false;
        let firstTokenMs = 0;
        try {
          if (p.signal?.aborted) throw new ProviderError({ kind: 'aborted', retryable: false });
          let res;
          try {
            res = await this.fetch(url, { ...init, signal: ctl.signal });
          } catch (err) {
            throw fromNetworkError(err, { timedOut, aborted: p.signal?.aborted });
          }
          touch();
          if (!res.ok) {
            const raw = await res.text().catch(() => '');
            let payload = raw;
            try { payload = JSON.parse(raw); } catch { /* plain-text error */ }
            const err = classifyHttpError(res.status, payload, res.headers);
            err.message = redact(err.message, secrets);
            if (err.kind === 'bad_request' && repairs < MAX_REPAIRS) {
              const patch = adapter.repairFor(err.message, body, learned);
              if (patch) {
                repairs++;
                learned = patch;
                log.info(`gateway: adapting request for ${provider.name}/${model.id} after 400 (${err.message.slice(0, 120)})`);
                this.providers.saveLearned?.(p.userId, provider.id, model.id, learned).catch(() => {});
                continue;
              }
            }
            throw err;
          }
          const result = await adapter.parseStream(res, (d) => {
            touch();
            if (d.type === 'ping') return;
            if (!firstTokenMs) firstTokenMs = Date.now() - started;
            emitted = true;
            p.onDelta?.(d);
          });
          if (!result.text.trim()) {
            const msg = result.finishReason && /length|max_tokens|MAX_TOKENS/.test(result.finishReason)
              ? '输出长度上限被思考过程耗尽，请提高“单次输出上限”'
              : `模型返回了空内容${result.finishReason ? `（finish: ${result.finishReason}）` : ''}`;
            throw new ProviderError({ kind: 'empty', message: msg, retryable: attempt < 1 });
          }
          const estimated = !result.usage || (!result.usage.inputTokens && !result.usage.outputTokens);
          const usage = estimated
            ? { inputTokens: inputEstimate, outputTokens: estimateTokens(result.text) + estimateTokens(result.thinking), reasoningTokens: 0 }
            : result.usage;
          const cost = costUsd(model.price, usage, p.rates);
          p.budget?.settle(reservation, { usd: cost, tokens: usage.inputTokens + usage.outputTokens });
          return {
            text: result.text,
            thinking: result.thinking,
            usage: { ...usage, estimated },
            costUsd: cost,
            priced: hasPrice(model.price),
            finishReason: result.finishReason,
            servedModel: result.model || model.id,
            latencyMs: Date.now() - started,
            firstTokenMs,
            retries: attempt,
            repairs,
          };
        } catch (raw) {
          const err = raw instanceof ProviderError ? raw : fromNetworkError(raw, { timedOut, aborted: p.signal?.aborted });
          err.message = redact(err.message, secrets);
          if (p.signal?.aborted) throw new ProviderError({ kind: 'aborted', retryable: false });
          if (!err.retryable || attempt >= maxRetries) throw err;
          const delay = backoffDelay(attempt, err.retryAfterMs);
          attempt++;
          p.onRetry?.({ attempt, maxRetries, delayMs: delay, error: err.toJSON(), discardedPartial: emitted });
          await sleep(delay, p.signal).catch(() => { throw new ProviderError({ kind: 'aborted', retryable: false }); });
        } finally {
          clearTimeout(hardTimer);
          clearTimeout(idleTimer);
          p.signal?.removeEventListener('abort', onAbort);
        }
      }
    } catch (err) {
      p.budget?.settle(reservation, null);
      throw err;
    } finally {
      release();
    }
  }

  /** Fetch the provider's model catalogue. */
  async listModels(userId, providerId) {
    const found = await this.providers.getForCall(userId, providerId);
    if (!found) throw new ProviderError({ kind: 'config', message: '服务商不存在', retryable: false });
    const { provider, apiKey } = found;
    const adapter = ADAPTERS[provider.kind];
    try {
      await assertAllowedUrl(provider.baseUrl, this.config);
    } catch (err) {
      throw new ProviderError({ kind: 'policy', message: err.message, retryable: false });
    }
    const { url, init } = adapter.listModelsRequest({ provider, apiKey });
    const ctl = AbortSignal.timeout(20_000);
    let res;
    try {
      res = await this.fetch(url, { ...init, signal: ctl });
    } catch (err) {
      throw fromNetworkError(err, { timedOut: ctl.aborted });
    }
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch { /* handled below */ }
    if (!res.ok) {
      const err = classifyHttpError(res.status, json ?? raw, res.headers);
      err.message = redact(err.message, [apiKey]);
      throw err;
    }
    return adapter.parseModelList(json).slice(0, 500);
  }
}

function clampTemp(t, range = [0, 2]) {
  const [lo, hi] = range;
  return Math.min(hi, Math.max(lo, Number(t)));
}
