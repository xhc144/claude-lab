"""A small ray-marched Rubik's cube renderer (numba, CPU).

Cube space: +x right, +y up, +z towards the viewer.  Cubies sit on the integer
grid {-1,0,1}^3.  State is a permutation + orientation of the 27 cubies.
"""
import math

import numpy as np
from numba import njit

HALF = 0.475
ROUND = 0.075
STICKER = 0.385
STICKER_R = 0.07

# face colours indexed by direction 0..5 = +x,-x,+y,-y,+z,-z (linear-ish RGB)
FACE_COL = np.array([
    [0.80, 0.03, 0.04],   # +x red
    [1.00, 0.30, 0.00],   # -x orange
    [0.90, 0.90, 0.88],   # +y white
    [1.00, 0.80, 0.02],   # -y yellow
    [0.00, 0.50, 0.17],   # +z green
    [0.00, 0.17, 0.62],   # -z blue
], np.float64)

MOVES = {  # name -> (axis, layer, quarter turns, right-hand sense)
    "R": (0, 1, -1), "L": (0, -1, 1), "U": (1, 1, -1), "D": (1, -1, 1), "F": (2, 1, -1), "B": (2, -1, 1),
}


def rot_int(axis, q):
    """Integer rotation matrix for q quarter turns (right-hand rule) about axis."""
    c = [1, 0, -1, 0][q % 4]
    s = [0, 1, 0, -1][q % 4]
    if axis == 0:
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 1:
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def parse(move):
    base = move[0]
    axis, layer, sense = MOVES[base]
    q = sense
    if move.endswith("'"):
        q = -sense
    elif move.endswith("2"):
        q = 2 * sense
    return axis, layer, q


class CubeState:
    def __init__(self):
        g = [(x, y, z) for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1)]
        self.orig = np.array(g, np.int64)
        self.pos = self.orig.copy()
        self.orient = np.array([np.eye(3, dtype=np.int64)] * 27)

    def copy(self):
        s = CubeState.__new__(CubeState)
        s.orig = self.orig
        s.pos = self.pos.copy()
        s.orient = self.orient.copy()
        return s

    def apply(self, move):
        axis, layer, q = parse(move)
        R = rot_int(axis, q)
        sel = self.pos[:, axis] == layer
        self.pos[sel] = self.pos[sel] @ R.T
        self.orient[sel] = np.einsum("ij,njk->nik", R, self.orient[sel])

    def cell_table(self):
        t = np.zeros((3, 3, 3), np.int64)
        for i, p in enumerate(self.pos):
            t[p[0] + 1, p[1] + 1, p[2] + 1] = i
        return t


# ---------------------------------------------------------------------------
@njit(cache=True, inline="always")
def _box(px, py, pz):
    b = HALF - ROUND
    qx = abs(px) - b
    qy = abs(py) - b
    qz = abs(pz) - b
    ox = max(qx, 0.0)
    oy = max(qy, 0.0)
    oz = max(qz, 0.0)
    return math.sqrt(ox * ox + oy * oy + oz * oz) + min(max(qx, max(qy, qz)), 0.0) - ROUND


@njit(cache=True, inline="always")
def _clampr(v):
    r = math.floor(v + 0.5)
    if r < -1:
        r = -1
    if r > 1:
        r = 1
    return r


@njit(cache=True, inline="always")
def _rot(axis, ang, x, y, z):
    c = math.cos(ang)
    s = math.sin(ang)
    if axis == 0:
        return x, c * y - s * z, s * y + c * z
    if axis == 1:
        return c * x + s * z, y, -s * x + c * z
    return c * x - s * y, s * x + c * y, z


