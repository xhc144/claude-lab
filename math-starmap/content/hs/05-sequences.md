---
galaxy: hs
cluster: hs-sequences
title: 数列
en: Sequences
order: 5
level: hs
---

## 数列 {#sequence}
type: 概念 | en: Sequence | w: 4 | 考纲: 中学数学全部内容
前置: function
后续: arithmetic-sequence, geometric-sequence, sequence-limit
alias: 通项公式, 前n项和, 数列的函数观点

按顺序排成的一列数 $a_1,a_2,a_3,\dots$，可以看作定义在正整数集上的函数 $n\mapsto a_n$。通项公式给出 $a_n$ 与 $n$ 的关系，$S_n=a_1+\cdots+a_n$ 是前 $n$ 项和，且 $a_n=S_n-S_{n-1}$（$n\ge2$），$a_1=S_1$。

### 注记
函数观点让数列问题可以借助函数的单调性求最值，但要注意自变量只取正整数：$a_n=n^2-9n$ 的最小值在 $n=4$ 或 $5$ 取到，等于 $-20$，而对应二次函数在 $x=4.5$ 取最小。

## 等差数列 {#arithmetic-sequence}
type: 概念 | en: Arithmetic sequence | w: 4 | 考纲: 中学数学全部内容
前置: sequence
相关: geometric-sequence
alias: 公差, 等差中项, 高斯求和

从第二项起每一项与前一项的差为常数 $d$：$a_n=a_1+(n-1)d$，$S_n=\dfrac{n(a_1+a_n)}2=na_1+\dfrac{n(n-1)}2d$。

### 推导
倒序相加：把 $S_n$ 正着写一遍、倒着写一遍，对应项之和都等于 $a_1+a_n$，共 $n$ 对，所以 $2S_n=n(a_1+a_n)$。传说高斯十岁时就用这个方法算出了 $1+2+\cdots+100=5050$。

### 注记
- 若 $m+n=p+q$，则 $a_m+a_n=a_p+a_q$。
- $a_n$ 是 $n$ 的一次函数，$S_n$ 是不含常数项的二次函数；反过来，$S_n=An^2+Bn$ 时数列一定等差。

## 等比数列 {#geometric-sequence}
type: 概念 | en: Geometric sequence | w: 4 | 考纲: 中学数学全部内容
前置: sequence
后续: geometric-series
alias: 公比, 等比中项, 错位相减

从第二项起每一项与前一项的比为常数 $q\ne0$：$a_n=a_1q^{n-1}$，
$$S_n=\begin{cases}na_1, & q=1,\\[2pt] \dfrac{a_1(1-q^n)}{1-q}, & q\ne1.\end{cases}$$

### 推导
$S_n-qS_n=a_1-a_1q^n$（“错位相减”），$q\ne1$ 时除以 $1-q$。注意 $q=1$ 必须单独讨论。

### 应用
$\abs q<1$ 时 $S_n\to\frac{a_1}{1-q}$，这就是几何级数，见 [[geometric-series]]。分期付款、复利、放射性衰变都是等比数列模型。

## 数列求和的方法 {#sequence-summation}
type: 方法 | en: Summation techniques | w: 3 | 考纲: 中学数学全部内容
前置: arithmetic-sequence, geometric-sequence
alias: 裂项相消, 错位相减, 分组求和, 倒序相加

常用方法：公式法、分组求和、倒序相加、错位相减（等差 × 等比）、裂项相消（把通项写成差 $b_{n+1}-b_n$，求和时中间项全部抵消）。

### 例题
求 $\displaystyle\sum_{k=1}^n\frac1{k(k+1)}$ 与 $\displaystyle\sum_{k=1}^n k\cdot2^k$。

**解**：$\frac1{k(k+1)}=\frac1k-\frac1{k+1}$，和为 $1-\frac1{n+1}$。
设 $T=\sum_{k=1}^nk2^k$，则 $2T-T=n2^{n+1}-\sum_{k=1}^n2^k=n2^{n+1}-(2^{n+1}-2)$，所以 $T=(n-1)2^{n+1}+2$。

### 注记
裂项相消是“离散版的微积分基本定理”：$\sum_{k=1}^n(b_{k+1}-b_k)=b_{n+1}-b_1$，对应 $\int_a^bF'=F(b)-F(a)$。

## 递推数列 {#recurrence-sequence}
type: 方法 | en: Recursive sequences | w: 3 | 考纲: 中学数学全部内容
前置: sequence, geometric-sequence
推广为: recurrence-relation
alias: 递推公式, 构造等比数列, 不动点法, 累加法, 累乘法

由前一项（或前几项）确定后一项的数列。求通项的常用技巧：累加法 $a_{n+1}=a_n+f(n)$、累乘法 $a_{n+1}=f(n)a_n$、以及对 $a_{n+1}=pa_n+q$ 用不动点构造等比数列。

### 例题
$a_1=1$，$a_{n+1}=2a_n+1$，求 $a_n$。

**解**：不动点 $x=2x+1$ 得 $x=-1$。两边加 $1$：$a_{n+1}+1=2(a_n+1)$，所以 $\{a_n+1\}$ 是首项 $2$、公比 $2$ 的等比数列，$a_n=2^n-1$。这正是汉诺塔移动 $n$ 个盘子的最少步数。

### 注记
二阶线性递推 $a_{n+2}=pa_{n+1}+qa_n$ 用特征方程 $x^2=px+q$ 求解，斐波那契数列是典型，见 [[recurrence-relation]] 与 [[fibonacci]]。

## 数学归纳法 {#math-induction}
type: 方法 | en: Mathematical induction | w: 4 | 考纲: 中学数学全部内容
前置: sequence
应用于: binomial-theorem
alias: 归纳法, 第二数学归纳法, 强归纳

要证命题 $P(n)$ 对一切 $n\ge n_0$ 成立：(1) 证 $P(n_0)$；(2) 假设 $P(k)$ 成立，证 $P(k+1)$。像推倒一排多米诺骨牌：第一块倒下，且每一块倒下都会推倒下一块。

### 例题
证明 $1^3+2^3+\cdots+n^3=\left(\frac{n(n+1)}2\right)^2$。

**证**：$n=1$ 时两边都是 $1$。设 $n=k$ 时成立，则
$$\sum_{i=1}^{k+1}i^3=\frac{k^2(k+1)^2}4+(k+1)^3=\frac{(k+1)^2(k^2+4k+4)}4=\left(\frac{(k+1)(k+2)}2\right)^2.$$

### 注记
- 第二数学归纳法（强归纳）：假设 $P(n_0),\dots,P(k)$ 都成立来证 $P(k+1)$，例如证明每个大于 $1$ 的整数都能分解为素数之积。
- 归纳法的依据是正整数集的良序性：每个非空正整数子集都有最小元。
- 常见错误：“所有马同色”的伪证明在 $n=1\to2$ 这一步失效。
