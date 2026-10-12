// The adventure layer: structure features (loot chests, waystones, nests, the warden), loot
// tables and lore, rune pedestals and seal doors, the Heart Altar and the five echo shards,
// waystone travel, the echo-compass pulse (ore sight + shrine bearing), the shard chart.

import { BLOCKS, B, ID_MASK, ID_BITS, pack, SOLID } from '../world/blocks.js';
import { ITEMS, I, SHARDS } from '../world/items.js';
import { BIOMES } from '../world/biomes.js';
import { locateStructures, STRUCTURE_INFO, SHRINE_KINDS } from '../world/gen/structures.js';
import { h, Screen } from '../ui/ui.js';
import { compassDir } from './events.js';
import { mat4, identity, translate, rotateY, scale } from '../core/math.js';

export const LORE = [
  ['织者手记 · 一', '在世界还只是一团回响的时候，我们——织者——用回响之丝把山川、河流与天空编织成形。每一缕丝都在低语，只要你愿意倾听。'],
  ['织者手记 · 二', '织心祭坛是世界的心跳。五枚回响碎片守护着它的节律：苍穹之羽、深渊之心、沙海之眼、霜冻之泪、潮汐之歌。'],
  ['织者手记 · 三', '大寂静来临的那一夜，天空像玻璃一样碎裂。群岛浮上云端，深渊吞没了光。碎片四散，祭坛从此沉默。'],
  ['织者手记 · 四', '我把碎片藏进了五座神殿。只有点亮殿中全部的符文基座——用晶洞里生长的回响晶片——织印石门才会开启。'],
  ['织者手记 · 五', '回响晶片生长在深处的晶洞里，它们会唱歌。把晶片与金子带到共鸣台，就能做出回响罗盘；它会指向沉睡的碎片。'],
  ['织者手记 · 六', '流星是天空的伤口落下的血。它们带来星核与陨铁，比任何金属都坚韧。夜里看见流光，记下它坠落的方向。'],
  ['织者手记 · 七', '暗影游荡者是被遗忘的回响。阳光会把它们重新织回风里，所以它们只在黑暗中徘徊。点亮你的家，它们便不敢靠近。'],
  ['织者手记 · 八', '幽光深层的菌伞在黑暗中呼吸。深渊圣所的守卫仍在等待它的主人——它不会让任何人轻易取走深渊之心。'],
  ['织者手记 · 九', '若你在沙海里迷路，就抬头看：方尖碑的金顶会为你指路。答案藏在它的影子之下。'],
  ['织者手记 · 十', '霜晶荒原的晶柱是冻结的星光。冰晶尖塔顶端的房间，只为攀到最高处的人打开。'],
  ['织者手记 · 十一', '潮汐神殿沉在深海。海水会夺走你的呼吸——在殿中寻找那个被玻璃包裹的气室，再去点亮四角的基座。'],
  ['织者手记 · 十二', '当五枚碎片重归祭坛，天空将被重新织起。到那时，我留下的翅膀属于你。——最后的织者'],
];

const ORE_COLORS = new Map([
  [B.coal_ore, [0.25, 0.25, 0.3]], [B.copper_ore, [0.95, 0.55, 0.3]], [B.iron_ore, [0.9, 0.75, 0.6]], [B.deep_iron_ore, [0.9, 0.75, 0.6]],
  [B.gold_ore, [1, 0.85, 0.2]], [B.crystal_ore, [0.3, 0.95, 1]], [B.deep_crystal_ore, [0.3, 0.95, 1]], [B.star_ore, [0.75, 0.85, 1]],
  [B.meteor_ore, [1, 0.45, 0.25]], [B.star_core, [1, 1, 1]], [B.budding_echo, [0.75, 0.5, 1]], [B.echo_block, [0.65, 0.45, 0.95]],
]);

