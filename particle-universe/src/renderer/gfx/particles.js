// GPU particle state: three RGBA32F sets (A/B ping-pong + spawn/target S), each holding
// position(xyz,w), velocity(xyz, w=seed) and a scene-defined "home" vector.
import { Program, Texture, Target, FULLSCREEN_VS, GLError } from './gl.js';
import { HEADER, AUDIO, CONST, RNG, NOISE, PALETTE, SIM_UNIFORMS } from './glsl/common.js';

export const TIERS = [
  { n: 131072, w: 512, h: 256, label: '13 万' },
  { n: 262144, w: 512, h: 512, label: '26 万' },
  { n: 524288, w: 1024, h: 512, label: '52 万' },
  { n: 1048576, w: 1024, h: 1024, label: '105 万' },
  { n: 2097152, w: 2048, h: 1024, label: '210 万' },
  { n: 4194304, w: 2048, h: 2048, label: '419 万' }
];

const BATCH = 262144;

const SIM_OUT = `
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;
layout(location = 2) out vec4 oHome;
`;

const SIM_MAIN = `
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int id = c.y * uTexSize.x + c.x;
  vec4 P = texelFetch(uPos, c, 0);
  vec4 V = texelFetch(uVel, c, 0);
  vec4 H = texelFetch(uHome, c, 0);
  rngSeed(uint(id), uint(uFrame));
  simulate(P, V, H, id);
  if (any(isnan(P)) || any(isinf(P)) || any(isnan(V.xyz))) { P = vec4(0.0, 0.0, 0.0, P.w == P.w ? P.w : 0.0); V.xyz = vec3(0.0); }
  oPos = P; oVel = V; oHome = H;
}`;

const SPAWN_MAIN = `
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int id = c.y * uTexSize.x + c.x;
  rngSeed(uint(id) * 3u + 17u, uint(uFrame) + 7919u);
  vec4 P = vec4(0.0);
  vec4 V = vec4(0.0, 0.0, 0.0, hashi(id));
  vec4 H = vec4(0.0);
  spawn(P, V, H, id);
  oPos = P; oVel = V; oHome = H;
}`;

const MORPH_FS = HEADER + CONST + RNG + NOISE + `
uniform sampler2D uPos; uniform sampler2D uVel;
uniform sampler2D uTPos; uniform sampler2D uTVel; uniform sampler2D uTHome;
uniform ivec2 uTexSize;
uniform float uProgress, uDt, uTime, uSwirl;
` + SIM_OUT + `
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int id = c.y * uTexSize.x + c.x;
  vec4 TP = texelFetch(uTPos, c, 0), TV = texelFetch(uTVel, c, 0), TH = texelFetch(uTHome, c, 0);
  if (uProgress >= 1.0) { oPos = TP; oVel = TV; oHome = TH; return; }
  vec4 P = texelFetch(uPos, c, 0);
  vec3 p = P.xyz;
  if (any(isnan(p)) || length(p) > 5000.0) p = TP.xyz;
  float d = hashi(id) * 0.45;
  float local = clamp((uProgress - d) / 0.55, 0.0, 1.0);
  float rate = mix(0.25, 18.0, local * local);
  vec3 np = mix(p, TP.xyz, 1.0 - exp(-rate * uDt));
  float sw = sin(local * PI) * uSwirl * (0.6 + 0.8 * hashi(id + 77));
  np += curlNoise(p * 0.06 + vec3(0.0, uTime * 0.2, 0.0)) * sw * uDt * 60.0;
  vec3 v = (np - p) / max(uDt, 1e-4);
  oPos = vec4(np, TP.w);
  oVel = vec4(v, TV.w);
  oHome = TH;
}`;

const RESAMPLE_FS = HEADER + RNG + `
uniform sampler2D uPos; uniform sampler2D uVel; uniform sampler2D uHome;
uniform ivec2 uTexSize; uniform ivec2 uOldSize;
` + SIM_OUT + `
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int id = c.y * uTexSize.x + c.x;
  int oldN = uOldSize.x * uOldSize.y, newN = uTexSize.x * uTexSize.y;
  int src = newN <= oldN ? int(float(id) * float(oldN) / float(newN)) : id % oldN;
  ivec2 sc = ivec2(src % uOldSize.x, src / uOldSize.x);
  vec4 P = texelFetch(uPos, sc, 0), V = texelFetch(uVel, sc, 0), H = texelFetch(uHome, sc, 0);
  if (id >= oldN) { rngSeed(uint(id), 99u); P.xyz += rndDir() * 0.08; }
  oPos = P; oVel = V; oHome = H;
}`;

export const RENDER_UNIFORMS = `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uHome;
uniform ivec2 uTexSize;
uniform int uBase;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec3 uCamPos;
uniform vec2 uViewport;
uniform float uPxPerUnit;
uniform float uSizeScale;
uniform float uIntensity;
uniform float uStreak;
uniform float uFocus;
uniform float uAperture;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uStreakKeep;
uniform vec4 uR0;
uniform vec4 uR1;
uniform vec4 uS0;
uniform vec4 uS1;
uniform vec4 uS2;
uniform vec4 uS3;
uniform vec4 uWave[4];
uniform float uCount;
uniform float uSplitDepth;
`;

