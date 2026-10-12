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
  }

  /** share of eastward flow at cloud row y (westerlies) vs westward (trade winds, polar easterlies) */
  eastShare(y) {
    const a = Math.abs(((y + 0.5) / this.ch) * 2 - 1);
    return 0.5 - 0.5 * Math.cos(a * Math.PI * 3);
  }

  update(dt, tps) {
    const speed = 0.5 + Math.min(5, tps * 0.12);
    this.t += dt * speed;
    // refresh a third of the sky per frame
    const rows = Math.ceil(this.ch / 3);
    const d = this.img.data, sd = this.simg.data;
    const w = this.w;
    const n = this.noise, n2 = this.noise2;
    const drift = this.t * 0.9;
    const tt = this.t * 0.01;
    const dust = clamp(w.climate.dust, 0, 1);
    for (let k = 0; k < rows; k++) {
      const y = this.row;
      this.row = (this.row + 1) % this.ch;
      const e = this.eastShare(y);
      const wy = Math.min(w.H - 1, y * RES);
      const fy = y * 0.045;
      for (let x = 0; x < this.cw; x++) {
        // two fields drifting in opposite directions, blended by latitude: no shear accumulates
        const fe = (x - drift) * 0.045, fw = (x + drift) * 0.045;
        const ve = n(fe, fy + tt) * 0.6 + n2(fe * 2.3, fy * 2.3 - tt) * 0.4;
        const vw = n(fw + 40, fy - tt) * 0.6 + n2(fw * 2.3 + 17, fy * 2.3 + tt) * 0.4;
        let v = ve * e + vw * (1 - e);
        const c = wy * w.W + Math.min(w.W - 1, x * RES);
        v += (w.rain[c] - 0.5) * 0.7 + dust * 0.4;
        const a = smoothstep(0.12, 0.62, v);
        const o = (y * this.cw + x) * 4;
        d[o] = 246 - dust * 80; d[o + 1] = 248 - dust * 90; d[o + 2] = 252 - dust * 100;
        d[o + 3] = a * 225;
        sd[o] = 10; sd[o + 1] = 14; sd[o + 2] = 30; sd[o + 3] = a * 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.sctx.putImageData(this.simg, 0, 0);
  }

  draw(ctx, cam, dt, tps, time) {
    this.update(dt, tps);
    const alpha = clamp(0.95 - cam.zoom / 16, 0.1, 0.6);
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
