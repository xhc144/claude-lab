---
galaxy: analysis
cluster: complex-analysis
title: 复分析
en: Complex analysis
order: 14
level: ext
---

## 全纯函数 {#complex-analytic}
type: 定义 | en: Holomorphic function | w: 3 | level: ext
前置: complex-plane, partial-derivative
源于: taylor-series
后续: cauchy-integral-theorem
alias: 解析函数, 复可导, 柯西-黎曼方程, 全纯

复变函数 $f(z)=u+\ii v$ 在 $z_0$ 复可导：$\lim_{h\to0}\frac{f(z_0+h)-f(z_0)}h$ 存在，$h$ 可以从复平面任何方向趋于 $0$。在区域上处处复可导的函数称为全纯函数。

> [!定理] 柯西–黎曼方程
> $f$ 复可导 $\iff$ $u,v$ 可微且 $u_x=v_y$，$u_y=-v_x$。

### 注记
复可导是极强的条件：全纯函数自动无穷次可导，并且在每点附近等于它的泰勒级数（与实函数 $\ee^{-1/x^2}$ 的情形截然不同）。$\bar z$ 处处连续却处处不复可导。全纯函数在导数非零处保角。

## 柯西积分定理与积分公式 {#cauchy-integral-theorem}
type: 定理 | en: Cauchy's integral theorem and formula | w: 3 | level: ext
前置: complex-analytic, greens-theorem
后续: residue-theorem, fundamental-theorem-algebra
alias: 柯西定理, 柯西积分公式, 刘维尔定理

$f$ 在单连通区域 $D$ 内全纯，$C$ 是 $D$ 内的闭曲线，则 $\oint_Cf(z)\,\dd z=0$；并且对 $C$ 内部的点，
$$f(z_0)=\frac1{2\pi\ii}\oint_C\frac{f(z)}{z-z_0}\dd z.$$
函数在边界上的值决定了内部的一切。

### 证明思路
（$f'$ 连续时）由格林公式 $\oint f\,\dd z=\iint\left(\ii\frac{\partial f}{\partial x}-\frac{\partial f}{\partial y}\right)\dd x\,\dd y$，而柯西–黎曼方程正好使被积式为零。

### 推论
**刘维尔定理**：有界的整函数是常数。由此一行证明代数基本定理：若多项式 $p$ 无零点，则 $\frac1p$ 是有界整函数，必为常数。

## 留数定理 {#residue-theorem}
type: 定理 | en: Residue theorem | w: 3 | level: ext
前置: cauchy-integral-theorem, power-series
alias: 留数, 洛朗级数, 围道积分

$f$ 在闭曲线 $C$ 内除有限个孤立奇点 $z_k$ 外全纯，则
$$\oint_Cf(z)\,\dd z=2\pi\ii\sum_k\operatorname{Res}(f,z_k),$$
留数是洛朗展开中 $(z-z_k)^{-1}$ 项的系数。

### 例题
$\int_{-\infty}^\infty\frac{\dd x}{1+x^2}$：取上半圆周围道，上半平面内只有极点 $z=\ii$，留数 $\frac1{2\ii}$，大半圆弧上的积分随半径趋于无穷而趋于 $0$，故积分 $=2\pi\ii\cdot\frac1{2\ii}=\pi$。

### 应用
计算实反常积分、级数求和；控制理论中的奈奎斯特判据；素数定理的解析证明。

## 代数基本定理 {#fundamental-theorem-algebra}
type: 定理 | en: Fundamental theorem of algebra | w: 4 | level: core | 考纲: 特征值
前置: complex-number, polynomial-remainder
源于: cauchy-integral-theorem
应用于: characteristic-polynomial, jordan-form
alias: 代数学基本定理, 每个多项式有复根

每个次数 $n\ge1$ 的复系数多项式在 $\C$ 中至少有一个根；因此恰有 $n$ 个根（计重数），可分解为一次因式之积。

### 证明思路
（分析证明）$\abs{p(z)}\to\infty$（$\abs z\to\infty$），所以 $\abs p$ 在某点 $z_0$ 取最小值。若 $p(z_0)\ne0$，在 $z_0$ 附近 $p(z)=p(z_0)+c(z-z_0)^k+\cdots$（$c\ne0$），选方向使 $c(z-z_0)^k$ 与 $p(z_0)$ 反向，$\abs p$ 还能更小，矛盾（达朗贝尔引理）。也可由 [[cauchy-integral-theorem|刘维尔定理]] 一行推出。

### 注记
实系数多项式的虚根成对共轭出现，所以实系数多项式可以分解为一次和二次实因式之积。这个定理说明 $\C$ 是代数闭域；它保证了每个复方阵都有特征值，从而有 [[jordan-form]]。
