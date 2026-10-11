"""最小示例：20 行代码生成一段 8 秒的"六次对称万花筒"视频。

    python examples/mini.py      # 只需要 numpy 和 ffmpeg，输出 mini.mp4
"""
import numpy as np, subprocess

W, H, FPS, SECONDS = 960, 540, 30, 8
ffmpeg = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-pix_fmt", "yuv420p", "mini.mp4"],
                          stdin=subprocess.PIPE)
y, x = np.mgrid[-1:1:H * 1j, -16 / 9:16 / 9:W * 1j]        # 每个像素的坐标
r, a = np.hypot(x, y), np.arctan2(y, x)                    # 极坐标

for i in range(FPS * SECONDS):
    t = i / FPS
    k = np.pi / 6                                          # 6 次对称 → 雪花的群 D6
    f = np.abs((a + 0.3 * t) % (2 * k) - k)                # 把角度"折叠"进一个镜像扇区
    v = np.cos(25 * r * np.cos(f) - 2 * t) * np.cos(14 * r * np.sin(f) + t)
    glow = np.exp(-2.5 * r)
    img = np.stack([0.4 * v + 0.2, 0.7 * v + 0.4, v + 0.7], -1) * glow[..., None] * 1.6
    ffmpeg.stdin.write((np.clip(img, 0, 1) * 255).astype(np.uint8).tobytes())

ffmpeg.stdin.close()
ffmpeg.wait()
