// 能量风暴 · Plasma Vortex — a toroidal plasma ring: particles race around the torus while
// circulating through its tube, torn by high-frequency turbulence. A central beam fires on the
// bass, snares crack lightning through random sectors, kicks blast shock rings outward.

export default {
  id: 'storm',
  name: '能量风暴',
  en: 'PLASMA STORM',
  desc: '等离子环面高速旋转，高频撕裂湍流，鼓点引爆冲击环与闪电',
  palette: 'plasma',
  params: [
    { key: 'vortex', label: '涡旋速度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'chaos', label: '湍流撕裂', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'tube', label: '环管粗细', min: 0.3, max: 2.5, step: 0.01, def: 1 },
    { key: 'lightning', label: '闪电强度', min: 0, max: 3, step: 0.01, def: 1 }
  ],
  post: { exposure: 1.0, bloom: 1.2, bloomRadius: 1.0, threshold: 0.0, trails: 0.5, flare: 0.8, flareTint: [0.55, 0.7, 1.0], ca: 0.8, vignette: 0.6, grain: 0.3, streak: 0.035, size: 1.0, intensity: 1.0, dof: 0.12, sat: 1.1, contrast: 1.08 },
  background: { stars: 0.7, haze: 0.3, hazeScale: 1.8, hazeA: [0.0036, 0.006, 0.024], hazeB: [0.018, 0.0048, 0.024], top: [0.0006, 0.0006, 0.0024], bottom: [0.00015, 0.00015, 0.0006] },
  camera: {
    target: [0, 0, 0], distance: 26, minDist: 4, maxDist: 90,
    shots: [
      { type: 'orbit', dist: [22, 28], pitch: [0.3, 0.55], speed: [0.04, 0.07], fov: [46, 54], establish: true, weight: 2 },
      { type: 'orbit', dist: [13, 17], pitch: [0.05, 0.2], speed: [0.06, 0.1], fov: [55, 65], roll: [0.05, 0.2], weight: 2 },
      { type: 'dolly', dist: [34, 40], distTo: [14, 18], pitch: [0.8, 1.2], pitchTo: [0.2, 0.4], speed: [0.03, 0.05], fov: [44, 50], dur: [12, 18], weight: 1.5 },
      { type: 'orbit', dist: [6, 8], pitch: [-0.1, 0.1], speed: [0.05, 0.08], fov: [70, 80], target: [7, 0, 0], weight: 1 },
      { type: 'spiral', dist: [30, 34], distTo: [16, 20], pitch: [1.2, 1.4], pitchTo: [0.3, 0.5], speed: [0.03, 0.04], fov: [45, 50], dur: [14, 20], weight: 1 }
    ]
  },
  common: `
const float T_R = 7.0;
const float T_r = 2.0;
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float k = rnd();
  vec3 p;
  float type = 0.0;
  if (k < 0.08) {
    type = 1.0;
    p = vec3(rndGauss() * 0.25, (rnd() * 2.0 - 1.0) * 12.0, rndGauss() * 0.25);
  } else if (k < 0.13) {
    type = 2.0;
    p = rndDir() * mix(10.0, 18.0, rnd());
    p.y *= 0.5;
  } else {
    float u = rnd() * TAU, v = rnd() * TAU;
    float rad = T_r * uS0.z * sqrt(rnd());
    p = vec3((T_R + rad * cos(v)) * cos(u), rad * sin(v), (T_R + rad * cos(v)) * sin(u));
  }
  P = vec4(p, 0.0);
  H = vec4(rnd(), rnd() < 0.5 ? -1.0 : 1.0, 0.0, type);
  V.xyz = vec3(0.0);
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float type = H.w;
  vec3 p = P.xyz, v = V.xyz;
  float spd = uS0.x * uSpeed * (1.0 + A_INTENSITY * 0.7 + A_DROP * 1.6 + A_BUILD * 0.8);
  if (type < 0.5) {
    vec2 xz = p.xz;
    float rr = max(length(xz), 1e-3);
    vec2 er = xz / rr;
    vec3 ring = vec3(er.x * T_R, 0.0, er.y * T_R);
    vec3 d = p - ring;
    float dl = max(length(d), 1e-3);
    vec3 dn = d / dl;
    vec3 eTor = vec3(-er.y, 0.0, er.x);
    vec3 ePol = normalize(cross(eTor, dn));
    float minor = T_r * uS0.z * (1.0 + A_BASS * 0.32 + A_DROP * 0.45 - A_BUILD * 0.35);
    vec3 target = eTor * (4.5 + 7.0 * A_MID + 4.0 * A_DROP) * spd + ePol * (2.6 + 5.5 * A_BASS) * spd;
    target += dn * (minor - dl) * 2.6;
    target += curlNoise(p * 0.21 + vec3(0.0, uTime * 0.35, 0.0)) * (2.5 + 13.0 * A_TREBLE + 7.0 * A_HIGHMID) * uS0.y * uTurb;
    v += (target - v) * (1.0 - exp(-uDt * 3.2));
    if (rnd() < 0.0012) {
      float u = rnd() * TAU, w = rnd() * TAU;
      float rad = minor * sqrt(rnd());
      p = vec3((T_R + rad * cos(w)) * cos(u), rad * sin(w), (T_R + rad * cos(w)) * sin(u));
      v = vec3(0.0);
    }
  } else if (type < 1.5) {
    float dir = H.y;
    v.xz += (-p.xz * 3.0 - v.xz) * (1.0 - exp(-uDt * 5.0));
    v.xz += curlNoise(p * 0.5 + uTime).xz * 2.0 * uTurb;
    float vy = dir * (3.0 + 26.0 * A_BASS + 38.0 * A_KICK + 30.0 * A_DROP) * spd;
    v.y += (vy - v.y) * (1.0 - exp(-uDt * 4.0));
    if (abs(p.y) > 15.0) { p = vec3(rndGauss() * 0.2, dir * -0.3, rndGauss() * 0.2); v = vec3(0.0); }
  } else {
    vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), p) + 1e-4);
    vec3 target = t * (2.0 + 4.0 * A_MID) * spd + curlNoise(p * 0.12 + uTime * 0.1) * 4.0 * uTurb;
    target += (normalize(p) * 14.0 - p) * 0.25;
    v += (target - v) * (1.0 - exp(-uDt * 2.0));
  }
  float r = length(p);
  vec3 n = p / max(r, 1e-3);
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.y <= 0.0) continue;
    float R = w.x * 15.0;
    float x = (r - R) / 2.2;
    v += n * w.y * exp(-x * x) * exp(-w.x * 0.9) * 70.0 * uDt;
  }
  p += v * uDt;
  P.xyz = p;
  P.w = length(v);
  V.xyz = v;
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  float type = H.w;
  float seed = V.w;
  float sp = P.w;
  float spark = pow(fract(seed * 13.7), 12.0);
  float t = clamp(0.15 + sp * 0.04 + spark * 0.3, 0.0, 1.0);
  float b = 0.006 * (0.2 + 40.0 * spark) * (0.15 + sp * sp * 0.006);
  float ang = atan(P.z, P.x);
  float sector = floor((ang / TAU + 0.5) * 7.0);
  float bolt = (abs(sector - uR0.x) < 0.5 ? 1.0 : 0.0) * uR0.y * uS0.w;
  float fl = hashi2(id, int(uTime * 30.0));
  b *= 1.0 + bolt * (2.0 + 10.0 * step(0.7, fl));
  if (fl > 1.0 - A_HAT * 0.03) b *= 6.0;
  b *= 0.6 + 0.4 * A_LEVEL + 0.8 * A_DROP;
  if (type > 0.5 && type < 1.5) {
    b = 0.03 * (0.15 + 1.5 * A_BASS + 2.5 * A_KICK + 2.0 * A_DROP) * (1.0 - abs(P.y) / 15.0);
    t = 0.85;
  } else if (type > 1.5) {
    b *= 0.5;
    t *= 0.7;
  }
  color = palette(t + bolt * 0.15) * b;
  size = 0.02 * (0.7 + 0.6 * fract(seed * 4.3));
}`,
  update(ctx) {
    const s = ctx.state, a = ctx.audio;
    s.bolt = (s.bolt || 0) * Math.exp(-ctx.dt / 0.12);
    for (const e of ctx.events.snares) {
      if (e.strength > 0.3) { s.bolt = Math.max(s.bolt, e.strength); s.sector = Math.floor(ctx.rng() * 7); }
    }
    if (ctx.events.drop) { s.bolt = 1.5; s.sector = Math.floor(ctx.rng() * 7); }
    ctx.uniforms.uR0 = [s.sector || 0, s.bolt + a.snare * 0.3, 0, 0];
  }
};
