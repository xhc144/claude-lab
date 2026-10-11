// ---------------------------------------------------------------------------
// THE WORLD BELOW: travertine terraces under a sea that hangs in the sky.
// Units are metres, y is up. The hanging sea is a colossal flattened drop of
// water; a low sun shines in through the gap between land and sea.
// ---------------------------------------------------------------------------
#include "common.glsl"

// world clock (lets a shot run the world in slow motion)
uniform float uWorldTime;
#define WT uWorldTime

const vec3  SUN      = normalize(vec3(0.48, 0.125, -1.0));
const vec3  SUN_COL  = vec3(1.00, 0.60, 0.30);
const float SUN_I    = 6.5;
const float CEIL_Y   = 420.0;    // underside of the hanging sea
const float CEIL_TOP = 720.0;    // its upper surface
const vec2  DROP_C   = vec2(300.0, 3800.0);
const float DROP_R   = 6000.0;
const float EDGE_R   = 150.0;
const float LAKE_Y   = -40.0;
const float STEP     = 2.8;      // terrace riser height
const vec3  WATER_ABS = vec3(0.0105, 0.0029, 0.0021);   // magic-clear water

#ifndef WAVE_SPEED
#define WAVE_SPEED 1.0
#endif

// water columns flowing up into the sea: x, z, radius, phase
const int NCOL = 5;
const vec4 COLS[NCOL] = vec4[](
    vec4(-210.0, -1250.0, 30.0, 0.0),
    vec4( 620.0, -1750.0, 44.0, 1.7),
    vec4(-1250.0, -1950.0, 58.0, 3.1),
    vec4(1550.0, -1000.0, 24.0, 4.6),
    vec4(-2500.0, -700.0, 40.0, 2.2));

// ------------------------------------------------------------ sky & haze
float cloudLayer(vec3 rd) {
    // thin luminous streaks low in the open sky
    if (rd.y < -0.01) return 0.0;
    vec2 uv = rd.xz / (rd.y + 0.06);
    uv *= vec2(0.9, 2.6);
    float n = fbm2(uv * 0.9 + vec2(WT * 0.004, 0.0), 6);
    float band = smoothstep(0.0, 0.03, rd.y) * smoothstep(0.30, 0.05, rd.y);
    return smoothstep(0.48, 0.80, n) * band;
}

vec3 skyOpen(vec3 rd) {
    float y = rd.y;
    float sd = max(dot(rd, SUN), 0.0);
    float az = max(dot(normalize(rd.xz), normalize(SUN.xz)), 0.0);
    vec3 zen = vec3(0.55, 0.62, 0.80);
    vec3 horWarm = vec3(4.2, 2.3, 0.95);
    vec3 horCool = vec3(2.3, 1.45, 0.85);
    vec3 hor = mix(horCool, horWarm, pow(az, 3.0));
    vec3 col = mix(hor, zen, pow(saturate(y * 2.4 + 0.01), 0.6));
    col += SUN_COL * (1.2 * pow(sd, 5.0) + 3.5 * pow(sd, 50.0) + 12.0 * pow(sd, 700.0));
    // clouds: dark undersides away from the sun, burning gold near it
    float c = cloudLayer(rd);
    vec3 cc = mix(vec3(1.3, 0.80, 0.62), vec3(6.0, 3.3, 1.5), pow(az, 6.0)) * (0.8 + 1.5 * pow(sd, 30.0));
    col = mix(col, cc, c * 0.8);
    col += SUN_COL * 1400.0 * smoothstep(0.99990, 0.99995, sd) * (1.0 - c * 0.7);   // the disc
    col = mix(col, vec3(0.70, 0.50, 0.38), smoothstep(0.0, -0.05, y));
    return col;
}

vec3 hazeColor(vec3 rd) {
    float sd = max(dot(rd, SUN), 0.0);
    vec3 base = vec3(0.42, 0.50, 0.50);
    vec3 warm = vec3(1.6, 1.0, 0.55);
    return mix(base, warm, 0.18 + 0.82 * pow(sd, 4.0)) + SUN_COL * 2.0 * pow(sd, 30.0);
}

