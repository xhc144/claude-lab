---
galaxy: hs
cluster: hs-elementary
title: 基本初等函数
en: Elementary functions
order: 3
level: hs
---

## 二次函数 {#quadratic-function}
type: 概念 | en: Quadratic function | w: 4 | 考纲: 中学数学全部内容
前置: function, quadratic-equation
后续: quadratic-inequality, parabola
alias: 抛物线, 顶点式, 对称轴

$f(x)=ax^2+bx+c$（$a\ne0$）的图像是抛物线，配方得顶点式
$$f(x)=a\left(x+\frac b{2a}\right)^2+\frac{4ac-b^2}{4a},$$
对称轴 $x=-\frac b{2a}$，$a>0$ 时开口向上、在顶点取最小值。

### 例题
若关于 $x$ 的方程 $x^2+(m-2)x+5-m=0$ 的两根都大于 $2$，求 $m$ 的范围。

**解**：令 $f(x)=x^2+(m-2)x+5-m$。两根都大于 $2$ 等价于三个条件：$\Delta=(m-2)^2-4(5-m)\ge0$，对称轴 $-\frac{m-2}2>2$，$f(2)=m+5>0$。依次得 $m\le-4$ 或 $m\ge4$；$m<-2$；$m>-5$。综合：$-5<m\le-4$。这就是“根的分布”问题：用判别式、对称轴、端点值三把尺子定位。

### 应用
二次函数是最简单的非线性函数：抛体轨迹、面积最优化、最小二乘的目标函数都是二次的；它的图像是 [[parabola]]。

## 幂函数 {#power-function}
type: 概念 | en: Power function | w: 2 | 考纲: 中学数学全部内容
前置: function
相关: growth-comparison
alias: y=x^a

形如 $y=x^\alpha$（$\alpha$ 为常数）的函数。所有幂函数都过 $(1,1)$；$\alpha>0$ 时在 $(0,+\infty)$ 上递增，$\alpha<0$ 时递减。

### 注记
- $\alpha=1,2,3,\frac12,-1$ 是中学要求熟悉的五个：$x$、$x^2$、$x^3$、$\sqrt x$、$\frac1x$。
- 第一象限内：$\alpha>1$ 时图像下凸（增长越来越快），$0<\alpha<1$ 时上凸。
- $x^\alpha$ 的定义域依 $\alpha$ 而定：$x^{1/3}$ 对一切实数有意义，$x^{1/2}$ 只在 $x\ge0$ 时有意义。

## 指数函数 {#exponential-function}
type: 概念 | en: Exponential function | w: 5 | 考纲: 中学数学全部内容
前置: function, power-function
后续: logarithm, growth-comparison
alias: 指数函数, e^x, 指数增长
tags: 指数

$y=a^x$（$a>0$，$a\ne1$），定义域 $\R$，值域 $(0,+\infty)$，图像过 $(0,1)$。$a>1$ 时递增，$0<a<1$ 时递减。最重要的底是 $\ee$：$\ee^x$ 是唯一满足 $f'=f$、$f(0)=1$ 的函数。

> [!性质] 指数运算律
> $a^xa^y=a^{x+y}$，$(a^x)^y=a^{xy}$，$(ab)^x=a^xb^x$。函数方程 $f(x+y)=f(x)f(y)$ 的连续非零解恰为指数函数 $a^x$。

### 注记
无理指数的定义依赖实数完备性：$2^{\sqrt2}$ 定义为 $2^{r}$ 当有理数 $r\to\sqrt2$ 时的极限。大学里常用 $\ee^x=\sum_{n\ge0}\frac{x^n}{n!}$ 或 $\ee^x=\lim\left(1+\frac xn\right)^n$ 定义，见 [[number-e]] 与 [[taylor-series]]。

### 应用
放射性衰变、人口增长、复利、RC 电路放电都满足“变化率与当前量成正比”：$y'=ky$ 的解是 $y=C\ee^{kx}$，见 [[separable-ode]]。

## 对数 {#logarithm}
type: 概念 | en: Logarithm | w: 4 | 考纲: 中学数学全部内容
前置: exponential-function
后续: logarithmic-function
alias: log, ln, 换底公式, 对数运算

若 $a^b=N$（$a>0$，$a\ne1$，$N>0$），则 $b=\log_aN$。对数把乘法变成加法——这正是纳皮尔发明它的目的：在没有计算器的时代简化天文计算。

> [!公式] 对数运算律
> $\log_a(MN)=\log_aM+\log_aN$，$\log_a\frac MN=\log_aM-\log_aN$，$\log_aM^n=n\log_aM$，换底公式 $\log_ab=\dfrac{\log_cb}{\log_ca}$。

### 例题
比较 $\log_23$ 与 $\log_34$ 的大小。

**解**：$\log_23-\log_34=\frac{\ln3}{\ln2}-\frac{\ln4}{\ln3}=\frac{(\ln3)^2-\ln2\ln4}{\ln2\ln3}$。由 [[am-gm]]，$\ln2\ln4\le\left(\frac{\ln2+\ln4}2\right)^2=\left(\frac{\ln8}2\right)^2<\left(\frac{\ln9}2\right)^2=(\ln3)^2$，所以 $\log_23>\log_34$。

## 对数函数 {#logarithmic-function}
type: 概念 | en: Logarithmic function | w: 4 | 考纲: 中学数学全部内容
前置: logarithm, inverse-function
后续: growth-comparison
alias: ln x, 自然对数

$y=\log_ax$（$a>0$，$a\ne1$）是 $y=a^x$ 的反函数，定义域 $(0,+\infty)$，值域 $\R$，图像过 $(1,0)$，与 $y=a^x$ 关于 $y=x$ 对称。自然对数 $\ln x=\log_\ee x$ 满足 $(\ln x)'=\frac1x$。

### 注记
- 底数相同时，$a>1$ 递增，$0<a<1$ 递减；同一个 $x>1$，底越大对数越小（$a>1$ 时）。
- 常用不等式：$\ln x\le x-1$（等号仅在 $x=1$），即 $\ln(1+x)\le x$；它是 $\ln$ 的凹性给出的切线不等式，见 [[derivative-inequality]]。

## 指数、对数与幂函数的增长比较 {#growth-comparison}
type: 性质 | en: Rates of growth | w: 3 | 考纲: 中学数学全部内容
前置: exponential-function, logarithmic-function, power-function
后续: lhopital
alias: 指数爆炸, 对数增长

当 $x\to+\infty$ 时，对任意 $a>1$、$\alpha>0$，
$$\log_ax\ \ll\ x^\alpha\ \ll\ a^x,$$
即 $\lim\frac{\ln x}{x^\alpha}=0$，$\lim\frac{x^\alpha}{a^x}=0$。指数增长终将压倒任何幂，幂终将压倒任何对数。

### 证明
用洛必达法则：$\lim\frac{\ln x}{x^\alpha}=\lim\frac{1/x}{\alpha x^{\alpha-1}}=\lim\frac1{\alpha x^\alpha}=0$。对第二个极限，$\frac{x^\alpha}{a^x}=\left(\frac{x}{b^x}\right)^\alpha$，其中 $b=a^{1/\alpha}>1$，而 $\frac x{b^x}\to0$（再用一次洛必达）。

### 应用
算法复杂度：$O(\log n)$ 的二分查找远快于 $O(n)$ 的顺序查找，$O(2^n)$ 的穷举在 $n=100$ 时已不可行。比较 $1.01^{365}\approx37.8$ 与 $0.99^{365}\approx0.026$ 也是指数增长的直观例子。
