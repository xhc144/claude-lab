// 星云 · Stellar Nebula — gas filaments condensed on noise iso-surfaces, swirled by a curl-noise
// flow field. Bass breathes the cloud, kicks send spherical shock fronts outward, hi-hats sparkle.

export default {
  id: 'nebula',
  name: '星云',
  en: 'STELLAR NEBULA',
  desc: '丝状气体在湍流中翻涌，低频让星云呼吸，鼓点激起冲击波',
  palette: 'nebula',
  params: [
    { key: 'flow', label: '气流速度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'form', label: '丝状结构', min: 0, max: 2, step: 0.01, def: 1 },
    { key: 'breath', label: '呼吸幅度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'sparkle', label: '星光闪烁', min: 0, max: 3, step: 0.01, def: 1 }
  ],
  post: { exposure: 1.05, bloom: 1.0, bloomRadius: 1.0, threshold: 0.0, trails: 0.55, flare: 0.25, flareTint: [0.6, 0.75, 1.0], ca: 0.6, vignette: 0.55, grain: 0.35, streak: 0.007, size: 1.0, intensity: 1.0, dof: 0.35, sat: 1.08, contrast: 1.05 },
  background: { stars: 1.0, haze: 0.5, hazeScale: 1.6, hazeA: [0.006, 0.0096, 0.03], hazeB: [0.024, 0.0072, 0.03], top: [0.0009, 0.0012, 0.0036], bottom: [0.0003, 0.0003, 0.0012] },
  camera: {
    target: [0, 0, 0], distance: 26, minDist: 4, maxDist: 90,
    shots: [
      { type: 'orbit', dist: [22, 30], pitch: [0.05, 0.35], speed: [0.03, 0.06], fov: [44, 52], establish: true, weight: 2 },
      { type: 'dolly', dist: [34, 40], distTo: [13, 17], pitch: [0.1, 0.4], speed: [0.02, 0.04], fov: [40, 50], dur: [14, 22], weight: 2 },
      { type: 'orbit', dist: [9, 13], pitch: [-0.25, 0.25], speed: [0.04, 0.08], fov: [55, 65], lookJitter: 4, weight: 1.5 },
      { type: 'fly', dist: 14, pitch: [-0.2, 0.2], fov: [58, 68], offset: 2.5, dur: [14, 20], weight: 1 },
      { type: 'spiral', dist: [30, 36], distTo: [18, 22], pitch: [0.6, 0.9], pitchTo: [0.1, 0.25], speed: [0.02, 0.03], fov: [45, 50], dur: [16, 24], weight: 1 }
    ]
  },
  common: `
const float NEB_R = 11.0;
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float kind = rnd();
  vec3 p = rndBall() * NEB_R;
  p.y *= 0.62;
  float type = 0.0;
  if (kind < 0.0009) {
    type = 1.0;
    p *= 0.8;
  } else if (kind < 0.12) {
    type = 2.0; // diffuse glow
  } else {
    float form = uS0.y;
    for (int i = 0; i < 6; i++) {
      vec3 g1;
      float n1 = snoise(p * 0.16 + 3.7, g1);
      g1 *= 0.16;
      vec3 st = g1 * (n1 / (dot(g1, g1) + 2e-3)) * 0.65 * form;
      float sl = length(st);
      if (sl > 2.0) st *= 2.0 / sl;
      p -= st;
      if (kind < 0.6) {
        vec3 g2;
        float n2 = snoise(p * 0.11 - 8.1, g2);
        g2 *= 0.11;
        vec3 s2 = g2 * (n2 / (dot(g2, g2) + 2e-3)) * 0.6 * form;
        float l2 = length(s2);
        if (l2 > 2.0) s2 *= 2.0 / l2;
        p -= s2;
      }
    }
    p += rndGauss3() * (0.1 + 0.28 * rnd() * rnd());
  }
  float r = length(p);
  if (r > NEB_R * 1.25) p *= NEB_R * 1.25 / r;
  r = length(p);
  float c = 0.5 + 0.55 * snoise(p * 0.065 + 11.0) + 0.25 * snoise(p * 0.2 - 4.0);
  P.xyz = p;
  P.w = clamp(c * 0.78 + 0.12 + (1.0 - r / NEB_R) * 0.12, 0.02, 0.98);
  H = vec4(p, type);
  V.xyz = vec3(0.0);
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  vec3 p = P.xyz;
  if (H.w > 0.5 && H.w < 1.5) { P.xyz = H.xyz * (1.0 + A_BASS * 0.04); V.xyz = vec3(0.0); return; }
  float t = uTime;
  float flow = uS0.x * uSpeed;
  float breathe = (A_BASS * 0.09 + A_SUB * 0.06 + A_KICK * 0.035) * uS0.z + A_DROP * 0.14 - A_BUILD * 0.12;
  vec3 home = H.xyz * (1.0 + breathe);
  vec3 f = curlNoise(p * 0.085 + vec3(0.0, t * 0.017, t * 0.011)) * (2.4 + 4.0 * A_MID + 3.0 * A_DROP) * flow;
  f += curlNoise(p * 0.3 + vec3(t * 0.06)) * (0.5 + 3.0 * A_TREBLE + 1.5 * A_HIGHMID) * uTurb;
  vec3 acc = (home - p) * (0.55 + 0.4 * A_BUILD);
  float r = length(p);
  vec3 n = p / max(r, 1e-3);
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.y <= 0.0) continue;
    float R = w.x * 10.0;
    float x = (r - R) / 1.7;
    acc += n * w.y * exp(-x * x) * exp(-w.x * 0.8) * 9.0;
  }
  vec3 vel = V.xyz;
  vel += (f - vel) * (1.0 - exp(-uDt * 1.6));
  vel += acc * uDt;
  vel *= exp(-uDt * 1.2);
  P.xyz = p + vel * uDt;
  V.xyz = vel;
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  float seed = V.w;
  float type = H.w;
  float r = length(H.xyz) / NEB_R;
  if (type > 0.5 && type < 1.5) {
    float tw = 0.7 + 0.3 * sin(uTime * (1.5 + seed * 4.0) + seed * 60.0);
    color = mix(vec3(1.0, 0.86, 0.72), vec3(0.7, 0.82, 1.0), fract(seed * 13.0)) * (0.35 + 0.9 * A_KICK + 0.3 * A_HAT) * tw;
    size = 0.06 + 0.04 * fract(seed * 7.0);
    return;
  }
  float band = spec(r * 0.82 + 0.04);
  float c = P.w + (A_CENTROID - 0.45) * 0.16 + uR0.x;
  vec3 base = palette(c);
  float b = 0.02 * (0.45 + 1.1 * pow(fract(seed * 7.13), 3.0));
  b *= 0.55 + 1.7 * band * band + 0.45 * A_LEVEL + 0.8 * A_DROP;
  b *= 1.0 + length(V.xyz) * 0.05;
  float sh = hashi2(id, int(uTime * 14.0));
  if (sh > 1.0 - (0.0004 + A_HAT * 0.005 + A_SNARE * 0.003) * uS0.w) b *= 6.0;
  size = 0.034 * (0.6 + fract(seed * 3.7));
  if (type > 1.5) { b *= 0.45; size *= 2.6; base = palette(c * 0.7 + 0.1); }
  color = base * b;
}`,
  update(ctx) {
    const s = ctx.state;
    s.drift = (s.drift || 0) + ctx.dt * 0.004 * (1 + ctx.audio.intensity);
    ctx.uniforms.uR0 = [Math.sin(s.drift) * 0.06, 0, 0, 0];
  }
};