// height-dependent exponential fog (analytic integral) plus a low valley mist
vec3 applyFog(vec3 col, vec3 ro, vec3 rd, float t, float density, float falloff) {
    float a = density * exp(-falloff * (ro.y - LAKE_Y));
    float b = falloff * rd.y;
    float fogAmt = (abs(b) > 1e-5) ? a * (1.0 - exp(-b * t)) / b : a * t;
    float a2 = 0.0006 * exp(-0.045 * (ro.y - LAKE_Y));
    float b2 = 0.045 * rd.y;
    fogAmt += (abs(b2) > 1e-5) ? a2 * (1.0 - exp(-b2 * t)) / b2 : a2 * t;
    float T = exp(-fogAmt);
    return col * T + hazeColor(rd) * (1.0 - T);
}

// ------------------------------------------------------------ terrain
float terrBaseSmooth(vec2 p) {
    float z = p.y;
    float u = clamp(-z / 1150.0, 0.0, 1.0);
    float h = 55.0 - 95.0 * mix(u, u * u * (3.0 - 2.0 * u), 0.3);    // terraced slope down to the lake
    h += 0.06 * max(z, 0.0);
    h -= 30.0 * exp(-sq((z + 1450.0) / 520.0)) * exp(-sq((p.x + 150.0) / 1500.0));   // lake basin
    h += 70.0 * smoothstep(-1750.0, -3600.0, z);                     // far shore
    h += 80.0 * smoothstep(650.0, 2600.0, abs(p.x - 100.0));         // valley walls
    float ridge = 1.0 - abs(2.0 * fbm2(p / 2600.0 + 7.3, 5) - 1.0);
    h += smoothstep(-4500.0, -9000.0, z) * (180.0 + 520.0 * ridge * ridge);   // mountains
    h += 14.0 * (fbm2(p / 520.0, 5) - 0.5);
    h += 3.0 * (fbm2(p / 110.0 + 1.7, 3) - 0.5);
    return h;
}

// large-scale terrain can be baked into textures (see engine/bake.py)
#ifdef BAKED_TERRAIN
uniform sampler2D uHNear;
uniform vec4 uHNearBox;    // x0, z0, 1/width, 1/depth
uniform sampler2D uHFar;
uniform vec4 uHFarBox;
float terrBaseLarge(vec2 p) {
    vec2 u = (p - uHNearBox.xy) * uHNearBox.zw;
    if (u.x > 0.001 && u.y > 0.001 && u.x < 0.999 && u.y < 0.999) return texture(uHNear, u).r;
    return texture(uHFar, (p - uHFarBox.xy) * uHFarBox.zw).r;
}
#else
float terrBaseLarge(vec2 p) { return terrBaseSmooth(p); }
#endif

float terrBase(vec2 p) {
    return terrBaseLarge(p) + 0.9 * (noise2(p * 0.11) - 0.5);       // scalloped terrace edges
}

// heightfield of stone and pool water; lod in [0,1] fades terraces with distance
float stoneH(vec2 p, float lod, out float water, out float riser) {
    float h = terrBase(p);
    float hs = h / STEP;
    float L = floor(hs), f = hs - L;
    const float lipH = 0.42, depth = 0.5;
    float s1 = smoothstep(0.15, 0.30, f);
    float s2 = smoothstep(0.80, 0.995, f);
    float st = L * STEP + lipH * (1.0 - s1) * (1.0 - 0.6 * f) - depth * s1 * (1.0 - s2) + (STEP + lipH) * s2;
    // travertine drapery: xz noise on steep faces reads as vertical curtains
    float dr = noise2(p * vec2(1.3, 1.1)) * 0.5 + noise2(p * 3.1) * 0.25;
    riser = s2 * (1.0 - s2) * 4.0;
    st += (dr - 0.4) * 0.6 * riser;
    st += (noise2(p * 0.7) - 0.5) * 0.10;
    water = L * STEP + lipH * 0.55;
    st = mix(st, h, lod);
    water = mix(water, -1e4, smoothstep(0.0, 0.7, lod));
    water = max(water, LAKE_Y);
    return st;
}

float heightAt(vec2 p, float lod) {
    float w, r;
    float s = stoneH(p, lod, w, r);
    return max(s, w);
}

float lodFor(float t) { return smoothstep(320.0, 1300.0, t); }

