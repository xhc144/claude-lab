---
galaxy: analysis
cluster: real-numbers
title: 实数与确界
en: Real numbers
order: 0
level: core
---

## 实数系与完备性公理 {#real-number-system}
type: 公理 | en: The real number system | w: 5 | 考纲: 单变量微积分, 实数轴的完备性
前置: set, irrational-sqrt2
alias: 实数, 实数公理, 完备有序域
tags: 实数, 完备性

实数集 $\R$ 是一个**完备的有序域**：可以做四则运算、可以比较大小，并且“没有空隙”——每个有上界的非空子集都有最小上界。分析学的一切极限定理都建立在这条完备性公理上。

> [!定义] 实数系
> $\R$ 是满足以下三组公理的集合：
> 1. **域公理**：加法、乘法满足交换律、结合律、分配律，有 $0$ 与 $1$，每个数有相反数，非零数有倒数；
> 2. **序公理**：全序 $<$ 与运算相容：$a<b \Rightarrow a+c<b+c$；$a<b,\ c>0 \Rightarrow ac<bc$；
> 3. **完备性公理**（确界原理）：$\R$ 的每个有上界的非空子集都有上确界。

有理数集 $\Q$ 满足前两组公理，却不满足第三条：$\{x\in\Q : x^2<2\}$ 在 $\Q$ 中有上界但没有最小上界，因为 $\sqrt2\notin\Q$。完备性正是把这些“空隙”补上。

### 直观
把有理数想成数轴上密密麻麻的点：任意两点之间都还有无穷多个有理数，但 $\sqrt2$、$\pi$ 这样的位置仍是空的。实数是把所有空隙填满后的数轴，所以“单调有界的数列一定收敛”“连续函数在区间两端异号时一定穿过零”这类直觉才成为定理。

### 注记
完备性有许多等价表述：[[supremum]]、[[monotone-convergence]]、[[nested-intervals]]、[[cauchy-criterion]]、[[bolzano-weierstrass]]、[[heine-borel]]。在满足域与序公理的前提下，它们两两等价。实数可以由有理数构造出来（[[dedekind-cut]] 或柯西列的等价类），构造出的对象满足上述全部公理，并且在同构意义下唯一。

## 确界原理 {#supremum}
type: 定理 | en: Least-upper-bound property | w: 5 | 考纲: 实数轴的完备性, 单变量微积分
前置: real-number-system
推出: monotone-convergence, nested-intervals
alias: 上确界, 下确界, sup, inf, 最小上界
tags: 完备性, 确界

非空有上界的实数集一定有最小的上界，称为上确界 $\sup A$；对称地，非空有下界的集合有下确界 $\inf A$。

> [!定义] 上确界
> 数 $M$ 称为集合 $A$ 的上确界，若
> 1. $M$ 是上界：对一切 $x\in A$，$x\le M$；
> 2. 没有更小的上界：对任意 $\eps>0$，存在 $x\in A$ 使 $x>M-\eps$。

第二条是使用确界时最常用的形式：上确界可以被集合中的元素“任意逼近”。

### 例题
求 $A=\left\{1-\dfrac1n : n\in\N^*\right\}$ 的上、下确界。

**解**：$\inf A = \min A = 0$（$n=1$ 时取到）。对一切 $n$，$1-\frac1n<1$，所以 $1$ 是上界；任给 $\eps>0$，取 $n>\frac1\eps$，则 $1-\frac1n>1-\eps$，所以 $\sup A=1$。注意 $1\notin A$：上确界不一定属于集合，属于时它就是最大值。

### 注记
在 $\Q$ 中确界原理不成立。作为公理接受它之后，[[archimedean]]、[[monotone-convergence]]、[[nested-intervals]] 都可以由它推出。

## 阿基米德性质 {#archimedean}
type: 性质 | en: Archimedean property | w: 3 | 考纲: 单变量微积分, 实数轴的完备性
前置: supremum
推出: density-rationals

对任意正数 $a$ 与任意实数 $b$，存在正整数 $n$ 使 $na>b$。换言之，自然数集在 $\R$ 中没有上界，$\frac1n\to0$。

### 证明
反设对一切 $n$ 有 $na\le b$，则集合 $\{na : n\in\N^*\}$ 有上界，由 [[supremum]] 有上确界 $M$。由于 $M-a<M$，存在 $n$ 使 $na>M-a$，于是 $(n+1)a>M$，与 $M$ 是上界矛盾。

### 应用
“取 $N>\frac1\eps$”这一步在极限证明中随处可见，依据就是阿基米德性质。

## 有理数的稠密性 {#density-rationals}
type: 定理 | en: Density of the rationals | w: 2 | 考纲: 实数轴的完备性
前置: archimedean
相关: irrational-sqrt2

任意两个不同实数之间都有有理数（也都有无理数）。所以每个实数都是一列有理数的极限。

### 证明
设 $a<b$。由 [[archimedean]] 取 $n$ 使 $n(b-a)>1$；再取整数 $m$ 为大于 $na$ 的最小整数，则 $na<m\le na+1<nb$，于是 $a<\frac mn<b$。对 $a-\sqrt2<b-\sqrt2$ 用同样方法得有理数 $q$，则 $q+\sqrt2$ 是 $a,b$ 之间的无理数。

