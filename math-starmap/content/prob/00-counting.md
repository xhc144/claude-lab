---
galaxy: prob
cluster: counting
title: 计数原理
en: Counting principles
order: 0
level: hs
---

## 加法原理 {#addition-principle}
type: 原理 | en: Rule of sum | w: 4 | 考纲: 加法原理
后续: permutation, case-counting
alias: 分类加法计数原理, 加法原理

完成一件事有 $n$ 类互不重叠的办法，第 $i$ 类有 $m_i$ 种方法，则共有 $m_1+m_2+\cdots+m_n$ 种方法。集合语言：$A\cap B=\varnothing$ 时 $\abs{A\cup B}=\abs A+\abs B$。

### 注记
关键在“分类不重不漏”。各类有重叠时要用 [[inclusion-exclusion]] 修正。

## 乘法原理 {#multiplication-principle}
type: 原理 | en: Rule of product | w: 4 | 考纲: 乘法原理
后续: permutation, combination
alias: 分步乘法计数原理, 乘法原理

完成一件事需要 $n$ 个步骤，第 $i$ 步有 $m_i$ 种方法（且不论前面怎么做，这一步的方法数都相同），则共有 $m_1m_2\cdots m_n$ 种方法。集合语言：$\abs{A\times B}=\abs A\cdot\abs B$。

### 例题
$n$ 元集合的子集有 $2^n$ 个：每个元素“选或不选”两种。$5$ 位的二进制串有 $2^5=32$ 个。用 $1,2,3,4,5$ 组成的三位数（数字可重复）有 $5^3=125$ 个。

## 排列 {#permutation}
type: 公式 | en: Permutations | w: 5 | 考纲: 排列
前置: multiplication-principle
后续: combination, symmetric-group
alias: 排列数, A(n,m), 阶乘, 全排列, 圆排列

从 $n$ 个不同元素中取 $m$ 个按顺序排成一列，排列数
$$A_n^m=n(n-1)\cdots(n-m+1)=\frac{n!}{(n-m)!}.$$
全排列 $A_n^n=n!$。

### 例题
- **捆绑法**：$5$ 人排成一排，甲乙必须相邻：把甲乙看作一个整体，$A_4^4\cdot A_2^2=48$ 种。
- **插空法**：甲乙不相邻：先排其余 $3$ 人，再把甲乙插入 $4$ 个空位：$A_3^3\cdot A_4^2=72$ 种。
- **圆排列**：$n$ 人围坐圆桌（旋转视为相同）有 $(n-1)!$ 种。

## 组合 {#combination}
type: 公式 | en: Combinations | w: 5 | 考纲: 组合
前置: permutation
后续: binomial-theorem, pascal-triangle, stars-and-bars
alias: 组合数, C(n,m), 二项式系数, n 选 k

从 $n$ 个不同元素中取 $m$ 个（不计顺序），组合数
$$\binom nm=C_n^m=\frac{A_n^m}{m!}=\frac{n!}{m!(n-m)!}.$$

### 推导
先取后排：每个 $m$ 元组合可以排成 $m!$ 种排列，所以 $A_n^m=\binom nm\cdot m!$。

### 性质
$\binom nm=\binom n{n-m}$（取 $m$ 个等价于留下 $n-m$ 个）；$\binom nm=\binom{n-1}{m-1}+\binom{n-1}m$（按某个特定元素选或不选分类）。

### 例题
从 $6$ 男 $4$ 女中选 $3$ 人，至少 $1$ 女：$\binom{10}3-\binom63=120-20=100$。（若写成“先选 $1$ 女再任选 $2$ 人”得 $4\times\binom92=144$，会重复计数。）

## 二项式定理 {#binomial-theorem}
type: 定理 | en: Binomial theorem | w: 5 | 考纲: 组合, 中学数学全部内容
前置: combination
用到: math-induction
推广为: multinomial
alias: 二项式定理, 二项展开, 二项式系数, 通项公式

$$(a+b)^n=\sum_{k=0}^n\binom nka^{n-k}b^k,$$
第 $k+1$ 项 $T_{k+1}=\binom nka^{n-k}b^k$。

### 证明
组合证明：$(a+b)^n$ 是 $n$ 个括号相乘，展开时每个括号选 $a$ 或 $b$；选出 $k$ 个 $b$ 的方法有 $\binom nk$ 种，所以 $a^{n-k}b^k$ 的系数是 $\binom nk$。

### 例题
- $\sum_k\binom nk=2^n$（令 $a=b=1$）；$\sum_k(-1)^k\binom nk=0$（$n\ge1$）。
- 求 $\left(x-\frac2x\right)^6$ 的常数项：$T_{k+1}=\binom6k(-2)^kx^{6-2k}$，令 $6-2k=0$，$k=3$，常数项 $\binom63(-8)=-160$。

### 注记
牛顿推广到任意指数 $(1+x)^\alpha=\sum\binom\alpha kx^k$（$\abs x<1$），见 [[maclaurin-expansions]]。

