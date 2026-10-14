"""生成论文示例中的数值表与曲线数据（Bernstein 多项式）。

用法：python3 data/make_data.py   （在 templates/paper 目录下运行）
输出：data/bernstein-abs.dat, data/voronovskaya.dat，并在终端打印两张表的数值。
"""
from fractions import Fraction
from math import comb, sqrt, pi, sin
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def bernstein(f, n, x):
    """B_n f(x) = sum_k f(k/n) C(n,k) x^k (1-x)^(n-k)，用 float 计算。"""
    return sum(f(k / n) * comb(n, k) * x**k * (1 - x)**(n - k) for k in range(n + 1))


f0 = lambda t: abs(t - 0.5)

# 图 1：f0 及 B_n f0（n = 2, 6, 20）
xs = [i / 200 for i in range(201)]
with open(os.path.join(HERE, 'bernstein-abs.dat'), 'w') as fh:
    fh.write('x f B2 B6 B20\n')
    for x in xs:
        fh.write(f'{x:.4f} {f0(x):.6f} {bernstein(f0, 2, x):.6f} '
                 f'{bernstein(f0, 6, x):.6f} {bernstein(f0, 20, x):.6f}\n')

# 表 1：e_n = B_n f0(1/2) = C(2m,m)/(2*4^m)，n = 2m
print('Table 1')
print('n  e_n  sqrt(n)e_n  (3/2)/sqrt(n)  e_n/((3/2)/sqrt n)')
for n in [2, 4, 8, 16, 32, 64, 128, 256, 1024]:
    m = n // 2
    exact = Fraction(comb(2 * m, m), 2 * 4**m)
    # 与直接求和核对
    direct = sum(Fraction(abs(2 * k - n), 2 * n) * comb(n, k) for k in range(n + 1)) / 2**n
    assert exact == direct, n
    e = float(exact)
    print(f'{n} {e:.6f} {sqrt(n) * e:.6f} {1.5 / sqrt(n):.6f} {e / (1.5 / sqrt(n)):.4f}')
print('1/sqrt(2pi) =', 1 / sqrt(2 * pi))

# 表 2 与图 2：f(x) = sin(pi x)，n (B_n f - f)(x) 与极限 x(1-x) f''(x) / 2
g = lambda t: sin(pi * t)
limit = lambda x: -x * (1 - x) * pi**2 * sin(pi * x) / 2
print('Table 2')
print('n  n(B_n f - f)(1/2)  diff from limit  n*diff')
L = limit(0.5)
for n in [5, 10, 20, 40, 80, 160, 320]:
    v = n * (bernstein(g, n, 0.5) - g(0.5))
    print(f'{n} {v:.6f} {v - L:.6f} {n * (v - L):.4f}')
print('limit =', L, ' -pi^2/8 =', -pi**2 / 8)

with open(os.path.join(HERE, 'voronovskaya.dat'), 'w') as fh:
    fh.write('x limit n5 n20 n80\n')
    for x in xs:
        vals = [n * (bernstein(g, n, x) - g(x)) for n in (5, 20, 80)]
        fh.write(f'{x:.4f} {limit(x):.6f} ' + ' '.join(f'{v:.6f}' for v in vals) + '\n')