// ray-march the heightfield; returns t or -1
float marchTerrain(vec3 ro, vec3 rd, float tmax) {
    float t = 0.3;
    const float TOPH = 760.0;
    if (rd.y < 0.0 && ro.y > TOPH) t = max(t, (ro.y - TOPH) / -rd.y);
    float lastT = t;
    for (int i = 0; i < 300; i++) {
        vec3 p = ro + rd * t;
        float d = p.y - heightAt(p.xz, lodFor(t));
        if (d < 0.0) {
            float a = lastT, b = t;
            for (int k = 0; k < 7; k++) {
                float m = 0.5 * (a + b);
                vec3 q = ro + rd * m;
                if (q.y - heightAt(q.xz, lodFor(m)) < 0.0) b = m; else a = m;
            }
            return 0.5 * (a + b);
        }
        if (t > tmax || (p.y > TOPH && rd.y > 0.0)) break;
        lastT = t;
        t += max(d * 0.4, 0.006 * t + 0.02);
    }
    return -1.0;
}

vec3 terrNormal(vec2 p, float t) {
    float lod = lodFor(t);
    float e = 0.02 + 0.0012 * t;
    float w, r;
    float hc = stoneH(p, lod, w, r);
    float hx = stoneH(p + vec2(e, 0), lod, w, r);
    float hz = stoneH(p + vec2(0, e), lod, w, r);
    return normalize(vec3(hc - hx, e, hc - hz));
}

// ------------------------------------------------------------ columns
vec2 colAxis(vec4 c, float y) {
    // a gentle sway so the columns read as moving water, not pillars
    return c.xy + vec2(9.0 * sin(y * 0.0062 + c.w + WT * 0.11), 7.0 * sin(y * 0.0049 + c.w * 1.3 - WT * 0.09));
}

float colBase(vec4 c) { return max(terrBase(c.xy), LAKE_Y); }

float colRadius(vec4 c, float y, float ang) {
    float base = colBase(c);
    float u = saturate((y - base) / (CEIL_Y - base));
    // liquid-bridge profile: necked in the middle, flaring into lake and sea
    float r = c.z * (0.72 + 0.55 * sq(2.0 * u - 1.0));
    r *= 1.0 + 1.2 * exp(-max(y - base, 0.0) / 18.0);              // splash skirt
    r *= 1.0 + 0.05 * sin(ang * 3.0 + y * 0.021 - WT * 1.6 * WAVE_SPEED + c.w)
             + 0.03 * sin(ang * 7.0 - y * 0.05 - WT * 2.3 * WAVE_SPEED + c.w * 2.0);
    return r;
}

float sdColumns(vec3 p, out int which) {
    float d = 1e9;
    which = -1;
    for (int i = 0; i < NCOL; i++) {
        vec4 c = COLS[i];
        vec2 q = p.xz - colAxis(c, p.y);
        float ang = atan(q.y, q.x);
        float dd = (length(q) - colRadius(c, p.y, ang)) * 0.6;
        if (dd < d) { d = dd; which = i; }
    }
    return d;
}

float marchColumns(vec3 ro, vec3 rd, float tmax, out int which) {
    which = -1;
    bool any = false;
    for (int i = 0; i < NCOL; i++) {
        vec2 o = ro.xz - COLS[i].xy;
        vec2 dd = normalize(rd.xz + 1e-6);
        float tc = -dot(o, dd);
        float miss = length(o + dd * max(tc, 0.0));
        if (miss < COLS[i].z * 4.6 + 40.0) any = true;
    }
    if (!any) return -1.0;
    float t = 0.5;
    for (int i = 0; i < 160; i++) {
        vec3 p = ro + rd * t;
        int w;
        float d = sdColumns(p, w);
        if (d < 0.002 * t) { which = w; return t; }
        if (t > tmax || p.y > CEIL_Y + 40.0) break;
        t += max(d, 0.002 * t);
    }
    return -1.0;
}

vec3 colNormal(vec3 p) {
    vec2 e = vec2(0.05, 0.0);
    int w;
    return normalize(vec3(sdColumns(p + e.xyy, w) - sdColumns(p - e.xyy, w),
                          sdColumns(p + e.yxy, w) - sdColumns(p - e.yxy, w),
                          sdColumns(p + e.yyx, w) - sdColumns(p - e.yyx, w)));
}

