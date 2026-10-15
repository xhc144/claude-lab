// Musical event extraction and automatic scene switching (shared by live playback and export).
import { SCENES } from '../scenes/index.js';

export function makeEvents() {
  return { kicks: [], snares: [], hats: [], drop: false, section: false, downbeat: false };
}

export function collectEvents(analysis, t0, t1, ev) {
  ev.kicks.length = 0; ev.snares.length = 0; ev.hats.length = 0;
  ev.drop = false; ev.section = false; ev.downbeat = false;
  if (!analysis || !(t1 > t0) || t1 - t0 > 0.5) return ev;
  analysis.eventsBetween(analysis.kicks, t0, t1, (t, s) => ev.kicks.push({ t, strength: s }));
  analysis.eventsBetween(analysis.snares, t0, t1, (t, s) => ev.snares.push({ t, strength: s }));
  analysis.eventsBetween(analysis.hats, t0, t1, (t, s) => ev.hats.push({ t, strength: s }));
  analysis.timesBetween(analysis.drops, t0, t1, () => { ev.drop = true; });
  analysis.timesBetween(analysis.sections, t0, t1, () => { ev.section = true; });
  analysis.timesBetween(analysis.downbeats, t0, t1, () => { ev.downbeat = true; });
  return ev;
}

export function liveEvents(analyzer, ev) {
  ev.kicks.length = 0; ev.snares.length = 0; ev.hats.length = 0;
  ev.drop = false; ev.section = false; ev.downbeat = false;
  for (const e of analyzer.events) {
    if (e.type === 'kick') ev.kicks.push({ t: 0, strength: e.strength });
    else if (e.type === 'snare') ev.snares.push({ t: 0, strength: e.strength });
    else if (e.type === 'hat') ev.hats.push({ t: 0, strength: e.strength });
    else if (e.type === 'drop') ev.drop = true;
  }
  return ev;
}

export class SceneScheduler {
  constructor(settings, rng = Math.random) {
    this.settings = settings;
    this.rng = rng;
    this.since = 0;
    this.recent = [];
    this.armed = -1;
  }

  reset(rng) { if (rng) this.rng = rng; this.since = 0; this.armed = -1; }

  note(id) {
    this.since = 0;
    this.recent.push(id);
    if (this.recent.length > 3) this.recent.shift();
  }

  pick(currentId) {
    const pool = SCENES.filter((s) => s.id !== currentId && !this.recent.includes(s.id));
    const list = pool.length ? pool : SCENES.filter((s) => s.id !== currentId);
    return list[Math.floor(this.rng() * list.length) % list.length].id;
  }

  // Returns a scene id to switch to (or null). `lead` = seconds of fade before the morph begins.
  update(dt, { analysis, t, events, frame, currentId, busy, playing, lead = 0.32 }) {
    const mode = this.settings.scene.autoSwitch;
    this.since += dt;
    if (mode === 'off' || busy) return null;
    const interval = Math.max(15, this.settings.scene.interval || 60);
    if (!playing) return this.since > 40 ? this.pick(currentId) : null;
    if (mode === 'timer') {
      if (this.since >= interval && (events.downbeat || !frame.hasTempo)) return this.pick(currentId);
      return null;
    }
    if (analysis) {
      const td = analysis.nextTime(analysis.drops, t);
      if (td !== this.armed && td - t <= lead && td - t > -0.05 && this.since > 18) {
        this.armed = td;
        return this.pick(currentId);
      }
      if (events.section && this.since > 36 && analysis.nextTime(analysis.drops, t) - t > 8) return this.pick(currentId);
      if (this.since > 80 && (events.downbeat || !analysis.hasTempo)) return this.pick(currentId);
      return null;
    }
    if (events.drop && this.since > 24) return this.pick(currentId);
    if (this.since > 70 && (events.downbeat || !frame.hasTempo)) return this.pick(currentId);
    return null;
  }
}
