"""Render the shared 1920x1080 background: deep navy, soft centre glow, faint dot grid, grain."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("build/bg.png")
W, H = 1920, 1080
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
cx, cy = W * 0.5, H * 0.42
r = np.sqrt(((xx - cx) / W) ** 2 + ((yy - cy) / H) ** 2 * 0.8)
glow = np.clip(1.0 - r / 0.75, 0, 1) ** 2
base = np.array([11, 16, 32], np.float32)          # #0B1020
hi = np.array([24, 34, 64], np.float32)            # centre tint
img = base[None, None, :] * (1 - glow[..., None]) + hi[None, None, :] * glow[..., None]
vig = np.clip(1.0 - (r - 0.45) * 0.9, 0.62, 1.0)
img *= vig[..., None]
# faint dot grid every 54 px
g = 54
dots = (((xx + g / 2) % g < 2.2) & ((yy + g / 2) % g < 2.2)).astype(np.float32)
img += dots[..., None] * np.array([18, 24, 40], np.float32) * (0.35 + 0.65 * glow[..., None])
rng = np.random.default_rng(7)
img += rng.normal(0, 1.6, img.shape).astype(np.float32)
out.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(out)
print("wrote", out)
