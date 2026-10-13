// GLSL sources. Positions are camera-relative (the camera sits at the origin) so precision holds
// far from the world origin.

const LIGHTING = `
uniform vec3 u_skyColor;
uniform float u_ambient;
uniform vec3 u_fogColor;
uniform float u_fogNear;
uniform float u_fogFar;
uniform float u_time;
uniform float u_gamma;

float lc(float l) { return l / (2.5 - 1.5 * l); }
vec3 lightColor(vec4 L) {
  vec3 sky = vec3(lc(L.x)) * u_skyColor;
  vec3 blk = vec3(lc(L.y), lc(L.z), lc(L.w)) * vec3(1.18, 1.08, 1.0);
  vec3 c = 1.0 - (1.0 - sky) * (1.0 - blk);
  return max(c, vec3(u_ambient));
}
float faceShade(int f) {
  return f == 2 ? 1.0 : f == 3 ? 0.52 : (f == 0 || f == 1) ? 0.78 : f == 6 ? 0.9 : 0.66;
}
vec3 applyFog(vec3 c, float d) {
  float f = clamp((d - u_fogNear) / max(1.0, u_fogFar - u_fogNear), 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  return mix(c, u_fogColor, f);
}
`;

export const TERRAIN_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 a_pos;
layout(location=1) in vec4 a_uvf;
layout(location=2) in vec4 a_light;
layout(location=3) in vec4 a_tint;
uniform mat4 u_vp;
uniform vec3 u_origin;   // section origin minus camera
uniform vec3 u_secWorld; // section origin in world space (wrapped)
uniform float u_time;
out vec3 v_uv;
out vec4 v_light;
out vec4 v_tint;
out vec3 v_rel;
out vec3 v_world;
flat out int v_face;
flat out int v_flags;
out float v_ao;
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
    p.x += (sin(t * 1.9 + wp.x * 0.7 + wp.z * 0.45) * 0.055 + sin(t * 4.3 + wp.z * 1.3) * 0.015) * w;
    p.z += (cos(t * 1.5 + wp.z * 0.6 + wp.x * 0.35) * 0.045) * w;
  }
  if ((flags & 8) != 0 && face == 2) {
    p.y += (sin(u_time * 1.6 + wp.x * 0.9 + wp.z * 0.5) + sin(u_time * 2.3 - wp.z * 0.8 + wp.x * 0.3)) * 0.025 - 0.06;
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
  gl_Position = u_vp * vec4(p, 1.0);
}`;

export const TERRAIN_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform vec3 u_sunDir;
uniform float u_daylight;
uniform int u_pass;      // 0 opaque/cutout, 1 translucent
uniform float u_underwater;
${LIGHTING}
in vec3 v_uv;
in vec4 v_light;
in vec4 v_tint;
in vec3 v_rel;
in vec3 v_world;
flat in int v_face;
flat in int v_flags;
in float v_ao;
out vec4 o;
void main() {
  vec4 t = texture(u_tex, v_uv);
  if (u_pass == 0 && t.a < 0.3) discard;
  if (u_pass == 1 && t.a < 0.02) discard;
  vec3 c = t.rgb;
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  if (sat < 0.025) c *= v_tint.rgb;
  else if ((v_flags & 32) != 0) c *= v_tint.rgb;
  float emis = 0.0;
  float alpha = t.a;
  if ((v_flags & 64) != 0 && t.a < 0.985) { emis = clamp((1.0 - t.a) * 2.05, 0.0, 1.0); alpha = 1.0; }
  if ((v_flags & 2) != 0) emis = max(emis, 0.85);
  if ((v_flags & 16) != 0) emis = 1.0;
  float aoF = v_ao < 0.5 ? 0.45 : v_ao < 1.5 ? 0.64 : v_ao < 2.5 ? 0.82 : 1.0;
  vec3 L = lightColor(v_light) * faceShade(v_face) * aoF;
  vec3 col = mix(c * L, c * 1.08, emis);
  if ((v_flags & 32) != 0) col = mix(c * L, c * 1.1, 0.35 + 0.65 * (v_tint.g - 0.24) / 0.76);
  float dist = length(v_rel);
  if ((v_flags & 8) != 0) {
    // water: wave normal, sun glint, fresnel
    vec3 wp = v_world;
    float tt = u_time;
    vec3 n = normalize(vec3(
      cos(tt * 1.6 + wp.x * 0.9 + wp.z * 0.5) * 0.09 + cos(tt * 2.3 - wp.z * 0.8 + wp.x * 0.3) * 0.03 + sin(wp.x * 3.1 + tt * 2.7) * 0.02,
      1.0,
      -cos(tt * 2.3 - wp.z * 0.8 + wp.x * 0.3) * 0.08 + cos(wp.z * 2.7 - tt * 2.1) * 0.02));
    if (v_face != 2) n = vec3(0.0, 1.0, 0.0);
    vec3 v = normalize(-v_rel);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 h = normalize(v + u_sunDir);
    float spec = pow(max(dot(n, h), 0.0), 160.0) * u_daylight * smoothstep(0.0, 0.1, u_sunDir.y) * (v_light.x > 0.9 ? 1.0 : 0.0);
    col = mix(col, u_fogColor * lightColor(v_light) * 1.1, fres * 0.45 * (1.0 - u_underwater));
    col += vec3(1.0, 0.95, 0.85) * spec * 1.6;
    alpha = mix(alpha, 0.94, fres * (1.0 - u_underwater));
    alpha = max(alpha, 0.62);
  }
  col = applyFog(col, dist);
  col = pow(col, vec3(u_gamma));
  o = vec4(col, u_pass == 1 ? alpha : 1.0);
}`;

