---
galaxy: analysis
cluster: integral
title: 积分
en: Integration
order: 5
level: core
---

## 原函数与不定积分 {#antiderivative}
type: 定义 | en: Antiderivative | w: 4 | 考纲: 单变量微积分
前置: derivative-rules, differential
后续: integration-techniques, ftc
alias: 不定积分, 原函数, 积分表

若 $F'(x)=f(x)$，称 $F$ 是 $f$ 的一个原函数；全体原函数 $F(x)+C$ 记为 $\int f(x)\,\dd x$。在区间上，两个原函数相差常数（导数为零的函数是常数）。

### 注记
- 基本积分表就是导数表倒过来读：$\int x^\alpha\dd x=\frac{x^{\alpha+1}}{\alpha+1}+C$（$\alpha\ne-1$），$\int\frac{\dd x}x=\ln\abs x+C$，$\int\frac{\dd x}{1+x^2}=\arctan x+C$。
- 初等函数的原函数不一定是初等函数：$\ee^{-x^2}$、$\frac{\sin x}x$、$\frac1{\ln x}$ 的原函数都不能用初等函数表示（刘维尔定理）。
- 有跳跃间断点的函数在包含该点的区间上没有原函数（由 [[darboux-theorem]]）。

## 换元积分与分部积分 {#integration-techniques}
type: 方法 | en: Substitution and integration by parts | w: 4 | 考纲: 单变量微积分
前置: antiderivative, chain-rule
alias: 换元法, 凑微分, 分部积分, 三角换元, 有理函数积分

- **第一换元（凑微分）**：$\int f(g(x))g'(x)\,\dd x=\int f(u)\,\dd u$；
- **第二换元**：令 $x=\varphi(t)$，如 $\sqrt{a^2-x^2}$ 用 $x=a\sin t$；
- **分部积分**：$\int u\,\dd v=uv-\int v\,\dd u$，来自乘积求导法则。

### 例题
$\int x\ee^x\dd x=x\ee^x-\int\ee^x\dd x=(x-1)\ee^x+C$。
$\int\ee^x\sin x\,\dd x$：分部两次后出现原积分，$I=\ee^x\sin x-\ee^x\cos x-I$，所以 $I=\frac12\ee^x(\sin x-\cos x)+C$。

### 注记
有理函数总能积出（部分分式分解后只剩 $\ln$ 与 $\arctan$ 型）；三角有理式用万能代换 $t=\tan\frac x2$ 化为有理函数。

## 黎曼积分 {#riemann-integral}
type: 定义 | en: Riemann integral | w: 5 | 考纲: 单变量微积分
前置: continuity, sequence-limit
后续: darboux-sums, integral-properties, ftc
推广为: lebesgue-integral, double-integral
alias: 定积分, 黎曼和, 积分和
anim: riemann-sum
tags: 积分

把 $[a,b]$ 分割为小区间，在每个小区间取一点 $\xi_i$，作黎曼和 $\sum f(\xi_i)\Delta x_i$。若分割的最大宽度 $\lambda\to0$ 时黎曼和趋于同一个数 $I$（与分割方式和 $\xi_i$ 的取法无关），称 $f$ 黎曼可积，$\int_a^bf(x)\,\dd x=I$。

### 直观
曲边梯形的面积用一排细长矩形的面积和逼近，矩形越细越准。“与取法无关”是关键：在每个小区间里无论取左端点、右端点还是中点，极限都相同。

### 例题
用定义计算 $\int_0^1x^2\dd x$：等分 $n$ 份取右端点，
$$\sum_{i=1}^n\left(\frac in\right)^2\frac1n=\frac{n(n+1)(2n+1)}{6n^3}\to\frac13.$$
（已知 $x^2$ 连续可积，所以特殊分割的极限就是积分值。）

### 注记
狄利克雷函数在 $[0,1]$ 上不可积：任何小区间里既有有理数又有无理数，黎曼和可以取 $1$ 也可以取 $0$。勒贝格积分把它的积分定义为 $0$，见 [[lebesgue-integral]]。

## 达布和与可积准则 {#darboux-sums}
type: 定理 | en: Darboux sums and integrability criterion | w: 3 | 考纲: 单变量微积分
前置: riemann-integral, supremum
推出: integrability
alias: 上和, 下和, 振幅, 可积准则, 达布定理

对分割 $T$，上和 $S(T)=\sum M_i\Delta x_i$、下和 $s(T)=\sum m_i\Delta x_i$（$M_i,m_i$ 为小区间上的上、下确界）。加细分割时上和不增、下和不减。

> [!定理] 可积准则
> 有界函数 $f$ 在 $[a,b]$ 上可积 $\iff$ 对任意 $\eps>0$，存在分割 $T$ 使 $S(T)-s(T)=\sum\omega_i\Delta x_i<\eps$，其中 $\omega_i=M_i-m_i$ 是振幅。

### 直观
上和是外接矩形面积，下和是内接矩形面积。可积就是“外面的盒子与里面的盒子之间的空隙可以做得任意小”。

