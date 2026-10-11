"""Scene base class."""
from ..core import Frame


class Scene:
    duration = 10.0
    bloom = 0.5
    bloom_threshold = 0.6
    vignette = 0.55
    grain = 0.012

    def draw(self, f: Frame, t: float):  # pragma: no cover - interface
        raise NotImplementedError

    def render(self, t, scale=1.0):
        f = Frame(scale)
        out = self.draw(f, t)
        return f.rgb() if out is None else out
