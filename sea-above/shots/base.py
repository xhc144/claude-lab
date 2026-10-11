"""Shot definition: a shader, a duration, a camera rig and per-frame uniforms."""
import numpy as np

from engine.sampling import frame_samples

FPS = 24


class Shot:
    name = "shot"
    shader = None
    duration = 5.0
    spp = 4                 # samples per pixel for the final render
    shutter = 0.5           # fraction of the frame interval (180 degrees)
    defines = {}
    post = {}

    def camera(self, t):
        """Return dict(pos, rot (3x3 columns right/up/fwd), tanfov, focus, aperture)."""
        raise NotImplementedError

    def uniforms(self, t):
        return {}

    def post_at(self, t):
        return dict(self.post)

    def frame_count(self):
        return int(round(self.duration * FPS))

    def samples(self, frame, spp=None, aa=1.0):
        n = spp or self.spp
        t0 = frame / FPS
        out = []
        for (jx, jy), dt, (lx, ly), seed in frame_samples(n, frame, FPS, self.shutter):
            t = t0 + dt
            cam = self.camera(t)
            u = dict(
                uJitter=(jx * aa, jy * aa),
                uLens=(lx, ly),
                uTime=float(t),
                uSeed=float(seed),
                uCamPos=tuple(np.asarray(cam["pos"], np.float32)),
                uCamRot=np.asarray(cam["rot"], np.float32),
                uTanFov=float(cam.get("tanfov", 0.4)),
                uFocus=float(cam.get("focus", 10.0)),
                uAperture=float(cam.get("aperture", 0.0)),
                uWorldTime=float(t),
            )
            u.update(self.uniforms(t))
            out.append(u)
        return out


def project(cam, p, aspect=1920 / 816):
    """Screen position of world point p: x in [-1,1] (left..right), y in [-1,1] (bottom..top)."""
    rot = np.asarray(cam["rot"])
    pos = np.asarray(cam.get("local", cam["pos"]))
    d = rot.T @ (np.asarray(p, float) - pos)
    if d[2] <= 0:
        return None
    tf = cam.get("tanfov", 0.4)
    return d[0] / d[2] / tf / aspect, d[1] / d[2] / tf, d[2]