## 可积函数类 {#integrability}
type: 定理 | en: Classes of integrable functions | w: 3 | 考纲: 单变量微积分
源于: darboux-sums
前置: cantor-uniform
alias: 连续函数可积, 单调函数可积, 勒贝格可积准则

以下函数在 $[a,b]$ 上黎曼可积：
1. 连续函数；
2. 单调函数；
3. 只有有限个间断点的有界函数。

### 证明
连续：由 [[cantor-uniform]]，$f$ 一致连续，取 $\delta$ 使 $\abs{x-y}<\delta\Rightarrow\abs{f(x)-f(y)}<\frac\eps{b-a}$，宽度小于 $\delta$ 的分割上 $\sum\omega_i\Delta x_i<\eps$。
单调（设递增）：等分 $n$ 份，$\sum\omega_i\Delta x_i=\frac{b-a}n\sum\left(f(x_i)-f(x_{i-1})\right)=\frac{(b-a)(f(b)-f(a))}n\to0$。

### 注记
勒贝格给出了完整答案：有界函数黎曼可积 $\iff$ 其间断点集是零测集。黎曼函数间断点为全体有理数（零测），所以可积，积分为 $0$。

## 积分的性质与积分中值定理 {#integral-properties}
type: 性质 | en: Properties of the integral | w: 3 | 考纲: 单变量微积分
前置: riemann-integral
alias: 积分中值定理, 线性性, 区间可加性, 保号性

定积分是线性的、对区间可加的、保序的：$f\le g\Rightarrow\int_a^bf\le\int_a^bg$；$\abs{\int_a^bf}\le\int_a^b\abs f$。

> [!定理] 积分第一中值定理
> 若 $f$ 在 $[a,b]$ 上连续，$g$ 可积且不变号，则存在 $\xi\in[a,b]$ 使 $\int_a^bf g=f(\xi)\int_a^bg$。取 $g\equiv1$：$\int_a^bf=f(\xi)(b-a)$——连续函数在某点取到它的平均值。

### 证明
设 $g\ge0$，$m\le f\le M$，则 $m\int g\le\int fg\le M\int g$。若 $\int g=0$ 任取 $\xi$；否则 $\frac{\int fg}{\int g}\in[m,M]$，由 [[ivt]] 被 $f$ 在某点取到。

## 微积分基本定理 {#ftc}
type: 定理 | en: Fundamental theorem of calculus | w: 5 | 考纲: 单变量微积分
前置: riemann-integral, antiderivative, integral-properties
推广为: greens-theorem, stokes-theorem
后续: integral-apps, improper-integral
alias: 牛顿-莱布尼茨公式, 微积分基本定理, 变上限积分
tags: 微积分

微分与积分互为逆运算：
1. 若 $f$ 在 $[a,b]$ 上连续，则 $F(x)=\int_a^xf(t)\,\dd t$ 可导且 $F'(x)=f(x)$；
2. 若 $F$ 是 $f$ 的原函数（$f$ 可积），则
$$\int_a^bf(x)\,\dd x=F(b)-F(a).$$

### 证明
(1) $\frac{F(x+h)-F(x)}h=\frac1h\int_x^{x+h}f=f(\xi_h)$（积分中值定理），$h\to0$ 时 $\xi_h\to x$，由连续性得 $f(x)$。
(2) 对任意分割，由拉格朗日中值定理 $F(b)-F(a)=\sum\left(F(x_i)-F(x_{i-1})\right)=\sum f(\xi_i)\Delta x_i$，这正是一个黎曼和；令分割加细即得。

### 直观
“速度对时间的积分是位移”：把位移的瞬时变化率累积起来，就回到了总变化量。求面积这种需要无穷多次相加的问题，变成了找一个原函数、算两个值的相减。

### 注记
这个定理在高维的推广是格林公式、高斯公式与斯托克斯公式：区域内部的“导数”的积分等于边界上的积分，统一形式为 $\int_M\dd\omega=\int_{\partial M}\omega$，见 [[differential-forms]]。

## 定积分的应用 {#integral-apps}
type: 应用 | en: Applications of the integral | w: 3 | 考纲: 单变量微积分, 弧长
前置: ftc
后续: arc-length
alias: 面积, 旋转体体积, 弧长, 微元法

