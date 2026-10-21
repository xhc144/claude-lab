---
galaxy: analysis
cluster: continuity
title: 函数极限与连续
en: Limits of functions and continuity
order: 2
level: core
---

## 函数极限 {#function-limit}
type: 定义 | en: Limit of a function | w: 5 | 考纲: 单变量微积分
前置: sequence-limit
后续: continuity, derivative
alias: ε-δ 定义, 左极限, 右极限, 单侧极限
anim: epsilon-delta

$\displaystyle\lim_{x\to x_0}f(x)=A$ 指：对任意 $\eps>0$，存在 $\delta>0$，使得当 $0<\abs{x-x_0}<\delta$ 时 $\abs{f(x)-A}<\eps$。$f$ 在 $x_0$ 处可以没有定义，极限只看 $x_0$ 附近而不看 $x_0$ 本身。

### 直观
对手给出纵向的一条宽 $2\eps$ 的带子 $(A-\eps,A+\eps)$，你必须找到横向的一个去心邻域，使函数图像在这个邻域上整个落在带子里。

### 例题
证明 $\displaystyle\lim_{x\to2}x^2=4$。

**证**：$\abs{x^2-4}=\abs{x-2}\abs{x+2}$。先限制 $\abs{x-2}<1$，则 $\abs{x+2}<5$。任给 $\eps>0$，取 $\delta=\min\left(1,\frac\eps5\right)$，则 $0<\abs{x-2}<\delta$ 时 $\abs{x^2-4}<5\delta\le\eps$。

### 注记
- 极限存在 $\iff$ 左右极限存在且相等。$\displaystyle\lim_{x\to0}\frac{\abs x}x$ 不存在。
- 自变量趋于无穷、函数值趋于无穷的定义类似，共有 24 种组合。

## 海涅定理 {#heine-theorem}
type: 定理 | en: Sequential criterion (Heine) | w: 3 | 考纲: 单变量微积分
前置: function-limit, sequence-limit
alias: 归结原则, Heine 定理, 序列刻画

$\displaystyle\lim_{x\to x_0}f(x)=A$ 当且仅当：对每个满足 $x_n\to x_0$、$x_n\ne x_0$ 的数列，都有 $f(x_n)\to A$。它是函数极限与数列极限之间的桥梁。

### 应用
证明极限**不存在**最方便：找两个趋于 $x_0$ 的数列使函数值趋于不同极限。例如 $\sin\frac1x$ 在 $0$ 处：取 $x_n=\frac1{n\pi}$ 得 $0$，取 $x_n=\frac1{2n\pi+\pi/2}$ 得 $1$，故 $\displaystyle\lim_{x\to0}\sin\frac1x$ 不存在。

### 证明
必要性直接由定义得到。充分性用反证：若 $f(x)\not\to A$，则存在 $\eps_0$，对每个 $\delta=\frac1n$ 都有 $x_n$ 满足 $0<\abs{x_n-x_0}<\frac1n$ 但 $\abs{f(x_n)-A}\ge\eps_0$，这个数列 $x_n\to x_0$ 而 $f(x_n)\not\to A$。

## 两个重要极限 {#important-limits}
type: 公式 | en: Two fundamental limits | w: 4 | 考纲: 单变量微积分
前置: function-limit, squeeze-theorem, number-e
后续: derivative-rules
alias: sinx/x, (1+1/x)^x

$$\lim_{x\to0}\frac{\sin x}x=1,\qquad \lim_{x\to\infty}\left(1+\frac1x\right)^x=\ee.$$
第一个给出 $(\sin x)'=\cos x$，第二个给出 $(\ee^x)'=\ee^x$ 与 $(\ln x)'=\frac1x$。

### 证明
对 $0<x<\frac\pi2$，比较单位圆中的三角形面积、扇形面积、大三角形面积：
$$\frac12\sin x<\frac12x<\frac12\tan x\quad\Longrightarrow\quad\cos x<\frac{\sin x}x<1.$$
由 [[squeeze-theorem|夹逼]]，$x\to0^+$ 时极限为 $1$；$\frac{\sin x}x$ 是偶函数，左极限也是 $1$。
第二个：先由 [[number-e]] 得 $n\to\infty$ 时成立，再对 $n\le x<n+1$ 用 $\left(1+\frac1{n+1}\right)^n<\left(1+\frac1x\right)^x<\left(1+\frac1n\right)^{n+1}$ 夹逼。

