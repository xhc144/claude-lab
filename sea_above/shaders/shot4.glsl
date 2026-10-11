// SHOT 4 - "The Other Shore": the night side of the hanging sea; the world folds.
#define MOON_HOLDS_WORLD 1
#include "below_render.glsl"
#include "above_render.glsl"

// just below the surface during the breach: a Snell's window onto the night
vec3 renderBreachUnder(vec3 ro, vec3 rd, vec2 px, out float depth) {
    vec3 deep = vec3(0.004, 0.016, 0.03);
    if (rd.y <= 0.02) { depth = 50.0; return deep; }
    float t = (seaRipple(ro.xz) - ro.y) / rd.y;
    vec3 p = ro + rd * t;
    vec2 e = vec2(0.2, 0.0);
    vec3 n = normalize(vec3(seaRipple(p.xz + e.xy) - seaRipple(p.xz - e.xy), -2.0 * e.x,
                            seaRipple(p.xz + e.yx) - seaRipple(p.xz - e.yx)));   // facing down
    vec3 tr = refract(rd, n, 1.333);
    vec3 col;
    float d2;
    if (dot(tr, tr) > 0.0) {
        float F = fresnelSchlick(dot(-rd, n), 0.02);
        col = mix(renderAbove(p + tr * 0.02, tr, px, d2), deep * 3.0, F);
    } else {
        col = deep * 2.0;
    }
    col = mix(deep, col, exp(-t * 0.25));
    depth = t;
    return col;
}

vec3 renderScene(vec3 ro, vec3 rd, vec2 px, out float depth) {
    initRng(px);
    if (uFold < 1e-6 && ro.y < seaRipple(ro.xz)) return renderBreachUnder(ro, rd, px, depth);
    return renderAbove(ro, rd, px, depth);
}
