// In-place iterative radix-2 FFT on separate real/imaginary arrays (length a power of two).
export function makeFFT(n) {
  const levels = Math.log2(n);
  if (!Number.isInteger(levels)) throw new Error('FFT size must be a power of two');
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
  // inverse=false: X_k = Σ x_j e^{-2πijk/n};  inverse=true: x_j = (1/n) Σ X_k e^{+2πijk/n}
  return function fft(re, im, inverse = false, offset = 0, stride = 1) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const a = offset + i * stride, b = offset + j * stride;
        let t = re[a]; re[a] = re[b]; re[b] = t;
        t = im[a]; im[a] = im[b]; im[b] = t;
      }
    }
    const sgn = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = offset + (i + j) * stride, b = offset + (i + j + half) * stride;
          const wr = cos[k], wi = sgn * sin[k];
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { const a = offset + i * stride; re[a] /= n; im[a] /= n; }
  };
}
