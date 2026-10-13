// ---------------------------------------------------------------------------
// Inside the hanging sea. Light wells up from the bright world below; above
// it is already night. Whales, rising light shafts, bubbles, and two
// surfaces seen from within (each a Snell's window onto a different world).
// ---------------------------------------------------------------------------

uniform float uBubbles;      // density of the bubble burst after the plunge
uniform vec3  uBubbleC;      // where the burst is centred
uniform vec3  uBubbleOffset; // bubbles are dragged along with the camera at first

const float UW_SIG = 0.0065;  // extinction per metre

// ambient light at height y inside the water
vec3 uwAmbient(float y) {
    float h = (y - CEIL_Y) / (CEIL_TOP - CEIL_Y);
    vec3 day = vec3(0.16, 0.62, 0.66) * 2.2;
    vec3 gold = vec3(1.0, 0.62, 0.30) * 1.6;
    vec3 night = vec3(0.006, 0.02, 0.05);
    return night + day * exp(-h * 2.7) + gold * exp(-h * 9.0);
}

// what the bottom surface lets through when looked at from inside: the world below
vec3 belowEnv(vec3 d) {
    float az = max(dot(normalize(d.xz + 1e-5), normalize(SUN.xz)), 0.0);
    vec3 land = mix(vec3(0.55, 0.60, 0.52), vec3(1.4, 0.95, 0.55), pow(az, 4.0));
    land *= 0.8 + 0.4 * noise2(d.xz / max(-d.y, 0.1) * 3.0);
    vec3 col = mix(land, hazeColor(d) * 1.5, smoothstep(-0.35, -0.02, d.y));
    col += SUN_COL * 6.0 * pow(saturate(dot(normalize(vec3(d.x, -d.y, d.z)), SUN)), 60.0);
    return col * 1.1;
}

// the night sky above, seen through the top surface (moon glow, lanterns on the water)
vec3 nightEnv(vec3 d) {
    vec3 col = mix(vec3(0.03, 0.04, 0.09), vec3(0.004, 0.008, 0.025), saturate(d.y * 1.5));
    vec3 md = normalize(vec3(0.0, 0.14, -1.0));
    float m = dot(d, md);
    col += vec3(0.9, 0.85, 0.75) * smoothstep(0.9965, 0.9975, m) * 3.0;
    col += vec3(0.25, 0.25, 0.32) * pow(max(m, 0.0), 40.0);
    // warm lantern lights near the horizon of the window
    vec2 g = d.xz / max(d.y, 0.05) * 6.0;
    vec2 id = floor(g);
    vec3 h = hash32(id);
    if (h.x > 0.82) {
        vec2 c = id + 0.5 + (h.yz - 0.5) * 0.6;
        float lp = smoothstep(0.25, 0.0, length(g - c));
        col += vec3(1.0, 0.55, 0.22) * lp * 4.0 * smoothstep(0.7, 0.15, d.y);
    }
    return col;
}

float uwTopWaves(vec2 p) {
    return 0.25 * sin(dot(p, vec2(0.05, 0.03)) + WT * 0.6) + 0.15 * sin(dot(p, vec2(-0.03, 0.06)) + WT * 0.5)
         + 0.4 * (noise2(p * 0.04 + WT * 0.05) - 0.5);
}

