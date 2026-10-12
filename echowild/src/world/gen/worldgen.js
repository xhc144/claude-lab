// Terrain generator. Pure and deterministic: the same seed and chunk coordinates always give the
// same blocks, so chunks can be generated in any order on any worker. Multi-chunk features
// (trees, geodes, structures) are placed by every chunk they overlap, each writing only its cells.

import { Noise, RNG, hash3, rand2 } from '../../core/noise.js';
import { B, pack, OPAQUE, ID_MASK } from '../blocks.js';
import { BIOMES, BI } from '../biomes.js';
import { placeStructures } from './structures.js';

export const SEA = 62;
export const H = 256;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export class WorldGen {
  constructor(seed) {
    this.seed = seed >>> 0;
    const s = this.seed;
    this.nCont = new Noise(s ^ 0x1111);
    this.nEro = new Noise(s ^ 0x2222);
    this.nTemp = new Noise(s ^ 0x3333);
    this.nHum = new Noise(s ^ 0x4444);
    this.nWeird = new Noise(s ^ 0x5555);
    this.nDetail = new Noise(s ^ 0x6666);
    this.nRidge = new Noise(s ^ 0x7777);
    this.nRiver = new Noise(s ^ 0x8888);
    this.nHills = new Noise(s ^ 0x9999);
    this.nCave1 = new Noise(s ^ 0xaaaa);
    this.nCave2 = new Noise(s ^ 0xbbbb);
    this.nCave3 = new Noise(s ^ 0xcccc);
    this.nDeep = new Noise(s ^ 0xdddd);
    this.nIsland = new Noise(s ^ 0xeeee);
    this.nIsland3 = new Noise(s ^ 0xf0f0);
    this.nStrata = new Noise(s ^ 0x1234);
    this.nEntrance = new Noise(s ^ 0x4321);
    this.nPatch = new Noise(s ^ 0x5678);
    this.colCache = new Map();
  }

  // ---------------------------------------------------------------- columns
  // Returns { h, biome, mount, river, island } for world column (x, z).
  column(x, z) {
    const key = x * 73856093 ^ z * 19349663;
    const cached = this.colCache.get(key);
    if (cached && cached.x === x && cached.z === z) return cached;
    if (this.colCache.size > 20000) this.colCache.clear();

    const spawnBias = 0.55 * Math.exp(-(x * x + z * z) / (500 * 500));
    const c = this.nCont.fbm2(x / 1500, z / 1500, 4) * 1.1 + 0.08 + spawnBias;
    const e = this.nEro.fbm2(x / 720, z / 720, 3);
    const t = this.nTemp.fbm2(x / 1300, z / 1300, 3) * 1.25 + this.nDetail.noise2(x / 60, z / 60) * 0.04;
    const hm = this.nHum.fbm2(x / 1000, z / 1000, 3) * 1.25;
    const w = this.nWeird.fbm2(x / 520, z / 520, 2) * 1.2;
    const detail = this.nDetail.fbm2(x / 90, z / 90, 4);
    const hills = this.nHills.fbm2(x / 170, z / 170, 3);
    const riverN = Math.abs(this.nRiver.fbm2(x / 650, z / 650, 3));
    const river = 1 - smooth(0.012, 0.045, riverN);

    const land = smooth(-0.16, 0.06, c);
    const oceanH = SEA - 7 - (1 - smooth(-0.65, -0.16, c)) * 24 + detail * 3;
    const mount = smooth(0.2, 0.75, e) * smooth(-0.02, 0.3, c);
    const ridge = this.nRidge.ridge2(x / 280, z / 280, 4);
    let landH = SEA + 2 + smooth(0.06, 0.7, c) * 9 + detail * 5 + hills * 9 + mount * (Math.pow(ridge, 1.6) * 100 + 12);

    // biome-driven shaping
    const desertF = smooth(0.3, 0.5, t) * smooth(-0.05, -0.3, hm);
    const mesaF = desertF * smooth(0.3, 0.5, w);
    const swampF = smooth(0.3, 0.5, hm) * smooth(-0.1, 0.1, t) * (1 - mount);
    landH += desertF * (Math.sin(x / 13 + this.nDetail.noise2(x / 40, z / 40) * 3) * Math.cos(z / 17) * 2.5);
    if (mesaF > 0.01) {
      const base = landH + mesaF * 24;
      const terr = Math.floor(base / 7) * 7 + smooth(0.6, 1, (base / 7) % 1) * 7;
      landH = lerp(landH, terr, smooth(0.2, 0.6, mesaF));
    }
    landH = lerp(landH, SEA + 1 + detail * 2.2, swampF * 0.85);

    let h = lerp(oceanH, landH, land);
    let isRiver = false;
    if (land > 0.4 && river > 0.01) {
      const rf = river * (1 - smooth(0.25, 0.6, mount)) * smooth(0.4, 0.8, land);
      const target = SEA - 2 - river * 3;
      if (rf > 0.05) {
        h = lerp(h, Math.min(h, target), rf);
        if (h < SEA) isRiver = true;
      }
    }
    h = Math.max(4, Math.min(230, Math.round(h)));

    // biome selection
    let biome;
    if (h < SEA) biome = isRiver ? BI.river : t < -0.42 ? BI.frozen_ocean : BI.ocean;
    else if (h <= SEA + 1 && land < 0.98 && mount < 0.2 && swampF < 0.3) biome = t < -0.4 ? BI.tundra : BI.beach;
    else if (mount > 0.45 && h > SEA + 34) biome = BI.mountains;
    else if (w < -0.5 && t < 0.25 && t > -0.5) biome = BI.barrens;
    else if (t < -0.36) biome = hm > 0.05 ? BI.taiga : BI.tundra;
    else if (desertF > 0.45) biome = mesaF > 0.4 ? BI.mesa : BI.desert;
    else if (swampF > 0.45 && h < SEA + 5) biome = BI.swamp;
    else if (t > 0.0 && w > 0.42) biome = BI.blossom;
    else if (hm > -0.02) biome = BI.forest;
    else biome = BI.meadow;

    // floating islands: a 2D mask of where islands may hang
    const im = this.nIsland.fbm2(x / 260, z / 260, 3);
    const island = smooth(0.32, 0.55, im);

    const r = { x, z, h, biome, mount, river: isRiver, island, temp: t, hum: hm, detail };
    this.colCache.set(key, r);
    return r;
  }

  biomeAt(x, z) { return this.column(Math.floor(x), Math.floor(z)).biome; }

  // ---------------------------------------------------------------- 3D fields on a coarse grid
  // Trilinear interpolation of noise sampled every 4 (xz) × 8 (y) blocks.
  grid3(fn, cx, cz, y0, y1) {
    const nx = 5, ny = Math.ceil((y1 - y0) / 8) + 1, nz = 5;
    const g = new Float32Array(nx * ny * nz);
    const bx = cx * 16, bz = cz * 16;
    for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      g[(iy * nz + iz) * nx + ix] = fn(bx + ix * 4, y0 + iy * 8, bz + iz * 4);
    }
    return (lx, y, lz) => {
      const fx = lx / 4, fy = (y - y0) / 8, fz = lz / 4;
      const ix = Math.min(3, Math.floor(fx)), iy = Math.min(ny - 2, Math.floor(fy)), iz = Math.min(3, Math.floor(fz));
      const tx = fx - ix, ty = fy - iy, tz = fz - iz;
      const at = (a, b, c) => g[((iy + b) * nz + (iz + c)) * nx + (ix + a)];
      const c00 = lerp(at(0, 0, 0), at(1, 0, 0), tx), c10 = lerp(at(0, 1, 0), at(1, 1, 0), tx);
      const c01 = lerp(at(0, 0, 1), at(1, 0, 1), tx), c11 = lerp(at(0, 1, 1), at(1, 1, 1), tx);
      return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
    };
  }

  // ---------------------------------------------------------------- chunk generation
  generate(cx, cz) {
    const blocks = new Uint16Array(65536);
    const biomes = new Uint8Array(256);
    const heights = new Uint8Array(256);
    const features = [];
    const bx = cx * 16, bz = cz * 16;
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;
    const rng = new RNG(hash3(cx, cz, 77, this.seed));

    // columns incl. a 2-block margin for tint blending
    const cols = [];
    for (let z = -2; z < 18; z++) for (let x = -2; x < 18; x++) cols.push(this.column(bx + x, bz + z));
    const col = (x, z) => cols[(z + 2) * 20 + (x + 2)];

    // ---- base terrain
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const c = col(x, z);
      const b = BIOMES[c.biome];
      biomes[(z << 4) | x] = c.biome;
      const h = c.h;
      const wx = bx + x, wz = bz + z;
      const deepLine = 26 + Math.round(this.nStrata.noise2(wx / 30, wz / 30) * 5);
      const soil = 3 + Math.round(rand2(wx, wz, this.seed) * 1.5 + c.detail);
      let top, fill, under = B.stone;
      switch (b.key) {
        case 'desert': top = B.sand; fill = B.sand; under = B.sandstone; break;
        case 'beach': top = B.sand; fill = B.sand; under = B.sandstone; break;
        case 'mesa': top = B.redsand; fill = B.terracotta; under = B.terracotta; break;
        case 'tundra': case 'taiga': top = B.snow_grass; fill = B.dirt; break;
        case 'barrens': top = B.pale_soil; fill = B.pale_soil; break;
        case 'mountains': top = h > SEA + 70 ? B.snow_block : h > SEA + 50 ? B.stone : B.grass; fill = h > SEA + 50 ? B.stone : B.dirt; break;
        case 'swamp': top = B.grass; fill = B.dirt; break;
        case 'ocean': case 'frozen_ocean': case 'river':
          top = c.detail > 0.25 ? B.gravel : (c.detail < -0.3 && h > SEA - 8 ? B.clay : B.sand); fill = B.sand; break;
        default: top = B.grass; fill = B.dirt;
      }
      if (b.key === 'swamp' && c.detail > 0.35) top = B.mud;
      if (b.key === 'meadow' && c.detail > 0.55) top = B.moss;
      blocks[idx(x, 0, z)] = B.bedrock;
      for (let y = 1; y <= h; y++) {
        let v;
        if (y <= 3 && rand2(wx * 7 + y, wz * 13, this.seed) < (4 - y) / 4) v = B.bedrock;
        else if (y === h) v = top;
        else if (y > h - soil) v = fill;
        else if (b.key === 'mesa' && y > SEA - 4) {
          const band = Math.floor((y + this.nStrata.noise2(wx / 50, wz / 50) * 3) / 2.3) % 7;
          v = [B.terracotta, B.terra_orange, B.terra_cream, B.terracotta, B.terra_rust, B.terra_umber, B.terra_orange][band];
        } else if (y < deepLine) v = B.deepstone;
        else v = under === B.sandstone && y < h - soil - 5 ? B.stone : under;
        blocks[idx(x, y, z)] = v;
      }
      // water / ice
      if (h < SEA) {
        for (let y = h + 1; y <= SEA; y++) blocks[idx(x, y, z)] = B.water;
        if (b.snow && rand2(wx, wz, 3) < 0.85 - (SEA - h) * 0.02) blocks[idx(x, SEA, z)] = B.ice;
      }
    }

    // ---- caves (spaghetti tunnels + cheese caverns) and the underworld
    const top = 140;
    const cave1 = this.grid3((x, y, z) => this.nCave1.noise3(x / 70, y / 44, z / 70), cx, cz, 0, top);
    const cave2 = this.grid3((x, y, z) => this.nCave2.noise3(x / 58, y / 36, z / 58), cx, cz, 0, top);
    const cheese = this.grid3((x, y, z) => this.nCave3.fbm3(x / 90, y / 48, z / 90, 2), cx, cz, 0, top);
    const deep = this.grid3((x, y, z) => this.nDeep.fbm3(x / 110, y / 26, z / 110, 2), cx, cz, 0, 56);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const c = col(x, z);
      const h = c.h;
      const wx = bx + x, wz = bz + z;
      const entrance = this.nEntrance.noise2(wx / 48, wz / 48) > 0.62 && h > SEA + 1;
      const ceiling = entrance ? h + 1 : h - 6;
      const underOcean = h < SEA + 2;
      for (let y = 4; y < Math.min(ceiling, top); y++) {
        const i = idx(x, y, z);
        const cur = blocks[i];
        if (cur === B.bedrock || cur === B.water) continue;
        if (underOcean && y > h - 10) continue;
        let carve = false;
        const a = cave1(x, y, z), bb = cave2(x, y, z);
        const thick = 0.075 + (y < 40 ? 0.02 : 0);
        if (Math.abs(a) < thick && Math.abs(bb) < thick) carve = true;
        else if (y < 100 && cheese(x, y, z) > 0.42 + Math.max(0, (y - 60) / 120)) carve = true;
        if (!carve && y < 52 && y > 6) {
          // underworld: big open caverns between y 10 and 48
          const d = deep(x, y, z);
          const shape = 1 - Math.abs(y - 26) / 24;
          if (d + shape * 0.45 > 0.42) carve = true;
        }
        if (carve) blocks[i] = y <= 10 ? B.lava : 0;
      }
    }

    // ---- floating islands (sky archipelago)
    let isl = null;
    for (let z = 0; z < 16 && !isl; z++) for (let x = 0; x < 16; x++) if (col(x, z).island > 0.01) { isl = this.grid3((wx, y, wz) => this.nIsland3.fbm3(wx / 40, y / 26, wz / 40, 3), cx, cz, 136, 224); break; }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const c = col(x, z);
      if (c.island <= 0.01) continue;
      const wx = bx + x, wz = bz + z;
      const base = 165 + this.nIsland.noise2(wx / 90, wz / 90) * 18;
      let topY = -1;
      for (let y = 140; y < 220; y++) {
        const dy = (y - base) / 22;
        const prof = dy > 0 ? 1 - dy * dy * 4 : 1 - dy * dy * 0.7;
        if (prof <= 0) continue;
        const n = isl(x, y, z);
        if (c.island * prof + n * 0.55 > 0.55) {
          blocks[idx(x, y, z)] = B.stone;
          topY = y;
        }
      }
      if (topY > 0) {
        // dress the islands: skygrass on top, dirt below, levistone veins underneath
        let depth = 0;
        for (let y = 220; y >= 140; y--) {
          const i = idx(x, y, z);
          if (blocks[i] === B.stone) {
            depth++;
            if (depth === 1 && (blocks[idx(x, y + 1, z)] === 0)) blocks[i] = B.sky_grass;
            else if (depth <= 3) blocks[i] = B.dirt;
            else if (rand2(wx * 3 + y, wz, this.seed + 5) < 0.04) blocks[i] = B.levistone;
          } else depth = 0;
        }
        biomes[(z << 4) | x] = BI.sky;
      }
    }

    // ---- ores and blobs
    const veins = [
      [B.coal_ore, 20, 30, 140, 9],
      [B.copper_ore, 11, 28, 100, 8],
      [B.iron_ore, 10, 8, 72, 6],
      [B.gold_ore, 3, 5, 34, 5],
      [B.crystal_ore, 7, 5, 30, 6],
      [B.star_ore, 2, 4, 20, 3],
      [B.gravel, 5, 10, 120, 16],
      [B.dirt, 5, 20, 120, 16],
      [B.clay, 2, 30, 60, 10],
    ];
    for (const [ore, count, ymin, ymax, size] of veins) {
      for (let k = 0; k < count; k++) {
        let x = rng.next() * 16, y = ymin + rng.next() * (ymax - ymin), z = rng.next() * 16;
        const n = size;
        for (let s = 0; s < n; s++) {
          const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
          if (ix >= 0 && ix < 16 && iz >= 0 && iz < 16 && iy > 0 && iy < 255) {
            const i = idx(ix, iy, iz);
            const cur = blocks[i];
            if (cur === B.stone) blocks[i] = ore;
            else if (cur === B.deepstone) {
              blocks[i] = ore === B.iron_ore ? B.deep_iron_ore : ore === B.crystal_ore ? B.deep_crystal_ore : ore === B.coal_ore || ore === B.dirt || ore === B.clay ? B.deepstone : ore;
            }
          }
          x += rng.next() * 2 - 1; y += rng.next() * 1.4 - 0.7; z += rng.next() * 2 - 1;
        }
      }
    }
    // levistone pockets high in mountains
    if (rng.chance(0.3)) {
      const x = rng.int(16), z = rng.int(16), c = col(x, z);
      if (c.biome === BI.mountains) for (let k = 0; k < 6; k++) {
        const y = c.h - 3 - rng.int(12);
        const i = idx(Math.min(15, x + rng.int(2)), y, Math.min(15, z + rng.int(2)));
        if (blocks[i] === B.stone) blocks[i] = B.levistone;
      }
    }

    const W = new ChunkWriter(blocks, bx, bz, features);

    // ---- geodes (cross-chunk features)
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const r = new RNG(hash3(ncx, ncz, 991, this.seed));
      if (r.next() > 0.045) continue;
      const gx = ncx * 16 + r.int(16), gz = ncz * 16 + r.int(16), gy = 12 + r.int(34);
      this.geode(W, gx, gy, gz, r);
    }

    // ---- surface trees & plants
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      this.trees(W, ncx, ncz);
    }
    this.plants(blocks, col, bx, bz, rng);
    this.underworld(W, blocks, cx, cz, rng);
    this.islandDecor(W, blocks, col, cx, cz);

    // ---- structures
    placeStructures(this, W, cx, cz);

    // ---- heights (highest non-air block per column)
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let y = 255;
      while (y > 0 && !blocks[idx(x, y, z)]) y--;
      heights[(z << 4) | x] = y;
    }

    // ---- biome tints blended over 5×5 columns
    const tints = new Uint32Array(256 * 3);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const acc = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const cb = BIOMES[col(x + dx, z + dz).biome];
        const gr = cb.grassRGB, fo = cb.foliageRGB, wa = cb.waterRGB;
        acc[0] += gr[0]; acc[1] += gr[1]; acc[2] += gr[2];
        acc[3] += fo[0]; acc[4] += fo[1]; acc[5] += fo[2];
        acc[6] += wa[0]; acc[7] += wa[1]; acc[8] += wa[2];
      }
      const p = (r, g, b) => ((Math.round(r / 25) << 16) | (Math.round(g / 25) << 8) | Math.round(b / 25)) >>> 0;
      const i = (z << 4) | x;
      tints[i] = p(acc[0], acc[1], acc[2]);
      tints[256 + i] = p(acc[3], acc[4], acc[5]);
      tints[512 + i] = p(acc[6], acc[7], acc[8]);
    }
    // the sky islands keep their own tints
    for (let i = 0; i < 256; i++) if (biomes[i] === BI.sky) { tints[i] = 0x6fd0a0; tints[256 + i] = 0xbcd8f2; }

    return { blocks, biomes, heights, tints, features };
  }

  // ---------------------------------------------------------------- features
  geode(W, gx, gy, gz, r) {
    const R = 4.5 + r.next() * 2;
    for (let dy = -7; dy <= 7; dy++) for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
      const x = gx + dx, y = gy + dy, z = gz + dz;
      if (!W.inside(x, z)) continue;
      const d = Math.sqrt(dx * dx + dy * dy * 1.15 + dz * dz) + rand2(x * 3 + y, z, 17) * 0.6;
      if (d > R + 1.6) continue;
      if (d > R + 0.6) W.set(x, y, z, B.deep_tiles, true);
      else if (d > R - 0.4) W.set(x, y, z, rand2(x, y * 7 + z, 9) < 0.12 ? B.budding_echo : B.echo_block, true);
      else W.set(x, y, z, 0, true);
    }
    // crystals on the inner surface
    for (let dy = -6; dy <= 6; dy++) for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      const x = gx + dx, y = gy + dy, z = gz + dz;
      if (!W.inside(x, z) || W.get(x, y, z) !== 0) continue;
      const d = Math.sqrt(dx * dx + dy * dy * 1.15 + dz * dz);
      if (d < R - 2) continue;
      const rr = rand2(x * 5 + y, z * 3 - y, 23);
      if (rr > 0.3) continue;
      // attach to a neighbour shell block
      const faces = [[0, -1, 0, 2], [0, 1, 0, 3], [-1, 0, 0, 0], [1, 0, 0, 1], [0, 0, -1, 4], [0, 0, 1, 5]];
      for (const [ax, ay, az, face] of faces) {
        const n = W.get(x + ax, y + ay, z + az);
        if (n === B.echo_block || n === B.budding_echo) {
          W.set(x, y, z, pack(rr < 0.12 ? B.crystal_cluster : B.crystal_bud, face));
          break;
        }
      }
    }
    W.feature({ type: 'geode', x: gx, y: gy, z: gz });
  }

  trees(W, ncx, ncz) {
    const r = new RNG(hash3(ncx, ncz, 4242, this.seed));
    const centre = this.column(ncx * 16 + 8, ncz * 16 + 8);
    const key = BIOMES[centre.biome].key;
    const density = { forest: 9, blossom: 6, taiga: 7, swamp: 4, meadow: 1.2, tundra: 0.6, mountains: 1.5, beach: 0.15, desert: 0.0, mesa: 0.2, barrens: 0.3 }[key] || 0;
    let n = Math.floor(density) + (r.next() < density % 1 ? 1 : 0);
    if (key === 'desert' || key === 'mesa') n = r.int(3); // cacti
    for (let k = 0; k < n; k++) {
      const x = ncx * 16 + r.int(16), z = ncz * 16 + r.int(16);
      const c = this.column(x, z);
      const bk = BIOMES[c.biome].key;
      if (c.h <= SEA || c.h > 200) { r.next(); continue; }
      if (this.nEntrance.noise2(x / 48, z / 48) > 0.62) continue; // cave mouths
      const y = c.h + 1;
      const t = r.next();
      switch (bk) {
        case 'forest': if (t < 0.32) this.birch(W, x, y, z, r); else if (t < 0.4) this.bigOak(W, x, y, z, r); else this.oak(W, x, y, z, r); break;
        case 'blossom': if (t < 0.8) this.blossom(W, x, y, z, r); else this.oak(W, x, y, z, r); break;
        case 'taiga': case 'tundra': this.pine(W, x, y, z, r); break;
        case 'mountains': if (c.h < SEA + 60) this.pine(W, x, y, z, r); break;
        case 'swamp': this.willow(W, x, y, z, r); break;
        case 'meadow': if (t < 0.15) this.bigOak(W, x, y, z, r); else this.oak(W, x, y, z, r); break;
        case 'beach': this.oak(W, x, y, z, r); break;
        case 'desert': case 'mesa': this.cactus(W, x, y, z, r); break;
        case 'barrens': this.crystalSpire(W, x, y, z, r); break;
        default: break;
      }
    }
  }

  // Tree placement must not depend on chunk-local state (a tree spanning two chunks is drawn by
  // both), so validity is decided from the pure column function in trees().
  canGrowOn() { return true; }

  leafBall(W, x, y, z, rad, leaf, r, squash = 1) {
    const R = Math.ceil(rad);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + (dy * dy) / (squash * squash) + dz * dz;
      if (d > rad * rad + 0.5) continue;
      if (d > (rad - 0.7) * (rad - 0.7) && rand2(x + dx * 3, z + dz * 5 + dy, 31) < 0.3) continue;
      W.setIfAir(x + dx, y + dy, z + dz, leaf);
    }
  }

  oak(W, x, y, z, r) {
    if (!this.canGrowOn(W, x, y, z)) return;
    const h = 4 + r.int(3);
    for (let i = 0; i < h; i++) W.set(x, y + i, z, B.oak_log, true);
    this.leafBall(W, x, y + h - 1, z, 2.6, B.oak_leaves, r, 0.9);
    this.leafBall(W, x, y + h + 1, z, 1.6, B.oak_leaves, r);
    W.set(x, y - 1, z, B.dirt, false, true);
  }
  bigOak(W, x, y, z, r) {
    if (!this.canGrowOn(W, x, y, z)) return;
    const h = 7 + r.int(4);
    for (let i = 0; i < h; i++) W.set(x, y + i, z, B.oak_log, true);
    const branches = 3 + r.int(2);
    for (let b = 0; b < branches; b++) {
      const a = r.next() * Math.PI * 2, len = 2 + r.int(2), by = y + h - 3 - r.int(3);
      let bx = x, bz = z;
      for (let i = 1; i <= len; i++) {
        bx = Math.round(x + Math.cos(a) * i); bz = Math.round(z + Math.sin(a) * i);
        W.set(bx, by + Math.floor(i / 2), bz, pack(B.oak_log, Math.abs(Math.cos(a)) > 0.7 ? 1 : Math.abs(Math.sin(a)) > 0.7 ? 2 : 0), true);
      }
      this.leafBall(W, bx, by + 2, bz, 2.4, B.oak_leaves, r, 0.8);
    }
    this.leafBall(W, x, y + h, z, 3.2, B.oak_leaves, r, 0.75);
  }
  birch(W, x, y, z, r) {
    if (!this.canGrowOn(W, x, y, z)) return;
    const h = 5 + r.int(3);
    for (let i = 0; i < h; i++) W.set(x, y + i, z, B.birch_log, true);
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy === 1 ? 1 : dy === -2 ? 1.6 : 2.2;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dz * dz > rad * rad + 0.3) continue;
        W.setIfAir(x + dx, y + h + dy, z + dz, B.birch_leaves);
      }
    }
    W.setIfAir(x, y + h + 1, z, B.birch_leaves);
  }
  pine(W, x, y, z, r) {
    if (!this.canGrowOn(W, x, y, z)) return;
    const h = 7 + r.int(5);
    for (let i = 0; i < h; i++) W.set(x, y + i, z, B.pine_log, true);
    let rad = 2.8;
    for (let dy = h + 1; dy >= 2; dy--) {
      const layer = (h + 1 - dy);
      const rr = layer === 0 ? 0 : Math.min(rad, 0.6 + (layer % 3) * 0.9 + layer * 0.18);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dz * dz > rr * rr + 0.4) continue;
        W.setIfAir(x + dx, y + dy, z + dz, B.pine_leaves);
      }
      if (layer > 9) rad = 2.4;
    }
    W.setIfAir(x, y + h + 1, z, B.pine_leaves);
    W.setIfAir(x, y + h + 2, z, B.pine_leaves);
    // snow caps in cold biomes are added by the decorator (snow layers on leaves)
  }
  blossom(W, x, y, z, r) {
    if (!this.canGrowOn(W, x, y, z)) return;
    const h = 5 + r.int(3);
    const lean = r.next() * Math.PI * 2;
    let tx = x, tz = z;
    for (let i = 0; i < h; i++) {
      if (i > 2 && i % 2 === 0) { tx = Math.round(x + Math.cos(lean) * (i - 2) * 0.5); tz = Math.round(z + Math.sin(lean) * (i - 2) * 0.5); }
      W.set(tx, y + i, tz, B.blossom_log, true);
    }
    // wide flat canopy
    for (let dy = 0; dy <= 2; dy++) {
      const rad = dy === 0 ? 3.6 : dy === 1 ? 3 : 1.8;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const d = dx * dx + dz * dz;
        if (d > rad * rad) continue;
        if (d > (rad - 1) * (rad - 1) && rand2(tx + dx, tz + dz + dy * 7, 41) < 0.35) continue;
        W.setIfAir(tx + dx, y + h - 1 + dy, tz + dz, B.blossom_leaves);
      }
    }
    // a few hanging petals
    for (let k = 0; k < 5; k++) {
      const dx = r.int(7) - 3, dz = r.int(7) - 3;
      if (W.get(tx + dx, y + h - 1, tz + dz) === B.blossom_leaves) W.setIfAir(tx + dx, y + h - 2, tz + dz, B.blossom_leaves);
    }
  }
  willow(W, x, y, z, r) {
    const base = y;
    const h = 5 + r.int(3);
    for (let i = 0; i < h; i++) W.set(x, base + i, z, B.willow_log, true);
    for (let dy = -1; dy <= 1; dy++) {
      const rad = dy === 1 ? 2 : 3.3;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const d = dx * dx + dz * dz;
        if (d > rad * rad) continue;
        W.setIfAir(x + dx, base + h + dy, z + dz, B.willow_leaves);
        // drooping strands at the rim
        if (dy === -1 && d > (rad - 1.2) * (rad - 1.2) && rand2(x + dx, z + dz, 51) < 0.5) {
          const len = 1 + Math.floor(rand2(x - dx, z - dz, 52) * 4);
          for (let k = 1; k <= len; k++) W.setIfAir(x + dx, base + h - 1 - k, z + dz, k === len ? pack(B.vines, 0) : B.willow_leaves);
        }
      }
    }
  }
  cactus(W, x, y, z, r) {
    const h = 1 + r.int(3);
    for (let i = 0; i < h; i++) W.set(x, y + i, z, B.cactus);
  }
  crystalSpire(W, x, y, z, r) {
    const h = 3 + r.int(6);
    for (let i = 0; i < h; i++) {
      W.set(x, y + i, z, B.pale_crystal, true);
      if (i < h / 2 && r.next() < 0.5) W.setIfAir(x + r.int(3) - 1, y + i, z + r.int(3) - 1, B.pale_crystal);
    }
  }

  plants(blocks, col, bx, bz, rng) {
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const c = col(x, z);
      const key = BIOMES[c.biome].key;
      let y = c.h;
      // find actual surface (trees/carving may have changed it)
      while (y < 254 && blocks[idx(x, y + 1, z)] !== 0) y++;
      if (y > 250) continue;
      const g = blocks[idx(x, y, z)];
      const above = idx(x, y + 1, z);
      if (blocks[above] !== 0) {
        // underwater plants
        if (blocks[above] === B.water && (g === B.sand || g === B.gravel || g === B.clay) && rng.next() < 0.18 && blocks[idx(x, y + 2, z)] === B.water) blocks[above] = B.seagrass;
        if (blocks[above] === B.water && key === 'swamp' && blocks[idx(x, y + 2, z)] === 0 && rng.next() < 0.2) blocks[idx(x, y + 2, z)] = B.lily_pad;
        if (blocks[above] === B.water && blocks[idx(x, y + 2, z)] === B.water && key === 'swamp' && blocks[idx(x, y + 3, z)] === 0 && rng.next() < 0.15) blocks[idx(x, y + 3, z)] = B.lily_pad;
        continue;
      }
      const wx = bx + x, wz = bz + z;
      const patch = this.nPatch.noise2(wx / 22, wz / 22);
      const p = rng.next();
      if (g === B.grass || g === B.moss) {
        if (key === 'meadow') {
          if (p < 0.38) blocks[above] = B.tall_grass;
          else if (p < 0.47) blocks[above] = patch > 0.3 ? B.dawnflower : patch < -0.3 ? B.bluestar : patch > 0 ? B.bellbloom : B.emberbloom;
          else if (p < 0.475) blocks[above] = B.moonlily;
        } else if (key === 'forest') {
          if (p < 0.25) blocks[above] = B.tall_grass;
          else if (p < 0.3) blocks[above] = B.fern;
          else if (p < 0.315) blocks[above] = patch > 0 ? B.bellbloom : B.red_mushroom;
          else if (p < 0.322) blocks[above] = B.berry_bush;
        } else if (key === 'blossom') {
          if (p < 0.2) blocks[above] = B.tall_grass;
          else if (p < 0.3) blocks[above] = B.bellbloom;
          else if (p < 0.32) blocks[above] = B.moonlily;
        } else if (key === 'swamp') {
          if (p < 0.2) blocks[above] = B.tall_grass;
          else if (p < 0.26) blocks[above] = B.fern;
          else if (p < 0.28) blocks[above] = B.red_mushroom;
        } else if (key === 'mountains') {
          if (p < 0.12) blocks[above] = B.tall_grass;
          else if (p < 0.14) blocks[above] = B.bluestar;
        } else if (key === 'beach') {
          if (p < 0.05) blocks[above] = B.tall_grass;
        } else if (p < 0.2) blocks[above] = B.tall_grass;
        // reeds beside water
        if (blocks[above] === 0 || blocks[above] === B.tall_grass) {
          const nearWater = (x > 0 && blocks[idx(x - 1, y, z)] === B.water) || (x < 15 && blocks[idx(x + 1, y, z)] === B.water) ||
            (z > 0 && blocks[idx(x, y, z - 1)] === B.water) || (z < 15 && blocks[idx(x, y, z + 1)] === B.water);
          if (nearWater && p > 0.6) { const hh = 1 + Math.floor(p * 3); for (let k = 1; k <= hh; k++) blocks[idx(x, y + k, z)] = B.reeds; }
        }
      } else if (g === B.snow_grass) {
        if (p < 0.08) blocks[above] = B.fern;
        else if (p < 0.1) blocks[above] = B.berry_bush;
        if (blocks[above] === 0 && rng.next() < 0.5) blocks[above] = B.snow_layer;
      } else if (g === B.sand || g === B.redsand) {
        if ((key === 'desert' || key === 'mesa') && p < 0.015) blocks[above] = B.dead_bush;
      } else if (g === B.pale_soil) {
        if (p < 0.04) blocks[above] = B.moonlily;
      } else if (g === B.snow_block && rng.next() < 0.3) blocks[above] = B.snow_layer;
      // snow on leaves in cold biomes
      if ((key === 'taiga' || key === 'tundra') && (g === B.pine_leaves || g === B.oak_leaves)) blocks[above] = B.snow_layer;
    }
  }

  underworld(W, blocks, cx, cz, rng) {
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      for (let y = 8; y < 56; y++) {
        const i = idx(x, y, z);
        if (blocks[i] !== 0) continue;
        const below = blocks[idx(x, y - 1, z)];
        if (below === B.deepstone || below === B.stone || below === B.deep_iron_ore) {
          // floor of a cavern
          if (y < 48) {
            blocks[idx(x, y - 1, z)] = B.mycel;
            const p = rng.next();
            const wx = cx * 16 + x, wz = cz * 16 + z;
            const patch = this.nPatch.noise2(wx / 9, wz / 9 + y * 0.3);
            if (p < (patch > 0.35 ? 0.16 : 0.006)) blocks[i] = B.glowshroom;
            else if (p > 0.995) blocks[i] = B.red_mushroom;
          } else if (rng.next() < 0.015) blocks[i] = B.glowshroom;
        }
        const aboveB = y < 255 ? blocks[idx(x, y + 1, z)] : 0;
        if ((aboveB === B.deepstone || aboveB === B.stone) && rng.next() < 0.012 && y < 50) {
          // hanging glow roots
          for (let k = 0; k < 1 + rng.int(4); k++) if (blocks[idx(x, y - k, z)] === 0) blocks[idx(x, y - k, z)] = pack(B.vines, 0);
        }
      }
    }
    // giant mushrooms in the deep caverns: placed so the whole cap stays inside this chunk
    const r = new RNG(hash3(cx, cz, 6161, this.seed));
    const n = r.int(4);
    for (let k = 0; k < n; k++) {
      const x = cx * 16 + 4 + r.int(8), z = cz * 16 + 4 + r.int(8);
      const startY = 12 + r.int(22);
      const glow = r.next() < 0.7;
      const h = 5 + r.int(6);
      const rad = 2.5 + r.next() * 1.5;
      let y = -1;
      for (let yy = startY; yy < 46; yy++) {
        const v = W.get(x, yy, z), vb = W.get(x, yy - 1, z);
        if (v === 0 && (vb === B.mycel || vb === B.deepstone)) { y = yy; break; }
      }
      if (y < 0) continue;
      let clear = true;
      for (let i = 0; i < h && clear; i++) if (W.get(x, y + i, z) !== 0 && W.get(x, y + i, z) !== B.glowshroom) clear = false;
      if (!clear) continue;
      for (let i = 0; i < h; i++) W.set(x, y + i, z, B.mushroom_stem, true);
      const cap = glow ? B.glowcap : B.ambercap;
      for (let dy = -1; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const rr = rad - Math.max(0, dy) * 0.9;
        const d = dx * dx + dz * dz;
        if (d > rr * rr) continue;
        if (dy === -1 && d < (rr - 1) * (rr - 1)) continue;
        W.setIfAir(x + dx, y + h + dy, z + dz, cap);
      }
    }
  }

  islandDecor(W, blocks, col, cx, cz) {
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;
    {
      // cloud trees: kept inside the chunk so their canopies are never cut at borders
      const r = new RNG(hash3(cx, cz, 5151, this.seed));
      const n = r.int(3);
      for (let k = 0; k < n; k++) {
        const x = cx * 16 + 3 + r.int(10), z = cz * 16 + 3 + r.int(10);
        if (this.column(x, z).island < 0.2) continue;
        let y = 220;
        while (y > 140 && W.get(x, y, z) !== B.sky_grass) y--;
        if (y <= 140) continue;
        const h = 4 + r.int(3);
        for (let i = 1; i <= h; i++) W.set(x, y + i, z, B.cloud_log, true);
        this.leafBall(W, x, y + h + 1, z, 2.6, B.cloud_leaves, r, 0.7);
      }
    }
    // flowers and cloud wisps
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      if (col(x, z).island < 0.05) continue;
      for (let y = 141; y < 222; y++) {
        const i = idx(x, y, z);
        if (blocks[i] === B.sky_grass && blocks[idx(x, y + 1, z)] === 0) {
          const p = rand2(cx * 16 + x, cz * 16 + z, y);
          if (p < 0.2) blocks[idx(x, y + 1, z)] = B.tall_grass;
          else if (p < 0.24) blocks[idx(x, y + 1, z)] = B.bluestar;
          else if (p < 0.26) blocks[idx(x, y + 1, z)] = B.moonlily;
        }
        // cloud puffs clinging below island edges
        if (blocks[i] === 0 && y > 141 && OPAQUE[blocks[idx(x, y + 1, z)] & ID_MASK] && rand2(cx * 16 + x, cz * 16 + z, y * 3) < 0.05) blocks[i] = B.cloud_block;
      }
    }
  }
}

