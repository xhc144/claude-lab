// Hearth hamlets (炊烟村落): a well and paved square, gravel lanes running out to the four winds,
// timber cottages with gabled roofs and working interiors, fenced fields of wheat, radish and
// sunroot, lamp posts, a sheep pen — and the villagers who live there (see systems/village.js).
//
// Houses are built in a local frame (x across the front, z from the front wall to the back,
// door at z = 0) and rotated to face their lane, so stairs, doors, beds and torches keep their
// orientation. Every floor is levelled to its highest ground and the door always meets the lane
// at the same height or one stair step up.

import { B, ID_MASK, pack } from '../blocks.js';
import { BIOMES } from '../biomes.js';
import { RNG, hash3 } from '../../core/noise.js';

const SEA = 62;
const DIRS4 = [[0, -1], [-1, 0], [0, 1], [1, 0]]; // facing4: north, west, south, east
export const PROFESSIONS = ['farmer', 'shepherd', 'smith', 'cartographer', 'farmer', 'scholar'];

export function makeVillage({ put, fill, chest, foundation }) {
  const ground = (gen, x, z) => gen.column(x, z).h;

  // a rotated local frame for one building
  function frame(W, ox, oy, oz, k) {
    const R = DIRS4[(k + 3) & 3], Bk = DIRS4[(k + 2) & 3];
    const wx = (lx, lz) => ox + R[0] * lx + Bk[0] * lz;
    const wz = (lx, lz) => oz + R[1] * lx + Bk[1] * lz;
    return {
      wx, wz, y: oy,
      put: (lx, ly, lz, v) => put(W, wx(lx, lz), oy + ly, wz(lx, lz), v),
      face: (f) => (f + k) & 3,
    };
  }

  // a timber cottage: w × d outer footprint, door in the middle of the front wall
  function house(W, F, w, d, style, prof, r) {
    const { wood, planks, stairs, slab, wall, corner } = style;
    const dx = w >> 1;
    // floor and foundation; clear the inside and the roof space
    for (let lz = -1; lz <= d; lz++) for (let lx = -1; lx <= w; lx++) {
      const x = F.wx(lx, lz), z = F.wz(lx, lz);
      const inFoot = lx >= 0 && lx < w && lz >= 0 && lz < d;
      for (let ly = 0; ly <= 8; ly++) put(W, x, F.y + ly, z, 0);
      if (inFoot) {
        const edge = lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1;
        put(W, x, F.y - 1, z, edge ? B.cobblestone : planks);
        foundation(W, x, F.y - 1, z, B.cobblestone, 9);
      }
    }
    // walls with log corners and windows
    for (let ly = 0; ly <= 2; ly++) for (let lz = 0; lz < d; lz++) for (let lx = 0; lx < w; lx++) {
      const edgeX = lx === 0 || lx === w - 1, edgeZ = lz === 0 || lz === d - 1;
      if (!edgeX && !edgeZ) continue;
      let v = edgeX && edgeZ ? corner : wall;
      const win = ly === 1 && ((edgeX && !edgeZ && lz === (d >> 1)) || (edgeZ && !edgeX && lz === d - 1 && lx === dx) || (lz === 0 && !edgeX && Math.abs(lx - dx) === 2));
      if (win) v = B.glass;
      F.put(lx, ly, lz, v);
    }
    // the door
    F.put(dx, 0, 0, pack(B.oak_door, F.face(0)));
    F.put(dx, 1, 0, pack(B.oak_door, F.face(0) | 8));
    // gabled roof along x, overhanging by one; gable ends filled
    const half = Math.ceil((d + 2) / 2);
    for (let i = 0; i < half; i++) {
      const ly = 3 + i;
      const zf = -1 + i, zb = d - i;
      for (let lx = -1; lx <= w; lx++) {
        if (zf < zb) { F.put(lx, ly, zf, pack(stairs, F.face(2))); F.put(lx, ly, zb, pack(stairs, F.face(0))); }
        else F.put(lx, ly, zf, pack(slab, 0));
        if (lx === 0 || lx === w - 1) for (let lz = Math.max(0, zf + 1); lz <= Math.min(d - 1, zb - 1); lz++) F.put(lx, ly, lz, i === 0 ? corner : planks);
      }
    }
    // wall plates under the eaves and a plank ceiling (it keeps the lamplight inside the room,
    // instead of leaking out through the roof steps), a lantern hanging from it
    for (let lx = 0; lx < w; lx++) { F.put(lx, 3, 0, planks); F.put(lx, 3, d - 1, planks); }
    for (let lz = 1; lz < d - 1; lz++) for (let lx = 1; lx < w - 1; lx++) F.put(lx, 3, lz, planks);
    F.put(dx, 2, d >> 1, pack(B.lantern, 1));
    // furniture by trade
    const bx = w - 2, bz = d - 2;
    if (prof !== 'cartographer' && prof !== 'scholar') F.put(1, 0, d - 2, pack(B.bed, F.face(0)));
    F.put(dx, 2, d - 2, pack(B.torch, F.face(0) + 1));
    if (prof === 'smith') {
      F.put(1, 0, 1, pack(B.furnace, F.face(2))); F.put(2, 0, 1, B.anvil_stone);
      F.put(bx, 0, bz, B.cauldron); F.put(bx, 0, bz - 1, B.iron_block);
      chest(W, F.wx(bx - 1, bz), F.y, F.wz(bx - 1, bz), 'smith', F.face(0));
    } else if (prof === 'cartographer' || prof === 'scholar') {
      for (let lx = 1; lx < w - 1; lx++) if (lx !== dx) { F.put(lx, 0, d - 2, B.bookshelf); F.put(lx, 1, d - 2, B.bookshelf); }
      F.put(1, 0, 1, pack(B.bed, F.face(1)));
      F.put(w - 2, 0, 1, B.workbench); F.put(w - 2, 1, 1, B.flower_pot);
      F.put(dx, 0, (d >> 1), B.carpet_red);
      chest(W, F.wx(w - 2, Math.max(2, d - 3)), F.y, F.wz(w - 2, Math.max(2, d - 3)), prof === 'scholar' ? 'scholar' : 'cartographer', F.face(3));
    } else if (prof === 'shepherd') {
      F.put(bx, 0, bz, B.felt_white); F.put(bx, 1, bz, B.felt_white); F.put(bx, 0, bz - 1, B.felt_sky);
      F.put(w - 2, 0, 1, B.workbench);
      chest(W, F.wx(1, 1), F.y, F.wz(1, 1), 'village', F.face(1));
    } else {
      F.put(w - 2, 0, 1, B.workbench); F.put(bx, 0, bz, B.thatch); F.put(bx, 1, bz, B.thatch);
      F.put(bx, 0, bz - 1, pack(B.furnace, F.face(3)));
      chest(W, F.wx(1, 1), F.y, F.wz(1, 1), 'village', F.face(1));
    }
    void r;
  }

  const lampPost = (W, x, y, z) => { put(W, x, y, z, B.oak_fence); put(W, x, y + 1, z, B.oak_fence); put(W, x, y + 2, z, pack(B.lantern, 0)); };

  // the porch in front of a door, meeting the lane at most one stair step lower
  function porch(W, F, lx, lane, gen) {
    const x = F.wx(lx, -1), z = F.wz(lx, -1);
    const hp = Math.max(ground(gen, F.wx(lx, -2), F.wz(lx, -2)), lane);
    const diff = F.y - 1 - hp;
    for (let ly = 0; ly <= 3; ly++) put(W, x, F.y + ly, z, 0);
    if (diff <= 0) put(W, x, F.y - 1, z, B.cobblestone);
    else put(W, x, F.y - 1, z, pack(B.cobblestone_stairs, F.face(2)));
    foundation(W, x, F.y - 1, z, B.cobblestone, 8);
    if (diff >= 2) {
      // a second step down onto the lane
      const x2 = F.wx(lx, -2), z2 = F.wz(lx, -2);
      put(W, x2, F.y - 2, z2, pack(B.cobblestone_stairs, F.face(2)));
      foundation(W, x2, F.y - 2, z2, B.cobblestone, 8);
      for (let ly = -1; ly <= 2; ly++) put(W, x2, F.y + ly, z2, 0);
    }
  }

  // a fenced field (x0, z0, w × d inner), the gate on the given side ('n' | 's' | 'w' | 'e')
  function field(W, gen, x0, z0, w, d, gateSide, r) {
    const crops = [B.wheat, B.wheat, B.radish, B.sunroot];
    const crop = crops[Math.floor(r.next() * crops.length)];
    let y = -1;
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) y = Math.max(y, ground(gen, x, z));
    for (let z = z0 - 1; z <= z0 + d; z++) for (let x = x0 - 1; x <= x0 + w; x++) {
      const edge = x === x0 - 1 || x === x0 + w || z === z0 - 1 || z === z0 + d;
      for (let k = 1; k <= 4; k++) put(W, x, y + k, z, 0);
      foundation(W, x, y, z, B.dirt, 6);
      if (edge) {
        put(W, x, y, z, B.grass);
        const gate = (gateSide === 'n' && z === z0 - 1 && x === x0 + (w >> 1)) || (gateSide === 's' && z === z0 + d && x === x0 + (w >> 1))
          || (gateSide === 'w' && x === x0 - 1 && z === z0 + (d >> 1)) || (gateSide === 'e' && x === x0 + w && z === z0 + (d >> 1));
        put(W, x, y + 1, z, gate ? pack(B.oak_gate, gateSide === 'n' || gateSide === 's' ? 0 : 1) : B.oak_fence);
      } else if ((w >= d ? z === z0 + (d >> 1) : x === x0 + (w >> 1)) && Math.min(w, d) > 2) put(W, x, y, z, B.water);
      else {
        put(W, x, y, z, B.farmland);
        put(W, x, y + 1, z, pack(crop, 3 + Math.floor(r.next() * 5)));
      }
    }
  }

  return {
    spacing: 10, salt: 41, radius: 34,
    locate(gen, rx, rz) {
      const r = new RNG(hash3(rx, rz, 41, gen.seed));
      if (r.next() < 0.12) return null;
      const x = rx * 160 + 36 + r.int(88), z = rz * 160 + 36 + r.int(88);
      const c = gen.column(x, z);
      const k = BIOMES[c.biome].key;
      if (!['meadow', 'forest', 'blossom', 'taiga', 'swamp'].includes(k)) return null;
      if (c.h <= SEA + 1 || c.h > SEA + 30 || c.island > 0.05 || c.river) return null;
      let lo = 999, hi = -999;
      for (let dz = -20; dz <= 20; dz += 5) for (let dx = -20; dx <= 20; dx += 5) {
        const cc = gen.column(x + dx, z + dz);
        if (cc.h <= SEA) return null;
        lo = Math.min(lo, cc.h); hi = Math.max(hi, cc.h);
      }
      if (hi - lo > 7) return null;
      return { x, y: c.h + 1, z, biome: k, seed: r.int(1 << 30) };
    },
    build(gen, W, o, r) {
      const { x: cx, z: cz } = o;
      const cold = o.biome === 'taiga';
      const style = cold
        ? { wood: 'pine', planks: B.pine_planks, stairs: B.pine_planks_stairs, slab: B.pine_planks_slab, wall: B.pine_planks, corner: B.pine_log }
        : o.biome === 'blossom'
          ? { wood: 'blossom', planks: B.blossom_planks, stairs: B.blossom_planks_stairs, slab: B.blossom_planks_slab, wall: B.blossom_planks, corner: B.blossom_log }
          : { wood: 'oak', planks: B.oak_planks, stairs: B.oak_planks_stairs, slab: B.oak_planks_slab, wall: B.oak_planks, corner: B.oak_log };
      const smithStyle = { ...style, wall: B.cobblestone, planks: B.stone_bricks };
      // the square: levelled to the well's height, paved, cleared of trees
      const y = ground(gen, cx, cz) + 1;
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dz));
        if (d === 5 && Math.abs(dx) === Math.abs(dz)) continue;
        const x = cx + dx, z = cz + dz;
        for (let k = 0; k <= 10; k++) put(W, x, y + k, z, 0);
        put(W, x, y - 1, z, d <= 1 ? B.stone_bricks : (Math.abs(dx * 7 + dz * 13) % 5 === 0 ? B.mossy_bricks : (d % 2 ? B.cobblestone : B.gravel)));
        foundation(W, x, y - 1, z, B.cobblestone, 8);
      }
      // the well
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, z = cz + dz, rim = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (rim) { put(W, x, y - 1, z, B.stone_bricks); put(W, x, y, z, pack(B.stone_bricks_slab, 0)); }
        else { put(W, x, y - 1, z, B.water); put(W, x, y - 2, z, B.water); put(W, x, y - 3, z, B.stone_bricks); }
      }
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { put(W, cx + dx, y + 1, cz + dz, B.oak_fence); put(W, cx + dx, y + 2, cz + dz, B.oak_fence); put(W, cx + dx, y, cz + dz, B.stone_bricks); }
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) put(W, cx + dx, y + 3, cz + dz, pack(style.slab, 0));
      put(W, cx, y + 2, cz, pack(B.lantern, 1));
      W.feature({ type: 'structure', kind: 'village', x: cx, y, z: cz });

      // lanes to the four winds, with houses along them
      const ARM = 26;
      let profIdx = 0;
      for (let a = 0; a < 4; a++) {
        const [ax, az] = DIRS4[a];
        const px = -az, pz = ax; // perpendicular
        for (let s = 5; s <= ARM; s++) for (let w = -1; w <= 1; w++) {
          const x = cx + ax * s + px * w, z = cz + az * s + pz * w;
          const h = ground(gen, x, z);
          put(W, x, h, z, (s * 3 + w * 5 + a) % 7 === 0 ? B.cobblestone : B.gravel);
          for (let k = 1; k <= 3; k++) put(W, x, h + k, z, 0);
          if (s % 7 === 0 && w === 1) { const lx = x + px, lz = z + pz; lampPost(W, lx, ground(gen, lx, lz) + 1, lz); }
        }
        // two building plots per side of each lane
        for (const side of [-1, 1]) for (const s of [13, 22]) {
          const slot = new RNG(hash3(cx + a * 31 + side * 7, cz + s, 77, o.seed));
          const roll = slot.next();
          if (roll < 0.18) continue;
          // the plot's front edge sits two cells from the lane's centre line
          const fx = cx + ax * s + px * side * 3, fz = cz + az * s + pz * side * 3;
          // facing back toward the lane
          const k = DIRS4.findIndex(([qx, qz]) => qx === -px * side && qz === -pz * side);
          if (roll < 0.36) {
            // a field instead of a house: 7 along the lane, 5 deep, its gate facing the lane
            const fd = 5, ox2 = px * side, oz2 = pz * side;
            const fx0 = fx + ox2, fz0 = fz + oz2; // one cell further out than a house front
            if (ax !== 0) field(W, gen, fx0 - 3, Math.min(fz0, fz0 + oz2 * (fd - 1)), 7, fd, oz2 > 0 ? 'n' : 's', slot);
            else field(W, gen, Math.min(fx0, fx0 + ox2 * (fd - 1)), fz0 - 3, fd, 7, ox2 > 0 ? 'w' : 'e', slot);
            continue;
          }
          const prof = PROFESSIONS[(profIdx++ + (o.seed & 3)) % PROFESSIONS.length];
          const w = 7, d = prof === 'smith' || roll > 0.8 ? 7 : 6;
          // origin: the house's local (0, 0) corner; centre the door on the plot
          const R = DIRS4[(k + 3) & 3];
          const ox = fx - R[0] * (w >> 1), oz = fz - R[1] * (w >> 1);
          const probe = frame(W, ox, 0, oz, k);
          let hi = -1, lo = 999;
          for (let lz = 0; lz < d; lz++) for (let lx = 0; lx < w; lx++) { const h = ground(gen, probe.wx(lx, lz), probe.wz(lx, lz)); hi = Math.max(hi, h); lo = Math.min(lo, h); }
          const lane = ground(gen, probe.wx(w >> 1, -2), probe.wz(w >> 1, -2));
          hi = Math.max(hi, lane);
          if (hi - lo > 5 || hi - lane > 2) continue;
          const F = frame(W, ox, hi + 1, oz, k);
          house(W, F, w, d, prof === 'smith' ? smithStyle : style, prof, slot);
          porch(W, F, w >> 1, lane, gen);
          W.feature({ type: 'villager', prof, x: F.wx(w >> 1, d >> 1), y: F.y, z: F.wz(w >> 1, d >> 1), home: [F.wx(w >> 1, 1), F.y, F.wz(w >> 1, 1)] });
          if (prof === 'shepherd') W.feature({ type: 'pen', x: F.wx(w >> 1, -4), y: lane + 1, z: F.wz(w >> 1, -4) });
        }
      }
      void ID_MASK;
    },
  };
}
