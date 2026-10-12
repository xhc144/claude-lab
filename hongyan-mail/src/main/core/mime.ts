// Lightweight MIME helpers used during header sync (full parsing uses mailparser).
import libmime from 'libmime';
import charsetLib from 'libmime/lib/charset';
import he from 'he';
import type { Address } from '../../shared/types';

export function decodeWords(s: string | undefined | null): string {
  if (!s) return '';
  try { return libmime.decodeWords(s); } catch { return s; }
}

/** Parses a raw header block (as returned by FETCH BODY[HEADER.FIELDS ...]). Keys are lower-case. */
export function parseHeaderBlock(buf: Buffer | string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!buf) return out;
  const text = (typeof buf === 'string' ? buf : buf.toString('binary')).replace(/\r?\n[ \t]+/g, ' ');
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    out[key] = out[key] ? `${out[key]} ${value}` : value;
  }
  return out;
}

export function normalizeAddress(a: { name?: string; address?: string } | undefined | null): Address | null {
  if (!a || !a.address) return null;
  return { name: decodeWords(a.name || '').replace(/^["']|["']$/g, '').trim(), address: a.address.trim().toLowerCase() };
}

export function normalizeAddresses(list: Array<{ name?: string; address?: string }> | undefined | null): Address[] {
  return (list || []).map(normalizeAddress).filter((x): x is Address => !!x);
}

const MSGID_RE = /<[^<>\s]+>/g;

export function cleanMessageId(id: string | undefined | null): string | null {
  if (!id) return null;
  const m = id.match(MSGID_RE);
  if (m) return m[0];
  const t = id.trim();
  return t ? `<${t.replace(/^<|>$/g, '')}>` : null;
}

export function parseReferences(s: string | undefined | null): string[] {
  if (!s) return [];
  return s.match(MSGID_RE) || [];
}

/** Subject with reply / forward prefixes removed, used for display grouping. */
export function baseSubject(subject: string): string {
  let s = subject.trim();
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/^\s*(re|fw|fwd|aw|wg|sv|vs|antw|tr|rif|r|回复|答复|转发|转寄)\s*(\[\d+\])?\s*[:：]\s*/i, '').trim();
  }
  return s;
}

// ---------- body structure ----------

export interface StructNode {
  part?: string;
  type: string;
  parameters?: Record<string, string>;
  encoding?: string;
  size?: number;
  disposition?: string;
  dispositionParameters?: Record<string, string>;
  childNodes?: StructNode[];
  id?: string;
}

export interface TextPartRef {
  part: string;
  type: 'text/plain' | 'text/html';
  charset: string;
  encoding: string;
  size: number;
}

function walk(node: StructNode, fn: (n: StructNode) => void) {
  fn(node);
  for (const c of node.childNodes || []) walk(c, fn);
}

/** Finds the best part to build a preview from: first text/plain, else first text/html (not attachments). */
export function findPreviewPart(root: StructNode | undefined): TextPartRef | null {
  if (!root) return null;
  let plain: TextPartRef | null = null;
  let html: TextPartRef | null = null;
  walk(root, (n) => {
    const type = (n.type || '').toLowerCase();
    if (n.disposition && n.disposition.toLowerCase() === 'attachment') return;
    if (type !== 'text/plain' && type !== 'text/html') return;
    const ref: TextPartRef = {
      part: n.part || '1',
      type: type as TextPartRef['type'],
      charset: n.parameters?.charset || 'utf-8',
      encoding: (n.encoding || '7bit').toLowerCase(),
      size: n.size || 0
    };
    if (type === 'text/plain' && !plain) plain = ref;
    if (type === 'text/html' && !html) html = ref;
  });
  return plain || html;
}

export function hasAttachments(root: StructNode | undefined): boolean {
  if (!root) return false;
  let found = false;
  walk(root, (n) => {
    const disp = (n.disposition || '').toLowerCase();
    const type = (n.type || '').toLowerCase();
    const filename = n.dispositionParameters?.filename || n.parameters?.name;
    if (disp === 'attachment') found = true;
    else if (filename && !type.startsWith('multipart/') && !(disp === 'inline' && type.startsWith('image/') && n.id)) {
      if (!type.startsWith('text/') || disp !== 'inline') found = true;
    } else if (type === 'application/pdf' || type === 'application/zip' || type === 'application/octet-stream') found = true;
  });
  return found;
}

export function encodePartPath(ref: TextPartRef): string {
  return JSON.stringify(ref);
}

export function decodePartRef(s: string | null | undefined): TextPartRef | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

// ---------- text extraction ----------

function decodeTransfer(buf: Buffer, encoding: string): Buffer {
  if (encoding === 'base64') {
    const clean = buf.toString('ascii').replace(/[^A-Za-z0-9+/]/g, '');
    return Buffer.from(clean.slice(0, clean.length - (clean.length % 4)), 'base64');
  }
  if (encoding === 'quoted-printable') {
    const s = buf.toString('binary').replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
        bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
        i += 2;
      } else bytes.push(s.charCodeAt(i) & 0xff);
    }
    return Buffer.from(bytes);
  }
  return buf;
}

export function decodeCharset(buf: Buffer, charset: string): string {
  try {
    return charsetLib.decode(buf, charset || 'utf-8');
  } catch {
    return buf.toString('utf8');
  }
}

export function htmlToText(html: string): string {
  return he.decode(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(head|style|script|title)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

/** Collapses whitespace and drops quoted reply lines for a short list preview. */
export function makeSnippet(text: string, max = 180): string {
  const lines = text
    .replace(/ /g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('>'));
  const out: string[] = [];
  for (const l of lines) {
    if (/^(on .{4,120} wrote:|在.{2,80}写道[:：]|-{2,}\s*(original message|原始邮件|forwarded message|转发的邮件)\s*-{2,})$/i.test(l)) break;
    out.push(l);
    if (out.join(' ').length > max * 1.5) break;
  }
  const s = out.join(' ').replace(/[ \t]+/g, ' ').replace(/[​-‍﻿͏]/g, '').trim();
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

export function snippetFromPart(buf: Buffer, ref: TextPartRef): string {
  // Partial fetches may cut a multi-byte character at the end: drop the broken tail.
  const decoded = decodeCharset(decodeTransfer(buf, ref.encoding), ref.charset).replace(/\uFFFD+$/, '');
  const text = ref.type === 'text/html' ? htmlToText(decoded) : decoded;
  return makeSnippet(text);
}

export function addressText(list: Address[]): string {
  return list.map((a) => `${a.name} ${a.address}`).join(' ');
}