// bubbles: a burst of air around the point of entry, rising fast
float traceBubbles(vec3 ro, vec3 rd, float tmax, out vec3 nrm) {
    const float C = 0.9, S = 0.7;
    float best = tmax;
    nrm = vec3(0);
    vec2 pos = floor(ro.xz / C);
    vec2 stepv = sign(rd.xz);
    vec2 inv = 1.0 / max(abs(rd.xz), vec2(1e-6));
    vec2 tNext = (stepv * (pos + max(stepv, 0.0) - ro.xz / C) * C) * inv;
    tNext = max(tNext, vec2(0.0));
    vec2 tDelta = C * inv;
    float tEnter = 0.0;
    for (int i = 0; i < 40; i++) {
        float tExit = min(tNext.x, tNext.y);
        if (tEnter > best || tEnter > 30.0) break;
        vec2 cc = (pos + 0.5) * C;
        float dens = uBubbles * exp(-dot(cc - uBubbleC.xz, cc - uBubbleC.xz) / 900.0);
        vec2 hc = hash22(pos + 9.0);
        if (hc.x < dens) {
            float y0 = ro.y + rd.y * tEnter, y1 = ro.y + rd.y * min(tExit, best);
            float ylo = min(y0, y1) - 0.1, yhi = max(y0, y1) + 0.1;
            float off = uTime * (1.6 + 1.4 * hc.y) + hc.y * S;
            float k0 = floor((ylo - off) / S), k1 = floor((yhi - off) / S);
            for (float k = k0; k <= min(k1, k0 + 6.0); k += 1.0) {
                vec3 hk = hash33(vec3(pos, k) + 2.0);
                float r = 0.012 + 0.05 * hk.z * hk.z;
                float wob = 0.08 * sin(uTime * 9.0 + hk.x * 30.0);
                vec3 hj = hash33(vec3(k, pos) + 7.3);
                vec3 c = vec3((pos.x + 0.15 + 0.7 * hj.x) * C + wob, (k + 0.1 + 0.8 * hj.y) * S + off, (pos.y + 0.15 + 0.7 * hj.z) * C);
                vec3 oc = ro - c;
                float b = dot(oc, rd);
                float h = b * b - (dot(oc, oc) - r * r);
                if (h > 0.0) {
                    float t = -b - sqrt(h);
                    if (t > 0.05 && t < best) { best = t; nrm = normalize(oc + rd * t); }
                }
            }
        }
        tEnter = tExit;
        if (tNext.x < tNext.y) { tNext.x += tDelta.x; pos.x += stepv.x; }
        else { tNext.y += tDelta.y; pos.y += stepv.y; }
    }
    return best < tmax ? best : -1.0;
}

float marchWhalesUW(vec3 ro, vec3 rd, float tmax) {
    float t = 0.5;
    for (int i = 0; i < 160; i++) {
        vec3 p = ro + rd * t;
        float d = sdWhales(p);
        if (d < 0.004 * t + 0.01) return t;
        t += d * 0.85;
        if (t > tmax) break;
    }
    return -1.0;
}

vec3 whaleNormal(vec3 p, float t) {
    float e = 0.02 + 0.0005 * t;
    vec2 k = vec2(1, -1);
    return normalize(k.xyy * sdWhales(p + k.xyy * e) + k.yyx * sdWhales(p + k.yyx * e) +
                     k.yxy * sdWhales(p + k.yxy * e) + k.xxx * sdWhales(p + k.xxx * e));
}

// light shafts rising from the bright underside, integrated along the ray
vec3 uwInscatter(vec3 ro, vec3 rd, float t, out float T) {
    const int N = 14;
    float L = min(t, 520.0);
    vec3 acc = vec3(0.0);
    float j = hash12(gl_FragCoord.xy + uSeed * 7.0);
    float ph = 0.45 + 1.4 * pow(saturate(-rd.y), 2.0);      // light travels upward
    for (int i = 0; i < N; i++) {
        float s = L * (float(i) + j) / float(N);
        vec3 p = ro + rd * s;
        float hb = max(p.y - CEIL_Y, 0.0);
        // shafts lean slightly away from the low sun
        vec2 base = p.xz - normalize(SUN.xz) * hb * 0.18;
        float beam = caustic(base * 1.4);
        float beamFade = exp(-hb / 140.0);
        vec3 amb = uwAmbient(p.y);
        acc += (amb * (0.55 + 1.8 * beam * beamFade) * ph) * exp(-UW_SIG * s) * (L / float(N));
    }
    T = exp(-UW_SIG * t);
    return acc * UW_SIG;
}

