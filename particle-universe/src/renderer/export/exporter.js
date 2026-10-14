// Offline, frame-exact video export: every frame is simulated at a fixed time step from the
// pre-computed analysis, rendered at the target resolution, encoded with WebCodecs and muxed
// (MP4 H.264/AAC or WebM VP9/Opus) straight to disk.
import { Muxer as Mp4Muxer, StreamTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, StreamTarget as WebmTarget } from 'webm-muxer';
import { platform } from '../core/platform.js';
import { collectEvents, makeEvents, SceneScheduler } from '../core/scheduler.js';
import { createFrame } from '../audio/track.js';
import { sceneById } from '../scenes/index.js';
import { mulberry32 } from '../camera/director.js';
import { copyPose } from '../camera/camera.js';

export const RESOLUTIONS = [
  { id: '720p', label: '720p', w: 1280, h: 720 },
  { id: '1080p', label: '1080p', w: 1920, h: 1080 },
  { id: '1440p', label: '2K', w: 2560, h: 1440 },
  { id: '4k', label: '4K', w: 3840, h: 2160 },
  { id: 'vertical', label: '竖屏 9:16', w: 1080, h: 1920 },
  { id: 'square', label: '方形 1:1', w: 1440, h: 1440 }
];

const QUALITY = { standard: 0.6, high: 1, ultra: 1.7 };

export function bitrateFor(w, h, fps, quality) {
  const base = 26e6 * Math.pow((w * h) / (1920 * 1080), 0.85) * (fps / 60) ** 0.7;
  return Math.round(base * (QUALITY[quality] || 1));
}

function avcCodec(w, h, fps) {
  const mbs = Math.ceil(w / 16) * Math.ceil(h / 16), mbps = mbs * fps;
  const levels = [[0x28, 8192, 245760], [0x2a, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040], [0x34, 36864, 2073600], [0x3c, 139264, 4177920]];
  for (const [lv, maxFs, maxMbps] of levels) if (mbs <= maxFs && mbps <= maxMbps) return 'avc1.6400' + lv.toString(16).padStart(2, '0');
  return 'avc1.64003c';
}

function vp9Codec(w, h) {
  const px = w * h;
  const lv = px <= 1920 * 1088 ? '41' : px <= 2560 * 1440 ? '50' : '51';
  return `vp09.00.${lv}.08`;
}

async function supported(Enc, cfg) {
  try {
    const r = await Enc.isConfigSupported(cfg);
    return r.supported ? r.config : null;
  } catch { return null; }
}

