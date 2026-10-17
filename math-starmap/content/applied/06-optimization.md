---
galaxy: applied
cluster: optimization
title: 最优化理论与算法
en: Optimization
order: 6
level: core
---

## 最优化问题 {#optimization-problem}
type: 概念 | en: Optimization problems | w: 5 | 考纲: 极值问题
前置: multivar-extrema
后续: convex-optimization, gradient-descent, linear-programming, kkt
alias: 优化问题, 目标函数, 约束, 可行域, 局部最优, 全局最优
tags: 优化

$\min f(\vv x)$，s.t. $g_i(\vv x)\le0$，$h_j(\vv x)=0$。$f$ 是目标函数，满足约束的点构成可行域。

### 最优性条件
- 无约束、可微：一阶必要条件 $\nabla f(\vv x^*)=\vv0$；二阶充分条件 $\nabla^2f(\vv x^*)$ 正定；
- 等式约束：拉格朗日乘数法；不等式约束：KKT 条件。

### 注记
一般的非凸问题只能保证找到局部最优；全局最优是否可求取决于问题结构——凸性是“好结构”的核心。

## 不等式与极值问题 {#inequality-extremum}
type: 方法 | en: Extremal problems via inequalities | w: 4 | 考纲: 不等式问题, 极值问题
前置: am-gm, cauchy-inequality-hs
后续: optimization-problem
alias: 用不等式求最值, 均值不等式求最值, 等号成立条件, 等周问题

很多极值问题可以不用导数，而用经典不等式一步解决：先证明目标函数 $\ge c$（或 $\le c$），再说明等号能取到。

### 例题
- 体积为 $V$ 的长方体，表面积 $2(ab+bc+ca)\ge6\sqrt[3]{(abc)^2}=6V^{2/3}$，正方体时最小。
- 无盖圆柱形水桶容积一定，用料最省时：$S=\pi r^2+2\pi rh=\pi r^2+\frac{V}{r}+\frac Vr\ge3\sqrt[3]{\pi V^2}$，当 $\pi r^2=\frac Vr$ 即 $h=r$ 时取等号（底面半径等于高）。
- 周长一定的矩形中正方形面积最大；周长一定的平面图形中圆面积最大（[[isoperimetric-inequality]]）。

### 注记
关键是“凑”出定值，并检验等号条件。与微积分方法相比，不等式方法往往同时给出最优值和最优性的证明。

## 凸优化 {#convex-optimization}
type: 定理 | en: Convex optimization | w: 5 | 考纲: 凸优化理论
前置: convex-function, convex-set, optimization-problem
后续: kkt, gradient-descent
alias: 凸规划, 局部最优即全局最优, 凸函数的最小化

在凸集上最小化凸函数。基本定理：凸优化问题的任何局部最优解都是全局最优解；可微时，$\vv x^*$ 最优 $\iff$ 对一切可行的 $\vv x$，$\nabla f(\vv x^*)\cdot(\vv x-\vv x^*)\ge0$（无约束时即 $\nabla f(\vv x^*)=\vv0$）。

### 证明
若 $\vv x^*$ 是局部最优而存在 $\vv y$ 使 $f(\vv y)<f(\vv x^*)$，则线段上的点 $\vv x_t=(1-t)\vv x^*+t\vv y$ 可行（凸集），且 $f(\vv x_t)\le(1-t)f(\vv x^*)+tf(\vv y)<f(\vv x^*)$（凸函数），$t\to0$ 时 $\vv x_t$ 任意接近 $\vv x^*$，矛盾。

### 注记
线性规划、最小二乘、支持向量机、许多信号处理问题都是凸优化，有可靠高效的算法（内点法）。“问题是否凸”常常比“问题是否线性”更重要。

## KKT 条件 {#kkt}
type: 定理 | en: Karush–Kuhn–Tucker conditions | w: 3 | 考纲: 凸优化理论
源于: lagrange-multiplier
前置: convex-optimization
用到: separating-hyperplane
alias: KKT 条件, 互补松弛, 不等式约束的拉格朗日乘子

