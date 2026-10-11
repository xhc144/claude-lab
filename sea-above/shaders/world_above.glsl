// ---------------------------------------------------------------------------
// THE WORLD ABOVE: the top of the hanging sea at nightfall. A mirror-calm
// ocean, a city of stairs that ignores gravity, and an enormous moon that is
// really a drop of water. The whole world can fold up into a cylinder.
// Local coordinates: sea level y = 0, the moon lies toward -z.
// ---------------------------------------------------------------------------
#include "common.glsl"

uniform float uFold;        // curvature 1/R of the world (0 = flat)
uniform float uLanterns;    // 0..1 lantern brightness
uniform vec3  uMoonPos;     // centre of the moon-drop
uniform float uMoonR;       // its radius
uniform float uDusk;        // 0 = deep night, 1 = afterglow
uniform float uSeaLanterns; // fraction of sea cells holding a lantern

const vec3 CITY_C = vec3(150.0, 0.0, -430.0);
const float SEA_END = -2800.0;   // the sea ends here; beyond lies open sky
const vec3 LANTERN = vec3(1.0, 0.56, 0.24);

// ------------------------------------------------------------ fold
// Map bent space to flat space: the floor y=0 rolls up into a cylinder of
// radius R around the axis (x=0, y=R), running along z.
vec3 unfold(vec3 p) {
    if (uFold < 1e-6) return p;
    float R = 1.0 / uFold;
    vec2 q = p.xy - vec2(0.0, R);
    float r = length(q);
    float th = atan(q.x, -q.y);
    return vec3(R * th, R - r, p.z);
}

// ------------------------------------------------------------ sky
vec3 starField(vec3 rd) {
    vec3 q = rd * 260.0;
    vec3 id = floor(q);
    vec3 h = hash33(id);
    if (h.x < 0.955) return vec3(0.0);
    vec3 c = id + 0.25 + 0.5 * hash33(id + 7.0);
    float d = length(q - c);
    float b = pow((h.x - 0.955) / 0.045, 6.0) * 14.0 + 0.25;
    float tw = 0.8 + 0.2 * sin(uTime * (1.5 + 3.0 * h.z) + h.y * 30.0);
    vec3 sc = mix(vec3(0.72, 0.80, 1.0), vec3(1.0, 0.86, 0.70), h.z);
    return sc * b * tw * smoothstep(0.22, 0.0, d);
}

vec3 skyAboveNight(vec3 rd) {
    float y = rd.y;
    vec3 zen = vec3(0.006, 0.012, 0.035);
    vec3 hor = vec3(0.05, 0.07, 0.14);
    vec3 col = mix(hor, zen, pow(saturate(y * 1.6 + 0.02), 0.6));
    // the last of the afterglow, behind the camera's right shoulder
    vec3 gd = normalize(vec3(0.7, 0.0, 0.7));
    float g = pow(max(dot(normalize(vec3(rd.x, 0.0, rd.z)), gd), 0.0), 3.0);
    col += vec3(0.55, 0.22, 0.10) * g * exp(-max(y, 0.0) * 9.0) * uDusk;
    // milky way: a tilted band of dust and faint stars
    vec3 band = normalize(vec3(0.35, 0.82, -0.45));
    float bd = abs(dot(rd, band));
    float mw = exp(-bd * bd * 30.0) * (0.4 + 0.8 * fbm3(rd * 6.0, 5));
    float dust = smoothstep(0.45, 0.75, fbm3(rd * 11.0 + 3.0, 4));
    col += vec3(0.10, 0.11, 0.16) * mw * (1.0 - 0.7 * dust);
    col += starField(rd) * smoothstep(-0.02, 0.08, y) * (1.0 - 0.6 * uDusk * g);
    return col;
}

// ------------------------------------------------------------ city of stairs
float sdStairs2(vec2 p, float w, float h, float n) {
    // a flight of n floating steps in 2D: x along the run, y up, tread w, riser h
    float i = clamp(floor(p.x / w), 0.0, n - 1.0);
    float d = 1e9;
    for (int k = -1; k <= 1; k++) {
        float j = clamp(i + float(k), 0.0, n - 1.0);
        d = min(d, sdBox2(p - vec2((j + 0.5) * w, j * h), vec2(w * 0.5, h * 1.25)));
    }
    return d;
}

