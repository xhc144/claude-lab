// Data overlays drawn over the terrain: political borders (always available, sharp at 4 px per
// cell), and smooth heat maps — temperature, rainfall, elevation, fertility, pollution, faiths,
// ideas, technological eras, dominant species, the reach of your worship.

import { clamp } from '../core/util.js';
import { BIOMES } from '../sim/constants.js';
import { ERAS, IDEA } from '../sim/civ/data.js';
import { tempAt } from '../sim/state.js';

const BS = 4; // border canvas pixels per cell

export const OVERLAYS = [
  { id: 'none', name: '地貌' },
  { id: 'political', name: '政治' },
  { id: 'religion', name: '宗教' },
  { id: 'ideas', name: '思潮' },
  { id: 'era', name: '时代' },
  { id: 'species', name: '物种' },
  { id: 'temp', name: '气温' },
  { id: 'rain', name: '降水' },
  { id: 'biome', name: '生物群系' },
  { id: 'elev', name: '高程' },
  { id: 'fert', name: '肥力' },
  { id: 'pollution', name: '污染' },
];

function eraRGB(e) {
  const c = ERAS[e].color;
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function hexRGB(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function ramp(t, stops) {
  t = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const TEMP_RAMP = [[40, 60, 160], [70, 140, 230], [120, 210, 230], [240, 240, 160], [250, 160, 60], [220, 50, 40]];
const RAIN_RAMP = [[150, 110, 60], [220, 200, 120], [140, 200, 120], [60, 160, 200], [30, 70, 180]];
const ELEV_RAMP = [[10, 30, 80], [40, 100, 170], [120, 190, 120], [200, 190, 110], [150, 110, 80], [250, 250, 250]];
const FERT_RAMP = [[120, 90, 60], [190, 170, 90], [90, 170, 70], [30, 110, 40]];
const POLL_RAMP = [[0, 0, 0], [140, 120, 70], [100, 80, 60], [60, 40, 30]];

export class OverlayRenderer {
  constructor(world, makeCanvas) {
    this.w = world;
    this.border = makeCanvas(world.W * BS, world.H * BS);
    this.bctx = this.border.getContext('2d');
    this.bimg = this.bctx.createImageData(world.W * BS, world.H * BS);
    this.heat = makeCanvas(world.W, world.H);
    this.hctx = this.heat.getContext('2d');
    this.himg = this.hctx.createImageData(world.W, world.H);
    this.borderVersion = -1;
    this.borderMode = null;
    this.heatMode = null;
    this.heatTime = 0;
    this.labels = [];
  }

  rebuildBorders(mode) {
    const w = this.w;
    const { W, H } = w;
    const data = this.bimg.data;
    data.fill(0);
    const fillA = mode === 'political' ? 110 : 34;
    const owner = w.owner;
    const BW = BS * W;
    const sums = new Map();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = y * W + x;
        const o = owner[c];
        if (o < 0) continue;
        const n = w.nations[o];
        const col = n.color;
        let s = sums.get(o);
        if (!s) { s = { x: 0, y: 0, n: 0 }; sums.set(o, s); }
        s.x += x; s.y += y; s.n++;
        const right = x + 1 < W ? owner[c + 1] : -2, left = x > 0 ? owner[c - 1] : -2;
        const down = y + 1 < H ? owner[c + W] : -2, up = y > 0 ? owner[c - W] : -2;
        for (let py = 0; py < BS; py++) {
          for (let px = 0; px < BS; px++) {
            const edge = (px === BS - 1 && right !== o) || (px === 0 && left !== o) || (py === BS - 1 && down !== o) || (py === 0 && up !== o);
            const inner = (px >= BS - 2 && right !== o) || (px <= 1 && left !== o) || (py >= BS - 2 && down !== o) || (py <= 1 && up !== o);
            const i = ((y * BS + py) * BW + x * BS + px) * 4;
            if (edge) { data[i] = col[0] * 0.55; data[i + 1] = col[1] * 0.55; data[i + 2] = col[2] * 0.55; data[i + 3] = 235; }
            else if (inner) { data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 200; }
            else { data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = fillA; }
          }
        }
      }
    }
    this.bctx.putImageData(this.bimg, 0, 0);
    // nation name labels at territory centroids
    this.labels = [];
    for (const [o, s] of sums) {
      if (s.n < 12) continue;
      this.labels.push({ id: o, x: s.x / s.n + 0.5, y: s.y / s.n + 0.5, cells: s.n });
    }
  }

  rebuildHeat(mode, game) {
    const w = this.w;
    const { W, H, N } = w;
    const d = this.himg.data;
    const cityCol = new Map();
    const colorOf = (rgb, a) => [rgb[0], rgb[1], rgb[2], a];
    let densities = null, domSp = null;
    if (mode === 'species') {
      // dominant species per 3×3 block
      const L = w.life;
      const BW = Math.ceil(W / 3), BH = Math.ceil(H / 3);
      const counts = new Map();
      for (let i = 0; i < L.hi; i++) {
        if (!L.alive[i]) continue;
        const b = ((L.y[i] / 3) | 0) * BW + ((L.x[i] / 3) | 0);
        let m = counts.get(b);
        if (!m) { m = new Map(); counts.set(b, m); }
        m.set(L.sp[i], (m.get(L.sp[i]) || 0) + 1);
      }
      domSp = new Int32Array(BW * BH).fill(-1);
      densities = new Float32Array(BW * BH);
      for (const [b, m] of counts) {
        let best = -1, bv = 0, tot = 0;
        for (const [s, v] of m) { tot += v; if (v > bv) { bv = v; best = s; } }
        domSp[b] = best;
        densities[b] = tot;
      }
      this._spBW = BW;
    }
    for (let c = 0; c < N; c++) {
      const x = c % W, y = (c / W) | 0;
      let col = null;
      const land = w.elev[c] >= w.seaLevel;
      switch (mode) {
        case 'temp': col = colorOf(ramp((tempAt(w, c) + 30) / 70, TEMP_RAMP), 170); break;
        case 'rain': col = land ? colorOf(ramp(w.rain[c], RAIN_RAMP), 170) : null; break;
        case 'elev': col = colorOf(ramp((w.elev[c] - w.seaLevel + 0.5) / 1.3, ELEV_RAMP), 190); break;
        case 'fert': col = land ? colorOf(ramp(w.fert[c], FERT_RAMP), 170) : null; break;
        case 'pollution': col = w.pollution[c] > 0.02 || w.rad[c] > 0.02 ? (w.rad[c] > w.pollution[c] ? [140, 255, 90, clamp(w.rad[c] * 400, 40, 220)] : colorOf(ramp(w.pollution[c] * 2, POLL_RAMP), clamp(w.pollution[c] * 500, 30, 220))) : null; break;
        case 'biome': col = colorOf(BIOMES[w.biome[c]].color, 210); break;
        case 'religion': case 'ideas': case 'era': {
          const ci = w.ownerCity[c];
          if (ci < 0) break;
          let cc = cityCol.get(ci);
          if (cc === undefined) {
            const city = w.cities[ci];
            cc = null;
            if (mode === 'religion') {
              let best = null, bv = 0.05;
              for (const rid in city.religion) if (city.religion[rid] > bv) { bv = city.religion[rid]; best = w.religions[rid]; }
              if (best) cc = [best.color[0], best.color[1], best.color[2], 90 + bv * 120];
            } else if (mode === 'ideas') {
              let best = null, bv = 0.1;
              for (const id in city.ideas) if (city.ideas[id] > bv) { bv = city.ideas[id]; best = IDEA[id]; }
              if (best) { const rgb = hexRGB(best.color); cc = [rgb[0], rgb[1], rgb[2], 80 + bv * 140]; }
            } else {
              const e = w.nations[city.nation].era;
              cc = [...eraRGB(e), 170];
            }
            cityCol.set(ci, cc);
          }
          col = cc;
          break;
        }
        case 'species': {
          const b = ((y / 3) | 0) * this._spBW + ((x / 3) | 0);
          const s = domSp[b];
          if (s >= 0) { const sp = w.species[s]; col = [sp.color[0], sp.color[1], sp.color[2], clamp(60 + densities[b] * 25, 60, 230)]; }
          break;
        }
        default:
      }
      const o = c * 4;
      if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3]; } else d[o + 3] = 0;
    }
    this.hctx.putImageData(this.himg, 0, 0);
  }

  draw(ctx, cam, opts, game) {
    const w = this.w;
    const mode = opts.overlay;
    const [x0, y0] = cam.toScreen(0, 0);
    const mw = w.W * cam.zoom, mh = w.H * cam.zoom;
    const heatModes = ['temp', 'rain', 'elev', 'fert', 'pollution', 'biome', 'religion', 'ideas', 'era', 'species'];
    if (heatModes.includes(mode)) {
      this.heatTime -= 1;
      if (this.heatMode !== mode || this.heatTime <= 0) {
        this.rebuildHeat(mode, game);
        this.heatMode = mode;
        this.heatTime = 30;
      }
      ctx.imageSmoothingEnabled = mode !== 'religion' && mode !== 'ideas' && mode !== 'era' && mode !== 'biome';
      ctx.drawImage(this.heat, x0, y0, mw, mh);
      ctx.imageSmoothingEnabled = true;
    }
    const bmode = mode === 'political' ? 'political' : 'faint';
    if ((opts.borders || mode === 'political') && w.nations.length) {
      if (this.borderVersion !== w.territoryVersion || this.borderMode !== bmode) {
        this.rebuildBorders(bmode);
        this.borderVersion = w.territoryVersion;
        this.borderMode = bmode;
      }
      ctx.save();
      ctx.globalAlpha = mode === 'none' || mode === 'political' ? 1 : 0.55;
      ctx.imageSmoothingEnabled = cam.zoom < BS;
      ctx.drawImage(this.border, x0, y0, mw, mh);
      ctx.restore();
    }
  }
}

