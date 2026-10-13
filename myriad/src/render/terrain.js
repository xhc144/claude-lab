// The terrain picture. The world is painted into one offscreen canvas at S pixels per cell, in
// 16×16-cell chunks that are repainted when they change (plus a slow rolling refresh that lets
// seasons and growing forests show up everywhere). Every pixel bilinearly interpolates the cell
// fields, so coastlines, lake shores and colour transitions are smooth at sub-cell resolution;
// hill shading comes from the elevation gradient. Rivers and roads are rasterised as lines between
// jittered cell centres, and trees, fields, streets and ruins are stamped as tiny pixel glyphs.

import { hash2 } from '../core/rng.js';
import { clamp, smoothstep } from '../core/util.js';
import { B, IMP } from '../sim/constants.js';
import { RIVER_FLOW } from '../sim/hydro.js';
import { LAND, AUTUMN, SNOW, SEA_ICE, RIVER, LAKE, FARM_A, FARM_B, URBAN, ROAD, RAIL, HIGHWAY, waterColor } from './palette.js';

export const S = 4; // pixels per cell in the terrain texture
export const CH = 16; // chunk size in cells
const M = CH + 4; // local buffer: 2-cell margin on each side
const CP = CH * S; // chunk size in pixels

const TREE_DENSITY = new Float32Array(32);
TREE_DENSITY[B.FOREST] = 1; TREE_DENSITY[B.TAIGA] = 1.05; TREE_DENSITY[B.JUNGLE] = 1.35;
TREE_DENSITY[B.SAVANNA] = 0.22; TREE_DENSITY[B.GRASS] = 0.06; TREE_DENSITY[B.SWAMP] = 0.5;
TREE_DENSITY[B.SHRUB] = 0.16; TREE_DENSITY[B.TUNDRA] = 0.04; TREE_DENSITY[B.MOUNTAIN] = 0.12; TREE_DENSITY[B.BEACH] = 0.05;

export class TerrainRenderer {
  constructor(world, makeCanvas) {
    this.w = world;
    this.canvas = makeCanvas(world.W * S, world.H * S);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.cw = Math.ceil(world.W / CH);
    this.chh = Math.ceil(world.H / CH);
    this.nChunks = this.cw * this.chh;
    this.dirty = new Uint8Array(this.nChunks).fill(1);
    this.order = Array.from({ length: this.nChunks }, (_, i) => i);
    // shuffled rolling order → refreshes dissolve in rather than wiping across the map
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(hash2(i, 7, 99) * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    this.roll = 0;
    this.img = this.ctx.createImageData(CP, CP);
    this.lr = new Float32Array(M * M); this.lg = new Float32Array(M * M); this.lb = new Float32Array(M * M); // land colour
    this.wr = new Float32Array(M * M); this.wg = new Float32Array(M * M); this.wb = new Float32Array(M * M); // water colour
    this.he = new Float32Array(M * M); // height above sea
    this.hc = new Float32Array(M * M); // height squashed around sea level, for crisp coastlines
    this.sh = new Float32Array(M * M); // shade
    this.lk = new Float32Array(M * M); // lake mask
    this.lv = new Float32Array(M * M); // lava
    this.ic = new Float32Array(M * M); // ice cover on water
    this.seasonVis = 0; // smoothed seasonal phase used for snow / autumn
    this.autumn = 0;
    this.tmp = [0, 0, 0];
    this.lastTerrainVersion = -1;
  }

  markAll() { this.dirty.fill(1); }

  /** mark chunks overlapping the cell rectangle as dirty */
  markRect(x0, y0, x1, y1) {
    const a = clamp(Math.floor((x0 - 2) / CH), 0, this.cw - 1), b = clamp(Math.floor((x1 + 2) / CH), 0, this.cw - 1);
    const c = clamp(Math.floor((y0 - 2) / CH), 0, this.chh - 1), d = clamp(Math.floor((y1 + 2) / CH), 0, this.chh - 1);
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) this.dirty[j * this.cw + i] = 1;
  }

