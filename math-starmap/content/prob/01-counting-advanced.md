---
galaxy: prob
cluster: counting-advanced
title: 抽屉、容斥与递推
en: Pigeonhole, inclusion–exclusion and recurrences
order: 1
level: core
---

## 抽屉原理 {#pigeonhole}
type: 原理 | en: Pigeonhole principle | w: 5 | 考纲: 抽屉原理
后续: ramsey-theory, pigeonhole-geometry, erdos-szekeres
alias: 鸽巢原理, 狄利克雷原理, 抽屉原则
tags: 组合

把 $n+1$ 个物品放进 $n$ 个抽屉，至少有一个抽屉放了两个或更多物品。一般形式：把 $m$ 个物品放进 $n$ 个抽屉，必有一个抽屉至少有 $\left\lceil\frac mn\right\rceil$ 个。

### 例题
- 任意 $13$ 个人中必有两人生肖相同。
- 从 $1,2,\dots,2n$ 中任取 $n+1$ 个数，必有两个数互素（相邻的两个数互素，构造抽屉 $\{1,2\},\{3,4\},\dots,\{2n-1,2n\}$）；也必有一个数整除另一个（把每个数写成 $2^k\cdot m$，$m$ 为奇数，按奇数部分 $m$ 分为 $n$ 个抽屉）。
- 任意 $n$ 个整数中，必有若干个（至少一个）之和被 $n$ 整除：考虑前缀和 $S_0=0,S_1,\dots,S_n$ 模 $n$ 的余数，$n+1$ 个前缀和只有 $n$ 种余数，两个相同，其差是一段连续项之和。

### 注记
抽屉原理只断言存在，不告诉你是哪一个——它是非构造性证明的典型。难点在于构造抽屉。

## 容斥原理 {#inclusion-exclusion}
type: 原理 | en: Inclusion–exclusion principle | w: 5 | 考纲: 容斥原理
前置: set-operations, combination
后续: derangement, surjection-count
alias: 容斥原理, 包含排斥原理, 筛法

$$\abs{A_1\cup\cdots\cup A_n}=\sum_i\abs{A_i}-\sum_{i<j}\abs{A_i\cap A_j}+\sum_{i<j<k}\abs{A_i\cap A_j\cap A_k}-\cdots+(-1)^{n-1}\abs{A_1\cap\cdots\cap A_n}.$$

### 证明
一个恰好属于 $k\ge1$ 个集合的元素，在右边被计数 $\binom k1-\binom k2+\cdots+(-1)^{k-1}\binom kk=1-(1-1)^k=1$ 次。

### 例题
$1$ 到 $1000$ 中不能被 $2,3,5$ 中任何一个整除的数：
$$1000-(500+333+200)+(166+100+66)-33=266.$$
欧拉函数公式 $\varphi(n)=n\prod_{p\mid n}\left(1-\frac1p\right)$ 是同一计算的一般形式。

### 概率版本
$\PP\left(\bigcup A_i\right)=\sum\PP(A_i)-\sum\PP(A_i\cap A_j)+\cdots$。截断时得到交替的上下界（邦费罗尼不等式）。

## 错排问题 {#derangement}
type: 例题 | en: Derangements | w: 4 | 考纲: 容斥原理, 递推关系
源于: inclusion-exclusion
前置: recurrence-relation
alias: 错排, 装错信封, 伯努利-欧拉错排问题, D_n

$n$ 封信全部装错信封的方法数
$$D_n=n!\sum_{k=0}^n\frac{(-1)^k}{k!}=\left\lfloor\frac{n!}\ee+\frac12\right\rfloor,$$
满足递推 $D_n=(n-1)(D_{n-1}+D_{n-2})$，$D_1=0$，$D_2=1$。

