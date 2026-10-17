---
galaxy: analysis
cluster: series
title: 数项级数
en: Infinite series
order: 6
level: core
---

## 数项级数 {#series}
type: 定义 | en: Infinite series | w: 5 | 考纲: 单变量微积分
前置: sequence-limit
源于: cauchy-criterion
后续: comparison-test, alternating-series, absolute-convergence, power-series
alias: 无穷级数, 部分和, 级数收敛
anim: series-sums
tags: 级数

无穷多个数相加 $\sum_{n=1}^\infty a_n$ 的意义由部分和 $S_n=a_1+\cdots+a_n$ 的极限确定：$S_n\to S$ 时称级数收敛，和为 $S$。

### 注记
- 收敛的必要条件：$a_n\to0$。但不充分：调和级数 $\sum\frac1n$ 的项趋于零却发散。
- 柯西准则：$\sum a_n$ 收敛 $\iff$ 任意 $\eps>0$，存在 $N$，$n>m>N$ 时 $\abs{a_{m+1}+\cdots+a_n}<\eps$。
- 芝诺悖论“阿基里斯追不上乌龟”的消解正是 $\frac12+\frac14+\frac18+\cdots=1$：无穷多段时间之和可以有限。

## 几何级数 {#geometric-series}
type: 例子 | en: Geometric series | w: 4 | 考纲: 单变量微积分
前置: geometric-sequence, series
应用于: power-series, comparison-test
alias: 等比级数

$$\sum_{n=0}^\infty q^n=\frac1{1-q}\quad(\abs q<1),$$
$\abs q\ge1$ 时发散。它是比较判别法的标尺、幂级数的原型、也是诺依曼级数 $(I-A)^{-1}=\sum A^n$ 的模板。

### 例题
循环小数 $0.\dot9=\frac9{10}\cdot\frac1{1-\frac1{10}}=1$；$0.\dot1\dot2=\frac{12}{99}=\frac4{33}$。

## 调和级数 {#harmonic-series}
type: 例子 | en: Harmonic series | w: 4 | 考纲: 单变量微积分
前置: series
相关: integral-test
alias: 调和级数发散, 欧拉常数, γ

$\sum_{n=1}^\infty\frac1n$ 发散，部分和以对数速度增长：$H_n=\ln n+\gamma+o(1)$，其中 $\gamma\approx0.5772$ 是欧拉–马斯刻罗尼常数。

### 证明
（奥雷姆，14 世纪）分组：$1+\frac12+\left(\frac13+\frac14\right)+\left(\frac15+\cdots+\frac18\right)+\cdots$，每组都 $\ge\frac12$，所以 $H_{2^k}\ge1+\frac k2\to\infty$。

### 例题
**叠书问题**：把 $n$ 本相同的书叠在桌边，最上面一本最多能伸出桌外 $\frac12H_n$ 个书长。由于 $H_n\to\infty$，只要书够多，可以伸出任意远——但伸出 $3$ 个书长就要 $227$ 本书。

## 比较判别法 {#comparison-test}
type: 判别法 | en: Comparison test | w: 4 | 考纲: 单变量微积分
前置: series, monotone-convergence
后续: ratio-root-test, integral-test
alias: 比较原则, 极限形式的比较判别法, 正项级数

正项级数的部分和单调递增，收敛 $\iff$ 部分和有界。若 $0\le a_n\le b_n$：$\sum b_n$ 收敛 $\Rightarrow\sum a_n$ 收敛；$\sum a_n$ 发散 $\Rightarrow\sum b_n$ 发散。极限形式：若 $\frac{a_n}{b_n}\to l\in(0,+\infty)$，则二者同敛散。

### 例题
$\sum\frac1{n^2+n}$：$\frac1{n^2+n}<\frac1{n^2}$，而 $\sum\frac1{n^2}$ 收敛（[[integral-test|p 级数]]）。$\sum\sin\frac1n$：与 $\frac1n$ 之比趋于 $1$，所以发散。

## 比值与根值判别法 {#ratio-root-test}
type: 判别法 | en: Ratio and root tests | w: 4 | 考纲: 单变量微积分
前置: comparison-test, limsup-liminf
源于: geometric-series
alias: 达朗贝尔判别法, 柯西判别法, 比值法, 根值法

对正项级数：
- 比值法：$\lim\frac{a_{n+1}}{a_n}=\rho$；
- 根值法：$\limsup\sqrt[n]{a_n}=\rho$。

$\rho<1$ 收敛，$\rho>1$ 发散，$\rho=1$ 无法判断。

### 证明
根值法：若 $\rho<1$，取 $q\in(\rho,1)$，从某项起 $a_n<q^n$，与几何级数比较。若 $\rho>1$，有无穷多项 $a_n>1$，项不趋于零。

### 注记
$\rho=1$ 时两种方法都失效：$\sum\frac1n$ 与 $\sum\frac1{n^2}$ 的 $\rho$ 都是 $1$，敛散性却相反。根值法比比值法更强：比值法能判断的，根值法都能判断。

## 积分判别法与 p 级数 {#integral-test}
type: 判别法 | en: Integral test and p-series | w: 3 | 考纲: 单变量微积分
前置: comparison-test, improper-integral
alias: p 级数, 柯西积分判别法

若 $f$ 在 $[1,+\infty)$ 上非负递减，则 $\sum f(n)$ 与 $\int_1^\infty f(x)\,\dd x$ 同敛散。由此，p 级数 $\sum\frac1{n^p}$ 当 $p>1$ 时收敛、$p\le1$ 时发散。

### 证明
$f$ 递减，所以 $f(k+1)\le\int_k^{k+1}f\le f(k)$。求和得 $\sum_{k=2}^{n}f(k)\le\int_1^nf\le\sum_{k=1}^{n-1}f(k)$。

