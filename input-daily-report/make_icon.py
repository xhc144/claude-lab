"""生成图标（橙色圆角方块 + 三根白色柱子），不需要额外的库。

输出：输入日报.ico（快捷方式用，含 16–256 多个尺寸）和 icons/icon-*.png（窗口和任务栏用，16–512）。
柱子边缘按每个尺寸对齐像素，小图也不发糊。
"""

import struct
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
BG = (194, 96, 58)
FG = (255, 255, 255)
BARS = ((0.21, 0.54), (0.43, 0.30), (0.65, 0.42))  # 每根柱子的 左边 和 顶部（归一化）
BAR_W, BAR_BOTTOM, RADIUS = 0.15, 0.79, 0.22
SS = 4  # 超采样，圆角抗锯齿


def render(n):
    # 柱子按像素取整，边缘落在像素格上
    bars = [(round(l * n), round(t * n), round((l + BAR_W) * n), round(BAR_BOTTOM * n)) for l, t in BARS]
    rows = []
    for py in range(n):
        row = bytearray(b"\0")
        for px in range(n):
            inside = 0
            for sy in range(SS):
                for sx in range(SS):
                    x, y = (px + (sx + 0.5) / SS) / n, (py + (sy + 0.5) / SS) / n
                    cx, cy = min(max(x, RADIUS), 1 - RADIUS), min(max(y, RADIUS), 1 - RADIUS)
                    inside += (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS * RADIUS
            on_bar = any(x0 <= px < x1 and y0 <= py < y1 for x0, y0, x1, y1 in bars)
            r, g, b = FG if on_bar else BG
            row += bytes((r, g, b, inside * 255 // (SS * SS)))
        rows.append(bytes(row))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))


PNG_SIZES = [16, 24, 32, 48, 64, 96, 128, 192, 256, 512]
ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 256]


def main():
    out = HERE / "icons"
    out.mkdir(exist_ok=True)
    cache = {}
    for n in sorted(set(PNG_SIZES + ICO_SIZES)):
        cache[n] = render(n)
    for n in PNG_SIZES:
        (out / f"icon-{n}.png").write_bytes(cache[n])

    head = struct.pack("<HHH", 0, 1, len(ICO_SIZES))
    offset = 6 + 16 * len(ICO_SIZES)
    entries = b""
    for n in ICO_SIZES:
        entries += struct.pack("<BBBBHHII", n % 256, n % 256, 0, 0, 1, 32, len(cache[n]), offset)
        offset += len(cache[n])
    (HERE / "输入日报.ico").write_bytes(head + entries + b"".join(cache[n] for n in ICO_SIZES))
    print(f"生成了 {len(PNG_SIZES)} 个 PNG 和 1 个 ICO")


if __name__ == "__main__":
    main()