@njit(cache=True)
def _sdf(x, y, z, axis, layer, ang):
    """Returns (dist, part, cx, cy, cz) where part 0=static, 1=moving."""
    # static part
    cx = _clampr(x)
    cy = _clampr(y)
    cz = _clampr(z)
    if ang != 0.0:
        cc = cx if axis == 0 else (cy if axis == 1 else cz)
        if cc == layer:
            v = x if axis == 0 else (y if axis == 1 else z)
            if layer == 0:
                nc = 1.0 if v > 0 else -1.0
            else:
                nc = 0.0
            if axis == 0:
                cx = nc
            elif axis == 1:
                cy = nc
            else:
                cz = nc
    d = _box(x - cx, y - cy, z - cz)
    part = 0
    rx, ry, rz = cx, cy, cz
    if ang != 0.0:
        mx, my, mz = _rot(axis, -ang, x, y, z)
        ax = _clampr(mx)
        ay = _clampr(my)
        az = _clampr(mz)
        if axis == 0:
            ax = layer
        elif axis == 1:
            ay = layer
        else:
            az = layer
        d2 = _box(mx - ax, my - ay, mz - az)
        if d2 < d:
            d = d2
            part = 1
            rx, ry, rz = ax, ay, az
    return d, part, rx, ry, rz


@njit(cache=True)
def _dist(x, y, z, axis, layer, ang):
    return _sdf(x, y, z, axis, layer, ang)[0]


@njit(cache=True)
def _march(ox, oy, oz, dx, dy, dz, axis, layer, ang, tmax_extra):
    # bounding sphere
    R = 2.7
    b = ox * dx + oy * dy + oz * dz
    c = ox * ox + oy * oy + oz * oz - R * R
    disc = b * b - c
    if disc < 0:
        return -1.0
    sq = math.sqrt(disc)
    t = max(-b - sq, 0.0)
    t1 = -b + sq
    for _ in range(110):
        x = ox + dx * t
        y = oy + dy * t
        z = oz + dz * t
        d = _dist(x, y, z, axis, layer, ang)
        if d < 0.0007:
            return t
        t += d * 0.95
        if t > t1:
            return -1.0
    return -1.0


@njit(cache=True)
def _env(dx, dy, dz):
    # studio environment: dark with a big soft box above and a rim strip
    v = 0.012 + 0.03 * max(dy, 0.0)
    sb = max(0.0, 1.0 - (abs(dx + 0.15) / 0.55) ** 2 - ((dz + 0.1) / 0.6) ** 2)
    if dy > 0.3:
        v += 2.2 * sb ** 0.6 * min(1.0, (dy - 0.3) * 4)
    # side strip light
    if dx < -0.6 and abs(dy - 0.15) < 0.35:
        v += 0.9 * (1 - abs(dy - 0.15) / 0.35)
    return v