// ------------------------------------------------------------ the hanging sea
float ceilWaves(vec2 p) {
    float t = WT * WAVE_SPEED;
    float h = 0.0;
    // long swells
    h += 6.0 * (0.5 + 0.5 * sin(dot(p, vec2(0.020, 0.011)) + t * 0.32));
    h += 4.0 * (0.5 + 0.5 * sin(dot(p, vec2(-0.012, 0.024)) + t * 0.27 + 1.3));
    // chop: sharp hanging crests
    float a = 2.4, f = 0.018;
    vec2 d = vec2(0.8, 0.6);
    for (int i = 0; i < 3; i++) {
        vec2 q = p * f + d * t * 0.18 * (1.0 + 0.4 * float(i));
        float n = noise2(q);
        n = 1.0 - abs(2.0 * n - 1.0);
        h += a * n * n;
        p = M2 * p;
        a *= 0.45; f *= 2.1;
    }
    return h;
}

float sdSea(vec3 p) {
    vec2 q = p.xz - DROP_C;
    float rr = length(q) - (DROP_R - EDGE_R);
    float cy = 0.5 * (CEIL_Y + CEIL_TOP), hy = 0.5 * (CEIL_TOP - CEIL_Y);
    float yy = abs(p.y - cy) - (hy - EDGE_R);
    float d = length(max(vec2(rr, yy), 0.0)) + min(max(rr, yy), 0.0) - EDGE_R;
    float wv = (p.y < cy) ? ceilWaves(p.xz) * smoothstep(0.0, -500.0, rr) : 0.0;
    return d - wv;
}

// the sea and its columns as one liquid body, joined by a smooth fillet
float sdWater(vec3 p, out float colW, out int which) {
    float ds = sdSea(p);
    float dc = sdColumns(p, which);
    const float k = 90.0;
    float h = clamp(0.5 + 0.5 * (dc - ds) / k, 0.0, 1.0);
    colW = 1.0 - h;
    return mix(dc, ds, h) - k * h * (1.0 - h) * 0.6;
}
float sdWater(vec3 p) { float w; int i; return sdWater(p, w, i); }

bool rayNearColumns(vec3 ro, vec3 rd) {
    for (int i = 0; i < NCOL; i++) {
        vec2 o = ro.xz - COLS[i].xy;
        vec2 dd = normalize(rd.xz + 1e-6);
        float tc = -dot(o, dd);
        float miss = length(o + dd * max(tc, 0.0));
        if (miss < COLS[i].z * 3.0 + 60.0) return true;
    }
    return false;
}

float marchWater(vec3 ro, vec3 rd, float tmax) {
    bool nearC = rayNearColumns(ro, rd);
    float t = 0.3;
    if (!nearC) {
        if (rd.y <= 0.0 && ro.y < CEIL_Y - 20.0) return -1.0;
        if (rd.y > 0.0 && ro.y < CEIL_Y - 16.0) t = (CEIL_Y - 16.0 - ro.y) / rd.y;
    }
    for (int i = 0; i < 200; i++) {
        vec3 p = ro + rd * t;
        float d = sdWater(p);
        if (d < 0.01 + 0.0006 * t) return t;
        if (t > tmax) break;
        t += d * 0.75;
    }
    return -1.0;
}

vec3 waterNormal(vec3 p, float t, float colW) {
    float e = mix(1.2 + 0.002 * t, 0.05 + 0.0006 * t, colW);
    vec2 k = vec2(1, -1);
    return normalize(k.xyy * sdWater(p + k.xyy * e) + k.yyx * sdWater(p + k.yyx * e) +
                     k.yxy * sdWater(p + k.yxy * e) + k.xxx * sdWater(p + k.xxx * e));
}

// caustic web (light focused by the waves on the top surface)
float caustic(vec2 p) {
    float t = WT * 0.30 * WAVE_SPEED;
    vec2 a = voronoi2(p * 0.020 + vec2(t * 0.6, t * 0.3));
    vec2 b = voronoi2(p * 0.034 * M2 - vec2(t * 0.4, -t * 0.5));
    float c = pow(1.0 - saturate((a.y - a.x) * 2.4), 5.0) + 0.7 * pow(1.0 - saturate((b.y - b.x) * 2.4), 5.0);
    return c;
}

// what the underside of the sea reflects: the land and the low sun glow
vec3 landEnv(vec3 rd) {
    float az = max(dot(normalize(rd.xz + 1e-5), normalize(SUN.xz)), 0.0);
    vec3 land = mix(vec3(0.42, 0.40, 0.36), vec3(0.95, 0.66, 0.40), pow(az, 4.0));
    vec3 col = mix(land, hazeColor(rd) * 1.1, smoothstep(-0.30, -0.01, rd.y));
    return col;
}

