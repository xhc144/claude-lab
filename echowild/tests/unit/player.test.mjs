// Player movement against walls, ledges, slabs and stairs on a headless flat world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, GROUND } from './harness.mjs';
import { Player } from '../../src/entity/player.js';
import { B, pack } from '../../src/world/blocks.js';

function setup(build) {
  const w = makeWorld(1);
  build(w);
  const game = { world: w, canFly: () => false, hasGlider: () => false, settings: { difficulty: 2 }, audio: null };
  const p = new Player(game);
  p.x = 0.5; p.z = 0.5; p.y = GROUND; p.yaw = -Math.PI / 2; // facing +x
  return p;
}
// hold the given keys for n frames at 60 fps (120 Hz physics substeps, like the game)
function hold(p, frames, keys, each) {
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < 2; i++) p.update(1 / 120, { fwd: 0, strafe: 0, jump: false, sneak: false, sprint: false, jumpPressed: false, flyToggle: false, ...keys });
    if (each) each(p, f);
  }
}

test('holding forward + jump against a wall gives full jumps, not a jitter', () => {
  const p = setup((w) => { for (let z = -4; z <= 4; z++) for (let h = 0; h < 3; h++) w.setBlock(2, GROUND + h, z, B.stone); });
  hold(p, 30, { fwd: 1 }); // walk up to the wall
  assert.ok(Math.abs(p.x - 1.7) < 0.01, 'pressed against the wall');
  let maxY = 0, landings = 0, wasGround = true;
  hold(p, 180, { fwd: 1, jump: true }, (pl) => {
    maxY = Math.max(maxY, pl.y - GROUND);
    if (pl.onGround && !wasGround) landings++;
    wasGround = pl.onGround;
  });
  assert.ok(maxY > 1.1, `jump apex ${maxY.toFixed(3)} blocks`);
  assert.ok(landings <= 5, `${landings} landings in 3 s (each jump lasts ~0.6 s; a jitter lands every few frames)`);
});

test('forward + jump climbs onto a one-block ledge', () => {
  const p = setup((w) => { for (let z = -4; z <= 4; z++) for (let x = 2; x <= 6; x++) w.setBlock(x, GROUND, z, B.stone); });
  hold(p, 30, { fwd: 1 });
  hold(p, 60, { fwd: 1, jump: true });
  assert.ok(p.x > 2.5 && p.y >= GROUND + 1 - 1e-6, `on the ledge (x ${p.x.toFixed(2)}, y ${(p.y - GROUND).toFixed(2)})`);
});

test('walking steps up slabs and stairs without jumping', () => {
  const p = setup((w) => {
    for (let z = -4; z <= 4; z++) {
      w.setBlock(2, GROUND, z, pack(B.stone_bricks_slab, 0));
      w.setBlock(3, GROUND, z, pack(B.stone_bricks_stairs, 3)); // rising toward +x
      w.setBlock(4, GROUND, z, B.stone_bricks);
      w.setBlock(5, GROUND, z, B.stone_bricks);
      w.setBlock(5, GROUND + 1, z, pack(B.stone_bricks_stairs, 3));
      for (let x = 6; x <= 9; x++) { w.setBlock(x, GROUND, z, B.stone_bricks); w.setBlock(x, GROUND + 1, z, B.stone_bricks); }
    }
  });
  let f = 0;
  while (p.x < 7.5 && f++ < 240) hold(p, 1, { fwd: 1 });
  hold(p, 10, {}); // stop and settle
  assert.ok(p.x > 7, `walked up the steps (x ${p.x.toFixed(2)})`);
  assert.ok(Math.abs(p.y - (GROUND + 2)) < 1e-6, `standing on top (y ${(p.y - GROUND).toFixed(2)})`);
});
