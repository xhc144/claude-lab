// Render engine: owns the GL context, particle system and post chain; runs scene simulation,
// scene-to-scene morph transitions, and turns audio frames into shader uniforms.
import { createContext, Texture, gpuName, prettyGpuName, Program, FULLSCREEN_VS } from './gl.js';
import { ParticleSystem, TIERS } from './particles.js';
import { PostFX } from './post.js';
import { buildPaletteData, paletteRowV } from './palettes.js';
import { Camera } from '../camera/camera.js';
import { SCENES, sceneById, defaultParams } from '../scenes/index.js';
import { HEADER, RNG } from './glsl/common.js';
import { mulberry32 } from '../camera/director.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const smooth = (t) => t * t * (3 - 2 * t);

const BIGBANG_FS = HEADER + RNG + `
uniform ivec2 uTexSize;
layout(location = 0) out vec4 oPos; layout(location = 1) out vec4 oVel; layout(location = 2) out vec4 oHome;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int id = c.y * uTexSize.x + c.x;
  rngSeed(uint(id), 4242u);
  oPos = vec4(rndBall() * 0.35, 0.0);
  oVel = vec4(rndDir() * 2.0, hashi(id));
  oHome = vec4(0.0);
}`;

const POST_KEYS = ['exposure', 'bloom', 'bloomRadius', 'threshold', 'trails', 'flare', 'ca', 'vignette', 'grain', 'streak', 'size', 'intensity', 'dof', 'sat', 'contrast', 'maxPx', 'trailZoom', 'streakKeep'];
const POST_DEFAULTS = { maxPx: 30, trailZoom: 1, sat: 1, contrast: 1, threshold: 0, bloomRadius: 1, streakKeep: 1, flareTint: [0.6, 0.75, 1] };
const BG_DEFAULT = { stars: 0, haze: 0, hazeScale: 1.5, hazeA: [0, 0, 0], hazeB: [0, 0, 0], top: [0, 0, 0], bottom: [0, 0, 0], glow: null };

function postOf(scene) { return { ...POST_DEFAULTS, ...scene.post }; }
function bgOf(scene) {
  const b = { ...BG_DEFAULT, ...scene.background };
  const g = b.glow || { dir: [0, 0, -1], color: [0, 0, 0], amount: 0, size: 0.05 };
  return { ...b, glowDir: g.dir, glowColor: g.color, glowAmount: g.amount, glowSize: g.size };
}
function mixPost(a, b, t) {
  const o = {};
  for (const k of POST_KEYS) o[k] = lerp(a[k] ?? POST_DEFAULTS[k] ?? 0, b[k] ?? POST_DEFAULTS[k] ?? 0, t);
  o.flareTint = lerpArr(a.flareTint, b.flareTint, t);
  return o;
}
function mixBg(a, b, t) {
  const o = {};
  for (const k of ['stars', 'haze', 'hazeScale', 'glowAmount', 'glowSize']) o[k] = lerp(a[k], b[k], t);
  for (const k of ['hazeA', 'hazeB', 'top', 'bottom', 'glowColor', 'glowDir']) o[k] = lerpArr(a[k], b[k], t);
  return o;
}

