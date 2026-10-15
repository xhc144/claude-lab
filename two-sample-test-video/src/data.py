"""片中所有数据。固定种子，保证每次渲染一致，且和旁白念到的数字吻合。"""
import numpy as np

N = 40


def _class_scores(seed, mean, sd, lo=50, hi=99):
    """40 个整数分数，均值恰好等于 mean，样本标准差四舍五入后等于 sd。"""
    rng = np.random.default_rng(seed)
    x = np.clip(np.round(rng.normal(mean, sd, N)), lo, hi).astype(int)
    target_sum = int(round(mean * N))
    while x.sum() != target_sum:
        i = rng.integers(N)
        step = 1 if x.sum() < target_sum else -1
        if lo <= x[i] + step <= hi:
            x[i] += step
    for _ in range(20000):
        s = x.std(ddof=1)
        if round(s, 1) == sd:
            break
        i, j = rng.integers(N, size=2)
        if i == j:
            continue
        # 一个加一、一个减一，均值不变；按方向挑选让标准差靠近目标的一对
        widen = s < sd
        a, b = (i, j) if (x[i] >= x[j]) == widen else (j, i)
        if lo <= x[a] + 1 <= hi and lo <= x[b] - 1 <= hi:
            x[a] += 1
            x[b] -= 1
    assert round(x.std(ddof=1), 1) == sd and x.sum() == target_sum
    return np.sort(x)


NEW = _class_scores(7, 78.4, 9.6)   # 新方法班（靛蓝）
OLD = _class_scores(11, 75.1, 10.8)  # 旧方法班（赭橙）
POOL = np.concatenate([NEW, OLD])


def split_gap(mask):
    return POOL[mask].mean() - POOL[~mask].mean()


def find_shuffles(targets=(0.8, 2.1, 1.3, 3.6), seed=3):
    """找出平均分之差（绝对值）恰好是 targets 的随机分组。"""
    rng = np.random.default_rng(seed)
    found = []
    for t in targets:
        while True:
            m = np.zeros(2 * N, bool)
            m[rng.choice(2 * N, N, replace=False)] = True
            g = split_gap(m)
            if abs(abs(g) - t) < 1e-9 and g > 0:
                found.append(m)
                break
    return found


SHUFFLES = find_shuffles()


def fast_shuffles(k=90, seed=5):
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(k):
        m = np.zeros(2 * N, bool)
        m[rng.choice(2 * N, N, replace=False)] = True
        out.append(m)
    return out


FAST = fast_shuffles()

# 配对实验：10 个学生前测、后测
BEFORE = np.array([62, 71, 85, 58, 90, 77, 68, 81, 74, 93])
DIFF = np.array([3, 5, 2, 4, 1, 6, 2, 3, -1, 4])
AFTER = BEFORE + DIFF

# 附加题做对人数
RIGHT_NEW, RIGHT_OLD = 26, 16

if __name__ == "__main__":
    print("NEW", NEW.tolist(), NEW.mean(), round(NEW.std(ddof=1), 3))
    print("OLD", OLD.tolist(), OLD.mean(), round(OLD.std(ddof=1), 3))
    print("shuffle gaps", [round(split_gap(m), 2) for m in SHUFFLES])
    print("fast gaps", [round(abs(split_gap(m)), 2) for m in FAST[:12]])
