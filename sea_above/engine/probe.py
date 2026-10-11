"""Evaluate a GLSL expression at a list of points (e.g. terrain height for camera placement)."""
import moderngl
import numpy as np

from engine.gl import HEADER, VERT, load_source

_ctx = None


def probe(include, expr, points, time=0.0):
    """include: shader file, expr: GLSL float expression of `vec3 p`. Returns np.array."""
    global _ctx
    if _ctx is None:
        _ctx = moderngl.create_standalone_context(backend="egl")
    ctx = _ctx
    pts = np.asarray(points, np.float32).reshape(-1, 3)
    n = len(pts)
    src = HEADER + load_source(include) + f"""
uniform sampler2D uPts;
void main(){{
    vec3 p = texelFetch(uPts, ivec2(gl_FragCoord.xy), 0).xyz;
    fragColor = vec4({expr}, 0.0, 0.0, 1.0);
    fragAux = vec4(0.0);
}}
"""
    prog = ctx.program(vertex_shader=VERT, fragment_shader=src)
    tex = ctx.texture((n, 1), 3, pts.tobytes(), dtype="f4")
    tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
    tex.use(0)
    if "uPts" in prog:
        prog["uPts"].value = 0
    if "uTime" in prog:
        prog["uTime"].value = float(time)
    out = ctx.texture((n, 1), 4, dtype="f4")
    aux = ctx.texture((n, 1), 4, dtype="f4")
    fbo = ctx.framebuffer([out, aux])
    vbo = ctx.buffer(np.array([-1, -1, 1, -1, -1, 1, 1, 1], "f4").tobytes())
    vao = ctx.vertex_array(prog, [(vbo, "2f", "in_pos")])
    fbo.use()
    fbo.viewport = (0, 0, n, 1)
    vao.render(moderngl.TRIANGLE_STRIP)
    return np.frombuffer(out.read(), "f4").reshape(n, 4)[:, 0].copy()