export const SKY_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_ndc;
void main() { v_ndc = a_pos; gl_Position = vec4(a_pos, 0.9999, 1.0); }`;

export const SKY_FS = `#version 300 es
precision highp float;
uniform mat4 u_invVP;
uniform vec3 u_sunDir;
uniform vec3 u_zenith;
uniform vec3 u_horizon;
uniform vec3 u_sunGlow;
uniform float u_night;
uniform float u_time;
uniform float u_aurora;
uniform float u_moonPhase;
uniform float u_rain;
uniform float u_gamma;
uniform float u_underwater;
uniform vec3 u_fogColor;
in vec2 v_ndc;
out vec4 o;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(vec3(i, 1.0)), b = hash(vec3(i + vec2(1, 0), 1.0)), c = hash(vec3(i + vec2(0, 1), 1.0)), d = hash(vec3(i + vec2(1, 1), 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
void main() {
  vec4 p = u_invVP * vec4(v_ndc, 1.0, 1.0);
  vec3 d = normalize(p.xyz / p.w);
  float h = d.y;
  vec3 col = mix(u_horizon, u_zenith, pow(clamp(h, 0.0, 1.0), 0.5));
  if (h < 0.0) col = mix(u_horizon, u_horizon * vec3(0.55, 0.6, 0.7), clamp(-h * 2.5, 0.0, 1.0));
  // the band near the horizon fades into the fog colour so distant terrain melts into the sky
  col = mix(u_fogColor, col, smoothstep(-0.02, 0.22, h));
  float sd = dot(d, u_sunDir);
  // sunrise / sunset glow around the sun
  col += u_sunGlow * pow(max(sd, 0.0), 6.0) * 0.75 * (1.0 - clamp(h * 1.5, 0.0, 1.0));
  col += u_sunGlow * pow(max(sd, 0.0), 40.0) * 0.5;
  // sun disc
  float sun = smoothstep(0.99935, 0.99965, sd);
  col = mix(col, vec3(1.0, 0.97, 0.88) * 1.4, sun * (1.0 - u_rain * 0.85) * step(-0.05, h));
  // moon
  vec3 md = -u_sunDir;
  float mdd = dot(d, md);
  if (mdd > 0.9990) {
    vec3 side = normalize(cross(md, vec3(0.0, 1.0, 0.0)) + 1e-4);
    float x = dot(d - md * mdd, side) / 0.045;
    float lit = smoothstep(-0.2, 0.2, x * cos(u_moonPhase * 6.2832) + sin(u_moonPhase * 6.2832) * 0.5 + 0.5 - 0.5);
    float disc = smoothstep(0.9990, 0.9993, mdd);
    vec3 mc = mix(vec3(0.18, 0.2, 0.28), vec3(0.92, 0.94, 1.0), max(lit, 0.08));
    vec2 mq = vec2(dot(d - md, side), dot(d - md, cross(side, md))) * 60.0;
    mc *= 0.86 + 0.14 * n2(mq * 1.5) + 0.06 * n2(mq * 4.0);
    col = mix(col, mc, disc * (1.0 - u_rain * 0.8));
  }
  col += vec3(0.5, 0.6, 0.9) * pow(max(mdd, 0.0), 300.0) * 0.25 * u_night;
  // stars
  if (u_night > 0.01 && h > 0.0) {
    vec3 sp = d * 220.0;
    vec3 cell = floor(sp);
    float r = hash(cell);
    if (r > 0.985) {
      vec3 cpos = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5) * 0.6;
      float dd = length(sp - cpos);
      float tw = 0.65 + 0.35 * sin(u_time * (2.0 + r * 6.0) + r * 100.0);
      float s = smoothstep(0.45, 0.0, dd) * tw * (r - 0.985) / 0.015;
      vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash(cell + 9.0));
      col += sc * s * u_night * (1.0 - u_rain) * smoothstep(0.0, 0.15, h);
    }
    // a faint band of stardust
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.6, -0.74))) * 3.2, 2.0));
    vec2 bq = vec2(atan(d.z, d.x) * 3.0, d.y * 6.0);
    col += vec3(0.32, 0.28, 0.5) * band * (0.55 + 0.45 * n2(bq * 2.0)) * 0.09 * u_night * (1.0 - u_rain);
  }
  // aurora curtains
  if (u_aurora > 0.01 && h > 0.02) {
    vec2 q = d.xz / (h + 0.18);
    float a = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float wave = sin(q.x * (1.3 + fi * 0.4) + u_time * 0.12 * (1.0 + fi) + sin(q.y * 0.9 + u_time * 0.07) * 2.0);
      float band = exp(-pow((q.y + wave * 0.6 - 0.8 - fi * 0.55) * 2.2, 2.0));
      a += band * (0.55 + 0.45 * n2(vec2(q.x * 3.0 + fi * 7.0, u_time * 0.25)));
    }
    vec3 ac = mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.3, 1.0), clamp(h * 1.8, 0.0, 1.0));
    col += ac * a * u_aurora * 0.55 * smoothstep(0.02, 0.25, h);
  }
  if (u_underwater > 0.5) col = u_fogColor;
  col = pow(col, vec3(u_gamma));
  o = vec4(col, 1.0);
}`;

export const CLOUD_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
uniform mat4 u_vp;
uniform vec3 u_cam;
uniform float u_cloudY;
uniform float u_extent;
out vec3 v_rel;
out vec2 v_world;
void main() {
  vec3 rel = vec3(a_pos.x * u_extent, u_cloudY - u_cam.y, a_pos.y * u_extent);
  v_rel = rel;
  v_world = rel.xz + u_cam.xz;
  gl_Position = u_vp * vec4(rel, 1.0);
}`;

