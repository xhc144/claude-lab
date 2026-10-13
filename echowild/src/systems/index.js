// Wires every gameplay system into a Game instance.

import { EntityManager } from '../entity/entities.js';
import { Particles } from '../render/particles.js';
import { ItemMeshes } from '../render/itemmesh.js';
import { Audio } from '../audio/audio.js';
import { installSurvival } from './survival.js';
import { installHand } from './hand.js';
import { installMobs } from '../entity/mobs.js';
import { installFishing } from './fishing.js';
import { installFluids } from './fluids.js';
import { installPlants } from './plants.js';
import { installWeather } from './weather.js';
import { installEvents } from './events.js';
import { installCircuits } from './circuits.js';
import { installMachines } from './machines.js';
import { installTransport } from './transport.js';
import { installAdventure } from './adventure.js';
import { installWorldMap } from './worldmap.js';
import { installCodex } from './codex.js';
import { installJourney } from './journey.js';
import { installVillage } from './village.js';
import { ChatScreen } from '../ui/chat.js';
import { TICK } from '../game.js';

let sharedAudio = null;

export function installSystems(game, state) {
  game.entities = new EntityManager(game);
  game.particles = new Particles(game);
  game.itemMeshes = new ItemMeshes(game.renderer);
  if (!sharedAudio) sharedAudio = new Audio(game.settings);
  sharedAudio.settings = game.settings;
  sharedAudio.applyVolume();
  game.audio = sharedAudio;
  game.stateSavers = [];
  // world rules (creative world controls / cheats)
  game.rules = Object.assign({ daylightCycle: true, weatherCycle: true, mobSpawning: true, keepInventory: false }, state && state.rules);
  game.stateSavers.push((s) => { s.rules = { ...game.rules }; });
  if (state) {
    if (state.dayTime !== undefined) game.dayTime = state.dayTime;
    if (state.day) game.day = state.day;
    if (state.ticks) game.world.time = state.ticks;
  }

  installSurvival(game, state);
  installHand(game);
  installMobs(game);
  installFishing(game);
  installFluids(game);
  installPlants(game);
  installWeather(game, state);
  installEvents(game, state);
  installCircuits(game);
  installMachines(game);
  installTransport(game);
  installAdventure(game, state);
  installVillage(game, state);
  installWorldMap(game, state);
  installCodex(game, state);
  installJourney(game, state);

  // entity ticking, particles, audio, rendering
  game.addSystem({
    tick(g) { g.entities.tick(TICK); },
    frame(g, dt) { g.particles.frame(dt); g.audio.update(g, dt); },
    renderOpaque(g, r) { g.entities.render(r, Math.min(1, g.acc / TICK)); },
    renderShadow(g, r) { g.entities.render(r, Math.min(1, g.acc / TICK)); },
    renderTranslucent(g, r) { g.particles.render(r); },
  });

  // chunk persistence of entities
  game.entities.serializeChunk = (chunk) => {
    const out = [];
    const bx = chunk.cx * 16, bz = chunk.cz * 16;
    for (const e of game.entities.list) {
      if (e.dead || e.persist === false) continue;
      if (e.x < bx || e.x >= bx + 16 || e.z < bz || e.z >= bz + 16) continue;
      const s = e.serialize();
      if (s) out.push(s);
    }
    return out;
  };
  game.chunks.onChunkLoaded.push((c) => {
    if (c.savedEntities) { game.entities.restore(c.savedEntities); c.savedEntities = null; }
    if (c.features && c.features.length && game.onFeatures) game.onFeatures(c, c.features);
  });
  game.chunks.onChunkUnload.push((c) => {
    if (!game.store) return;
    const ents = game.entities.takeChunkEntities(c);
    if (c.modified || ents.length) {
      game.store.saveChunk(c, ents).catch((e) => console.error('chunk save failed', e));
      game.chunks.savedIndex.add(c.key);
    }
  });

  game.openChat = (prefix) => game.app.ui.push(new ChatScreen(game, prefix));
  game.teleport = (x, y, z) => {
    const p = game.player;
    p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.fallStart = null;
  };

  game.serializeState = () => {
    const s = {
      v: 1,
      player: game.serializePlayer(),
      dayTime: game.dayTime, day: game.day, ticks: game.world.time,
      discovered: [...game.discovered],
      spawnPoint: game.spawnPoint,
      deathPoint: game.deathPoint || null,
    };
    for (const f of game.stateSavers) f(s);
    return s;
  };

  // optional systems (installed if present)
  for (const mod of game.optionalSystems || []) mod(game, state);
}