vec3 renderUnderwater(vec3 ro, vec3 rd, vec2 px, out float depth) {
    // surfaces
    float tb = (rd.y < 0.0) ? (ro.y - (CEIL_Y - 4.0)) / -rd.y : 1e9;   // bottom (approx)
    if (tb < 0.05) tb = 1e9;
    float tt = (rd.y > 0.0) ? (CEIL_TOP - ro.y) / rd.y : 1e9;           // top
    float tsurf = min(tb, tt);
    float tw = marchWhalesUW(ro, rd, min(tsurf, 700.0));
    vec3 col;
    float t;
    if (tw > 0.0) {
        t = tw;
        vec3 p = ro + rd * t;
        vec3 n = whaleNormal(p, t);
        sdWhales(p);
        float fin = gWhaleMat;
        // countershading: dark back, pale belly, white fins
        float belly = smoothstep(0.25, -0.45, n.y);
        vec3 alb = mix(vec3(0.035, 0.045, 0.055), vec3(0.42, 0.45, 0.46), belly);
        alb = mix(alb, vec3(0.70, 0.72, 0.70), fin);
        alb *= 0.85 + 0.3 * noise3(p * 0.35);
        vec3 amb = uwAmbient(p.y);
        vec3 lit = amb * (0.25 + 1.6 * saturate(-n.y * 0.7 + 0.3)) * (0.7 + 0.6 * caustic(p.xz * 1.4));
        col = alb * lit;
        // a cool rim where the body turns away
        col += amb * 0.25 * pow(1.0 - saturate(dot(n, -rd)), 3.0);
    } else if (tsurf < 1e8) {
        t = tsurf;
        vec3 p = ro + rd * t;
        if (tb < tt) {
            // the underside, from within: a window down to the golden world
            vec2 g = vec2(ceilWaves(p.xz + 0.7) - ceilWaves(p.xz - vec2(0.7, 0.0)),
                          ceilWaves(p.xz + vec2(0.0, 0.7)) - ceilWaves(p.xz - vec2(0.0, 0.7))) / 1.4;
            vec3 n = normalize(vec3(g.x, 1.0, g.y));       // facing up into the water
            vec3 tr = refract(rd, n, 1.333);
            vec3 rr = reflect(rd, n);
            float F = (dot(tr, tr) > 0.0) ? fresnelSchlick(dot(-rd, n), 0.02) : 1.0;
            vec3 below = (dot(tr, tr) > 0.0) ? belowEnv(tr) : vec3(0.0);
            col = mix(below, uwAmbient(p.y + 30.0) * 1.2, F);
        } else {
            vec2 g = vec2(uwTopWaves(p.xz + 0.5) - uwTopWaves(p.xz - vec2(0.5, 0.0)),
                          uwTopWaves(p.xz + vec2(0.0, 0.5)) - uwTopWaves(p.xz - vec2(0.0, 0.5)));
            vec3 n = normalize(vec3(g.x, -1.0, g.y));      // facing down into the water
            vec3 tr = refract(rd, n, 1.333);
            float F = (dot(tr, tr) > 0.0) ? fresnelSchlick(dot(-rd, n), 0.02) : 1.0;
            // outside Snell's window the surface mirrors the glowing depths
            vec3 mirror = uwAmbient(CEIL_TOP - 160.0) * 0.6;
            col = mix((dot(tr, tr) > 0.0) ? nightEnv(tr) : vec3(0.0), mirror, F);
        }
    } else {
        t = 2000.0;
        col = uwAmbient(ro.y) * 0.4;
    }
    float T;
    vec3 ins = uwInscatter(ro, rd, t, T);
    col = col * T + ins;
    // bubbles in front of everything
    if (uBubbles > 0.0) {
        vec3 bn;
        float tbub = traceBubbles(ro - uBubbleOffset, rd, min(t, 30.0), bn);
        if (tbub > 0.0) {
            float edge = pow(1.0 - saturate(dot(bn, -rd)), 1.5);
            vec3 env = uwAmbient(ro.y - 40.0) * 1.6;
            col = mix(col * 0.9, env * (0.5 + 2.5 * edge), 0.35 + 0.65 * edge);
            t = tbub;
        }
    }
    depth = t;
    return col;
}
