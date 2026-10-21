// The star layout is deterministic and keeps galaxies apart; the animation registry matches the
// modules that implement it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKnowledgeBase } from '../../scripts/lib/kb.mjs';
import { layout } from '../../scripts/lib/layout.mjs';
import { GALAXIES } from '../../src/config.js';
import { ANIMATIONS } from '../../src/anim/registry.js';
import { MODULES } from '../../src/anim/index.js';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

test('layout is deterministic and every star sits in its own galaxy', () => {
  const kb = loadKnowledgeBase(ROOT);
  const input = { galaxies: GALAXIES, clusters: kb.clusters, nodes: kb.nodes, edges: kb.edges, iterations: 40 };
  const a = layout(input), b = layout(input);
  for (const n of kb.nodes) assert.deepEqual(a.pos.get(n.id), b.pos.get(n.id));
  for (const n of kb.nodes) {
    const [x, y] = a.pos.get(n.id);
    assert.ok(Number.isFinite(x) && Number.isFinite(y), n.id);
    let best = null, bd = Infinity;
    for (const [gid, g] of a.galaxies) { const d = Math.hypot(x - g.x, y - g.y) / g.r; if (d < bd) { bd = d; best = gid; } }
    assert.equal(best, n.galaxy, `${n.id} drifted into ${best}`);
  }
});

test('animation registry and modules agree', () => {
  assert.deepEqual(MODULES.map((m) => m.id).sort(), ANIMATIONS.map((a) => a.id).sort());
  for (const m of MODULES) {
    assert.equal(typeof m.mount, 'function', m.id);
    assert.equal(m.title, ANIMATIONS.find((a) => a.id === m.id).title, m.id);
  }
});