@njit(cache=True)
def _shade(px, py, pz, vx, vy, vz, axis, layer, ang, cell, orient, orig, full, Mi):
    """Shade cube-space point; v = direction towards viewer (cube space)."""
    d, part, cx, cy, cz = _sdf(px, py, pz, axis, layer, ang)
    # local coordinates in the part frame
    if part == 1:
        lx, ly, lz = _rot(axis, -ang, px, py, pz)
    else:
        lx, ly, lz = px, py, pz
    lx -= cx
    ly -= cy
    lz -= cz
    b = HALF - ROUND
    qx = abs(lx) - b
    qy = abs(ly) - b
    qz = abs(lz) - b
    nx = max(qx, 0.0) * (1.0 if lx > 0 else -1.0)
    ny = max(qy, 0.0) * (1.0 if ly > 0 else -1.0)
    nz = max(qz, 0.0) * (1.0 if lz > 0 else -1.0)
    nl = math.sqrt(nx * nx + ny * ny + nz * nz)
    if nl < 1e-6:
        if qx >= qy and qx >= qz:
            nx = 1.0 if lx > 0 else -1.0
        elif qy >= qz:
            ny = 1.0 if ly > 0 else -1.0
        else:
            nz = 1.0 if lz > 0 else -1.0
        nl = 1.0
    nx /= nl
    ny /= nl
    nz /= nl
    # dominant face
    ax_ = abs(lx)
    ay_ = abs(ly)
    az_ = abs(lz)
    if ax_ >= ay_ and ax_ >= az_:
        k = 0
        sgn = 1 if lx > 0 else -1
        u, w, flat = ly, lz, ax_
    elif ay_ >= az_:
        k = 1
        sgn = 1 if ly > 0 else -1
        u, w, flat = lx, lz, ay_
    else:
        k = 2
        sgn = 1 if lz > 0 else -1
        u, w, flat = lx, ly, az_
    cid = cell[int(cx) + 1, int(cy) + 1, int(cz) + 1]
    # direction in cubie-original frame: d_orig = O^T d_cur
    o0 = orient[cid, k, 0] * sgn
    o1 = orient[cid, k, 1] * sgn
    o2 = orient[cid, k, 2] * sgn
    if o0 != 0:
        fk = 0
        fs = o0
    elif o1 != 0:
        fk = 1
        fs = o1
    else:
        fk = 2
        fs = o2
    has = orig[cid, fk] == fs
    face_idx = fk * 2 + (0 if fs > 0 else 1)
    # sticker mask (rounded square)
    sdx = abs(u) - (STICKER - STICKER_R)
    sdy = abs(w) - (STICKER - STICKER_R)
    sd = math.sqrt(max(sdx, 0.0) ** 2 + max(sdy, 0.0) ** 2) + min(max(sdx, sdy), 0.0) - STICKER_R
    m = 0.0
    if has and flat > HALF - 0.01:
        m = min(max(-sd / 0.012 + 0.5, 0.0), 1.0)
    # world-ish normal back to cube frame (undo layer rotation)
    if part == 1:
        nx, ny, nz = _rot(axis, ang, nx, ny, nz)
    # lighting in cube frame: lights are defined in world, convert with Mi (world->cube)
    lx0, ly0, lz0 = -0.45, 0.75, 0.55
    kx = Mi[0, 0] * lx0 + Mi[0, 1] * ly0 + Mi[0, 2] * lz0
    ky = Mi[1, 0] * lx0 + Mi[1, 1] * ly0 + Mi[1, 2] * lz0
    kz = Mi[2, 0] * lx0 + Mi[2, 1] * ly0 + Mi[2, 2] * lz0
    kl = math.sqrt(kx * kx + ky * ky + kz * kz)
    kx /= kl
    ky /= kl
    kz /= kl
    ndl = max(0.0, nx * kx + ny * ky + nz * kz)
    # fill light from the right
    fx0, fy0, fz0 = 0.8, 0.1, 0.4
    fx = Mi[0, 0] * fx0 + Mi[0, 1] * fy0 + Mi[0, 2] * fz0
    fy = Mi[1, 0] * fx0 + Mi[1, 1] * fy0 + Mi[1, 2] * fz0
    fz = Mi[2, 0] * fx0 + Mi[2, 1] * fy0 + Mi[2, 2] * fz0
    fl = math.sqrt(fx * fx + fy * fy + fz * fz)
    ndf = max(0.0, (nx * fx + ny * fy + nz * fz) / fl)
    # AO + shadow
    ao = 1.0
    sh = 1.0
    if full:
        occ = 0.0
        for i in range(1, 6):
            hh = 0.035 * i
            dd = _dist(px + nx * hh, py + ny * hh, pz + nz * hh, axis, layer, ang)
            occ += (hh - dd) * (1.0 / (1 << i))
        ao = min(max(1.0 - 9.0 * occ, 0.0), 1.0)
        tt = 0.02
        res = 1.0
        for i in range(40):
            dd = _dist(px + kx * tt, py + ky * tt, pz + kz * tt, axis, layer, ang)
            res = min(res, 10.0 * dd / tt)
            tt += min(max(dd, 0.01), 0.2)
            if res < 0.01 or tt > 4.0:
                break
        sh = min(max(res, 0.0), 1.0)
    # reflection
    vdn = vx * nx + vy * ny + vz * nz
    rx = 2 * vdn * nx - vx
    ry = 2 * vdn * ny - vy
    rz = 2 * vdn * nz - vz
    # reflection dir to world for env lookup: world = M r = Mi^T r
    wx = Mi[0, 0] * rx + Mi[1, 0] * ry + Mi[2, 0] * rz
    wy = Mi[0, 1] * rx + Mi[1, 1] * ry + Mi[2, 1] * rz
    wz = Mi[0, 2] * rx + Mi[1, 2] * ry + Mi[2, 2] * rz
    env = _env(wx, wy, wz)
    fres = 0.04 + 0.96 * (1.0 - max(vdn, 0.0)) ** 5
    hx = kx + vx
    hy = ky + vy
    hz = kz + vz
    hl = math.sqrt(hx * hx + hy * hy + hz * hz)
    ndh = max(0.0, (nx * hx + ny * hy + nz * hz) / hl)
    # material
    base_r = 0.018
    base_g = 0.018
    base_b = 0.02
    spec_k = 0.25
    shin = 40.0
    refl = 0.25
    if m > 0:
        base_r = base_r * (1 - m) + FACE_COL[face_idx, 0] * m
        base_g = base_g * (1 - m) + FACE_COL[face_idx, 1] * m
        base_b = base_b * (1 - m) + FACE_COL[face_idx, 2] * m
        spec_k = 0.25 + 0.35 * m
        shin = 40.0 + 60.0 * m
        refl = 0.25 + 0.35 * m
    spec = spec_k * ndh ** shin * sh
    amb = 0.10
    lit = (ndl * 1.25 * sh + ndf * 0.35 + amb) * ao
    r = base_r * lit + spec * 1.2 + env * fres * refl * ao
    g = base_g * lit + spec * 1.2 + env * fres * refl * ao
    bb = base_b * lit + spec * 1.15 + env * fres * refl * ao
    return r, g, bb


