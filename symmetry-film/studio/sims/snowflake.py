"""Reiter's hexagonal cellular-automaton model of snow-crystal growth.

Produces, for every cell of an axial hex grid, the simulation step at which it
froze.  Rendering then reveals the crystal by thresholding that field.
"""
import os

import numpy as np
from numba import njit

from ..core import CACHE


@njit(cache=True)
def _simulate(n, alpha, beta, gamma, max_steps, stop_radius):
    s = np.full((n, n), beta)
    c = n // 2
    s[c, c] = 1.0
    freeze = np.full((n, n), 1e9)
    freeze[c, c] = 0.0
    u = np.zeros((n, n))
    rec = np.zeros((n, n), np.bool_)
    dq = np.array([1, -1, 0, 0, 1, -1])
    dr = np.array([0, 0, 1, -1, -1, 1])
    reached = 0
    steps = 0
    for step in range(1, max_steps):
        # receptive cells: frozen or touching frozen
        for i in range(1, n - 1):
            for j in range(1, n - 1):
                r = s[i, j] >= 1.0
                if not r:
                    for k in range(6):
                        if s[i + dq[k], j + dr[k]] >= 1.0:
                            r = True
                            break
                rec[i, j] = r
        for i in range(n):
            for j in range(n):
                u[i, j] = 0.0 if rec[i, j] else s[i, j]
        new = s.copy()
        for i in range(1, n - 1):
            for j in range(1, n - 1):
                acc = 0.0
                for k in range(6):
                    acc += u[i + dq[k], j + dr[k]]
                un = u[i, j] + alpha / 2.0 * (acc / 6.0 - u[i, j])
                v = s[i, j] + gamma if rec[i, j] else 0.0
                new[i, j] = un + v
                if new[i, j] >= 1.0 and freeze[i, j] > 1e8:
                    freeze[i, j] = step
                    q = i - c
                    rr = j - c
                    d = max(abs(q), abs(rr), abs(q + rr))
                    if d > reached:
                        reached = d
        # boundary stays at background vapour level
        for i in range(n):
            new[i, 0] = beta
            new[i, n - 1] = beta
            new[0, i] = beta
            new[n - 1, i] = beta
        s = new
        steps = step
        if reached >= stop_radius:
            break
    return freeze, steps


def freeze_field(n=361, alpha=1.0, beta=0.40, gamma=0.0001, stop_frac=0.9, tag="v1"):
    path = os.path.join(CACHE, f"snow_{tag}_{n}_{alpha}_{beta}_{gamma}.npz")
    if os.path.exists(path):
        d = np.load(path)
        return d["freeze"], int(d["steps"])
    freeze, steps = _simulate(n, alpha, beta, gamma, 200000, int(n // 2 * stop_frac))
    np.savez_compressed(path, freeze=freeze.astype(np.float32), steps=steps)
    return freeze.astype(np.float32), steps
