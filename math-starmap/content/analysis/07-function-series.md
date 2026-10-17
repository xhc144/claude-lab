---
galaxy: analysis
cluster: function-series
title: 函数项级数与幂级数
en: Sequences of functions and power series
order: 7
level: core
---

## 一致收敛 {#uniform-convergence}
type: 定义 | en: Uniform convergence | w: 5 | 考纲: 单变量微积分
前置: series, uniform-continuity
后续: weierstrass-m-test, uniform-limit-theorems
alias: 一致收敛, 逐点收敛, 内闭一致收敛

函数列 $f_n\to f$ 逐点收敛只要求每个 $x$ 各自收敛；一致收敛要求同一个 $N$ 对所有 $x$ 都管用：
$$\sup_{x\in I}\abs{f_n(x)-f(x)}\to0.$$
几何上，从某个 $n$ 起，$f_n$ 的整个图像落在 $f$ 的 $\eps$ 宽“带子”里。

### 例题
$f_n(x)=x^n$ 在 $[0,1]$ 上逐点收敛到 $f(x)=\begin{cases}0,&0\le x<1\\1,&x=1\end{cases}$，但不一致收敛：$\sup_{[0,1)}x^n=1$。连续函数的逐点极限可以不连续。在 $[0,a]$（$a<1$）上则一致收敛，因为 $\sup=a^n\to0$。

### 注记
一致收敛的柯西准则：$\sup_x\abs{f_m(x)-f_n(x)}<\eps$（$m,n>N$）。

## 魏尔斯特拉斯判别法 {#weierstrass-m-test}
type: 判别法 | en: Weierstrass M-test | w: 3 | 考纲: 单变量微积分
前置: uniform-convergence, comparison-test
alias: M 判别法, 优级数判别法

若 $\abs{u_n(x)}\le M_n$ 对一切 $x\in I$ 成立，且 $\sum M_n$ 收敛，则 $\sum u_n(x)$ 在 $I$ 上绝对且一致收敛。

### 例题
$\sum\frac{\cos nx}{n^2}$ 在 $\R$ 上一致收敛（$M_n=\frac1{n^2}$），所以它的和函数连续。[[weierstrass-function]] 的连续性也由此得到。

## 一致收敛的分析性质 {#uniform-limit-theorems}
type: 定理 | en: Uniform limits: continuity, integration, differentiation | w: 4 | 考纲: 单变量微积分
前置: uniform-convergence
应用于: power-series, fourier-series
alias: 逐项积分, 逐项求导, 极限交换次序, 连续性定理

1. **连续性**：连续函数列一致收敛，极限函数连续；
2. **逐项积分**：在 $[a,b]$ 上一致收敛时 $\int_a^b\lim f_n=\lim\int_a^bf_n$；
3. **逐项求导**：若 $f_n'$ 一致收敛且 $f_n(x_0)$ 收敛，则 $f_n$ 一致收敛于某个 $f$，且 $f'=\lim f_n'$。

### 证明
(1) “$\eps/3$ 论证”：$\abs{f(x)-f(x_0)}\le\abs{f(x)-f_N(x)}+\abs{f_N(x)-f_N(x_0)}+\abs{f_N(x_0)-f(x_0)}$，第一、三项由一致收敛控制（与 $x$ 无关），第二项由 $f_N$ 的连续性控制。
(2) $\abs{\int f_n-\int f}\le(b-a)\sup\abs{f_n-f}\to0$。

### 注记
这些定理的共同主题是“两个极限交换次序”。没有一致性就可能出错：$f_n(x)=n^2x\ee^{-nx}$ 在 $[0,1]$ 上逐点趋于 $0$，但 $\int_0^1f_n\to1$。勒贝格积分的 [[dominated-convergence]] 给出更灵活的交换条件。

## 幂级数 {#power-series}
type: 定义 | en: Power series | w: 5 | 考纲: 单变量微积分
前置: series, ratio-root-test
源于: geometric-series
后续: taylor-series
alias: 收敛半径, 收敛域, 阿贝尔定理, 柯西-阿达马公式

形如 $\sum_{n=0}^\infty a_n(x-x_0)^n$ 的级数。存在收敛半径 $R\in[0,+\infty]$：$\abs{x-x_0}<R$ 时绝对收敛，$\abs{x-x_0}>R$ 时发散，端点需单独判断。
$$\frac1R=\limsup_{n\to\infty}\sqrt[n]{\abs{a_n}}\quad\text{（柯西–阿达马公式）}.$$

### 性质
在 $(x_0-R,x_0+R)$ 内的任何闭区间上一致收敛；和函数在收敛区间内连续、可以逐项求导和逐项积分，且收敛半径不变。