export class Engine extends EventTarget {
  constructor(canvas, settings) {
    super();
    this.canvas = canvas;
    this.settings = settings;
    this.camera = new Camera();
    this.time = 0;
    this.sceneTime = 0;
    this.scene = null;
    this.sceneState = {};
    this.sceneUniforms = {};
    this.trans = null;
    this.waves = [];
    this.waveData = new Float32Array(16);
    this.flash = 0;
    this.fade = 1;
    this.tierIndex = 3;
    this.renderScale = 1;
    this.outW = 0; this.outH = 0;
    this.fixedOutput = null;
    this.rng = mulberry32(7);
    this.stats = { fps: 0, frameMs: 0, gpuMs: null, particles: 0 };
    this.label = '';
    this.lensState = { ringIntensity: 0.05, shadowScale: 1 };
    this.glowState = { amount: 0, size: 0.05 };
    this.stress = 1;
    this.lost = false;
    this.va = {};
    this.specData = new Float32Array(128);
    this._initGL();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.dispatchEvent(new Event('contextlost')); });
    canvas.addEventListener('webglcontextrestored', () => { this._initGL(); this.lost = false; this._restoreScene(); this.dispatchEvent(new Event('contextrestored')); });
  }

  _initGL() {
    const gl = (this.gl = createContext(this.canvas));
    this.gpu = gpuName(gl);
    this.gpuPretty = prettyGpuName(this.gpu);
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.particles = new ParticleSystem(gl, TIERS[Math.min(this.tierIndex, TIERS.length - 1)]);
    this.post = new PostFX(gl);
    const pal = buildPaletteData();
    this.paletteTex = new Texture(gl, pal.width, pal.height, 'rgba16f', { data: pal.data, srcType: 'FLOAT' });
    this.specTex = new Texture(gl, 128, 1, 'r16f', { data: new Float32Array(128), srcType: 'FLOAT' });
    this.bigbangProg = new Program(gl, FULLSCREEN_VS, BIGBANG_FS, 'bigbang');
    this.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.queries = [];
    this.post.resize(64, 64);
    this._visualAudio(null, 0);
  }

  get tier() { return TIERS[this.tierIndex]; }

  // ---- sizing ----------------------------------------------------------------------------
  setOutputSize(w, h) {
    w = Math.max(16, Math.round(w)); h = Math.max(16, Math.round(h));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.outW = w; this.outH = h;
    this._resizeInternal();
  }

  setRenderScale(s) {
    this.renderScale = clamp(s, 0.35, 1.5);
    this._resizeInternal();
  }

  _resizeInternal() {
    const w = Math.round(this.outW * this.renderScale), h = Math.round(this.outH * this.renderScale);
    this.post.resize(w, h);
  }

  setTier(index, { morph = true } = {}) {
    index = clamp(index, 0, TIERS.length - 1);
    if (TIERS[index].w > this.maxTex) index = TIERS.findIndex((t) => t.w > this.maxTex) - 1;
    if (index === this.tierIndex && this.particles.count === TIERS[index].n) return;
    const prev = this.tierIndex;
    this.tierIndex = index;
    try {
      this.particles.resize(TIERS[index]);
    } catch (e) {
      console.warn('tier allocation failed', e);
      this.tierIndex = prev;
      this.particles.resize(TIERS[prev]);
      return false;
    }
    if (this.scene && morph && !this.trans) {
      this._sceneUpdate(0);
      this.particles.spawn(this.scene, this._simUniforms(0));
      this.trans = { phase: 'morph', t: 0, dur: 1.2, to: this.scene, from: this.scene, swirl: 0.15, tierChange: true };
    } else if (this.scene && !this.trans) {
      this._sceneUpdate(0);
      this.particles.spawn(this.scene, this._simUniforms(0), true);
    }
    this.dispatchEvent(new CustomEvent('tier', { detail: index }));
    return true;
  }

  // ---- scenes ----------------------------------------------------------------------------
  _paramsFor(scene) {
    const user = (this.settings.sceneParams && this.settings.sceneParams[scene.id]) || {};
    return { ...defaultParams(scene), ...user };
  }

  _packParams(scene) {
    const p = this._paramsFor(scene);
    const vals = scene.params.filter((d) => !d.noPack).map((d) => p[d.key]);
    while (vals.length < 8) vals.push(0);
    return { uS0: vals.slice(0, 4), uS1: vals.slice(4, 8) };
  }

  start(sceneId, { intro = true } = {}) {
    const scene = sceneById(sceneId);
    this.scene = scene;
    this.sceneState = {};
    this.sceneTime = 0;
    this.sceneUniforms = {};
    this.postCur = postOf(scene); this.postFrom = this.postCur; this.postTo = this.postCur;
    this.bgFrom = bgOf(scene); this.bgTo = this.bgFrom;
    this.palFrom = this._paletteId(scene); this.palTo = this.palFrom; this.palMix = 1;
    this.lensAmt = 0;
    this._sceneUpdate(0);
    if (!intro) {
      this.particles.spawn(scene, this._simUniforms(0), true);
      this.trans = null;
      this.post.clearAccum();
      this.dispatchEvent(new CustomEvent('scene', { detail: { scene, duration: 0, intro: false } }));
      return;
    }
    // big bang: collapse everything into a point, then morph out into the first scene
    const gl = this.gl;
    const p = this.bigbangProg.use();
    p.set('uTexSize', [this.particles.w, this.particles.h]);
    this.particles._pass(p, this.particles.state.target);
    this.particles.spawn(scene, this._simUniforms(0));
    this.trans = { phase: 'morph', t: 0, dur: 4.2, to: scene, from: scene, swirl: 0.6, intro: true };
    this.post.clearAccum();
    this.dispatchEvent(new CustomEvent('scene', { detail: { scene, duration: 4.2, intro: true } }));
    void gl;
  }

  _restoreScene() {
    if (!this.scene) return;
    const id = this.scene.id;
    this.trans = null;
    this.post.resize(Math.round(this.outW * this.renderScale), Math.round(this.outH * this.renderScale));
    this.start(id);
  }

  _paletteId(scene) {
    const p = this.settings.color.palette;
    return p && p !== 'auto' ? p : scene.palette;
  }

  switchScene(id, { duration = null } = {}) {
    const to = sceneById(id);
    if (!this.scene) return this.start(id);
    if (this.trans && this.trans.to === to) return;
    if (to === this.scene && !this.trans) return;
    const dur = duration || this.settings.particles.transition || 3;
    this.trans = { phase: 'fadeout', t: 0, fadeDur: 0.32, dur, to, from: this.scene, swirl: 0.55 };
  }

  // Re-spawn the current scene (e.g. attractor variant change) with a morph.
  respawn(duration = 2.5) {
    if (this.trans) return;
    this.particles.spawn(this.scene, this._simUniforms(0));
    this.trans = { phase: 'morph', t: 0, dur: duration, to: this.scene, from: this.scene, swirl: 0.35, variant: true };
  }

  refreshPalette() {
    const id = this._paletteId(this.trans ? this.trans.to : this.scene);
    if (id !== this.palTo) { this.palFrom = this._mixedPaletteFrom(); this.palTo = id; this.palMix = 0; }
  }

  _mixedPaletteFrom() { return this.palMix >= 0.5 ? this.palTo : this.palFrom; }

  _sceneUpdate(dt, frameEvents = { kicks: [], snares: [], hats: [], drop: false, section: false }) {
    const scene = this.scene;
    const self = this;
    const ctx = {
      dt, time: this.sceneTime, audio: this.va, events: frameEvents, state: this.sceneState,
      params: this._paramsFor(scene), speed: this.settings.particles.speed, uniforms: this.sceneUniforms,
      lens: this.lensState, glow: this.glowState, rng: this.rng, label: '',
      autoVariants: this.settings.scene.autoSwitch !== 'off',
      requestRespawn(d) { self._respawnRequest = d; }
    };
    if (scene.update) scene.update(ctx);
    this.label = ctx.label || '';
  }

  _audioUniforms() {
    const a = this.va;
    return {
      uA0: [a.bass, a.mid, a.treble, a.level],
      uA1: [a.kick, a.snare, a.hat, a.onset],
      uA2: [a.sub, a.lowMid, a.highMid, a.intensity],
      uA3: [a.drop, a.build, a.beatPhase, a.centroid],
      uSpec: this.specTex,
      uTime: this.sceneTime,
      uDt: this._dt || 1 / 60
    };
  }

  _simUniforms(dt) {
    const s = this.settings.particles;
    return {
      ...this._audioUniforms(),
      ...this._packParams(this.scene),
      uS2: [0, 0, 0, 0], uS3: [0, 0, 0, 0], uR0: [0, 0, 0, 0], uR1: [0, 0, 0, 0],
      ...this.sceneUniforms,
      uSpeed: s.speed, uTurb: s.turbulence,
      uWave: this.waveData,
      uCamPos: this.camera.pos,
      uDt: dt || 1 / 60
    };
  }

  // ---- audio → visual values ---------------------------------------------------------------
  _visualAudio(f, dt) {
    const A = this.settings.audio;
    const r = A.reactivity, bw = A.bass, tw = A.treble, im = A.impact;
    const va = this.va;
    const c = (v, m = 1.6) => clamp(v, 0, m);
    if (f && f.active) {
      va.bass = c(f.bass * r * bw); va.sub = c(f.sub * r * bw); va.lowMid = c(f.lowMid * r);
      va.mid = c(f.mid * r); va.highMid = c(f.highMid * r * tw); va.treble = c(f.treble * r * tw);
      va.level = c(f.rms * r); va.kick = c(f.kick * im * Math.min(1.3, r)); va.snare = c(f.snare * im);
      va.hat = c(f.hat * tw); va.onset = c(f.onset); va.intensity = c(f.intensity, 1);
      va.drop = c(f.drop * im, 1.5); va.build = c(f.build, 1); va.centroid = f.centroid;
      va.beatPhase = f.beatPhase; va.chroma = f.chroma; va.active = true;
      va.bar = f.bar; va.beat = f.beat; va.hasTempo = f.hasTempo; va.bpm = f.bpm;
      for (let i = 0; i < 128; i++) this.specData[i] = clamp(f.spectrum[i] * Math.min(1.6, r), 0, 1.5);
    } else {
      // ambient idle motion when nothing is playing
      const t = this.time;
      const breath = 0.5 + 0.5 * Math.sin(t * 0.7);
      va.bass = 0.12 + 0.08 * breath; va.sub = 0.1; va.lowMid = 0.1; va.mid = 0.1 + 0.05 * Math.sin(t * 0.9);
      va.highMid = 0.08; va.treble = 0.08; va.level = 0.18; va.kick = 0; va.snare = 0; va.hat = 0; va.onset = 0;
      va.intensity = 0.25; va.drop = 0; va.build = 0; va.centroid = 0.45; va.beatPhase = (t * 0.5) % 1;
      va.chroma = va.chroma || new Float32Array(12); va.active = false; va.hasTempo = false; va.bar = 0; va.beat = 0;
      for (let i = 0; i < 128; i++) this.specData[i] = 0.18 + 0.1 * Math.sin(t * 0.8 + i * 0.12) * breath;
    }
    this.specTex.upload(this.specData);
    void dt;
  }

  _updateWaves(dt, events) {
    const im = this.settings.audio.impact;
    for (const w of this.waves) w.age += dt;
    this.waves = this.waves.filter((w) => w.age < 4.5);
    const add = (strength) => {
      if (this.waves.length >= 4) this.waves.shift();
      this.waves.push({ age: 0, strength, seed: this.rng() });
    };
    if (events.drop) add(1.8 * im);
    for (const k of events.kicks) if (k.strength * im > 0.35) add(Math.min(1.4, k.strength * im));
    this.waveData.fill(0);
    this.waves.forEach((w, i) => { this.waveData.set([w.age, w.strength, w.seed, 0], i * 4); });
  }

  // ---- main frame ------------------------------------------------------------------------
  frame(dt, audioFrame, events, pose) {
    if (this.lost || !this.scene) return;
    this._gpuBegin();
    this.simulate(dt, audioFrame, events);
    this.render(dt, pose);
    this._gpuEnd();
  }

  simulate(dt, audioFrame, events) {
    dt = clamp(dt, 0, 1 / 15);
    this._dt = Math.max(dt, 1e-4);
    this.time += dt;
    this._visualAudio(audioFrame, dt);
    this._updateWaves(dt, events);
    if (events.drop) this.flash = Math.max(this.flash, 0.22 * this.settings.audio.impact);
    this.flash *= Math.exp(-dt * 3.5);

    // ---- transitions / simulation ----
    let fade = 1;
    const tr = this.trans;
    if (tr && tr.phase === 'fadeout') {
      tr.t += dt;
      const k = Math.min(1, tr.t / tr.fadeDur);
      fade = 1 - smooth(k) * 0.85;
      if (this.scene.lens) this.lensAmt = Math.max(0, 1 - k);
      this.sceneTime += dt;
      this._sceneUpdate(dt, events);
      this.particles.step(this.scene, this._simUniforms(dt));
      if (k >= 1) this._beginMorph(tr);
    } else if (tr && tr.phase === 'morph') {
      tr.t += dt;
      const p = Math.min(1, tr.t / tr.dur);
      this.particles.morph(p, this._dt, this.time, tr.swirl);
      fade = tr.intro ? smooth(Math.min(1, p * 1.6)) : 0.15 + 0.85 * smooth(Math.min(1, p * 2.2));
      if (tr.variant || tr.tierChange) fade = 0.6 + 0.4 * smooth(Math.min(1, p * 2));
      if (this.scene.lens) this.lensAmt = smooth(p);
      const t = smooth(p);
      if (tr.postBlend) {
        this.postCur = mixPost(this.postFrom, this.postTo, t);
        this.bgCur = mixBg(this.bgFrom, this.bgTo, t);
      }
      if (p >= 1) {
        this.trans = null;
        this.postCur = this.postTo; this.bgCur = this.bgTo;
        this.dispatchEvent(new CustomEvent('transitionend', { detail: { scene: this.scene } }));
      }
    } else {
      this.sceneTime += dt;
      this._sceneUpdate(dt, events);
      this.particles.step(this.scene, this._simUniforms(dt));
      if (this._respawnRequest) { const d = this._respawnRequest; this._respawnRequest = null; this.respawn(d); }
      if (this.scene.lens) this.lensAmt = Math.min(1, (this.lensAmt || 0) + dt * 2);
    }
    if (!this.scene.lens) this.lensAmt = 0;
    this.fade = fade;
    this.palMix = Math.min(1, this.palMix + dt / Math.max(0.5, (this.settings.particles.transition || 3) * 0.8));
  }

  render(dt, pose) {
    if (this.lost || !this.scene) return;
    dt = clamp(dt, 0, 1 / 15);
    const fade = this.fade;
    // ---- camera ----
    const post = this.postCur;
    const W = this.post.w, H = this.post.h;
    this.camera.set(pose);
    this.camera.update(this.outW / this.outH);

    // ---- particles ----
    const split = !!this.scene.lens && this.lensAmt > 0.001;
    this.post.beginParticles(split);
    const ru = this._renderUniforms(post, W, H, fade);
    const passes = this.stress > 1 ? this.stress : 1;
    for (let i = 0; i < passes; i++) {
      if (i > 0) ru.uIntensity = 0;
      this.particles.render(this.scene, ru);
    }
    this.post.endParticles();

    // ---- post ----
    const fx = this.settings.fx;
    const d60 = clamp(post.trails * fx.trails, 0, 0.965);
    const decay = d60 > 0.001 ? Math.pow(d60, dt * 60) : 0;
    const lens = this._lensUniforms(split);
    this.post.accumulate({
      uDecay: decay, uComp: lerp(1, 1 - decay, 0.55),
      uWarp: [post.trailZoom || 1, 0, 0, 0],
      ...lens
    });
    const bg = this.bgCur || bgOf(this.scene);
    const glow = this.scene.background && this.scene.background.glow ? this.glowState : null;
    this.post.background({
      uInvVP: this.camera.invViewProj, uCamPos: this.camera.pos,
      uPixelAngle: (2 * Math.tan((this.camera.fov * Math.PI) / 360)) / H,
      uStars: bg.stars * fx.stars, uHaze: bg.haze * fx.stars, uHazeScale: bg.hazeScale,
      uHazeA: bg.hazeA, uHazeB: bg.hazeB, uBgTop: bg.top, uBgBottom: bg.bottom,
      uGlowDir: bg.glowDir, uGlowColor: bg.glowColor,
      uGlow: [glow ? glow.amount * (bg.glowAmount > 0 ? 1 : 0) : bg.glowAmount, glow ? glow.size : bg.glowSize],
      uTime: this.time, uBgPulse: this.va.bass * 0.4 + this.va.drop * 0.6,
      ...lens
    });
    const bloomTex = this.post.bloom({ threshold: post.threshold, knee: 0.6, radius: clamp(0.6 * post.bloomRadius * fx.bloomRadius, 0.25, 0.92) });
    const flareStr = post.flare * fx.flare;
    const flareTex = flareStr > 0.001 ? this.post.flare(0.6) : this.post.mips[0].textures[0];
    const col = this.settings.color;
    const aspect = this.outW / this.outH;
    const letter = fx.letterbox ? Math.max(0, (1 - aspect / 2.39) / 2) : 0;
    this.post.composite({
      uExposure: post.exposure * this.settings.particles.brightness * (1 + this.va.drop * 0.15),
      uBloomStr: post.bloom * fx.bloom * 0.2,
      uBlack: 0.0025,
      uFlareStr: flareStr > 0.001 ? flareStr * 0.5 * (1 + this.va.kick * 0.5) : 0,
      uFlareTint: post.flareTint,
      uCA: post.ca * fx.chroma * (1 + this.va.kick * 0.9 + this.va.drop * 1.5),
      uVignette: post.vignette * fx.vignette,
      uGrain: post.grain * fx.grain,
      uSat: post.sat * col.saturation, uContrast: post.contrast * col.contrast,
      uHue: (col.hue * Math.PI) / 180, uTemp: col.temperature,
      uLetterbox: letter, uTime: this.time,
      uFlash: this.flash, uFlashColor: [1, 0.95, 0.9], uFade: Math.min(1, this.fadeIn == null ? 1 : this.fadeIn)
    }, this.outW, this.outH, bloomTex, flareTex);
    this.stats.particles = this.particles.count;
  }

  _beginMorph(tr) {
    const from = this.scene;
    const postFrom = this.postCur;
    const bgFrom = this.bgCur || bgOf(from);
    this.scene = tr.to;
    this.sceneState = {};
    this.sceneUniforms = {};
    this.sceneTime = 0;
    this._sceneUpdate(0);
    this.particles.spawn(this.scene, this._simUniforms(0));
    tr.phase = 'morph';
    tr.t = 0;
    tr.postBlend = true;
    this.postFrom = postFrom; this.postTo = postOf(this.scene);
    this.bgFrom = bgFrom; this.bgTo = bgOf(this.scene);
    this.palFrom = this._mixedPaletteFrom(); this.palTo = this._paletteId(this.scene); this.palMix = 0;
    this.lensAmt = 0;
    this.dispatchEvent(new CustomEvent('scene', { detail: { scene: this.scene, from, duration: tr.dur } }));
  }

  _renderUniforms(post, W, H, fade) {
    const s = this.settings.particles;
    const cam = this.camera;
    const nNorm = Math.pow(1048576 / this.particles.count, 0.9);
    const focus = Math.hypot(cam.pos[0] - cam.target[0], cam.pos[1] - cam.target[1], cam.pos[2] - cam.target[2]);
    let splitDepth = 0;
    if (this.scene.lens) splitDepth = cam.project([0, 0, 0]).depth;
    const pa = this.palFrom, pb = this.palTo;
    return {
      ...this._audioUniforms(),
      ...this._packParams(this.scene),
      uS2: [0, 0, 0, 0], uS3: [0, 0, 0, 0], uR0: [0, 0, 0, 0], uR1: [0, 0, 0, 0],
      ...this.sceneUniforms,
      uWave: this.waveData,
      uView: cam.view, uProj: cam.proj, uCamPos: cam.pos,
      uViewport: [W, H], uPxPerUnit: cam.pxPerUnit(H),
      uSizeScale: s.size * post.size,
      uIntensity: post.intensity * nNorm * fade,
      uStreak: post.streak * s.streak,
      uStreakKeep: post.streakKeep ?? 1,
      uFocus: focus, uAperture: post.dof * this.settings.fx.dof,
      uMinPx: 1.15 * Math.max(0.75, H / 1080), uMaxPx: (post.maxPx || 30) * Math.max(0.6, H / 1080),
      uSplitDepth: splitDepth,
      uPalette: this.paletteTex, uPal: [paletteRowV(pa), paletteRowV(pb), smooth(this.palMix)]
    };
  }

  _lensUniforms(split) {
    if (!split) return { uLensAmt: 0, uLens: [0.5, 0.5, 0, 0], uRing: [0, 0, 0, 0] };
    const cfg = this.scene.lensConfig;
    const cam = this.camera;
    const pr = cam.project([0, 0, 0]);
    if (pr.depth < 0.5) return { uLensAmt: 0, uLens: [0.5, 0.5, 0, 0], uRing: [0, 0, 0, 0] };
    const dist = Math.hypot(cam.pos[0], cam.pos[1], cam.pos[2]);
    const rsh = cfg.shadow * this.lensState.shadowScale;
    const ang = Math.asin(Math.min(0.95, rsh / dist));
    const shadow = (Math.tan(ang) / Math.tan((cam.fov * Math.PI) / 360)) * 0.5;
    const ri = this.lensState.ringIntensity;
    return {
      uLensAmt: this.lensAmt, uLens: [pr.u, pr.v, shadow, shadow * cfg.einstein],
      uRing: [cfg.ring[0], cfg.ring[1], cfg.ring[2], ri * this.lensAmt]
    };
  }

  // ---- GPU timing ----------------------------------------------------------------------------
  _gpuBegin() {
    const gl = this.gl, ext = this.timer;
    if (!ext) return;
    // collect finished queries
    while (this.queries.length) {
      const q = this.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      if (!disjoint) this.stats.gpuMs = this.stats.gpuMs == null ? ns / 1e6 : this.stats.gpuMs * 0.9 + (ns / 1e6) * 0.1;
      gl.deleteQuery(q);
      this.queries.shift();
    }
    if (this.queries.length > 4) return;
    const q = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    this._activeQuery = q;
  }

  _gpuEnd() {
    if (!this._activeQuery) return;
    this.gl.endQuery(this.timer.TIME_ELAPSED_EXT);
    this.queries.push(this._activeQuery);
    this._activeQuery = null;
  }

  // ---- utilities -----------------------------------------------------------------------------
  screenshot(type = 'image/png') {
    return new Promise((resolve) => this.canvas.toBlob(resolve, type, 0.95));
  }

  get sceneList() { return SCENES; }
}
