// Text helpers shared by the engine and the gateway.

/** Rough token estimate when a provider does not report usage. CJK ≈ 1 token/char, other text ≈ 4 chars/token. */
export function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  let cjk = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 0x3000 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7af) || (c >= 0xf900 && c <= 0xfaff)) cjk++;
  }
  const other = s.length - cjk;
  return Math.ceil(cjk * 1.0 + other / 3.6);
}

export function truncate(text, max, marker = ' […]') {
  if (!text) return '';
  const s = String(text);
  return s.length <= max ? s : s.slice(0, Math.max(0, max - marker.length)) + marker;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('aborted'));
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(signal.reason ?? new Error('aborted')); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