### 例题
$\sum_{n\ge1}\frac{x^n}n$：$R=1$；$x=1$ 时为调和级数发散，$x=-1$ 时为交错级数收敛，收敛域 $[-1,1)$。逐项求导得 $\sum x^{n-1}=\frac1{1-x}$，所以和函数为 $-\ln(1-x)$。

## 泰勒级数与解析函数 {#taylor-series}
type: 定理 | en: Taylor series | w: 4 | 考纲: 单变量微积分
前置: power-series, maclaurin-expansions
源于: taylor-theorem
推出: euler-formula
后续: complex-analytic
alias: 泰勒级数, 麦克劳林级数, 解析函数, 实解析
anim: taylor

$C^\infty$ 函数在 $x_0$ 处的泰勒级数 $\sum\frac{f^{(n)}(x_0)}{n!}(x-x_0)^n$ 收敛到 $f$ 当且仅当余项 $R_n(x)\to0$。能在每点附近展开成收敛幂级数的函数叫（实）解析函数。

### 例题
$\ee^x=\sum\frac{x^n}{n!}$ 对一切 $x$ 成立：拉格朗日余项 $\abs{R_n}\le\frac{\ee^{\abs x}\abs x^{n+1}}{(n+1)!}\to0$。

### 注记
光滑不等于解析：$f(x)=\ee^{-1/x^2}$（$f(0)=0$）在 $0$ 处各阶导数都为零，泰勒级数恒为 $0$，却不等于 $f$。复变函数中情况截然不同：复可导一次就自动解析，见 [[complex-analytic]]。

## 欧拉公式 {#euler-formula}
type: 公式 | en: Euler's formula | w: 5 | 考纲: 单变量微积分
源于: taylor-series
前置: complex-polar-form
应用于: fourier-series, alternating-current, linear-ode-constant
alias: e^{iθ}=cosθ+isinθ, 欧拉恒等式, e^{iπ}+1=0
anim: complex-mult
tags: 复数, 指数

$$\ee^{\ii\theta}=\cos\theta+\ii\sin\theta.$$
取 $\theta=\pi$ 得 $\ee^{\ii\pi}+1=0$，把 $\ee,\ii,\pi,1,0$ 五个基本常数连在一起。

### 证明
把 $\ee^z=\sum\frac{z^n}{n!}$ 中的 $z$ 换成 $\ii\theta$，按 $\ii^n$ 的周期 $1,\ii,-1,-\ii$ 把实部、虚部分开：
$$\ee^{\ii\theta}=\left(1-\frac{\theta^2}{2!}+\frac{\theta^4}{4!}-\cdots\right)+\ii\left(\theta-\frac{\theta^3}{3!}+\cdots\right)=\cos\theta+\ii\sin\theta.$$
（绝对收敛的级数可以重排。）

### 直观
$\ee^{\ii\theta}$ 是单位圆上辐角为 $\theta$ 的点。$\frac{\dd}{\dd\theta}\ee^{\ii\theta}=\ii\ee^{\ii\theta}$：速度永远垂直于位置向量且长度为 $1$——这正是匀速圆周运动。

### 应用
三角恒等式变成指数运算（$\ee^{\ii(\alpha+\beta)}=\ee^{\ii\alpha}\ee^{\ii\beta}$ 即和角公式）；交流电的相量法；傅里叶级数的复数形式 $\sum c_n\ee^{\ii nx}$；常系数线性微分方程的复特征根。

## 魏尔斯特拉斯逼近定理 {#weierstrass-approximation}
type: 定理 | en: Weierstrass approximation theorem | w: 3 | 考纲: 单变量微积分, 逼近
前置: uniform-convergence, cantor-uniform
应用于: best-uniform-approx
alias: 多项式逼近, 伯恩斯坦多项式, Stone–Weierstrass

闭区间上的任何连续函数都可以被多项式一致逼近：对 $f\in C[a,b]$ 与 $\eps>0$，存在多项式 $p$ 使 $\max_{[a,b]}\abs{f-p}<\eps$。

### 证明
（伯恩斯坦的概率证明，在 $[0,1]$ 上）令
$$B_n(x)=\sum_{k=0}^nf\!\left(\frac kn\right)\binom nkx^k(1-x)^{n-k}=\E f\!\left(\frac{S_n}n\right),$$
其中 $S_n\sim B(n,x)$。由切比雪夫不等式，$\frac{S_n}n$ 以高概率落在 $x$ 附近（$\Var=\frac{x(1-x)}n\le\frac1{4n}$）；再用 $f$ 的一致连续性与有界性，得 $\abs{B_n(x)-f(x)}\to0$ 关于 $x$ 一致。

### 注记
注意与泰勒展开的区别：泰勒多项式只在一点附近好，逼近定理在整个区间上好，而且不要求可导。逼近多项式也不能随便取插值多项式，见 [[runge-phenomenon]]。