  /** repaint up to `budget` dirty chunks, plus `rolling` chunks of the slow refresh */
  update(budget = 12, rolling = 2) {
    if (this.w.terrainVersion !== this.lastTerrainVersion) {
      this.lastTerrainVersion = this.w.terrainVersion;
    }
    let done = 0;
    for (let i = 0; i < this.nChunks && done < budget; i++) {
      const k = (this.dirtyCursor = ((this.dirtyCursor || 0) + 1) % this.nChunks);
      if (this.dirty[k]) { this.renderChunk(k); this.dirty[k] = 0; done++; }
    }
    for (let r = 0; r < rolling; r++) {
      const k = this.order[this.roll];
      this.roll = (this.roll + 1) % this.nChunks;
      this.renderChunk(k);
      this.dirty[k] = 0;
    }
    return done;
  }

  /** compute land colour, water colour, height, shade for one cell into local slot i */
  cellInto(c, i) {
    const w = this.w;
    const sea = w.seaLevel;
    const h = w.elev[c] - sea;
    const T = w.baseTemp[c] + w.seasonAmp[c] * this.seasonVis + w.climate.offset;
    const t = this.tmp;
    this.he[i] = h;
    this.hc[i] = h >= 0 ? Math.min(1, 0.4 + h / 0.01) : Math.max(-1, -0.4 + h / 0.01);
    this.lk[i] = w.lake[c] > 0 ? 1 : 0;
    this.lv[i] = w.lava[c];
    // water colour (used for sea pixels; lakes take LAKE)
    waterColor(Math.max(0, -h), T, w.veg[c], t);
    let r = t[0], g = t[1], b = t[2];
    const ice = T < -2.5 ? smoothstep(-2.5, -9, T) : 0;
    this.ic[i] = ice;
    if (h < 0 && ice > 0) {
      r += (SEA_ICE[0] - r) * ice; g += (SEA_ICE[1] - g) * ice; b += (SEA_ICE[2] - b) * ice;
    }
    if (w.pollution[c] > 0.05 && h < 0) { const s = Math.min(0.5, w.pollution[c]); r += (90 - r) * s; g += (96 - g) * s; b += (70 - b) * s; }
    this.wr[i] = r; this.wg[i] = g; this.wb[i] = b;

    // land colour
    const bi = w.biome[c];
    const pal = LAND[bi];
    if (!pal) {
      // a sea cell: what the shore would look like — sand
      this.lr[i] = 216; this.lg[i] = 200; this.lb[i] = 150;
    } else {
      const v = clamp(w.veg[c] / 0.8, 0, 1);
      r = pal[0][0] + (pal[1][0] - pal[0][0]) * v;
      g = pal[0][1] + (pal[1][1] - pal[0][1]) * v;
      b = pal[0][2] + (pal[1][2] - pal[0][2]) * v;
      if ((bi === B.FOREST || bi === B.SHRUB || bi === B.GRASS) && this.autumn > 0 && T < 16 && T > -2) {
        const s = this.autumn * (bi === B.FOREST ? 0.5 : 0.25);
        r += (AUTUMN[0] - r) * s; g += (AUTUMN[1] - g) * s; b += (AUTUMN[2] - b) * s;
      }
      const im = w.impr[c];
      if (im === IMP.FARM || im === IMP.PASTURE) {
        r = r * 0.3 + FARM_A[0] * 0.7; g = g * 0.3 + FARM_A[1] * 0.7; b = b * 0.3 + FARM_A[2] * 0.7;
      } else if (im === IMP.URBAN) { r = URBAN[0]; g = URBAN[1]; b = URBAN[2]; }
      if (T < -0.5 && bi !== B.SNOWPEAK && bi !== B.ICE) {
        const s = smoothstep(-0.5, -8, T) * (im === IMP.URBAN ? 0.6 : 0.95);
        r += (SNOW[0] - r) * s; g += (SNOW[1] - g) * s; b += (SNOW[2] - b) * s;
      }
      if (w.scorch[c] > 0) { const s = Math.min(0.85, w.scorch[c] / 80); r += (46 - r) * s; g += (40 - g) * s; b += (38 - b) * s; }
      if (w.rad[c] > 0.05) { const s = Math.min(0.6, w.rad[c]); r += (120 - r) * s; g += (130 - g) * s; b += (60 - b) * s; }
      if (w.pollution[c] > 0.05) { const s = Math.min(0.45, w.pollution[c] * 0.6); r += (104 - r) * s; g += (96 - g) * s; b += (82 - b) * s; }
      if (w.magic[c] > 0.05) { const s = Math.min(0.4, w.magic[c] * 0.5); r += (120 - r) * s; g += (220 - g) * s; b += (150 - b) * s; }
      if (w.flood[c] > 0.0003) { const s = Math.min(0.85, w.flood[c] * 700); r += (66 - r) * s; g += (116 - g) * s; b += (156 - b) * s; }
      this.lr[i] = r; this.lg[i] = g; this.lb[i] = b;
    }
  }

