// FFmpeg argument builder for video/GIF/WebM/ProRes export with music + narration mixing.
import path from 'node:path';
import { screenSettings, normalizeClips, audioSegments } from '../../core/screen/index.js';

export const EXPORT_FORMATS = {
  mp4: { ext: 'mp4', label: 'MP4 (H.264)', video: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-tune', 'animation', '-movflags', '+faststart'], preset: { high: 'medium', standard: 'faster', small: 'medium' }, crf: { high: 16, standard: 19, small: 26 }, audio: ['-c:a', 'aac', '-b:a', '192k'] },
  webm: { ext: 'webm', label: 'WebM (VP9)', video: ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-row-mt', '1', '-b:v', '0', '-deadline', 'good', '-cpu-used', '3'], crf: { high: 24, standard: 31, small: 38 }, audio: ['-c:a', 'libopus', '-b:a', '160k'] },
  mov: { ext: 'mov', label: 'MOV (ProRes 422 HQ)', video: ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0'], crf: null, audio: ['-c:a', 'pcm_s16le'] },
  gif: { ext: 'gif', label: 'GIF 动图', video: null, crf: null, audio: null },
};

/**
 * @param o { out, format, width, height, fps, duration, quality, audio: [{file, start, volume, fadeIn, fadeOut, trim}] , gifWidth, gifFps }
 */
export function buildArgs(o) {
  const F = EXPORT_FORMATS[o.format] || EXPORT_FORMATS.mp4;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-stats_period', '0.5', '-progress', 'pipe:2'];
  args.push('-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${o.width}x${o.height}`, '-r', String(o.fps), '-i', 'pipe:0');
  if (o.format === 'gif') {
    const gw = o.gifWidth || Math.min(o.width, 960);
    const gf = o.gifFps || Math.min(o.fps, 15);
    args.push('-vf', `fps=${gf},scale=${gw}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', o.out);
    return args;
  }
  const audio = (o.audio || []).filter((a) => a && a.file);
  audio.forEach((a) => args.push('-i', a.file));
  args.push(...F.video);
  if (F.crf) args.push('-crf', String(F.crf[o.quality || 'standard'] ?? F.crf.standard));
  if (F.preset) args.push('-preset', F.preset[o.quality || 'standard'] || 'medium');
  if (o.format === 'mp4' && o.width % 2 + o.height % 2) args.push('-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2');
  if (audio.length) {
    const parts = audio.map((a, i) => `[${i + 1}:a]${audioFilter(a, o.duration)}[a${i}]`);
    const mix = audio.length > 1 ? `${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0:dropout_transition=0[aout]` : `[a0]anull[aout]`;
    args.push('-filter_complex', [...parts, mix].join(';'), '-map', '0:v', '-map', '[aout]', ...F.audio, '-t', String(o.duration));
  }
  args.push('-r', String(o.fps), o.out);
  return args;
}

/** atempo only takes 0.5–2 per stage: chain stages for other speeds. */
export function atempoChain(tempo) {
  let t = Math.max(0.25, Math.min(8, Number(tempo) || 1));
  if (Math.abs(t - 1) < 1e-4) return [];
  const out = [];
  while (t > 2) { out.push('atempo=2'); t /= 2; }
  while (t < 0.5) { out.push('atempo=0.5'); t /= 0.5; }
  out.push(`atempo=${+t.toFixed(6)}`);
  return out;
}

/** Filter chain of one audio input: trim, speed, volume, fades, placement. */
export function audioFilter(a, duration) {
  const f = [];
  if (a.trim) f.push(`atrim=${a.trim[0] || 0}${a.trim[1] != null ? ':' + a.trim[1] : ''}`, 'asetpts=PTS-STARTPTS');
  if (a.tempo) f.push(...atempoChain(a.tempo));
  f.push(`volume=${a.volume ?? 1}`);
  if (a.fadeIn) f.push(`afade=t=in:st=0:d=${a.fadeIn}`);
  if (a.start) f.push(`adelay=${Math.round(a.start * 1000)}|${Math.round(a.start * 1000)}`);
  if (a.fadeOut && a.loopToEnd !== false) f.push(`afade=t=out:st=${Math.max(0, duration - a.fadeOut)}:d=${a.fadeOut}`);
  return f.join(',');
}

/** Tracks of a range export starting at `offset`: earlier parts are trimmed, not slid to 0. */
export function shiftAudio(tracks, offset) {
  if (!offset) return tracks;
  return tracks.map((a) => {
    const start = (a.start || 0) - offset;
    if (start >= 0) return { ...a, start };
    const tempo = a.tempo || 1;
    const from = (a.trim?.[0] || 0) - start * tempo;
    const to = a.trim?.[1];
    if (to != null && from >= to) return null;
    return { ...a, start: 0, trim: [from, to ?? null], fadeIn: 0 };
  }).filter(Boolean);
}

/** Audio of screen-recording blocks laid along the output (mic and system sound, through the cuts). */
function screenAudio(doc, scenes, assetFile) {
  const out = [];
  (doc.scenes || []).forEach((s, i) => {
    if (s.hidden) return;
    const sc = scenes?.find((x) => x.id === s.id) || scenes?.[i];
    if (!sc) return;
    const end = sc.end ?? (sc.start + (sc.duration || 0));
    for (const b of s.blocks || []) {
      if (b.type !== 'screen' || b.hidden) continue;
      const settings = screenSettings(b);
      const D = Number(b.source?.duration) || 0;
      const clips = normalizeClips(b.clips, D);
      for (const [key, vol] of [['mic', settings.audio.mic], ['system', settings.audio.system]]) {
        const file = b[key] && assetFile(b[key]);
        if (!file || !(Number(vol) > 0)) continue;
        for (const seg of audioSegments(clips, file, { volume: Number(vol), offset: sc.start })) {
          if (seg.start >= end - 1e-3) continue;
          const room = (end - seg.start) * seg.tempo;
          if (seg.trim[1] - seg.trim[0] > room) seg.trim = [seg.trim[0], seg.trim[0] + room];
          out.push(seg);
        }
      }
    }
  });
  return out;
}

/** Collect audio tracks from a document (music + per-scene narration + screen recordings). */
export function audioTracks(doc, projectDir, scenes) {
  const tracks = [];
  const assetFile = (id) => { const a = doc.assets?.[id]; return a ? path.join(projectDir, a.file) : null; };
  const m = doc.audio?.music;
  if (m?.asset && assetFile(m.asset)) tracks.push({ file: assetFile(m.asset), start: m.start || 0, volume: m.volume ?? 0.7, fadeIn: m.fadeIn ?? 1, fadeOut: m.fadeOut ?? 2, trim: m.trim });
  (doc.scenes || []).forEach((s, i) => {
    const n = s.narration;
    const sc = scenes?.find((x) => x.id === s.id) || scenes?.[i];
    if (n?.asset && assetFile(n.asset) && sc) tracks.push({ file: assetFile(n.asset), start: sc.start + (n.delay ?? 0.3), volume: n.volume ?? 1, loopToEnd: false });
  });
  tracks.push(...screenAudio(doc, scenes, assetFile));
  return tracks;
}

/** Parse "-progress" output lines into {frame, outTimeMs}. */
export function parseProgress(chunk) {
  const out = {};
  for (const line of String(chunk).split(/\r?\n/)) {
    const [k, v] = line.split('=');
    if (k === 'frame') out.frame = Number(v);
    if (k === 'out_time_ms') out.outTimeMs = Number(v);
  }
  return out;
}