对问题 $\min f$，s.t. $g_i\le0$，在约束规范条件下，最优点 $\vv x^*$ 处存在 $\mu_i\ge0$ 使
$$\nabla f(\vv x^*)+\sum_i\mu_i\nabla g_i(\vv x^*)=\vv0,\qquad\mu_ig_i(\vv x^*)=0.$$
后一条是互补松弛：不起作用的约束（$g_i<0$）乘子为零。凸问题中 KKT 条件也是充分的。

### 直观
在最优点，目标函数下降的方向都被起作用的约束“挡住”了：$-\nabla f$ 是起作用约束外法向量 $\nabla g_i$ 的非负组合。

## 梯度下降法 {#gradient-descent}
type: 算法 | en: Gradient descent | w: 5 | 考纲: 梯度下降法, 凸优化理论
前置: directional-derivative, convex-optimization
后续: line-search, stochastic-gradient, newton-optimization
anim: gradient-descent
alias: 梯度下降, 最速下降法, 学习率, 步长, 梯度法

沿负梯度方向迭代：
$$\vv x_{k+1}=\vv x_k-\eta\nabla f(\vv x_k),$$
$\eta$ 为步长（学习率）。负梯度是局部下降最快的方向。

### 收敛性
若 $f$ 是 $L$-光滑的凸函数（$\nabla f$ 满足 $L$ 利普希茨条件），取 $\eta=\frac1L$，则 $f(\vv x_k)-f^*\le\frac{L\norm{\vv x_0-\vv x^*}^2}{2k}$；若还 $\mu$-强凸，则线性收敛，误差每步乘以 $1-\frac\mu L$。条件数 $\kappa=\frac L\mu$ 越大，收敛越慢。

### 例题
$f(x,y)=\frac12(x^2+10y^2)$：$L=10$，$\mu=1$。步长 $\eta>\frac2{10}$ 时 $y$ 方向发散；$\eta=0.1$ 时 $y$ 方向一步到位，$x$ 方向每步只缩小 $10\%$——在狭长山谷中来回震荡、缓慢前进。动量法与共轭梯度法正是为改善这种情况而设计的。

### 应用
训练神经网络（[[neural-network]]）几乎都用梯度下降及其变种（随机梯度、动量、Adam）。

## 一维搜索 {#line-search}
type: 算法 | en: Line search | w: 3 | 考纲: 梯度下降法, 极值问题
前置: gradient-descent
alias: 线搜索, 黄金分割法, 精确线搜索, 回溯线搜索, 阿米霍条件

确定沿下降方向 $\vv d$ 走多远：$\min_{t>0}f(\vv x+t\vv d)$。
- 黄金分割法：单峰函数上每次把搜索区间缩小为原来的 $0.618$ 倍，并复用一个试探点；
- 回溯法（阿米霍条件）：从 $t=1$ 开始不断减半，直到函数值“充分下降” $f(\vv x+t\vv d)\le f(\vv x)+ct\nabla f\cdot\vv d$。

### 注记
黄金分割法的比例 $\frac{\sqrt5-1}2$ 来自要求下一轮能复用上一轮的一个试探点——这是斐波那契数列在优化中的化身（斐波那契搜索是有限步最优的版本）。

## 牛顿法（优化） {#newton-optimization}
type: 算法 | en: Newton's method for optimization | w: 3 | level: ext
源于: newton-method
前置: multivar-taylor, gradient-descent
alias: 牛顿法, 拟牛顿法, BFGS, 二阶方法

用二阶泰勒展开近似目标函数并取其极小点：
$$\vv x_{k+1}=\vv x_k-\left[\nabla^2f(\vv x_k)\right]^{-1}\nabla f(\vv x_k).$$
它就是对方程 $\nabla f=\vv0$ 用牛顿迭代，在极小点附近二次收敛，并且不受条件数影响（对二次函数一步到位）。

### 注记
代价是每步计算黑塞矩阵并解线性方程组；拟牛顿法（BFGS）用梯度的变化逐步近似黑塞矩阵的逆，兼顾速度与成本。

## 随机梯度下降 {#stochastic-gradient}
type: 算法 | en: Stochastic gradient descent | w: 3 | level: ext
源于: gradient-descent
前置: expectation
应用于: neural-network
alias: SGD, 小批量, 随机优化