const RENDER_VS_MAIN = `
out vec3 vColor;
out vec2 vLocal;
flat out float vHalf;
flat out float vFront;
void main() {
  int q = gl_VertexID >> 2;
  int corner = gl_VertexID & 3;
  int id = uBase + q;
  ivec2 c = ivec2(id % uTexSize.x, id / uTexSize.x);
  vec4 P = texelFetch(uPos, c, 0);
  vec4 V = texelFetch(uVel, c, 0);
  vec4 H = texelFetch(uHome, c, 0);
  vec3 color = vec3(0.0);
  float size = 0.0;
  rngSeed(uint(id), 3u);
  shade(P, V, H, id, color, size);
  vec4 vp = uView * vec4(P.xyz, 1.0);
  float depth = -vp.z;
  vHalf = 0.0; vFront = 0.0; vLocal = vec2(0.0); vColor = vec3(0.0);
  if (depth < 0.02 || size <= 0.0 || dot(color, color) < 1e-12) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 clip = uProj * vp;
  float r0 = size * uSizeScale * uPxPerUnit / depth;
  float r = max(r0, uMinPx);
  float energy = (r0 * r0) / (r * r);
  float coc = uAperture * abs(depth - uFocus) / depth * uPxPerUnit * 0.012;
  float rd = min(sqrt(r * r + coc * coc), uMaxPx);
  energy *= min(1.0, (r * r) / (rd * rd));
  r = rd;
  vec2 dpx = vec2(0.0);
  if (uStreak > 0.0) {
    vec4 c2 = uProj * (uView * vec4(P.xyz - V.xyz * uStreak, 1.0));
    if (c2.w > 0.02) dpx = (clip.xy / clip.w - c2.xy / c2.w) * 0.5 * uViewport;
  }
  float L = min(length(dpx), 220.0);
  vec2 ax = L > 0.25 ? dpx / L : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float halfL = 0.5 * L;
  energy *= pow(r / (r + halfL), uStreakKeep);
  vec2 lc = vec2(float(corner & 1), float(corner >> 1)) * 2.0 - 1.0;
  float ex = r + halfL;
  vec2 off = ax * (lc.x * ex - halfL) + ay * (lc.y * r);
  gl_Position = clip + vec4(off * 2.0 / uViewport * clip.w, 0.0, 0.0);
  vLocal = vec2(lc.x * ex, lc.y * r) / r;
  vHalf = halfL / r;
  vColor = color * energy * uIntensity;
  vFront = clamp(0.5 - (depth - uSplitDepth) * 0.6, 0.0, 1.0);
}`;

const RENDER_FS = (split) => HEADER + `
in vec3 vColor;
in vec2 vLocal;
flat in float vHalf;
flat in float vFront;
layout(location = 0) out vec4 o0;
${split ? 'layout(location = 1) out vec4 o1;' : ''}
void main() {
  float dx = max(abs(vLocal.x) - vHalf, 0.0);
  float r2 = dx * dx + vLocal.y * vLocal.y;
  float a = max(exp(-r2 * 4.0) - 0.0183, 0.0) * 1.0187;
  vec3 c = vColor * a;
  ${split ? 'o0 = vec4(c * (1.0 - vFront), 0.0); o1 = vec4(c * vFront, 0.0);' : 'o0 = vec4(c, 0.0);'}
}`;

class StateSet {
  constructor(gl, w, h) {
    this.pos = new Texture(gl, w, h, 'rgba32f', { filter: 'NEAREST' });
    this.vel = new Texture(gl, w, h, 'rgba32f', { filter: 'NEAREST' });
    this.home = new Texture(gl, w, h, 'rgba32f', { filter: 'NEAREST' });
    this.target = new Target(gl, [this.pos, this.vel, this.home]);
  }
  dispose() { this.target.dispose(true); }
}

