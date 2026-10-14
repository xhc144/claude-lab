// Microphone capture through an AudioWorklet: raw PCM (no browser
// compression), pause/resume, live level and waveform for the UI.
const WORKLET = `
class Cap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('phonica-capture', Cap);
`;

export interface RecorderOptions {
  deviceId?: string;
  sampleRate?: number;
  onLevel?: (rms: number, peak: number) => void;
  onChunk?: (chunk: Float32Array) => void;
}

export class Recorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private paused = false;
  private opts: RecorderOptions;
  sampleRate = 48000;
  startedAt = 0;
  pausedTotal = 0;
  private pausedAt = 0;

  constructor(opts: RecorderOptions) {
    this.opts = opts;
  }

  static async devices(): Promise<MediaDeviceInfo[]> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === 'audioinput');
    } catch {
      return [];
    }
  }

  async start(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: this.opts.deviceId && this.opts.deviceId !== 'default' ? { exact: this.opts.deviceId } : undefined,
        channelCount: 1,
        // keep the raw signal: browser processing alters the acoustics being assessed
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === 'NotAllowedError') throw new Error('麦克风权限被拒绝。请在 Windows 设置 → 隐私和安全性 → 麦克风 中允许桌面应用访问麦克风。');
      if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new Error('没有找到可用的麦克风，请检查设备连接或在设置中选择其他输入设备。');
      throw new Error(`无法打开麦克风：${(e as Error).message}`);
    }
    this.ctx = new AudioContext({ sampleRate: this.opts.sampleRate ?? 48000, latencyHint: 'interactive' });
    this.sampleRate = this.ctx.sampleRate;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'phonica-capture', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
    this.node.port.onmessage = (e) => {
      const c = e.data as Float32Array;
      let s = 0;
      let pk = 0;
      for (let i = 0; i < c.length; i++) {
        s += c[i] * c[i];
        const a = Math.abs(c[i]);
        if (a > pk) pk = a;
      }
      this.opts.onLevel?.(Math.sqrt(s / c.length), pk);
      if (this.paused) return;
      this.chunks.push(c);
      this.opts.onChunk?.(c);
    };
    src.connect(this.node);
    this.chunks = [];
    this.startedAt = performance.now();
    this.pausedTotal = 0;
    this.paused = false;
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.pausedTotal += performance.now() - this.pausedAt;
  }

  get isPaused() {
    return this.paused;
  }

  get duration(): number {
    return this.chunks.reduce((s, c) => s + c.length, 0) / this.sampleRate;
  }

  async stop(): Promise<{ samples: Float32Array; sampleRate: number }> {
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) { out.set(c, o); o += c.length; }
    this.cancel();
    return { samples: trimEdges(out, this.sampleRate), sampleRate: this.sampleRate };
  }

  cancel() {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => undefined);
    this.node = null;
    this.stream = null;
    this.ctx = null;
  }
}

/** Remove the click of the record button at the very start/end (first/last 40 ms fade). */
function trimEdges(x: Float32Array, sr: number): Float32Array {
  const f = Math.min(Math.round(0.04 * sr), x.length >> 2);
  for (let i = 0; i < f; i++) {
    const g = i / f;
    x[i] *= g;
    x[x.length - 1 - i] *= g;
  }
  return x;
}
