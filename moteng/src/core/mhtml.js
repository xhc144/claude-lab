// Minimal MHTML (RFC 2557, multipart/related) reader for pages saved by
// Chrome / Edge as "网页，单个文件".

function decodeQuotedPrintable(text) {
  const soft = text.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < soft.length; i++) {
    const c = soft[i];
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(soft.substr(i + 1, 2))) {
      bytes.push(parseInt(soft.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(soft.charCodeAt(i) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function parseHeaders(block) {
  const headers = {};
  const unfolded = block.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2].trim();
  }
  return headers;
}

function decodeMimeWord(value) {
  return value.replace(/=\?([\w-]+)\?([BQ])\?([^?]*)\?=/gi, (_, cs, enc, data) => {
    try {
      const bytes = enc.toUpperCase() === 'B'
        ? Uint8Array.from(Buffer.from(data, 'base64'))
        : decodeQuotedPrintable(data.replace(/_/g, ' '));
      return new TextDecoder(cs).decode(bytes);
    } catch {
      return data;
    }
  });
}

export function parseMhtml(bytes) {
  // Headers and boundaries are ASCII; keep the body as latin1 so each char is one byte.
  const text = Buffer.from(bytes).toString('latin1');
  const split = text.search(/\r?\n\r?\n/);
  const top = parseHeaders(text.slice(0, split));
  const ctype = top['content-type'] || '';
  const bm = ctype.match(/boundary="?([^";]+)"?/i);
  const parts = new Map();
  let html = '';
  let url = top['snapshot-content-location'] || '';
  if (!bm) {
    return { html: '', parts, url, date: top.date ? new Date(top.date) : undefined };
  }
  const boundary = '--' + bm[1];
  const chunks = text.split(boundary).slice(1);
  for (const chunk of chunks) {
    if (chunk.startsWith('--')) break;
    const body = chunk.replace(/^\r?\n/, '');
    const hEnd = body.search(/\r?\n\r?\n/);
    if (hEnd < 0) continue;
    const h = parseHeaders(body.slice(0, hEnd));
    const raw = body.slice(hEnd).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '');
    const enc = (h['content-transfer-encoding'] || '').toLowerCase();
    let data;
    if (enc === 'base64') data = new Uint8Array(Buffer.from(raw.replace(/\s+/g, ''), 'base64'));
    else if (enc === 'quoted-printable') data = decodeQuotedPrintable(raw);
    else data = new Uint8Array(Buffer.from(raw, 'latin1'));
    const type = (h['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const cs = ((h['content-type'] || '').match(/charset="?([\w-]+)"?/i) || [])[1] || 'utf-8';
    const location = h['content-location'] || '';
    const id = (h['content-id'] || '').replace(/^<|>$/g, '');
    const part = { type, bytes: data, location, charset: cs };
    if (location) parts.set(location, part);
    if (id) parts.set('cid:' + id, part);
    if (!html && type === 'text/html') {
      try { html = new TextDecoder(cs.toLowerCase() === 'gb2312' ? 'gbk' : cs).decode(data); } catch { html = new TextDecoder().decode(data); }
      if (!url) url = location;
    }
  }
  return {
    html,
    parts,
    url,
    title: top.subject ? decodeMimeWord(top.subject) : '',
    date: top.date ? new Date(top.date) : undefined,
  };
}
