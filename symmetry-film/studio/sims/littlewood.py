"""Density image of all roots of polynomials with coefficients ±1 (Littlewood polynomials)."""
import os
import sys
import time
from multiprocessing import Pool

import numpy as np

from ..core import CACHE

EXTENT = 1.75  # image covers [-EXTENT, EXTENT]^2
RES = 8192


def _roots_chunk(args):
    deg, start, count = args
    # coefficient bits -> companion matrices; leading coefficient fixed to +1
    idx = np.arange(start, start + count, dtype=np.int64)
    bits = ((idx[:, None] >> np.arange(deg)[None, :]) & 1).astype(np.float64)
    coeffs = 1.0 - 2.0 * bits  # a_{deg-1} .. a_0 in order of bit index
    n = len(idx)
    C = np.zeros((n, deg, deg))
    C[:, 0, :] = -coeffs
    if deg > 1:
        C[:, np.arange(1, deg), np.arange(0, deg - 1)] = 1.0
    ev = np.linalg.eigvals(C)
    return ev.astype(np.complex64).ravel()


def _hist(roots, res=RES):
    x = ((roots.real + EXTENT) / (2 * EXTENT) * res).astype(np.int64)
    y = ((EXTENT - roots.imag) / (2 * EXTENT) * res).astype(np.int64)
    ok = (x >= 0) & (x < res) & (y >= 0) & (y < res)
    return np.bincount(y[ok] * res + x[ok], minlength=res * res).astype(np.float32)


def density(max_deg=22, jobs=4):
    path = os.path.join(CACHE, f"littlewood_{max_deg}_{RES}.npy")
    if os.path.exists(path):
        return np.load(path, mmap_mode="r")
    t0 = time.time()
    hist = np.zeros(RES * RES, np.float32)
    tasks = []
    for deg in range(1, max_deg + 1):
        total = 2 ** deg
        step = 1 << 14
        for s in range(0, total, step):
            tasks.append((deg, s, min(step, total - s)))
    with Pool(jobs) as pool:
        for i, r in enumerate(pool.imap_unordered(_roots_chunk, tasks)):
            hist += _hist(r)
            if i % 50 == 0:
                print(f"littlewood {i}/{len(tasks)} {time.time() - t0:.0f}s", flush=True)
    img = hist.reshape(RES, RES)
    np.save(path, img)
    return np.load(path, mmap_mode="r")


if __name__ == "__main__":
    density(int(sys.argv[1]) if len(sys.argv) > 1 else 22)