### 推导
容斥：设 $A_i$ 为第 $i$ 封信装对的排列，$\abs{A_{i_1}\cap\cdots\cap A_{i_k}}=(n-k)!$，所以 $D_n=\sum_k(-1)^k\binom nk(n-k)!$。
递推：第 $1$ 封信装进第 $j$ 个信封（$n-1$ 种）；若第 $j$ 封信恰好装进第 $1$ 个信封，剩下 $n-2$ 封错排，否则把“第 $j$ 封不进第 $1$ 个信封”看作新的错排条件，得 $D_{n-1}$ 种。

### 注记
$\frac{D_n}{n!}\to\frac1\ee\approx0.368$：随机打乱时没有一个人拿到自己帽子的概率，几乎与人数无关。

## 递推关系 {#recurrence-relation}
type: 方法 | en: Recurrence relations | w: 5 | 考纲: 递推关系
源于: recurrence-sequence
后续: fibonacci, catalan, generating-function
相关: matrix-powers
alias: 线性递推, 特征方程, 齐次线性递推, 递推计数

用规模较小的情形表示规模为 $n$ 的计数。常系数齐次线性递推 $a_n=c_1a_{n-1}+\cdots+c_ka_{n-k}$ 的通解：特征方程 $x^k=c_1x^{k-1}+\cdots+c_k$ 的根为 $r_i$（重数 $m_i$）时，$a_n=\sum_iP_i(n)r_i^n$，$P_i$ 是次数小于 $m_i$ 的多项式。

### 例题
用 $1\times2$ 的骨牌铺满 $2\times n$ 的长方形的方法数 $a_n$：看最左边一列，竖放一块剩 $2\times(n-1)$，横放两块剩 $2\times(n-2)$，所以 $a_n=a_{n-1}+a_{n-2}$，$a_1=1$，$a_2=2$——斐波那契数。

### 注记
建立递推的关键是“看第一步（或最后一步）”。非齐次递推的通解 = 齐次通解 + 一个特解，与线性微分方程完全平行。

## 斐波那契数列 {#fibonacci}
type: 例子 | en: Fibonacci numbers | w: 4 | 考纲: 递推关系
是例子: recurrence-relation
相关: matrix-powers
alias: 斐波那契, 兔子数列, 黄金分割, 比内公式

$F_0=0$，$F_1=1$，$F_{n}=F_{n-1}+F_{n-2}$：$0,1,1,2,3,5,8,13,21,\dots$。特征方程 $x^2=x+1$ 的根为 $\varphi=\frac{1+\sqrt5}2$、$\psi=\frac{1-\sqrt5}2$，比内公式
$$F_n=\frac{\varphi^n-\psi^n}{\sqrt5}.$$

### 性质
- $\frac{F_{n+1}}{F_n}\to\varphi\approx1.618$（黄金比）；$F_n$ 是最接近 $\frac{\varphi^n}{\sqrt5}$ 的整数。
- $\gcd(F_m,F_n)=F_{\gcd(m,n)}$；卡西尼恒等式 $F_{n+1}F_{n-1}-F_n^2=(-1)^n$。
- 每个正整数都能唯一地写成不相邻的斐波那契数之和（齐肯多夫定理）。

### 注记
向日葵的螺旋数、菠萝的鳞片数常是相邻的斐波那契数；欧几里得算法最慢的输入正是相邻的斐波那契数。

## 卡特兰数 {#catalan}
type: 例子 | en: Catalan numbers | w: 4 | 考纲: 递推关系, 分类计数
前置: combination, recurrence-relation
相关: reflection-principle
alias: 卡特兰数, 括号匹配, 出栈序列, 二叉树计数, 不越过对角线的路径

$$C_n=\frac1{n+1}\binom{2n}n:\quad1,1,2,5,14,42,132,\dots,\qquad C_{n+1}=\sum_{k=0}^nC_kC_{n-k}.$$
它数的东西多得惊人：$n$ 对括号的合法匹配、凸 $n+2$ 边形的三角剖分、$n$ 个节点的二叉树、从 $(0,0)$ 到 $(n,n)$ 不越过对角线的格路、$n$ 个元素的出栈序列……

