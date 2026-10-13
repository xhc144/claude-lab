// First-person view model: the held item (or bare arm) with swing, equip, eating and bow poses.

import { mat4, identity, translate, rotateX, rotateY, rotateZ, scale } from '../core/math.js';
import { MeshBuilder } from '../render/itemmesh.js';
import { ITEMS } from '../world/items.js';

export function installHand(game) {
  let equip = 0, lastId = -1, armMesh = null;
  const M = mat4();
  game.addSystem({
    frame(g, dt) {
      const held = g.inventory.held();
      const id = held ? held.id : -1;
      if (id !== lastId) { equip = 1; lastId = id; }
      equip = Math.max(0, equip - dt * 5);
    },
    renderOverlay(g, r) {
      if (g.thirdPerson || g.player.dead || !g.hud.visible) return;
      const p = g.player;
      r.beginHand(70 * Math.PI / 180);
      const l = g.world.getLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z));
      const light = [(l & 15) / 15, ((l >> 4) & 15) / 15, ((l >> 8) & 15) / 15, ((l >> 12) & 15) / 15];
      if (p.effects.glow) light[1] = Math.max(light[1], 0.6), light[2] = Math.max(light[2], 0.8), light[3] = Math.max(light[3], 0.9);
      const held = g.inventory.held();
      const sw = g.interaction.swing;          // 1 -> 0
      const s = 1 - sw;
      const swingA = sw > 0 ? Math.sin(s * Math.PI) : 0;
      const bobX = Math.sin(p.bob * Math.PI) * 0.025 * p.bobAmt, bobY = -Math.abs(Math.cos(p.bob * Math.PI)) * 0.03 * p.bobAmt;
      const u = g.using;
      identity(M);
      if (!held) {
        if (!armMesh) {
          const mb = new MeshBuilder();
          mb.box(-0.07, -0.07, -0.42, 0.07, 0.07, 0.1, [0.93, 0.76, 0.62, 1]);
          mb.box(-0.085, -0.085, 0.0, 0.085, 0.085, 0.3, [0.16, 0.48, 0.52, 1]);
          armMesh = mb.build(r);
        }
        translate(M, M, 0.42 + bobX - swingA * 0.18, -0.4 + bobY - equip * 0.5 + swingA * 0.12, -0.55 - swingA * 0.2);
        rotateY(M, M, 0.25 + swingA * 0.5);
        rotateX(M, M, 0.25 - swingA * 0.9);
        r.drawMesh(armMesh, M, light);
        return;
      }
      const mesh = g.itemMeshes.get(held.id);
      const def = ITEMS[held.id];
      const block = mesh.kind === 'block';
      if (u && u.kind === 'eat') {
        const t = u.t;
        translate(M, M, 0.12 + Math.sin(t * 22) * 0.012, -0.32 + Math.abs(Math.sin(t * 22)) * 0.025, -0.62);
        rotateY(M, M, -0.6);
        rotateX(M, M, 0.4);
      } else if (u && u.kind === 'bow') {
        const pull = Math.min(1, u.t);
        translate(M, M, 0.08, -0.22, -0.7 + pull * 0.12);
        rotateZ(M, M, 0.15);
        rotateY(M, M, -Math.PI / 2 + 0.1);
        translate(M, M, (Math.random() - 0.5) * 0.004 * pull, (Math.random() - 0.5) * 0.004 * pull, 0);
      } else {
        translate(M, M, 0.56 + bobX - swingA * 0.28, -0.5 + bobY - equip * 0.55 + swingA * 0.16, -0.95 - swingA * 0.18);
        if (block) {
          rotateX(M, M, -swingA * 0.6);
          rotateY(M, M, Math.PI / 4 + swingA * 0.3);
        } else {
          rotateY(M, M, -Math.PI / 2 + 0.25 + swingA * 0.4);
          rotateZ(M, M, 0.45 - swingA * 1.1);
          if (def.tool && ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'].includes(def.tool.type)) rotateZ(M, M, 0.25);
        }
      }
      const sc = block ? 0.28 : 0.3;
      scale(M, M, sc, sc, sc);
      r.drawMesh(mesh, M, light, null, g.itemGlows(held.id) ? 0.6 : 0);
    },
  });
}
