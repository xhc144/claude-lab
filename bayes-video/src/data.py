"""全片用到的数，都在这里算：python data.py 打印核对表。

一、化验：患病率 1%，病人查出阳性的概率 90%，健康人误报的概率 9%。
二、新秀的三分命中率 θ：联盟先验 Beta(15, 25)，再看他的投篮。
三、命中率随距离变化的逻辑回归：两个参数的后验，用 Metropolis 抽样。
"""
import math

import numpy as np
from scipy import stats

# ---------------------------------------------------------------- 一、化验
PREV, SENS, FPR = 0.01, 0.90, 0.09
N_PEOPLE = 1000
SICK = round(N_PEOPLE * PREV)                     # 10
TRUE_POS = round(SICK * SENS)                     # 9
HEALTHY = N_PEOPLE - SICK                         # 990
FALSE_POS = round(HEALTHY * FPR)                  # 89
POS = TRUE_POS + FALSE_POS                        # 98


def update(prior, sens=SENS, fpr=FPR):
    """一次阳性之后得病的概率。"""
    return prior * sens / (prior * sens + (1 - prior) * fpr)


POST1 = update(PREV)                              # ≈ 0.0917
POST2 = update(POST1)                             # ≈ 0.503
POST3 = update(POST2)                             # ≈ 0.910
# 98 个阳性的人再测一次：真病人里约 8.1 个、误报里约 8.0 个再次阳性
AGAIN_TP, AGAIN_FP = TRUE_POS * SENS, FALSE_POS * FPR

# 在一千个点的方阵里，哪些是病人、哪些阳性（固定种子，每次渲染一样）
GRID_COLS, GRID_ROWS = 40, 25
_rng = np.random.default_rng(7)
SICK_IDX = sorted(_rng.choice(N_PEOPLE, SICK, replace=False).tolist())
TP_IDX = SICK_IDX[:TRUE_POS]
_healthy = [i for i in range(N_PEOPLE) if i not in SICK_IDX]
FP_IDX = sorted(_rng.choice(_healthy, FALSE_POS, replace=False).tolist())

# ---------------------------------------------------------------- 二、命中率
A0, B0 = 15, 25                                   # 联盟先验：相当于看过 40 投 15 中，均值 0.375
FAN = (30, 20)                                    # 球迷：认定是六成射手
FLAT = (1, 1)
SHOTS = [1, 1, 0, 1, 1, 1]                        # 前六投：五中
# 赛季检查点：(出手, 命中)
CHECKS = [(0, 0), (6, 5), (30, 14), (150, 60), (600, 240)]
LEAGUE_AVG = 0.35


def beta_pdf(x, a, b):
    x = np.clip(np.asarray(x, float), 1e-9, 1 - 1e-9)
    return np.exp((a - 1) * np.log(x) + (b - 1) * np.log1p(-x) - (math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)))


def beta_interval(a, b, mass=0.95):
    lo = (1 - mass) / 2
    return stats.beta.ppf(lo, a, b), stats.beta.ppf(1 - lo, a, b)


def checks_at(n):
    """出手 n 次时的命中数：在检查点之间线性插值，供曲线平滑变化。"""
    ns = [c[0] for c in CHECKS]
    hs = [c[1] for c in CHECKS]
    return float(np.interp(n, ns, hs))


SEASON_N, SEASON_H = 150, 60
POST_A, POST_B = A0 + SEASON_H, B0 + SEASON_N - SEASON_H        # Beta(75, 115)
POST_MEAN = POST_A / (POST_A + POST_B)
CRED = beta_interval(POST_A, POST_B)
P_ABOVE = 1 - stats.beta.cdf(LEAGUE_AVG, POST_A, POST_B)
W_PRIOR = (A0 + B0) / (A0 + B0 + SEASON_N)
FLAT_CRED = beta_interval(1 + SEASON_H, 1 + SEASON_N - SEASON_H)
_p = SEASON_H / SEASON_N
WALD = (_p - 1.96 * math.sqrt(_p * (1 - _p) / SEASON_N), _p + 1.96 * math.sqrt(_p * (1 - _p) / SEASON_N))

# 置信区间的“重复很多次”：真值 0.4，每次投 150 球，算 Wald 区间
TRUE_THETA = 0.40
_rng2 = np.random.default_rng(11)
CI_SIMS = []
for _h in _rng2.binomial(SEASON_N, TRUE_THETA, 20):
    _q = _h / SEASON_N
    _se = math.sqrt(_q * (1 - _q) / SEASON_N)
    CI_SIMS.append((_q - 1.96 * _se, _q + 1.96 * _se))
CI_MISS = sum(1 for lo, hi in CI_SIMS if not lo <= TRUE_THETA <= hi)

