// Real-input FFT (size N, power of two) computed through an N/2 complex FFT.
// magnitudes(input) → Float32Array(N/2 + 1) of |X[k]|, after applying the window.

export class RealFFT {
  constructor(n) {
    if (n & (n - 1)) throw new Error('FFT size must be a power of two');
    this.n = n;
    const m = n >> 1;
    this.m = m;
    this.re = new Float64Array(m);
    this.im = new Float64Array(m);
    this.rev = new Uint32Array(m);
    const bits = Math.log2(m);
    for (let i = 0; i < m; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    // Twiddles for the m-point complex FFT and the final real split (N-point).
    this.cosM = new Float64Array(m >> 1);
    this.sinM = new Float64Array(m >> 1);
    for (let i = 0; i < m >> 1; i++) {
      this.cosM[i] = Math.cos((2 * Math.PI * i) / m);
      this.sinM[i] = -Math.sin((2 * Math.PI * i) / m);
    }
    this.cosN = new Float64Array(m + 1);
    this.sinN = new Float64Array(m + 1);
    for (let k = 0; k <= m; k++) {
      this.cosN[k] = Math.cos((2 * Math.PI * k) / n);
      this.sinN[k] = -Math.sin((2 * Math.PI * k) / n);
    }
    this.window = new Float32Array(n);
    for (let i = 0; i < n; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    this.out = new Float32Array(m + 1);
  }

  // samples: source array; start: index of first sample (may be negative / past end → zero padded)
  magnitudes(samples, start) {
    const { n, m, re, im, rev, window: w } = this;
    const len = samples.length;
    for (let k = 0; k < m; k++) {
      const i0 = start + 2 * k, i1 = i0 + 1;
      const a = i0 >= 0 && i0 < len ? samples[i0] * w[2 * k] : 0;
      const b = i1 >= 0 && i1 < len ? samples[i1] * w[2 * k + 1] : 0;
      const r = rev[k];
      re[r] = a;
      im[r] = b;
    }
    // iterative radix-2 complex FFT of size m
    for (let size = 2; size <= m; size <<= 1) {
      const half = size >> 1;
      const step = m / size;
      for (let i = 0; i < m; i += size) {
        for (let j = 0, t = 0; j < half; j++, t += step) {
          const wr = this.cosM[t], wi = this.sinM[t];
          const ia = i + j, ib = ia + half;
          const xr = re[ib] * wr - im[ib] * wi;
          const xi = re[ib] * wi + im[ib] * wr;
          re[ib] = re[ia] - xr; im[ib] = im[ia] - xi;
          re[ia] += xr; im[ia] += xi;
        }
      }
    }
    const out = this.out;
    for (let k = 0; k <= m; k++) {
      const k1 = k % m, k2 = (m - k) % m;
      const zr = re[k1], zi = im[k1];
      const cr = re[k2], ci = -im[k2];
      const fer = (zr + cr) * 0.5, fei = (zi + ci) * 0.5;
      const dr = (zr - cr) * 0.5, di = (zi - ci) * 0.5;
      const for_ = di, foi = -dr; // D / i
      const wr = this.cosN[k], wi = this.sinN[k];
      const xr = fer + for_ * wr - foi * wi;
      const xi = fei + for_ * wi + foi * wr;
      out[k] = Math.sqrt(xr * xr + xi * xi);
    }
    return out;
  }
}
