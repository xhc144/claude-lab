---
galaxy: applied
cluster: interpolation
title: 插值与逼近
en: Interpolation and approximation
order: 2
level: core
---

## 拉格朗日插值 {#lagrange-interpolation}
type: 公式 | en: Lagrange interpolation | w: 5 | 考纲: 多项式插值
前置: polynomial-remainder
用到: vandermonde
后续: newton-interpolation, interpolation-error, newton-cotes
anim: interpolation
alias: 插值多项式, 拉格朗日基函数, 多项式插值

过 $n+1$ 个横坐标互不相同的点 $(x_i,y_i)$ 恰有一个次数 $\le n$ 的多项式：
$$L_n(x)=\sum_{i=0}^ny_i\ell_i(x),\qquad\ell_i(x)=\prod_{j\ne i}\frac{x-x_j}{x_i-x_j}.$$
基函数满足 $\ell_i(x_j)=\delta_{ij}$。

### 唯一性
两个这样的多项式之差次数 $\le n$ 却有 $n+1$ 个根，只能是零多项式（等价于范德蒙德行列式非零）。

### 注记
它与中国剩余定理同构：在多项式环中，$x-x_i$ 两两互素，“已知除以每个 $x-x_i$ 的余数（即 $y_i$），求多项式”。秘密共享（沙米尔）方案正是利用插值：$k$ 个点能恢复 $k-1$ 次多项式，少一个点则毫无信息。

## 牛顿插值与差商 {#newton-interpolation}
type: 公式 | en: Newton interpolation and divided differences | w: 3 | 考纲: 多项式插值
前置: lagrange-interpolation
alias: 差商, 差分, 牛顿插值公式, 均差

$$N_n(x)=f[x_0]+f[x_0,x_1](x-x_0)+\cdots+f[x_0,\dots,x_n](x-x_0)\cdots(x-x_{n-1}),$$
差商递归定义：$f[x_i,x_{i+1}]=\frac{f(x_{i+1})-f(x_i)}{x_{i+1}-x_i}$，高阶差商类推。

### 优点
增加一个节点时只需多算一项，前面的项不变（拉格朗日形式需要全部重算）。$f[x_0,\dots,x_n]=\frac{f^{(n)}(\xi)}{n!}$：差商是导数的离散类比，等距节点时与有限差分联系，对应离散版的泰勒展开。

## 插值余项 {#interpolation-error}
type: 定理 | en: Interpolation error | w: 4 | 考纲: 多项式插值, 误差思想
前置: lagrange-interpolation, rolle-theorem
后续: runge-phenomenon, chebyshev-nodes
alias: 插值误差, 余项公式

若 $f\in C^{n+1}$，则
$$f(x)-L_n(x)=\frac{f^{(n+1)}(\xi)}{(n+1)!}\prod_{i=0}^n(x-x_i),$$
$\xi$ 在 $x$ 与诸节点所张的区间内。

### 证明
固定 $x$（非节点），令 $g(t)=f(t)-L_n(t)-K\prod(t-x_i)$，选 $K$ 使 $g(x)=0$。$g$ 有 $n+2$ 个零点，反复用罗尔定理，$g^{(n+1)}$ 有零点 $\xi$，即 $f^{(n+1)}(\xi)-K(n+1)!=0$。

### 注记
误差由两部分决定：函数的光滑程度（高阶导数）与节点分布（节点多项式 $\prod(x-x_i)$）。后者在区间两端最大，这是龙格现象的根源。

## 龙格现象 {#runge-phenomenon}
type: 现象 | en: Runge's phenomenon | w: 4 | 考纲: 多项式插值, 逼近
前置: interpolation-error
后续: chebyshev-nodes, spline
anim: interpolation
alias: 龙格现象, 高次插值的振荡

用等距节点对 $f(x)=\frac1{1+25x^2}$ 在 $[-1,1]$ 上做插值，次数越高，区间两端振荡越剧烈，误差趋于无穷——增加节点反而更差。

### 原因
等距节点时 $\prod(x-x_i)$ 在端点附近比中间大得多；而这个函数在复平面上 $\pm\frac{\ii}5$ 处有极点，高阶导数增长极快，余项无法变小。

### 对策
改用切比雪夫节点（[[chebyshev-nodes]]）、分段低次插值或样条插值（[[spline]]）。教训：“更多参数”不等于“更好的拟合”。

## 切比雪夫节点 {#chebyshev-nodes}
type: 方法 | en: Chebyshev nodes | w: 3 | 考纲: 多项式插值, 逼近
前置: runge-phenomenon, trig-functions
alias: 切比雪夫多项式, 切比雪夫零点, 最优节点

