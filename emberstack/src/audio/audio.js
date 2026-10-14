// Procedural sound: every effect and the generative score are synthesised with WebAudio — no audio
// files. The music walks a pentatonic scale on plucked strings over a breathing drone; its mood
// follows the day: bright by day, sparse and low at night, drums when blood is spilled.

const DAY_SCALE = [0, 2, 4, 7, 9]; // gong mode (major pentatonic)
const NIGHT_SCALE = [0, 3, 5, 7, 10]; // yu mode (minor pentatonic)

export class Audio {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.8 };
    this.mood = 'day';
    this.intensity = 0;
    this.enabled = true;
    this.lastPlay = new Map();
    this.musicOn = false;
  }

  /** must be called from a user gesture */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.vol.master;
    this.comp.connect(this.master).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.vol.sfx;
    this.sfxBus.connect(this.comp);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.vol.music * 0.6;
    // a little hall for the music
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.musicBus.connect(this.comp);
    this.musicBus.connect(this.verb).connect(wet).connect(this.comp);
    this.noiseBuf = this.makeNoise();
    this.startMusic();
  }

  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.6, t, 0.2);
  }

  impulse(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    }
    return b;
  }
  makeNoise() {
    const ctx = this.ctx, n = ctx.sampleRate;
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ------------------------------------------------------------------ voices
  tone(freq, dur, o = {}) {
    const ctx = this.ctx;
    const t = (o.at ?? ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
    const g = ctx.createGain();
    const v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur);
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(o.bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  noise(dur, o = {}) {
    const ctx = this.ctx;
    const t = (o.at ?? ctx.currentTime) + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.ftype || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o.bus || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
  /** a plucked string (guqin-ish): two partials with a fast filter close */
  pluck(freq, o = {}) {
    const dur = o.dur ?? 1.6;
    this.tone(freq, dur, { type: 'triangle', vol: o.vol ?? 0.16, lp: 3200, lpEnd: 500, bus: o.bus, at: o.at });
    this.tone(freq * 2.01, dur * 0.5, { type: 'sine', vol: (o.vol ?? 0.16) * 0.35, bus: o.bus, at: o.at });
  }

  // ------------------------------------------------------------------ effects
  play(name, o = {}) {
    if (!this.ctx || !this.enabled || this.vol.sfx <= 0) return;
    const now = performance.now();
    const gap = { hit: 45, coin: 60, pick: 40, drop: 40, stack: 50, craft: 80, step: 60 }[name] ?? 30;
    if (now - (this.lastPlay.get(name) || 0) < gap) return;
    this.lastPlay.set(name, now);
    const r = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'click': this.tone(880 * r, 0.06, { type: 'square', vol: 0.05, lp: 2400 }); break;
      case 'hover': this.tone(1320, 0.03, { type: 'sine', vol: 0.025 }); break;
      case 'pick': this.noise(0.07, { freq: 2400 * r, q: 2, vol: 0.12 }); this.tone(520 * r, 0.06, { vol: 0.05 }); break;
      case 'drop': this.noise(0.09, { freq: 900 * r, q: 1.5, vol: 0.18 }); this.tone(180 * r, 0.09, { type: 'sine', vol: 0.12 }); break;
      case 'stack': this.noise(0.06, { freq: 1500 * r, q: 3, vol: 0.14 }); this.tone(330 * r, 0.1, { vol: 0.07, delay: 0.02 }); break;
      case 'craft': [523, 659, 784].forEach((f, i) => this.pluck(f * r, { dur: 0.7, vol: 0.12, at: this.ctx.currentTime + i * 0.07 })); break;
      case 'coin': this.tone(1568 * r, 0.25, { type: 'sine', vol: 0.12 }); this.tone(2093 * r, 0.3, { type: 'sine', vol: 0.08, delay: 0.06 }); break;
      case 'hit': this.noise(0.12, { freq: 600 * r, q: 0.8, vol: 0.3 }); this.tone(110 * r, 0.12, { type: 'sine', vol: 0.25, slide: 0.5 }); break;
      case 'crit': this.noise(0.18, { freq: 1800, q: 0.7, vol: 0.35 }); this.tone(90, 0.2, { type: 'square', vol: 0.12, slide: 0.4, lp: 900 }); break;
      case 'shot': this.noise(0.12, { freq: 3000, freqEnd: 800, q: 4, vol: 0.12 }); break;
      case 'death': this.tone(220, 1.4, { type: 'sine', vol: 0.18, slide: 0.5 }); this.tone(330, 1.6, { type: 'sine', vol: 0.1, slide: 0.5, delay: 0.1 }); break;
      case 'kill': this.noise(0.3, { freq: 400, freqEnd: 100, q: 0.7, vol: 0.3 }); this.tone(150, 0.35, { type: 'sawtooth', vol: 0.06, slide: 0.3, lp: 600 }); break;
      case 'boss': this.drum(0, 0.6); this.drum(0.25, 0.6); this.tone(55, 2.2, { type: 'sawtooth', vol: 0.15, lp: 300 }); break;
      case 'battle': this.drum(0, 0.5); this.drum(0.18, 0.35); this.drum(0.36, 0.5); break;
      case 'dawn': [0, 4, 7, 12].forEach((s, i) => this.pluck(392 * Math.pow(2, s / 12), { vol: 0.13, dur: 2.2, at: this.ctx.currentTime + i * 0.16 })); this.bell(784, 0.7); break;
      case 'night': this.tone(98, 3, { type: 'sine', vol: 0.18, attack: 0.6 }); this.tone(146.8, 3, { type: 'sine', vol: 0.1, attack: 0.9 }); this.noise(2.5, { freq: 300, q: 0.5, vol: 0.05, attack: 0.8 }); break;
      case 'research': [0, 7, 12, 16].forEach((s, i) => this.bell(523 * Math.pow(2, s / 12), 0.12 + i * 0.1)); break;
      case 'discover': [0, 4, 7, 11, 14, 19].forEach((s, i) => this.bell(440 * Math.pow(2, s / 12), i * 0.08, 0.1)); break;
      case 'open': this.noise(0.25, { freq: 2600, freqEnd: 900, q: 1, vol: 0.12 }); this.pluck(660, { dur: 0.5, vol: 0.1 }); break;
      case 'fuel': this.noise(0.5, { freq: 700, freqEnd: 2400, q: 0.6, vol: 0.12, attack: 0.05 }); break;
      case 'event': this.bell(659, 0); this.bell(880, 0.14); break;
      case 'warn': this.tone(440, 0.2, { type: 'square', vol: 0.06, lp: 1500 }); this.tone(349, 0.3, { type: 'square', vol: 0.06, lp: 1500, delay: 0.18 }); break;
      case 'error': this.tone(200, 0.15, { type: 'square', vol: 0.06, lp: 900 }); break;
      case 'heal': this.tone(660, 0.4, { type: 'sine', vol: 0.06 }); this.tone(990, 0.4, { type: 'sine', vol: 0.04, delay: 0.08 }); break;
      case 'stage': this.drum(0, 0.7); [0, 5, 7, 12].forEach((s, i) => this.bell(330 * Math.pow(2, s / 12), 0.1 + i * 0.12, 0.14)); break;
      case 'meteor': this.noise(1.6, { freq: 3000, freqEnd: 120, q: 0.4, vol: 0.35, attack: 0.3 }); this.drum(0.6, 1); break;
      case 'flood': this.noise(2.2, { ftype: 'lowpass', freq: 600, freqEnd: 200, q: 0.3, vol: 0.35, attack: 0.4 }); break;
      case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.pluck(392 * Math.pow(2, s / 12), { vol: 0.15, dur: 2.4, at: this.ctx.currentTime + i * 0.11 })); this.bell(1568, 0.8, 0.1); break;
      case 'lose': [0, -3, -7, -12].forEach((s, i) => this.pluck(330 * Math.pow(2, s / 12), { vol: 0.15, dur: 2.6, at: this.ctx.currentTime + i * 0.3 })); break;
      case 'birth': this.bell(1046, 0, 0.08); this.bell(1318, 0.1, 0.07); break;
      default: break;
    }
  }
  drum(delay, vol = 0.5) {
    this.tone(70, 0.45, { type: 'sine', vol, slide: 0.45, delay });
    this.noise(0.12, { freq: 180, q: 0.6, vol: vol * 0.4, delay });
  }
  bell(freq, delay = 0, vol = 0.09) {
    this.tone(freq, 1.6, { type: 'sine', vol, delay });
    this.tone(freq * 2.76, 0.6, { type: 'sine', vol: vol * 0.3, delay });
    this.tone(freq * 5.4, 0.25, { type: 'sine', vol: vol * 0.12, delay });
  }

  /** react to a batch of simulation events */
  onEvents(evs, speed = 1) {
    if (!this.ctx) return;
    let hits = 0;
    for (const e of evs) {
      switch (e.type) {
        case 'craft': this.play('craft'); break;
        case 'taskStart': break;
        case 'stack': this.play('stack'); break;
        case 'sell': case 'trade': this.play('coin'); break;
        case 'hit': if (hits++ < 2) this.play(e.crit ? 'crit' : e.ranged ? 'shot' : 'hit'); break;
        case 'shot': this.play('shot'); break;
        case 'death': this.play('death'); break;
        case 'kill': this.play('kill'); break;
        case 'battleStart': this.play('battle'); this.intensity = 1; break;
        case 'dawn': if (speed <= 4) this.play('dawn'); break;
        case 'night': if (speed <= 4) this.play('night'); break;
        case 'research': this.play('research'); break;
        case 'discover': this.play('discover'); break;
        case 'open': this.play('open'); break;
        case 'fuel': this.play('fuel'); break;
        case 'event': this.play('event'); break;
        case 'heal': if (speed <= 2) this.play('heal'); break;
        case 'stage': this.play('stage'); break;
        case 'meteor': this.play('meteor'); break;
        case 'flood': this.play('flood'); break;
        case 'msg': if (e.kind === 'boss') this.play('boss'); else if (e.kind === 'danger') this.play('warn'); break;
        case 'end': this.play(e.result === 'win' ? 'win' : 'lose'); break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------------ music
  setMood(mood, intensity) {
    this.mood = mood;
    if (intensity !== undefined) this.intensity = Math.max(this.intensity * 0.98, intensity);
  }

  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    const ctx = this.ctx;
    // drone: two detuned saws through a slowly breathing low-pass
    this.droneF = ctx.createBiquadFilter();
    this.droneF.type = 'lowpass';
    this.droneF.frequency.value = 420;
    this.droneG = ctx.createGain();
    this.droneG.gain.value = 0.0;
    this.droneOsc = [];
    for (const [f, det] of [[73.4, -6], [73.4, 7], [110, 0]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(this.droneF);
      o.start();
      this.droneOsc.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 160;
    lfo.connect(lfoG).connect(this.droneF.frequency);
    lfo.start();
    this.droneF.connect(this.droneG).connect(this.musicBus);
    this.beat = 0;
    this.nextT = ctx.currentTime + 0.5;
    this.deg = 2;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const night = this.mood === 'night', title = this.mood === 'title';
    this.intensity *= 0.985;
    const fight = this.intensity > 0.3;
    const bpm = fight ? 96 : night ? 54 : 66;
    const step = 60 / bpm / 2;
    const root = night ? 146.83 : 196; // D3 / G3
    const scale = night ? NIGHT_SCALE : DAY_SCALE;
    this.droneG.gain.setTargetAtTime(this.vol.music > 0 ? (night ? 0.05 : 0.03) : 0, ctx.currentTime, 1.5);
    for (const o of this.droneOsc) o.frequency.setTargetAtTime(night ? 73.4 : 98, ctx.currentTime, 2);
    while (this.nextT < ctx.currentTime + 0.4) {
      const t = this.nextT;
      const b = this.beat++;
      const density = fight ? 0.75 : night ? 0.28 : title ? 0.42 : 0.45;
      if (Math.random() < density && (b % 2 === 0 || Math.random() < 0.4)) {
        this.deg += Math.round((Math.random() - 0.5) * 3.2);
        this.deg = Math.max(0, Math.min(9, this.deg));
        const oct = Math.floor(this.deg / 5), s = scale[this.deg % 5];
        const f = root * Math.pow(2, oct + s / 12);
        this.pluck(f, { at: t, vol: 0.09 + Math.random() * 0.05, dur: night ? 2.6 : 1.8, bus: this.musicBus });
        if (Math.random() < 0.18) this.pluck(f * 1.5, { at: t + step * 0.5, vol: 0.05, dur: 1.2, bus: this.musicBus });
      }
      if (b % 16 === 0) {
        const f = root / 2 * Math.pow(2, scale[[0, 3, 4, 0][(b / 16) % 4]] / 12);
        this.tone(f, 4, { type: 'sine', vol: 0.06, attack: 0.4, at: t, bus: this.musicBus });
      }
      if (fight && b % 4 === 0) {
        this.tone(65, 0.4, { type: 'sine', vol: 0.22, slide: 0.5, at: t, bus: this.musicBus });
        if (b % 8 === 4) this.noise(0.08, { freq: 2500, q: 2, vol: 0.05, at: t + step, bus: this.musicBus });
      }
      this.nextT += step;
    }
  }
}

export const audio = new Audio();