### 注记
扇形面积公式本身用到了弧长与面积的概念；严格的分析教材里，常先用幂级数定义 $\sin x$，再导出这个极限，以避免循环论证。

## 无穷小的比较与等价代换 {#infinitesimal}
type: 方法 | en: Infinitesimals and asymptotic equivalence | w: 4 | 考纲: 单变量微积分
前置: function-limit, important-limits
后续: taylor-theorem
alias: 等价无穷小, 高阶无穷小, 小o记号, O 记号

极限为零的量叫无穷小。若 $\frac\alpha\beta\to0$，称 $\alpha$ 是比 $\beta$ 高阶的无穷小，记 $\alpha=o(\beta)$；若 $\frac\alpha\beta\to1$，称二者等价，$\alpha\sim\beta$。$x\to0$ 时：
$$\sin x\sim\tan x\sim\arcsin x\sim\ln(1+x)\sim\ee^x-1\sim x,\quad 1-\cos x\sim\frac{x^2}2,\quad (1+x)^\alpha-1\sim\alpha x.$$

### 例题
$\displaystyle\lim_{x\to0}\frac{\tan x-\sin x}{x^3}=\lim\frac{\tan x(1-\cos x)}{x^3}=\lim\frac{x\cdot\frac{x^2}2}{x^3}=\frac12.$

### 易错
等价代换只能用于乘积因子，不能用于和差：若直接把 $\tan x-\sin x$ 代换成 $x-x=0$ 就错了。和差情形要用泰勒展开：$\tan x-\sin x=\frac{x^3}2+o(x^3)$。

## 连续函数 {#continuity}
type: 定义 | en: Continuity | w: 5 | 考纲: 单变量微积分, 实数轴的连续性
前置: function-limit
后续: ivt, extreme-value-theorem, uniform-continuity, riemann-integral
推广为: continuity-topological
alias: 连续, 间断, 连续函数

$f$ 在 $x_0$ 处连续指 $\displaystyle\lim_{x\to x_0}f(x)=f(x_0)$：极限存在、函数有定义、且二者相等。用 $\eps$–$\delta$ 写：任意 $\eps>0$，存在 $\delta>0$，$\abs{x-x_0}<\delta\Rightarrow\abs{f(x)-f(x_0)}<\eps$。

### 注记
- 连续函数的和、差、积、商（分母非零）、复合仍连续；初等函数在定义区间内连续。
- 连续是局部性质，但闭区间上的连续函数拥有三大整体性质：[[ivt]]、[[extreme-value-theorem]]、[[cantor-uniform]]，它们都依赖实数完备性。
- 黎曼函数（$x=\frac pq$ 既约时取 $\frac1q$，无理点取 $0$）在每个无理点连续、每个有理点间断。

## 间断点的分类 {#discontinuity-types}
type: 概念 | en: Types of discontinuity | w: 2 | 考纲: 单变量微积分
前置: continuity
alias: 可去间断点, 跳跃间断点, 第二类间断点

- **第一类**（左右极限都存在）：相等但不等于函数值（或无定义）——可去间断；不相等——跳跃间断。
- **第二类**：至少一侧极限不存在，如 $\frac1x$ 在 $0$（无穷间断）、$\sin\frac1x$ 在 $0$（振荡间断）。

### 注记
单调函数只可能有跳跃间断，而且间断点至多可数（每个跳跃区间里取一个有理数，不同跳跃对应不同有理数）。

## 介值定理 {#ivt}
type: 定理 | en: Intermediate value theorem | w: 5 | 考纲: 单变量微积分, 实数轴的连续性
前置: continuity
源于: nested-intervals
特例: function-zeros
推广为: connectedness
应用于: bisection-method, brouwer-fixed-point
alias: 零点定理, 介值性, Bolzano 定理

闭区间 $[a,b]$ 上的连续函数取遍 $f(a)$ 与 $f(b)$ 之间的一切值。特别地，若 $f(a)f(b)<0$，则存在 $\xi\in(a,b)$ 使 $f(\xi)=0$。