## 杨辉三角与组合恒等式 {#pascal-triangle}
type: 性质 | en: Pascal's triangle and combinatorial identities | w: 4 | 考纲: 组合
前置: combination
alias: 杨辉三角, 帕斯卡三角, 范德蒙恒等式, 曲棍球棒恒等式, 组合恒等式

把二项式系数排成三角形，每个数等于肩上两数之和：$\binom nk=\binom{n-1}{k-1}+\binom{n-1}k$。南宋杨辉（1261）记载此图并注明出自贾宪，比帕斯卡早约四百年。

### 常用恒等式
- 范德蒙恒等式：$\sum_k\binom mk\binom n{r-k}=\binom{m+n}r$（从 $m$ 男 $n$ 女中选 $r$ 人，按女生人数分类）；
- 曲棍球棒恒等式：$\sum_{i=k}^n\binom ik=\binom{n+1}{k+1}$（按所选最大元素分类）；
- $\sum_kk\binom nk=n2^{n-1}$（从 $n$ 人中选一个委员会并指定一名主席）。

### 注记
组合恒等式最漂亮的证明往往是“双计数”：同一个集合用两种方式数，见 [[double-counting]]。杨辉三角中奇数的位置构成谢尔宾斯基三角形分形。

## 隔板法 {#stars-and-bars}
type: 方法 | en: Stars and bars | w: 4 | 考纲: 组合, 分类计数
前置: combination
alias: 隔板法, 插板法, 可重组合, 不定方程的非负整数解

方程 $x_1+x_2+\cdots+x_k=n$ 的正整数解有 $\binom{n-1}{k-1}$ 组，非负整数解有 $\binom{n+k-1}{k-1}$ 组。

### 推导
正整数解：$n$ 个球排成一排，$n-1$ 个空隙中插入 $k-1$ 块隔板，把球分成 $k$ 段非空的堆。非负解：令 $y_i=x_i+1$ 化为 $y_1+\cdots+y_k=n+k$ 的正整数解。

### 例题
$10$ 个相同的苹果分给 $3$ 个小朋友，每人至少一个：$\binom92=36$ 种。从 $n$ 种水果中可重复地选 $k$ 个：$\binom{n+k-1}k$ 种（可重组合）。

## 分类计数与一一对应 {#case-counting}
type: 方法 | en: Case analysis and bijections in counting | w: 4 | 考纲: 分类计数
前置: addition-principle, combination
alias: 分类计数, 一一对应, 映射法, 对应原理, 补集法

复杂计数问题的三条基本策略：
1. **分类**：按某个特征分成互斥的情形分别计数再相加；
2. **补集**：“至少一个”往往等于全部减去“一个都没有”；
3. **对应**：建立与另一个容易计数的集合的一一对应。

### 例题
凸 $n$ 边形的对角线最多有多少个内部交点？每个交点由两条对角线确定，而两条相交的对角线由 $4$ 个顶点唯一确定（凸四边形的两条对角线），反之亦然。在没有三条对角线共点时，交点数为 $\binom n4$。

### 注记
一一对应是组合数学的灵魂：卡特兰数的十几种解释、凯莱公式的普吕弗编码都是双射证明。

## 双计数 {#double-counting}
type: 方法 | en: Double counting | w: 4 | 考纲: 分类计数
前置: case-counting
后续: handshake-lemma
alias: 算两次, 富比尼原理, 双重计数

把同一个量用两种方式计算，得到等式或不等式。形式化：二部关系 $R\subseteq A\times B$ 的元素数 $=\sum_{a}\deg a=\sum_b\deg b$。

### 例题
- 握手引理：数“（人，握手）”对。
- $\sum_{k=1}^n\binom nk k=n2^{n-1}$：数“（委员会，主席）”对，先选委员会再选主席，或先选主席再选其余成员。
- 一个班 $30$ 人，每人恰有 $3$ 个好友（关系相互），共有多少对好友？$\frac{30\times3}2=45$。

## 多项式系数 {#multinomial}
type: 公式 | en: Multinomial coefficients | w: 2 | 考纲: 排列, 组合
源于: binomial-theorem
alias: 多项式定理, 可重排列, 不尽相异元素的排列

$n$ 个元素中有 $n_1$ 个相同的 $a_1$、$n_2$ 个相同的 $a_2$、……（$\sum n_i=n$），排列数为 $\binom n{n_1,\dots,n_k}=\frac{n!}{n_1!\cdots n_k!}$。多项式定理：
$$(x_1+\cdots+x_k)^n=\sum_{n_1+\cdots+n_k=n}\frac{n!}{n_1!\cdots n_k!}x_1^{n_1}\cdots x_k^{n_k}.$$

### 例题
“MISSISSIPPI” 的不同排列：$\frac{11!}{1!\,4!\,4!\,2!}=34650$。
