"""Bake slowly-varying procedural fields (terrain) into float textures."""
import os

import moderngl
import numpy as np

from engine.gl import HEADER, VERT, load_source

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "cache")

# (name, x0, z0, width, depth, texels per metre)
TERRAIN_LAYERS = [
    ("near", -1200.0, -2600.0, 2600.0, 3400.0, 1.0),
    ("far", -10000.0, -17000.0, 20000.0, 24000.0, 1.0 / 8.0),
]


def bake_field(ctx, include, expr, x0, z0, w, d, res):
    nx, nz = int(round(w * res)), int(round(d * res))
    src = HEADER + load_source(include) + f"""
uniform vec4 uBox;   // x0, z0, dx, dz
void main() {{
    vec2 p = uBox.xy + (gl_FragCoord.xy - 0.5) * uBox.zw;
    fragColor = vec4({expr}, 0.0, 0.0, 1.0);
    fragAux = vec4(0.0);
}}
"""
    prog = ctx.program(vertex_shader=VERT, fragment_shader=src)
    vbo = ctx.buffer(np.array([-1, -1, 1, -1, -1, 1, 1, 1], "f4").tobytes())
    vao = ctx.vertex_array(prog, [(vbo, "2f", "in_pos")])
    out = np.zeros((nz, nx), np.float32)
    tile = 4096
    for j0 in range(0, nz, tile):
        for i0 in range(0, nx, tile):
            tw, th = min(tile, nx - i0), min(tile, nz - j0)
            c = ctx.texture((tw, th), 4, dtype="f4")
            a = ctx.texture((tw, th), 4, dtype="f4")
            fbo = ctx.framebuffer([c, a])
            fbo.use()
            fbo.viewport = (0, 0, tw, th)
            prog["uBox"].value = (x0 + i0 / res, z0 + j0 / res, 1.0 / res, 1.0 / res)
            vao.render(moderngl.TRIANGLE_STRIP)
            out[j0:j0 + th, i0:i0 + tw] = np.frombuffer(c.read(), "f4").reshape(th, tw, 4)[:, :, 0]
            for o in (c, a, fbo):
                o.release()
    return out


def terrain_textures(ctx):
    """Return {name: (texture, box)} for the world-below terrain, baking on first use."""
    os.makedirs(CACHE, exist_ok=True)
    out = {}
    for name, x0, z0, w, d, res in TERRAIN_LAYERS:
        path = os.path.join(CACHE, f"terrain_{name}.npy")
        if os.path.exists(path):
            arr = np.load(path)
        else:
            arr = bake_field(ctx, "world_below.glsl", "terrBaseSmooth(p)", x0, z0, w, d, res)
            np.save(path, arr)
        nz, nx = arr.shape
        tex = ctx.texture((nx, nz), 1, arr.tobytes(), dtype="f4")
        tex.filter = (moderngl.LINEAR, moderngl.LINEAR)
        tex.repeat_x = tex.repeat_y = False
        # texel centres: u = (p - x0 + 0.5/res) / (nx/res)
        box = (x0 - 0.5 / res, z0 - 0.5 / res, res / nx, res / nz)
        out[name] = (tex, box)
    return out