export class ParticleSystem {
  constructor(gl, tier) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
    this.ibo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const idx = new Uint32Array(BATCH * 6);
    for (let q = 0; q < BATCH; q++) {
      const b = q * 4, o = q * 6;
      idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2;
      idx[o + 3] = b + 2; idx[o + 4] = b + 1; idx[o + 5] = b + 3;
    }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.triVao = gl.createVertexArray();
    this.programs = new Map();
    this.morphProg = new Program(gl, FULLSCREEN_VS, MORPH_FS, 'morph');
    this.resampleProg = new Program(gl, FULLSCREEN_VS, RESAMPLE_FS, 'resample');
    this.frame = 0;
    this.sets = null;
    this.alloc(tier);
  }

  alloc(tier) {
    const gl = this.gl;
    const sets = [];
    try {
      for (let i = 0; i < 3; i++) sets.push(new StateSet(gl, tier.w, tier.h));
      const err = gl.getError();
      if (err === gl.OUT_OF_MEMORY) throw new GLError('显存不足');
    } catch (e) {
      sets.forEach((s) => s.dispose());
      throw e;
    }
    const old = this.sets;
    this.sets = sets;
    this.tier = tier;
    this.count = tier.n;
    this.w = tier.w; this.h = tier.h;
    this.cur = 0; // index of the readable state
    this.spawnSet = 2;
    return old;
  }

  get state() { return this.sets[this.cur]; }
  get other() { return this.sets[this.cur === 0 ? 1 : 0]; }
  get spawned() { return this.sets[this.spawnSet]; }

  // Compile (and cache) sim / spawn / render programs for a scene.
  sceneProgram(scene) {
    let p = this.programs.get(scene.id);
    if (p) return p;
    const gl = this.gl;
    const common = scene.common || '';
    const simFS = HEADER + CONST + AUDIO + SIM_UNIFORMS + RNG + NOISE + SIM_OUT + common + scene.sim + SIM_MAIN;
    const spawnFS = HEADER + CONST + AUDIO + SIM_UNIFORMS + RNG + NOISE + SIM_OUT + common + scene.spawn + SPAWN_MAIN;
    const vs = HEADER + CONST + AUDIO + RENDER_UNIFORMS + RNG + NOISE + PALETTE + common + scene.render + RENDER_VS_MAIN;
    p = {
      sim: new Program(gl, FULLSCREEN_VS, simFS, scene.id + ':sim'),
      spawn: new Program(gl, FULLSCREEN_VS, spawnFS, scene.id + ':spawn'),
      render: new Program(gl, vs, RENDER_FS(!!scene.lens), scene.id + ':render')
    };
    this.programs.set(scene.id, p);
    return p;
  }

  _pass(prog, target) {
    const gl = this.gl;
    target.bind();
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.triVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _bindState(prog, set) {
    prog.set('uPos', set.pos).set('uVel', set.vel).set('uHome', set.home);
  }

  spawn(scene, uniforms, intoCurrent = false) {
    const p = this.sceneProgram(scene).spawn.use();
    p.setAll(uniforms);
    p.set('uTexSize', [this.w, this.h]).set('uFrame', (Math.random() * 1e6) | 0).set('uCount', this.count);
    const dst = intoCurrent ? this.other : this.spawned;
    this._pass(p, dst.target);
    if (intoCurrent) this.cur = this.cur === 0 ? 1 : 0;
  }

  step(scene, uniforms) {
    const p = this.sceneProgram(scene).sim.use();
    p.setAll(uniforms);
    this._bindState(p, this.state);
    p.set('uTexSize', [this.w, this.h]).set('uFrame', this.frame++).set('uCount', this.count);
    this._pass(p, this.other.target);
    this.cur = this.cur === 0 ? 1 : 0;
  }

  morph(progress, dt, time, swirl) {
    const p = this.morphProg.use();
    const s = this.state, t = this.spawned;
    p.set('uPos', s.pos).set('uVel', s.vel).set('uTPos', t.pos).set('uTVel', t.vel).set('uTHome', t.home);
    p.set('uTexSize', [this.w, this.h]).set('uProgress', progress).set('uDt', dt).set('uTime', time).set('uSwirl', swirl);
    this._pass(p, this.other.target);
    this.cur = this.cur === 0 ? 1 : 0;
  }

  // Change particle count, carrying the current state over (duplicates are jittered).
  resize(tier) {
    if (tier.n === this.count) return;
    const oldSet = this.state, ow = this.w, oh = this.h;
    const oldSets = this.alloc(tier);
    const p = this.resampleProg.use();
    this._bindState(p, oldSet);
    p.set('uTexSize', [this.w, this.h]).set('uOldSize', [ow, oh]);
    this._pass(p, this.state.target);
    if (oldSets) oldSets.forEach((s) => s.dispose());
  }

  render(scene, uniforms, count = this.count) {
    const gl = this.gl;
    const p = this.sceneProgram(scene).render.use();
    p.setAll(uniforms);
    this._bindState(p, this.state);
    p.set('uTexSize', [this.w, this.h]).set('uCount', this.count);
    gl.bindVertexArray(this.vao);
    for (let base = 0; base < count; base += BATCH) {
      p.set('uBase', base);
      gl.drawElements(gl.TRIANGLES, Math.min(BATCH, count - base) * 6, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }

  // GPU bytes used by particle state.
  get bytes() { return this.count * 16 * 9; }

  dispose() {
    const gl = this.gl;
    this.sets.forEach((s) => s.dispose());
    for (const p of this.programs.values()) { p.sim.dispose(); p.spawn.dispose(); p.render.dispose(); }
    this.morphProg.dispose(); this.resampleProg.dispose();
    gl.deleteBuffer(this.ibo); gl.deleteVertexArray(this.vao); gl.deleteVertexArray(this.triVao);
  }
}
