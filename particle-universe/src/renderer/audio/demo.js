// Built-in demo track «极光 Aurora»: a 124 BPM progressive-house piece synthesised offline with
// the Web Audio API, so the visualiser can be experienced without any music files.
// Structure (bars): intro 0–8 · groove 8–16 · build 16–20 · drop 20–36 · break 36–44 · build 44–48 · drop 48–64 · outro 64–68

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 1234567;
  for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  return buf;
}

function makeIR(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let s = 987654;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const n = (s / 4294967296) * 2 - 1;
      lp += (n - lp) * (0.5 - 0.4 * (i / len));
      const t = i / ctx.sampleRate;
      d[i] = lp * Math.exp(-t * 2.6) * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}

export async function renderDemoTrack(sampleRate = 48000) {
  const bpm = 124, beat = 60 / bpm, bar = beat * 4, BARS = 68;
  const dur = BARS * bar + 3.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
  const T = (b) => b * bar;
  const sec = {
    intro: [0, 8], groove: [8, 16], build1: [16, 20], drop1: [20, 36], brk: [36, 44], build2: [44, 48], drop2: [48, 64], outro: [64, 68]
  };
  const inS = (b, ...names) => names.some((n) => b >= sec[n][0] && b < sec[n][1]);

  // ---- buses ----
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
  const master = ctx.createGain(); master.gain.value = 0.85;
  master.connect(comp); comp.connect(ctx.destination);
  const verb = ctx.createConvolver(); verb.buffer = makeIR(ctx, 3.2);
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.4;
  verb.connect(verbOut); verbOut.connect(master);
  const duck = ctx.createGain(); duck.connect(master);
  const duckVerb = ctx.createGain(); duckVerb.connect(verb);
  const noise = makeNoise(ctx, 4);

  const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0); return s; };

  // ---- pads (supersaw chords, one long-running oscillator set) ----
  const chords = [
    [57, 60, 64, 69, 72], // Am
    [53, 57, 60, 65, 69], // F
    [55, 60, 64, 67, 72], // C
    [55, 59, 62, 67, 71] // G
  ];
  const roots = [45, 41, 48, 43];
  const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.Q.value = 0.7;
  const padGain = ctx.createGain(); padGain.gain.value = 0;
  padFilter.connect(padGain); padGain.connect(duck); padGain.connect(duckVerb);
  const padOsc = [];
  for (let v = 0; v < 5; v++) {
    for (const det of [-14, -5, 5, 14]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det + (v - 2) * 0.7;
      const g = ctx.createGain(); g.gain.value = 0.05;
      const pan = ctx.createStereoPanner(); pan.pan.value = det / 18;
      o.connect(g); g.connect(pan); pan.connect(padFilter);
      o.start(0); o.stop(dur);
      padOsc.push({ o, v });
    }
  }
  for (let b = 0; b < BARS; b++) {
    const ch = chords[b % 4];
    for (const { o, v } of padOsc) o.frequency.setValueAtTime(midi(ch[v]), T(b));
  }
  // pad filter / level automation per section
  const pf = padFilter.frequency, pg = padGain.gain;
  pf.setValueAtTime(380, 0); pf.exponentialRampToValueAtTime(1400, T(8));
  pg.setValueAtTime(0.0, 0); pg.linearRampToValueAtTime(0.55, T(4));
  pf.exponentialRampToValueAtTime(1800, T(16)); pf.exponentialRampToValueAtTime(5200, T(20) - 0.05);
  pf.setValueAtTime(4200, T(20)); pg.setValueAtTime(0.62, T(20));
  pf.setValueAtTime(4200, T(36) - 0.01); pf.exponentialRampToValueAtTime(900, T(37));
  pf.exponentialRampToValueAtTime(1600, T(44)); pf.exponentialRampToValueAtTime(6000, T(48) - 0.05);
  pf.setValueAtTime(4600, T(48)); pg.setValueAtTime(0.62, T(64));
  pf.exponentialRampToValueAtTime(500, T(68)); pg.linearRampToValueAtTime(0.0, T(68) + 3);

  // ---- bass ----
  const bassOsc = ctx.createOscillator(); bassOsc.type = 'sawtooth';
  const bassSub = ctx.createOscillator(); bassSub.type = 'sine';
  const bassF = ctx.createBiquadFilter(); bassF.type = 'lowpass'; bassF.Q.value = 6;
  const bassAmp = ctx.createGain(); bassAmp.gain.value = 0;
  const subAmp = ctx.createGain(); subAmp.gain.value = 0;
  bassOsc.connect(bassF); bassF.connect(bassAmp); bassAmp.connect(duck);
  bassSub.connect(subAmp); subAmp.connect(duck);
  bassOsc.start(0); bassSub.start(0); bassOsc.stop(dur); bassSub.stop(dur);

  // ---- hats / claps (shared looping noise sources with gain envelopes) ----
  const hatSrc = loopNoise();
  const hatHP = ctx.createBiquadFilter(); hatHP.type = 'highpass'; hatHP.frequency.value = 8200;
  const hatG = ctx.createGain(); hatG.gain.value = 0;
  hatSrc.connect(hatHP); hatHP.connect(hatG); hatG.connect(master);
  const ohSrc = loopNoise();
  const ohHP = ctx.createBiquadFilter(); ohHP.type = 'highpass'; ohHP.frequency.value = 6500;
  const ohG = ctx.createGain(); ohG.gain.value = 0;
  ohSrc.connect(ohHP); ohHP.connect(ohG); ohG.connect(master); ohG.connect(verb);
  const clapSrc = loopNoise();
  const clapBP = ctx.createBiquadFilter(); clapBP.type = 'bandpass'; clapBP.frequency.value = 1500; clapBP.Q.value = 0.9;
  const clapG = ctx.createGain(); clapG.gain.value = 0;
  clapSrc.connect(clapBP); clapBP.connect(clapG); clapG.connect(master);
  const clapSend = ctx.createGain(); clapSend.gain.value = 0.6; clapG.connect(clapSend); clapSend.connect(verb);

  // ---- arp ----
  const arpOsc = ctx.createOscillator(); arpOsc.type = 'square';
  const arpF = ctx.createBiquadFilter(); arpF.type = 'lowpass'; arpF.frequency.value = 2600; arpF.Q.value = 3;
  const arpG = ctx.createGain(); arpG.gain.value = 0;
  arpOsc.connect(arpF); arpF.connect(arpG); arpG.connect(duck); arpG.connect(duckVerb);
  arpOsc.start(0); arpOsc.stop(dur);

  // ---- lead (drop 2) ----
  const leadOsc = ctx.createOscillator(); leadOsc.type = 'sawtooth';
  const leadOsc2 = ctx.createOscillator(); leadOsc2.type = 'sawtooth'; leadOsc2.detune.value = 9;
  const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
  const vibG = ctx.createGain(); vibG.gain.value = 6;
  vib.connect(vibG); vibG.connect(leadOsc.detune); vibG.connect(leadOsc2.detune);
  const leadF = ctx.createBiquadFilter(); leadF.type = 'lowpass'; leadF.frequency.value = 3800; leadF.Q.value = 1.5;
  const leadG = ctx.createGain(); leadG.gain.value = 0;
  leadOsc.connect(leadF); leadOsc2.connect(leadF); leadF.connect(leadG); leadG.connect(duck); leadG.connect(duckVerb);
  for (const o of [leadOsc, leadOsc2, vib]) { o.start(0); o.stop(dur); }

  const kick = (t, vel = 1) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.07); o.frequency.exponentialRampToValueAtTime(42, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45);
    const c = ctx.createBufferSource(); c.buffer = noise;
    const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 2500;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.28 * vel, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    c.connect(cf); cf.connect(cg); cg.connect(master); c.start(t, (t * 7.31) % 3); c.stop(t + 0.02);
    duck.gain.setValueAtTime(0.28, t); duck.gain.setTargetAtTime(1, t + 0.03, 0.085);
    duckVerb.gain.setValueAtTime(0.35, t); duckVerb.gain.setTargetAtTime(1, t + 0.03, 0.1);
  };
  const hat = (t, v, open = false) => {
    const g = open ? ohG.gain : hatG.gain;
    g.setValueAtTime(v, t); g.setTargetAtTime(0, t + 0.002, open ? 0.09 : 0.018);
  };
  const clap = (t, v) => {
    const g = clapG.gain;
    g.setValueAtTime(v, t); g.setTargetAtTime(0.05, t + 0.001, 0.003);
    g.setValueAtTime(v * 0.8, t + 0.011); g.setTargetAtTime(0.05, t + 0.012, 0.003);
    g.setValueAtTime(v, t + 0.023); g.setTargetAtTime(0, t + 0.024, 0.045);
  };
  const impact = (t) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    s.connect(hp); hp.connect(g); g.connect(master); g.connect(verb); s.start(t, 0.5); s.stop(t + 2.7);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(32, t + 1.4);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(og); og.connect(master); o.start(t); o.stop(t + 1.7);
  };
  const riser = (t0, t1) => {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(7000, t1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32, t1 - 0.05); g.gain.linearRampToValueAtTime(0, t1);
    s.connect(bp); bp.connect(g); g.connect(master); g.connect(verb); s.start(t0); s.stop(t1 + 0.05);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t0); o.frequency.exponentialRampToValueAtTime(1300, t1);
    const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 2400;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.06, t1 - 0.05); og.gain.linearRampToValueAtTime(0, t1);
    o.connect(of); of.connect(og); og.connect(master); og.connect(verb); o.start(t0); o.stop(t1 + 0.05);
  };

  const motif = [
    [76, 76, null, 74, 72, null, 72, 74],
    [72, null, 69, 72, 74, null, 77, 76],
    [76, null, 79, 76, 74, null, 72, 74],
    [74, null, 71, 67, 71, null, 74, 71]
  ];
  const arpPat = [0, 2, 3, 4, 3, 2, 1, 2, 0, 2, 3, 4, 3, 4, 2, 1];

  // sub drone for the intro
  subAmp.gain.setValueAtTime(0, 0); subAmp.gain.linearRampToValueAtTime(0.18, T(2)); subAmp.gain.setValueAtTime(0.18, T(8));

  for (let b = 0; b < BARS; b++) {
    const t0 = T(b);
    const ci = b % 4, root = roots[ci];
    const drop = inS(b, 'drop1', 'drop2');
    bassSub.frequency.setValueAtTime(midi(root - 12), t0);
    if (inS(b, 'intro')) bassSub.frequency.setValueAtTime(midi(root - 12), t0);

    // kick
    const kickOn = inS(b, 'groove', 'drop1', 'drop2') || (inS(b, 'build1', 'build2') && b % 4 < 1) || (inS(b, 'outro') && b < 66);
    if (kickOn) for (let k = 0; k < 4; k++) kick(t0 + k * beat, drop ? 1 : 0.85);
    if (inS(b, 'build1', 'build2') && b % 4 === 3) {
      for (let k = 0; k < 8; k++) kick(t0 + (k * bar) / 8, 0.25 + 0.35 * (k / 8));
    }
    if (b === sec.drop1[0] || b === sec.drop2[0]) impact(t0);

    // hats
    if (b >= 4 && !inS(b, 'brk')) {
      for (let k = 0; k < 8; k++) {
        const t = t0 + k * beat * 0.5;
        const off = k % 2 === 1;
        if (off) hat(t, drop ? 0.22 : 0.16, drop && k % 4 === 3);
        else if (drop || inS(b, 'groove')) hat(t, 0.07);
      }
      if (drop) for (let k = 0; k < 16; k += 2) hat(t0 + (k + 1) * beat * 0.25, 0.05);
    }
    if (inS(b, 'brk') && b >= 40) for (let k = 0; k < 4; k++) hat(t0 + (k + 0.5) * beat, 0.08);

    // clap / snare roll
    if (inS(b, 'drop1', 'drop2') || (inS(b, 'groove') && b >= 12)) { clap(t0 + beat, 0.55); clap(t0 + 3 * beat, 0.55); }
    if (inS(b, 'build1', 'build2')) {
      const stage = b - (b < 40 ? sec.build1[0] : sec.build2[0]);
      const div = [4, 8, 16, 32][stage];
      clapBP.frequency.setValueAtTime(1200 + stage * 500, t0);
      for (let k = 0; k < div; k++) clap(t0 + (k * bar) / div, 0.18 + 0.32 * ((stage * div + k) / (4 * div)));
      if (stage === 0) riser(t0, t0 + 4 * bar);
    }
    if (b === sec.drop1[0] || b === sec.drop2[0]) clapBP.frequency.setValueAtTime(1500, t0);

    // bass: off-beat plucks during groove/drops; held notes in the break
    const bassOn = inS(b, 'groove', 'drop1', 'drop2') || (inS(b, 'build1', 'build2') && b % 4 < 2);
    if (bassOn) {
      for (let k = 0; k < 4; k++) {
        const t = t0 + k * beat + beat * 0.5;
        const n = root + (drop && k === 3 ? 12 : 0);
        bassOsc.frequency.setValueAtTime(midi(n - 12), t);
        bassAmp.gain.setValueAtTime(0, t);
        bassAmp.gain.linearRampToValueAtTime(drop ? 0.42 : 0.32, t + 0.008);
        bassAmp.gain.setTargetAtTime(0, t + 0.06, 0.07);
        bassF.frequency.setValueAtTime(drop ? 2200 : 1100, t);
        bassF.frequency.setTargetAtTime(220, t + 0.01, 0.06);
      }
      subAmp.gain.setValueAtTime(drop ? 0.3 : 0.2, t0);
    } else if (inS(b, 'build1', 'build2')) {
      subAmp.gain.setValueAtTime(0.0, t0);
    } else if (inS(b, 'brk')) {
      subAmp.gain.setValueAtTime(0.14, t0);
    } else if (inS(b, 'outro')) {
      subAmp.gain.setValueAtTime(0.14, t0); subAmp.gain.linearRampToValueAtTime(0, T(68));
    }

    // arp
    const arpOn = inS(b, 'drop1', 'drop2', 'brk') || (inS(b, 'groove') && b >= 12) || inS(b, 'build1', 'build2');
    if (arpOn) {
      const ch = chords[ci];
      const lvl = drop ? 0.13 : inS(b, 'brk') ? 0.09 : 0.07;
      arpF.frequency.setValueAtTime(drop ? 3200 : inS(b, 'brk') ? 1500 : 1900, t0);
      for (let k = 0; k < 16; k++) {
        const t = t0 + k * beat * 0.25;
        const note = ch[arpPat[k]] + 12;
        arpOsc.frequency.setValueAtTime(midi(note), t);
        arpG.gain.setValueAtTime(0, t);
        arpG.gain.linearRampToValueAtTime(lvl, t + 0.003);
        arpG.gain.setTargetAtTime(0, t + 0.01, 0.05);
      }
    }

    // lead melody: second drop + last half of the first
    if (inS(b, 'drop2') || (inS(b, 'drop1') && b >= 28)) {
      const m = motif[ci];
      for (let k = 0; k < 8; k++) {
        const t = t0 + k * beat * 0.5;
        if (m[k] == null) { leadG.gain.setTargetAtTime(0, t, 0.03); continue; }
        leadOsc.frequency.setValueAtTime(midi(m[k]), t);
        leadOsc2.frequency.setValueAtTime(midi(m[k] - 12), t);
        leadG.gain.setValueAtTime(0, t);
        leadG.gain.linearRampToValueAtTime(0.11, t + 0.01);
        leadG.gain.setTargetAtTime(0.06, t + 0.03, 0.12);
      }
    } else if (b === sec.brk[0] || b === sec.outro[0]) {
      leadG.gain.setTargetAtTime(0, t0, 0.05);
    }
  }

  const rendered = await ctx.startRendering();
  // normalise to −1 dBFS peak
  let peak = 1e-6;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  }
  const g = 0.89 / peak;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  return rendered;
}
