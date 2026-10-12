// Everything you hear is synthesised here with the Web Audio API — no sound files.
// A detuned drone, a pad whose chord rises a step with every dimension, and UI sounds.
import { store } from './store.js';

const RATIOS = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2, 9 / 4, 5 / 2];
let ctx = null, master = null, reverb = null, noise = null, pad = null, enabled = false;

function impulse(seconds = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(3.2);
  const wet = ctx.createGain(); wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

function startBed() {
  const t = ctx.currentTime;
  // drone: two detuned saws through a slowly breathing low-pass
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.8;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(lp.frequency); lfo.start(t);
  const dg = ctx.createGain(); dg.gain.value = 0.032;
  for (const f of [55, 55 * 1.0045, 27.5]) {
    const o = ctx.createOscillator(); o.type = f < 40 ? 'sine' : 'sawtooth'; o.frequency.value = f;
    o.connect(f < 40 ? dg : lp); o.start(t);
  }
  lp.connect(dg); dg.connect(master); dg.connect(reverb);
  // pad: three triangles; retuned per chapter
  const pg = ctx.createGain(); pg.gain.value = 0.014;
  const plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 1400;
  pad = [1, 1.5, 2.5].map((r) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 110 * r; o.connect(plp); o.start(t);
    return { o, r };
  });
  plp.connect(pg); pg.connect(master); pg.connect(reverb);
  // air
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.6;
  const ag = ctx.createGain(); ag.gain.value = 0.0045;
  src.connect(bp).connect(ag).connect(master); src.start(t);
}

function env(gainNode, peak, attack, decay, at = ctx.currentTime) {
  gainNode.gain.setValueAtTime(0.0001, at);
  gainNode.gain.exponentialRampToValueAtTime(peak, at + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function tone(freq, { type = 'sine', peak = 0.05, attack = 0.004, decay = 0.14, at, wet = true, glide } = {}) {
  if (!enabled) return;
  const t0 = at ?? ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + attack + decay);
  const g = ctx.createGain();
  env(g, peak, attack, decay, t0);
  o.connect(g); g.connect(master); if (wet) g.connect(reverb);
  o.start(t0); o.stop(t0 + attack + decay + 0.05);
}

const PENTA = [880, 988, 1109, 1319, 1480, 1760];
let lastBlip = 0;

export const audio = {
  get on() { return enabled; },
  async enable() {
    if (!ensure()) return false;
    try { await ctx.resume(); } catch { return false; }
    if (!pad) startBed();
    enabled = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.6);
    store.set('sound', true);
    return true;
  },
  disable() {
    enabled = false;
    store.set('sound', false);
    if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  },
  chord(index) {
    if (!ctx || !pad) return;
    const root = 110 * RATIOS[index % RATIOS.length];
    for (const { o, r } of pad) o.frequency.setTargetAtTime(root * r, ctx.currentTime, 0.8);
  },
  blip() {
    if (!enabled) return;
    const now = performance.now();
    if (now - lastBlip < 60) return;
    lastBlip = now;
    tone(PENTA[(Math.random() * PENTA.length) | 0], { peak: 0.022, decay: 0.12 });
  },
  tick() { if (enabled) tone(2200, { type: 'square', peak: 0.008, decay: 0.02, wet: false }); },
  click() { if (enabled) tone(660, { type: 'triangle', peak: 0.05, decay: 0.09, glide: 990 }); },
  whoosh(up = true) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(up ? 260 : 2600, t);
    bp.frequency.exponentialRampToValueAtTime(up ? 2600 : 260, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(bp).connect(g); g.connect(master); g.connect(reverb);
    src.start(t, Math.random()); src.stop(t + 1);
  },
  impact() {
    if (!enabled) return;
    const t = ctx.currentTime;
    tone(72, { peak: 0.32, attack: 0.01, decay: 1.4, glide: 30, wet: true });
    const src = ctx.createBufferSource(); src.buffer = noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); env(g, 0.16, 0.005, 0.45, t);
    src.connect(lp).connect(g); g.connect(master); g.connect(reverb);
    src.start(t); src.stop(t + 0.6);
  },
  success() {
    if (!enabled) return;
    const t = ctx.currentTime;
    [1, 5 / 4, 3 / 2, 2, 5 / 2].forEach((r, i) => tone(523.25 * r, { type: 'triangle', peak: 0.05, decay: 0.6, at: t + i * 0.07 }));
  },
};
