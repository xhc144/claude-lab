// Playback engine: decodes files into AudioBuffers, plays them sample-accurately and exposes a
// latency-compensated clock that the visuals follow. Also hosts live (system / mic) capture.

export class AudioEngine extends EventTarget {
  constructor() {
    super();
    this.ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'playback' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.fader = this.ctx.createGain();
    this.fader.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.buffer = null;
    this.source = null;
    this.playing = false;
    this.offset = 0; // track position when paused / at start of the current play
    this.startedAt = 0; // ctx time when playback (re)started
    this.volume = 0.8;
    this.muted = false;
    this.latencyOffset = 0; // user-adjustable A/V offset (seconds)
    this.live = null;
    this._endTimer = null;
  }

  get sampleRate() { return this.ctx.sampleRate; }
  get duration() { return this.buffer ? this.buffer.duration : 0; }

  // resume() can stay pending forever on machines without an audio endpoint; never block on it.
  async resume() {
    if (this.ctx.state === 'running') return;
    try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 1500))]); } catch { /* ignore */ }
  }

  async decode(arrayBuffer) {
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  setBuffer(buffer) {
    this.stop();
    this.buffer = buffer;
    this.offset = 0;
  }

  _startSource(at) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.fader);
    const now = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(now);
    this.fader.gain.setValueAtTime(0, now);
    this.fader.gain.linearRampToValueAtTime(1, now + 0.03);
    src.start(now, Math.max(0, Math.min(at, this.buffer.duration - 0.01)));
    this.source = src;
    this.startedAt = now;
    this.offset = at;
    src.onended = () => {
      if (this.source !== src) return;
      this.source = null;
      if (this.playing) {
        this.playing = false;
        this.offset = this.duration;
        this.dispatchEvent(new Event('ended'));
      }
    };
  }

  async play(at = null) {
    if (!this.buffer) return;
    await this.resume();
    if (this.playing) this._stopSource();
    let pos = at == null ? this.offset : at;
    if (pos >= this.duration - 0.05) pos = 0;
    this._startSource(pos);
    this.playing = true;
    this.dispatchEvent(new Event('state'));
  }

  _stopSource() {
    if (!this.source) return;
    const src = this.source;
    this.source = null;
    const now = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(now);
    this.fader.gain.setValueAtTime(this.fader.gain.value, now);
    this.fader.gain.linearRampToValueAtTime(0, now + 0.025);
    try { src.stop(now + 0.03); } catch { /* ignore */ }
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.position;
    this._stopSource();
    this.playing = false;
    this.dispatchEvent(new Event('state'));
  }

  stop() {
    this._stopSource();
    this.playing = false;
    this.offset = 0;
  }

  toggle() { return this.playing ? this.pause() : this.play(); }

  seek(t) {
    t = Math.max(0, Math.min(this.duration, t));
    if (this.playing) { this._stopSource(); this._startSource(t); }
    else this.offset = t;
    this.dispatchEvent(new Event('seek'));
  }

  // Audible playback position (seconds into the track).
  get position() {
    if (!this.playing) return this.offset;
    return Math.min(this.duration, this.offset + (this.ctx.currentTime - this.startedAt));
  }

  // Position of the sound currently reaching the speakers → what the visuals should show.
  get visualTime() {
    if (!this.playing) return this.offset + this.latencyOffset;
    const lat = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return Math.max(0, this.position - lat + this.latencyOffset);
  }

  setVolume(v) {
    this.volume = v;
    this.master.gain.setTargetAtTime(this.muted ? 0 : v * v, this.ctx.currentTime, 0.02);
  }

  setMuted(m) { this.muted = m; this.setVolume(this.volume); }

  // ---- live capture ---------------------------------------------------------------------------
  async startLive(kind) {
    this.stopLive();
    await this.resume();
    let stream;
    if (kind === 'system') {
      stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      stream.getVideoTracks().forEach((t) => t.stop());
      if (!stream.getAudioTracks().length) throw new Error('未获取到系统声音轨道');
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    }
    const src = this.ctx.createMediaStreamSource(stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    analyser.minDecibels = -120;
    analyser.maxDecibels = 0;
    src.connect(analyser);
    this.live = { kind, stream, src, analyser };
    stream.getAudioTracks()[0].addEventListener('ended', () => { this.stopLive(); this.dispatchEvent(new Event('live-ended')); });
    return this.live;
  }

  stopLive() {
    if (!this.live) return;
    try { this.live.src.disconnect(); } catch { /* ignore */ }
    this.live.stream.getTracks().forEach((t) => t.stop());
    this.live = null;
  }
}

// Mono mixdown for analysis.
export function mixdown(buffer) {
  const n = buffer.length, ch = buffer.numberOfChannels;
  const out = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i];
  }
  if (ch > 1) { const k = 1 / ch; for (let i = 0; i < n; i++) out[i] *= k; }
  return out;
}

let worker = null, jobId = 0;
const jobs = new Map();
export function analyzeBuffer(buffer, onProgress) {
  if (!worker) {
    worker = new Worker(new URL('./analysis.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = jobs.get(e.data.id);
      if (!job) return;
      if (e.data.progress != null) job.onProgress && job.onProgress(e.data.progress);
      else if (e.data.error) { jobs.delete(e.data.id); job.reject(new Error(e.data.error)); }
      else if (e.data.result) { jobs.delete(e.data.id); job.resolve(e.data.result); }
    };
    worker.onerror = (e) => { for (const j of jobs.values()) j.reject(new Error(e.message || 'worker error')); jobs.clear(); worker = null; };
  }
  const samples = mixdown(buffer);
  const id = ++jobId;
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, samples, sampleRate: buffer.sampleRate }, [samples.buffer]);
  });
}