切比雪夫多项式 $T_n(\cos\theta)=\cos n\theta$，在 $[-1,1]$ 上 $\abs{T_n}\le1$，等幅振荡 $n+1$ 次。取它的零点 $x_k=\cos\frac{(2k+1)\pi}{2n+2}$（$k=0,\dots,n$）为插值节点，使 $\max\abs{\prod(x-x_k)}=2^{-n}$ 在所有首一 $n+1$ 次多项式中最小。

### 直观
切比雪夫节点是单位半圆上等距点在直径上的投影，在区间两端更密集，正好压住端点处的振荡。用它们插值 $\frac1{1+25x^2}$ 会随次数增加一致收敛。

## 样条插值 {#spline}
type: 方法 | en: Spline interpolation | w: 4 | 考纲: 多项式插值, 逼近
前置: runge-phenomenon, linear-system
alias: 三次样条, 分段插值, 自然样条, 样条函数

在每个小区间上用低次多项式（常用三次），并要求在节点处函数值、一阶导数、二阶导数都连续。三次样条由一个三对角线性方程组确定，加上两端的边界条件（如自然样条 $S''=0$）。

### 性质
自然三次样条在所有插值函数中使“弯曲能量” $\int(S'')^2$ 最小——这正是造船师用的弹性木条（样条）的物理形状。误差 $O(h^4)$，不会出现龙格现象。

### 应用
计算机字体与图形（贝塞尔曲线、B 样条）、CAD 曲面设计、动画路径、数据平滑。

## 最小二乘逼近 {#least-squares-approx}
type: 方法 | en: Least-squares approximation | w: 3 | 考纲: 逼近
源于: least-squares
前置: orthogonal-projection, orthogonal-polynomials
alias: 平方逼近, 曲线拟合, 函数的最佳平方逼近

在函数空间中求 $f$ 在子空间（如次数 $\le n$ 的多项式）上的最佳平方逼近：使 $\int_a^b(f-p)^2\dd x$（或离散数据的平方和）最小。解是 $f$ 在该子空间上的正交投影，用正交多项式作基时系数可以直接写出：$p=\sum\frac{\inner f{p_k}}{\inner{p_k}{p_k}}p_k$。

### 对比
插值要求曲线精确通过每个数据点；拟合只要求整体误差最小。数据有噪声时应该拟合而不是插值。

## 最佳一致逼近 {#best-uniform-approx}
type: 定理 | en: Best uniform approximation | w: 3 | 考纲: 逼近
前置: chebyshev-nodes
源于: weierstrass-approximation
alias: 切比雪夫交错定理, 极小极大逼近, minimax

在次数 $\le n$ 的多项式中寻找使 $\max_{[a,b]}\abs{f-p}$ 最小的 $p^*$。切比雪夫交错定理：$p^*$ 是最佳一致逼近 $\iff$ 误差 $f-p^*$ 在至少 $n+2$ 个点上交替地取到最大绝对值。

### 例题
$x^{n+1}$ 在 $[-1,1]$ 上的最佳 $n$ 次逼近，误差恰是 $2^{-n}T_{n+1}(x)$——误差等幅交错 $n+2$ 次。

### 注记
魏尔斯特拉斯定理保证误差可以任意小；切比雪夫理论刻画了每个次数下的最优多项式。数学库中的 $\sin$、$\exp$ 等函数就是用这类极小极大多项式或有理函数实现的。

## 正交多项式 {#orthogonal-polynomials}
type: 概念 | en: Orthogonal polynomials | w: 3 | 考纲: 逼近, 数值积分
前置: gram-schmidt, inner-product-space
后续: gauss-quadrature, least-squares-approx
alias: 勒让德多项式, 切比雪夫多项式, 埃尔米特多项式, 三项递推

关于内积 $\inner fg=\int_a^bf g\,w\,\dd x$ 两两正交的多项式序列 $p_0,p_1,\dots$（$\deg p_k=k$）。由 $1,x,x^2,\dots$ 施密特正交化得到；它们满足三项递推关系，且 $p_n$ 在 $(a,b)$ 内有 $n$ 个不同的实零点。

### 例子
| 名称 | 区间 | 权函数 |
|:-:|:-:|:-:|
| 勒让德 $P_n$ | $[-1,1]$ | $1$ |
| 切比雪夫 $T_n$ | $[-1,1]$ | $\frac1{\sqrt{1-x^2}}$ |
| 埃尔米特 $H_n$ | $\R$ | $\ee^{-x^2}$ |
| 拉盖尔 $L_n$ | $[0,\infty)$ | $\ee^{-x}$ |

### 应用
高斯求积的节点是正交多项式的零点；量子谐振子的波函数含埃尔米特多项式，氢原子含拉盖尔多项式，球谐函数含勒让德多项式。
