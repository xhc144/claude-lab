"""核对《最优化》讲解稿中出现的全部数值例子。

运行：pip install numpy scipy cvxpy && python3 optimization_check.py
（未安装 cvxpy 时跳过投资组合一例。）
"""
import math

import numpy as np
from scipy.optimize import linprog, minimize_scalar


def close(a, b, tol=1e-6):
    return np.allclose(a, b, atol=tol)


# 第 1 集：铁皮盒子 V = x(6-2x)^2 在 x = 1 处取最大值 16
r = minimize_scalar(lambda x: -x * (6 - 2 * x) ** 2, bounds=(0, 3), method="bounded")
assert close(r.x, 1, 1e-4) and close(-r.fun, 16)

# 第 1 集：x + 4/x 在 x >= 3 上的最小值是 13/3；自测题 sin x + 4/sin x 的最小值是 5
xs = np.linspace(3, 100, 200001)
assert close((xs + 4 / xs).min(), 13 / 3)
t = np.linspace(1e-4, 1, 200001)
assert close((t + 4 / t).min(), 5)

# 第 1 集：单位圆上 3x + 4y 的最大值是 5
th = np.linspace(0, 2 * np.pi, 400001)
assert close((3 * np.cos(th) + 4 * np.sin(th)).max(), 5, 1e-6)

# 第 1 集：x + y = c 时 xy 的最大值 (c/2)^2，乘子 λ = c/2 = 5
assert close(((10.01 / 2) ** 2 - 25) / 0.01, 5, 1e-2)

# 第 3 集：f(x) = x^2，不同学习率下前几步的 x
expected = {
    0.1: [10, 8, 6.4, 5.12, 4.096],
    0.5: [10, 0, 0, 0, 0],
    0.9: [10, -8, 6.4, -5.12, 4.096],
    1.0: [10, -10, 10, -10, 10],
    1.1: [10, -12, 14.4, -17.28, 20.736],
}
for eta, seq in expected.items():
    x, got = 10.0, [10.0]
    for _ in range(4):
        x -= eta * 2 * x
        got.append(x)
    assert close(got, seq), (eta, got)
x, k = 10.0, 0
while abs(x) >= 0.01:
    x *= 0.8
    k += 1
assert k == 31

# 第 3 集：f = x^2 + 10y^2，学习率 0.09 的之字形路径
x, y, path = 10.0, 1.0, []
for _ in range(5):
    x, y = x - 0.09 * 2 * x, y - 0.09 * 20 * y
    path.append((round(x, 3), round(y, 3)))
assert path == [(8.2, -0.8), (6.724, 0.64), (5.514, -0.512), (4.521, 0.41), (3.707, -0.328)]
x, y = 10.0, 1.0
for _ in range(50):
    x, y = x - 0.09 * 2 * x, y - 0.09 * 20 * y
assert round(x, 4) == 0.0005

# 第 3 集：条件数与"距离缩小 1000 倍"所需步数
assert math.ceil(math.log(1000) / -math.log(9 / 11)) == 35
assert math.ceil(math.log(1000) / -math.log(999 / 1001)) == 3454  # 稿中写约 3450 步


# 第 3 集：条件数 100 时，函数值缩小一百万倍，普通梯度下降 vs 重球动量法
def steps(kappa, method):
    L, mu = 2 * kappa, 2
    if method == "gd":
        eta, beta = 2 / (L + mu), 0.0
    else:
        eta = 4 / (math.sqrt(L) + math.sqrt(mu)) ** 2
        beta = ((math.sqrt(L) - math.sqrt(mu)) / (math.sqrt(L) + math.sqrt(mu))) ** 2
    f = lambda p: p[0] ** 2 + kappa * p[1] ** 2
    p = prev = np.array([10.0, 1.0])
    f0 = f(p)
    for it in range(1, 100000):
        g = np.array([2 * p[0], 2 * kappa * p[1]])
        p, prev = p - eta * g + beta * (p - prev), p
        if f(p) < 1e-6 * f0:
            return it


