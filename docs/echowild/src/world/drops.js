// What a broken block leaves behind.

import { BLOCKS, B, ID_MASK, ID_BITS } from './blocks.js';
import { ITEMS, I, canHarvest } from './items.js';

const n = (spec, rng) => (Array.isArray(spec) ? spec[0] + Math.floor(rng() * (spec[1] - spec[0] + 1)) : spec);

export function blockDrops(v, tool, rng = Math.random) {
  const id = v & ID_MASK, meta = v >>> ID_BITS;
  const d = BLOCKS[id];
  const out = [];
  const tdef = tool && ITEMS[tool.id] && ITEMS[tool.id].tool;
  const shears = tdef && tdef.type === 'shears';
  if (!canHarvest(id, tool)) return out;
  if (d.crop) {
    const ripe = (meta & 7) >= 7;
    const c = d.crop;
    if (c.produce === 'wheat') { if (ripe) out.push({ id: I.wheat, n: 1 }); out.push({ id: I.wheat_seeds, n: ripe ? 1 + Math.floor(rng() * 3) : 1 }); }
    else if (c.fruit) out.push({ id: I.melon_seeds, n: 1 });
    else if (c.produce) out.push({ id: I[c.produce], n: ripe ? 2 + Math.floor(rng() * 3) : 1 });
    return out;
  }
  if (d.shape === 'door' && (meta & 8)) return out;
  if (d.shape === 'slab' && (meta & 3) === 2) { out.push({ id, n: 2 }); return out; }
  if (d.name === 'snow_layer') { out.push({ id: I.snowball, n: (meta & 7) + 1 }); return out; }
  if (d.name === 'berry_bush') { if (meta & 1) out.push({ id: I.berries, n: 2 + Math.floor(rng() * 2) }); out.push({ id }); return out; }
  if (d.name === 'furnace') { out.push({ id }); return out; }
  if (d.name === 'crystal_lamp' || d.name === 'observer') { out.push({ id }); return out; }
  const dr = d.drops;
  if (dr === null) return out;
  if (dr === undefined) { if (d.item) out.push({ id }); return out; }
  if (typeof dr === 'string') { out.push({ id: I[dr], n: 1 }); return out; }
  if (dr.sapling) {
    if (shears) { out.push({ id }); return out; }
    if (rng() < 0.06) out.push({ id: B[dr.sapling], n: 1 });
    if (rng() < 0.03) out.push({ id: I.stick, n: 1 + Math.floor(rng() * 2) });
    if ((d.name === 'oak_leaves' || d.name === 'blossom_leaves') && rng() < 0.02) out.push({ id: I.crabapple, n: 1 });
    return out;
  }
  if (dr.seeds) {
    if (shears) { out.push({ id }); return out; }
    if (rng() < 0.14) {
      const r = rng();
      out.push({ id: r < 0.6 ? I.wheat_seeds : r < 0.8 ? I.melon_seeds : I.sunroot, n: 1 });
    }
    return out;
  }
  if (dr.loot) return out; // handled by the loot system
  if (dr.item) {
    const k = n(dr.n, rng);
    if (k > 0) out.push({ id: I[dr.item], n: k });
    if (dr.extra && rng() < 0.5) out.push({ id: B[dr.extra], n: 1 });
    return out;
  }
  return out;
}