float sdArchWall(vec3 p, vec3 size, float archW, float archH) {
    // a wall slab with a round arch punched through it (local, centred)
    float wall = sdBox(p, size);
    vec3 q = p;
    float hole = min(sdBox(q - vec3(0.0, -size.y + archH * 0.5, 0.0), vec3(archW, archH * 0.5, size.z + 1.0)),
                     length(q.xy - vec2(0.0, -size.y + archH)) - archW);
    return max(wall, -hole);
}

// polar repetition around y
vec2 pmod(vec2 p, float n, out float id) {
    float a = atan(p.y, p.x);
    float s = TAU / n;
    id = floor(a / s + 0.5);
    a -= id * s;
    return length(p) * vec2(cos(a), sin(a));
}

// material ids: 1 stone, 2 window glow, 3 lantern
float gMat;

float sdTower(vec3 p, float r, float h, float tiers, float seed) {
    if (abs(p.x) > r + 14.0 || abs(p.z) > r + 14.0 || p.y > h + 40.0) return max(sdBox(p - vec3(0, h * 0.5, 0), vec3(r + 10.0, h * 0.5 + 30.0, r + 10.0)), 2.0);
    float th = h / tiers;
    float d = 1e9;
    // hollow arcaded drum, tier by tier
    float ty = clamp(floor(p.y / th), 0.0, tiers - 1.0);
    float rr = r * (1.0 - 0.06 * ty);
    vec3 q = p - vec3(0.0, (ty + 0.5) * th, 0.0);
    float drum = abs(length(q.xz) - rr) - 1.2;
    drum = max(drum, abs(q.y) - th * 0.5);
    float id;
    vec2 a = pmod(q.xz, 8.0, id);
    vec3 aq = vec3(a.y, q.y, a.x - rr);
    float archW = rr * 0.26;
    float hole = min(sdBox(aq - vec3(0, -th * 0.5 + th * 0.32, 0), vec3(archW, th * 0.32, 4.0)),
                     length(aq.xy - vec2(0, -th * 0.5 + th * 0.64)) - archW);
    drum = max(drum, -hole);
    // cornice at each tier
    float corn = max(abs(length(q.xz) - rr) - 2.2, abs(q.y - th * 0.5 + 0.6) - 0.6);
    d = min(drum, corn);
    // floor discs
    d = min(d, max(length(q.xz) - rr, abs(q.y + th * 0.5) - 0.5));
    // a dome and needle on top
    vec3 tp = p - vec3(0.0, h, 0.0);
    float rt = r * (1.0 - 0.06 * (tiers - 1.0));
    d = min(d, max(length(tp) - rt * 0.95, -tp.y));
    d = min(d, sdCapsule(tp, vec3(0.0), vec3(0.0, rt * 1.9 + 8.0, 0.0), 0.6));
    return d;
}

// a helical stair winding around a tower axis
float sdHelixStair(vec3 p, float R, float pitch, float y0, float y1) {
    float a = atan(p.z, p.x);
    float u = (p.y - y0) / pitch - a / TAU;
    float k = floor(u + 0.5);
    float yh = y0 + (k + a / TAU) * pitch;
    float ang = a + k * TAU;
    // quantise into steps along the arc
    float stepA = 0.09;
    float sa = floor(ang / stepA);
    float ys = y0 + (sa * stepA / TAU) * pitch;
    vec3 q = vec3(length(p.xz) - R, p.y - ys, 0.0);
    float st = sdBox(q - vec3(0.0, -0.5, 0.0), vec3(2.6, 0.5, 1.0));
    float d = st;
    d = max(d, -(p.y - y0 + 0.5));
    d = max(d, p.y - y1);
    return d;
}