export function installAdventure(game, state) {
  const w = game.world;
  const st = state && state.adventure ? state.adventure : {};
  const Q = game.quest = {
    placed: new Set(st.placed || []),          // shard item names placed in the altar
    found: new Set(st.found || []),            // shard item names ever picked up
    done: !!st.done,
    wardens: new Set(st.wardens || []),        // shrine keys whose warden has woken
    opened: new Set(st.opened || []),          // shrine keys already unsealed
    count() { return this.placed.size; },
  };
  game.waystones = st.waystones || [];         // { x,y,z,name }
  game.structures = new Map((st.structures || []).map((s) => [`${s.kind}:${s.x}:${s.z}`, s])); // discovered
  game.knownStructures = new Map();            // seen in loaded chunks (not necessarily visited)
  game.lorePages = new Set(st.lore || []);
  game.chartMarks = st.chartMarks || [];
  const nests = new Map();
  const wardenSites = new Map();

  game.stateSavers.push((s) => {
    s.adventure = {
      placed: [...Q.placed], found: [...Q.found], done: Q.done, wardens: [...Q.wardens], opened: [...Q.opened],
      waystones: game.waystones, structures: [...game.structures.values()], lore: [...game.lorePages], chartMarks: game.chartMarks,
    };
  });

  // ---------------------------------------------------------------- loot
  const T = (name, a = 1, b = a, p = 1) => ({ name, a, b, p });
  const LOOT = {
    heart: [T('bread', 3, 5), T('torch', 6, 10), T('lore_page:0'), T('lore_page:1'), T('wheat_seeds', 3, 6), T('stick', 4, 8)],
    ruin: [T('bread', 1, 3, 0.5), T('coal', 2, 6, 0.6), T('iron_ingot', 1, 3, 0.5), T('gold_ingot', 1, 2, 0.35), T('crystal_dust', 2, 6, 0.5), T('echo_crystal', 1, 1, 0.18), T('glider', 1, 1, 0.05), T('melon_seeds', 1, 3, 0.3), T('book', 1, 2, 0.3), T('star_candy', 1, 1, 0.08), T('lore_page', 1, 1, 0.45), T('arrow', 4, 10, 0.3), T('copper_ingot', 2, 5, 0.4)],
    mine: [T('rail', 4, 12, 0.7), T('torch', 4, 10, 0.6), T('coal', 3, 8, 0.6), T('iron_ingot', 1, 4, 0.6), T('copper_ingot', 2, 6, 0.5), T('bread', 1, 3, 0.5), T('cart', 1, 1, 0.12), T('stargem', 1, 1, 0.08), T('lore_page', 1, 1, 0.2), T('crystal_dust', 3, 8, 0.4), T('power_rail', 2, 4, 0.2)],
    dungeon: [T('bone', 2, 6, 0.7), T('string', 2, 5, 0.6), T('iron_ingot', 1, 4, 0.6), T('gold_ingot', 1, 3, 0.5), T('echo_crystal', 1, 2, 0.35), T('star_shard', 1, 1, 0.12), T('feather_charm', 1, 1, 0.05), T('lore_page', 1, 1, 0.5), T('blast_powder', 2, 5, 0.4), T('bow', 1, 1, 0.15)],
    urn: [T('crystal_dust', 1, 3, 0.35), T('gold_ingot', 1, 1, 0.12), T('coal', 1, 3, 0.3), T('bone', 1, 2, 0.25), T('wheat_seeds', 1, 3, 0.3), T('arrow', 2, 5, 0.2), T('glow_spore', 1, 2, 0.2), T('echo_crystal', 1, 1, 0.06)],
  };
  for (const [kind, shard] of SHRINE_KINDS.map((k) => [k, STRUCTURE_INFO[k].shard])) LOOT[`shard_${kind}`] = [T(shard), T('star_shard', 2, 3), T('echo_crystal', 2, 3), T('lore_page', 1, 1, 0.9), T('gold_ingot', 3, 6)];
  const rollLoot = (table) => {
    const out = [];
    for (const e of LOOT[table] || []) {
      if (Math.random() > e.p) continue;
      let name = e.name, tag = null;
      if (name.startsWith('lore_page')) {
        const idx = name.includes(':') ? Number(name.split(':')[1]) : pickLorePage();
        name = 'lore_page'; tag = { page: idx, label: LORE[idx][0] };
      }
      if (I[name] === undefined) continue;
      const n = e.a + Math.floor(Math.random() * (e.b - e.a + 1));
      if (n > 0) out.push(tag ? { id: I[name], n: 1, tag } : { id: I[name], n });
    }
    return out;
  };
  let loreCursor = 2;
  function pickLorePage() {
    // prefer pages the player has not read yet
    for (let k = 0; k < LORE.length; k++) { const i = (loreCursor + k) % LORE.length; if (!game.lorePages.has(i) && i > 1) { loreCursor = i + 1; return i; } }
    return 2 + Math.floor(Math.random() * (LORE.length - 2));
  }
  game.loot = {
    fill(be) {
      const items = rollLoot(be.loot);
      be.loot = null;
      const free = be.slots.map((s, i) => i).sort(() => Math.random() - 0.5);
      for (const it of items) { const i = free.pop(); if (i !== undefined) be.slots[i] = it; }
      game.markBEChanged(be);
    },
  };
  // urns shatter into loot
  w.handlers.remove[B.loot_urn] = (world, x, y, z) => {
    for (const s of rollLoot('urn')) game.entities.spawnItem(x + 0.5, y + 0.4, z + 0.5, s);
    game.audio && game.audio.play('break_tool', { x, y, z });
  };

  // ---------------------------------------------------------------- features from freshly generated chunks
  game.onFeatures = (c, features) => {
    for (const f of features) {
      if (f.type === 'chest') {
        const be = { kind: 'chest', slots: new Array(27).fill(null), loot: f.loot };
        w.setBE(f.x, f.y, f.z, be);
      } else if (f.type === 'structure') {
        game.knownStructures.set(`${f.kind}:${f.x}:${f.z}`, f);
      } else if (f.type === 'nest') nests.set(`${f.x},${f.y},${f.z}`, f);
      else if (f.type === 'warden') wardenSites.set(`${f.x},${f.z}`, f);
      else if (f.type === 'waystone' && f.name) game.waystoneNames = { ...(game.waystoneNames || {}), [`${f.x},${f.y},${f.z}`]: f.name };
    }
    c.features = [];
  };
  // every loaded chunk (fresh or saved) registers the structures whose origin lies inside it
  const KINDS = Object.keys(STRUCTURE_INFO);
  game.chunks.onChunkLoaded.push((c) => {
    for (const kind of KINDS) {
      for (const o of locateStructures(game.gen, kind, c.cx * 16 + 8, c.cz * 16 + 8, 0)) {
        if ((o.x >> 4) !== c.cx || (o.z >> 4) !== c.cz) continue;
        const k = `${kind}:${o.x}:${o.z}`;
        if (!game.knownStructures.has(k)) game.knownStructures.set(k, { kind, x: o.x, y: o.y, z: o.z });
        if (kind === 'dungeon') nests.set(`${o.x},${o.y},${o.z}`, { x: o.x, y: o.y, z: o.z });
        if (kind === 'abyss') wardenSites.set(`${o.x},${o.z}`, { x: o.x, y: o.y, z: o.z });
      }
    }
  });
  game.locateKinds = KINDS;
  game.locate = (kind) => {
    if (!STRUCTURE_INFO[kind]) return null;
    const p = game.player;
    const o = locateStructures(game.gen, kind, p.x, p.z, 4)[0];
    if (!o) return null;
    return { x: o.x, y: o.y, z: o.z, d: Math.round(o.d), zh: STRUCTURE_INFO[kind].zh, dir: compassDir(o.x - p.x, o.z - p.z) };
  };

  // ---------------------------------------------------------------- shrines: pedestals & seals
  function nearbyBlocks(x, y, z, r, ids) {
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const id = w.getId(x + dx, y + dy, z + dz);
      if (ids.includes(id)) out.push([x + dx, y + dy, z + dz, w.getMeta(x + dx, y + dy, z + dz)]);
    }
    return out;
  }
  function useAncient(x, y, z, v, held) {
    const id = v & ID_MASK, m = v >>> ID_BITS;
    if (id === B.rune_pedestal) {
      if (m & 1) { game.hud.message('这座基座已经亮起。'); return true; }
      if (!held || held.id !== I.echo_crystal) { game.hud.message('基座上的凹槽形似一枚回响晶片……', '#bdf'); return true; }
      if (!game.player.creative) game.inventory.consumeHeld(1);
      w.setBlock(x, y, z, pack(B.rune_pedestal, 1));
      game.audio && game.audio.play('chime', { x, y, z, freq: 660 + Math.random() * 300 });
      game.particles && game.particles.sparks(x + 0.5, y + 1.2, z + 0.5, 24, [0.75, 0.55, 1], 3);
      // all pedestals of this shrine lit?
      const peds = nearbyBlocks(x, y, z, 26, [B.rune_pedestal]);
      const lit = peds.filter((p) => p[3] & 1).length;
      if (lit < peds.length) { game.hud.toast('符文基座亮起', `${lit} / ${peds.length}`, 'quest', 2500); return true; }
      const seals = nearbyBlocks(x, y, z, 30, [B.seal_door]);
      game.hud.toast('织印石门开启了', '回响在殿堂中回荡。', 'quest', 4000);
      game.audio && game.audio.play('quest');
      seals.forEach(([sx, sy, sz], i) => setTimeout(() => {
        w.setBlock(sx, sy, sz, 0);
        game.particles && game.particles.sparks(sx + 0.5, sy + 0.5, sz + 0.5, 10, [0.45, 0.95, 0.85], 2);
      }, 120 * i));
      Q.opened.add(`${Math.round(x / 64)},${Math.round(z / 64)}`);
      game.emit('shrineOpened', x, y, z);
      return true;
    }
    if (id === B.heart_altar) return useAltar(x, y, z, held);
    if (id === B.waystone) return useWaystone(x, y, z, v);
    return false;
  }
  game.useAncientBlock = useAncient;
  // these blocks route through useMechBlock -> useAncientBlock; give them a 'use' so the click reaches it
  for (const n of ['rune_pedestal', 'heart_altar', 'waystone']) BLOCKS[B[n]].use = BLOCKS[B[n]].use || n;

  // ---------------------------------------------------------------- the altar and the ending
  function useAltar(x, y, z, held) {
    if (held && ITEMS[held.id].shard) {
      const name = ITEMS[held.id].name;
      if (Q.placed.has(name)) { game.hud.message('这枚碎片已经回到了祭坛。'); return true; }
      Q.placed.add(name);
      if (!game.player.creative) game.inventory.consumeHeld(1);
      game.audio && game.audio.play('quest');
      game.particles && game.particles.sparks(x + 0.5, y + 1.5, z + 0.5, 40, [0.8, 0.6, 1], 4);
      game.hud.toast(`${ITEMS[held.id].zh}归位`, `织心祭坛 ${Q.placed.size} / 5`, 'quest', 5000);
      game.emit('shardPlaced', name);
      if (Q.placed.size >= 5 && !Q.done) finale(x, y, z);
      return true;
    }
    const missing = SHARDS.filter(([n]) => !Q.placed.has(n)).map(([, zh]) => zh);
    if (Q.done) game.hud.message('祭坛在低声吟唱。织界已经重织。');
    else game.hud.message(`织心祭坛沉睡着。尚缺：${missing.join('、')}。`, '#cbf');
    return true;
  }
  function finale(x, y, z) {
    Q.done = true;
    game.hud.showSubtitle('织 界 重 织', 6000);
    setTimeout(() => game.hud.toast('最后的织者留下了礼物', '织星之翼已放进你的背包。放在副手栏，双击跳跃即可飞翔。', 'quest', 9000), 2500);
    const left = game.inventory.add(I.star_wings, 1);
    if (left) game.dropStack({ id: I.star_wings, n: 1 });
    game.setTime(14000);
    game.events && (game.events.auroraNight = game.day);
    if (game.events) game.events.showerNight = game.day;
    let k = 0;
    const iv = setInterval(() => {
      if (!game.particles || ++k > 60) { clearInterval(iv); return; }
      for (let i = 0; i < 6; i++) game.particles.add({ x: x + 0.5 + (Math.random() - 0.5) * 30, y: y + 25 + Math.random() * 10, z: z + 0.5 + (Math.random() - 0.5) * 30, vy: -6, r: 0.8, g: 0.7, b: 1, size: 0.12, life: 4, em: 1, additive: true });
    }, 100);
    game.emit('questDone');
  }
  // the placed shards circle above the altar
  game.addSystem({
    renderOpaque(g, r) {
      if (!Q.placed.size) return;
      const heart = locateStructures(g.gen, 'heart', 0, 0)[0];
      if (!heart || Math.hypot(heart.x - g.player.x, heart.z - g.player.z) > 80) return;
      r.beginEntities();
      const M = mat4();
      const list = SHARDS.filter(([n]) => Q.placed.has(n));
      list.forEach(([n], i) => {
        const a = g.time * 0.8 + i * Math.PI * 2 / list.length;
        identity(M); translate(M, M, heart.x + 0.5 + Math.cos(a) * 1.2, heart.y + 1.8 + Math.sin(g.time * 2 + i) * 0.15, heart.z + 0.5 + Math.sin(a) * 1.2);
        rotateY(M, M, g.time * 2); scale(M, M, 0.45, 0.45, 0.45);
        r.drawMesh(g.itemMeshes.get(I[n]), M, [1, 1, 1, 1], null, 0.9);
      });
    },
  });
  const prevPickup = game.onPickup;
  game.onPickup = (id, n) => {
    if (prevPickup) prevPickup(id, n);
    const d = ITEMS[id];
    if (d && d.shard && !Q.found.has(d.name)) {
      Q.found.add(d.name);
      game.hud.toast(`获得回响碎片：${d.zh}`, '把它带回织心祭坛。', 'quest', 6000);
      game.audio && game.audio.play('quest');
    }
  };
  // also catch shards taken straight out of chests
  game.inventory.listeners.push((inv) => {
    for (const s of inv.slots) if (s && ITEMS[s.id].shard && !Q.found.has(ITEMS[s.id].name)) game.onPickup(s.id, 1);
  });

  // ---------------------------------------------------------------- waystones
  function biomeName(x, z) { return BIOMES[w.biomeAt(x, z)].zh; }
  function useWaystone(x, y, z, v) {
    const on = (v >>> ID_BITS) & 1;
    if (!on) {
      w.setBlock(x, y, z, pack(B.waystone, 1));
      const nm = (game.waystoneNames && game.waystoneNames[`${x},${y},${z}`]) || `${biomeName(x, z)}石碑`;
      if (!game.waystones.some((s) => s.x === x && s.y === y && s.z === z)) game.waystones.push({ x, y, z, name: nm });
      game.audio && game.audio.play('teleport', { x, y, z });
      game.particles && game.particles.sparks(x + 0.5, y + 1, z + 0.5, 30, [0.45, 0.9, 1], 3);
      game.hud.toast('回响石碑已激活', `「${nm}」加入了你的传送网络。`, 'discover');
      game.emit('waystoneActivated');
      return true;
    }
    game.app.ui.push(new WaystoneScreen(game, { x, y, z }));
    return true;
  }
  game.travelTo = (s) => {
    const p = game.player;
    game.particles && game.particles.sparks(p.x, p.y + 1, p.z, 30, [0.45, 0.9, 1], 3);
    game.audio && game.audio.play('teleport');
    // step off to the south of the destination stone
    game.teleport(s.x + 0.5, s.y + 0.2, s.z + 1.6);
    p.invuln = 3;
    game.emit('travelled');
  };
  // removing an active waystone takes it out of the network
  const prevRm = w.handlers.remove[B.waystone];
  w.handlers.remove[B.waystone] = (world, x, y, z, v, nv) => { if (prevRm) prevRm(world, x, y, z, v, nv); game.waystones = game.waystones.filter((s) => !(s.x === x && s.y === y && s.z === z)); };

  // ---------------------------------------------------------------- echo compass pulse
  const ping = { t: -99, ores: [], target: null, rings: [] };
  game.ping = ping;
  game.echoPing = () => {
    if (!game.inventory.has(I.echo_compass) && !game.player.creative) { game.hud.message('需要回响罗盘才能发出回响脉冲。', '#9ab'); return; }
    if (game.time - ping.t < 4) return;
    ping.t = game.time;
    const p = game.player;
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    const ores = [];
    const R = 18;
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      const id = w.getId(px + dx, py + dy, pz + dz);
      const c = ORE_COLORS.get(id);
      if (c) ores.push([px + dx, py + dy, pz + dz, c, Math.hypot(dx, dy, dz)]);
    }
    ores.sort((a, b) => a[4] - b[4]);
    ping.ores = ores.slice(0, 400);
    // bearing to the nearest shrine whose shard is still out there
    let best = null;
    for (const kind of SHRINE_KINDS) {
      if (Q.found.has(STRUCTURE_INFO[kind].shard) || Q.placed.has(STRUCTURE_INFO[kind].shard)) continue;
      const l = locateStructures(game.gen, kind, p.x, p.z, 3);
      if (l.length && (!best || l[0].d < best.d)) best = l[0];
    }
    ping.target = best;
    game.audio && game.audio.play('ping');
    if (best) game.hud.message(`回响指向${compassDir(best.x - p.x, best.z - p.z)}方向约 ${Math.round(best.d)} 格：${STRUCTURE_INFO[best.kind].zh}`, '#c9f');
    else game.hud.message('回响没有找到更多的碎片神殿。', '#c9f');
    game.hud.message(`感知到 ${ores.length} 处矿脉`, '#9de');
    game.emit('ping');
  };
  const lb = new Float32Array(7 * 24 * 420);
  game.addSystem({
    frame(g) { if (g.input.locked && !g.ui.open && g.input.pressed('ping')) g.echoPing(); },
    renderOverlay(g, r) {
      const age = g.time - ping.t;
      if (age > 12) return;
      const p = g.player;
      let n = 0;
      // expanding rings
      if (age < 1.6) {
        const R = age * 18;
        const a = 1 - age / 1.6;
        for (const yy of [-0.3, 0, 0.3]) {
          const rr = R * Math.sqrt(1 - yy * yy);
          for (let k = 0; k < 48; k++) {
            const t0 = k / 48 * Math.PI * 2, t1 = (k + 1) / 48 * Math.PI * 2;
            lb.set([p.x + Math.cos(t0) * rr, p.eyeY + yy * R, p.z + Math.sin(t0) * rr, 0.6, 0.9, 1, a * 0.8], n * 7); n++;
            lb.set([p.x + Math.cos(t1) * rr, p.eyeY + yy * R, p.z + Math.sin(t1) * rr, 0.6, 0.9, 1, a * 0.8], n * 7); n++;
          }
        }
      }
      // ores revealed by the wave front
      const front = age * 18;
      const fade = Math.min(1, (12 - age) / 3);
      for (const [x, y, z, c, d] of ping.ores) {
        if (d > front || n > 24 * 400) continue;
        const a = 0.85 * fade;
        const e = 0.02;
        const x0 = x - e, y0 = y - e, z0 = z - e, x1 = x + 1 + e, y1 = y + 1 + e, z1 = z + 1 + e;
        const E = [[x0, y0, z0, x1, y0, z0], [x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1], [x0, y1, z1, x1, y1, z1], [x0, y0, z0, x0, y1, z0], [x1, y0, z0, x1, y1, z0], [x0, y0, z1, x0, y1, z1], [x1, y0, z1, x1, y1, z1], [x0, y0, z0, x0, y0, z1], [x1, y0, z0, x1, y0, z1], [x0, y1, z0, x0, y1, z1], [x1, y1, z0, x1, y1, z1]];
        for (const ed of E) { lb.set([ed[0], ed[1], ed[2], c[0], c[1], c[2], a], n * 7); n++; lb.set([ed[3], ed[4], ed[5], c[0], c[1], c[2], a], n * 7); n++; }
      }
      if (n) r.drawLines(lb, n, { depth: false });
    },
  });

  // ---------------------------------------------------------------- items: compass, chart, lore pages
  const prevUse = game.useSpecialItem;
  game.useSpecialItem = (held, def, hit, fresh) => {
    if (def.use === 'ping') { if (fresh) game.echoPing(); return true; }
    if (def.use === 'chart') {
      if (!fresh) return true;
      const p = game.player;
      const cands = [];
      for (const kind of SHRINE_KINDS) {
        if (Q.found.has(STRUCTURE_INFO[kind].shard) || Q.placed.has(STRUCTURE_INFO[kind].shard)) continue;
        const l = locateStructures(game.gen, kind, p.x, p.z, 4).filter((o) => !game.chartMarks.some((m) => m.x === o.x && m.z === o.z));
        if (l.length) cands.push(l[0]);
      }
      cands.sort((a, b) => a.d - b.d);
      const t = cands[0];
      if (!t) { game.hud.message('残图上的墨迹已经褪去了……'); return true; }
      game.chartMarks.push({ x: t.x, z: t.z, kind: t.kind });
      if (!game.player.creative) game.inventory.consumeHeld(1);
      game.hud.toast('残图展开了', `${STRUCTURE_INFO[t.kind].zh}：${compassDir(t.x - p.x, t.z - p.z)}方向约 ${Math.round(t.d)} 格。已标在地图上（M）。`, 'discover', 7000);
      game.audio && game.audio.play('discover');
      return true;
    }
    if (def.use === 'read') {
      if (!fresh) return true;
      const page = held.tag && held.tag.page !== undefined ? held.tag.page : 2;
      game.lorePages.add(page);
      game.app.ui.push(new LoreScreen(page));
      game.emit('loreRead', page);
      return true;
    }
    if (def.use === 'lightorb') {
      if (!fresh) return true;
      const p = game.player;
      const x = Math.floor(p.x), y = Math.floor(p.eyeY + 1), z = Math.floor(p.z);
      if (!w.getId(x, y, z)) { w.setBlock(x, y, z, B.glow_air_cool); setTimeout(() => { if (w.getId(x, y, z) === B.glow_air_cool) w.setBlock(x, y, z, 0); }, 60000); }
      game.audio && game.audio.play('chime', { freq: 1320 });
      return true;
    }
    return prevUse ? prevUse(held, def, hit, fresh) : false;
  };

  // ---------------------------------------------------------------- nests, the warden, discoveries
  let nestT = 0;
  game.addSystem({
    tick(g) {
      const p = g.player;
      nestT += 0.05;
      if (nestT > 2.5) {
        nestT = 0;
        for (const [k, n] of nests) {
          if (w.getId(n.x, n.y, n.z) !== B.gloom_nest) { if (w.isLoaded(n.x, n.z)) nests.delete(k); continue; }
          const d = Math.hypot(p.x - n.x, p.y - n.y, p.z - n.z);
          if (d > 16 || g.settings.difficulty === 0) continue;
          const near = g.entities.near(n.x, n.y, n.z, 8, (e) => e.kind === 'gloom' && e.alive).length;
          if (near >= 3) continue;
          const sx = n.x + 0.5 + (Math.random() - 0.5) * 5, sz = n.z + 0.5 + (Math.random() - 0.5) * 5;
          if (SOLID[w.getId(Math.floor(sx), n.y, Math.floor(sz))]) continue;
          const m = g.spawnMob('gloom', sx, n.y, sz);
          if (m) { m.persist = false; g.particles && g.particles.smoke(sx, n.y + 1, sz, 8, true); }
        }
      }
      // the warden wakes when you step into its hall
      for (const [k, s] of wardenSites) {
        if (Q.wardens.has(k)) continue;
        if (Math.abs(p.x - s.x) < 10 && Math.abs(p.z - s.z) < 6 && Math.abs(p.y - s.y) < 6) {
          Q.wardens.add(k);
          const m = g.spawnMob('warden', s.x + 6.5, s.y, s.z + 0.5);
          if (m) { m.persist = true; m.aggro = p; m.setState('chase', 60); }
          g.hud.showSubtitle('遗 迹 守 卫 苏 醒', 3500);
          g.audio && g.audio.play('mob', { x: s.x, y: s.y, z: s.z, voice: 'warden' });
        }
      }
      // discovering structures by walking near them
      for (const [k, f] of g.knownStructures) {
        if (g.structures.has(k)) continue;
        const d = Math.hypot(p.x - f.x, p.z - f.z);
        const near = d < (f.kind === 'mine' || f.kind === 'dungeon' || f.kind === 'abyss' ? 14 : 26) && Math.abs(p.y - f.y) < (f.kind === 'sky' ? 30 : 24);
        if (!near) continue;
        g.structures.set(k, { kind: f.kind, x: f.x, y: f.y, z: f.z, day: g.day });
        if (f.kind !== 'heart' || g.day > 1 || g.ticks > 200) g.hud.toast(`发现：${STRUCTURE_INFO[f.kind].zh}`, STRUCTURE_INFO[f.kind].shard ? '碎片神殿！点亮所有符文基座来开启织印石门。' : '', 'discover', 4500);
        g.audio && g.audio.play('discover');
        g.emit('structureFound', f.kind);
      }
    },
  });

  // boss bar
  const bar = document.createElement('div');
  bar.className = 'boss-bar';
  bar.innerHTML = '<div class="bb-name"></div><div class="bb-track"><i></i></div>';
  game.hud.root.appendChild(bar);
  game.addSystem({
    frame(g) {
      const p = g.player;
      const boss = g.entities.list.find((e) => e.def && e.def.boss && e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 40);
      bar.style.display = boss ? '' : 'none';
      g.hud.root.classList.toggle('boss-on', !!boss);
      if (boss) { bar.firstChild.textContent = boss.def.zh; bar.lastChild.firstChild.style.width = `${Math.max(0, boss.health / boss.def.health * 100)}%`; }
    },
  });

  // goal line in the HUD: what to do next
  game.goalText = () => {
    const inv = game.inventory;
    if (Q.done) return '织界已重织 · 去任何想去的地方吧';
    const n = Q.placed.size;
    const carrying = SHARDS.filter(([nm]) => inv.has(I[nm])).length;
    if (carrying) return `<b>回到织心祭坛</b>，放入碎片（${n}/5 已归位）`;
    if (!game.discovered.has(I.workbench)) return '目标：砍树，<b>制作工作台</b>（E 打开合成书）';
    if (!game.discovered.has(I.stone_pickaxe) && !game.discovered.has(I.iron_pickaxe)) return '目标：制作<b>石镐</b>，向地下挖掘';
    if (!game.discovered.has(I.iron_ingot)) return '目标：找到<b>铁矿</b>，用熔炉炼成铁锭';
    if (!game.discovered.has(I.echo_compass)) return game.discovered.has(I.echo_crystal) ? '目标：在<b>共鸣台</b>制作回响罗盘' : '目标：寻找<b>晶洞</b>中的回响晶片';
    return `目标：按 <b>F</b> 发出回响，寻找碎片神殿（${n}/5）`;
  };
}

