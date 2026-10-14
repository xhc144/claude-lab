// Minimal PDF writer: one JPEG image per page (used for presentation handouts / PDF export).
// Pages are sized in points to the image aspect (width fixed at 960pt).

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7)) return { height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] };
    i += 2 + len;
  }
  throw new Error('not a JPEG');
}

/** @param pages Array<Uint8Array|Buffer> JPEG bytes. Returns Uint8Array. */
export function jpegsToPdf(pages, { title = 'Motif', pageWidth = 960 } = {}) {
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = [];
  const push = (data) => { const b = typeof data === 'string' ? enc.encode(data) : data; chunks.push(b); offset += b.length; };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const nObj = 2 + pages.length * 3 + 1;
  const pageIds = [];
  // object numbering: 1 catalog, 2 pages, then per page: page, image, content; last: info
  pages.forEach((_, i) => pageIds.push(3 + i * 3));
  const obj = (id, body) => { offsets[id] = offset; push(`${id} 0 obj\n`); if (typeof body === 'string') push(body); else body(); push('\nendobj\n'); };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach((jpg, i) => {
    const { width, height } = jpegSize(jpg);
    const pw = pageWidth, ph = Math.round((pageWidth * height) / width);
    const pid = 3 + i * 3, iid = pid + 1, cid = pid + 2;
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
    obj(iid, () => { push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
    obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const infoId = nObj;
  obj(infoId, `<< /Title (${title.replace(/[()\\]/g, '')}) /Producer (Motif) >>`);
  const xref = offset;
  push(`xref\n0 ${nObj + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= nObj; i++) push(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${nObj + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(offset);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
