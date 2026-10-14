// 黑洞 · Event Horizon — a Keplerian accretion disk spiralling into a Schwarzschild black hole.
// Relativistic Doppler beaming brightens the approaching side, bipolar jets fire with the bass,
// and a screen-space lens bends the far side of the disk and the starfield around the shadow.

export default {
  id: 'blackhole',
  name: '黑洞',
  en: 'EVENT HORIZON',
  desc: '吸积盘以开普勒速度旋入视界，引力透镜扭曲星光，低频点燃相对论喷流',
  palette: 'inferno',
  lens: true,
  params: [
    { key: 'spin', label: '吸积转速', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'thick', label: '吸积盘厚度', min: 0.2, max: 3, step: 0.01, def: 1 },
    { key: 'jets', label: '喷流强度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'doppler', label: '多普勒增亮', min: 0, max: 2, step: 0.01, def: 1 }
  ],
  post: { exposure: 1.0, bloom: 1.15, bloomRadius: 1.0, threshold: 0.0, trails: 0.45, flare: 0.9, flareTint: [1.0, 0.72, 0.45], ca: 0.5, vignette: 0.6, grain: 0.35, streak: 0.012, size: 1.0, intensity: 1.0, dof: 0.35, sat: 1.05, contrast: 1.08 },
  background: { stars: 1.25, haze: 0.18, hazeScale: 1.3, hazeA: [0.012, 0.006, 0.0036], hazeB: [0.0036, 0.006, 0.015], top: [0.0003, 0.00036, 0.0009], bottom: [0.00015, 0.00015, 0.0003] },
  lensConfig: { shadow: 2.6, einstein: 1.24, ring: [1.0, 0.62, 0.32], ringIntensity: 0.03 },
  camera: {
    target: [0, 0, 0], distance: 26, minDist: 7, maxDist: 90,
    shots: [
      { type: 'orbit', dist: [24, 30], pitch: [0.1, 0.2], speed: [0.02, 0.04], fov: [40, 46], establish: true, weight: 2 },
      { type: 'dolly', dist: [34, 40], distTo: [15, 19], pitch: [0.06, 0.16], speed: [0.015, 0.03], fov: [38, 44], dur: [16, 24], weight: 2 },
      { type: 'orbit', dist: [16, 20], pitch: [0.03, 0.09], speed: [0.03, 0.05], fov: [42, 50], weight: 1.5, roll: [0.05, 0.15] },
      { type: 'crane', dist: [22, 28], pitch: [0.9, 1.2], pitchTo: [0.08, 0.15], speed: [0.02, 0.03], fov: [40, 46], dur: [16, 22], weight: 1 },
      { type: 'orbit', dist: [40, 50], pitch: [0.35, 0.55], speed: [0.02, 0.03], fov: [32, 38], weight: 0.8 }
    ]
  },
  common: `
const float R_ISCO = 3.0;
const float R_OUT = 15.0;
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float k = rnd();
  float spin = max(uS0.x, 0.05);
  if (k < 0.075) {
    float s = rnd();
    float side = rnd() < 0.5 ? -1.0 : 1.0;
    H = vec4(s, rnd() * TAU, side, 1.0);
    float y = side * (1.2 + s * 26.0);
    float rad = 0.12 + s * s * 2.2;
    P.xyz = vec3(cos(H.y) * rad, y, sin(H.y) * rad);
    P.w = s;
    V.xyz = vec3(0.0, side * 6.0, 0.0);
  } else if (k < 0.14) {
    float r = mix(14.0, 30.0, sqrt(rnd()));
    float th = rnd() * TAU;
    H = vec4(r, th, rndGauss() * 1.4, 2.0);
    P.xyz = vec3(cos(th) * r, H.z, sin(th) * r);
    P.w = r;
  } else {
    float r = mix(2.4, R_OUT, pow(rnd(), 1.5));
    float th = rnd() * TAU;
    float y = rndGauss() * (0.025 + 0.022 * r) * uS0.y;
    H = vec4(r, th, y, 0.0);
    P.xyz = vec3(cos(th) * r, y, sin(th) * r);
    P.w = r;
    float om = 6.2 * pow(r, -1.5) * spin;
    V.xyz = vec3(-sin(th), 0.0, cos(th)) * om * r;
  }
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float type = H.w;
  float spin = uS0.x * uSpeed * (1.0 + A_INTENSITY * 0.5 + A_DROP * 1.4 + A_BUILD * 0.6);
  vec3 np;
  bool reset = false;
  if (type < 0.5) {
    float r = H.x, th = H.y;
    float om = 6.2 * pow(max(r, 1.0), -1.5) * spin;
    th += om * uDt;
    float inflow = (0.02 + 0.16 * A_BASS + 0.45 * A_DROP + 0.2 * A_BUILD) * max(spin, 0.05);
    if (r < R_ISCO) inflow += (R_ISCO + 0.05 - r) * 2.5 + 0.25;
    r -= inflow * uDt * (3.0 / max(r, 1.0));
    if (r < 1.02) {
      r = mix(8.0, R_OUT, rnd());
      th = rnd() * TAU;
      H.z = rndGauss() * (0.025 + 0.022 * r) * uS0.y;
      reset = true;
    }
    H.x = r; H.y = mod(th, TAU);
    float y = H.z * (r < R_ISCO ? r / R_ISCO : 1.0);
    vec3 base = vec3(cos(th) * r, y, sin(th) * r);
    vec3 turb = curlNoise(base * 0.33 + vec3(0.0, uTime * 0.18, 0.0)) * (0.22 + 0.9 * A_MID + 0.5 * A_TREBLE) * uTurb;
    turb.y *= 0.35;
    float ripple = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 w = uWave[i];
      if (w.y <= 0.0) continue;
      float R = 2.6 + w.x * 8.0;
      float x = (r - R) / 1.3;
      ripple += w.y * exp(-x * x) * exp(-w.x * 0.7) * sin((r - R) * 2.2 + w.z * 6.0);
    }
    np = base + turb + vec3(0.0, ripple * 0.7, 0.0);
    P.w = r;
  } else if (type < 1.5) {
    float s = H.x;
    float sp = (0.2 + 0.9 * A_BASS + 1.6 * A_KICK + 2.2 * A_DROP) * max(uS0.z, 0.05) * max(spin, 0.2);
    s += uDt * sp * 0.33;
    if (s > 1.0) { s = fract(s); H.y = rnd() * TAU; reset = true; }
    H.x = s;
    float y = H.z * (1.2 + s * 26.0);
    float rad = 0.06 + s * 1.6 * (0.25 + s) + 0.12 * sin(s * 28.0 - uTime * 5.0) * s;
    float ang = H.y + s * 9.0 + uTime * 1.4;
    np = vec3(cos(ang) * rad, y, sin(ang) * rad);
    np += curlNoise(np * 0.25 + uTime * 0.3) * s * 1.2 * uTurb;
    P.w = s;
  } else {
    float r = H.x;
    float th = H.y + 6.2 * pow(r, -1.5) * spin * uDt * 0.8;
    H.y = mod(th, TAU);
    np = vec3(cos(th) * r, H.z + sin(th * 3.0 + uTime * 0.2) * 0.3, sin(th) * r);
    P.w = r;
  }
  vec3 v = (np - P.xyz) / max(uDt, 1e-4);
  if (reset || length(np - P.xyz) > 4.0) v = vec3(0.0);
  V.xyz = v;
  P.xyz = np;
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  float type = H.w;
  float seed = V.w;
  if (type < 0.5) {
    float r = H.x;
    float temp = clamp(pow(R_ISCO / max(r, 1.0), 0.85), 0.0, 1.5);
    vec3 vdir = V.xyz / max(length(V.xyz), 1e-4);
    vec3 toCam = normalize(uCamPos - P.xyz);
    float beta = dot(vdir, toCam) * clamp(sqrt(1.0 / max(r, 1.0)), 0.0, 0.62) * uS0.w;
    float boost = pow(max(1.0 + beta * 1.5, 0.08), 3.0);
    float pc = clamp(0.2 + temp * 0.52 + beta * 0.28, 0.0, 1.0);
    float band = spec(clamp((r - 2.4) / 13.0, 0.0, 1.0) * 0.78 + 0.03);
    float b = 0.021 * (0.35 + 1.15 * pow(fract(seed * 17.3), 2.0)) * (0.35 + temp);
    b *= (0.55 + 1.5 * band * band + 0.35 * A_LEVEL) * boost;
    b *= smoothstep(1.0, 1.7, r) * smoothstep(15.6, 11.0, r);
    b *= 1.0 + (A_KICK * 1.6 + A_DROP * 2.0) * exp(-(r - R_ISCO) * 0.45);
    float sh = hashi2(id, int(uTime * 12.0));
    if (sh > 1.0 - 0.02 * A_HAT) b *= 5.0;
    color = palette(pc) * b;
    size = 0.033 * (0.7 + 0.6 * fract(seed * 5.1));
  } else if (type < 1.5) {
    float s = H.x;
    float gate = smoothstep(0.35, 0.9, A_BASS + A_KICK * 0.8 + A_DROP);
    float knots = 0.55 + 0.45 * sin(s * 46.0 - uTime * 18.0 + H.y);
    float b = 0.016 * (1.0 - s) * (1.0 - s) * gate * knots * (0.3 + 1.2 * A_KICK + 2.0 * A_DROP) * uS0.z;
    color = mix(palette(0.95), vec3(0.45, 0.65, 1.0), 0.65) * b * 1.6;
    size = 0.025 + s * 0.05;
  } else {
    color = palette(0.42 + 0.2 * fract(seed * 3.0)) * 0.0018 * (0.5 + fract(seed * 3.3)) * (0.7 + 0.6 * A_LEVEL);
    size = 0.055;
  }
}`,
  update(ctx) {
    const a = ctx.audio;
    ctx.lens.ringIntensity = 0.02 + a.kick * 0.035 + a.drop * 0.08 + a.bass * 0.012;
    ctx.lens.shadowScale = 1 + a.sub * 0.03 + a.drop * 0.05;
  }
};