// sky above the sea, seen from inside the water looking up
vec3 skyAbove(vec3 rd) {
    float sd = max(dot(rd, SUN), 0.0);
    vec3 col = mix(vec3(0.95, 0.70, 0.50), vec3(0.16, 0.28, 0.58), saturate(rd.y * 1.8));
    col += SUN_COL * (0.8 * pow(sd, 8.0));
    return col;
}

// whales swimming inside the hanging sea
uniform vec4 uWhale0;   // x, y, z, heading
uniform vec4 uWhale1;
uniform vec4 uWhale2;

#include "whale.glsl"

float sdWhales(vec3 p) {
    float d = whaleScene(p, uWhale0, 80.0, WT * 0.9);
    d = min(d, whaleScene(p, uWhale1, 55.0, WT * 0.9 + 2.0));
    d = min(d, whaleScene(p, uWhale2, 40.0, WT * 0.9 + 4.0));
    return d;
}

// light inside the hanging sea along a refracted ray: transmitted sky, shafts, whales
vec3 seaInterior(vec3 p, vec3 tr) {
    float L = (CEIL_TOP - p.y) / max(tr.y, 0.06);
    L = min(L, 3000.0);
    float hitW = -1.0;
    float s = 0.0;
    for (int i = 0; i < 40; i++) {
        float d = sdWhales(p + tr * s);
        if (d < 0.5) { hitW = s; break; }
        s += max(d, 2.0);
        if (s > min(L, 1000.0)) break;
    }
    float pathL = (hitW > 0.0) ? hitW : L;
    vec3 att = exp(-WATER_ABS * pathL);
    vec3 sunW = normalize(vec3(SUN.x, 0.9, SUN.z));          // toward the light, inside the water
    float ph = 0.18 + 1.8 * pow(saturate(dot(tr, sunW)), 6.0);
    vec3 glowCol = vec3(0.10, 0.42, 0.50);
    // light shafts: the caustic pattern of the top surface projected along the light
    float shafts = 0.0;
    float span = min(pathL, 500.0);
    float j = hash12(gl_FragCoord.xy + uSeed);
    for (int i = 0; i < 6; i++) {
        float u = (float(i) + j) / 6.0;
        vec3 q = p + tr * span * u;
        vec3 top = q + sunW * ((CEIL_TOP - q.y) / max(sunW.y, 0.1));
        shafts += caustic(top.xz);
    }
    shafts /= 6.0;
    vec3 inscat = glowCol * ph * (1.0 - att) * (0.6 + 1.6 * shafts);
    vec3 col;
    if (hitW > 0.0) {
        col = vec3(0.02, 0.05, 0.06) * att + inscat * 0.8;
    } else {
        vec3 exitDir = refract(tr, vec3(0, -1, 0), 1.333);
        vec3 sky = (dot(exitDir, exitDir) > 0.0) ? skyAbove(exitDir) : glowCol * 0.3;
        float c = caustic((p + tr * L).xz);
        col = sky * att * (0.55 + 0.9 * c) + inscat;
    }
    return col;
}

vec3 shadeSeaBelow(vec3 p, vec3 rd, vec3 n, float t) {
    float cosi = saturate(dot(-rd, n));
    float F = fresnelSchlick(cosi, 0.02);
    vec3 refl = landEnv(reflect(rd, n));
    vec3 tr = refract(rd, n, 1.0 / 1.333);
    vec3 inner = (dot(tr, tr) > 0.0) ? seaInterior(p, tr) : refl;
    vec3 col = mix(inner, refl, F);
    // golden light catching the hanging wave faces that look toward the sun
    col += SUN_COL * SUN_I * 0.5 * specGGX(n, -rd, SUN, 0.14, 0.02);
    col += SUN_COL * 0.10 * saturate(dot(n, SUN) * 4.0);
    // the rounded rim burns where the low sun shines through it
    float rim = smoothstep(-600.0, -40.0, length(p.xz - DROP_C) - DROP_R);
    float fw = pow(max(dot(rd, SUN), 0.0), 3.0);
    col += vec3(1.3, 0.95, 0.55) * rim * (0.6 + 4.0 * fw);
    return col;
}
