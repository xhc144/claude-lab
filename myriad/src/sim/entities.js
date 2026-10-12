// Wandering entities summoned by the player: tornadoes that tear across the land, colossal beasts
// that hunt cities until a hero brings them down, and doom comets that approach for years while
// the peoples below pray, panic — or, if they have rockets, try to push them aside.

import { log } from './chronicle.js';
import { pushFx, forDisk, year } from './state.js';
import { meteorImpact, pushImpact } from './geology.js';
import { windAt } from './climate.js';
import { destroyCity } from './civ/city.js';
import { createPerson, fullName } from './civ/people.js';
import { forCreaturesNear, killCreature } from './life/creatures.js';
import { word } from '../core/lang.js';
import { makeLanguage } from '../core/lang.js';
import { IMP } from './constants.js';

export function initEntities(w) {
  w.tornadoes = w.tornadoes || [];
  w.monsters = w.monsters || [];
  w.comets = w.comets || [];
}

export function spawnTornado(w, x, y, power = 1) {
  const a = w.rng.next() * Math.PI * 2;
  const t = { x, y, vx: Math.cos(a) * 0.3, vy: Math.sin(a) * 0.3, life: 24 + w.rng.int(24), power };
  w.tornadoes.push(t);
  return t;
}

const MONSTER_NAMES = ['渊噬', '焚岳', '千足', '影鳞', '骨冠', '雷吼', '蚀月', '裂空', '石心', '覆潮'];

export function spawnMonster(w, x, y, size = 1) {
  const rng = w.rng;
  const lang = makeLanguage(rng.int(1e9));
  const m = {
    id: (w.monsterSeq = (w.monsterSeq || 0) + 1),
    name: rng.pick(MONSTER_NAMES) + '·' + word(lang, rng, { min: 2, max: 2, maxChars: 2 }).z,
    x, y, hp: 600 * size, maxHp: 600 * size, size,
    target: -1, kills: 0, cities: 0, born: w.tick, hue: rng.next() * 360, rest: 0,
  };
  w.monsters.push(m);
  log(w, 'divine', `大地震颤，一头名为「${m.name}」的巨兽从地底苏醒。`, { imp: 2, x, y });
  pushFx(w, { type: 'shockwave', x, y, r: 6, color: [255, 120, 80] });
  return m;
}

export function summonComet(w, years = 30, r = 6) {
  const rng = w.rng;
  const c = { x: rng.range(w.W * 0.15, w.W * 0.85), y: rng.range(w.H * 0.15, w.H * 0.85), eta: years * 4, total: years * 4, r, tried: {} };
  w.comets.push(c);
  log(w, 'divine', `天文学家与祭司们同时注意到一颗新的彗星——它正朝这个世界飞来。距离撞击还有大约 ${years} 年。`, { imp: 3 });
  for (const n of w.nations) if (n.alive) { n.divine.wrath += 2; n.divine.mystery += 1; }
  return c;
}

