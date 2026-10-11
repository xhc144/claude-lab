// ---------------------------------------------------------------------------
// Macro objects: a grass blade growing from a terrace rim, and the drop of
// water at its tip that falls upward. All sizes in metres (a few millimetres).
// ---------------------------------------------------------------------------

// Everything here lives in a local frame centred on the blade root uP0, so the
// micrometre-scale geometry keeps full float precision. uCamL is the camera
// position in that frame (computed in double precision on the CPU).
uniform float uMacro;       // 1 = macro objects present
uniform vec3  uP0;          // blade root (world)
uniform vec3  uCamL;        // camera position relative to uP0
uniform vec3  uFd;          // blade's forward direction (horizontal)
uniform float uTipDefl;     // vertical deflection of the tip (m)
uniform vec3  uDropC;       // drop centre
uniform vec3  uDropR;       // drop radii
uniform float uNeck;        // radius of the liquid neck joining drop and tip
uniform vec4  uSat;         // satellite droplet: centre, radius
uniform float uNearDrops;   // density of small drops rising near the lens

vec3 bladeSide() { return normalize(cross(uFd, vec3(0, 1, 0))); }

// quadratic Bezier distance (iq): returns (distance, parameter)
vec2 sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
    vec2 a = B - A;
    vec2 b = A - 2.0 * B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;
    float kk = 1.0 / dot(b, b);
    float kx = kk * dot(a, b);
    float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
    float kz = kk * dot(d, a);
    float res, tt;
    float p = ky - kx * kx;
    float p3 = p * p * p;
    float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
    float h = q * q + 4.0 * p3;
    if (h >= 0.0) {
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
        float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
        vec2 q2 = d + (c + b * t) * t;
        res = dot(q2, q2);
        tt = t;
    } else {
        float z = sqrt(-p);
        float v = acos(q / (p * z * 2.0)) / 3.0;
        float m = cos(v);
        float n = sin(v) * 1.732050808;
        vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
        vec2 qx = d + (c + b * t.x) * t.x;
        float dx = dot(qx, qx);
        vec2 qy = d + (c + b * t.y) * t.y;
        float dy = dot(qy, qy);
        if (dx < dy) { res = dx; tt = t.x; } else { res = dy; tt = t.y; }
    }
    return vec2(sqrt(res), tt);
}

// blade control points in its (forward, up) plane
const vec2 BL_A = vec2(0.0, -0.01);
const vec2 BL_B = vec2(0.006, 0.085);
const vec2 BL_C = vec2(0.062, 0.098);

vec3 bladeLocal(vec3 d) {
    return vec3(dot(d, uFd), d.y, dot(d, bladeSide()));
}

vec3 bladeTip() {
    vec2 c = BL_C + vec2(0.0, uTipDefl);
    return uFd * c.x + vec3(0, c.y, 0);
}

float gBladeT;   // curve parameter at the last evaluation
float gBladeW;   // normalised position across the blade
float gBladeId;

float sdBladeOne(vec3 q, vec2 A, vec2 B, vec2 C, float width) {
    vec2 bz = sdBezier(q.xy, A, B, C);
    float t = bz.y;
    float w = width * pow(max(1.0 - t, 0.0), 0.55) * (0.75 + 0.25 * (1.0 - t)) + 0.00004;
    float z = q.z + 0.0006 * sin(t * 3.0);
    float th = 0.00016 + 0.00006 * (1.0 - t);
    gBladeT = t;
    gBladeW = z / w;
    return sdBox2(vec2(bz.x - abs(z) * 0.10, z), vec2(th, w));
}

float sdBlade(vec3 p) {
    vec3 q = bladeLocal(p);
    vec2 C = BL_C + vec2(0.0, uTipDefl);
    vec2 B = BL_B + vec2(0.0, uTipDefl * 0.35);
    float d = sdBladeOne(q, BL_A, B, C, 0.0024);
    float t0 = gBladeT, w0 = gBladeW;
    gBladeId = 0.0;
    // a second blade further back, leaning across behind the drop
    vec3 q1 = q - vec3(0.10, 0.0, 0.035);
    q1.xz *= rot(-1.45);
    float sw = 0.0015 * sin(WT * 0.9);
    float d1 = sdBladeOne(q1, vec2(0.0, -0.01), vec2(0.004, 0.075 + sw), vec2(0.055, 0.112 + sw), 0.0028);
    if (d1 < d) { d = d1; t0 = gBladeT; w0 = gBladeW; gBladeId = 1.0; }
    // and one close to the lens, out of focus
    vec3 q2 = q - vec3(0.042, 0.0, -0.026);
    q2.xz *= rot(1.5);
    float d2 = sdBladeOne(q2, vec2(0.0, -0.01), vec2(0.004, 0.065), vec2(0.03, 0.104), 0.0030);
    if (d2 < d) { d = d2; t0 = gBladeT; w0 = gBladeW; gBladeId = 2.0; }
    gBladeT = t0;
    gBladeW = w0;
    return d;
}