## 闭区间套定理 {#nested-intervals}
type: 定理 | en: Nested interval theorem | w: 4 | 考纲: 实数轴的完备性
前置: supremum
推出: uncountable-reals, bolzano-weierstrass
等价: cauchy-criterion

一列一个套一个、长度趋于零的闭区间，恰好有一个公共点。二分法求根、致密性定理与实数不可数的证明都靠它。

> [!定理] 区间套
> 若 $[a_n,b_n]\supseteq[a_{n+1},b_{n+1}]$ 对一切 $n$ 成立，且 $b_n-a_n\to0$，则存在唯一的 $\xi$ 属于所有 $[a_n,b_n]$，并且 $a_n\to\xi$，$b_n\to\xi$。

### 证明
$\{a_n\}$ 单调不减且以 $b_1$ 为上界，令 $\xi=\sup_n a_n$。对任意 $m,n$，$a_n\le a_{\max(m,n)}\le b_{\max(m,n)}\le b_m$，所以每个 $b_m$ 都是 $\{a_n\}$ 的上界，$\xi\le b_m$。于是 $a_n\le\xi\le b_n$ 对一切 $n$ 成立。若另有 $\eta$ 也在所有区间中，则 $|\xi-\eta|\le b_n-a_n\to0$，故 $\xi=\eta$。

### 注记
“闭”不能去掉：$\left(0,\frac1n\right)$ 是一列开区间套，但没有公共点。在 $\Q$ 中区间套定理也不成立（逼近 $\sqrt2$ 的有理区间套没有有理公共点）。

## 可数集与不可数集 {#countable-sets}
type: 概念 | en: Countable sets | w: 3
前置: set
例子: uncountable-reals
alias: 可数, 势, 基数

能与正整数集一一对应的无穷集称为可数集。$\Z$、$\Q$ 都是可数的，而 $\R$ 不可数：无穷也有大小之分。

> [!定义] 可数
> 集合 $A$ 称为可数的，若存在双射 $\N^*\to A$；有限或可数的集合称为至多可数。

### 例题
**$\Q$ 是可数集。** 把正有理数 $\frac pq$ 按 $p+q=2,3,4,\dots$ 分组，每组只有有限个，依次排列并跳过已出现的值（如 $\frac24=\frac12$），就把正有理数排成一列；再穿插 $0$ 与负数即得 $\Q$ 的一个排列。

### 注记
可数个可数集的并仍可数；可数集的任何子集至多可数。这些事实常用于证明“几乎所有”实数具有某种性质，例如超越数存在：代数数可数，而 $\R$ 不可数。

## 实数不可数 {#uncountable-reals}
type: 定理 | en: Uncountability of the reals | w: 3 | 考纲: 实数轴的完备性
前置: countable-sets, nested-intervals
alias: 康托尔对角线法, 对角线论证
相关: cantor-set

区间 $[0,1]$ 中的实数无法排成一列：任何一列实数都漏掉某个实数。这是康托尔在 1874 年用区间套、1891 年用对角线法证明的。

### 证明
（区间套法）设 $x_1,x_2,\dots$ 是 $[0,1]$ 中任意一列数。把 $[0,1]$ 三等分，选一个不含 $x_1$ 的闭三分之一区间 $I_1$；再把 $I_1$ 三等分，选不含 $x_2$ 的闭子区间 $I_2$；如此继续。由 [[nested-intervals]]，所有 $I_n$ 有公共点 $\xi$。对每个 $n$，$\xi\in I_n$ 而 $x_n\notin I_n$，所以 $\xi\ne x_n$。于是这列数漏掉了 $\xi$。

### 注记
对角线法：若 $[0,1)$ 中实数可排成 $x_n=0.d_{n1}d_{n2}d_{n3}\cdots$，构造 $y=0.e_1e_2\cdots$，其中 $e_n=5$（若 $d_{nn}\ne5$）或 $4$（若 $d_{nn}=5$），则 $y$ 与每个 $x_n$ 在第 $n$ 位不同。选 $4,5$ 是为了避开 $0.0999\cdots=0.1$ 这类双重小数表示。

## 戴德金分割 {#dedekind-cut}
type: 定义 | en: Dedekind cut | w: 2 | level: ext
推出: real-number-system
前置: set

用有理数“切开”数轴来定义实数：把 $\Q$ 分成左右两部分，左集没有最大元，每个这样的分割就是一个实数。由此可以从有理数严格构造出满足完备性的实数系。

> [!定义] 分割
> $\Q$ 的子集 $\alpha$ 称为一个分割，若 $\alpha\ne\varnothing$，$\alpha\ne\Q$；当 $p\in\alpha$、$q<p$ 时 $q\in\alpha$；并且 $\alpha$ 没有最大元。

例如 $\sqrt2$ 就是分割 $\{q\in\Q : q<0 \text{ 或 } q^2<2\}$。定义 $\alpha\le\beta \iff \alpha\subseteq\beta$，则任一有上界的分割族的并仍是分割并且就是它的上确界——完备性在构造中自动成立。加法定义为 $\alpha+\beta=\{p+q : p\in\alpha,\ q\in\beta\}$，乘法需分正负情形定义。
