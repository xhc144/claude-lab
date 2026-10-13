// Axis-separated AABB vs voxel collision, shared by the player and every mob/item entity.

import { BLOCKS, ID_MASK, LIQUID, CLIMB, SOLID } from '../world/blocks.js';
import { collisionBoxes, CONNECTS, connectionMask } from '../world/models.js';

const EPS = 1e-4;
const DOOR = new Uint8Array(1024);
for (const b of BLOCKS) if (b && b.shape === 'door') DOOR[b.id] = 1;

// Gather collision boxes (world space) overlapping the given region.
export function gatherBoxes(world, x0, y0, z0, x1, y1, z1, out, passDoors = false) {
  out.length = 0;
  const ix0 = Math.floor(x0), iy0 = Math.floor(y0) - 1, iz0 = Math.floor(z0);
  const ix1 = Math.floor(x1), iy1 = Math.floor(y1), iz1 = Math.floor(z1);
  for (let y = iy0; y <= iy1; y++) for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) {
    let v;
    if (!world.isLoaded(x, z)) v = 2; // unloaded terrain behaves like stone
    else v = world.getBlock(x, y, z);
    const id = v & ID_MASK;
    if (!SOLID[id]) continue;
    if (passDoors && DOOR[id]) continue;
    const conn = CONNECTS[id] ? connectionMask(v, (dx, dy, dz) => world.getBlock(x + dx, y + dy, z + dz)) : 0;
    const bs = collisionBoxes(v, conn);
    for (const b of bs) out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5], id]);
  }
  return out;
}

const tmp = [];

// Move an entity box (e.x/y/z = feet centre, e.hw half-width, e.h height) by (dx,dy,dz).
// Sets e.onGround, e.hitX/hitY/hitZ, e.groundId. Returns the actual displacement.
export function moveAndCollide(world, e, dx, dy, dz) {
  const hw = e.hw, h = e.h;
  const x0 = e.x - hw, y0 = e.y, z0 = e.z - hw, x1 = e.x + hw, y1 = e.y + h, z1 = e.z + hw;
  const boxes = gatherBoxes(world,
    Math.min(x0, x0 + dx) - 0.01, Math.min(y0, y0 + dy) - 0.01, Math.min(z0, z0 + dz) - 0.01,
    Math.max(x1, x1 + dx) + 0.01, Math.max(y1, y1 + dy) + 0.01, Math.max(z1, z1 + dz) + 0.01, tmp, !!e.passDoors);
  let bx0 = x0, by0 = y0, bz0 = z0, bx1 = x1, by1 = y1, bz1 = z1;
  const ody = dy, odx = dx, odz = dz;
  let groundId = 0;
  // Y
  for (const b of boxes) {
    if (bx1 <= b[0] + EPS || bx0 >= b[3] - EPS || bz1 <= b[2] + EPS || bz0 >= b[5] - EPS) continue;
    if (dy < 0 && by0 >= b[4] - EPS && by0 + dy < b[4]) { dy = b[4] - by0; groundId = b[6]; }
    else if (dy > 0 && by1 <= b[1] + EPS && by1 + dy > b[1]) dy = b[1] - by1;
  }
  by0 += dy; by1 += dy;
  // X
  for (const b of boxes) {
    if (by1 <= b[1] + EPS || by0 >= b[4] - EPS || bz1 <= b[2] + EPS || bz0 >= b[5] - EPS) continue;
    if (dx < 0 && bx0 >= b[3] - EPS && bx0 + dx < b[3]) dx = b[3] - bx0;
    else if (dx > 0 && bx1 <= b[0] + EPS && bx1 + dx > b[0]) dx = b[0] - bx1;
  }
  bx0 += dx; bx1 += dx;
  // Z
  for (const b of boxes) {
    if (by1 <= b[1] + EPS || by0 >= b[4] - EPS || bx1 <= b[0] + EPS || bx0 >= b[3] - EPS) continue;
    if (dz < 0 && bz0 >= b[5] - EPS && bz0 + dz < b[5]) dz = b[5] - bz0;
    else if (dz > 0 && bz1 <= b[2] + EPS && bz1 + dz > b[2]) dz = b[2] - bz1;
  }
  e.x += dx; e.y += dy; e.z += dz;
  e.hitX = Math.abs(dx - odx) > 1e-6;
  e.hitZ = Math.abs(dz - odz) > 1e-6;
  e.hitY = Math.abs(dy - ody) > 1e-6;
  e.onGround = e.hitY && ody < 0;
  e.groundId = e.onGround ? groundId : 0;
  return [dx, dy, dz];
}