  renderChunk(k) {
    const w = this.w;
    const { W, H } = w;
    const cx0 = (k % this.cw) * CH, cy0 = Math.floor(k / this.cw) * CH;
    // gather cell data with a 2-cell margin
    for (let ly = 0; ly < M; ly++) {
      const y = clamp(cy0 + ly - 2, 0, H - 1);
      for (let lx = 0; lx < M; lx++) {
        const x = clamp(cx0 + lx - 2, 0, W - 1);
        this.cellInto(y * W + x, ly * M + lx);
      }
    }
    // soften the coastline field (3×3 blur) so shores curve instead of following cell edges
    const hc = this.hc, hb = this.hb || (this.hb = new Float32Array(M * M));
    for (let ly = 1; ly < M - 1; ly++) {
      for (let lx = 1; lx < M - 1; lx++) {
        const i = ly * M + lx;
        hb[i] = hc[i] * 0.4 + (hc[i - 1] + hc[i + 1] + hc[i - M] + hc[i + M]) * 0.1 + (hc[i - M - 1] + hc[i - M + 1] + hc[i + M - 1] + hc[i + M + 1]) * 0.05;
      }
    }
    // shading from the height field (relief exaggerated on land, subtle under water)
    const he = this.he, sh = this.sh;
    for (let ly = 1; ly < M - 1; ly++) {
      for (let lx = 1; lx < M - 1; lx++) {
        const i = ly * M + lx;
        const land = he[i] >= 0;
        const e = (j) => (land ? Math.max(0, he[j]) : he[j]);
        const gx = (e(i + 1) - e(i - 1)) * 0.5, gy = (e(i + M) - e(i - M)) * 0.5;
        sh[i] = 1 + Math.tanh((gx + gy) * (land ? -14 : -4)) * (land ? 0.5 : 0.25);
      }
    }
    const data = this.img.data;
    const lr = this.lr, lg = this.lg, lb = this.lb, wr = this.wr, wg = this.wg, wb = this.wb, lk = this.lk, lv = this.lv, ic = this.ic;
    for (let py = 0; py < CP; py++) {
      const gyf = (cy0 * S + py + 0.5) / S - 0.5;
      const y0 = Math.floor(gyf), ty = gyf - y0;
      const ly = y0 - cy0 + 2;
      const gpy = cy0 * S + py;
      for (let px = 0; px < CP; px++) {
        const gxf = (cx0 * S + px + 0.5) / S - 0.5;
        const x0 = Math.floor(gxf), tx = gxf - x0;
        const lx = x0 - cx0 + 2;
        const i00 = ly * M + lx, i10 = i00 + 1, i01 = i00 + M, i11 = i01 + 1;
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        const h = (hb[i00] * w00 + hb[i10] * w10 + hb[i01] * w01 + hb[i11] * w11) * 0.008;
        const s = sh[i00] * w00 + sh[i10] * w10 + sh[i01] * w01 + sh[i11] * w11;
        const gpx = cx0 * S + px;
        const nz = hash2(gpx, gpy, 3);
        let r, g, b;
        if (h < 0) {
          r = wr[i00] * w00 + wr[i10] * w10 + wr[i01] * w01 + wr[i11] * w11;
          g = wg[i00] * w00 + wg[i10] * w10 + wg[i01] * w01 + wg[i11] * w11;
          b = wb[i00] * w00 + wb[i10] * w10 + wb[i01] * w01 + wb[i11] * w11;
          const sf = 0.92 + 0.08 * s + (nz - 0.5) * 0.03;
          r *= sf; g *= sf; b *= sf;
          if (h > -0.0025) { const f = (1 + h / 0.0025) * 0.5; r += (235 - r) * f; g += (240 - g) * f; b += (235 - b) * f; } // surf
        } else {
          const lakeW = lk[i00] * w00 + lk[i10] * w10 + lk[i01] * w01 + lk[i11] * w11;
          if (lakeW > 0.5) {
            r = LAKE[0]; g = LAKE[1]; b = LAKE[2];
            const ice = ic[i00] * w00 + ic[i10] * w10 + ic[i01] * w01 + ic[i11] * w11;
            if (ice > 0) { r += (SEA_ICE[0] - r) * ice; g += (SEA_ICE[1] - g) * ice; b += (SEA_ICE[2] - b) * ice; }
            if (lakeW < 0.62) { r += (220 - r) * 0.35; g += (225 - g) * 0.35; b += (210 - b) * 0.35; }
          } else {
            r = lr[i00] * w00 + lr[i10] * w10 + lr[i01] * w01 + lr[i11] * w11;
            g = lg[i00] * w00 + lg[i10] * w10 + lg[i01] * w01 + lg[i11] * w11;
            b = lb[i00] * w00 + lb[i10] * w10 + lb[i01] * w01 + lb[i11] * w11;
            const sf = s * (0.94 + nz * 0.12);
            r *= sf; g *= sf; b *= sf;
            const lava = lv[i00] * w00 + lv[i10] * w10 + lv[i01] * w01 + lv[i11] * w11;
            if (lava > 0.0006) {
              const f = Math.min(1, lava * 500);
              const hot = 0.6 + 0.4 * hash2(gpx, gpy, (w.tick >> 1) & 63);
              r += (255 * hot - r) * f; g += (90 * hot * hot - g) * f; b += (20 - b) * f;
            }
          }
        }
        const o = (py * CP + px) * 4;
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
      }
    }
    this.stampDetails(cx0, cy0, data);
    this.ctx.putImageData(this.img, cx0 * S, cy0 * S);
  }