# ---------------------------------------------------------------- 三、逻辑回归与抽样
# 命中概率 p(d) = 1 / (1 + exp(−(α + β·d)))，d 是投篮距离（米）
TRUE_ALPHA, TRUE_BETA = 1.6, -0.32
_rng3 = np.random.default_rng(3)
DIST = _rng3.uniform(1, 8.5, 120)
MADE = (_rng3.uniform(size=DIST.size) < 1 / (1 + np.exp(-(TRUE_ALPHA + TRUE_BETA * DIST)))).astype(int)
PRIOR_SD = 2.5                                    # α、β 的先验都是 N(0, 2.5²)
AL_RANGE, BE_RANGE = (0.0, 4.0), (-0.8, 0.0)


def log_post(al, be):
    """未归一化的对数后验：对数似然 + 对数先验。分母 P(数据) 不出现。"""
    al, be = np.asarray(al, float), np.asarray(be, float)
    z = al[..., None] + be[..., None] * DIST
    ll = (MADE * z - np.logaddexp(0, z)).sum(-1)
    return ll - (al ** 2 + be ** 2) / (2 * PRIOR_SD ** 2)


def post_grid(nx=320, ny=180):
    al = np.linspace(*AL_RANGE, nx)
    be = np.linspace(*BE_RANGE, ny)
    A, B = np.meshgrid(al, be)
    lp = log_post(A, B)
    return al, be, np.exp(lp - lp.max())


def metropolis(n=6000, start=(3.8, 0.05), step=(0.32, 0.055), seed=5):
    """随机游走 Metropolis：返回每一步的提议、是否接受、当前位置。"""
    rng = np.random.default_rng(seed)
    cur = np.array(start, float)
    lp = log_post(*cur)
    out = []
    for _ in range(n):
        prop = cur + rng.normal(size=2) * step
        lq = log_post(*prop)
        r = math.exp(min(0.0, float(lq - lp)))
        ok = rng.uniform() < r
        out.append((prop.copy(), ok, r, cur.copy()))
        if ok:
            cur, lp = prop, lq
    return out


if __name__ == "__main__":
    print(f"一千人：病人 {SICK}，真阳性 {TRUE_POS}，健康 {HEALTHY}，误报 {FALSE_POS}，阳性共 {POS}")
    print(f"一次阳性后 P = {TRUE_POS}/{POS} = {TRUE_POS / POS:.4f}；公式 {POST1:.4f}")
    print(f"再测：真病人再阳性 {AGAIN_TP:.1f}，误报再阳性 {AGAIN_FP:.2f}；两次阳性 {POST2:.4f}，三次 {POST3:.4f}")
    a, b = A0, B0
    print(f"联盟先验 Beta({a},{b}) 均值 {a / (a + b):.3f}，95% 区间 {beta_interval(a, b)}")
    h = sum(SHOTS)
    print(f"六投{h}中：联盟后验 Beta({a + h},{b + 6 - h}) 均值 {(a + h) / (a + b + 6):.3f}；"
          f"平先验后验 Beta({1 + h},{1 + 6 - h}) 均值 {(1 + h) / 8:.3f}，众数 {h / 6:.3f}")
    for n, k in CHECKS[1:]:
        row = []
        for nm, (pa, pb) in (("联盟", (A0, B0)), ("平", FLAT), ("球迷", FAN)):
            qa, qb = pa + k, pb + n - k
            row.append(f"{nm} {qa / (qa + qb):.3f} [{beta_interval(qa, qb)[0]:.3f}, {beta_interval(qa, qb)[1]:.3f}]")
        print(f"n={n} h={k}: " + "；".join(row))
    print(f"赛季后验 Beta({POST_A},{POST_B})：均值 {POST_MEAN:.4f}，95% 可信区间 [{CRED[0]:.3f}, {CRED[1]:.3f}]，"
          f"P(θ>{LEAGUE_AVG}) = {P_ABOVE:.3f}")
    print(f"加权：先验权重 {W_PRIOR:.3f}，{W_PRIOR:.3f}×0.375 + {1 - W_PRIOR:.3f}×0.4 = "
          f"{W_PRIOR * 0.375 + (1 - W_PRIOR) * 0.4:.4f}")
    print(f"平先验可信区间 [{FLAT_CRED[0]:.3f}, {FLAT_CRED[1]:.3f}]；Wald 置信区间 [{WALD[0]:.3f}, {WALD[1]:.3f}]")
    print(f"20 次模拟置信区间，没盖住 0.4 的 {CI_MISS} 个")
    print(f"逻辑回归：{DIST.size} 投 {MADE.sum()} 中")
    chain = metropolis()
    acc = np.mean([s[1] for s in chain])
    pts = np.array([s[3] for s in chain[1000:]])
    print(f"Metropolis 接受率 {acc:.2f}；α 均值 {pts[:, 0].mean():.2f}，β 均值 {pts[:, 1].mean():.3f}"
          f"（真值 {TRUE_ALPHA}, {TRUE_BETA}）；范围 α {pts[:, 0].min():.2f}–{pts[:, 0].max():.2f}，"
          f"β {pts[:, 1].min():.3f}–{pts[:, 1].max():.3f}")