export const CLOUD_FS = `#version 300 es
precision highp float;
uniform sampler2D u_noise;
uniform float u_time;
uniform float u_cover;
uniform vec3 u_cloudLit;
uniform vec3 u_cloudShade;
uniform vec3 u_fogColor;
uniform float u_extent;
uniform float u_gamma;
in vec3 v_rel;
in vec2 v_world;
out vec4 o;
void main() {
  vec2 w = v_world + vec2(u_time * 2.2, u_time * 0.7);
  float n = texture(u_noise, w / 900.0).r * 0.62 + texture(u_noise, w / 330.0 + 0.37).r * 0.28 + texture(u_noise, w / 120.0 + 0.71).r * 0.10;
  float a = smoothstep(u_cover, u_cover + 0.16, n);
  if (a < 0.01) discard;
  float thick = smoothstep(u_cover, u_cover + 0.4, n);
  vec3 c = mix(u_cloudLit, u_cloudShade, thick * 0.65);
  float d = length(v_rel.xz);
  float elev = abs(v_rel.y) / max(1.0, length(v_rel));
  float fade = (1.0 - smoothstep(u_extent * 0.6, u_extent * 0.98, d)) * smoothstep(0.015, 0.22, elev);
  c = mix(c, u_fogColor, (1.0 - smoothstep(0.03, 0.35, elev)) * 0.75);
  c = pow(c, vec3(u_gamma));
  o = vec4(c, a * fade * 0.9);
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
in vec4 v_col;
out vec4 o;
void main() { o = v_col; }`;

// Entities / items / particles: per-vertex colour (and optional texture layer), lit by uniform light.
export const ENTITY_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_col;
layout(location=3) in vec3 a_uvl;   // u, v, layer (-1 = untextured)
uniform mat4 u_vp;
uniform mat4 u_model;
uniform vec3 u_origin;
out vec4 v_col;
out vec3 v_uvl;
out vec3 v_rel;
out float v_shade;
void main() {
  vec4 wp = u_model * vec4(a_pos, 1.0);
  vec3 n = normalize(mat3(u_model) * a_normal);
  v_shade = 0.62 + 0.38 * max(0.0, n.y) + 0.14 * abs(n.x) - 0.1 * max(0.0, -n.y);
  v_col = a_col;
  v_uvl = a_uvl;
  v_rel = wp.xyz + u_origin;
  gl_Position = u_vp * vec4(wp.xyz + u_origin, 1.0);
}`;

export const ENTITY_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform vec4 u_light;      // sky, r, g, b (0..1)
uniform vec4 u_overlay;    // rgb + strength (damage flash)
uniform float u_emissive;
uniform float u_glowMask;
${LIGHTING}
in vec4 v_col;
in vec3 v_uvl;
in vec3 v_rel;
in float v_shade;
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
  vec3 L = lightColor(u_light) * v_shade;
  vec3 col = mix(c.rgb * L, c.rgb * 1.05, em);
  col = mix(col, u_overlay.rgb, u_overlay.a);
  col = applyFog(col, length(v_rel));
  col = pow(col, vec3(u_gamma));
  o = vec4(col, c.a);
}`;

export const PARTICLE_VS = `#version 300 es
precision highp float;
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
  gl_Position = u_vp * vec4(p, 1.0);
}`;

export const PARTICLE_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
${LIGHTING}
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
  vec3 col = c.rgb;
  col = applyFog(col, length(v_rel));
  col = pow(col, vec3(u_gamma));
  o = vec4(col, c.a);
}`;

export const POST_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;
