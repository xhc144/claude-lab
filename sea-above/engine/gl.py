"""Headless OpenGL (EGL + Mesa llvmpipe) fragment-shader renderer.

Every shot is one big fragment shader that ray-marches the scene for each pixel.
A frame is the average of several "sub-frame" samples, each with its own
sub-pixel jitter, shutter time (motion blur) and lens position (depth of field),
accumulated additively in a float framebuffer.
"""
import os
import re

import moderngl
import numpy as np

SHADER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "shaders")

VERT = """#version 330
in vec2 in_pos;
void main(){ gl_Position = vec4(in_pos, 0.0, 1.0); }
"""

HEADER = """#version 330
uniform vec2  uRes;        // framebuffer size in pixels
uniform vec2  uJitter;     // sub-pixel offset in pixels
uniform vec2  uLens;       // lens sample in the unit disk
uniform float uTime;       // shot-local time (s) of this sample
uniform float uSeed;       // per-sample random seed
uniform float uWeight;     // 1 / number of samples
uniform vec3  uCamPos;
uniform mat3  uCamRot;     // columns: right, up, forward
uniform float uTanFov;     // tan(vertical fov / 2)
uniform float uFocus;      // focus distance (world units)
uniform float uAperture;   // lens radius (world units)
uniform vec4  uRegion;     // x0, y0, x1, y1 in pixels of the full frame (tiling)
layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 fragAux;
"""

FOOTER = """
void main(){
    vec2 px = gl_FragCoord.xy + uRegion.xy + uJitter;
    vec2 uv = (2.0 * px - uRes) / uRes.y;
    vec3 ro = uCamPos;
    vec3 rd = normalize(uCamRot * vec3(uv * uTanFov, 1.0));
    if (uAperture > 0.0) {
        vec3 fp = ro + rd * (uFocus / dot(rd, uCamRot[2]));
        ro += uCamRot * vec3(uLens * uAperture, 0.0);
        rd = normalize(fp - ro);
    }
    float depth;
    vec3 col = renderScene(ro, rd, px, depth);
    col = max(col, vec3(0.0));
    // guard against NaN/inf fireflies
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    col = min(col, vec3(4000.0));
    fragColor = vec4(col * uWeight, 1.0);
    // inverse depth averages sensibly across samples (circle of confusion is linear in it)
    fragAux = vec4(uWeight / max(depth, 1e-4), 0.0, 0.0, 1.0);
}
"""

_include_re = re.compile(r'^\s*#include\s+"([^"]+)"\s*$', re.M)


def load_source(name, seen=None):
    seen = set() if seen is None else seen
    path = os.path.join(SHADER_DIR, name)
    if path in seen:
        return ""
    seen.add(path)
    with open(path) as f:
        src = f.read()
    return _include_re.sub(lambda m: load_source(m.group(1), seen), src)


