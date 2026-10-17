---
galaxy: applied
cluster: root-finding
title: 非线性方程求解
en: Solving nonlinear equations
order: 1
level: core
---

## 二分法 {#bisection-method}
type: 算法 | en: Bisection method | w: 4 | 考纲: 非线性方程组数值方法, 近似计算
前置: function-zeros
源于: ivt
后续: newton-method
anim: newton
alias: 二分法, 对分法, 区间二分

若 $f$ 在 $[a,b]$ 上连续且 $f(a)f(b)<0$，取中点 $c$，保留函数值异号的一半，反复进行。$n$ 步后区间长度为 $\frac{b-a}{2^n}$，每步得到一位二进制精度。

### 特点
只要求连续和变号，一定收敛，非常可靠；但收敛慢（线性收敛，比率 $\frac12$），要得到 $10^{-10}$ 的精度需要约 $34$ 步。实际软件常把二分法与快速方法结合（如布伦特法）：快速方法失控时退回二分。

## 不动点迭代 {#fixed-point-iteration}
type: 算法 | en: Fixed-point iteration | w: 4 | 考纲: 非线性方程组数值方法
前置: function-zeros
源于: banach-fixed-point
后续: newton-method, convergence-order, jacobi-iteration
anim: cobweb
alias: 不动点迭代, 简单迭代法, 蛛网图, 迭代收敛条件

把 $f(x)=0$ 改写为 $x=g(x)$，迭代 $x_{k+1}=g(x_k)$。若在不动点 $x^*$ 附近 $\abs{g'(x)}\le L<1$，迭代局部收敛，误差每步约乘以 $\abs{g'(x^*)}$。

### 例题
解 $x^3+4x^2-10=0$（根约 $1.365$）：写成 $x=\sqrt{\frac{10}{4+x}}$，$\abs{g'}\approx0.13$，迅速收敛；写成 $x=x-x^3-4x^2+10$，$\abs{g'}\gg1$，发散。同一个方程，改写方式决定成败。

### 直观
蛛网图：在 $y=g(x)$ 与 $y=x$ 之间来回画水平线和竖直线。$\abs{g'}<1$ 时向内收缩到交点，$\abs{g'}>1$ 时向外发散；$g'<0$ 时呈螺旋状，$g'>0$ 时呈阶梯状。

## 牛顿迭代法 {#newton-method}
type: 算法 | en: Newton's method | w: 5 | 考纲: 非线性方程组数值方法
前置: tangent-line, fixed-point-iteration
源于: approximate-computation
后续: secant-method, newton-systems, newton-optimization
anim: newton
alias: 牛顿法, 牛顿-拉弗森法, 切线法, 二次收敛