float sdCity(vec3 p) {
    gMat = 1.0;
    vec3 c = p - CITY_C;
    // quick bound for the whole city
    float bound = sdBox(c - vec3(0.0, 120.0, 0.0), vec3(560.0, 190.0, 520.0));
    if (bound > 30.0) return bound;

    float d = 1e9;
    // the great spire
    d = min(d, sdTower(c, 24.0, 170.0, 10.0, 0.0));
    d = min(d, sdHelixStair(c, 33.0, 46.0, 2.0, 160.0));
    // satellite towers
    vec3 t1 = c - vec3(-150.0, 0.0, 60.0);
    d = min(d, sdTower(t1, 14.0, 95.0, 6.0, 1.0));
    vec3 t2 = c - vec3(170.0, 0.0, -40.0);
    d = min(d, sdTower(t2, 16.0, 120.0, 7.0, 2.0));
    vec3 t3 = c - vec3(-60.0, 0.0, -230.0);
    d = min(d, sdTower(t3, 12.0, 70.0, 5.0, 3.0));
    vec3 t4 = c - vec3(300.0, 0.0, 180.0);
    d = min(d, sdTower(t4, 10.0, 60.0, 4.0, 4.0));
    vec3 t5 = c - vec3(-330.0, 0.0, -120.0);
    d = min(d, sdTower(t5, 11.0, 80.0, 5.0, 5.0));

    // arched bridges from the spire to the satellites, at different heights
    {
        vec3 b = c - vec3(-75.0, 62.0, 30.0);
        b.xz *= rot(-0.38);
        float br = sdBox(b, vec3(64.0, 2.0, 4.0));
        float arch = length(vec2(b.x, b.y + 40.0)) - 44.0;
        br = max(br, -arch);
        br = min(br, max(sdBox(b - vec3(0, -6, 0), vec3(64.0, 8.0, 3.2)), -(length(vec2(b.x, b.y + 46.0)) - 46.0)));
        d = min(d, br);
    }
    {
        vec3 b = c - vec3(85.0, 104.0, -20.0);
        b.xz *= rot(0.24);
        float br = sdBox(b, vec3(68.0, 2.0, 4.0));
        br = min(br, max(sdBox(b - vec3(0, -6, 0), vec3(68.0, 8.0, 3.2)), -(length(vec2(b.x, b.y + 48.0)) - 48.0)));
        d = min(d, br);
    }
    // impossible stairs: flights climbing walls and hanging upside down
    {
        vec3 s = c - vec3(-40.0, 120.0, 40.0);
        s.xy *= rot(PI);              // inverted flight under the bridge
        d = min(d, max(sdStairs2(s.xy, 2.2, 1.5, 18.0), abs(s.z) - 3.0));
        vec3 s2 = c - vec3(120.0, 40.0, 10.0);
        s2.xy *= rot(PI * 0.5);       // a flight running up a wall, sideways
        d = min(d, max(sdStairs2(s2.xy, 2.2, 1.5, 22.0), abs(s2.z) - 3.0));
        vec3 s3 = c - vec3(-110.0, 20.0, -90.0);
        s3.xz *= rot(0.8);
        d = min(d, max(sdStairs2(s3.xy, 2.4, 1.6, 26.0), abs(s3.z) - 3.5));
        vec3 s4 = c - vec3(40.0, 150.0, -110.0);
        s4.yz *= rot(PI * 0.5);
        s4.xz *= rot(1.1);
        d = min(d, max(sdStairs2(s4.xy, 2.2, 1.5, 20.0), abs(s4.z) - 3.0));
    }
    // a colonnade ring standing in the water
    {
        vec3 r = c;
        float id;
        vec2 a = pmod(r.xz, 36.0, id);
        vec3 q = vec3(a.x - 92.0, r.y, a.y);
        float col = sdCylY(q - vec3(0.0, 9.0, 0.0), 1.6, 9.0);
        float lintel = max(abs(length(r.xz) - 92.0) - 2.2, abs(r.y - 19.0) - 1.4);
        float arc = sdBox(q - vec3(0, 14.0, 0), vec3(2.0, 4.0, 8.2));
        arc = max(arc, -(length(q.yz - vec2(10.0, 0.0)) - 6.2));
        d = min(d, min(col, min(lintel, arc)));
    }
    return d;
}