// Does the box at (x,y,z) overlap any solid collision box?
export function boxBlocked(world, x, y, z, hw, h) {
  const boxes = gatherBoxes(world, x - hw, y, z - hw, x + hw, y + h, z + hw, tmp);
  for (const b of boxes) {
    if (x + hw <= b[0] + EPS || x - hw >= b[3] - EPS || y + h <= b[1] + EPS || y >= b[4] - EPS || z + hw <= b[2] + EPS || z - hw >= b[5] - EPS) continue;
    return true;
  }
  return false;
}

// Fluids / climbables / slowdown blocks the box touches.
export function sampleMedium(world, e) {
  const r = { water: 0, lava: 0, climb: false, speed: 1, damage: 0, eyeWater: false, eyeLava: false, soft: false };
  const x0 = Math.floor(e.x - e.hw + 0.001), x1 = Math.floor(e.x + e.hw - 0.001);
  const z0 = Math.floor(e.z - e.hw + 0.001), z1 = Math.floor(e.z + e.hw - 0.001);
  const y0 = Math.floor(e.y + 0.001), y1 = Math.floor(e.y + e.h - 0.001);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const v = world.getBlock(x, y, z);
    const id = v & ID_MASK;
    if (!id) continue;
    const d = BLOCKS[id];
    if (LIQUID[id] === 2) r.lava = 1;
    if (CLIMB[id]) r.climb = true;
    if (d.speed < 1) r.speed = Math.min(r.speed, d.speed);
    if (d.damage && !SOLID[id]) r.damage = Math.max(r.damage, d.damage);
  }
  // submerged fraction, measured on the centre column
  {
    const cx = Math.floor(e.x), cz = Math.floor(e.z);
    let sub = 0;
    for (let y = y0; y <= y1; y++) {
      const v = world.getBlock(cx, y, cz);
      if (LIQUID[v & ID_MASK] !== 1) continue;
      const m = v >>> 10;
      const above = LIQUID[world.getBlock(cx, y + 1, cz) & ID_MASK] === 1;
      const top = y + (above || (m & 8) ? 1 : (m & 7) === 0 ? 0.89 : 0.89 - (m & 7) * 0.11);
      sub += Math.max(0, Math.min(top, e.y + e.h) - Math.max(y, e.y));
    }
    r.water = sub / e.h;
  }
  const below = world.getBlock(Math.floor(e.x), Math.floor(e.y - 0.05), Math.floor(e.z)) & ID_MASK;
  if (BLOCKS[below].softLanding) r.soft = true;
  const ey = e.y + (e.eye || e.h * 0.85);
  const ev = world.getBlock(Math.floor(e.x), Math.floor(ey), Math.floor(e.z));
  const eid = ev & ID_MASK;
  if (LIQUID[eid] === 1) {
    const m = ev >>> 10;
    const top = Math.floor(ey) + ((m & 8) || (m & 7) === 0 ? 0.88 : 0.88 - (m & 7) * 0.11);
    r.eyeWater = ey < top;
  }
  if (LIQUID[eid] === 2) r.eyeLava = true;
  return r;
}

// Is any cactus/magma/campfire touching the entity's box (for contact damage)?
export function contactDamage(world, e) {
  let dmg = 0;
  const x0 = Math.floor(e.x - e.hw - 0.02), x1 = Math.floor(e.x + e.hw + 0.02);
  const z0 = Math.floor(e.z - e.hw - 0.02), z1 = Math.floor(e.z + e.hw + 0.02);
  const y0 = Math.floor(e.y - 0.05), y1 = Math.floor(e.y + e.h);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const id = world.getBlock(x, y, z) & ID_MASK;
    const d = BLOCKS[id];
    if (!d.damage || LIQUID[id]) continue;
    if (d.name === 'magma' && y !== y0) continue;
    if (d.name === 'cactus' || d.name === 'magma' || d.name === 'campfire' || d.name === 'fire') {
      if (d.name === 'campfire' && (world.getBlock(x, y, z) >>> 10) & 8) continue;
      dmg = Math.max(dmg, d.damage);
    }
  }
  return dmg;
}
