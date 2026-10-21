---
galaxy: analysis
cluster: limits
title: 数列极限
en: Limits of sequences
order: 1
level: core
---

## 数列极限 {#sequence-limit}
type: 定义 | en: Limit of a sequence | w: 5 | 考纲: 单变量微积分
前置: sequence, real-number-system
后续: function-limit, series
alias: 收敛数列, ε-N 定义, 极限
tags: 极限, ε-N
anim: epsilon-n

数列 $a_n$ 收敛到 $a$，意思是：无论要求多高的精度 $\eps$，从某一项起所有的项都落在 $a$ 的 $\eps$ 邻域里。这个 $\eps$–$N$ 定义把“无限接近”变成了可以检验的有限陈述。

> [!定义] 数列极限
> $\displaystyle\lim_{n\to\infty}a_n=a$ 指：对任意 $\eps>0$，存在正整数 $N$，使得当 $n>N$ 时 $\abs{a_n-a}<\eps$。

不收敛的数列称为发散的；$a_n\to+\infty$ 指对任意 $M$，存在 $N$ 使 $n>N$ 时 $a_n>M$，它仍属于发散。

### 直观
定义是一场“挑战—应战”游戏：对手任给一条宽 $2\eps$ 的带子，你必须找到一个位置 $N$，此后数列再也不跑出带子。$\eps$ 越小，$N$ 一般越大；只要每个 $\eps$ 都能应战成功，极限就是 $a$。

### 例题
证明 $\displaystyle\lim_{n\to\infty}\frac{n}{n+1}=1$。

**证**：$\abs{\frac{n}{n+1}-1}=\frac1{n+1}<\frac1n$。任给 $\eps>0$，取 $N=\lceil 1/\eps\rceil$，则 $n>N$ 时 $\frac1n<\eps$。证毕。写证明时不必找最小的 $N$，任何一个够用的 $N$ 都行，这就是“放大”技巧的用处。

### 注记
- 改变数列的有限项不影响收敛性与极限值。
- 否定形式：$a_n\not\to a$ 当且仅当存在 $\eps_0>0$，对任意 $N$ 都有 $n>N$ 使 $\abs{a_n-a}\ge\eps_0$。写反证法时要用到。

## 收敛数列的性质 {#limit-properties}
type: 性质 | en: Properties of convergent sequences | w: 3 | 考纲: 单变量微积分
前置: sequence-limit
alias: 唯一性, 有界性, 保号性, 保不等式

收敛数列的极限唯一；收敛数列有界；若 $a_n\to a>0$，则从某项起 $a_n>0$（保号性）；若从某项起 $a_n\le b_n$，则 $\lim a_n\le\lim b_n$（保不等式）。

### 证明
- **唯一性**：若 $a_n\to a$ 且 $a_n\to b$，$a\ne b$，取 $\eps=\frac{\abs{a-b}}2$，充分大的 $n$ 同时满足 $\abs{a_n-a}<\eps$ 与 $\abs{a_n-b}<\eps$，相加得 $\abs{a-b}<2\eps=\abs{a-b}$，矛盾。
- **有界性**：取 $\eps=1$，$n>N$ 时 $\abs{a_n}<\abs a+1$，再与前 $N$ 项的绝对值取最大。
- **保号性**：取 $\eps=\frac a2$，$n>N$ 时 $a_n>a-\frac a2=\frac a2>0$。

### 注记
保不等式只保“$\le$”：$a_n=0<b_n=\frac1n$，两者极限都是 $0$。严格不等式取极限会变成非严格不等式。

## 极限的四则运算 {#limit-arithmetic}
type: 定理 | en: Algebra of limits | w: 3 | 考纲: 单变量微积分
前置: limit-properties

若 $a_n\to a$，$b_n\to b$，则 $a_n\pm b_n\to a\pm b$，$a_nb_n\to ab$；当 $b\ne0$ 时 $\dfrac{a_n}{b_n}\to\dfrac ab$。

### 证明
只证乘积。由收敛数列有界，设 $\abs{a_n}\le M$。则
$$\abs{a_nb_n-ab}\le\abs{a_n}\abs{b_n-b}+\abs b\abs{a_n-a}\le M\abs{b_n-b}+\abs b\abs{a_n-a},$$
右边两项都可以任意小。商的情形先用保号性说明从某项起 $\abs{b_n}>\frac{\abs b}2$。

### 注记
法则只对“两个都收敛”成立。$\infty-\infty$、$\frac00$、$0\cdot\infty$ 等未定式需要另想办法，例如 [[squeeze-theorem]]、[[stolz-theorem]] 或 [[lhopital]]。

## 夹逼定理 {#squeeze-theorem}
type: 定理 | en: Squeeze theorem | w: 4 | 考纲: 单变量微积分
前置: limit-properties
alias: 夹挤定理, 两边夹, 迫敛性
应用于: important-limits

