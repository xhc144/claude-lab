// 共振星球 · Cymatic Planet — a sphere of particles vibrating in standing-wave modes chosen from
// the music's harmony (chroma), with spectrum "fur" from equator (bass) to poles (treble) and a
// ringlet system that ripples outward on every kick.

export default {
  id: 'resonance',
  name: '共振星球',
  en: 'CYMATIC PLANET',
  desc: '球面随和声在驻波模式间变换，频谱从赤道到两极生长成光之绒毛，星环随鼓点荡漾',
  palette: 'aurora',
  params: [
    { key: 'amp', label: '形变幅度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'mode', label: '驻波纹理', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'rings', label: '星环亮度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'spin', label: '自转速度', min: 0, max: 3, step: 0.01, def: 1 }
  ],
  post: { exposure: 1.0, bloom: 1.05, bloomRadius: 1.0, threshold: 0.0, trails: 0.4, flare: 0.45, flareTint: [0.6, 0.9, 1.0], ca: 0.55, vignette: 0.6, grain: 0.3, streak: 0.012, size: 1.0, intensity: 1.0, dof: 0.5, sat: 1.08, contrast: 1.06 },
  background: { stars: 1.0, haze: 0.25, hazeScale: 1.5, hazeA: [0.0024, 0.012, 0.015], hazeB: [0.012, 0.0048, 0.021], top: [0.0006, 0.0009, 0.0021], bottom: [0.00018, 0.00024, 0.0006] },
  camera: {
    target: [0, 0, 0], distance: 24, minDist: 7, maxDist: 80,
    shots: [
      { type: 'orbit', dist: [21, 25], pitch: [0.15, 0.35], speed: [0.04, 0.07], fov: [44, 50], establish: true, weight: 2 },
      { type: 'dolly', dist: [30, 34], distTo: [12, 14], pitch: [0.2, 0.4], speed: [0.02, 0.04], fov: [42, 48], dur: [14, 20], weight: 2 },
      { type: 'orbit', dist: [10, 12.5], pitch: [-0.3, 0.3], speed: [0.05, 0.08], fov: [55, 62], weight: 1.5, lookJitter: 3 },
      { type: 'crane', dist: [20, 24], pitch: [1.1, 1.35], pitchTo: [0.05, 0.15], speed: [0.03, 0.05], fov: [44, 50], dur: [14, 20], weight: 1 },
      { type: 'orbit', dist: [16, 18], pitch: [0.02, 0.06], speed: [0.03, 0.05], fov: [48, 54], roll: [0.1, 0.25], weight: 1 }
    ]
  },
  common: `
const float S_R = 5.0;
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); }
float cymatic(vec3 dir) {
  vec3 d = rotY(dir, uS2.x);
  float th = acos(clamp(d.y, -1.0, 1.0));
  float ph = atan(d.z, d.x);
  float pA = cos(uS3.x * th) * cos(uS3.y * ph + uTime * 0.35);
  float pB = cos(uS3.z * th) * cos(uS3.w * ph - uTime * 0.28);
  return mix(pA, pB, uS2.y);
}
vec3 ringTilt(vec3 p) {
  float c = cos(0.42), s = sin(0.42);
  p = vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  float c2 = cos(0.18), s2 = sin(0.18);
  return vec3(c2 * p.x - s2 * p.y, s2 * p.x + c2 * p.y, p.z);
}
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float k = hashi(id + 911);
  if (k < 0.16) {
    float ring = floor(rnd() * 6.0);
    float r = 6.6 + ring * 1.05 + rndGauss() * 0.13 + rnd() * 0.25;
    H = vec4(r, rnd() * TAU, rndGauss() * 0.035, 1.0);
    vec3 q = ringTilt(vec3(cos(H.y) * r, H.z, sin(H.y) * r));
    P = vec4(q, 0.0);
  } else if (k < 0.18) {
    H = vec4(rndBall(), 2.0);
    P = vec4(H.xyz * 2.0, 0.0);
  } else {
    float n = uCount;
    float i = float(id);
    float y = 1.0 - 2.0 * (i + 0.5) / n;
    float rr = sqrt(max(0.0, 1.0 - y * y));
    float ph = i * 2.39996323;
    vec3 d = normalize(vec3(cos(ph) * rr, y, sin(ph) * rr) + rndGauss3() * 0.02);
    H = vec4(d, 0.0);
    P = vec4(d * S_R, 0.0);
  }
  V.xyz = vec3(0.0);
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float type = H.w;
  vec3 p = P.xyz, v = V.xyz;
  if (type < 0.5) {
    vec3 d = rotY(H.xyz, uS2.x);
    float pat = cymatic(H.xyz);
    float lat = abs(d.y);
    float sp = (spec(0.06 + lat * 0.6) + spec(0.1 + lat * 0.6) + spec(0.16 + lat * 0.6)) / 3.0;
    float fur = 0.75 + 0.25 * snoise(d * 1.2 + vec3(0.0, uTime * 0.2, 0.0));
    float disp = uS0.x * (pat * (0.035 + 0.13 * A_BASS + 0.07 * A_LOWMID + 0.08 * A_DROP) * uS0.y
      + sp * sp * fur * 0.18 + A_KICK * 0.03 + A_DROP * 0.08 - A_BUILD * 0.08);
    vec3 target = d * S_R * (1.0 + disp);
    vec3 acc = (target - p) * 36.0 - v * 6.0;
    for (int i = 0; i < 4; i++) {
      vec4 w = uWave[i];
      if (w.y <= 0.0) continue;
      acc += d * w.y * exp(-w.x * 7.0) * 150.0 * (0.5 + pat * 0.5 + sp);
    }
    v += acc * uDt;
    p += v * uDt;
    P.w = disp;
  } else if (type < 1.5) {
    float r = H.x;
    float a = H.y + uDt * (0.22 + 0.55 * A_MID) * uS0.w * uSpeed * pow(7.0 / r, 1.5);
    H.y = mod(a, TAU);
    float rip = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 w = uWave[i];
      if (w.y <= 0.0) continue;
      float R = 6.0 + w.x * 9.0;
      float x = (r - R) / 0.9;
      rip += w.y * exp(-x * x) * exp(-w.x * 0.7);
    }
    float rr = r * (1.0 + rip * 0.05);
    vec3 q = ringTilt(vec3(cos(a) * rr, H.z + rip * 0.35 * sin(a * 3.0 + uTime), sin(a) * rr));
    v = (q - p) / max(uDt, 1e-4);
    if (length(q - p) > 3.0) v = vec3(0.0);
    p = q;
    P.w = rip;
  } else {
    vec3 q = H.xyz * (1.1 + A_KICK * 0.4 + A_DROP * 0.4) + curlNoise(H.xyz * 2.0 + uTime * 0.4) * 0.3;
    v = (q - p) / max(uDt, 1e-4);
    p = q;
    P.w = 0.0;
  }
  P.xyz = p;
  V.xyz = v;
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  float type = H.w;
  float seed = V.w;
  if (type < 0.5) {
    vec3 n = normalize(P.xyz);
    vec3 toCam = normalize(uCamPos - P.xyz);
    float facing = dot(n, toCam);
    float rim = 1.0 - abs(facing);
    float disp = P.w;
    float nodal = exp(-pow(cymatic(H.xyz), 2.0) * 22.0);
    float b = 0.0085 * (0.12 + 1.6 * max(disp, 0.0) + 0.2 * A_LEVEL + 3.2 * nodal * uS0.y * (0.6 + A_BASS)) * (0.4 + 1.8 * rim * rim);
    b *= facing < 0.0 ? 0.55 : 1.0;
    b *= 0.6 + 0.8 * pow(fract(seed * 7.7), 2.0);
    float sh = hashi2(id, int(uTime * 16.0));
    if (sh > 1.0 - A_HAT * 0.02) b *= 6.0;
    color = palette(clamp(0.22 + disp * 1.4 + nodal * 0.45 + abs(n.y) * 0.2 + uR0.x, 0.0, 1.0)) * b;
    size = 0.03 * (0.7 + 0.6 * fract(seed * 3.3));
  } else if (type < 1.5) {
    float band = spec(clamp((H.x - 6.6) / 6.0, 0.0, 1.0) * 0.7 + 0.15);
    float b = 0.0075 * (0.4 + 1.4 * band + 2.0 * P.w) * uS0.z * (0.5 + fract(seed * 5.0));
    color = palette(0.45 + (H.x - 6.6) * 0.06) * b;
    size = 0.03;
  } else {
    color = palette(0.95) * (0.0008 + 0.006 * A_KICK + 0.01 * A_DROP);
    size = 0.03;
  }
}`,
  update(ctx) {
    const s = ctx.state, a = ctx.audio;
    s.spin = (s.spin || 0) + ctx.dt * 0.12 * ctx.params.spin * ctx.speed * (1 + a.intensity * 0.8 + a.drop * 2);
    const modes = [[3, 2], [5, 3], [4, 4], [6, 2], [7, 5], [5, 6], [8, 3], [6, 4], [9, 5], [4, 3], [7, 2], [8, 6]];
    // dominant pitch class (with hysteresis) selects the standing-wave mode
    let best = 0, bv = -1;
    for (let i = 0; i < 12; i++) if (a.chroma[i] > bv) { bv = a.chroma[i]; best = i; }
    if (s.modeA == null) { s.modeA = modes[0]; s.modeB = modes[0]; s.mix = 1; s.pc = 0; s.hold = 0; }
    s.hold += ctx.dt;
    if (best !== s.pc && bv > 0.6 && s.hold > 1.2 && s.mix >= 1) {
      s.pc = best; s.modeA = s.modeB; s.modeB = modes[best]; s.mix = 0; s.hold = 0;
    }
    s.mix = Math.min(1, s.mix + ctx.dt / 1.4);
    const m = s.mix * s.mix * (3 - 2 * s.mix);
    ctx.uniforms.uS2 = [s.spin, m, 0, 0];
    ctx.uniforms.uS3 = [s.modeA[0], s.modeA[1], s.modeB[0], s.modeB[1]];
    ctx.uniforms.uR0 = [(a.centroid - 0.5) * 0.12, 0, 0, 0];
  }
};
