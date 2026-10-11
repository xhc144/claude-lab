// ---------------------------------------------------------------------------
// Rendering of the world above: mirror sea, city of stairs, lanterns, moon.
// ---------------------------------------------------------------------------
#include "world_above.glsl"

const vec3 MOONLIGHT = vec3(0.80, 0.84, 0.95);

float seaRipple(vec2 p) {
    float t = uTime;
    float h = 0.06 * sin(dot(p, vec2(0.031, 0.017)) + t * 0.6)
            + 0.04 * sin(dot(p, vec2(-0.023, 0.041)) + t * 0.47)
            + 0.025 * (noise2(p * 0.12 + vec2(t * 0.15, 0.0)) - 0.5)
            + 0.010 * (noise2(p * 0.5 - vec2(0.0, t * 0.3)) - 0.5);
    return h;
}

float gHitMat;   // 0 sea, 1 stone

float mapAbove(vec3 pb) {
    vec3 p = unfold(pb);
    float dc = sdCity(p);
    float ds = p.y - seaRipple(p.xz);
    gHitMat = (dc < ds) ? 1.0 : 0.0;
    return min(dc, ds);
}

vec3 normalAbove(vec3 p, float t) {
    float e = 0.004 + 0.0004 * t;
    vec2 k = vec2(1, -1);
    return normalize(k.xyy * mapAbove(p + k.xyy * e) + k.yyx * mapAbove(p + k.yyx * e) +
                     k.yxy * mapAbove(p + k.yxy * e) + k.xxx * mapAbove(p + k.xxx * e));
}

// march with an accumulated lantern halo
float marchAbove(vec3 ro, vec3 rd, float tmax, int steps, out vec3 glow) {
    float t = 0.05;
    glow = vec3(0.0);
    float stepScale = (uFold > 1e-6) ? 0.6 : 0.85;
    for (int i = 0; i < 400; i++) {
        if (i >= steps) break;
        vec3 p = ro + rd * t;
        float d = mapAbove(p);
        if (uLanterns > 0.0) {
            vec3 lp;
            float ld = lanternField(unfold(p), lp);
            float s = max(d * stepScale, 0.02 * t);
            glow += LANTERN * exp(-ld * 2.4) * 4.5 * min(s, 6.0) * 0.12 * exp(-t * 0.0006);
        }
        if (abs(d) < 0.0015 * t + 0.002) return t;
        if (t > tmax) break;
        t += max(d * stepScale, 0.0008 * t);
    }
    return -1.0;
}

vec3 moonDropShade(vec3 ro, vec3 rd, vec2 hit) {
    vec3 p = ro + rd * hit.x;
    vec3 n = normalize(p - uMoonPos);
    // the surface trembles like a held drop
    n = normalize(n + 0.03 * vec3(sin(p.y * 0.02 + uTime * 0.7), sin(p.z * 0.017 - uTime * 0.6), sin(p.x * 0.019 + uTime * 0.5)));
    float F = fresnelSchlick(dot(-rd, n), 0.02);
    vec3 t1 = refract(rd, n, 1.0 / 1.333);
    vec3 n2 = normalize(reflect(-n, t1));
    vec3 t2 = refract(t1, -n2, 1.333);
    if (dot(t2, t2) == 0.0) t2 = reflect(t1, -n2);
    // inside: the golden world below, seen upside-down
    float y = -t2.y;
    vec3 inner = mix(vec3(1.25, 0.82, 0.48), vec3(0.20, 0.55, 0.62), smoothstep(-0.05, 0.35, y));
    inner = mix(inner, vec3(0.75, 0.62, 0.48), smoothstep(-0.02, -0.25, y));
    inner += vec3(2.5, 1.5, 0.7) * pow(saturate(1.0 - abs(y + 0.03) * 12.0), 3.0);
    vec3 refl = skyAboveNight(reflect(rd, n));
    vec3 col = mix(inner * 1.1, refl, F);
    col += vec3(1.0, 0.9, 0.75) * pow(1.0 - saturate(dot(-rd, n)), 3.0) * 0.6;   // silver limb
    return col;
}

