// ---------------------------------------------------------------------------
// Shared helpers: hashing, noise, SDF primitives, BRDF pieces.
// ---------------------------------------------------------------------------
#define PI 3.14159265359
#define TAU 6.28318530718

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
float sq(float x) { return x * x; }
float lin(float a, float b, float x) { return saturate((x - a) / (b - a)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// ---- per-pixel / per-sample RNG (PCG)
uint gRng;
uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}
void initRng(vec2 px) {
    gRng = pcg(uint(px.x) + pcg(uint(px.y) + pcg(uint(uSeed * 1000.0))));
}
float rnd() { gRng = pcg(gRng); return float(gRng) * (1.0 / 4294967296.0); }

// ---- hashes (Dave Hoskins, sine-free)
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
vec3 hash32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }

// ---- value noise
float noise2(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// value noise with analytic derivatives (returns value, d/dx, d/dy), range ~[-1,1]
vec3 noised2(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
    float k0 = a, k1 = b - a, k2 = c - a, k4 = a - b - c + d;
    return vec3(-1.0 + 2.0 * (k0 + k1 * u.x + k2 * u.y + k4 * u.x * u.y),
                2.0 * du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
float noise3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), u.x),
                   mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
               mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x),
                   mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}

const mat2 M2 = mat2(0.80, 0.60, -0.60, 0.80);
const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

float fbm2(vec2 p, int oct) {
    float a = 0.0, b = 0.5;
    for (int i = 0; i < oct; i++) { a += b * noise2(p); p = M2 * p * 2.02; b *= 0.5; }
    return a;
}
float fbm3(vec3 p, int oct) {
    float a = 0.0, b = 0.5;
    for (int i = 0; i < oct; i++) { a += b * noise3(p); p = M3 * p * 2.03; b *= 0.5; }
    return a;
}

// Voronoi: returns (F1, F2) distances
vec2 voronoi2(vec2 x) {
    vec2 n = floor(x), f = fract(x);
    float d1 = 8.0, d2 = 8.0;
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(i, j);
        vec2 o = hash22(n + g);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    return sqrt(vec2(d1, d2));
}

// ---- SDF primitives (iq)
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdBox2(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = saturate(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h) - r; }
float sdCylY(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdPlane(vec3 p, vec3 n, float h) { return dot(p, n) + h; }

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return max(a, b) + h * h * k * 0.25; }

// ---- shading helpers
float fresnelSchlick(float cosT, float f0) { return f0 + (1.0 - f0) * pow(1.0 - saturate(cosT), 5.0); }
float ggxD(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float smithG(float NoV, float NoL, float a) { float k = a * 0.5; return (NoV / (NoV * (1.0 - k) + k)) * (NoL / (NoL * (1.0 - k) + k)); }
// microfacet specular (returns BRDF * NoL, white F0 scaled by caller)
float specGGX(vec3 n, vec3 v, vec3 l, float rough, float f0) {
    vec3 h = normalize(v + l);
    float NoL = saturate(dot(n, l)), NoV = max(dot(n, v), 1e-3), NoH = saturate(dot(n, h)), VoH = saturate(dot(v, h));
    float a = max(rough * rough, 2e-3);
    return ggxD(NoH, a) * smithG(NoV, NoL, a) * fresnelSchlick(VoH, f0) / (4.0 * NoV) ;
}

vec3 cosineHemisphere(vec3 n) {
    float u = rnd(), v = rnd();
    float r = sqrt(u), phi = TAU * v;
    vec3 t = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0, 1, 0)) : cross(n, vec3(1, 0, 0)));
    vec3 b = cross(n, t);
    return normalize(t * r * cos(phi) + b * r * sin(phi) + n * sqrt(1.0 - u));
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
