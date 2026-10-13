// A headless world for unit tests: flat chunks, real World/LightEngine, real block systems,
// and a minimal stand-in for the Game object (no rendering, audio or DOM).
import { World } from '../../src/world/world.js';
import { Chunk } from '../../src/world/chunk.js';
import { lightChunk } from '../../src/world/light.js';
import { B } from '../../src/world/blocks.js';

export const GROUND = 10; // top solid layer is y = GROUND - 1

export function flatChunk(cx, cz, ground = GROUND, fill = B.stone) {
  const c = new Chunk(cx, cz);
  c.blocks = new Uint16Array(65536);
  c.light = new Uint16Array(65536);
  c.biomes = new Uint8Array(256).fill(2);
  c.heights = new Uint8Array(256).fill(ground - 1);
  c.tints = new Uint32Array(768).fill(0x79c05a);
  for (let y = 0; y < ground; y++) for (let i = 0; i < 256; i++) c.blocks[(y << 8) | i] = y === 0 ? B.bedrock ?? fill : fill;
  lightChunk(c.blocks, c.light);
  return c;
}

// a world of (2r+1)² flat chunks around the origin
export function makeWorld(r = 1, seed = 1) {
  const w = new World(seed);
  for (let cz = -r; cz <= r; cz++) for (let cx = -r; cx <= r; cx++) w.addChunk(flatChunk(cx, cz));
  return w;
}

export function makeGame(world = makeWorld()) {
  const listeners = {};
  const g = {
    world, systems: [], ticks: 0,
    player: { x: 0.5, y: 200, z: 0.5, dead: true, creative: false, onGround: false },
    entities: { list: [], add(e) { this.list.push(e); }, spawnItem() {}, near() { return []; } },
    settings: { difficulty: 2, renderDist: 2 },
    chunks: { onChunkLoaded: [], onChunkUnload: [] },
    sky: { daylight: 1 }, audio: null, particles: null,
    addSystem(s) { this.systems.push(s); return s; },
    on(ev, f) { (listeners[ev] ||= []).push(f); },
    emit(ev, ...a) { for (const f of listeners[ev] || []) f(...a); },
    tick() {
      this.ticks++; world.time++;
      world.runScheduled();
      for (const s of this.systems) if (s.tick) s.tick(this);
    },
    run(n) { for (let i = 0; i < n; i++) this.tick(); },
  };
  return g;
}