若从某项起 $a_n\le c_n\le b_n$，且 $a_n$ 与 $b_n$ 收敛到同一个极限 $L$，则 $c_n$ 也收敛到 $L$。

### 证明
任给 $\eps>0$，存在 $N$ 使 $n>N$ 时 $L-\eps<a_n$ 且 $b_n<L+\eps$，于是 $L-\eps<a_n\le c_n\le b_n<L+\eps$。

### 例题
求 $\displaystyle\lim_{n\to\infty}\sqrt[n]{n}$。

**解**：设 $\sqrt[n]n=1+h_n$，$h_n\ge0$。由二项式展开，$n=(1+h_n)^n\ge\binom n2h_n^2=\frac{n(n-1)}2h_n^2$，于是 $0\le h_n\le\sqrt{\frac2{n-1}}$（$n\ge2$）。由夹逼，$h_n\to0$，所以 $\sqrt[n]n\to1$。

## 单调有界定理 {#monotone-convergence}
type: 定理 | en: Monotone convergence theorem | w: 5 | 考纲: 单变量微积分, 实数轴的完备性
前置: sequence-limit
源于: supremum
推出: number-e
alias: 单调收敛定理, 单调有界必收敛

单调递增且有上界的数列必定收敛，极限就是它的上确界；单调递减有下界的数列同理。不需要事先知道极限是多少就能断定收敛——这是完备性最常用的形态。

### 证明
设 $a_n$ 单调递增、有上界，令 $a=\sup_n a_n$（由 [[supremum]]）。任给 $\eps>0$，由确界定义存在 $N$ 使 $a_N>a-\eps$；单调性给出 $n>N$ 时 $a-\eps<a_N\le a_n\le a$。

### 例题
设 $a_1=\sqrt2$，$a_{n+1}=\sqrt{2+a_n}$。证明 $a_n$ 收敛并求极限。

**解**：归纳可证 $a_n<2$：$a_1<2$，若 $a_n<2$ 则 $a_{n+1}<\sqrt4=2$。又 $a_{n+1}^2-a_n^2=2+a_n-a_n^2=(2-a_n)(1+a_n)>0$，故递增。由单调有界定理 $a_n\to a$，在递推式两边取极限得 $a=\sqrt{2+a}$，$a=2$。

### 注记
先证收敛、再对递推式取极限，顺序不能颠倒：$a_{n+1}=2a_n$ 的“极限方程” $a=2a$ 有解 $0$，但 $a_1=1$ 时数列发散。

## 自然常数 e {#number-e}
type: 定理 | en: Euler's number e | w: 4 | 考纲: 单变量微积分
前置: monotone-convergence, binomial-theorem
alias: e, 欧拉数, 自然对数的底
应用于: exponential-function, important-limits

数列 $\left(1+\frac1n\right)^n$ 单调递增且有上界，它的极限记为 $\ee\approx2.718281828$。它是“连续复利”的极限，也是指数函数 $\ee^x$ 的底：$(\ee^x)'=\ee^x$。

> [!定理] 定义与级数表示
> $$\ee=\lim_{n\to\infty}\left(1+\frac1n\right)^n=\sum_{k=0}^{\infty}\frac1{k!}.$$

### 证明
令 $x_n=\left(1+\frac1n\right)^n$。由二项式定理
$$x_n=\sum_{k=0}^n\frac{1}{k!}\prod_{j=1}^{k-1}\left(1-\frac jn\right).$$
$n$ 增大时每一项都变大，项数也增多，所以 $x_n$ 递增；又 $x_n\le\sum_{k=0}^n\frac1{k!}\le1+1+\frac12+\frac14+\cdots<3$，有上界。由 [[monotone-convergence]]，$x_n$ 收敛。固定 $m$，对 $n>m$ 只保留前 $m+1$ 项再令 $n\to\infty$，得 $\lim x_n\ge\sum_{k=0}^m\frac1{k!}$；结合 $x_n\le\sum_{k=0}^n\frac1{k!}$ 即得级数表示。

### 注记
$\ee$ 是无理数：若 $\ee=\frac pq$，则 $q!\,\ee$ 是整数，而 $q!\sum_{k=0}^q\frac1{k!}$ 也是整数，二者之差 $\sum_{k>q}\frac{q!}{k!}$ 介于 $0$ 与 $\frac1q$ 之间，不可能是整数。

## 柯西收敛准则 {#cauchy-criterion}
type: 定理 | en: Cauchy criterion | w: 5 | 考纲: 单变量微积分, 实数轴的完备性
前置: sequence-limit, bolzano-weierstrass
alias: 柯西列, 基本列, Cauchy 准则
应用于: series, uniform-convergence
推广为: metric-space

