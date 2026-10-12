// Procedural sound: an ambient drone and slowly wandering bell melody whose scale follows the most
// advanced era, wind and surf noise, and synthesized effects for the world's great moments.
// Everything is generated with WebAudio oscillators and noise — no audio files.

const SCALES = [
  [0, 3, 5, 7, 10], // flint: minor pentatonic
  [0, 2, 5, 7, 9], // bronze–iron: major pentatonic
  [0, 2, 3, 7, 9], // classical / feudal: dorian-ish
  [0, 2, 4, 7, 9, 11], // enlightenment+: brighter
  [0, 2, 4, 6, 9, 11], // atomic+: lydian shimmer
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
    this.era = 0;
    this.nextNote = 0;
    this.started = false;
  }

  start() {
    if (this.started || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    this.started = true;
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume * 0.6;
    // a simple feedback delay as reverb
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.37;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.42;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.delay.connect(lp); lp.connect(this.fb); this.fb.connect(this.delay); lp.connect(this.wet); this.wet.connect(this.master);
    this.master.connect(ctx.destination);
    this.fx = ctx.createGain();
    this.fx.gain.value = 1;
    this.fx.connect(this.master);
    this.fx.connect(this.delay);
    this.noiseBuf = this.makeNoise();
    this.startAmbient();
  }

  makeNoise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { const wn = Math.random() * 2 - 1; b = (b + 0.02 * wn) / 1.02; d[i] = b * 3.5; }
    return buf;
  }

  startAmbient() {
    const ctx = this.ctx;
    // drone
    this.drone = ctx.createGain();
    this.drone.gain.value = 0.05;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.6;
    this.droneFilter = f;
    this.droneOsc = [55, 82.4, 110.2].map((hz, i) => {
      const o = ctx.createOscillator();
      o.type = i === 1 ? 'triangle' : 'sine';
      o.frequency.value = hz;
      o.detune.value = (i - 1) * 6;
      o.connect(f);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lg = ctx.createGain();
    lg.gain.value = 180;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    f.connect(this.drone); this.drone.connect(this.master); this.drone.connect(this.delay);
    // wind / surf
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 420; nf.Q.value = 0.5;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.03;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.09;
    const sg = ctx.createGain();
    sg.gain.value = 0.02;
    swell.connect(sg); sg.connect(this.windGain.gain); swell.start();
    n.connect(nf); nf.connect(this.windGain); this.windGain.connect(this.master);
    n.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (on && !this.started) this.start();
    if (this.ctx) { if (on) this.ctx.resume(); else this.ctx.suspend(); }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.1);
  }

  /** called every frame: wandering melody, drone follows the era */
  update(era, speed, active) {
    if (!this.started || !this.enabled || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (era !== this.era) {
      this.era = era;
      const root = [55, 58.3, 61.7, 65.4, 49][Math.min(4, Math.floor(era / 2.5))];
      this.droneOsc.forEach((o, i) => o.frequency.setTargetAtTime(root * [1, 1.5, 2][i], t, 2));
    }
    if (t >= this.nextNote && active) {
      const scale = SCALES[Math.min(SCALES.length - 1, Math.floor(era / 2.5))];
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const oct = Math.random() < 0.3 ? 2 : 1;
      const hz = 220 * Math.pow(2, deg / 12) * oct;
      this.bell(hz, 0.05 + Math.random() * 0.03, 3.5);
      if (Math.random() < 0.3) this.bell(hz * 1.5, 0.025, 3);
      this.nextNote = t + 2.2 + Math.random() * 4.5;
    }
  }

  bell(hz, vol, dur, when = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [mul, a] of [[1, 1], [2.01, 0.35], [3.02, 0.12]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz * mul;
      const og = ctx.createGain();
      og.gain.value = a;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur);
    }
    g.connect(this.fx);
  }

  noise(dur, freq, vol, type = 'lowpass', sweepTo = null, when = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.fx);
    s.start(t, Math.random()); s.stop(t + dur);
  }

  tone(hz, dur, vol, type = 'sine', toHz = null, when = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    if (toHz) o.frequency.exponentialRampToValueAtTime(toHz, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.fx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** an event happened in the world */
  play(ev) {
    if (!this.started || !this.enabled || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.lastSfx && now - this.lastSfx < 0.12) return;
    this.lastSfx = now;
    const tool = ev.tool;
    if (tool) {
      switch (tool) {
        case 'meteor': case 'nuke': this.noise(2.5, 1200, 0.5, 'lowpass', 60); this.tone(80, 2, 0.4, 'sine', 30); break;
        case 'lightning': this.noise(0.25, 3000, 0.4, 'highpass'); this.noise(1.6, 300, 0.3, 'lowpass', 60, 0.1); break;
        case 'quake': case 'volcano': this.noise(2.2, 160, 0.45, 'lowpass', 50); this.tone(45, 2, 0.3, 'sine', 30); break;
        case 'tsunami': case 'tornado': this.noise(2, 600, 0.3, 'bandpass', 200); break;
        case 'bless': case 'inspire': case 'prophecy': case 'hero': case 'uplift': [0, 4, 7, 12].forEach((d, i) => this.bell(440 * Math.pow(2, d / 12), 0.06, 2.5, i * 0.09)); break;
        case 'plague': case 'locust': case 'fog': this.tone(110, 1.5, 0.12, 'sawtooth', 100); this.tone(116, 1.5, 0.1, 'sawtooth', 104); break;
        case 'portal': case 'bubble': case 'monolith': case 'worldtree': case 'whisper': this.tone(330, 1.8, 0.08, 'sine', 660); this.tone(495, 1.8, 0.05, 'triangle', 990, 0.1); break;
        case 'monster': case 'comet': case 'iceage': this.tone(60, 3, 0.35, 'sawtooth', 40); this.noise(3, 200, 0.2, 'lowpass', 80); break;
        default: this.noise(0.15, 1800, 0.06, 'bandpass');
      }
      return;
    }
    if (ev.cat === 'achievement') { [0, 7, 12, 16, 19].forEach((d, i) => this.bell(523 * Math.pow(2, d / 12), 0.05, 2.2, i * 0.07)); return; }
    if (ev.imp < 2) return;
    switch (ev.cat) {
      case 'war': for (let i = 0; i < 3; i++) { this.tone(70, 0.35, 0.35, 'sine', 40, i * 0.28); this.noise(0.12, 900, 0.12, 'bandpass', null, i * 0.28); } break;
      case 'faith': case 'divine': [0, 5, 9].forEach((d, i) => this.bell(392 * Math.pow(2, d / 12), 0.05, 3, i * 0.12)); break;
      case 'science': case 'culture': [0, 4, 7].forEach((d, i) => this.bell(587 * Math.pow(2, d / 12), 0.04, 2, i * 0.08)); break;
      case 'civ': this.tone(196, 1.2, 0.08, 'sawtooth'); this.tone(294, 1.2, 0.06, 'sawtooth', null, 0.05); break;
      case 'nature': this.noise(1.5, 400, 0.15, 'lowpass', 120); break;
      case 'society': this.tone(147, 1, 0.08, 'triangle', 139); break;
      case 'life': this.bell(660, 0.04, 2); break;
      default:
    }
  }
}