  /** rivers, roads, fields, streets, ruins and trees */
  stampDetails(cx0, cy0, data) {
    const w = this.w;
    const { W, H } = w;
    const ox = cx0 * S, oy = cy0 * S;
    const jx = (x, y) => (x + 0.5 + (hash2(x, y, 11) - 0.5) * 0.55) * S - ox;
    const jy = (x, y) => (y + 0.5 + (hash2(x, y, 12) - 0.5) * 0.55) * S - oy;
    const put = (px, py, r, g, b, a = 1) => {
      px |= 0; py |= 0;
      if (px < 0 || py < 0 || px >= CP || py >= CP) return;
      const o = (py * CP + px) * 4;
      if (a >= 1) { data[o] = r; data[o + 1] = g; data[o + 2] = b; } else {
        data[o] += (r - data[o]) * a; data[o + 1] += (g - data[o + 1]) * a; data[o + 2] += (b - data[o + 2]) * a;
      }
    };
    const line = (x0, y0, x1, y1, width, col, a = 1) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(len * 2));
      const rr = width / 2;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (rr <= 0.6) { put(x, y, col[0], col[1], col[2], a); continue; }
        for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) {
          for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
            if (dx * dx + dy * dy <= rr * rr + 0.25) put(x + dx, y + dy, col[0], col[1], col[2], a);
          }
        }
      }
    };

    const xa = Math.max(0, cx0 - 2), xb = Math.min(W - 1, cx0 + CH + 1);
    const ya = Math.max(0, cy0 - 2), yb = Math.min(H - 1, cy0 + CH + 1);
    const sea = w.seaLevel;

    // fields, streets, ruins (per pixel of the cell, only for cells inside the chunk)
    for (let y = cy0; y < Math.min(H, cy0 + CH); y++) {
      for (let x = cx0; x < Math.min(W, cx0 + CH); x++) {
        const c = y * W + x;
        const im = w.impr[c];
        if (!im || w.elev[c] < sea) continue;
        const px0 = x * S - ox, py0 = y * S - oy;
        if (im === IMP.FARM) {
          const vert = hash2(x, y, 5) < 0.5;
          const ripe = this.autumn;
          for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
            const stripe = ((vert ? xx : yy) >> 1) & 1;
            const o = ((py0 + yy) * CP + px0 + xx) * 4;
            const base = stripe ? FARM_B : FARM_A;
            const k = 0.55 + 0.1 * ripe;
            data[o] += (base[0] + 30 * ripe - data[o]) * k;
            data[o + 1] += (base[1] - data[o + 1]) * k;
            data[o + 2] += (base[2] - 20 * ripe - data[o + 2]) * k;
          }
        } else if (im === IMP.URBAN) {
          for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
            const street = xx === 0 || yy === 0;
            const hv = hash2(x * S + xx, y * S + yy, 17);
            if (street) put(px0 + xx, py0 + yy, 92, 88, 86);
            else put(px0 + xx, py0 + yy, 150 + hv * 60, 120 + hv * 40, 104 + hv * 30, 0.8);
          }
        } else if (im === IMP.RUIN) {
          for (let k = 0; k < 4; k++) {
            if (hash2(x, y, 40 + k) < 0.6) put(px0 + hash2(x, y, 50 + k) * S, py0 + hash2(x, y, 60 + k) * S, 160, 156, 148);
          }
        } else if (im === IMP.MINE) {
          put(px0 + 1, py0 + 1, 60, 50, 44); put(px0 + 2, py0 + 1, 60, 50, 44); put(px0 + 1, py0 + 2, 90, 76, 60);
        } else if (im === IMP.WELL) {
          put(px0 + 1, py0 + 1, 30, 30, 34); put(px0 + 1, py0 + 2, 30, 30, 34); put(px0 + 2, py0 + 2, 200, 60, 40);
        } else if (im === IMP.SOLAR) {
          for (let yy = 0; yy < S; yy += 2) for (let xx = 0; xx < S; xx++) put(px0 + xx, py0 + yy, 40, 70, 130);
        }
      }
    }

    // rivers
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const c = y * W + x;
        const f = w.flow[c];
        if (f < RIVER_FLOW || w.elev[c] < sea || w.lake[c] > 0) continue;
        const d = w.down[c];
        if (d < 0) continue;
        const dx = d % W, dy = (d / W) | 0;
        const width = Math.min(3.2, 0.7 + 0.6 * Math.log2(f / RIVER_FLOW));
        const ex = w.elev[d] < sea ? (dx + 0.5) * S - ox : jx(dx, dy);
        const ey = w.elev[d] < sea ? (dy + 0.5) * S - oy : jy(dx, dy);
        const frozen = w.baseTemp[c] + w.seasonAmp[c] * this.seasonVis + w.climate.offset < -4;
        line(jx(x, y), jy(x, y), ex, ey, width, frozen ? SEA_ICE : RIVER, 0.92);
      }
    }

    // roads (connect to road neighbours; diagonals only when no orthogonal corner exists)
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const c = y * W + x;
        const rl = w.road[c];
        if (!rl) continue;
        const col = rl >= 3 ? HIGHWAY : rl === 2 ? RAIL : ROAD;
        const wd = rl >= 3 ? 1.4 : 1;
        const has = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && w.road[yy * W + xx] > 0;
        const cxp = (x + 0.5) * S - ox, cyp = (y + 0.5) * S - oy;
        if (has(x + 1, y)) line(cxp, cyp, cxp + S, cyp, wd, col, 0.85);
        if (has(x, y + 1)) line(cxp, cyp, cxp, cyp + S, wd, col, 0.85);
        if (has(x + 1, y + 1) && !has(x + 1, y) && !has(x, y + 1)) line(cxp, cyp, cxp + S, cyp + S, wd, col, 0.85);
        if (has(x - 1, y + 1) && !has(x - 1, y) && !has(x, y + 1)) line(cxp, cyp, cxp - S, cyp + S, wd, col, 0.85);
      }
    }

    // trees (stamped from cells around the chunk so canopies cross chunk borders seamlessly)
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const c = y * W + x;
        if (w.elev[c] < sea || w.lake[c] > 0 || w.impr[c] || w.fire[c] || w.lava[c] > 0) continue;
        const bi = w.biome[c];
        const dens = TREE_DENSITY[bi] * w.veg[c];
        if (dens < 0.08) continue;
        const n = Math.floor(dens * 2.6 + hash2(x, y, 21));
        const pal = LAND[bi];
        const base = pal ? pal[1] : [40, 90, 50];
        const T = w.baseTemp[c] + w.seasonAmp[c] * this.seasonVis + w.climate.offset;
        const snowy = T < -1;
        const aut = this.autumn > 0.3 && bi === B.FOREST && T < 14;
        for (let t = 0; t < n && t < 3; t++) {
          const px = x * S - ox + Math.floor(hash2(x, y, 30 + t) * S) - 1;
          const py = y * S - oy + Math.floor(hash2(x, y, 33 + t) * S) - 2;
          const hv = hash2(x, y, 36 + t);
          let r = base[0] * (0.7 + hv * 0.3), g = base[1] * (0.75 + hv * 0.3), b = base[2] * (0.7 + hv * 0.3);
          if (aut && hv < 0.6) { r = 170 + hv * 60; g = 90 + hv * 50; b = 36; }
          const dr = r * 0.6, dg = g * 0.6, db = b * 0.6;
          if (bi === B.TAIGA || (bi === B.MOUNTAIN && hv < 0.7) || bi === B.TUNDRA) {
            // conifer
            put(px + 1, py, r, g, b); put(px + 1, py + 1, r, g, b);
            put(px, py + 2, r, g, b); put(px + 1, py + 2, dr, dg, db); put(px + 2, py + 2, dr, dg, db);
            put(px + 1, py + 3, 70, 50, 34);
            if (snowy) { put(px + 1, py, 240, 244, 250); put(px, py + 2, 230, 236, 244); }
          } else if (bi === B.SAVANNA || bi === B.SHRUB) {
            // flat-topped acacia / bush
            put(px, py + 1, r, g, b); put(px + 1, py + 1, r, g, b); put(px + 2, py + 1, dr, dg, db);
            put(px + 1, py + 2, 92, 70, 44);
          } else {
            // broadleaf crown
            const big = bi === B.JUNGLE;
            put(px + 1, py, r * 1.15, g * 1.15, b * 1.1);
            put(px, py + 1, r, g, b); put(px + 1, py + 1, r, g, b); put(px + 2, py + 1, dr, dg, db);
            put(px + 1, py + 2, dr, dg, db);
            if (big) { put(px + 3, py + 1, dr, dg, db); put(px + 2, py + 2, dr * 0.9, dg * 0.9, db * 0.9); put(px + 2, py, r, g, b); }
            if (snowy) put(px + 1, py, 236, 240, 248);
          }
        }
      }
    }
  }
}
