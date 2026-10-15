"""全片数据。旁白里念到的每个数都由这里算出，python data.py 打印核对表。"""
import numpy as np

# 十个同学：每周学习小时数，期末分数
X = np.array([2, 3, 4, 5, 6, 7, 8, 9, 10, 11], dtype=float)
Y = np.array([62, 57, 77, 67, 72, 70, 87, 93, 93, 92], dtype=float)
N = len(X)

XBAR, YBAR = X.mean(), Y.mean()
SXX = ((X - XBAR) ** 2).sum()
SXY = ((X - XBAR) * (Y - YBAR)).sum()
SYY = ((Y - YBAR) ** 2).sum()
B = SXY / SXX
A = YBAR - B * XBAR
FIT = A + B * X
RES = Y - FIT
SSE = (RES ** 2).sum()
SSR = ((FIT - YBAR) ** 2).sum()
R2 = SSR / SYY
R = SXY / np.sqrt(SXX * SYY)
SX, SY = X.std(ddof=1), Y.std(ddof=1)


def sse(a, b, x=X, y=Y):
    return float(((y - a - b * x) ** 2).sum())


# 三个点的小例子：在三维里看投影
X3 = np.array([0.0, 1.0, 2.0])
Y3 = np.array([0.0, 4.0, 2.0])
ONE3 = np.ones(3)
M3 = np.column_stack([ONE3, X3])
A3, B3 = np.linalg.solve(M3.T @ M3, M3.T @ Y3)
FIT3 = A3 + B3 * X3
RES3 = Y3 - FIT3

# 弯曲的数据：二次拟合
XQ = np.linspace(0, 10, 13)
YQ = np.round(20 + 9.0 * XQ - 0.75 * XQ ** 2 + np.array([1.5, -2, 0.5, 2, -1.5, -1, 2.5, -0.5, -2, 1, 0.5, -1.5, 1]), 1)
MQ = np.column_stack([np.ones_like(XQ), XQ, XQ ** 2])
COEF_Q = np.linalg.solve(MQ.T @ MQ, MQ.T @ YQ)
COEF_QL = np.polyfit(XQ, YQ, 1)[::-1]  # 直线拟合（对照）

# 离群点：多一个学了 11 小时却只考 40 分的同学
XO = np.append(X, 11.0)
YO = np.append(Y, 40.0)
B_O = ((XO - XO.mean()) * (YO - YO.mean())).sum() / ((XO - XO.mean()) ** 2).sum()
A_O = YO.mean() - B_O * XO.mean()

# 反过来用分数预测学习时长，画在同一张图上的斜率
B_XY = SXY / SYY            # x = c + d y 中的 d
SLOPE_X_ON_Y = 1 / B_XY      # 画在 (x, y) 平面上的斜率


if __name__ == "__main__":
    print("x̄ =", XBAR, " ȳ =", YBAR)
    print("Sxx =", SXX, " Sxy =", SXY, " Syy =", SYY)
    print("b =", B, " a =", A)
    print("残差 =", RES, " 和 =", RES.sum(), " Σx·e =", (X * RES).sum())
    print("SSE =", SSE, " SSR =", SSR, " SST =", SYY, " R² =", R2, " r =", R)
    print("水平线 y=ȳ 的残差和 =", (Y - YBAR).sum(), " SSE =", sse(YBAR, 0))
    print("三点例：a =", A3, " b =", B3, " 拟合 =", FIT3, " 残差 =", RES3,
          " Σe =", RES3.sum(), " Σx e =", (X3 * RES3).sum(), " |e|² =", (RES3 ** 2).sum())
    print("二次：", COEF_Q, " 直线：", COEF_QL)
    print("离群点后：b =", B_O, " a =", A_O)
    print("x 对 y 回归画在图上的斜率 =", SLOPE_X_ON_Y)
    print("标准化斜率 = r =", R, " sx, sy =", SX, SY)