// how much a point lies on the lit inner wall of one of the towers
float towerGlowOne(vec3 c, float r, float h, float tiers) {
    if (c.y < 0.0 || c.y > h) return 0.0;
    float th = h / tiers;
    float ty = clamp(floor(c.y / th), 0.0, tiers - 1.0);
    float rr = r * (1.0 - 0.06 * ty);
    float rad = length(c.xz);
    return smoothstep(rr - 0.2, rr - 1.6, rad) * step(rad, rr + 2.0) * (0.6 + 0.4 * hash11(ty + r));
}
float towerGlow(vec3 p) {
    vec3 c = p - CITY_C;
    float g = towerGlowOne(c, 24.0, 170.0, 10.0);
    g = max(g, towerGlowOne(c - vec3(-150.0, 0.0, 60.0), 14.0, 95.0, 6.0));
    g = max(g, towerGlowOne(c - vec3(170.0, 0.0, -40.0), 16.0, 120.0, 7.0));
    g = max(g, towerGlowOne(c - vec3(-60.0, 0.0, -230.0), 12.0, 70.0, 5.0));
    g = max(g, towerGlowOne(c - vec3(300.0, 0.0, 180.0), 10.0, 60.0, 4.0));
    g = max(g, towerGlowOne(c - vec3(-330.0, 0.0, -120.0), 11.0, 80.0, 5.0));
    return g;
}

// lanterns: warm points along the arcades and stairs
float lanternField(vec3 p, out vec3 lpos) {
    vec3 c = p - CITY_C;
    float best = 1e9;
    lpos = vec3(1e9);
    // on the colonnade ring
    {
        float id;
        vec2 a = pmod(c.xz, 36.0, id);
        vec3 l = vec3(92.0, 21.5, 0.0);
        float dd = length(vec3(a.x, c.y, a.y) - l);
        if (dd < best) { best = dd; float ang = id * TAU / 36.0; lpos = CITY_C + vec3(92.0 * cos(ang), 21.5, 92.0 * sin(ang)); }
    }
    // spiralling up the great stair
    {
        float a = atan(c.z, c.x);
        float u = (c.y - 2.0) / 46.0 - a / TAU;
        float k = floor(u + 0.5);
        float ang = a + k * TAU;
        float sa = floor(ang / 0.45 + 0.5) * 0.45;
        float y = 2.0 + (sa / TAU) * 46.0 + 3.0;
        if (y > 4.0 && y < 165.0) {
            vec3 l = vec3(37.0 * cos(sa), y, 37.0 * sin(sa));
            float dd = length(c - l);
            if (dd < best) { best = dd; lpos = CITY_C + l; }
        }
    }
    // a row of lanterns along each bridge
    for (int b = 0; b < 2; b++) {
        vec3 bc = (b == 0) ? vec3(-75.0, 62.0, 30.0) : vec3(85.0, 104.0, -20.0);
        float ang = (b == 0) ? -0.38 : 0.24;
        float hl = (b == 0) ? 64.0 : 68.0;
        vec3 q = c - bc;
        q.xz *= rot(ang);
        float k = clamp(floor(q.x / 9.0 + 0.5), -floor(hl / 9.0), floor(hl / 9.0));
        vec3 l = vec3(k * 9.0, 3.4, 0.0);
        float dd = length(q - l);
        if (dd < best) {
            best = dd;
            vec3 lw = l;
            lw.xz *= rot(-ang);
            lpos = CITY_C + bc + lw;
        }
    }
    // paper lanterns floating on the sea, everywhere
    if (p.y < 25.0) {
        const float C = 16.0;
        vec2 base = floor(p.xz / C - 0.5);
        for (int j = 0; j < 2; j++)
        for (int i = 0; i < 2; i++) {
            vec2 id = base + vec2(i, j);
            vec3 h = hash32(id * 1.37 + 5.1);
            if (h.x > uSeaLanterns || id.y * C < SEA_END + 60.0) continue;
            vec2 xz = (id + 0.2 + 0.6 * h.yz) * C;
            float y = 0.55 + 0.08 * sin(uTime * 0.9 + h.y * 40.0);
            vec3 l = vec3(xz.x, y, xz.y);
            float dd = length(p - l);
            if (dd < best) { best = dd; lpos = l; }
        }
    }
    return best;
}

// ------------------------------------------------------------ the moon-drop
vec2 moonHit(vec3 ro, vec3 rd) {
    vec3 oc = ro - uMoonPos;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - uMoonR * uMoonR;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}