### 例题
$\sum\frac1{n\ln n}$ 发散（$\int\frac{\dd x}{x\ln x}=\ln\ln x$），而 $\sum\frac1{n(\ln n)^2}$ 收敛。发散得极慢：部分和超过 $10$ 要 $n$ 大约 $\ee^{\ee^{10}}$。

## 交错级数 {#alternating-series}
type: 判别法 | en: Alternating series test | w: 3 | 考纲: 单变量微积分
前置: series, monotone-convergence
后续: absolute-convergence
alias: 莱布尼茨判别法, 交错级数

若 $u_n$ 单调递减趋于 $0$，则 $\sum(-1)^{n-1}u_n$ 收敛，且余项 $\abs{S-S_n}\le u_{n+1}$。

### 证明
偶数项部分和 $S_{2n}=(u_1-u_2)+\cdots+(u_{2n-1}-u_{2n})$ 递增，又 $S_{2n}=u_1-(u_2-u_3)-\cdots-u_{2n}\le u_1$，有界，所以收敛到某个 $S$；$S_{2n+1}=S_{2n}+u_{2n+1}\to S$。

### 例题
$1-\frac12+\frac13-\frac14+\cdots=\ln2$；$1-\frac13+\frac15-\cdots=\frac\pi4$。这两个级数都条件收敛。

## 绝对收敛与条件收敛 {#absolute-convergence}
type: 定义 | en: Absolute and conditional convergence | w: 4 | 考纲: 单变量微积分
前置: alternating-series, comparison-test
后续: riemann-rearrangement
alias: 绝对收敛, 条件收敛

若 $\sum\abs{a_n}$ 收敛，称 $\sum a_n$ 绝对收敛（绝对收敛必收敛）；若 $\sum a_n$ 收敛而 $\sum\abs{a_n}$ 发散，称条件收敛。

### 证明
$\abs{a_{m+1}+\cdots+a_n}\le\abs{a_{m+1}}+\cdots+\abs{a_n}$，由柯西准则。

### 注记
绝对收敛的级数像有限和一样“好用”：可以任意重排、可以与另一个绝对收敛级数做柯西乘积。条件收敛的级数则非常脆弱，见 [[riemann-rearrangement]]。

## 黎曼重排定理 {#riemann-rearrangement}
type: 定理 | en: Riemann rearrangement theorem | w: 3 | 考纲: 单变量微积分
前置: absolute-convergence
alias: 重排定理, 级数重排

条件收敛的级数，适当重排各项的顺序，可以收敛到任意指定的实数，也可以发散到 $\pm\infty$。

### 证明思路
条件收敛时，正项之和与负项之和都发散到无穷，而每一项趋于零。要得到和 $L$：先取正项直到部分和刚超过 $L$，再取负项直到刚低于 $L$，如此交替。每次越过 $L$ 的偏差不超过最后加上的那一项，而它趋于零。

### 例题
$1-\frac12+\frac13-\cdots=\ln2$，重排为“一正两负”：$1-\frac12-\frac14+\frac13-\frac16-\frac18+\cdots$，每组 $\frac1{2k-1}-\frac1{4k-2}-\frac1{4k}=\frac12\left(\frac1{2k-1}-\frac1{2k}\right)$，和变成 $\frac12\ln2$。

## 阿贝尔与狄利克雷判别法 {#abel-dirichlet-test}
type: 判别法 | en: Abel and Dirichlet tests | w: 2 | 考纲: 单变量微积分
前置: absolute-convergence
alias: 阿贝尔变换, 分部求和, 狄利克雷判别法

对 $\sum a_nb_n$：
- 狄利克雷：$\sum a_n$ 的部分和有界，$b_n$ 单调趋于 $0$；
- 阿贝尔：$\sum a_n$ 收敛，$b_n$ 单调有界；

满足其一则 $\sum a_nb_n$ 收敛。工具是阿贝尔分部求和公式 $\sum_{k=1}^na_kb_k=A_nb_n-\sum_{k=1}^{n-1}A_k(b_{k+1}-b_k)$，它是分部积分的离散版本。

### 例题
$\sum\frac{\sin nx}n$ 对每个 $x$ 收敛：$x\notin2\pi\Z$ 时 $\abs{\sum_{k=1}^n\sin kx}\le\frac1{\abs{\sin(x/2)}}$ 有界，$\frac1n$ 单调趋于零。它是锯齿波的傅里叶级数。

## 巴塞尔问题 {#basel-problem}
type: 问题 | en: Basel problem | w: 3 | 考纲: 傅立叶级数, 单变量微积分
前置: integral-test
源于: parseval-identity
alias: ζ(2), 1+1/4+1/9+..., 黎曼 ζ 函数

$$\sum_{n=1}^\infty\frac1{n^2}=\frac{\pi^2}6.$$
1734 年欧拉解决了这个困扰数学家近百年的问题。

### 证明
（傅里叶级数）在 $(-\pi,\pi)$ 上 $x=2\sum_{n\ge1}\frac{(-1)^{n+1}}n\sin nx$。由 [[parseval-identity]]：
$$\frac1\pi\int_{-\pi}^\pi x^2\dd x=\sum_{n\ge1}\frac4{n^2}\quad\Longrightarrow\quad\frac{2\pi^2}3=4\sum\frac1{n^2}.$$

### 注记
欧拉的原始论证把 $\frac{\sin x}x=\prod\left(1-\frac{x^2}{n^2\pi^2}\right)$ 当作“无穷次多项式”，比较 $x^2$ 系数。$\zeta(s)=\sum n^{-s}$ 在偶数处都有 $\pi$ 的幂表达，奇数处（如 $\zeta(3)$）至今没有封闭形式。
