// Weather layer: clouds are fractal noise advected by the prevailing winds (opposite directions in
// the trade-wind and westerly belts, so the sky visibly shears) and thickened where it rains. They
// fade out as the camera zooms in, and cast soft shadows offset towards the south-east.

import { makeNoise2D } from '../core/noise.js';
import { smoothstep, clamp } from '../core/util.js';

const RES = 2; // world cells per cloud texel

export class CloudLayer {
  constructor(world, makeCanvas) {
    this.w = world;
    this.cw = Math.ceil(world.W / RES);
    this.ch = Math.ceil(world.H / RES);
    this.canvas = makeCanvas(this.cw, this.ch);
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.cw, this.ch);
    this.shadow = makeCanvas(this.cw, this.ch);
    this.sctx = this.shadow.getContext('2d');
    this.simg = this.sctx.createImageData(this.cw, this.ch);
    this.noise = makeNoise2D(world.seed ^ 0x77);
    this.noise2 = makeNoise2D(world.seed ^ 0x99);
    this.t = 0;
    this.row = 0;
    this.offsets = new Float32Array(this.ch);
  }

  /** zonal wind speed at cloud row y (cells per unit time), smooth across bands */
  wind(y) {
    const a = Math.abs(((y + 0.5) / this.ch) * 2 - 1);
    return -Math.cos(a * Math.PI * 3) * 1.0;
  }

  update(dt, tps) {
    const speed = 0.6 + Math.min(6, tps * 0.15);
    this.t += dt * speed;
    for (let y = 0; y < this.ch; y++) this.offsets[y] += this.wind(y) * dt * speed * 0.9;
    // refresh a band of rows per frame (the whole sky every ~10 frames)
    const rows = Math.ceil(this.ch / 10);
    const d = this.img.data, sd = this.simg.data;
    const w = this.w;
    const n = this.noise, n2 = this.noise2;
    const tt = this.t * 0.012;
    for (let k = 0; k < rows; k++) {
      const y = this.row;
      this.row = (this.row + 1) % this.ch;
      const off = this.offsets[y];
      const wy = Math.min(w.H - 1, y * RES);
      for (let x = 0; x < this.cw; x++) {
        const fx = (x - off) * 0.035, fy = y * 0.05;
        let v = n(fx, fy + tt) * 0.55 + n(fx * 2.1 + 3.3, fy * 2.1 - tt * 1.7) * 0.3 + n2(fx * 4.3, fy * 4.3 + tt * 2) * 0.15;
        const c = wy * w.W + Math.min(w.W - 1, x * RES);
        const wet = w.rain[c];
        v += (wet - 0.45) * 0.55 + clamp(w.climate.dust * 0.4, 0, 0.5);
        const a = smoothstep(0.08, 0.6, v);
        const o = (y * this.cw + x) * 4;
        const dust = clamp(w.climate.dust, 0, 1);
        d[o] = 246 - dust * 80; d[o + 1] = 248 - dust * 90; d[o + 2] = 252 - dust * 100;
        d[o + 3] = a * 235;
        sd[o] = 10; sd[o + 1] = 14; sd[o + 2] = 30; sd[o + 3] = a * 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.sctx.putImageData(this.simg, 0, 0);
  }

  draw(ctx, cam, dt, tps, time) {
    this.update(dt, tps);
    const alpha = clamp(1.25 - cam.zoom / 14, 0.12, 0.8);
    if (alpha <= 0.01) return;
    const [x0, y0] = cam.toScreen(0, 0);
    const mw = this.w.W * cam.zoom, mh = this.w.H * cam.zoom;
    const sw = this.cw * RES * cam.zoom, sh = this.ch * RES * cam.zoom;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, mw, mh);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    // shadow
    ctx.globalAlpha = alpha * 0.3;
    ctx.drawImage(this.shadow, x0 + cam.zoom * 2.5, y0 + cam.zoom * 3, sw, sh);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.canvas, x0, y0, sw, sh);
    ctx.restore();
  }
}
