// Procedural audio: every sound effect, ambience and the music are synthesised with WebAudio.

import { BLOCKS, ID_MASK } from '../world/blocks.js';

const MATERIAL = (id) => {
  const d = BLOCKS[id];
  return d ? d.sound || 'stone' : 'stone';
};

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.enabled = false;
    this.listener = { x: 0, y: 0, z: 0 };
    this.lastPlay = new Map();
    this.musicNext = 20 + Math.random() * 40;
    this.musicPlaying = false;
    this.ambient = { rain: 0, wind: 0, cave: 0, water: 0, lava: 0 };
    const unlock = () => { this.init(); };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.comp.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.connect(this.comp);
    this.musicGain = ctx.createGain(); this.musicGain.connect(this.comp);
    this.ambGain = ctx.createGain(); this.ambGain.connect(this.comp);
    // reverb send
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.2);
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0.25;
    this.revSend.connect(this.reverb); this.reverb.connect(this.comp);
    // noise buffers
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02; b[i] = last * 3.5; }
    this.startAmbience();
    this.enabled = true;
    this.applyVolume();
  }

  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  applyVolume() {
    if (!this.ctx) return;
    this.sfx.gain.value = this.settings.volume;
    this.ambGain.gain.value = this.settings.volume * 0.8;
    this.musicGain.gain.value = this.settings.music * 0.55;
  }

  // ------------------------------------------------------------ building blocks
  out(pos, vol = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = vol;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 2.5; p.maxDistance = 48; p.rolloffFactor = 1.1;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p); p.connect(this.sfx);
      const dx = pos.x - this.listener.x, dy = pos.y - this.listener.y, dz = pos.z - this.listener.z;
      if (dx * dx + dy * dy + dz * dz > 48 * 48) return null;
    } else g.connect(this.sfx);
    if (this.inCave) g.connect(this.revSend);
    return g;
  }
  noiseBurst(dest, t, dur, { type = 'bandpass', freq = 1000, q = 1, vol = 0.5, attack = 0.002, brown = false, sweep = 0 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }
  tone(dest, t, freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = 0, detune = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  throttle(key, ms) {
    const now = performance.now();
    if ((this.lastPlay.get(key) || 0) > now - ms) return false;
    this.lastPlay.set(key, now);
    return true;
  }

  // ------------------------------------------------------------ material sounds
  material(mat, dest, t, vol, kind) {
    const k = kind === 'dig' ? 1.4 : kind === 'step' ? 0.55 : 1;
    switch (mat) {
      case 'grass': case 'plant':
        this.noiseBurst(dest, t, 0.12 * k, { type: 'lowpass', freq: 2200, vol: 0.5 * vol });
        this.noiseBurst(dest, t + 0.03, 0.08 * k, { type: 'bandpass', freq: 3500, q: 0.8, vol: 0.2 * vol });
        break;
      case 'gravel':
        for (let i = 0; i < 4; i++) this.noiseBurst(dest, t + i * 0.025, 0.05 * k, { type: 'bandpass', freq: 900 + Math.random() * 900, q: 2, vol: 0.4 * vol });
        break;
      case 'sand':
        this.noiseBurst(dest, t, 0.14 * k, { type: 'highpass', freq: 2400, vol: 0.32 * vol });
        break;
      case 'snow': case 'cloth':
        this.noiseBurst(dest, t, 0.13 * k, { type: 'lowpass', freq: 900, vol: 0.5 * vol, brown: true });
        this.noiseBurst(dest, t + 0.02, 0.06 * k, { type: 'bandpass', freq: 2200, vol: 0.12 * vol });
        break;
      case 'wood':
        this.noiseBurst(dest, t, 0.08 * k, { type: 'bandpass', freq: 600, q: 3, vol: 0.55 * vol });
        this.tone(dest, t, 180 + Math.random() * 40, 0.09 * k, { type: 'triangle', vol: 0.25 * vol, slide: 0.7 });
        break;
      case 'glass':
        this.tone(dest, t, 2400 + Math.random() * 600, 0.15, { vol: 0.14 * vol });
        this.tone(dest, t, 3800 + Math.random() * 600, 0.1, { vol: 0.08 * vol });
        this.noiseBurst(dest, t, 0.07, { type: 'highpass', freq: 4000, vol: 0.25 * vol });
        break;
      case 'crystal':
        this.tone(dest, t, 1320 * (1 + Math.random() * 0.2), 0.35, { vol: 0.12 * vol });
        this.tone(dest, t, 1980 * (1 + Math.random() * 0.2), 0.25, { vol: 0.07 * vol });
        this.noiseBurst(dest, t, 0.05, { type: 'bandpass', freq: 3000, vol: 0.15 * vol });
        break;
      case 'metal':
        this.noiseBurst(dest, t, 0.06, { type: 'bandpass', freq: 1800, q: 4, vol: 0.4 * vol });
        this.tone(dest, t, 740 + Math.random() * 60, 0.25 * k, { type: 'triangle', vol: 0.1 * vol });
        this.tone(dest, t, 1110, 0.2 * k, { vol: 0.05 * vol });
        break;
      case 'gel':
        this.tone(dest, t, 220, 0.15, { vol: 0.3 * vol, slide: 1.8, type: 'sine' });
        break;
      case 'water':
        this.noiseBurst(dest, t, 0.25, { type: 'lowpass', freq: 1200, vol: 0.35 * vol, sweep: 0.4 });
        break;
      default: // stone
        this.noiseBurst(dest, t, 0.07 * k, { type: 'bandpass', freq: 1100 + Math.random() * 300, q: 1.6, vol: 0.55 * vol });
        this.noiseBurst(dest, t, 0.04 * k, { type: 'highpass', freq: 3000, vol: 0.12 * vol });
    }
  }

  step(blockId, vol = 0.35) {
    if (!this.enabled || !blockId) return;
    const dest = this.out(null, vol);
    if (dest) this.material(MATERIAL(blockId & ID_MASK), dest, this.ctx.currentTime, 0.7, 'step');
  }
  hit(blockId, pos) {
    if (!this.enabled || !this.throttle('hit', 60)) return;
    const dest = this.out(pos, 0.45);
    if (dest) this.material(MATERIAL(blockId), dest, this.ctx.currentTime, 0.8, 'hit');
  }
  dig(blockId, pos) {
    if (!this.enabled) return;
    const dest = this.out(pos, 0.85);
    if (dest) this.material(MATERIAL(blockId), dest, this.ctx.currentTime, 1, 'dig');
  }
  place(blockId, pos) {
    if (!this.enabled) return;
    const dest = this.out(pos, 0.75);
    if (!dest) return;
    const t = this.ctx.currentTime;
    this.material(MATERIAL(blockId), dest, t, 0.9, 'place');
    this.tone(dest, t, 90, 0.08, { vol: 0.3, slide: 0.6 });
  }

  // ------------------------------------------------------------ named effects
  play(name, o = {}) {
    if (!this.enabled) return;
    if (!this.throttle(name, o.minGap || 25)) return;
    const pos = o.x !== undefined ? { x: o.x, y: o.y, z: o.z } : null;
    const dest = this.out(pos, o.volume ?? 1);
    if (!dest) return;
    const t = this.ctx.currentTime;
    const p = o.pitch || 1;
    switch (name) {
      case 'pickup': this.tone(dest, t, 620 * p, 0.09, { vol: 0.16, slide: 1.9 }); this.tone(dest, t + 0.03, 1250 * p, 0.07, { vol: 0.08 }); break;
      case 'swish': this.noiseBurst(dest, t, 0.12, { type: 'bandpass', freq: 1400, q: 0.6, vol: 0.15, sweep: 2.5 }); break;
      case 'craft':
        [523, 659, 784].forEach((f, i) => this.tone(dest, t + i * 0.05, f, 0.35, { type: 'triangle', vol: 0.11 }));
        this.noiseBurst(dest, t, 0.08, { type: 'bandpass', freq: 600, q: 2, vol: 0.2 });
        break;
      case 'discover': [659, 784, 988, 1319].forEach((f, i) => this.tone(dest, t + i * 0.09, f, 0.6, { vol: 0.09 })); dest.connect(this.revSend); break;
      case 'quest': [392, 494, 587, 784, 988].forEach((f, i) => { this.tone(dest, t + i * 0.14, f, 1.2, { vol: 0.11, type: 'triangle' }); this.tone(dest, t + i * 0.14, f * 2, 1, { vol: 0.04 }); }); dest.connect(this.revSend); break;
      case 'chest_open': this.noiseBurst(dest, t, 0.2, { type: 'bandpass', freq: 400, q: 4, vol: 0.4, sweep: 1.6 }); this.tone(dest, t, 140, 0.2, { type: 'triangle', vol: 0.15, slide: 1.4 }); break;
      case 'chest_close': this.noiseBurst(dest, t, 0.12, { type: 'bandpass', freq: 500, q: 3, vol: 0.45, sweep: 0.6 }); this.tone(dest, t + 0.08, 110, 0.1, { vol: 0.3 }); break;
      case 'door_open': this.noiseBurst(dest, t, 0.3, { type: 'bandpass', freq: 700, q: 6, vol: 0.3, sweep: 1.5 }); break;
      case 'door_close': this.noiseBurst(dest, t, 0.08, { type: 'bandpass', freq: 400, q: 2, vol: 0.5 }); this.tone(dest, t, 100, 0.12, { vol: 0.35, slide: 0.6 }); break;
      case 'fizz': this.noiseBurst(dest, t, 0.45, { type: 'highpass', freq: 3000, vol: 0.3 }); break;
      case 'fuse': this.noiseBurst(dest, t, 1.2, { type: 'highpass', freq: 5000, vol: 0.18 }); break;
      case 'ignite': this.noiseBurst(dest, t, 0.25, { type: 'bandpass', freq: 2500, q: 1, vol: 0.3, sweep: 0.5 }); break;
      case 'explosion':
        this.noiseBurst(dest, t, 1.8, { type: 'lowpass', freq: 900, vol: 1.2, brown: true, sweep: 0.15 });
        this.noiseBurst(dest, t, 0.4, { type: 'lowpass', freq: 3000, vol: 0.6, sweep: 0.2 });
        this.tone(dest, t, 55, 1.2, { vol: 0.7, slide: 0.5 });
        dest.connect(this.revSend);
        break;
      case 'throw': this.noiseBurst(dest, t, 0.15, { type: 'bandpass', freq: 900, q: 0.8, vol: 0.2, sweep: 2 }); break;
      case 'bow': this.tone(dest, t, 180 * p, 0.2, { type: 'triangle', vol: 0.3, slide: 0.5 }); this.noiseBurst(dest, t, 0.15, { type: 'highpass', freq: 2000, vol: 0.2 }); break;
      case 'arrow_hit': this.noiseBurst(dest, t, 0.05, { type: 'bandpass', freq: 1600, q: 3, vol: 0.5 }); this.tone(dest, t, 300, 0.1, { type: 'triangle', vol: 0.15, slide: 0.7 }); break;
      case 'bucket_fill': this.noiseBurst(dest, t, 0.5, { type: 'bandpass', freq: 500, q: 1, vol: 0.35, sweep: 3 }); break;
      case 'bucket_empty': this.noiseBurst(dest, t, 0.6, { type: 'bandpass', freq: 1500, q: 1, vol: 0.35, sweep: 0.3 }); break;
      case 'bucket_lava': this.noiseBurst(dest, t, 0.6, { type: 'lowpass', freq: 400, vol: 0.5, brown: true }); break;
      case 'eat': this.noiseBurst(dest, t, 0.09, { type: 'bandpass', freq: 1200 * p, q: 1.5, vol: 0.3 }); break;
      case 'burp': this.tone(dest, t, 130, 0.25, { type: 'sawtooth', vol: 0.06, slide: 0.7 }); this.tone(dest, t + 0.05, 520, 0.3, { vol: 0.06, slide: 1.3 }); break;
      case 'hit_mob': this.noiseBurst(dest, t, 0.08, { type: 'bandpass', freq: 800, q: 1, vol: 0.5 }); this.tone(dest, t, 160, 0.1, { vol: 0.3, slide: 0.6 }); break;
      case 'crit': this.noiseBurst(dest, t, 0.1, { type: 'bandpass', freq: 1200, q: 1, vol: 0.6 }); this.tone(dest, t, 900, 0.18, { vol: 0.12, slide: 1.6 }); this.tone(dest, t, 1350, 0.15, { vol: 0.08 }); break;
      case 'hurt': this.tone(dest, t, 330 * p, 0.18, { type: 'triangle', vol: 0.35, slide: 0.55 }); this.noiseBurst(dest, t, 0.06, { type: 'lowpass', freq: 1500, vol: 0.3 }); break;
      case 'death': [440, 392, 330, 262].forEach((f, i) => this.tone(dest, t + i * 0.22, f, 0.6, { type: 'triangle', vol: 0.14 })); break;
      case 'pop': this.tone(dest, t, 400 * p, 0.08, { vol: 0.3, slide: 2.4 }); break;
      case 'break_tool': this.noiseBurst(dest, t, 0.2, { type: 'highpass', freq: 2500, vol: 0.4 }); this.tone(dest, t, 1500, 0.3, { vol: 0.1, slide: 0.4 }); break;
      case 'boing': this.tone(dest, t, 160 * p, 0.35, { type: 'sine', vol: 0.45, slide: 2.6 }); this.tone(dest, t, 320 * p, 0.3, { type: 'triangle', vol: 0.12, slide: 2.2 }); break;
      case 'splash': this.noiseBurst(dest, t, 0.5, { type: 'lowpass', freq: 1800, vol: 0.5 * (o.volume || 1), sweep: 0.4 }); this.noiseBurst(dest, t + 0.05, 0.3, { type: 'bandpass', freq: 3500, vol: 0.2 }); break;
      case 'lever': this.noiseBurst(dest, t, 0.04, { type: 'bandpass', freq: 2200, q: 4, vol: 0.4 }); this.tone(dest, t, p > 1 ? 900 : 700, 0.05, { vol: 0.12 }); break;
      case 'click': this.noiseBurst(dest, t, 0.03, { type: 'bandpass', freq: 3000, q: 5, vol: 0.35 }); break;
      case 'piston': this.noiseBurst(dest, t, 0.18, { type: 'bandpass', freq: 500, q: 2, vol: 0.5, sweep: p > 1 ? 1.8 : 0.5 }); this.tone(dest, t, 90, 0.12, { vol: 0.25 }); break;
      case 'teleport':
        for (let i = 0; i < 8; i++) this.tone(dest, t + i * 0.04, 400 + i * 160, 0.5, { vol: 0.05 });
        this.noiseBurst(dest, t, 0.9, { type: 'bandpass', freq: 2000, q: 0.5, vol: 0.2, sweep: 3 });
        dest.connect(this.revSend);
        break;
      case 'ping':
        this.tone(dest, t, 880, 1.4, { vol: 0.16 }); this.tone(dest, t, 1320, 1.1, { vol: 0.08 }); this.tone(dest, t + 0.25, 660, 1.2, { vol: 0.06 });
        dest.connect(this.revSend);
        break;
      case 'thunder': {
        const d2 = o.distance || 0;
        this.noiseBurst(dest, t + d2 * 0.003, 3.5, { type: 'lowpass', freq: d2 < 40 ? 1600 : 500, vol: d2 < 40 ? 1.4 : 0.8, brown: true, sweep: 0.2 });
        if (d2 < 40) this.noiseBurst(dest, t, 0.3, { type: 'highpass', freq: 1500, vol: 0.8 });
        dest.connect(this.revSend);
        break;
      }
      case 'meteor': this.noiseBurst(dest, t, 3, { type: 'bandpass', freq: 1200, q: 0.5, vol: 0.4, sweep: 0.15 }); break;
      case 'impact': this.noiseBurst(dest, t, 2.5, { type: 'lowpass', freq: 600, vol: 1.3, brown: true, sweep: 0.2 }); this.tone(dest, t, 45, 1.5, { vol: 0.8, slide: 0.6 }); dest.connect(this.revSend); break;
      case 'chime': this.tone(dest, t, (o.freq || 880) * p, 1.2, { vol: 0.12 }); dest.connect(this.revSend); break;
      case 'drill': this.noiseBurst(dest, t, 0.3, { type: 'bandpass', freq: 300, q: 3, vol: 0.4 }); this.tone(dest, t, 70, 0.3, { type: 'sawtooth', vol: 0.06 }); break;
      case 'fan': this.noiseBurst(dest, t, 0.5, { type: 'lowpass', freq: 700, vol: 0.1 }); break;
      case 'launch': this.tone(dest, t, 120, 0.4, { vol: 0.4, slide: 4 }); this.noiseBurst(dest, t, 0.35, { type: 'bandpass', freq: 800, vol: 0.4, sweep: 3 }); break;
      case 'grapple': this.noiseBurst(dest, t, 0.25, { type: 'highpass', freq: 1500, vol: 0.3, sweep: 1.5 }); this.tone(dest, t, 600, 0.15, { type: 'triangle', vol: 0.15, slide: 1.6 }); break;
      case 'grapple_hit': this.noiseBurst(dest, t, 0.06, { type: 'bandpass', freq: 2000, q: 3, vol: 0.5 }); this.tone(dest, t, 1500, 0.12, { vol: 0.12 }); break;
      case 'mob': this.mobVoice(dest, t, o.voice || 'chirp', p); break;
      default: this.tone(dest, t, 440 * p, 0.1, { vol: 0.1 });
    }
  }

  // musical note (note blocks): n = 0..24 semitones above F#3
  note(n, instrument, pos) {
    if (!this.enabled) return;
    const dest = this.out(pos, 0.9);
    if (!dest) return;
    const t = this.ctx.currentTime;
    const f = 185 * Math.pow(2, n / 12);
    if (instrument === 'bass') { this.tone(dest, t, f / 2, 0.6, { type: 'triangle', vol: 0.35 }); this.tone(dest, t, f, 0.3, { vol: 0.1 }); }
    else if (instrument === 'bell') { this.tone(dest, t, f * 2, 1.6, { vol: 0.16 }); this.tone(dest, t, f * 4.2, 0.9, { vol: 0.05 }); }
    else if (instrument === 'drum') { this.noiseBurst(dest, t, 0.15, { type: 'lowpass', freq: 200 + n * 40, vol: 0.6 }); this.tone(dest, t, 60 + n * 4, 0.15, { vol: 0.4, slide: 0.5 }); }
    else if (instrument === 'click') { this.noiseBurst(dest, t, 0.04, { type: 'bandpass', freq: 2000 + n * 100, q: 3, vol: 0.5 }); }
    else { this.tone(dest, t, f, 0.9, { type: 'triangle', vol: 0.22 }); this.tone(dest, t, f * 2, 0.4, { vol: 0.06 }); }
    dest.connect(this.revSend);
  }

  mobVoice(dest, t, voice, p) {
    switch (voice) {
      case 'chirp': for (let i = 0; i < 3; i++) this.tone(dest, t + i * 0.07, (2200 + Math.random() * 800) * p, 0.06, { vol: 0.08, slide: 1.3 }); break;
      case 'bleat': this.tone(dest, t, 320 * p, 0.45, { type: 'sawtooth', vol: 0.05, slide: 0.9 }); this.tone(dest, t, 640 * p, 0.4, { vol: 0.03 }); break;
      case 'grunt': this.tone(dest, t, 110 * p, 0.3, { type: 'sawtooth', vol: 0.08, slide: 0.8 }); this.noiseBurst(dest, t, 0.25, { type: 'lowpass', freq: 500, vol: 0.2 }); break;
      case 'deer': this.tone(dest, t, 520 * p, 0.3, { type: 'triangle', vol: 0.08, slide: 1.4 }); break;
      case 'gloom': this.tone(dest, t, 90 * p, 1.2, { type: 'sawtooth', vol: 0.05, slide: 0.7 }); this.noiseBurst(dest, t, 1, { type: 'bandpass', freq: 300, q: 2, vol: 0.15 }); dest.connect(this.revSend); break;
      case 'hiss': this.noiseBurst(dest, t, 0.8, { type: 'highpass', freq: 3000, vol: 0.25 }); break;
      case 'click': for (let i = 0; i < 5; i++) this.noiseBurst(dest, t + i * 0.04, 0.02, { type: 'bandpass', freq: 3500, q: 6, vol: 0.25 }); break;
      case 'howl': this.tone(dest, t, 300 * p, 1.4, { type: 'triangle', vol: 0.08, slide: 1.6 }); break;
      case 'glub': this.tone(dest, t, 200 * p, 0.2, { vol: 0.15, slide: 1.6 }); break;
      case 'squeak': this.tone(dest, t, 1800 * p, 0.12, { vol: 0.08, slide: 1.5 }); break;
      case 'warden': this.tone(dest, t, 55, 1.8, { type: 'sawtooth', vol: 0.12, slide: 0.8 }); this.tone(dest, t, 82, 1.6, { type: 'triangle', vol: 0.1 }); dest.connect(this.revSend); break;
      case 'boing': this.tone(dest, t, 220 * p, 0.3, { vol: 0.2, slide: 2 }); break;
      case 'buzz': this.tone(dest, t, 180 * p, 0.4, { type: 'sawtooth', vol: 0.03, slide: 1.05 }); break;
      default: this.tone(dest, t, 440 * p, 0.2, { vol: 0.08 });
    }
  }

  // ------------------------------------------------------------ ambience + music (called every frame)
  startAmbience() {
    const ctx = this.ctx;
    const loop = (buf, type, freq, q = 0.7) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.ambGain);
      src.start();
      return { g, f };
    };
    this.amb = {
      rain: loop(this.noise, 'highpass', 1800),
      rainLow: loop(this.brown, 'lowpass', 500),
      wind: loop(this.brown, 'bandpass', 400, 0.4),
      cave: loop(this.brown, 'lowpass', 160),
      water: loop(this.noise, 'bandpass', 900, 0.4),
      lava: loop(this.brown, 'lowpass', 260),
    };
  }

  update(game, dt) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, p = game.player, cam = game.cam;
    if (!cam) return;
    const L = ctx.listener;
    this.listener = { x: cam.x, y: cam.y, z: cam.z };
    const fx = -Math.sin(cam.yaw) * Math.cos(cam.pitch), fy = Math.sin(cam.pitch), fz = -Math.cos(cam.yaw) * Math.cos(cam.pitch);
    if (L.positionX) {
      L.positionX.value = cam.x; L.positionY.value = cam.y; L.positionZ.value = cam.z;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(cam.x, cam.y, cam.z); L.setOrientation(fx, fy, fz, 0, 1, 0); }
    const w = game.world;
    const sky = w.skyLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z));
    const indoor = 1 - sky / 15;
    this.inCave = indoor > 0.7 && p.y < 60;
    const rain = game.weather ? game.weather.rainAt(p.x, p.z) : 0;
    const k = Math.min(1, dt * 2);
    const set = (a, v) => { a.g.gain.value += (v - a.g.gain.value) * k; };
    set(this.amb.rain, rain * (1 - indoor * 0.8) * 0.12);
    set(this.amb.rainLow, rain * (1 - indoor * 0.6) * 0.18);
    const height = Math.max(0, (p.y - 80) / 80);
    set(this.amb.wind, (0.03 + height * 0.25 + (game.weather ? game.weather.storm * 0.2 : 0)) * (1 - indoor) * (0.7 + 0.3 * Math.sin(game.time * 0.3)));
    set(this.amb.cave, this.inCave ? 0.22 : 0);
    // nearby water / lava loudness from a sparse sample
    if (!this.envT || (this.envT -= dt) <= 0) {
      this.envT = 0.5;
      let wa = 0, la = 0;
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      for (let i = 0; i < 60; i++) {
        const x = px + Math.floor(Math.random() * 17) - 8, y = py + Math.floor(Math.random() * 9) - 4, z = pz + Math.floor(Math.random() * 17) - 8;
        const id = w.getId(x, y, z);
        const d = BLOCKS[id];
        if (d.liquid === 1 && (w.getMeta(x, y, z) & 7) !== 0) wa++;
        if (d.liquid === 2) la++;
      }
      this.waterT = Math.min(1, wa / 6); this.lavaT = Math.min(1, la / 5);
    }
    set(this.amb.water, (this.waterT || 0) * 0.06);
    set(this.amb.lava, (this.lavaT || 0) * 0.3);
    // sporadic ambient one-shots
    const day = game.sky ? game.sky.daylight : 1;
    const biome = w.biomeAt(Math.floor(p.x), Math.floor(p.z), p.y);
    if (Math.random() < dt * 0.25 && !this.inCave && day > 0.5 && rain < 0.3 && (biome === 3 || biome === 4 || biome === 2)) {
      const a = Math.random() * Math.PI * 2;
      this.play('mob', { x: p.x + Math.cos(a) * 12, y: p.y + 6, z: p.z + Math.sin(a) * 12, voice: 'chirp', pitch: 0.8 + Math.random() * 0.5, minGap: 1500, volume: 0.6 });
    }
    if (Math.random() < dt * 0.4 && !this.inCave && day < 0.25 && rain < 0.3 && p.y < 120) this.crickets(p);
    if (this.inCave && Math.random() < dt * 0.35) this.drip(p);
    // music
    this.musicNext -= dt;
    if (this.musicNext <= 0 && !this.musicPlaying && this.settings.music > 0) this.playMusic(game);
  }

  crickets(p) {
    const dest = this.out({ x: p.x + (Math.random() - 0.5) * 20, y: p.y, z: p.z + (Math.random() - 0.5) * 20 }, 0.5);
    if (!dest) return;
    const t = this.ctx.currentTime;
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 6; i++) this.tone(dest, t + i * 0.055, f, 0.035, { vol: 0.025 });
  }
  drip(p) {
    const dest = this.out({ x: p.x + (Math.random() - 0.5) * 16, y: p.y + 3, z: p.z + (Math.random() - 0.5) * 16 }, 0.6);
    if (!dest) return;
    dest.connect(this.revSend);
    const t = this.ctx.currentTime;
    this.tone(dest, t, 1200 + Math.random() * 1400, 0.12, { vol: 0.08, slide: 1.6 });
  }

  // Generative music: a slow chord progression with a sparse bell melody, mood by place and time.
  playMusic(game) {
    const ctx = this.ctx;
    this.musicPlaying = true;
    const p = game.player;
    const night = game.sky && game.sky.daylight < 0.3;
    const deep = p.y < 46 && this.inCave;
    const sky = p.y > 140;
    const root = deep ? 110 : sky ? 293.66 : night ? 146.83 : 196;
    const scale = deep ? [0, 1, 3, 5, 7, 8, 10] : night ? [0, 2, 3, 5, 7, 9, 10] : sky ? [0, 2, 4, 6, 7, 9, 11] : [0, 2, 4, 7, 9];
    const prog = deep ? [[0, 3, 7], [1, 5, 8], [0, 3, 7], [10, 13, 17]] : night ? [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]] : [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]];
    const bar = deep ? 6 : 4.5;
    const bars = 8 + Math.floor(Math.random() * 5);
    const t0 = ctx.currentTime + 0.5;
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.musicGain);
    const send = ctx.createGain(); send.gain.value = 0.6; out.connect(send); send.connect(this.revSend);
    const fq = (semi) => root * Math.pow(2, semi / 12);
    for (let b = 0; b < bars; b++) {
      const ch = prog[b % prog.length];
      const tb = t0 + b * bar;
      for (const s of ch) {
        // soft pad: two detuned triangles with slow attack
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fq(s); o.detune.value = det;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, tb);
          g.gain.exponentialRampToValueAtTime(0.025, tb + bar * 0.4);
          g.gain.exponentialRampToValueAtTime(0.0001, tb + bar * 1.15);
          o.connect(f); f.connect(g); g.connect(out);
          o.start(tb); o.stop(tb + bar * 1.2);
        }
      }
      // melody: a few bell notes per bar from the scale
      const notes = 1 + Math.floor(Math.random() * 3);
      for (let n = 0; n < notes; n++) {
        if (Math.random() < 0.25) continue;
        const deg = scale[Math.floor(Math.random() * scale.length)] + 12 * (1 + Math.floor(Math.random() * 2));
        const tn = tb + (n / notes) * bar + Math.random() * 0.3;
        this.tone(out, tn, fq(deg), 2.2, { vol: 0.045, attack: 0.01 });
        this.tone(out, tn, fq(deg) * 2.01, 1.2, { vol: 0.012, attack: 0.01 });
      }
    }
    const total = bars * bar + 3;
    setTimeout(() => { this.musicPlaying = false; this.musicNext = 90 + Math.random() * 150; out.disconnect(); }, total * 1000);
  }
}