float sdDrop(vec3 p) {
    float d = sdEllipsoid(p - uDropC, uDropR);
    if (uNeck > 0.0) {
        vec3 tip = bladeTip();
        float neck = sdCapsule(p, tip + vec3(0, 0.0004, 0), uDropC, uNeck);
        d = smin(d, neck, uDropR.x * 0.7);
    }
    if (uSat.w > 0.0) d = min(d, length(p - uSat.xyz) - uSat.w);
    return d;
}

vec3 grad(int which, vec3 p, float e) {
    vec2 k = vec2(1, -1);
    if (which == 0)
        return normalize(k.xyy * sdBlade(p + k.xyy * e) + k.yyx * sdBlade(p + k.yyx * e) +
                         k.yxy * sdBlade(p + k.yxy * e) + k.xxx * sdBlade(p + k.xxx * e));
    return normalize(k.xyy * sdDrop(p + k.xyy * e) + k.yyx * sdDrop(p + k.yyx * e) +
                     k.yxy * sdDrop(p + k.yxy * e) + k.xxx * sdDrop(p + k.xxx * e));
}

float marchMacro(int which, vec3 ro, vec3 rd, float tmax) {
    // bounding sphere around the blade/drop region
    vec3 cen = (which == 0) ? vec3(0, 0.05, 0) + uFd * 0.05 : uDropC;
    float rad = (which == 0) ? 0.12 : max(uDropR.y * 3.0, 0.004) + length(uDropC - bladeTip());
    vec3 oc = ro - cen;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - rad * rad;
    float h = b * b - c;
    if (h < 0.0) return -1.0;
    float t = max(-b - sqrt(h), 0.0);
    float t1 = min(-b + sqrt(h), tmax);
    for (int i = 0; i < 160; i++) {
        if (t > t1) break;
        vec3 p = ro + rd * t;
        float d = (which == 0) ? sdBlade(p) : sdDrop(p);
        if (d < 0.000004 + t * 0.00004) return t;
        t += d * 0.9;
    }
    return -1.0;
}

// small drops rising close to the lens (they become bokeh)
float traceNearDrops(vec3 ro, vec3 rd, float tmax, out vec3 nrm) {
    const float C = 0.07, S = 0.11;
    float best = tmax;
    nrm = vec3(0);
    vec2 pos = floor(ro.xz / C);
    vec2 stepv = sign(rd.xz);
    vec2 inv = 1.0 / max(abs(rd.xz), vec2(1e-6));
    vec2 tNext = (stepv * (pos + max(stepv, 0.0) - ro.xz / C) * C) * inv;
    tNext = max(tNext, vec2(0.0));
    vec2 tDelta = C * inv;
    float tEnter = 0.0;
    for (int i = 0; i < 48; i++) {
        float tExit = min(tNext.x, tNext.y);
        if (tEnter > best || tEnter > 1.6) break;
        vec2 hc = hash22(pos + 3.0);
        if (hc.x < uNearDrops) {
            float y0 = ro.y + rd.y * tEnter, y1 = ro.y + rd.y * min(tExit, best);
            float ylo = min(y0, y1) - 0.003, yhi = max(y0, y1) + 0.003;
            float off = uTime * 0.012 + hc.y * S;   // shot time: these drift up even in slow motion
            float k0 = floor((ylo - off) / S), k1 = floor((yhi - off) / S);
            for (float k = k0; k <= min(k1, k0 + 8.0); k += 1.0) {
                vec3 hk = hash33(vec3(pos, k) + 0.5);
                float r = 0.0006 + 0.0012 * hk.z;
                vec3 c = vec3((pos.x + 0.15 + 0.7 * hk.x) * C, (k + 0.5) * S + off + (hk.y - 0.5) * 0.06, (pos.y + 0.15 + 0.7 * hk.y) * C);
                vec3 oc = ro - c;
                float b = dot(oc, rd);
                float h = b * b - (dot(oc, oc) - r * r);
                if (h > 0.0) {
                    float t = -b - sqrt(h);
                    if (t > 0.004 && t < best) { best = t; nrm = normalize(oc + rd * t); }
                }
            }
        }
        tEnter = tExit;
        if (tNext.x < tNext.y) { tNext.x += tDelta.x; pos.x += stepv.x; }
        else { tNext.y += tDelta.y; pos.y += stepv.y; }
    }
    return best < tmax ? best : -1.0;
}
