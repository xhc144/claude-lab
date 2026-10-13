// Resonance signals (0..15). Wires form networks whose levels are recomputed as a whole whenever
// something nearby changes; sources and logic parts are evaluated on scheduled ticks so feedback
// loops (clocks) work and never recurse. Solid blocks can be "strongly" powered (by a lever on them,
// a repeater or inverter pointing into them), which also powers adjacent wires, or "weakly" powered
// by a wire, which only drives devices.

import { BLOCKS, B, ID_MASK, ID_BITS, OPAQUE, SOLID, pack, OPPOSITE } from '../world/blocks.js';
import { FACE_N } from '../world/placement.js';

const F4_TO_FACE = [5, 1, 4, 0]; // facing4 (n w s e) -> face index
const DEVICES = new Set();

export function installCircuits(game) {
  const w = game.world;
  const id = (x, y, z) => w.getBlock(x, y, z) & ID_MASK;
  const meta = (x, y, z) => w.getBlock(x, y, z) >>> ID_BITS;
  const C = {}; // circuit api

  // ---------------------------------------------------------------- what a block emits
  // power the cell (x,y,z) sends toward face f (from it into its neighbour), 0..15.
  function emitted(x, y, z, f, forWire) {
    const v = w.getBlock(x, y, z);
    const bid = v & ID_MASK, m = v >>> ID_BITS;
    switch (bid) {
      case B.lever: case B.button: return (m & 8) ? 15 : 0;
      case B.power_block: return 15;
      case B.pressure_plate: return (m & 1) ? 15 : 0;
      case B.daylight_sensor: return m & 15;
      case B.inverter: {
        if (m & 8) return 0;
        const att = m & 7; // 0 floor, 1..4 wall facing4+1
        const attFace = att === 0 ? 3 : F4_TO_FACE[att - 1];
        return f === attFace ? 0 : 15;
      }
      case B.repeater: return (m & 16) && f === F4_TO_FACE[m & 3] ? 15 : 0;
      case B.observer: return (m & 8) && f === OPPOSITE[m & 7] ? 15 : 0;
      case B.wire: return forWire ? 0 : (f === 2 ? 0 : m & 15);
      default:
        if (OPAQUE[bid]) { const s = strongPower(x, y, z); return forWire ? s : Math.max(s, weakPower(x, y, z)); }
        return 0;
    }
  }
  // opaque block powered by something attached to / pointing into it
  function strongPower(x, y, z) {
    let p = 0;
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = FACE_N[f];
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const v = w.getBlock(nx, ny, nz), bid = v & ID_MASK, m = v >>> ID_BITS;
      const toMe = OPPOSITE[f]; // direction from neighbour toward me
      if ((bid === B.lever || bid === B.button) && (m & 8) && (m & 7) === toMe) p = 15;
      else if (bid === B.repeater && (m & 16) && F4_TO_FACE[m & 3] === toMe) p = 15;
      else if (bid === B.inverter && !(m & 8) && toMe === 2) p = 15; // inverter strongly powers the block above it
      else if (bid === B.observer && (m & 8) && OPPOSITE[m & 7] === toMe) p = 15;
      if (p === 15) return 15;
    }
    return p;
  }
  function weakPower(x, y, z) {
    let p = 0;
    const up = w.getBlock(x, y + 1, z);
    if ((up & ID_MASK) === B.wire) p = Math.max(p, up >>> ID_BITS & 15);
    for (const f of [0, 1, 4, 5]) {
      const [dx, , dz] = FACE_N[f];
      const v = w.getBlock(x + dx, y, z + dz);
      if ((v & ID_MASK) === B.wire) p = Math.max(p, (v >>> ID_BITS) & 15);
    }
    return p;
  }
  // power arriving at a device cell from any side
  function inputPower(x, y, z, except = -1) {
    let p = 0;
    for (let f = 0; f < 6; f++) {
      if (f === except) continue;
      const [dx, dy, dz] = FACE_N[f];
      p = Math.max(p, emitted(x + dx, y + dy, z + dz, OPPOSITE[f], false));
      if (p === 15) break;
    }
    return p;
  }
  C.inputPower = inputPower;
  C.isPowered = (x, y, z) => inputPower(x, y, z) > 0;

  // ---------------------------------------------------------------- wire networks
  const WIRE_DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  function wireNeighbours(x, y, z) {
    const out = [];
    const aboveOpen = !OPAQUE[id(x, y + 1, z)];
    for (const [dx, dz] of WIRE_DIRS) {
      const nx = x + dx, nz = z + dz;
      const s = id(nx, y, nz);
      if (s === B.wire) out.push([nx, y, nz]);
      else if (aboveOpen && OPAQUE[s] && id(nx, y + 1, nz) === B.wire) out.push([nx, y + 1, nz]);
      if (!OPAQUE[s] && id(nx, y - 1, nz) === B.wire && !OPAQUE[id(nx, y, nz)]) out.push([nx, y - 1, nz]);
    }
    return out;
  }
  function wireInput(x, y, z) {
    let p = 0;
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = FACE_N[f];
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (id(nx, ny, nz) === B.wire) continue;
      p = Math.max(p, emitted(nx, ny, nz, OPPOSITE[f], true));
      if (p === 15) break;
    }
    return p;
  }
  let applying = false;
  function updateNetwork(sx, sy, sz) {
    const key = (x, y, z) => `${x},${y},${z}`;
    const nodes = new Map();
    const stack = [[sx, sy, sz]];
    while (stack.length && nodes.size < 3000) {
      const [x, y, z] = stack.pop();
      const k = key(x, y, z);
      if (nodes.has(k)) continue;
      if (id(x, y, z) !== B.wire) continue;
      nodes.set(k, { x, y, z, lvl: 0, nb: wireNeighbours(x, y, z) });
      for (const n of nodes.get(k).nb) stack.push(n);
    }
    // seed with external inputs, then flood like light
    const queue = [];
    for (const n of nodes.values()) { n.lvl = wireInput(n.x, n.y, n.z); if (n.lvl > 0) queue.push(n); }
    queue.sort((a, b) => b.lvl - a.lvl);
    for (let qi = 0; qi < queue.length; qi++) {
      const n = queue[qi];
      for (const [x, y, z] of n.nb) {
        const m = nodes.get(key(x, y, z));
        if (m && m.lvl < n.lvl - 1) { m.lvl = n.lvl - 1; queue.push(m); }
      }
    }
    applying = true;
    const changed = [];
    for (const n of nodes.values()) {
      const cur = meta(n.x, n.y, n.z) & 15;
      if (cur !== n.lvl) { w.setBlock(n.x, n.y, n.z, pack(B.wire, n.lvl), { notify: false }); changed.push(n); }
    }
    applying = false;
    for (const n of changed) wakeAround(n.x, n.y, n.z, true);
    return nodes;
  }

  // schedule evaluation of every circuit part within reach of a changed cell
  function wakeAround(x, y, z, skipWires = false) {
    for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
      const bid = id(x + dx, y + dy, z + dz);
      if (bid === B.wire && skipWires) continue;
      if (DEVICES.has(bid)) w.schedule(x + dx, y + dy, z + dz, bid === B.wire ? 1 : 1);
    }
  }
  C.wakeAround = wakeAround;

  // ---------------------------------------------------------------- registration helpers
  const onChange = (bid, fn, delay = 1) => {
    DEVICES.add(bid);
    const prevN = w.handlers.neighbor[bid];
    w.handlers.neighbor[bid] = (world, x, y, z, v, sx, sy, sz) => { if (prevN) prevN(world, x, y, z, v, sx, sy, sz); if (!applying && id(x, y, z) === bid) w.schedule(x, y, z, typeof delay === 'function' ? delay(v) : delay); };
    const prevP = w.handlers.place[bid];
    w.handlers.place[bid] = (world, x, y, z, v, old) => { if (prevP) prevP(world, x, y, z, v, old); w.schedule(x, y, z, 1); wakeAround(x, y, z); };
    const prevR = w.handlers.remove[bid];
    w.handlers.remove[bid] = (world, x, y, z, v, nv) => { if (prevR) prevR(world, x, y, z, v, nv); setTimeout(() => wakeAround(x, y, z), 0); };
    w.handlers.tick[bid] = fn;
  };

  // wires
  onChange(B.wire, (world, x, y, z) => updateNetwork(x, y, z));
  // any block placed or removed next to circuitry may change power paths
  w.globalNeighbor.push((world, x, y, z, old, v) => {
    if (applying) return;
    const oi = old & ID_MASK, ni = v & ID_MASK;
    if (OPAQUE[oi] !== OPAQUE[ni] || DEVICES.has(oi) || DEVICES.has(ni)) wakeAround(x, y, z);
  });

  // sources -----------------------------------------------------------
  for (const bid of [B.lever, B.button, B.pressure_plate, B.power_block]) onChange(bid, (world, x, y, z, v) => {
    const m = v >>> ID_BITS;
    if (bid === B.button && (m & 8)) { w.setBlock(x, y, z, pack(bid, m & ~8)); game.audio && game.audio.play('click', { x, y, z }); wakeAround(x, y, z); wakeAttached(x, y, z, m & 7); return; }
    if (bid === B.pressure_plate && (m & 1)) {
      if (!C.somethingOn(x, y, z)) { w.setBlock(x, y, z, pack(bid, 0)); game.audio && game.audio.play('click', { x, y, z }); wakeAround(x, y, z); wakeAround(x, y - 1, z); }
      else w.schedule(x, y, z, 10);
    }
  });
  function wakeAttached(x, y, z, face) { const [dx, dy, dz] = FACE_N[face]; wakeAround(x + dx, y + dy, z + dz); }
  C.toggleLever = (x, y, z) => {
    const v = w.getBlock(x, y, z), m = v >>> ID_BITS;
    w.setBlock(x, y, z, pack(B.lever, m ^ 8));
    game.audio && game.audio.play('lever', { x, y, z, pitch: m & 8 ? 0.8 : 1.2 });
    wakeAround(x, y, z); wakeAttached(x, y, z, m & 7);
  };
  C.pressButton = (x, y, z) => {
    const v = w.getBlock(x, y, z), m = v >>> ID_BITS;
    if (m & 8) return;
    w.setBlock(x, y, z, pack(B.button, m | 8));
    game.audio && game.audio.play('click', { x, y, z });
    wakeAround(x, y, z); wakeAttached(x, y, z, m & 7);
    w.schedule(x, y, z, 20);
  };
  C.somethingOn = (x, y, z) => {
    const p = game.player;
    if (!p.dead && Math.floor(p.x) === x && Math.floor(p.z) === z && p.y >= y && p.y < y + 0.6) return true;
    return game.entities.list.some((e) => !e.dead && e.type !== 'projectile' && Math.floor(e.x) === x && Math.floor(e.z) === z && e.y >= y && e.y < y + 0.6);
  };

  // pressure plates react to whatever stands on them
  game.addSystem({
    tick(g) {
      const check = (ex, ey, ez) => {
        const x = Math.floor(ex), y = Math.floor(ey + 0.05), z = Math.floor(ez);
        const v = w.getBlock(x, y, z);
        if ((v & ID_MASK) === B.pressure_plate && !((v >>> ID_BITS) & 1)) {
          w.setBlock(x, y, z, pack(B.pressure_plate, 1));
          g.audio && g.audio.play('click', { x, y, z, pitch: 1.2 });
          wakeAround(x, y, z); wakeAround(x, y - 1, z);
          w.schedule(x, y, z, 10);
        }
      };
      if (!g.player.dead && g.player.onGround) check(g.player.x, g.player.y, g.player.z);
      for (const e of g.entities.list) if (!e.dead && e.onGround && e.type !== 'projectile') check(e.x, e.y, e.z);
    },
  });

  // daylight sensors refresh every second
  onChange(B.daylight_sensor, (world, x, y, z, v) => {
    const sky = w.skyLight(x, y + 1, z);
    const dl = game.sky ? game.sky.daylight : 1;
    let lvl = Math.round(sky * dl);
    if ((v >>> ID_BITS) & 16) lvl = 15 - lvl; // inverted mode
    lvl = Math.max(0, Math.min(15, lvl));
    if (((v >>> ID_BITS) & 15) !== lvl) { w.setBlock(x, y, z, pack(B.daylight_sensor, ((v >>> ID_BITS) & 16) | lvl), { notify: false }); wakeAround(x, y, z); wakeAround(x, y - 1, z); }
    w.schedule(x, y, z, 20);
  });

  // logic -------------------------------------------------------------
  const inverterAttached = (x, y, z, m) => {
    const att = m & 7;
    const f = att === 0 ? 3 : F4_TO_FACE[att - 1];
    const [dx, dy, dz] = FACE_N[f];
    return [x + dx, y + dy, z + dz];
  };
  const burnout = new Map();
  onChange(B.inverter, (world, x, y, z, v) => {
    const m = v >>> ID_BITS;
    const [ax, ay, az] = inverterAttached(x, y, z, m);
    // power in the attached block, ignoring what this inverter itself provides
    let p = 0;
    const av = w.getBlock(ax, ay, az), aid = av & ID_MASK;
    if (OPAQUE[aid]) {
      for (let f = 0; f < 6; f++) {
        const [dx, dy, dz] = FACE_N[f];
        const nx = ax + dx, ny = ay + dy, nz = az + dz;
        if (nx === x && ny === y && nz === z) continue;
        p = Math.max(p, emitted(nx, ny, nz, OPPOSITE[f], false));
      }
    } else p = emitted(ax, ay, az, -1, false);
    const off = p > 0;
    if (off !== !!(m & 8)) {
      // burn-out protection against too-fast clocks
      const k = `${x},${y},${z}`, now = w.time;
      const hist = (burnout.get(k) || []).filter((t) => now - t < 60);
      hist.push(now); burnout.set(k, hist);
      if (hist.length > 12 && !off) { w.schedule(x, y, z, 100); game.particles && game.particles.smoke(x + 0.5, y + 0.8, z + 0.5, 3, true); return; }
      w.setBlock(x, y, z, pack(B.inverter, off ? m | 8 : m & ~8));
      wakeAround(x, y, z); wakeAround(x, y + 1, z);
    }
  }, 2);

  onChange(B.repeater, (world, x, y, z, v) => {
    const m = v >>> ID_BITS;
    const out = F4_TO_FACE[m & 3], back = OPPOSITE[out];
    const [dx, dy, dz] = FACE_N[back];
    let p = emitted(x + dx, y + dy, z + dz, out, false);
    if (id(x + dx, y + dy, z + dz) === B.wire) p = Math.max(p, meta(x + dx, y + dy, z + dz) & 15);
    const on = p > 0;
    if (on !== !!(m & 16)) {
      w.setBlock(x, y, z, pack(B.repeater, on ? m | 16 : m & ~16));
      const [fx, fy, fz] = FACE_N[out];
      wakeAround(x + fx, y + fy, z + fz); wakeAround(x, y, z);
    }
  }, (v) => 2 * ((((v >>> ID_BITS) >> 2) & 3) + 1));

  // observers fire a short pulse when the block they watch changes
  onChange(B.observer, (world, x, y, z, v) => {
    const m = v >>> ID_BITS;
    if (m & 8) {
      w.setBlock(x, y, z, pack(B.observer, m & ~8), { notify: false });
      const [bx, by, bz] = FACE_N[OPPOSITE[m & 7]];
      wakeAround(x + bx, y + by, z + bz); wakeAround(x, y, z);
    }
  });
  w.handlers.neighbor[B.observer] = () => {}; // observers only care about their front, via the global hook
  w.globalNeighbor.push((world, x, y, z, old, v) => {
    if (applying || (old & ID_MASK) === (v & ID_MASK) && ((old ^ v) >>> ID_BITS) === 0) return;
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = FACE_N[f];
      const ox = x + dx, oy = y + dy, oz = z + dz;
      const ov = w.getBlock(ox, oy, oz);
      if ((ov & ID_MASK) !== B.observer) continue;
      const om = ov >>> ID_BITS;
      // the observer's front faces back toward (x,y,z)?
      if ((om & 7) !== OPPOSITE[f] || (om & 8)) continue;
      setTimeout(() => {
        const cur = w.getBlock(ox, oy, oz);
        if ((cur & ID_MASK) !== B.observer || (cur >>> ID_BITS) & 8) return;
        w.setBlock(ox, oy, oz, pack(B.observer, (cur >>> ID_BITS) | 8), { notify: false });
        const [bx, by, bz] = FACE_N[OPPOSITE[om & 7]];
        wakeAround(ox + bx, oy + by, oz + bz); wakeAround(ox, oy, oz);
        w.schedule(ox, oy, oz, 2);
      }, 0);
    }
  });

  // simple devices ---------------------------------------------------
  // device(bid, fn(x,y,z,v,powered,wasPowered)) — wasPowered kept in a meta bit given by `bit`
  C.device = (bid, bit, fn) => {
    onChange(bid, (world, x, y, z, v) => {
      const m = v >>> ID_BITS;
      const p = inputPower(x, y, z) > 0;
      const was = (m & bit) !== 0;
      if (p !== was) fn(x, y, z, v, p, was, m);
    });
  };
  C.device(B.crystal_lamp, 1, (x, y, z, v, p, was, m) => w.setBlock(x, y, z, pack(B.crystal_lamp, p ? m | 1 : m & ~1)));
  for (const bid of [B.oak_door, B.iron_door]) C.device(bid, 4, (x, y, z, v, p, was, m) => {
    const upper = m & 8;
    const by = upper ? y - 1 : y;
    const lower = w.getBlock(x, by, z) >>> ID_BITS;
    const top = w.getBlock(x, by + 1, z) >>> ID_BITS;
    w.setBlock(x, by, z, pack(bid, p ? lower | 4 : lower & ~4), { notify: false });
    if ((w.getBlock(x, by + 1, z) & ID_MASK) === bid) w.setBlock(x, by + 1, z, pack(bid, p ? top | 4 : top & ~4), { notify: false });
    game.audio && game.audio.play(p ? 'door_open' : 'door_close', { x, y, z });
  });
  for (const bid of [B.trapdoor, B.oak_gate]) C.device(bid, 4, (x, y, z, v, p, was, m) => { w.setBlock(x, y, z, pack(bid, p ? m | 4 : m & ~4)); game.audio && game.audio.play(p ? 'door_open' : 'door_close', { x, y, z }); });
  C.device(B.note_block, 32, (x, y, z, v, p, was, m) => {
    w.setBlock(x, y, z, pack(B.note_block, p ? m | 32 : m & ~32), { notify: false });
    if (p) C.playNote(x, y, z);
  });
  C.device(B.blast_barrel, 32, (x, y, z, v, p) => { if (p) game.ignite(x, y, z); });

  C.playNote = (x, y, z) => {
    const m = meta(x, y, z) & 31;
    const below = BLOCKS[id(x, y - 1, z)];
    const inst = below.sound === 'wood' ? 'bass' : below.sound === 'stone' ? 'drum' : below.sound === 'glass' ? 'click' : below.sound === 'crystal' || below.sound === 'metal' ? 'bell' : 'harp';
    game.audio && game.audio.note(m, inst, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (game.particles) game.particles.add({ x: x + 0.5, y: y + 1.2, z: z + 0.5, vy: 0.8, r: 0.3 + (m / 24) * 0.7, g: 1 - (m / 24) * 0.5, b: 1, size: 0.12, life: 0.7, em: 1, additive: true });
    game.emit('note', x, y, z, m);
  };

  game.circuits = C;
  game.circuitDevices = DEVICES;
  void SOLID;
  return C;
}