// ---------------------------------------------------------------- screens
class WaystoneScreen extends Screen {
  constructor(game, here) { super(); this.game = game; this.here = here; }
  build() {
    const g = this.game, p = g.player;
    const list = h('div', { class: 'world-list' });
    const others = g.waystones.filter((s) => !(s.x === this.here.x && s.y === this.here.y && s.z === this.here.z));
    if (!others.length) list.appendChild(h('div', { class: 'empty' }, '还没有其他激活的石碑。找到并激活更多回响石碑，就能在它们之间穿行。'));
    for (const s of others.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))) {
      const d = Math.round(Math.hypot(s.x - p.x, s.z - p.z));
      list.appendChild(h('div', { class: 'world-row' },
        h('div', { class: 'wr-main' }, h('div', { class: 'wr-name' }, s.name), h('div', { class: 'wr-info' }, `${compassDir(s.x - p.x, s.z - p.z)} · ${d} 格 · (${s.x}, ${s.y}, ${s.z})`)),
        h('button', { class: 'btn primary small', onclick: () => { this.close(); g.travelTo(s); } }, '传送')));
    }
    return h('div', { class: 'screen' }, h('div', { class: 'panel menu-panel wide' }, h('div', { class: 'title' }, '回响石碑'), list, h('div', { class: 'menu-row' }, h('button', { class: 'btn', onclick: () => this.close() }, '关闭'))));
  }
  onKey(e) { if (e.code === 'Escape' || e.code === 'KeyE') { this.close(); return true; } return true; }
}

class LoreScreen extends Screen {
  constructor(page) { super(); this.page = page; }
  build() {
    const [title, text] = LORE[this.page] || LORE[0];
    return h('div', { class: 'screen' }, h('div', { class: 'panel lore-panel' }, h('div', { class: 'lore-title' }, title), h('div', { class: 'lore-text' }, text), h('div', { class: 'menu-row' }, h('button', { class: 'btn', onclick: () => this.close() }, '合上'))));
  }
  onKey(e) { if (e.code === 'Escape' || e.code === 'KeyE') { this.close(); return true; } return true; }
}
export { LoreScreen };