用切线与 $x$ 轴的交点逼近零点：
$$x_{k+1}=x_k-\frac{f(x_k)}{f'(x_k)}.$$
在单根附近二次收敛：$\abs{x_{k+1}-x^*}\approx\frac{\abs{f''(x^*)}}{2\abs{f'(x^*)}}\abs{x_k-x^*}^2$，有效数字每步约翻倍。

### 推导
在 $x_k$ 处线性化 $f(x)\approx f(x_k)+f'(x_k)(x-x_k)$，令其为零。收敛阶：把 $f(x^*)=0$ 在 $x_k$ 处泰勒展开到二阶，与迭代式相减即得误差关系。

### 例题
求 $\sqrt a$：$f(x)=x^2-a$，$x_{k+1}=\frac12\left(x_k+\frac a{x_k}\right)$。$a=2$，$x_0=1$：$1.5$，$1.41666\ldots$，$1.41421568\ldots$，$1.41421356237469\ldots$，第四步已有 $12$ 位有效数字。

### 注记
局部收敛：初值不好可能发散或振荡（$f(x)=x^{1/3}$ 从任何非零点出发都发散）；重根处退化为线性收敛。在复平面上，不同初值收敛到的根构成分形边界（牛顿分形）。

## 割线法 {#secant-method}
type: 算法 | en: Secant method | w: 3 | 考纲: 非线性方程组数值方法
源于: newton-method
alias: 弦截法, 割线法, 超线性收敛

用割线斜率代替导数：
$$x_{k+1}=x_k-f(x_k)\frac{x_k-x_{k-1}}{f(x_k)-f(x_{k-1})}.$$
收敛阶为黄金比 $\frac{1+\sqrt5}2\approx1.618$（超线性），每步只需一次函数求值，不需要导数——综合效率往往优于牛顿法。

## 收敛阶 {#convergence-order}
type: 概念 | en: Order of convergence | w: 3 | 考纲: 误差思想, 非线性方程组数值方法
前置: fixed-point-iteration
alias: 收敛阶, 线性收敛, 二次收敛, 超线性收敛, 收敛速度

若 $\lim\frac{\abs{e_{k+1}}}{\abs{e_k}^p}=C$（$C>0$），称迭代 $p$ 阶收敛。$p=1$（且 $C<1$）为线性收敛，每步误差缩小固定比例；$p=2$ 为二次收敛，正确位数每步翻倍。

### 对比
| 方法 | 收敛阶 | 每步代价 |
|:-:|:-:|:-:|
| 二分法 | $1$（比率 $\frac12$） | 一次函数值 |
| 不动点迭代 | $1$（比率 $\abs{g'(x^*)}$） | 一次函数值 |
| 割线法 | $\approx1.618$ | 一次函数值 |
| 牛顿法 | $2$ | 函数值 + 导数值 |

### 注记
若迭代函数满足 $g'(x^*)=\cdots=g^{(p-1)}(x^*)=0$，$g^{(p)}(x^*)\ne0$，则恰为 $p$ 阶收敛。牛顿法作为不动点迭代 $g(x)=x-\frac f{f'}$ 满足 $g'(x^*)=0$，所以是二阶的。

## 非线性方程组的牛顿法 {#newton-systems}
type: 算法 | en: Newton's method for systems | w: 3 | 考纲: 非线性方程组数值方法
源于: newton-method
前置: jacobian, gaussian-elimination
alias: 多元牛顿法, 雅可比矩阵, 拟牛顿法

解 $\vv F(\vv x)=\vv0$（$n$ 个方程 $n$ 个未知数）：每步解线性方程组
$$J(\vv x_k)\vv\delta_k=-\vv F(\vv x_k),\qquad\vv x_{k+1}=\vv x_k+\vv\delta_k,$$
$J$ 是雅可比矩阵。在非奇异解附近二次收敛。

### 例题
求曲线 $x^2+y^2=4$ 与 $\ee^x+y=1$ 的交点：$J=\begin{pmatrix}2x&2y\\\ee^x&1\end{pmatrix}$，从 $(1,-1.7)$ 出发几步即收敛到 $(1.004,-1.729)$ 附近。

### 注记
每步要计算雅可比矩阵并解一个线性方程组，代价约 $O(n^3)$。拟牛顿法（如布罗伊登方法）用秩一修正近似更新雅可比矩阵，避免重复计算导数。非线性方程组没有类似二分法的“保险”方法，好的初值至关重要。

## 逻辑斯谛映射与混沌 {#logistic-map}
type: 模型 | en: Logistic map and chaos | w: 3 | level: ext
前置: fixed-point-iteration
相关: logistic-equation
anim: cobweb
alias: 逻辑斯谛映射, 倍周期分岔, 费根鲍姆常数, 混沌, 蝴蝶效应

迭代 $x_{n+1}=rx_n(1-x_n)$，$x\in[0,1]$，$r\in[0,4]$。随着 $r$ 增大：$r<3$ 收敛到不动点 $1-\frac1r$；$r=3$ 时不动点失稳，出现周期 $2$；接着周期 $4,8,16,\dots$（倍周期分岔），在 $r_\infty\approx3.5699$ 处进入混沌；$r=4$ 时对初值极度敏感。

### 为什么失稳
不动点 $x^*=1-\frac1r$ 处 $g'(x^*)=2-r$，$\abs{g'(x^*)}<1\iff1<r<3$：这正是不动点迭代的收敛条件。

### 注记
相邻分岔点间距之比趋于费根鲍姆常数 $\delta\approx4.6692$，它对一大类单峰映射都相同（普适性）。一个简单的二次函数就能产生混沌，彻底改变了人们对“确定性系统可以预测”的看法。
