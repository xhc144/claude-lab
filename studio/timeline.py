"""The film's edit: which scene plays when, and how scenes hand over."""
import importlib
import math

import numpy as np

from .core import smooth

# name, "module:Class", crossfade-with-previous (seconds)
EDIT = [
    ("galois", "s00_galois:GaloisOpen", 0.0),
    ("symmetry", "s01_symmetry:Symmetry", 0.0),
    ("music", "s02_music:TwelveTone", 0.8),
    ("rubik", "s03_rubik:Rubik", 0.0),
    ("solids", "s04_solids:Solids", 0.5),
    ("alhambra", "s05_alhambra:Alhambra", 0.8),
    ("hyperbolic", "s06_hyperbolic:Hyperbolic", 0.0),
    ("quintic", "s07_quintic:Quintic", 0.0),
    ("elliptic", "s08_elliptic:Elliptic", 0.6),
    ("physics", "s09_physics:Physics", 0.6),
    ("finale", "s10_finale:Finale", 0.6),
]

_instances = {}


def _scene(name):
    if name not in _instances:
        for n, spec, _ in EDIT:
            if n == name:
                mod, cls = spec.split(":")
                m = importlib.import_module(f"studio.scenes.{mod}")
                _instances[name] = getattr(m, cls)()
                break
        else:
            raise KeyError(name)
    return _instances[name]


def _starts():
    out, t = [], 0.0
    for n, spec, xf in EDIT:
        t -= xf
        out.append((n, t, xf))
        t += _scene(n).duration
    return out


def scene_by_name(name):
    return _scene(name)


def start_of(name):
    for n, t, _ in _starts():
        if n == name:
            return t
    raise KeyError(name)


def total_duration():
    n, t, _ = _starts()[-1]
    return t + _scene(n).duration


def render_at(t, scale):
    """Return (rgb float image, post-fx parameters) for global time t."""
    active = []
    starts = _starts()
    for i, (n, t0, xf) in enumerate(starts):
        sc = _scene(n)
        if t0 <= t < t0 + sc.duration or (i == len(starts) - 1 and t >= t0):
            active.append((i, n, t0, xf, sc))
    if not active:
        n, t0, xf = starts[-1]
        active = [(len(starts) - 1, n, t0, xf, _scene(n))]
    if len(active) == 1:
        _, n, t0, _, sc = active[0]
        return sc.render(t - t0, scale), _post(sc)
    # crossfade between the two latest active scenes
    (_, na, ta, _, sa), (_, nb, tb, xfb, sb) = active[-2], active[-1]
    w = smooth((t - tb) / max(xfb, 1e-6))
    ra = sa.render(t - ta, scale)
    rb = sb.render(t - tb, scale)
    pa, pb = _post(sa), _post(sb)
    post = {k: pa[k] * (1 - w) + pb[k] * w for k in pa}
    return ra * (1 - w) + rb * w, post


_HITS = None


def hits():
    """Global times of the big musical hits (used for the impact punch)."""
    global _HITS
    if _HITS is None:
        from .scenes import s07_quintic, s09_physics, s10_finale
        _HITS = [start_of("symmetry"), start_of("rubik"), start_of("quintic") + s07_quintic.LIT_T0 + 0.2,
                 start_of("physics") + 13.8, start_of("physics") + s09_physics.E8_SNAP,
                 start_of("finale") + s10_finale.TITLE_T0]
    return _HITS


def impact(t):
    k = 0.0
    for th in hits():
        if th <= t < th + 1.5:
            k += math.exp(-(t - th) / 0.22)
    return min(k, 1.0)


def _post(sc):
    return {"bloom": sc.bloom, "bloom_threshold": sc.bloom_threshold, "vignette": sc.vignette, "grain": sc.grain}