数列收敛当且仅当它的项彼此任意接近：对任意 $\eps>0$，存在 $N$，使 $m,n>N$ 时 $\abs{a_m-a_n}<\eps$。这样的数列叫柯西列。判断收敛时完全不需要知道极限是什么。

### 证明
必要性：$\abs{a_m-a_n}\le\abs{a_m-a}+\abs{a-a_n}$。
充分性：柯西列有界（取 $\eps=1$）。由 [[bolzano-weierstrass]] 它有收敛子列 $a_{n_k}\to a$。任给 $\eps$，取 $N$ 使 $m,n>N$ 时 $\abs{a_m-a_n}<\frac\eps2$，再取 $n_k>N$ 使 $\abs{a_{n_k}-a}<\frac\eps2$，则 $n>N$ 时 $\abs{a_n-a}\le\abs{a_n-a_{n_k}}+\abs{a_{n_k}-a}<\eps$。

### 例题
$a_n=\sum_{k=1}^n\frac1k$ 不是柯西列：$a_{2n}-a_n=\sum_{k=n+1}^{2n}\frac1k\ge n\cdot\frac1{2n}=\frac12$。所以调和级数发散（见 [[harmonic-series]]）。

### 注记
“所有柯西列都收敛”就是度量空间的**完备性**。$\Q$ 不完备：$\sqrt2$ 的十进制截断是有理柯西列，却没有有理极限。

## 子列 {#subsequence}
type: 概念 | en: Subsequence | w: 2 | 考纲: 单变量微积分
前置: sequence-limit
后续: bolzano-weierstrass, limsup-liminf

从数列中按原顺序抽出无穷多项得到的数列 $a_{n_1},a_{n_2},\dots$（$n_1<n_2<\cdots$）。数列收敛于 $a$ 当且仅当它的每个子列都收敛于 $a$。

### 应用
证明发散最方便的办法是找两个收敛到不同极限的子列：$(-1)^n$ 的偶数项子列趋于 $1$，奇数项子列趋于 $-1$，所以 $(-1)^n$ 发散。同理，若 $a_{2n}\to a$ 且 $a_{2n+1}\to a$，则 $a_n\to a$。

## 上极限与下极限 {#limsup-liminf}
type: 定义 | en: Limit superior and inferior | w: 2 | 考纲: 单变量微积分
前置: subsequence, supremum
应用于: ratio-root-test, power-series
alias: limsup, liminf

有界数列不一定收敛，但它的“尾部上确界”$\sup_{k\ge n}a_k$ 单调递减，一定有极限，称为上极限 $\limsup a_n$；类似地有下极限。数列收敛当且仅当上下极限相等。

> [!定义] 上下极限
> $$\limsup_{n\to\infty}a_n=\lim_{n\to\infty}\sup_{k\ge n}a_k,\qquad \liminf_{n\to\infty}a_n=\lim_{n\to\infty}\inf_{k\ge n}a_k.$$
> 它们分别是所有收敛子列极限中的最大者与最小者。

### 例题
$a_n=(-1)^n\left(1+\frac1n\right)$：$\limsup a_n=1$，$\liminf a_n=-1$。

### 应用
根值判别法和幂级数收敛半径的柯西–阿达马公式 $\frac1R=\limsup\sqrt[n]{\abs{a_n}}$ 都用上极限表述，因为普通极限未必存在。

## 施托尔茨定理 {#stolz-theorem}
type: 定理 | en: Stolz–Cesàro theorem | w: 3 | 考纲: 单变量微积分
前置: limit-arithmetic
类比: lhopital
alias: Stolz 定理, 斯托尔茨–切萨罗定理

数列版本的洛必达法则：若 $b_n$ 严格递增趋于 $+\infty$，且 $\displaystyle\lim\frac{a_{n+1}-a_n}{b_{n+1}-b_n}=L$，则 $\displaystyle\lim\frac{a_n}{b_n}=L$。

### 证明思路
任给 $\eps$，从某个 $N$ 起差商落在 $(L-\eps,L+\eps)$ 内。把 $a_n-a_N=\sum_{k=N}^{n-1}(a_{k+1}-a_k)$ 夹在 $(L\pm\eps)(b_n-b_N)$ 之间，两边除以 $b_n$ 并令 $n\to\infty$，由于 $b_n\to\infty$，$a_N$ 与 $b_N$ 的影响消失。

### 例题
**切萨罗平均**：若 $a_n\to a$，则 $\frac{a_1+\cdots+a_n}n\to a$。取分子 $S_n=a_1+\cdots+a_n$、分母 $n$，差商为 $a_{n+1}\to a$。
又如 $\displaystyle\lim\frac{1^k+2^k+\cdots+n^k}{n^{k+1}}=\lim\frac{(n+1)^k}{(n+1)^{k+1}-n^{k+1}}=\frac1{k+1}$。
