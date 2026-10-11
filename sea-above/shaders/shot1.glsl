// SHOT 1 - "The Drop": a dew drop on a grass blade falls upward; we rise with it
// and pull back until the whole world below, and the sea above it, opens up.
#include "below_render.glsl"
#include "macro.glsl"

vec3 shadeBlade(vec3 ro, vec3 rd, vec3 p) {
    sdBlade(p);
    float bt = gBladeT, bw = gBladeW;
    vec3 n = grad(0, p, 0.000015);
    if (dot(n, rd) > 0.0) n = -n;
    // parallel veins: as colour and as a ripple in the normal
    float vph = bw * 22.0;
    float veins = 0.5 + 0.5 * cos(vph);
    vec3 side = bladeSide();
    n = normalize(n + side * 0.10 * sin(vph));
    float rib = exp(-bw * bw * 30.0);
    vec3 base = mix(vec3(0.045, 0.16, 0.025), vec3(0.09, 0.25, 0.035), veins);
    base = mix(base, vec3(0.20, 0.34, 0.08), rib * 0.5);
    base *= 0.8 + 0.4 * noise2(vec2(bt * 60.0 + gBladeId * 7.0, bw * 2.0));
    base = mix(base, vec3(0.42, 0.34, 0.12), smoothstep(0.82, 1.0, bt) * 0.55);   // dry golden tip
    vec3 sunC = SUN_COL * SUN_I * seaShadow(uP0 + p);
    float NoL = dot(n, SUN);
    vec3 col = base * sunC * max(NoL, 0.0);
    // light through the leaf: strongest at thin edges and looking into the sun
    float edge = smoothstep(0.55, 1.0, abs(bw));
    vec3 transC = mix(vec3(0.30, 0.55, 0.05), vec3(0.75, 0.62, 0.18), smoothstep(0.75, 1.0, bt));
    float into = pow(saturate(dot(rd, SUN)), 4.0);
    col += transC * sunC * (max(-NoL, 0.0) * 0.18 + into * (0.10 + 0.7 * edge)) * (0.5 + 0.5 * veins);
    col += base * seaFill(uP0 + p, n) * 0.8;
    col += sunC * specGGX(n, -rd, SUN, 0.28, 0.04) * 0.7;
    // velvet sheen of fine hairs at grazing angles
    float g = pow(1.0 - abs(dot(n, -rd)), 5.0);
    col += (seaFill(uP0 + p, n) * 0.4 + SUN_COL * 3.0 * into) * g * 0.6;
    // tiny dew beads catching the sun
    vec2 cell = floor(vec2(bt * 90.0, bw * 3.0));
    vec3 hb = hash32(cell + gBladeId * 31.0);
    if (hb.x > 0.86) {
        vec2 f = fract(vec2(bt * 90.0, bw * 3.0)) - 0.5 - (hb.yz - 0.5) * 0.5;
        float bead = smoothstep(0.22, 0.05, length(f * vec2(1.0, 2.2)));
        col += SUN_COL * 18.0 * bead * (0.3 + into);
    }
    return col;
}

vec3 envForDrop(vec3 d) {
    // a cheap version of the world for reflections on the drop
    if (d.y > 0.16) return mix(vec3(0.10, 0.36, 0.42), vec3(0.06, 0.22, 0.32), d.y);
    if (d.y > -0.03) return skyOpen(d) * 0.9;
    return mix(vec3(0.45, 0.38, 0.30), vec3(0.20, 0.48, 0.52), smoothstep(-0.03, -0.3, d.y));
}

vec3 shadeLiquid(vec3 ro, vec3 rd, vec3 p, vec2 px) {
    vec3 n = grad(1, p, 0.000006);
    float cosi = saturate(dot(-rd, n));
    float F = fresnelSchlick(cosi, 0.02);
    vec3 rr = reflect(rd, n);
    vec3 refl = envForDrop(rr);
    refl += SUN_COL * SUN_I * 120.0 * pow(saturate(dot(rr, SUN)), 3000.0);
    vec3 tr = refract(rd, n, 1.0 / 1.333);
    // travel through the drop to the far side
    float s = 0.00002;
    vec3 q = p;
    for (int i = 0; i < 64; i++) {
        q = p + tr * s;
        float d = -sdDrop(q);
        if (d < 0.000002) break;
        s += max(d, 0.000002);
    }
    vec3 n2 = grad(1, q, 0.000006);
    vec3 outd = refract(tr, -n2, 1.333);
    if (dot(outd, outd) < 0.5) {
        // total internal reflection: bounce once more and leave
        vec3 tr2 = reflect(tr, -n2);
        float s2 = 0.00002;
        vec3 q2 = q;
        for (int i = 0; i < 48; i++) {
            q2 = q + tr2 * s2;
            float d = -sdDrop(q2);
            if (d < 0.000002) break;
            s2 += max(d, 0.000002);
        }
        vec3 n3 = grad(1, q2, 0.000006);
        outd = refract(tr2, -n3, 1.333);
        if (dot(outd, outd) < 0.5) outd = reflect(tr2, -n3);
        q = q2;
    }
    float dw;
    vec3 world = renderBelow(uP0 + q + outd * 0.0002, outd, px, dw);
    vec3 col = mix(world * vec3(0.96, 0.99, 1.0), refl, F);
    return col;
}

vec3 renderScene(vec3 ro, vec3 rd, vec2 px, out float depth) {
    initRng(px);
    float best = 1e9;
    int what = -1;
    // macro geometry is traced in the blade's local frame for precision
    vec3 roL = uCamL;
    if (uAperture > 0.0) roL += uCamRot * vec3(uLens * uAperture, 0.0);
    if (uMacro > 0.5) {
        float tb = marchMacro(0, roL, rd, 10.0);
        if (tb > 0.0 && tb < best) { best = tb; what = 0; }
        float td = marchMacro(1, roL, rd, 10.0);
        if (td > 0.0 && td < best) { best = td; what = 1; }
    }
    vec3 nn;
    if (uNearDrops > 0.0) {
        float tn = traceNearDrops(ro, rd, min(best, 10.0), nn);
        if (tn > 0.0 && tn < best) { best = tn; what = 2; }
    }
    if (what == 0) {
        depth = best;
        return shadeBlade(roL, rd, roL + rd * best);
    }
    if (what == 1) {
        depth = best;
        return shadeLiquid(roL, rd, roL + rd * best, px);
    }
    if (what == 2) {
        depth = best;
        return shadeDrop(rd, nn);
    }
    return renderBelow(ro, rd, px, depth);
}
