// Audio loading, playback with speed control (pitch preserved), segment loop,
// waveform peaks and spectrogram computation.
const cache = new Map<string, Promise<{ blobUrl: string; buffer: AudioBuffer }>>();
let decodeCtx: AudioContext | null = null;

export function loadAudio(url: string): Promise<{ blobUrl: string; buffer: AudioBuffer }> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`无法读取音频（${res.status}）`);
      const ab = await res.arrayBuffer();
      const blobUrl = URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
      decodeCtx ??= new AudioContext();
      const buffer = await decodeCtx.decodeAudioData(ab.slice(0));
      return { blobUrl, buffer };
    })();
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

export function wavBlobUrl(samples: Float32Array, sampleRate: number): string {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < 4; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

type Listener = () => void;

/** One shared player: only one sound plays at a time across the app. */
class Player {
  readonly el: HTMLAudioElement;
  private stopAt: number | null = null;
  private loopRange: [number, number] | null = null;
  src = '';
  tag = '';
  private listeners = new Set<Listener>();
  private raf = 0;

  constructor() {
    this.el = new Audio();
    this.el.preservesPitch = true;
    const tick = () => {
      if (this.stopAt !== null && this.el.currentTime >= this.stopAt) {
        if (this.loopRange) this.el.currentTime = this.loopRange[0];
        else { this.el.pause(); this.stopAt = null; }
      }
      this.emit();
      if (!this.el.paused) this.raf = requestAnimationFrame(tick);
    };
    this.el.addEventListener('play', () => { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(tick); this.emit(); });
    this.el.addEventListener('pause', () => this.emit());
    this.el.addEventListener('ended', () => {
      if (this.loopRange) { this.el.currentTime = this.loopRange[0]; void this.el.play(); }
      this.emit();
    });
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  get playing() {
    return !this.el.paused;
  }

  get time() {
    return this.el.currentTime;
  }

  async play(src: string, opts: { tag?: string; start?: number; end?: number; rate?: number; loop?: boolean } = {}) {
    if (this.src !== src) {
      this.el.src = src;
      this.src = src;
      await new Promise<void>((res) => {
        const ok = () => { this.el.removeEventListener('loadedmetadata', ok); res(); };
        this.el.addEventListener('loadedmetadata', ok);
        this.el.load();
      });
    }
    this.tag = opts.tag ?? '';
    this.el.playbackRate = opts.rate ?? 1;
    const start = Math.max(0, opts.start ?? 0);
    this.el.currentTime = start;
    this.stopAt = opts.end !== undefined ? opts.end : null;
    this.loopRange = opts.loop ? [start, opts.end ?? this.el.duration] : null;
    if (opts.loop && opts.end === undefined) this.stopAt = this.el.duration;
    await this.el.play();
  }

  setRate(r: number) {
    this.el.playbackRate = r;
  }

  stop() {
    this.loopRange = null;
    this.stopAt = null;
    this.el.pause();
    this.tag = '';
    this.emit();
  }

  seek(t: number) {
    this.el.currentTime = t;
    this.emit();
  }
}

export const player = new Player();

export function peaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const d = buffer.getChannelData(0);
  const out = new Float32Array(buckets * 2);
  const step = d.length / buckets;
  for (let b = 0; b < buckets; b++) {
    let mn = 1;
    let mx = -1;
    const a = Math.floor(b * step);
    const e = Math.min(d.length, Math.floor((b + 1) * step));
    for (let i = a; i < e; i++) {
      const v = d[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    out[b * 2] = e > a ? mn : 0;
    out[b * 2 + 1] = e > a ? mx : 0;
  }
  return out;
}

/** Log-magnitude spectrogram (dB), frames × bins, up to `maxHz`. */
export function spectrogram(buffer: AudioBuffer, hopSec = 0.005, winSec = 0.025, maxHz = 8000): { data: Float32Array; frames: number; bins: number; hop: number; maxHz: number } {
  const x = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const hop = Math.max(1, Math.round(hopSec * sr));
  const win = Math.round(winSec * sr);
  let N = 1;
  while (N < win) N <<= 1;
  N <<= 1;
  const bins = Math.min(N / 2, Math.floor((maxHz / sr) * N));
  const frames = Math.max(1, Math.floor((x.length - win) / hop));
  const data = new Float32Array(frames * bins);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const w = new Float64Array(win);
  for (let i = 0; i < win; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
  for (let f = 0; f < frames; f++) {
    re.fill(0);
    im.fill(0);
    const o = f * hop;
    for (let i = 0; i < win; i++) {
      const v = x[o + i] - (o + i > 0 ? 0.95 * x[o + i - 1] : 0); // pre-emphasis shows formants/fricatives better
      re[i] = v * w[i];
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) data[f * bins + k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
  }
  return { data, frames, bins, hop: hop / sr, maxHz: (bins / N) * sr };
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}
