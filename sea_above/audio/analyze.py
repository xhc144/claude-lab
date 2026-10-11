"""Visual check of a soundtrack: log-frequency spectrogram + loudness curve."""
import sys
import wave

import cv2
import numpy as np
from scipy import signal


def main(path, out):
    w = wave.open(path)
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
    mono = x.mean(1)
    dur = len(mono) / sr
    print(f"peak {np.abs(x).max():.3f}  rms {20 * np.log10(np.sqrt((mono ** 2).mean()) + 1e-9):.1f} dBFS  dc {mono.mean():.5f}")
    win = int(0.25 * sr)
    k = len(mono) // win
    db = 10 * np.log10((mono[:k * win] ** 2).reshape(k, win).mean(1) + 1e-12)
    print("rms dB per second:", " ".join(f"{i}:{db[i * 4]:.0f}" for i in range(k // 4)))
    jumps = np.abs(np.diff(mono))
    print(f"max sample jump {jumps.max():.3f} at {np.argmax(jumps) / sr:.2f}s")
    f, t, S = signal.spectrogram(mono, sr, nperseg=4096, noverlap=2048)
    S = 10 * np.log10(S + 1e-12)
    lf = np.geomspace(30, 16000, 300)
    img = S[np.searchsorted(f, lf)][::-1]
    img = np.clip((img + 110) / 80, 0, 1)
    W = 1420
    img = cv2.applyColorMap(cv2.resize((img * 255).astype(np.uint8), (W, 300)), cv2.COLORMAP_MAGMA)
    curve = np.full((120, W, 3), 20, np.uint8)
    xs = np.linspace(0, W - 1, len(db)).astype(int)
    ys = (119 - np.clip((db + 60) / 60, 0, 1) * 115).astype(int)
    for i in range(len(xs) - 1):
        cv2.line(curve, (xs[i], ys[i]), (xs[i + 1], ys[i + 1]), (0, 220, 255), 1)
    for s in range(0, int(dur) + 1, 5):
        X = int(s / dur * (W - 1))
        cv2.line(curve, (X, 0), (X, 119), (80, 80, 80), 1)
        cv2.putText(curve, str(s), (X + 2, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)
    cv2.imwrite(out, np.vstack([img, curve]))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
