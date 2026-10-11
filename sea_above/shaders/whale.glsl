// ---------------------------------------------------------------------------
// A humpback whale. Local frame: head toward +z, back toward +y, length ~2
// units (tail flukes at z = -1, snout at z = +1). `phase` drives the swim.
// ---------------------------------------------------------------------------

float gWhaleMat;   // 0 body, 1 pectoral fin / white parts

// 2D tapered capsule between points a and b with radii ra, rb
float sdUnevenCapsule2(vec2 p, float r1, float r2, float h);
float sdSegCapsule2(vec2 p, vec2 a, vec2 b, float ra, float rb) {
    vec2 dir = b - a;
    float h = length(dir);
    dir /= h;
    vec2 q = p - a;
    return sdUnevenCapsule2(vec2(dir.y * q.x - dir.x * q.y, dot(q, dir)), ra, rb, h);
}

// 2D capsule along +y with radius r1 at y=0 and r2 at y=h (iq)
float sdUnevenCapsule2(vec2 p, float r1, float r2, float h) {
    p.x = abs(p.x);
    float b = (r1 - r2) / h;
    float a = sqrt(1.0 - b * b);
    float k = dot(p, vec2(-b, a));
    if (k < 0.0) return length(p) - r1;
    if (k > a * h) return length(p - vec2(0.0, h)) - r2;
    return dot(p, vec2(a, b)) - r1;
}

float whaleRadius(float z) {
    float u = clamp((z + 0.86) / 1.82, 0.0, 1.0);          // tail stock -> snout
    return 0.40 * pow(u, 0.85) * pow(1.0 - u, 0.42) + 0.012;
}

float sdWhale(vec3 p, float phase) {
    gWhaleMat = 0.0;
    // swimming: a wave travels down the body, growing toward the tail
    float env = smoothstep(0.4, -1.0, p.z);
    p.y -= 0.075 * env * env * sin(phase - p.z * 2.2);
    // body: a revolved profile, flatter on top of the head, deeper throat
    float r = whaleRadius(p.z);
    vec2 cs = p.xy;
    cs.y *= (p.y > 0.0) ? 1.0 + 0.35 * smoothstep(0.2, 0.8, p.z) : 0.92;
    cs.x *= 1.05;
    float d = (length(cs) - r) * 0.8;
    d = max(d, max(-(p.z + 0.90), p.z - 0.975));          // cap the profile
    // tubercles on the head, pleats under the throat
    float pleat = smoothstep(0.0, -0.06, p.y) * smoothstep(0.0, 0.25, p.z) * smoothstep(0.95, 0.55, p.z);
    d += 0.0035 * pleat * sin(atan(p.x, -p.y) * 42.0);
    float knob = smoothstep(0.5, 0.75, p.z) * smoothstep(0.02, 0.08, p.y);
    d -= 0.004 * knob * smoothstep(0.55, 0.8, noise3(p * 60.0));
    // dorsal hump and small fin
    d = smin(d, sdEllipsoid(p - vec3(0.0, whaleRadius(-0.32) * 0.95, -0.32), vec3(0.012, 0.035, 0.07)), 0.03);
    // flukes: a broad swept wing, notched at the centre
    vec3 f = p - vec3(0.0, 0.0, -0.90);
    f.y -= 0.10 * sin(phase - 0.90 * 2.2 - 0.6);
    f.yz *= rot(0.28 * cos(phase - 2.6));
    vec2 fx = vec2(abs(f.x), f.z);
    float fl2 = sdSegCapsule2(fx, vec2(0.0, 0.0), vec2(0.30, -0.13), 0.08, 0.022);
    fl2 = max(fl2, -(length(fx - vec2(0.0, -0.085)) - 0.04));      // notch
    float flth = 0.013 * (1.0 - 0.55 * saturate(fx.x / 0.3));
    float fl = max(fl2, abs(f.y) - (clamp(-fl2, 0.0, 0.05) * 0.3 + 0.003)) * 0.8;
    d = smin(d, fl, 0.025);
    // long white pectoral fins with a scalloped leading edge
    vec3 q = vec3(abs(p.x), p.y, p.z);
    vec3 A = vec3(0.115, -0.075, 0.40);
    float flap = 0.22 * sin(phase * 0.5 + 1.0);
    vec3 dirF = normalize(vec3(0.86, -0.30 - flap, -0.42));
    vec3 chord = normalize(vec3(0.0, 0.0, 1.0) - dirF * dirF.z);
    vec3 nrmF = cross(dirF, chord);
    vec3 rq = q - A;
    float u = dot(rq, dirF), v = dot(rq, chord), w = dot(rq, nrmF);
    float fin2 = sdUnevenCapsule2(vec2(v, u), 0.085, 0.028, 0.60);
    float along = saturate(u / 0.6);
    fin2 -= 0.007 * smoothstep(0.0, 0.02, v) * (0.5 + 0.5 * sin(along * 55.0)) * along;
    // lens-shaped cross-section: thick along the middle, thin at the edges, gently curved
    w -= 0.03 * along * along;
    float fin = max(fin2, abs(w) - (clamp(-fin2, 0.0, 0.05) * 0.32 + 0.0025)) * 0.8;
    if (fin < d + 0.008) gWhaleMat = 1.0;
    d = smin(d, fin, 0.03);
    return d;
}

float whaleScene(vec3 p, vec4 w, float scale, float phase) {
    vec3 q = p - w.xyz;
    q.xz *= rot(-w.w);
    q /= scale;
    return sdWhale(q, phase) * scale;
}
