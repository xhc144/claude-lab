// Turning "place block X on face F of cell C" into a concrete block state, plus support rules.

import { BLOCKS, B, ID_MASK, ID_BITS, OPAQUE, SOLID, REPLACEABLE, LIQUID, OPPOSITE, pack } from './blocks.js';

export const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// side face -> facing4 of the supporting wall, seen from the cell in front of that face
const WALL_OF_FACE = { 4: 0, 5: 2, 0: 1, 1: 3 };

export function yawIndex(yaw) {
  const k = Math.round(yaw / (Math.PI / 2));
  return ((k % 4) + 4) % 4; // 0 north(-Z) 1 west(-X) 2 south(+Z) 3 east(+X)
}
const F4_TO_FACE = [5, 1, 4, 0];

const PLANT_SOIL = new Set(['grass', 'dirt', 'moss', 'farmland', 'snow_grass', 'sky_grass', 'mud', 'pale_soil', 'mycel']);

// Can block id stand at (x,y,z) given its state? Used on placement and when neighbours change.
export function hasSupport(world, x, y, z, v) {
  const id = v & ID_MASK, meta = v >>> ID_BITS;
  const d = BLOCKS[id];
  const below = world.getBlock(x, y - 1, z) & ID_MASK;
  const bd = BLOCKS[below];
  switch (d.shape) {
    case 'cross':
      if (d.name === 'crystal_cluster' || d.name === 'crystal_bud') {
        const [dx, dy, dz] = FACE_N[OPPOSITE[meta & 7]];
        return SOLID[world.getBlock(x + dx, y + dy, z + dz) & ID_MASK] === 1;
      }
      if (d.name === 'glowshroom' || d.name === 'red_mushroom') return SOLID[below] === 1;
      if (d.name === 'seagrass') return SOLID[below] === 1 && (world.getBlock(x, y + 1, z) & ID_MASK) !== 0;
      if (d.name === 'dead_bush') return below === B.sand || below === B.redsand || PLANT_SOIL.has(bd.name);
      if (d.name === 'reeds') return below === B.reeds || PLANT_SOIL.has(bd.name) || below === B.sand;
      if (d.name === 'cobweb') return true;
      return PLANT_SOIL.has(bd.name) || (d.name.endsWith('_sapling') && below === B.sand && d.name === 'oak_sapling');
    case 'crop': return below === B.farmland;
    case 'torch': case 'inverter': {
      const att = meta & 7;
      if (att === 0) return SOLID[below] === 1 && bd.shape !== 'fence' ? true : bd.shape === 'fence' || SOLID[below] === 1;
      const [dx, , dz] = FACE_N[F4_TO_FACE[att - 1]];
      return OPAQUE[world.getBlock(x + dx, y, z + dz) & ID_MASK] === 1;
    }
    case 'wallflat': {
      const [dx, , dz] = FACE_N[F4_TO_FACE[meta & 3]];
      return OPAQUE[world.getBlock(x + dx, y, z + dz) & ID_MASK] === 1;
    }
    case 'lever': case 'button': {
      const [dx, dy, dz] = FACE_N[meta & 7];
      return SOLID[world.getBlock(x + dx, y + dy, z + dz) & ID_MASK] === 1;
    }
    case 'lantern':
      if (meta & 1) return SOLID[world.getBlock(x, y + 1, z) & ID_MASK] === 1 || BLOCKS[world.getBlock(x, y + 1, z) & ID_MASK].shape === 'fence';
      return SOLID[below] === 1;
    case 'wire': case 'rail': case 'plate': case 'carpet': case 'repeater':
      return SOLID[below] === 1 && bd.shape !== 'wire' && !bd.liquid;
    case 'door': {
      if (meta & 8) return (world.getBlock(x, y - 1, z) & ID_MASK) === id;
      return SOLID[below] === 1 && (world.getBlock(x, y + 1, z) & ID_MASK) === id;
    }
    case 'layer': return SOLID[below] === 1 && below !== B.ice;
    case 'flat': return LIQUID[below] === 1;
    case 'cactus': return below === B.sand || below === B.redsand || below === B.cactus;
    case 'vine': {
      if (!meta) return SOLID[world.getBlock(x, y + 1, z) & ID_MASK] === 1 || (world.getBlock(x, y + 1, z) & ID_MASK) === B.vines || BLOCKS[world.getBlock(x, y + 1, z) & ID_MASK].leaves;
      return true;
    }
    case 'fire': return SOLID[below] === 1 || true;
    default: return true;
  }
}

