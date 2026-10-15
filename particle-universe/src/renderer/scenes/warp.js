// 超空间 · Hyperspace — a first-person jump through a tunnel of light. Speed follows the energy of
// the track, drops trigger a full warp, the tunnel walls bulge with the spectrum mapped around
// the circumference, and motion-stretched sprites turn every particle into a light streak.

export default {
  id: 'warp',
  name: '超空间跃迁',
  en: 'HYPERSPACE',
  desc: '穿越光之隧道，能量决定航速，高潮触发跃迁，隧道壁随频谱起伏',
  palette: 'glacier',
  params: [
    { key: 'speed', label: '航行速度', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'radius', label: '隧道半径', min: 0.4, max: 2.5, step: 0.01, def: 1 },
    { key: 'twist', label: '螺旋扭转', min: 0, max: 3, step: 0.01, def: 1 },
    { key: 'pulse', label: '频谱起伏', min: 0, max: 3, step: 0.01, def: 1 }
  ],
  post: { exposure: 1.0, bloom: 1.1, bloomRadius: 1.0, threshold: 0.0, trails: 0.3, flare: 0.7, flareTint: [0.55, 0.75, 1.0], ca: 1.2, vignette: 0.7, grain: 0.3, streak: 0.05, size: 1.0, intensity: 1.0, dof: 0.0, sat: 1.1, contrast: 1.06, maxPx: 14, streakKeep: 0.3 },
  background: { stars: 0.5, haze: 0.0, hazeScale: 1, hazeA: [0, 0, 0], hazeB: [0, 0, 0], top: [0.0003, 0.00045, 0.0012], bottom: [0.0003, 0.00045, 0.0012], glow: { dir: [0, 0, -1], color: [0.55, 0.75, 1.0], amount: 0.5, size: 0.06 } },
  camera: {
    mode: 'look', target: [0, 0, -10], distance: 10, minDist: 1, maxDist: 10,
    shots: [
      { type: 'fixed', pos: [0, 0, 0], fov: [62, 70], sway: 0.05, rollAmt: 1, establish: true, weight: 2 },
      { type: 'fixed', pos: [0, 0, 0], fov: [75, 88], sway: 0.08, rollAmt: 2, weight: 1.5 },
      { type: 'fixed', pos: [2.2, -1.2, 0], fov: [55, 62], sway: 0.08, rollAmt: 0.6, weight: 1 },
      { type: 'fixed', pos: [0, 0, 0], fov: [58, 64], sway: 0.1, rollAmt: 0.4, spin: 2, speed: [0.05, 0.08], weight: 1 }
    ]
  },
  common: `
const float W_LEN = 230.0;
`,
  spawn: `
void spawn(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float k = rnd();
  float a = rnd() * TAU;
  float r = mix(2.2, 15.0, pow(rnd(), 0.75)) * uS0.y;
  float type = 0.0;
  if (k < 0.06) { type = 1.0; r = mix(0.25, 1.2, rnd()); }
  else if (k < 0.12) { type = 2.0; r = mix(16.0, 40.0, rnd()) * uS0.y; }
  float z = -rnd() * W_LEN;
  H = vec4(a, r, rnd(), type);
  P = vec4(cos(a) * r, sin(a) * r, z, 0.0);
  V.xyz = vec3(0.0, 0.0, 60.0);
}`,
  sim: `
void simulate(inout vec4 P, inout vec4 V, inout vec4 H, int id) {
  float speed = (30.0 + 150.0 * A_INTENSITY + 90.0 * A_BASS + 60.0 * A_KICK + 520.0 * A_DROP + 80.0 * A_BUILD) * uS0.x * uSpeed;
  if (H.w > 1.5) speed *= 0.35;
  float z = P.z + speed * uDt;
  float a = H.x + uDt * (0.12 + 0.6 * A_MID + 0.8 * A_DROP) * uS0.z * (1.0 + 2.5 / max(H.y, 0.5));
  H.x = mod(a, TAU);
  float band = abs(fract(a / TAU) * 2.0 - 1.0);
  float bulge = 1.0 + (spec(band * 0.85 + 0.04) * 0.5 + A_KICK * 0.12) * uS0.w * (H.w < 0.5 ? 1.0 : 0.2);
  float r = H.y * bulge * (1.0 - A_BUILD * 0.25);
  bool wrap = false;
  if (z > 6.0) { z -= W_LEN + rnd() * 10.0; wrap = true; H.z = rnd(); }
  vec3 np = vec3(cos(a) * r, sin(a) * r, z);
  vec3 tang = vec3(-sin(a), cos(a), 0.0) * (0.12 + 0.6 * A_MID) * uS0.z * r;
  V.xyz = vec3(tang.xy, speed);
  P.xyz = np;
  P.w = band;
}`,
  render: `
void shade(vec4 P, vec4 V, vec4 H, int id, out vec3 color, out float size) {
  float seed = V.w;
  float z = P.z;
  float fadeFar = smoothstep(-W_LEN, -W_LEN * 0.3, z) * (0.35 + 0.65 * smoothstep(-W_LEN * 0.5, -10.0, z));
  float fadeNear = smoothstep(0.0, 3.0, -z);
  float band = P.w;
  float sp = spec(band * 0.85 + 0.04);
  float b = 0.0055 * fadeFar * fadeNear * (0.35 + 1.4 * sp * sp + 0.5 * A_LEVEL + 1.0 * A_DROP);
  b *= 0.12 + 6.0 * pow(fract(seed * 7.3), 8.0);
  float t = clamp(0.3 + band * 0.5 + (H.z - 0.5) * 0.25, 0.0, 1.0);
  if (H.w > 0.5 && H.w < 1.5) { b *= 2.5; t = 0.95; }
  if (H.w > 1.5) { b *= 0.35; t *= 0.6; }
  float fl = hashi2(id, int(uTime * 20.0));
  if (fl > 1.0 - A_HAT * 0.03) b *= 5.0;
  color = palette(t) * b;
  size = 0.014 * (0.7 + 0.6 * fract(seed * 4.1));
}`,
  update(ctx) {
    const a = ctx.audio;
    ctx.glow.amount = 0.08 + a.bass * 0.1 + a.kick * 0.15 + a.drop * 0.6;
    ctx.glow.size = 0.05 + a.drop * 0.05 + a.build * 0.03;
  }
};
