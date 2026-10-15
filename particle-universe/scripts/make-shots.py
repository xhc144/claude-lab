"""Turns test renders into app assets and README screenshots.

  test-output/hq/<scene>.png   -> src/renderer/assets/scenes/<scene>.webp   (scene picker cards)
                               -> docs/screenshots/<scene>.jpg, <scene>-thumb.jpg
  test-output/ui/<name>.png    -> docs/screenshots/ui-*.jpg
"""
import os
import sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SCENES = ['nebula', 'blackhole', 'galaxy', 'storm', 'silk', 'resonance', 'warp', 'attractor']
UI = {'01-welcome': 'ui-welcome', '03-settings': 'ui-settings', '07-scenes': 'ui-scenes', '08-export': 'ui-export'}


def p(*a):
    return os.path.join(ROOT, *a)


def crop_to(im, aspect):
    w, h = im.size
    if w / h > aspect:
        nw = int(h * aspect)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = int(w / aspect)
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


os.makedirs(p('src/renderer/assets/scenes'), exist_ok=True)
os.makedirs(p('docs/screenshots'), exist_ok=True)
for s in SCENES:
    src = p('test-output/hq', s + '.png')
    if not os.path.exists(src):
        print('missing', src)
        continue
    im = Image.open(src).convert('RGB')
    card = crop_to(im, 16 / 10).resize((400, 250), Image.LANCZOS)
    card.save(p('src/renderer/assets/scenes', s + '.webp'), 'WEBP', quality=84, method=6)
    im.save(p('docs/screenshots', s + '.jpg'), 'JPEG', quality=88, optimize=True, progressive=True)
    im.resize((400, 225), Image.LANCZOS).save(p('docs/screenshots', s + '-thumb.jpg'), 'JPEG', quality=86, optimize=True)
for k, v in UI.items():
    src = p('test-output/ui', k + '.png')
    if os.path.exists(src):
        im = Image.open(src).convert('RGB')
        im.resize((960, int(960 * im.size[1] / im.size[0])), Image.LANCZOS).save(p('docs/screenshots', v + '.jpg'), 'JPEG', quality=86, optimize=True)
print('done')