class Renderer:
    def __init__(self, width, height, tile_h=None):
        self.ctx = moderngl.create_standalone_context(backend="egl")
        self.w, self.h = width, height
        self.tile_h = tile_h or height
        quad = np.array([-1, -1, 1, -1, -1, 1, 1, 1], "f4")
        self.vbo = self.ctx.buffer(quad.tobytes())
        self.color = self.ctx.texture((width, self.tile_h), 4, dtype="f4")
        self.aux = self.ctx.texture((width, self.tile_h), 4, dtype="f4")
        self.fbo = self.ctx.framebuffer([self.color, self.aux])
        self._progs = {}
        self.textures = {}     # uniform name -> moderngl texture
        self.extra = {}        # uniform name -> value (set on every program that has it)
        self._terrain = False

    def use_terrain(self):
        """Bake/load terrain height textures and expose them to shaders."""
        if self._terrain:
            return
        from engine.bake import terrain_textures
        for name, (tex, box) in terrain_textures(self.ctx).items():
            key = "uHNear" if name == "near" else "uHFar"
            self.textures[key] = tex
            self.extra[key + "Box"] = box
        self._terrain = True

    def program(self, shader_name, defines=None):
        key = (shader_name, tuple(sorted((defines or {}).items())))
        if key not in self._progs:
            defs = "".join(f"#define {k} {v}\n" for k, v in (defines or {}).items())
            body = load_source(shader_name)
            src = HEADER + defs + body + FOOTER
            try:
                prog = self.ctx.program(vertex_shader=VERT, fragment_shader=src)
            except moderngl.Error as e:
                # print numbered source around the error for debugging
                lines = src.split("\n")
                m = re.search(r"0:(\d+)\(", str(e))
                if m:
                    ln = int(m.group(1))
                    for i in range(max(0, ln - 6), min(len(lines), ln + 3)):
                        print(f"{i + 1:5d}: {lines[i]}")
                raise
            vao = self.ctx.vertex_array(prog, [(self.vbo, "2f", "in_pos")])
            self._progs[key] = (prog, vao)
        return self._progs[key]

    @staticmethod
    def _set(prog, name, value):
        if name not in prog:
            return
        u = prog[name]
        if isinstance(value, np.ndarray):
            value = tuple(value.astype("f4").ravel(order="F")) if value.ndim == 2 else tuple(value.astype("f4"))
        u.value = value

    def render(self, shader_name, samples, defines=None):
        """samples: list of dicts of uniform values (one per sub-frame sample).

        Returns (rgb float32 HxWx3, inverse depth float32 HxW), origin top-left.
        """
        defines = dict(defines or {})
        if self._terrain:
            defines.setdefault("BAKED_TERRAIN", 1)
        prog, vao = self.program(shader_name, defines)
        for unit, (name, tex) in enumerate(self.textures.items()):
            if name in prog:
                tex.use(unit)
                prog[name].value = unit
        for k, v in self.extra.items():
            self._set(prog, k, v)
        n = len(samples)
        out = np.zeros((self.h, self.w, 3), np.float32)
        dep = np.zeros((self.h, self.w), np.float32)
        ctx = self.ctx
        self.fbo.use()
        ctx.enable(moderngl.BLEND)
        ctx.blend_func = moderngl.ONE, moderngl.ONE
        for y0 in range(0, self.h, self.tile_h):
            th = min(self.tile_h, self.h - y0)
            # GL origin is bottom-left; tile rows are counted from the bottom
            gy0 = self.h - y0 - th
            self.fbo.viewport = (0, 0, self.w, th)
            self.fbo.clear(0, 0, 0, 0)
            for s in samples:
                self._set(prog, "uRes", (float(self.w), float(self.h)))
                self._set(prog, "uRegion", (0.0, float(gy0), float(self.w), float(gy0 + th)))
                self._set(prog, "uWeight", 1.0 / n)
                for k, v in s.items():
                    self._set(prog, k, v)
                vao.render(moderngl.TRIANGLE_STRIP)
            ctx.finish()
            c = np.frombuffer(self.color.read(), "f4").reshape(self.tile_h, self.w, 4)[:th]
            a = np.frombuffer(self.aux.read(), "f4").reshape(self.tile_h, self.w, 4)[:th]
            out[y0:y0 + th] = c[::-1, :, :3]
            dep[y0:y0 + th] = a[::-1, :, 0]
        ctx.disable(moderngl.BLEND)
        return out, dep

    # ------------------------------------------------------------ depth of field
    def dof(self, rgb, invdepth, focus, k_px, max_px=64.0, taps=192):
        """Bokeh depth of field by scatter-as-gather.

        Circle of confusion in pixels: coc = k_px * (1/focus - 1/depth),
        positive behind the focal plane, negative in front of it.
        """
        h, w = invdepth.shape
        if not hasattr(self, "_dof_prog"):
            src = DOF_FS
            self._dof_prog = self.ctx.program(vertex_shader=VERT, fragment_shader=src)
            self._dof_vao = self.ctx.vertex_array(self._dof_prog, [(self.vbo, "2f", "in_pos")])
        coc = np.clip(k_px * (1.0 / focus - invdepth), -max_px, max_px).astype(np.float32)
        # pre-filter: large circles of confusion gather from a softened image, so
        # big bokeh discs come out smooth instead of speckled
        import cv2
        ac = np.abs(coc)
        pre = rgb
        for sig, lo, hi in ((2.0, 6.0, 14.0), (5.0, 14.0, 30.0), (10.0, 30.0, 60.0)):
            if ac.max() <= lo:
                break
            b = cv2.GaussianBlur(rgb, (0, 0), sig * max_px / 80.0)
            wgt = np.clip((ac - lo) / (hi - lo), 0.0, 1.0)[..., None]
            pre = pre * (1.0 - wgt) + b * wgt
        rgb = pre
        tc = self.ctx.texture((w, h), 3, np.ascontiguousarray(rgb[::-1]).astype("f4").tobytes(), dtype="f4")
        tk = self.ctx.texture((w, h), 1, np.ascontiguousarray(coc[::-1]).tobytes(), dtype="f4")
        for t in (tc, tk):
            t.filter = (moderngl.LINEAR, moderngl.LINEAR)
            t.repeat_x = t.repeat_y = False
        out = self.ctx.texture((w, h), 4, dtype="f4")
        fbo = self.ctx.framebuffer([out])
        fbo.use()
        tc.use(0)
        tk.use(1)
        p = self._dof_prog
        p["uCol"].value = 0
        p["uCoc"].value = 1
        p["uRes"].value = (float(w), float(h))
        p["uMax"].value = float(min(max_px, max(1.0, np.abs(coc).max())))
        p["uTaps"].value = int(taps)
        self._dof_vao.render(moderngl.TRIANGLE_STRIP)
        self.ctx.finish()
        res = np.frombuffer(out.read(), "f4").reshape(h, w, 4)[::-1, :, :3].copy()
        for o in (tc, tk, out, fbo):
            o.release()
        return res


DOF_FS = """#version 330
uniform sampler2D uCol;
uniform sampler2D uCoc;
uniform vec2 uRes;
uniform float uMax;
uniform int uTaps;
out vec4 fragColor;
void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float c0 = texture(uCoc, uv).r;
    float rot0 = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    float area = 3.14159 * uMax * uMax / float(uTaps);
    // the centre pixel itself
    {
        float r0 = max(abs(c0), 0.5);
        float w = min(area / (3.14159 * r0 * r0), 1.0) + 1e-3;
        acc += texture(uCol, uv).rgb * w;
        wsum += w;
    }
    for (int i = 0; i < 1024; i++) {
        if (i >= uTaps) break;
        float r = sqrt((float(i) + 0.5) / float(uTaps)) * uMax;
        float a = float(i) * 2.39996323 + rot0;
        vec2 suv = uv + vec2(cos(a), sin(a)) * r / uRes;
        float cs = texture(uCoc, suv).r;
        // a sample behind the centre pixel cannot blur over it further than the centre's own blur
        float reach = abs(cs);
        if (cs > c0) reach = min(reach, abs(c0) + 1.0);
        float cover = clamp(reach - r + 0.75, 0.0, 1.0);
        float rs = max(abs(cs), 0.5);
        float w = cover * min(area / (3.14159 * rs * rs), 1.0);
        acc += texture(uCol, suv).rgb * w;
        wsum += w;
    }
    fragColor = vec4(acc / max(wsum, 1e-6), 1.0);
}
"""
