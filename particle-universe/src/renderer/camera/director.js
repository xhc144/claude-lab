// Auto camera ("director"): picks cinematic shots from each scene's shot list, holds them for a
// number of bars, blends or cuts between them on musical boundaries, and adds audio-driven
// camera dynamics (push-ins on build-ups, FOV kicks on beats, low-frequency shake).
import { vec3 } from 'gl-matrix';
import { makePose, copyPose, lerpPose, smoother } from './camera.js';
import { snoise1 } from '../core/noise1.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = (rng, r) => (Array.isArray(r) ? r[0] + (r[1] - r[0]) * rng() : r);
const sph = (out, c, yaw, pitch, dist) => {
  const cp = Math.cos(pitch);
  return vec3.set(out, c[0] + Math.sin(yaw) * cp * dist, c[1] + Math.sin(pitch) * dist, c[2] + Math.cos(yaw) * cp * dist);
};

const STYLES = {
  smooth: { bars: [8, 16, 16], cutChance: 0, blend: [4, 6], shake: 0.5, punch: 0.6 },
  cinematic: { bars: [4, 8, 8, 16], cutChance: 0.35, blend: [2.5, 4], shake: 1, punch: 1 },
  energetic: { bars: [2, 4, 4, 8], cutChance: 0.75, blend: [1.2, 2], shake: 1.6, punch: 1.5 }
};

// Instantiate a shot description with random parameters.
function makeShot(desc, rng, scene) {
  const c = desc.target || scene.camera.target || [0, 0, 0];
  const s = { type: desc.type, desc, t: 0 };
  s.center = vec3.fromValues(c[0] + R(rng, desc.jitter || 0) * (rng() - 0.5), c[1], c[2] + R(rng, desc.jitter || 0) * (rng() - 0.5));
  s.yaw0 = desc.yaw != null ? R(rng, desc.yaw) : rng() * Math.PI * 2;
  s.dir = rng() < 0.5 ? -1 : 1;
  s.speed = R(rng, desc.speed || [0.03, 0.07]) * s.dir;
  s.pitch0 = R(rng, desc.pitch || [0.1, 0.4]);
  s.pitch1 = desc.pitchTo ? R(rng, desc.pitchTo) : s.pitch0;
  s.dist0 = R(rng, desc.dist || [18, 26]);
  s.dist1 = desc.distTo ? R(rng, desc.distTo) : s.dist0;
  s.fov = R(rng, desc.fov || [42, 55]);
  s.roll = R(rng, desc.roll || 0) * (rng() < 0.5 ? -1 : 1);
  s.dur = R(rng, desc.dur || [10, 18]);
  s.lookOff = vec3.fromValues(R(rng, desc.lookJitter || 0) * (rng() - 0.5), R(rng, desc.lookJitter || 0) * (rng() - 0.5) * 0.5, 0);
  s.phase = rng() * 100;
  return s;
}

function evalShot(s, out, audio, scene) {
  const t = s.t;
  const u = Math.min(1, t / s.dur);
  const e = smoother(u);
  const d = s.desc;
  const breathe = Math.sin(t * 0.21 + s.phase) * 0.04;
  switch (s.type) {
    case 'dolly': {
      const dist = s.dist0 + (s.dist1 - s.dist0) * e;
      const pitch = s.pitch0 + (s.pitch1 - s.pitch0) * e;
      sph(out.pos, s.center, s.yaw0 + s.speed * t, pitch, dist * (1 + breathe));
      break;
    }
    case 'spiral': {
      const dist = s.dist0 + (s.dist1 - s.dist0) * e;
      const pitch = s.pitch0 + (s.pitch1 - s.pitch0) * e;
      sph(out.pos, s.center, s.yaw0 + s.speed * 3 * t, pitch, dist);
      break;
    }
    case 'fly': {
      // straight pass through the volume
      const dir = [Math.sin(s.yaw0), Math.sin(s.pitch0) * 0.5, Math.cos(s.yaw0)];
      const len = s.dist0;
      const x = (e - 0.5) * 2 * len;
      const side = d.offset != null ? d.offset : 3;
      vec3.set(out.pos, s.center[0] + dir[0] * x + dir[2] * side, s.center[1] + dir[1] * x + (d.height || 0), s.center[2] + dir[2] * x - dir[0] * side);
      vec3.set(out.target, out.pos[0] + dir[0] * 10 - dir[2] * side * 0.6, out.pos[1] - (d.height || 0) * 0.3, out.pos[2] + dir[2] * 10 + dir[0] * side * 0.6);
      out.fov = s.fov;
      out.roll = s.roll * Math.sin(t * 0.3);
      return out;
    }
    case 'fixed': {
      // tunnel / first-person: camera at a point, looking along -z with slow sway
      const p = d.pos || [0, 0, 0];
      vec3.set(out.pos, p[0] + Math.sin(t * 0.13 + s.phase) * 0.6, p[1] + Math.cos(t * 0.11 + s.phase) * 0.45, p[2]);
      const ly = Math.sin(t * 0.09 + s.phase) * (d.sway || 0.15);
      vec3.set(out.target, out.pos[0] + ly * 10 + s.lookOff[0], out.pos[1] + Math.sin(t * 0.08) * (d.sway || 0.15) * 6 + s.lookOff[1], out.pos[2] - 10);
      out.fov = s.fov;
      out.roll = s.roll + Math.sin(t * 0.05 + s.phase) * 0.35 * (d.rollAmt || 1) + s.speed * t * (d.spin || 0);
      return out;
    }
    case 'orbit':
    default: {
      const pitch = s.pitch0 + (s.pitch1 - s.pitch0) * e + Math.sin(t * 0.17 + s.phase) * 0.05;
      const dist = s.dist0 + (s.dist1 - s.dist0) * e;
      sph(out.pos, s.center, s.yaw0 + s.speed * t, pitch, dist * (1 + breathe));
    }
  }
  vec3.add(out.target, s.center, s.lookOff);
  out.fov = s.fov;
  out.roll = s.roll * (0.6 + 0.4 * Math.sin(t * 0.12 + s.phase));
  return out;
}