@njit(cache=True)
def render(out, ss, cam_pos, cam_rot, fov, Mi, axis, layer, ang, cell, orient, orig, floor_y, light):
    """out: (h, w, 3) float32 display-referred image (h, w already multiplied by ss)."""
    h, w = out.shape[0], out.shape[1]
    aspect = w / h
    tf = math.tan(fov * 0.5)
    for py in range(h):
        for px in range(w):
            u = ((px + 0.5) / w * 2.0 - 1.0) * tf * aspect
            v = (1.0 - (py + 0.5) / h * 2.0) * tf
            # camera ray in world
            dx = cam_rot[0, 0] * u + cam_rot[0, 1] * v - cam_rot[0, 2]
            dy = cam_rot[1, 0] * u + cam_rot[1, 1] * v - cam_rot[1, 2]
            dz = cam_rot[2, 0] * u + cam_rot[2, 1] * v - cam_rot[2, 2]
            dl = math.sqrt(dx * dx + dy * dy + dz * dz)
            dx /= dl
            dy /= dl
            dz /= dl
            ox, oy, oz = cam_pos[0], cam_pos[1], cam_pos[2]
            # to cube space
            cox = Mi[0, 0] * ox + Mi[0, 1] * oy + Mi[0, 2] * oz
            coy = Mi[1, 0] * ox + Mi[1, 1] * oy + Mi[1, 2] * oz
            coz = Mi[2, 0] * ox + Mi[2, 1] * oy + Mi[2, 2] * oz
            cdx = Mi[0, 0] * dx + Mi[0, 1] * dy + Mi[0, 2] * dz
            cdy = Mi[1, 0] * dx + Mi[1, 1] * dy + Mi[1, 2] * dz
            cdz = Mi[2, 0] * dx + Mi[2, 1] * dy + Mi[2, 2] * dz
            t = _march(cox, coy, coz, cdx, cdy, cdz, axis, layer, ang, 0.0)
            tfl = -1.0
            if dy < -1e-4:
                tfl = (floor_y - oy) / dy
            r = 0.0
            g = 0.0
            b = 0.0
            if t > 0 and (tfl < 0 or t < tfl):
                r, g, b = _shade(cox + cdx * t, coy + cdy * t, coz + cdz * t, -cdx, -cdy, -cdz,
                                 axis, layer, ang, cell, orient, orig, True, Mi)
            else:
                # background glow
                gl = 0.0045 * math.exp(-(u * u * 0.8 + (v - 0.05) ** 2 * 1.4) * 1.5)
                r, g, b = gl * 0.55, gl * 0.75, gl * 1.0
                if tfl > 0:
                    fx = ox + dx * tfl
                    fz = oz + dz * tfl
                    # floor: dark glossy, reflection of the cube, soft shadow below
                    dist2 = fx * fx + fz * fz
                    fade = math.exp(-dist2 * 0.045)
                    base = 0.0008 * fade
                    rr, rg, rb = base, base, base * 1.1
                    # reflection ray
                    rdx, rdy, rdz = dx, -dy, dz
                    crx = Mi[0, 0] * fx + Mi[0, 1] * floor_y + Mi[0, 2] * fz
                    cry = Mi[1, 0] * fx + Mi[1, 1] * floor_y + Mi[1, 2] * fz
                    crz = Mi[2, 0] * fx + Mi[2, 1] * floor_y + Mi[2, 2] * fz
                    cdx2 = Mi[0, 0] * rdx + Mi[0, 1] * rdy + Mi[0, 2] * rdz
                    cdy2 = Mi[1, 0] * rdx + Mi[1, 1] * rdy + Mi[1, 2] * rdz
                    cdz2 = Mi[2, 0] * rdx + Mi[2, 1] * rdy + Mi[2, 2] * rdz
                    t2 = _march(crx, cry, crz, cdx2, cdy2, cdz2, axis, layer, ang, 0.0)
                    if t2 > 0:
                        sr, sg, sb = _shade(crx + cdx2 * t2, cry + cdy2 * t2, crz + cdz2 * t2, -cdx2, -cdy2, -cdz2,
                                            axis, layer, ang, cell, orient, orig, False, Mi)
                        k = 0.30 * math.exp(-t2 * 0.6)
                        rr += sr * k
                        rg += sg * k
                        rb += sb * k
                    # contact shadow / darkening
                    sd = math.sqrt(dist2)
                    shadow = 1.0 - 0.85 * math.exp(-max(sd - 0.6, 0.0) ** 2 * 1.2)
                    rr *= shadow
                    rg *= shadow
                    rb *= shadow
                    # spotlight pool on the floor
                    pool = 0.006 * math.exp(-dist2 * 0.12) * shadow
                    rr += pool * 0.8
                    rg += pool * 0.85
                    rb += pool
                    # blend floor towards background with distance
                    r = r * (1 - fade) + rr * fade + rr * (1 - fade) * 0.0
                    g = g * (1 - fade) + rg * fade
                    b = b * (1 - fade) + rb * fade
            r *= light
            g *= light
            b *= light
            # filmic-ish tone map + gamma
            r = r / (1.0 + r * 0.6)
            g = g / (1.0 + g * 0.6)
            b = b / (1.0 + b * 0.6)
            out[py, px, 0] = max(r, 0.0) ** (1 / 2.2)
            out[py, px, 1] = max(g, 0.0) ** (1 / 2.2)
            out[py, px, 2] = max(b, 0.0) ** (1 / 2.2)


def look_at(pos, target, up=(0, 1, 0)):
    pos = np.asarray(pos, float)
    f = np.asarray(target, float) - pos
    f /= np.linalg.norm(f)
    r = np.cross(f, up)
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    # columns: right, up, back (camera looks along -back)
    return np.stack([r, u, -f], axis=1)


def rot_xyz(rx, ry, rz):
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Ry @ Rx @ Rz