### 推导（反射法）
从 $(0,0)$ 到 $(n,n)$ 的格路共 $\binom{2n}n$ 条。越过对角线（碰到直线 $y=x+1$）的“坏路”，把它第一次碰到该直线之后的部分关于该直线反射，就一一对应到从 $(0,0)$ 到 $(n-1,n+1)$ 的路，共 $\binom{2n}{n+1}$ 条。所以
$$C_n=\binom{2n}n-\binom{2n}{n+1}=\frac1{n+1}\binom{2n}n.$$

## 母函数 {#generating-function}
type: 方法 | en: Generating functions | w: 4 | 考纲: 递推关系
前置: recurrence-relation, power-series, binomial-theorem
后续: catalan
alias: 生成函数, 普通母函数, 指数母函数, 形式幂级数

把数列编码为幂级数 $G(x)=\sum a_nx^n$。数列的运算对应函数的运算：卷积对应乘积，递推对应代数方程。

### 例题
- 斐波那契：$G=x+xG+x^2G$，$G(x)=\frac x{1-x-x^2}$，部分分式展开即得比内公式。
- 用面值 $1,2,5$ 元的硬币凑 $n$ 元的方法数是 $\frac1{(1-x)(1-x^2)(1-x^5)}$ 中 $x^n$ 的系数。
- 卡特兰数：$C(x)=1+xC(x)^2$，$C(x)=\frac{1-\sqrt{1-4x}}{2x}$，再用二项式展开 $(1-4x)^{1/2}$。

### 注记
欧拉用母函数证明：把 $n$ 分拆为奇数之和的方法数等于分拆为互不相同的数之和的方法数，因为 $\prod\frac1{1-x^{2k-1}}=\prod(1+x^k)$。概率中的母函数 $\E s^X$ 与特征函数是同一思想。

## 满射计数与斯特林数 {#surjection-count}
type: 公式 | en: Counting surjections | w: 3 | 考纲: 容斥原理, 分类计数
源于: inclusion-exclusion
alias: 满射个数, 第二类斯特林数, 集合的划分, 分球入盒

$n$ 元集到 $k$ 元集的满射个数为
$$\sum_{j=0}^k(-1)^j\binom kj(k-j)^n=k!\,S(n,k),$$
其中第二类斯特林数 $S(n,k)$ 是把 $n$ 个不同的元素划分为 $k$ 个非空无序组的方法数，满足 $S(n,k)=kS(n-1,k)+S(n-1,k-1)$。

### 分球入盒总表
$n$ 个球放进 $k$ 个盒子：球、盒都不同且允许空盒：$k^n$；不允许空盒：$k!S(n,k)$；球相同盒不同：$\binom{n+k-1}{k-1}$（[[stars-and-bars]]）；球不同盒相同：$\sum_{j\le k}S(n,j)$；球、盒都相同：整数分拆数。

## 极端原理 {#extremal-principle}
type: 方法 | en: Extremal principle | w: 3 | 考纲: 分类计数, 抽屉原理
alias: 极端原理, 最小反例, 无穷递降, 考虑最大最小

考虑问题中某个量的最大（最小）值所对应的对象，它往往具有特殊性质。良序原理保证正整数的非空子集有最小元，这正是无穷递降法与最小反例法的依据。

### 例题
平面上有限个点，每个点被涂成红或蓝，红蓝点数相等且无三点共线，证明可以把红蓝点两两配对连线使线段互不相交。取总长度最短的配对方式：若有两条线段 $R_1B_1$、$R_2B_2$ 相交，换成 $R_1B_2$、$R_2B_1$，由三角形不等式总长严格变短，矛盾。

### 注记
[[sylvester-gallai]] 的凯利证明、费马的无穷递降法证明 $x^4+y^4=z^2$ 无正整数解，都是极端原理的应用。
