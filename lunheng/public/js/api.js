// JSON API client with CSRF header, plus the Server-Sent Events subscription.
let csrf = '';
const listeners = new Set();

export function setCsrf(t) { csrf = t || ''; }
export function onUnauthorized(fn) { listeners.add(fn); }

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
}

export async function api(method, path, body) {
  const headers = {};
  if (method !== 'GET') headers['x-csrf-token'] = csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (res.status === 401 && !path.startsWith('/api/auth/')) for (const fn of listeners) fn();
  if (!res.ok) throw new ApiError(res.status, data);
  if (data?.csrf) setCsrf(data.csrf);
  return data;
}

export const get = (p) => api('GET', p);
export const post = (p, b = {}) => api('POST', p, b);
export const put = (p, b = {}) => api('PUT', p, b);
export const del = (p) => api('DELETE', p);

const EVENTS = ['meta', 'ledger', 'contribution', 'call', 'call_retry', 'delta', 'feed', 'consensus', 'synthesis', 'report'];

/** Subscribe to a session's live events. Returns a close() function. */
export function subscribe(sessionId, handlers, onState) {
  const es = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
  for (const t of EVENTS) {
    es.addEventListener(t, (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      handlers[t]?.(data);
      handlers.any?.(t, data);
    });
  }
  es.onopen = () => onState?.('open');
  es.onerror = () => onState?.(es.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting');
  return () => es.close();
}
