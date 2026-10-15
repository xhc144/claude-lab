// 银河 · Spiral Galaxy — density-wave spiral built from nested, progressively rotated elliptical
// orbits. Each star's radius is tied to a spectrum band so the disc lights up from core (bass)
// to rim (treble); kicks flash the core and send vertical ripples across the disc.

export default {
  id: 'galaxy',
  name: '银河',
  en: 'SPIRAL GALAXY',
  desc: '密度波旋臂缓缓旋转，频谱由核心向外点亮星盘，鼓点激起星盘涟漪',
  palette: 'galaxy',
  params: [
    { key: 'spin', label: '旋转速度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'twist', label: '旋臂缠绕', min: 0.2, max: 2, step: 0.01, def: 1 },
    { key: 'core', label: '核心亮度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'ripple', label: '星盘涟漪', min: 0, max: 3, step: 0.01, def: 1 }
  ],
  post: { exposure: 1.0, bloom: 1.0, bloomRadius: 1.1, threshold: 0.0, trails: 0.35, flare: 0.15, flareTint: [0.7, 0.8, 1.0], ca: 0.45, vignette: 0.55, grain: 0.3, streak: 0.01, size: 1.0, intensity: 1.0, dof: 0.45, sat: 1.05, contrast: 1.06 },
  background: { stars: 1.1, haze: 0.22, hazeScale: 1.2, hazeA: [0.0072, 0.0072, 0.018], hazeB: [0.018, 0.012, 0.012], top: [0.0006, 0.00075, 0.0018], bottom: [0.00024, 0.00024, 0.0006] },
  camera: {
    target: [0, 0, 0], distance: 32, minDist: 6, maxDist: 140,
    shots: [
      { type: 'orbit', dist: [30, 36], pitch: [0.5, 0.8], speed: [0.02, 0.04], fov: [44, 50], establish: true, weight: 2 },
      { type: 'dolly', dist: [55, 62], distTo: [24, 30], pitch: [0.9, 1.25], pitchTo: [0.35, 0.5], speed: [0.01, 0.02], fov: [40, 46], dur: [18, 26], weight: 2 },
      { type: 'orbit', dist: [26, 32], pitch: [0.08, 0.18], speed: [0.03, 0.05], fov: [46, 54], weight: 1.5 },
      { type: 'orbit', dist: [12, 16], pitch: [0.25, 0.4], speed: [0.04, 0.06], fov: [55, 64], lookJitter: 6, weight: 1 },
      { type: 'fly', dist: 22, pitch: [0.0, 0.08], fov: [60, 70], offset: 4, height: 1.6, dur: [16, 24], weight: 1 },
      { type: 'orbit', dist: [60, 70], pitch: [1.2, 1.4], speed: [0.02, 0.03], fov: [38, 42], weight: 0.8 }
    ]
  },
  common: `
const float G_R = 21.0;
float g_ecc(float a) { return 0.32 * smoothstep(0.4, 4.0, a) * (1.0 - 0.4 * smoothstep(12.0, 22.0, a)); }
float g_phi(vec4 H, float phase) { return H.y + phase * (1.0 / (H.x + 0.9)) * 3.2; }
float g_arm(vec4 H, float phase) { return pow(abs(cos(g_phi(H, phase))), 4.0); }
// dust lane just upstream of each arm crest
float g_dust(vec4 H, float phase) { float c = cos(g_phi(H, phase) + 0.42); return pow(abs(c), 18.0); }
// co-rotating star-forming clumps: fixed per star, sheared by differential rotation into feathers
float g_clump(vec4 H) { vec2 q = vec2(cos(H.y), sin(H.y)) * H.x; return smoothstep(-0.25, 0.75, snoise(vec3(q * 0.42, H.x * 0.05))) ; }
vec3 galaxyPos(vec4 H, float phase, float pattern, float twist) {
  float a = H.x;
  float type = H.w;
  if (type > 0.5 && type < 1.5) {
    // bulge: slow solid rotation
    float ang = phase * 0.25;
    float c = cos(ang), s = sin(ang);
    vec3 q = vec3(H.y, H.z, H.x);
    return vec3(c * q.x - s * q.z, q.y, s * q.x + c * q.z);
  }
  if (type > 2.5) {
    float ang = phase * 0.05;
    float c = cos(ang), s = sin(ang);
    vec3 q = vec3(H.y, H.z, H.x) ;
    return vec3(c * q.x - s * q.z, q.y, s * q.x + c * q.z);
  }
  float b = a * (1.0 - g_ecc(a));
  float om = 1.0 / (a + 0.9);
  float phi = H.y + phase * om * 3.2;
  vec2 e = vec2(cos(phi) * a, sin(phi) * b);
  float psi = a * 0.17 * twist + pattern;
  float c = cos(psi), s = sin(psi);
  return vec3(c * e.x - s * e.y, H.z, s * e.x + c * e.y);
}
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float k = rnd();
  if (k < 0.12) {
    // bulge (cartesian offsets stored in H.yzx)
    vec3 q = rndGauss3() * vec3(1.7, 0.95, 1.7) * (0.6 + 0.6 * rnd());
    H = vec4(q.z, q.x, q.y, 1.0);
  } else if (k < 0.17) {
    vec3 q = rndDir() * mix(4.0, 30.0, pow(rnd(), 0.8));
    q.y *= 0.55;
    H = vec4(q.z, q.x, q.y, 3.0);
  } else if (k < 0.27) {
    // HII / young star clusters near the arm crests
    float a = mix(3.5, 18.5, rnd());
    float cl = floor(rnd() * 220.0);
    float phi0 = (fract(cl * 0.618) < 0.5 ? 0.0 : PI) + (fract(cl * 0.371) - 0.5) * 0.9;
    a = mix(3.0, 18.5, fract(cl * 0.7548)) + rndGauss() * 0.22;
    H = vec4(max(a, 1.0), phi0 + rndGauss() * 0.035, rndGauss() * 0.06, 2.0);
  } else {
    float hs = 6.2;
    float a = -log(1.0 - rnd() * (1.0 - exp(-G_R / hs))) * hs + 0.3;
    float th = rndGauss() * (0.06 + 0.012 * a) ;
    H = vec4(a, rnd() * TAU, th, 0.0);
  }
  P.xyz = galaxyPos(H, uS2.x, uS2.y, uS0.y);
  P.w = 0.0;
  V.xyz = vec3(0.0);
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  vec3 np = galaxyPos(H, uS2.x, uS2.y, uS0.y);
  float a = length(np.xz);
  float ripple = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.y <= 0.0) continue;
    float R = w.x * 11.0;
    float x = (a - R) / 2.2;
    ripple += w.y * exp(-x * x) * exp(-w.x * 0.55) * cos((a - R) * 1.6);
  }
  float warp = sin(atan(np.z, np.x) + uTime * 0.2) * a * 0.025 * (A_BASS + A_DROP) * uS0.w;
  np.y += (ripple * 0.9 + warp) * uS0.w;
  np *= 1.0 + A_KICK * 0.012 + A_DROP * 0.03 - A_BUILD * 0.04;
  P.w = H.w < 0.5 || (H.w > 1.5 && H.w < 2.5) ? g_arm(H, uS2.x) : 0.0;
  vec3 v = (np - P.xyz) / max(uDt, 1e-4);
  if (length(np - P.xyz) > 3.0) v = vec3(0.0);
  V.xyz = v;
  P.xyz = np;
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  float type = H.w;
  float seed = V.w;
  float a = length(P.xz);
  float band = spec(clamp(a / G_R, 0.0, 1.0) * 0.8 + 0.03);
  float tw = 0.85 + 0.15 * sin(uTime * (2.0 + seed * 3.0) + seed * 30.0);
  if (type > 0.5 && type < 1.5) {
    float rr = length(P.xyz);
    float b = 0.0075 * exp(-rr * 0.38) * (0.6 + 1.4 * pow(seed, 4.0)) * uS0.z;
    b *= 0.7 + 0.8 * A_LEVEL + 2.2 * A_KICK + 1.5 * A_DROP + 0.6 * spec(0.05);
    color = palette(0.82 + 0.16 * seed) * b * tw;
    size = 0.05 + 0.04 * seed;
  } else if (type > 2.5) {
    color = palette(0.55 + 0.35 * seed) * 0.008 * (0.3 + pow(seed, 6.0) * 6.0) * tw;
    size = 0.04;
  } else if (type > 1.5) {
    float b = 0.03 * (0.4 + 0.9 * fract(seed * 7.0)) * (0.35 + 1.5 * band * band + 0.6 * A_HAT + 0.4 * A_SNARE);
    color = mix(palette(0.62), vec3(1.0, 0.5, 0.65), 0.22) * b;
    size = 0.032 + 0.03 * fract(seed * 3.0);
  } else {
    float arm = P.w;
    float clump = g_clump(H);
    float dust = g_dust(H, uS2.x) * smoothstep(1.5, 4.0, a);
    float pc = clamp(0.92 - a / G_R * 0.42 - arm * 0.2 * (0.5 + clump) + (fract(seed * 11.0) - 0.5) * 0.14, 0.0, 1.0);
    float b = 0.05 * (0.3 + 1.4 * pow(fract(seed * 5.3), 3.0)) * (0.5 + 1.4 * band * band + 0.4 * A_LEVEL);
    b *= (0.55 + 1.1 * arm) * (0.45 + 1.2 * clump);
    b *= 1.0 - 0.75 * dust;
    b *= 1.0 + 0.5 * exp(-a * 0.35) * (uS0.z * 0.5 + A_KICK);
    color = palette(pc) * b * tw;
    size = 0.03 * (0.7 + 0.6 * fract(seed * 9.1));
  }
}`,
  update(ctx) {
    const s = ctx.state, a = ctx.audio, p = ctx.params;
    s.phase = (s.phase || 0) + ctx.dt * 0.32 * p.spin * ctx.speed * (1 + a.intensity * 0.7 + a.drop * 1.6 + a.build * 0.5);
    s.pattern = (s.pattern || 0) + ctx.dt * 0.012 * p.spin * ctx.speed;
    ctx.uniforms.uS2 = [s.phase, s.pattern, 0, 0];
  }
};