vec3 skyWithMoon(vec3 ro, vec3 rd) {
    vec3 col = skyAboveNight(rd);
    vec2 mh = moonHit(ro, rd);
    if (mh.x > 0.0) return moonDropShade(ro, rd, mh);
    // halo
    vec3 md = normalize(uMoonPos - ro);
    float ang = acos(clamp(dot(rd, md), -1.0, 1.0));
    float ar = asin(clamp(uMoonR / length(uMoonPos - ro), 0.0, 1.0));
    float x = max(ang - ar, 0.0);
    col += vec3(0.55, 0.55, 0.62) * (0.30 * exp(-x * 12.0) + 0.04 * exp(-x * 3.0));
    return col;
}

vec3 stoneShade(vec3 p, vec3 n, vec3 rd, vec3 pf) {
    vec3 alb = vec3(0.70, 0.67, 0.61) * (0.85 + 0.15 * noise3(pf * 0.6));
    vec3 md = normalize(uMoonPos - p);
    float dif = saturate(dot(n, md));
    vec3 col = alb * MOONLIGHT * dif * 0.35;
    col += alb * vec3(0.05, 0.07, 0.13) * (0.6 + 0.4 * n.y);
    // warm light from the nearest lantern
    vec3 lp;
    float ld = lanternField(pf, lp);
    vec3 ldir = normalize(lp - pf);
    // lantern positions live in flat space; use the flat-space normal approx
    col += alb * LANTERN * uLanterns * 26.0 * saturate(dot(n, ldir) * 0.7 + 0.3) / (1.0 + ld * ld * 0.25);
    // reflected glow from the sea below
    col += alb * vec3(0.03, 0.05, 0.08) * saturate(-n.y);
    return col;
}

vec3 renderAbove(vec3 ro, vec3 rd, vec2 px, out float depth) {
    vec3 glow;
    float tmax = 6000.0;
    vec2 mh = moonHit(ro, rd);
    if (mh.x > 0.0) tmax = min(tmax, mh.x);
    float t = marchAbove(ro, rd, tmax, 300, glow);
    vec3 col;
    if (t > 0.0) {
        vec3 p = ro + rd * t;
        mapAbove(p);
        float mat = gHitMat;
        vec3 n = normalAbove(p, t);
        vec3 pf = unfold(p);
        if (mat < 0.5) {
            // ---- mirror sea
            float cosi = saturate(dot(-rd, n));
            float F = fresnelSchlick(cosi, 0.02);
            vec3 rr = reflect(rd, n);
            vec3 rg;
            vec3 ro2 = p + n * 0.05;
            float tm2 = 6000.0;
            vec2 mh2 = moonHit(ro2, rr);
            if (mh2.x > 0.0) tm2 = min(tm2, mh2.x);
            float t2 = marchAbove(ro2, rr, tm2, 160, rg);
            vec3 refl;
            if (t2 > 0.0) {
                vec3 q = ro2 + rr * t2;
                mapAbove(q);
                vec3 n2 = normalAbove(q, t2);
                refl = (gHitMat > 0.5) ? stoneShade(q, n2, rr, unfold(q)) : vec3(0.01, 0.015, 0.03);
                refl = mix(refl, vec3(0.03, 0.04, 0.08), 1.0 - exp(-t2 * 0.0008));
            } else {
                refl = skyWithMoon(ro2, rr);
            }
            refl += rg;
            vec3 deep = vec3(0.004, 0.012, 0.022);
            col = mix(deep, refl, F);
            // warm pools of lantern light on the ripples
            vec3 lp;
            float ld = lanternField(pf, lp);
            col += LANTERN * uLanterns * 0.6 / (1.0 + ld * ld * 0.6) * (0.4 + 0.6 * F);
        } else {
            col = stoneShade(p, n, rd, pf);
        }
        // night mist
        float fog = 1.0 - exp(-t * 0.00022);
        col = mix(col, vec3(0.020, 0.028, 0.055), fog);
        depth = t;
    } else {
        col = skyWithMoon(ro, rd);
        depth = 1e4;
    }
    col += glow * uLanterns;
    return col;
}
