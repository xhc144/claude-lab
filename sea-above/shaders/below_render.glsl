// ---------------------------------------------------------------------------
// Rendering of the world below: terraces, pools, columns, the hanging sea,
// rising drops and the golden haze. Included by shots that live down here.
// ---------------------------------------------------------------------------
#include "world_below.glsl"

#ifndef DROPS
#define DROPS 1
#endif
uniform float uDropDensity;   // 0..1
uniform float uDropRise;      // metres per second

// is the low sun blocked by the hanging sea for a point p?
float seaShadow(vec3 p) {
    vec2 d = normalize(SUN.xz);
    vec2 o = p.xz - DROP_C;
    float b = dot(o, d), c = dot(o, o) - DROP_R * DROP_R;
    float disc = b * b - c;
    if (disc < 0.0) return 1.0;
    float sExit = -b + sqrt(disc);
    if (sExit < 0.0) return 1.0;
    float yExit = p.y + sExit * SUN.y / length(SUN.xz);
    return smoothstep(CEIL_Y + 20.0, CEIL_Y - 60.0, yExit);
}

float columnShadow(vec3 p) {
    float sh = 1.0;
    vec2 d = normalize(SUN.xz);
    float k = SUN.y / length(SUN.xz);
    for (int i = 0; i < NCOL; i++) {
        vec2 o = p.xz - COLS[i].xy;
        float s = -dot(o, d);
        if (s < 0.0) continue;
        float miss = length(o + d * s);
        float y = p.y + s * k;
        float r = colRadius(COLS[i], y, 0.0) * 0.92;
        sh *= smoothstep(r * 0.75, r * 1.05 + 0.004 * s, miss);
    }
    return sh;
}

float terrShadow(vec3 p, float tcam) {
    float res = 1.0;
    float t = 0.15;
    float lod = lodFor(tcam);
    for (int i = 0; i < 56; i++) {
        vec3 q = p + SUN * t;
        float h = q.y - heightAt(q.xz, lod);
        res = min(res, 70.0 * h / t);
        if (res < 0.005 || q.y > 330.0) break;
        t += clamp(h * 0.7, 0.08 + 0.02 * t, 30.0);
        if (t > 900.0) break;
    }
    return smoothstep(0.0, 1.0, res);
}

vec3 sunLight(vec3 p, float tcam) {
    return SUN_COL * SUN_I * seaShadow(p) * columnShadow(p);
}

// turquoise light falling from the sea above, dappled by caustics
vec3 seaFill(vec3 p, vec3 n) {
    float c = caustic(p.xz * 2.2 + 31.0);
    return vec3(0.42, 0.78, 0.84) * (0.6 + 0.4 * n.y) * (0.8 + 0.45 * c);
}

vec3 stoneAlbedo(vec3 p, float riser, vec3 n) {
    float v = fbm2(p.xz * 0.35, 4);
    vec3 a = mix(vec3(0.86, 0.83, 0.76), vec3(0.94, 0.92, 0.86), v);
    // ochre mineral staining runs down the riser faces
    float stain = riser * smoothstep(0.35, 0.75, noise2(p.xz * vec2(2.5, 2.5) + p.y * 0.8));
    a = mix(a, vec3(0.80, 0.58, 0.38), stain * 0.55);
    // horizontal growth bands
    a *= 0.93 + 0.07 * sin(p.y * 9.0 + 3.0 * noise2(p.xz * 0.5));
    return a;
}

// cheap reflection of the world above a water surface
vec3 reflectAbove(vec3 ro, vec3 rd) {
    int w;
    float tc = marchColumns(ro, rd, 4000.0, w);
    float ts = (rd.y > 0.0) ? (CEIL_Y - ro.y) / rd.y : -1.0;
    vec3 col;
    float tt;
    if (tc > 0.0 && (ts < 0.0 || tc < ts)) {
        vec3 p = ro + rd * tc;
        vec3 n = colNormal(p);
        float F = fresnelSchlick(dot(-rd, n), 0.02);
        col = mix(vec3(0.35, 0.75, 0.78) * 1.1, hazeColor(rd), F) + SUN_COL * 2.0 * pow(saturate(dot(rd, SUN)), 3.0);
        tt = tc;
    } else if (ts > 0.0 && length(ro.xz + rd.xz * ts - DROP_C) < DROP_R - 100.0) {
        vec3 p = ro + rd * ts;
        vec3 tr = refract(rd, vec3(0, 1, 0), 1.0 / 1.333);
        col = seaInterior(p, tr) * 0.98 + landEnv(reflect(rd, vec3(0, -1, 0))) * fresnelSchlick(rd.y, 0.02);
        tt = ts;
    } else {
        col = skyOpen(rd);
        tt = 1e5;
    }
    return applyFog(col, ro, rd, min(tt, 2e4), 0.00012, 0.006);
}

