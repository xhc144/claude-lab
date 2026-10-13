// GLSL sources. Positions are camera-relative (the camera sits at the origin) so precision holds
// far from the world origin. The scene is lit in linear HDR: albedo × (sun·shadow + sky ambient +
// block light), then the post pipeline adds bloom and god rays and tonemaps (ACES). When float
// render targets are unavailable (or on the lowest quality) shaders tonemap inline (u_direct = 1).

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp sampler2DShadow;
precision highp sampler3D;
`;

// aerial perspective / fog, evaluated per vertex (it varies smoothly and the sky lookup is costly)
const FOG_VS = `
uniform vec3 u_lutSun;
uniform vec3 u_hazeSun;    // sky colour just above the horizon toward the sun
uniform vec3 u_hazeAnti;   // ... and away from it
uniform vec3 u_fogColor;
uniform float u_fogNear;
uniform float u_fogFar;
uniform float u_haze;
uniform float u_caveFog;
uniform float u_underwater;
out vec4 v_fog;   // rgb: haze colour, a: amount
vec3 hazeColor(vec3 d) {
  vec2 sd = u_lutSun.xz; float sl = length(sd);
  vec2 dd = d.xz; float dl = length(dd);
  float c = (sl > 1e-4 && dl > 1e-4) ? dot(sd / sl, dd / dl) : 0.0;
  float k = c * 0.5 + 0.5;
  return mix(u_hazeAnti, u_hazeSun, k * k * k);
}
void computeFog(vec3 rel) {
  float d = length(rel);
  vec3 dir = rel / max(d, 1e-4);
  if (u_underwater > 0.5) {
    float f = clamp((d - u_fogNear) / max(1.0, u_fogFar - u_fogNear), 0.0, 1.0);
    v_fog = vec4(u_fogColor, 1.0 - exp(-f * 3.2));
    return;
  }
  vec3 hz = mix(hazeColor(dir), u_fogColor, u_caveFog);
  float haze = 1.0 - exp(-d * u_haze * (u_caveFog > 0.5 ? 2.5 : 1.0));
  float edge = smoothstep(u_fogNear, u_fogFar, d);
  v_fog = vec4(hz, clamp(max(haze, edge), 0.0, 1.0));
}
`;

// shared by every lit fragment shader
const COMMON = `
uniform vec3 u_lightDir;     // toward the main light (the sun by day, the moon by night)
uniform vec3 u_lightCol;     // its radiance after the atmosphere (linear HDR)
uniform vec3 u_ambient;      // sky hemisphere irradiance
uniform vec3 u_ambientMin;   // night-sky floor (scaled by the brightness setting)
uniform vec3 u_fogColor;     // underwater / lava / cave fog
uniform float u_fogNear;
uniform float u_fogFar;
uniform float u_haze;        // atmospheric haze density per block
uniform float u_caveFog;     // 1 when the camera is deep underground: fog toward u_fogColor
uniform float u_time;
uniform float u_exposure;
uniform float u_direct;
uniform float u_underwater;
uniform sampler2D u_skyLUT;
uniform vec3 u_lutSun;       // the sun direction the sky LUT was built for
uniform float u_lutScale;    // LUT stored scaled when it cannot be a float texture
uniform sampler2DShadow u_shadowMap;
uniform float u_shadowOn;
uniform float u_shadowTexel;
const float PI = 3.14159265;

vec3 toLinear(vec3 c) { return c * c * (0.8 + 0.2 * c); } // ≈ sRGB → linear, cheap
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 outColor(vec3 c) {
  if (u_direct > 0.5) c = pow(aces(c * u_exposure), vec3(1.0 / 2.2));
  return c;
}
vec3 skyLUT(vec3 d) {
  vec2 sd = u_lutSun.xz; float sl = length(sd);
  vec2 dd = d.xz; float dl = length(dd);
  float c = (sl > 1e-4 && dl > 1e-4) ? dot(sd / sl, dd / dl) : 1.0;
  float az = acos(clamp(c, -1.0, 1.0)) / PI;
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (PI * 0.5));
  return texture(u_skyLUT, vec2(az, v)).rgb / u_lutScale;
}
float shadowAt(vec4 sp, float ndl) {
  if (u_shadowOn < 0.5) return 1.0;
  vec3 c = sp.xyz / sp.w * 0.5 + 0.5;
  if (c.x <= 0.002 || c.x >= 0.998 || c.y <= 0.002 || c.y >= 0.998 || c.z >= 1.0) return 1.0;
  float z = c.z - (0.0004 + 0.0012 * (1.0 - clamp(ndl, 0.0, 1.0)));
  float s = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
    s += texture(u_shadowMap, vec3(c.xy + vec2(float(i), float(j)) * u_shadowTexel * 1.3, z));
  s /= 9.0;
  float edge = max(abs(c.x - 0.5), abs(c.y - 0.5)) * 2.0;
  return mix(s, 1.0, smoothstep(0.86, 0.99, edge));
}
// albedo lit by the sun (with shadows), the sky dome and block light.
// L = voxel light (sky, r, g, b) 0..1; foliage = thin leaves/grass that let light through
vec3 shade(vec3 albedo, vec3 N, vec4 L, float ao, float foliage, vec4 shadowPos) {
  float sky = L.x;
  float ndl = dot(N, u_lightDir);
  float diff = foliage > 0.5 ? (0.35 + 0.65 * abs(ndl)) : max(ndl, 0.0);
  float vis = 0.0;
  if (diff > 0.0) vis = shadowAt(shadowPos, foliage > 0.5 ? 1.0 : ndl) * smoothstep(0.32, 0.86, sky);
  vec3 direct = u_lightCol * diff * vis * mix(1.0, ao, 0.4);
  vec3 skyAmb = u_ambient * (sky * sky) * (0.55 + 0.45 * (N.y * 0.5 + 0.5));
  vec3 blk = L.yzw;
  blk = blk * blk * (0.5 + blk * 0.75) * 1.25;
  vec3 amb = (skyAmb + blk + u_ambientMin) * ao;
  return albedo * (direct + amb);
}

