// Media probing and FFmpeg discovery (Node only).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EXE = process.platform === 'win32' ? '.exe' : '';

function here() {
  try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return process.cwd(); }
}

/** Locate ffmpeg/ffprobe: env → config → bundled (packaged app / vendor) → PATH. */
export function findTool(name = 'ffmpeg', config = {}) {
  const cands = [];
  const envKey = name === 'ffmpeg' ? 'MOTIF_FFMPEG' : 'MOTIF_FFPROBE';
  if (process.env[envKey]) cands.push(process.env[envKey]);
  if (name === 'ffprobe' && process.env.MOTIF_FFMPEG) cands.push(path.join(path.dirname(process.env.MOTIF_FFMPEG), 'ffprobe' + EXE));
  const cfgPath = name === 'ffmpeg' ? config.ffmpegPath : config.ffprobePath || (config.ffmpegPath ? path.join(path.dirname(config.ffmpegPath), 'ffprobe' + EXE) : null);
  if (cfgPath) cands.push(cfgPath);
  if (process.resourcesPath) cands.push(path.join(process.resourcesPath, 'ffmpeg', name + EXE));
  const h = here();
  for (const up of ['..', '../..', '../../..']) cands.push(path.join(h, up, 'vendor', 'ffmpeg', name + EXE), path.join(h, up, 'resources', 'ffmpeg', name + EXE));
  for (const c of cands) if (c && fs.existsSync(c)) return c;
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/)[0].trim();
    if (out && fs.existsSync(out)) return out;
  } catch { /* not on PATH */ }
  return null;
}

function imageSize(buf) {
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  // GIF
  if (buf.slice(0, 3).toString() === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  // WebP
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    const f = buf.slice(12, 16).toString();
    if (f === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (f === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (f === 'VP8L') { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
  }
  // SVG
  const head = buf.slice(0, 2000).toString('utf8');
  if (/<svg/i.test(head)) {
    const vb = /viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/.exec(head);
    const w = /\bwidth="([\d.]+)/.exec(head), h = /\bheight="([\d.]+)/.exec(head);
    if (w && h) return { width: +w[1], height: +h[1] };
    if (vb) return { width: +vb[1], height: +vb[2] };
  }
  return {};
}

export async function probeMedia(file, kind) {
  try {
    if (kind === 'image') return imageSize(fs.readFileSync(file));
    if (kind === 'audio' || kind === 'video') {
      const probe = findTool('ffprobe');
      if (!probe) return {};
      const r = spawnSync(probe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8' });
      const j = JSON.parse(r.stdout || '{}');
      const v = (j.streams || []).find((s) => s.codec_type === 'video');
      const out = { duration: j.format?.duration ? +(+j.format.duration).toFixed(3) : undefined };
      if (v) { out.width = v.width; out.height = v.height; out.hasAudio = (j.streams || []).some((s) => s.codec_type === 'audio'); }
      return out;
    }
  } catch { /* best effort */ }
  return {};
}
