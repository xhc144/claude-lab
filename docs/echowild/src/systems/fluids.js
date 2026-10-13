// Flowing water and lava (levels 0..7, falling bit), their meeting, and blocks that fall (sand,
// gravel) or rise (levistone).

import { BLOCKS, B, ID_MASK, ID_BITS, LIQUID, SOLID, REPLACEABLE, GRAVITY, pack } from '../world/blocks.js';
import { FallingBlock } from '../entity/entities.js';
import { blockDrops } from '../world/drops.js';
import { hasSupport } from '../world/placement.js';

const HDIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function installFluids(game) {
  const w = game.world;
  const RATE = { 1: 5, 2: 28 };
  const STEP = { 1: 1, 2: 2 };

  const isLiquid = (v, kind) => LIQUID[v & ID_MASK] === kind;
  const levelOf = (v) => (v >>> ID_BITS) & 7;
  const fallingOf = (v) => ((v >>> ID_BITS) & 8) !== 0;
  const canFlowInto = (v) => {
    const id = v & ID_MASK;
    if (id === 0) return true;
    if (LIQUID[id]) return false;
    return REPLACEABLE[id] && !SOLID[id];
  };

  function schedule(x, y, z, kind) {
    const deep = kind === 2 && y < 40;
    w.schedule(x, y, z, deep ? 10 : RATE[kind]);
  }

  // the cell's liquid changed: wake it and its neighbours
  function wake(x, y, z) {
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const v = w.getBlock(x + dx, y + dy, z + dz);
      const k = LIQUID[v & ID_MASK];
      if (k) schedule(x + dx, y + dy, z + dz, k);
    }
  }

  // Water meets lava
  function react(x, y, z, kind) {
    const v = w.getBlock(x, y, z);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const n = w.getBlock(x + dx, y + dy, z + dz);
      if (kind === 2 && LIQUID[n & ID_MASK] === 1 && dy !== -1) {
        // water touches this lava cell
        const result = levelOf(v) === 0 && !fallingOf(v) ? B.obsidian : B.cobblestone;
        w.setBlock(x, y, z, result);
        fizz(x, y, z);
        return true;
      }
    }
    return false;
  }
  function fizz(x, y, z) {
    game.audio && game.audio.play('fizz', { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (game.particles) game.particles.smoke(x + 0.5, y + 1, z + 0.5, 6);
  }

  function tickLiquid(world, x, y, z, v) {
    const kind = LIQUID[v & ID_MASK];
    const id = v & ID_MASK;
    if (react(x, y, z, kind)) return;
    let level = levelOf(v);
    const falling = fallingOf(v);
    const step = STEP[kind];
    // 1) recompute non-source levels from what feeds them
    if (level !== 0 || falling) {
      const above = w.getBlock(x, y + 1, z);
      let newLevel = 99, newFalling = false;
      if (isLiquid(above, kind)) { newLevel = 1; newFalling = true; }
      else {
        let sources = 0;
        for (const [dx, dz] of HDIRS) {
          const n = w.getBlock(x + dx, y, z + dz);
          if (!isLiquid(n, kind)) continue;
          const nl = levelOf(n), nf = fallingOf(n);
          if (nl === 0 && !nf) sources++;
          // a falling column spreads like a source where it lands
          const eff = nf ? 0 : nl;
          newLevel = Math.min(newLevel, eff + step);
        }
        const below = w.getBlock(x, y - 1, z);
        if (kind === 1 && sources >= 2 && (SOLID[below & ID_MASK] || (isLiquid(below, 1) && levelOf(below) === 0))) { newLevel = 0; }
      }
      if (newLevel > 7) { w.setBlock(x, y, z, 0); wake(x, y, z); return; }
      if (newLevel !== level || newFalling !== falling) {
        w.setBlock(x, y, z, pack(id, newLevel | (newFalling ? 8 : 0)), { notify: false });
        wake(x, y, z);
        level = newLevel;
      }
    }
    // 2) flow down
    const by = y - 1;
    const below = w.getBlock(x, by, z);
    if (by >= 0 && LIQUID[below & ID_MASK] && LIQUID[below & ID_MASK] !== kind) {
      // lava below water -> stone ; water above lava source -> obsidian handled by lava's tick
      if (kind === 1 && LIQUID[below & ID_MASK] === 2) { w.setBlock(x, by, z, levelOf(below) === 0 ? B.obsidian : B.stone); fizz(x, by, z); return; }
      if (kind === 2 && LIQUID[below & ID_MASK] === 1) { w.setBlock(x, by, z, B.stone); fizz(x, by, z); return; }
    }
    if (by >= 0 && (canFlowInto(below) || (isLiquid(below, kind) && levelOf(below) !== 0 && !fallingOf(below)))) {
      breakFor(x, by, z, below);
      w.setBlock(x, by, z, pack(id, 1 | 8));
      wake(x, by, z);
      return;
    }
    // 3) spread sideways (only when standing on something)
    if (level >= 7 && !(level === 0)) return;
    const next = (falling ? 0 : level) + step;
    if (next > 7) return;
    // prefer directions leading to a nearby drop
    const dirs = preferredDirs(x, y, z, kind);
    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      if (!w.isLoaded(nx, nz)) continue;
      const n = w.getBlock(nx, y, nz);
      if (LIQUID[n & ID_MASK] && LIQUID[n & ID_MASK] !== kind) {
        if (kind === 1) { w.setBlock(nx, y, nz, levelOf(n) === 0 ? B.obsidian : B.cobblestone); fizz(nx, y, nz); }
        continue;
      }
      if (canFlowInto(n)) {
        breakFor(nx, y, nz, n);
        w.setBlock(nx, y, nz, pack(id, next));
        schedule(nx, y, nz, kind);
      } else if (isLiquid(n, kind) && !fallingOf(n) && levelOf(n) > next) {
        w.setBlock(nx, y, nz, pack(id, next), { notify: false });
        schedule(nx, y, nz, kind);
      }
    }
  }

  function breakFor(x, y, z, v) {
    const id = v & ID_MASK;
    if (!id || LIQUID[id]) return;
    for (const s of blockDrops(v, null)) game.entities.spawnItem(x + 0.5, y + 0.5, z + 0.5, s);
  }

  // directions toward the closest edge within 4 blocks; all equally good directions are kept
  function preferredDirs(x, y, z, kind) {
    let best = 99;
    const scores = HDIRS.map(([dx, dz]) => {
      let d = 99;
      for (let k = 1; k <= 4; k++) {
        const cx = x + dx * k, cz = z + dz * k;
        const c = w.getBlock(cx, y, cz);
        if (!canFlowInto(c) && !isLiquid(c, kind)) break;
        const b = w.getBlock(cx, y - 1, cz);
        if (canFlowInto(b) || (isLiquid(b, kind))) { d = k; break; }
      }
      best = Math.min(best, d);
      return d;
    });
    if (best === 99) return HDIRS;
    return HDIRS.filter((_, i) => scores[i] === best);
  }

  for (const id of [B.water, B.lava]) {
    w.handlers.tick[id] = tickLiquid;
    w.handlers.neighbor[id] = (world, x, y, z, v) => schedule(x, y, z, LIQUID[v & ID_MASK]);
    w.handlers.place[id] = (world, x, y, z, v) => schedule(x, y, z, LIQUID[v & ID_MASK]);
  }
  // breaking a block next to liquid lets it flow: the neighbour handler covers that.

  // ---- gravity: sand & gravel fall, levistone rises
  const gravityCheck = (world, x, y, z, v) => {
    const id = v & ID_MASK;
    const dir = GRAVITY[id];
    if (!dir) return;
    const ny = y - dir;
    const n = w.getBlock(x, ny, z);
    if (ny >= 0 && ny <= 255 && (canFlowInto(n) || LIQUID[n & ID_MASK])) w.schedule(x, y, z, 2);
  };
  for (let id = 0; id < BLOCKS.length; id++) {
    if (!GRAVITY[id]) continue;
    w.handlers.neighbor[id] = gravityCheck;
    w.handlers.place[id] = gravityCheck;
    w.handlers.tick[id] = (world, x, y, z, v) => {
      const dir = GRAVITY[v & ID_MASK];
      const n = w.getBlock(x, y - dir, z);
      if (!(canFlowInto(n) || LIQUID[n & ID_MASK])) return;
      w.setBlock(x, y, z, 0);
      const e = new FallingBlock(v);
      e.setPos(x + 0.5, y, z + 0.5);
      game.entities.add(e);
    };
  }

  // ---- support: plants, torches, rails… pop off when what holds them disappears
  const supportCheck = (world, x, y, z, v) => {
    if (hasSupport(w, x, y, z, v)) return;
    const id = v & ID_MASK;
    w.setBlock(x, y, z, 0);
    for (const s of blockDrops(v, null)) game.entities.spawnItem(x + 0.5, y + 0.3, z + 0.5, s);
    void id;
  };
  for (const d of BLOCKS) {
    if (['cross', 'crop', 'torch', 'wallflat', 'lever', 'button', 'lantern', 'wire', 'rail', 'plate', 'carpet', 'repeater', 'door', 'layer', 'flat', 'cactus', 'vine'].includes(d.shape) || d.name === 'inverter') {
      const prev = w.handlers.neighbor[d.id];
      w.handlers.neighbor[d.id] = prev ? (world, x, y, z, v, sx, sy, sz) => { prev(world, x, y, z, v, sx, sy, sz); if (w.getBlock(x, y, z) === v) supportCheck(world, x, y, z, v); } : supportCheck;
    }
  }
  game.fluidWake = wake;
}
