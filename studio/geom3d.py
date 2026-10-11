"""3-D helpers: Platonic solids, rotations, projection."""
import functools
import math

import numpy as np
from scipy.spatial import ConvexHull

PHI = (1 + 5 ** 0.5) / 2


def _norm(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v, axis=1).max()


def solid_vertices(name):
    if name == "tetra":
        v = [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)]
    elif name == "cube":
        v = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    elif name == "octa":
        v = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
    elif name == "icosa":
        v = []
        for a in (-1, 1):
            for b in (-1, 1):
                v += [(0, a, b * PHI), (a, b * PHI, 0), (b * PHI, 0, a)]
    elif name == "dodeca":
        v = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        ip = 1 / PHI
        for a in (-1, 1):
            for b in (-1, 1):
                v += [(0, a * ip, b * PHI), (a * ip, b * PHI, 0), (b * PHI, 0, a * ip)]
    else:
        raise KeyError(name)
    return _norm(v)


@functools.lru_cache(maxsize=None)
def solid(name):
    """Return (vertices (n,3), edges [(i,j)], faces [list of vertex indices, ordered])."""
    v = solid_vertices(name)
    d = np.linalg.norm(v[:, None] - v[None], axis=2)
    dmin = d[d > 1e-6].min()
    edges = [(i, j) for i in range(len(v)) for j in range(i + 1, len(v)) if abs(d[i, j] - dmin) < 1e-6]
    hull = ConvexHull(v)
    groups = {}
    for simplex, eq in zip(hull.simplices, hull.equations):
        key = tuple(np.round(eq[:3], 4))
        groups.setdefault(key, set()).update(simplex.tolist())
    faces = []
    for key, idx in groups.items():
        idx = list(idx)
        n = np.array(key)
        cpt = v[idx].mean(axis=0)
        a = v[idx[0]] - cpt
        a /= np.linalg.norm(a)
        b = np.cross(n, a)
        ang = [math.atan2(np.dot(v[i] - cpt, b), np.dot(v[i] - cpt, a)) for i in idx]
        faces.append([i for _, i in sorted(zip(ang, idx))])
    return v, edges, faces


def edge_points(name, n=720, seed=0):
    """n points distributed along the edges of a solid."""
    v, edges, _ = solid(name)
    per = n // len(edges)
    pts = []
    for k, (i, j) in enumerate(edges):
        cnt = per + (1 if k < n - per * len(edges) else 0)
        for s in np.linspace(0, 1, cnt, endpoint=False) + 0.5 / cnt:
            pts.append(v[i] * (1 - s) + v[j] * s)
    return np.array(pts)


def rot_axis(axis, ang):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s = math.cos(ang), math.sin(ang)
    C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def rot_euler(a, b, c):
    return rot_axis((0, 1, 0), b) @ rot_axis((1, 0, 0), a) @ rot_axis((0, 0, 1), c)


def project(P, cx, cy, scale, cam_dist=6.0):
    """Perspective-project points P (n,3) (already rotated) to screen; returns (xy, depth, persp)."""
    z = P[:, 2]
    k = cam_dist / (cam_dist - z)
    xy = np.stack([cx + P[:, 0] * scale * k, cy - P[:, 1] * scale * k], axis=1)
    return xy, z, k