目标是许多项之和 $f=\frac1N\sum f_i$（如每个训练样本的损失）时，每步只随机取一个（或一小批）样本计算梯度：$\vv x_{k+1}=\vv x_k-\eta_k\nabla f_{i_k}(\vv x_k)$。它是真实梯度的无偏估计，每步代价与 $N$ 无关。

### 注记
步长需要逐渐减小（如 $\sum\eta_k=\infty$，$\sum\eta_k^2<\infty$）才能收敛；噪声有时反而帮助跳出浅的局部极小。深度学习就建立在随机梯度下降之上。

## 线性规划 {#linear-programming}
type: 模型 | en: Linear programming | w: 5 | 考纲: 线性规划
前置: optimization-problem, linear-system, convex-set
后续: simplex-method, lp-duality
anim: linear-programming
alias: 线性规划, 可行域, 目标函数, 顶点最优, 简单线性规划

在线性约束下最大化（最小化）线性目标：$\max\vv c\T\vv x$，s.t. $A\vv x\le\vv b$，$\vv x\ge\vv0$。可行域是凸多面体；若存在最优解，则一定能在某个顶点处取到。

### 例题
工厂生产甲、乙两种产品，每件利润 $3$、$2$ 千元；甲需 $1$ 小时机时、$3$ 千克原料，乙需 $1$ 小时、$1$ 千克；每天机时 $\le4$，原料 $\le6$。
$\max3x+2y$，s.t. $x+y\le4$，$3x+y\le6$，$x,y\ge0$。顶点 $(0,0),(2,0),(1,3),(0,4)$ 处目标值 $0,6,9,8$，最优为 $(1,3)$，利润 $9$ 千元。图上看：把等值线 $3x+2y=c$ 向右上平移，最后离开可行域的点就是最优点。

### 注记
坎托罗维奇（1939）与丹齐格（1947）分别提出线性规划，用于生产计划与军事后勤。它与博弈论、网络流、匹配问题都深刻相连。

## 单纯形法 {#simplex-method}
type: 算法 | en: Simplex method | w: 4 | 考纲: 线性规划
前置: linear-programming, gaussian-elimination
alias: 单纯形法, 基本可行解, 换基, 丹齐格

从可行域的一个顶点（基本可行解）出发，沿着使目标函数改善的边走到相邻顶点，直到没有改善的方向为止。代数上，每一步是选一个变量入基、一个变量出基，用类似高斯消元的“转轴”运算更新表格。

### 注记
最坏情况下需要指数步（克利–明蒂例子），但实践中通常只需约 $2m$ 到 $3m$ 步（$m$ 为约束数）——这个反差直到“平滑分析”（施皮尔曼、腾尚华，2001）才得到解释。多项式时间算法有椭球法与内点法（卡马卡，1984）。

## 线性规划的对偶 {#lp-duality}
type: 定理 | en: Linear programming duality | w: 4 | 考纲: 线性规划
前置: linear-programming
用到: separating-hyperplane
alias: 对偶问题, 弱对偶, 强对偶, 互补松弛, 影子价格

原问题 $\max\vv c\T\vv x$，s.t. $A\vv x\le\vv b$，$\vv x\ge\vv0$ 的对偶问题为 $\min\vv b\T\vv y$，s.t. $A\T\vv y\ge\vv c$，$\vv y\ge\vv0$。
- 弱对偶：任何可行解满足 $\vv c\T\vv x\le\vv b\T\vv y$；
- 强对偶：若原问题有最优解，则对偶问题也有，且最优值相等。

### 证明（弱对偶）
$\vv c\T\vv x\le(A\T\vv y)\T\vv x=\vv y\T A\vv x\le\vv y\T\vv b$。强对偶由法卡斯引理（分离超平面定理）证明。

### 直观
对偶变量 $y_i$ 是第 $i$ 种资源的“影子价格”：资源增加一个单位，最优利润增加多少。前一个例题中对偶最优解 $y=\left(\frac32,\frac12\right)$，$\vv b\T\vv y=4\cdot\frac32+6\cdot\frac12=9$，与原问题相等。

### 应用
最大流最小割定理、冯·诺伊曼极小极大定理（零和博弈）、霍尔定理都是线性规划对偶的特例。
