// Fishing (bobber, bites, loot) and trading with the wandering merchant.

import { Entity, ENTITY_TYPES } from '../entity/entities.js';
import { MeshBuilder } from '../render/itemmesh.js';
import { mat4, identity, translate, lookDir } from '../core/math.js';
import { I, ITEMS } from '../world/items.js';
import { B, ID_MASK, LIQUID, SOLID } from '../world/blocks.js';
import { h, Screen } from '../ui/ui.js';
import { iconURL } from '../render/icons.js';

const LOOT = [
  ['raw_fish', 60], ['lily_pad', 6], ['string', 6], ['bone', 6], ['leather', 5], ['glow_spore', 4.5], ['bowl', 4], ['gel', 3], ['book', 2], ['echo_crystal', 2], ['star_shard', 1.5],
];
function rollLoot() {
  let s = 0; for (const [, w] of LOOT) s += w;
  let r = Math.random() * s;
  for (const [n, w] of LOOT) { r -= w; if (r <= 0) return n; }
  return 'raw_fish';
}

class Bobber extends Entity {
  constructor() { super('bobber'); this.hw = 0.12; this.h = 0.24; this.persist = false; this.wait = 4 + Math.random() * 14; this.bite = 0; this.inWater = false; }
  tick(game, dt) {
    this.age += dt;
    const w = game.world;
    const id = w.getId(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    const p = game.player;
    if (Math.hypot(p.x - this.x, p.z - this.z) > 32 || game.inventory.held()?.id !== I.fishing_rod) { this.dead = true; game.bobber = null; return; }
    if (LIQUID[id] === 1) {
      if (!this.inWater) { this.inWater = true; game.particles && game.particles.splash(this.x, this.y + 0.3, this.z, 6); game.audio && game.audio.play('splash', { x: this.x, y: this.y, z: this.z, volume: 0.4 }); }
      // float at the surface
      const top = Math.floor(this.y) + 0.85;
      this.vy += (top - this.y) * 30 * dt; this.vy *= 0.85;
      this.vx *= 0.9; this.vz *= 0.9;
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      if (this.bite > 0) {
        this.bite -= dt;
        if (this.bite <= 0) { this.wait = 4 + Math.random() * 14; }
      } else {
        // more fish when it rains, fewer at noon
        this.wait -= dt * (game.weather && game.weather.rain > 0.3 ? 1.4 : 1);
        if (this.wait < 1.5 && game.particles && Math.random() < 0.3) {
          const a = Math.random() * 6.28, d = this.wait * 1.5;
          game.particles.add({ x: this.x + Math.cos(a) * d, y: this.y + 0.15, z: this.z + Math.sin(a) * d, r: 0.85, g: 0.95, b: 1, a: 0.8, size: 0.05, life: 0.4 });
        }
        if (this.wait <= 0) {
          this.bite = 1.3;
          this.vy = -3;
          game.particles && game.particles.splash(this.x, this.y + 0.3, this.z, 10);
          game.audio && game.audio.play('splash', { x: this.x, y: this.y, z: this.z, volume: 0.7 });
        }
      }
    } else {
      this.inWater = false;
      this.physics(game, dt);
      if (this.onGround) { this.vx *= 0.5; this.vz *= 0.5; }
      if (SOLID[id]) this.dead = true;
    }
  }
  render(game, r, a) {
    if (!this.mesh) {
      const mb = new MeshBuilder();
      mb.box(-0.08, -0.08, -0.08, 0.08, 0.04, 0.08, [0.95, 0.95, 0.95, 1]);
      mb.box(-0.08, 0.04, -0.08, 0.08, 0.12, 0.08, [0.85, 0.2, 0.2, 1]);
      mb.box(-0.015, 0.12, -0.015, 0.015, 0.22, 0.015, [0.3, 0.3, 0.3, 1]);
      this.mesh = mb.build(r);
    }
    const [x, y, z] = this.lerpPos(a);
    const M = this.model || (this.model = mat4());
    identity(M); translate(M, M, x, y + (this.bite > 0 ? -0.12 : Math.sin(game.time * 3) * 0.02), z);
    r.drawMesh(this.mesh, M, this.lightAt(game, x, y + 0.3, z));
    // the line, as a few line segments from the rod tip
    const p = game.player;
    const d = lookDir(p.yaw, p.pitch);
    const sx = p.x + d[0] * 0.7 + Math.cos(p.yaw) * 0.35, sy = p.eyeY - 0.15, sz = p.z + d[2] * 0.7 - Math.sin(p.yaw) * 0.35;
    const verts = game._lineBuf || (game._lineBuf = new Float32Array(7 * 32));
    let n = 0;
    for (let i = 0; i < 12; i++) {
      for (const t of [i / 12, (i + 1) / 12]) {
        const sag = Math.sin(t * Math.PI) * 0.6 * (this.inWater ? 1 : 0.3);
        verts.set([sx + (x - sx) * t, sy + (y + 0.2 - sy) * t - sag, sz + (z - sz) * t, 0.9, 0.9, 0.9, 0.7], n * 7); n++;
      }
    }
    r.drawLines(verts, n);
    r.beginEntities();
  }
  dispose(r) { if (this.mesh) r.deleteMesh(this.mesh); }
}
ENTITY_TYPES.bobber = () => null;

// ---------------------------------------------------------------- trading
const BUY = [ // player gives -> gets gold
  [['wheat', 16], ['gold_ingot', 1]], [['berries', 10], ['gold_ingot', 1]], [['fluff', 12], ['gold_ingot', 1]],
  [['raw_fish', 6], ['gold_ingot', 1]], [['leather', 5], ['gold_ingot', 1]], [['bone', 10], ['gold_ingot', 1]],
  [['radish', 12], ['gold_ingot', 1]], [['copper_ingot', 8], ['gold_ingot', 1]], [['glow_spore', 6], ['gold_ingot', 1]],
];
const SELL = [ // gold -> goods
  [['gold_ingot', 1], ['melon_seeds', 2]], [['gold_ingot', 1], ['sunroot', 4]], [['gold_ingot', 1], ['radish', 3]],
  [['gold_ingot', 6], ['glider', 1]], [['gold_ingot', 3], ['star_candy', 2]], [['gold_ingot', 5], ['stargem', 1]],
  [['gold_ingot', 4], ['echo_crystal', 1]], [['gold_ingot', 3], ['bounce_gel', 2]], [['gold_ingot', 8], ['shard_chart', 1]],
  [['gold_ingot', 2], ['crystal_dust', 8]], [['gold_ingot', 10], ['feather_charm', 1]], [['gold_ingot', 2], ['bluestar', 4]],
  [['gold_ingot', 2], ['moonlily', 3]], [['gold_ingot', 4], ['lantern', 3]],
];

class TradeScreen extends Screen {
  constructor(game, trader) {
    super(); this.game = game; this.trader = trader;
    if (!trader.offers) {
      const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
      trader.offers = [...shuffle(BUY).slice(0, 3), ...shuffle(SELL).slice(0, 5)];
      if (!trader.offers.some((o) => o[1][0] === 'shard_chart')) trader.offers.push(SELL.find((o) => o[1][0] === 'shard_chart'));
      trader.offers = trader.offers.map((o) => ({ give: o[0], get: o[1], left: 3 + Math.floor(Math.random() * 5) }));
    }
  }
  build() {
    this.list = h('div', { class: 'trade-list' });
    const el = h('div', { class: 'screen' }, h('div', { class: 'panel menu-panel' },
      h('div', { class: 'title' }, '游商·鸦羽'),
      h('div', { class: 'dim small', style: { marginBottom: '10px' } }, '“风把我吹到了这里。用金子换点好东西吧，旅人。”'),
      this.list,
      h('div', { class: 'menu-row' }, h('button', { class: 'btn primary', onclick: () => this.close() }, '离开'))));
    this.render();
    return el;
  }
  render() {
    const inv = this.game.inventory;
    this.list.innerHTML = '';
    for (const o of this.trader.offers) {
      const [gn, gc] = o.give, [rn, rc] = o.get;
      const ok = inv.count(I[gn]) >= gc && o.left > 0;
      const row = h('div', { class: `trade-row ${ok ? '' : 'off'}` },
        h('div', { class: 'tr-side' }, h('img', { src: iconURL(I[gn]) }), h('span', {}, `${ITEMS[I[gn]].zh} ×${gc}`), h('b', { class: 'dim' }, `（有 ${inv.count(I[gn])}）`)),
        h('div', { class: 'tr-arrow' }, '→'),
        h('div', { class: 'tr-side' }, h('img', { src: iconURL(I[rn]) }), h('span', {}, `${ITEMS[I[rn]].zh} ×${rc}`)),
        h('button', { class: 'btn small primary', ...(ok ? {} : { disabled: true }), onclick: () => this.trade(o) }, o.left > 0 ? `交易（余 ${o.left}）` : '售罄'));
      row.addEventListener('mouseenter', () => ITEMS[I[rn]].desc && this.ui.showTip(`<div class="tt-name">${ITEMS[I[rn]].zh}</div><div class="tt-desc">${ITEMS[I[rn]].desc}</div>`));
      row.addEventListener('mouseleave', () => this.ui.hideTip());
      this.list.appendChild(row);
    }
  }
  trade(o) {
    const g = this.game, inv = g.inventory;
    const [gn, gc] = o.give, [rn, rc] = o.get;
    if (inv.count(I[gn]) < gc || o.left <= 0) return;
    inv.remove(I[gn], gc);
    const left = inv.add(I[rn], rc);
    if (left) g.dropStack({ id: I[rn], n: left });
    o.left--;
    g.audio && g.audio.play('craft');
    g.emit('traded', rn);
    this.render();
  }
  onKey(e) { if (e.code === 'Escape' || e.code === 'KeyE') { this.close(); return true; } return true; }
}

export function installFishing(game) {
  game.bobber = null;
  const prev = game.useSpecialItem;
  game.useSpecialItem = (held, def, hit, fresh) => {
    if (def.use === 'fish') {
      if (!fresh) return true;
      const p = game.player;
      if (game.bobber && !game.bobber.dead) {
        const b = game.bobber;
        if (b.bite > 0) {
          const name = rollLoot();
          const dx = p.x - b.x, dy = p.eyeY - b.y, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1;
          game.entities.spawnItem(b.x, b.y + 0.4, b.z, { id: I[name], n: 1 }, [dx / d * Math.min(12, d * 1.1), Math.min(9, 4 + dy * 0.6 + d * 0.15), dz / d * Math.min(12, d * 1.1)], 0.2);
          game.audio && game.audio.play('splash', { x: b.x, y: b.y, z: b.z });
          game.emit('fished', name);
          if (name === 'echo_crystal' || name === 'star_shard') game.hud.toast('钓到了宝物！', `${ITEMS[I[name]].zh}`, 'discover', 2500);
        }
        b.dead = true; game.bobber = null;
        game.inventory.damageHeld(1);
        return true;
      }
      const b = new Bobber();
      const d = lookDir(p.yaw, p.pitch);
      b.setPos(p.x + d[0] * 0.6, p.eyeY - 0.1, p.z + d[2] * 0.6);
      b.vx = d[0] * 12; b.vy = d[1] * 12 + 3; b.vz = d[2] * 12;
      game.entities.add(b);
      game.bobber = b;
      game.audio && game.audio.play('throw');
      return true;
    }
    return prev ? prev(held, def, hit, fresh) : false;
  };
  game.openTrade = (trader) => { game.app.ui.push(new TradeScreen(game, trader)); };
  void B; void ID_MASK;
}
