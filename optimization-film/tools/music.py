"""合成一段安静的背景铺底音乐：慢速和弦 pad + 稀疏的钢片琴泛音，全部由 numpy 生成。

    python tools/music.py 1150 build/music.wav    # 时长（秒）与输出路径
"""
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# D 大调里的一组柔和进行：Dmaj9 – Bm9 – Gmaj9 – A6/9（每个和弦 9.6 秒）
CHORDS = [[50, 57, 62, 66, 69, 76], [47, 54, 61, 62, 66, 73], [43, 50, 57, 59, 66, 69], [45, 52, 57, 59, 64, 71]]
BAR = 9.6


def pad(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rng = np.random.default_rng(1)
    k = 0
    start = 0.0
    while start < dur:
        notes = CHORDS[k % len(CHORDS)]
        a, b = int(start * SR), min(int((start + BAR + 3.0) * SR), n)
        tt = t[a:b] - start
        env = np.minimum(1, tt / 3.2) * np.clip((BAR + 3.0 - tt) / 3.0, 0, 1)
        seg = np.zeros(b - a)
        for m in notes:
            for det in (-0.07, 0.0, 0.06):                 # 三个略微失谐的声部，产生缓慢的合唱感
                f = midi(m) * 2 ** (det / 12)
                ph = rng.uniform(0, 2 * np.pi)
                seg += (np.sin(2 * np.pi * f * tt + ph) + 0.18 * np.sin(4 * np.pi * f * tt + ph)) / (1 + (m - 50) / 24)
        out[a:b] += seg * env
        start += BAR
        k += 1
    sos = butter(2, 1800, "low", fs=SR, output="sos")
    return sosfilt(sos, out)


def bells(dur):
    n = int(dur * SR)
    out = np.zeros(n)
    rng = np.random.default_rng(5)
    scale = [74, 76, 78, 81, 83, 86, 88]
    tcur = 2.0
    while tcur < dur - 3:
        m = scale[rng.integers(len(scale))]
        f = midi(m)
        L = int(3.5 * SR)
        a = int(tcur * SR)
        b = min(a + L, n)
        tt = np.arange(b - a) / SR
        mod = 1.4 * np.exp(-tt * 2.5) * np.sin(2 * np.pi * f * 3.5 * tt)      # 轻微的调频，像钢片琴
        out[a:b] += np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt * 1.6) * 0.5
        tcur += rng.uniform(2.5, 6.0)
    return out


def reverb(x, seconds=2.8):
    """用指数衰减的噪声冲激响应做一个简单的卷积混响。"""
    rng = np.random.default_rng(9)
    L = int(seconds * SR)
    ir = rng.normal(0, 1, L) * np.exp(-np.arange(L) / SR * 3.0)
    ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x) + L
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return y


def main():
    dur = float(sys.argv[1])
    dst = sys.argv[2]
    x = pad(dur) + 0.35 * bells(dur)
    wet = reverb(x)
    y = 0.55 * x + 0.8 * wet
    left = y
    right = np.roll(y, int(0.012 * SR))                   # 极小的声道延迟，拉开立体声宽度
    st = np.stack([left, right], 1)
    fade = int(4 * SR)
    st[:fade] *= np.linspace(0, 1, fade)[:, None]
    st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    st *= 0.25 / (np.sqrt(np.mean(st ** 2)) + 1e-9) * 0.35   # 约 -21 dBFS RMS，混音时再压低
    peak = np.abs(st).max()
    if peak > 0.9:
        st *= 0.9 / peak
    sf.write(dst, st.astype(np.float32), SR, subtype="PCM_16")
    print(dst, f"{dur:.1f}s")


if __name__ == "__main__":
    main()