// Returns { x,y,z, v, extra:[[x,y,z,v]] } or null if placement is impossible.
// hit: raycast result { x,y,z, face, px,py,pz }, player: { yaw, pitch }
export function resolvePlacement(world, blockId, hit, player) {
  const d = BLOCKS[blockId];
  let { x, y, z } = hit;
  const face = hit.face;
  const hv = world.getBlock(x, y, z);
  const hid = hv & ID_MASK;
  let fy = hit.py - Math.floor(hit.py);
  // merge slabs into a double slab
  if (d.shape === 'slab' && hid === blockId) {
    const hm = hv >>> ID_BITS;
    if ((hm === 0 && face === 2) || (hm === 1 && face === 3)) return { x, y, z, v: pack(blockId, 2) };
  }
  // snow layers stack
  if (blockId === B.snow_layer && hid === B.snow_layer) {
    const hm = hv >>> ID_BITS;
    if (hm < 7) return { x, y, z, v: pack(blockId, hm + 1) };
    return { x, y, z, v: B.snow_block };
  }
  if (!REPLACEABLE[hid] || hid === blockId) {
    const n = FACE_N[face];
    x += n[0]; y += n[1]; z += n[2];
  } else {
    fy = 0.25;
  }
  if (y < 1 || y > 255) return null;
  const cur = world.getBlock(x, y, z) & ID_MASK;
  if (!REPLACEABLE[cur] && cur !== 0) return null;
  if (LIQUID[cur] && d.shape === 'flat') return null;

  const yi = yawIndex(player.yaw);
  let meta = 0;
  const extra = [];
  switch (d.orient) {
    case 'axis': meta = face < 2 ? 1 : face < 4 ? 0 : 2; break;
    case 'facing4': meta = (yi + 2) & 3; break;
    case 'facing6':
      if (player.pitch < -0.85) meta = 2;
      else if (player.pitch > 0.85) meta = 3;
      else meta = OPPOSITE[F4_TO_FACE[yi]];
      break;
    case 'slab': meta = face === 3 || (face !== 2 && fy > 0.5) ? 1 : 0; break;
    case 'stairs': meta = yi | (face === 3 || (face !== 2 && fy > 0.5) ? 4 : 0); break;
    case 'trapdoor': meta = ((yi + 2) & 3) | (face === 3 || (face !== 2 && fy > 0.5) ? 8 : 0); break;
    case 'door': {
      meta = yi;
      const up = world.getBlock(x, y + 1, z) & ID_MASK;
      if (!REPLACEABLE[up] && up !== 0) return null;
      // hinge on the side with a wall
      const [lx, , lz] = FACE_N[F4_TO_FACE[(yi + 1) & 3]];
      const hinge = OPAQUE[world.getBlock(x + lx, y, z + lz) & ID_MASK] ? 1 : 0;
      meta |= hinge << 4;
      extra.push([x, y + 1, z, pack(blockId, meta | 8)]);
      break;
    }
    case 'wall4': {
      if (face === 2 || face === 3) return null;
      meta = WALL_OF_FACE[face];
      break;
    }
    case 'torch': {
      if (face === 3) return null;
      meta = face === 2 ? 0 : WALL_OF_FACE[face] + 1;
      break;
    }
    case 'attach': meta = OPPOSITE[face]; break;
    case 'hang': meta = face === 3 ? 1 : 0; break;
    default: break;
  }
  if (d.shape === 'vine') {
    if (face === 2 || face === 3) return null;
    meta = 1 << WALL_OF_FACE[face];
  }
  if (d.name === 'crystal_cluster' || d.name === 'crystal_bud') meta = face;
  if (d.shape === 'rail') meta = (yi & 1) ? 1 : 0;
  if (d.name === 'repeater') meta = (yi + 2) & 3;
  if (d.name === 'conveyor') meta = yi;
  if (d.name === 'bed') meta = yi;
  const v = pack(blockId, meta);
  if (!hasSupport(world, x, y, z, d.shape === 'door' ? (v | (0)) : v)) {
    if (d.shape === 'door') {
      if (!SOLID[world.getBlock(x, y - 1, z) & ID_MASK]) return null;
    } else return null;
  }
  return { x, y, z, v, extra };
}
