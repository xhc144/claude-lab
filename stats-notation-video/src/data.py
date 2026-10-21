"""画面和旁白里的数都从这里来：python data.py 打印核对表。"""
import numpy as np
from scipy import stats

# 二 · 描述统计：七位同学一周读课外书的小时数
HOURS = [6, 6, 6, 7, 7, 10, 14]
N7 = len(HOURS)
MEAN7 = sum(HOURS) / N7                                   # 8
DEV7 = [x - MEAN7 for x in HOURS]                         # 离差，和为 0
SS7 = sum(d * d for d in DEV7)                            # 54
VAR7 = SS7 / (N7 - 1)                                     # 9
SD7 = VAR7 ** 0.5                                         # 3
MEDIAN7 = sorted(HOURS)[N7 // 2]                          # 7
MODE7 = max(set(HOURS), key=HOURS.count)                  # 6
Q1, Q3 = 6, 10                                            # 上下两半（不含中位数）各自的中位数
IQR = Q3 - Q1                                             # 4
Z14 = (14 - MEAN7) / SD7                                  # 2

# 三 · 概率：一千人的检测
POP, SICK, TP = 1000, 10, 9
HEALTHY = POP - SICK
FP = 99
P_POS_SICK = TP / SICK                                    # 灵敏度 0.9
SPEC = (HEALTHY - FP) / HEALTHY                           # 特异度 0.9
P_SICK_POS = TP / (TP + FP)                               # 9/108

# 四 · 两枚骰子之和
DICE = {s: sum(1 for a in range(1, 7) for b in range(1, 7) if a + b == s) / 36 for s in range(2, 13)}
E_DICE = sum(s * p for s, p in DICE.items())              # 7

# 七 · 掷硬币十次，七次正面
HEADS, FLIPS = 7, 10
P_HAT = HEADS / FLIPS

# 八 · 面包：n = 16，x̄ = 494，s = 10，H₀: μ = 500
N, XBAR, S, MU0 = 16, 494, 10, 500
SE = S / N ** 0.5                                         # 2.5
T = (XBAR - MU0) / SE                                     # -2.4
DF = N - 1
P_VAL = 2 * stats.t.sf(abs(T), DF)
T_CRIT = stats.t.ppf(0.975, DF)
CI = (XBAR - T_CRIT * SE, XBAR + T_CRIT * SE)
COHEN_D = abs(XBAR - MU0) / S

if __name__ == "__main__":
    print("阅读时长", HOURS, "和", sum(HOURS), "均值", MEAN7, "中位数", MEDIAN7, "众数", MODE7)
    print("离差", DEV7, "和", sum(DEV7), "平方和", SS7, "s²", VAR7, "s", SD7, "除以 n", round(SS7 / N7, 3))
    print("Q1 Q3 IQR", Q1, Q3, IQR, "极差", max(HOURS) - min(HOURS), "上界", Q3 + 1.5 * IQR, "z(14)", Z14,
          "CV", round(SD7 / MEAN7, 3))
    print("检测：灵敏度", P_POS_SICK, "特异度", SPEC, "P(病|阳)", round(P_SICK_POS, 4), "阳性", TP + FP)
    print("骰子 P(7)", DICE[7], "E", E_DICE, "Var", sum((s - 7) ** 2 * p for s, p in DICE.items()))
    print("Φ(1.96)", round(stats.norm.cdf(1.96), 4), "±1,2,3σ", [round(stats.norm.cdf(k) - stats.norm.cdf(-k), 4) for k in (1, 2, 3)],
          "z0.025", round(stats.norm.isf(0.025), 4))
    print("MLE p̂", P_HAT, "L(0.7)", 0.7 ** 7 * 0.3 ** 3, "∫L dp", round(1 / (8 * 120), 6))
    print(f"面包 SE {SE} t {T} df {DF} p {P_VAL:.4f} t_crit {T_CRIT:.4f} CI ({CI[0]:.2f}, {CI[1]:.2f}) d {COHEN_D}")
    print("z 检验对照 p", round(2 * stats.norm.sf(2.4), 4))
    print("odds(0.8)", 0.8 / 0.2)
    # Y = X² 与 X 不相关：X 在 {-1, 0, 1} 上均匀
    xs = np.array([-1, 0, 1]); print("Cov(X, X²)", np.mean(xs * xs ** 2) - np.mean(xs) * np.mean(xs ** 2))
    # s 低估 σ：正态，n = 7
    rng = np.random.default_rng(0); sm = rng.normal(0, 1, (200000, 7)).std(axis=1, ddof=1)
    print("E(s)/σ, n=7", round(sm.mean(), 4), "E(s²)", round((sm ** 2).mean(), 4))
