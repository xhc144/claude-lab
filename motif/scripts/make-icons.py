#!/usr/bin/env python3
"""Draws the Motif app icon (conic-gradient tile with a dark diamond, matching the in-app logo)
and writes build/icon.png (1024) and build/icon.ico (16–256). Requires Pillow."""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter

out = os.path.join(os.path.dirname(__file__), '..', 'build')
os.makedirs(out, exist_ok=True)
N = 1024
stops = [(0.0, (124, 109, 255)), (0.25, (208, 139, 255)), (0.5, (90, 209, 255)), (0.75, (62, 207, 142)), (1.0, (124, 109, 255))]

def conic(u):
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if a <= u <= b:
            k = (u - a) / (b - a)
            return tuple(round(ca[i] + (cb[i] - ca[i]) * k) for i in range(3))
    return stops[-1][1]

img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
px = img.load()
cx = cy = N / 2
for y in range(N):
    for x in range(N):
        ang = (math.atan2(y - cy, x - cx) + math.pi * 1.6) % (2 * math.pi)
        px[x, y] = conic(ang / (2 * math.pi)) + (255,)
mask = Image.new('L', (N, N), 0)
ImageDraw.Draw(mask).rounded_rectangle((40, 40, N - 40, N - 40), radius=230, fill=255)
tile = Image.new('RGBA', (N, N), (0, 0, 0, 0))
tile.paste(img, (0, 0), mask)
# inner highlight
hl = Image.new('RGBA', (N, N), (0, 0, 0, 0))
ImageDraw.Draw(hl).rounded_rectangle((40, 40, N - 40, N - 40), radius=230, outline=(255, 255, 255, 70), width=10)
tile = Image.alpha_composite(tile, hl)
# diamond
d = Image.new('RGBA', (N, N), (0, 0, 0, 0))
s = 205
ImageDraw.Draw(d).rounded_rectangle((cx - s, cy - s, cx + s, cy + s), radius=46, fill=(12, 13, 17, 255))
d = d.rotate(45, resample=Image.BICUBIC, center=(cx, cy))
tile = Image.alpha_composite(tile, d)
tile.save(os.path.join(out, 'icon.png'))
tile.save(os.path.join(out, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('icons written to', os.path.abspath(out))
