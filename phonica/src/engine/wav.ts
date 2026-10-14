// Minimal WAV codec (PCM 16/24/32-bit int, 32-bit float) and resampling.

export interface DecodedAudio {
  sampleRate: number;
  channels: number;
  /** mono mixdown in [-1, 1] */
  samples: Float32Array;
}

export function decodeWav(buf: Uint8Array): DecodedAudio {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
  if (buf.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('不是有效的 WAV 文件');
  let off = 12;
  let fmt = 1;
  let channels = 1;
  let sampleRate = 16000;
  let bits = 16;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = tag(off);
    const size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      fmt = dv.getUint16(off + 8, true);
      channels = dv.getUint16(off + 10, true);
      sampleRate = dv.getUint32(off + 12, true);
      bits = dv.getUint16(off + 22, true);
      if (fmt === 0xfffe && size >= 40) fmt = dv.getUint16(off + 32, true); // WAVE_FORMAT_EXTENSIBLE
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = Math.min(size, buf.length - dataOff);
      break;
    }
    off += 8 + size + (size & 1);
  }
  if (dataOff < 0) throw new Error('WAV 文件缺少音频数据');
  const bytes = bits / 8;
  const n = Math.floor(dataLen / (bytes * channels));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const p = dataOff + (i * channels + c) * bytes;
      let v = 0;
      if (fmt === 3 && bits === 32) v = dv.getFloat32(p, true);
      else if (fmt === 3 && bits === 64) v = dv.getFloat64(p, true);
      else if (bits === 16) v = dv.getInt16(p, true) / 32768;
      else if (bits === 24) v = ((buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)) << 8 >> 8) / 8388608;
      else if (bits === 32) v = dv.getInt32(p, true) / 2147483648;
      else if (bits === 8) v = (buf[p] - 128) / 128;
      acc += v;
    }
    out[i] = acc / channels;
  }
  return { sampleRate, channels, samples: out };
}

export function encodeWav(samples: Float32Array, sampleRate: number, bits: 16 | 32 = 16): Uint8Array {
  const bytes = bits / 8;
  const buf = new Uint8Array(44 + samples.length * bytes);
  const dv = new DataView(buf.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < 4; i++) buf[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF');
  dv.setUint32(4, 36 + samples.length * bytes, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, bits === 32 ? 3 : 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * bytes, true);
  dv.setUint16(32, bytes, true);
  dv.setUint16(34, bits, true);
  w(36, 'data');
  dv.setUint32(40, samples.length * bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    if (bits === 32) dv.setFloat32(44 + i * 4, s, true);
    else dv.setInt16(44 + i * 2, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
  }
  return buf;
}

/** Band-limited resampling with a Kaiser-windowed sinc kernel (polyphase, cached phases). */
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x.slice();
  const ratio = to / from;
  const n = Math.floor(x.length * ratio);
  const out = new Float32Array(n);
  const cutoff = Math.min(1, ratio) * 0.94;
  const half = 24;
  const width = Math.ceil(half * Math.max(1, 1 / ratio));
  const beta = 8.6;
  const i0b = besselI0(beta);
  const PH = 1024;
  const cache = new Map<number, Float32Array>();
  const kernel = (ph: number): Float32Array => {
    let k = cache.get(ph);
    if (k) return k;
    k = new Float32Array(2 * width);
    const frac = ph / PH;
    let norm = 0;
    for (let j = 0; j < 2 * width; j++) {
      const dt = frac + (width - 1 - j); // t - k for k = c - width + 1 + j
      const d = dt * cutoff;
      const sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
      const r = dt / (width + 1);
      const win = Math.abs(r) >= 1 ? 0 : besselI0(beta * Math.sqrt(1 - r * r)) / i0b;
      k[j] = sinc * win;
      norm += k[j];
    }
    for (let j = 0; j < k.length; j++) k[j] /= norm;
    cache.set(ph, k);
    return k;
  };
  for (let i = 0; i < n; i++) {
    const t = i / ratio;
    let c = Math.floor(t);
    let ph = Math.round((t - c) * PH);
    if (ph === PH) { ph = 0; c += 1; }
    const k = kernel(ph);
    const base = c - width + 1;
    let acc = 0;
    if (base >= 0 && base + 2 * width <= x.length) {
      for (let j = 0; j < k.length; j++) acc += x[base + j] * k[j];
    } else {
      let norm = 0;
      for (let j = 0; j < k.length; j++) {
        const idx = base + j;
        if (idx < 0 || idx >= x.length) continue;
        acc += x[idx] * k[j];
        norm += k[j];
      }
      acc = norm ? acc / norm : 0;
    }
    out[i] = acc;
  }
  return out;
}

function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const q = (x * x) / 4;
  for (let k = 1; k < 30; k++) {
    term *= q / (k * k);
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}
