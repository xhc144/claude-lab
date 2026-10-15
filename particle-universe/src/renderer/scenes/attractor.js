// 奇异吸引子 · Strange Attractor — every particle integrates a chaotic ODE (Aizawa, Thomas, Lorenz,
// Halvorsen, Dadras, Chen). Energy sets the integration speed, the bass perturbs the parameters,
// kicks scatter the swarm off the attractor and the dynamics pull it back into shape.
// Drops and new sections morph the swarm into the next attractor.

const NAMES = ['Aizawa', 'Thomas', 'Lorenz', 'Halvorsen', 'Dadras', 'Chen'];

export default {
  id: 'attractor',
  name: '奇异吸引子',
  en: 'STRANGE ATTRACTOR',
  desc: '百万粒子沿混沌方程流动，鼓点将其打散又被吸引子重新聚拢，段落切换变换方程',
  palette: 'sunset',
  variantNames: NAMES,
  params: [
    { key: 'speed', label: '演化速度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'chaos', label: '参数扰动', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'scatter', label: '节拍打散', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'variant', label: '方程', min: 0, max: 5, step: 1, def: 2, options: NAMES, noPack: true }
  ],
  post: { exposure: 1.0, bloom: 0.6, bloomRadius: 1.0, threshold: 0.0, trails: 0.6, flare: 0.3, flareTint: [1.0, 0.8, 0.6], ca: 0.5, vignette: 0.6, grain: 0.3, streak: 0.09, size: 1.0, intensity: 1.0, dof: 0.1, sat: 1.08, contrast: 1.06 },
  background: { stars: 0.8, haze: 0.2, hazeScale: 1.4, hazeA: [0.018, 0.006, 0.012], hazeB: [0.006, 0.0048, 0.018], top: [0.0009, 0.0006, 0.0018], bottom: [0.00024, 0.00018, 0.00045] },
  camera: {
    target: [0, 0, 0], distance: 24, minDist: 4, maxDist: 80,
    shots: [
      { type: 'orbit', dist: [21, 25], pitch: [0.05, 0.25], speed: [0.03, 0.05], yaw: [-0.35, 0.35], fov: [44, 50], establish: true, weight: 2 },
      { type: 'dolly', dist: [30, 34], distTo: [12, 15], pitch: [0.0, 0.5], speed: [0.03, 0.05], fov: [42, 50], dur: [14, 20], weight: 2 },
      { type: 'orbit', dist: [9, 12], pitch: [-0.4, 0.4], speed: [0.05, 0.09], fov: [55, 65], lookJitter: 5, weight: 1.5 },
      { type: 'spiral', dist: [28, 32], distTo: [15, 18], pitch: [1.0, 1.3], pitchTo: [0.0, 0.3], speed: [0.03, 0.04], fov: [44, 48], dur: [14, 22], weight: 1 }
    ]
  },
  common: `
vec3 attrDeriv(vec3 x, float type, float ch) {
  if (type < 0.5) {
    float a = 0.95, b = 0.7, c = 0.6 + ch * 0.04, d = 3.5, e = 0.25, f = 0.1;
    return vec3((x.z - b) * x.x - d * x.y, d * x.x + (x.z - b) * x.y,
      c + a * x.z - x.z * x.z * x.z / 3.0 - (x.x * x.x + x.y * x.y) * (1.0 + e * x.z) + f * x.z * x.x * x.x * x.x);
  } else if (type < 1.5) {
    float b = 0.208186 - ch * 0.018;
    return vec3(sin(x.y) - b * x.x, sin(x.z) - b * x.y, sin(x.x) - b * x.z);
  } else if (type < 2.5) {
    return vec3(10.0 * (x.y - x.x), x.x * (28.0 + ch * 5.0 - x.z) - x.y, x.x * x.y - (8.0 / 3.0) * x.z);
  } else if (type < 3.5) {
    float a = 1.89 - ch * 0.08;
    return vec3(-a * x.x - 4.0 * x.y - 4.0 * x.z - x.y * x.y, -a * x.y - 4.0 * x.z - 4.0 * x.x - x.z * x.z, -a * x.z - 4.0 * x.x - 4.0 * x.y - x.x * x.x);
  } else if (type < 4.5) {
    return vec3(x.y - 3.0 * x.x + 2.7 * x.y * x.z, 1.7 * x.y - x.x * x.z + x.z, 2.0 * x.x * x.y - (9.0 - ch * 0.5) * x.z);
  }
  return vec3(5.0 * x.x - x.y * x.z, -10.0 * x.y + x.x * x.z, (-0.38 - ch * 0.04) * x.z + x.x * x.y / 3.0);
}
// world mapping: scale, centre, time scale, spawn extent, scatter radius
vec3 attrWorld(vec3 x, float type) {
  if (type < 0.5) return vec3(x.x, x.z - 0.72, x.y) * 5.6;
  if (type < 1.5) return x * 2.3;
  if (type < 2.5) return vec3((x.x + x.y) * 0.7071, x.z - 23.6, (x.y - x.x) * 0.7071) * 0.34;
  if (type < 3.5) return (x + 2.64) * 0.95;
  if (type < 4.5) return vec3(x.x, x.z, x.y) * 0.55;
  return vec3(x.x, x.z - 8.2, x.y) * 0.62;
}
float attrTime(float type) {
  return type < 0.5 ? 0.33 : type < 1.5 ? 2.6 : type < 2.5 ? 0.15 : type < 3.5 ? 0.13 : type < 4.5 ? 0.6 : 0.36;
}
float attrSpawnH(float type) {
  return type < 0.5 ? 0.02 : type < 1.5 ? 0.1 : type < 2.5 ? 0.008 : type < 3.5 ? 0.008 : type < 4.5 ? 0.012 : 0.01;
}
vec3 attrStart(float type) {
  if (type < 0.5) return vec3(rnd() - 0.5, rnd() - 0.5, rnd() * 1.5) * vec3(2.0, 2.0, 1.0);
  if (type < 1.5) return (vec3(rnd(), rnd(), rnd()) * 2.0 - 1.0) * 4.0;
  if (type < 2.5) return vec3(rndGauss() * 8.0, rndGauss() * 8.0, 10.0 + rnd() * 30.0);
  if (type < 3.5) return vec3(-2.6) + rndGauss3() * 3.0;
  if (type < 4.5) return rndGauss3() * 4.0;
  return vec3(rndGauss() * 5.0, rndGauss() * 5.0, 8.0 + rndGauss() * 3.0);
}
float attrLimit(float type) { return type < 0.5 ? 6.0 : type < 1.5 ? 20.0 : type < 2.5 ? 120.0 : type < 3.5 ? 40.0 : type < 4.5 ? 60.0 : 60.0; }
float attrScale(float type) { return type < 0.5 ? 5.6 : type < 1.5 ? 2.3 : type < 2.5 ? 0.34 : type < 3.5 ? 0.95 : type < 4.5 ? 0.55 : 0.62; }
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float type = uS2.x;
  vec3 x = attrStart(type);
  float h = attrSpawnH(type);
  int n = 180 + int(rnd() * 140.0);
  for (int i = 0; i < 320; i++) {
    if (i >= n) break;
    vec3 k1 = attrDeriv(x, type, 0.0);
    vec3 k2 = attrDeriv(x + k1 * h * 0.5, type, 0.0);
    x += k2 * h;
    if (length(x) > attrLimit(type) || any(isnan(x))) x = attrStart(type) * 0.3;
  }
  H = vec4(x, type);
  P = vec4(attrWorld(x, type), 0.3);
  V.xyz = vec3(0.0);
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float type = uS2.x;
  vec3 x = H.xyz;
  float h = uDt * attrTime(type) * uS0.x * uSpeed * (0.45 + A_INTENSITY * 0.55 + A_BASS * 0.35 + A_DROP * 1.1 + A_BUILD * 0.4);
  float ch = uS0.y * (A_BASS * 0.6 + A_MID * 0.3 + A_DROP * 0.6);
  for (int i = 0; i < 2; i++) {
    vec3 k1 = attrDeriv(x, type, ch);
    vec3 k2 = attrDeriv(x + k1 * h * 0.25, type, ch);
    x += k2 * h * 0.5;
  }
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.y > 0.55 && w.x < 1e-4) x += rndGauss3() * (0.22 / attrScale(type)) * (w.y - 0.4) * uS0.z * (0.3 + rnd());
  }
  bool bad = any(isnan(x)) || length(x) > attrLimit(type);
  if (bad || rnd() < 0.0007) {
    ivec2 rc = ivec2(int(rnd() * float(uTexSize.x)), int(rnd() * float(uTexSize.y)));
    vec4 o = texelFetch(uHome, rc, 0);
    x = (o.w == type && !any(isnan(o.xyz)) && length(o.xyz) < attrLimit(type)) ? o.xyz + rndGauss3() * 0.002 : attrStart(type) * 0.3;
  }
  H.xyz = x;
  vec3 np = attrWorld(x, type);
  vec3 v = (np - P.xyz) / max(uDt, 1e-4);
  if (length(np - P.xyz) > 3.0) v = vec3(0.0);
  V.xyz = v;
  P.xyz = np;
  P.w = mix(P.w, clamp(length(v) * 0.09, 0.0, 1.0), 0.2);
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  float seed = V.w;
  float sp = P.w;
  vec3 q = P.xyz / 9.0;
  float t = clamp(0.38 + sp * 0.42 + 0.22 * (0.5 + 0.5 * sin(q.x * 2.1 + q.y * 1.7 - q.z * 1.3)) + (fract(seed * 5.7) - 0.5) * 0.1 + uR0.x, 0.0, 1.0);
  float band = spec(clamp(length(P.xyz) / 10.0, 0.0, 1.0) * 0.8 + 0.04);
  float spark = pow(fract(seed * 7.1), 14.0);
  float b = 0.0075 * (0.25 + 40.0 * spark) * (0.55 + 1.3 * band * band + 0.5 * A_LEVEL + 0.7 * A_DROP);
  b *= 0.5 + sp * 1.4;
  float fl = hashi2(id, int(uTime * 15.0));
  if (fl > 1.0 - A_HAT * 0.025) b *= 6.0;
  color = palette(t) * b;
  size = 0.016 * (0.7 + 0.6 * fract(seed * 3.9));
}`,
  update(ctx) {
    const s = ctx.state, p = ctx.params;
    if (s.type == null) { s.type = p.variant | 0; s.since = 0; s.userVariant = p.variant | 0; }
    s.since += ctx.dt;
    if ((p.variant | 0) !== s.userVariant) {
      s.userVariant = p.variant | 0; s.type = s.userVariant; s.since = 0;
      ctx.requestRespawn(2.6);
    } else if ((ctx.events.drop || ctx.events.section) && s.since > 24 && ctx.autoVariants) {
      s.type = (s.type + 1 + Math.floor(ctx.rng() * 3)) % NAMES.length;
      s.since = 0;
      ctx.requestRespawn(2.8);
    }
    ctx.uniforms.uS2 = [s.type, 0, 0, 0];
    ctx.uniforms.uR0 = [(ctx.audio.centroid - 0.5) * 0.1, 0, 0, 0];
    ctx.label = NAMES[s.type];
  }
};