export function stepEntities(w, rng) {
  // tornadoes
  for (const t of w.tornadoes) {
    t.vx += (windAt(w, Math.max(0, Math.min(w.H - 1, t.y | 0))) * 0.05 - t.vx * 0.05) + (rng.next() - 0.5) * 0.15;
    t.vy += (rng.next() - 0.5) * 0.15 - t.vy * 0.05;
    t.x += t.vx; t.y += t.vy;
    t.life--;
    if (t.x < 0 || t.y < 0 || t.x >= w.W || t.y >= w.H) { t.life = 0; continue; }
    const c = (t.y | 0) * w.W + (t.x | 0);
    if (w.elev[c] < w.seaLevel) t.life -= 2; // weakens over water
    forDisk(w, t.x, t.y, 1.6 * t.power, (cc) => {
      w.veg[cc] *= 0.6;
      if (w.impr[cc] === IMP.FARM && rng.chance(0.3)) w.impr[cc] = IMP.NONE;
    });
    forCreaturesNear(w, t.x, t.y, 1.5 * t.power, (j) => { if (rng.chance(0.4)) killCreature(w, j, 'disaster'); });
    for (const city of w.cities) {
      if (city.alive && Math.abs(city.x + 0.5 - t.x) < 1.6 && Math.abs(city.y + 0.5 - t.y) < 1.6) {
        city.pop *= 0.96;
        if (!city._tornadoLogged || w.tick - city._tornadoLogged > 40) {
          city._tornadoLogged = w.tick;
          log(w, 'nature', `龙卷风横扫${city.name.z}，房屋如纸片般飞上天空。`, { imp: 1, x: city.x, y: city.y, nations: [city.nation] });
        }
      }
    }
  }
  w.tornadoes = w.tornadoes.filter((t) => t.life > 0);

  // colossi
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    if (m.rest > 0) { m.rest--; continue; }
    let target = m.target >= 0 ? w.cities[m.target] : null;
    if (!target || !target.alive) {
      let bd = 1e9;
      target = null;
      for (const c of w.cities) {
        if (!c.alive) continue;
        const d = Math.hypot(c.x - m.x, c.y - m.y) - Math.sqrt(c.pop) * 0.02;
        if (d < bd) { bd = d; target = c; }
      }
      m.target = target ? target.id : -1;
    }
    if (target) {
      const dx = target.x + 0.5 - m.x, dy = target.y + 0.5 - m.y;
      const d = Math.hypot(dx, dy);
      const sp = 0.22;
      if (d > 0.8) { m.x += (dx / d) * sp; m.y += (dy / d) * sp; } else {
        // rampage
        target.pop *= 0.85;
        if (target.buildings.length && rng.chance(0.3)) target.buildings.splice(rng.int(target.buildings.length), 1);
        m.hp -= target.defense * 0.6 + Math.sqrt(target.pop) * 0.05;
        target.defense *= 0.7;
        pushFx(w, { type: 'battle', x: m.x, y: m.y });
        if (target.pop < 300 || rng.chance(0.08)) {
          m.cities++;
          destroyCity(w, target, `被巨兽「${m.name}」摧毁`, { cat: 'divine' });
          m.target = -1;
          m.rest = 8;
        }
      }
    } else {
      m.x += (rng.next() - 0.5) * 0.5; m.y += (rng.next() - 0.5) * 0.5;
    }
    m.x = Math.max(0, Math.min(w.W - 0.01, m.x));
    m.y = Math.max(0, Math.min(w.H - 0.01, m.y));
    forCreaturesNear(w, m.x, m.y, 1.4, (j) => { killCreature(w, j, 'eaten'); m.kills++; });
    // armies fight it
    for (const a of w.armies) {
      if (!a.alive || Math.hypot(a.x - m.x, a.y - m.y) > 2) continue;
      m.hp -= a.str * a.q * 0.02;
      a.str -= 30 * m.size;
      if (a.str < 8) a.alive = false;
      if (m.hp <= 0) slay(w, m, w.nations[a.nation], a);
    }
    if (m.hp <= 0 && !m.slain) slay(w, m, null, null);
  }
  w.monsters = w.monsters.filter((m) => m.hp > 0);

  // doom comets
  for (const c of w.comets) {
    c.eta--;
    if (c.eta % 4 === 0) {
      for (const n of w.nations) {
        if (!n.alive || c.tried[n.id] || !(n.tf && (n.tf.rocketry || n.tf.spaceflight))) continue;
        if (c.eta > c.total * 0.8) continue;
        c.tried[n.id] = true;
        const p = n.tf.spaceflight ? 0.7 : 0.3;
        if (rng.chance(p)) {
          c.deflected = true;
          log(w, 'science', `${n.name}发射的火箭撞上了彗星，将它推离了轨道。全世界都在欢呼。`, { imp: 3, nations: [n.id] });
          n.stability = Math.min(1, n.stability + 0.2);
          for (const m of w.nations) if (m.alive && m !== n && m.rel[n.id]) m.rel[n.id].op = Math.min(100, m.rel[n.id].op + 30);
          break;
        } else log(w, 'science', `${n.name}试图用火箭拦截彗星，但失败了。`, { imp: 2, nations: [n.id] });
      }
    }
    if (!c.deflected && c.eta === Math.round(c.total / 2)) log(w, 'faith', '彗星已清晰可见，白昼也能看到。各地出现了末日教派，人们在神庙前日夜祈祷。', { imp: 2 });
    if (!c.deflected && c.eta <= 0) {
      log(w, 'nature', `彗星坠落了。${year(w)} 年，天空燃烧，大地崩裂。`, { imp: 3, x: c.x, y: c.y });
      pushFx(w, { type: 'meteorFall', x: c.x, y: c.y, r: c.r });
      meteorImpact(w, c.x, c.y, c.r, rng);
    }
  }
  w.comets = w.comets.filter((c) => !c.deflected && c.eta > 0);
}

function slay(w, m, n, army) {
  m.slain = true;
  m.hp = 0;
  if (n) {
    const hero = createPerson(w, n, 'hero', { age: 28 });
    hero.deeds.push(`斩杀巨兽「${m.name}」`);
    if (army) { const cap = w.cities[army.home]; if (cap) cap.culture += 600; }
    log(w, 'war', `${n.adj}英雄${fullName(hero)}率军斩杀了巨兽「${m.name}」。它曾毁灭 ${m.cities} 座城市，从此成为传说。`, { imp: 3, x: m.x, y: m.y, nations: [n.id] });
  } else log(w, 'divine', `巨兽「${m.name}」力竭倒下，庞大的骸骨成了一座山丘。`, { imp: 2, x: m.x, y: m.y });
  pushImpact(w, { kind: 'none', x: m.x, y: m.y, r: 0 });
}
