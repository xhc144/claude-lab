// Final step: subtitles (.srt) + mux the rendered picture with the mixed audio.
//   node scripts/finish.mjs en|zh [--crf 21]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lang = process.argv[2] || 'en';
const i = process.argv.indexOf('--crf');
const crf = i > 0 ? process.argv[i + 1] : '21';
const build = path.join(ROOT, 'build', lang);
const out = path.join(ROOT, 'output');
fs.mkdirSync(out, { recursive: true });

const timing = JSON.parse(fs.readFileSync(path.join(build, 'timing.json'), 'utf8'));
const stamp = (t) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const lines = timing.scenes.flatMap((s) => s.lines);
const srt = lines.map((l, k) => `${k + 1}\n${stamp(l.start)} --> ${stamp(l.end + 0.3)}\n${l.text}\n`).join('\n');
fs.writeFileSync(path.join(out, `fixed_point_${lang}.srt`), srt);

const target = path.join(out, `fixed_point_${lang}.mp4`);
const r = spawnSync('ffmpeg', ['-v', 'error', '-y',
  '-i', path.join(build, 'video.mp4'), '-i', path.join(build, 'mix.wav'),
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', crf, '-pix_fmt', 'yuv420p',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  '-movflags', '+faststart', '-shortest',
  '-metadata', `title=${lang === 'zh' ? '总有一点不动：布劳威尔不动点定理' : "The Point That Stays: Brouwer's Fixed Point Theorem"}`,
  target], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
console.log(`${target}  ${(fs.statSync(target).size / 1e6).toFixed(1)} MB`);
