// 流体 · Liquid Silk — a thin slab of particles advected by an evolving divergence-free flow,
// stirred by four band-driven vortices. Colour follows flow direction, long trails turn the
// motion into silk.

export default {
  id: 'silk',
  name: '流体丝绸',
  en: 'LIQUID SILK',
  desc: '无散度流场推动百万粒子，四个频段涡旋搅动，拖尾化作流动的丝绸',
  palette: 'neon',
  params: [
    { key: 'flow', label: '流速', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'scale', label: '流体尺度', min: 0.4, max: 2.5, step: 0.01, def: 1 },
    { key: 'vortex', label: '涡旋强度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'hue', label: '色彩流动', min: 0, max: 3, step: 0.01, def: 1 }
  ],
  post: { exposure: 1.0, bloom: 0.55, bloomRadius: 0.85, threshold: 0.0, trails: 0.55, flare: 0.15, flareTint: [0.8, 0.8, 1.0], ca: 0.5, vignette: 0.6, grain: 0.32, streak: 0.07, streakKeep: 0.5, size: 1.0, intensity: 1.0, dof: 0.0, sat: 1.15, contrast: 1.08, maxPx: 20 },
  background: { stars: 0.0, haze: 0.0, hazeScale: 1, hazeA: [0, 0, 0], hazeB: [0, 0, 0], top: [0.0012, 0.0009, 0.0024], bottom: [0.00015, 0.00015, 0.0003] },
  camera: {
    target: [0, 0, 0], distance: 24, minDist: 5, maxDist: 70,
    shots: [
      { type: 'orbit', dist: [22, 25], pitch: [-0.05, 0.05], speed: [0.004, 0.01], yaw: [-0.15, 0.15], fov: [46, 50], establish: true, weight: 2 },
      { type: 'dolly', dist: [26, 28], distTo: [12, 15], pitch: [-0.08, 0.08], speed: [0.003, 0.008], yaw: [-0.3, 0.3], fov: [42, 48], dur: [16, 22], weight: 2 },
      { type: 'orbit', dist: [9, 12], pitch: [-0.15, 0.15], speed: [0.01, 0.02], yaw: [-0.5, 0.5], fov: [50, 58], lookJitter: 10, weight: 1.5 },
      { type: 'orbit', dist: [20, 24], pitch: [0.5, 0.7], speed: [0.01, 0.02], yaw: [-0.6, 0.6], fov: [44, 50], weight: 1 }
    ]
  },
  common: `
const vec3 SLAB = vec3(21.0, 12.0, 0.6);
// 2D divergence-free flow from a scalar stream function
vec2 silkFlow(vec2 p, float t) {
  float sc = 0.06 / uS0.y;
  vec3 g1, g2;
  snoise(vec3(p * sc, t * 0.03), g1);
  snoise(vec3(p * sc * 2.2 + 17.0, t * 0.045), g2);
  return (vec2(g1.y, -g1.x) + vec2(g2.y, -g2.x) * 0.3) * 3.0;
}
vec2 sheenDir(float t) { float a = t * 0.17 + 0.6 * sin(t * 0.05); return vec2(cos(a), sin(a)); }
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  vec3 p = (vec3(rnd(), rnd(), rnd()) * 2.0 - 1.0) * SLAB;
  P = vec4(p, rnd());
  H = vec4(rnd(), 0.0, 0.0, 0.0);
  V.xyz = vec3(silkFlow(p.xy, uTime) * uS0.x * 8.0, 0.0);
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  vec3 p = P.xyz;
  float spd = uS0.x * uSpeed * (1.0 + 1.2 * A_MID + 0.6 * A_BASS + 1.3 * A_DROP + 0.4 * A_BUILD);
  vec2 f = silkFlow(p.xy, uTime) * 8.0 * spd;
  float sc = 0.06 / uS0.y;
  vec3 gt;
  snoise(vec3(p.xy * sc * 5.0 + 7.0, uTime * 0.15), gt);
  f += vec2(gt.y, -gt.x) * (0.4 + 3.0 * A_TREBLE + 1.2 * A_HIGHMID) * uTurb;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(uTime * 0.13 * (1.0 + fi * 0.31) + fi * 1.7) * 12.0, cos(uTime * 0.11 * (1.0 + fi * 0.23) + fi * 2.3) * 6.5);
    float e = i == 0 ? A_BASS + A_KICK * 0.8 : i == 1 ? A_MID : i == 2 ? A_TREBLE + A_HAT * 0.5 : A_LOWMID + A_SNARE * 0.6;
    float st = e * uS0.z * 34.0 * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
    vec2 d = p.xy - c;
    float r2 = dot(d, d) + 3.0;
    f += vec2(-d.y, d.x) * st / r2 * exp(-r2 * 0.01);
  }
  float r = length(p.xy);
  vec2 n = p.xy / max(r, 1e-3);
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.y <= 0.0) continue;
    float R = w.x * 20.0;
    float x = (r - R) / 2.8;
    f += n * w.y * exp(-x * x) * exp(-w.x * 0.9) * 22.0;
  }
  vec3 v = V.xyz;
  v.xy += (f - v.xy) * (1.0 - exp(-uDt * 3.5));
  v.z = -p.z * 0.4;
  p += v * uDt;
  float life = P.w - uDt * (0.08 + 0.06 * H.x);
  if (life <= 0.0 || abs(p.x) > SLAB.x * 1.1 || abs(p.y) > SLAB.y * 1.15) {
    p = (vec3(rnd(), rnd(), rnd()) * 2.0 - 1.0) * SLAB;
    life = 1.0;
    v = vec3(silkFlow(p.xy, uTime) * 8.0 * spd, 0.0);
  }
  P = vec4(p, life);
  V.xyz = v;
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  vec2 v = V.xy;
  float sp = length(v);
  vec2 dir = v / max(sp, 1e-4);
  // anisotropic "satin" highlight: fibres aligned with the light direction catch the light
  vec2 L = sheenDir(uTime * (0.6 + 0.4 * uS0.w));
  float sheen = pow(abs(dot(dir, L)), 10.0);
  float region = 0.5 + 0.5 * snoise(vec3(P.xy * 0.045, uTime * 0.02 + 3.0));
  float t = clamp(0.2 + region * 0.75 + sheen * 0.12 + H.x * 0.03 + uR0.x, 0.0, 1.0);
  vec3 c = palette(t);
  float life = P.w;
  float fade = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.85, life);
  float band = spec(clamp(abs(P.x) / 21.0, 0.0, 1.0) * 0.75 + 0.05);
  float ribbon = smoothstep(-0.15, 0.55, snoise(vec3(P.xy * 0.05, uTime * 0.025 + 9.0)));
  float b = 0.13 * fade * (0.15 + 0.85 * ribbon) * (0.12 + 3.2 * sheen) * (0.4 + sp * 0.03) * (0.6 + 1.2 * band * band + 0.4 * A_LEVEL + 0.8 * A_DROP);
  color = c * b;
  size = 0.012;
}`,
  update(ctx) {
    const s = ctx.state;
    s.shift = (s.shift || 0) + ctx.dt * 0.01 * (1 + ctx.audio.centroid);
    ctx.uniforms.uR0 = [s.shift, 0, 0, 0];
  }
};