// Find working encoder configurations for each container.
export async function probe(w, h, fps, bitrate) {
  const out = { mp4: null, webm: null, available: 'VideoEncoder' in window && 'AudioEncoder' in window };
  if (!out.available) return out;
  const base = { width: w, height: h, bitrate, framerate: fps, bitrateMode: 'variable' };
  let avc = null;
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) {
    avc = await supported(VideoEncoder, { ...base, codec: avcCodec(w, h, fps), hardwareAcceleration: hw, avc: { format: 'avc' } });
    if (avc) { avc.__hw = hw; break; }
  }
  const aac = await supported(AudioEncoder, { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 256000 });
  const opus = await supported(AudioEncoder, { codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
  if (avc && (aac || opus)) out.mp4 = { video: avc, vcodec: 'avc', audio: aac || opus, acodec: aac ? 'aac' : 'opus', label: `H.264 ${aac ? 'AAC' : 'Opus'}` };
  let vp9 = null;
  for (const hw of ['prefer-hardware', 'no-preference']) {
    vp9 = await supported(VideoEncoder, { ...base, codec: vp9Codec(w, h), hardwareAcceleration: hw });
    if (vp9) break;
  }
  if (!vp9) vp9 = await supported(VideoEncoder, { ...base, codec: 'vp8' });
  if (vp9 && opus) out.webm = { video: vp9, vcodec: vp9.codec.startsWith('vp8') ? 'V_VP8' : 'V_VP9', audio: opus, acodec: 'A_OPUS', label: vp9.codec.startsWith('vp8') ? 'VP8 Opus' : 'VP9 Opus' };
  if (!out.mp4 && vp9 && (aac || opus) && !vp9.codec.startsWith('vp8')) {
    out.mp4 = { video: vp9, vcodec: 'vp9', audio: aac || opus, acodec: aac ? 'aac' : 'opus', label: `VP9 ${aac ? 'AAC' : 'Opus'}` };
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Exporter {
  constructor(app) {
    this.app = app;
    this.cancelled = false;
    this.running = false;
  }

  cancel() { this.cancelled = true; }

  // opts: { w, h, fps, quality, format: 'mp4'|'webm', start, end, tier, name, preview(canvas2d), onProgress }
  async run(opts) {
    const app = this.app, engine = app.engine;
    const track = app.track;
    if (!track) throw new Error('没有可导出的曲目');
    const { w, h, fps } = opts;
    const bitrate = bitrateFor(w, h, fps, opts.quality);
    const caps = await probe(w, h, fps, bitrate);
    const fmt = opts.format === 'webm' ? caps.webm : caps.mp4 || caps.webm;
    if (!fmt) throw new Error('当前系统不支持 WebCodecs 视频编码');
    const isWebm = fmt === caps.webm;
    const ext = isWebm ? 'webm' : 'mp4';
    const safe = (opts.name || 'particle-universe').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    const writer = await platform.videoWriter(`${safe}.${ext}`, ext);
    if (!writer) return { cancelled: true };

    this.running = true;
    this.cancelled = false;
    const buffer = track.buffer;
    const analysis = track.analysis;
    const sr = buffer.sampleRate;
    const channels = Math.min(2, buffer.numberOfChannels);
    const start = Math.max(0, opts.start || 0);
    const end = Math.min(buffer.duration, opts.end || buffer.duration);
    const total = Math.max(1, Math.round((end - start) * fps));

    let failure = null;
    const target = isWebm
      ? new WebmTarget({ onData: (d, p) => writer.write(d, p), chunked: true, chunkSize: 8 * 1024 * 1024 })
      : new Mp4Target({ onData: (d, p) => writer.write(d, p), chunked: true, chunkSize: 8 * 1024 * 1024 });
    const muxer = isWebm
      ? new WebmMuxer({ target, video: { codec: fmt.vcodec, width: w, height: h, frameRate: fps }, audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: channels }, firstTimestampBehavior: 'offset' })
      : new Mp4Muxer({ target, video: { codec: fmt.vcodec, width: w, height: h, frameRate: fps }, audio: { codec: fmt.acodec, sampleRate: 48000, numberOfChannels: channels }, fastStart: false, firstTimestampBehavior: 'offset' });

    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { failure = e; } });
    venc.configure({ ...fmt.video, width: w, height: h, bitrate, framerate: fps });
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { failure = e; } });
    aenc.configure({ ...fmt.audio, sampleRate: 48000, numberOfChannels: channels, bitrate: fmt.acodec === 'aac' ? 256000 : 192000 });

    // ---- take over the engine ----
    const saved = app.suspendForExport();
    const restore = () => app.resumeAfterExport(saved);
    const frame = createFrame();
    const ev = makeEvents();
    const rng = mulberry32(20241);
    const scheduler = new SceneScheduler(app.settings, rng);
    const director = app.director;
    let sceneId = opts.sceneId || saved.sceneId;
    let encodedAudio = Math.floor(start * sr);
    const s0 = Math.floor(start * sr), s1 = Math.floor(end * sr);
    const feedAudio = (untilSec) => {
      const until = Math.min(s1, Math.floor(untilSec * sr));
      while (encodedAudio < until) {
        const n = Math.min(4800, until - encodedAudio);
        const data = new Float32Array(n * channels);
        for (let c = 0; c < channels; c++) {
          const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)).subarray(encodedAudio, encodedAudio + n);
          data.set(src, c * n);
        }
        // short fades at the range edges to avoid clicks
        const fadeN = Math.round(sr * 0.012);
        for (let c = 0; c < channels; c++) {
          for (let i = 0; i < n; i++) {
            const gi = encodedAudio + i;
            const g = Math.min(1, (gi - s0) / fadeN, (s1 - gi) / fadeN);
            if (g < 1) data[c * n + i] *= Math.max(0, g);
          }
        }
        const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round(((encodedAudio - s0) / sr) * 1e6), data });
        aenc.encode(ad);
        ad.close();
        encodedAudio += n;
      }
    };

    const t0 = performance.now();
    try {
      engine.setOutputSize(w, h);
      engine.setRenderScale(1);
      if (opts.tier != null) engine.setTier(opts.tier, { morph: false });
      engine.rng = mulberry32(99);
      engine.start(sceneId, { intro: false });
      director.reset(7);
      director.setScene(sceneById(sceneId));
      const dt = 1 / fps;
      // pre-roll so the first frame shows a settled simulation
      analysis.sample(start, frame);
      for (let i = 0; i < Math.round(fps * 1.5); i++) {
        engine.simulate(dt, frame, makeEvents());
        copyPose(director.update(dt, frame, ev), app.pose);
      }
      engine.post.clearAccum();
      let lastT = start;
      let lastUi = 0;
      for (let k = 0; k < total; k++) {
        if (this.cancelled) break;
        if (failure) throw failure;
        const t = start + k / fps;
        analysis.sample(t, frame);
        collectEvents(analysis, lastT, t, ev);
        lastT = t;
        const next = scheduler.update(dt, { analysis, t, events: ev, frame, currentId: engine.scene.id, busy: !!engine.trans, playing: true });
        if (next) { engine.switchScene(next); scheduler.note(next); }
        const pose = app.exportPose(dt, frame, ev, director);
        copyPose(pose, app.pose);
        engine.frame(dt, frame, ev, pose);
        const vf = new VideoFrame(engine.canvas, { timestamp: Math.round((k * 1e6) / fps), duration: Math.round(1e6 / fps), alpha: 'discard' });
        venc.encode(vf, { keyFrame: k % (fps * 2) === 0 });
        vf.close();
        feedAudio(t + 1);
        while (venc.encodeQueueSize > 6 || aenc.encodeQueueSize > 24) { await sleep(1); if (failure) throw failure; }
        const now = performance.now();
        if (now - lastUi > 200 || k === total - 1) {
          lastUi = now;
          if (opts.preview) opts.preview(engine.canvas);
          const el = (now - t0) / 1000;
          const done = (k + 1) / total;
          opts.onProgress && opts.onProgress({ frame: k + 1, total, progress: done, elapsed: el, eta: done > 0.01 ? (el / done) * (1 - done) : null, speed: (k + 1) / fps / el, scene: engine.scene.name });
          platform.setProgress(done);
          await sleep(0);
        }
      }
      if (this.cancelled) {
        try { venc.close(); aenc.close(); } catch { /* ignore */ }
        await writer.abort();
        return { cancelled: true };
      }
      feedAudio(end + 1);
      await venc.flush();
      await aenc.flush();
      if (failure) throw failure;
      muxer.finalize();
      await writer.close();
      venc.close(); aenc.close();
      return { path: writer.path, format: fmt.label, ext, seconds: (performance.now() - t0) / 1000, frames: total, bitrate, w, h, fps };
    } catch (e) {
      try { venc.close(); aenc.close(); } catch { /* ignore */ }
      try { await writer.abort(); } catch { /* ignore */ }
      throw e;
    } finally {
      this.running = false;
      platform.setProgress(-1);
      restore();
    }
  }
}
