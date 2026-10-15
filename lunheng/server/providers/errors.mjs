// Normalized provider errors. `kind` drives retry decisions and the message shown in the console.

const KIND_TEXT = {
  auth: '认证失败：API Key 无效、过期或无权限',
  quota: '额度不足或账户欠费',
  rate_limit: '触发速率限制',
  bad_request: '请求参数被拒绝',
  not_found: '模型或接口不存在（检查模型 ID 与 Base URL）',
  server: '服务端错误',
  overloaded: '服务过载',
  network: '网络错误',
  timeout: '请求超时',
  aborted: '已取消',
  refusal: '模型拒绝回答',
  policy: '安全策略阻止',
  config: '配置错误',
  budget: '预算不足',
  empty: '模型返回空内容',
};

export class ProviderError extends Error {
  constructor({ kind, status = 0, message = '', retryable, retryAfterMs = 0, providerCode = '' }) {
    super(message || KIND_TEXT[kind] || kind);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = status;
    this.retryable = retryable ?? ['rate_limit', 'server', 'overloaded', 'network', 'timeout'].includes(kind);
    this.retryAfterMs = retryAfterMs;
    this.providerCode = providerCode;
  }
  get summary() {
    const head = KIND_TEXT[this.kind] || this.kind;
    const code = this.status ? ` (HTTP ${this.status})` : '';
    return this.message && this.message !== head ? `${head}${code}：${this.message}` : `${head}${code}`;
  }
  toJSON() {
    return { kind: this.kind, status: this.status, message: this.message, summary: this.summary, retryable: this.retryable };
  }
}

export function parseRetryAfter(headers) {
  const v = headers?.get?.('retry-after');
  if (!v) {
    const ms = headers?.get?.('retry-after-ms');
    return ms && Number.isFinite(+ms) ? +ms : 0;
  }
  if (/^\d+(\.\d+)?$/.test(v.trim())) return Math.round(parseFloat(v) * 1000);
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : 0;
}

/** Pull a human-readable message out of the many provider error envelopes. */
export function extractErrorMessage(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.slice(0, 600);
  const e = payload.error ?? payload;
  if (typeof e === 'string') return e.slice(0, 600);
  const msg = e.message || e.msg || e.detail || payload.message || payload.msg || payload.detail;
  const code = e.code || e.type || e.status || payload.code;
  const s = [msg, code && typeof code === 'string' && !String(msg || '').includes(code) ? `[${code}]` : '']
    .filter(Boolean).join(' ');
  return (s || JSON.stringify(payload)).slice(0, 600);
}

export function classifyHttpError(status, payload, headers) {
  const message = extractErrorMessage(payload);
  const text = `${message} ${JSON.stringify(payload ?? '')}`.toLowerCase();
  const retryAfterMs = parseRetryAfter(headers);
  let kind;
  if (status === 401 || status === 403) kind = /quota|balance|billing|insufficient|欠费|余额/.test(text) ? 'quota' : 'auth';
  else if (status === 402) kind = 'quota';
  else if (status === 404) kind = 'not_found';
  else if (status === 408) kind = 'timeout';
  else if (status === 429) {
    // Several providers reuse 429 for exhausted credit; those must not be retried.
    kind = /insufficient_quota|quota exceeded|exceeded your current quota|balance|billing|余额|欠费|arrearage/.test(text) ? 'quota' : 'rate_limit';
  } else if (status === 529 || /overloaded/.test(text)) kind = 'overloaded';
  else if (status >= 500) kind = 'server';
  else if (status === 400 && /api[_ ]?key[_ ]?invalid|invalid api key|api key not valid|incorrect api key|invalid_api_key|authentication/.test(text)) kind = 'auth';
  else kind = 'bad_request';
  return new ProviderError({ kind, status, message, retryAfterMs });
}

export function fromNetworkError(err, { timedOut = false, aborted = false } = {}) {
  if (err instanceof ProviderError) return err;
  if (aborted) return new ProviderError({ kind: 'aborted', message: '调用已取消', retryable: false });
  if (timedOut) return new ProviderError({ kind: 'timeout', message: err?.message || '' });
  const cause = err?.cause?.code || err?.code || '';
  const detail = [err?.cause?.message || err?.message, cause].filter(Boolean).join(' · ');
  return new ProviderError({ kind: 'network', message: detail });
}

/** Remove a secret (and common transforms of it) from text before it leaves the server. */
export function redact(text, secrets) {
  let s = String(text ?? '');
  for (const secret of secrets) {
    if (!secret || secret.length < 6) continue;
    s = s.split(secret).join('[REDACTED]');
    // Providers often echo a masked prefix/suffix such as "sk-abc*****wxyz"; drop the long tail fragments.
    if (secret.length > 12) {
      const tail = secret.slice(-8);
      s = s.split(tail).join('[REDACTED]');
    }
  }
  return s;
}
