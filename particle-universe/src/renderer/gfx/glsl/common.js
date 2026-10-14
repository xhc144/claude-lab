// Shared GLSL snippets.

export const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

// Audio-reactive uniforms shared by simulation, rendering and post passes.
export const AUDIO = `
uniform vec4 uA0; // bass, mid, treble, level
uniform vec4 uA1; // kick, snare, hat, onset
uniform vec4 uA2; // sub, lowMid, highMid, intensity
uniform vec4 uA3; // drop, build, beatPhase, centroid
uniform sampler2D uSpec; // 128x1 smoothed log spectrum
uniform float uTime;
uniform float uDt;
#define A_BASS uA0.x
#define A_MID uA0.y
#define A_TREBLE uA0.z
#define A_LEVEL uA0.w
#define A_KICK uA1.x
#define A_SNARE uA1.y
#define A_HAT uA1.z
#define A_ONSET uA1.w
#define A_SUB uA2.x
#define A_LOWMID uA2.y
#define A_HIGHMID uA2.z
#define A_INTENSITY uA2.w
#define A_DROP uA3.x
#define A_BUILD uA3.y
#define A_BEAT uA3.z
#define A_CENTROID uA3.w
float spec(float x) { return texture(uSpec, vec2(clamp(x, 0.0, 1.0) * (127.0 / 128.0) + 0.5 / 128.0, 0.5)).r; }
`;

export const CONST = `
#define PI 3.14159265359
#define TAU 6.28318530718
`;

export const RNG = `
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
uint gRng;
void rngSeed(uint a, uint b) { gRng = pcg(a ^ pcg(b + 0x9e3779b9u)); }
float rnd() { gRng = pcg(gRng); return float(gRng) * (1.0 / 4294967296.0); }
float hashi(int i) { return float(pcg(uint(i) * 1664525u + 1013904223u)) * (1.0 / 4294967296.0); }
float hashi2(int i, int j) { return float(pcg(uint(i) ^ pcg(uint(j) + 374761393u))) * (1.0 / 4294967296.0); }
vec3 rndDir() {
  float z = rnd() * 2.0 - 1.0;
  float a = rnd() * 6.28318530718;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(a), z, r * sin(a));
}
vec3 rndBall() { return rndDir() * pow(rnd(), 1.0 / 3.0); }
float rndGauss() { return sqrt(-2.0 * log(max(rnd(), 1e-7))) * cos(6.28318530718 * rnd()); }
vec3 rndGauss3() { return vec3(rndGauss(), rndGauss(), rndGauss()); }
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

// Simplex noise with analytic gradient (Ashima Arts / Stefan Gustavson, MIT licence).
export const NOISE = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v, out vec3 gradient) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec4 temp = m2 * m * pdotx;
  gradient = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  gradient += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
  gradient *= 105.0;
  return 105.0 * dot(m4, pdotx);
}
float snoise(vec3 v) { vec3 g; return snoise(v, g); }
// Divergence-free "bitangent" noise: cross product of two noise gradients.
vec3 curlNoise(vec3 p) {
  vec3 g1, g2;
  snoise(p, g1);
  snoise(p + vec3(31.416, -47.853, 12.679), g2);
  return cross(g1, g2) * 0.12;
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, -3.1, 2.3); a *= 0.5; }
  return s;
}
`;

export const PALETTE = `
uniform sampler2D uPalette;
uniform vec3 uPal; // rowA (v), rowB (v), mix
vec3 palette(float t) {
  t = clamp(t, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0;
  vec3 a = texture(uPalette, vec2(t, uPal.x)).rgb;
  vec3 b = texture(uPalette, vec2(t, uPal.y)).rgb;
  return mix(a, b, uPal.z);
}
vec3 paletteWrap(float t) { return palette(abs(fract(t * 0.5) * 2.0 - 1.0)); }
`;

// Common particle-sim inputs.
export const SIM_UNIFORMS = `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uHome;
uniform ivec2 uTexSize;
uniform int uFrame;
uniform float uSpeed;
uniform float uTurb;
uniform vec4 uS0;
uniform vec4 uS1;
uniform vec4 uS2;
uniform vec4 uS3;
uniform vec4 uWave[4];
uniform vec3 uCamPos;
uniform float uCount;
`;

export const ACES = `
const mat3 ACESIn = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
const mat3 ACESOut = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
vec3 rrtOdt(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFitted(vec3 c) { return clamp(ACESOut * rrtOdt(ACESIn * c), 0.0, 1.0); }
`;
