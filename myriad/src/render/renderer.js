// Frame composition: the void and its stars, the floating world-shard with its earthen underside,
// the terrain texture, data overlays, clouds, living things, cities and units, effects and the tool
// cursor. Everything except the terrain texture is drawn fresh every frame in screen space.

import { hash2 } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { TerrainRenderer, S } from './terrain.js';
import { Camera } from './camera.js';
import { OverlayRenderer } from './overlay.js';
import { CloudLayer } from './clouds.js';
import { FxLayer } from './fx.js';
import { drawCreatures, drawCivilization, drawMarkers } from './sprites.js';

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = new Camera();
    this.dpr = 1;
    this.world = null;
    this.time = 0;
    this.opts = { clouds: true, labels: true, creatures: true, overlay: 'none', daynight: false, borders: true };
    this.stars = null;
    this.brush = null; // {x, y, r, color}
    this.hover = null;
    this.selection = null;
    this.ticksPerSecond = 2;
  }

  setWorld(world) {
    this.world = world;
    this.terrain = new TerrainRenderer(world, makeCanvas);
    this.overlay = new OverlayRenderer(world, makeCanvas);
    this.clouds = new CloudLayer(world, makeCanvas);
    this.fx = new FxLayer(world);
    this.resize();
    this.cam.fit(world.W, world.H);
    // paint everything once up front so the first frame is complete
    this.terrain.update(1e9, 0);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.cam.setViewport(r.width, r.height);
    this.stars = null;
  }

  makeStars() {
    const w = this.canvas.width, h = this.canvas.height;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    grd.addColorStop(0, '#141a33');
    grd.addColorStop(0.55, '#0a0d1f');
    grd.addColorStop(1, '#04050c');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // faint nebula wisps
    for (let i = 0; i < 6; i++) {
      const x = hash2(i, 1, 5) * w, y = hash2(i, 2, 5) * h, r = (0.15 + hash2(i, 3, 5) * 0.3) * Math.max(w, h);
      const ng = g.createRadialGradient(x, y, 0, x, y, r);
      const hue = 200 + hash2(i, 4, 5) * 120;
      ng.addColorStop(0, `hsla(${hue},60%,40%,0.08)`);
      ng.addColorStop(1, 'hsla(0,0%,0%,0)');
      g.fillStyle = ng;
      g.fillRect(0, 0, w, h);
    }
    const n = Math.round((w * h) / 2600);
    for (let i = 0; i < n; i++) {
      const x = hash2(i, 7, 1) * w, y = hash2(i, 8, 1) * h;
      const b = hash2(i, 9, 1);
      const s = b > 0.985 ? 1.6 : b > 0.9 ? 1.1 : 0.7;
      g.fillStyle = `rgba(${200 + b * 55},${210 + b * 40},255,${0.25 + b * 0.6})`;
      g.fillRect(x, y, s * this.dpr, s * this.dpr);
    }
    this.stars = c;
  }

  /** draw one frame; dt in seconds */
  frame(dt, game) {
    const w = this.world;
    if (!w) return;
    this.time += dt;
    const ctx = this.ctx;
    const cam = this.cam;
    cam.update(dt, w.W, w.H);

    // smoothed seasons: at high speed the seasonal swing averages out instead of flickering
    const tps = this.ticksPerSecond;
    const target = tps <= 6 ? w.seasonSin : 0;
    this.terrain.seasonVis += (target - this.terrain.seasonVis) * Math.min(1, dt * 1.5);
    const autumnTarget = tps <= 6 && w.tick % 4 === 2 ? 1 : 0;
    this.terrain.autumn += (autumnTarget - this.terrain.autumn) * Math.min(1, dt * 1.5);
    this.terrain.update(10, tps > 0 ? 2 : 1);
    if (w.lava && this._lavaCheck++ % 6 === 0) this.refreshHot();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.stars) this.makeStars();
    ctx.drawImage(this.stars, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const z = cam.zoom;
    const [x0, y0] = cam.toScreen(0, 0);
    const mw = w.W * z, mh = w.H * z;

    // the shard's earthen underside and atmospheric halo
    this.drawShardBody(ctx, x0, y0, mw, mh, z);

    // terrain
    ctx.imageSmoothingEnabled = z < S * 0.999;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.terrain.canvas, x0, y0, mw, mh);
    ctx.imageSmoothingEnabled = true;

    // data overlay
    if (this.opts.overlay !== 'none' || this.opts.borders) this.overlay.draw(ctx, cam, this.opts, game);

    // view rectangle in world cells (for culling)
    const [vx0, vy0] = cam.toWorld(0, 0);
    const [vx1, vy1] = cam.toWorld(cam.vw, cam.vh);
    const view = { x0: vx0 - 2, y0: vy0 - 2, x1: vx1 + 2, y1: vy1 + 2, z };

    drawMarkers(ctx, this, view, game);
    if (this.opts.creatures) drawCreatures(ctx, this, view, game);
    drawCivilization(ctx, this, view, game);

    if (this.opts.clouds) this.clouds.draw(ctx, cam, dt, tps, this.time);
    this.fx.draw(ctx, this, dt, view);

    if (this.opts.daynight) this.drawNight(ctx, x0, y0, mw, mh);
    this.drawBrush(ctx);
  }

  /** chunks containing lava or fire need frequent repaints */
  refreshHot() {
    const w = this.world;
    for (let c = 0; c < w.N; c += 1) {
      if (w.lava[c] > 0) { const x = c % w.W, y = (c / w.W) | 0; this.terrain.markRect(x, y, x, y); }
    }
  }

  drawShardBody(ctx, x0, y0, mw, mh, z) {
    const thick = clamp(mh * 0.07, 6, 140);
    // halo
    ctx.save();
    ctx.shadowColor = 'rgba(110,160,255,0.35)';
    ctx.shadowBlur = Math.min(60, 10 + z * 3);
    ctx.fillStyle = '#10264a';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.restore();
    // underside: jagged layers of rock and soil hanging below the map
    const n = 64;
    const grd = ctx.createLinearGradient(0, y0 + mh, 0, y0 + mh + thick * 2.2);
    grd.addColorStop(0, '#5a4636');
    grd.addColorStop(0.3, '#3c2f27');
    grd.addColorStop(0.7, '#241c18');
    grd.addColorStop(1, 'rgba(20,16,14,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + mh);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const taper = Math.sin(Math.PI * t);
      const jag = 0.35 + 0.65 * hash2(i, 3, 77);
      ctx.lineTo(x0 + mw * t, y0 + mh + thick * (0.3 + 1.9 * taper * jag));
    }
    ctx.lineTo(x0 + mw, y0 + mh);
    ctx.closePath();
    ctx.fill();
    // strata lines
    ctx.strokeStyle = 'rgba(255,220,180,0.08)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + mh + thick * 0.18 * k);
      ctx.lineTo(x0 + mw, y0 + mh + thick * 0.18 * k);
      ctx.stroke();
    }
    // a lip of light along the rim
    ctx.strokeStyle = 'rgba(160,200,255,0.25)';
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, mw + 1, mh + 1);
  }

  drawNight(ctx, x0, y0, mw, mh) {
    // a soft terminator sweeps across the map; city lights are drawn by the civ layer
    const phase = (this.time * 0.05) % 1;
    const cx = x0 + mw * (phase * 1.6 - 0.3);
    const g = ctx.createLinearGradient(cx - mw * 0.25, 0, cx + mw * 0.25, 0);
    g.addColorStop(0, 'rgba(5,8,25,0)');
    g.addColorStop(0.5, 'rgba(5,8,25,0.55)');
    g.addColorStop(1, 'rgba(5,8,25,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, mw, mh);
    this.nightCenter = cx;
  }

  drawBrush(ctx) {
    const b = this.brush;
    if (!b) return;
    const [sx, sy] = this.cam.toScreen(b.x, b.y);
    const r = Math.max(3, b.r * this.cam.zoom);
    ctx.save();
    ctx.strokeStyle = b.color || 'rgba(255,240,200,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = b.color || '#fff0c8';
    ctx.fill();
    ctx.restore();
  }
}
