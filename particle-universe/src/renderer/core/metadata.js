// Minimal tag readers: ID3v2 (MP3), FLAC Vorbis comments / pictures, MP4 ilst atoms.

function decodeText(bytes, enc) {
  try {
    if (enc === 1 || enc === 2) {
      let le = enc === 1, off = 0;
      if (enc === 1 && bytes.length >= 2) {
        if (bytes[0] === 0xff && bytes[1] === 0xfe) { le = true; off = 2; } else if (bytes[0] === 0xfe && bytes[1] === 0xff) { le = false; off = 2; }
      }
      return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(bytes.subarray(off)).replace(/\0+$/g, '');
    }
    if (enc === 3) return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/g, '');
    // ISO-8859-1 in theory; Chinese files frequently store GBK here.
    const high = bytes.some((b) => b > 0x7f);
    if (high) {
      try {
        const u = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return u.replace(/\0+$/g, '');
      } catch { /* not utf-8 */ }
      const g = new TextDecoder('gbk').decode(bytes);
      if (!g.includes('�')) return g.replace(/\0+$/g, '');
    }
    return new TextDecoder('windows-1252').decode(bytes).replace(/\0+$/g, '');
  } catch {
    return '';
  }
}

const syncsafe = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];

function readID3(u8) {
  if (u8.length < 10 || u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return null;
  const ver = u8[3];
  const size = syncsafe(u8, 6);
  const end = Math.min(u8.length, 10 + size);
  let p = 10;
  if (u8[5] & 0x40 && ver >= 3) { const ext = ver === 4 ? syncsafe(u8, p) : (u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]; p += ver === 4 ? ext : ext + 4; }
  const out = {};
  const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
  while (p + hdr < end) {
    const id = String.fromCharCode(...u8.subarray(p, p + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    let fs;
    if (ver === 2) fs = (u8[p + 3] << 16) | (u8[p + 4] << 8) | u8[p + 5];
    else if (ver === 4) fs = syncsafe(u8, p + 4);
    else fs = ((u8[p + 4] << 24) | (u8[p + 5] << 16) | (u8[p + 6] << 8) | u8[p + 7]) >>> 0;
    const body = u8.subarray(p + hdr, Math.min(end, p + hdr + fs));
    p += hdr + fs;
    if (!fs || !body.length) continue;
    if (id === 'TIT2' || id === 'TT2') out.title = decodeText(body.subarray(1), body[0]);
    else if (id === 'TPE1' || id === 'TP1') out.artist = decodeText(body.subarray(1), body[0]);
    else if (id === 'TALB' || id === 'TAL') out.album = decodeText(body.subarray(1), body[0]);
    else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
      const enc = body[0];
      let q = 1, mime = 'image/jpeg';
      if (id === 'APIC') {
        let z = q; while (z < body.length && body[z] !== 0) z++;
        mime = String.fromCharCode(...body.subarray(q, z)) || mime;
        q = z + 1;
      } else {
        const fmt = String.fromCharCode(...body.subarray(1, 4));
        mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
        q = 4;
      }
      q += 1; // picture type
      if (enc === 1 || enc === 2) { while (q + 1 < body.length && !(body[q] === 0 && body[q + 1] === 0)) q += 2; q += 2; }
      else { while (q < body.length && body[q] !== 0) q++; q += 1; }
      if (q < body.length) out.cover = new Blob([body.slice(q)], { type: mime.includes('/') ? mime : 'image/' + mime.toLowerCase() });
    }
  }
  return out;
}

function readFLAC(u8) {
  if (u8.length < 8 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'fLaC') return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 4;
  const out = {};
  for (let guard = 0; guard < 64 && p + 4 <= u8.length; guard++) {
    const hdr = u8[p], type = hdr & 0x7f, last = hdr & 0x80;
    const len = (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3];
    const b = p + 4;
    if (type === 4 && b + len <= u8.length) {
      let q = b;
      const vlen = dv.getUint32(q, true); q += 4 + vlen;
      const n = dv.getUint32(q, true); q += 4;
      for (let i = 0; i < n && q + 4 <= b + len; i++) {
        const l = dv.getUint32(q, true); q += 4;
        const s = new TextDecoder().decode(u8.subarray(q, q + l)); q += l;
        const k = s.indexOf('=');
        if (k < 0) continue;
        const key = s.slice(0, k).toUpperCase(), val = s.slice(k + 1);
        if (key === 'TITLE') out.title = val; else if (key === 'ARTIST') out.artist = val; else if (key === 'ALBUM') out.album = val;
      }
    } else if (type === 6 && !out.cover && b + len <= u8.length) {
      let q = b + 4;
      const ml = dv.getUint32(q); q += 4;
      const mime = new TextDecoder().decode(u8.subarray(q, q + ml)); q += ml;
      const dl = dv.getUint32(q); q += 4 + dl + 16;
      const datalen = dv.getUint32(q); q += 4;
      out.cover = new Blob([u8.slice(q, q + datalen)], { type: mime || 'image/jpeg' });
    }
    p = b + len;
    if (last) break;
  }
  return out;
}

function readMP4(u8) {
  if (u8.length < 12 || String.fromCharCode(u8[4], u8[5], u8[6], u8[7]) !== 'ftyp') return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const out = {};
  const walk = (start, end, depth) => {
    let p = start;
    while (p + 8 <= end && depth < 8) {
      let size = dv.getUint32(p);
      const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      let hdr = 8;
      if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hdr = 16; }
      if (size < hdr || p + size > end) break;
      const b = p + hdr, e = p + size;
      if (type === 'moov' || type === 'udta' || type === 'ilst') walk(b, e, depth + 1);
      else if (type === 'meta') walk(b + 4, e, depth + 1);
      else if (depth >= 3 && (type === '©nam' || type === '©ART' || type === '©alb' || type === 'covr')) {
        if (b + 16 <= e && String.fromCharCode(u8[b + 4], u8[b + 5], u8[b + 6], u8[b + 7]) === 'data') {
          const dtype = dv.getUint32(b + 8) & 0xffffff;
          const payload = u8.subarray(b + 16, Math.min(e, b + dv.getUint32(b)));
          if (type === 'covr') out.cover = new Blob([payload.slice()], { type: dtype === 14 ? 'image/png' : 'image/jpeg' });
          else {
            const s = new TextDecoder().decode(payload);
            if (type === '©nam') out.title = s; else if (type === '©ART') out.artist = s; else out.album = s;
          }
        }
      }
      p = e;
    }
  };
  walk(0, u8.length, 0);
  return out;
}

export function readTags(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  try {
    return readID3(u8) || readFLAC(u8) || readMP4(u8) || {};
  } catch {
    return {};
  }
}

// "01. Artist - Title.mp3" → { artist, title }
export function nameFromFile(name) {
  let base = name.replace(/\.[^.]+$/, '').replace(/^\s*\d{1,3}[\s._-]+/, '').trim();
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(base);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { title: base };
}