// ------------------------------------------------------------ rising drops
// Drops rise in vertical "lanes" on a 2D grid; each lane carries a stream of
// drops spaced along y. Returns hit distance and normal.
float traceDrops(vec3 ro, vec3 rd, float tmax, out vec3 nrm, out float rad) {
    const float C = 1.6;           // lane spacing (m)
    const float S = 2.3;           // vertical spacing within a lane (m)
    float best = tmax;
    nrm = vec3(0);
    rad = 0.0;
    vec2 pos = floor(ro.xz / C);
    vec2 rdxz = rd.xz;
    vec2 stepv = sign(rdxz);
    vec2 inv = 1.0 / max(abs(rdxz), vec2(1e-6));
    vec2 tNext = (stepv * (pos + max(stepv, 0.0) - ro.xz / C) * C) * inv;
    tNext = max(tNext, vec2(0.0));
    vec2 tDelta = C * inv;
    float tEnter = 0.0;
    for (int i = 0; i < 64; i++) {
        float tExit = min(tNext.x, tNext.y);
        if (tEnter > best || tEnter > 70.0) break;
        vec2 hc = hash22(pos + 17.0);
        if (hc.x < uDropDensity) {
            float y0 = ro.y + rd.y * tEnter, y1 = ro.y + rd.y * min(tExit, best);
            float ylo = min(y0, y1) - 0.05, yhi = max(y0, y1) + 0.05;
            float off = WT * uDropRise + hc.y * S;
            float k0 = floor((ylo - off) / S), k1 = floor((yhi - off) / S);
            for (float k = k0; k <= min(k1, k0 + 6.0); k += 1.0) {
                vec3 hk = hash33(vec3(pos, k));
                float r = 0.004 + 0.006 * hk.z * hk.z;
                vec3 c = vec3((pos.x + 0.2 + 0.6 * hk.x) * C, (k + 0.5) * S + off + (hk.y - 0.5) * 1.2, (pos.y + 0.2 + 0.6 * hk.y) * C);
                vec3 oc = ro - c;
                float b = dot(oc, rd);
                float cc = dot(oc, oc) - r * r;
                float h = b * b - cc;
                if (h > 0.0) {
                    float t = -b - sqrt(h);
                    if (t > 0.05 && t < best) { best = t; nrm = normalize(oc + rd * t); rad = r; }
                }
            }
        }
        tEnter = tExit;
        if (tNext.x < tNext.y) { tNext.x += tDelta.x; pos.x += stepv.x; }
        else { tNext.y += tDelta.y; pos.y += stepv.y; }
    }
    return best < tmax ? best : -1.0;
}

// environment as seen through/off a drop (no geometry, just light)
vec3 dropEnv(vec3 d) {
    if (d.y > 0.12) return mix(vec3(0.30, 0.62, 0.70), vec3(0.20, 0.45, 0.60), d.y) * 1.1;
    if (d.y > -0.02) return skyOpen(d);
    return vec3(0.78, 0.66, 0.52) * 0.8;
}

vec3 shadeDrop(vec3 rd, vec3 n) {
    float F = fresnelSchlick(dot(-rd, n), 0.02);
    vec3 r = reflect(rd, n);
    vec3 t1 = refract(rd, n, 1.0 / 1.333);
    // exit through the far side of a sphere: mirror the entry around the centre
    vec3 n2 = normalize(reflect(-n, t1));
    vec3 t2 = refract(t1, -n2, 1.333);
    if (dot(t2, t2) == 0.0) t2 = reflect(t1, -n2);
    vec3 col = dropEnv(r) * F + dropEnv(t2) * (1.0 - F) * 0.95;
    col += SUN_COL * SUN_I * 40.0 * pow(saturate(dot(r, SUN)), 900.0);
    col += SUN_COL * SUN_I * 6.0 * pow(saturate(dot(t2, SUN)), 200.0);
    return col;
}