微元法：先写出一小段 $\dd x$ 上所求量的近似 $\dd Q=q(x)\dd x$，再积分。
- 面积：$\int_a^b\abs{f(x)-g(x)}\dd x$；
- 旋转体体积：$V=\pi\int_a^bf(x)^2\dd x$；
- 曲线弧长：$s=\int_a^b\sqrt{1+f'(x)^2}\,\dd x$；
- 物理：变力做功 $\int F\,\dd x$、质心、转动惯量、液体压力。

### 例题
半径为 $R$ 的球的体积：把半圆 $y=\sqrt{R^2-x^2}$ 绕 $x$ 轴旋转，$V=\pi\int_{-R}^R(R^2-x^2)\dd x=\frac43\pi R^3$。

## 反常积分 {#improper-integral}
type: 定义 | en: Improper integral | w: 4 | 考纲: 单变量微积分
前置: ftc
后续: gamma-function, integral-test
alias: 广义积分, 无穷积分, 瑕积分, p 积分

积分区间无穷或被积函数无界时，用极限定义：$\int_a^{+\infty}f=\lim_{b\to+\infty}\int_a^bf$；瑕点 $a$ 处 $\int_a^bf=\lim_{\eps\to0^+}\int_{a+\eps}^bf$。

> [!定理] p 积分
> $\int_1^{+\infty}\frac{\dd x}{x^p}$ 当 $p>1$ 时收敛，$p\le1$ 时发散；$\int_0^1\frac{\dd x}{x^p}$ 当 $p<1$ 时收敛，$p\ge1$ 时发散。

### 例题
$\int_0^{+\infty}\frac{\sin x}x\dd x=\frac\pi2$ 条件收敛（狄利克雷积分），而 $\int_0^{+\infty}\abs{\frac{\sin x}x}\dd x$ 发散。$\int_{-\infty}^{+\infty}\ee^{-x^2}\dd x=\sqrt\pi$，见 [[gaussian-integral]]。

### 注记
判敛方法与级数平行：比较判别法、极限比较、狄利克雷与阿贝尔判别法。

## 含参积分与积分号下求导 {#leibniz-integral-rule}
type: 定理 | en: Differentiation under the integral sign | w: 3 | 考纲: 单变量微积分, 多元微积分
前置: ftc, partial-derivative
alias: 含参变量积分, 费曼积分技巧, 莱布尼茨积分法则

若 $f(x,t)$ 与 $\frac{\partial f}{\partial t}$ 在 $[a,b]\times[c,d]$ 上连续，则 $I(t)=\int_a^bf(x,t)\,\dd x$ 可导且
$$I'(t)=\int_a^b\frac{\partial f}{\partial t}(x,t)\,\dd x.$$

### 例题
求 $\int_0^1\frac{x^t-1}{\ln x}\dd x$（$t>-1$）。令它为 $I(t)$，$I'(t)=\int_0^1x^t\dd x=\frac1{t+1}$，且 $I(0)=0$，故 $I(t)=\ln(1+t)$。这个技巧因费曼的推崇而闻名。

### 注记
对反常积分，需要 $\int\frac{\partial f}{\partial t}\dd x$ 关于 $t$ 一致收敛才能交换。

## Γ 函数 {#gamma-function}
type: 概念 | en: Gamma function | w: 3 | 考纲: 单变量微积分
前置: improper-integral, integration-techniques
后续: stirling-formula
alias: 伽马函数, 阶乘的推广, B 函数, 贝塔函数

$$\Gamma(s)=\int_0^{+\infty}x^{s-1}\ee^{-x}\dd x\quad(s>0).$$
分部积分得 $\Gamma(s+1)=s\Gamma(s)$，$\Gamma(1)=1$，所以 $\Gamma(n+1)=n!$：Γ 函数把阶乘推广到实数。

### 例题
$\Gamma\left(\frac12\right)=\int_0^\infty x^{-1/2}\ee^{-x}\dd x\overset{x=t^2}{=}2\int_0^\infty\ee^{-t^2}\dd t=\sqrt\pi$。于是 $\left(\frac12\right)!=\Gamma\left(\frac32\right)=\frac{\sqrt\pi}2$。

### 应用
$n$ 维单位球体积 $V_n=\dfrac{\pi^{n/2}}{\Gamma\left(\frac n2+1\right)}$；卡方分布、伽马分布的密度中都有 Γ 函数。

## 斯特林公式 {#stirling-formula}
type: 公式 | en: Stirling's formula | w: 3 | level: ext
前置: gamma-function, taylor-theorem
应用于: de-moivre-laplace
alias: 阶乘的渐近公式, Stirling

$$n!\sim\sqrt{2\pi n}\left(\frac n\ee\right)^n\quad(n\to\infty).$$
即使 $n=10$，相对误差也只有约 $0.8\%$。

### 证明思路
$\ln n!=\sum\ln k$ 与 $\int_1^n\ln x\,\dd x=n\ln n-n+1$ 比较（梯形公式），得 $n!\sim C\sqrt n\left(\frac n\ee\right)^n$；常数 $C=\sqrt{2\pi}$ 由沃利斯公式 $\frac\pi2=\prod_{k\ge1}\frac{4k^2}{4k^2-1}$ 确定。另一条路线是对 $\Gamma(n+1)=\int_0^\infty\ee^{n\ln x-x}\dd x$ 用拉普拉斯方法（在最大值点 $x=n$ 附近作二阶展开，化为高斯积分）。

### 应用
估计组合数 $\binom{2n}n\sim\frac{4^n}{\sqrt{\pi n}}$；证明二项分布趋于正态分布（[[de-moivre-laplace]]）；统计物理中熵的计算。
