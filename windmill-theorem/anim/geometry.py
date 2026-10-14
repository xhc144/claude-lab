"""Pure-Python geometry of the windmill proof (no manim imports, easy to test).

A triple (x, y, z) with x^2 + 4yz = p is drawn as a *windmill*: a central
x-by-x square centred at the origin and four y-by-z blades arranged with
4-fold rotational symmetry.  Each blade touches one side of the square,
starts at a corner, runs a length y along that side (possibly overhanging)
and sticks out a depth z.  ``hand`` = +1 / -1 chooses the spin direction.
"""
from math import isqrt


# ----------------------------------------------------------- arithmetic side
def S(p):
    """All positive triples with x^2 + 4yz = p, sorted."""
    out = []
    for x in range(1, isqrt(p) + 1):
        r = p - x * x
        if r <= 0 or r % 4:
            continue
        m = r // 4
        for y in range(1, m + 1):
            if m % y == 0:
                out.append((x, y, m // y))
    return sorted(out)


def zeta_case(t):
    x, y, z = t
    if x < y - z:
        return "a"
    if x < 2 * y:
        return "b"
    return "c"


def zeta(t):
    """Zagier's involution."""
    x, y, z = t
    c = zeta_case(t)
    if c == "a":
        return (x + 2 * z, z, y - x - z)
    if c == "b":
        return (2 * y - x, y, x - y + z)
    return (x - 2 * y, x - y + z, y)


def tau(t):
    """The swap involution."""
    x, y, z = t
    return (x, z, y)


def path_from_cross(p):
    """Alternate tau, zeta starting at the zeta-fixed cross (1,1,(p-1)/4).

    Returns the list of visited triples and the list of moves ('tau'/'zeta').
    """
    cur = (1, 1, (p - 1) // 4)
    seq, moves = [cur], []
    while True:
        nxt = tau(cur)
        if nxt == cur:
            return seq, moves
        seq.append(nxt)
        moves.append("tau")
        cur = zeta(nxt)
        seq.append(cur)
        moves.append("zeta")


# ------------------------------------------------------------ planar pieces
def _rot(r):
    """Rotate an axis-aligned rect (u0, v0, u1, v1) by +90 degrees about 0."""
    u0, v0, u1, v1 = r
    return (-v1, u0, -v0, u1)


def _mirror(r):
    u0, v0, u1, v1 = r
    return (-u1, v0, -u0, v1)


def pieces(x, y, z, hand=1):
    """Return (square, [blade1..blade4]) as rects (u0, v0, u1, v1)."""
    h = x / 2
    sq = (-h, -h, h, h)
    b = (-h, -h - z, -h + y, -h)
    blades = [b]
    for _ in range(3):
        b = _rot(b)
        blades.append(b)
    if hand < 0:
        blades = [_mirror(r) for r in blades]
    return sq, blades


def blade_anchor_axis(x, k, hand=1):
    """Corner of the square where blade k starts, and the diagonal direction
    across which the blade is reflected by the swap (x, y, z) -> (x, z, y)."""
    h = x / 2
    corners = [(-h, -h), (h, -h), (h, h), (-h, h)]
    axes = [(1, -1), (1, 1), (-1, 1), (-1, -1)]
    (cu, cv), (du, dv) = corners[k], axes[k]
    if hand < 0:
        cu, du = -cu, -du
    return (cu, cv), (du, dv)


def cells_of(rects, x):
    """Unit cells covered by the rects.  Coordinates are shifted by x/2 so that
    cell (i, j) is the unit square [i, i+1] x [j, j+1] in shifted coordinates."""
    s = (x % 2) / 2
    cells = set()
    for (u0, v0, u1, v1) in rects:
        for i in range(round(u0 + s), round(u1 + s)):
            for j in range(round(v0 + s), round(v1 + s)):
                cells.add((i, j))
    return cells


def windmill_cells(x, y, z, hand=1):
    sq, bl = pieces(x, y, z, hand)
    return cells_of([sq] + bl, x)


def outline(cells, x):
    """Counter-clockwise outline polygon (list of (u, v)) of a set of cells."""
    edges = {}
    for (i, j) in cells:
        if (i, j - 1) not in cells:
            edges[(i, j)] = (i + 1, j)
        if (i + 1, j) not in cells:
            edges[(i + 1, j)] = (i + 1, j + 1)
        if (i, j + 1) not in cells:
            edges[(i + 1, j + 1)] = (i, j + 1)
        if (i - 1, j) not in cells:
            edges[(i, j + 1)] = (i, j)
    start = min(edges)
    pts, cur = [start], edges[start]
    while cur != start:
        pts.append(cur)
        cur = edges[cur]
    # drop collinear points
    out = []
    n = len(pts)
    for k in range(n):
        a, b, c = pts[k - 1], pts[k], pts[(k + 1) % n]
        if (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) != 0:
            out.append(b)
    s = (x % 2) / 2
    return [(u - s, v - s) for (u, v) in out]


def concave_corners(poly):
    """Reflex vertices of a counter-clockwise polygon."""
    res = []
    n = len(poly)
    for k in range(n):
        a, b, c = poly[k - 1], poly[k], poly[(k + 1) % n]
        if (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0:
            res.append(b)
    return res


def corner_options(poly):
    """For each reflex vertex: (point, dir_in, dir_back).  Extending the incoming
    edge continues along dir_in; extending the outgoing edge backwards goes
    along dir_back.  These are the two possible cuts at that corner."""
    res = []
    n = len(poly)
    for k in range(n):
        a, b, c = poly[k - 1], poly[k], poly[(k + 1) % n]
        if (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0:
            din = (_sgn(b[0] - a[0]), _sgn(b[1] - a[1]))
            dback = (_sgn(b[0] - c[0]), _sgn(b[1] - c[1]))
            res.append((b, din, dback))
    return res


def _sgn(v):
    return (v > 0) - (v < 0)


def on_segments(pt, segs, eps=1e-9):
    for (a, b) in segs:
        if abs(a[0] - b[0]) < eps and abs(pt[0] - a[0]) < eps and min(a[1], b[1]) - eps <= pt[1] <= max(a[1], b[1]) + eps:
            return True
        if abs(a[1] - b[1]) < eps and abs(pt[1] - a[1]) < eps and min(a[0], b[0]) - eps <= pt[0] <= max(a[0], b[0]) + eps:
            return True
    return False


def interior_segments(rects, cells, x):
    """Piece boundaries that lie strictly inside the shape (the 'cuts')."""
    s = (x % 2) / 2
    unit = set()
    for (u0, v0, u1, v1) in rects:
        a0, b0, a1, b1 = round(u0 + s), round(v0 + s), round(u1 + s), round(v1 + s)
        for i in range(a0, a1):
            for j in (b0, b1):  # horizontal unit edges at height j
                if (i, j - 1) in cells and (i, j) in cells:
                    unit.add(((i, j), (i + 1, j)))
        for j in range(b0, b1):
            for i in (a0, a1):
                if (i - 1, j) in cells and (i, j) in cells:
                    unit.add(((i, j), (i, j + 1)))
    return [((a[0] - s, a[1] - s), (b[0] - s, b[1] - s)) for a, b in _merge(unit)]


def grid_segments(cells, x):
    """All unit edges between two cells of the shape (for the faint cell grid)."""
    s = (x % 2) / 2
    unit = set()
    for (i, j) in cells:
        if (i + 1, j) in cells:
            unit.add(((i + 1, j), (i + 1, j + 1)))
        if (i, j + 1) in cells:
            unit.add(((i, j + 1), (i + 1, j + 1)))
    return [((a[0] - s, a[1] - s), (b[0] - s, b[1] - s)) for a, b in _merge(unit)]


def _merge(unit):
    """Merge collinear, touching unit segments."""
    horiz, vert = {}, {}
    for a, b in unit:
        if a[1] == b[1]:
            horiz.setdefault(a[1], []).append(min(a[0], b[0]))
        else:
            vert.setdefault(a[0], []).append(min(a[1], b[1]))
    out = []
    for v, xs in horiz.items():
        xs.sort()
        s0 = prev = xs[0]
        for u in xs[1:]:
            if u != prev + 1:
                out.append(((s0, v), (prev + 1, v)))
                s0 = u
            prev = u
        out.append(((s0, v), (prev + 1, v)))
    for u, ys in vert.items():
        ys.sort()
        s0 = prev = ys[0]
        for w in ys[1:]:
            if w != prev + 1:
                out.append(((u, s0), (u, prev + 1)))
                s0 = w
            prev = w
        out.append(((u, s0), (u, prev + 1)))
    return out


def extent(x, y, z):
    """Half-width of the bounding box of a windmill."""
    return max(x / 2 + z, y - x / 2)


def zeta_hand(t, hand=1):
    """Spin direction of zeta(t) drawn on the same outline as t."""
    return -hand if zeta_case(t) == "b" and zeta(t) != t else hand


if __name__ == "__main__":
    for p in (13, 17, 29, 41, 97):
        for t in S(p):
            u = zeta(t)
            assert zeta(u) == t and u in S(p)
            assert windmill_cells(*t) == windmill_cells(*u, hand=zeta_hand(t))
    print("ok", S(41), path_from_cross(41))