export class Director {
  constructor() {
    this.style = 'cinematic';
    this.shakeAmt = 1;
    this.scene = null;
    this.shot = null;
    this.prev = null;
    this.blendT = 1;
    this.blendDur = 3;
    this.rng = mulberry32(1);
    this.barsLeft = 8;
    this.lastBar = -1;
    this.pose = makePose();
    this.basePose = makePose();
    this.tmpA = makePose();
    this.tmpB = makePose();
    this.time = 0;
    this.kickPunch = 0;
    this.cutFlash = 0;
    this.onCut = null;
  }

  reset(seed = 1) {
    this.rng = mulberry32(seed);
    this.time = 0;
    this.shot = null;
    this.prev = null;
  }

  setScene(scene, { blend = 3.5, from = null } = {}) {
    this.scene = scene;
    const st = STYLES[this.style] || STYLES.cinematic;
    const shots = scene.camera.shots;
    const first = shots.find((s) => s.establish) || shots[0];
    if (from) { this.prev = { frozen: copyPose(from) }; } else if (this.shot) this.prev = this.shot;
    this.shot = makeShot(first, this.rng, scene);
    this.blendT = 0;
    this.blendDur = this.prev ? blend : 0.0001;
    this.barsLeft = st.bars[Math.floor(this.rng() * st.bars.length)];
  }

  _next(cut) {
    const st = STYLES[this.style] || STYLES.cinematic;
    const shots = this.scene.camera.shots;
    let total = 0;
    for (const s of shots) total += s.weight || 1;
    let pick = this.rng() * total, desc = shots[0];
    for (const s of shots) { pick -= s.weight || 1; if (pick <= 0) { desc = s; break; } }
    this.prev = cut ? null : this.shot;
    this.shot = makeShot(desc, this.rng, this.scene);
    this.blendT = 0;
    this.blendDur = cut ? 0.0001 : st.blend[0] + (st.blend[1] - st.blend[0]) * this.rng();
    this.barsLeft = st.bars[Math.floor(this.rng() * st.bars.length)];
    if (cut && this.onCut) this.onCut();
  }

  // audio: AudioFrame (visual-scaled); events: {drop, downbeat}
  update(dt, audio, events) {
    if (!this.scene) return this.pose;
    const st = STYLES[this.style] || STYLES.cinematic;
    this.time += dt;
    if (!this.shot) this.setScene(this.scene);
    // musical clock: count bars (or fall back to seconds)
    let barTick = false;
    if (audio.active && audio.hasTempo) {
      if (audio.bar !== this.lastBar) { if (this.lastBar >= 0) barTick = true; this.lastBar = audio.bar; }
    } else {
      const fake = Math.floor(this.time / 2.2);
      if (fake !== this.lastBar) { if (this.lastBar >= 0) barTick = true; this.lastBar = fake; }
    }
    if (barTick) this.barsLeft--;
    if (events.drop) {
      this._next(true);
    } else if (barTick && this.barsLeft <= 0 && this.blendT >= 1) {
      const cut = this.rng() < st.cutChance && (audio.kick > 0.4 || !audio.active);
      this._next(cut);
    }
    const speedBoost = 1 + (audio.intensity || 0) * 0.6 + (audio.drop || 0) * 1.2;
    this.shot.t += dt * speedBoost;
    evalShot(this.shot, this.tmpB, audio, this.scene);
    let base;
    if (this.prev && this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / this.blendDur);
      let a;
      if (this.prev.frozen) a = this.prev.frozen;
      else { this.prev.t += dt * speedBoost; a = evalShot(this.prev, this.tmpA, audio, this.scene); }
      base = lerpPose(a, this.tmpB, smoother(this.blendT), this.basePose);
    } else {
      this.blendT = 1;
      base = copyPose(this.tmpB, this.basePose);
    }
    // dynamics: build-up push-in, beat FOV kicks, bass shake
    const out = copyPose(base, this.pose);
    const toT = vec3.sub(vec3.create(), out.pos, out.target);
    const push = 1 - (audio.build || 0) * 0.22 + (audio.drop || 0) * 0.08;
    if (this.scene.camera.mode !== 'look') vec3.scaleAndAdd(out.pos, out.target, toT, push);
    this.kickPunch += ((audio.kick || 0) - this.kickPunch) * Math.min(1, dt * 30);
    out.fov += this.kickPunch * 2.2 * st.punch * this.shakeAmt + (audio.drop || 0) * 6;
    const amp = this.shakeAmt * st.shake * ((audio.bass || 0) * 0.012 + (audio.kick || 0) * 0.02 + (audio.drop || 0) * 0.05) * Math.max(4, vec3.length(toT));
    const tt = this.time * 7;
    out.pos[0] += snoise1(tt) * amp; out.pos[1] += snoise1(tt + 31.7) * amp; out.pos[2] += snoise1(tt + 77.1) * amp * 0.5;
    out.roll += snoise1(tt * 0.5 + 9.1) * amp * 0.01;
    return out;
  }
}