// ------------------------------------------------------------ main shading
vec3 shadeColumn(vec3 ro, vec3 rd, vec3 p, vec3 n, int wc) {
    vec3 col;
        vec4 cc = COLS[wc];
        vec2 ax = colAxis(cc, p.y);
        float R = colRadius(cc, p.y, 0.0);
        float cosi = saturate(dot(-rd, n));
        float F = fresnelSchlick(cosi, 0.02);
        vec3 rr = reflect(rd, n);
        vec3 refl = (rr.y > 0.0) ? mix(skyOpen(rr), vec3(0.14, 0.38, 0.46), smoothstep(0.0, 0.12, rr.y)) : landEnv(rr);
        // chord length through the column along the view ray
        vec2 o = ro.xz - ax;
        vec2 d2 = normalize(rd.xz + 1e-6);
        float b = abs(o.x * d2.y - o.y * d2.x);
        float chord = 2.0 * sqrt(max(R * R - b * b, 0.0)) / max(length(rd.xz), 0.2);
        vec3 Tr = exp(-WATER_ABS * chord * 5.0);
        vec3 behind = applyFog(skyOpen(rd), p, rd, 3000.0, 0.00012, 0.005) * Tr;
        float ang = atan(p.z - ax.y, p.x - ax.x);
        float flow = p.y * 0.07 - WT * 2.2 * WAVE_SPEED;
        float streak = noise2(vec2(ang * 8.0, flow)) * 0.55 + noise2(vec2(ang * 21.0, flow * 2.4)) * 0.3 + noise2(vec2(ang * 50.0, flow * 5.0)) * 0.15;
        float baseY = colBase(cc);
        float nearBase = smoothstep(70.0, 0.0, p.y - baseY);
        float foam = smoothstep(0.45, 0.85, streak) * (0.55 + 0.45 * nearBase) + nearBase * 0.5;
        vec3 sunL = SUN_COL * SUN_I * seaShadow(p);
        float back = pow(saturate(dot(rd, SUN)), 3.0);
        vec3 milky = vec3(0.30, 0.66, 0.70) * 0.55 + sunL * (0.05 * saturate(dot(n, SUN) + 0.3) + 0.35 * back * (1.0 - cosi * 0.6));
        vec3 body = mix(behind, milky, 0.45 + 0.4 * foam);
        col = mix(body, refl, F);
        col += foam * (sunL * 0.09 * saturate(dot(n, SUN) * 0.6 + 0.4) + seaFill(p, n) * 0.5);
        col += sunL * 0.9 * specGGX(n, -rd, SUN, 0.10, 0.02);
    return col;
}