### 证明
（二分法）设 $f(a)<0<f(b)$。取中点 $c$：若 $f(c)=0$ 结束；若 $f(c)<0$ 取 $[c,b]$，否则取 $[a,c]$。得到一列闭区间套，左端点函数值 $<0$，右端点 $>0$，长度 $\frac{b-a}{2^n}\to0$。由 [[nested-intervals]] 有公共点 $\xi$，两端点都趋于 $\xi$，由连续性 $f(\xi)\le0$ 且 $f(\xi)\ge0$，故 $f(\xi)=0$。

### 例题
**不动点**：$f:[0,1]\to[0,1]$ 连续，则存在 $x$ 使 $f(x)=x$。令 $g(x)=f(x)-x$，$g(0)\ge0\ge g(1)$，由介值定理 $g$ 有零点。这是 [[brouwer-fixed-point]] 的一维情形。

### 注记
在 $\Q$ 上不成立：$f(x)=x^2-2$ 在 $[1,2]\cap\Q$ 上连续、两端异号，却没有有理零点。介值定理的本质是区间的 [[connectedness|连通性]]。

## 最值定理 {#extreme-value-theorem}
type: 定理 | en: Extreme value theorem | w: 4 | 考纲: 单变量微积分, 实数轴的紧致性
前置: continuity, bolzano-weierstrass
推广为: compactness
alias: 有界性定理, 最大值最小值定理, Weierstrass 定理

闭区间上的连续函数有界，并且一定取到最大值和最小值。

### 证明
有界性：反设 $f$ 无上界，取 $x_n$ 使 $f(x_n)>n$。由 [[bolzano-weierstrass]] 有子列 $x_{n_k}\to\xi\in[a,b]$，由连续性 $f(x_{n_k})\to f(\xi)$，但 $f(x_{n_k})>n_k\to\infty$，矛盾。
取到最大值：令 $M=\sup f$，取 $x_n$ 使 $f(x_n)>M-\frac1n$，再取收敛子列，极限点处 $f=M$。

### 注记
“闭”与“区间有界”都不能少：$x$ 在 $(0,1)$ 上取不到最大值，$x$ 在 $[0,+\infty)$ 上无界。本质是“紧集的连续像是紧集”，见 [[compactness]]。

## 一致连续 {#uniform-continuity}
type: 定义 | en: Uniform continuity | w: 4 | 考纲: 单变量微积分, 实数轴的连续性
前置: continuity, quantifiers
后续: cantor-uniform, riemann-integral
alias: 一致连续性

$f$ 在 $I$ 上一致连续：对任意 $\eps>0$，存在 $\delta>0$，使得对 $I$ 中**任意**两点，只要 $\abs{x-y}<\delta$ 就有 $\abs{f(x)-f(y)}<\eps$。与连续的区别在于 $\delta$ 只依赖 $\eps$，不依赖点的位置。

### 例题
$f(x)=\frac1x$ 在 $(0,1)$ 上连续但不一致连续：取 $x_n=\frac1n$，$y_n=\frac1{n+1}$，$\abs{x_n-y_n}\to0$，但 $\abs{f(x_n)-f(y_n)}=1$。
$f(x)=\sqrt x$ 在 $[0,+\infty)$ 上一致连续：$\abs{\sqrt x-\sqrt y}\le\sqrt{\abs{x-y}}$，取 $\delta=\eps^2$。

### 注记
导数有界的函数（利普希茨函数）一致连续：$\abs{f(x)-f(y)}\le L\abs{x-y}$。$x^2$ 在 $\R$ 上不一致连续——越往外越陡。

## 康托尔定理 {#cantor-uniform}
type: 定理 | en: Heine–Cantor theorem | w: 3 | 考纲: 单变量微积分, 实数轴的紧致性
前置: uniform-continuity, bolzano-weierstrass
应用于: integrability
alias: 一致连续性定理, Heine–Cantor

闭区间上的连续函数一定一致连续。这是“连续函数可积”的关键一步。

### 证明
反设不一致连续，则存在 $\eps_0$ 及 $x_n,y_n$ 满足 $\abs{x_n-y_n}<\frac1n$ 但 $\abs{f(x_n)-f(y_n)}\ge\eps_0$。由 [[bolzano-weierstrass]] 取子列 $x_{n_k}\to\xi$，则 $y_{n_k}\to\xi$。由连续性 $f(x_{n_k})-f(y_{n_k})\to0$，矛盾。

### 注记
一般地，紧度量空间上的连续函数一致连续；也可以用 [[heine-borel|有限覆盖定理]] 证明。
