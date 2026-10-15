// Wire-format readers for streaming responses: Server-Sent Events and newline-delimited JSON.

async function* chunks(body) {
  if (!body) return;
  if (typeof body.getReader === 'function') {
    const reader = body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      try { reader.releaseLock(); } catch { /* stream already closed */ }
    }
  } else {
    for await (const c of body) yield c;
  }
}

async function* lines(body) {
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of chunks(body)) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.search(/\r\n|\r|\n/)) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + (buf[i] === '\r' && buf[i + 1] === '\n' ? 2 : 1));
      yield line;
    }
  }
  buf += decoder.decode();
  if (buf) yield buf;
}

/**
 * Parse an SSE stream into {event, data, id} messages (spec: html.spec.whatwg.org/#event-stream-interpretation).
 * Comment lines (": keep-alive") are surfaced as {comment} so callers can treat them as liveness signals.
 */
export async function* readSSE(body) {
  let event = '';
  let data = [];
  let id = '';
  for await (const line of lines(body)) {
    if (line === '') {
      if (data.length) yield { event: event || 'message', data: data.join('\n'), id };
      event = '';
      data = [];
      continue;
    }
    if (line.startsWith(':')) { yield { comment: line.slice(1).trim() }; continue; }
    const c = line.indexOf(':');
    const field = c < 0 ? line : line.slice(0, c);
    let value = c < 0 ? '' : line.slice(c + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') data.push(value);
    else if (field === 'event') event = value;
    else if (field === 'id') id = value;
  }
  if (data.length) yield { event: event || 'message', data: data.join('\n'), id };
}

/** Parse NDJSON (Ollama native streaming). Yields parsed objects; malformed lines throw. */
export async function* readNDJSON(body) {
  for await (const line of lines(body)) {
    const s = line.trim();
    if (!s) continue;
    yield JSON.parse(s);
  }
}
