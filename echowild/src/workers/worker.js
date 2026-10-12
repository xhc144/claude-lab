// Worker entry: terrain generation, initial lighting and section meshing off the main thread.

import { WorldGen } from '../world/gen/worldgen.js';
import { lightChunk } from '../world/light.js';
import { meshSection } from '../render/mesher.js';

let gen = null;

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      gen = new WorldGen(m.seed);
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'gen') {
      const r = gen.generate(m.cx, m.cz);
      const light = new Uint16Array(65536);
      lightChunk(r.blocks, light);
      self.postMessage({ type: 'gen', id: m.id, cx: m.cx, cz: m.cz, blocks: r.blocks, light, biomes: r.biomes, heights: r.heights, tints: r.tints, features: r.features },
        [r.blocks.buffer, light.buffer, r.biomes.buffer, r.heights.buffer, r.tints.buffer]);
    } else if (m.type === 'relight') {
      const light = new Uint16Array(65536);
      lightChunk(m.blocks, light);
      self.postMessage({ type: 'relight', id: m.id, cx: m.cx, cz: m.cz, blocks: m.blocks, light }, [m.blocks.buffer, light.buffer]);
    } else if (m.type === 'mesh') {
      const r = meshSection(m.blocks, m.light, m.tints, m.sy);
      self.postMessage({ type: 'mesh', id: m.id, key: m.key, sy: m.sy, version: m.version, opaque: r.opaque, trans: r.trans },
        [r.opaque.buf, r.trans.buf]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err && err.stack || err) });
  }
};