vec3 faceNormal(int f) {
  return f == 0 ? vec3(1, 0, 0) : f == 1 ? vec3(-1, 0, 0) : f == 2 ? vec3(0, 1, 0) : f == 3 ? vec3(0, -1, 0) : f == 4 ? vec3(0, 0, 1) : f == 5 ? vec3(0, 0, -1) : vec3(0, 1, 0);
}
`;

// ---------------------------------------------------------------- terrain
export const TERRAIN_VS = HEAD + FOG_VS + `
layout(location=0) in vec4 a_pos;
layout(location=1) in vec4 a_uvf;
layout(location=2) in vec4 a_light;
layout(location=3) in vec4 a_tint;
uniform mat4 u_vp;
uniform mat4 u_shadowVP;
uniform vec3 u_origin;   // section origin minus camera
uniform vec3 u_secWorld; // section origin in world space (wrapped)
uniform float u_time;
uniform float u_shadowOff;
out vec3 v_uv;
out vec4 v_light;
out vec4 v_tint;
out vec3 v_rel;
out vec3 v_world;
out vec4 v_shadow;
flat out int v_face;
flat out int v_flags;
out float v_ao;
vec3 faceN(int f) {
  return f == 0 ? vec3(1, 0, 0) : f == 1 ? vec3(-1, 0, 0) : f == 2 ? vec3(0, 1, 0) : f == 3 ? vec3(0, -1, 0) : f == 4 ? vec3(0, 0, 1) : f == 5 ? vec3(0, 0, -1) : vec3(0, 1, 0);
}
void main() {
  vec3 lp = a_pos.xyz / 16.0;
  vec3 p = u_origin + lp;
  vec3 wp = u_secWorld + lp;
  int fa = int(a_uvf.z + 0.5);
  int face = fa & 7;
  int ao = fa >> 3;
  int flags = int(a_uvf.w + 0.5);
  if ((flags & 1) != 0) {
    float w = a_tint.a;
    float t = u_time;
    float gust = 0.6 + 0.4 * sin(t * 0.35 + wp.x * 0.05 + wp.z * 0.04);
    p.x += (sin(t * 1.9 + wp.x * 0.7 + wp.z * 0.45) * 0.06 + sin(t * 4.3 + wp.z * 1.3) * 0.015) * w * gust;
    p.z += (cos(t * 1.5 + wp.z * 0.6 + wp.x * 0.35) * 0.05) * w * gust;
  }
  if ((flags & 8) != 0 && face == 2) {
    p.y += (sin(u_time * 1.4 + wp.x * 0.8 + wp.z * 0.45) + sin(u_time * 2.1 - wp.z * 0.7 + wp.x * 0.3) * 0.6) * 0.03 - 0.07;
  }
  v_uv = vec3(a_uvf.xy / 16.0, a_pos.w);
  if ((flags & 4) != 0) v_uv.y += u_time * 1.0;
  if ((flags & 16) != 0) v_uv.xy += vec2(sin(u_time * 0.4 + wp.z * 0.2), u_time * 0.12) * 0.25;
  v_light = a_light;
  v_tint = a_tint;
  v_rel = p;
  v_world = wp;
  v_face = face;
  v_flags = flags;
  v_ao = float(ao);
  vec3 n = faceN(face);
  v_shadow = u_shadowVP * vec4(p + n * u_shadowOff, 1.0);
  computeFog(p);
  gl_Position = u_vp * vec4(p, 1.0);
}`;

const FOG_FS = `
in vec4 v_fog;
vec3 applyFog(vec3 col) { return mix(col, v_fog.rgb, v_fog.a); }
`;

const TERRAIN_IN = FOG_FS + `
uniform sampler2DArray u_tex;
in vec3 v_uv;
in vec4 v_light;
in vec4 v_tint;
in vec3 v_rel;
in vec3 v_world;
in vec4 v_shadow;
flat in int v_face;
flat in int v_flags;
in float v_ao;
out vec4 o;
// texture colour with biome tint, emission and alpha
vec4 surface(out float emis) {
  vec4 t = texture(u_tex, v_uv);
  vec3 c = t.rgb;
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  if (sat < 0.025 || (v_flags & 32) != 0) c *= v_tint.rgb;
  emis = 0.0;
  float a = t.a;
  if ((v_flags & 64) != 0 && t.a < 0.985) { emis = clamp((1.0 - t.a) * 2.05, 0.0, 1.0); a = 1.0; }
  if ((v_flags & 2) != 0) emis = max(emis, 0.85);
  if ((v_flags & 16) != 0) emis = 1.0;
  if ((v_flags & 32) != 0) emis = max(emis, 0.35 * clamp((v_tint.g - 0.24) / 0.76, 0.0, 1.0));
  return vec4(c, a);
}
float aoFactor() { return v_ao < 0.5 ? 0.38 : v_ao < 1.5 ? 0.6 : v_ao < 2.5 ? 0.81 : 1.0; }
`;

export const TERRAIN_FS = HEAD + COMMON + TERRAIN_IN + `
uniform sampler2DArray u_mat;   // normal.xy, roughness, metalness per texel
uniform sampler2D u_noise2;
uniform float u_wet;            // rain on exposed surfaces 0..1
uniform float u_pbr;            // 0 on the lowest quality: plain diffuse
mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p), dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float im = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
  return mat3(T * im, B * im, N);
}
void main() {
  float emis;
  vec4 s = surface(emis);
  if (s.a < 0.3) discard;
  vec3 albedo = toLinear(s.rgb);
  vec3 Ng = faceNormal(v_face);
  bool foliage = v_face >= 6;                          // crossed plants: lit through, both sides
  bool leafCube = !foliage && (v_flags & 1) != 0;      // leaf blocks: lit by face, a little light through
  float ao = aoFactor();
  if (u_pbr < 0.5) {
    float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
    vec3 col = shade(albedo, Ng, v_light, ao * mix(0.86, 1.06, smoothstep(0.08, 0.7, lum)), foliage ? 1.0 : 0.0, v_shadow);
    if (leafCube) col += albedo * u_lightCol * 0.12 * max(0.0, -dot(Ng, u_lightDir)) * smoothstep(0.32, 0.86, v_light.x);
    col += albedo * emis * ((v_flags & 16) != 0 ? 7.0 : 4.5);
    o = vec4(outColor(applyFog(col)), 1.0);
    return;
  }
  vec4 m = texture(u_mat, v_uv);
  float rough = m.b, metal = m.a;
  vec3 N = Ng;
  if (!foliage) {
    vec3 tn = vec3(m.rg * 2.0 - 1.0, 0.0);
    tn.z = sqrt(max(0.0, 1.0 - dot(tn.xy, tn.xy)));
    N = normalize(cotangentFrame(Ng, v_rel, v_uv.xy) * tn);
  }
  vec3 V = normalize(-v_rel);
  float sky = v_light.x;
  // rain: exposed surfaces darken and turn glossy; flat tops gather puddles
  float wet = u_wet * smoothstep(0.78, 0.97, sky);
  if (wet > 0.0 && !foliage) {
    float puddle = max(Ng.y, 0.0) * smoothstep(0.5, 0.72, texture(u_noise2, v_world.xz * 0.045).r) * step(0.45, rough);
    albedo *= mix(1.0, 0.6, wet * (1.0 - metal));
    rough = mix(rough, 0.07, wet * (0.35 + 0.65 * puddle));
    N = normalize(mix(N, Ng, wet * puddle));
  }
  // direct light (diffuse + Blinn-Phong specular) through the shadow map
  float ndl = dot(N, u_lightDir), ndlG = dot(Ng, u_lightDir);
  float diff = foliage ? (0.35 + 0.65 * abs(ndl)) : leafCube ? max(0.0, ndl * 0.75 + 0.25) : max(ndl, 0.0) * step(0.0, ndlG);
  float vis = diff > 0.0 ? shadowAt(v_shadow, foliage || leafCube ? 1.0 : ndlG) * smoothstep(0.32, 0.86, sky) : 0.0;
  // leaves glow a little when the sun is behind them
  vec3 through = leafCube ? albedo * u_lightCol * 0.16 * max(0.0, -ndlG) * smoothstep(0.32, 0.86, sky) : vec3(0.0);
  vec3 F0 = mix(vec3(0.04), albedo, metal);
  vec3 H = normalize(V + u_lightDir);
  float a2 = rough * rough * rough * rough;
  float sp = 2.0 / max(a2, 1e-4) - 2.0;
  float D = (sp + 8.0) / 25.13 * pow(max(dot(N, H), 0.0), sp);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  vec3 kd = (1.0 - metal) * (1.0 - F * 0.5);
  vec3 direct = u_lightCol * vis * (albedo * kd * diff * mix(1.0, ao, 0.4) + D * F * 0.25 * max(ndl, 0.0) * (foliage ? 0.2 : 1.0));
  // ambient: sky dome + block light
  vec3 skyAmb = u_ambient * (sky * sky) * (0.55 + 0.45 * (N.y * 0.5 + 0.5));
  vec3 blk = v_light.yzw;
  blk = blk * blk * (0.5 + blk * 0.75) * 1.25;
  vec3 col = direct + through + albedo * kd * (skyAmb + blk + u_ambientMin) * ao;
  // smooth surfaces mirror the sky
  if (rough < 0.6) {
    vec3 R = reflect(-V, N);
    float nv = max(dot(N, V), 0.0);
    vec3 Fe = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - nv, 5.0);
    float k = (1.0 - rough / 0.6);
    col += skyLUT(vec3(R.x, abs(R.y), R.z)) * Fe * k * k * sky * sky * ao;
    col += blk * F0 * 0.5 * k;
  }
  col += albedo * emis * ((v_flags & 16) != 0 ? 7.0 : 4.5);
  o = vec4(outColor(applyFog(col)), 1.0);
}`;

// translucent pass: water (refraction, reflections, absorption, foam) and glass/ice
export const TRANS_FS = HEAD + COMMON + TERRAIN_IN + `
uniform sampler2D u_sceneColor;
uniform highp sampler2D u_sceneDepth;
uniform sampler2D u_noise2;
uniform vec2 u_screen;
uniform mat4 u_vp;
uniform float u_near;
uniform float u_far;
uniform float u_refract;   // 1: the opaque scene is available for refraction / reflection
uniform float u_ssr;       // screen-space reflection steps (0 = off)
float linDepth(float z) { return 2.0 * u_near * u_far / (u_far + u_near - (2.0 * z - 1.0) * (u_far - u_near)); }
float wh(vec2 p) {
  return texture(u_noise2, p).r;
}
vec3 waterNormal(vec2 p) {
  float t = u_time;
  vec2 a = p * 0.045 + vec2(t * 0.011, t * 0.007);
  vec2 b = p * 0.11 + vec2(-t * 0.018, t * 0.013);
  vec2 c = p * 0.31 + vec2(t * 0.031, -t * 0.024);
  float e = 1.0 / 256.0;
  float h0 = wh(a) * 0.55 + wh(b) * 0.3 + wh(c) * 0.15;
  float hx = wh(a + vec2(e, 0)) * 0.55 + wh(b + vec2(e * 2.4, 0)) * 0.3 + wh(c + vec2(e * 6.9, 0)) * 0.15;
  float hz = wh(a + vec2(0, e)) * 0.55 + wh(b + vec2(0, e * 2.4)) * 0.3 + wh(c + vec2(0, e * 6.9)) * 0.15;
  return normalize(vec3((h0 - hx) * 7.0, 1.0, (h0 - hz) * 7.0));
}
vec3 ssr(vec3 P, vec3 R, out float hit) {
  hit = 0.0;
  float stepLen = 0.35;
  vec3 p = P;
  float prevD = 0.0;
  int n = int(u_ssr);
  for (int i = 0; i < 48; i++) {
    if (i >= n) break;
    p += R * stepLen;
    stepLen *= 1.13;
    vec4 c = u_vp * vec4(p, 1.0);
    if (c.w <= 0.05) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float sz = linDepth(texture(u_sceneDepth, uv).r);
    float dd = c.w - sz;
    if (dd > 0.02 && dd < stepLen * 3.0 + 0.5) {
      // refine between the last two steps
      vec3 a = p - R * stepLen / 1.13, b = p;
      for (int k = 0; k < 5; k++) {
        vec3 m = (a + b) * 0.5;
        vec4 cm = u_vp * vec4(m, 1.0);
        vec2 um = cm.xy / cm.w * 0.5 + 0.5;
        if (cm.w > linDepth(texture(u_sceneDepth, um).r)) b = m; else a = m;
      }
      vec4 cb = u_vp * vec4(b, 1.0);
      vec2 ub = cb.xy / cb.w * 0.5 + 0.5;
      vec2 e = smoothstep(0.0, 0.08, ub) * smoothstep(1.0, 0.92, ub);
      hit = e.x * e.y * (1.0 - float(i) / float(n));
      if (texture(u_sceneDepth, ub).r > 0.99999) hit = 0.0; // sky: use the analytic sky instead
      return texture(u_sceneColor, ub).rgb;
    }
  }
  return vec3(0.0);
}
void main() {
  float emis;
  vec4 s = surface(emis);
  if (s.a < 0.02) discard;
  vec3 V = normalize(-v_rel);
  float outdoor = smoothstep(0.3, 0.9, v_light.x);
  if ((v_flags & 8) != 0) {
    // ---------------- water. Each surface also has a downward quad for the view from below;
    // only ever draw the side that faces the camera.
    if (!gl_FrontFacing) discard;
    vec3 N = v_face == 2 ? waterNormal(v_world.xz) : (v_face == 3 ? vec3(0.0, -1.0, 0.0) : faceNormal(v_face));
    if (v_face == 3) N = -waterNormal(v_world.xz);
    float NdV = max(dot(N, V), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
    vec3 wc = toLinear(v_tint.rgb);
    float shadowL = shadowAt(v_shadow, 1.0) * outdoor;
    // light scattered back out of the water body
    vec3 scatter = wc * (u_ambient * 0.32 * v_light.x * v_light.x + u_lightCol * 0.06 * max(u_lightDir.y, 0.0) * shadowL + v_light.yzw * v_light.yzw * 0.4);
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 refl = skyLUT(R) * outdoor + scatter * (1.0 - outdoor);
    vec3 col;
    float alpha = 1.0;
    if (u_refract > 0.5) {
      vec2 suv = gl_FragCoord.xy / u_screen;
      float wz = linDepth(gl_FragCoord.z);
      float th0 = max(0.0, linDepth(texture(u_sceneDepth, suv).r) - wz);
      vec2 ruv = suv + N.xz * 0.045 * clamp(th0 * 0.25, 0.0, 1.0) / max(1.0, wz * 0.05);
      float rz = linDepth(texture(u_sceneDepth, ruv).r);
      if (rz < wz) { ruv = suv; rz = linDepth(texture(u_sceneDepth, suv).r); }
      float thick = max(0.0, rz - wz);
      vec3 refr = texture(u_sceneColor, ruv).rgb;
      vec3 sigma = vec3(0.30, 0.095, 0.06) + (1.0 - wc) * 0.12;
      vec3 T = exp(-thick * sigma);
      vec3 under = refr * T + scatter * (1.0 - T);
      if (u_ssr > 0.5 && v_face == 2) {
        float hit;
        vec3 sr = ssr(v_rel, reflect(-V, N), hit);
        refl = mix(refl, sr, hit);
      }
      col = mix(under, refl, F);
      // foam where the water is shallow against the shore
      float foamN = texture(u_noise2, v_world.xz * 0.21 + vec2(u_time * 0.02, -u_time * 0.017)).r;
      float foam = (1.0 - smoothstep(0.0, 0.55, thick)) * smoothstep(0.45, 0.75, foamN + 0.25 * sin(u_time * 1.3 + thick * 9.0));
      col = mix(col, (u_ambient * v_light.x + u_lightCol * shadowL * max(u_lightDir.y, 0.0)) * 0.9, foam * 0.75 * float(v_face == 2));
    } else {
      col = mix(scatter * 2.5, refl, F);
      alpha = mix(0.72, 0.97, F);
    }
    // sun glint
    vec3 H = normalize(V + u_lightDir);
    float spec = pow(max(dot(N, H), 0.0), 480.0) * 60.0 + pow(max(dot(N, H), 0.0), 60.0) * 0.6;
    col += u_lightCol * spec * shadowL;
    if (u_underwater > 0.5 && v_face == 3) {
      // seen from below: Snell's window to the sky, total internal reflection outside it
      float win = smoothstep(0.55, 0.75, NdV);
      col = mix(scatter * 1.6, skyLUT(vec3(-N.x, 1.0, -N.z)) * 0.8 + u_lightCol * 0.15, win);
      alpha = 1.0;
    }
    col = applyFog(col);
    o = vec4(outColor(col), alpha);
    return;
  }
  // ---------------- glass, ice and other translucent blocks
  vec3 albedo = toLinear(s.rgb);
  vec3 N = faceNormal(v_face);
  vec3 col = shade(albedo, N, v_light, aoFactor(), 0.0, v_shadow);
  col += albedo * emis * 4.0;
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  col += skyLUT(vec3(R.x, abs(R.y), R.z)) * F * outdoor * 0.8;
  float alpha = mix(s.a, 1.0, F * 0.6);
  col = applyFog(col);
  o = vec4(outColor(col), alpha);
}`;

// depth-only passes into the shadow map
export const SHADOW_VS = HEAD + `
layout(location=0) in vec4 a_pos;
layout(location=1) in vec4 a_uvf;
layout(location=3) in vec4 a_tint;
uniform mat4 u_vp;
uniform vec3 u_origin;
uniform vec3 u_secWorld;
uniform float u_time;
out vec3 v_uv;
void main() {
  vec3 lp = a_pos.xyz / 16.0;
  vec3 p = u_origin + lp;
  vec3 wp = u_secWorld + lp;
  int flags = int(a_uvf.w + 0.5);
  if ((flags & 1) != 0) {
    float w = a_tint.a, t = u_time;
    float gust = 0.6 + 0.4 * sin(t * 0.35 + wp.x * 0.05 + wp.z * 0.04);
    p.x += (sin(t * 1.9 + wp.x * 0.7 + wp.z * 0.45) * 0.06 + sin(t * 4.3 + wp.z * 1.3) * 0.015) * w * gust;
    p.z += (cos(t * 1.5 + wp.z * 0.6 + wp.x * 0.35) * 0.05) * w * gust;
  }
  v_uv = vec3(a_uvf.xy / 16.0, a_pos.w);
  gl_Position = u_vp * vec4(p, 1.0);
}`;
export const SHADOW_FS = HEAD + `
uniform sampler2DArray u_tex;
in vec3 v_uv;
out vec4 o;
void main() {
  if (texture(u_tex, v_uv).a < 0.3) discard;
  o = vec4(1.0);
}`;
export const SHADOW_ENTITY_VS = HEAD + `
layout(location=0) in vec3 a_pos;
layout(location=3) in vec3 a_uvl;
uniform mat4 u_vp;
uniform mat4 u_model;
uniform vec3 u_origin;
out vec3 v_uvl;
void main() {
  vec4 wp = u_model * vec4(a_pos, 1.0);
  v_uvl = a_uvl;
  gl_Position = u_vp * vec4(wp.xyz + u_origin, 1.0);
}`;
export const SHADOW_ENTITY_FS = HEAD + `
uniform sampler2DArray u_tex;
in vec3 v_uvl;
out vec4 o;
void main() {
  if (v_uvl.z >= 0.0 && texture(u_tex, v_uvl).a < 0.3) discard;
  o = vec4(1.0);
}`;

// ---------------------------------------------------------------- full-screen helpers
export const FSQ_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
out vec2 v_ndc;
void main() { v_uv = a_pos * 0.5 + 0.5; v_ndc = a_pos; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// the sky is drawn after opaque terrain at the far plane, so only uncovered pixels pay for it
export const SKYQ_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
out vec2 v_ndc;
void main() { v_uv = a_pos * 0.5 + 0.5; v_ndc = a_pos; gl_Position = vec4(a_pos, 0.99999, 1.0); }`;

// sky-view LUT: x = azimuth from the sun (0..π), y = elevation (sqrt-warped around the horizon)
export const SKYLUT_FS = HEAD + `
uniform vec3 u_sun;
uniform float u_rain;
uniform float u_sunI;
uniform float u_moonI;
in vec2 v_uv;
out vec4 o;
const float RE = 6360e3, RA = 6460e3, CAMH = 600.0;
const vec3 BR = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const float HR = 8000.0, BM = 10e-6, HM = 1200.0;
const vec3 BO = vec3(0.65e-6, 1.881e-6, 0.085e-6);
const float PI = 3.14159265;
float ozone(float y) { return max(0.0, 1.0 - abs(y - 25000.0) / 15000.0); }
float rayToTop(float h, float mu) { float r = RE + h; float b = r * mu, c = r * r - RA * RA; return -b + sqrt(max(0.0, b * b - c)); }
vec3 odepth(float h, float mu) {
  float L = rayToTop(h, mu), ds = L / 4.0;
  vec3 od = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float t = (float(i) + 0.5) * ds, r = RE + h;
    float y = sqrt(r * r + t * t + 2.0 * r * t * mu) - RE;
    od += vec3(exp(-y / HR), exp(-y / HM), ozone(y)) * ds;
  }
  return od;
}
vec3 tau(vec3 od) { return BR * od.x + BM * 1.1 * od.y + BO * od.z; }
float hg(float c) { const float g = 0.76; return 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + c * c)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }
void main() {
  float az = v_uv.x * PI;
  float vv = (v_uv.y - 0.5) * 2.0;
  float el = sign(vv) * vv * vv * PI * 0.5;
  vec2 s2 = normalize(u_sun.xz + vec2(1e-5, 0.0));
  vec2 p2 = vec2(-s2.y, s2.x);
  vec2 h2 = (s2 * cos(az) + p2 * sin(az)) * cos(el);
  vec3 d = vec3(h2.x, sin(el), h2.y);
  float mu = max(d.y, 0.0015);
  float L = rayToTop(CAMH, mu);
  float cosS = dot(d, u_sun);
  float phR = 3.0 / (16.0 * PI) * (1.0 + cosS * cosS);
  float phM = hg(cosS), phMm = hg(-cosS);
  vec3 od = vec3(0.0);
  vec3 col = vec3(0.0);
  const int N = 16;
  for (int i = 0; i < N; i++) {
    float f0 = float(i) / float(N), f1 = float(i + 1) / float(N);
    float t = L * pow((f0 + f1) * 0.5, 2.0), ds = L * (f1 * f1 - f0 * f0);
    float r = RE + CAMH;
    float y = sqrt(r * r + t * t + 2.0 * r * t * mu) - RE;
    vec3 dens = vec3(exp(-y / HR), exp(-y / HM), ozone(y)) * ds;
    od += dens;
    for (int k = 0; k < 2; k++) {
      float lm = k == 0 ? u_sun.y : -u_sun.y;
      if (lm < -0.1) continue;
      float inten = k == 0 ? u_sunI : u_moonI;
      float pm = k == 0 ? phM : phMm;
      vec3 lod = odepth(y, max(lm, 0.0) + 0.002);
      float kk = clamp((lm + 0.08) / 0.1, 0.0, 1.0);
      vec3 T = exp(-tau(od + lod));
      col += T * (dens.x * BR * (phR + 0.022) + dens.y * BM * (pm + 0.008)) * inten * kk;
    }
  }
  // looking below the horizon: distant ground haze, darker the further down
  if (d.y < 0.0) col *= mix(1.0, 0.35, clamp(-d.y * 4.0, 0.0, 1.0));
  // overcast: the sky turns a flat grey
  float g = dot(col, vec3(0.3, 0.45, 0.25));
  col = mix(col, vec3(g) * vec3(0.92, 0.96, 1.04) * 0.75, u_rain * 0.85);
  o = vec4(col, 1.0);
}`;

export const SKY_FS = HEAD + COMMON + `
uniform mat4 u_invVP;
uniform vec3 u_sunDir;
uniform vec3 u_sunDisc;
uniform vec3 u_moonDisc;
uniform float u_night;
uniform float u_aurora;
uniform float u_moonPhase;
uniform float u_rain;
in vec2 v_ndc;
out vec4 o;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(vec3(i, 1.0)), b = hash(vec3(i + vec2(1, 0), 1.0)), c = hash(vec3(i + vec2(0, 1), 1.0)), d = hash(vec3(i + vec2(1, 1), 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
void main() {
  vec4 p = u_invVP * vec4(v_ndc, 1.0, 1.0);
  vec3 d = normalize(p.xyz / p.w);
  if (u_underwater > 0.5) { o = vec4(outColor(u_fogColor), 1.0); return; }
  if (u_caveFog > 0.99) { o = vec4(outColor(u_fogColor), 1.0); return; }
  vec3 col = skyLUT(d);
  float h = d.y;
  float clear = 1.0 - u_rain * 0.9;
  float above = smoothstep(-0.03, 0.01, h);   // the discs set behind the horizon
  // sun disc with limb darkening, dimmed by the air in front of it
  float sd = dot(d, u_sunDir);
  float r = acos(clamp(sd, -1.0, 1.0)) / 0.0105;
  if (r < 1.0) col += above * u_sunDisc * (1.0 - 0.6 * (1.0 - sqrt(1.0 - r * r))) * clear;
  col += u_sunDisc * 0.004 * exp(-r * 0.9) * clear;
  // moon with phase and a little texture
  vec3 md = -u_sunDir;
  float mdd = dot(d, md);
  float moonMask = 0.0;
  if (mdd > 0.9988 && above > 0.0) {
    vec3 side = normalize(cross(md, vec3(0.0, 1.0, 0.0)) + 1e-4);
    float x = dot(d - md * mdd, side) / 0.049;
    float lit = smoothstep(-0.2, 0.2, x * cos(u_moonPhase * 6.2832) + sin(u_moonPhase * 6.2832) * 0.5);
    float disc = smoothstep(0.9988, 0.99905, mdd);
    vec2 mq = vec2(dot(d - md, side), dot(d - md, cross(side, md))) * 60.0;
    float tex = 0.78 + 0.16 * n2(mq * 1.5) + 0.08 * n2(mq * 4.0);
    // the sunlit part adds to the sky in front of it; the dark part only hides the stars
    moonMask = disc * above;
    col += u_moonDisc * tex * lit * moonMask * clear;
  }
  col += u_moonDisc * 0.02 * pow(max(mdd, 0.0), 120.0) * clear;
  // stars, fading out where the sky is bright
  float skyLum = dot(col, vec3(0.3, 0.5, 0.2));
  float starVis = u_night * clear * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.02, 0.2, skyLum)) * (1.0 - moonMask);
  if (starVis > 0.01) {
    vec3 sp = d * 260.0;
    vec3 cell = floor(sp);
    float rr = hash(cell);
    if (rr > 0.982) {
      vec3 cpos = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5) * 0.6;
      float dd = length(sp - cpos);
      float tw = 0.6 + 0.4 * sin(u_time * (2.0 + rr * 6.0) + rr * 100.0);
      float s = smoothstep(0.42, 0.0, dd) * tw * pow((rr - 0.982) / 0.018, 2.0);
      vec3 sc = mix(vec3(0.7, 0.82, 1.0), vec3(1.0, 0.82, 0.62), hash(cell + 9.0));
      col += sc * s * starVis * 0.9;
    }
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.6, -0.74))) * 3.0, 2.0));
    vec2 bq = vec2(atan(d.z, d.x) * 3.0, d.y * 6.0);
    col += vec3(0.07, 0.065, 0.12) * band * (0.4 + 0.6 * n2(bq * 2.0) * n2(bq * 5.3 + 3.1)) * starVis;
  }
  if (u_aurora > 0.01 && h > 0.02) {
    vec2 q = d.xz / (h + 0.18);
    float a = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float wave = sin(q.x * (1.3 + fi * 0.4) + u_time * 0.12 * (1.0 + fi) + sin(q.y * 0.9 + u_time * 0.07) * 2.0);
      float band = exp(-pow((q.y + wave * 0.6 - 0.8 - fi * 0.55) * 2.2, 2.0));
      a += band * (0.55 + 0.45 * n2(vec2(q.x * 3.0 + fi * 7.0, u_time * 0.25))) * (0.7 + 0.3 * n2(vec2(q.x * 14.0, fi + u_time * 0.6)));
    }
    vec3 ac = mix(vec3(0.15, 1.0, 0.5), vec3(0.6, 0.25, 1.0), clamp(h * 1.8, 0.0, 1.0));
    col += ac * a * u_aurora * 0.09 * smoothstep(0.02, 0.25, h);
  }
  col = mix(col, u_fogColor, u_caveFog);
  o = vec4(outColor(col), 1.0);
}`;

// ---------------------------------------------------------------- volumetric clouds (half res)
export const CLOUD_FS = HEAD + COMMON + `
uniform mat4 u_invVP;
uniform vec3 u_cam;
uniform highp sampler2D u_depth;
uniform sampler3D u_noise3;
uniform float u_cover;
uniform float u_steps;
uniform float u_lo;
uniform float u_hi;
uniform float u_near;
uniform float u_far;
uniform float u_noDepth;
in vec2 v_uv;
in vec2 v_ndc;
out vec4 o;
float density(vec3 p) {
  vec3 w = vec3(u_time * 3.2, 0.0, u_time * 1.1);
  vec3 q = (p + w) * vec3(1.0 / 900.0, 1.0 / 260.0, 1.0 / 900.0);
  float base = texture(u_noise3, q).r * 0.7 + texture(u_noise3, q * 2.3 + 0.3).r * 0.3;
  float h = clamp((p.y - u_lo) / (u_hi - u_lo), 0.0, 1.0);
  float prof = smoothstep(0.0, 0.18, h) * smoothstep(1.0, 0.45, h);
  float d = clamp((base - (1.0 - u_cover)) * 3.2, 0.0, 1.0) * prof;
  if (d > 0.0) d = max(0.0, d - texture(u_noise3, q * 6.0 + vec3(0.0, u_time * 0.004, 0.0)).r * 0.22 * (1.0 - d));
  return d;
}
float hg(float c, float g) { return (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }
void main() {
  vec4 pp = u_invVP * vec4(v_ndc, 1.0, 1.0);
  vec3 rd = normalize(pp.xyz / pp.w);
  // distance to the scene along this ray
  float z = u_noDepth > 0.5 ? 1.0 : texture(u_depth, v_uv).r;
  float tScene = 1e9;
  if (z < 0.99999) {
    vec4 sp = u_invVP * vec4(v_ndc, z * 2.0 - 1.0, 1.0);
    tScene = length(sp.xyz / sp.w);
  }
  float y0 = u_cam.y;
  float t0, t1;
  if (abs(rd.y) < 1e-4) { if (y0 < u_lo || y0 > u_hi) { o = vec4(0.0); return; } t0 = 0.0; t1 = 2600.0; }
  else {
    float ta = (u_lo - y0) / rd.y, tb = (u_hi - y0) / rd.y;
    t0 = max(0.0, min(ta, tb)); t1 = max(ta, tb);
  }
  t1 = min(min(t1, tScene), 2800.0);
  if (t1 <= t0) { o = vec4(0.0); return; }
  int n = int(u_steps);
  float dt = (t1 - t0) / float(n);
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float T = 1.0;
  vec3 S = vec3(0.0);
  float cosS = dot(rd, u_lightDir);
  float phase = mix(hg(cosS, 0.6), hg(cosS, -0.2), 0.3) * 4.0 * PI * 0.55 + 0.35;
  for (int i = 0; i < 48; i++) {
    if (i >= n || T < 0.02) break;
    float t = t0 + (float(i) + jitter) * dt;
    vec3 p = u_cam + rd * t;
    float d = density(p);
    if (d < 0.003) continue;
    // light reaching this sample: a short march toward the light
    float ld = 0.0;
    for (int k = 1; k <= 3; k++) ld += density(p + u_lightDir * (float(k) * 14.0));
    float beer = exp(-ld * 0.85) ;
    float powder = 1.0 - exp(-d * 2.2);
    float hgt = clamp((p.y - u_lo) / (u_hi - u_lo), 0.0, 1.0);
    vec3 lit = u_lightCol * beer * mix(0.6, 1.0, powder) * phase + u_ambient * (0.35 + 0.65 * hgt) * 0.9;
    float sigma = d * 0.055;
    float dT = exp(-sigma * dt);
    S += T * (1.0 - dT) * lit;
    T *= dT;
  }
  // haze toward the horizon
  float fade = 1.0 - exp(-max(0.0, t0) * 0.00055);
  vec3 hz = skyLUT(vec3(rd.x, max(rd.y, 0.02), rd.z));
  S = mix(S, hz * (1.0 - T), fade);
  float a = (1.0 - T) * (1.0 - smoothstep(0.75, 1.0, fade));
  vec3 c = S / max(1.0 - T, 1e-4);
  if (u_direct > 0.5) c = outColor(c);
  o = vec4(c * a, a);
}`;

// composite half-res clouds over the scene (premultiplied alpha)
export const CLOUDMIX_FS = HEAD + `
uniform sampler2D u_clouds;
uniform float u_direct;
uniform float u_exposure;
in vec2 v_uv;
out vec4 o;
void main() {
  vec4 c = texture(u_clouds, v_uv);
  o = c;
}`;

// ---------------------------------------------------------------- entities, particles, lines
export const ENTITY_VS = HEAD + FOG_VS + `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_col;
layout(location=3) in vec3 a_uvl;   // u, v, layer (-1 = untextured)
uniform mat4 u_vp;
uniform mat4 u_model;
uniform vec3 u_origin;
uniform mat4 u_shadowVP;
out vec4 v_col;
out vec3 v_uvl;
out vec3 v_rel;
out vec3 v_n;
out vec4 v_shadow;
void main() {
  vec4 wp = u_model * vec4(a_pos, 1.0);
  vec3 n = normalize(mat3(u_model) * a_normal);
  v_n = n;
  v_col = a_col;
  v_uvl = a_uvl;
  v_rel = wp.xyz + u_origin;
  v_shadow = u_shadowVP * vec4(v_rel + n * 0.04, 1.0);
  computeFog(v_rel);
  gl_Position = u_vp * vec4(wp.xyz + u_origin, 1.0);
}`;

export const ENTITY_FS = HEAD + COMMON + FOG_FS + `
uniform sampler2DArray u_tex;
uniform vec4 u_light;      // sky, r, g, b (0..1)
uniform vec4 u_overlay;    // rgb + strength (damage flash)
uniform float u_emissive;
uniform float u_glowMask;
uniform float u_noFog;
in vec4 v_col;
in vec3 v_uvl;
in vec3 v_rel;
in vec3 v_n;
in vec4 v_shadow;
out vec4 o;
void main() {
  vec4 c = v_col;
  float em = u_emissive;
  if (v_uvl.z >= 0.0) {
    vec4 t = texture(u_tex, v_uvl);
    if (t.a < 0.3) discard;
    c.rgb *= t.rgb;
    if (u_glowMask > 0.5 && t.a < 0.985) em = max(em, clamp((1.0 - t.a) * 2.05, 0.0, 1.0));
  }
  if (c.a < 0.05) discard;
  vec3 albedo = toLinear(c.rgb);
  vec3 N = normalize(v_n);
  vec3 col = shade(albedo, N, u_light, 1.0, 0.0, v_shadow);
  // a soft rim keeps creatures readable against dark backgrounds
  float rim = pow(1.0 - abs(dot(N, normalize(-v_rel))), 3.0);
  col += albedo * (u_ambient * u_light.x + u_lightCol * 0.15) * rim * 0.35;
  col = mix(col, albedo * 3.5, em);
  col = mix(col, toLinear(u_overlay.rgb) * 1.5, u_overlay.a);
  if (u_noFog < 0.5) col = applyFog(col);
  o = vec4(outColor(col), c.a);
}`;

export const PARTICLE_VS = HEAD + FOG_VS + `
layout(location=0) in vec3 a_center;  // camera-relative
layout(location=1) in vec2 a_corner;  // -1..1
layout(location=2) in vec4 a_col;
layout(location=3) in vec4 a_uvl;     // u0, v0, size(uv), layer (-1 untextured)
layout(location=4) in vec2 a_sizeEm;  // size, emissive
uniform mat4 u_vp;
uniform vec3 u_right;
uniform vec3 u_up;
out vec4 v_col;
out vec3 v_uv;
out float v_em;
out vec3 v_rel;
void main() {
  vec3 p = a_center + (u_right * a_corner.x + u_up * a_corner.y) * a_sizeEm.x;
  v_col = a_col;
  v_uv = vec3(a_uvl.xy + (a_corner * vec2(0.5, -0.5) + 0.5) * a_uvl.z, a_uvl.w);
  v_em = a_sizeEm.y;
  v_rel = p;
  computeFog(p);
  gl_Position = u_vp * vec4(p, 1.0);
}`;

export const PARTICLE_FS = HEAD + COMMON + FOG_FS + `
uniform sampler2DArray u_tex;
uniform float u_partScale;
in vec4 v_col;
in vec3 v_uv;
in float v_em;
in vec3 v_rel;
out vec4 o;
void main() {
  vec4 c = v_col;
  if (v_uv.z >= 0.0) {
    vec4 t = texture(u_tex, v_uv);
    if (t.a < 0.3) discard;
    c.rgb *= t.rgb;
  } else {
    vec2 q = v_uv.xy * 2.0 - 1.0;
    c.a *= smoothstep(1.0, 0.35, length(q));
  }
  vec3 col = toLinear(c.rgb) * (u_partScale + v_em * 5.0);
  col = applyFog(col);
  o = vec4(outColor(col), c.a);
}`;

export const LINE_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
uniform mat4 u_vp;
uniform vec3 u_origin;
out vec4 v_col;
void main() { v_col = a_col; gl_Position = u_vp * vec4(a_pos + u_origin, 1.0); }`;

export const LINE_FS = `#version 300 es
precision mediump float;
uniform float u_direct;
uniform float u_lineScale;
in vec4 v_col;
out vec4 o;
void main() { o = vec4(u_direct > 0.5 ? v_col.rgb : pow(v_col.rgb, vec3(2.2)) * u_lineScale, v_col.a); }`;

// ---------------------------------------------------------------- post processing
export const BLOOM_PRE_FS = HEAD + `
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_threshold;
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 c = vec3(0.0);
  c += texture(u_src, v_uv + u_texel * vec2(-1, -1)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(1, -1)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(-1, 1)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(1, 1)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = 0.6;
  float soft = clamp(l - u_threshold + k, 0.0, 2.0 * k);
  soft = soft * soft / (4.0 * k + 1e-4);
  float w = max(soft, l - u_threshold) / max(l, 1e-4);
  o = vec4(min(c * w, vec3(60.0)), 1.0);
}`;
export const BLOOM_DOWN_FS = HEAD + `
uniform sampler2D u_src;
uniform vec2 u_texel;
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 t = u_texel;
  vec3 a = texture(u_src, v_uv + t * vec2(-2, 2)).rgb, b = texture(u_src, v_uv + t * vec2(0, 2)).rgb, c = texture(u_src, v_uv + t * vec2(2, 2)).rgb;
  vec3 d = texture(u_src, v_uv + t * vec2(-2, 0)).rgb, e = texture(u_src, v_uv).rgb, f = texture(u_src, v_uv + t * vec2(2, 0)).rgb;
  vec3 g = texture(u_src, v_uv + t * vec2(-2, -2)).rgb, h = texture(u_src, v_uv + t * vec2(0, -2)).rgb, i = texture(u_src, v_uv + t * vec2(2, -2)).rgb;
  vec3 j = texture(u_src, v_uv + t * vec2(-1, 1)).rgb, k = texture(u_src, v_uv + t * vec2(1, 1)).rgb;
  vec3 l = texture(u_src, v_uv + t * vec2(-1, -1)).rgb, m = texture(u_src, v_uv + t * vec2(1, -1)).rgb;
  vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  o = vec4(r, 1.0);
}`;
export const BLOOM_UP_FS = HEAD + `
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_radius;
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 t = u_texel * u_radius;
  vec3 s = texture(u_src, v_uv + t * vec2(-1, 1)).rgb + texture(u_src, v_uv + t * vec2(1, 1)).rgb
         + texture(u_src, v_uv + t * vec2(-1, -1)).rgb + texture(u_src, v_uv + t * vec2(1, -1)).rgb;
  s += (texture(u_src, v_uv + t * vec2(0, 1)).rgb + texture(u_src, v_uv + t * vec2(0, -1)).rgb
      + texture(u_src, v_uv + t * vec2(-1, 0)).rgb + texture(u_src, v_uv + t * vec2(1, 0)).rgb) * 2.0;
  s += texture(u_src, v_uv).rgb * 4.0;
  o = vec4(s / 16.0, 1.0);
}`;

// light shafts: march from each pixel toward the sun on screen, collecting unoccluded sky
export const GODRAYS_FS = HEAD + `
uniform sampler2D u_scene;
uniform highp sampler2D u_depth;
uniform vec2 u_sunUV;
uniform float u_strength;
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 dir = (u_sunUV - v_uv);
  float n = 40.0;
  vec2 stepv = dir / n;
  vec2 uv = v_uv;
  float decay = 1.0, sum = 0.0;
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  uv += stepv * jitter;
  for (int i = 0; i < 40; i++) {
    uv += stepv;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float sky = texture(u_depth, uv).r > 0.99999 ? 1.0 : 0.0;
    vec3 c = texture(u_scene, uv).rgb;
    sum += sky * min(dot(c, vec3(0.33)), 6.0) * decay;
    decay *= 0.965;
  }
  float d = length(v_uv - u_sunUV);
  o = vec4(vec3(sum / n * u_strength * exp(-d * 1.6)), 1.0);
}`;

export const COMPOSITE_FS = HEAD + `
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_rays;
uniform vec3 u_rayColor;
uniform float u_bloomK;
uniform float u_exposure;
uniform float u_underwater;
uniform vec3 u_waterTint;
uniform float u_time;
uniform float u_hurt;
uniform float u_saturation;
uniform float u_contrast;
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 uv = v_uv;
  if (u_underwater > 0.5) uv += vec2(sin(uv.y * 26.0 + u_time * 2.1), cos(uv.x * 22.0 + u_time * 1.7)) * 0.0028;
  vec3 c = texture(u_scene, uv).rgb;
  c += texture(u_bloom, uv).rgb * u_bloomK;
  c += texture(u_rays, uv).r * u_rayColor;
  if (u_underwater > 0.5) {
    float caust = pow(abs(sin(uv.x * 30.0 + u_time * 1.3) * sin(uv.y * 24.0 - u_time * 1.1)), 6.0);
    c = c * u_waterTint + u_waterTint * caust * 0.05;
  }
  c *= u_exposure;
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  c = clamp(c, 0.0, 1.0);
  // grade: a touch of contrast and saturation, warm highlights / cool shadows
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, u_saturation);
  c = mix(c, c * c * (3.0 - 2.0 * c), u_contrast);
  c *= mix(vec3(0.97, 0.99, 1.04), vec3(1.03, 1.0, 0.96), smoothstep(0.2, 0.8, l));
  // vignette and damage pulse
  vec2 q = v_uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.55;
  c = mix(c, vec3(0.6, 0.04, 0.02), u_hurt * smoothstep(0.2, 0.75, length(q)) * 0.6);
  c = pow(c, vec3(1.0 / 2.2));
  // dither against banding
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
}`;

// FXAA 3.11 (quality preset ~12), luma in alpha
export const FXAA_FS = HEAD + `
uniform sampler2D u_src;
uniform vec2 u_texel;
in vec2 v_uv;
out vec4 o;
float L(vec2 p) { return texture(u_src, p).a; }
void main() {
  vec2 uv = v_uv, t = u_texel;
  float lM = L(uv), lN = L(uv + vec2(0, t.y)), lS = L(uv - vec2(0, t.y)), lE = L(uv + vec2(t.x, 0)), lW = L(uv - vec2(t.x, 0));
  float mx = max(lM, max(max(lN, lS), max(lE, lW))), mn = min(lM, min(min(lN, lS), min(lE, lW)));
  float range = mx - mn;
  if (range < max(0.0312, mx * 0.125)) { o = vec4(texture(u_src, uv).rgb, 1.0); return; }
  float lNW = L(uv + vec2(-t.x, t.y)), lNE = L(uv + t), lSW = L(uv - t), lSE = L(uv + vec2(t.x, -t.y));
  float lNS = lN + lS, lWE = lW + lE;
  float edgeH = abs(-2.0 * lW + lNW + lSW) + abs(-2.0 * lM + lNS) * 2.0 + abs(-2.0 * lE + lNE + lSE);
  float edgeV = abs(-2.0 * lS + lSW + lSE) + abs(-2.0 * lM + lWE) * 2.0 + abs(-2.0 * lN + lNW + lNE);
  bool horz = edgeH >= edgeV;
  float l1 = horz ? lS : lW, l2 = horz ? lN : lE;
  float g1 = abs(l1 - lM), g2 = abs(l2 - lM);
  float stepL = horz ? t.y : t.x;
  float gradient, lumaLocal;
  if (g1 >= g2) { stepL = -stepL; gradient = g1; lumaLocal = (l1 + lM) * 0.5; } else { gradient = g2; lumaLocal = (l2 + lM) * 0.5; }
  vec2 cur = uv;
  if (horz) cur.y += stepL * 0.5; else cur.x += stepL * 0.5;
  vec2 off = horz ? vec2(t.x, 0) : vec2(0, t.y);
  vec2 u1 = cur - off, u2 = cur + off;
  float e1 = L(u1) - lumaLocal, e2 = L(u2) - lumaLocal;
  bool r1 = abs(e1) >= gradient * 0.25, r2 = abs(e2) >= gradient * 0.25;
  for (int i = 0; i < 10; i++) {
    if (r1 && r2) break;
    float q = i < 2 ? 1.0 : i < 5 ? 1.5 : i < 8 ? 2.0 : 4.0;
    if (!r1) { u1 -= off * q; e1 = L(u1) - lumaLocal; r1 = abs(e1) >= gradient * 0.25; }
    if (!r2) { u2 += off * q; e2 = L(u2) - lumaLocal; r2 = abs(e2) >= gradient * 0.25; }
  }
  float d1 = horz ? uv.x - u1.x : uv.y - u1.y, d2 = horz ? u2.x - uv.x : u2.y - uv.y;
  bool closer1 = d1 < d2;
  float dist = min(d1, d2), span = d1 + d2;
  float pixOff = -dist / span + 0.5;
  bool smaller = lM < lumaLocal;
  bool correct = ((closer1 ? e1 : e2) < 0.0) != smaller;
  float fo = correct ? pixOff : 0.0;
  float avg = (2.0 * lNS + 2.0 * lWE + lNW + lNE + lSW + lSE) / 12.0;
  float sub = clamp(abs(avg - lM) / range, 0.0, 1.0);
  sub = (-2.0 * sub + 3.0) * sub * sub;
  fo = max(fo, sub * sub * 0.75);
  vec2 fuv = uv;
  if (horz) fuv.y += fo * stepL; else fuv.x += fo * stepL;
  o = vec4(texture(u_src, fuv).rgb, 1.0);
}`;

export const COPY_FS = HEAD + `
uniform sampler2D u_src;
in vec2 v_uv;
out vec4 o;
void main() { o = texture(u_src, v_uv); }`;