vec3 renderBelow(vec3 ro, vec3 rd, vec2 px, out float depth) {
    float tTer = marchTerrain(ro, rd, 9000.0);
    float tWat = marchWater(ro, rd, tTer > 0.0 ? tTer : 30000.0);

    vec3 col;
    float t;
    if (tWat > 0.0) {
        // ---- the liquid body: hanging sea, columns, and the fillets joining them
        t = tWat;
        vec3 p = ro + rd * t;
        float colW;
        int wc;
        sdWater(p, colW, wc);
        vec3 n = waterNormal(p, t, colW);
        col = vec3(0.0);
        if (colW > 0.01) col += colW * shadeColumn(ro, rd, p, n, wc);
        if (colW < 0.99) col += (1.0 - colW) * shadeSeaBelow(p, rd, n, t);
    } else if (tTer > 0.0) {
        // ---- terrain: stone or pool water
        t = tTer;
        vec3 p = ro + rd * t;
        float lod = lodFor(t);
        float wl, riser;
        float sh = stoneH(p.xz, lod, wl, riser);
        vec3 n = terrNormal(p.xz, t);
        bool isWater = wl > sh + 0.002;
        vec3 sunL = sunLight(p, t);
        if (isWater) {
            p.y = wl;
            float depthW = wl - sh;
            bool lake = wl <= LAKE_Y + 0.01;
            // ripples
            vec2 rp = p.xz * (lake ? 0.5 : 2.2);
            float tt = WT * (lake ? 0.6 : 1.1);
            vec3 nw = normalize(vec3(
                (noise2(rp + vec2(tt, 0)) - noise2(rp + vec2(tt + 0.7, 0))) * 0.06,
                1.0,
                (noise2(rp.yx - vec2(0, tt)) - noise2(rp.yx - vec2(0, tt + 0.7))) * 0.06));
            float cosi = saturate(dot(-rd, nw));
            float F = fresnelSchlick(cosi, 0.02);
            vec3 rr = reflect(rd, nw);
            vec3 refl = reflectAbove(p + nw * 0.05, rr);
            // view into the pool: stone floor seen through tinted water
            float path = depthW / max(cosi, 0.15) * 1.3;
            vec3 absorb = lake ? vec3(0.32, 0.075, 0.06) : vec3(0.55, 0.11, 0.075);
            vec3 floorC = stoneAlbedo(p, 0.0, vec3(0, 1, 0)) * (sunL * 0.13 * terrShadow(p, t) + seaFill(p, vec3(0, 1, 0)) * 0.8);
            vec3 scat = (lake ? vec3(0.03, 0.20, 0.24) : vec3(0.08, 0.42, 0.46)) * (sunL * 0.03 + seaFill(p, vec3(0, 1, 0)) * 0.6);
            vec3 T = exp(-absorb * path);
            vec3 inside = floorC * T + scat * (1.0 - T);
            col = mix(inside, refl, F);
#ifdef DEBUG_STONE
            col = vec3(0.0, 0.0, 0.3);
#endif
            col += SUN_COL * SUN_I * 3.0 * specGGX(nw, -rd, SUN, 0.05, 0.02) * terrShadow(p, t);
        } else {
            vec3 alb = stoneAlbedo(p, riser, n);
            if (lod > 0.0) {
                float f = fract(terrBase(p.xz) / STEP);
                float pool = smoothstep(0.28, 0.34, f) * (1.0 - smoothstep(0.74, 0.80, f));
                alb = mix(alb, vec3(0.30, 0.62, 0.68), pool * lod * 0.55);
            }
            float shd = terrShadow(p + n * 0.05, t);
            float dif = saturate(dot(n, SUN) * 0.92 + 0.08);
            // simple AO from the heightfield
            float ao = 0.0;
            for (int k = 1; k <= 4; k++) {
                float hh = 0.35 * float(k);
                vec3 q = p + n * hh;
                ao += (hh - (q.y - heightAt(q.xz, lod))) / float(k * k);
            }
            ao = saturate(1.0 - 0.55 * max(ao, 0.0));
            vec3 lightc = sunL * dif * shd + seaFill(p, n) * ao + vec3(0.55, 0.45, 0.35) * 0.18 * saturate(-n.y + 0.5) * ao;
            col = alb * lightc;
#ifdef DEBUG_STONE
            col = (DEBUG_STONE == 1) ? vec3(shd, ao, dif) : (DEBUG_STONE == 2 ? sunL / 7.0 : (DEBUG_STONE == 3 ? n * 0.5 + 0.5 : vec3(fract(terrBase(p.xz) / STEP), riser, 0.0)));
#endif
            // damp sheen
            col += sunL * shd * 0.2 * specGGX(n, -rd, SUN, 0.35, 0.03);
        }
    } else {
        t = 3e4;
        col = skyOpen(rd);
    }
    // aerial perspective (golden-turquoise haze, thicker low in the valley)
    col = applyFog(col, ro, rd, min(t, 3e4), 0.00006, 0.005);
    // spray mist where the columns leave the ground
    for (int i = 0; i < NCOL; i++) {
        vec4 c = COLS[i];
        vec3 bc = vec3(c.x, colBase(c) + c.z * 0.6, c.y);
        float s = clamp(dot(bc - ro, rd), 0.0, t);
        vec3 q = ro + rd * s - bc;
        q.y *= 1.8;
        float m = exp(-dot(q, q) / sq(c.z * 2.2));
        m *= 0.7 + 0.6 * noise2(vec2(q.x + q.z, q.y * 2.0) * 0.03 + vec2(0.0, -WT * 0.6));
        vec3 mc = hazeColor(rd) * 1.25 + SUN_COL * SUN_I * 0.25 * pow(saturate(dot(rd, SUN)), 4.0);
        col = mix(col, mc, saturate(m * 0.6));
    }

#if DROPS
    if (uDropDensity > 0.0) {
        vec3 dn;
        float dr;
        float td = traceDrops(ro, rd, min(t, 70.0), dn, dr);
        if (td > 0.0) {
            vec3 dc = shadeDrop(rd, dn);
            col = dc;
            t = td;
        }
    }
#endif
    depth = t;
    return col;
}