assert steps(100, "gd") == 346 and steps(100, "hb") == 56


# 第 4 集：木工坊线性规划
def lp(profit, b, A=((1, 1), (2, 1), (0, 1))):
    r = linprog(c=[-p for p in profit], A_ub=A, b_ub=b,
                bounds=[(0, None)] * len(profit), method="highs")
    return r.x, -r.fun, -r.ineqlin.marginals


x, v, duals = lp([300, 200], [40, 60, 30])
assert close(x, [20, 20]) and close(v, 10000) and close(duals, [100, 100, 0])
for b, xx in (([41, 60, 30], [19, 22]), ([40, 61, 30], [21, 19])):
    x, v, _ = lp([300, 200], b)
    assert close(x, xx) and close(v, 10100)
assert close(lp([300, 200], [40, 60, 31])[1], 10000)
for vert, val in {(0, 0): 0, (30, 0): 9000, (20, 20): 10000, (10, 30): 9000, (0, 30): 6000}.items():
    assert 300 * vert[0] + 200 * vert[1] == val

# 对偶问题：收购商定价
d = linprog(c=[40, 60, 30], A_ub=[[-1, -2, 0], [-1, -1, -1]], b_ub=[-300, -200],
            bounds=[(0, None)] * 3, method="highs")
assert close(d.x, [100, 100, 0]) and close(d.fun, 10000)

# 影子价格的有效范围：木料 30 到 45 份
for w in (30, 35, 44):
    assert close(lp([300, 200], [w, 60, 30])[2][:2], [100, 100])
assert close(lp([300, 200], [46, 60, 30])[2][0], 0)

# 灵敏度：桌子利润 200 时整条木料边都最优；350 时方案不变、利润 11000；450 时只做桌子
assert close(lp([200, 200], [40, 60, 30])[1], 8000)
x, v, _ = lp([350, 200], [40, 60, 30])
assert close(x, [20, 20]) and close(v, 11000)
assert close(lp([450, 200], [40, 60, 30])[0], [30, 0])

# 自测题：卖掉 5 份木料后剩 35 份，方案 (25, 10)，利润 9500，加 600 元收入共 10100
x, v, _ = lp([300, 200], [35, 60, 30])
assert close(x, [25, 10]) and close(v + 5 * 120, 10100)

# 新产品书架：2 份木料、1 小时工时。利润 250 时不做，350 时开始做
A3 = ((1, 1, 2), (2, 1, 1), (0, 1, 0))
assert close(lp([300, 200, 250], [40, 60, 30], A3)[0][2], 0)
assert lp([300, 200, 350], [40, 60, 30], A3)[0][2] > 1

# 整数规划反例：LP 最优 (1.8, 2.8)，四舍五入的 (2, 3) 不可行，整数最优 y = 2
r = linprog(c=[0, -1], A_ub=[[-1, 1], [3, 2], [2, 3]], b_ub=[1, 12, 12],
            bounds=[(0, None)] * 2, method="highs")
assert close(r.x, [1.8, 2.8])
feasible = lambda x, y: -x + y <= 1 and 3 * x + 2 * y <= 12 and 2 * x + 3 * y <= 12
assert not feasible(2, 3)
assert max(y for x in range(10) for y in range(10) if feasible(x, y)) == 2

# 第 2 集：投资组合（需要 cvxpy）
try:
    import cvxpy as cp
except ImportError:
    print("未安装 cvxpy，跳过投资组合一例")
else:
    mu = np.array([0.08, 0.12, 0.15])
    Sigma = np.array([[0.04, 0.006, 0.01], [0.006, 0.09, 0.02], [0.01, 0.02, 0.16]])
    w = cp.Variable(3)
    cons = [cp.sum(w) == 1, w >= 0, mu @ w >= 0.10]
    cp.Problem(cp.Minimize(cp.quad_form(w, Sigma)), cons).solve()
    assert close(w.value, [0.6, 0.266, 0.134], 1e-3)

print("讲解稿中的数值例子全部核对通过")