// Writes clipped to one chunk, in world coordinates.
export class ChunkWriter {
  constructor(blocks, bx, bz, features) { this.blocks = blocks; this.bx = bx; this.bz = bz; this.features = features; }
  inside(x, z) { return x >= this.bx && x < this.bx + 16 && z >= this.bz && z < this.bz + 16; }
  get(x, y, z) {
    if (!this.inside(x, z)) return -1;
    if (y < 0 || y > 255) return 0;
    return this.blocks[(y << 8) | ((z - this.bz) << 4) | (x - this.bx)];
  }
  // force: overwrite anything except bedrock; otherwise only replace air/plants/leaves/water
  set(x, y, z, v, force = false, onlySolid = false) {
    if (!this.inside(x, z) || y < 1 || y > 255) return;
    const i = (y << 8) | ((z - this.bz) << 4) | (x - this.bx);
    const cur = this.blocks[i];
    if ((cur & ID_MASK) === B.bedrock) return;
    if (onlySolid) { if (OPAQUE[cur & ID_MASK]) this.blocks[i] = v; return; }
    if (!force && cur && !REPL[cur & ID_MASK]) return;
    this.blocks[i] = v;
  }
  setIfAir(x, y, z, v) {
    if (!this.inside(x, z) || y < 1 || y > 255) return;
    const i = (y << 8) | ((z - this.bz) << 4) | (x - this.bx);
    const c = this.blocks[i] & ID_MASK;
    if (c === 0 || c === B.tall_grass || c === B.snow_layer || c === B.fern) this.blocks[i] = v;
  }
  feature(f) {
    if (f.x === undefined || this.inside(f.x, f.z)) this.features.push(f);
  }
}
const REPL = new Uint8Array(1024);
for (const n of ['air', 'tall_grass', 'fern', 'snow_layer', 'water', 'oak_leaves', 'birch_leaves', 'pine_leaves', 'blossom_leaves', 'willow_leaves', 'cloud_leaves', 'dawnflower', 'bellbloom', 'bluestar', 'emberbloom', 'dead_bush', 'vines', 'seagrass']) REPL[B[n]] = 1;
