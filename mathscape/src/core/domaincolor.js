// Domain colouring (phase portraits) of complex functions, rendered into an RGBA buffer.
//
// Hue encodes arg f(z) on a perceptually uniform OKLCH wheel (arg 0 = red, 2π/3 ≈ green,
// 4π/3 ≈ blue). The "enhanced" style adds sawtooth shading on log₂|f| (modulus contours, one per
// doubling) and on 12 phase sectors, the classic Wegert enhanced phase portrait. Shading is faded
// out where contours become denser than a pixel, which removes moiré near zeros and poles.

const LUT_N = 1024;

function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const gammaEncode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** OKLCH → sRGB in [0, 1], reducing chroma until the colour fits the sRGB gamut. */
export function oklch(L, Cmax, hueDeg) {
  const h = (hueDeg * Math.PI) / 180;
  let lo = 0, hi = Cmax;
  const inGamut = (c) => oklabToLinearSrgb(L, c * Math.cos(h), c * Math.sin(h)).every((v) => v >= -1e-6 && v <= 1 + 1e-6);
  if (inGamut(Cmax)) lo = Cmax;
  else {
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (inGamut(mid)) lo = mid; else hi = mid;
    }
  }
  return oklabToLinearSrgb(L, lo * Math.cos(h), lo * Math.sin(h)).map((v) => gammaEncode(Math.min(1, Math.max(0, v))));
}

/** Hue wheel lookup table: 3 bytes per entry, entry k ↔ arg = 2πk/LUT_N. */
export const HUE_LUT = (() => {
  const lut = new Uint8Array(3 * LUT_N);
  for (let k = 0; k < LUT_N; k++) {
    const [r, g, b] = oklch(0.72, 0.19, 29 + (360 * k) / LUT_N);
    lut[3 * k] = Math.round(255 * r);
    lut[3 * k + 1] = Math.round(255 * g);
    lut[3 * k + 2] = Math.round(255 * b);
  }
  return lut;
})();

export const STYLES = ['enhanced', 'phase', 'checker'];

const INV_2PI = 1 / (2 * Math.PI);
const INV_LN2 = 1 / Math.LN2;

/**
 * Incremental renderer so a full-resolution image can be produced across several animation
 * frames without blocking input. Usage:
 *   const job = new DomainJob(W, H, { x0, y0, dx, dy, fn, ar, ai, style });
 *   while (!job.run(8)) { … next frame … }   // run(budgetMs) returns true when finished
 *   job.data  // Uint8ClampedArray RGBA
 * Pixel (i, j) samples z = (x0 + (i + ½)·dx, y0 − (j + ½)·dy): row 0 is the top of the view.
 */
export class DomainJob {
  constructor(W, H, { x0, y0, dx, dy, fn, ar = 0, ai = 0, style = 'enhanced', sectors = 12, checker = 0.5 }) {
    Object.assign(this, { W, H, x0, y0, dx, dy, fn, ar, ai, style, sectors, checker });
    this.data = new Uint8ClampedArray(4 * W * H);
    this.prevL = new Float32Array(W);
    this.prevP = new Float32Array(W);
    this.row = 0;
    this.out = new Float64Array(2);
  }

  get done() { return this.row >= this.H; }

  /** Render rows until `budgetMs` has elapsed (or `Infinity` to finish now). */
  run(budgetMs = Infinity) {
    const t0 = performance.now();
    while (this.row < this.H) {
      this.renderRow(this.row++);
      if ((this.row & 3) === 0 && performance.now() - t0 > budgetMs) break;
    }
    return this.done;
  }

  renderRow(j) {
    const { W, x0, dx, fn, ar, ai, style, sectors, out, data, prevL, prevP } = this;
    const y = this.y0 - (j + 0.5) * this.dy;
    const enhanced = style === 'enhanced';
    const checker = style === 'checker';
    const inv = 1 / this.checker;
    let lastL = 0, lastP = 0;
    for (let i = 0; i < W; i++) {
      const x = x0 + (i + 0.5) * dx;
      fn(x, y, ar, ai, out);
      const re = out[0], im = out[1];
      const p = 4 * (j * W + i);
      data[p + 3] = 255;
      if (!(Number.isFinite(re) && Number.isFinite(im))) {
        const v = Number.isNaN(re) || Number.isNaN(im) ? 128 : 245; // NaN grey, ∞ white
        data[p] = v; data[p + 1] = v; data[p + 2] = v;
        prevL[i] = lastL = 40; prevP[i] = lastP = 0;
        continue;
      }
      let u = Math.atan2(im, re) * INV_2PI;
      if (u < 0) u += 1;
      const k = 3 * Math.min(LUT_N - 1, (u * LUT_N) | 0);
      let shade = 1;
      if (enhanced) {
        const m2 = re * re + im * im;
        const L = m2 > 0 ? 0.5 * Math.log(m2) * INV_LN2 : -1074;
        const P = u * sectors;
        let fL = 0, fP = 0;
        if (i > 0) { fL = Math.abs(L - lastL); let d = Math.abs(P - lastP); if (d > sectors / 2) d = sectors - d; fP = d; }
        if (j > 0) {
          fL = Math.max(fL, Math.abs(L - prevL[i]));
          let d = Math.abs(P - prevP[i]); if (d > sectors / 2) d = sectors - d;
          fP = Math.max(fP, d);
        }
        const cL = Math.max(0, 1 - 1.6 * fL);
        const cP = Math.max(0, 1 - 1.6 * fP);
        const sL = L - Math.floor(L);
        const sP = P - Math.floor(P);
        // where contours are unresolved, blend towards the sawtooth's mean so tone stays even
        shade = (1 - 0.34 * (cL * (1 - sL) + (1 - cL) * 0.5)) * (1 - 0.2 * (cP * (1 - sP) + (1 - cP) * 0.5));
        prevL[i] = lastL = L;
        prevP[i] = lastP = P;
      } else if (checker) {
        const cx = Math.floor(re * inv), cy = Math.floor(im * inv);
        let c = ((cx + cy) & 1) === 0 ? 1 : 0.6;
        // anti-alias: fade to the mean where cells are smaller than ~2 pixels
        const L = re * inv, P = im * inv;
        let f = 0;
        if (i > 0) f = Math.max(Math.abs(L - lastL), Math.abs(P - lastP));
        if (j > 0) f = Math.max(f, Math.abs(L - prevL[i]), Math.abs(P - prevP[i]));
        const w = Math.min(1, Math.max(0, (f - 0.25) * 2));
        c = c * (1 - w) + 0.8 * w;
        shade = c;
        prevL[i] = lastL = L;
        prevP[i] = lastP = P;
      }
      data[p] = HUE_LUT[k] * shade;
      data[p + 1] = HUE_LUT[k + 1] * shade;
      data[p + 2] = HUE_LUT[k + 2] * shade;
    }
  }
}

/** Colour of a single value w (for legends / tests): [r, g, b] bytes, phase style. */
export function phaseColor(re, im) {
  let u = Math.atan2(im, re) * INV_2PI;
  if (u < 0) u += 1;
  const k = 3 * Math.min(LUT_N - 1, (u * LUT_N) | 0);
  return [HUE_LUT[k], HUE_LUT[k + 1], HUE_LUT[k + 2]];
}
