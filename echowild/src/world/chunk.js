// A 16×256×16 column of cells. Index = (y << 8) | (z << 4) | x.

export const CHUNK = 16;
export const HEIGHT = 256;
export const SECTIONS = 16;
export const cidx = (x, y, z) => (y << 8) | (z << 4) | x;
export const ckey = (cx, cz) => ((cx & 0xffff) << 16) | (cz & 0xffff);
export const keyCX = (k) => (k >> 16);
export const keyCZ = (k) => ((k << 16) >> 16);

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.key = ckey(cx, cz);
    this.blocks = null;      // Uint16Array(65536)
    this.light = null;       // Uint16Array(65536)
    this.biomes = null;      // Uint8Array(256)
    this.heights = null;     // Uint8Array(256) highest non-air y
    this.tints = null;       // Uint32Array(768) grass, foliage, water (0xRRGGBB)
    this.ready = false;      // data present and lit
    this.modified = false;   // differs from the generator output (needs saving)
    this.blockEntities = new Map(); // cell index -> object (chests, furnaces…)
    this.savedEntities = null;      // entities restored from disk, spawned once
    this.meshes = new Array(SECTIONS).fill(null);   // renderer handles per section
    this.dirty = new Uint8Array(SECTIONS);          // section needs (re)meshing
    this.meshing = new Uint8Array(SECTIONS);        // request in flight
    this.meshVersion = new Uint32Array(SECTIONS);
    this.nonEmpty = new Uint8Array(SECTIONS);       // section has any non-air cell
    this.lastSeen = 0;
    this.features = [];
    this.minY = 0; this.maxY = 255;
  }

  get(x, y, z) { return this.blocks[(y << 8) | (z << 4) | x]; }

  computeNonEmpty() {
    const b = this.blocks;
    for (let s = 0; s < SECTIONS; s++) {
      let any = 0;
      const start = s << 12, end = start + 4096;
      for (let i = start; i < end; i++) if (b[i]) { any = 1; break; }
      this.nonEmpty[s] = any;
    }
  }

  updateHeight(x, z) {
    const b = this.blocks;
    let y = 255;
    while (y > 0 && !b[(y << 8) | (z << 4) | x]) y--;
    this.heights[(z << 4) | x] = y;
  }
}
